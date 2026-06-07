# docs/design/atlas-console-front-door.md
# Atlas Console — Front Door (Slice 2)

> author · Betelgeuse (α-VIS-04) · 2026-06-07
> base prototype · `/tmp/wl-design-extracted/atlas-console/project/console/` (6-round settled handoff)
> prior spec · `docs/design/15-console.md` (2026-05-31, scaffold only — prototype wins on conflicts)
> status · SPEC · ready for Sirius
> route · `app/console/page.tsx` (kills the `// TODO: console slice` placeholder)
> depends on · Slice 1 (`app/console/editor/page.tsx`, `components/console/ArticleEditor.tsx`)

---

## intent

The console is the observatory turned inward. Where the public site is
an exploration a visitor earns through search, the console is the same
instrument seen from the gardener's side of the glass: Peat surveys his
own worldline graph, adds nodes, draws causal edges, relocates entries
in conceptual space.

The register must not change. A visitor who accidentally routes to
`/console` should feel the same paper-observatory frame — because this
is still the observatory, tended rather than observed. SaaS drift
(rounded modals, progress indicators, color-coded categories in bright
hues, drop-shadow cards) is the primary reject condition.

**Soul discipline (worldline-soul):** the soul-gatekeeping principle (do
not splay the inner world open for visitors) does not apply here — Peat
is the gardener. "Don't splay" governs visitors earning depth; here the
graph is fully visible because Peat is the author. Soul-faithfulness on
this surface means the instrument register is maintained and
exploration-by-surveying (pan, search-to-fly, 1-hop highlight) drives
interaction — not a flat CMS list and not a clean SaaS graph.

---

## Rule-4 — design-unity declaration

**soul-baseline:** paper-observatory instrument; everything reads as
a surveyed register, never a product dashboard.

**connection-point:** extends the existing atlas atom vocabulary
(`atlas-strata-btn`, `af-pill`, `atlas-netra-voice`, `atlas-hud`,
`paper-canvas`, `atlas-alpha-mark`, `corner-marks`) and shares the
same instrument header register as `ArticleEditor.tsx` (Slice 1).

**continuity:** console (graph + metadata authoring) and editor (content
body) are one instrument over the same entry, connected by a round-trip
navigation contract — not two separate tools.

---

## layout — two-pane instrument

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  ● CONSOLE · WORLDLINE AUTHORING     [DEV]   ∇ neospirit // worldline 1.130426  │
│  corner-marks TL (orange)                                  corner-marks BR       │
├──────────────┬──────────────────────────────────────────────────────────────────┤
│ .console-rail│ .console-canvas-col (node-graph canvas)                          │
│ (260px)      │                                                                   │
│ ┌ FILTER ──┐ │  .canvas-frame (dashed border rgb(--ink-rgb / 0.22))             │
│ │ ALL       │ │  .canvas-viewport.paper-canvas                                  │
│ │ ARTICLE   │ │                                                                  │
│ │ PHOTO     │ │    α watermark (atlas-alpha-mark, 280px, 10% opacity)           │
│ │ FICTION   │ │    drifts with pan at 0.4× rate                                 │
│ └───────────┘ │                                                                  │
│ ─────────────│ │    kn-card ◆ 003                                                │
│ ⌕ search…    │ │    kn-card ◎ DSCF0001                                           │
│ ─────────────│ │         (dashed SVG edge, Cormorant italic label)              │
│ // ENTRIES   │ │    kn-card △ nebulosae                                          │
│   003 ◆ …   │ │                                                                  │
│   001 ◎ …   │ │  .atlas-hud (4 corners: TL/TR/BL/BR readouts)                  │
│   neb △ …   │ │  .canvas-hud-controls (BL: NODES · EDGES · ⟳ ARRANGE · ⊕ ORIGIN)│
│ ─────────────│ │                                                                  │
│ [ + NEW ]    │ │                                                                  │
│              │ │                                                                  │
├──────────────┴──────────────────────────────────────────────────────────────────┤
│ .console-foot: atlas-netra-voice strip (aria-live="polite")                     │
│ ─────────────────────────────────────────────────────────────────────────────── │
│ .entry-form (slides up, position:absolute bottom:0 over canvas col)             │
└─────────────────────────────────────────────────────────────────────────────────┘
```

Grid: `grid-template-columns: 260px minmax(0, 1fr)`. Left rail fixed 260px,
canvas fills remainder. Full `height: 100vh`, `overflow: hidden` — no scroll.

### Header strip

Height 54px. `grid-template-columns: 1fr auto 1fr`. Corner-marks (`.corner-marks`)
positioned with `inset: 9px` (tighter than default 16px).

- Left cluster: orange dot `ch-dot` (7px circle with accent-orange-soft halo) +
  `CONSOLE · WORLDLINE AUTHORING` (mono 9px, uppercase, 0.3em) + `[DEV]` badge
  (mono 7.5px, accent-orange, dashed border 1px rgba(212,96,42,0.4))
- Center: `∇ neospirit // worldline 1.130426` (Cormorant italic 13px, ink-soft)
  — atom: `type-roles` voice register
- Right: `[ ESC · EXIT ]` button (mono 9px, ink-soft, hover → accent-orange).
  In production: routes to `/` (public site). In the browser frame, `ESC` key
  deselects the current node / closes the form.

The `[DEV]` badge: dev-environment signal, NOT a hard render gate. The shipped
editor uses `robots: { index: false, follow: false }` + not-in-Nav. Keep that
contract — no `NODE_ENV` render-nothing gate.

### Left rail (.console-rail)

Fixed 260px. `paper-warm-surface`. Flex column with internal scroll on the entry
list only. Right border: `1px dashed var(--ink-dashed)`.

Three blocks separated by `.section-rule-dashed`:

1. **KIND FILTER** — `// FILTER · KIND` head (mono 8px, 0.32em, ink-faint).
   `.af-pill` kind buttons (ALL / ARTICLE / PHOTO / FICTION).
   Atom: `attractor-pill` (`.af-pill` + `.is-active`).
   `role="radiogroup"` + each pill `role="radio"` + `aria-checked`.

2. **SEARCH** — search row: `⌕` glyph (U+2315, mono 12px, ink-soft) + text input
   (mono 10px, ink-primary, paper-base background, 1px solid ink-hairline border,
   no border-radius) + clear `×` button when query is non-empty.
   On `focus-within`: border → accent-orange.

3. **ENTRY LIST** — `// ENTRIES 000` head + scrollable `<ul role="listbox">`.
   Each row: `.atlas-strata-btn` (existing atom, `focus-button` gallery entry).
   Glyph slot (kind unicode, 20px), label slot (title truncated + kind/domain
   sub-label), key slot (file id).
   Atom: `focus-button` (`.atlas-strata-btn`, `.is-active` state).

Footer: `[ + NEW ENTRY ]` button. Full-width, transparent background,
`1px solid var(--ink-hairline)`, mono 10px uppercase. Hover:
`border-color → accent-orange; color → accent-orange; background → rgba(212,96,42,0.04)`.

### Canvas (.console-canvas-col)

Fills remaining width. Flex column: `.canvas-frame` (flex:1) + `.console-foot`.

**Canvas frame** — `margin: 12px; border: 1px dashed rgb(var(--ink-rgb) / 0.22);`.
Note: this is a distinct opacity (22%) not covered by `--ink-hairline` (12%) or
`--ink-dashed` (25%). Token gap — see §token gaps.

**Canvas viewport** (`.canvas-viewport.paper-canvas`) — absolute fill within
frame. Receives pan state via pointer-capture. `touch-action: none`.

**Pan mechanism** — custom (no react-flow). Pointer down on background → pan.
Pointer up → release. No inertia. Origin readout in HUD BR.

**α watermark** — `.atlas-alpha-mark` at 280px font-size, `rgba(212,96,42,0.10)`.
Translates at 0.4× the pan rate to create parallax depth.
Atom: `alpha-watermark` (`.atlas-alpha-mark`).

**World layer** — single `div` that translates by `(pan.x, pan.y)`. Contains
SVG edges + node cards.

### Node cards (kn-card)

Kind-node-card atom — new primitive (see §new atoms needed).

| node | glyph | color |
|---|---|---|
| article | ◆ | `var(--ink-primary)` |
| photo | ◎ | `var(--accent-orange)` |
| fiction | △ | `var(--ink-primary)` |
| repo | ○ | `var(--ink-faint)` |

Card dimensions: `width: 158px; min-height: 70px`.
Card surface: `var(--paper-warm)`.
Card border default: `1px solid var(--ink-hairline)`.
Card border hover: `rgba(212,96,42,0.5)` (soft pre-selection signal).
Card border selected: `var(--accent-orange)`.
No drop-shadow. No border-radius.

Micro corner reticles (`.kn-reticle`): 8×8px, accent-orange L-brackets at TL
and BR. Hidden (`opacity: 0`) at default; appear at 120ms ease-out on hover and
selected states. Atom: `corner-reticle` micro variant.

Drag handle: 8×8px `ink-faint` square, bottom-right, visible on hover only.
Hover → `ink-faint → accent-orange`. Used for drag-to-link.

Typography within card:
- Glyph: `var(--font-mono)`, 14px, kind color
- File id: `var(--font-type)` (Special Elite), 9px, `var(--ink-soft)`, 0.04em
- Title: `var(--font-mono)`, 9px, `var(--ink-primary)`, 0.05em, truncated 1 line

### Edges

Custom SVG (`aria-hidden="true"`). Absolute within world layer.

Default edge:
- `stroke: var(--ink-dashed)` (the CSS variable, not a literal)
- `stroke-dasharray: 4 6`
- `stroke-width: 1`
- No arrowhead. Source → target implied by label placement.

Active edge (when source or target node is hovered):
- `stroke: var(--ink-primary)`; `opacity: 1`

Dim edge (non-adjacent to hovered node):
- `opacity: 0.15`

Transition: `opacity 150ms ease` on the edge `<g>` wrapper.

Edge label (Cormorant italic): rendered as `<foreignObject>` in SVG.
- Font: `var(--font-display)` italic, 11px, `var(--ink-soft)`, 0.005em tracking
- Background patch: `var(--paper-base)` behind label text
- Active: `var(--ink-primary)`
- Atom: `type-roles` voice variant

Ghost edge (drag-to-link in progress):
- `stroke: var(--accent-orange); stroke-dasharray: 3 5; opacity: 0.7`

### HUD readouts (.atlas-hud)

Four corner readouts using existing `.atlas-hud` + `.atlas-hud-corner` atoms.

| position | content |
|---|---|
| TL | `WORLDLINE · AUTHORING` / `GRAPH EDITOR` |
| TR | `FIELD · ALL TRACES` (or `FILTER · {KIND}`) / `SURVEY · OPEN` (or `⌕ {QUERY}`) |
| BR | `PINNED · ORIGIN` or `PINNED · DRIFT` |
| BL | BL cluster (below) |

BL control cluster (`.canvas-hud-controls`):
- `NODES · 000` / `EDGES · 000` readout — mono 7px, uppercase, 0.22em.
  Value in `var(--font-type)` 9px.
- `⟳ ARRANGE` button — mono 8px; background `rgba(232,226,213,0.85)`;
  `1px solid var(--ink-hairline)`. Hover → accent-orange border + text.
  Triggers auto-arrange: 3-column tidy grid, 400ms ease-in-out.
- `⊕ ORIGIN` button — same style. Resets pan to `{x:0, y:0}`.

### NETRA voice strip (.console-foot)

Border-top: `1px dashed var(--ink-dashed)`.
`.atlas-netra-voice` inside: `border-left: 3px solid var(--netra)`.
Atom: `netra-voice-strip`.

Default narration: `standby · ne0ex aggregate in view. select a node to survey, or draw a link.`
On new-entry mode: `drafting a new trace — assign a file id and survey it into the field.`
On node selected: `{kind} · {fileId} — "{title}." {role}, {N} worldline link(s) in view.`
Empty canvas: `no entries in graph — add one below.`
`aria-live="polite"` — updates without stealing focus.

### Entry form (.entry-form)

`position: absolute; bottom: 0; left: 0; right: 0; z-index: 6` within canvas column.
Slides up from foot on trigger. NOT a modal.

Trigger states:
- `[ + NEW ENTRY ]` → blank form, `◆ NEW ENTRY` header
- Click node (canvas or list row) → pre-filled form, `EDIT · {KIND} {fileId}` header

Form head: left: title label. Right: `OPEN EDITOR ⟶` link (accent-orange,
mono 8.5px, 0.2em) + `ESC · CLOSE` button.

Form grid: `grid-template-columns: repeat(4, 1fr); gap: 11px 14px`.

| field | cols | type |
|---|---|---|
| KIND | span 2 | select: ARTICLE / PHOTO / FICTION / REPO |
| FILE ID | span 2 | text, placeholder `003` |
| TITLE | span 4 | text, placeholder `lower-case title…` |
| DATE | span 2 | text, placeholder `YYYY.MM.DD` |
| DOMAIN | span 2 | text, placeholder `method` |
| TAGS | span 4 | text (comma-separated), placeholder `essay, identity` |
| SUMMARY | span 4 | textarea (Cormorant italic 13px) |

Form label style: mono 9px uppercase 0.3em `var(--ink-soft)`.
Input style: mono 11px `var(--ink-primary)`, `1px solid var(--ink-hairline)`,
`var(--paper-base)` background, 6px 8px padding, no border-radius.
Focus: border → `var(--accent-orange)`.
SELECT: same border/background; `▾` Special Elite caret.
SUMMARY textarea: `var(--font-display)` italic 13px — voice register
(atom: `type-roles` voice variant). Resize vertical; min-height 56px.

Form action bar: dashed-hairline separator above.
- `SAVE DRAFT` button: transparent border, mono 9px. When dirty:
  `border-color → var(--accent-orange)`.
- `COMMIT` button: `background: var(--ink-primary); color: var(--paper-base)`.
  Hover → accent-orange background.
- `SAVING…` / `UNSAVED CHANGES` / `·` hint text: mono 8px, ink-faint.

**SAVE DRAFT / COMMIT are MOCKED in Slice 2** (filesystem writes hit the live
mutating-action gate + the deferred publish sub-project). Show the saving
state (buttons `opacity: 0.5`, hint → `writing…`), resolve after 240ms.
Mark the mock visually with nothing — it is a known scope deferral, not a
visible state.

---

## console ↔ editor navigation contract

1. `/console` (front door, this spec) is the entry point for all authoring.
   The `⟵ CONSOLE` link in `ArticleEditor.tsx` (`href="/console"`) already
   points here — Slice-2 kills the 404, no code change needed in the editor.

2. From the console: select a node (canvas or list) → entry form slides up →
   `OPEN EDITOR ⟶` navigates to `/console/editor`. The console owns
   graph structure and metadata; the editor owns content body.

3. From the editor: `⟵ CONSOLE` (`.ed-back` link, accent-orange, top-left
   toolbar) → `/console`. The back-link already exists and is styled.

4. **Entry-loading gap (scope call for Polaris):** Slice-1 boots the editor
   from `SAMPLE_MD` / `SAMPLE_DRAFT` hardcoded in `ArticleEditor.tsx`.
   Wiring a specific entry requires passing identity (e.g.
   `/console/editor?kind=article&slug=003`) and loading the real MDX content.
   This is Slice-2 or Slice-3 scope. Specify the URL contract now so Sirius
   can leave the param plumbing in place even if the loading logic is mocked.
   Proposed: `app/console/editor/page.tsx` reads `searchParams.slug` +
   `searchParams.kind`; falls back to SAMPLE if absent. The console's
   `OPEN EDITOR ⟶` link becomes `href={/console/editor?kind=${n.kind}&slug=${n.fileId}}`.
   **This is a scope decision — Polaris confirms whether Slice 2 wires real
   loading or continues with sample-only.**

---

## tokens used

| role | token |
|---|---|
| page surface | `var(--paper-base)` |
| canvas surface | `var(--paper-base)` + `.paper-canvas` grain/scanlines |
| left rail surface | `var(--paper-warm)` + `.paper-warm-surface` |
| node card surface | `var(--paper-warm)` |
| body text | `var(--ink-primary)` |
| label / meta | `var(--ink-soft)` |
| tertiary / hint | `var(--ink-faint)` |
| hairline rule | `var(--ink-hairline)` |
| dashed separators | `var(--ink-dashed)` |
| active / selected | `var(--accent-orange)` |
| active soft halo | `var(--accent-orange-soft)` |
| NETRA accent | `var(--netra)` |
| NETRA background | `rgba(79,110,128,0.07)` ← uses `--netra-rgb` components |
| type roles | `var(--font-display)`, `var(--font-mono)`, `var(--font-type)` |

No raw hex values in production CSS outside this list.

---

## typography

| element | family | size | weight | transform | tracking |
|---|---|---|---|---|---|
| CONSOLE header title | `var(--font-mono)` | 9px | 400 | uppercase | 0.3em |
| [DEV] badge | `var(--font-mono)` | 7.5px | 400 | uppercase | 0.2em |
| center identity | `var(--font-display)` italic | 13px | 400 | none | default |
| EXIT button | `var(--font-mono)` | 9px | 400 | uppercase | 0.22em |
| rail section heads | `var(--font-mono)` | 8px | 400 | uppercase | 0.32em |
| rail entry count | `var(--font-type)` | 9px | 400 | none | 0.04em |
| entry list rows | `var(--font-mono)` | 9–9.5px | 400 | none | 0.03–0.05em |
| node card title | `var(--font-mono)` | 9px | 400 | none | 0.05em |
| node card file id | `var(--font-type)` | 9px | 400 | none | 0.04em |
| node card glyph | `var(--font-mono)` | 14px | 400 | none | — |
| edge label | `var(--font-display)` italic | 11px | 400 | none | 0.005em |
| form labels | `var(--font-mono)` | 9px | 400 | uppercase | 0.3em |
| form inputs | `var(--font-mono)` | 11px | 400 | none | 0.01em |
| summary textarea | `var(--font-display)` italic | 13px | 400 | none | 0.005em |
| HUD corner readouts | `var(--font-mono)` | 7–8px | 400 | uppercase | 0.18–0.22em |
| HUD value numerals | `var(--font-type)` | 9px | 400 | none | 0.04em |
| NETRA tag | `var(--font-mono)` | 7.5px | 500 | uppercase | 0.32em |
| NETRA body | `var(--font-display)` italic | 12px | 400 | none | 0.005em |
| empty canvas | `var(--font-display)` italic | 16px | 400 | none | — |

---

## motion

All motion communicates a state change. No loops. No decorative animation.
`prefers-reduced-motion: reduce` → all transitions 0.001ms (global atom rule).

| interaction | timing | easing | what moves |
|---|---|---|---|
| node hover dim/undim | 150ms | ease | non-adjacent node opacity |
| node hover reticle appear | 120ms | ease-out | kn-reticle opacity 0→1 |
| node border hover | 150ms | ease | node border-color |
| kind filter apply | 150ms | ease | off-kind node opacity |
| search query apply | 150ms | ease | non-matching node opacity |
| search-to-fly pan | 350ms | ease-in-out (rAF) | canvas pan x/y |
| auto-arrange | 400ms | ease-in-out | all node x/y positions |
| connection halo appear | 150ms | ease | box-shadow spread |
| entry form slide-up | 260ms (prototype) | `cubic-bezier(0,0,0.2,1)` | form `translateY(100%→0)` |
| entry form slide-down | 220ms | `cubic-bezier(0.4,0,1,1)` | form `translateY(0→100%)` |
| edge opacity change | 150ms | ease | edge group opacity |

The α watermark drift is not animation — it is a CSS transform that follows
the pan state synchronously. No timing function, no `transition` on it.

---

## states

### Canvas

**Loading** (data not yet resolved from velite):
- Paper canvas with α watermark present. No nodes, no edges.
- Empty canvas message replaced by: instrument mono label, ink-soft:
  `SURVEYING FIELD…` (uppercase, mono 9px, 0.3em tracking, centered).
- No spinner. No progress indicator.
- This state is brief (velite resolves locally); it is the correct
  instrument-register holding state.

**Empty** (data resolved, zero entries):
- Paper canvas with α watermark.
- Centered italic: `no entries in graph — add one below` (Cormorant italic
  16px, ink-soft). `z-index: 3; pointer-events: none`.
- NETRA voice strip: `no entries in graph — add one below.`

**Default** (populated, nothing selected):
- Nodes at full opacity. No rings. NETRA voice: standby message.

**Node hover**:
- Hovered node + 1-hop adjacent → `opacity: 1`. All others → `opacity: 0.25`.
- Hovered node border → `rgba(212,96,42,0.5)`.
- kn-reticle TL + BR appear at 120ms.
- Adjacent edges → `stroke: var(--ink-primary)`, full opacity.
- Non-adjacent edges → `opacity: 0.15`.

**Node selected** (click or keyboard Enter/Space):
- Same as hover + border → `var(--accent-orange)`.
- Entry form slides up.
- NETRA voice updates.
- HUD TR updates to show filter state.

**Node drag in progress**:
- Node under drag: no opacity change, cursor `grabbing`.
- Other nodes not affected.

**Drag-to-link in progress**:
- Source node: unchanged.
- Ghost edge follows cursor: accent-orange dashed `3 5`, opacity 0.7.
- Potential target node: `box-shadow: 0 0 0 4px var(--accent-orange-soft)`.
  Token gap — see §token gaps.

**Kind filter active** (non-ALL):
- Non-matching nodes → `opacity: 0.2`.
- Hover-highlight applies within visible (non-dimmed) set.

**Search query active**:
- Matching nodes border → `1px solid var(--accent-orange)`.
- Non-matching nodes → `opacity: 0.15`.
- Canvas pans to first match (search-to-fly, 350ms).

**Form open — new entry**:
- Form slides up. Form head: `◆ NEW ENTRY`.
- Left rail `+ NEW` button remains visible but not the form trigger anymore.

**Form open — edit entry**:
- Form slides up. Form head: `EDIT · {KIND} {FILEID}`.
- Matching node in list row `is-active`.

**Form dirty** (field changed):
- `SAVE DRAFT` border → `var(--accent-orange)`.

**Form saving** (mocked):
- Both buttons `opacity: 0.5; pointer-events: none`.
- Hint text → `writing…`.
- After 240ms: dirty cleared, form may close (COMMIT) or stay open (SAVE DRAFT).

**Offline — narrow viewport** (< 600px):
- Full-page `.console-offline.paper-canvas`.
- `.corner-marks` at corners.
- `INSTRUMENT OFFLINE · NARROW VIEWPORT` — mono 11px, uppercase, accent-orange.
- Sub-text: italic Cormorant 15px, ink-soft.
- `role="alert"`.

---

## breakpoints

| viewport | behavior |
|---|---|
| ≥ 601px (desktop) | two-pane as drawn; left rail 260px; form in canvas foot |
| ≤ 600px | **intentionally unsupported** — narrow viewport offline state (see above) |

The prototype has no 880px intermediate breakpoint — it goes directly to
the < 600px offline state. The left rail does not collapse to an icon strip.
This diverges from `15-console.md` (which proposed a 880px drawer). The
prototype wins. Rationale: the console is a desktop-only authoring tool;
Peat tends from desktop (prototype comment explicit on this).

Touch targets ≥ 44px for all interactive elements at any supported viewport.

---

## accessibility

```
<main role="application" aria-label="Worldline Console">
  <header> … </header>
  <div class="console-body">
    <aside aria-label="Authoring controls">
      <div role="group" aria-label="Filter by kind">
        <div role="radiogroup"> {pills} </div>
      </div>
      <input aria-label="Search the graph" />
      <ul role="listbox" aria-label="Entries">
        <li role="option" aria-selected="{bool}"> … </li>
      </ul>
      <button>+ NEW ENTRY</button>
    </aside>
    <div class="console-canvas-col">
      <div role="region" aria-label="Worldline graph editor">
        {nodes: role="button" tabindex="0" aria-label="{kind} {fileId}: {title}" aria-selected="{bool}"}
      </div>
      <div aria-live="polite"> NETRA voice </div>
      <form aria-hidden="{!open}"> … </form>
    </div>
  </div>
</main>
```

**Focus order:**
1. Skip-to-content link (hidden until focused, routes `#console-main`)
2. Header `[ ESC · EXIT ]` button
3. Kind filter radiogroup (Tab into, arrows within)
4. Search input
5. Entry list rows (Tab into, arrows within for multi-row navigation)
6. `+ NEW ENTRY` button
7. Canvas region (Tab stop on canvas `div`; Enter/Space focuses first node)
8. Within canvas: Tab cycles between nodes in DOM order; Enter/Space selects
9. Form fields (when form is open): Tab through form, Shift+Tab back
10. `SAVE DRAFT`, hint, `COMMIT` in tab order

**Keyboard shortcuts:**
- `ESC`: if form open → close form. If node selected → deselect. Otherwise → deselect.
- `Cmd/Ctrl + S`: save draft (when form is open).

**Canvas keyboard notes (scoped limitation):**
The prototype's canvas is a pointer-first surface (custom hit-testing, no
react-flow tab management). Node focus via Tab cycles through all node buttons
in DOM order. Keyboard-initiated drag-to-link is **out of scope** for Slice 2
(dev-only, single-user Peat at desktop). Flagged as a known limitation.

**Focus visible:** all interactive elements have a visible focus state.
Inputs: `border-color → var(--accent-orange)`.
Buttons: `outline: 1px dashed var(--accent-orange); outline-offset: 2px`.
Nodes: same dashed outline + kn-reticle appear.

**ARIA live regions:**
- NETRA voice strip: `aria-live="polite"` — narration updates on node selection.
- Narrow viewport offline screen: `role="alert"`.

**Reduced motion:** all CSS transitions respect `prefers-reduced-motion: reduce`
via the global atom rule (collapses to 0.001ms). The search-to-fly rAF
animation checks `window.matchMedia("(prefers-reduced-motion: reduce)")` and
sets position immediately if matched (per prototype console-canvas.jsx line 47).

**Screen reader:** node narration via `aria-label`. NETRA voice provides
narrative context for the current selection state.

**Lighthouse a11y target:** ≥ 95 on the console route. The `role="application"`
declaration + embedded `role="region"` + labeled buttons should clear this
(application role is correct here — it is an interactive canvas).

---

## references — which existing patterns establish precedent

| pattern | source | role in this surface |
|---|---|---|
| `.atlas-strata-btn` / `is-active` | `WorldlineGlobe.tsx` strata sidebar + `globals.css` l.1030 | left rail entry list rows |
| `.af-pill` / `is-active` | `AttractorFields.tsx` + `globals.css` l.749 | kind filter row |
| `.atlas-netra-voice` | `WorldlineGlobe.tsx` l.1856 + `globals.css` l.1287 | NETRA voice strip |
| `.atlas-hud` / `.atlas-hud-corner` | `globals.css` l.1172 | canvas corner readouts |
| `.atlas-alpha-mark` | `globals.css` l.1162 | α watermark behind canvas |
| `.paper-canvas` | `globals.css` l.148 | canvas viewport grain/scanlines |
| `.paper-warm-surface` | `globals.css` l.177 | left rail warm surface |
| `.corner-marks` | `globals.css` l.184 | header strip TL/BR L-brackets |
| `.section-rule-dashed` | `globals.css` l.228 | rail section separators |
| `.t-display`, `.t-mono`, `.t-meta` | `globals.css` l.212 | type class application |
| `.ed-back` | `ArticleEditor.tsx` l.123 | back-link style (already wired to `/console`) |
| `docs/design/40-search-overlay.md §filter row` | — | kind filter vocabulary |

---

## new atoms needed

**`kind-node-card`** — the draggable node card (kind glyph + file id + title +
micro corner reticles on hover/select + drag-link handle). Composes from
`corner-reticle` (micro), `type-roles`, `paper-canvas` surface, and
`dashed-hairline` border, but the compound — a draggable authored object with
two text registers and interactive states — has no gallery entry. Flagged to
the atom catalogue before Sirius implements. Sirius composes from cited atoms
without inventing tokens until the atom is catalogued.

**`entry-form`** — the slide-up metadata form panel (not a modal, not a drawer;
a canvas-foot overlay that slides on translateY). The form is already established
in the prototype; it should be catalogued as an atom so future surfaces can
reference it directly.

**`edge-label`** — Cormorant italic text in a `foreignObject` SVG overlay with
`paper-base` background patch. Distinct enough from `type-roles` alone to
warrant its own entry.

No other atoms needed — all other primitives map to existing gallery entries.

---

## token gaps (for Polaris / TOKEN PROPOSAL)

Literals the DS has no token for. Collected here; do NOT inline as raw values
in production CSS. Sirius uses the literal + records the gap; Betelgeuse will
propose tokens before Slice 3.

| literal | where used | candidate token name |
|---|---|---|
| `260px` | console left rail width | `--console-rail-width` |
| `54px` | console header height | `--console-header-height` |
| `158px` | node card width (NODE_W) | `--node-w` |
| `70px` | node card min-height (NODE_H) | `--node-h` |
| `rgb(var(--ink-rgb) / 0.22)` | canvas frame dashed border | `--ink-canvas-frame` |
| `280px` | α watermark font-size | `--alpha-mark-size` |
| `rgba(232,226,213,0.85)` | HUD button background | `--hud-btn-bg` |
| `rgba(212,96,42,0.04)` | rail entry + NEW hover bg | (already exists as `--accent-orange-soft` at 0.18 — may need a lighter variant `--accent-orange-faint`) |
| `box-shadow: 0 0 0 4px var(--accent-orange-soft)` | drag-to-link target halo | not a new token (uses existing `--accent-orange-soft`), but the pattern should be catalogued in `kind-node-card` atom |
| `stroke-dasharray: 4 6` | edge default | `--edge-dash` |
| `stroke-dasharray: 3 5` | ghost edge (drag-to-link) | `--edge-dash-ghost` |
| `rgba(212,96,42,0.10)` | α watermark opacity | `--alpha-mark-opacity` (or express as `rgb(var(--accent-orange) / 0.10)` — but `--accent-orange` is a hex not an rgb triple; see note) |

Note on α watermark opacity: `var(--accent-orange)` is `#D4602A` (a hex),
not an rgb-channel variable. The prototype expresses this as
`rgba(212, 96, 42, 0.10)` directly. A clean fix would be adding
`--accent-orange-rgb: 212 96 42` to `:root` so `rgb(var(--accent-orange-rgb) / 0.10)`
is possible — consistent with the `--ink-rgb` pattern already established.
**TOKEN PROPOSAL:** add `--accent-orange-rgb: 212 96 42` to `:root`.

Carried over from Slice-1 `ArticleEditor.tsx` token-gap log:
- `212px` outline rail width (`--editor-rail-width` — editor-specific)
- `46px` toolbar height (`--editor-toolbar-height`)
- `rgba(212,96,42,0.02)` / `0.03` / `0.05` — accent sub-tints below `--accent-orange-soft`

---

## non-goals (Slice 2)

- No prose MDX editor within the console (Peat uses the editor route for body content).
- No NETRA-assisted authoring (Arcturus extends later).
- No real filesystem persistence in Slice 2 — SAVE DRAFT and COMMIT are mocked.
- No real entry→editor content loading in Slice 2 unless Polaris confirms scope.
- No drag-to-link keyboard path (Slice 2; dev-only authoring tool, Peat at desktop).
- No mobile support (≤ 600px intentionally offline).
- No dark mode variant.
- No drag-and-drop reordering of the left rail list (chronological/alpha order).
- No `TweaksPanel` (prototype dev toy; does not ship).
- No left-rail icon-strip collapse at 880px (prototype has no such breakpoint; Slice-2 follows prototype).
- No "dev mode required" render gate — the `robots noindex` + not-in-Nav contract from Slice 1 carries forward.

---

## design ambiguity that does not need Peat's call

The prototype is 6-round settled. All aesthetic decisions resolve to it:
straight dashed edges (not curved; `edgeCurve=false` default); inline
entry form (not a modal); `TweaksPanel` dropped; offline < 600px only.
None of these need escalation.

---

## one call for Polaris

**Scope: does Slice 2 wire real entry → editor content loading?**

The round-trip navigation is fully specced (console ↔ editor). What is not
decided is whether `/console/editor?kind=article&slug=003` actually loads
the real MDX content for that entry, or whether Slice 2 continues with
`SAMPLE_MD` / `SAMPLE_DRAFT` hardcoded in `ArticleEditor.tsx`. This is a
scope decision, not an aesthetic one. The URL contract is defined above;
confirm whether the loading wire is Slice 2 or Slice 3 so Sirius knows how
far to take `searchParams` handling in this wave.

---

## file layout Sirius creates

- `app/console/page.tsx` — route file (server component, thin shell).
  Metadata: `title: 'Worldline · Console'`, `robots: { index: false, follow: false }`.
  Renders `<ConsoleApp />`.
- `components/console/ConsoleApp.tsx` — `'use client'`. The console shell:
  header, two-pane body, NETRA foot, entry form. State: nodes, edges,
  selectedId, hoveredId, activeFilter, query, formOpen, formMode, formData,
  dirty, saving.
- `components/console/ConsoleCanvas.tsx` — `'use client'`. Custom canvas:
  pan, drag, drag-to-link, auto-arrange, search-to-fly, node + edge rendering.
- `components/console/ConsoleRail.tsx` — left rail: kind filter, search,
  entry list, + NEW button. Can be server component if no state of its own
  (state lives in ConsoleApp).
- `components/console/ConsoleEntryForm.tsx` — entry form: slides up, CRUD
  fields, save/commit actions (mocked).

The CSS for these components lives in inline `<style>` blocks within each
`.tsx` file (matching the Slice-1 editor convention in `ArticleEditor.tsx`)
or in a collocated `.module.css` only if Sirius finds the inline approach
unwieldy at this scale. Sirius decides; the constraint is no new tokens and
all class names prefixed `.console-` or `.kn-` or `.ef-` to avoid collision.

The `Worldline Console.html` `<style>` block (lines 11–154) is the CSS
source for all `.console-*`, `.ch-*`, `.kn-*`, `.ef-*`, `.hud-btn`, and
`.canvas-*` classes. Port those; do not re-derive.

---

*Betelgeuse (α-VIS-04) · atlas-console Slice 2 · 2026-06-07*
*dispatch ready — Sirius implements from this spec*
