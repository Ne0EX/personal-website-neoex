# Worldline — Tech Proposal

> Status: Draft v0.1 — 2026.05.10
> Companion to: `worldline-feature-brainstorm.md`
> Baseline: `package.json` at HEAD (Next 16.2.6, React 19.2.4, animejs 4.4.1, three 0.184.0)

---

## 0 · Current stack inventory

What's already installed and what role it plays:

| Package | Version | Role in Worldline |
|---|---|---|
| `next` | 16.2.6 | App framework, App Router, file-based routing |
| `react`, `react-dom` | 19.2.4 | UI runtime |
| `animejs` | 4.4.1 | Boot sequence, divergence reroll, hero stagger, entry-card reveals |
| `three` | 0.184.0 | ATLAS globe geometry, paper texture procgen, instrument scene graph |
| `@react-three/fiber` | 9.6.1 | (Installed but ATLAS uses raw Three. Currently unused.) |
| `@react-three/drei` | 10.7.7 | (Installed but currently unused.) |
| `simplex-noise` | 4.0.3 | Procedural surface texture, contour generation in `lib/cartography.ts` |
| `tailwindcss` | 4.x | Styling. Custom design tokens live in `globals.css` |
| `next/font/google` | (built-in) | Cormorant Garamond, JetBrains Mono, Special Elite |

What's notably absent — driving everything below:

- **No content layer.** `RECENT_ENTRIES` is hand-written in TypeScript. Won't scale past ~10 entries; can't accept MDX bodies.
- **No markdown rendering pipeline.** No `remark`, `rehype`, no syntax highlighter.
- **No data fetching / API client layer.** Nothing to hit GitHub, Letterboxd, AniList with.
- **No state management beyond `useState`.** Survives current scope; will strain when chat + per-visit drift + audience fork land.
- **No image handling for photo collections.** Beyond `next/image`, nothing for galleries / EXIF / lightbox.
- **No search.**
- **No feed generation.**
- **No AI SDK.** NETRA chat needs one.

> **Next 16 caveat:** the repo's `AGENTS.md` flags that Next 16 has breaking changes from prior versions — APIs, conventions, file structure. Recommendations below are framework-correct in pattern (route handlers, server components, static generation), but the *exact* API surface (e.g., whether a particular hook still exists, the precise signature of a route handler) should be verified against `node_modules/next/dist/docs/` before each implementation. Treat library choices below as confident; treat Next 16 integration code as draft until verified.

---

## 1 · Gap analysis by tier

| Tier | Feature | Missing capability | Solved by |
|---|---|---|---|
| 1 | Articles, photos, fiction entries | Content authoring + type-safe collections | velite |
| 1 | Articles | Markdown → React + syntax highlighting | velite (pipeline) + shiki |
| 1 | Photo journal | EXIF parsing (incl. GPS) | exifr |
| 1 | GitHub-coupled writeups | GitHub API client, build-time data fetch | @octokit/rest |
| 2 | Audience fork | Persistent client choice across routes | (zustand or session storage) |
| 3 | Triangulate search | Static search index | pagefind |
| 3 | Now page | Date / time formatting | date-fns |
| 3 | RSS / Atom feeds | Feed XML generation | feed |
| 3 | Photo viewer | Accessible lightbox with keyboard nav | yet-another-react-lightbox |
| 4 | NETRA chat | LLM SDK + Anthropic provider + streaming | ai + @ai-sdk/anthropic |
| 4 | NETRA chat | Server-side rate limiting | (in-memory map → upstash later) |
| 5 | Per-visit drift, anchors | Persisted client state | zustand (with persist middleware) |
| 5 | Worldline weather | Date math + activity windowing | date-fns |

---

## 2 · Recommended additions

Each entry: what it does, why this pick, alternatives considered.

### 2.1 Content layer — `velite`

Type-safe MDX/markdown content collections for Next.js. Replaces hand-written arrays in `lib/entries.ts`.

- **Why this pick:** zod-validated frontmatter, multiple collections (articles + photos + fiction + repos), MDX support, fast incremental builds, actively maintained (post-contentlayer era).
- **Alternatives considered:**
  - `next-mdx-remote` — flexible, RSC-compatible, but you build the collection layer yourself.
  - `@next/mdx` — official, file-as-route, but no collections.
  - Plain markdown + `gray-matter` + `remark` — most control, most boilerplate.
  - `fumadocs-mdx` — strong, but oriented toward documentation sites.
- **Verdict:** velite fits the multi-shape garden best and saves writing a content infrastructure layer.

### 2.2 Markdown rendering pipeline — `shiki` + `rehype-pretty-code`

Code highlighting for articles and writeups. velite supports rehype plugins out of the box.

- `shiki` — themed by VS Code grammars, RSC-compatible (no client-side bundle), supports light/dark.
- `rehype-pretty-code` — wraps shiki with quality-of-life features (line numbers, line highlighting, diff annotations).

### 2.3 EXIF parsing — `exifr`

Extracts EXIF + GPS + IPTC from JPEG/HEIC at build time.

- **Why:** comprehensive, no dependencies, handles X-E5's GPS embedding, supports thumbnail extraction.
- **Alternative:** `exif-js` (older, abandoned), `sharp` metadata (less complete on EXIF-specific tags).

### 2.4 GitHub API — `@octokit/rest`

Pulls live repo metadata at build time (or via on-demand revalidation).

- Use ISR or scheduled revalidation; don't fetch on every request.
- Set up a Personal Access Token (read-only, public_repo scope) in env vars.

### 2.5 NETRA chat — Vercel `ai` SDK + `@ai-sdk/anthropic`

Streaming chat against Anthropic's API. Handles tool calls, structured output, streaming UI.

- **Why this pick:** maintained by Vercel, first-class Next.js streaming support, official Anthropic provider, model-agnostic if you switch.
- **Alternative:** raw `@anthropic-ai/sdk` — fewer abstractions, more wiring to do for streaming UI.
- **Note:** verify against latest `ai` SDK release that React 19 + Next 16 are both supported. Likely yes (Vercel maintains aggressively) but confirm before pinning.

### 2.6 State management — `zustand`

Lightweight global state for: per-visit drift counter, anchor list, audience-fork choice, NETRA chat history.

- **Why:** ~3kb, no provider boilerplate, persist middleware for localStorage. Already a transitive dep via `@react-three/fiber`.
- **Alternatives:** `jotai` (atom-based, equally good), React Context (verbose at this scale).

### 2.7 Static search — `pagefind`

Builds a search index from generated HTML at build time. Runs entirely client-side.

- **Why:** zero infrastructure, ~100kb runtime, sub-50ms search on small corpora, faceted search built in (filter by tag, type, year).
- **Alternative:** `fuse.js` (client-side fuzzy, but you build index yourself); Algolia (overkill, costs money).

### 2.8 RSS generation — `feed`

Generates RSS, Atom, and JSON Feed from the same source.

- Add a build-time route or static export route that runs through velite collections and emits `/feed.xml`, `/feed.atom`, `/feed.json`.

### 2.9 Date handling — `date-fns`

Tree-shakeable date utilities for Now page, patch logs, "days since" microcopy.

- **Alternative:** `dayjs` (smaller, but less complete). `date-fns` integrates better with TypeScript.

### 2.10 Photo lightbox — `yet-another-react-lightbox`

Keyboard-navigable, accessible, themable photo viewer.

- **Why this pick:** maintained, supports captions / EXIF panels / zoom, no jQuery legacy.
- **Alternative:** PhotoSwipe (good but heavier integration), custom build (significant work).

---

## 3 · Installation summary

```bash
# Content layer
npm install velite zod

# Markdown pipeline
npm install shiki rehype-pretty-code

# Photos
npm install exifr yet-another-react-lightbox

# GitHub
npm install @octokit/rest

# NETRA chat
npm install ai @ai-sdk/anthropic

# State
npm install zustand

# Feeds + dates
npm install feed date-fns

# Search — installed as a dev tool, runs at build
npm install -D pagefind
```

Total: ~12 new runtime deps, ~1 dev dep. Bundle impact:

- velite, exifr, octokit, feed, date-fns: build-time only or tree-shaken; minimal runtime cost.
- shiki: server-only when used through rehype-pretty-code; zero client bundle.
- ai SDK: chat route only; lazy-loaded.
- zustand: ~3kb.
- yet-another-react-lightbox: ~30kb, lazy-load via dynamic import on photo pages only.
- Pagefind runtime: ~100kb, lazy-load behind `/` hotkey.

---

## 4 · Architecture changes

### 4.1 Content folder layout

```
content/
  articles/
    003-architecture-of-taste.mdx
    002-why-i-paused-the-startup.mdx
    ...
  photos/
    2026-04-chiang-mai/
      _meta.yml          # roll metadata
      DSCF0001.jpg       # original from X-E5
      DSCF0002.jpg
      ...
  fiction/
    transmissions/
      001-the-quiet-room.mdx
      ...
  repos/
    worldline.mdx        # writeup; pulls live data via octokit
    ...
```

velite config defines four collections (articles / photos / fiction / repos). Each collection has a zod schema for frontmatter validation. Build runs EXIF extraction over `content/photos/**` and writes derived metadata to a generated `.velite` cache.

### 4.2 Public asset layout for photos

X-E5 photos go through a build-step pipeline:

1. Source images live in `content/photos/<roll>/` (gitignored, or git-lfs if you want history).
2. Build step extracts EXIF via `exifr`.
3. Build step generates resized variants (thumb 320px, medium 1280px, full 2400px) via `sharp` (already a transitive Next.js dep).
4. Variants written to `public/photos/<roll>/<base>-{thumb,med,full}.{jpg,webp,avif}`.
5. velite emits typed photo records consumed by ATLAS pin layer + photo journal pages.

### 4.3 Route additions

| Route | Type | Purpose |
|---|---|---|
| `/articles/[slug]` | static | Article entry pages |
| `/photos` | static | Photo journal index (rolls) |
| `/photos/[roll]/[id]` | static | Single photo entry |
| `/fiction/[slug]` | static | Fiction entry pages |
| `/repos/[name]` | static, ISR | Repo writeup with live GitHub data |
| `/timeline` | static | Worldline timeline view |
| `/now` | static, revalidate hourly | Now page |
| `/colophon` | static | Site colophon |
| `/anchored` | client only | Reader's anchored entries (localStorage) |
| `/feed.xml` | static export | Site-wide RSS |
| `/photos.xml`, `/fiction.xml`, `/articles.xml` | static export | Per-section feeds |
| `/api/chat` | route handler | NETRA chat streaming endpoint |

### 4.4 API routes / route handlers

Only one server endpoint required for phase 1: `POST /api/chat`.

- Accepts `{ messages: Array<{role, content}> }`.
- Streams Anthropic response via `ai` SDK.
- Rate limits per session (50/day) via in-memory map keyed on a session cookie. Promote to Upstash Redis when traffic justifies.
- Tool calls available to the model: `searchEntries(query)`, `getEntryByFileNum(num)`, `listRecentPatches()`. These read from the velite-generated content cache.

D-mail (egg §6.3) needs a tiny additional endpoint later — `POST /api/dmail` writing to a moderated pool. Defer.

---

## 5 · Build phases (mapped to additions)

| Phase | PRD | Ships | New deps |
|---|---|---|---|
| Phase A | 01 | Entry pages (article, photo, fiction templates) | velite, zod, shiki, rehype-pretty-code, exifr, date-fns |
| Phase B | 02 | Audience fork | zustand |
| Phase C | 03 | Photo + ATLAS integration | yet-another-react-lightbox, sharp pipeline scripts |
| Phase D | 04 | Triangulate search + RSS | pagefind, feed |
| Phase E | 05 | NETRA chat (grounded) | ai, @ai-sdk/anthropic |
| Phase F (later) | — | GitHub coupling | @octokit/rest |
| Phase G (later) | — | Tier 5 light mechanics | (no new deps; zustand already in) |
| Phase H (later) | — | Tier 6 easter eggs | (none) |

---

## 6 · Open technical decisions

- **velite vs custom MDX layer.** Recommendation stands. Re-evaluate if velite's collection model fights the Next 16 RSC streaming model. Fallback: `next-mdx-remote` + a hand-rolled type layer.
- **Photo storage at scale.** `public/photos/` is fine for the first ~500 photos. Plan migration path to R2/S3 + CDN; velite supports remote loaders.
- **Chat session model.** Sessions keyed on cookie ID. Anonymous, no login. Revisit if D-mail or anchors graduate to require account state.
- **Search index re-build cadence.** Pagefind runs as a `postbuild` script. Acceptable; no external infra. Revisit if entries cross 1000 (still fast at 1000+, but build time matters).
- **EXIF privacy.** GPS in EXIF will reveal locations. Default behavior should be: GPS coordinates are *only* surfaced for photos explicitly tagged `share-location: true` in frontmatter. Default is to strip GPS from publicly-served metadata.

---

*End of document. See `prds/` for per-feature requirements.*
