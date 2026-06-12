/**
 * lib/content/places.ts
 * ---------------------
 * Place-aware globe query API — store-as-source version.
 *
 * S3 store-as-source: registry reads from the `places` Supabase table.
 * `assertHighlightConstraints` becomes a no-op shim — the DB unique indexes
 * (§2.4 one_article_highlight_per_place + photo_rank_unique_per_place) enforce
 * cross-record constraints at the trust boundary. The shim is kept for call-site
 * compat (lib/content/places.ts consumers call it; removing it breaks callers).
 *
 * DL15: place WRITES go to §7 store actions; place-registry.data.json is FROZEN.
 * deriveArticlePlaceId / derivePhotoPlaceId fallback logic stays pure/unchanged.
 *
 * Owner: Procyon (α-IDX-03) · store-as-source S3
 */

import type { Article, PhotoSidecar } from './types'
import { getArticles } from './articles'
import { getPhotoSidecars } from './photos'
import { getAllPlacesFromStore } from '../store/reads'
import {
  deriveArticlePlaceId,
  derivePhotoPlaceId,
} from './place-registry'
import type { Place } from '../store/types'

export type { Place } from '../store/types'

// ---------------------------------------------------------------------------
// Enriched place result types (unchanged signatures for consumers)
// ---------------------------------------------------------------------------

export type PlacedArticle = Article & {
  effectivePlaceId: string | undefined
}

export type PlacedSidecar = PhotoSidecar & {
  effectivePlaceId: string | undefined
  thumbWebp: string | undefined
}

export type PlaceHighlights = {
  articleHighlight: PlacedArticle | null
  photoHighlights: PlacedSidecar[]
  hasHighlights: boolean
}

export type PlaceContent = {
  place: Place
  articles: PlacedArticle[]
  sidecars: PlacedSidecar[]
  weight: number
  highlights: PlaceHighlights
}

export type PlaceSummary = {
  place: Place
  weight: number
  hasHighlights: boolean
}

// ---------------------------------------------------------------------------
// Internal helpers
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

/**
 * No-op shim: DB unique indexes enforce highlight constraints at the trust
 * boundary. The function is retained so callers compile unchanged.
 */
function assertHighlightConstraints(
  _articles: PlacedArticle[],
  _sidecars: PlacedSidecar[],
): void {
  // DL §2.4: constraints enforced by DB indexes (one_article_highlight_per_place,
  // photo_rank_unique_per_place). Application-level check is a no-op shim.
}

async function getAllPlacedArticles(includeHidden = false): Promise<PlacedArticle[]> {
  const articles = await getArticles()
  // Public reads (RLS) exclude drafts; includeHidden is a no-op here because
  // the admin path uses admin-reads.ts directly.
  return articles.map(enrichArticle)
}

async function getAllPlacedSidecars(includeHidden = false): Promise<PlacedSidecar[]> {
  const sidecars = await getPhotoSidecars()
  return sidecars.map(enrichSidecar)
}

// ---------------------------------------------------------------------------
// Public query API (unchanged signatures)
// ---------------------------------------------------------------------------

export async function getPlacesSummary(includeHidden = false): Promise<PlaceSummary[]> {
  const [articles, sidecars, places] = await Promise.all([
    getAllPlacedArticles(includeHidden),
    getAllPlacedSidecars(includeHidden),
    getAllPlacesFromStore(),
  ])

  assertHighlightConstraints(articles, sidecars)

  return places.map((place) => {
    const placeArticles = articles.filter((a) => a.effectivePlaceId === place.id)
    const placeSidecars = sidecars.filter((s) => s.effectivePlaceId === place.id)
    const weight = placeArticles.length + placeSidecars.length

    const hasHighlights =
      placeArticles.some((a) => a.highlightForPlace) ||
      placeSidecars.some((s) => s.highlightRank != null)

    return { place, weight, hasHighlights }
  }).sort((a, b) => b.weight - a.weight)
}

export async function getPlaceContent(placeId: string, includeHidden = false): Promise<PlaceContent | null> {
  const places = await getAllPlacesFromStore()
  const place = places.find((p) => p.id === placeId)
  if (!place) return null

  const [articles, sidecars] = await Promise.all([
    getAllPlacedArticles(includeHidden),
    getAllPlacedSidecars(includeHidden),
  ])

  assertHighlightConstraints(articles, sidecars)

  const placeArticles = articles
    .filter((a) => a.effectivePlaceId === placeId)
    .sort((a, b) => {
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

  return {
    place,
    articles: placeArticles,
    sidecars: placeSidecars,
    weight: placeArticles.length + placeSidecars.length,
    highlights,
  }
}

export async function getPlaceHighlights(placeId: string): Promise<PlaceHighlights | null> {
  const places = await getAllPlacesFromStore()
  const place = places.find((p) => p.id === placeId)
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

export async function getArticlesAtPlace(placeId: string, includeHidden = false): Promise<PlacedArticle[]> {
  const articles = await getAllPlacedArticles(includeHidden)
  return articles
    .filter((a) => a.effectivePlaceId === placeId)
    .sort((a, b) => b.isoDate.localeCompare(a.isoDate))
}

export async function getSidecarsAtPlace(placeId: string, includeHidden = false): Promise<PlacedSidecar[]> {
  const sidecars = await getAllPlacedSidecars(includeHidden)
  return sidecars
    .filter((s) => s.effectivePlaceId === placeId)
    .sort((a, b) => {
      if (a.roll !== b.roll) return a.roll.localeCompare(b.roll)
      return a.id.localeCompare(b.id)
    })
}

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

export async function getAllPlaces(): Promise<readonly Place[]> {
  return getAllPlacesFromStore()
}
