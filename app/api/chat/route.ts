/** NETRA navigator endpoint. Required server env: OPENROUTER_API_KEY, NETRA_MODEL, UPSTASH_RESTORE_URL, UPSTASH_RESTORE_TOKEN, WL_DAILY_COST_CEILING. */
import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { stepCountIs, streamText } from 'ai'
import { createSupabaseServerClient } from '@/lib/store/supabase/server'
import { netraTools } from '@/lib/netra/tools'
import { NETRA_SYSTEM_PROMPT } from '@/lib/netra/prompts/system'
import { buildSessionCookie, checkRateLimit, SESSION_COOKIE_NAME } from '@/lib/server/rate-limit'

export const dynamic = 'force-dynamic'
const MAX_CONTEXT_MESSAGES = 10
const MessageSchema = z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(8_000) })
const ChatRequestSchema = z.object({ messages: z.array(MessageSchema).min(1).max(50), served_lang: z.enum(['en', 'th']).default('en') })
type ErrorCode = 'INVALID_BODY' | 'RATE_LIMITED' | 'UPSTREAM_UNAVAILABLE' | 'INTERNAL_ERROR'
function errorResponse(status: number, code: ErrorCode, message: string, details?: unknown) { return Response.json({ error: { code, message, ...(details === undefined ? {} : { details }) } }, { status }) }

async function redis(command: string[]) {
  const url = process.env.UPSTASH_RESTORE_URL; const token = process.env.UPSTASH_RESTORE_TOKEN
  if (!url || !token) return null
  const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command) })
  if (!response.ok) throw new Error(`upstash ${response.status}`)
  return ((await response.json()) as { result?: string | number | null }).result ?? null
}

async function quota(sessionId: string): Promise<{ allowed: true; remaining: number } | { allowed: false; resetAt: number; ceiling?: boolean } | null> {
  const hasRedis = Boolean(process.env.UPSTASH_RESTORE_URL && process.env.UPSTASH_RESTORE_TOKEN && process.env.WL_DAILY_COST_CEILING)
  if (!hasRedis) {
    if (process.env.NODE_ENV !== 'production') { const local = checkRateLimit(sessionId); return local.allowed ? { allowed: true, remaining: local.remaining } : { allowed: false, resetAt: local.resetAt } }
    return null
  }
  const count = Number(await redis(['INCR', `wl:session:${sessionId}:count`]))
  if (count === 1) await redis(['EXPIRE', `wl:session:${sessionId}:count`, '86400'])
  if (count > 50) return { allowed: false, resetAt: Date.now() + 86400000 }
  const ceiling = Number(process.env.WL_DAILY_COST_CEILING); const spend = Number(await redis(['GET', 'wl:daily:spend']))
  if (Number.isFinite(ceiling) && spend >= ceiling) return { allowed: false, resetAt: Date.now() + 86400000, ceiling: true }
  return { allowed: true, remaining: 50 - count }
}

export async function POST(request: NextRequest): Promise<Response> {
  const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? crypto.randomUUID()
  let quotaResult: Awaited<ReturnType<typeof quota>>
  try { quotaResult = await quota(sessionId) } catch (error) { console.error('[api/chat] quota unavailable:', error instanceof Error ? error.name : typeof error); return errorResponse(503, 'UPSTREAM_UNAVAILABLE', 'signal lost · α holding · try again') }
  if (!quotaResult) return errorResponse(503, 'UPSTREAM_UNAVAILABLE', 'signal lost · α holding · try again')
  const sessionCookie = buildSessionCookie(sessionId)
  if (!quotaResult.allowed) {
    if (quotaResult.ceiling) return errorResponse(503, 'UPSTREAM_UNAVAILABLE', 'α drift exceeded · NETRA dormant until next worldline.')
    return new Response(JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'α drift exceeded · NETRA dormant until next worldline.' } }), { status: 429, headers: { 'Content-Type': 'application/json', 'X-NETRA-Remaining': '0', 'Retry-After': String(Math.max(1, Math.ceil((quotaResult.resetAt - Date.now()) / 1000))), 'Set-Cookie': sessionCookie } })
  }
  let parsed: z.infer<typeof ChatRequestSchema>
  try { parsed = ChatRequestSchema.parse(await request.json()) } catch (error) { return errorResponse(400, 'INVALID_BODY', 'invalid request shape', error instanceof z.ZodError ? error.flatten() : undefined) }
  if (!process.env.OPENROUTER_API_KEY || !process.env.NETRA_MODEL) {
    console.warn('[api/chat] OpenRouter env presence:', { apiKey: Boolean(process.env.OPENROUTER_API_KEY), model: Boolean(process.env.NETRA_MODEL) })
    return errorResponse(503, 'UPSTREAM_UNAVAILABLE', 'signal lost · α holding · try again')
  }
  try {
    const supabase = await createSupabaseServerClient(); const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY })
    const result = streamText({ model: openrouter(process.env.NETRA_MODEL), system: `${NETRA_SYSTEM_PROMPT}\n\nserved_lang: ${parsed.served_lang}`, messages: parsed.messages.slice(-MAX_CONTEXT_MESSAGES), tools: netraTools, experimental_context: { supabase, lang: parsed.served_lang }, stopWhen: stepCountIs(5), abortSignal: request.signal, onFinish: () => { void redis(['INCRBYFLOAT', 'wl:daily:spend', '0.01']) } })
    return result.toTextStreamResponse({ headers: { 'X-NETRA-Remaining': String(quotaResult.remaining), 'Set-Cookie': sessionCookie, 'X-Accel-Buffering': 'no' } })
  } catch (error) { console.error('[api/chat] upstream error type:', error instanceof Error ? error.name : typeof error); return errorResponse(503, 'UPSTREAM_UNAVAILABLE', 'signal lost · α holding · try again') }
}
