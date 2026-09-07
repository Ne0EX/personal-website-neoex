/**
 * lib/server/store/actions-core.ts
 * ---------------------------------------------------------------------------
 * Core implementations for all S5 server actions.
 * No 'use server' directive — this is the testable logic layer.
 * The 'use server' thin wrappers live in actions.ts.
 *
 * Architecture mirrors existing entry-lifecycle-core.ts / highlight-core.ts
 * split: actions.ts exports async wrappers; this file holds the real logic.
 *
 * All actions:
 *   1. assertOwner() — bail early with AUTH error, never throw across boundary
 *   2. Zod validate input
 *   3. Mutate via cookie server client (RLS enforces owner-only writes)
 *   4. revalidatePath('/', 'layout') — DL11
 *   5. Return {ok:true, …} | {ok:false, error:{code,message,details?}}
 *
 * Ingest pipeline (ingestPhoto):
 *   - Downloads original from `originals` bucket (owner session)
 *   - Extracts EXIF with exifr (GPS dropped unless shareLocation — Layer 1 gate)
 *   - Generates 3×3 sharp variants (NO .withMetadata() — spec explicit)
 *   - Uploads variants to private `photos` with cacheControl:0
 *   - Upserts entries + photo_assets (collision-guard without overwrite:true)
 *
 * Privacy invariants (spec §4.3, §2.5):
 *   - .withMetadata() is FORBIDDEN: sharp strips all EXIF by default.
 *     .rotate() bakes orientation before EXIF strip. Re-adding .withMetadata()
 *     would re-embed GPS into the world-readable bucket — never do this.
 *   - GPS from EXIF is dropped at extraction unless shareLocation=true (Layer 1).
 *   - served_coords is maintained by DB trigger (Layer 2, DL13) — never set directly.
 *
 * Owner: Altair (α-BND-02) · store-as-source S5
 * // server-action: altair
 */

import { createHash } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/store/supabase/server'
import { assertOwner } from '@/lib/server/auth'
import { z } from 'zod'
import {
  CreateEntryInputSchema,
  UpdateEntryInputSchema,
  SetEntryDraftInputSchema,
  DeleteEntryInputSchema,
  CreateRollInputSchema,
  IngestPhotoInputSchema,
  CreatePlaceInputSchema,
  SavePlaceCoordInputSchema,
  SavePlaceHighlightsInputSchema,
  SetAlphaPlaceInputSchema,
  CreateTranslationInputSchema,
  checkPublishCompleteness,
  type CreateEntryInput,
  type UpdateEntryInput,
  type SetEntryDraftInput,
  type DeleteEntryInput,
  type CreateRollInput,
  type IngestPhotoInput,
  type CreatePlaceInput,
  type SavePlaceCoordInput,
  type SavePlaceHighlightsInput,
  type CreateTranslationInput,
} from '@/lib/store/schema'

// ---------------------------------------------------------------------------
// Error/result helpers
// ---------------------------------------------------------------------------

type ActionError = {
  ok: false
  error: { code: string; message: string; details?: unknown }
}

function err(code: string, message: string, details?: unknown): ActionError {
  return { ok: false, error: { code, message, details } }
}

// ---------------------------------------------------------------------------
// Image pipeline constants (ports process-photos.ts quality tiers)
// ---------------------------------------------------------------------------

const VARIANT_SIZES = [
  { name: 'thumb',  width: 320  },
  { name: 'medium', width: 1280 },
  { name: 'full',   width: 2400 },
] as const

const VARIANT_QUALITY = {
  thumb:  { jpg: 80, webp: 75, avif: 60 },
  medium: { jpg: 85, webp: 78, avif: 60 },
  full:   { jpg: 88, webp: 80, avif: 65 },
} as const

// ---------------------------------------------------------------------------
// Fuji film simulation normalization (ports process-photos.ts:108-166)
// ---------------------------------------------------------------------------

const FUJI_SIM_MAP: Record<string, string> = {
  PROVIA:               'Provia',
  VELVIA:               'Velvia',
  ASTIA:                'Astia',
  CLASSIC_CHROME:       'Classic Chrome',
  PRO_NEG_HI:           'Pro Neg Hi',
  PRO_NEG_STD:          'Pro Neg Std',
  CLASSIC_NEG:          'Classic Neg',
  ETERNA:               'Eterna',
  ETERNA_BLEACH_BYPASS: 'Eterna Bleach Bypass',
  ACROS:                'Acros',
  ACROS_R:              'Acros R',
  ACROS_G:              'Acros G',
  ACROS_YE:             'Acros Ye',
  REALA_ACE:            'Reala Ace',
  NOSTALGIC_NEG:        'Nostalgic Neg',
  SEAL:                 'Seal',
}

function normalizeFujiSim(raw: string): string {
  const key = raw
    .toUpperCase()
    .replace(/[\s\-\+]+/g, '_')
    .replace(/[^A-Z0-9_]/g, '')
  return FUJI_SIM_MAP[key] ?? raw
}

function readFujiFilmSim(exif: Record<string, unknown>): string | undefined {
  const raw =
    (exif['FilmMode'] as string | undefined) ??
    (exif['FilmSimulation'] as string | undefined) ??
    ((exif['Fujifilm'] as Record<string, unknown> | undefined)?.FilmMode as string | undefined) ??
    ((exif['Fujifilm'] as Record<string, unknown> | undefined)?.FilmSimulation as string | undefined)
  if (typeof raw === 'string') return normalizeFujiSim(raw)
  return undefined
}

function formatShutter(exposureTime: number | undefined): string | undefined {
  if (exposureTime == null) return undefined
  if (exposureTime >= 1) return String(Math.round(exposureTime))
  return `1/${Math.round(1 / exposureTime)}`
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function todayDotDate(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '.')
}

function dotDateToIso(dotDate: string): string {
  return dotDate.replace(/\./g, '-')
}

// ---------------------------------------------------------------------------
// createEntry
// ---------------------------------------------------------------------------

export type CreateEntryResult =
  | { ok: true; entry: { kind: string; slug: string; id: string; status: string } }
  | ActionError

export async function createEntryImpl(rawInput: unknown): Promise<CreateEntryResult> {
  const auth = await assertOwner()
  if (!auth.ok) return auth

  const parsed = CreateEntryInputSchema.safeParse(rawInput)
  if (!parsed.success) return err('INVALID_INPUT', 'Validation failed', parsed.error.flatten())
  const input = parsed.data

  const supabase = await createSupabaseServerClient()

  const date = input.date ?? todayDotDate()
  const isoDate = dotDateToIso(date)

  try {
    if (input.kind === 'article') {
      // Auto-assign next free fileNum if slug not provided
      let slug = input.slug
      if (!slug) {
        const { data: existing } = await supabase
          .from('entries')
          .select('slug')
          .eq('kind', 'article')
          .order('slug', { ascending: false })
          .limit(1)
        const maxNum = existing && existing.length > 0
          ? parseInt((existing[0] as { slug: string }).slug, 10)
          : -1
        slug = String(maxNum + 1).padStart(3, '0')
      }

      const insertData = {
        kind: 'article' as const,
        slug,
        status: 'draft' as const,
        lang: input.lang ?? 'en',
        title: input.title ?? null,
        date,
        iso_date: isoDate,
        domain: input.domain ?? null,
        tags: input.tags ?? [],
        summary: input.summary ?? null,
        body: input.body ?? '',
        coords: input.coords ?? null,
        share_location: input.shareLocation ?? false,
        place_id: input.placeId ?? null,
        highlight_for_place: input.highlightForPlace ?? false,
        patches: input.patches ?? [],
        worldline_links: input.worldline_links ?? [],
        maturity: input.maturity ?? null,
        reading_time: input.readingTime ?? null,
      }

      const { data, error } = await supabase
        .from('entries')
        .insert(insertData)
        .select('id, kind, slug, status')
        .single()

      if (error) return err('DB_ERROR', error.message, error)

      revalidatePath('/', 'layout')
      return { ok: true, entry: data as { id: string; kind: string; slug: string; status: string } }
    }

    if (input.kind === 'fiction') {
      const insertData = {
        kind: 'fiction' as const,
        slug: input.slug,
        status: 'draft' as const,
        lang: input.lang ?? 'en',
        title: input.title ?? null,
        date,
        iso_date: isoDate,
        domain: input.domain ?? null,
        tags: input.tags ?? [],
        summary: input.summary ?? null,
        body: input.body ?? '',
        coords: input.coords ?? null,
        share_location: input.shareLocation ?? false,
        place_id: input.placeId ?? null,
        highlight_for_place: input.highlightForPlace ?? false,
        patches: input.patches ?? [],
        worldline_links: input.worldline_links ?? [],
        variants: input.variants ?? [],
        divergence_cluster: input.divergenceCluster ?? null,
      }

      const { data, error } = await supabase
        .from('entries')
        .insert(insertData)
        .select('id, kind, slug, status')
        .single()

      if (error) return err('DB_ERROR', error.message, error)

      revalidatePath('/', 'layout')
      return { ok: true, entry: data as { id: string; kind: string; slug: string; status: string } }
    }

    if (input.kind === 'photo') {
      const slug = `${input.roll}/${input.photoId}`
      const insertData = {
        kind: 'photo' as const,
        slug,
        status: 'draft' as const,
        roll: input.roll,
        photo_id: input.photoId,
        caption: input.caption ?? null,
        date,
        iso_date: isoDate,
        tags: input.tags ?? [],
        body: input.body ?? '',
        coords: input.coords ?? null,
        share_location: input.shareLocation ?? false,
        place_id: input.placeId ?? null,
        highlight_for_place: input.highlightForPlace ?? false,
        highlight_rank: input.highlightRank ?? null,
        patches: [],
        worldline_links: input.worldline_links ?? [],
        override_place: input.overridePlace ?? null,
      }

      const { data, error } = await supabase
        .from('entries')
        .insert(insertData)
        .select('id, kind, slug, status')
        .single()

      if (error) return err('DB_ERROR', error.message, error)

      revalidatePath('/', 'layout')
      return { ok: true, entry: data as { id: string; kind: string; slug: string; status: string } }
    }

    return err('INVALID_KIND', 'Unknown entry kind')
  } catch (e) {
    return err('UNEXPECTED', 'Unexpected error', String(e))
  }
}

// ---------------------------------------------------------------------------
// updateEntry
// ---------------------------------------------------------------------------

export type UpdateEntryResult =
  | { ok: true; entry: { kind: string; slug: string; id: string } }
  | ActionError

export async function updateEntryImpl(rawInput: unknown): Promise<UpdateEntryResult> {
  const auth = await assertOwner()
  if (!auth.ok) return auth

  const parsed = UpdateEntryInputSchema.safeParse(rawInput)
  if (!parsed.success) return err('INVALID_INPUT', 'Validation failed', parsed.error.flatten())
  const { kind, slug, lang, patch } = parsed.data

  const supabase = await createSupabaseServerClient()

  // Build the DB update object from the patch (camelCase → snake_case)
  const update: Record<string, unknown> = {}
  if (patch.title !== undefined) update['title'] = patch.title
  if (patch.date !== undefined) {
    update['date'] = patch.date
    update['iso_date'] = dotDateToIso(patch.date)
  }
  if (patch.domain !== undefined) update['domain'] = patch.domain
  if (patch.tags !== undefined) update['tags'] = patch.tags
  if (patch.summary !== undefined) update['summary'] = patch.summary
  if (patch.body !== undefined) update['body'] = patch.body
  if (patch.coords !== undefined) update['coords'] = patch.coords
  if (patch.shareLocation !== undefined) update['share_location'] = patch.shareLocation
  if (patch.placeId !== undefined) update['place_id'] = patch.placeId
  if (patch.highlightForPlace !== undefined) update['highlight_for_place'] = patch.highlightForPlace
  if (patch.patches !== undefined) update['patches'] = patch.patches
  if (patch.worldline_links !== undefined) update['worldline_links'] = patch.worldline_links
  if (patch.maturity !== undefined) update['maturity'] = patch.maturity
  if (patch.readingTime !== undefined) update['reading_time'] = patch.readingTime
  if (patch.originLocus !== undefined) update['origin_locus'] = patch.originLocus
  if (patch.variants !== undefined) update['variants'] = patch.variants
  if (patch.divergenceCluster !== undefined) update['divergence_cluster'] = patch.divergenceCluster
  if (patch.caption !== undefined) update['caption'] = patch.caption
  if (patch.overridePlace !== undefined) update['override_place'] = patch.overridePlace
  if (patch.highlightRank !== undefined) update['highlight_rank'] = patch.highlightRank
  // instrument_overrides: null clears the column; object sets override keys.
  // photo_assets.exif is NEVER touched here — it stays raw sensor truth (spec §4.3).
  if (patch.instrumentOverrides !== undefined) update['instrument_overrides'] = patch.instrumentOverrides
  // film_sim: authored override for photo entries.
  // null clears the override (reverts to photo_assets.exif.filmSim at read time).
  // photo_assets.exif is NEVER touched — this only writes entries.film_sim.
  if (patch.filmSim !== undefined) update['film_sim'] = patch.filmSim

  if (Object.keys(update).length === 0) {
    return err('EMPTY_PATCH', 'No fields to update')
  }

  try {
    // Bilingual P4: .eq('lang', lang) scopes the update to exactly one sibling.
    const { data, error } = await supabase
      .from('entries')
      .update(update)
      .eq('kind', kind)
      .eq('slug', slug)
      .eq('lang', lang)
      .select('id, kind, slug')
      .single()

    if (error) return err('DB_ERROR', error.message, error)
    if (!data) return err('NOT_FOUND', `Entry ${kind}/${slug}/${lang} not found`)

    revalidatePath('/', 'layout')
    return { ok: true, entry: data as { id: string; kind: string; slug: string } }
  } catch (e) {
    return err('UNEXPECTED', 'Unexpected error', String(e))
  }
}

// ---------------------------------------------------------------------------
// setEntryDraft (publish/unpublish)
// ---------------------------------------------------------------------------

export type SetEntryDraftResult =
  | { ok: true; entry: { kind: string; slug: string; draft: boolean } }
  | { ok: false; error: { code: 'PUBLISH_INCOMPLETE'; message: string; missingFields: string[] } }
  | ActionError

export async function setEntryDraftImpl(rawInput: unknown): Promise<SetEntryDraftResult> {
  const auth = await assertOwner()
  if (!auth.ok) return auth

  const parsed = SetEntryDraftInputSchema.safeParse(rawInput)
  if (!parsed.success) return err('INVALID_INPUT', 'Validation failed', parsed.error.flatten())
  const { kind, slug, lang, draft } = parsed.data

  const supabase = await createSupabaseServerClient()

  // Fetch the current row (need all fields for publish completeness check).
  // Bilingual P4: .eq('lang', lang) targets exactly one sibling per-language.
  try {
    const { data: row, error: fetchError } = await supabase
      .from('entries')
      .select('*')
      .eq('kind', kind)
      .eq('slug', slug)
      .eq('lang', lang)
      .single()

    if (fetchError || !row) {
      return err('NOT_FOUND', `Entry ${kind}/${slug}/${lang} not found`)
    }

    // DL14: publish path requires completeness check (per-sibling).
    if (!draft) {
      const missing = checkPublishCompleteness(kind, row as Record<string, unknown>)
      if (missing.length > 0) {
        return {
          ok: false,
          error: {
            code: 'PUBLISH_INCOMPLETE',
            message: `Cannot publish: missing required fields: ${missing.join(', ')}`,
            missingFields: missing,
          },
        }
      }
    }

    const newStatus = draft ? 'draft' : 'published'
    // Bilingual P4: per-sibling publish. en can be published while th is draft.
    const { data, error } = await supabase
      .from('entries')
      .update({ status: newStatus })
      .eq('kind', kind)
      .eq('slug', slug)
      .eq('lang', lang)
      .select('kind, slug, status')
      .single()

    if (error) return err('DB_ERROR', error.message, error)

    revalidatePath('/', 'layout')
    const resultRow = data as { kind: string; slug: string; status: string }
    return {
      ok: true,
      entry: {
        kind: resultRow.kind,
        slug: resultRow.slug,
        draft: resultRow.status === 'draft',
      },
    }
  } catch (e) {
    return err('UNEXPECTED', 'Unexpected error', String(e))
  }
}

// ---------------------------------------------------------------------------
// deleteEntry — storage-first, row-second (spec §7, DL9)
// ---------------------------------------------------------------------------

export type DeleteEntryResult =
  | { ok: true; deleted: { kind: string; slug: string }; survivingKeys?: string[] }
  | ActionError

export async function deleteEntryImpl(rawInput: unknown): Promise<DeleteEntryResult> {
  const auth = await assertOwner()
  if (!auth.ok) return auth

  const parsed = DeleteEntryInputSchema.safeParse(rawInput)
  if (!parsed.success) return err('INVALID_INPUT', 'Validation failed', parsed.error.flatten())
  const { kind, slug, lang } = parsed.data

  const supabase = await createSupabaseServerClient()

  try {
    // For photo entries: storage cleanup first.
    // Photos are monolingual (PD5); lang is always 'en' for photos. Storage
    // cleanup is unchanged — it is keyed on the photo roll/photoId slug, not lang.
    if (kind === 'photo') {
      // Parse roll/photoId from slug
      const slashIdx = slug.indexOf('/')
      if (slashIdx === -1) return err('INVALID_SLUG', 'Photo slug must be <roll>/<photoId>')
      const roll = slug.slice(0, slashIdx)
      const photoId = slug.slice(slashIdx + 1)

      // Resolve entry_id first (avoid inline nested-await: passing '' as a UUID
      // causes Postgres 22P02 invalid-uuid error, which aborts the whole delete).
      // Bilingual P4: lang filter scopes to exact sibling (photos always en).
      const { data: entryIdRow, error: entryIdError } = await supabase
        .from('entries')
        .select('id')
        .eq('kind', 'photo')
        .eq('slug', slug)
        .eq('lang', lang)
        .single()

      if (entryIdError || !entryIdRow) {
        return err('NOT_FOUND', `Entry photo/${slug}/${lang} not found`)
      }
      const entryId = (entryIdRow as { id: string }).id

      // Fetch photo_assets to get original_key
      const { data: assetRow, error: assetError } = await supabase
        .from('photo_assets')
        .select('original_key, variants')
        .eq('entry_id', entryId)
        .maybeSingle()

      if (assetError) {
        return err('ASSET_FETCH_FAILED', `Failed to fetch photo_assets: ${assetError.message}`)
      }

      // Collect all storage keys to remove
      const keysToRemove: string[] = []

      // Original key
      if (assetRow?.original_key) {
        keysToRemove.push(assetRow.original_key)
      }

      // Variant keys: list the bucket prefix photos/<roll>/<photoId>/
      const variantPrefix = `${roll}/${photoId}/`
      const { data: variantObjects, error: listError } = await supabase
        .storage
        .from('photos')
        .list(`${roll}/${photoId}`)

      if (listError) {
        return err('STORAGE_LIST_FAILED', `Failed to list variants: ${listError.message}`)
      }

      if (variantObjects && variantObjects.length > 0) {
        for (const obj of variantObjects) {
          keysToRemove.push(`${variantPrefix}${obj.name}`)
        }
      }

      // Remove variant objects from photos bucket
      const variantKeys = keysToRemove.filter((k) => !k.startsWith('originals/'))
      if (variantKeys.length > 0) {
        const { error: removeVariantsError } = await supabase
          .storage
          .from('photos')
          .remove(variantKeys)

        if (removeVariantsError) {
          return err(
            'STORAGE_REMOVE_FAILED',
            `Failed to remove variants: ${removeVariantsError.message}`,
            { survivingKeys: variantKeys },
          )
        }
      }

      // Remove original from originals bucket
      const originalKeys = keysToRemove.filter((k) => !variantKeys.includes(k))
      if (originalKeys.length > 0) {
        const { error: removeOriginalError } = await supabase
          .storage
          .from('originals')
          .remove(originalKeys)

        if (removeOriginalError) {
          // Log but don't fail — original removal is best-effort
          // (orphan sweep handles stranded originals)
          console.warn('[deleteEntry] original removal failed (orphan sweep will reconcile):', removeOriginalError.message)
        }
      }

      // Verify the bucket prefix lists empty after removal
      const { data: afterList } = await supabase
        .storage
        .from('photos')
        .list(`${roll}/${photoId}`)

      const survivingKeys = afterList?.map((o) => `${variantPrefix}${o.name}`) ?? []
      if (survivingKeys.length > 0) {
        return err(
          'STORAGE_NOT_EMPTY',
          `Bucket prefix ${variantPrefix} still has ${survivingKeys.length} object(s) after removal`,
          { survivingKeys },
        )
      }

      // Storage clear confirmed — delete the DB row (photo_assets cascades).
      // Bilingual P4: lang filter ensures only the target sibling is deleted.
      const { error: deleteError } = await supabase
        .from('entries')
        .delete()
        .eq('kind', kind)
        .eq('slug', slug)
        .eq('lang', lang)

      if (deleteError) return err('DB_DELETE_FAILED', deleteError.message, deleteError)

      revalidatePath('/', 'layout')
      return { ok: true, deleted: { kind, slug } }
    }

    // Non-photo (article/fiction): delete exactly the target sibling.
    // Bilingual P4: other language siblings survive — no cascade.
    const { error: deleteError } = await supabase
      .from('entries')
      .delete()
      .eq('kind', kind)
      .eq('slug', slug)
      .eq('lang', lang)

    if (deleteError) return err('DB_DELETE_FAILED', deleteError.message, deleteError)

    revalidatePath('/', 'layout')
    return { ok: true, deleted: { kind, slug } }
  } catch (e) {
    return err('UNEXPECTED', 'Unexpected error', String(e))
  }
}

// ---------------------------------------------------------------------------
// createTranslation (Bilingual P4)
// ---------------------------------------------------------------------------
//
// contract:
//   method      · server action (direct import via actions.ts wrapper)
//   auth        · assertOwner — owner-only write
//   path        · n/a (server action)
//   request     · { kind, slug, fromLang, toLang, patch?: { title?, summary?, body? } }
//   response    · { ok:true, entry: { id, kind, slug, lang, status } }
//                 | { ok:false, error: { code, message, details? } }
//   error codes ·
//     INVALID_INPUT      — zod validation failed
//     AUTH               — not authenticated as owner
//     SAME_LANG          — fromLang === toLang (caught by schema refine)
//     SOURCE_NOT_FOUND   — source (kind, slug, fromLang) row does not exist
//     SIBLING_EXISTS     — (kind, slug, toLang) row already exists (unique constraint)
//     DB_ERROR           — unexpected Supabase error
//     UNEXPECTED         — unhandled throw
//   idempotency · NOT idempotent — second call with same (kind, slug, toLang) returns SIBLING_EXISTS
//   rate limit  · none (owner-only; assertOwner gates)
//
// Language-neutral fields COPIED from source: date, tags, place_id, coords,
//   share_location, domain, maturity, reading_time, patches, worldline_links,
//   variants (fiction), divergence_cluster (fiction), origin_locus (fiction).
//   Photos are monolingual (PD5) — this action does not accept kind='photo'.
//
// Language-specific fields SEEDED from patch (blank if absent):
//   title, summary, body.
//   The new sibling starts as status='draft'. It will be blocked from publish
//   by entries_check5/check6 until the owner supplies a translated title and
//   summary — this is intentional (spec §5.2) and surfaced as a per-sibling
//   console completeness error, not a bug.

export type CreateTranslationResult =
  | { ok: true; entry: { id: string; kind: string; slug: string; lang: string; status: string } }
  | ActionError

export async function createTranslationImpl(rawInput: unknown): Promise<CreateTranslationResult> {
  const auth = await assertOwner()
  if (!auth.ok) return auth

  const parsed = CreateTranslationInputSchema.safeParse(rawInput)
  if (!parsed.success) return err('INVALID_INPUT', 'Validation failed', parsed.error.flatten())
  const { kind, slug, fromLang, toLang, patch } = parsed.data

  const supabase = await createSupabaseServerClient()

  try {
    // Load source sibling (kind, slug, fromLang)
    const { data: sourceRow, error: sourceError } = await supabase
      .from('entries')
      .select('*')
      .eq('kind', kind)
      .eq('slug', slug)
      .eq('lang', fromLang)
      .single()

    if (sourceError || !sourceRow) {
      return err('SOURCE_NOT_FOUND', `Source entry ${kind}/${slug}/${fromLang} not found`)
    }

    const src = sourceRow as Record<string, unknown>

    // Build the new sibling row.
    // Language-neutral fields are copied from source.
    // Language-specific fields (title, summary, body) come from patch (blank if absent).
    const insertData: Record<string, unknown> = {
      kind,
      slug,
      lang: toLang,
      status: 'draft',
      // Language-specific — from patch (blank-seeded if absent)
      title:   patch?.title   ?? null,
      summary: patch?.summary ?? null,
      body:    patch?.body    ?? '',
      // Language-neutral — copied from source
      date:               src['date'],
      iso_date:           src['iso_date'],
      tags:               src['tags']             ?? [],
      place_id:           src['place_id']         ?? null,
      coords:             src['coords']           ?? null,
      share_location:     src['share_location']   ?? false,
      domain:             src['domain']           ?? null,
      maturity:           src['maturity']         ?? null,
      reading_time:       src['reading_time']     ?? null,
      patches:            src['patches']          ?? [],
      worldline_links:    src['worldline_links']  ?? [],
      highlight_for_place: src['highlight_for_place'] ?? false,
    }

    // Fiction-specific neutral fields
    if (kind === 'fiction') {
      insertData['variants']           = src['variants']            ?? []
      insertData['divergence_cluster'] = src['divergence_cluster']  ?? null
      insertData['origin_locus']       = src['origin_locus']        ?? null
    }

    const { data, error: insertError } = await supabase
      .from('entries')
      .insert(insertData)
      .select('id, kind, slug, lang, status')
      .single()

    if (insertError) {
      // 23505 = unique_violation (entries_kind_slug_lang_unique) — sibling already exists
      if (insertError.code === '23505') {
        return err(
          'SIBLING_EXISTS',
          `Translation sibling ${kind}/${slug}/${toLang} already exists`,
          { pgCode: insertError.code },
        )
      }
      return err('DB_ERROR', insertError.message, insertError)
    }

    revalidatePath('/', 'layout')
    return {
      ok: true,
      entry: data as { id: string; kind: string; slug: string; lang: string; status: string },
    }
  } catch (e) {
    return err('UNEXPECTED', 'Unexpected error', String(e))
  }
}

// ---------------------------------------------------------------------------
// createRoll
// ---------------------------------------------------------------------------

export type CreateRollResult =
  | { ok: true; roll: { roll: string; date: string } }
  | ActionError

export async function createRollImpl(rawInput: unknown): Promise<CreateRollResult> {
  const auth = await assertOwner()
  if (!auth.ok) return auth

  const parsed = CreateRollInputSchema.safeParse(rawInput)
  if (!parsed.success) return err('INVALID_INPUT', 'Validation failed', parsed.error.flatten())
  const input = parsed.data

  const supabase = await createSupabaseServerClient()

  try {
    const { data, error } = await supabase
      .from('rolls')
      .insert({
        roll: input.roll,
        id: input.roll, // roll descriptor id defaults to roll slug
        date: input.date,
        iso_date: dotDateToIso(input.date),
        caption: input.caption ?? null,
        share_location: input.shareLocation ?? false,
        coords: input.coords ?? null,
        body: input.body ?? '',
      })
      .select('roll, date')
      .single()

    if (error) return err('DB_ERROR', error.message, error)

    revalidatePath('/', 'layout')
    return { ok: true, roll: data as { roll: string; date: string } }
  } catch (e) {
    return err('UNEXPECTED', 'Unexpected error', String(e))
  }
}

// ---------------------------------------------------------------------------
// ingestPhoto — DL3: browser already uploaded original; we do server-side work
// ---------------------------------------------------------------------------

export type IngestPhotoResult =
  | {
      ok: true
      entry: { kind: string; slug: string; id: string }
      exif: Record<string, unknown> | null
      /** true when EXIF GPS was found and written to entries.coords automatically */
      gpsAutoSet: boolean
      variantKeys: {
        thumb: { jpg: string; webp: string; avif: string }
        medium: { jpg: string; webp: string; avif: string }
        full: { jpg: string; webp: string; avif: string }
      }
    }
  | ActionError

// ---------------------------------------------------------------------------
// MIME / extension allow-list for formats the ingest pipeline supports
// ---------------------------------------------------------------------------
//
// HEIC/HEIF — sharp ships with libheif WITHOUT the HEVC decoder, so real
// iPhone HEICs (HEVC-compressed) fail with "Support for this compression
// format has not been built in". heic-convert uses WASM libheif WITH the
// HEVC decoder and handles both HEVC and AV1 HEIC — it is the correct
// pre-conversion step. We decode to JPEG first, then feed that buffer to
// sharp. (Confirmed 2026-06-16 on IMG_7481.HEIC: HEVC iPhone HEIC → JPEG
// 1334785B → sharp jpeg/webp/avif all OK.)
//
// RAW (.RAF, .CR2, .NEF, .ARW, .DNG, .RW2, etc.) — we do NOT full-decode RAW
// (libraw/dcraw is too heavy for serverless). Instead we extract the embedded
// JPEG preview (virtually all RAW files carry one) via extractLargestJpegPreview()
// and feed THAT to the sharp variant pipeline. The RAW original is kept in
// storage as the archival copy (large — user is warned on the client side).
//
// Extensions that remain UNSUPPORTED (rejected with clear code):
//   .bmp, .ico, .svg, and any other non-image type.
//
// The allow-list uses file extension (lower-cased) because the originalKey
// path is the only artifact we have server-side (the browser already uploaded
// the file before ingestPhotoImpl is called).

const SHARP_SUPPORTED_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'tif', 'tiff',
])

const HEIC_EXTENSIONS = new Set(['heic', 'heif'])

// Camera RAW formats whose containers embed a JPEG preview we can extract.
// Fujifilm .raf, Canon .cr2/.cr3, Nikon .nef/.nrw, Sony .arw, Adobe .dng,
// Panasonic .rw2, Olympus .orf, Leica .rwl/.raw, Pentax .pef — all confirmed
// to carry at least a large-preview JPEG in their byte stream.
const RAW_EXTENSIONS = new Set([
  'raf', 'cr2', 'cr3', 'nef', 'nrw', 'arw', 'dng', 'rw2', 'orf',
  'pef', 'rwl', 'raw', 'srw', 'x3f', '3fr',
])

function classifyExtension(key: string): 'supported' | 'heic' | 'raw' | 'unsupported' {
  const ext = (key.split('.').pop() ?? '').toLowerCase()
  if (SHARP_SUPPORTED_EXTENSIONS.has(ext)) return 'supported'
  if (HEIC_EXTENSIONS.has(ext)) return 'heic'
  if (RAW_EXTENSIONS.has(ext)) return 'raw'
  return 'unsupported'
}

// ---------------------------------------------------------------------------
// extractRafJpegPreview — Fujifilm RAF format-aware header extraction
// ---------------------------------------------------------------------------
//
// RAF (Fujifilm RAW) stores the embedded full-res JPEG preview at a known
// header offset. The magic string 'FUJIFILMCCD-RAW' appears at byte 0.
//
//   bytes 84–87  uint32 BE  — byte offset of the embedded JPEG in the file
//   bytes 88–91  uint32 BE  — byte length of the embedded JPEG
//
// Slicing buf[offset..offset+length] yields a clean, complete JPEG.
// Validated by Polaris on DSCF0835.RAF: offset=148, length≈4.4MB,
// decodes to 4416×2944, camera=X-E5, lens=XF23mmF2.8 R WR, ISO=1600.
//
// This approach is preferred over the byte-scan fallback because the RAF
// byte stream also contains many smaller JPEG spans (thumbnails, IOPs) that
// the scan would compete with — the header gives us the right one directly.
//
// Returns null if:
//   - magic does not match (not a RAF)
//   - offset/length are out of range (malformed header)
//   - the sliced buffer fails sharp.metadata() validation

async function extractRafJpegPreview(buf: Buffer): Promise<Buffer | null> {
  const RAF_MAGIC = 'FUJIFILMCCD-RAW'
  if (buf.length < 92) return null
  if (buf.subarray(0, RAF_MAGIC.length).toString('ascii') !== RAF_MAGIC) return null

  const offset = buf.readUInt32BE(84)
  const length = buf.readUInt32BE(88)

  // Sanity: offset must be within the file, length must be at least a minimal JPEG
  if (
    offset < 92 ||
    length < 100 ||
    offset > buf.length ||
    offset + length > buf.length
  ) {
    console.warn(
      `[extractRafJpegPreview] Header values out of range: offset=${offset} length=${length} fileSize=${buf.length} — falling back to byte-scan`,
    )
    return null
  }

  const candidate = Buffer.from(buf.buffer, buf.byteOffset + offset, length)

  // Validate: sharp must be able to decode it
  try {
    const sharpLib = (await import('sharp')).default
    await sharpLib(candidate).metadata()
    return candidate
  } catch {
    console.warn('[extractRafJpegPreview] Header-sliced JPEG failed sharp.metadata() — falling back to byte-scan')
    return null
  }
}

// ---------------------------------------------------------------------------
// extractLargestJpegPreview — format-aware RAW preview extractor
// ---------------------------------------------------------------------------
//
// Entry point for all RAW formats. Dispatch order:
//
//   1. RAF (Fujifilm): extractRafJpegPreview — uses the header-encoded
//      offset/length to get the full-res JPEG directly (no scanning).
//
//   2. TIFF-based RAW (CR2, NEF, ARW, DNG, RW2, ORF, PEF, etc.): byte-scan
//      for SOI…EOI candidates, sorted largest-first, then validated one by
//      one via sharp.metadata(). The first candidate that sharp can decode
//      is returned. This is more expensive (O(n) scan + try/catch per
//      candidate) but handles the full variety of TIFF-based containers.
//
//      The previous naive implementation picked the LARGEST RAW SPAN without
//      validation. On real Fujifilm RAFs this grabbed a corrupt cross-boundary
//      span ('VipsJpeg: Corrupt JPEG data'). The validated fallback prevents
//      that for all TIFF-based formats too.
//
// Returns null if no valid JPEG preview can be extracted.

async function extractLargestJpegPreview(buf: Buffer): Promise<Buffer | null> {
  // --- Path 1: Fujifilm RAF (header-based, zero-scan) ---
  const rafResult = await extractRafJpegPreview(buf)
  if (rafResult !== null) return rafResult

  // --- Path 2: TIFF-based RAW (validated byte-scan) ---
  // Collect all SOI…EOI candidates (SOI = 0xFF 0xD8 0xFF).
  // For each SOI, scan forward for the LAST EOI (0xFF 0xD9) to get the
  // outermost span — inner EOIs (e.g. from nested thumbnail JFIFs) would
  // truncate the candidate prematurely.
  const candidates: Array<{ start: number; len: number }> = []

  for (let i = 0; i < buf.length - 4; i++) {
    if (buf[i] === 0xFF && buf[i + 1] === 0xD8 && buf[i + 2] === 0xFF) {
      // Scan for the LAST EOI from this SOI onwards
      let lastEoiEnd = -1
      for (let j = i + 4; j < buf.length - 1; j++) {
        if (buf[j] === 0xFF && buf[j + 1] === 0xD9) {
          lastEoiEnd = j + 2
          // Do NOT break — keep scanning for a later EOI (outermost span)
        }
      }
      if (lastEoiEnd !== -1) {
        candidates.push({ start: i, len: lastEoiEnd - i })
      }
    }
  }

  if (candidates.length === 0) return null

  // Sort largest-first: the full-res preview is almost always the biggest span
  candidates.sort((a, b) => b.len - a.len)

  // Try candidates in order; return the first that sharp can decode
  const sharpLib = (await import('sharp')).default
  for (const { start, len } of candidates) {
    const candidate = Buffer.from(buf.buffer, buf.byteOffset + start, len)
    try {
      await sharpLib(candidate).metadata()
      return candidate
    } catch {
      // This candidate is corrupt or not a real JPEG — try the next
    }
  }

  return null
}

export async function ingestPhotoImpl(rawInput: unknown): Promise<IngestPhotoResult> {
  const auth = await assertOwner()
  if (!auth.ok) return auth

  const parsed = IngestPhotoInputSchema.safeParse(rawInput)
  if (!parsed.success) return err('INVALID_INPUT', 'Validation failed', parsed.error.flatten())
  const { roll, photoId, originalKey, overwrite } = parsed.data

  // --- [GATE] Validate file type BEFORE downloading ---
  // This check runs before any download/processing so no orphan is possible here.
  // HEIC: pre-converted to JPEG via heic-convert (WASM libheif, HEVC+AV1), allow through.
  // RAW:  embedded JPEG preview extraction path (extractLargestJpegPreview).
  // Anything else: reject with a clear error code.
  const extClass = classifyExtension(originalKey)
  const fileExt  = (originalKey.split('.').pop() ?? '').toLowerCase()
  if (extClass === 'unsupported') {
    return err(
      'UNSUPPORTED_TYPE',
      `File type ".${fileExt}" is not supported. Supported formats: JPEG, PNG, WEBP, AVIF, GIF, TIFF, HEIC/HEIF, and RAW (RAF/CR2/NEF/ARW/DNG/RW2/ORF/PEF).`,
      { extension: fileExt },
    )
  }

  const supabase = await createSupabaseServerClient()
  const slug = `${roll}/${photoId}`

  // ---------------------------------------------------------------------------
  // Rollback helper — called on any failure AFTER we know the original is in
  // storage (the browser uploads before calling this action). Deletes the
  // original from the `originals` bucket so no orphan is left.
  //
  // Rollback is best-effort: if it fails we log a warning (the periodic orphan
  // sweep will reconcile) but we still return the original error to the caller.
  // ---------------------------------------------------------------------------
  async function rollbackOriginal(reason: string): Promise<void> {
    try {
      const { error: removeErr } = await supabase
        .storage
        .from('originals')
        .remove([originalKey])
      if (removeErr) {
        console.warn(
          `[ingestPhoto] rollback: failed to delete original "${originalKey}" after ${reason}:`,
          removeErr.message,
        )
      } else {
        console.info(`[ingestPhoto] rollback: deleted original "${originalKey}" after ${reason}.`)
      }
    } catch (e) {
      console.warn(`[ingestPhoto] rollback: unexpected error deleting "${originalKey}":`, String(e))
    }
  }

  try {
    // --- Check for existing entry with variants (collision guard) ---
    const { data: existingEntry } = await supabase
      .from('entries')
      .select('id, status')
      .eq('kind', 'photo')
      .eq('slug', slug)
      .maybeSingle()

    if (existingEntry) {
      // Check if photo_assets already has variants
      const { data: existingAssets } = await supabase
        .from('photo_assets')
        .select('variants')
        .eq('entry_id', existingEntry.id)
        .maybeSingle()

      if (existingAssets?.variants && !overwrite) {
        // COLLISION — original already ingested; don't roll back (it's referenced)
        return err(
          'COLLISION',
          `Entry ${slug} already has variants. Pass overwrite:true to re-ingest.`,
        )
      }
    }

    // --- Download original from originals bucket ---
    const { data: downloadData, error: downloadError } = await supabase
      .storage
      .from('originals')
      .download(originalKey)

    if (downloadError || !downloadData) {
      // Download failed — original may or may not be in storage; attempt rollback
      await rollbackOriginal('DOWNLOAD_FAILED')
      return err('DOWNLOAD_FAILED', `Failed to download original: ${downloadError?.message ?? 'no data'}`)
    }

    const sourceBuffer = Buffer.from(await downloadData.arrayBuffer())
    const sourceHash = createHash('sha1').update(sourceBuffer).digest('hex').slice(0, 10)

    // --- RAW: extract embedded JPEG preview for variant generation ---
    // For camera RAW files (RAF, CR2, NEF, ARW, DNG, etc.) we cannot feed the raw
    // sensor data to sharp — libvips has no RAW decoder. Instead we extract the
    // embedded JPEG preview (virtually every RAW file contains one at full or large
    // resolution) and use THAT for variant generation.
    //
    // EXIF (camera/lens/ISO/GPS) is still extracted from the full RAW buffer, since
    // the metadata lives in the RAW header, not the embedded JPEG.
    //
    // The RAW original is kept in storage as the archival copy. The client-side
    // warning about large file size is the only consumer-facing cue.
    let decodeBuffer = sourceBuffer  // what sharp will process (may be swapped for RAW)

    if (extClass === 'raw') {
      const previewBuf = await extractLargestJpegPreview(sourceBuffer)
      if (!previewBuf) {
        await rollbackOriginal('RAW_NO_PREVIEW')
        return err(
          'RAW_NO_PREVIEW',
          `No embedded JPEG preview found in RAW file ".${fileExt}". The file may be malformed or use a format that does not embed a preview.`,
          { extension: fileExt },
        )
      }
      console.info(`[ingestPhoto] RAW "${originalKey}": extracted ${previewBuf.length}B embedded JPEG preview (raw was ${sourceBuffer.length}B)`)
      decodeBuffer = Buffer.from(previewBuf)
    }

    // --- HEIC/HEIF: pre-convert to JPEG via heic-convert (WASM libheif) ---
    //
    // sharp's bundled libheif lacks the HEVC decoder, so real iPhone HEICs fail
    // with "Support for this compression format has not been built in".
    // heic-convert ships libheif WITH HEVC + AV1 support via WASM and handles
    // both codec variants. We decode to JPEG at quality 0.92 (lossless-equivalent
    // for the source; sharp will re-encode to final variants at VARIANT_QUALITY).
    //
    // EXIF is still extracted from sourceBuffer (the original HEIC bytes) below —
    // exifr handles HEIC natively. If that fails we fall back to the JPEG buffer.
    //
    // On failure (corrupt/unsupported HEIC): rollback the original and return a
    // clear HEIC_DECODE_FAILED error — Sirius will surface it in the UI.
    if (extClass === 'heic') {
      try {
        const convert = (await import('heic-convert')).default
        const jpegResult = await convert({ buffer: sourceBuffer, format: 'JPEG', quality: 0.92 })
        decodeBuffer = Buffer.from(jpegResult)
        console.info(`[ingestPhoto] HEIC "${originalKey}": decoded to JPEG ${decodeBuffer.length}B (source was ${sourceBuffer.length}B)`)
      } catch (heicError) {
        await rollbackOriginal('HEIC_DECODE_FAILED')
        return err(
          'HEIC_DECODE_FAILED',
          `HEIC decode failed for "${originalKey}". The file may be corrupt or use an unsupported codec variant.`,
          { cause: String(heicError) },
        )
      }
    }

    // --- EXIF extraction ---
    // exifr is a dynamic import (optional dep at runtime, required at ingest time).
    //
    // Extraction strategy (in order):
    //   1. Try sourceBuffer (the full original). Works for JPEG/PNG/HEIC/TIFF-RAW.
    //   2. For RAF containers: exifr throws 'Unknown file format' on the RAF bytes.
    //      Fall back to decodeBuffer (the extracted embedded JPEG) — the JPEG header
    //      carries the full EXIF IFD (camera/lens/ISO/GPS/DateTimeOriginal).
    //      Verified on DSCF0835.RAF: exifr on the extracted JPEG returns X-E5,
    //      XF23mmF2.8 R WR, ISO 1600, DateTimeOriginal correctly.
    //
    // GPS auto-detect (Layer 1 gate):
    //   exifr computes decimal latitude/longitude from GPSLatitude+Ref automatically.
    //   We extract them here and write to entries.coords (owner-authored column).
    //   The public variant has GPS EXIF stripped by sharp (no .withMetadata()) —
    //   Layer 1 gate. The DB trigger (served_coords) gates public exposure by
    //   share_location — Layer 2 gate. These two layers are independent.
    //   GPS never appears in the photo_assets.exif record (public artifact).
    //
    // Film sim auto-detect (DEFERRED — NOT feasible via exifr):
    //   Fujifilm stores film simulation in a proprietary MakerNote IFD.
    //   exifr parses Fujifilm MakerNote as a raw byte array (keys 0..N) — it does
    //   NOT decode the IFD to named tags. FilmMode/FilmSimulation fields are NOT
    //   available. Investigated 2026-06-13 on DSCF0344.JPG (X-E5):
    //     makerNote result → object with numeric keys 0..1307, no film-related key.
    //     explicit pick:['FilmMode','FilmSimulation','Saturation'] → no results.
    //   Workaround candidates: exiftool (heavy, unsuitable for serverless) or a
    //   standalone Fujifilm MakerNote IFD parser. DEFERRED pending lightweight
    //   alternative. Manual film-sim selector (Sirius console) is the current path.
    //   entries.film_sim (migration 0011) accepts the manual override.
    const EXIF_PICK = [
      'Make', 'Model', 'LensModel', 'LensMake',
      'FNumber', 'ExposureTime', 'ISO', 'FocalLength', 'FocalLengthIn35mmFormat',
      'DateTimeOriginal',
      // GPS tags: exifr auto-computes decimal latitude/longitude from these
      'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef',
    ]
    const EXIF_PARSE_OPTS = {
      // makerNote: intentionally false — Fujifilm MakerNote decodes only as an
      // opaque byte array (not named tags), so including it wastes parse budget
      // and adds a 1308-key object to memory with no actionable content.
      // Film sim detection is deferred; see note above.
      mergeOutput: true,
    }
    let rawExif: Record<string, unknown> = {}
    try {
      const exifr = (await import('exifr')).default
      // Primary: parse the original bytes. Works for JPEG/PNG/HEIC/TIFF-RAW.
      rawExif = await exifr.parse(sourceBuffer, { pick: EXIF_PICK, ...EXIF_PARSE_OPTS }) ?? {}
    } catch (exifError) {
      // RAF containers: exifr throws 'Unknown file format' on the RAF bytes.
      // HEIC containers: exifr can normally parse HEIC natively, but if it fails
      // (e.g. unusual metadata layout), fall back to the heic-convert JPEG which
      // also carries the EXIF IFD. In both cases decodeBuffer !== sourceBuffer.
      if ((extClass === 'raw' || extClass === 'heic') && decodeBuffer !== sourceBuffer) {
        try {
          const exifr = (await import('exifr')).default
          console.info(`[ingestPhoto] EXIF: sourceBuffer parse failed for ${extClass.toUpperCase()} container — retrying on decoded buffer`)
          rawExif = await exifr.parse(decodeBuffer, { pick: EXIF_PICK, ...EXIF_PARSE_OPTS }) ?? {}
        } catch (fallbackError) {
          console.warn('[ingestPhoto] EXIF extraction failed on both source and decoded buffer (proceeding without):', String(fallbackError))
        }
      } else {
        // EXIF extraction failure is non-fatal: proceed with empty exif
        console.warn('[ingestPhoto] EXIF extraction failed (proceeding without):', String(exifError))
      }
    }

    // Extract GPS for auto-coord (owner column). exifr merges decimal lat/lon
    // as top-level 'latitude'/'longitude' when GPSLatitude+Ref are present.
    // Validate: both must be finite numbers in valid range.
    const exifLat = rawExif['latitude'] as number | undefined
    const exifLon = rawExif['longitude'] as number | undefined
    const gpsAutoSet =
      typeof exifLat === 'number' && isFinite(exifLat) &&
      typeof exifLon === 'number' && isFinite(exifLon) &&
      exifLat >= -90 && exifLat <= 90 &&
      exifLon >= -180 && exifLon <= 180

    // Build the clean EXIF record — GPS is NEVER included here (Layer 1)
    // regardless of shareLocation. shareLocation affects served_coords (Layer 2,
    // DB trigger) and the raw entries.coords column (owner-authored). The EXIF
    // record in photo_assets is a public artifact (visible in DB to anon for
    // published photos) so GPS must never appear here.
    const exifRecord = {
      camera: [rawExif['Make'], rawExif['Model']].filter(Boolean).join(' ').trim() || undefined,
      lens:   (rawExif['LensModel'] as string | undefined) ?? undefined,
      filmSim: readFujiFilmSim(rawExif),
      aperture: (rawExif['FNumber'] as number | undefined) ?? undefined,
      shutter:  formatShutter(rawExif['ExposureTime'] as number | undefined),
      iso:      (rawExif['ISO'] as number | undefined) ?? undefined,
      focal:    (rawExif['FocalLength'] as number | undefined) ?? undefined,
      focal35:  (rawExif['FocalLengthIn35mmFormat'] as number | undefined) ?? undefined,
      captureTime: rawExif['DateTimeOriginal'] instanceof Date
        ? (rawExif['DateTimeOriginal'] as Date).toISOString()
        : typeof rawExif['DateTimeOriginal'] === 'string'
          ? rawExif['DateTimeOriginal']
          : undefined,
      // GPS fields are INTENTIONALLY EXCLUDED — no coordinates in EXIF record
    }

    // --- Variant generation with sharp ---
    // CRITICAL: NO .withMetadata() — sharp strips all EXIF by default.
    // .rotate() bakes EXIF orientation before stripping.
    // Adding .withMetadata() would re-embed GPS into the world-readable
    // photos bucket. This is forbidden (spec §4.3, §2.5).
    //
    // For RAW files: decodeBuffer is the extracted embedded JPEG preview (not the
    // original RAW bytes). For HEIC/HEIF: decodeBuffer is the heic-convert JPEG
    // (WASM libheif decoded). For standard formats: decodeBuffer === sourceBuffer.
    const sharp = (await import('sharp')).default

    type VariantKey = { jpg: string; webp: string; avif: string }
    const variantKeys: {
      thumb?: VariantKey
      medium?: VariantKey
      full?: VariantKey
    } = {}

    for (const size of VARIANT_SIZES) {
      const sizeKeys: VariantKey = { jpg: '', webp: '', avif: '' }

      for (const fmt of ['jpg', 'webp', 'avif'] as const) {
        // Key scheme: photos/<roll>/<photoId>/<size>-<sourceHash10>.<fmt>
        const objectKey = `${roll}/${photoId}/${size.name}-${sourceHash}.${fmt}`
        sizeKeys[fmt] = objectKey

        // Generate the variant buffer
        // NO .withMetadata() — intentionally omitted per spec
        // decodeBuffer: for RAW = embedded JPEG preview; for HEIC = heic-convert JPEG; for JPEG/PNG = original
        const pipeline = sharp(decodeBuffer, { failOn: 'truncated' })
          .rotate()  // bake EXIF orientation, then EXIF is stripped by default
          .resize({ width: size.width, withoutEnlargement: true })

        let variantBuffer: Buffer
        if (fmt === 'jpg') {
          variantBuffer = await pipeline.jpeg({ quality: VARIANT_QUALITY[size.name].jpg, mozjpeg: true }).toBuffer()
        } else if (fmt === 'webp') {
          variantBuffer = await pipeline.webp({ quality: VARIANT_QUALITY[size.name].webp }).toBuffer()
        } else {
          variantBuffer = await pipeline.avif({ quality: VARIANT_QUALITY[size.name].avif }).toBuffer()
        }

        // Recheck access on new requests; draft variants never use a public bucket.
        const mimeType = fmt === 'jpg' ? 'image/jpeg' : fmt === 'webp' ? 'image/webp' : 'image/avif'
        const { error: uploadError } = await supabase
          .storage
          .from('photos')
          .upload(objectKey, variantBuffer, {
            contentType: mimeType,
            cacheControl: '0',
            upsert: true,  // safe: key is content-addressed (sourceHash10); same content = same key
          })

        if (uploadError) {
          await rollbackOriginal('UPLOAD_FAILED')
          return err('UPLOAD_FAILED', `Failed to upload ${objectKey}: ${uploadError.message}`)
        }
      }

      variantKeys[size.name] = sizeKeys
    }

    const fullVariantKeys = variantKeys as {
      thumb: VariantKey
      medium: VariantKey
      full: VariantKey
    }

    // --- Upsert entries row (draft, kind=photo) ---
    // Determine date from sidecar info or today
    const today = todayDotDate()
    let entryId: string

    if (existingEntry) {
      // Existing entry: patch coords from GPS if the entry has no coords yet
      // and GPS was detected. Never overwrite an existing authored coord.
      if (gpsAutoSet) {
        const { data: existingCoords } = await supabase
          .from('entries')
          .select('coords')
          .eq('id', existingEntry.id)
          .single()
        const hasCoords = (existingCoords as { coords: unknown } | null)?.coords != null
        if (!hasCoords) {
          await supabase
            .from('entries')
            .update({ coords: { lat: exifLat, lon: exifLon } })
            .eq('id', existingEntry.id)
          // non-fatal: if this update fails the ingest continues; coords can be set manually
        }
      }
      entryId = existingEntry.id
    } else {
      // Insert new draft sidecar; include GPS coords if detected
      const insertPayload: Record<string, unknown> = {
        kind: 'photo' as const,
        slug,
        status: 'draft' as const,
        roll,
        photo_id: photoId,
        date: today,
        iso_date: dotDateToIso(today),
        tags: [],
        body: '',
        share_location: false,
        highlight_for_place: false,
        patches: [],
        worldline_links: [],
      }

      // Auto-set coords from EXIF GPS (owner column, raw).
      // Privacy: share_location defaults to false → served_coords stays null (Layer 2).
      // The owner can enable share_location separately after reviewing the coord.
      if (gpsAutoSet) {
        insertPayload['coords'] = { lat: exifLat, lon: exifLon }
      }

      const { data: newEntry, error: insertError } = await supabase
        .from('entries')
        .insert(insertPayload)
        .select('id')
        .single()

      if (insertError || !newEntry) {
        await rollbackOriginal('DB_INSERT_FAILED')
        return err('DB_INSERT_FAILED', `Failed to create entry: ${insertError?.message ?? 'no data'}`)
      }
      entryId = (newEntry as { id: string }).id
    }

    // --- Upsert photo_assets ---
    const { error: assetError } = await supabase
      .from('photo_assets')
      .upsert(
        {
          entry_id: entryId,
          original_key: originalKey,
          source_hash: sourceHash,
          exif: Object.keys(exifRecord).some((k) => exifRecord[k as keyof typeof exifRecord] != null)
            ? exifRecord
            : null,
          variants: fullVariantKeys,
        },
        { onConflict: 'entry_id' },
      )

    if (assetError) {
      await rollbackOriginal('ASSET_UPSERT_FAILED')
      return err('ASSET_UPSERT_FAILED', `Failed to upsert photo_assets: ${assetError.message}`)
    }

    revalidatePath('/', 'layout')
    return {
      ok: true,
      entry: { kind: 'photo', slug, id: entryId },
      exif: exifRecord as Record<string, unknown>,
      gpsAutoSet,
      variantKeys: fullVariantKeys,
    }
  } catch (e) {
    // Unexpected throw — attempt rollback before surfacing the error.
    // rollbackOriginal is async; we must await it here. The outer catch receives
    // the original thrown value (not a Promise rejection from rollback).
    await rollbackOriginal('UNEXPECTED')
    return err('UNEXPECTED', 'Unexpected error during ingest', String(e))
  }
}

// ---------------------------------------------------------------------------
// createPlace (DL15 — table-write, NOT place-registry.data.json)
// ---------------------------------------------------------------------------

export type CreatePlaceResult =
  | { ok: true; place: { id: string; name: string; lat: number; lon: number } }
  | ActionError

export async function createPlaceImpl(rawInput: unknown): Promise<CreatePlaceResult> {
  const auth = await assertOwner()
  if (!auth.ok) return auth

  const parsed = CreatePlaceInputSchema.safeParse(rawInput)
  if (!parsed.success) return err('INVALID_INPUT', 'Validation failed', parsed.error.flatten())
  const input = parsed.data

  const supabase = await createSupabaseServerClient()

  // Derive id from name if not provided (mirrors old highlight-core nameToId)
  const id = input.id ?? input.name.split(' · ')[0].trim().toLowerCase().replace(/\s+/g, '-')

  if (!/^[a-z0-9-]+$/.test(id)) {
    return err('INVALID_ID', `Generated id "${id}" is not valid kebab-case`)
  }

  try {
    const { data, error } = await supabase
      .from('places')
      .insert({
        id,
        name: input.name,
        lat: input.lat,
        lon: input.lon,
        level: input.level ?? 1,
        parent_id: input.parentId ?? null,
      })
      .select('id, name, lat, lon')
      .single()

    if (error) {
      if (error.code === '23505') {
        return err('DUPLICATE_ID', `A place with id "${id}" already exists`)
      }
      return err('DB_ERROR', error.message, error)
    }

    revalidatePath('/', 'layout')
    return { ok: true, place: data as { id: string; name: string; lat: number; lon: number } }
  } catch (e) {
    return err('UNEXPECTED', 'Unexpected error', String(e))
  }
}

// ---------------------------------------------------------------------------
// savePlaceCoord (DL15)
// ---------------------------------------------------------------------------

export type SavePlaceCoordResult =
  | { ok: true; place: { id: string; name: string; lat: number; lon: number } }
  | ActionError

export async function savePlaceCoordImpl(rawInput: unknown): Promise<SavePlaceCoordResult> {
  const auth = await assertOwner()
  if (!auth.ok) return auth

  const parsed = SavePlaceCoordInputSchema.safeParse(rawInput)
  if (!parsed.success) return err('INVALID_INPUT', 'Validation failed', parsed.error.flatten())
  const { placeId, lat, lon } = parsed.data

  const supabase = await createSupabaseServerClient()

  try {
    const { data, error } = await supabase
      .from('places')
      .update({ lat, lon })
      .eq('id', placeId)
      .select('id, name, lat, lon')
      .single()

    if (error) return err('DB_ERROR', error.message, error)
    if (!data) return err('NOT_FOUND', `Place "${placeId}" not found`)

    revalidatePath('/', 'layout')
    return { ok: true, place: data as { id: string; name: string; lat: number; lon: number } }
  } catch (e) {
    return err('UNEXPECTED', 'Unexpected error', String(e))
  }
}

// ---------------------------------------------------------------------------
// savePlaceHighlights — calls save_place_highlights SQL RPC (DL15)
// ---------------------------------------------------------------------------

export type SavePlaceHighlightsResult =
  | {
      ok: true
      highlights: {
        articleHighlight: { slug: string; fileNum: string; title: string } | null
        photoHighlights: { roll: string; id: string; rank: number }[]
      }
      warnings?: string[]
    }
  | ActionError

export async function savePlaceHighlightsImpl(rawInput: unknown): Promise<SavePlaceHighlightsResult> {
  const auth = await assertOwner()
  if (!auth.ok) return auth

  const parsed = SavePlaceHighlightsInputSchema.safeParse(rawInput)
  if (!parsed.success) return err('INVALID_INPUT', 'Validation failed', parsed.error.flatten())
  const { placeId, articleSlug, photoFrames } = parsed.data

  const supabase = await createSupabaseServerClient()

  try {
    const { data, error } = await supabase.rpc('save_place_highlights', {
      p_place_id: placeId,
      p_article_slug: articleSlug,
      p_photo_frames: photoFrames,
    })

    if (error) {
      // Translate PL/pgSQL raise exception messages to structured errors
      const msg = error.message ?? ''
      if (msg.includes('PLACE_NOT_FOUND')) return err('PLACE_NOT_FOUND', msg)
      if (msg.includes('ARTICLE_NOT_FOUND')) return err('ARTICLE_NOT_FOUND', msg)
      if (msg.includes('PHOTO_NOT_FOUND')) return err('PHOTO_NOT_FOUND', msg)
      if (msg.includes('INVALID_INPUT')) return err('INVALID_INPUT', msg)
      return err('DB_ERROR', msg, error)
    }

    const result = data as {
      articleHighlight: { slug: string; fileNum: string; title: string } | null
      photoHighlights: { roll: string; id: string; rank: number }[]
    }

    revalidatePath('/', 'layout')
    return { ok: true, highlights: result }
  } catch (e) {
    return err('UNEXPECTED', 'Unexpected error', String(e))
  }
}

// ---------------------------------------------------------------------------
// setAlphaPlace — designate one place as the alpha locus (movable-alpha)
// ---------------------------------------------------------------------------

export type SetAlphaPlaceResult =
  | { ok: true; alphaId: string }
  | ActionError

/**
 * Atomically designates one place as the alpha locus.
 *
 * Uses a single UPDATE ... SET is_alpha = (id = $1) so every row is written in
 * the same statement — the partial-unique index on (is_alpha) WHERE is_alpha=true
 * never sees a transient double-true mid-transaction. No intermediate state exists
 * where zero or two places are alpha.
 *
 * The globe Ne0 stratum camera framing and NEXT NODE cycle consume is_alpha via
 * getAlphaPlace() (lib/store/reads.ts). After this call resolves, the Next.js
 * cache is revalidated so the next render picks up the new locus.
 *
 * PRD reference: movable-alpha goal (Peat 2026-06-13).
 */
export async function setAlphaPlaceImpl(rawInput: unknown): Promise<SetAlphaPlaceResult> {
  const auth = await assertOwner()
  if (!auth.ok) return auth

  const parsed = SetAlphaPlaceInputSchema.safeParse(rawInput)
  if (!parsed.success) return err('INVALID_INPUT', 'Validation failed', parsed.error.flatten())
  const { placeId } = parsed.data

  const supabase = await createSupabaseServerClient()

  try {
    // Single-statement path via set_alpha_place SQL function (migration 0009b).
    // UPDATE places SET is_alpha = (id = p_place_id) — the partial-unique index
    // (places_one_alpha_idx) evaluates the full table AFTER the statement, so it
    // sees at most one true and never blocks on a momentary double-true.
    const { data, error } = await supabase.rpc('set_alpha_place', { p_place_id: placeId })

    if (error) {
      const msg = error.message ?? ''
      if (msg.includes('PLACE_NOT_FOUND')) return err('NOT_FOUND', `Place "${placeId}" not found`)
      return err('DB_ERROR', msg, error)
    }

    revalidatePath('/', 'layout')
    return { ok: true, alphaId: data as string }
  } catch (e) {
    return err('UNEXPECTED', 'Unexpected error', String(e))
  }
}

// ---------------------------------------------------------------------------
// resolveDefaultRoll — idempotent "snapshots" roll for quick-ingest
// ---------------------------------------------------------------------------
//
// Design choice: date-based roll `YYYY-MM-snapshots`.
//   - Uses EXIF capture month from the original image if available.
//   - Falls back to current calendar month if no EXIF date.
//   - The roll slug format `YYYY-MM-snapshots` satisfies the DB CHECK
//     (roll ~ '^\\d{4}-\\d{2}-[a-z0-9-]+$').
//   - Peat can re-roll later in the instrument editor via updateEntry.
//
// The helper does NOT call assertOwner() directly — it is called from
// quickUploadPhotoImpl which guards auth first. It is not exported as a
// public server action; only quickUploadPhoto is the public surface.
//
// The download of the original here is a lightweight EXIF-only peek.
// quickUploadPhotoImpl will download again for variant generation.
// Two downloads of the same owner object is the trade-off for keeping
// ingestPhotoImpl's signature stable (no captureMonth injection needed).

async function resolveDefaultRollSlug(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  originalKey: string,
): Promise<string> {
  // Attempt to read DateTimeOriginal from EXIF to derive capture month.
  let yearMonth: string | null = null

  try {
    const { data: downloadData } = await supabase
      .storage
      .from('originals')
      .download(originalKey)

    if (downloadData) {
      const buf = Buffer.from(await downloadData.arrayBuffer())
      const exifr = (await import('exifr')).default

      // Try to parse EXIF directly (works for JPEG/PNG/HEIC/TIFF-RAW).
      // For RAF containers exifr throws 'Unknown file format' — in that case
      // extract the embedded JPEG preview and parse EXIF from it instead.
      let rawExif: Record<string, unknown> = {}
      try {
        rawExif = await exifr.parse(buf, { pick: ['DateTimeOriginal'], mergeOutput: true }) ?? {}
      } catch {
        // Likely a RAF container — attempt extraction and re-parse
        try {
          const previewBuf = await extractLargestJpegPreview(buf)
          if (previewBuf) {
            rawExif = await exifr.parse(previewBuf, { pick: ['DateTimeOriginal'], mergeOutput: true }) ?? {}
          }
        } catch {
          // still non-fatal; fall through to current-month
        }
      }

      const dto = rawExif['DateTimeOriginal']
      let captureDate: Date | null = null

      if (dto instanceof Date) {
        captureDate = dto
      } else if (typeof dto === 'string') {
        const parsed = new Date(dto)
        if (!isNaN(parsed.getTime())) captureDate = parsed
      }

      if (captureDate) {
        const y = captureDate.getFullYear()
        const m = String(captureDate.getMonth() + 1).padStart(2, '0')
        yearMonth = `${y}-${m}`
      }
    }
  } catch {
    // EXIF peek failure is non-fatal — fall through to current-month
  }

  if (!yearMonth) {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    yearMonth = `${y}-${m}`
  }

  return `${yearMonth}-snapshots`
}

// ---------------------------------------------------------------------------
// quickUploadPhoto — frictionless file → published, no metadata required
// ---------------------------------------------------------------------------

export const QuickUploadPhotoInputSchema = z.object({
  /** Storage key in the `originals` bucket — caller uploads the file first. */
  originalKey: z.string().min(1),
  /**
   * photoId: alphanumeric identifier, max 40 chars. If not provided, a
   * timestamp-based id is generated from the current date (YYYY-MM-DD format
   * with a short random suffix to avoid collisions on same-day uploads).
   */
  photoId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,40}$/, 'photoId must be alphanumeric 1–40 chars')
    .optional(),
})

export type QuickUploadPhotoInput = z.infer<typeof QuickUploadPhotoInputSchema>

export type QuickUploadPhotoResult =
  | {
      ok: true
      roll: string
      rollCreated: boolean
      entry: { kind: string; slug: string; id: string; status: string }
      exif: Record<string, unknown> | null
      gpsAutoSet: boolean
      variantKeys: {
        thumb: { jpg: string; webp: string; avif: string }
        medium: { jpg: string; webp: string; avif: string }
        full: { jpg: string; webp: string; avif: string }
      }
    }
  | ActionError

/**
 * Frictionless quick-ingest: original in storage → published photo entry.
 *
 * Steps:
 *   1. assertOwner
 *   2. Resolve default roll (YYYY-MM-snapshots from EXIF capture month or now);
 *      auto-create the roll if it does not exist (idempotent per roll slug).
 *   3. Derive photoId from originalKey filename if caller omits it.
 *   4. Call ingestPhotoImpl (EXIF extraction, variant generation, entry upsert).
 *   5. Set entry status = 'published' immediately (photos have no completeness gate).
 *   6. revalidatePath
 *
 * Privacy: share_location stays false (default); served_coords = null (Layer 2).
 * GPS is written to entries.coords (owner column) but not exposed publicly
 * until the owner explicitly enables share_location via the instrument editor.
 *
 * The caller may override photoId but never needs to provide a roll — the
 * auto-default roll is the whole point of this action.
 *
 * Idempotency: if the original already has variants (same slug), this action
 * returns COLLISION (same as ingestPhotoImpl without overwrite:true). The roll
 * creation step is idempotent (no-op if roll exists).
 */
export async function quickUploadPhotoImpl(rawInput: unknown): Promise<QuickUploadPhotoResult> {
  const auth = await assertOwner()
  if (!auth.ok) return auth

  const parsed = QuickUploadPhotoInputSchema.safeParse(rawInput)
  if (!parsed.success) return err('INVALID_INPUT', 'Validation failed', parsed.error.flatten())
  const { originalKey } = parsed.data

  const supabase = await createSupabaseServerClient()

  try {
    // --- Step 1: Resolve default roll slug from EXIF capture month ---
    const rollSlug = await resolveDefaultRollSlug(supabase, originalKey)

    // --- Step 2: Ensure roll exists (idempotent create) ---
    let rollCreated = false
    const { data: existingRoll } = await supabase
      .from('rolls')
      .select('roll')
      .eq('roll', rollSlug)
      .maybeSingle()

    if (!existingRoll) {
      // Derive a dot-date from the roll's YYYY-MM (first of month)
      const [ym] = rollSlug.split('-snapshots')
      const [yyyy, mm] = ym.split('-')
      const rollDate = `${yyyy}.${mm}.01`

      const { error: rollInsertError } = await supabase
        .from('rolls')
        .insert({
          roll: rollSlug,
          id: rollSlug,
          date: rollDate,
          iso_date: dotDateToIso(rollDate),
          caption: null,
          share_location: false,
          coords: null,
          body: '',
        })

      if (rollInsertError) {
        // If it's a duplicate-key race (concurrent quick-upload), treat as ok
        if (rollInsertError.code !== '23505') {
          return err('ROLL_CREATE_FAILED', `Failed to create default roll: ${rollInsertError.message}`, rollInsertError)
        }
        // else: concurrent creation won the race, roll exists now — proceed
      } else {
        rollCreated = true
      }
    }

    // --- Step 3: Derive photoId ---
    // Use caller-provided photoId if given. Otherwise derive from the
    // originalKey filename stem (e.g. "DSCF0344.JPG" → "DSCF0344"),
    // appending today's date prefix to namespace same-filename re-uploads.
    let photoId = parsed.data.photoId
    if (!photoId) {
      const filename = originalKey.split('/').pop() ?? originalKey
      const stem = filename.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 35)
      // Suffix: today YYYYMMDD to namespace same-filename uploads across days
      const now = new Date()
      const suffix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
      photoId = `${stem}-${suffix}`.slice(0, 40)
    }

    // --- Step 4: Ingest (EXIF extraction, variant generation, entry insert) ---
    const ingestResult = await ingestPhotoImpl({
      roll: rollSlug,
      photoId,
      originalKey,
      overwrite: false,
    })

    if (!ingestResult.ok) return ingestResult

    // --- Step 5: Publish immediately (photos have no completeness gate) ---
    // Direct DB update — no setEntryDraftImpl round-trip needed since photos
    // return [] from checkPublishCompleteness (schema.ts:269).
    const { error: publishError } = await supabase
      .from('entries')
      .update({ status: 'published' })
      .eq('id', ingestResult.entry.id)
      .eq('kind', 'photo')

    if (publishError) {
      return err(
        'PUBLISH_FAILED',
        `Ingest succeeded but publish failed: ${publishError.message}`,
        { entryId: ingestResult.entry.id, supabaseError: publishError },
      )
    }

    revalidatePath('/', 'layout')

    return {
      ok: true,
      roll: rollSlug,
      rollCreated,
      entry: { ...ingestResult.entry, status: 'published' },
      exif: ingestResult.exif,
      gpsAutoSet: ingestResult.gpsAutoSet,
      variantKeys: ingestResult.variantKeys,
    }
  } catch (e) {
    return err('UNEXPECTED', 'Unexpected error during quick upload', String(e))
  }
}
