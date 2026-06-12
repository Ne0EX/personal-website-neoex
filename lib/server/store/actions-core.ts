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
 *   - Uploads variants to `photos` bucket with cacheControl:3600
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
  const { kind, slug, patch } = parsed.data

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

  if (Object.keys(update).length === 0) {
    return err('EMPTY_PATCH', 'No fields to update')
  }

  try {
    const { data, error } = await supabase
      .from('entries')
      .update(update)
      .eq('kind', kind)
      .eq('slug', slug)
      .select('id, kind, slug')
      .single()

    if (error) return err('DB_ERROR', error.message, error)
    if (!data) return err('NOT_FOUND', `Entry ${kind}/${slug} not found`)

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
  const { kind, slug, draft } = parsed.data

  const supabase = await createSupabaseServerClient()

  // Fetch the current row (need all fields for publish completeness check)
  try {
    const { data: row, error: fetchError } = await supabase
      .from('entries')
      .select('*')
      .eq('kind', kind)
      .eq('slug', slug)
      .single()

    if (fetchError || !row) {
      return err('NOT_FOUND', `Entry ${kind}/${slug} not found`)
    }

    // DL14: publish path requires completeness check
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
    const { data, error } = await supabase
      .from('entries')
      .update({ status: newStatus })
      .eq('kind', kind)
      .eq('slug', slug)
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
  const { kind, slug } = parsed.data

  const supabase = await createSupabaseServerClient()

  try {
    // For photo entries: storage cleanup first
    if (kind === 'photo') {
      // Parse roll/photoId from slug
      const slashIdx = slug.indexOf('/')
      if (slashIdx === -1) return err('INVALID_SLUG', 'Photo slug must be <roll>/<photoId>')
      const roll = slug.slice(0, slashIdx)
      const photoId = slug.slice(slashIdx + 1)

      // Fetch photo_assets to get original_key and variants
      const { data: assetRow, error: assetError } = await supabase
        .from('photo_assets')
        .select('original_key, variants')
        .eq('entry_id', (
          await supabase.from('entries').select('id').eq('kind', 'photo').eq('slug', slug).single()
        ).data?.id ?? '')
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

      // Storage clear confirmed — delete the DB row (photo_assets cascades)
      const { error: deleteError } = await supabase
        .from('entries')
        .delete()
        .eq('kind', kind)
        .eq('slug', slug)

      if (deleteError) return err('DB_DELETE_FAILED', deleteError.message, deleteError)

      revalidatePath('/', 'layout')
      return { ok: true, deleted: { kind, slug } }
    }

    // Non-photo: just delete the row
    const { error: deleteError } = await supabase
      .from('entries')
      .delete()
      .eq('kind', kind)
      .eq('slug', slug)

    if (deleteError) return err('DB_DELETE_FAILED', deleteError.message, deleteError)

    revalidatePath('/', 'layout')
    return { ok: true, deleted: { kind, slug } }
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
      variantKeys: {
        thumb: { jpg: string; webp: string; avif: string }
        medium: { jpg: string; webp: string; avif: string }
        full: { jpg: string; webp: string; avif: string }
      }
    }
  | ActionError

export async function ingestPhotoImpl(rawInput: unknown): Promise<IngestPhotoResult> {
  const auth = await assertOwner()
  if (!auth.ok) return auth

  const parsed = IngestPhotoInputSchema.safeParse(rawInput)
  if (!parsed.success) return err('INVALID_INPUT', 'Validation failed', parsed.error.flatten())
  const { roll, photoId, originalKey, overwrite } = parsed.data

  const supabase = await createSupabaseServerClient()
  const slug = `${roll}/${photoId}`

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
      return err('DOWNLOAD_FAILED', `Failed to download original: ${downloadError?.message ?? 'no data'}`)
    }

    const sourceBuffer = Buffer.from(await downloadData.arrayBuffer())
    const sourceHash = createHash('sha1').update(sourceBuffer).digest('hex').slice(0, 10)

    // --- EXIF extraction ---
    // exifr is a dynamic import (optional dep at runtime, required at ingest time).
    // Privacy gate (Layer 1): GPS is NEVER included in the exif record unless
    // shareLocation is explicitly true on the sidecar/entry (spec §4.3, §2.5).
    let rawExif: Record<string, unknown> = {}
    try {
      const exifr = (await import('exifr')).default
      rawExif = await exifr.parse(sourceBuffer, {
        pick: [
          'Make', 'Model', 'LensModel', 'LensMake',
          'FNumber', 'ExposureTime', 'ISO', 'FocalLength', 'FocalLengthIn35mmFormat',
          'DateTimeOriginal',
          'GPSLatitude', 'GPSLongitude', 'GPSLatitudeRef', 'GPSLongitudeRef',
        ],
        makerNote: true,   // critical for Fuji FilmSimulation fields
        mergeOutput: true,
      }) ?? {}
    } catch (exifError) {
      // EXIF extraction failure is non-fatal: proceed with empty exif
      console.warn('[ingestPhoto] EXIF extraction failed (proceeding without):', String(exifError))
    }

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
        const pipeline = sharp(sourceBuffer, { failOn: 'truncated' })
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

        // Upload to photos bucket with cacheControl:3600 (CDN stop within 1h on delete)
        const mimeType = fmt === 'jpg' ? 'image/jpeg' : fmt === 'webp' ? 'image/webp' : 'image/avif'
        const { error: uploadError } = await supabase
          .storage
          .from('photos')
          .upload(objectKey, variantBuffer, {
            contentType: mimeType,
            cacheControl: '3600',
            upsert: true,  // safe: key is content-addressed (sourceHash10); same content = same key
          })

        if (uploadError) {
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
      // Update existing row
      entryId = existingEntry.id
    } else {
      // Insert new draft sidecar
      const { data: newEntry, error: insertError } = await supabase
        .from('entries')
        .insert({
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
        })
        .select('id')
        .single()

      if (insertError || !newEntry) {
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
      return err('ASSET_UPSERT_FAILED', `Failed to upsert photo_assets: ${assetError.message}`)
    }

    revalidatePath('/', 'layout')
    return {
      ok: true,
      entry: { kind: 'photo', slug, id: entryId },
      exif: exifRecord as Record<string, unknown>,
      variantKeys: fullVariantKeys,
    }
  } catch (e) {
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
