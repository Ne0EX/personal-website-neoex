# docs/design/14-triangulate-search.md
# Triangulate Search Overlay · S4

> author · Betelgeuse (α-VIS-04) · 2026-05-31
> vision lock · VISION-2026-05-31-search-lineage-console.md §1.1
> supersedes · docs/design/40-search-overlay.md (pre-vision-lock)
> consumed by · Sirius (TriangulateSearch) + Procyon (pagefind)

---

## intent

A retrieval instrument. Sweeps the full archive cross-stratum. Reads as an
extension of the ATLAS frame, not a grafted modal. Two contracts locked by
Peat (VISION §1.1): sort = TIME only (asc/desc); landing = pinned + newest.
"นี่คือผมตอนนี้" — not a feed, an invitation.

---

## atoms used

| atom id | role |
|---|---|
| `corner-reticle` | overlay header TL micro bracket; full `.corner-marks` on overlay frame |
| `dashed-hairline` | all section seams (header strip / q.bar / filter row / results / globe panel) |
| `attractor-pill` | every filter chip — kind + TAG / PLACE / FILM SIM facets; three states identical |
| `type-roles` | instrument (mono 9px 0.3em meta), voice (Cormorant 15px italic titles), value (coords) |
| `hud-corner-readout` | SURVEY / COORDINATES section labels — mono 7px 0.22em ink-soft |
| `archive-node` | mini-globe result pin · teal default + accent-orange hover |
| `alpha-node` | mini-globe α locus · accent-orange, no dimmed state |
| `globe` | tri-panel · **standby variant** · 348×348px aspect-ratio 1 |
| `fiction-node` | mini-globe fiction ring (NeX stratum) |
| `photo-node` | mini-globe photo mark (RESERVED) |
| `netra-voice-strip` | landing-state ambient narration below filter row (rest variant) |
| `focus-button` | sort TIME toggle · default + is-active variants |
| `paper-canvas` | overlay panel surface texture (grain + scanlines) |

---

## layout

Full-page modal (not a drawer — needs full canvas for list + globe side by side).

```
┌────────────────────────────────────────────────────────────────────┐
│ [L]  TRIANGULATE                             [ESC · CLOSE ✕]  [BR] │
├────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ ⌕  survey the archive...                                      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│  [ ALL ]  [ ARTICLE ]  [ PHOTO ]  [ FICTION ]                      │
│  [ TAG ▾ ]  [ PLACE ▾ ]  [ FILM SIM ▾ ]          [ ↕ TIME · NEWEST] │
│  — if empty query: NETRA voice strip (rest) —                      │
│                                                                     │
│  ─ SURVEY ─────────────────────────────    ─ COORDINATES ───────  │
│  003 · 2026.05.07 · ARTICLE               ╭─────────────────────╮ │
│  on the architecture of taste             │                      │ │
│  ◇ method · ◇ reflection                 │   globe standby      │ │
│  → 13.76°N · 100.50°E · drift 0.0k       │   348×348 live mini  │ │
│  tended 3× · last 2026.05.08             │                      │ │
│                                           │   α orange + teal    │ │
│  001 · 2026.04.28 · ARTICLE              │   result pins        │ │
│  the four pours adaptation               ╰─────────────────────╯ │
│  ◇ method                                COORDINATES · α 13.76°N  │
│  → drift 2.7k · tended 1×                                          │
│                                                                     │
│  ↑↓ navigate · ↵ open · ⇥ chips · ESC close                       │
└────────────────────────────────────────────────────────────────────┘
```

**Overlay dimensions** ≥881px: `max-width: 940px`, `height: 80vh`,
`max-height: 760px`, `margin: 0 auto`. Backdrop `rgb(var(--ink-rgb) / 0.15)`.
Panel: `var(--paper-base)` + `paper-canvas` texture.

**Column split** ≥881px: results `calc(100% - 380px - 24px)`, globe `380px`
(`position: sticky; top: 0`). Gap `24px`.

**601–880px:** globe column reduces to 240px. Results take remainder.

**≤600px:** `width: 100vw; height: 100dvh`. Single column — results then
globe below (200×200px, centered). Input keyboard uses `dvh`.

---

## overlay header

Corner reticle micro variant (TL only on strip). `TRIANGULATE` — mono 11px
0.3em ink-primary. `ESC · CLOSE ✕` — mono 9px ink-soft, min 44×44px target.
`border-bottom: 1px dashed var(--ink-dashed)`.

---

## q.bar

`background: var(--paper-warm)`. `border: 1px dashed var(--ink-dashed)` rest;
`1px solid var(--ink-primary)` focus. `border-radius: 0`. Mono 13px.
`⌕` prefix glyph (ink-soft) inside field. `padding: 10px 12px 10px 32px`.
Autofocus on open.

---

## filter chip row

**Row 1 — kind (radio):** `ALL` · `ARTICLE` · `PHOTO` · `FICTION`.
`role="radiogroup"` per chip `role="radio" aria-checked`. All use
`.af-pill` atom. `ALL` active on landing.

**Row 2 — facets:** `TAG ▾` · `PLACE ▾` · `FILM SIM ▾` — same `.af-pill`
atom, each opens a `role="listbox"` popover (`var(--paper-warm)`,
`border: 1px dashed var(--ink-dashed)`, no rounded corners). Active facets
append count badge to chip label. `role="group" aria-label="facet filters"`.

**Sort toggle (right-aligned row 2):** `↕ TIME · NEWEST` / `↕ TIME · OLDEST`.
Uses `focus-button` atom (`.atlas-strata-btn`) — default + is-active variant.
`aria-pressed`. TIME is the only sort mode. Per VISION §1.1 Peat's call:
"sort = เวลาเลย ที่เหลือ filter ล้วนๆ". Do not add other sort modes.

---

## ResultCard

Five-line `<li>` inside `<ol>`, wrapping `<a href="{route}">`.

| line | content | typography |
|---|---|---|
| 1 meta | `<fileNum> · YYYY.MM.DD · [glyph] KIND` | mono 9px 0.3em ink-soft |
| 2 title | entry title (italic; match highlight: `accent-orange-soft` bg) | Cormorant italic 15px ink-primary · ellipsis |
| 3 tags | `◇ tag1 · ◇ tag2` (max 3; omit if none) | mono 9px ink-faint |
| 4 coord | `→ lat°N · lon°E · drift N.Nk` (mobile: `→ drift N.Nk` only) | mono 9px ink-soft |
| 5 alive | `tended N× · last YYYY.MM.DD` (omit if N=1 and date = initial) | mono 9px ink-faint |

Kind glyphs (mirror Globe pin taxonomy): `ARTICLE` (no prefix) · `▪ PHOTO`
(U+25AA) · `◆ FICTION` (U+25C6). Draft entries prepend `SEED ·` in ink-faint.

**Alive signal** sourced from: `patches.length` (article) · `variants.length`
(fiction) · `commentary.length + 1` (photo). Ambient, not alarming — ink-faint
only. Not a sort axis.

**Row states:**

| state | bg | left border | outline |
|---|---|---|---|
| resting | transparent | 3px solid transparent | — |
| hover / kbd-focus | `paper-warm` | 3px dashed `ink-dashed` | — |
| active (globe-pin hover) | `paper-warm` | 3px solid `accent-orange` | — |
| kbd-selected (↑↓) | `paper-warm` | 3px solid `accent-orange` | 1px solid `ink-primary` |

`padding: 10px 12px`. `border-bottom: 1px dashed var(--ink-dashed)`.
All transitions 120ms ease.

---

## tri-panel mini-globe

`globe` atom **standby variant**. 348×348px, `aspect-ratio: 1`. Same
`<MiniGlobe>` component (per atom impl_ref: `ATLASStandby.tsx`). No custom
SVG draw — compose from the atom.

Renders: Earth coastline · α orange node · teal result pins per kind.
No Fibonacci field, no worldline arc, no divergence readout at this scale.

**Hover sync (bidirectional, 120ms):** result row hover → pin highlights
(archive-node hover state, accent-orange ring). Globe pin hover → result row
scrolls into view + active left border. Local `useState<string|null>`.

No-WebGL fallback: 2D paper-canvas mini per globe atom standby descriptor.

Globe section label: `COORDINATES · α 13.76°N · 100.50°E` — mono 9px
ink-faint, centered below, hud-corner-readout type scale.

---

## states + motion

**States:** closed (not in DOM) · open-empty (NETRA voice strip rest variant
below chips + body `N entries surveyed · the entire archive is visible below`,
N = static build-time count; full-archive mini-globe) · loading (120ms debounce
→ `// surveying...`) · results (rows + matched pins) · no-results (`// nothing
surveyed · no match for "<query>"`) · failure (`// triangulation offline` +
`<a href="#chapter-index">↓ entries list</a>`).

**Motion:** overlay open/close 200ms opacity ease-out/in. Chip + row hover 120ms
ease. Globe pin highlight 120ms ease (color only). No looping animations. No
motion during reading. `prefers-reduced-motion` → all 0ms; globe auto-rotate off.

---

## accessibility

Dialog: `role="dialog" aria-modal="true" aria-label="TRIANGULATE · survey the archive"`. Input: `role="combobox" aria-expanded aria-controls="ts-results-list"`. Results: `role="listbox" id="ts-results-list"`; rows `role="option" aria-selected`. Kind chips: `role="radiogroup"` + `role="radio" aria-checked`. Sort: `aria-pressed`. Globe: `role="img" aria-label="coordinate map of search results"`. Live regions: open → `aria-live="assertive"` one-shot; results → `aria-live="polite"` count. Focus trap: Tab cycles input → kind chips → facet chips → sort → results → input. ESC: non-empty input clears; empty closes overlay. Lighthouse a11y ≥ 95.

---

## tokens used

Surfaces: `--paper-base` (panel) · `--paper-warm` (q.bar, row hover).
Ink: `--ink-primary` (title, chip-active bg, row kbd outline) · `--ink-soft`
(meta / drift) · `--ink-faint` (tags, alive, empty copy) · `--ink-dashed`
(all hairlines, row divider, row hover border) · `rgb(var(--ink-rgb) / 0.15)`
(backdrop).
Orange: `--accent-orange` (chip hover, row active border, α pin, match
highlight bg via `--accent-orange-soft`) · `--paper-bright` (chip-active text).

No raw hex. No new tokens.

---

## non-goals

No AI synthesis · no sort modes beyond TIME (VISION §1.1 explicit) · no
AttractorFields or DivergenceMeter binding · no full ATLAS Three.js panel in
overlay · no result hover-cards · no autocomplete/typeahead (v1) · no `/`
hotkey on mobile (soft keyboard; `◇ ARCHIVE` Nav link covers it).

---

*betelgeuse · α-VIS-04 · 2026-05-31*
