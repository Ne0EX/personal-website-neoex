/**
 * app/api/chat/route.ts
 * ---------------------
 * NETRA chat endpoint — résumé survey surface (resume.neoex.dev).
 *
 * // contract
 *   method     · POST
 *   path       · /api/chat
 *   idempotent · NO — each call consumes rate-limit quota and (when the
 *                gateway is reachable) emits a streamed model response.
 *
 *   request body (JSON) · {
 *     messages: Array<{ role: 'user' | 'assistant', content: string }>
 *       — 1 to 50 items, each `content` 1 to 8000 characters
 *     target?: string | null
 *       — one of lib/netra/archive.ts's ARCHIVE_IDS (the visitor's current
 *         reticle target), or absent/null when nothing is pointed at
 *   }
 *
 *   response (success) ·
 *     200 · UI message stream (SSE) via the AI SDK v6 helper
 *           `StreamTextResult.toUIMessageStreamResponse()` — verified
 *           against installed node_modules/ai@6.0.218 types (S0 boot
 *           contract), NOT assumed from training data. Ships tool-call
 *           lifecycle events (tool-input-available / tool-output-available)
 *           alongside text deltas so the client can render NETRA's 2-line
 *           tool-call blocks from real tool state, never a synthetic guess.
 *         · Content-Type: text/event-stream (SDK default — also sets
 *           x-vercel-ai-ui-message-stream: v1 and x-accel-buffering: no by
 *           default; this route sets X-Accel-Buffering explicitly too,
 *           which is redundant but harmless)
 *         · X-NETRA-Remaining: <number> — remaining quota in the current window
 *         · Set-Cookie: wl_session=<id>; ... (on first request or re-issue)
 *
 *   error codes ·
 *     400 INVALID_BODY         — zod validation failed (bad JSON or bad shape)
 *     429 RATE_LIMITED         — 50 msg/24h for this session exceeded
 *     503 UPSTREAM_UNAVAILABLE — AI_GATEWAY_API_KEY absent, or the gateway
 *                                 threw before any stream content was sent
 *     500 INTERNAL_ERROR       — unexpected server error
 *
 *   error body · { error: { code: string, message: string, details?: unknown } }
 *
 *   Every response this route can emit — success, 400, 429, 503, 500 — also
 *   carries X-NETRA-Remaining and Set-Cookie. The session identity is known
 *   the moment checkRateLimit() runs (step 2, before body parsing), so it is
 *   established/renewed on every outcome. A visitor never loses quota
 *   tracking to a transient failure, and this is exactly what the smoke test
 *   for this slice verifies on a 503 and a 400.
 *
 *   rate limit · 50 messages per 24-hour sliding window, keyed on wl_session
 *               cookie (HttpOnly, SameSite=Lax, 30d, Secure in production)
 *
 * Model: Vercel AI Gateway, bare model-id string — no `@ai-sdk/anthropic`
 * dependency. A bare `"provider/model"` string passed to `streamText({model})`
 * resolves through the gateway provider by default (confirmed in installed
 * node_modules/ai/dist/index.js — the global default provider is `gateway`
 * unless overridden). Swapping models later is a string edit only.
 *
 * Tools: lib/netra/tools.ts's `netraTools` (search_archive, inspect_surface) —
 * built by Arcturus (S3), wired here unmodified.
 *
 * System prompt: lib/netra/prompt.ts's `buildSystemPrompt(target)` — marked
 * `import "server-only"` by Arcturus, so its text cannot enter the client
 * bundle even by accident.
 *
 * Graceful degradation: if AI_GATEWAY_API_KEY is not set, this route returns
 * 503 UPSTREAM_UNAVAILABLE *before* ever calling streamText() — a deliberate
 * upfront guard, not a caught exception, because whether the gateway auth
 * error would surface synchronously (before headers are sent) or only after
 * the stream has already started (SSE headers flushed, body still empty) is
 * an internal SDK timing detail this route does not want to depend on. The
 * upfront check makes the 503 deterministic regardless. This worktree has no
 * key in dev (see .env.example) and production may also run without one
 * until Peat provisions it — the client (S8) falls back to local keyword
 * retrieval and marks answers "· local" rather than erroring.
 *
 * Owner: Altair (α-BND-02) · slice S4, redesign-resume-neoex plan Part A
 */

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { streamText, stepCountIs } from 'ai'
import {
  checkRateLimit,
  buildSessionCookie,
  SESSION_COOKIE_NAME,
} from '@/lib/server/rate-limit'
import { buildSystemPrompt } from '@/lib/netra/prompt'
import { netraTools } from '@/lib/netra/tools'
import { ARCHIVE_IDS } from '@/lib/netra/archive'
import { DORMANCY } from '@/lib/netra/constants'

// ---------------------------------------------------------------------------
// Route segment config (Next.js 16 App Router)
// ---------------------------------------------------------------------------

/**
 * Force dynamic — reads cookies, must not be statically pre-rendered.
 * Verified valid: this worktree's next.config.ts does not set
 * `cacheComponents`, so the segment-config `dynamic` export is still the
 * live caching model (S0 boot contract — `cacheComponents: true` removes
 * this export entirely and nobody has flipped that switch on).
 */
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Vercel AI Gateway model id — bare string, resolved via the gateway provider. */
const MODEL_ID = 'anthropic/claude-haiku-4.5' as const

/**
 * Maximum number of prior messages to include in each request.
 * Rolling window keeps token costs low with NETRA's terse style.
 */
const MAX_CONTEXT_MESSAGES = 10

/**
 * Maximum tool-call steps per request (search/inspect, then a final answer).
 * Per the S3 brain contract: NETRA has exactly two tools and a 70-word reply
 * ceiling — three steps is generous headroom, not a hard requirement.
 */
const MAX_STEPS = 3

/** Reply length ceiling — the resume-surface delta caps replies at ~70 words. */
const MAX_OUTPUT_TOKENS = 300

// ---------------------------------------------------------------------------
// Zod schema — input validation
// ---------------------------------------------------------------------------

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(8_000),
})

const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(50),
  target: z.enum(ARCHIVE_IDS).nullable().optional(),
})

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

type ErrorCode = 'INVALID_BODY' | 'RATE_LIMITED' | 'UPSTREAM_UNAVAILABLE' | 'INTERNAL_ERROR'

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<Response> {
  // 1. Session cookie — read before any early return so we can always set it.
  const existingSessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value

  // 2. Rate limit check.
  const rateResult = checkRateLimit(existingSessionId)
  const sessionCookie = buildSessionCookie(rateResult.sessionId)

  if (!rateResult.allowed) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'RATE_LIMITED',
          message: DORMANCY.instrument,
          details: { resetAt: rateResult.resetAt },
        },
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-NETRA-Remaining': '0',
          'Retry-After': String(Math.ceil((rateResult.resetAt - Date.now()) / 1000)),
          'Set-Cookie': sessionCookie,
        },
      },
    )
  }

  // From here on `rateResult` is narrowed to the `allowed: true` branch, so
  // `rateResult.remaining` is always a real number — every response below
  // (success or error) can honestly report it and renew the session cookie.
  function errorResponse(status: number, code: ErrorCode, message: string, details?: unknown): Response {
    const body: { error: { code: string; message: string; details?: unknown } } = {
      error: { code, message },
    }
    if (details !== undefined) body.error.details = details
    return Response.json(body, {
      status,
      headers: {
        'X-NETRA-Remaining': String(rateResult.remaining),
        'Set-Cookie': sessionCookie,
      },
    })
  }

  // 3. Parse + validate request body.
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return errorResponse(400, 'INVALID_BODY', 'request body must be valid JSON')
  }

  const parsed = ChatRequestSchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse(400, 'INVALID_BODY', 'invalid request shape', parsed.error.flatten())
  }

  // 4. Trim context window.
  const allMessages = parsed.data.messages
  const messages = allMessages.slice(-MAX_CONTEXT_MESSAGES)
  const target = parsed.data.target

  // 5. Upfront upstream-availability guard — see header comment above for
  //    why this is a deliberate pre-check rather than a caught exception.
  if (!process.env.AI_GATEWAY_API_KEY) {
    console.error('[api/chat] upstream unavailable: AI_GATEWAY_API_KEY is not set')
    return errorResponse(503, 'UPSTREAM_UNAVAILABLE', 'signal lost · α holding · try again')
  }

  // 6. Stream from the model via AI SDK v6 + Vercel AI Gateway.
  try {
    const result = streamText({
      model: MODEL_ID,
      system: buildSystemPrompt(target),
      messages,
      tools: netraTools,
      stopWhen: stepCountIs(MAX_STEPS),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      abortSignal: request.signal,
    })

    // 7. Build the UI message stream response with required headers.
    return result.toUIMessageStreamResponse({
      headers: {
        'X-NETRA-Remaining': String(rateResult.remaining),
        'Set-Cookie': sessionCookie,
        // No-buffer hint for reverse proxies (see Next.js streaming docs
        // §reverse-proxies) — the SDK already defaults this header, kept
        // explicit per this route's own contract.
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error: unknown) {
    // Log error type only — never log message content or user PII.
    console.error('[api/chat] upstream error type:', error instanceof Error ? error.name : typeof error)

    const isUpstreamError =
      error instanceof Error &&
      (error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('API') ||
        error.message.includes('Anthropic') ||
        error.message.includes('gateway') ||
        error.message.includes('Authentication'))

    if (isUpstreamError) {
      return errorResponse(503, 'UPSTREAM_UNAVAILABLE', 'signal lost · α holding · try again')
    }

    return errorResponse(500, 'INTERNAL_ERROR', 'an unexpected error occurred')
  }
}
