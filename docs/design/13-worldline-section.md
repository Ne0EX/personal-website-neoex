# docs/design/13-worldline-section.md
# WorldlineLinks · § worldline section · L2b Local View · v1.0

> author · Betelgeuse (α-VIS-04)
> task · S3 wave · L2b local-view spec
> vision lock · docs/team/VISION-2026-05-31-search-lineage-console.md §1.2 (L2b)
> status · SPEC COMPLETE · ready for Sirius handoff

---

## intent

1-hop neighborhood made visible without becoming a graph product. Instrument register governs: nodes are kind-glyphs, not cards. Edges are dashed hairlines with italic Cormorant free-text — the label is voice, the line is instrument. If no links exist, the section is absent.

---

## layout

Desktop (>880px):

```
┌──────────────────────────────────────────────────────────────────────┐
│  §  WORLDLINE                                            [t-meta]    │  ← .section-rule-dashed above
│                                                                      │
│     INCOMING  ← SEEDED BY                                           │
│     ────────────────────────────────────────────────               │
│     [glyph] title-of-entry          [kind label]  [date]           │
│              ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ label prose ╌╌╌╌            │
│     [glyph] title-of-entry          [kind label]  [date]           │
│                                                                      │
│     THIS ENTRY  ·  [glyph] [title]                                  │
│                                                                      │
│     OUTGOING  →  SEEDED                                             │
│     ────────────────────────────────────────────────               │
│     [glyph] title-of-entry          [kind label]  [date]           │
│              ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌ label prose ╌╌╌╌            │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

≤880px: layout identical. Node row wraps at 600px — glyph and title on row 1, kind + date on row 2 below, edge label on row 3.

≤600px: each neighbor row becomes a 3-line stack. Touch target of the row link ≥ 44px tall. Date drops (space economy). Kind glyph + title remain.

**THIS ENTRY** row: current entry at center, glyph + title only, not a link. `--ink-primary` weight 500 title. Horizontal at desktop, stacked at mobile.

---

## kind glyphs

| kind | glyph | rationale |
|------|-------|-----------|
| article | ◆ | solid diamond — a finished survey |
| photo | ◎ | circle with inner ring — a measured image frame |
| fiction | △ | triangle — an open possibility |
| repo | ○ | hollow circle — an external structure |

JetBrains Mono 11px. Unicode geometric only — no SVG. Color: `var(--ink-soft)`, shifts to `var(--ink-primary)` on row hover.

---

## tokens used

| role | token |
|------|-------|
| section surface | `var(--paper-base)` (inherits from page) |
| section header label | `var(--ink-soft)` |
| direction header (INCOMING / OUTGOING) | `var(--ink-faint)` |
| neighbor title | `var(--ink-primary)` |
| neighbor title hover | `var(--ink-primary)` (weight 500, no color shift — the marching-dash underline carries the affordance) |
| kind label | `var(--ink-faint)` |
| date | `var(--ink-faint)` |
| edge label (italic Cormorant) | `var(--ink-soft)` |
| THIS ENTRY title | `var(--ink-primary)` |
| glyph (neighbor) | `var(--ink-soft)` → `var(--ink-primary)` on row hover |
| edge hairline (dashed) | `var(--ink-dashed)` |
| section rule above | `var(--ink-dashed)` (`.section-rule-dashed`) |
| marching-dash underline on hover | `var(--accent-orange)` repeating segment |

No raw hex. No raw rgba outside these tokens.

---

## typography

| element | family | size | weight | tracking | case | class |
|---------|--------|------|--------|----------|------|-------|
| section header "§ WORLDLINE" | JetBrains Mono | 9px | 400 | 0.3em | UPPER | `.t-meta` |
| direction label "INCOMING · ← SEEDED BY" | JetBrains Mono | 8px | 400 | 0.22em | UPPER | `.t-mono` + `font-size:8px` |
| neighbor title | JetBrains Mono | 11px | 400 | 0.05em | lower | `.t-mono` |
| kind label | JetBrains Mono | 8px | 400 | 0.18em | UPPER | inline |
| date | Special Elite | 9px | 400 | 0.04em | — | `.t-type` |
| edge label | Cormorant Garamond italic | 12px | 400 | 0.005em | lower | `.t-display` |
| THIS ENTRY title | JetBrains Mono | 11px | 500 | 0.05em | lower | `.t-mono` |
| glyph | JetBrains Mono | 11px | 400 | 0 | — | `.t-mono` |

**Edge label:** full-width row beneath its neighbor, indented past the glyph slot. Absent → row not rendered.

---

## motion

| trigger | property | duration | easing |
|---------|----------|----------|--------|
| neighbor row hover — marching-dash underline extends | `width` 0 → 100% | 460ms | `cubic-bezier(0.2, 0.8, 0.2, 1)` |
| neighbor row hover — glyph color shift | `color` | 150ms | `ease` |
| section entrance | none | — | — (reading surface; no entrance animation) |

`prefers-reduced-motion: reduce` → all transitions 0.001ms per the global atom rule.

---

## states

| state | behavior |
|-------|----------|
| default | incoming block above · THIS ENTRY center · outgoing block below |
| no incoming | incoming block + direction label absent; outgoing remains if present |
| no outgoing | symmetric |
| no links at all | entire section absent — gate on `(incoming.length > 0 \|\| outgoing.length > 0)` |
| single neighbor | valid; no minimum |
| many (>5) | render all; no truncation |
| long edge label | wraps; no truncation |
| broken link | build-time catch (VISION §2.1); silently omitted |

---

## breakpoints

**>880px** — flex row; `gap: 12px`; glyph slot 20px fixed; kind + date flush right.

**≤880px** — identical to desktop.

**≤600px** — block stacked: row 1 glyph + title; row 2 edge label (if present, 14px indent); `min-height: 44px` on `<a>`; date hidden; kind label kept.

---

## accessibility

- `<section aria-label="worldline links">`
- Incoming: `<div role="list" aria-label="seeded by">` / each row `role="listitem"`
- Outgoing: `<div role="list" aria-label="seeds">` / same pattern
- Neighbor `<a>`: `aria-label="[kind]: [title]"` e.g. `aria-label="article: On Leaving Chiang Mai"`
- THIS ENTRY: `<div aria-current="page">` — not inside either list, not a link
- Tab order: incoming list → outgoing list, top-to-bottom. No traps.
- Focus ring: 2px solid `var(--accent-orange)` offset 2px.
- Direction labels not aria-hidden — screen reader reads them before each list.

---

## atoms used (Rule 5 table)

| atom id | gallery id | role in this surface |
|---------|-----------|----------------------|
| `dashed-hairline` | `dashed-hairline` | `.section-rule-dashed` above the section header; inline edge-label row uses `border-bottom: 1px dashed var(--ink-dashed)` as the visual "line" connecting neighbor to edge label |
| `type-roles` | `type-roles` | all three families present: Cormorant italic = edge labels (voice register); JetBrains Mono = section header / direction labels / neighbor title / kind (instrument register); Special Elite = date numerals (value register) |
| `entry-glitch` | not a gallery atom — composed from `entry-glitch` pattern in worldline-atoms.css | marching-dash underline on neighbor row hover; identical mechanic as ChapterIndex entry cards |

**Note on `entry-glitch`:** documented in `worldline-atoms.css` lines 210–217 but not yet in `manifest.json`. Sirius composes from the existing CSS class — no re-derivation.

**Atoms not used:** `corner-reticle` (page-level CornerMarks already frames the page; inner section would over-instrument) · `alpha-node / archive-node / fiction-node / photo-node` (Three.js globe glyphs; L2b uses Unicode typographic register) · `netra-console / netra-voice-strip` (separate section) · `paper-mount` (photo-entry only) · all HUD / globe / divergence atoms.

---

## references

- `ChapterIndex.tsx` — establishes the `.entry-glitch` marching-dash underline affordance for neighbor title hover
- `worldline-atoms.css` lines 210–217 — `.entry-glitch` + `.entry-card` hover pattern
- `worldline-atoms.css` lines 37–38 — `.section-rule-dashed` token
- `docs/design/09-article-entry.md` §layout — dashed section seam rhythm that § worldline continues
- `docs/team/VISION-2026-05-31-search-lineage-console.md` §1.2 L2b — L2b vision lock
- `docs/team/VISION-2026-05-31-search-lineage-console.md` §1.6 — kind glyphs canon

---

## non-goals

- No interactive DAG / drag canvas (console's `<WorldlineCanvas />`; this section is read-only)
- No pagination — render all neighbors flat
- No animated edge drawing — dashed hairline is static
- No NETRA narration here (NETRA is a separate section)
- No edge weight / strength encoding
- No tooltip on kind glyph
- No 2-hop or global view (Phase 2 · MIRAI scope)

---

*end of spec · Betelgeuse (α-VIS-04)*
