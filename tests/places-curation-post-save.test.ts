/**
 * tests/places-curation-post-save.test.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Post-save constraint integrity test.
 *
 * Verifies QA MUST-VERIFY item 3:
 *   "After a save, getPlacesSummary/getPlaceContent (places.ts assertions) do NOT
 *    throw; velite content build after a save succeeds."
 *
 * PIPELINE:
 *   1. Snapshot all content files that will be touched
 *   2. Call savePlaceHighlightsImpl to write a real highlight state
 *   3. Run `npm run content:build` (velite) — regenerates .velite/*.json from MDX
 *      EXIT 1 from velite = frontmatter failed zod → test fails
 *   4. Run `npx tsx scripts/audit-places-load.ts` — fresh-process import of places.ts,
 *      calls getPlacesSummary() + getPlaceContent('bangkok'), assertHighlightConstraints
 *      EXIT 1 from audit = constraint violation → test fails
 *   5. Restore content MDX files
 *   6. Run `npm run content:build` again to re-sync .velite to restored state
 *
 * ISOLATION CONTRACT:
 *   .velite/ is gitignored — git diff check (6j in main suite) is blind to it.
 *   We regenerate .velite at end to leave the cache consistent with restored content.
 *
 * NOTE: This test is intentionally slow (two velite builds ~seconds each).
 * Do not include in fast feedback loops — it is the honest check for item 3.
 *
 * RUNNER:
 *   npx tsx --test tests/places-curation-post-save.test.ts
 *
 * Owner: Algol (α-VER-06) · CURATION-BUILD-PLAN.md §post-save-constraints · 2026-06-08
 */

import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

function readFile(relPath: string): string {
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

function runCmd(cmd: string, description: string): void {
  try {
    execSync(cmd, { cwd: ROOT, encoding: 'utf-8', stdio: 'pipe' })
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; status?: number }
    const output = (err.stdout ?? '') + (err.stderr ?? '')
    throw new Error(`${description} failed (exit ${err.status ?? '?'}):\n${output}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Files to snapshot
// ─────────────────────────────────────────────────────────────────────────────

const BANGKOK_SIDECARS = [
  'content/photos/2026-05-bangkok/DSCF0002.mdx',
  'content/photos/2026-05-bangkok/DSCF0003.mdx',
  'content/photos/2026-05-bangkok/DSCF0004.mdx',
  'content/photos/2026-05-bangkok/DSCF0005.mdx',
]
const BANGKOK_ARTICLE = 'content/articles/000-genesis.mdx'
const CHIANG_MAI_ARTICLE = 'content/articles/002-stride-pause.mdx'
const CHIANG_MAI_SIDECAR = 'content/photos/2026-04-chiang-mai/DSCF0001.mdx'

const SNAPSHOT_FILES = [
  ...BANGKOK_SIDECARS,
  BANGKOK_ARTICLE,
  CHIANG_MAI_ARTICLE,
  CHIANG_MAI_SIDECAR,
]

let snapshots: Record<string, string> = {}

before(() => {
  snapshots = snapshot(SNAPSHOT_FILES)
})

after(() => {
  // Restore content files and re-sync .velite to the clean state.
  // This ensures .velite is consistent with content after the test runs.
  restore(snapshots)
  try {
    execSync('npm run content:build', { cwd: ROOT, encoding: 'utf-8', stdio: 'pipe' })
  } catch {
    // If the final rebuild fails, the content restore still happened.
    // The test that caught the velite failure already failed above — this is cleanup.
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Import the implementation (lazy — called inside test bodies, not at module load)
// ─────────────────────────────────────────────────────────────────────────────

import { savePlaceHighlightsImpl } from '@/lib/server/places/highlight-core'

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('3. Post-save constraints: velite build succeeds + places.ts no-throw', () => {

  test('3-post-i. article + 2 photos save → velite build exits 0 → audit script exits 0', { timeout: 120_000 }, async () => {
    // Step 1: Write a representative highlight state (article + 2 photos at bangkok)
    const result = await savePlaceHighlightsImpl({
      placeId: 'bangkok',
      articleSlug: '000',
      photoFrames: [
        { roll: '2026-05-bangkok', id: 'DSCF0002' },
        { roll: '2026-05-bangkok', id: 'DSCF0003' },
      ],
    })
    assert.equal(result.ok, true, `savePlaceHighlightsImpl failed: ${JSON.stringify(result)}`)
    if (!result.ok) return

    // Verify the MDX writes landed
    const art = readFile(BANGKOK_ARTICLE)
    assert.match(art, /^highlightForPlace: true$/m, 'Article 000 must have highlightForPlace: true')
    const ph1 = readFile('content/photos/2026-05-bangkok/DSCF0002.mdx')
    assert.match(ph1, /^highlightRank: 1$/m, 'DSCF0002 must have highlightRank: 1')
    const ph2 = readFile('content/photos/2026-05-bangkok/DSCF0003.mdx')
    assert.match(ph2, /^highlightRank: 2$/m, 'DSCF0003 must have highlightRank: 2')

    // Step 2: Run velite content build — regenerates .velite/*.json from the MDX files.
    // A non-zero exit means the written frontmatter failed velite's zod schema.
    runCmd('npm run content:build', 'velite content:build after article+2photo save')

    // Step 3: Run audit script in a fresh process.
    // This imports places.ts for the first time (module cache null), calls
    // getPlacesSummary() and getPlaceContent('bangkok'), and runs assertHighlightConstraints.
    // Non-zero exit = constraint violation.
    runCmd(
      `${path.join(ROOT, 'node_modules/.bin/tsx')} ${path.join(ROOT, 'scripts/audit-places-load.ts')}`,
      'audit-places-load after velite build',
    )
  })

  test('3-post-ii. 4 photos, no article → velite build exits 0 → audit exits 0', { timeout: 120_000 }, async () => {
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
    assert.equal(result.ok, true, `4-photo save failed: ${JSON.stringify(result)}`)
    if (!result.ok) return

    runCmd('npm run content:build', 'velite content:build after 4-photo save')
    runCmd(
      `${path.join(ROOT, 'node_modules/.bin/tsx')} ${path.join(ROOT, 'scripts/audit-places-load.ts')}`,
      'audit-places-load after 4-photo build',
    )
  })

  test('3-post-iii. clear-all (null article, 0 photos) → velite build exits 0 → audit exits 0', { timeout: 120_000 }, async () => {
    // First set something, then clear — velite + constraint check must pass after clear
    await savePlaceHighlightsImpl({
      placeId: 'bangkok',
      articleSlug: '000',
      photoFrames: [{ roll: '2026-05-bangkok', id: 'DSCF0002' }],
    })

    const result = await savePlaceHighlightsImpl({
      placeId: 'bangkok',
      articleSlug: null,
      photoFrames: [],
    })
    assert.equal(result.ok, true, `clear-all save failed: ${JSON.stringify(result)}`)
    if (!result.ok) return

    runCmd('npm run content:build', 'velite content:build after clear-all')
    runCmd(
      `${path.join(ROOT, 'node_modules/.bin/tsx')} ${path.join(ROOT, 'scripts/audit-places-load.ts')}`,
      'audit-places-load after clear-all build',
    )
  })

})
