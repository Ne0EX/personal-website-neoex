---
task_id: TASK-2026-05-15-22
from: polaris
to: procyon
date: 2026-05-15
priority: critical
model: sonnet
parent_directive: Polaris-A §A.2 cross-PRD foundational + Peat 2026-05-15 "design plan ok proceed"
---

# TASK-2026-05-15-22 · content/velite skeleton — Phase 0 foundation

## scope

Establish the content collection layer that everything downstream depends on: Vega cannot author, Sirius cannot import, NETRA cannot ground, and the Globe cannot place nodes until `content/` exists with typed schemas.

This is the single foundational TASK that unblocks the broadest surface of downstream work. Open it first; the design wave can run in parallel once it lands.

## scope per PRD-01 §"Data model migration" + PRD-03 deep-dive §2 velite section + PRD-04 feeds

Three collections at minimum (more can land later):

### articles
- Path: `content/articles/`
- File pattern: `*.mdx`
- Required frontmatter: `slug`, `title`, `date`, `status` (`draft|patched|sealed`), `tags[]`, `summary`, optional `coordinates: {lat, lon}` (for Globe pin)
- Optional frontmatter: `patches[]` (revision history), `related[]` (slugs to other entries), `worldline` (drift number)
- Body: MDX, supports Vega prose conventions (italics for emphasis, monospace for instrument readout, pullquote, codeblock)
- Computed: `readTime`, `wordCount`, `body` (rendered HTML), `excerpt`

### photos
- Path: `content/photos/`
- File pattern: per-photo directory or `*.md` with sidecar EXIF
- Frontmatter: `id`, `roll` (Fuji film simulation: `velvia` / `provia` / `astia` / `classic-chrome` / etc.), `date`, `coordinates: {lat, lon}` (required for Globe pin), `caption` (Thai or English), `tags[]`
- EXIF will land in TASK-30 (deep-dive photo pipeline) — for v0 of this TASK, accept manual frontmatter; TASK-30 extends to EXIF auto-extract
- Computed: `srcSet` (variants), `dominantColor`

### fiction
- Path: `content/fiction/`
- File pattern: `*.mdx`
- Frontmatter: `slug`, `title`, `date`, `kind` (`short-story|novel|fragment`), `summary`, `worldline`, optional `coordinates`
- Body: MDX
- Computed: `readTime`, `wordCount`, `body`

Per Peat's #4 reversal, fiction GETS Globe glyphs in v1 (diamond per journey-arch §2.2) — so schema must support the diamond-on-Globe path. Entry surfaces still deferred per #5 (no dedicated route).

## output

- `velite.config.ts` at repo root — defines the three collections with zod schemas
- `content/` directory with at least ONE example entry per collection (article, photo metadata, fiction) so the schema is exercised. Example content can be placeholder; Vega will replace with real content in a later TASK.
- `lib/content/` — typed accessor helpers for components to import (`getAllArticles()`, `getArticleBySlug()`, `getPhotosByRoll()`, etc.) per PRD-03 deep-dive §3 pattern.
- `package.json` script: `npm run content:build` runs velite build
- `.gitignore` extends to exclude `.velite/` cache dir
- `next.config.js` (if exists) wired to import velite collections (per Next 16 / velite Next plugin pattern)
- Update `docs/team/FILE-OWNERSHIP.md`: Procyon adds `content/**`, `lib/content/**`, `velite.config.ts` to her territory if not already listed

## acceptance

- `npm run content:build` exits 0 from a clean tree
- `lib/content/index.ts` exports the typed accessors with proper TypeScript types
- One real-or-placeholder entry per collection compiles to `.velite/` cache successfully
- Schema validation actually fires — try `npm run content:build` with a deliberately-broken frontmatter (e.g., missing required `slug`); it must FAIL. Then revert.
- `bash -n` clean on any shell scripts added
- Signature v2, both gates green
- Algol audit per the standing rule (her stall pattern noted, but retry on this medium-sized TASK)

## non-goals

- Do NOT implement the photo EXIF extraction (TASK-30 / PRD-03 deep-dive)
- Do NOT implement feed generators (TASK-42 / PRD-04 RSS/Atom/JSON)
- Do NOT migrate existing entries (TASK-25 separate task — needs content/articles/ to exist first)
- Do NOT build any UI components that consume the collections (Sirius downstream)
- Do NOT add new audit rails for content validation (separate follow-up if needed)
- Do NOT touch anything outside Procyon territory (`content/**`, `lib/content/**`, `velite.config.*`, `next.config.*` only for velite plug-in, `package.json` scripts only)

## dependencies

None. Standalone foundational TASK. Parallel-safe with TASK-14 (Betelgeuse opus, different territory).

## sign

Run pre-task.sh first per WORKFLOW Step 0:
```bash
WL_TASK_ID=TASK-2026-05-15-22 WL_AGENT=procyon bash .claude/hooks/pre-task.sh TASK-2026-05-15-22 procyon
```

Sign:
```bash
WL_AGENT=procyon WL_NEXT=polaris WL_SUMMARY="velite skeleton + 3 collections + lib/content accessors (TASK-22)" bash .claude/hooks/sign-work.sh TASK-2026-05-15-22
```

Return handoff at `.claude/handoffs/from-procyon/TASK-2026-05-15-22--to-polaris.md`. Required sections per pre-handoff.sh: scope, what i did, what you do next, known deviations, signature.

Update STATUS.md: close TASK-22 with self_hash.

## deadline

ASAP — Phase 0 critical path. Every downstream design + impl TASK waits on this.

---

*polaris · α-OPS-00 · 2026-05-15*
