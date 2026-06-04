export type Vec3Like = {
  x: number;
  y: number;
  z: number;
};

const RAD_PER_DEG = Math.PI / 180;
const DEG_PER_RAD = 180 / Math.PI;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function normalizeLon(lon: number) {
  let normalized = lon;
  while (normalized < -180) normalized += 360;
  while (normalized > 180) normalized -= 360;
  return normalized;
}

export function normalizeVec3(v: Vec3Like): Vec3Like {
  const length = Math.hypot(v.x, v.y, v.z);
  if (length === 0) throw new Error("Cannot normalize a zero-length vector");
  return {
    x: v.x / length,
    y: v.y / length,
    z: v.z / length,
  };
}

export function latLonToVec3(latDeg: number, lonDeg: number, radius = 1): Vec3Like {
  const phi = (90 - latDeg) * RAD_PER_DEG;
  const theta = lonDeg * RAD_PER_DEG;

  return {
    x: radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: -radius * Math.sin(phi) * Math.sin(theta),
  };
}

export function rotateVec3AroundY(v: Vec3Like, radians: number): Vec3Like {
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: v.x * cos + v.z * sin,
    y: v.y,
    z: -v.x * sin + v.z * cos,
  };
}

export function globeSurfacePointAtRotation(
  latDeg: number,
  lonDeg: number,
  rotationY: number,
  radius = 1
): Vec3Like {
  return rotateVec3AroundY(latLonToVec3(latDeg, lonDeg, radius), rotationY);
}

/**
 * The globe-group Y-rotation that brings a given lat/lon locus to the FRONT face
 * (maximally toward the +Z camera). Used by the /archive hover-orbit: when an
 * entry row is hovered, the mini-globe slerps rotation.y toward this angle so the
 * matching pin is on the visible hemisphere before the orange emphasis reads.
 *
 * Derivation: after globe.rotation.y = R, a pin's world-space z is
 *   worldZ(R) = -localX·sin(R) + localZ·cos(R)
 * (rotateVec3AroundY's z component). This is A·cos(R − δ) form, maximised when
 *   R = atan2(-localX, localZ).
 * At that R, worldZ = hypot(localX, localZ) = cos(lat) — the front pole of the
 * pin's latitude band. Polar axis is untouched (Y-only), honouring the
 * "orbit the surface, never tilt/clip" rule. Result is in (−π, π]; callers should
 * unwrap to the nearest equivalent of the current angle for a short-path orbit.
 */
export function targetRotationYForPin(latDeg: number, lonDeg: number): number {
  const v = latLonToVec3(latDeg, lonDeg, 1);
  return Math.atan2(-v.x, v.z);
}

/**
 * Unwrap `target` to the value congruent mod 2π that is NEAREST to `current`, so
 * an eased rotation toward it always takes the SHORT arc (never spins the long
 * way around through the back hemisphere — "never clip through / over-rotate").
 */
export function nearestEquivalentAngle(current: number, target: number): number {
  const TWO_PI = Math.PI * 2;
  let delta = (target - current) % TWO_PI;
  if (delta > Math.PI) delta -= TWO_PI;
  else if (delta < -Math.PI) delta += TWO_PI;
  return current + delta;
}

export function dampVec3(
  current: Vec3Like,
  target: Vec3Like,
  deltaTime: number,
  speed: number
): Vec3Like {
  const alpha = 1 - Math.exp(-Math.max(0, speed) * Math.max(0, deltaTime));

  return {
    x: current.x + (target.x - current.x) * alpha,
    y: current.y + (target.y - current.y) * alpha,
    z: current.z + (target.z - current.z) * alpha,
  };
}

export function vecToLatLon(v: Vec3Like): { lat: number; lon: number } {
  const direction = normalizeVec3(v);
  const lat = 90 - Math.acos(clamp(direction.y, -1, 1)) * DEG_PER_RAD;
  const lon = normalizeLon(Math.atan2(direction.z, -direction.x) * DEG_PER_RAD - 180);

  return { lat, lon };
}

export function netraCoordFromCameraPosition(cameraPosition: Vec3Like): {
  lat: number;
  lon: number;
  direction: Vec3Like;
} {
  const direction = normalizeVec3(cameraPosition);
  return {
    ...vecToLatLon(direction),
    direction,
  };
}

/**
 * Convert a world-space raycaster intersection point on the globe sphere to
 * earth-fixed lat/lon, accounting for the globe group's current Y-rotation.
 *
 * The globe mesh rotates around the world Y-axis via `globeRotationY`
 * (refs.globe.rotation.y). A hit point returned by THREE.Raycaster is in
 * world space. To recover the earth-fixed position we must un-rotate it by
 * the negative of that angle before converting to spherical coordinates.
 *
 * Note: the sphere is a child of the globe Group so its local-space position
 * equals the world-space position minus the globe's rotation — applying the
 * inverse rotation via rotateVec3AroundY(point, -globeRotationY) achieves this.
 */
export function latLonFromGlobeHit(
  worldPoint: Vec3Like,
  globeRotationY: number
): { lat: number; lon: number } {
  // Un-rotate back to earth-fixed frame.
  const earthFixed = rotateVec3AroundY(worldPoint, -globeRotationY);
  return vecToLatLon(earthFixed);
}

export function formatNetraCoord(lat: number, lon: number) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}°${ns} · ${Math.abs(lon).toFixed(2)}°${ew}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// DRIFT / BEARING SURVEY GEOMETRY — added for the /archive instrument readout.
//
// Betelgeuse's data contract flagged these as MISSING: the readout's
// "DRIFT A · N.Nk" and "BEARING · 291° WNW" rows need a great-circle distance
// and an initial-bearing helper, and the drift LINE needs a great-circle arc
// sampler. All three are cheap, deterministic, lat/lon-only — no data dep beyond
// the observer α (fixed) and the node's coords. They live here so the Three.js
// mini-globe, the Canvas2D fallback, and the readout panel share ONE source.
// ─────────────────────────────────────────────────────────────────────────────

/** Mean Earth radius (km) — for the great-circle DRIFT readout. */
const EARTH_RADIUS_KM = 6371;

/**
 * Great-circle (haversine) distance in km between two lat/lon loci. Drives the
 * readout "DRIFT A · N.Nk" — the surveyed distance from observer α to the node.
 */
export function greatCircleDistanceKm(
  latA: number,
  lonA: number,
  latB: number,
  lonB: number
): number {
  const dLat = (latB - latA) * RAD_PER_DEG;
  const dLon = (lonB - lonA) * RAD_PER_DEG;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(latA * RAD_PER_DEG) *
      Math.cos(latB * RAD_PER_DEG) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Initial compass bearing (degrees, 0–360 clockwise from true north) along the
 * great circle FROM (latA,lonA) TO (latB,lonB). Drives the readout "BEARING ·
 * 291° WNW" and orients the drift-line aim narrative.
 */
export function initialBearingDeg(
  latA: number,
  lonA: number,
  latB: number,
  lonB: number
): number {
  const φ1 = latA * RAD_PER_DEG;
  const φ2 = latB * RAD_PER_DEG;
  const Δλ = (lonB - lonA) * RAD_PER_DEG;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x) * DEG_PER_RAD;
  return (θ + 360) % 360;
}

const CARDINALS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

/** Map a 0–360 bearing to a 16-wind cardinal label (e.g. 291 → "WNW"). */
export function bearingToCardinal(bearingDeg: number): string {
  const idx = Math.round(((bearingDeg % 360) / 22.5)) % 16;
  return CARDINALS[idx];
}

/**
 * Sample `segments`+1 points along the GREAT CIRCLE between two earth-fixed
 * surface unit-vectors (slerp the directions, NOT a Bezier swoosh), lifted to
 * `radius` so the arc rides just above the globe surface. Returns earth-fixed
 * Vec3Like[] — callers add them to the rotating globe group so the arc stays
 * anchored to α + node as the user free-orbits.
 *
 * This is the geometry behind the /archive DRIFT LINE — the canonical ATLAS
 * arcLine re-aimed from α to the hovered/locked node. Degenerate (identical or
 * antipodal) endpoints fall back to a straight interpolation.
 */
export function greatCircleArcPoints(
  latA: number,
  lonA: number,
  latB: number,
  lonB: number,
  segments = 56,
  radius = 1.01
): Vec3Like[] {
  const a = normalizeVec3(latLonToVec3(latA, lonA, 1));
  const b = normalizeVec3(latLonToVec3(latB, lonB, 1));
  const dot = clamp(a.x * b.x + a.y * b.y + a.z * b.z, -1, 1);
  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega);

  const pts: Vec3Like[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    let x: number, y: number, z: number;
    if (sinOmega < 1e-6) {
      // Degenerate: endpoints coincident (or antipodal) — linear interpolate.
      x = a.x + (b.x - a.x) * t;
      y = a.y + (b.y - a.y) * t;
      z = a.z + (b.z - a.z) * t;
    } else {
      const k0 = Math.sin((1 - t) * omega) / sinOmega;
      const k1 = Math.sin(t * omega) / sinOmega;
      x = a.x * k0 + b.x * k1;
      y = a.y * k0 + b.y * k1;
      z = a.z * k0 + b.z * k1;
    }
    const len = Math.hypot(x, y, z) || 1;
    pts.push({ x: (x / len) * radius, y: (y / len) * radius, z: (z / len) * radius });
  }
  return pts;
}
