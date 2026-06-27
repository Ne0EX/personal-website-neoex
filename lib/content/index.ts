/**
 * lib/content/index.ts
 * --------------------
 * Content-layer utilities consumed by Sirius (components) and Altair (API routes).
 * All data originates from the velite cache (.velite/), built from content/*.mdx.
 *
 * Import pattern for consumers:
 *   import { getArticles, getArticleByFileNum } from '@/lib/content'
 *
 * Do NOT import directly from '.velite' in components — go through this module.
 * This gives us a single choke point if velite output shape changes.
 *
 * Owner: Procyon (α-IDX-03) · TASK-2026-05-15-22
 */

// Re-export inferred types so consumers have them without importing velite directly.
export type {
  Article,
  Fiction,
  Photo,
  PhotoSidecar,
  PhotoExif,
  PhotoVariants,
  PhotoVariantEntry,
  FictionVariant,
  // Worldline-weave types — S3 (VISION-2026-05-31 §2.1)
  WorldlineLink,
  WorldlineEdge,
  WorldlineNeighborhood,
} from './types'

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

export {
  getArticles,
  getArticleByFileNum,
  getRecentArticles,
  getRelatedArticles,
  getPublishedArticleCount,
  getNextEntries,
} from './articles'

// ---------------------------------------------------------------------------
// Worldline Stats — STRATUM READOUT aggregate (home observatory)
// ---------------------------------------------------------------------------

export { getWorldlineStats } from '../store/reads'

export type { NextEntry } from './articles'

// ---------------------------------------------------------------------------
// Fiction
// ---------------------------------------------------------------------------

export {
  getFiction,
  getFictionBySlug,
  getFictionSiblings,
} from './fiction'

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

export {
  // Roll-level descriptors (roll.mdx)
  getPhotos,
  getPhotosByRoll,
  // Per-photo sidecar records with EXIF + variants (DSCF*.mdx) — TASK-30
  getPhotoSidecars,
  getSidecarsInRoll,
  getPhotoById,
  getRollNavigation,
  // Globe eligibility (privacy-gated)
  getGlobeEligiblePhotos,
} from './photos'
// NOTE: getAllArticles/getAllFiction/getAllPhotoSidecars are NOT exported from
// lib/content (they drag lib/store/supabase/server.ts into client bundles).
// Import them directly from '@/lib/store/admin-reads' in server-only contexts.

// ---------------------------------------------------------------------------
// Globe pin aggregate (all content types as typed pin records)
// ---------------------------------------------------------------------------

export {
  getAllGlobePins,
} from './globe-pins'

// ---------------------------------------------------------------------------
// Worldline-weave helpers — S3 (VISION-2026-05-31 §2.1)
// lib/content/worldline.ts — reverse-lookup + 1-hop neighbourhood
// ---------------------------------------------------------------------------

export {
  getOutgoingLinks,
  getIncomingLinks,
  get1HopNeighborhood,
  resolveNeighborhood,
} from './worldline'

export type {
  ResolvedNeighbor,
  ResolvedNeighborhood,
} from './worldline'

// ---------------------------------------------------------------------------
// Photo sidecar — by roll+id (S1 roll-index; also used by worldline reverse-lookup)
// ---------------------------------------------------------------------------

export {
  getPhotoByRollAndId,
} from './photos'

// ---------------------------------------------------------------------------
// Place-aware globe — place entity, query API, highlights
// Spec: place-aware-globe-spec.md §14
// ---------------------------------------------------------------------------

export type {
  Place,
  PlacedArticle,
  PlacedSidecar,
  PlaceHighlights,
  PlaceContent,
  PlaceSummary,
} from './types'

export {
  // All registered L1 places (globe nodes, console rail)
  getAllPlaces,
  // Per-place weights (globe ring density, NETRA "N RECORDS ARCHIVED")
  getPlacesSummary,
  getPlaceWeight,
  // Full content + highlights (globe panel + dig-to-all)
  getPlaceContent,
  // Highlights only (globe panel initial open)
  getPlaceHighlights,
  // Filtered lists for highlight editor (console curation)
  getArticlesAtPlace,
  getSidecarsAtPlace,
  // Alpha locus — the one place that is the globe's observer home coordinate
  getAlphaPlace,
} from './places'

// ---------------------------------------------------------------------------
// Archive ledger — cross-stratum /archive route (docs/design/21-archive-route.md §7.2)
// ---------------------------------------------------------------------------

export {
  getArchiveEntries,
  getArchiveEntriesByYear,
  getMiniGlobePins,
} from './archive'

export type {
  ArchiveEntry,
  ArchiveArticle,
  ArchivePhoto,
  ArchiveFiction,
  MiniGlobePin,
  GetArchiveEntriesOptions,
} from './archive'
