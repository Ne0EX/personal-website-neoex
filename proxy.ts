// contract
// --------
// file     · proxy.ts (Next 16 file convention)
// purpose  · console route gate — fail-closed session choke point.
//            REPLACES the WORLDLINE_AUTHORING=1 env flag gate (retired, spec §5.3/§11).
//
// matcher  · ['/console', '/console/:path*']
//
// behavior · (1) @supabase/ssr session-refresh pass: re-reads and rewrites the
//                auth cookie on every matched request, so token refreshes are
//                propagated even when the page doesn't do a full reload.
//            (2) supabase.auth.getUser() — contacts the Supabase Auth server to
//                validate the session token (not just reads from cookie).
//                No user → ALL matched paths rewrite to /console (which renders
//                <ConsoleLogin /> when unauthenticated). The requested sub-route
//                NEVER executes — the rewrite means the browser's URL does not
//                change but the server renders the login shell.
//            (3) User present → NextResponse.next() with the refreshed cookie
//                set on the response. Defence-in-depth is inside each page/action.
//
// fail-closed guarantee · a future console sub-route added without its own
//   page-level auth check is still unreachable unauthenticated, because the
//   proxy rewrite to /console (login) fires before any route renders.
//
// WORLDLINE_AUTHORING · RETIRED. The env var is no longer read here.
//   Remove from Vercel env and any docs that reference it (spec §11, S8 task).
//
// second layer · app/console/page.tsx + app/console/editor/page.tsx each call
//   supabase.auth.getUser() independently and render <ConsoleLogin /> if unauthed.
//   This is defence-in-depth behind the proxy, not the gate itself.
//
// third layer  · lib/server/auth.ts assertOwner() is called by every server
//   action. Final backstop is RLS at the DB.
//
// runtime  · nodejs (proxy.ts defaults to nodejs; the @supabase/ssr cookie
//            operations require the Node.js runtime, not edge, per the need to
//            read next/headers cookies() — which is Node-only in Next 16).
//            The `runtime` config option is not valid in proxy files (Next 16
//            docs: "Setting the runtime config option in Proxy will throw an error").
//
// rate-limit · none (console is Peat-only; signups disabled; no public traffic)
//
// Owner: Altair (α-BND-02) · store-as-source S4
// server: altair

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function proxy(request: NextRequest): Promise<NextResponse> {
  // Build a mutable response that will carry any refreshed auth cookies back
  // to the browser. We start with next() and potentially replace it with a
  // rewrite if the user is not authenticated.
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Create a session-refresh-aware client. getAll reads cookies from the
  // incoming request; setAll writes the refreshed cookies onto the response.
  // Both are required by @supabase/ssr to avoid "significant and difficult to
  // debug authentication issues" (documented in createServerClient.d.ts).
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          // Step 1: stamp cookies onto the request (so downstream reads see them)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          // Step 2: rebuild response with the updated request headers
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          // Step 3: stamp cookies onto the response so the browser receives them
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
          // Step 4: propagate any cache-control headers the library needs set
          // (prevents CDN caching of auth responses — see SetAllCookies type)
          if (headers) {
            Object.entries(headers).forEach(([key, value]) =>
              response.headers.set(key, value)
            )
          }
        },
      },
    }
  )

  // getUser() validates the token with the Supabase Auth server.
  // Never use getSession() for authorization — it reads from cookie only,
  // is unverified, and can be spoofed. This distinction is load-bearing.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // No authenticated user — rewrite every matched path to /console.
    // The browser URL does not change; the server renders ConsoleLogin.
    // This is the single choke-point: no console sub-route can execute
    // unauthenticated, regardless of whether its page has its own gate.
    const loginUrl = new URL('/console', request.url)
    return NextResponse.rewrite(loginUrl, {
      request: { headers: request.headers },
    })
  }

  // Authenticated — return the response with any refreshed cookies set.
  return response
}

export const config = {
  // Explicit array covers the bare /console path AND all sub-routes.
  // /console/:path* alone would miss the zero-segment /console case.
  matcher: ['/console', '/console/:path*'],
}
