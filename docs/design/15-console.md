# docs/design/15-console.md
# Console Authoring GUI · S5 · spec-for-next-wave

> author · Betelgeuse (α-VIS-04) · 2026-05-31
> vision source · VISION-2026-05-31-search-lineage-console.md §1.6
> status · SPEC · NOT FOR THIS WAVE — dispatch when S3 (worldline schema) ships
> produced at · genesis/orchestration-foundations

---

## intent

The console is Peat's **gardening instrument** — not a CMS, not a dashboard. It surfaces
the worldline graph as a surveyed map he can tend: add nodes, draw causal edges, relocate
entries in conceptual space. The instrument frame from the public site carries over intact.
A visitor landing here should feel the same paper-observatory register — because this is
still the observatory, seen from the inside.

The primary threat is SaaS drift: form-heavy panels, rounded modals, progress bars,
color-coded categories in bright hues. None of that. Every visual element in this surface
must cite an existing atom.

Dev-mode only. Production build strips the route entirely (conditional dynamic import
gated on `process.env.NODE_ENV === 'development'`).

---

## layout — two-pane instrument

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ● CONSOLE · WORLDLINE AUTHORING     [DEV]                          [ESC · EXIT] │
│  corner-reticle TL                                     corner-reticle BR (orange) │
├──────────────┬──────────────────────────────────────────────────────────────────┤
│              │                                                                    │
│  LEFT RAIL   │   CANVAS (react-flow)                                             │
│  (260px)     │   paper-canvas surface · dashed-hairline border                   │
│              │                                                                    │
│  ┌ FILTER ─┐ │   ◆ 003 ──────────────────────────────────── ◎ DSCF0001          │
│  │ ALL      │ │       (dashed Cormorant italic edge label)                        │
│  │ ARTICLE  │ │                                                                   │
│  │ PHOTO    │ │        ◎ DSCF0002 ─────── △ nebulosae-draft                      │
│  │ FICTION  │ │                                                                   │
│  └──────────┘ │   ○ repo-01                                                       │
│              │                                                                    │
│  ─────────── │   (nodes freely positioned; α watermark behind at 10% opacity)    │
│  ┌ ENTRIES ┐ │                                                                    │
│  │ 003 ◆   │ │                                                                    │
│  │ 002 ◆   │ │                                                                    │
│  │ DSCF001 │ │                                                                    │
│  │ DSCF002 │ │                                                                    │
│  │ nebu… △ │ │                                                                    │
│  └──────────┘ │                                                                    │
│              │                                                                    │
│  [ + NEW ]   │                                                                    │
│              │                                                                    │
├──────────────┴──────────────────────────────────────────────────────────────────┤
│  NETRA voice strip (when a node is selected — narrates entry identity)            │
│  ─────────────────────────────────────────────────────────────────────────────── │
│  [ ENTRY FORM — slides up from foot on node select or [ + NEW ] ]                │
└─────────────────────────────────────────────────────────────────────────────────┘
```

Grid: `[260px 1fr]` columns. Left rail fixed 260px, canvas fills remainder.
Canvas min-height: `calc(100vh - 120px)` (header strip + foot form stub).

---

## atoms used

Every visual primitive cites its gallery atom id. Re-derivation from prose is a
reject condition.

| atom id | role in this surface |
|---|---|
| `corner-reticle` | header strip TL + BR L-brackets (`.corner-marks`, default variant) |
| `paper-canvas` | canvas background — aged paper grain + scanlines via `.paper-canvas` |
| `dashed-hairline` | left-rail / canvas split border (1px dashed `--ink-dashed`); canvas outer frame (1px dashed `rgb(var(--ink-rgb) / 0.22)`) |
| `type-roles` | all labels — mono uppercase instrument, Cormorant italic edge labels, Special Elite for numeric entry ids |
| `netra-voice-strip` | foot narration strip on node selection — `.atlas-netra-voice` |
| `attractor-pill` | kind-filter row in left rail (ALL / ARTICLE / PHOTO / FICTION) — `.af-pill` default / hover / active states |
| `focus-button` | left-rail entry list rows — reuse `.atlas-strata-btn` pattern: glyph slot (kind glyph) + label-id (entry title truncated) + key slot (file id) |
| `alpha-watermark` | italic α behind the canvas at `rgba(212, 96, 42, 0.10)` — `.atlas-alpha-mark` |
| `archive-node` | article nodes on canvas (CSS representation only — react-flow custom node renders the glyph inline) |
| `fiction-node` | fiction nodes on canvas (CSS hollow ring) |
| `photo-node` | photo nodes on canvas (orange-stroked square — reserved atom now first active use) |
| `hud-corner-readout` | canvas footer: node count + edge count readout in BL corner of the canvas frame |

**Not used:** `globe`, `netra-console`, `divergence-card`, `axis-label`, `paper-mount`.
Those atoms belong to the public survey surfaces, not the authoring instrument.

---

## node glyphs (kind taxonomy)

Per VISION §1.6 — fixed Unicode glyphs, never rotated icons or SVG embeds.

| kind | glyph | colour | shape |
|---|---|---|---|
| article | ◆ | `var(--ink-primary)` | solid diamond |
| photo | ◎ | `var(--accent-orange)` | circled circle (target) |
| fiction | △ | `var(--ink-primary)` | open triangle |
| repo (future) | ○ | `var(--ink-faint)` | hollow circle |

Glyph rendered as text node inside a react-flow custom node. Font: `var(--font-mono)`.
Size: 14px. Node card: `var(--paper-warm)` background, `1px solid var(--ink-hairline)`
border, 8px padding. No rounded corners. No drop-shadow. Micro corner reticles (8×8px
`--accent-orange`, atom: `corner-reticle` micro variant) on hover and when selected.

Node dimensions: `min-width: 140px`, `max-width: 200px`.

Label below glyph: entry file id in Special Elite 9px (atom: `type-roles` value
variant), then title in mono 9px 0.1em truncated to 1 line below it.

---

## edge style (worldline links)

An edge = a `worldline_links` relationship between two entries (schema: VISION §2.1).

```
source ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ target
         italic Cormorant label (optional)
```

CSS for the edge SVG `<path>`:
- `stroke: var(--ink-dashed)` — 25% ink (dashed-hairline atom)
- `stroke-dasharray: 4 6`
- `stroke-width: 1`
- `fill: none`

Edge label (when `label` is present in `worldline_links`):
- Cormorant Garamond italic 11px — atom: `type-roles` voice variant
- `color: var(--ink-soft)`
- Rendered as react-flow EdgeLabel, paper-base background patch behind the text

Arrow tip: none. Directionality read from source → target by label placement, not by
arrowhead. The hairline is enough.

---

## canvas interactions

All interactions per VISION §1.6 tangle ergonomics.

**Drag-to-position**
- Nodes are freely draggable. On drag-end, write new `{x, y}` to `.console/positions.json`
  (key: `${kind}/${slug}`). Does not touch MDX frontmatter.

**Auto-arrange**
- Button in canvas HUD BL: `[ ⟳ ARRANGE ]` — calls dagre/elk layout, animates nodes
  to new positions over 400ms `ease-in-out`. Writes result to `.console/positions.json`.
  Icon: `⟳` Unicode U+27F3 (JetBrains Mono).

**Hover-highlight 1-hop**
- On node hover: the hovered node and its direct edges + adjacent nodes stay at `opacity: 1`.
  All other nodes dim to `opacity: 0.25` over 150ms.
  Adjacent nodes adopt the `archive-node` hover state (soft accent-orange-soft ring, CSS only).
  Edges to non-adjacent nodes dim to `opacity: 0.15`.

**Filter by kind**
- LEFT RAIL kind-filter (`.af-pill` row). When a kind is active, non-matching nodes dim to
  `opacity: 0.2` on canvas. Matching nodes remain full. Filter and hover interact:
  hover-highlight applies within the visible set only.

**Search-to-fly (locate and fly)**
- Left rail search input: `[ ⌕ search... ]` — plain text, mono 10px, `--ink-soft`
  placeholder. As query updates, matching nodes border shifts to `1px solid var(--accent-orange)`,
  non-matching nodes dim to `opacity: 0.15`. Canvas pans to center the first match (react-flow
  `setCenter()`, 350ms `ease-in-out`). `⌕` is U+2315.

**Drag-to-link**
- React-flow built-in connection mode. Drag from a node's edge handle (a 6px×6px
  `var(--ink-faint)` square, visible only on hover) toward another node to create a
  `worldline_links` entry. On drop, a form appears in the foot asking for an optional
  Cormorant italic label. Confirm writes to MDX frontmatter via server action.

---

## entry CRUD form

Slides up from the canvas foot (or occupies the left rail below the entry list when
a node is selected from the list). Not a modal — stays in the same instrument frame.

Trigger states:
- **New entry**: `[ + NEW ]` button in left rail foot → blank form
- **Edit entry**: click a node on canvas (or list row) → form pre-filled

Form layout:

```
  KIND   [ ARTICLE ▾ ]     FILE ID   [ 003          ]
  TITLE  [ ...                                       ]
  DATE   [ YYYY.MM.DD ]   DOMAIN   [ method         ]
  TAGS   [ ...                                       ]
  ─────────────────────────────────────────────────────
  SUMMARY  (Cormorant italic textarea, 4 rows)
  ─────────────────────────────────────────────────────
  [ SAVE DRAFT ]                           [ COMMIT ]
```

Form label style: `t-meta` class — mono 9px uppercase 0.3em `--ink-soft`.
Input style: mono 11px, `--ink-primary`, border `1px solid var(--ink-hairline)`,
background `var(--paper-base)`, padding 6px 8px. No border-radius.
SUMMARY textarea: Cormorant Garamond italic 13px (voice register — atom: `type-roles`
voice variant) for this field only, to reflect that summary is Peat's voice.
SELECT dropdowns: same border + background; no custom arrow icon (browser default or
`▾` Special Elite appended).

SAVE DRAFT writes to `.console/drafts/<slug>.mdx.draft` (gitignored).
COMMIT writes to the live MDX file path, triggers velite rebuild.

---

## tokens used

| role | token |
|---|---|
| page surface | `var(--paper-base)` |
| canvas surface | `var(--paper-base)` (paper-canvas atom) |
| left rail surface | `var(--paper-warm)` |
| node card surface | `var(--paper-warm)` |
| body text | `var(--ink-primary)` |
| label / meta | `var(--ink-soft)` |
| tertiary / hint | `var(--ink-faint)` |
| hairline rule (solid) | `var(--ink-hairline)` |
| dashed separators | `var(--ink-dashed)` |
| active / selected | `var(--accent-orange)` |
| active soft halo | `var(--accent-orange-soft)` |
| NETRA accent | `var(--netra)` |
| canvas frame border | `1px dashed rgb(var(--ink-rgb) / 0.22)` |

No raw hex values outside this list. No new tokens in this wave.

---

## typography

| element | family | size | weight | transform | tracking |
|---|---|---|---|---|---|
| CONSOLE header | `var(--font-mono)` | 9px | 400 | uppercase | 0.3em |
| left rail filter labels | `var(--font-mono)` | 10px | 400 | uppercase | 0.15em |
| entry list rows | `var(--font-mono)` | 9px | 400 | uppercase | 0.1em |
| node card title | `var(--font-mono)` | 9px | 400 | none | 0.05em |
| node card file id | `var(--font-type)` | 9px | 400 | none | 0.04em |
| edge label | `var(--font-display)` italic | 11px | 400 | none | 0.005em |
| form labels | `var(--font-mono)` | 9px | 400 | uppercase | 0.3em |
| form inputs | `var(--font-mono)` | 11px | 400 | none | 0.01em |
| summary textarea | `var(--font-display)` italic | 13px | 400 | none | 0.005em |
| HUD readout | `var(--font-mono)` | 7px | 400 | uppercase | 0.22em |

---

## motion

All motion communicates a state change. No loops. No decorative animation.

| interaction | timing | easing | what moves |
|---|---|---|---|
| node hover dim/undim | 150ms | ease | non-adjacent node opacity |
| kind filter apply | 150ms | ease | off-kind node opacity |
| search-to-fly pan | 350ms | ease-in-out | react-flow viewport |
| auto-arrange | 400ms | ease-in-out | all node positions |
| entry form slide-up | 300ms | cubic-bezier(0.0, 0, 0.2, 1) | form `translateY(100% → 0)` |
| entry form slide-down | 220ms | cubic-bezier(0.4, 0, 1, 1) | form `translateY(0 → 100%)` |
| node selected (micro reticle appear) | 120ms | ease-out | reticle opacity 0→1 |

`prefers-reduced-motion: reduce` → all transitions 0.001ms (inherited from global atom rule).

---

## states

**Canvas (empty)**
No nodes. Paper surface with alpha watermark. NETRA voice strip reads:
*"no entries in graph — add one below"* (Cormorant italic, ink-soft).

**Node default**
Node card at full opacity, no ring. Entry list row unlit.

**Node hover**
1-hop highlight. Micro reticle appears at card corners (8×8px, accent-orange). Adjacent
edges become `stroke: var(--ink-primary)` (full opacity). Label: accent-orange if edge
has a label.

**Node selected**
Same as hover + form slides up with pre-filled data. NETRA voice strip updates.

**Node connecting (drag-link in progress)**
A faint dashed ghost edge follows the cursor. Target node grows a 4px accent-orange-soft
halo on proximity (within react-flow's snap distance).

**Edge hover**
Label becomes `var(--ink-primary)` (from `--ink-soft`). Edge stroke becomes
`var(--ink-dashed)` at full opacity. 100ms transition.

**Form: unsaved changes**
`[ SAVE DRAFT ]` border shifts to `var(--accent-orange)`. `[ COMMIT ]` remains neutral
until explicitly clicked.

**Form: saving**
Both buttons muted (`opacity: 0.5`, `pointer-events: none`). No spinner — wait is
expected to be < 300ms for local filesystem writes.

**Dev gate failure**
If console route loads in production (`NODE_ENV !== 'development'`): render nothing —
a blank paper-base page with a single centered mono label: `INSTRUMENT OFFLINE · DEV MODE REQUIRED`.
No redirect, no 404.

---

## breakpoints

| viewport | behavior |
|---|---|
| ≥881px (desktop) | two-pane as drawn; entry form in foot strip |
| ≤880px | left rail collapses to a 40px icon-only strip (kind glyph only); canvas fills; tapping the icon strip opens a drawer over the canvas |
| ≤600px | console is **intentionally unsupported** — show `INSTRUMENT OFFLINE · NARROW VIEWPORT` in center. Peat tends from desktop. |

Touch targets ≥44px for all interactive elements on the 880px breakpoint.

---

## accessibility

- `<main role="application" aria-label="Worldline Console">` wraps the entire surface.
- Canvas region: `<div role="region" aria-label="Worldline graph editor">`.
- Left rail filter: `<div role="group" aria-label="Filter by kind">`.
- Each filter pill: `role="radio"` within a `role="radiogroup"`. `aria-checked` reflects active.
- Entry list: `<ul>` with `role="listbox"`; each row `role="option"`, `aria-selected`.
- Focus order: header ESC → filter row → search → entry list → canvas (tab stop on
  canvas; arrows move between nodes; Enter selects).
- Each canvas node: `role="button"`, `aria-label="{kind} {fileNum}: {title}"`,
  keyboard focusable (`tabindex="0"`). Arrow keys pan the canvas (10px step per press).
- Edge drag-link: also accessible via keyboard — press `e` on a focused source node to
  enter connection mode, Tab to cycle to target node, Enter to commit.
- NETRA voice strip: `aria-live="polite"` — updates on node selection without stealing focus.
- DEV gate message: `role="alert"` centered, `aria-live="assertive"`.
- Reduced motion respected (global atom rule covers all transitions).
- Keyboard: `ESC` closes form / exits canvas focus to left rail. `Cmd+S` triggers SAVE DRAFT.

---

## references (which existing patterns establish precedent)

- `WorldlineGlobe.tsx` stratum sidebar — establishes the `.atlas-strata-btn` row pattern
  reused in the left rail entry list (focus-button atom).
- `AttractorFields.tsx` — establishes the `.af-pill` kind-filter row pattern.
- `components/WorldlineGlobe.tsx` NETRA voice strip (line 1856) — establishes the foot
  narration strip pattern (`.atlas-netra-voice`, netra-voice-strip atom).
- `docs/design/40-search-overlay.md §filter row` — establishes ALL / ARTICLE / PHOTO /
  FICTION filter row vocabulary.
- `docs/design/10-photo-entry.md §form controls` — establishes bare input style (no
  border-radius, mono labels, paper-base background).

---

## non-goals (v1)

- No prose MDX editor (Peat uses vim/vscode — console provides metadata + link graph only).
- No NETRA-assisted authoring in v1 (Arcturus extends later).
- No publishing workflow or auto-deploy trigger.
- No history / undo beyond filesystem git.
- No multi-user / auth in v1 (local-only; auth-protect later if needed).
- No dark mode variant (the single palette is the instrument; it does not invert).
- No mobile support (≤600px is intentionally offline).
- No drag-and-drop reordering of the left rail list (list is alphabetical/chronological, not sortable).

---

## new atom needed?

**Candidate: `kind-node-card`** — the react-flow custom node card (kind glyph + file id +
title + micro reticle on hover/select). This is a new visual primitive not covered by the
existing 17 atoms. It composes FROM existing atoms (`corner-reticle` micro, `type-roles`,
`paper-canvas` surface, `dashed-hairline` border) but the compound — a draggable card
with a kind glyph and two text registers — has no gallery entry. A serial catalogue step
should add it before Sirius implements. Until catalogued, Sirius implements by composing
the cited atoms without inventing new tokens.

No other new atoms needed. All other primitives map cleanly to the existing 17.

---

*spec-for-next-wave · Betelgeuse (α-VIS-04) · 2026-05-31*
*dispatch condition: S3 (worldline schema) complete + Polaris signs the next-wave plan*
