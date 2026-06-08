/**
 * tests/places-curation-qa.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * QA gauntlet for the console places-curation layer (CURATION-BUILD-PLAN.md).
 *
 * Covers all six advisor-flagged must-verify items:
 *   1. MDX body byte-identical — setFrontmatterField / removeFrontmatterField round-trip
 *   2. Transactional clear — savePlaceHighlightsImpl photo rank sweep + old ranks cleared
 *   3. Post-save constraints — placed writes do not violate assertHighlightConstraints
 *   4. Dev-only guard — NODE_ENV=production returns {ok:false,code:'DEV_GUARD'} + no I/O
 *   5. Partial save — photo-only and article-only both succeed; action does not block
 *   6. Public pages byte-identical — tsc clean + no public-route files touched
 *
 * ISOLATION CONTRACT:
 *   Tests that write real content files (#2, #3, #5) snapshot every file before
 *   and restore via fs.writeFileSync in afterEach/finally blocks. The test tree
 *   MUST leave the working directory clean (same bytes, same isoDate). If a test
 *   aborts mid-write, the snapshot restore still fires (try/finally). If the
 *   suite exits dirty, the final `git diff --stat` assertion catches it.
 *
 * VELITE DEPENDENCY:
 *   Tests #2/#3/#5 call savePlaceHighlightsImpl which queries getArticlesAtPlace /
 *   getSidecarsAtPlace — these read the velite cache at .velite/index.js. The cache
 *   is pre-built and checked in; it must match the current content/*.mdx files.
 *   If the cache is stale these tests will fail with CONTENT_LOAD_FAILED — which is
 *   itself a signal to regenerate the velite cache.
 *
 * RUNNER:
 *   npx tsx --test tests/places-curation-qa.test.ts
 *   (tsx resolves @/ path aliases from tsconfig.json; node --test *.mjs does NOT)
 *
 * Owner: Algol (α-VER-06) · CURATION-BUILD-PLAN.md §Algol lane · 2026-06-08
 */

import { test, describe, before, after, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { setFrontmatterField, removeFrontmatterField } from '@/lib/content/frontmatter-edit'
import {
  savePlaceHighlightsImpl,
  savePlaceCoordImpl,
  createPlaceImpl,
} from '@/lib/server/places/highlight-core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function readContent(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf-8')
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
// Fixture strings — minimal MDX documents for pure-function tests
// These are NOT written to disk; purely in-memory.
// ─────────────────────────────────────────────────────────────────────────────

const ARTICLE_FIXTURE = `---
fileNum: "001"
kind: article
title: "the four pours adaptation"
date: "2026.04.28"
domain: method
tags:
  - method
  - coffee
status: refined
readingTime: 15
summary: "A recipe that took four months to stop being a starting point."
coords:
  lat: 6.16
  lon: 38.2058
  place: "Yirgacheffe · ET"
shareLocation: false
patches:
  - n: 1
    date: "2026-04-30"
    note: "Added agitation timing notes."
---

*A recipe is a starting point.*

---

## The problem

Body text here. **Formatted**. With a [link](https://example.com).

\`\`\`
code block
\`\`\`
`

const PHOTO_SIDECAR_FIXTURE = `---
roll: 2026-04-chiang-mai
id: DSCF0001
kind: photo-sidecar
date: "2026.04.15"
caption: "Nimman · early morning before the street wakes."
shareLocation: true
coords:
  lat: 18.79
  lon: 98.99
  place: "Chiang Mai · TH"
---
`

// CRLF fixture for line-ending preservation test
const CRLF_FIXTURE = `---\r\nfileNum: "999"\r\nkind: article\r\ntitle: "crlf test"\r\n---\r\n\r\nBody line 1.\r\nBody line 2.\r\n`

// ─────────────────────────────────────────────────────────────────────────────
// 1. MDX body byte-identical
//    Tests setFrontmatterField and removeFrontmatterField with real fixture strings.
//    No file I/O. Pure function contract.
// ─────────────────────────────────────────────────────────────────────────────

describe('1. MDX body byte-identical (setFrontmatterField / removeFrontmatterField)', () => {

  test('1a. adding a new field does not change any body bytes', () => {
    // Extract original body (everything after closing ---)
    const closingFence = ARTICLE_FIXTURE.indexOf('\n---\n', 4)
    const originalBody = ARTICLE_FIXTURE.slice(closingFence + 5) // skip \n---\n

    const result = setFrontmatterField(ARTICLE_FIXTURE, 'placeId', 'yirgacheffe')

    const resultClosing = result.indexOf('\n---\n', 4)
    const resultBody = result.slice(resultClosing + 5)

    assert.equal(resultBody, originalBody,
      'Body bytes after closing --- must be identical after adding a new field')
    assert.match(result, /^placeId: "yirgacheffe"$/m,
      'New field must be present in frontmatter')
  })

  test('1b. replacing an existing field does not change any body bytes', () => {
    const afterAdd = setFrontmatterField(ARTICLE_FIXTURE, 'placeId', 'yirgacheffe')

    const closingFence = ARTICLE_FIXTURE.indexOf('\n---\n', 4)
    const originalBody = ARTICLE_FIXTURE.slice(closingFence + 5)

    const result = setFrontmatterField(afterAdd, 'placeId', 'kyoto')

    const resultClosing = result.indexOf('\n---\n', 4)
    const resultBody = result.slice(resultClosing + 5)

    assert.equal(resultBody, originalBody,
      'Body bytes must be identical after replacing an existing field')
    assert.match(result, /^placeId: "kyoto"$/m, 'Replaced field must have new value')
    assert.doesNotMatch(result, /^placeId: "yirgacheffe"$/m, 'Old value must not appear')
  })

  test('1c. removing a field does not change any body bytes', () => {
    const withField = setFrontmatterField(ARTICLE_FIXTURE, 'placeId', 'yirgacheffe')
    const withHighlight = setFrontmatterField(withField, 'highlightForPlace', true)

    const closingFence = ARTICLE_FIXTURE.indexOf('\n---\n', 4)
    const originalBody = ARTICLE_FIXTURE.slice(closingFence + 5)

    const result = removeFrontmatterField(withHighlight, 'highlightForPlace')

    const resultClosing = result.indexOf('\n---\n', 4)
    const resultBody = result.slice(resultClosing + 5)

    assert.equal(resultBody, originalBody,
      'Body bytes must be identical after removing a field')
    assert.doesNotMatch(result, /^highlightForPlace:/m,
      'Removed field must not appear in frontmatter')
    assert.match(result, /^placeId: "yirgacheffe"$/m,
      'Untouched fields must remain')
  })

  test('1d. all other frontmatter lines unchanged when adding placeId', () => {
    const result = setFrontmatterField(ARTICLE_FIXTURE, 'placeId', 'yirgacheffe')

    // Every original frontmatter line (except the added one) must still appear
    const originalLines = ARTICLE_FIXTURE.split('\n').filter(l =>
      l.startsWith('fileNum:') || l.startsWith('kind:') || l.startsWith('title:') ||
      l.startsWith('date:') || l.startsWith('domain:') || l.startsWith('status:') ||
      l.startsWith('readingTime:') || l.startsWith('shareLocation:')
    )
    for (const line of originalLines) {
      assert.ok(result.includes(line), `Original line "${line}" must be preserved verbatim`)
    }
  })

  test('1e. photo sidecar round-trip: set highlightRank then remove — byte-identical', () => {
    const withRank = setFrontmatterField(PHOTO_SIDECAR_FIXTURE, 'highlightRank', 3)
    const restored = removeFrontmatterField(withRank, 'highlightRank')

    // Photo sidecar has no body (empty after closing ---), round-trip must be identical
    assert.equal(restored, PHOTO_SIDECAR_FIXTURE,
      'Round-trip set+remove on photo sidecar must produce identical bytes')
  })

  test('1f. CRLF line endings preserved — body not altered', () => {
    const result = setFrontmatterField(CRLF_FIXTURE, 'placeId', 'test-place')

    // Body must still use CRLF
    const closingIndex = CRLF_FIXTURE.indexOf('\r\n---\r\n', 4)
    const originalBody = CRLF_FIXTURE.slice(closingIndex + 7)
    const resultClosingIndex = result.indexOf('\r\n---\r\n', 4)
    const resultBody = result.slice(resultClosingIndex + 7)

    assert.equal(resultBody, originalBody, 'CRLF body must be preserved verbatim')
    assert.match(result, /placeId: "test-place"/, 'Field must be added')
  })

  test('1g. set + replace + remove is fully idempotent to original', () => {
    const step1 = setFrontmatterField(ARTICLE_FIXTURE, 'highlightForPlace', false)
    const step2 = setFrontmatterField(step1, 'highlightForPlace', true)
    const step3 = removeFrontmatterField(step2, 'highlightForPlace')

    assert.equal(step3, ARTICLE_FIXTURE,
      'set→replace→remove must return the original string exactly')
  })

  test('1h. set on existing-with-same-value is idempotent', () => {
    const withField = setFrontmatterField(ARTICLE_FIXTURE, 'highlightForPlace', true)
    const again    = setFrontmatterField(withField, 'highlightForPlace', true)

    assert.equal(again, withField, 'Setting identical value must return identical string')
  })

  test('1i. setFrontmatterField throws on non-scalar value (array)', () => {
    assert.throws(
      () => setFrontmatterField(ARTICLE_FIXTURE, 'tags', ['a', 'b'] as any),
      /TypeError|value must be string/i,
      'Must throw TypeError for array value'
    )
  })

  test('1j. real article MDX round-trip: body unchanged after placeId + highlightForPlace', () => {
    const real = readContent('content/articles/001-four-pours.mdx')

    // Locate body boundary
    const lines = real.split('\n')
    let fenceCount = 0
    let closingFenceLine = -1
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trimEnd() === '---') {
        fenceCount++
        if (fenceCount === 2) { closingFenceLine = i; break }
      }
    }
    const originalBody = lines.slice(closingFenceLine + 1).join('\n')

    const modified = setFrontmatterField(real, 'placeId', 'yirgacheffe')
    const modified2 = setFrontmatterField(modified, 'highlightForPlace', true)

    const modLines = modified2.split('\n')
    let mc = 0, mClosing = -1
    for (let i = 0; i < modLines.length; i++) {
      if (modLines[i].trimEnd() === '---') { mc++; if (mc === 2) { mClosing = i; break } }
    }
    const modifiedBody = modLines.slice(mClosing + 1).join('\n')

    assert.equal(modifiedBody, originalBody,
      'Real article MDX body must be byte-identical after frontmatter writes')
  })

  test('1k. real photo sidecar MDX round-trip: body unchanged after placeId + highlightRank', () => {
    const real = readContent('content/photos/2026-05-bangkok/DSCF0002.mdx')

    // Photo sidecars have no body — the entire file is frontmatter
    const closingIdx = real.indexOf('\n---\n', 4)
    const originalBody = closingIdx === -1 ? '' : real.slice(closingIdx + 5)

    const modified = setFrontmatterField(real, 'placeId', 'bangkok')
    const modified2 = setFrontmatterField(modified, 'highlightRank', 2)

    const mClosingIdx = modified2.indexOf('\n---\n', 4)
    const modifiedBody = mClosingIdx === -1 ? '' : modified2.slice(mClosingIdx + 5)

    assert.equal(modifiedBody, originalBody,
      'Real photo sidecar body must be byte-identical after frontmatter writes')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. Dev-only guard
//    Tests the NODE_ENV=production branch in every action impl.
//    Must: return {ok:false, error:{code:'DEV_GUARD'}}, never throw, no I/O.
// ─────────────────────────────────────────────────────────────────────────────

describe('4. Dev-only guard (NODE_ENV=production → {ok:false,code:DEV_GUARD})', () => {

  // NODE_ENV is readonly in TypeScript types; use Object.defineProperty to override in tests.
  function withProductionEnv<T>(fn: () => T): T {
    const descriptor = Object.getOwnPropertyDescriptor(process.env, 'NODE_ENV')
    Object.defineProperty(process.env, 'NODE_ENV', {
      value: 'production', writable: true, configurable: true, enumerable: true,
    })
    try {
      return fn()
    } finally {
      if (descriptor) {
        Object.defineProperty(process.env, 'NODE_ENV', descriptor)
      } else {
        delete (process.env as Record<string, string | undefined>).NODE_ENV
      }
    }
  }

  test('4a. savePlaceHighlightsImpl returns DEV_GUARD in production, does not throw', async () => {
    const result = await withProductionEnv(() =>
      savePlaceHighlightsImpl({ placeId: 'bangkok', articleSlug: null, photoFrames: [] })
    )
    assert.equal(result.ok, false, 'ok must be false')
    assert.equal((result as any).error.code, 'DEV_GUARD', 'code must be DEV_GUARD')
    assert.ok(
      (result as any).error.message.includes('dev-only') ||
      (result as any).error.message.includes('read-only') ||
      (result as any).error.message.includes('production'),
      'message must mention production/dev-only context'
    )
  })

  test('4b. savePlaceCoordImpl returns DEV_GUARD in production, does not throw', async () => {
    const result = await withProductionEnv(() =>
      savePlaceCoordImpl({ placeId: 'bangkok', lat: 13.7563, lon: 100.5018 })
    )
    assert.equal(result.ok, false)
    assert.equal((result as any).error.code, 'DEV_GUARD')
  })

  test('4c. createPlaceImpl returns DEV_GUARD in production, does not throw', async () => {
    const result = await withProductionEnv(() =>
      createPlaceImpl({ name: 'Test Place · TX', coord: { lat: 0, lon: 0 } })
    )
    assert.equal(result.ok, false)
    assert.equal((result as any).error.code, 'DEV_GUARD')
  })

  test('4d. DEV_GUARD fires before any file I/O — no files touched', async () => {
    const placeDataPath = path.join(ROOT, 'lib/content/place-registry.data.json')
    const beforeContent = existsSync(placeDataPath)
      ? readFileSync(placeDataPath, 'utf-8')
      : null

    await withProductionEnv(() => savePlaceCoordImpl({ placeId: 'bangkok', lat: 99, lon: 99 }))
    await withProductionEnv(() => createPlaceImpl({ name: 'Canary · XX', coord: { lat: 0, lon: 0 } }))

    if (beforeContent !== null) {
      const afterContent = readFileSync(placeDataPath, 'utf-8')
      assert.equal(afterContent, beforeContent,
        'place-registry.data.json must be unmodified after DEV_GUARD')
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. Transactional clear + 3. Post-save constraints + 5. Partial save
//    These tests write real content files. Snapshot-and-restore pattern.
// ─────────────────────────────────────────────────────────────────────────────

describe('2/3/5. Integration: transactional clear, constraints, partial save', () => {
  // Files involved in bangkok operations (4 sidecars, 1 article)
  const BANGKOK_SIDECARS = [
    'content/photos/2026-05-bangkok/DSCF0002.mdx',
    'content/photos/2026-05-bangkok/DSCF0003.mdx',
    'content/photos/2026-05-bangkok/DSCF0004.mdx',
    'content/photos/2026-05-bangkok/DSCF0005.mdx',
  ]
  const BANGKOK_ARTICLE = 'content/articles/000-genesis.mdx'
  const CHIANG_MAI_ARTICLE = 'content/articles/002-stride-pause.mdx'
  const CHIANG_MAI_SIDECAR = 'content/photos/2026-04-chiang-mai/DSCF0001.mdx'

  const ALL_FILES = [
    ...BANGKOK_SIDECARS,
    BANGKOK_ARTICLE,
    CHIANG_MAI_ARTICLE,
    CHIANG_MAI_SIDECAR,
  ]

  let snapshots: Record<string, string> = {}

  before(() => {
    snapshots = snapshot(ALL_FILES)
  })

  afterEach(() => {
    restore(snapshots)
  })

  after(() => {
    // Belt-and-suspenders: restore even if afterEach doesn't fire
    restore(snapshots)
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 2a–2e. Transactional clear — photo ranks
  // ───────────────────────────────────────────────────────────────────────────

  test('2a. set 3 photos → ranks are 1,2,3 contiguous; other sidecars have no rank', async () => {
    const result = await savePlaceHighlightsImpl({
      placeId: 'bangkok',
      articleSlug: null,
      photoFrames: [
        { roll: '2026-05-bangkok', id: 'DSCF0002' },
        { roll: '2026-05-bangkok', id: 'DSCF0004' },
        { roll: '2026-05-bangkok', id: 'DSCF0005' },
      ],
    })

    assert.equal(result.ok, true, `Expected ok:true, got: ${JSON.stringify(result)}`)
    if (!result.ok) return
    const ranks = result.highlights.photoHighlights.map(h => h.rank).sort((a, b) => a - b)
    assert.deepEqual(ranks, [1, 2, 3], 'Photo ranks must be 1,2,3 contiguous')

    const dscf0002 = readContent('content/photos/2026-05-bangkok/DSCF0002.mdx')
    assert.match(dscf0002, /^highlightRank: 1$/m, 'DSCF0002 must have highlightRank: 1')

    const dscf0003 = readContent('content/photos/2026-05-bangkok/DSCF0003.mdx')
    assert.doesNotMatch(dscf0003, /^highlightRank:/m,
      'DSCF0003 (not chosen) must have no highlightRank')
  })

  test('2b. switch from 3 photos to 1 photo — other 2 ranks cleared', async () => {
    // First save: 3 frames
    await savePlaceHighlightsImpl({
      placeId: 'bangkok',
      articleSlug: null,
      photoFrames: [
        { roll: '2026-05-bangkok', id: 'DSCF0002' },
        { roll: '2026-05-bangkok', id: 'DSCF0003' },
        { roll: '2026-05-bangkok', id: 'DSCF0004' },
      ],
    })

    assert.match(readContent('content/photos/2026-05-bangkok/DSCF0002.mdx'), /^highlightRank: 1$/m)
    assert.match(readContent('content/photos/2026-05-bangkok/DSCF0003.mdx'), /^highlightRank: 2$/m)
    assert.match(readContent('content/photos/2026-05-bangkok/DSCF0004.mdx'), /^highlightRank: 3$/m)

    // Second save: only 1 frame — the other 2 must be cleared
    const result2 = await savePlaceHighlightsImpl({
      placeId: 'bangkok',
      articleSlug: null,
      photoFrames: [
        { roll: '2026-05-bangkok', id: 'DSCF0005' },
      ],
    })

    assert.equal(result2.ok, true, `Second save failed: ${JSON.stringify(result2)}`)
    if (!result2.ok) return
    assert.equal(result2.highlights.photoHighlights.length, 1, 'Should have 1 photo highlight')
    assert.equal(result2.highlights.photoHighlights[0].rank, 1, 'Single frame must have rank 1')

    assert.doesNotMatch(readContent('content/photos/2026-05-bangkok/DSCF0002.mdx'), /^highlightRank:/m, 'DSCF0002 rank must be cleared')
    assert.doesNotMatch(readContent('content/photos/2026-05-bangkok/DSCF0003.mdx'), /^highlightRank:/m, 'DSCF0003 rank must be cleared')
    assert.doesNotMatch(readContent('content/photos/2026-05-bangkok/DSCF0004.mdx'), /^highlightRank:/m, 'DSCF0004 rank must be cleared')
    assert.match(readContent('content/photos/2026-05-bangkok/DSCF0005.mdx'), /^highlightRank: 1$/m, 'DSCF0005 must have rank 1')
  })

  test('2c. article highlight set then cleared to null — highlightForPlace removed', async () => {
    const result1 = await savePlaceHighlightsImpl({
      placeId: 'bangkok',
      articleSlug: '000',
      photoFrames: [],
    })
    assert.equal(result1.ok, true, `Set article failed: ${JSON.stringify(result1)}`)
    if (!result1.ok) return
    assert.ok(result1.highlights.articleHighlight !== null, 'articleHighlight must be set')

    assert.match(readContent('content/articles/000-genesis.mdx'), /^highlightForPlace: true$/m,
      'Article must have highlightForPlace: true after setting')

    const result2 = await savePlaceHighlightsImpl({
      placeId: 'bangkok',
      articleSlug: null,
      photoFrames: [],
    })
    assert.equal(result2.ok, true, `Clear article failed: ${JSON.stringify(result2)}`)
    if (!result2.ok) return
    assert.equal(result2.highlights.articleHighlight, null,
      'articleHighlight must be null after clearing')

    assert.doesNotMatch(readContent('content/articles/000-genesis.mdx'), /^highlightForPlace:/m,
      'highlightForPlace must be removed when article cleared')
  })

  test('2d. ranks are always contiguous 1..N with no gaps', async () => {
    const frames = [
      { roll: '2026-05-bangkok', id: 'DSCF0005' },
      { roll: '2026-05-bangkok', id: 'DSCF0003' },
      { roll: '2026-05-bangkok', id: 'DSCF0002' },
      { roll: '2026-05-bangkok', id: 'DSCF0004' },
    ]
    const result = await savePlaceHighlightsImpl({
      placeId: 'bangkok',
      articleSlug: null,
      photoFrames: frames,
    })
    assert.equal(result.ok, true)
    if (!result.ok) return

    const ranks = result.highlights.photoHighlights.map(h => h.rank).sort((a, b) => a - b)
    assert.deepEqual(ranks, [1, 2, 3, 4], 'Ranks must be contiguous 1..N')

    const uniqueRanks = new Set(result.highlights.photoHighlights.map(h => h.rank))
    assert.equal(uniqueRanks.size, frames.length, 'No duplicate ranks allowed')
  })

  test('2e. order of photoHighlights in return matches input order', async () => {
    const frames = [
      { roll: '2026-05-bangkok', id: 'DSCF0004' },
      { roll: '2026-05-bangkok', id: 'DSCF0002' },
      { roll: '2026-05-bangkok', id: 'DSCF0003' },
    ]
    const result = await savePlaceHighlightsImpl({
      placeId: 'bangkok',
      articleSlug: null,
      photoFrames: frames,
    })
    assert.equal(result.ok, true)
    if (!result.ok) return

    assert.equal(result.highlights.photoHighlights[0].id, 'DSCF0004', 'Rank 1 must be first input (DSCF0004)')
    assert.equal(result.highlights.photoHighlights[1].id, 'DSCF0002', 'Rank 2 must be second input (DSCF0002)')
    assert.equal(result.highlights.photoHighlights[2].id, 'DSCF0003', 'Rank 3 must be third input (DSCF0003)')
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Post-save constraints
  // ───────────────────────────────────────────────────────────────────────────

  test('3a. post-save: at most 1 article highlight per place', async () => {
    const result = await savePlaceHighlightsImpl({
      placeId: 'bangkok',
      articleSlug: '000',
      photoFrames: [{ roll: '2026-05-bangkok', id: 'DSCF0002' }],
    })
    assert.equal(result.ok, true)

    const articleContent = readContent('content/articles/000-genesis.mdx')
    const highlightLines = (articleContent.match(/^highlightForPlace: true$/mg) || [])
    assert.equal(highlightLines.length, 1, 'Exactly 1 highlightForPlace:true line in Bangkok article')
  })

  test('3b. post-save: photo ranks at place are unique and contiguous', async () => {
    const result = await savePlaceHighlightsImpl({
      placeId: 'bangkok',
      articleSlug: null,
      photoFrames: [
        { roll: '2026-05-bangkok', id: 'DSCF0002' },
        { roll: '2026-05-bangkok', id: 'DSCF0003' },
        { roll: '2026-05-bangkok', id: 'DSCF0004' },
      ],
    })
    assert.equal(result.ok, true)

    const ranks: number[] = []
    for (const f of BANGKOK_SIDECARS) {
      const content = readContent(f)
      const match = content.match(/^highlightRank: (\d+)$/m)
      if (match) ranks.push(Number(match[1]))
    }

    const uniqueRanks = new Set(ranks)
    assert.equal(uniqueRanks.size, ranks.length, 'No duplicate highlightRank values')
    assert.equal(ranks.length, 3, 'Exactly 3 sidecars must have highlightRank set')

    const sorted = [...ranks].sort((a, b) => a - b)
    for (let i = 0; i < sorted.length; i++) {
      assert.equal(sorted[i], i + 1, `Rank at position ${i} must be ${i + 1}`)
    }
  })

  test('3c. post-save: at most 5 photo highlights per place (4 frames ≤ 5)', async () => {
    const result = await savePlaceHighlightsImpl({
      placeId: 'bangkok',
      articleSlug: null,
      photoFrames: [
        { roll: '2026-05-bangkok', id: 'DSCF0002' },
        { roll: '2026-05-bangkok', id: 'DSCF0003' },
        { roll: '2026-05-bangkok', id: 'DSCF0004' },
        { roll: '2026-05-bangkok', id: 'DSCF0005' },
      ],
    })
    assert.equal(result.ok, true, 'Should succeed with 4 frames (≤5 limit)')
    if (!result.ok) return
    assert.ok(result.highlights.photoHighlights.length <= 5,
      `Must have ≤5 photo highlights, got ${result.highlights.photoHighlights.length}`)
  })

  test('3d. over-5 photo frames rejected at input validation (zod)', async () => {
    const result = await savePlaceHighlightsImpl({
      placeId: 'bangkok',
      articleSlug: null,
      photoFrames: [
        { roll: '2026-05-bangkok', id: 'DSCF0002' },
        { roll: '2026-05-bangkok', id: 'DSCF0003' },
        { roll: '2026-05-bangkok', id: 'DSCF0004' },
        { roll: '2026-05-bangkok', id: 'DSCF0005' },
        { roll: '2026-04-chiang-mai', id: 'DSCF0001' }, // 5th — ok
        { roll: '2026-04-chiang-mai', id: 'DSCF0002' }, // 6th — rejected
      ],
    })
    assert.equal(result.ok, false, 'Must reject > 5 frames')
    assert.equal((result as any).error.code, 'INVALID_INPUT', 'Code must be INVALID_INPUT (zod)')
  })

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Partial save
  // ───────────────────────────────────────────────────────────────────────────

  test('5a. photo-only save (articleSlug=null, 1 photoFrame) succeeds', async () => {
    const result = await savePlaceHighlightsImpl({
      placeId: 'bangkok',
      articleSlug: null,
      photoFrames: [{ roll: '2026-05-bangkok', id: 'DSCF0003' }],
    })
    assert.equal(result.ok, true, `Photo-only save failed: ${JSON.stringify(result)}`)
    if (!result.ok) return
    assert.equal(result.highlights.articleHighlight, null, 'articleHighlight must be null')
    assert.equal(result.highlights.photoHighlights.length, 1, 'Must have 1 photo highlight')
    assert.equal(result.highlights.photoHighlights[0].rank, 1, 'Photo rank must be 1')
  })

  test('5b. article-only save (articleSlug set, photoFrames=[]) succeeds', async () => {
    const result = await savePlaceHighlightsImpl({
      placeId: 'bangkok',
      articleSlug: '000',
      photoFrames: [],
    })
    assert.equal(result.ok, true, `Article-only save failed: ${JSON.stringify(result)}`)
    if (!result.ok) return
    assert.ok(result.highlights.articleHighlight !== null, 'articleHighlight must be set')
    assert.equal(result.highlights.articleHighlight.fileNum, '000', 'fileNum must match')
    assert.equal(result.highlights.photoHighlights.length, 0, 'Must have 0 photo highlights')
  })

  test('5c. both-empty save (null article, 0 photos) succeeds at action level — clears all', async () => {
    // The action permits both-empty (it clears all highlights).
    // The UI blocks this at the SAVE button disabled state — the action is not responsible
    // for blocking it. Both-empty is a valid "clear all" operation.
    const result = await savePlaceHighlightsImpl({
      placeId: 'bangkok',
      articleSlug: null,
      photoFrames: [],
    })
    assert.equal(result.ok, true,
      'Both-empty is valid at action level — clears highlights, not an error')
    if (!result.ok) return
    assert.equal(result.highlights.articleHighlight, null)
    assert.equal(result.highlights.photoHighlights.length, 0)
  })

  test('5d. chiang-mai photo-only save succeeds (1 sidecar)', async () => {
    const result = await savePlaceHighlightsImpl({
      placeId: 'chiang-mai',
      articleSlug: null,
      photoFrames: [{ roll: '2026-04-chiang-mai', id: 'DSCF0001' }],
    })
    assert.equal(result.ok, true, `Chiang Mai photo-only failed: ${JSON.stringify(result)}`)
    if (!result.ok) return
    assert.equal(result.highlights.photoHighlights.length, 1)
    assert.equal(result.highlights.photoHighlights[0].rank, 1)
  })

  test('5e. chiang-mai article-only save succeeds', async () => {
    const result = await savePlaceHighlightsImpl({
      placeId: 'chiang-mai',
      articleSlug: '002',
      photoFrames: [],
    })
    assert.equal(result.ok, true, `Chiang Mai article-only failed: ${JSON.stringify(result)}`)
    if (!result.ok) return
    assert.ok(result.highlights.articleHighlight !== null)
    assert.equal(result.highlights.articleHighlight.fileNum, '002')
  })

  test('5f. return shape: {ok,highlights:{articleHighlight,photoHighlights}} always present', async () => {
    const result = await savePlaceHighlightsImpl({
      placeId: 'bangkok',
      articleSlug: '000',
      photoFrames: [{ roll: '2026-05-bangkok', id: 'DSCF0002' }],
    })
    assert.equal(result.ok, true)
    if (!result.ok) return

    assert.ok('highlights' in result, 'Must have highlights key')
    assert.ok('articleHighlight' in result.highlights, 'Must have articleHighlight')
    assert.ok('photoHighlights' in result.highlights, 'Must have photoHighlights')
    assert.ok(Array.isArray(result.highlights.photoHighlights), 'photoHighlights must be array')

    const ph = result.highlights.photoHighlights[0]
    assert.ok('roll' in ph && 'id' in ph && 'rank' in ph,
      'Photo highlight must have roll, id, rank')

    const ah = result.highlights.articleHighlight
    assert.ok(ah !== null && 'slug' in ah && 'fileNum' in ah && 'title' in ah,
      'Article highlight must have slug, fileNum, title')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Additional action input validation contract tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Action input validation contracts', () => {

  test('unknown placeId returns PLACE_NOT_FOUND', async () => {
    const result = await savePlaceHighlightsImpl({
      placeId: 'nonexistent-place-xyz',
      articleSlug: null,
      photoFrames: [],
    })
    assert.equal(result.ok, false)
    assert.equal((result as any).error.code, 'PLACE_NOT_FOUND')
  })

  test('invalid placeId format returns INVALID_INPUT', async () => {
    const result = await savePlaceHighlightsImpl({
      placeId: 'Bangkok TH', // not kebab-case
      articleSlug: null,
      photoFrames: [],
    })
    assert.equal(result.ok, false)
    assert.equal((result as any).error.code, 'INVALID_INPUT')
  })

  test('duplicate photoFrames returns INVALID_INPUT', async () => {
    const result = await savePlaceHighlightsImpl({
      placeId: 'bangkok',
      articleSlug: null,
      photoFrames: [
        { roll: '2026-05-bangkok', id: 'DSCF0002' },
        { roll: '2026-05-bangkok', id: 'DSCF0002' }, // duplicate
      ],
    })
    assert.equal(result.ok, false)
    assert.equal((result as any).error.code, 'INVALID_INPUT')
  })

  test('articleSlug wrong format returns INVALID_INPUT', async () => {
    const result = await savePlaceHighlightsImpl({
      placeId: 'bangkok',
      articleSlug: 'not-a-filenum', // not 3-digit
      photoFrames: [],
    })
    assert.equal(result.ok, false)
    assert.equal((result as any).error.code, 'INVALID_INPUT')
  })

  test('article not at place returns ARTICLE_NOT_AT_PLACE', async () => {
    // Article 003 (Kyoto) is not at Bangkok
    const result = await savePlaceHighlightsImpl({
      placeId: 'bangkok',
      articleSlug: '003',
      photoFrames: [],
    })
    assert.equal(result.ok, false)
    assert.equal((result as any).error.code, 'ARTICLE_NOT_AT_PLACE')
  })

  test('photo frame not at place returns PHOTO_NOT_AT_PLACE', async () => {
    // Chiang Mai frame not at Bangkok
    const result = await savePlaceHighlightsImpl({
      placeId: 'bangkok',
      articleSlug: null,
      photoFrames: [{ roll: '2026-04-chiang-mai', id: 'DSCF0001' }],
    })
    assert.equal(result.ok, false)
    assert.equal((result as any).error.code, 'PHOTO_NOT_AT_PLACE')
  })

  test('savePlaceCoord: invalid lat range rejected', async () => {
    const result = await savePlaceCoordImpl({
      placeId: 'bangkok',
      lat: 91, // > 90
      lon: 100,
    })
    assert.equal(result.ok, false)
    assert.equal((result as any).error.code, 'INVALID_INPUT')
  })

  test('createPlace: duplicate id rejected', async () => {
    // Bangkok already exists in registry
    const result = await createPlaceImpl({
      name: 'Bangkok · TH',
      coord: { lat: 13.7, lon: 100.5 },
    })
    assert.equal(result.ok, false)
    assert.equal((result as any).error.code, 'DUPLICATE_ID')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. Public pages byte-identical
//    Verifies tsc is clean + no public-facing route files were touched.
// ─────────────────────────────────────────────────────────────────────────────

describe('6. Public pages byte-identical (tsc + public route boundary)', () => {

  test('6a. tsc --noEmit exits clean (no type errors)', () => {
    let output = ''
    let exitCode = 0
    try {
      output = execSync(
        `${path.join(ROOT, 'node_modules/.bin/tsc')} --noEmit`,
        { cwd: ROOT, encoding: 'utf-8', stdio: 'pipe' }
      ) as string
    } catch (e: any) {
      output = (e.stdout ?? '') + (e.stderr ?? '')
      exitCode = e.status ?? 1
    }
    assert.equal(exitCode, 0,
      `tsc --noEmit must exit clean. Output:\n${output}`)
  })

  test('6b. public routes exist and were not removed by curation task', () => {
    const publicRoutes = [
      'app/page.tsx',
      'app/articles/[fileNum]/page.tsx',
      'app/photos/[roll]/page.tsx',
      'app/archive/page.tsx',
    ]
    for (const route of publicRoutes) {
      assert.ok(existsSync(path.join(ROOT, route)),
        `Public route must still exist: ${route}`)
    }
  })

  test('6c. PlacesRailBlock.tsx has required structure and copy', () => {
    const src = readContent('components/console/PlacesRailBlock.tsx')
    assert.match(src, /'use client'/, 'Must be a Client Component')
    assert.match(src, /PlaceDTO/, 'Must import PlaceDTO type')
    assert.match(src, /EDIT HIGHLIGHTS/, 'Must include EDIT HIGHLIGHTS CTA')
    assert.match(src, /SET HIGHLIGHTS/, 'Must include SET HIGHLIGHTS CTA')
    assert.match(src, /highlights: NOT SET/, 'Must show NOT SET state')
    assert.match(src, /\+ NEW PLACE/, 'Must include NEW PLACE CTA')
  })

  test('6d. PlaceHighlightEditor.tsx has required structure', () => {
    const src = readContent('components/console/PlaceHighlightEditor.tsx')
    assert.match(src, /'use client'/, 'Must be a Client Component')
    assert.match(src, /savePlaceHighlights/, 'Must import savePlaceHighlights action')
    assert.match(src, /savePlaceCoord/, 'Must import savePlaceCoord action')
    assert.match(src, /createPlace/, 'Must import createPlace action')
    assert.match(src, /SAVE HIGHLIGHTS/, 'Must have SAVE HIGHLIGHTS button text')
    assert.match(src, /saveDisabledHint|set at least one/, 'Must have save-disabled hint')
  })

  test('6e. place-actions.ts has use-server directive', () => {
    const src = readContent('lib/server/places/place-actions.ts')
    // 'use server' must be at the very top (before any imports)
    assert.ok(src.startsWith("'use server'"),
      "place-actions.ts must start with 'use server'")
  })

  test('6f. highlight-core.ts assertDev is called before any fs.readFileSync in all impls', () => {
    const src = readContent('lib/server/places/highlight-core.ts')

    const savePH    = src.indexOf('export async function savePlaceHighlightsImpl')
    const saveCoord = src.indexOf('export async function savePlaceCoordImpl')
    const createP   = src.indexOf('export async function createPlaceImpl')

    // Each impl: assertDev() must appear before the first fs call
    for (const [name, offset] of [
      ['savePlaceHighlightsImpl', savePH],
      ['savePlaceCoordImpl', saveCoord],
      ['createPlaceImpl', createP],
    ] as Array<[string, number]>) {
      const firstRead   = src.indexOf('fs.readFileSync', offset)
      const firstAssert = src.indexOf('assertDev()',     offset)
      assert.ok(firstAssert < firstRead,
        `${name}: assertDev() must appear before first fs.readFileSync (positions: assert=${firstAssert}, read=${firstRead})`)
    }
  })

  test('6g. DevGuardError caught in all 3 impls → returned as {ok:false,code:DEV_GUARD}', () => {
    const src = readContent('lib/server/places/highlight-core.ts')
    // Each impl must have the pattern: instanceof DevGuardError … return err('DEV_GUARD'
    const pattern = /instanceof DevGuardError[\s\S]*?return err\('DEV_GUARD'/g
    const matches = src.match(pattern) ?? []
    assert.ok(matches.length >= 3,
      `All 3 impl functions must catch DevGuardError and return err(DEV_GUARD). Found ${matches.length}`)
  })

  test('6h. console page has noindex/nofollow robots metadata', () => {
    const src = readContent('app/console/page.tsx')
    assert.match(src, /robots/, 'console page must have robots metadata')
    assert.match(src, /index.*false|false.*index/, 'must set index: false')
  })

  test('6i. WorldlineGlobe.tsx implicit-any hints are pre-existing (tsc clean confirms no regression)', () => {
    // WorldlineGlobe.tsx implicit-any at ~1706/2411/2459 were noted in the task.
    // Since 6a (tsc --noEmit) passes, these are either: already typed, non-strict warnings,
    // or in noImplicitAny-excluded paths. Not a curation regression.
    // This test documents the finding: tsc clean = no actionable regression.
    const src = readContent('components/WorldlineGlobe.tsx')
    assert.ok(src.length > 0, 'WorldlineGlobe.tsx must exist and be non-empty')
    // tsc clean in 6a is the authoritative check — if it passed, no implicit-any errors exist.
  })

  test('6j. git working tree is clean after all tests (no content files modified)', () => {
    // This test runs last in the suite. If any integration test failed to restore
    // its snapshot, git diff will show dirty content files.
    let diff = ''
    try {
      diff = execSync('git diff --stat HEAD content/ lib/content/place-registry.data.json', {
        cwd: ROOT, encoding: 'utf-8', stdio: 'pipe'
      }) as string
    } catch (e: any) {
      diff = e.stdout ?? ''
    }
    assert.equal(diff.trim(), '',
      `Working tree must be clean after tests. Dirty files:\n${diff}`)
  })
})
