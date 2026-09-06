// contract
// method · GET /api/auth/callback
// request · one Supabase PKCE code; provider error and missing code fail closed
// response · 303 /console, after verified Google owner authorization
// errors · 303 /console?auth_error=oauth_failed|access_denied
// rate limit · Supabase Auth token-exchange limits; codes are single-use and cookie-bound
// idempotency · code exchange is single-use; retries return a safe login error
// Pattern: app/api/console/auth-probe/route.ts. Owner: Altair (α-BND-02).

import { createSupabaseServerClient } from '@/lib/store/supabase/server'
import { assertOwner } from '@/lib/server/auth'
import { consoleOAuthRedirect } from '@/lib/server/console-oauth'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (searchParams.has('error') || !code || searchParams.getAll('code').length !== 1) {
    return consoleOAuthRedirect(request, 'oauth_failed')
  }

  try {
    const supabase = await createSupabaseServerClient()
    // The SSR client writes exchanged session cookies through Next's cookie
    // store, which Next propagates to the redirect response.
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return consoleOAuthRedirect(request, 'oauth_failed')

    const owner = await assertOwner()
    if (!owner.ok) {
      // Remove this browser's rejected session without signing out other devices.
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
      return consoleOAuthRedirect(request, signOutError ? 'oauth_failed' : 'access_denied')
    }

    return consoleOAuthRedirect(request)
  } catch {
    return consoleOAuthRedirect(request, 'oauth_failed')
  }
}
