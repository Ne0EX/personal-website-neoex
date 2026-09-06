// contract
// method · GET /api/auth/google (full browser navigation; no prefetch)
// request · none; caller-supplied redirect destinations are ignored
// response · 303 to Supabase Google OAuth, with a cookie-bound PKCE verifier
// errors · 303 /console?auth_error=oauth_unavailable
// rate limit · Supabase Auth provider limits; no application credentials exchanged here
// idempotency · starts a fresh OAuth attempt; retry replaces the PKCE verifier
// Pattern: app/api/console/auth-probe/route.ts. Owner: Altair (α-BND-02).

import { createSupabaseServerClient } from '@/lib/store/supabase/server'
import { consoleOAuthRedirect, oauthRedirect } from '@/lib/server/console-oauth'

export async function GET(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!supabaseUrl || !publishableKey) {
    return consoleOAuthRedirect(request, 'oauth_unavailable')
  }

  try {
    // signInWithOAuth only builds a URL, so check readiness before sending
    // the browser to a provider that may not yet be configured.
    const settingsResponse = await fetch(new URL('/auth/v1/settings', supabaseUrl), {
      headers: { apikey: publishableKey },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!settingsResponse.ok) return consoleOAuthRedirect(request, 'oauth_unavailable')
    const settings = await settingsResponse.json()
    if (settings?.external?.google !== true) {
      return consoleOAuthRedirect(request, 'oauth_unavailable')
    }

    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: new URL('/api/auth/callback', request.url).toString(),
        skipBrowserRedirect: true,
        queryParams: {
          prompt: 'select_account',
          login_hint: 'neospiritth@gmail.com',
        },
      },
    })

    if (error || !data.url) return consoleOAuthRedirect(request, 'oauth_unavailable')
    return oauthRedirect(data.url)
  } catch {
    return consoleOAuthRedirect(request, 'oauth_unavailable')
  }
}
