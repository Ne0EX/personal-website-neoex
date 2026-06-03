'use client';

/**
 * components/ArchiveMiniGlobeThreeJS.tsx
 * -------------------------------------
 * The Three.js standby mini-globe — the `mini-globe` soul-atom at standby scale.
 * Consumed by BOTH the /archive right-rail (size 300) and the Triangulate
 * overlay (size 348) via the ArchiveMiniGlobe wrapper.
 *
 * Design spec: docs/design/21-archive-route.md §5 (mini-globe atom contract).
 * Reference impl (CLONE, do NOT re-derive): components/WorldlineGlobe.tsx —
 * the SAME procedural surface (paper gradient + baked grid + Earth coastline
 * silhouette) via the shared lib/globe-surface.ts buildSurfaceTextures(), the
 * SAME node-head glyph (SphereGeometry per pin), the SAME idle-rotation timing.
 * Projection helper shared with ATLAS: lib/globe-coordinates.ts latLonToVec3().
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HARD-LOCK VALUES (§5.3 — drift guard · must match WorldlineGlobe.tsx / ATLAS)
 * ─────────────────────────────────────────────────────────────────────────────
 * Three.js consumes hex, not CSS variables. Each literal cites its token source.
 *   globe surface       buildSurfaceTextures().map  = same paper/grid/coastline
 *                                                      as ATLAS (lib/globe-surface)
 *   coastline / grid     baked into the texture (rgba(31,80,99,0.18) grid,
 *                        earth_specular_2048.jpg coastline @ alpha 0.28) — ATLAS
 *   in-membership pin   0xD4602A  = var(--accent-orange)   app/globals.css L50
 *   out-of-membership   0x1F5063  = ink @ real opacity 0.32 (20-archive.md §5.3)
 *   ambient light       0xF0EBDD ≈ var(--paper-bright)     app/globals.css L22
 *   directional light   above-right vector (ATLAS key light position)
 *   material            MeshLambertMaterial({ map }) — Lambert honors `map`
 *                       (§5.3 contract; roughnessMap/bumpMap dropped per §5.4 as
 *                       imperceptible at 300px — allowed divergence)
 *   idle auto-rotate    60s / full revolution (Y-axis) — ATLAS idle-drift timing
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * INTENTIONAL DIVERGENCES FROM ATLAS (§5.4 — both variants)
 * ─────────────────────────────────────────────────────────────────────────────
 *   geometry      48×48 segments (ATLAS: 128×128) — light GPU at standby scale,
 *                 enough to carry the coastline texture cleanly
 *   pins          one SphereGeometry(0.018) node-head mesh per pin — NO label,
 *                 NO orbit ring, NO pulse (the node-head glyph only)
 *   roughness/bump dropped (imperceptible at 300px) — Lambert + albedo map only
 *   journey-line  omitted entirely (ATLAS: polyline arcs)
 *   instrument    no frame, no corner reticles around the canvas
 *   orbit control none (no free-drag, no zoom)
 *   α pin         same visual as other in-membership pins (no special treatment)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SIZING (FIX-C — must always be contained at the rail size on every DPR)
 * ─────────────────────────────────────────────────────────────────────────────
 *   renderer.setSize(size, size, true) — the `true` (updateStyle) makes Three.js
 *   write canvas.style.width/height = size+'px', pinning the CSS box regardless
 *   of devicePixelRatio. The drawing buffer is still size×DPR for crispness via
 *   setPixelRatio(min(dpr,2)). Defense in depth: the container is overflow:hidden
 *   and the canvas is capped to maxWidth:100%. Reference: WorldlineGlobe.tsx
 *   resize() (setSize(w,h,true)) — the mini-globe previously diverged with the
 *   `false` arg, laying the canvas out at its raw buffer pixel size (600px at
 *   DPR2) and overflowing the rail.
 */

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { latLonToVec3 } from '@/lib/globe-coordinates';
import { buildSurfaceTextures } from '@/lib/globe-surface';
import type { MiniGlobePin } from '@/lib/content';

// ── HARD-LOCK colour literals — token-sourced (see header block) ────────────
const HEX_INK = 0x1f5063; // var(--ink-rgb) → ink / ink-faint
const HEX_ACCENT_ORANGE = 0xd4602a; // var(--accent-orange)
const HEX_PAPER_BRIGHT = 0xf0ebdd; // ≈ var(--paper-bright)

const OUT_MEMBERSHIP_OPACITY = 0.32; // ink @ 0.32 (20-archive.md §5.3)

const GLOBE_RADIUS = 1;
const GEO_SEGMENTS = 48; // §5.4 divergence — light GPU, enough for the coastline
const SECONDS_PER_REV = 60; // §5.3 idle-drift timing — 60s / revolution
const ROT_PER_SEC = (Math.PI * 2) / SECONDS_PER_REV;

// FIX-TILT: Default Y-rotation so Asia (≈110°E) faces the camera at rest.
// All 3 eastern-hemisphere loci — Bangkok (100.5°E), Chiang Mai (99.0°E),
// Kyoto (135.8°E) — are visible on the front face on load.
// Derivation: Three.js SphereGeometry places lon=0 at +X; camera is at +Z.
// Front face = pins with world-space z > 0. latLonToVec3 gives
//   z = -sin(phi)*sin(theta)  where theta = lonDeg * π/180.
// After globe.rotation.y = R, world_z = -localX*sin(R) + localZ*cos(R).
// Setting R = 110° * π/180 brings lon≈110°E to world_z > 0 (front face).
// Yirgacheffe (38°E) will be off the front edge — acceptable as the three
// in-membership Asian pins (orange) are what must read on load.
const INITIAL_ROTATION_Y = (110 * Math.PI) / 180;

// Per-pin node-head glyph radius — SAME as the ATLAS node-head (WorldlineGlobe
// L744-766 uses 0.012; we lift slightly to 0.018 so a single pin reads at the
// 300px standby scale per Betelgeuse's GLOBE directive).
const PIN_RADIUS = 0.018;
// Hover emphasis — the matching pin scales up + brightens (§5.8 / §9, 120ms).
const PIN_HOVER_SCALE = 1.8;

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
 * Build the static scene graph (lights, globe body with the SHARED ATLAS surface
 * texture, NO second wireframe sphere — the grid is baked into the texture, so a
 * separate wireframe would double the grid; §5.2 / Betelgeuse "reconcile the
 * double grid to one"). Returns the scene + globe group + a cleanup that disposes
 * everything it created.
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

  // ── Globe body — MeshLambertMaterial fed the SHARED ATLAS surface texture ──
  // The texture carries the paper-cream gradient, the baked lat/long grid, AND
  // (async) the real Earth coastline silhouette — i.e. the WORLD MAP that goal 2
  // requires. Lambert honors `map`; roughnessMap/bumpMap are dropped (§5.4).
  const surface = buildSurfaceTextures();
  const sphereGeo = new THREE.SphereGeometry(GLOBE_RADIUS, GEO_SEGMENTS, GEO_SEGMENTS);
  const paperMat = new THREE.MeshLambertMaterial({ map: surface.map });
  const sphere = new THREE.Mesh(sphereGeo, paperMat);
  globe.add(sphere);

  const cleanup = () => {
    sphereGeo.dispose();
    paperMat.dispose();
    surface.map.dispose();
    surface.rough.dispose();
    surface.bump.dispose();
    scene.remove(ambient, key, globe);
  };

  return { scene, globe, cleanup };
}

/**
 * Build one node-head mesh per pin (SphereGeometry — the ATLAS node-head glyph).
 * Each mesh is positioned on the globe surface via the canonical ATLAS
 * projection and tagged with its pin index in userData for hover + click
 * addressing. Returns the meshes (aligned to pins[i]) plus the shared geometry +
 * per-pin materials for disposal. Out-of-membership pins render at REAL material
 * opacity 0.32 (no paper-lerp fake-alpha hack — §5.3).
 */
function buildPinMeshes(pins: MiniGlobePin[]): {
  meshes: THREE.Mesh[];
  geometry: THREE.SphereGeometry;
  materials: THREE.MeshBasicMaterial[];
} {
  const geometry = new THREE.SphereGeometry(PIN_RADIUS, 12, 12);
  const meshes: THREE.Mesh[] = [];
  const materials: THREE.MeshBasicMaterial[] = [];

  for (let i = 0; i < pins.length; i++) {
    const v = latLonToVec3(pins[i].lat, pins[i].lon, GLOBE_RADIUS * 1.01);
    // Per-pin material so membership re-colour + hover can set color/opacity per
    // pin without a per-frame attribute rebuild. Default: in-membership accent.
    const material = new THREE.MeshBasicMaterial({
      color: HEX_ACCENT_ORANGE,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(v.x, v.y, v.z);
    mesh.userData.pinIndex = i;
    meshes.push(mesh);
    materials.push(material);
  }

  return { meshes, geometry, materials };
}

export default function ArchiveMiniGlobeThreeJS({
  size,
  pins,
  activePins,
  hoveredEntryId,
  onPinHover,
  onPinClick,
  onGlobeClick,
}: MiniGlobeThreeJSProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const reducedMotionRef = useRef(false);

  // Imperative handles updated by the scene effect, read by the sync effects.
  const pinMeshesRef = useRef<THREE.Mesh[]>([]);
  const pinMaterialsRef = useRef<THREE.MeshBasicMaterial[]>([]);
  const globeRef = useRef<THREE.Group | null>(null);
  const renderOnceRef = useRef<(() => void) | null>(null);

  // Set of active ids — recomputed only when activePins changes (no useEffect).
  const activeIdSet = useMemo(
    () => new Set(activePins.map((p) => p.id)),
    [activePins],
  );

  // Stable refs for handlers so the scene effect need not re-run on prop
  // identity changes. Synced inside an effect — never mutated during render.
  const pinsRef = useRef(pins);
  const onPinClickRef = useRef(onPinClick);
  const onGlobeClickRef = useRef(onGlobeClick);
  const onPinHoverRef = useRef(onPinHover);
  useEffect(() => {
    pinsRef.current = pins;
    onPinClickRef.current = onPinClick;
    onGlobeClickRef.current = onGlobeClick;
    onPinHoverRef.current = onPinHover;
  }, [pins, onPinClick, onGlobeClick, onPinHover]);

  // ── Scene lifecycle — build once per pin-set, dispose on unmount/change ──
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Hydration-safe reduced-motion read — inside useEffect, never during render.
    reducedMotionRef.current =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const { scene, globe, cleanup: cleanupScene } = buildScene();
    // FIX-TILT: bias the starting longitude so Asia (Bangkok/Chiang Mai/Kyoto)
    // faces the camera on load. The idle rotation continues from this offset.
    globe.rotation.y = INITIAL_ROTATION_Y;
    globeRef.current = globe;

    const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 100);
    camera.position.set(0, 0, 3.4);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    // FIX-C: updateStyle=true (3rd arg) pins canvas.style.width/height = size px,
    // so the CSS box is always `size` regardless of DPR. Buffer stays size×DPR.
    renderer.setSize(size, size, true);
    container.appendChild(renderer.domElement);

    // ── Pin node-head meshes — children of the globe group so they co-rotate ──
    const { meshes, geometry, materials } = buildPinMeshes(pins);
    for (const m of meshes) globe.add(m);
    pinMeshesRef.current = meshes;
    pinMaterialsRef.current = materials;

    // ── Interaction: pointer pick via raycaster (pins) + globe-surface click ──
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let pointerInside = false;
    let lastPointerOutAt = 0;

    const toNdc = (ev: PointerEvent | MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const pickPinIndex = (): number | null => {
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(meshes, false);
      if (hits.length === 0) return null;
      const idx = hits[0].object.userData.pinIndex;
      return typeof idx === 'number' ? idx : null;
    };

    const onClick = (ev: MouseEvent) => {
      toNdc(ev);
      const idx = pickPinIndex();
      const pin = idx != null ? pinsRef.current[idx] : null;
      if (pin) onPinClickRef.current(pin);
      else onGlobeClickRef.current();
    };

    // Goal 2 (reverse) — pin hover raycast → onPinHover(entryId). Drives the
    // ledger row wash + scrollIntoView on the parent side.
    let lastHoverId: string | null = null;
    const onPointerMove = (ev: PointerEvent) => {
      toNdc(ev);
      const idx = pickPinIndex();
      const pin = idx != null ? pinsRef.current[idx] : null;
      const id = pin ? pin.id : null;
      // Cursor affordance — pointer over a pin, default over bare surface.
      renderer.domElement.style.cursor = pin ? 'pointer' : 'grab';
      if (id !== lastHoverId) {
        lastHoverId = id;
        onPinHoverRef.current?.(id);
      }
    };

    const onPointerEnter = () => {
      pointerInside = true;
    };
    const onPointerLeave = () => {
      pointerInside = false;
      lastPointerOutAt = performance.now();
      if (lastHoverId !== null) {
        lastHoverId = null;
        onPinHoverRef.current?.(null);
      }
    };

    const el = renderer.domElement;
    el.style.cursor = 'grab';
    el.style.display = 'block';
    el.style.maxWidth = '100%';
    el.addEventListener('click', onClick);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerenter', onPointerEnter);
    el.addEventListener('pointerleave', onPointerLeave);

    // ── Render loop — idle Y-rotation @ 60s/rev; pauses on pointer-in,
    //    resumes 3s after pointer-out. Reduced-motion → single frame, no loop. ──
    let raf = 0;
    let lastT = performance.now();

    const renderOnce = () => renderer.render(scene, camera);
    renderOnceRef.current = renderOnce;

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
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerenter', onPointerEnter);
      el.removeEventListener('pointerleave', onPointerLeave);

      for (const m of meshes) globe.remove(m);
      geometry.dispose();
      for (const mat of materials) mat.dispose();
      cleanupScene();

      renderer.dispose();
      // forceContextLoss frees the GPU context immediately (no leak on unmount —
      // §5.10 / FIX-G reliability). Guard: present in all modern three builds.
      renderer.forceContextLoss?.();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      pinMeshesRef.current = [];
      pinMaterialsRef.current = [];
      globeRef.current = null;
      renderOnceRef.current = null;
    };
    // Rebuild only when the pin SET or size changes (positions are baked in).
    // activePins re-colour + hover are handled by the separate sync effects.
  }, [pins, size]);

  // ── Membership re-colour — REAL per-material color + opacity (§5.3, §9) ──
  // In-membership → accent-orange @ 1.0; out-of-membership → ink @ real 0.32.
  // No paper-lerp fake-alpha hack: MeshBasicMaterial supports true opacity.
  useEffect(() => {
    const materials = pinMaterialsRef.current;
    if (materials.length === 0) return;
    for (let i = 0; i < pins.length; i++) {
      const mat = materials[i];
      if (!mat) continue;
      const inMembership = activeIdSet.has(pins[i].id);
      if (inMembership) {
        mat.color.setHex(HEX_ACCENT_ORANGE);
        mat.opacity = 1;
      } else {
        mat.color.setHex(HEX_INK);
        mat.opacity = OUT_MEMBERSHIP_OPACITY;
      }
    }
    // Single-frame repaint so the recolour shows under reduced-motion (no rAF).
    renderOnceRef.current?.();
  }, [activeIdSet, pins]);

  // ── Bidirectional hover — ledger row → globe pin (goal 2 forward) ──
  // hoveredEntryId set by the parent on row hover/focus. The matching pin mesh
  // scales up + brightens to accent-orange; others return to membership state.
  useEffect(() => {
    const meshes = pinMeshesRef.current;
    const materials = pinMaterialsRef.current;
    if (meshes.length === 0) return;
    for (let i = 0; i < pins.length; i++) {
      const mesh = meshes[i];
      const mat = materials[i];
      if (!mesh || !mat) continue;
      const isHovered = hoveredEntryId != null && pins[i].id === hoveredEntryId;
      const inMembership = activeIdSet.has(pins[i].id);
      mesh.scale.setScalar(isHovered ? PIN_HOVER_SCALE : 1);
      if (isHovered) {
        // Full-opacity accent on hover regardless of membership (§9 pin hover).
        mat.color.setHex(HEX_ACCENT_ORANGE);
        mat.opacity = 1;
      } else if (inMembership) {
        mat.color.setHex(HEX_ACCENT_ORANGE);
        mat.opacity = 1;
      } else {
        mat.color.setHex(HEX_INK);
        mat.opacity = OUT_MEMBERSHIP_OPACITY;
      }
    }
    renderOnceRef.current?.();
  }, [hoveredEntryId, activeIdSet, pins]);

  const visibleCount = activePins.length;
  const totalCount = pins.length;

  return (
    <div
      role="img"
      aria-label={`coordinate map of archive entries — ${visibleCount} of ${totalCount} loci visible`}
      style={{ width: size }}
    >
      {/* overflow:hidden — defense in depth (FIX-C): a future regression cannot
          bleed the canvas past the rail box. */}
      <div
        ref={containerRef}
        style={{ width: size, height: size, overflow: 'hidden' }}
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
