/**
 * lib/store/supabase/server.ts
 * ---------------------------------------------------------------------------
 * Cookie-bound server-side Supabase client factory.
 *
 * contract:
 *   - Uses @supabase/ssr's createServerClient — cookie-aware, token-refresh-safe.
 *   - MUST be called inside a Server Component, Server Action, or Route Handler
 *     (anywhere `cookies()` from next/headers is available).
 *   - A new instance is created per-request — never share across requests.
 *   - Uses the publishable key; RLS governs what the authed/owner user sees.
 *     The secret key is NEVER used at runtime (scripts-only, §5.4).
 *   - Reading cookies makes console routes dynamic — correct per spec §5.1.
 *   - setAll: writes refreshed auth cookies back into the response so that
 *     token refreshes are not silently lost. Required by @supabase/ssr guidance.
 *
 * Owner: Altair (α-BND-02) · store-as-source S4
 */

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // setAll is called inside a Server Component where cookies() is
            // read-only. The token refresh will still reach the response via
            // the proxy.ts session-refresh pass. This is the documented
            // @supabase/ssr pattern for Next.js App Router.
          }
        },
      },
    }
  )
}
