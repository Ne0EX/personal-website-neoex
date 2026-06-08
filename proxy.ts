// contract
// --------
// file     · proxy.ts (Next 16 file convention; successor to middleware.ts)
// purpose  · console route gate — blocks /console and all sub-routes in production
//            unless the WORLDLINE_AUTHORING=1 escape hatch is set
// matcher  · ['/console', '/console/:path*']
// method   · any (Next.js proxy intercepts before route rendering)
// gate     · process.env.NODE_ENV === 'production' && process.env.WORLDLINE_AUTHORING !== '1'
//            → 404 (NextResponse with status 404, null body — route appears non-existent)
//            otherwise → NextResponse.next() (pass through)
// runtime  · nodejs (proxy.ts defaults to nodejs; edge runtime requires middleware.ts
//            per Next 16 docs §middleware→proxy; since this gate only inspects
//            process.env the nodejs runtime is sufficient and correct)
// second layer · lib/server/places/highlight-core.ts#assertDev() refuses write actions
//               independently of NODE_ENV (not gated by WORLDLINE_AUTHORING), so even
//               a future protected authoring deploy with the flag set still can't write
//               (Vercel FS is read-only).
//
// MIGRATION NOTE:
//   Migrated from middleware.ts → proxy.ts per Next 16 deprecation warning:
//   "The 'middleware' file convention is deprecated. Please use 'proxy' instead."
//   See node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md §`middleware`
//   to `proxy` and .../03-api-reference/03-file-conventions/proxy.md.
//   Named export renamed from `middleware` → `proxy`; gate logic is byte-identical.
//   middleware.ts removed by Polaris via `git clean` (rm is gate-blocked for agents).
//
// Owner: Altair (α-BND-02)
// server: altair

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(_request: NextRequest): NextResponse {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.WORLDLINE_AUTHORING !== '1'
  ) {
    // Return a bare 404 with no body — the route appears non-existent.
    // NextResponse(null, { status: 404 }) is the canonical proxy-layer 404;
    // notFound() from next/navigation is RSC/route-handler-only and cannot be
    // used here.
    return new NextResponse(null, { status: 404 })
  }

  return NextResponse.next()
}

export const config = {
  // Explicit array covers the bare /console path AND all sub-routes.
  // /console/:path* alone would be ambiguous for the zero-segment case.
  matcher: ['/console', '/console/:path*'],
}
