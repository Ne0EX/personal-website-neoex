/**
 * Executable Next 16.3.3 proxy contract tests.
 *
 * Run in the required nonstandard lane with:
 *   node --import tsx tests/proxy.test.ts
 *
 * Next normally installs AsyncLocalStorage during server bootstrap. A standalone
 * Node test does not, so this test seeds the same standard Node primitive before
 * dynamically importing Next or proxy.ts. No Supabase-backed console request is
 * invoked; console containment is asserted at the matcher boundary.
 */

import assert from 'node:assert/strict'
import { AsyncLocalStorage } from 'node:async_hooks'
import { test } from 'node:test'


type RuntimeGlobal = typeof globalThis & {
  AsyncLocalStorage?: typeof AsyncLocalStorage
}

async function loadRuntime() {
  const runtimeGlobal = globalThis as RuntimeGlobal
  runtimeGlobal.AsyncLocalStorage ??= AsyncLocalStorage

  const [nextServer, proxyModule, testing] = await Promise.all([
    import('next/server'),
    import('../proxy'),
    import('next/experimental/testing/server'),
  ])

  // The installed 16.3.3 docs call this unstable_doesProxyMatch, while the
  // installed package export and declaration retain the middleware-era name.
  // Pin to the executable package contract until Next aligns the export.
  return {
    NextRequest: nextServer.NextRequest,
    proxy: proxyModule.proxy,
    config: proxyModule.config,
    supportedLocales: proxyModule.SUPPORTED_LOCALES,
    doesProxyMatch: testing.unstable_doesMiddlewareMatch,
    isRewrite: testing.isRewrite,
    getRewrittenUrl: testing.getRewrittenUrl,
    getRedirectUrl: testing.getRedirectUrl,
  }
}

const runtimePromise = loadRuntime()
const origin = 'https://worldline.neoex.com'

async function assertMatcher(url: string, expected: boolean) {
  const { config, doesProxyMatch } = await runtimePromise
  assert.equal(
    doesProxyMatch({ config, url }),
    expected,
    `unexpected proxy matcher result for ${url}`,
  )
}

test('matcher excludes Next internals, API paths, and dotted assets', async () => {
  await assertMatcher('/_next/static/chunks/main.js', false)
  await assertMatcher('/_next/image?url=foo', false)
  await assertMatcher('/api/chat', false)
  await assertMatcher('/favicon.ico', false)
  await assertMatcher('/textures/earth.jpg', false)
  await assertMatcher('/opengraph-image', false)
  await assertMatcher('/twitter-image', false)
})

test('matcher includes public routes and both console auth entry shapes', async () => {
  await assertMatcher('/', true)
  await assertMatcher('/articles/002', true)
  await assertMatcher('/console', true)
  await assertMatcher('/console/editor', true)
})

test('bare English article rewrites internally without redirecting', async () => {
  const { NextRequest, proxy, isRewrite, getRewrittenUrl, getRedirectUrl } =
    await runtimePromise
  const response = await proxy(new NextRequest(`${origin}/articles/002`))

  assert.equal(isRewrite(response), true)
  assert.equal(getRewrittenUrl(response), `${origin}/en/articles/002`)
  assert.equal(getRedirectUrl(response), null)
})

test('root rewrites to the internal English segment', async () => {
  const { NextRequest, proxy, isRewrite, getRewrittenUrl, getRedirectUrl } =
    await runtimePromise
  const response = await proxy(new NextRequest(`${origin}/`))

  assert.equal(isRewrite(response), true)
  assert.equal(getRewrittenUrl(response), `${origin}/en/`)
  assert.equal(getRedirectUrl(response), null)
})

test('English rewrite preserves the query string', async () => {
  const { NextRequest, proxy, getRewrittenUrl } = await runtimePromise
  const response = await proxy(
    new NextRequest(`${origin}/archive?domain=field-notes&page=2`),
  )

  assert.equal(
    getRewrittenUrl(response),
    `${origin}/en/archive?domain=field-notes&page=2`,
  )
})

test('Thai-prefixed paths pass through unchanged', async () => {
  const { NextRequest, proxy, isRewrite, getRedirectUrl } = await runtimePromise
  const response = await proxy(new NextRequest(`${origin}/th/articles/002`))

  assert.equal(isRewrite(response), false)
  assert.equal(getRedirectUrl(response), null)
})

test('internal English targets short-circuit to prevent rewrite loops', async () => {
  const { NextRequest, proxy, isRewrite, getRedirectUrl } = await runtimePromise

  for (const path of ['/en', '/en/articles/002']) {
    const response = await proxy(new NextRequest(`${origin}${path}`))
    assert.equal(isRewrite(response), false, path)
    assert.equal(getRedirectUrl(response), null, path)
  }
})

test('Thai locale cookie overrides non-Thai geo', async () => {
  const { NextRequest, proxy, isRewrite, getRedirectUrl } = await runtimePromise
  const response = await proxy(
    new NextRequest(`${origin}/articles/002`, {
      headers: {
        cookie: 'wl_locale=th',
        'x-vercel-ip-country': 'US',
      },
    }),
  )

  assert.equal(isRewrite(response), false)
  assert.equal(getRedirectUrl(response), `${origin}/th/articles/002`)
})

test('English locale cookie overrides Thai geo', async () => {
  const { NextRequest, proxy, isRewrite, getRewrittenUrl } = await runtimePromise
  const response = await proxy(
    new NextRequest(`${origin}/articles/002`, {
      headers: {
        cookie: 'wl_locale=en',
        'x-vercel-ip-country': 'TH',
      },
    }),
  )

  assert.equal(isRewrite(response), true)
  assert.equal(getRewrittenUrl(response), `${origin}/en/articles/002`)
})

test('Thai geo redirects a bare route and preserves its query', async () => {
  const { NextRequest, proxy, getRedirectUrl } = await runtimePromise
  const response = await proxy(
    new NextRequest(`${origin}/articles/002?view=compact`, {
      headers: { 'x-vercel-ip-country': 'TH' },
    }),
  )

  assert.equal(
    getRedirectUrl(response),
    `${origin}/th/articles/002?view=compact`,
  )
})

test('Thai Accept-Language redirects when cookie and geo are absent', async () => {
  const { NextRequest, proxy, getRedirectUrl } = await runtimePromise
  const response = await proxy(
    new NextRequest(`${origin}/fiction/the-signal`, {
      headers: { 'accept-language': 'en-US;q=0.8, th-TH;q=0.7' },
    }),
  )

  assert.equal(getRedirectUrl(response), `${origin}/th/fiction/the-signal`)
})

test('supported locale contract remains en and th', async () => {
  const { supportedLocales } = await runtimePromise
  assert.deepEqual(supportedLocales, ['en', 'th'])
})
