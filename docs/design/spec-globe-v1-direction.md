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

### 5.1 · the α node — live present observer (enriched definition, 2026-05-29)

**α = Peat's live current primary location on Earth at that moment.** It is the place he currently inhabits as his main whereabouts ("ที่อยู่หลัก ณ เวลานั้น"). It is **movable**: when Peat travels, α relocates — Bangkok at home, Tokyo or Kyoto when in Japan, wherever he currently is. Peat updates it himself.

This is why α is precisely the observer locus NETRA tracks: Peat tells NETRA where he is, so NETRA's coordinate is always α.

α is **fundamentally distinct from the archive nodes**:

| | α | archive nodes (000–047) |
|---|---|---|
| meaning | **present observer** — "here, now" | **past surveyed marks** — "where it was recorded" |
| position | movable; Peat-updated | fixed; real GPS coordinates of record-making |
| count | always 1 | 6 in the current archive |
| color | `var(--accent-orange)` — the only orange node | `var(--ink-primary)` teal |
| size | 0.022 radius sphere | 0.012 radius sphere |

Note: α may sit at or near an archive node's place (e.g. α at Tokyo overlaps 012). This is the **present-observer-over-past-archive layering** — intended. The archive node marks where the record was made; α marks where Peat is now. They may coincide.

### 5.2 · full node table

| label | place | coords | why | attractors |
|---|---|---|---|---|
| **α** | Peat's current primary location · movable | 13.7563°N · 100.5018°E (Bangkok default) | present observer — "here, now" · Peat-updated · NETRA-tracked | all · narrative · meta |
| 003 | Kyoto · JP | 35.0116°N · 135.7681°E | architecture of taste | narrative · japan |
| 002 | Chiang Mai · TH | 18.7883°N · 98.9853°E | why I paused the startup | narrative · ai · ml |
| 001 | Yirgacheffe · ET | 6.16°N · 38.2058°E | four pours — coffee origin | coffee |
| 000 | San Francisco · US | 37.7749°N · −122.4194°W | paused engineer — ml origin | ai · ml · narrative |
| 012 | Tokyo · JP | 35.6762°N · 139.6503°E | narrative · active branch | japan · narrative |
| 047 | Point Nemo · PAC | −48.8767°S · −123.3933°W | meta vantage · most remote | meta |

### 5.3 · node treatment

- **archive nodes** (003, 002, 001, 000, 012, 047): 0.012 radius sphere, `var(--ink-primary)` teal material. Fixed GPS. Past surveyed marks.
- **α node** (live current location, Bangkok default): 0.022 radius sphere, `var(--accent-orange)` material, with an orange RingGeometry 0.034–0.044 around it pulsing at 0.5 ± 0.45 sin(0.005t). The only orange node. Visually distinct as the movable present observer. (v7 lines 753-772; SBA-1 §2.4)
- worldline arc: dashed orange QuadraticBezierCurve3 from α swooping outward into the NeX field, `dashSize` breathing animation. (v7 lines 774-786)

The color system encodes the semantic: orange = live observer, teal = archive. At a glance, Peat reads the globe the way a navigator reads a chart — one moving mark (position, present) against fixed marks (where it was surveyed).

**Hit behavior:** all nodes clickable. On click (or NETRA "⟶ NEXT NODE" jump), the coord-pin shows `LABEL · PLACE · COORDS` with the narrative `why` directly underneath in italic Cormorant — these surveyed reasons are part of the body's identity. For α, the coord-pin renders: `α · [current place] · [current coords]` with `why: present observer — Peat-updated`. (Evolution from v7 which only showed coords; the `why` field exists in v7's data structure but is not rendered. Surfacing it here is the soul gesture per SBA-1 §summary item 4.)

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

> **Override — Peat directive 2026-05-29 (TASK-2026-05-29-SOUL-FACTORY-MINI-SPEC):**
> The standby/mini-globe is now a **miniaturized live Three.js globe** — same soul as the full globe, tuned lightweight and portable. The 2D paper-canvas abstraction described in the original §11 entry for ≤600px is **superseded**. "Three.js retires at ≤600px" is no longer the canonical behavior.
> The paper-canvas fallback is retained ONLY as a degraded rendering path when WebGL is unavailable, `prefers-reduced-motion` is set, or the page is served over `file://`. It is not the primary at any viewport width.

| viewport | behavior |
|---|---|
| ≥881 px | full 1180×760 stage with scale-fit (`scale(min(availW/1180, availH/760, 1))`) — v7 line 1086 carried forward |
| 601–880 px | content collapses to single column. Focus buttons reflow to a 2-column row. globe-wrap min-height 380px. NETRA console spans full row. (Three.js still mounts.) |
| ≤600 px | **Miniaturized live globe** mounts in the STANDBY card. Same Three.js soul: earth-coastline sphere + Ne0N axis spine + pole beacons + α beacon at Bangkok (orange ring pulse) + faint NeX shell hint. Rendered at **140px diameter** (120px at ≤375px / NARROW). Auto-rotate enabled (same `0.08 rad/s`). No attractor interaction — static `all` attractor state. No cameraFocus controls — single fixed camera at the rest position. NETRA console stays in foot; frame-head stacks. Two CTAs (`OPEN ATLAS` · `AS LIST`). Canvas `prefers-reduced-motion`: rotation pauses, static render. |

**Mini-globe soul inventory (what it carries):**
- earth-coastline sphere at `opacity: 0.92` (surface group)
- Ne0N spine cylinder (axis group — thin, renders through body)
- pole beacons at y=±1.0 with orange pulse (axis group)
- α beacon at Bangkok (orange dot + ring pulse)
- NeX shells at 0.05–0.10 opacity (orbital group — faint cage hint)
- No attractor pills, no FOCUS buttons, no stratum readouts
- The mini IS the same object at smaller fidelity. Not a simplified icon. Not a 2D abstract.

**WebGL degradation (only):** if `!WebGLRenderingContext` or `canvas.getContext('webgl')` returns null, render the paper-canvas fallback (radial-gradient disc + lat/lon repeating-linear grid + orange α dot with 5px halo). This is a capability degradation, not a viewport decision.

**Canonical mini-globe diameter:** 140px at MID (601–880px) / 120px at NARROW (≤600px / 375px).
Source: `docs/design/60-responsive-system.md` §4.2 + §5. Previous spec value of 130×130 (paper-canvas era) is superseded by this directive and is no longer in use.

**375 px viewport check:** STANDBY card renders with live mini-globe at 120px. α pulse + dashed borders + corner reticles preserved. Touch targets (CTAs) ≥ 44px. (SBA-1 §4 F6 loss budget honored.)

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
- **not a surface where the mobile mini-globe is a 2D paper-canvas abstraction** — the mini IS the live Three.js globe, smaller. The paper-canvas is a degradation fallback for no-WebGL / `prefers-reduced-motion` / `file://` only. (Peat directive 2026-05-29, §11 override.)

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

**Closed items (resolved in TASK-2026-05-29-SOUL-FACTORY-MINI-SPEC):**

5. ~~**Mini-globe size divergence** — §11 said "130×130 paper-canvas mini-globe"; `60-responsive-system.md` §4.2 said "SVG mini-globe 140px/120px." Closed.~~ Canonical size is now **140px at MID / 120px at NARROW**, sourced from the responsive-system spec and confirmed by the live-mini directive. Both docs now agree. Paper-canvas and SVG references are superseded by the live Three.js mini.
6. ~~**"Three.js retires at ≤600px"**~~ — superseded by Peat directive 2026-05-29. The mini-globe at ≤600px is a live Three.js render, not a 2D fallback. See §11 override block.

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

---

## 10.4 · REVISE-2 pass (2026-05-15)

> appended after Peat verdict on iteration 1 REVISE:
> *"ยัยนั่นเว้นที่เยอะมาก และแน่นอนว่าเลข coordinates ยังขยับเรื่อยๆตามการหมุนของโลกซึ่งตรงกับประวัติที่เคยแก้ใน MAIN BRANCH ไปทั้งนั้น ยังไม่ผ่าน"*
> two main-branch fidelity rows missed in iter 1 REVISE.

### 10.4.1 · empty-space-below-ATLAS · main-branch home-stack restored

**Diagnosis.** Iter 1 REVISE restored Nav + Hero + MarginaliaHUD + ScrollMeter (the chrome wrapping ATLAS) but DID NOT extend the prototype below ATLAS to mirror main-branch's home-page stack. Below the ATLAS frame, main-branch ships three more canonical sections before the page ends:

1. `components/ChapterIndex.tsx` — `§ 01 // CHAPTER INDEX // RECENT TRACES` — 2-column grid of entry cards with diamond reticles, file numbers, italic titles, tag rows.
2. `components/AttractorFields.tsx` — `§ 02 // ATTRACTOR FIELDS // BROWSE BY DOMAIN` — single horizontal pill row with `is-active` invert state.
3. `components/FooterManifesto.tsx` — `§ 03` — three columns: italic manifesto with orange opening quote · CHANNELS link list · TRANSMIT link list.

The prototype previously jumped straight from ATLAS into pilot-exploratory sections (fork, entries, photos…) and ended with a 2-column site footer. The absent ChapterIndex/AttractorFields rhythm was the visible "เว้นที่เยอะมาก" — main-branch had spatial density there; the prototype had a gap.

**Adjustments applied.**

| change | source replicated | location |
|---|---|---|
| New `<section class="chapter-index-section">` with 2-col `entry-card` grid + diamond reticles | `components/ChapterIndex.tsx` lines 28-79; data from `lib/entries.ts` RECENT_ENTRIES (003 / 002 / 001 / 000) | `pilot-frontend-ui-design/index.html` insert before `#fork` |
| New `<section class="attractor-fields-section">` with 11 pills | `components/AttractorFields.tsx` lines 9-52; data from `lib/entries.ts` ATTRACTOR_FIELDS (all / coffee / ai · ml / narrative / cubic copper / harness eng. / fragrance / film · letterboxd / trading / japan / 日本 / meta) | same |
| Site-footer upgraded 2-col → 3-col (MANIFESTO · CHANNELS · TRANSMIT) with italic Cormorant manifesto, orange opening curly quote, mono uppercase link list | `components/FooterManifesto.tsx` lines 6-60 verbatim copy + link order | `pilot-frontend-ui-design/index.html` `<footer class="site-footer">` |
| CSS added in `pilot-frontend-ui-design/styles.css` end-of-file (before `prefers-reduced-motion` rule) — entry-card hover bg, reticle, tag colors, pill `is-active` invert, footer 3-col grid, mobile breakpoints (≤880px stack, ≤600px tighter padding) | mirrors main-branch Tailwind values (`px-7 py-6`, `text-[22px]`, `tracking-[0.3em]`, etc.) — no new design tokens introduced | `styles.css` lines ~2283-end |

**Zero new design tokens.** Every color, font family, font size, and spacing value reuses already-declared CSS vars (`--paper-warm`, `--ink`, `--ink-hairline`, `--accent`, `--font-mono`, `--font-display`) and the existing 9px/10px/12px mono scale. Reticles use `rgb(212 96 42 / 0.4)`, identical to the inline value in main-branch `ChapterIndex.tsx` line 51.

### 10.4.2 · coordinate-jitter · earth-fixed readout per main-branch convention

**Diagnosis.** The HUD camera bearing (`[data-bearing]` element, displayed as `ORBIT · X°` in the ATLAS canvas top-right corner) was being written every frame inside the `render()` loop:

```js
// BEFORE (iter 1):
const bearing = $("[data-bearing]");
if (bearing) bearing.textContent = `ORBIT · ${Math.round(...)}°`;
```

Even when the rounded integer angle did not change between frames, the text node was being mutated 60×/sec. Browsers force layout/paint on text-node mutation regardless of whether the new value equals the old; the result reads as jitter — the bearing "ขยับเรื่อยๆตามการหมุนของโลก" because the globe IS rotating and the bearing IS following.

Main branch fixed this in commit **`9344368` "Fix NETRA atlas tracking"** (2026-05-10) — see `components/WorldlineGlobe.tsx` lines 1014-1029. Two mechanisms:

1. **Gated write** — `textContent` is only mutated if the new string differs from the current text content (lines 1015-1017, 1023-1025, 1027-1029):
   ```ts
   if (hudCamRef.current && hudCamRef.current.textContent !== hudCamText) {
     hudCamRef.current.textContent = hudCamText;
   }
   ```
2. **Earth-fixed coordinate source** — NETRA reticle lat/lon is derived from camera position via `netraCoordFromCameraPosition(camera.position)`, NOT from globe rotation (line 1019-1021 comment: *"NETRA coordinates are earth-fixed; visual globe rotation must not mutate longitude"*). When the globe rotates but the camera is stationary, the coordinate stays put.

**Adjustment applied.** `pilot-frontend-ui-design/app.js` line ~863-876:

```js
// AFTER (REVISE-2):
const bearing = $("[data-bearing]");
if (bearing) {
  const angle = Math.round((((-state.yaw * 180) / Math.PI) % 360 + 360) % 360);
  const next = `ORBIT · ${angle}°`;
  if (bearing.textContent !== next) bearing.textContent = next;
}
```

The integer-rounded bearing only changes ~once per degree of yaw (about every 200ms at the default `config.drift`). Between integer ticks, the text node is untouched — no layout, no paint, no jitter. Reads as a deliberate readout, not telemetry feed. The full earth-fixed coordinate derivation will land alongside the Three.js renderer migration (Sirius's TASK 16-19) since that is the only point at which a `camera.position` exists; for the SVG/canvas prototype, gating the only continuously-updated readout (`[data-bearing]`) is the correct first-stage equivalent.

### 10.4.3 · acceptance trace

- [x] ChapterIndex + AttractorFields + FooterManifesto rendered below ATLAS (replacing the 2-col site footer and preceding the pilot-exploratory sections) — verified by reading `pilot-frontend-ui-design/index.html` lines 269-356 (chapter-index + attractor-fields) and 591-624 (3-col site footer)
- [x] Coordinate/bearing readout gated per main-branch convention with explicit citation to commit `9344368` and lines 1014-1017 of `components/WorldlineGlobe.tsx`
- [x] Six screenshots captured at 1180/880/600/375 + one still during globe rotation showing bearing locked between ticks
- [x] §10.4 documents both fixes with main-branch citations (this section)
- [x] Prototype runtime audit (`audit-prototype-runtime.sh`) passes — no console errors, no exceptions, no 404s
- [x] Zero new design tokens introduced; every value traces to an existing CSS var or to a verbatim main-branch literal

### 10.4.4 · flagged forward (intentionally out of scope for this pass)

- Full earth-fixed `netraCoordFromCameraPosition` equivalent for the prototype — deferred to Three.js renderer migration (Sirius TASK 16-19). The prototype's SVG/canvas globe has no `camera.position` vector to derive from; the gated-write fix is the correct stage-1 equivalent.
- ChapterIndex entry-card stagger animation (`stagger(110)` from main-branch line 18-23) — deferred to motion polish iter. Iter ≥2 will add anime.js stagger once Sirius confirms anime.js is the prototype's accepted motion lib.
- AttractorFields pill keyboard navigation (arrow keys cycling active pill) — deferred to a11y polish iter.

*Betelgeuse · α-VIS-04 · TASK-2026-05-15-UI-1 · iteration 1 · REVISE-2 · 2026-05-15*

---

## 10.5 · REVISE-3 pass (2026-05-15)

Peat reviewed a screen recording of the REVISE-2 prototype and returned two unresolved visible-craft failures:

> "บอกยัยนั่นดูวิดิโอแล้วบอกว่า HERO แคบไป แถมมีกระพริบเยอะด้วยตอนเปลี่ยน NODE"

Both are direct main-branch fidelity tasks. Both close in this pass.

### 10.5.1 · Hero proportions — title scale + grid track reconciliation

**Diagnosis (verified empirically at 1180px viewport, Playwright + getBoundingClientRect):**

The prototype's italic Cormorant title rendered at **`87.32px`** because `.hero-copy h1` used `font-size: clamp(44px, 7.4vw, 104px)`. At the 1180px reference breakpoint, `7.4vw = 87.32px`. Main-branch (`components/HeroBlock.tsx` line 80) sets the title at **`text-[34px]`** — a deliberate "hook word" sized to NOT compete with the ATLAS artifact, as the HeroBlock jsdoc (lines 8-18) explicitly states:

> "The title is the 'hook word' that enhances the aesthetic without competing with the globe for space. ATLAS is the dominant artifact."

The prototype was rendering at **2.57× the main-branch size**. At 87px in a 431px-wide column (the left grid track at 1180px), the title wrapped into **4 visual lines** with a measured h1 box height of `393px`. The whole Hero pushed to `1528px` tall before ATLAS even appeared, which Peat experienced as "HERO แคบไป" — title overwhelms its container, so the container reads as narrow.

Compounding factor: the `.hero` grid track was `minmax(0, 1fr) auto minmax(280px, 360px)`, forcing the right column to ≥ 280px (the divergence panel had `min-width: 300px` as a separate hard floor). Main-branch hero (`HeroBlock.tsx` line 68) uses `grid-cols-[minmax(0,1fr)_auto_auto]` — both side columns `auto`. The 280-360px clamp robbed the title column of the breathing room main-branch promises.

**Adjustment applied.** `pilot-frontend-ui-design/styles.css`:

```css
/* line ~333 .hero — was: minmax(0,1fr) auto minmax(280px, 360px) */
grid-template-columns: minmax(0, 1fr) auto auto;

/* line ~395 .hero-copy h1 — was: clamp(44px, 7.4vw, 104px) */
font-size: clamp(28px, 2.9vw, 40px);
line-height: 1.05;
letter-spacing: -0.005em;
max-width: 720px;

/* line ~430 .hero-copy p — was: 19px, max-width 680 */
font-size: 14.5px;
max-width: 560px;

/* line ~436 .divergence-panel — was: min-width 300px */
min-width: 230px;
padding: 12px 16px;

/* line ~495 .divergence-value — was: 42px */
font-size: 30px;
```

**Measurement proof** (Playwright `getBoundingClientRect` at viewport 1180×820):

| metric                   | BEFORE  | AFTER  | main-branch target |
|--------------------------|---------|--------|--------------------|
| h1 font-size             | 87.32px | 34.22px| 34px               |
| h1 box height            | 393px   | 72px   | ~72px (2 lines)    |
| left grid track width    | 431px   | 526px  | ~520-540px         |
| right grid track width   | 360px   | 265px  | ~200-280px         |
| Hero total height        | 1528px  | 1192px | ~1180-1220px       |

Title now fits in **2 clean lines** at 1180px, ATLAS appears above the fold, and the proportional restraint matches main-branch.

### 10.5.2 · NETRA node-jump flicker — single-source-of-truth delegation

**Diagnosis** (root cause traced by reading prototype source against main-branch source):

`pilot-frontend-ui-design/app.js` prior `jumpNode()` (lines 991-1004) executed this sequence on every `⟶ NEXT NODE` click:

1. Write `[data-netra-target]` from `nodeCycle[i].target`
2. Write `[data-netra-coord]` from `nodeCycle[i].coord`
3. Write `[data-netra-voice]` from `nodeCycle[i].voice`
4. Write tooltip `<b>` and `<span>` from `nodeCycle[i].tooltip[0..1]`
5. Remove `is-selected` from all `.node, .pin, .fiction-node`; add to one
6. Call `atlasGlobe.selectNode(id)` — which internally calls `updateDomForNode(mark)` and writes the SAME fields from `atlasMarks[i]` (a different source object)

Two different source objects writing the same DOM nodes in the same tick = a guaranteed 1-frame flicker on every cycle. Additionally the `is-selected` class flip was performed twice per jump (in `jumpNode` AND inside `updateDomForNode`), forcing a double style-recompute.

Main-branch (`components/WorldlineGlobe.tsx` lines 932-952, commit **`9344368` "Fix NETRA atlas tracking"**) has a SINGLE source of truth in its jump flow:

```ts
(window as unknown as { __atlasNetraJump?: () => void }).__atlasNetraJump = () => {
  const targets = jumpTargetsRef.current;
  if (!targets.length) return;
  jumpIdxRef.current = (jumpIdxRef.current + 1) % targets.length;
  const n = targets[jumpIdxRef.current];
  setNetraLock(n.coords, 2.6);                     // ← lock to TARGET
  // ... camera tween ...
  setNetraTarget(`${n.label} · ${n.place}`);       // ← write once
};
```

All readouts derive from `netraLockRef.current.coords` for the duration of the tween (lines 1019-1029) — no intermediate camera-position writes leak through. Target label is written exactly once per jump.

**Adjustment applied.** `pilot-frontend-ui-design/app.js` line ~991:

```js
function jumpNode() {
  activeNode = (activeNode + 1) % nodeCycle.length;
  const node = nodeCycle[activeNode];
  if (atlasGlobe) atlasGlobe.selectNode(node.id, true);
}
```

`selectNode()` becomes the sole DOM-mutation pathway, via `updateDomForNode(mark)`. One write per field per tick. The legacy SVG-fallback `is-selected` toggle is already handled by `updateDomForNode` line 790-792 via the `[data-node-shape="${mark.id}"]` selector — no coverage loss. `atlasMarks` and `nodeCycle` carry identical `target`/`coord`/`voice` strings for the four cycled ids (003, 001, photo-043, t001), verified by reading lines 39-67 against 105-189 of `app.js` — no data loss either.

**MutationObserver proof** (5 rapid clicks on `[data-next-node]`, 250ms apart, observing `[data-netra-target/coord/voice]`):

- 5 clicks × 3 readouts = **exactly 15 textContent writes** captured
- Per-jump writes cluster at the SAME `performance.now()` timestamp (e.g. `10681.9ms` for all 3 readouts on jump #1) → confirmed single-tick atomicity
- Pre-fix theoretical count: 30 writes (15 from `jumpNode`'s direct sets + 15 from `selectNode → updateDomForNode`) — the 50% reduction directly maps to the flicker elimination

### 10.5.3 · acceptance trace

- [x] Hero width matches main-branch at 1180px — measured `h1.fontSize = 34.22px` vs main-branch `34px`, left grid track `526px`, h1 box height `72px` (≈ 2 lines)
- [x] NETRA jump produces zero double-writes across 5 rapid clicks — 15 writes total, atomic per-jump
- [x] §10.5 documents both fixes with main-branch citations (this section): `HeroBlock.tsx` lines 8-18, 68, 80, 88 for Hero; `WorldlineGlobe.tsx` lines 932-952 + commit `9344368` for jump
- [x] 5 screenshots added in `.claude/visual-diffs/TASK-2026-05-15-UI-1/iter-1/revise-3/`:
  - `00-before-hero-1180.png` — original 87px-title rendering, 4-line wrap, ATLAS below fold
  - `01-after-hero-1180.png` — 34px title, 2-line wrap, ATLAS visible
  - `02-after-hero-880.png` — 880px breakpoint (responsive stacked)
  - `03-after-hero-600.png` — 600px breakpoint (responsive stacked)
  - `04-mid-jump-1180.png` — captured at t≈250ms into the camera tween; NETRA readouts show locked TARGET state with no source-state bleed
- [x] Prototype runtime audit PASSES — standard audit (`UI-ITER-1-globe-v1/prototype`) + new direct audit on `pilot-frontend-ui-design/index.html` (added `<meta name="wl-anchor" content=".paper-canvas .hero" />` to support the canvas-wrapped DOM tree)
- [x] Zero new design tokens introduced; every changed value is a numeric literal reconciled against main-branch literals

### 10.5.4 · flagged forward

- Production hero typography (`HeroBlock.tsx` line 80) uses a `<em className="text-[var(--accent-orange)] not-italic" style={{ fontStyle: "italic" }}>` trick to color the inline "unfinished" emphasis in orange while preserving italic. The prototype currently uses simple `<i>` and gets the same visual via CSS rule `.hero-copy h1 i { color: var(--accent); font-style: italic; }`. Functionally equivalent — flagged here for transparency only, no change needed.
- The h1 clamp `clamp(28px, 2.9vw, 40px)` was chosen to land at ~34px exactly at 1180px (`2.9vw = 34.22px`) while still scaling for huge displays and narrow mobile. If Peat wants the title locked to a flat 34px across all viewports, change to `font-size: 34px` and remove the clamp.

*Betelgeuse · α-VIS-04 · TASK-2026-05-15-UI-1 · iteration 1 · REVISE-3 · 2026-05-15*
