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

export async function getAllRolls(): Promise<Photo[]> {
  const client = await createSupabaseServerClient()
  const { data, error } = await client
    .from('rolls')
    .select(ROLL_COLS)
    .order('iso_date', { ascending: false })

  if (error) throw new Error(`getAllRolls: ${error.message}`)
  return (data as unknown as DbRollRow[]).map(mapRoll)
}
