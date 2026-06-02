# docs/design/17-globe-motion-fixes.md
# ATLAS Globe — Motion Correction Spec
# authored · Betelgeuse · α-VIS-04 · 2026-05-31

---

## intent

The ATLAS globe is a surveyed paper instrument, not a simulation. When its camera
moves it should feel like a cartographer lifting a reading glass across the surface
of the world — weight, arc, commitment. Right now it cuts through the globe like a
line through paper. The drag is stiff and drops on touch. The α-locus pins to the
wrong coordinate when the globe has already rotated. Three fixes. No new atoms.

---

## ISSUE 1 · α-LOCUS PIN DRIFT — stratum Ne0 targets stale globe-local coordinates

### soul description

When the observer presses 1 to enter Ne0 · ARCHIVE, the camera should arrive
directly over Bangkok — 13.7563°N, 100.5018°E — the α coordinate, the observer's
locus. This is the one point on the globe that has meaning beyond geography. The
camera landing anywhere else is an instrument reading incorrectly.

### root cause (confirmed at source)

`STRATA.neo.camPos` is evaluated once at module load via
`latLonToVec3(ALPHA_LAT, ALPHA_LON, 2.05)` (L276). That call returns globe-local
coordinates assuming `rotation.y = 0`. By the time the user presses 1, the globe
has rotated (auto-rotation at 0.10 rad/s in "all" stratum, L1445). `applyStratum`
clones `T.camPos` directly (L1057) without accounting for `refs.globe.rotation.y`.
The `atlasPoint()` helper at L954 correctly calls
`globeSurfacePointAtRotation(lat, lon, refs.globe.rotation.y, radius)` — the same
correction must be applied to the Ne0 target.

### desired behavior

At the moment `applyStratum('neo')` is called, recompute both `endPos` and
`endLook` using the globe's current `rotation.y`. The target is:

```
endPos  = globeSurfacePointAtRotation(ALPHA_LAT, ALPHA_LON, refs.globe.rotation.y, 2.05)
endLook = globeSurfacePointAtRotation(ALPHA_LAT, ALPHA_LON, refs.globe.rotation.y, 1.0)
```

STRATA.neo.camPos remains the static definition (used as the fallback shape), but
is never cloned directly inside `applyStratum`. It is replaced with the live
computed value for the `neo` stratum only.

Other strata (all, nex, neon) use camera positions not tied to globe-surface
lat/lon and are unaffected.

### timing

Duration: 1400ms — top of the camera motion bucket (700–1400ms). The Ne0 entry is
a deliberate act of orientation; the longer end of the range is correct. No change
to the existing `dur = 1400` at L1059.

### acceptance criteria

1. Enter "all" stratum; wait at least 3 seconds (globe has rotated ~0.3 rad).
   Press 1. The camera's final `lookAt` target must lie within 0.03 world-units of
   `globeSurfacePointAtRotation(13.7563, 100.5018, refs.globe.rotation.y_at_keydown, 1.0)`.
   Log `camera.lookAt target` and the computed value; diff must be < 0.03.

2. Repeat from neon stratum (different starting rotation). Same tolerance.

3. Static test (rotation.y = 0): `endPos` must equal `latLonToVec3(13.7563, 100.5018, 2.05)`
   exactly (rotation correction of 0 = identity).

4. `STRATA.neo.camPos` (module-level constant) must NOT be mutated; it remains
   the unrotated globe-local definition. The correction is applied inside
   `applyStratum` at call-time only.

---

## ISSUE 2 · DRAG FEEL — friction, drop, no inertia

### soul description

Dragging the globe should feel like pressing a thumb to a heavy orrery — initial
resistance, then it picks up, continues a beat after the thumb lifts. Right now
it stops dead on release. On touch it frequently drops mid-gesture because the
browser claims the scroll. The instrument does not move like a surveyed archive; it
moves like a broken slider.

### root cause (confirmed at source)

Four compounding failures:

- `dx * 0.005` at L1007: 0.5% per pixel = 200px drag for 1 radian. A natural
  thumb swipe across a phone screen is ~80–120px and should rotate the globe ~60°.
- No `touch-action: none` on `.atlas-globe-wrap canvas` (L566–569 globals.css).
  Browser claims vertical gestures for scroll, fires `pointercancel`, kills the
  drag before `onUp` can run.
- No velocity tracking or momentum. On `pointerup` (L1011), `dragging = false`
  and nothing else. The globe stops instantly.
- No horizontal-axis gating. `onMoveDrag` reads `clientX` only (L1002), ignoring
  `clientY`. A slight vertical finger movement before the browser can claim it
  starts a drag that then gets cancelled — the user feels a ghost rotation then
  a drop.

### desired motion

**Sensitivity** — `dx * 0.012`. A 100px drag = ~69° rotation at GLOBE_RADIUS.
Feels responsive on desktop mouse. On mobile (5–8px per 16ms frame = 0.06–0.10
rad/frame) the globe tracks the thumb without lag.

**Touch-action** — `touch-action: none` on the canvas element (CSS only).

**Momentum / inertia** — on `pointerup`, carry the last-frame angular velocity
forward with exponential decay. Decay coefficient 0.92 per frame at 60fps
(half-life ~11 frames, ~180ms). Stops feeling active after ~400ms.
Pseudo-code for the tick loop:

```
// on pointerup:
dragVelY = lastDragDeltaX * 0.012; // rad/frame at 60fps

// in tick(), when !dragging:
if (Math.abs(dragVelY) > 0.0001) {
  baseRotY += dragVelY;
  dragVelY *= 0.92;          // decay per frame
  refs.globe.rotation.y = baseRotY;
}
```

Auto-rotation (`dt * 0.10` in "all", L1445) must re-engage only when
`Math.abs(dragVelY) < 0.0002`, to prevent fight between momentum and auto-spin.

**Horizontal gating** — on `pointerdown` (L995), record both `lastX` and `lastY`.
Do not set `dragging = true` immediately. In `onMoveDrag`, wait until
`Math.abs(dx) > Math.abs(dy) + 4px` before committing to drag mode. Once
committed, ignore subsequent dy. This prevents accidental scroll during approach.

### timing

Inertia decay half-life: ~180ms (0.92^11 at 60fps). Total coast-to-stop: ~400ms.
This is below the camera motion bucket minimum (700ms) — drag inertia is not a
camera transition, it is a physical response. No axiom conflict.

### acceptance criteria

1. **Sensitivity** — a single horizontal swipe of 100px (desktop mouse) must
   rotate the globe ≥ 60° and ≤ 75°. Measure `refs.globe.rotation.y` before and
   after. Pass: `|Δrot| ∈ [1.047, 1.309]` radians (60°–75°).

2. **Touch drop** — on a 375px viewport, perform a pointerdown + 80px horizontal
   pointermove + pointerup sequence via synthetic events. `dragging` must still be
   `true` at pointermove end and `false` only after pointerup. No `pointercancel`
   must fire if `touch-action: none` is applied (browser must not claim the gesture).

3. **Inertia** — after pointerup with `lastDragDeltaX = 10px`, measure
   `refs.globe.rotation.y` at t+16ms, t+200ms, t+400ms. The value at t+400ms must
   be greater than at t+16ms (still rotating) and the delta t+200ms → t+400ms must
   be less than delta t+0ms → t+200ms (decelerating).

4. **Horizontal gate** — synthetic pointerdown + pointermove of `{dx:3, dy:15}`
   must NOT commit drag (`dragging` remains pre-commit state). Then `{dx:10, dy:3}`
   must commit drag.

5. **Auto-rotation re-engage** — after momentum coast-to-stop (|dragVelY| < 0.0002),
   globe must resume auto-rotation within 1 tick (≤ 17ms). No hard cut — the
   transition from momentum to auto-rotation should not produce a visible velocity
   discontinuity (|auto_rot_step - last_momentum_step| < 0.003 rad/frame).

---

## ISSUE 3 · CAMERA PATH — chord through globe, not arc over surface

### soul description

When the camera travels between any two positions on or near the globe — stratum
entry, pin focus, NETRA jump — it should feel like a satellite tracing the sky.
The horizon curves away as it moves. Halfway through a long journey the camera is
at its most distant from the center, not closest. Right now the camera dives
through the earth at the midpoint of any long transition. The instrument reads a
chord when it should read an arc.

### root cause (confirmed at source)

All four animation sites use `THREE.Vector3.lerpVectors(startPos, endPos, e)`:

| site             | lines       | duration |
|------------------|-------------|----------|
| applyStratum     | L1064–1065  | 1400ms   |
| applySelected    | L1094–1095  | 1100ms   |
| netraJump (NeX)  | L1336–1337  | 1100ms   |
| netraJump (Ne0)  | L1367–1368  | 1100ms   |

`lerpVectors` is Cartesian: `out = start + (end − start) * t`. For positions near
a sphere surface, this traces the chord (through the interior). SLERP of the
radial direction + constant radius scaling traces the great-circle arc (over the
surface).

### desired motion: slerp over surface

The camera path should bulge outward at its midpoint. At `t = 0.5`, the camera
must be at least as far from origin as the nearer of its start or end distance.
For positions at radius 2.05, the midpoint of a 90° arc sits at radius 2.05
(surface-parallel flight). The midpoint of a chord between two such positions
sits at radius `2.05 * cos(45°) ≈ 1.45` — inside the globe.

**Algorithm** (for Sirius to implement as a shared helper `arcCameraTo`):

```
function slerpCameraPositions(
  start: THREE.Vector3,     // current camera position
  end: THREE.Vector3,       // target camera position
  t: number                 // eased scalar in [0, 1]
): THREE.Vector3 {
  const startR = start.length();
  const endR   = end.length();
  const targetR = startR + (endR - startR) * t;  // lerp the radius only

  // Slerp the direction (unit vectors)
  const startDir = start.clone().normalize();
  const endDir   = end.clone().normalize();
  // Quaternion slerp of radial directions
  const q0 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), startDir);
  const q1 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), endDir);
  const qT = new THREE.Quaternion().slerpQuaternions(q0, q1, t);
  const dir = new THREE.Vector3(0,0,1).applyQuaternion(qT);

  return dir.multiplyScalar(targetR);
}
```

The same slerp must be applied to `currentLook`. LookAt position is typically
near-surface (radius ~1.0) — slerp it with the same `t`, using the same
quaternion-direction approach at look-target radius.

**Fallback for near-parallel vectors** — when the angle between `startDir` and
`endDir` is < 0.01 rad (nearly identical direction), fall through to `lerpVectors`
— the chord and arc are indistinguishable at that scale.

### timing

All existing durations remain. No change to:
- applyStratum: 1400ms (top of bucket — deliberate)
- applySelected: 1100ms (mid bucket — engaged attention)
- netraJump: 1100ms (mid bucket — NETRA command response)

`prefers-reduced-motion` must be respected: if `window.matchMedia('(prefers-reduced-motion: reduce)').matches`,
skip animation and set camera position immediately (teleport). This is already the
convention for all Worldline motion.

### acceptance criteria

1. **Arc proof (Ne0 stratum entry)** — log `camera.position.length()` at t=0 (pre),
   t=700ms (mid), t=1400ms (end). The value at t=700ms must be ≥
   `Math.min(startR, endR) - 0.02`. For the Ne0 transition from "all" (startR ≈ 4.2)
   to Ne0 (endR ≈ 2.05), midpoint must be ≥ 2.03. A chord would give ~2.9 heading
   inward then outward — this test confirms the path bulges or stays above surface.

   Precise form: `mid_dist >= min(start_dist, end_dist) - 0.02` for all four
   animation sites, tested at t = 0.5 of the animation.

2. **90° great-circle arc proof** — construct a synthetic test:
   `startPos = (2.0, 0, 0)`, `endPos = (0, 0, 2.0)` (90° apart, both at r=2.0).
   At t=0.5, `slerpCameraPositions(startPos, endPos, 0.5).length()` must equal
   `2.0 ± 0.001`. A lerp would give `(1.0, 0, 1.0).length() ≈ 1.414` (fails).

3. **Antipodal robustness** — `startPos = (0, 2.0, 0)`, `endPos = (0, -2.0, 0)`.
   The quaternion slerp should still produce a smooth arc (not flip). Test that
   no NaN values appear in the output at t=0.25, 0.5, 0.75. If the degenerate
   case is detected (dot(startDir, endDir) < -0.9999), use a pre-defined
   perpendicular axis for rotation.

4. **LookAt coherence** — during the applySelected transition, the angle between
   `camera.position.normalize()` and `currentLook.normalize()` must remain
   approximately constant (±15°) throughout the animation. The camera must not
   tumble or pivot unexpectedly.

5. **prefers-reduced-motion** — with `prefers-reduced-motion: reduce` emulated,
   all four camera-change calls must set `camera.position` to the final value in
   the same frame (no mid-state rendered). Test by checking `cameraAnim` is null
   immediately after the call.

---

## atoms table (Rule 5 compliance)

No new visual atoms are introduced by these fixes. The affected code is
camera-position arithmetic and input-event handling — invisible to the design
system surface.

CSS change: `touch-action: none` on `.atlas-globe-wrap canvas` — this is a
behavioral property on an existing atom, not a new atom. Atom reference:
`glob-wrap` (worldline-atoms.css, `.atlas-globe-wrap`).

| atom id      | location                          | role in these fixes                            |
|--------------|-----------------------------------|------------------------------------------------|
| `glob-wrap`  | worldline-atoms.css / globals.css | canvas host — receives `touch-action: none`    |
| `hud`        | worldline-atoms.css               | HUD readouts unchanged; cam-pos update feeds them |

No new tokens. No new fonts. No new patterns.

---

## non-goals

- No change to auto-rotation speeds (0.10, 0.08, 0.18, 0.02 rad/s per stratum).
  These are content decisions, not motion bugs.
- No change to STRATA shape definitions — camPos values remain as authored.
  Only the ne0-stratum evaluation timing changes.
- No pinch-zoom support. Touch interaction scope is horizontal drag only.
- No change to animation durations (1400ms / 1100ms). They are within axiom.
- No vertical drag mapping. Globe rotation is single-axis (Y) by design.
- No camera path change for the `softTrackCamera` / `dampVec3` follower
  (L987–993). That is a spring-damp follower, not an arc transition.
- No motion changes for NeX field or ray group rotations (L1450–1453).

---

## references

- `WorldlineGlobe.tsx` L1049–1073 (applyStratum) — primary fix site 1 + 3
- `WorldlineGlobe.tsx` L1078–1099 (applySelected) — fix site 3
- `WorldlineGlobe.tsx` L1316–1372 (netraJump) — fix site 3
- `WorldlineGlobe.tsx` L995–1018 (drag handlers) — fix site 2
- `WorldlineGlobe.tsx` L1437–1461 (tick loop) — momentum extension
- `lib/globe-coordinates.ts` L53–59 (globeSurfacePointAtRotation) — fix site 1
- `app/globals.css` L566–569 (.atlas-globe-wrap canvas) — touch-action fix
- `worldline-atoms.css` atom `glob-wrap` — governing atom

---

*end · 17-globe-motion-fixes.md*
