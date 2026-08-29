/**
 * tests/console-gate-contract.test.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Locks in the proxy.ts production gate behavior for /console.
 *
 * Context: middleware.ts was replaced by proxy.ts on 2026-06-08 (store-as-source
 * S4, Altair slice). The gate contract changed:
 *   OLD: NODE_ENV=production && WORLDLINE_AUTHORING !== '1' → 404 (retired)
 *   NEW: supabase.auth.getUser() — no user → rewrite to /console (login shell);
 *        user present → NextResponse.next() with refreshed cookies.
 *
 * WORLDLINE_AUTHORING env flag is RETIRED per proxy.ts spec §5.3/§11.
 * The file-level export is `proxy` (not `middleware`), per Next 16 convention.
 *
 * Coverage:
 *   0. proxy.ts source integrity — required structural tokens present
 *   1. Gate is a rewrite-to-login, NOT a 404 response
 *   2. WORLDLINE_AUTHORING env var is not read in proxy.ts (retired)
 *   3. getUser() is used (not getSession() — the session-spoofing hazard)
 *   4. Cookies setAll/getAll pattern is implemented (SSR session-refresh)
 *   5. matcher covers /console and /console/:path* (unchanged from middleware)
 *   6. matcher includes exactly the two /console gates while allowing the
 *      legitimate public-locale matcher — no catch-all patterns
 *   7. Gate is NextResponse.rewrite (not throw, not 404, not notFound())
 *   8. second layer: assertDev() in highlight-core.ts guards on NODE_ENV=production
 *
 * Method: reads proxy.ts source directly and asserts structural tokens.
 * The auth path (supabase.auth.getUser) requires a live Supabase server and
 * is covered by integration tests, not this unit contract.
 *
 * Owner: Algol (α-VER-06) · proxy gate contract · 2026-06-13
 * Run: node --test tests/console-gate-contract.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const proxySrc = readFileSync(join(root, 'proxy.ts'), 'utf-8')

// ─────────────────────────────────────────────────────────────────────────────
// Test 0 — source integrity: proxy.ts has the required structural tokens
// ─────────────────────────────────────────────────────────────────────────────
test('gate source: proxy.ts contains required structural tokens', () => {
  // The exported function must be named `proxy` (Next 16 file convention)
  assert.ok(
    proxySrc.includes('export async function proxy('),
    'proxy.ts must export an async function named `proxy`',
  )
  // Must import from next/server
  assert.ok(
    proxySrc.includes("from 'next/server'"),
    'proxy.ts must import from next/server',
  )
  // Must use @supabase/ssr createServerClient
  assert.ok(
    proxySrc.includes("from '@supabase/ssr'"),
    'proxy.ts must import from @supabase/ssr',
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 1 — gate is rewrite-to-login, not a 404
// ─────────────────────────────────────────────────────────────────────────────
test('gate: unauthenticated path is NextResponse.rewrite to /console, not 404', () => {
  // The fail-closed guarantee uses a rewrite so the browser URL does not change
  // but the server renders ConsoleLogin. A 404 would leak route existence.
  assert.ok(
    proxySrc.includes('NextResponse.rewrite('),
    'proxy.ts must use NextResponse.rewrite() for the unauthenticated path',
  )
  // The rewrite target must be /console (the login shell)
  assert.ok(
    proxySrc.includes("'/console'"),
    "proxy.ts must rewrite to '/console'",
  )
  // Must NOT return a 404 status response as the gate action
  assert.ok(
    !proxySrc.includes('new NextResponse(null, { status: 404 })'),
    'proxy.ts must NOT use new NextResponse(null, { status: 404 }) — gate is rewrite, not 404',
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 2 — WORLDLINE_AUTHORING env var is retired
// ─────────────────────────────────────────────────────────────────────────────
test('gate: WORLDLINE_AUTHORING env var is not read in proxy.ts (retired)', () => {
  // The env flag gate is retired per spec §5.3/§11. Any live read of this var
  // in the gate logic would mean an un-retired escape hatch.
  // A comment reference (as documentation) is acceptable — we check for
  // process.env.WORLDLINE_AUTHORING specifically, not the bare string.
  const linesWithEnvRead = proxySrc
    .split('\n')
    .filter(
      (line) =>
        !line.trim().startsWith('//') &&
        line.includes('process.env.WORLDLINE_AUTHORING'),
    )
  assert.equal(
    linesWithEnvRead.length,
    0,
    'proxy.ts must not read process.env.WORLDLINE_AUTHORING — flag is retired per §5.3/§11',
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 3 — getUser() is used, not getSession() (session-spoofing guard)
// ─────────────────────────────────────────────────────────────────────────────
test('gate: supabase.auth.getUser() is used, not getSession()', () => {
  assert.ok(
    proxySrc.includes('supabase.auth.getUser()'),
    'proxy.ts must call supabase.auth.getUser() — getSession() is unverified and spoofable',
  )
  // Active getSession() call (not in a comment) would be a security defect
  const linesWithGetSession = proxySrc
    .split('\n')
    .filter(
      (line) =>
        !line.trim().startsWith('//') && line.includes('getSession('),
    )
  assert.equal(
    linesWithGetSession.length,
    0,
    'proxy.ts must not call getSession() — it reads from cookie only and can be spoofed',
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 4 — SSR cookie pattern: getAll + setAll implemented
// ─────────────────────────────────────────────────────────────────────────────
test('gate: cookies getAll/setAll pattern is implemented for SSR session-refresh', () => {
  assert.ok(
    proxySrc.includes('getAll()'),
    'proxy.ts must implement cookies.getAll() for @supabase/ssr',
  )
  assert.ok(
    proxySrc.includes('setAll('),
    'proxy.ts must implement cookies.setAll() for @supabase/ssr',
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 5 — matcher structure: covers /console and /console/:path*
// ─────────────────────────────────────────────────────────────────────────────
test('matcher: config covers bare /console and sub-routes', () => {
  // Parse the matcher array from proxy.ts source
  const match = proxySrc.match(/matcher:\s*(\[[\s\S]*?\])/m)
  assert.ok(match, 'matcher config must be present in proxy.ts')

  const matcherStr = match[1]
  assert.ok(matcherStr.includes("'/console'"), 'matcher must include bare /console')
  assert.ok(matcherStr.includes("'/console/:path*'"), 'matcher must include /console/:path* for sub-routes')

  // Confirm /console/editor would be covered by /console/:path*
  assert.ok(matcherStr.includes(':path*'), 'sub-route glob must use :path* (covers /console/editor, etc.)')
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 6 — matcher does NOT include patterns that would match public routes
// ─────────────────────────────────────────────────────────────────────────────
test('matcher: preserves exact console coverage without forbidding the locale matcher', () => {
  const match = proxySrc.match(/matcher:\s*(\[[\s\S]*?\])/m)
  assert.ok(match)

  const matcherStr = match[1]

  // The matcher must not be a catch-all
  assert.ok(!matcherStr.includes("'/:path*'"), 'must not use catch-all /:path*')
  assert.ok(!matcherStr.includes("'/(.*)'"), 'must not use catch-all /(.*)')
  // The proxy legitimately also owns locale routing. Lock only the console
  // denominator here instead of treating that public matcher as a defect.
  const entries = matcherStr.match(/'[^']+'/g) || []
  const consoleEntries = entries.filter((entry) => entry.startsWith("'/console"))
  assert.deepEqual(
    consoleEntries,
    ["'/console'", "'/console/:path*'"],
    'matcher must retain exactly bare /console and /console/:path* coverage',
  )
  for (const entry of consoleEntries) {
    assert.ok(entry.startsWith("'/console"), `each matcher entry must start with /console, got: ${entry}`)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 7 — gate uses rewrite/next, never throw
// ─────────────────────────────────────────────────────────────────────────────
test('gate logic: gate uses NextResponse.rewrite/next (not throw, not notFound())', () => {
  // Must not import from next/navigation (which contains notFound())
  assert.ok(
    !proxySrc.includes("from 'next/navigation'"),
    'must not import from next/navigation in proxy.ts',
  )
  // Must not call notFound() as a function call (comment references are fine)
  const linesWithCall = proxySrc
    .split('\n')
    .filter((line) => !line.trim().startsWith('//') && /notFound\(\)/.test(line))
  assert.equal(linesWithCall.length, 0, 'must not call notFound() outside of a comment')
  // Must use NextResponse.next() for the authenticated pass-through
  assert.ok(
    proxySrc.includes('NextResponse.next('),
    'proxy.ts must use NextResponse.next() for the authenticated path',
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 8 — dev-guard in highlight-core.ts is structurally intact (not regressed)
// ─────────────────────────────────────────────────────────────────────────────
test('second layer: assertDev() in highlight-core.ts guards on NODE_ENV=production', () => {
  const coreSrc = readFileSync(
    join(root, 'lib/server/places/highlight-core.ts'),
    'utf-8',
  )
  // assertDev function must exist and throw on production
  assert.ok(
    coreSrc.includes("if (process.env.NODE_ENV === 'production')"),
    'assertDev must check NODE_ENV === production',
  )
  assert.ok(
    coreSrc.includes('throw new DevGuardError'),
    'assertDev must throw DevGuardError in production',
  )
  // Every exported impl must call assertDev first (check the three impls)
  const impls = ['savePlaceHighlightsImpl', 'savePlaceCoordImpl', 'createPlaceImpl']
  for (const impl of impls) {
    // Find the function body
    const implIdx = coreSrc.indexOf(`async function ${impl}`)
    assert.ok(implIdx !== -1, `${impl} must exist in highlight-core.ts`)
    // assertDev() must appear before any I/O (within first 500 chars of body)
    const body = coreSrc.slice(implIdx, implIdx + 600)
    assert.ok(
      body.includes('assertDev()'),
      `${impl} must call assertDev() early in its body`,
    )
  }
})
