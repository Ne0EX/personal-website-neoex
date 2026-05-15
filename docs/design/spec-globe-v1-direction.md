# Globe v1 direction — spec

> author · Betelgeuse (α-VIS-04)
> task · TASK-2026-05-15-UI-1 · iteration 1 of UI-lock cycle
> date · 2026-05-15
> companion · `.claude/visual-diffs/UI-ITER-1-globe-v1/prototype/index.html` (standalone, browser-viewable)
> status · DRAFT — awaiting Peat direct review tonight
> review outcome · LOCK or REVISE on same TASK-ID

---

## 0 · what this document is

This is the rendered visual direction for the Globe at v1. It exists because:

1. The PoC currently shipping in `components/WorldlineGlobe.tsx` carries the v7 toggleable-stratum model — superseded by v1.3 co-present (SBA-1 §3 D3, attractor-binding §1.3a).
2. The attractor-binding mechanic (`docs/design/attractor-binding-mechanic.md` v1.1) names but does not render the orbital-network feel.
3. Peat locked three direction shifts on 2026-05-15 (earth-textured base · orbital network feel · transparency revealing Ne0N axis) that the rendered Globe must demonstrate before any further Sirius dispatch.
4. SBA-1 §summary canonized nine visual-soul statements; this spec is the first surface that must demonstrate them simultaneously.

This document **specifies the v1 visual direction**. It does NOT implement it. Implementation is Sirius's territory in subsequent TASKs (16–19 v1.3 renderer migration).

Every visual decision below is traced to one of:

- **v7** · `/Users/neospiritth/Downloads/Worldline Globe v7.html` (lines cited)
- **main-branch** · `app/globals.css` or `components/WorldlineGlobe.tsx`
- **SBA-1** · `docs/team/.soul-baseline/visual.md`
- **binding** · `docs/design/attractor-binding-mechanic.md` v1.1
- **evolved** · justified divergence with rationale

---

## 1 · intent

The Globe communicates four things at a glance:

1. **The archive has a body.** A paper-earth sphere at real GPS coordinates with surveyed marks. Not decorative; the body of the page (SBA-1 §1.6, I2).
2. **The body has interior structure.** A vertical spine (Ne0N axis) and outer shells (NeX field) are visible *through* and *around* the surface — three co-equal spatial systems readable simultaneously (binding §1.3a, SBA-1 §2.3, §summary item 3).
3. **The archive has an observer.** α at Bangkok pulses orange. Peat is present through the instrument layer, not biography (SBA-1 §1.6 D6, soul-statement §1).
4. **The archive responds to questions.** Attractor pills light an orbital network — visible edges between in-membership nodes, body steps back slightly to let the network read (binding §1.6 row 2, §3.6).

Non-intent: this is not the chat surface. NETRA is present as instrument probe (RETICLE/RANGE), not as conversational agent. The chat drawer is a separate feature (TASK-52); the instrument console must remain alive (SBA-1 §1.6 F5).

---

## 2 · canvas geometry

| element | value | source |
|---|---|---|
| stage size at desktop | 1180 × 760 | v7 line 32 (`.stage{width:1180px;height:760px}`) · main-branch `.atlas-frame` at xl breakpoint |
| outer padding | 24 px | v7 line 24 |
| frame inner padding | 24 32 22 | v7 line 58 |
| content grid | `220px minmax(0,1fr) 240px` · gap 22 | v7 line 73 |
| frame-foot grid | `1fr 1fr 1fr minmax(220px,1.3fr)` · gap 18 | v7 line 186 |
| corner-marks inset | 14 px, 14×14 L-bracket, 1 px `var(--accent-orange)` | v7 line 51 · globals.css `.corner-marks` |

The 1180×760 canvas is preserved verbatim from v7. The frame is the containing form; the globe lives inside it (SBA-1 §2.1, I2).

---

## 3 · palette · TEAL (active) over v7 navy

| token | value | role | source |
|---|---|---|---|
| `--paper-base` | `#E8E2D5` | dominant surface | globals.css line 19 |
| `--paper-warm` | `#EDE7DA` | readout-row bg, divergence card | globals.css line 20 |
| `--paper-deep` | `#D8CFB9` | body backdrop behind stage | globals.css line 21 |
| `--ink-rgb` | `31 80 99` | ink TEAL (active) | globals.css line 28 |
| `--accent-orange` | `#D4602A` | α · corner reticles · arc · pole rings · attractor edges · halos | globals.css line 41 |
| `--netra-rgb` | `77 122 146` | NETRA console border + label | globals.css line 36 |

**Evolution from v7 (D1, SBA-1 §3 D1, resolved).** v7 used `#1A2832` (navy); main-branch web ships TEAL `#1F5063` active with navy as backup (`[data-palette="ink"]`). This direction follows the main-branch active palette. The Three.js color constants in the prototype use `0x1F5063` for ink and `0xD4602A` for accent, mirroring how `components/WorldlineGlobe.tsx` will encode them.

**Zero new tokens.** Confirmed by grep: every `color:` and Three.js color in the prototype maps to a value already present in `app/globals.css`. The aged-paper texture base colors (`#A89E89` / `#BAB099`) used INSIDE the procedural canvas are an evolved-from-v7 (v7 used `#9E9377` / `#B5AA8B`, slightly warmer). They are not surface tokens — they are pixel values baked into a runtime-generated texture. They do not enter `globals.css` and do not need to. **Justification for evolution:** the v7 warmer olive read against navy ink; the cooler paper-floor (`#A89E89`) reads against TEAL ink with comparable contrast.

---

## 4 · the three co-present strata

The non-negotiable. All three groups are mounted from first paint and **never hidden** (binding §1.3a item 1; SBA-1 §3 D3, §summary item 3).

### 4.1 surfaceGroup — Ne0 (the archive face)

| atom | value | source |
|---|---|---|
| sphere geometry | `SphereGeometry(1, 128, 128)` | v7 line 565 |
| material | `MeshStandardMaterial` w/ procedural map + roughness + bump | v7 lines 556-564 |
| **opacity** | **0.92 baseline** · drops to **0.62** when an attractor activates (600ms ease-in-out) | binding §3.6 (new). Evolved from v7 (opacity 1.0 always). **Rationale:** Peat-locked transparency revealing Ne0N axis (binding §1.6 row 3). At 0.92 the spine reads faintly at the poles; at 0.62 (attractor active) the network edges and axis foreground without losing the body. |
| procedural canvas | 2048×1024, aged paper gradient + 18 multiply blotches + lat/lon grid baked + grain + Earth coastline soft-multiply | v7 lines 444-550. Gradient colors evolved (§3) |
| lat/lon graticule (3D) | equator full opacity 0.55, 15° spacing faint 0.30 | v7 lines 576-611 |
| contours | 7 wobbled rings at lat -65..55, breathing 0.55±0.12 | v7 lines 613-632 |

### 4.2 axisGroup — Ne0N (the pole bearer)

| atom | value | source |
|---|---|---|
| spine cylinder | `CylinderGeometry(0.008, 0.008, 2.6)` | v7 line 638 |
| spine color | `var(--ink-primary)` (TEAL) | evolved from v7 navy |
| survey-triangle caps at y=±1.3 | open lines (no fill), 8 segments | v7 lines 641-654 |
| pole beacons at y=±1.0 | RingGeometry 0.04–0.05 + dot, color `var(--accent-orange)` | v7 lines 659-679 |
| pulse | 0.55 ± 0.45 sin(0.004t) on ring opacity | v7 line 970 |
| **visibility** | **always rendered** (no toggle) | binding §1.3a item 1, §4.1a; v1.3 ontology canon |

The spine renders BEFORE the surface in the scene graph order. Combined with surface `opacity: 0.92`, the spine reads as a faint vertical line through the body at the poles. The orange polar beacons sit at the pole surface; the spine extends past them in both directions — this is the "transparency revealing Ne0N axis" Peat locked.

### 4.3 orbitalGroup — NeX (the possibility field)

| atom | value | source |
|---|---|---|
| 3 wireframe shells | radius 1.18 / 1.32 / 1.48, opacity 0.10 / 0.07 / 0.05 | v7 lines 686-700 |
| color | `var(--ink-primary)` | evolved from v7 navy |
| emission rays | 48 rays via Fibonacci sphere, opacity 0.35, length 1.18 → 1.55 | v7 lines 702-713 |
| **visibility** | **always rendered** | binding §1.3a item 1 |

The shells sit OUTSIDE the surface sphere. Combined with their wireframe opacities (0.05–0.10), they read as a thin orbital cage — never opaque, never obscuring the surface beneath.

---

## 5 · surveyed nodes — Ne0 archive entries

Per v7 lines 735-750. Every node has `lat`, `lon`, `label`, `place`, `why`. The narrative reason matters — these are not data points, they are surveyed marks (SBA-1 §2.4, §summary item 4).

| label | place | coords | why | attractors |
|---|---|---|---|---|
| **α** | Bangkok · TH | 13.7563°N · 100.5018°E | observer's locus | all · narrative · meta |
| 003 | Kyoto · JP | 35.0116°N · 135.7681°E | architecture of taste | narrative · japan |
| 002 | Chiang Mai · TH | 18.7883°N · 98.9853°E | why I paused the startup | narrative · ai · ml |
| 001 | Yirgacheffe · ET | 6.16°N · 38.2058°E | four pours — coffee origin | coffee |
| 000 | San Francisco · US | 37.7749°N · −122.4194°W | paused engineer — ml origin | ai · ml · narrative |
| 012 | Tokyo · JP | 35.6762°N · 139.6503°E | narrative · active branch | japan · narrative |
| 047 | Point Nemo · PAC | −48.8767°S · −123.3933°W | meta vantage · most remote | meta |

**Node treatment:**

- non-α nodes: 0.012 radius sphere, `var(--ink-primary)` material
- **α node** (Bangkok): 0.022 radius sphere, `var(--accent-orange)` material, with an orange RingGeometry 0.034–0.044 around it pulsing at 0.5 ± 0.45 sin(0.005t). Visually distinct as the observer locus. (v7 lines 753-772; SBA-1 §2.4)
- worldline arc: dashed orange QuadraticBezierCurve3 from α swooping outward into the NeX field, `dashSize` breathing animation. (v7 lines 774-786)

**Hit behavior:** all nodes clickable. On click (or NETRA "⟶ NEXT NODE" jump), the coord-pin shows `LABEL · PLACE · COORDS` with the narrative `why` directly underneath in italic Cormorant — these surveyed reasons are part of the body's identity. (Evolution from v7 which only showed coords; the `why` field exists in v7's data structure but is not rendered. Surfacing it here is the soul gesture per SBA-1 §summary item 4.)

---

## 6 · the binding · attractor pills → orbital network

Per binding §2.1 + §3.

### 6.1 pill row placement

Right rail, ABOVE the stratum readout block. (Evolution from current PoC where AttractorFields ships as a separate page-level component. The Globe-internal pill row in this prototype is a **render of how the existing `AttractorFields.tsx` state will bind to the Globe** — see §10 cross-reference. The pill row in the prototype demonstrates the binding; in the production app, AttractorFields lives below the Globe per `journey-architecture.md`.)

**Tokens:**

| atom | value | source |
|---|---|---|
| pill default | 1px border `var(--ink-hairline)`, 4×8 padding, 8px mono uppercase 0.22em | globals.css `.atlas-strata-btn`-derived |
| pill hover | border `rgba(212,96,42,.5)`, color `var(--ink-primary)` | v7 line 87 |
| pill active | border `var(--accent-orange)`, bg `rgba(212,96,42,.10)` | v7 line 88 |

### 6.2 when an attractor activates

1. **Body opacity** `paperMat.opacity 0.92 → 0.62` over 600ms ease-in-out. (binding §3.6 new sub-rule)
2. **Member nodes** keep opacity 1.0. **Non-member nodes** drop to 0.32 (binding §3.3).
3. **Edges drawn** — for every pair of in-membership nodes, a great-circle arc on the sphere surface at radius 1.012, 96-segment curve, `var(--accent-orange)` at 0.45 opacity. (binding §2.1 step 4, §3.2)
4. **NETRA voice strip** updates: `netra · field ‹attractor› · ‹N› traces clustered · ‹E› edges drawn.` (binding §2.1 step 5)

### 6.3 when attractor returns to `all`

Body opacity tweens back to 0.92, all node opacities return to 1.0, edges clear, voice returns to the focus-default line. (binding §2.1 last paragraph)

### 6.4 axis nodes excluded

α / 012 / 047 may be in-membership of attractors (`narrative`, `meta`) but the axis layer itself does not receive halos. The orange ring around α is the observer-locus marker (always present), not an attractor halo. (binding §2.1 step 4 last bullet — "axis nodes are excluded from attractor edges.")

---

## 7 · cameraFocus framings — camera-aid only

Per binding §4.1a + §1.3a item 4. `cameraFocus` is a camera waypoint pointer; it **never hides any group**. The four values:

| `cameraFocus` | keyboard | camera target | hud-stratum readout | netra target |
|---|---|---|---|---|
| `rest` | 0 / Escape | `(0, 0, 4.2)` looking at origin | `FULL · Ne0EX` | `STANDBY` |
| `surface` | 1 | `latLonToVec(13.04, 26, 2.05)` looking at α surface point | `1 · Ne0` | `Ne0` |
| `axis` | 2 | `(0, 3.1, 0.2)` looking at `(0, 0.4, 0)` | `2 · Ne0N` | `Ne0N` |
| `orbit` | 3 | `(2.2, 1.2, 5.0)` looking at origin | `3 · NeX` | `NeX` |

(Camera waypoints reused verbatim from v7 lines 793-868.)

**Transition:** 1400ms easeInOutCubic on both `camera.position` and `currentLook` (v7 line 902, `easeInOutCubic` helper at v7 line 935; main-branch `WorldlineGlobe.tsx` carries the same helper).

**Continuous motion when `cameraFocus === 'rest'`:** `surfaceGroup.rotation.y += dt * 0.08`, `orbitalGroup.rotation.y -= dt * 0.032`, `raysGroup.rotation.y += dt * 0.048`. Slower than v7 (which used 0.10) — toned to allow the three-layer co-presence to settle into the viewer's eye. (Evolved · justification: at 0.10 the orbital shells flicker against the surface contours; at 0.08 they read as separate strata moving at separate rates.)

**Drag-orbit** (in `rest` and `orbit` only): `baseRotY += dx * 0.005` on `surfaceGroup` AND `edgesGroup` together so attractor edges track the body. (v7 line 1071, extended to bind edges.)

---

## 8 · the instrument frame · all four edges

### 8.1 frame-head — file strip

```
WORLDLINE · OBSERVATORY v.01    ∇ Ne0EX · 3D ORTHOGRAPHIC          α 1.130426    NAV NETRA
```

| atom | value | source |
|---|---|---|
| font | `var(--font-mono)` 9.5px uppercase 0.22em | v7 line 63, globals.css `.t-meta` |
| accent on `v.01` | `var(--accent-orange)` letter-spacing 0.26em | v7 line 66 |
| α value `1.130426` | `var(--font-type)` (Special Elite) | v7 line 69 |
| bottom border | 1px dashed `var(--ink-dashed)` | v7 line 64 |

**Evolution from v7:** version bumped `v.07 → v.01` to mark this as the v1 direction render. `OBSERVATORY · WORLDLINE STRUCTURE` → `WORLDLINE · OBSERVATORY` simplifies leading copy.

### 8.2 frame-foot — NETRA console + stratum counts

Per SBA-1 §1.6 D4 (NETRA placement) and §summary item 6: NETRA's instrument console **belongs in the frame-foot of the ATLAS instrument, sharing the dashed border with stratum readout counts.** (v7 lines 184-216, globals.css `.atlas-netra` + `.atlas-foot`.)

Four cells:

1. **NeX · FIELD** — `247 RAYS`
2. **Ne0N · POLE** — `+90°N`
3. **Ne0 · NODES** — `047` (orange-accent)
4. **NETRA console** — reticle SVG (pulsing 2.4s) · `◎ NETRA / target` · `RETICLE coord / RANGE value` · `⟶ NEXT NODE` button

**v7 D4 honored:** the floating "N" button proposed elsewhere in the journey-architecture does NOT replace this console. The instrument console persists at the foot of the Globe at all viewports ≥601px. (SBA-1 §1.6 F5 explicit; soul invariant I4 = NETRA as instrument probe.)

### 8.3 NETRA voice strip (below the console row)

`.netra-voice` element occupies a full-row span beneath the console row.

| atom | value | source |
|---|---|---|
| left border | 2px solid `var(--netra)` | globals.css `.atlas-netra-voice` |
| bg | `rgba(79,110,128,0.07)` | globals.css line 701 |
| tag (`NETRA`) | mono 7.5px 0.32em uppercase, color `var(--netra)` | globals.css `.voice-tag` |
| body | italic Cormorant 12px, color `var(--ink-primary)` | globals.css `.voice-body` |
| aria | `aria-live="polite"` | binding §2.1 step 5 |

**Default voice (rest, all):** `standing by · ne0ex aggregate in view. any node anchors the reticle. keys 1 · 2 · 3 narrow to a stratum.` — verbatim from Vega T5 correction in SBA-3 (SBA-AUDIT §3 TIER A · A1).

**Attractor voice:** `netra · field ‹attractor› · ‹N› traces clustered · ‹E› edges drawn.` — verbatim from binding §2.1 step 5.

### 8.4 HUD corners on the globe canvas

Four corners of `.globe-wrap` carry instrument readings. (v7 lines 322-338, globals.css `.atlas-hud-corner`.)

| corner | content |
|---|---|
| TL | `OBSERVING` · `FULL · Ne0EX` (bold, updates with cameraFocus) |
| TR | `CAMERA` · `ORBIT · 0°` (updates with cameraFocus framing label) |
| BL | `α 1.130426` (orange accent) · `13.04°N · 26.00°E` |
| BR | `SCALE` · `1 : 1.30E+26` |

Mono 7.5px 0.22em uppercase, `var(--ink-soft)` with `b` element promoted to `var(--ink-primary)`.

### 8.5 α watermark behind the globe

`.alpha-mark` — italic Cormorant 200px, `rgba(212,96,42,0.10)`, centered behind the canvas with `z-index: 0`. (globals.css `.atlas-alpha-mark`, v7 line 142 at 240px — main-branch tuned to 200px; spec follows main-branch.)

### 8.6 axis labels on the globe-wrap rim

Four labels at the panel edges (v7 lines 313-316):

- **+Z · NORTH** (top)
- **−Z · SOUTH** (bottom)
- **PROJECTION FIELD** (left, rotated −90°)
- **ARCHIVE FACE** (right, rotated 90°)

Mono 8.5px 0.18em uppercase, paper-base background patch over the dashed border.

### 8.7 left rail · cameraFocus buttons + DivergenceMeter card

Buttons keyed 0/1/2/3 with glyph + id + role. Active state: left border bar (orange) + bg tint (v7 line 88 pattern, globals.css `.atlas-strata-btn.is-active` pattern). **Naming evolution:** `STRATA · TRAVEL TARGETS` → `FRAMING · CAMERA-AID`. Rationale: per binding §1.3a, these buttons no longer toggle stratum visibility; they re-point the camera. Renaming the section prevents the legacy semantic from reasserting itself.

DivergenceMeter micro card:
- mini corner reticles (8×8 L-brackets) added per main-branch evolution of v7's `.divergence-card` (globals.css `.diverge-panel::before/::after`)
- Special Elite numerals 22px, middle group `1304` in `var(--accent-orange)`
- coords `13.04°N · 26.00°E`

(Per binding §2.2: meter is **invariant** under attractor selection. Confirmed in prototype — `setAttractor` does not touch the card.)

---

## 9 · motion calibration · anti-Codex 6-point compliant

Per `.claude/agents/betelgeuse.md` quality bar item 6 + binding §5 + SBA-1 §1.8.

| motion | timing | easing | trigger | source |
|---|---|---|---|---|
| cameraFocus travel | 1400 ms | easeInOutCubic | focus button / keyboard | v7 line 902 |
| NETRA jump | 1100 ms | easeInOutCubic | jump button | v7 line 1033 |
| body opacity 0.92↔0.62 | 600 ms | easeInOutCubic | attractor activate/clear | binding §3.6 (new) |
| node dim 1.0↔0.32 | 220 ms | easeInOutCubic | attractor change | binding §3.3 |
| edge fade-out | 220 ms | easeInOutCubic | attractor → `all` | binding §2.1 last ¶ |
| NETRA reticle pulse | 2400 ms loop | ease-in-out | always | v7 line 210, globals.css `atlas-netra-pulse` |
| α ring pulse | sin(0.005t) | – | always (observer locus marker) | v7 line 974 |
| pole beacon pulse | sin(0.004t) | – | always | v7 line 970 |
| arc march | sin(0.002t) on dashSize | – | always | v7 line 978 |
| continuous rotation (rest) | 0.08 rad/s | linear | `cameraFocus === 'rest'` | evolved from v7 line 951 (0.10) |
| reduced-motion | all loops disabled, no opacity tweens — instant value swap | – | `prefers-reduced-motion: reduce` | binding §4.4, globals.css line 918 |

**The 6-point check:**

1. **100–150ms hover** — pill border transition 250ms (slightly slow; tunable in implementation, NOT a soul-blocker).
2. **200–300ms selected state** — node dim 220ms ✓ · edge fade 220ms ✓.
3. **300–500ms overlays** — no overlay surfaces in v1.
4. **700–1400ms ATLAS camera moves** — 1400ms cameraFocus ✓ · 1100ms NETRA jump ✓.
5. **no looping decorative motion** — three loops (reticle pulse, pole beacons, arc march) all communicate state (NETRA readiness, observer-locus presence, worldline activity). None are decorative; all aligned with v7. ✓
6. **no motion during reading** — when an entry side panel opens (per existing PoC), the cameraFocus rotation pauses (transition queue, binding §7.4). ✓ (carried forward; not visible in this prototype which has no side panel surface).

---

## 10 · cross-reference into journey-architecture

This spec aligns with `docs/design/journey-architecture.md` §2 (ATLAS frame is the body of the homepage) and §3 (entry surfaces preserve the instrument vocabulary). The Globe demonstrated here is the homepage-level body. AttractorFields (currently rendered in the prototype's right rail for binding demonstration) lives BELOW the Globe in the production homepage stack — see `journey-architecture.md` §3.

The chat drawer (TASK-52, journey-architecture §4) is **out of scope for this iteration**. The prototype renders the Globe + ATLAS frame at the depth Peat must approve before any further surface ships.

---

## 11 · breakpoints

| viewport | behavior |
|---|---|
| ≥881 px | full 1180×760 stage with scale-fit (`scale(min(availW/1180, availH/760, 1))`) — v7 line 1086 carried forward |
| 601–880 px | content collapses to single column. Focus buttons reflow to a 2-column row. globe-wrap min-height 380px. NETRA console spans full row. (Three.js still mounts.) |
| ≤600 px | Three.js retires. `.standby` element activates: paper-canvas mini-globe (130×130 radial-gradient + lat/lon repeating-linear grid + orange α dot with 5px halo) + `ATLAS · STANDBY` label + α readout `1.130426 · 13.04°N · 26.00°E` + two CTAs (`OPEN ATLAS` · `AS LIST`). Frame-head stacks. NETRA console stays in foot. (per `60-responsive-system.md` §7.2 and SBA-1 §3 D5 / §4 F6) |

**375 px viewport check:** the STANDBY card renders, paper grain + dashed borders + corner reticles all preserved, α + divergence + a route back to full ATLAS all visible. Touch targets (CTAs) at ~88×34 px ≥ 44 px minimum. (SBA-1 §4 F6 loss budget honored.)

---

## 12 · accessibility

| concern | resolution | source |
|---|---|---|
| keyboard | `1` / `2` / `3` → cameraFocus surface/axis/orbit; `0` / `Escape` → rest. Attractor pills are `<button>` — Tab-reachable. | binding §4.1a, v7 line 1055 |
| focus visible | default browser outline on all buttons (Sirius may style; not retired) | – |
| aria | NETRA console `role="status"` `aria-live="polite"`. Attractor pills have `data-attractor`. Focus buttons toggle `aria-pressed`. | v7 line 381, binding §2.1 step 5 |
| reduced-motion | `@media (prefers-reduced-motion: reduce)` disables `.netra-reticle` pulse and all opacity tweens; cameraFocus jumps instantly | binding §4.4 |
| color contrast | TEAL ink on paper-base passes WCAG AA at 13.5px body, AAA at 9.5px meta given the bold-weight uppercase pairing (verify in QA: Algol Lighthouse audit) | – |
| narrative reason | coord-pin renders the `why` field in italic alongside coords — surveyed marks carry meaning, not just position. Screen reader reads coords + reason. | SBA-1 §summary item 4 |

---

## 13 · what this direction explicitly is NOT

- not a SaaS dashboard with a globe widget
- not a Three.js earth with stock textures and a UI bar
- not a decorative-globe-with-text-overlay landing page (I2 forbids)
- not a single-layer renderer with stratum toggles (v1.3 supersedes)
- not the chat surface — NETRA chat lives in a separate component family (TASK-52)
- not a final pixel-perfect mock — Sirius implements; this spec sets direction

---

## 14 · soul-gate trace — every visual decision

For Algol QA / Polaris audit. Each row of §4–§9 above carries a source citation. The following summarizes the soul-statement adherence per SBA-1 §summary:

| SBA-1 soul statement | how this direction adheres |
|---|---|
| 1. paper instrument containing surveyed archive | frame IS the page; globe is INSIDE it (§2) |
| 2. aged seeded paper grain with lat/lon contours | procedural 2048×1024 canvas with grain + grid baked (§4.1) |
| 3. three co-equal spatial systems visible through each other via transparency | surfaceGroup / axisGroup / orbitalGroup all mounted always; surface opacity 0.92 → spine reads through (§4) |
| 4. surveyed nodes at real GPS with narrative reasons | 7 archive nodes, `why` field surfaced in coord-pin (§5) |
| 5. mono uppercase 9px / 0.3em as instrument register | every label uses `.t-meta` rhythm (§8) |
| 6. NETRA as attached probe of the ATLAS instrument | console in frame-foot, voice strip below, RETICLE+RANGE live from RAF loop (§8.2–§8.3) |
| 7. motion that communicates state change | 1400ms travel · 220ms dim · 600ms body opacity · 2.4s reticle pulse · no decorative loops (§9) |
| 8. corner reticles, dashed hairlines, marginalia strip | corner-marks at frame · dashed at frame-head/foot · diverge-card micro reticles (§8) |
| 9. Cormorant italic for voice / mono for instrument / Special Elite for typewritten values | three roles never mixed (§8) |

**Forbidden patterns NOT introduced** (anti-dilution gate):

- no film-strip-as-frame-identity (out of scope for Globe; flagged elsewhere per SBA-1 §4 F3)
- no two-column SaaS search modal (out of scope; SBA-1 §4 F4)
- no floating chat surface decoupled from instrument console (TASK-52 future-scope)
- no mobile flat-text without paper-canvas / reticles (STANDBY card preserves them — §11)
- no toggleable stratum framings reintroduced (cameraFocus is camera-aid only — §7)

---

## 15 · open items flagged forward

These are NOT decisions to revisit in this iteration; they are next-step bookmarks.

1. **Photo-square glyph** (per attractor-binding §2.2 future): when photo entries ship, the surface marks for them become orange-stroked squares instead of circles. Halo follows glyph silhouette. — TASK-33
2. **Lineage edges** (ontology §4.3): dashed/dotted edge styles reserved for lineage relationships. Attractor edges deliberately use solid in v1 to leave that vocabulary free.
3. **AttractorFields component placement.** The prototype renders the pill row INSIDE the Globe right rail to demonstrate the binding. In production, AttractorFields ships as a separate component below the Globe per `journey-architecture.md`. The binding contract (§6) is the same in both placements. — Polaris-confirm before Sirius implements.
4. **Body-transparency modulation tuning.** 0.92 → 0.62 reads strong in the prototype. If Peat finds it too aggressive on review, the v1 dial is 0.92 → 0.75 (softer step-back, still legible network). 600ms timing stays.

---

## 16 · review checklist for Peat tonight

- [ ] Globe reads as paper instrument, not SaaS widget
- [ ] Three layers (surface / axis / orbital) all visible at rest
- [ ] Ne0N spine readable through poles (transparency)
- [ ] α node visually distinct (orange pulsing ring at Bangkok)
- [ ] Attractor pill click → orbital network edges visible
- [ ] Body steps back when attractor activates (0.92 → 0.62)
- [ ] NETRA console in frame-foot with reticle pulse + live RETICLE/RANGE
- [ ] NETRA voice strip updates with attractor state
- [ ] cameraFocus 1/2/3 keys frame surface/axis/orbit without hiding the others
- [ ] coord-pin shows narrative reason on jump
- [ ] palette is TEAL (main-branch active), not navy
- [ ] mobile fold (≤600px) shows STANDBY card with α + divergence + CTA

**Outcomes:**
- **LOCK** → iteration 2 (ATLAS frame + Hero coherence)
- **REVISE** → adjust per feedback, resubmit same TASK ID

---

*Betelgeuse · α-VIS-04 · TASK-2026-05-15-UI-1 · iteration 1 · 2026-05-15*

---

## 10 · Main-branch reconciliation (REVISE pass · 2026-05-15)

> appended after Peat verdict relayed by Polaris — *"ก็อปมาเป๊ะยันบัคเลย; ให้กลับไปเทียบกับ main branch UI"*
> companion · `.claude/visual-diffs/UI-ITER-1-globe-v1/MAIN-DRIFT-AUDIT.md` (full table)

### 10.1 the diagnosis

Iter 1 read as a high-fidelity port of v7. The v7 file is **soul baseline**, not the **shipping target**. The main-branch web (currently signed off and running) is the **living product baseline** per VISION-FIDELITY §1A. When v7 and main branch conflict, main branch wins by default — unless an evolution is explicitly Peat-locked and soul-deepening AND defensible.

The MAIN-DRIFT-AUDIT walks every section of `app/page.tsx` and every atom inside `components/WorldlineGlobe.tsx`, assigning verdicts of PRESERVE-MAIN, EVOLVE-V7, or BUG-INHERITED. Three bug-inherited rows were the largest leaks; five PRESERVE-MAIN rows were structural deficits.

### 10.2 adjustments applied in this pass

1. **D1 · globe procedural texture base** — replaced warm-olive `#A89E89 / #BAB099` (v7-inherited) with TEAL-compatible cool `#BDBBAF / #D2CFC4` (main-branch `components/WorldlineGlobe.tsx` line 267-270). The g2 inner tint already matched main-branch `rgba(70,95,108, 0.08)`. The innerShade mesh tint was bumped from `0xBFB69F` to `0xb4bbc0` (main-branch line 418).
2. **D2 · page-level scope** — added compact Nav strip, Hero tagrow + italic title + counts stack + compact divergence card, MarginaliaHUD vertical band on right edge, ScrollMeter top rail, page-level CornerMarks, and N floating badge bottom-left. The ATLAS frame stays the dominant artifact; the page chrome above and around it restores the cadence main branch ships.
3. **D3 · frame-head label** — `WORLDLINE · OBSERVATORY v.01` → `OBSERVATORY · WORLDLINE STRUCTURE v.08` (advances main-branch v.07, does not regress to a fresh-start framing).
4. **D4 · left-rail `§ CAMERA · ACTIVE` annotation** — restored the `atlas-current`-equivalent rhythm under the divergence-card. Reads cameraFocus, not stratum, because v1.3 ontology decouples camera from layer.
5. **D5 · narrow-viewport axis-label patch + divergence-card Nixie flicker** — axis-label background patch suppressed at ≤880px (was reading as a notch through the dashed rule); divergence-card-num now carries a lightweight per-digit flicker on a 3-7s interval matching `components/DivergenceMeter.tsx` line 70-87 (skipped under `prefers-reduced-motion`).
6. **150ms hover** — attractor pill border transition tuned from 250ms → 150ms to match main-branch Tailwind defaults.

### 10.3 evolutions retained (documented divergence from main, soul-deepening)

Six rows stay as EVOLVE-V7 with explicit justification:

| evolution | rationale | source |
|---|---|---|
| `STRATA · TRAVEL TARGETS` → `FRAMING · CAMERA-AID` | v1.3 ontology canon — buttons no longer toggle stratum visibility | binding §1.3a |
| `1 · NeX / 2 · Ne0N / 3 · Ne0` → `0 · REST / 1 · SURFACE / 2 · AXIS / 3 · ORBIT` | downstream of `FRAMING` rename | spec §7 |
| paperMat `transparent: false` → `transparent: true, opacity 0.92↔0.62` | Peat-locked transparency revealing Ne0N axis 2026-05-15 | SBA-1 §3 D3 / §summary item 3 |
| no attractor edges (main) → orbital network on activate | binding mechanic implemented per §2.1 + §3 | binding §2.1, §3 |
| coord-pin without `why` (main) → coord-pin WITH italic narrative reason | surveyed marks carry meaning | SBA-1 §summary item 4 |
| left-rail DivergenceMeter micro card kept | instrument-self-completeness for the Globe-isolation iter | v7 line 98; spec §8.7 |

### 10.4 flagged forward (not in this pass)

These rows are PRESERVE-MAIN but explicitly out of the Globe-direction scope:

- Full DivergenceMeter hero band (full-width, Nixie reroll on boot) — **iter 2** (ATLAS frame + Hero coherence)
- ChapterIndex grid — **iter 3**
- FooterManifesto — **iter 4**
- BootSequence — **iter ≥5**
- SurveyCursor — **iter ≥5**

### 10.5 acceptance trace

- [x] MAIN-DRIFT-AUDIT.md exists with row-per-section + verdicts (`.claude/visual-diffs/UI-ITER-1-globe-v1/MAIN-DRIFT-AUDIT.md`)
- [x] Prototype no longer inherits v7-specific warm-olive globe texture base
- [x] Palette matches main branch end-to-end (TEAL ink throughout; no navy leftover; cool globe procedural)
- [x] All 6 screenshots refreshed at the same paths
- [x] §10 documents the adjustments above
- [x] Density preserved — top 5 drift items closed; remaining items inventoried for iter ≥2

*Betelgeuse · α-VIS-04 · TASK-2026-05-15-UI-1 · iteration 1 · REVISE · 2026-05-15*
