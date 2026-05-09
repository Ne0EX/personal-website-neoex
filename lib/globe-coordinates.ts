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

export function formatNetraCoord(lat: number, lon: number) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}°${ns} · ${Math.abs(lon).toFixed(2)}°${ew}`;
}
