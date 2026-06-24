# SPEC-2026-06-25-article-continuation.md
# Article Entry · Continuation + Orientation Affordances

> author · Betelgeuse (α-VIS-04)
> date · 2026-06-25
> branch · genesis/store-as-source
> status · SPEC COMPLETE · ready for Sirius handoff
> soul baseline · `docs/team/.soul-baseline/visual.md` (SBA-1)
> extends · `docs/design/09-article-entry.md` v2.1 · `docs/design/12-entry-routes.md` v1.0
> data contract · Procyon — worldline_links resolver (1–N next entries; worldline_links-preferred, chronological fallback)
> task origin · usability audit G2 (no back-to-corpus path) + continue affordance request (2026-06-25)

---

## overview

Two surface additions to `/[lang]/articles/[fileNum]`. Both are *read-only
instrument additions* — no new visual vocabulary, no new tokens. Both compose
from atoms already catalogued in `worldline-atoms.css`.

**SPEC 1 — CONTINUE** (§1 below): a "thread continues" affordance at the end of
the article, after § PATCHES, before the footer. One primary entry. Relational,
exploratory — not a blog "next post" button.

**SPEC 2 — ORIENT** (§2 below): a corpus-position readout in the `.entry-head`
header strip. Not a breadcrumb; a locator — `FILE 003 OF 047` — because this is an
observatory, not a file system. Tells the reader where they stand in the surveyed
corpus.

**SIRIUS NOTE — language switch hit target** (§3 below): the EN·TH locale toggle
in `Nav` needs a ≥ 44px effective touch target at `@media (max-width: 768px)` via
`min-height` / padding expansion on the `.ctl-text` locale button, scoped so
desktop keeps the tight instrument density.

---

## soul fidelity

Before writing this spec I applied the acceptance test:

> *"does this still read as Peat — and as a surveyed paper instrument — even if
> his role in the world changed tomorrow?"*

SPEC 1 passes: the CONTINUE affordance reads as a worldline continuation thread
(instrument register), not as a content-recommendation widget. A reader who has
never heard of Peat would still read "the thread continues" as the arc of a survey,
not as algorithmic content.

SPEC 2 passes: `FILE 003 OF 047` is ledger notation. It is how an archivist numbers
folios. It does not describe Peat; it describes the corpus's measured shape.

---

## § 1 — CONTINUE affordance

### 1.1 intent

The reader has finished the entry. The worldline continues; this affordance says
so without announcing it. It is not "you might also like." It is not a grid of
recommended posts. It is the sense that a thread you've been following has another
page, and the instrument offers it to you.

The distinction from **§ WORLDLINE** (WorldlineLinks): § WORLDLINE shows the
declared 1-hop neighborhood — all incoming and outgoing worldline edges from this
entry, which may include entries that came before, after, or sideways. CONTINUE
shows exactly one *forward-directed* next entry: the next thing Procyon has resolved
you should read. Different data, different register. Both are instrument surfaces.

When Procyon returns multiple candidates from the resolver, this spec renders only
the **first** (highest-confidence / worldline-link-first ordering). A grid would
be an exhibition surface; this is an exploration surface.

### 1.2 position in the document

```
[article body — prose, pullquotes, sidenotes]
─ ─ (1px dashed var(--ink-dashed)) ─ ─
§ PATCHES  (var(--paper-warm), existing)
─ ─ (1px dashed var(--ink-dashed)) ─ ─
§ WORLDLINE  (WorldlineLinks, existing)
─ ─ (1px dashed var(--ink-dashed)) ─ ─
§ CONTINUE   ← NEW — spec below
─ ─ (1px dashed var(--ink-dashed)) ─ ─
footer  FILE NNN · WORLDLINE · 1.130426
```

If § WORLDLINE is absent (no links), the section ordering becomes:

```
§ PATCHES (if present)
─ ─
§ CONTINUE (if present)
─ ─
footer
```

The dashed rule above § CONTINUE is always rendered (`.section-rule-dashed`
between adjacent sections). The dashed rule below (before footer) already exists.

### 1.3 layout — desktop (≥ 881px)

```
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  (section-rule-dashed above)

  THE THREAD CONTINUES            [§ CONTINUE section label — LOCKED · vega 2026-06-25]
  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  (inner dashed hairline)

  ◆  FILE — 004  ·  title of next entry                           [→]
     ⟨Vega: short edge annotation, Cormorant italic, if present⟩
     DOMAIN  ·  2026.05.12  ·  REFINED  ·  12 MIN

─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  (section-rule-dashed below, before footer)
```

**Grid columns:**
- Glyph slot: 20px fixed (same as § WORLDLINE kind-glyph slot)
- Content area: flex-grow
- `→` caret: flush right, `var(--ink-soft)`, shifts to `var(--accent-orange)` on
  row hover

**Worldline-link case vs chronological-fallback case:**

No visual differentiation between the two cases at default rest state. The source
of the recommendation is an instrument concern, not a visitor concern. However:

- When the link is a declared **worldline_link** (intentional authorship): the
  edge annotation row renders if the link carries a `label` field (Cormorant italic,
  `var(--ink-soft)`, 12px — same as § WORLDLINE edge label). This annotation is the
  visible trace of intentional connection.
- When the link is a **chronological fallback** (no explicit worldline edge): the
  annotation row is absent. The instrument readout (FILE, title, meta strip) renders
  identically. Silence where no explicit label exists is correct — the connection is
  spatial (time-sequence) not semantic.

The distinction is thus: a worldline-link entry may have one additional line of
Cormorant italic; a fallback entry will not. Neither case announces its own source.
Visitors who notice the difference are attentive; visitors who don't still have the
continuation.

### 1.4 layout — mobile (≤ 600px)

```
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  (section-rule-dashed above)

THE THREAD CONTINUES            [LOCKED · vega 2026-06-25]
─ ─ ─ ─ ─ ─ ─ ─ ─ ─

◆  FILE — 004
   title of next entry                                             →
   DOMAIN  ·  REFINED  ·  12 MIN                (reading time only; date drops)
   ⟨edge annotation if present — wraps⟩

─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
```

- Section label remains on its own line.
- Glyph + FILE num + title on row 1.
- Meta strip on row 2 (domain · status · reading-time; **date drops** at ≤600px,
  per the space-economy rule in § WORLDLINE spec).
- `→` caret shifts to end of title row.
- `min-height: 44px` on the `<a>` row link — touch target.
- At ≤ 375px: same structure; `px-4` padding matches body zone.

### 1.5 empty state

Procyon resolver returns zero entries: § CONTINUE section is absent entirely. No
heading, no empty container, no "nothing more to explore" message. Silence is
correct. The footer still renders immediately after § WORLDLINE (or § PATCHES if
also absent).

### 1.6 tokens

| role | token |
|------|-------|
| section surface | `var(--paper-base)` (inherits from page — no raised panel) |
| section label "THE THREAD CONTINUES" | `var(--ink-soft)` · `.t-meta` · 9px · 0.3em · UPPERCASE |
| inner dashed hairline | `1px dashed var(--ink-dashed)` · `.section-rule-dashed` |
| kind glyph (◆ / ◎ / △) | `var(--ink-soft)` at rest · `var(--ink-primary)` on row hover |
| FILE label + number | `var(--ink-soft)` label · `var(--accent-orange)` number · `.t-meta` + `.acc` |
| entry title | `var(--ink-primary)` · JetBrains Mono 11px · 0.05em tracking |
| caret `→` | `var(--ink-soft)` at rest · `var(--accent-orange)` on row hover |
| meta strip (domain · status · reading-time) | `var(--ink-soft)` · `.t-meta` · 9px |
| date on meta strip (desktop only) | `var(--ink-soft)` · Special Elite `.t-type` 9px |
| edge annotation (worldline-link only) | `var(--ink-soft)` · Cormorant Garamond italic 12px |
| entry-glitch marching-dash on hover | `var(--accent-orange)` repeating segment |
| focus ring | `outline: 2px dashed var(--accent-orange); outline-offset: 2px` |
| section rule above | `1px dashed var(--ink-dashed)` |

**Dark theme:** all tokens above resolve automatically from `[data-theme="dark"]`
— `var(--paper-base)` becomes `#0E171C`, `var(--ink-primary)` becomes cool cream,
`var(--ink-soft)` lifts to the 4.24:1 dark floor, `var(--accent-orange)` brightens
to `#E2743E`. No per-component dark override needed.

### 1.7 typography

| element | family | size | weight | tracking | case |
|---------|--------|------|--------|----------|------|
| section label | JetBrains Mono | 9px | 400 | 0.3em | UPPER |
| FILE label | JetBrains Mono | 9px | 400 | 0.3em | UPPER |
| FILE number | JetBrains Mono | 9px | 500 | 0.26em | UPPER |
| entry title | JetBrains Mono | 11px | 400 | 0.05em | lower |
| caret | JetBrains Mono | 11px | 400 | 0 | — |
| meta strip (domain · status · time) | JetBrains Mono | 9px | 400 | 0.3em | UPPER |
| date on meta strip | Special Elite | 9px | 400 | 0.04em | — |
| edge annotation | Cormorant Garamond italic | 12px | 400 | 0.005em | lower |

### 1.8 motion

| trigger | property | duration | easing |
|---------|----------|----------|--------|
| row hover — entry-glitch marching-dash extends | `width` 0 → 100% | 460ms | `cubic-bezier(0.2, 0.8, 0.2, 1)` |
| row hover — glyph + caret color shift | `color` | 150ms | `ease` |
| section entrance | none | — | reading surface; no entrance animation |
| `prefers-reduced-motion: reduce` | all transitions | 0.001ms | global atom rule |

### 1.9 states

| state | behavior |
|-------|----------|
| default | section rendered with one entry row |
| worldline-link source | edge annotation row rendered if `label` field present |
| chronological-fallback source | no annotation row; meta strip identical |
| empty (zero results) | section absent entirely |
| row hover | entry-glitch underline extends; glyph + caret shift to `--accent-orange` |
| row focus (keyboard) | `2px dashed var(--accent-orange) outline-offset: 2px` |

### 1.10 accessibility

```html
<section aria-label="continue reading">
  <h2 class="t-meta">THE THREAD CONTINUES</h2>
  <!-- inner dashed hairline -->
  <a
    href="/[lang]/articles/[fileNum]"
    aria-label="[kind]: [title] — FILE [fileNum]"
    class="entry-glitch"
    style="min-height: 44px; display: block;"
  >
    <!-- glyph · FILE — NNN · title · meta strip -->
    <!-- edge annotation if present -->
  </a>
</section>
```

- `<section aria-label="continue reading">` — screen reader label describes the
  purpose without revealing the mechanism.
- The `<a>` carries a full `aria-label` that reads naturally:
  `aria-label="article: On the Architecture of Taste — FILE 004"`.
- The kind glyph (◆ ◎ △) has `aria-hidden="true"` — the aria-label conveys kind.
- The caret `→` has `aria-hidden="true"`.
- `<h2>` for the section heading — the article has one `<h1>` (title); all section
  headings below it are `<h2>`, styled to `.t-meta` (9px mono) per existing pattern.
- Tab order: arrives here after § WORLDLINE (or § PATCHES); proceeds to footer.

### 1.11 references

| pattern | established by |
|---------|----------------|
| Entry-glitch marching-dash hover | `worldline-atoms.css` lines 210–217 · `ChapterIndex.tsx` |
| Kind glyphs (◆ ◎ △) | `docs/design/13-worldline-section.md` §kind glyphs |
| Meta strip rhythm (FILE · date · status) | `docs/design/09-article-entry.md` §layout header strip |
| Edge annotation (italic Cormorant) | `docs/design/13-worldline-section.md` §typography |
| Section-rule-dashed atom | `worldline-atoms.css` `.section-rule-dashed` |
| Dashed section seam rhythm | `docs/design/12-entry-routes.md` §layout — all `─ ─` seams |
| 44px touch-target at ≤600px | `docs/design/22-mobile-native-ladder.md` + `docs/design/12-entry-routes.md` §breakpoints |

### 1.12 non-goals

- No grid of multiple next entries.
- No "recommended for you" label or algorithmic framing.
- No thumbnail, no image preview.
- No star/bookmark interaction.
- No NETRA narration on this section (NETRA is a separate L1 bay — not entangled
  with navigation affordances).
- No visual distinction between worldline-link source and chronological-fallback
  that a casual reader would notice (the edge annotation handles the only visible
  difference; source type is not surfaced as a label or icon).

---

## § 2 — ORIENT affordance (corpus position)

### 2.1 decision — why NOT a breadcrumb

A generic `Home > Articles > 001` breadcrumb would import SaaS product navigation
vocabulary into a paper observatory. It would read as a file-system path, not a
worldline locus. It names the route hierarchy, not the reader's position in a
surveyed corpus.

The instrument vocabulary already has a precedent for positional notation:
`α 1.130426` in the footer — a version string that locates this worldline in a
temporal frame. The ARCHIVE surface itself is called a **ledger** in its spec; the
entry is a folio in that ledger.

The correct on-soul pattern is a **folio readout**: `FILE 003 OF 047`. Ledger
notation. An archivist's mark. It tells the reader:

1. Which entry they're holding.
2. How many entries the surveyed corpus has.
3. Implicitly: there is a corpus to return to (links to `/archive`).

This is oriented, contextual, and relational — three things a breadcrumb achieves
via hierarchy. The folio readout achieves all three via corpus-awareness. It does
not name the path; it names the position.

### 2.2 position in the header strip

The folio readout is added to the **right side of row 1** of `.entry-head` — the
same row as `OBSERVATORY · FILE — 003 · date · STATUS · N MIN`. The right side of
that row is currently empty at desktop width. At mobile (≤600px) the row already
stacks; the folio readout joins the stack.

Revised row 1 anatomy:

```
OBSERVATORY · FILE — 003 · 2026.04.12 · REFINED · 8 MIN          003 OF 047
```

- Left side: existing labels (unchanged).
- Right side (flex-end): `003 OF 047` — both numbers in `var(--accent-orange)` ·
  Special Elite `.t-type` 9px; the word `OF` in `var(--ink-soft)` · JetBrains Mono
  9px uppercase · 0.3em tracking.

The folio is a **link** to `/[lang]/archive` with appropriate aria label. The
orange file-number is the strongest visual affordance; the `OF 047` contextualizes
it. The whole three-token sequence is a single `<a>`.

**Soul rationale:** orange is reserved for the observer α + reticles + file
identifiers. The folio readout uses orange for the numbers (file numbers are already
orange in the existing strip — the folio numbers are consistent with that rule).
The `OF` connector uses `ink-soft` to de-emphasize the connector word and let the
numbers speak as instrument values.

### 2.3 layout — desktop (≥ 881px)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ HEADER STRIP (.entry-head · paper-warm-surface · dashed bottom)              │
│                                                                              │
│  OBSERVATORY · FILE — 003 · 2026.04.12 · REFINED · 8 MIN  [→ 003 OF 047]  │
│  ∇ WORLDLINE · 13.76°N · 100.50°E · DRIFT –0.04 FROM α                     │
│  ATTRACTOR FIELDS · coffee · method · narrative                              │
│  ─ ─ ─ ─ ─ ─ ─ ─ (dashed netra separator if NETRA present) ─ ─ ─ ─ ─ ─   │
│  ◎ NETRA | on the architecture of taste… | LOCUS 13.76°N… | FILE 003        │
│  "node resolved. archive coordinates confirmed."          corner-reticle TL+BR│
└──────────────────────────────────────────────────────────────────────────────┘
```

The folio link is flush-right on row 1 via `justify-content: space-between` on
the row flex container. The existing left cluster (`OBSERVATORY · FILE — 003 · …`)
stays unchanged; the folio slot is a new right-side child.

### 2.4 layout — mobile (≤ 600px)

At ≤600px the header strip stacks into rows (per existing spec in
`docs/design/09-article-entry.md §breakpoints`). The folio readout is added as a
**new sub-row** beneath row 1, flush-left with the row 2 content (coordinates
row). It does not wrap into row 1 (that row is already compact at 600px).

```
OBSERVATORY · FILE — 003 · 2026.04.12 · REFINED · 8 MIN
  003 OF 047 →                    ← new sub-row, flush-left, links to /archive
∇ WORLDLINE · 13.76°N · 100.50°E
ATTRACTOR FIELDS · coffee · method
```

At ≤ 375px: identical. `px-4` padding on the strip.

Touch target: the folio link `<a>` has `min-height: 44px; display: flex; align-items: center` at `@media (max-width: 768px)`. At desktop it is inline and tight.

### 2.5 tokens

| role | token |
|------|-------|
| folio numbers (003, 047) | `var(--accent-orange)` · Special Elite `.t-type` 9px |
| connector "OF" | `var(--ink-soft)` · JetBrains Mono 9px · 0.3em · UPPER |
| folio link hover | `var(--ink-primary)` on numbers; `var(--accent-orange)` on connector |
| focus ring | `outline: 2px dashed var(--accent-orange); outline-offset: 2px` |

**Dark theme:** automatic via primitive token swap. `var(--accent-orange)` brightens
to `#E2743E`; `var(--ink-soft)` lifts to 4.24:1 dark floor. No per-component
override.

### 2.6 typography

| element | family | size | weight | tracking | case |
|---------|--------|------|--------|----------|------|
| folio numbers (003, 047) | Special Elite | 9px | 400 | 0.04em | — |
| connector "OF" | JetBrains Mono | 9px | 400 | 0.3em | UPPER |

Both at 9px — matches the existing header-strip row label size (`.t-meta`).

### 2.7 data source

The `OF 047` total comes from Procyon: a count of all published entries in the
articles collection. This is a static build-time value (not fetched at runtime).
Procyon already has the collection; a new exported `articlesCount` constant from
`lib/content` is the correct source. **Procyon SCHEMA NOTE (for Procyon):** expose
`articlesCount: number` from the articles collection build output so `EntryShell`
can receive it as a prop without querying at render time.

### 2.8 states

| state | behavior |
|-------|----------|
| default | `FILE 003 OF 047 →` right-aligned on row 1 (desktop); sub-row (mobile) |
| hover | numbers stay `--accent-orange`; "OF" shifts to `--accent-orange` |
| focus | 2px dashed orange outline |
| total unknown (build error) | folio readout absent; no fallback label. Silence. |
| single-entry corpus (001 OF 001) | renders; no special case |

### 2.9 accessibility

```html
<a
  href="/[lang]/archive"
  aria-label="FILE 003 of 047 — Archive"
  class="folio-locator"
>
  <span aria-hidden="true" class="t-type" style="color: var(--accent-orange)">003</span>
  <span aria-hidden="true" class="t-meta" style="color: var(--ink-soft)"> OF </span>
  <span aria-hidden="true" class="t-type" style="color: var(--accent-orange)">047</span>
</a>
```

- `aria-label` reads as a complete sentence describing both the position and the
  destination.
- Each rendered `<span>` is `aria-hidden` — the label handles SR output.
- The link is in tab order after the header strip's tag pills, before NETRA bay
  (non-interactive).

### 2.10 references

| pattern | established by |
|---------|----------------|
| Orange on file number in header strip | `docs/design/09-article-entry.md` §tokens — "file number, status value: `var(--accent-orange)`" |
| Special Elite `.t-type` for value registers | `app/globals.css` · `worldline-atoms.css` type-roles |
| Row 1 flex header-strip rhythm | `EntryShell.tsx` lines 217–257 |
| Orange restricted to: file numbers, status, pullquote hairline, focus | `docs/design/09-article-entry.md` §reading-mode token discipline |
| Back-to-ATLAS folio link precedent | `docs/design/09-article-entry.md` §navigation transitions "← ATLAS affordance" |

### 2.11 non-goals

- No Home > Articles > 001 hierarchy label.
- No "currently viewing" tooltip or hover popover.
- No animated count-up on the total.
- No prev/next navigation from this element (that is the footer prev/next already
  specified in the existing shell).
- No position indicator for the full corpus including photos and fiction — this
  locator is scoped to articles only (`FILE N OF M` where M = articles count).

---

## § 3 — language switch touch target (Sirius note)

**Scope:** the EN·TH locale toggle in `Nav` (`.ctl-text` variant per spec
`docs/design/80-interactive-states.md`). The toggle is tight at desktop (correct
— instrument density). On mobile (≤ 768px) the effective tap target is below 44px.

**Fix:** add a scoped media query to the Nav component locale button:

```css
@media (max-width: 768px) {
  .locale-toggle {
    min-height: 44px;
    padding-block: 0;          /* let min-height hold; don't add visual padding */
    display: inline-flex;
    align-items: center;
  }
}
```

This is the same approach used for other mobile touch targets in the mobile-native
pass (`docs/design/22-mobile-native-ladder.md`): expand the interactive area
without adding visible padding that changes desktop density. The `min-height` at
≤768px provides the 44px touch target; the `display: inline-flex; align-items:
center` ensures the label stays vertically centred within the larger target. At
≥769px the existing compact style is unchanged.

**Atom citation:** `--ctl-text-*` tokens (interactive-states system, A18). No new
tokens. No visual regression at desktop.

---

## anti-Codex audit

| check | status | evidence |
|-------|--------|----------|
| 1 · reference fidelity | PASS | Both affordances fully specified (layout · tokens · typography · motion · states · breakpoints · a11y). Empty states defined. |
| 2 · token compliance | PASS | Zero raw hex. Zero raw rgba. All values through `var(--)`. Dark theme resolved automatically via primitive swap. |
| 3 · pattern reuse | PASS | Entry-glitch underline: `worldline-atoms.css`. Kind glyphs: `docs/design/13-worldline-section.md`. Folio orange: `docs/design/09-article-entry.md` reading-mode token discipline. No new visual vocabulary invented. |
| 4 · accessibility | PASS | `<section aria-label>` for CONTINUE. Full `aria-label` on `<a>` elements. `aria-hidden` on decorative glyphs. `<h2>` for section headings. Focus rings specified. Contrast: all tokens at or above P1-6 floor. |
| 5 · mobile fidelity | PASS | ≤600px layout specified for both affordances. `min-height: 44px` on interactive rows. Date drops on CONTINUE meta strip (space economy). Folio readout moves to sub-row. No horizontal scroll. ≤375px covered. |
| 6 · motion calibration | PASS | Entry-glitch: 460ms `cubic-bezier(0.2, 0.8, 0.2, 1)` (existing pattern). Hover color shifts: 150ms ease. No entrance animation (reading surface). Reduced-motion: 0.001ms global atom rule. |
| 7 · atom reuse | PASS | `entry-glitch` → `worldline-atoms.css` 210–217. `section-rule-dashed` → `worldline-atoms.css` 37–38. `type-roles` → three families used correctly. `corner-reticle` → global CornerMarks (no reticles on new sections — correct; body/footer zones are not instrumented with reticles per existing spec). |

---

## copy slots for Vega

The following copy slots require Vega:

1. **Section label for § CONTINUE** (instrument register, UPPERCASE, ≤ 4 words):
   LOCKED · `THE THREAD CONTINUES` · vega α-VOX-08 · 2026-06-25
   Renders as `<h2 class="t-meta">THE THREAD CONTINUES</h2>`.
   "continues" is indicative, not imperative — style guide permits.
   "THE" follows definite-article instrument pattern (OBSERVATORY, THE ARCHIVE).
   "THREAD" = worldline/archive register; no cosmological exposition needed.

2. **Edge annotation display** (Cormorant italic, ≤ 12 words, when worldline_links
   link carries a `label` field): this is authored per-entry in frontmatter —
   Vega writes at content-authoring time, not here. Spec defines the container;
   Vega fills it.

3. **Folio link aria-label** (screen reader only — not visible):
   LOCKED · `` `FILE ${fileNum} of ${articlesCount} — Archive` `` · vega α-VOX-08 · 2026-06-25
   Sirius wires: `aria-label={\`FILE ${fileNum} of ${articlesCount} — Archive\`}`
   "of" lowercase: SR convention. "Archive" proper-noun cap, not all-caps (avoids
   letter-spelling in some SR configurations; CSS handles uppercase on visible element).
   "— Archive" names the destination; no verb; no "return to" (assumes prior visit);
   no "entries" (redundant with FILE context).
   Supersedes Betelgeuse draft: "FILE 003 of 047 entries — return to ARCHIVE".

---

## schema needs (for Procyon)

**SCHEMA NEED — Procyon:** expose `articlesCount: number` as a static build-time
export from `lib/content` (or as a prop on the articles collection manifest). The
folio readout `FILE 003 OF 047` depends on this value. It should not be computed
at render time — static generation at build time is correct. Procyon decides the
exact export shape; `EntryShell` receives it as a prop.

---

*betelgeuse · α-VIS-04 · the Red Sentinel*
*2026-06-25 · genesis/store-as-source*
*zero new tokens · zero raw hex · all atoms cited*
*dark theme: automatic via primitive swap, no per-component override*
