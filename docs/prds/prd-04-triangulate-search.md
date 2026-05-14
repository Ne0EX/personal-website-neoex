# PRD 04 — Triangulate Search & RSS Feeds

> Status: Draft v0.1 — 2026.05.10
> Phase: D
> Companion: `worldline-feature-brainstorm.md` §3.2, §3.5
> Tech: pagefind, feed

---

## Goal

Make the garden discoverable. Two distinct surfaces: live in-site search (reframed as a "triangulate" survey instrument matching the cartographer aesthetic), and feed-reader subscriptions (RSS / Atom / JSON Feed) so the digital-garden audience can follow without visiting.

## User stories

- **As a return visitor**, I want to hit `/` from anywhere and search across all entries, photos, fiction, and repos by keyword.
- **As a visitor exploring an attractor field**, I want search to feel like the rest of the site — survey instrument language, coordinate readouts, ATLAS framing — not a generic search bar pasted in.
- **As a feed reader user**, I want to subscribe to Worldline updates without visiting; just like any other digital garden or blog.
- **As a feed reader user with niche interests**, I want per-section feeds (only photos, only fiction, only articles) so I can follow what I actually care about.

## Scope

### In scope

- Static search index built at build time via Pagefind.
- `/` hotkey opens search overlay from anywhere on the site.
- Search overlay UI matching ATLAS instrument aesthetic.
- Search results render in two views simultaneously: list + ATLAS mini-globe pins.
- Each result shows: title, type (article / photo / fiction / repo), date, attractor field tags, drift distance from α (Bangkok).
- Feed generation at build time:
  - `/feed.xml` (all content, RSS 2.0)
  - `/feed.atom` (all content, Atom)
  - `/feed.json` (all content, JSON Feed 1.1)
  - `/articles.xml`, `/photos.xml`, `/fiction.xml` (per-section RSS)
- Feed link discovery via `<link rel="alternate" type="application/rss+xml">` in document head.
- "Subscribe" affordance in footer (already scaffolded — make it real).

### Out of scope

- Server-side search (no API endpoint needed).
- Faceted UI for tag-filter combinations within search (Pagefind supports it but defer).
- Personalized search ranking based on visitor history.
- Email-based subscription / newsletter.
- Webmentions, ActivityPub federation (potential future garden-citizenship features).

## Functional requirements

### Search overlay

Trigger:
- `/` keypress when not focused on an input element.
- Click on a search affordance in nav (small ⌕ glyph + keyboard hint).
- ESC closes; click outside closes.

Layout:

```
┌────────────────────────────────────────────────────────────────┐
│  [⌕] TRIANGULATE                                       [ESC]   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  search query...                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  filters: [ all ]  [ articles ]  [ photos ]  [ fiction ]       │
│                                                                 │
│  ─── RESULTS ──────────────────────  ─── COORDINATES ────────  │
│  003 · 2026.05.07                     ╭───────────────╮        │
│  on the architecture of taste         │   .    .   ·  │        │
│  → 35.01°N · 135.77°E · drift 4.2k    │ ·   *   .     │        │
│                                       │    ·    ·     │        │
│  001 · 2026.04.28                     │  *      .   . │        │
│  the four pours adaptation            ╰───────────────╯        │
│  → 6.16°N · 38.21°E · drift 7.8k         (mini-globe with      │
│                                            result pins)        │
│  ...                                                            │
│                                                                 │
│  ↑↓ navigate · ↵ open · ⇥ filter · ESC close                   │
└────────────────────────────────────────────────────────────────┘
```

Behavior:
- Search updates results live as you type (debounce 120ms).
- Results panel and mini-globe are linked: hovering a result highlights its pin; hovering a pin highlights its result.
- "Drift" shown for each result is great-circle distance from observer locus α (Bangkok 13.7563°N, 100.5018°E) in km.
- Empty query state shows "recent" + "popular" placeholder copy ("nothing surveyed yet — type to triangulate").

Implementation:
- Pagefind generates `/_pagefind/` index after build.
- Lazy-load the Pagefind client only when search is opened (saves ~100kb on initial load).
- Mini-globe uses a lightweight orthographic projection — does not need full Three.js scene; SVG is fine here.

### Feed generation

A `scripts/generate-feeds.ts` runs as part of `npm run build`:

1. Reads velite-generated content cache.
2. Generates RSS 2.0, Atom 1.0, and JSON Feed 1.1 outputs for "all content" + per-section.
3. Writes outputs to `public/feed.xml`, `public/feed.atom`, `public/feed.json`, plus `public/{articles,photos,fiction}.xml`.

Content per feed entry:
- Title, GUID, publication date, last modified date.
- Excerpt: `summary` from frontmatter, capped at 160 chars.
- Permalink to entry page on the site.
- For photos: include thumbnail-medium variant URL as enclosure. EXIF readout in description.
- For fiction: full body included (people read fiction in feed readers).
- For articles: excerpt only — full content requires a click. (Standard convention; respects copyright + drives traffic to the actual reading surface.)

### Feed discovery

In `app/layout.tsx` (or appropriate `<Head>` location):

```html
<link rel="alternate" type="application/rss+xml" title="Worldline · all" href="/feed.xml" />
<link rel="alternate" type="application/atom+xml" title="Worldline · all" href="/feed.atom" />
<link rel="alternate" type="application/feed+json" title="Worldline · all" href="/feed.json" />
<link rel="alternate" type="application/rss+xml" title="Worldline · articles" href="/articles.xml" />
<link rel="alternate" type="application/rss+xml" title="Worldline · photos" href="/photos.xml" />
<link rel="alternate" type="application/rss+xml" title="Worldline · fiction" href="/fiction.xml" />
```

### Footer subscribe affordance

Currently `FooterManifesto.tsx` has a placeholder `rss / atom` link. Replace with real link to `/feeds` — a small page listing all feed URLs with subscribe-button copy. Keeps the footer link compact while letting people pick their format.

## Acceptance criteria

- [ ] Pagefind builds an index covering all entry types and runs `postbuild` after `npm run build`.
- [ ] `/` hotkey opens overlay from any page; ESC closes.
- [ ] Empty query state renders correctly; typing produces results within 200ms on a typical corpus.
- [ ] Result list and mini-globe pins are bidirectionally linked on hover.
- [ ] Drift calculation is correct for known coordinates (smoke test against known distances).
- [ ] Filter pills toggle correctly; "all" is the default.
- [ ] Mobile (≤600px) layout collapses mini-globe below the result list.
- [ ] Feed XML validates against RSS 2.0 / Atom 1.0 specs (run through W3C feed validator).
- [ ] Per-section feeds contain only items of that type.
- [ ] Feed discovery `<link>` tags are present and correct.
- [ ] Photo feed includes thumbnail enclosures.
- [ ] Fiction feed includes full body, articles feed includes excerpt only.

## Dependencies

- pagefind (build-only)
- feed (RSS/Atom/JSON Feed generation)

## Open questions

- **Search index includes private content?** Drafts (`status: 'seed'`) — surface in search or hide? Recommend surface seeds with a visual seed-stage indicator. They're public on the site already; consistent treatment.
- **Mini-globe in search.** SVG orthographic vs Three.js mini-instance. Recommend SVG — instant render, no scene-graph cost, fits the cartographer aesthetic.
- **Feed length cap.** RSS feeds typically cap at 20-50 most recent items. Recommend 30 for "all" feed, 20 for per-section. Configurable via env.
- **Photo feed format.** Some readers handle media enclosures well, some don't. Recommend always including a thumbnail; full-resolution links to the entry page.
- **Stable GUIDs.** GUID strategy for feed items — use the entry's permalink URL. Survives renames if you preserve URL slugs (which you should anyway).
- **Webmentions / Atom-style discoverability.** Phase 2 garden-citizenship feature. Defer.

---

*End of PRD.*
