# docs/design/10-photo-atlas.md
# Photo Atlas Surfaces — TASK-2026-05-15-10 · γ-instance

> Status · v1.0 · 2026-05-15
> Author · Betelgeuse (α-VIS-04) · TASK-2026-05-15-10
> Predecessors · `journey-architecture.md` v1.2 §2.2 (square glyph) + §3.3 (photo contract) · `attractor-binding-mechanic.md` v1.1 §1.3a (v1.3 renderer target) · `prd-03-photo-atlas-deep-dive.md` §6 (roll index + single roll) · Procyon TASK-22 (Photo type from `lib/content`)
> Downstream · TASK-32 (Sirius · roll index + single-roll implementation) · TASK-33 (Sirius · Globe square-glyph extension)
> Routes · `/photos` (roll index) · `/photos/<roll>` (single-roll contact sheet)

---

## intent

Two surfaces, one purpose: the photograph as a surveyed artifact with coordinates.

`/photos` says: *here are the rolls — expeditions recorded on film, in sequence.*

`/photos/<roll>` says: *here is one expedition — every frame from it, in capture order,
anchored to geography where GPS was shared.*

Neither surface is a social gallery. Neither surface borrows from SaaS photo tools. The
vocabulary is the same instrument language that everything else on this site uses: mono
uppercase labels, dashed hairline rules, corner reticles, sparse white space. The photographs
are not the decoration; they are the evidence. The instrument frame is the container.

---

## 1 · Globe surface stratum — square glyph spec

Informing TASK-33 (Sirius). This is the visual and interaction contract for the Globe layer;
implementation lives in `WorldlineGlobe.tsx`.

### 1.1 Glyph

Per journey-arch §2.2 (canonical decision table):

| property | value |
|---|---|
| shape | square plane, facing outward (PlaneGeometry(0.018, 0.018) per PRD-03 deep-dive §4.2) |
| side | ~0.010 in render (the `0.018` geo is the hit proxy; the visible plane is 0.010-equivalent scale) |
| color (default) | `var(--accent-orange)` → Three.js `0xd4602a` |
| color (film-sim tinted, when available) | tinted per active film-sim palette — see §1.3 |
| layer | Ne0 surface + ALL view (photo pins share the surface stratum with article pins) |
| visible in | Ne0 (`'neo'` / `cameraFocus='surface'`) and ALL (`'all'` / `cameraFocus='rest'`) |
| hidden in | Ne0N (`'neon'` / `cameraFocus='axis'`), NeX (`'nex'` / `cameraFocus='orbit'`) |
| clickable | yes — full click navigates to `/photos/<roll>/<id>` |

The hit sphere is a `SphereGeometry(0.055, 8, 8)` invisible mesh (same pattern as article pin
hit proxy in `WorldlineGlobe.tsx`). The larger hit sphere gives a 44px-equivalent target at
typical zoom.

The square glyph faces outward by `lookAt(v.clone().multiplyScalar(2))` where `v` is the
GPS-derived `latLonToVec3` position. This is the existing Three.js pattern in `WorldlineGlobe.tsx`.

### 1.2 GPS eligibility gate

Only photos with `shareLocation === true` AND `coords !== undefined` appear as Globe pins.
This is enforced by `getGlobeEligiblePhotos()` from `@/lib/content` (TASK-22 deliverable,
Procyon). Sirius: import from `@/lib/content`, never from `.velite` directly.

The privacy invariant: no photo with `shareLocation: false` ever reaches the Globe layer,
regardless of whether GPS coordinates exist in the processed data.

### 1.3 Film-sim tint (nice-to-have, v1)

When the site palette is set to a film-sim variant, photo pin color may optionally shift to
signal alignment with the active palette:

| active palette | photo pin color |
|---|---|
| provia (default) | `0xd4602a` (accent-orange) |
| classic-chrome | `0xa86b2c` (muted ochre, matches palette's accent-orange) |
| acros | `0x5a5a55` (deep gray, matches palette's accent-orange) |
| reala-ace | `0xc75d45` (coral) |
| velvia | `0xd24820` (saturated red-orange) |

Sirius: only implement if Three.js palette sync via `CustomEvent('wl:palette-change')` is
already wired. PRD-03 deep-dive §8.3 recommends accepting the disconnect for v1 (Globe teal
stays constant). If sync is not wired, all photo pins use the default `0xd4602a`.
Do not block TASK-33 on palette sync.

### 1.4 Hover state (Globe surface)

When cursor hovers a photo pin's hit sphere:

- Square glyph brightens toward `0xd4602a` (accent-orange) in 120ms (same timing as article pin hover).
- Preview card appears (see photo-entry spec §1.1 for card contents and dimensions).
- Preview card contains a 60×60 thumbnail (thumb variant) — the only element the article
  hover card does not have. The DOM structure is otherwise identical.
- NETRA voice strip unchanged at hover.

### 1.5 Attractor binding integration

When `activeAttractor !== "all"` (binding mechanic v1.1):

- **In-membership photo pin**: renders at full opacity with the standard halo ring
  (binding §3.1 — `var(--accent-orange)` ring at glyph radius + 0.004).
  The halo for a square glyph is a **square outline** of equal proportion (not a circle) —
  this is specified in binding §3.1: "when photo squares ship per ontology §2.2, the halo
  also becomes a square outline of equal proportion."
- **Out-of-membership photo pin**: dims to 0.32 opacity with desaturation (binding §3.3).
  Hit sphere stays full size — pin remains clickable.
- **Attractor edges**: if a photo pin is in-membership alongside an article node,
  a surface↔surface or surface↔orbit edge connects them (binding §2.1 step 4, §3.2).

The binding mechanic doc (TASK-14 output) is authoritative for all transition timings
and edge geometry. This spec does not restate them — it only confirms photo pins
participate in the binding with the square-halo variant.

---

## 2 · `/photos` — roll index

Route: `app/photos/page.tsx`

### 2.1 Intent

A chronological inventory of all rolls, newest first. Not a gallery grid. The instrument
frame carries the spatial metaphor: each roll is a coordinate-bounded expedition with a
date range, a location label, and a count. The visitor reads the list the way they'd read
an ATLAS survey log — entries by date, each with enough metadata to decide whether to drill in.

### 2.2 Layout

```
┌────────────────────────────────────────────────────────────────────┐
│ NAV STRIP (Nav.tsx)                                                │
├────────────────────────────────────────────────────────────────────┤
│ HEADER STRIP                                                       │
│ ┌─┐ PHOTO ARCHIVE · <N> ROLLS · <M> FRAMES                         │
│ └─┘                                   A 1.130426 · NAV STANDBY    │
│     [← BACK TO ATLAS]                                              │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ FILM SIM SWITCHER (when any roll has a film sim present)           │
│ FILM · [PROVIA] [CLASSIC CHROME] [ACROS] [REALA ACE] [VELVIA]     │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ ROLL LIST (newest first)                                           │
│ ─────────────────────────────────────────────────────             │
│                                                                    │
│ 2026-04-chiang-mai                                                 │
│ ┌────────────────────────────────────────────────────────────┐    │
│ │ [THUMB1] [THUMB2] [THUMB3] [THUMB4] [+NN more]             │    │
│ │ 60×60 thumbs · lazy-loaded · first 4 only in index         │    │
│ └────────────────────────────────────────────────────────────┘    │
│ ROLL TITLE · "เชียงใหม่ · cool season"                            │
│ DATE RANGE · 2026.04.12 – 2026.04.18 · LOCATION LABEL             │
│ FRAMES · 24 · GPS SHARED · 18                                      │
│ [VIEW ROLL →]                                                      │
│                                                                    │
│ ─────────────────────────────────────────────────────             │
│ <next roll...>                                                     │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 2.3 Roll card anatomy

Each roll card is a horizontal strip, not a visual card container (no rounded borders, no
elevated shadows — those belong to SaaS dashboards, not this site). A dashed hairline rule
separates rolls.

**Thumbnail strip**: first 4 thumbnails (thumb variant, 60×60, object-fit: cover). If more
than 4 photos in roll: a fifth "slot" shows `+NN` in t-mono 9px `var(--ink-soft)` on
`var(--paper-deep)` background. Thumbnails link directly to their photo entry pages.

**Meta row 1 (roll identifier)**: roll slug in t-mono 9px `var(--ink-soft)`. This is the
machine name; below it is the human title.

**Meta row 2 (roll title)**: roll title (from `roll.mdx` frontmatter) in italic Cormorant 16px
`var(--ink-primary)`.

**Meta row 3 (survey data)**: date range · location label · frame count · GPS-shared count.
All t-meta (9px mono uppercase `var(--ink-soft)`). Date format: `YYYY.MM.DD – YYYY.MM.DD`.
"GPS SHARED · NN" only renders when at least 1 photo has `shareLocation=true`; otherwise omit.

**Call to action**: `[VIEW ROLL →]` — t-mono 9px, `var(--ink-soft)` default,
`var(--accent-orange)` hover. Links to `/photos/<roll>`.

**Section rule between rolls**: `1px dashed var(--ink-dashed)`. NOT solid.

### 2.4 Film sim switcher placement

The `FilmSimSwitcher` component (per PRD-03 deep-dive §8.2) renders below the header strip.
Only shown when at least one roll in the collection has a photo with a known film simulation.
If no film sim data exists across all rolls: switcher is absent. No empty row.

The switcher itself: t-meta label `FILM ·` followed by pill buttons in t-meta style.
Active pill: `var(--accent-orange)` border and text. Inactive: `var(--ink-faint)` border,
`var(--ink-soft)` text. Hover: border shifts to `var(--accent-orange)`.

### 2.5 Empty state (no rolls)

```
┌────────────────────────────────────────────────────────────────────┐
│ NAV STRIP                                                          │
├────────────────────────────────────────────────────────────────────┤
│ HEADER STRIP                                                       │
│ ┌─┐ PHOTO ARCHIVE · 0 ROLLS · 0 FRAMES                             │
│ └─┘                                   A 1.130426 · NAV STANDBY    │
│     [← BACK TO ATLAS]                                              │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ // no rolls surveyed yet.                                          │
│ // this archive is empty.                                          │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

Both lines in t-mono 9px `var(--ink-faint)`. No image placeholders. No illustration.

---

## 3 · `/photos/<roll>` — single-roll contact sheet

Route: `app/photos/[roll]/page.tsx`

### 3.1 Intent

One expedition — all frames, in capture order, with the geography of GPS-shared frames
visible on an SVG mini-map. The contact sheet is the film photographer's editing surface:
you see every frame, you pick what to examine. The mini-map adds the *where* — the roll
stops being a date range and becomes a route.

### 3.2 Layout

```
┌────────────────────────────────────────────────────────────────────┐
│ NAV STRIP                                                          │
├────────────────────────────────────────────────────────────────────┤
│ HEADER STRIP                                                       │
│ ┌─┐ ROLL · <ROLL SLUG>                 A 1.130426 · NAV STANDBY    │
│ └─┘ <ROLL TITLE>                                                   │
│     <DATE RANGE> · <LOCATION LABEL>                                │
│     <GPS SHARED · NN>  (if any)                                    │
│     [← PHOTO ARCHIVE]                                              │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  GRID: [1fr CONTACT SHEET] [300px MINI-MAP + META]                 │
│                                                                    │
│  ┌────────────────────────────────┐  ┌────────────────────────┐  │
│  │ CONTACT SHEET                  │  │ MINI-MAP (SVG)          │  │
│  │                                │  │                         │  │
│  │ [T][T][T][T]                   │  │  ◯─────────────────     │  │
│  │ [T][T][T][T]                   │  │  SVG orthographic       │  │
│  │ [T][T][T][T]                   │  │  ink-on-paper           │  │
│  │ ...                            │  │  square pins for photos │  │
│  │                                │  │                         │  │
│  │ (T = thumbnail 160×120)        │  │ ROLL SUMMARY            │  │
│  │ lazy-loaded, click → lightbox) │  │ FRAMES · 24             │  │
│  │                                │  │ GPS · 18                │  │
│  │                                │  │ DATE RANGE              │  │
│  └────────────────────────────────┘  │                         │  │
│                                      │ FILM SIM SWITCHER       │  │
│                                      │ (if film sim present)   │  │
│                                      └────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 3.3 Contact sheet

- Thumbnails: medium variant (1280px source), displayed at 160×120 (4:3). `object-fit: cover`.
- Grid: `grid-cols-4` at desktop. `grid-cols-3` at ≤880px. `grid-cols-2` at ≤600px.
- Gap: 8px between thumbnails.
- Thumbnails lazy-loaded (`loading="lazy"`). First row eager.
- On thumbnail click: opens lightbox at that index (`yet-another-react-lightbox`).
  The lightbox component is loaded via `dynamic()` with `ssr: false` (PRD-03 deep-dive §7).
- Lightbox styling: dark surface `rgba(10,10,10,0.95)` — this is NOT a token value; it is
  the lightbox library's overlay background, not a site surface. It lives in the lightbox
  component CSS props, not `globals.css`. Acceptable because it is a library-level overlay,
  not a site design token surface.
- Lightbox `alt` strings: caption if present; `<slug> · <roll>` otherwise.
- Reduced motion: lightbox transition collapses to 0ms per PRD-03 deep-dive note.
- Each thumbnail has `aria-label="Open photo <slug> in lightbox"`.

**No hover overlay or label on thumbnails.** The contact sheet is a scanning surface — adding
hover overlays adds visual noise without information the visitor doesn't already have from
clicking into the entry. Hover state: cursor:pointer only.

**No selection state.** No multi-select. No checkboxes. Single-click → lightbox.

### 3.4 SVG mini-map

Renders when at least one photo in the roll has `shareLocation === true` AND `coords !== undefined`.
When no GPS data: mini-map block absent entirely. No empty container.

The SVG orthographic projection is the established pattern (PRD-03 deep-dive §6, journey-arch §10
row 08 verdict "γ writes the spec"). NOT a Three.js instance — this is a 2D SVG map, lightweight,
no canvas cost.

**SVG structure:**

```
<svg viewBox="-100 -100 200 200" role="img"
  aria-label="Map showing GPS locations for roll <roll title>">
  <!-- Globe outline -->
  <circle cx="0" cy="0" r="95"
    fill="none"
    stroke="var(--ink-faint)"
    strokeWidth="0.5" />

  <!-- Continent outlines (simplified paths, ink-faint stroke) -->
  <!-- Use a pre-baked simplified world-outline SVG path.
       NOT a full GeoJSON projection — 10–12kb max for the path data.
       Source: Natural Earth 1:110m simplified, baked at build time.
       Sirius: reuse `lib/cartography.ts`'s orthographic() if it already
       has continent paths; otherwise a static SVG string per Procyon's data layer. -->
  <path d="M ..." fill="none" stroke="var(--ink-faint)" strokeWidth="0.3" />

  <!-- Photo pins — square rects, 3×3px, accent-orange -->
  {withGps.map(p => (
    <rect key={p.slug}
      x={x - 1.5} y={y - 1.5}
      width={3} height={3}
      fill="var(--accent-orange)"
      rx={0} />
  ))}
</svg>
```

Visual treatment:
- Globe outline circle: `var(--ink-faint)`, strokeWidth 0.5
- Continent outlines: `var(--ink-faint)`, strokeWidth 0.3, no fill
- Photo pins: 3×3px squares (matching Globe's square glyph vocabulary), `var(--accent-orange)`
- No latitude/longitude grid lines — too much visual noise at 300px width
- No labels on the map itself
- Projection centered on median lat/lon of GPS-opted-in photos in the roll
  (`orthographicCentered()` from `lib/cartography.ts` per PRD-03 deep-dive §6)

The SVG does not require interactivity. Hovering or clicking map pins is NOT specified for v1.
The map is an overview, not a navigation surface. Deferred affordance: a future TASK could add
pin-hover on the mini-map to preview the photo.

Width: `max-w-[300px] w-full`. Aspect-ratio: 1/1 (square container, globe circle fills it).

### 3.5 Roll summary (adjacent to mini-map)

When mini-map is absent (no GPS data), this block fills the right column:

```
§ ROLL SURVEY
─────────────────────
FRAMES     24
GPS SHARED 18
DATE RANGE 2026.04.12
           2026.04.18
LOCATION   Chiang Mai · TH
FILM SIM   Classic Chrome
```

All t-meta. Section header `§ ROLL SURVEY` in t-meta. Values in t-mono 9px `var(--ink-primary)`.
Film sim value in `var(--accent-orange)`.

When mini-map IS present: roll summary renders below the SVG map in the same right column.

### 3.6 Film sim switcher

Same component as `/photos` index. Only renders when at least one photo in this specific roll
has a known film simulation. Renders in the right column, below the roll summary.

---

## 4 · Tokens used

| role | token |
|---|---|
| page surface | `var(--paper-base)` |
| paper grain texture | `.paper-canvas` class |
| header strip meta | `var(--ink-soft)` |
| roll title | `var(--ink-primary)` |
| accent (film sim label, `VIEW ROLL →`, switcher active) | `var(--accent-orange)` |
| mini-map globe outline | `var(--ink-faint)` |
| mini-map continent outlines | `var(--ink-faint)` |
| mini-map photo pins | `var(--accent-orange)` |
| section rules between rolls | `var(--ink-dashed)` |
| `+NN more` thumb slot background | `var(--paper-deep)` |
| `+NN more` thumb slot text | `var(--ink-soft)` |
| roll summary labels | `var(--ink-soft)` |
| roll summary values | `var(--ink-primary)` |
| empty-state copy | `var(--ink-faint)` |

No raw hex. No new tokens.

---

## 5 · Typography

| element | family | size | weight | style | color |
|---|---|---|---|---|---|
| all meta / labels | JetBrains Mono (`t-meta`) | 9px | 400 | uppercase | `var(--ink-soft)` |
| roll title | Cormorant Garamond (`t-display`) | 16px | 400 | italic | `var(--ink-primary)` |
| roll slug | JetBrains Mono | 9px | 400 | uppercase | `var(--ink-soft)` |
| `VIEW ROLL →` CTA | JetBrains Mono | 9px | 400 | uppercase | `var(--ink-soft)` hover: accent-orange |
| readout values | JetBrains Mono (`t-mono`) | 9px | 400 | uppercase | `var(--ink-primary)` |
| film sim value | JetBrains Mono | 9px | 400 | uppercase | `var(--accent-orange)` |
| empty state | JetBrains Mono | 9px | 400 | uppercase | `var(--ink-faint)` |

No new fonts. No new sizes.

---

## 6 · Motion

| trigger | duration | easing | what moves |
|---|---|---|---|
| Page load | none | — | no entrance animation |
| Thumbnail lazy-load reveal | 150ms | ease-out | img opacity 0→1 |
| Lightbox open | 200ms | ease | lightbox overlay opacity |
| Lightbox close | 200ms | ease | lightbox overlay opacity |
| Film sim switcher pill activate | 120ms | ease | border + text color |
| `VIEW ROLL →` hover | 120ms | ease | color shift |
| Mini-map paint (first render) | none | — | static SVG, no animation |

Reduced motion: thumbnail fade collapses to 0ms. Lightbox transitions collapse to 0ms.

---

## 7 · States

### 7.1 `/photos` roll index states

| state | what renders |
|---|---|
| default | as drawn in §2.2 |
| no rolls | `// no rolls surveyed yet.` in t-mono `var(--ink-faint)` |
| no film sim data across all rolls | film sim switcher absent |
| roll with 0 GPS-shared photos | `GPS SHARED` row absent for that roll |
| roll with more than 4 photos | 4 thumbs + `+NN more` slot |
| thumbnail loading | blank `var(--paper-warm)` before img loads (native browser behavior) |

### 7.2 `/photos/<roll>` single-roll states

| state | what renders |
|---|---|
| default | as drawn in §3.2 |
| no GPS-shared photos in roll | mini-map absent; roll summary fills right column |
| no film sim data in roll | film sim switcher absent |
| single photo in roll | contact sheet shows one thumbnail; lightbox still opens |
| lightbox open | lightbox overlays the entire viewport |
| lightbox navigating | arrow keys / swipe move between slides |
| lightbox closed | returns to roll page at same scroll position |
| empty roll (no photos) | should not occur if velite schema is correct; but if it does: single line `// no frames in this roll.` in t-mono `var(--ink-faint)` |

---

## 8 · Breakpoints

### 8.1 `/photos` roll index

| breakpoint | behavior |
|---|---|
| ≥881px | as drawn. thumbnail strip 4 across. full header strip. |
| 600–880px | thumbnail strip 3 across. header strip stacks: roll title on row 1, meta on rows 2–3. padding 16px. |
| 375–599px | thumbnail strip 2 across. same stacking. padding 16px. touch targets ≥44px. |

Roll cards: the thumbnail strip wraps naturally. The meta rows stack. The `VIEW ROLL →` CTA
remains a single-tap target (44px min height).

### 8.2 `/photos/<roll>` single-roll contact sheet

| breakpoint | behavior |
|---|---|
| ≥881px | two-column grid as drawn: 1fr contact sheet, 300px right column |
| 600–880px | single column. contact sheet 3-across grid. mini-map renders full-width (max 280px centered), below header. roll summary below mini-map. film sim switcher below summary. |
| 375–599px | single column. contact sheet 2-across grid. mini-map 200px centered. padding 16px. |

At ≤880px the right column drops below the contact sheet in source order. This is intentional:
the photographs are primary on mobile. The mini-map and summary are navigational context,
which the visitor can scroll to if needed.

---

## 9 · Accessibility

### 9.1 `/photos` roll index

- Roll list: semantic `<ul>` with each roll as `<li>`.
- Each roll card: a `<article>` (it is a self-contained content unit).
- Thumbnail strip `<img>` elements: `alt="<slug> thumbnail"`.
- `+NN more` slot: `aria-label="NN more photos in this roll"`.
- `VIEW ROLL →` link: `aria-label="View roll <roll title>"`.
- `[← BACK TO ATLAS]`: `aria-label="Return to ATLAS globe"`.
- Film sim switcher: `role="group"` with `aria-label="Film simulation palette"`;
  each button has `aria-pressed` state for the active sim.
- Roll index page title: `PHOTO ARCHIVE · <N> ROLLS`.

### 9.2 `/photos/<roll>` single-roll

- Contact sheet: `<ul role="list">` or grid container with `aria-label="<roll title> contact sheet"`.
- Each thumbnail: `<li>` containing `<button>` (not `<a>`) with `aria-label="Open photo <slug> in lightbox"`.
  Using `<button>` not `<a>` because the action is an overlay open, not a navigation.
- Lightbox: `yet-another-react-lightbox` ships with ARIA roles for dialog; Sirius verifies
  `role="dialog"` and `aria-modal="true"` are present in the library's output.
- Lightbox keyboard: Esc closes, arrow keys navigate — both standard lightbox behaviors;
  Sirius confirms library compliance.
- SVG mini-map: `role="img"` with `aria-label="Map showing GPS locations for roll <roll title>"`.
  Pins within the SVG have no individual `aria-label` — they are decorative within the
  accessible image container.
- `[← PHOTO ARCHIVE]` link: `aria-label="Return to photo archive"`.
- Roll summary `<dl>` with `<dt>`/`<dd>` pairs.

### 9.3 Keyboard map

| key | action |
|---|---|
| Tab | Nav → header affordances → film sim switcher pills → thumbnail grid → (lightbox when open) |
| Enter on thumbnail button | opens lightbox |
| Esc (lightbox open) | closes lightbox |
| ← / → (lightbox open) | navigate photos |
| Tab (lightbox open) | cycles through lightbox controls (close, zoom, prev, next) |
| Enter on `VIEW ROLL →` | navigates to roll page |

### 9.4 Lighthouse a11y target

≥95 on both `/photos` and `/photos/<roll>` templates.

---

## 10 · References (existing patterns reused)

- `Nav.tsx` — reused as-is
- `CornerMarks.tsx` — corner reticle in header strip
- `globals.css` · `.t-meta`, `.t-mono`, `.t-display`, `.section-rule-dashed`, `.paper-canvas`,
  `.corner-marks` — consumed, not modified
- `globals.css` · `[data-palette="*"]` blocks — film sim switcher extends existing toggle
- `ChapterIndex.tsx` — roll card's meta-label rhythm (t-meta strip) echoes ChapterIndex entry card
- `WorldlineGlobe.tsx` · `atlas-readout-row` — roll summary `<dl>` visual rhythm reuses this
- `lib/cartography.ts` — `orthographicCentered()` for SVG mini-map projection (if present;
  Sirius confirms before TASK-32)

---

## 11 · Non-goals

- No social sharing on the roll pages.
- No download affordance (the processed JPEG in `public/photos/` is accessible directly by URL
  for anyone who views source; no explicit download button needed).
- No comments on the roll.
- No "favorite" or "star" mechanism.
- No sorting controls — capture order is the only order. The contact sheet is chronological.
- No NeX Index Board scatter projection (deferred per journey-arch §9 row 09).
- No printable contact sheet.
- No Three.js instance on roll pages — the SVG mini-map is the map affordance.
- No infinite scroll — the contact sheet loads all thumbnails (lazy) in one page.
  Pagination is deferred to when rolls exceed ~200 photos.
- No lightbox on `/photos` roll index. Thumbnail click on the index links to the entry page;
  lightbox only on `/photos/<roll>`.

---

*betelgeuse · α-VIS-04 · TASK-2026-05-15-10 · photo atlas spec v1.0 · 2026-05-15*
