/**
 * lib/server/auth.ts
 * ---------------------------------------------------------------------------
 * Server-side auth guard — assertOwner() and related helpers.
 *
 * contract:
 *   method   · server-only (no 'use server' — this is a helper module, not an action)
 *   purpose  · replace assertDev() (highlight-core.ts) with a real Supabase auth
 *              check. Every server action that writes to the store calls assertOwner()
 *              as its first step. Defence-in-depth: RLS at the DB is the true backstop.
 *
 * assertOwner() contract:
 *   - Calls supabase.auth.getUser() via the cookie-bound server client.
 *   - Calls rpc('is_owner') to verify the user is in private.owners.
 *   - Returns {ok: true, userId: string} on success.
 *   - Returns {ok: false, error: {code: 'AUTH', message, details?}} on any failure.
 *   - NEVER throws — always returns the discriminated union.
 *   - No PII in logs — only the AUTH code is returned on failure.
 *   - isOwner RPC uses security definer (spec §3.1) — the call is safe from anon.
 *
 * AuthError type mirrors ActionError from highlight-core.ts so consumers can
 * use the same error-envelope handling (spec §7: same envelope as entry-actions.ts).
 *
 * Owner: Altair (α-BND-02) · store-as-source S4
 * // server-action: altair
 */

import { createSupabaseServerClient } from '@/lib/store/supabase/server'

// ---------------------------------------------------------------------------
// Shared error envelope (mirrors highlight-core.ts ActionError)
// ---------------------------------------------------------------------------

export type AuthError = {
  ok: false
  error: { code: 'AUTH'; message: string; details?: unknown }
}

export type AuthSuccess = {
  ok: true
  userId: string
}

export type AuthResult = AuthSuccess | AuthError

// ---------------------------------------------------------------------------
// assertOwner
// ---------------------------------------------------------------------------

/**
 * Verifies that the current request is authenticated as the site owner.
 *
 * Call this as the FIRST step in every server action that mutates data.
 * Even if somehow called from an unauthenticated context, RLS at the DB
 * will refuse the write — this is the convenience layer, not the hard gate.
 *
 * @returns {AuthResult} — {ok: true, userId} or {ok: false, error: {code: 'AUTH'}}
 */
export async function assertOwner(): Promise<AuthResult> {
  try {
    const supabase = await createSupabaseServerClient()

    // getUser() contacts the Supabase Auth server to validate the token.
    // Never use getSession() for authorization — it reads from cookies only
    // and is not verified. This distinction is load-bearing (spec §5.3).
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return {
        ok: false,
        error: { code: 'AUTH', message: 'Not authenticated' },
      }
    }

    // Double-check: user must be in private.owners via the is_owner() RPC
    // (security definer function — callable by anon/authenticated, never
    // exposes private.owners directly). Signups are disabled (DL12), so an
    // authenticated non-owner is impossible in production; this is
    // defence-in-depth for the rare case of a rogue session.
    const { data: isOwner, error: rpcError } = await supabase.rpc('is_owner')

    if (rpcError || !isOwner) {
      return {
        ok: false,
        error: { code: 'AUTH', message: 'Not authorized as owner' },
      }
    }

    return { ok: true, userId: user.id }
  } catch (err) {
    // Catch-all: network errors, unexpected throws — never leak details.
    return {
      ok: false,
      error: { code: 'AUTH', message: 'Auth check failed' },
    }
  }
}
