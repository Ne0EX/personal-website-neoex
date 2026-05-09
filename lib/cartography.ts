import { createNoise2D } from "simplex-noise";

/** Tiny seeded PRNG (mulberry32) so contours stay stable per session. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const noise2D = createNoise2D(mulberry32(0x130426));

/**
 * Latitude contour — horizontal sweep with perlin-displaced y.
 * Used inside the orthographic globe (clipped to the sphere).
 */
export function latContour(yBase: number, ampl: number, samples = 64): string {
  const xMin = -135, xMax = 135;
  const pts: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = xMin + (xMax - xMin) * t;
    const n = noise2D(x * 0.012, yBase * 0.04 + 11.7) * ampl;
    pts.push(`${x.toFixed(1)},${(yBase + n).toFixed(1)}`);
  }
  return "M " + pts.join(" L ");
}

/**
 * Generative globe contours — 9 latitude bands sweeping across the sphere
 * with rising amplitudes near the poles (more visual variation where the
 * orthographic projection compresses).
 */
export function globeContours(): { d: string; opacity: number }[] {
  const bands = [-110, -88, -64, -40, -16, 8, 32, 56, 80, 104];
  return bands.map((yBase) => {
    const distFromEq = Math.abs(yBase) / 110;
    const ampl = 5 + distFromEq * 12;
    const opacity = 0.35 + (1 - distFromEq) * 0.45;
    return { d: latContour(yBase, ampl), opacity };
  });
}

/**
 * Elevation profile cross-section — 600x60 viewBox, single perlin-driven
 * topography line. Used in the strip below the globe.
 */
export function elevationProfile(width = 600, height = 60, samples = 120) {
  const baseline = height * 0.62;
  const ampl = height * 0.32;
  const pts: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = t * width;
    const n = noise2D(t * 4.2 + 2.1, 7.7) * 0.6 + noise2D(t * 11.4, 19.2) * 0.4;
    const y = baseline - n * ampl;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return {
    line: "M " + pts.join(" L "),
    fill:
      `M 0,${height} L ` +
      pts.join(" L ") +
      ` L ${width},${height} Z`,
  };
}

/**
 * Orthographic project — convert lon/lat (degrees) to flat (x, y) for a
 * sphere viewed straight-on. Returns null if the point is on the back side.
 */
export function orthographic(
  lonDeg: number,
  latDeg: number,
  R: number
): { x: number; y: number; visible: boolean } {
  const lon = (lonDeg * Math.PI) / 180;
  const lat = (latDeg * Math.PI) / 180;
  const x = R * Math.cos(lat) * Math.sin(lon);
  const y = R * -Math.sin(lat);
  const z = Math.cos(lat) * Math.cos(lon);
  return { x, y, visible: z >= 0 };
}
