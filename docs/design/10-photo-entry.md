# docs/design/10-photo-entry.md
# Photo Entry Surface — TASK-2026-05-15-10 · γ-instance

> Status · v1.0 · 2026-05-15
> Author · Betelgeuse (α-VIS-04) · TASK-2026-05-15-10
> Predecessors · `journey-architecture.md` v1.2 §3.3 (photo contract) · `attractor-binding-mechanic.md` v1.1 §1.6 (Peat locked: earth-textured Globe, orbital network, transparency) · `prd-03-photo-atlas-deep-dive.md` (canonical for build patterns) · Procyon TASK-22 handoff (Photo type from `lib/content`)
> Downstream · TASK-31 (Sirius · photo entry route implementation) · TASK-30 (Procyon · EXIF + variants in-flight — spec is agnostic on impl details; consume Photo type from `@/lib/content`)
> Route · `/photos/<roll>/<id>`

---

## intent

The photo entry is the reading surface where a documentary photograph becomes an instrument
reading. It does not explain the photograph. It contextualises the photographer's decision:
where (GPS-opted-in coordinates), when, with what camera-thinking (EXIF as readout), inside
which roll (the analog-roll metaphor). The visitor lands here from a square glyph on the Globe
or from the roll contact sheet. The surface says: *this frame was a deliberate act of
measurement, anchored in space and time.*

What this surface is NOT: a social photo gallery. Not a lightroom preview. Not a portfolio
showcase. The instrument frame is the container; the photograph is the evidence inside it.

---

## 1 · Globe-to-entry click motion (binding §5 / journey-arch §2.3)

The two-step pattern from journey-arch §2.3 applies. The Globe is the protagonist; the
photo entry is the destination. The side-panel preview is the intermediate step.

### 1.1 Globe state when a photo glyph is hovered

- Square glyph (0.010 side, facing outward per `prd-03-photo-atlas-deep-dive.md` §4.2) brightens
  toward `var(--accent-orange)` in 120ms. Same color tween used for article pin hover.
- A 240px-wide preview card anchors at cursor offset (12px right, 12px below):
  - Roll name + capture date (t-mono, 9px, tracking 0.3em)
  - Film simulation label if present (t-mono, 9px, `var(--accent-orange)`)
  - Thumbnail (thumb variant, 60×60, object-fit: cover)
  - One-line caption if present (italic Cormorant, 11px, `var(--ink-soft)`)
- Preview card visual: `var(--paper-warm)` background, 1px solid `var(--ink-primary)`,
  box-shadow 3px 3px 0 `rgba(31,80,99,0.16)` — identical to article hover preview card.
- NETRA voice strip: unchanged at hover. Voice reserved for selection, not hover.

### 1.2 Globe state when a photo glyph is clicked (first click)

- Camera flies from current position to a tangent-offset above the glyph's GPS coordinate
  (1100ms easeInOutCubic, same contract as article pin).
- In-Globe side panel slides in from the right (520ms cubic-bezier(.2,.8,.2,1), 320ms opacity).
- Side panel contents (photo preview variant):
  ```
  ┌────────────────────────────────────────┐
  │  FILE — PHOTO · <roll>/<slug>           │
  │  <YYYY.MM.DD> · <FILM SIM>              │
  │                                         │
  │  ┌────────────────────────────────┐     │
  │  │ medium variant thumbnail       │     │
  │  │ (100% panel width, max 360px)  │     │
  │  └────────────────────────────────┘     │
  │                                         │
  │  <caption — italic Cormorant 13px>      │
  │  (hidden if no caption)                 │
  │                                         │
  │  CAMERA   <camera label>                │
  │  FILM     <filmSim — accent-orange>     │
  │  EXPOSURE f/<ap> · <shutter> · <ISO>   │
  │                                         │
  │  [ VIEW ENTRY → ]                       │
  └────────────────────────────────────────┘
  ```
- `VIEW ENTRY →` navigates to `/photos/<roll>/<id>`.
- ESC or click outside closes panel (same contract as article side panel).
- Reduced motion: camera cut is instantaneous (0ms); slide-in still uses opacity only.

### 1.3 Earth-textured Globe convention (binding §1.6)

This surface respects the locked direction: the Globe's earth-textured base is the coordinate
context. Photo glyph square placement is geographic — GPS-precise on real continent/landmass.
The surface itself does not render the Globe, but it receives the coordinate context via the
route (GPS coords, if shared) and surfaces it in the instrument readout. The surface must not
invent a map element; if a mini-map is needed at the entry level, it is the SVG orthographic
from `/photos/<roll>`, not a Three.js instance.

---

## 2 · Layout

Route: `/photos/<roll>/<id>` · full-page entry surface.

```
┌────────────────────────────────────────────────────────────────────┐
│ NAV STRIP (reuses Nav.tsx — no changes)                            │
│ ◇ INDEX · ◇ TRACES · ◇ ARCHIVE · ◇ TRANSMIT · A 1.130426 NAV STANDBY│
├────────────────────────────────────────────────────────────────────┤
│ HEADER STRIP (mono uppercase, 9px, tracking 0.3em)                 │
│ ┌─┐ PHOTO — <ROLL> / <SLUG>              A 1.130426 · NAV STANDBY  │
│ └─┘ <YYYY.MM.DD> · <FILM SIM> · <CAMERA>                          │
│     <COORD if share-location=true>                                 │
│     [← BACK TO ATLAS]  · [⇋ <ROLL TITLE>]                         │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  GRID: [260px LEFT] [1fr CENTER] [240px RIGHT]                     │
│                                                                    │
│  ┌─────────────┐  ┌──────────────────────────┐  ┌─────────────┐  │
│  │ INSTRUMENT  │  │ ┌──────────────────────┐  │  │ ROLL        │  │
│  │ READOUT     │  │ │                      │  │  │ CONTEXT     │  │
│  │             │  │ │  PHOTOGRAPH          │  │  │             │  │
│  │ § INSTRUMENT│  │ │  (film-strip border) │  │  │ PREV        │  │
│  │ ─────────── │  │ │                      │  │  │ ┌────────┐  │  │
│  │ CAMERA  ··· │  │ └──────────────────────┘  │  │ │ 60×60  │  │  │
│  │ LENS    ··· │  │                            │  │ └────────┘  │  │
│  │ FILM    ··· │  │ CAPTION (if present)       │  │ <title or   │  │
│  │ EXPOSURE··· │  │ italic Cormorant 13px       │  │ capture ts> │  │
│  │ FOCAL   ··· │  │ ink-soft                   │  │             │  │
│  │ CAPTURED··· │  │                            │  │ NEXT        │  │
│  │ COORD   ··· │  │ FILM SIM SUGGESTION        │  │ ┌────────┐  │  │
│  │  (if shared)│  │ [match palette to          │  │ │ 60×60  │  │  │
│  │             │  │  CLASSIC CHROME · ⌃P]      │  │ └────────┘  │  │
│  │             │  │                            │  │ <title or   │  │
│  └─────────────┘  └──────────────────────────┘  │  capture ts> │  │
│                                                  │             │  │
│                                                  │ [⇋ FULL ROLL]│  │
│                                                  └─────────────┘  │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│ FOOTER — PREV/NEXT within roll (chronological)                     │
│ ← PREV IN ROLL · NEXT IN ROLL →                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 2.1 Header strip

Same vocabulary as article entry (journey-arch §3.5). Atoms:

- Corner reticle (top-left): `.corner-marks` — `var(--accent-orange)` L-bracket marks
- File meta row: `PHOTO — <ROLL> / <SLUG>` in t-mono 9px tracking 0.3em `var(--ink-soft)`
- Date + film sim + camera shorthand: t-mono 9px `var(--ink-soft)`, film sim in `var(--accent-orange)`
- Coord row (conditional): `<lat>°N · <lon>°E · <place label>` — only renders when
  `shareLocation === true` AND `coords !== undefined`. Missing field = entire coord row absent.
  Never render empty or placeholder coords.
- Back affordances: t-mono 9px, `var(--ink-soft)` for `[← BACK TO ATLAS]`;
  `var(--accent-orange)` hover state. `[⇋ <ROLL TITLE>]` uses same treatment.
- Right-side readout: `A 1.130426 · NAV STANDBY` — text only, never pill (journey-arch §3.5 RESOLVED).
  When NETRA is active: `A 1.130426 · NAV NETRA`. Never any other variant.

The `[← BACK TO ATLAS]` link navigates `/` with
`state: { returnTo: '<roll>/<id>', stratum: 'neo' }` via zustand `useGlobeStore` or session
storage — Sirius decides storage mechanism. The spec does not dictate it. Back-affordance is
an anchor, not a `<button>`.

### 2.2 Instrument readout (left column)

Reuses `atlas-readout-row` vocabulary from `WorldlineGlobe.tsx` readout aside. The label +
value pair pattern is established; Sirius replicates it in DOM form.

```
§ INSTRUMENT
─────────────────────
CAMERA     <Make> <Model>
LENS       <LensModel>
FILM       <filmSim>        ← var(--accent-orange) for value only
EXPOSURE   f/<ap> · <shutter> · ISO <iso>
FOCAL      <focal>mm (35eq: <focal35>mm)
CAPTURED   <YYYY.MM.DD> <HH:MM>
COORD      <lat>°N · <lon>°E   ← only when shareLocation=true
```

Empty / no-EXIF state: when EXIF data is entirely absent (stripped by processing tool),
the block renders:
```
§ INSTRUMENT
─────────────────────
// no instrument data
// recovered from source
```
in t-mono 9px `var(--ink-faint)`. No placeholder rows. The block does not hide entirely —
its presence signals that measurement was attempted.

Single-field missing (e.g., no lens model): that row is omitted entirely. No empty labels.
No "—" placeholder values.

TASK-30 (Procyon) is in-flight extending the Photo schema with EXIF + variants. This spec
is agnostic on how EXIF fields are populated; it consumes `Photo.exif.*` from `@/lib/content`.
Sirius: do not import from `.velite` directly — use `@/lib/content` accessors.

### 2.3 Photo display (center column)

#### Film-strip border

The photo is contained in a film-strip frame. This is the **only new visual element** in
the photo entry surface (journey-arch §3.3).

```
outer margin:  8px var(--paper-warm)  (evoking the film-carrier sleeve)
inner border:  4px solid var(--ink-faint)
photo itself:  full-bleed within the frame, `object-fit: contain`
```

**Real image state** (variants loaded):
- Render `<picture>` with avif / webp / jpg sources (full variant from TASK-30 output).
- `alt` attribute: caption text if present; otherwise `"PHOTO <SLUG> · <ROLL>"`.
- `loading="eager"` for the primary entry (above the fold).
- `decoding="async"` for performance.
- Max-width of the photo column: 100% of the center column; no fixed pixel cap in desktop.

**Loading state** (variants not yet loaded / before hydration):
- Do NOT use a gradient placeholder — this reads as "accidentally finished" (REVIEW finding N2).
- Render a **checkered film-leader pattern**:
  - 16×16px repeating squares alternating `var(--paper-deep)` and `var(--paper-warm)`.
  - The pattern is generated via CSS:
    `background-image: repeating-conic-gradient(var(--paper-deep) 0% 25%, var(--paper-warm) 0% 50%);`
    `background-size: 16px 16px;`
  - Minimum height: 200px (landscape implied); aspect-ratio: 3/2 as default before dimensions known.
  - The film-strip border frame is present during loading — the checker fills inside it.
  - No spinner. No progress bar. The pattern itself is the loading signal.

**No-image / error state** (src fails):
- Same checkered film-leader pattern, but with overlay text centered:
  ```
  // frame lost
  // <SLUG>
  ```
  in t-mono 9px `var(--ink-faint)`. The frame border stays.

#### Film-simulation suggestion affordance

When `exif.filmSim` is present AND differs from current site palette:

```
[match palette to CLASSIC CHROME · ⌃P]
```

- t-mono 9px, `var(--ink-soft)`, renders as an underlined link beneath the photo.
- `⌃P` label: t-mono 9px, `var(--accent-orange)`.
- On click OR ⌃P keypress (when this page is focused): sets `data-palette` on `<html>`
  and writes `wl:film-sim` to localStorage. Does NOT auto-apply on page load. Visitor controls.
- The suggestion is a one-liner. It does not expand. No preview, no toggle preview pane.
- If current palette already matches: do not render the suggestion at all.
- Palette value mapped from filmSim string (per PRD-03 deep-dive §8.1 CSS blocks):
  - `"Classic Chrome"` → `data-palette="classic-chrome"`
  - `"Acros"` → `data-palette="acros"`
  - `"Reala Ace"` → `data-palette="reala-ace"`
  - `"Velvia"` → `data-palette="velvia"`
  - `"Provia"` or no match → remove `data-palette` attribute (base palette)
- Sirius wires the keypress handler. Betelgeuse specifies only the visual.

#### Caption

If `photo.caption` is present:
- italic Cormorant Garamond 13px, `var(--ink-soft)`, leading 1.6.
- Margin: 12px above the film-sim suggestion (or 12px below photo if no suggestion).
- Not wrapped in quotes. Not prefixed with a label. The text stands alone.

If no caption: element absent. No empty paragraph. No "no caption" placeholder.

### 2.4 Roll context (right column)

Provides roll adjacency without navigating away.

```
PREV IN ROLL
┌──────────┐
│  60×60   │   ← thumb variant, object-fit: cover
│ thumbnail │
└──────────┘
<capture date or slug>       ← t-mono 9px var(--ink-soft)

NEXT IN ROLL
┌──────────┐
│  60×60   │
│ thumbnail │
└──────────┘
<capture date or slug>

[⇋ FULL ROLL]               ← t-mono 9px, links to /photos/<roll>
```

- "PREV IN ROLL" and "NEXT IN ROLL" labels: t-meta class (9px mono uppercase `var(--ink-soft)`).
- When no prev exists: "PREV IN ROLL" block absent (do not render a disabled state or em-dash).
- When no next exists: "NEXT IN ROLL" block absent.
- When only one photo in the roll: both absent; `[⇋ FULL ROLL]` still renders.
- Thumbnails link to their respective entry pages.
- `[⇋ FULL ROLL]` always renders when a roll is present.

### 2.5 Footer

Single row below the three-column grid:

```
← PREV IN ROLL                            NEXT IN ROLL →
```

- t-mono 9px, `var(--ink-soft)`.
- Prev / next labels include the slug or a very short capture-date shorthand.
- When no prev: left slot empty (the row still renders with NEXT on the right).
- When no next: right slot empty.
- Section rule above the footer: 1px dashed `var(--ink-dashed)`.

---

## 3 · Tokens used

| role | token |
|---|---|
| page surface | `var(--paper-base)` |
| paper grain texture | `.paper-canvas` class |
| header / readout labels | `var(--ink-soft)` |
| body ink | `var(--ink-primary)` |
| accent (film sim label, ⌃P, corner reticles) | `var(--accent-orange)` |
| film-strip border | `var(--ink-faint)` |
| film-strip margin | `var(--paper-warm)` |
| checker loading pattern (dark square) | `var(--paper-deep)` |
| checker loading pattern (light square) | `var(--paper-warm)` |
| section rules | `var(--ink-dashed)` |
| header strip surface | `var(--paper-base)` (no separate surface token needed) |

No raw hex values. No new tokens proposed.

---

## 4 · Typography

| element | family | size | weight | style | color |
|---|---|---|---|---|---|
| all meta labels | JetBrains Mono (`t-mono`) | 9px | 400 | uppercase | `var(--ink-soft)` |
| film sim value in readout | JetBrains Mono | 9px | 400 | uppercase | `var(--accent-orange)` |
| readout section header (`§ INSTRUMENT`) | JetBrains Mono (`t-meta`) | 9px | 400 | uppercase | `var(--ink-soft)` |
| caption | Cormorant Garamond | 13px | 400 | italic | `var(--ink-soft)` |
| film-sim suggestion | JetBrains Mono | 9px | 400 | uppercase | `var(--ink-soft)` |
| `⌃P` accent | JetBrains Mono | 9px | 400 | uppercase | `var(--accent-orange)` |
| thumbnail caption / date | JetBrains Mono | 9px | 400 | uppercase | `var(--ink-soft)` |
| footer prev/next | JetBrains Mono | 9px | 400 | uppercase | `var(--ink-soft)` |

No new font families. No new sizes outside the existing scale.

---

## 5 · Motion

All motion values from the established contract. No new values.

| trigger | duration | easing | what moves |
|---|---|---|---|
| Globe camera fly to photo glyph | 1100ms | easeInOutCubic | Globe camera |
| In-Globe side panel open | 520ms | cubic-bezier(.2,.8,.2,1) | side panel transform |
| In-Globe side panel opacity | 320ms | cubic-bezier(.2,.8,.2,1) | side panel opacity |
| Photo `<img>` fade-in on load | 200ms | ease-out | img opacity 0→1 |
| Film-sim suggestion link hover | 120ms | ease | color shift (ink-soft → ink-primary) |
| Back-to-ATLAS link hover | 120ms | ease | color shift (ink-soft → accent-orange) |

**No enter animation** on the photo entry page itself. This is a reading surface (same rationale
as article entry). No fade-in scroll-activated animations. No stagger.

**Reduced motion:** The photo `<img>` fade-in collapses to 0ms. Hover color shifts collapse
to 0ms. Globe camera cut is instantaneous. These follow the existing `prefers-reduced-motion`
media query pattern already established in `WorldlineGlobe.tsx`.

---

## 6 · States

| state | what renders | notes |
|---|---|---|
| default | as drawn in §2 | — |
| image loading | film-leader checker inside film-strip border; real image replaces on load | no spinner |
| image error | checker + `// frame lost` overlay | border stays |
| no caption | caption element absent | no placeholder |
| no EXIF | `// no instrument data / // recovered from source` in readout | block does not hide |
| partial EXIF | missing rows omitted individually | no empty labels |
| share-location=false | coord row absent from header strip + readout | never show or infer coords |
| share-location=true, no GPS | coord row absent (GPS undefined) | same as above |
| no prev in roll | PREV block absent in right column + left footer slot empty | |
| no next in roll | NEXT block absent in right column + right footer slot empty | |
| only one photo in roll | both prev/next absent; `[⇋ FULL ROLL]` still shows | |
| current palette = photo's film sim | film-sim suggestion absent | |
| film-sim suggestion shown | renders below photo, above footer | only when exif.filmSim differs from current palette |
| ⌃P pressed | `applyPalette(filmSim)` runs; suggestion disappears (palette now matches) | |
| NETRA active | Nav right-readout shows `NAV NETRA` | no other visual change on this surface |

---

## 7 · Breakpoints

### 7.1 Desktop (≥1024px)

Three-column grid as drawn: `[260px_1fr_240px]`. Gutters: 32px. Padding: 40px horizontal.

### 7.2 881–1023px

Three columns collapse to two: instrument readout stacks above the photo center column;
roll context remains on the right at 200px (from 240px). The left column drops below the photo.

```
┌────────────────────────────────────────┐
│ NAV STRIP                              │
├────────────────────────────────────────┤
│ HEADER STRIP                           │
├────────────────────────────────────────┤
│ ┌─────────────────────────┐ ┌──────┐  │
│ │ INSTRUMENT READOUT      │ │ ROLL │  │
│ │ (collapsed 2-col grid)  │ │ CTXT │  │
│ └─────────────────────────┘ └──────┘  │
│ ┌─────────────────────────────────────┐│
│ │ PHOTO (film-strip border, full width)││
│ └─────────────────────────────────────┘│
│ CAPTION · FILM SIM SUGGESTION          │
│ ─────────────────────────────────────  │
│ FOOTER PREV/NEXT                       │
└────────────────────────────────────────┘
```

### 7.3 600–880px (journey-arch §7.1 mobile-primary)

Single column. Order top-to-bottom:
1. Header strip (stacks: file/date/film on row 1; coords on row 2 if shared)
2. Instrument readout (full width, 2-row label/value grid)
3. Photo (film-strip border, full width)
4. Caption
5. Film-sim suggestion
6. Roll context (prev/next thumbs inline: [PREV] · [⇋ FULL ROLL] · [NEXT] )
7. Footer

Section rules (`var(--ink-dashed)`) between major sections.
Padding: 16px horizontal (`px-4`).
Touch targets: all clickable elements ≥ 44px tall.

Roll context collapses: prev/next thumbnails become a single row of 48×48 thumbs with
`[← PREV] · [FULL ROLL] · NEXT →]` text links inline. Thumbnails optional (may show
text-only at this breakpoint to avoid layout pressure).

### 7.4 375–599px

Identical to 600–880px with tighter padding: 16px (`px-4`, same) — no further reduction.
Font size for caption stays at 13px. Instrument readout reads at 9px (same). Do not scale down.

Film-strip border: 4px border and 8px margin both preserved. The photo simply fits narrower.

---

## 8 · Accessibility

### 8.1 Keyboard map

| key | action |
|---|---|
| Tab | focus Nav links → header affordances → film-sim suggestion → roll context thumbs → footer nav |
| Enter on `[← BACK TO ATLAS]` | navigate to `/` with Globe return state |
| Enter on `[⇋ FULL ROLL]` | navigate to `/photos/<roll>` |
| Enter on prev/next thumbnails | navigate to adjacent photo entry |
| ⌃P (when page focused, no input focused) | apply film simulation palette |
| Esc | (handled by NETRA drawer if open; no special handling on this page) |

### 8.2 Screen reader text

- Photo `<img>`: `alt` = caption text if present; `alt="PHOTO <slug> · <roll>"` if no caption.
  Never empty alt on a content image.
- Film-sim suggestion link: `aria-label="Apply <FILM SIM NAME> palette to site"`.
- Prev/next thumbnail links in roll context: `aria-label="Previous photo in roll: <slug or date>"` /
  `aria-label="Next photo in roll: <slug or date>"`.
- `[⇋ FULL ROLL]` link: `aria-label="View full roll <roll title>"`.
- `[← BACK TO ATLAS]` link: `aria-label="Return to ATLAS globe"`.
- Instrument readout: a `<dl>` (definition list) with `<dt>` for labels, `<dd>` for values.
  The `§ INSTRUMENT` header is an `<h2>` scoped to the aside.

### 8.3 Focus visibility

All interactive elements use the existing focus ring from `globals.css` (not separately defined —
Sirius confirms existing outline is visible; if absent, adds `outline: 2px solid var(--accent-orange);
outline-offset: 2px` as the global rule, which is Sirius's territory).

### 8.4 ARIA landmarks

- `<Nav>` is `<nav>` (existing `Nav.tsx`).
- Header strip: `<header>`.
- Instrument readout aside: `<aside aria-label="Camera instrument readout">`.
- Photo: `<main>` wrapping the photo + caption block.
- Roll context: `<aside aria-label="Roll navigation">`.
- Footer: `<footer>`.

### 8.5 Lighthouse a11y target

≥95 on the photo entry template. This is the same bar as the article entry (journey-arch quality bar).

---

## 9 · References (existing patterns being reused)

- `Nav.tsx` — header strip reuses as-is
- `WorldlineGlobe.tsx` — `atlas-readout-row` vocabulary; `is-trio` pattern (not copying DOM;
  visual rhythm is the reference)
- `WorldlineGlobe.tsx` — side panel motion contract (520ms / 320ms cubic-bezier)
- `ChapterIndex.tsx` — no direct reuse, but the t-mono 9px uppercase label rhythm is consistent
- `CornerMarks.tsx` — corner reticle pattern for header strip
- `globals.css` · `.t-meta`, `.t-mono`, `.t-display`, `.section-rule-dashed`, `.marginalia`,
  `.paper-canvas`, `.corner-marks` — all consumed, none modified
- `globals.css` · `[data-palette="*"]` blocks (PRD-03 deep-dive §8.1) — the film-sim palette
  switcher extends this existing toggle mechanism; no new mechanism invented

---

## 10 · Non-goals

- No commenting system.
- No reading-progress bar (the global scroll-meter from `.marginalia` covers this).
- No print stylesheet.
- No lightbox from the single entry page. Lightbox lives in `/photos/<roll>` contact sheet.
- No "related photos" block — the roll context strip (prev/next) is the adjacency affordance.
- No sharing buttons or social meta (Open Graph tags are infrastructure, not a visual spec).
- No auto-apply of film simulation on page load. Suggestion only. Visitor controls.
- No map element at the entry level. The coord is in the readout; the spatial context is the Globe.
- No fiction entry surface (deferred per journey-arch §3.4).
- No NeX Index Board scatter projection (deferred per journey-arch §9 row 09).

---

*betelgeuse · α-VIS-04 · TASK-2026-05-15-10 · photo entry spec v1.0 · 2026-05-15*
