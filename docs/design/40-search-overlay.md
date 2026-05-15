# docs/design/40-search-overlay.md
# TRIANGULATE Search Overlay · TASK-2026-05-15-40

> Author · Betelgeuse (α-VIS-04) · TASK-2026-05-15-40 · sonnet
> Predecessors · journey-architecture v1.2 §8 · PRD-04 · attractor-binding-mechanic v1.1
> Consumed by · TASK-41 (Sirius + Canopus · implementation)
> Status · SPEC · 2026-05-15

---

## intent

A retrieval instrument. The visitor sweeps the entire archive by keyword and lands on a node. It reuses the cartographer vocabulary — coordinates, drift readouts, glyph taxonomy — so it reads as an extension of the ATLAS frame rather than a generic search modal grafted on.

Semantic contracts:
- Search is **read-only** against content collections. No interaction with AttractorFields binding state or DivergenceMeter. The binding mechanic doc (v1.1 §non-goals) explicitly marks this orthogonal.
- Search is **not NETRA**. NETRA synthesizes; search retrieves. Two separate UIs even though NETRA's `search_entries` tool internally reuses the Pagefind index.
- The overlay **does not navigate**. It opens over the current page. ESC returns the visitor where they were. Clicking a result navigates.

---

## trigger affordances

Two triggers, same outcome:

**`/` hotkey** — fires when no input element holds focus. Guard: `if (e.key === '/' && !isInputFocused()) openOverlay()` via `document.activeElement` check.

**`⌕ TRIANGULATE` nav link** — right of `Nav.tsx`, after `⊹ TRANSMIT`. Same mono uppercase rhythm as existing nav links. `⌕` is U+2315 (JetBrains Mono). Keyboard hint `[/]` in `var(--ink-faint)` at 9px — visible ≥881px only.

**Deep-link**: `/search?q=<query>` opens overlay pre-populated. Sirius reads `searchParams.q` on mount.

---

## layout

Full-page modal (not a drawer). The overlay needs the full canvas to show list + mini-globe side by side. It differs from the NETRA drawer (which is a side panel that overlays content) in both scope and semantic role.

```
┌────────────────────────────────────────────────────────────────────────┐
│  ┌─┐  TRIANGULATE                                    [ESC · CLOSE ✕]  │
│  └─┘                                                                    │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ [⌕]  search query...                                              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│  [ ALL ]  [ ARTICLE ]  [ PHOTO ]  [ FICTION ]                          │
│                                                                         │
│  ─── SURVEY ──────────────────────────  ─── COORDINATES ────────────  │
│                                                                         │
│  003 · 2026.05.07 · ARTICLE             ╭──────────────────────────╮  │
│  on the architecture of taste           │                            │  │
│  ◇ method · ◇ reflection               │   ·   *  ·                 │  │
│  → 13.76°N · 100.50°E · drift 0.0k     │       ·    *  ·            │  │
│                                         │   *    ·        ·          │  │
│  001 · 2026.04.28 · ARTICLE             │             *    ·         │  │
│  the four pours adaptation              ╰──────────────────────────╯  │
│  ◇ method                                                               │
│  → 8.49°N · 76.94°E · drift 2.7k                                       │
│                                                                         │
│  012 · 2026.05.01 · PHOTO                                               │
│  ▪ roll / Velvia                                                         │
│  → 13.74°N · 100.52°E · drift 0.1k                                      │
│                                                                         │
│  ↑↓ navigate · ↵ open · ⇥ filter · ESC close                           │
└────────────────────────────────────────────────────────────────────────┘
```

**Column split (≥881px):** results column `calc(100% - 300px - 32px)`, mini-globe panel fixed `300px`, `16px` gap. Mini-globe is `position: sticky; top: 0` so it stays visible as results scroll.

**Overlay dimensions:** `max-width: 900px; margin: 0 auto; height: 80vh; max-height: 720px`. Centered.

**Backdrop:** `rgb(var(--ink-rgb) / 0.15)` behind the modal panel. Panel itself is `var(--paper-base)` solid. Paper-on-paper layering, consistent with the Globe's side panel vocabulary.

---

## overlay header

`┌─┐  TRIANGULATE` (left) — `[ESC · CLOSE ✕]` (right)

- Corner reticle — `atlas-hud-corner` atom from `globals.css`. Sirius reuses the same markup, not a new one.
- `TRIANGULATE` — `t-mono`, 11px, uppercase, `letter-spacing: 0.3em`, `color: var(--ink-primary)`.
- `ESC · CLOSE ✕` — `t-mono`, 9px, `color: var(--ink-soft)`. Full label is the click target (44×44px minimum).

---

## input field

Full width. `background: var(--paper-warm)`. `border: 1px dashed var(--ink-dashed)` resting; `1px solid var(--ink-primary)` on focus. `font-family: var(--font-mono)`, 13px. Placeholder `survey the archive...` in `var(--ink-faint)`. `⌕` prefix glyph inside field, `color: var(--ink-soft)`. `padding: 10px 12px 10px 32px`. `border-radius: 0` — instrument field, not a SaaS search bar. Autofocus on open.

---

## filter pills

`ALL` · `ARTICLE` · `PHOTO` · `FICTION`. `t-mono`, 9px, uppercase, tracking 0.3em.
- Resting: `background: transparent`, `border: 1px dashed var(--ink-dashed)`, `color: var(--ink-soft)`
- Active: `background: var(--ink-primary)`, `border: 1px solid var(--ink-primary)`, `color: var(--paper-bright)`
- Hover (non-active): `border-color: var(--ink-primary)`, `color: var(--ink-primary)` — 120ms ease
- `ALL` active by default. Tab key cycles pills. Color/border changes only — no positional animation.
- Semantics: `role="radiogroup"` + `role="radio" aria-checked` per pill.

---

## result item structure

Each result is a row in an ordered list (`<ol>`). A result row contains:

```
003 · 2026.05.07 · ARTICLE
on the architecture of taste
◇ method · ◇ reflection
→ 13.76°N · 100.50°E · drift 0.0k
```

Line-by-line:

**Line 1 — meta row** — `t-mono`, 9px, uppercase, `letter-spacing: 0.3em`, `color: var(--ink-soft)`. Format: `<fileNum> · <date YYYY.MM.DD> · <KIND>`. The KIND glyph per content type:
- ARTICLE — plain text `ARTICLE`
- PHOTO — `▪ PHOTO` (filled square U+25AA — same square taxonomy as §2.2 of journey-arch)
- FICTION — `◆ FICTION` (filled diamond U+25C6 — matches diamond glyph family)

**Line 2 — title** — Cormorant Garamond italic, 15px, `color: var(--ink-primary)`. One line maximum; overflow ellipsis.

**Line 3 — tags** — `t-mono`, 9px, `color: var(--ink-faint)`. Format: `◇ <tag1> · ◇ <tag2>`. Tags sourced from `tags[]` frontmatter. Max 3 tags shown; remainder suppressed (no `+N more` — keep it clean). If no tags, line 3 is omitted.

**Line 4 — coordinate + drift** — `t-mono`, 9px, `color: var(--ink-soft)`. Format: `→ <lat>°N/S · <lon>°E/W · drift <N.Nk>`. Drift = great-circle distance from α (Bangkok 13.7563°N, 100.5018°E) in km, rounded to 1 decimal + `k` suffix. Entries without `coordinates` show `→ coordinate unknown` in `var(--ink-faint)`.

**Row interaction:**
- Resting: `background: transparent`, left border `3px solid transparent`
- Hover / keyboard-focused: `background: var(--paper-warm)`, left border `3px solid var(--ink-dashed)` — 120ms ease
- Active (highlighted from mini-globe hover): `background: var(--paper-warm)`, left border `3px solid var(--accent-orange)` — 120ms ease
- Selected (↑↓ keyboard navigation): same as active + `outline: 1px solid var(--ink-primary)` on the row
- `padding: 10px 12px`; `border-bottom: 1px dashed var(--ink-dashed)` between rows
- Each row is a `<li>` containing an `<a href="<entry-route>">` that wraps all four lines

**Snippet** — if `summary` frontmatter exists, use it (≤160 chars) instead of Pagefind's auto-excerpt. No fifth line; the four-line row is the maximum. Compact rows.

**Glyph cross-reference** — ▪ PHOTO and ◆ FICTION mirror the Globe pin taxonomy in journey-arch §2.2 (square for photo, diamond for fiction). A visitor who has seen the Globe already knows what these glyphs mean.

---

## mini-globe panel (SVG orthographic)

~280×280px SVG. NOT Three.js. Decision: PRD-04 §open-questions + journey-arch §8.2.

**Renders:**
- Continent outlines: `fill: none`, `stroke: var(--ink-hairline)`, `stroke-width: 0.5`. Low-polygon paths.
- α locus (Bangkok): small circle `r: 3`, `fill: var(--accent-orange)`
- Result pins: circle for article, small square for photo, small diamond for fiction. `fill: var(--ink-soft)` default; highlighted pin → `fill: var(--accent-orange)`, slightly larger
- No coordinate grid, no instrument chrome at this scale
- `role="img"`, `aria-label="Coordinate map of search results"`. Pins not keyboard-focusable (result list is the keyboard path).

**Hover sync (bidirectional):** Hovering a result row → that pin highlights (120ms color + size). Hovering a pin → corresponding result row scrolls into view + gets active style. Local `useState` for `hoveredResultId: string | null` — no zustand required.

**Label:** `COORDINATES · α 13.76°N · 100.50°E` — `t-mono`, 9px, `var(--ink-faint)`, centered below SVG.

---

## empty / loading / error states

All empty/loading/error copy: `t-mono`, 9px, `var(--ink-faint)`.

**Empty query:** `// TRIANGULATE · <count> entries indexed / type to survey`. Mini-globe shows all archive pins (orientation). Count from `getAllArticles().length + getAllPhotos().length + getAllFiction().length` at build time — static prop.

**Loading:** `// surveying...` — appears after 120ms debounce fires. The `...` does NOT animate (quality-bar: no looping decorative motion).

**No results:** `// nothing surveyed · no match for "<query>" / try a different term`. Mini-globe shows empty globe.

**Load failure:** `// triangulation offline · index unavailable / the archive is still navigable below`. Followed by `<a href="#chapter-index">↓ go to entries list</a>` — anchor, not button (overlay can be dismissed; visitor scrolls to ChapterIndex).

---

## click-result motion

1. Overlay closes — 200ms opacity 1→0, then `display: none`. No slide.
2. Router navigates to entry route (`/entries/<fileNum>`, `/photos/<roll>/<id>`, `/fiction/<slug>` per journey-arch §3.1).
3. No globe-state restoration. No "return-to-search-results" affordance in v1. The Nav `← INDEX` link on any entry page returns to `/`.

No flying transition between overlay and entry. Navigation is page-level.

---

## Pagefind integration touchpoints

Notes for Sirius (TASK-41) + Canopus (build hook). Implementation is their territory; these are the design contracts.

**Lazy-load.** Dynamic `import('/_pagefind/pagefind.js')` inside the `openOverlay` handler. ~100kb bundle NOT included in initial page bundle.

**Index build.** Canopus: `postbuild` script → `pagefind --site out --output-subdir _pagefind`. `/_pagefind/` in `.gitignore`.

**Result shape.** Sirius adds `data-pagefind-meta` attributes on entry page shells for `kind`, `fileNum`, `date`, `tags`, `lat`, `lon` — so result rows populate without a secondary fetch.

**Filter by kind.** `pagefind.options({ filters: { kind: activeFilter } })`. Canopus configures `data-pagefind-filter="kind[data-kind]"` on entry shells.

**Seed-stage entries.** Seeds (`status: 'draft'`) appear in results with `SEED ·` prefix on the meta row in `var(--ink-faint)`. They are public pages; consistent treatment. Pagefind indexes them.

---

## ESC behavior and focus trap

**Focus trap.** Tab cycles: `input` → filter pills → result rows → input. `aria-modal="true"` on the container. Sirius uses `focus-trap-react` or manual keydown guard — Sirius decides. Must handle Tab + Shift+Tab.

**ESC:** input has content → ESC clears input (does not close). Input empty → ESC closes overlay. Consistent with NETRA drawer's clear-first pattern (journey-arch §4.4).

**Click outside.** Backdrop click closes overlay. Same 200ms fade-out.

**On close.** Focus returns to triggering element (`⌕` Nav link or `document.body` for `/` hotkey). Sirius stores ref to triggering element, calls `.focus()` on close.

---

## mobile behavior (≤600px)

Full-viewport layout. The mini-globe drops below the results list.

```
┌──────────────────────────────────┐
│  ┌─┐  TRIANGULATE     [ESC ✕]   │
│  └─┘                             │
│  ┌────────────────────────────┐  │
│  │ [⌕] survey the archive...  │  │
│  └────────────────────────────┘  │
│  [ ALL ] [ ARTICLE ] [ PHOTO ]   │
│  [ FICTION ]                     │
│                                  │
│  ─── SURVEY ──────────────────  │
│  003 · 2026.05.07 · ARTICLE      │
│  on the architecture of taste    │
│  ◇ method · ◇ reflection        │
│  → drift 0.0k                    │
│                                  │
│  001 · 2026.04.28 · ARTICLE      │
│  the four pours adaptation       │
│  ◇ method                        │
│  → drift 2.7k                    │
│                                  │
│  ─── COORDINATES ──────────────  │
│  ╭────────────────────────────╮  │
│  │   (mini-globe SVG · 200px) │  │
│  ╰────────────────────────────╯  │
│  COORDINATES · α 13.76°N         │
└──────────────────────────────────┘
```

**Differences from desktop:**
- Overlay is `width: 100vw; height: 100dvh` — full viewport, no backdrop visible
- Mini-globe moves below results list, centered, `200px × 200px`
- On mobile, coordinates column shows abbreviated: `→ drift <N.Nk>` only (lat/lon omitted — too dense at mobile widths)
- Filter pills wrap to two rows if needed (no horizontal scroll)
- Touch target for each result row ≥ 44px height
- `⌕` hotkey not applicable on mobile; only the Nav `⌕` link triggers the overlay
- The input keyboard opens on focus — overlay layout uses `dvh` so the viewport meta `interactive-widget=resizes-content` shrinks the overlay correctly (same pattern as NETRA chat per journey-arch §4.5)

**≤880px (between mobile and desktop):** Same as desktop but the mini-globe panel reduces to `220px` wide; results column takes remaining width. No layout change otherwise.

---

## breakpoints summary

| breakpoint | layout |
|---|---|
| ≥881px | two-column: results left, mini-globe right (300px sticky) |
| 601–880px | two-column: mini-globe reduced to 220px |
| ≤600px | single-column: results, then mini-globe below; full-viewport overlay |

---

## accessibility

**Role and semantics:**
- Overlay container: `role="dialog"`, `aria-modal="true"`, `aria-label="TRIANGULATE · search the archive"`
- Input: `role="combobox"`, `aria-expanded="true"` when results are shown, `aria-haspopup="listbox"`, `aria-controls="search-results-list"`, `aria-autocomplete="list"`
- Results list: `role="listbox"`, `id="search-results-list"`, `aria-label="search results"`
- Each result row: `role="option"`, `aria-selected="true/false"` (for keyboard-selected row), `aria-label="<fileNum> · <title> · <kind> · drift <N>k"`
- Filter pills: `role="radiogroup"` + `role="radio"` per pill
- Mini-globe SVG: `role="img"`, `aria-label="coordinate map of search results"`

**Keyboard map:**
- `/` — open overlay (document-level)
- `ESC` — clear input if non-empty; close overlay if empty
- `Tab` / `Shift+Tab` — cycle focus within overlay (input → filters → results)
- `↑` / `↓` — navigate result rows when focus is in the results list (input also accepts ↑↓ to move into results)
- `Enter` — open selected result
- `⇥` (Tab while in input) — jump to first filter pill

**Screen reader announcements:**
- On overlay open: `aria-live="assertive"` region announces `"TRIANGULATE overlay open. Type to search."` (one-shot, not polite — this is a mode change)
- On results update: `aria-live="polite"` region announces `"<N> results found"` (debounced — fires after Pagefind returns, not during typing)
- No announcements during keystroke-by-keystroke typing (would create noise)

**Skip link:** The existing document skip-link (`Skip to entries list`) bypasses the overlay. When the overlay is open, Tab from the skip link lands in the overlay input (the focus trap absorbs it). This is correct — the overlay IS the primary interaction surface while open.

**Reduced motion:** The 200ms overlay open/close opacity fade is suppressed (`prefers-reduced-motion: reduce` → `transition: none`). The overlay appears and disappears instantly. No other motion in the overlay (the loading state is static text; the mini-globe pin highlight is a color change with no transform).

**Lighthouse target:** a11y ≥ 95 on any page where the overlay is triggered. The combobox semantics, focus trap, and live region announcements are the critical checkpoints.

---

## tokens used

| element | token |
|---|---|
| overlay panel background | `var(--paper-base)` |
| overlay backdrop | `rgb(var(--ink-rgb) / 0.15)` |
| input background | `var(--paper-warm)` |
| input border resting | `var(--ink-dashed)` |
| input border focus | `var(--ink-primary)` |
| header label, filter active bg | `var(--ink-primary)` |
| filter active text | `var(--paper-bright)` |
| filter resting border | `var(--ink-dashed)` |
| result title | `var(--ink-primary)` |
| result meta / drift | `var(--ink-soft)` |
| result tags | `var(--ink-faint)` |
| result row hover bg | `var(--paper-warm)` |
| result row hover border | `var(--ink-dashed)` (left 3px) |
| result row active border | `var(--accent-orange)` (left 3px, on globe-hover sync) |
| result row selected outline | `var(--ink-primary)` (1px solid) |
| row divider | `var(--ink-dashed)` |
| continent outlines SVG | `var(--ink-hairline)` |
| α locus pin | `var(--accent-orange)` |
| result pins default | `var(--ink-soft)` |
| result pin highlighted | `var(--accent-orange)` |
| empty / loading / error copy | `var(--ink-faint)` |
| close affordance label | `var(--ink-soft)` |

No raw hex values. No new tokens proposed or used.

---

## typography

| element | family | size | weight | style | tracking |
|---|---|---|---|---|---|
| `TRIANGULATE` header | `var(--font-mono)` JetBrains Mono | 11px | 400 | normal | 0.3em |
| input text | `var(--font-mono)` | 13px | 400 | normal | 0 |
| input placeholder | `var(--font-mono)` | 13px | 400 | normal | 0 |
| filter pills | `var(--font-mono)` | 9px | 400 | normal | 0.3em |
| result meta row (line 1) | `var(--font-mono)` | 9px | 400 | normal | 0.3em |
| result title (line 2) | `var(--font-display)` Cormorant Garamond | 15px | 400 | italic | 0 |
| result tags (line 3) | `var(--font-mono)` | 9px | 400 | normal | 0 |
| result drift (line 4) | `var(--font-mono)` | 9px | 400 | normal | 0 |
| keyboard hint footer | `var(--font-mono)` | 9px | 400 | normal | 0.15em |
| mini-globe label | `var(--font-mono)` | 9px | 400 | normal | 0.3em |
| empty/error copy | `var(--font-mono)` | 9px | 400 | normal | 0 |

All type is from the existing scale. No new sizes.

---

## motion

| event | duration | easing | notes |
|---|---|---|---|
| overlay open | 200ms opacity 0→1 | `ease-out` | overlay panel only; backdrop appears simultaneously |
| overlay close | 200ms opacity 1→0 | `ease-in` | then `display:none`; router navigates after |
| filter pill state change | 120ms | `ease` | color + border only |
| result row hover | 120ms | `ease` | bg + left border color |
| result row active (globe sync) | 120ms | `ease` | left border color only |
| mini-globe pin highlight | 120ms | `ease` | color + size (SVG `r` attribute or transform) |
| loading text appearance | 0ms | none | no animation; text appears on debounce fire |
| `prefers-reduced-motion` | all transitions → 0ms | — | overlay open/close become instant cuts |

No looping animations. No motion during result reading.

---

## states (complete)

| state | trigger | visual |
|---|---|---|
| closed | default | overlay not in DOM (or `display: none`) |
| open · empty query | `/` or `⌕` click | header + input + pills + empty-query copy + mini-globe showing full archive pins |
| open · loading | keystroke fired, 120ms debounce in flight | `// surveying...` in results column; mini-globe unchanged |
| open · results | Pagefind returns | result rows render; mini-globe shows matched pins only |
| open · no results | Pagefind returns zero | `// nothing surveyed...` copy; mini-globe shows empty globe |
| open · result hovered (mouse) | cursor over result row | row gets `var(--paper-warm)` bg + dashed left border; corresponding mini-globe pin highlights orange |
| open · result keyboard-selected | ↑↓ keys | row gets selected outline; same pin highlight on mini-globe |
| open · pin hovered (mouse on SVG) | cursor over mini-globe pin | pin highlights; corresponding result row scrolls into view + gets active style |
| open · filter active | pill click | active pill gets ink bg; results re-filter; mini-globe re-renders matching pins |
| open · error (Pagefind unavailable) | lazy-load import fails | error copy + fallback anchor |
| open · reduced-motion | OS preference | all transitions disabled; visual states identical |

---

## references (existing patterns this spec builds from)

- `atlas-hud-corner` in `globals.css` — corner reticle atom; identical markup reused in overlay header
- `atlas-head` in `globals.css` — mono uppercase label vocabulary for header strip
- `ChapterIndex.tsx` — result row visual language (file number · date · title rhythm); search result rows are a compressed version of ChapterIndex entry cards
- `globals.css .t-meta` — 9px mono uppercase tracking 0.3em; all meta rows in the overlay use this class
- `globals.css .marginalia` — referenced only for precedent that `var(--ink-faint)` at 9px is readable; no markup reuse
- `globals.css .atlas-strata-btn` — filter pill active/resting state pattern: ink-bg active, dashed-border resting; overlay pills adopt the same color logic
- journey-arch §4.1 — drawer open motion reference (520ms cubic-bezier for NETRA). Overlay is shorter (200ms) because it is a full-page modal, not a slide-in — it should feel instantaneous, not traveled
- attractor-binding-mechanic v1.1 §non-goals — confirms search overlay is orthogonal to AttractorFields binding

---

## non-goals

- No AI synthesis in the overlay. Synthesis is NETRA's role.
- No binding to AttractorFields or DivergenceMeter state.
- No faceted UI for tag-filter combinations (Pagefind supports it; deferred per PRD-04 out-of-scope).
- No personalized ranking based on visitor history.
- No three.js instance in the overlay. The mini-globe is SVG only.
- No "search within attractor field" pre-filter. AttractorFields and search are separate surfaces.
- No result previews / hover card over results (the drift + tags line is the preview; a hover card would add complexity without enough signal gain at this corpus size).
- No autocomplete / typeahead suggestions from Pagefind (can be enabled later; out of v1).
- No `/` hotkey on mobile (unavailable on soft keyboards; the `⌕` Nav link covers mobile).

---

*betelgeuse · α-VIS-04 · TASK-2026-05-15-40 · sonnet · 2026-05-15*
