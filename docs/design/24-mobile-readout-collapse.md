# docs/design/24-mobile-readout-collapse.md
# ATLAS Stratum Readout Collapse — ≤600px expander
**Author:** α-VIS-04 Betelgeuse · 2026-06-21 (revised: ancestor-class mechanism)
**Branch:** genesis/mobile-native · S4 (stratum readout collapse)

---

## intent

Below the globe and the mobile control dock, the § STRATUM READOUT block,
the ATLAS FLOW steps, the foot count cells, and the NETRA console form a
long vertical wall on a 375px phone screen. Most of that telemetry is not
the reason a visitor picks up their phone.

Peat's decision: depth is earned. Globe + dock + current stratum status are
the primary mobile layer. Full instrument telemetry is opt-in — one tap.

This matches the worldline soul principle: exploration not exhibition. The
globe orients; the dock selects; the current card confirms; the readout is
for the person who wants more.

Desktop (>600px): pixel-identical to today. Full readout always visible.
No change to any desktop class or layout.

---

## mechanism (REVISED — ancestor-class, no wrapper div)

`aside.atlas-readout` lives inside `.atlas-content` (the three-column
desktop grid). `footer.atlas-foot` (containing `.atlas-foot-row`) is a
**sibling** of `.atlas-content`, outside it. Wrapping both in a single `<div>`
would break the desktop grid. No DOM restructure is allowed.

The solution: Sirius toggles the class `readout-collapsed` on the existing
`.atlas-frame` element — the shared ancestor of both targets. CSS rules
inside `@media (max-width: 600px)` then target the two elements directly:

```css
.atlas-frame.readout-collapsed .atlas-readout,
.atlas-frame.readout-collapsed .atlas-foot-row {
  display: none;
}
```

`display:none` is used (not `max-height`). No height-guessing required.
The class has **no effect outside the ≤600px media block** — desktop
behavior is pixel-identical to pre-task.

---

## design decisions

### always-visible on mobile (≤600px)

Two elements stay outside the collapse mechanism, always rendered:

1. `.atlas-current` — the CURRENT STRATUM card. The key state line:
   "FULL · NE0EX / all strata observed". Orange-accented. The minimum
   instrument reading a visitor needs to know where they are.

2. `.atlas-netra-voice` — the ambient NETRA narration line. Soul register.
   One line, netra-blue border + italic Cormorant voice text. Costs almost
   no vertical space; communicates that the instrument is alive.

### collapses via ancestor class (≤600px, closed by default)

Two elements are hidden when `.atlas-frame.readout-collapsed` is present:

- `aside.atlas-readout` — the § STRATUM READOUT head + `.atlas-readout-row`
  instrument pairs (SURVEYED/ACTIVE/BRANCHES trio, BEARING/RADIUS/DEPTH trio) +
  `.atlas-flow` (4 SIGNAL steps)
- `.atlas-foot-row` — the cell counts row (NeX·FIELD / Ne0N·POLE / Ne0·NODES)
  inside `footer.atlas-foot`

Note: `.atlas-netra` (RETICLE/RANGE readout + `.jump` NEXT NODE button) is
inside `footer.atlas-foot` but NOT inside `.atlas-foot-row`. It stays visible
when collapsed — or Sirius may hide it too by adding it to the rule if needed.
The current rule only targets `.atlas-foot-row` (counts). The `.atlas-netra`
block is adjacent to it, not nested inside it; Sirius should check the actual
DOM and extend the rule if the netra console should also collapse.

Note: `.atlas-netra-voice` is EXCLUDED — it is always visible (see above).

Note: the `.atlas-foot .jump` NEXT NODE button (inside `.atlas-netra`) is
inside the footer. The mobile dock already has a NEXT NODE jump chip visible
at all times — no primary action is lost.

### expander control

`.atlas-readout-toggle` button:
- Label text: `§ READOUT` (left) + `⌄` chevron span `.arc-toggle-chevron` (right)
- Register: JetBrains Mono, 9px, uppercase, letter-spacing 0.28em, ink-soft
- Top border: 1px dashed `var(--ink-dashed)` (dashed seam — instrument language)
- Tap target: `min-height: 44px`, full width
- Hover / focus: color → `var(--accent-orange)`
- Focus-visible: 1px dashed orange outline, offset -2px
- Chevron `.arc-toggle-chevron`: rotates 180° on `[aria-expanded="true"]`
  via CSS transform (220ms cubic-bezier)
- Desktop (>600px): `display:none` (base rule, outside any media query)

---

## layout

```
≤600px stack (flex-column, below globe + dock):

  ┌────────────────────────────────┐
  │  .atlas-current                │  ← ALWAYS VISIBLE
  │  CURRENT STRATUM / status      │
  ├────────────────────────────────┤
  │  .atlas-netra-voice            │  ← ALWAYS VISIBLE
  │  NETRA · ambient narration     │
  ├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
  │  .atlas-readout-toggle         │  ← TAP TO EXPAND (hidden >600px)
  │  § READOUT              ⌄      │    44px tap target
  ├────────────────────────────────┤
  │  [readout-collapsed on .atlas-frame = hidden below]
  │
  │  aside.atlas-readout           │  ← display:none when collapsed
  │    § STRATUM READOUT head      │
  │    readout rows (is-trio×2)    │
  │    .atlas-flow (4 steps)       │
  │                                │
  │  .atlas-foot-row (counts)      │  ← display:none when collapsed
  │    NeX·FIELD / Ne0N·POLE / ... │
  └────────────────────────────────┘
```

Toggle button insertion point: **immediately BEFORE `aside.atlas-readout`**
in the JSX, inside `.atlas-content`. On ≤600px the mobile reflow places
`.atlas-content` as a flex column; the toggle renders after `.atlas-netra-voice`
and before the readout aside. This is the correct reading order: ambient soul
line → expander control → opt-in telemetry.

Desktop (>600px): `.atlas-readout-toggle` is `display:none`. The
`readout-collapsed` class has no CSS effect outside the ≤600px block.
Everything renders as today in the three-column grid.

---

## tokens used

| role | token |
|---|---|
| toggle text default | `var(--ink-soft)` |
| toggle text hover/focus | `var(--accent-orange)` |
| toggle border seam | `1px dashed var(--ink-dashed)` |
| focus ring | `1px dashed var(--accent-orange)` |
| font | `var(--font-mono)` |
| size | 9px, tracking 0.28em |

No new tokens. All instrument register values reuse existing system tokens.

---

## typography

Toggle button: JetBrains Mono (`var(--font-mono)`), 9px, uppercase,
letter-spacing 0.28em. Mirrors `.t-meta` register exactly. Chevron
`.arc-toggle-chevron` is 11px mono glyph (decorative role; `aria-hidden="true"`
on the span).

---

## motion

- Chevron rotation: 220ms `cubic-bezier(0.4, 0, 0.2, 1)` on `transform`
- Collapse/expand: `display:none` — instant, no transition. Clean and
  reduced-motion-safe by default.
- Reduced-motion: no special case needed. `display:none` has no duration.

---

## states

| state | toggle button | collapsed elements |
|---|---|---|
| default ≤600 (closed) | ink-soft label, ⌄ chevron upright | `.atlas-readout` + `.atlas-foot-row` → `display:none` |
| hover | accent-orange text | — |
| focus-visible | accent-orange text + 1px dashed orange ring | — |
| open ≤600 | ink-soft label, ⌃ chevron rotated 180° | both elements visible (class absent from `.atlas-frame`) |
| desktop (>600) | `display:none` (never rendered) | `readout-collapsed` class has no CSS effect |

---

## breakpoints

| breakpoint | behavior |
|---|---|
| >600px | toggle hidden; `readout-collapsed` class has no CSS effect; desktop pixel-identical |
| ≤600px | toggle visible; `.atlas-readout` + `.atlas-foot-row` hidden when class present; shown when absent |

---

## class-name + markup contract for Sirius

### classes

| class | owner | role |
|---|---|---|
| `.atlas-readout-toggle` | Sirius (button element) | Expander tap control |
| `.arc-toggle-chevron` | Sirius (span inside toggle) | Chevron glyph (⌄/⌃) |
| `readout-collapsed` | Sirius (state on `.atlas-frame`) | Ancestor collapse class |

### state management in WorldlineGlobe.tsx

```jsx
const [readoutOpen, setReadoutOpen] = useState(false);

// On .atlas-frame:
<div className={`atlas-frame${!readoutOpen ? ' readout-collapsed' : ''}`}>
```

### toggle button placement

Place the `<button className="atlas-readout-toggle">` **immediately BEFORE
`<aside className="atlas-readout">`** inside `.atlas-content`. No wrapper div.
No DOM restructure.

### full markup pattern

```jsx
{/* .atlas-frame carries readout-collapsed when closed */}
<div className={`atlas-frame${!readoutOpen ? ' readout-collapsed' : ''}`}>

  {/* ...globe, dock... */}

  <div className="atlas-content">

    {/* ALWAYS VISIBLE — current stratum card */}
    <div className="atlas-current">...</div>

    {/* ALWAYS VISIBLE — NETRA ambient voice */}
    <div className="atlas-netra-voice">...</div>

    {/* MOBILE EXPANDER — hidden >600px via CSS base rule */}
    <button
      className="atlas-readout-toggle"
      aria-expanded={readoutOpen}
      onClick={() => setReadoutOpen(o => !o)}
    >
      <span>§ READOUT</span>
      <span className="arc-toggle-chevron" aria-hidden="true">⌄</span>
    </button>

    {/* aside.atlas-readout — hidden by .atlas-frame.readout-collapsed ≤600px */}
    <aside className="atlas-readout">
      ...readout head, readout rows, atlas-flow...
    </aside>

  </div>{/* end .atlas-content */}

  {/* footer.atlas-foot — sibling of .atlas-content */}
  <footer className="atlas-foot">
    {/* .atlas-foot-row — hidden by .atlas-frame.readout-collapsed ≤600px */}
    <div className="atlas-foot-row">
      ...cell counts...
    </div>
    {/* .atlas-netra stays visible (not targeted by collapse rule) */}
    <div className="atlas-netra">
      ...NETRA console + .jump button...
    </div>
  </footer>

</div>{/* end .atlas-frame */}
```

### what stays OUTSIDE the collapse (always visible ≤600px)

- `.atlas-current` — always visible (not targeted by ancestor-class rule)
- `.atlas-netra-voice` — always visible (not targeted)
- `.atlas-readout-toggle` — the control itself

### what collapses (hidden when `readout-collapsed` present on `.atlas-frame`)

- `aside.atlas-readout` — readout head + rows + flow steps
- `.atlas-foot-row` — counts row in footer

### aria contract

- Toggle button: `aria-expanded={readoutOpen}` (React serializes to "true"/"false")
- Chevron span: `aria-hidden="true"` (decorative)
- `aria-controls` is optional — no wrapper id exists. Omit for simplicity,
  or add `id="atlas-readout"` to the aside and `aria-controls="atlas-readout"`
  to the button if desired.

### desktop NEXT NODE redundancy

The `.atlas-netra .jump` NEXT NODE button is inside `footer.atlas-foot` but
outside `.atlas-foot-row` — it stays visible even when collapsed. This is
correct: the desktop `.jump` remains accessible, and the mobile dock chip
provides the primary mobile jump action.

---

## accessibility

- Toggle button is a `<button>` element (not a div, not an anchor)
- `aria-expanded` on the toggle correctly reflects open/closed state
- Collapsed elements use `display:none` — they are removed from the
  accessibility tree when hidden. Screen readers do not traverse hidden content.
  This is intentional: the telemetry is opt-in for all users, including
  screen reader users.
- Keyboard: Tab → toggle button → Enter/Space → reveals content → Tab into it
- Min tap target: 44px height on the toggle button
- Focus ring: 1px dashed `var(--accent-orange)` on focus-visible
- Reduced-motion: `display:none` requires no duration; no motion concern.

---

## references

- `.nav-slim-menu` + `.nav-slim.is-open` — pattern origin for ancestor-class
  state toggle (same file, S3 block)
- `.atlas-mobile-dock` — register origin for the toggle visual language
  (mono font, dashed border, orange on active)
- `dashed-hairline` atom — toggle border seam register
- `type-roles` atom (t-meta) — toggle text register
- `docs/design/23-mobile-atlas-reflow.md` — the dock spec this builds on

---

## non-goals

- No animation on collapse/expand (display:none, instant)
- No scroll-into-view on open
- No persistence of open/close state across page navigation
- No change to the desktop three-column grid layout
- No change to the ≤880px tablet reflow
- No wrapper div around aside.atlas-readout + footer.atlas-foot
- Print stylesheet: defer
