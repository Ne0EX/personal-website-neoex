import { defineConfig, defineCollection, s } from 'velite'
import { promises as fs } from 'node:fs'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Shared sub-schemas
// ---------------------------------------------------------------------------

/**
 * A single outgoing worldline link declared in frontmatter.
 *
 * Format of `to`:
 *   article/<fileNum>                        — e.g. "article/003"
 *   fiction/<slug>                           — e.g. "fiction/transmission-001"
 *   photos/<roll>/<id>                       — e.g. "photos/2026-04-chiang-mai/DSCF0001"
 *
 * Incoming links are computed at build time by lib/content/worldline.ts;
 * they are NEVER stored in frontmatter.
 *
 * Broken links (to a non-existent entry) emit console.warn at runtime but do NOT
 * fail the build. Dangling refs are preserved in the record.
 *
 * Consumer: lib/content/worldline.ts (reverse-lookup) + <WorldlineLinks /> (Sirius).
 * Vision lock: VISION-2026-05-31-search-lineage-console.md §2.1
 * Design spec: docs/design/16-worldline-schema.md §1
 */
const worldlineLinkSchema = s.object({
  /**
   * Canonical target entry reference. Format: "<kind>/<identifier>".
   * article → 3-digit fileNum · fiction → kebab slug · photos → <roll>/<id>
   */
  to: s
    .string()
    .regex(
      /^(article\/\d{3}|fiction\/[a-z0-9-]+|photos\/\d{4}-\d{2}-[a-z0-9-]+\/[A-Z0-9]+)$/,
      'worldline_links[].to must be article/<fileNum>, fiction/<slug>, or photos/<roll>/<id>',
    ),
  /**
   * Optional free-text prose label for this edge.
   * Rendered in Cormorant italic alongside the arc-node glyph (Sirius).
   * Max 120 chars.
   */
  label: s.string().min(1).max(120).optional(),
})

/** Real-world geographic coordinate. */
const coordsSchema = s.object({
  lat: s.number(),
  lon: s.number(),
  place: s.string(),
})

/** A single revision entry in the patches log. */
const patchSchema = s.object({
  /** Sequential patch number, 1-indexed. */
  n: s.number().int().min(1),
  /** ISO 8601 date of the revision (YYYY-MM-DD). */
  date: s.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'patches[].date must be YYYY-MM-DD'),
  /** Single-line description of what changed. */
  note: s.string().min(1).max(280),
})

// ---------------------------------------------------------------------------
// Entry status enum
// Per lib/entries.ts: seed | ongoing | refined | settled
// ---------------------------------------------------------------------------

const entryStatusSchema = s.enum(['seed', 'ongoing', 'refined', 'settled'])

// ---------------------------------------------------------------------------
// Domain enum
// Per lib/entries.ts / ontology §2.2: identity | reflection | method | meta
// ---------------------------------------------------------------------------

const domainSchema = s.enum(['identity', 'reflection', 'method', 'meta'])

// ---------------------------------------------------------------------------
// Articles collection
// ---------------------------------------------------------------------------
// Glyph: small circle (existing pin sphere) — journey-arch §2.2
// Globe layer: Ne0 surface + ALL stratum
// Route: /entries/<fileNum>
//
// Every field has a consumer:
//   fileNum      → Globe pin ID, route param, side panel
//   title        → side panel, entry page header, ChapterIndex
//   date         → ChapterIndex sort key, patches log, side panel
//   domain       → orbital longitude (ontology §2.2), AttractorFields grouping
//   tags         → AttractorFields filter, related-branches computation
//   status       → STAGE_RADIUS placement (lib/entries.ts)
//   coords       → Globe pin placement (Ne0 surface)
//   summary      → side panel excerpt, search index excerpt
//   readingTime  → ChapterIndex meta, side panel meta
//   patches      → patches log block on entry page
//   kind         → Globe pinObjects discriminator (TASK-33)
// ---------------------------------------------------------------------------

const articles = defineCollection({
  name: 'Article',
  pattern: 'articles/*.mdx',
  schema: s
    .object({
      // --- identity ---
      /** Zero-padded file number, e.g. "003". Used as route param and Globe pin ID. */
      fileNum: s.string().regex(/^\d{3}$/, 'fileNum must be a zero-padded 3-digit string, e.g. "003"'),

      /** Content type discriminator. Always "article" for this collection.
       *  Drives Globe glyph: circle (existing pin sphere) per journey-arch §2.2. */
      kind: s.literal('article'),

      // --- display ---
      title: s.string().min(1).max(200),
      /** Display date string in site format YYYY.MM.DD. */
      date: s.string().regex(/^\d{4}\.\d{2}\.\d{2}$/, 'date must be YYYY.MM.DD'),
      /** Thematic domain — controls orbital longitude on Globe (ontology §2.2). */
      domain: domainSchema,
      tags: s.array(s.string().min(1)).min(1),
      status: entryStatusSchema,
      /** Estimated reading time in minutes. */
      readingTime: s.number().int().positive(),
      /** One-paragraph excerpt shown in the Globe side panel and search results. */
      summary: s.string().min(1).max(600),

      // --- globe placement ---
      /** Real-world coordinate where this entry is anchored on the globe (Ne0 surface). */
      coords: coordsSchema,

      // --- revision history ---
      /** Ordered revision log. Optional — not every entry has patches yet. */
      patches: s.array(patchSchema).optional(),

      // --- privacy ---
      /** Whether to surface coords in served metadata. Defaults false per privacy policy. */
      shareLocation: s.boolean().default(false),

      // --- place-aware globe (place-aware-globe-spec.md §14) ---
      /**
       * Place this article belongs to. Slug-form place ID (e.g. "bangkok").
       * Optional — when absent, derived from coords.place at query time (see lib/content/places.ts).
       * Written by the Atlas Console (highlight editor) once curation begins.
       * NULL until console phase; the globe derives placement from coords until then.
       *
       * Consumer: lib/content/places.ts getContentAtPlace() / getPlacesSummary()
       * Spec: place-aware-globe-spec.md §14 item 2
       */
      placeId: s.string().regex(/^[a-z0-9-]+$/, 'placeId must be kebab-case slug').optional(),

      /**
       * When true, this article is the curated front-door highlight for its placeId.
       * At most one article per place may have this set to true.
       * Build-time constraint is enforced in lib/content/places.ts (cross-record, cannot be a
       * per-file zod refinement).
       * Default: false (unset means not a highlight).
       *
       * Consumer: lib/content/places.ts getPlaceHighlights() highlight-panel
       * Spec: place-aware-globe-spec.md §14 item 4
       */
      highlightForPlace: s.boolean().optional().default(false),

      // --- visibility gate (T1 lifecycle — 2026-06-08) ---
      /**
       * When true, this entry is hidden from public routes in production.
       * Default false — existing content is unaffected (non-breaking, additive).
       *
       * ORTHOGONAL to `status` (maturity ladder). Do NOT conflate.
       * In development all entries are visible regardless of this field.
       * The console/editor always sees all entries.
       *
       * Consumer: lib/content/visibility.ts isHiddenFromPublic()
       * Spec: EDITOR-LIFECYCLE-GAP-AUDIT §"Resolved build decisions" (2026-06-08)
       */
      draft: s.boolean().default(false),

      // --- worldline-weave (S3) ---
      /**
       * Outgoing inter-entry links. Declared as `to: <kind>/<identifier>`.
       * Incoming edges are computed at build time by lib/content/worldline.ts — never stored here.
       * Vision lock: VISION-2026-05-31 §2.1. Design spec: docs/design/16-worldline-schema.md §1.
       */
      worldline_links: s.array(worldlineLinkSchema).optional().default([]),
    })
    .transform((data) => ({
      ...data,
      /** ISO date for programmatic sort — derived from display date. */
      isoDate: data.date.replace(/\./g, '-'),
    })),
})

// ---------------------------------------------------------------------------
// Fiction collection
// ---------------------------------------------------------------------------
// Glyph: diamond (rotated square, new glyph) — journey-arch §2.2
// Globe layer: NeX orbit (possibility field), not surface
// Route: /fiction/<slug> (entry surface deferred per §3.4; nodes ship in v1)
//
// Fiction entries live at NeX orbital radius (R * 1.15–1.25, ontology §2.2).
// Placement is by meaning-coordinates (domain + date), not GPS.
//
// Consumer fields:
//   slug               → route param when entry surface is built
//   title              → Globe node label, side panel
//   date               → orbital latitude (ontology §2.2), sort key
//   domain             → orbital longitude (ontology §2.2)
//   tags               → AttractorFields filter
//   summary            → Globe side panel
//   kind               → Globe pinObjects discriminator (TASK-33)
//   variants           → worldline branching: alternate-α tendrils (30-worldline-branching §13.1)
//   divergence_cluster → worldline branching: sibling-set grouping (30-worldline-branching §3.1)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Fiction branching sub-schemas — 30-worldline-branching.md §3.1 + §13.1
// ---------------------------------------------------------------------------

/**
 * A single alternate-α variant for a fiction transmission.
 *
 * Per 30-worldline-branching.md §13.1:
 *   - alpha: string (preserving precision · same convention as site α "1.130426")
 *   - delta_summary: prose string, max 120 chars — NETRA reads this aloud at branch activation
 *   - drift: optional explicit divergence magnitude (|variant.alpha − site.alpha|).
 *     The renderer (§4.3) can derive drift from alpha at render time; this field
 *     is provided when the author wants to override the computed value or signal
 *     narrative significance of a specific magnitude.
 *   - slug: optional pointer to a related fiction file if the variant has materialized
 *     into a separate transmission (v1 schema is forward-compatible; v1 renderer ignores slug)
 *
 * Validation: alpha values must be unique within a fiction entry's variants array.
 * Enforced by the .superRefine() on the variants array below.
 */
const fictionVariantSchema = s.object({
  /**
   * Divergence value of the alternate worldline, e.g. "1.129801".
   * String to preserve decimal precision. Must be unique within variants[].
   * Used by §4.3 coordinate model: distance_i = R × (0.06 + min(delta_alpha_i × 60, 0.10))
   */
  alpha: s.string().regex(
    /^\d+\.\d+$/,
    'variants[].alpha must be a decimal string, e.g. "1.129801"'
  ),

  /**
   * One-line prose description of what diverges in this variant.
   * Max 120 chars — NETRA truncates to first clause if longer (§13.1).
   * Example: "the four-pours line never settles · extraction never converges"
   */
  delta_summary: s.string().min(1).max(120),

  /**
   * Optional explicit drift magnitude = |variant.alpha − site.alpha|.
   * If absent, the renderer derives it at runtime from alpha.
   * Provide when authoring significance attaches to a specific numeric distance.
   */
  drift: s.number().nonnegative().optional(),

  /**
   * Optional slug pointing to a materialized fiction file for this variant.
   * E.g. "transmission-001-α-1129801". V1 renderer ignores this (v1 is read-only
   * per §6.1); included for forward-compatibility toward v1.1 hybrid interaction.
   */
  slug: s
    .string()
    .regex(/^[a-z0-9-]+$/, 'variants[].slug must be lowercase alphanumeric with hyphens')
    .optional(),
})

const fiction = defineCollection({
  name: 'Fiction',
  pattern: 'fiction/*.mdx',
  schema: s
    .object({
      /** URL-safe slug, e.g. "transmission-001". */
      slug: s.string().regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with hyphens'),

      /** Content type discriminator. Always "fiction" for this collection.
       *  Drives Globe glyph: diamond (rotated square) per journey-arch §2.2. */
      kind: s.literal('fiction'),

      title: s.string().min(1).max(200),
      /** Display date string in site format YYYY.MM.DD. */
      date: s.string().regex(/^\d{4}\.\d{2}\.\d{2}$/, 'date must be YYYY.MM.DD'),
      /** Thematic domain — controls orbital longitude on Globe (ontology §2.2). */
      domain: domainSchema,
      tags: s.array(s.string().min(1)).min(1),
      /** One-paragraph excerpt shown in the Globe side panel. */
      summary: s.string().min(1).max(600),

      // Fiction may have an origin locus (optional) — ontology §9.2
      /** Optional real-world origin point. Does NOT drive Globe placement for fiction
       *  (orbital placement is by meaning-coords, not GPS). */
      originLocus: coordsSchema.optional(),

      // ---------------------------------------------------------------------------
      // Worldline branching fields — 30-worldline-branching.md §3.1 + §13.1
      // Both fields are optional. Existing fiction without them validates normally.
      // Empty-state contract (§3.3): missing variants + missing divergence_cluster →
      //   no branching available; NETRA acknowledges with the §3.3 empty-state line.
      // ---------------------------------------------------------------------------

      /**
       * Alternate-α variant tendrils for this fiction transmission.
       * Channel A of the branching mechanic (§3.1). 0–4 variants per node.
       * Each variant becomes one dashed tendril arc in the NeX orbital shell
       * when the visitor attends this node under RW-5 drift (§5.1).
       *
       * Validation: alpha must be unique within this array (enforced by superRefine).
       * Cardinality: 0–4 (§3.3). Renderer caps tendril count; schema enforces max.
       */
      variants: s
        .array(fictionVariantSchema)
        .max(4, 'variants may not exceed 4 entries per node (§3.3 cardinality cap)')
        .superRefine((arr, ctx) => {
          const alphas = arr.map((v) => v.alpha)
          const seen = new Set<string>()
          for (const [i, a] of alphas.entries()) {
            if (seen.has(a)) {
              ctx.addIssue({
                code: 'custom',
                path: [i, 'alpha'],
                message: `Duplicate alpha value "${a}" in variants[]. Each variant must have a unique alpha.`,
              })
            }
            seen.add(a)
          }
        })
        .default([]),

      /**
       * Divergence cluster identifier. Channel B of the branching mechanic (§3.1).
       * A kebab-case string label shared with other fiction entries in the same cluster.
       * At build time (or render time), entries sharing a cluster become candidate
       * sibling branches (up to 2, selected by shortest |alpha_self − alpha_sibling|
       * per §3.1 sibling-set computation).
       *
       * Format: lowercase · hyphens · no spaces · max 40 chars.
       * Example: "unresolved-method", "kyoto-roastery"
       */
      divergence_cluster: s
        .string()
        .regex(
          /^[a-z0-9-]+$/,
          'divergence_cluster must be lowercase alphanumeric with hyphens (kebab-case)'
        )
        .max(40, 'divergence_cluster must be 40 chars or fewer')
        .optional(),

      // --- visibility gate (T1 lifecycle — 2026-06-08) ---
      /**
       * When true, this fiction entry is hidden from public routes in production.
       * Default false — existing content is unaffected (non-breaking, additive).
       * Orthogonal to `status`. The console always sees all entries.
       * Consumer: lib/content/visibility.ts isHiddenFromPublic()
       */
      draft: s.boolean().default(false),

      // --- worldline-weave (S3) ---
      /**
       * Outgoing inter-entry links for this fiction transmission.
       * Incoming edges computed at build time — never stored here.
       * Vision lock: VISION-2026-05-31 §2.1. Design spec: docs/design/16-worldline-schema.md §1.
       */
      worldline_links: s.array(worldlineLinkSchema).optional().default([]),
    })
    .transform((data) => ({
      ...data,
      /** ISO date for programmatic sort. */
      isoDate: data.date.replace(/\./g, '-'),
    })),
})

// ---------------------------------------------------------------------------
// Photos collection — roll-level descriptor (one per roll directory)
// ---------------------------------------------------------------------------
// Glyph: small square (new glyph) — journey-arch §2.2
// Globe layer: Ne0 surface only (GPS-anchored) + ALL stratum
// Route: roll index at /photos/<roll>
//
// roll.mdx provides roll-level metadata: title, date range, location label.
// Per-photo records live in the photoSidecars collection below (TASK-30).
//
// Privacy rule (ontology §2.1, quality bar):
//   GPS is stripped from served metadata unless shareLocation: true.
//   Photos without GPS or with shareLocation: false do not appear on the Globe.
//
// Consumer fields:
//   roll          → /photos/<roll> roll index route
//   id            → legacy single-photo stub field (TASK-22 compat)
//   caption       → roll description, contact sheet
//   shareLocation → GPS privacy gate (ontology §2.1)
//   coords        → Globe pin placement (Ne0 surface) when shareLocation=true
//   kind          → Globe pinObjects discriminator (TASK-33)
// ---------------------------------------------------------------------------

const photos = defineCollection({
  name: 'Photo',
  // NOTE: velite hard-ignores files starting with '_' (fast-glob ignore: ["**/_*"]).
  // Therefore _meta.mdx cannot be used. The roll descriptor is named roll.mdx.
  // Pattern: each roll directory has exactly one roll.mdx at the top level.
  pattern: 'photos/*/roll.mdx',
  schema: s
    .object({
      /** Roll directory name, e.g. "2026-04-chiang-mai". Used in route + contact sheet. */
      roll: s.string().regex(/^\d{4}-\d{2}-[a-z0-9-]+$/, 'roll must be YYYY-MM-<place-slug>'),

      /** Per-photo ID within the roll, e.g. "DSCF0001". Unique within roll. */
      id: s.string().min(1).max(64),

      /** Content type discriminator. Always "photo" for this collection.
       *  Drives Globe glyph: square per journey-arch §2.2. */
      kind: s.literal('photo'),

      /** Optional caption. Shown on entry page and contact sheet. */
      caption: s.string().max(400).optional(),

      // --- privacy ---
      /** Whether to surface GPS coordinates in served metadata and on the Globe.
       *  Default false — photographer opts in per photo (ontology §2.1). */
      shareLocation: s.boolean().default(false),

      /** Real-world GPS coordinate where the photo was taken.
       *  Only present when photographer provides it. Only SERVED when shareLocation=true.
       *  Enforcement is a TASK-20 build-step concern; the schema accepts it regardless. */
      coords: coordsSchema.optional(),

      // --- display date ---
      /** Display date string in site format YYYY.MM.DD (capture date). */
      date: s.string().regex(/^\d{4}\.\d{2}\.\d{2}$/, 'date must be YYYY.MM.DD'),
    })
    .transform((data) => ({
      ...data,
      /** ISO date for programmatic sort. */
      isoDate: data.date.replace(/\./g, '-'),
      /** Sanitized coords: only exposed when shareLocation=true.
       *  This is a second layer of defence; TASK-20 provides the primary build-step scrub. */
      servedCoords: data.shareLocation ? data.coords : undefined,
    })),
})

// ---------------------------------------------------------------------------
// PhotoSidecars collection — per-photo sidecar MDX files (TASK-30)
// ---------------------------------------------------------------------------
// Pattern: photos/*/<id>.mdx  (DSCF0001.mdx etc.)
// Excludes roll.mdx (matched by photos collection above).
//
// Each sidecar has:
//   Frontmatter: roll, id, kind:'photo', caption?, shareLocation, overridePlace?, date
//   Derived in transform: exif + variants from process-photos.ts cache
//
// Process-photos.ts MUST run before velite build. It writes:
//   content/photos/<roll>/.cache/<id>.json
// The schema transform reads this cache. If no cache exists for a JPEG,
// exif + variants fields will be absent (both optional in schema).
//
// Privacy invariant: coords only surfaces in the velite record when:
//   1. process-photos.ts wrote coords to cache (requires shareLocation=true in sidecar)
//   2. This schema transform writes servedCoords (second gate — mirrors photos collection)
//
// Consumer fields:
//   roll          → /photos/<roll> roll index, Globe pin
//   id            → /photos/<roll>/<id> entry route param
//   caption       → entry page, contact sheet
//   shareLocation → GPS privacy gate
//   exif          → instrument readout panel (TASK-31)
//   variants      → <picture> elements, lightbox, contact sheet thumbnails
//   coords        → Globe pin placement (GPS-opted-in photos only)
//   filmSim       → palette suggestion affordance (TASK-34)
//   kind          → Globe pinObjects discriminator (TASK-33)
// ---------------------------------------------------------------------------

const photoSidecars = defineCollection({
  name: 'PhotoSidecar',
  // Matches DSCF*.mdx, not roll.mdx. Any .mdx in a roll directory that is NOT roll.mdx.
  // velite's pattern is a glob; we need to exclude roll.mdx.
  // Strategy: match photos/*/*.mdx — roll.mdx is excluded by the photos collection
  // pattern (same files cannot be in two collections; velite deduplicates by path).
  // If velite does NOT deduplicate, we use a more specific pattern.
  // Per velite 0.3.1 behavior: each file is processed by ALL matching collections,
  // so we MUST use a non-overlapping pattern.
  // roll.mdx is excluded here by using the pattern photos/*/[!r]*.mdx — but
  // fast-glob negation inside brackets is unreliable. Instead: rely on the
  // frontmatter `kind` validator. roll.mdx has `kind: 'photo'`; sidecar files have
  // `kind: 'photo-sidecar'`. Velite will fail schema validation on the wrong kind,
  // which effectively excludes mismatched files.
  //
  // NOTE: velite 0.3.1 processes ALL matching files per collection. If roll.mdx
  // matches photos/*/*.mdx, it will fail schema validation because its kind='photo'
  // not 'photo-sidecar'. With --strict this fails the build. Therefore we use
  // a filename-level pattern that excludes roll.mdx:
  //   photos/*/[A-Z]*.mdx  — sidecar files are named DSCF*.mdx (uppercase-first)
  //   roll.mdx starts with lowercase 'r' and is excluded
  //
  // This relies on the Fuji camera naming convention (DSCF prefix). If other cameras
  // produce lowercase filenames, adjust this pattern. Document any change in SCHEMAS.md.
  pattern: 'photos/*/[A-Z]*.mdx',
  schema: s
    .object({
      /** Roll directory name, e.g. "2026-04-chiang-mai". */
      roll: s.string().regex(/^\d{4}-\d{2}-[a-z0-9-]+$/, 'roll must be YYYY-MM-<place-slug>'),

      /** Photo ID, e.g. "DSCF0001". Matches source JPEG stem. */
      id: s.string().min(1).max(64),

      /** Content type discriminator. Always "photo-sidecar" for this collection. */
      kind: s.literal('photo-sidecar'),

      /** Optional caption override. Supersedes EXIF description. */
      caption: s.string().max(400).optional(),

      // --- privacy ---
      /** Whether to surface GPS coordinates. Default false. Photographer opts in. */
      shareLocation: s.boolean().default(false),

      /** Optional place name override when GPS is opted in but EXIF geocoding is absent. */
      overridePlace: s.string().max(200).optional(),

      /**
       * Optional LOCALITY-LEVEL coordinate declared directly in frontmatter.
       *
       * Use this when the source JPEG carries no EXIF GPS (no process-photos cache
       * coords) but the photographer still wants the photo to plot on the globe at a
       * deliberately COARSE, city-level locus — NOT a precise capture point.
       *
       * PRIVACY (HARD — Peat policy 2026-06-01): the value authored here must already
       * be a city centroid / locality, never a private home or exact corner. The
       * transform additionally rounds servedCoords to ~2 decimals (≈1km) as defence in
       * depth, so even a too-precise frontmatter value cannot pinpoint a private spot.
       *
       * Gating is unchanged: this is only ever surfaced as servedCoords when
       * shareLocation=true. With shareLocation=false it is dropped exactly like cache GPS.
       *
       * Precedence in the transform: frontmatter `coords` wins over cache coords. The
       * `place` field here supersedes `overridePlace` for the served locality label.
       */
      coords: coordsSchema.optional(),

      // --- display date ---
      /** Display date string in site format YYYY.MM.DD (capture date or override). */
      date: s.string().regex(/^\d{4}\.\d{2}\.\d{2}$/, 'date must be YYYY.MM.DD'),

      // --- variant + EXIF overrides (optional — pipeline sets defaults) ---
      // Frontmatter may not include these; they are derived from process-photos cache.

      // --- place-aware globe (place-aware-globe-spec.md §14) ---
      /**
       * Place this photo (frame) belongs to. Slug-form place ID (e.g. "chiang-mai").
       * Optional — when absent, derived from roll slug at query time (see lib/content/places.ts).
       * Written by the Atlas Console once curation begins.
       * NULL until console phase; the globe derives placement from servedCoords until then.
       *
       * Consumer: lib/content/places.ts getContentAtPlace() / getPlaceHighlights()
       * Spec: place-aware-globe-spec.md §14 item 3
       */
      placeId: s.string().regex(/^[a-z0-9-]+$/, 'placeId must be kebab-case slug').optional(),

      /**
       * Highlight rank for this frame within its placeId (1 = first in strip, 5 = last).
       * Null when not curated as a highlight. At most 5 frames per place may have a rank.
       * Build-time cross-record constraint enforced in lib/content/places.ts.
       * Unit: individual frame (PhotoSidecar), not roll.
       *
       * Consumer: lib/content/places.ts getPlaceHighlights() photo strip
       * Spec: place-aware-globe-spec.md §14 item 4
       */
      highlightRank: s.number().int().min(1).max(5).optional(),

      // --- visibility gate (T1 lifecycle — 2026-06-08) ---
      /**
       * When true, this photo sidecar is hidden from public routes in production.
       * Default false — existing content is unaffected (non-breaking, additive).
       * Orthogonal to GPS / shareLocation. The console always sees all entries.
       * Consumer: lib/content/visibility.ts isHiddenFromPublic()
       */
      draft: s.boolean().default(false),

      // --- worldline-weave (S3) ---
      /**
       * Outgoing inter-entry links for this photo.
       * Not GPS-gated: worldline_links are metadata, not location data.
       * A photo with shareLocation=false may still declare worldline_links.
       * Incoming edges computed at build time — never stored here.
       * Vision lock: VISION-2026-05-31 §2.1. Design spec: docs/design/16-worldline-schema.md §1.
       */
      worldline_links: s.array(worldlineLinkSchema).optional().default([]),
    })
    .transform(async (data, ctx) => {
      // Derive the absolute path to this sidecar file from the velite context.
      // ctx.meta extends VeliteFile / VFile — ctx.meta.path is the absolute path.
      const sidecarAbsPath = ctx.meta.path

      // Derive the roll directory from the sidecar path
      const rollDir = path.dirname(sidecarAbsPath)
      const cacheFile = path.join(rollDir, '.cache', `${data.id}.json`)

      // Read the process-photos cache if available
      type CacheShape = {
        exif?: Record<string, unknown>
        variants?: Record<string, unknown>
        coords?: { lat: number; lon: number }
      }
      let cache: CacheShape = {}
      try {
        const raw = await fs.readFile(cacheFile, 'utf-8')
        cache = JSON.parse(raw) as CacheShape
      } catch {
        // Cache not yet generated — run `npm run process-photos` first.
        // exif + variants will be absent; build continues (both are optional).
      }

      // GPS privacy gate — defence in depth on top of process-photos.ts scrub.
      //
      // Coordinate SOURCE precedence (first defined wins):
      //   1. frontmatter `coords` — author-declared LOCALITY (city centroid). Used for
      //      the street rolls whose source JPEGs carry no EXIF GPS. Already coarse.
      //   2. cache `coords` — raw EXIF GPS written by process-photos.ts. PRECISE — must
      //      be rounded before it leaves this transform or it would pinpoint a spot.
      //
      // LOCALITY-ROUNDING (HARD — Peat privacy policy 2026-06-01):
      //   servedCoords lat/lon are ALWAYS rounded to 2 decimal places (~1.1km at the
      //   equator) before emission, regardless of source. This guarantees the pin sits
      //   on the city, never on the exact corner/home, even if a precise value reaches
      //   here from the EXIF cache or an over-precise frontmatter entry. The raw `coords`
      //   field is NEVER exposed; only this rounded servedCoords leaves the transform.
      //
      // Place label precedence: frontmatter coords.place → overridePlace → ''.
      const roundLocality = (n: number) => Math.round(n * 100) / 100

      const frontmatterCoords = data.coords as
        | { lat: number; lon: number; place: string }
        | undefined
      const cacheCoords = cache.coords as { lat: number; lon: number } | undefined
      const sourceCoords = frontmatterCoords ?? cacheCoords

      const servedCoords =
        data.shareLocation && sourceCoords != null
          ? {
              lat: roundLocality(sourceCoords.lat),
              lon: roundLocality(sourceCoords.lon),
              place: frontmatterCoords?.place ?? data.overridePlace ?? '',
            }
          : undefined

      // PRIVACY: strip the raw frontmatter `coords` from the served record. Only the
      // locality-rounded, gate-controlled `servedCoords` is allowed to leave this
      // transform. `coords` is a SOURCE field consumed above (precedence over cache);
      // exposing it would re-introduce a second, ungated copy of the location.
      const { coords: _rawCoords, ...served } = data

      return {
        ...served,
        /** ISO date for programmatic sort. */
        isoDate: data.date.replace(/\./g, '-'),
        /** EXIF metadata from process-photos cache. May be absent if pipeline not run. */
        exif: cache.exif as
          | {
              camera?: string
              lens?: string
              filmSim?: string
              aperture?: number
              shutter?: string
              iso?: number
              focal?: number
              focal35?: number
              captureTime?: string
            }
          | undefined,
        /** Responsive variants from process-photos cache. May be absent if pipeline not run. */
        variants: cache.variants as
          | {
              thumb: { jpg: string; webp: string; avif: string }
              medium: { jpg: string; webp: string; avif: string }
              full: { jpg: string; webp: string; avif: string }
            }
          | undefined,
        /**
         * GPS-gated coordinates for Globe placement.
         * Only defined when shareLocation=true AND process-photos wrote GPS to cache.
         * Undefined for all other photos — they do not appear on the Globe.
         *
         * PRIVACY INVARIANT: this field is the runtime gate. The build-step gate is
         * process-photos.ts (which refuses to write GPS to cache unless shareLocation=true).
         * Two layers of defence per quality bar.
         */
        servedCoords,
      }
    }),
})

// ---------------------------------------------------------------------------
// Velite configuration
// ---------------------------------------------------------------------------

export default defineConfig({
  root: 'content',
  output: {
    data: '.velite',
    assets: 'public/static',
    base: '/static/',
    name: '[name]-[hash:6].[ext]',
    clean: true,
  },
  collections: { articles, fiction, photos, photoSidecars },
})
