# 18 · Globe Fix Plan — α-locus, arc camera, drag
> Status: PLAN only — no code changed.
> Sirius · α-SUR-01 · 2026-05-31

---

## Issue 1 — Stale stratum target (wrong α-locus endpoint)

**Root.** `STRATA.neo.camPos` / `.look` (L276–277) are computed at module-load time
via `latLonToVec3()` which carries no rotation — they are globe-local at rotation.y
= 0. `applyStratum` at L1057 clones them directly. The globe rotates continuously
(0.02 rad/s in `neo`, L1458); entry mid-rotation uses a stale endpoint.

`atlasPoint()` (L953–956) already solves this via
`globeSurfacePointAtRotation(lat, lon, refs.globe.rotation.y, radius)`.

**Fix — L1057–1058 inside `applyStratum`, `neo` branch only:**

Replace the static clone with a live recompute:
```ts
const endPos  = key === "neo"
  ? (() => { const v = globeSurfacePointAtRotation(ALPHA_LAT, ALPHA_LON, refs.globe.rotation.y, 2.05); return new THREE.Vector3(v.x,v.y,v.z); })()
  : T.camPos.clone();
const endLook = key === "neo"
  ? (() => { const v = globeSurfacePointAtRotation(ALPHA_LAT, ALPHA_LON, refs.globe.rotation.y, 1.0);  return new THREE.Vector3(v.x,v.y,v.z); })()
  : T.look.clone();
```

`globeSurfacePointAtRotation` is already imported (used at L954). No new import.

---

## Issue 2 — lerpVectors chord cuts through globe

**Root.** Four closures use `camera.position.lerpVectors(startPos, endPos, e)`.
Cartesian lerp = chord through sphere interior. Required: great-circle arc.

**Call sites:**

| closure | position lines | lookAt lines | duration |
|---------|---------------|-------------|----------|
| `applyStratum` | 1064 | 1065 | 1400 ms |
| `applySelected` | 1094 | 1095 | 1100 ms |
| `netraJump` NeX | 1336 | 1337 | 1100 ms |
| `netraJump` Ne0 | 1367 | 1368 | 1100 ms |

**New helper — insert near L1048, above `applyStratum`:**

```ts
function arcCameraTo(
  startPos: THREE.Vector3, endPos: THREE.Vector3,
  startLook: THREE.Vector3, endLook: THREE.Vector3,
  e: number                             // smoothstepped t in [0,1]
): { pos: THREE.Vector3; look: THREE.Vector3 } {
  // SLERP position direction; lerp height scalar.
  const h = startPos.length() + (endPos.length() - startPos.length()) * e;
  const qP = new THREE.Quaternion(), qS = new THREE.Quaternion();
  qS.setFromUnitVectors(new THREE.Vector3(0,0,1), startPos.clone().normalize());
  qP.setFromUnitVectors(new THREE.Vector3(0,0,1), endPos.clone().normalize());
  const pos = new THREE.Vector3(0,0,1)
    .applyQuaternion(THREE.Quaternion.slerpQuaternions(qS, qP, new THREE.Quaternion(), e))
    .multiplyScalar(h);
  // SLERP lookAt; degenerate (near-origin) falls back to lerp.
  let look: THREE.Vector3;
  const ls = startLook.length(), le = endLook.length();
  if (ls < 1e-6 || le < 1e-6) {
    look = new THREE.Vector3().lerpVectors(startLook, endLook, e);
  } else {
    const qL = new THREE.Quaternion();
    const qLS = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), startLook.clone().normalize());
    const qLE = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), endLook.clone().normalize());
    look = new THREE.Vector3(0,0,1)
      .applyQuaternion(THREE.Quaternion.slerpQuaternions(qLS, qLE, qL, e))
      .multiplyScalar(ls + (le - ls) * e);
  }
  return { pos, look };
}
```

**Replacement pattern at every call site (identical in all four):**
```ts
// Before: camera.position.lerpVectors(startPos, endPos, e);
//         currentLook.lerpVectors(startLook, endLook, e);
// After:
const { pos, look } = arcCameraTo(startPos, endPos, startLook, endLook, e);
camera.position.copy(pos); currentLook.copy(look);
```

Variable names vary per closure: `applySelected` uses `camTarget`/`lookTarget`;
`netraJump` uses `dest`/`look` — substitute accordingly.

**Anti-antipodal guard** (inside each `cameraAnim` closure, before the arc call):
```ts
if (startPos.clone().normalize().dot(endPos.clone().normalize()) < -0.97) {
  camera.position.lerpVectors(startPos, endPos, e); // fallback — slerp undefined at 180°
  currentLook.lerpVectors(startLook, endLook, e);
} else { const { pos, look } = arcCameraTo(...); camera.position.copy(pos); currentLook.copy(look); }
```

---

## Issue 3 — Drag: touch gesture stolen, sensitivity too low, no momentum

**3a. `app/globals.css` L566–569 — add one property:**
```css
.atlas-globe-wrap canvas { /* existing rule */
  touch-action: none; /* ADD — prevents browser claiming vertical scroll */
}
```

**3b. Sensitivity — `WorldlineGlobe.tsx` L1007:**
```ts
// Before: baseRotY += dx * 0.005;
baseRotY += dx * 0.012;    // After — 0.005 is 0.5%/px; 0.012 gives perceptible sweep
```

**3c. Horizontal-axis gate — L950 (vars) + L995 (onDown) + L1000 (onMoveDrag):**

Add `let lastY = 0; let dragAxisLocked = false;` near existing `let lastX = 0;` (~L950).
In `onDown` add `lastY = e.clientY; dragAxisLocked = false;`.
In `onMoveDrag`, before the `baseRotY` line:
```ts
const dy = e.clientY - lastY; lastY = e.clientY;
if (!dragAxisLocked) {
  if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
  dragAxisLocked = true;
  if (Math.abs(dy) > Math.abs(dx)) return; // vertical — yield to browser scroll
}
```

**3d. Inertia (recommended):** track `dragVelX` (rad/ms) in `onMoveDrag`; in the
tick loop decay it as `dragVelX *= Math.exp(-dt * 5.0)` (τ ≈ 200 ms) and apply to
`baseRotY` while `!dragging`. Cap to ±0.08 rad/ms before accumulating.

---

## One risk that matters most

**Near-antipodal SLERP.** `THREE.Quaternion.slerpQuaternions` returns an arbitrary
perpendicular arc when `dot(normalize(startPos), normalize(endPos)) ≈ −1` — the
camera rolls through the wrong hemisphere. The STRATA positions are not antipodal;
however NETRA jump can connect geographically distant pins. The anti-antipodal guard
in §Issue 2 is mandatory, not optional. Stress-test before closing: jump from FULL
SYSTEM (`0,0,4.2`) to a pin near Lima, Peru (`−12°S, 77°W`) — approximately 167°
from Bangkok — and confirm no camera tumble.
