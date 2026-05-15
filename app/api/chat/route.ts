/**
 * app/api/chat/route.ts
 * ---------------------
 * NETRA chat endpoint shell.
 *
 * // contract
 *   method  · POST
 *   path    · /api/chat
 *   idempotent · NO — each call consumes quota and emits a streamed response
 *
 *   request body (JSON) · {
 *     messages: Array<{ role: 'user' | 'assistant', content: string }>
 *   }
 *
 *   response (success) ·
 *     200 · streaming plain-text via AI SDK toTextStreamResponse()
 *         · Content-Type: text/plain; charset=utf-8
 *         · X-NETRA-Remaining: <number>  (remaining quota in current window)
 *         · Set-Cookie: wl_session=<id>; ... (on first request or re-issue)
 *
 *   error codes ·
 *     400 INVALID_BODY    — zod validation failed
 *     429 RATE_LIMITED    — 50 msg/24h for this session exceeded
 *     503 UPSTREAM_UNAVAILABLE — Anthropic API unreachable
 *     500 INTERNAL_ERROR  — unexpected server error
 *
 *   error body · { error: { code: string, message: string, details?: unknown } }
 *
 *   rate limit · 50 messages per 24-hour sliding window, keyed on wl_session
 *               cookie (HttpOnly, SameSite=Lax, 30d, Secure in production)
 *
 * Owner: Altair (α-BND-02) · TASK-2026-05-15-50
 *
 * Integration notes for Arcturus (TASK-51):
 *   [ARCTURUS-1] Import and replace NETRA_SYSTEM_PROMPT below with:
 *                import { NETRA_SYSTEM_PROMPT } from '@/lib/netra/prompts/system'
 *   [ARCTURUS-2] Import and replace NETRA_TOOLS below with:
 *                import { netraTools } from '@/lib/netra/tools'
 *                The tool shape: { description, inputSchema: zodSchema(z.object({...})), execute }
 *                where execute receives (input: { field }, options: ToolExecutionOptions).
 *   [ARCTURUS-3] Replace MODEL_ID with the model from the TASK-51 spec.
 *                PRD-05 recommends 'claude-haiku-4-5' for NETRA.
 *   [ARCTURUS-4] Tool results and refusal responses wire through the existing streamText
 *                call — no route changes needed. Just inject the filled tools object
 *                and the canonical system prompt string.
 *   [ARCTURUS-5] If Arcturus adds onChunk callbacks for instrument status lines
 *                ("NETRA · surveying archive ─────"), plug into streamText({ onChunk }).
 *                The route shell does not need structural changes.
 *
 * Integration notes for Sirius (TASK-52):
 *   — Consume via the AI SDK's useChat hook (client) or readableStream directly.
 *   — X-NETRA-Remaining header carries remaining quota; surface it in the chat UI.
 *   — On 429, display: "α drift exceeded · NETRA dormant until next worldline."
 *   — On 503, display: "signal lost · α holding · try again"
 */

import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { streamText, zodSchema, stepCountIs } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import {
  checkRateLimit,
  buildSessionCookie,
  SESSION_COOKIE_NAME,
} from '@/lib/server/rate-limit'

// ---------------------------------------------------------------------------
// Route segment config (Next.js 16 App Router)
// ---------------------------------------------------------------------------

/** Force dynamic — reads cookies, must not be statically pre-rendered. */
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Model ID.
 * [ARCTURUS-3] Replace with the model Arcturus specifies in TASK-51 spec.
 * PRD-05 recommends claude-haiku-4-5 for NETRA (terse answers, lower cost).
 */
const MODEL_ID = 'claude-haiku-4-5' as const

/**
 * Maximum number of prior messages to include in each request.
 * Rolling window keeps token costs low with NETRA's terse style.
 */
const MAX_CONTEXT_MESSAGES = 10

/**
 * Maximum tool-call steps per request.
 * NETRA may call a tool, get a result, then continue streaming — allow up to 5 cycles.
 */
const MAX_STEPS = 5

// ---------------------------------------------------------------------------
// Zod schema — input validation
// ---------------------------------------------------------------------------

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(8_000),
})

const ChatRequestSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(50),
})

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

type ErrorCode =
  | 'INVALID_BODY'
  | 'RATE_LIMITED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'INTERNAL_ERROR'

function errorResponse(
  status: number,
  code: ErrorCode,
  message: string,
  details?: unknown,
): Response {
  const body: { error: { code: string; message: string; details?: unknown } } = {
    error: { code, message },
  }
  if (details !== undefined) body.error.details = details
  return Response.json(body, { status })
}

// ---------------------------------------------------------------------------
// Tool definitions (stubs — Arcturus fills execute() in TASK-51)
// ---------------------------------------------------------------------------
//
// AI SDK v6 tool shape: { description, inputSchema: zodSchema(z.object({...})), execute }
// The execute function receives (input: InferredInput, options: ToolExecutionOptions).
//
// [ARCTURUS-2] Replace this entire object with:
//   import { netraTools } from '@/lib/netra/tools'
//
// Stub execute functions throw an explicit "not implemented" error so the route
// is deployable and the error surface is obvious during integration testing.
// Tool parameter schemas mirror PRD-05 §tool-definitions exactly so Arcturus
// can drop in execute() bodies without changing the inputSchema shapes.

const NETRA_TOOLS = {
  search_entries: {
    description: 'Search articles, photos, fiction by full-text query.',
    inputSchema: zodSchema(
      z.object({
        query: z.string(),
        filter: z.enum(['articles', 'photos', 'fiction', 'all']).default('all'),
        limit: z.number().min(1).max(10).default(5),
      }),
    ),
    // [ARCTURUS-2] Replace with velite/pagefind implementation consuming lib/content.
    execute: async (_input: { query: string; filter: string; limit: number }) => {
      // TODO(arcturus/TASK-51): implement via lib/content getArticles + getPhotos + getFiction
      return { error: 'not yet implemented — TASK-51 pending' }
    },
  },

  get_entry: {
    description: 'Fetch a single article by its file number.',
    inputSchema: zodSchema(
      z.object({
        file_num: z.string(),
      }),
    ),
    // [ARCTURUS-2] Replace with getArticleByFileNum from lib/content.
    execute: async (_input: { file_num: string }) => {
      // TODO(arcturus/TASK-51): implement via lib/content getArticleByFileNum
      return { error: 'not yet implemented — TASK-51 pending' }
    },
  },

  list_recent_patches: {
    description: 'List entries patched within the last N days.',
    inputSchema: zodSchema(
      z.object({
        days: z.number().min(1).max(90).default(7),
      }),
    ),
    // [ARCTURUS-2] Replace with patches iteration from lib/content.
    execute: async (_input: { days: number }) => {
      // TODO(arcturus/TASK-51): implement via lib/content getRecentArticles filtered by patch date
      return { error: 'not yet implemented — TASK-51 pending' }
    },
  },

  search_photos: {
    description: 'Search photo journal by tags, location, or roll name.',
    inputSchema: zodSchema(
      z.object({
        query: z.string(),
        limit: z.number().min(1).max(10).default(5),
      }),
    ),
    // [ARCTURUS-2] Replace with getPhotos / getPhotoSidecars from lib/content.
    execute: async (_input: { query: string; limit: number }) => {
      // TODO(arcturus/TASK-51): implement via lib/content getPhotos + getPhotoSidecars
      return { error: 'not yet implemented — TASK-51 pending' }
    },
  },

  list_fiction: {
    description: 'List all intercepted transmissions (fiction entries).',
    inputSchema: zodSchema(z.object({})),
    // [ARCTURUS-2] Replace with getFiction from lib/content.
    execute: async (_input: Record<string, never>) => {
      // TODO(arcturus/TASK-51): implement via lib/content getFiction
      return { error: 'not yet implemented — TASK-51 pending' }
    },
  },
} as const

// ---------------------------------------------------------------------------
// System prompt stub (Arcturus fills in TASK-51)
// ---------------------------------------------------------------------------

/**
 * [ARCTURUS-1] Replace with:
 *   import { NETRA_SYSTEM_PROMPT } from '@/lib/netra/prompts/system'
 *
 * The stub enforces the core register rules from PRD-05 so the endpoint is
 * testable before TASK-51 lands, and makes clear to Arcturus what is expected.
 */
const NETRA_SYSTEM_PROMPT: string =
  // TODO(arcturus/TASK-51): replace with import from lib/netra/prompts/system.ts
  `you are NETRA — Neural Executive & Task Response Assistant.
you narrate the state of an archive called Worldline.

[STUB — TASK-51 pending. Arcturus: replace this entire string with the
canonical system prompt from lib/netra/prompts/system.ts]

voice: lowercase. terse. italic register. never chatty.
refusal: outside the worldline → "outside the worldline. no signal."
`

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
    const resetAt = (rateResult as { allowed: false; resetAt: number }).resetAt
    return new Response(
      JSON.stringify({
        error: {
          code: 'RATE_LIMITED',
          message: 'α drift exceeded · NETRA dormant until next worldline.',
          details: { resetAt },
        },
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-NETRA-Remaining': '0',
          'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
          'Set-Cookie': sessionCookie,
        },
      },
    )
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

  // 5. Stream from Anthropic via AI SDK v6.
  try {
    const result = streamText({
      model: anthropic(MODEL_ID),
      system: NETRA_SYSTEM_PROMPT, // [ARCTURUS-1] replace with import
      messages,
      tools: NETRA_TOOLS,          // [ARCTURUS-2] replace with import
      // [ARCTURUS-5] Add onChunk callback here for instrument status lines if needed.
      // onChunk: ({ chunk }) => { ... },
      stopWhen: stepCountIs(MAX_STEPS), // allow NETRA to call tools and continue
      abortSignal: request.signal,
    })

    // 6. Build streaming response with required headers.
    const streamResponse = result.toTextStreamResponse({
      headers: {
        'X-NETRA-Remaining': String(rateResult.remaining),
        'Set-Cookie': sessionCookie,
        // No-buffer hint for reverse proxies (see Next.js streaming docs §reverse-proxies).
        'X-Accel-Buffering': 'no',
      },
    })

    return streamResponse
  } catch (error: unknown) {
    // Log error type only — never log message content or user PII.
    console.error('[api/chat] upstream error type:', error instanceof Error ? error.name : typeof error)

    const isUpstreamError =
      error instanceof Error &&
      (error.message.includes('fetch') ||
        error.message.includes('network') ||
        error.message.includes('API') ||
        error.message.includes('Anthropic'))

    if (isUpstreamError) {
      return errorResponse(503, 'UPSTREAM_UNAVAILABLE', 'signal lost · α holding · try again')
    }

    return errorResponse(500, 'INTERNAL_ERROR', 'an unexpected error occurred')
  }
}
