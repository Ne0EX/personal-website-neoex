/**
 * lib/store/schema.ts
 * ---------------------------------------------------------------------------
 * Zod schemas for the write path — shared by server actions and migration.
 * Ports velite validation (velite.config.ts regexes/enums/limits).
 *
 * Per-kind completeness for PUBLISH (DL14):
 *   setEntryDraft(draft:false) calls entryPublishSchema for the relevant kind.
 *   A minimal draft (kind+slug+date only) is valid at insert time.
 *   Full completeness is required only at publish.
 *
 * Key decisions encoded here:
 *   - DB status = 'draft'|'published' (not the maturity ladder)
 *   - DB maturity = 'seed'|'ongoing'|'refined'|'settled' (article only)
 *   - Fiction variants: max 4, unique alpha (superRefine)
 *   - Photo slug shape: '<roll>/<photo_id>'
 *
 * Owner: Altair (α-BND-02) · store-as-source S5
 */

import { z } from 'zod'

// ---------------------------------------------------------------------------
// Shared field schemas
// ---------------------------------------------------------------------------

const SlugDateSchema = z
  .string()
  .regex(/^\d{4}\.\d{2}\.\d{2}$/, 'date must be YYYY.MM.DD')

const EntryKindSchema = z.enum(['article', 'fiction', 'photo'])
const EntryStatusSchema = z.enum(['draft', 'published'])
const MaturitySchema = z.enum(['seed', 'ongoing', 'refined', 'settled'])
const DomainSchema = z.enum(['identity', 'reflection', 'method', 'meta'])

const CoordsSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  place: z.string(),
})

const PatchSchema = z.object({
  n: z.number().int().positive(),
  date: z.string().regex(/^\d{4}\.\d{2}\.\d{2}$/),
  note: z.string(),
})

const WorldlineLinkSchema = z.object({
  to: z.string(),
  label: z.string().optional(),
})

const FictionVariantSchema = z.object({
  alpha: z.string(),
  delta_summary: z.string(),
  drift: z.string().optional(),
  slug: z.string().optional(),
})

// ---------------------------------------------------------------------------
// Article slug: zero-padded 3-digit fileNum
// ---------------------------------------------------------------------------

export const ArticleSlugSchema = z
  .string()
  .regex(/^\d{3}$/, 'article slug must be a zero-padded 3-digit fileNum e.g. "003"')

// ---------------------------------------------------------------------------
// Fiction slug: kebab-case
// ---------------------------------------------------------------------------

export const FictionSlugSchema = z
  .string()
  .regex(/^[a-z0-9-]+$/, 'fiction slug must be kebab-case')

// ---------------------------------------------------------------------------
// Photo slug: <roll>/<photo_id>
// ---------------------------------------------------------------------------

export const PhotoSlugSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-[a-z0-9-]+\/[A-Za-z0-9_-]{1,40}$/,
    'photo slug must be <YYYY-MM-place-slug>/<photo-id>',
  )

export const RollSlugSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-[a-z0-9-]+$/, 'roll must be YYYY-MM-<place-slug>')

export const PhotoIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,40}$/, 'photoId must be alphanumeric 1–40 chars')

// ---------------------------------------------------------------------------
// createEntry input
// ---------------------------------------------------------------------------

const EntryBaseFields = {
  date: SlugDateSchema.optional(), // defaults to today in action
  tags: z.array(z.string()).optional(),
  summary: z.string().optional(),
  body: z.string().optional(),
  coords: CoordsSchema.optional(),
  shareLocation: z.boolean().optional(),
  placeId: z.string().optional(),
  highlightForPlace: z.boolean().optional(),
  patches: z.array(PatchSchema).optional(),
  worldline_links: z.array(WorldlineLinkSchema).optional(),
}

export const CreateArticleInputSchema = z.object({
  kind: z.literal('article'),
  slug: ArticleSlugSchema.optional(), // auto-assigned if absent
  title: z.string().optional(),
  domain: DomainSchema.optional(),
  maturity: MaturitySchema.optional(),
  readingTime: z.number().int().positive().optional(),
  ...EntryBaseFields,
})

export const CreateFictionInputSchema = z.object({
  kind: z.literal('fiction'),
  slug: FictionSlugSchema,
  title: z.string().optional(),
  domain: DomainSchema.optional(),
  variants: z
    .array(FictionVariantSchema)
    .max(4)
    .superRefine((variants, ctx) => {
      const seen = new Set<string>()
      for (const v of variants) {
        if (seen.has(v.alpha)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Duplicate alpha value: ${v.alpha}`,
          })
        }
        seen.add(v.alpha)
      }
    })
    .optional(),
  divergenceCluster: z.string().optional(),
  ...EntryBaseFields,
})

export const CreatePhotoInputSchema = z.object({
  kind: z.literal('photo'),
  roll: RollSlugSchema,
  photoId: PhotoIdSchema,
  caption: z.string().optional(),
  overridePlace: z.string().optional(),
  highlightRank: z.number().int().min(1).max(5).optional(),
  ...EntryBaseFields,
})

export const CreateEntryInputSchema = z.discriminatedUnion('kind', [
  CreateArticleInputSchema,
  CreateFictionInputSchema,
  CreatePhotoInputSchema,
])

export type CreateEntryInput = z.infer<typeof CreateEntryInputSchema>

// ---------------------------------------------------------------------------
// updateEntry input
// ---------------------------------------------------------------------------

// instrument_overrides: authored display values for camera instrument fields.
// Merges over photo_assets.exif at read time (exif = raw sensor truth; never patched).
// lens is the required manual-lens use-case; all other keys are optional overrides.
// Pass null to clear the entire overrides object. Pass undefined to leave untouched.
const InstrumentOverridesSchema = z
  .object({
    lens:     z.string().optional(),
    camera:   z.string().optional(),
    iso:      z.number().optional(),
    aperture: z.number().optional(),
    focal:    z.number().optional(),
    shutter:  z.string().optional(),
  })
  .nullable()

const UpdateFieldsSchema = z.object({
  title: z.string().optional(),
  date: SlugDateSchema.optional(),
  domain: DomainSchema.optional(),
  tags: z.array(z.string()).optional(),
  summary: z.string().optional(),
  body: z.string().optional(),
  coords: CoordsSchema.nullable().optional(),
  shareLocation: z.boolean().optional(),
  placeId: z.string().nullable().optional(),
  highlightForPlace: z.boolean().optional(),
  patches: z.array(PatchSchema).optional(),
  worldline_links: z.array(WorldlineLinkSchema).optional(),
  maturity: MaturitySchema.optional(),
  readingTime: z.number().int().positive().optional(),
  originLocus: CoordsSchema.nullable().optional(),
  variants: z
    .array(FictionVariantSchema)
    .max(4)
    .superRefine((variants, ctx) => {
      const seen = new Set<string>()
      for (const v of variants) {
        if (seen.has(v.alpha)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Duplicate alpha: ${v.alpha}` })
        }
        seen.add(v.alpha)
      }
    })
    .optional(),
  divergenceCluster: z.string().nullable().optional(),
  caption: z.string().nullable().optional(),
  overridePlace: z.string().nullable().optional(),
  highlightRank: z.number().int().min(1).max(5).nullable().optional(),
  instrumentOverrides: InstrumentOverridesSchema.optional(),
})

export const UpdateEntryInputSchema = z.object({
  kind: EntryKindSchema,
  slug: z.string(),
  patch: UpdateFieldsSchema,
})

export type UpdateEntryInput = z.infer<typeof UpdateEntryInputSchema>

// ---------------------------------------------------------------------------
// setEntryDraft input + publish completeness check (DL14)
// ---------------------------------------------------------------------------

export const SetEntryDraftInputSchema = z.object({
  kind: EntryKindSchema,
  slug: z.string(),
  draft: z.boolean(),
})

export type SetEntryDraftInput = z.infer<typeof SetEntryDraftInputSchema>

/**
 * Validates completeness for PUBLISH (DL14).
 * Returns a list of missing field names, or empty array if complete.
 */
export function checkPublishCompleteness(
  kind: 'article' | 'fiction' | 'photo',
  row: Record<string, unknown>,
): string[] {
  const missing: string[] = []

  if (kind === 'article') {
    if (!row['title']) missing.push('title')
    if (!row['domain']) missing.push('domain')
    if (!row['maturity']) missing.push('maturity')
    if (row['reading_time'] == null) missing.push('readingTime')
    if (!row['summary']) missing.push('summary')
    if (!row['coords']) missing.push('coords')
  }

  if (kind === 'fiction') {
    if (!row['title']) missing.push('title')
    if (!row['domain']) missing.push('domain')
    if (!row['summary']) missing.push('summary')
  }

  // Photos have no publish-time completeness gate beyond what the DB CHECK enforces
  // (roll, photo_id, slug shape). No extra fields required.

  return missing
}

// ---------------------------------------------------------------------------
// deleteEntry input
// ---------------------------------------------------------------------------

export const DeleteEntryInputSchema = z.object({
  kind: EntryKindSchema,
  slug: z.string(),
})

export type DeleteEntryInput = z.infer<typeof DeleteEntryInputSchema>

// ---------------------------------------------------------------------------
// createRoll input
// ---------------------------------------------------------------------------

export const CreateRollInputSchema = z.object({
  roll: RollSlugSchema,
  date: SlugDateSchema,
  caption: z.string().optional(),
  shareLocation: z.boolean().optional(),
  coords: CoordsSchema.optional(),
  body: z.string().optional(),
})

export type CreateRollInput = z.infer<typeof CreateRollInputSchema>

// ---------------------------------------------------------------------------
// ingestPhoto input
// ---------------------------------------------------------------------------

export const IngestPhotoInputSchema = z.object({
  roll: RollSlugSchema,
  photoId: PhotoIdSchema,
  originalKey: z.string().min(1), // key in originals bucket
  overwrite: z.boolean().optional(), // allows re-ingest of existing variants
})

export type IngestPhotoInput = z.infer<typeof IngestPhotoInputSchema>

// ---------------------------------------------------------------------------
// Place actions inputs
// ---------------------------------------------------------------------------

export const CreatePlaceInputSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/).optional(),
  name: z.string().min(1).max(200),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  level: z.number().int().min(1).max(2).optional(),
  parentId: z.string().optional(),
})

export type CreatePlaceInput = z.infer<typeof CreatePlaceInputSchema>

export const SavePlaceCoordInputSchema = z.object({
  placeId: z.string().regex(/^[a-z0-9-]+$/),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
})

export type SavePlaceCoordInput = z.infer<typeof SavePlaceCoordInputSchema>

const PhotoFrameSchema = z.object({
  roll: RollSlugSchema,
  id: PhotoIdSchema,
})

export const SavePlaceHighlightsInputSchema = z.object({
  placeId: z.string().regex(/^[a-z0-9-]+$/),
  articleSlug: ArticleSlugSchema.nullable(),
  photoFrames: z
    .array(PhotoFrameSchema)
    .max(5)
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
