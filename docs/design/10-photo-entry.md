# docs/design/10-photo-entry.md
# Photo Entry Surface — v2.0

> Status · v2.0 · 2026-05-17
> Author · Betelgeuse (α-VIS-04)
> Tasks · v1.0: TASK-2026-05-15-10 · v2.0: TASK-2026-05-17-PHOTO-FILMSIM-REFINE
> Soul baseline · `.claude/visual-diffs/UI-ITER-1-globe-v1/prototype/index.html` (RW-5 AMEND-9b locked)
> Predecessors · `journey-architecture.md` v1.2 §3.3 · `attractor-binding-mechanic.md` v1.1 §1.6 · `prd-03-photo-atlas-deep-dive.md` · `00-globe-ontology-1.2.md` v1.3
> Downstream · TASK-31 (Sirius · photo entry route) · TASK-30 (Procyon · EXIF + variants)
> Route · `/photos/<roll>/<id>`

---

## changelog v1.0 → v2.0

| section | verdict | rationale |
|---|---|---|
| intent | KEEP | "instrument reading, not gallery" holds; "deliberate act of measurement" is still load-bearing (SBA-2 T3) |
| layout | REFINE | header strip rhythm tightened to iter 1 frame-head discipline; NETRA L1 bay added; square glyph color rule resolved; paper-mount metaphor decision recorded |
| tokens used | REFINE | audited against iter 1 ink-ladder; `rgb(var(--ink-rgb)/N)` replaces raw rgba; box-shadow raw rgba removed from hover card; no raw hex anywhere |
| typography | REFINE | tabular-nums lock added for numeric EXIF fields; `--ink-faint` upgraded to `--ink-soft` for meta labels per P1-6 contrast lesson |
| motion | REFINE | filmSim palette-switch transition added; hover 120ms / selected 250ms terminology adopted; palette-swap is near-instant with brief body-opacity dip |
| states | REFINE | NETRA L1 state variants added (coord present / no coord); filmSim suggestion gating made explicit |
| breakpoints | REFINE | ≤600 roll-context inline row treatment corrected; touch targets verified at 44px; NETRA L1 at ≤600 specified |
| accessibility | RE-WRITE | iter 1 focus ring vocabulary adopted; instrument readout `<dl>` semantic re-examined; keyboard map completed; filmSim suggestion `aria-label` tightened |
| references | REFINE | iter 1 prototype section/line citations added throughout |
| non-goals | KEEP | unchanged |
| NEW — square glyph color | NEW | at-rest vs hover decision (globe-ontology §3.2 tinted-by-filmSim rule) |
| NEW — paper-mount vs film-strip | NEW | metaphor re-evaluated post iter 1 paper-canvas lock |
| NEW — EXIF tabular-nums | NEW | numeric field rhythm lock |
| NEW — GPS coord format | NEW | exact format `13.04°N · 100.50°E` canonical |
| NEW — NETRA L1 binding | NEW | photo-entry NETRA L1 instrument-bay spec |
| NEW — §FILM SIMULATION | NEW | first-class feature section, 6 sub-sections (Part B) |
| NEW — vision fidelity block | NEW | required per VISION-FIDELITY §5 |

**New tokens added:** none. All color, type, and spacing through existing `app/globals.css` variables.

---

## vision fidelity

```text
soul baseline      · `.claude/visual-diffs/UI-ITER-1-globe-v1/prototype/index.html`
                     RW-5 AMEND-9b locked · iter 1 canonical · teal palette active
                     `docs/team/.soul-baseline/visual.md` (SBA-1) · §1.6 atlas-frame vocabulary
                     `docs/team/.soul-baseline/voice.md` (SBA-2) · §3 vega-protected patterns
aesthetic invariants · I1 (garden under measurement — photo has file ref, GPS coord, EXIF instrument row)
                       I3 (Peat in the instrument layer — filmSim is Peat's decision, not an EXIF prop)
                       I5 (quality visible — paper-mount must not feel like a stock photo frame)
Peat signal        · "FILM SIMULATION ... ที่มีUI คร่าวๆ" (2026-05-16) — filmSim called as highlight
                     token-compliance lesson from iter-1 review (REVIEW-2026-05-14: raw hex = reject)
allowed evolution  · filmSim as worldline mechanic (borrowed-eye palette extension)
                     NETRA L1 carryover to photo surface
                     paper-mount metaphor (post iter 1 paper-canvas lock)
                     post-iter-1 ink-ladder discipline
forbidden dilution · filmSim as brand stamp or decoration (not a tag, a decision trace)
                     raw color values anywhere outside globals.css
                     ink-faint on any functioning label (use ink-soft per P1-6)
                     photo as social gallery or lightroom preview
                     generic photo-frame / stock graphic treatment
                     palette-switch as "settings toggle" vocabulary (use worldline language)
loss budget        · P1: no raw hex · P2: no new visual vocabulary · P3: filmSim presence = quiet, not shouty
rendered checkpoint · Worldline Pages v1.html artboards 03 (photo entry/atlas) + 08 (NeX contact sheet)
                      + 09 (NeX index board) cited where applicable
```

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

**Iter 1 lesson (REVIEW-2026-05-14-worldline-pages-v1.md):** hover card had raw `rgba` box-shadow.
v2 corrects to token-only.

- Square glyph (0.010 side, facing outward per `prd-03-photo-atlas-deep-dive.md` §4.2):
  at rest = `var(--ink-primary)` tinted. On hover = brightens toward filmSim-specific tint when
  available (per globe-ontology §3.2 "tinted by the photo's film simulation when available");
  fallback to `var(--accent-orange)`. Tween: 120ms ease.
- A 240px-wide preview card anchors at cursor offset (12px right, 12px below):
  - Roll name + capture date (t-mono 9px tracking 0.3em)
  - Film simulation label if present (t-mono 9px `var(--accent-orange)`)
  - Thumbnail (thumb variant, 60×60, object-fit: cover)
  - One-line caption if present (italic Cormorant 11px `var(--ink-soft)`)
- Preview card visual: `var(--paper-warm)` background, `1px solid var(--ink-primary)`,
  box-shadow `3px 3px 0 rgb(var(--ink-rgb) / 0.16)` — token-only, no raw rgba.
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
  │  EXPOSURE f/<ap> · <shutter> · ISO <iso>│
  │                                         │
  │  [ VIEW ENTRY → ]                       │
  └────────────────────────────────────────┘
  ```
- `VIEW ENTRY →` navigates to `/photos/<roll>/<id>`.
- ESC or click outside closes panel (same contract as article side panel).
- Reduced motion: camera cut is instantaneous (0ms); slide-in still uses opacity only.

### 1.3 Earth-textured Globe convention (binding §1.6)

Photo glyph square placement is geographic — GPS-precise on real continent/landmass.
The surface itself does not render the Globe, but receives coordinate context via the route
(GPS coords, if shared) and surfaces it in the instrument readout. No map element at
entry level — coord in the readout; spatial context is the Globe. Mini-map if needed is
the SVG orthographic from `/photos/<roll>`, not a Three.js instance.

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
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│ NETRA L1 BAY (conditional — only when NETRA active)                │
│ NETRA ▸ locus · PHOTO <roll>/<slug> · <filmSim> · <coord label>   │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  GRID: [260px LEFT] [1fr CENTER] [240px RIGHT]                     │
│                                                                    │
│  ┌─────────────┐  ┌──────────────────────────┐  ┌─────────────┐  │
│  │ INSTRUMENT  │  │ ┌──────────────────────┐  │  │ ROLL        │  │
│  │ READOUT     │  │ │                      │  │  │ CONTEXT     │  │
│  │             │  │ │  PHOTOGRAPH          │  │  │             │  │
│  │ § INSTRUMENT│  │ │  (paper-mount frame) │  │  │ PREV        │  │
│  │ ─────────── │  │ │                      │  │  │ ┌────────┐  │  │
│  │ CAMERA  ··· │  │ └──────────────────────┘  │  │ │ 60×60  │  │  │
│  │ LENS    ··· │  │                            │  │ └────────┘  │  │
│  │ FILM    ··· │  │ CAPTION (if present)       │  │ <title or   │  │
│  │ EXPOSURE··· │  │ italic Cormorant 13px       │  │ capture ts> │  │
│  │ FOCAL   ··· │  │ ink-soft                   │  │             │  │
│  │ CAPTURED··· │  │                            │  │ NEXT        │  │
│  │ COORD   ··· │  │ FILM SIM SUGGESTION        │  │ ┌────────┐  │  │
│  │  (if shared)│  │ (when palette ≠ filmSim)   │  │ │ 60×60  │  │  │
│  │             │  │                            │  │ └────────┘  │  │
│  └─────────────┘  └──────────────────────────┘  │ <title or    │  │
│                                                  │  capture ts> │  │
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
  (established pattern: `CornerMarks.tsx` / `.corner-marks` in `globals.css`)
- File meta row: `PHOTO — <ROLL> / <SLUG>` in t-mono 9px tracking 0.3em `var(--ink-soft)`
- Date + film sim + camera shorthand: t-mono 9px `var(--ink-soft)`, film sim in `var(--accent-orange)`
- Coord row (conditional): `<lat>°N · <lon>°E · <place label>` — canonical GPS format
  (matching `.atlas-coord-pin` format from `globals.css`: degree symbol · middle-dot separator).
  Only renders when `shareLocation === true` AND `coords !== undefined`.
  Never render empty or placeholder coords.
- Back affordances: t-mono 9px, `var(--ink-soft)` for `[← BACK TO ATLAS]`;
  `var(--accent-orange)` hover state. `[⇋ <ROLL TITLE>]` uses same treatment.
- Right-side readout: `A 1.130426 · NAV STANDBY` — text only, never pill (journey-arch §3.5 RESOLVED).
  When NETRA is active: `A 1.130426 · NAV NETRA`. Never any other variant.
- Section separator below header content (dashed): `1px dashed var(--ink-dashed)`.

### 2.1a NETRA L1 bay

**Iter 1 lesson:** article-refine added NETRA L1 as a distinct bay below the header dashed rule.
Photo entry follows the same protocol.

```
NETRA L1 BAY (single-line, collapsed unless NETRA active)
──────────────────────────────────────────────────────
NETRA ▸  locus · PHOTO <roll>/<slug> · <filmSim> · <coord label>
```

- Renders only when NETRA session is active (same gate as article L1).
- Surface: `var(--paper-warm)`, left-border `2px solid var(--netra)`.
- Tag: t-mono 9px `var(--netra)`, uppercase `NETRA ▸`.
- Body: italic Cormorant 12px `var(--ink-primary)`.
- Content varies by photo state:
  - Coord present + filmSim: `locus · PHOTO <slug> · <filmSim> · <lat>°N · <lon>°E`
  - No coord, filmSim: `locus · PHOTO <slug> · <filmSim> · coordinate withheld`
  - No coord, no filmSim: `locus · PHOTO <slug> · instrument trace · coordinate withheld`
- Hidden when NETRA inactive. Does not reserve space — collapses fully (no empty bay).
- At ≤600px: bay stacks below header row; full-width; left-border retained.

NETRA L1 state machine (photo surface):
```
NETRA inactive   → bay absent
NETRA active, photo entry loaded → bay renders with photo locus
NETRA active, coord withheld → bay renders with "coordinate withheld"
NETRA active, no filmSim → bay renders without filmSim segment
```

The `[← BACK TO ATLAS]` link navigates `/` with
`state: { returnTo: '<roll>/<id>', stratum: 'neo' }` via zustand `useGlobeStore` or session
storage — Sirius decides storage mechanism. Back-affordance is an anchor, not a `<button>`.

### 2.2 Instrument readout (left column)

Reuses `atlas-readout-row` vocabulary from `WorldlineGlobe.tsx` readout aside.

**Delta — tabular-nums (iter 1 / RW-3 NETRA D1 lesson applied to photo):**
Numeric fields — aperture, shutter, ISO, focal length — must render with `font-feature-settings: "tnum"`.
These numerals must not shift width between frames (e.g., ISO 100 vs ISO 3200). Sirius wraps
numeric value spans with class `tabular-nums` (which sets `font-feature-settings: "tnum"`).
This is a typographic-stability requirement, not a style choice.

**Delta — GPS coord format:**
The COORD row uses the canonical format from the `.atlas-coord-pin` class in `globals.css`:
`<lat>°N · <lon>°E` — degree symbol immediately after the number, no space, then middle-dot
separator. Example: `13.04°N · 100.50°E`. Ordering: latitude always first, longitude second.
Place label on next line if present, in t-mono 9px `var(--ink-soft)`.

```
§ INSTRUMENT
─────────────────────
CAMERA     <Make> <Model>
LENS       <LensModel>
FILM       <filmSim>        ← var(--accent-orange) for value only
EXPOSURE   f/<ap> · <shutter> · ISO <iso>   ← tabular-nums on all numerals
FOCAL      <focal>mm (35eq: <focal35>mm)     ← tabular-nums
CAPTURED   <YYYY.MM.DD> <HH:MM>
COORD      <lat>°N · <lon>°E               ← only when shareLocation=true
           <place label>
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

### 2.3 Photo display (center column)

#### Paper-mount frame (metaphor decision, post iter 1)

**v1 used a film-strip border** described as "the only new visual element." After iter 1's
paper-canvas lock (`.paper-canvas` is the canonical site surface, grain + scanlines), the
film-strip border was re-evaluated.

**Decision: paper-mount metaphor, not film-strip border.**

Rationale: the film-strip border (checkered leader, perforations, dark sleeve) belongs to the
darkroom / negative world. The site's paper-canvas is archival paper — the reading surface.
A photograph on archival paper sits in a *mount* (the white or cream border around a print,
evoking contact prints and archival sleeves). The mount is the more honest metaphor for this
surface's texture.

Visual treatment:
```
outer margin:  12px var(--paper-warm)   (paper-mount border; warmer than the base canvas)
inner rule:    1px solid var(--ink-faint) (fine archival-print edge rule)
photo itself:  full-bleed within the mount, object-fit: contain
```

The 12px `var(--paper-warm)` margin is wider than the v1 8px to reinforce the mount metaphor.
The 1px rule is thinner than v1's 4px to read as fine print edge, not frame. The checkered
film-leader loading pattern is retained as the *loading state* only (see loading state below) —
it is functional, not decorative.

The FILM SIMULATION label (small, t-mono 9px `var(--ink-soft)`, uppercase) sits in the
bottom-right of the mount margin as a *caption of the mount*, not overlaid on the photo:

```
┌──────────────────────────────────────────────────────┐  (paper-warm margin)
│  ┌────────────────────────────────────────────────┐  │  (ink-faint rule)
│  │                                                │  │
│  │              PHOTOGRAPH                        │  │
│  │                                                │  │
│  └────────────────────────────────────────────────┘  │
│                                         CLASSIC CHROME│  (filmSim label in mount, right-aligned)
└──────────────────────────────────────────────────────┘
```

Film sim label in mount: t-mono 9px `var(--ink-soft)`, uppercase, tracking 0.3em.
Not in `var(--accent-orange)` — the mount label is ambient, not an accent.
This is the only presence of filmSim as a *decorative mark* — it is quiet.

#### Real image state (variants loaded)

- Render `<picture>` with avif / webp / jpg sources (full variant from TASK-30 output).
- `alt` attribute: caption text if present; otherwise `"PHOTO <SLUG> · <ROLL>"`.
- `loading="eager"` for the primary entry (above the fold).
- `decoding="async"` for performance.
- Max-width: 100% of center column; no fixed pixel cap at desktop.

#### Loading state (before hydration)

Do NOT use a gradient placeholder (REVIEW finding N2: "reads as accidentally finished").
Render a **checkered film-leader pattern** (retained from v1 — this is correct):
- `background-image: repeating-conic-gradient(var(--paper-deep) 0% 25%, var(--paper-warm) 0% 50%);`
- `background-size: 16px 16px;`
- Minimum height: 200px; aspect-ratio: 3/2 default before dimensions known.
- The paper-mount frame is present during loading — the checker fills inside it.
- No spinner. No progress bar. The checker is the loading signal.

#### No-image / error state

Same checkered film-leader, with centered overlay text:
```
// frame lost
// <SLUG>
```
in t-mono 9px `var(--ink-faint)`. The mount frame stays.

#### Film-simulation suggestion affordance

See §FILM SIMULATION §FS4 for the full interaction contract. Visual summary here:

When `exif.filmSim` is present AND differs from current site palette:

```
EXTEND PALETTE → CLASSIC CHROME  · ⌃P
```

- Single line beneath the photo, outside the mount margin.
- t-mono 9px, `var(--ink-soft)`, ALL-CAPS.
- `EXTEND PALETTE → <FILM SIM NAME>` in `var(--ink-soft)`.
- `· ⌃P` hint in `var(--accent-orange)`.
- Affordance text is a COPY REQUEST — see §FS4 note to Vega.

#### Caption

If `photo.caption` is present:
- Italic Cormorant Garamond 13px, `var(--ink-soft)`, leading 1.6.
- Margin: 12px above the film-sim suggestion (or 12px below photo if no suggestion).
- Not wrapped in quotes. Not prefixed with a label. The text stands alone.

If no caption: element absent. No empty paragraph. No "no caption" placeholder.

### 2.4 Roll context (right column)

No changes from v1.

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
- When no prev exists: "PREV IN ROLL" block absent.
- When no next exists: "NEXT IN ROLL" block absent.
- When only one photo in roll: both absent; `[⇋ FULL ROLL]` still renders.
- Thumbnails link to their respective entry pages.

### 2.5 Footer

Single row below the three-column grid:

```
← PREV IN ROLL                            NEXT IN ROLL →
```

- t-mono 9px, `var(--ink-soft)`.
- Prev / next labels include the slug or a very short capture-date shorthand.
- When no prev: left slot empty (row still renders with NEXT on the right).
- When no next: right slot empty.
- Section rule above the footer: `1px dashed var(--ink-dashed)`.

---

## 3 · Tokens used

| role | token |
|---|---|
| page surface | `var(--paper-base)` |
| paper grain texture | `.paper-canvas` class |
| header / readout labels | `var(--ink-soft)` |
| body ink | `var(--ink-primary)` |
| accent (film sim readout value, ⌃P, corner reticles) | `var(--accent-orange)` |
| paper-mount outer margin | `var(--paper-warm)` |
| paper-mount inner rule | `var(--ink-faint)` |
| film sim mount label (ambient, NOT accent) | `var(--ink-soft)` |
| checker loading pattern (dark square) | `var(--paper-deep)` |
| checker loading pattern (light square) | `var(--paper-warm)` |
| section rules | `var(--ink-dashed)` |
| NETRA L1 bay surface | `var(--paper-warm)` |
| NETRA L1 left border | `var(--netra)` |
| NETRA L1 tag | `var(--netra)` |
| hover card box-shadow | `rgb(var(--ink-rgb) / 0.16)` |
| header strip surface | `var(--paper-base)` (no separate surface token needed) |

No raw hex values. No new tokens. Zero raw rgba() outside the established `rgb(var(--ink-rgb)/N)` ladder.

---

## 4 · Typography

| element | family | size | weight | style | color | notes |
|---|---|---|---|---|---|---|
| all meta labels | JetBrains Mono (`t-mono`) | 9px | 400 | uppercase | `var(--ink-soft)` | |
| film sim value in readout | JetBrains Mono | 9px | 400 | uppercase | `var(--accent-orange)` | |
| readout section header (`§ INSTRUMENT`) | JetBrains Mono (`t-meta`) | 9px | 400 | uppercase | `var(--ink-soft)` | |
| numeric EXIF fields (aperture, shutter, ISO, focal) | JetBrains Mono | 9px | 400 | uppercase | `var(--ink-soft)` | **tabular-nums** (`font-feature-settings: "tnum"`) |
| caption | Cormorant Garamond | 13px | 400 | italic | `var(--ink-soft)` | |
| film-sim suggestion | JetBrains Mono | 9px | 400 | uppercase | `var(--ink-soft)` | |
| `⌃P` accent in suggestion | JetBrains Mono | 9px | 400 | uppercase | `var(--accent-orange)` | |
| thumbnail caption / date | JetBrains Mono | 9px | 400 | uppercase | `var(--ink-soft)` | |
| footer prev/next | JetBrains Mono | 9px | 400 | uppercase | `var(--ink-soft)` | |
| NETRA L1 tag | JetBrains Mono | 9px | 400 | uppercase | `var(--netra)` | |
| NETRA L1 body | Cormorant Garamond | 12px | 400 | italic | `var(--ink-primary)` | |
| film-sim mount label | JetBrains Mono | 9px | 400 | uppercase | `var(--ink-soft)` | right-aligned in mount margin |

No new font families. No new sizes outside the existing scale.

---

## 5 · Motion

All motion values from the established contract.

| trigger | duration | easing | what moves |
|---|---|---|---|
| Globe camera fly to photo glyph | 1100ms | easeInOutCubic | Globe camera |
| In-Globe side panel open | 520ms | cubic-bezier(.2,.8,.2,1) | side panel transform |
| In-Globe side panel opacity | 320ms | cubic-bezier(.2,.8,.2,1) | side panel opacity |
| Photo `<img>` fade-in on load | 200ms | ease-out | img opacity 0→1 |
| Film-sim suggestion hover | 120ms | ease | color shift (ink-soft → ink-primary) |
| Back-to-ATLAS link hover | 120ms | ease | color shift (ink-soft → accent-orange) |
| Palette-switch (filmSim EXTEND) | 80ms opacity dip + instant palette swap | — | body opacity 0.9→0.75→1.0 (80ms + 80ms ease-in-out); palette applied at opacity nadir |
| Square glyph hover tint | 120ms | ease | color tween toward filmSim-tint or accent-orange |

**No enter animation** on the photo entry page itself. Reading surface; no fade-in scroll
animations; no stagger.

**Palette-switch motion rationale:** The palette swap is global and near-instant. A brief
opacity dip (body `0.75` at 80ms, recovers at 160ms) gives the eye a "blink" — a signal
that something meaningful happened — without being theatrical. This is the minimum legible
transition. Longer cross-fades (>200ms) would feel like a loading state. Instant (0ms) would
feel like a glitch. 80ms+80ms is calibrated to the "meaningful click" register, not the
"animation" register.

**Reduced motion:** Photo `<img>` fade-in collapses to 0ms. Hover color shifts collapse to 0ms.
Globe camera cut is instantaneous. Palette-switch opacity dip collapses to 0ms (instant palette
swap, no blink). All per the existing `prefers-reduced-motion` media query in `globals.css`.

---

## 6 · States

| state | what renders | notes |
|---|---|---|
| default | as drawn in §2 | — |
| image loading | film-leader checker inside paper-mount; real image replaces on load | no spinner |
| image error | checker + `// frame lost` overlay | mount stays |
| no caption | caption element absent | no placeholder |
| no EXIF | `// no instrument data / // recovered from source` in readout | block does not hide |
| partial EXIF | missing rows omitted individually | no empty labels |
| share-location=false | coord row absent from header + readout | never show or infer coords |
| share-location=true, no GPS | coord row absent (GPS undefined) | same as above |
| no prev in roll | PREV block absent in right column + left footer slot empty | |
| no next in roll | NEXT block absent in right column + right footer slot empty | |
| only one photo in roll | both prev/next absent; `[⇋ FULL ROLL]` still shows | |
| current palette = photo's film sim | film-sim suggestion absent | |
| film-sim suggestion shown | renders below photo, above footer | only when exif.filmSim differs from current palette |
| EXTEND PALETTE pressed / ⌃P | `applyPalette(filmSim)` runs; body opacity dip; suggestion disappears (palette now matches) | |
| NETRA inactive | NETRA L1 bay absent | no empty bay |
| NETRA active | NETRA L1 bay renders with photo locus | |
| NETRA active + coord withheld | L1 shows "coordinate withheld" | |
| Nav right-readout | `NAV STANDBY` / `NAV NETRA` — no other variant | |

---

## 7 · Breakpoints

### 7.1 Desktop (≥1024px)

Three-column grid as drawn: `[260px_1fr_240px]`. Gutters: 32px. Padding: 40px horizontal.

### 7.2 881–1023px

Three columns collapse to two: instrument readout stacks above photo center column;
roll context remains on the right at 200px. Left column drops below the photo.

```
┌────────────────────────────────────────┐
│ NAV STRIP                              │
├────────────────────────────────────────┤
│ HEADER STRIP                           │
│ NETRA L1 BAY (if active)               │
├────────────────────────────────────────┤
│ ┌─────────────────────────┐ ┌──────┐  │
│ │ INSTRUMENT READOUT      │ │ ROLL │  │
│ │ (collapsed 2-col grid)  │ │ CTXT │  │
│ └─────────────────────────┘ └──────┘  │
│ ┌─────────────────────────────────────┐│
│ │ PHOTO (paper-mount, full width)     ││
│ └─────────────────────────────────────┘│
│ CAPTION · FILM SIM SUGGESTION          │
│ ─────────────────────────────────────  │
│ FOOTER PREV/NEXT                       │
└────────────────────────────────────────┘
```

### 7.3 600–880px (journey-arch §7.1 mobile-primary)

Single column. Order top-to-bottom:
1. Header strip (stacks: file/date/film on row 1; coords on row 2 if shared)
2. NETRA L1 bay (if active)
3. Instrument readout (full width, 2-row label/value grid)
4. Photo (paper-mount, full width)
5. Caption
6. Film-sim suggestion
7. Roll context (prev/next thumbs inline: `[← PREV] · [⇋ FULL ROLL] · [NEXT →]`)
8. Footer

Section rules (`var(--ink-dashed)`) between major sections.
Padding: 16px horizontal (`px-4`).
Touch targets: all clickable elements ≥ 44px tall.

Roll context collapses: prev/next thumbnails become a single row of 48×48 thumbs with
`[← PREV] · [FULL ROLL] · [NEXT →]` text links inline.

### 7.4 375–599px

Identical to 600–880px with same 16px padding — no further reduction.
Caption stays at 13px. Instrument readout at 9px. Do not scale down.

Paper-mount: 12px margin and 1px rule both preserved. The photo simply fits narrower.

NETRA L1 bay: left-border preserved; collapses to single line with overflow ellipsis at extreme narrow.

---

## 8 · Accessibility

### 8.1 Keyboard map

| key | action |
|---|---|
| Tab | focus Nav → header affordances → film-sim suggestion → roll context thumbs → footer nav |
| Enter on `[← BACK TO ATLAS]` | navigate to `/` with Globe return state |
| Enter on `[⇋ FULL ROLL]` | navigate to `/photos/<roll>` |
| Enter on prev/next thumbnails | navigate to adjacent photo entry |
| ⌃P (when page focused, no input focused) | apply film simulation palette (EXTEND PALETTE) |
| Esc | handled by NETRA drawer if open; no special handling on this page |

### 8.2 Screen reader text

- Photo `<img>`: `alt` = caption text if present; `alt="PHOTO <slug> · <roll>"` if no caption.
  Never empty alt on a content image.
- Film-sim suggestion: `aria-label="Extend site palette to match <FILM SIM NAME>"`.
  (Vega-register copy in visible text is a COPY REQUEST per §FS4; aria-label uses functional text.)
- Prev/next thumbnail links: `aria-label="Previous photo in roll: <slug or date>"` /
  `aria-label="Next photo in roll: <slug or date>"`.
- `[⇋ FULL ROLL]` link: `aria-label="View full roll <roll title>"`.
- `[← BACK TO ATLAS]` link: `aria-label="Return to ATLAS globe"`.
- Instrument readout: `<dl>` (definition list), `<dt>` for labels, `<dd>` for values.
  `§ INSTRUMENT` header is `<h2>` scoped to the aside.
- NETRA L1 bay: `role="status"` (live region, polite). Updates when NETRA narrates a new locus.

### 8.3 Focus visibility

All interactive elements use the existing focus ring from `globals.css`. If absent, Sirius
adds `outline: 2px solid var(--accent-orange); outline-offset: 2px` as the global rule.

### 8.4 ARIA landmarks

- `<nav>` — existing `Nav.tsx`.
- `<header>` — header strip.
- `<aside aria-label="Camera instrument readout">` — left column.
- `<main>` — wrapping photo + caption + film-sim suggestion.
- `<aside aria-label="Roll navigation">` — right column.
- `<footer>` — footer.
- NETRA L1 bay: inside `<header>`, `role="status"` on the bay div.

### 8.5 Lighthouse a11y target

≥95 on the photo entry template (same bar as article entry, journey-arch quality bar).

---

## 9 · §FILM SIMULATION (Part B · first-class feature)

### FS1 · What film simulation is in Worldline ontology

Film simulation is not an EXIF field. It is the record of a photographic decision — the
instant Peat set the camera's rendering engine before pressing the shutter. It names
*how* this frame was meant to be read: the tonal curve, the color science, the grain
character chosen from the set of simulations the instrument offers. In Worldline, that
decision extends past the frame: when the visitor switches the site palette to match it,
they borrow the photographer's eye for the duration of their reading session. The film
simulation is thus a *witness mark* on the worldline — Classic Chrome here, not Velvia,
not Acros, not because the subject demanded it but because *Peat chose it*, and the
choice says something that no caption can.

*(Vega register, 3 sentences. This text is for the spec's §FS1 definition only;
Vega owns all copyable visible microcopy — see §FS4 COPY REQUEST.)*

### FS2 · Mappings (canonical reference: PRD-03 §8.1)

The 5 Fuji film simulations Peat shoots and their palette token shifts as defined in
`prd-03-photo-atlas-deep-dive.md §8.1`:

**Aesthetic characters + palette token shifts:**

| simulation | aesthetic character | data-palette value | key token shifts |
|---|---|---|---|
| **Classic Chrome** | Muted, desaturated, shadows lean cool. Documentary quality — as if the chrome has aged the image slightly. | `classic-chrome` | `--paper-base: #E5DBC8` · `--accent-orange: #A86B2C` (muted ochre) · `--ink-rgb: 56 75 89` |
| **Reala Ace** | Natural, warm-neutral, honest. The "closest to how the eye saw it." Modest contrast. | `reala-ace` | `--paper-base: #EAE3D2` · `--accent-orange: #C75D45` (coral) · `--ink-rgb: 36 54 80` |
| **Acros** | Black and white. Deep blacks, luminous highlights, fine grain. No chroma. | `acros` | `--paper-base: #DDDAD3` · `--accent-orange: #5A5A55` (deep gray; no chroma) · `--ink-rgb: 26 24 21` |
| **Provia** | The default. Clean, accurate, slight saturation lift. The reference simulation — all other sims deviate from it. | (base, no `data-palette` attr) | `:root` defaults; no override block needed |
| **Velvia** | Saturated, punchy, vivid reds and greens. Landscape photography's signature look. | `velvia` | `--paper-base: #EAE0CC` · `--accent-orange: #D24820` (saturated red-orange) · `--ink-rgb: 16 70 91` |

All token values above are verbatim from `prd-03-photo-atlas-deep-dive.md §8.1`. Do not
alter these values. Do not interpolate new palette variants without a Polaris-mediated
token proposal.

**Provia note:** Provia is the `:root` baseline. When a photo has no `exif.filmSim` or
the sim normalizes to `"Provia"`, `data-palette` is removed (`document.documentElement.removeAttribute('data-palette')`). No override block needed.

**Reala Ace completeness flag:** PRD-03 §8.1 defines `reala-ace` token shifts. If any field
is missing or stale when Sirius implements, raise a follow-up to Procyon (photos schema
owner) before improvising new values. Do not invent token values for Reala Ace.

**Token discipline:** the CSS blocks in PRD-03 §8.1 use raw hex. Those raw hex values belong
exclusively in `globals.css` inside the `[data-palette="*"]` blocks. Any component that
references palette-specific colors must use the token, not the hex. The palette blocks in
`globals.css` are the single site of raw hex; everywhere else is token-only.

### FS3 · Surface presence and alpha discipline

Film simulation appears in five locations. The rule is: each location uses a distinct
register of prominence. FilmSim is meaningful, not a brand stamp — it must not compete with
the photograph or the instrument readout.

**Location hierarchy (most prominent → least prominent):**

| location | treatment | register |
|---|---|---|
| Instrument readout (FILM row, left column) | t-mono 9px `var(--accent-orange)` uppercase | FUNCTIONAL — the primary named declaration |
| Paper-mount label (bottom-right of mount margin) | t-mono 9px `var(--ink-soft)` uppercase | AMBIENT — quiet marking, like a print note |
| Film-sim suggestion affordance (below photo) | t-mono 9px `var(--ink-soft)` with `var(--accent-orange)` on `⌃P` hint only | INTERACTIVE — single line, not repeated |
| Side panel preview (FILM row) | t-mono 9px `var(--accent-orange)` uppercase | FUNCTIONAL (same as readout, smaller context) |
| Hover preview card (Globe) | t-mono 9px `var(--accent-orange)` | CONTEXTUAL — establishes before entry |

**Alpha discipline per location:**

- FUNCTIONAL (readout + side panel): full `var(--accent-orange)` — this IS the instrument reading.
- AMBIENT (mount label): full `var(--ink-soft)` — quiet, same as other meta. Never orange.
  If it were orange it would compete with the photo and the accent in the readout.
- INTERACTIVE (suggestion): `var(--ink-soft)` for the body text; `var(--accent-orange)` for the
  `⌃P` hint only. The hint is orange because it names the action affordance, not because
  filmSim is being promoted.
- CONTEXTUAL (hover card): `var(--accent-orange)` because it is the only interesting data in
  the hover preview; context warrants the accent.

No additional filmSim presence. No filmSim pill. No filmSim badge on the thumbnail. These
would convert a decision trace into a product tag. The five locations above are exhaustive.

### FS4 · The SUGGESTION affordance (interaction contract)

**When does it appear?**
Gating condition: `exif.filmSim !== null` AND the filmSim maps to a known `data-palette` value
AND the current site palette (`localStorage.getItem('wl:film-sim')` or absence of `data-palette`
attribute on `<html>`) does not match the photo's filmSim. If any condition fails: affordance
absent. No partial rendering.

**Visual composition:**
Single line, below the photo, outside the paper-mount margin. Left-aligned with the photo edge.
No border, no background, no pill. Just the text:

```
EXTEND PALETTE → CLASSIC CHROME  · ⌃P
```

- `EXTEND PALETTE → <FILM SIM NAME>`: t-mono 9px `var(--ink-soft)` uppercase tracking 0.3em.
- `· ⌃P`: t-mono 9px `var(--accent-orange)` (the only orange in this affordance).
- No underline at rest. Underline (1px solid `var(--ink-soft)`) on hover/focus.
- Touch target: the entire line is wrapped in `<button>` or `<a>` with min-height 44px
  via top/bottom padding (invisible, not visual enlargement).

**COPY REQUEST to Vega:**
The visible affordance text `EXTEND PALETTE → <FILM SIM NAME>` is a placeholder in Vega
register. The spec's intent: *borrow the photographer's eye*, not *switch theme*. The phrase
should feel like crossing a threshold, not clicking a setting. Exact text needs Vega authorship
before Sirius builds — see handoff note at end of this spec.

**Affordance text examples (Betelgeuse's framing; Vega refines):**
- `EXTEND PALETTE → CLASSIC CHROME · ⌃P`
- `SEE THROUGH ACROS · ⌃P`
- `BORROW THIS EYE · CLASSIC CHROME · ⌃P`

Vega picks the final pattern; Betelgeuse validates it fits the 9px mono line without wrapping
at ≤600px viewport.

**Transition feel:**
On click or ⌃P:
1. Body opacity dips to 0.75 in 80ms (ease-in).
2. `data-palette` attribute set on `<html>` + `wl:film-sim` written to localStorage.
3. Body opacity recovers to 1.0 in 80ms (ease-out).
Total: 160ms. The opacity dip is the only motion. No cross-fade. No element animation.

The palette switch is a global DOM attribute change. React's next render cycle picks it up.
The 160ms opacity dip is a CSS transition on `body { opacity: ... }` — Sirius wires this
on the `FilmSimSwitcher` component.

**ESC / undo behavior:**
No ESC undo. Palette changes are persistent (localStorage) and user-intentional.
If the visitor wants to return to Provia (base), the `FilmSimSwitcher` component (placed on
`/photos`, `/colophon`) provides explicit reversion. On the entry page itself, no undo widget.
This is intentional: the borrowing is meant to be a session-level choice, not a pop-up toggle.

**Discoverability:**
The `⌃P` hint is visible inline — no separate tooltip needed. The hint appears within the
affordance text itself. No additional UI elements for discoverability.
The `⌃P` keyboard shortcut operates when this page is focused and no input is active.
Sirius registers the handler per photo entry page only (not global to the site, to avoid
conflicting with other shortcuts).

**Palette value mapping** (verbatim from `prd-03-photo-atlas-deep-dive.md §8.1` via the
`FilmSimSwitcher` component):
- `"Classic Chrome"` → `data-palette="classic-chrome"`
- `"Acros"` → `data-palette="acros"`
- `"Reala Ace"` → `data-palette="reala-ace"`
- `"Velvia"` → `data-palette="velvia"`
- `"Provia"` or no match → remove `data-palette` attribute (base palette)

Sirius wires the click + keypress handler. Betelgeuse specifies the visual only.

### FS5 · Palette switching as worldline mechanic

The act of switching the site palette via a film simulation is not "changing the theme."
It is *extending the photographer's eye onto the visitor's own reading session.* When a
visitor switches to Classic Chrome on a photo entry, they are choosing to read the rest
of the worldline — the articles, the ATLAS, the archive — in the same desaturated,
cool-shadowed register the photographer was thinking in when the shutter was pressed.
The palette follows the session; the session becomes an instrument of that eye.

**How this manifests — decision:**

The choice is **silent palette switch only**. No α drift. No NETRA narration of the switch.

Rationale:
- α value is the divergence of the worldline, not the visitor's query. Switching palette
  does not change the worldline's locus — the meter reads static (per binding mechanic §1.4
  "static for v1"). α must not drift on palette change.
- NETRA narration of the switch would instrumentalize the act — "now entering Classic Chrome
  palette" reads as a system status notification, not an experiential crossing. The instrument-
  not-toy principle (globe-ontology §1.3) applies: if NETRA announces every interaction it
  ceases to be a companion voice and becomes a narrator. Voice is reserved for locus, not mode.
- The silent switch + 160ms opacity dip is the correct register: the visitor acts; the world
  changes; no one speaks. The change is self-evident.

The NETRA L1 bay on the photo entry already names the filmSim (`locus · PHOTO <slug> · <filmSim>`).
NETRA has already noted the photographer's decision. The visitor now acts on it.

**Future extension (logged, not specced):** if the palette switch + NETRA narration becomes
a later design decision (e.g., NETRA narrates *before* the switch as an invitation rather than
*after* as a notification), that is a Polaris-mediated spec revision, not a spec-v2 delta.

### FS6 · Five palette variants — visual fidelity

The 5 palette variants are real-world calibrated looks tied to specific Fuji film simulations.
This spec does NOT add aesthetic interpretation beyond the PRD-03 token mapping. The token
values in FS2 above are **verbatim from PRD-03 §8.1**. Completeness status:

| simulation | PRD-03 §8.1 status |
|---|---|
| Classic Chrome | COMPLETE — all token shifts defined |
| Acros | COMPLETE — all token shifts defined |
| Velvia | COMPLETE — all token shifts defined |
| Reala Ace | COMPLETE — token shifts defined; flag for Procyon if any field found missing on impl |
| Provia | COMPLETE — base palette (`:root`); no override block needed |

The CSS `[data-palette="*"]` blocks implementing these shifts live in `globals.css` and are
maintained by Betelgeuse (token custodian). Sirius reads them; does not write to `globals.css`.
Any new token value proposed during implementation routes to Betelgeuse as a TOKEN PROPOSAL
before committing.

**Token discipline reminder:** the film simulation palette blocks use raw hex inside `globals.css`.
That is the single exception site. Outside that file, all references are through
`var(--paper-base)`, `var(--accent-orange)`, `var(--ink-rgb)`, etc. A raw hex value in a
component `.tsx` file is always a reject.

---

## 10 · References (existing patterns being reused)

- `Nav.tsx` — header strip reuses as-is
- `WorldlineGlobe.tsx` — `atlas-readout-row` vocabulary; `is-trio` pattern (not copying DOM;
  visual rhythm is the reference)
- `WorldlineGlobe.tsx` — side panel motion contract (520ms / 320ms cubic-bezier)
- `WorldlineGlobe.tsx` — `.atlas-coord-pin` format for GPS display (`13.04°N · 100.50°E`)
- `globals.css` · `.atlas-netra-voice` — NETRA L1 bay visual language (left-border, italic Cormorant body)
- `globals.css` · `.t-meta`, `.t-mono`, `.t-display`, `.section-rule-dashed`, `.marginalia`,
  `.paper-canvas`, `.corner-marks` — all consumed, none modified
- `globals.css` · `[data-palette="*"]` blocks (PRD-03 §8.1) — film-sim palette switcher
  extends this existing toggle mechanism; no new mechanism invented
- `globals.css` · `body { font-feature-settings: "ss01", "tnum" }` — tabular-nums already
  set globally; Sirius ensures numeric EXIF spans don't override or suppress this

---

## 11 · Non-goals

- No commenting system.
- No reading-progress bar (the global scroll-meter from `.marginalia` covers this).
- No print stylesheet.
- No lightbox from the single entry page. Lightbox lives in `/photos/<roll>` contact sheet.
- No "related photos" block — roll context strip (prev/next) is the adjacency affordance.
- No sharing buttons or social meta (Open Graph tags are infrastructure, not a visual spec).
- No auto-apply of film simulation on page load. Suggestion only. Visitor controls.
- No map element at the entry level. Coord in the readout; spatial context is the Globe.
- No fiction entry surface (deferred per journey-arch §3.4).
- No NeX Index Board scatter projection (deferred per journey-arch §9 row 09).
- No filmSim pill, badge, or tag anywhere — the five presence locations in §FS3 are exhaustive.
- No NETRA narration of palette switch (decided §FS5, rationale recorded).
- No ESC-undo of palette switch on the entry page.

---

## 12 · Handoff notes

**COPY REQUEST to Vega (ref §FS4):**
The film-sim suggestion affordance text `EXTEND PALETTE → <FILM SIM NAME>` is a placeholder.
Intent: "borrow the photographer's eye" — threshold crossing, not settings toggle. Vega please
author the canonical one-line pattern (per-simulation variants if needed). Constraint: must fit
on a single line at ≤375px viewport in JetBrains Mono 9px uppercase; ideally under 40 characters
for the non-sim-name portion. Betelgeuse will validate layout fit before Sirius builds.

**FOLLOW-UP to Procyon (ref §FS2, Reala Ace):**
PRD-03 §8.1 defines Reala Ace tokens. If any token value is found missing or stale during
TASK-31 implementation, Procyon (photos schema owner) should be flagged before Sirius
improvises values.

---

## 13 · Anti-Codex audit

| check | result |
|---|---|
| New tokens introduced without justification | None |
| Raw hex outside globals.css | None |
| New font families | None |
| New visual patterns not grounded in existing components | Paper-mount margin (slight widening 8→12px, same token `var(--paper-warm)`) — justified by metaphor shift post iter 1 |
| FilmSim invented as branding stamp | No — 5 presence locations defined, all with alpha discipline |
| Settings-toggle vocabulary | No — "EXTEND PALETTE / borrow the photographer's eye" register; COPY REQUEST to Vega |
| Generic photo-gallery framings | No — paper-mount + instrument readout enforces instrument frame |

---

*betelgeuse · α-VIS-04 · TASK-2026-05-17-PHOTO-FILMSIM-REFINE · photo entry spec v2.0 · 2026-05-17*
