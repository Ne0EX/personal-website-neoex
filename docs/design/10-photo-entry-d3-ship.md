# docs/design/10-photo-entry-d3-ship.md
# Photo Entry D3 — per-ship production spec

> author · Betelgeuse (α-VIS-04) · TASK-2026-05-30-PHOTO-ENTRY-D3-SHIP
> source design · docs/design/10-photo-entry.md (v2.0, 911-line canonical)
> direction locked · D3 — .claude/visual-diffs/TASK-2026-05-26-PHOTO-PROTOTYPE-FIRST/directions/direction-3/
> this file · focused production-ship subset (≤200 lines); NOT a re-spec of the full surface

**Goal:** ship `/photos/<roll>/<id>` D3 to production composing from the `worldline-design` skill.

---

## atoms used

| atom id | from gallery | role in this surface |
|---|---|---|
| `paper-mount` | new — manifest entry at `paper-mount` (added step 1a, TASK-2026-05-30-PHOTO-ENTRY-D3-SHIP) | frames the photo as a measured mount: 12px `--paper-warm` margin + 1px `--ink-faint` border |
| `netra-console` | yes | NETRA L1 bay (right aside, always-on solid border) |
| `netra-voice-strip` | yes | extends with `(borrowed eye · <sim>)` annotation when palette ≠ base |
| `hud-corner-readout` | yes | not used on this surface directly (page-level chrome from existing layout) |
| `corner-reticle` | yes | page-corner marks via existing layout |
| `type-roles` | yes | Cormorant italic for caption + NETRA voice; mono uppercase for all instrument labels (9px 0.22em); Special Elite for coords/numerals |
| `dashed-hairline` | yes | section seams between grid areas |

---

## layout — three-column grid

```
[data-photo-entry-root][data-palette="base"]
grid: [260px · 1fr · 240px]

LEFT ASIDE (260)                CENTER (1fr)                    RIGHT ASIDE (240)
────────────────────────        ──────────────────────────────  ─────────────────────────
roll slug (t-mono 9px)          paper-mount (atom: paper-mount) EXIF <dl> (tabular-nums)
sequence in roll (t-type)         12px --paper-warm margin        § INSTRUMENT header
"← back to roll" stub link        1px --ink-faint border          CAMERA · LENS
roll narrative excerpt            <img> fills interior            FOCAL · SHUTTER
(italic Cormorant if present)     ambient FILM SIM label below    ISO · GPS coord
                                    (--ink-soft 9px 0.22em)       dashed-hairline
                                                                  NETRA L1 bay (solid)
                                                                  FilmSimSwitcher (4 btns)
```

Root element: `<div data-photo-entry-root data-palette="base">`. Initial `data-palette="base"` = native unstyled image; no CSS rule targets `[data-palette="base"]`.

---

## D4 RESOLVED — opacity-dip timing curve

`body.is-palette-switching` transition:

```css
body.is-palette-switching {
  opacity: 0.75;
  transition: opacity 80ms cubic-bezier(0.4, 0, 0.6, 1);
}
body {
  transition: opacity 80ms cubic-bezier(0.0, 0, 0.2, 1);
}
```

Mechanics (per spec §5 L488 + SHIP-PLAN §3):
- On click: `body.classList.add('is-palette-switching')` → opacity dips to 0.75 in 80ms.
- Apply `data-palette` attr at the nadir (80ms mark via `transitionend`).
- Remove `is-palette-switching` → opacity recovers to 1 in 80ms. Total: ~160ms.
- `setTimeout` fallback at 180ms (80ms + 80ms + ~20ms buffer) to guarantee class removal on interrupt; cancel any in-flight timer on the next click.
- `prefers-reduced-motion: reduce` → skip class add entirely; swap `data-palette` instantly.

---

## 375px RESOLVED — ≤600px covers 375

The D3 prototype breakpoints: 1440 / 1023 / 880 / 600 + reduced-motion. No dedicated 375 rule.

Per canonical spec §7.4 (docs/design/10-photo-entry.md L582–589): the 375–599px range is "identical to 600–880px with same 16px padding — no further reduction. Paper-mount: 12px margin and 1px rule both preserved."

**Resolution:** the `≤600px` single-column collapse covers 375. No new breakpoint. Algol render target at 375: single-column stack (paper-mount full-width / EXIF readout / roll-context / FilmSimSwitcher), same 16px horizontal padding, 12px mount margin preserved.

Single-column order at ≤600px:
1. Header strip (roll slug · date · film sim on row 1; coords row 2 if shared)
2. Paper-mount (full width)
3. Caption (if present)
4. EXIF readout (full width)
5. NETRA L1 bay (full width)
6. FilmSimSwitcher
7. Roll context (prev/next thumbs inline row)

---

## palette CSS — load-bearing mechanics (for Sirius)

File: `components/PhotoEntry.palette.css` — side-effect import (`import './PhotoEntry.palette.css'`) from `PhotoEntry.tsx`. NOT a CSS module (class mangling defeats the global `[data-palette]` selector).

**COMPOUND selectors** — both attributes on the SAME element:

```css
/* Classic Chrome — verbatim from PRD-03 §8.1 */
[data-photo-entry-root][data-palette="classic-chrome"] img {
  filter: sepia(0.18) saturate(0.82) contrast(1.06) brightness(0.97);
}
[data-photo-entry-root][data-palette="classic-chrome"] {
  --paper-base:    #E5DBC8;
  --paper-warm:    #EAE0CD;
  --paper-deep:    #D6C9A6;
  --paper-bright:  #EFE6D2;
  --ink-rgb:       56 75 89;
  --netra-rgb:     94 110 122;
  --accent-orange: #A86B2C;
  --accent-orange-soft: rgba(168, 107, 44, 0.18);
}

/* Acros */
[data-photo-entry-root][data-palette="acros"] img {
  filter: grayscale(1) contrast(1.08) brightness(0.96);
}
[data-photo-entry-root][data-palette="acros"] {
  --paper-base:    #DDDAD3;
  --paper-warm:    #E2DFD7;
  --paper-deep:    #C8C5BC;
  --paper-bright:  #EDE9E0;
  --ink-rgb:       26 24 21;
  --netra-rgb:     60 56 50;
  --accent-orange: #5A5A55;
  --accent-orange-soft: rgba(90, 90, 85, 0.20);
}

/* Reala Ace */
[data-photo-entry-root][data-palette="reala-ace"] img {
  filter: saturate(1.08) contrast(1.04) hue-rotate(2deg);
}
[data-photo-entry-root][data-palette="reala-ace"] {
  --paper-base:    #EAE3D2;
  --paper-warm:    #EFE9D8;
  --paper-deep:    #D9CFB4;
  --paper-bright:  #F2ECDB;
  --ink-rgb:       36 54 80;
  --netra-rgb:     86 100 124;
  --accent-orange: #C75D45;
  --accent-orange-soft: rgba(199, 93, 69, 0.18);
}

/* Velvia */
[data-photo-entry-root][data-palette="velvia"] img {
  filter: saturate(1.35) contrast(1.12) brightness(0.95);
}
[data-photo-entry-root][data-palette="velvia"] {
  --paper-base:    #EAE0CC;
  --paper-warm:    #EFE5D2;
  --paper-deep:    #D9CCAE;
  --paper-bright:  #F2E8D5;
  --ink-rgb:       16 70 91;
  --netra-rgb:     58 110 128;
  --accent-orange: #D24820;
  --accent-orange-soft: rgba(210, 72, 32, 0.20);
}
```

`data-palette="base"` = native unstyled image. No rule targets `[data-palette="base"]`. "Revert to base" = set attr back to `"base"`.

---

## implementation pointers for Sirius

**PhotoEntry.tsx (server)**
- Root: `<div data-photo-entry-root data-palette="base" className="photo-entry-grid">` — 3-col grid `[260px 1fr 240px]`, gap `var(--gap-md)` (32px).
- Left aside 260: roll context (roll slug, sequence label, `← back to roll` stub link to `/photos/<roll>`, roll narrative excerpt).
- Center 1fr: `<div className="paper-mount">` wrapping `<img>` + `<div className="paper-mount-label">` below for FILM SIM label.
- Right aside 240: `<dl>` EXIF with `font-feature-settings: "tnum"` on numeric rows; NETRA L1 `<div className="atlas-netra-voice" data-netra-voice>` (mark with `data-netra-voice` for FilmSimSwitcher DOM targeting); FilmSimSwitcher below.

**FilmSimSwitcher.tsx (client, `'use client'`)**
- `const root = document.querySelector<HTMLElement>('[data-photo-entry-root]'); root.dataset.palette = sim;`
- `const voice = document.querySelector<HTMLElement>('[data-netra-voice]');` — update `.querySelector('.voice-body')` text to append `(borrowed eye · <sim>)` when `sim !== 'base'`; revert on base.
- Opacity-dip: see D4 RESOLVED above.

---

*end of per-ship spec · Betelgeuse (α-VIS-04) · TASK-2026-05-30-PHOTO-ENTRY-D3-SHIP*
