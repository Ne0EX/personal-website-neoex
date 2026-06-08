/**
 * lib/content/places.ts
 * ---------------------
 * Build-time query API for the place-aware globe.
 *
 * This is the single choke-point consumers import to answer place-related
 * questions. The globe, console, and highlight panel all import from here.
 * Do NOT import from place-registry.ts directly in UI code.
 *
 * DATA MODEL (per place-aware-globe-spec.md §2 + §14):
 *   - Place atoms live in lib/content/place-registry.ts (static, zod-validated)
 *   - Articles have optional `placeId` + `highlightForPlace` fields (velite schema)
 *   - Photo sidecars have optional `placeId` + `highlightRank` fields (velite schema)
 *   - `weight` is computed here by scanning content — NOT stored in the registry
 *   - `placeId` on content: explicit frontmatter value wins; fallback to derived
 *
 * DERIVATION FALLBACK (avoids a migration on existing MDX):
 *   - Articles: derive placeId from coords.place string (articles always have coords)
 *   - Photos:   derive placeId from roll slug (public, privacy-safe — see place-registry.ts)
 *   No existing MDX files need to be modified for places to function.
 *
 * CROSS-RECORD CONSTRAINTS (cannot be per-file zod; enforced here as build-time assertions):
 *   - At most 1 article per place may have highlightForPlace=true
 *   - At most 5 sidecars per place may have highlightRank set (1–5)
 *   Violations throw (fail the build) rather than silently degrade.
 *
 * REAL-PHOTO CONSUMPTION (per spec §14 item 7):
 *   Photo sidecars already carry `variants.thumb.webp` (from process-photos cache).
 *   When the cache has NOT been run, `variants` is undefined → `thumbWebp` is undefined.
 *   The query API exposes `thumbWebp` on sidecar results WITHOUT gating on shareLocation.
 *   Reasoning: thumbnails belong to the roll entry page (already public at /photos/<roll>).
 *   ShareLocation gates precise GPS surfacing, not the thumbnail path.
 *   CURRENT STATE: process-photos has not been run; all thumbWebp values will be undefined
 *   until the pipeline runs. The consumer (highlight strip) must handle undefined gracefully.
 *
 * Owner: Procyon (α-IDX-03) · place-aware-globe-spec.md §14 item 5
 * Consumed by: globe (Sirius), console/highlight editor (Sirius), NETRA (Altair)
 */

import type { Article, PhotoSidecar } from './types'
import {
  PLACE_REGISTRY,
  getPlaceById,
  deriveArticlePlaceId,
  derivePhotoPlaceId,
} from './place-registry'
import type { Place } from './place-registry'
import { isHiddenFromPublic } from './visibility'

export type { Place } from './place-registry'

// ---------------------------------------------------------------------------
// Enriched place result types
// ---------------------------------------------------------------------------

/**
 * An article record enriched with its effective placeId.
 * The `effectivePlaceId` is either the frontmatter `placeId` or the derived fallback.
 * Undefined when the article could not be matched to any registered place.
 */
export type PlacedArticle = Article & {
  effectivePlaceId: string | undefined
}

/**
 * A photo sidecar record enriched with its effective placeId.
 */
export type PlacedSidecar = PhotoSidecar & {
  effectivePlaceId: string | undefined
  /** Thumbnail webp path from variants.thumb.webp. Undefined if pipeline not run. */
  thumbWebp: string | undefined
}

/**
 * Curated highlights for a place.
 * Both article and photos are optional — a place may have photo-only or article-only
 * highlights, or no highlights set at all.
 *
 * Spec §4.1: three valid highlight states (full / photo-only / article-only / none).
 */
export type PlaceHighlights = {
  /** The curated article highlight, or null when not set. */
  articleHighlight: PlacedArticle | null
  /** Photo highlight frames, ordered by highlightRank ascending (1 = first in strip). Max 5. */
  photoHighlights: PlacedSidecar[]
  /** Whether any highlight is set (article or photo). Drives panel vs. DIG DEEPER state. */
  hasHighlights: boolean
}

/**
 * All content at a place (the "dig to all" expansion).
 * Ordered: highlights first (article, then photos by rank), then remaining by date descending.
 *
 * Spec §4.3 dig-to-all layout + spec §14 item 5.
 */
export type PlaceContent = {
  place: Place
  /** All articles at this place. Sorted: highlight first, then isoDate descending. */
  articles: PlacedArticle[]
  /**
   * All photo sidecars at this place.
   * Sorted: highlight frames first (by rank), then isoDate descending.
   */
  sidecars: PlacedSidecar[]
  /** Total content count (articles + sidecars). Used as `weight` for ring density. */
  weight: number
  highlights: PlaceHighlights
}

/**
 * Summary record per place — for the globe node and console rail.
 * Lightweight; consumers call getPlaceContent() only when a place is opened.
 */
export type PlaceSummary = {
  place: Place
  weight: number
  hasHighlights: boolean
}

// ---------------------------------------------------------------------------
// Module-level caches — same lazy pattern as articles.ts / photos.ts
// ---------------------------------------------------------------------------

let _articles: Article[] | null = null
let _sidecars: PhotoSidecar[] | null = null

async function loadArticles(): Promise<Article[]> {
  if (_articles) return _articles
  const cache = await import('../../.velite')
  _articles = cache.articles as Article[]
  return _articles
}

async function loadSidecars(): Promise<PhotoSidecar[]> {
  if (_sidecars) return _sidecars
  const cache = await import('../../.velite')
  _sidecars = (cache.photoSidecars as PhotoSidecar[]) ?? []
  return _sidecars
}

// ---------------------------------------------------------------------------
// Internal helpers — effective place resolution
// ---------------------------------------------------------------------------

function enrichArticle(a: Article): PlacedArticle {
  const effectivePlaceId = a.placeId ?? deriveArticlePlaceId(a.coords.place)
  return { ...a, effectivePlaceId }
}

function enrichSidecar(s: PhotoSidecar): PlacedSidecar {
  const effectivePlaceId = s.placeId ?? derivePhotoPlaceId(s.roll)
  return {
    ...s,
    effectivePlaceId,
    thumbWebp: s.variants?.thumb.webp,
  }
}

// ---------------------------------------------------------------------------
// Cross-record constraint assertions
// Separate function: called at the start of expensive queries so a build with
// bad frontmatter fails loudly rather than silently returning wrong results.
// ---------------------------------------------------------------------------

function assertHighlightConstraints(
  articles: PlacedArticle[],
  sidecars: PlacedSidecar[],
): void {
  // Constraint 1: at most 1 article highlight per place
  const articleHighlightsByPlace = new Map<string, string[]>()
  for (const a of articles) {
    if (a.highlightForPlace && a.effectivePlaceId) {
      const existing = articleHighlightsByPlace.get(a.effectivePlaceId) ?? []
      existing.push(a.fileNum)
      articleHighlightsByPlace.set(a.effectivePlaceId, existing)
    }
  }
  for (const [placeId, fileNums] of articleHighlightsByPlace.entries()) {
    if (fileNums.length > 1) {
      throw new Error(
        `place-aware-globe: constraint violation — place "${placeId}" has ${fileNums.length} article highlights (${fileNums.join(', ')}). Only 1 is allowed. Fix frontmatter: set highlightForPlace: false on all but one.`,
      )
    }
  }

  // Constraint 2: at most 5 photo highlight frames per place
  const photoHighlightsByPlace = new Map<string, string[]>()
  for (const s of sidecars) {
    if (s.highlightRank != null && s.effectivePlaceId) {
      const existing = photoHighlightsByPlace.get(s.effectivePlaceId) ?? []
      existing.push(`${s.roll}/${s.id}`)
      photoHighlightsByPlace.set(s.effectivePlaceId, existing)
    }
  }
  for (const [placeId, frames] of photoHighlightsByPlace.entries()) {
    if (frames.length > 5) {
      throw new Error(
        `place-aware-globe: constraint violation — place "${placeId}" has ${frames.length} photo highlights (${frames.join(', ')}). Max 5 frames allowed. Fix frontmatter: clear highlightRank on excess frames.`,
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Main query API
// ---------------------------------------------------------------------------

/**
 * All enriched articles with their effective placeId resolved.
 * Internal — used by other functions in this module.
 *
 * @param includeHidden - When true, includes draft entries (console/authoring).
 *   Default false — public surfaces exclude drafts in production.
 */
async function getAllPlacedArticles(includeHidden = false): Promise<PlacedArticle[]> {
  const articles = await loadArticles()
  const visible = includeHidden
    ? articles
    : articles.filter((a) => !isHiddenFromPublic(a))
  return visible.map(enrichArticle)
}

/**
 * All enriched sidecars with their effective placeId resolved.
 * Internal — used by other functions in this module.
 *
 * @param includeHidden - When true, includes draft entries (console/authoring).
 *   Default false — public surfaces exclude drafts in production.
 */
async function getAllPlacedSidecars(includeHidden = false): Promise<PlacedSidecar[]> {
  const sidecars = await loadSidecars()
  const visible = includeHidden
    ? sidecars
    : sidecars.filter((s) => !isHiddenFromPublic(s))
  return visible.map(enrichSidecar)
}

/**
 * Returns a summary for every registered L1 place, with computed weight.
 *
 * Used by: globe (all place nodes, ring density), console PLACES rail.
 *
 * Weight = count of articles + count of sidecars whose effectivePlaceId matches.
 * This matches the frame-level granularity used in ring density (spec §3.1 thresholds:
 * ring-2 at ≥3, ring-3 at ≥7 content items).
 *
 * Sorted by weight descending (densest places first — globe ordering by interest).
 *
 * @param includeHidden - When true, includes drafts in weight/highlight computation
 *   (console). Default false (public globe, ring density).
 */
export async function getPlacesSummary(includeHidden = false): Promise<PlaceSummary[]> {
  const [articles, sidecars] = await Promise.all([
    getAllPlacedArticles(includeHidden),
    getAllPlacedSidecars(includeHidden),
  ])

  assertHighlightConstraints(articles, sidecars)

  return PLACE_REGISTRY.map((place) => {
    const placeArticles = articles.filter((a) => a.effectivePlaceId === place.id)
    const placeSidecars = sidecars.filter((s) => s.effectivePlaceId === place.id)
    const weight = placeArticles.length + placeSidecars.length

    const hasHighlights =
      placeArticles.some((a) => a.highlightForPlace) ||
      placeSidecars.some((s) => s.highlightRank != null)

    return { place, weight, hasHighlights }
  }).sort((a, b) => b.weight - a.weight)
}

/**
 * Full content + highlights for a single place.
 *
 * Used by: globe front-door panel (highlights display + dig-to-all expansion),
 *          highlight editor in the console (available content to curate from).
 *
 * Returns null when the placeId is not in the registry.
 *
 * Content ordering (spec §14 item 5):
 *   Articles: highlight first, then remaining by isoDate descending.
 *   Sidecars: highlight frames first (by rank ascending), then by isoDate descending.
 *
 * @param includeHidden - When true, includes draft entries in the returned lists.
 *   Pass true from the console/editor so the curation pickers show all content.
 *   Default false (public globe panel).
 */
export async function getPlaceContent(placeId: string, includeHidden = false): Promise<PlaceContent | null> {
  const place = getPlaceById(placeId)
  if (!place) return null

  const [articles, sidecars] = await Promise.all([
    getAllPlacedArticles(includeHidden),
    getAllPlacedSidecars(includeHidden),
  ])

  assertHighlightConstraints(articles, sidecars)

  const placeArticles = articles
    .filter((a) => a.effectivePlaceId === placeId)
    .sort((a, b) => {
      // Highlight first, then newest isoDate
      if (a.highlightForPlace && !b.highlightForPlace) return -1
      if (!a.highlightForPlace && b.highlightForPlace) return 1
      return b.isoDate.localeCompare(a.isoDate)
    })

  const placeSidecars = sidecars
    .filter((s) => s.effectivePlaceId === placeId)
    .sort((a, b) => {
      const aRank = a.highlightRank ?? Infinity
      const bRank = b.highlightRank ?? Infinity
      if (aRank !== bRank) return aRank - bRank
      return b.isoDate.localeCompare(a.isoDate)
    })

  const articleHighlight = placeArticles.find((a) => a.highlightForPlace) ?? null
  const photoHighlights = placeSidecars
    .filter((s) => s.highlightRank != null)
    .sort((a, b) => (a.highlightRank ?? 0) - (b.highlightRank ?? 0))

  const highlights: PlaceHighlights = {
    articleHighlight,
    photoHighlights,
    hasHighlights: articleHighlight !== null || photoHighlights.length > 0,
  }

  const weight = placeArticles.length + placeSidecars.length

  return {
    place,
    articles: placeArticles,
    sidecars: placeSidecars,
    weight,
    highlights,
  }
}

/**
 * Highlights only for a single place.
 *
 * Lighter than getPlaceContent() — skips loading the full dig-to-all list.
 * Used by: globe front-door panel (first open, before DIG DEEPER).
 *
 * Returns null when the placeId is not in the registry.
 * Drafts are excluded (public surface — no includeHidden param here).
 */
export async function getPlaceHighlights(placeId: string): Promise<PlaceHighlights | null> {
  const place = getPlaceById(placeId)
  if (!place) return null

  const [articles, sidecars] = await Promise.all([
    getAllPlacedArticles(false),
    getAllPlacedSidecars(false),
  ])

  assertHighlightConstraints(articles, sidecars)

  const articleHighlight =
    articles.find((a) => a.effectivePlaceId === placeId && a.highlightForPlace) ?? null

  const photoHighlights = sidecars
    .filter((s) => s.effectivePlaceId === placeId && s.highlightRank != null)
    .sort((a, b) => (a.highlightRank ?? 0) - (b.highlightRank ?? 0))

  return {
    articleHighlight,
    photoHighlights,
    hasHighlights: articleHighlight !== null || photoHighlights.length > 0,
  }
}

/**
 * All articles at a given place, sorted by isoDate descending.
 *
 * Used by: highlight editor article picker (typeahead, filters to this place only).
 * Spec §5.3: "search / select from articles at this place".
 *
 * @param includeHidden - When true, includes draft entries (console picker).
 *   Default false (public surface).
 */
export async function getArticlesAtPlace(placeId: string, includeHidden = false): Promise<PlacedArticle[]> {
  const articles = await getAllPlacedArticles(includeHidden)
  return articles
    .filter((a) => a.effectivePlaceId === placeId)
    .sort((a, b) => b.isoDate.localeCompare(a.isoDate))
}

/**
 * All photo sidecars at a given place, sorted by roll + id ascending (capture sequence).
 * Includes thumbWebp for the highlight strip and editor thumbnail slots.
 *
 * Used by: highlight editor photo picker (frame-level, individual sidecar selection).
 * Spec §5.3: "frame, not roll" unit for highlight strip.
 *
 * PRIVACY NOTE: NOT gated on shareLocation. Roll membership (via roll slug) is
 * public information — roll index pages (/photos/<roll>) are public. GPS coords
 * are a separate concern handled by servedCoords in the velite transform.
 *
 * @param includeHidden - When true, includes draft entries (console picker).
 *   Default false (public surface).
 */
export async function getSidecarsAtPlace(placeId: string, includeHidden = false): Promise<PlacedSidecar[]> {
  const sidecars = await getAllPlacedSidecars(includeHidden)
  return sidecars
    .filter((s) => s.effectivePlaceId === placeId)
    .sort((a, b) => {
      if (a.roll !== b.roll) return a.roll.localeCompare(b.roll)
      return a.id.localeCompare(b.id)
    })
}

/**
 * Returns the weight (content count) for a single place.
 *
 * Used by: NETRA voice strip — "PLACE · {NAME} · {N} RECORDS ARCHIVED"
 *          Globe ring density — weight drives ring-2 (≥3) and ring-3 (≥7) visibility.
 *
 * Returns 0 when the placeId is not in the registry.
 * Drafts are excluded from the public weight (public surface).
 */
export async function getPlaceWeight(placeId: string): Promise<number> {
  const [articles, sidecars] = await Promise.all([
    getAllPlacedArticles(),
    getAllPlacedSidecars(),
  ])
  return (
    articles.filter((a) => a.effectivePlaceId === placeId).length +
    sidecars.filter((s) => s.effectivePlaceId === placeId).length
  )
}

/**
 * All registered L1 places, in registry order.
 * Thin wrapper for consumers that need the raw place list without weights.
 *
 * Used by: globe (place node placement), console NEW PLACE picker.
 */
export function getAllPlaces(): readonly Place[] {
  return PLACE_REGISTRY
}
