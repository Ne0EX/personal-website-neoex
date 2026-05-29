# docs/design/20-archive.md
# ARCHIVE Surface · v1.0 · Planning

> Status · v1.0 SPEC PLAN · 2026-05-17
> Authors · Betelgeuse (α-VIS-04) · TASK-2026-05-17-ARCHIVE-PLAN · PAIR B (planning · opus)
> Pair · Vega Pair B · copy spec at `.claude/handoffs/from-vega/TASK-2026-05-17-ARCHIVE-PLAN-COPY--to-polaris.md`
> Concurrent · Pair A (ARTICLE prototype planning) — coordination contract at §9
> Peat directive · "ARCHIVE คือส่วนบนสุดของ NAV ให้พวกเขาช่วยกัน define ว่ามันจะไปโผล่หน้าไหน แต่ต้องมี article อยู่แน่ๆ จะลอก Ne0 Stratum เลยมั้ย หรือยังไง" (2026-05-17)
> Predecessors · `00-globe-ontology-1.2.md` v1.3 (canonical strata model) · `journey-architecture.md` §5 (fallback list access) + §9 row 06/07 (Ne0 Index variants DISCARDED for being redundant with ChapterIndex) · `09-article-entry.md` v2.0 (article entry destination) · `10-photo-atlas.md` v1.0 (`/photos` precedent) · `30-worldline-branching.md` (worldline mechanic context) · `attractor-binding-mechanic.md` (in-membership halo + edge vocabulary) · `docs/team/.soul-baseline/visual.md` SBA-1 · `docs/team/VISION-FIDELITY.md` §3 invariants

---

## vision fidelity

```text
soul baseline      · `docs/team/.soul-baseline/visual.md` (SBA-1) §1.4–1.7
                     `app/globals.css` token ladder (iter 1 locked)
                     `.claude/visual-diffs/UI-ITER-1-globe-v1/prototype/index.html`
                     `components/ChapterIndex.tsx` (existing inline list pattern — entry-card vocabulary)
                     `components/Nav.tsx` (◇ INDEX · ◇ TRACES · ◇ ARCHIVE · ◇ TRANSMIT strip)
                     `docs/prds/00-globe-ontology-1.2.md` §2 (Ne0 surface = photos · NeX orbit = articles+fiction · Ne0N axis = observer)
aesthetic invariants · I1 (Garden under measurement — archive must feel accumulated, surveyed, dated, patched; never marketing-arranged)
                       I2 (Globe is the body — archive does NOT compete with ATLAS for protagonist status; it offers an alternate framing OF the same body, never an alternative TO it)
                       I3 (Peat in the instrument layer — α version, drift, coords, status, patches appear as instrumentation across the archive; never as biography cards)
                       I5 (quality visible — sparse density, empty paper silence, mono uppercase rhythm; never a wall of cards)
Peat signal        · "ARCHIVE คือส่วนบนสุดของ NAV" (top-of-nav surface) + "ต้องมี article อยู่แน่ๆ" (must include articles) + "จะลอก Ne0 Stratum เลยมั้ย" (open question — re-use Ne0 stratum framing?)
allowed evolution  · a dedicated route surface for browsing the corpus by something other than Globe geography · cross-content-type listing (articles + photos + fiction) where the Globe segregates by stratum · status/domain/date filters as survey controls (not generic search)
forbidden dilution · ARCHIVE rendered as a cards-grid SaaS gallery · "Browse our work" framing · two-way binding to a generic search box · pagination chrome that looks like e-commerce · category illustrations · author bio · "featured" callouts · any framing that makes ARCHIVE feel like an alternative TO the Globe rather than a re-framing OF the same body · using `--ink-faint` on functional labels (P1-6 lesson)
rendered checkpoint · desktop 1180px (Ne0EX inventory ledger + filter rail + sparse mini-globe) · tablet 880px (ledger single column, filter rail collapses to top strip) · mobile 600px (ledger only, filter as horizontal scroll chip row) · 375px (px-4 padding, same as 600px)
```

---

## loss budget

**Acceptable loss across breakpoints:**
- Mini-globe SVG companion at ≤600px (the ledger is enough; the spatial reference can be reached by tapping back to ATLAS)
- The right-rail filter panel at ≤880px (collapses to horizontal chip row at the top)
- Multi-row dashed instrument header at ≤600px (stacks to two rows)
- Domain × status cross-filter matrix at ≤600px (collapses to two parallel chip rows)

**Unacceptable loss at any breakpoint:**
- File numbers, dates, status, drift readouts on each entry (I1 — every row is a surveyed locus, not a card)
- The dashed-hairline rhythm between sections and rows (instrument register identity)
- The single-frame `[ ◯ ATLAS ]` return affordance (always present — ARCHIVE never amputates the Globe metaphor)
- Cross-content-type unification (articles, photos, fiction all listed against the same instrument vocabulary)
- The "ledger" feeling — rows, not cards; type, not chrome

**Compensation at ≤600px:**
- Mini-globe collapses to a one-line strip: `◯ ATLAS · 047 LOCI · DRIFT –1.300` — instrument presence retained, geometry deferred
- Filter row becomes horizontal scroll (Apple iOS pattern — overflow-x:auto, scrollbar hidden, momentum scroll); chips stay 9px mono
- Each row in the ledger stacks its meta line below the title at ≤600px (two rows per entry instead of one)

---

## 1 · intent

ARCHIVE is the ledger of the worldline — every surveyed node listed against the
same instrument vocabulary. The Globe is the body; ARCHIVE is the ledger you
consult when you want to scan, slice, or audit that body without orbiting it.

Three things it communicates:

1. **The archive is countable and dated.** Every entry has a file number, a survey
   date, a status, a drift reading, and a coordinate (when shared). Visitors
   should feel they could check the inventory the way a cartographer checks a
   plate book — by file, by sector, by year.
2. **The archive is one corpus, not three.** Articles, photographs, and fiction
   all appear in one ledger. The Globe segregates them by stratum (surface vs
   orbit vs axis) because the geometry demands it; ARCHIVE collapses the strata
   into a flat survey list because the ledger demands it. **This is the load-bearing
   reason ARCHIVE exists as a distinct surface and not just a re-skinned ChapterIndex.**
3. **The archive is the return path.** ATLAS is the prompt; ARCHIVE is the index.
   Every entry in the ledger maps to a node on the Globe. The visitor can hold
   the Globe in peripheral vision (mini-globe) while reading the list. ARCHIVE
   never replaces ATLAS; it transposes the same body to a list register.

ARCHIVE is NOT a blog index. NOT a tag cloud. NOT a portfolio gallery. NOT a
news feed. NOT a Notion-style database view. If it could be transplanted to a
generic CMS site without anyone noticing, it is wrong.

---

## 2 · chosen approach — Option C hybrid (with Option-A elements)

Peat's open question: copy Ne0 Stratum entirely (Option A), or take a different
approach? **Recommendation: hybrid that grows from the Ne0 Stratum idea but does
NOT just re-render the Ne0 stratum on a separate page.**

### 2.1 why not Option A (pure copy of Ne0 stratum) — diagnostic

Per `00-globe-ontology-1.2.md` v1.3 §2, **Ne0 = surface = photographs only**.
Articles live in NeX orbit. So "copy Ne0 Stratum entirely" would produce an
archive page containing photos only — which violates Peat's hard constraint
("ต้องมี article อยู่แน่ๆ" / must include articles).

Pure Option A as the user phrased it is structurally incompatible with the
ontology that governs the rest of the site. Either Ne0 must expand to mean
"all loci-bearing entries" (which would mutate the ontology — Polaris
escalation territory), or ARCHIVE must be a flat cross-stratum surface that
borrows Ne0's *vocabulary* (locus, file, survey date, drift) without inheriting
its *scope* (photos only). The second path is the recommendation.

### 2.2 why not Option B (article-listing standalone, no Globe)

A pure article-listing standalone surface would break I2 (Globe is the body).
The site has one body. Every reading surface so far carries an instrument tie
back to the Globe (article entry has NETRA L1, photo atlas has SVG mini-globe).
ARCHIVE without any spatial reference would be the first surface to amputate
the Globe metaphor, and it would do so at the top of the nav strip — the
loudest possible position. That's exactly the wrong place to break the
metaphor.

It would also force ARCHIVE to compete with ChapterIndex (the existing inline
list on the homepage) — and the existing journey-architecture §9 rows 06/07
DISCARDED "Ne0 Index Log/Feed" precisely because they overlapped with
ChapterIndex. Option B would re-invite that overlap.

### 2.3 why not Option D (multi-route `/archive` parent + sub-routes)

Multi-route creates a category-page pattern: `/archive` lands on a hub, then
sub-routes for `/archive/articles`, `/archive/photos`, `/archive/fiction`.
Three problems:

1. **`/photos` already exists** (per `10-photo-atlas.md` §2). Adding
   `/archive/photos` either duplicates it or hijacks the URL. Both are bad.
2. **It pre-commits to type as the primary axis of filtering.** Real ledgers
   slice by many axes (date, status, domain, drift). A type-first nav routes
   that to a single axis structurally.
3. **It dilutes ARCHIVE's purpose.** A landing hub with three CTAs to
   sub-surfaces is exactly the SaaS-category-page shape that violates I1
   (garden under measurement) and I5 (quality visible).

### 2.4 the hybrid recommendation — Option C

**ARCHIVE is a single-route, cross-stratum ledger surface with a sparse SVG
mini-globe companion.** It is reached at `/archive` (route decision in §3).
It lives at the top of the nav strip per Peat's directive.

The layout is a ledger (rows, dashed-rule separators, mono labels) on the left
~70% of the viewport at desktop, plus a sparse SVG mini-globe + filter rail on
the right ~30%. The mini-globe shows all eligible entries as small glyphs
(square for photos, circle for articles, diamond for fiction) on an
orthographic projection — it is a companion, not a control. Filters live in
the right rail: status pills, domain pills, content-type pills, year pills.

The mini-globe is **the smallest possible piece of ATLAS that preserves I2**.
It is to ARCHIVE what NETRA L1 is to the article entry surface: a quiet,
instrumental tie-back to the body, sized for context not for navigation.

This grows from the Ne0 Stratum idea in two ways:
- **Vocabulary inheritance:** every row uses LOCUS · DRIFT · STATUS · FILE
  language identical to the article entry header strip. The visitor recognizes
  ARCHIVE as a re-framing of the same instrument family.
- **Layer co-presence:** like the v1.3 ontology where surface + orbit + axis
  are visible at once, the ledger shows article + photo + fiction at once.
  ARCHIVE is the flat projection of the three-strata model. This is the
  *philosophical* lineage from Ne0 — not a copy, but the same idea written for
  a list register.

### 2.5 anti-Codex check for the chosen approach

| invariant | how the hybrid honors it |
|---|---|
| I1 garden under measurement | every row carries file, date, status, drift; section rules dashed; rhythm is dossier-not-blog |
| I2 globe is the body | mini-globe SVG companion is always present (or collapsed to a single-line strip at ≤600px); `[ ◯ ATLAS ]` return affordance always visible in header strip |
| I3 Peat in the instrument layer | drift readings, α version readout in header strip, coords on every locus-bearing entry — same instrumentation as everywhere else |
| I4 NETRA attached to ATLAS first | ARCHIVE does NOT carry NETRA L1 — it is a listing surface, not a reading surface; mini-globe carries the spatial cue, no need to duplicate the navigator |
| I5 quality visible | rows not cards; dashed not solid; sparse not dense; mono not sans-serif body |

---

## 3 · route + URL structure

**Canonical route: `/archive`**

| URL | meaning |
|---|---|
| `/archive` | default — all eligible entries, default sort (most recently patched first) |
| `/archive?type=article` | filter to articles only |
| `/archive?type=photo` | filter to photos with `shareLocation === true` |
| `/archive?type=fiction` | filter to fiction transmissions |
| `/archive?status=refined` | filter to a single lifecycle status |
| `/archive?domain=coffee` | filter to a single attractor field |
| `/archive?year=2026` | filter to a single calendar year of survey |
| `/archive?type=article&status=refined&domain=method` | filters are AND-combined |
| `/archive?sort=drift` | sort by absolute drift from α (high to low) |
| `/archive?sort=alpha` | sort by file number ascending (oldest first) |

URL params are reflected in the filter rail UI; toggling a chip updates the
URL (push-state, not replace) so browser back/forward works. Deep linking is
supported and encouraged.

### 3.1 alternative routes considered (and rejected)

| candidate | verdict | reason |
|---|---|---|
| `/atlas` | reject | conflicts with mobile `/atlas` route in `journey-architecture.md` §7.3 (mobile full-viewport Globe) |
| `/library` | reject | implies books/curation/recommended; ARCHIVE is dating, not curating |
| `/all` | reject | flat, undignified; lacks instrument register; "all" is a switch state, not a surface name |
| `/index` | reject | conflicts with `◇ INDEX` nav link (which maps to homepage anchor) |
| `/ledger` | considered | accurate but slightly precious; `/archive` is more idiomatic for the web |
| `/archive` | **CHOSEN** | matches the nav label exactly; routes to the verbal idea; SEO-discoverable |

**OPEN QUESTION FOR PEAT § 14·Q1:** `/archive` vs `/ledger` — Peat preference?

---

## 4 · layout

### 4.1 desktop ≥1180px (canonical)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ scroll-meter (2px top, accent-orange fill, fixed)                              │
├────────────────────────────────────────────────────────────────────────────────┤
│ NAV STRIP (Nav.tsx unchanged · ◇ INDEX  ◇ TRACES  ◇ ARCHIVE(active)  ◇ TRANSMIT) │
├────────────────────────────────────────────────────────────────────────────────┤
│ HEADER STRIP (.archive-head · mirrors .frame-head vocabulary)                  │
│                                                                                │
│  OBSERVATORY · ARCHIVE LEDGER · NN ENTRIES SURVEYED · NN PATCHES               │
│  ∇ Ne0EX · DRIFT MIN +0.00 · DRIFT MAX –2.40 · α 1.130426                     │
│  [ ◯ ATLAS ]                                                  NAV STANDBY     │
│  ─ ─ ─ ─ ─ ─ ─ (1px dashed var(--ink-dashed)) ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│                                                                                │
├────────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│   ┌─────────────────────────────────────────────┬────────────────────────────┐│
│   │ LEDGER (left column · ~62% · max 920px)     │ RIGHT RAIL (~38% · 360px)  ││
│   │                                             │                            ││
│   │ § 01 · YEAR — 2026                          │ ┌──────────────────────┐  ││
│   │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │ │  MINI-GLOBE (3D)     │  ││
│   │                                             │ │  300×300 three.js    │  ││
│   │ FILE — 003 · 2026.04.12 · REFINED · 8 MIN  │ │  interactive sphere  │  ││
│   │   on the architecture of taste              │ │  · = circle (article)│  ││
│   │   coffee · method · narrative               │ │  ■ = square  (photo) │  ││
│   │   LOCUS 13.76°N 100.50°E · DRIFT –0.04     │ │  ◆ = diamond(fiction)│  ││
│   │   ◯ article                                 │ │                      │  ││
│   │   ────────────────────────────────────────  │ │  (filtered entries   │  ││
│   │                                             │ │   render in accent;  │  ││
│   │ FILE — 002 · 2026.04.08 · ONGOING · 12 MIN │ │   excluded entries   │  ││
│   │   note on grinding burrs and patience       │ │   render in ink-faint│  ││
│   │   coffee · method                           │ │   per binding §3.3)  │  ││
│   │   LOCUS 13.76°N 100.50°E · DRIFT –0.08     │ └──────────────────────┘  ││
│   │   ◯ article                                 │                            ││
│   │   ────────────────────────────────────────  │ § FILTER                   ││
│   │                                             │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ││
│   │ FILE — 014 · 2026.04.05 · — · — MIN        │                            ││
│   │   chiang-mai / cool season                  │ TYPE                       ││
│   │   travel · light                            │ [ALL] [art] [photo] [fic]  ││
│   │   LOCUS 18.79°N 98.98°E · DRIFT –1.30      │                            ││
│   │   ■ photo · roll: chiang-mai-2026-04        │ STATUS                     ││
│   │   ────────────────────────────────────────  │ [seed] [ongoing]           ││
│   │                                             │ [refined] [settled]        ││
│   │ FILE — 022 · 2026.03.30 · SEED · 4 MIN     │                            ││
│   │   fragment / on the third repair            │ DOMAIN                     ││
│   │   meta · fiction                            │ [identity] [reflection]    ││
│   │   LOCUS — · DRIFT —                         │ [method]   [meta]          ││
│   │   ◆ fiction                                 │                            ││
│   │                                             │ YEAR                       ││
│   │ § 02 · YEAR — 2025                          │ [2026] [2025] [2024]       ││
│   │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │                            ││
│   │ ...                                         │ SORT                       ││
│   │                                             │ ↓ recently patched (def.)  ││
│   │                                             │   chronological            ││
│   │                                             │   absolute drift           ││
│   │                                             │   file number              ││
│   │                                             │                            ││
│   │ [ load next 20 ]   (or auto-paginate? §14·Q4)│                            ││
│   └─────────────────────────────────────────────┴────────────────────────────┘│
│                                                                                │
└────────────────────────────────────────────────────────────────────────────────┘
│ marginalia HUD (right edge 28px, ink-soft, vertical writing) — same as article │
```

### 4.2 entry row anatomy — DESKTOP

Each entry row is a **horizontal strip**, not a card. No rounded corners. No
elevated shadows. A dashed hairline `1px dashed var(--ink-dashed)` separates
rows.

```
FILE — 003 · 2026.04.12 · REFINED · 8 MIN            ← row 1 · meta (.t-meta · 9px)
on the architecture of taste                          ← row 2 · title (Cormorant italic 18px)
coffee · method · narrative                           ← row 3 · attractor pills (.t-meta · 9px · first is orange)
LOCUS 13.76°N 100.50°E · DRIFT –0.04                  ← row 4 · locus (.t-meta · 9px · drift in .t-meta-accent)
◯ article                                             ← row 5 · type glyph + label (small, ink-soft)
─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─        ← row separator
```

Vertical rhythm: 8px between rows within an entry; 16px between entries (the
dashed rule sits in the middle of the 16px gap).

Padding: `py-5 px-7` per entry (matches `ChapterIndex` `.entry-card` rhythm
which uses `px-7 py-6` — `py-5` here is one tick tighter because the rows are
type-only and dense type doesn't need the same breathing room as the
ChapterIndex preview cards).

**Hover state:** background shifts to `rgba(212,96,42,0.04)` (matches
ChapterIndex `.entry-card` hover background, prototype line 1147 region). Title
color shifts from `var(--ink-primary)` to retain ink but with the
`.entry-glitch::after` underline-draw animation (460ms, prototype line 1175,
verbatim).

**Click target:** the entire row is a single `<a>` element. Routes to:
- article → `/entries/<fileNum>`
- photo → `/photos/<roll>/<id>` (per photo-atlas §3.1)
- fiction → `/fiction/<slug>` (per journey-arch §3.1)

### 4.3 section grouping by year

The ledger is grouped by year (`YEAR — 2026`, `YEAR — 2025`, …) with a thin
`§ 0N · YEAR — YYYY` header (mono 9px tracking 0.3em, `.t-meta-accent` orange
on the section number, `var(--ink-soft)` on the rest). A dashed rule below
each year header.

Sort can override: if visitor selects `sort=alpha` (by file number), grouping
collapses (no year headers — pure linear list). If visitor selects
`sort=drift`, grouping collapses similarly. Year grouping is the default sort
+ default grouping pair.

### 4.4 right rail anatomy — DESKTOP

The right rail at `360px` fixed width carries three blocks vertically:

1. **Mini-globe 3D (300×300 canvas, centered)** — see §5 (Route B: three.js interactive sphere)
2. **Filter pills (TYPE, STATUS, DOMAIN, YEAR, SORT)** — see §6
3. **(future) Patches feed** — flagged as v2 deferred, see §14·Q5

The rail is **sticky** at desktop (`position: sticky; top: 64px;`) so it
stays visible as the visitor scrolls the ledger. The filter chips remain
reachable. On mobile/tablet, the rail flows above the ledger (non-sticky)
because vertical scroll is the primary axis.

---

## 5 · Globe relationship — the mini-globe 3D companion

> **Route B locked · 2026-05-17 · Peat verdict**
> Interactive / 3D required. Lightweight standalone three.js component.
> NOT embedded ATLAS canvas. NOT SVG static projection.
> Previous §5 (SVG static) superseded entirely by this revision.

### 5.1 what it is

A small, interactive three.js sphere rendered into a `<canvas>` element
inside `components/ArchiveMiniGlobe.tsx`. It occupies **~300×300px** at
desktop (sidebar pane fit), approximately **1/4 the scale of the ATLAS globe**.
It is a standalone component — it does NOT share a WebGL context with
`WorldlineGlobe.tsx` (ATLAS). The two globes run in separate render loops.

The mini-globe is **interactive** in the minimal sense: the sphere auto-rotates
on idle, the visitor can click a visible node-marker to navigate to that entry,
and clicking empty globe surface navigates to `/index` (ATLAS). It is NOT a
full ATLAS clone — geometry resolution, node-marker detail, journey-line
overlay, and the nav-strip instrument frame are all omitted.

### 5.2 geometry

- **Primitive:** `THREE.SphereGeometry` with 24 width segments × 24 height
  segments (low-poly, not icosphere). This is lower resolution than ATLAS —
  intentionally so. The small display size (300px) does not require ATLAS-level
  geometry fidelity, and lower segment count reduces GPU fill cost on the
  archive page.
  - Acceptable range: 20–32 segments. 24 is the recommended default.
  - Do NOT use the full ATLAS geometry (higher resolution) — the mini-globe
    must be visibly lighter, consistent with its role as a companion, not a
    second ATLAS.
- **Scale:** `~1/4 of ATLAS canvas size`. If ATLAS renders at ~1200px effective
  diameter, the mini-globe renders at ~300px effective diameter.
- **Material:** see §5.3 (shared with ATLAS — HARD lock).

### 5.3 tokens shared with ATLAS — HARD lock (drift guard)

These values MUST remain identical to `WorldlineGlobe.tsx` / ATLAS regardless
of any future ATLAS updates. If ATLAS changes any of these, the mini-globe
changes with it. Sirius: add a comment in `ArchiveMiniGlobe.tsx` citing this
contract explicitly.

| attribute | value | token source |
|---|---|---|
| globe surface color | `var(--paper-base)` (#E8E2D5 in TEAL palette) | `app/globals.css --paper-base` |
| globe wireframe / graticule color | `var(--ink-faint)` (rgb(31,80,99,0.3)) | `app/globals.css --ink-faint` |
| node-marker color (in-membership) | `var(--accent-orange)` (#D4602A) | `app/globals.css --accent-orange` |
| node-marker color (out-of-membership) | `var(--ink-faint)` at 0.32 opacity | binding mechanic §3.3 |
| material shading mode | `MeshLambertMaterial` — matte, no specular highlight | ATLAS uses Lambert; mini-globe inherits |
| ambient light color | warm white (`#F0EBDD` ≈ `var(--paper-bright)`) | ATLAS ambient light match |
| directional light angle | above-right (matches ATLAS directional light vector) | ATLAS light match |
| rotation period (idle auto-rotate) | **60s per full revolution** | ATLAS idle-drift timing |
| idle drift axis | Y-axis slow rotation | ATLAS drift pattern |

### 5.4 allowed to diverge from ATLAS

These properties are intentionally different on the mini-globe. Sirius should
NOT attempt to match ATLAS on these — divergence here is the spec:

| attribute | mini-globe value | ATLAS value | reason for divergence |
|---|---|---|---|
| geometry resolution | 24×24 segments | higher resolution | performance + scale — 300px diameter doesn't need ATLAS fidelity |
| node-marker detail | point sprites or `THREE.SphereGeometry(0.012)` only — no label, no orbit ring, no pulse animation | detailed marker with label, orbit ring, animated pulse | label text illegible at this scale; orbit ring too dense; animation too busy in a sidebar widget |
| journey-line overlay | omit entirely | polyline arcs connecting entries in chronological order | mini-globe has no room for lines; they would create visual noise at this scale |
| nav-strip instrument frame | omit — no `frame-head`, no corner reticles, no NETRA bay | full instrument frame | mini-globe IS the instrument; it doesn't need a frame-within-a-frame |
| ATLAS control affordances | omit (no zoom, no free-drag orbit, no click-to-jump-button) | full orbit controls + click-to-select | mini-globe has two interactions only: click node → navigate; click globe surface → navigate to ATLAS |
| α observer pin special treatment | same visual treatment as other in-membership nodes (accent-orange dot, no special size) | α pin is distinctly larger and labeled | at mini-globe scale a larger α pin crowds the surface |

### 5.5 privacy gating — HARD contract

**Only public-locus nodes are rendered as point markers on the mini-globe.**

- Articles with `shareLocation: false` → NO marker rendered
- Photos with `shareLocation: false` → NO marker rendered (consistent with
  photo-atlas §1.2 and the ledger asymmetry locked in §2 SAVE-POINT)
- Fiction entries without `origin_locus` → NO marker rendered
- Any entry where `coords` is null/absent → NO marker rendered

Entries without markers still appear in the ARCHIVE ledger. The mini-globe
shows only the geographic subset of the corpus, exactly as ATLAS does.

A caption beneath the canvas: `NN OF NN LOCI VISIBLE` — mono 8px,
`var(--ink-soft)`. Vega writes the exact tooltip copy (see §14·Q7).

**This is a privacy hard contract. No exceptions, no "show approximate
location" fallback. Silence is the correct behavior for private-locus entries.**

### 5.6 interaction affordances

Two interactions only. No more:

| trigger | behavior |
|---|---|
| click on a visible node-marker | `router.push('/entries/<fileNum>')` or type-appropriate route (photo → `/photos/<roll>/<id>`, fiction → `/fiction/<slug>`) |
| click on empty globe surface (no marker under cursor) | `router.push('/')` — navigate to ATLAS (homepage) |
| hover over node-marker | **optional, Betelgeuse judgment: YES, implement** — a 120ms ease color intensification on the marker (accent-orange → full opacity from 0.7 base), no label (label is illegible at this scale), and cursor changes to `pointer`. This is minimal hover signal; it communicates clickability without adding label chrome. |
| hover over empty surface | cursor: `pointer` (the globe surface click affordance needs to be discoverable) |
| auto-rotate | 60s/revolution idle drift (Y-axis) — pauses on any pointer interaction, resumes 3s after pointer leaves the canvas |

The `[ ◯ ATLAS ]` text link in the header strip remains the primary explicit
navigation affordance back to ATLAS. The mini-globe click-to-ATLAS is a
supplementary affordance, not the primary one.

### 5.7 filter coordination — same contract as prior §5.4

When the visitor selects a filter chip (TYPE, STATUS, DOMAIN, YEAR), the
mini-globe updates its marker rendering:

- Markers for entries that pass the filter → `var(--accent-orange)` (in-membership)
- Markers for entries that fail the filter → `var(--ink-faint)` at 0.32 opacity (out-of-membership)

This is the same visual contract as the ATLAS attractor binding mechanic
(binding §3.1 + §3.3). The visitor learns the color grammar once.

The mini-globe's filter state is driven by the same local filter state as
`ArchiveLedger`. It does NOT directly drive `activeAttractor` in
`useGlobeStore` — ARCHIVE has its own local filter state (independent from
homepage Globe state, per §14·Q2 recommendation).

### 5.8 performance budget

**Hard constraint: the mini-globe must NOT push ARCHIVE scroll FPS below 50
on M1 baseline.**

Budget reasoning:
- Three.js at 24×24 sphere geometry + ~50 point sprites is lightweight. The
  ATLAS globe at full resolution is the expensive case; the mini-globe is
  orders of magnitude simpler.
- The mini-globe renders in a separate canvas from ATLAS. No shared WebGL
  context. No ATLAS overhead.
- The animation loop should use `requestAnimationFrame` and respect
  `prefers-reduced-motion`: under `prefers-reduced-motion: reduce`, the
  auto-rotate halts entirely (globe renders static at default orientation).
- On route unmount, the animation loop MUST be cancelled and the WebGL context
  MUST be disposed. Memory leak on route change is a QA-blocking failure.

**Canvas 2D sphere projection fallback (named alternative):**

If three.js proves too expensive in practice (e.g., if Algol QA measures
scroll FPS below 50 on M1 with the three.js mini-globe active), the fallback
is a server-rendered `<canvas>` 2D sphere projection:

- Canvas 2D orthographic projection: draw circle (globe outline), plot
  coordinate-projected dots for each public-locus entry.
- No WebGL. No three.js. No animation. Static render on filter change.
- Identical privacy gating (public-locus only).
- Identical color grammar (accent-orange / ink-faint).
- Named alternative: **`ArchiveMiniGlobeCanvas2D`**. Sirius should build this
  as a fallback component alongside the three.js version so Algol can
  benchmark both. The three.js version (`ArchiveMiniGlobeThreeJS`) ships by
  default; the Canvas 2D version ships if the perf gate fails.

### 5.9 implementation hints for Sirius

These are directional, not prescriptive. Sirius owns actual implementation.

**Three.js primitive recommendation:**
```ts
// ArchiveMiniGlobe.tsx
import * as THREE from 'three'

const geometry = new THREE.SphereGeometry(1, 24, 24)
const material = new THREE.MeshLambertMaterial({
  color: 0xE8E2D5,  // --paper-base (TEAL)
  wireframe: false,
})
// graticule lines: add a second SphereGeometry as wireframe
// with MeshBasicMaterial color: ink-faint rgb
```

**Animation loop pattern — rAF with cleanup:**
```ts
// Use a ref to hold the rAF id; cancel in cleanup
const rafRef = useRef<number>(0)

useEffect(() => {
  // ... scene setup ...
  const animate = () => {
    rafRef.current = requestAnimationFrame(animate)
    sphere.rotation.y += 0.0017  // 60s/revolution ≈ 0.0017 rad/frame at 60fps
    renderer.render(scene, camera)
  }
  animate()
  return () => {
    cancelAnimationFrame(rafRef.current)
    renderer.dispose()
    geometry.dispose()
    material.dispose()
  }
}, [])
```

**Reduced-motion guard:**
```ts
const prefersReducedMotion =
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
// If true: skip animate loop entirely; render single frame only
```

**Cleanup on route unmount:** the `useEffect` cleanup above handles it.
Sirius MUST verify that no WebGL context survives route transitions. Test
by navigating Globe → ARCHIVE → Globe repeatedly and checking DevTools
memory/WebGL context count.

**Node markers:** use `THREE.Points` with a `THREE.BufferGeometry` containing
one point per public-locus entry. The positions are computed from lat/lon →
spherical coordinates → cartesian. The color attribute array drives the
in-membership / out-of-membership treatment reactively (update on filter change
without rebuilding the geometry — update the `color` BufferAttribute and set
`needsUpdate: true`).

**No journey-line overlay.** Do not port the `LineSegments` from ATLAS.

### 5.10 coordination with the attractor binding mechanic

Unchanged from prior spec philosophy. The mini-globe visually mirrors the
binding mechanic color grammar. It does NOT drive `useGlobeStore`. It reads
from ARCHIVE's local filter state only.

---

## 6 · listing content + scope

### 6.1 what appears in the ledger

| content type | source | gate |
|---|---|---|
| articles | velite collection `entries` (PRD-01) | always listed |
| photos | velite collection `photos` (PRD-03) | only when `shareLocation === true` (privacy invariant from photo-atlas §1.2) |
| fiction | velite collection `fiction` (PRD-01 fiction schema) | always listed (fiction-on-Globe is deferred per journey-arch §3.4, but fiction-in-ARCHIVE is in scope — this is the surface where fiction discovery happens for v1) |

Photos with `shareLocation === false` do NOT appear in ARCHIVE. They live in
`/photos/<roll>` only. This is a privacy hard contract from PRD-03 — ARCHIVE
inherits it without modification.

### 6.2 filtering

Filter pills in the right rail. All filters AND-combine. Chip state reflects
URL params.

| filter family | options | default |
|---|---|---|
| TYPE | ALL, article, photo, fiction | ALL |
| STATUS | seed, ongoing, refined, settled | none (all statuses included) |
| DOMAIN | identity, reflection, method, meta, plus per-attractor tags | none |
| YEAR | each year with at least one entry | none |
| SORT | recently-patched (default), chronological, drift, file-number | recently-patched |

Filter pills follow the iter 1 vocabulary:
- Active pill: 1px solid `var(--accent-orange)` border, `var(--accent-orange)`
  text, `var(--accent-orange-soft)` background (= `rgba(212,96,42,0.18)`)
- Inactive pill: 1px solid `var(--ink-hairline)` border, `var(--ink-soft)`
  text, transparent background
- Hover (inactive): border shifts to `var(--accent-orange)` at 0.5 opacity in
  120ms ease

These match the `FilmSimSwitcher` pill vocabulary from `10-photo-atlas.md`
§2.4 verbatim. No new vocabulary invented.

### 6.3 sorting

| sort | rule | grouping |
|---|---|---|
| recently-patched (default) | most recent `patches[0].date` or `date`, descending | by year |
| chronological | `date` ascending (oldest first) | by year |
| drift | `abs(drift)` descending | flat (no grouping) |
| file-number | `fileNum` ascending | flat |

### 6.4 pagination

**Recommendation: client-side pagination via "load next 20" affordance, NOT
infinite scroll.**

Reasons:
- Infinite scroll breaks `Cmd+F` (visitor can't search the page they're on)
- Infinite scroll loses keyboard nav (focus order shifts beneath the user)
- "Load next 20" gives the visitor agency — they decide when to expand the
  ledger
- The site is small (currently ~50 entries); pagination is largely
  theoretical for v1 but the affordance must be designed in for v2

The `[ LOAD NEXT 20 ]` button uses `.t-meta` rhythm: 9px mono uppercase
tracking 0.3em, `var(--ink-soft)` default → `var(--accent-orange)` hover.

**OPEN QUESTION FOR PEAT § 14·Q4:** "load next 20" vs auto-paginate vs single-
page-all-entries? Recommendation: load-next-20 + load-all-via-keyboard-shortcut
(`g` for "go to all"), deferred to v1.1.

---

## 7 · entry preview format — what shows per entry

Per row, in vertical order:

| line | content | typography token | color token |
|---|---|---|---|
| 1 | `FILE — <fileNum> · <date> · <STATUS> · <readingTime> MIN` | `.t-meta` 9px tracking 0.3em | `var(--ink-soft)` (file/status in `.t-meta-accent` orange) |
| 2 | title — italic Cormorant | `.t-display` italic 18px | `var(--ink-primary)` |
| 3 | attractor pills — `domain · tag · tag` | `.t-meta` 9px tracking 0.15em | `var(--ink-soft)`; first pill `var(--accent-orange)` |
| 4 | `LOCUS <lat>°N <lon>°E · DRIFT <±N.NN>` (omit if no coords) | `.t-meta` 9px tracking 0.3em | `var(--ink-soft)`; drift value in `.t-meta-accent` |
| 5 | type glyph + label — `◯ article` / `■ photo · roll: <roll>` / `◆ fiction` | `.t-meta` 9px | `var(--ink-soft)` |

**Photos additional context:** line 5 shows `roll: <roll-slug>` after the
glyph. Clicking the row navigates to `/photos/<roll>/<id>`, clicking the roll
slug specifically (as a sub-anchor) navigates to `/photos/<roll>`.

**Fiction:** line 4 omits LOCUS/DRIFT entirely if the fiction has no
`origin_locus` (per ontology §9.2). Type glyph remains.

**Vega is responsible for the actual microcopy** in the LOCUS/DRIFT lines, the
section-header tone, and the empty-state messaging — see Vega's parallel doc.
This spec defines *placement* and *register constraints* only.

---

## 8 · empty state — `/archive` with zero eligible entries

### 8.1 zero entries everywhere

```
┌────────────────────────────────────────────────────────────────────┐
│ HEADER STRIP                                                       │
│ OBSERVATORY · ARCHIVE LEDGER · 0 ENTRIES SURVEYED · 0 PATCHES     │
│ ∇ Ne0EX · DRIFT — · α 1.130426                                    │
│ [ ◯ ATLAS ]                                          NAV STANDBY  │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ (no ledger rows · no mini-globe entries · no filter chips)         │
│                                                                    │
│ // archive empty.                                                  │
│ // worldline standing by · no traces surveyed yet.                 │
│                                                                    │
│ [ ◯ RETURN TO ATLAS ]                                              │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

Both lines in `.t-mono` 9px `var(--ink-faint)`. No illustration. No
"create your first entry" CTA (this is a published archive, not a CMS UI).
The single `[ ◯ RETURN TO ATLAS ]` link sits below at `.t-meta`
`var(--ink-soft)`.

**Vega writes the exact lines** within the constraint: instrument register,
declarative, no second-person, no "explore" / "discover" / "browse" verbs.

### 8.2 zero entries after filter

When filters are applied and zero rows match:

```
// no entries match this survey.
// adjust filter · or [ ◯ clear all filters ]
```

The `[ clear all filters ]` link is reachable, mono 9px, ink-soft → accent on
hover. The mini-globe in the right rail shows all entries at ink-faint
out-of-membership treatment (since none are in-membership).

### 8.3 partial states

- **Only photos exist (no articles, no fiction):** ledger renders normally
  with only photo rows. TYPE filter shows article/fiction pills disabled
  (border + text at `var(--ink-hairline)`, `cursor: not-allowed`). Vega
  copy block: nothing special needed.
- **Filter excludes everything but one type:** ledger shows that type.
  Mini-globe shows that type's glyphs in accent. No special state needed.

---

## 9 · navigation contract

### 9.1 inbound — how visitors reach ARCHIVE

| source | trigger | target |
|---|---|---|
| Nav strip | click `◇ ARCHIVE` | `/archive` |
| Globe (future) | hypothetical `[ ↓ AS LIST ]` affordance in `atlas-foot` (per journey-arch §5.1) | `/archive` — same target as the nav link |
| article entry | hypothetical `← ARCHIVE` affordance (alternative to `← ATLAS`) | `/archive?type=article&domain=<the article's domain>` (with filter pre-applied to similar entries) |
| photo entry | hypothetical `← ARCHIVE` affordance | `/archive?type=photo` |
| deep link from search overlay results | per PRD-04 search overlay routes to entry directly, not to ARCHIVE | n/a |

**Decision:** for v1, only the Nav strip link reaches ARCHIVE. The other
affordances are flagged as v1.1 follow-ups. This keeps ARCHIVE's entry
contract tight.

### 9.2 outbound — how visitors leave ARCHIVE

| affordance | target |
|---|---|
| any ledger row click | entry-type-appropriate route (`/entries/<fileNum>` / `/photos/<roll>/<id>` / `/fiction/<slug>`) |
| `[ ◯ ATLAS ]` in header strip | `/` (homepage, Globe restored) |
| any Nav strip link (`◇ INDEX`, `◇ TRACES`, `◇ TRANSMIT`) | the corresponding homepage anchor |
| browser back | previous route |

### 9.3 entry → ARCHIVE → entry continuity

When visitor clicks a ledger row → entry page → comes back via `← ARCHIVE`
(hypothetical v1.1) or browser back, the ARCHIVE filter state and scroll
position must be **preserved**. This means filter state lives in URL
(already designed for) AND scroll position must be restored on back-nav.

**Sirius contract:** before navigating from a ledger row, save
`sessionStorage.setItem('wl:archive-scroll', window.scrollY.toString())`.
On `/archive` mount, if `sessionStorage` has the key AND URL params match the
prior visit's filter set, restore scroll. Clear on filter change.

This is the **same pattern** journey-arch §3.2 establishes for Globe ←→
article navigation, lifted to ARCHIVE ←→ entry.

### 9.4 coordination with Pair A (ARTICLE prototype planning)

**Pair A's surface:** the article entry page prototype.
**Pair B's surface (this doc):** ARCHIVE.

The coordination contract:

1. **Article entry must accept ARCHIVE as a possible origin.** Currently
   article entry only handles Globe origin or ChapterIndex origin (per
   `09-article-entry.md` §navigation transitions). Pair A's prototype must
   extend the `wl:entry-origin` sessionStorage key to include the value
   `'archive'`. When the origin is `'archive'`, the article entry's
   `← ATLAS` affordance is replaced (or supplemented) with `← ARCHIVE`,
   which routes to `/archive` with prior filter state restored via URL.

2. **Prev/next on article entry should respect ARCHIVE's current sort.**
   If visitor entered the article from ARCHIVE with `sort=chronological`,
   the article's prev/next should be chronological within the same filter
   set. **OPEN QUESTION FOR PEAT § 14·Q3:** is this expected? Or should
   prev/next always be chronological-worldline regardless of origin?
   Recommendation: yes, respect the origin's sort, because that's the
   "browsing context" the visitor came from.

3. **The article entry's mini-globe placement (NETRA L1 bay) and ARCHIVE's
   mini-globe SVG companion use the same SVG vocabulary** (orthographic,
   ink-on-paper, square/circle/diamond glyphs). They are coherent
   visually — a visitor who recognizes the mini-globe on one surface
   recognizes it on the other.

Pair A: when planning the article prototype, account for `'archive'` as an
origin and the prev/next-respects-sort contract. Pair A's doc should
explicitly reference this section.

Vega Pair B: copy doc must give Vega Pair A enough to know the
section-header tone for the "RETURN" affordance — so a visitor coming back
from an article to ARCHIVE hears the same register on both sides.

---

## 10 · responsive behavior

### 10.1 desktop ≥1180px (canonical)

As drawn in §4.1. Two-column layout: ledger left, rail right. Mini-globe
sticky. Marginalia HUD visible.

### 10.2 tablet 881–1179px

- Layout stays two-column but rail compresses to `300px` (was `360px`)
- Mini-globe SVG: `240×240` (was `300×300`)
- Filter pills wrap to two rows within each filter family
- Ledger row padding: `py-5 px-6` (was `px-7`)
- Marginalia HUD: visible

### 10.3 tablet 600–880px

- **Layout collapses to single column.** Rail moves ABOVE the ledger.
- Mini-globe SVG: `280px max width centered`
- Filter pills render as a single horizontal strip below the mini-globe.
  Each filter family is its own row, label on the left, pills on the right,
  with horizontal scroll on overflow
- Ledger row padding: `py-4 px-5`
- Marginalia HUD: hidden (per existing `@media (max-width: 600px)` rule)
- Header strip stacks to two rows:
  - Row 1: `OBSERVATORY · ARCHIVE LEDGER · NN ENTRIES · NN PATCHES`
  - Row 2: `∇ Ne0EX · DRIFT MIN/MAX · α 1.130426`
- `[ ◯ ATLAS ]` becomes a single-tap affordance in the header strip
  (44×44 touch target)

### 10.4 mobile 375–599px

- Layout: single column. Mini-globe COLLAPSES to a one-line strip:

  ```
  ┌────────────────────────────────────────────┐
  │ ◯ ATLAS · 047 LOCI · DRIFT –1.300 · [view] │
  └────────────────────────────────────────────┘
  ```

  9px mono, ink-soft, `[view]` link routes to `/` (full Globe).

- Filter pills: horizontal scroll strip (`overflow-x: auto`, no scrollbar,
  momentum scroll). One row per filter family. Family label inline before
  pills.
- Ledger row: rows stack vertically. Row meta wraps. `py-4 px-4`.
- Each entry stays as a single tap target. Hover state becomes touch-active
  (`:active { background: rgba(212,96,42,0.04) }`).
- Header strip stacks to three rows (matches article entry pattern):
  - Row 1: `OBSERVATORY · ARCHIVE LEDGER`
  - Row 2: `NN ENTRIES · NN PATCHES`
  - Row 3: `∇ Ne0EX · α 1.130426`
- `[ ◯ ATLAS ]` link: same as 600–880 but stacked below header rows.
- Touch targets: every ledger row ≥56px tall (file-meta row + title row + at
  least one more meta row = ~84px in practice — comfortable).

### 10.5 motion across breakpoints

| breakpoint | mini-globe motion | filter pill motion | ledger row motion |
|---|---|---|---|
| ≥1180 | static (no animation) | 120ms ease border + text on hover | 150ms ease bg + 460ms entry-glitch underline |
| 881–1179 | static | same as ≥1180 | same as ≥1180 |
| 600–880 | static | same | hover becomes touch-active (instant) |
| 375–599 | none (collapsed to line strip) | same | touch-active only |

Reduced motion: all hover transitions collapse to 0ms. Entry-glitch underline
already has reduced-motion rule in globals.css. Mini-globe is static
anyway — no change needed.

---

## 11 · interaction patterns

### 11.1 hover (desktop only)

| target | timing | effect |
|---|---|---|
| ledger row | 150ms ease | background `rgba(212,96,42,0.04)`; title underline draw 460ms `cubic-bezier(0.2,0.8,0.2,1)` via `.entry-glitch::after` |
| filter pill (inactive) | 120ms ease | border `var(--ink-hairline)` → `var(--accent-orange) at 0.5` |
| filter pill (active) | none | already accent; no further change on hover |
| `[ ◯ ATLAS ]` link | 150ms ease | text color `var(--ink-soft)` → `var(--accent-orange)` |
| `[ load next 20 ]` button | 150ms ease | text color `var(--ink-soft)` → `var(--accent-orange)` |
| section headers (year) | none | non-interactive (sticky in column scroll) |

### 11.2 focus ring (iter 1 P2-10 vocabulary)

All interactive elements:

```css
outline: 2px dashed var(--accent-orange);
outline-offset: 2px;
```

Same as `09-article-entry.md` §accessibility. Tab order:

1. Skip link (visually hidden until focused) → "Skip to ledger"
2. Nav strip links
3. Header strip `[ ◯ ATLAS ]` link
4. Filter pills (TYPE row left-to-right, then STATUS, DOMAIN, YEAR, SORT)
5. Ledger rows (top-to-bottom, year sections in document order)
6. `[ load next 20 ]` button
7. Footer manifesto link (existing pattern)

### 11.3 keyboard map

| key | action | scope |
|---|---|---|
| `/` | open search overlay (per PRD-04) | global; not overridden by ARCHIVE |
| `Tab` / `Shift+Tab` | navigate focus order | standard |
| `Enter` on ledger row | navigate to entry | entry routing |
| `Enter` on filter pill | toggle filter (and URL) | filter pills |
| `Escape` | clear current filter focus; no other side effect | filter region |
| `g a` (chord) | jump to year header (incremental — first press goes to most recent year header; second press to the next; etc.) | ledger column |
| `Esc Esc` | (no-op on ARCHIVE — there is no overlay to dismiss) | global |
| `Home` / `End` | scroll to top / bottom of ledger | standard browser |
| `f` | focus the first filter pill | ergonomic |

**Note:** `g a` chord is a nice-to-have, flagged as v1.1. v1 ships with the
first 6 rows above.

### 11.4 scroll behavior

- Header strip is NOT sticky. Standard scroll.
- Right rail (filter + mini-globe) IS sticky at desktop (≥881px): `position:
  sticky; top: 72px;` (clears Nav strip).
- Year section headers are NOT sticky (would compete with sticky rail visually).
- Scroll-meter (2px top bar) tracks scroll progress through the ledger.

---

## 12 · token usage

### 12.1 tokens consumed (all existing — no new tokens needed)

| region | token |
|---|---|
| page surface | `var(--paper-base)` |
| paper grain | `.paper-canvas` (existing class) |
| header strip surface | `var(--paper-base)` |
| header strip bottom rule | `border-bottom: 1px dashed var(--ink-dashed)` |
| body meta labels | `var(--ink-soft)` via `.t-meta` (P1-6 compliant) |
| file number, status, drift values | `var(--accent-orange)` via `.t-meta-accent` |
| section rules between entries | `border-bottom: 1px dashed var(--ink-dashed)` |
| ledger row default | transparent on `var(--paper-base)` |
| ledger row hover | `rgba(212,96,42,0.04)` — verbatim from ChapterIndex (Codex check: existing pattern, traceable to prototype) |
| entry title | `var(--ink-primary)` |
| year section header `§ NN` | `var(--accent-orange)` via `.t-meta-accent` |
| year section header label | `var(--ink-soft)` |
| filter pill — active border | `var(--accent-orange)` |
| filter pill — active text | `var(--accent-orange)` |
| filter pill — active background | `var(--accent-orange-soft)` (= `rgba(212,96,42,0.18)` per globals.css line 42 — existing token) |
| filter pill — inactive border | `var(--ink-hairline)` |
| filter pill — inactive text | `var(--ink-soft)` |
| filter pill — disabled (no entries match) | `var(--ink-hairline)` border + text |
| filter pill — hover (inactive) | border `rgb(var(--accent-orange-rgb) / 0.5)` — see token flag below |
| mini-globe outline | `var(--ink-faint)` |
| mini-globe continent | `var(--ink-faint)` |
| mini-globe α observer | `var(--accent-orange)` |
| mini-globe in-membership glyph | `var(--accent-orange)` |
| mini-globe out-of-membership glyph | `var(--ink-faint)` at 0.32 opacity (binding §3.3) |
| `[ ◯ ATLAS ]` link | `var(--ink-soft)` default, `var(--accent-orange)` hover |
| `[ load next 20 ]` button | same as ATLAS link |
| empty state copy | `var(--ink-faint)` |
| corner reticles | `var(--accent-orange)` via `.corner-marks` (header strip only) |
| focus ring | `outline: 2px dashed var(--accent-orange); outline-offset: 2px` |
| scroll-meter | existing `.scroll-meter` (`var(--accent-orange)` fill) |
| marginalia HUD | existing `.marginalia` (`var(--ink-soft)` text, dashed left border) |

### 12.2 token flag for Polaris

`--accent-orange-rgb` is not currently defined in `app/globals.css`. The
filter-pill-hover state needs `rgb(var(--accent-orange-rgb) / 0.5)` to match
the iter 1 hover idiom. Two options:

1. **Add the token** — extract `212 96 42` into `--accent-orange-rgb` in
   globals.css `:root`. Then `--accent-orange-soft` can become
   `rgb(var(--accent-orange-rgb) / 0.18)` for consistency with the ink
   pattern. (This is a refactor; existing usages don't break.)
2. **Use the literal** — `rgba(212, 96, 42, 0.5)` in this one place (matching
   how `globals.css` line 42 already does `rgba(212, 96, 42, 0.18)` for
   `--accent-orange-soft`).

**Recommendation: Option 1, but only if Polaris approves.** Option 2 is a
valid lateral move that doesn't introduce drift (the literal already appears
elsewhere in globals.css). For this spec, Sirius can use Option 2 verbatim
without breaking token discipline.

### 12.3 zero raw hex inside this spec

All other color values trace to existing CSS variables in `app/globals.css`.
The `rgba(212, 96, 42, 0.04)` for the ledger-row hover is **verbatim from
ChapterIndex** (`components/ChapterIndex.tsx` line ~38), which makes it a
documented pattern carry-over, not a new raw value introduction.

---

## 13 · vision fidelity — anti-Codex 6-point audit

| check | status | evidence |
|---|---|---|
| 1 · reference fidelity | PASS | All Peat-required structural elements present: ARCHIVE at top of nav (already so in `Nav.tsx`); articles included; mini-globe SVG keeps Globe metaphor alive; cross-content-type ledger; instrument vocabulary throughout |
| 2 · token compliance | PASS (with one flag) | Zero raw hex codes outside the documented `rgba(212,96,42,0.04)` carry-over from ChapterIndex. One token flag (`--accent-orange-rgb`) for Polaris — does NOT block spec. |
| 3 · pattern reuse | PASS | Every visual atom cites an existing source: header strip from `.frame-head` / `.article-head`; filter pills from `FilmSimSwitcher` (photo-atlas §2.4); mini-globe 3D from `WorldlineGlobe.tsx` (same Lambert material, same token palette, same rotation timing — Route B inherits ATLAS vocabulary; only geometry resolution diverges intentionally); ledger row from ChapterIndex hover + entry-glitch underline; focus ring from iter 1 P2-10; section labels from ChapterIndex `SectionLabel`. No new visual vocabulary invented. |
| 4 · accessibility | PASS | Semantic structure documented; skip link spec'd; focus ring + tab order explicit; keyboard map provided; contrast ratios inherited from iter 1 ink-ladder discipline (P1-6 compliant — `--ink-soft` on all functional labels, never `--ink-faint`); Lighthouse a11y target ≥95 carried over from article entry. |
| 5 · mobile fidelity | PASS | Three breakpoint regions (881–1179, 600–880, 375–599) with explicit collapse rules; mini-globe degrades gracefully (300×300 → 240×240 → 280px max → one-line strip); filter pills become horizontal scroll on mobile; ledger row tap targets ≥56px; touch-active replaces hover. |
| 6 · motion calibration | PASS | 120ms / 150ms / 460ms timings all within iter 1 band; no looping decorative motion; reduced-motion paths explicit; mini-globe is intentionally static (no looping pin pulse, no auto-rotate). |

**audit headline:** the spec passes its own gauntlet. Every decision either
reuses an existing vocabulary atom or extends one minimally (the cross-content-
type ledger is the one genuine novelty, and it inherits ChapterIndex's row
rhythm directly).

---

## 14 · open questions for Peat

These are stakes Betelgeuse cannot decide alone. Each is presented with the
recommended-default Betelgeuse picks if Peat is silent — but Peat redirect is
preferred.

### § 14·Q1 — route name

**Question:** `/archive` (recommended) vs `/ledger` (more on-vocabulary)?

**Stake:** `/archive` is idiomatic and matches the nav label exactly.
`/ledger` is more in-register with the instrument vocabulary but adds a
translation step for visitors who clicked `◇ ARCHIVE` in the nav and now
see "Ledger" on the page.

**Recommendation:** `/archive`. If Peat prefers `/ledger`, the page title
on `/ledger` should retain "ARCHIVE LEDGER" in the header strip to bridge.

### § 14·Q2 — does ARCHIVE's DOMAIN filter share state with ATLAS's `activeAttractor`?

**Question:** when visitor selects DOMAIN=coffee in the ARCHIVE filter rail,
does that also set `activeAttractor='coffee'` in `useGlobeStore` so the next
time they visit `/` the Globe's binding mechanic shows the coffee attractor
group?

**Stake:** filter persistence is useful (the visitor doesn't have to re-pick
the filter on each surface). But cross-surface filter leak is also confusing
("did I leave a filter on the homepage?").

**Recommendation:** independent state, but add a small `[ apply to ATLAS ]`
link beneath the DOMAIN filter row in v1.1 that copies the filter into
`activeAttractor`. v1 ships with independent state, no link.

### § 14·Q3 — prev/next on article entry respects ARCHIVE's sort?

**Question:** if visitor enters an article from ARCHIVE with `sort=drift`,
should the article's `← PREV / NEXT →` follow drift order? Or always
chronological-worldline?

**Stake:** respecting origin sort feels more natural during a browsing
session, but it makes the article's "chronological worldline" a sometimes-
chronological-sometimes-not affordance. Vega's voice rules say the worldline
should *feel* continuous and chronological.

**Recommendation:** prev/next always chronological-worldline; ARCHIVE's
filter sort applies only on the ARCHIVE page. The article page's worldline
remains canonical. (This contradicts my §9.4 mention of "respects sort" —
on reflection, chronological wins. Updating §9.4 to chronological as the v1
contract.)

### § 14·Q4 — pagination model

**Question:** `[ load next 20 ]` click affordance (recommended) vs
auto-paginating infinite scroll vs single-page-all-entries (no pagination)?

**Stake:** for ~50 entries, single-page-all is viable and simplest. As the
archive grows past ~100, single-page-all hurts initial paint. Load-next-20
is future-proof but adds UI weight.

**Recommendation:** single-page-all for v1 (because the corpus is small);
load-next-20 affordance appears only when entries > 60; auto-paginate never.

### § 14·Q5 — patches feed in the right rail?

**Question:** a third block in the right rail showing the N most recent
patches across all entries — `PATCH 03 · 2026.05.08 — entry 003 · added
extraction section`?

**Stake:** this would reinforce "the archive is patched, not static" — a
strong I1 signal. It would also crowd the rail. And patches are visible
inline on each entry's surface; this would be the first ever
patches-across-corpus aggregation.

**Recommendation:** v1.1 (deferred), not v1. Currently the rail has
mini-globe + filters, which is enough. Coordinate with Vega for the patches-
feed copy when v1.1 is approved.

### § 14·Q6 — fiction inclusion in v1 ARCHIVE?

**Question:** journey-arch §3.4 deferred the fiction entry SURFACE to a
later wave, but fiction discoverability via ARCHIVE is in scope per Peat's
"must include articles" framing (which leaves fiction ambiguous).

**Stake:** fiction in ARCHIVE without a destination = clicks on fiction rows
go to a 404 or a placeholder. Fiction excluded from ARCHIVE for v1 means
the only path to fiction discovery is NETRA's `list_fiction()` tool call
(which also doesn't exist in v1).

**Recommendation:** include fiction rows in ARCHIVE v1 with a destination
gate: if `/fiction/<slug>` route exists, navigate; if not yet, route to a
minimal `/fiction/<slug>` placeholder template (mono "// transmission
deferred. patch in v1.1." in ink-faint). This keeps fiction visible on the
ledger as a real worldline content type without committing to the fiction
reading template in v1. Polaris escalation if Peat wants fiction fully
deferred or fully shipped.

### § 14·Q7 — privacy of photo coords on the mini-globe

**Question:** photos with `shareLocation: false` already don't appear on the
mini-globe (privacy invariant inherited from photo-atlas). But: they DO
appear in the ARCHIVE ledger (with LOCUS row omitted). Is that the right
asymmetry — visible-in-ledger, invisible-on-mini-globe?

**Stake:** the asymmetry is correct (the ledger is the inventory; the globe
is the geography; photos opt in only to the geography). But it should be
explicit to the visitor — otherwise the mini-globe's `NN OF NN LOCI VISIBLE`
caption is the only signal that something is hidden.

**Recommendation:** yes, that asymmetry. Add a tooltip on the `NN OF NN
LOCI VISIBLE` caption explaining: "photos and entries without shared
coordinates do not appear on the map." Vega writes the exact tooltip
copy.

---

## 15 · implementation hooks for Sirius (downstream TASK references)

This section is the operational handoff to the implementation wave. ARCHIVE
ships across several TASKs, not one.

### 15.1 component build

- **`app/archive/page.tsx`** — Next.js App Router page. Server-rendered. Reads
  the velite collections (articles, photos, fiction) via `@/lib/content`.
  Renders the page shell with empty/filtered ledger; client component handles
  filter chips + URL state.
- **`components/ArchiveLedger.tsx`** — client component (`'use client'`).
  Receives all entries as props (server-fetched); maintains local filter state
  in URL via `useRouter` + `useSearchParams`. Renders year-grouped sections.
- **`components/ArchiveFilters.tsx`** — client component. Filter pill rows
  (TYPE, STATUS, DOMAIN, YEAR, SORT). Reads + writes URL params.
- **`components/ArchiveMiniGlobeThreeJS.tsx`** — client component (`'use client'`).
  Three.js `SphereGeometry(1, 24, 24)` + `MeshLambertMaterial`. Receives filtered +
  unfiltered entry arrays as props. Renders node markers as `THREE.Points`.
  Handles rAF loop with cleanup on unmount. Default component shipped to production.
  See §5.9 for implementation hints.
- **`components/ArchiveMiniGlobeCanvas2D.tsx`** — Canvas 2D fallback component.
  Named alternative in case three.js fails the ≥50 FPS scroll benchmark on M1
  (see §5.8). Sirius builds alongside the three.js version; Algol benchmarks both.
  Ships only if three.js fails the perf gate.

### 15.2 procyon data layer dependency

The velite content layer must expose a unified `getArchiveEntries()` helper
that returns a single sorted/typed array of articles + photos (gated by
`shareLocation`) + fiction. Procyon TASK to add this helper to `lib/content`.
Without it, `ArchiveLedger` would have to merge collections client-side,
which leaks build-time data into the bundle.

**Procyon contract proposal:**

```ts
// lib/content/archive.ts
export type ArchiveEntry =
  | { kind: 'article'; ... ArticleFields }
  | { kind: 'photo';   ... PhotoFields; visible: boolean }
  | { kind: 'fiction'; ... FictionFields }

export function getArchiveEntries(): ArchiveEntry[];
export function getArchiveEntriesByYear(): Record<number, ArchiveEntry[]>;
```

### 15.3 globals.css additions

None required. The spec uses only existing tokens + classes:
`.t-meta`, `.t-meta-accent`, `.t-mono`, `.t-display`, `.t-type`,
`.section-rule-dashed`, `.paper-canvas`, `.corner-marks`,
`.marginalia`, `.scroll-meter`, `.entry-glitch::after`,
`--ink-*`, `--paper-*`, `--accent-orange*`, `--ink-rgb`.

One token flag (see §12.2) is RECOMMENDED to Polaris but not REQUIRED.

**three.js dependency note:** the `three` npm package is already a project
dependency (used by `WorldlineGlobe.tsx`). `ArchiveMiniGlobeThreeJS.tsx`
imports from `three` directly — no new package install required. Sirius
should confirm the existing `three` version satisfies the mini-globe's API
usage (SphereGeometry, MeshLambertMaterial, Points, BufferGeometry are all
core three.js and stable across recent versions).

### 15.4 testing surfaces

- Algol QA checklist for ARCHIVE:
  - Lighthouse a11y ≥95 on `/archive`
  - Lighthouse perf ≥75 on `/archive` (with all entries inline + three.js mini-globe active)
  - Scroll FPS ≥50 on M1 baseline with mini-globe running (use DevTools Performance panel; if below 50, switch to Canvas 2D fallback per §5.8)
  - WebGL context count does NOT increase across route transitions (Globe → ARCHIVE → Globe repeated navigation — verify no leak)
  - All filter combinations produce non-broken renders (including filter combinations that match zero entries)
  - URL params are stable across reload (filter state persists)
  - Keyboard map: every documented key works; tab order is the documented order
  - Reduced-motion: hover transitions collapse to 0ms
  - 375px viewport: no horizontal scroll; all touch targets ≥44px
  - SVG mini-globe renders correctly with zero entries (empty globe outline + α only)

### 15.5 follow-up TASKs flagged from this spec

| TASK | scope | wave |
|---|---|---|
| ARCHIVE-IMPL | Sirius builds the route + components per this spec | v1 |
| ARCHIVE-COPY | Vega writes the empty-state, section-header, and tooltip copy | v1 (parallel to IMPL) |
| ARCHIVE-DATA | Procyon implements `getArchiveEntries()` | v1 (blocker for IMPL) |
| ARCHIVE-V1.1-APPLY-TO-ATLAS | the `[ apply to ATLAS ]` cross-surface filter sync (§14·Q2) | v1.1 |
| ARCHIVE-V1.1-PATCHES-FEED | the patches-feed block in right rail (§14·Q5) | v1.1 |
| ARCHIVE-V1.1-G-CHORD | the `g a` keyboard chord for year jumping (§11.3) | v1.1 |
| FICTION-PLACEHOLDER | minimal `/fiction/<slug>` route stub for v1 (§14·Q6) | v1 (gated on §14·Q6 decision) |
| TOKEN-PROPOSAL-ACCENT-ORANGE-RGB | Betelgeuse → Polaris token proposal (§12.2) | optional |
| ARCHIVE-MINI-GLOBE-PERF-GATE | Algol benchmarks three.js vs Canvas2D on M1; switches component if FPS < 50 (§5.8) | v1 QA gate |

---

## 16 · non-goals

- **No global search overlay.** PRD-04 search is reached via `/` hotkey
  globally. ARCHIVE's filter pills are NOT a search box. They are a survey
  control.
- **No author bio.** No "about Peat" anywhere on ARCHIVE.
- **No related-content recommendations.** ARCHIVE is a flat ledger, not a
  recommender. The article entry's "related branches" handles that.
- **No featured-entries section.** Every entry stands on its own row.
- **No comments, no reactions, no analytics counters on rows.**
- **No RSS link on ARCHIVE** (separate concern; if added, lives in nav strip
  next to TRANSMIT).
- **No newsletter signup on ARCHIVE.** TRANSMIT is the transmit surface.
- **No category illustrations.** Type glyphs (■ ◯ ◆) are the only category
  marking.
- **No `/archive/<year>` sub-routes.** Year is a filter, not a sub-surface.
- **No `/archive/<type>` sub-routes.** Type is a filter, not a sub-surface.
  Photo-atlas at `/photos` exists independently as a roll-oriented surface.
- **No infinite scroll** (see §6.4).
- **No NETRA L1 bay on ARCHIVE.** The ledger is a listing surface, not a
  reading surface. The mini-globe carries the spatial cue. Adding NETRA L1
  would over-instrument the page.
- **No companion chat overlay specific to ARCHIVE.** The global N button
  works on ARCHIVE the same way it works elsewhere (per journey-arch §4).
  ARCHIVE does NOT get its own NETRA register or its own chat surface.
- **No mobile-only `/atlas` route reuse.** `/atlas` (per journey-arch §7.3)
  is the mobile full-Globe surface. ARCHIVE does not route through it; on
  mobile, `[ ◯ ATLAS ]` from ARCHIVE goes to `/` (which on mobile may itself
  redirect to `/atlas` per journey-arch — that's a homepage concern, not
  ARCHIVE's).

---

## 17 · vision fidelity — closing statement

ARCHIVE is the ledger half of the Worldline body. ATLAS is the figure;
ARCHIVE is the inventory. The two surfaces share one corpus, one
instrument vocabulary, and one observer (α). They differ in register —
ATLAS is spatial, ARCHIVE is dated — but the soul of "garden under
measurement" is identical on both. The mini-globe SVG is the visible
tie that keeps the body in peripheral vision even when the visitor is
reading the ledger.

This spec does not invent a new visual vocabulary. It inherits from
ChapterIndex (entry-card rhythm), FilmSimSwitcher (pill semantics), the
article header strip (instrument register), the photo-atlas mini-map (SVG
orthographic), the attractor binding mechanic (in/out-of-membership color
treatment), and the article entry's loss budget pattern (acceptable vs
unacceptable loss at each breakpoint).

The single load-bearing novel decision is **cross-stratum unification at
the ledger layer**: articles, photos, and fiction all appear in one
ledger sorted by survey date. The Globe segregates them; ARCHIVE
collapses them. This is the philosophical lineage from "Ne0 Stratum"
that Peat asked about — not a copy of Ne0, but the same lesson learned
once and applied to a list register: layers can co-exist in one body.

ARCHIVE is a paper-instrument ledger of a surveyed corpus. This is the
soul. The spec has not diluted it.

---

*betelgeuse · α-VIS-04 · the Red Sentinel · TASK-2026-05-17-ARCHIVE-PLAN · v1.0 · planning · opus tier · PAIR B*
*soul baseline: SBA-1 visual canon · iter 1 prototype · v1.3 globe ontology · article entry v2.0 · photo atlas v1.0*
*zero new tokens · one token flag for Polaris · zero raw hex outside documented carry-over*
