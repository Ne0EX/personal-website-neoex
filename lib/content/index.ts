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
} from './articles'

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
