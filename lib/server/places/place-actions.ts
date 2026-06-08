'use server'
/**
 * lib/server/places/place-actions.ts
 * ------------------------------------
 * Dev-only server actions for the Atlas Console places-curation write layer.
 *
 * 'use server' at the top of this file makes every export a React Server
 * Function (Next.js 16). All logic lives in highlight-core.ts — this file
 * is the thin async wrapper layer required by the 'use server' constraint
 * (only async functions may be exported from a 'use server' module).
 *
 * CALLING CONVENTION FOR SIRIUS:
 *   Import these functions directly — do NOT call them via a fetch() to an
 *   API route. Server actions are called as direct imports from Client
 *   Components or via useTransition/useActionState; Next.js handles the
 *   serialization boundary internally.
 *
 *   Example:
 *     import { savePlaceHighlights } from '@/lib/server/places/place-actions'
 *     // inside an async Client Component handler or useTransition callback:
 *     const result = await savePlaceHighlights({ placeId: 'bangkok', ... })
 *     if (!result.ok) { ... handle error ... }
 *     // result.highlights is the authoritative new state — update React state
 *     // directly from this return value. Do NOT trigger a velite refetch.
 *
 * DEV-ONLY GUARD:
 *   Each action checks NODE_ENV before doing any I/O. In production (Vercel),
 *   the filesystem is read-only and these actions are not intended to run.
 *   The guard returns {ok:false, error:{code:'DEV_GUARD',...}} — not a throw —
 *   so the client can display a clear error rather than seeing an opaque 500.
 *
 * TRANSACTIONAL GUARANTEE:
 *   savePlaceHighlights reads all files → transforms all in memory → validates
 *   end-state → writes atomically (temp + rename in same directory). No file
 *   is touched until the entire plan is valid.
 *
 * contract:
 *   method · server action (direct import, no HTTP)
 *   auth   · dev-only; NODE_ENV guard replaces an auth check
 *   idempotency · setFrontmatterField is idempotent on equal values;
 *                 savePlaceHighlights/savePlaceCoord are safe to retry
 *                 (though the result may differ if state changed between calls)
 *   rate limit · none (local dev only; Vercel guard prevents production use)
 *
 * Owner: Altair (α-BND-02) · CURATION-BUILD-PLAN.md §Altair lane
 * Consumed by: Sirius (console highlight editor, places rail)
 *
 * // server-action: altair
 */

import {
  savePlaceHighlightsImpl,
  savePlaceCoordImpl,
  createPlaceImpl,
  type SavePlaceHighlightsInput,
  type SavePlaceCoordInput,
  type CreatePlaceInput,
  type SavePlaceHighlightsResult,
  type SavePlaceCoordResult,
  type CreatePlaceResult,
} from './highlight-core'

/**
 * Save or update the curated highlights for a place.
 *
 * Transactional per-place:
 *   - Sets highlightForPlace:true on the chosen article, clears it on all others
 *     at this place (places.ts throws on >1 article highlight — this action is
 *     the sole guard against that constraint).
 *   - Assigns highlightRank 1..N contiguous and unique to chosen frames in order;
 *     clears highlightRank on every other sidecar at this place.
 *   - Sets placeId on chosen records if missing.
 *
 * Returns the authoritative new state computed from what was just written.
 * The caller MUST update React state from the return value — do NOT trigger
 * a velite refetch for the immediate panel/rail update.
 *
 * @param input.placeId      - Registry place id (must exist)
 * @param input.articleSlug  - fileNum of the article to highlight (e.g. "003"), or null to clear
 * @param input.photoFrames  - Ordered frames, max 5, no duplicates
 */
export async function savePlaceHighlights(
  input: SavePlaceHighlightsInput,
): Promise<SavePlaceHighlightsResult> {
  return savePlaceHighlightsImpl(input)
}

/**
 * Update the coordinate for a registered place.
 * Rewrites the place's coord in the place data JSON atomically.
 * Returns the full updated place atom.
 *
 * @param input.placeId - Registry place id (must exist)
 * @param input.lat     - Latitude [-90, 90]
 * @param input.lon     - Longitude [-180, 180]
 */
export async function savePlaceCoord(
  input: SavePlaceCoordInput,
): Promise<SavePlaceCoordResult> {
  return savePlaceCoordImpl(input)
}

/**
 * Create and register a new L1 place.
 * Appends to the place data JSON atomically.
 * The new place is immediately queryable from getPlaceById (module cache is
 * NOT busted automatically — restart dev server to pick up the new atom in
 * subsequent builds; the return value provides the authoritative new place data).
 *
 * @param input.id    - Explicit kebab-case id (optional; derived from name if absent)
 * @param input.name  - Display name, e.g. "Singapore · SG"
 * @param input.coord - {lat, lon}
 */
export async function createPlace(
  input: CreatePlaceInput,
): Promise<CreatePlaceResult> {
  return createPlaceImpl(input)
}
