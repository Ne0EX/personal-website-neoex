"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  RECENT_ENTRIES,
  OBSERVER_NODES,
  type Entry,
  type ArchiveNode,
} from "@/lib/entries";
import {
  dampVec3,
  formatNetraCoord,
  globeSurfacePointAtRotation,
  latLonFromGlobeHit,
  latLonToVec3 as geoLatLonToVec3,
} from "@/lib/globe-coordinates";
import {
  WL_STRATUM_EVENT, type StratumChangeDetail,
  WL_GLOBE_COORD_EVENT,
} from "@/lib/client-state/globe-store";
// Worldline branching — 30-worldline-branching.md §13.2
// FictionPin shape from types.ts (not yet in index barrel — use direct import).
import type { FictionPin } from "@/lib/content/types";
import { getFiction, getFictionSiblings } from "@/lib/content";
// Procedural globe surface (paper + grid + Earth coastline) — shared single
// source of truth, cloned by the standby mini-globe. Rule 5 (extracted from this
// file 2026-06-03). See lib/globe-surface.ts.
import { buildSurfaceTextures } from "@/lib/globe-surface";

/**
 * WorldlineGlobe — A.T.L.A.S. (Archive · Topology · Localizer · Atlas Surface).
 *
 * Three-column instrument frame around a 3D paper-cream globe with engraved
 * line graticules, contour rings, polar axis spine, NeX field shells, and
 * surveyed nodes at real-world coordinates.
 *
 * Strata travel:
 *   ALL   — orbital overview, all layers visible
 *   NeX   — pull camera back, reveal field shells (possibility field)
 *   Ne0N  — fly to north pole, axis-aligned view (the bearer)
 *   Ne0   — dive to surface near α coordinate (Bangkok, the archive)
 *
 * Click any entry pin → camera focuses + article side panel slides in with
 * the entry's title and summary. ESC / outside click reverses.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PALETTE BACKUP — these values cannot read CSS vars (Three.js / canvas).
 * The rest of the palette swap lives in app/globals.css under the palette
 * toggle. To revert this file to the INK baseline, run two find/replaces:
 *
 *   ACTIVE  (TEAL — Re:Boot reference)         BACKUP (INK — v2 navy)
 *   ────────────────────────────────────       ────────────────────────────
 *   line / material color   0x1f5063           0x1a2832
 *   surface gradient stops  #BDBBAF, #D2CFC4   #9E9377, #B5AA8B
 *   surface aging blotches  rgba(70,95,108,…)  rgba(120,100,70,…)
 *   inner-shade tint        0xb4bbc0           0xcfc4ad
 *   article shadow rgba     31,80,99           26,40,50
 * ─────────────────────────────────────────────────────────────────────────
 */

const GLOBE_RADIUS = 1;

// ─── Worldline Branching constants — 30-worldline-branching.md §9.1 + §13.2 ───
// All Three.js materials use hard-coded hex/rgba; CSS vars are inaccessible here.
// Token source: app/globals.css line 41–42 + branching spec §9.3.
const SITE_ALPHA = 1.130426;           // observer α — spec §4.3 / Procyon SITE_ALPHA
const NEX_SHELL_R = GLOBE_RADIUS * 1.18; // orbital shell radius — ontology §4.2
const BRANCH_ORANGE_HEX = 0xD4602A;      // --accent-orange value (no opacity applied in hex)
// Dashed tendril: 0.5px stroke, alpha 0.18 — spec §4.2 / §9.2
const TENDRIL_ALPHA_BASE = 0.18;
const TENDRIL_ALPHA_APEX = 0.22;       // breathing apex — spec §9.2
const TENDRIL_ALPHA_TROUGH = 0.14;     // breathing trough — spec §9.2
// Endpoint halo ring: alpha 0.6 — spec §4.4
const ENDPOINT_ALPHA = 0.6;
// Breathing — spec §7.1: ±15% control-point lift, ±0.012 rad sway, phase offset π/4
const BREATH_LIFT_AMP = 0.15;          // ±15% of base control-point lift
const BREATH_SWAY_AMP = 0.012;         // ±0.012 rad endpoint sway — spec §7.1
const BREATH_PHASE_OFFSET = Math.PI / 4; // phase offset from camera drift — spec §7.1
// Drift frequency used by spec §7.1 — matches NeX drift rate in tick()
const DRIFT_FREQ_YAW = 0.07;           // rad/s — approximate yaw drift frequency
// Timing — spec §9.1
const BRANCH_ACTIVATE_DELAY_MS = 200;  // ms after drift fade-in starts before branches draw
const TENDRIL_DRAW_MS = 600;           // stroke-dash-offset draw-in
const ENDPOINT_FADE_MS = 400;          // endpoint opacity fade-in
const BRANCH_FADE_OUT_LINE_MS = 220;   // tendril fade-out on deactivate
const BRANCH_FADE_OUT_HALO_MS = 180;   // halo fade-out (finishes first — spec §5.2)
// NeX domain→meridian mapping (ontology §4.2) — maps author domains to sphere longitude
const DOMAIN_MERIDIAN: Record<string, number> = {
  identity:   0,
  reflection: Math.PI / 2,
  method:     Math.PI,
  meta:       (3 * Math.PI) / 2,
};
// ─────────────────────────────────────────────────────────────────────────────

type StratumKey = "all" | "nex" | "neon" | "neo";

type Stratum = {
  key: StratumKey;
  name: string;
  role: string;
  camPos: THREE.Vector3;
  look: THREE.Vector3;
  showField: boolean;
  showAxis: boolean;
  showContours: boolean;
  netra: string;
  netraCoord: string;
  netraRange: string;
  /**
   * NETRA's first-person scene framing for this stratum. Italic, terse,
   * instrumented — feels like an attached probe narrating what it sees.
   */
  voice: string;
  hudCam: string;
  hudRadius: string;
  hudDepth: string;
  hudStratum: string;
  pinShow: boolean;
  flow: "nex" | "neon" | "neo" | null;
};

function latLonToVec3(latDeg: number, lonDeg: number, r = GLOBE_RADIUS) {
  const v = geoLatLonToVec3(latDeg, lonDeg, r);
  return new THREE.Vector3(v.x, v.y, v.z);
}

function easeInOutCubic(x: number) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function easeOutQuad(x: number) {
  return 1 - (1 - x) * (1 - x);
}

/**
 * Spherical interpolation for camera positions about the globe center (0,0,0).
 *
 * A straight lerpVectors chord between two distant camera positions cuts THROUGH
 * the globe ("ทะลุโลก"). This function keeps the camera on the surface of a
 * conceptual sphere by slerping the DIRECTION with quaternion slerp and lerping
 * the RADIUS separately — guaranteeing the camera always stays outside the
 * planet at every interpolation step.
 *
 * @param start   Camera world-position at animation start
 * @param end     Camera world-position at animation end
 * @param t       Normalized time [0, 1] (already eased by the caller)
 */
function slerpCameraPos(
  start: THREE.Vector3,
  end: THREE.Vector3,
  t: number
): THREE.Vector3 {
  // Linearly interpolate the radius so zoom eases smoothly.
  const rStart = start.length();
  const rEnd   = end.length();
  const easedRadius = rStart + (rEnd - rStart) * t;

  // Slerp the normalized directions via quaternion rotation.
  // Quaternion.setFromUnitVectors gives the shortest-arc rotation between two
  // unit vectors; slerp between the two quaternions sweeps the direction along
  // the great circle, never cutting through the origin.
  const dirStart = start.clone().normalize();
  const dirEnd   = end.clone().normalize();
  const qA = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirStart);
  const qB = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dirEnd);
  const qSlerped = qA.clone().slerp(qB, t);
  const slerpedDir = new THREE.Vector3(0, 0, 1).applyQuaternion(qSlerped).normalize();

  return slerpedDir.multiplyScalar(easedRadius);
}

// ─── NeX orbital coordinate model — ontology §4.2 + branching §4.3 ───

/**
 * Compute a NeX orbital position from a fiction entry's domain + isoDate.
 * Returns a THREE.Vector3 on the orbital shell (r = NEX_SHELL_R).
 * Domain drives meridian longitude; date drives latitude.
 * Per ontology §4.2: placement by meaning-coords, not GPS.
 */
function nexOrbitalPosition(domain: string, isoDate: string): THREE.Vector3 {
  const meridian = DOMAIN_MERIDIAN[domain] ?? 0;
  // Parse date latitude: map year-month to lat range [-60°, +60°]
  // isoDate format: "YYYY-MM-DD" (velite schema)
  const parts = isoDate.split("-");
  const month = parseInt(parts[1] ?? "6", 10); // 1–12
  // Map month 1–12 to latitude −55° to +55° — spread across shell
  const latDeg = ((month - 6.5) / 6.5) * 55;
  const latRad = (latDeg * Math.PI) / 180;
  const r = NEX_SHELL_R;
  return new THREE.Vector3(
    Math.cos(latRad) * Math.sin(meridian) * r,
    Math.sin(latRad) * r,
    Math.cos(latRad) * Math.cos(meridian) * r,
  );
}

/**
 * Deterministic phase offset for a fiction node — stable across reloads.
 * Per spec §4.3: angle_i = (2π × i / N) + phase_offset_node
 * Uses a simple hash of the slug string.
 */
function slugPhaseOffset(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = (Math.imul(31, h) + slug.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 1000) / 1000 * Math.PI * 2;
}

/**
 * Data bundle for a single active tendril — stored per-branch in activation state.
 */
type TendrilData = {
  channel: "variant" | "sibling";
  pNode: THREE.Vector3;      // attended node world position
  pEndpoint: THREE.Vector3;  // endpoint (variant = virtual, sibling = real)
  pControlBase: THREE.Vector3; // control point at baseline (no breathing)
  divergenceVec: THREE.Vector3; // radial outward direction from globe center
  // Three.js objects
  curve: THREE.QuadraticBezierCurve3;
  line: THREE.Line;
  endpointMesh: THREE.Mesh | null; // null for sibling (real glyph already exists)
  // Animation state
  drawProgress: number;   // 0→1 during draw-in, 1 when complete, -1 during fade-out
  drawStartMs: number;
  fadeOutStartMs: number; // -1 if not fading out
  isDrawComplete: boolean;
  // For sway — variant only
  variantIndex: number;
  variantCount: number;
};

/**
 * Active branching session — attached to one NeX node while RW-5 drift holds.
 */
type BranchSession = {
  pin: FictionPin;
  pNode: THREE.Vector3;
  tendrils: TendrilData[];
  group: THREE.Group;
  activatedMs: number;          // performance.now() when session started
  isDeactivating: boolean;      // fade-out in progress
  voiceLineEmitted: boolean;    // NETRA Q-F/Q-G line sent
  firstDrawCompleteMs: number;  // performance.now() when first tendril draw completed; Infinity if not yet
};

const ALPHA_LAT = 13.7563;
const ALPHA_LON = 100.5018;

const STRATA: Record<StratumKey, Stratum> = {
  all: {
    key: "all",
    name: "FULL SYSTEM",
    role: "all strata observed · ne0ex aggregate",
    camPos: new THREE.Vector3(0, 0, 4.2),
    look: new THREE.Vector3(0, 0, 0),
    showField: true,
    showAxis: true,
    showContours: true,
    netra: "STANDBY",
    netraCoord: "0°,0°",
    netraRange: "2.50",
    voice:
      "standing by, ne0ex aggregate in view. cycle ⟶ JUMP, click any pin, or strike 1 / 2 / 3 to enter a stratum.",
    hudCam: "ORBIT · 0°",
    hudRadius: "1.00",
    hudDepth: "0.00",
    hudStratum: "FULL · Ne0EX",
    pinShow: false,
    flow: null,
  },
  nex: {
    key: "nex",
    name: "NeX · POSSIBILITY",
    role: "projection field · outer shells emitting outward",
    camPos: new THREE.Vector3(2.2, 1.2, 5.0),
    look: new THREE.Vector3(0, 0, 0),
    showField: true,
    showAxis: true,
    showContours: false,
    netra: "NeX",
    netraCoord: "—",
    netraRange: "3.10",
    voice:
      "possibility shells, 247 rays emitting outward. hypotheses accrete here before they patch into the archive.",
    hudCam: "WIDE · POSSIBILITY",
    hudRadius: "1.48",
    hudDepth: "+0.48",
    hudStratum: "3 · NeX",
    pinShow: false,
    flow: "nex",
  },
  neon: {
    key: "neon",
    name: "Ne0N · NORTH POLE",
    role: "polar axis · the bearer · viewed from above",
    camPos: new THREE.Vector3(0, 3.1, 0.2),
    look: new THREE.Vector3(0, 0.4, 0),
    showField: false,
    showAxis: true,
    showContours: false,
    netra: "Ne0N",
    netraCoord: "90°N",
    netraRange: "1.85",
    voice:
      "polar bearer · viewed from the axis. no surface, only the line that holds the worldline together.",
    hudCam: "POLAR · 90°N",
    hudRadius: "0.85",
    hudDepth: "+1.00",
    hudStratum: "2 · Ne0N",
    pinShow: false,
    flow: "neon",
  },
  neo: {
    key: "neo",
    name: "Ne0 · ARCHIVE",
    role: "surface archive · α coordinate centered",
    // Radius raised from 2.05 → 2.7: α is the target, not a wall-fill.
    // 2.05 buried the camera in the surface; 2.7 frames α with the globe visible.
    camPos: latLonToVec3(ALPHA_LAT, ALPHA_LON, 2.7),
    look: latLonToVec3(ALPHA_LAT, ALPHA_LON, 1.0),
    showField: false,
    showAxis: false,
    showContours: true,
    netra: "Ne0",
    netraCoord: `${ALPHA_LAT.toFixed(2)}°N, ${ALPHA_LON.toFixed(2)}°E`,
    netraRange: "1.42",
    voice:
      "surface archive · 047 patches anchored. α holds the observer locus; the rest are repaired memories at real coordinates.",
    hudCam: "SURFACE · α",
    hudRadius: "1.00",
    hudDepth: "−0.05",
    hudStratum: "1 · Ne0",
    pinShow: true,
    flow: "neo",
  },
};

const STRATA_BUTTONS: { key: StratumKey; id: string; role: string; numKey: string; glyph: React.ReactNode }[] = [
  {
    key: "nex",
    id: "3 · NeX",
    role: "Possibility · Field",
    numKey: "3",
    glyph: (
      <svg width="22" height="22" viewBox="-12 -12 24 24" aria-hidden>
        <circle cx="0" cy="0" r="10" fill="none" stroke="currentColor" strokeWidth="0.7" />
        <circle cx="0" cy="0" r="6" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
        <line x1="0" y1="-11" x2="0" y2="-9" stroke="currentColor" strokeWidth="0.7" />
        <line x1="0" y1="9" x2="0" y2="11" stroke="currentColor" strokeWidth="0.7" />
        <line x1="-11" y1="0" x2="-9" y2="0" stroke="currentColor" strokeWidth="0.7" />
        <line x1="9" y1="0" x2="11" y2="0" stroke="currentColor" strokeWidth="0.7" />
      </svg>
    ),
  },
  {
    key: "neon",
    id: "2 · Ne0N",
    role: "Pole · Bearer",
    numKey: "2",
    glyph: (
      <svg width="22" height="22" viewBox="-12 -12 24 24" aria-hidden>
        <ellipse cx="0" cy="0" rx="9" ry="3" fill="none" stroke="currentColor" strokeWidth="0.6" />
        <ellipse cx="0" cy="0" rx="3" ry="9" fill="none" stroke="currentColor" strokeWidth="0.6" />
        <line x1="0" y1="-10" x2="0" y2="10" stroke="currentColor" strokeWidth="0.7" />
      </svg>
    ),
  },
  {
    key: "neo",
    id: "1 · Ne0",
    role: "Surface · Archive",
    numKey: "1",
    glyph: (
      <svg width="22" height="22" viewBox="-12 -12 24 24" aria-hidden>
        <circle cx="0" cy="0" r="7" fill="none" stroke="currentColor" strokeWidth="0.7" />
        <path d="M -6 -2 Q -2 -4 2 -2 Q 5 0 6 2" fill="none" stroke="currentColor" strokeWidth="0.5" />
        <path d="M -6 1 Q -2 -1 2 1 Q 5 3 6 4" fill="none" stroke="currentColor" strokeWidth="0.5" />
        <polygon points="0,-1 1.3,1 -1.3,1" fill="currentColor" />
      </svg>
    ),
  },
];

type SceneRefs = {
  globe: THREE.Group;
  // The primary sphere mesh — exposed so pointer-move raycasting can hit-test
  // against it for earth-fixed coordinate readout (hover gate fix).
  globeSphere: THREE.Mesh;
  contoursGroup: THREE.Group;
  axisGroup: THREE.Group;
  nexField: THREE.Group;
  // NeX orbital fiction node glyphs — hollow rings at domain+date positions.
  // Added at runtime (async fiction load), empty initially.
  nexFictionGlyphs: THREE.Group;
  // Branching tendrils group — child of nexField (above orbital shell, per §13.2 step 1).
  branchesGroup: THREE.Group;
  raysGroup: THREE.Group;
  northPole: THREE.Group;
  southPole: THREE.Group;
  netraTracker: THREE.Group;
  alphaRing: THREE.Mesh | null;
  arcLine: THREE.Line;
  pinObjects: { entry: Entry; head: THREE.Mesh; hit: THREE.Mesh }[];
  observerObjects: { node: ArchiveNode; head: THREE.Mesh }[];
};

// Procedural surface textures (paper-cream base + baked lat/long grid + async
// Earth coastline silhouette) were EXTRACTED 2026-06-03 to lib/globe-surface.ts
// (Rule 5 — single source of truth; imported at the top of this file). The
// mini-globe (components/ArchiveMiniGlobeThreeJS.tsx) imports the SAME
// buildSurfaceTextures() so the world map cannot drift between the two globes.
// Do not re-inline this function here — edit lib/globe-surface.ts.

function buildScene(): { root: THREE.Group; scene: THREE.Scene; refs: SceneRefs; cleanup: () => void } {
  const scene = new THREE.Scene();
  scene.background = null;

  // Lights — paper material wants soft ambient + low-key key light.
  scene.add(new THREE.AmbientLight(0xefe7d6, 1.15));
  const key = new THREE.DirectionalLight(0xfff4dd, 0.18);
  key.position.set(2, 2.5, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x2a3a48, 0.08);
  rim.position.set(-3, -1, -2);
  scene.add(rim);

  const globe = new THREE.Group();
  scene.add(globe);

  // ─── Cream paper sphere with procedural textures + earth coastline ───
  const surface = buildSurfaceTextures();
  const sphereGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 128, 128);
  const paperMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: surface.map,
    roughnessMap: surface.rough,
    roughness: 0.95,
    bumpMap: surface.bump,
    bumpScale: 0.008,
    metalness: 0,
  });
  const sphere = new THREE.Mesh(sphereGeo, paperMat);
  globe.add(sphere);

  // Inner darker shell — gives depth at the rim.
  const innerShade = new THREE.Mesh(
    new THREE.SphereGeometry(0.998, 64, 64),
    new THREE.MeshBasicMaterial({ color: 0xb4bbc0, side: THREE.BackSide, transparent: true, opacity: 0.35 })
  );
  globe.add(innerShade);

  // ─── Engraved lat/long lines (the user explicitly wanted line contour) ───
  const lineMat = new THREE.LineBasicMaterial({ color: 0x1f5063, transparent: true, opacity: 0.55 });
  const lineMatFaint = new THREE.LineBasicMaterial({ color: 0x1f5063, transparent: true, opacity: 0.3 });

  const makeLatRing = (latDeg: number, mat: THREE.LineBasicMaterial) => {
    const lat = (latDeg * Math.PI) / 180;
    const r = Math.cos(lat);
    const y = Math.sin(lat);
    const pts: THREE.Vector3[] = [];
    const segs = 128;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r * 1.001, y * 1.001, Math.sin(a) * r * 1.001));
    }
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
  };
  const makeMeridian = (lonDeg: number, mat: THREE.LineBasicMaterial) => {
    const lon = (lonDeg * Math.PI) / 180;
    const pts: THREE.Vector3[] = [];
    const segs = 128;
    for (let i = 0; i <= segs; i++) {
      const t = (i / segs) * Math.PI - Math.PI / 2;
      const r = Math.cos(t);
      pts.push(new THREE.Vector3(Math.cos(lon) * r * 1.001, Math.sin(t) * 1.001, Math.sin(lon) * r * 1.001));
    }
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
  };

  globe.add(makeLatRing(0, lineMat)); // equator stronger
  for (let lat = -75; lat <= 75; lat += 15) if (lat !== 0) globe.add(makeLatRing(lat, lineMatFaint));
  for (let lon = 0; lon < 360; lon += 15) {
    const mat = lon % 90 === 0 ? lineMat : lineMatFaint;
    globe.add(makeMeridian(lon, mat));
  }

  // ─── Contour rings — irregular elevation lines on the surface ───
  const contoursGroup = new THREE.Group();
  globe.add(contoursGroup);
  const contourMat = new THREE.LineBasicMaterial({ color: 0x1f5063, transparent: true, opacity: 0.7 });
  const makeContour = (latCenter: number, ampl: number, phase: number) => {
    const pts: THREE.Vector3[] = [];
    const segs = 256;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const lat =
        ((latCenter + ampl * (Math.sin(a * 3 + phase) * 0.6 + Math.sin(a * 5 + phase * 1.7) * 0.4)) * Math.PI) /
        180;
      const r = Math.cos(lat);
      const y = Math.sin(lat);
      pts.push(new THREE.Vector3(Math.cos(a) * r * 1.003, y * 1.003, Math.sin(a) * r * 1.003));
    }
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), contourMat.clone());
  };
  [-65, -45, -25, -5, 15, 35, 55].forEach((lat, i) => {
    contoursGroup.add(makeContour(lat, 6, i * 1.7));
  });

  // ─── Ne0N — polar axis spine + survey-triangle caps + pole beacons ───
  const axisGroup = new THREE.Group();
  globe.add(axisGroup);
  const axisCylinderMat = new THREE.MeshBasicMaterial({ color: 0x1f5063 });
  const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 2.6, 16), axisCylinderMat);
  axisGroup.add(axis);

  const axisLineMat = new THREE.LineBasicMaterial({ color: 0x1f5063 });
  const axisCap = (yPos: number, dir: number) => {
    const g = new THREE.Group();
    const sz = 0.04;
    const tip = new THREE.Vector3(0, yPos + dir * 0.06, 0);
    const a = new THREE.Vector3(sz, yPos, 0);
    const b = new THREE.Vector3(-sz, yPos, 0);
    const c = new THREE.Vector3(0, yPos, sz);
    const d = new THREE.Vector3(0, yPos, -sz);
    const segs: [THREE.Vector3, THREE.Vector3][] = [
      [tip, a], [tip, b], [tip, c], [tip, d],
      [a, c], [c, b], [b, d], [d, a],
    ];
    for (const [p, q] of segs) {
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p, q]), axisLineMat));
    }
    return g;
  };
  axisGroup.add(axisCap(1.3, 1));
  axisGroup.add(axisCap(-1.3, -1));

  const poleBeacon = (yPos: number, dir: number) => {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.04, 0.05, 48),
      new THREE.MeshBasicMaterial({ color: 0xd4602a, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = yPos;
    g.add(ring);
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xd4602a })
    );
    dot.position.y = yPos;
    g.add(dot);
    g.userData.dir = dir;
    return g;
  };
  const northPole = poleBeacon(1.0, 1);
  const southPole = poleBeacon(-1.0, -1);
  globe.add(northPole, southPole);

  // ─── NeX orbital fiction glyph layer + branching tendrils group ───
  // nexFictionGlyphs: hollow ring glyphs at domain+date orbital positions.
  //   Populated asynchronously after fiction data loads.
  // branchesGroup: holds active tendril curves + halo endpoints.
  //   Z-order: above orbital shell mesh, below attractor-binding (per §13.2 step 1).
  const nexFictionGlyphs = new THREE.Group();
  const branchesGroup = new THREE.Group();
  // Both go inside nexField so they inherit field visibility state.

  // ─── NeX — possibility field: concentric translucent wireframe spheres + radial rays ───
  const nexField = new THREE.Group();
  scene.add(nexField);
  nexField.add(nexFictionGlyphs);
  nexField.add(branchesGroup);
  const makeShell = (radius: number, opacity: number) => {
    const m = new THREE.MeshBasicMaterial({
      color: 0x1f5063,
      wireframe: true,
      transparent: true,
      opacity,
      depthWrite: false,
    });
    return new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), m);
  };
  nexField.add(makeShell(1.18, 0.1), makeShell(1.32, 0.07), makeShell(1.48, 0.05));

  const raysGroup = new THREE.Group();
  nexField.add(raysGroup);
  const rayMat = new THREE.LineBasicMaterial({ color: 0x1f5063, transparent: true, opacity: 0.35 });
  for (let i = 0; i < 48; i++) {
    const phi = Math.acos(1 - 2 * ((i + 0.5) / 48));
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const dx = Math.sin(phi) * Math.cos(theta);
    const dy = Math.cos(phi);
    const dz = Math.sin(phi) * Math.sin(theta);
    const inner = new THREE.Vector3(dx * 1.18, dy * 1.18, dz * 1.18);
    const outer = new THREE.Vector3(dx * 1.55, dy * 1.55, dz * 1.55);
    raysGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([inner, outer]), rayMat));
  }

  // ─── Ne0 — surveyed archive nodes at real-world coordinates ───
  const nodesGroup = new THREE.Group();
  globe.add(nodesGroup);

  const nodeMatInk = new THREE.MeshBasicMaterial({ color: 0x1f5063 });
  const nodeMatAcc = new THREE.MeshBasicMaterial({ color: 0xd4602a });

  // Entry pins (clickable, with hit proxies for raycaster)
  const pinObjects: { entry: Entry; head: THREE.Mesh; hit: THREE.Mesh }[] = [];
  for (const e of RECENT_ENTRIES) {
    const v = latLonToVec3(e.coords.lat, e.coords.lon, 1.005);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 12), nodeMatInk.clone());
    head.position.copy(v);
    nodesGroup.add(head);

    const hitGeo = new THREE.SphereGeometry(0.05, 8, 8);
    const hitMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    const hit = new THREE.Mesh(hitGeo, hitMat);
    hit.position.copy(v);
    hit.renderOrder = 999;
    hit.userData.entry = e.fileNum;
    nodesGroup.add(hit);

    pinObjects.push({ entry: e, head, hit });
  }

  // Observer nodes (α + 012 + 047, not clickable)
  let alphaRing: THREE.Mesh | null = null;
  const observerObjects: { node: ArchiveNode; head: THREE.Mesh }[] = [];
  for (const n of OBSERVER_NODES) {
    const v = latLonToVec3(n.coords.lat, n.coords.lon, 1.005);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(n.primary ? 0.022 : 0.01, 12, 12), // M4 sync: α sphere 0.018→0.022 per spec §5.3 / master gallery canonical
      n.primary ? nodeMatAcc.clone() : nodeMatInk.clone()
    );
    head.position.copy(v);
    nodesGroup.add(head);

    if (n.primary) {
      alphaRing = new THREE.Mesh(
        new THREE.RingGeometry(0.034, 0.044, 32), // M4 sync: halo ring 0.03→0.034 / 0.038→0.044 per spec §5.3 / master gallery canonical
        new THREE.MeshBasicMaterial({ color: 0xd4602a, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
      );
      alphaRing.position.copy(v.clone().multiplyScalar(1.001));
      alphaRing.lookAt(0, 0, 0);
      alphaRing.rotateY(Math.PI);
      globe.add(alphaRing);
    }
    observerObjects.push({ node: n, head });
  }

  // NETRA active tracker — exact surface anchor, kept on the globe so the
  // marker follows ATLAS rotation while the camera follows with softened lag.
  const netraTracker = new THREE.Group();
  netraTracker.visible = false;
  const trackerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.045, 0.06, 48),
    new THREE.MeshBasicMaterial({ color: 0x4d7a92, side: THREE.DoubleSide, transparent: true, opacity: 0.92 })
  );
  const trackerHalo = new THREE.Mesh(
    new THREE.RingGeometry(0.075, 0.078, 64),
    new THREE.MeshBasicMaterial({ color: 0x4d7a92, side: THREE.DoubleSide, transparent: true, opacity: 0.34 })
  );
  const trackerDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.009, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0x4d7a92 })
  );
  netraTracker.add(trackerRing, trackerHalo, trackerDot);
  globe.add(netraTracker);

  // ─── Worldline arc — α point swooping out into NeX field ───
  const arcStart = latLonToVec3(ALPHA_LAT, ALPHA_LON, 1.01);
  const arcMid = arcStart.clone().multiplyScalar(1.35).add(new THREE.Vector3(0.2, 0.15, 0));
  const arcEnd = arcStart.clone().multiplyScalar(1.55).add(new THREE.Vector3(0.4, 0.3, -0.1));
  const arcCurve = new THREE.QuadraticBezierCurve3(arcStart, arcMid, arcEnd);
  const arcPts = arcCurve.getPoints(64);
  const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPts);
  const arcMat = new THREE.LineDashedMaterial({
    color: 0xd4602a,
    dashSize: 0.05,
    gapSize: 0.03,
    transparent: true,
    opacity: 0.95,
  });
  const arcLine = new THREE.Line(arcGeo, arcMat);
  arcLine.computeLineDistances();
  scene.add(arcLine);

  return {
    root: globe,
    scene,
    refs: {
      globe,
      // Expose the primary sphere so the pointer-move handler can raycast
      // against the actual globe surface (hover gate + hit-point coords fix).
      globeSphere: sphere,
      contoursGroup,
      axisGroup,
      nexField,
      nexFictionGlyphs,
      branchesGroup,
      raysGroup,
      northPole,
      southPole,
      netraTracker,
      alphaRing,
      arcLine,
      pinObjects,
      observerObjects,
    },
    cleanup: () => {
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
          if (Array.isArray(m.material)) m.material.forEach((mm) => mm.dispose());
          else (m.material as THREE.Material).dispose();
        }
      });
    },
  };
}

export function WorldlineGlobe() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [stratum, setStratum] = useState<StratumKey>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Live readouts driven via DOM refs (mutated each frame inside the render
  // loop) — keeps the component from re-rendering 60×/sec and prevents the
  // ResizeObserver→renderer.setSize feedback that produced the shake.
  const hudCamRef = useRef<HTMLSpanElement | null>(null);
  const netraCoordRef = useRef<HTMLSpanElement | null>(null);
  const netraRangeRef = useRef<HTMLSpanElement | null>(null);
  // Target name only changes on click — fine to use React state.
  const [netraTarget, setNetraTarget] = useState("STANDBY");
  // Branch voice — overrides stratum voice when NeX branching is active.
  // Q-F/Q-G lines from Vega (TASK-2026-05-17-VEGA-BRANCHING-VOICE).
  const [branchVoice, setBranchVoice] = useState<string | null>(null);

  const stratumRef = useRef<StratumKey>("all");
  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => { stratumRef.current = stratum; }, [stratum]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);

  // Broadcast stratum changes to the module-level globe-store so Nav and
  // other client components can read the current stratum without coupling
  // directly to this component's state.
  // Note: additive only — does not affect rendering or camera logic.
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent<StratumChangeDetail>(WL_STRATUM_EVENT, {
        detail: { stratum },
      })
    );
  }, [stratum]);

  const entryById = useMemo(
    () => Object.fromEntries(RECENT_ENTRIES.map((e) => [e.fileNum, e])),
    []
  );
  const selected = selectedId ? entryById[selectedId] : null;

  const t = STRATA[stratum];

  /**
   * NETRA voice — companion-intelligence framing line shown below the console.
   * Priority (highest to lowest):
   *   1. branchVoice — NeX branching Q-F/Q-G lines (Vega locked copy)
   *   2. selected entry trace line
   *   3. current stratum voice
   * Per spec §13.2 step 7: NETRA voice update uses existing aria-live strip.
   */
  const netraVoice = branchVoice
    ? branchVoice
    : selected
      ? `trace · "${selected.title.toLowerCase()}". patched ${selected.date} · anchored ${selected.coords.place.toLowerCase()}.`
      : t.voice;

  // ESC closes article panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedIdRef.current) setSelectedId(null);
        else setStratum("all");
      } else if (e.key === "1") setStratum((s) => (s === "neo" ? "all" : "neo"));
      else if (e.key === "2") setStratum((s) => (s === "neon" ? "all" : "neon"));
      else if (e.key === "3") setStratum((s) => (s === "nex" ? "all" : "nex"));
      else if (e.key === "0") setStratum("all");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Jump-to-next-node (NETRA) — cycles through observer + entry + fiction nodes.
  const jumpIdxRef = useRef(0);
  // Extended jump target: optional fictionSlug marks NeX orbital nodes (no real-world coords).
  const jumpTargetsRef = useRef<{
    label: string;
    place: string;
    coords: { lat: number; lon: number };
    fictionSlug?: string; // set for NeX fiction nodes
  }[]>([]);
  const netraLockRef = useRef<{ coords: { lat: number; lon: number }; range: number } | null>(null);
  // Orbital-active gate — true while a NeX possibility node is the active target.
  // A NeX node is an ORBITAL meaning-coordinate, not a surface place (ontology
  // §4.2). While true, the coord HUD must NOT manufacture a surface lat/lon from
  // hover; it shows the absence-of-place token "—" instead. Cleared whenever the
  // lock is set or cleared (setNetraLock / clearNetraLock), which all surface and
  // stratum transitions route through.
  const nexActiveRef = useRef(false);

  // Hover coordinate gate — set by onPointerMove when the raycaster hits the
  // globe sphere; cleared on miss or pointer-leave. null = readout hidden.
  // Written in the THREE event handler, consumed in the tick loop — mutable
  // ref avoids a React re-render on every pointer-move event.
  const hoverGlobeCoordRef = useRef<{ lat: number; lon: number } | null>(null);

  // Loaded fiction pins — populated by async load in THREE setup useEffect.
  // Stored here so the NETRA jump logic outside that effect can read them.
  const fictionPinsRef = useRef<FictionPin[]>([]);

  // Active branching session — holds all tendril/halo objects for the current NeX node.
  // Written only inside the THREE setup useEffect's closure.
  const branchSessionRef = useRef<BranchSession | null>(null);

  // Reduced-motion preference — read once in useEffect, stable for session.
  // Per spec §10.2: no fade animations, instant alpha, no breathing.
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    jumpTargetsRef.current = [
      ...OBSERVER_NODES.map((n) => ({ label: n.label, place: n.coords.place, coords: { lat: n.coords.lat, lon: n.coords.lon } })),
      ...RECENT_ENTRIES.map((e) => ({ label: e.fileNum, place: e.coords.place, coords: { lat: e.coords.lat, lon: e.coords.lon } })),
    ];
    // Fiction pins are appended to jumpTargets after async load — see THREE setup effect.
  }, []);

  // ─── THREE setup ───
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Hydration-safe reduced-motion read — inside useEffect, not during render.
    // Per AGENTS.md quality bar: check prefers-reduced-motion in useEffect only.
    reducedMotionRef.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const { scene, refs, cleanup } = buildScene();

    const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 100);
    camera.position.set(0, 0, 4.2);
    const currentLook = new THREE.Vector3(0, 0, 0);
    camera.lookAt(currentLook);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const resize = () => {
      const r = container.getBoundingClientRect();
      const w = Math.max(1, r.width);
      const h = Math.max(1, r.height);
      renderer.setSize(w, h, true);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    // Drag to orbit (only in 'all' or 'nex').
    let dragging = false;
    let lastX = 0;
    let baseRotY = 0;
    const ringNormal = new THREE.Vector3(0, 0, 1);
    const atlasPoint = (coords: { lat: number; lon: number }, radius = GLOBE_RADIUS) => {
      const v = globeSurfacePointAtRotation(coords.lat, coords.lon, refs.globe.rotation.y, radius);
      return new THREE.Vector3(v.x, v.y, v.z);
    };
    const setTrackerMarker = (coords: { lat: number; lon: number }) => {
      const marker = latLonToVec3(coords.lat, coords.lon, 1.024);
      refs.netraTracker.position.copy(marker);
      refs.netraTracker.quaternion.setFromUnitVectors(ringNormal, marker.clone().normalize());
      refs.netraTracker.visible = true;
    };
    const clearNetraLock = () => {
      netraLockRef.current = null;
      nexActiveRef.current = false;
      refs.netraTracker.visible = false;
    };
    const setNetraLock = (coords: { lat: number; lon: number }, range: number) => {
      netraLockRef.current = { coords, range };
      nexActiveRef.current = false;
      setTrackerMarker(coords);
    };
    const cameraTrack = (coords: { lat: number; lon: number }, range: number) => {
      const look = atlasPoint(coords, GLOBE_RADIUS);
      const radial = look.clone().normalize();
      const up = Math.abs(radial.y) > 0.92 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const tangent = new THREE.Vector3().crossVectors(up, radial).normalize();
      const lift = new THREE.Vector3().crossVectors(radial, tangent).normalize();

      return {
        position: radial
          .clone()
          .multiplyScalar(range)
          .add(tangent.clone().multiplyScalar(0.28))
          .add(lift.clone().multiplyScalar(0.12)),
        look: look.clone().add(tangent.multiplyScalar(0.08)),
      };
    };
    // Hard minimum camera distance — camera must never be closer than this to
    // the globe center regardless of which code path updated it.
    // Radius floor: globe radius (1.0) + 8% margin.  Applied as a backstop every
    // frame after cameraAnim AND softTrackCamera so neither path can clip through.
    const MIN_CAM_R = 1.08;
    const enforceRadiusFloor = () => {
      const r = camera.position.length();
      if (r < MIN_CAM_R) {
        // Rescale the position vector — preserves direction, lifts to floor.
        camera.position.setLength(MIN_CAM_R);
      }
    };

    const softTrackCamera = (coords: { lat: number; lon: number }, range: number, dt: number) => {
      const track = cameraTrack(coords, range);

      // Position: orbit-safe approach — slerp the DIRECTION + ease the RADIUS.
      //
      // Cartesian dampVec3 on the full position vector can cut through the globe
      // when the current camera direction and target direction differ significantly
      // (e.g. after a slerp transition where the slerp endpoint is earth-fixed but
      // the softTrack target is globe-rotation-adjusted).  We break the motion into:
      //   1. Slerp the direction via quaternion — always stays on a great-circle arc.
      //   2. Exponentially ease the radius with a ONE-SIDED clamp: radius never goes
      //      below max(targetRadius, MIN_CAM_R).  This kills the inward overshoot at
      //      source — the eased radius approaches target from above, never below.
      //
      // Reference: same quaternion slerp as slerpCameraPos, applied per-frame.
      const currentDir = camera.position.clone().normalize();
      const targetDir  = track.position.clone().normalize();

      // Guard against zero-length vectors (degenerate state).
      if (currentDir.lengthSq() < 0.001 || targetDir.lengthSq() < 0.001) {
        camera.position.copy(track.position);
      } else {
        // Quaternion slerp for direction — per-frame, speed 2.8 rad/s.
        const qCur = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), currentDir);
        const qTgt = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), targetDir);
        // Alpha for exponential approach at speed 2.8.
        const alpha = 1 - Math.exp(-2.8 * Math.max(0, dt));
        qCur.slerp(qTgt, alpha);
        const newDir = new THREE.Vector3(0, 0, 1).applyQuaternion(qCur).normalize();

        // Radius: exponential approach from current toward target, clamped below
        // so it can ONLY approach from above.  Prevents inward overshoot.
        const targetRadius = track.position.length();
        const currentRadius = camera.position.length();
        // Approach the larger of (current radius, target radius) so we never dip
        // below target.  Then enforce the absolute floor.
        const clampedTarget = Math.max(targetRadius, MIN_CAM_R);
        // One-sided: if current is ABOVE target, approach normally (ease downward).
        //            if current is BELOW target/floor, jump up immediately (floor enforced below).
        const newRadius = currentRadius + (clampedTarget - currentRadius) * alpha;
        camera.position.copy(newDir.multiplyScalar(Math.max(newRadius, MIN_CAM_R)));
      }

      // Look-at target: Cartesian damp is safe here (the look target is near the
      // globe surface at radius ~1, no clip risk).
      const nextLook = dampVec3(currentLook, track.look, dt, 4.2);
      currentLook.set(nextLook.x, nextLook.y, nextLook.z);
      camera.lookAt(currentLook);
    };
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onMoveDrag = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      const sk = stratumRef.current;
      if (sk === "all" || sk === "nex") {
        clearNetraLock();
        baseRotY += dx * 0.005;
        refs.globe.rotation.y = baseRotY;
      }
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      try { renderer.domElement.releasePointerCapture(e.pointerId); } catch {}
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMoveDrag);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointercancel", onUp);

    // Pin click via raycaster.
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const onClick = (e: PointerEvent) => {
      const r = container.getBoundingClientRect();
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(refs.pinObjects.map((p) => p.hit), false);
      if (hits.length > 0) {
        const fileNum = (hits[0].object as THREE.Mesh).userData.entry as string | undefined;
        if (fileNum) setSelectedId(fileNum);
      } else if (selectedIdRef.current) {
        setSelectedId(null);
      }
    };
    const onHover = (e: PointerEvent) => {
      const r = container.getBoundingClientRect();
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);

      // Cursor style — pin hit proxies take priority.
      const pinHits = raycaster.intersectObjects(refs.pinObjects.map((p) => p.hit), false);
      renderer.domElement.style.cursor = pinHits.length > 0 ? "pointer" : "";

      // Globe sphere hit-test — earth-fixed coordinate gate.
      // Raycaster returns world-space intersection points; un-rotate by the
      // globe group's current Y-rotation to recover earth-fixed lat/lon.
      // A pointer over any overlay (TRIANGULATE, article panel) never reaches
      // the canvas element's pointermove, so the miss path covers that case too.
      const sphereHits = raycaster.intersectObject(refs.globeSphere, false);
      if (sphereHits.length > 0) {
        const wp = sphereHits[0].point;
        const coord = latLonFromGlobeHit(
          { x: wp.x, y: wp.y, z: wp.z },
          refs.globe.rotation.y
        );
        hoverGlobeCoordRef.current = coord;
        // Publish real earth-fixed coord to SurveyCursor via custom DOM event.
        // Same pattern as WL_STRATUM_EVENT — no React coupling, no zustand needed.
        window.dispatchEvent(
          new CustomEvent<{ lat: number; lon: number }>(WL_GLOBE_COORD_EVENT, {
            detail: coord,
          })
        );
      } else {
        hoverGlobeCoordRef.current = null;
        // Emit coord=null to clear the SurveyCursor label on sphere miss.
        window.dispatchEvent(new CustomEvent(WL_GLOBE_COORD_EVENT, { detail: null }));
      }
    };
    // Clear hover coord when pointer leaves the canvas (e.g. cursor moves to
    // a UI element rendered outside the Three.js canvas).
    const onGlobePointerLeave = () => {
      hoverGlobeCoordRef.current = null;
      window.dispatchEvent(new CustomEvent(WL_GLOBE_COORD_EVENT, { detail: null }));
    };
    renderer.domElement.addEventListener("click", onClick);
    renderer.domElement.addEventListener("pointermove", onHover);
    renderer.domElement.addEventListener("pointerleave", onGlobePointerLeave);

    // ─── Camera transitions per stratum ───
    let cameraAnim: ((now: number) => void) | null = null;
    const applyStratum = (key: StratumKey) => {
      // Stratum change = deactivate branches (spec §5.1 option iii rejection logic:
      // framing change calls deactivateDrift — same applies here).
      deactivateBranches();
      // neo = α-locked stratum (Ne0 = the alpha observer's own surface ground,
      // ontology §4.2c). setNetraLock clears any prior NeX/NETRA active-node lock
      // AND resets nexActiveRef, so entering Ne0 can never route through the
      // previously-active node — α is the destination, never a waypoint.
      // All other strata are wide/aggregate views — clear any existing lock.
      if (key === "neo") {
        setNetraLock({ lat: ALPHA_LAT, lon: ALPHA_LON }, 2.7);
      } else {
        clearNetraLock();
      }
      const T = STRATA[key];
      const isNeo = key === "neo";
      const startPos = camera.position.clone();
      const startLook = currentLook.clone();
      const endPos = T.camPos.clone();
      const endLook = T.look.clone();
      const dur = 1400;
      const t0 = performance.now();
      cameraAnim = (now: number) => {
        const k = Math.min(1, (now - t0) / dur);
        const e = easeInOutCubic(k);
        // neo: recompute the α endpoint EVERY frame from cameraTrack(α, 2.7) —
        // the same ROTATION-ADJUSTED locus softTrackCamera holds after the slerp
        // completes (cameraTrack → atlasPoint → globeSurfacePointAtRotation reads
        // refs.globe.rotation.y). The captured T.camPos uses latLonToVec3 which is
        // EARTH-FIXED (ignores the always-advancing globe rotation), so slerping to
        // it parked the camera on the wrong texel — the "sits on Africa/Yirgacheffe"
        // detour — and only softTrack corrected it seconds later. Recomputing per
        // frame makes the slerp END exactly where the hold begins: straight to the
        // VISIBLE α, no detour. Other strata (neon pole, all/nex orbital overviews)
        // keep their correctly earth-fixed captured endpoints.
        let toPos = endPos;
        let toLook = endLook;
        if (isNeo) {
          const track = cameraTrack({ lat: ALPHA_LAT, lon: ALPHA_LON }, 2.7);
          toPos = track.position;
          toLook = track.look;
        }
        // Orbit interpolation — slerpCameraPos sweeps the camera along a great-circle
        // arc rather than a straight chord, so the camera never cuts through the globe.
        camera.position.copy(slerpCameraPos(startPos, toPos, e));
        currentLook.lerpVectors(startLook, toLook, e);
        camera.lookAt(currentLook);
        if (k >= 1) cameraAnim = null;
      };
      refs.nexField.visible = T.showField;
      refs.axisGroup.visible = T.showAxis;
      refs.contoursGroup.visible = T.showContours;
      refs.arcLine.visible = key !== "neon" && key !== "neo";
    };
    // Expose for state changes from outside the effect.
    (window as unknown as { __atlasApplyStratum?: (k: StratumKey) => void }).__atlasApplyStratum = applyStratum;

    // Entry-selected camera focus — orbit camera to face the selected pin's world position.
    const applySelected = (id: string | null) => {
      if (!id) {
        applyStratum(stratumRef.current);
        return;
      }
      const entry = RECENT_ENTRIES.find((e) => e.fileNum === id);
      if (!entry) return;
      setNetraLock(entry.coords, 2.4);
      const startPos = camera.position.clone();
      const startLook = currentLook.clone();
      const dur = 1100;
      const t0 = performance.now();
      cameraAnim = (now: number) => {
        const k = Math.min(1, (now - t0) / dur);
        const e = easeInOutCubic(k);
        const { position: camTarget, look: lookTarget } = cameraTrack(entry.coords, 2.4);
        // Orbit arc — no chord through the globe.
        camera.position.copy(slerpCameraPos(startPos, camTarget, e));
        currentLook.lerpVectors(startLook, lookTarget, e);
        camera.lookAt(currentLook);
        if (k >= 1) cameraAnim = null;
      };
    };
    (window as unknown as { __atlasApplySelected?: (id: string | null) => void }).__atlasApplySelected = applySelected;

    // ─── Worldline Branching — §13.2 activation/deactivation helpers ───

    /**
     * Build and animate a branch session for the given fiction pin.
     * Called when NETRA RW-5 tracking engages on a NeX node.
     * Per spec §13.2 steps 2–4.
     */
    const activateBranches = async (pin: FictionPin, pNode: THREE.Vector3) => {
      // Deactivate any prior session immediately (no overlap — spec §7.2).
      deactivateBranches();

      const hasBranches = pin.variants.length > 0 || !!pin.divergence_cluster;
      if (!hasBranches) {
        // Empty-state — spec §3.3. Voice only; no visual.
        // Q-G line: `// netra · {nodeTitle} holds. no speculative orbits at this α.`
        const title = pin.slug.replace(/^transmission-/, "t.");
        setBranchVoice(`${title} holds. no speculative orbits at this α.`);
        return;
      }

      const group = new THREE.Group();
      refs.branchesGroup.add(group);

      const tendrils: TendrilData[] = [];
      const now = performance.now();

      // Divergence vector — radial outward from globe origin through node.
      // Per spec §4.3.
      const divergenceVec = pNode.clone().normalize();

      // Build orthonormal tangent basis (t_yaw, t_pitch) perpendicular to divergenceVec.
      // Stable per node — same algorithm as spec §4.3.
      const worldUp = Math.abs(divergenceVec.y) > 0.92
        ? new THREE.Vector3(1, 0, 0)
        : new THREE.Vector3(0, 1, 0);
      const tYaw = new THREE.Vector3().crossVectors(worldUp, divergenceVec).normalize();
      const tPitch = new THREE.Vector3().crossVectors(divergenceVec, tYaw).normalize();

      const phaseOffset = slugPhaseOffset(pin.slug);
      const N = pin.variants.length;

      // Channel A — variant tendrils (virtual coords per §4.3).
      pin.variants.forEach((variant, i) => {
        const deltaAlpha = Math.abs(parseFloat(variant.alpha) - SITE_ALPHA);
        const distance = GLOBE_RADIUS * (0.06 + Math.min(deltaAlpha * 60, 0.10));
        const angle = (2 * Math.PI * i / Math.max(N, 1)) + phaseOffset;
        const direction = tYaw.clone().multiplyScalar(Math.cos(angle))
          .addScaledVector(tPitch, Math.sin(angle));
        const pEndpoint = pNode.clone().addScaledVector(direction, distance);

        // Control point: midpoint, lifted outward by R × 0.015 along divergenceVec.
        // Per spec §4.3 variant tendril control point.
        const pControlBase = pNode.clone().lerp(pEndpoint, 0.5)
          .addScaledVector(divergenceVec, GLOBE_RADIUS * 0.015);

        const curve = new THREE.QuadraticBezierCurve3(pNode, pControlBase.clone(), pEndpoint.clone());
        const pts = curve.getPoints(32);
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        // LineDashedMaterial — dashed 4px / gap 3px per spec §4.2.
        const mat = new THREE.LineDashedMaterial({
          color: BRANCH_ORANGE_HEX,
          transparent: true,
          opacity: reducedMotionRef.current ? TENDRIL_ALPHA_BASE : 0,
          dashSize: 0.025,
          gapSize: 0.018,
          linewidth: 1,
          depthTest: true,
          depthWrite: false,
        });
        const line = new THREE.Line(geo, mat);
        line.computeLineDistances();
        group.add(line);

        // Variant endpoint halo — 3px open ring (geometry ~0.012 radius).
        // Per spec §4.4: RingGeometry, accent-orange at 0.6 alpha.
        const haloMat = new THREE.MeshBasicMaterial({
          color: BRANCH_ORANGE_HEX,
          transparent: true,
          opacity: reducedMotionRef.current ? ENDPOINT_ALPHA : 0,
          side: THREE.DoubleSide,
          depthTest: true,
          depthWrite: false,
        });
        const haloRing = new THREE.Mesh(
          new THREE.RingGeometry(0.008, 0.012, 24),
          haloMat,
        );
        haloRing.position.copy(pEndpoint);
        // Orient ring to face camera (billboard via lookAt globe origin direction).
        haloRing.lookAt(0, 0, 0);
        haloRing.rotateY(Math.PI);
        group.add(haloRing);

        tendrils.push({
          channel: "variant",
          pNode: pNode.clone(),
          pEndpoint: pEndpoint.clone(),
          pControlBase: pControlBase.clone(),
          divergenceVec: divergenceVec.clone(),
          curve,
          line,
          endpointMesh: haloRing,
          drawProgress: reducedMotionRef.current ? 1 : 0,
          drawStartMs: now,
          fadeOutStartMs: -1,
          isDrawComplete: reducedMotionRef.current,
          variantIndex: i,
          variantCount: Math.max(N, 1),
        });
      });

      // Channel B — sibling tendrils (real orbital positions per §4.3).
      if (pin.divergence_cluster) {
        const siblings = await getFictionSiblings(pin.slug);
        for (const sibling of siblings) {
          const pEndpoint = nexOrbitalPosition(sibling.domain, sibling.isoDate);

          // Sibling control point: midpoint, lifted outward by R × 0.03.
          // Per spec §4.3 sibling tendril — "lifted off shell by R × 0.03".
          const pControlBase = pNode.clone().lerp(pEndpoint, 0.5)
            .addScaledVector(divergenceVec, GLOBE_RADIUS * 0.03);

          const curve = new THREE.QuadraticBezierCurve3(pNode, pControlBase.clone(), pEndpoint.clone());
          const pts = curve.getPoints(32);
          const geo = new THREE.BufferGeometry().setFromPoints(pts);
          const mat = new THREE.LineDashedMaterial({
            color: BRANCH_ORANGE_HEX,
            transparent: true,
            opacity: reducedMotionRef.current ? TENDRIL_ALPHA_BASE : 0,
            dashSize: 0.025,
            gapSize: 0.018,
            linewidth: 1,
            depthTest: true,
            depthWrite: false,
          });
          const line = new THREE.Line(geo, mat);
          line.computeLineDistances();
          group.add(line);

          // Sibling endpoint: no halo — sibling glyph already exists (spec §4.5).
          tendrils.push({
            channel: "sibling",
            pNode: pNode.clone(),
            pEndpoint: pEndpoint.clone(),
            pControlBase: pControlBase.clone(),
            divergenceVec: divergenceVec.clone(),
            curve,
            line,
            endpointMesh: null,
            drawProgress: reducedMotionRef.current ? 1 : 0,
            drawStartMs: now,
            fadeOutStartMs: -1,
            isDrawComplete: reducedMotionRef.current,
            variantIndex: 0,
            variantCount: 1,
          });
        }
      }

      const title = pin.slug.replace(/^transmission-/, "t.");
      const variantCount = pin.variants.length;
      // Q-F line: `// netra · {nodeTitle} · {variantCount} speculative orbits in drift.`
      // Emitted 100ms after first tendril draw completes — tracked in tick().

      const session: BranchSession = {
        pin,
        pNode: pNode.clone(),
        tendrils,
        group,
        activatedMs: now,
        isDeactivating: false,
        voiceLineEmitted: reducedMotionRef.current, // instant mode: emit on activation
        firstDrawCompleteMs: Infinity, // set by tick when first tendril draw completes
      };
      branchSessionRef.current = session;

      if (reducedMotionRef.current) {
        // Instant alpha swap, no animation — spec §10.2.
        setBranchVoice(`${title} · ${variantCount} speculative orbits in drift.`);
      }
    };

    /**
     * Deactivate current branch session — fade out and dispose.
     * Per spec §13.2 step 6 + §5.2 timing table.
     */
    const deactivateBranches = () => {
      const session = branchSessionRef.current;
      if (!session || session.isDeactivating) return;
      session.isDeactivating = true;
      const now = performance.now();
      // Set fade-out start on all tendrils.
      session.tendrils.forEach((t) => { t.fadeOutStartMs = now; });
      setBranchVoice(null); // revert to stratum voice
    };

    // ─── Extend NETRA jump to support NeX fiction nodes ───
    /**
     * Camera tracking for NeX orbital nodes — does not use lat/lon (no GPS).
     * Positions camera to look at the orbital position from outside.
     */
    const cameraTrackNex = (pNode: THREE.Vector3, range: number) => {
      const radial = pNode.clone().normalize();
      const up = Math.abs(radial.y) > 0.92 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const tangent = new THREE.Vector3().crossVectors(up, radial).normalize();
      const lift = new THREE.Vector3().crossVectors(radial, tangent).normalize();
      return {
        position: radial.clone().multiplyScalar(range)
          .add(tangent.clone().multiplyScalar(0.28))
          .add(lift.clone().multiplyScalar(0.12)),
        look: pNode.clone().add(tangent.multiplyScalar(0.08)),
      };
    };

    // NETRA jump — extended for fiction NeX nodes.
    (window as unknown as { __atlasNetraJump?: () => void }).__atlasNetraJump = () => {
      const targets = jumpTargetsRef.current;
      if (!targets.length) return;
      jumpIdxRef.current = (jumpIdxRef.current + 1) % targets.length;
      const n = targets[jumpIdxRef.current];

      // Check if this is a NeX fiction node.
      const fictionSlug = n.fictionSlug;
      if (fictionSlug) {
        const pin = fictionPinsRef.current.find((p) => p.slug === fictionSlug);
        const startPos = camera.position.clone();
        const startLook = currentLook.clone();
        const t0 = performance.now();
        const dur = 1100;
        const pNode = nexOrbitalPosition(pin?.domain ?? "identity", pin?.isoDate ?? "2026-01-01");
        cameraAnim = (now: number) => {
          const k = Math.min(1, (now - t0) / dur);
          const e = easeInOutCubic(k);
          const { position: dest, look } = cameraTrackNex(pNode, 2.8);
          // Orbit arc — sweeps around the globe surface rather than chording through.
          camera.position.copy(slerpCameraPos(startPos, dest, e));
          currentLook.lerpVectors(startLook, look, e);
          camera.lookAt(currentLook);
          if (k >= 1) {
            cameraAnim = null;
            // Drift activates after slerp; branches activate BRANCH_ACTIVATE_DELAY_MS later.
            if (pin) {
              setTimeout(() => {
                activateBranches(pin, nexOrbitalPosition(pin.domain, pin.isoDate));
              }, BRANCH_ACTIVATE_DELAY_MS);
            }
          }
        };
        // NeX fiction nodes are ORBITAL meaning-coordinates, not surface places
        // (ontology §4.2). clearNetraLock() nulls the lock AND hides the 3D
        // surface tracker — the bare `netraLockRef.current = null` used here
        // before left the PRIOR surface node's tracker visible, riding the globe
        // auto-rotation as a drifting reticle. nexActiveRef gates the coord HUD
        // off a real lat/lon so the node never reads as a surveyed place. Order
        // matters: clearNetraLock resets nexActiveRef to false, so set the flag
        // AFTER clearing. softTrackCamera is not called (lock null) → camera
        // holds the slerp orbital landing position.
        clearNetraLock();
        nexActiveRef.current = true;
        setNetraTarget(`${n.label} · ${n.place}`);
        return;
      }

      // Standard Ne0 surface node.
      deactivateBranches();
      setNetraLock(n.coords, 2.6);
      const startPos = camera.position.clone();
      const startLook = currentLook.clone();
      const t0 = performance.now();
      const dur = 1100;
      cameraAnim = (now: number) => {
        const k = Math.min(1, (now - t0) / dur);
        const e = easeInOutCubic(k);
        const { position: dest, look } = cameraTrack(n.coords, 2.6);
        // Orbit arc — no chord through the globe.
        camera.position.copy(slerpCameraPos(startPos, dest, e));
        currentLook.lerpVectors(startLook, look, e);
        camera.lookAt(currentLook);
        if (k >= 1) cameraAnim = null;
      };
      setNetraTarget(`${n.label} · ${n.place}`);
    };

    // ─── Async fiction load — populates NeX glyph layer + jump targets ───
    // Called once after scene is mounted. Runs in background; non-blocking.
    (async () => {
      try {
        const fiction = await getFiction();
        // Cast to FictionPin shape (getFiction returns Fiction[] which has same fields).
        const pins: FictionPin[] = fiction.map((f) => ({
          kind: "fiction" as const,
          slug: f.slug,
          title: f.title,
          summary: f.summary,
          domain: f.domain,
          isoDate: f.isoDate,
          tags: f.tags,
          variants: f.variants ?? [],
          divergence_cluster: f.divergence_cluster,
        }));
        fictionPinsRef.current = pins;

        // Build NeX orbital glyph for each fiction pin.
        // Hollow ring glyph — fiction node visual per ontology §4.5.
        const glyphMat = new THREE.MeshBasicMaterial({
          color: 0x1f5063,      // ink-primary teal (matches Ne0 surface pins)
          transparent: true,
          opacity: 0.75,
          side: THREE.DoubleSide,
        });
        pins.forEach((pin) => {
          const pos = nexOrbitalPosition(pin.domain, pin.isoDate);
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(0.010, 0.016, 24),
            glyphMat.clone(),
          );
          ring.position.copy(pos);
          ring.lookAt(0, 0, 0);
          ring.rotateY(Math.PI);
          ring.userData.fictionSlug = pin.slug;
          refs.nexFictionGlyphs.add(ring);
        });

        // Append fiction targets to jump list.
        const fictionTargets = pins.map((pin) => ({
          label: pin.slug.replace(/^transmission-/, "t."),
          place: `NeX · ${pin.domain}`,
          // Virtual orbital coord — we use lat=0 lon=0 as placeholder;
          // camera tracking uses nexOrbitalPosition(), not these coords.
          coords: { lat: 0, lon: 0 },
          fictionSlug: pin.slug,
        }));
        jumpTargetsRef.current = [...jumpTargetsRef.current, ...fictionTargets];
      } catch {
        // Fiction load failure is non-fatal. Globe works without NeX branching.
        // Intentional console.warn: surfaces load failures in browser devtools.
        console.warn("[WorldlineGlobe] Fiction data load failed — NeX branching unavailable.");
      }
    })();

    // Initial stratum.
    applyStratum("all");

    // Render loop — setInterval for harness robustness.
    let lastT = performance.now();
    const tick = () => {
      const now = performance.now();
      const dt = Math.min((now - lastT) / 1000, 0.06);
      lastT = now;
      const sk = stratumRef.current;

      if (!selectedIdRef.current || netraLockRef.current) {
        if (sk === "all") {
          baseRotY += dt * 0.10;
          refs.globe.rotation.y = baseRotY;
          refs.nexField.rotation.y = -baseRotY * 0.4;
          refs.raysGroup.rotation.y = baseRotY * 0.6;
        } else if (sk === "nex") {
          refs.nexField.rotation.y += dt * 0.08;
          refs.raysGroup.rotation.y -= dt * 0.06;
          refs.globe.rotation.y += dt * 0.04;
          baseRotY = refs.globe.rotation.y;
        } else if (sk === "neon") {
          refs.globe.rotation.y += dt * 0.18;
          baseRotY = refs.globe.rotation.y;
        } else if (sk === "neo") {
          refs.globe.rotation.y += dt * 0.02;
          baseRotY = refs.globe.rotation.y;
        }
      }

      // Breathing on contour opacity.
      refs.contoursGroup.children.forEach((c, i) => {
        const m = (c as THREE.Line).material as THREE.LineBasicMaterial;
        m.opacity = 0.55 + Math.sin(now * 0.001 + i) * 0.12;
      });
      // Pulse pole beacons.
      const pulse = 0.55 + 0.45 * Math.sin(now * 0.004);
      const np = refs.northPole.children[0] as THREE.Mesh;
      const sp = refs.southPole.children[0] as THREE.Mesh;
      ((np.material) as THREE.MeshBasicMaterial).opacity = pulse;
      ((sp.material) as THREE.MeshBasicMaterial).opacity = pulse * 0.6;
      // Pulse alpha ring.
      if (refs.alphaRing) {
        ((refs.alphaRing.material) as THREE.MeshBasicMaterial).opacity = 0.5 + 0.45 * Math.sin(now * 0.005);
      }
      if (refs.netraTracker.visible) {
        refs.netraTracker.scale.setScalar(1 + 0.08 * Math.sin(now * 0.006));
      }
      // Arc dash march.
      const arcM = refs.arcLine.material as THREE.LineDashedMaterial;
      arcM.dashSize = 0.04 + Math.sin(now * 0.002) * 0.005;

      // ─── Worldline Branching tick — §13.2 steps 3–6 + §7.1 breathing ───
      const session = branchSessionRef.current;
      if (session) {
        // Phase clock: shared with camera drift (one clock per body — spec §7.1).
        // driftPhaseT grows linearly. Yaw phase uses DRIFT_FREQ_YAW rad/s.
        const driftPhaseT = now * 0.001; // seconds
        const yawPhase = driftPhaseT * DRIFT_FREQ_YAW;
        const pitchPhase = driftPhaseT * DRIFT_FREQ_YAW * 0.72; // pitch at slightly different freq

        let allFadeComplete = true;

        session.tendrils.forEach((td) => {
          const lineMat = td.line.material as THREE.LineDashedMaterial;
          const elapsed = now - td.drawStartMs;

          if (td.fadeOutStartMs >= 0) {
            // Fade-out phase — spec §5.2: 220ms line, 180ms halo (halo finishes first).
            const lineT = Math.min(1, (now - td.fadeOutStartMs) / BRANCH_FADE_OUT_LINE_MS);
            const haloT = Math.min(1, (now - td.fadeOutStartMs) / BRANCH_FADE_OUT_HALO_MS);
            if (reducedMotionRef.current) {
              lineMat.opacity = 0;
              if (td.endpointMesh) (td.endpointMesh.material as THREE.MeshBasicMaterial).opacity = 0;
            } else {
              lineMat.opacity = TENDRIL_ALPHA_BASE * (1 - lineT);
              if (td.endpointMesh) {
                (td.endpointMesh.material as THREE.MeshBasicMaterial).opacity = ENDPOINT_ALPHA * (1 - haloT);
              }
            }
            if (lineT < 1) allFadeComplete = false;
          } else {
            // Draw-in or steady-state.
            if (!td.isDrawComplete) {
              const drawT = Math.min(1, elapsed / TENDRIL_DRAW_MS);
              const eased = easeOutQuad(drawT);
              // Simulate stroke-dash-offset draw-in by scaling opacity.
              // Full opacity arrives at draw complete; easing drives the "writing" feel.
              lineMat.opacity = TENDRIL_ALPHA_BASE * eased;
              if (td.endpointMesh) {
                const haloT = Math.min(1, elapsed / ENDPOINT_FADE_MS);
                (td.endpointMesh.material as THREE.MeshBasicMaterial).opacity = ENDPOINT_ALPHA * haloT;
              }
              if (drawT >= 1) {
                td.isDrawComplete = true;
                td.drawProgress = 1;
                // Persist on session so the voice-emit check survives across ticks.
                session.firstDrawCompleteMs = Math.min(session.firstDrawCompleteMs, now);
              }
            } else {
              // Steady-state breathing — phase-locked to RW-5 drift (spec §7.1).
              if (!reducedMotionRef.current) {
                // ±15% control-point lift on yaw phase + π/4 offset.
                const breathLift = Math.sin(yawPhase + BREATH_PHASE_OFFSET) * BREATH_LIFT_AMP;
                const liftAmount = GLOBE_RADIUS * 0.015 * (1 + breathLift);
                // ±0.012 rad endpoint sway on pitch phase (variant only).
                const swayAngle = td.channel === "variant"
                  ? Math.sin(pitchPhase) * BREATH_SWAY_AMP
                  : 0;

                // Recompute control point with current breathe offset.
                const newCtrl = td.pNode.clone().lerp(td.pEndpoint, 0.5)
                  .addScaledVector(td.divergenceVec, liftAmount);

                // Endpoint sway for variants — rotate endpoint slightly around node.
                let swayedEndpoint = td.pEndpoint.clone();
                if (td.channel === "variant" && swayAngle !== 0) {
                  const phaseOffset = slugPhaseOffset(session.pin.slug);
                  const angleBase = (2 * Math.PI * td.variantIndex / td.variantCount) + phaseOffset;
                  // Sway is azimuthal — rotate direction in tangent plane.
                  const worldUp2 = Math.abs(td.divergenceVec.y) > 0.92
                    ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
                  const tYaw2 = new THREE.Vector3().crossVectors(worldUp2, td.divergenceVec).normalize();
                  const tPitch2 = new THREE.Vector3().crossVectors(td.divergenceVec, tYaw2).normalize();
                  const deltaAlpha = Math.abs(parseFloat(session.pin.variants[td.variantIndex]?.alpha ?? "1.130426") - SITE_ALPHA);
                  const dist = GLOBE_RADIUS * (0.06 + Math.min(deltaAlpha * 60, 0.10));
                  const swayedAngle = angleBase + swayAngle;
                  swayedEndpoint = td.pNode.clone()
                    .addScaledVector(tYaw2, Math.cos(swayedAngle) * dist)
                    .addScaledVector(tPitch2, Math.sin(swayedAngle) * dist);
                  // Move halo ring.
                  if (td.endpointMesh) {
                    td.endpointMesh.position.copy(swayedEndpoint);
                  }
                }

                // Update curve and line geometry — only when phase delta is meaningful.
                td.curve.v0.copy(td.pNode);
                td.curve.v1.copy(newCtrl);
                td.curve.v2.copy(swayedEndpoint);
                const newPts = td.curve.getPoints(32);
                (td.line.geometry as THREE.BufferGeometry).setFromPoints(newPts);
                td.line.computeLineDistances();

                // Alpha breathing: ±0.04 around TENDRIL_ALPHA_BASE — spec §9.2.
                const alphaBreathe = Math.sin(yawPhase + BREATH_PHASE_OFFSET) * 0.04;
                lineMat.opacity = Math.max(
                  TENDRIL_ALPHA_TROUGH,
                  Math.min(TENDRIL_ALPHA_APEX, TENDRIL_ALPHA_BASE + alphaBreathe)
                );
              } else {
                lineMat.opacity = TENDRIL_ALPHA_BASE;
                if (td.endpointMesh) {
                  (td.endpointMesh.material as THREE.MeshBasicMaterial).opacity = ENDPOINT_ALPHA;
                }
              }
            }
            allFadeComplete = false; // still active
          }
        });

        // Emit NETRA Q-F voice line 100ms after first tendril draw completes.
        if (!session.voiceLineEmitted && session.firstDrawCompleteMs < Infinity && now - session.firstDrawCompleteMs >= 100) {
          const title = session.pin.slug.replace(/^transmission-/, "t.");
          const variantCount = session.pin.variants.length;
          // Q-F locked line from Vega: `// netra · {nodeTitle} · {variantCount} speculative orbits in drift.`
          setBranchVoice(`${title} · ${variantCount} speculative orbits in drift.`);
          session.voiceLineEmitted = true;
        }

        // All tendrils faded — dispose session.
        if (session.isDeactivating && allFadeComplete) {
          session.tendrils.forEach((td) => {
            td.line.geometry.dispose();
            (td.line.material as THREE.Material).dispose();
            if (td.endpointMesh) {
              (td.endpointMesh.geometry as THREE.BufferGeometry).dispose();
              (td.endpointMesh.material as THREE.Material).dispose();
              session.group.remove(td.endpointMesh);
            }
            session.group.remove(td.line);
          });
          refs.branchesGroup.remove(session.group);
          branchSessionRef.current = null;
        }
      }
      // ─── end branching tick ───

      if (cameraAnim) cameraAnim(now);
      else if (netraLockRef.current) {
        softTrackCamera(netraLockRef.current.coords, netraLockRef.current.range, dt);
      }
      // Hard radius floor backstop — applied after EVERY camera update path
      // (cameraAnim slerp AND softTrackCamera).  Guarantees no clip-through
      // regardless of which path ran this frame.  MIN_CAM_R = 1.08 (globe
      // radius 1.0 + 8% margin).  See enforceRadiusFloor() definition above.
      enforceRadiusFloor();

      // Update HUD camera readout — DOM ref, no React render.
      const camAngle = Math.atan2(camera.position.x, camera.position.z) * 180 / Math.PI;
      const hudCamText = `ORBIT · ${camAngle.toFixed(0)}°`;
      if (hudCamRef.current && hudCamRef.current.textContent !== hudCamText) {
        hudCamRef.current.textContent = hudCamText;
      }

      // NETRA coordinate readout — priority order:
      //   1. netraLock (a pinned surface node) → show its earth-fixed coords.
      //   2. nexActive (a NeX possibility node is the active target) → show the
      //      absence-of-place token "—". A NeX node is ORBITAL, not a place
      //      (ontology §4.2): it has NO surface lat/lon, so the HUD must not
      //      manufacture one from hover. "—" matches the NeX stratum readout
      //      (STRATA.nex.netraCoord) and marks "this is not a place; no surface
      //      fix" — NOT a richer telemetry/orbit readout (guardrail (b)/(d)).
      //   3. live hover over the globe sphere → show the hit-point's lat/lon.
      //   4. no hit / pointer outside globe / pointer over any overlay → hide.
      if (netraCoordRef.current) {
        const lockCoords = netraLockRef.current?.coords ?? null;
        const hoverCoords = hoverGlobeCoordRef.current;
        let coordText: string;
        if (lockCoords) {
          coordText = formatNetraCoord(lockCoords.lat, lockCoords.lon);
        } else if (nexActiveRef.current) {
          // Orbital node active — absence-of-place marker, never a fake lat/lon.
          coordText = "—";
        } else if (hoverCoords) {
          coordText = formatNetraCoord(hoverCoords.lat, hoverCoords.lon);
        } else {
          coordText = "";
        }
        if (netraCoordRef.current.textContent !== coordText) {
          netraCoordRef.current.textContent = coordText;
        }
      }
      const rangeText = camera.position.length().toFixed(2);
      if (netraRangeRef.current && netraRangeRef.current.textContent !== rangeText) {
        netraRangeRef.current.textContent = rangeText;
      }

      renderer.render(scene, camera);
    };
    const id = window.setInterval(tick, 16);
    tick();

    return () => {
      window.clearInterval(id);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMoveDrag);
      renderer.domElement.removeEventListener("pointermove", onHover);
      renderer.domElement.removeEventListener("pointerleave", onGlobePointerLeave);
      renderer.domElement.removeEventListener("pointerup", onUp);
      renderer.domElement.removeEventListener("pointercancel", onUp);
      renderer.domElement.removeEventListener("click", onClick);
      // Dispose any active branch session geometry (memory hygiene — spec §13.2 step 6).
      const finalSession = branchSessionRef.current;
      if (finalSession) {
        finalSession.tendrils.forEach((td) => {
          td.line.geometry.dispose();
          (td.line.material as THREE.Material).dispose();
          if (td.endpointMesh) {
            (td.endpointMesh.geometry as THREE.BufferGeometry).dispose();
            (td.endpointMesh.material as THREE.Material).dispose();
          }
        });
        branchSessionRef.current = null;
      }
      cleanup();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      delete (window as unknown as Record<string, unknown>).__atlasApplyStratum;
      delete (window as unknown as Record<string, unknown>).__atlasApplySelected;
      delete (window as unknown as Record<string, unknown>).__atlasNetraJump;
    };
  }, []);

  // Re-apply stratum / selection from React state to scene refs.
  useEffect(() => {
    const apply = (window as unknown as { __atlasApplyStratum?: (k: StratumKey) => void }).__atlasApplyStratum;
    if (apply) apply(stratum);
  }, [stratum]);

  useEffect(() => {
    const apply = (window as unknown as { __atlasApplySelected?: (id: string | null) => void }).__atlasApplySelected;
    if (apply) apply(selectedId);
  }, [selectedId]);

  return (
    <div className="atlas-frame">
      {/* Frame head */}
      <header className="atlas-head">
        <div className="flex items-baseline gap-3">
          <span>OBSERVATORY · WORLDLINE STRUCTURE <b>v.07</b></span>
          <span style={{ color: "var(--ink-faint)" }}>∇ Ne0EX · 3D ORTHOGRAPHIC</span>
        </div>
        <div className="flex items-baseline gap-5">
          <span>α <i>1.130426</i></span>
          <span>NAV <i>NETRA</i></span>
        </div>
      </header>

      {/* 3-column content */}
      <div className="atlas-content">
        {/* LEFT — strata aside */}
        <aside>
          <div className="atlas-strata-head">§ STRATA · TRAVEL TARGETS</div>
          <div className="atlas-strata-list">
            {STRATA_BUTTONS.map((b) => {
              const active = stratum === b.key;
              return (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setStratum(active ? "all" : b.key)}
                  className={`atlas-strata-btn ${active ? "is-active" : ""}`}
                >
                  <span className="glyph">{b.glyph}</span>
                  <span>
                    <span className="label-id">{b.id}</span>
                    {/* Non-breaking space before "·" so "WORD ·" stays on one
                      line when the role description wraps: "POSSIBILITY ·" /
                      "FIELD" rather than "POSSIBILITY" / "· FIELD". The nbsp
                      is applied only at the render site — b.role data is unchanged. */}
                  <span className="label-role">
                    {b.role.replace(/ · /g, " · ")}
                  </span>
                  </span>
                  <span className="key">{b.numKey}</span>
                </button>
              );
            })}
          </div>

          <div className="atlas-divider" />

          {/* Current stratum annotation — replaces redundant divergence card */}
          <div className="atlas-current">
            <div className="atlas-current-key">CURRENT STRATUM</div>
            <div className="atlas-current-val">{t.hudStratum}</div>
            <div className="atlas-current-meta">{t.role}</div>
          </div>
        </aside>

        {/* CENTER — globe canvas */}
        {/* data-globe-canvas: selector anchor used by SurveyCursor to gate
            coordinate readout visibility — present only on the Three.js canvas
            container so the label hides when the cursor moves off the globe. */}
        <div className="atlas-globe-wrap" ref={containerRef} data-globe-canvas>
          <span className="atlas-axis-label t">+Z · NORTH</span>
          <span className="atlas-axis-label b">−Z · SOUTH</span>
          <span className="atlas-axis-label l">PROJECTION FIELD</span>
          <span className="atlas-axis-label r">ARCHIVE FACE</span>

          <div className="atlas-alpha-mark">α</div>

          {/* HUD */}
          <div className="atlas-hud">
            <div className="atlas-hud-corner tl">
              <div>OBSERVING</div>
              <div><b>{t.hudStratum}</b></div>
            </div>
            <div className="atlas-hud-corner tr">
              <div>CAMERA</div>
              <div><b ref={hudCamRef}>ORBIT · 0°</b></div>
            </div>
            <div className="atlas-hud-corner bl">
              <div>α &nbsp;<b className="acc">1.130426</b></div>
              <div>13.04°N · 26.00°E</div>
            </div>
            <div className="atlas-hud-corner br">
              <div>SCALE</div>
              <div>1 : 1.30E+26</div>
            </div>
          </div>

          {/* α-SOUL-ALIGN: coordinate-number overlay removed.
              α reads as its canvas marker + orange pulse alone.
              Coordinates are already surfaced in the bottom-right NETRA HUD reticle.
              Rendering lat/lon here misframed α (identity-locus) as a Bangkok GPS pin. */}
        </div>

        {/* RIGHT — stratum readout */}
        <aside className="atlas-readout">
          <div className="atlas-readout-head">§ STRATUM READOUT</div>

          <div className="atlas-readout-row is-pair">
            <span className="key">ACTIVE</span>
            <span className="val acc">{t.name}</span>
            <span className="meta">{t.role}</span>
          </div>

          <div className="atlas-readout-row is-trio">
            <div><span className="key">SURVEYED</span><span className="val acc">047</span></div>
            <div><span className="key">ACTIVE</span><span className="val">012</span></div>
            <div><span className="key">BRANCHES</span><span className="val">∞</span></div>
          </div>

          <div className="atlas-readout-row is-trio">
            <div><span className="key">BEARING</span><span className="val">TRUE N</span></div>
            <div><span className="key">RADIUS</span><span className="val">{t.hudRadius}</span></div>
            <div><span className="key">DEPTH</span><span className="val">{t.hudDepth}</span></div>
          </div>

          <div className="atlas-flow">
            <div className={`step ${t.flow === "nex" ? "is-active" : ""}`}>
              <span>01</span><span>SIGNAL EMITTED &nbsp;<b>NeX</b></span>
            </div>
            <div className={`step ${t.flow === "neon" ? "is-active" : ""}`}>
              <span>02</span><span>BORNE BY POLE &nbsp;<b>Ne0N</b></span>
            </div>
            <div className={`step ${t.flow === "neo" ? "is-active" : ""}`}>
              <span>03</span><span>ARCHIVED IN &nbsp;<b>Ne0</b></span>
            </div>
            <div className="step">
              <span>04</span><span>NAVIGATED · <span style={{ color: "var(--netra)", fontWeight: 500 }}>NETRA</span></span>
            </div>
          </div>
        </aside>
      </div>

      {/* Frame foot */}
      <footer className="atlas-foot">
        <div className="atlas-foot-row">
          <div className="cell"><span>NeX · FIELD</span><b>247 RAYS</b></div>
          <div className="cell"><span>Ne0N · POLE</span><b>+90°N</b></div>
          <div className="cell"><span>Ne0 · NODES</span><b className="acc">047</b></div>

          <div className="atlas-netra" role="status" aria-live="polite">
            <span className="reticle" aria-hidden>
              <svg width="14" height="14" viewBox="-10 -10 20 20">
                <circle r="6" fill="none" stroke="currentColor" strokeWidth="0.9" />
                <circle r="1.4" fill="currentColor" />
                <line x1="-9" y1="0" x2="-6" y2="0" stroke="currentColor" strokeWidth="0.9" />
                <line x1="6" y1="0" x2="9" y2="0" stroke="currentColor" strokeWidth="0.9" />
                <line x1="0" y1="-9" x2="0" y2="-6" stroke="currentColor" strokeWidth="0.9" />
                <line x1="0" y1="6" x2="0" y2="9" stroke="currentColor" strokeWidth="0.9" />
              </svg>
            </span>
            <span className="id-box">
              <span className="lab">◎ NETRA</span>
              <span className="tgt">{netraTarget}</span>
            </span>
            <span className="readout">
              <span>RETICLE</span><b ref={netraCoordRef}>0.00°N · 0.00°E</b>
              <span>RANGE</span><b ref={netraRangeRef}>2.50</b>
            </span>
            <button
              className="jump"
              type="button"
              onClick={() => {
                const fn = (window as unknown as { __atlasNetraJump?: () => void }).__atlasNetraJump;
                if (fn) fn();
              }}
            >
              ⟶ NEXT NODE
            </button>
          </div>
        </div>

        <div className="atlas-netra-voice" aria-live="polite">
          <span className="voice-tag">{"//"} NETRA</span>
          <span className="voice-body">{netraVoice}</span>
        </div>
      </footer>

      {/* ── Article side panel — slides in when an entry is selected ── */}
      <article
        className="absolute z-[6] flex flex-col"
        style={{
          top: 78,
          right: 22,
          bottom: 22,
          width: "min(46%, 360px)",
          background: "var(--paper-warm)",
          border: "1px solid var(--ink-primary)",
          padding: "18px 20px",
          boxShadow: "3px 3px 0 rgba(31,80,99,0.16)",
          transform: selectedId ? "translateX(0)" : "translateX(calc(100% + 30px))",
          opacity: selectedId ? 1 : 0,
          transition: "transform 520ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 320ms ease-out",
          pointerEvents: selectedId ? "auto" : "none",
        }}
        aria-hidden={!selectedId}
      >
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="absolute top-2 right-3 t-mono text-[11px] tracking-[0.2em] text-[var(--ink-soft)] hover:text-[var(--accent-orange)] transition-colors"
          aria-label="Close article"
        >
          ✕ ESC
        </button>
        {selected && (
          <>
            <div className="flex items-baseline gap-3 t-meta tracking-[0.25em] mb-1">
              <span className="t-meta-accent">FILE — {selected.fileNum}</span>
              <span className="text-[var(--ink-faint)]">/</span>
              <span className="text-[var(--ink-soft)]">{selected.date}</span>
            </div>
            <div className="t-meta tracking-[0.22em] text-[var(--ink-soft)] mb-3">
              <span className="t-meta-accent">{selected.coords.place.toUpperCase()}</span>
              <span className="text-[var(--ink-faint)] mx-1.5">·</span>
              <span>{selected.status.toUpperCase()}</span>
              <span className="text-[var(--ink-faint)] mx-1.5">·</span>
              <span>{selected.readingTime} MIN</span>
            </div>
            <h3
              className="t-display italic text-[var(--ink-primary)] mb-4"
              style={{ fontSize: 26, lineHeight: 1.05, letterSpacing: "-0.005em" }}
            >
              {selected.title}
            </h3>
            <div
              className="t-display italic text-[var(--ink-primary)]/85"
              style={{ fontSize: 14, lineHeight: 1.55, letterSpacing: "0.01em" }}
            >
              {selected.summary}
            </div>
            <div className="mt-auto pt-4 border-t border-[var(--ink-faint)]/60 flex items-center justify-between t-meta tracking-[0.22em]">
              <span className="text-[var(--ink-soft)]">
                TAGS · <span className="text-[var(--ink-primary)]">{selected.tags.join(" / ")}</span>
              </span>
              <a
                href={`#entry-${selected.fileNum}`}
                onClick={() => setSelectedId(null)}
                className="t-meta-accent tracking-[0.25em] hover:underline"
                style={{ textUnderlineOffset: 3 }}
              >
                READ ENTRY →
              </a>
            </div>
          </>
        )}
      </article>
    </div>
  );
}
