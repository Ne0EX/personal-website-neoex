# Globe Ontology

> Status: v1.3 — 2026.05.12 (privacy boundary hardened to hard contract; sanitized-payload rule)
> Companion: `docs/00-netra-character.md`, `docs/00-atlas-boot.md`, PRD 0 (worldline master), PRD 01 (entries), PRD 03 (photos)
> Audience: implementers, content authors, future contributors, and runtime systems that must reason about the globe's spatial model.

---

## 0. Distillation

The globe is not a decoration. It is not a hero animation. It is not "a visualization of my blog."

The globe is **the geometry of how one mind thinks, rendered in space**. Photos pin to the surface where they were taken. Articles and fiction orbit above, in a thin shell, connected by edges that encode how thoughts diverged, merged, or quieted. A vertical axis passes through the center, carrying the observer's reading positions and the live α value.

Three strata, co-equal: surface, orbit, axis. None of them is the protagonist. The body is the protagonist; the strata are its layers.

A visitor who lands here is not browsing a portfolio. They are walking around a small body in space whose shape *is* its argument.

> *The globe is the writer's mental model made spatial. Strata are not pages. They are co-present layers of one body.*

If a feature, decoration, or interaction violates this — if the globe starts feeling like a 3D menu, a navigation toy, or a splash animation — that feature is wrong.

---

## 1. What the globe is

### 1.1 One body, three co-equal strata

The globe holds three layers of meaning, **co-present in the same scene** and **co-equal in importance**:

- **Ne0 — Surface.** Photos pinned at real GPS coordinates. *What happened, where.*
- **NeX — Orbit.** Articles and fiction as nodes in an idea-network, hovering above the surface, connected by edges that encode worldline mechanics. *What was thought, and how thoughts relate.*
- **Ne0N — Axis.** A vertical line through the globe's poles, carrying the observer's reading positions and the live α value. *Who is observing. From where.*

All three are visible from the default camera angle. None is hidden behind a toggle. The visitor does not switch strata — they *see* the strata as one body, the way you see a planet's atmosphere, surface, and core in a cutaway diagram, all at once.

The strata have unequal *visual surface area* on the canvas — surface and orbit have many marks; the axis has three. This is fine. Importance is not measured by mark count. The axis is what makes the body a coordinate system at all; the surface is what makes it specific; the orbit is what makes it think. Take any one away and the model fails differently. The body needs all three.

### 1.2 Why a globe (not a list, grid, or graph)

A list is sequence. A grid is taxonomy. A 2D graph is relation.

A globe is *embodied position*. It says: this photo happened *here*; this thought may carry an *origin* on the ground, but then takes its place in orbit by meaning. It diverged from *that other thought*, which is *over there*. The author is at the center — not as ego, but as the only fixed point from which the rest can be measured.

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

These are not placed by GPS. They may carry origin loci (see §9.2 `origin_locus`), but their rendered position on the globe comes from *meaning coordinates*. They sit in **orbit above the surface**, at a radius greater than `R`, in a thin spherical shell around the body. From the visitor's view: a constellation of nodes hovering over the world, connected by faint splines.

**Spatial placement:**
- Radius: `R × k` where `k ≈ 1.15–1.25`. Far enough above the surface to read as a separate layer; close enough that the relationship to the body is still visible.
- Longitude (domain angle): derived from each entry's `domain` field (`identity | reflection | method | meta` per existing `lib/entries.ts`). Each domain occupies a longitudinal slice of orbit. See §4.2.
- Latitude: derived from date, normalized against fixed `SITE_EPOCH` and `SITE_HORIZON` (§12). Newer entries pull toward the north pole; older toward the south. New entries do *not* shift existing entries — spatial stability is a contract.
- Lateral drift within a domain slice: deterministic hash of the entry's sorted tag set (§12.1).

**Edges:** between orbital nodes, drawing the **worldline mechanics**:

- `diverged_from` — this entry split from an earlier one. Solid spline; small branching glyph at the source.
- `merged_with` — this entry brings two prior threads together. Solid spline converging; small convergence glyph at the merge.
- `collapsed_into` — this thread ended; its conclusion lives in the named target. Dashed spline fading toward the target.
- `adjacent` — soft kinship without direct lineage. Dotted thin line, low opacity.

**Symbolic register:** *what was thought, and how thoughts relate to each other.* This is where the worldline metaphor does its real work.

### 2.3 Ne0N — Axis (the observer)

**What lives here:** the observer locus. Three fixed nodes — **α**, **012**, **047**. Nothing else.

A vertical line passes through the globe's poles, extending slightly above and below the body. Along this line sit the **observer's reading positions** — fixed coordinates from which the author has surveyed his archive.

- **α** sits at the equator of the axis (Y=0). It is the divergence reading. The site's current α value (`1.130426`) is the value at α. α is the most prominent single mark on the axis.
- **012** and **047** sit above and below α at fixed offsets. They are alternate reading positions — different vantages from which the same body has been read.

The axis is the globe's coordinate system. Without it, surface and orbit would still render, but the visitor would not be located. The axis is what makes the body legible *from somewhere*.

**Symbolic register:** *who is observing, from where.*

> A note on the name. The instrument the boot calibrates is called ATLAS. The Titan who held up the heavens was also called Atlas. This double reading is available — but the doc does not lean on it. The axis is structurally necessary; it does not need to be mythic to earn its place.

These nodes already exist in the codebase as `OBSERVER_NODES` in `lib/entries.ts` — but with different semantics (geographic locations, not axis positions). The data model must be migrated to `OBSERVER_AXIS_NODES`: see §10 and §9.3.

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
- Visual size: ~6px square at default zoom; scales with zoom but caps at ~12px and bottoms at ~3px. Pointer picking radius is separate from visual size — see §11.8 for the global hit-target rule.
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

Each entry drifts within ±35° of its meridian. The exact lateral drift is a deterministic hash of the entry's sorted tag set (see §12.1 algorithm).

**Latitude.** Derived from date, normalized against fixed `SITE_EPOCH` and `SITE_HORIZON` constants (see §12). Newer entries pull toward the north pole (Y > 0); older toward the south (Y < 0). The latitude band spans roughly ±55° from the equator. Crucially: **new entries do not shift existing entries' positions** — the epoch is fixed (§12.2).

This means the orbit has visible structure: domain clusters by longitude, age stratifies by latitude. A new article on `method` joins the back side of the orbit at a date-determined latitude and stays there. The orbit *records time* without rewriting itself on every deploy.

### 4.3 Edges — the worldline mechanics

Each article or fiction entry may declare *edges* in its frontmatter pointing to other entries. Edges are structured as a list of `{type, target, note?}` objects:

```yaml
edges:
  - type: diverged_from
    target: "001"
    note: "four-pours line"
  - type: adjacent
    target: "002"
  - type: merged_with
    target: "004"
  - type: collapsed_into
    target: "017"
```

These are **content-authored**, not auto-derived. The author declares lineage explicitly. The globe renders what is declared.

| Edge type | Meaning | Visual |
|-----------|---------|--------|
| `diverged_from` | This entry split off from the named entry. The author was thinking *X*, then this thought branched away. | Solid spline from source to this node. Small branching glyph at source. |
| `merged_with` | This entry brings two or more prior threads together. | Solid splines from each named source converging at this node. Convergence glyph at this node. |
| `collapsed_into` | This thread ended; its conclusion was absorbed by the named target. The named target is the resting place. | Dashed spline from this node to target, fading toward target. |
| `adjacent` | Kinship without lineage. The two entries are near in attractor field, but neither caused the other. | Dotted thin line, low opacity. |

Edges are directional except `adjacent`. The arrow of time matters in worldline mechanics — divergence and collapse are not symmetric.

**v1 authoring minimalism.** Authoring all four edge types for every entry is burdensome and most entries do not need all four. For v1, **`diverged_from` and `adjacent` are the only required-render types** (per §13.1). Authors may declare `merged_with` and `collapsed_into` — the data ships in the frontmatter — but the renderer ignores them in v1 and surfaces them in a later pass (§13.2 / §13.3). This keeps the authoring contract stable while the visual layer catches up.

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
- **Click on edge.** *Edge-flying (ideal):* camera flies along the spline toward the target node (~600ms ease) and lands oriented to read both endpoints. *v1 fallback (if scope-deferred per §13.2):* edge click selects/highlights both endpoint nodes and surfaces their labels — exploration without traversal animation. Either way, clicking an edge does not navigate away from the globe.

The edge-flying behavior is the **moment where worldline mechanics become embodied for the visitor**. They are not reading a list of related entries — they are watching the camera trace a thought's divergence.

### 4.7 Edge normalization

Edges live in each entry's frontmatter as `edges: [{ type, target, note? }]` (§9.2). The renderer collapses redundant declarations and surfaces contradictions before drawing.

Rules:

- **`adjacent` is symmetric.** If entry 001 has an edge `{type: adjacent, target: "003"}` and entry 003 also has `{type: adjacent, target: "001"}`, draw **one** dotted line, not two. Canonical edge id: `"adjacent:" + sorted(a, b).join("-")`.
- **`diverged_from` is directional.** Entry 003 with `{type: diverged_from, target: "001"}` means a single arrow source=001 → target=003. If entry 001 *also* declares `{type: diverged_from, target: "003"}`, that is a logical contradiction (each entry cannot have diverged from the other). The build **emits a loud warning** and, in strict mode, **fails**. In non-strict mode the renderer draws nothing for the contradicted pair until the author resolves it — silently picking a direction would hide author error.
- **`merged_with` collects on the target.** If entry 005 has `{type: merged_with, target: "001"}` and `{type: merged_with, target: "002"}`, render one merge glyph at 005 with converging splines from 001 and 002. The source entries do not need reciprocal declarations.
- **`collapsed_into` is directional.** Entry 003 with `{type: collapsed_into, target: "017"}` renders a single fading dashed line from 003 → 017. No reciprocal expected.
- **Duplicate guard.** If the same logical edge appears multiple times in one entry's `edges` array (e.g. two identical `{type: adjacent, target: "005"}` entries), collapse to one. Build warns on the duplicate.

Canonical edge ids (used for dedup): `"diverged_from:001->003"`, `"adjacent:001-003"` (sorted), `"merged_with:001->005"` + `"merged_with:002->005"` (one per source pair), `"collapsed_into:003->017"`. The renderer hashes these to dedupe across the corpus.

---

## 5. Ne0N — Axis in detail

### 5.1 What appears on the axis

Three nodes, fixed: **α**, **012**, **047**. Defined as `OBSERVER_AXIS_NODES` in `lib/entries.ts` (renamed from the existing `OBSERVER_NODES`, which used geographic semantics — see §10 migration). The axis renders only what is there. No other content joins.

These nodes do not navigate to entry pages on click (there are no entry pages for them). They are *positions*, not destinations.

### 5.2 The axis line

A vertical line passes through (0, 0, 0), extending from Y = −1.4 × R (below south pole) to Y = +1.4 × R (above north pole).

Visual specs at default zoom:
- Stroke weight: 1.25px. Increases to 2px when any axis node is hovered or selected.
- Color: palette ink.
- Opacity through the body: 55%. Opacity above/below poles: 75%. The above-pole and below-pole extensions read as the axis continuing past the body — the body sits *on* the line, not the line *in* the body.
- α's local region (Y ≈ 0 ± 0.2 × R) gets a faint luminance lift (~10% brighter than the rest of the line), drawing the eye when the visitor's attention is free.

The axis must be *legible* — the visitor should perceive that this body has a vertical structure passing through it. It must not be *dominant* — the surface and orbit are not subordinate to the line, they are co-equal layers of the same body. See §5.6 *Prominence rule* for the test.

**Depth rendering implementation hint.** The axis crosses the globe silhouette. The cleanest implementation: render as three segments — *above pole*, *inside body*, *below pole*. The *inside body* segment uses depth-tested material (gets occluded by the surface where geometrically behind); the external segments may render with overlay material to avoid z-fighting at the silhouette boundary. If depth ordering becomes visually unstable, prefer legibility over physical correctness.

### 5.3 Node glyph

Each observer node renders on the axis:

- **α** — a ∇ (nabla) glyph, ~10px at default zoom. The nabla is the gradient operator — the observer's vector. α sits at the equator and slightly forward of the axis (Z ≈ +0.05 × R) so it reads as *on* the axis, not floating beside it.
- **012, 047** — smaller bars (~6px tall, 1.5px wide). They are alternate reading positions; α is the canonical one.

α has no animated pulse in v1. (An earlier draft proposed a ~4s pulse; cut because it competes with the α-drift indicator and adds motion to a central element that should be still by default. The α glyph's slight luminance lift from §5.2 is sufficient emphasis.)

Labels, instrument register, uppercase mono:

```
∇ α    · DIVERGENCE 1.130426
─ 012  · OBSERVER POSITION 012
─ 047  · OBSERVER POSITION 047
```

α's label is always visible (subject to density budget §11.1). 012 / 047 labels appear only when hovered or when the camera is oriented toward them.

### 5.4 Interaction on axis

- **Hover on α.** NETRA instrument readout, optionally with one companion line:
  - Instrument: `α · DIVERGENCE 1.130426 · DRIFT +0.000002/HR`
  - Companion (rare, on first encounter only): *"the point this archive is read from."* / *"จุดที่ archive นี้ถูกอ่านจากตรงนั้น."*
- **Hover on 012 / 047.** Instrument only: `OBSERVER POSITION 012 · LAST READING 2026.04.30`. The companion register stays silent — these are coordinates, not stories.
- **Click on α.** Camera centers on the observer locus. No navigation. The visitor *is* α when they look at the globe; clicking on α centers their own frame.
- **Click on 012 or 047.** Camera tilts to the named reading position. The globe is shown from that vantage — a different view of the same body. After a few seconds idle, gently returns to default.

The axis is the one stratum where clicks do *not* leave the globe. The axis is the looking; the looking does not navigate away.

### 5.5 α drifts

The α value updates when entries are patched. When a patch deploys, α changes by a small amount; on the next fresh load that detects a recent patch, the axis briefly displays a drift indicator (`α DRIFT +0.000003`) for ~2s, and the α glyph brightens by ~15% during that window. The α glyph does **not** ripple, tremble, or otherwise animate. Quiet axis; quiet readings.

After the indicator fades, the new α is just the new α. The boot's `CALIBRATING DIVERGENCE :: 1.130426` reads α at site load; subsequent live drift, if any, surfaces here. Implementation detail: α is computed at build time from accumulated patch count + seed; the axis reads from the same source.

### 5.6 Prominence rule

The axis is the stratum most at risk of two failure modes: rendered too softly (becomes decorative scaffolding the visitor ignores) or rendered too loudly (dominates the canvas, makes surface and orbit feel like ornamentation).

The rule:

> *Axis is structurally legible at all zoom levels, but never visually dominant. Ontological role does not equal screen weight.*

The implementer's test, at default zoom: can the visitor describe the globe in plain words?
- If they say *"a planet with little notes around it"*, the axis is too soft — they didn't notice the line.
- If they say *"a column with a planet around it"*, the axis is too loud — it ate the body.
- If they say *"a body with photos on it, ideas around it, and a line running through"*, the axis is right.

The axis should be **felt before it is understood, and understood before it dominates**. Three things, in order.

---

## 6. Camera and navigation

### 6.1 Default view

The visitor lands on the globe (post-boot, post-NETRA first-encounter) with the camera at:

- Position: roughly (0, 0.4 × R, 3 × R) — slightly above the equator, pulled back enough that the whole body fits comfortably in viewport.
- Looking at: (0, 0, 0).
- Up vector: (0, 1, 0) — axis is vertical.

This angle reveals all three strata: surface visible across the front hemisphere, orbital nodes in halo around the body, axis line visible top-to-bottom through the center.

### 6.2 Controls

- **Drag (mouse) / one-finger swipe (touch):** rotate the globe around the Y axis (longitude) and within latitude bounds (clamp at ±55° to prevent over-the-pole flipping). The world up vector remains (0, 1, 0) throughout — camera roll is locked at 0. The axis stays visually vertical at all times.
- **Scroll (mouse) / pinch (touch):** zoom in and out. Zoom range clamps so the globe never fills more than ~85% of viewport (preserves negative space) and never shrinks below ~40% (legibility floor).
- **Click on node / pin / edge:** per stratum interaction rules in §3.4, §4.6, §5.4.
- **Double-click anywhere on empty space:** reset to default view (~600ms ease).
- **`/` key:** open search overlay (per PRD 04). Not strictly globe navigation, but lives in the same key-bindings space.
- **Keyboard exploration:** per §11.7.

Keyboard element exploration ships in v1 (§11.7). Keyboard camera rotation is deferred; evaluate after accessibility testing.

### 6.3 Idle drift

When the visitor has not interacted for ≥ 12 seconds, the camera begins a very slow rotation around the Y axis — roughly 360° per 4 minutes. This is **idle drift**, not autoplay. Any interaction immediately cancels it. The drift is so slow it reads as the camera *breathing* rather than animating.

**Interaction includes keyboard focus.** Tab-focusing a mark, holding a selection, or having an open screen-reader announcement counts as the visitor actively reading the globe — idle drift must not engage while any mark is focused or selected, even if pointer activity is absent. Drift resumes only after focus is cleared (Escape or blur) and the 12-second timer fully elapses. This prevents the failure mode where a screen-reader user is reading a focused mark's label while the camera slowly rotates the mark behind the body.

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
- Axis line and bars take palette ink; opacity varies with zoom and focus state per §5.2. At default zoom the axis is structurally readable, not decorative.

The three strata thus separate by *hue* as well as *position*: ground reads warm, orbit reads cool, axis reads neutral. This holds across all palette variants.

### 7.3 Zoom behavior

At default zoom: all three strata visible.

Zoomed in on surface: orbital nodes and edges thin (low opacity) so surface detail leads; axis subdues to reduced stroke (1px) and ~40% body-segment opacity but remains visible as a reference line. α and its label remain readable.

Zoomed out: orbital constellation becomes the dominant figure; surface pins reduce to small dots; axis remains visible end-to-end at default weight.

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
- Edges → camera flies along spline to the target node (ideal); v1 fallback per §4.6 selects both endpoint nodes. Either way, stays on the globe.
- Axis α → camera centers (stays on the globe).
- Axis 012, 047 → camera tilts to vantage (stays on the globe).

Three of the five interactions stay *in* the globe. The globe is the place the visitor lives; entries are excursions out and back.

### 8.3 Default-metaphor discipline

Per character bible §5.3, NETRA's *companion-register* lines on hover use *archive* / *house* / *node* / *thread* / *line* — not *worldline* / *transmission* / *cluster* / *α drift* — unless the visitor has already encountered those terms via the instrument register on the same hover.

This means: a hover surfaces the technical term in instrument register first (`EDGE · DIVERGED_FROM`), then NETRA's companion line uses friendlier language (`the four-pours line splits here`). The pair teaches the vocabulary gently — each instrument term is shown alongside its plain-language reading.

---

## 9. Frontmatter contracts

Content authors place entries on the globe by declaring frontmatter. The globe reads frontmatter; it does not infer.

### 9.0 Privacy boundary (hard rule)

Two boundaries govern privacy enforcement on the globe. **Both are hard rules, not guidance.** Implementer compliance is mandatory; CI checks should verify them.

**Source boundary — what may live in `content/` and source repositories.**

- Exact private coordinates (home, workplace, residence, friend's apartment, anywhere the author considers sensitive) **must not be committed to any public repository**, regardless of whether the build will strip them at runtime. Source-stripping is a runtime contract; source itself is the leak surface for backups, accidental publishing, fork mirrors, deploy previews, and artifact archives.
- For sensitive origins, authors must use `precision: hidden` *and omit `lat` / `lon` from the source frontmatter entirely*. The `label` field may carry a non-identifying string for personal records (e.g. `"home"`, `"the cafe near my place"`) — never an address.
- For raw photo files (`content/photos/<roll>/*.jpg`) shot at sensitive locations: source files with embedded GPS EXIF **must live in private storage** (gitignored, or in a non-public asset pipeline). Only the build-pipeline-sanitized derivatives are eligible for the public served bundle.
- Source raw EXIF GPS coordinates exist on the photographer's machine; they do not propagate to public source control unless `share-location: true` (explicit opt-in).

**Sanitized payload boundary — what may flow downstream of the build.**

The runtime payload (the velite-generated cache, generated JSON, search indexes, NETRA grounding context, static props, client bundles, RSS/feed exports, OG images) **must only consume sanitized content**. The build emits *one* sanitized representation of each entry/photo; every downstream system reads from that representation, never from raw source.

What "sanitized" means in practice:
- Photo records: GPS coordinates present only when `share-location: true`; absent otherwise.
- Photo served files: EXIF GPS tags stripped from the actual JPEG/WebP/AVIF binaries when `share-location: false` (use `exiftool` or `sharp.withMetadata({ exif: {...filtered} })` — do not just hide GPS in JSON while shipping the original file).
- Article `origin_locus`: coordinates present only at the resolved precision level (exact → as authored; city → rounded; region → no coordinates; hidden → field absent).
- NETRA's grounding context: same sanitized payload as the renderer. NETRA cannot see what the renderer cannot.

**CI verification (required).**

- A post-build script must scan `.next/` / generated outputs / served `public/photos/` and assert: no GPS coordinates appear for any photo whose source frontmatter has `share-location: false`; no `origin_locus.lat` / `lon` appears for any entry with `precision: region | hidden`. The script fails the build if either check fails.
- A pre-commit hook (or repo CI on push) should warn when raw photo files with EXIF GPS are added under any path that would be committed publicly. This is advisory (it can be ignored for `share-location: true` photos), but it surfaces the decision rather than letting it pass silently.

Privacy is enforced at build time *and* verified after build. Spec-only privacy does not survive contact with real deploys.

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

**Photo privacy is build-time-enforced, same model as `origin_locus`.** When `share-location: false` (the default), photo EXIF GPS coordinates are **stripped from the runtime payload and from served file metadata** before content reaches the velite-generated cache, NETRA's grounding context, or the rendered globe. The source files in `content/photos/<roll>/` may retain GPS for the photographer's own records; the build pipeline strips it from anything that ships. This mirrors `origin_locus` precision enforcement — opt-in, not opt-out trust.

### 9.2 Article / fiction frontmatter (NeX placement)

```yaml
fileNum: "003"
title: "on the architecture of taste"
date: 2026-05-07
domain: method               # selects longitude meridian
tags: ["coffee", "design", "kissaten"]
status: refined
summary: "..."

# Optional: the real place the thought was born.
# Does NOT place the article on the surface (only photos do that).
# Used by NETRA for provenance only at the chosen precision level.
origin_locus:
  label: "Kyoto kissaten"   # public-safe prose label only; never used for lookup
  precision: city           # one of: exact | city | region | hidden
  city_id: kyoto-jp         # required when precision is city; deterministic lookup key (slug)
  lat: 35.0116              # required when precision is exact; ignored at city precision
  lon: 135.7681             # (city precision uses city_id for coordinates, not these)
  render_tether: false      # default false; tether line not drawn unless true

# Globe edges (all optional, all default to empty):
edges:
  - type: diverged_from
    target: "001"
    note: "four-pours line"
  - type: adjacent
    target: "002"
```

**Article origin_locus** preserves the truth that thoughts are *born somewhere real* — many entries begin in a kissaten in Kyoto, on a hillside in Chiang Mai, in a cafe in Yirgacheffe. The earlier `coords` field in `lib/entries.ts` captured this; the new ontology keeps the data but reframes its role: the article does not *live* on the surface, but it can *point to* a place on the surface as its origin. NETRA may surface this in companion register at the chosen precision level; the renderer may optionally draw a thin tether from the orbital node down to the appropriate surface point if `render_tether: true` — but only when precision permits a real anchor point (see §9.4 for the precision-tether interaction matrix).

**Privacy: `precision` levels.** Articles often originate from places the author would not want a public globe to pin precisely (home, workplace, friend's apartment). The `precision` field controls what the runtime sees:

- `exact` — full coordinates as authored. Use only when the place is genuinely public (a café, a museum, a public square) and the author has chosen to share it openly.
- `city` — coordinates rounded to the city center (~5km tolerance). NETRA may say *"written in Bangkok"* but the tether (if drawn) lands at the city marker, not the author's location. **Default and recommended.**
- `region` — coordinates discarded; only a region label is retained (e.g. *"written somewhere in northern Thailand"*). NETRA uses the label only.
- `hidden` — `lat` / `lon` / `label` are never exposed to NETRA or the renderer. The author may set `origin_locus` for personal records (Peat's own notes) but the runtime treats it as if the field were absent.

The build step **strips precision-incompatible data** before content reaches NETRA's grounding context or the rendered globe: a `city`-precision entry never has exact coordinates in the runtime payload. This mirrors the photo `share-location` privacy contract — opt-in granularity, not opt-out trust.

**Edge schema** (revised from v0.1): structured as a list of `{type, target, note?}` objects rather than flat arrays. This future-proofs metadata (`note`, future `strength`, `reason`, `quote`, etc.) without re-shaping the contract.

Edge `type` values: `diverged_from | merged_with | collapsed_into | adjacent`.
Edge `target` values: `fileNum` strings for articles/repos, `slug` strings for fiction. Cross-type edges (article diverged_from fiction, etc.) are valid — the worldline does not respect content-type boundaries.

### 9.3 Observer axis (Ne0N — static config, renamed from OBSERVER_NODES)

Defined directly in `lib/entries.ts`. **Renamed from `OBSERVER_NODES` to `OBSERVER_AXIS_NODES`** because the existing `OBSERVER_NODES` uses geographic semantics (Bangkok / Tokyo / Point Nemo or similar) that are incompatible with this ontology. The migration is mechanical: introduce the new constant, port the three axis entries, retire the old constant or rename it explicitly (`GEO_OBSERVER_POINTS`) if its existing usage must persist for some other view.

```ts
export const OBSERVER_AXIS_NODES = [
  { id: "α",   y: 0.0,  glyph: "nabla", label: "α" },
  { id: "012", y: 0.65, glyph: "bar",   label: "012" },
  { id: "047", y: -0.65, glyph: "bar",  label: "047" },
];
```

The values may evolve (additional reading positions, repositioning along the axis), but axis entries never come from frontmatter. They are config, not content.

### 9.4 Validation

velite collection schemas (per PRD 01 § data model) validate:
- Photo: GPS coords are within valid lat/lon ranges when `share-location: true`.
- Article/fiction: edge target IDs resolve to actual entries; circular `diverged_from → diverged_from` chains are warned but not blocked (a thought *can* loop).
- Domain values are in the enum (`identity | reflection | method | meta`).
- `origin_locus.precision`, when present, must be one of `exact | city | region | hidden`. Default if omitted: `city`.

**Privacy enforcement at build time.** For each `origin_locus` declaration:
- `precision: exact` — coordinates pass through as authored.
- `precision: city` — coordinates are resolved from a **local lookup table** keyed by the `city_id` field (a deterministic slug like `kyoto-jp`, `chiang-mai-th`, `bangkok-th`). The lookup table maps each `city_id` to its city-center coordinates. Geocode round-trips at runtime or build time are disallowed: they introduce network dependency and may yield different results across builds, breaking determinism. Implementers must use `city_id` for lookup — **never parse the human-facing `label` field**, which is prose for visitors, not a stable key. Fallback when `city_id` is missing or not in the lookup: drop to `precision: region` and emit a build warning recommending the author either add the entry to the lookup table or accept the lowered precision.
- `precision: region` — `lat` / `lon` are stripped from the runtime payload; only the `label` survives.
- `precision: hidden` — the entire `origin_locus` object is omitted from the runtime payload; NETRA's grounding context does not receive it.

**`render_tether` × `precision` interaction matrix:**

| precision | `render_tether: true` permitted? | What gets tethered |
|---|---|---|
| `exact` | yes | tether lands at exact (lat, lon) |
| `city` | yes | tether lands at city-center coordinate (resolved from `city_id` lookup), not the authored exact value |
| `region` | **no** — build emits a warning and treats `render_tether` as `false` | no anchor point exists; tether is meaningless |
| `hidden` | **no** — build emits a warning; the entire `origin_locus` is stripped from runtime regardless | tether impossible |

The build step performs this stripping before content reaches the velite-generated cache. Source frontmatter may contain exact coordinates for the author's records; runtime never sees more than the chosen precision allows.

Build fails on invalid GPS, missing required fields, unresolvable edge targets, unknown `precision` values, or `precision: city` without a `city_id` field. Build *warns* on circular lineage chains, on `render_tether: true` with `precision: region | hidden`, on `precision: city` with a `city_id` not in the local lookup table (falls back to `region`), and on `precision: exact` without `lat` / `lon`.

---

## 10. Migration from current ATLAS

This ontology **supersedes** the existing strata-button / camera-mode model in the codebase. It is not a refinement; it is a rewrite of the hero interaction.

### 10.1 What is retired

- **Strata toggle buttons** (Ne0 / NeX / Ne0N as UI selectors that switch view modes). Removed. Strata are spatial layers, not navigation modes.
- **Camera-mode switching that hides one stratum to show another.** Removed. All three strata render together by default.
- **UI copy treating strata as separate pages or modes.** Reworded to spatial language (*surface*, *orbit*, *axis*).
- **Old `OBSERVER_NODES` constant with geographic semantics.** Renamed to `GEO_OBSERVER_POINTS` if it must persist for other surfaces (e.g. a legacy map view); otherwise deprecated. The new ontology uses `OBSERVER_AXIS_NODES` (§9.3).

### 10.2 What is kept

- The existing Three.js globe base and `lib/cartography.ts` terrain generation.
- Existing entry and photo data — frontmatter migrates to the new contract (§9) by adding `origin_locus` and the `edges` array.
- The existing ATLAS status bar (used for instrument-register hover lines per §8.1).
- The palette system, including the film-simulation switcher (per PRD 03).
- The `ATTRACTOR_FIELDS` constant in `lib/entries.ts` — still partitions tags for orbital lateral drift (§12.1 `hashStringStable` over sorted tags). Existing `STAGE_RADIUS` and `DOMAIN_ANGLE` constants from the old model are **replaced** by the new `ORBIT_K`, `DOMAIN_MERIDIANS`, and `LATITUDE_BAND` constants in §12 — semantically different. The old names may be renamed during migration, or retained for any non-globe surface they still drive (e.g. legacy chapter index visualizations); they should *not* be reused for the new orbit shell.

### 10.3 What is new

- All strata render together by default.
- UI controls (drag, zoom, click) adjust **focus and camera**, not visibility mode.
- Stratum labels may exist as legend / status text, never as view toggles.
- The axis is now structurally visible (per §5.2), not faint.
- Edge splines render as great-circle arcs on the orbital shell (§4.4).

### 10.4 Migration order

The hero interaction must not be broken in `main` during the rewrite. Use a feature flag or working branch:

1. **In branch / behind flag:** rename `OBSERVER_NODES` → `OBSERVER_AXIS_NODES`; introduce `GEO_OBSERVER_POINTS` if needed for legacy usage. Type the axis nodes correctly.
2. **In branch / behind flag:** add `origin_locus` and `edges` fields to article/fiction frontmatter; populate for existing entries. Surface remains photos only.
3. **In branch / behind flag:** implement co-present rendering (surface + orbit + axis in one scene). Re-wire camera controls per §6.2. Layer in edges, hover pairings, density budget per §11.
4. **Verify** the co-present renderer at parity-or-better with the existing experience. NETRA companion lines fire correctly, all strata legible, no regression in entry navigation.
5. **In the same PR that lands the new renderer:** remove the strata-toggle UI from `WorldlineGlobe.tsx`. The buttons go *with* the new rendering, not before it — half-states (no buttons, no replacement) confuse contributors and break the hero for anyone on the branch.
6. After ship, implement v1 cut per §13; defer the rest.

The discipline here: the previous strata-toggle model continues to work in `main` until the replacement is fully ready.

---

## 11. Visual density budget

Three strata visible at once is a promise the renderer must keep without overcrowding the canvas. Hard rules:

### 11.1 Label visibility budget

At default zoom, **at most 3 labels visible at any time**. Priority order:

1. Currently hovered element (always shown).
2. Currently selected element (shown until deselected).
3. α (always shown unless preempted by 1 or 2).
4. NETRA-recommended node (when applicable, e.g. depth-threshold suggestion).

If priority slots 1 and 2 are both filled with non-α targets, α's label still renders but at reduced opacity (~50%) — α is always present, even if the eye is elsewhere.

012 / 047 labels do not render at default zoom unless hovered. They are not part of the regular reading surface.

### 11.2 Edge visibility budget

At default zoom:
- Edges connected to a hovered or selected node: full opacity, full stroke.
- All other edges: rendered at 15–25% opacity, base stroke width.
- `adjacent` edges (dotted, thin) are hidden by default and surface only when an endpoint node is hovered.

When zoomed out beyond ~1.4× default distance:
- Edges fade to ~10% opacity (the constellation becomes the figure; relations recede).
- Below ~0.8× default distance (zoomed in): non-focused edges hide entirely (the surface detail leads).

### 11.3 Surface pin density

- Individual pins render no labels unless hovered.
- Cluster glyphs render a numeric badge when count ≥ 2 (per §3.3 clustering).
- When the visible-pin count would exceed ~80 at default zoom, render the lowest-priority pins at 50% opacity. Priority uses **deterministic signals only** — oldest first, then distance from current camera focus. Session-memory or behavior-derived priority is *not* used here; it would make the globe quietly different on return visits, which contradicts the "recognition feels surveillant" principle in the NETRA character bible. The body should never look like spilled rice.

### 11.4 Hover dwell threshold

Companion-register lines do **not** fire on instant mouse pass. Required hover dwell: **≥ 250ms** before NETRA's companion slot updates. Instrument-register hover lines may update on any dwell (≥ 50ms is fine — they are the cartographer's bar, not the librarian's voice).

### 11.5 Idle state

When no interaction for ≥ 8s:
- All non-α labels fade to invisible.
- Edge opacity falls to 10% (no hover, no selection).
- α remains. The axis remains. The globe rests.

The globe at rest is *still*. No pulses, no animated glyphs, no rotating elements. The camera's idle drift (§6.3) is the only living motion — and it is so slow it reads as breathing. The visitor's return interaction wakes the readings.

### 11.6 Occlusion and back-side interaction

The globe is 3D. Half of every node, pin, and edge is behind the body at any camera angle. The renderer must define behavior for back-hemisphere elements.

Rules:

- **Surface pins** on the back hemisphere: render at ~30% opacity, **not interactive** (pointer events disabled). Visitor rotates to bring them forward to interact. Hovering through the body should not trigger pins behind it.
- **Orbital nodes** on the back hemisphere of the shell: render at ~45% opacity (orbit is a thin shell *outside* the body, so back-shell nodes are partially obscured but still partially visible at the silhouette edge). **Interactive only when in front of the body silhouette** — when a node's screen position would project through the body in the camera's view, disable its pointer events.
- **Edges (orbital splines)** crossing the back hemisphere: render at ~30% opacity, non-interactive on the back portion. Edges that cross the silhouette have a front-segment (full opacity, interactive) and a back-segment (dimmed, non-interactive). The transition happens at the silhouette edge.
- **Axis line** through the body: per §5.2 — back-segment depth-tested, front-segment overlay-friendly. Always non-interactive; only the axis *nodes* (α, 012, 047) are interactive, and only when in front.
- **Axis nodes on the far side** (e.g. α when camera rotated to view from behind): render at ~50% opacity, not interactive. Visitor must rotate to access.
- **Labels** never render *through* the body. A label attached to a back-hemisphere element does not appear.

This means the visitor must rotate the globe to interact with elements currently behind it. That is correct — it preserves the *body* as a real spatial object, not a transparent shell. The body has a back side; the back side hides things; rotation reveals them.

### 11.7 Keyboard exploration

The globe is the site's hero. It must be reachable by keyboard, even if camera rotation isn't a v1 control. Minimum keyboard contract:

- **Tab / Shift+Tab:** cycle focus through visible elements in a sensible order — α, then surface pins (clockwise from north), then orbital nodes (by domain meridian, then date). Focus only iterates *front-hemisphere* interactive elements; back-hemisphere items skip.
- **Enter / Space:** activate focused element — navigate to entry (surface, orbit) or move camera (axis).
- **Escape:** clear focus / selection. Second press returns camera to default view.
- **`/`:** open search overlay (per PRD 04). Not globe-specific but lives in the same keyboard space.
- **Arrow keys:** deferred from v1; if accessibility audit demands camera rotation, add `←→` for longitude and `↑↓` for latitude (with the same clamps as drag).

**Semantic proxy layer (required for canvas/WebGL implementations).** A raw `<canvas>` element does not natively expose its child marks to keyboard focus or assistive tech. The renderer must maintain a parallel DOM overlay — **visually hidden but keyboard-focusable**, with `aria-label` for each interactive mark.

**Critical: how to hide the proxy correctly.**

- ✓ **Use:** a "visually hidden but focusable" technique — `clip-path`, off-screen positioning with `position: absolute; left: -10000px`, or `clip: rect(0 0 0 0)` combined with `width: 1px; height: 1px; overflow: hidden` (the classic `sr-only` pattern). The element stays in the accessibility tree, receives focus, and fires events.
- ✗ **Do not use** `display: none` — element is removed from accessibility tree; Tab skips it.
- ✗ **Do not use** `visibility: hidden` — element is removed from accessibility tree; Tab skips it.
- ✗ **Do not set** `aria-hidden="true"` on proxy buttons themselves — that defeats the entire point of the proxy. `aria-hidden="true"` belongs only on the `<canvas>` element (which has no accessible content to expose).

Suggested pattern:

```html
<canvas aria-hidden="true">...</canvas>
<div class="sr-interactive-layer">
  <button class="globe-mark-proxy"
          aria-label="α observer locus, divergence 1.130426"
          data-mark="axis:alpha">…</button>
  <button class="globe-mark-proxy"
          aria-label="Article 003, on the architecture of taste, orbit node"
          data-mark="orbit:003">…</button>
  <button class="globe-mark-proxy"
          aria-label="Photo, frame 043, Chiang Mai, surface pin"
          data-mark="surface:2026-04-chiang-mai/043">…</button>
  …
</div>
```

The proxy buttons receive Tab focus; their `focus` events drive the canvas's visual focus ring; their `click` / `keydown` events trigger the same interactions as canvas hit-testing. Accessible names follow the pattern *"{Mark type}, {primary identity}, {stratum} {mark form}"* so screen-reader users hear meaningful descriptions, not coordinates.

The proxy layer only renders front-hemisphere interactive marks — Tab order skips back-hemisphere elements (consistent with §11.6 occlusion).

Focus rings on globe elements use the active palette's focus accent at full opacity — visible against terrain, orbit, and axis backgrounds. Focused element gets a label even if it wouldn't ordinarily (overrides the density budget §11.1).

Keyboard exploration ships in v1. The textual fallback (§14.5) is for no-WebGL environments, not a substitute for keyboard access on the real globe.

### 11.8 Hit targets and picking radius

Visual size is what the eye sees; **picking radius is what the pointer hits**. They are independent.

- **Desktop pointer:** minimum picking radius of 16px around any mark's center, regardless of mark's rendered size.
- **Touch input:** minimum picking radius of 44px (per WCAG 2.5.5 target size guidance). When density would force overlapping 44px touch targets, **cluster the marks first** (per §3.3 surface clustering pattern, applied also to orbital nodes if they pile up) — do not shrink hit targets below 44px to fit individual marks side-by-side. Cluster-first preserves both touch usability and visual legibility; shrinking hit targets to fit dense layouts is the worst of both worlds.
- **Axis nodes** get 24px desktop / 48px touch — they are anchor points and benefit from generous targeting.
- **Edges** are pickable along a 6px-wide invisible corridor centered on the spline, regardless of stroke width.

When picking radii of nearby marks would overlap, prefer the closer-to-pointer-center mark first; secondary tiebreaker: front of camera depth. Hover/focus feedback fires on whichever wins.

The body should feel responsive — small marks should not require sniper-aim. This rule applies to surface pins, orbital nodes, axis nodes, and edges uniformly.

---

## 12. Placement algorithm

Orbital node placement must be **deterministic** across builds for unchanged content. The same entry on two builds must land at the same coordinates. Anything else causes the globe to drift between deploys, which destroys trust in the spatial model.

### 12.1 Pseudocode

```ts
// constants (lib/entries.ts)
const R = 1.0;                              // globe radius (normalized)
const ORBIT_K = 1.18;                        // orbital shell radius factor
const DOMAIN_MERIDIANS = {
  identity:   0,                             // degrees longitude
  reflection: 90,
  method:     180,
  meta:       270,
};
const DOMAIN_DRIFT_DEG = 35;                 // ± lateral drift within a domain slice
const LATITUDE_BAND = 55;                    // ± latitude range for date distribution

// Spatial-stability anchors. Fixed in config; do NOT derive from corpus.
const SITE_EPOCH = new Date("2024-01-01");   // anchor for oldest position
const SITE_HORIZON = new Date("2030-01-01"); // anchor for newest position

function placeOrbitNode(entry) {
  // 1) Longitude: domain meridian + deterministic tag-derived drift
  const baseAngle = DOMAIN_MERIDIANS[entry.domain];
  const tagKey = entry.tags.slice().sort().join("|");                              // sorted = order-independent
  const tagDrift = (hashStringStable(tagKey) % 200 - 100) / 100; // [-1, 1]
  const lon = baseAngle + tagDrift * DOMAIN_DRIFT_DEG;

  // 2) Latitude: fixed-epoch normalized
  const t = clamp01(
    (entry.date - SITE_EPOCH) / (SITE_HORIZON - SITE_EPOCH)
  );
  const lat = lerp(-LATITUDE_BAND, LATITUDE_BAND, t);

  // 3) Radius: orbital shell, with optional dense-cluster offset (§14.2)
  const radius = R * ORBIT_K;

  return sphericalToCartesian(radius, lat, lon);
}
```

### 12.2 Determinism and spatial stability

Two distinct properties, both required:

**Determinism** — the same entry on two builds produces the same coordinates.
- `hashStringStable` must produce identical output on repeat builds. A simple FNV-1a or murmur3 over the joined tag string is enough. **Never use random number generators in placement.**

**Spatial stability** — adding new entries does *not* shift the positions of existing entries.
- `SITE_EPOCH` and `SITE_HORIZON` are **fixed configuration constants**. They do not derive from the corpus's min/max dates. An entry placed today at a given latitude stays at that latitude forever, regardless of what is published before or after.
- This means new entries published past `SITE_HORIZON` clamp at the north-pole side of the band. When the site approaches the horizon (e.g. 2028+ for a 2030 horizon), bump `SITE_HORIZON` forward in a planned migration — this *will* shift existing positions, but the shift is intentional and infrequent rather than per-deploy.

The earlier v0.2 spec allowed corpus-driven `minDate / maxDate`, which means every new entry shifts every old entry's latitude on the next build. That was a mistake — spatial memory is one of the things the globe earns; deploys that quietly move things destroy it. Fixed epoch is the contract.

### 12.3 Edge cases

- **Same date.** Multiple entries on the same date share latitude. Lateral drift via tag hash separates them within their domain slice. If two entries collide exactly (same date, same domain, same tag set), add a deterministic micro-offset based on `fileNum`.
- **Domain not in enum.** Build fails (validation in §9.4).
- **Single-entry corpus.** Latitude is well-defined (epoch-to-horizon normalization), no division by zero.
- **Entry dated before `SITE_EPOCH` or after `SITE_HORIZON`.** Clamp to the band. Log a warning at build time.
- **Fiction.** Uses the same `domain` field as articles. Fiction does not need a separate orbit shell — a fiction ring glyph (§4.5) is enough to distinguish it visually.

### 12.4 Coordinate convention

To prevent mirrored or inverted globes across implementations, the spec locks the following conventions:

- **Coordinate system:** right-handed.
- **Up vector:** world +Y, pointing toward the north pole.
- **Front (default camera-facing meridian):** longitude 0° maps to **+Z**. `DOMAIN_MERIDIANS.identity = 0°` therefore renders at the front of the body in the default camera view.
- **Right side of body (visitor's right at default view):** longitude +90° maps to **+X**. `DOMAIN_MERIDIANS.reflection = 90°` is the right-side meridian.
- **Back of body:** longitude 180° maps to **-Z** (`method` domain, far side).
- **Left side of body:** longitude 270° maps to **-X** (`meta` domain).
- **Latitude:** +90° at +Y pole (north); −90° at −Y pole (south).
- **Spherical → Cartesian conversion** (standard):
  ```ts
  function sphericalToCartesian(radius, latDeg, lonDeg) {
    const lat = latDeg * Math.PI / 180;
    const lon = lonDeg * Math.PI / 180;
    return {
      x: radius * Math.cos(lat) * Math.sin(lon),
      y: radius * Math.sin(lat),
      z: radius * Math.cos(lat) * Math.cos(lon),
    };
  }
  ```

Implementations must verify all four cardinal meridians render in the expected positions before considering placement correct. A globe that places `identity` on the back (because of a sign flip) is a silent bug that propagates everywhere; the conventions above are a contract, not a suggestion.

---

## 13. v1 implementation cut

Not everything in this spec ships in v1. Cutting deliberately avoids the failure mode where the renderer attempts the entire ontology at once and produces something half-finished in all directions.

### 13.1 Must ship in v1

- Co-present rendering of all three strata at default camera angle.
- Surface photo pins with GPS opt-in (per PRD 03).
- Orbital article/fiction nodes with placement per §12 (fixed-epoch, spatially stable).
- Axis with structurally legible weight per §5.2 (and prominence rule §5.6).
- α node with nabla glyph and live divergence reading.
- Hover pairings (instrument always, companion on dwell ≥ 250ms).
- Click-to-navigate for surface and orbital nodes.
- Click-to-center for α; click-to-tilt for 012 / 047.
- `diverged_from` and `adjacent` edges (most common; lowest authoring burden).
- Edge normalization rules (§4.7) — adjacent dedup, directional canonicalization.
- Occlusion / back-side interaction rules (§11.6) — front-only interactivity, back-hemisphere dimming.
- Keyboard exploration (§11.7) — Tab cycle, Enter/Space activate, Escape clear.
- Visual density budget (§11) enforced.
- Reduced-motion and no-WebGL fallbacks (§14.5).
- Migration items in §10.4.

### 13.2 Should ship in v1 if scope permits

- `merged_with` edge rendering (convergence glyph at the merge node).
- Cluster glyphs for dense surface regions (§3.3).
- Edge-flying camera traversal on click (§4.6 spline traversal).
- α drift indicator on patch detection (§5.5).
- Orbital radius expansion in dense regions (§14.2).

### 13.3 Defer past v1

- `collapsed_into` edge rendering with dashed fading splines.
- Repo node glyphs (diamonds) — wait until repo writeups land per feature brainstorm §1.4.
- Article `origin_locus` tether rendering (the faint line from orbital node down to surface point). The `origin_locus` data ships in v1; the visual tether ships later when worth the complexity.
- Orbit ripple on α drift — start with α brightening only (§5.5); orbital ripple ships later if the patch event is hard to notice without it.
- Keyboard camera rotation (arrow-key longitude/latitude) — keyboard exploration (Tab/Enter/Escape) ships in v1 per §11.7; arrow-key rotation may follow in v1.x if accessibility audit demands it.

The discipline here is: ship a *complete* small thing rather than an incomplete large thing. Every item in §13.1 is required for the spatial model to make sense. Items in §13.2 enrich the model. Items in §13.3 polish it.

---

## 14. Edge cases and degradation

### 14.1 Sparse content (early site)

A site with few entries renders a globe with few nodes. The structure stays — surface is mostly empty, orbit is mostly empty, the axis is fully present. This is correct: a young archive *is* mostly empty. The globe should not fake density.

NETRA's companion register may acknowledge this on the first encounter:
- *"this archive is still young. fewer marks than you might expect."*

### 14.2 Dense clusters

When orbital nodes pile within a small angular distance (a single domain with many entries on similar attractor fields):
- They render normally up to some local density.
- Beyond that, they expand orbital radius slightly to relieve crowding — entries in the dense region sit at `k × 1.04` instead of `k`. Subtle, not jarring.
- Edges in the dense region thin to 0.5px to keep the area readable.

### 14.3 Photos without GPS

Many photos may lack GPS (camera GPS off, manual edits stripping EXIF, deliberate non-opt-in). These do not appear on the globe — they appear in roll views (per PRD 03). The globe is not the only way to reach photos; the photo journal index exists in parallel.

### 14.4 Mobile

On viewports ≤ 600px:
- Globe occupies ~70% of viewport height (leaving room for status bar and NETRA narrative slot).
- Pins/nodes scale up slightly (~125%) for touch.
- Hover behaviors map to a first-tap / second-tap pattern:
  - First tap on a node/pin: shows instrument readout + companion line (if applicable). Element enters *selected* state with visible highlight.
  - Second tap on the same element within 5 seconds: navigates (for surface/orbit) or moves camera (for axis).
  - Second tap after 5 seconds: treated as a fresh first tap (re-shows status; does not navigate). This prevents accidental navigation when the visitor inspects, looks away, then taps again to dismiss.
  - Tap anywhere outside the selected element: clears selection. Empty-space tap also clears.
- Hover dwell threshold (§11.4) does not apply on touch; status appears on first tap.
- Idle drift remains, but at half speed (battery considerations on mobile + reduced animation expectations).

### 14.5 No-WebGL fallback

If WebGL is unavailable (rare modern devices, deliberate disable, security policy):
- Render a textual map: a list of entries grouped by stratum, with their coordinates listed.
- Surface: photo list with GPS strings.
- Orbit: article/fiction list with domain + date + edges as relation strings.
- Axis: α value displayed prominently.
- A footer note: *"This archive is best viewed with WebGL enabled."*

Same principle as the no-JS fallback (boot ceremony §5.4): the site remains *readable* without the medium, just not *experiential*. Keyboard camera rotation is deferred from v1; a future accessibility pass should evaluate whether arrow-key rotation is needed beyond the Tab/Enter/Escape exploration that ships in v1 per §11.7.

---

## 15. What this is NOT

A few failure modes worth naming so they can be refused on contact:

- **Not a navigation hub.** Visitors can reach pages from the globe, but the globe is not the menu. Other surfaces (chapter index, archive list, search) reach the same pages without involving the globe. Navigation is a valid outcome of globe interaction; navigation is not the ontology.
- **Not personality-mapped.** Strata do not represent "Nerd / Core / Explorer" personas. That framing was earlier; it's gone. Strata are *spatial layers of one body*, not facets of identity.
- **Not generative.** No procedural content. No "the globe writes new entries." Every node is authored.
- **Not gamified.** No achievements, scoring, completion meters, hidden-area unlocks beyond the boot anomaly (which is part of the boot, not the globe).
- **Not a chat interface.** NETRA may speak in response to globe events, but the globe is not where chat happens. **Chat lives in a `/` overlay or a separate side panel — it is not a fourth stratum of the globe.** Adding chat as a stratum would contradict the central architectural decision that strata are spatial layers, not modes. PRD 05's chat surface placement aligns with this.
- **Not a portfolio rotator.** The default camera does not auto-tour the visitor through "Peat's greatest hits." Idle drift is breathing, not curation.

### 15.1 Globe is exploratory first, navigational second

To make the distinction concrete: *hover, edge traversal, axis vantages, cluster zoom, and camera movement keep the visitor inside the globe.* Direct navigation happens only when the visitor selects a content node with intent.

> A click on content is an exit. A click on relation or observer is exploration.

Both are valid. Both are needed. But the design must protect against the failure mode where the globe collapses into "an interesting menu." If most visitor sessions consist of clicking pins to leave the globe, the globe has not done its job — the exploration interactions (edges, axis, camera) need to be more inviting.

---

## 16. Open questions

To resolve as implementation proceeds. None block writing this spec.

- **Domain angle assignment specifics.** The 0° / 90° / 180° / 270° mapping is a starting point. After enough entries are on the globe, audit whether the resulting orbital distribution is legible or if domain slices should rotate to a different baseline.
- **Latitude derivation strategy.** Currently date-driven against fixed `SITE_EPOCH` / `SITE_HORIZON`. Could also be attractor-field-driven (clustering). Decide once first ~20 entries are placed and the orbit can be eyeballed.
- **`SITE_HORIZON` management.** Set to 2030 in §12.1. As the site approaches the horizon (2028+), `SITE_HORIZON` will need to bump forward in a planned migration that shifts existing latitudes intentionally. Plan that migration once before it's needed; do not let it become an emergency.
- **Cluster threshold tuning.** §3.3 starting threshold (≤ 1.5° angular distance) is a guess. Revise after first roll's pins are on the globe.
- **Orbit shell radius.** `k ≈ 1.18` is a starting point. Decide visually once enough nodes are placed.
- **Repo glyph and orbit placement.** Repos are deferred from v1.0. When they join, decide whether they share the article orbit or sit on a slightly outer shell.
- **NeX trembling on α drift.** When a patch ships and α drifts, should the orbit visibly respond (slight ripple) or only the axis (brightening only, per §5.5)? Currently spec'd as axis-brightening only. Revisit if patches become frequent enough that visitors might notice.
- **Edge-traversal speed.** §4.6 specifies ~600ms ease. Long edges across the globe may feel slow at that duration; short edges may feel rushed. Consider easing the duration as a function of edge arc length.
- **First-encounter highlight.** Should the globe momentarily highlight a recommended entry-point node when NETRA's first-encounter line fades in? Tempting; risks feeling like "tutorial." Recommend not for v1.0, revisit if visitors get stuck on the empty body.
- **Article `origin_locus` tether visualization.** v1 ships the data; the visual tether is deferred. When introduced, decide whether tethers render globally (always visible for every article with `render_tether: true`) or only on hover/selection of the article node.
- **Click-to-navigate analytics.** If post-launch data shows most globe sessions consist of immediate click-and-exit (no hover, no edge, no axis interaction), the globe has drifted into "interesting menu" territory. Consider then: introducing a single-click-selects / second-click-or-CTA-navigates pattern for orbital nodes; or making edge interactions more prominent at first encounter. Don't pre-build this — measure first.
- **`precision: city` lookup coverage.** The lookup table covers major public cities by default. For places that are small towns, neighborhoods, or rural locations, `city` precision may still be too narrow (a small town centroid may sit close to a private residence). When `city` precision is requested for a place not in the lookup, the build falls back to `region` with a warning. Authors writing about smaller or rural origins should default to `region` or `hidden`, not `city`.
- **Authoring privacy (cross-doc guidance).** Source frontmatter may contain exact coordinates that runtime never sees — but if `content/` is committed to a public repository, exact source coordinates are public regardless of build-time stripping. Authoring guidance (to live in PRD 03 / authoring guide, not here): *do not commit exact private coordinates to any public repository even when `precision` will strip them at build*. Use `precision: hidden` and omit `lat` / `lon` from source entirely when the place is sensitive.

---

## 17. Versioning

This document is the spec for the site's hero element. Changes here ripple into how every entry is placed and how visitors read the archive. Treat as a content document, not a config file.

When updating: PR with rationale paragraph and, where relevant, a visual mock or diagram of the change. Spatial-model changes especially benefit from a sketch — words alone struggle to capture before/after on a 3D structure.

### Changelog

- **v0.1 (2026.05.12)** — initial draft. Locked the three strata as co-existing spatial layers (Ne0 surface = photos at GPS, NeX orbit = articles/fiction with worldline-mechanic edges, Ne0N axis = observer locus tied to existing `OBSERVER_NODES`). Defined placement rules: surface uses real GPS; orbit uses domain meridians + date latitude + attractor-field lateral drift at radius `k ≈ 1.18`; axis is static config. Defined four edge types (`diverged_from`, `merged_with`, `collapsed_into`, `adjacent`) as content-authored frontmatter. Specified glyph families per stratum (square / circle / ring / diamond / vertical bar), interaction model (hover = NETRA pair, click = navigate or camera move per stratum), camera defaults and idle drift, visual hierarchy across zoom levels, frontmatter contracts, edge cases including sparse/dense distribution + no-WebGL fallback, and explicit anti-failure framing in §11.
- **v0.2 (2026.05.12)** — Ne0N strengthening + implementation contract. **Ne0N upgraded from "faint scaffolding" to load-bearing pillar.** Rewrote §0, §1.1, §2.3, §5: the axis is now structurally visible (1.5px → 2.5px stroke, 70% opacity through body, brightening above poles), α is the most prominent single mark on the globe (~14px nabla glyph with subtle 4s pulse), Atlas-the-Titan dual reading made explicit ("ATLAS the instrument shares its name with the Titan who held the heavens"). Added §5.6 implementer's test for whether the pillar is correctly weighted. **Articles keep place-memory:** added optional `origin_locus` frontmatter (label + lat/lon + visible flag) so the truth that thoughts are born in real places (Kyoto kissaten, Chiang Mai hillside, Yirgacheffe cafe) survives the ontology shift — orbit position and ground anchor co-exist. **Renamed `OBSERVER_NODES` → `OBSERVER_AXIS_NODES`** with explicit migration note (the old constant uses geographic semantics incompatible with this ontology; rename to `GEO_OBSERVER_POINTS` if legacy usage persists). **Restructured edge schema** from flat arrays to `{type, target, note?}` list for metadata future-proofing. **Added 4 new sections:** §10 *Migration from current ATLAS* (what is retired, kept, new, in what order); §11 *Visual density budget* (max 3 labels at default zoom, edge opacity tiers, 250ms hover dwell for companion register, idle quieting); §12 *Placement algorithm* (pseudocode + determinism requirement + edge cases); §13 *v1 implementation cut* (must/should/defer triage). **Resolved chat contradiction:** "dedicated stratum surface" wording in §15 changed to "`/` overlay or separate side panel — not a fourth stratum"; PRD 05 alignment noted. **Strengthened navigation framing:** "navigation is a valid outcome, not the ontology" replaces weaker "side effect" framing; added §15.1 *exploratory first, navigational second* with rule "*A click on content is an exit. A click on relation or observer is exploration.*"
- **v0.3 (2026.05.12)** — Ne0N recalibrated to co-equal; rendering contract hardened. **Stripped mythic over-weighting:** removed "Titan / spine / pillar / load-bearing / most ontologically primary" language; axis is now described as one of three co-equal strata with thinner feature surface, not as the elevated structural element. Atlas-the-Titan reading retained as a *single bounded note* in §2.3, not a recurring theme. **Recalibrated axis visuals:** stroke 1.5px → 1.25px at default; opacity 70%/95% → 55%/75%; α glyph 14px → 10px; α pulse removed entirely (competed with α-drift indicator and added motion to a central element that should rest). Added §5.6 *Prominence rule*: "axis is structurally legible at all zoom levels, but never visually dominant." Three-state implementer's test (too soft / too loud / right). **Fixed contradictions:** §2.2 wording "do not have GPS" → "not placed by GPS, may carry origin loci"; §7.2 / §7.3 axis opacity now matches §5.2 (subdues to ~40% body-segment on surface zoom-in, never described as "faint"). **Hardened rendering rules:** added §4.7 *Edge normalization* (adjacent dedup as `sorted(a,b)`, directional canonicalization for diverged/collapsed, merged collected on target, duplicate guard with build warnings). Added §11.6 *Occlusion and back-side interaction* (front-hemisphere interactive, back-hemisphere dimmed and non-interactive; labels never render through the body; axis nodes on far side at 50% non-interactive). Added §11.7 *Keyboard exploration* (Tab/Enter/Escape contract; ships in v1, not deferred). Added §5.2 *Depth rendering implementation hint* (three segments — above-pole / inside-body / below-pole — with depth-tested middle and overlay-friendly extensions). **Spatial stability:** §12 placement algorithm now uses fixed `SITE_EPOCH` and `SITE_HORIZON` constants instead of corpus-derived `minDate / maxDate` — entries no longer drift between deploys. Added v0.2 mistake acknowledgment in §12.2. Added `SITE_HORIZON` planned-migration note. **Migration order corrected (§10.4):** branch/feature-flag pattern instead of sequential remove-then-add; strata-toggle UI removal happens *in the same PR* as new renderer landing, not before. **Renamed `origin_locus.visible` → `render_tether`** for clearer semantic (data availability is unconditional; flag controls only tether rendering). **Mobile tap pattern detailed:** first-tap shows status, second-tap within 5s navigates, second-tap after 5s treated as fresh first-tap (prevents accidental navigation). **Camera roll lock added to §6.2:** world up vector (0, 1, 0) enforced at all times. **Open questions updated** with click-to-navigate analytics question (measure first, intervene if data shows globe-as-menu drift) and SITE_HORIZON migration planning.
- **v1.0 (2026.05.12)** — final consistency pass. Fixed `render_tether` prose reference under §9.2 YAML (was still saying `visible: true`). Fixed §13.3 typo "v1.7" → "v1" for keyboard exploration; clarified arrow-key camera rotation as the v1.x defer (Tab/Enter/Escape ships in v1). Soft-restated §6.2 keyboard rotation sentence to point at §11.7 instead of treating accessibility as afterthought. Aligned §2.2 placement language with §12 contract: latitude is fixed-epoch date-normalized (not "newer pushes older down"); lateral drift = sorted-tag hash. Clarified §10.2 constants: `ATTRACTOR_FIELDS` survives migration; `STAGE_RADIUS` / `DOMAIN_ANGLE` from old model are replaced by `ORBIT_K` / `DOMAIN_MERIDIANS` / `LATITUDE_BAND` in §12 — implementer should not reuse old names for new orbit shell. Rewrote §4.7 edge normalization with new schema language (`edges: [{type, target}]` instead of legacy `001 declares adjacent: 003`). Strengthened contradiction handling for opposing `diverged_from` declarations: loud build warning + strict-mode failure + non-strict mode draws nothing for the contradicted pair (no silent direction-picking that would hide author error). Sorted entry.tags before hashing in §12 pseudocode (`entry.tags.slice().sort().join("|")`) — placement is now stable under tag-order changes. Removed "least-recently-viewed via session memory" from §11.3 pin-density priority (replaced with deterministic-only signals: oldest, distance from camera focus); session-memory priority would contradict non-surveillant principle. Added v1 fallback for edge click in §4.6: if edge-flying animation is scope-deferred, click selects both endpoint nodes — exploration preserved without traversal animation.
- **v1.1 (2026.05.12)** — consistency / privacy / accessibility hardening. **Actually fixed §2.2 latitude language** (v1.0 changelog claimed this was done; it was not — the stale "derived from date, attractor field, or both" line survived in §2.2's Tier-2 overview while only §4.2's detailed section had been updated). Now §2.2 matches §12: fixed-epoch date latitude + sorted-tag-hash lateral drift, with explicit spatial-stability contract. **Privacy gap closed in `origin_locus`:** added `precision: exact | city | region | hidden` field with build-time enforcement. Default `city` rounds coordinates to city-center (~5km tolerance). `region` strips coords entirely, keeping only the label. `hidden` strips the entire object from runtime payload. The build step performs precision-incompatible-data stripping before content reaches NETRA grounding or the renderer — mirrors photo `share-location` opt-in contract. Authors may keep exact coordinates in source for their own records; runtime never sees more than the chosen precision. **Canvas keyboard access fixed:** added semantic proxy layer pattern in §11.7. Raw `<canvas>` doesn't expose marks to keyboard/AT; renderer must maintain parallel invisible DOM overlay (`<button class="globe-mark-proxy" aria-label="…">`) for each interactive mark. Accessible name format: *"{Mark type}, {primary identity}, {stratum} {form}"*. Proxy layer skips back-hemisphere elements (consistent with §11.6). **Hit targets separated from visual size (§11.8 new):** desktop picking radius ≥ 16px, touch ≥ 44px, axis nodes ≥ 24px/48px, edges 6px corridor — even when visual mark renders at 3px. WCAG 2.5.5 alignment for touch targets. Overlap tiebreaker: closer-to-pointer-center first, then front-of-camera depth. **§8.2 edge click consistency** updated to match §4.6 ideal/fallback pattern. **§12.4 coordinate convention locked** to prevent mirrored/inverted globes: right-handed system, world +Y up, longitude 0° = +Z (front), +90° = +X (right), 180° = −Z (back), 270° = −X (left); spherical→Cartesian formula explicit. Implementations must verify all four cardinal meridians before considering placement correct.
- **v1.2 (2026.05.12)** — privacy enforcement matrices + keyboard/proxy edge cases. **§1.2 polish:** "this thought happened *here* literally" → "this photo happened here; this thought may carry an origin, then takes its place in orbit by meaning" (resolves last ambiguity between photo-as-physical and article-as-meaning placement). **`render_tether` × `precision` interaction matrix added to §9.4:** tether permitted only with `exact` or `city` precision (tether lands at city-center when `city`); `region` and `hidden` make tether meaningless — build warns and ignores `render_tether: true` in those cases. **`precision: city` determinism locked:** local lookup table required, not runtime/build geocode round-trips (which break reproducibility and add network dependency). Cities outside the lookup fall back to `region` with build warning. **Photo privacy hardened to match `origin_locus`:** §9.1 now explicitly states EXIF GPS is build-time-stripped from runtime payload and served metadata when `share-location: false` — source files may retain GPS for photographer's records, the pipeline strips it from anything that ships. Same opt-in model, same enforcement layer. **Idle drift × keyboard focus rule added to §6.3:** Tab focus, active selection, or open screen-reader announcement counts as interaction and prevents idle drift from engaging — protects screen-reader users whose focused mark could otherwise rotate behind the body mid-announcement. **Semantic proxy "invisible" trap closed in §11.7:** explicit ✓/✗ list — use `clip-path` / off-screen `sr-only` pattern; never `display: none`, never `visibility: hidden`, never `aria-hidden` on proxy buttons themselves (only on the canvas). Prevents the common WCAG anti-pattern where proxy is "hidden" so well it's invisible to AT too. **Touch density rule clarified in §11.8:** when 44px touch targets would overlap, *cluster first, shrink last* — never shrink hit targets below 44px to fit dense layouts (cluster glyph + expand-on-tap is the right answer). **Open questions expanded:** `precision: city` small-town/rural caveat (small-town centroid may still be close to private residence; authors should prefer `region` / `hidden` for sensitive origins); authoring privacy cross-doc guidance (do not commit exact private coordinates to public repos even when build will strip them at runtime).

---

*End of spec. See `docs/00-netra-character.md` §11 for the companion-register voice on globe events; `docs/00-atlas-boot.md` §6 for the entry transition; PRD 01 / PRD 03 for entry- and photo-level details that flow into globe placement.*
