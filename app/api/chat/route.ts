import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { stepCountIs, streamText } from 'ai'
import { createSupabaseServerClient } from '@/lib/store/supabase/server'
import { netraTools } from '@/lib/netra/tools'
import { NETRA_SYSTEM_PROMPT } from '@/lib/netra/prompts/system'
import {
  buildSessionCookie,
  checkRateLimit,
  nextUtcMidnightEpochSeconds,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  resolveSessionId,
  SESSION_COOKIE_NAME,
} from '@/lib/server/rate-limit'

// contract
// method · POST /api/chat
// request · { messages: Array<{ role: 'user' | 'assistant'; content: string }>; served_lang?: 'en' | 'th' }
// response · streamed text; X-NETRA-Remaining and wl_session cookie headers
// errors · 400 INVALID_BODY · 429 RATE_LIMITED · 503 UPSTREAM_UNAVAILABLE
// rate limit · 50 validated messages per 24h per canonical UUIDv4 session
// idempotency · not idempotent; accepted requests consume quota and provider budget

export const dynamic = 'force-dynamic'

const MAX_CONTEXT_MESSAGES = 10
const SESSION_WINDOW_SECONDS = Math.floor(RATE_LIMIT_WINDOW_MS / 1000)
const DAILY_SPEND_KEY = 'wl:daily:spend'
const ESTIMATED_REQUEST_COST = '0.01'

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(8_000),
})
const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(50),
  served_lang: z.enum(['en', 'th']).default('en'),
})

type ChatRequest = z.infer<typeof ChatRequestSchema>
type ErrorCode = 'INVALID_BODY' | 'RATE_LIMITED' | 'UPSTREAM_UNAVAILABLE'
type QuotaResult =
  | { allowed: true; remaining: number; sessionId: string }
  | { allowed: false; resetAt: number; sessionId: string; ceiling?: boolean }

function errorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  options: { details?: unknown; headers?: HeadersInit } = {},
): Response {
  return Response.json(
    {
      error: {
        code,
        message,
        ...(options.details === undefined ? {} : { details: options.details }),
      },
    },
    { status, headers: options.headers },
  )
}

function logSafeError(context: string, error: unknown): void {
  console.error(
    `[api/chat] ${context}:`,
    error instanceof Error ? error.name : typeof error,
  )
}

type RedisCredentials = { url: string; token: string }

function resolveRedisCredentials(): RedisCredentials | null {
  const candidates = [
    [
      process.env.UPSTASH_REDIS_REST_URL,
      process.env.UPSTASH_REDIS_REST_TOKEN,
    ],
    [process.env.KV_REST_API_URL, process.env.KV_REST_API_TOKEN],
    [process.env.UPSTASH_RESTORE_URL, process.env.UPSTASH_RESTORE_TOKEN],
  ] as const

  for (const [url, token] of candidates) {
    if (url && token) return { url, token }
  }
  return null
}

async function redis(command: string[]): Promise<string | number | null> {
  const credentials = resolveRedisCredentials()
  if (!credentials) return null

  const response = await fetch(credentials.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${credentials.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  })
  if (!response.ok) throw new Error(`upstash ${response.status}`)

  return ((await response.json()) as { result?: string | number | null }).result ?? null
}

function numericRedisResult(
  value: string | number | null,
  fallback?: number,
): number {
  if (value === null) {
    if (fallback !== undefined) return fallback
    throw new Error('missing numeric Redis response')
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error('invalid numeric Redis response')
  return parsed
}

async function expireDailySpendAtUtcMidnight(nowMs: number = Date.now()): Promise<void> {
  await redis([
    'EXPIREAT',
    DAILY_SPEND_KEY,
    String(nextUtcMidnightEpochSeconds(nowMs)),
  ])
}

async function readDailySpend(nowMs: number = Date.now()): Promise<number> {
  const value = await redis(['GET', DAILY_SPEND_KEY])
  await expireDailySpendAtUtcMidnight(nowMs)
  return numericRedisResult(value, 0)
}

async function recordDailySpend(nowMs: number = Date.now()): Promise<void> {
  await redis(['INCRBYFLOAT', DAILY_SPEND_KEY, ESTIMATED_REQUEST_COST])
  await expireDailySpendAtUtcMidnight(nowMs)
}

async function quota(sessionId: string): Promise<QuotaResult | null> {
  const ceilingValue = process.env.WL_DAILY_COST_CEILING
  const redisCredentials = resolveRedisCredentials()
  const hasRedis = Boolean(redisCredentials && ceilingValue)

  if (!hasRedis) {
    if (process.env.NODE_ENV !== 'production') {
      const local = checkRateLimit(sessionId)
      return local.allowed
        ? {
            allowed: true,
            remaining: local.remaining,
            sessionId: local.sessionId,
          }
        : {
            allowed: false,
            resetAt: local.resetAt,
            sessionId: local.sessionId,
          }
    }
    return null
  }

  const ceiling = Number(ceilingValue)
  if (!Number.isFinite(ceiling) || ceiling < 0) {
    throw new Error('invalid NETRA daily cost ceiling')
  }

  const now = Date.now()
  const dailyResetAt = nextUtcMidnightEpochSeconds(now) * 1000
  const spend = await readDailySpend(now)
  if (spend >= ceiling) {
    return {
      allowed: false,
      resetAt: dailyResetAt,
      sessionId,
      ceiling: true,
    }
  }

  const sessionKey = `wl:session:${sessionId}:count`
  const count = numericRedisResult(await redis(['INCR', sessionKey]))
  if (count === 1) {
    await redis(['EXPIRE', sessionKey, String(SESSION_WINDOW_SECONDS)])
  }
  if (count > RATE_LIMIT_MAX) {
    const ttl = numericRedisResult(
      await redis(['TTL', sessionKey]),
      SESSION_WINDOW_SECONDS,
    )
    return {
      allowed: false,
      resetAt: now + (ttl > 0 ? ttl : SESSION_WINDOW_SECONDS) * 1000,
      sessionId,
    }
  }

  return {
    allowed: true,
    remaining: Math.max(0, RATE_LIMIT_MAX - count),
    sessionId,
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  let parsed: ChatRequest
  try {
    parsed = ChatRequestSchema.parse(await request.json())
  } catch (error) {
    return errorResponse(400, 'INVALID_BODY', 'invalid request shape', {
      details: error instanceof z.ZodError ? error.flatten() : undefined,
    })
  }

  const sessionId = resolveSessionId(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  )

  let quotaResult: QuotaResult | null
  try {
    quotaResult = await quota(sessionId)
  } catch (error) {
    logSafeError('quota unavailable', error)
    return errorResponse(
      503,
      'UPSTREAM_UNAVAILABLE',
      'signal lost · α holding · try again',
    )
  }
  if (!quotaResult) {
    return errorResponse(
      503,
      'UPSTREAM_UNAVAILABLE',
      'signal lost · α holding · try again',
    )
  }

  const sessionCookie = buildSessionCookie(quotaResult.sessionId)
  if (!quotaResult.allowed) {
    const headers = {
      'X-NETRA-Remaining': '0',
      'Retry-After': String(
        Math.max(1, Math.ceil((quotaResult.resetAt - Date.now()) / 1000)),
      ),
      'Set-Cookie': sessionCookie,
    }
    if (quotaResult.ceiling) {
      return errorResponse(
        503,
        'UPSTREAM_UNAVAILABLE',
        'α drift exceeded · NETRA dormant until next worldline.',
        { headers },
      )
    }
    return errorResponse(
      429,
      'RATE_LIMITED',
      'α drift exceeded · NETRA dormant until next worldline.',
      { headers },
    )
  }

  if (!process.env.OPENROUTER_API_KEY || !process.env.NETRA_MODEL) {
    console.warn('[api/chat] OpenRouter env presence:', {
      apiKey: Boolean(process.env.OPENROUTER_API_KEY),
      model: Boolean(process.env.NETRA_MODEL),
    })
    return errorResponse(
      503,
      'UPSTREAM_UNAVAILABLE',
      'signal lost · α holding · try again',
      {
        headers: {
          'X-NETRA-Remaining': String(quotaResult.remaining),
          'Set-Cookie': sessionCookie,
        },
      },
    )
  }

  try {
    const supabase = await createSupabaseServerClient()
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    })
    const result = streamText({
      model: openrouter(process.env.NETRA_MODEL),
      system: `${NETRA_SYSTEM_PROMPT}\n\nserved_lang: ${parsed.served_lang}`,
      messages: parsed.messages.slice(-MAX_CONTEXT_MESSAGES),
      tools: netraTools,
      experimental_context: { supabase, lang: parsed.served_lang },
      stopWhen: stepCountIs(5),
      abortSignal: request.signal,
      onError: ({ error }) => {
        logSafeError('upstream stream unavailable', error)
      },
      onFinish: async () => {
        try {
          await recordDailySpend()
        } catch (error) {
          logSafeError('daily spend update unavailable', error)
        }
      },
    })
    return result.toTextStreamResponse({
      headers: {
        'X-NETRA-Remaining': String(quotaResult.remaining),
        'Set-Cookie': sessionCookie,
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    logSafeError('upstream unavailable', error)
    return errorResponse(
      503,
      'UPSTREAM_UNAVAILABLE',
      'signal lost · α holding · try again',
      {
        headers: {
          'X-NETRA-Remaining': String(quotaResult.remaining),
          'Set-Cookie': sessionCookie,
        },
      },
    )
  }
}
