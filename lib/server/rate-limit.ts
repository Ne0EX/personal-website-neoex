/**
 * lib/server/rate-limit.ts
 * ------------------------
 * In-memory per-session rate limiter for the NETRA chat endpoint.
 *
 * Policy: 50 messages per 24-hour sliding window, keyed on wl_session cookie.
 * Session IDs are generated server-side (crypto.randomUUID), set as HttpOnly
 * cookies, and never logged or stored beyond the in-memory counter map.
 *
 * In-memory works for single-instance deployment (Vercel single-region or
 * self-hosted Node). If multi-region or abuse patterns emerge, replace the
 * Map with Upstash Redis — the interface stays the same.
 *
 * Owner: Altair (α-BND-02) · TASK-2026-05-15-50
 * Ported verbatim to the resume worktree · slice S4
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum messages allowed per session per window. */
export const RATE_LIMIT_MAX = 50

/** Window duration in milliseconds. */
export const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000 // 24 hours

/** Cookie name for session identity. */
export const SESSION_COOKIE_NAME = 'wl_session'

/** Cookie max-age in seconds (30 days). */
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SessionRecord = {
  count: number
  windowStart: number
}

export type RateLimitResult =
  | { allowed: true; remaining: number; sessionId: string; isNew: boolean }
  | { allowed: false; remaining: 0; sessionId: string; isNew: boolean; resetAt: number }

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/**
 * In-memory map: sessionId → { count, windowStart }.
 * Module-level singleton — persists for the lifetime of the Node process.
 * Not shared across serverless instances; see PRD-05 §rate-limiting note.
 */
const sessions = new Map<string, SessionRecord>()

/**
 * Periodic cleanup: drop sessions whose window expired more than 48h ago
 * to prevent unbounded map growth. Runs at most once per hour (lazy trigger).
 */
let lastCleanup = 0
function maybeCleanup(): void {
  const now = Date.now()
  if (now - lastCleanup < 60 * 60 * 1000) return
  lastCleanup = now
  for (const [id, rec] of sessions) {
    if (now - rec.windowStart > 2 * RATE_LIMIT_WINDOW_MS) {
      sessions.delete(id)
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Check and increment the rate limit for a given session.
 *
 * Generates a new session ID if `existingSessionId` is absent or unknown.
 * Returns `allowed: false` with `resetAt` timestamp when the limit is hit.
 */
export function checkRateLimit(existingSessionId: string | undefined): RateLimitResult {
  maybeCleanup()

  const now = Date.now()
  const isNew = !existingSessionId || !sessions.has(existingSessionId)
  const sessionId = isNew ? crypto.randomUUID() : existingSessionId!

  const rec = sessions.get(sessionId)

  if (!rec || now - rec.windowStart >= RATE_LIMIT_WINDOW_MS) {
    // First message in window or window expired — reset.
    sessions.set(sessionId, { count: 1, windowStart: now })
    return {
      allowed: true,
      remaining: RATE_LIMIT_MAX - 1,
      sessionId,
      isNew,
    }
  }

  if (rec.count >= RATE_LIMIT_MAX) {
    return {
      allowed: false,
      remaining: 0,
      sessionId,
      isNew,
      resetAt: rec.windowStart + RATE_LIMIT_WINDOW_MS,
    }
  }

  rec.count += 1
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX - rec.count,
    sessionId,
    isNew,
  }
}

/**
 * Build the Set-Cookie header value for the session cookie.
 * Always HttpOnly, SameSite=Lax, 30-day max-age, Secure in production.
 */
export function buildSessionCookie(sessionId: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return [
    `${SESSION_COOKIE_NAME}=${sessionId}`,
    `Max-Age=${SESSION_COOKIE_MAX_AGE}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    secure,
  ]
    .filter(Boolean)
    .join('; ')
}
