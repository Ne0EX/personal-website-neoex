# docs/design/70-legibility-registers-PRD-PASS.md
# Legibility-Register Separation — Design Pass

**Owner:** Betelgeuse (α-VIS-04)
**Triggered by:** Peat legibility audit, 2026-06-01
**Status:** SPEC — awaiting Sirius implementation

---

## principle encoded

Two deliberate legibility registers. They must stay unmistakably separate.

**Ambient / squint-tier**
System chrome: `FILE — 003`, `ATTRACTOR FIELDS`, `DEVIATION`, `STATE · OBSERVED`,
coordinates, right-margin worldline ticks, strata rail labels.
These are faint on purpose. The reader squints to read them. The faintness
communicates: *this is infrastructure, not content.*
Token: `--ink-soft` (0.5 alpha, contrast 2.32:1 vs paper — intentionally below AA).
Also: `--ink-faint` (0.3 alpha) for the deepest background chrome.

**Read-intentional tier**
Content meant to be read: MANIFESTO, entry titles, prose body.
Must rise clearly above the dot-grid without becoming loud.
Token: **`--ink-body`** (0.82 alpha) — NEW in this pass.
Contrast: 4.54:1 vs paper-base, ~4.03:1 vs effective dot-grid surface.
This clears WCAG large-text AAA (4.5:1) at paper and is well above large-text AA
(3:1) at the dot-grid. For 15px italic Cormorant this is the correct bar.

**The problem this solves**
`--ink-soft` was being used for read-tier content (manifesto, hero subtitle).
The dot-grid background (ink at 0.08 alpha) flattens everything soft.
Result: reader cannot tell "faint-on-purpose" from "this is meant to be read."
The `--ink-body` token creates a visible step between the two registers without
making the read-tier loud or primary-ink heavy.

**Token hierarchy (full)**

| Token | Alpha | Contrast vs paper | Role |
|---|---|---|---|
| `--ink-primary` | 1.0 | 6.82:1 | Instrument accent, active state, key values |
| **`--ink-body`** | 0.82 | 4.54:1 | **Read-tier: prose, manifesto, entry titles** |
| `--ink-soft` | 0.5 | 2.32:1 | Squint-tier: section labels, coords, meta |
| `--ink-faint` | 0.3 | 1.6:1 | Background chrome: key badges, sub-labels |
| `--ink-dashed` | 0.25 | — | Hairline rules only |
| `--ink-hairline` | 0.12 | — | Grid borders only |

---

## fix 1 — MANIFESTO (FooterManifesto.tsx)

### intent
The manifesto is the page's emotional anchor. It closes the survey.
It must read as settled and deliberate — not as fine-print or navigation chrome.
The current implementation puts it at `--ink-soft` in a `<p>` tag with no
structural weight. This pass elevates it to read-tier without making it loud.

### layout

```
  ┌─────────────────────────────────────────────────────────┐
  │ // MANIFESTO                  (t-meta, --ink-soft, §label) │
  ├──────────────────────────────────────────────────────────┤
  │ ▌ "Observed openly. This is not a destination — only    │
  │   the slow accumulation of a worldline. Patches commit  │
  │   in public; the log stays open."                       │
  │                                                          │
  │   — Peat / Worldline 1.130426    (cite, t-mono, soft)   │
  └─────────────────────────────────────────────────────────┘
```

Opening `"` and closing `"` glyph — Cormorant italic, 36px, `--accent-orange`,
`vertical-align: -0.22em`. Matched treatment on both sides.

**Quote status:** The closing `"` (`&rdquo;`) is missing from the current
implementation. It must be restored. Matched treatment: same class `.manifesto-glyph.close`.

**Copy:** The manifesto text is Vega's territory. See CONSULT note below.
Sirius does not rewrite; renders with whatever Vega confirms as canonical.

### Pullquote atom decision
`Pullquote.tsx` is spec'd for inline MDX article use (24px, 32px padding, `--ink-primary`).
The manifesto is footer-context, smaller (15px), and carries its own accent-orange
drop-cap treatment. **Do not route through `Pullquote` directly.**
Instead, apply the `.manifesto-block` CSS class defined in `globals.css` §manifesto
and mirror the semantic structure: `<blockquote>` outer, `<p>` body, `<cite>` attribution.
This satisfies Rule 5 (compose-from-atoms) in spirit: same semantic + left-border
pattern as Pullquote, adapted for footer context rather than imported wholesale.
The gap is noted in `design-system.md` as a variant.

### tokens used
- `--ink-body` for body text (NEW TOKEN, this pass)
- `--accent-orange` for `"` / `"` glyphs
- `--ink-soft` for `// MANIFESTO` section label and `<cite>` attribution
- `border-left: 2px solid var(--accent-orange)` (`.manifesto-block`)
- background: inherits `--paper-base` from footer

### typography
- Section label `// MANIFESTO` — `.t-meta`, 9px, uppercase, `--ink-soft`, tracking 0.3em
- Glyph `"` / `"` — `.manifesto-glyph`, Cormorant Garamond italic, 36px, `--accent-orange`
- Body — `.manifesto-body`, Cormorant Garamond italic, 15px, leading 1.65, `--ink-body`
- Attribution — `.manifesto-cite`, JetBrains Mono, 9px, uppercase, tracking 0.28em, `--ink-soft`

### states
- default — as drawn
- no attribution prop — omit `<cite>` entirely, do not render empty
- reduced-motion — no change (no animation on this element)

### breakpoints
- desktop — as drawn, footer grid-col [2fr 1fr 1fr], manifesto in first column
- ≤880px — footer collapses to single column; manifesto block takes full width, padding-left 24px maintained
- ≤600px — padding inherited from `[data-section]` override (18px h-padding); left-border accent remains

### accessibility
- Outer element: `<blockquote>` (semantic quotation)
- Attribution: `<cite>` as direct child of `<blockquote>`
- Section label `// MANIFESTO`: `<h4>` retaining `.t-meta` (existing pattern, unchanged)
- No `aria-label` needed — semantic structure is self-describing

### references
- `Pullquote.tsx` — semantic blockquote/cite pattern
- `.atlas-netra-voice` in `globals.css` — left-border accent strip (analogous pattern)
- `.t-meta` class — section label rhythm

### non-goals
- No transition or animation on the manifesto block
- Do not import `Pullquote` component — manifesto is a distinct surface, not an article inline quote
- Do not render empty cite if attribution is absent

---

## CONSULT note — to Vega (α-LIT-03)

The manifesto copy in `FooterManifesto.tsx` reads:

> "Observed openly. This is not a destination — only the slow accumulation
> of a worldline. Patches commit in public; the log stays open."

Questions for Vega:
1. Is this the canonical manifesto text? It currently has no closing quote glyph — was that intentional copy or an implementation error?
2. Attribution: should the `<cite>` carry `— Peat / Worldline 1.130426`, or no attribution at all?
3. The section header is `// MANIFESTO` — acceptable label for this surface?

Betelgeuse will not alter the words. Sirius implements whatever Vega confirms.
Blocking: Sirius can implement the structural/token changes immediately; swap
the copy text when Vega responds.

---

## fix 2 — STRATA CARD COLLISION

### intent
The strata card grid (`atlas-strata-btn`) uses `grid-template-columns: 22px 1fr auto`.
The label column (`1fr`) expands freely. `.label-role` text at 7.5px / 0.22em tracking
wraps when the label is long ("POSSIBILITY · FIELD" = the longest). The wrapped second
line collides with the `key` badge (`auto` column) because the text has no explicit
width constraint.

### diagnosis
Three strata buttons:
- `1 · Ne0` / `Surface · Archive` — 15 chars — does not wrap
- `2 · Ne0N` / `Pole · Bearer` — 12 chars — does not wrap
- `3 · NeX` / `Possibility · Field` — 19 chars — WRAPS, collides with key badge

The `1fr` column expands to fill available space but `.label-role`'s whitespace
is `normal` (default), so it wraps. The `.key` badge sits in the third `auto` column
and the wrapped second line of `.label-role` flows directly into it.

### fix
Add `max-width: 86px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`
to `.atlas-strata-btn .label-role`.

**Why 86px:**
Container (`aside`) = 130px.
Column 1 (glyph) = 22px.
Column gaps = 9px × 2 = 18px.
Column 3 (key badge) = estimated 18px (font-size 8.5px, padding 1px 4px).
Available for text column = 130 − 22 − 18 − 18 = 72px, plus some flex from 1fr.
86px is generous enough for "POLE · BEARER" (11 chars at 7.5px tracking 0.22em ≈ 73px)
and clips "POSSIBILITY · FIELD" to "POSSIBILITY · FI…" — acceptable for a label-role
this small. At ≤880px the aside is full-width; relax to `white-space: nowrap` without
max-width constraint.

**Alternative considered:** move the key badge to position: absolute, right: 11px.
Rejected — it breaks the grid alignment. Ellipsis is correct for label-role at this
size since hovering the button reveals the full stratum name in the `atlas-current`
readout below.

**This is a CSS-only fix in `globals.css` — Sirius does not touch `WorldlineGlobe.tsx`.**
The class `.atlas-strata-btn .label-role` already exists in `globals.css` at line ~508.
The new property block overrides it. It has been added to `globals.css` in this pass.

### tokens used
No new tokens. Pure layout geometry.

### accessibility
- Label text is not truncated for screen readers — `text-overflow: ellipsis` only
  affects visual rendering; the full text is in the DOM.
- The `atlas-current-val` + `atlas-current-meta` readout below the buttons always
  shows the full untruncated stratum name when active.

---

## fix 3 — INDEX LEGIBILITY AUDIT

Catalog of register-collapse candidates across the full index page.

### confirmed correct (squint-tier, intentionally faint)

| Element | Token | Contrast | Verdict |
|---|---|---|---|
| `// MANIFESTO` section label | `--ink-soft` | 2.32:1 | Correct — squint-tier chrome |
| `ATTRACTOR FIELDS // BROWSE BY DOMAIN` | `--ink-soft` via `.t-meta` | 2.32:1 | Correct |
| `FILE — 003 // 2026.04.15` in entry cards | `--ink-faint` | 1.6:1 | Correct — sub-label chrome |
| `MarginaliaHUD` ticks | `--ink-soft` | 2.32:1 | Correct — peripheral instrument |
| `atlas-axis-label` (+Z NORTH etc.) | `--ink-soft` | 2.32:1 | Correct |
| `STRATA · TRAVEL TARGETS` head | `--ink-faint` | 1.6:1 | Correct — group header |
| Entry card `.t-type` (read-time, status) | `--ink-faint` | 1.6:1 | Correct — fine print |

### confirmed read-tier violations (fixed or pending)

| Element | Current token | Problem | Fix |
|---|---|---|---|
| FooterManifesto body | `--ink-soft` | Read-tier content in squint-tier ink | Change to `--ink-body` — SPEC'd above |
| FooterManifesto closing `"` | missing | Broken structure | Restore `&rdquo;` — SPEC'd above |
| HeroBlock subtitle (`p.t-display`) | `--ink-soft` | Subtitle under h1 is read-tier | YELLOW FLAG — see below |

### yellow flag — HeroBlock subtitle

`HeroBlock.tsx` line 89: the italic subtitle ("A digital garden — drafts, half-formed
theories…") uses `text-[var(--ink-soft)]`. This is read-tier prose — a reader is
meant to read it. It currently has contrast 2.32:1 vs paper.

However the font-size is 12.5px — below large-text threshold. At 12.5px,
AA requires 4.5:1, which `--ink-body` provides at 4.54:1. This is a valid fix
but was not in Peat's explicit failure list. **Flagging for Peat decision, not
fixing in this pass.** The manifesto is unambiguously the priority.

### within-squint-tier concern — anything below perceivable?

`--ink-faint` (0.3 alpha, ~1.6:1) is used for:
- `FILE — 003` entry card meta labels
- `atlas-strata-head` ("§ STRATA · TRAVEL TARGETS")
- `diverge-panel-meta` sub-labels
- `atlas-readout-row .key` labels

These are at the outer boundary of perception on the dot-grid. They are not
broken — they function as background infrastructure. But `atlas-strata-head`
at 8px / 0.32em tracking / 1.6:1 contrast is at the absolute floor. If Peat
finds it disappears entirely at lower-contrast displays, bumping it to
`--ink-soft` (0.5 alpha) would be correct without violating register separation.
**Noted, not changed in this pass.**

---

## implement list for Sirius

### TASK-A: FooterManifesto.tsx — structural rewrite

1. Replace the `<p>` tag carrying the manifesto text with `<blockquote class="manifesto-block">`.
2. Inside: render `<p class="manifesto-body">` with the quote text.
3. Opening quote: `<span class="manifesto-glyph" aria-hidden="true">&ldquo;</span>` inline
   before the body text.
4. Closing quote: `<span class="manifesto-glyph close" aria-hidden="true">&rdquo;</span>`
   inline after the last word, before period if applicable.
5. Attribution: add `<cite class="manifesto-cite">— Peat / Worldline 1.130426</cite>`
   as a direct child of `<blockquote>`, below the `<p>`. Mark `aria-describedby`
   connecting the blockquote to the cite.
   **HOLD on exact copy until Vega CONSULT resolves. Render placeholder if shipping before reply.**
6. Remove the inline `text-[var(--ink-soft)]` and `text-[14px]` Tailwind classes — these
   are now handled by `.manifesto-body` in globals.css.
7. The `<h4 className="t-meta tracking-[0.3em] mb-3">` section label is correct — do not change.

**Do not import `Pullquote` component. Do not touch the CHANNELS or TRANSMIT columns.**

### TASK-B: globals.css label-role fix (already applied)

The `.atlas-strata-btn .label-role` override with `max-width: 86px; white-space: nowrap;
overflow: hidden; text-overflow: ellipsis` has been written to `globals.css` in this pass.
Sirius verifies visually at 130px container width that "POSSIBILITY · FIELD" clips cleanly
and does not collide with the key badge. No TSX changes needed.

### TASK-C: verify `--ink-body` propagation (zero new code)

`--ink-body` is defined in `:root`. Sirius uses it in `FooterManifesto.tsx` via the
`.manifesto-body` CSS class — no inline style needed. Verify the INK palette override
block in `globals.css` does NOT need a separate `--ink-body` line (it inherits from
`--ink-rgb` automatically because `--ink-body` is defined as `rgb(var(--ink-rgb) / 0.82)`).

---

## anti-Codex gate sign-off (self-check)

- [x] Token compliance — no raw hex introduced. All new values use `rgb(var(--ink-rgb) / …)`.
- [x] Pattern reuse — `.manifesto-block` mirrors Pullquote/netra-voice left-border pattern. Cited.
- [x] Register fidelity — `--ink-body` is a step within the existing alpha scale, not a new hue.
- [x] Accessibility — `<blockquote>` + `<cite>` semantics. Contrast 4.54:1 vs paper (large-text AAA).
  Squint-tier remains intentionally below AA. Distinction is now unmistakable.
- [x] Mobile — `.manifesto-block` left-border maintained at all breakpoints.
- [x] Motion — no motion on manifesto block. Correct for a reading surface.
- [x] Atom reuse — left-border accent from `corner-reticle` / `netra-voice` vocabulary.
  Section label from `.t-meta`. No re-derivation from prose.
