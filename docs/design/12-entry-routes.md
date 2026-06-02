# docs/design/12-entry-routes.md
# Shared Entry Shell + Article & Fiction Routes · γ2 promotion · v1.0

> author · Betelgeuse (α-VIS-04) · S2 ship (VISION-2026-05-31 §7)
> precedent · `docs/design/10-photo-entry-d3-ship.md` (D3 — structural frame this surface continues)
> soul baseline · `.claude/visual-diffs/UI-ITER-1-globe-v1/prototype/index.html` RW-5 AMEND-9b locked

---

## intent

`/articles/<slug>` and `/fiction/<slug>` are reading surfaces — calmer than ATLAS, louder than nothing. Instrument layer present but quiet. Prose is the figure.

1. **This is a locus.** File number, date, coords (if shared), status, self-depth prove accumulated existence — not a blog post.
2. **This body has depth.** Articles: § patches (revision history). Fiction: § α variants (possibility horizon).
3. **It connects outward.** § worldline links the entry into its 1-hop neighborhood.

Both kinds share `<EntryShell>` (server). Shell provides page chrome reuse (PageShell · Nav · MarginaliaHUD · ScrollMeter · CornerMarks), header strip, body zone (72ch), § self-depth, § worldline, NETRA L1, prev/next footer.

---

## layout — desktop 1180px

```
┌──────────────────────────────────────────────────────────────────┐
│ scroll-meter · 2px · accent-orange · fixed z-31                  │
├──────────────────────────────────────────────────────────────────┤
│ NAV STRIP (Nav.tsx unchanged · ink-hairline bottom)              │
├──────────────────────────────────────────────────────────────────┤
│ HEADER STRIP  .entry-head  (1px dashed ink-dashed bottom)        │
│   OBSERVATORY · FILE — NNN · YYYY.MM.DD · STATUS · N MIN  ←t-meta│
│   ∇ WORLDLINE · lat°N · lon°E · DRIFT ±N.NN FROM α       ←t-meta│
│   ATTRACTOR FIELDS · <tag> · <tag>                       ←af-pill│
│   ─ ─ (dashed-hairline) ─ ─                                      │
│   NETRA L1 BAY (coords shared only):                             │
│   ◎ NETRA · <slug> · RETICLE lat°N…                              │
│   "voice line — Cormorant italic 12px"              corner-reticle│
├──────────────────────────────────────────────────────────────────┤
│  BODY  max-width 72ch  mx-auto  px-7                             │
│                                                                  │
│  H1 TITLE (Cormorant italic 38px · ink-primary)                 │
│                                                                  │
│  ┌──────────────────────────────────┬──────────────────────────┐ │
│  │ prose (wl-body · mono 13.5px)    │ SIDENOTE · t-mono 11px   │ │
│  └──────────────────────────────────┴──────────────────────────┘ │
│  [pullquote: Cormorant italic 24px · 1px solid accent-orange L]  │
│                                                                  │
├─ dashed-hairline ────────────────────────────────────────────────┤
│  § SELF-DEPTH  (kind-specific — see below)                       │
├─ dashed-hairline ────────────────────────────────────────────────┤
│  § WORLDLINE   (shared — see below)                              │
├─ dashed-hairline ────────────────────────────────────────────────┤
│  ← PREV · FILE NNN            NEXT → FILE NNN · title excerpt    │
└──────────────────────────────────────────────────────────────────┘
│ marginalia · fixed right 28px · dashed left · z-30 · hidden ≤600 │
```

Corner reticles: global via `CornerMarks.tsx` + local `.corner-marks` on `.entry-head` (TL+BR orange L-brackets). Body and self-depth zones: no reticles.

---

## § self-depth — article: patches timeline

Block rendered on `var(--paper-warm)` surface between two dashed-hairlines. Omitted when `patches` is absent or empty.

```
PATCHES  ← t-meta · ink-soft
─ ─ (dashed-hairline)
PATCH 03 · 2026.05.08 — summary      PATCH N: accent-orange via t-meta-accent
PATCH 02 · 2026.04.30 — summary      date: Special Elite (VALUE role)
PATCH 01 · 2026.04.28 — initial      summary: t-mono 11px · ink-soft
```

`<ol reversed aria-label="revision history">`. Newest entry first visually. First-paint stagger: 220ms per row · 60ms delay per item · ease-out. Reduced-motion: instant, no stagger.

## § self-depth — fiction: α variants

Block rendered as a stack of up to 4 diverge-panels. Omitted when `variants` is absent or empty.

```
α VARIANTS  POSSIBILITY HORIZON  ← t-meta · ink-soft
─ ─ (dashed-hairline)
┌── diverge-panel (corner-reticle TL+BR 8×8 orange) ──────────────┐
│  ○ α 1.129801                      ← fic-node + diverge-panel-num│
│  DRIFT +0.00062 FROM SITE α        ← t-meta · Special Elite value│
│  "delta summary — Cormorant italic 13px"     ← VOICE role        │
│  [ENTER BRANCH →]  ← af-pill · only when variants[].slug exists  │
└──────────────────────────────────────────────────────────────────┘
```

`<section aria-label="alternate worldline variants">`. Each panel: `role="group" aria-label="α <value>"`. CTA `<a aria-label="enter α <value> branch">`.

---

## § worldline — shared (both kinds)

Position: after § self-depth, before prev/next. Rendered by `<WorldlineLinks>` (S3 ship). Hidden entirely when both incoming and outgoing are empty.

```
§ WORLDLINE  ← t-meta · ink-soft
─ ─ (dashed-hairline)
OUTGOING             ← t-meta · ink-soft
  ⟶ ◆ ENTRY TITLE   ← arc-node (dimmed) + kind-glyph + entry-glitch hover
     label prose     ← Cormorant italic 12px if label present
─ ─ (inner dashed-hairline, only when both directions present)
INCOMING             ← t-meta · ink-soft
  ◆ ENTRY TITLE      ← arc-node (default) + kind-glyph + entry-glitch hover
     label prose
```

Kind glyphs: `◆` article · `◎` photo · `△` fiction (t-mono 10px · ink-soft). `<nav aria-label="worldline connections">`. Outgoing + incoming: `<ul role="list">`. One direction only → skip the other rule + label.

---

## tokens used

| purpose | token |
|---|---|
| page surface | `var(--paper-base)` |
| header + self-depth panel | `var(--paper-warm)` |
| body prose | `var(--ink-primary)` |
| meta labels | `var(--ink-soft)` (never ink-faint at 9px — P1-6 lesson) |
| separators | `var(--ink-dashed)` · `var(--ink-hairline)` |
| orange (file#, patch#, pullquote, reticle, pill, focus) | `var(--accent-orange)` · `var(--accent-orange-soft)` |
| NETRA | `var(--netra)` · `var(--netra-soft)` |

No raw hex. No new tokens.
## typography

| element | role | family | size |
|---|---|---|---|
| H1 title | VOICE | Cormorant Garamond italic | 38px |
| body prose | — | JetBrains Mono | 13.5px · leading 1.75 |
| pullquote | VOICE | Cormorant Garamond italic | 24px |
| sidenotes | INSTRUMENT | JetBrains Mono uppercase | 11px · 0.22em |
| header strip labels | INSTRUMENT | JetBrains Mono uppercase | 9px · 0.3em |
| coords / file number | VALUE | Special Elite | 9px · 0.04em |
| patch date | VALUE | Special Elite | 11px |
| α value | VALUE | Special Elite | 26px (diverge-panel-num) |
| delta_summary | VOICE | Cormorant Garamond italic | 13px |
| NETRA voice line | VOICE | Cormorant Garamond italic | 12px |
| worldline link title | INSTRUMENT | JetBrains Mono uppercase | 11px · 0.15em |
| worldline link label | VOICE | Cormorant Garamond italic | 12px |

---

## motion

Reading surface — state change only.

| trigger | duration | easing |
|---|---|---|
| page enter | none | — |
| entry-glitch hover underline | 460ms | cubic-bezier(0.2, 0.8, 0.2, 1) |
| attractor pill hover | 150ms | ease |
| patches stagger (first paint only) | 220ms · 60ms delay/row | ease-out |
| `prefers-reduced-motion` | 0.001ms | all suppressed per atom rule |

---

## breakpoints

**≤ 880px:** sidenotes → inline footnotes with `[N]` anchor superscript. Marginalia hidden. Body full-width `px-6`.

**≤ 600px:** header stacks (row 1: FILE · date · STATUS; row 2: coords if shared; row 3: pills). NETRA L1: one-line strip. H1: `clamp(24px, 6vw, 38px)`. Body: `px-4`. Prev/next stacks vertically. Touch targets ≥ 44px.

**≤ 375px:** identical to ≤600px. H1: `clamp(22px, 5.5vw, 28px)`. No horizontal scroll.

---

## accessibility

- Skip link `#entry-main`. Single `<h1>`. § headings: `<h2>` behind t-meta styling.
- Patches: `<ol reversed aria-label="revision history">`.
- § α variants: `<section aria-label="alternate worldline variants">` / each panel `role="group" aria-label="α <value>"`.
- § worldline: `<nav aria-label="worldline connections">` / lists `role="list"`.
- Attractor pills: `<a aria-label="browse <tag> tag">`. CTA: `<a aria-label="enter α <value> branch">`.
- Focus: `outline: 2px solid var(--accent-orange); outline-offset: 2px` · `:focus-visible`.
- Contrast: all t-meta uses `var(--ink-soft)` — 3:1 at 9px on `--paper-base` (P1-6 lesson).

---

## Rule 5 — atoms table

| atom id | used | role |
|---|---|---|
| `paper-canvas` | yes | `<main>` grain + scanlines |
| `paper-warm-surface` | yes | § patches + § α variants panel background |
| `corner-reticle` | yes | `.entry-head` TL+BR L-brackets; global via CornerMarks.tsx |
| `dashed-hairline` | yes | all section separators |
| `section-rule-dashed` | yes | inner separator in § worldline (outgoing / incoming) |
| `type-roles` | yes | VOICE / INSTRUMENT / VALUE per typography table |
| `netra-voice-strip` | yes | NETRA L1 bay (left teal border + voice body) |
| `attractor-pill` (af-pill) | yes | header tag row; `[ENTER BRANCH →]` CTA |
| `entry-glitch` | yes | worldline link hover underline (460ms) |
| `arc-node` | yes | worldline row markers (dimmed outgoing · default incoming) |
| `fic-node` | yes | hollow ring at § α variant card head |
| `diverge-panel` | yes | bounding frame for each § α variant (TL+BR 8×8px reticles) |
| `marginalia` | yes | global via MarginaliaHUD.tsx · hidden ≤600px |
| `paper-mount` | no | photo-entry only; no photo frame on these routes |
| `atlas-alpha-mark` | no | globe canvas only; reading surfaces are calmer |

---

## references

- `docs/design/10-photo-entry-d3-ship.md` — header strip rhythm, NETRA L1, coords privacy gate, paper-warm surface
- `docs/design/09-article-entry.md` v2.0 — patches log, ink-soft at 9px, sidenote collapse, 72ch body
- `docs/design/30-worldline-branching.md` — fic-node, diverge-panel, α VALUE register, delta_summary VOICE
- `components/WorldlineGlobe.tsx` side panel — entry-glitch marching-dash (460ms)

## non-goals

No commenting. No reading-progress bar (scroll-meter). No print stylesheet. No NETRA companion chat — L1 strip only. No "related posts" heuristic — § worldline is manually declared frontmatter (intentional authorship). No animated entry transitions. No social sharing.

---

*end of spec · Betelgeuse (α-VIS-04) · 2026-05-31*
