import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const image = Buffer.from('RIFF\u0004\u0000\u0000\u0000WEBP')
const imageHash = createHash('sha256').update(image).digest('hex')
const noStore = { 'Cache-Control': 'private, no-store, max-age=0', 'Vary': 'Cookie' }
const secret = 'SYNTHETIC_TOKEN_PRIVATE_KEY'
const reasons = new Set(['ok', 'unexpected_status', 'unexpected_content_type', 'invalid_body', 'body_too_large', 'timeout', 'network_error', 'redirect', 'cache_policy'])

function assertSanitized(report) {
  assert.deepEqual(Object.keys(report).sort(), ['checks', 'ok'])
  for (const check of report.checks) {
    assert.deepEqual(Object.keys(check).sort(), ['duration_ms', 'name', 'ok', 'reason', 'status'])
    assert.equal(check.status === null || Number.isInteger(check.status), true)
    assert.equal(Number.isInteger(check.duration_ms), true)
    assert.ok(check.duration_ms >= 0 && check.duration_ms <= 10000)
    assert.equal(reasons.has(check.reason), true)
  }
  assert.doesNotMatch(JSON.stringify(report), /https?:|paper-canvas|Object not found|SYNTHETIC_TOKEN_PRIVATE_KEY/)
}

function passingResponses() {
  return [
    new Response('<!doctype html><html><head><title>Worldline · fixture</title></head><body><main class="paper-canvas">Fixture</main></body></html>', { headers: { 'Content-Type': 'text/html' } }),
    new Response(image, { headers: { ...noStore, 'Content-Type': 'image/webp' } }),
    Response.json({ statusCode: '404', error: 'not_found', message: 'Object not found' }, { status: 400 }),
    Response.json({ error: { code: 'NOT_FOUND', message: 'Image not found.' } }, { status: 404, headers: noStore }),
    Response.json({ ok: false, error: { code: 'AUTH', message: 'Authentication required' } }, { status: 401, headers: noStore }),
  ]
}

const observedPrivateBucketDenial = {
  statusCode: '404', code: 'NoSuchBucket', error: 'Bucket not found', message: 'Bucket not found',
}

test('the exact observed private-bucket denial passes only with the other four controls healthy', async () => {
  const { runMonitor } = await import('../scripts/production-monitor.mjs')
  const responses = passingResponses()
  responses[2] = Response.json(observedPrivateBucketDenial, { status: 400 })
  let requests = 0
  const report = await runMonitor({ expectedThumbSha256: imageHash, fetchImpl: async () => responses[requests++] })
  assert.equal(requests, 5)
  assert.equal(report.ok, true)
  assert.equal(report.checks.length, 5)
  assert.equal(report.checks.every(({ ok }) => ok), true)
  assertSanitized(report)
})

test('five credential-free checks pass without returning fetched contents or targets', async () => {
  const { runMonitor } = await import('../scripts/production-monitor.mjs')
  const responses = passingResponses()
  const requests = []
  const report = await runMonitor({ expectedThumbSha256: imageHash, fetchImpl: async (url, options) => {
    requests.push({ url, options })
    return responses.shift()
  } })
  assert.equal(report.ok, true)
  assert.deepEqual(report.checks.map(({ name, ok }) => ({ name, ok })), ['public_page', 'published_photo', 'legacy_storage_denied', 'synthetic_photo_denied', 'guest_auth_denied'].map((name) => ({ name, ok: true })))
  assert.equal(requests.length, 5)
  for (const { options } of requests) {
    assert.equal(options.method, 'GET')
    assert.equal(options.redirect, 'manual')
    assert.equal(options.credentials, 'omit')
    assert.equal(new Headers(options.headers).has('Authorization'), false)
    assert.equal(new Headers(options.headers).has('Cookie'), false)
  }
  const checkedKey = new URL(requests[1].url).pathname.replace('/api/media/photos/', '')
  const historical = new URL(requests[2].url)
  assert.equal(historical.pathname, `/storage/v1/object/public/photos/${checkedKey}`)
  assert.equal(historical.hostname, 'aitqswnbtpexrxqpoiwo.supabase.co')
  assert.match(new URL(requests[3].url).pathname, /^\/api\/media\/photos\/2099-01-monitor-synthetic\/absent\/thumb-0{10}\.webp$/)
  assertSanitized(report)
})

async function runWithReplacement(index, replacement, options = {}) {
  const { runMonitor } = await import('../scripts/production-monitor.mjs')
  const responses = passingResponses()
  let calls = 0
  const report = await runMonitor({ expectedThumbSha256: imageHash, ...options, fetchImpl: async (...args) => {
    const current = calls++
    return current === index ? replacement(...args) : responses[current]
  } })
  assert.equal(calls, 5, 'failure does not add retries or silently skip other checks')
  assert.equal(report.ok, false)
  assert.equal(report.checks[index].ok, false)
  assert.equal(report.checks.filter((check) => check.ok).length, 4)
  assertSanitized(report)
  return report.checks[index]
}

for (const [label, change] of [
  ['different status code', { statusCode: '500' }],
  ['different service code', { code: 'TenantNotFound' }],
  ['missing service code', { code: undefined }],
  ['different error', { error: 'Service unavailable' }],
  ['missing error', { error: undefined }],
  ['different message', { message: secret }],
  ['missing message', { message: undefined }],
  ['non-string service code', { code: { value: 'NoSuchBucket' } }],
]) {
  test(`private-bucket denial near miss fails: ${label}`, async () => {
    const result = await runWithReplacement(2, () => Response.json({ ...observedPrivateBucketDenial, ...change }, { status: 400 }))
    assert.equal(result.reason, 'invalid_body')
  })
}

test('the observed bucket denial never makes a missing published-image control healthy', async () => {
  const { runMonitor } = await import('../scripts/production-monitor.mjs')
  const responses = passingResponses()
  responses[1] = Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404, headers: noStore })
  responses[2] = Response.json(observedPrivateBucketDenial, { status: 400 })
  let requests = 0
  const report = await runMonitor({ expectedThumbSha256: imageHash, fetchImpl: async () => responses[requests++] })
  assert.equal(requests, 5)
  assert.equal(report.ok, false)
  assert.equal(report.checks[1].ok, false)
  assert.equal(report.checks[1].reason, 'unexpected_status')
  assert.equal(report.checks[2].ok, true)
  assertSanitized(report)
})

test('a bucket accidentally serving image bytes at the old public URL fails privacy monitoring', async () => {
  const result = await runWithReplacement(2, () => new Response(image, { headers: { 'Content-Type': 'image/webp' } }))
  assert.equal(result.reason, 'unexpected_status')
})

test('deadline covers a body that never settles, including a cancellation that never settles', { timeout: 2000 }, async () => {
  const result = await runWithReplacement(0, () => new Response(new ReadableStream({
    pull() { return new Promise(() => {}) }, cancel() { return new Promise(() => {}) },
  }), { headers: { 'Content-Type': 'text/html' } }), { timeoutMs: 20 })
  assert.equal(result.reason, 'timeout')
})

test('deadline also bounds a transport that ignores AbortSignal and never returns headers', { timeout: 2000 }, async () => {
  const result = await runWithReplacement(1, () => new Promise(() => {}), { timeoutMs: 20 })
  assert.equal(result.reason, 'timeout')
  assert.equal(result.status, null)
})

for (const index of [0, 1, 2, 3, 4]) {
  test(`check ${index + 1} rejects redirects without following their token-bearing location`, async () => {
    const result = await runWithReplacement(index, () => new Response(null, { status: 302, headers: { Location: `https://fixture.invalid/${secret}` } }))
    assert.equal(result.reason, 'redirect')
  })
  test(`check ${index + 1} reports HTTP500 as failure, never a healthy privacy denial`, async () => {
    const result = await runWithReplacement(index, () => Response.json({ message: secret }, { status: 500 }))
    assert.equal(result.reason, 'unexpected_status')
  })
}

test('unexpectedly successful synthetic media and auth responses are failures', async () => {
  for (const index of [3, 4]) {
    const result = await runWithReplacement(index, () => Response.json({ error: { code: secret } }))
    assert.equal(result.reason, 'unexpected_status')
  }
})

for (const [label, index, response, reason] of [
  ['wrong photo MIME', 1, () => new Response(image, { headers: { ...noStore, 'Content-Type': 'text/html' } }), 'unexpected_content_type'],
  ['wrong photo magic', 1, () => new Response('not a photo', { headers: { ...noStore, 'Content-Type': 'image/webp' } }), 'invalid_body'],
  ['wrong photo hash', 1, () => new Response(Buffer.from('RIFF\u0005\u0000\u0000\u0000WEBPx'), { headers: { ...noStore, 'Content-Type': 'image/webp' } }), 'invalid_body'],
  ['login-only HTML', 0, () => new Response('<html><title>Worldline</title><form>Login</form></html>', { headers: { 'Content-Type': 'text/html' } }), 'invalid_body'],
  ['incomplete HTML', 0, () => new Response('<html><title>Worldline</title><main class="paper-canvas">', { headers: { 'Content-Type': 'text/html' } }), 'invalid_body'],
  ['empty HTML', 0, () => new Response('', { headers: { 'Content-Type': 'text/html' } }), 'invalid_body'],
  ['empty image', 1, () => new Response('', { headers: { ...noStore, 'Content-Type': 'image/webp' } }), 'invalid_body'],
  ['empty denial', 2, () => new Response('', { status: 400, headers: { 'Content-Type': 'application/json' } }), 'invalid_body'],
  ['HTML masked as denial', 2, () => new Response(`<html>${secret}</html>`, { status: 400, headers: { 'Content-Type': 'text/html' } }), 'unexpected_content_type'],
  ['unknown Storage error', 2, () => Response.json({ statusCode: '404', error: 'NoSuchBucket', message: secret }, { status: 400 }), 'invalid_body'],
  ['malformed denial JSON', 2, () => new Response(`{"message":"${secret}`, { status: 404, headers: { 'Content-Type': 'application/json' } }), 'invalid_body'],
  ['wrong synthetic denial code', 3, () => Response.json({ error: { code: secret } }, { status: 404, headers: noStore }), 'invalid_body'],
  ['auth success in denial envelope', 4, () => Response.json({ ok: true, error: { code: 'AUTH' } }, { status: 401 }), 'invalid_body'],
]) {
  test(`${label} is a sanitized monitor failure`, async () => {
    assert.equal((await runWithReplacement(index, response)).reason, reason)
  })
}

for (const index of [1, 3]) {
  for (const headers of [{ 'Cache-Control': 'public, max-age=60' }, { 'Cache-Control': 'private, no-store' }]) {
    test(`checked media ${index} rejects cache headers ${JSON.stringify(headers)}`, async () => {
      const response = index === 1
        ? () => new Response(image, { headers: { ...headers, 'Content-Type': 'image/webp' } })
        : () => Response.json({ error: { code: 'NOT_FOUND' } }, { status: 404, headers })
      assert.equal((await runWithReplacement(index, response)).reason, 'cache_policy')
    })
  }
}

for (const [index, cap, mime, status] of [[0, 1048576, 'text/html', 200], [1, 65536, 'image/webp', 200], [2, 4096, 'application/json', 400]]) {
  test(`check ${index} enforces its byte cap from Content-Length before reading`, async () => {
    const result = await runWithReplacement(index, () => new Response(null, { status, headers: { ...noStore, 'Content-Type': mime, 'Content-Length': String(cap + 1) } }))
    assert.equal(result.reason, 'body_too_large')
  })
  test(`check ${index} enforces its byte cap while streaming without trusting Content-Length`, async () => {
    let cancelled = false
    const stream = new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(cap)); controller.enqueue(new Uint8Array(1)) },
      cancel() { cancelled = true },
    })
    const result = await runWithReplacement(index, () => new Response(stream, { status, headers: { ...noStore, 'Content-Type': mime, 'Content-Length': '1' } }))
    assert.equal(result.reason, 'body_too_large')
    assert.equal(cancelled, true)
  })
}

test('an unencoded body shorter than advertised fails as truncated', async () => {
  const result = await runWithReplacement(1, () => new Response(image, { headers: { ...noStore, 'Content-Type': 'image/webp', 'Content-Length': String(image.length + 1) } }))
  assert.equal(result.reason, 'invalid_body')
})

test('a body read error is sanitized even when exception properties and serialization are hostile', async () => {
  const failure = { get message() { throw new Error(secret) }, name: secret, stack: secret, cause: secret, toJSON() { throw new Error(secret) } }
  const result = await runWithReplacement(0, () => new Response(new ReadableStream({ pull(controller) { controller.error(failure) } }), { headers: { 'Content-Type': 'text/html' } }))
  assert.equal(result.reason, 'network_error')
})

test('token-bearing thrown transport errors are never serialized', async () => {
  const result = await runWithReplacement(0, () => { throw Object.assign(new Error(secret), { name: secret, cause: secret, toJSON() { throw new Error(secret) } }) })
  assert.equal(result.reason, 'network_error')
})

test('unsafe timeout or hash overrides fail before any request and without echoing inputs', async () => {
  const { runMonitor } = await import('../scripts/production-monitor.mjs')
  for (const options of [{ timeoutMs: 0 }, { timeoutMs: 10001 }, { timeoutMs: Infinity }, { timeoutMs: 1.1 }, { expectedThumbSha256: secret }]) {
    await assert.rejects(runMonitor({ ...options, fetchImpl: () => assert.fail('Must not request') }), (error) => error.message === 'Invalid monitor options')
  }
})

test('importing the runner performs no request or console output', () => {
  const moduleUrl = new URL('../scripts/production-monitor.mjs', import.meta.url).href
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', `globalThis.fetch=()=>{process.exit(71)};await import(${JSON.stringify(moduleUrl)})`], { encoding: 'utf8', env: {}, timeout: 2000 })
  assert.equal(child.status, 0)
  assert.equal(child.stdout, '')
  assert.equal(child.stderr, '')
})

test('the real CLI exits nonzero and prints only sanitized JSON when mocked transport fails', () => {
  const preload = `globalThis.fetch=async()=>{throw Object.assign(new Error('${secret}'),{name:'${secret}',stack:'${secret}',toJSON(){throw new Error('${secret}')}})}`
  const child = spawnSync(process.execPath, ['--import', `data:text/javascript,${encodeURIComponent(preload)}`, fileURLToPath(new URL('../scripts/production-monitor.mjs', import.meta.url))], { encoding: 'utf8', env: {}, timeout: 2000 })
  assert.equal(child.status, 1)
  assert.equal(child.stderr, '')
  const report = JSON.parse(child.stdout)
  assert.equal(report.ok, false)
  assert.equal(report.checks.length, 5)
  assert.equal(report.checks.every(({ reason }) => reason === 'network_error'), true)
  assertSanitized(report)
})
