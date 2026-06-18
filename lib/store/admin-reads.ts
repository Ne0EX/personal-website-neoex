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
import { publicVariantUrl } from './media'
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
  // Translation-group lang (SPEC-2026-06-18 §3.1, P1 migration).
  // Owner console must see lang to switch between sibling editors (P5).
  'lang',
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

/**
 * All articles (including drafts), newest-first.
 * Owner console listing — no slug dedup needed (the console should show ALL siblings
 * so the owner can manage each language variant independently).
 * Add optional lang filter: when set, returns only rows for that language (P5 console
 * tab view). When omitted, returns all rows (current console behaviour unchanged).
 */
export async function getAllArticles(lang?: string): Promise<Article[]> {
  const client = await createSupabaseServerClient()
  let query = client
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'article')
    .order('iso_date', { ascending: false })

  if (lang !== undefined) query = query.eq('lang', lang)

  const { data, error } = await query
  if (error) throw new Error(`getAllArticles: ${error.message}`)
  return (data as unknown as DbEntryRow[]).map(mapArticle)
}

/**
 * Fetch a single article by its fileNum/slug (zero-padded string like "004").
 * Used by the editor page to load a draft by slug from the DB (not velite).
 * Returns null when not found.
 *
 * Add optional lang param (default 'en') so the console editor can load a specific
 * sibling for editing. Default 'en' means existing console screens work unchanged.
 * (§3.6 SPEC — admin reads gain an optional lang param)
 *
 * IMPORTANT: .maybeSingle() is retained here because the admin fetch targets a
 * specific (slug, lang) pair — the combination is unique by the
 * entries_kind_slug_lang_unique constraint. If lang is specified, at most one row
 * matches. If lang is not specified and multiple siblings exist, the caller should
 * pass an explicit lang; defaulting to 'en' keeps backward compat.
 */
export async function getArticleBySlug(slug: string, lang = 'en'): Promise<Article | null> {
  const client = await createSupabaseServerClient()
  const { data, error } = await client
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'article')
    .eq('slug', slug)
    .eq('lang', lang)
    .maybeSingle()

  if (error) throw new Error(`getArticleBySlug: ${error.message}`)
  if (!data) return null
  return mapArticle(data as unknown as DbEntryRow)
}

/**
 * Fetch a single fiction entry by slug from the DB (not velite).
 * Used by the editor page to load a draft.
 * Returns null when not found.
 *
 * Add optional lang param (default 'en') — same as getArticleBySlug (§3.6 SPEC).
 */
export async function getFictionBySlugAdmin(slug: string, lang = 'en'): Promise<Fiction | null> {
  const client = await createSupabaseServerClient()
  const { data, error } = await client
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'fiction')
    .eq('slug', slug)
    .eq('lang', lang)
    .maybeSingle()

  if (error) throw new Error(`getFictionBySlugAdmin: ${error.message}`)
  if (!data) return null
  return mapFiction(data as unknown as DbEntryRow)
}

// ---------------------------------------------------------------------------
// Fiction (all, including drafts)
// ---------------------------------------------------------------------------

/**
 * All fiction (including drafts), newest-first.
 * Optional lang filter — same pattern as getAllArticles (§3.6 SPEC).
 */
export async function getAllFiction(lang?: string): Promise<Fiction[]> {
  const client = await createSupabaseServerClient()
  let query = client
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'fiction')
    .order('iso_date', { ascending: false })

  if (lang !== undefined) query = query.eq('lang', lang)

  const { data, error } = await query
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

// ---------------------------------------------------------------------------
// Tags — sorted, de-duplicated universe across ALL entries
// ---------------------------------------------------------------------------

/**
 * Return the sorted, de-duplicated, non-empty set of tags used across ALL
 * entries (published + draft — admin client, owner-authenticated).
 *
 * The tags column is a Postgres text[]; we fetch it, flatten all arrays in JS,
 * filter empty strings, deduplicate with a Set, and sort — keeping this layer
 * free of raw SQL and consistent with the Supabase client pattern used here.
 *
 * Used by: app/console/page.tsx → console TAGS creatable-combobox (Sirius).
 *
 * Owner: Procyon (α-IDX-03)
 */
export async function getAllTags(): Promise<string[]> {
  const client = await createSupabaseServerClient()
  const { data, error } = await client
    .from('entries')
    .select('tags')
    .not('tags', 'is', null)

  if (error) throw new Error(`getAllTags: ${error.message}`)

  const rows = (data ?? []) as unknown as Array<{ tags: string[] | null }>
  const tagSet = new Set<string>()
  for (const row of rows) {
    if (!row.tags) continue
    for (const tag of row.tags) {
      const t = tag.trim()
      if (t.length > 0) tagSet.add(t)
    }
  }
  return Array.from(tagSet).sort()
}

// ---------------------------------------------------------------------------
// Image picker — model B (reuse; no re-upload)
// ---------------------------------------------------------------------------

/**
 * One photo item for the article body image picker.
 * Carries enough data to render a thumbnail grid and produce the MDX insert.
 */
export interface PhotoPickerItem {
  /** "roll/photoId" — used as the human-readable label and MDX alt text fallback */
  slug: string
  /** roll slug, e.g. "2026-05-bangkok" */
  roll: string
  /** photo_id, e.g. "DSCF0003" */
  photoId: string
  /** display caption (may be null for uncaptioned frames) */
  caption: string | null
  /** public CDN URL for the thumb-size webp variant; null when pipeline not run yet */
  thumbUrl: string | null
  /** public CDN URL for the medium-size webp variant; null when pipeline not run yet */
  mediumUrl: string | null
}

/**
 * Load all owner photos with thumbnail URLs for the article body image picker.
 * Returns published AND draft entries (admin read — authenticated owner only).
 * Photos without variants (pipeline not run) are included with null URLs so
 * the picker can display a degraded placeholder rather than hiding them.
 *
 * Used by: app/console/editor/page.tsx (server) → passed to EntryEditor →
 * ArticleSourcePane → ImagePickerPanel (client).
 *
 * Owner: Sirius (α-SUR-01) · image-picker model-B
 */
export async function getOwnerPhotosForPicker(): Promise<PhotoPickerItem[]> {
  const client = await createSupabaseServerClient()

  // Fetch photo entries (slug = "roll/photoId" format, caption from entries)
  const { data: entries, error: entryError } = await client
    .from('entries')
    .select('id,roll,photo_id,caption')
    .eq('kind', 'photo')
    .order('iso_date', { ascending: false })

  if (entryError) throw new Error(`getOwnerPhotosForPicker entries: ${entryError.message}`)
  if (!entries || entries.length === 0) return []

  const rows = entries as unknown as Array<{ id: string; roll: string; photo_id: string; caption: string | null }>

  // Fetch photo_assets variants in one round-trip
  const entryIds = rows.map((r) => r.id)
  const { data: assets, error: assetError } = await client
    .from('photo_assets')
    .select('entry_id,variants')
    .in('entry_id', entryIds)

  if (assetError) throw new Error(`getOwnerPhotosForPicker assets: ${assetError.message}`)

  // Build a lookup map: entryId → variants
  type VariantRow = { entry_id: string; variants: { thumb?: { webp: string }; medium?: { webp: string } } | null }
  const variantMap = new Map<string, VariantRow['variants']>()
  for (const row of (assets ?? []) as unknown as VariantRow[]) {
    variantMap.set(row.entry_id, row.variants)
  }

  return rows.map((r) => {
    const variants = variantMap.get(r.id)
    return {
      slug:      `${r.roll}/${r.photo_id}`,
      roll:      r.roll,
      photoId:   r.photo_id,
      caption:   r.caption ?? null,
      thumbUrl:  variants?.thumb?.webp  ? publicVariantUrl(variants.thumb.webp)  : null,
      mediumUrl: variants?.medium?.webp ? publicVariantUrl(variants.medium.webp) : null,
    }
  })
}
