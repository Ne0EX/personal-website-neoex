# docs/design/23-mobile-atlas-reflow.md
# ATLAS Mobile Reflow — ≤600px dock replacement

**Author:** α-VIS-04 Betelgeuse · 2026-06-21
**Ticket:** genesis/mobile-native · mobile dock S4

---

## intent

At phone width the ATLAS surface must preserve the instrument register — globe, stratum selection, NEXT NODE — while eliminating the desktop sidebar strata list which is unreadable at 375px. The dock is a compact chip row that mirrors the register of the desktop strata sidebar without reproducing its verbosity.

---

## reflow — ≤600px

Stack order (flex column, explicit `order` values):

```
order: -2  .atlas-globe-wrap      ← globe
order: -1  .atlas-mobile-dock     ← dock (under globe, before CURRENT card)
order:  0  .atlas-current         ← CURRENT card (default)
order:  0  readout aside          ← readout (default)
order:  0  .atlas-foot-row        ← foot (default)
```

`.atlas-content` switches from its desktop grid to `display:flex; flex-direction:column`.

---

## what is hidden ≤600px

```css
.atlas-strata-head,
.atlas-strata-list,
.atlas-divider { display: none; }
```

The verbose strata sidebar (heading label, three strata cards, divider) is replaced entirely by the dock chips. No information is lost — stratum name and glyph appear on each chip.

---

## dock — tokens used

| role | token |
|---|---|
| dock border rails | `rgb(var(--ink-rgb) / 0.22)` dashed |
| chip border default | `rgb(var(--ink-rgb) / 0.30)` dashed |
| chip border hover / active | `var(--accent-orange)` |
| chip text default | `var(--ink-soft)` |
| chip text active | `var(--accent-orange)` |
| jump button border + text | `var(--accent-orange)` solid |
| jump button hover fill | `var(--accent-orange)` bg, `var(--paper-base)` text |
| font | `var(--font-mono)` |
| chip size | 10px, tracking 0.08em |
| jump size | 10px, tracking 0.12em |

---

## typography

All dock text: JetBrains Mono (`var(--font-mono)`), 10px, uppercase, letter-spacing per token table above. Mirrors `.atlas-strata-btn` and `.atlas-netra .jump` register exactly — same mono font, same orange active state, same dashed-to-solid border transition.

---

## states

| state | chip | jump |
|---|---|---|
| default | dashed border ink/30, ink-soft text | solid orange border, orange text |
| hover | orange border, ink-primary text | orange bg fill, paper-base text |
| is-active | solid orange border, orange text | n/a |
| focus-visible | 1px dashed orange outline, offset 2px | same |

---

## motion

- Chip border-color + color: 140ms ease (matches `.atlas-strata-btn` transition timing)
- Jump bg + color: 140ms ease

No entrance animation — this is a navigation control, not a hero element.

---

## breakpoints

| breakpoint | behavior |
|---|---|
| >600px | `.atlas-mobile-dock { display: none }` — desktop is pixel-identical to pre-task state |
| ≤600px | `.atlas-mobile-dock { display: flex }` + column reflow + strata sidebar hidden |

---

## accessibility

- Dock root: `aria-label="STRATUM CONTROLS"`
- Chips: button elements, text content includes stratum number and name (`3 · NeX`)
- Jump: button element, text `⟶ NEXT NODE`
- Min tap target: 44px height enforced via `min-height: 44px` on both chip and jump
- Focus: `focus-visible` outline on both chip and jump
- Keyboard: tab order follows DOM order (chips left-to-right, then jump)

---

## references

- `.atlas-strata-btn` — register origin for chip visual language (mono font, dashed border, orange active)
- `.atlas-netra .jump` — register origin for jump button (orange solid border, fill-on-hover)
- `corner-reticle` atom — register context (instrument chrome vocabulary)
- `dashed-hairline` atom — dock border rails

---

## non-goals

- No animation on dock appearance (it is present in DOM at all widths, CSS show/hide only)
- No swipe gesture on chips — tap selection only
- No tooltip or expanded label on chip hover
- Desktop layout: untouched
