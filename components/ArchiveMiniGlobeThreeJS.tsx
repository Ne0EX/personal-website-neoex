'use client';

/**
 * components/ArchiveMiniGlobeThreeJS.tsx
 * -------------------------------------
 * The Three.js standby mini-globe — the `mini-globe` soul-atom at standby scale.
 * Consumed by BOTH the /archive right-rail (size 300) and the Triangulate
 * overlay (size 348) via the ArchiveMiniGlobe wrapper.
 *
 * Design spec: docs/design/21-archive-route.md §5 (mini-globe atom contract).
 * Reference impl (extract, do NOT re-derive): components/WorldlineGlobe.tsx —
 * same material system, same lighting, same idle-rotation timing as ATLAS.
 * Projection helper shared with ATLAS: lib/globe-coordinates.ts latLonToVec3().
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HARD-LOCK VALUES (§5.3 — drift guard · must match WorldlineGlobe.tsx / ATLAS)
 * ─────────────────────────────────────────────────────────────────────────────
 * Three.js consumes hex, not CSS variables. Each literal cites its token source.
 *   globe surface       0xE8E2D5  = var(--paper-base)      app/globals.css L19
 *   graticule / wires   0x1F5063  = var(--ink-faint) base  app/globals.css L28,37
 *                                   (ink-rgb 31 80 99 @ opacity 0.3)
 *   in-membership pin   0xD4602A  = var(--accent-orange)   app/globals.css L50
 *   out-of-membership   0x1F5063  = ink @ opacity 0.32     (20-archive.md §5.3)
 *   ambient light       0xF0EBDD ≈ var(--paper-bright)     app/globals.css L22
 *   directional light   above-right vector (ATLAS key light position)
 *   material            MeshLambertMaterial (matte, no specular) — ATLAS contract
 *   idle auto-rotate    60s / full revolution (Y-axis) — ATLAS idle-drift timing
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * INTENTIONAL DIVERGENCES FROM ATLAS (§5.4 — both variants)
 * ─────────────────────────────────────────────────────────────────────────────
 *   geometry      24×24 segments (ATLAS: 128×128) — 300–348px needs no fidelity
 *   pins          THREE.Points sprites only — NO label, NO orbit ring, NO pulse
 *   journey-line  omitted entirely (ATLAS: polyline arcs)
 *   instrument    no frame, no corner reticles around the canvas
 *   orbit control none (no free-drag, no zoom)
 *   α pin         same visual as other in-membership pins (no special treatment)
 */

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { latLonToVec3 } from '@/lib/globe-coordinates';
import type { MiniGlobePin } from '@/lib/content';

// ── HARD-LOCK colour literals — token-sourced (see header block) ────────────
const HEX_PAPER_BASE = 0xe8e2d5; // var(--paper-base)
const HEX_INK = 0x1f5063; // var(--ink-rgb) → ink-faint / ink at alpha
const HEX_ACCENT_ORANGE = 0xd4602a; // var(--accent-orange)
const HEX_PAPER_BRIGHT = 0xf0ebdd; // ≈ var(--paper-bright)

const GRATICULE_OPACITY = 0.3; // var(--ink-faint) opacity
const OUT_MEMBERSHIP_OPACITY = 0.32; // ink @ 0.32 (20-archive.md §5.3)

const GLOBE_RADIUS = 1;
const GEO_SEGMENTS = 24; // §5.4 divergence — light GPU, ample at standby scale
const SECONDS_PER_REV = 60; // §5.3 idle-drift timing — 60s / revolution
const ROT_PER_SEC = (Math.PI * 2) / SECONDS_PER_REV;

// Pin point sizes (world-space; PointsMaterial sizeAttenuation on).
const PIN_SIZE = 0.055;

export interface MiniGlobeThreeJSProps {
  size: 300 | 348;
  pins: MiniGlobePin[];
  activePins: MiniGlobePin[];
  hoveredEntryId?: string | null;
  onPinHover?: (entryId: string | null) => void;
  onPinClick: (pin: MiniGlobePin) => void;
  onGlobeClick: () => void;
}

/**
 * Build the static scene graph once (globe body, graticule, lights). Returns the
 * scene plus a cleanup that disposes every geometry/material it created.
 */
function buildScene(): {
  scene: THREE.Scene;
  globe: THREE.Group;
  cleanup: () => void;
} {
  const scene = new THREE.Scene();
  scene.background = null;

  // Lights — match ATLAS: soft warm ambient + low-key above-right directional.
  const ambient = new THREE.AmbientLight(HEX_PAPER_BRIGHT, 1.15);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(HEX_PAPER_BRIGHT, 0.55);
  key.position.set(2, 2.5, 3); // above-right — ATLAS key-light vector
  scene.add(key);

  const globe = new THREE.Group();
  scene.add(globe);

  // ── Globe body — MeshLambertMaterial, paper surface, matte, no specular ──
  const sphereGeo = new THREE.SphereGeometry(GLOBE_RADIUS, GEO_SEGMENTS, GEO_SEGMENTS);
  const paperMat = new THREE.MeshLambertMaterial({ color: HEX_PAPER_BASE });
  const sphere = new THREE.Mesh(sphereGeo, paperMat);
  globe.add(sphere);

  // ── Graticule wireframe — second sphere as wireframe, ink-faint lines ──
  const wireGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.002, GEO_SEGMENTS, GEO_SEGMENTS);
  const wireMat = new THREE.MeshBasicMaterial({
    color: HEX_INK,
    wireframe: true,
    transparent: true,
    opacity: GRATICULE_OPACITY,
  });
  const wire = new THREE.Mesh(wireGeo, wireMat);
  globe.add(wire);

  const cleanup = () => {
    sphereGeo.dispose();
    paperMat.dispose();
    wireGeo.dispose();
    wireMat.dispose();
    scene.remove(ambient, key, globe);
  };

  return { scene, globe, cleanup };
}

/**
 * Build a THREE.Points cloud for a set of pins, positioned on the globe surface
 * via the canonical ATLAS projection. The cloud is a single draw call; colour is
 * driven per-vertex so membership re-colour is a BufferAttribute update, not a
 * material swap. Returns the Points object + its geometry/material for disposal.
 */
function buildPinCloud(pins: MiniGlobePin[]): {
  points: THREE.Points;
  geometry: THREE.BufferGeometry;
  material: THREE.PointsMaterial;
} {
  const positions = new Float32Array(pins.length * 3);
  const colors = new Float32Array(pins.length * 3);

  for (let i = 0; i < pins.length; i++) {
    const v = latLonToVec3(pins[i].lat, pins[i].lon, GLOBE_RADIUS * 1.01);
    positions[i * 3] = v.x;
    positions[i * 3 + 1] = v.y;
    positions[i * 3 + 2] = v.z;
    // Default colour set later by syncColors(); initialise to accent.
    colors[i * 3] = 1;
    colors[i * 3 + 1] = 1;
    colors[i * 3 + 2] = 1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: PIN_SIZE,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  return { points, geometry, material };
}

export default function ArchiveMiniGlobeThreeJS({
  size,
  pins,
  activePins,
  onPinClick,
  onGlobeClick,
}: MiniGlobeThreeJSProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const reducedMotionRef = useRef(false);

  // Imperative handles updated by the render effect, read by the sync effect.
  const pinGeometryRef = useRef<THREE.BufferGeometry | null>(null);
  const globeRef = useRef<THREE.Group | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Set of active ids — recomputed only when activePins changes (no useEffect).
  const activeIdSet = useMemo(
    () => new Set(activePins.map((p) => p.id)),
    [activePins],
  );

  // Stable refs for click handlers so the scene effect need not re-run on prop
  // identity changes. (Click navigation uses latest handlers.) The refs are
  // synced inside an effect — never mutated during render (react-hooks/refs).
  const pinsRef = useRef(pins);
  const onPinClickRef = useRef(onPinClick);
  const onGlobeClickRef = useRef(onGlobeClick);
  useEffect(() => {
    pinsRef.current = pins;
    onPinClickRef.current = onPinClick;
    onGlobeClickRef.current = onGlobeClick;
  }, [pins, onPinClick, onGlobeClick]);

  // ── Scene lifecycle — build once per pin-set, dispose on unmount/change ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Hydration-safe reduced-motion read — inside useEffect, never during render.
    reducedMotionRef.current =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const { scene, globe, cleanup: cleanupScene } = buildScene();
    globeRef.current = globe;

    const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 100);
    camera.position.set(0, 0, 3.4);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(size, size, false);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Pin cloud — child of the globe group so it co-rotates with the surface.
    const { points, geometry, material } = buildPinCloud(pins);
    globe.add(points);
    pinGeometryRef.current = geometry;

    // ── Interaction: pointer pick via raycaster (pins) + globe-surface click ──
    const raycaster = new THREE.Raycaster();
    // Generous threshold — Points are tiny; this makes pins clickable at scale.
    raycaster.params.Points = { threshold: PIN_SIZE * 1.6 };
    const ndc = new THREE.Vector2();
    let pointerInside = false;
    let lastPointerOutAt = 0;

    const toNdc = (ev: PointerEvent | MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const pickPin = (): MiniGlobePin | null => {
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObject(points, false);
      if (hits.length === 0) return null;
      const idx = hits[0].index;
      if (idx == null) return null;
      return pinsRef.current[idx] ?? null;
    };

    const onClick = (ev: MouseEvent) => {
      toNdc(ev);
      const pin = pickPin();
      if (pin) onPinClickRef.current(pin);
      else onGlobeClickRef.current();
    };

    const onPointerEnter = () => {
      pointerInside = true;
    };
    const onPointerLeave = () => {
      pointerInside = false;
      lastPointerOutAt = performance.now();
    };

    const el = renderer.domElement;
    el.style.cursor = 'pointer';
    el.addEventListener('click', onClick);
    el.addEventListener('pointerenter', onPointerEnter);
    el.addEventListener('pointerleave', onPointerLeave);

    // ── Render loop — idle Y-rotation @ 60s/rev; pauses on pointer-in,
    //    resumes 3s after pointer-out. Reduced-motion → single frame, no loop. ──
    let raf = 0;
    let lastT = performance.now();

    const renderOnce = () => renderer.render(scene, camera);

    if (reducedMotionRef.current) {
      renderOnce();
    } else {
      const tick = () => {
        const now = performance.now();
        const dt = Math.min(0.05, (now - lastT) / 1000);
        lastT = now;

        const resumeReady = now - lastPointerOutAt > 3000;
        if (!pointerInside && resumeReady) {
          globe.rotation.y += ROT_PER_SEC * dt;
        }

        renderOnce();
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener('click', onClick);
      el.removeEventListener('pointerenter', onPointerEnter);
      el.removeEventListener('pointerleave', onPointerLeave);

      globe.remove(points);
      geometry.dispose();
      material.dispose();
      cleanupScene();

      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      pinGeometryRef.current = null;
      globeRef.current = null;
      rendererRef.current = null;
    };
    // Rebuild the cloud only when the pin SET changes (positions are baked in).
    // activePins re-colour is handled by the separate sync effect below.
  }, [pins, size]);

  // ── Membership re-colour — BufferAttribute update, CSS-independent (§9) ──
  // Runs whenever activePins changes. In-membership → accent-orange @ 1.0;
  // out-of-membership → ink @ 0.32. We encode opacity into colour luminance is
  // NOT viable with a single PointsMaterial, so out-of-membership is rendered as
  // the ink colour pre-multiplied toward the paper base to approximate 0.32
  // alpha against the matte surface (vertex alpha is unsupported on PointsMaterial).
  useEffect(() => {
    const geometry = pinGeometryRef.current;
    if (!geometry) return;
    const colorAttr = geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
    if (!colorAttr) return;

    const inC = new THREE.Color(HEX_ACCENT_ORANGE);
    const inkC = new THREE.Color(HEX_INK);
    const paperC = new THREE.Color(HEX_PAPER_BASE);
    // Approximate ink @ 0.32 over paper by lerping ink toward paper by (1-0.32).
    const outC = inkC.clone().lerp(paperC, 1 - OUT_MEMBERSHIP_OPACITY);

    for (let i = 0; i < pins.length; i++) {
      const inMembership = activeIdSet.has(pins[i].id);
      const c = inMembership ? inC : outC;
      colorAttr.setXYZ(i, c.r, c.g, c.b);
    }
    colorAttr.needsUpdate = true;
  }, [activeIdSet, pins]);

  const visibleCount = activePins.length;
  const totalCount = pins.length;

  return (
    <div
      role="img"
      aria-label={`coordinate map of archive entries — ${visibleCount} of ${totalCount} loci visible`}
      style={{ width: size, height: size }}
    >
      <div
        ref={containerRef}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
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
