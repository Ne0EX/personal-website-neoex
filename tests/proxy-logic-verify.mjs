/**
 * tests/proxy-logic-verify.mjs
 * Pure logic verification of the proxy locale-routing engine.
 * No Next.js imports — tests the decision logic in isolation.
 * Run: node tests/proxy-logic-verify.mjs
 */

const SUPPORTED_LOCALES = ['en', 'th']
const PREFIXED_LOCALES = SUPPORTED_LOCALES.filter((l) => l !== 'en')

function hasLocalePrefix(pathname) {
  return PREFIXED_LOCALES.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  )
}

function isConsolePath(pathname) {
  return pathname === '/console' || pathname.startsWith('/console/')
}

function isApiPath(pathname) {
  return pathname.startsWith('/api/')
}

function resolveLocale(cookieLocale, country, acceptLang) {
  if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale)) return cookieLocale
  if (country === 'TH') return 'th'
  const langs = (acceptLang || '').split(',')
  if (langs.some((t) => t.trim().toLowerCase().startsWith('th'))) return 'th'
  return 'en'
}

/**
 * Simulate the proxy() logic without Next.js runtime.
 * Returns { action, target }:
 *   action: 'guard' | 'console' | 'api' | 'passthrough' | 'rewrite' | 'redirect'
 *   target: string | null
 */
function simulateProxy(pathname, cookieLocale, country, acceptLang) {
  // 1. Redirect-loop guard
  if (pathname.startsWith('/en')) return { action: 'guard', target: null }
  // 2. Console
  if (isConsolePath(pathname)) return { action: 'console', target: null }
  // 3. API
  if (isApiPath(pathname)) return { action: 'api', target: null }
  // 4. Already prefixed
  if (hasLocalePrefix(pathname)) return { action: 'passthrough', target: null }
  // 5. Resolve locale
  const locale = resolveLocale(cookieLocale, country, acceptLang)
  if (locale === 'en') {
    return { action: 'rewrite', target: `/en${pathname}` }
  }
  return { action: 'redirect', target: `/${locale}${pathname}` }
}

// ---------------------------------------------------------------------------
// Test cases: [name, pathname, cookieLocale, country, acceptLang, expectedAction, expectedTarget]
// ---------------------------------------------------------------------------
const tests = [
  ['bare /articles/002 → rewrite to /en/articles/002',
    '/articles/002', null, null, null, 'rewrite', '/en/articles/002'],

  ['bare / → rewrite to /en/',
    '/', null, null, null, 'rewrite', '/en/'],

  ['/th/articles/002 → passthrough (explicit prefix)',
    '/th/articles/002', null, null, null, 'passthrough', null],

  ['cookie=th, geo=US → redirect to /th/articles/002',
    '/articles/002', 'th', 'US', null, 'redirect', '/th/articles/002'],

  ['/en/articles/002 → loop guard (NextResponse.next())',
    '/en/articles/002', null, null, null, 'guard', null],

  ['geo=TH → redirect to /th/articles/002',
    '/articles/002', null, 'TH', null, 'redirect', '/th/articles/002'],

  ['/archive → rewrite to /en/archive',
    '/archive', null, null, null, 'rewrite', '/en/archive'],

  ['/console → console auth path',
    '/console', null, null, null, 'console', null],

  ['/console/editor → console auth path',
    '/console/editor', null, null, null, 'console', null],

  ['/api/chat → api pass-through',
    '/api/chat', null, null, null, 'api', null],

  ['accept-language: th → redirect to /th/',
    '/', null, null, 'th-TH,th;q=0.9,en;q=0.8', 'redirect', '/th/'],

  ['cookie=en, geo=TH → rewrite (cookie wins over geo)',
    '/articles/002', 'en', 'TH', null, 'rewrite', '/en/articles/002'],

  ['/th/ → passthrough',
    '/th/', null, null, null, 'passthrough', null],

  ['/en/anything → loop guard',
    '/en/foo/bar', null, null, null, 'guard', null],
]

// ---------------------------------------------------------------------------
// Matcher regex assertions — verify the config.matcher pattern is correct.
// The source must match what is in proxy.ts config.matcher[1].
// ---------------------------------------------------------------------------
const MATCHER_SOURCE =
  '/((?!_next/static|_next/image|api|console|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\..*).*)'

const matcherRe = new RegExp('^' + MATCHER_SOURCE.slice(1)) // strip leading '/' anchor implicit in Next

// Paths the matcher MUST exclude (proxy should NOT run — static assets / dotted files)
const mustExclude = [
  '/textures/earth_specular_2048.jpg',
  '/favicon.ico',
  '/sitemap.xml',
  '/robots.txt',
  '/images/hero.png',
  '/styles/global.css',
  '/data/feed.json',
]

// Paths the matcher MUST match (proxy SHOULD run — real content routes)
const mustMatch = [
  '/',
  '/articles/002',
  '/th',
  '/th/articles/002',
  '/photos/2026-05-bangkok/DSCF0002',
  '/fiction/transmission-001',
  '/archive',
]

console.log('\n--- Matcher regex assertions ---')
let matcherPassed = 0
let matcherFailed = 0

for (const p of mustExclude) {
  const matched = matcherRe.test(p.slice(1)) // RegExp anchors against path-without-leading-slash
  if (!matched) {
    console.log(`  PASS  [excluded] ${p}`)
    matcherPassed++
  } else {
    console.log(`  FAIL  [should be excluded but matched] ${p}`)
    matcherFailed++
  }
}

for (const p of mustMatch) {
  const matched = matcherRe.test(p.slice(1))
  if (matched) {
    console.log(`  PASS  [matched]  ${p}`)
    matcherPassed++
  } else {
    console.log(`  FAIL  [should match but excluded] ${p}`)
    matcherFailed++
  }
}

console.log(`\nMatcher assertions: ${matcherPassed}/${matcherPassed + matcherFailed} passed.`)
if (matcherFailed > 0) process.exit(1)

// ---------------------------------------------------------------------------

let passed = 0
let failed = 0

for (const [name, pathname, cookie, country, acceptLang, expectedAction, expectedTarget] of tests) {
  const { action, target } = simulateProxy(pathname, cookie, country, acceptLang)
  const actionOk = action === expectedAction
  const targetOk = expectedTarget === null ? target === null : target === expectedTarget
  const ok = actionOk && targetOk
  if (ok) {
    console.log(`  PASS  ${name}`)
    passed++
  } else {
    console.log(`  FAIL  ${name}`)
    if (!actionOk) console.log(`        action: expected=${expectedAction} got=${action}`)
    if (!targetOk) console.log(`        target: expected=${expectedTarget} got=${target}`)
    failed++
  }
}

console.log(`\n${passed}/${passed + failed} tests passed.`)
process.exit(failed > 0 ? 1 : 0)
