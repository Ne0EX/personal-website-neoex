# /archive Route · Consolidated Spec · v2.0
# ARCHIVE ROUTE + MINI-GLOBE ATOM + TRIANGULATE COEXISTENCE

> author · Betelgeuse (α-VIS-04)
> date · 2026-06-01
> status · BUILD-READY · supersedes the conflicting sections identified below
> supersedes (scope-limited) · docs/design/20-archive.md §3 Nav wiring only (the VISION-2026-05-31 Π1 "overlay subsumes /archive" pivot is hereby overridden — see §0)
> supersedes · Nav.tsx `archiveLink: true` / `triangulate:open` dispatch (VISION §1.1 Π1 route decision is reversed)
> all other content in 20-archive.md remains canonical and is imported by reference
> design authority · this doc + 20-archive.md together constitute the full ARCHIVE spec

---

## §0 — override declaration

**VISION-2026-05-31 §1.1 Π1 stated:** "ARCHIVE nav link opens Triangulate Search overlay."
**Peat directive 2026-06-01 reverses Π1:** `/archive` is a real route. `◇ ARCHIVE` in the nav navigates to `/archive`. The Triangulate overlay coexists. Its opening affordance is the `/` hotkey (global, unchanged) and an optional search affordance anywhere on the page.

**What this changes:**

| item | was | now |
|---|---|---|
| `Nav.tsx` ARCHIVE item | `archiveLink: true` → `triangulate:open` event dispatch | `href="/archive"` · standard `<a>` link |
| `/` hotkey trigger | opens overlay from anywhere | unchanged — still opens overlay from anywhere, including from inside `/archive` |
| Triangulate spec `docs/design/14-triangulate-search.md` | unchanged — the overlay is still the fast-find layer | unchanged — no edits needed |
| `/archive` route | planned but deprioritized by Π1 | **this spec — build it** |

**What does not change:**

- Triangulate Search overlay design spec (14-triangulate-search.md) is fully intact
- The overlay's mini-globe (standby variant, 348×348) is unchanged
- The overlay's sort = TIME only lock is unchanged
- Every other VISION §1.1 decision not touching Π1 route-vs-overlay is unchanged
- All of 20-archive.md §1–§2 intent + approach remains canonical

---

## §1 — intent (extends 20-archive.md §1, do not repeat it)

ARCHIVE is the ledger half of the Worldline body. The Globe is spatial;
ARCHIVE is temporal and typological. Three things the route adds that the
overlay cannot provide:

1. **Addressability.** `/archive?type=photo&domain=japan` is a real URL. It
   can be bookmarked, shared, crawled, and indexed by pagefind. The overlay is
   ephemeral — it evaporates on ESC.
2. **Browsability.** The ledger is a surveyed inventory arranged chronologically
   by year. The visitor can read it top to bottom, dwell on rows, come back via
   browser back, and navigate prev/next across the corpus without managing an
   overlay. The overlay is optimized for retrieval (known title / tag / place);
   the route is optimized for discovery (I do not know what I am looking for yet).
3. **Crawlability.** pagefind can index `/archive` as a route. The overlay is
   JS-only — pagefind sees no body content in an overlay. The route gives the
   archive a static HTML shell that the sidecar injector (`inject-pagefind-sidecar.ts`)
   can reach without intervention.

Neither surface subsumes the other. They are complementary instruments.

---

## §2 — route + overlay coexistence contract

| surface | purpose | trigger | persistence | indexable |
|---|---|---|---|---|
| `/archive` route | durable browse ledger — scan, filter, bookmark, deep-link | `◇ ARCHIVE` nav link (real `<a href="/archive">`) | permanent URL; browser history; pagefind-indexed | yes — static HTML sidecar |
| Triangulate overlay | ephemeral fast-find — known-title retrieval, real-time query | `/` hotkey (global) + optional `[ ⌕ survey ]` affordance | survives until ESC; no URL; no browser back | no — JS-only |

**Duplication rule:** the route and the overlay do NOT show the same affordances.

- Route has: filter rail, year grouping, sort choices, mini-globe companion, pagination
- Overlay has: real-time query bar, pagefind full-text search, TIME-only sort (Peat mandate), chat-instrument register
- Route does NOT have: a query input, pagefind search bar, or real-time result streaming
- Overlay does NOT have: URL state, year grouping, or a "load next 20" affordance

**Nav wiring (concrete change to Nav.tsx):**

The `archiveLink: true` flag and `triangulate:open` event dispatch are removed.
ARCHIVE becomes a standard nav link:

```
{ label: "ARCHIVE", href: "/archive", active: false, archiveLink: false }
```

The active state (text color `var(--accent-orange)`) fires when the current
route is `/archive` — Sirius implements this with Next.js `usePathname()`.

---

## §3 — /archive route — static-renderability + pagefind constraint

**The problem:** `app/layout.tsx` wraps the page tree in `PageShell`
(`'use client'`). PageShell initialises from sessionStorage and renders an
empty loading div during SSR. Content that lives inside `PageShell` as a client
component does NOT produce static HTML — pagefind's crawler sees no body.

**The fix already exists:** `scripts/inject-pagefind-sidecar.ts` injects a
visually-hidden `data-pagefind-body` div into `.next/server/app/**/*.html` at
build time, before the pagefind crawl runs. This pattern already handles
article and fiction pages.

**What Sirius must do for `/archive`:**

`app/archive/page.tsx` MUST be an **RSC (React Server Component)** at the
route-segment level. It fetches all entries via `getArchiveEntries()` (Procyon
data helper — see §7) and passes them as serialized props to the client
component tree.

The page MUST emit a static HTML `<main data-pagefind-body>` element that
contains at minimum:

```html
<main data-pagefind-body
      data-pagefind-meta="title:ARCHIVE LEDGER,type:archive"
      data-pagefind-ignore="nav header footer .archive-filters .archive-mini-globe">
  <!-- minimal indexable content — not user-visible but parseable by pagefind -->
  <span data-pagefind-weight="5">ARCHIVE LEDGER</span>
  <!-- entry title spans injected by the sidecar script per entry -->
</main>
```

The sidecar script (`inject-pagefind-sidecar.ts`) already handles this pattern
for article routes. Procyon (α-IDX-03) must extend `inject-pagefind-sidecar.ts`
to also read the archive entry list and inject title/tag spans for each entry
into the `/archive` HTML shell.

**SSR/RSC split:**

```
app/archive/
  page.tsx          ← RSC. Calls getArchiveEntries(). Renders static <main data-pagefind-body>.
                       Passes serialized entries[] to ArchiveLedger as props.
  loading.tsx       ← optional skeleton — not strictly required for v1
  layout.tsx        ← none (inherits root layout)

components/
  ArchiveLedger.tsx         ← 'use client'. Filter state (useSearchParams + useRouter). Renders rows.
  ArchiveFilters.tsx        ← 'use client'. Filter chips. Reads/writes URL params.
  ArchiveMiniGlobe.tsx      ← 'use client'. Thin wrapper that picks ThreeJS vs Canvas2D.
  ArchiveMiniGlobeThreeJS.tsx  ← 'use client'. Three.js sphere. See §5 (mini-globe atom).
  ArchiveMiniGlobeCanvas2D.tsx ← 'use client'. Fallback Canvas 2D. See §5.
```

The `page.tsx` RSC boundary is load-bearing. If `page.tsx` is marked `'use client'`,
pagefind will not see the entry titles in static HTML. **Sirius: do not add
`'use client'` to `app/archive/page.tsx`.**

---

## §4 — layout (canonical desktop ≥1181px)

Full layout specification lives in 20-archive.md §4. Reproduced here with
one addition: the Nav strip `◇ ARCHIVE` link is **active** (text
`var(--accent-orange)`) when the current route is `/archive`.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ scroll-meter (2px top · var(--accent-orange) fill · fixed)                   │
├──────────────────────────────────────────────────────────────────────────────┤
│ NAV (◇ INDEX · ◇ TRACES · ◇ ARCHIVE [active=orange] · ◇ TRANSMIT)          │
├──────────────────────────────────────────────────────────────────────────────┤
│ .archive-head (header strip · .paper-canvas surface)                         │
│  OBSERVATORY · ARCHIVE LEDGER · NN ENTRIES SURVEYED · NN PATCHES             │
│  ∇ Ne0EX · DRIFT MIN +0.00 · DRIFT MAX –2.40 · α 1.130426                   │
│  [ ◯ ATLAS ]                                          NAV STANDBY            │
│  ─ ─ ─ ─ ─ ─ (1px dashed var(--ink-dashed)) ─ ─ ─ ─ ─ ─ ─ ─ ─ ─           │
│                                          [ ⌕ survey ] (optional affordance)  │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────┬──────────────────────────────┐ │
│  │ LEDGER · left ~66% · max 840px           │ RIGHT RAIL · 360px · sticky  │ │
│  │                                          │                              │ │
│  │ § 01 · YEAR — 2026                       │ ┌──────────────────────────┐ │ │
│  │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │ │  MINI-GLOBE ATOM         │ │ │
│  │                                          │ │  .wl-mini-globe          │ │ │
│  │ FILE — 003 · 2026.04.12 · REFINED · 8M  │ │  300×300 · Three.js      │ │ │
│  │   on the architecture of taste           │ │  · = ◯ article           │ │ │
│  │   coffee · method · narrative            │ │  · = ■ photo             │ │ │
│  │   LOCUS 13.76°N 100.50°E · DRIFT –0.04  │ │  · = ◆ fiction           │ │ │
│  │   ◯ article                              │ │  in-memb: accent-orange  │ │ │
│  │   ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─     │ │  out-memb: ink-faint 0.3 │ │ │
│  │                                          │ └──────────────────────────┘ │ │
│  │ FILE — 002 · 2026.04.08 · ONGOING · 12M │  NN OF NN LOCI VISIBLE       │ │
│  │   ...                                    │                              │ │
│  │                                          │ § FILTER                     │ │
│  │ § 02 · YEAR — 2025                       │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │ │
│  │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │ TYPE  [ALL] [art] [pho] [fi] │ │
│  │  ...                                     │ STATUS [seed] [ongoing] ...  │ │
│  │                                          │ DOMAIN [coffee] [method] ... │ │
│  │ [ LOAD NEXT 20 ] (only if entries > 60)  │ YEAR   [2026] [2025] ...     │ │
│  └──────────────────────────────────────────┘ SORT   ↓ recently patched   │ │
│                                               │       chronological        │ │
│                                               │       drift · file number  │ │
│                                               └──────────────────────────────┘ │
│ marginalia HUD (28px right-edge · .marginalia · mono vertical)               │
└──────────────────────────────────────────────────────────────────────────────┘
```

The `[ ⌕ survey ]` affordance in the header strip is OPTIONAL for v1. If
included, it dispatches `triangulate:open` (same event as the `/` hotkey).
It is a secondary affordance — it is not a search input. It is a mono 9px
link: `var(--ink-soft)` default → `var(--accent-orange)` hover, 150ms ease.
It does NOT replace or duplicate the filter rail.

---

## §5 — mini-globe atom (extracted contract)

This section defines the `<MiniGlobe>` atom that is consumed by BOTH:
- `/archive` right-rail (`ArchiveMiniGlobeThreeJS.tsx` / `ArchiveMiniGlobeCanvas2D.tsx`)
- Triangulate overlay (`components/TriangulateSearch.tsx` lines 400–479, currently `MiniGlobeStub` 2D placeholder)

### §5.1 — atom identity

| field | value |
|---|---|
| soul-atom id | `mini-globe` |
| parent atom | `globe` (atom: `worldline-atoms.css` `.wl-globe-wrap`) |
| impl_ref | `components/WorldlineGlobe.tsx` (extract, do not re-derive) |
| variants | `standby-archive` (300×300, /archive) · `standby-tri` (348×348, overlay) |
| compose-from | `THREE.SphereGeometry` + `MeshLambertMaterial` — same material system as ATLAS · Rule 5 compliance |

### §5.2 — what the atom renders (both variants)

A Three.js sphere at standby scale. In render order:

1. **Globe body** — `MeshLambertMaterial` · paper surface color · matte, no specular
2. **Graticule wireframe** — second `SphereGeometry` as wireframe · ink-faint lines
3. **Coastline texture** — same procedural or texture approach as ATLAS · multiply at 0.28 over paper surface (implementation detail for Sirius — match WorldlineGlobe.tsx)
4. **Entry pins** — `THREE.Points` BufferGeometry · one point per public-locus entry
5. **α node** — dedicated point sprite · accent-orange · no distinct size increase at standby scale (see §5.3 HARD lock divergence row)

### §5.3 — HARD lock values (must match WorldlineGlobe.tsx — drift guard)

Sirius: add a comment block in each mini-globe component citing this contract.

| attribute | value | token source |
|---|---|---|
| globe surface color | `var(--paper-base)` hex `#E8E2D5` (TEAL) | `app/globals.css --paper-base` |
| graticule / wireframe color | `var(--ink-faint)` = `rgb(31 80 99 / 0.3)` | `app/globals.css --ink-faint` |
| in-membership pin color | `var(--accent-orange)` hex `#D4602A` | `app/globals.css --accent-orange` |
| out-of-membership pin color | `rgb(31 80 99 / 0.32)` (ink-faint at 0.32) | binding mechanic §3.3 — 20-archive.md §5.3 |
| material shading | `MeshLambertMaterial` (matte, no specular) | ATLAS contract |
| ambient light color | `#F0EBDD` (≈ `--paper-bright`) | ATLAS ambient match |
| directional light angle | above-right (ATLAS directional vector) | ATLAS light match |
| idle auto-rotate speed | 60s per full revolution (Y-axis) | ATLAS idle-drift timing |

### §5.4 — allowed divergences from ATLAS (both variants)

| attribute | atom value | ATLAS value | why |
|---|---|---|---|
| geometry resolution | 24×24 segments | higher resolution | 300–348px does not need ATLAS fidelity; lighter GPU |
| pin detail | `THREE.Points` sprites only — no label, no orbit ring, no pulse | full marker with label, ring, pulse | illegible at this scale; too busy |
| journey-line overlay | omit entirely | polyline arcs | too dense at standby scale |
| instrument frame | none (no `.frame-head`, no corner reticles around canvas) | full frame | the mini-globe IS the instrument; frame-within-frame = over-chrome |
| orbit controls | none (no free-drag, no zoom) | full orbit controls | two interactions only (see §5.6) |
| α pin special treatment | same visual as other in-membership pins | distinctly larger, labeled | crowding at standby scale |

### §5.5 — variant dimensions

| variant id | canvas size | used by | column |
|---|---|---|---|
| `standby-archive` | 300×300px | `/archive` right-rail | sticky rail at desktop; centered at 600–880px |
| `standby-tri` | 348×348px | Triangulate overlay | overlay right column (380px fixed) |

Both variants use the same component (`ArchiveMiniGlobeThreeJS.tsx` / `Canvas2D`).
The size is passed as a `size` prop: `size={300}` or `size={348}`.

### §5.6 — props contract (interface for Sirius)

```ts
// components/ArchiveMiniGlobe.tsx (wrapper — picks ThreeJS vs Canvas2D)
// components/ArchiveMiniGlobeThreeJS.tsx
// components/ArchiveMiniGlobeCanvas2D.tsx

interface MiniGlobeProps {
  /**
   * Canvas edge length in px. Both width and height.
   * Archive right-rail: 300. Triangulate overlay: 348.
   */
  size: 300 | 348;

  /**
   * All public-locus entries to render as pins.
   * ONLY entries where shareLocation===true and coords are non-null.
   * Privacy gate applied by getArchiveEntries() BEFORE this prop —
   * the component does not re-gate.
   */
  pins: MiniGlobePin[];

  /**
   * Subset of pins currently "in membership" per active filter state.
   * in-membership → accent-orange. out-of-membership → ink-faint at 0.32.
   * When no filter is active, activePins === pins (all in-membership).
   */
  activePins: MiniGlobePin[];

  /**
   * Bidirectional hover sync (Triangulate overlay variant + archive rows).
   * When defined: hovering a result row sets hoveredEntryId;
   * hovering a globe pin scrolls the result list and sets hoveredEntryId.
   * Archive route: optional (may be omitted for v1 — see §5.8).
   * Triangulate overlay: REQUIRED per 14-triangulate-search.md hover sync §.
   */
  hoveredEntryId?: string | null;
  onPinHover?: (entryId: string | null) => void;

  /**
   * Called when a visible node-marker is clicked.
   * Component calls this; caller handles navigation.
   * Signature: (pin: MiniGlobePin) => void
   */
  onPinClick: (pin: MiniGlobePin) => void;

  /**
   * Called when empty globe surface (no marker under cursor) is clicked.
   * Archive: navigate to '/' (ATLAS). Overlay: navigate to '/' + close overlay.
   */
  onGlobeClick: () => void;
}

interface MiniGlobePin {
  /** Unique stable id. articles: fileNum. photos: '<roll>/<id>'. fiction: slug. */
  id: string;
  kind: 'article' | 'photo' | 'fiction';
  lat: number;
  lon: number;
  /** Entry route for onPinClick navigation. */
  route: string;
}
```

### §5.7 — privacy gate (HARD contract)

No change from 20-archive.md §5.5. Restated for component boundary clarity:

**Only entries where `shareLocation === true` AND `coords` is non-null are passed
as `pins` props.** The gate lives at `getArchiveEntries()` (Procyon) and at the
`pins` prop preparation in `page.tsx` / overlay open handler. The component itself
performs no privacy logic — it renders what it receives.

Caption beneath canvas (both variants):
`NN OF NN LOCI VISIBLE` — `.t-mono` 8px `var(--ink-soft)` centered. Rendered by
the component. `NN` = `activePins.filter(p => coords).length` /
`pins.length`.

### §5.8 — bidirectional hover sync

**Triangulate overlay (REQUIRED):** `hoveredEntryId` + `onPinHover` props
are wired bidirectionally per 14-triangulate-search.md §tri-panel mini-globe.
120ms ease color transition. Result row hover → pin accent-orange ring.
Pin hover → result list scrolls into view + active left border.

**Archive route (v1: unidirectional only):** filter changes re-color pins
(in/out-of-membership via `activePins` prop). Hover sync row↔pin is
deferred to v1.1. v1 ships with `onPinHover` and `hoveredEntryId` undefined
(the prop interface supports them for future wiring without a breaking change).

### §5.9 — no-WebGL fallback (Canvas 2D)

`ArchiveMiniGlobeCanvas2D.tsx` — fallback component. Ships when Three.js fails
the ≥50 FPS scroll benchmark on M1 (Algol QA gate).

Canvas 2D rendering:
- Draw filled `arc(0.5w, 0.5h, r, 0, 2π)` — circle = globe outline
- Fill `var(--paper-base)` · stroke `var(--ink-faint)` 1px
- Project each public-locus pin: spherical coords → orthographic → canvas x/y
- In-membership pins: `var(--accent-orange)` 3px dot
- Out-of-membership pins: `rgb(31 80 99 / 0.32)` 2px dot
- Static — re-renders on `activePins` prop change, no rAF loop
- No animation. No interaction beyond `onClick` re-wired to `onPinClick`/`onGlobeClick`

### §5.10 — performance budget + cleanup

Unchanged from 20-archive.md §5.8. Key lines:
- **≥50 FPS scroll on M1 baseline** — hard gate. Algol benchmarks both variants.
- **`rAF` loop cancelled + WebGL context disposed on unmount.** Memory leak = QA-blocking.
- **`prefers-reduced-motion: reduce`** → auto-rotate halted; single-frame render only.
- No `journey-line` polylines in the render loop.

### §5.11 — replacement of MiniGlobeStub in TriangulateSearch.tsx

`components/TriangulateSearch.tsx` lines ~400–479 currently render a 2D
placeholder (`MiniGlobeStub`). Sirius replaces this with the `standby-tri`
variant of the extracted atom:

```tsx
// In TriangulateSearch.tsx — replace MiniGlobeStub block with:
import { ArchiveMiniGlobe } from './ArchiveMiniGlobe'

<ArchiveMiniGlobe
  size={348}
  pins={publicLociPins}      // all public-locus entries from pagefind metadata
  activePins={matchedPins}   // pins for the current search result set
  hoveredEntryId={hoveredId}
  onPinHover={setHoveredId}
  onPinClick={(pin) => router.push(pin.route)}
  onGlobeClick={() => { close(); router.push('/') }}
/>
```

The overlay's `publicLociPins` array comes from the static pagefind metadata
or a build-time JSON sidecar (Procyon's domain — see §7.3).

---

## §6 — tokens used

Zero new tokens. All values trace to `app/globals.css`.

| surface | token |
|---|---|
| page + header strip + rail | `var(--paper-base)` |
| ambient texture | `.paper-canvas` |
| header strip bottom rule | `border-bottom: 1px dashed var(--ink-dashed)` |
| all section seam rules | `border-bottom: 1px dashed var(--ink-dashed)` |
| body meta labels | `var(--ink-soft)` via `.t-meta` |
| file number, status, drift accents | `var(--accent-orange)` via `.t-meta-accent` |
| section headers `§ NN` | `var(--accent-orange)` |
| ledger row default | transparent on `var(--paper-base)` |
| ledger row hover | `rgba(212, 96, 42, 0.04)` (ChapterIndex carry-over — documented pattern) |
| entry title | `var(--ink-primary)` · Cormorant italic 18px |
| filter pill active border + text | `var(--accent-orange)` |
| filter pill active background | `var(--accent-orange-soft)` (`rgba(212, 96, 42, 0.18)` existing token) |
| filter pill inactive border | `var(--ink-hairline)` |
| filter pill inactive text | `var(--ink-soft)` |
| filter pill disabled (no match) | `var(--ink-hairline)` border + text |
| filter pill hover (inactive) | `rgba(212, 96, 42, 0.5)` (Option 2 from 20-archive.md §12.2 — literal, no new token) |
| mini-globe surface | `var(--paper-base)` hex `#E8E2D5` (Three.js requires hex; cite token source in comment) |
| mini-globe wireframe | `var(--ink-faint)` = `rgb(31 80 99 / 0.3)` |
| mini-globe in-membership pin | `var(--accent-orange)` hex `#D4602A` |
| mini-globe out-of-membership pin | `rgb(31 80 99 / 0.32)` |
| `[ ◯ ATLAS ]` link | `var(--ink-soft)` default · `var(--accent-orange)` hover · 150ms ease |
| `[ LOAD NEXT 20 ]` button | same as ATLAS link |
| `[ ⌕ survey ]` optional affordance | same as ATLAS link |
| empty state copy | `var(--ink-faint)` |
| focus ring | `outline: 2px dashed var(--accent-orange); outline-offset: 2px` |
| scroll-meter | `.scroll-meter` (existing) |
| marginalia HUD | `.marginalia` (existing) |

**No raw hex in component JSX or CSS.** The Three.js material values are hex
because the Three.js API does not consume CSS variables — Sirius must add a
comment citing the token source for each hex literal.

---

## §7 — Procyon dependency contract

Three Procyon (α-IDX-03) deliverables are required before Sirius can build
the route. All are additive — no breaking changes to existing lib/content exports.

### §7.1 — `lib/content/archive.ts` (new file)

```ts
// lib/content/archive.ts
// Owner: Procyon (α-IDX-03)
// Consumed by: app/archive/page.tsx (RSC), components/ArchiveLedger (filter client)

import type { Article, Fiction, Photo, PhotoSidecar } from './types'

/**
 * Discriminated union for archive ledger rows.
 * All three content types surface in the flat cross-stratum ledger.
 */
export type ArchiveEntry =
  | ArchiveArticle
  | ArchivePhoto
  | ArchiveFiction

export interface ArchiveArticle {
  kind: 'article'
  id: string                  // fileNum — stable unique id
  fileNum: string
  title: string
  date: string                // ISO 8601
  lastPatched: string         // ISO 8601 — patches[0].date || date
  status: string              // 'seed' | 'ongoing' | 'refined' | 'settled'
  readingTime: number         // minutes
  domain: string
  tags: string[]
  locus: { lat: number; lon: number; place: string } | null
  shareLocation: boolean      // always true for articles (no privacy gate)
  drift: number | null        // absolute drift from α at this locus
  patches: Array<{ date: string; note: string }>
  route: string               // '/entries/<fileNum>'
}

export interface ArchivePhoto {
  kind: 'photo'
  id: string                  // '<roll>/<sidecarId>' — stable unique id
  roll: string
  sidecarId: string
  title: string               // caption or roll title fallback
  date: string                // ISO 8601 captureTime
  lastPatched: string         // date (photos are immutable — date === lastPatched)
  domain: string
  tags: string[]
  filmSim?: string
  locus: { lat: number; lon: number; place: string } | null
  /**
   * Privacy gate — HARD contract inherited from photo-atlas §1.2 and
   * 20-archive.md §5.5.
   * If false: entry appears in ledger (with locus row omitted) but
   * is NOT passed to mini-globe pins.
   */
  shareLocation: boolean
  drift: number | null        // null when shareLocation=false
  route: string               // '/photos/<roll>/<sidecarId>'
}

export interface ArchiveFiction {
  kind: 'fiction'
  id: string                  // slug
  slug: string
  title: string
  date: string                // ISO 8601
  lastPatched: string         // ISO 8601
  domain: string
  tags: string[]
  locus: null                 // fiction has no GPS locus
  shareLocation: false        // fiction never plots on mini-globe
  drift: null
  route: string               // '/fiction/<slug>'
}

/**
 * Returns all archive-eligible entries, default sort: lastPatched desc.
 *
 * Privacy contract:
 * - Articles: always included
 * - Photos: always included in ledger (shareLocation in ledger is informational only)
 * - Fiction: always included
 *
 * Note: shareLocation controls mini-globe visibility (see getMiniGlobePins),
 * NOT ledger visibility. The ledger is always the full inventory.
 */
export function getArchiveEntries(): ArchiveEntry[]

/**
 * Returns entries grouped by survey year, preserving sort within each year.
 * Year is extracted from entry.date (the initial survey date, not lastPatched).
 * Grouped for the default year-section rendering.
 */
export function getArchiveEntriesByYear(
  entries?: ArchiveEntry[]
): Record<number, ArchiveEntry[]>

/**
 * Returns the subset of ArchiveEntry[] eligible for mini-globe pin rendering.
 * Gate: kind===photo → shareLocation===true && locus!==null
 *       kind===article → locus!==null (articles always share location by spec)
 *       kind===fiction → always excluded (no GPS locus)
 * Returns MiniGlobePin[] ready to be passed to <ArchiveMiniGlobe pins={...}>.
 */
export function getMiniGlobePins(entries: ArchiveEntry[]): MiniGlobePin[]

// MiniGlobePin is re-exported from §5.6 interface — Procyon adds it here
// so Sirius can import it from lib/content/archive without reaching into components.
export type { MiniGlobePin } from '@/components/ArchiveMiniGlobe'
```

### §7.2 — extend `lib/content/index.ts`

Add to existing exports:

```ts
export {
  getArchiveEntries,
  getArchiveEntriesByYear,
  getMiniGlobePins,
} from './archive'

export type {
  ArchiveEntry,
  ArchiveArticle,
  ArchivePhoto,
  ArchiveFiction,
} from './archive'
```

### §7.3 — extend `inject-pagefind-sidecar.ts`

Procyon (α-IDX-03) extends the sidecar injector to cover `/archive`:

The script already reads `.velite/*.json`. For the `/archive` route it must:
1. Detect `.next/server/app/archive/index.html`
2. If the file already contains `data-pagefind-body` as a real HTML attribute, skip (idempotent gate)
3. Inject a `<div data-pagefind-body ...>` block containing:
   - `<span data-pagefind-meta="title:ARCHIVE LEDGER">ARCHIVE LEDGER</span>`
   - Per entry: `<span data-pagefind-weight="3">{entry.title}</span>` (all titles)
   - Per entry with domain: `<span data-pagefind-filter="domain[{domain}]">{domain}</span>`
4. The injected block is visually hidden (1×1px clip pattern, identical to article pattern)

This makes `/archive` a searchable pagefind page. Visitors who search for
an article title will find it via the route-level archive page, in addition to
the direct entry route result.

---

## §8 — typography

All from the three fixed type roles. No new scales.

| element | family | size | weight | transform | color |
|---|---|---|---|---|---|
| header strip meta lines | JetBrains Mono (`.t-mono`) | 9px | regular | UPPERCASE | `var(--ink-soft)` |
| header strip accent values (file nums, drift) | JetBrains Mono (`.t-meta-accent`) | 9px | regular | UPPERCASE | `var(--accent-orange)` |
| entry file/date/status meta | JetBrains Mono (`.t-meta`) | 9px | regular | UPPERCASE | `var(--ink-soft)` |
| entry title | Cormorant Garamond italic (`.t-display`) | 18px | 400 italic | sentence | `var(--ink-primary)` |
| entry attractor pills | JetBrains Mono (`.t-meta`) | 9px | regular | UPPERCASE | `var(--ink-soft)` · first `var(--accent-orange)` |
| entry locus / drift | JetBrains Mono (`.t-meta`) | 9px | regular | UPPERCASE | `var(--ink-soft)` · drift in `.t-meta-accent` |
| entry type glyph + label | JetBrains Mono (`.t-meta`) | 9px | regular | UPPERCASE | `var(--ink-soft)` |
| section year headers `§ NN · YEAR — YYYY` | JetBrains Mono (`.t-meta`) | 9px | regular | UPPERCASE | `§ NN` in `.t-meta-accent` · rest in `var(--ink-soft)` |
| filter family labels (TYPE, STATUS…) | JetBrains Mono (`.t-meta`) | 9px | regular | UPPERCASE | `var(--ink-soft)` |
| filter pill labels | JetBrains Mono (`.t-meta`) | 9px | regular | UPPERCASE | per active/inactive state |
| `[ ◯ ATLAS ]` link | JetBrains Mono (`.t-mono`) | 9px | regular | UPPERCASE | `var(--ink-soft)` default |
| `[ LOAD NEXT 20 ]` | JetBrains Mono (`.t-mono`) | 9px | regular | UPPERCASE | same |
| mini-globe caption | JetBrains Mono (`.t-mono`) | 8px | regular | UPPERCASE | `var(--ink-soft)` |
| empty state copy | JetBrains Mono (`.t-mono`) | 9px | regular | — | `var(--ink-faint)` |

---

## §9 — motion

| trigger | timing | easing | effect |
|---|---|---|---|
| ledger row hover enter | 150ms | ease | background `rgba(212, 96, 42, 0.04)` |
| ledger row title underline | 460ms | `cubic-bezier(0.2, 0.8, 0.2, 1)` | `.entry-glitch::after` draw — existing atom |
| filter pill hover (inactive→hover) | 120ms | ease | border `rgba(212, 96, 42, 0.5)` |
| filter pill click (toggle) | 0ms | — | instant state swap + URL update |
| `[ ◯ ATLAS ]` link hover | 150ms | ease | `var(--ink-soft)` → `var(--accent-orange)` |
| mini-globe pin in/out-membership | 120ms | ease | color transition on filter change (BufferAttribute update — CSS-independent) |
| mini-globe idle auto-rotate | continuous | linear | Y-axis · 60s/rev · pauses on pointer in · resumes 3s after pointer out |
| mini-globe pin hover | 120ms | ease | accent-orange full opacity from 0.7 base |

**Reduced-motion:** all hover/transition timings collapse to 0ms. Mini-globe
auto-rotate halted; single-frame render. `.entry-glitch::after` animation already
has reduced-motion rule in `globals.css` (no change needed).

**No decorative motion.** No looping pin pulse on `/archive` (ATLAS has it; the
mini-globe is a standby companion, not a second ATLAS). No entrance animation
on ledger rows (the page is a reading surface, not a hero). Header strip
appears immediately with no fade.

---

## §10 — responsive

Full breakdown in 20-archive.md §10. Additions and clarifications for this spec:

### §10.1 — ≥1181px desktop (canonical)

Two-column: ledger left ~66% · rail right 360px sticky at `top: 72px`.
Mini-globe 300×300 in rail. Marginalia HUD visible.

### §10.2 — 881–1180px tablet-wide

Rail compresses to 300px. Mini-globe shrinks to 240×240. Filter pills wrap
within each family row. Ledger `px-6`. Marginalia HUD visible.

### §10.3 — 600–880px tablet-narrow

Single column. Rail moves above ledger, non-sticky. Mini-globe 280px max-width
centered. Filter pills: horizontal scroll strip per family, family label inline.
`py-4 px-5`. Marginalia HUD hidden. Header strip stacks two rows.

### §10.4 — 375–599px mobile

Mini-globe collapses to one-line strip (no canvas rendered):

```
┌──────────────────────────────────────────────────────────┐
│  ◯ ATLAS · 047 LOCI · DRIFT –1.300 · [view]              │
└──────────────────────────────────────────────────────────┘
```

`.t-mono` 9px `var(--ink-soft)`. `[view]` routes to `/`.
Marginalia HUD hidden. Filter: horizontal scroll chips. `py-4 px-4`.
Touch targets on ledger rows ≥56px (file-meta + title + at least one more meta
row = ~84px in practice). Active state: `:active { background: rgba(212,96,42,0.04) }`.

---

## §11 — states

All entry states from 20-archive.md §8 unchanged. Summary:

| state | behavior |
|---|---|
| default (entries present) | ledger renders grouped by year; rail sticky |
| zero entries — no filter | empty-state copy + `[ ◯ RETURN TO ATLAS ]` · Vega writes copy |
| zero entries — after filter | `// no entries match this survey. / adjust filter · or [ ◯ clear all filters ]` · Vega writes |
| filter disabled pill (no entries match that value) | `var(--ink-hairline)` border + text, `cursor: not-allowed` |
| loading (SSR hydrating) | ledger rows render from RSC-passed props — no loading skeleton needed; Next.js streaming handles it |
| fiction row with no destination route | row renders; click routes to minimal `/fiction/<slug>` placeholder stub per 20-archive.md §14·Q6 recommendation |

---

## §12 — accessibility

Unchanged from 20-archive.md §11.2–11.3. Key additions for this spec:

**Keyboard map — full v1 set:**

| key | action |
|---|---|
| `Tab` / `Shift+Tab` | standard focus order |
| `/` | open Triangulate overlay (global — existing pattern) |
| `Enter` on ledger row | navigate to entry |
| `Enter` on filter pill | toggle filter + URL update |
| `Escape` on filter region | clear current filter focus |
| `f` | focus first filter pill (ergonomic shortcut) |
| `Home` / `End` | browser scroll to top/bottom |

**Semantic structure:**

- `<main data-pagefind-body>` wraps the archive body
- Ledger: `<ol>` with `<li>` per entry (ordered list — the entries are ordered)
- Each entry: `<li><a href="...">...</a></li>` — entire row is the anchor
- Year section: `<section aria-label="YEAR 2026"><h2 className="t-meta">§ 01 · YEAR — 2026</h2><ol>...</ol></section>`
- Filter rail: `<aside aria-label="archive filters">`
- Filter families: `role="radiogroup" aria-label="filter by type"` etc.
- Mini-globe: `role="img" aria-label="coordinate map of archive entries — NN of NN loci visible"`
- Skip link: visually hidden until focused → `href="#archive-ledger"` — "Skip to archive ledger"
- Mini-globe pins are not keyboard-navigable in v1 (the mini-globe is a
  companion map, not the primary navigation surface — ledger rows serve that role)
- Scroll-position restore on browser back: `sessionStorage.setItem('wl:archive-scroll', scrollY)` on row click; restore on mount if URL params match

**Lighthouse targets:** a11y ≥ 95 on `/archive`.

---

## §13 — design unity (Rule 4 — mandatory)

**Soul baseline this surface extends:**

- The index page paper instrument: `.paper-canvas` grain + scanlines, teal ink
  on aged paper, mono instrument register, Cormorant italic for voice
- The ATLAS globe: same visual body; mini-globe is the SAME globe atom at
  standby scale, not a new graphic

**Connection-point:**

- The mini-globe IS the same globe atom (`initMiniGlobe` pattern in
  `assets/worldline-globe.js`) at standby scale — same material, same palette,
  same graticule treatment. A visitor who recognizes the ATLAS globe on the
  homepage recognizes the mini-globe in the archive rail. One object at two scales.
- The ledger rows reuse the `archive-node` / `entry-card` vocabulary from
  `components/ChapterIndex.tsx`. The hover wash, the underline-draw animation,
  the 5-line row anatomy — all carried from ChapterIndex. No new row vocabulary.
- The filter pills reuse the `attractor-pill` atom (`.af-pill`) from
  `FilmSimSwitcher` (`10-photo-atlas.md §2.4`). Same three states, same token set.
- The header strip reuses the `.frame-head` / `.article-head` register: mono
  9px uppercase, corner reticles (`.corner-marks`), dashed bottom rule.

**Continuity — what is NOT new:**

- No new color introduced. Zero raw hex outside the Three.js material literals
  that are documented with CSS variable citations in comments.
- No new font family or size. Three families, fixed roles, existing scale.
- No new interaction pattern. Hover wash, pill toggle, underline-draw, URL-param
  filter state — all established by existing surfaces.

**The one load-bearing novel decision:**
Cross-stratum unification at the ledger layer (articles + photos + fiction in
one flat list). This is novel in the *data model* layer only. The visual
vocabulary is not novel — it is the ChapterIndex pattern applied once more.

**Acceptance test:** does `/archive` read as Peat — and as a surveyed paper
instrument — even if his role changed tomorrow? The answer is yes because the
surface is dated, filed, drift-read, and ledger-structured. It is not a
portfolio. It is not a blog index. It is an inventory.

---

## §14 — anti-Codex checklist

| check | status | evidence |
|---|---|---|
| 1 · reference fidelity | PASS | route-first intent of 20-archive.md restored; VISION-2026-05-31 Π1 override explicit; Triangulate coexistence defined; all elements from 20-archive.md §2.5 anti-Codex table carried forward |
| 2 · token compliance | PASS | zero new tokens; zero raw hex in spec prose; Three.js hex literals documented with CSS variable citations; one carry-over literal `rgba(212,96,42,0.04)` from ChapterIndex documented |
| 3 · pattern reuse — compose from atoms | PASS | `corner-reticle` → `.corner-marks` on header strip; `dashed-hairline` → all section seams; `attractor-pill` → `.af-pill` filter chips; `type-roles` → three fixed families; `archive-node` / `entry-card` → ledger rows from ChapterIndex; `globe` → mini-globe standby variant; `paper-canvas` → page surface; `hud-corner-readout` → filter family labels; `focus-button` pattern for optional `[ ⌕ survey ]` |
| 4 · accessibility | PASS | keyboard map documented; semantic HTML structure (`<ol>` ledger, `<section>` years, `role="radiogroup"` filters, `role="img"` globe); skip link; focus ring `outline: 2px dashed var(--accent-orange)`; Lighthouse ≥95 target |
| 5 · mobile fidelity | PASS | four breakpoint regions with explicit rules; mini-globe degrades to one-line strip at ≤599px; filter horizontal-scroll chips; ledger rows ≥56px touch targets; no horizontal scroll at 375px |
| 6 · motion calibration | PASS | 120ms pill hover · 150ms row hover · 460ms underline draw · all within iter 1 band; no decorative loops; reduced-motion paths explicit; mini-globe auto-rotate halts under reduced-motion |
| 7 · atom reuse | PASS | every visual primitive above cites its gallery atom id; no JetBrains Mono appearance without citing `type-roles`; no dashed border without citing `dashed-hairline`; no corner mark without citing `corner-reticle`; mini-globe cites `globe` atom standby variant |

---

## §15 — non-goals

Carries forward all 20-archive.md §16 non-goals. Additions for this spec:

- **This spec does not describe the Triangulate overlay.** That surface is
  fully specified in `docs/design/14-triangulate-search.md`. The only change
  to that spec is the replacement of `MiniGlobeStub` with the extracted
  mini-globe atom (§5.11 above).
- **No query input on the `/archive` route.** The filter rail is a survey
  control — type/status/domain/year. It is NOT a search box.
- **No AI synthesis on the `/archive` route.** NETRA is not present.
- **No `◇ ARCHIVE` button on the Nav firing `triangulate:open`.** That wire
  is removed per §2 override. The overlay remains reachable via `/` hotkey.

---

## §16 — build responsibilities

### Sirius (α-SUR-01) — implements

| component | spec section |
|---|---|
| `app/archive/page.tsx` (RSC) | §3 — static renderability; calls `getArchiveEntries()`; passes props to client tree; emits `<main data-pagefind-body>` |
| `components/ArchiveLedger.tsx` | 20-archive.md §15.1 — client component; URL filter state; year-grouped rows |
| `components/ArchiveFilters.tsx` | 20-archive.md §15.1 — client component; filter chip rows; reads/writes URL params |
| `components/ArchiveMiniGlobe.tsx` | §5 — wrapper component; picks ThreeJS vs Canvas2D based on `window.WebGLRenderingContext` availability |
| `components/ArchiveMiniGlobeThreeJS.tsx` | §5 — Three.js sphere; 24×24 geometry; `MeshLambertMaterial`; `THREE.Points` pins; rAF loop with cleanup; HARD lock values from §5.3 |
| `components/ArchiveMiniGlobeCanvas2D.tsx` | §5.9 — Canvas 2D fallback; static; privacy-identical |
| `components/Nav.tsx` — ARCHIVE item | §2 — change `archiveLink: true` + event dispatch to `href="/archive"`; add `usePathname()` active detection |
| Replace `MiniGlobeStub` in `TriangulateSearch.tsx` | §5.11 — wire `<ArchiveMiniGlobe size={348} ...>` with bidirectional hover sync |
| Scroll-position restore | 20-archive.md §9.3 — `sessionStorage.setItem('wl:archive-scroll', ...)` on row click; restore on mount |

### Procyon (α-IDX-03) — implements

| deliverable | spec section |
|---|---|
| `lib/content/archive.ts` — `getArchiveEntries()` + `getArchiveEntriesByYear()` + `getMiniGlobePins()` | §7.1 |
| Extend `lib/content/index.ts` | §7.2 |
| Extend `inject-pagefind-sidecar.ts` to cover `/archive` | §7.3 |
| Type export: `ArchiveEntry` union + variants | §7.1 |

**Blocker:** Procyon's `getArchiveEntries()` is a hard blocker for Sirius's
`app/archive/page.tsx`. Both TASKs should be issued in the same wave, with
Procyon's data helper on the critical path.

---

## §17 — signatures

Reviewed against:
- `docs/design/20-archive.md` v1.0 — all architectural decisions reaffirmed
- `docs/design/14-triangulate-search.md` — overlay spec unchanged; `MiniGlobeStub` replacement additive
- `app/globals.css` — zero new tokens required
- `components/Nav.tsx` — ARCHIVE nav wire change identified (Nav.tsx line 7 + 150–174)
- `components/TriangulateSearch.tsx` — `MiniGlobeStub` replacement at lines ~400–479
- `scripts/inject-pagefind-sidecar.ts` — Procyon extension scope confirmed
- `lib/content/index.ts` + `lib/content/types.ts` — no existing exports broken
- Soul-atom gallery (`worldline-atoms.css`) — all atoms cited; no re-derivation
- VISION-2026-05-31 Π1 — overridden by Peat directive 2026-06-01; noted in §0

All seven anti-Codex checks pass (§14).
Zero new tokens.
Zero raw hex outside documented Three.js literals.
Zero new visual vocabulary.
One structural novelty (cross-stratum ledger) — visual vocabulary unchanged.

next_recipient: Algol (α-QA-02) for audit, or Polaris (α-OPS-00) to dispatch TASK wave

---

*betelgeuse · α-VIS-04 · the Red Sentinel · 2026-06-01*
*soul baseline: SBA-1 visual canon · iter 1 prototype · v1.3 globe ontology · 20-archive.md v1.0 · 14-triangulate-search.md*
*zero new tokens · zero raw hex outside documented Three.js literals · zero new visual vocabulary*
