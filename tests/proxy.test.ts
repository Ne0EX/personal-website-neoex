/**
 * tests/proxy.test.ts — proxy.ts logic tests (ready for a future test runner)
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests the locale routing logic in proxy.ts.
 *
 * IMPORT LIMITATION (honest, per P3 gate):
 * No test runner (vitest/jest) is installed in this project. This file is
 * structured to be TypeScript-valid WITHOUT test runner globals. The test
 * functions are exported so they can be invoked manually via `npx tsx` or
 * wired to any future runner with zero changes.
 *
 * next/experimental/testing/server exports:
 *   - unstable_doesMiddlewareMatch  (underlying function matching proxy docs'
 *     "unstable_doesProxyMatch" — same logic, v16.2.6 build name)
 *   - isRewrite, getRewrittenUrl, getRedirectUrl
 *
 * The test functions call proxy() directly with a constructed NextRequest,
 * then assert on the response using the testing utilities.
 *
 * DEFERRED: running this file under a real test runner (next build + vitest)
 * — deferred per P3 environment constraints (no npm install allowed, single
 * dev server in use).
 *
 * SPEC: SPEC-2026-06-18-bilingual-translation-group §4.2 (PINNED MECHANIC)
 * Owner: Altair (α-BND-02) · bilingual P3
 */

import { NextRequest } from 'next/server'
import { proxy, config, SUPPORTED_LOCALES } from '../proxy'
import {
  unstable_doesMiddlewareMatch,
  isRewrite,
  getRewrittenUrl,
  getRedirectUrl,
} from 'next/experimental/testing/server'

// ---------------------------------------------------------------------------
// Type alias for test result (runner-agnostic)
// ---------------------------------------------------------------------------
interface TestResult {
  name: string
  passed: boolean
  error?: string
}

// ---------------------------------------------------------------------------
// Assertion helper
// ---------------------------------------------------------------------------
function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`)
}

// ---------------------------------------------------------------------------
// MATCHER tests — what the proxy EXCLUDES / INCLUDES
// ---------------------------------------------------------------------------

export async function test_matcher_excludes_next_static(): Promise<TestResult> {
  try {
    const matches = unstable_doesMiddlewareMatch({
      config: { matcher: config.matcher },
      url: '/_next/static/chunks/main.js',
    })
    assert(!matches, '/_next/static should NOT match the proxy')
    return { name: 'matcher excludes /_next/static', passed: true }
  } catch (e) {
    return { name: 'matcher excludes /_next/static', passed: false, error: String(e) }
  }
}

export async function test_matcher_excludes_next_image(): Promise<TestResult> {
  try {
    const matches = unstable_doesMiddlewareMatch({
      config: { matcher: config.matcher },
      url: '/_next/image?url=foo',
    })
    assert(!matches, '/_next/image should NOT match the proxy')
    return { name: 'matcher excludes /_next/image', passed: true }
  } catch (e) {
    return { name: 'matcher excludes /_next/image', passed: false, error: String(e) }
  }
}

export async function test_matcher_excludes_api(): Promise<TestResult> {
  try {
    const matches = unstable_doesMiddlewareMatch({
      config: { matcher: config.matcher },
      url: '/api/chat',
    })
    assert(!matches, '/api/chat should NOT match the locale group (excluded)')
    return { name: 'matcher excludes /api paths', passed: true }
  } catch (e) {
    return { name: 'matcher excludes /api paths', passed: false, error: String(e) }
  }
}

export async function test_matcher_excludes_favicon(): Promise<TestResult> {
  try {
    const matches = unstable_doesMiddlewareMatch({
      config: { matcher: config.matcher },
      url: '/favicon.ico',
    })
    assert(!matches, '/favicon.ico should NOT match the proxy')
    return { name: 'matcher excludes /favicon.ico', passed: true }
  } catch (e) {
    return { name: 'matcher excludes /favicon.ico', passed: false, error: String(e) }
  }
}

export async function test_matcher_matches_articles(): Promise<TestResult> {
  try {
    const matches = unstable_doesMiddlewareMatch({
      config: { matcher: config.matcher },
      url: '/articles/002',
    })
    assert(matches, '/articles/002 SHOULD match the proxy (locale routing)')
    return { name: 'matcher matches /articles/002', passed: true }
  } catch (e) {
    return { name: 'matcher matches /articles/002', passed: false, error: String(e) }
  }
}

export async function test_matcher_matches_root(): Promise<TestResult> {
  try {
    const matches = unstable_doesMiddlewareMatch({
      config: { matcher: config.matcher },
      url: '/',
    })
    assert(matches, '/ SHOULD match the proxy (locale routing)')
    return { name: 'matcher matches /', passed: true }
  } catch (e) {
    return { name: 'matcher matches /', passed: false, error: String(e) }
  }
}

export async function test_matcher_matches_console(): Promise<TestResult> {
  try {
    const matches = unstable_doesMiddlewareMatch({
      config: { matcher: config.matcher },
      url: '/console',
    })
    assert(matches, '/console SHOULD match the proxy (console auth group)')
    return { name: 'matcher matches /console', passed: true }
  } catch (e) {
    return { name: 'matcher matches /console', passed: false, error: String(e) }
  }
}

// ---------------------------------------------------------------------------
// LOCALE ROUTING tests
// ---------------------------------------------------------------------------

export async function test_bare_article_rewrites_to_en(): Promise<TestResult> {
  try {
    const req = new NextRequest('https://worldline.neoex.com/articles/002')
    const res = await proxy(req)
    assert(isRewrite(res), '/articles/002 → should be a rewrite (not redirect)')
    const rewritten = getRewrittenUrl(res)
    assert(!!rewritten, 'rewritten URL should not be null')
    assert(rewritten!.endsWith('/en/articles/002'), `rewritten URL should end with /en/articles/002, got: ${rewritten}`)
    assert(getRedirectUrl(res) === null, 'should not be a 3xx redirect')
    return { name: 'bare /articles/002 → rewrite to /en/articles/002', passed: true }
  } catch (e) {
    return { name: 'bare /articles/002 → rewrite to /en/articles/002', passed: false, error: String(e) }
  }
}

export async function test_root_rewrites_to_en(): Promise<TestResult> {
  try {
    const req = new NextRequest('https://worldline.neoex.com/')
    const res = await proxy(req)
    assert(isRewrite(res), '/ → should be a rewrite (not redirect)')
    assert(getRedirectUrl(res) === null, '/ → must not be a 3xx redirect (URL bar stays unprefixed)')
    return { name: 'bare / → rewrite (not 3xx)', passed: true }
  } catch (e) {
    return { name: 'bare / → rewrite (not 3xx)', passed: false, error: String(e) }
  }
}

export async function test_th_article_passthrough(): Promise<TestResult> {
  try {
    const req = new NextRequest('https://worldline.neoex.com/th/articles/002')
    const res = await proxy(req)
    assert(!isRewrite(res), '/th/articles/002 → should NOT be rewritten')
    assert(getRedirectUrl(res) === null, '/th/articles/002 → should NOT be redirected (pass-through)')
    return { name: '/th/articles/002 → pass-through', passed: true }
  } catch (e) {
    return { name: '/th/articles/002 → pass-through', passed: false, error: String(e) }
  }
}

export async function test_cookie_th_overrides_geo(): Promise<TestResult> {
  try {
    const req = new NextRequest('https://worldline.neoex.com/articles/002', {
      headers: {
        'x-vercel-ip-country': 'US',
        cookie: 'wl_locale=th',
      },
    })
    const res = await proxy(req)
    assert(!isRewrite(res), 'cookie=th → should be a redirect, not rewrite')
    const redirectUrl = getRedirectUrl(res)
    assert(!!redirectUrl, 'cookie=th → redirect URL should not be null')
    assert(redirectUrl!.includes('/th/articles/002'), `cookie=th → redirect should include /th/articles/002, got: ${redirectUrl}`)
    return { name: 'cookie wl_locale=th overrides geo (US)', passed: true }
  } catch (e) {
    return { name: 'cookie wl_locale=th overrides geo (US)', passed: false, error: String(e) }
  }
}

export async function test_redirect_loop_guard(): Promise<TestResult> {
  try {
    // The internal /en/... rewrite target must not re-trigger locale resolution.
    const req = new NextRequest('https://worldline.neoex.com/en/articles/002')
    const res = await proxy(req)
    assert(!isRewrite(res), '/en/... → should NOT be rewritten (loop guard)')
    assert(getRedirectUrl(res) === null, '/en/... → should NOT be redirected (loop guard)')
    return { name: '/en/* → loop guard fires (NextResponse.next())', passed: true }
  } catch (e) {
    return { name: '/en/* → loop guard fires (NextResponse.next())', passed: false, error: String(e) }
  }
}

export async function test_geo_th_redirects(): Promise<TestResult> {
  try {
    const req = new NextRequest('https://worldline.neoex.com/articles/002', {
      headers: {
        'x-vercel-ip-country': 'TH',
      },
    })
    const res = await proxy(req)
    const redirectUrl = getRedirectUrl(res)
    assert(!!redirectUrl, 'TH geo → redirect URL should not be null')
    assert(redirectUrl!.includes('/th/articles/002'), `TH geo → redirect should include /th/articles/002, got: ${redirectUrl}`)
    return { name: 'x-vercel-ip-country: TH → redirect to /th/', passed: true }
  } catch (e) {
    return { name: 'x-vercel-ip-country: TH → redirect to /th/', passed: false, error: String(e) }
  }
}

export async function test_supported_locales(): Promise<TestResult> {
  try {
    assert(SUPPORTED_LOCALES.includes('en'), "SUPPORTED_LOCALES should contain 'en'")
    assert(SUPPORTED_LOCALES.includes('th'), "SUPPORTED_LOCALES should contain 'th'")
    return { name: 'SUPPORTED_LOCALES contains en and th', passed: true }
  } catch (e) {
    return { name: 'SUPPORTED_LOCALES contains en and th', passed: false, error: String(e) }
  }
}

// ---------------------------------------------------------------------------
// Test runner — invoke with `npx tsx tests/proxy.test.ts`
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  const tests = [
    test_matcher_excludes_next_static,
    test_matcher_excludes_next_image,
    test_matcher_excludes_api,
    test_matcher_excludes_favicon,
    test_matcher_matches_articles,
    test_matcher_matches_root,
    test_matcher_matches_console,
    test_bare_article_rewrites_to_en,
    test_root_rewrites_to_en,
    test_th_article_passthrough,
    test_cookie_th_overrides_geo,
    test_redirect_loop_guard,
    test_geo_th_redirects,
    test_supported_locales,
  ]

  let passed = 0
  let failed = 0
  const failures: string[] = []

  for (const test of tests) {
    const result = await test()
    if (result.passed) {
      passed++
      console.log(`  ✓ ${result.name}`)
    } else {
      failed++
      failures.push(`  ✗ ${result.name}: ${result.error}`)
      console.log(`  ✗ ${result.name}: ${result.error}`)
    }
  }

  console.log(`\n${passed}/${passed + failed} tests passed.`)
  if (failed > 0) process.exit(1)
}

// Only run when executed directly (not imported)
if (typeof require !== 'undefined' && require.main === module) {
  run().catch(console.error)
} else if (import.meta.url === new URL(process.argv[1] ?? '', 'file://').href) {
  run().catch(console.error)
}
