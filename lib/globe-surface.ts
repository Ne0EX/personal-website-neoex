/**
 * lib/globe-surface.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Shared procedural surface-texture builder for the Worldline globe family.
 *
 * This is the SINGLE source of truth for the paper-cream globe albedo, the baked
 * lat/long grid, and the async-multiplied real Earth coastline silhouette. It is
 * imported by BOTH:
 *   - components/WorldlineGlobe.tsx        (the full ATLAS globe)
 *   - components/ArchiveMiniGlobeThreeJS.tsx (the standby mini-globe atom)
 *
 * EXTRACTED VERBATIM (Rule 5 — compose, do not re-derive) from the original
 * inline `buildSurfaceTextures()` that lived in WorldlineGlobe.tsx L412-548.
 * The mini-globe spec (docs/design/21-archive-route.md §5.2 + Betelgeuse review
 * GLOBE directive) requires the mini-globe to CLONE this exact surface — the
 * paper-cream gradient (#BDBBAF→#D2CFC4→#BDBBAF), the baked grid
 * (rgba(31,80,99,0.18)), and the coastline multiply (earth_specular_2048.jpg at
 * globalAlpha 0.28 + blur(1.2px)). Extracting it here means BOTH globes share
 * one implementation; the world-map landmasses can never drift between them.
 *
 * PALETTE BACKUP (these values cannot read CSS vars — Three.js / canvas 2D):
 *   ACTIVE  (TEAL — Re:Boot reference)         BACKUP (INK — v2 navy)
 *   surface gradient stops  #BDBBAF, #D2CFC4   #9E9377, #B5AA8B
 *   surface aging blotches  rgba(70,95,108,…)  rgba(120,100,70,…)
 *   grid line color         rgba(31,80,99,…)   rgba(26,40,50,…)
 *
 * Owner: Sirius (α-SUR-01) — extracted 2026-06-03 under
 *        TASK /archive 3-goals. Logic unchanged from WorldlineGlobe.tsx.
 */

import * as THREE from 'three';

// ─── Surface palette per theme mode ──────────────────────────────────────────
// Canvas 2D cannot read CSS vars — these are the two branches of the
// dark-mode recoloring. Light values are the existing ACTIVE palette
// (TEAL — Re:Boot reference). Dark values are the starting-point night
// palette; Betelgeuse will design-verify final hex against screenshots.
export type SurfaceMode = 'light' | 'dark';

interface SurfacePalette {
  /** Gradient stop at poles (top + bottom). */
  gradPole: string;
  /** Gradient stop at equator (mid band). */
  gradEquator: string;
  /** Aging blotch tint — RGB only (alpha appended inline). */
  blotchRGB: string;
  /** Baked grid stroke — faint lines. */
  gridFaint: string;
  /** Baked grid stroke — equator line. */
  gridEquator: string;
}

const SURFACE_PALETTES: Record<SurfaceMode, SurfacePalette> = {
  light: {
    // Existing TEAL / Re:Boot palette — pixel-identical to pre-dark-mode.
    gradPole:    '#BDBBAF',
    gradEquator: '#D2CFC4',
    blotchRGB:   '70,95,108',
    gridFaint:   'rgba(31,80,99,0.18)',
    gridEquator: 'rgba(31,80,99,0.28)',
  },
  dark: {
    // Night register — deep-ocean tones. Starting point for Betelgeuse review.
    gradPole:    '#16242C',
    gradEquator: '#1E2F37',
    blotchRGB:   '120,150,165',
    gridFaint:   'rgba(216,224,222,0.14)',
    gridEquator: 'rgba(216,224,222,0.22)',
  },
};
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Procedural surface textures — paper-cream base with aging, baked lat/long
 * grid, and async-loaded real Earth coastline silhouette multiplied on top.
 * Returns map + roughness + bump textures. The coastline arrives asynchronously
 * and calls `map.needsUpdate = true` once decoded, so callers should keep the
 * returned textures alive (do not dispose before the image lands).
 *
 * @param mode  'light' (default) → original TEAL palette; 'dark' → night register.
 *
 * Must be called in the browser (uses `document.createElement('canvas')`).
 */
export function buildSurfaceTextures(mode: SurfaceMode = 'light'): {
  map: THREE.CanvasTexture;
  rough: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
} {
  const pal = SURFACE_PALETTES[mode];
  const W = 2048, H = 1024;
  let seed = 9173;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  // ─── Albedo ───
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context failed");

  // Surface base gradient — slightly cooler at poles, paler at equator.
  // Light: cream paper (#BDBBAF → #D2CFC4). Dark: deep-ocean tones.
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, pal.gradPole);
  grad.addColorStop(0.45, pal.gradEquator);
  grad.addColorStop(0.55, pal.gradEquator);
  grad.addColorStop(1, pal.gradPole);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Subtle aging blotches — same alpha for both modes; tint shifts.
  ctx.globalCompositeOperation = "multiply";
  for (let i = 0; i < 18; i++) {
    const x = rand() * W, y = rand() * H;
    const r = 200 + rand() * 300;
    const g2 = ctx.createRadialGradient(x, y, 0, x, y, r);
    g2.addColorStop(0, `rgba(${pal.blotchRGB},0.08)`);
    g2.addColorStop(1, `rgba(${pal.blotchRGB},0)`);
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";

  // Baked lat/long grid — faint dashed
  ctx.strokeStyle = pal.gridFaint;
  ctx.lineWidth = 0.6;
  ctx.setLineDash([3, 4]);
  for (let lon = 0; lon < 360; lon += 30) {
    const x = (lon / 360) * W;
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let lat = 15; lat < 180; lat += 15) {
    const y = (lat / 180) * H;
    ctx.beginPath();
    ctx.moveTo(0, y); ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = pal.gridEquator;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2);
  ctx.stroke();

  // Light paper grain
  const grainImg = ctx.getImageData(0, 0, W, H);
  const gd = grainImg.data;
  for (let i = 0; i < gd.length; i += 4) {
    const n = (rand() - 0.5) * 10;
    gd[i] = Math.max(0, Math.min(255, gd[i] + n));
    gd[i + 1] = Math.max(0, Math.min(255, gd[i + 1] + n));
    gd[i + 2] = Math.max(0, Math.min(255, gd[i + 2] + n));
  }
  ctx.putImageData(grainImg, 0, 0);

  // ─── Roughness map ───
  const rc = document.createElement("canvas");
  rc.width = W; rc.height = H;
  const rctx = rc.getContext("2d")!;
  rctx.fillStyle = "#c8c8c8";
  rctx.fillRect(0, 0, W, H);
  rctx.globalCompositeOperation = "multiply";
  rctx.drawImage(c, 0, 0);
  rctx.globalCompositeOperation = "source-over";
  rctx.fillStyle = "rgba(180,180,180,0.5)";
  rctx.fillRect(0, 0, W, H);

  // ─── Bump map ───
  const bc = document.createElement("canvas");
  bc.width = W; bc.height = H;
  const bctx = bc.getContext("2d")!;
  bctx.fillStyle = "#808080";
  bctx.fillRect(0, 0, W, H);
  bctx.globalCompositeOperation = "multiply";
  bctx.drawImage(c, 0, 0);
  bctx.globalCompositeOperation = "lighten";
  bctx.fillStyle = "#666";
  bctx.fillRect(0, 0, W, H);

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  const rough = new THREE.CanvasTexture(rc);
  const bump = new THREE.CanvasTexture(bc);

  // Async-load real Earth coastline silhouette and multiply over base.
  // FIX: local path — vendored to public/textures/ so this works offline, behind
  // CSP, and when threejs.org is unreachable. File: public/textures/earth_specular_2048.jpg.
  // GRACEFUL FALLBACK: onerror leaves the globe in grid-only state (paper gradient
  // + baked graticule) — no JS error, no console spam loop, no broken render.
  const earthImg = new Image();
  earthImg.onload = () => {
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.28;
    ctx.filter = "blur(1.2px)";
    ctx.drawImage(earthImg, 0, 0, W, H);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    map.needsUpdate = true;

    // Re-derive bump and roughness from updated albedo.
    rctx.globalCompositeOperation = "source-over";
    rctx.fillStyle = "#c8c8c8"; rctx.fillRect(0, 0, W, H);
    rctx.globalCompositeOperation = "multiply";
    rctx.drawImage(c, 0, 0);
    rough.needsUpdate = true;

    bctx.globalCompositeOperation = "source-over";
    bctx.fillStyle = "#808080"; bctx.fillRect(0, 0, W, H);
    bctx.globalCompositeOperation = "multiply";
    bctx.drawImage(c, 0, 0);
    bump.needsUpdate = true;
  };
  // onerror: texture absent or blocked — silently accept grid-only degradation.
  // The globe stays fully functional (paper sphere + graticule + pins).
  // No retry, no throw, no console.error — clean silent fallback.
  earthImg.onerror = () => { /* grid-only fallback — acceptable degradation */ };
  earthImg.src = "/textures/earth_specular_2048.jpg";

  return { map, rough, bump };
}
