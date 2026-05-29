/**
 * lib/content/fiction.ts
 * ----------------------
 * Fiction query helpers.
 *
 * Fiction entries ship as diamond glyphs in the NeX orbital layer (journey-arch §2.2).
 * Entry surfaces are deferred (§3.4); these helpers exist now so TASK-33 (Globe glyph
 * extension) and future fiction-route TASKs have a stable import.
 *
 * Branching fields added in TASK-2026-05-17-PROCYON-BRANCHING-SCHEMA per
 * 30-worldline-branching.md §13.1 (schema needs) + §3.1 (data model).
 *
 * Owner: Procyon (α-IDX-03) · TASK-2026-05-15-22 / TASK-2026-05-17-PROCYON-BRANCHING-SCHEMA
 */
import type { Fiction } from './types'

/** Site canonical alpha value. Used for drift computation fallback. */
const SITE_ALPHA = 1.130426

let _fiction: Fiction[] | null = null

async function loadFiction(): Promise<Fiction[]> {
  if (_fiction) return _fiction
  const cache = await import('../../.velite')
  _fiction = cache.fiction as Fiction[]
  return _fiction
}

/** All fiction entries, sorted newest-first. */
export async function getFiction(): Promise<Fiction[]> {
  const fiction = await loadFiction()
  return [...fiction].sort((a, b) => b.isoDate.localeCompare(a.isoDate))
}

/** Lookup a single fiction entry by slug. */
export async function getFictionBySlug(slug: string): Promise<Fiction | undefined> {
  const fiction = await loadFiction()
  return fiction.find((f) => f.slug === slug)
}

/**
 * getFictionSiblings
 * ------------------
 * Returns the sibling NeX nodes for a given fiction entry — Channel B of the
 * worldline branching mechanic (30-worldline-branching.md §3.1).
 *
 * Algorithm per spec §3.1:
 *   1. Find all fiction entries that share the same divergence_cluster as `slug`.
 *   2. Exclude the entry itself.
 *   3. Sort by ascending |alpha_self − alpha_sibling| (divergence distance).
 *      alpha_self is the entry's first variant.alpha, or SITE_ALPHA if no variants.
 *   4. Return up to 2 closest siblings (§3.3 cardinality: max 2 sibling branches).
 *
 * Returns empty array when:
 *   - The entry has no divergence_cluster field.
 *   - No other entries share the same cluster.
 *
 * Sibling endpoints are REAL orbital positions — the sibling's own domain + date
 * coordinates (ontology §4.2). Sirius reads the returned Fiction[] records and
 * uses their domain + isoDate to compute p_endpoint per §4.3.
 *
 * @param slug - The slug of the fiction entry to find siblings for.
 * @returns Array of 0–2 Fiction records in ascending divergence-distance order.
 */
export async function getFictionSiblings(slug: string): Promise<Fiction[]> {
  const all = await loadFiction()
  const self = all.find((f) => f.slug === slug)
  if (!self || !self.divergence_cluster) return []

  const cluster = self.divergence_cluster
  const selfAlpha = _pickAlpha(self)

  return all
    .filter((f) => f.slug !== slug && f.divergence_cluster === cluster)
    .map((f) => ({ entry: f, dist: Math.abs(_pickAlpha(f) - selfAlpha) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 2)
    .map(({ entry }) => entry)
}

/**
 * Resolve an effective alpha value for a fiction entry.
 * Uses the first variant's alpha if present; falls back to SITE_ALPHA.
 * Internal helper — not exported.
 */
function _pickAlpha(f: Fiction): number {
  if (f.variants && f.variants.length > 0) {
    return parseFloat(f.variants[0].alpha)
  }
  return SITE_ALPHA
}
