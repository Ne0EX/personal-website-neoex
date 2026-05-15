/**
 * lib/content/fiction.ts
 * ----------------------
 * Fiction query helpers.
 *
 * Fiction entries ship as diamond glyphs in the NeX orbital layer (journey-arch §2.2).
 * Entry surfaces are deferred (§3.4); these helpers exist now so TASK-33 (Globe glyph
 * extension) and future fiction-route TASKs have a stable import.
 *
 * Owner: Procyon (α-IDX-03) · TASK-2026-05-15-22
 */
import type { Fiction } from './types'

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
