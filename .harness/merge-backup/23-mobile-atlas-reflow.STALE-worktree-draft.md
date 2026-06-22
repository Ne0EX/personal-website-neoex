# docs/design/23-mobile-atlas-reflow.md
# A.T.L.A.S. Mobile Reflow — ≤600px
# Task: mobile-native · α-VIS-04 · 2026-06-21

---

## intent

On a phone, the A.T.L.A.S. instrument is one tall scroll. The problem is not that
it scrolls — the problem is that the primary controls (stratum selector + NEXT NODE)
are in different DOM parents and both end up far below the globe, meaning the user
changes the globe while it is off-screen with no confirmation.

The fix is co-location: globe first, a compact control dock directly beneath it,
then depth layers below the fold. The observatory identity must survive. The frame
commands the page; the controls must feel like they belong to the instrument, not
a navigation bar.

Acceptance test (adapted): *"Does this still read as Peat — a surveyed paper
instrument — even on a phone?"*

---

## design decision: what lives in the dock vs what scrolls

**Dock (co-located, always-visible with the globe):**
- 3 strata as compact segmented glyph+id chips  — quick toggle
- ⟶ NEXT NODE action button

**Below the fold (scroll for depth):**
- `.atlas-current` — annotated stratum reading
- `§ STRATUM READOUT` — detailed data rows
- `.atlas-flow` — the 4-step signal path
- `.atlas-foot .cell` rows — NeX FIELD / Ne0N POLE / Ne0 NODES counts
- `.atlas-netra-voice` — NETRA companion narration

**Hidden ≤600px:**
- `.atlas-strata-list` + `.atlas-strata-head` (the verbose strata cards in the left
  aside) — the dock carries the strata function; the full verbose cards with role
  descriptions would duplicate the control. They remain in the DOM, hidden via
  `display:none`, so keyboard/AT never encounter two active strata controls at once.
  The detailed `.atlas-current` card below still shows the active stratum annotation.
- `.atlas-divider` — structural separator only needed when the strata list is visible.

**Never hidden (observatory signature always present):**
- `.atlas-head` — OBSERVATORY · WORLDLINE v.07 title strip
- `.atlas-globe-wrap` — the globe canvas itself
- `.atlas-hud` corners — OBSERVING / CAMERA / α / SCALE
- `.atlas-axis-label` — +Z NORTH / −Z SOUTH / PROJECTION FIELD / ARCHIVE FACE

---

## layout — ≤600px

```
┌─────────────────────────────────────────────────────┐
│ HEADER STRIP (.atlas-head)                           │
│ A.T.L.A.S. · OBSERVATORY · WORLDLINE v.07           │
├──────────────────────────────────────────────────────┤
│                                                      │
│  .atlas-globe-wrap (min-height: 300px)               │
│  ┌──────────────────────────────────────────────┐    │
│  │ [+Z·NORTH]                                   │    │
│  │  ┌───────────────────────────────────────┐   │    │
│  │  │  TL HUD    [α-mark]       TR HUD      │   │    │
│  │  │                                       │   │    │
│  │  │       (globe canvas)                  │   │    │
│  │  │                                       │   │    │
│  │  │  BL HUD                   BR HUD      │   │    │
│  │  └───────────────────────────────────────┘   │    │
│  │ [−Z·SOUTH]                                   │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
├──────────────────────────────────────────────────────┤
│  .atlas-mobile-dock                                  │
│  ┌─────────────────────────────────────────────┐    │
│  │  [◎ NeX]  [⊕ Ne0N]  [● Ne0]  │ ⟶ NEXT NODE │    │
│  └─────────────────────────────────────────────┘    │
├──────────────────────────────────────────────────────┤
│  ↓ SCROLL FOR DEPTH                                  │
│                                                      │
│  .atlas-current (CURRENT STRATUM · annotation)       │
│                                                      │
│  § STRATUM READOUT (.atlas-readout)                  │
│    ACTIVE · SURVEYED · ACTIVE · BRANCHES             │
│    BEARING · RADIUS · DEPTH                          │
│    01→02→03→04 flow steps                            │
│                                                      │
│  .atlas-foot .cell rows (counts — 1-col grid)        │
│    NeX · FIELD   247 RAYS                            │
│    Ne0N · POLE   +90°N                               │
│    Ne0 · NODES   047                                 │
│                                                      │
│  .atlas-netra (full NETRA console)                   │
│  .atlas-netra-voice (// NETRA voice strip)           │
└─────────────────────────────────────────────────────┘
```

---

## tokens used

```
surface                  var(--paper-base)
dock border              1px solid rgb(var(--ink-rgb) / 0.22)
dock bg                  var(--paper-base)
dock chip border idle    1px solid rgb(var(--ink-rgb) / 0.15)       ← matches .atlas-strata-btn
dock chip border active  1px solid var(--accent-orange)             ← matches .atlas-strata-btn.is-active
dock chip bg active      rgba(212, 96, 42, 0.06)                    ← matches .atlas-strata-btn.is-active
dock chip glyph active   var(--accent-orange)
dock chip text           var(--ink-primary), var(--font-mono)
dock NEXT NODE           same as .atlas-netra .jump (netra-soft border, netra color)
NEXT NODE active bg      rgb(var(--netra-rgb) / 0.12)               ← matches .jump:hover
```

---

## typography

```
dock chip id-label    JetBrains Mono, 9px, letter-spacing 0.12em, uppercase, var(--ink-primary)
dock NEXT NODE label  JetBrains Mono, 8px, letter-spacing 0.22em, uppercase, var(--netra)
```

The chip id-label uses 9px (= --meta-size) — same as the broader t-meta register.
Tracking is tighter than the full label-id (0.1em) to fit 3 chips + NEXT NODE in one row.

---

## motion

- Dock chip active state: `border-color 0.25s, background 0.25s` — matches `.atlas-strata-btn` transitions exactly.
- ⟶ NEXT NODE hover: `background 0.2s` — matches `.atlas-netra .jump:hover`.
- No dock-level enter animation. This is an instrument control row, not a hero.
- `prefers-reduced-motion`: inherited from the global `*` rule (animation/transition zeroed).

---

## states

```
chip default      idle border, ink-primary text, ink-soft glyph
chip hover        accent-orange border (same border-color as strata-btn:hover)
chip active       accent-orange border + bg + glyph — IS-ACTIVE parity
chip focus        outline: 2px solid var(--accent-orange); outline-offset: 2px
NEXT NODE default netra border + netra text
NEXT NODE hover   netra-soft bg
NEXT NODE focus   outline: 2px solid var(--netra); outline-offset: 2px
```

---

## breakpoints

```
>600px   desktop layout unchanged — .atlas-mobile-dock { display: none }
≤600px   .atlas-mobile-dock visible; .atlas-strata-list + .atlas-strata-head +
         .atlas-divider hidden via display:none; .atlas-globe-wrap min-height 300px;
         .atlas-content is flex-column with .atlas-globe-wrap ordered first
```

**Desktop pixel-identical guarantee:** all new rules are scoped to
`@media (max-width: 600px)` or the `.atlas-mobile-dock` base rule (`display:none`
as default so it never renders on desktop). No existing desktop rule is modified.

---

## accessibility

**Single focus path per breakpoint.**
The dock and the verbose strata list are never both focusable simultaneously:

- `>600px`: `.atlas-mobile-dock { display: none }` — removed from a11y tree entirely.
  Verbose `.atlas-strata-list` is the only strata control. Normal tab order.
- `≤600px`: `.atlas-strata-list { display: none }` (and `.atlas-strata-head`,
  `.atlas-divider`) — removed from a11y tree entirely. Dock chips are the only
  strata control. No double focus stops.

`display:none` is the chosen mechanism (not `aria-hidden` + `tabindex="-1"`) because
it cleanly removes elements from both the visual and the a11y tree in one property.
This avoids the risk of `aria-hidden` getting out of sync with `tabindex` guards.

**Dock semantics:**
- Each chip is a `<button>` with `type="button"` — same element as the existing
  `.atlas-strata-btn` buttons it mirrors.
- The wrapper `<div class="atlas-mobile-dock">` carries `aria-label="STRATUM
  CONTROLS"` to give AT a named region (Sirius to wire in JSX).
- The ⟶ NEXT NODE button carries `aria-label="Jump to next node"` — same intent as
  the desktop .jump button (Sirius to mirror existing inline aria on .jump if any).

**Focus order ≤600px (top → bottom):**
1. `.atlas-head` (static, no interactive)
2. Globe canvas (Three.js — currently not keyboard-interactive, no change)
3. `.atlas-mobile-dock` — 3 strata chips, then ⟶ NEXT NODE
4. `.atlas-current` / `.atlas-readout` (static)
5. `.atlas-foot .cell` counts (static)
6. `.atlas-netra .jump` desktop button — still in DOM but comes AFTER dock in source
   order; now duplicate of dock's NEXT NODE. Options: (a) leave it (user tabs to it
   twice which is redundant but not broken), or (b) add `tabindex="-1"` on the
   `.atlas-foot .atlas-netra` block at ≤600px via JS to suppress the duplicate stop.
   **Recommendation: option (b), implemented via a `data-mobile-suppress` attribute
   toggled by a tiny ResizeObserver in WorldlineGlobe.tsx — but this is optional
   polish. The dock's NEXT NODE is reached first, which is sufficient.**

**Touch targets:** dock chips min-height 44px, ⟶ NEXT NODE min-height 44px — CW-15
parity with the existing `.jump` fix.

**Screen reader:** the dock announces as a group of 3 buttons ("NeX", "Ne0N", "Ne0")
followed by "Jump to next node". The detailed content below the fold (stratum readout,
flow steps) remains accessible by scroll.

---

## references

- `.atlas-strata-btn` / `.atlas-strata-btn.is-active` — chip border/bg/glyph color
  parity; `worldline-atoms.css §atlas-strata-btn`.
- `.atlas-netra .jump` / `.jump:hover` — NEXT NODE button styling parity;
  `worldline-atoms.css §atlas-netra`.
- CW-15 (α-SUR-01, 2026-06-14) — 44px touch target floor on .jump; dock inherits same.
- `docs/design/60-responsive-system.md` — breakpoint discipline.
- `worldline-atoms.css §corner-reticle`, `§hud`, `§axis-labels` — observatory
  signature atoms that must survive at ≤600px (none hidden).

---

## non-goals

- No new tokens. All values resolve to existing CSS variables or their literal
  counterparts already used by the atoms they mirror.
- No animation on the dock itself. It is a static instrument row.
- No change to desktop (>600px) layout, spacing, or visual rhythm.
- No reordering of the desktop three-column `.atlas-content` grid.
- No touch gesture on the globe (swipe to change stratum) — that is a separate
  interaction proposal for a future task.
- No print stylesheet.
