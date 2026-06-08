/**
 * tests/places-curation-ab-clear.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Article A→B transactional clear test.
 *
 * MUST be run in its own process (not together with places-curation-qa.test.ts)
 * because places.ts caches _articles at module level. A fresh process guarantees
 * _articles === null when the test first calls getArticlesAtPlace.
 *
 * RUNNER:
 *   npx tsx --test tests/places-curation-ab-clear.test.ts
 *
 * WHAT THIS TESTS:
 *   The load-bearing transactional clear scenario: two articles are at the same
 *   place. Set article A as the highlight. Then call savePlaceHighlightsImpl again
 *   to set article B as the highlight. Assert that A's highlightForPlace was
 *   removed from the real MDX file on disk.
 *
 *   This is the test the advisor flagged as missing from the main suite (2c only
 *   covers "set then clear to null"; this is "set A, then set B, assert A cleared").
 *
 * DOCTORING CONTRACT:
 *   .velite/articles.json is NOT in git (gitignored) so git diff is blind to it.
 *   We snapshot+restore it explicitly in before/after, and also restore content MDX.
 *   The test must leave the working directory byte-identical to its pre-test state.
 *
 * Owner: Algol (α-VER-06) · CURATION-BUILD-PLAN.md §transactional-clear · 2026-06-08
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

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

// ─────────────────────────────────────────────────────────────────────────────
// Files to snapshot
// ─────────────────────────────────────────────────────────────────────────────

const VELITE_ARTICLES = '.velite/articles.json'

// All article MDX files that might be touched during the A→B test.
// 001-four-pours is normally at Yirgacheffe but we doctor it to appear at Bangkok
// in .velite/articles.json. The actual MDX file (001-four-pours.mdx) will be
// written by the savePlaceHighlightsImpl call — must be snapshotted.
const ARTICLE_000 = 'content/articles/000-genesis.mdx'
const ARTICLE_001 = 'content/articles/001-four-pours.mdx'

// Bangkok sidecar MDX files — some tests (2f-ii) pass photoFrames which trigger
// placeId stamps on chosen sidecars. These must be snapshotted so after() restores them.
const BANGKOK_SIDECARS = [
  'content/photos/2026-05-bangkok/DSCF0002.mdx',
  'content/photos/2026-05-bangkok/DSCF0003.mdx',
  'content/photos/2026-05-bangkok/DSCF0004.mdx',
  'content/photos/2026-05-bangkok/DSCF0005.mdx',
]

const SNAPSHOT_PATHS = [VELITE_ARTICLES, ARTICLE_000, ARTICLE_001, ...BANGKOK_SIDECARS]

let snapshots: Record<string, string> = {}

// ─────────────────────────────────────────────────────────────────────────────
// Doctor .velite/articles.json to add placeId: "bangkok" on article 001
//
// The module-level _articles cache in places.ts is null at process start.
// This doctoring runs in before() before any import of places.ts is triggered,
// so the first call to import('../../.velite') picks up the doctored data.
// ─────────────────────────────────────────────────────────────────────────────

before(() => {
  snapshots = snapshot(SNAPSHOT_PATHS)

  // Doctor .velite/articles.json: give article 001 placeId "bangkok" so
  // getArticlesAtPlace('bangkok') returns both 000 and 001.
  const articlesRaw = readFile(VELITE_ARTICLES)
  const articles: Record<string, unknown>[] = JSON.parse(articlesRaw)

  const article001 = articles.find((a) => a.fileNum === '001')
  if (!article001) throw new Error('Test setup: article 001 not found in .velite/articles.json')

  article001.placeId = 'bangkok'
  writeFile(VELITE_ARTICLES, JSON.stringify(articles, null, 2))
})

after(() => {
  // Restore everything unconditionally (belt-and-suspenders)
  restore(snapshots)
})

// ─────────────────────────────────────────────────────────────────────────────
// Deferred imports: MUST come AFTER before() runs the doctoring.
// Dynamic imports below are used to ensure the module is loaded AFTER we
// modify .velite/articles.json. Node.js ESM caches modules, so we import
// the implementations here (not at top level) so that by the time the first
// test calls savePlaceHighlightsImpl, the cache is warm with doctored data.
//
// Note: tsx's module system respects dynamic import timing — top-level
// static imports in this file run synchronously before before() hooks.
// We accept the top-level import of the highlight-core functions because
// those functions are what we're testing, and they call getArticlesAtPlace
// lazily (inside the async body, not at import time).
// ─────────────────────────────────────────────────────────────────────────────

import { savePlaceHighlightsImpl } from '@/lib/server/places/highlight-core'

// ─────────────────────────────────────────────────────────────────────────────
// The load-bearing A→B test
// ─────────────────────────────────────────────────────────────────────────────

describe('2f. Article A→B transactional clear (switch highlight from A to B clears A)', () => {

  test('2f-i. set article 000 as highlight → then set article 001 as highlight → 000 highlightForPlace removed', async () => {
    // Step 1: Set article 000 (Bangkok) as the highlighted article for Bangkok.
    const result1 = await savePlaceHighlightsImpl({
      placeId: 'bangkok',
      articleSlug: '000',
      photoFrames: [],
    })
    assert.equal(result1.ok, true, `Step 1 (set 000) failed: ${JSON.stringify(result1)}`)
    if (!result1.ok) return

    // Verify 000 was set
    const content000_after1 = readFile(ARTICLE_000)
    assert.match(content000_after1, /^highlightForPlace: true$/m,
      'After step 1: article 000 must have highlightForPlace: true')

    // Step 2: Switch — set article 001 as the highlighted article for Bangkok.
    // Since 001 has placeId:"bangkok" in the doctored velite cache,
    // getArticlesAtPlace('bangkok') returns [000, 001] and the clear loop
    // must remove highlightForPlace from 000 while setting it on 001.
    const result2 = await savePlaceHighlightsImpl({
      placeId: 'bangkok',
      articleSlug: '001',
      photoFrames: [],
    })
    assert.equal(result2.ok, true, `Step 2 (switch to 001) failed: ${JSON.stringify(result2)}`)
    if (!result2.ok) return

    // Verify 001 was set as the new highlight
    const content001_after2 = readFile(ARTICLE_001)
    assert.match(content001_after2, /^highlightForPlace: true$/m,
      'After step 2: article 001 must have highlightForPlace: true')

    // THE LOAD-BEARING ASSERTION: 000 must have been cleared.
    // If the transactional clear is broken, 000 would still have highlightForPlace: true
    // → two article highlights at bangkok → assertHighlightConstraints throws at build time.
    const content000_after2 = readFile(ARTICLE_000)
    assert.doesNotMatch(content000_after2, /^highlightForPlace:/m,
      'After switching to article 001: article 000 must have highlightForPlace REMOVED ' +
      '(not just set to false — the remove branch must fire). ' +
      'If this fails, the transactional clear is broken: two articles would both have ' +
      'highlightForPlace set at bangkok, causing places.ts assertHighlightConstraints to throw.')
  })

  test('2f-ii. return value confirms the switch (articleHighlight.fileNum === 001)', async () => {
    // Full save: both article and photos, then switch article.
    const step1 = await savePlaceHighlightsImpl({
      placeId: 'bangkok',
      articleSlug: '000',
      photoFrames: [{ roll: '2026-05-bangkok', id: 'DSCF0002' }],
    })
    assert.equal(step1.ok, true, `Step 1 failed: ${JSON.stringify(step1)}`)

    // Switch article to 001, keep same photo
    const step2 = await savePlaceHighlightsImpl({
      placeId: 'bangkok',
      articleSlug: '001',
      photoFrames: [{ roll: '2026-05-bangkok', id: 'DSCF0003' }],
    })
    assert.equal(step2.ok, true, `Step 2 failed: ${JSON.stringify(step2)}`)
    if (!step2.ok) return

    assert.equal(step2.highlights.articleHighlight?.fileNum, '001',
      'Return value must reflect the new article (001), not the old one (000)')
    assert.equal(step2.highlights.photoHighlights.length, 1,
      'Should have 1 photo highlight after switch')
    assert.equal(step2.highlights.photoHighlights[0].id, 'DSCF0003',
      'Photo highlight must be DSCF0003 (the new choice, not DSCF0002)')

    // File-level check: 000 cleared, 001 set
    assert.doesNotMatch(readFile(ARTICLE_000), /^highlightForPlace:/m,
      '000 must be cleared after switching to 001')
    assert.match(readFile(ARTICLE_001), /^highlightForPlace: true$/m,
      '001 must be set as new highlight')
  })

  test('2f-iii. switch back A→B→A (round-trip): B cleared, A set again', async () => {
    // A→B→A round-trip: proves the clear is not a one-way operation.
    const r1 = await savePlaceHighlightsImpl({ placeId: 'bangkok', articleSlug: '000', photoFrames: [] })
    assert.equal(r1.ok, true, `r1 failed: ${JSON.stringify(r1)}`)

    const r2 = await savePlaceHighlightsImpl({ placeId: 'bangkok', articleSlug: '001', photoFrames: [] })
    assert.equal(r2.ok, true, `r2 failed: ${JSON.stringify(r2)}`)

    const r3 = await savePlaceHighlightsImpl({ placeId: 'bangkok', articleSlug: '000', photoFrames: [] })
    assert.equal(r3.ok, true, `r3 failed: ${JSON.stringify(r3)}`)

    // After A→B→A: A must be set, B must be cleared
    assert.match(readFile(ARTICLE_000), /^highlightForPlace: true$/m,
      'After A→B→A: article 000 must be set (A)')
    assert.doesNotMatch(readFile(ARTICLE_001), /^highlightForPlace:/m,
      'After A→B→A: article 001 must be cleared (B→A switched back)')
  })

  test('2f-iv. clear-to-null from B clears both: no highlightForPlace anywhere at bangkok', async () => {
    // Set B first
    const r1 = await savePlaceHighlightsImpl({ placeId: 'bangkok', articleSlug: '001', photoFrames: [] })
    assert.equal(r1.ok, true, `r1 failed: ${JSON.stringify(r1)}`)
    assert.match(readFile(ARTICLE_001), /^highlightForPlace: true$/m, 'B must be set before clear')

    // Clear to null
    const r2 = await savePlaceHighlightsImpl({ placeId: 'bangkok', articleSlug: null, photoFrames: [] })
    assert.equal(r2.ok, true, `r2 failed: ${JSON.stringify(r2)}`)
    assert.equal(r2.highlights?.articleHighlight, null, 'No article highlight after clear')

    // Both must be clear
    assert.doesNotMatch(readFile(ARTICLE_000), /^highlightForPlace:/m,
      'Article 000 must have no highlightForPlace after clear-to-null from B')
    assert.doesNotMatch(readFile(ARTICLE_001), /^highlightForPlace:/m,
      'Article 001 must have no highlightForPlace after clear-to-null from B')
  })
})
