/**
 * lib/store/admin-reads.ts
 * ---------------------------------------------------------------------------
 * Console/authoring reads — uses the cookie server client so RLS lets the
 * authenticated owner see DRAFT entries as well as published ones.
 *
 * MUST NOT be used in public routes — bypasses the draft visibility gate.
 * Every function here is the console-equivalent of the public reads in reads.ts.
 *
 * Owner: Procyon (α-IDX-03) · store-as-source S3
 */

import { createSupabaseServerClient } from './supabase/server'
import {
  mapArticle,
  mapFiction,
  mapPhotoSidecar,
  mapRoll,
  type DbEntryRow,
  type DbPhotoAssetRow,
  type DbRollRow,
} from './map'
import type { Article, Fiction, PhotoSidecar, Photo } from './types'

// ---------------------------------------------------------------------------
// Column lists (same as reads.ts — enumerate explicitly, never *)
// ---------------------------------------------------------------------------

const ENTRY_COLS = [
  'id', 'kind', 'slug', 'status', 'title', 'date', 'iso_date', 'domain', 'tags',
  'summary', 'served_coords', 'share_location', 'place_id', 'highlight_for_place',
  'patches', 'worldline_links', 'body', 'maturity', 'reading_time', 'origin_locus',
  'variants', 'divergence_cluster', 'roll', 'photo_id', 'caption', 'override_place',
  'highlight_rank',
  // Authored instrument overrides — public display data, not coords.
  // Merged onto served exif in map.ts: display value = instrument_overrides.<key> ?? exif.<key>
  'instrument_overrides',
  // Authored film-sim override — wins over photo_assets.exif.filmSim when set.
  'film_sim',
  // Raw authored coords — OWNER CONSOLE ONLY (DL13 gate: anon ENTRY_COLS in reads.ts
  // excludes this column; admin is authenticated as owner so it may be included here).
  // Exposed as PhotoSidecar.authoredCoords for the console COORD control.
  'coords',
].join(',')

const ASSET_COLS = 'entry_id,exif,variants'
const ROLL_COLS = 'roll,id,caption,share_location,served_coords,date,iso_date,body'

async function fetchAssetsAdmin(
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  entryIds: string[],
): Promise<Map<string, DbPhotoAssetRow>> {
  if (entryIds.length === 0) return new Map()
  const { data, error } = await client
    .from('photo_assets')
    .select(ASSET_COLS)
    .in('entry_id', entryIds)

  if (error) throw new Error(`fetchAssetsAdmin: ${error.message}`)
  const map = new Map<string, DbPhotoAssetRow>()
  for (const row of (data ?? []) as unknown as DbPhotoAssetRow[]) map.set(row.entry_id, row)
  return map
}

// ---------------------------------------------------------------------------
// Articles (all, including drafts)
// ---------------------------------------------------------------------------

export async function getAllArticles(): Promise<Article[]> {
  const client = await createSupabaseServerClient()
  const { data, error } = await client
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'article')
    .order('iso_date', { ascending: false })

  if (error) throw new Error(`getAllArticles: ${error.message}`)
  return (data as unknown as DbEntryRow[]).map(mapArticle)
}

/**
 * Fetch a single article by its fileNum/slug (zero-padded string like "004").
 * Used by the editor page to load a draft by slug from the DB (not velite).
 * Returns null when not found.
 */
export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const client = await createSupabaseServerClient()
  const { data, error } = await client
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'article')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw new Error(`getArticleBySlug: ${error.message}`)
  if (!data) return null
  return mapArticle(data as unknown as DbEntryRow)
}

/**
 * Fetch a single fiction entry by slug from the DB (not velite).
 * Used by the editor page to load a draft.
 * Returns null when not found.
 */
export async function getFictionBySlugAdmin(slug: string): Promise<Fiction | null> {
  const client = await createSupabaseServerClient()
  const { data, error } = await client
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'fiction')
    .eq('slug', slug)
    .maybeSingle()

  if (error) throw new Error(`getFictionBySlugAdmin: ${error.message}`)
  if (!data) return null
  return mapFiction(data as unknown as DbEntryRow)
}

// ---------------------------------------------------------------------------
// Fiction (all, including drafts)
// ---------------------------------------------------------------------------

export async function getAllFiction(): Promise<Fiction[]> {
  const client = await createSupabaseServerClient()
  const { data, error } = await client
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'fiction')
    .order('iso_date', { ascending: false })

  if (error) throw new Error(`getAllFiction: ${error.message}`)
  return (data as unknown as DbEntryRow[]).map(mapFiction)
}

// ---------------------------------------------------------------------------
// Photos / sidecars (all, including drafts)
// ---------------------------------------------------------------------------

export async function getAllPhotoSidecars(): Promise<PhotoSidecar[]> {
  const client = await createSupabaseServerClient()
  const { data, error } = await client
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'photo')
    .order('iso_date', { ascending: false })

  if (error) throw new Error(`getAllPhotoSidecars: ${error.message}`)
  const rows = data as unknown as DbEntryRow[]
  const assets = await fetchAssetsAdmin(client, rows.map((r) => r.id))
  return rows.map((r) => mapPhotoSidecar(r, assets.get(r.id)))
}

/**
 * Fetch a single photo sidecar by roll + photo_id — admin (authenticated) client.
 * Used by the editor's lookupPhotoSidecar so DRAFT entries are visible.
 * The anon getPhotoByRollAndId is blocked by RLS for drafts (entries_read requires
 * status='published' OR is_owner()); this admin version uses the cookie server
 * client which satisfies is_owner() for the authenticated Worldline owner.
 */
export async function getPhotoByRollAndIdAdmin(
  roll: string,
  id: string,
): Promise<PhotoSidecar | null> {
  const client = await createSupabaseServerClient()
  const { data, error } = await client
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'photo')
    .eq('roll', roll)
    .eq('photo_id', id)
    .maybeSingle()

  if (error) throw new Error(`getPhotoByRollAndIdAdmin: ${error.message}`)
  if (!data) return null
  const row = data as unknown as DbEntryRow
  const assets = await fetchAssetsAdmin(client, [row.id])
  return mapPhotoSidecar(row, assets.get(row.id))
}

/**
 * All sidecars in a roll — admin (authenticated) client, includes drafts.
 * Used alongside getPhotoByRollAndIdAdmin for roll-context sequence info in the
 * editor (sequenceIndex / rollTotal must include draft photos in their count).
 */
export async function getSidecarsInRollAdmin(roll: string): Promise<PhotoSidecar[]> {
  const client = await createSupabaseServerClient()
  const { data, error } = await client
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'photo')
    .eq('roll', roll)
    .order('photo_id', { ascending: true })

  if (error) throw new Error(`getSidecarsInRollAdmin: ${error.message}`)
  const rows = data as unknown as DbEntryRow[]
  const assets = await fetchAssetsAdmin(client, rows.map((r) => r.id))
  return rows.map((r) => mapPhotoSidecar(r, assets.get(r.id)))
}

export async function getAllRolls(): Promise<Photo[]> {
  const client = await createSupabaseServerClient()
  const { data, error } = await client
    .from('rolls')
    .select(ROLL_COLS)
    .order('iso_date', { ascending: false })

  if (error) throw new Error(`getAllRolls: ${error.message}`)
  return (data as unknown as DbRollRow[]).map(mapRoll)
}
