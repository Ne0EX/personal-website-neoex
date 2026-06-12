/**
 * lib/store/supabase/browser.ts
 * ---------------------------------------------------------------------------
 * Browser-side Supabase client factory.
 *
 * contract:
 *   - Uses @supabase/ssr's createBrowserClient — cookie-backed session in browser.
 *   - MUST only be imported in 'use client' components. The publishable key is
 *     in NEXT_PUBLIC_* — already in the client bundle; no new leakage.
 *   - Used by: ConsoleLogin (signInWithPassword), photo upload (direct-to-storage
 *     per DL3 spec §7 upload client flow).
 *   - Singleton pattern: createBrowserClient handles its own singleton internally
 *     via cookie-based session. Safe to call multiple times.
 *
 * Owner: Altair (α-BND-02) · store-as-source S4
 */

import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
