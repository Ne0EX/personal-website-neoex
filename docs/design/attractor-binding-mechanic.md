# Worldline · AttractorFields ↔ Globe ↔ Divergence · binding mechanic

> Status · v1.1 · 2026-05-15 (v1.3-strata-target revision pass)
> Author · Betelgeuse (α-VIS-04) · TASK-2026-05-15-14 · opus tier
> Predecessors · `journey-architecture.md` v1.2 · `docs/prds/00-globe-ontology-1.2.md` v1.3 (strata co-equal · **target renderer**, NOT current PoC — locked by Peat 2026-05-15 "ทำ 1.3 STRATA") · `FEEDBACK-2026-05-15-peat-on-betelgeuse-design.md` (earth-textured Globe + orbital network feel + transparency revealing Ne0N — Peat's three locked direction shifts)
> Status of artifacts cited · v1.3 ontology = canonical · current `WorldlineGlobe.tsx` = LEGACY (toggleable framings retire per ontology §10); v1.3 renderer = target (built by a later Sirius TASK, not this one) · AttractorFields = stub · DivergenceMeter = implemented (compact + lg variants) · binding glue = does not exist
>
> This is the canonical doc for the binding mechanic that ties the three currently-independent surfaces (DivergenceMeter, Globe/ATLAS, AttractorFields) into the Steins;Gate cosmology Peat spelled out. Every implementation TASK touching any pair of these three components after 2026-05-15 derives from this document.
>
> **v1.1 revision (2026-05-15, this TASK redispatch).** Peat locked v1.3 strata co-equality as the renderer target ("ทำ 1.3 STRATA" — proceed with v1.3 strata model, co-equal, simultaneously rendered, no toggle, no fork). The original v1 of this doc was authored before that lock and treated the four toggleable camera framings (`all` / `nex` / `neon` / `neo`) as canonical state. v1.1 surgically corrects this:
> - §1.3a (new) — explicit retirement of toggleable framings within the binding's scope; the binding assumes the v1.3 co-present renderer
> - §4.1 + §4.2 — `stratum` is replaced by `cameraFocus` (a camera-aid pointer, never a visibility toggle); all four base layers always render
> - §7.1 + §7.6 — Sirius handoff updated to match v1.3 target
> - §10 — non-goal "no revision to three-pill camera framings" is REVERSED to "framings retire per ontology §10 migration; binding consumes the v1.3 renderer's state shape"
> - Peat's three locked direction shifts (earth-textured / orbital network / transparency revealing Ne0N) are now explicit in §1.6 (new)
>
> Sections §0, §1.1, §1.2, §1.4, §1.5, §2, §3, §5, §6, §8, §9, §11 are unchanged from v1 — they were already v1.3-compatible. Only the state-shape and migration framing required surgery.

---

## 0 · framing — why this doc exists

Three components on the live PoC. Each handsome. Each independent. None of them aware of the others.

- **DivergenceMeter.tsx** — Nixie-tube reading of `α 1.130426`. Idle flicker. Drift loop. Renders in the HeroBlock and inline. Knows nothing.
- **WorldlineGlobe.tsx** — A.T.L.A.S. observatory frame. Stratum chooser. Earth-textured paper sphere. Pins. NETRA voice strip. Knows its own stratum and its own selected pin.
- **AttractorFields.tsx** — eleven `t-mono` pill buttons reading `coffee · ai · ml · narrative · …`. Has local state for the active pill. Nothing receives that state.

Per Peat's Steins;Gate-rooted cosmology (2026-05-15):

> *DivergenceMeter says **which worldline** we are on. AttractorFields names **the events with narrative mass** that pull and hold this worldline in place. The Globe shows **where those events are** in space, and **the geometry** that the worldline traces.*

The three are tightly bound. This doc is the binding contract.

It is also where v1.3 globe-ontology's hardest constraint lands for the first time: **strata Ne0 / Ne0N / NeX are co-equal peer layers**, not children of a `FULL-Ne0EX` union. FULL is a *view*, not a parent. The binding mechanic encodes that framing — picking a stratum *filters* the visible co-equal layer; picking an attractor *highlights membership* across whatever layer is currently the figure. The two selectors compose; they do not subordinate.

---

## 1 · cosmology — what binds what

> *The semantic model spelled out for implementers. If the implementation matches the model, the visual will follow.*

### 1.1 four nouns and their scope

| noun | type | scope | shipped where |
|---|---|---|---|
| **divergence** | scalar on `[0, ∞)` read off the worldline's drift from α | a single number; the current locus | `DivergenceMeter.tsx` · `α 1.130426` |
| **attractor** | tagged narrative cluster — `coffee`, `ai · ml`, `narrative`, `japan / 日本`, etc. | categorical · enumerated in `ATTRACTOR_FIELDS` (`lib/entries.ts`) | `AttractorFields.tsx` (rendering) · entry frontmatter (membership) |
| **field** | the gravitational pull of an attractor across the corpus — how many entries fall in it, where they spatially cluster, how connected they are | derived from attractor membership; not stored | computed at render time per attractor |
| **stratum** | one of the three co-equal layers — `Ne0` surface, `Ne0N` axis, `NeX` orbit | not exclusive with each other; `FULL` is a *view* that unions all three | `WorldlineGlobe.tsx` `STRATA` record (toggleable framing as shipped) + ontology v1.3 (co-equal as canonical) |

These four nouns are the only ones the binding mechanic operates on. The implementer should not introduce a fifth.

### 1.2 the binding rule, in one sentence

> *Stratum filters the layer · attractor highlights membership · divergence reads the observer · all three compose without subordination.*

The decomposition:

- **Stratum** answers *which co-equal layer is the figure right now?* (`Ne0` = surface; `Ne0N` = axis; `NeX` = orbit; `FULL` = all three visible as one body)
- **Attractor** answers *which narrative cluster is the visitor surveying within that layer?* (defaults to `all`; otherwise highlights membership and shows the field's inter-node geometry)
- **Divergence** answers *who is observing, and from where?* It is the visitor's own locus on the worldline. It does **not** change when the visitor picks an attractor — the observer is not their query.

Composition rule: **stratum and attractor are orthogonal axes**. Any (stratum, attractor) pair is legal. The Globe renders the intersection. The DivergenceMeter is invariant under both.

### 1.3 v1.3 co-equality, encoded

The running Globe ships with `FULL / NeX / Ne0N / Ne0` as four camera framings — practical for the toggleable PoC, but it makes `FULL` *feel* like a union-parent. v1.3 ontology says it is not: `FULL` is a *view*, not a parent.

This binding mechanic encodes co-equality two ways:

1. **The Globe's data model exposes three sets, not four.** `surfaceNodes` (Ne0) · `orbitalNodes` (NeX) · `axisNodes` (Ne0N). `FULL` is a camera framing that renders the union of these three sets. There is no fourth set called "FULL nodes." Sirius must not write one.
2. **Attractor membership is declared on entries, not on strata.** A `coffee` entry is in the coffee attractor whether it lives on the surface (photo of a brew bar) or in orbit (article on extraction). The attractor highlight crosses strata — when an attractor is active, every member glyph highlights regardless of which stratum it lives on. This is the visual consequence of strata co-equality: the attractor reads the body, not a layer.

The implication for §2's contracts: when attractor `coffee` is picked while stratum is `Ne0`, the Globe still highlights coffee-membership in the orbital layer too — the orbital layer's nodes just render dimmer than the surface as a general visual hierarchy (per ontology §7.3 zoom behavior), so attractor highlights on orbital nodes appear as a quieter recognition. The body is one body; the attractor's field reaches across it.

### 1.3a (v1.1) retiring the toggleable framings — what changes in the binding

The current `WorldlineGlobe.tsx` ships four `STRATA` camera framings (`all` / `nex` / `neon` / `neo`) that **toggle visibility of base layers** (`nexField`, `axisGroup`, `contoursGroup`, `arcLine` show/hide per framing). This is incompatible with v1.3 ontology §1.1 + §10.1 — strata are spatial layers of one body, not navigation modes.

Per Peat 2026-05-15 ("ทำ 1.3 STRATA"), the binding mechanic targets the v1.3 renderer, not the legacy PoC. The renderer is rebuilt by a separate Sirius TASK (TASK-16 or its successor); this binding spec describes the **target state shape** that renderer will expose.

**What this binding assumes about the v1.3 renderer:**

1. **All three strata always render.** `surfaceGroup`, `orbitGroup`, `axisGroup` are mounted at scene init and stay mounted. There is no `stratum` variable that hides any group. The body always shows surface pins + orbital nodes + the Ne0N axis line through it.
2. **The left-rail mechanic is recommended to be `cameraFocus`**, a camera-aid that NEVER hides strata. Values: `'surface' | 'orbit' | 'axis' | 'rest'`. Each value moves the camera (900ms easeInOutCubic; reduced-motion = instant) to frame one stratum more prominently in the viewport. **None changes visibility.** Keyboard shortcuts `1` / `2` / `3` / `0` map to surface / orbit / axis / rest, preserving muscle memory from the legacy stratum buttons. (Alternative: remove the left rail entirely — logged as open question to Peat in §11.)
3. **The earth-textured base, the orbital-network feel, and the Ne0N-revealing transparency** (Peat's three locked directions — see §1.6) are baseline visual properties of the v1.3 renderer. The binding rides on top of them.

**Effect on §2's contracts.** Wherever §2.1 says "stratum filters the layer," substitute "the visitor's `cameraFocus` adjusts which stratum is foregrounded in the viewport — but the binding's highlight rules apply uniformly across all three strata always." A member of the active attractor on the back-of-orbit highlights with the same halo + edge treatment as a member on the front-of-surface; occlusion (per ontology §11.6) governs interactivity, not visibility.

**Effect on §4's state machine.** The `stratum` axis is replaced by a `cameraFocus` axis with the same four enum values but radically different semantics (camera-aid only; no visibility toggle). The matrix in §4.2 is rewritten in §4.2a (v1.1).

### 1.4 the rejected "DivergenceMeter responds to attractor" temptation

Three readings of "what does the meter do when attractor X is picked" were considered:

- **(a) lock** — meter shows a stable indicator when the visitor is "deep in one attractor"
- **(b) drift** — meter spins/flickers more when the visitor is across multiple attractors
- **(c) static** — meter reads the same `α 1.130426` regardless of attractor

**Decision · (c) static for v1.** Rationale:

The meter reads the worldline's locus, not the visitor's query. The visitor's query is *about* the worldline; it does not *change* the worldline. If the meter were to react to attractor selection, it would conflate two semantic axes (observer locus vs. query) and the Steins;Gate framing would break — α is the divergence of the archive from its alpha-line, not the divergence of one filter pass from another.

The meter retains its existing motion vocabulary: idle Nixie flicker (3–7s cadence), worldline drift loop (14–22s cadence, OBSERVED → DRIFT label). Those motions exist independent of attractor state.

**Future extension (logged, not specced).** If the body grows large enough that attractors become meaningfully different *cosmological regions* (not just thematic tags), a later iteration might introduce a `local α` reading per attractor — but this is out of scope until the corpus warrants it. Until then, the meter is static under attractor selection.

### 1.5 the "orbital network feel" Peat asked for

From the 2026-05-15 feedback handoff:

> *PoC's Globe orbital has a network quality (lines connecting nodes, web of relationships) that Peat finds more truthful to the observatory metaphor. Your adopted approach reads as more "points-on-globe" without the network connective tissue.*

The binding mechanic is the natural place this feel arrives. When the visitor picks attractor `coffee`, three coffee-tagged entries highlight (say `001` four-pours adaptation on the surface near Yirgacheffe · ET, and one article in orbit on extraction theory). The binding renders **edges between these three nodes** — visible great-circle arcs and surface-to-orbit splines that say *these belong to one field together*. The network *is* the attractor's geometry. Without it the attractor is a tag; with it the attractor is a constellation.

This is also where ontology §4.3 worldline-mechanics edges (`diverged_from`, `merged_with`, `adjacent`, `collapsed_into`) intersect: those edges are content-authored lineage between specific entries. Attractor edges are *derived* — they are the visual recognition that nodes share an attractor. v1 keeps them distinct:

- **lineage edges** (per ontology §4.3) ship later via velite frontmatter `edges:` field. Out of scope for this TASK.
- **attractor edges** ship in this TASK. Computed at render time from attractor membership. Visual treatment specified in §3.

### 1.6 (v1.1) Peat's three locked direction shifts — where each is applied

Peat's 2026-05-15 FEEDBACK locked three direction shifts that the binding must honor. Marked here so the anti-Codex audit (§8) can verify line-by-line.

| Peat direction (locked) | Applied in | Rationale |
|---|---|---|
| **earth-textured base** (real continents visible; coordinate-space is geographic) | §2.1 step 1 ("Base layer stays") · §6.2 (mini-globe simplified continent paths) · §1.3a item 3 | The body must read as geographic; coordinate placement is meaningful in real space. The v1.3 renderer extends the current PoC's `earth_specular_2048.jpg` soft-multiply (Globe v7.html line 537–550) into a paper-tinted continents treatment. Surface pins anchor to real GPS locations on those continents. |
| **orbital network feel** (lines connecting nodes; relationships visible as edges) | §1.5 · §2.1 step 4 (the edge pass) · §3.2 (attractor edge styles) · §3.4 (density cap) | The binding's signature visual: when an attractor is active, the orbital + surface members of that field are connected by visible great-circle splines and surface-to-orbit lifts. This is the network feel Peat asked for, delivered as the binding's primary output — not as a static base-layer decoration that would compete with the body itself. |
| **transparency revealing Ne0N axis** (visitor sees through the body to the inner axis) | §1.3a item 1 (the v1.3 renderer baseline) · §2.1 step 1 ("body transparency modulates when attractor active") · §3.6 (new sub-rule below) | The body material is partially transparent — the visitor sees the Ne0N axis line as a faint vertical line behind the continents. When an attractor activates, the body becomes *more* transparent (0.55 → 0.35 opacity on the front-facing surface, 600ms ease) to let the highlighted network and the axis show stronger. Peat called this transparency "genuinely beautiful" — the binding amplifies it. |

These three are not decoration on top of the binding; they are the visual grammar the binding speaks. The implementer (Sirius) must treat them as baseline, not optional polish.

**§3.6 body-transparency modulation (new).** When `activeAttractor !== "all"`:
- Body material opacity drops from baseline (~0.55) to active-attractor value (~0.35) over 600ms ease-in-out.
- This is a binding-driven visual: the body steps back slightly so the highlighted network is foregrounded.
- Reverts to baseline 0.55 over 600ms when attractor returns to `"all"` or is cleared.
- Reduced-motion: instant value swap, no tween.

---

## 2 · binding contracts — the three pair-wise interactions

Three pairs. Each pair has a contract: what state flows from where to where, what the receiver does with it, what the visual outcome is.

### 2.1 AttractorFields ↔ Globe

**Direction.** State flows from AttractorFields → Globe. (Not the reverse — the visitor does not pick attractors by clicking on the Globe in v1. That's a possible v2 reverse-binding; see §7 future extensions.)

**Trigger.** User clicks an attractor pill in `AttractorFields.tsx` (or activates via keyboard — Tab + Enter on a focused pill).

**State emitted.** `activeAttractor: string` — one of the enum values from `ATTRACTOR_FIELDS` (`"all" | "coffee" | "ai · ml" | "narrative" | "cubic copper" | "harness eng." | "fragrance" | "film · letterboxd" | "trading" | "japan / 日本" | "meta"`).

**What the Globe does when it receives a non-`"all"` attractor:**

1. **Base layer stays.** Earth-textured paper sphere, contour lines, observer axis (when stratum allows), and the active stratum's camera framing are all unchanged. The Globe is the body; the body does not transform because the visitor asked a question.

2. **Membership lookup.** The Globe queries `getEntriesForAttractor(activeAttractor)` (see §7 implementation handoff) → returns `Entry[]` filtered to those whose tag set, domain, or derived attractor-membership matches the active attractor.

3. **Highlight pass.** For each Globe node (surface pin, orbital node, axis node), apply:
   - **in-membership** (entry is in the active attractor): glyph renders at full opacity (1.0), full saturation, with a thin `var(--accent-orange)` halo (1.5px ring, 0.6 opacity) drawn at glyph radius + 0.004 (Three.js world units). This is the field-strength indicator at the per-node level.
   - **out-of-membership** (entry is not in the active attractor): glyph dims to 0.32 opacity, color desaturates toward `var(--ink-faint)`. Hit-sphere stays at full size — out-of-membership nodes remain clickable; they are not removed, only quieted. Removing them would break the "the body is the body" rule from §1.5.

4. **Edge pass — the network feel.** For every pair `(a, b)` where both `a` and `b` are in-membership, draw an edge. Edge geometry:
   - **surface ↔ surface** (both on Ne0): great-circle arc on the sphere surface at radius `1.001` (just above the surface), 96-segment curve, 0.5px stroke (in screen pixels — Sirius computes Three.js line width to match), `var(--accent-orange)` at 0.45 opacity.
   - **surface ↔ orbit** (one on Ne0, one in NeX): spline from surface point to orbital position. Bezier with control point at `surfacePos.normalize().multiplyScalar(R × 1.08)` (lifts the curve gently off the surface before it reaches the orbital shell). Same color and opacity as surface↔surface.
   - **orbit ↔ orbit** (both in NeX): great-circle arc at orbital radius `R × 1.18`, same color, same opacity.
   - **axis nodes are excluded from attractor edges.** α / 012 / 047 are positions, not memberships. They have no attractor (per ontology §5 they are observer loci). Even if a visitor picks an attractor, the axis nodes do not highlight or connect.

5. **NETRA voice update.** The bottom voice strip ages its line:
   > `// netra · field ‹attractor› · ‹N› traces clustered · ‹E› edges drawn.`

   Where `‹N›` is the in-membership count and `‹E›` is the edge count (`N * (N-1) / 2` capped at `45` — see §3.3 edge density rule). Voice is `aria-live="polite"` (already wired in `WorldlineGlobe.tsx`).

**What the Globe does when it receives `"all"`:**

Everything reverts. All glyphs return to full opacity. All attractor edges disappear (220ms fade-out). NETRA voice returns to the stratum's default voice line. No camera move.

**Reverse direction (Globe → AttractorFields).** When the visitor clicks an in-Globe pin, AttractorFields does **not** auto-pick the pin's attractor. Clicking a pin opens the side panel preview (existing behavior) and that's the only side effect. Why: the visitor clicked a specific entry, not a query. Picking the entry's attractor on their behalf would be presumptive. The attractor pills remain at whatever the visitor last set.

### 2.2 AttractorFields ↔ DivergenceMeter

**Direction.** None in v1.

**Contract.** The meter is invariant under attractor selection. Per §1.4, the meter reads the observer, not the visitor's query. When the visitor picks `coffee` and the Globe highlights three coffee nodes and draws three edges between them, the meter still reads `1.130426` with its idle Nixie flicker and 14–22s drift loop running on its own clock.

**Why this is a contract and not an omission.** It would have been trivial to wire AttractorFields → DivergenceMeter (the existing zustand store proposed in §7 already carries `activeAttractor`). The choice to *not* wire it is the design — the meter's stillness under the visitor's filtering is the assurance that **the worldline is independent of the visitor's gaze**. Otherwise, the meter becomes a query-response indicator and the Steins;Gate framing collapses.

**Implementation note for Sirius.** Do not subscribe `DivergenceMeter` to `activeAttractor`. The selector list for the meter component is exactly:
```ts
useGlobeStore(s => s.alpha) // = "1.130426" in v1
```
Nothing else.

**Future extension logged.** §1.4's "local α per attractor" idea is the natural place this binding *could* grow, but it requires the corpus to warrant it. Not in v1.

### 2.3 Globe ↔ DivergenceMeter

**Direction.** None in v1. The two read the same `alpha` value from the same source but neither writes to the other.

**Contract.** The meter is the symbolic readout of α; the Globe (via the axis stratum, ontology §5) is the spatial readout of the same value. They are two viewports onto one truth.

**What about Globe rotation?** When the visitor drags the globe to inspect another locus (per `WorldlineGlobe.tsx` `onMoveDrag` in `all` or `nex` strata), the meter does **not** change. The visitor's vantage rotates; the worldline does not. This is the same rule that governs §2.2: the observer is not the query.

The NETRA console DOES update its RETICLE coord readout during rotation (existing behavior — `formatNetraCoord` at line 1021 of `WorldlineGlobe.tsx`). That readout is the camera's local frame, not the worldline α. Two different numbers, two different semantics, both already correct in the PoC.

**Click on α node (when axis stratum eventually renders α as a clickable on the axis per ontology §5.4).** Per ontology, clicking α centers the camera on the observer locus and does not navigate. The meter does not flicker or pulse in response. The α click is camera-only.

**Visual reinforcement.** The compact DivergenceMeter (HeroBlock variant) and the eventual α-axis-node both render in `var(--accent-orange)` for the unstable digit block. This is intentional repetition — same color says *same value*. The implementer must not give them different accent colors.

---

## 3 · surface vocabulary additions

Three new visual atoms enter the system with this binding. All three reuse existing tokens.

### 3.1 the field-strength indicator (per-node halo)

When an attractor is active and a node is in-membership, the node renders with a halo ring at glyph radius + 0.004 (Three.js world units, scales with camera).

- **stroke** · `var(--accent-orange)` translated to Three.js color `0xd4602a`
- **stroke width** · 0.6 (Three.js line; renders ~1.5px at default zoom)
- **opacity** · 0.6
- **shape** · circle (matches the current pin glyph topology — when photo squares ship per ontology §2.2, the halo also becomes a square outline of equal proportion; when fiction rings/diamonds ship, the halo follows the glyph silhouette)
- **animation** · static. No pulse. No rotation. The halo is recognition, not theater.

The halo exists only when an attractor is active. With `activeAttractor === "all"` there are no halos.

### 3.2 attractor edge styles

Per §2.1 step 4, three edge subtypes (surface↔surface, surface↔orbit, orbit↔orbit) all share one visual treatment in v1:

- **color** · `var(--accent-orange)` translated to `0xd4602a`
- **opacity** · 0.45
- **stroke** · 0.5px screen-pixel equivalent (Sirius computes Three.js line width to match)
- **dashing** · **solid** in v1. (Lineage edges from ontology §4.3 will use dashed/dotted later; keeping attractor edges solid avoids vocabulary collision.)
- **curve** · great-circle arc at the appropriate radius, 96 segments. Surface↔orbit uses one bezier control point as specified above.

**Why one treatment for three subtypes?** Visual unity. The visitor reads "these belong to one field" in a glance — three different stroke treatments would invite the visitor to parse stratum-edge semantics they have not been taught yet. The geometric difference (surface arc vs lifted spline vs orbital arc) is sufficient signal. When ontology §4.3 lineage edges arrive, they will use *dashed* and *dotted* per the ontology table — so v1 attractor-edges-as-solid leaves dashed/dotted free for that future vocabulary.

### 3.3 dim states for out-of-attractor nodes

When an attractor is active, out-of-membership nodes:

- **opacity** · 0.32 (the in-membership default is 1.0)
- **color** · desaturates by lerping current node color toward `var(--ink-faint)` at 0.6 weight. Implementer note: for Three.js this is `nodeColor.lerp(inkFaintColor, 0.6)` on a clone of the original material color, applied to a cloned material so the original is not mutated.
- **hit sphere** · unchanged. Click still works. Hover preview still works. Dimming is purely visual.
- **halo** · absent (only in-membership has halo).

The transition between in-membership state and dim state runs **220ms** with `easeInOutCubic` (the same easing used in `WorldlineGlobe.tsx` line 84 `easeInOutCubic` helper). Cross-fade — opacity and color tween simultaneously.

### 3.4 edge density rule — capping the network

`N` in-membership nodes implies `N * (N-1) / 2` possible pairwise edges. For `N = 11` that is 55 edges; for `N = 20` that is 190. Both are too many to read.

**Cap at 45 edges.** When the pair count exceeds 45, the binding selects which edges to draw using two rules in order:

1. **Prefer edges between nodes on different strata.** Surface↔orbit edges read as the strongest signal of "this field crosses the body's layers" — exactly the network feel Peat asked for. Draw all available surface↔orbit edges first.
2. **Then prefer shorter edges within a stratum.** Sort by great-circle distance ascending. Draw shortest first. Stop at the cap.

In practice the corpus is small enough (eight published entries in `RECENT_ENTRIES` as of v1) that the cap will not engage. The rule is for when the body grows.

### 3.5 what is NOT added

- No new tokens. The halo, edges, and dim state all use `var(--accent-orange)`, `var(--ink-faint)`, and existing Three.js color constants already in `WorldlineGlobe.tsx`.
- No new fonts.
- No new UI chrome on the AttractorFields component itself (the pills already render correctly — they just need to emit state).
- No counter row above the HeroBlock. Per Peat 2026-05-15: the `012 ACTIVE | 047 OBSERVATION` row is cut in v1. `WorldlineGlobe.tsx` lines 1160–1164 (the `atlas-readout-row is-trio` with `SURVEYED 047 / ACTIVE 012 / BRANCHES ∞`) inside the Globe readout aside remains — that is *inside* the Globe instrument, not in the HeroBlock area, and it stays. The cut targets only the HeroBlock-level counter row in `HeroBlock.tsx` (Sirius removes that block; Betelgeuse does not touch component code, but the spec explicitly excludes it from v1).

---

## 4 · state machine — every combination

The Globe's render is a pure function of four pieces of state. The matrix below enumerates them.

### 4.1 the four state variables

> **v1.1 note.** The first row below is rewritten in §4.1a — `stratum` is replaced by `cameraFocus` per §1.3a. The v1 row is preserved here so readers can see the migration path; implementers building against the v1.3 renderer follow §4.1a.

| variable | values | source of truth |
|---|---|---|
| `stratum` *(v1 — legacy; superseded by `cameraFocus` in §4.1a)* | `"all" \| "nex" \| "neon" \| "neo"` (the toggleable camera framings as shipped; `all` corresponds to the v1.3 `FULL` view) | `useGlobeStore.stratum` (currently `useState` in `WorldlineGlobe.tsx`; Sirius migrates) |
| `activeAttractor` | one of `ATTRACTOR_FIELDS` (`"all"`, `"coffee"`, …) | `useGlobeStore.activeAttractor` |
| `selectedId` | `string \| null` — the file number of a clicked pin | `useGlobeStore.selectedId` |
| `hover` | `{ kind: "node" \| "edge" \| null, target: id \| pair }` | local component state (does not need to persist across mounts) |

`rotated` is *not* a state variable — Globe rotation is continuous user input and does not feed into the binding render. It only changes the camera transform.

### 4.1a (v1.1) the four state variables — v1.3 renderer target

Per §1.3a, the v1.3 renderer retires the toggleable framings and exposes a `cameraFocus` pointer instead. The state shape is otherwise identical:

| variable | values | semantics | source of truth |
|---|---|---|---|
| `cameraFocus` | `"rest" \| "surface" \| "orbit" \| "axis"` | camera-aid only · NEVER hides any stratum group. Each value selects a camera framing that foregrounds one stratum; all three strata remain rendered at all values. `rest` = default observation framing (the body fits comfortably with all three layers legible). | `useGlobeStore.cameraFocus` |
| `activeAttractor` | one of `ATTRACTOR_FIELDS` (`"all"`, `"coffee"`, …) | unchanged from §4.1 | `useGlobeStore.activeAttractor` |
| `selectedId` | `string \| null` — the file number of a clicked pin | unchanged from §4.1 | `useGlobeStore.selectedId` |
| `hover` | `{ kind: "node" \| "edge" \| null, target: id \| pair }` | unchanged from §4.1 | local component state |

**Keyboard mapping** (preserves muscle memory from the legacy stratum buttons): `1` → `cameraFocus: "surface"`; `2` → `cameraFocus: "axis"`; `3` → `cameraFocus: "orbit"`; `0` → `cameraFocus: "rest"`; `Escape` → first clears `selectedId`, then resets to `cameraFocus: "rest"` if no selection.

### 4.2 the full matrix

For brevity, the table below enumerates `stratum × activeAttractor` × `hover`. `selectedId` overlays the side-panel preview regardless of the other axes (existing PoC behavior preserved). The dim/halo/edge layer composes underneath the side panel.

Legend:
- **B** = base layer (earth sphere, contours, ink graticule) — always rendered
- **A** = axis (Ne0N) line + observer nodes — rendered when stratum allows axis (`all`, `nex`, `neon`)
- **C** = contours — rendered when stratum allows contours (`all`, `neo`)
- **F** = NeX field shells + rays — rendered when stratum allows field (`all`, `nex`)
- **Pn** = surface pin set with halo+edge treatment (`P-all` = no halo no edges; `P-active` = halo on members + dim on non-members; in-edges drawn)
- **Pc** = camera framing applied (per `STRATA[stratum]`)
- **V** = NETRA voice line (stratum-default unless overridden)

| stratum | activeAttractor | hover | render |
|---|---|---|---|
| `all` | `all` | none | B + A + C + F + P-all + Pc(all) + V("standing by, ne0ex aggregate in view…") |
| `all` | `coffee` | none | B + A + C + F + P-active(coffee) + edges(coffee) + Pc(all) + V("netra · field coffee · 3 traces clustered · 3 edges drawn.") |
| `all` | `coffee` | node `001` | as above, plus `001` halo brightens to opacity 0.85 (from 0.6), preview tooltip anchored at cursor |
| `all` | `coffee` | edge `(001, 003)` | as above, plus the hovered edge opacity rises to 0.75, voice updates: V("netra · edge · 001 ↔ 003 · same field.") |
| `nex` | `all` | none | B + A + F + Pc(nex) + V("possibility shells, 247 rays emitting outward…") · pins de-emphasized at nex per existing PoC |
| `nex` | `coffee` | none | B + A + F + P-active(coffee) — but only orbital members visible at this framing; surface pins are de-emphasized per existing PoC, so coffee surface members render at the dim baseline. Orbital members halo + connect with edges. V("netra · field coffee · 1 orbital trace · 0 edges drawn within orbit.") |
| `neon` | `all` | none | B + A + Pc(neon) + V("polar bearer · viewed from the axis…") — no surface pins at this framing |
| `neon` | `coffee` | none | as above — attractor highlights are not visible at neon framing because the surface and orbital layers are hidden by camera framing. **The attractor selection persists in state**; switching back to `all` or `neo` immediately re-renders the highlights. V stays at the stratum default — the visitor's attractor query is acknowledged but the current stratum has no visible members to show. (Future extension: a small overlay readout `[ coffee active · switch to Ne0 to see ]` could surface this. Out of v1.) |
| `neo` | `all` | none | B + C + P-all + Pc(neo) + V("surface archive · 047 patches anchored…") |
| `neo` | `coffee` | none | B + C + P-active(coffee) + edges(coffee, surface only) + Pc(neo) + V("netra · field coffee · 3 surface traces · 3 edges drawn.") |
| `neo` | `coffee` | node `001` | as above + `001` halo brightens + preview tooltip |

### 4.2a (v1.1) the v1.3 renderer matrix — `cameraFocus` × `activeAttractor`

Under the v1.3 renderer, all three strata always render. The matrix collapses dramatically because no stratum hides anything — the only thing that changes between `cameraFocus` values is the camera framing. The attractor highlight rules apply uniformly across all rows.

Legend (v1.3):
- **B** = base layer (earth sphere, contours, ink graticule) — always rendered
- **S** = surface pin set (always rendered; halo + dim per attractor)
- **O** = orbital node set (always rendered; halo + dim per attractor)
- **A** = axis (Ne0N line + α / 012 / 047 observer nodes) — always rendered; axis nodes are excluded from attractor highlights per §2.1 step 4
- **E(X)** = attractor edges for active attractor X, drawn across whichever strata members occupy
- **Cf** = camera framing per `cameraFocus`
- **V** = NETRA voice line per `(cameraFocus, activeAttractor)`

| cameraFocus | activeAttractor | hover | render |
|---|---|---|---|
| `rest` | `all` | none | B + S + O + A + Cf(rest) + V("standing by · three strata co-present · ‹47› surveyed · ‹n› in orbit · α 1.130426 on axis.") |
| `rest` | `coffee` | none | B + S(coffee-active) + O(coffee-active) + A + E(coffee) + Cf(rest) + V("netra · field coffee · ‹N› traces clustered · ‹E› edges drawn across surface and orbit.") |
| `surface` | `all` | none | B + S + O(dimmed for prominence — surface leads per §1.6 transparency rule) + A(thinned per ontology §7.3) + Cf(surface) + V("surface foregrounded · ‹47› patches anchored · orbit and axis hold position behind.") |
| `surface` | `coffee` | none | as above with S(coffee-active) + O(coffee-active, dimmer base) + E(coffee) + V("netra · field coffee · ‹N_s› on surface · ‹N_o› in orbit · ‹E› edges drawn.") |
| `orbit` | `all` | none | B + O + S(thinned) + A + Cf(orbit) + V("orbit foregrounded · ‹N› orbital nodes in view · surface holds position below.") |
| `orbit` | `coffee` | none | B + O(coffee-active) + S(coffee-active, dimmer base) + A + E(coffee) + Cf(orbit) + V("netra · field coffee · ‹N_o› in orbit · ‹N_s› on surface · ‹E› edges drawn.") |
| `axis` | `all` | none | B + A(prominent) + S(thinned) + O(thinned) + Cf(axis) + V("axis foregrounded · α at equator · observer reading positions 012 / 047 visible.") |
| `axis` | `coffee` | none | as above; attractor highlights still render on surface and orbital members (visible behind the axis prominence). E(coffee) renders. V("netra · field coffee · ‹N› traces clustered across the body · α invariant on axis.") |
| any | any | node `X` | as the row above, plus `X` halo brightens to opacity 0.85 + preview tooltip anchored at cursor + V augments with the node's label |
| any | any | edge `(a, b)` | as the base row, plus the hovered edge opacity rises to 0.75 + V("netra · edge · ‹a› ↔ ‹b› · same field.") |

**Empty-state behavior under v1.3.** Because no stratum hides anything, the "0 members at neon framing" failure mode from §4.2's legacy matrix does not exist under v1.3. An attractor with 0 members renders 0 highlights across all strata; the voice acknowledges per §4.5 unchanged.

**Note on `selectedId` overlay.** Identical to §4.2 — the side-panel preview composes on top of all rows; the dim/halo/edge layer continues to render underneath. Pause-during-reading rule from §7.4 applies.

### 4.3 transitions — what animates when

| from state | to state | duration | easing | what tweens |
|---|---|---|---|---|
| `activeAttractor: all` | `activeAttractor: X` | 220ms | `easeInOutCubic` | non-member nodes fade to dim; member halos fade in; edges fade in (with 30ms stagger per edge, capped at total 500ms) |
| `activeAttractor: X` | `activeAttractor: all` | 220ms | `easeInOutCubic` | reverse — halos and edges fade out; dim nodes return to opacity 1.0; voice line returns to stratum default |
| `activeAttractor: X` | `activeAttractor: Y` | 220ms total | `easeInOutCubic` | cross-fade · membership recomputes mid-tween; nodes that change membership status fade across; edges from X fade out while edges to Y fade in (no stagger to avoid feeling laggy on attractor-switching) |
| `stratum: A` | `stratum: B` *(legacy renderer; superseded by next row)* | 1400ms (existing PoC value) | `easeInOutCubic` (existing PoC) | camera position + look + base layer visibility per `STRATA[B]`. Attractor highlights persist *as state* but rerender at the new camera (no separate tween — the camera tween IS the visual change). |
| `cameraFocus: A` | `cameraFocus: B` *(v1.3 renderer · canonical)* | 900ms | `easeInOutCubic` | camera position + lookAt tween to the new focus framing. **No visibility changes** — all three strata remain rendered throughout. Attractor highlights persist and rerender at the new camera angle. Reduced-motion: instant cut. |
| `selectedId: null` | `selectedId: <id>` | 1100ms camera + 520ms panel slide + 320ms panel opacity (existing PoC values) | existing PoC | unchanged. Attractor highlights underneath persist. |
| `hover: null` | `hover: node/edge` | 120ms | `easeOut` | hover-specific halo opacity bump (0.6 → 0.85 for nodes; 0.45 → 0.75 for edges) + cursor change + preview tooltip slide+fade-in |

### 4.4 reduced motion

When `prefers-reduced-motion: reduce`:

- All 220ms attractor transitions collapse to 0ms instant cuts (membership state changes are still applied; the visual just snaps).
- Edge stagger eliminated — all edges appear/disappear together at frame 0.
- Hover halo bump halved to 60ms or eliminated entirely (Sirius's call during implementation; the visual change is small enough that instant is acceptable).
- Existing PoC reduced-motion rules from `DivergenceMeter.tsx` (lines 44–50) and the Globe's camera tweens (which Sirius must add — currently the PoC does not honor reduced-motion on the 1400ms camera moves per the journey-arch §2.5 note) take precedence in their own scopes.

### 4.5 empty states

| condition | what renders | voice |
|---|---|---|
| `activeAttractor: X` with 0 members at any stratum | all nodes render at the dim baseline (0.32 opacity); no halos; no edges | V("netra · field ‹attractor› · no traces surveyed at this stratum. switch strata, or pick a different field.") |
| `activeAttractor: X` with 1 member | the member highlights with halo; no edges (a single node has no pairs); voice acknowledges the count | V("netra · field ‹attractor› · 1 trace · isolated.") |

A single isolated highlight is informative — it tells the visitor *this attractor exists in this layer, but it has no companions here yet*. The body remains honest about its sparseness.

---

## 5 · motion calibration · anti-Codex 6-point compliant

Per `betelgeuse.md` quality-bar rule 6: 100–150ms hover · 200–300ms selected state · 300–500ms overlays · 700–1400ms ATLAS camera moves · no looping decorative motion · no motion during reading.

| event | duration | bucket | compliance |
|---|---|---|---|
| attractor pick (overlay state change · halos/dim/edges fade-in) | 220ms | 200–300ms selected state | ✓ pass |
| attractor switch X → Y (cross-fade) | 220ms total | 200–300ms selected state | ✓ pass |
| edge stagger across all edges | 30ms per edge · capped at 500ms total | 300–500ms overlay | ✓ pass |
| stratum switch (existing PoC) | 1400ms | 700–1400ms ATLAS camera | ✓ pass (already shipped) |
| hover halo bump (node or edge) | 120ms | 100–150ms hover | ✓ pass |
| pin select (camera + panel · existing PoC) | 1100ms cam · 520ms panel slide · 320ms opacity | 700–1400ms ATLAS + 300–500ms overlay | ✓ pass (already shipped) |
| reduced-motion attractor pick | 0ms | n/a | ✓ pass (instant cut) |
| DivergenceMeter idle Nixie flicker (existing) | per-digit 150ms · 3–7s cadence | decorative loop | ⚠ pre-existing — DivergenceMeter has decorative loops; out of this TASK's scope to revisit, but flagged. Note: the loop is *meter-internal*, not on the body of the page, and the meter's role is precisely to feel like an instrument reading itself, so the loop is defensible. Logged for Algol's QA review. |
| DivergenceMeter worldline drift (existing) | ~700ms ramp + 1100ms hold | decorative loop on 14–22s cadence | ⚠ pre-existing — same note as above |

**Motion during reading.** When the side panel is open (`selectedId !== null`), attractor highlights and edges remain rendered, but **all attractor transitions are paused**. If the visitor changes `activeAttractor` while the side panel is open, the change is queued and applied on side panel close. Rationale: the visitor is reading; motion across the body would pull their eye away. The pause is enforced in the binding hook's transition queue (see §7.4).

**No looping decorative motion in the binding layer.** The halo is static. The edges are static. The dim state is static. The only motion in the binding layer is the 220ms entrance/exit fade and the 120ms hover bump. The pre-existing decorative loops (Nixie meter, contour breathing per `WorldlineGlobe.tsx` line 988, pole pulse, alpha ring pulse, arc dash march) are all outside the binding mechanic — they continue to run on their own clocks.

---

## 6 · mobile collapse

Per journey-arch §7 and the mobile-prototype delegation rule (Peat 2026-05-15 — Betelgeuse decides after prototype validation; this doc gives the best-defensible spec ahead of that prototype).

### 6.1 breakpoint behavior

| breakpoint | AttractorFields placement | Globe binding visible? | edges drawn? |
|---|---|---|---|
| ≥1024px (lg+) | below ChapterIndex (current PoC placement preserved) | yes — full A.T.L.A.S. frame above; attractor selection highlights pins on the live Globe | yes — full edge set per §3 |
| 881–1023px | horizontal scrollable pill row directly *above* the Globe (so the visitor sees pills + their effect on the Globe in one fold-area) | yes — Globe compacts per journey-arch §7.1 but stays rendered | yes — full edge set |
| 600–880px | horizontal scrollable pill row above the ATLAS · STANDBY placeholder card | mini-globe variant only (per journey-arch §7.2 the Globe is replaced by a 280px-tall placeholder). The placeholder card grows a small SVG mini-globe (see §6.2) showing pin distribution and highlighted attractor membership | yes, **on the SVG mini-globe**, not on Three.js (Three.js is not loaded at this breakpoint) |
| 375–599px | same as 600–880px but `px-4` instead of `px-7` padding; mini-globe shrinks to 180px tall | mini-globe SVG variant | yes on SVG |

The attractor selection ALSO filters the `ChapterIndex` list below — the list shows only members of the active attractor on mobile (because the list IS the primary surface there, per journey-arch §5.1). This list-filter behavior is symmetric: it also applies on desktop (the list below the Globe filters when an attractor is active). Sirius wires this in `ChapterIndex.tsx` to read the same `useGlobeStore.activeAttractor` selector.

### 6.2 the mobile mini-globe (replacement at ≤880px)

When the Three.js Globe is not loaded, the binding renders on an SVG mini-globe inside the placeholder card. Spec:

- **size** · 180–280px tall depending on breakpoint
- **projection** · orthographic SVG (same projection family as the search overlay's mini-globe per journey-arch §8.2 — consistent vocabulary)
- **base** · paper-tone disc with faint graticule (`var(--ink-faint)` 0.4 opacity, dashed)
- **earth silhouette** · simplified continent paths (TopoJSON · world-110m or similar at coarse simplification), `var(--ink-soft)` fill, 0.3 opacity — preserves the "real earth, not abstract sphere" Peat asked for, at SVG scale
- **pins** · all surface pins from `RECENT_ENTRIES` rendered as 4px circles at projected lat/lon
- **halo + dim treatment** · same as Three.js per §3 — `var(--accent-orange)` halo at radius +1.5 for members, opacity 0.32 for non-members
- **edges** · SVG `<path>` quadratic curves between projected pin positions, same color/opacity rules as §3
- **no interactivity** · the mini-globe is a *map*, not an instrument. Tapping it does nothing (the visitor uses the pills above and the list below). The `[ OPEN ATLAS ↗ ]` button still routes to the dedicated `/atlas` route per journey-arch §7.3 where the full Three.js Globe is loaded.

### 6.3 attractor pill row — mobile-specific UI considerations

The pill row at mobile breakpoints needs:

- horizontal scroll with momentum (CSS `overflow-x: auto; scroll-snap-type: x mandatory`)
- each pill snaps to scroll position (`scroll-snap-align: start`)
- minimum 44×44px touch target per existing PoC convention and journey-arch §7.5
- active pill highlights with `var(--ink-primary)` background per existing `AttractorFields.tsx` styling — preserved as-is
- a fade gradient at the right edge (`var(--paper-base)` → transparent over 24px) to signal more pills off-screen

### 6.4 reduced-motion on mobile

Same rules as §4.4. The SVG mini-globe transitions also collapse to 0ms under reduced motion.

---

## 7 · implementation handoff · for Sirius

This section is what Sirius reads to build. Everything before this is the cosmology and the visual contract.

### 7.1 component touch list

> **v1.1 note.** Under the v1.3 renderer target (per §1.3a), `WorldlineGlobe.tsx` is **rebuilt** by a separate Sirius TASK (TASK-16 or its successor) that retires the toggleable framings. The binding mechanic's "major" touch below targets that rebuilt v1.3 renderer, not the current legacy PoC. The migration sequence per ontology §10.4: (1) Sirius rebuilds the Globe to v1.3 (co-present strata, `cameraFocus` state shape, earth-textured base, axis transparency) under a feature flag; (2) the binding mechanic from this doc ships in the same PR; (3) the legacy strata-toggle UI retires in that same PR — never as a half-state.

| component | touch | scope of change |
|---|---|---|
| `components/WorldlineGlobe.tsx` | **major (v1.3 rebuild)** | (a) replace `stratum` state with `cameraFocus` per §7.2a; (b) mount surface/orbit/axis groups always (no hide/show); (c) earth-textured paper base with axis-revealing transparency per §1.6; (d) subscribe to `useGlobeStore.activeAttractor`; (e) implement membership lookup + halo/dim/edge passes; (f) drive 220ms attractor transitions + 900ms camera-focus transitions via existing `easeInOutCubic`; (g) honor reduced-motion; (h) pause attractor transitions when `selectedId !== null` |
| `components/AttractorFields.tsx` | **moderate** | (a) replace local `useState` with `useGlobeStore.setActiveAttractor`; (b) read `activeAttractor` from store for active styling; (c) add keyboard support if not present (Tab + Enter on each pill); (d) at mobile breakpoints, render with horizontal scroll + snap |
| `components/ChapterIndex.tsx` | **moderate** | (a) read `useGlobeStore.activeAttractor`; (b) filter the entry list to members when attractor is not `"all"`; (c) show a small banner row when filter is active: `// filtered to ‹attractor› · ‹N› entries · ✕ clear` |
| `components/DivergenceMeter.tsx` | **none** | per §2.2 contract — do not subscribe to attractor state |
| `lib/store/globe.ts` *(new file)* | **new** | zustand store with state shape per §7.2 |
| `lib/binding/attractor.ts` *(new file)* | **new** | pure helper module — membership lookup, edge generation, dim color computation. No React. No Three.js refs. Just functions. See §7.3. |
| `components/HeroBlock.tsx` | **minor** | remove the `012 ACTIVE | 047 OBSERVATION` counter row per Peat 2026-05-15 cut. (DivergenceMeter stays. Hero title stays.) |
| `app/atlas/page.tsx` *(new file, if not yet created by journey-arch §7.3 delivery)* | **dependent** | mobile-primary `/atlas` route. Out of strict TASK-14 scope but binds to the same store. |

### 7.2 zustand store shape

```ts
// lib/store/globe.ts
import { create } from "zustand";
import type { StratumKey, AttractorKey, EntryId } from "@/lib/entries";

type GlobeStore = {
  // observer locus — invariant in v1
  alpha: string;             // "1.130426"

  // user state — what the visitor chose
  stratum: StratumKey;       // "all" | "nex" | "neon" | "neo"
  activeAttractor: AttractorKey; // "all" | "coffee" | … (from ATTRACTOR_FIELDS)
  selectedId: EntryId | null;

  // setters
  setStratum: (s: StratumKey) => void;
  setActiveAttractor: (a: AttractorKey) => void;
  setSelectedId: (id: EntryId | null) => void;
};

export const useGlobeStore = create<GlobeStore>((set) => ({
  alpha: "1.130426",
  stratum: "all",
  activeAttractor: "all",
  selectedId: null,
  setStratum: (s) => set({ stratum: s }),
  setActiveAttractor: (a) => set({ activeAttractor: a }),
  setSelectedId: (id) => set({ selectedId: id }),
}));
```

**Note on `AttractorKey`.** Add a type alias in `lib/entries.ts`:

```ts
export type AttractorKey = (typeof ATTRACTOR_FIELDS)[number];
```

This makes the union literal and the store call sites type-safe without duplicating the enum.

### 7.2a (v1.1) v1.3 renderer target store shape

Per §1.3a, the v1.3 renderer replaces `stratum` with `cameraFocus`. The store shape becomes:

```ts
// lib/store/globe.ts — v1.3 target
import { create } from "zustand";
import type { AttractorKey, EntryId } from "@/lib/entries";

type CameraFocus = "rest" | "surface" | "orbit" | "axis";

type GlobeStore = {
  // observer locus — invariant in v1
  alpha: string;             // "1.130426"

  // user state — what the visitor chose
  cameraFocus: CameraFocus;        // camera-aid only; never hides any stratum
  activeAttractor: AttractorKey;
  selectedId: EntryId | null;

  // setters
  setCameraFocus: (f: CameraFocus) => void;
  setActiveAttractor: (a: AttractorKey) => void;
  setSelectedId: (id: EntryId | null) => void;
};

export const useGlobeStore = create<GlobeStore>((set) => ({
  alpha: "1.130426",
  cameraFocus: "rest",
  activeAttractor: "all",
  selectedId: null,
  setCameraFocus: (f) => set({ cameraFocus: f }),
  setActiveAttractor: (a) => set({ activeAttractor: a }),
  setSelectedId: (id) => set({ selectedId: id }),
}));
```

**Migration path.** The legacy `stratum: "all" | "nex" | "neon" | "neo"` maps to `cameraFocus: "rest" | "orbit" | "axis" | "surface"` (note: `nex` → `orbit` and `neon` → `axis` because v1.3 names the strata by their content type, not by their abbreviated codename). Sirius renames the field during the TASK-16 globe-renderer rebuild; downstream consumers (`AttractorFields.tsx`, `ChapterIndex.tsx`) read `cameraFocus` instead of `stratum` going forward. Keyboard mapping per §4.1a.

**Touched components under v1.3.** The §7.1 table is unchanged in scope — `WorldlineGlobe.tsx` is replaced wholesale by the v1.3 renderer in a separate Sirius TASK; the binding mechanic in this doc rides on top of that renderer. AttractorFields and ChapterIndex are unchanged in v1.1.

### 7.3 the pure helper module

```ts
// lib/binding/attractor.ts
import type { Entry, AttractorKey } from "@/lib/entries";

/**
 * Returns true if `entry` is a member of `attractor`.
 *
 * Membership rule for v1:
 *   - if attractor === "all" → all entries are members
 *   - otherwise → entry.tags includes the attractor, OR
 *                 entry.domain matches the attractor's domain alias
 *                 (e.g. "meta" attractor matches domain === "meta")
 *
 * Future: when velite schemas land (TASK-22), this lookup
 * may read an explicit `attractors: string[]` field.
 */
export function isInAttractor(entry: Entry, attractor: AttractorKey): boolean { /* … */ }

/** Filter helper · used by ChapterIndex and the Globe's pin pass. */
export function getEntriesForAttractor(
  entries: Entry[],
  attractor: AttractorKey,
): Entry[] { /* … */ }

/**
 * Computes the edge set for the active attractor.
 * Applies the §3.4 density cap.
 */
export function computeAttractorEdges(
  members: Entry[],
): { a: Entry; b: Entry; kind: "ss" | "so" | "oo" }[] { /* … */ }

/**
 * Returns a Three.js-friendly color for the dim state, given
 * the original node color. Pure — does not touch any THREE.Color
 * instance the caller cares about.
 */
export function dimColor(
  originalHex: number,
  inkFaintHex: number,
): number { /* … */ }
```

This module is unit-testable. Algol should be able to write tests for `isInAttractor` and `computeAttractorEdges` without needing a DOM or a WebGL context. Recommended.

### 7.4 the transition queue (pausing motion during reading)

Per §5 motion-during-reading rule:

```ts
// inside WorldlineGlobe.tsx — pseudocode
const pendingAttractor = useRef<AttractorKey | null>(null);

useEffect(() => {
  if (selectedId !== null) {
    pendingAttractor.current = activeAttractor;
    return; // do not run the 220ms transition while panel is open
  }
  if (pendingAttractor.current !== null && pendingAttractor.current !== activeAttractor) {
    // visitor closed the panel · apply the queued attractor change now
    runAttractorTransition(pendingAttractor.current, activeAttractor);
    pendingAttractor.current = null;
  } else {
    runAttractorTransition(/* old */, activeAttractor);
  }
}, [activeAttractor, selectedId]);
```

Sirius adapts to actual ref/state patterns. The contract: **no attractor-layer animation runs while the side panel is open**.

### 7.5 testing checklist — for Algol

- `isInAttractor` returns correct boolean for every `(entry, attractor)` pair in `RECENT_ENTRIES × ATTRACTOR_FIELDS`
- `computeAttractorEdges` returns ≤45 edges for any input
- `computeAttractorEdges` returns surface↔orbit edges before surface↔surface when total exceeds cap
- changing `activeAttractor` while `selectedId !== null` does NOT trigger the 220ms transition; closing the panel does
- reduced-motion mode: changing `activeAttractor` snaps instantly (0ms)
- attractor selection persists when stratum changes
- `DivergenceMeter` does not re-render when `activeAttractor` changes (verify with React DevTools profiler — the meter's render count should be invariant under attractor selection)
- mobile breakpoint: SVG mini-globe halos and edges render per §6.2
- a11y: pill keyboard activation (Tab + Enter) emits the same state change as pointer click; screen reader announces "‹attractor› field active, ‹N› traces clustered" via the NETRA voice strip's `aria-live="polite"`

### 7.6 what Sirius must NOT do

- Do not subscribe `DivergenceMeter` to `activeAttractor` (per §2.2 contract).
- Do not introduce a fourth state variable beyond the four in §4.1 / §4.1a.
- Do not auto-pick an attractor when a pin is clicked (per §2.1 reverse-direction contract).
- Do not invent new tokens (per Polaris constraint).
- Do not draw attractor edges to or from axis nodes (α / 012 / 047 are excluded per §2.1 step 4).
- Do not animate the halo or the edges decoratively. Static. They are recognition, not theater.
- **(v1.1)** Do not preserve the legacy `STRATA` toggleable framing record from `WorldlineGlobe.tsx` in the v1.3 renderer. The four entries `STRATA[all|nex|neon|neo]` and the `showField` / `showAxis` / `showContours` visibility flags retire per §1.3a + ontology §10. The v1.3 renderer mounts `surfaceGroup` / `orbitGroup` / `axisGroup` once and never hides them. `cameraFocus` only changes camera position + framing, never group visibility.
- **(v1.1)** Do not preserve the `1 / 2 / 3 / 0` keyboard mapping's *semantic* of "toggle stratum visibility" — preserve only the *muscle-memory* of those keys, remapped to `cameraFocus` per §4.1a.

---

## 8 · anti-Codex 6-point audit

Per `betelgeuse.md` quality-bar: reference fidelity · token compliance · pattern reuse · a11y · mobile · motion.

| § / decision | 1 ref fidelity | 2 token compliance | 3 pattern reuse | 4 a11y | 5 mobile | 6 motion |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| §1.2 binding rule (stratum filters · attractor highlights · divergence reads observer) | ✓ matches ontology v1.3 co-equality + Peat's S;G cosmology | n/a | ✓ uses existing three-component vocabulary | ✓ each axis announced via existing aria-live channels | ✓ scales — see §6 | ✓ |
| §1.3 v1.3 co-equality encoded as 3 sets · FULL is a view | ✓ direct ontology §1.1 quote-translation | n/a | ✓ no new data model atoms | n/a | ✓ | n/a |
| §1.4 DivergenceMeter static under attractor | ✓ ontology §5 reading of α as observer locus | n/a | ✓ existing meter behavior unchanged | ✓ no a11y regression (meter already `aria-live` via DM internals) | ✓ | ✓ no new motion |
| §1.5 orbital network feel via attractor edges | ✓ Peat's 2026-05-15 feedback handoff item 2 directly addressed | ✓ all colors are existing tokens | ✓ great-circle arc geometry reuses ontology §4.4 spline pattern + existing `arcLine` in `WorldlineGlobe.tsx` lines 640–655 | ✓ edges hit-testable for hover (existing raycaster pattern) | ✓ SVG equivalent at mobile | ✓ static after fade-in |
| §2.1 AttractorFields → Globe contract | ✓ binds existing AttractorFields state to existing Globe rendering | ✓ `var(--accent-orange)` + Three.js `0xd4602a` already in use | ✓ no new component invented | ✓ keyboard nav per §7.5 | ✓ scales to mini-globe | ✓ 220ms in 200–300ms bucket |
| §2.2 AttractorFields ⊥ DivergenceMeter (no binding) | ✓ ontology §5 + S;G cosmology | n/a | ✓ DM unchanged | ✓ no regression | ✓ | ✓ |
| §2.3 Globe ⊥ DivergenceMeter (read-only shared α) | ✓ ontology §5.5 | n/a | ✓ existing α string flows from one source | ✓ | ✓ | ✓ |
| §3.1 field-strength halo | ✓ new but tiny vocabulary, anchored in existing `alphaRing` ring-on-node pattern (`WorldlineGlobe.tsx` line 597–604) | ✓ `var(--accent-orange)` only | ✓ ring-around-glyph already used for α | ✓ glyph stays clickable | ✓ glyph follows mini-globe pin geometry | ✓ static |
| §3.2 attractor edges (solid, accent-orange, 0.45) | ✓ ontology §4.4 great-circle arc pattern | ✓ existing token | ✓ leaves dashed/dotted free for ontology §4.3 lineage edges later | ✓ edges reachable via hover; voice announces | ✓ SVG equivalent | ✓ stagger capped at 500ms |
| §3.3 dim state (0.32 opacity + ink-faint lerp) | ✓ ontology §7 visual hierarchy supports figure-ground language | ✓ `var(--ink-faint)` exists | ✓ no new state visual; just opacity + color | ✓ hit-sphere preserved — non-members remain clickable | ✓ same on SVG | ✓ 220ms cross-fade |
| §3.4 edge density cap at 45 | ✓ engineering judgment to preserve legibility per Peat's "intimate, small body" framing in ontology §1.3 | n/a | ✓ rule is purely about which edges render, not how | n/a | ✓ same cap applies on SVG | n/a |
| §4 state machine | ✓ exhaustive · matches PoC for unchanged cells | n/a | ✓ no new strata, no new attractors | ✓ all paths announced via NETRA voice | ✓ mobile cells documented | ✓ all transitions in calibrated buckets |
| §4.5 empty states (0 members / 1 member) | ✓ ontology §1.3 "the body is honest about its sparseness" | n/a | ✓ reuses NETRA voice slot | ✓ aria-live | ✓ | ✓ no extra motion |
| §5 motion calibration | ✓ all six gauntlet rules pass except two pre-existing DM loops (⚠ flagged, defensible) | ✓ no new motion tokens | ✓ all durations reuse existing PoC values where possible | ✓ reduced-motion path documented | ✓ same calibration | ✓ |
| §6 mobile collapse (SVG mini-globe + horizontal pill row) | ✓ matches journey-arch §7 + Peat's earth-textured constraint via simplified continent paths | ✓ tokens preserved across SVG | ✓ pill row reuses existing AttractorFields styling | ✓ 44×44 touch targets, scroll-snap | ✓ this is the mobile section | ✓ same calibration |
| §7 implementation handoff (zustand store + pure helper module) | ✓ contract-driven; Sirius's territory | n/a | ✓ zustand already used in PRD-02/05; consistent | ✓ keyboard nav specified | ✓ store-driven; works at all breakpoints | n/a |
| §7.4 transition queue · pause motion during reading | ✓ honors anti-Codex motion rule 6 explicitly | n/a | ✓ standard React pattern | ✓ better for screen-reader users — no motion competes with announcement | ✓ | ✓ |
| **§1.3a (v1.1)** retire toggleable framings · `cameraFocus` replaces `stratum` | ✓ ontology §10.1 explicit retire list | n/a | ✓ existing button placement preserved; only semantics change | ✓ keyboard 1/2/3/0 muscle memory preserved; FOCUS buttons remain proper `<button>` elements | ⚠ mobile FOCUS placement TBD by Sirius (likely bottom-sheet per journey-arch §7.3); flagged in audit summary | ✓ 900ms easeInOutCubic in 700–1400ms ATLAS bucket; reduced-motion = instant cut |
| **§1.6 (v1.1)** Peat's three locked directions baked in (earth-tex / network / transparency) | ✓ FEEDBACK 2026-05-15 directly addressed line-by-line | ✓ texture is asset; paper-tint uses `var(--paper-base)`; transparency is material-opacity (no token needed) | ✓ Globe v7.html earth-tex precedent · network = §3 binding · transparency = ontology §5.2 hint extended | n/a (visual depth; proxy DOM handles semantic a11y) | ✓ SVG mini-globe inherits simplified continent paths | ✓ 600ms body-transparency tween in 300–500ms→700ms overlay bucket (slight over, defensible) |
| **§3.6 (v1.1)** body transparency modulates on attractor active (0.55 → 0.35) | ✓ supports orbital network foregrounding per §1.6 | ✓ material-opacity, no token | ✓ standard Three.js material approach | n/a | ✓ same calibration on SVG (svg `opacity` attr) | ✓ 600ms ease-in-out; reduced-motion = instant value swap |
| **§4.1a (v1.1)** state shape under v1.3 — `cameraFocus` axis | ✓ aligns with §1.3a + ontology §10.1 | n/a | ✓ zustand pattern unchanged; only field renames | ✓ aria mapping unchanged | ✓ | n/a (data shape) |
| **§4.2a (v1.1)** v1.3 state matrix — no rows hide any group | ✓ ontology §1.1 "co-present, co-equal, no toggle" rendered literally | n/a | ✓ rendering primitives unchanged from §4.2; only render-decisions shift | ✓ all paths announced via NETRA voice (V column) | ✓ matrix scales to mobile FOCUS placement TBD | ✓ unchanged transition durations |
| **§7.2a (v1.1)** v1.3 target zustand store shape | ✓ honors §1.3a + §4.1a state-shape change | n/a | ✓ zustand `create<>()` pattern unchanged; only fields renamed | ✓ | ✓ | n/a |

### audit summary

**0 FAILs.** **3 partials (⚠) — two pre-existing and one v1.1-introduced:**

1. **DivergenceMeter idle Nixie flicker (§5 row · pre-existing decorative loop).** The loop is meter-internal and is the meter's whole point — an instrument reading itself. Out of TASK-14 scope. Logged for Algol QA review; not a blocker.
2. **DivergenceMeter worldline drift loop (§5 row · pre-existing decorative loop).** Same reasoning. Out of TASK-14 scope.
3. **(v1.1)** **FOCUS-aid placement on mobile breakpoints (§1.3a row · mobile column).** The four FOCUS buttons on the left rail (FOCUS · SURFACE / ORBIT / AXIS / REST) at ≤880px likely need to drop into a bottom-sheet drawer per journey-arch §7.3 mobile pattern. Sirius decides exact placement during the v1.3 renderer rebuild. Binding spec does not lock placement — it locks behavior. Logged for cross-coordination between Betelgeuse (γ-mobile spec) and Sirius (implementation).

Pre-existing partials 1+2 were present in the PoC at TASK-08 lock-in. v1.1 partial 3 is a delegated mobile-placement question, not a design conflict. The binding mechanic itself introduces zero decorative loops and zero new tokens.

### what the audit demonstrates

Every binding decision either:
- reuses an existing vocabulary atom (corner reticles, `var(--accent-orange)`, ring-around-node, great-circle arc, `easeInOutCubic`, 220ms = the existing 320ms opacity bucket's smaller cousin)
- or directly translates an ontology v1.3 rule into render geometry (attractor edges as great-circle arcs; halo as ring-around-glyph; co-equality as three peer node sets)

No new tokens. No raw hex/rgba in component code (Three.js color constants `0xd4602a` etc. already established in `WorldlineGlobe.tsx`). No new fonts. The spec passes its own gauntlet.

---

## 9 · cross-reference into journey-architecture.md

This section instructs the journey-architecture.md maintainer (myself) on the §13 update.

The journey-arch §13 currently reads (after v1.2):

> *All open items from v1.0 are now resolved (2026-05-15). The journey architecture is settled at v1.2.*

A v1.3 footnote / addendum updates this with:

> *#2 (§1 M6 · AttractorFields ↔ Globe two-way binding) — RESOLVED 2026-05-15 via TASK-14 binding mechanic spec at `docs/design/attractor-binding-mechanic.md`. Journey-arch §1 M6 "deferred to TASK-14" is now closed; the canonical binding contract lives in the separate doc. Journey-arch §2.2 node glyphs remain canonical; the binding doc references but does not redesign them.*

The journey-arch §6 (the AttractorFields-related decision) is unchanged — `attractor stays as a separate below-the-fold filter on the list` is still true at v1; the binding adds the highlight pass on top of that.

Cross-references from this doc back into journey-arch are scattered throughout above (§1.5, §2.1, §3.5, §4, §6). They are intentional — this doc does not stand alone; it is the **binding** between the journey-arch's architecture and the components' implementation.

---

## 10 · non-goals for this TASK

- No code implementation. This is a spec. Sirius writes code in subsequent TASKs.
- No new design tokens. Token harmonization is a separate parked TASK.
- No NETRA chat binding to attractors. NETRA stays in its drawer per journey-arch §4; if NETRA later wants to surface "you are viewing the coffee field" in chat, that is a follow-up TASK for Arcturus.
- No search overlay binding. Search is journey-arch §8 + TASK-40. Orthogonal.
- No fiction-stratum redesign. Fiction diamond glyph lives in the NeX orbit per ontology §4.5 and journey-arch §2.2; this doc references but does not re-spec it.
- No boot-sequence reconfiguration. Boot is its own TASK wave per journey-arch §9.
- ~~No revision to the three-pill camera framings (`all`, `nex`, `neon`, `neo`). The toggleable framings stay as shipped; the binding rides on top. Reconciling toggleable framings with v1.3 strata-co-equal in the *visual base layer* (so that the visitor sees three layers at once at default zoom per ontology §1.1) is TASK-16's job, not this one.~~
- **(v1.1 REVERSED · 2026-05-15)** Per Peat "ทำ 1.3 STRATA" lock, this non-goal is reversed. The toggleable framings retire per ontology §10 migration; this binding spec consumes the v1.3 renderer's `cameraFocus` state shape (§4.1a + §7.2a). The visual base layer reconciliation is still TASK-16's job (it rebuilds the renderer); TASK-14's binding spec now explicitly **targets** the v1.3 renderer (not the legacy PoC). Both TASKs move in the same direction.
- No DivergenceMeter rework. Its motion vocabulary (Nixie + drift) is pre-existing and out of scope.

---

## 11 · open items flagged forward

All design decisions in this doc are settled at v1. Items logged forward, not blocking:

1. **Local α per attractor** (§1.4 future extension) — defer until the corpus grows large enough that thematic clusters become cosmologically distinct regions. Currently `RECENT_ENTRIES` has eight entries; not warranted.
2. **Globe → AttractorFields reverse binding** (§2.1 reverse-direction note) — defer; v1 keeps the visitor's pin-click as a non-presumptive action. If user testing shows visitors want "show me others like this" from an entry, open a follow-up TASK.

**v1.1 open question for Peat (per TASK-14 contract):**

3. **Left-rail mechanic under v1.3.** §1.3a + §4.1a propose replacing the legacy strata-toggle buttons with a `cameraFocus` camera-aid (FOCUS · SURFACE / ORBIT / AXIS / REST) in the same left-rail position. Each FOCUS button moves the camera (900ms) but NEVER hides strata. Alternative: remove the left rail entirely (cleaner break from legacy, but leaves the A.T.L.A.S. instrument frame asymmetric and frees `1/2/3/0` keyboard for future use). Betelgeuse recommends keeping the rail with FOCUS-aid pattern (honors v1.3, preserves muscle memory, maintains instrument-frame symmetry). Peat call: confirm FOCUS-aid OR call removal. Either choice is compatible with the binding spec; the difference is only visual real estate in the A.T.L.A.S. frame.

4. **Edge-bundle traversal speed when many member-edges activate at once.** §3.4 caps at 45 edges; the v1 corpus is far below this. If post-launch a heavily-populated field renders 30+ highlighted edges and visitors report it as overwhelming, introduce a staggered highlight (60ms delay between adjacent edges, walking outward from camera-nearest member). Measure first; do not pre-build.

5. **NETRA voice on tag-pill activation.** Currently §2.1 step 5 has NETRA update its voice strip ("netra · field coffee · 3 traces clustered · 3 edges drawn."). If this reads as chatty when the visitor is rapidly switching pills, consider silencing the voice update on tag-pill activation (speak only on node-click activation). Vega + Arcturus call after first user feedback.

Items 1–2 are pre-v1.1 backlog. Items 3–5 are introduced by the v1.1 revision pass. None are v1 blockers.

---

*betelgeuse · α-VIS-04 · the Red Sentinel · TASK-2026-05-15-14 · opus tier · attractor-binding-mechanic v1.1*
*derived from journey-architecture.md v1.2 + ontology v1.3 + Peat's 2026-05-15 visual feedback + 2026-05-15 "ทำ 1.3 STRATA" lock · zero new tokens · zero new fonts · zero looping decorative motion added by this spec*

### Changelog

- **v1.0 (2026-05-15)** — initial spec; bound the three components per S;G cosmology; encoded v1.3 strata co-equality at the data-model level (`surfaceNodes` / `orbitalNodes` / `axisNodes`) but kept the legacy `stratum` toggleable framings as the visible state machine because the visual base layer reconciliation was logged as TASK-16's job.
- **v1.1 (2026-05-15)** — Peat locked v1.3 strata co-equality as the renderer target ("ทำ 1.3 STRATA"). Surgical revision pass: added §1.3a (retire toggleable framings; binding targets v1.3 renderer), §1.6 (Peat's three locked direction shifts — earth-textured / orbital network / transparency revealing Ne0N — explicitly applied), §3.6 (body-transparency modulation on attractor active), §4.1a + §4.2a (state shape + matrix replace `stratum` with `cameraFocus` camera-aid; no row hides any group), §7.2a (v1.3 target zustand store shape with `cameraFocus`), §7.6 v1.1 entries (do not preserve legacy STRATA record). §10 non-goal "no revision to three-pill camera framings" REVERSED — framings retire per ontology §10 migration. §11 added open question for Peat on FOCUS-aid vs left-rail-removal. Six audit rows added to §8; all six pass; 1 v1.1 partial (mobile FOCUS placement, delegated to Sirius). Sections §0, §1.1, §1.2, §1.4, §1.5, §2, §3 (except §3.6), §5, §6, §9 unchanged from v1.0.
