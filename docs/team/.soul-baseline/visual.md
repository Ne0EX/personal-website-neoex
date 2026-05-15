# Soul Baseline Audit — Visual Canon

> Author · Betelgeuse (α-VIS-04) · TASK-2026-05-15-SBA-1 · 2026-05-15
> Protocol ref · VISION-FIDELITY.md §11 item 1
> Status · CANON v1.0 · locked as Betelgeuse territory
> Read alongside · Vega's voice.md + Arcturus's netra.md in this same directory

---

## audit scope

Two approved baselines. One soul. This document records what each baseline
preserves, where they diverge, what those divergences mean for the design
wave, and which existing specs need attention.

Baselines examined:

1. **main branch web** — `app/page.tsx` · `components/*.tsx` ·
   `app/globals.css` · `.claude/visual-diffs/main-poc-2026-05-15/shots/`
   (7 PNGs: 1180px, 880px, 600px, 375px folds; 1180px full-page; globe-wait)
2. **Globe v7.html** — `/Users/neospiritth/Downloads/Worldline Globe v7.html`
   (read in full — CSS, HTML structure, Three.js scene, interaction script)

---

## 1 · What main branch web preserves

### 1.1 palette — paper/archive

The globals.css token set is exact:

- `--paper-base: #E8E2D5` · `--paper-warm: #EDE7DA` · `--paper-deep: #D8CFB9` ·
  `--paper-bright: #F0EBDD`
- `--ink-rgb: 31 80 99` (TEAL active; navy `26 40 50` available via
  `data-palette="ink"`)
- `--accent-orange: #D4602A` · soft and faint variants in rgba
- `--netra-rgb: 77 122 146`

The palette communicates aged paper, archival density, and observational
precision. The TEAL ink shift (from navy v2 baseline) is the one active
evolution; it is tracked explicitly in the file and reversible.

Body default is `font-family: var(--font-mono)` — the instrument register is
the default reading mode, not an opt-in.

### 1.2 texture — grain + scanlines

`.paper-canvas::before` (3×3 radial-gradient dot grid, opacity 0.6) and
`::after` (repeating-linear-gradient horizontal scanlines, opacity 0.02)
are applied to the full page. This is a direct carry-over of v7's
`.artifact::before` / `::after` treatment — identical technique, same intent:
the paper is aged, measured, not pristine.

### 1.3 corner reticles — engineering blueprint motif

`.corner-marks` with two `::before` / `::after` pseudo-elements: 12×12px
L-brackets at top-left and bottom-right, 1px solid `var(--accent-orange)`.
Used on the main canvas and the diverge-panel. This is one of the three
primary visual markers of Worldline's instrument vocabulary. Nothing else
on the web uses L-brackets as decoration. It is unique to this system.

### 1.4 type rhythm — three families, one hierarchy

| token | family | role |
|---|---|---|
| `.t-display` | Cormorant Garamond italic | reflective copy, pullquotes, voice |
| `.t-mono` / body default | JetBrains Mono | instrument readouts, metadata |
| `.t-type` | Special Elite | typewritten numerals, values |

The 9px / 0.3em tracking / uppercase combo (`.t-meta`) is encoded as a class,
not an arbitrary value. It appears on every readout label. The number scale
(`--num-size: 38px`) is used for DivergenceMeter. These three families in
their established roles are non-negotiable. No other families appear.

### 1.5 instrument structures — hairlines, dashes, marginalia

- `.section-rule` (1px solid `--ink-hairline`) and `.section-rule-dashed`
  (1px dashed `--ink-dashed`) separate sections. No solid block dividers.
- `.marginalia` — fixed right-edge 28px strip, dashed left border, ruled
  background, vertical writing-mode text. Hides below 600px.
- `.scroll-meter` — 2px top bar, marching-dash animation, accent-orange fill.
  This is motion that communicates progress, not decoration.
- `.diverge-panel` — corner reticles in micro (8×8px), `--paper-base`
  background, mono meta label, Special Elite numeral for the divergence
  reading.

### 1.6 A.T.L.A.S. instrument frame — full vocabulary

The `.atlas-frame` block in globals.css is the most complete instrument
vocabulary the main branch carries:

- `.atlas-head` — dashed bottom border, mono uppercase 9px 0.22em tracking,
  accent-orange on identifiers
- `.atlas-strata-btn` — border transitions on hover (orange), translateX(2px)
  on hover, active state with left-edge hairline pointer
- `.atlas-globe-wrap` — dashed border, crosshatch grid background (two
  repeating-linear-gradients), the ink-on-paper cartographic frame
- `.atlas-alpha-mark` — italic Cormorant 200px, rgba(212,96,42,0.10), the
  α watermark behind the globe; presence without dominance
- `.atlas-hud-corner` — four corners of the globe canvas carrying instrument
  readings (OBSERVING / CAMERA / α / SCALE)
- `.atlas-netra` — NETRA console at the foot: grid layout, netra-rgb border,
  pulsing reticle (`atlas-netra-pulse` 2.4s), jump button

### 1.7 component relationships — accepted continuity

The seven screenshots show the accepted relationship:

1. Nav strip (mono uppercase, three-column grid: id / links / clock)
2. HeroBlock — FILE 000 / title italic Cormorant / divergence + counts
3. DivergenceMeter band — full-width, slightly ink-tinted surface
4. A.T.L.A.S. frame — Globe is the body of the page; instrument rail surrounds it
5. ChapterIndex — below-fold list, mono typography, no cards
6. AttractorFields — pill tag row, below ChapterIndex
7. FooterManifesto — anchor, instrument register

At 1180px, this is the canonical desktop stack. At 880px, ATLAS collapses to
single-column (existing globals.css media query). At 600px and 375px the fold
is empty — a documented gap, not an accepted state.

### 1.8 motion — calibrated, not decorative

Defined motion in globals.css:

- `scroll-march` — 1.4s linear loop on scroll-meter marching dashes; the
  one looping animation; justified because it communicates continuous state
- `atlas-netra-pulse` — 2.4s ease-in-out on NETRA reticle; communicates
  readiness, not decoration
- `.entry-glitch::after` — 460ms cubic-bezier(0.2, 0.8, 0.2, 1) underline
  draw on hover; restrained, communicates selection
- `@media (prefers-reduced-motion: reduce)` — kills all animations and sets
  transition-duration 0.001ms. Present and correct.

Main branch does not yet implement the 700–1400ms ATLAS camera travel motion
in CSS (that lives in WorldlineGlobe.tsx's requestAnimationFrame loop).
The CSS side is clean.

---

## 2 · What Globe v7.html preserves

### 2.1 the globe as instrument body, not decorative hero

v7 opens with a `div.artifact` containing `div.frame` — a structured
document (head, content, foot) that the globe lives INSIDE, not the reverse.
The canvas is `position:absolute; inset:0` within `.globe-wrap`. The frame
commands; the globe is evidence within it.

This hierarchy is non-negotiable per I2. A globe that IS the page, with text
overlay, is the wrong hierarchy. The instrument frame is the containing form.

### 2.2 paper-earth texture — procedural, seeded, aged

The Three.js scene in v7 builds a 2048×1024 canvas texture procedurally:

- Aged olive paper base (`#9E9377` poles → `#B5AA8B` equator), not a photo
  or a uniform color
- 18 radial warm-wash blotches (multiply) for aging
- Lat/lon grid baked as dashed lines (opacity 0.18, 0.6px) — faint, present
- Equator stronger (opacity 0.28, 0.8px)
- Pixel-level grain (rand ±10 per channel)
- Real coastline silhouette loaded via `multiply` blend at opacity 0.28,
  blurred 1.2px — the geography is present but de-emphasized

The result reads as a hand-drawn cartographic document, not a satellite view
or a SaaS globe. This specific quality is what VISION-FIDELITY §1B calls "the
v7 soul." It cannot be approximated by a wireframe globe, a flat map, or a
Three.js earth with a stock texture.

### 2.3 orbital network feel — transparency + layered geometry

v7 renders three simultaneous spatial systems visible through each other:

- **Globe sphere** (paper material, opacity 1) — the archive surface
- **Ne0N axis** — `CylinderGeometry(0.008, 0.008, 2.6)` in black, passing
  through the globe at both poles, with survey-triangle caps and orange pole
  beacons. The axis is INSIDE the sphere visually — you see it through the
  globe at the poles.
- **NeX field shells** — three concentric `wireframe:true` sphere meshes at
  radii 1.18 / 1.32 / 1.48, opacities 0.10 / 0.07 / 0.05. 48 emission rays
  from the innermost shell surface outward to radius 1.55. These are outside
  the globe, partially transparent, composited.
- **Worldline arc** — a `LineDashedMaterial` QuadraticBezierCurve3 from α
  (Bangkok) sweeping outward into the NeX field, color `0xD4602A`, marching
  dashes via `dashSize` animation.

The "transparency revealing Ne0N axis" locked by Peat (attractor-binding §1.6)
is directly present: the axis spine is visible through the paper globe.
This is not a stylistic choice — it is the ontological statement that the
pole-bearer (Ne0N) is continuous through the surface-archive (Ne0).

### 2.4 surveyed nodes — narrative coordinates, not data pins

Seven archive nodes in v7's `archiveNodes` array. Every node has:

- `lat`, `lon` — real GPS coordinates
- `label` — file number or "α"
- `place` — city + country code
- `why` — one-line narrative reason

The α node (Bangkok, 13.7563°N, 100.5018°E) is special: larger orange sphere
with a pulsing orange ring, orange dot at the pole beacons. This is Peat's
observer locus — it is visually distinct and the NETRA coordinate tracks it.

The other nodes: Kyoto (architecture of taste), Chiang Mai (why I paused the
startup), Yirgacheffe (four pours — coffee origin), San Francisco (paused
engineer — ML origin), Tokyo (active branch), Point Nemo (meta vantage).

These nodes are not data. Each has a narrative reason. This is what I1 means
by "content is planted, found, surveyed, revisited" — the Globe's pins are not
a visualization of a database; they are the archive's survey marks.

### 2.5 live instrument readouts — NETRA as attached probe

v7's NETRA console in the footer:

- Pulsing reticle SVG (2.4s, same animation as main branch)
- `id-box` with `◎ NETRA` label and live target text
- `readout` grid: RETICLE (live lat/lon from camera direction projected onto
  globe surface) · RANGE (live `camera.position.length().toFixed(2)`)
- `⟶ NEXT NODE` button that cycles through archiveNodes via 1100ms camera travel

The `window.__netraUpdate` function runs every frame in the RAF loop —
RETICLE and RANGE are live, not static. This makes NETRA feel like an
attached probe that watches the observer's direction, not a status label.

The foot also carries stratum-state readouts: NeX FIELD / Ne0N POLE /
Ne0 NODES counts. These are not in a separate panel — they are in the same
`frame-foot` as NETRA, sharing the dashed top border. They are one instrument.

### 2.6 keyboard control + drag orbit

v7 keys: `1` / `2` / `3` toggle Neo/Neon/Nex; `0` / `Escape` returns to ALL.
Pointer drag orbits the globe in ALL and NeX modes. Camera travel is 1400ms
easeInOutCubic for stratum changes, 1100ms for NETRA jump.

These are the interaction contracts the main branch's WorldlineGlobe.tsx
carries forward (same camera positions, same keymap, same timing constants).

### 2.7 font stack — three families exact

v7 CSS `:root`:

```
--font-display:'Cormorant Garamond',serif;
--font-mono:'JetBrains Mono',ui-monospace,monospace;
--font-type:'Special Elite','JetBrains Mono',monospace;
```

Identical to main branch globals.css. Not a coincidence — the font stack is
part of the soul, not a style choice.

---

## 3 · Deltas — where main branch and v7 disagree

### D1 · ink color (TEAL vs navy)

**v7:** `--ink: #1A2832` (navy, rgb 26 40 50) used throughout.
**main branch:** `--ink-rgb: 31 80 99` (TEAL active), with `data-palette="ink"`
falling back to `26 40 50`.

**Canonical:** main branch's TEAL is an accepted evolution per Peat's
Re:Boot reference. The navy backup is preserved. The Three.js scene in
WorldlineGlobe.tsx documents both in a PALETTE BACKUP comment header.

**Note for design wave:** specs must never hard-code `#1A2832` or `#1f5063`.
Use `var(--ink-primary)` and let the palette toggle govern. The soul is in
the paper/ink contrast ratio and the accent-orange, not the specific ink hue.

### D2 · globe texture gradient base colors

**v7:** `#9E9377` poles → `#B5AA8B` equator (warm olive-paper tones).
**main branch WorldlineGlobe.tsx:** `#BDBBAF` → `#D2CFC4` (cooler, lighter)
matching the TEAL palette shift; aging blotches use `rgba(70,95,108,…)`.

**Canonical:** main branch is correct for its active TEAL palette. The globe
texture must remain aged paper — neither pure grey nor flat cream. The key
quality preserved by both is the warm grain with lat/lon grid.

### D3 · strata model — toggleable framings vs co-equal co-present

**v7:** Four camera framings (`all`/`nex`/`neon`/`neo`) toggling layer
visibility. This is the implemented model; v7 treats strata as navigation
modes with `nexField.visible = t.showField` etc.

**main branch target (per attractor-binding-mechanic.md v1.1, PRD-00 v1.3,
TASK-16 reconciliation note):** Strata are co-equal peer layers simultaneously
rendered. `cameraFocus` replaces `stratum` as a camera-aid pointer. All four
base layers (`surfaceGroup` / `orbitalGroup` / `axisGroup`) always mounted.

**Canonical:** v1.3 co-present model is canonical for the RENDERER. The
soul baseline from v7 is the VISUAL FEEL — paper globe, axis through it,
shells outside it, surveyed nodes on it. That visual soul is preserved or
enhanced by the co-present renderer (all three spatial layers visible
simultaneously rather than only when the visitor toggles them). The toggleable
v7 model was a practical convenience that is now superseded.

**This delta is resolved. The soul is not at risk; the co-present model
actually deepens the soul by making the three spatial systems legible at once.**

### D4 · NETRA placement — bottom-of-instrument vs floating button

**v7:** NETRA console is in the `frame-foot` of the A.T.L.A.S. instrument,
sharing the dashed border with stratum readout counts. NETRA is an instrument
component, not a separate feature.

**main branch PoC:** A floating "N" button (bottom-left) is the only active
NETRA surface. The `.atlas-netra` console in the ATLAS foot has the reticle
+ id-box + readout + jump button implemented in CSS/globals.css, but the voice
strip behavior exists only in WorldlineGlobe.tsx's `STRATA.voice` records.

**Canonical for which dimension:**

- **ATLAS foot NETRA console (instrument identity):** v7 is canonical. NETRA
  belongs to the ATLAS instrument frame, not a floating overlay. The
  `atlas-netra` CSS class in globals.css correctly carries this.
- **Chat access point (new feature):** the floating N button / right-edge
  drawer is a NEW capability (PRD-05, journey-architecture §4). It does not
  replace the instrument console — it extends NETRA into conversational mode.
  The instrument console and the chat drawer are two faces of one navigator.

**Risk flag (see §4):** Current TASK-11 / TASK-52 chat-drawer specs must
not make the drawer feel like NETRA's PRIMARY home. The instrument console
must stay alive, or NETRA's I4 invariant collapses.

### D5 · mobile fold — empty paper vs populated

**v7:** single-viewport flat file, no mobile concern.
**main branch:** fold is empty on ≤880px viewports (documented in
60-responsive-system.md). This is an acknowledged gap, not a soul drift.

**Canonical:** the ATLAS · STANDBY card (60-responsive-system.md §7.2) is
the correct response. It preserves garden-under-survey feeling at mobile
widths by showing meter + coordinate + two affordances (OPEN ATLAS / AS LIST)
in the instrument vocabulary. The soul does not require Three.js on mobile —
it requires the garden to be locatable.

### D6 · page-level alpha watermark

**v7:** `.alpha-mark` — italic Cormorant 240px, rgba(212,96,42,0.10) —
renders inside the globe-wrap as a watermark behind the globe canvas.

**main branch:** `.atlas-alpha-mark` matches exactly (200px size, same rgba).
**Preserved.**

---

## 4 · Anti-dilution flags — §8 patterns found in current specs

The following are concrete pattern violations from VISION-FIDELITY §8, found
by reading `docs/design/*.md` written before this protocol existed. These are
flags for Polaris — not fixes from Betelgeuse.

### F1 · attractor-binding-mechanic.md — strata state naming

**File:** `docs/design/attractor-binding-mechanic.md` §4.1 + §4.2

**Pattern:** The binding mechanic's state shape introduces `cameraFocus` as
the replacement for `stratum`. This is correct per v1.3 ontology. However,
the v1 doc (before the v1.1 revision) carried the toggleable framing language
without flagging it as legacy — §1.3a was added in v1.1 to fix this.

**Status:** The v1.1 revision is correct and present. No further action
required on the doc itself. Flag is resolved.

**Residual risk:** TASK-16 through TASK-19 (v1.3 renderer implementation)
must not reintroduce `nexField.visible = false` patterns. Any Sirius TASK
touching WorldlineGlobe.tsx must be checked against the co-present contract
before dispatch.

### F2 · 09-article-entry.md — anti-dilution language present, verified clean

**File:** `docs/design/09-article-entry.md`

The spec explicitly states: "The article entry is NOT a portfolio piece. NOT a
reading-app card. NOT a SaaS content template. If it could be transplanted to
a generic CMS site without anyone noticing, it is wrong."

The layout uses `.atlas-head` class, `.section-rule-dashed`, patch log in
`--paper-warm`, corner reticle top-left, t-meta 9px tracking 0.3em for the
header strip. This is genuine instrument vocabulary reuse.

**No anti-dilution violation found.**

### F3 · 10-photo-entry.md — film-strip border is new vocabulary, needs watch

**File:** `docs/design/10-photo-entry.md`

The spec introduces a "film-strip border" — 4px ink-faint border + 8px
paper-warm margin around the photo. journey-architecture §3.3 argues this is
consistent with the cartographer language ("film leaders are cartographic
artifacts — sprocket holes = measured intervals"). The argument is defensible.

**Risk:** the film-strip border is the one genuinely new visual element in the
current wave. If implemented as a heavy-handed decorative frame (e.g., with
sprocket hole divs, thick borders, animated scanning effects), it shifts
the surface toward photographic nostalgia aesthetic rather than instrument
aesthetic. The soul is the instrument framing the photograph, not the film-
grain aesthetic framing the instrument.

**Flag for Polaris:** when TASK-31 (Sirius) implements the photo entry, the
film-strip border must be visually subordinate to the instrument readout block.
The photograph is evidence inside the instrument. The border marks the frame;
it must not become the frame's identity.

### F4 · 40-search-overlay.md — full-page modal, not drawer

**File:** `docs/design/40-search-overlay.md`

The overlay is specced as `max-width: 900px; height: 80vh; max-height: 720px`.
This is a centered document, not full-bleed. The backdrop is `rgb(var(--ink-rgb)
/ 0.15)` — very low opacity, paper-on-paper layering. The modal header reuses
`.atlas-hud-corner` atom.

**Potential drift:** the layout shows a two-column split (results list +
mini-globe), which introduces a structural pattern not present anywhere else
in the site. The mini-globe is SVG orthographic — correct, lightweight. But
the overall layout reads closer to a "command palette + preview" SaaS pattern
than a Worldline instrument surface.

**Counter:** journey-architecture §8 justifies this with "search needs the
full canvas to show both list + map." The results use file number + coordinates
+ drift + glyph taxonomy — instrument vocabulary throughout. The cartographic
feel depends entirely on execution.

**Flag for Polaris:** before TASK-41 (Sirius) implements search, Betelgeuse
should review the search spec against a rendered comp or browser shot and
check whether the two-column layout reads as "SaaS search modal" or
"triangulation instrument." This review has not yet happened — the spec was
written before Vision Fidelity Protocol existed.

### F5 · journey-architecture.md §6 audience fork — NETRA drawer risk

**File:** `docs/design/journey-architecture.md` §4

The NETRA chat is specced as a "right-edge overlay drawer" that comes from
the floating N button visible everywhere (including on entry pages, photos,
fiction — not just the Globe). This is justified as a design decision.

**The soul risk:** if the drawer becomes the primary NETRA surface and the
instrument console in the ATLAS foot becomes vestigial, I4 collapses. NETRA
becomes "a chat feature bolted on" — exactly the anti-dilution pattern
VISION-FIDELITY §8 warns against.

**The current state of the ATLAS foot NETRA console:** the CSS for it is
fully built (`atlas-netra`, `atlas-netra-voice`, `atlas-netra-pulse`). The
`voice` field in `STRATA` records in WorldlineGlobe.tsx is active. The
console renders and shows live RETICLE + RANGE readouts.

**The risk is additive, not replacement:** TASK-52 (chat drawer spec) and
TASK-11 (NETRA prompt) must not REMOVE the instrument console, must not
SILENCE the voice strip, and must not treat the floating N button as
NETRA's only identity surface.

**Flag for Polaris:** when TASK-52 is dispatched to Sirius, add the explicit
constraint: the instrument console must remain alive and the voice strip must
continue to narrate stratum state. The chat drawer extends NETRA into a
conversational mode; it does not retire the instrument mode.

### F6 · 60-responsive-system.md — mobile identity is at risk

**File:** `docs/design/60-responsive-system.md` §1

At MID (601–880px) and NARROW (≤600px), the spec replaces Three.js with an
"ATLAS · STANDBY card." The card has: corner reticle, mono instrument label,
α reading, two CTAs. This is specified correctly.

**Risk:** if the STANDBY card is implemented as a flat text block without the
instrument texture (no `.paper-canvas` grain, no dashed borders, no `.t-meta`
rhythm), it reads as "mobile unavailable" rather than "observatory at standby."
The VISION-FIDELITY §6 loss budget:

- **Acceptable loss:** Three.js globe, three-column ATLAS layout, orbital
  network animation
- **Unacceptable loss:** the feeling that the archive is surveyed; α + trace
  count + divergence meter; corner reticles
- **Compensation:** ATLAS STANDBY card must preserve α, trace count, mini-globe
  indication, and a route back to full ATLAS

The spec mentions the correct elements. The risk is purely implementation.

**Flag for Polaris:** when TASK-61 (ATLAS STANDBY card implementation) is
dispatched, link it explicitly to the VISION-FIDELITY §6 loss budget above.
Algol's QA for that TASK must render the card on a 375px viewport and check
that it still reads as "Worldline is here, surveying, just not rendering Three.js."

---

## 5 · Recommendations for Polaris

Ordered by priority. All are flags, not fixes — Betelgeuse does not modify
specs here.

### R1 · REVISE TASK-11/TASK-52 dispatch (NETRA chat)

Before Sirius implements the NETRA chat drawer, add a constraint to the TASK:
"The `.atlas-netra` instrument console in the ATLAS foot must remain active.
The `.atlas-netra-voice` strip must continue to narrate stratum + selection
state. The chat drawer extends NETRA's capability; it does not retire the
instrument mode." This prevents F5.

### R2 · REVISE TASK-31 dispatch (photo entry)

Add an explicit rendering checkpoint requirement before Sirius closes
TASK-31: "The film-strip border must be visually subordinate to the EXIF
instrument readout block. A rendered browser shot at 1180px must be reviewed
by Betelgeuse against the following soul check: does the photo read as
evidence inside an instrument, or does the border read as the primary frame?"

### R3 · NEW TASK — search overlay visual comp before TASK-41

Per F4: the search overlay two-column layout has not been reviewed against a
rendered comp. Add a micro-spec review step: Betelgeuse reviews a browser
rendering of a static search overlay HTML before Sirius builds it into Next.js.

### R4 · TASK-61 dispatch (ATLAS STANDBY card)

Link TASK-61 explicitly to VISION-FIDELITY §6 loss budget. Add to acceptance
criteria: "Renders on 375px viewport with `.paper-canvas` grain texture,
dashed borders, corner reticles, and α + trace count visible. Does not read
as an error state or a mobile-unavailable message."

### R5 · Globe v1.3 renderer TASKs (16–19) — soul checkpoint

Before Sirius closes any of the Globe renderer migration TASKs, a rendered
checkpoint at 1180px is required per VISION-FIDELITY §7. Minimum: a screenshot
showing all three spatial layers co-present (surface paper globe + axis spine
through the poles + NeX shells outside). Betelgeuse reviews. The soul check:
does the globe still read as a cartographic instrument with transparency and
orbital network feel (v7 D3 above)?

### R6 · DivergenceMeter on mobile fold

The 600px and 375px fold shots show empty paper. The DivergenceMeter is the
one element that communicates "this worldline has an observer, a specific locus,
a reading." At every viewport, Peat must be present in the instrument layer.
The ATLAS STANDBY card includes α and divergence, but the HeroBlock strip at
MID/NARROW must also include at least the compact DivergenceMeter or its
equivalent — the fold cannot be empty paper for a return visitor.

This may already be handled by 60-responsive-system.md §2 correction 1
(re-anchor the `lg:` breakpoint). Polaris should confirm this correction is
in scope for the next Sirius TASK touching HeroBlock.

---

## summary — canon statements

**The visual soul of Worldline is:**

1. A paper instrument that contains a surveyed archive, not a globe that
   contains content.
2. Aged, seeded paper grain with lat/lon contours — not a clean slate.
3. Three co-equal spatial systems (surface / axis / orbit) visible through
   each other via transparency — not layered independently.
4. Surveyed nodes at real-world coordinates with narrative reasons — not data
   pins derived from a schema.
5. Mono uppercase 9px / 0.3em tracking as the instrument register — not
   metadata styling.
6. NETRA as attached probe of the ATLAS instrument, narrating what the camera
   sees — not a chat feature bolted on.
7. Motion that communicates state change (1400ms camera travel, 120ms hover,
   2.4s reticle pulse) — not decorative.
8. Corner reticles, dashed hairlines, and the marginalia strip as the
   structural signatures of this artifact — not arbitrary decoration.
9. Cormorant italic for voice and reflection, JetBrains Mono for instrument
   output, Special Elite for typewritten values — three roles, never mixed.

**The one accepted evolution:** TEAL ink (`31 80 99`) over navy (`26 40 50`).
Both are in the system. The soul is in the contrast ratio and the accent-orange,
not in the specific hue.

**The one unresolved delta:** the toggleable stratum framings in the current
WorldlineGlobe.tsx are legacy. The v1.3 co-present renderer is the target.
The soul is preserved or deepened by the target — the three spatial layers
of v7 were always meant to co-exist.

---

*Betelgeuse · α-VIS-04 · TASK-2026-05-15-SBA-1 · 2026-05-15*
