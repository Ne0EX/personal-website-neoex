'use client';

/**
 * components/ArchiveMiniGlobeThreeJS.tsx
 * -------------------------------------
 * The Three.js standby mini-globe — the `mini-globe` soul-atom, now CLONED UP to
 * the canonical ATLAS instrument (components/WorldlineGlobe.tsx). Consumed by BOTH
 * the /archive right-rail (size 300) and the Triangulate overlay (size 348) via
 * the ArchiveMiniGlobe wrapper.
 *
 * Design spec: docs/design/21-archive-route.md §5 (mini-globe atom contract).
 * Reference impl (CLONE, do NOT re-derive): components/WorldlineGlobe.tsx —
 * the SAME procedural surface (lib/globe-surface.ts buildSurfaceTextures()), the
 * SAME node-head glyph, the SAME idle timing, AND NOW the SAME instrument texture:
 * free-orbit drag, hit-proxy node-click, the great-circle DRIFT LINE, the teal
 * NETRA reticle, the α orange halo, and the faint geodesic shell.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE FOUR FIXES CLONED FROM WorldlineGlobe.tsx (Sirius, 2026-06-03)
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. FREE-ORBIT  — onDown/onMoveDrag/onUp (WL L970-993): pointerdown captures,
 *      pointermove accumulates baseRotY += dx*0.005 → globe.rotation.y. Y-axis
 *      only (polar fixed — orbit the surface, never clip). Idle drift suspends
 *      while dragging + 3s grace after release. Drag ALWAYS enabled (no strata).
 *   2. NODE-CLICK  — raycaster onClick (WL L996-1010) hit-tests invisible 0.05
 *      hit-proxy spheres (WL L617-624). HIT → onPinClick(pin) → open the entry.
 *      MISS on bare surface → clears the lock only (mirrors WL L1007), NEVER
 *      navigates. This KILLS the /archive home-bounce at source.
 *   3. DRIFT LINE  — great-circle arc α→hovered/locked node (re-aimed WL arcLine
 *      L672-688): LineDashedMaterial orange 0xD4602A, dash 0.05/gap 0.03, slerped
 *      surface points (lib greatCircleArcPoints), child of the globe so it
 *      co-rotates. Shown when a pin is hovered or locked; hidden on bare surface.
 *   4. RETICLE     — netraTracker group (WL L655-670): pulsing teal ring + halo
 *      + dot oriented to surface normal at the LOCKED locus; α wears its orange
 *      halo (WL L640-648); + a faint teal geodesic SHELL (WL makeShell). The
 *      HTML crosshair + corner brackets + the readout panel are rendered by the
 *      parent (ArchiveClient) — this component broadcasts the readout via onReadout.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HARD-LOCK VALUES (§5.3 — drift guard · must match WorldlineGlobe.tsx / ATLAS)
 * ─────────────────────────────────────────────────────────────────────────────
 *   globe surface       buildSurfaceTextures().map  (shared with ATLAS)
 *   in-membership pin    0x4D7A92  = teal @ opacity 0.92  (NOT orange — Peat #1)
 *   out-of-membership    0x1F5063  = ink @ real opacity 0.32
 *   drift line           0xD4602A  = var(--accent-orange)  (α + active arc ONLY)
 *   reticle / shell      0x4D7A92 / 0x1F5063 teal  (the live hover/lock register)
 *   α halo ring + dot    0xD4602A orange  (the SOLE orange node — observer locus)
 *   ambient light        0xF0EBDD ≈ var(--paper-bright)
 *   idle auto-rotate     60s / full revolution (Y-axis) — ATLAS idle-drift timing
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * MARKER TAXONOMY (Peat refinement #1 — UNIFY NODE MARKERS, 2026-06-03)
 * ─────────────────────────────────────────────────────────────────────────────
 *   All node pins are SMALL + UNIFORM (PIN_RADIUS 0.018 — no per-pin size). They
 *   are NOT orange: in-membership teal 0x4D7A92 @ 0.92, out-of-membership ink
 *   0x1F5063 @ 0.32. The TEAL RETICLE RING is the SOLE lock/selected signal.
 *   ORANGE is reserved for the α observer pin (+ drift line + reticle accents)
 *   ONLY — α is the one orange node.
 *
 *   HOVER is SUBTLE — a micro-scale (PIN_HOVER_SCALE 1.18, was 1.8) + a slight
 *   opacity brighten on the EXISTING pin colour. Hover does NOT recolour a node
 *   to orange and does NOT inflate it into a big pin. The reticle/drift carries
 *   the "this is the surveyed target" weight; the pin only nudges.
 */

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  latLonToVec3,
  targetRotationYForPin,
  nearestEquivalentAngle,
  latLonFromGlobeHit,
  greatCircleArcPoints,
  greatCircleDistanceKm,
  initialBearingDeg,
  bearingToCardinal,
} from '@/lib/globe-coordinates';
import { buildSurfaceTextures } from '@/lib/globe-surface';
import { WL_GLOBE_COORD_EVENT } from '@/lib/client-state/globe-store';
import type { MiniGlobePin } from '@/lib/content';

// ── HARD-LOCK colour literals — token-sourced (see header block) ────────────
const HEX_INK = 0x1f5063; // var(--ink-rgb) → ink / ink-faint / shell
const HEX_ACCENT_ORANGE = 0xd4602a; // var(--accent-orange) — α + drift line
const HEX_PAPER_BRIGHT = 0xf0ebdd; // ≈ var(--paper-bright)
const HEX_RETICLE_TEAL = 0x4d7a92; // NETRA tracker teal (WL L659)

const OUT_MEMBERSHIP_OPACITY = 0.32; // ink @ 0.32 (20-archive.md §5.3)
const IN_MEMBERSHIP_OPACITY = 0.92; // teal @ 0.92 — node pins are NOT orange (#1)
const PIN_HOVER_OPACITY = 1; // subtle brighten of the EXISTING pin colour on hover

const GLOBE_RADIUS = 1;
const GEO_SEGMENTS = 48; // §5.4 divergence — light GPU, enough for the coastline
const SECONDS_PER_REV = 60; // §5.3 idle-drift timing — 60s / revolution
const ROT_PER_SEC = (Math.PI * 2) / SECONDS_PER_REV;

// Observer α — Bangkok (the fixed observer locus; endpoint of every drift line).
const ALPHA_LAT = 13.7563;
const ALPHA_LON = 100.5018;

const INITIAL_ROTATION_Y = (110 * Math.PI) / 180;

const PIN_RADIUS = 0.018;
// Invisible hit-proxy radius (≈3× visual) so small pins are reachable (WL L617).
const HIT_PROXY_RADIUS = 0.05;
// Peat refinement #1: hover is a SUBTLE micro-scale (was 1.8 — a big pin), not an
// inflate. The teal reticle ring carries the lock signal, not pin size.
const PIN_HOVER_SCALE = 1.18;

const ORBIT_TAU = 0.18; // seconds — exponential-smoothing time constant
const ORBIT_SNAP_EPSILON = 0.0005;

// Idle-drift grace after a pointer interaction (drag release / pointer-out).
const IDLE_GRACE_MS = 3000;

/**
 * The instrument readout payload broadcast to the parent on hover / lock so it can
 * render the RETICLE / DRIFT A / BEARING / STRATUM panel UNDER the globe.
 * target=null → STANDBY (no hover, no lock).
 */
export interface MiniGlobeReadout {
  /** The locked/hovered pin, or null at standby. */
  pin: MiniGlobePin | null;
  /** Whether `pin` is a click-lock (held) vs a transient hover preview. */
  locked: boolean;
  /** Great-circle km α→pin (rounded for display upstream). null at standby. */
  driftKm: number | null;
  /** Initial compass bearing α→pin in degrees. null at standby. */
  bearingDeg: number | null;
  /** 16-wind cardinal for `bearingDeg` (e.g. "WNW"). '' at standby. */
  cardinal: string;
}

export interface MiniGlobeThreeJSProps {
  size: 300 | 348;
  pins: MiniGlobePin[];
  activePins: MiniGlobePin[];
  hoveredEntryId?: string | null;
  onPinHover?: (entryId: string | null) => void;
  onPinClick: (pin: MiniGlobePin) => void;
  /**
   * Bare-surface click. CLONE of ATLAS L1007: a miss clears the lock and does
   * NOT navigate. The /archive + overlay call-sites now pass a no-op (or a
   * lock-clear) here — the home-bounce is dead. Kept in the contract for parity.
   */
  onGlobeClick: () => void;
  /**
   * Instrument readout broadcast — fired on pin hover (preview), pin click (lock),
   * and bare-surface clear (STANDBY). The parent renders the readout panel.
   */
  onReadout?: (readout: MiniGlobeReadout) => void;
  /**
   * The entry id to LOCK (reticle + held readout). Bidirectional with the parent:
   * a pin click calls onPinClick which the parent may translate into navigation,
   * but the in-globe lock is driven by this prop + internal click state.
   */
  lockedEntryId?: string | null;
  /** Called when a pin click sets/clears the in-globe lock. */
  onLockChange?: (entryId: string | null) => void;
}

/** Build a readout payload for a pin (or a standby payload when pin is null). */
function buildReadout(pin: MiniGlobePin | null, locked: boolean): MiniGlobeReadout {
  if (!pin) {
    return { pin: null, locked: false, driftKm: null, bearingDeg: null, cardinal: '' };
  }
  const driftKm = greatCircleDistanceKm(ALPHA_LAT, ALPHA_LON, pin.lat, pin.lon);
  const bearingDeg = initialBearingDeg(ALPHA_LAT, ALPHA_LON, pin.lat, pin.lon);
  return {
    pin,
    locked,
    driftKm,
    bearingDeg,
    cardinal: bearingToCardinal(bearingDeg),
  };
}

/**
 * Build the static scene graph: lights, the globe body with the SHARED ATLAS
 * surface texture, the faint geodesic SHELL (WL makeShell — so the globe reads as
 * a surveyed instrument, not a solid marble), the α orange halo, the teal NETRA
 * reticle group (hidden until a lock), and the orange drift LINE (hidden until a
 * target). Returns the scene + globe group + the instrument refs + a cleanup.
 */
function buildScene(): {
  scene: THREE.Scene;
  globe: THREE.Group;
  sphere: THREE.Mesh;
  driftLine: THREE.Line;
  driftMat: THREE.LineDashedMaterial;
  reticle: THREE.Group;
  reticleHalo: THREE.Mesh;
  cleanup: () => void;
} {
  const scene = new THREE.Scene();
  scene.background = null;

  const ambient = new THREE.AmbientLight(HEX_PAPER_BRIGHT, 1.15);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(HEX_PAPER_BRIGHT, 0.55);
  key.position.set(2, 2.5, 3);
  scene.add(key);

  const globe = new THREE.Group();
  scene.add(globe);

  // ── Globe body — shared ATLAS surface texture ──
  const surface = buildSurfaceTextures();
  const sphereGeo = new THREE.SphereGeometry(GLOBE_RADIUS, GEO_SEGMENTS, GEO_SEGMENTS);
  const paperMat = new THREE.MeshLambertMaterial({ map: surface.map });
  const sphere = new THREE.Mesh(sphereGeo, paperMat);
  globe.add(sphere);

  // ── Faint geodesic SHELL — WL makeShell pattern (the surveyed-instrument cue) ──
  const shellGeo = new THREE.SphereGeometry(1.02, 24, 16);
  const shellMat = new THREE.MeshBasicMaterial({
    color: HEX_INK,
    wireframe: true,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
  });
  const shell = new THREE.Mesh(shellGeo, shellMat);
  globe.add(shell);

  // ── α orange halo ring — the fixed observer locus (WL alphaRing L640-648) ──
  const alphaVec = latLonToVec3(ALPHA_LAT, ALPHA_LON, 1.005);
  const alphaRingGeo = new THREE.RingGeometry(0.034, 0.044, 32);
  const alphaRingMat = new THREE.MeshBasicMaterial({
    color: HEX_ACCENT_ORANGE,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  });
  const alphaRing = new THREE.Mesh(alphaRingGeo, alphaRingMat);
  alphaRing.position.copy(
    new THREE.Vector3(alphaVec.x, alphaVec.y, alphaVec.z).multiplyScalar(1.001),
  );
  alphaRing.lookAt(0, 0, 0);
  alphaRing.rotateY(Math.PI);
  globe.add(alphaRing);

  // α node-head dot (orange) so the observer locus reads even without a lock.
  const alphaDotGeo = new THREE.SphereGeometry(0.014, 12, 12);
  const alphaDotMat = new THREE.MeshBasicMaterial({ color: HEX_ACCENT_ORANGE });
  const alphaDot = new THREE.Mesh(alphaDotGeo, alphaDotMat);
  alphaDot.position.set(alphaVec.x, alphaVec.y, alphaVec.z);
  globe.add(alphaDot);

  // ── NETRA reticle — teal pulsing ring + halo + dot (WL netraTracker L655-670) ──
  const reticle = new THREE.Group();
  reticle.visible = false;
  const reticleRingGeo = new THREE.RingGeometry(0.045, 0.06, 48);
  const reticleRingMat = new THREE.MeshBasicMaterial({
    color: HEX_RETICLE_TEAL,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.92,
  });
  const reticleRing = new THREE.Mesh(reticleRingGeo, reticleRingMat);
  const reticleHaloGeo = new THREE.RingGeometry(0.075, 0.078, 64);
  const reticleHaloMat = new THREE.MeshBasicMaterial({
    color: HEX_RETICLE_TEAL,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.34,
  });
  const reticleHalo = new THREE.Mesh(reticleHaloGeo, reticleHaloMat);
  const reticleDotGeo = new THREE.SphereGeometry(0.009, 12, 12);
  const reticleDotMat = new THREE.MeshBasicMaterial({ color: HEX_RETICLE_TEAL });
  const reticleDot = new THREE.Mesh(reticleDotGeo, reticleDotMat);
  reticle.add(reticleRing, reticleHalo, reticleDot);
  globe.add(reticle); // child of globe → co-rotates with the surface

  // ── DRIFT LINE — orange great-circle arc α→target (WL arcLine L672-688) ──
  // Geometry is rebuilt on aim; seed with α→α (zero-length) and keep it hidden.
  const driftGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(alphaVec.x, alphaVec.y, alphaVec.z),
  ]);
  const driftMat = new THREE.LineDashedMaterial({
    color: HEX_ACCENT_ORANGE,
    dashSize: 0.05,
    gapSize: 0.03,
    transparent: true,
    opacity: 0.9,
  });
  const driftLine = new THREE.Line(driftGeo, driftMat);
  driftLine.visible = false;
  driftLine.computeLineDistances();
  globe.add(driftLine); // child of globe → arc stays anchored to α + node on orbit

  const cleanup = () => {
    sphereGeo.dispose();
    paperMat.dispose();
    surface.map.dispose();
    surface.rough.dispose();
    surface.bump.dispose();
    shellGeo.dispose();
    shellMat.dispose();
    alphaRingGeo.dispose();
    alphaRingMat.dispose();
    alphaDotGeo.dispose();
    alphaDotMat.dispose();
    reticleRingGeo.dispose();
    reticleRingMat.dispose();
    reticleHaloGeo.dispose();
    reticleHaloMat.dispose();
    reticleDotGeo.dispose();
    reticleDotMat.dispose();
    driftLine.geometry.dispose();
    driftMat.dispose();
    scene.remove(ambient, key, globe);
  };

  return { scene, globe, sphere, driftLine, driftMat, reticle, reticleHalo, cleanup };
}

/**
 * Build one VISIBLE node-head mesh + one INVISIBLE hit-proxy per pin (WL L609-625).
 * The hit-proxy (radius 0.05, opacity 0, renderOrder 999) is what the raycaster
 * tests so small pins are easy to hit. Returns aligned arrays + shared geometry
 * for disposal.
 */
function buildPinMeshes(pins: MiniGlobePin[]): {
  heads: THREE.Mesh[];
  hits: THREE.Mesh[];
  headGeo: THREE.SphereGeometry;
  hitGeo: THREE.SphereGeometry;
  materials: THREE.MeshBasicMaterial[];
  hitMaterials: THREE.MeshBasicMaterial[];
} {
  const headGeo = new THREE.SphereGeometry(PIN_RADIUS, 12, 12);
  const hitGeo = new THREE.SphereGeometry(HIT_PROXY_RADIUS, 8, 8);
  const heads: THREE.Mesh[] = [];
  const hits: THREE.Mesh[] = [];
  const materials: THREE.MeshBasicMaterial[] = [];
  const hitMaterials: THREE.MeshBasicMaterial[] = [];

  for (let i = 0; i < pins.length; i++) {
    const v = latLonToVec3(pins[i].lat, pins[i].lon, GLOBE_RADIUS * 1.01);

    // Node pins start TEAL (in-membership default), NOT orange — orange is
    // reserved for α (Peat #1). The membership effect re-colours out-of-set pins
    // to ink @ 0.32 on first paint.
    const material = new THREE.MeshBasicMaterial({
      color: HEX_RETICLE_TEAL,
      transparent: true,
      opacity: IN_MEMBERSHIP_OPACITY,
      depthWrite: false,
    });
    const head = new THREE.Mesh(headGeo, material);
    head.position.set(v.x, v.y, v.z);
    head.userData.pinIndex = i;
    heads.push(head);
    materials.push(material);

    const hitMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const hit = new THREE.Mesh(hitGeo, hitMat);
    hit.position.set(v.x, v.y, v.z);
    hit.renderOrder = 999;
    hit.userData.pinIndex = i;
    hits.push(hit);
    hitMaterials.push(hitMat);
  }

  return { heads, hits, headGeo, hitGeo, materials, hitMaterials };
}

export default function ArchiveMiniGlobeThreeJS({
  size,
  pins,
  activePins,
  hoveredEntryId,
  onPinHover,
  onPinClick,
  onGlobeClick,
  onReadout,
  lockedEntryId,
  onLockChange,
}: MiniGlobeThreeJSProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const reducedMotionRef = useRef(false);

  // Imperative handles updated by the scene effect, read by the sync effects.
  const pinHeadsRef = useRef<THREE.Mesh[]>([]);
  const pinHitsRef = useRef<THREE.Mesh[]>([]);
  const pinMaterialsRef = useRef<THREE.MeshBasicMaterial[]>([]);
  const globeRef = useRef<THREE.Group | null>(null);
  const reticleRef = useRef<THREE.Group | null>(null);
  const driftLineRef = useRef<THREE.Line | null>(null);
  const driftMatRef = useRef<THREE.LineDashedMaterial | null>(null);
  const renderOnceRef = useRef<(() => void) | null>(null);
  const orbitTargetYRef = useRef<number | null>(null);

  const activeIdSet = useMemo(
    () => new Set(activePins.map((p) => p.id)),
    [activePins],
  );

  // Stable refs for handlers so the scene effect need not re-run on identity.
  const pinsRef = useRef(pins);
  const onPinClickRef = useRef(onPinClick);
  const onGlobeClickRef = useRef(onGlobeClick);
  const onPinHoverRef = useRef(onPinHover);
  const onReadoutRef = useRef(onReadout);
  const onLockChangeRef = useRef(onLockChange);
  const lockedEntryIdRef = useRef<string | null>(lockedEntryId ?? null);
  useEffect(() => {
    pinsRef.current = pins;
    onPinClickRef.current = onPinClick;
    onGlobeClickRef.current = onGlobeClick;
    onPinHoverRef.current = onPinHover;
    onReadoutRef.current = onReadout;
    onLockChangeRef.current = onLockChange;
    lockedEntryIdRef.current = lockedEntryId ?? null;
  }, [pins, onPinClick, onGlobeClick, onPinHover, onReadout, onLockChange, lockedEntryId]);

  // Place a target (reticle + drift line) at a pin, or clear it. Set inside the
  // scene effect, called by both the click-lock and the hover-preview effects.
  const applyTarget = useRef<(pin: MiniGlobePin | null) => void>(() => {});

  // ── Scene lifecycle — build once per pin-set, dispose on unmount/change ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    reducedMotionRef.current =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const {
      scene,
      globe,
      sphere,
      driftLine,
      driftMat,
      reticle,
      reticleHalo,
      cleanup: cleanupScene,
    } = buildScene();
    globe.rotation.y = INITIAL_ROTATION_Y;
    globeRef.current = globe;
    reticleRef.current = reticle;
    driftLineRef.current = driftLine;
    driftMatRef.current = driftMat;

    const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 100);
    camera.position.set(0, 0, 3.4); // FIXED radius — drag never touches it (no clip)
    camera.lookAt(0, 0, 0);

    // Transparent canvas — globe floats on the page, no rectangular background.
    // alpha:true + clearColor alpha 0 = the globe renders transparent. The flicker
    // fix is the client-state filter (no router.push → no remount → no re-init),
    // not an opaque clearColor. scene.background stays null (set in buildScene).
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(size, size, true);
    container.appendChild(renderer.domElement);

    // ── Pins — heads + invisible hit-proxies, children of the globe group ──
    const { heads, hits, headGeo, hitGeo, materials, hitMaterials } =
      buildPinMeshes(pins);
    for (const m of heads) globe.add(m);
    for (const h of hits) globe.add(h);
    pinHeadsRef.current = heads;
    pinHitsRef.current = hits;
    pinMaterialsRef.current = materials;

    // Ring normal for the reticle orientation (WL ringNormal L873).
    const ringNormal = new THREE.Vector3(0, 0, 1);

    // ── Reticle + drift-line aim ──
    const setTargetVisuals = (pin: MiniGlobePin | null) => {
      if (!pin) {
        reticle.visible = false;
        driftLine.visible = false;
        return;
      }
      // Reticle at the node surface normal (WL setTrackerMarker L878-883).
      const marker = latLonToVec3(pin.lat, pin.lon, 1.024);
      reticle.position.set(marker.x, marker.y, marker.z);
      reticle.quaternion.setFromUnitVectors(
        ringNormal,
        new THREE.Vector3(marker.x, marker.y, marker.z).normalize(),
      );
      reticle.visible = true;

      // DRIFT LINE — re-aim the great-circle arc α→node (slerped surface points).
      const pts = greatCircleArcPoints(
        ALPHA_LAT, ALPHA_LON, pin.lat, pin.lon, 56, 1.01,
      ).map((p) => new THREE.Vector3(p.x, p.y, p.z));
      driftLine.geometry.setFromPoints(pts);
      driftLine.computeLineDistances();
      driftLine.visible = true;
    };
    applyTarget.current = setTargetVisuals;

    // ── Interaction: raycaster (hit-proxies) + free-orbit drag ──
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let pointerInside = false;
    let lastPointerOutAt = 0;

    // Free-orbit drag state (WL onDown/onMoveDrag/onUp L970-993).
    let dragging = false;
    let lastX = 0;
    let baseRotY = globe.rotation.y;
    let movedDuringDrag = false;
    let lastInteractionAt = 0; // suspends idle drift (drag release grace)

    const toNdc = (ev: PointerEvent | MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const pickPinIndex = (): number | null => {
      raycaster.setFromCamera(ndc, camera);
      const hitObjs = raycaster.intersectObjects(hits, false);
      if (hitObjs.length === 0) return null;
      const idx = hitObjs[0].object.userData.pinIndex;
      return typeof idx === 'number' ? idx : null;
    };

    // CLONE WL onClick L996-1010: hit a proxy → open the entry; bare miss clears
    // the lock and does NOTHING navigational (kills the home-bounce).
    const onClick = (ev: MouseEvent) => {
      if (movedDuringDrag) return; // a drag is not a click
      toNdc(ev);
      const idx = pickPinIndex();
      const pin = idx != null ? pinsRef.current[idx] : null;
      if (pin) {
        // Lock + held readout, then hand the click to the parent (navigation).
        lockedEntryIdRef.current = pin.id;
        onLockChangeRef.current?.(pin.id);
        setTargetVisuals(pin);
        onReadoutRef.current?.(buildReadout(pin, true));
        renderOnce();
        onPinClickRef.current(pin);
      } else {
        // Bare-surface miss → clear the lock only. NEVER navigate (anti-bounce).
        if (lockedEntryIdRef.current) {
          lockedEntryIdRef.current = null;
          onLockChangeRef.current?.(null);
          setTargetVisuals(null);
          onReadoutRef.current?.(buildReadout(null, false));
          renderOnce();
        }
        // onGlobeClick is retained for contract parity but is now a no-op upstream.
        onGlobeClickRef.current();
      }
    };

    // Hover raycast → onPinHover(entryId) + readout preview + cursor + coord event.
    let lastHoverId: string | null = null;
    const onPointerMove = (ev: PointerEvent) => {
      toNdc(ev);

      // Free-orbit drag takes precedence over hover-orbit and idle (WL L975-985).
      if (dragging) {
        const dx = ev.clientX - lastX;
        lastX = ev.clientX;
        if (Math.abs(dx) > 0) movedDuringDrag = true;
        baseRotY += dx * 0.005;
        globe.rotation.y = baseRotY; // Y-axis only — polar fixed, no clip
        orbitTargetYRef.current = null; // user drag overrides hover-orbit
        lastInteractionAt = performance.now();
        renderer.domElement.style.cursor = 'grabbing';
        renderOnce();
        return;
      }

      const idx = pickPinIndex();
      const pin = idx != null ? pinsRef.current[idx] : null;
      const id = pin ? pin.id : null;
      renderer.domElement.style.cursor = pin ? 'pointer' : 'grab';

      // Broadcast live surface coord (WL L1036-1044) so a COORD row can show it.
      const sphereHits = raycaster.intersectObject(sphere, false);
      if (sphereHits.length > 0) {
        const wp = sphereHits[0].point;
        const coord = latLonFromGlobeHit(
          { x: wp.x, y: wp.y, z: wp.z },
          globe.rotation.y,
        );
        window.dispatchEvent(
          new CustomEvent<{ lat: number; lon: number }>(WL_GLOBE_COORD_EVENT, {
            detail: coord,
          }),
        );
      } else {
        window.dispatchEvent(
          new CustomEvent(WL_GLOBE_COORD_EVENT, { detail: null }),
        );
      }

      if (id !== lastHoverId) {
        lastHoverId = id;
        onPinHoverRef.current?.(id);
        // Readout preview on hover; if nothing locked, hover drives the panel.
        if (pin) {
          onReadoutRef.current?.(buildReadout(pin, false));
        } else if (!lockedEntryIdRef.current) {
          onReadoutRef.current?.(buildReadout(null, false));
        } else {
          // Re-assert the held lock readout when hover leaves a pin.
          const locked = pinsRef.current.find(
            (p) => p.id === lockedEntryIdRef.current,
          );
          onReadoutRef.current?.(buildReadout(locked ?? null, !!locked));
        }
      }
    };

    const onPointerEnter = () => {
      pointerInside = true;
    };
    const onPointerLeave = () => {
      pointerInside = false;
      lastPointerOutAt = performance.now();
      lastInteractionAt = performance.now();
      window.dispatchEvent(new CustomEvent(WL_GLOBE_COORD_EVENT, { detail: null }));
      if (lastHoverId !== null) {
        lastHoverId = null;
        onPinHoverRef.current?.(null);
        // Restore the locked readout (or standby) when the pointer leaves.
        const locked = lockedEntryIdRef.current
          ? pinsRef.current.find((p) => p.id === lockedEntryIdRef.current)
          : null;
        onReadoutRef.current?.(buildReadout(locked ?? null, !!locked));
      }
    };

    const onDown = (ev: PointerEvent) => {
      dragging = true;
      movedDuringDrag = false;
      lastX = ev.clientX;
      baseRotY = globe.rotation.y;
      lastInteractionAt = performance.now();
      try {
        renderer.domElement.setPointerCapture(ev.pointerId);
      } catch {}
      renderer.domElement.style.cursor = 'grabbing';
    };
    const onUp = (ev: PointerEvent) => {
      dragging = false;
      lastPointerOutAt = performance.now(); // reuse the idle-resume grace
      lastInteractionAt = performance.now();
      try {
        renderer.domElement.releasePointerCapture(ev.pointerId);
      } catch {}
      renderer.domElement.style.cursor = 'grab';
    };

    const el = renderer.domElement;
    el.style.cursor = 'grab';
    el.style.display = 'block';
    el.style.maxWidth = '100%';
    el.style.touchAction = 'none'; // let pointer drag work on touch
    el.addEventListener('click', onClick);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerenter', onPointerEnter);
    el.addEventListener('pointerleave', onPointerLeave);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);

    // ── Render loop ──
    let raf = 0;
    let lastT = performance.now();
    let pulseT = 0;

    const renderOnce = () => renderer.render(scene, camera);
    renderOnceRef.current = renderOnce;

    // Re-assert any incoming lock on (re)build so the reticle survives a remount.
    if (lockedEntryIdRef.current) {
      const locked = pins.find((p) => p.id === lockedEntryIdRef.current);
      if (locked) {
        setTargetVisuals(locked);
        onReadoutRef.current?.(buildReadout(locked, true));
      }
    }

    if (reducedMotionRef.current) {
      renderOnce();
    } else {
      const tick = () => {
        const now = performance.now();
        const dt = Math.min(0.05, (now - lastT) / 1000);
        lastT = now;

        const orbitTarget = orbitTargetYRef.current;
        if (dragging) {
          // Drag drives rotation directly in onPointerMove; nothing to do here.
        } else if (orbitTarget !== null) {
          const goal = nearestEquivalentAngle(globe.rotation.y, orbitTarget);
          const alpha = 1 - Math.exp(-dt / ORBIT_TAU);
          globe.rotation.y += (goal - globe.rotation.y) * alpha;
          if (Math.abs(goal - globe.rotation.y) < ORBIT_SNAP_EPSILON) {
            globe.rotation.y = goal;
          }
        } else {
          // Idle drift — suspended while pointer is inside, dragging, or within
          // the grace window after the last interaction / pointer-out.
          const graceReady =
            now - lastPointerOutAt > IDLE_GRACE_MS &&
            now - lastInteractionAt > IDLE_GRACE_MS;
          if (!pointerInside && graceReady) {
            globe.rotation.y += ROT_PER_SEC * dt;
          }
        }

        // Pulse the reticle halo opacity ±0.1 on a slow sine while visible.
        if (reticle.visible) {
          pulseT += dt;
          (reticleHalo.material as THREE.MeshBasicMaterial).opacity =
            0.34 + Math.sin(pulseT * 2.2) * 0.1;
        }

        renderOnce();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener('click', onClick);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerenter', onPointerEnter);
      el.removeEventListener('pointerleave', onPointerLeave);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);

      for (const m of heads) globe.remove(m);
      for (const h of hits) globe.remove(h);
      headGeo.dispose();
      hitGeo.dispose();
      for (const mat of materials) mat.dispose();
      for (const mat of hitMaterials) mat.dispose();
      cleanupScene();

      renderer.dispose();
      renderer.forceContextLoss?.();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      pinHeadsRef.current = [];
      pinHitsRef.current = [];
      pinMaterialsRef.current = [];
      globeRef.current = null;
      reticleRef.current = null;
      driftLineRef.current = null;
      driftMatRef.current = null;
      renderOnceRef.current = null;
      applyTarget.current = () => {};
    };
  }, [pins, size]);

  // ── Membership re-colour — REAL per-material color + opacity (§5.3, §9) ──
  useEffect(() => {
    const materials = pinMaterialsRef.current;
    if (materials.length === 0) return;
    for (let i = 0; i < pins.length; i++) {
      const mat = materials[i];
      if (!mat) continue;
      const inMembership = activeIdSet.has(pins[i].id);
      if (inMembership) {
        // In-membership node pin — TEAL, NOT orange (#1). Orange is α only.
        mat.color.setHex(HEX_RETICLE_TEAL);
        mat.opacity = IN_MEMBERSHIP_OPACITY;
      } else {
        mat.color.setHex(HEX_INK);
        mat.opacity = OUT_MEMBERSHIP_OPACITY;
      }
    }
    renderOnceRef.current?.();
  }, [activeIdSet, pins]);

  // ── External lock sync — parent-driven lock (e.g. NEXT NODE jump) ──
  useEffect(() => {
    lockedEntryIdRef.current = lockedEntryId ?? null;
    const apply = applyTarget.current;
    if (!apply) return;
    if (lockedEntryId) {
      const pin = pins.find((p) => p.id === lockedEntryId);
      if (pin) {
        // Orbit the locked pin to the front face, then draw reticle + drift.
        const target = targetRotationYForPin(pin.lat, pin.lon);
        const globe = globeRef.current;
        if (reducedMotionRef.current && globe) {
          globe.rotation.y = nearestEquivalentAngle(globe.rotation.y, target);
          orbitTargetYRef.current = null;
        } else {
          orbitTargetYRef.current = target;
        }
        apply(pin);
        onReadoutRef.current?.(buildReadout(pin, true));
        renderOnceRef.current?.();
      }
    }
    // Note: clearing (lockedEntryId=null) is handled by the bare-surface click.
  }, [lockedEntryId, pins]);

  // ── Bidirectional hover — ledger row → globe pin (goal 2 forward) ──
  useEffect(() => {
    const heads = pinHeadsRef.current;
    const materials = pinMaterialsRef.current;
    if (heads.length === 0) return;

    let hoveredIdx = -1;
    for (let i = 0; i < pins.length; i++) {
      const mesh = heads[i];
      const mat = materials[i];
      if (!mesh || !mat) continue;
      const isHovered = hoveredEntryId != null && pins[i].id === hoveredEntryId;
      if (isHovered) hoveredIdx = i;
      const inMembership = activeIdSet.has(pins[i].id);
      // Peat #1: hover is a SUBTLE micro-scale, NOT a 1.8x inflate. The pin keeps
      // its own register colour (teal in-membership / ink out) — hover only
      // brightens opacity slightly. The teal reticle ring is the lock signal.
      mesh.scale.setScalar(isHovered ? PIN_HOVER_SCALE : 1);
      if (inMembership) {
        mat.color.setHex(HEX_RETICLE_TEAL);
        mat.opacity = isHovered ? PIN_HOVER_OPACITY : IN_MEMBERSHIP_OPACITY;
      } else {
        mat.color.setHex(HEX_INK);
        // A subtle brighten on hover even for out-of-set pins (legible nudge),
        // but never a recolour to orange.
        mat.opacity = isHovered ? OUT_MEMBERSHIP_OPACITY + 0.28 : OUT_MEMBERSHIP_OPACITY;
      }
    }

    // ── HOVER-ORBIT — orbit the hovered locus to the front face + show target ──
    if (hoveredIdx >= 0) {
      const pin = pins[hoveredIdx];
      const target = targetRotationYForPin(pin.lat, pin.lon);
      if (reducedMotionRef.current) {
        const globe = globeRef.current;
        if (globe) {
          globe.rotation.y = nearestEquivalentAngle(globe.rotation.y, target);
        }
        orbitTargetYRef.current = null;
      } else {
        orbitTargetYRef.current = target;
      }
      // Draw the drift line + reticle at the hovered node (preview; not a lock).
      applyTarget.current?.(pin);
      onReadout?.(buildReadout(pin, false));
    } else {
      // Hover cleared — restore the locked target (or standby).
      orbitTargetYRef.current = null;
      const locked = lockedEntryIdRef.current
        ? pins.find((p) => p.id === lockedEntryIdRef.current)
        : null;
      applyTarget.current?.(locked ?? null);
      onReadout?.(buildReadout(locked ?? null, !!locked));
    }

    renderOnceRef.current?.();
    // onReadout intentionally excluded — stable via ref usage upstream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredEntryId, activeIdSet, pins]);

  const visibleCount = activePins.length;
  const totalCount = pins.length;

  return (
    <div
      role="img"
      aria-label={`coordinate map of archive entries — ${visibleCount} of ${totalCount} loci visible`}
      style={{ width: size }}
    >
      {/* corner-marks frame the canvas box (teal hairlines, NOT a drop-shadow). */}
      <div
        style={{ position: 'relative', width: size, height: size }}
      >
        <div
          ref={containerRef}
          style={{ width: size, height: size, overflow: 'hidden' }}
          aria-hidden="true"
        />
        {/* 4 corner L-brackets + the inline crosshair (observatory atlas.jsx
            L135-144) — instrument frame, teal hairlines 1px. */}
        <div className="corner-marks" aria-hidden="true" />
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'var(--ink-faint)',
            pointerEvents: 'none',
            opacity: 0.5,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1" />
            <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1" />
            <line x1="12" y1="3" x2="12" y2="9" stroke="currentColor" strokeWidth="1" />
            <line x1="12" y1="15" x2="12" y2="21" stroke="currentColor" strokeWidth="1" />
            <line x1="3" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1" />
            <line x1="15" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1" />
          </svg>
        </span>
      </div>
      <p
        className="t-mono"
        style={{
          fontSize: 8,
          color: 'var(--ink-soft)',
          textAlign: 'center',
          textTransform: 'uppercase',
          marginTop: 6,
        }}
      >
        {visibleCount} OF {totalCount} LOCI VISIBLE
      </p>
    </div>
  );
}
