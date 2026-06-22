"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useThemeMode, type ThemeMode } from "@/lib/useThemeMode";
import {
  // OBSERVER_NODES: export kept in lib/entries.ts for harness/watchdog consumers;
  // the standalone observer-dot layer was removed 2026-06-15 (tokyo-alpha, α-SUR-01).
  type ArchiveNode,
} from "@/lib/entries";
// Place-aware globe — place-aware-globe-spec.md §2/§3/§4 + DECISION-2026-06-07 §15 (Option A).
// Consume Procyon's query API (lib/content/places.ts) — READ ONLY, do not change the schema.
import {
  getPlacesSummary,
  getPlaceContent,
  type PlaceSummary,
  type PlaceContent,
} from "@/lib/content/places";
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
 * All Three.js material colors are driven by GLOBE_PALETTES[mode] so the
 * scene rebuilds with the correct palette when the user toggles dark mode.
 *
 *   LIGHT (TEAL — Re:Boot ref · pixel-identical to pre-dark)
 *   DARK  (night register — starting point; Betelgeuse design-verifies)
 *
 *   To revert to INK baseline replace GLOBE_PALETTES.light values with:
 *   line / material color   0x1a2832
 *   surface gradient stops  #9E9377, #B5AA8B  (in lib/globe-surface.ts)
 *   surface aging blotches  rgba(120,100,70,…)  (lib/globe-surface.ts)
 *   inner-shade tint        0xcfc4ad
 *   article shadow rgba     26,40,50
 * ─────────────────────────────────────────────────────────────────────────
 */

// ─── Dark-mode globe palette ──────────────────────────────────────────────────
// Three.js materials cannot read CSS variables. GLOBE_PALETTES provides two
// complete color sets keyed by ThemeMode. buildScene() receives the active palette
// and replaces every hardcoded hex literal with palette.<name>.
//
// DARK values are a starting point derived from the task spec; Betelgeuse
// must design-verify final hex values against rendered screenshots.
//
// LIGHT values are exact current hex literals — light output is pixel-identical
// to the pre-dark-mode baseline.
interface GlobePalette {
  // Line / contour / grid / shell / axis / PLACE_INK color
  ink: number;
  // Arc / branch / pole beacon / accent color (orange)
  orange: number;
  // Inner-shade sphere tint
  innerShade: number;
  // NETRA tracker ring / halo / dot
  netraTracker: number;
  // Ambient light color
  ambient: number;
  // Key directional light color
  key: number;
  // Rim directional light color
  rim: number;
  // Article-panel shadow — rgb() components as a string "R,G,B"
  articleShadowRGB: string;
  // Multiplier on the ON-GLOBE curvation lines ONLY — the lat/long graticule
  // (lineMat/lineMatFaint) + contour rings (contourMat). NOT the orbital NeX
  // field (shells/rays), which keep full opacity. In dark the cream curvation
  // lines read far hotter against the deep sphere than teal-on-cream does in
  // light; scaling dark down restores light-mode's calm surface density.
  lineOpacityScale: number;
}

const GLOBE_PALETTES: Record<ThemeMode, GlobePalette> = {
  light: {
    ink:              0x1f5063,
    orange:           0xD4602A,
    innerShade:       0xb4bbc0,
    netraTracker:     0x4d7a92,
    ambient:          0xefe7d6,
    key:              0xfff4dd,
    rim:              0x2a3a48,
    articleShadowRGB: '31,80,99',
    lineOpacityScale: 1,
  },
  dark: {
    // Night register — deep-ocean instrument colours. Design-verified by Betelgeuse.
    // Surface stops raised in lib/globe-surface.ts (gradPole #243E4C, gradEquator #2E5060)
    // so this ambient/key/rim set reads against a visible teal field, not a black void.
    ink:              0xC8D8D4,   // cooler/dimmer than 0xD8E0DE — night lines, not blown-out
    orange:           0xE87840,   // warmer, brighter orange — legible on deep teal
    innerShade:       0x1A303A,   // deep inner shadow, slightly warmer than prior 0x16242C
    netraTracker:     0x7AB8CC,   // brighter teal tracker for dark-field visibility
    ambient:          0x3A5562,   // raised from 0x2A3A44 — moonlit instrument illumination
    key:              0xD0E4E0,   // slightly brighter cool key light
    rim:              0x5A7A8C,   // lifted rim for edge definition
    articleShadowRGB: '36,62,76',
    lineOpacityScale: 0.6,        // calm the cream graticule/shell/ray web on the dark field
  },
};

const GLOBE_RADIUS = 1;

// ─── Worldline Branching constants — 30-worldline-branching.md §9.1 + §13.2 ───
// All Three.js materials use hard-coded hex/rgba; CSS vars are inaccessible here.
// Token source: app/globals.css line 41–42 + branching spec §9.3.
const SITE_ALPHA = 1.130426;           // observer α — spec §4.3 / Procyon SITE_ALPHA
const NEX_SHELL_R = GLOBE_RADIUS * 1.18; // orbital shell radius — ontology §4.2
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

// Fallback alpha coords — Bangkok. Used if no prop supplied or DB is unseeded.
// The data-driven value arrives via WorldlineGlobeProps.alphaCoord (movable-alpha).
const ALPHA_LAT_FALLBACK = 13.7563;
const ALPHA_LON_FALLBACK = 100.5018;

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
    camPos: latLonToVec3(ALPHA_LAT_FALLBACK, ALPHA_LON_FALLBACK, 2.7),
    look: latLonToVec3(ALPHA_LAT_FALLBACK, ALPHA_LON_FALLBACK, 1.0),
    showField: false,
    showAxis: false,
    showContours: true,
    netra: "Ne0",
    // netraCoord overridden at runtime from alphaCoord prop (movable-alpha).
    netraCoord: `${ALPHA_LAT_FALLBACK.toFixed(2)}°N, ${ALPHA_LON_FALLBACK.toFixed(2)}°E`,
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
  // Ne0 place-nodes — built ASYNC from getPlacesSummary() after the scene mounts
  // (mirrors the async NeX fiction-glyph population). `nodesGroup` is the parent
  // the place-node builder appends into. `placeObjects` is the raycast registry.
  nodesGroup: THREE.Group;
  placeObjects: PlaceNodeObject[];
  observerObjects: { node: ArchiveNode; head: THREE.Mesh }[];
  // NeX fiction hit proxies — invisible spheres co-located with each fiction
  // glyph ring. Built async alongside nexFictionGlyphs; empty until fiction
  // data loads. Each mesh carries userData.fictionSlug for click routing.
  // (fiction-node-click fix — wired to onClick + onHover with occlusion guard.)
  fictionHitObjects: THREE.Mesh[];
};

/**
 * A rendered place-node on the Ne0 surface (spec §3.1 glyph: center dot +
 * concentric survey rings whose count scales with weight). Ring density is the
 * weight signal — no numeral badge (spec §3.1, §13). `hit` is the invisible
 * raycast proxy; `rings` are recolored on hover/select per the §3.4 states table.
 */
type PlaceNodeObject = {
  summary: PlaceSummary;
  dot: THREE.Mesh;
  /** ring-1 always; ring-2 when weight>=3; ring-3 when weight>=7. Index 0 = ring-1. */
  rings: THREE.Mesh[];
  hit: THREE.Mesh;
};

// ─── Place-node glyph constants — spec §3.1 (extends arc-node + alpha-node halo) ───
// These module-level values are the light-mode defaults. At runtime, the scene
// setup effect and recolor effects read from `activePaletteRef` (set at scene
// build) so they always use the correct mode's colors.
const PLACE_INK_HEX = 0x1f5063;       // --ink-primary (teal active palette) — light default
const PLACE_RING_WEIGHT_2 = 3;        // ring-2 visible at weight >= 3 (spec §3.1)
const PLACE_RING_WEIGHT_3 = 7;        // ring-3 visible at weight >= 7 (spec §3.1)
// Ring geometry tuples [inner, outer, defaultOpacity] — spec §3.1 glyph block.
const PLACE_RING_GEO: [number, number, number][] = [
  [0.022, 0.026, 0.7],   // ring-1
  [0.034, 0.037, 0.45],  // ring-2 (weight >= 3)
  [0.048, 0.05, 0.28],   // ring-3 (weight >= 7)
];

/**
 * Build one place-node glyph (dot + weight-scaled survey rings) and its hit proxy,
 * append into `nodesGroup`, and return the registry object. Spec §3.1.
 * Rings face outward (lookAt origin + rotateY π) like the existing α halo (§3.1).
 *
 * @param inkHex    - The ink color for this mode (from GLOBE_PALETTES[mode].ink).
 *                    Defaults to PLACE_INK_HEX (light mode) if omitted.
 */
function buildPlaceNode(
  summary: PlaceSummary,
  nodesGroup: THREE.Group,
  inkHex: number = PLACE_INK_HEX
): PlaceNodeObject {
  const { place, weight } = summary;
  const v = latLonToVec3(place.coord.lat, place.coord.lon, 1.005);

  // Center dot — slightly larger arc-node (spec §3.1: SphereGeometry(0.014)).
  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.014, 12, 12),
    new THREE.MeshBasicMaterial({ color: inkHex })
  );
  dot.position.copy(v);
  nodesGroup.add(dot);

  // Survey rings — ring-1 always; ring-2/3 gated by weight (density = the signal).
  const ringCount =
    1 + (weight >= PLACE_RING_WEIGHT_2 ? 1 : 0) + (weight >= PLACE_RING_WEIGHT_3 ? 1 : 0);
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < ringCount; i++) {
    const [inner, outer, opacity] = PLACE_RING_GEO[i];
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(inner, outer, 32),
      new THREE.MeshBasicMaterial({
        color: inkHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity,
      })
    );
    ring.position.copy(v.clone().multiplyScalar(1.001));
    ring.lookAt(0, 0, 0);
    ring.rotateY(Math.PI);
    ring.userData.baseOpacity = opacity;
    nodesGroup.add(ring);
    rings.push(ring);
  }

  // Invisible hit proxy — same pattern as the old entry pins. Carries placeId.
  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })
  );
  hit.position.copy(v);
  hit.renderOrder = 999;
  hit.userData.placeId = place.id;
  nodesGroup.add(hit);

  return { summary, dot, rings, hit };
}

// Procedural surface textures (paper-cream base + baked lat/long grid + async
// Earth coastline silhouette) were EXTRACTED 2026-06-03 to lib/globe-surface.ts
// (Rule 5 — single source of truth; imported at the top of this file). The
// mini-globe (components/ArchiveMiniGlobeThreeJS.tsx) imports the SAME
// buildSurfaceTextures() so the world map cannot drift between the two globes.
// Do not re-inline this function here — edit lib/globe-surface.ts.

/**
 * Build the Three.js scene for the ATLAS globe.
 *
 * @param alphaLat   - Latitude of the α observer locus.
 * @param alphaLon   - Longitude of the α observer locus.
 * @param palette    - Color set from GLOBE_PALETTES[mode]. All hex literals
 *                     are replaced by palette properties so light/dark modes
 *                     produce correct colors without any other code changes.
 * @param mode       - Theme mode string, forwarded to buildSurfaceTextures().
 */
function buildScene(
  alphaLat: number,
  alphaLon: number,
  palette: GlobePalette,
  mode: ThemeMode,
): { root: THREE.Group; scene: THREE.Scene; refs: SceneRefs; cleanup: () => void } {
  const scene = new THREE.Scene();
  scene.background = null;

  // Lights — driven by palette so dark mode gets a cooler ambient + key.
  // Ambient intensity 1.15 stays unchanged; dark palette's lower-luminance color
  // compensates. Key intensity: GUESS 0.22 in dark (vs 0.18 light) to recover
  // some brightness lost from the darker ambient. Rim is accent-only at 0.08.
  const isLight = mode === 'light';
  scene.add(new THREE.AmbientLight(palette.ambient, 1.15));
  const key = new THREE.DirectionalLight(palette.key, isLight ? 0.18 : 0.28);
  key.position.set(2, 2.5, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(palette.rim, 0.08);
  rim.position.set(-3, -1, -2);
  scene.add(rim);

  const globe = new THREE.Group();
  scene.add(globe);

  // ─── Globe surface — cream paper (light) / deep-ocean (dark) ───
  const surface = buildSurfaceTextures(mode);
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

  // Inner shade shell — gives depth at the rim. Color from palette (darkens appropriately).
  const innerShade = new THREE.Mesh(
    new THREE.SphereGeometry(0.998, 64, 64),
    new THREE.MeshBasicMaterial({ color: palette.innerShade, side: THREE.BackSide, transparent: true, opacity: 0.35 })
  );
  globe.add(innerShade);

  // ─── Engraved lat/long lines (the user explicitly wanted line contour) ───
  const lineMat = new THREE.LineBasicMaterial({ color: palette.ink, transparent: true, opacity: 0.55 * palette.lineOpacityScale });
  const lineMatFaint = new THREE.LineBasicMaterial({ color: palette.ink, transparent: true, opacity: 0.3 * palette.lineOpacityScale });

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
  const contourMat = new THREE.LineBasicMaterial({ color: palette.ink, transparent: true, opacity: 0.7 * palette.lineOpacityScale });
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
  const axisCylinderMat = new THREE.MeshBasicMaterial({ color: palette.ink });
  const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 2.6, 16), axisCylinderMat);
  axisGroup.add(axis);

  const axisLineMat = new THREE.LineBasicMaterial({ color: palette.ink });
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
      new THREE.MeshBasicMaterial({ color: palette.orange, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = yPos;
    g.add(ring);
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 12, 12),
      new THREE.MeshBasicMaterial({ color: palette.orange })
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
      color: palette.ink,
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
  const rayMat = new THREE.LineBasicMaterial({ color: palette.ink, transparent: true, opacity: 0.35 });
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

  // Ne0 place-nodes are built ASYNC from getPlacesSummary() after the scene
  // mounts (mirrors the NeX fiction-glyph async population). The registry starts
  // empty; the THREE-setup effect fills it via buildPlaceNode() and re-targets
  // the JUMP cycle.
  const placeObjects: PlaceNodeObject[] = [];

  // NeX fiction hit proxies — populated async alongside nexFictionGlyphs.
  // (fiction-node-click fix: invisible SphereGeometry(0.05) proxies at each
  // orbital position, raycast registry mirrors placeObjects pattern.)
  const fictionHitObjects: THREE.Mesh[] = [];

  // tokyo-alpha: observer-node layer REMOVED (2026-06-15, α-SUR-01).
  // The separate α / 012 / 047 observer dots were vestigial decoration with no
  // content and no navigable destination. The α identity is now merged onto the
  // PLACE node: whichever place has isAlpha=true renders with the orange accent
  // dot+ring+α-prefix (data-driven via the place-recolor effect below).
  // OBSERVER_NODES import is kept for lib/entries.ts consumers; not used here.
  const observerObjects: { node: ArchiveNode; head: THREE.Mesh }[] = [];
  // alphaRing is no longer built as a standalone object — kept null so the tick's
  // `if (refs.alphaRing)` guard is a harmless no-op.
  const alphaRing: THREE.Mesh | null = null;

  // NETRA active tracker — exact surface anchor, kept on the globe so the
  // marker follows ATLAS rotation while the camera follows with softened lag.
  const netraTracker = new THREE.Group();
  netraTracker.visible = false;
  const trackerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.045, 0.06, 48),
    new THREE.MeshBasicMaterial({ color: palette.netraTracker, side: THREE.DoubleSide, transparent: true, opacity: 0.92 })
  );
  const trackerHalo = new THREE.Mesh(
    new THREE.RingGeometry(0.075, 0.078, 64),
    new THREE.MeshBasicMaterial({ color: palette.netraTracker, side: THREE.DoubleSide, transparent: true, opacity: 0.34 })
  );
  const trackerDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.009, 12, 12),
    new THREE.MeshBasicMaterial({ color: palette.netraTracker })
  );
  netraTracker.add(trackerRing, trackerHalo, trackerDot);
  globe.add(netraTracker);

  // ─── Worldline arc — α point swooping out into NeX field ───
  // movable-alpha: arc origin uses the data-driven alpha locus (passed as param).
  const arcStart = latLonToVec3(alphaLat, alphaLon, 1.01);
  const arcMid = arcStart.clone().multiplyScalar(1.35).add(new THREE.Vector3(0.2, 0.15, 0));
  const arcEnd = arcStart.clone().multiplyScalar(1.55).add(new THREE.Vector3(0.4, 0.3, -0.1));
  const arcCurve = new THREE.QuadraticBezierCurve3(arcStart, arcMid, arcEnd);
  const arcPts = arcCurve.getPoints(64);
  const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPts);
  const arcMat = new THREE.LineDashedMaterial({
    color: palette.orange,
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
      nodesGroup,
      placeObjects,
      observerObjects,
      fictionHitObjects,
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

/** movable-alpha: coords of the current alpha locus. Fetched server-side from
 * the places table (is_alpha=true). Falls back to Bangkok if omitted. */
interface WorldlineGlobeProps {
  alphaCoord?: { lat: number; lon: number };
}

export function WorldlineGlobe({ alphaCoord }: WorldlineGlobeProps = {}) {
  // Resolve effective alpha coords — data-driven from prop, fallback to Bangkok.
  // movable-alpha: these values replace the former ALPHA_LAT / ALPHA_LON constants.
  const alphaLat = alphaCoord?.lat ?? ALPHA_LAT_FALLBACK;
  const alphaLon = alphaCoord?.lon ?? ALPHA_LON_FALLBACK;

  // Stable ref so the once-bound THREE effect closure can read the live alpha
  // without going stale across renders (the prop won't change after mount, but
  // the ref pattern is consistent with selectedIdRef / stratumRef).
  const alphaCoordRef = useRef({ lat: alphaLat, lon: alphaLon });

  // Dark-mode recoloring — useThemeMode() subscribes to <html data-theme> via
  // MutationObserver. The THREE setup effect depends on `mode` so it tears down
  // and rebuilds the scene with the correct palette when the user toggles.
  // Reads "light" until mounted (SSR-safe), then reflects the live attribute.
  const mode = useThemeMode();
  // Stable ref so the setInterval tick closure can read the current mode
  // without stale-capture (the tick reads articleShadowRGB for the drop-shadow).
  const modeRef = useRef<ThemeMode>(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  // activePaletteRef — written at the top of the THREE setup effect when palette
  // is resolved. Recolor effects (selectedId, placeSummaries) read from it so
  // they always apply the correct ink/orange for the current mode — not the
  // module-level PLACE_INK_HEX / PLACE_ACCENT_HEX light defaults.
  const activePaletteRef = useRef<GlobePalette>(GLOBE_PALETTES.light);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const [stratum, setStratum] = useState<StratumKey>("all");
  // `selectedId` now holds the SELECTED PLACE ID (slug, e.g. "bangkok") — the
  // place-node era repurposes the old entry-selection machine (one selection
  // state, one camera-focus effect, one ESC path). Null = no place open.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ─── Place-aware globe state — spec §3/§4 + DECISION §15 (Option A) ───
  // Loaded async from Procyon's query API (lib/content/places.ts), same
  // dynamic-velite-import pattern getFiction() already uses in this file.
  const [placeSummaries, setPlaceSummaries] = useState<PlaceSummary[]>([]);
  // Per-place full content (highlights + dig-to-all), fetched lazily on first
  // open and memoized so re-selecting a place is instant.
  const [placeContentCache, setPlaceContentCache] = useState<
    Record<string, PlaceContent>
  >({});
  // Dig-deeper expansion state for the open front-door panel (spec §4.3).
  const [digOpen, setDigOpen] = useState(false);
  // Hovered place summary — drives the §3.2 hover NETRA line. Set from the THREE
  // hover handler; null when not hovering a place-node.
  const [hoveredPlace, setHoveredPlace] = useState<PlaceSummary | null>(null);
  const hoveredPlaceIdRef = useRef<string | null>(null);

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
  // Mirror dig state for the once-bound keydown handler closure (same reason
  // selectedIdRef exists — the handler is bound with [] deps).
  const digOpenRef = useRef(false);
  useEffect(() => { stratumRef.current = stratum; }, [stratum]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { digOpenRef.current = digOpen; }, [digOpen]);
  // Collapse the dig expansion whenever the selected place changes/closes.
  // When deselecting (selectedId → null) also clear the hover state so the
  // NETRA voice line doesn't keep narrating the previously-hovered place.
  // The next genuine pointermove re-establishes hover if the cursor is on a node.
  // (fix: netra-stale-voice · α-SUR-01 · wiring-wave1)
  useEffect(() => {
    setDigOpen(false);
    if (selectedId === null) {
      setHoveredPlace(null);
      hoveredPlaceIdRef.current = null;
    }
  }, [selectedId]);

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

  // Selected place — its summary (weight/name/coord, always available once
  // summaries load) and its full content (highlights + dig list, lazy-fetched).
  const summaryById = useMemo(
    () => Object.fromEntries(placeSummaries.map((s) => [s.place.id, s])),
    [placeSummaries]
  );
  const selectedSummary = selectedId ? summaryById[selectedId] ?? null : null;
  const selectedContent = selectedId ? placeContentCache[selectedId] ?? null : null;

  const t = STRATA[stratum];

  /**
   * NETRA voice — companion-intelligence framing line shown below the console.
   * Priority (highest to lowest):
   *   1. branchVoice — NeX branching Q-F/Q-G lines (Vega locked copy)
   *   2. selected place trace line (spec §3.3 / §3.4 states table)
   *   3. current stratum voice
   * Per spec §13.2 step 7: NETRA voice update uses existing aria-live strip.
   */
  const placeVoice = (() => {
    if (!selectedSummary) return null;
    const name = selectedSummary.place.name.toLowerCase();
    const n = selectedSummary.weight;
    if (n === 0) return `trace · ${name} · no records anchored here yet.`;
    if (digOpen) return `trace · ${name} · full archive surface. ${n} records.`;
    if (selectedSummary.hasHighlights)
      return `trace · ${name} · highlights surface. dig to see all.`;
    return `trace · ${name} · ${n} records. no highlights curated yet.`;
  })();

  // Hover NETRA line (spec §3.2) — instrument narration on pointer-enter; only
  // when no place is selected (a selected place owns the voice strip).
  const hoverVoice =
    !selectedSummary && hoveredPlace
      ? `PLACE · ${hoveredPlace.place.name.toUpperCase()} · ${hoveredPlace.weight} RECORD${hoveredPlace.weight === 1 ? "" : "S"} ARCHIVED`
      : null;

  const netraVoice = branchVoice
    ? branchVoice
    : placeVoice
      ? placeVoice
      : hoverVoice
        ? hoverVoice
        : t.voice;

  // ─── Load all place summaries once (weight + hasHighlights for every node) ───
  // Same dynamic-velite-import path as getFiction(); wrapped in try/catch for the
  // same robustness parity (assertHighlightConstraints can throw on bad data —
  // the globe must still render without place-nodes rather than blank).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const summaries = await getPlacesSummary();
        if (!cancelled) setPlaceSummaries(summaries);
      } catch {
        // Non-fatal: globe + observer/NeX layers still work without place-nodes.
        console.warn("[WorldlineGlobe] Place summary load failed — place-nodes unavailable.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /**
   * Open a place front-door panel: set selection (drives camera + panel) and
   * lazy-fetch the place's full content (highlights + dig-to-all), memoized.
   * Spec §3.3 (select) + §4.2 (front door). DECISION §15 Option A: a place with
   * content but no highlights still opens (panel shows only DIG DEEPER + NETRA).
   */
  const openPlace = useCallback(
    (placeId: string) => {
      setSelectedId(placeId);
      setDigOpen(false);
      if (!placeContentCacheRef.current[placeId]) {
        (async () => {
          try {
            const content = await getPlaceContent(placeId);
            if (content) setPlaceContentCache((c) => ({ ...c, [placeId]: content }));
          } catch {
            console.warn(`[WorldlineGlobe] Place content load failed for "${placeId}".`);
          }
        })();
      }
    },
    []
  );
  // Latest-openPlace ref so the once-bound THREE click/jump closures can invoke
  // it without going stale. placeContentCacheRef likewise feeds the dedupe check.
  const openPlaceRef = useRef(openPlace);
  useEffect(() => { openPlaceRef.current = openPlace; }, [openPlace]);
  // setSelectedIdRef — mirrors setSelectedId so the once-bound THREE closure can
  // call it without hitting a minifier variable-shadow issue. The THREE useEffect
  // ([] deps) declares local variables T/A/I for THREE.Group objects; without this
  // ref, the minifier may shadow the outer `setSelectedId` binding with those locals,
  // making setSelectedId(null) silently no-op inside jumpToFictionPin.
  // (B1 root-cause fix · qa-fix-wave3 · α-SUR-01)
  const setSelectedIdRef = useRef(setSelectedId);
  useEffect(() => { setSelectedIdRef.current = setSelectedId; }, [setSelectedId]);
  const placeContentCacheRef = useRef(placeContentCache);
  useEffect(() => { placeContentCacheRef.current = placeContentCache; }, [placeContentCache]);

  // ESC / D — place-panel keyboard map (spec §9 keyboard table).
  //   ESC: if dug-open → collapse to highlights (1st press); if at highlights →
  //        close panel; if no panel → reset stratum to "all".
  //   D:   activate dig-deeper when a place panel is open (matches 1/2/3 convention).
  // The handler is bound once ([] deps) — it reads selectedIdRef/digOpenRef
  // mirrors, never stale state.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedIdRef.current && digOpenRef.current) setDigOpen(false);
        else if (selectedIdRef.current) setSelectedId(null);
        else setStratum("all");
      } else if (e.key === "d" || e.key === "D") {
        if (selectedIdRef.current && !digOpenRef.current) setDigOpen(true);
      } else if (e.key === "1") setStratum((s) => (s === "neo" ? "all" : "neo"));
      else if (e.key === "2") setStratum((s) => (s === "neon" ? "all" : "neon"));
      else if (e.key === "3") setStratum((s) => (s === "nex" ? "all" : "nex"));
      else if (e.key === "0") setStratum("all");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Jump-to-next-node (NETRA) — cycles through observer + place + fiction nodes.
  // movable-alpha: initialised to -1 so the first click increments to 0 (the α
  // observer node — Bangkok today) rather than 1 (012/Tokyo).
  const jumpIdxRef = useRef(-1);
  // Extended jump target: optional fictionSlug marks NeX orbital nodes (no
  // real-world coords); optional placeId marks a clickable Ne0 place-node so the
  // JUMP cycle opens its front-door panel (spec §9 keyboard table).
  type JumpTarget = {
    label: string;
    place: string;
    coords: { lat: number; lon: number };
    fictionSlug?: string; // set for NeX fiction nodes
    placeId?: string;      // set for Ne0 place-nodes
  };
  const jumpTargetsRef = useRef<JumpTarget[]>([]);
  // Fiction jump targets are appended after async fiction load; kept separate so
  // the place-summary effect can rebuild the surface targets without clobbering
  // the fiction tail. The combined list is observer+place THEN fiction.
  const fictionJumpTargetsRef = useRef<JumpTarget[]>([]);
  // Latest summaries for once-bound closures (fiction-load rebuild).
  const placeSummariesRef = useRef<PlaceSummary[]>([]);
  const rebuildJumpTargets = useCallback((summaries: PlaceSummary[]) => {
    placeSummariesRef.current = summaries;

    // tokyo-alpha: observer-α cycle stop REMOVED (2026-06-15, α-SUR-01).
    // The standalone observer α entry is gone — the alpha-locus PLACE is now
    // the first cycle stop, rendered with orange accent + 'α · ' prefix.
    // Place nodes: alpha place first (isAlpha=true sorted top), then the rest.
    // The alpha place gets the 'α · ' prefix on its label so the NETRA readout
    // shows e.g. "α · BANGKOK · Bangkok · TH" — distinguishing it as the locus.
    const surface: JumpTarget[] = summaries
      .slice()
      .sort((a, b) => (b.isAlpha ? 1 : 0) - (a.isAlpha ? 1 : 0))
      .map((s) => {
        const baseName = s.place.name.split(" · ")[0].toUpperCase();
        return {
          label: s.isAlpha ? `α · ${baseName}` : baseName,
          place: s.place.name,
          coords: { lat: s.place.coord.lat, lon: s.place.coord.lon },
          placeId: s.place.id,
        };
      });
    jumpTargetsRef.current = [...surface, ...fictionJumpTargetsRef.current];
  }, []);
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

  // Live scene refs — set inside the THREE setup effect so the place-node
  // build/recolor effect (which depends on async data + selection) can reach
  // into the persistent scene without tearing it down.
  const sceneRefsRef = useRef<SceneRefs | null>(null);

  // Seed jump targets with observer nodes immediately; place-nodes join once the
  // async summary load resolves, fiction nodes after their own async load.
  useEffect(() => {
    rebuildJumpTargets(placeSummaries);
  }, [placeSummaries, rebuildJumpTargets]);

  // ─── THREE setup ───
  // `mode` is in deps: when the user toggles dark mode, useThemeMode() returns a
  // new value, this effect re-runs (cleanup → teardown → rebuild with new palette).
  // The setInterval loop is preserved — clearInterval fires in cleanup, a fresh
  // setInterval starts in the new run. This is intentional (iOS Safari robustness
  // comment preserved; do NOT replace with requestAnimationFrame).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Resolve the active color palette for this render. All Three.js material
    // hex literals in buildScene() come from this object — never hardcoded.
    // activePaletteRef is updated immediately so recolor effects (selectedId /
    // placeSummaries) that run after this setup can use the same palette.
    const palette = GLOBE_PALETTES[mode];
    activePaletteRef.current = palette;

    // Hydration-safe reduced-motion read — inside useEffect, not during render.
    // Per AGENTS.md quality bar: check prefers-reduced-motion in useEffect only.
    reducedMotionRef.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // movable-alpha: pass current alpha coords into scene construction so the
    // observer α ring, the worldline arc, and camera framing all start at the
    // data-driven locus rather than the former Bangkok hardcode.
    // Dark-mode: `mode` controls surface gradient + aging blotch palette.
    const { scene, refs, cleanup } = buildScene(
      alphaCoordRef.current.lat,
      alphaCoordRef.current.lon,
      palette,
      mode,
    );
    sceneRefsRef.current = refs;

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
    // CW-11 · Globe pointer capture mobile scroll fix (ux-journey, α-SUR-01, 2026-06-14)
    // setPointerCapture in pointerdown swallows all touch events including vertical
    // scroll. A finger on the 324×380px canvas cannot scroll the page past it.
    // Fix: track the initial touch direction. If the gesture is predominantly vertical
    // (|deltaY| > |deltaX| with threshold ~8px), release pointer capture so the page
    // can scroll. For touch pointers, delay capture until we know the direction.
    let captureId: number | null = null;
    let startX = 0;
    let startY = 0;
    let captureDecided = false;

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      startX = e.clientX;
      startY = e.clientY;
      captureDecided = false;
      captureId = e.pointerId;
      // For mouse, capture immediately (no vertical scroll conflict).
      // For touch, defer until direction is known in onMoveDrag.
      if (e.pointerType !== "touch") {
        renderer.domElement.setPointerCapture(e.pointerId);
        captureDecided = true;
      }
    };
    const onMoveDrag = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;

      // CW-11 touch direction guard: decide capture on first meaningful move.
      // Belt-and-suspenders alongside touch-action:pan-y on the canvas (Betelgeuse S1 CSS):
      // pan-y lets the browser own vertical scroll natively; this guard additionally
      // prevents setPointerCapture from locking a vertical swipe into globe rotation.
      if (!captureDecided && e.pointerType === "touch" && captureId !== null) {
        const totalDx = Math.abs(e.clientX - startX);
        const totalDy = Math.abs(e.clientY - startY);
        if (totalDx < 4 && totalDy < 4) return; // below threshold — wait
        captureDecided = true;
        if (totalDy > totalDx) {
          // Vertical swipe — release so page scrolls; kill the drag
          dragging = false;
          try { renderer.domElement.releasePointerCapture(captureId); } catch {}
          captureId = null;
          return;
        }
        // Horizontal swipe — capture to enable globe rotation
        try { renderer.domElement.setPointerCapture(e.pointerId); } catch {}
      }
      const sk = stratumRef.current;
      if (sk === "all") {
        // "all": globe spins in place; camera is centre-aligned so this is orbit-equivalent.
        clearNetraLock();
        baseRotY += dx * 0.005;
        refs.globe.rotation.y = baseRotY;
      } else if (sk === "nex") {
        // Fix #3 (NeX orbit): orbit the CAMERA around the globe centre (Y-axis rotation of
        // the position vector) instead of spinning the globe geometry. This keeps the orbital
        // shells visually stable and gives a true "swing around the surface" feel.
        // Per soul rules: camera must orbit the surface (slerp / great-circle), never clip.
        // Direction fix (α-SUR-01 · nex-drag): orbiting the camera by +angle produces the
        // OPPOSITE apparent surface motion vs rotating the globe geometry by +dx (as `all`/
        // `neo` do). Negating the angle makes the perceived surface direction match.
        const angle = -dx * 0.005;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const cx = camera.position.x;
        const cz = camera.position.z;
        camera.position.x = cx * cosA + cz * sinA;
        camera.position.z = -cx * sinA + cz * cosA;
        // Ensure radius floor — orbit rotation preserves radius but float-error can drift.
        enforceRadiusFloor();
        camera.lookAt(currentLook);
      } else if (sk === "neo") {
        // Fix #2 (Ne0 drag): allow manual drag-rotate in the Ne0 (surface archive) stratum.
        // clearNetraLock() releases the α soft-track so the user can drag away from Bangkok
        // (manual override intent) — the camera stops following α and holds wherever it lands.
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

      // Globe-sphere occlusion guard (globe-through-click fix, ontology §11.6):
      // A hit proxy is accepted only when it is in front of (or on the surface
      // of) the globe sphere. Far-side proxies whose distance exceeds the sphere
      // hit distance by more than the epsilon are rejected — the globe occludes
      // them. Epsilon 0.06 covers limb-graze cases where the proxy SphereGeometry
      // (r=0.05 at r≈1.005 surface) still legitimately precedes the sphere hit.
      const sphereHits = raycaster.intersectObject(refs.globeSphere, false);
      const sphereDist = sphereHits.length > 0 ? sphereHits[0].distance : Infinity;
      const isVisible = (proxyDist: number) => proxyDist <= sphereDist + 0.06;

      // Place-node hit proxies.
      const pinHits = raycaster.intersectObjects(refs.placeObjects.map((p) => p.hit), false);
      if (pinHits.length > 0 && isVisible(pinHits[0].distance)) {
        const placeId = (pinHits[0].object as THREE.Mesh).userData.placeId as string | undefined;
        if (placeId) openPlaceRef.current(placeId);
        return;
      }

      // Fiction NeX hit proxies (fiction-node-click fix, branching spec §5.2):
      // Direct click on a NeX orbital node navigates to the fiction jump path —
      // same camera slerp + activateBranches as NETRA JUMP, factored into
      // jumpToFictionPin() below.
      const fictionHits = raycaster.intersectObjects(refs.fictionHitObjects, false);
      if (fictionHits.length > 0 && isVisible(fictionHits[0].distance)) {
        const slug = (fictionHits[0].object as THREE.Mesh).userData.fictionSlug as string | undefined;
        if (slug) jumpToFictionPin(slug);
        return;
      }

      // Miss — fall through to deselect (existing behavior).
      if (selectedIdRef.current) {
        setSelectedId(null);
      }
    };
    const onHover = (e: PointerEvent) => {
      const r = container.getBoundingClientRect();
      ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);

      // Globe-sphere occlusion guard — hoisted above pin-cursor gate so both
      // the place-pin glow and fiction-proxy cursor checks can share it.
      // (globe-through-click fix, ontology §11.6: far-side proxies rejected.)
      const sphereHits = raycaster.intersectObject(refs.globeSphere, false);
      const sphereDist = sphereHits.length > 0 ? sphereHits[0].distance : Infinity;
      const isVisible = (proxyDist: number) => proxyDist <= sphereDist + 0.06;

      // Cursor style — place-node hit proxies take priority; fiction proxies
      // as fallback. Both gated by occlusion. (fiction-node-click fix: cursor
      // shows pointer on NeX orbital node hover, matching place-pin behavior.)
      const pinHits = raycaster.intersectObjects(refs.placeObjects.map((p) => p.hit), false);
      const pinVisible = pinHits.length > 0 && isVisible(pinHits[0].distance);
      let fictionHoverVisible = false;
      if (!pinVisible) {
        const fHits = raycaster.intersectObjects(refs.fictionHitObjects, false);
        fictionHoverVisible = fHits.length > 0 && isVisible(fHits[0].distance);
      }
      renderer.domElement.style.cursor = pinVisible || fictionHoverVisible ? "pointer" : "";

      // Hover ring-1 glow (spec §3.2): hovered, non-selected place → ring-1 0.95.
      // Restore others to base. Selected place is owned by the selection effect
      // (orange) — never overridden here. NETRA hover voice is surfaced via the
      // hover target name set on the React side.
      // Only apply glow when the pin is not occluded by the globe.
      const hoveredHit = pinVisible ? (pinHits[0].object as THREE.Mesh) : null;
      const hoveredId = hoveredHit ? (hoveredHit.userData.placeId as string | undefined) : undefined;
      if (hoveredId !== hoveredPlaceIdRef.current) {
        hoveredPlaceIdRef.current = hoveredId ?? null;
        for (const node of refs.placeObjects) {
          if (node.summary.place.id === selectedIdRef.current) continue; // selected owns its color
          const ring1 = node.rings[0];
          if (!ring1) continue;
          const mat = ring1.material as THREE.MeshBasicMaterial;
          const base = (ring1.userData.baseOpacity as number) ?? PLACE_RING_GEO[0][2];
          mat.opacity = node.summary.place.id === hoveredId ? 0.95 : base;
        }
        setHoveredPlace(
          hoveredId
            ? refs.placeObjects.find((p) => p.summary.place.id === hoveredId)?.summary ?? null
            : null
        );
      }

      // Globe sphere hit-test — earth-fixed coordinate gate.
      // Raycaster returns world-space intersection points; un-rotate by the
      // globe group's current Y-rotation to recover earth-fixed lat/lon.
      // A pointer over any overlay (TRIANGULATE, article panel) never reaches
      // the canvas element's pointermove, so the miss path covers that case too.
      // sphereHits already computed above (shared with occlusion guard).
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
      // Clear place hover glow + NETRA hover line.
      if (hoveredPlaceIdRef.current !== null) {
        for (const node of refs.placeObjects) {
          if (node.summary.place.id === selectedIdRef.current) continue;
          const ring1 = node.rings[0];
          if (!ring1) continue;
          const mat = ring1.material as THREE.MeshBasicMaterial;
          mat.opacity = (ring1.userData.baseOpacity as number) ?? PLACE_RING_GEO[0][2];
        }
        hoveredPlaceIdRef.current = null;
        setHoveredPlace(null);
      }
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
      // movable-alpha: read current alpha locus from ref (not the old hardcoded constant).
      const aLat = alphaCoordRef.current.lat;
      const aLon = alphaCoordRef.current.lon;
      if (key === "neo") {
        setNetraLock({ lat: aLat, lon: aLon }, 2.7);
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
          // movable-alpha: use the ref-based alpha locus (not the old constant).
          const track = cameraTrack({ lat: aLat, lon: aLon }, 2.7);
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

    // Place-selected camera focus — orbit camera to face the selected place-node
    // coord (spec §3.3 / §8: 700–1000ms easeInOutCubic, no chord through globe).
    // `id` is now a placeId; coords resolve from the async-built place registry.
    const applySelected = (id: string | null) => {
      if (!id) {
        applyStratum(stratumRef.current);
        return;
      }
      const node = refs.placeObjects.find((p) => p.summary.place.id === id);
      if (!node) return;
      const coords = {
        lat: node.summary.place.coord.lat,
        lon: node.summary.place.coord.lon,
      };
      setNetraLock(coords, 2.4);
      const startPos = camera.position.clone();
      const startLook = currentLook.clone();
      const dur = 900;
      const t0 = performance.now();
      cameraAnim = (now: number) => {
        const k = Math.min(1, (now - t0) / dur);
        const e = easeInOutCubic(k);
        const { position: camTarget, look: lookTarget } = cameraTrack(coords, 2.4);
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
        // Color from palette (orange shifts slightly between light/dark modes).
        const mat = new THREE.LineDashedMaterial({
          color: palette.orange,
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
          color: palette.orange,
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
            color: palette.orange,
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

    /**
     * Navigate to a NeX fiction node by slug — camera slerp + activateBranches.
     * Factored out of the NETRA jump handler so direct canvas click (fiction-node-click
     * fix, branching spec §5.2 trigger table: "node clicked → setSelectedId") and
     * the NETRA JUMP key can share one path without duplication.
     *
     * label/place strings are derived here from the pin to keep both callers DRY.
     * Do NOT open a place panel — fiction nodes have no place content.
     */
    const jumpToFictionPin = (slug: string) => {
      const pin = fictionPinsRef.current.find((p) => p.slug === slug);
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
      //
      // B1 fix (qa-fix-wave3): dismiss any open PlaceFrontDoorPanel before
      // entering the NeX orbital view. PlaceFrontDoorPanel renders open={!!selectedId};
      // this call mirrors the ESC / click-miss / onClose dismissal paths that
      // jumpToFictionPin bypasses via its caller's early return in __atlasNetraJump.
      // Use setSelectedIdRef.current instead of direct setSelectedId to avoid the
      // minifier variable-shadow: the THREE effect declares local T/A/I for THREE.Group
      // objects; direct `setSelectedId` compiles to the same letter that gets shadowed,
      // silently calling THREE.Group(null) instead of the React state setter.
      setSelectedIdRef.current(null);
      clearNetraLock();
      nexActiveRef.current = true;
      const label = slug.replace(/^transmission-/, "t.");
      const place = `NeX · ${pin?.domain ?? "identity"}`;
      setNetraTarget(`${label} · ${place}`);
    };

    // NETRA jump — extended for fiction NeX nodes.
    (window as unknown as { __atlasNetraJump?: () => void }).__atlasNetraJump = () => {
      const targets = jumpTargetsRef.current;
      if (!targets.length) return;
      jumpIdxRef.current = (jumpIdxRef.current + 1) % targets.length;
      const n = targets[jumpIdxRef.current];

      // Check if this is a NeX fiction node — delegate to the shared jump path.
      const fictionSlug = n.fictionSlug;
      if (fictionSlug) {
        jumpToFictionPin(fictionSlug);
        return;
      }

      // Ne0 place-node — JUMP opens its front-door panel (spec §9 keyboard table).
      // openPlace() sets selection → the selectedId effect drives applySelected,
      // which owns the camera focus + NETRA lock for places. We only set the
      // NETRA target label here so JUMP and click share one camera path.
      if (n.placeId) {
        deactivateBranches();
        openPlaceRef.current(n.placeId);
        setNetraTarget(`${n.label} · ${n.place}`);
        return;
      }

      // Standard Ne0 surface node (observer α — no panel, camera only).
      // globe-nextnode fix: 012/047 removed from cycle; this branch is now α-only.
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

    // QA debug-state hook — read-only snapshot for deterministic verification.
    // Matches the __atlasApplyStratum / __atlasApplySelected / __atlasNetraJump
    // family pattern; deleted in the same cleanup block below.
    (window as unknown as {
      __atlasDebugState?: () => {
        stratum: StratumKey;
        camX: number; camZ: number;
        camAzimuth: number;
        globeRotY: number;
      };
    }).__atlasDebugState = () => ({
      stratum: stratumRef.current,
      camX: camera.position.x,
      camZ: camera.position.z,
      camAzimuth: Math.atan2(camera.position.x, camera.position.z),
      globeRotY: refs.globe.rotation.y,
    });

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
        // Color from the current palette captured at scene build time.
        const glyphMat = new THREE.MeshBasicMaterial({
          color: palette.ink,
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

          // Invisible hit proxy — same buildPlaceNode pattern (SphereGeometry(0.05),
          // opacity 0, depthWrite false). Carries fictionSlug for onClick routing.
          // (fiction-node-click fix: proxies are registered in fictionHitObjects and
          // raycasted in onClick/onHover with globe-sphere occlusion guard.)
          const hitProxy = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })
          );
          hitProxy.position.copy(pos);
          hitProxy.renderOrder = 999;
          hitProxy.userData.fictionSlug = pin.slug;
          refs.nexFictionGlyphs.add(hitProxy);
          refs.fictionHitObjects.push(hitProxy);
        });

        // Append fiction targets to jump list — stored separately so the
        // place-summary rebuild never clobbers the fiction tail.
        fictionJumpTargetsRef.current = pins.map((pin) => ({
          label: pin.slug.replace(/^transmission-/, "t."),
          place: `NeX · ${pin.domain}`,
          // Virtual orbital coord — we use lat=0 lon=0 as placeholder;
          // camera tracking uses nexOrbitalPosition(), not these coords.
          coords: { lat: 0, lon: 0 },
          fictionSlug: pin.slug,
        }));
        rebuildJumpTargets(placeSummariesRef.current);
      } catch {
        // Fiction load failure is non-fatal. Globe works without NeX branching.
        // Intentional console.warn: surfaces load failures in browser devtools.
        console.warn("[WorldlineGlobe] Fiction data load failed — NeX branching unavailable.");
      }
    })();

    // Initial stratum.
    applyStratum("all");

    // Render loop — setInterval(tick, 16) for iOS Safari + harness robustness.
    // rAF was tried in the S1 mobile pass but iOS Safari throttles/defers rAF under
    // certain visibility conditions, leaving the canvas permanently blank after the sync
    // first frame below. setInterval ticks unconditionally. One synchronous tick() is
    // called first so the harness can screenshot the initial frame immediately.
    // The CW-11 direction guard below (~onMoveDrag) remains as belt-and-suspenders;
    // touch-action:pan-y (added by Betelgeuse in globals.css) now owns vertical scroll.
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
          // Fix (α-SUR-01 · nex-rotation): signs must match the direction convention
          // established by the `all` stratum (nexField counter-rotates → negative delta;
          // raysGroup co-rotates → positive delta). The original +/- here caused a jarring
          // direction reversal on all→nex transition. Rate changes (0.04→0.08 / 0.06
          // unchanged) are fine — acceleration is imperceptible compared to a sign flip.
          refs.nexField.rotation.y -= dt * 0.08;
          refs.raysGroup.rotation.y += dt * 0.06;
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
    // Sync first frame — harness requires a rendered frame before its screenshot hook fires.
    tick();
    // setInterval chosen over requestAnimationFrame for iOS Safari robustness:
    // iOS Safari can throttle/defer rAF so only the sync first frame above paints,
    // then rAF never advances → permanent blank canvas. setInterval ticks reliably
    // regardless of visibility/throttle policy. Original intent preserved from
    // pre-mobile-pass ("harness robustness" comment).
    const intervalId = window.setInterval(tick, 16);

    return () => {
      window.clearInterval(intervalId);
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
      sceneRefsRef.current = null;
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      delete (window as unknown as Record<string, unknown>).__atlasApplyStratum;
      delete (window as unknown as Record<string, unknown>).__atlasApplySelected;
      delete (window as unknown as Record<string, unknown>).__atlasNetraJump;
      delete (window as unknown as Record<string, unknown>).__atlasDebugState;
    };
    // movable-alpha: rebuildJumpTargets is a useCallback stable across renders;
    // it is captured once at mount inside the once-bound THREE scene closure and
    // called only when fiction nodes load. Adding it to deps would tear down the
    // entire THREE scene on every placeSummaries change — incorrect.
    //
    // dark-mode: `mode` IS in deps — when the user toggles dark/light, this
    // effect tears down (clearInterval, dispose, removeChild) and rebuilds the
    // scene with GLOBE_PALETTES[mode]. This is the correct and intended behavior:
    // Three.js materials cannot hot-swap CSS vars, so a full scene rebuild is
    // the only safe path. The setInterval loop restarts in the new run; the
    // iOS Safari deliberate-setInterval choice (not rAF) is preserved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Re-apply stratum / selection from React state to scene refs.
  useEffect(() => {
    const apply = (window as unknown as { __atlasApplyStratum?: (k: StratumKey) => void }).__atlasApplyStratum;
    if (apply) apply(stratum);
  }, [stratum]);

  useEffect(() => {
    const apply = (window as unknown as { __atlasApplySelected?: (id: string | null) => void }).__atlasApplySelected;
    if (apply) apply(selectedId);
  }, [selectedId]);

  // ─── Build Ne0 place-nodes into the live scene when summaries resolve ───
  // Mirrors the async NeX fiction-glyph population: the scene mounts once, this
  // effect fills nodesGroup once summaries are loaded (whichever order they
  // resolve). Idempotent — only builds when placeObjects is still empty.
  // Dark-mode: passes activePaletteRef.ink so nodes render in the correct color
  // for the current mode (activePaletteRef is set at scene-build time).
  useEffect(() => {
    const refs = sceneRefsRef.current;
    if (!refs || placeSummaries.length === 0 || refs.placeObjects.length > 0) return;
    for (const summary of placeSummaries) {
      refs.placeObjects.push(buildPlaceNode(summary, refs.nodesGroup, activePaletteRef.current.ink));
    }
  }, [placeSummaries]);

  // ─── Alpha-on-place accent: paint the isAlpha place node ORANGE (data-driven) ───
  // tokyo-alpha (2026-06-15, α-SUR-01): the separate observer α dot is gone.
  // The place whose isAlpha=true gets the --accent-orange treatment on its dot +
  // ring-1 + ring-2 so it reads as the α locus visually. This runs AFTER the
  // selection recolor effect in dep-order; the selection effect (selectedId,
  // placeSummaries) handles a selected alpha place's own orange treatment already,
  // so this effect only applies the persistent accent when the place is NOT selected.
  // Dark-mode: reads activePaletteRef so ink/orange use the current mode's values.
  useEffect(() => {
    const refs = sceneRefsRef.current;
    if (!refs || placeSummaries.length === 0) return;
    const pal = activePaletteRef.current;
    for (const node of refs.placeObjects) {
      const isAlpha = node.summary.isAlpha;
      const isSel = node.summary.place.id === selectedId;
      if (isAlpha && !isSel) {
        // Persistent alpha accent — orange dot + ring-1 full / ring-2 mid.
        (node.dot.material as THREE.MeshBasicMaterial).color.setHex(pal.orange);
        node.rings.forEach((ring, i) => {
          const mat = ring.material as THREE.MeshBasicMaterial;
          const base = (ring.userData.baseOpacity as number) ?? PLACE_RING_GEO[i][2];
          if (i < 2) {
            mat.color.setHex(pal.orange);
            mat.opacity = i === 0 ? 0.95 : 0.6;
          } else {
            mat.color.setHex(pal.ink);
            mat.opacity = base;
          }
        });
      }
      // When alpha place IS selected, the selection recolor effect above has already
      // applied orange — no double-paint needed. Non-alpha nodes handled by that effect.
    }
  }, [placeSummaries, selectedId]);

  // ─── Recolor place-node dot + rings on selection (spec §3.4 states table) ───
  // Selected place: dot + visible rings → accent-orange. Others: ink, base opacity.
  // tokyo-alpha exception: non-selected alpha place keeps its orange accent
  // (painted by the alpha-on-place effect above) — this effect must not wipe it.
  // Pure material mutation — no geometry rebuild, no re-render churn.
  // Dark-mode: reads activePaletteRef so ink/orange use the current mode's values.
  useEffect(() => {
    const refs = sceneRefsRef.current;
    if (!refs) return;
    const pal = activePaletteRef.current;
    for (const node of refs.placeObjects) {
      const isSel = node.summary.place.id === selectedId;
      const isAlpha = node.summary.isAlpha;
      // Non-selected alpha place: let the alpha-on-place effect own its color.
      if (isAlpha && !isSel) continue;
      (node.dot.material as THREE.MeshBasicMaterial).color.setHex(
        isSel ? pal.orange : pal.ink
      );
      node.rings.forEach((ring, i) => {
        const mat = ring.material as THREE.MeshBasicMaterial;
        const base = (ring.userData.baseOpacity as number) ?? PLACE_RING_GEO[i][2];
        // Spec §3.4: selected recolors ring-1 + ring-2 to orange (1.0 / 0.7);
        // ring-3 is "no change" — stays ink at its base opacity.
        if (isSel && i < 2) {
          mat.color.setHex(pal.orange);
          mat.opacity = i === 0 ? 1.0 : 0.7;
        } else {
          mat.color.setHex(pal.ink);
          mat.opacity = base;
        }
      });
    }
  }, [selectedId, placeSummaries]);

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

        {/* Mobile dock — compact strata chips + NEXT NODE, co-located beneath the globe.
            Spec: docs/design/23-mobile-atlas-reflow.md · α-VIS-04 · 2026-06-21
            Hidden >600px via CSS. The verbose .atlas-strata-list is display:none ≤600px
            (removed from a11y tree), so only one stratum control set is active per breakpoint. */}
        <div className="atlas-mobile-dock" aria-label="STRATUM CONTROLS">
          {STRATA_BUTTONS.map((b) => {
            const active = stratum === b.key;
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => setStratum(active ? "all" : b.key)}
                className={`atlas-mobile-dock-chip${active ? " is-active" : ""}`}
                aria-pressed={active}
              >
                <span className="glyph" aria-hidden>{b.glyph}</span>
                <span>{b.id}</span>
              </button>
            );
          })}
          <button
            type="button"
            className="atlas-mobile-dock-jump"
            aria-label="Jump to next node"
            onClick={() => {
              const fn = (window as unknown as { __atlasNetraJump?: () => void }).__atlasNetraJump;
              if (fn) fn();
            }}
          >
            ⟶ NEXT NODE
          </button>
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
            {/* CW-15 · NEXT NODE touch target (ux-journey, α-SUR-01, 2026-06-14)
                Was 94×24px. minHeight:44px + display:flex + alignItems:center → ≥44px.
                Visual label and class unchanged. */}
            <button
              className="jump"
              type="button"
              style={{ minHeight: "44px", display: "flex", alignItems: "center" }}
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

      {/* ── Place front-door panel — slides in when a place-node is selected ──
          Spec §4.2 (front door: curated highlights) + §4.3 (dig to all).
          DECISION §15 Option A: a place with content but NO highlights still
          opens, showing only the DIG DEEPER trigger + NETRA "N records, not
          curated yet". Same translateX slide pattern as the prior entry panel. */}
      <PlaceFrontDoorPanel
        open={!!selectedId}
        summary={selectedSummary}
        content={selectedContent}
        digOpen={digOpen}
        reducedMotion={reducedMotionRef.current}
        onClose={() => setSelectedId(null)}
        onToggleDig={() => setDigOpen((d) => !d)}
      />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Place front-door panel — spec §4.2 / §4.3 / §9 (a11y). DOM (not THREE.js), so
// semantic HTML applies. Reuses the established translateX slide + paper-warm
// tokens of the prior entry panel; no app/globals.css change (Betelgeuse owns).
// ───────────────────────────────────────────────────────────────────────────

/** Format a place coord for the header strip — "13.76°N 100.50°E". */
function formatPlaceCoord(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}°${ns} ${Math.abs(lon).toFixed(2)}°${ew}`;
}

function PlaceFrontDoorPanel(props: {
  open: boolean;
  summary: PlaceSummary | null;
  content: PlaceContent | null;
  digOpen: boolean;
  reducedMotion: boolean;
  onClose: () => void;
  onToggleDig: () => void;
}) {
  const { open, summary, content, digOpen, reducedMotion, onClose, onToggleDig } = props;
  const place = summary?.place ?? null;
  const weight = summary?.weight ?? 0;
  const highlights = content?.highlights ?? null;
  const articleHi = highlights?.articleHighlight ?? null;
  const photoHi = highlights?.photoHighlights ?? [];
  // Curation state comes from the SUMMARY (loaded with the node), not the lazy
  // content — so the header never flashes "NOT CURATED YET" while content loads
  // for a place that does have highlights.
  const hasHighlights = summary?.hasHighlights ?? false;

  // Group dig-list photos by roll (spec §4.3: rolls, not individual frames).
  const rollRows = (() => {
    if (!content) return [] as { roll: string; isoDate: string; frames: number }[];
    const byRoll = new Map<string, { roll: string; isoDate: string; frames: number }>();
    for (const s of content.sidecars) {
      const existing = byRoll.get(s.roll);
      if (existing) {
        existing.frames += 1;
        if (s.isoDate > existing.isoDate) existing.isoDate = s.isoDate;
      } else {
        byRoll.set(s.roll, { roll: s.roll, isoDate: s.isoDate, frames: 1 });
      }
    }
    return Array.from(byRoll.values()).sort((a, b) => b.isoDate.localeCompare(a.isoDate));
  })();

  const panelLabel = place ? `${place.name} highlights` : "place highlights";

  // Mobile bottom-sheet: detect viewport ≤600px. Hydration-safe — starts false
  // on server, corrects on mount (panel only shows after user interaction, so
  // the one-frame mismatch is invisible). α-SUR-01 2026-06-21.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width:600px)");
    const on = () => setIsMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // Shared tokens — identical on both form factors.
  const sharedStyle = {
    background: "var(--paper-warm)",
    border: "1px solid var(--ink-primary)",
    padding: "18px 20px",
    boxShadow: "3px 3px 0 rgb(var(--ink-rgb) / 0.16)",
    opacity: open ? 1 : 0,
    transition: reducedMotion
      ? "none"
      : "transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 320ms ease-out",
    pointerEvents: (open ? "auto" : "none") as React.CSSProperties["pointerEvents"],
  };

  // Desktop right-rail — pixel-identical to the pre-mobile-native state.
  const desktopStyle: React.CSSProperties = {
    ...sharedStyle,
    position: "absolute",
    top: 78,
    right: 22,
    // Fix #1: panel must not cover the NEXT NODE (⟶) button in atlas-foot.
    // The footer (atlas-foot-row + atlas-netra-voice) sits at the bottom of the
    // frame. We anchor the panel above it with bottom: 124 so the full NETRA
    // console + voice strip remain fully visible and clickable when a panel is open.
    bottom: 124,
    width: "min(46%, 360px)",
    transform: open ? "translateX(0)" : "translateX(calc(100% + 30px))",
  };

  // Mobile bottom-sheet — escapes the atlas-frame via position:fixed (the frame
  // has no CSS transform, so fixed is viewport-relative). Slides from the bottom.
  // maxHeight is short for the summary state; expands to scroll when dig is open.
  const mobileStyle: React.CSSProperties = {
    ...sharedStyle,
    position: "fixed",
    left: "max(8px, env(safe-area-inset-left))",
    right: "max(8px, env(safe-area-inset-right))",
    bottom: "max(8px, env(safe-area-inset-bottom))",
    top: "auto",
    width: "auto",
    maxHeight: digOpen ? "72vh" : "46vh",
    transform: open ? "translateY(0)" : "translateY(110%)",
  };

  return (
    <section
      className="z-[6] flex flex-col overflow-y-auto"
      aria-label={panelLabel}
      aria-hidden={!open}
      style={isMobile ? mobileStyle : desktopStyle}
    >
      {/* CW-15 · ESC button touch target (ux-journey, α-SUR-01, 2026-06-14)
          Was 44×17px. minHeight:44px + display:flex + alignItems:center → ≥44px.
          Visual label and class unchanged. */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-2 right-3 t-mono text-[11px] tracking-[0.2em] text-[var(--ink-soft)] hover:text-[var(--accent-orange)] transition-colors"
        style={{ minHeight: "44px", display: "flex", alignItems: "center" }}
        aria-label="Close place panel"
      >
        ✕ ESC
      </button>

      {place && (
        <>
          {/* ── PLACE HEADER STRIP (spec §4.2) ── */}
          <div className="t-mono uppercase mb-1" style={{ fontSize: 9, letterSpacing: "0.3em", color: "var(--ink-soft)" }}>
            PLACE · {place.name.toUpperCase()}
          </div>
          <div className="t-mono uppercase mb-3" style={{ fontSize: 9, letterSpacing: "0.12em", color: "var(--ink-soft)" }}>
            {formatPlaceCoord(place.coord.lat, place.coord.lon)} · {weight} RECORD{weight === 1 ? "" : "S"}
          </div>
          <div className="t-mono uppercase mb-4" style={{ fontSize: 9, letterSpacing: "0.3em", color: "var(--ink-faint)" }}>
            HIGHLIGHTS
            {articleHi ? " · 1 ARTICLE" : ""}
            {photoHi.length > 0 ? ` · ${photoHi.length} FRAME${photoHi.length === 1 ? "" : "S"}` : ""}
            {!hasHighlights ? " · NOT CURATED YET" : ""}
          </div>

          {/* ── ARTICLE HIGHLIGHT — renders only if set (spec §4.1/§4.2) ── */}
          {articleHi && (
            <div className="mb-4">
              <div className="t-mono uppercase mb-1" style={{ fontSize: 9, letterSpacing: "0.3em", color: "var(--accent-orange)" }}>
                ◆ FILE {articleHi.fileNum} · {articleHi.date}
              </div>
              <a
                href={`/articles/${articleHi.fileNum}`}
                className="t-display italic block hover:underline"
                style={{ fontSize: 18, lineHeight: 1.15, color: "var(--ink-body)", textUnderlineOffset: 3 }}
              >
                {articleHi.title}
              </a>
              <a
                href={`/articles/${articleHi.fileNum}`}
                className="t-mono uppercase inline-block mt-2 hover:text-[var(--accent-orange)] transition-colors"
                style={{ fontSize: 9, letterSpacing: "0.3em", color: "var(--ink-soft)" }}
              >
                → READ ENTRY
              </a>
            </div>
          )}

          {/* dashed rule only when BOTH article and photos present (spec §4.2) */}
          {articleHi && photoHi.length > 0 && (
            <div className="mb-4" style={{ borderTop: "1px dashed var(--ink-dashed)" }} />
          )}

          {/* ── PHOTO HIGHLIGHTS — renders only if set. Frame unit; tap → roll. ── */}
          {photoHi.length > 0 && (
            <ol className="flex gap-[6px] mb-4 overflow-x-auto list-none p-0 m-0">
              {photoHi.map((s) => (
                <li key={`${s.roll}/${s.id}`} className="flex-shrink-0">
                  <a
                    href={`/photos/${s.roll}`}
                    aria-label={`Roll ${s.roll} · frame ${s.id}`}
                    className="block"
                    style={{ width: 80, height: 80, border: "1px solid var(--ink-dashed)", overflow: "hidden" }}
                  >
                    {s.thumbWebp ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.thumbWebp} alt="" width={80} height={80} style={{ width: 80, height: 80, objectFit: "cover", display: "block" }} />
                    ) : (
                      <span className="flex items-center justify-center w-full h-full t-mono" style={{ fontSize: 8, letterSpacing: "0.2em", color: "var(--ink-faint)" }}>
                        ◎
                      </span>
                    )}
                  </a>
                </li>
              ))}
            </ol>
          )}

          {/* ── DIG DEEPER trigger (spec §4.2 / §4.3) — collapse when dug ── */}
          <button
            type="button"
            onClick={onToggleDig}
            aria-expanded={digOpen}
            className="t-mono uppercase text-left hover:text-[var(--accent-orange)] transition-colors mt-1"
            style={{ fontSize: 9, letterSpacing: "0.3em", color: "var(--ink-soft)", minHeight: 44, paddingTop: 8, paddingBottom: 8 }}
          >
            {digOpen
              ? "↑ HIGHLIGHTS"
              : `↓ DIG DEEPER — ALL ${weight} RECORD${weight === 1 ? "" : "S"} AT ${place.name.split(" · ")[0].toUpperCase()}`}
          </button>

          {/* ── DIG TO ALL — within-panel expansion (spec §4.3) ── */}
          {digOpen && content && (
            <div aria-hidden={!digOpen} className="mt-3" style={{ borderTop: "1px dashed var(--ink-dashed)", paddingTop: 12 }}>
              <div className="t-mono uppercase mb-3" style={{ fontSize: 8, letterSpacing: "0.32em", color: "var(--ink-faint)" }}>
                ALL RECORDS AT {place.name.split(" · ")[0].toUpperCase()} — {weight} TOTAL
              </div>

              {content.articles.length > 0 && (
                <div className="mb-4">
                  <div className="t-mono uppercase mb-2" style={{ fontSize: 9, letterSpacing: "0.3em", color: "var(--ink-soft)" }}>
                    ARTICLES
                  </div>
                  <ul className="list-none p-0 m-0 flex flex-col gap-2">
                    {content.articles.map((a) => (
                      <li key={a.fileNum}>
                        <a href={`/articles/${a.fileNum}`} className="block group">
                          <span className="t-mono uppercase block" style={{ fontSize: 9, letterSpacing: "0.3em", color: "var(--accent-orange)" }}>
                            ◆ FILE {a.fileNum} · {a.date} · {a.status} · {a.readingTime} MIN
                          </span>
                          <span className="t-display italic block group-hover:text-[var(--ink-primary)]" style={{ fontSize: 14, lineHeight: 1.2, color: "var(--ink-soft)" }}>
                            {a.title} →
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {rollRows.length > 0 && (
                <div>
                  <div className="t-mono uppercase mb-2" style={{ fontSize: 9, letterSpacing: "0.3em", color: "var(--ink-soft)" }}>
                    PHOTOS
                  </div>
                  <ul className="list-none p-0 m-0 flex flex-col gap-2">
                    {rollRows.map((r) => (
                      <li key={r.roll}>
                        <a
                          href={`/photos/${r.roll}`}
                          className="t-mono uppercase block hover:text-[var(--ink-primary)] transition-colors"
                          style={{ fontSize: 9, letterSpacing: "0.3em", color: "var(--ink-soft)" }}
                        >
                          ◎ ROLL {r.roll} · {r.isoDate.replace(/-/g, ".")} · {r.frames} FRAME{r.frames === 1 ? "" : "S"} →
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
