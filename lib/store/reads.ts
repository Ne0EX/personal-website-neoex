/**
 * lib/store/reads.ts
 * ---------------------------------------------------------------------------
 * Public read functions — use the anon Supabase client.
 * RLS returns published rows only; DL13 column grants exclude raw coords.
 *
 * IMPORTANT: All anon SELECT calls enumerate columns explicitly — never select('*').
 * The DL13 column grants make star-select fail for anon (coord/original_key revoked).
 *
 * Caching strategy (DL11): no module-level cache here (unlike velite lazy-load pattern).
 * Renders are cached by Next.js static layer; query volume = regenerations only.
 *
 * Owner: Procyon (α-IDX-03) · store-as-source S3
 */

import { anonClient } from './supabase/anon'
import {
  mapArticle,
  mapFiction,
  mapPhotoSidecar,
  mapRoll,
  mapPlace,
  type DbEntryRow,
  type DbPhotoAssetRow,
  type DbRollRow,
  type DbPlaceRow,
} from './map'
import type { Article, Fiction, Photo, PhotoSidecar, Place } from './types'
import type { WorldlineLink, FictionVariant } from '../content/types'

// ---------------------------------------------------------------------------
// Shared column enumerations (DL13 — never select('*') for anon)
// ---------------------------------------------------------------------------

/** All anon-readable columns from entries (raw coords excluded by grant). */
const ENTRY_COLS = [
  'id',
  'kind',
  'slug',
  'status',
  'title',
  'date',
  'iso_date',
  'domain',
  'tags',
  'summary',
  'served_coords',
  'share_location',
  'place_id',
  'highlight_for_place',
  'patches',
  'worldline_links',
  'body',
  'maturity',
  'reading_time',
  'origin_locus',
  'variants',
  'divergence_cluster',
  'roll',
  'photo_id',
  'caption',
  'override_place',
  'highlight_rank',
  // Authored instrument overrides — anon-granted (public display data, not coords).
  // Merged onto served exif in map.ts: display value = instrument_overrides.<key> ?? exif.<key>
  'instrument_overrides',
].join(',')

/** Anon-readable columns from photo_assets (original_key + source_hash excluded). */
const ASSET_COLS = 'entry_id,exif,variants'

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

/** All published articles, sorted newest-first. */
export async function getArticles(): Promise<Article[]> {
  const { data, error } = await anonClient
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'article')
    .eq('status', 'published')
    .order('iso_date', { ascending: false })

  if (error) throw new Error(`getArticles: ${error.message}`)
  return (data as unknown as DbEntryRow[]).map(mapArticle)
}

/** Single article by fileNum (slug). Returns undefined when not found or not published. */
export async function getArticleByFileNum(fileNum: string): Promise<Article | undefined> {
  const { data, error } = await anonClient
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'article')
    .eq('slug', fileNum)
    .maybeSingle()

  if (error) throw new Error(`getArticleByFileNum: ${error.message}`)
  if (!data) return undefined
  return mapArticle(data as unknown as DbEntryRow)
}

/** Recent published articles for ChapterIndex / hero block. */
export async function getRecentArticles(limit = 4): Promise<Article[]> {
  const { data, error } = await anonClient
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'article')
    .eq('status', 'published')
    .order('iso_date', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`getRecentArticles: ${error.message}`)
  return (data as unknown as DbEntryRow[]).map(mapArticle)
}

/** Related articles: share at least one tag with source, sorted by overlap then date. */
export async function getRelatedArticles(source: Article, limit = 3): Promise<Article[]> {
  if (!source.tags || source.tags.length === 0) return []

  const { data, error } = await anonClient
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'article')
    .eq('status', 'published')
    .overlaps('tags', source.tags)
    .neq('slug', source.fileNum)
    .order('iso_date', { ascending: false })

  if (error) throw new Error(`getRelatedArticles: ${error.message}`)

  const sourceTags = new Set(source.tags)
  return (data as unknown as DbEntryRow[])
    .map(mapArticle)
    .map((a) => ({
      article: a,
      overlap: a.tags.filter((t) => sourceTags.has(t)).length,
    }))
    .filter(({ overlap }) => overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || b.article.isoDate.localeCompare(a.article.isoDate))
    .slice(0, limit)
    .map(({ article }) => article)
}

// ---------------------------------------------------------------------------
// Fiction
// ---------------------------------------------------------------------------

/** All published fiction entries, sorted newest-first. */
export async function getFiction(): Promise<Fiction[]> {
  const { data, error } = await anonClient
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'fiction')
    .eq('status', 'published')
    .order('iso_date', { ascending: false })

  if (error) throw new Error(`getFiction: ${error.message}`)
  return (data as unknown as DbEntryRow[]).map(mapFiction)
}

/** Single published fiction entry by slug. */
export async function getFictionBySlug(slug: string): Promise<Fiction | undefined> {
  const { data, error } = await anonClient
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'fiction')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw new Error(`getFictionBySlug: ${error.message}`)
  if (!data) return undefined
  return mapFiction(data as unknown as DbEntryRow)
}

const SITE_ALPHA = 1.130426

function _pickAlpha(f: Fiction): number {
  if (f.variants && f.variants.length > 0) return parseFloat(f.variants[0].alpha)
  return SITE_ALPHA
}

/** Sibling NeX nodes within the same divergence_cluster. Returns up to 2. */
export async function getFictionSiblings(slug: string): Promise<Fiction[]> {
  const self = await getFictionBySlug(slug)
  if (!self || !self.divergence_cluster) return []

  const { data, error } = await anonClient
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'fiction')
    .eq('status', 'published')
    .eq('divergence_cluster', self.divergence_cluster)
    .neq('slug', slug)

  if (error) throw new Error(`getFictionSiblings: ${error.message}`)

  const selfAlpha = _pickAlpha(self)
  return (data as unknown as DbEntryRow[])
    .map(mapFiction)
    .map((f) => ({ entry: f, dist: Math.abs(_pickAlpha(f) - selfAlpha) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 2)
    .map(({ entry }) => entry)
}

// ---------------------------------------------------------------------------
// Photos (roll descriptors)
// ---------------------------------------------------------------------------

const ROLL_COLS = 'roll,id,caption,share_location,served_coords,date,iso_date,body'

/** All rolls, sorted newest-first. */
export async function getPhotos(): Promise<Photo[]> {
  const { data, error } = await anonClient
    .from('rolls')
    .select(ROLL_COLS)
    .order('iso_date', { ascending: false })

  if (error) throw new Error(`getPhotos: ${error.message}`)
  return (data as unknown as DbRollRow[]).map(mapRoll)
}

/** Roll body text for a specific roll. Returns null when roll not found. */
export async function getRollBody(roll: string): Promise<string | null> {
  const { data, error } = await anonClient
    .from('rolls')
    .select('body')
    .eq('roll', roll)
    .maybeSingle()

  if (error) throw new Error(`getRollBody: ${error.message}`)
  return data?.body ?? null
}

// ---------------------------------------------------------------------------
// PhotoSidecars
// ---------------------------------------------------------------------------

/** Join helper: fetches photo_assets for given entry_ids. */
async function fetchAssets(entryIds: string[]): Promise<Map<string, DbPhotoAssetRow>> {
  if (entryIds.length === 0) return new Map()
  const { data, error } = await anonClient
    .from('photo_assets')
    .select(ASSET_COLS)
    .in('entry_id', entryIds)

  if (error) throw new Error(`fetchAssets: ${error.message}`)
  const map = new Map<string, DbPhotoAssetRow>()
  for (const row of (data ?? []) as unknown as DbPhotoAssetRow[]) {
    map.set(row.entry_id, row)
  }
  return map
}

/** All published photo sidecars, newest-first. */
export async function getPhotoSidecars(): Promise<PhotoSidecar[]> {
  const { data, error } = await anonClient
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'photo')
    .eq('status', 'published')
    .order('iso_date', { ascending: false })

  if (error) throw new Error(`getPhotoSidecars: ${error.message}`)
  const rows = data as unknown as DbEntryRow[]
  const assets = await fetchAssets(rows.map((r) => r.id))
  return rows.map((r) => mapPhotoSidecar(r, assets.get(r.id)))
}

/** All published sidecars within a roll, ordered by photo_id ascending (capture sequence). */
export async function getSidecarsInRoll(roll: string): Promise<PhotoSidecar[]> {
  const { data, error } = await anonClient
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'photo')
    .eq('status', 'published')
    .eq('roll', roll)
    .order('photo_id', { ascending: true })

  if (error) throw new Error(`getSidecarsInRoll: ${error.message}`)
  const rows = data as unknown as DbEntryRow[]
  const assets = await fetchAssets(rows.map((r) => r.id))
  return rows.map((r) => mapPhotoSidecar(r, assets.get(r.id)))
}

/** Single sidecar by roll + id. Returns null when not found. */
export async function getPhotoByRollAndId(roll: string, id: string): Promise<PhotoSidecar | null> {
  const { data, error } = await anonClient
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'photo')
    .eq('roll', roll)
    .eq('photo_id', id)
    .maybeSingle()

  if (error) throw new Error(`getPhotoByRollAndId: ${error.message}`)
  if (!data) return null
  const row = data as unknown as DbEntryRow
  const assets = await fetchAssets([row.id])
  return mapPhotoSidecar(row, assets.get(row.id))
}

/** Single sidecar by roll + id. Returns undefined (articles.ts compat). */
export async function getPhotoById(roll: string, id: string): Promise<PhotoSidecar | undefined> {
  return (await getPhotoByRollAndId(roll, id)) ?? undefined
}

/** Roll contacts: sidecars + lede for the roll-index page. */
export interface RollContacts {
  sidecars: PhotoSidecar[]
  lede: string
  dateRange: string
}

export async function getRollContacts(roll: string, rollBody: string): Promise<RollContacts> {
  const sidecars = await getSidecarsInRoll(roll)

  let dateRange = ''
  if (sidecars.length > 0) {
    const sorted = [...sidecars].sort((a, b) => a.isoDate.localeCompare(b.isoDate))
    const first = sorted[0].isoDate.replace(/-/g, '.')
    const last = sorted[sorted.length - 1].isoDate.replace(/-/g, '.')
    dateRange = first === last ? first : `${first} — ${last}`
  }

  // Extract lede: strip comments, return first non-empty paragraph
  const stripped = rollBody.replace(/<!--[\s\S]*?-->/g, '').trim()
  let lede = ''
  if (stripped) {
    for (const para of stripped.split(/\n\n+/)) {
      const clean = para.trim()
      if (clean) { lede = clean; break }
    }
  }

  return { sidecars, lede, dateRange }
}

/** Globe-eligible photos (share_location=true AND served_coords defined). */
export async function getGlobeEligiblePhotos() {
  const { data, error } = await anonClient
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'photo')
    .eq('status', 'published')
    .eq('share_location', true)
    .not('served_coords', 'is', null)

  if (error) throw new Error(`getGlobeEligiblePhotos: ${error.message}`)
  const rows = data as unknown as DbEntryRow[]
  const assets = await fetchAssets(rows.map((r) => r.id))
  return rows.map((r) => {
    const s = mapPhotoSidecar(r, assets.get(r.id))
    return {
      kind: 'photo' as const,
      roll: s.roll,
      id: s.id,
      caption: s.caption,
      coords: s.servedCoords!,
      isoDate: s.isoDate,
      filmSim: s.exif?.filmSim,
      thumbWebp: s.variants?.thumb.webp,
    }
  })
}

/** Prev/next navigation within a roll. */
export async function getRollNavigation(
  roll: string,
  id: string,
): Promise<{ prev: PhotoSidecar | undefined; next: PhotoSidecar | undefined }> {
  const inRoll = await getSidecarsInRoll(roll)
  const idx = inRoll.findIndex((s) => s.id === id)
  if (idx === -1) return { prev: undefined, next: undefined }
  return {
    prev: idx > 0 ? inRoll[idx - 1] : undefined,
    next: idx < inRoll.length - 1 ? inRoll[idx + 1] : undefined,
  }
}

/** Roll descriptors for a specific roll (compat with getPhotosByRoll). */
export async function getPhotosByRoll(roll: string): Promise<Photo[]> {
  const { data, error } = await anonClient
    .from('rolls')
    .select(ROLL_COLS)
    .eq('roll', roll)
    .order('iso_date', { ascending: true })

  if (error) throw new Error(`getPhotosByRoll: ${error.message}`)
  return (data as unknown as DbRollRow[]).map(mapRoll)
}

// ---------------------------------------------------------------------------
// Places
// ---------------------------------------------------------------------------

const PLACE_COLS = 'id,level,parent_id,name,lat,lon,is_alpha'

/** All registered L1 places. */
export async function getAllPlacesFromStore(): Promise<Place[]> {
  const { data, error } = await anonClient
    .from('places')
    .select(PLACE_COLS)
    .order('id', { ascending: true })

  if (error) throw new Error(`getAllPlacesFromStore: ${error.message}`)
  return (data as unknown as DbPlaceRow[]).map(mapPlace)
}

/**
 * Returns the place currently designated as the alpha locus (is_alpha = true).
 *
 * The alpha locus is the globe's observer home coordinate — the Ne0 stratum
 * camera framing and NEXT NODE cycle start here. At most one place is alpha at
 * any time (enforced by places_one_alpha_idx partial unique index).
 *
 * Falls back to the Bangkok hard-coordinates if no place is flagged alpha (safe
 * default preserving existing behaviour during any accidental de-seeded state).
 */
export async function getAlphaPlace(): Promise<Place> {
  const { data, error } = await anonClient
    .from('places')
    .select(PLACE_COLS)
    .eq('is_alpha', true)
    .maybeSingle()

  if (error) throw new Error(`getAlphaPlace: ${error.message}`)

  if (data) return mapPlace(data as unknown as DbPlaceRow)

  // Safe fallback: Bangkok — matches the historical hardcoded ALPHA_LAT/ALPHA_LON.
  // This path should never be reached in a correctly seeded DB, but prevents a
  // globe crash during any transient un-seeded state.
  return {
    id: 'bangkok',
    level: 1,
    parentId: null,
    name: 'Bangkok · TH',
    coord: { lat: 13.7563, lon: 100.5018 },
    isAlpha: true,
  }
}
