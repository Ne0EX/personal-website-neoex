// contract
// method · POST /api/auth/logout; no body
// request · same-origin browser request, verified using Origin
// response · 303 /console after removing this browser's session
// errors · 403 AUTH for invalid origin; 503 SIGNOUT_FAILED for Auth service failure
// rate limit · Supabase Auth limits; no application rate limit
// idempotency · safe to repeat; local scope leaves other devices signed in
// Pattern: app/api/console/auth-probe/route.ts. Owner: Altair (α-BND-02).

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/store/supabase/server'
import { consoleOAuthRedirect } from '@/lib/server/console-oauth'

function signOutFailure() {
  return NextResponse.json(
    { error: { code: 'SIGNOUT_FAILED', message: 'Sign out failed. Please try again.' } },
    { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
  )
}

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return NextResponse.json(
      { error: { code: 'AUTH', message: 'Invalid request origin' } },
      { status: 403, headers: { 'Cache-Control': 'private, no-store' } },
    )
  }

  try {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.signOut({ scope: 'local' })
    if (error) return signOutFailure()
    return consoleOAuthRedirect(request)
  } catch {
    return signOutFailure()
  }
}
