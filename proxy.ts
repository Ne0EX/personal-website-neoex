// contract
// --------
// file     · proxy.ts (Next 16 file convention — renamed from middleware.ts in v16.0.0)
// purpose  · TWO RESPONSIBILITIES (ordered):
//            1. Locale routing (bilingual P3) — asymmetric en-unprefixed pattern.
//               Bare paths → internally rewrite to /en/... (URL bar stays unprefixed).
//               Thai visitors (by cookie > geo > Accept-Language) → redirect to /th/...
//            2. Console auth gate — fail-closed session choke point (original purpose).
//               @supabase/ssr session refresh + getUser() validation.
//               No authenticated user → let /console render its guarded login shell;
//               rewrite nested /console/** paths once to that shell.
//
// matcher  · TWO GROUPS:
//            (a) Locale matcher: all public paths EXCEPT /_next, static assets, /api,
//                /console, and the internal /en/* re-entry target (loop guard).
//            (b) Console matcher: /console and /console/:path*
//
//            The proxy function checks which group the request belongs to and
//            dispatches accordingly. Both groups are listed in config.matcher so
//            Next.js invokes the proxy for all of them.
//
// LOCALE ROUTING (§4.2 SPEC-2026-06-18):
//   Asymmetric en-unprefixed logic (the PINNED MECHANIC per SPEC §4.2):
//   1. If pathname starts with /en/ → short-circuit (internal target, loop guard).
//   2. If pathname starts with a known non-en locale prefix (/th/) → pass through.
//   3. If pathname is a console/api/static path → skip (handled by console group).
//   4. Otherwise (bare unprefixed public path): resolve effective locale:
//      a. Cookie wl_locale (manual choice, WINS)
//      b. Geo x-vercel-ip-country (TH → th, else en)
//      c. Accept-Language (th-prefixed → th, else en)
//      d. Default: en
//   5. Effective locale == en → NextResponse.rewrite to /en + pathname + search.
//      URL bar stays unprefixed. The app/[lang]/ segment resolves lang='en' internally.
//   6. Effective locale == th → NextResponse.redirect to /th + pathname.
//
// REDIRECT-LOOP GUARD (SPEC §4.2, RISK-3):
//   The internal /en/... rewrite target must never re-trigger locale resolution.
//   Guard: if (pathname.startsWith('/en')) return NextResponse.next()
//   This short-circuits before any locale resolution for the /en re-entry.
//   The /en path is NOT excluded from the matcher (matcher exclusions are static;
//   the guard is dynamic and cheaper). The /console group already excludes /en.
//
// rate-limit · none (locale routing; console is Peat-only)
//
// Owner: Altair (α-BND-02) · bilingual P3 + store-as-source S4
// server: altair

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// ---------------------------------------------------------------------------
// Locale constants
// ---------------------------------------------------------------------------

/** Supported locale identifiers (PD4). Add here when a new language is enabled. */
export const SUPPORTED_LOCALES = ['en', 'th'] as const
export type SupportedLocale = typeof SUPPORTED_LOCALES[number]

/** Locale prefixes that are non-en (i.e. have an actual path prefix). */
const PREFIXED_LOCALES = SUPPORTED_LOCALES.filter((l) => l !== 'en')

// ---------------------------------------------------------------------------
// Locale resolution helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the effective locale from request signals.
 * Precedence: cookie wl_locale > geo > Accept-Language > default 'en'.
 * (SPEC §4.4)
 */
function resolveLocale(request: NextRequest): SupportedLocale {
  // 1. Cookie — manual choice wins (PD2: cookie name = wl_locale)
  const cookieLocale = request.cookies.get('wl_locale')?.value
  if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale as SupportedLocale)) {
    return cookieLocale as SupportedLocale
  }

  // 2. Geo — x-vercel-ip-country (set by Vercel CDN; absent in local dev)
  const country = request.headers.get('x-vercel-ip-country')
  if (country === 'TH') return 'th'

  // 3. Accept-Language — secondary signal; th-prefixed → th, else en
  const acceptLang = request.headers.get('accept-language') ?? ''
  if (acceptLang.split(',').some((tag) => tag.trim().toLowerCase().startsWith('th'))) {
    return 'th'
  }

  // 4. Default
  return 'en'
}

/**
 * Returns true when the request path is destined for the console group.
 * Console paths are handled by the console auth logic, not locale routing.
 */
function isConsolePath(pathname: string): boolean {
  return pathname === '/console' || pathname.startsWith('/console/')
}

/**
 * Returns true when the request path is an API path.
 */
function isApiPath(pathname: string): boolean {
  return pathname.startsWith('/api/')
}

/**
 * Returns true when the request path already carries a known non-en locale prefix.
 * These paths are passed through unchanged.
 */
function hasLocalePrefix(pathname: string): boolean {
  return PREFIXED_LOCALES.some(
    (locale) =>
      pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  )
}

// ---------------------------------------------------------------------------
// Console auth handler (original gate — store-as-source S4)
// ---------------------------------------------------------------------------

async function handleConsoleAuth(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request: { headers: request.headers },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
          if (headers) {
            Object.entries(headers).forEach(([key, value]) =>
              response.headers.set(key, value)
            )
          }
        },
      },
    }
  )

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  // Authentication alone is not authorization. Fail closed unless the
  // cookie-bound session also belongs to private.owners.
  let isOwner = false
  if (!userError && user) {
    const { data, error } = await supabase.rpc('is_owner')
    isOwner = !error && data === true
  }

  if (!user || !isOwner) {
    // /console is itself the guarded login shell. Rewriting it to the same URL
    // re-enters the proxy indefinitely in Next 16 and eventually returns 500.
    // The page repeats assertOwner() before rendering, so this pass-through remains
    // fail closed while giving the rewrite target a terminal route.
    if (request.nextUrl.pathname === '/console') {
      return response
    }

    const loginUrl = new URL('/console', request.url)
    const loginResponse = NextResponse.rewrite(loginUrl, {
      request: { headers: request.headers },
    })
    // Preserve any auth-cookie cleanup emitted while validating a stale session.
    response.cookies.getAll().forEach((cookie) => loginResponse.cookies.set(cookie))
    return loginResponse
  }

  return response
}

// ---------------------------------------------------------------------------
// Main proxy function
// ---------------------------------------------------------------------------

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // ── REDIRECT-LOOP GUARD ──────────────────────────────────────────────────
  // The internal /en/... rewrite target must never re-enter locale resolution.
  // Short-circuit before any other logic when the path already carries /en.
  // (SPEC §4.2 PINNED MECHANIC, RISK-3)
  if (pathname.startsWith('/en')) {
    return NextResponse.next()
  }

  // ── CONSOLE AUTH GROUP ───────────────────────────────────────────────────
  if (isConsolePath(pathname)) {
    return handleConsoleAuth(request)
  }

  // ── API PASS-THROUGH ─────────────────────────────────────────────────────
  // API routes are not locale-routed.
  if (isApiPath(pathname)) {
    return NextResponse.next()
  }

  // ── LOCALE ROUTING ───────────────────────────────────────────────────────

  // If the path already carries a known prefixed locale (/th/...) → pass through.
  // The app/[lang]/ segment will resolve lang='th' internally.
  if (hasLocalePrefix(pathname)) {
    return NextResponse.next()
  }

  // Bare unprefixed path — resolve effective locale.
  const locale = resolveLocale(request)
  const search = request.nextUrl.search

  if (locale === 'en') {
    // Serve as-is via an INTERNAL rewrite to /en + pathname.
    // The URL bar stays unprefixed (DL2 — existing English URLs preserved byte-for-byte).
    // NextResponse.rewrite propagates RSC headers automatically (proxy.md §RSC requests).
    const rewriteUrl = new URL(`/en${pathname}${search}`, request.url)
    // Inject x-wl-locale so the root app/layout.tsx can read the resolved lang
    // for the <html lang> attribute without needing to re-resolve locale signals.
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-wl-locale', 'en')
    return NextResponse.rewrite(rewriteUrl, {
      request: { headers: requestHeaders },
    })
  }

  // Non-en locale → redirect to /${locale}${pathname}.
  // The browser URL changes; the [lang] segment resolves the locale.
  const redirectUrl = new URL(`/${locale}${pathname}${search}`, request.url)
  return NextResponse.redirect(redirectUrl)
}

// ---------------------------------------------------------------------------
// Matcher — MUST be statically analyzable (no dynamic values)
// ---------------------------------------------------------------------------

export const config = {
  matcher: [
    // ── Console group ────────────────────────────────────────────────────────
    // Explicit array covers the bare /console path AND all sub-routes.
    '/console',
    '/console/:path*',

    // ── Locale group ─────────────────────────────────────────────────────────
    // Match all request paths EXCEPT:
    //   - /_next/static  (static files)
    //   - /_next/image   (image optimization)
    //   - /api           (API routes — handled by route handlers, not locale-routed)
    //   - /favicon.ico, /sitemap.xml, /robots.txt (metadata files)
    //   - /console       (handled by the console group above; prevent double-fire)
    //
    // NOTE: /en/... paths are NOT excluded from the matcher because the exclusion
    // list is static. The redirect-loop guard (pathname.startsWith('/en')) inside
    // the proxy function short-circuits before any locale resolution — dynamic guard
    // is correct here, static exclusion is not required (and would be fragile).
    //
    // `.*\\..*` excludes any path that contains a dot (e.g. /textures/earth.jpg,
    // /favicon.ico, /*.json, /*.png, /*.css). All real content routes use dot-free
    // slugs (articles → \d{3}, fiction → kebab, photos → roll/DSCF\d+) so this
    // pattern cannot accidentally eat a real page. The three named dotted files are
    // redundant once `.*\\..*` is present but are retained for clarity.
    '/((?!_next/static|_next/image|api|console|opengraph-image|twitter-image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\..*).*)',
  ],
}
