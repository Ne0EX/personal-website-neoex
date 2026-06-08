/**
 * scripts/audit-places-load.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Fresh-process probe for post-save constraint integrity.
 *
 * Called by tests/places-curation-post-save.test.ts AFTER:
 *   1. A real save (savePlaceHighlightsImpl) writes content MDX files
 *   2. `npm run content:build` (velite) regenerates .velite/*.json from those files
 *
 * This script runs in a fresh process so places.ts module cache (_articles,
 * _sidecars) starts null — it imports velite output for the FIRST time, seeing
 * whatever the content build wrote.
 *
 * Exit codes:
 *   0 = all checks pass (getPlacesSummary + getPlaceContent('bangkok') both succeed,
 *       assertHighlightConstraints did not throw, result shapes are sane)
 *   1 = any check failed (error + details printed to stderr)
 *
 * RUNNER (internal — called by test harness, not directly):
 *   npx tsx scripts/audit-places-load.ts
 *
 * Owner: Algol (α-VER-06) · CURATION-BUILD-PLAN.md §post-save-constraints · 2026-06-08
 */

import process from 'node:process'

// Dynamic import so this script can be called with any .velite state.
// The ESM import cache is fresh on each process invocation.
async function main(): Promise<void> {
  try {
    // We must use a dynamic expression so bundlers don't try to resolve statically.
    // tsx resolves @/ via tsconfig paths — this import works in tsx context.
    const placesModule = await import('@/lib/content/places')

    // 1. getPlacesSummary() — calls assertHighlightConstraints internally
    const summary = await placesModule.getPlacesSummary()
    if (!Array.isArray(summary)) {
      throw new Error(`getPlacesSummary returned non-array: ${typeof summary}`)
    }

    // 2. getPlaceContent('bangkok') — also calls assertHighlightConstraints
    const bangkokContent = await placesModule.getPlaceContent('bangkok')
    if (bangkokContent === null) {
      throw new Error('getPlaceContent("bangkok") returned null — place not found in registry')
    }
    if (!Array.isArray(bangkokContent.articles)) {
      throw new Error(`bangkokContent.articles is not an array: ${typeof bangkokContent.articles}`)
    }
    if (!Array.isArray(bangkokContent.sidecars)) {
      throw new Error(`bangkokContent.sidecars is not an array: ${typeof bangkokContent.sidecars}`)
    }

    // 3. Constraint summary: at most 1 article highlight per place
    for (const s of summary) {
      const place = s.place
      // getPlacesSummary having returned without throw means assertHighlightConstraints passed
      // but we double-check the data shape is sane
      if (typeof s.weight !== 'number' || s.weight < 0) {
        throw new Error(`Place "${place.id}" has invalid weight: ${s.weight}`)
      }
    }

    // 4. Bangkok highlight shape
    const ah = bangkokContent.highlights.articleHighlight
    const ph = bangkokContent.highlights.photoHighlights
    if (!Array.isArray(ph)) {
      throw new Error(`photoHighlights is not an array: ${typeof ph}`)
    }

    // 5. Photo ranks contiguous 1..N
    const ranks = (ph.map((p: { highlightRank?: number }) => p.highlightRank).filter((r): r is number => r != null)).sort((a, b) => a - b)
    for (let i = 0; i < ranks.length; i++) {
      if (ranks[i] !== i + 1) {
        throw new Error(
          `Photo highlight ranks not contiguous 1..N after velite build. Got: ${ranks.join(', ')}`,
        )
      }
    }

    // All checks passed
    console.log(`audit-places-load: PASS`)
    console.log(`  getPlacesSummary: ${summary.length} places, no constraint throw`)
    console.log(`  getPlaceContent('bangkok'):`)
    console.log(`    articles: ${bangkokContent.articles.length}`)
    console.log(`    sidecars: ${bangkokContent.sidecars.length}`)
    console.log(`    articleHighlight: ${ah ? ah.fileNum : 'null'}`)
    console.log(`    photoHighlights: ${ph.length} (ranks: ${ranks.join(',') || 'none'})`)
    process.exit(0)
  } catch (e) {
    console.error(`audit-places-load: FAIL`)
    console.error(e instanceof Error ? e.stack : String(e))
    process.exit(1)
  }
}

main()
