/** Exercises real media/auth code with synthetic SDK and logging boundaries. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import test from 'node:test'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const root = path.resolve(import.meta.dirname, '..')
const variantKey = '2026-05-fixture/FRAME01/thumb-0123456789.webp'
const secret = 'SYNTHETIC_SECRET_TOKEN_PRIVATE_KEY'

function loadModule(relativePath, mocks, globals) {
  const filename = path.join(root, relativePath)
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  const loaded = { exports: {} }
  vm.runInNewContext(output, {
    module: loaded, exports: loaded.exports,
    require(specifier) {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier]
      if (specifier === 'server-only') return {}
      if (specifier.startsWith('@/')) return loadModule(`${specifier.slice(2)}.ts`, mocks, globals)
      if (specifier.startsWith('.')) {
        return loadModule(path.relative(root, path.resolve(path.dirname(filename), `${specifier}.ts`)), mocks, globals)
      }
      return require(specifier)
    },
    Headers, Request, Response, Blob, URL, Uint8Array,
    fetch: () => { throw new Error('Network forbidden in fixture') },
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://media-fixture.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_fixture' } },
    ...globals,
  }, { filename })
  return loaded.exports
}

function mediaFixture(options = {}) {
  const logs = []
  const user = options.owner ? {
    id: 'synthetic-owner', email: 'neospiritth@gmail.com',
    identities: [{ provider: 'google', identity_data: { email: 'neospiritth@gmail.com', email_verified: true } }],
  } : null
  const client = {
    auth: { async getUser() { return { data: { user }, error: null } } },
    async rpc() { return { data: options.owner ?? false, error: null } },
    from(table) {
      return {
        select() { return this }, eq() { return this },
        async maybeSingle() {
          if (options.throwAt === table) throw options.thrown ?? new Error(secret)
          if (table === 'entries') return {
            data: options.missingEntry ? null : { id: 'synthetic-entry', status: options.status ?? 'published' },
            error: options.entryError ?? null,
          }
          return {
            data: options.missingAssets ? null : { variants: options.mismatchedKey ? {} : { thumb: { webp: variantKey } } },
            error: options.assetError ?? null,
          }
        },
      }
    },
    storage: { from() { return { async download() {
      if (options.throwAt === 'storage') throw options.thrown ?? new Error(secret)
      const image = options.throwAt === 'response' ? { get size() { throw new Error(secret) } } : new Blob(['synthetic-image'])
      return { data: options.emptyDownload ? null : image, error: options.storageError ?? null }
    } } } },
  }
  const { readPhotoMedia } = loadModule('lib/server/photo-media.ts', {
    '@/lib/store/supabase/server': { async createSupabaseServerClient() { return client } },
    '@supabase/supabase-js': { createClient() {
      if (options.throwAt === 'client') throw options.thrown ?? new Error(secret)
      return client
    } },
  }, {
    console: { error(...args) { logs.push(args); if (options.loggerThrows) throw new Error(secret) } },
    ...(options.configMissing ? { process: { env: {} } } : {}),
  })
  return { logs, read: (segments = variantKey.split('/')) => readPhotoMedia(segments) }
}

async function assertGenericDenial(response) {
  assert.equal(response.status, 404)
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store, max-age=0')
  assert.equal(response.headers.get('CDN-Cache-Control'), 'no-store')
  assert.equal(response.headers.get('Vercel-CDN-Cache-Control'), 'no-store')
  assert.equal(response.headers.get('Vary'), 'Cookie')
  assert.deepEqual(await response.json(), { error: { code: 'NOT_FOUND', message: 'Image not found.' } })
}

test('entry service errors emit only one fixed enum event and preserve the generic denial', async () => {
  const fixture = mediaFixture({ entryError: { message: secret, name: secret, code: secret, toJSON() { throw new Error(secret) } } })
  await assertGenericDenial(await fixture.read())
  assert.equal(fixture.logs.length, 1)
  assert.equal(fixture.logs[0].length, 1)
  assert.equal(typeof fixture.logs[0][0], 'string')
  assert.deepEqual(JSON.parse(fixture.logs[0][0]), { event: 'photo_media_failure', stage: 'entry_lookup', category: 'upstream_error' })
})

for (const [option, stage] of [['assetError', 'asset_lookup'], ['storageError', 'storage_download']]) {
  test(`${stage} service errors emit a fixed event without revealing hostile error fields`, async () => {
    const error = { message: secret, name: secret, code: secret, cause: secret, toJSON() { throw new Error(secret) } }
    const fixture = mediaFixture({ [option]: error })
    await assertGenericDenial(await fixture.read())
    assert.deepEqual(fixture.logs, [[JSON.stringify({ event: 'photo_media_failure', stage, category: 'upstream_error' })]])
  })
}

for (const storageError of [
  { statusCode: '403', status: 400 }, { statusCode: '404', status: 400 },
  { statusCode: 403 }, { statusCode: 404 },
  { statusCode: 'NoSuchKey', status: 404 }, { statusCode: 'AccessDenied', status: 403 },
  { statusCode: 'not_found' }, { statusCode: 'unauthorized' },
  { status: 403 }, { status: 404 }, { status: 404, statusCode: '' },
]) {
  test(`known storage denial ${JSON.stringify(storageError)} stays silent and generic`, async () => {
    const fixture = mediaFixture({ storageError: { ...storageError, message: secret } })
    await assertGenericDenial(await fixture.read())
    assert.deepEqual(fixture.logs, [])
  })
}

for (const statusCode of ['NoSuchBucket', 'TenantNotFound', 'ServiceUnavailable']) {
  test(`operational Storage ${statusCode} remains observable even with HTTP404`, async () => {
    const fixture = mediaFixture({ storageError: { statusCode, status: 404, message: secret } })
    await assertGenericDenial(await fixture.read())
    assert.deepEqual(fixture.logs, [[JSON.stringify({ event: 'photo_media_failure', stage: 'storage_download', category: 'upstream_error' })]])
  })
}

for (const [throwAt, stage] of [
  ['client', 'client'], ['entries', 'entry_lookup'], ['photo_assets', 'asset_lookup'],
  ['storage', 'storage_download'], ['response', 'response'],
]) {
  test(`unexpected ${stage} exceptions emit only a fixed stage/category`, async () => {
    const thrown = { get name() { throw new Error(secret) }, get message() { throw new Error(secret) }, toString() { throw new Error(secret) }, toJSON() { throw new Error(secret) } }
    const fixture = mediaFixture({ throwAt, thrown })
    await assertGenericDenial(await fixture.read())
    assert.deepEqual(fixture.logs, [[JSON.stringify({ event: 'photo_media_failure', stage, category: 'unexpected_exception' })]])
  })
}

test('missing public configuration emits a fixed client failure without echoing configuration', async () => {
  const fixture = mediaFixture({ configMissing: true })
  await assertGenericDenial(await fixture.read())
  assert.deepEqual(fixture.logs, [[JSON.stringify({ event: 'photo_media_failure', stage: 'client', category: 'unexpected_exception' })]])
})

test('a download without bytes or an error is an observable empty download', async () => {
  const fixture = mediaFixture({ emptyDownload: true })
  await assertGenericDenial(await fixture.read())
  assert.deepEqual(fixture.logs, [[JSON.stringify({ event: 'photo_media_failure', stage: 'storage_download', category: 'empty_download' })]])
})

test('hostile Storage classification getters cannot leak or change the generic response', async () => {
  const fixture = mediaFixture({ storageError: { get statusCode() { throw new Error(secret) }, toJSON() { throw new Error(secret) } } })
  await assertGenericDenial(await fixture.read())
  assert.deepEqual(fixture.logs, [[JSON.stringify({ event: 'photo_media_failure', stage: 'storage_download', category: 'unexpected_exception' })]])
})

test('a logger that throws cannot change the response or recursively report its own failure', async () => {
  const fixture = mediaFixture({ entryError: { message: secret }, loggerThrows: true })
  await assertGenericDenial(await fixture.read())
  assert.equal(fixture.logs.length, 1)
  assert.doesNotMatch(fixture.logs[0][0], new RegExp(secret))
})

for (const options of [{ missingEntry: true }, { missingAssets: true }, { mismatchedKey: true }, { status: 'draft' }]) {
  test(`normal absence or authorization denial stays silent: ${JSON.stringify(options)}`, async () => {
    const fixture = mediaFixture(options)
    await assertGenericDenial(await fixture.read())
    assert.deepEqual(fixture.logs, [])
  })
}

test('malformed input remains a silent generic denial', async () => {
  const fixture = mediaFixture()
  await assertGenericDenial(await fixture.read(['..', secret]))
  assert.deepEqual(fixture.logs, [])
})

for (const options of [{}, { owner: true, status: 'draft' }]) {
  test(`successful image delivery is silent for ${options.owner ? 'verified owner' : 'guest'}`, async () => {
    const fixture = mediaFixture(options)
    const response = await fixture.read()
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'synthetic-image')
    assert.deepEqual(fixture.logs, [])
  })
}
