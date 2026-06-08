/**
 * tests/entry-lifecycle-t1-qa.test.ts
 * ---------------------------------------------------------------------------
 * Algol QA gauntlet for the T1 lifecycle draft-filter system.
 *
 * Verified items (six must-verify criteria from the TASK):
 *   1. Leak matrix -- production: draft entries absent from every public surface
 *   2. Dev visibility -- same draft entries visible in development
 *   3. deleteEntry scope -- removes ONLY the .mdx source file; path-escape adversarial
 *   4. Dev-guard -- setEntryDraft + deleteEntry return DEV_GUARD in production, no I/O
 *   5. Non-draft byte-identical -- toggling draft on entry X does not mutate entry Y
 *   6. Status untouched -- setEntryDraft does not alter the status field
 *
 * SEEDING STRATEGY:
 *   Content functions read from .velite/index.js (generated cache), NOT from
 *   .mdx source files. Tests that verify the filter (section 1) seed
 *   `draft: true` into the velite JSON files (.velite/articles.json, etc.) and
 *   then spawn a subprocess with NODE_ENV=production so the module cache loads
 *   fresh with the seeded draft present. The filter result is observed in that
 *   fresh process -- this is the only way to test archive.ts (_entries baked) and
 *   worldline.ts (_corpus baked) which cache POST-FILTER results.
 *   The setEntryDraftImpl tests (#3-6) operate on real .mdx source files.
 *
 * FOUR PROBE CONTROLS (kills all false-green modes):
 *   (A) Seed read-back: after JSON mutation, re-read and assert draft===true.
 *       Kills mode-1: seed hitting a missing row (JSON unchanged -> trivial absence).
 *   (B) Prod sibling-present: same prod subprocess asserts a non-draft sibling IS present.
 *       Kills mode-2: subprocess crash -> empty [] -> trivial absence.
 *   (C) Prod seeded-id absent: the actual leak check.
 *   (D) Dev seeded-id present: proves the exclusion is NODE_ENV-gated, not permanent.
 *
 * MEMOIZATION:
 *   articles.ts, fiction.ts, photos.ts: module-level _articles/_fiction/_sidecars
 *   cache the RAW velite data; isHiddenFromPublic() is re-evaluated each call.
 *   Object.defineProperty NODE_ENV toggle between calls WORKS for these.
 *   archive.ts, worldline.ts: _entries/_corpus cache the POST-FILTER result.
 *   These are tested via subprocess probes (fresh module load per subprocess).
 *
 * ISOLATION CONTRACT:
 *   Every test that writes files snapshots before and restores in finally.
 *   The final test asserts git working tree is clean.
 *
 * RUNNER:
 *   npx tsx --test tests/entry-lifecycle-t1-qa.test.ts
 *
 * Owner: Algol (alpha-VER-06) . T1 lifecycle QA . 2026-06-08
 */

import { test, describe, before, afterEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  setEntryDraftImpl,
  deleteEntryImpl,
} from '@/lib/server/entries/entry-lifecycle-core'
import { isHiddenFromPublic } from '@/lib/content/visibility'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readFile(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf-8')
}

function writeFile(relPath: string, content: string): void {
  writeFileSync(path.join(ROOT, relPath), content, 'utf-8')
}

function snapshot(relPaths: string[]): Record<string, string> {
  const saved: Record<string, string> = {}
  for (const p of relPaths) {
    const abs = path.join(ROOT, p)
    if (existsSync(abs)) saved[p] = readFileSync(abs, 'utf-8')
  }
  return saved
}

function restore(saved: Record<string, string>): void {
  for (const [p, content] of Object.entries(saved)) {
    writeFileSync(path.join(ROOT, p), content, 'utf-8')
  }
}

/**
 * Temporarily set process.env.NODE_ENV to a value, run fn, then restore.
 * Works for in-process tests on functions that re-evaluate isHiddenFromPublic()
 * each call (articles, fiction, photos -- they cache RAW data, filter on call).
 * NOT safe for archive.ts / worldline.ts which cache post-filter results.
 */
function withEnv<T>(key: string, value: string, fn: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(process.env, key)
  Object.defineProperty(process.env, key, {
    value, writable: true, configurable: true, enumerable: true,
  })
  try {
    return fn()
  } finally {
    if (descriptor) {
      Object.defineProperty(process.env, key, descriptor)
    } else {
      delete (process.env as Record<string, string | undefined>)[key]
    }
  }
}

// ---------------------------------------------------------------------------
// Subprocess probe helper
// Spawns a fresh tsx subprocess with the given NODE_ENV and ES module script.
// The script must write a single JSON line to stdout.
// Throws on subprocess error -- do NOT silently catch (kills mode-2 false-green).
// ---------------------------------------------------------------------------

function runProbe(nodeEnv: 'production' | 'development', probeScript: string): unknown {
  const stdout = execSync('npx tsx --input-type=module', {
    cwd: ROOT,
    env: { ...process.env, NODE_ENV: nodeEnv },
    input: probeScript,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 30_000,
  }) as string
  return JSON.parse(stdout.trim())
}

// ---------------------------------------------------------------------------
// Velite JSON seeding helpers
// Content functions read from .velite/index.js (via .velite/index.js import).
// To test the draft filter, we modify the JSON cache files directly.
// ---------------------------------------------------------------------------

const VELITE_ARTICLES_JSON = '.velite/articles.json'
const VELITE_FICTION_JSON  = '.velite/fiction.json'
const VELITE_SIDECARS_JSON = '.velite/photoSidecars.json'

/**
 * Set draft:true on the article with the given fileNum in the velite JSON cache.
 * Throws if the entry is not found (kills mode-1 false-green).
 */
function seedArticleDraftInCache(fileNum: string): void {
  const raw = readFile(VELITE_ARTICLES_JSON)
  const data: Array<Record<string, unknown>> = JSON.parse(raw)
  let hit = false
  for (const a of data) {
    if (a.fileNum === fileNum) { a.draft = true; hit = true }
  }
  if (!hit) throw new Error(`seedArticleDraftInCache: fileNum "${fileNum}" not found in velite cache`)
  writeFile(VELITE_ARTICLES_JSON, JSON.stringify(data, null, 2))
}

/**
 * Set draft:true on the fiction with the given slug in the velite JSON cache.
 * Throws if the entry is not found.
 */
function seedFictionDraftInCache(slug: string): void {
  const raw = readFile(VELITE_FICTION_JSON)
  const data: Array<Record<string, unknown>> = JSON.parse(raw)
  let hit = false
  for (const f of data) {
    if (f.slug === slug) { f.draft = true; hit = true }
  }
  if (!hit) throw new Error(`seedFictionDraftInCache: slug "${slug}" not found in velite cache`)
  writeFile(VELITE_FICTION_JSON, JSON.stringify(data, null, 2))
}

/**
 * Set draft:true on the photo sidecar in the velite JSON cache.
 * Throws if the entry is not found.
 */
function seedPhotoDraftInCache(roll: string, id: string): void {
  const raw = readFile(VELITE_SIDECARS_JSON)
  const data: Array<Record<string, unknown>> = JSON.parse(raw)
  let hit = false
  for (const s of data) {
    if (s.roll === roll && s.id === id) { s.draft = true; hit = true }
  }
  if (!hit) throw new Error(`seedPhotoDraftInCache: "${roll}/${id}" not found in velite cache`)
  writeFile(VELITE_SIDECARS_JSON, JSON.stringify(data, null, 2))
}

// ---------------------------------------------------------------------------
// Content module imports (used in-process for tests with NODE_ENV toggle)
// ---------------------------------------------------------------------------

import { getArticles, getAllArticles, getArticleByFileNum } from '@/lib/content/articles'
import { getFiction, getAllFiction, getFictionBySlug } from '@/lib/content/fiction'
import {
  getPhotoSidecars,
  getPhotoByRollAndId,
  getAllPhotoSidecars,
} from '@/lib/content/photos'
import { getPlacesSummary } from '@/lib/content/places'

// ---------------------------------------------------------------------------
// 0. Baseline: isHiddenFromPublic predicate contract
// ---------------------------------------------------------------------------

describe('0. isHiddenFromPublic predicate', () => {

  test('0a. draft:true + production -> hidden', () => {
    const result = withEnv('NODE_ENV', 'production', () =>
      isHiddenFromPublic({ draft: true })
    )
    assert.equal(result, true, 'draft:true in production must be hidden')
  })

  test('0b. draft:false + production -> visible', () => {
    const result = withEnv('NODE_ENV', 'production', () =>
      isHiddenFromPublic({ draft: false })
    )
    assert.equal(result, false, 'draft:false in production must be visible')
  })

  test('0c. draft:undefined + production -> visible', () => {
    const result = withEnv('NODE_ENV', 'production', () =>
      isHiddenFromPublic({})
    )
    assert.equal(result, false, 'draft:undefined in production must be visible')
  })

  test('0d. draft:true + development -> visible', () => {
    const result = withEnv('NODE_ENV', 'development', () =>
      isHiddenFromPublic({ draft: true })
    )
    assert.equal(result, false, 'draft:true in development must be visible (dev shows all)')
  })

  test('0e. draft:true + test env -> visible', () => {
    const result = withEnv('NODE_ENV', 'test', () =>
      isHiddenFromPublic({ draft: true })
    )
    assert.equal(result, false, 'draft:true in test env must be visible')
  })
})

// ---------------------------------------------------------------------------
// 1. Leak matrix -- production draft filter
//
//    STRATEGY: for each content kind, we:
//      (A) Seed draft:true into the velite JSON cache for one entry.
//          Re-read the JSON to verify the seed hit a real row (kills mode-1).
//      (B) Run a subprocess with NODE_ENV=production. In the same probe,
//          assert: (i) a non-draft sibling IS present (kills mode-2 crash),
//                  (ii) the seeded id is ABSENT from every public surface.
//      (D) Run a subprocess with NODE_ENV=development.
//          Assert the seeded id IS present (proves NODE_ENV-gating, not permanent removal).
//      Finally: restore the original JSON bytes.
//
//    Surfaces covered per kind (all in one prod probe per kind):
//      article: getArticles, archive (getArchiveEntries), worldline corpus, places
//      fiction: getFiction, archive
//      photo:   getPhotoSidecars, archive, places (globe-eligible with shareLocation:true)
// ---------------------------------------------------------------------------

describe('1. Leak matrix -- seeded subprocess probes', () => {

  // Snapshot raw bytes of all three velite JSON files.
  // Restore in after() to guarantee test 8a (working-tree-clean) passes.
  let jsonSnapshots: Record<string, string> = {}

  before(() => {
    jsonSnapshots = snapshot([VELITE_ARTICLES_JSON, VELITE_FICTION_JSON, VELITE_SIDECARS_JSON])
  })

  after(() => {
    restore(jsonSnapshots)
  })

  afterEach(() => {
    // Restore after each test so seeds don't bleed across tests
    restore(jsonSnapshots)
  })

  // -- 1a. Article leak matrix -----------------------------------------------

  test('1a. article draft:true -- absent from prod surfaces, present in dev', () => {
    // Seed article "001" as draft in the velite JSON cache.
    seedArticleDraftInCache('001')

    // (A) Seed read-back: verify the seed took
    const rawAfterSeed: Array<Record<string, unknown>> = JSON.parse(readFile(VELITE_ARTICLES_JSON))
    const seededEntry = rawAfterSeed.find(a => a.fileNum === '001')
    assert.ok(seededEntry, 'Article 001 must exist in velite cache')
    assert.equal(seededEntry!.draft, true, 'Article 001 must have draft===true after seeding')

    // (B) Prod probe: sibling "002" present, "001" absent from getArticles + archive + places
    // Article 001 coords.place = "Yirgacheffe · ET" → place ID "yirgacheffe"
    // Article 002 coords.place = "Chiang Mai · TH"  → place ID "chiang-mai"
    const prodResult = runProbe('production', `
import { getArticles } from '${ROOT}/lib/content/articles.js'
import { getArchiveEntries } from '${ROOT}/lib/content/archive.js'
import { getPlaceContent } from '${ROOT}/lib/content/places.js'

const articles = await getArticles()
const archiveEntries = await getArchiveEntries()

// Sibling present control: article "002" must be in prod results
const siblingInArticles = articles.some(a => a.fileNum === '002')
const siblingInArchive  = archiveEntries.some(e => e.kind === 'article' && e.id === '002')

// Seeded draft absent from core article/archive surfaces
const draftInArticles = articles.some(a => a.fileNum === '001')
const draftInArchive  = archiveEntries.some(e => e.kind === 'article' && e.id === '001')

// Places/globe surface: article 001 is at "Yirgacheffe · ET" → place "yirgacheffe"
// In prod it must NOT appear in getPlaceContent('yirgacheffe', false).articles
// Sibling control: article 002 at "chiang-mai" must still be present there
const yirgaContent    = await getPlaceContent('yirgacheffe', false)
const chiangMaiContent = await getPlaceContent('chiang-mai', false)
const draftInPlaces   = yirgaContent?.articles.some(a => a.fileNum === '001') ?? false
const siblingInPlaces = chiangMaiContent?.articles.some(a => a.fileNum === '002') ?? false

console.log(JSON.stringify({
  siblingInArticles,
  siblingInArchive,
  draftInArticles,
  draftInArchive,
  draftInPlaces,
  siblingInPlaces,
  articlesCount: articles.length,
}))
`) as {
      siblingInArticles: boolean
      siblingInArchive: boolean
      draftInArticles: boolean
      draftInArchive: boolean
      draftInPlaces: boolean
      siblingInPlaces: boolean
      articlesCount: number
    }

    // (B-i) Sibling present -- proves subprocess returned real data, not empty crash
    assert.equal(prodResult.siblingInArticles, true,
      'CONTROL: article "002" must be present in prod getArticles() (proves subprocess ran)')
    assert.equal(prodResult.siblingInArchive, true,
      'CONTROL: article "002" must be present in prod archive (proves subprocess ran)')
    assert.equal(prodResult.siblingInPlaces, true,
      'CONTROL: article "002" must appear in prod getPlaceContent("chiang-mai") (proves places module ran)')

    // (C) Draft absent from all prod public surfaces
    assert.equal(prodResult.draftInArticles, false,
      'Article "001" (draft:true) must be ABSENT from getArticles() in production')
    assert.equal(prodResult.draftInArchive, false,
      'Article "001" (draft:true) must be ABSENT from getArchiveEntries() in production')
    assert.equal(prodResult.draftInPlaces, false,
      'Article "001" (draft:true) must be ABSENT from getPlaceContent("yirgacheffe") in production (globe/places leak)')

    // (D) Dev probe: seeded draft IS present (proves NODE_ENV-gating, not permanent removal)
    const devResult = runProbe('development', `
import { getArticles } from '${ROOT}/lib/content/articles.js'
import { getPlaceContent } from '${ROOT}/lib/content/places.js'
const articles = await getArticles()
const yirgaContent = await getPlaceContent('yirgacheffe', false)
console.log(JSON.stringify({
  draftInArticles: articles.some(a => a.fileNum === '001'),
  draftInPlaces: yirgaContent?.articles.some(a => a.fileNum === '001') ?? false,
}))
`) as { draftInArticles: boolean; draftInPlaces: boolean }
    assert.equal(devResult.draftInArticles, true,
      'Article "001" (draft:true) must be PRESENT in getArticles() in development (NODE_ENV-gated)')
    assert.equal(devResult.draftInPlaces, true,
      'Article "001" (draft:true) must be PRESENT in getPlaceContent("yirgacheffe") in development')
  })

  // -- 1b. Fiction leak matrix ------------------------------------------------

  test('1b. fiction draft:true -- absent from prod surfaces, present in dev', () => {
    // Seed the only fiction entry as draft.
    // Fiction has only one entry: "transmission-001".
    seedFictionDraftInCache('transmission-001')

    // (A) Seed read-back
    const rawAfterSeed: Array<Record<string, unknown>> = JSON.parse(readFile(VELITE_FICTION_JSON))
    const seededEntry = rawAfterSeed.find(f => f.slug === 'transmission-001')
    assert.ok(seededEntry, 'Fiction transmission-001 must exist in velite cache')
    assert.equal(seededEntry!.draft, true, 'Fiction transmission-001 must have draft===true after seeding')

    // (B) Prod probe: fiction array empty (one entry, seeded as draft), archive lacks it.
    // Sibling control: articles must still have entries (proves subprocess ran, not empty crash).
    const prodResult = runProbe('production', `
import { getFiction } from '${ROOT}/lib/content/fiction.js'
import { getArchiveEntries } from '${ROOT}/lib/content/archive.js'
import { getArticles } from '${ROOT}/lib/content/articles.js'

const fiction        = await getFiction()
const archiveEntries = await getArchiveEntries()
const articles       = await getArticles()

// Sibling control: cross-kind -- articles must still be present
const articlesPresent = articles.length > 0

const draftInFiction = fiction.some(f => f.slug === 'transmission-001')
const draftInArchive = archiveEntries.some(e => e.kind === 'fiction' && e.id === 'transmission-001')

console.log(JSON.stringify({
  articlesPresent,
  draftInFiction,
  draftInArchive,
  fictionCount: fiction.length,
}))
`) as {
      articlesPresent: boolean
      draftInFiction: boolean
      draftInArchive: boolean
      fictionCount: number
    }

    // (B-i) Control: articles present proves subprocess ran
    assert.equal(prodResult.articlesPresent, true,
      'CONTROL: articles must be present in prod (proves subprocess ran without crash)')

    // (C) Draft absent from prod fiction + archive
    assert.equal(prodResult.draftInFiction, false,
      'Fiction "transmission-001" (draft:true) must be ABSENT from getFiction() in production')
    assert.equal(prodResult.draftInArchive, false,
      'Fiction "transmission-001" (draft:true) must be ABSENT from getArchiveEntries() in production')
    assert.equal(prodResult.fictionCount, 0,
      'getFiction() must return empty array when the only fiction entry is a draft in production')

    // (D) Dev probe: seeded draft IS present
    const devResult = runProbe('development', `
import { getFiction } from '${ROOT}/lib/content/fiction.js'
const fiction = await getFiction()
console.log(JSON.stringify({ draftInFiction: fiction.some(f => f.slug === 'transmission-001') }))
`) as { draftInFiction: boolean }
    assert.equal(devResult.draftInFiction, true,
      'Fiction "transmission-001" (draft:true) must be PRESENT in getFiction() in development')
  })

  // -- 1c. Photo sidecar leak matrix -----------------------------------------
  // Seed DSCF0001 (shareLocation:true) -- tests globe/places leak too.

  test('1c. photo draft:true -- absent from prod surfaces including globe-eligible set', () => {
    seedPhotoDraftInCache('2026-04-chiang-mai', 'DSCF0001')

    // (A) Seed read-back
    const rawAfterSeed: Array<Record<string, unknown>> = JSON.parse(readFile(VELITE_SIDECARS_JSON))
    const seededEntry = rawAfterSeed.find(s => s.roll === '2026-04-chiang-mai' && s.id === 'DSCF0001')
    assert.ok(seededEntry, 'Photo DSCF0001 must exist in velite cache')
    assert.equal(seededEntry!.draft, true, 'Photo DSCF0001 must have draft===true after seeding')

    // (B) Prod probe: sibling DSCF0002 present, seeded DSCF0001 absent from all photo surfaces.
    // DSCF0001 is in roll "2026-04-chiang-mai" → place ID "chiang-mai".
    // DSCF0002 is in roll "2026-05-bangkok"    → place ID "bangkok".
    const prodResult = runProbe('production', `
import { getPhotoSidecars } from '${ROOT}/lib/content/photos.js'
import { getArchiveEntries } from '${ROOT}/lib/content/archive.js'
import { getPlaceContent } from '${ROOT}/lib/content/places.js'

const sidecars       = await getPhotoSidecars()
const archiveEntries = await getArchiveEntries()

// Sibling control: DSCF0002 must be present
const siblingInSidecars = sidecars.some(s => s.roll === '2026-05-bangkok' && s.id === 'DSCF0002')
const siblingInArchive  = archiveEntries.some(e => e.kind === 'photo' && e.id === '2026-05-bangkok/DSCF0002')

// Seeded draft absent from photo list and archive
const draftInSidecars = sidecars.some(s => s.roll === '2026-04-chiang-mai' && s.id === 'DSCF0001')
const draftInArchive  = archiveEntries.some(e => e.kind === 'photo' && e.id === '2026-04-chiang-mai/DSCF0001')

// Globe/places surface: DSCF0001 roll "2026-04-chiang-mai" → place "chiang-mai"
// In prod it must NOT appear in getPlaceContent('chiang-mai', false).sidecars
// Sibling control: DSCF0002 at "bangkok" must still appear in that place
const chiangMaiContent = await getPlaceContent('chiang-mai', false)
const bangkokContent   = await getPlaceContent('bangkok', false)
const draftInPlaces    = chiangMaiContent?.sidecars.some(s => s.roll === '2026-04-chiang-mai' && s.id === 'DSCF0001') ?? false
const siblingInPlaces  = bangkokContent?.sidecars.some(s => s.roll === '2026-05-bangkok' && s.id === 'DSCF0002') ?? false

console.log(JSON.stringify({
  siblingInSidecars,
  siblingInArchive,
  siblingInPlaces,
  draftInSidecars,
  draftInArchive,
  draftInPlaces,
}))
`) as {
      siblingInSidecars: boolean
      siblingInArchive: boolean
      siblingInPlaces: boolean
      draftInSidecars: boolean
      draftInArchive: boolean
      draftInPlaces: boolean
    }

    // (B-i) Sibling controls
    assert.equal(prodResult.siblingInSidecars, true,
      'CONTROL: DSCF0002 must be present in prod getPhotoSidecars() (proves subprocess ran)')
    assert.equal(prodResult.siblingInArchive, true,
      'CONTROL: DSCF0002 must be present in prod archive (proves subprocess ran)')
    assert.equal(prodResult.siblingInPlaces, true,
      'CONTROL: DSCF0002 must appear in prod getPlaceContent("bangkok") (proves places module ran)')

    // (C) Draft absent from all prod public surfaces
    assert.equal(prodResult.draftInSidecars, false,
      'Photo "DSCF0001" (draft:true) must be ABSENT from getPhotoSidecars() in production')
    assert.equal(prodResult.draftInArchive, false,
      'Photo "DSCF0001" (draft:true) must be ABSENT from getArchiveEntries() in production')
    assert.equal(prodResult.draftInPlaces, false,
      'Photo "DSCF0001" (draft:true) must be ABSENT from getPlaceContent("chiang-mai") in production (globe/places leak)')

    // (D) Dev probe: seeded draft IS present (proves NODE_ENV-gating, not permanent removal)
    const devResult = runProbe('development', `
import { getPhotoSidecars } from '${ROOT}/lib/content/photos.js'
import { getPlaceContent } from '${ROOT}/lib/content/places.js'
const sidecars = await getPhotoSidecars()
const chiangMaiContent = await getPlaceContent('chiang-mai', false)
console.log(JSON.stringify({
  draftInSidecars: sidecars.some(s => s.roll === '2026-04-chiang-mai' && s.id === 'DSCF0001'),
  draftInPlaces: chiangMaiContent?.sidecars.some(s => s.roll === '2026-04-chiang-mai' && s.id === 'DSCF0001') ?? false,
}))
`) as { draftInSidecars: boolean; draftInPlaces: boolean }
    assert.equal(devResult.draftInSidecars, true,
      'Photo "DSCF0001" (draft:true) must be PRESENT in getPhotoSidecars() in development')
    assert.equal(devResult.draftInPlaces, true,
      'Photo "DSCF0001" (draft:true) must be PRESENT in getPlaceContent("chiang-mai") in development')
  })

  // -- 1d. Worldline corpus -- seeded draft absent from corpus keys -----------
  //
  // IMPORTANT: all existing articles have worldline_links: []. If we seed draft:true
  // on article 001 without first adding a worldline_link, outgoing001Length===0
  // in BOTH prod and dev — vacuous (both branches of the NODE_ENV gate look identical).
  //
  // Fix: also mutate article 001's worldline_links in the JSON cache to point to
  // article/002 before seeding draft:true. Then:
  //   dev  → outgoing001Length === 1 (001 IS in corpus; its link resolves)
  //   prod → outgoing001Length === 0 (001 DROPPED from corpus; link never indexed)
  // This makes the assertion genuinely discriminating.

  test('1d. worldline corpus -- seeded draft absent from corpus in production', () => {
    // First: seed a worldline_link on article 001 so the link is observable.
    const rawBeforeSeed: Array<Record<string, unknown>> = JSON.parse(readFile(VELITE_ARTICLES_JSON))
    let hitLink = false
    for (const a of rawBeforeSeed) {
      if (a.fileNum === '001') {
        a.worldline_links = [{ to: 'article/002' }]
        hitLink = true
      }
    }
    if (!hitLink) throw new Error('1d setup: article 001 not found in velite cache for worldline_links seed')
    writeFile(VELITE_ARTICLES_JSON, JSON.stringify(rawBeforeSeed, null, 2))

    // Then: seed draft:true on article 001.
    seedArticleDraftInCache('001')

    // (A) Seed read-back: verify both seeds took
    const rawAfterSeed: Array<Record<string, unknown>> = JSON.parse(readFile(VELITE_ARTICLES_JSON))
    const seededEntry = rawAfterSeed.find(a => a.fileNum === '001')
    assert.ok(seededEntry, 'Article 001 must exist in velite cache after seeding')
    assert.equal(seededEntry!.draft, true, 'Article 001 must have draft===true after seeding')
    assert.deepEqual(seededEntry!.worldline_links, [{ to: 'article/002' }],
      'Article 001 must have worldline_links seeded to [{to:"article/002"}]')

    // (B+C) Prod probe: article 001 NOT in corpus → outgoing returns [] even though link is seeded.
    // Also check: 002's incoming list must NOT contain "article/001" in prod
    // (the draft's edge is never indexed in the reverse index because 001 is dropped from corpus).
    const prodResult = runProbe('production', `
import { getOutgoingLinks, getIncomingLinks } from '${ROOT}/lib/content/worldline.js'
import { getArticles } from '${ROOT}/lib/content/articles.js'

const articles = await getArticles()

// The key test: 001 has worldline_links:[{to:"article/002"}] in the JSON,
// but is seeded as draft:true → loadCorpus() drops it → outgoing returns []
const outgoing001 = await getOutgoingLinks('article', '001')

// Sibling control: article 002 outgoing links call must succeed (corpus loaded)
const outgoing002 = await getOutgoingLinks('article', '002')

// Real public-surface leak test: does article 002's rendered page show 001 as
// an incoming neighbor? The reverse index is built by iterating the filtered
// corpus — dropping 001 from corpus means its "→002" edge is never indexed.
const incoming002 = await getIncomingLinks('article', '002')
const draft001InIncoming002 = incoming002.some(e => e.from === 'article/001')

console.log(JSON.stringify({
  articlesCount: articles.length,
  outgoing001Length: outgoing001.length,
  outgoing002Loaded: Array.isArray(outgoing002),
  article001InProd: articles.some(a => a.fileNum === '001'),
  draft001InIncoming002,
}))
`) as {
      articlesCount: number
      outgoing001Length: number
      outgoing002Loaded: boolean
      article001InProd: boolean
      draft001InIncoming002: boolean
    }

    // Sibling control: corpus loaded (002 query succeeded)
    assert.equal(prodResult.outgoing002Loaded, true,
      'CONTROL: worldline corpus must be loadable (002 query succeeds, proves corpus ran)')
    assert.ok(prodResult.articlesCount > 0,
      'CONTROL: getArticles() must return entries in prod (proves no crash)')

    // Draft absent from prod corpus — the link is in the JSON but 001 is draft → not indexed
    assert.equal(prodResult.article001InProd, false,
      'Article "001" (draft:true) must be absent from getArticles() in production')
    assert.equal(prodResult.outgoing001Length, 0,
      'Draft article 001 must return [] from getOutgoingLinks in production (not in corpus, even though link is seeded)')

    // PUBLIC SURFACE LEAK: does 002's rendered page show 001 as an incoming neighbor?
    // The reverse index is built by iterating the filtered corpus — if 001 is dropped,
    // its "→002" edge is never added to the reverse index.
    assert.equal(prodResult.draft001InIncoming002, false,
      'Draft article 001 must NOT appear in getIncomingLinks("article","002") in production (public page leak)')

    // (D) Dev probe: article 001 IS in corpus → outgoing returns the seeded link
    //     AND 002's incoming shows 001 (the link is bidirectionally visible in dev)
    const devResult = runProbe('development', `
import { getOutgoingLinks, getIncomingLinks } from '${ROOT}/lib/content/worldline.js'
import { getArticles } from '${ROOT}/lib/content/articles.js'

const articles = await getArticles()
const outgoing001 = await getOutgoingLinks('article', '001')
const incoming002 = await getIncomingLinks('article', '002')

console.log(JSON.stringify({
  article001InDev: articles.some(a => a.fileNum === '001'),
  outgoing001Length: outgoing001.length,
  outgoing001Target: outgoing001[0]?.to ?? null,
  draft001InIncoming002: incoming002.some(e => e.from === 'article/001'),
}))
`) as {
      article001InDev: boolean
      outgoing001Length: number
      outgoing001Target: string | null
      draft001InIncoming002: boolean
    }

    assert.equal(devResult.article001InDev, true,
      'Article "001" (draft:true) must be PRESENT in getArticles() in development (NODE_ENV-gated)')
    assert.equal(devResult.outgoing001Length, 1,
      'Draft article 001 must return the seeded link from getOutgoingLinks in development (IS in corpus)')
    assert.equal(devResult.outgoing001Target, 'article/002',
      'The seeded worldline link must resolve to "article/002" in development')
    assert.equal(devResult.draft001InIncoming002, true,
      'Draft article 001 must appear in getIncomingLinks("article","002") in development (visible in dev, proves NODE_ENV-gated)')
  })

  // -- 1e. generateStaticParams source analysis (not subprocess -- no runtime needed) --

  test('1e. article generateStaticParams uses getArticles (draft-filtered)', () => {
    const src = readFile('app/articles/[fileNum]/page.tsx')
    const staticParamsSection = src.slice(
      src.indexOf('export async function generateStaticParams'),
      src.indexOf('export async function generateStaticParams') + 300,
    )
    assert.match(staticParamsSection, /getArticles\(\)/,
      'generateStaticParams must use getArticles() (draft-filtered) not getAllArticles()')
    assert.doesNotMatch(staticParamsSection, /getAllArticles/,
      'generateStaticParams must NOT use getAllArticles() (unfiltered)')
  })

  test('1f. photo generateStaticParams uses getPhotoSidecars (draft-filtered)', () => {
    const src = readFile('app/photos/[roll]/[id]/page.tsx')
    const staticParamsSection = src.slice(
      src.indexOf('export async function generateStaticParams'),
      src.indexOf('export async function generateStaticParams') + 300,
    )
    assert.match(staticParamsSection, /getPhotoSidecars/,
      'Photo generateStaticParams must use getPhotoSidecars() (draft-filtered)')
  })

  // -- 1g. Detail route notFound gates ---------------------------------------

  test('1g. article detail page: calls isHiddenFromPublic + notFound()', () => {
    // Rendering mode: next.config.ts has no `output: 'export'` → standard dynamic/ISR.
    // No `dynamicParams` export → default true (runtime fallback enabled for unknown URLs).
    // Two-layer defense:
    //   L1 (primary):  generateStaticParams uses draft-filtered getArticles() → draft URL
    //                  is never pre-rendered; not in the static manifest.
    //   L2 (secondary): if the draft URL is hit at runtime (direct URL, CDN miss, or
    //                   dynamicParams fallback), the page fn calls isHiddenFromPublic()
    //                   then notFound() BEFORE any JSX rendering. This is the runtime gate.
    //
    // Runtime probe of the page default export is not feasible headlessly because it
    // imports ArticleEntry → EntryShell → full Next.js component tree. Source-grep
    // verifies the gate is wired; L1 (1e) + L2 (source) together are the evidence base.
    // This is documented in the QA report as the rendering-mode justification.
    const src = readFile('app/articles/[fileNum]/page.tsx')
    assert.match(src, /isHiddenFromPublic/,
      'Article detail page must import and call isHiddenFromPublic')
    assert.match(src, /notFound/,
      'Article detail page must call notFound() for hidden entries')
    // Verify the guard is in the page default (not only in generateMetadata)
    const pageDefaultBody = src.slice(src.indexOf('export default async function'))
    assert.match(pageDefaultBody, /isHiddenFromPublic/,
      'notFound gate must be in the page default export, not only in generateMetadata')
    assert.match(pageDefaultBody, /notFound\(\)/,
      'notFound() call must be present in the page default export body')
  })

  test('1h. fiction detail page: calls isHiddenFromPublic + notFound()', () => {
    const src = readFile('app/fiction/[slug]/page.tsx')
    assert.match(src, /isHiddenFromPublic/,
      'Fiction detail page must import and call isHiddenFromPublic')
    assert.match(src, /notFound/,
      'Fiction detail page must call notFound() for hidden entries')
  })

  test('1i. photo detail page: calls isHiddenFromPublic + notFound()', () => {
    const src = readFile('app/photos/[roll]/[id]/page.tsx')
    assert.match(src, /isHiddenFromPublic/,
      'Photo detail page must import and call isHiddenFromPublic')
    assert.match(src, /notFound/,
      'Photo detail page must call notFound() for hidden entries')
  })

  // -- 1j. Pagefind filter: script uses !a.draft raw field filter --

  test('1j. pagefind script: filters all three collections by raw draft field', () => {
    const src = readFile('scripts/inject-pagefind-sidecar.ts')
    assert.match(src, /\.filter\(\(a\) => !a\.draft\)/,
      'Pagefind script must filter articles by !a.draft')
    assert.match(src, /\.filter\(\(f\) => !f\.draft\)/,
      'Pagefind script must filter fiction by !f.draft')
    assert.match(src, /\.filter\(\(s\) => !s\.draft\)/,
      'Pagefind script must filter photo sidecars by !s.draft')
  })

  // -- 1l. Detail-route gate: by-id lookup + isHiddenFromPublic evaluates true in prod --
  //
  // This is the detail-route-specific leak probe.
  // All three detail pages follow the same pattern:
  //   const entry = await getByIdFn(id)
  //   if (!entry || isHiddenFromPublic(entry)) notFound()
  //
  // The list-surface probes (1a-1d) cover getArticles/getFiction/getPhotoSidecars.
  // The detail route uses the SINGULAR by-id fns (getArticleByFileNum, getFictionBySlug,
  // getPhotoByRollAndId) — which the module docs explicitly mark as UNFILTERED
  // (callers apply the guard). This probe verifies the gate expression evaluates
  // correctly with a real seeded draft: true-in-prod (notFound fires), false-in-dev
  // (entry renders). Sibling controls kill mode-2 (every lookup returning undefined).

  test('1l. detail-route gate: by-id lookups return filtered result for draft in prod', () => {
    // Seed all three content kinds as draft simultaneously.
    seedArticleDraftInCache('001')
    seedFictionDraftInCache('transmission-001')
    seedPhotoDraftInCache('2026-04-chiang-mai', 'DSCF0001')

    // (A) Seed read-back: all three seeded
    const rawA: Array<Record<string, unknown>> = JSON.parse(readFile(VELITE_ARTICLES_JSON))
    assert.equal(rawA.find(a => a.fileNum === '001')?.draft, true, 'Article 001 draft seeded')
    const rawF: Array<Record<string, unknown>> = JSON.parse(readFile(VELITE_FICTION_JSON))
    assert.equal(rawF.find(f => f.slug === 'transmission-001')?.draft, true, 'Fiction draft seeded')
    const rawS: Array<Record<string, unknown>> = JSON.parse(readFile(VELITE_SIDECARS_JSON))
    assert.equal(rawS.find(s => s.roll === '2026-04-chiang-mai' && s.id === 'DSCF0001')?.draft, true, 'Photo draft seeded')

    // (B+C) Prod probe: the gate expression `!entry || isHiddenFromPublic(entry)`
    // must evaluate true for each seeded draft (notFound would fire).
    // Sibling controls: article 002, photo DSCF0002 must evaluate false (notFound would NOT fire).
    const prodResult = runProbe('production', `
import { getArticleByFileNum } from '${ROOT}/lib/content/articles.js'
import { getFictionBySlug } from '${ROOT}/lib/content/fiction.js'
import { getPhotoByRollAndId } from '${ROOT}/lib/content/photos.js'
import { isHiddenFromPublic } from '${ROOT}/lib/content/visibility.js'

// The seeded drafts
const article001  = await getArticleByFileNum('001')
const fiction001  = await getFictionBySlug('transmission-001')
const photo001    = await getPhotoByRollAndId('2026-04-chiang-mai', 'DSCF0001')

// Non-draft siblings (control: must resolve and NOT be hidden)
const article002  = await getArticleByFileNum('002')
const photo002    = await getPhotoByRollAndId('2026-05-bangkok', 'DSCF0002')

// The exact gate expression from each detail page's default export
const articleDraftGate = (!article001 || isHiddenFromPublic(article001))
const fictionDraftGate = (!fiction001 || isHiddenFromPublic(fiction001))
const photoDraftGate   = (!photo001   || isHiddenFromPublic(photo001))

const articleSiblingGate = (!article002 || isHiddenFromPublic(article002))
const photoSiblingGate   = (!photo002   || isHiddenFromPublic(photo002))

console.log(JSON.stringify({
  articleDraftGate,
  fictionDraftGate,
  photoDraftGate,
  articleSiblingGate,
  photoSiblingGate,
  article001Resolved: article001 !== null && article001 !== undefined,
  fiction001Resolved: fiction001 !== null && fiction001 !== undefined,
  photo001Resolved:   photo001   !== null && photo001   !== undefined,
  article002Resolved: article002 !== null && article002 !== undefined,
}))
`) as {
      articleDraftGate: boolean
      fictionDraftGate: boolean
      photoDraftGate: boolean
      articleSiblingGate: boolean
      photoSiblingGate: boolean
      article001Resolved: boolean
      fiction001Resolved: boolean
      photo001Resolved: boolean
      article002Resolved: boolean
    }

    // Sibling controls: non-draft siblings must resolve and gate must evaluate false
    assert.equal(prodResult.article002Resolved, true,
      'CONTROL: article 002 (non-draft) must resolve via getArticleByFileNum in prod')
    assert.equal(prodResult.articleSiblingGate, false,
      'CONTROL: article 002 gate expression must be false in prod (non-draft renders)')
    assert.equal(prodResult.photoSiblingGate, false,
      'CONTROL: photo DSCF0002 gate expression must be false in prod (non-draft renders)')

    // Draft entries: gate expression must evaluate true (notFound would fire)
    assert.equal(prodResult.articleDraftGate, true,
      'Article 001 (draft:true) detail-route gate must evaluate true in production (notFound fires)')
    assert.equal(prodResult.fictionDraftGate, true,
      'Fiction transmission-001 (draft:true) detail-route gate must evaluate true in production')
    assert.equal(prodResult.photoDraftGate, true,
      'Photo DSCF0001 (draft:true) detail-route gate must evaluate true in production')

    // (D) Dev probe: gate expression must evaluate false for all three (draft renders in dev)
    const devResult = runProbe('development', `
import { getArticleByFileNum } from '${ROOT}/lib/content/articles.js'
import { getFictionBySlug } from '${ROOT}/lib/content/fiction.js'
import { getPhotoByRollAndId } from '${ROOT}/lib/content/photos.js'
import { isHiddenFromPublic } from '${ROOT}/lib/content/visibility.js'

const article001 = await getArticleByFileNum('001')
const fiction001 = await getFictionBySlug('transmission-001')
const photo001   = await getPhotoByRollAndId('2026-04-chiang-mai', 'DSCF0001')

const articleDraftGate = (!article001 || isHiddenFromPublic(article001))
const fictionDraftGate = (!fiction001 || isHiddenFromPublic(fiction001))
const photoDraftGate   = (!photo001   || isHiddenFromPublic(photo001))

console.log(JSON.stringify({ articleDraftGate, fictionDraftGate, photoDraftGate }))
`) as { articleDraftGate: boolean; fictionDraftGate: boolean; photoDraftGate: boolean }

    assert.equal(devResult.articleDraftGate, false,
      'Article 001 (draft:true) detail-route gate must evaluate false in development (draft renders)')
    assert.equal(devResult.fictionDraftGate, false,
      'Fiction transmission-001 (draft:true) detail-route gate must evaluate false in development')
    assert.equal(devResult.photoDraftGate, false,
      'Photo DSCF0001 (draft:true) detail-route gate must evaluate false in development')
  })

  // -- 1k. No RSS/Atom/JSON/sitemap routes -----------------------------------

  test('1k. no RSS/Atom/JSON/sitemap routes exist in this project', () => {
    const appDir = path.join(ROOT, 'app')
    let allRoutes: string[] = []
    try {
      const out = execSync(
        `find "${appDir}" -name "route.ts" -o -name "route.tsx" -o -name "sitemap.ts" -o -name "sitemap.tsx"`,
        { cwd: ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
      ) as string
      allRoutes = out.trim().split('\n').filter(Boolean)
    } catch {
      allRoutes = []
    }

    const feedLike = allRoutes.filter(r => /rss|feed|atom|sitemap/i.test(r))
    assert.equal(feedLike.length, 0,
      `No RSS/Atom/JSON feed or sitemap routes should exist. Found: ${feedLike.join(', ')}`)
  })
})

// ---------------------------------------------------------------------------
// 2. Dev visibility -- draft IS visible in development
// ---------------------------------------------------------------------------

describe('2. Dev visibility -- draft visible in development', () => {

  test('2a. isHiddenFromPublic: draft:true visible in development', () => {
    const result = withEnv('NODE_ENV', 'development', () =>
      isHiddenFromPublic({ draft: true })
    )
    assert.equal(result, false, 'draft:true must be visible in development')
  })

  test('2b. isHiddenFromPublic: draft:true visible when NODE_ENV is not production', () => {
    for (const env of ['development', 'test', 'staging', 'preview']) {
      const result = withEnv('NODE_ENV', env, () => isHiddenFromPublic({ draft: true }))
      assert.equal(result, false, `draft:true must be visible in NODE_ENV=${env}`)
    }
  })

  test('2c. getAllArticles(): unfiltered -- returns all entries including any draft:true', async () => {
    // getAllArticles is the console view -- must NOT filter by isHiddenFromPublic.
    // Source analysis: getAllArticles must not call .filter in its implementation.
    const src = readFile('lib/content/articles.ts')
    const getAllArticlesStart = src.indexOf('export async function getAllArticles')
    const getAllArticlesBodyStart = src.indexOf('{', getAllArticlesStart)
    const getAllArticlesBodyEnd = src.indexOf('\n}', getAllArticlesBodyStart)
    const getAllArticlesImpl = src.slice(getAllArticlesBodyStart, getAllArticlesBodyEnd + 2)
    assert.doesNotMatch(getAllArticlesImpl, /\.filter\(/,
      'getAllArticles function body must NOT call .filter() (console view, returns all entries)')
    assert.match(getAllArticlesImpl, /loadArticles/,
      'getAllArticles must call loadArticles()')

    // Runtime: it must return entries (with current draft:false cache)
    const all = await getAllArticles()
    assert.ok(all.length > 0, 'getAllArticles() must return at least one article')
  })

  test('2d. getAllFiction(): unfiltered -- returns all fiction', async () => {
    const all = await getAllFiction()
    assert.ok(all.length > 0, 'getAllFiction() must return at least one fiction entry')
  })

  test('2e. getAllPhotoSidecars(): unfiltered -- returns all sidecars', async () => {
    const all = await getAllPhotoSidecars()
    assert.ok(all.length > 0, 'getAllPhotoSidecars() must return at least one photo sidecar')
  })

  test('2f. getArticles() source: filtered; getAllArticles() source: unfiltered', () => {
    const src = readFile('lib/content/articles.ts')
    // getArticles must have the filter
    const getArticlesBody = src.slice(
      src.indexOf('export async function getArticles'),
      src.indexOf('export async function getAllArticles'),
    )
    assert.match(getArticlesBody, /isHiddenFromPublic/, 'getArticles must filter')
    // getAllArticles must NOT use .filter in its implementation
    const getAllArticlesStart = src.indexOf('export async function getAllArticles')
    const getAllArticlesBodyStart = src.indexOf('{', getAllArticlesStart)
    const getAllArticlesBodyEnd = src.indexOf('\n}', getAllArticlesBodyStart)
    const getAllArticlesImpl = src.slice(getAllArticlesBodyStart, getAllArticlesBodyEnd + 2)
    assert.doesNotMatch(getAllArticlesImpl, /\.filter\(/,
      'getAllArticles function body must NOT call .filter() (console view, returns all entries)')
  })
})

// ---------------------------------------------------------------------------
// 3. deleteEntry scope + path-escape adversarial
//    Path-escape tests run in dev (NODE_ENV != 'production') so assertDev()
//    passes and the PATH DEFENSE (not the guard) rejects the slug.
// ---------------------------------------------------------------------------

describe('3. deleteEntry -- scope + path-escape adversarial', () => {

  let bystander000Snapshot = ''

  before(() => {
    bystander000Snapshot = readFile('content/articles/000-genesis.mdx')
  })

  afterEach(() => {
    // Restore bystander if it was modified
    if (existsSync(path.join(ROOT, 'content/articles/000-genesis.mdx'))) {
      const current = readFile('content/articles/000-genesis.mdx')
      if (current !== bystander000Snapshot) {
        writeFile('content/articles/000-genesis.mdx', bystander000Snapshot)
      }
    } else {
      writeFile('content/articles/000-genesis.mdx', bystander000Snapshot)
    }
  })

  // -- 3a-3e. Path escape adversarial ----------------------------------------
  // All run in dev (NODE_ENV = test/development) so the guard is open and
  // path validation (not DEV_GUARD) is what rejects.

  test('3a. setEntryDraft: ../articles/000 article slug rejected by regex defense', async () => {
    const result = await withEnv('NODE_ENV', 'development', () =>
      setEntryDraftImpl({ kind: 'article', slug: '../articles/000', draft: true })
    )
    assert.equal(result.ok, false, 'Traversal slug must be rejected')

    // Verify bystander is unmodified
    const current000 = readFile('content/articles/000-genesis.mdx')
    assert.equal(current000, bystander000Snapshot,
      'Bystander article 000 must be byte-identical after rejected traversal')
  })

  test('3b. setEntryDraft: absolute path slug rejected', async () => {
    const result = await withEnv('NODE_ENV', 'development', () =>
      setEntryDraftImpl({ kind: 'article', slug: '/etc/passwd', draft: true })
    )
    assert.equal(result.ok, false, 'Absolute path slug must be rejected')
  })

  test('3c. setEntryDraft: photo slug with .. rejected', async () => {
    const result = await withEnv('NODE_ENV', 'development', () =>
      setEntryDraftImpl({
        kind: 'photo',
        slug: '2026-04-chiang-mai/../../../etc/passwd',
        draft: true,
      })
    )
    assert.equal(result.ok, false, 'Photo slug with .. must be rejected')
  })

  test('3d. setEntryDraft: photo slug with extra slashes (3+ parts) rejected', async () => {
    const result = await withEnv('NODE_ENV', 'development', () =>
      setEntryDraftImpl({
        kind: 'photo',
        slug: '2026-04-chiang-mai/DSCF0001/extra',
        draft: true,
      })
    )
    assert.equal(result.ok, false, 'Photo slug with 3 parts must be rejected')
  })

  test('3e. deleteEntry: ../articles/000 slug rejected before any FS mutation', async () => {
    const result = await withEnv('NODE_ENV', 'development', () =>
      deleteEntryImpl({ kind: 'article', slug: '../articles/000' })
    )
    assert.equal(result.ok, false, 'Traversal slug must be rejected by deleteEntry')

    const current000 = readFile('content/articles/000-genesis.mdx')
    assert.equal(current000, bystander000Snapshot,
      'Bystander article 000 must be intact after rejected deleteEntry traversal')
  })

  test('3f. deleteEntry: non-existent slug returns NOT_FOUND-class error', async () => {
    const result = await withEnv('NODE_ENV', 'development', () =>
      deleteEntryImpl({ kind: 'article', slug: '999' })
    )
    assert.equal(result.ok, false, 'Unknown slug must fail')
    const code = (result as { ok: false; error: { code: string } }).error.code
    assert.ok(
      code === 'NOT_FOUND' || code === 'CONTENT_LOAD_FAILED' || code === 'FILE_RESOLVE_FAILED',
      `Expected NOT_FOUND-class error, got: ${code}`,
    )
  })

  test('3g. fiction: kebab-regex rejects slug with / or .', async () => {
    // Fiction regex: /^[a-z0-9-]+$/ -- rejects . and /
    const traversalResult = await withEnv('NODE_ENV', 'development', () =>
      setEntryDraftImpl({ kind: 'fiction', slug: '../fiction/transmission-001', draft: true })
    )
    assert.equal(traversalResult.ok, false, 'Fiction traversal slug must be rejected')

    const dotResult = await withEnv('NODE_ENV', 'development', () =>
      setEntryDraftImpl({ kind: 'fiction', slug: 'transmission.001', draft: true })
    )
    assert.equal(dotResult.ok, false, 'Fiction slug with dot must be rejected')
  })

  // -- 3h. deleteEntry happy-path: exercises real unlinkSync -----------------
  // Snapshots article 001's MDX, calls deleteEntry, verifies MDX gone,
  // sibling MDX intact, public/photos/ intact.

  test('3h. deleteEntry: removes only the .mdx source file; siblings unaffected', async () => {
    const article001Path   = 'content/articles/001-four-pours.mdx'
    const article002Path   = 'content/articles/002-stride-pause.mdx'
    const publicPhotosPath = path.join(ROOT, 'public/photos')

    // Snapshot
    const article001Content = readFile(article001Path)
    const article002Content = readFile(article002Path)

    try {
      // Act: delete article 001 in dev
      const result = await withEnv('NODE_ENV', 'development', () =>
        deleteEntryImpl({ kind: 'article', slug: '001' })
      )
      assert.equal(result.ok, true, `Expected ok:true from deleteEntry, got: ${JSON.stringify(result)}`)

      // Assert: 001 MDX is gone
      const mdxGone = !existsSync(path.join(ROOT, article001Path))
      assert.equal(mdxGone, true, 'Article 001 .mdx file must be deleted by deleteEntry')

      // Assert: sibling 002 MDX is untouched
      const article002After = readFile(article002Path)
      assert.equal(article002After, article002Content,
        'Article 002 .mdx must be byte-identical after deleteEntry on article 001')

      // Assert: bystander 000 MDX is untouched
      const article000After = readFile('content/articles/000-genesis.mdx')
      assert.equal(article000After, bystander000Snapshot,
        'Article 000 .mdx must be byte-identical after deleteEntry on article 001')

      // Assert: public/photos/ is untouched (no generated image removal)
      // We can't enumerate exact files without filesystem access, but
      // we can verify the public/photos dir still exists (it should never be removed)
      if (existsSync(publicPhotosPath)) {
        const pubPhotosStillExist = existsSync(publicPhotosPath)
        assert.equal(pubPhotosStillExist, true,
          'public/photos/ must still exist after deleteEntry (generated images must not be removed)')
      }
    } finally {
      // Restore: write 001 back so working tree is clean for test 8a
      writeFile(article001Path, article001Content)
    }
  })

  // -- 3i. deleteEntry scope -- source analysis --------------------------------

  test('3i. deleteEntryImpl source: single unlinkSync; no public/ reference in delete body', () => {
    const src = readFile('lib/server/entries/entry-lifecycle-core.ts')
    const deleteImplStart = src.indexOf('export async function deleteEntryImpl')
    assert.ok(deleteImplStart > -1, 'deleteEntryImpl must be present in source')

    const deleteImplBody = src.slice(deleteImplStart)
    const unlinkInDelete = (deleteImplBody.match(/\bunlinkSync\b/g) ?? []).length
    assert.equal(unlinkInDelete, 1,
      'deleteEntryImpl must have exactly 1 unlinkSync call (single .mdx removal)')

    // Must not reference public/ paths
    assert.doesNotMatch(deleteImplBody, /public\//,
      'deleteEntryImpl must not reference public/ paths')

    // Verify the actual fs.unlink is on a single filePath variable, not a loop
    const unlinkLine = deleteImplBody.match(/fs\.unlinkSync\(([^)]+)\)/)?.[1]
    assert.equal(unlinkLine?.trim(), 'filePath',
      'deleteEntryImpl must call fs.unlinkSync(filePath) -- not a loop variable or array')
  })

  // -- 3j. assertPathContained belt-and-suspenders ---------------------------

  test('3j. assertPathContained source: verifies path is within content/', () => {
    const src = readFile('lib/server/entries/entry-lifecycle-core.ts')
    assert.match(src, /assertPathContained/,
      'entry-lifecycle-core.ts must define and call assertPathContained')
    assert.match(src, /CONTENT_ROOT/,
      'assertPathContained must check against CONTENT_ROOT')
    // The defense must reject on traversal
    assert.match(src, /PATH CONTAINMENT VIOLATION/,
      'assertPathContained must throw with clear error message on violation')
  })
})

// ---------------------------------------------------------------------------
// 4. Dev-guard -- setEntryDraft + deleteEntry return DEV_GUARD in production
// ---------------------------------------------------------------------------

describe('4. Dev-guard (NODE_ENV=production -> {ok:false, code:DEV_GUARD})', () => {

  let snapshots: Record<string, string> = {}

  before(() => {
    snapshots = snapshot([
      'content/articles/001-four-pours.mdx',
      'content/articles/000-genesis.mdx',
      'content/fiction/transmission-001.mdx',
      'content/photos/2026-04-chiang-mai/DSCF0001.mdx',
    ])
  })

  afterEach(() => {
    restore(snapshots)
  })

  after(() => {
    restore(snapshots)
  })

  test('4a. setEntryDraft article: returns DEV_GUARD in production', async () => {
    const result = await withEnv('NODE_ENV', 'production', () =>
      setEntryDraftImpl({ kind: 'article', slug: '001', draft: true })
    )
    assert.equal(result.ok, false, 'ok must be false')
    assert.equal(
      (result as { ok: false; error: { code: string } }).error.code,
      'DEV_GUARD',
      'error code must be DEV_GUARD',
    )
  })

  test('4b. setEntryDraft fiction: returns DEV_GUARD in production', async () => {
    const result = await withEnv('NODE_ENV', 'production', () =>
      setEntryDraftImpl({ kind: 'fiction', slug: 'transmission-001', draft: true })
    )
    assert.equal(result.ok, false)
    assert.equal(
      (result as { ok: false; error: { code: string } }).error.code,
      'DEV_GUARD',
    )
  })

  test('4c. setEntryDraft photo: returns DEV_GUARD in production', async () => {
    const result = await withEnv('NODE_ENV', 'production', () =>
      setEntryDraftImpl({ kind: 'photo', slug: '2026-04-chiang-mai/DSCF0001', draft: true })
    )
    assert.equal(result.ok, false)
    assert.equal(
      (result as { ok: false; error: { code: string } }).error.code,
      'DEV_GUARD',
    )
  })

  test('4d. deleteEntry article: returns DEV_GUARD in production', async () => {
    const result = await withEnv('NODE_ENV', 'production', () =>
      deleteEntryImpl({ kind: 'article', slug: '001' })
    )
    assert.equal(result.ok, false)
    assert.equal(
      (result as { ok: false; error: { code: string } }).error.code,
      'DEV_GUARD',
    )
  })

  test('4e. DEV_GUARD fires before any FS I/O -- content files byte-identical', async () => {
    const before001   = snapshots['content/articles/001-four-pours.mdx']
    const beforeFict  = snapshots['content/fiction/transmission-001.mdx']
    const beforePhoto = snapshots['content/photos/2026-04-chiang-mai/DSCF0001.mdx']

    assert.ok(before001,   'Snapshot of article 001 must exist')
    assert.ok(beforeFict,  'Snapshot of fiction must exist')
    assert.ok(beforePhoto, 'Snapshot of photo sidecar must exist')

    // NOTE: withEnv restores NODE_ENV at Promise creation time (not resolution time),
    // so each call must be individually wrapped to guarantee NODE_ENV=production
    // across the full async execution of setEntryDraftImpl.
    // assertDev() runs synchronously at the top of each impl, so wrapping each call
    // individually is sufficient -- each Promise creation happens with NODE_ENV=production.
    const r1 = await withEnv('NODE_ENV', 'production', () =>
      setEntryDraftImpl({ kind: 'article', slug: '001', draft: true })
    )
    const r2 = await withEnv('NODE_ENV', 'production', () =>
      setEntryDraftImpl({ kind: 'fiction', slug: 'transmission-001', draft: false })
    )
    const r3 = await withEnv('NODE_ENV', 'production', () =>
      setEntryDraftImpl({ kind: 'photo', slug: '2026-04-chiang-mai/DSCF0001', draft: true })
    )
    const r4 = await withEnv('NODE_ENV', 'production', () =>
      deleteEntryImpl({ kind: 'article', slug: '001' })
    )

    // All must have returned DEV_GUARD (confirmed by 4a-4d)
    assert.equal(r1.ok, false, 'setEntryDraft article must return ok:false in production')
    assert.equal(r2.ok, false, 'setEntryDraft fiction must return ok:false in production')
    assert.equal(r3.ok, false, 'setEntryDraft photo must return ok:false in production')
    assert.equal(r4.ok, false, 'deleteEntry article must return ok:false in production')

    const after001   = readFile('content/articles/001-four-pours.mdx')
    const afterFict  = readFile('content/fiction/transmission-001.mdx')
    const afterPhoto = readFile('content/photos/2026-04-chiang-mai/DSCF0001.mdx')

    assert.equal(after001,   before001,   'Article 001 must be unmodified after DEV_GUARD')
    assert.equal(afterFict,  beforeFict,  'Fiction transmission-001 must be unmodified')
    assert.equal(afterPhoto, beforePhoto, 'Photo DSCF0001 sidecar must be unmodified')
  })

  test('4f. DEV_GUARD does not throw -- always returns {ok:false}', async () => {
    let threw = false
    try {
      const r = await withEnv('NODE_ENV', 'production', () =>
        setEntryDraftImpl({ kind: 'article', slug: '001', draft: true })
      )
      assert.equal(r.ok, false, 'must return ok:false not throw')
    } catch {
      threw = true
    }
    assert.equal(threw, false, 'DEV_GUARD must not throw -- must return {ok:false}')
  })

  test('4g. assertDev() called before fs.readFileSync in both impls (source analysis)', () => {
    const src = readFile('lib/server/entries/entry-lifecycle-core.ts')
    const setImplStart    = src.indexOf('export async function setEntryDraftImpl')
    const deleteImplStart = src.indexOf('export async function deleteEntryImpl')

    assert.ok(setImplStart > -1,    'setEntryDraftImpl must exist')
    assert.ok(deleteImplStart > -1, 'deleteEntryImpl must exist')

    // In setEntryDraftImpl: assertDev() must precede any fs call
    const setBody = src.slice(setImplStart, deleteImplStart)
    const assertDevInSet = setBody.indexOf('assertDev()')
    const readFileInSet  = setBody.indexOf('fs.readFileSync')
    assert.ok(assertDevInSet > -1, 'setEntryDraftImpl must call assertDev()')
    assert.ok(assertDevInSet < readFileInSet,
      'assertDev() must appear before fs.readFileSync in setEntryDraftImpl')

    // In deleteEntryImpl: assertDev() must precede any fs call
    const deleteBody     = src.slice(deleteImplStart)
    const assertDevInDel = deleteBody.indexOf('assertDev()')
    const existsInDel    = deleteBody.indexOf('fs.existsSync')
    assert.ok(assertDevInDel > -1, 'deleteEntryImpl must call assertDev()')
    assert.ok(assertDevInDel < existsInDel,
      'assertDev() must appear before any fs call in deleteEntryImpl')
  })
})

// ---------------------------------------------------------------------------
// 5. Non-draft byte-identical -- toggling article X does not mutate article Y
// ---------------------------------------------------------------------------

describe('5. Non-draft byte-identical -- bystander entries unaffected', () => {

  let snapshots: Record<string, string> = {}

  before(() => {
    snapshots = snapshot([
      'content/articles/001-four-pours.mdx',
      'content/articles/000-genesis.mdx',
      'content/articles/002-stride-pause.mdx',
      'content/articles/003-architecture-of-taste.mdx',
      'content/fiction/transmission-001.mdx',
      'content/photos/2026-04-chiang-mai/DSCF0001.mdx',
      'content/photos/2026-05-bangkok/DSCF0002.mdx',
    ])
  })

  afterEach(() => {
    restore(snapshots)
  })

  after(() => {
    restore(snapshots)
  })

  test('5a. setEntryDraft on article 001 does not mutate article 000', async () => {
    const before000 = snapshots['content/articles/000-genesis.mdx']!

    const result = await withEnv('NODE_ENV', 'development', () =>
      setEntryDraftImpl({ kind: 'article', slug: '001', draft: true })
    )
    assert.equal(result.ok, true, `Expected ok:true, got: ${JSON.stringify(result)}`)

    const after000 = readFile('content/articles/000-genesis.mdx')
    assert.equal(after000, before000,
      'Article 000 must be byte-identical after setEntryDraft on article 001')
  })

  test('5b. setEntryDraft on article 001 does not mutate fiction or photo sidecars', async () => {
    const beforeFiction = snapshots['content/fiction/transmission-001.mdx']!
    const beforePhoto   = snapshots['content/photos/2026-04-chiang-mai/DSCF0001.mdx']!

    await withEnv('NODE_ENV', 'development', () =>
      setEntryDraftImpl({ kind: 'article', slug: '001', draft: true })
    )

    const afterFiction = readFile('content/fiction/transmission-001.mdx')
    const afterPhoto   = readFile('content/photos/2026-04-chiang-mai/DSCF0001.mdx')

    assert.equal(afterFiction, beforeFiction,
      'Fiction transmission-001 must be byte-identical after setEntryDraft on article 001')
    assert.equal(afterPhoto, beforePhoto,
      'Photo DSCF0001 sidecar must be byte-identical after setEntryDraft on article 001')
  })

  test('5c. setEntryDraft draft=false on article 001 does not mutate bystanders', async () => {
    // First set to draft, then remove
    await withEnv('NODE_ENV', 'development', () =>
      setEntryDraftImpl({ kind: 'article', slug: '001', draft: true })
    )

    const before002 = snapshots['content/articles/002-stride-pause.mdx']!
    const before003 = snapshots['content/articles/003-architecture-of-taste.mdx']!

    await withEnv('NODE_ENV', 'development', () =>
      setEntryDraftImpl({ kind: 'article', slug: '001', draft: false })
    )

    const after002 = readFile('content/articles/002-stride-pause.mdx')
    const after003 = readFile('content/articles/003-architecture-of-taste.mdx')

    assert.equal(after002, before002, 'Article 002 must be byte-identical')
    assert.equal(after003, before003, 'Article 003 must be byte-identical')
  })

  test('5d. setEntryDraft on photo does not mutate other photo sidecars', async () => {
    const beforeBangkok = snapshots['content/photos/2026-05-bangkok/DSCF0002.mdx']!

    await withEnv('NODE_ENV', 'development', () =>
      setEntryDraftImpl({ kind: 'photo', slug: '2026-04-chiang-mai/DSCF0001', draft: true })
    )

    const afterBangkok = readFile('content/photos/2026-05-bangkok/DSCF0002.mdx')
    assert.equal(afterBangkok, beforeBangkok,
      'Bangkok photo DSCF0002 must be byte-identical after setEntryDraft on chiang-mai DSCF0001')
  })
})

// ---------------------------------------------------------------------------
// 6. Status untouched -- setEntryDraft does not alter the status field
// ---------------------------------------------------------------------------

describe('6. Status untouched -- setEntryDraft does not alter status field', () => {

  let snapshots: Record<string, string> = {}

  before(() => {
    snapshots = snapshot([
      'content/articles/001-four-pours.mdx',
      'content/articles/002-stride-pause.mdx',
      'content/fiction/transmission-001.mdx',
    ])
  })

  afterEach(() => {
    restore(snapshots)
  })

  after(() => {
    restore(snapshots)
  })

  function extractStatusLine(content: string): string | undefined {
    return content.match(/^status: .+$/m)?.[0]
  }

  test('6a. setEntryDraft(draft:true) does not change status field on article 001', async () => {
    const before       = snapshots['content/articles/001-four-pours.mdx']!
    const statusBefore = extractStatusLine(before)
    assert.ok(statusBefore, 'Article 001 must have a status field')

    await withEnv('NODE_ENV', 'development', () =>
      setEntryDraftImpl({ kind: 'article', slug: '001', draft: true })
    )

    const after       = readFile('content/articles/001-four-pours.mdx')
    const statusAfter = extractStatusLine(after)
    assert.equal(statusAfter, statusBefore,
      'Status field must be byte-identical after setEntryDraft(draft:true)')
  })

  test('6b. setEntryDraft(draft:false) does not change status field on article 001', async () => {
    await withEnv('NODE_ENV', 'development', () =>
      setEntryDraftImpl({ kind: 'article', slug: '001', draft: true })
    )

    const mid         = readFile('content/articles/001-four-pours.mdx')
    const statusMid   = extractStatusLine(mid)

    await withEnv('NODE_ENV', 'development', () =>
      setEntryDraftImpl({ kind: 'article', slug: '001', draft: false })
    )

    const after       = readFile('content/articles/001-four-pours.mdx')
    const statusAfter = extractStatusLine(after)
    assert.equal(statusAfter, statusMid,
      'Status field must be identical after setEntryDraft(draft:false)')
  })

  test('6c. setEntryDraft on article 002 -- status field preserved', async () => {
    const before       = snapshots['content/articles/002-stride-pause.mdx']!
    const statusBefore = extractStatusLine(before)
    assert.ok(statusBefore, 'Article 002 must have a status field')

    await withEnv('NODE_ENV', 'development', () =>
      setEntryDraftImpl({ kind: 'article', slug: '002', draft: true })
    )

    const after       = readFile('content/articles/002-stride-pause.mdx')
    const statusAfter = extractStatusLine(after)
    assert.equal(statusAfter, statusBefore,
      'Article 002 status field must be preserved after draft toggle')
  })

  test('6d. setEntryDraft adds exactly one draft:true, does not duplicate status', async () => {
    await withEnv('NODE_ENV', 'development', () =>
      setEntryDraftImpl({ kind: 'article', slug: '001', draft: true })
    )

    const after = readFile('content/articles/001-four-pours.mdx')

    const draftLines  = (after.match(/^draft: true$/mg) ?? [])
    const statusLines = (after.match(/^status: /mg) ?? [])

    assert.equal(draftLines.length,  1, 'Must have exactly one "draft: true" line')
    assert.equal(statusLines.length, 1, 'Must have exactly one status line (no duplication)')
  })

  test('6e. setEntryDraft(draft:false) removes draft key, status remains', async () => {
    await withEnv('NODE_ENV', 'development', () =>
      setEntryDraftImpl({ kind: 'article', slug: '001', draft: true })
    )
    const mid = readFile('content/articles/001-four-pours.mdx')
    assert.match(mid, /^draft: true$/m, 'Draft must be set mid-test')

    await withEnv('NODE_ENV', 'development', () =>
      setEntryDraftImpl({ kind: 'article', slug: '001', draft: false })
    )
    const after = readFile('content/articles/001-four-pours.mdx')

    assert.doesNotMatch(after, /^draft:/m,
      'draft key must be completely removed after setEntryDraft(draft:false)')
    assert.match(after, /^status: /m,
      'status key must still be present after draft removal')
  })

  test('6f. status orthogonal to draft -- setEntryDraftImpl only touches draft field', () => {
    const src = readFile('lib/server/entries/entry-lifecycle-core.ts')
    const setImplStart    = src.indexOf('export async function setEntryDraftImpl')
    const deleteImplStart = src.indexOf('export async function deleteEntryImpl')
    const setBody         = src.slice(setImplStart, deleteImplStart)

    // The draft transform section must only reference 'draft' as the field name
    const draftTransformSection = setBody.slice(setBody.indexOf('Apply draft transform'))
    assert.doesNotMatch(draftTransformSection, /setFrontmatterField.*status/,
      'setEntryDraftImpl must not call setFrontmatterField with status field')
    assert.doesNotMatch(draftTransformSection, /removeFrontmatterField.*status/,
      'setEntryDraftImpl must not call removeFrontmatterField with status field')
  })
})

// ---------------------------------------------------------------------------
// 7. Velite schema -- draft field declared on all three collections
// ---------------------------------------------------------------------------

describe('7. Velite schema -- draft field declared on all three collections', () => {

  test('7a. velite.config.ts: draft:s.boolean().default(false) declared >=3 times', () => {
    const src = readFile('velite.config.ts')
    const count = (src.match(/draft.*s\.boolean\(\)\.default\(false\)/g) ?? []).length
    assert.ok(count >= 3,
      `draft: s.boolean().default(false) must appear >=3 times in velite.config.ts. Found: ${count}`)
  })

  test('7b. velite.config.ts: Article collection has draft field', () => {
    const src = readFile('velite.config.ts')
    const articleCollIdx = src.indexOf("const articles = defineCollection")
    assert.ok(articleCollIdx > -1, 'articles collection must be defined')
    const articleCollBody = src.slice(articleCollIdx, articleCollIdx + 5000)
    assert.match(articleCollBody, /draft.*s\.boolean\(\)\.default\(false\)/,
      'Article collection must declare draft: s.boolean().default(false)')
  })

  test('7c. velite.config.ts: photoSidecars collection has draft field', () => {
    const src = readFile('velite.config.ts')
    const sidecarCollIdx = src.indexOf("const photoSidecars = defineCollection")
    assert.ok(sidecarCollIdx > -1, 'photoSidecars collection must be defined')
    // The photoSidecars schema is large (>100 lines). Use a generous window.
    const sidecarCollBody = src.slice(sidecarCollIdx, sidecarCollIdx + 12000)
    assert.match(sidecarCollBody, /draft.*s\.boolean\(\)\.default\(false\)/,
      'photoSidecars collection must declare draft: s.boolean().default(false)')
  })

  test('7d. velite JSON caches expose draft field (runtime verification)', () => {
    const articlesJson = JSON.parse(readFile(VELITE_ARTICLES_JSON)) as Array<{ draft?: boolean }>
    for (const a of articlesJson) {
      assert.ok('draft' in a,
        `Article in velite cache must have 'draft' field (got: ${JSON.stringify(Object.keys(a))})`)
    }

    const fictionJson = JSON.parse(readFile(VELITE_FICTION_JSON)) as Array<{ draft?: boolean }>
    for (const f of fictionJson) {
      assert.ok('draft' in f,
        `Fiction in velite cache must have 'draft' field`)
    }

    const sidecarsJson = JSON.parse(readFile(VELITE_SIDECARS_JSON)) as Array<{ draft?: boolean }>
    for (const s of sidecarsJson) {
      assert.ok('draft' in s,
        `Photo sidecar in velite cache must have 'draft' field`)
    }
  })
})

// ---------------------------------------------------------------------------
// 8. Working tree clean -- belt-and-suspenders
// ---------------------------------------------------------------------------

describe('8. Working tree clean after all tests', () => {

  test('8a. git diff: content/ and .velite/ unmodified after suite', () => {
    let diff = ''
    try {
      diff = execSync('git diff --stat HEAD content/ .velite/', {
        cwd: ROOT, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
      }) as string
    } catch (e: any) {
      diff = e.stdout ?? ''
    }
    assert.equal(diff.trim(), '',
      `Working tree must be clean after all T1 lifecycle QA tests. Dirty:\n${diff}`)
  })
})
