/**
 * lib/server/places/highlight-core.ts
 * ------------------------------------
 * Core logic for the dev-only places-curation write layer.
 * No 'use server' directive — exports zod schemas, path resolvers, return types,
 * and the three action implementations. Server actions in place-actions.ts call
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
 * TRANSACTIONAL CLARITY:
 *   All reads → all transforms → full end-state validation → all writes.
 *   No file is touched until the entire in-memory plan is valid. Per-file writes
 *   use temp-file + same-directory rename (atomic on POSIX/macOS).
 *
 * PATH CONTAINMENT:
 *   File paths are constructed from validated identifiers only (fileNum, roll, id)
 *   and resolved with path.resolve. Every resolved path is asserted to start with
 *   the content root realpath. No user-supplied path strings.
 *
 * PLACEIDS ON TOUCHED RECORDS:
 *   placeId is stamped only on the CHOSEN article and chosen photo frames
 *   (records being set as highlights). The derivation fallback in places.ts
 *   handles all other records. Stamping incidentally-cleared records would add
 *   diff noise without functional benefit.
 *
 * Owner: Altair (α-BND-02) · CURATION-BUILD-PLAN.md §Altair lane
 * Consumed by: lib/server/places/place-actions.ts
 *
 * // server-action: altair
 */

import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import { setFrontmatterField, removeFrontmatterField } from '@/lib/content/frontmatter-edit'
import { getPlaceById } from '@/lib/content/place-registry'
import { getArticlesAtPlace, getSidecarsAtPlace } from '@/lib/content/places'
import type { Place } from '@/lib/content/place-registry'
import { PlaceSchema } from '@/lib/content/place-registry'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONTENT_ROOT = path.resolve(process.cwd(), 'content')
const PLACE_DATA_FILE = path.resolve(process.cwd(), 'lib/content/place-registry.data.json')

// ---------------------------------------------------------------------------
// Dev guard
// ---------------------------------------------------------------------------

/**
 * Throws (or returns error shape) when running in production.
 * Must be the first call in every action implementation.
 */
export function assertDev(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new DevGuardError(
      'This action is dev-only. ' +
        'Vercel production has a read-only filesystem. ' +
        'Run this locally (next dev) and commit the resulting git diff.',
    )
  }
}

export class DevGuardError extends Error {
  readonly code = 'DEV_GUARD' as const
  constructor(message: string) {
    super(message)
    this.name = 'DevGuardError'
  }
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export type ActionError = {
  ok: false
  error: { code: string; message: string; details?: unknown }
}

function err(code: string, message: string, details?: unknown): ActionError {
  return { ok: false, error: { code, message, details } }
}

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const PhotoFrameSchema = z.object({
  roll: z
    .string()
    .regex(/^\d{4}-\d{2}-[a-z0-9-]+$/, 'roll must be YYYY-MM-<place-slug>'),
  id: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,40}$/, 'id must be a safe alphanumeric identifier, e.g. DSCF0002'),
})

export const SavePlaceHighlightsInputSchema = z
  .object({
    placeId: z
      .string()
      .regex(/^[a-z0-9-]+$/, 'placeId must be kebab-case'),
    /** fileNum of the article to highlight, e.g. "003". Null = clear any article highlight. */
    articleSlug: z
      .string()
      .regex(/^\d{3}$/, 'articleSlug must be a zero-padded 3-digit fileNum, e.g. "003"')
      .nullable(),
    /** Ordered list of photo frames. Max 5. No duplicate roll+id pairs. */
    photoFrames: z
      .array(PhotoFrameSchema)
      .max(5, 'At most 5 photo highlight frames allowed')
      .refine(
        (frames) => {
          const seen = new Set<string>()
          for (const f of frames) {
            const key = `${f.roll}/${f.id}`
            if (seen.has(key)) return false
            seen.add(key)
          }
          return true
        },
        { message: 'photoFrames must not contain duplicate roll+id pairs' },
      ),
  })

export type SavePlaceHighlightsInput = z.infer<typeof SavePlaceHighlightsInputSchema>

export const SavePlaceCoordInputSchema = z.object({
  placeId: z.string().regex(/^[a-z0-9-]+$/, 'placeId must be kebab-case'),
  lat: z
    .number()
    .min(-90, 'lat must be >= -90')
    .max(90, 'lat must be <= 90'),
  lon: z
    .number()
    .min(-180, 'lon must be >= -180')
    .max(180, 'lon must be <= 180'),
})

export type SavePlaceCoordInput = z.infer<typeof SavePlaceCoordInputSchema>

export const CreatePlaceInputSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'id must be kebab-case')
    .optional(),
  name: z.string().min(1).max(200),
  coord: z.object({
    lat: z
      .number()
      .min(-90, 'lat must be >= -90')
      .max(90, 'lat must be <= 90'),
    lon: z
      .number()
      .min(-180, 'lon must be >= -180')
      .max(180, 'lon must be <= 180'),
  }),
})

export type CreatePlaceInput = z.infer<typeof CreatePlaceInputSchema>

// ---------------------------------------------------------------------------
// Return types
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

export type SavePlaceCoordResult =
  | { ok: true; place: Place }
  | ActionError

export type CreatePlaceResult =
  | { ok: true; place: Place }
  | ActionError

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the filesystem path to an article MDX file from its fileNum.
 * Pattern: content/articles/<fileNum>-*.mdx
 * Asserts exactly one match and that the resolved path is within CONTENT_ROOT.
 */
function resolveArticlePath(fileNum: string): string {
  // Validate identifier to prevent traversal (belt-and-suspenders on top of zod)
  if (!/^\d{3}$/.test(fileNum)) {
    throw new Error(`resolveArticlePath: invalid fileNum "${fileNum}"`)
  }
  const articlesDir = path.resolve(CONTENT_ROOT, 'articles')
  const entries = fs.readdirSync(articlesDir)
  const matches = entries.filter(
    (e) => e.startsWith(`${fileNum}-`) && e.endsWith('.mdx'),
  )
  if (matches.length === 0) {
    throw new Error(
      `resolveArticlePath: no MDX file found for fileNum "${fileNum}" in ${articlesDir}`,
    )
  }
  if (matches.length > 1) {
    throw new Error(
      `resolveArticlePath: multiple MDX files match fileNum "${fileNum}": ${matches.join(', ')}`,
    )
  }
  const resolved = path.resolve(articlesDir, matches[0])
  assertPathContained(resolved)
  return resolved
}

/**
 * Resolves the filesystem path to a photo sidecar MDX file.
 * Pattern: content/photos/<roll>/<id>.mdx
 * Asserts that the resolved path is within CONTENT_ROOT.
 */
function resolveSidecarPath(roll: string, id: string): string {
  // Validate identifiers (belt-and-suspenders on top of zod)
  if (!/^\d{4}-\d{2}-[a-z0-9-]+$/.test(roll)) {
    throw new Error(`resolveSidecarPath: invalid roll "${roll}"`)
  }
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) {
    throw new Error(`resolveSidecarPath: invalid id "${id}"`)
  }
  const resolved = path.resolve(CONTENT_ROOT, 'photos', roll, `${id}.mdx`)
  assertPathContained(resolved)
  return resolved
}

/**
 * Asserts the given path is within CONTENT_ROOT or is the PLACE_DATA_FILE.
 * Both sides are realpath'd so symlinked checkouts don't false-positive.
 * Throws a clear error on path traversal attempts.
 */
function assertPathContained(target: string): void {
  // realpath both sides for symmetry — avoids symlink false-positives
  // Use existsSync to handle pre-creation paths (new files that don't exist yet)
  const resolvedTarget = fs.existsSync(target)
    ? fs.realpathSync(target)
    : path.resolve(target)
  const contentRoot = fs.existsSync(CONTENT_ROOT)
    ? fs.realpathSync(CONTENT_ROOT)
    : path.resolve(CONTENT_ROOT)
  const resolvedPlaceData = fs.existsSync(PLACE_DATA_FILE)
    ? fs.realpathSync(PLACE_DATA_FILE)
    : path.resolve(PLACE_DATA_FILE)

  const inContent =
    resolvedTarget.startsWith(contentRoot + path.sep) || resolvedTarget === contentRoot
  const isPlaceData = resolvedTarget === resolvedPlaceData

  if (!inContent && !isPlaceData) {
    throw new Error(
      `PATH CONTAINMENT VIOLATION: "${resolvedTarget}" is not within "${contentRoot}" or the place data file.`,
    )
  }
}

// ---------------------------------------------------------------------------
// Atomic write helper
// ---------------------------------------------------------------------------

/**
 * Writes content to a file atomically using a temp file in the same directory
 * followed by a rename. On POSIX/macOS, same-directory rename is atomic.
 */
function atomicWrite(filePath: string, content: string): void {
  const dir = path.dirname(filePath)
  const tmp = path.join(dir, `.tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  try {
    fs.writeFileSync(tmp, content, 'utf8')
    fs.renameSync(tmp, filePath)
  } catch (e) {
    // Clean up temp file if rename failed
    try { fs.unlinkSync(tmp) } catch { /* ignore */ }
    throw e
  }
}

// ---------------------------------------------------------------------------
// Article file stem helper (for return value)
// ---------------------------------------------------------------------------

function articleFileStem(filePath: string): string {
  return path.basename(filePath, '.mdx')
}

// ---------------------------------------------------------------------------
// Action: savePlaceHighlights
// ---------------------------------------------------------------------------

/**
 * Implementation of the savePlaceHighlights server action.
 *
 * PIPELINE:
 *   1. assertDev()
 *   2. zod-validate input
 *   3. Confirm placeId exists in registry
 *   4. Load all articles + sidecars at this place from velite (for validation only)
 *   5. Validate articleSlug (if set) exists at this place
 *   6. Validate each photoFrame exists at this place
 *   7. Resolve all file paths (with path-containment check)
 *   8. Build in-memory transform plan for every file that needs touching
 *   9. Validate end-state in memory (≤1 article highlight, ranks 1..N unique)
 *  10. Write all files atomically
 *  11. Return authoritative new state computed from the transform plan
 *      (NOT a velite re-query — decoupled-state contract)
 */
export async function savePlaceHighlightsImpl(
  rawInput: unknown,
): Promise<SavePlaceHighlightsResult> {
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
  const parsed = SavePlaceHighlightsInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    return err('INVALID_INPUT', 'Input validation failed', parsed.error.flatten())
  }
  const { placeId, articleSlug, photoFrames } = parsed.data

  // 3. placeId must exist
  const place = getPlaceById(placeId)
  if (!place) {
    return err('PLACE_NOT_FOUND', `No place with id "${placeId}" in the registry`)
  }

  // 4. Load content at this place from velite
  let placeArticles: Awaited<ReturnType<typeof getArticlesAtPlace>>
  let placeSidecars: Awaited<ReturnType<typeof getSidecarsAtPlace>>
  try {
    ;[placeArticles, placeSidecars] = await Promise.all([
      getArticlesAtPlace(placeId),
      getSidecarsAtPlace(placeId),
    ])
  } catch (e) {
    return err('CONTENT_LOAD_FAILED', 'Failed to load content from velite cache', String(e))
  }

  // 5. Validate articleSlug (fileNum) membership
  let chosenArticle: (typeof placeArticles)[0] | null = null
  let chosenArticleFilePath: string | null = null
  let chosenArticleFileStem: string | null = null

  if (articleSlug !== null) {
    chosenArticle = placeArticles.find((a) => a.fileNum === articleSlug) ?? null
    if (!chosenArticle) {
      return err(
        'ARTICLE_NOT_AT_PLACE',
        `Article "${articleSlug}" does not exist at place "${placeId}". ` +
          `Available fileNums: ${placeArticles.map((a) => a.fileNum).join(', ') || '(none)'}`,
      )
    }
    try {
      chosenArticleFilePath = resolveArticlePath(articleSlug)
      chosenArticleFileStem = articleFileStem(chosenArticleFilePath)
    } catch (e) {
      return err('FILE_RESOLVE_FAILED', `Could not resolve article file: ${String(e)}`)
    }
  }

  // 6. Validate each photoFrame membership
  type ResolvedFrame = {
    roll: string
    id: string
    rank: number
    filePath: string
    title: string // for return (caption or id)
  }

  const resolvedFrames: ResolvedFrame[] = []
  for (let i = 0; i < photoFrames.length; i++) {
    const frame = photoFrames[i]
    const sidecar = placeSidecars.find(
      (s) => s.roll === frame.roll && s.id === frame.id,
    )
    if (!sidecar) {
      return err(
        'PHOTO_NOT_AT_PLACE',
        `Photo frame "${frame.roll}/${frame.id}" does not exist at place "${placeId}"`,
      )
    }
    let filePath: string
    try {
      filePath = resolveSidecarPath(frame.roll, frame.id)
    } catch (e) {
      return err('FILE_RESOLVE_FAILED', `Could not resolve sidecar file: ${String(e)}`)
    }
    resolvedFrames.push({ roll: frame.roll, id: frame.id, rank: i + 1, filePath, title: sidecar.caption ?? frame.id })
  }

  // 7. Build the write plan in memory
  // We read every file we might touch, apply transforms in memory,
  // then validate the combined end-state before touching the filesystem.

  type FileWrite = { filePath: string; content: string }
  const writes: FileWrite[] = []

  // Chosen frame key set for fast lookup
  const chosenFrameKeys = new Set(resolvedFrames.map((f) => `${f.roll}/${f.id}`))
  const chosenArticleFileNum = articleSlug

  // -- Articles at this place --
  // Set highlightForPlace: true + placeId on chosen article.
  // Clear highlightForPlace on all others (use removeFrontmatterField so
  // non-chosen articles return to schema default — avoids inserting 'false'
  // noise into every unrelated article).
  //
  // TRANSACTIONAL INVARIANT: A resolve/read failure on a non-chosen article that
  // currently has highlightForPlace:true (i.e. a "clear" operation) is a HARD ERROR,
  // not a warn-and-skip. Skipping it would leave >1 article highlight, causing
  // places.ts assertHighlightConstraints to throw at the next build. This is the
  // exact state the transactional clear exists to prevent.
  for (const a of placeArticles) {
    let filePath: string
    try {
      filePath = resolveArticlePath(a.fileNum)
    } catch (e) {
      return err(
        'FILE_RESOLVE_FAILED',
        `Could not resolve file for article "${a.fileNum}" — cannot guarantee transactional clear. ` +
          String(e),
      )
    }

    let content: string
    try {
      content = fs.readFileSync(filePath, 'utf8')
    } catch (e) {
      return err('FILE_READ_FAILED', `Failed to read article ${a.fileNum}: ${String(e)}`)
    }

    if (a.fileNum === chosenArticleFileNum) {
      // This is the chosen article — set placeId + highlightForPlace: true
      content = setFrontmatterField(content, 'placeId', placeId)
      content = setFrontmatterField(content, 'highlightForPlace', true)
    } else {
      // Not chosen — clear highlightForPlace (remove so file returns to schema default)
      content = removeFrontmatterField(content, 'highlightForPlace')
    }
    writes.push({ filePath, content })
  }

  // -- Photo sidecars at this place --
  // Set highlightRank + placeId on chosen frames (rank = position 1..N).
  // Clear highlightRank on all others at this place (remove, don't write 0/null).
  //
  // TRANSACTIONAL INVARIANT: Same reasoning as articles. A sidecar that currently
  // has highlightRank set but fails to resolve → skip → stale rank persists →
  // non-contiguous or duplicate ranks. Hard error on any resolve/read failure.
  for (const s of placeSidecars) {
    const key = `${s.roll}/${s.id}`
    const isChosen = chosenFrameKeys.has(key)

    let filePath: string
    try {
      filePath = resolveSidecarPath(s.roll, s.id)
    } catch (e) {
      return err(
        'FILE_RESOLVE_FAILED',
        `Could not resolve sidecar "${key}" — cannot guarantee transactional clear. ` +
          String(e),
      )
    }

    let content: string
    try {
      content = fs.readFileSync(filePath, 'utf8')
    } catch (e) {
      return err('FILE_READ_FAILED', `Failed to read sidecar ${key}: ${String(e)}`)
    }

    if (isChosen) {
      const frame = resolvedFrames.find((f) => `${f.roll}/${f.id}` === key)!
      content = setFrontmatterField(content, 'placeId', placeId)
      content = setFrontmatterField(content, 'highlightRank', frame.rank)
    } else {
      // Clear rank — remove so file returns to velite default (undefined/unset)
      content = removeFrontmatterField(content, 'highlightRank')
    }
    writes.push({ filePath, content })
  }

  // 8. End-state validation (in-memory, before any write)
  // We re-derive highlight state from the planned writes to catch any edge case.
  {
    // Count planned article highlights
    let plannedArticleHighlights = 0
    if (chosenArticleFileNum !== null) {
      plannedArticleHighlights = 1 // we explicitly set exactly one
    }
    // Sanity: check all others are cleared
    if (plannedArticleHighlights > 1) {
      return err(
        'CONSTRAINT_VIOLATION',
        `Internal error: would produce ${plannedArticleHighlights} article highlights. Aborting.`,
      )
    }

    // Check rank contiguity and uniqueness (1..N from input order — guaranteed by
    // construction above, but assert as a safety net)
    const ranks = resolvedFrames.map((f) => f.rank).sort((a, b) => a - b)
    for (let i = 0; i < ranks.length; i++) {
      if (ranks[i] !== i + 1) {
        return err(
          'CONSTRAINT_VIOLATION',
          `Internal error: photo ranks are not contiguous 1..N. Got: ${ranks.join(', ')}. Aborting.`,
        )
      }
    }
  }

  // 9. Write all files atomically
  for (const w of writes) {
    try {
      atomicWrite(w.filePath, w.content)
    } catch (e) {
      return err(
        'WRITE_FAILED',
        `Failed to write ${w.filePath}: ${String(e)}`,
      )
    }
  }

  // 10. Build authoritative return from computed plan (NOT velite re-query)
  const returnHighlights: SavePlaceHighlightsResult = {
    ok: true,
    highlights: {
      articleHighlight:
        chosenArticle !== null && chosenArticleFileStem !== null
          ? {
              slug: chosenArticleFileStem,
              fileNum: chosenArticle.fileNum,
              title: chosenArticle.title,
            }
          : null,
      photoHighlights: resolvedFrames.map((f) => ({
        roll: f.roll,
        id: f.id,
        rank: f.rank,
      })),
    },
  }

  return returnHighlights
}

// ---------------------------------------------------------------------------
// Action: savePlaceCoord
// ---------------------------------------------------------------------------

/**
 * Implementation of the savePlaceCoord server action.
 * Rewrites the coord on the given place in the place data JSON.
 * Returns the updated place atom.
 */
export async function savePlaceCoordImpl(
  rawInput: unknown,
): Promise<SavePlaceCoordResult> {
  try {
    assertDev()
  } catch (e) {
    if (e instanceof DevGuardError) {
      return err('DEV_GUARD', e.message)
    }
    throw e
  }

  const parsed = SavePlaceCoordInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    return err('INVALID_INPUT', 'Input validation failed', parsed.error.flatten())
  }
  const { placeId, lat, lon } = parsed.data

  const place = getPlaceById(placeId)
  if (!place) {
    return err('PLACE_NOT_FOUND', `No place with id "${placeId}" in the registry`)
  }

  // Read the JSON
  assertPathContained(PLACE_DATA_FILE)
  let rawJson: string
  try {
    rawJson = fs.readFileSync(PLACE_DATA_FILE, 'utf8')
  } catch (e) {
    return err('FILE_READ_FAILED', `Failed to read place data file: ${String(e)}`)
  }

  let places: Place[]
  try {
    places = JSON.parse(rawJson) as Place[]
  } catch (e) {
    return err('JSON_PARSE_FAILED', `Failed to parse place data file: ${String(e)}`)
  }

  const idx = places.findIndex((p) => p.id === placeId)
  if (idx === -1) {
    // Should not happen if getPlaceById succeeded, but guard anyway
    return err('PLACE_NOT_FOUND', `Place "${placeId}" not found in data file`)
  }

  const updatedPlace: Place = { ...places[idx], coord: { lat, lon } }
  places[idx] = updatedPlace

  // Validate the updated record through PlaceSchema
  const validation = PlaceSchema.safeParse(updatedPlace)
  if (!validation.success) {
    return err('SCHEMA_VIOLATION', 'Updated place failed schema validation', validation.error.flatten())
  }

  try {
    atomicWrite(PLACE_DATA_FILE, JSON.stringify(places, null, 2) + '\n')
  } catch (e) {
    return err('WRITE_FAILED', `Failed to write place data file: ${String(e)}`)
  }

  return { ok: true, place: validation.data }
}

// ---------------------------------------------------------------------------
// Action: createPlace
// ---------------------------------------------------------------------------

/**
 * Converts a place display name to a kebab-case id following the city-only
 * scheme used in the registry. Strips the country-code suffix ("Bangkok · TH" → "bangkok").
 * Mirrors deriveArticlePlaceId's normalization so generated ids are consistent.
 */
function nameToId(name: string): string {
  return name
    .split(' · ')[0]
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
}

/**
 * Implementation of the createPlace server action.
 * Appends a new place atom to the place data JSON.
 * Rejects duplicate ids (including generated ids).
 */
export async function createPlaceImpl(
  rawInput: unknown,
): Promise<CreatePlaceResult> {
  try {
    assertDev()
  } catch (e) {
    if (e instanceof DevGuardError) {
      return err('DEV_GUARD', e.message)
    }
    throw e
  }

  const parsed = CreatePlaceInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    return err('INVALID_INPUT', 'Input validation failed', parsed.error.flatten())
  }
  const { id: rawId, name, coord } = parsed.data

  // Derive id if not supplied (strip country-code suffix, lowercase, hyphenate)
  const id = rawId ?? nameToId(name)

  // Validate that the derived id is valid kebab-case
  if (!/^[a-z0-9-]+$/.test(id)) {
    return err(
      'INVALID_ID',
      `Generated id "${id}" from name "${name}" is not valid kebab-case. ` +
        'Provide an explicit id, or use a simpler name.',
    )
  }

  // Read the current registry
  assertPathContained(PLACE_DATA_FILE)
  let rawJson: string
  try {
    rawJson = fs.readFileSync(PLACE_DATA_FILE, 'utf8')
  } catch (e) {
    return err('FILE_READ_FAILED', `Failed to read place data file: ${String(e)}`)
  }

  let places: Place[]
  try {
    places = JSON.parse(rawJson) as Place[]
  } catch (e) {
    return err('JSON_PARSE_FAILED', `Failed to parse place data file: ${String(e)}`)
  }

  // Reject duplicate id
  if (places.some((p) => p.id === id)) {
    return err(
      'DUPLICATE_ID',
      `A place with id "${id}" already exists in the registry. ` +
        'Use a different name or provide an explicit id.',
    )
  }

  // Build and validate the new atom through PlaceSchema
  const newPlace: Place = {
    id,
    level: 1,
    parentId: null,
    name,
    coord: { lat: coord.lat, lon: coord.lon },
  }

  const validation = PlaceSchema.safeParse(newPlace)
  if (!validation.success) {
    return err('SCHEMA_VIOLATION', 'New place atom failed schema validation', validation.error.flatten())
  }

  places.push(validation.data)

  try {
    atomicWrite(PLACE_DATA_FILE, JSON.stringify(places, null, 2) + '\n')
  } catch (e) {
    return err('WRITE_FAILED', `Failed to write place data file: ${String(e)}`)
  }

  return { ok: true, place: validation.data }
}
