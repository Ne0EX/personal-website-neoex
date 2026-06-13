'use server'
/**
 * lib/server/store/actions.ts
 * ---------------------------------------------------------------------------
 * S5 server actions — supersede lib/server/entries/* + lib/server/places/*
 * file-write implementations.
 *
 * This file is the 'use server' thin wrapper layer. All logic lives in
 * actions-core.ts — only async function wrappers may be exported from a
 * 'use server' module (Next.js 16 constraint).
 *
 * // contract
 * method      · server action (direct import, no HTTP)
 * auth        · assertOwner() is the first call in every impl
 * idempotency · createEntry: non-idempotent (unique constraint on kind+slug)
 *               updateEntry: idempotent on equal values
 *               setEntryDraft: idempotent on equal (kind, slug, draft)
 *               deleteEntry: NOT idempotent (second call returns NOT_FOUND)
 *               ingestPhoto: idempotent via content-addressed sourceHash10 key;
 *                            collision-guarded without overwrite:true
 *               createPlace: non-idempotent (unique id constraint)
 *               savePlaceCoord: idempotent
 *               savePlaceHighlights: idempotent (clears then resets)
 *               createRoll: non-idempotent
 *               quickUploadPhoto: NOT idempotent (second call returns COLLISION
 *                 for the same originalKey+photoId). Roll creation step IS
 *                 idempotent (race-safe via 23505 ignore).
 * rate limit  · none (owner-only; RLS is the hard boundary)
 * error shape · {ok:false, error:{code:string, message:string, details?:unknown}}
 *
 * CALLING CONVENTION FOR SIRIUS:
 *   import { createEntry, updateEntry, ... } from '@/lib/server/store/actions'
 *   const result = await createEntry({ kind: 'article', title: 'My post', ... })
 *   if (!result.ok) { handle result.error }
 *
 * Owner: Altair (α-BND-02) · store-as-source S5
 * // server-action: altair
 */

import {
  createEntryImpl,
  updateEntryImpl,
  setEntryDraftImpl,
  deleteEntryImpl,
  createRollImpl,
  ingestPhotoImpl,
  createPlaceImpl,
  savePlaceCoordImpl,
  savePlaceHighlightsImpl,
  setAlphaPlaceImpl,
  quickUploadPhotoImpl,
  type CreateEntryResult,
  type UpdateEntryResult,
  type SetEntryDraftResult,
  type DeleteEntryResult,
  type CreateRollResult,
  type IngestPhotoResult,
  type CreatePlaceResult,
  type SavePlaceCoordResult,
  type SavePlaceHighlightsResult,
  type SetAlphaPlaceResult,
  type QuickUploadPhotoResult,
} from './actions-core'

// NOTE: Result types are NOT re-exported here. 'use server' modules must only
// export async functions — any export type {} block in a 'use server' file can
// confuse the Next.js action-proxy bundler (it tries to generate runtime
// proxies for type-only exports). Import result types directly from
// './actions-core' if you need them in a non-server context.

/**
 * Create a new content entry as a DRAFT (DL14 — minimal draft is valid).
 * Article: kind+date minimum (slug auto-assigned from next free fileNum).
 * Fiction: kind+slug+date minimum.
 * Photo: kind+roll+photoId+date minimum.
 */
export async function createEntry(input: unknown): Promise<CreateEntryResult> {
  return createEntryImpl(input)
}

/**
 * Update any authored field on an existing entry (incl. body, maturity, coords).
 * The editor SAVE button calls this with patch:{body: latestContent}.
 */
export async function updateEntry(input: unknown): Promise<UpdateEntryResult> {
  return updateEntryImpl(input)
}

/**
 * Publish (draft:false) or unpublish (draft:true) an entry.
 *
 * Publish path (draft:false) enforces DL14 completeness:
 *   - Article: title + domain + maturity + readingTime + summary + coords required
 *   - Fiction: title + domain + summary required
 *   - Photo: DB CHECK enforces roll/photo_id; no extra app-side completeness
 *
 * Returns {ok:false, error:{code:'PUBLISH_INCOMPLETE', missingFields:string[]}}
 * when completeness is not met — the UI shows the field list.
 */
export async function setEntryDraft(input: unknown): Promise<SetEntryDraftResult> {
  return setEntryDraftImpl(input)
}

/**
 * Hard-delete an entry (DL9 — no soft delete).
 *
 * For photo entries: storage-first. Lists + removes variants from photos bucket,
 * removes original from originals bucket, verifies prefix listing empty, then
 * deletes the DB row (photo_assets cascades). Returns {ok:false} with
 * survivingKeys if storage removal fails — the row is NOT deleted and the
 * orphan sweep script is the reconciler.
 */
export async function deleteEntry(input: unknown): Promise<DeleteEntryResult> {
  return deleteEntryImpl(input)
}

/**
 * Create a new roll descriptor (roll.mdx equivalent).
 * The roll must exist before ingestPhoto can link photos to it.
 */
export async function createRoll(input: unknown): Promise<CreateRollResult> {
  return createRollImpl(input)
}

/**
 * Server-side half of the photo ingest pipeline (DL3).
 *
 * The browser has already uploaded the original to the originals bucket.
 * This action:
 *   1. Downloads the original from originals bucket (owner session)
 *   2. Extracts EXIF with exifr (GPS dropped unless share_location — Layer 1)
 *   3. Generates 3×3 sharp variants (NO .withMetadata() — spec explicit)
 *   4. Uploads variants to photos bucket (cacheControl:3600)
 *   5. Upserts entries (draft) + photo_assets
 *
 * Refuses without overwrite:true if the entry already has variants.
 */
export async function ingestPhoto(input: unknown): Promise<IngestPhotoResult> {
  return ingestPhotoImpl(input)
}

/**
 * Create a new place in the places table (DL15 — NOT place-registry.data.json).
 * Same return contract as the old place-actions.ts createPlace.
 */
export async function createPlace(input: unknown): Promise<CreatePlaceResult> {
  return createPlaceImpl(input)
}

/**
 * Update a place's coordinates in the places table (DL15).
 * Same return contract as the old place-actions.ts savePlaceCoord.
 */
export async function savePlaceCoord(input: unknown): Promise<SavePlaceCoordResult> {
  return savePlaceCoordImpl(input)
}

/**
 * Set the curated highlights for a place in a single transaction.
 * Calls the save_place_highlights SQL function (security invoker — RLS applies).
 * Same return contract as the old place-actions.ts savePlaceHighlights.
 *
 * Clears all existing highlight fields for the place, then sets new ones.
 * Partial-unique indexes (§2.4) are the integrity backstop.
 */
export async function savePlaceHighlights(input: unknown): Promise<SavePlaceHighlightsResult> {
  return savePlaceHighlightsImpl(input)
}

/**
 * Designate one place as the alpha locus (observer home coordinate).
 *
 * Uses the set_alpha_place SQL function (migration 0009b) which issues a single
 * UPDATE places SET is_alpha = (id = p_place_id) — the partial-unique index
 * (places_one_alpha_idx) sees at most one true per transaction, never blocking
 * on a momentary double-true.
 *
 * After this action resolves the globe's Ne0 stratum camera framing and NEXT NODE
 * cycle start from the new locus on the next render (revalidatePath clears cache).
 *
 * @param input.placeId — kebab-case place id (must exist in places table)
 */
export async function setAlphaPlace(input: unknown): Promise<SetAlphaPlaceResult> {
  return setAlphaPlaceImpl(input)
}

/**
 * Frictionless quick-ingest: drop a photo file → it appears as published.
 *
 * // contract
 * method      · server action (direct import)
 * auth        · assertOwner() first
 * request     · {
 *                 originalKey: string    — key in originals bucket (caller uploads first)
 *                 photoId?:    string    — optional; derived from filename if absent
 *               }
 * response    · {
 *                 ok: true,
 *                 roll: string,          — the auto-resolved YYYY-MM-snapshots roll slug
 *                 rollCreated: boolean,  — true if the roll was created this call
 *                 entry: { kind, slug, id, status:'published' },
 *                 exif: Record<string,unknown>|null,
 *                 gpsAutoSet: boolean,
 *                 variantKeys: { thumb, medium, full } × { jpg, webp, avif }
 *               } | { ok: false, error: { code, message, details? } }
 * error codes ·
 *   INVALID_INPUT   — zod validation failed
 *   COLLISION       — photoId already has variants (pass a unique photoId)
 *   ROLL_CREATE_FAILED — could not create default roll (non-race DB error)
 *   PUBLISH_FAILED  — ingest succeeded but status update failed
 *   DOWNLOAD_FAILED — originals bucket download error
 *   UPLOAD_FAILED   — photos bucket upload error
 *   UNEXPECTED      — unhandled throw
 * idempotency · NOT idempotent (COLLISION on second call with same photoId in same roll).
 *               Roll creation IS idempotent (safe under concurrent quick-uploads).
 * rate limit  · none (owner-only)
 */
export async function quickUploadPhoto(input: unknown): Promise<QuickUploadPhotoResult> {
  return quickUploadPhotoImpl(input)
}
