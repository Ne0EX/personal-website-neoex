'use server'
/**
 * lib/server/entries/entry-actions.ts
 * --------------------------------------
 * Dev-only server actions for the T1 entry lifecycle (draft toggle + delete).
 *
 * 'use server' at the top of this file makes every export a React Server
 * Function (Next.js 16). All logic lives in entry-lifecycle-core.ts — this file
 * is the thin async wrapper layer required by the 'use server' constraint
 * (only async functions may be exported from a 'use server' module).
 *
 * CALLING CONVENTION FOR SIRIUS:
 *   Import these functions directly — do NOT call them via fetch() to an API
 *   route. Server actions are called as direct imports from Client Components or
 *   via useTransition/useActionState; Next.js handles the serialization boundary.
 *
 *   Example:
 *     import { setEntryDraft, deleteEntry } from '@/lib/server/entries/entry-actions'
 *
 *     // Draft toggle:
 *     const result = await setEntryDraft({ kind: 'article', slug: '003', draft: true })
 *     if (!result.ok) { ... handle result.error ... }
 *     // result.entry = { kind: 'article', slug: '003', draft: true }
 *     // Update local React state from the return value — do NOT trigger a velite refetch.
 *
 *     // Delete:
 *     const result = await deleteEntry({ kind: 'fiction', slug: 'transmission-001' })
 *     if (!result.ok) { ... handle result.error ... }
 *     // result.deleted = { kind: 'fiction', slug: 'transmission-001' }
 *     // Remove the entry from local state immediately.
 *     // NOTE: the velite cache is stale until the dev server restarts / content rebuilds.
 *     // Subsequent getAllArticles/getAllFiction/etc calls will still return the deleted entry
 *     // until then — the console must remove it from its local collection optimistically.
 *
 * PHOTO SLUG FORMAT:
 *   Photo sidecars are identified by "<roll>/<id>", e.g. "2026-04-chiang-mai/DSCF0001".
 *   The forward slash separates roll from id; both halves are validated strictly
 *   (roll: YYYY-MM-<place-slug>, id: alphanumeric 1–40 chars).
 *
 * DEV-ONLY GUARD:
 *   Each action checks NODE_ENV before doing any I/O. In production (Vercel),
 *   the filesystem is read-only and these actions are not intended to run.
 *   The guard returns {ok:false, error:{code:'DEV_GUARD',...}} — not a throw —
 *   so the client can display a clear error rather than seeing an opaque 500.
 *
 * deleteEntry SCOPE:
 *   Removes ONLY the content source .mdx file. Does NOT touch:
 *     - public/photos/* generated image variants
 *     - source JPEG files
 *     - any build artifact outside content/
 *   The .mdx is git-recoverable. Generated images intentionally persist.
 *
 * contract:
 *   method      · server action (direct import, no HTTP)
 *   auth        · dev-only; NODE_ENV guard replaces an auth check
 *   idempotency · setEntryDraft is idempotent on equal (kind, slug, draft) values;
 *                 deleteEntry is NOT idempotent (second call returns FILE_NOT_FOUND)
 *   rate limit  · none (local dev only; Vercel guard prevents production use)
 *
 * Owner: Altair (α-BND-02) · T1 lifecycle
 * Consumed by: Sirius (Atlas Console article-editor, draft rail)
 *
 * // server-action: altair
 */

import {
  setEntryDraftImpl,
  deleteEntryImpl,
  type SetEntryDraftInput,
  type DeleteEntryInput,
  type SetEntryDraftResult,
  type DeleteEntryResult,
} from './entry-lifecycle-core'

/**
 * Toggle the `draft` frontmatter field on a content entry.
 *
 * draft=true  → writes "draft: true" to frontmatter (hides from public in production).
 * draft=false → removes the "draft" key (velite .default(false) treats absence as false).
 *
 * Does NOT touch `status` (maturity ladder). Status and draft are orthogonal.
 *
 * Returns the authoritative new state.
 * The caller MUST update React state from the return value — do NOT trigger a velite refetch.
 *
 * @param input.kind  - Content kind: 'article' | 'photo' | 'fiction'
 * @param input.slug  - Identifier:
 *                        article → zero-padded fileNum, e.g. "003"
 *                        fiction → kebab slug, e.g. "transmission-001"
 *                        photo   → "<roll>/<id>", e.g. "2026-04-chiang-mai/DSCF0001"
 * @param input.draft - Target draft state (true = draft, false = published)
 */
export async function setEntryDraft(
  input: SetEntryDraftInput,
): Promise<SetEntryDraftResult> {
  return setEntryDraftImpl(input)
}

/**
 * Delete a content entry's source .mdx file.
 *
 * REMOVES ONLY THE .mdx SOURCE FILE. Generated image variants, source JPEGs,
 * and all other artifacts are intentionally left in place.
 *
 * The deleted file is recoverable via git. The velite cache will remain stale
 * (showing the entry) until the dev server restarts or content is rebuilt —
 * the caller must remove the entry from console state optimistically rather than
 * waiting for a velite refetch.
 *
 * NOT idempotent: a second call for the same entry returns { ok:false, error:{code:'FILE_NOT_FOUND'} }.
 *
 * @param input.kind - Content kind: 'article' | 'photo' | 'fiction'
 * @param input.slug - Same identifier semantics as setEntryDraft
 */
export async function deleteEntry(
  input: DeleteEntryInput,
): Promise<DeleteEntryResult> {
  return deleteEntryImpl(input)
}
