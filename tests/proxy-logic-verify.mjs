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
