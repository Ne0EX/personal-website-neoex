# PRD 01 — Entry Pages

> Status: Draft v0.1 — 2026.05.10
> Phase: A (foundation)
> Companion: `worldline-feature-brainstorm.md` §1, §3.1
> Tech: velite, shiki, rehype-pretty-code, exifr, date-fns

---

## Goal

Make Worldline a place that contains things. Today, `RECENT_ENTRIES` is a hardcoded TypeScript array of summaries with no actual reading surface. After this PRD, the site has three working content templates (article, photo, fiction), each backed by file-based content that authors edit as MDX/markdown, with a real reading page behind every ATLAS pin.

## User stories

- **As Peat (author)**, I want to write an article in MDX with frontmatter, drop it in a folder, and have it appear in the chapter index, on the ATLAS globe, and at its own URL — without editing TypeScript.
- **As Peat**, I want to upload a photo from my X-E5 with EXIF/GPS intact and have the site auto-place it on the globe at the correct coordinate, surface its film simulation + camera settings as instrument data, and serve resized variants.
- **As Peat**, I want short fiction to render in a different reading mode from articles — paper feel deepened, serif typography, alternate-worldline framing.
- **As a visitor**, I want to click any ATLAS pin and arrive at a real reading page (not just a side panel summary), with marginal sidenotes, a patches log, and links to related branches.

## Scope

### In scope

- velite installation and configuration with three collections: `articles`, `photos`, `fiction`.
- MDX rendering pipeline with shiki syntax highlighting via rehype-pretty-code.
- Three entry-page templates with shared shell (header / body / footer / related branches).
- Article template: prose body, marginal sidenotes, patches log, reading-time computation.
- Photo template: full-resolution view, EXIF instrument readout, roll context (prev/next within roll).
- Fiction template: full-screen mode, deepened paper texture, serif body type, divergence value display.
- Build-step EXIF extraction for photos including GPS, film simulation, full camera settings.
- Build-step image variants (thumb / medium / full) via sharp.
- Migration of existing `RECENT_ENTRIES` array data into MDX files in `content/articles/`.
- Updated ATLAS pin → entry page navigation (currently opens side panel; should route to entry page on full click, keep side panel for hover preview).

### Out of scope

- Audience fork (PRD 02).
- Triangulate search (PRD 04).
- NETRA whispers / chat surfaces (PRD 05).
- Per-visit drift mechanics (Tier 5).
- GitHub-coupled writeups (later phase).
- Audio companion for fiction reading (parking lot).
- Comment / interaction systems.

## Functional requirements

### Article entry

```
─────────────────────────────────────────
  HEADER
  · file number · date · status badge · reading time
  · drift coordinates (lat/lon · distance from α)
  · tags (linked to attractor field filters)
─────────────────────────────────────────
  BODY (prose, max-width ~70ch)
  · supports MDX components
  · marginal sidenotes pull right (extends existing marginalia HUD pattern)
  · code blocks via shiki, paper-aesthetic theme
  · footnotes resolve to right margin or anchor on mobile
─────────────────────────────────────────
  PATCHES LOG
  · most recent first
  · format: PATCH NN · YYYY.MM.DD — single-line description
─────────────────────────────────────────
  RELATED BRANCHES
  · 3-5 entries sharing this entry's attractor field tags
─────────────────────────────────────────
  PREV / NEXT in chronological worldline
─────────────────────────────────────────
```

Frontmatter schema (zod):

```
fileNum: string (zero-padded "003")
title: string
date: string (yyyy.mm.dd)
domain: 'identity' | 'reflection' | 'method' | 'meta'
tags: string[]
status: 'seed' | 'ongoing' | 'refined' | 'settled'
coords: { lat: number, lon: number, place: string }
summary: string (used in side panel + RSS)
patches: Array<{ n: number, date: string, note: string }>
share-location: boolean (default true for articles)
```

### Photo entry

```
─────────────────────────────────────────
  PHOTO (full-bleed up to medium variant width)
─────────────────────────────────────────
  INSTRUMENT READOUT (ATLAS-style)
  · film simulation · aperture · shutter · ISO
  · focal length · lens · capture time
  · GPS coords (if share-location: true)
─────────────────────────────────────────
  CAPTION (optional)
─────────────────────────────────────────
  ROLL CONTEXT
  · roll name · prev/next within roll · all photos in roll
─────────────────────────────────────────
```

Photo collection schema:

```
roll: string (folder name, e.g. "2026-04-chiang-mai")
sourceFile: string (DSCF0001.jpg)
caption?: string
share-location: boolean (default false — privacy default)
exif: derived (camera, lens, fSim, aperture, shutter, iso, focal, captureTime, gps)
variants: derived (thumb, medium, full URLs)
coords: derived from exif.gps when share-location: true
```

### Fiction entry

```
─────────────────────────────────────────
  TRANSMISSION HEADER
  · "INTERCEPTED TRANSMISSION · α-VARIANT"
  · transmission divergence value (distinct from site α)
  · estimated read time
─────────────────────────────────────────
  BODY (full-screen mode, paper texture deepened)
  · serif typography (Cormorant Garamond at slightly larger size)
  · max-width ~62ch
  · chapter breaks for longer pieces
─────────────────────────────────────────
  TRANSMISSION FOOTER
  · "TRANSMISSION ENDS · α 1.xxxxxx · drift +x.xxxxxx from observer"
─────────────────────────────────────────
```

Fiction frontmatter:

```
slug: string
title: string
date: string
divergence: string (the fiction's own α value — narrative, not site state)
length: 'short' | 'medium' | 'long'
chapters?: Array<{ title: string, body: string }>
summary: string
```

## Data model migration

Move existing `RECENT_ENTRIES` and `OBSERVER_NODES` from `lib/entries.ts` into:

- `content/articles/000-notes-from-a-paused-engineer.mdx`
- `content/articles/001-the-four-pours-adaptation.mdx`
- `content/articles/002-why-i-paused-the-startup.mdx`
- `content/articles/003-on-the-architecture-of-taste.mdx`

`OBSERVER_NODES` (α, 012, 047) are not entries — keep these in `lib/entries.ts` as static config since they're observer-locus markers, not content.

`ATTRACTOR_FIELDS`, `STAGE_RADIUS`, `DOMAIN_ANGLE` stay in `lib/entries.ts`.

Generated content cache is consumed by:

- `components/ChapterIndex.tsx` (instead of importing `RECENT_ENTRIES`)
- `components/WorldlineGlobe.tsx` (pin generation)
- New entry page route handlers

## Acceptance criteria

- [ ] velite config validates all four entry collections; build fails on schema violation.
- [ ] Three real article MDX files exist, render, and replace the hardcoded array.
- [ ] At least one photo entry exists end-to-end: source file in `content/photos/<roll>/`, EXIF extracted, variants generated, GPS pin appears on globe (if share-location), reading page renders at `/photos/<roll>/<id>`.
- [ ] At least one fiction entry exists, renders in full-screen reading mode, displays its narrative divergence value distinct from site α.
- [ ] ATLAS pin click navigates to entry page; side panel preview still works on hover/tap-once.
- [ ] Patches log displays correctly when frontmatter `patches: []` is populated.
- [ ] Reading time computes from word count (assume 220 wpm).
- [ ] All entries render correctly on mobile (≤600px) and respect existing `prefers-reduced-motion`.
- [ ] Lighthouse accessibility score ≥95 on each entry template.

## Dependencies (from tech proposal)

- velite, zod
- shiki, rehype-pretty-code
- exifr
- date-fns
- sharp (already a transitive Next.js dep, used directly here for variant generation)

## Open questions

- **Sidenotes implementation.** MDX component `<Sidenote>` that pulls into right margin? Or a remark plugin that picks up specific syntax? Recommend MDX component for v1 — explicit, easy to author.
- **Code-block theme.** Does shiki need a paper-aesthetic theme tuned for the cream `#E8E2D5` background, or use an existing one (e.g., `min-light` for light, `vitesse-dark` for dark / ink palette)? Recommend customization; a default theme will fight the surface.
- **Photo upload workflow.** Manual drop into `content/photos/<roll>/` plus a build re-run is fine for v1. If upload friction becomes real, build a `scripts/import-roll.ts` that takes an SD card path and copies + organizes. Not blocking.
- **Article-photo pairing.** When an article includes photos, does it embed via MDX `<Photo id="..." />` (referencing the photo collection), or are they uploaded inline? Recommend reference-by-id — keeps photos as first-class entities, prevents duplication.
- **Fiction "chapters".** Render as a single scrolling page with anchor links, or as separate routes (`/fiction/<slug>/<chapter>`)? Recommend single page for v1; revisit if any piece exceeds ~5 chapters.

---

*End of PRD.*
