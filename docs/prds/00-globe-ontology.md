# Globe Ontology

> **SUPERSEDED · 2026-05-15.** This document is v0.1. The canonical source is `docs/prds/00-globe-ontology-1.2.md` (v1.3). Do not implement against v0.1. Retained for changelog provenance only.

> Status: v0.1 — 2026.05.12
> Companion: `docs/00-netra-character.md`, `docs/00-atlas-boot.md`, PRD 0 (worldline master), PRD 01 (entries), PRD 03 (photos)
> Audience: implementers, content authors, future contributors, and runtime systems that must reason about the globe's spatial model.

---

## 0. Distillation

The globe is not a decoration. It is not a hero animation. It is not "a visualization of my blog."

The globe is **the geometry of how one mind thinks, rendered in space**. Photos are the surface — what happened, where. Articles and fiction are the possibility field — ideas in orbit, with lineages between them. The vertical axis through the globe's center is the observer himself — α, the locus from which everything is read.

A visitor who lands here is not browsing a portfolio. They are walking around a small body in space whose shape *is* its argument.

> *The globe is the writer's mental model made spatial. Strata are not pages. They are layers of a single body.*

If a feature, decoration, or interaction violates this — if the globe starts feeling like a 3D menu, a navigation toy, or a splash animation — that feature is wrong.

---

## 1. What the globe is

### 1.1 One body, three strata, simultaneous

The globe holds three layers of meaning, **co-present in the same scene**:

- **Ne0 — Surface.** Photos pinned at real GPS coordinates. The ground layer. *What happened, where.*
- **NeX — Orbit.** Articles and fiction as nodes in an idea-network, hovering above the surface. Edges between them encode the *worldline mechanics* (diverged, merged, collapsed, adjacent). *What was thought, and how thoughts relate.*
- **Ne0N — Axis.** A vertical line through the globe's poles, carrying the observer locus and α reading. *Who is observing. From where.*

All three are visible from the default camera angle. None is hidden behind a toggle. The visitor does not switch strata — they *see* the strata as one body, the way you see a planet's atmosphere, surface, and core in a cutaway diagram, all at once.

### 1.2 Why a globe (not a list, grid, or graph)

A list is sequence. A grid is taxonomy. A 2D graph is relation.

A globe is *embodied position*. It says: this thought happened *here* (literally, at this latitude/longitude in the author's life). It diverged from *that other thought*, which is *over there*. The author is at the center — not as ego, but as the only fixed point from which the rest can be measured.

The globe earns the Steins;Gate framing because the framing is *literal*: divergence becomes spatial; merging becomes a visible spline; the observer locus is a coordinate, not a metaphor.

A list would lie about the shape. A globe doesn't.

### 1.3 What the globe is NOT

- Not a navigation menu in 3D. The globe is not "click here to go to articles." Entries are reachable from the globe, yes — but navigation is a side effect of the geometry, not its purpose.
- Not a portfolio carousel. It does not advertise the author. It locates him.
- Not infinite or world-scale. It is small. Intimate. A body, not a world.
- Not generative or simulated. Every node, every edge, every coordinate is content the author placed there.
- Not interactive theater. It does not perform when hovered. It responds, then returns to rest.

---

## 2. The three strata

### 2.1 Ne0 — Surface (the ground layer)

**What lives here:** photographs.

The site's photographic archive (Fujifilm X-E5 rolls, per PRD 03) pins to the globe at the real GPS coordinates where each frame was captured. The surface is the **ground truth** of the author's life: places he physically stood.

**Spatial placement:** at globe radius `R` (the surface itself). Pin glyph rendered on the terrain.

**Symbolic register:** *what happened, where.* The most literal of the three strata. No metaphor.

**Privacy:** GPS surfaces only when the photo's frontmatter opts in (`share-location: true`). Photos without GPS or with `share-location: false` do not appear on the globe; they live in roll views only (per PRD 03). The surface is what the author chose to mark.

### 2.2 NeX — Orbit (the possibility field)

**What lives here:** articles and fiction (intercepted transmissions).

These do not have GPS — they have *meaning coordinates*. They sit in **orbit above the surface**, at a radius greater than `R`, in a thin spherical shell around the body. From the visitor's view: a constellation of nodes hovering over the world, connected by faint splines.

**Spatial placement:**
- Radius: `R × k` where `k ≈ 1.15–1.25`. Far enough above the surface to read as a separate layer; close enough that the relationship to the body is still visible.
- Longitude (domain angle): derived from each entry's `domain` field (`identity | reflection | method | meta` per existing `lib/entries.ts`). Each domain occupies a longitudinal slice of orbit. See §4.2.
- Latitude: derived from date, attractor field, or both. Recent entries pull toward one pole, older toward the other; lateral drift comes from tag clustering.

**Edges:** between orbital nodes, drawing the **worldline mechanics**:

- `diverged_from` — this entry split from an earlier one. Solid spline; small branching glyph at the source.
- `merged_with` — this entry brings two prior threads together. Solid spline converging; small convergence glyph at the merge.
- `collapsed_into` — this thread ended; its conclusion lives in the named target. Dashed spline fading toward the target.
- `adjacent` — soft kinship without direct lineage. Dotted thin line, low opacity.

**Symbolic register:** *what was thought, and how thoughts relate to each other.* This is where the worldline metaphor does its real work.

### 2.3 Ne0N — Axis (the observer)

**What lives here:** the observer locus. Nothing else.

A vertical line passes through the globe's poles, extending slightly above and below the body. Along this axis sit a small number of fixed nodes — **the observer's reading positions**.

These already exist in the codebase as `OBSERVER_NODES` in `lib/entries.ts`: **α**, **012**, **047**. They are not entries. They are not content. They are markers of *where the author stands when he reads the rest*.

- **α** sits at the equator of the axis (Y=0). It is the divergence reading. The site's current α value (`1.130426` at v1.0) is the value at α.
- **012** and **047** sit above and below α at fixed offsets. They are reading positions — different vantages from which the author has surveyed his own archive.

**Spatial placement:** along the Y axis, passing through (0, 0, 0). The line itself is faint; the nodes on it are the readable elements.

**Symbolic register:** *who is observing, from where.* The strata above and below the body are not "more content" — they are *positions of looking.*

The axis is what makes the globe a coordinate system at all. Without it, the surface and orbit would be a pretty body with no observer to read it. With it, the body becomes legible.

### 2.4 Coexistence, not toggling

The three strata are visible simultaneously from the default camera angle. There is no "Ne0 view," "NeX view," "Ne0N view." There is one globe, with three layers of detail, and the visitor's eye moves between them as they look.

This is the central architectural decision. The earlier design considered making strata into navigation modes (toggleable views, audience-fork-style). That model was rejected because it made the body into a menu. A body has surface, atmosphere, and core *at the same time*. So does this one.

Visitor reading the globe at default zoom sees:
- A terrain-textured sphere with small square pins on it (surface).
- A constellation of soft glyphs and connecting splines floating in a halo above the sphere (orbit).
- A faint vertical line through the poles, with three small markers on it (axis).

If any of these three readings is missing or muddled, the visual hierarchy (§7) needs adjustment, not the architecture.

---

## 3. Ne0 — Surface in detail

### 3.1 What appears on the surface

Only photographs. Photos with valid EXIF GPS *and* `share-location: true` in frontmatter.

Not articles. Not fiction. Not repos. The surface is *physical* — the things that need a physical location to be themselves.

### 3.2 Pin glyph and placement

- Glyph: small square (per PRD 03), distinguishing it from orbital circular nodes.
- Size: ~6px square at default zoom; scales with zoom but caps at ~12px and bottoms at ~3px (still hittable).
- Color: tinted by the photo's film simulation when available (see PRD 03's palette mapping); otherwise the active palette's accent.
- Anchor: the GPS coordinate becomes (latitude, longitude) on the sphere; the pin sits on the terrain at that point.

### 3.3 Clustering

When pins fall within a small angular distance of each other (e.g., multiple photos from the same neighborhood):
- They render as a single **cluster glyph** with a numeric badge showing the count.
- Hovering a cluster expands it to a spread of individual pins (with a brief animation).
- Clicking the cluster zooms the camera to that region.

Threshold for clustering should be tuned against actual photo distribution. Recommend starting at angular distance ≤ 1.5° at default zoom; revise after first roll is in.

### 3.4 Interaction on surface

- **Hover.** Display NETRA's paired register response (per character bible §11.2):
  - Instrument: `PIN · 18.78°N · 98.99°E · CHIANG MAI · TH`
  - Companion (narrative slot, optional): `*"frame 043 ค่ะ. classic chrome. รูปนี้เป็นรูปแรกของวันนั้น."*`
- **Click / tap.** Navigate to the photo entry page (per PRD 03 §3.3 design).
- **Cluster click.** Camera zooms to expand the cluster; second click on an individual pin navigates.

The surface is the most directly mapped stratum: visitor clicks → visitor reaches the actual photo. No metaphor in between.

---

## 4. NeX — Orbit in detail

### 4.1 What appears in orbit

Articles and fiction. Each one is a **node**.

Repos *can* live here too if PRD allocates them an orbit (the GitHub-coupled writeups in feature brainstorm §1.4 are content of a kind). v1.0 ships with articles + fiction; repos can join later without re-architecting.

### 4.2 Placement rules

Each orbital node has three derived coordinates:

**Radius `k × R`.** Roughly 1.18 by default. Articles and fiction occupy the same shell — they are not on separate orbits. The shell is thin, not a thick atmosphere; the nodes feel like they hover *just* above the body.

**Longitude (domain angle).** Each entry's `domain` field selects a meridian slice:
- `identity` → centered on 0° longitude (front of the body as the visitor first sees it)
- `reflection` → centered on 90°
- `method` → centered on 180° (the far side)
- `meta` → centered on 270°

Each entry drifts within ±35° of its meridian. The exact lateral position is derived from the entry's primary attractor-field tag (existing `ATTRACTOR_FIELDS` in `lib/entries.ts` already partitions tags into groupings; lateral drift is a hash of the tag set).

**Latitude.** Derived from date. Newer entries pull toward the north pole (Y > 0); older toward the south (Y < 0). The most recent entry sits at roughly Y = +0.6 × R; the oldest sits at roughly Y = −0.6 × R. New entries published over time push the older ones slightly downward — the orbit *records time* in altitude.

This means the orbit visibly has structure: domain clusters by longitude, age stratifies by latitude. A new article on `method` joins the back side of the orbit at the equator and slowly drifts down over years.

### 4.3 Edges — the worldline mechanics

Each article or fiction entry may declare *edges* in its frontmatter pointing to other entries:

```yaml
diverged_from: ["001"]
merged_with: ["002", "004"]
collapsed_into: "017"
adjacent: ["003", "005"]
```

These are **content-authored**, not auto-derived. The author declares lineage explicitly. The globe renders what is declared.

| Edge type | Meaning | Visual |
|-----------|---------|--------|
| `diverged_from` | This entry split off from the named entry. The author was thinking *X*, then this thought branched away. | Solid spline from source to this node. Small branching glyph at source. |
| `merged_with` | This entry brings two or more prior threads together. | Solid splines from each named source converging at this node. Convergence glyph at this node. |
| `collapsed_into` | This thread ended; its conclusion was absorbed by the named target. The named target is the resting place. | Dashed spline from this node to target, fading toward target. |
| `adjacent` | Kinship without lineage. The two entries are near in attractor field, but neither caused the other. | Dotted thin line, low opacity. |

Edges are directional except `adjacent`. The arrow of time matters in worldline mechanics — divergence and collapse are not symmetric.

### 4.4 Edge rendering

Splines are drawn on or near the orbital shell — **great-circle arcs at radius `k × R`**, not straight lines through the body. Lines that pass through the globe are visually wrong: thought does not travel through the author.

Edge stroke widths:
- `diverged_from`, `merged_with`: 1.5px at default zoom.
- `collapsed_into`: 1px, dashed.
- `adjacent`: 0.75px, dotted, ~40% opacity.

Color: muted accent of the active palette. Edges should be readable but not visually loud — the nodes are the figures; the edges are the ground.

### 4.5 Glyph variants

- Article node: small filled circle, ~4px at default zoom.
- Fiction node: small open ring (same diameter, hollow center) — distinguishes it at a glance from articles without requiring a legend.
- Repo node (when added later): small filled square rotated 45° (diamond).

Each stratum thus has a distinct glyph family: surface = square, orbit-articles = circle, orbit-fiction = ring, orbit-repos = diamond, axis = vertical bar (§5.3). The visitor learns to read the layers as different *kinds of mark*, not different *colors*.

### 4.6 Interaction in orbit

- **Hover.** NETRA pair:
  - Instrument: `NODE · 003 · METHOD · 2026.05.07`
  - Companion (narrative slot): `*"on the architecture of taste — diverged from 001, four-pours line."*` (Thai equivalent available; see character bible §11.6 for tone)
- **Click / tap.** Navigate to the entry page.
- **Hover on edge.** Show edge type and the two endpoints. NETRA may surface companion-register read: `*"diverged from 001 — the method line splits here."*`
- **Click on edge.** Camera flies along the spline toward the target node (~600ms ease). Lands oriented to read both endpoints.

The edge-flying behavior is the **moment where worldline mechanics become embodied for the visitor**. They are not reading a list of related entries — they are watching the camera trace a thought's divergence.

---

## 5. Ne0N — Axis in detail

### 5.1 What appears on the axis

Three nodes, fixed: **α**, **012**, **047**. These are the `OBSERVER_NODES` already defined in `lib/entries.ts`. The axis renders only what is there — no other content joins.

These nodes do not navigate to entry pages on click (there are no entry pages for them). They are *positions*, not destinations.

### 5.2 The axis line itself

A faint vertical line passing through (0, 0, 0), extending from Y = −1.4 × R (below south pole) to Y = +1.4 × R (above north pole). Stroke 0.5px, low opacity (~25%). Just barely visible — the axis is *implied* spatial structure, not a foregrounded element.

The three nodes are the readable elements; the line is the line that connects them.

### 5.3 Node glyph

Each observer node renders as a small vertical bar (~6px tall, 1.5px wide) centered on the axis. The bar visually echoes the line it sits on. A small label rendered next to each node displays its name and reading:

```
∇ α    · DIVERGENCE 1.130426
─ 012  · OBSERVER POSITION 012
─ 047  · OBSERVER POSITION 047
```

α gets the ∇ glyph (the nabla — the gradient operator, the observer's vector); 012 and 047 get the simpler em-dash. Labels are instrument register, uppercase mono.

### 5.4 Interaction on axis

- **Hover.** NETRA instrument readout:
  - α: `α · DIVERGENCE 1.130426 · DRIFT +0.000002/HR`
  - 012, 047: `OBSERVER POSITION 012 · LAST READING 2026.04.30`
  Companion-register narration on these is optional — they are the most instrument-y of the three strata.
- **Click on α.** Camera centers on the observer locus. No navigation. The visitor *is* α when they look at the globe; clicking on α centers their own frame.
- **Click on 012 or 047.** Camera tilts to the named reading position. The globe is shown from that vantage — a different view of the same body. After a few seconds idle, gently returns to default.

The axis is the one stratum where clicks do *not* leave the globe. The axis is the looking; the looking does not navigate away.

### 5.5 α drifts

The α value updates when entries are patched (per Tier 5 in feature brainstorm — "patches drift α"). When a patch deploys, α changes by a small amount; the axis briefly displays a drift indicator (`α DRIFT +0.000003`) for ~2s after a fresh load that detects a recent patch. After that, the new α is just the new α.

The boot's `CALIBRATING DIVERGENCE :: 1.130426` reads α at site load. Subsequent live drift, if any, surfaces on the axis. Implementation detail: α is computed at build time from accumulated patch count + seed; the axis reads from the same source.

---

## 6. Camera and navigation

### 6.1 Default view

The visitor lands on the globe (post-boot, post-NETRA first-encounter) with the camera at:

- Position: roughly (0, 0.4 × R, 3 × R) — slightly above the equator, pulled back enough that the whole body fits comfortably in viewport.
- Looking at: (0, 0, 0).
- Up vector: (0, 1, 0) — axis is vertical.

This angle reveals all three strata: surface visible across the front hemisphere, orbital nodes in halo around the body, axis line visible top-to-bottom through the center.

### 6.2 Controls

- **Drag (mouse) / one-finger swipe (touch):** rotate the globe around the Y axis (longitude) and within latitude bounds (clamp to prevent over-the-pole flipping). The axis remains visually vertical.
- **Scroll (mouse) / pinch (touch):** zoom in and out. Zoom range clamps so the globe never fills more than ~85% of viewport (preserves negative space) and never shrinks below ~40% (legibility floor).
- **Click on node / pin / edge:** per stratum interaction rules in §3.4, §4.6, §5.4.
- **Double-click anywhere on empty space:** reset to default view (~600ms ease).
- **`/` key:** open search overlay (per PRD 04). Not strictly globe navigation, but lives in the same key-bindings space.

No keyboard rotation in v1.0. Add if accessibility audit demands it.

### 6.3 Idle drift

When the visitor has not interacted for ≥ 12 seconds, the camera begins a very slow rotation around the Y axis — roughly 360° per 4 minutes. This is **idle drift**, not autoplay. Any interaction immediately cancels it. The drift is so slow it reads as the camera *breathing* rather than animating.

Idle drift is disabled when `prefers-reduced-motion` is set.

### 6.4 Reduced motion

When `prefers-reduced-motion: reduce`:
- No idle drift.
- Edge-flying on click becomes instant cut (no spline traversal animation).
- Cluster expansion is instant.
- Cross-fade durations (palette switches, anomaly displays) halve.

The structure stays. The motion thins.

---

## 7. Visual hierarchy across strata

Three strata visible at once must remain legible. The visitor must be able to *read* the layers without instruction.

### 7.1 Distinguishing the layers

Each stratum has its own **mark family** (§4.5 summary):
- Ne0 surface: square pins, on the sphere.
- NeX orbit: circles (articles), rings (fiction), diamonds (repos later), floating off the sphere.
- Ne0N axis: vertical bars, on a vertical line through center.

Each stratum has its own **depth**:
- Surface marks sit *on* the terrain — visibly anchored.
- Orbital marks have parallax — they float, with subtle motion when the camera moves.
- Axis marks sit on a line that is always vertical, never tilts with camera rotation around Y.

Each stratum has its own **density behavior**:
- Surface clusters when crowded.
- Orbit thins edges below a stroke threshold when zoomed out (edges fade before nodes do).
- Axis is always exactly three nodes — never crowds.

### 7.2 Palette and stratum

Per existing palette tokens + PRD 03's film-simulation palette switcher:
- Terrain takes the paper base color (`#E8E2D5` in Provia default).
- Surface pins take palette accent (warm orange in Provia, muted ochre in Classic Chrome, etc.).
- Orbital nodes take palette primary (the deep teal in Provia, navy in Classic Chrome).
- Edges take palette primary at ~40% opacity.
- Axis line and bars take palette ink at low opacity.

The three strata thus separate by *hue* as well as *position*: ground reads warm, orbit reads cool, axis reads neutral. This holds across all palette variants.

### 7.3 Zoom behavior

At default zoom: all three strata visible.

Zoomed in: orbital nodes and edges thin (low opacity) so the surface detail leads; axis remains as a faint reference line.

Zoomed out: orbital constellation becomes the dominant figure; surface pins reduce to small dots; axis remains visible end-to-end.

The visitor's zoom level becomes an implicit question about what they want to look at — and the globe honors it without hiding anything.

---

## 8. NETRA + globe integration

The globe is where NETRA's two registers (character bible §4) are most clearly paired.

### 8.1 Hover pairings

Every hover on a globe element can surface up to two text outputs:

- **Instrument line** in the ATLAS status bar (uppercase mono, terse). Always present on hover.
- **Companion line** in the marginalia/narrative slot (NETRA's voice). Optional — fires when there's something worth saying. Subject to whisper budget (character bible §12).

Examples (consolidated from character bible §11.2, §11.6, §11.9):

| Hover target | Instrument | Companion (optional) |
|---|---|---|
| Photo pin | `PIN · 18.78°N · 98.99°E · CHIANG MAI · TH` | `*"frame 043 ค่ะ. classic chrome."*` |
| Article node | `NODE · 003 · METHOD · 2026.05.07` | `*"on the architecture of taste — diverged from 001."*` |
| Fiction ring | `TRANSMISSION · t.001 · NeX-VARIANT 1.084231` | (often silent; fiction speaks for itself) |
| Edge | `EDGE · DIVERGED_FROM · 001 → 003` | `*"the four-pours line splits here."*` |
| Axis α node | `α · DIVERGENCE 1.130426 · DRIFT +0.000002/HR` | (silent — α is read, not narrated) |

### 8.2 Click behaviors

- Surface, orbital nodes → navigate to entry page (leaves the globe).
- Edges → camera flies along spline to the target node (stays on the globe).
- Axis α → camera centers (stays on the globe).
- Axis 012, 047 → camera tilts to vantage (stays on the globe).

Three of the five interactions stay *in* the globe. The globe is the place the visitor lives; entries are excursions out and back.

### 8.3 Default-metaphor discipline

Per character bible §5.3, NETRA's *companion-register* lines on hover use *archive* / *house* / *node* / *thread* / *line* — not *worldline* / *transmission* / *cluster* / *α drift* — unless the visitor has already encountered those terms via the instrument register on the same hover.

This means: a hover surfaces the technical term in instrument register first (`EDGE · DIVERGED_FROM`), then NETRA's companion line uses friendlier language (`the four-pours line splits here`). The pair teaches the vocabulary gently — each instrument term is shown alongside its plain-language reading.

---

## 9. Frontmatter contracts

Content authors place entries on the globe by declaring frontmatter. The globe reads frontmatter; it does not infer.

### 9.1 Photo frontmatter (Ne0 placement)

```yaml
roll: 2026-04-chiang-mai
sourceFile: DSCF0043.jpg
caption: "morning at wat phra singh"
share-location: true       # required true to appear on globe
# all below derived from EXIF at build time:
exif:
  camera: FUJIFILM X-E5
  lens: XF 23mm f/1.4 R LM WR
  filmSim: classic-chrome
  aperture: 2.8
  shutter: 1/250
  iso: 400
  focalLength: 23
  captureTime: 2026-04-18T07:32:00+07:00
  gps:
    lat: 18.78643
    lon: 98.99216
```

Globe pin appears at `(lat, lon)` only when `share-location: true`. Per PRD 03, default is `false`.

### 9.2 Article / fiction frontmatter (NeX placement)

```yaml
fileNum: "003"
title: "on the architecture of taste"
date: 2026-05-07
domain: method               # selects longitude meridian
tags: ["coffee", "design", "kissaten"]
status: refined
summary: "..."

# globe edges (all optional, all default to empty):
diverged_from: ["001"]
merged_with: []
collapsed_into: null
adjacent: ["002"]
```

Fiction uses the same edge fields plus the standard fiction-specific frontmatter (see PRD 01).

Edge target values are `fileNum` strings for articles/repos, `slug` strings for fiction. Cross-type edges (article diverged_from fiction, etc.) are valid — the worldline does not respect content-type boundaries.

### 9.3 Observer locus (Ne0N — static, not content-authored)

Defined directly in `lib/entries.ts` as `OBSERVER_NODES`. Three entries, fixed:

```ts
export const OBSERVER_NODES = [
  { id: "α",   y: 0.0,  glyph: "nabla", label: "α" },
  { id: "012", y: 0.65, glyph: "bar",   label: "012" },
  { id: "047", y: -0.65, glyph: "bar",  label: "047" },
];
```

The values may evolve (additional reading positions, repositioning along the axis), but observer nodes never come from frontmatter. They are config, not content.

### 9.4 Validation

velite collection schemas (per PRD 01 § data model) validate:
- Photo: GPS coords are within valid lat/lon ranges when `share-location: true`.
- Article/fiction: edge target IDs resolve to actual entries; circular `diverged_from → diverged_from` chains are warned but not blocked (a thought *can* loop).
- Domain values are in the enum (`identity | reflection | method | meta`).

Build fails on invalid GPS, missing required fields, unresolvable edge targets. Build *warns* on circular lineage chains.

---

## 10. Edge cases and degradation

### 10.1 Sparse content (early site)

A site with few entries renders a globe with few nodes. The structure stays — surface is mostly empty, orbit is mostly empty, axis is fully present. This is correct: a young archive *is* mostly empty. The globe should not fake density.

NETRA's companion register may acknowledge this on the first encounter:
- *"this archive is still young. fewer marks than you might expect."*

### 10.2 Dense clusters

When orbital nodes pile within a small angular distance (a single domain with many entries on similar attractor fields):
- They render normally up to some local density.
- Beyond that, they expand orbital radius slightly to relieve crowding — entries in the dense region sit at `k × 1.04` instead of `k`. Subtle, not jarring.
- Edges in the dense region thin to 0.5px to keep the area readable.

### 10.3 Photos without GPS

Many photos may lack GPS (camera GPS off, manual edits stripping EXIF, deliberate non-opt-in). These do not appear on the globe — they appear in roll views (per PRD 03). The globe is not the only way to reach photos; the photo journal index exists in parallel.

### 10.4 Mobile

On viewports ≤ 600px:
- Globe occupies ~70% of viewport height (leaving room for status bar and NETRA narrative slot).
- Pins/nodes scale up slightly (~125%) for touch.
- Hover behaviors map to *first tap shows status, second tap navigates* — standard mobile touch pattern.
- Idle drift remains, but at half speed (battery considerations on mobile + reduced animation expectations).

### 10.5 No-WebGL fallback

If WebGL is unavailable (rare modern devices, deliberate disable, security policy):
- Render a textual map: a list of entries grouped by stratum, with their coordinates listed.
- Surface: photo list with GPS strings.
- Orbit: article/fiction list with domain + date + edges as relation strings.
- Axis: α value displayed prominently.
- A footer note: *"this archive is best viewed with WebGL enabled."*

Same principle as the no-JS fallback (boot ceremony §5.4): the site remains *readable* without the medium, just not *experiential*.

---

## 11. What this is NOT

A few failure modes worth naming so they can be refused on contact:

- **Not a navigation hub.** Visitors can reach pages from the globe, but the globe is not the menu. Other surfaces (chapter index, archive list, search) reach the same pages without involving the globe.
- **Not personality**-mapped. Strata do not represent "Nerd / Core / Explorer" personas. That framing was earlier; it's gone. Strata are *spatial layers of one body*, not facets of identity.
- **Not generative.** No procedural content. No "the globe writes new entries." Every node is authored.
- **Not gamified.** No achievements, scoring, completion meters, hidden-area unlocks beyond the boot anomaly (which is part of the boot, not the globe).
- **Not a chat interface.** NETRA may speak in response to globe events, but the globe is not where the chat happens. Chat is `/`-overlay or dedicated stratum surface (per PRD 05).
- **Not a portfolio rotator.** The default camera does not auto-tour the visitor through "Peat's greatest hits." Idle drift is breathing, not curation.

---

## 12. Open questions

To resolve as implementation proceeds. None block writing this spec.

- **Domain angle assignment specifics.** The 0° / 90° / 180° / 270° mapping is a starting point. After enough entries are on the globe, audit whether the resulting orbital distribution is legible or if domain slices should rotate to a different baseline.
- **Latitude derivation.** Currently proposed as date-driven (newer = higher). Could also be attractor-field-driven (clustering). Decide once first ~20 entries are placed and the orbit can be eyeballed.
- **Cluster threshold tuning.** §3.3 starting threshold (≤ 1.5° angular distance) is a guess. Revise after first roll's pins are on the globe.
- **Orbit shell radius.** `k ≈ 1.18` is a starting point. Decide visually once enough nodes are placed.
- **Repo glyph and orbit placement.** Repos are deferred from v1.0 (per PRD 01 + feature brainstorm). When they join, decide whether they share the article orbit or sit on a slightly outer shell.
- **NeX axis-style trembling on α drift.** When a patch ships and α drifts, should the orbit visibly respond (slight ripple) or only the axis (drift readout)? Currently spec'd as axis-only. Worth revisiting if patches become frequent enough that visitors might notice.
- **Edge-traversal speed.** §4.6 specifies ~600ms ease. Long edges across the globe may feel slow at that duration; short edges may feel rushed. Consider easing the duration as a function of edge arc length.
- **First-encounter highlight.** Should the globe momentarily highlight a recommended entry-point node when NETRA's first-encounter line fades in? Tempting; risks feeling like "tutorial." Recommend not for v1.0, revisit if visitors get stuck on the empty body.

---

## 13. Versioning

This document is the spec for the site's hero element. Changes here ripple into how every entry is placed and how visitors read the archive. Treat as a content document, not a config file.

When updating: PR with rationale paragraph and, where relevant, a visual mock or diagram of the change. Spatial-model changes especially benefit from a sketch — words alone struggle to capture before/after on a 3D structure.

### Changelog

- **v0.1 (2026.05.12)** — initial draft. Locked the three strata as co-existing spatial layers (Ne0 surface = photos at GPS, NeX orbit = articles/fiction with worldline-mechanic edges, Ne0N axis = observer locus tied to existing `OBSERVER_NODES`). Defined placement rules: surface uses real GPS; orbit uses domain meridians + date latitude + attractor-field lateral drift at radius `k ≈ 1.18`; axis is static config. Defined four edge types (`diverged_from`, `merged_with`, `collapsed_into`, `adjacent`) as content-authored frontmatter. Specified glyph families per stratum (square / circle / ring / diamond / vertical bar), interaction model (hover = NETRA pair, click = navigate or camera move per stratum), camera defaults and idle drift, visual hierarchy across zoom levels, frontmatter contracts, edge cases including sparse/dense distribution + no-WebGL fallback, and explicit anti-failure framing in §11.

---

*End of spec. See `docs/00-netra-character.md` §11 for the companion-register voice on globe events; `docs/00-atlas-boot.md` §6 for the entry transition; PRD 01 / PRD 03 for entry- and photo-level details that flow into globe placement.*
