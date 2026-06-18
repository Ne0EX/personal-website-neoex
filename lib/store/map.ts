/**
 * lib/store/map.ts
 * ---------------------------------------------------------------------------
 * Contract-preserving mapper: raw Supabase DB rows → served record shapes
 * (Article / Fiction / Photo / PhotoSidecar / Place).
 *
 * Key mapping contracts (spec §6.2):
 *   DL1:  draft = (status === 'draft'); Article.status (served) = maturity
 *   DL13: served_coords is the ONLY coords anon sees; map.ts reads it here.
 *         Raw coords never reaches anon — the column grant in §3.2 enforces this
 *         at the DB boundary. We consume served_coords, not coords.
 *   isoDate: iso_date column (YYYY-MM-DD) → string form
 *   photo variants: bucket-relative keys → full public URLs via media.ts
 *
 * Owner: Procyon (α-IDX-03) · store-as-source S3
 */

import { publicVariantUrl } from './media'
import type { Article, Fiction, Photo, PhotoSidecar, Place, InstrumentOverrides } from './types'
import type { PhotoExif, PhotoVariants, WorldlineLink, FictionVariant } from '../content/types'

// ---------------------------------------------------------------------------
// DB row shapes (raw — what Supabase returns, anon-column-granted subset)
// ---------------------------------------------------------------------------

/** Authored overrides for instrument fields — lens is required for manual/adapted lenses. */
export interface DbInstrumentOverrides {
  lens?: string
  camera?: string
  iso?: number
  aperture?: number
  shutter?: string
  focal?: number
}

export interface DbEntryRow {
  id: string
  kind: 'article' | 'fiction' | 'photo'
  slug: string
  status: 'draft' | 'published'
  title: string | null
  date: string
  iso_date: string
  domain: string | null
  tags: string[]
  summary: string | null
  // Raw authored coords — anon column grant EXCLUDES this (DL13). Only present
  // when the admin read (authenticated owner) explicitly selects it. The anon
  // client never sees this field; served_coords (below) is the public variant.
  coords?: { lat: number; lon: number; place: string } | null
  served_coords: { lat: number; lon: number; place: string } | null
  share_location: boolean
  place_id: string | null
  highlight_for_place: boolean
  patches: Array<{ n: number; date: string; note: string }>
  worldline_links: WorldlineLink[]
  body: string
  maturity: 'seed' | 'ongoing' | 'refined' | 'settled' | null
  reading_time: number | null
  origin_locus: { lat: number; lon: number; place: string } | null
  variants: FictionVariant[] | null   // fiction variants jsonb
  divergence_cluster: string | null
  roll: string | null
  photo_id: string | null
  caption: string | null
  override_place: string | null
  highlight_rank: number | null
  /** Authored instrument overrides — anon-granted (public display data, not coords). */
  instrument_overrides: DbInstrumentOverrides | null
  /**
   * Authored film-sim override for photo entries.
   * NULL = fall back to photo_assets.exif.filmSim.
   * Set via updateEntry patch; never derived from sensor EXIF.
   */
  film_sim: string | null
  /**
   * Language of this sibling (translation-group model, DL1 / SPEC-2026-06-18 §3.1).
   * 'en' for all existing rows (backfilled by P1 migration DEFAULT 'en').
   * Anon-granted (public display/routing metadata, NOT a security boundary).
   */
  lang: string
}

export interface DbPhotoAssetRow {
  entry_id: string
  exif: PhotoExif | null
  variants: DbVariantKeys | null
  // original_key and source_hash are anon-revoked — not in this interface
}

/** Bucket-relative keys as stored in photo_assets.variants jsonb */
export interface DbVariantKeys {
  thumb?: { jpg: string; webp: string; avif: string }
  medium?: { jpg: string; webp: string; avif: string }
  full?: { jpg: string; webp: string; avif: string }
}

export interface DbRollRow {
  roll: string
  id: string
  caption: string | null
  share_location: boolean
  served_coords: { lat: number; lon: number; place: string } | null
  date: string
  iso_date: string
  body: string
}

export interface DbPlaceRow {
  id: string
  level: number
  parent_id: string | null
  name: string
  lat: number
  lon: number
  /** True for the one alpha-locus place (0009_alpha_locus migration). */
  is_alpha: boolean
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

/**
 * Maps a DB entries row (kind='article') to the served Article interface.
 * DL1: served status = maturity; draft = (status==='draft').
 * DL13: coords consumed from served_coords (trigger-maintained; never raw coords).
 */
export function mapArticle(row: DbEntryRow): Article {
  return {
    fileNum: row.slug,
    kind: 'article',
    title: row.title ?? '',
    date: row.date,
    isoDate: row.iso_date,
    domain: (row.domain ?? 'meta') as Article['domain'],
    tags: row.tags ?? [],
    // DL1: served Article.status = maturity field
    status: (row.maturity ?? 'seed') as Article['status'],
    readingTime: row.reading_time ?? 0,
    summary: row.summary ?? '',
    // DL13: served_coords is what we expose (never raw coords)
    coords: row.served_coords ?? { lat: 0, lon: 0, place: '' },
    patches: row.patches ?? [],
    shareLocation: row.share_location,
    placeId: row.place_id ?? undefined,
    highlightForPlace: row.highlight_for_place,
    // DL1: draft = (DB status === 'draft')
    draft: row.status === 'draft',
    worldline_links: row.worldline_links ?? [],
    body: row.body ?? '',
    // Translation-group: pass the served sibling's lang through (§3.1).
    // Consumers use this for the region lang attribute (§6.2) — it reflects the
    // actual sibling language, not the URL locale (they differ on fallback).
    lang: row.lang ?? 'en',
  }
}

/**
 * Maps a DB entries row (kind='fiction') to the served Fiction interface.
 */
export function mapFiction(row: DbEntryRow): Fiction {
  return {
    slug: row.slug,
    kind: 'fiction',
    title: row.title ?? '',
    date: row.date,
    isoDate: row.iso_date,
    domain: (row.domain ?? 'identity') as Fiction['domain'],
    tags: row.tags ?? [],
    summary: row.summary ?? '',
    originLocus: row.origin_locus ?? undefined,
    variants: (row.variants as FictionVariant[]) ?? [],
    divergence_cluster: row.divergence_cluster ?? undefined,
    draft: row.status === 'draft',
    worldline_links: row.worldline_links ?? [],
    body: row.body ?? '',
    // Translation-group: pass the served sibling's lang through (§3.1).
    lang: row.lang ?? 'en',
  }
}

/**
 * Maps a DB photo_assets row + variant keys to full public URLs.
 * Returns undefined when the assets row has no variants (pipeline not run).
 */
function mapVariants(dbVariants: DbVariantKeys | null | undefined): PhotoVariants | undefined {
  if (!dbVariants?.thumb || !dbVariants.medium || !dbVariants.full) return undefined
  return {
    thumb: {
      jpg: publicVariantUrl(dbVariants.thumb.jpg),
      webp: publicVariantUrl(dbVariants.thumb.webp),
      avif: publicVariantUrl(dbVariants.thumb.avif),
    },
    medium: {
      jpg: publicVariantUrl(dbVariants.medium.jpg),
      webp: publicVariantUrl(dbVariants.medium.webp),
      avif: publicVariantUrl(dbVariants.medium.avif),
    },
    full: {
      jpg: publicVariantUrl(dbVariants.full.jpg),
      webp: publicVariantUrl(dbVariants.full.webp),
      avif: publicVariantUrl(dbVariants.full.avif),
    },
  }
}

/**
 * Merges instrument_overrides and authored film_sim override onto a raw EXIF block.
 * Contract (Peat 2026-06-12): displayed value = override ?? exif.
 * photo_assets.exif stays RAW sensor truth — this merge only touches the served record.
 * captureTime is NOT an override key — it passes through from EXIF only.
 * filmSim: authored entry.film_sim wins over EXIF filmSim when set (passed in separately).
 * Returns undefined when both exif and overrides are absent (pipeline not yet run
 * AND no overrides set — component renders placeholder).
 */
function applyInstrumentOverrides(
  rawExif: PhotoExif | null | undefined,
  overrides: DbInstrumentOverrides | null | undefined,
  authoredFilmSim?: string | null,
): PhotoExif | undefined {
  if (!rawExif && !overrides && !authoredFilmSim) return undefined
  const base: PhotoExif = rawExif ?? {}
  const merged: PhotoExif = { ...base }
  if (overrides) {
    // Override keys: lens, camera, iso, aperture, shutter, focal
    // Each: override ?? exif — undefined override means fall through to EXIF value
    if (overrides.lens      !== undefined) merged.lens     = overrides.lens
    if (overrides.camera    !== undefined) merged.camera   = overrides.camera
    if (overrides.iso       !== undefined) merged.iso      = overrides.iso
    if (overrides.aperture  !== undefined) merged.aperture = overrides.aperture
    if (overrides.shutter   !== undefined) merged.shutter  = overrides.shutter
    if (overrides.focal     !== undefined) merged.focal    = overrides.focal
  }
  // filmSim: authored entry.film_sim wins over EXIF filmSim (null clears to EXIF)
  if (authoredFilmSim != null) merged.filmSim = authoredFilmSim
  return merged
}

/**
 * Maps a DB entries row (kind='photo') + optional photo_assets to PhotoSidecar.
 * DL13: served_coords consumed (trigger-maintained); raw coords excluded by column grant.
 * Instrument overrides (lens, camera, iso, aperture, shutter, focal) are merged onto
 * the served exif — photo_assets.exif is never modified (stays RAW sensor truth).
 * filmSim override: entry.film_sim wins over EXIF filmSim when set.
 */
export function mapPhotoSidecar(row: DbEntryRow, assets?: DbPhotoAssetRow | null): PhotoSidecar {
  return {
    roll: row.roll ?? '',
    id: row.photo_id ?? '',
    kind: 'photo-sidecar',
    caption: row.caption ?? undefined,
    shareLocation: row.share_location,
    overridePlace: row.override_place ?? undefined,
    date: row.date,
    isoDate: row.iso_date,
    placeId: row.place_id ?? undefined,
    highlightRank: row.highlight_rank ?? undefined,
    draft: row.status === 'draft',
    worldline_links: row.worldline_links ?? [],
    // Override-merged exif: display value = instrument_overrides.<key> ?? exif.<key>
    // filmSim: entry.film_sim overrides exif.filmSim when set (null = fall back to EXIF)
    exif: applyInstrumentOverrides(assets?.exif, row.instrument_overrides, row.film_sim),
    variants: mapVariants(assets?.variants),
    // DL13: served_coords is the only coords anon ever sees
    servedCoords: row.served_coords ?? undefined,
    // Expose raw authored coords for the owner console editor (admin read only).
    // The anon read never selects this column (DL13 — raw coords excluded).
    // When present (admin-reads.ts selects 'coords'), expose for the COORD control.
    authoredCoords: row.coords ?? undefined,
    // Expose raw overrides for the console editor (read/write independently from EXIF)
    instrumentOverrides: (row.instrument_overrides as InstrumentOverrides) ?? undefined,
    // Authored film-sim override — exposed so console editor can read/set it directly
    filmSim: row.film_sim ?? undefined,
    body: row.body ?? '',
  }
}

/**
 * Maps a DB rolls row to Photo (roll-level descriptor).
 * maps rolls.id → Photo.id (console photo node compat — §2.3).
 */
export function mapRoll(row: DbRollRow): Photo {
  return {
    roll: row.roll,
    id: row.id,
    kind: 'photo',
    caption: row.caption ?? undefined,
    shareLocation: row.share_location,
    servedCoords: row.served_coords ?? undefined,
    date: row.date,
    isoDate: row.iso_date,
    body: row.body ?? '',
  }
}

/**
 * Maps a DB places row to the Place interface.
 */
export function mapPlace(row: DbPlaceRow): Place {
  return {
    id: row.id,
    level: row.level as 1 | 2,
    parentId: row.parent_id,
    name: row.name,
    // DB places table has top-level lat/lon; Place interface uses coord: { lat, lon }
    // to match place-registry.ts zod shape and WorldlineGlobe.tsx consumers.
    coord: { lat: row.lat, lon: row.lon },
    isAlpha: row.is_alpha,
  }
}
