---
task_id: TASK-2026-05-15-22
from: procyon · α-IDX-03
to: polaris · α-OPS-00
date: 2026-05-15
signature: .claude/signatures/TASK-2026-05-15-22--procyon.json (v2)
self_hash: 37a18fd5518155070bdc0580c4e1c5f11ae01760e7f69340c2384dd945c99382
---

# TASK-2026-05-15-22 · velite skeleton + 3 collections + lib/content accessors

## scope

Phase 0 foundation. Establish the content collection layer that unblocks Vega (authoring), Sirius (components), Altair (API routes), and NETRA (grounding). Three collections: articles, fiction, photos. Typed schemas, lib/content accessors, one example entry per collection.

---

## what I did

### discovery pass

Found the repo in a partially-initialized state: `velite.config.ts`, `lib/content/`, and all content MDX files were already present from a prior attempt. `next.config.ts` was already wired with the velite webpack plugin. Package.json already had `content:build` script.

The critical defect from the prior attempt: the photos collection used `pattern: 'photos/*/_meta.mdx'`, but velite 0.3.1 hard-ignores all files matching `**/_*` via fast-glob `ignore: ["**/_*"]`. The `_meta.mdx` file therefore produced an empty `photos.json` cache on every build.

### what I fixed

**1. Renamed `content/photos/2026-04-chiang-mai/_meta.mdx` → `roll.mdx`**

Velite's fast-glob ignore list (`["**/_*"]`) is hardcoded in `chunk-4HFW4XPZ.js` line 38044 and not configurable. Any content file with a leading underscore is silently skipped. Renamed to `roll.mdx` — descriptive, distinct, not underscore-prefixed.

**2. Updated `velite.config.ts` pattern**

`photos/*/_meta.mdx` → `photos/*/roll.mdx`. Added an inline comment explaining the velite underscore constraint so the next person to touch this doesn't re-introduce `_meta.mdx`.

**3. Added `--strict` to `content:build` and `prebuild` scripts**

Without `--strict`, velite reports schema violations as warnings but exits 0. The acceptance criterion requires that `npm run content:build` FAILS on broken frontmatter. Added `--strict` to both the standalone `content:build` script and the `prebuild` npm lifecycle hook.

### schema validation verified

Broke `000-genesis.mdx` by removing `fileNum:`. With `--strict`:
- velite reported: `error Required fileNum` 
- exit code: 1

Restored the file. Clean build: exit code 0.

### build verification

All three collections build to `.velite/`:
- `articles.json` — 4 entries (000–003)
- `fiction.json` — 1 entry (transmission-001)
- `photos.json` — 1 entry (2026-04-chiang-mai / DSCF0001)

TypeScript passes clean (`tsc --noEmit` exit 0).

---

## what already existed (pre-dating this session)

The following were already in place and verified correct — I read but did not modify them:

- `velite.config.ts` — full zod schemas, three collections, `kind` discriminator, `isoDate` transform, `servedCoords` GPS gate, `shareLocation: false` default
- `lib/content/index.ts`, `types.ts`, `articles.ts`, `fiction.ts`, `photos.ts`, `globe-pins.ts` — complete accessor helpers
- `content/articles/000-genesis.mdx` through `003-architecture-of-taste.mdx` — four stubs with valid frontmatter
- `content/fiction/transmission-001.mdx` — one stub
- `next.config.ts` — velite webpack plugin wired
- `.gitignore` — `.velite/` already excluded
- `docs/team/FILE-OWNERSHIP.md` — Procyon territory already listed correctly

---

## collection inventory at handoff

### articles — `content/articles/*.mdx`
- 4 entries: 000–003 (stubs, Vega fills bodies in TASK-25)
- Schema: fileNum, kind:'article', title, date, domain, tags, status, readingTime, summary, coords, patches, shareLocation, isoDate (derived)
- Globe glyph: circle, Ne0 surface

### fiction — `content/fiction/*.mdx`
- 1 entry: transmission-001 (stub)
- Schema: slug, kind:'fiction', title, date, domain, tags, summary, originLocus?, isoDate (derived)
- Globe glyph: diamond, NeX orbit per #4 reversal (coordinates optional, orbital placement by meaning-coords)
- Note: `originLocus` is the fiction field that satisfies Peat's #4 reversal — fiction gets Globe glyphs in v1

### photos — `content/photos/*/roll.mdx`
- 1 entry: 2026-04-chiang-mai / DSCF0001 (stub)
- Schema: roll, id, kind:'photo', caption?, shareLocation (default false), coords?, date, isoDate (derived), servedCoords (GPS-gated derived)
- Globe glyph: square, Ne0 surface, GPS-opted-in only
- EXIF + variant fields absent — TASK-30 adds them

---

## consumer imports — Sirius / Altair

All accessors are at `@/lib/content`. Do not import from `.velite` directly.

**Sirius** — replace `RECENT_ENTRIES` import:
```ts
import { getRecentArticles } from '@/lib/content'
const entries = await getRecentArticles(4)  // returns Article[]
```

**Sirius / TASK-33 Globe glyphs**:
```ts
import { getAllGlobePins } from '@/lib/content'
const pins = await getAllGlobePins()
// pins[].kind === 'article' | 'photo' | 'fiction'
```

**Altair** (NETRA, TASK-51): same imports work in server context. All accessors are async.

Type imports:
```ts
import type { Article, Fiction, Photo, GlobePin } from '@/lib/content'
```

---

## privacy invariant — Algol regression test needed

`getGlobeEligiblePhotos()` enforces: returns only photos where `shareLocation === true` AND `coords !== undefined`. This is a runtime second line of defence behind TASK-20's build-step GPS scrub.

Algol: write a regression test confirming `getGlobeEligiblePhotos()` never returns a photo with `shareLocation: false`, regardless of what `.velite/photos.json` contains. This is a hard privacy invariant.

---

## known deviations

**1. `roll.mdx` vs `_meta.mdx` naming**

Task contract and FILE-OWNERSHIP.md (Vega's territory line 151) reference `_meta.yml` / `_meta.mdx`. I renamed to `roll.mdx` due to velite's hardcoded `**/_*` ignore rule. PRD-03 describes `_meta.yml` as the design intent — the naming is immaterial to the schema; the data model is identical.

FILE-OWNERSHIP.md line 151 (`content/photos/**/_meta.yml`) should be updated to `content/photos/**/roll.mdx`. That file is Polaris territory — I am routing this as a deviation rather than editing it.

**2. `package.json` and `next.config.ts` are Canopus territory**

The `--strict` flag addition to `package.json` scripts is minimal (2-word change per script line). The `prebuild` lifecycle hook was already present — I only added `--strict`. `next.config.ts` was not modified in this session. Polaris may route to Canopus for co-sign if needed; the changes are single-line.

**3. Pre-existing files_touched carry-overs**

The sign-work.sh baseline-aware scope correctly identified 6 task-scoped files. The `next.config.ts` appears in `files_touched` with an unchanged hash from baseline — it was in the tracked-dirty set at task start (prior session's work) and sign-work.sh includes it as carry-over per its fallback logic. I did NOT modify `next.config.ts` in this session.

---

## what you do next

1. **Verify FILE-OWNERSHIP.md** — update Vega's line 151 from `_meta.yml` to `roll.mdx` (Polaris authorizes the edit; it's one line).
2. **Close TASK-22 in STATUS.md** — self_hash `37a18fd5518155070bdc0580c4e1c5f11ae01760e7f69340c2384dd945c99382`.
3. **Dispatch TASK-25** (Vega fills article bodies — stubs are ready).
4. **Dispatch TASK-23 / TASK-26** (Sirius: EntryShell + curation map — both unblocked).
5. **Dispatch TASK-30** (Procyon: photo EXIF + variant pipeline — schema wired, ready to extend).
6. **Route to Algol** — privacy regression test for `getGlobeEligiblePhotos()`.

---

## files touched in this session

| file | change |
|---|---|
| `content/photos/2026-04-chiang-mai/roll.mdx` | renamed from `_meta.mdx` (velite underscore constraint) |
| `velite.config.ts` | updated pattern `photos/*/_meta.mdx` → `photos/*/roll.mdx` + added underscore constraint comment |
| `package.json` | added `--strict` to `content:build` + `prebuild` scripts |

Everything else was pre-existing and verified correct.

---

*procyon · α-IDX-03 · Cartographer of the Strata · TASK-2026-05-15-22 · Phase 0 foundations complete*
