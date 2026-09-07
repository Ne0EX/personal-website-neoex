/**
 * Credential-free, bounded production sentinel. See docs/harness/FREE-OBSERVABILITY.md.
 * Targets are public constants; the synthetic key does not identify a real draft.
 * Importing this module never makes requests. Only fetch and test limits are injected.
 */
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ORIGIN = 'https://neoex.dev'
const PUBLIC_THUMB = '2026-05-snapshots/DSCF0835-1781514759179/thumb-4fb05d4c00.webp'
const THUMB_SHA256 = 'de84121272b728cf00f3e00dba62524c46584daaae331c67d57a4dc34f499b5f'
const MAX_TIMEOUT_MS = 10_000
const CHECKS = [
  { name: 'public_page', url: `${ORIGIN}/en`, status: [200], mime: 'text/html', cap: 1_048_576 },
  { name: 'published_photo', url: `${ORIGIN}/api/media/photos/${PUBLIC_THUMB}`, status: [200], mime: 'image/webp', cap: 65_536 },
  { name: 'legacy_storage_denied', url: `https://aitqswnbtpexrxqpoiwo.supabase.co/storage/v1/object/public/photos/${PUBLIC_THUMB}`, status: [400, 404], mime: 'application/json', cap: 4096 },
  { name: 'synthetic_photo_denied', url: `${ORIGIN}/api/media/photos/2099-01-monitor-synthetic/absent/thumb-0000000000.webp`, status: [404], mime: 'application/json', cap: 4096 },
  { name: 'guest_auth_denied', url: `${ORIGIN}/api/console/auth-probe`, status: [401], mime: 'application/json', cap: 4096 },
]

// Cancellation itself may never settle in a broken transport: never await it.
function cancelBody(body) {
  try { Promise.resolve(body?.cancel()).catch(() => {}) } catch { /* no raw errors */ }
}

function cacheIsPrivate(headers) {
  const directives = (headers.get('cache-control') ?? '').toLowerCase().split(',').map((s) => s.trim())
  const vary = (headers.get('vary') ?? '').toLowerCase().split(',').map((s) => s.trim())
  return directives.includes('private') && directives.includes('no-store') && vary.includes('cookie')
}

function validateBody(check, bytes, expectedThumbSha256) {
  if (bytes.length === 0) return 'invalid_body'
  if (check.name === 'published_photo') {
    const isWebP = bytes.length >= 12 && bytes.subarray(0, 4).toString() === 'RIFF'
      && bytes.subarray(8, 12).toString() === 'WEBP' && bytes.readUInt32LE(4) + 8 === bytes.length
    return isWebP && createHash('sha256').update(bytes).digest('hex') === expectedThumbSha256
      ? 'ok' : 'invalid_body'
  }
  const text = bytes.toString('utf8')
  if (check.name === 'public_page') {
    // Grounded in lib/site.ts and app/[lang]/page.tsx. A login page's title alone is insufficient.
    return /<title\b[^>]*>[^<]*Worldline\b[^<]*<\/title>/i.test(text)
      && /<main\b[^>]*\bclass=["'][^"']*\bpaper-canvas\b/i.test(text)
      && /<\/html\s*>/i.test(text) ? 'ok' : 'invalid_body'
  }
  try {
    const data = JSON.parse(text)
    if (check.name === 'legacy_storage_denied') {
      const knownDenial = data?.error === 'not_found' || (
        data?.code === 'NoSuchBucket' && data?.error === 'Bucket not found'
        && data?.message === 'Bucket not found'
      )
      return (data?.statusCode === '404' || data?.statusCode === 404) && knownDenial
        ? 'ok' : 'invalid_body'
    }
    if (check.name === 'synthetic_photo_denied') return data?.error?.code === 'NOT_FOUND' ? 'ok' : 'invalid_body'
    return data?.ok === false && data?.error?.code === 'AUTH' ? 'ok' : 'invalid_body'
  } catch { return 'invalid_body' }
}

async function runCheck(check, fetchImpl, timeoutMs, expectedThumbSha256) {
  const started = performance.now()
  const controller = new AbortController()
  let status = null
  let reader
  let response
  let timedOut = false
  let timer
  const deadline = new Promise((resolveDeadline) => {
    timer = setTimeout(() => {
      timedOut = true
      controller.abort()
      cancelBody(reader ?? response?.body)
      resolveDeadline('timeout')
    }, timeoutMs)
  })
  const inspect = async () => {
    response = await fetchImpl(check.url, {
      method: 'GET', redirect: 'manual', credentials: 'omit',
      headers: { Accept: check.mime, 'User-Agent': 'Worldline-Production-Monitor/1.0' },
      signal: controller.signal,
    })
    if (timedOut) { cancelBody(response.body); return 'timeout' }
    status = response.status
    if (status >= 300 && status < 400) return 'redirect'
    if (!check.status.includes(status)) return 'unexpected_status'
    if ((response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase() !== check.mime) {
      return 'unexpected_content_type'
    }
    if (['published_photo', 'synthetic_photo_denied'].includes(check.name) && !cacheIsPrivate(response.headers)) {
      return 'cache_policy'
    }
    const rawLength = response.headers.get('content-length')
    const length = rawLength !== null && /^\d+$/.test(rawLength) ? Number(rawLength) : null
    if (length !== null && length > check.cap) return 'body_too_large'
    if (!response.body) return 'invalid_body'
    reader = response.body.getReader()
    const chunks = []
    let size = 0
    while (!timedOut) {
      const { done, value } = await reader.read()
      if (timedOut) return 'timeout'
      if (done) break
      size += value.byteLength
      if (size > check.cap) return 'body_too_large'
      chunks.push(value)
    }
    // fetch decompresses bodies; only compare wire length for unencoded responses.
    const encoding = response.headers.get('content-encoding')
    if ((!encoding || encoding === 'identity') && length !== null && size !== length) return 'invalid_body'
    return validateBody(check, Buffer.concat(chunks), expectedThumbSha256)
  }
  let reason
  try { reason = await Promise.race([inspect(), deadline]) }
  catch { reason = timedOut ? 'timeout' : 'network_error' }
  finally {
    clearTimeout(timer)
    controller.abort()
    cancelBody(reader ?? response?.body)
  }
  return {
    name: check.name, ok: reason === 'ok', status, reason,
    duration_ms: Math.min(MAX_TIMEOUT_MS, Math.max(0, Math.round(performance.now() - started))),
  }
}

/** Test seams cannot change targets, request count, production caps or CLI defaults. */
export async function runMonitor({ fetchImpl = globalThis.fetch, timeoutMs = MAX_TIMEOUT_MS, expectedThumbSha256 = THUMB_SHA256 } = {}) {
  if (typeof fetchImpl !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS
    || typeof expectedThumbSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(expectedThumbSha256)) {
    throw new TypeError('Invalid monitor options')
  }
  const checks = []
  for (const check of CHECKS) checks.push(await runCheck(check, fetchImpl, timeoutMs, expectedThumbSha256))
  return { ok: checks.every((check) => check.ok), checks }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    if (process.argv.length !== 2) throw new TypeError('No CLI options supported')
    const report = await runMonitor()
    console.log(JSON.stringify(report))
    process.exitCode = report.ok ? 0 : 1
  } catch {
    console.log(JSON.stringify({ ok: false, checks: [], reason: 'monitor_error' }))
    process.exitCode = 1
  }
}
