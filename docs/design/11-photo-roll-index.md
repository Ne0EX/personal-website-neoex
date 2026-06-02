# docs/design/11-photo-roll-index.md
# Photo Roll Index — `/photos/<roll>` contact sheet

> author · Betelgeuse (α-VIS-04) · S1 · VISION-2026-05-31 §7
> closes · D3 "← back to roll" stub (10-photo-entry-d3-ship.md)

---

## intent

A surveyed contact sheet — the laboratory table after a roll is processed. Not
a gallery. A register of what was captured: frame IDs, dates, captions, in
capture sequence. The observer reads the roll as a survey log, not a grid of
images competing for attention. The D3 back-link lands here; the roll is now
a legible instrument surface, not a 404.

---

## layout decision — RESOLVED: paper-strip grid

**Chosen: paper-strip grid** (not thumbnail bands, not masonry).

Horizontal strips, top-to-bottom capture sequence. ID left / metadata center /
image slot right. Bands would pit images against each other. Masonry destroys
sequence. The strip keeps metadata co-equal with the image.

---

## layout — full desktop (≥881px)

```
┌────────────────────────────────────────────────────────────────────┐
│ ROLL HEADER (paper-warm · section-rule-dashed foot)                │
│  ROLL · {slug}   [t-mono 9px 0.3em]         FRAMES · {n}          │
│  {italic Cormorant lede ≤2 lines — hide entirely if empty}         │
├────────────────────────────────────────────────────────────────────┤
│ CONTACT SHEET <ol> — one strip per frame, id-ascending             │
│ ┌──────────────────────────────────────────────────────────────┐   │
│ │ FRAME STRIP <li><a>  surface: paper-warm · rule-dashed foot  │   │
│ │ grid: [60px · 1fr · 160px]  gap 24px  padding 16px 20px     │   │
│ │  DSCF0002      italic caption ≤2 lines   ┌─────────────────┐ │   │
│ │  2026.05.01    (ink-primary 13.5px)       │  paper-mount    │ │   │
│ │  (t-type 18px) (Cormorant, leading 1.55)  │  160×120px 4:3  │ │   │
│ │  (t-meta date) entry-glitch on hover      └─────────────────┘ │   │
│ └──────────────────────────────────────────────────────────────┘   │
│ (repeat for each frame)                                            │
├────────────────────────────────────────────────────────────────────┤
│ ROLL FOOTER — section-rule solid top · ROLL CLOSED · n FRAMES      │
└────────────────────────────────────────────────────────────────────┘
```

Outer container: `max-width: 900px` centered, `padding: 0 var(--gap-md)` (32px
H). Background `var(--paper-base)`. Corner reticle marks on the outer frame via
`CornerMarks` component (existing production chrome — not re-derived).

**Roll header strip** — `var(--paper-warm)` surface, `section-rule-dashed` foot:
- Row 1: `ROLL · {slug}` (t-mono 9px 0.3em, ink-soft label / ink-primary value)
  + `FRAMES · {n}` right-aligned + date range in t-type (Special Elite, 9px, 0.04em).
- Row 2: roll lede (Cormorant italic 14px, ink-soft, leading 1.55). Hide entirely
  when roll.mdx body is empty — 2026-04-chiang-mai is the known empty case.

**Frame strip** (each `<li>`, wrapped in `<a href="/photos/{roll}/{id}">`):
- ID col (60px): `t-type` Special Elite 18px ink-primary frame ID; date below in
  t-meta 9px ink-soft.
- Meta col (1fr): caption in Cormorant italic 13.5px ink-primary, max 2 lines. No
  caption → render nothing (Vega's domain).
- Image col (160×120px): `paper-mount` atom — 8px `--paper-warm` margin + 1px
  `--ink-faint` border. If `sidecar.variants?.thumb.webp` defined: `<img>`
  (w=160, h=120, object-fit: cover). Else: `div.paper-mount-image` at 4:3,
  `var(--paper-deep)` fill, frame ID centered in t-mono 9px ink-faint.
  Mount label below: `FRAME · {id}` in t-meta 9px ink-soft.
- Hover: strip surface shifts `--paper-warm` → `--paper-bright` (150ms ease);
  caption gains `entry-glitch` underline (460ms marching-dash width expand).
- Entire `<a>` is the interactive target — no nested interactive elements.

**Roll footer** — `1px solid var(--ink-hairline)` top rule; t-mono 9px 0.3em
ink-faint: `ROLL CLOSED · {n} FRAMES · {date-start} — {date-end}`.

---

## atoms used

| atom id | gallery resolved? | role in this surface |
|---|:---:|---|
| `paper-mount` | yes | image slot: 8px --paper-warm margin + 1px --ink-faint border; placeholder when no thumb |
| `corner-reticle` | yes | outer container L-bracket marks (default variant via CornerMarks) |
| `dashed-hairline` | yes | roll-header foot + strip bottom separators (section-rule-dashed); footer top rule (section-rule) |
| `type-roles` | yes | Cormorant italic = caption + lede (voice); JetBrains Mono uppercase = instrument labels; Special Elite = frame ID + date |
| `entry-glitch` | globals.css `.entry-glitch` | caption hover underline — 460ms marching-dash (established in ChapterIndex.tsx) |

No new atoms. `entry-glitch` is cited from `globals.css#.entry-glitch` — the
established entry-card hover vocabulary. No mutation to the gallery.

---

## tokens used

Paper: `--paper-base` (bg) · `--paper-warm` (header + strip + mount margin) ·
`--paper-bright` (strip hover) · `--paper-deep` (placeholder fill).
Ink: `--ink-primary` (frame ID, caption, slug) · `--ink-soft` (lede, date, mount
label, FRAMES) · `--ink-faint` (mount border, footer) · `--ink-hairline` (footer
rule) · `--ink-dashed` (header foot + strip separators).
Accent: `--accent-orange` (corner reticles + glitch underline).
Type: `--font-display` · `--font-mono` · `--font-type` · `--meta-size` (9px) ·
`--meta-tracking` (0.3em). No raw hex.

## typography

Instrument labels (all mono uppercase): JetBrains Mono 9px · ROLL label 0.3em
ink-soft · slug value 0.3em ink-primary · FRAMES label 0.3em ink-soft · frame date
0.22em ink-soft · mount label 0.22em ink-soft · footer 0.3em ink-faint.
Voice (Cormorant italic): roll lede 14px ink-soft · caption 13.5px ink-primary.
Value (Special Elite): date range 9px 0.04em ink-primary · frame ID 18px 0.04em
ink-primary.

---

## motion

- **Strip hover surface:** `--paper-warm` → `--paper-bright`, 150ms ease.
- **Caption glitch:** `entry-glitch::after` width 0 → 100%, 460ms
  `cubic-bezier(0.2, 0.8, 0.2, 1)`, `--accent-orange` marching-dash underline.
- No entrance animations. This is a register page.
- No looping motion. `prefers-reduced-motion: reduce` — global globals.css rule
  collapses all transitions to 0.001ms; no override needed here.

---

## states

| state | behavior |
|---|---|
| default | roll header + ordered strip list + footer as specified |
| hover on strip | surface → `--paper-bright` (150ms); caption glitch underline (460ms) |
| focus on strip | `:focus-visible` outline `2px solid var(--accent-orange)` offset 2px |
| active on strip | opacity 0.85 on click-down (80ms ease) |
| empty roll (0 frames) | hide `<ol>`; render `NO FRAMES RECORDED` in t-mono 9px ink-faint between header and footer |
| missing lede | hide row 2 of roll header entirely |
| no thumb (v1 all frames) | placeholder `div.paper-mount-image` with `--paper-deep` fill + frame ID label; no `<img>` rendered |

---

## breakpoints

| viewport | strip grid | mount | h-padding | notes |
|---|---|---|---|---|
| ≥881px | `60px 1fr 160px` gap 24px | 160×120px, margin 8px | 32px | roll header 2-row; all columns |
| ≤880px | `60px 1fr 120px` gap 16px | 120×90px, margin 6px | 20px | FRAMES count wraps below date range |
| ≤600px | 2-row stack per frame | full-width 4:3, margin 6px | 16px | row 1: ID+date · row 2: caption · mount below |
| ≤375px | same as ≤600px | same | 16px | caption clamps 3 lines (`line-clamp: 3`); no horizontal scroll |

---

## accessibility

- Each strip: `<a href="/photos/{roll}/{id}" aria-label="Frame {id} · {date} · {caption-first-10-words}">`. No caption → `"Frame {id} · {date}"`.
- Roll header: `<header aria-label="Roll {slug}">`.
- Contact sheet: `<ol>` — capture sequence is meaningful order. Each strip is `<li>`.
- Roll footer: `<footer aria-label="Roll summary">`.
- `<img>` alt: `{caption}` if present, else `"Frame {id}, {roll}"`.
- Placeholder div: `role="img" aria-label="No image available for frame {id}"`.
- Skip-to-content: inherited from root layout.
- Focus order: header → strips in DOM order → footer. No custom key handlers.

---

## references

- `ChapterIndex.tsx` — `entry-glitch` hover underline (reuse directly)
- `app/globals.css#.corner-marks` — outer container corner reticles
- `app/globals.css#.section-rule-dashed` — strip separators + roll-header foot
- `app/globals.css#.paper-mount` — image slot atom (D3 ship)
- `docs/design/10-photo-entry-d3-ship.md §layout` — roll-context strip vocabulary continued at page scale

## non-goals

No lightbox · no filmSim switcher · no in-roll search · no masonry · no staggered
entrance · no hover-zoom · no `/photos` all-rolls index (S4) · no invented microcopy.

---

## acceptance criteria (Algol-verifiable)

**AC1** `GET /photos/2026-05-bangkok` = HTTP 200.
**AC2** From `/photos/2026-05-bangkok/DSCF0002`, `a[href$="/photos/2026-05-bangkok"]` navigates to 200.
**AC3** At 1280×900, `ol > li` count = 4 for `2026-05-bangkok`.
**AC4** First `<li>` text includes `DSCF0002`; last includes `DSCF0005` (id-ascending).
**AC5** `/photos/2026-05-bangkok`: italic Cormorant lede visible. `/photos/2026-04-chiang-mai`: no lede element rendered.
**AC6** Every `.paper-mount` contains `.paper-mount-image`. No `<img>` elements (v1 no-thumb state). Count matches frame count.
**AC7** `grep -r '#[0-9a-fA-F]\{3,6\}' app/photos/\[roll\]/` = zero matches in route + co-located CSS.
**AC8** At 375×812, `document.documentElement.scrollWidth <= 375`.
**AC9** At 375×812, every `ol > li > a` bounding-box height ≥ 44px.
**AC10** Keyboard Tab from page top reaches each strip link then footer; `focus-visible` accent-orange outline present on each.
**AC11** `document.querySelector('ol')` exists. Each `li > a` has non-empty `aria-label` containing the frame ID.
**AC12** `GET /photos/2026-04-chiang-mai` = 200. `ol > li` count = 1, text includes `DSCF0001`.

---

*Betelgeuse (α-VIS-04) · S1 · 2026-05-31*
