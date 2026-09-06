/**
 * Executes the production OAuth/auth modules with a mocked Supabase boundary.
 * No network, secrets, persisted sessions, or tracked-file mutation is used.
 * Pattern: tests/worldline-globe-coordinates.test.mjs TypeScript module loader.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import test from 'node:test'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const { NextRequest } = require('next/server')
const root = path.resolve(import.meta.dirname, '..')
const ownerEmail = 'neospiritth@gmail.com'
const supabaseUrl = 'https://auth-fixture.supabase.co'
const privateFailure = 'fixture-private-provider-error'

function loadModule(relativePath, mocks = {}, globals = {}) {
  const filename = path.join(root, relativePath)
  const source = readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText
  const testModule = { exports: {} }
  vm.runInNewContext(output, {
    module: testModule,
    exports: testModule.exports,
    require(specifier) {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier]
      if (specifier === 'server-only') return {}
      if (specifier.startsWith('@/')) {
        return loadModule(`${specifier.slice(2)}.ts`, mocks, globals)
      }
      if (specifier.startsWith('.')) {
        return loadModule(path.relative(root, path.resolve(path.dirname(filename), `${specifier}.ts`)), mocks, globals)
      }
      return require(specifier)
    },
    URL,
    Headers,
    Request,
    Response,
    AbortSignal,
    fetch: async () => Response.json({ external: { google: true } }),
    process: { env: {
      NODE_ENV: 'production',
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_fixture',
    } },
    ...globals,
  }, { filename })
  return testModule.exports
}

function googleOwner(overrides = {}) {
  return {
    id: 'fixture-owner-user',
    email: ownerEmail,
    email_confirmed_at: '2026-09-01T00:00:00Z',
    app_metadata: { provider: 'google', providers: ['google'] },
    user_metadata: {},
    identities: [{
      provider: 'google',
      identity_data: { email: ownerEmail, email_verified: true },
    }],
    ...overrides,
  }
}

function supabaseFixture(overrides = {}) {
  const calls = []
  const client = {
    auth: {
      async getUser() {
        calls.push('getUser')
        if (overrides.userThrows) throw new Error(privateFailure)
        return {
          data: { user: Object.hasOwn(overrides, 'user') ? overrides.user : googleOwner() },
          error: overrides.userError ?? null,
        }
      },
      async signInWithOAuth(options) {
        calls.push(['signInWithOAuth', options])
        if (overrides.oauthThrows) throw new Error(privateFailure)
        return {
          data: { url: Object.hasOwn(overrides, 'oauthUrl')
            ? overrides.oauthUrl : `${supabaseUrl}/auth/v1/authorize?provider=google` },
          error: overrides.oauthError ?? null,
        }
      },
      async exchangeCodeForSession(code) {
        calls.push(['exchangeCodeForSession', code])
        if (overrides.exchangeThrows) throw new Error(privateFailure)
        return { data: { user: googleOwner() }, error: overrides.exchangeError ?? null }
      },
      async signOut(options) {
        calls.push(['signOut', options])
        if (overrides.signOutThrows) throw new Error(privateFailure)
        return { error: overrides.signOutError ?? null }
      },
    },
    async rpc(name) {
      calls.push(['rpc', name])
      if (overrides.rpcThrows) throw new Error(privateFailure)
      return {
        data: Object.hasOwn(overrides, 'isOwner') ? overrides.isOwner : true,
        error: overrides.rpcError ?? null,
      }
    },
  }
  const mocks = {
    '@/lib/store/supabase/server': {
      async createSupabaseServerClient() {
        calls.push('createClient')
        if (overrides.clientThrows) throw new Error(privateFailure)
        return client
      },
    },
  }
  return { client, calls, mocks }
}

const rejectedIdentities = [
  ['anonymous', null],
  ['wrong account', googleOwner({ email: 'visitor@example.com' })],
  ['password-only owner', googleOwner({ identities: [{ provider: 'email' }] })],
  ['missing identities', googleOwner({ identities: undefined })],
  ['unverified Google identity', googleOwner({ identities: [{
    provider: 'google', identity_data: { email: ownerEmail, email_verified: false },
  }] })],
  ['truthy verification string', googleOwner({ identities: [{
    provider: 'google', identity_data: { email: ownerEmail, email_verified: 'true' },
  }] })],
  ['different linked Google email', googleOwner({ identities: [{
    provider: 'google', identity_data: { email: 'visitor@example.com', email_verified: true },
  }] })],
  ['spoofed editable metadata', googleOwner({
    identities: [{ provider: 'email' }],
    user_metadata: { provider: 'google', email: ownerEmail, email_verified: true },
  })],
]

test('verified Google owner identity accepts normalized email and linked email accounts', () => {
  const { isOwnerGoogleIdentity } = loadModule('lib/server/owner-identity.ts')
  assert.equal(isOwnerGoogleIdentity(googleOwner()), true)
  assert.equal(isOwnerGoogleIdentity(googleOwner({
    email: ownerEmail.toUpperCase(),
    app_metadata: { provider: 'email', providers: ['email', 'google'] },
    identities: [
      { provider: 'email' },
      { provider: 'google', identity_data: {
        email: ownerEmail.toUpperCase(), email_verified: true,
      } },
    ],
  })), true)
})

for (const [label, user] of rejectedIdentities) {
  test(`identity and server authorization reject ${label} even if the owner RPC would pass`, async () => {
    const fixture = supabaseFixture({ user })
    const { isOwnerGoogleIdentity } = loadModule('lib/server/owner-identity.ts')
    assert.equal(isOwnerGoogleIdentity(user), false)
    const { assertOwner } = loadModule('lib/server/auth.ts', fixture.mocks)
    const result = await assertOwner()
    assert.equal(result.ok, false)
    assert.equal(result.error.code, 'AUTH')
    assert.equal(fixture.calls.some((call) => Array.isArray(call) && call[0] === 'rpc'), false)
  })
}

test('owner authorization validates the token before checking existing database membership', async () => {
  const fixture = supabaseFixture()
  const { assertOwner } = loadModule('lib/server/auth.ts', fixture.mocks)
  const result = await assertOwner()
  assert.equal(result.ok, true)
  assert.equal(result.userId, 'fixture-owner-user')
  assert.deepEqual(fixture.calls, ['createClient', 'getUser', ['rpc', 'is_owner']])
})

for (const [label, overrides] of [
  ['Auth API failure', { userError: { message: privateFailure } }],
  ['missing membership', { isOwner: false }],
  ['truthy non-boolean membership', { isOwner: 'true' }],
  ['membership RPC error', { rpcError: { message: privateFailure } }],
  ['client initialization exception', { clientThrows: true }],
  ['Auth API exception', { userThrows: true }],
  ['membership RPC exception', { rpcThrows: true }],
]) {
  test(`server authorization fails closed without leaking details on ${label}`, async () => {
    const { mocks } = supabaseFixture(overrides)
    const result = await loadModule('lib/server/auth.ts', mocks).assertOwner()
    assert.equal(result.ok, false)
    assert.equal(result.error.code, 'AUTH')
    assert.doesNotMatch(JSON.stringify(result), new RegExp(privateFailure))
  })
}

for (const page of ['app/console/page.tsx', 'app/console/editor/page.tsx']) {
  test(`${page} renders login before any admin data access for a denied user`, async () => {
    const fixture = supabaseFixture({ user: googleOwner({ email: 'visitor@example.com' }) })
    const ConsoleLogin = () => null
    let reads = 0
    const forbiddenReads = new Proxy({}, { get() {
      return () => { reads += 1; throw new Error('Admin data read before authorization') }
    } })
    const route = loadModule(page, {
      ...fixture.mocks,
      '@/lib/store/admin-reads': forbiddenReads,
      '@/lib/content/places': forbiddenReads,
      '@/lib/store/reads': forbiddenReads,
      '@/components/console/ConsoleApp': { ConsoleApp: () => null },
      '@/components/console/EntryEditor': { EntryEditor: () => null },
      '@/components/console/ConsoleLogin': { ConsoleLogin },
    })
    const result = await route.default({ searchParams: Promise.resolve({}) })
    assert.equal(result.type, ConsoleLogin)
    assert.equal(reads, 0)
  })
}

test('auth probe returns HTTP 401 with the shared AUTH envelope for a denied identity', async () => {
  const fixture = supabaseFixture({ user: null })
  const route = loadModule('app/api/console/auth-probe/route.ts', fixture.mocks)
  const response = await route.GET()
  assert.equal(response.status, 401)
  const body = await response.json()
  assert.equal(body.ok, false)
  assert.equal(body.error.code, 'AUTH')
})

function expectConsoleRedirect(response, error) {
  assert.ok(response.status >= 300 && response.status < 400)
  const destination = new URL(response.headers.get('location'))
  assert.equal(destination.origin, 'https://neoex.dev')
  assert.equal(destination.pathname, '/console')
  assert.equal(destination.searchParams.get('auth_error'), error ?? null)
  assert.equal(destination.searchParams.get('next'), null)
  assert.doesNotMatch(destination.href, new RegExp(privateFailure))
  assert.match(response.headers.get('cache-control') ?? '', /no-store/)
}

function authRequest(pathname) {
  return new NextRequest(`https://neoex.dev${pathname}`, {
    headers: { 'x-forwarded-host': 'attacker.example', 'x-forwarded-proto': 'http' },
  })
}

test('Google login starts OAuth with a fixed callback and an account chooser', async () => {
  const fixture = supabaseFixture()
  const route = loadModule('app/api/auth/google/route.ts', fixture.mocks)
  const response = await route.GET(authRequest('/api/auth/google?next=https://attacker.example'))
  const authorizationUrl = new URL(response.headers.get('location'))
  assert.equal(authorizationUrl.origin, supabaseUrl)
  assert.equal(authorizationUrl.searchParams.get('provider'), 'google')
  const [, options] = fixture.calls.find((call) => Array.isArray(call) && call[0] === 'signInWithOAuth')
  assert.equal(options.provider, 'google')
  assert.equal(options.options.redirectTo, 'https://neoex.dev/api/auth/callback')
  assert.equal(options.options.queryParams.prompt, 'select_account')
  assert.equal(options.options.queryParams.login_hint, ownerEmail)
  assert.match(response.headers.get('cache-control') ?? '', /no-store/)
})

for (const [label, overrides] of [
  ['provider error', { oauthError: { message: privateFailure } }],
  ['provider exception', { oauthThrows: true }],
  ['missing authorization URL', { oauthUrl: null }],
  ['client initialization failure', { clientThrows: true }],
]) {
  test(`Google start handles ${label} with a safe retry screen`, async () => {
    const fixture = supabaseFixture(overrides)
    const route = loadModule('app/api/auth/google/route.ts', fixture.mocks)
    expectConsoleRedirect(await route.GET(authRequest('/api/auth/google')), 'oauth_unavailable')
  })
}

for (const [label, fetchSettings] of [
  ['Google disabled', async () => Response.json({ external: { google: false } })],
  ['missing provider settings', async () => Response.json({})],
  ['settings API unavailable', async () => new Response(null, { status: 503 })],
  ['settings API exception', async () => { throw new Error(privateFailure) }],
]) {
  test(`Google start fails locally on ${label} without sending the browser to a broken provider`, async () => {
    const fixture = supabaseFixture()
    const route = loadModule('app/api/auth/google/route.ts', fixture.mocks, { fetch: fetchSettings })
    expectConsoleRedirect(await route.GET(authRequest('/api/auth/google')), 'oauth_unavailable')
    assert.equal(fixture.calls.some((call) => Array.isArray(call) && call[0] === 'signInWithOAuth'), false)
  })
}

test('the installed Supabase SSR client creates a PKCE cookie and challenge for Google login', async () => {
  const writes = []
  const route = loadModule('app/api/auth/google/route.ts', {
    'next/headers': { cookies: async () => ({
      getAll: () => [],
      set: (name, value, options) => writes.push({ name, value, options }),
    }) },
  })
  const response = await route.GET(authRequest('/api/auth/google'))
  const authorizationUrl = new URL(response.headers.get('location'))
  assert.equal(authorizationUrl.origin, supabaseUrl)
  assert.equal(authorizationUrl.searchParams.get('code_challenge_method'), 's256')
  assert.ok(authorizationUrl.searchParams.get('code_challenge'))
  const verifierCookie = writes.find((cookie) => cookie.name.endsWith('-code-verifier'))
  assert.ok(verifierCookie, 'PKCE verifier must be persisted for the server callback')
  assert.ok(verifierCookie.value)
  assert.equal(verifierCookie.options.path, '/')
  assert.equal(verifierCookie.options.sameSite, 'lax')
})

test('successful callback exchanges the code and verifies the owner before its fixed console redirect', async () => {
  const fixture = supabaseFixture()
  const route = loadModule('app/api/auth/callback/route.ts', fixture.mocks)
  const response = await route.GET(authRequest('/api/auth/callback?code=valid-code&next=https://attacker.example'))
  expectConsoleRedirect(response)
  const calls = fixture.calls.filter((call) => call !== 'createClient')
  assert.deepEqual(calls, [['exchangeCodeForSession', 'valid-code'], 'getUser', ['rpc', 'is_owner']])
})

for (const [label, query] of [
  ['missing authorization code', ''],
  ['provider denial', '?error=access_denied&error_description=fixture-private-provider-error'],
  ['conflicting provider error and code', '?error=access_denied&code=valid-code'],
  ['duplicate authorization codes', '?code=first-code&code=second-code'],
]) {
  test(`callback rejects ${label} before exchange`, async () => {
    const fixture = supabaseFixture()
    const route = loadModule('app/api/auth/callback/route.ts', fixture.mocks)
    expectConsoleRedirect(await route.GET(authRequest(`/api/auth/callback${query}`)), 'oauth_failed')
    assert.equal(fixture.calls.some((call) => Array.isArray(call) && call[0] === 'exchangeCodeForSession'), false)
  })
}

for (const [label, overrides] of [
  ['invalid or replayed code', { exchangeError: { message: privateFailure } }],
  ['network exception during exchange', { exchangeThrows: true }],
]) {
  test(`callback handles ${label} without authorizing`, async () => {
    const fixture = supabaseFixture(overrides)
    const route = loadModule('app/api/auth/callback/route.ts', fixture.mocks)
    expectConsoleRedirect(await route.GET(authRequest('/api/auth/callback?code=invalid-code')), 'oauth_failed')
    assert.equal(fixture.calls.includes('getUser'), false)
  })
}

for (const [label, overrides] of [
  ...rejectedIdentities.map(([label, user]) => [label, { user }]),
  ['non-owner database member', { isOwner: false }],
]) {
  test(`callback signs out ${label} after exchange and denies console access`, async () => {
    const fixture = supabaseFixture(overrides)
    const route = loadModule('app/api/auth/callback/route.ts', fixture.mocks)
    expectConsoleRedirect(await route.GET(authRequest('/api/auth/callback?code=valid-code')), 'access_denied')
    const signOutCall = fixture.calls.find((call) => Array.isArray(call) && call[0] === 'signOut')
    assert.ok(signOutCall, 'denied OAuth sessions must be cleared')
    assert.equal(signOutCall[1].scope, 'local')
  })
}

test('proxy preserves stale-cookie cleanup while rewriting an anonymous editor request to login', async () => {
  let cookieAdapter
  const fixture = supabaseFixture({ user: null })
  fixture.client.auth.getUser = async () => {
    cookieAdapter.setAll([{ name: 'sb-fixture-auth-token', value: '', options: { path: '/', maxAge: 0 } }])
    return { data: { user: null }, error: null }
  }
  const { proxy } = loadModule('proxy.ts', {
    '@supabase/ssr': { createServerClient(_url, _key, options) {
      cookieAdapter = options.cookies
      return fixture.client
    } },
  })
  const response = await proxy(authRequest('/console/editor?kind=article&slug=private'))
  assert.equal(response.headers.get('x-middleware-rewrite'), 'https://neoex.dev/console')
  assert.equal(response.cookies.get('sb-fixture-auth-token').value, '')
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/)
})

for (const [label, user] of rejectedIdentities) {
  test(`proxy blocks a nested console request from ${label}`, async () => {
    const fixture = supabaseFixture({ user })
    const { proxy } = loadModule('proxy.ts', {
      '@supabase/ssr': { createServerClient: () => fixture.client },
    })
    const response = await proxy(authRequest('/console/editor'))
    assert.equal(response.headers.get('x-middleware-rewrite'), 'https://neoex.dev/console')
  })
}

test('proxy lets the guarded login page render without a recursive self-rewrite', async () => {
  const fixture = supabaseFixture({ user: null })
  const { proxy } = loadModule('proxy.ts', {
    '@supabase/ssr': { createServerClient: () => fixture.client },
  })
  const response = await proxy(authRequest('/console'))
  assert.equal(response.headers.get('x-middleware-rewrite'), null)
  assert.equal(response.headers.get('x-middleware-next'), '1')
})

test('proxy allows a verified owner and leaves the OAuth callback outside locale routing', async () => {
  const fixture = supabaseFixture()
  const { proxy } = loadModule('proxy.ts', {
    '@supabase/ssr': { createServerClient: () => fixture.client },
  })
  for (const pathname of ['/console/editor', '/api/auth/callback?code=valid-code']) {
    const response = await proxy(authRequest(pathname))
    assert.equal(response.headers.get('x-middleware-rewrite'), null)
    assert.equal(response.headers.get('location'), null)
    assert.equal(response.headers.get('x-middleware-next'), '1')
  }
})

for (const overrides of [
  { signOutError: { message: privateFailure } },
  { signOutThrows: true },
]) {
  test(`callback reports failed cleanup safely when sign-out ${overrides.signOutThrows ? 'throws' : 'returns an error'}`, async () => {
    const fixture = supabaseFixture({ user: null, ...overrides })
    const route = loadModule('app/api/auth/callback/route.ts', fixture.mocks)
    expectConsoleRedirect(await route.GET(authRequest('/api/auth/callback?code=valid-code')), 'oauth_failed')
  })
}

test('Google readiness request uses the public project key, no cache, and a timeout', async () => {
  let settingsRequest
  const fixture = supabaseFixture()
  const route = loadModule('app/api/auth/google/route.ts', fixture.mocks, {
    fetch: async (url, options) => {
      settingsRequest = { url: String(url), options }
      return Response.json({ external: { google: true } })
    },
  })
  await route.GET(authRequest('/api/auth/google'))
  assert.equal(settingsRequest.url, `${supabaseUrl}/auth/v1/settings`)
  assert.equal(settingsRequest.options.headers.apikey, 'sb_publishable_test_fixture')
  assert.equal(settingsRequest.options.cache, 'no-store')
  assert.ok(settingsRequest.options.signal instanceof AbortSignal)
})

test('missing OAuth environment configuration fails closed before provider traffic', async () => {
  const fixture = supabaseFixture()
  let fetched = false
  const route = loadModule('app/api/auth/google/route.ts', fixture.mocks, {
    process: { env: {} },
    fetch: async () => { fetched = true; return Response.json({ external: { google: true } }) },
  })
  expectConsoleRedirect(await route.GET(authRequest('/api/auth/google')), 'oauth_unavailable')
  assert.equal(fetched, false)
  assert.equal(fixture.calls.length, 0)
})

test('console login renders only the Google navigation form and an accessible action', () => {
  const { createElement } = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const { ConsoleLogin } = loadModule('components/console/ConsoleLogin.tsx')
  const html = renderToStaticMarkup(createElement(ConsoleLogin))
  assert.match(html, /<form[^>]+action="\/api\/auth\/google"[^>]+method="get"/)
  assert.match(html, /<button[^>]+type="submit"/)
  assert.match(html, /Continue with Google/)
  assert.doesNotMatch(html, /<input|type="password"|type="email"|role="alert"/)
})

for (const [errorCode, message] of [
  ['access_denied', 'This Google account does not have console access.'],
  ['oauth_unavailable', 'Google sign-in is unavailable. Please try again later.'],
  ['oauth_failed', 'Google sign-in could not be completed. Please try again.'],
  [privateFailure, 'Google sign-in could not be completed. Please try again.'],
]) {
  test(`console login gives fixed accessible feedback for ${errorCode}`, () => {
    const { createElement } = require('react')
    const { renderToStaticMarkup } = require('react-dom/server')
    const { ConsoleLogin } = loadModule('components/console/ConsoleLogin.tsx')
    const html = renderToStaticMarkup(createElement(ConsoleLogin, { errorCode }))
    assert.ok(html.includes(message))
    assert.match(html, /role="alert"/)
    assert.match(html, /aria-describedby="console-login-help console-login-error"/)
    assert.doesNotMatch(html, new RegExp(privateFailure))
  })
}

test('logout accepts only a same-origin POST and signs out this browser locally', async () => {
  const fixture = supabaseFixture()
  const route = loadModule('app/api/auth/logout/route.ts', fixture.mocks)
  assert.equal(route.GET, undefined, 'logout must not mutate sessions on a GET request')
  const request = new NextRequest('https://neoex.dev/api/auth/logout', {
    method: 'POST', headers: { origin: 'https://neoex.dev' },
  })
  expectConsoleRedirect(await route.POST(request))
  const signOutCall = fixture.calls.find((call) => Array.isArray(call) && call[0] === 'signOut')
  assert.equal(signOutCall[1].scope, 'local')
})

for (const origin of [undefined, 'https://attacker.example', 'https://neoex.dev.attacker.example', 'null']) {
  test(`logout rejects ${origin === undefined ? 'missing' : origin} origin before accessing a session`, async () => {
    const fixture = supabaseFixture()
    const route = loadModule('app/api/auth/logout/route.ts', fixture.mocks)
    const request = new NextRequest('https://neoex.dev/api/auth/logout', {
      method: 'POST', headers: origin === undefined ? {} : { origin },
    })
    const response = await route.POST(request)
    assert.equal(response.status, 403)
    assert.equal((await response.json()).error.code, 'AUTH')
    assert.equal(fixture.calls.length, 0)
  })
}

for (const [label, overrides] of [
  ['provider error', { signOutError: { message: privateFailure } }],
  ['provider exception', { signOutThrows: true }],
  ['client exception', { clientThrows: true }],
]) {
  test(`logout preserves a visible failure result on ${label}`, async () => {
    const fixture = supabaseFixture(overrides)
    const route = loadModule('app/api/auth/logout/route.ts', fixture.mocks)
    const request = new NextRequest('https://neoex.dev/api/auth/logout', {
      method: 'POST', headers: { origin: 'https://neoex.dev' },
    })
    const response = await route.POST(request)
    assert.equal(response.status, 503)
    const result = await response.json()
    assert.equal(result.error.code, 'SIGNOUT_FAILED')
    assert.doesNotMatch(JSON.stringify(result), new RegExp(privateFailure))
  })
}

function logoutComponentFixture({ confirm = true, fetchResult = async () => new Response(null) } = {}) {
  const state = []
  const requests = []
  const navigations = []
  const confirmations = []
  let stateIndex = 0
  const { ConsoleLogout } = loadModule('components/console/ConsoleLogout.tsx', {
    react: { useState(initial) {
      const index = stateIndex++
      if (!(index in state)) state[index] = initial
      return [state[index], (next) => { state[index] = next }]
    } },
  }, {
    fetch: async (url, options) => { requests.push({ url, options }); return fetchResult() },
    window: {
      confirm(message) { confirmations.push(message); return confirm },
      location: { assign(destination) { navigations.push(destination) } },
    },
  })
  return {
    requests,
    navigations,
    confirmations,
    render(props) { stateIndex = 0; return ConsoleLogout(props) },
  }
}

test('logout control posts with same-origin credentials and fully navigates after success', async () => {
  const fixture = logoutComponentFixture()
  const form = fixture.render({})
  let prevented = false
  await form.props.onSubmit({ preventDefault() { prevented = true } })
  assert.equal(prevented, true)
  assert.equal(fixture.requests.length, 1)
  assert.equal(fixture.requests[0].url, '/api/auth/logout')
  assert.equal(fixture.requests[0].options.method, 'POST')
  assert.equal(fixture.requests[0].options.credentials, 'same-origin')
  assert.deepEqual(fixture.navigations, ['/console'])
})

for (const [label, fetchResult] of [
  ['failed HTTP response', async () => new Response(privateFailure, { status: 503 })],
  ['network exception', async () => { throw new Error(privateFailure) }],
]) {
  test(`logout control offers an accessible retry after ${label}`, async () => {
    const fixture = logoutComponentFixture({ fetchResult })
    await fixture.render({}).props.onSubmit({ preventDefault() {} })
    const form = fixture.render({})
    const [button, alert] = form.props.children
    assert.equal(form.props['aria-busy'], false)
    assert.equal(button.props.disabled, false)
    assert.equal(button.props.children, 'Retry sign out')
    assert.equal(alert.props.role, 'alert')
    assert.equal(alert.props.children, 'Sign-out failed. Please try again.')
    assert.deepEqual(fixture.navigations, [])
  })
}

test('canceling an unsaved-changes confirmation leaves the session and editor in place', async () => {
  const fixture = logoutComponentFixture({ confirm: false })
  await fixture.render({ hasUnsavedChanges: true }).props.onSubmit({ preventDefault() {} })
  assert.equal(fixture.confirmations.length, 1)
  assert.equal(fixture.requests.length, 0)
  assert.equal(fixture.navigations.length, 0)
  assert.equal(fixture.render({ hasUnsavedChanges: true }).props['aria-busy'], false)
})

test('confirming unsaved changes signs out once and prevents duplicate pending submissions', async () => {
  let completeRequest
  const fixture = logoutComponentFixture({ fetchResult: () => new Promise((resolve) => { completeRequest = resolve }) })
  const pending = fixture.render({ hasUnsavedChanges: true }).props.onSubmit({ preventDefault() {} })
  assert.equal(fixture.render({ hasUnsavedChanges: true }).props['aria-busy'], true)
  await fixture.render({ hasUnsavedChanges: true }).props.onSubmit({ preventDefault() {} })
  assert.equal(fixture.confirmations.length, 1)
  assert.equal(fixture.requests.length, 1)
  completeRequest(new Response(null))
  await pending
  assert.deepEqual(fixture.navigations, ['/console'])
})
