/**
 * lib/store/types.ts
 * ---------------------------------------------------------------------------
 * Hand-written TypeScript interfaces for records served from the Supabase store.
 * Field-for-field identical to the velite-inferred shapes in lib/content/types.ts
 * so every consumer (Sirius, Altair) can swap imports without changing code.
 *
 * DL1: status (publish state) vs maturity (legacy velite `status` ladder).
 *   DB:   entries.status = 'draft'|'published'   entries.maturity = 'seed'|...'settled'
 *   API:  Article.draft = (status==='draft')      Article.status = maturity
 * DL13: served_coords is the only coords anon ever sees. Raw coords never
 *   reach these interfaces — map.ts consumes served_coords from the DB.
 *
 * Owner: Procyon (α-IDX-03) · store-as-source S3
 */

import type {
  PhotoExif,
  PhotoVariants,
  PhotoVariantEntry,
  FictionVariant,
  WorldlineLink,
  WorldlineEdge,
  WorldlineNeighborhood,
  GlobePin,
  ArticlePin,
  PhotoPin,
  FictionPin,
  PullquoteProps,
} from '../content/types'

// Re-export the sub-types that are pure TypeScript (not velite-dependent)
export type {
  PhotoExif,
  PhotoVariants,
  PhotoVariantEntry,
  FictionVariant,
  WorldlineLink,
  WorldlineEdge,
  WorldlineNeighborhood,
  GlobePin,
  ArticlePin,
  PhotoPin,
  FictionPin,
  PullquoteProps,
}

// ---------------------------------------------------------------------------
// Article — matches velite Article type (DL1 mapping applied)
// ---------------------------------------------------------------------------

export interface Article {
  /** Zero-padded file number, e.g. "003". Route param + Globe pin ID. */
  fileNum: string
  kind: 'article'
  title: string
  /** Display date YYYY.MM.DD */
  date: string
  /** ISO 8601 date for sort, e.g. "2026-05-07" */
  isoDate: string
  domain: 'identity' | 'reflection' | 'method' | 'meta'
  tags: string[]
  /**
   * DL1: served Article.status = maturity value ('seed'|'ongoing'|'refined'|'settled').
   * The DB column is `maturity`; the consumer-facing field stays `status` for compat.
   */
  status: 'seed' | 'ongoing' | 'refined' | 'settled'
  readingTime: number
  summary: string
  /** Published round-2 coords (served_coords from DB). Never raw. */
  coords: { lat: number; lon: number; place: string }
  patches: Array<{ n: number; date: string; note: string }>
  shareLocation: boolean
  placeId?: string
  highlightForPlace: boolean
  /** DL1: draft = (DB status === 'draft') */
  draft: boolean
  worldline_links: WorldlineLink[]
  body: string
}

// ---------------------------------------------------------------------------
// Fiction — matches velite Fiction type
// ---------------------------------------------------------------------------

export interface Fiction {
  slug: string
  kind: 'fiction'
  title: string
  date: string
  isoDate: string
  domain: 'identity' | 'reflection' | 'method' | 'meta'
  tags: string[]
  summary: string
  originLocus?: { lat: number; lon: number; place: string }
  variants: FictionVariant[]
  divergence_cluster?: string
  draft: boolean
  worldline_links: WorldlineLink[]
  body: string
}

// ---------------------------------------------------------------------------
// Photo — roll-level descriptor (maps from rolls table)
// Matches velite Photo type (roll.mdx descriptor)
// ---------------------------------------------------------------------------

export interface Photo {
  /** Roll directory slug, e.g. "2026-05-bangkok" */
  roll: string
  /**
   * Legacy roll.mdx `id` field — the primary photo id for this roll descriptor.
   * Console photo nodes read Photo.id (app/console/page.tsx:155–161) — kept for compat.
   * Sourced from rolls.id column (§2.3).
   */
  id: string
  kind: 'photo'
  caption?: string
  shareLocation: boolean
  coords?: { lat: number; lon: number; place: string }
  /** Trigger-maintained served coords (null when shareLocation=false) */
  servedCoords?: { lat: number; lon: number; place: string }
  date: string
  isoDate: string
  body: string
}

// ---------------------------------------------------------------------------
// PhotoSidecar — per-photo sidecar (maps from entries where kind='photo' + photo_assets)
// Matches velite PhotoSidecar type
// ---------------------------------------------------------------------------

/** Authored overrides for instrument display fields. Keys match DB jsonb keys. */
export interface InstrumentOverrides {
  lens?: string
  camera?: string
  iso?: number
  aperture?: number
  shutter?: string
  focal?: number
}

export interface PhotoSidecar {
  roll: string
  id: string
  kind: 'photo-sidecar'
  caption?: string
  shareLocation: boolean
  overridePlace?: string
  date: string
  isoDate: string
  placeId?: string
  highlightRank?: number
  draft: boolean
  worldline_links: WorldlineLink[]
  /**
   * Served EXIF — instrument_overrides already merged in by map.ts.
   * Display value = instrument_overrides.<key> ?? photo_assets.exif.<key>.
   * photo_assets.exif stays RAW sensor truth; this field is the merged result.
   * Null when pipeline not run yet AND no overrides set.
   */
  exif?: PhotoExif
  /** Variants from photo_assets — null when pipeline not run yet */
  variants?: PhotoVariants
  /**
   * GPS-gated served coords (DL13). Only defined when shareLocation=true.
   * Derived from served_coords column in entries table (trigger-maintained).
   */
  servedCoords?: { lat: number; lon: number; place: string }
  /**
   * Raw authored overrides as stored in DB — exposed so the console editor
   * can read/display/write the override values independently from EXIF.
   * Null when no overrides have been set.
   */
  instrumentOverrides?: InstrumentOverrides
  body: string
}

// ---------------------------------------------------------------------------
// Place — matches the existing Place shape from place-registry.ts
// place-registry.ts Place.coord = { lat, lon } (NOT top-level lat/lon).
// This must stay field-for-field identical to the zod-inferred type.
// ---------------------------------------------------------------------------

export interface Place {
  id: string
  level: 1 | 2
  parentId: string | null
  name: string
  coord: {
    lat: number
    lon: number
  }
}
