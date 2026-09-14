/**
 * TASK-2026-09-12-PUBLICATION · Algol
 * Run: node --test tests/publication-consistency.test.mjs
 *
 * Executes the current TypeScript/TSX implementation from in-memory compiled
 * copies. Only I/O and visual boundaries are mocked. The database fixture has
 * no RLS: public readers must filter even when their client can see drafts.
 * Never connects to a service or writes a tracked fixture.
 */
import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInThisContext } from 'node:vm'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { evaluate } from '@mdx-js/mdx'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const originalHashes = new Map()
const digest = (value) => createHash('sha256').update(value).digest('hex')

function entry(kind, slug, overrides = {}) {
  return {
    id: kind + ':' + slug + ':' + (overrides.lang ?? 'en'), kind, slug,
    status: 'published', lang: 'en', title: 'coffee ' + slug,
    date: '2026.09.12', iso_date: '2026-09-12', domain: 'reflection',
    tags: ['coffee'], summary: 'coffee summary ' + slug, body: '# coffee ' + slug,
    maturity: 'seed', reading_time: 2, served_coords: null, share_location: false,
    place_id: null, highlight_for_place: false, worldline_links: [], variants: [],
    patches: [{ n: 1, date: new Date().toISOString().slice(0, 10), note: 'coffee patch' }],
    ...overrides,
  }
}

function fixture() {
  const branch = (slug) => ({ alpha: '1.130426', name: slug, description: 'authored ' + slug, slug })
  return {
    entries: [
      entry('article', '101', {
        title: 'English live', served_coords: { lat: 13.75, lon: 100.5, place: 'public place' },
        worldline_links: [
          { to: 'fiction/branch', label: 'public edge' },
          { to: 'article/999', label: 'private edge' },
          { to: 'photos/visible/p01' }, { to: 'photos/visible/p02' },
          { to: 'fiction/missing' },
        ],
      }),
      entry('article', '101', { lang: 'th', title: 'ไทย live' }),
      entry('article', '102'),
      entry('article', '102', { lang: 'th', status: 'draft', title: 'private Thai' }),
      entry('article', 'thai-only', { lang: 'th' }),
      entry('article', '999', { status: 'draft', maturity: 'settled', worldline_links: [{ to: 'article/101' }] }),
      entry('fiction', 'origin', {
        divergence_cluster: 'cluster',
        variants: ['branch', 'hidden-branch', 'missing', 'thai-branch'].map(branch),
      }),
      entry('fiction', 'branch', {
        divergence_cluster: 'cluster',
        worldline_links: [{ to: 'article/101' }],
        variants: [branch('hidden-branch')],
      }),
      entry('fiction', 'hidden-branch', { status: 'draft', divergence_cluster: 'cluster' }),
      entry('fiction', 'thai-branch', { lang: 'th' }),
      entry('photo', 'visible-p01', {
        roll: 'visible', photo_id: 'p01', caption: 'public frame',
        share_location: true, served_coords: { lat: 13.75, lon: 100.5, place: 'rounded' },
        coords: { lat: 13.753999, lon: 100.506789, place: 'raw private coordinate' },
      }),
      entry('photo', 'visible-p02', { status: 'draft', roll: 'visible', photo_id: 'p02' }),
      entry('photo', 'visible-p03', { roll: 'visible', photo_id: 'p03', caption: 'unlocated frame' }),
      entry('photo', 'hidden-p04', { status: 'draft', roll: 'hidden', photo_id: 'p04' }),
    ],
    rolls: ['visible', 'hidden', 'empty'].map((roll) => ({
      roll, id: roll, caption: roll, body: 'roll body ' + roll,
      date: '2026.09.12', iso_date: '2026-09-12', share_location: false, served_coords: null,
    })),
    photo_assets: [],
    places: [{ id: 'bangkok', level: 1, parent_id: null, name: 'Bangkok', lat: 13.75, lon: 100.5, is_alpha: true }],
  }
}

/** Small, strict query boundary; unsupported database operators fail loudly. */
function databaseClient(database, { errorForQuery = () => null } = {}) {
  const calls = []
  const client = {
    calls,
    from(table) {
      assert.ok(Object.hasOwn(database, table), 'unexpected table: ' + table)
      let columns = ''
      let rowLimit = Infinity
      let single = false
      const predicates = []
      const joinedPredicates = []
      const orders = []
      const call = { table, filters: [], columns: '' }
      function filter(column, predicate, description) {
        const joined = column.startsWith('entries.')
        const key = joined ? column.slice('entries.'.length) : column
        ;(joined ? joinedPredicates : predicates).push((row) => predicate(row[key]))
        call.filters.push(description)
        return query
      }
      const query = {
        select(value) { columns = value; call.columns = value; return query },
        eq(key, value) { return filter(key, (actual) => actual === value, ['eq', key, value]) },
        neq(key, value) { return filter(key, (actual) => actual !== value, ['neq', key, value]) },
        in(key, values) { return filter(key, (actual) => values.includes(actual), ['in', key, values]) },
        overlaps(key, values) { return filter(key, (actual) => (actual ?? []).some((item) => values.includes(item)), ['overlaps', key, values]) },
        not(key, operator, value) {
          assert.equal(operator, 'is')
          assert.equal(value, null)
          return filter(key, (actual) => actual != null, ['not', key, operator, value])
        },
        or(expression) {
          // NETRA tests intentionally use one safe search token, not a simulated parser.
          const terms = expression.split(',').map((term) => {
            const match = term.match(table === 'places'
              ? /^(name)\.ilike\.%([\p{L}\p{M}\p{N}]+)%$/u
              : /^(title|summary|body)\.ilike\.%([\p{L}\p{M}\p{N}]+)%$/u)
            assert.ok(match, 'unsupported fixture search expression: ' + expression)
            return { key: match[1], term: match[2].toLowerCase() }
          })
          predicates.push((row) => terms.some(({ key, term }) => String(row[key] ?? '').toLowerCase().includes(term)))
          return query
        },
        order(key, { ascending = true } = {}) { orders.push({ key, ascending }); return query },
        limit(value) { rowLimit = value; return query },
        maybeSingle() { single = true; return query },
        then(resolve, reject) {
          try {
            calls.push(call)
            const injectedError = errorForQuery(call)
            if (injectedError) return Promise.resolve({ data: null, error: injectedError }).then(resolve, reject)
            let rows = database[table].filter((row) => predicates.every((predicate) => predicate(row)))
            if (columns.includes('entries!inner(')) {
              rows = rows.filter((row) => database.entries.some((child) =>
                child.roll === row.roll && joinedPredicates.every((predicate) => predicate(child))))
            } else {
              assert.equal(joinedPredicates.length, 0, 'joined predicate without an inner relation')
            }
            rows = [...rows].sort((a, b) => {
              for (const { key, ascending } of orders) {
                const comparison = String(a[key] ?? '').localeCompare(String(b[key] ?? ''))
                if (comparison) return ascending ? comparison : -comparison
              }
              return 0
            }).slice(0, rowLimit)
            const keys = columns.split(',').filter((key) => !key.includes('!inner'))
            assert.ok(columns && !keys.includes('*'), 'fixture requires explicit selected columns')
            rows = rows.map((row) => Object.fromEntries(keys.map((key) => [key, structuredClone(row[key])])))
            if (single) assert.ok(rows.length <= 1, 'maybeSingle received duplicate fixture rows')
            return Promise.resolve({ data: single ? (rows[0] ?? null) : rows, error: null }).then(resolve, reject)
          } catch (error) { return Promise.reject(error).then(resolve, reject) }
        },
      }
      return query
    },
  }
  return client
}

/** Resolve current source, cache per fixture, and replace only declared boundaries. */
function sourceLoader(client, { stubComponents = false, overrides = {} } = {}) {
  const cache = new Map()
  const builtins = {
    'react': React,
    'react/jsx-runtime': require('react/jsx-runtime'),
    '@mdx-js/mdx': { evaluate },
    'animejs': { animate() {}, stagger() {} },
    'next/navigation': { notFound() { throw Object.assign(new Error('not found'), { code: 'TEST_NOT_FOUND' }) } },
    ...overrides,
  }
  const localOverrides = {
    'lib/store/supabase/anon.ts': { anonClient: client },
    'lib/store/supabase/server.ts': { createSupabaseServerClient: async () => client },
    'lib/store/media.ts': { publicVariantUrl: (key) => 'https://media.invalid/' + key },
  }
  function resolveSource(file) {
    const base = path.isAbsolute(file) ? file : path.join(root, file)
    return [base, base + '.ts', base + '.tsx', path.join(base, 'index.ts')]
      .find((candidate) => existsSync(candidate) && /\.[cm]?[jt]sx?$/.test(candidate))
  }
  function load(file) {
    const absolute = resolveSource(file)
    assert.ok(absolute, 'missing current implementation: ' + file)
    const relative = path.relative(root, absolute)
    if (Object.hasOwn(localOverrides, relative)) return localOverrides[relative]
    if (cache.has(absolute)) return cache.get(absolute).exports
    const source = readFileSync(absolute, 'utf8')
    if (!originalHashes.has(absolute)) originalHashes.set(absolute, digest(source))
    const compiled = ts.transpileModule(source, {
      fileName: absolute,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText
    const compiledModule = { exports: {} }
    cache.set(absolute, compiledModule)
    const runtimeRequire = (name) => {
      if (Object.hasOwn(builtins, name)) return builtins[name]
      if (stubComponents && name.startsWith('@/components/')) {
        return new Proxy({}, { get: (_target, key) => key === '__esModule' ? true : ({ children }) => children ?? null })
      }
      if (name.startsWith('@/')) return load(name.slice(2))
      if (name.startsWith('.')) return load(path.resolve(path.dirname(absolute), name))
      throw new Error('undeclared I/O or dependency boundary: ' + name)
    }
    const execute = runInThisContext('(function(require,module,exports){\n' + compiled + '\n})', { filename: absolute })
    execute(runtimeRequire, compiledModule, compiledModule.exports)
    return compiledModule.exports
  }
  return load
}

function environment(options) {
  const database = fixture()
  const client = databaseClient(database)
  const load = sourceLoader(client, options)
  return { database, client, load, reads: load('lib/store/reads.ts') }
}

function ids(rows, key) { return rows.map((row) => row[key]).sort() }

/** Await real async server components from evaluated MDX before examining anchors. */
async function elements(node) {
  node = await node
  if (node == null || typeof node !== 'object') return []
  if (Array.isArray(node)) return (await Promise.all(node.map(elements))).flat()
  if (typeof node.type === 'function') return elements(node.type(node.props))
  return [node, ...await elements(node.props?.children)]
}

test('public list/detail reads exclude drafts and missing identities across all kinds', async () => {
  const { reads } = environment()
  assert.deepEqual(ids(await reads.getArticles(), 'fileNum'), ['101', '102'])
  assert.deepEqual(ids(await reads.getFiction(), 'slug'), ['branch', 'origin'])
  assert.deepEqual(ids(await reads.getPhotoSidecars(), 'id'), ['p01', 'p03'])
  for (const slug of ['999', 'missing']) assert.equal(await reads.getArticleByFileNum(slug), undefined)
  for (const slug of ['hidden-branch', 'missing']) assert.equal(await reads.getFictionBySlug(slug), undefined)
  for (const id of ['p02', 'missing']) assert.equal(await reads.getPhotoByRollAndId('visible', id), null)
  assert.equal((await reads.getArticleByFileNum('101')).status, 'seed')
  assert.equal((await reads.getArticleByFileNum('101')).draft, false)
  assert.equal((await reads.getFictionBySlug('origin')).slug, 'origin')
  assert.equal((await reads.getPhotoByRollAndId('visible', 'p01')).id, 'p01')
})

test('locale preference, published fallback, counts, and archive URLs use the same public set', async () => {
  const { reads, load } = environment()
  assert.equal((await reads.getArticleByFileNum('101', 'th')).title, 'ไทย live')
  assert.equal((await reads.getArticleByFileNum('102', 'th')).lang, 'en')
  assert.equal(await reads.getArticleByFileNum('thai-only', 'en'), undefined)
  assert.equal(await reads.getPublishedArticleCount('en'), 2)
  assert.equal(await reads.getPublishedArticleCount('th'), 3)
  const archive = await load('lib/content/archive.ts').getArchiveEntries({ requestedLang: 'th' })
  assert.equal(archive.filter((row) => row.id === '101').length, 1)
  assert.equal(archive.find((row) => row.id === '101').title, 'ไทย live')
  assert.ok(archive.every((row) => row.route.startsWith('/th/')))
  assert.ok(!JSON.stringify(archive).includes('private Thai'))
  assert.equal(archive.length, 8)
  const stats = await reads.getWorldlineStats('th')
  assert.deepEqual(stats, { surveyed: 8, active: 1 })
})

test('unpublishing is observed on subsequent public reads without a module cache', async () => {
  const { database, reads } = environment()
  assert.ok(await reads.getArticleByFileNum('101', 'th'))
  database.entries.filter((row) => row.kind === 'article' && row.slug === '101')
    .forEach((row) => { row.status = 'draft' })
  assert.equal(await reads.getArticleByFileNum('101', 'th'), undefined)
  assert.ok(!(await reads.getRecentArticles(4, 'th')).some((row) => row.fileNum === '101'))
  assert.equal(await reads.getPublishedArticleCount('th'), 2)
})


test('an entirely withdrawn corpus stays empty across discovery, counters, graph, and rolls', async () => {
  const { database, reads, load } = environment()
  database.entries.forEach((row) => { row.status = 'draft' })
  for (const lang of ['en', 'th']) {
    assert.deepEqual(await reads.getArticles(lang), [])
    assert.deepEqual(await reads.getRecentArticles(4, lang), [])
    assert.deepEqual(await reads.getFiction(lang), [])
    assert.equal(await reads.getPublishedArticleCount(lang), 0)
    assert.deepEqual(await load('lib/content/archive.ts').getArchiveEntries({ requestedLang: lang }), [])
    assert.deepEqual(await reads.getWorldlineStats(lang), { surveyed: 0, active: 1 })
  }
  assert.deepEqual(await reads.getPhotos(), [])
  assert.deepEqual(await reads.getPhotoSidecars(), [])
  assert.deepEqual(await reads.getGlobeEligiblePhotos(), [])
  assert.deepEqual(await load('lib/content/worldline.ts').getOutgoingLinks('article', '101'), [])
})

test('admin editing retains all draft kinds while public visibility ignores maturity', async () => {
  const { load } = environment()
  const admin = load('lib/store/admin-reads.ts')
  assert.equal((await admin.getArticleBySlug('999')).draft, true)
  assert.equal((await admin.getFictionBySlugAdmin('hidden-branch')).draft, true)
  assert.equal((await admin.getPhotoByRollAndIdAdmin('visible', 'p02')).draft, true)
  const { isHiddenFromPublic } = load('lib/content/visibility.ts')
  assert.equal(isHiddenFromPublic({ draft: true, status: 'settled' }), true)
  assert.equal(isHiddenFromPublic({ draft: false, status: 'seed' }), false)
  assert.equal(isHiddenFromPublic({ status: 'seed' }), false)
})

test('empty and draft-only rolls withhold descriptors, body, and frame navigation', async () => {
  const { reads } = environment()
  assert.deepEqual(ids(await reads.getPhotos(), 'roll'), ['visible'])
  assert.equal(await reads.getRollBody('visible'), 'roll body visible')
  for (const roll of ['hidden', 'empty', 'missing']) {
    assert.deepEqual(await reads.getPhotosByRoll(roll), [])
    assert.equal(await reads.getRollBody(roll), null)
    assert.deepEqual(await reads.getSidecarsInRoll(roll), [])
  }
  const navigation = await reads.getRollNavigation('visible', 'p01')
  assert.equal(navigation.prev, undefined)
  assert.equal(navigation.next.id, 'p03')
  assert.deepEqual(await reads.getRollNavigation('visible', 'p02'), { prev: undefined, next: undefined })
  const photo = await reads.getPhotoByRollAndId('visible', 'p01')
  assert.equal(photo.authoredCoords, undefined)
  assert.deepEqual(photo.servedCoords, { lat: 13.75, lon: 100.5, place: 'rounded' })
  assert.deepEqual(ids(await reads.getGlobeEligiblePhotos(), 'id'), ['p01'])
})

test('worldline and fiction branch destinations require published endpoints in the requested locale', async () => {
  const { reads, load } = environment()
  const worldline = load('lib/content/worldline.ts')
  const outgoing = await worldline.getOutgoingLinks('article', '101')
  assert.deepEqual(outgoing.map((link) => link.to).sort(), ['fiction/branch', 'photos/visible/p01'])
  const incoming = await worldline.getIncomingLinks('article', '101')
  assert.deepEqual(incoming.map((edge) => edge.from), ['fiction/branch'])
  assert.deepEqual(await worldline.getIncomingLinks('article', '999'), [])
  assert.deepEqual(await worldline.resolveNeighborhood('article', 'missing'), { incoming: [], outgoing: [] })
  const en = await reads.getFictionBySlug('origin', 'en')
  const th = await reads.getFictionBySlug('origin', 'th')
  assert.deepEqual(en.variants.map((variant) => variant.slug), ['branch', undefined, undefined, undefined])
  assert.deepEqual(th.variants.map((variant) => variant.slug), ['branch', undefined, undefined, 'thai-branch'])
  assert.equal(en.variants[1].description, 'authored hidden-branch')
  assert.equal((await reads.getFictionSiblings('origin'))[0].variants[0].slug, undefined)
  const next = await reads.getNextEntries({
    ...(await reads.getArticleByFileNum('101')), worldline_links: [{ to: 'article/999' }, { to: 'article/102' }],
  }, 'th')
  assert.deepEqual(next.map((row) => row.href), ['/th/articles/102'])
})

test('a failed branch-availability lookup keeps published fiction while withholding unverified destinations', async () => {
  const database = fixture()
  const client = databaseClient(database, {
    errorForQuery: ({ table, columns }) => table === 'entries' && columns === 'slug,lang'
      ? { message: 'fixture branch lookup unavailable' } : null,
  })
  const load = sourceLoader(client)
  const reads = load('lib/store/reads.ts')
  const mapped = load('lib/store/map.ts').mapFiction(database.entries.find(row => row.slug === 'origin'))
  const expectedVariants = mapped.variants.map(variant => Object.fromEntries(
    Object.entries(variant).filter(([key]) => key !== 'slug'),
  ))
  const result = await reads.getFictionBySlug('origin', 'en')
  assert.deepEqual(result, { ...mapped, variants: expectedVariants })
  assert.equal(result.body, '# coffee origin')
  assert.equal(result.variants.length, 4)
  assert.ok(result.variants.every(variant => !Object.hasOwn(variant, 'slug')))
  assert.equal(client.calls.length, 2, 'execute primary content and secondary availability reads')

  const siblings = await reads.getFictionSiblings('origin')
  assert.equal(siblings[0].slug, 'branch')
  assert.equal(siblings[0].variants[0].description, 'authored hidden-branch')
  assert.ok(!Object.hasOwn(siblings[0].variants[0], 'slug'))
})

test('owner-capable NETRA queries exclude drafts from search, patches, fiction, and every page context', async () => {
  const { load, client } = environment()
  const netra = load('lib/store/netra-reads.ts').createNetraKnowledge(client)
  for (const results of [
    await netra.searchEntries({ query: 'coffee', limit: 10 }),
    await netra.searchPhotos({ query: 'coffee', limit: 10 }),
    await netra.listRecentPatches({ days: 7 }),
    await netra.listFiction(),
  ]) {
    assert.ok(results.length > 0)
    assert.ok(!results.some((row) => ['999', 'hidden-branch', 'visible-p02', 'hidden-p04'].includes(row.slug)))
  }
  assert.equal((await netra.getEntry({ slugOrFileNum: '102', lang: 'th' })).lang, 'en')
  assert.equal(await netra.getEntry({ slugOrFileNum: '999', lang: 'en' }), null)
  const hiddenContexts = [
    { kind: 'article', fileNum: '999', lang: 'en' },
    { kind: 'fiction', slug: 'hidden-branch', lang: 'en' },
    { kind: 'photo-entry', roll: 'visible', id: 'p02', lang: 'en' },
    { kind: 'photo-roll', roll: 'hidden', lang: 'en' },
    { kind: 'photo-roll', roll: 'empty', lang: 'en' },
  ]
  for (const context of hiddenContexts) assert.equal(await netra.getCurrentPage(context), null)
  const roll = await netra.getCurrentPage({ kind: 'photo-roll', roll: 'visible', lang: 'en' })
  assert.match(roll.summary, /p01/)
  assert.match(roll.summary, /p03/)
  assert.doesNotMatch(roll.summary, /p02/)
  assert.ok(client.calls.filter((call) => call.table === 'entries')
    .every((call) => call.filters.some(([operator, key, value]) => operator === 'eq' && key === 'status' && value === 'published')))
})

test('actual detail routes and public metadata preserve published/draft/missing behavior', async () => {
  const { reads } = environment()
  const cases = [
    { file: 'app/[lang]/articles/[fileNum]/page.tsx', params: (id) => ({ lang: 'en', fileNum: id }), live: '101', hidden: '999' },
    { file: 'app/[lang]/fiction/[slug]/page.tsx', params: (id) => ({ lang: 'en', slug: id }), live: 'origin', hidden: 'hidden-branch' },
    { file: 'app/[lang]/photos/[roll]/[id]/page.tsx', params: (id) => ({ lang: 'en', roll: 'visible', id }), live: 'p01', hidden: 'p02' },
  ]
  // Barrel reads contain unrelated place/UI composition: replace only the barrel,
  // retaining the executed authoritative reads above.
  const routeLoad = sourceLoader(databaseClient(fixture()), {
    stubComponents: true,
    overrides: { '@/lib/content': reads, '@/lib/store/mdx': { renderMdxBody: async () => null } },
  })
  for (const scenario of cases) {
    const route = routeLoad(scenario.file)
    const live = { params: Promise.resolve(scenario.params(scenario.live)) }
    assert.ok(await route.default(live))
    assert.doesNotMatch(JSON.stringify(await route.generateMetadata(live)), /Not Found/)
    for (const id of [scenario.hidden, 'missing']) {
      const args = { params: Promise.resolve(scenario.params(id)) }
      await assert.rejects(route.default(args), { code: 'TEST_NOT_FOUND' })
      const metadata = await route.generateMetadata(args)
      assert.match(metadata.title, /Not Found/)
      assert.equal(metadata.description, undefined)
      assert.equal(metadata.alternates, undefined)
    }
    const staticParams = await route.generateStaticParams()
    assert.ok(!staticParams.some((params) => JSON.stringify(params).includes(scenario.hidden)))
  }
})

test('evaluated Markdown and JSX anchors guard relative, canonical, encoded, and locale entry links', async () => {
  const { load, client } = environment()
  const { renderMdxBody } = load('lib/store/mdx.tsx')
  const source = [
    '[live relative](102)',
    '[draft relative](999?source=body#part)',
    '[published Thai fallback](/th/articles/102)',
    '[draft English](/en/articles/999)',
    '[encoded draft](/articles/%39%39%39)',
    '[draft fiction](/fiction/hidden-branch)',
    '[draft photo](/photos/visible/p02)',
    '[draft roll](/photos/hidden)',
    '[live roll](/photos/visible)',
    '[fragment](#section)',
    '[external](https://example.com/articles/999)',
    '[email](mailto:hello@example.com)',
    '[canonical draft](https://neoex.dev/articles/999)',
    '<a href="/articles/999" className="authored-link">JSX hidden</a>',
    '<a href={"/articles/102"}>JSX live</a>',
  ].join('\n\n')
  const tree = await elements(await renderMdxBody(source, { pathname: '/articles/101' }))
  const hrefs = tree.filter((node) => node.type === 'a').map((node) => node.props.href)
  assert.deepEqual(hrefs.sort(), [
    '102', '/th/articles/102', '/photos/visible', '#section',
    'https://example.com/articles/999', 'mailto:hello@example.com', '/articles/102',
  ].sort())
  assert.ok(tree.some((node) => node.type === 'span' && node.props.className === 'authored-link'))
  const checks999 = client.calls.filter((call) => call.table === 'entries'
    && call.filters.some(([, key, value]) => key === 'slug' && value === '999'))
  assert.ok(checks999.length >= 1)
  assert.equal(await renderMdxBody('  '), null)
})

test('MDX link checks fail closed on read errors and deduplicate destinations per body', async () => {
  const client = databaseClient(fixture())
  let calls = 0
  const load = sourceLoader(client, {
    overrides: {
      './reads': {
        getArticleByFileNum: async () => { calls += 1; throw new Error('fixture read unavailable') },
        getFictionBySlug: async () => undefined,
        getPhotoByRollAndId: async () => null,
        getPhotosByRoll: async () => [],
      },
    },
  })
  const tree = await elements(await load('lib/store/mdx.tsx').renderMdxBody(
    '[one](/articles/999?x=1) [two](/articles/999#part) <a href="/articles/999">three</a>',
    { pathname: '/articles/101' },
  ))
  assert.equal(tree.filter((node) => node.type === 'a').length, 0)
  assert.equal(calls, 1)
})

test('Traces renders zero as zero and filters only the current server-provided corpus', () => {
  const { load } = environment()
  const { AttractorFilterShell } = load('components/AttractorFilterShell.tsx')
  const render = (entries, initialTag = 'all', lang = 'th') =>
    renderToStaticMarkup(React.createElement(AttractorFilterShell, { entries, initialTag, lang }))
  assert.doesNotMatch(render([]), /href="[^"]*articles\//)
  const records = [
    { fileNum: 'live-coffee', title: 'Current coffee', date: '2026.09.12', tags: ['coffee'], status: 'seed', readingTime: 2, lang: 'en' },
    { fileNum: 'live-meta', title: 'Current meta', date: '2026.09.12', tags: ['meta'], status: 'ongoing', readingTime: 3, lang: 'th' },
  ]
  const all = render(records)
  assert.match(all, /href="\/th\/articles\/live-coffee"/)
  assert.match(all, /href="\/th\/articles\/live-meta"/)
  const filtered = render(records, 'coffee')
  assert.match(filtered, /Current coffee/)
  assert.doesNotMatch(filtered, /Current meta/)
  assert.doesNotMatch(render(records, 'missing-tag'), /href="[^"]*articles\//)
})


test('search replaces stale metadata and removes withdrawn identities, coordinates, excerpts, and aliases', async () => {
  const { load, database } = environment()
  const { filterPublicSearchResults, publicSearchPath } = load('lib/client-state/public-search.ts')
  assert.equal(publicSearchPath('/th/articles/101.html?x=1#section'), '/articles/101')
  const archive = load('lib/content/archive.ts')
  const entries = await archive.getArchiveEntries({ requestedLang: 'th' })
  const stale = (url) => ({
    url, meta: { title: 'STALE TITLE', coord: '13.753999°N · 100.506789°E', place: 'PRIVATE OLD PLACE', drift: 'SECRET' },
    excerpt: 'WITHDRAWN BODY',
  })
  const results = [
    stale('/en/articles/101.html'), stale('/th/articles/101'),
    stale('/articles/999'), stale('/fiction/hidden-branch'),
    stale('/photos/visible/p01'), stale('/photos/visible/p02'),
    stale('/photos/visible/p03'), stale('/photos/visible'), stale('/photos/hidden'),
    stale('/articles/missing'),
  ]
  const filtered = filterPublicSearchResults(results, entries, 'th')
  assert.deepEqual(filtered.map((result) => result.url), [
    '/th/articles/101', '/th/photos/visible/p01', '/th/photos/visible/p03', '/th/photos/visible',
  ])
  assert.equal(filtered[0].meta.title, 'ไทย live')
  assert.equal(filtered[1].meta.coord, '13.75°N · 100.50°E')
  assert.equal(filtered[2].meta.coord, undefined)
  assert.equal(filtered[3].meta.coord, undefined)
  assert.ok(filtered.every((result) => result.excerpt === ''))
  assert.doesNotMatch(JSON.stringify(filtered), /STALE TITLE|PRIVATE OLD PLACE|SECRET|WITHDRAWN BODY|13\.753999/)
  assert.deepEqual(filterPublicSearchResults(results, [], 'en'), [])
  database.entries.filter((row) => row.slug === '101').forEach((row) => { row.status = 'draft' })
  const refreshed = filterPublicSearchResults(results, await archive.getArchiveEntries({ requestedLang: 'th' }), 'th')
  assert.ok(!refreshed.some((result) => result.url.includes('/articles/101')))
})

after(() => {
  for (const [file, hash] of originalHashes) {
    assert.equal(digest(readFileSync(file, 'utf8')), hash, 'test altered source: ' + path.relative(root, file))
  }
})
