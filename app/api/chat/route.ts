import { type NextRequest } from 'next/server'
import { z } from 'zod'
import {
  NETRA_MAX_PATHNAME_LENGTH,
  resolveNetraPageContext,
  runNetraTurn,
} from '@/lib/netra'
import { createNetraGatewayRuntime } from '@/lib/netra/gateway'
import { createSupabaseServerClient } from '@/lib/store/supabase/server'
import { createNetraKnowledge } from '@/lib/store/netra-reads'
import {
  buildSessionCookie,
  checkRateLimit,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  resolveSessionId,
  SESSION_COOKIE_NAME,
} from '@/lib/server/rate-limit'

// contract
// method · POST /api/chat
// request · { messages: Array<{ role: 'user'; content: string }>; served_lang?: 'en' | 'th'; page: { pathname: string (bounded public path) } }
// response · streamed text; X-NETRA-Remaining and wl_session cookie headers
// errors · 400 INVALID_BODY (malformed body or unknown/private page) · 429 RATE_LIMITED · 503 UPSTREAM_UNAVAILABLE
// rate limit · 50 validated messages per 24h per canonical UUIDv4 session
// idempotency · not idempotent; accepted requests consume session quota; Vercel AI Gateway owns the project spend budget

export const dynamic = 'force-dynamic'

const SESSION_WINDOW_SECONDS = Math.floor(RATE_LIMIT_WINDOW_MS / 1000)

const MessageSchema = z.object({
  // Assistant turns are display data, never trusted client-authored context.
  role: z.literal('user'),
  content: z.string().min(1).max(8_000),
})
const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(50),
  served_lang: z.enum(['en', 'th']).default('en'),
  page: z.object({
    pathname: z.string().min(1).max(NETRA_MAX_PATHNAME_LENGTH),
  }),
})

type ChatRequest = z.infer<typeof ChatRequestSchema>
type ErrorCode = 'INVALID_BODY' | 'RATE_LIMITED' | 'UPSTREAM_UNAVAILABLE'
type QuotaResult =
  | { allowed: true; remaining: number; sessionId: string }
  | { allowed: false; resetAt: number; sessionId: string }

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

async function quota(sessionId: string): Promise<QuotaResult> {
  if (!resolveRedisCredentials()) {
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

  const now = Date.now()
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

  const page = resolveNetraPageContext(
    parsed.page.pathname,
    parsed.served_lang,
  )
  if (page.kind === 'unknown') {
    return errorResponse(400, 'INVALID_BODY', 'invalid request shape')
  }

  const sessionId = resolveSessionId(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  )

  let quotaResult: QuotaResult
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
  const sessionCookie = buildSessionCookie(quotaResult.sessionId)
  if (!quotaResult.allowed) {
    const headers = {
      'X-NETRA-Remaining': '0',
      'Retry-After': String(
        Math.max(1, Math.ceil((quotaResult.resetAt - Date.now()) / 1000)),
      ),
      'Set-Cookie': sessionCookie,
    }
    return errorResponse(
      429,
      'RATE_LIMITED',
      'α drift exceeded · NETRA dormant until next worldline.',
      { headers },
    )
  }

  const gatewayRuntime = createNetraGatewayRuntime({
    configuredModel: process.env.NETRA_MODEL,
    sessionId: quotaResult.sessionId,
  })
  if (!gatewayRuntime) {
    console.warn('[api/chat] rejected non-free NETRA model configuration')
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
    const knowledge = createNetraKnowledge(await createSupabaseServerClient())
    const result = await runNetraTurn(
      {
        messages: parsed.messages,
        servedLang: parsed.served_lang,
        page: parsed.page,
        abortSignal: request.signal,
      },
      {
        model: gatewayRuntime.model,
        providerOptions: gatewayRuntime.providerOptions,
        knowledge,
      },
    )

    return result.toUIMessageStreamResponse({
      headers: {
        'X-NETRA-Remaining': String(quotaResult.remaining),
        'Set-Cookie': sessionCookie,
        'X-Accel-Buffering': 'no',
      },
      onError: (error) => {
        logSafeError('upstream stream unavailable', error)
        return 'UPSTREAM_UNAVAILABLE'
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
