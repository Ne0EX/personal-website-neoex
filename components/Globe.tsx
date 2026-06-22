"use client";

/**
 * components/Globe.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Standalone reusable globe sphere — the perfected visual core extracted from
 * the full ATLAS instrument (components/WorldlineGlobe.tsx).
 *
 * What this includes (all the beautiful bits):
 *   • Procedural sphere — SphereGeometry + buildSurfaceTextures(mode)
 *     (reuses lib/globe-surface.ts — single source of truth, never re-derived)
 *   • Matte-dark material handling: dark = roughness 1, no roughnessMap (kills
 *     "moon" specular glints); light = textured roughness 0.95 + map.
 *   • Engraved lat/long graticule + wavy contour rings (lineOpacityScale)
 *   • Inner-shade shell: light 0.35, dark 0.05 — the soft-borderless-edge fix
 *   • Lights: ambient 1.15, key (light 0.18 / dark 0.12), rim 0.08
 *   • Auto-rotation + calm slerp-orbit default camera
 *   • Dark/light via useThemeMode() + recolor-in-place on toggle (no scene
 *     teardown — mirrors WorldlineGlobe's recolor approach)
 *   • setInterval render loop (iOS Safari robustness — NOT requestAnimationFrame)
 *   • prefers-reduced-motion: rotation + recolor degrade gracefully
 *   • Proper cleanup: clearInterval + scene traverse dispose + renderer.dispose
 *
 * What this does NOT include (ATLAS chrome, parked):
 *   • No strata travel, no dig panel, no HUD
 *   • No NETRA console / voice
 *   • No place-nodes / NeX fiction nodes / branching tendrils
 *   • No axis spine / pole beacons / worldline arc
 *   • No drag-to-orbit (simple auto-rotate only)
 *
 * Props:
 *   size?        — CSS width/height of the container in px (default 420)
 *   autoRotate?  — spin slowly on Y axis (default true)
 *   className?   — extra CSS classes on the outer div
 *
 * Palette: GLOBE_PALETTES imported from lib/globe-palettes.ts — the SAME
 *          values WorldlineGlobe.tsx uses, guaranteed in sync.
 *
 * Owner: Sirius (α-SUR-01) · extracted 2026-06-22 · globe-component task
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useThemeMode } from "@/lib/useThemeMode";
import type { ThemeMode } from "@/lib/useThemeMode";
import { GLOBE_PALETTES } from "@/lib/globe-palettes";
import type { GlobePalette } from "@/lib/globe-palettes";
import { buildSurfaceTextures } from "@/lib/globe-surface";

// ─── Constants ───────────────────────────────────────────────────────────────
const GLOBE_RADIUS = 1;

// ─── Minimal recolor bag (subset of WorldlineGlobe's ThemeMaterials) ─────────
// Only the materials this stripped-down globe actually builds.
type GlobeThemeMaterials = {
  lineMats: THREE.LineBasicMaterial[];
  contourMats: THREE.LineBasicMaterial[];
  innerShade: THREE.MeshBasicMaterial;
  edgeGlowMat: THREE.MeshBasicMaterial;
  sphereMat: THREE.MeshStandardMaterial;
};

type GlobeSceneRefs = {
  lights: {
    ambient: THREE.AmbientLight;
    key: THREE.DirectionalLight;
    rim: THREE.DirectionalLight;
  };
  themeMaterials: GlobeThemeMaterials;
};

// ─── Scene builder ────────────────────────────────────────────────────────────
/**
 * Build the minimal sphere scene — surface + graticule + contours + inner-shade
 * + lights. Returns scene, globe group, camera-target (origin), scene refs for
 * recolor, and a cleanup function.
 *
 * Modelled after WorldlineGlobe's buildScene() but stripped of ATLAS chrome.
 */
function buildGlobeScene(
  palette: GlobePalette,
  mode: ThemeMode,
): {
  scene: THREE.Scene;
  globe: THREE.Group;
  refs: GlobeSceneRefs;
  cleanup: () => void;
} {
  const scene = new THREE.Scene();
  scene.background = null;

  const isLight = mode === "light";

  // ── Lights ─────────────────────────────────────────────────────────────────
  // Mirror WorldlineGlobe exactly: ambient 1.15, key low-dark (0.12)/light (0.18),
  // rim 0.08. Dark key stays low — ambient carries illumination, a strong dark
  // key produces "moon" highlights on the deep sphere.
  const ambientLight = new THREE.AmbientLight(palette.ambient, 1.15);
  scene.add(ambientLight);

  const key = new THREE.DirectionalLight(palette.key, isLight ? 0.18 : 0.12);
  key.position.set(2, 2.5, 3);
  scene.add(key);

  const rim = new THREE.DirectionalLight(palette.rim, 0.08);
  rim.position.set(-3, -1, -2);
  scene.add(rim);

  const globe = new THREE.Group();
  scene.add(globe);

  // ── Sphere surface ─────────────────────────────────────────────────────────
  // buildSurfaceTextures() is the shared single source of truth (lib/globe-surface.ts).
  // Dark = fully matte (roughness 1, no roughnessMap) — the roughnessMap makes
  // land glossier than ocean, producing white specular glints on the dark sphere.
  // Light keeps textured roughness (0.95 + map). metalness 0 both modes.
  const surface = buildSurfaceTextures(mode);
  const sphereGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 128, 128);
  const paperMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: surface.map,
    roughnessMap: isLight ? surface.rough : null,
    roughness: isLight ? 0.95 : 1,
    bumpMap: surface.bump,
    bumpScale: 0.008,
    metalness: 0,
  });
  const sphere = new THREE.Mesh(sphereGeo, paperMat);
  globe.add(sphere);

  // ── Inner-shade shell ──────────────────────────────────────────────────────
  // Light 0.35: gives depth by darkening the rim.
  // Dark 0.05: nearly off so the lighter ocean disc reaches the edge →
  //   soft natural silhouette on the dark bg (no outline ring).
  const innerShadeMat = new THREE.MeshBasicMaterial({
    color: palette.innerShade,
    side: THREE.BackSide,
    transparent: true,
    opacity: isLight ? 0.35 : 0.05,
  });
  const innerShade = new THREE.Mesh(
    new THREE.SphereGeometry(0.998, 64, 64),
    innerShadeMat,
  );
  globe.add(innerShade);

  // ── Edge glow (disabled — edgeGlowOpacity is 0 in both modes) ─────────────
  // Kept for parity with WorldlineGlobe recolor path — the opacity stays 0.
  const edgeGlowMat = new THREE.MeshBasicMaterial({
    color: palette.netraTracker,
    side: THREE.BackSide,
    transparent: true,
    opacity: palette.edgeGlowOpacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const edgeGlow = new THREE.Mesh(
    new THREE.SphereGeometry(1.015, 64, 64),
    edgeGlowMat,
  );
  globe.add(edgeGlow);

  // ── Engraved lat/long graticule ────────────────────────────────────────────
  // Mirror of WorldlineGlobe: lineMat (0.55×scale) + lineMatFaint (0.3×scale).
  // lineOpacityScale dims the cream curvation lines in dark mode so they don't
  // read hotter than the teal-on-cream light mode.
  const lineMat = new THREE.LineBasicMaterial({
    color: palette.ink,
    transparent: true,
    opacity: 0.55 * palette.lineOpacityScale,
  });
  const lineMatFaint = new THREE.LineBasicMaterial({
    color: palette.ink,
    transparent: true,
    opacity: 0.3 * palette.lineOpacityScale,
  });

  const makeLatRing = (latDeg: number, mat: THREE.LineBasicMaterial) => {
    const lat = (latDeg * Math.PI) / 180;
    const r = Math.cos(lat);
    const y = Math.sin(lat);
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r * 1.001, y * 1.001, Math.sin(a) * r * 1.001));
    }
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
  };
  const makeMeridian = (lonDeg: number, mat: THREE.LineBasicMaterial) => {
    const lon = (lonDeg * Math.PI) / 180;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const t = (i / 128) * Math.PI - Math.PI / 2;
      const r = Math.cos(t);
      pts.push(new THREE.Vector3(Math.cos(lon) * r * 1.001, Math.sin(t) * 1.001, Math.sin(lon) * r * 1.001));
    }
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
  };

  globe.add(makeLatRing(0, lineMat));
  for (let lat = -75; lat <= 75; lat += 15) {
    if (lat !== 0) globe.add(makeLatRing(lat, lineMatFaint));
  }
  for (let lon = 0; lon < 360; lon += 15) {
    const mat = lon % 90 === 0 ? lineMat : lineMatFaint;
    globe.add(makeMeridian(lon, mat));
  }

  // ── Contour rings ──────────────────────────────────────────────────────────
  // Wavy elevation lines — each uses a clone so recolor can target them individually.
  // Opacity 0.7 × lineOpacityScale (same curvation budget as WorldlineGlobe).
  const contoursGroup = new THREE.Group();
  globe.add(contoursGroup);

  const contourMat = new THREE.LineBasicMaterial({
    color: palette.ink,
    transparent: true,
    opacity: 0.7 * palette.lineOpacityScale,
  });

  const makeContour = (latCenter: number, ampl: number, phase: number) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 256; i++) {
      const a = (i / 256) * Math.PI * 2;
      const lat =
        ((latCenter +
          ampl * (Math.sin(a * 3 + phase) * 0.6 + Math.sin(a * 5 + phase * 1.7) * 0.4)) *
          Math.PI) /
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

  // ── Collect contour materials for recolor ─────────────────────────────────
  const contourMatsCollected = contoursGroup.children.map(
    (c) => (c as THREE.Line).material as THREE.LineBasicMaterial,
  );

  return {
    scene,
    globe,
    refs: {
      lights: { ambient: ambientLight, key, rim },
      themeMaterials: {
        lineMats: [lineMat, lineMatFaint],
        contourMats: contourMatsCollected,
        innerShade: innerShadeMat,
        edgeGlowMat,
        sphereMat: paperMat,
      },
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

// ─── Globe component ─────────────────────────────────────────────────────────

export interface GlobeProps {
  /** Container size in px (square). Default: 420. */
  size?: number;
  /** Slowly auto-rotate on Y axis. Default: true. */
  autoRotate?: boolean;
  /** Additional CSS class on the outer container div. */
  className?: string;
}

/**
 * Globe — standalone reusable sphere. Drop it on any page.
 *
 * It renders the perfected Worldline globe visual (paper/teal surface, matte
 * dark, soft-edge silhouette, calm curvation lines) with no ATLAS chrome.
 * Responds to the site-wide dark/light toggle via recolor-in-place (no scene
 * teardown on toggle — camera and rotation state survive).
 */
export function Globe({ size = 420, autoRotate = true, className }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mode = useThemeMode();
  // Stable ref so the setInterval tick closure reads current mode without stale capture.
  const modeRef = useRef<ThemeMode>(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // Live scene refs — set by the THREE setup effect, read by the recolor effect.
  const sceneRefsRef = useRef<GlobeSceneRefs | null>(null);
  // Active palette ref — kept in sync so the recolor effect always has current values.
  const activePaletteRef = useRef<GlobePalette>(GLOBE_PALETTES.light);

  // ── THREE setup — built ONCE on mount ─────────────────────────────────────
  // Mirrors WorldlineGlobe: scene built once, theme changes handled by the
  // standalone recolor effect. setInterval (not rAF) for iOS Safari robustness.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Hydration-safe reduced-motion read — inside useEffect only.
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Initial mode — modeRef is written synchronously by [mode] effect before
    // this runs (because it's a separate shallow effect), so we always get the
    // correct first-paint palette even when the user prefers dark on load.
    const initialMode = modeRef.current;
    const palette = GLOBE_PALETTES[initialMode];
    activePaletteRef.current = palette;

    const { scene, globe, refs, cleanup } = buildGlobeScene(palette, initialMode);
    sceneRefsRef.current = refs;

    // Camera — PerspectiveCamera looking at origin.
    // FOV 36 matches WorldlineGlobe's camera so the sphere feels the same size.
    const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 100);
    camera.position.set(0, 0, 4.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Fit renderer to container, update on resize.
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

    // Auto-rotate speed — rad/frame at 16ms tick.
    const ROTATE_SPEED = 0.003;

    // Tick — called by setInterval at 16ms (≈60fps).
    const tick = () => {
      if (autoRotate && !reducedMotion) {
        globe.rotation.y += ROTATE_SPEED;
      }
      renderer.render(scene, camera);
    };

    // Render loop — setInterval chosen over requestAnimationFrame for iOS Safari
    // robustness: on iOS Safari, rAF does not advance while the tab is in the
    // background. If the user opens the site with the tab backgrounded, rAF never
    // fires and the globe stays permanently blank. setInterval ticks reliably.
    // Mirror of WorldlineGlobe's interval pattern (assert f in mobile-touch-contract).
    const intervalId = window.setInterval(tick, 16);

    return () => {
      window.clearInterval(intervalId);
      ro.disconnect();
      cleanup();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      sceneRefsRef.current = null;
    };
    // deps []: built once, recolor handled by the separate [mode] effect below.
    // autoRotate is read from outer scope but intentionally not in deps —
    // changing autoRotate after mount is not a supported use case for this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Recolor-in-place on theme toggle ───────────────────────────────────────
  // Mirrors WorldlineGlobe's recolor effect exactly (stripped to just the
  // materials this component builds). Camera, rotation, and position survive.
  useEffect(() => {
    const refs = sceneRefsRef.current;
    if (!refs) return;

    const palette = GLOBE_PALETTES[mode];
    activePaletteRef.current = palette;
    const { themeMaterials: tm, lights } = refs;

    // Graticule lines (lineMat + lineMatFaint)
    tm.lineMats.forEach((m, i) => {
      m.color.setHex(palette.ink);
      m.opacity = (i === 0 ? 0.55 : 0.3) * palette.lineOpacityScale;
    });

    // Contour rings
    tm.contourMats.forEach((m) => {
      m.color.setHex(palette.ink);
      m.opacity = 0.7 * palette.lineOpacityScale;
    });

    // Inner-shade sphere
    tm.innerShade.color.setHex(palette.innerShade);
    tm.innerShade.opacity = mode === "dark" ? 0.05 : 0.35;

    // Edge glow (color only — opacity stays 0 per edgeGlowOpacity)
    tm.edgeGlowMat.color.setHex(palette.netraTracker);
    tm.edgeGlowMat.opacity = palette.edgeGlowOpacity;

    // Lights
    lights.ambient.color.setHex(palette.ambient);
    lights.key.color.setHex(palette.key);
    lights.key.intensity = mode === "dark" ? 0.12 : 0.18;
    lights.rim.color.setHex(palette.rim);

    // Surface texture swap — dispose old, build new, set roughness per mode.
    // Mirrors WorldlineGlobe recolor effect exactly.
    const oldMap   = tm.sphereMat.map;
    const oldRough = tm.sphereMat.roughnessMap;
    const oldBump  = tm.sphereMat.bumpMap;

    const newSurface = buildSurfaceTextures(mode);
    tm.sphereMat.map          = newSurface.map;
    tm.sphereMat.roughnessMap = mode === "dark" ? null : newSurface.rough;
    tm.sphereMat.roughness    = mode === "dark" ? 1 : 0.95;
    tm.sphereMat.bumpMap      = newSurface.bump;
    tm.sphereMat.needsUpdate  = true;

    if (oldMap)   oldMap.dispose();
    if (oldRough) oldRough.dispose();
    if (oldBump)  oldBump.dispose();
    // Dark doesn't use roughnessMap — dispose the freshly-built one to prevent GPU leak.
    if (mode === "dark") newSurface.rough.dispose();
  }, [mode]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: size, height: size, position: "relative" }}
      aria-label="Worldline globe"
      role="img"
    />
  );
}
