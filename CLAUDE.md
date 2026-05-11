@AGENTS.md

# Worldline · ∇ Neospirit — Codebase Guide

## What This Is

A single-page personal portfolio built on Next.js 16.2.6 (App Router) with a 3D interactive globe (A.T.L.A.S. system) as the centrepiece. Entries (writing, projects) are plotted as pins at real-world coordinates on a Three.js globe, organised by lifecycle stage and thematic domain. The aesthetic is "paper archive meets terminal readout".

---

## Tech Stack

| Layer | Library | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.6 |
| UI | React | 19.2.4 |
| Language | TypeScript (strict) | ^5 |
| Styling | Tailwind CSS v4 via PostCSS | ^4 |
| 3D | Three.js + @react-three/fiber + @react-three/drei | ^0.184 / ^9 / ^10 |
| Animation | anime.js | ^4.4.1 |
| Noise | simplex-noise | ^4.0.3 |
| Lint | ESLint 9 (flat config) | ^9 |

Package manager: **npm** (`package-lock.json`).

---

## Directory Layout

```
/
├── app/
│   ├── layout.tsx        # Root layout — Google font imports, metadata
│   ├── page.tsx          # Only route (single-page site)
│   └── globals.css       # Design tokens + Tailwind base (~923 lines)
├── components/           # 13 React components (see below)
├── lib/
│   ├── entries.ts        # Entry data, geometry constants, type definitions
│   └── cartography.ts    # Perlin-noise globe contours, orthographic projection
├── public/               # Static SVG icons
├── .claude/
│   └── launch.json       # Dev server: `npm run dev` on :3000
├── next.config.ts
├── tsconfig.json         # Strict, path alias @/* → ./
├── postcss.config.mjs    # @tailwindcss/postcss only
└── eslint.config.mjs     # Flat config, next/core-web-vitals + typescript
```

---

## Components

| File | Purpose |
|---|---|
| `WorldlineGlobe.tsx` | Three.js 3D globe — 1,234 lines. Core interactive system. |
| `BootSequence.tsx` | Terminal typing animation (anime.js), fires on first visit. |
| `PageShell.tsx` | Gates content behind boot sequence using sessionStorage. |
| `Nav.tsx` | Header with live UTC+7 clock (updates every 30 s). |
| `ChapterIndex.tsx` | Entry card grid with anime.js stagger entrance. |
| `AttractorFields.tsx` | Tag filter strip (11 tags sourced from `lib/entries.ts`). |
| `HeroBlock.tsx` | Headline, divergence meter, stage/domain counts. |
| `FooterManifesto.tsx` | Closing manifesto text section. |
| `MarginaliaHUD.tsx` | Side HUD + `ScrollMeter` (scroll progress bar). |
| `DivergenceMeter.tsx` | Numeric display component, prop-driven. |
| `CornerMarks.tsx` | Decorative corner marks (paper-aesthetic). |
| `SurveyCursor.tsx` | Custom cursor overlay. |

---

## Key Data & Constants (`lib/entries.ts`)

- **`Entry` / `EntryStatus`** — types for archive entries (`seed | ongoing | refined | settled`).
- **`OBSERVER_NODES`** — α (Bangkok), 012 (Tokyo), 047 (Point Nemo).
- **`STAGE_RADIUS`** — Orbital radius per lifecycle stage (38–128 units).
- **`DOMAIN_ANGLE`** — Thematic quadrants: identity 0°, reflection 90°, method 180°, meta 270°.
- **`ATTRACTOR_FIELDS`** — Canonical tag list used by `AttractorFields`.
- **`RECENT_ENTRIES`** — Entry definitions with lon/lat coordinates, domain, status, reading time.

When adding entries, edit `RECENT_ENTRIES` here; the globe and card grid both consume it.

---

## Styling Conventions

### Design Tokens (in `app/globals.css`)

All colours are CSS custom properties. **Never hard-code hex values in components** — use the tokens.

```css
--paper-base      /* main background cream */
--paper-warm      /* warm tint */
--paper-deep      /* deeper cream */
--paper-bright    /* near-white highlight */
--ink-primary     /* teal primary (31 80 99 RGB) */
--ink-soft        /* muted ink */
--ink-faint       /* very subtle ink */
--netra           /* companion accent colour */
--accent-orange   /* #D4602A — CTAs, pins */
```

Palette toggle: add `data-palette="ink"` to `<html>` to switch to navy backup palette.

### Tailwind v4

This project uses Tailwind **v4** (PostCSS plugin `@tailwindcss/postcss`). Config is in `globals.css` via `@import "tailwindcss"` — **there is no `tailwind.config.js`**. Utility classes work as normal but theme extension lives in CSS `@theme` blocks.

### Three.js Colour Note

Three.js materials cannot read CSS custom properties. Hard-coded hex values with TEAL/INK alternates are documented at the top of `WorldlineGlobe.tsx`. When changing the palette, update both locations.

### Typography

- Headings: Cormorant Garamond
- Monospace / HUD / meta labels: JetBrains Mono
- Typewriter effect: Special Elite
- Scale: H1 56 px → body 13.5 px → meta 9 px

---

## Globe System (A.T.L.A.S.)

**Four strata (camera positions):**

| Key | Stratum | Description |
|---|---|---|
| `0` | ALL | Full orbit view, drag to rotate |
| `1` | NeX | Field shells (entry orbits) |
| `2` | Ne0N | North-pole focus |
| `3` | Ne0 | Surface level |

- Entry pins use Three.js raycaster; clicking opens entry detail.
- Keyboard: `0`/`1`/`2`/`3` jump strata, `ESC` closes panels.
- Drag-to-orbit only active in ALL and NeX strata.
- HUD displays: camera angle, lon/lat, range, stratum name.

---

## Development Workflow

### Commands

```bash
npm run dev    # Dev server at http://localhost:3000
npm run build  # Production build
npm run start  # Serve production build
npm run lint   # ESLint (flat config, strict TS rules)
```

No test framework is installed. Visual/interaction testing must be done in the browser.

### Path Aliases

`@/*` maps to the repo root (`./`). Use this for all internal imports:

```ts
import { RECENT_ENTRIES } from '@/lib/entries'
import WorldlineGlobe from '@/components/WorldlineGlobe'
```

### Tailwind v4 Gotcha

Do not add a `tailwind.config.js`. Extend the theme inside `app/globals.css` using `@theme {}` blocks.

### ESLint

Config is `eslint.config.mjs` (ESLint 9 flat format). Run `npm run lint` before committing. Ignored paths: `.next/`, `out/`, `build/`, `next-env.d.ts`.

### No Prettier

Formatting is handled by ESLint rules only. Do not add a Prettier config without discussion.

---

## Next.js 16.2.6 — Things That Changed

Read `node_modules/next/dist/docs/` before writing framework-level code. Notable differences from earlier versions:

- **App Router is the only router** — no Pages Router.
- **`"use client"` / `"use server"` directives** are strictly required where applicable.
- Async component patterns and data fetching conventions may differ from training data — check the bundled docs.
- Heed any deprecation warnings in `next build` output.

---

## Conventions

- **No comments by default** — self-documenting names are preferred. Add a comment only when the *why* is non-obvious (hidden constraint, subtle invariant, external bug workaround).
- **Single source of truth** — entry data lives in `lib/entries.ts`, tokens in `globals.css`. Do not duplicate.
- **Accessibility** — respect `prefers-reduced-motion` (BootSequence and ChapterIndex already do). Use ARIA live regions for dynamic content.
- **No backend** — this is a static export / Vercel deployment. No database, no auth, no API routes currently.
- **Mobile** — site collapses at 1200 px and 600 px. Test both breakpoints after layout changes.
