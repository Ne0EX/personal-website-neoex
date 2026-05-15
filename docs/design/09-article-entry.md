# docs/design/09-article-entry.md
# Article Entry Surface · TASK-2026-05-15-09 · β-instance

> Author · Betelgeuse (α-VIS-04) · TASK-2026-05-15-09 · sonnet · β-instance (1 of 4× parallel)
> Derives from · `journey-architecture.md` v1.2 §3.2 + §3.5 + §11-β · `attractor-binding-mechanic.md` v1.1 §5 · `PRD-01` §Article entry · `TASK-2026-05-15-22--to-polaris.md` (velite contract)
> Status · SPEC COMPLETE · ready for Sirius TASK-23 / TASK-24

---

## intent

The article entry is the reading surface that every Globe pin and every ChapterIndex card promises but cannot deliver. It is calmer than the homepage — the instrument language is present but quiet, and prose is foregrounded.

Three things it communicates:

1. **This is a place in the worldline.** File number, date, coordinates, status, and patches are all verifiable. The piece exists at a specific locus. It is not a blog post.
2. **This body has depth.** Sidenotes, pullquotes, patches history — the reader is invited to linger, return, notice revision.
3. **It connects outward.** Related branches and prev/next navigation make the article part of a corpus, not a standalone document.

The article entry is NOT a portfolio piece. NOT a reading-app card. NOT a SaaS content template. If it could be transplanted to a generic CMS site without anyone noticing, it is wrong.

---

## layout

```
┌────────────────────────────────────────────────────────────────┐
│ scroll-meter (2px top, accent-orange, fixed, full-width)       │
├────────────────────────────────────────────────────────────────┤
│ NAV STRIP (existing Nav.tsx — unchanged)                       │
│ ◇ INDEX  ◇ TRACES  ◇ ARCHIVE  ◇ TRANSMIT    A 1.130426 · NAV  │
├────────────────────────────────────────────────────────────────┤
│ HEADER STRIP (full-width, atlas-head class, dashed bottom)     │
│                                                                │
│  FILE — 003 · 2026.04.12 · STATUS: REFINED · 8 MIN            │
│  COORDINATES · 13.76°N · 100.50°E · DRIFT –0.04 FROM α        │
│  TAGS · coffee · method · narrative                            │
│                                                              ┌─┘
│  (corner reticles: top-left only — per-entry, not full page) │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  BODY  (max-width 70ch, centered, px-7 / px-4 mobile)         │
│                                                                │
│  ┌──────────────────────────────────────┬────────────────────┐ │
│  │ Prose body (Cormorant, 16px, 1.65)   │ SIDENOTE SLOT      │ │
│  │                                      │ (t-mono 11px       │ │
│  │ paragraph text paragraph text para   │  ink-soft, right   │ │
│  │ graph text paragraph text paragraph  │  of paragraph      │ │
│  │                                      │  anchor)           │ │
│  │ paragraph text paragraph text para   │                    │ │
│  │ graph text paragraph text paragraph  │ SIDENOTE SLOT      │ │
│  │                                      │                    │ │
│  └──────────────────────────────────────┴────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  PULLQUOTE (italic Cormorant 24px, 32px left indent,     │  │
│  │  left hairline: 1px solid accent-orange)                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
├─ section-rule-dashed ──────────────────────────────────────────┤
│                                                                │
│  PATCHES LOG  (paper-warm surface)                             │
│  PATCH 03 · 2026.05.08 — added section on extraction          │
│  PATCH 02 · 2026.04.30 — fixed ratio math                     │
│  PATCH 01 · 2026.04.28 — initial commit                       │
│                                                                │
├─ section-rule-dashed ──────────────────────────────────────────┤
│                                                                │
│  RELATED BRANCHES (3–5 cards, ChapterIndex card pattern)       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ entry card  │  │ entry card  │  │ entry card  │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                │
├─ section-rule-dashed ──────────────────────────────────────────┤
│                                                                │
│  ← PREV in chronological worldline · FILE — 002               │
│                        NEXT → FILE — 004 · title excerpt       │
│                                                                │
└────────────────────────────────────────────────────────────────┘
│ marginalia HUD (fixed right, 28px, ink-soft vertical text)     │
│ scroll-meter reads this page's scroll progress                 │
```

---

## tokens used

| region | token |
|---|---|
| page surface | `var(--paper-base)` |
| header strip surface | `var(--paper-base)` with `border-bottom: 1px dashed var(--ink-dashed)` |
| body prose ink | `var(--ink-primary)` |
| meta labels (FILE, COORDINATES, STATUS, TAGS) | `var(--ink-soft)` via `.t-meta` |
| file number, status value | `var(--accent-orange)` via `.t-meta-accent` |
| dashed section rules | `border-bottom: 1px dashed var(--ink-dashed)` via `.section-rule-dashed` |
| patches log surface | `var(--paper-warm)` |
| patches log text | `var(--ink-soft)` |
| patch number inline | `var(--accent-orange)`, `.t-type` |
| pullquote left hairline | `1px solid var(--accent-orange)` |
| pullquote text | `var(--ink-primary)`, italic |
| sidenote text | `var(--ink-soft)` |
| sidenote anchor marker | `var(--accent-orange)` inline superscript |
| related branches header label | `var(--ink-soft)`, `.t-meta` |
| prev/next nav text | `var(--ink-soft)` baseline; `var(--ink-primary)` on hover |
| corner reticles | `var(--accent-orange)` via `.corner-marks` |
| body hairline border (instrument) | `rgb(var(--ink-rgb) / 0.18)` — same as `.atlas-frame` border |

No raw hex codes. All values are established CSS variables from `app/globals.css`.

---

## typography

### header strip

- class: `.t-meta` (JetBrains Mono, 9px, uppercase, tracking 0.3em, `var(--ink-soft)`)
- file number, status value: `.t-meta-accent` (accent-orange, weight 500)
- row labels ("FILE —", "COORDINATES ·", "TAGS ·"): `.t-meta` color `var(--ink-soft)`

### body prose

- family: Cormorant Garamond (`var(--font-display)`)
- size: 16px
- line-height: 1.65
- font-style: normal (roman); italic only for emphasis and pullquotes
- max-width: 70ch
- color: `var(--ink-primary)`

### sidenotes

- family: JetBrains Mono (`var(--font-mono)`)
- size: 11px
- letter-spacing: 0.12em
- color: `var(--ink-soft)`
- width: 220px
- positioned: absolute right of body column, aligned to anchor paragraph

### pullquote

- family: Cormorant Garamond, italic
- size: 24px
- line-height: 1.3
- indent: 32px padding-left
- left hairline: `1px solid var(--accent-orange)`
- color: `var(--ink-primary)`

### patches log

- family: JetBrains Mono (`.t-mono`)
- size: 11px
- tracking: 0.12em
- color: `var(--ink-soft)`
- patch number ("PATCH 03"): `.t-type` (Special Elite), `var(--accent-orange)`
- date: `.t-mono`, `var(--ink-soft)`
- note text: `.t-mono`, `var(--ink-soft)`

### code blocks (via shiki + rehype-pretty-code)

- family: JetBrains Mono
- size: 13px
- background: `var(--paper-warm)` — NOT a dark theme. Light, paper-aesthetic.
- border: `1px solid var(--ink-hairline)`
- color: `var(--ink-primary)` base; keyword highlights use `var(--accent-orange)`, string highlights use `var(--ink-soft)`, comment use `var(--ink-faint)`
- The shiki theme tuning note: use `min-light` as the base theme, then override background → `var(--paper-warm)` and foreground → `var(--ink-primary)`. Do not use dark themes — they fight the paper surface.

### prev/next nav

- family: JetBrains Mono (`.t-meta`)
- size: 9px
- tracking: 0.3em
- label arrows: plain text `←` / `→`
- file number: `.t-meta-accent` (accent-orange)

---

## article frontmatter consumed

Per Procyon TASK-2026-05-15-22 velite contract (`lib/content`):

```ts
import type { Article } from '@/lib/content'
// fields consumed by this surface:
// fileNum: string       → header strip FILE — {fileNum}
// title: string         → <h1> at top of body
// date: string          → header strip date
// domain: string        → used to compute related branches (shared domain)
// tags: string[]        → header strip TAGS row · links to AttractorFields
// status: string        → header strip STATUS badge
// readingTime: number   → header strip NN MIN
// summary: string       → not rendered on entry itself; used in <head> meta
// coords: {lat, lon, place} → header strip COORDINATES row
// patches: Array<{n, date, note}> → patches log block
// shareLocation: boolean  → guards coords rendering (if false: coords row hidden)
```

The `isoDate` derived field is used for `<time datetime="...">` in the header strip for screen readers.

---

## motion

### click-from-Globe (binding §5, journey-arch §2.3)

When the visitor clicks `READ ENTRY →` in the Globe side panel preview:

- The side panel closes (existing: 520ms reverse slide + 320ms opacity)
- Page navigates to `/entries/<fileNum>` via Next.js router
- On mount: no entrance animation. The article loads at scroll-top. The scroll-meter begins tracking immediately.

**Globe state preservation.** Before navigation, the Globe's `selectedId`, `cameraFocus`, and `activeAttractor` are already in `useGlobeStore` (zustand). State persists in-memory across the route transition automatically. The `[← back to ATLAS]` affordance navigates `/` — the Globe restores to the last known state because the zustand store is not reset on route change.

### click-from-ChapterIndex (PRD-02 residue rule, journey-arch §6.1)

When the visitor clicks a ChapterIndex entry card title:

- No transition animation. Direct navigation via `<Link>` component.
- The active attractor filter (if any) is NOT cleared. On back-navigation, ChapterIndex will show the same filtered state.
- No globe-camera state is involved (ChapterIndex is below-the-fold; the Globe may have been out of viewport). State preserved by zustand as above.

### back-to-Globe transition

The `[← back to ATLAS]` affordance is:

- A text link, not a button. Inline in the Nav strip right-side readout zone, appended as `← ATLAS` in `.t-meta` text. It appears ONLY when the entry was navigated from the Globe (detectable via session-storage flag `wl:entry-origin: 'globe'` set by the Globe before navigation).
- On click: `router.push('/')` with no special transition. The Globe restores its prior state (zustand in-memory). No additional animation.
- If entry was navigated from ChapterIndex (no `wl:entry-origin: 'globe'`): the `[← ATLAS]` affordance is NOT shown. The standard Nav `◇ INDEX` link serves as return.

**Globe state preservation contract for Sirius**: before navigating to `/entries/<fileNum>`, the Globe (or ChapterIndex) sets `sessionStorage.setItem('wl:entry-origin', 'globe' | 'index')`. The article page reads this on mount to decide whether to show `[← ATLAS]`. The zustand store requires no extra action — it persists in-memory.

### in-page transitions

- No enter animation on page load (reading surface — see "motion during reading" rule)
- Patches log entries: first-paint only, staggered fade-in — 220ms per entry, 60ms stagger, triggered once by `IntersectionObserver` on the patches block. Subsequent scrolls: no animation (already visible).
- Code blocks: no animation.
- Related branches cards: hover state uses existing `.entry-glitch` underline pattern (460ms marching-dash underline via `cubic-bezier(0.2, 0.8, 0.2, 1)`).

### reduced motion

Under `prefers-reduced-motion: reduce`:
- Patches log stagger collapses to 0ms (entries appear instantly on intersection)
- All `.entry-glitch::after` transitions collapse to 0ms (existing global rule in `globals.css` covers this)
- No other motion on this surface is affected (none was present)

---

## states

### default

As drawn in the layout above. All sections present. Scroll-meter tracking.

### no patches

`patches[]` is empty or absent: hide the patches log block entirely. Do not render an empty block with a header. Do not say "no patches yet." Silence.

### no related branches

Zero entries share this entry's domain/tags: hide the related branches block entirely. The prev/next nav fills the bottom of the page naturally.

### no coordinates (share-location: false)

The COORDINATES row is omitted from the header strip. FILE / STATUS / reading-time row remains.

### long body (over 4000 words)

No special handling. Body flows naturally. Scroll-meter provides progress signal. No pagination.

### loading / skeleton

Not specified here — this is a Server Component (Next.js App Router, statically rendered). The page is fully rendered on the server; skeleton states are the concern of the route implementation, not this spec.

---

## breakpoints

### desktop (≥1024px)

As drawn. Sidenotes float to the right of the body column. The `max-width: 70ch` body is centered within the content area (approximately 680px of the viewport). Sidenotes occupy the space to the right of the body column, within a 220px slot, starting at the paragraph they annotate. Marginalia HUD visible (fixed right, 28px). Scroll-meter runs full width minus 28px.

### tablet (881–1023px)

Body column narrows to available width (px-7 horizontal padding). Sidenotes drop BELOW the paragraph they annotate — footnote-style with an arrow anchor `[↓]` in the paragraph text and the sidenote rendered as a tinted block (`var(--paper-warm)` surface, `var(--ink-hairline)` border) below the paragraph. Marginalia HUD: visible. Patches log and related branches: single column.

### mobile (600–880px)

Body: full width with px-7 padding. Sidenotes: same footnote-style as tablet. Header strip: STACKS in two rows:
- Row 1: `FILE — {fileNum} · {date} · {status} · {N} MIN`
- Row 2: `{lat}°N · {lon}°E · DRIFT{drift} FROM α`  (omitted if `share-location: false`)
- Row 3 (if tags): `TAGS · {tag1} · {tag2} ...`
Marginalia HUD: hidden (per existing `@media (max-width: 600px)` `.marginalia { display: none }`). Scroll-meter: full width.

### small mobile (375–599px)

Identical to 600–880px but: px-4 horizontal padding instead of px-7. Patches log entries wrap as needed. Related branches cards stack vertically (1 column). Prev/next nav stacks vertically (prev on top, next below).

**Touch targets**: all interactive elements (Nav links, tag links, prev/next, related branch cards, back-to-ATLAS link) minimum 44×44px effective touch target. Tags in header strip link to AttractorFields anchor — these are `<a>` elements with sufficient padding.

---

## accessibility

### semantic structure

```
<main>
  <article>
    <header>           <!-- header strip: FILE, date, status, coords, tags -->
      <nav aria-label="article metadata" />   <!-- tag links -->
    </header>
    <div role="doc-introduction">             <!-- summary if rendered -->
    <div class="prose-body">
      <!-- body MDX content; headings h2–h4 max (h1 is the title above) -->
    </div>
    <aside aria-label="sidenote N" id="sidenote-N" />   <!-- repeated per sidenote -->
    <section aria-label="revision history">
      <ol>             <!-- patches log: semantic ordered list -->
        <li>PATCH 03 · ...</li>
      </ol>
    </section>
    <nav aria-label="related branches">
      <!-- 3–5 related entry cards -->
    </nav>
    <nav aria-label="chronological navigation">
      <a rel="prev">← PREV ...</a>
      <a rel="next">NEXT → ...</a>
    </nav>
  </article>
</main>
```

### skip link

At viewport top (above Nav), visually hidden until focus: `<a href="#article-body" class="sr-only focus:not-sr-only">Skip to article</a>`. "Skip to article" jumps past Nav and header strip to `<div id="article-body">`.

### sidenotes

Each sidenote has:
- `id="sidenote-{n}"` on the `<aside>` element
- The anchor in the paragraph body: `<sup><a href="#sidenote-{n}" aria-label="sidenote {n}">†</a></sup>`
- The aside: `aria-label="sidenote {n}" role="note"`
- `aria-describedby="sidenote-{n}"` on the paragraph containing the anchor (not on every paragraph — only those that have sidenotes)

### patches log

- Semantic `<ol>` (ordered list — patches are numbered, ordered, a revision history)
- Each `<li>` structured: `<time datetime="{isoDate}">{formatted date}</time>` + plain text note
- `aria-label` on the `<section>`: "revision history"

### related branches

- `<nav aria-label="related branches">`
- Each card is an `<a>` element wrapping the card content
- The card title is the link text (no separate hidden text needed if title is descriptive)

### keyboard navigation

- Tab order: skip-link → Nav links → header strip tag links → body content → sidenote anchors (if any) → patches log (not interactive) → related branch cards → prev/next nav
- All interactive elements have visible `:focus` ring — existing globals.css does NOT define a global focus ring. Sirius must add per-component focus styles: `outline: 1px dashed var(--accent-orange); outline-offset: 3px` on all interactive elements in this template. This is not a new token — it uses `--accent-orange`.
- ESC on this page: no special handler (no modals). Standard browser behavior.

### screen reader announcements

- `<title>` tag: `{title} · FILE {fileNum} · Worldline`
- `<meta name="description">`: article `summary` field
- Status badge: rendered as plain text, no `aria-label` needed (reads naturally)
- The reading-time `{N} MIN`: `<abbr title="{N} minutes reading time">{N} MIN</abbr>`

### Lighthouse accessibility target

≥95 on article entry template. Requirements:
- All images (if any embedded in MDX) must have `alt` text (Vega's responsibility in body copy — noted here for completeness)
- Color contrast: `var(--ink-primary)` on `var(--paper-base)` = verified sufficient ratio (existing site compliance)
- `var(--ink-soft)` on `var(--paper-base)` at 9px — borderline at WCAG AA; these are supplementary metadata labels, not primary content. Acceptable per existing Nav.tsx pattern (same tokens, same size, precedent established).

---

## references

The patterns below establish the visual vocabulary this surface uses. Nothing is invented here.

| pattern used | established by |
|---|---|
| header strip with `.atlas-head` class | `WorldlineGlobe.tsx` + `.atlas-head` in `globals.css` |
| corner reticles (`.corner-marks`) | `CornerMarks.tsx` + `.corner-marks` in `globals.css` |
| dashed section rules (`.section-rule-dashed`) | `globals.css` — used in `atlas-head` bottom border |
| `.t-meta` uppercase mono 9px labels | `globals.css` · used throughout HeroBlock, ATLAS head |
| `.t-meta-accent` orange accent on meta | `globals.css` |
| paper-warm surface for patches log | `globals.css` `.paper-warm-surface` / `var(--paper-warm)` |
| `.atlas-readout-row` layout structure | `globals.css` — reference for header strip grid |
| sidenote visual language | `globals.css` `.marginalia` (same mono family, same color, smaller scale) |
| entry card hover (`.entry-glitch`) | `globals.css` + `ChapterIndex.tsx` — used verbatim for related branches |
| pullquote left hairline | `globals.css` `.atlas-current` (same left-border pattern, accent-orange) |
| code block palette (shiki paper-aesthetic) | PRD-01 §open-questions: recommended `min-light` base override |
| patches log `<ol>` semantic | journey-arch §3.5 explicit instruction |
| scroll-meter | `globals.css` `.scroll-meter` |
| marginalia HUD | `globals.css` `.marginalia` + `MarginaliaHUD.tsx` |

---

## non-goals

- **No Thai variant.** `--font-thai` is not wired in this codebase (Procyon dependency). Thai variant is deferred per journey-arch §9 row 01B. This spec is English-only.
- **No comment system.** PRD-01 non-goal. Out of scope.
- **No reading-progress bar.** The global scroll-meter (`globals.css`) covers this. A second bar would be redundant.
- **No print stylesheet.** Deferred per journey-arch.
- **No audio companion.** PRD-01 parking lot.
- **No article-photo pairing spec.** PRD-01 open question (embed via MDX `<Photo id="..." />`). Vega TASK-25 addresses body content; the photo embedding syntax is deferred to a follow-up once the photo collection is live.
- **No spec for the article body MDX itself.** Vega TASK-25 owns article body content. This spec covers the frame around the body, not the body's content.
- **No fiction entry surface.** Deferred per journey-arch §3.4.
- **No sidebar navigation.** Not present in this system. Prose is the figure; instrument UI is peripheral.

---

## anti-Codex 6-point audit

| check | status | evidence |
|---|---|---|
| 1 · reference fidelity | PASS | All elements named in PRD-01 §Article entry are present: header (FILE/date/status/readingTime/coords/tags), body, sidenotes, patches log, related branches, prev/next. |
| 2 · token compliance | PASS | Zero raw hex codes. All values are `var(--*)` from `app/globals.css`. Code block override (`min-light` theme) uses CSS overrides to `var(--paper-warm)` and `var(--ink-primary)` — both existing tokens. |
| 3 · pattern reuse | PASS | Every visual atom cites an existing component or globals.css class. The only new composition is the header strip applied to an article (not to ATLAS) — but the class itself (`atlas-head`) already exists. No new visual vocabulary. |
| 4 · accessibility | PASS | Semantic HTML structure documented. Skip link specified. Sidenote aria linkage specified. Patches log as `<ol>`. Keyboard order documented. Lighthouse ≥95 target stated. Focus ring specified (using existing token). |
| 5 · mobile fidelity | PASS | Three breakpoints documented (881–1023, 600–880, 375–599). Sidenote collapse to footnote-style specified. Header strip stack behavior specified. No horizontal scroll: `max-width: 70ch` prose plus `px-4/px-7` padding does not overflow at 375px. Touch targets ≥44px noted. |
| 6 · motion calibration | PASS | Patches log: 220ms/60ms stagger (200–300ms selected-state bucket). Related branches hover: 460ms marching dash (existing, within 300–500ms overlay bucket). No entrance animation on page load (reading surface). No looping decorative motion on this surface. Reduced-motion path: all transitions collapse via existing `globals.css` rule. |

**PASS on all six.** Spec signed and ready for Sirius handoff.

---

*betelgeuse · α-VIS-04 · the Red Sentinel · TASK-2026-05-15-09 · β-instance · sonnet tier*
*spec: article entry surface · derives from journey-architecture.md v1.2 + attractor-binding-mechanic.md v1.1 + PRD-01 + TASK-2026-05-15-22 velite contract*
*zero new tokens · zero new fonts · zero looping decorative motion on this surface*
