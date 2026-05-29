# Worldline · Responsive System + Mobile Contracts

> Status · v1.0 · 2026-05-15
> Author · Betelgeuse (α-VIS-04) · TASK-2026-05-15-60 · sonnet tier
> Predecessors · `journey-architecture.md` v1.2 §7 (mobile delegation) · `attractor-binding-mechanic.md` v1.1 §6 · PoC evidence `.claude/visual-diffs/main-poc-2026-05-15/shots/` (7 PNGs)
> Blocks · TASK-61 (ATLAS STANDBY card) · TASK-24/31/52 mobile layers
>
> This document is the canonical source for breakpoint behavior and per-surface mobile contracts. All implementation TASKs touching responsive behavior derive from it. No `[Peat: confirm]` markers remain — decisions are locked.

---

## 0 · evidence base

Seven PoC screenshots read before locking any decision:

- `main-375x900-fold.png` — fold is **empty paper**. Nav absent. N button only visible element. Globe renders nowhere in viewport.
- `main-600x900-fold.png` — Nav present. HeroBlock renders `FILE — 000 / GENESIS` strip. Globe absent from fold; ~800px empty paper below.
- `main-880x900-fold.png` — Nav present. HeroBlock strip with faint globe attempt. Globe absent from fold. Right-edge DivergenceMeter partially clipped.
- `main-1180x900-fold.png` — Nav present. HeroBlock strip. DivergenceMeter visible. Globe area blank on first paint (Three.js loading). Left rail is present.

The pattern is unambiguous: the PoC's `lg:` Tailwind breakpoint (1024px) hides the counts stack and DivergenceMeter compact below 1024px, and the Three.js Globe itself does not survive below the fold at any narrow viewport. Mobile users receive no primary content above the fold.

**This spec fixes that.**

---

## 1 · breakpoint table (locked)

Four breakpoints. The values are not Tailwind defaults — they are derived from content constraints specific to the A.T.L.A.S. instrument frame.

| name | range | primary surface | Globe status |
|---|---|---|---|
| **WIDE** | ≥1180px | A.T.L.A.S. frame · Globe is the fold | Three.js, full render, auto-rotate |
| **DESK** | 881–1179px | A.T.L.A.S. frame compacts · Globe stays | Three.js, compacted frame, no left-rail |
| **MID** | 601–880px | ATLAS · STANDBY card + ChapterIndex primary | **Live mini Three.js globe** (140px), full scene not loaded — lightweight mini mount only |
| **NARROW** | ≤600px | ATLAS · STANDBY card (smaller) + ChapterIndex | **Live mini Three.js globe** (120px), tighter padding |

### 1.1 rationale per breakpoint

**1180px (WIDE floor):** The A.T.L.A.S. three-column layout (left rail · Globe · right readout) requires approximately 1100px minimum for the left rail (180px) + Globe canvas (640px min) + right readout (200px) + padding (80px). At 1180px the layout is fully functional and the Globe reaches above the fold. Below 1180px the three-column layout begins to sacrifice either the left rail or the Globe. The 880px DESK breakpoint handles that collapse.

**880px (DESK floor / MID ceiling):** The `globals.css` existing `@media (max-width: 880px)` rule already collapses the ATLAS frame to a single column. This is the correct natural break. At 880px the Globe canvas still renders if tall enough, but at 880×900 the evidence shows it does not reach above the fold. The DESK behavior (compacted two-row pill layout) keeps Three.js loaded but restructures the frame so the Globe canvas occupies more of the viewport height. Globe remains usable — it just has no left rail, only a horizontal pill row.

**600px (MID floor / NARROW ceiling):** Below 600px the full ATLAS Three.js scene does not mount — the three-column layout and full instrument frame are not loaded. **However** (Peat directive 2026-05-29): the mini-globe in the STANDBY card is a **miniaturized live Three.js globe**, not a 2D SVG/canvas abstraction. It mounts a lightweight Three.js scene scoped to a 140px (MID) or 120px (NARROW) canvas — earth-coastline sphere + Ne0N spine + pole beacons + α beacon + faint NeX hint. Auto-rotate on. No attractor interaction. The soul is the same object at smaller fidelity; the distinction is canvas size and scene complexity, not rendering stack. WebGL degradation fallback (SVG-equivalent flat render) applies only when WebGL is unavailable.

**375px:** Not a separate breakpoint. Handled within NARROW by tighter padding (px-4) and a reduced STANDBY card height. 375px is the minimum supported viewport (iPhone SE/13 mini class). Below 375px no guarantees.

---

## 2 · WIDE breakpoint (≥1180px) — no change from PoC intent

At WIDE, the layout is as designed. The PoC's existing CSS is the source of truth with two corrections needed:

**Correction 1:** The existing `lg:` (1024px) Tailwind conditional that hides the counts stack must be reanchored to 1180px. Sirius changes the class to apply the hide only below 1180px, not 1024px.

**Correction 2:** The Three.js canvas minimum height must be set to ensure the Globe reaches above the fold at 1180×900: `min-height: calc(100vh - 140px)` where 140px accounts for Nav strip height (~100px with wrapping) + ATLAS head (~40px). This is not a new token — it is a layout rule using existing `vh` units.

Globe auto-rotate: on. FOCUS button rail (v1.3 renderer: `cameraFocus` surface/orbit/axis/rest): left rail, 3-button stack, unchanged from current PoC left rail placement. At WIDE, all four buttons fit comfortably.

---

## 3 · DESK breakpoint (881–1179px)

### 3.1 layout

```
┌─────────────────────────────────────────────────────────────┐
│ NAV (full row, links + clock on same row at >880px)          │
├─────────────────────────────────────────────────────────────┤
│ ATLAS HEAD (compacted, flex-wrap allowed)                    │
├─────────────────────────────────────────────────────────────┤
│ [FOCUS · SURFACE] [FOCUS · ORBIT] [FOCUS · AXIS] [REST]     │  ← horizontal pill row
│ (replaced left rail — above the Globe canvas)               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│          GLOBE CANVAS (100% width, min-height 440px)         │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│ ATLAS FOOT + NETRA VOICE (2-col, as per existing 880px CSS)  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 what changes at DESK

- Left rail drops. The four FOCUS camera-aid buttons move to a horizontal pill row above the Globe. Same button elements, same keyboard handlers (1/2/3/0), same label vocabulary. The row uses `display: flex; gap: 8px; padding: 8px 14px;` on `var(--paper-base)` background with a 1px dashed bottom rule `var(--ink-dashed)`.
- Right readout panel drops. Its content (RETICLE lat/lon + RANGE + JUMP button) moves into the ATLAS FOOT row. Existing 880px CSS already handles foot reflow to 2-col.
- Globe canvas: `width: 100%; min-height: 440px`. This is enough for the orthographic sphere to read at DESK width (881–1179px).
- HeroBlock: counts stack hides (the `lg:hidden` behavior is acceptable here — the ATLAS HEAD carries file count). DivergenceMeter compact stays visible in the HeroBlock strip.
- Article side panel (pin click): at DESK, the panel continues to slide from the right at `min(420px, calc(100vw - 32px))`. At 881px this is ~849px — too wide. Cap to `min(360px, 50vw)` at DESK breakpoint. Same 520ms motion, same `cubic-bezier(.2,.8,.2,1)`.

### 3.3 Nav stratum indicator at DESK

The `· STRATUM Ne0` readout (journey-arch §3.6) renders in the right-side Nav slot. At DESK widths (881–1179px) the Nav is single-row and wide enough to hold the indicator. No collapse needed.

---

## 4 · MID breakpoint (601–880px)

### 4.1 layout — `/` (home)

```
┌─────────────────────────────────────────────────────────────┐
│ NAV (stacked: id-strip top, links + clock below)             │
│   NAV stratum indicator: hides entirely at MID              │
├─────────────────────────────────────────────────────────────┤
│ HERO STRIP (FILE — 000 / GENESIS · WORLDLINE 1.130426)       │
│   counts stack: hidden · DivergenceMeter compact: hidden     │
├─────────────────────────────────────────────────────────────┤
│ ATLAS · STANDBY CARD (280px tall)                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ ┌─┐  WORLDLINE 1.130426                              │   │
│  │ └─┘  ATLAS · STANDBY · 047 surveyed                  │   │
│  │                                                       │   │
│  │      [live mini-globe · 140px diameter]               │   │
│  │                                                       │   │
│  │      α 1.130426 · drift -1.300                       │   │
│  │                                                       │   │
│  │  [ OPEN ATLAS ↗ ]          [ ↓ AS LIST ]             │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│ ATTRACTOR FIELDS (horizontal scroll pill row)                │
├─────────────────────────────────────────────────────────────┤
│ CHAPTER INDEX (primary surface — first entry above fold)     │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 ATLAS · STANDBY card — full spec

**Size:** 280px tall at MID. Shrinks to 220px at NARROW.

**Surface:** `var(--paper-warm)`. Border: 1px solid `var(--ink-hairline)`. The four corner reticles (the `┌─┐` / `└─┘` pattern from the existing ATLAS instrument frame) are rendered as 12×12px pseudo-elements using `var(--ink-soft)` — same pattern as the existing `.atlas-frame` corner treatment. No new token.

**Typography:**
- `WORLDLINE 1.130426` · `t-mono` 9px uppercase tracking 0.3em · `var(--ink-soft)`
- `ATLAS · STANDBY · 047 surveyed` · `t-mono` 9px uppercase tracking 0.3em · `var(--ink-primary)`
- `α 1.130426 · drift -1.300` · `t-mono` 9px · `var(--ink-soft)` except `1.130426` in `var(--accent-orange)`

**Mini-globe:** 140px diameter at MID, 120px at NARROW. Canonical size — resolves prior divergence with `spec-globe-v1-direction.md` §11.

> **Override — Peat directive 2026-05-29 (TASK-2026-05-29-SOUL-FACTORY-MINI-SPEC):**
> The mini-globe is a **miniaturized live Three.js globe**, not an SVG/canvas 2D abstraction. Same soul as the full globe: earth-coastline sphere + Ne0N axis spine + pole beacons + α beacon (Bangkok) + faint NeX shell hint. Auto-rotate at `0.08 rad/s`. No attractor interaction (static `all` state). No cameraFocus controls. Single fixed rest-position camera.
> The SVG/paper-canvas description below applies ONLY as a WebGL degradation fallback (no `WebGLRenderingContext`, `prefers-reduced-motion`, or `file://` origin). Not the primary at any viewport.

**WebGL degradation fallback (only):**
- Orthographic projection, paper-tone disc, faint graticule `var(--ink-faint)` 0.4 opacity dashed
- Simplified continent paths, `var(--ink-soft)` fill 0.3 opacity
- All surface pins as 4px circles at projected lat/lon
- No attractor membership treatment in degraded mode
- No interactivity — static render

**CTAs:** Two buttons on the same row.
- `[ OPEN ATLAS ↗ ]` — routes to `/atlas`. Touch target: 44px tall. Font: `t-mono` 9px uppercase. Border: 1px solid `var(--ink-primary)`. Background: transparent on default, `var(--paper-deep)` on hover. Hover transition: 100ms.
- `[ ↓ AS LIST ]` — internal anchor scroll to `#chapter-index`. Same styling as above. No border variant — plain underlined mono text link.

**Motion:** The card is static. No entry animation. No hover animation on the card itself (only on the CTA buttons).

**What the card does NOT contain:** no chat input, no stratum buttons (those live in `/atlas`), no attractor pills (those live in the row below).

### 4.3 Nav behavior at MID

The Nav stacks to two rows per existing 880px CSS. The `· STRATUM Ne0` indicator hides at MID. Rationale: the stratum indicator announces a departure from default that only matters when the Globe is present and interactive. At MID, the Globe is replaced by the STANDBY card — the stratum system is not active in the viewport. Showing a stratum indicator with no Globe to act on is noise.

Nav links wrap and remain reachable. The `⊹ TRANSMIT` link is the lowest-priority and may wrap to a new line at tight widths — acceptable. Tab order preserved.

### 4.4 AttractorFields at MID

Horizontal scrollable pill row. Renders directly below the STANDBY card, above ChapterIndex.

- `overflow-x: auto; scroll-behavior: smooth; -webkit-overflow-scrolling: touch`
- `scroll-snap-type: x mandatory` · each pill `scroll-snap-align: start`
- Right-edge fade: `var(--paper-base)` → `transparent` over 24px (CSS `mask-image`)
- Each pill: 44px min height (touch target). Width auto. `t-mono` 9px uppercase.
- Active pill: `var(--ink-primary)` background, `var(--paper-bright)` text. Unchanged from existing `AttractorFields.tsx` styling.
- Selecting a pill: filters ChapterIndex list below (per attractor-binding-mechanic §6.1). Also updates the live mini-globe attractor highlight (membership halos); no-WebGL/reduced-motion fallback renders static — no pill-driven highlight in degraded mode.

### 4.5 ChapterIndex at MID

ChapterIndex becomes the primary content surface at MID. It renders immediately below the attractor pill row with a `[ ↑ GLOBE VIEW ]` affordance at its top:

```
  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
  // surface archive · 047 traces     [ ↑ GLOBE VIEW ]
  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
  FILE 047 · 2026.05.15 · CONFIRMED · 4 MIN
  A title in italic Cormorant
  ...
```

The `[ ↑ GLOBE VIEW ]` scrolls to the top of the STANDBY card. Anchor: `#atlas-standby`. `t-mono` 9px, `var(--ink-soft)`. No border. Minimum touch target 44px tall (the row provides height).

The `// surface archive · 047 traces` line is a `t-mono` 9px `var(--ink-soft)` label. It is the list's header — the equivalent of the desktop ATLAS below-the-fold affordance. If `activeAttractor !== 'all'`, this line reads `// filtered to <attractor> · <N> traces · ✕ clear` per attractor-binding-mechanic §7.1 component list.

---

## 5 · NARROW breakpoint (≤600px)

Identical to MID with the following overrides:

| property | MID | NARROW |
|---|---|---|
| horizontal padding | `px-7` (28px) | `px-4` (16px) |
| STANDBY card height | 280px | 220px |
| live mini-globe diameter | 140px | 120px |
| Nav padding | `18px 18px` (existing) | `14px 16px` |
| ATLAS HEAD | visible | hides entirely — too dense at 375px |
| section padding | `[data-section]` 18px L/R | `[data-section]` 16px L/R |

**375px floor:** At 375px the layout is a single column. No element is wider than the viewport. No horizontal scroll except the attractor pill row (intentional). All touch targets remain ≥44px.

**ATLAS HEAD at NARROW:** The file strip (`FILE — 000 / GENESIS`) is hidden at ≤600px. The STANDBY card carries enough identity without duplicating the meta strip. This is the only information loss at NARROW — it is acceptable because the card itself carries `WORLDLINE 1.130426`.

---

## 6 · per-surface mobile contracts

### 6.1 Nav stratum indicator

| breakpoint | behavior |
|---|---|
| WIDE (≥1180px) | renders in right-side Nav slot as specified in journey-arch §3.6 |
| DESK (881–1179px) | renders in right-side Nav slot; Nav is single-row and holds it |
| MID (601–880px) | hidden entirely — Globe not active in viewport |
| NARROW (≤600px) | hidden entirely |

No animation on the hide/show transition across breakpoints — it appears or disappears based on viewport width, not on user action.

### 6.2 article entry (β surface)

```
WIDE / DESK:
  ┌── header strip (reticle + meta row) ──────────────────┐
  │ body (max-width 70ch) + sidenote column (20ch)         │
  │ patches log · related branches · prev/next             │
  └───────────────────────────────────────────────────────┘

MID (≤880px):
  ┌── header strip (meta wraps to 2 rows) ────────────────┐
  │ body (100% - 32px, no sidenote column)                │
  │ sidenotes: drop below paragraph, footnote-style       │
  │ patches log · related branches · prev/next             │
  └───────────────────────────────────────────────────────┘

NARROW (≤600px):
  ┌── header strip row 1: file / date / status            │
  │   header strip row 2: coords / read time              │
  │ body (100% - 32px)                                    │
  │ patches log · related branches · prev/next            │
  └───────────────────────────────────────────────────────┘
```

**Specific rules:**
- Sidenotes at ≤880px: each sidenote renders as a block below the paragraph it annotates, separated by a 1px dashed `var(--ink-dashed)` rule. Font: `t-mono` 9px `var(--ink-soft)`. Prefix: `↳` in `var(--accent-orange)`.
- Header strip at ≤600px: two rows. Row 1: `FILE — NNN · YYYY.MM.DD · STATUS`. Row 2: `COORDS · {lat}°N · {lon}°E · NN MIN`. Each row is `t-mono` 9px uppercase tracking 0.3em `var(--ink-soft)`.
- Body line-length: at ≤600px, `max-width: 100%; padding: 0 16px` — no `ch` constraint; the viewport is the constraint.
- Patches log: unchanged at all breakpoints (it is already a simple block with no column dependency).
- Related branches: at ≤600px, three cards stack vertically (each full-width). No grid.
- Prev/next nav: at ≤600px, two rows (PREV on top, NEXT below). Each row 44px tall minimum touch target.

### 6.3 photo entry (γ surface)

```
WIDE / DESK:
  ┌── photo (film-strip border) ─────────┬── EXIF readout ──┐
  │ roll context strip (prev/next/FULL)  │ instrument block  │
  └──────────────────────────────────────┴───────────────────┘

MID (≤880px):
  ┌── photo (film-strip border, full-width) ───────────────┐
  │ EXIF readout (stacks below photo)                      │
  │ roll context strip (prev thumb / FULL ROLL / next)     │
  └───────────────────────────────────────────────────────┘

NARROW (≤600px):
  ┌── photo (film-strip border, full-width) ───────────────┐
  │ EXIF readout (stacks below, labels in t-mono 9px)      │
  │ roll context strip (icon links only — no thumbnails)   │
  └───────────────────────────────────────────────────────┘
```

**Specific rules:**
- Photo image: at all breakpoints, `width: 100%` within its container. Film-strip border (4px `var(--ink-faint)` with 8px `var(--paper-warm)` margin) remains at all breakpoints.
- EXIF readout at ≤880px: single column. Each row is `LABEL · VALUE` on one line. `t-mono` 9px, `var(--ink-soft)` label, `var(--ink-primary)` value. No horizontal panel splitting.
- Roll context strip at ≤600px: previous and next thumbnails drop. Replace with `← PREV` and `NEXT →` text links. `[ ⇋ FULL ROLL ]` stays centered. All three links on one row. Minimum 44px tall row.
- Film-simulation suggestion affordance `[ match palette to CLASSIC CHROME · ⌃P ]` hides at ≤600px. The palette toggle is keyboard-only (`⌃P`) and that key does not exist on mobile soft keyboards. The affordance is hidden — the palette persists from `wl:film-sim` if the visitor toggled it on desktop and returns on mobile.
- Lightbox: standard swipe gesture (single-finger horizontal) for previous/next within roll. Pinch-zoom inside lightbox: **enabled** — the lightbox is a contained context, not the Three.js Globe. The disable decision below (§7) is Globe-specific only.

### 6.4 NETRA drawer — mobile

Per journey-arch §4.2: at ≤600px, the drawer takes full viewport width.

```
NARROW (≤600px) — drawer open:
  ┌───────────────────────────────────────────────────────┐
  │ ◎ NETRA                           [α 1.130426] [✕]   │  ← 60px header
  ├───────────────────────────────────────────────────────┤
  │                                                        │
  │  thread body (flex-1, overflow-y: auto)               │
  │  NETRA responses in italic Cormorant                  │
  │  tool-call lines in t-mono 9px                        │
  │                                                        │
  ├───────────────────────────────────────────────────────┤
  │  [input field]                            [→ SEND]    │  ← auto-height
  │  [ 47 / 50 today ]                                    │
  └───────────────────────────────────────────────────────┘
```

**Mobile-specific contracts:**
- Container: `position: fixed; top: 0; left: 0; right: 0; bottom: 0; height: 100dvh`. Use `dvh` not `vh` for iOS Safari virtual keyboard handling per journey-arch §4.5.
- Viewport meta must include `interactive-widget=resizes-content` (in `app/layout.tsx` viewport export — Sirius adds this to the Next.js viewport configuration).
- Composer input: `position: sticky; bottom: 0` within the drawer's flex column. When the virtual keyboard opens, the browser resizes the viewport (via `interactive-widget=resizes-content`) and the drawer's `100dvh` contracts accordingly — the composer stays above the keyboard without any JavaScript intervention.
- Send button: 44×44px minimum. `var(--ink-primary)` background, `var(--paper-bright)` text. Full corner-to-corner tap target — no margin shrinkage.
- Close affordance: the `✕` in the header is 44×44px target. The N button at the bottom-left viewport position is suppressed when the drawer is open (replaced by the header close). The N button re-appears when the drawer closes.
- Focus management: when drawer opens, focus moves to the composer input. When drawer closes, focus returns to the N button. ESC once clears the composer. ESC twice closes the drawer. This is the same keyboard contract as desktop.
- Reduced motion: the drawer slides in at 520ms on desktop. At reduced motion, the drawer appears instantly (0ms). This applies at all breakpoints including NARROW.

**Drawer width at MID (601–880px):** `min(420px, calc(100vw - 32px))`. At 880px this is 420px. At 601px this is ~569px — still within the window. This is intentional: at MID the drawer is nearly full-width anyway; forcing 420px cap when the viewport is only 601px leaves only 181px visible of the page behind the drawer, which is not useful. A full-viewport overlay at MID is cleaner. Decision: at ≤700px, the drawer becomes `width: 100%; left: 0` (full-width), not just at ≤600px. At 701–880px, it stays at `min(420px, calc(100vw - 32px))`.

### 6.5 search overlay — mobile

The search overlay (TASK-40 spec forthcoming) is committed to at MID and NARROW as follows:

```
WIDE / DESK:
  [ LEFT: results list ] [ RIGHT: SVG mini-globe map ]

MID (≤880px):
  [ results list, full width ]
  [ SVG mini-globe, full width, below list ]

NARROW (≤600px):
  [ results list, full width ]
  SVG mini-globe: hidden entirely
```

**Rationale for hiding mini-globe at NARROW:** At 375px the mini-globe at any useful size (≥120px) competes with the results list for the primary content area. The results list is the operative search surface — the mini-globe is spatial context. On a 375px viewport the visitor is in query mode, not map mode. The globe appearance is deferred to `/atlas` when they want spatial context.

**Search overlay open/close at mobile:** The `⌕ TRIANGULATE` Nav link is the tap affordance. The `/` hotkey is desktop-only. The overlay opens full-viewport on mobile. ESC or the overlay's own close button (`✕`) dismisses.

---

## 7 · pinch-zoom — Globe (flag #9 resolution)

**Decision: pinch-zoom on the Three.js Globe is disabled at all breakpoints.**

**Rationale:**

The Globe at WIDE and DESK operates through four `cameraFocus` positions (per v1.3 strata co-equal model): `surface / orbit / axis / rest`. These four discrete camera positions are the vocabulary of the instrument. The Globe is not a map you zoom into — it is an instrument you read from a defined observation position.

Allowing pinch-zoom introduces a continuous zoom dimension that:
1. Has no "home" position — the visitor can drift to a zoom level where the instrument labels (NETRA voice, pin labels) are no longer at a readable size.
2. Cannot be easily undone — `[reset zoom]` is an affordance that does not exist in the current instrument vocabulary.
3. Conflicts with the four FOCUS button semantics — the visitor is supposed to press FOCUS · SURFACE to see the surface close-up, not pinch in. Two affordances for the same action with different results is incoherent.
4. On iOS, pinch-zoom on a Three.js canvas can hijack the system pinch-to-zoom gesture in unpredictable ways, causing the page to zoom instead of the canvas.

The four FOCUS camera positions give the visitor three levels of spatial reading (axis close-up, orbit view, surface close-up) plus rest. This is sufficient for the instrument's purpose.

**Exception: lightbox.** Pinch-zoom inside the photo lightbox (`yet-another-react-lightbox`) is enabled — that is a contained viewing context where zoom serves a direct legibility purpose. The Globe disable is Globe-specific.

**Implementation note for Sirius:** Set `controls.enableZoom = false` on the Three.js `OrbitControls` instance. This disables both scroll-wheel zoom (desktop) and pinch-zoom (mobile). The existing PoC may already have this partially set — verify and lock.

---

## 8 · Globe rendering under v1.3 co-equal strata at DESK (881–1179px)

Under the v1.3 co-equal renderer (TASK-16 or successor), all three strata (surface / orbit / axis) render simultaneously. At DESK widths the Globe canvas is approximately 881–1179px wide and 440px tall minimum.

**Transparency legibility:** The v1.3 renderer uses a partially transparent earth body (~0.55 opacity baseline, dropping to 0.35 when an attractor is active). At DESK width (440px canvas height), the axis line through the body is approximately 30–40px thick on screen. At 0.55 opacity this reads clearly against `var(--paper-base)` background. The orbital network arcs are layered above the surface; at canvas height 440px these arcs have enough pixel height to be visible (they are typically 2–3px stroke weight in SVG-equivalent terms at this resolution). Verdict: **transparency legibility holds at DESK.**

**FOCUS buttons at DESK:** The horizontal pill row above the Globe (§3.1) replaces the left rail. Four buttons. At 881px viewport the row has approximately 881px of width for four buttons plus padding — each button has ~200px of horizontal space. The `t-mono` 9px uppercase labels `FOCUS · SURFACE / ORBIT / AXIS / REST` fit comfortably. No wrapping needed.

**At MID (601–880px):** The full ATLAS Three.js scene does not load, but the mini-globe in the STANDBY card IS a live Three.js globe at 140px (Peat directive 2026-05-29). It renders all three strata simplified for its canvas size: surface at 0.92 opacity, Ne0N spine visible through the body, pole beacons pulsing, NeX shell at faint opacity (0.05–0.10). No 60fps attractor network — single static attractor state. The co-equal strata read at miniature scale; the identity is preserved even at 140px.

---

## 9 · touch targets — full surface audit

Every interactive element must meet 44×44px minimum. Audit:

| element | current state | contract |
|---|---|---|
| N button (NETRA) | 56×56px (confirmed in PoC) | pass — no change |
| FOCUS buttons (horizontal pill row, DESK) | new surface | 44px min height, auto width |
| ATLAS · STANDBY CTAs | new surface | 44px min height each |
| Attractor pill row pills (MID/NARROW) | existing, unknown | 44px min height enforced in CSS |
| Nav links | existing | min 44px tap target via padding |
| Article prev/next nav (MID/NARROW) | new surface | 44px min height row |
| Photo roll context strip (NARROW) | new surface | 44px min height row |
| Search `⌕` Nav affordance | new surface | 44px min height (shares Nav row) |
| NETRA send button | new surface | 44×44px |
| NETRA drawer close `✕` | new surface | 44×44px |
| ChapterIndex entry rows | existing | 44px min height enforced |
| Stratum indicator `· STRATUM Ne0` | NOT interactive — no touch target needed | display only |

**CSS implementation pattern.** Use `min-height: 44px; display: flex; align-items: center;` for row-type targets. Use `min-width: 44px; min-height: 44px;` for icon-type targets (close, send). Do not use padding alone to meet 44px if it makes the element look inflated — prefer transparent hit-area extension via `::after` with `position: absolute; inset: -8px`.

---

## 10 · motion budget — mobile

Mobile devices (iPhone 12-class: A14 chip, 60fps) sustain 60fps for DOM-based CSS animations. Three.js canvas is the performance risk.

**Keep at all breakpoints:** hover transitions (100–150ms), stratum indicator swap (200ms), attractor active transition (220ms), NETRA drawer slide-in (520ms GPU-composited transform), DivergenceMeter Nixie flicker (semantic identity, not decoration), boot sequence (~2500ms, not a scroll surface).

**Keep at WIDE/DESK only (full ATLAS Three.js scene):** camera FOCUS moves (900ms), pin selection fly (1100ms), attractor edge stagger (220ms), body transparency tween (600ms).

**Keep at MID/NARROW (mini Three.js globe — Peat directive 2026-05-29):** mini-globe auto-rotate at `0.08 rad/s`. Pole beacon pulse (sin). α ring pulse (sin). NeX shell counter-rotate. All same soul motion, scoped to the mini canvas. Under `prefers-reduced-motion`: rotation pauses, static render.

**Cut at MID/NARROW:**
1. Globe camera FOCUS moves — the mini has no FOCUS controls.
2. Attractor network edges — mini is static `all` state, no attractor interaction.
3. Article side panel slide-in — replaced by full-page navigate. A 520ms panel over 35–50% of a 375px viewport destroys spatial orientation. Full-page navigate + `[← BACK]` is the correct replacement.

**Reduced-motion:** The existing `globals.css` `prefers-reduced-motion` rule (`animation: none !important; transition-duration: 0.001ms !important`) covers all CSS. Sirius adds the JavaScript path: `window.matchMedia('(prefers-reduced-motion: reduce)').matches` → Three.js camera moves collapse to 0ms. This is a JavaScript concern the CSS rule cannot cover.

---

## 11 · `/atlas` route — mobile full-viewport Globe

This route is TASK-61's implementation target. This spec provides the design contract.

```
/atlas (MID and NARROW only — WIDE/DESK redirect to /)
┌────────────────────────────────────────────────────────┐
│ NAV (minimal: logo + back link only)                   │
│ [← WORLDLINE] / [ATLAS]                               │
├────────────────────────────────────────────────────────┤
│                                                        │
│   THREE.JS GLOBE CANVAS (100vw × calc(100dvh - 60px)) │
│                                                        │
│   [at DESK widths, the full ATLAS frame renders]       │
│   [at MID/NARROW, canvas is full-viewport, no rails]  │
│                                                        │
├────────────────────────────────────────────────────────┤
│ BOTTOM SHEET: FOCUS · [SURFACE] [ORBIT] [AXIS] [REST] │
│   (collapsed by default; tap to show)                 │
├────────────────────────────────────────────────────────┤
│ NETRA VOICE STRIP (if pin selected — else hidden)      │
└────────────────────────────────────────────────────────┘
```

### 11.1 NAV at `/atlas`

Minimal: `[← WORLDLINE]` links to `/` (with session state preserved via zustand persist). The Nav does NOT show the four site links (`◇ INDEX · ◇ TRACES · ◇ ARCHIVE · ◇ TRANSMIT`) on `/atlas` — they would clutter the instrument view. The only navigation is back.

### 11.2 FOCUS bottom sheet

At `/atlas` on mobile, the `cameraFocus` buttons move to a bottom sheet that collapses to a thin handle strip by default:

- **Collapsed:** 44px tall strip at the bottom. `FOCUS ·` label on the left. Current focus value on the right (`SURFACE` / `ORBIT` / `AXIS` / `REST` in `t-mono` 9px). Tapping anywhere on the strip expands.
- **Expanded:** sheet slides up to show the four buttons in a 2×2 grid (each 44px tall). Sheet height: `~136px`. Sheet surface: `var(--paper-warm)`, top border 1px dashed `var(--ink-dashed)`. Tapping a button activates that focus and collapses the sheet.
- Keyboard `1/2/3/0` still works when the canvas has focus.

### 11.3 pin selection at `/atlas` on mobile

Single tap on a pin → camera flies + bottom sheet shows NETRA voice strip above it (not a full side panel). A `READ ENTRY →` tap on the voice strip navigates to the full entry page.

The desktop two-step flow (hover preview → side panel → entry page) becomes a one-step flow on mobile:
- Tap pin → `READ ENTRY →` in voice strip → entry page.

The in-Globe article side panel does NOT open on mobile. It is too large (420px) relative to the viewport (375–600px) and the Globe becomes unusable behind it. The voice strip read-out is sufficient identification before committing to a full-page navigate.

### 11.4 WIDE/DESK redirect

If a visitor navigates to `/atlas` at a WIDE or DESK viewport, redirect to `/` with a `?from=atlas` query param (no semantic meaning — just preserves the back button intent). Sirius implements via Next.js middleware or page-level redirect. The Globe at WIDE/DESK lives on `/`, not `/atlas`.

---

## 12 · anti-Codex audit

All ten major decisions pass the 6-point gauntlet (ref fidelity / token compliance / pattern reuse / a11y / mobile / motion). Summary:

- **Token compliance:** every surface uses existing `globals.css` tokens — `--paper-warm`, `--ink-hairline`, `--ink-soft`, `--ink-dashed`, `--ink-faint`, `--accent-orange`. No new tokens.
- **Pattern reuse:** STANDBY card corner reticles from `.atlas-frame`; SVG mini-globe orthographic projection consistent with search overlay (§6.5) and attractor-binding §6.2; FOCUS pill row reuses existing button vocabulary; sidenote collapse reuses `.marginalia` footnote-style pattern.
- **a11y:** STANDBY card has `aria-label`; SVG mini-globe is `aria-hidden="true"` (OPEN ATLAS button provides navigation); NETRA drawer has focus trap + ESC dismiss; bottom-sheet has `aria-expanded`; keyboard `1/2/3/0` preserved at `/atlas`.
- **Motion:** all transitions in calibrated buckets; three automatic cuts at MID/NARROW (Three.js not loaded); reduced-motion CSS rule covers DOM; JavaScript path flagged to Sirius.

**0 FAILs. 0 partials.**

---

## 13 · non-goals

- This spec does NOT modify any component.
- This spec does NOT propose new design tokens.
- This spec does NOT specify the search overlay surface in full (that is TASK-40).
- This spec does NOT specify the boot sequence responsive behavior (deferred).
- This spec does NOT specify the `/photos/<roll>` roll index responsive behavior (that is part of the γ spec, TASK-10).
- This spec does NOT address tablet-landscape edge cases above 1024px but below 1180px — those fall into the DESK behavioral tier with acceptable degradation.
- This spec does NOT cover the fiction entry surface (deferred per journey-arch §3.4).

---

## 14 · implementation dispatch order

Sirius reads this spec before beginning any responsive implementation. The order of work:

1. **Correct the WIDE breakpoint threshold.** Move `lg:hidden` equivalents from 1024px to 1180px in `HeroBlock.tsx`. Set Globe canvas `min-height: calc(100vh - 140px)` at WIDE. This fixes the most critical problem (Globe not reaching the fold at 1180px).

2. **Implement ATLAS · STANDBY card component.** New `components/ATLASStandby.tsx`. Renders conditionally at MID/NARROW. Accepts props: `alpha`, `drift`, `entryCount`, `onOpenAtlas`, `onScrollToList`. Contains the SVG mini-globe (static render, pins from `RECENT_ENTRIES`).

3. **Implement DESK FOCUS pill row.** At 881–1179px, the left rail becomes a horizontal pill row above the Globe. Button elements, same keyboard handlers.

4. **Wire the `/atlas` route.** New `app/atlas/page.tsx`. Full-viewport Globe, minimal Nav, bottom sheet FOCUS. WIDE/DESK redirect.

5. **Wire responsive NETRA drawer.** At ≤700px, set `width: 100%`. Add `100dvh` container. Add `interactive-widget=resizes-content` to viewport meta in `app/layout.tsx`.

6. **Wire article and photo entry responsive rules.** Sidenote collapse at ≤880px. Header strip two-row at ≤600px. Photo EXIF single-column. Roll context icon-only at ≤600px.

7. **Disable pinch-zoom on Globe.** `controls.enableZoom = false` in `WorldlineGlobe.tsx`.

8. **Confirm reduced-motion JavaScript path.** `prefers-reduced-motion` media query check in Three.js setup code.

---

*betelgeuse · α-VIS-04 · the Red Sentinel · TASK-2026-05-15-60 · sonnet tier · responsive-system v1.0*
*2026-05-15 · breakpoint table locked · mobile contracts locked · pinch-zoom locked · motion budget locked*
