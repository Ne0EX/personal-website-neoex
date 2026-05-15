/**
 * lib/content/globe-pins.ts
 * -------------------------
 * Aggregates all content types into a single typed GlobePin array.
 *
 * Consumed by:
 * - WorldlineGlobe.tsx (TASK-33) — to render per-kind glyphs
 * - NETRA tool calls (TASK-51) — to answer "what's on the Globe?"
 *
 * Article pins: Ne0 surface, circle glyph
 * Photo pins: Ne0 surface, square glyph (GPS-opted-in only)
 * Fiction pins: NeX orbit, diamond glyph (placement by meaning-coords in TASK-33)
 *
 * Owner: Procyon (α-IDX-03) · TASK-2026-05-15-22
 */
import type { GlobePin, ArticlePin, FictionPin } from './types'
import { getArticles } from './articles'
import { getFiction } from './fiction'
import { getGlobeEligiblePhotos } from './photos'

/**
 * All content items that should appear as Globe pins, aggregated into a
 * single discriminated union array.
 *
 * Each entry carries its `kind` field so downstream consumers can switch on it
 * without external lookups.
 */
export async function getAllGlobePins(): Promise<GlobePin[]> {
  const [articles, fiction, photos] = await Promise.all([
    getArticles(),
    getFiction(),
    getGlobeEligiblePhotos(),
  ])

  const articlePins: ArticlePin[] = articles.map((a) => ({
    kind: 'article',
    fileNum: a.fileNum,
    title: a.title,
    summary: a.summary,
    coords: a.coords,
    isoDate: a.isoDate,
    domain: a.domain,
    status: a.status,
    tags: a.tags,
  }))

  const fictionPins: FictionPin[] = fiction.map((f) => ({
    kind: 'fiction',
    slug: f.slug,
    title: f.title,
    summary: f.summary,
    domain: f.domain,
    isoDate: f.isoDate,
    tags: f.tags,
  }))

  return [
    ...articlePins,
    ...photos,
    ...fictionPins,
  ]
}
