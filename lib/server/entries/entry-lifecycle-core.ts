/**
 * lib/server/entries/entry-lifecycle-core.ts
 * -------------------------------------------
 * Core logic for the dev-only T1 lifecycle write layer (draft toggle + delete).
 * No 'use server' directive — exports zod schemas, return types, path helpers,
 * and the two action implementations. Server actions in entry-actions.ts call
 * these functions directly.
 *
 * WHY SPLIT:
 *   A 'use server' module may export only async functions. Zod schemas, types,
 *   and sync helpers cannot be exported from that module (build error). Splitting
 *   also makes these core functions independently testable by Algol without
 *   server-action machinery.
 *
 * DEV-ONLY GUARD:
 *   Every exported action-impl calls assertDev() first. Vercel production has a
 *   read-only filesystem; these actions are local authoring only. Callers receive
 *   a discriminated {ok:false, error} response — no unhandled throw crossing the
 *   server-action boundary.
 *
 * PATH-CONTAINMENT STRATEGY (per adversarial spec):
 *   PRIMARY: strict per-kind regex on input identifiers. A slug like "../articles/000"
 *   fails `\d{3}` (article) or the kebab regex (fiction) or the roll/id split (photo)
 *   BEFORE any filesystem path is constructed. Additionally, the record is looked up in
 *   the velite cache — no match → NOT_FOUND, no fs op on the constructed path.
 *   SECONDARY (belt-and-suspenders): assertPathContained() confirms the resolved path
 *   is inside content/. This catches escapes outside content/ that slip past the regexes.
 *
 * PHOTO SLUG FORMAT:
 *   Photo sidecars are identified by "<roll>/<id>", e.g. "2026-04-chiang-mai/DSCF0001".
 *   The single "/" separates roll from id. The slug field in the input carries this
 *   composite key. Both halves are validated against the same regex patterns used
 *   in highlight-core.ts (reused for consistency).
 *
 * DRAFT TOGGLE CONVENTION:
 *   draft=true  → setFrontmatterField('draft', true)  → "draft: true" in frontmatter.
 *   draft=false → removeFrontmatterField('draft')      → key absent; velite .default(false)
 *                 interprets absence as false (matches schema default = less noise in diffs).
 *
 * Owner: Altair (α-BND-02) · T1 lifecycle
 * Consumed by: lib/server/entries/entry-actions.ts
 *
 * // server-action: altair
 */

import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import {
  assertDev,
  DevGuardError,
  type ActionError,
} from '../places/highlight-core'
import { setFrontmatterField, removeFrontmatterField } from '@/lib/content/frontmatter-edit'
import { getAllArticles, getAllFiction, getAllPhotoSidecars } from '@/lib/store/admin-reads'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONTENT_ROOT = path.resolve(process.cwd(), 'content')

// ---------------------------------------------------------------------------
// Error helper (mirrors highlight-core.ts)
// ---------------------------------------------------------------------------

function err(code: string, message: string, details?: unknown): ActionError {
  return { ok: false, error: { code, message, details } }
}

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

/**
 * setEntryDraft input.
 *
 * slug semantics per kind:
 *   article → zero-padded 3-digit fileNum, e.g. "003"
 *   fiction → kebab-case slug, e.g. "transmission-001"
 *   photo   → "<roll>/<id>", e.g. "2026-04-chiang-mai/DSCF0001"
 */
export const SetEntryDraftInputSchema = z.object({
  kind: z.enum(['article', 'photo', 'fiction']),
  slug: z
    .string()
    .min(1)
    .max(200)
    .refine((s) => !s.startsWith('/'), { message: 'slug must not start with /' }),
  draft: z.boolean(),
})

export type SetEntryDraftInput = z.infer<typeof SetEntryDraftInputSchema>

/**
 * deleteEntry input — same slug semantics as setEntryDraft.
 */
export const DeleteEntryInputSchema = z.object({
  kind: z.enum(['article', 'photo', 'fiction']),
  slug: z
    .string()
    .min(1)
    .max(200)
    .refine((s) => !s.startsWith('/'), { message: 'slug must not start with /' }),
})

export type DeleteEntryInput = z.infer<typeof DeleteEntryInputSchema>

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export type SetEntryDraftResult =
  | { ok: true; entry: { kind: 'article' | 'photo' | 'fiction'; slug: string; draft: boolean } }
  | ActionError

export type DeleteEntryResult =
  | { ok: true; deleted: { kind: 'article' | 'photo' | 'fiction'; slug: string } }
  | ActionError

// ---------------------------------------------------------------------------
// Path containment helper (mirrors highlight-core.ts, content-only variant)
// ---------------------------------------------------------------------------

/**
 * Asserts that `target` is within CONTENT_ROOT.
 * Both sides are resolved via realpath when the path exists, so symlinks don't
 * produce false-positives.
 * Throws a clear error on traversal.
 */
function assertPathContained(target: string): void {
  const resolvedTarget = fs.existsSync(target)
    ? fs.realpathSync(target)
    : path.resolve(target)
  const contentRoot = fs.existsSync(CONTENT_ROOT)
    ? fs.realpathSync(CONTENT_ROOT)
    : path.resolve(CONTENT_ROOT)

  const inContent =
    resolvedTarget.startsWith(contentRoot + path.sep) || resolvedTarget === contentRoot

  if (!inContent) {
    throw new Error(
      `PATH CONTAINMENT VIOLATION: "${resolvedTarget}" is not within "${contentRoot}".`,
    )
  }
}

// ---------------------------------------------------------------------------
// Per-kind path resolvers with primary traversal defense
// ---------------------------------------------------------------------------

/**
 * Validates and resolves the MDX path for an article entry.
 *
 * PRIMARY DEFENSE: strict /^\d{3}$/ regex on fileNum.
 * A slug like "../articles/000" fails this regex before any path is constructed.
 *
 * Globs content/articles/<fileNum>-*.mdx for the exact match (same approach as
 * highlight-core.ts resolveArticlePath, reused for consistency).
 */
function resolveArticleMdxPath(fileNum: string): string {
  if (!/^\d{3}$/.test(fileNum)) {
    throw new Error(
      `resolveArticleMdxPath: invalid fileNum "${fileNum}". Must be a zero-padded 3-digit string.`,
    )
  }
  const articlesDir = path.resolve(CONTENT_ROOT, 'articles')
  const entries = fs.readdirSync(articlesDir)
  const matches = entries.filter(
    (e) => e.startsWith(`${fileNum}-`) && e.endsWith('.mdx'),
  )
  if (matches.length === 0) {
    throw new Error(
      `resolveArticleMdxPath: no MDX file found for fileNum "${fileNum}" in ${articlesDir}`,
    )
  }
  if (matches.length > 1) {
    throw new Error(
      `resolveArticleMdxPath: multiple MDX files match fileNum "${fileNum}": ${matches.join(', ')}`,
    )
  }
  const resolved = path.resolve(articlesDir, matches[0])
  assertPathContained(resolved)
  return resolved
}

/**
 * Validates and resolves the MDX path for a fiction entry.
 *
 * PRIMARY DEFENSE: strict kebab-case regex. A slug like "../articles/000"
 * contains `.` and `/` which fail the pattern.
 *
 * Pattern: content/fiction/<slug>.mdx
 */
function resolveFictionMdxPath(slug: string): string {
  if (!/^[a-z0-9-]+$/.test(slug)) {
    throw new Error(
      `resolveFictionMdxPath: invalid fiction slug "${slug}". Must be lowercase alphanumeric with hyphens.`,
    )
  }
  const resolved = path.resolve(CONTENT_ROOT, 'fiction', `${slug}.mdx`)
  assertPathContained(resolved)
  return resolved
}

/**
 * Validates and resolves the MDX path for a photo sidecar entry.
 *
 * slug format: "<roll>/<id>", e.g. "2026-04-chiang-mai/DSCF0001"
 *
 * PRIMARY DEFENSE: strict regex on each part before construction.
 * - roll: /^\d{4}-\d{2}-[a-z0-9-]+$/  (same as highlight-core.ts)
 * - id:   /^[A-Za-z0-9_-]{1,40}$/      (same as highlight-core.ts)
 *
 * Pattern: content/photos/<roll>/<id>.mdx
 */
function resolveSidecarMdxPath(slug: string): { roll: string; id: string; filePath: string } {
  // Reject slugs containing ".." before splitting
  if (slug.includes('..')) {
    throw new Error(
      `resolveSidecarMdxPath: slug "${slug}" contains ".." — path traversal rejected.`,
    )
  }

  const parts = slug.split('/')
  if (parts.length !== 2) {
    throw new Error(
      `resolveSidecarMdxPath: photo slug must be "<roll>/<id>", got "${slug}".`,
    )
  }
  const [roll, id] = parts

  if (!/^\d{4}-\d{2}-[a-z0-9-]+$/.test(roll)) {
    throw new Error(
      `resolveSidecarMdxPath: invalid roll "${roll}". Must match YYYY-MM-<place-slug>.`,
    )
  }
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) {
    throw new Error(
      `resolveSidecarMdxPath: invalid id "${id}". Must be alphanumeric/underscore/hyphen, 1–40 chars.`,
    )
  }

  const filePath = path.resolve(CONTENT_ROOT, 'photos', roll, `${id}.mdx`)
  assertPathContained(filePath)
  return { roll, id, filePath }
}

// ---------------------------------------------------------------------------
// Atomic write helper (mirrors highlight-core.ts)
// ---------------------------------------------------------------------------

function atomicWrite(filePath: string, content: string): void {
  const dir = path.dirname(filePath)
  const tmp = path.join(dir, `.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  try {
    fs.writeFileSync(tmp, content, 'utf8')
    fs.renameSync(tmp, filePath)
  } catch (e) {
    try { fs.unlinkSync(tmp) } catch { /* ignore */ }
    throw e
  }
}

// ---------------------------------------------------------------------------
// Action: setEntryDraft
// ---------------------------------------------------------------------------

/**
 * Implementation of the setEntryDraft server action.
 *
 * PIPELINE:
 *   1. assertDev()
 *   2. zod-validate input
 *   3. Per-kind strict identifier validation (primary traversal defense)
 *   4. Velite cache lookup (existence check — no-match → NOT_FOUND, no fs op)
 *   5. Resolve path + assertPathContained (belt-and-suspenders)
 *   6. Read MDX, apply setFrontmatterField / removeFrontmatterField
 *   7. Atomic write
 *   8. Return authoritative { ok, entry: { kind, slug, draft } }
 *
 * draft=true  → writes "draft: true" to frontmatter.
 * draft=false → removes "draft" key (returns file to velite .default(false) state).
 *               This avoids inserting "draft: false" noise into every toggled file.
 */
export async function setEntryDraftImpl(rawInput: unknown): Promise<SetEntryDraftResult> {
  // 1. Dev guard
  try {
    assertDev()
  } catch (e) {
    if (e instanceof DevGuardError) {
      return err('DEV_GUARD', e.message)
    }
    throw e
  }

  // 2. Validate input
  const parsed = SetEntryDraftInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    return err('INVALID_INPUT', 'Input validation failed', parsed.error.flatten())
  }
  const { kind, slug, draft } = parsed.data

  // 3+4+5. Per-kind: validate identifiers, confirm record exists, resolve path
  let filePath: string

  if (kind === 'article') {
    // Velite existence check (also validates slug is a real article)
    let record: Awaited<ReturnType<typeof getAllArticles>>[number] | undefined
    try {
      const all = await getAllArticles()
      record = all.find((a) => a.fileNum === slug)
    } catch (e) {
      return err('CONTENT_LOAD_FAILED', `Failed to load article cache: ${String(e)}`)
    }
    if (!record) {
      return err('NOT_FOUND', `No article with fileNum "${slug}" found in velite cache.`)
    }
    // Resolve path (applies regex + glob + containment)
    try {
      filePath = resolveArticleMdxPath(slug)
    } catch (e) {
      return err('FILE_RESOLVE_FAILED', `Could not resolve article path: ${String(e)}`)
    }

  } else if (kind === 'fiction') {
    // Velite existence check
    let record: Awaited<ReturnType<typeof getAllFiction>>[number] | undefined
    try {
      const all = await getAllFiction()
      record = all.find((f) => f.slug === slug)
    } catch (e) {
      return err('CONTENT_LOAD_FAILED', `Failed to load fiction cache: ${String(e)}`)
    }
    if (!record) {
      return err('NOT_FOUND', `No fiction entry with slug "${slug}" found in velite cache.`)
    }
    try {
      filePath = resolveFictionMdxPath(slug)
    } catch (e) {
      return err('FILE_RESOLVE_FAILED', `Could not resolve fiction path: ${String(e)}`)
    }

  } else {
    // kind === 'photo'
    let resolved: { roll: string; id: string; filePath: string }
    try {
      resolved = resolveSidecarMdxPath(slug)
    } catch (e) {
      return err('INVALID_INPUT', `Photo slug validation failed: ${String(e)}`)
    }
    // Velite existence check
    let record: Awaited<ReturnType<typeof getAllPhotoSidecars>>[number] | undefined
    try {
      const all = await getAllPhotoSidecars()
      record = all.find((s) => s.roll === resolved.roll && s.id === resolved.id)
    } catch (e) {
      return err('CONTENT_LOAD_FAILED', `Failed to load photo sidecar cache: ${String(e)}`)
    }
    if (!record) {
      return err('NOT_FOUND', `No photo sidecar "${slug}" found in velite cache.`)
    }
    filePath = resolved.filePath
  }

  // 6. Read
  let raw: string
  try {
    raw = fs.readFileSync(filePath, 'utf8')
  } catch (e) {
    return err('FILE_READ_FAILED', `Failed to read ${filePath}: ${String(e)}`)
  }

  // Apply draft transform:
  //   true  → set "draft: true"
  //   false → remove the key (velite .default(false) treats absence as false)
  let updated: string
  try {
    updated = draft
      ? setFrontmatterField(raw, 'draft', true)
      : removeFrontmatterField(raw, 'draft')
  } catch (e) {
    return err('FRONTMATTER_EDIT_FAILED', `Frontmatter transform failed: ${String(e)}`)
  }

  // 7. Atomic write
  try {
    atomicWrite(filePath, updated)
  } catch (e) {
    return err('WRITE_FAILED', `Failed to write ${filePath}: ${String(e)}`)
  }

  // 8. Return authoritative new state
  return { ok: true, entry: { kind, slug, draft } }
}

// ---------------------------------------------------------------------------
// Action: deleteEntry
// ---------------------------------------------------------------------------

/**
 * Implementation of the deleteEntry server action — FILE-WRITE PATH ONLY.
 *
 * @deprecated  This implementation is SUPERSEDED for photo entries.
 *
 * The console (EntryEditor.tsx) uses `deleteEntry` from
 * `lib/server/store/actions.ts` → `deleteEntryImpl` in `actions-core.ts`,
 * which is the storage-first Supabase path (removes CDN variants + original
 * from storage buckets, then deletes DB rows). That is the live path.
 *
 * This implementation handles ONLY the legacy file-write layer:
 * it removes the content source .mdx file for article/fiction entries
 * and is still called via `entry-actions.ts` if any pre-store authoring
 * tooling invokes it. For photo kind it deletes the sidecar MDX only —
 * it intentionally does NOT touch storage (storage belongs to the store layer).
 *
 * DO NOT add Supabase storage calls here. If you need to fix the storage
 * cleanup path, fix `lib/server/store/actions-core.ts:deleteEntryImpl`.
 *
 * Removes ONLY the content source .mdx file for the given entry.
 * Does NOT touch:
 *   - Supabase storage variants (photos bucket) — store layer's responsibility
 *   - source JPEG files
 *   - any generated artifact
 *
 * The .mdx file is recoverable via git. Generated variants/JPEGs
 * are not in git and intentionally persist.
 *
 * PIPELINE:
 *   1. assertDev()
 *   2. zod-validate input
 *   3. Per-kind strict identifier validation (primary traversal defense)
 *   4. Velite cache lookup (existence check — no-match → NOT_FOUND, no fs op)
 *   5. Resolve path + assertPathContained (belt-and-suspenders)
 *   6. Confirm file exists on disk (guard against stale cache post-delete)
 *   7. fs.unlinkSync (single atomic-on-POSIX unlink)
 *   8. Return { ok, deleted: { kind, slug } }
 */
export async function deleteEntryImpl(rawInput: unknown): Promise<DeleteEntryResult> {
  // 1. Dev guard
  try {
    assertDev()
  } catch (e) {
    if (e instanceof DevGuardError) {
      return err('DEV_GUARD', e.message)
    }
    throw e
  }

  // 2. Validate input
  const parsed = DeleteEntryInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    return err('INVALID_INPUT', 'Input validation failed', parsed.error.flatten())
  }
  const { kind, slug } = parsed.data

  // 3+4+5. Per-kind: validate identifiers, confirm record exists, resolve path
  let filePath: string

  if (kind === 'article') {
    let record: Awaited<ReturnType<typeof getAllArticles>>[number] | undefined
    try {
      const all = await getAllArticles()
      record = all.find((a) => a.fileNum === slug)
    } catch (e) {
      return err('CONTENT_LOAD_FAILED', `Failed to load article cache: ${String(e)}`)
    }
    if (!record) {
      return err('NOT_FOUND', `No article with fileNum "${slug}" found in velite cache.`)
    }
    try {
      filePath = resolveArticleMdxPath(slug)
    } catch (e) {
      return err('FILE_RESOLVE_FAILED', `Could not resolve article path: ${String(e)}`)
    }

  } else if (kind === 'fiction') {
    let record: Awaited<ReturnType<typeof getAllFiction>>[number] | undefined
    try {
      const all = await getAllFiction()
      record = all.find((f) => f.slug === slug)
    } catch (e) {
      return err('CONTENT_LOAD_FAILED', `Failed to load fiction cache: ${String(e)}`)
    }
    if (!record) {
      return err('NOT_FOUND', `No fiction entry with slug "${slug}" found in velite cache.`)
    }
    try {
      filePath = resolveFictionMdxPath(slug)
    } catch (e) {
      return err('FILE_RESOLVE_FAILED', `Could not resolve fiction path: ${String(e)}`)
    }

  } else {
    // kind === 'photo'
    let resolved: { roll: string; id: string; filePath: string }
    try {
      resolved = resolveSidecarMdxPath(slug)
    } catch (e) {
      return err('INVALID_INPUT', `Photo slug validation failed: ${String(e)}`)
    }
    let record: Awaited<ReturnType<typeof getAllPhotoSidecars>>[number] | undefined
    try {
      const all = await getAllPhotoSidecars()
      record = all.find((s) => s.roll === resolved.roll && s.id === resolved.id)
    } catch (e) {
      return err('CONTENT_LOAD_FAILED', `Failed to load photo sidecar cache: ${String(e)}`)
    }
    if (!record) {
      return err('NOT_FOUND', `No photo sidecar "${slug}" found in velite cache.`)
    }
    filePath = resolved.filePath
  }

  // 6. Confirm the file actually exists on disk (handles stale cache race)
  if (!fs.existsSync(filePath)) {
    return err(
      'FILE_NOT_FOUND',
      `MDX file "${filePath}" does not exist on disk. ` +
        'The velite cache may be stale (entry already deleted). ' +
        'Restart the dev server to refresh the cache.',
    )
  }

  // 7. Remove ONLY the .mdx source file — no glob, no generated artifacts
  try {
    fs.unlinkSync(filePath)
  } catch (e) {
    return err('DELETE_FAILED', `Failed to delete ${filePath}: ${String(e)}`)
  }

  // 8. Return authoritative result
  return { ok: true, deleted: { kind, slug } }
}
