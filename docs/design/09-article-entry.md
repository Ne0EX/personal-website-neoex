# docs/design/09-article-entry.md
# Article Entry Surface · v2.0

> Author · Betelgeuse (α-VIS-04)
> Tasks · v1.0: TASK-2026-05-15-09 · v2.0: TASK-2026-05-17-ARTICLE-REFINE
> Status · SPEC COMPLETE v2.0 · ready for Sirius handoff (post iter 1 lock)
> Soul baseline · `.claude/visual-diffs/UI-ITER-1-globe-v1/prototype/index.html` (RW-5 AMEND-9b locked)

---

## changelog v1.0 → v2.0

| section | verdict | rationale |
|---|---|---|
| intent | KEEP | three-point statement holds; "dossier not blog post" remains the load-bearing frame (SBA-2 T3) |
| layout | REFINE | header strip rhythm tightened to match iter 1 frame-head; NETRA L1 bay added at header foot; marginalia HUD spec added |
| tokens used | REFINE | audited against iter 1 `--ink-*` ladder discipline; corrected body hairline token; `rgb(var(--ink-rgb)/0.22)` replaces raw 0.18; no raw rgba anywhere |
| typography | REFINE | reading-mode token reduction articulated; `--ink-faint` upgraded to `--ink-soft` on meta labels per P1-6 contrast lesson |
| article frontmatter | KEEP | Procyon contract unchanged |
| motion | REFINE | hover 460ms marching dash retained (per-component, within range); page-enter stays silent; patches log stagger re-examined; 150ms hover / 250ms selected terminology adopted |
| states | REFINE | NETRA L1 state variants added (coord present / no coord / reading scroll depth) |
| breakpoints | REFINE | ≤600 sidenote treatment now explicit (inline collapse with anchor, not hide); touch targets verified at 44px; NETRA L1 at ≤600 specified |
| accessibility | RE-WRITE | v1 had correct structure but incomplete a11y; iter 1 P2-10 focus ring vocabulary adopted; contrast notes corrected per P1-6 ink-ladder lesson; keyboard map added |
| references | REFINE | iter 1 prototype section/line citations added throughout |
| non-goals | KEEP | unchanged |
| anti-Codex audit | REFINE | re-run against v2.0 spec |
| NEW — NETRA L1 binding | NEW | article-entry NETRA L1 instrument-bay spec (soul-cited decisions) |
| NEW — vision fidelity block | NEW | required per VISION-FIDELITY §5 |
| NEW — loss budget | NEW | required per VISION-FIDELITY §6 |

**New tokens added:** none. All color, type, and spacing through existing `app/globals.css` variables.

---

## vision fidelity

```text
soul baseline      · `.claude/visual-diffs/UI-ITER-1-globe-v1/prototype/index.html`
                     RW-5 AMEND-9b locked · iter 1 canonical · teal palette active
                     `docs/team/.soul-baseline/visual.md` (SBA-1) · `visual.md §1.6 atlas-frame vocabulary`
                     `docs/team/.soul-baseline/voice.md` (SBA-2) · `voice.md §3 vega-protected patterns`
aesthetic invariants · I1 (garden under measurement — article has file number, coords, status, patches)
                       I3 (Peat in the instrument layer — NETRA L1 reflects article locus, not biography)
                       I5 (quality visible — reading surface must feel calmer than ATLAS, not thinner)
Peat signal        · "REFINE จากตรงนั้นก่อน" (2026-05-16) + token-compliance lesson from iter-1 review
allowed evolution  · NETRA L1 carryover to article surface · post-iter-1 ink-ladder discipline ·
                     mobile sidenote collapse (inline, not hide) · reading-mode alpha-down discipline
forbidden dilution · raw color values anywhere outside globals.css ·
                     ink-faint on any label that functions (use ink-soft per P1-6) ·
                     article as "blog post" framing or generic CMS layout ·
                     NETRA appearing as chat widget on article surface (L1 only; no companion register here) ·
                     looping decorative motion on reading surface
rendered checkpoint · desktop 1180px (full layout with sidenotes + NETRA L1 bay) ·
                      tablet 880px (single column, sidenotes as footnotes) ·
                      mobile 600px (header strip stacked, sidenotes inline) ·
                      375px (same as 600 but px-4 padding, vertically stacked patches + related)
```

---

## loss budget

**Acceptable loss on article surface:**
- Three-column ATLAS layout (article is a reading surface, not an observatory)
- DivergenceMeter band (hero band does not repeat on inner pages)
- Globe / WebGL (not relevant to article surface)
- NETRA jump button (NEXT NODE is meaningless — visitor is already at the node)
- Decorative stratum count readouts

**Unacceptable loss:**
- File number, date, status, coordinates header (these establish the article as a worldline locus, not a blog post)
- Corner reticles on header strip (I1 — the article is a surveyed place)
- Patches log (I1 — content is accumulated, not published-and-static)
- The instrument register on metadata (`.t-meta` 9px, `var(--ink-soft)`, uppercase, tracking 0.3em)
- NETRA L1 when article has GPS coords (I3 — Peat present in instrument layer)

**Compensation at ≤600px:**
- Sidenotes collapse inline (same information, different position)
- NETRA L1 collapses to one-line strip (still present, instrument vocabulary maintained)
- Header strip stacks to three rows (all data retained, just rearranged)

---

## intent

The article entry is the reading surface that every Globe pin and every ChapterIndex card promises but cannot deliver. It is calmer than the ATLAS frame — the instrument language is present but quiet, and prose is foregrounded.

Three things it communicates:

1. **This is a place in the worldline.** File number, date, coordinates, status, and patches are all verifiable. The piece exists at a specific locus. It is not a blog post.
2. **This body has depth.** Sidenotes, pullquotes, patches history — the reader is invited to linger, return, notice revision.
3. **It connects outward.** Related branches and prev/next navigation make the article part of a corpus, not a standalone document.

The article entry is NOT a portfolio piece. NOT a reading-app card. NOT a SaaS content template. If it could be transplanted to a generic CMS site without anyone noticing, it is wrong.

---

## layout

```
┌────────────────────────────────────────────────────────────────┐
│ scroll-meter (2px top, accent-orange fill, fixed)              │
├────────────────────────────────────────────────────────────────┤
│ NAV STRIP (Nav.tsx — unchanged · ink-hairline bottom)          │
│ ◇ INDEX  ◇ TRACES  ◇ ARCHIVE  ◇ TRANSMIT   α 1.130426 · NAV  │
├────────────────────────────────────────────────────────────────┤
│ HEADER STRIP (.article-head · mirrors .frame-head vocabulary)  │
│                                                                │
│  OBSERVATORY · FILE — 003 · 2026.04.12 · REFINED · 8 MIN      │
│  ∇ WORLDLINE · 13.76°N · 100.50°E · DRIFT –0.04 FROM α       │
│  ATTRACTOR FIELDS · coffee · method · narrative               │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ (1px dashed var(--ink-dashed)) ─ ─ ─ ─ ─ │
│  NETRA L1 BAY (if coords present):                             │
│  ◎ NETRA · [article title truncated] · RETICLE 13.76°N…       │
│  "[voice line — Cormorant italic 12px, ink-primary]"          │
│                                              ┌─ corner-mark ─┘│
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  BODY  (max-width 70ch, centered, px-7 / px-4 mobile)         │
│                                                                │
│  ┌──────────────────────────────────────┬────────────────────┐ │
│  │ H1 TITLE                             │                    │ │
│  │ (Cormorant 38px italic, ink-primary) │ SIDENOTE SLOT      │ │
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
│  │  left hairline: 1px solid var(--accent-orange))          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
├─ 1px dashed var(--ink-dashed) ─────────────────────────────────┤
│                                                                │
│  PATCHES LOG  (.paper-warm-surface · var(--paper-warm))        │
│  PATCH 03 · 2026.05.08 — added section on extraction          │
│  PATCH 02 · 2026.04.30 — fixed ratio math                     │
│  PATCH 01 · 2026.04.28 — initial commit                       │
│                                                                │
├─ 1px dashed var(--ink-dashed) ─────────────────────────────────┤
│                                                                │
│  RELATED BRANCHES (3–5 cards, entry-card pattern)              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ entry card  │  │ entry card  │  │ entry card  │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                │
├─ 1px dashed var(--ink-dashed) ─────────────────────────────────┤
│                                                                │
│  ← PREV in chronological worldline · FILE — 002               │
│                        NEXT → FILE — 004 · title excerpt       │
│                                                                │
└────────────────────────────────────────────────────────────────┘
│ marginalia HUD (fixed right 28px, ink-soft, vertical writing)  │
│ 1px dashed left border, ruled background (var(--ink-rgb)/0.05) │
│ hidden at ≤600px                                               │
```

**Corner reticles:** top-left and bottom-right of the `.article-head` block only (12×12px L-brackets, 1px solid `var(--accent-orange)`). Established by `CornerMarks.tsx` + `.corner-marks` in globals.css. Not on the body zone — prose is the figure there.

**Frame-head vocabulary citation:** prototype line 469–476 (`.frame-head`) shows the exact rhythm. Left side: `OBSERVATORY · WORLDLINE STRUCTURE v.08 · ∇ Ne0EX · 3D ORTHOGRAPHIC`. Right side: `α 1.130426 · NAV NETRA`. The article header mirrors this left/right split with article-specific atoms: left = content identity (observatory label · file · date · status · time), right = navigation state (α version · return affordance). The label vocabulary is the same family.

---

## reading-mode token discipline (NEW — iter 1 lesson)

The article surface is calmer than ATLAS. This is not achieved by stripping instrument vocabulary — it is achieved by stepping alpha down one notch and restricting orange to singular moments.

| surface | ATLAS equivalent | article equivalent | rationale |
|---|---|---|---|
| page background | `var(--paper-base)` | `var(--paper-base)` | same — no change |
| body prose ink | `var(--ink-primary)` | `var(--ink-primary)` | prose at full strength |
| meta labels | `var(--ink-soft)` | `var(--ink-soft)` | P1-6 lesson: `--ink-faint` is below 3:1 contrast at 9px — use `--ink-soft` throughout |
| instrument labels (NETRA bay) | `var(--netra)` | `var(--netra)` | NETRA color identity preserved |
| orange usage | constant (active strata, reticles, αmarks, button borders) | restricted to: file numbers, status values, pullquote hairline, sidenote anchors, focus rings | orange on a reading surface should feel like a document stamp, not a UI state indicator |
| dashed borders | `var(--ink-dashed)` | `var(--ink-dashed)` | same token, same weight |
| patches log surface | `var(--paper-warm)` | `var(--paper-warm)` | confirmed present in globals.css line 20 |
| body hairline border | `rgb(var(--ink-rgb) / 0.22)` | `rgb(var(--ink-rgb) / 0.22)` | corrected from v1's 0.18 (v1 cited `.atlas-frame` border; prototype line 413 shows 0.18 on `.atlas-frame` body, but the `.artifact` container at prototype line 453 uses `1px solid var(--ink-hairline)` = 0.12; for the article outer border use 0.18 matching the `.artifact` border on the atlas instrument — a middle weight, instrument-tier but not loud) |

**No `--ink-faint` on any functional label.** P1-6 (prototype line 276) showed ink-faint (alpha 0.3) fell below 3:1 contrast at 7.5px mono. All field-label tokens on this surface use `--ink-soft` (alpha 0.5). The only acceptable use of `--ink-faint` on this surface is the `--ink-faint` value in `.entry-glitch::after` (marching dash — decorative, WCAG exempt as a motion affordance) and the body hairline border (`--ink-hairline` at 0.12, which is a structural border, not text).

---

## tokens used

| region | token |
|---|---|
| page surface | `var(--paper-base)` |
| article outer border | `1px solid rgb(var(--ink-rgb) / 0.18)` — matches `.artifact` tier in prototype |
| header strip surface | `var(--paper-base)` · `border-bottom: 1px dashed var(--ink-dashed)` |
| body prose ink | `var(--ink-primary)` |
| meta labels (FILE, COORDINATES, TAGS, NETRA readout keys) | `var(--ink-soft)` via `.t-meta` — NOT `--ink-faint` (P1-6) |
| file number, status value | `var(--accent-orange)` via `.t-meta-accent` |
| dashed section rules | `border-bottom: 1px dashed var(--ink-dashed)` via `.section-rule-dashed` |
| patches log surface | `var(--paper-warm)` via `.paper-warm-surface` |
| patches log text | `var(--ink-soft)` |
| patch number inline | `var(--accent-orange)`, `.t-type` |
| pullquote left hairline | `1px solid var(--accent-orange)` |
| pullquote text | `var(--ink-primary)`, italic |
| sidenote text | `var(--ink-soft)` |
| sidenote anchor marker | `var(--accent-orange)` inline superscript |
| related branches header label | `var(--ink-soft)`, `.t-meta` |
| prev/next nav text | `var(--ink-soft)` baseline; `var(--ink-primary)` on hover |
| corner reticles | `var(--accent-orange)` via `.corner-marks` |
| NETRA L1 bay border | `1px solid var(--netra-soft)` — mirrors `.netra-console` prototype line 858 |
| NETRA L1 bay background | `rgba(232,226,213,.92)` — same as `.netra-console` prototype line 859 |
| NETRA label (◎ NETRA) | `var(--netra)`, weight 500 |
| NETRA voice line | `var(--ink-primary)`, Cormorant italic |
| focus ring (all interactive) | `outline: 2px dashed var(--accent-orange); outline-offset: 2px` — P2-10 vocabulary |

Zero raw hex codes. All values are established CSS variables from `app/globals.css`.

---

## typography

> **W4 amendment · TASK-2026-05-18-BETELGEUSE-WAVE4-ARTICLE-TYPOGRAPHY**
> Soul-baseline P1-6 enforcement. All functional labels below 10px on this surface are a readability failure on Mac Retina at 1180px. Scale rules revised per ARCHIVE W3 methodology. No new tokens introduced — size changes only within the existing mono/display stack.
>
> **Scale rule (P1-6 enforcement):**
> - Primary instrument labels: 9px → **11px** (nav, header rows, section headings, patches/related headers, entry-card meta, prev/next nav)
> - Secondary/subordinate labels: 9px → **10px** (NETRA bay base, entry-card tags, Thai subtitle, Thai specimen note)
> - Sub-10px functional labels: 7–8px → **10px** (`.netra-readout`, `.netra-voice-bay .tag`, `.sn-anchor`, `.sidenote .sn-num`, `.thai-specimen-note`)
> - **Never bump both size AND weight on same instance.** `.netra-voice-bay .tag` already has `font-weight: 500`; size bumped, weight unchanged.
> - **`--ink-faint` HARD-ban** remains in effect on all functional labels. All meta labels use `--ink-soft`.
> - Mobile ≤600px floor raised: `8.5px` nav links → `10px`; `8px/7px` NETRA collapsed strip → `9px` minimum.

### header strip (`.article-head` — mirrors `.frame-head`)

- class: `.article-head-row` (JetBrains Mono, **11px**, uppercase, tracking 0.22em, `var(--ink-soft)`)
- file number, status value: `.acc` class (accent-orange, weight 500, tracking 0.26em)
- row labels ("OBSERVATORY", "∇ WORLDLINE", "ATTRACTOR FIELDS"): `.article-head-row` color `var(--ink-soft)`
- α version on right side: same 11px, `var(--ink-soft)`
- tracking for identifiers (file number, status): 0.26em — mirrors prototype line 473 `.frame-head b { letter-spacing: .26em }`

### article title (h1)

- family: Cormorant Garamond italic (`var(--font-display)`)
- size: **44px** — borrow from reference · first-impression authority · constraint = doesn't overpower instrument header
  - rationale: 38px (prior spec) read timid against the NETRA bay's instrument authority in the header strip. 44px establishes H1 as the dominant first-impression element of the body zone while remaining clearly subordinate to the header-strip reticle frame (the header strip is bordered, smaller type, densely packed — the H1 at 44px opens air below it rather than competing upward). The 48px ceiling was tested mentally: at that scale the title risks colliding visually with the corner-reticle authority of the header strip on short titles. 44px holds the correct hierarchy.
  - responsive cascade: 32px at ≤880px · 26px at ≤600px · 22px at ≤375px
- line-height: 1.08 (tightened from 1.1 — Cormorant at 44px has generous cap-height; 1.08 prevents excess air between wrapped lines)
- tracking: –0.015em (tightened from –0.01em — optical compensation for the larger set size)
- color: `var(--ink-primary)`
- max-width: 70ch (contained within body column)
- margin-bottom: 28px before body prose

### body prose

- family: Cormorant Garamond (`var(--font-display)`)
- weight: 400 (roman, not italic — italic only for emphasis and pullquotes)
- size: 16px
- line-height: 1.65
- max-width: 70ch
- color: `var(--ink-primary)`

### sidenotes

- family: JetBrains Mono (`var(--font-mono)`)
- size: 11px
- letter-spacing: 0.12em
- color: `var(--ink-soft)` — NOT `--ink-faint` (P1-6)
- width: 220px
- positioned: absolute right of body column, aligned to anchor paragraph
- at ≤880px: collapses to inline footnote style (see breakpoints)

### pullquote

- family: Cormorant Garamond, italic
- size: 24px
- line-height: 1.3
- padding-left: 32px
- left hairline: `1px solid var(--accent-orange)`
- color: `var(--ink-primary)`

### patches log

- family: JetBrains Mono (`.t-mono`)
- size: 11px
- tracking: 0.12em
- color: `var(--ink-soft)` — NOT `--ink-faint`
- patch number ("PATCH 03"): `.t-type` (Special Elite), `var(--accent-orange)`, `font-variant-numeric: tabular-nums` — carries the D1 lesson from NETRA console (prototype line 896–897: tabular-nums prevents width reflow on digit change)
- date: `.t-mono`, `var(--ink-soft)`
- note text: `.t-mono`, `var(--ink-soft)`

### code blocks

- family: JetBrains Mono
- size: 13px
- background: `var(--paper-warm)` — NOT dark theme
- border: `1px solid var(--ink-hairline)`
- color: `var(--ink-primary)` base; keyword highlights use `var(--accent-orange)`, comments use `var(--ink-soft)` — NOT `--ink-faint`
- shiki theme override: `min-light` base → override background to `var(--paper-warm)` · foreground to `var(--ink-primary)`. Do not use dark themes.

### prev/next nav

- family: JetBrains Mono
- size: **11px** (W4: was 9px — primary navigation label)
- tracking: 0.3em
- label arrows: plain text `←` / `→`
- file number: `.acc` class (accent-orange, weight 500)

### NETRA L1 bay

- NETRA bay base: JetBrains Mono, **10px**, tracking 0.16em, `var(--ink-primary)` (W4: was 9px)
- label (◎ NETRA): `.netra-id .lab`, `var(--netra)`, weight 500, tracking 0.22em — matches prototype `.netra-id .lab` (line 874)
- target text (article title truncated): `.netra-id .tgt` (Special Elite) 10px, `var(--ink-primary)`, `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` — D1 lesson from prototype line 879
- readout keys (LOCUS, FILE): JetBrains Mono **10px**, tracking 0.22em, `var(--ink-soft)` (W4: was 7.5px — P1-6 enforcement, size only)
- readout values: `.netra-readout b` (Special Elite) 10px, `var(--ink-primary)`, `font-variant-numeric: tabular-nums` — D1 lesson
- voice line: Cormorant Garamond italic 12px, `var(--ink-primary)`, line-height 1.35 — matches prototype `.netra-voice .body` (line 951–953)
- voice tag (◎ OBSERVING): JetBrains Mono **10px**, tracking 0.32em, `var(--netra)`, weight 500 (W4: was 7.5px — size only, weight 500 already present)

---

## NETRA L1 article-entry binding (NEW)

### decision framework — why L1, not L2 or L3

Per the 3-layer NETRA architecture (SOUL-BASELINE-AUDIT.md §5 · SBA-3):

- **L1 (instrument console)** — always present in the ATLAS instrument bay, tracks camera/observer state in real time. Canonical position: `frame-foot` of the ATLAS frame.
- **L2 (emergent expansion)** — lives ON the ATLAS surface. Expands when visitor has dwelt in an attractor or article cluster. NOT appropriate for the article surface — L2 is an observatory behavior, not a reading behavior.
- **L3 (dedicated route)** — its own full-page surface. NOT the article page.

**Decision: L1 only on article surface.** The article IS a surveyed node. When the visitor enters the article, they are physically inside a coordinate that was previously a pin on the Globe. The L1 console acknowledges this: the observer locus has resolved to this node. NETRA's reticle locks.

**Soul citation:** SBA-3 §1 — "NETRA's baseline job is navigation and discovery — the same job the jump button performs." On the article page the jump has already resolved. NETRA observes the landing, does not prompt the next jump. This is the tracking-without-freezing principle: the reticle locks; it does not vanish.

### placement

**In the header strip zone, below the coordinate row, above the `border-bottom` dashed rule.**

Not floating. Not in the marginalia. Not in a separate drawer. The header strip is already the instrument layer for this page — adding NETRA L1 there extends the instrument bay into the article context without inventing a new surface.

The header strip on the article mirrors the `frame-head` (prototype lines 467–476). The `frame-foot` on ATLAS carries NETRA. On the article, the equivalent position is the bottom of the header strip — below the metadata rows, above the first dashed rule. This is a one-row instrument addition, not a panel.

**Soul citation:** VISION-FIDELITY §3 I4 — "the chat surface grows from the existing NETRA console or ATLAS bay." The article header strip IS the ATLAS-bay equivalent on this surface. NETRA belongs in the same zone, not bolted on separately.

### state machine

The ATLAS L1 console carries over into article L1. There is no separate mount. The state machine is:

```
ATLAS L1 (FULL view)                article L1 (node resolved)
  NETRA · standby                 →   NETRA · [article title]
  RETICLE · [camera coords]       →   LOCUS  · [article GPS coords fixed]
  RANGE   · [camera distance]     →   FILE   · [file number]
```

The ATLAS L1 shows live tracking (camera orbit → coord updates). The article L1 shows resolved state (coord locked, file number fixed). This is the tracking-without-freezing pattern: the instrument registers the lock, then holds.

On `router.push('/entries/<fileNum>')` (Globe → article navigation), `useGlobeStore` already holds `selectedId` and `cameraFocus`. The article page reads `shareLocation` and `coords` from frontmatter. If both are present: NETRA L1 bay renders with locked coords and the article title as target. If `shareLocation: false`: NETRA L1 bay is hidden (no coords to show — instrument has nothing to lock).

### interactivity — static observational

The L1 on the article surface is **not interactive**. Specifically:

- No `⟶ NEXT NODE` button. The jump function makes no sense when the visitor is already at the node. Showing it would imply NETRA wants to navigate away from the very content being read. Soul citation: attractor-binding-mechanic.md §1.2 — "divergence reads the observer." The observer has arrived. NETRA confirms arrival, does not prompt departure.
- No reticle pulse animation on the article surface. The ATLAS console's `atlas-netra-pulse` (2.4s loop) is a standby signal. On the article, the observer is not in standby — they are reading. The reticle is shown as a static glyph (◎) in `var(--netra)`. Reduced-motion-safe by default (static = already reduced).
- The `◎` reticle glyph is present as text, not SVG animation. Simple, silent, locked.

**Soul citation:** SBA-1 §1.8 — "motion communicates state change." The absence of the reticle pulse IS state communication: the observer has landed. Stillness at arrival is the correct signal.

### voice line — Vega register

One voice line appears in the NETRA L1 bay on the article surface. It renders in the `.netra-voice` zone (Cormorant italic 12px, `var(--ink-primary)`).

**Register constraints (SBA-2 §3):**
- No marketing verbs (discover, explore)
- No second-person flattery
- No chatbot framing ("would you like to…")
- Instrument-adjacent: factual, terse, declarative

**Voice line template:**

```
◎ OBSERVING   [article title, truncated to ~40ch]
LOCUS · [coords] · FILE — [fileNum] · [status]

"[one brief Cormorant italic line acknowledging the locus — 8–14 words]"
```

**Candidate voice line for coords-present state:**
```
"node resolved. archive coordinates confirmed."
```

**Candidate for high-drift articles (coords far from α):**
```
"locus registered · [N.NN]° drift from α."
```

**Candidate for α-proximate articles (coords near Bangkok):**
```
"near the origin locus. observer and archive co-located."
```

The specific copy is a COPY REQUEST to Vega (Vega TASK follow-up). This spec defines the placement, register, and length constraints. Vega writes the exact lines against those constraints.

**Voice line rules:**
- 8–14 words maximum
- Cormorant italic (Reflective register) — NOT mono (instrument register)
- Past tense or declarative present — no imperative, no invitation
- No mention of "article" or "post" (SBA-2 T3)
- No mention of reader/visitor (observer-locus framing only)

### NETRA L1 layout within header strip

```
┌───────────────────────────────────────────────────────────────┐
│ OBSERVATORY · FILE — 003 · 2026.04.12 · REFINED · 8 MIN      │
│ ∇ WORLDLINE · 13.76°N · 100.50°E · DRIFT –0.04 FROM α       │
│ ATTRACTOR FIELDS · coffee · method · narrative                │
│ ─ ─ ─ ─ (1px dashed var(--netra-rgb)/0.3) ─ ─ ─ ─ ─ ─ ─ ─  │
│ ◎ NETRA  │ on the architecture of taste…  │ LOCUS  13.76°N… │
│          │                                │ FILE   003       │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│ "node resolved. archive coordinates confirmed."               │
└───────────────────────────────────────────────────────────────┘
```

The NETRA bay uses the same grid: `auto auto 1fr auto` columns (reticle · id block · flex space · readout) — but the article's readout block is 2-row (LOCUS + FILE) not 2-row (RETICLE + RANGE). The outer border: `1px solid var(--netra-soft)` · background: `rgba(232,226,213,.92)` — verbatim `.netra-console` from prototype lines 857–860.

The dashed rule between the metadata rows and the NETRA bay: `1px dashed rgb(var(--netra-rgb) / 0.3)` — matches `.netra-id` right border (prototype line 869: `border-right: 1px solid rgb(var(--netra-rgb) / 0.3)`).

**At ≤600px:** NETRA L1 collapses to a single-line strip:
```
◎ NETRA · 13.76°N · 100.50°E · FILE 003 · "node resolved."
```
All on one row, font-size 8px, single-line ellipsis on voice if it overflows. Instrument presence maintained; layout simplified.

**When `shareLocation: false`:** NETRA L1 bay does not render. No empty state, no fallback text. Silence is correct — there is no locus to confirm.

---

## motion

### reading-mode baseline

No entrance animation on page load. The article is a reading surface. Prose is the figure. Motion during reading is always wrong here unless it communicates a state the reader has explicitly caused.

**Cite:** SBA-1 §1.8 — "motion that communicates state change." The spec retains all motion that communicates state, eliminates all motion that merely decorates.

### hover timing (iter 1 calibration)

- All interactive elements (Nav links, tag links, prev/next, related branch cards, back-to-ATLAS link): `transition: 150ms ease` — matches iter 1 vocabulary (prototype `.attractor-pill` line 760, `.entry-card` line 1139)
- Related branches card: background-color + title color at 150ms
- Entry-card `.entry-glitch::after` underline draw: 460ms `cubic-bezier(0.2, 0.8, 0.2, 1)` — existing pattern, verbatim from prototype line 1175; within the 300–500ms overlay range for this gestural underline effect

### patches log stagger (first-paint only)

- On `IntersectionObserver` trigger (patches block enters viewport for the first time):
  - Each `<li>` fades in: `opacity 0 → 1` over 220ms ease-out
  - Stagger: 60ms per entry
  - Triggered once. Subsequent scrolls: no animation (entries already visible).
  - **250ms per-entry fade is within the selected-state calibration band** (iter 1: 250ms selected)

### NETRA L1 on article mount

On article page mount (whether from Globe or ChapterIndex):
- NETRA bay fades in: `opacity 0 → 1` over 300ms ease-out, delay 120ms after mount
- No reticle pulse animation (static ◎ glyph — see NETRA L1 section above)
- Respects `prefers-reduced-motion: reduce` (collapses to opacity:1 instantly)

### back-to-Globe affordance

No special transition. `router.push('/')` — the Globe restores zustand state in-memory. No CSS animation needed or appropriate.

### reduced motion

Under `prefers-reduced-motion: reduce`:
- Patches log stagger collapses to 0ms (entries appear instantly)
- NETRA L1 mount fade collapses to instant
- All `.entry-glitch::after` transitions: 0.001ms (covered by existing `globals.css` rule)
- Scroll-meter marching-dash animation halts (existing globals.css `@keyframes scroll-march` — system-level, already covered)

---

## article frontmatter consumed

Per Procyon TASK-2026-05-15-22 velite contract (`lib/content`):

```ts
// fields consumed by this surface:
// fileNum: string       → header strip FILE — {fileNum}
// title: string         → <h1> + NETRA L1 target (truncated)
// date: string          → header strip date
// domain: string        → related branches (shared domain)
// tags: string[]        → header strip ATTRACTOR FIELDS row · links to AttractorFields
// status: string        → header strip STATUS value (lifecycle: seed · ongoing · refined · settled)
// readingTime: number   → header strip NN MIN
// summary: string       → <head> meta only; not rendered on article surface
// coords: {lat, lon, place} → header strip COORDINATES row · NETRA L1 LOCUS
// patches: Array<{n, date, note}> → patches log block
// shareLocation: boolean  → guards coords row + NETRA L1 bay rendering
```

The `isoDate` derived field: `<time datetime="{isoDate}">{formatted date}</time>` in the header strip.

---

## states

### default

As drawn. All sections present. Scroll-meter tracking. NETRA L1 present if `shareLocation: true` and `coords` is set.

### no patches

`patches[]` empty or absent: patches log block hidden entirely. No empty block header. Silence.

### no related branches

Zero entries share domain/tags: related branches block hidden. Prev/next fills the bottom of the page naturally.

### no coordinates (`shareLocation: false`)

COORDINATES row hidden from header strip. NETRA L1 bay hidden. FILE / STATUS / reading-time row remains. No compensation needed — the article is still a worldline locus, just without a shareable GPS coordinate.

### long body (over 4000 words)

No special handling. Scroll-meter provides progress. No pagination.

### loading

Server component (Next.js App Router, statically rendered). Skeleton states are route-implementation concern, not spec concern.

### NETRA L1 — coord absent

When `shareLocation: false` or `coords` not set: NETRA bay does not render. No fallback, no empty state.

### NETRA L1 — coord present, reading in progress

NETRA bay renders and stays visible as the visitor scrolls. The bay does not update as the visitor scrolls — there is no live camera to track. It holds the locked coord state from mount.

---

## breakpoints

### desktop (≥1024px)

As drawn. Sidenotes float right of body column (220px slot). `max-width: 70ch` body centered. Marginalia HUD visible (fixed right 28px). NETRA L1 bay: full 4-column grid layout.

### tablet (881–1023px)

Body column narrows (px-7 padding). Sidenotes drop BELOW the paragraph they annotate — footnote-style: `var(--paper-warm)` tinted block, `var(--ink-hairline)` border, `↓` anchor glyph in the paragraph text. Marginalia HUD: visible. Patches log and related branches: single column. NETRA L1 bay: full layout retained (enough horizontal space).

### mobile (601–880px)

Body: full width, px-7 padding. Sidenotes: same footnote-style as tablet. Header strip STACKS in three rows:
- Row 1: `OBSERVATORY · FILE — {fileNum} · {date} · {status} · {N} MIN`
- Row 2: `∇ WORLDLINE · {lat}°N · {lon}°E · DRIFT {drift} FROM α` (omitted if `shareLocation: false`)
- Row 3: `ATTRACTOR FIELDS · {tag1} · {tag2} …`

NETRA L1 bay: single-line strip (see NETRA L1 section). Marginalia HUD: hidden (existing `@media (max-width: 600px)` `.marginalia { display: none }`). Scroll-meter: full width.

### small mobile (375–600px)

Identical to 601–880px except: px-4 padding. Patches log entries wrap as needed. Related branches stack vertically (1 column). Prev/next nav stacks vertically (prev top, next below). NETRA L1 single-line strip, 8px font, single-line ellipsis on overflow.

**Touch targets:** all interactive elements minimum 44×44px effective touch target — Nav links, tag links, prev/next nav, related branch cards, back-to-ATLAS link. Tags in header strip link to AttractorFields anchor — `<a>` elements with sufficient padding.

---

## accessibility

### semantic structure

```html
<main>
  <article>
    <header role="banner">
      <!-- header strip: FILE, date, status, coords, tags -->
      <nav aria-label="article metadata">
        <!-- tag links → AttractorFields anchors -->
      </nav>
      <aside aria-label="NETRA observation console" role="complementary">
        <!-- NETRA L1 bay — instrument readout, not interactive -->
      </aside>
    </header>

    <h1 id="article-title">{title}</h1>

    <div class="prose-body" id="article-body">
      <!-- body MDX content; headings h2–h4 max -->
    </div>

    <!-- sidenotes: one per annotated paragraph -->
    <aside aria-label="sidenote {n}" id="sidenote-{n}" role="note" />

    <section aria-label="revision history">
      <ol>
        <!-- patches log: semantic ordered list -->
        <li>
          <time datetime="{isoDate}">{formatted date}</time> — {note}
        </li>
      </ol>
    </section>

    <nav aria-label="related branches">
      <!-- 3–5 related entry cards, each an <a> element -->
    </nav>

    <nav aria-label="chronological navigation">
      <a rel="prev">← PREV …</a>
      <a rel="next">NEXT → …</a>
    </nav>
  </article>
</main>
```

### skip link

At viewport top (above Nav), visually hidden until focus:
```html
<a href="#article-body" class="sr-only focus:not-sr-only">Skip to article</a>
```

### sidenotes

- `id="sidenote-{n}"` on `<aside>`
- Paragraph anchor: `<sup><a href="#sidenote-{n}" aria-label="sidenote {n}">†</a></sup>`
- `<aside aria-label="sidenote {n}" role="note">`
- `aria-describedby="sidenote-{n}"` on the paragraph containing the anchor only

### patches log

- Semantic `<ol>` — patches are numbered, ordered, a revision history
- Each `<li>`: `<time datetime="{isoDate}">` + plain text note
- `aria-label="revision history"` on the `<section>`

### NETRA L1 bay

- `role="complementary" aria-label="NETRA observation console"` on the bay element
- `aria-hidden="true"` on the decorative reticle glyph (◎)
- The readout pairs (LOCUS, FILE): `aria-label="locus {lat}°N {lon}°E"` and `aria-label="file number {fileNum}"` on the value elements
- The voice line: plain text — reads naturally to screen readers

### keyboard navigation

Focus order: skip-link → Nav links → header strip tag links → body content → sidenote anchors → patches log (not interactive, skip) → related branch cards → prev/next nav.

**Focus ring vocabulary (iter 1 P2-10):**
All interactive elements on this surface:
```css
outline: 2px dashed var(--accent-orange);
outline-offset: 2px;
```

Cite: prototype lines 375–402 (P2-10 focus ring vocabulary). The article page uses the dashed variant for all its interactive elements (links, nav, tag anchors, sidenote anchors, related branch cards, prev/next). There are no solid-bordered interactive elements on this surface that would warrant the solid-outline variant.

ESC on article: no custom handler (no modals). Standard browser behavior.

### screen reader announcements

- `<title>` tag: `{title} · FILE {fileNum} · Worldline`
- `<meta name="description">`: article `summary` field
- Reading-time: `<abbr title="{N} minutes reading time">{N} MIN</abbr>`
- Status lifecycle label reads naturally (seed / ongoing / refined / settled)

### contrast measurements

| element | token | size (W4) | measured ratio | target |
|---|---|---|---|---|
| body prose | `--ink-primary` on `--paper-base` | 16px | ~7.1:1 | ≥4.5:1 WCAG AA |
| header row labels (primary) | `--ink-soft` on `--paper-base` | **11px** | ~4.1:1 | ≥3:1 |
| section headings, nav, prev/next | `--ink-soft` on `--paper-base` | **11px** | ~4.1:1 | ≥3:1 |
| secondary labels (NETRA bay base, card tags, Thai subtitle) | `--ink-soft` on `--paper-base` | **10px** | ~4.1:1 | ≥3:1 |
| sidenote text | `--ink-soft` on `--paper-base` | 11px | ~4.1:1 | ≥3:1 |
| NETRA readout keys + voice tag | `--ink-soft` / `--netra` on paper-patch cushion | **10px** | ~3.1–4.1:1 | ≥3:1 — P1-6 enforced |
| orange accent text | `--accent-orange` on `--paper-base` | varies | ~4.6:1 | ≥3:1 |

**W4 P1-6 enforcement:** all formerly sub-10px functional labels are now 10px minimum. No functional label on this surface uses `--ink-faint`. The `--ink-soft` (alpha 0.5) at ~4.1:1 is the established floor for all metadata labels.

**P1-6 note:** `--ink-faint` (alpha 0.3) on `--paper-base` measures ~1.6–2.3:1 — below all WCAG thresholds at 9px. It must not appear on any functional label on this surface. `--ink-soft` (alpha 0.5) at ~4.1:1 is the correct choice. Cite: prototype lines 676–715 (RW-4 ITEM B) and lines 275–278 (P1-6 commentary).

### Lighthouse accessibility target

≥95 on article entry template. All images embedded in MDX must have `alt` text (Vega responsibility in body copy).

---

## navigation transitions

### click-from-Globe

When visitor clicks `READ ENTRY →` in Globe side panel:
- Side panel closes (existing: 520ms reverse slide + 320ms opacity)
- Navigate to `/entries/<fileNum>` via Next.js router
- On mount: no entrance animation. Scroll to top. Scroll-meter begins tracking. NETRA L1 bay fades in (300ms, delay 120ms).
- `useGlobeStore` (`selectedId`, `cameraFocus`, `activeAttractor`) persists in-memory across route transition (zustand — no reset on route change).

### click-from-ChapterIndex

- No transition animation. Direct navigation via `<Link>`.
- Active attractor filter NOT cleared. Back-navigation restores filtered state.
- No Globe camera state involved.

### back-to-Globe

The `← ATLAS` affordance:
- Text link, not a button. In Nav strip right-side zone, `.t-meta` text, `← ATLAS`.
- Appears ONLY when `sessionStorage.getItem('wl:entry-origin') === 'globe'` (set by Globe before navigation).
- On click: `router.push('/')`. Globe restores prior state (zustand in-memory). No special transition.
- If navigated from ChapterIndex (`'wl:entry-origin': 'index'`): `← ATLAS` not shown. Standard Nav `◇ INDEX` link serves as return.

**Sirius contract:** Before navigating to `/entries/<fileNum>`, the Globe (or ChapterIndex) sets `sessionStorage.setItem('wl:entry-origin', 'globe' | 'index')`. Article page reads this on mount.

---

## references

| pattern | established by |
|---|---|
| `.article-head` mirrors `.frame-head` rhythm | prototype lines 467–476; globals.css `.atlas-head` |
| corner reticles (`.corner-marks`) | `CornerMarks.tsx` + globals.css lines 136–160 |
| dashed section rules (`.section-rule-dashed`) | globals.css line 183 |
| `.t-meta` 9px uppercase mono | globals.css lines 167–173 |
| `.t-meta-accent` orange accent | globals.css line 174 |
| `--paper-warm` patches log surface | globals.css line 20; `.paper-warm-surface` line 129 |
| `.paper-warm-surface` class | globals.css line 129–131 |
| `.netra-console` grid + border + background | prototype lines 855–862 |
| NETRA readout tabular-nums (D1 lesson) | prototype lines 896–897 |
| NETRA target ellipsis overflow (D1 lesson) | prototype lines 879 |
| P1-6 ink-soft on functional labels | prototype lines 275–278 |
| P2-10 focus ring dashed vocabulary | prototype lines 375–402 |
| `.entry-glitch` underline hover pattern | globals.css lines 277–305; prototype lines 1168–1180 |
| `.netra-voice` tag + body classes | prototype lines 945–953 |
| paper-patch cushion for small-text contrast | prototype lines 696–715 (RW-4 ITEM B) |
| sidenote visual language | globals.css `.marginalia` |
| scroll-meter | globals.css `.scroll-meter` lines 239–271 |
| marginalia HUD | globals.css `.marginalia` lines 203–236 |

---

---

## Thai type system (NEW — Task B Wave-2 · 2026-05-17)

Thai-language specimen integrated in `UI-ITER-2-article-v1/prototype/index.html` as a second-view block below the English content (integration route C, simplest). Vega specimen source: `.claude/handoffs/from-vega/TASK-2026-05-17-VEGA-ARTICLE-THAI-SPECIMEN--to-polaris.md`.

### face choices

| role | face | weight | rationale |
|---|---|---|---|
| Thai prose body | Noto Serif Thai | 400 | Serif parity with Cormorant Garamond at `var(--ink-primary)`. Covers full vowel-stack glyph set without OS fallback. Light variant (300) available for pullquote substitute. |
| Thai pullquote | Noto Serif Thai | 300 | Italic substitute: reduced weight creates the distinct register mode that Cormorant italic creates in English. No slanted Thai — Vega §pullquote note confirmed. 0.04em character spacing added as secondary register marker. |
| Thai section headers | JetBrains Mono (English) | 300–500 var | JetBrains Mono has no Thai glyph coverage. Headers remain in English instrument register. Thai body makes language identity clear; navigation labels serve a separate function. Vega prose preference accepted as spec decision. |
| Thai mono instrument labels | JetBrains Mono (English) | — | Same as headers. No additional Thai mono font loaded. |

### line-height

**1.9** — Thai script stacks tone marks, vowel diacritics, and descenders in three vertical layers. At 1.7 (Cormorant value) the layers clip visually. At 2.0 the text floats too loosely for the article's reflective register. 1.9 is the chosen value: matches the slow tempo of the article and gives longer vowel-stack characters (เ–า, โ, แ) room to read as intended. Vega recommended 1.8–2.0; 1.9 confirmed.

### pullquote treatment

Weight-300 (Noto Serif Thai Light) with `letter-spacing: 0.04em`. No `font-style: italic`. Border-left `1px solid var(--accent-orange)` retained as structural anchor — the hairline rule survives the transition from English italic to Thai weight-shift because it is the visual spine of the pullquote block, not a property of the type. The three options Vega offered:

1. Reduced weight (Light) — **chosen**
2. Increased character spacing (0.04–0.06em) — **applied as secondary marker, not primary**
3. Different face for pullquote only — not chosen; creates unnecessary font-load and the weight variation within Noto Serif Thai is sufficient

### headline policy

**Display headline: เมื่อฉันหยุดกลางทาง** (Vega alternate — accepted)

Rationale: kinetic image ("mid-path stop"), echoes §3's stopping-while-in-motion passage, tight at 6 syllables, and the implied ellipsis of กลางทาง (path still extending beyond the stop) mirrors the article's open ending about whether Peat returns to Stride. The alternate headline pulls; the primary announces.

**Functional subtitle: ทำไมฉันถึงหยุดสตาร์ตอัพ** — retained as page subtitle rendered in `.thai-article-subtitle` (JetBrains Mono, 9px, ink-soft). Reserve for `<title>` tag or meta if SEO structure requires the question-headline form.

### Vega flag (not edited — copy is verbatim per directive)

Vega flagged the body sentence "นิสัยของความเร่งด่วนโดยไม่มีวัตถุประสงค์ของมัน" as running long in Thai noun-heavy construction when pulled as a display pullquote. Suggested tightening: **นิสัยของความเร่งด่วนที่ไร้เป้าหมาย** (6 syllables). Current specimen renders full version in body per verbatim directive. Vega should confirm whether to revise the body sentence too, or only the display pullquote form.

### integration approach

Route C (simplest): full second-view block below the English article, separated by a mono uppercase `SPECIMEN · TH · NOTO SERIF THAI · WAVE-2` divider. No toggle mechanism, no side-by-side layout. Rationale: the Thai specimen is a design validation surface, not a production route-toggle; simplicity prevents implementation debt from entering the prototype before the face choices are confirmed.

---

## non-goals

- **No Thai toggle in production.** Specimen is a design validation surface. Production Thai language support is a separate Procyon/Sirius task (requires `--font-thai` token, velite frontmatter `lang` field, routing). Specimen does not commit to a production pattern.
- **No comment system.** PRD-01 non-goal.
- **No reading-progress bar.** Global scroll-meter covers this.
- **No print stylesheet.** Deferred.
- **No audio companion.** PRD-01 parking lot.
- **No article-photo pairing spec.** Deferred to follow-up (Vega TASK-25 owns body content).
- **No spec for article body MDX.** Vega owns body content; this spec covers the frame.
- **No fiction entry surface.** Deferred.
- **No sidebar navigation.** Not present in this system.
- **No NETRA companion register on article surface.** NETRA appears as L1 instrument bay only. The companion chat (L3) is its own surface. Mixing companion chat into the reading surface would violate I4 and create a chatbot-on-every-page pattern that SBA-3 explicitly flags as dilutive.
- **No NETRA `⟶ NEXT NODE` button on article surface.** The jump function is an ATLAS behavior. The article IS the node.

---

## anti-Codex 6-point audit

| check | status | evidence |
|---|---|---|
| 1 · reference fidelity | PASS | Header strip (FILE/date/status/readingTime/coords/tags), h1 title, body prose, sidenotes, pullquotes, patches log, related branches, prev/next — all present. NETRA L1 bay: new spec section, fully detailed. No element promised by PRD-01 missing. |
| 2 · token compliance | PASS | Zero raw hex codes. All values through `var(--)` tokens. Corrected v1's `rgb(var(--ink-rgb) / 0.18)` body-hairline to consistent source citation (iter 1 `.artifact` pattern). Paper-patch cushion in NETRA bay: `rgba(232,226,213,.92)` — this is the exact value from prototype `.netra-console` background (line 859), a deliberate verbatim carry-over, not a new raw value. Note: this value should be a token (`--paper-patch-88` or equivalent) but none exists yet. Since creating a new token requires Polaris approval per my constraints, this instance is flagged: Sirius should use `rgba(232,226,213,.92)` verbatim matching the prototype, and Polaris should decide whether to canonicalize it as a token. |
| 3 · pattern reuse | PASS | Every visual atom cites a prototype section or globals.css class. NETRA L1 bay reuses `.netra-console` CSS verbatim. No new visual vocabulary invented. |
| 4 · accessibility | PASS | Semantic HTML documented. Skip link specified. NETRA bay aria-labels specified. Patches log as `<ol>`. Focus ring P2-10 vocabulary adopted. Contrast ratios measured. Lighthouse ≥95 target. Keyboard order explicit. |
| 5 · mobile fidelity | PASS | Three breakpoints (881–1023, 601–880, 375–600). Sidenote collapse specified per breakpoint (footnote-style, not hidden). Header strip stack behavior explicit. NETRA L1 collapse at ≤600 explicit. Touch targets ≥44px. No horizontal scroll at 375px (70ch prose + px-4 padding). |
| 6 · motion calibration | PASS | 150ms hover (all interactive). 460ms entry-glitch underline (existing pattern). 220ms patches log fade / 60ms stagger. 300ms NETRA L1 mount fade. No looping decorative motion on reading surface (static reticle glyph, no pulse). Reduced-motion: all collapse paths specified. |

**TOKEN FLAG for Polaris:** `rgba(232,226,213,.92)` appears in the NETRA L1 bay token table and in the `.netra-console` CSS. This is currently a raw value in the prototype (not a token in `globals.css`). It is the paper-base color at 92% opacity — the paper-patch cushion. If this value will appear on multiple surfaces (ATLAS NETRA console + article NETRA bay + future surfaces), it should become `var(--paper-patch)` or `var(--paper-canvas-88)`. Token proposal via Polaris when the pattern appears a third time.

---

## vision fidelity — closing statement

This spec lifts the article surface from a structurally correct v1 to a system-grounded v2. The structural decisions Peat accepted in v1 (layout, header strip, sidenotes, patches log, related branches, prev/next) are preserved. What changed is the depth of grounding: every token, every motion timing, every contrast ratio now traces back to the locked iter 1 prototype or `globals.css`. The NETRA L1 binding is the one genuinely new element — and it derives entirely from the existing NETRA console vocabulary (same CSS classes, same grid, same color tokens), applied to a reading surface context with appropriate behavioral restraint (no pulse, no jump, static observational).

The article is a paper instrument that contains a surveyed archive node. This is the soul. The spec has not diluted it.

---

## changelog v2.0 appendix — previous spec history

*v1.0 · TASK-2026-05-15-09 · 2026-05-15 · sonnet · β-instance of 4×parallel dispatch*
*v2.0 · TASK-2026-05-17-ARTICLE-REFINE · 2026-05-17 · sonnet · post iter-1-lock refine*
*v2.1 · TASK-2026-05-18-BETELGEUSE-WAVE4-ARTICLE-TYPOGRAPHY · 2026-05-18 · sonnet · W4 typography pass: P1-6 enforcement, lang="th", inline style cleanup*

---

*betelgeuse · α-VIS-04 · the Red Sentinel · TASK-2026-05-18-BETELGEUSE-WAVE4-ARTICLE-TYPOGRAPHY · v2.1*
*iter 1 grounded · zero new tokens · zero raw colors outside noted exception*
*W4: all functional labels ≥10px · --ink-faint hard-ban enforced · lang="th" on Thai section · inline font-weight moved to class*
*soul baseline: UI-ITER-1-globe-v1/prototype/index.html (RW-5 AMEND-9b locked)*
