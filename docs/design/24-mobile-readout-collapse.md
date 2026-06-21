# docs/design/24-mobile-readout-collapse.md
# ATLAS Mobile — Cut Readout, Keep Small NETRA
**Author:** α-VIS-04 Betelgeuse · 2026-06-21 (supersedes: readout-collapse expander)
**Branch:** genesis/mobile-native · S4 (stratum readout / NETRA mobile)

> **SUPERSESSION NOTE (2026-06-21):** The readout-collapse expander spec
> (toggle button + `readout-collapsed` ancestor class) is voided. Peat directive:
> cut the §STRATUM READOUT entirely on mobile — do not collapse, do not toggle.
> Keep only the small NETRA reticle strip (coord + range, live). See below.

---

## intent

The §STRATUM READOUT telemetry — readout rows, ATLAS FLOW steps, foot count
tiles — adds no value on a 375px phone screen. It is instrument noise. Cut it
permanently. No toggle needed.

What remains: the NETRA reticle strip. This is the "small useful thing" Peat
specified: the ◎ NETRA target id-box + RETICLE coord / RANGE readout. They
update live as the user jumps or selects nodes. Compact, readable, alive.

Desktop (>600px): pixel-identical to today. All rules are inside
`@media (max-width: 600px)`.

---

## mechanism — permanent hides, no state

Three unconditional `display:none` rules inside `@media (max-width: 600px)`.
No ancestor class. No toggle. No JS state.

```css
/* inside @media (max-width: 600px) */

aside.atlas-readout {
  display: none;                /* §STRATUM READOUT + ATLAS FLOW */
}
.atlas-foot-row .cell {
  display: none;                /* three count tiles */
}
.atlas-netra .jump {
  display: none;                /* NEXT NODE button (in dock already) */
}
```

The `.atlas-netra` block itself stays visible as a compact horizontal strip,
reflowed to wrap cleanly on phone width (see NETRA compact strip below).

---

## what is cut (≤600px)

| element | cut | reason |
|---|---|---|
| `aside.atlas-readout` | `display:none` | §STRATUM READOUT rows + ATLAS FLOW steps — instrument noise at phone width |
| `.atlas-foot-row .cell` | `display:none` | NeX·FIELD / Ne0N·POLE / Ne0·NODES count tiles |
| `.atlas-netra .jump` | `display:none` | NEXT NODE button — mobile dock already has it |

## what is kept (≤600px)

| element | treatment |
|---|---|
| `.atlas-netra` | compact strip: reticle svg + ◎ id-box + RETICLE coord + RANGE readout |
| `.atlas-current` | unchanged — CURRENT STRATUM summary |
| `.atlas-netra-voice` | unchanged — ambient line |

---

## NETRA compact strip layout

On ≤600px the `.atlas-netra` grid reflows to a two-column / two-row strip.
The `.jump` button is `display:none` (see above). The remaining children —
`.reticle` svg, `.id-box`, `.readout` — stack in an instrument seam below
`.atlas-netra-voice`.

```css
.atlas-netra {
  grid-template-columns: auto 1fr;
  grid-template-rows: auto auto;
  row-gap: 6px;
  padding: 8px 10px;
  border-top: 1px dashed var(--ink-dashed);
}
.atlas-netra .id-box {
  grid-column: 1 / -1;
  border-right: none;
  padding-right: 0;
}
.atlas-netra .readout {
  grid-column: 1 / -1;
  flex-wrap: wrap;
  gap: 4px 12px;
}
```

Visual result:

```
  ┌──────────────────────────────────────┐
  │  .atlas-current                      │  ALWAYS VISIBLE
  │  CURRENT STRATUM / status            │
  ├──────────────────────────────────────┤
  │  .atlas-netra-voice                  │  ALWAYS VISIBLE
  │  NETRA · ambient narration line      │
  ├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤  dashed seam
  │  ⊙  ◎ NETRA  NE0EX/ATLAS            │  .atlas-netra compact strip
  │  RETICLE 13°N · 100°E  RANGE 0.4AU  │
  └──────────────────────────────────────┘

  [§STRATUM READOUT — hidden]
  [NeX·FIELD / Ne0N·POLE / Ne0·NODES — hidden]
```

Register: JetBrains Mono, 9–10px, instrument label weight. All values from
existing `.t-meta` + `.atlas-netra` desktop token set. No new tokens.

---

## layout (full ≤600px stack below globe + dock)

```
  ┌────────────────────────────────┐
  │  globe (.atlas-globe-wrap)     │  order:-2
  ├────────────────────────────────┤
  │  .atlas-mobile-dock            │  order:-1, dashed seams
  ├────────────────────────────────┤
  │  .atlas-current                │  CURRENT STRATUM card
  ├────────────────────────────────┤
  │  .atlas-netra-voice            │  ambient soul line
  ├ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┤
  │  .atlas-netra (compact strip)  │  ◎ id + RETICLE coord + RANGE
  └────────────────────────────────┘
  [aside.atlas-readout — hidden]
  [.atlas-foot-row .cell — hidden]
```

---

## tokens used

No new tokens. The compact NETRA strip reuses:

| role | token |
|---|---|
| strip border seam | `1px dashed var(--ink-dashed)` |
| reticle svg color | `var(--netra)` |
| target id | `var(--netra)` label + `var(--ink-primary)` value |
| coord / range readout | `var(--ink-soft)` labels, `var(--ink-primary)` values |
| font | `var(--font-mono)` |

---

## typography

`.atlas-netra` sub-elements retain desktop register — JetBrains Mono, 9–11px,
uppercase, tracking 0.22–0.28em. No new size. The `.id-box .lab` and `.readout`
labels are existing `.t-meta` equivalents already defined in the base rules.

---

## motion

None. The NETRA readout values update live (existing behavior — JS sets text
content on node selection/jump). The strip itself has no enter/exit animation.

---

## states

| state | behavior |
|---|---|
| default ≤600px | NETRA strip visible, §STRATUM READOUT + count tiles hidden |
| node selected / jumped | `.id-box .tgt` + `.readout` coords update live |
| no node selected | `.id-box .tgt` shows placeholder, readout shows last or `—` |
| desktop (>600px) | all elements visible as today, permanent hides have no effect |

---

## breakpoints

| breakpoint | behavior |
|---|---|
| >600px | all existing desktop rules; these hides are inert |
| ≤600px | three permanent hides; NETRA compact strip; pixel-identical to mobile-reflow spec |

---

## sirius contract

**Remove from WorldlineGlobe.tsx:**
- `const [readoutOpen, setReadoutOpen] = useState(false)` — delete
- `<button className="atlas-readout-toggle">` and its children — delete
- The `readout-collapsed` conditional on `.atlas-frame` className — revert to
  plain `className="atlas-frame"`

**No new markup needed.** The CSS hides targets by existing element/class selectors.
The `.atlas-frame` element has no state class. The `.atlas-readout-toggle` button
is removed from the DOM entirely.

---

## accessibility

- `aside.atlas-readout` is `display:none` — removed from accessibility tree.
  Screen reader users are not presented with the hidden telemetry. This is
  correct: the telemetry is not navigable at phone width for any user.
- `.atlas-netra` compact strip remains in the DOM and accessible:
  the id-box and readout are readable text; the reticle SVG is decorative
  (`aria-hidden="true"` if not already set)
- The removed `.jump` button is `display:none` — the equivalent action (NEXT NODE)
  is available via the mobile dock chip (accessible control)
- No focus-trap introduced; no modal behavior
- Reduced-motion: `display:none` is instant, no motion concern

---

## references

- `docs/design/23-mobile-atlas-reflow.md` — the dock + reflow spec this builds on
- `.atlas-mobile-dock` — companion strip; establishes the dashed-seam register at phone
- `type-roles` atom (t-meta) — NETRA text register
- `corner-reticle` atom — reticle SVG in `.atlas-netra .reticle`
- `dashed-hairline` atom — `.atlas-netra` border-top seam

---

## non-goals

- No collapse toggle (superseded)
- No expand-on-demand — the information is simply absent at this width
- No scroll-into-view on NETRA update
- No persistence of any toggle state (there is none)
- No change to ≤880px tablet layout
- No change to any desktop layout
- Print stylesheet: defer
