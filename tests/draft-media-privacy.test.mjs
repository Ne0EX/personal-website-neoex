/** Executes production media interfaces with synthetic storage/auth boundaries. */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import test from 'node:test'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const root = path.resolve(import.meta.dirname, '..')
const projectUrl = 'https://media-fixture.supabase.co'
const variantKey = '2026-05-fixture/FRAME01/thumb-0123456789.webp'
const mediaPath = `/api/media/photos/${variantKey}`
const imageBytes = new Uint8Array([82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80])
const privateFailure = 'synthetic-private-storage-failure'

function privacyMigration() {
  const directory = path.join(root, 'supabase/migrations')
  const candidates = readdirSync(directory).filter((name) => /^\d+_draft_media_privacy\.sql$/.test(name))
  assert.equal(candidates.length, 1, 'exactly one draft media privacy migration must exist')
  return readFileSync(path.join(directory, candidates[0]), 'utf8').replace(/--[^\n]*/g, '')
}

function verifiedOwner(overrides = {}) {
  return {
    id: 'synthetic-owner-id',
    email: 'neospiritth@gmail.com',
    identities: [{ provider: 'google', identity_data: {
      email: 'neospiritth@gmail.com', email_verified: true,
    } }],
    ...overrides,
  }
}

function assertUncacheable(response) {
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store, max-age=0')
  assert.equal(response.headers.get('CDN-Cache-Control'), 'no-store')
  assert.equal(response.headers.get('Vercel-CDN-Cache-Control'), 'no-store')
  assert.equal(response.headers.get('Vary'), 'Cookie')
  assert.equal(response.headers.get('Location'), null)
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff')
}

function mediaFixture(options = {}) {
  const state = { status: 'draft', ...options }
  const reads = []
  const downloads = []
  const downloadFetchOptions = []
  const anonymousOptions = []
  const variants = { thumb: { webp: variantKey } }

  function clientFor(audience) {
    return {
      auth: {
        async getUser() {
          return { data: { user: state.user ?? null }, error: state.authError ?? null }
        },
      },
      async rpc() { return { data: state.member ?? false, error: state.rpcError ?? null } },
      from(table) {
        const filters = new Map()
        return {
          select() { return this },
          eq(column, value) { filters.set(column, value); return this },
          async maybeSingle() {
            reads.push({ audience, table, filters })
            if (state.databaseThrows) throw new Error(privateFailure)
            if (state.databaseError) return { data: null, error: { message: privateFailure } }
            if (state.missingEntry && table === 'entries') return { data: null, error: null }
            if (state.missingAssets && table === 'photo_assets') return { data: null, error: null }
            const row = table === 'entries'
              ? { id: 'synthetic-photo-id', kind: 'photo', roll: '2026-05-fixture', photo_id: 'FRAME01', status: state.status }
              : { entry_id: 'synthetic-photo-id', variants: Object.hasOwn(state, 'variants') ? state.variants : variants }
            const matches = [...filters].every(([column, value]) =>
              (column === 'status' && state.ignoreStatusFilter) || row[column] === value)
            return { data: matches ? row : null, error: null }
          },
        }
      },
      storage: {
        from(bucket) {
          return {
            async download(key, _transforms, fetchOptions) {
              downloads.push({ audience, bucket, key })
              downloadFetchOptions.push(fetchOptions)
              if (state.storageThrows) throw new Error(privateFailure)
              if (state.storageError) return { data: null, error: { message: privateFailure } }
              return { data: new Blob([imageBytes], { type: 'image/webp' }), error: null }
            },
          }
        },
      },
    }
  }

  const mocks = {
    '@/lib/store/supabase/server': { async createSupabaseServerClient() { return clientFor('cookie') } },
    '@supabase/supabase-js': {
      createClient(url, key, options) {
        anonymousOptions.push({ url, key, options })
        return clientFor('anonymous')
      },
    },
  }
  return { state, reads, downloads, downloadFetchOptions, anonymousOptions, mocks }
}

function loadModule(relativePath, mocks = {}, globals = {}) {
  const filename = path.join(root, relativePath)
  const source = readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  const loaded = { exports: {} }
  vm.runInNewContext(output, {
    module: loaded,
    exports: loaded.exports,
    require(specifier) {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier]
      if (specifier === 'server-only') return {}
      if (specifier.startsWith('@/')) return loadModule(`${specifier.slice(2)}.ts`, mocks, globals)
      if (specifier.startsWith('.')) {
        const dependency = path.resolve(path.dirname(filename), `${specifier}.ts`)
        return loadModule(path.relative(root, dependency), mocks, globals)
      }
      return require(specifier)
    },
    URL, Headers, Request, Response, Blob, Uint8Array, AbortSignal,
    fetch: async () => { throw new Error('Unexpected network request in synthetic test') },
    process: { env: {
      NODE_ENV: 'production',
      NEXT_PUBLIC_SUPABASE_URL: projectUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_media_fixture',
    } },
    ...globals,
  }, { filename })
  return loaded.exports
}

test('photo URLs use stable same-origin checked delivery without a bearer token', () => {
  const { publicVariantUrl } = loadModule('lib/store/media.ts')
  assert.equal(publicVariantUrl(variantKey), mediaPath)
})

test('image optimization is disabled so cached derivatives cannot bypass fresh authorization', () => {
  const { default: config } = loadModule('next.config.ts')
  assert.equal(config.images?.unoptimized, true)
})

test('a guest cannot download a registered draft image', async () => {
  const fixture = mediaFixture()
  const { readPhotoMedia } = loadModule('lib/server/photo-media.ts', fixture.mocks)
  const response = await readPhotoMedia(variantKey.split('/'))
  assert.equal(response.status, 404)
  assert.equal(fixture.downloads.length, 0)
  assertUncacheable(response)
  assert.deepEqual(await response.json(), { error: { code: 'NOT_FOUND', message: 'Image not found.' } })
})

test('a guest receives the exact published image bytes through fresh anonymous storage access', async () => {
  const fixture = mediaFixture({ status: 'published' })
  const { readPhotoMedia } = loadModule('lib/server/photo-media.ts', fixture.mocks)
  const response = await readPhotoMedia(variantKey.split('/'))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Content-Type'), 'image/webp')
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), imageBytes)
  assertUncacheable(response)
  assert.equal(fixture.reads.every((read) => read.audience === 'anonymous'), true)
  assert.deepEqual(fixture.downloads, [{ audience: 'anonymous', bucket: 'photos', key: variantKey }])
  assert.equal(fixture.anonymousOptions[0].options.auth.persistSession, false)
  assert.equal(fixture.anonymousOptions[0].options.auth.autoRefreshToken, false)
  assert.equal(fixture.anonymousOptions[0].options.auth.detectSessionInUrl, false)
})

test('a verified Google owner can preview a draft without creating a public bearer URL', async () => {
  const fixture = mediaFixture({ user: verifiedOwner(), member: true })
  const { readPhotoMedia } = loadModule('lib/server/photo-media.ts', fixture.mocks)
  const response = await readPhotoMedia(variantKey.split('/'))
  assert.equal(response.status, 200)
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), imageBytes)
  assertUncacheable(response)
  assert.equal(fixture.anonymousOptions.length, 0)
  assert.deepEqual(fixture.downloads, [{ audience: 'cookie', bucket: 'photos', key: variantKey }])
})

test('unpublishing takes effect on the next request for the same stable image URL', async () => {
  const fixture = mediaFixture({ status: 'published' })
  const { readPhotoMedia } = loadModule('lib/server/photo-media.ts', fixture.mocks)
  const first = await readPhotoMedia(variantKey.split('/'))
  assert.equal(first.status, 200)
  fixture.state.status = 'draft'
  const second = await readPhotoMedia(variantKey.split('/'))
  assert.equal(second.status, 404)
  assert.equal(fixture.downloads.length, 1)
  assertUncacheable(first)
  assertUncacheable(second)
})

test('the guest Storage policy permits download only, not durable signed URLs or listing', () => {
  const migration = privacyMigration()
  assert.match(migration, /storage\.allow_only_operation\('object\.get_authenticated'\)/)
})

test('owner preview disables upstream download caching as well as response caching', async () => {
  const fixture = mediaFixture({ user: verifiedOwner(), member: true })
  const { readPhotoMedia } = loadModule('lib/server/photo-media.ts', fixture.mocks)
  const response = await readPhotoMedia(variantKey.split('/'))
  assert.equal(response.status, 200)
  assert.equal(fixture.downloadFetchOptions[0]?.cache, 'no-store')
})

const rejectedOwners = [
  ['wrong Google account', verifiedOwner({ email: 'visitor@example.com' }), true],
  ['unverified Google identity', verifiedOwner({ identities: [{ provider: 'google', identity_data: {
    email: 'neospiritth@gmail.com', email_verified: false,
  } }] }), true],
  ['password-only owner', verifiedOwner({ identities: [{ provider: 'email' }] }), true],
  ['spoofed user metadata', verifiedOwner({ identities: [], user_metadata: {
    email: 'neospiritth@gmail.com', provider: 'google', email_verified: true,
  } }), true],
  ['verified identity without membership', verifiedOwner(), false],
  ['truthy non-boolean membership', verifiedOwner(), 'true'],
]

for (const [label, user, member] of rejectedOwners) {
  test(`${label} cannot read drafts or reuse session privileges for published images`, async () => {
    const fixture = mediaFixture({ user, member })
    const { readPhotoMedia } = loadModule('lib/server/photo-media.ts', fixture.mocks)
    const draft = await readPhotoMedia(variantKey.split('/'))
    assert.equal(draft.status, 404)
    assert.equal(fixture.downloads.length, 0)
    fixture.state.status = 'published'
    const published = await readPhotoMedia(variantKey.split('/'))
    assert.equal(published.status, 200)
    assert.equal(fixture.reads.every((read) => read.audience === 'anonymous'), true)
    assert.equal(fixture.downloads.every((download) => download.audience === 'anonymous'), true)
    assertUncacheable(draft)
    assertUncacheable(published)
  })
}

const malformedKeys = [
  ['missing key', undefined], ['null key', null], ['scalar key', variantKey],
  ['no segments', []], ['extra segment', [...variantKey.split('/'), 'extra']],
  ['non-string segment', ['2026-05-fixture', 1, 'thumb-0123456789.webp']],
  ['parent traversal', ['2026-05-fixture', '..', 'thumb-0123456789.webp']],
  ['encoded traversal', ['2026-05-fixture', '%2e%2e', 'thumb-0123456789.webp']],
  ['embedded slash', ['2026-05-fixture', 'FRAME01/secret', 'thumb-0123456789.webp']],
  ['originals bucket', ['originals', 'FRAME01', 'thumb-0123456789.webp']],
  ['external URL', ['https://attacker.example', 'FRAME01', 'thumb-0123456789.webp']],
  ['unsupported image type', ['2026-05-fixture', 'FRAME01', 'thumb-0123456789.svg']],
  ['invalid source hash', ['2026-05-fixture', 'FRAME01', 'thumb-012345678Z.webp']],
  ['short source hash', ['2026-05-fixture', 'FRAME01', 'thumb-012345678.webp']],
  ['unsupported size', ['2026-05-fixture', 'FRAME01', 'original-0123456789.webp']],
]

for (const [label, segments] of malformedKeys) {
  test(`media denies ${label} before database or storage access, even for the owner`, async () => {
    const fixture = mediaFixture({ user: verifiedOwner(), member: true })
    const { readPhotoMedia } = loadModule('lib/server/photo-media.ts', fixture.mocks)
    const response = await readPhotoMedia(segments)
    assert.equal(response.status, 404)
    assert.equal(fixture.reads.length, 0)
    assert.equal(fixture.downloads.length, 0)
    assertUncacheable(response)
  })
}

for (const [label, options] of [
  ['missing entry', { missingEntry: true }],
  ['orphan object without assets', { missingAssets: true }],
  ['null variant registry', { variants: null }],
  ['unregistered variant', { variants: {} }],
  ['different registered key', { variants: { thumb: { webp: variantKey.replace('FRAME01', 'FRAME02') } } }],
  ['requested key in the wrong slot', { variants: { medium: { webp: variantKey } } }],
]) {
  test(`media denies ${label} without downloading an object`, async () => {
    const fixture = mediaFixture({ status: 'published', ...options })
    const { readPhotoMedia } = loadModule('lib/server/photo-media.ts', fixture.mocks)
    const response = await readPhotoMedia(variantKey.split('/'))
    assert.equal(response.status, 404)
    assert.equal(fixture.downloads.length, 0)
    assertUncacheable(response)
  })
}

for (const [label, options] of [
  ['database error', { databaseError: true }],
  ['database exception', { databaseThrows: true }],
  ['Storage denial or concurrent unpublish', { storageError: true }],
  ['Storage exception', { storageThrows: true }],
  ['draft returned despite the published filter', { status: 'draft', ignoreStatusFilter: true }],
]) {
  test(`${label} returns only the generic noncacheable denial`, async () => {
    const fixture = mediaFixture({ status: 'published', ...options })
    const { readPhotoMedia } = loadModule('lib/server/photo-media.ts', fixture.mocks)
    const response = await readPhotoMedia(variantKey.split('/'))
    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), { error: { code: 'NOT_FOUND', message: 'Image not found.' } })
    assertUncacheable(response)
  })
}

for (const size of ['thumb', 'medium', 'full']) {
  for (const [format, mime] of [['jpg', 'image/jpeg'], ['webp', 'image/webp'], ['avif', 'image/avif']]) {
    test(`the registered ${size} ${format} variant is served with its exact MIME and bytes`, async () => {
      const key = `2026-05-fixture/FRAME01/${size}-0123456789.${format}`
      const fixture = mediaFixture({ status: 'published', variants: { [size]: { [format]: key } } })
      const { readPhotoMedia } = loadModule('lib/server/photo-media.ts', fixture.mocks)
      const response = await readPhotoMedia(key.split('/'))
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('Content-Type'), mime)
      assert.deepEqual(new Uint8Array(await response.arrayBuffer()), imageBytes)
      assertUncacheable(response)
    })
  }
}

for (const [audience, options, expectedStatus] of [
  ['published guest', { status: 'published' }, 200],
  ['draft guest', {}, 404],
  ['draft owner', { user: verifiedOwner(), member: true }, 200],
]) {
  for (const method of ['GET', 'HEAD']) {
    test(`${method} media route preserves ${audience} authorization and cache isolation`, async () => {
      const fixture = mediaFixture(options)
      const route = loadModule('app/api/media/photos/[...key]/route.ts', fixture.mocks)
      const request = new Request(`https://neoex.dev${mediaPath}?token=forged&public=true`, {
        method, headers: { Range: 'bytes=0-3', 'If-None-Match': 'old-image-etag' },
      })
      const response = await route[method](request, { params: Promise.resolve({ key: variantKey.split('/') }) })
      assert.equal(response.status, expectedStatus)
      assertUncacheable(response)
      if (method === 'HEAD') assert.equal((await response.arrayBuffer()).byteLength, 0)
      else if (expectedStatus === 200) assert.deepEqual(new Uint8Array(await response.arrayBuffer()), imageBytes)
      else assert.match(response.headers.get('Content-Type'), /application\/json/)
      assert.equal(route.dynamic, 'force-dynamic')
      assert.equal(route.fetchCache, 'force-no-store')
      for (const writeMethod of ['POST', 'PUT', 'PATCH', 'DELETE']) assert.equal(route[writeMethod], undefined)
    })
  }
}

test('fresh anonymous fetches override any upstream cache request', async () => {
  const fixture = mediaFixture({ status: 'published' })
  const fetches = []
  const { readPhotoMedia } = loadModule('lib/server/photo-media.ts', fixture.mocks, {
    fetch: async (url, options) => { fetches.push({ url, options }); return new Response(null) },
  })
  await readPhotoMedia(variantKey.split('/'))
  await fixture.anonymousOptions[0].options.global.fetch(`${projectUrl}/rest/v1/entries`, { cache: 'force-cache' })
  assert.equal(fetches[0].options.cache, 'no-store')
})

for (const mapperName of ['mapArticle', 'mapFiction', 'mapPhotoSidecar', 'mapRoll']) {
  test(`${mapperName} preserves authored body bytes for rendering and editor round trips`, () => {
    const legacy = `${projectUrl}/storage/v1/object/public/photos/${variantKey}`
    const body = [
      `Literal URL in prose: ${legacy}`,
      `![fixture](${legacy})`,
      `<img src="${legacy}" />`,
      '```text', legacy, '```',
      `[query value](https://example.com/?source=${legacy})`,
      'ไทย — preserve spacing  \r',
    ].join('\n')
    const patches = Object.freeze([{ n: 1, date: '2026.05.01', note: legacy }])
    const row = Object.freeze({
      id: 'synthetic-entry', slug: 'synthetic-entry', body, reading_time: 1,
      status: 'draft', roll: '2026-05-fixture', photo_id: 'FRAME01',
      lang: 'en', date: '2026.05.01', iso_date: '2026-05-01', share_location: false,
      patches,
    })
    const mappers = loadModule('lib/store/map.ts')
    const mapped = mappers[mapperName](row)
    assert.equal(mapped.body, body)
    if (mapperName === 'mapArticle') assert.deepEqual(mapped.patches, patches)
    assert.equal(row.body, body)
    assert.equal(row.patches, patches)
  })
}

test('the Storage policy maps exactly nine published-photo slots and changes no originals or write policies', () => {
  const migration = privacyMigration()
  const actualSlots = [...migration.matchAll(/assets\.variants\s*->\s*'([^']+)'\s*->>\s*'([^']+)'/g)]
    .map((match) => `${match[1]}/${match[2]}`).sort()
  const expectedSlots = ['thumb', 'medium', 'full'].flatMap((size) =>
    ['jpg', 'webp', 'avif'].map((format) => `${size}/${format}`)).sort()
  assert.deepEqual(actualSlots, expectedSlots)
  assert.match(migration, /bucket_id\s*=\s*'photos'/)
  assert.match(migration, /entry\.kind\s*=\s*'photo'/)
  assert.match(migration, /entry\.status\s*=\s*'published'/)
  assert.match(migration, /entry\.id\s*=\s*assets\.entry_id/)
  assert.match(migration, /storage\.objects\.name\s+IN\s*\(/)
  assert.equal((migration.match(/CREATE POLICY/gi) ?? []).length, 1)
  assert.doesNotMatch(migration, /\b(?:DROP|UPDATE|DELETE|INSERT|GRANT|REVOKE|ALTER)\b/i)
  assert.doesNotMatch(migration, /originals|object\.sign|object\.list/i)
})
