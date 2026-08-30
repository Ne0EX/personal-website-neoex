# Worldline · ∇ Neospirit

Digital garden and personal archive of Ne0EX — notes, essays, drafts, photography rolls, and interactive cartography.

## Architecture

* **Framework**: Next.js 16 (App Router + Turbopack) & React 19
* **Styling**: Tailwind CSS v4 + bespoke design tokens (`app/globals.css`)
* **3D Cartography**: Three.js orthographic globe (A.T.L.A.S. observatory) with stratum layers
* **Bilingual Support**: Bilingual `[lang]` routing (`/th`, `/en`) with IBM Plex superfamily typography
* **Store as Source**: Supabase PostgreSQL persistence with Row-Level Security (RLS)
* **Search**: Pagefind static search sidecar

## Scripts

```bash
# Development server (Turbopack)
npm run dev

# Production build
npm run build:next

# Full production build with search index
npm run build

# Linting & Typecheck
npm run lint
npx tsc --noEmit

# Security vulnerability audit
npm audit
```

## Environment Variables

Configure `.env.local` for local development or set in Vercel project settings:

```env
# Canonical deployment domain (used for sitemap, canonical links, and OG cards)
NEXT_PUBLIC_SITE_URL=https://neoex.dev

# Supabase (Store as Source)
NEXT_PUBLIC_SUPABASE_URL=https://aitqswnbtpexrxqpoiwo.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

## Structure

* `app/[lang]/` — Multilingual public pages (`/`, `/archive`, `/articles/[fileNum]`, `/photos`, `/fiction/[slug]`)
* `app/console/` — Authenticated curation and editor console
* `app/robots.ts` & `app/sitemap.ts` — Dynamic SEO routes
* `app/opengraph-image.tsx` — Dynamic aesthetic OpenGraph preview card
* `components/` — Modular UI components and Three.js instruments
* `lib/` — Cartography calculations, store access layer, theme state, and utilities
