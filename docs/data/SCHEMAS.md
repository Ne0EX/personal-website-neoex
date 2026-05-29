# Content Layer Schema Documentation

Owner: Procyon (α-IDX-03)
Last updated: 2026-05-17 · TASK-2026-05-17-PROCYON-BRANCHING-SCHEMA

---

## Overview

Four velite collections define the content layer. All schemas are zod-validated;
the build fails with `velite build --strict` on any violation.

```
Collection     Pattern                         Records
-----------    --------------------------      -------
Article        content/articles/*.mdx          one per written entry
Fiction        content/fiction/*.mdx           one per transmission
Photo          content/photos/*/roll.mdx       one per roll directory
PhotoSidecar   content/photos/*/[A-Z]*.mdx     one per source JPEG (DSCF*.mdx)
```

---

## Article

Route: `/entries/<fileNum>`
Globe glyph: circle · Ne0 surface

| Field        | Type                                          | Required | Notes                                     |
|-------------|-----------------------------------------------|----------|-------------------------------------------|
| fileNum      | string `/^\d{3}$/`                            | yes      | route param + Globe pin ID               |
| kind         | `'article'`                                   | yes      | discriminator for Globe glyph            |
| title        | string (1–200 chars)                          | yes      |                                          |
| date         | string `YYYY.MM.DD`                           | yes      | display format                           |
| domain       | `identity \| reflection \| method \| meta`   | yes      | orbital longitude on Globe               |
| tags         | string[] (min 1)                              | yes      | AttractorFields filter                   |
| status       | `seed \| ongoing \| refined \| settled`       | yes      | Globe placement radius                   |
| readingTime  | integer (positive)                            | yes      | minutes                                  |
| summary      | string (1–600 chars)                          | yes      | Globe side panel + search excerpt        |
| coords       | `{ lat, lon, place }`                         | yes      | GPS anchor on Globe                      |
| patches      | `{ n, date, note }[]`                         | no       | revision log                             |
| shareLocation| boolean (default false)                       | no       | privacy gate for served coords           |
| *isoDate*    | string (derived)                              | —        | `YYYY-MM-DD` for sort                    |

---

## Fiction

Route: `/fiction/<slug>` (entry surface deferred; Globe nodes ship in v1)
Globe glyph: diamond · NeX orbit

Schema version: v2 · branching fields added 2026-05-17 (TASK-2026-05-17-PROCYON-BRANCHING-SCHEMA)
Full branching documentation: `docs/data/fiction-schema-v2.md`

| Field              | Type                                         | Required | Notes                                               |
|-------------------|----------------------------------------------|----------|-----------------------------------------------------|
| slug               | string `^[a-z0-9-]+$`                        | yes      | route param                                        |
| kind               | `'fiction'`                                  | yes      | Globe discriminator                                |
| title              | string (1–200 chars)                         | yes      |                                                    |
| date               | string `YYYY.MM.DD`                          | yes      |                                                    |
| domain             | `identity \| reflection \| method \| meta`  | yes      | NeX orbital longitude                              |
| tags               | string[]                                     | yes      |                                                    |
| summary            | string (1–600 chars)                         | yes      |                                                    |
| originLocus        | `{ lat, lon, place }` (optional)             | no       | does NOT drive Globe placement                     |
| variants           | `FictionVariant[]` (default `[]`)            | no       | branching Channel A; 0–4 entries; alpha unique     |
| divergence_cluster | string `^[a-z0-9-]+$` (max 40, optional)    | no       | branching Channel B; groups sibling fiction nodes  |
| *isoDate*          | string (derived)                             | —        |                                                    |

### FictionVariant shape

```ts
type FictionVariant = {
  alpha: string          // decimal string, e.g. "1.129801". Unique within variants[].
  delta_summary: string  // max 120 chars. NETRA reads this at branch activation.
  drift?: number         // optional explicit |variant.alpha − site.alpha|. Renderer derives if absent.
  slug?: string          // optional: slug of a materialized fiction file for this variant.
}
```

---

## Photo (roll.mdx)

Route: roll index at `/photos/<roll>`
One record per roll directory. Provides roll-level metadata.

| Field        | Type                              | Required | Notes                                   |
|-------------|-----------------------------------|----------|-----------------------------------------|
| roll         | string `YYYY-MM-<place-slug>`     | yes      | route param + directory name           |
| id           | string (1–64 chars)               | yes      | legacy compat field (TASK-22)          |
| kind         | `'photo'`                         | yes      | Globe discriminator                    |
| caption      | string (max 400)                  | no       | roll description                       |
| shareLocation| boolean (default false)           | no       | roll-level GPS gate (per-photo in sidecar) |
| coords       | `{ lat, lon, place }` (optional)  | no       |                                        |
| date         | string `YYYY.MM.DD`               | yes      |                                        |
| *isoDate*    | string (derived)                  | —        |                                        |
| *servedCoords*| `{ lat, lon, place }` \| undefined| —       | undefined when shareLocation=false     |

---

## PhotoSidecar (DSCF*.mdx)

Route: `/photos/<roll>/<id>`
One record per source JPEG with a sidecar file. EXIF + variants derived from
`scripts/process-photos.ts` cache at `content/photos/<roll>/.cache/<id>.json`.

Globe glyph: square · Ne0 surface (GPS-opted-in only)

### Frontmatter fields

| Field        | Type                              | Required | Notes                                   |
|-------------|-----------------------------------|----------|-----------------------------------------|
| roll         | string `YYYY-MM-<place-slug>`     | yes      |                                        |
| id           | string (1–64 chars)               | yes      | must match source JPEG stem (e.g. DSCF0001) |
| kind         | `'photo-sidecar'`                 | yes      | discriminates from roll.mdx            |
| caption      | string (max 400)                  | no       | overrides EXIF description             |
| shareLocation| boolean (default false)           | no       | GPS opt-in per photo                   |
| overridePlace| string (max 200)                  | no       | place label when GPS opted in          |
| date         | string `YYYY.MM.DD`               | yes      | capture date or override               |

### Derived fields (from process-photos.ts cache)

| Field        | Type                              | Notes                                                    |
|-------------|-----------------------------------|----------------------------------------------------------|
| *isoDate*    | string                            | `YYYY-MM-DD` for sort                                    |
| *exif*       | PhotoExif \| undefined            | absent if process-photos not run                         |
| *variants*   | PhotoVariants \| undefined        | absent if process-photos not run                         |
| *servedCoords*| `{ lat, lon, place }` \| undefined | GPS-gated: only set when shareLocation=true + GPS in cache |

### PhotoExif shape

```ts
type PhotoExif = {
  camera?: string       // "FUJIFILM X-E5"
  lens?: string         // "XF23mmF2 R WR"
  filmSim?: string      // "Classic Chrome" — drives TASK-34 palette suggestion
  aperture?: number     // f-number, e.g. 2.8
  shutter?: string      // "1/250"
  iso?: number          // 400
  focal?: number        // mm native
  focal35?: number      // 35mm equivalent
  captureTime?: string  // ISO 8601
  // No GPS fields. GPS is stripped at process-photos.ts level.
}
```

### PhotoVariants shape

```ts
type PhotoVariants = {
  thumb:  { jpg: string; webp: string; avif: string }  // 320px wide
  medium: { jpg: string; webp: string; avif: string }  // 1280px wide
  full:   { jpg: string; webp: string; avif: string }  // 2400px wide
}
// All paths are web-root relative: "/photos/<roll>/<slug>-<size>-<hash>.<ext>"
```

---

## Privacy invariants

1. **GPS strips by default.** `shareLocation` defaults to `false` in both Photo and
   PhotoSidecar schemas. A photographer must explicitly set `shareLocation: true`.

2. **process-photos.ts gate.** The pipeline writes `coords` to the JSON cache ONLY
   when `shareLocation: true` in the co-located sidecar MDX at processing time.

3. **velite transform gate.** The `photoSidecars` schema transform sets `servedCoords`
   only when `shareLocation === true` AND `cache.coords != null`. This is a second
   independent check.

4. **getGlobeEligiblePhotos() gate.** The runtime query function filters on
   `shareLocation === true && servedCoords !== undefined`. Third check.

5. **sharp strips EXIF.** Generated variants in `public/photos/` have no embedded
   EXIF (sharp re-encodes without EXIF by default). Even the JPEG download is GPS-clean.

Algol regression test must confirm that `getGlobeEligiblePhotos()` never returns
a PhotoPin for a record where `shareLocation === false`, regardless of cache contents.

---

## Pattern constraints

- `photos/*/[A-Z]*.mdx` for PhotoSidecar — relies on Fuji uppercase filename convention
  (DSCF*, DSCF_*, DSCf*). If adding non-Fuji cameras with lowercase filenames, update
  this pattern and document here.
- `photos/*/roll.mdx` for Photo — the `roll.mdx` name is required; `_meta.mdx` is
  silently ignored by velite's fast-glob (hardcoded `ignore: ["**/_*"]`).
- `.cache/` subdirectory is gitignored. process-photos.ts writes here; velite reads here.

---

## Build sequence

```
1. npm run process-photos    # generates .cache/*.json per JPEG
2. npm run content:build     # velite reads cache, emits .velite/*.json
3. npm run build             # Next.js reads .velite/ via lib/content/
```

`npm run build` runs steps 2–3 via the `prebuild` lifecycle hook (`velite build --strict`).
Step 1 must run separately before first build, or when new photos are added.

Flag for Canopus co-sign: `package.json` needs a `process-photos` script and the
`prebuild` sequence should be `process-photos && velite build --strict`.
See handoff TASK-2026-05-15-30--to-polaris.md for Canopus routing.
