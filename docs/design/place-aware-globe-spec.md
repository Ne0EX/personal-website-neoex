# docs/design/place-aware-globe-spec.md
# Place-aware Globe — Design Spec

> **Owner:** Betelgeuse (α-VIS-04) · 2026-06-07
> **Authority:** `docs/design/place-aware-globe-DECISION-2026-06-07.md` (Peat + Polaris)
> **Soul anchor:** worldline-soul skill — exploration not exhibition; dig, don't splay
> **Build sequence:** this spec → Procyon schema → Sirius implementation

---

## 1 · intent

The globe surface is a **surveyed paper observatory**. It holds memory at real
coordinates. Right now it renders N overlapping pins for N entries at one point —
the location has no weight of its own. This spec replaces that model.

A **place** is the new unit. Places hold content; places have weight; places
reward digging. The visitor approaches a weighty node, enters it, sees the
curated front door (one article + up to five photos — the highlights), then earns
the rest by choosing to go deeper. That "deeper" is the seed that grows into the
micro-map when a city has enough content.

The feeling: arriving at a city node on the surface and sensing — from its
instrument-weight — that there is more here than what's immediately visible.
Choosing to dig. Finding the highlights first. Then, if you want more, digging
past them. The depth is earned, not displayed.

---

## 2 · place model — hierarchical from the start

### 2.1 — the place atom

```
Place {
  id:         string       // stable, slug-form — "bangkok" · "kyoto-jp"
  level:      1 | 2        // L1 = city/area (now) · L2 = district (future)
  parentId?:  string       // L2 only — points to the L1 place that contains it
  name:       string       // display — "Bangkok" · "Yirgacheffe" · "Yamanote"
  coord:      { lat, lon } // globe anchor — single point per place
  weight:     number       // total attached content count (L1 aggregates L2 children)
}
```

**Content references a place, not a coord:**
- `Article → placeId` (one article belongs to one place)
- `PhotoSidecar → placeId` (one sidecar belongs to one place)

Existing `coords` on `RECENT_ENTRIES` and `PhotoPin` become the *seed* for
`Place.coord`. Procyon assigns every article and photo to a place ID in the new
schema; the globe resolves pins via place, not direct coord.

### 2.2 — why hierarchical from the start

The L1/L2 distinction is the same gesture repeated at finer grain. An L1
city node contains content AND may contain L2 district sub-places. The dig
gesture that takes you past highlights to "all content at this place" — at
sufficient scale — zooms into the L1 node and reveals L2 district nodes arranged
within it (the micro-map). Same atom. Same gesture. Different grain.

Defining `parentId` now means the micro-map is an extension of what's already
built, not a repaint. At L1 launch, `parentId` is always null and `level` is
always 1 — the schema is latent, not active.

### 2.3 — α/observer separation (critical)

α (Bangkok · 13.7563°N, 100.5018°E) shares a coordinate with the Bangkok place
node — they **co-locate but remain distinct layers**. α is the observer's
identity axis (a non-clickable OBSERVER_NODE glyph). The Bangkok place node is a
content container (clickable, dig-able). They render as separate THREE.js objects
with separate interaction states. α is never promoted to a place; a place is never
given α's orange halo. The existing `OBSERVER_NODES` array and its glyph-logic is
untouched.

---

## 3 · place-node visual on the globe

### 3.1 — atom lineage

The place-node **extends** the `arc-node` atom (`worldline-atoms.css` — the
ink-primary filled circle that represents a surveyed, fixed archive point) combined
with the `alpha-node` halo-ring precedent (the concentric ring that signals the
observer's special weight). The current Ne0 entry pin (`pinObjects` in globe line
610) is a `SphereGeometry(0.012)` ink-dot — the `arc-node` equivalent in Three.js.
The α observer uses `SphereGeometry(0.022)` + `RingGeometry(0.034, 0.044, 32)`.
The **place-node extends both**: a slightly larger `arc-node` center dot plus
concentric survey rings whose count scales with weight. It is not the `alpha-node`
(that is reserved for the observer axis and renders orange).

```
place-node glyph (ink, surface r=1.005):
  center dot · SphereGeometry(0.014, 12, 12) · color: var(--ink-primary) hex 0x1f5063
  ring-1 · RingGeometry(inner=0.022, outer=0.026, 32) · ink 0x1f5063 · opacity 0.7
  ring-2 · RingGeometry(inner=0.034, outer=0.037, 32) · ink 0x1f5063 · opacity 0.45
    visible when weight ≥ 3 content items
  ring-3 · RingGeometry(inner=0.048, outer=0.050, 32) · ink 0x1f5063 · opacity 0.28
    visible when weight ≥ 7 content items
```

Rings are `THREE.DoubleSide`, oriented to face outward (`lookAt(0,0,0)` + rotateY
π). They read as concentric survey-elevation rings on a cartographic instrument —
not a badge, not a count bubble.

**What weight means:** ring presence communicates that a place holds depth. Rings
are a density signal, not a count display. No numeral label overlaid on the 3D
node.

### 3.2 — hover state (Ne0 stratum)

On pointer-enter to the hit proxy:
- ring-1 opacity → 0.95 (120ms transition — within the 100–150ms hover calibration)
- A typewritten coordinate-format tooltip appears in the NETRA voice strip:
  `PLACE · {NAME} · {N} RECORDS ARCHIVED`
  Font: t-mono 9px uppercase — same as the existing NETRA voice strip pattern.
  This is instrument narration, not a UI tooltip popup.

### 3.3 — selected state

On click:
- ring-1 + ring-2 opacity → 1.0 at accent-orange hex `0xD4602A`
- dot material color → `0xD4602A`
- camera slerps toward the place coord (same motion as current entry pin focus):
  700–1000ms, easeInOutCubic — matches existing `applySelected` pattern
- front-door panel slides in from the right (300ms, ease-out-quad)
- NETRA voice updates: `trace · {PLACE NAME} · highlights surface. dig to see all.`

### 3.4 — states table

| state | dot | ring-1 | ring-2 | ring-3 | NETRA voice |
|---|---|---|---|---|---|
| default | ink 0x1f5063 | opacity 0.7 | opacity 0.45 (if ≥3) | opacity 0.28 (if ≥7) | stratum voice |
| hover | ink 0x1f5063 | opacity 0.95 | no change | no change | `PLACE · {name} · N RECORDS ARCHIVED` |
| selected (has highlights) | orange 0xD4602A | orange, opacity 1.0 | orange, opacity 0.7 | no change | `trace · {name} · highlights surface. dig to see all.` |
| selected (no highlights) | orange 0xD4602A | orange, opacity 1.0 | — | — | `trace · {name} · N records. no highlights curated yet.` |
| selected (0 content) | ink, faint | ring-1 only, opacity 0.35 | — | — | `trace · {name} · no records anchored here yet.` |

---

## 4 · highlights front door + dig to all

### 4.1 — article requirement clarification

The decision doc ("1 article + up to ~5 standout photos") describes the **ideal**
front door — not a hard gate. A place may be photography-first: real content
anchored there, no article written yet. The spec handles three highlight states:

| highlights state | article | photos | panel renders |
|---|---|---|---|
| **full highlights** | 1 article set | 1–5 photos set | article + photo strip |
| **photo-only highlights** | none set | 1–5 photos set | photo strip only (no article block) |
| **article-only highlights** | 1 article set | none set | article block only (no photo strip) |
| **no highlights** | none set | none set | NETRA voice: "N records. no highlights curated yet." — panel shows only the DIG DEEPER trigger |

The "ARTICLE HIGHLIGHT REQUIRED" validation in the console (§5.3) is **removed**
from this spec. The console allows saving photo-only highlights; vice versa. Both
are valid curated states.

**→ Peat's confirmation needed** (§15 escalation): should a place with NO highlights
show the panel at all when clicked, or should it only show its NETRA voice line?
This spec defaults to: panel opens but renders an empty highlights block + DIG DEEPER
(no crash, no blank screen). If Peat prefers "no panel until at least one highlight
is set," Sirius changes only one conditional in the panel render.

### 4.2 — front-door panel

Opening a place-node surfaces the curated highlights panel. This panel slides in
from the right — same `translateX` + `opacity` animation pattern as the existing
article panel at `WorldlineGlobe.tsx` lines 1968–1971 — and replaces the current
single-entry article panel in the Ne0 stratum.

```
┌─────────────────────────────────────────────────────────────┐
│ PLACE HEADER STRIP (t-mono 9px uppercase, tracking 0.3em)   │
│ PLACE · {NAME} · {LAT}°N {LON}°E · {N} RECORDS              │
│ HIGHLIGHTS — [1 ARTICLE ·] [N FRAMES]                       │  ← brackets = conditional
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ [ARTICLE HIGHLIGHT — renders only if article is set]         │
│ ◆ FILE {NNN} · {YYYY.MM.DD}                                 │
│ {title in Cormorant Garamond italic, 18px}                  │
│ [→ READ ENTRY]  link only — no redundant excerpt block       │
│                                                              │
├─ 1px dashed var(--ink-dashed) ─────────────────────────────┤
│   [renders only if both article AND photos are set]          │
│                                                              │
│ [PHOTO HIGHLIGHTS — renders only if photos are set]          │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                         │
│ │    │ │    │ │    │ │    │ │    │                          │
│ └────┘ └────┘ └────┘ └────┘ └────┘                         │
│ thumb.webp strip (80px × 80px per cell, gap 6px)            │
│ each cell: tap/click → /photos/{roll} entry page            │
│ caption: none. film-sim tint: not applied (telemetry shell)  │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│ ↓ DIG DEEPER — ALL {N} RECORDS AT {NAME}                    │
│   (t-mono 9px, uppercase, ink-soft → accent-orange on hover)│
└─────────────────────────────────────────────────────────────┘
```

**Photo unit — frame, not roll:**
Each cell in the photo strip represents **one frame** (one `PhotoSidecar` record),
identified by `roll/id`. The cell shows `variants.thumb.webp` (80px). Tapping
navigates to `/photos/{roll}` (the roll entry page), which gives context. The
highlight rank (1–5) is set on individual sidecar records, not on rolls. A roll
may contribute multiple highlight frames from one place, but the highlight editor
limits total to 5 frames across all rolls.

In the dig-to-all section (§4.3), photos group **by roll** for display: "ROLL 012 ·
7 frames · 2026.04.22 →" — because showing 50 individual sidecar rows would be noise.
The two levels are: **frame** for the highlight strip (curated hero frames) and
**roll** for the dig list (browsable rolls).

**Panel tokens:**
- surface: `var(--paper-warm)`
- place header: `t-mono` 9px uppercase, tracking `0.3em`, color `var(--ink-soft)`
- article title: Cormorant Garamond italic, 18px, `var(--ink-body)`
- article file/date: `t-mono` 9px uppercase, `var(--accent-orange)`
- "DIG DEEPER" trigger: `t-mono` 9px uppercase, `var(--ink-soft)` default; hover
  → `var(--accent-orange)` (120ms). Prefix `↓` — Unicode, not icon.
- Panel width: 360px desktop, full-width on ≤600px (see §7)
- Panel animation: `translateX(calc(100% + 30px))` → `translateX(0)` over 300ms
  ease-out-quad, same pattern as existing article panel lines 1968–1971. Opacity
  0→1 over 320ms ease-out in parallel.
- Dismiss: ESC or click outside. Matches existing `setSelectedId(null)` ESC path.

**NETRA voice while panel is open:**
`trace · {place name} · highlights surface. dig to see all.`

Reuses the `trace ·` pattern from `WorldlineGlobe.tsx` line 779.

### 4.3 — dig to all

Activating "DIG DEEPER" unfolds all content at the place below the highlights
block. This is a *within-panel* expansion, not a new page — the exploration
continues without navigation.

```
┌─────────────────────────────────────────────────────────────┐
│ [PLACE HEADER STRIP — unchanged]                            │
│ [ARTICLE HIGHLIGHT — unchanged]                             │
│ [PHOTO HIGHLIGHTS — unchanged]                              │
├─────────────────────────────────────────────────────────────┤
│ ↑ HIGHLIGHTS  [collapse trigger]                            │
├─────────────────────────────────────────────────────────────┤
│ ALL RECORDS AT {NAME} — {N} TOTAL                           │
│                                                              │
│ ARTICLES (t-mono 9px head)                                  │
│ ◆ FILE 003 · 2026.05.07 · ongoing · 8 min                  │
│   on the architecture of taste →                            │
│ ◆ FILE 001 · 2026.04.28 · refined · 15 min                 │
│   the four pours adaptation →                               │
│                                                              │
│ PHOTOS (t-mono 9px head)                                    │
│ ◎ ROLL 012 · 2026.04.22 · 7 frames →                       │
│ ◎ ROLL 008 · 2026.04.01 · 12 frames →                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

Unfold animation: content below the "ALL RECORDS" divider reveals over 220–300ms
(max-height expansion, opacity 0→1 staggered 40ms per article row, 30ms per roll
row). Reduced motion: instant reveal.

"All articles" list style: identical to the existing article-panel side-panel
pattern in `WorldlineGlobe.tsx` — `t-mono` file/date/status, Cormorant italic
title, `var(--ink-soft)` at rest → `var(--ink-primary)` on hover. Reuses glyph
◆ (article) and ◎ (photo roll) from `KINDS` in `console-types.ts`.

Photo rows in the dig list represent **rolls**, not individual frames. Each row:
`◎ ROLL {id} · {YYYY.MM.DD} · {M} frames →` links to `/photos/{roll}`.
This is the dig-list granularity. The highlight strip (§4.2) uses individual frames
(sidecar unit). Both are correct; different surfaces serve different depth levels.

NETRA voice while dug: `trace · {place name} · full archive surface. N records.`

**What this becomes at L2 (future micro-map):** the "DIG DEEPER" gesture from an
L1 city node — when that city has L2 districts — instead zooms the 3D camera
into the globe surface and resolves the L2 district sub-nodes within the city
region. Same gesture, different visual resolution. No new interaction invented.

---

## 5 · console curation surface

### 5.1 — where it lives

The Atlas Console (ConsoleApp.tsx) gains a **Places panel** — a new section in
the `ConsoleRail`, accessed via a new kind filter: `ALL · ARTICLE · PHOTO ·
FICTION · REPO · **PLACE**`. The rail shows places as a separate node kind.

Alternatively and preferably: Places appear in their own block *above* the
existing entry list, with their own rail section header. The existing kind-filter
pills need not expand for a one-off surface. Decision: spec assumes a dedicated
**PLACES** block in the rail, above the entry list. If Sirius has implementation
constraints, a new kind-pill is acceptable.

### 5.2 — place card in the rail

```
PLACES  ─────────────────────── 3
┌──────────────────────────────┐
│ ◉ BANGKOK · TH               │
│   3 articles · 12 photos     │
│   1 article highlight set    │
│   [EDIT HIGHLIGHTS →]        │
└──────────────────────────────┘
┌──────────────────────────────┐
│ ◉ KYOTO · JP                 │
│   2 articles · 5 photos      │
│   highlights: NOT SET        │  ← ink-soft warning state
│   [SET HIGHLIGHTS →]         │
└──────────────────────────────┘
```

Place card tokens:
- surface: `var(--paper-warm)` with `1px dashed var(--ink-dashed)` border
- place name: `t-mono` 9px uppercase, `var(--ink-primary)`
- counts: `t-mono` 9px, `var(--ink-soft)`
- highlight status set: `var(--ink-soft)`, italic Cormorant "1 article · 3 photos"
- highlight status NOT SET: `var(--accent-orange)` soft, `t-mono` "highlights: NOT SET"
- glyph `◉` (filled circle with center dot) — the place node's console glyph,
  distinct from ◆ (article) and ◎ (photo)
- `[EDIT HIGHLIGHTS →]` / `[SET HIGHLIGHTS →]`: `t-mono` 9px uppercase,
  `var(--accent-orange)` on hover, ink-soft at rest

### 5.3 — highlight editor panel

Clicking "EDIT HIGHLIGHTS" opens a form panel in the console canvas area (right
pane), styled as the existing `ConsoleEntryForm` pattern.

```
┌─────────────────────────────────────────────────────────────┐
│ PLACE HIGHLIGHT EDITOR                                       │
│ PLACE: BANGKOK · TH                                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ ARTICLE HIGHLIGHT  (1 article, required for highlights)      │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ search / select from articles at this place            │  │
│ │ ◆ 003 — on the architecture of taste  [× clear]        │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                              │
│ PHOTO HIGHLIGHTS  (up to 5, ordered — drag to reorder)      │
│ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌──────────────────────┐    │
│ │ 1 │ │ 2 │ │ 3 │ │ 4 │ │ 5 │ │ + ADD PHOTO          │    │
│ └───┘ └───┘ └───┘ └───┘ └───┘ └──────────────────────┘    │
│ 72px thumb slots. empty slots show dashed border.           │
│                                                              │
│ [SAVE HIGHLIGHTS]          [CANCEL]                          │
└─────────────────────────────────────────────────────────────┘
```

- Article picker: typeahead search over articles linked to this `placeId`.
  Shows only articles at the current place (Procyon provides the filtered list).
  t-mono glyph ◆ + fileNum + title. One selection at a time.
- Photo picker: typeahead + thumbnail strip. Ordered. Drag to reorder rank 1–5.
  Drag affordance: existing console canvas node-drag precedent (no new pattern).
  Unit = individual frame (PhotoSidecar). t-mono glyph ◎ + roll/frameId + thumb
  preview. A roll's multiple frames each appear as separate selectable items.
  Procyon provides the list of sidecars linked to this `placeId`.
- Save → writes `highlight_flag = true` + `highlight_rank` (1–5 for frames,
  implicit for the one article) to the schema. This is the Procyon data write.
- Validation: if NO article and NO photos are set, the save button is disabled
  (nothing to save). Partial saves (article-only, or photos-only) are valid.
  No error state required for photo-without-article.
- Keyboard: Tab navigates slots; Enter selects; Escape cancels. Matches existing
  `ConsoleEntryForm` keyboard behavior.

### 5.4 — place creation

Places are **Peat-curated, not auto-clustered by proximity.** A place is created
explicitly in the console — Peat names it, assigns a coordinate, attaches content.
Auto-proximity-clustering is forbidden; it produces the generic SaaS map behavior.

The "new place" flow: `+ NEW PLACE` button in the PLACES rail block → opens the
highlight editor with an empty place form (name, coord — lat/lon entry, manual or
map-pick future). Once a place is created, articles and photos can be assigned to
it in their own edit forms.

---

## 6 · micro-map / region — designed for, not built yet

This section documents the intended future extension. No build artifact here.

### 6.1 — what it is

When a city accumulates enough content (threshold: Peat's judgment, not automated),
the L1 city node can be expanded into a **micro-map** of its districts. Each
district is an L2 Place (`level: 2, parentId: cityId`). The L1 city node remains
on the globe; entering it at sufficient zoom / after the dig gesture resolves the
L2 district nodes inside it.

### 6.2 — how it nests without repaint

The place model is already hierarchical (`level`, `parentId`, weight aggregation
from children). The globe rendering currently shows all Ne0 nodes at `r=1.005`.
The micro-map extension adds:

- **L1 → L2 zoom gesture:** the "dig deeper" action on a dense L1 node (weight
  above a threshold, L2 children present) becomes a camera-zoom into the surface
  of the globe near that city — revealing L2 place-nodes clustered in the city
  region. Camera transition: same slerp pattern, closer radius (r≈1.1 from
  surface perspective). L2 nodes render at the same place-node glyph (dot +
  rings) at their district coord.
- **No new component type needed.** L2 places use the same glyph, same panel,
  same dig gesture — recursion bottoms out when a place has no child places.
- **Weight aggregation:** L1 weight = its own content count + sum of L2 children
  content counts. This means Bangkok's ring-count reflects all Bangkok-district
  content, not just explicitly L1-assigned entries.

### 6.3 — design intent for districts (future)

Bangkok district examples: เยาวราช (Yaowarat) · ทองหล่อ (Thonglor) · อารีย์ (Ari).
Each gets its own coord, name, highlights. They read as sub-surveyed areas inside
the city node. The dig gesture is the micro-map's door; the micro-map is the
dig's resolution.

---

## 7 · breakpoints

### Desktop (> 880px)
As specified. Place panel: 360px fixed right panel, full globe viewport remains
to the left. Camera focuses on selected place, globe still rotatable by drag.

### Tablet (≤ 880px)
Panel slides up from bottom as a bottom sheet — 60% viewport height, draggable
up to full. Globe occupies the top 40%. Same content order: header → article →
photos → dig trigger. Camera still focuses, reduced lateral panel room.

### Mobile (≤ 600px)
Panel is full-viewport height. Globe visible only briefly as camera focuses, then
panel occupies the frame. No horizontal scroll. Photo strip scrolls horizontally
within the strip container (no wrapping). "Dig deeper" expands in-panel, no
navigation change. Touch targets: all interactive elements ≥ 44px tap target
(photo thumbs use 80px × 80px cells; DIG DEEPER text row uses min-height 44px).

---

## 8 · motion calibration

All timings per the master calibration (`worldline-design` skill):

| event | duration | easing | notes |
|---|---|---|---|
| camera focus to place | 700–1000ms | easeInOutCubic | matches `applySelected` 1100ms pattern; slightly faster for place (no article load wait) |
| place panel slide-in | 300ms | ease-out-quad | same as overlay / article panel precedent |
| "dig deeper" unfold | 220–300ms max-height + opacity | ease-out-quad | stagger 40ms per article row |
| hover ring glow | 120ms | linear | within 100–150ms hover calibration |
| selected ring recolor | 200ms | ease-out-quad | within 200–300ms selected-state calibration |
| camera return on dismiss | 700ms | easeInOutCubic | matches existing panel-close → applyStratum |

**Reduced motion:** all transitions → `duration: 0.001ms` (instant). No layout
change. Per existing `ConsoleApp.tsx` precedent and `WorldlineGlobe.tsx` reduced
motion ref pattern.

**No looping or decorative motion.** No breathing on place rings (unlike NeX
tendrils which have semantic breathing — the breathing there communicates
possibility-field state, a different semantic layer).

---

## 9 · accessibility

### Keyboard map (Ne0 stratum, place-nodes)

The globe has no keyboard-bound node navigation today. The JUMP is a click button
(`.jump` atom — `⟶ NEXT NODE` in the NETRA console, invoking `__atlasNetraJump`
on click). There is no `J` keybind. This spec defines new keyboard behavior for
the place-node era; Sirius must wire it:

| key | action |
|---|---|
| `Enter` / `Space` (while "⟶ NEXT NODE" button is focused) | existing behavior cycles to next node; when the active node is a place-node, this opens the front-door panel |
| `Tab` (panel open) | moves focus into panel: article link → photo strip links → DIG DEEPER button |
| `D` | activates "dig deeper" when place panel is open (new, matches the `1`/`2`/`3` stratum keybind convention) |
| `ESC` | if panel dug-open: collapses to highlights only (first press); if panel at highlights: closes panel (second press); matches existing `if (selectedIdRef.current) setSelectedId(null)` ESC handler pattern |

**Note to Sirius:** the existing keyboard handler in `WorldlineGlobe.tsx` lines
784–795 handles `1/2/3/0/ESC`. The place panel ESC behavior slots into the
`if (selectedIdRef.current) setSelectedId(null)` branch — the place selection
state replaces `selectedId` state for panel open/close signalling. The `D` key
needs a new condition in the existing handler.

### Screen reader text

Place-node THREE.js objects are canvas elements; accessible labeling is via the
NETRA voice strip (existing `aria-live="polite"` region at globe line 1950).
When a place is focused/hovered, the NETRA strip emits:
`PLACE · {name} · {N} records archived`

When panel opens:
`{name} highlights — {article title} and {M} photos. Dig deeper to see all {N} records.`

The panel itself is rendered in DOM (not THREE.js canvas), so semantic HTML applies:
- Panel is `<section aria-label="{place name} highlights">`
- Article link: `<a>` with accessible text including file number and title
- Photo strip: `<ol>` with each `<li>` containing `<a>` to the roll entry page;
  each `<a>` has `aria-label="Roll {id} · {M} frames"` (no captions available)
- "DIG DEEPER" trigger: `<button>` with label `Dig deeper — all {N} records at {name}`
- Collapsed dig section: `aria-expanded="false"` on the button, content hidden
  with `aria-hidden="true"` until expanded

### Focus order

1. ATLAS globe canvas (keyboard JUMP)
2. Place node focused → NETRA voice update
3. Enter → panel opens; focus moves to panel's first link (article)
4. Tab through panel elements
5. ESC → focus returns to the place node on the canvas

### Reduced motion preference

Read via `window.matchMedia('(prefers-reduced-motion: reduce)')` in the THREE
setup `useEffect`, pattern identical to `reducedMotionRef` in `WorldlineGlobe.tsx`
line 831. All CSS transitions on the DOM panel use the existing `@media
(prefers-reduced-motion: reduce)` block pattern from `ConsoleApp.tsx` line 123.

---

## 10 · tokens used

All from `app/globals.css`. No new hex values may be used in the panel or
console surfaces.

| role | token |
|---|---|
| panel surface | `var(--paper-warm)` |
| header strip text | `var(--ink-soft)` |
| article file number / status | `var(--accent-orange)` |
| article title | `var(--ink-body)` |
| "DIG DEEPER" trigger, rest | `var(--ink-soft)` |
| "DIG DEEPER" trigger, hover | `var(--accent-orange)` |
| dashed rule between sections | `1px dashed var(--ink-dashed)` |
| photo slot placeholder border | `1px dashed var(--ink-dashed)` |
| place card surface (console) | `var(--paper-warm)` |
| highlights NOT SET warning | `var(--accent-orange)` |
| ink hierarchy (all entries) | `var(--ink-primary)` → `var(--ink-soft)` → `var(--ink-faint)` |

**Three.js color hex values** (cannot read CSS vars — same constraint as
`WorldlineGlobe.tsx` palette comment at line 41):
- ink: `0x1f5063` (teal active palette)
- accent-orange: `0xD4602A`

**Token proposal to Polaris:**
The ring-weight visual needs no new token — ring sizes and opacity values are
intrinsic Three.js geometry, not CSS. If a future iteration wants CSS-driven ring
thresholds (weight ≥ 3, ≥ 7), a proposed token pair would be:
`--place-ring-threshold-2` (default: 3) and `--place-ring-threshold-3` (default:
7). **Not adding to `globals.css` now.** Flagged for Polaris review if Sirius
needs them during build.

---

## 11 · typography

| element | family | size | weight | tracking | color |
|---|---|---|---|---|---|
| place name header | JetBrains Mono | 9px | — | 0.3em | `var(--ink-soft)` |
| place coord in header | JetBrains Mono | 9px | — | 0.12em (`--meta-tracking-read`) | `var(--ink-soft)` |
| article title | Cormorant Garamond | 18px | 400 | default | `var(--ink-body)` |
| article file/date | JetBrains Mono | 9px | — | 0.3em | `var(--accent-orange)` |
| "DIG DEEPER" trigger | JetBrains Mono | 9px | — | 0.3em | `var(--ink-soft)` / hover `var(--accent-orange)` |
| "ALL RECORDS" header | JetBrains Mono | 8px | — | 0.32em | `var(--ink-faint)` |
| article rows (dig expanded) | JetBrains Mono | 9px + Cormorant 14px italic | — | 0.3em / default | `var(--ink-soft)` / `var(--ink-body)` |
| NETRA voice | JetBrains Mono | 9px | — | 0.05em | `var(--netra)` |

---

## 12 · references — patterns this spec builds from

| pattern | source | what it establishes |
|---|---|---|
| α halo ring glyph | `WorldlineGlobe.tsx` line 640 — `RingGeometry(0.034, 0.044, 32)` | place ring visual language — extend, don't reinvent |
| NETRA voice strip | `WorldlineGlobe.tsx` line 776 — `netraVoice` / aria-live | instrument narration for place focus/hover |
| article side panel | `WorldlineGlobe.tsx` lines 760–780 | front-door panel adapts this, doesn't replace its mechanism |
| `applySelected` camera focus | `WorldlineGlobe.tsx` line 1126 | same pattern — focus camera on place coord |
| stratum keyboard map (1/2/3/ESC) | `WorldlineGlobe.tsx` lines 784–795 | J/D/ESC key map for place nodes follows this convention |
| `ConsoleEntryForm` | `components/console/ConsoleEntryForm.tsx` | highlight editor form style and keyboard behavior |
| KINDS glyphs (◆ ◎ △) | `components/console/console-types.ts` line 59 | ◉ for place node; ◆/◎ for content rows in panel |
| contour-ring visual | `WorldlineGlobe.tsx` lines 492–510 | precedent for ring-as-instrument-texture on the globe surface |

---

## 13 · non-goals

- No auto-clustering of entries into places by proximity. All place assignment is
  Peat-curated in the console.
- No numeral label overlaid on a place-node in the 3D scene. Count is communicated
  through ring density, not a badge.
- No caption text in the photo highlight strip (telemetry shell — depth is earned).
- No film-sim palette applied to the highlight photo strip (that is the editor's
  territory — see gating prerequisite in the decision doc: film-sim real requires
  real-content wiring first).
- No place nodes in the NeX stratum. Places are Ne0 surface only. Fiction stays
  orbital in NeX. Observer nodes (α, 012, 047) are never place-nodes.
- No map/satellite layer behind the globe. The globe surface is the paper
  observatory instrument and must stay that.
- No "nearby" suggestions from a selected place (the Google Maps affordance).
- No comments, social sharing, or count-of-views at any place.
- Micro-map / L2 district rendering is explicitly deferred. This spec defines the
  schema and the gesture; no build artifact is expected from this spec for L2.

---

## 14 · data needs — handoff to Procyon

Procyon designs the schema to serve these requirements. This is the clean list.

### Required schema additions

1. **Place entity:**
   - `place.id` (string, slug-stable)
   - `place.level` (1 | 2)
   - `place.parentId` (string | null — null for L1)
   - `place.name` (string — "Bangkok · TH")
   - `place.coord` (`{ lat: number, lon: number }`)
   - `place.weight` (computed: count of directly-attached + child-place content; may be build-time derived)

2. **Article → place link:**
   - `article.placeId` (string | null — null = no place yet)

3. **PhotoSidecar → place link:**
   - `photoSidecar.placeId` (string | null)

4. **Highlight flag + rank per place:**
   - `article.highlightForPlace` (boolean — true = this article is the highlight for its `placeId`)
   - `photoSidecar.highlightRank` (1–5 | null — null = not a highlight; rank 1 = first in strip)
   - **Highlight unit for photos = individual frame (PhotoSidecar), not roll.**
   - A place can have at most 1 article with `highlightForPlace=true` and at most 5 sidecars with `highlightRank` set. Both are optional independently; neither requires the other.
   - Procyon enforces the 1-article and max-5-sidecar constraints at build time (or console write time).
   - A place with NO highlights set is valid; the globe node still renders (with ring weight from total content count) but the front-door panel shows only the DIG DEEPER trigger.

5. **Content list per place (build-time derived or API query):**
   - Given `placeId`, return: all articles with `article.placeId = placeId`, all
     photo sidecars with `photoSidecar.placeId = placeId`.
   - Ordered: highlights first (article highlight, then photos by rank), then
     remaining by date descending.

6. **Observer node separation:**
   - Observer nodes (α, 012, 047) are NOT places. They have no `placeId`, no
     `weight`, no highlight. They remain the existing `OBSERVER_NODES` array.
     Procyon must not co-locate a Bangkok place-record with the α node as the
     same entity.

7. **Real-content consumption prerequisite** (per decision doc gating):
   - Real velite articles, photos, and EXIF data must be consumed by the globe
     before film-sim and real photo thumbnails work in the highlight strip.
   - `photo.thumbWebp` (`variants.thumb.webp`) is already in `PhotoPin` type.
     This is the thumbnail to use in the highlight strip.
   - Film-sim is not surfaced in the globe highlight strip (non-goal above).

---

## 15 · items for Peat's confirmation

One question:

> When a place has content but **no highlights curated yet**, and a visitor
> clicks its node on the globe — should the front-door panel open at all?
>
> Option A (spec default): panel opens, shows the DIG DEEPER trigger only, no
> highlights block. NETRA: "N records. no highlights curated yet."
>
> Option B: no panel. Click focuses the camera and updates NETRA with the record
> count ("N records anchored here. dig when ready."), but nothing slides in.
> The dig-to-all only becomes accessible once highlights are set.

Option A is warmer to the content; Option B is stricter about earned entry.
Spec defaults to A. One conditional in Sirius's render settles it.

*Not escalating: place assignment is Peat-curated (no auto-cluster). This is
already decided in the decision doc and the soul spec — it's not a question.*

---

*end of spec · Betelgeuse α-VIS-04 · 2026-06-07*
