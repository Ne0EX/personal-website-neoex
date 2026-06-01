# Globe Regression Reconciliation Matrix — 2026-06-01

Production-of-record: `components/WorldlineGlobe.tsx` blob `902ea50` (1933 lines),
identical on `genesis/orchestration-foundations` + `release/0.0.1-web`, CLEAN vs HEAD.
Verdicts verified by reading the named production lines. Default = PRESENT unless
absence is cited. "Good version" lives in the PROTOTYPE
`.claude/visual-diffs/UI-ITER-1-globe-v1/prototype/index.html` unless noted.

IMPORTANT framing: the production `.tsx` is NOT the prototype ported. It is an
independent React/Three.js implementation (functions `applyStratum`, `applySelected`,
`__atlasNetraJump`; no `selectArchiveNode`/`setText`/`MiniGlobe`). So the prototype's
AMEND fixes were authored in plain-JS prototype code that was never carried into this
component. Peat experiences this as regression; mechanism is non-port.

Verdict legend: PRESENT · REGRESSED (working in a shipped/main lineage, lost in prod)
· NEVER-PORTED (only ever in prototype/wrong-file) · PARTIAL (scaffold present, behavior absent).

---

## (A) Camera transitions / α-locus

| fix | what Peat wanted | GOOD version | prod 902ea50 status | verdict |
|---|---|---|---|---|
| Slerp arc (no through-globe) | Camera arcs over sphere surface, never dips inside (REVISE-4 frames 006/010/011 wash olive = camera inside BackSide); doc 17 | prototype L1891-1941 `setFromUnitVectors`+`slerp`, radius pinned 2.600; doc 17/18 | All 3 camera anims use straight `camera.position.lerpVectors(...)` (L1064 applyStratum, L1094 applySelected, L1336/L1367 jump). No slerp anywhere. Antipodal jumps cut a chord through r<1 | NEVER-PORTED |
| α-locus live world-pos target | Tracked target follows `globe.rotation.y`, not stale lat/lon (doc 18) | RW-5 AMEND-1/2 `mesh.getWorldPosition`; doc 18 | Jump dest from `cameraTrack(n.coords,…)`→`atlasPoint` which DOES read `refs.globe.rotation.y` (L954) — rotation-aware for the slerp dest. BUT after landing camera is static (no per-frame re-track unless `netraLockRef` set; fiction nodes set it null L1351) | PARTIAL |
| Slerp-drift seam snap (dual-assist FIX A/B) | No teleport at slerp tail (frame-mismatch: local slerp dest vs world drift anchor) | AMEND-5/6 dual-assist + Sirius FIX; `.claude/handoffs/from-betelgeuse/...amend-5-dual-assist`, `...amend-6-sirius-fix` | No drift system exists in prod, so the seam can't occur — but the underlying "camera follows rotating node" continuity is also absent | NEVER-PORTED (drift), N/A (seam) |
| Rotation-rate ease rest→surface | Spin ramps between framings, not snap (RW-5 AMEND-4) | prototype `setRotRate`/`_currentRotRate` 500ms ease | Rates are per-stratum constants in `tick()` (L1445/1450/1455/1458: .10/.04/.18/.02), switched hard on stratum change. No blend | NEVER-PORTED |
| Camera lookAt through globe (doc 17) | Documented root cause for the wash | docs/design/17 | `camera.lookAt(currentLook)`; on jump `currentLook` lerps toward a surface look-point (cameraTrack), not origin — so the documented through-globe path is mitigated for surface jumps but the chord-vs-arc position bug (row 1) remains | NEVER-PORTED (slerp) |

## (B) Coord / cursor display

| fix | what Peat wanted | GOOD version | prod 902ea50 status | verdict |
|---|---|---|---|---|
| Coord-pin shown ONLY on cursor-over-globe | α-LOCUS pin visible only while cursor over globe (asked 2026-05-26 + 2026-05-30; REVISE-WAVE-2 P0-3 predecessor) | AMEND-8 prototype onHover raycast adds/removes `is-show` | JSX L1771-1775: `{t.pinShow && (<div className="atlas-coord-pin is-show">…)}` — shown whenever stratum===neo, NEVER hover-gated. `onHover` (L1036-1043) sets ONLY `cursor` style; no add/remove of the pin. No `hovering` state at all in prod | REGRESSED→ effectively NEVER-PORTED (pin is stratum-gated, never cursor-gated) |
| Hide coord-pin on REST | No stale last-node pin at rest (REVISE-WAVE-2 P0-3) | prototype `setFocus` removes `show` on rest | Pin is bound to `t.pinShow` (true only in neo stratum), so it auto-hides outside neo — but is always on within neo regardless of cursor/selection | PARTIAL |
| NETRA coord earth-fixed | Lat/lon must not swim with globe rotation; from camera only (main commit 9344368) | prototype camera-only `__netraUpdate` | `netraCoordFromCameraPosition` (imported L16) used in tick; coord derived from camera, not surfaceGroup matrix. Earth-fixed intent preserved | PRESENT |
| NEXT NODE filters to active attractor | Cycle only within active-attractor members (REVISE-WAVE-2 P0-2) | prototype attractor pool filter | `__atlasNetraJump` (L1317) cycles full `jumpTargetsRef` (observer+entry+fiction), no attractor filtering. No `activeAttractor` concept in this component | NEVER-PORTED |
| Survey/triangulate custom cursor | Crosshair vs triangulate-on-interactive (REVISE-7, port of SurveyCursor.tsx) | prototype `#survey-cursor` IIFE; `components/SurveyCursor.tsx` exists | Globe sets only `cursor:"pointer"`/`""` on hover (L1042). No survey cursor wired in this component | NEVER-PORTED (in this component) |

## (C) Node system / colors / texture

| fix | what Peat wanted | GOOD version | prod 902ea50 status | verdict |
|---|---|---|---|---|
| Globe texture cool-teal base | Reconcile to main cool palette, no v7-warm-olive (REVISE-1) | prototype #BDBBAF/#D2CFC4 | `buildSurfaceTextures` L388-391 grad `#BDBBAF`/`#D2CFC4`; aging blotches cool `rgba(70,95,108,…)` L401; full procedural texture + real coastline | PRESENT |
| innerShade cool tint | Inner BackSide tint 0xb4bbc0 | prototype 0xb4bbc0 | L539 `color: 0xb4bbc0` | PRESENT |
| Line/material teal | All graticule/contour/axis ink teal 0x1f5063 | main 0x1f5063 | L544/581/603/678 all `0x1f5063`; accent-orange `0xd4602a` for α + poles | PRESENT |
| α node sizing (M4 sync) | α sphere 0.022, halo ring 0.034/0.044 (master gallery canonical) | spec §5.3 / master gallery | L722 `0.022`, L730 `RingGeometry(0.034,0.044,32)` — comments cite M4 sync | PRESENT |
| Node DOM single-owner / no-flicker | One DOM write per field per tick (REVISE-3B / REVISE-6) | prototype `setText` firstChild.nodeValue single owner | Prod uses `textContent` writes guarded by `!==` change-check (L1629/1637/1641) + React state for target name. No double-write path exists → no flicker to regress, but the `firstChild.nodeValue` re-mount-avoidance technique is absent | PARTIAL |
| Smooth text/coord swap (no snap) | `setTextSmooth` 180ms opacity fade on label/coord swap (REVISE-WAVE-3 D2) | prototype `setTextSmooth` | Absent; coord/range/cam written as instant `textContent` | NEVER-PORTED |

## (D) Mini-globe

| fix | what Peat wanted | GOOD version | prod 902ea50 status | verdict |
|---|---|---|---|---|
| Portable production mini-globe | Lightweight mini globe w/ single pin for nav/other pages | prototype mini + soul-factory mini | No `MiniGlobe` export in this file. (Backlog item per memory project_soul_factory; lives elsewhere if at all.) Not part of WorldlineGlobe | NEVER-PORTED (out of this file's scope) |

## (E) Drift / NETRA tracking

| fix | what Peat wanted | GOOD version | prod 902ea50 status | verdict |
|---|---|---|---|---|
| Orbital drift (tracking-not-freezing) | Camera enters continuous orbital relationship; tracks node without freezing (RW-5 base; critical for NeX/Orbital) | prototype `_applyOrbitalDrift` Axis A/B/C, Lissajous + per-stratum amps | NO orbital drift. After a jump, if `netraLockRef` is set, `softTrackCamera` (L987) damps camera toward a STATIC `cameraTrack` target each frame — a follow, not a Lissajous drift. NeX fiction jumps explicitly set `netraLockRef=null` (L1351) so camera is fully static post-slerp | NEVER-PORTED |
| Camera follows node as globe rotates | Tracked node stays centered, not drift out over 3-5s (RW-5 AMEND-2/3) | prototype live `_liveAnchorDir` from getWorldPosition | For Ne0 surface jumps: `setNetraLock`+`softTrackCamera` re-derive target via `cameraTrack`→`atlasPoint` (rotation-aware L954) each frame → node IS followed. For NeX fiction: no lock → NOT followed | PARTIAL |
| Tracking reticle + occlusion | Pulsing reticle at node world-pos; back-hemisphere markers/pin occluded (AMEND-1/3/9b) | prototype `_trackingReticleGroup`, `is-occluded`, limb-dot | `netraTracker` group (L743-758) ring+halo+dot, placed by `setTrackerMarker` at `latLonToVec(...,1.024)` — a tracker ring exists and is positioned. BUT it uses raw latLon (not getWorldPosition) and there is NO back-hemisphere occlusion/limb-dot test → back markers can show through | PARTIAL |
| Branch tendrils (NeX worldline branching) | Speculative-orbit tendrils on NeX nodes (30-worldline-branching.md) | spec §13.2 | Fully implemented in prod L1102-1296 + tick L1488-1599 (activate/deactivate, Lissajous breathing, Vega Q-F/Q-G voice). This subsystem PORTED | PRESENT |
| Smooth NETRA panel polish (D1/D3) | No reflow shake; tabular-nums; expand region (REVISE-WAVE-3) | prototype CSS + setTextSmooth | CSS lives in stylesheet (out of this .tsx). JS-side smooth-swap absent | NEVER-PORTED (JS side) |

## (F) Search / punch-list #4

| fix | what Peat wanted | GOOD version | prod 902ea50 status | verdict |
|---|---|---|---|---|
| Globe/site search | Type place/attractor/entry → SLERP to node; `/` focus, arrows, Enter jump, Esc clear; ranked; offline (pagefind) | `docs/team/VISION-2026-05-31-search-lineage-console.md`; `docs/design/14-triangulate-search.md` + `40-search-overlay.md`; `components/TriangulateSearch.tsx` + `TriangulateSearchPortal.tsx`; pagefind meta on FictionEntry L77-92 | A search subsystem EXISTS as separate components (TriangulateSearch / Portal) + pagefind meta tags are emitted on entries. NOT wired INTO the globe (no slerp-to-node from search). Globe component has zero search refs | PARTIAL (search exists; globe-integration NEVER-PORTED) |

---

## Verdict counts (rows scored on globe-relevant axis)
- PRESENT: 8
- PARTIAL: 6
- REGRESSED: 1 (coord-on-hover — counted as regressed because Peat had a working hover-gated pin in the prototype/PoC and the live globe shows it always-on)
- NEVER-PORTED: 9

Mechanism note: most losses are NON-PORT, not deletion — the production `.tsx` is an
independent implementation that never received the prototype's AMEND-1..9b motion work.
Palette, node colors, α sizing, earth-fixed coords, and the entire NeX branching
subsystem DID make it in, so the component is far from blank.

---

## PORT PLAN (ordered)

1. **Coord-pin cursor-over-globe gating** — owner Sirius (.tsx). Source: AMEND-8
   prototype onHover raycast. Add a `hovering` state; gate the L1771 `{t.pinShow && …}`
   to also require cursor-over-canvas; `onHover` (L1036) toggles it. Risk: LOW.
   Highest-recurrence ask (2026-05-26 + 2026-05-30 + REVISE-WAVE-2 P0-3). Smallest surface. Do first.
2. **Slerp arc camera path (no through-globe)** — owner Sirius (.tsx); spec Betelgeuse
   (docs/design/17). Source: prototype L1891-1941 + dual-assist FIX A. Replace the four
   `camera.position.lerpVectors` chords (L1064/1094/1336/1367) with `setFromUnitVectors`+
   `slerp` radius-pinned. Risk: MED (core tween). Unblocks search slerp reuse (#6).
3. **Orbital drift + live-anchor follow for NeX/fiction** — owner Sirius (.tsx); spec
   Betelgeuse. Source: RW-5 base + AMEND-1/2/3 + dual-assist (freeze-during-slerp + FIX A).
   Fiction jumps currently leave camera static (L1351 null lock). Risk: HIGH (state
   machine; coordinate-frame seam was the AMEND-5/6 trap). Critical for NeX/Orbital.
4. **Back-hemisphere occlusion + world-pos tracker** — owner Sirius (.tsx). Source:
   AMEND-1/3/9b. `netraTracker` exists but uses raw latLon and has no limb-dot occlusion.
   Risk: LOW-MED.
5. **Rotation-rate ease + smooth text swap (setTextSmooth) + attractor-pool filter +
   REST pin hide** — owner Sirius (.tsx). Source: AMEND-4, REVISE-WAVE-3 D2,
   REVISE-WAVE-2 P0-2/P0-3. Risk: LOW. Polish bundle after 1-4.
6. **Wire search INTO the globe** — Procyon (index over nodes+entries; pagefind meta
   already emitted), Canopus (pagefind build wiring into Next), Sirius (.tsx: accept a
   target node from TriangulateSearch and reuse #2 slerp). Source:
   docs/team/VISION-2026-05-31-search-lineage-console.md + components/TriangulateSearch*.
   Risk: MED. Depends on #2. Survey/triangulate cursor (REVISE-7) optional polish here.
