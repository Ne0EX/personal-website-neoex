# Worldline · ∇ Neospirit

Personal site / digital garden — "an archive of unfinished thought, surveyed openly".
A single surveyed-document page built around **A.T.L.A.S.**, an interactive 3D globe
that anchors archive entries at real-world coordinates.

Stack: Next.js 16 (App Router, Turbopack) · React 19 · TypeScript (strict) ·
Tailwind CSS 4 · three.js · anime.js.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

| Script          | Purpose                            |
| --------------- | ---------------------------------- |
| `npm run dev`   | Dev server                         |
| `npm run build` | Production build                   |
| `npm start`     | Serve the production build         |
| `npm run lint`  | ESLint (`eslint-config-next`)      |

Type-check with `npx tsc --noEmit` (also run as part of `next build`).

## Environment

| Variable               | Required | Description                                                                 |
| ---------------------- | -------- | --------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL` | no       | Deployed origin used for canonical URLs, OG tags, `robots.txt` and sitemap. Defaults to `http://localhost:3000`. |

## Layout

```
app/
  layout.tsx            root layout — fonts, site metadata
  page.tsx              the single page: nav, hero, chapters, attractor, footer
  opengraph-image.tsx   generated 1200x630 social card
  robots.ts sitemap.ts  SEO route handlers
  globals.css           design tokens + all component styles
components/
  WorldlineGlobe.tsx    A.T.L.A.S. — three.js globe, strata travel, HUD, article panel
  HeroBlock.tsx         title strip; lazy-loads the globe via next/dynamic
  BootSequence.tsx      first-visit boot animation (gated by PageShell)
  DivergenceMeter.tsx   nixie-style divergence readout
  ...                   Nav, ChapterIndex, AttractorFields, FooterManifesto, HUD, cursor
lib/
  entries.ts            archive entries + observer nodes (content source of truth)
  cartography.ts        seeded simplex-noise contours, orthographic projection
  site.ts               site-wide constants
```

### Notes

- **Content** lives in `lib/entries.ts`; add an entry there and it is placed on the
  globe automatically from its `coords`.
- **The globe is client-only.** three.js is code-split out of the initial bundle
  through `next/dynamic` with `ssr: false`.
- **Palette** is driven by CSS custom properties in `app/globals.css` behind a
  `data-palette` toggle. Colors that three.js/canvas cannot read from CSS are
  documented in the header comment of `WorldlineGlobe.tsx`.
- Animations respect `prefers-reduced-motion`.

## Deploy

Any Node host works; the page prerenders as static content. On Vercel, set
`NEXT_PUBLIC_SITE_URL` to the production domain.
