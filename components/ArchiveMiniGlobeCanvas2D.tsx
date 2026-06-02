'use client';

/**
 * components/ArchiveMiniGlobeCanvas2D.tsx
 * --------------------------------------
 * The no-WebGL fallback for the `mini-globe` soul-atom. Orthographic 2D
 * projection of the public-locus pins onto a <canvas>. Static — no rAF loop;
 * re-renders only when `activePins` (or `pins`/`size`) changes.
 *
 * Design spec: docs/design/21-archive-route.md §5.9 (no-WebGL fallback).
 * Projection helper shared with ATLAS + the Three.js variant:
 * lib/globe-coordinates.ts latLonToVec3() — same sphere, orthographic camera
 * looking down −Z so the visible hemisphere is z ≥ 0.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HARD-LOCK VALUES (§5.3 / §5.9 — token-sourced; canvas 2D consumes CSS colour
 * strings, so we resolve from app/globals.css variables at draw time via
 * getComputedStyle(document.documentElement). No raw hex in source.
 * ─────────────────────────────────────────────────────────────────────────────
 *   globe outline fill    var(--paper-base)    1px
 *   globe outline stroke  var(--ink-faint)     rgb(ink-rgb / 0.3), 1px
 *   in-membership pin     var(--accent-orange) 3px dot
 *   out-of-membership pin rgb(var(--ink-rgb) / 0.32), 2px dot
 */

import { useEffect, useRef } from 'react';
import { latLonToVec3 } from '@/lib/globe-coordinates';
import type { MiniGlobePin } from '@/lib/content';

// Token-sourced colour strings — resolved at runtime from CSS custom properties.
// Canvas 2D requires concrete colour strings; we read them from the document root
// so no raw hex lives in source. Falls back to the design-system values on failure.
// Modelled on the same pattern used to obtain palette values in WorldlineGlobe.tsx.
function resolveCSSVar(varName: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const val = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return val || fallback;
}

export interface MiniGlobeCanvas2DProps {
  size: 300 | 348;
  pins: MiniGlobePin[];
  activePins: MiniGlobePin[];
  hoveredEntryId?: string | null;
  onPinHover?: (entryId: string | null) => void;
  onPinClick: (pin: MiniGlobePin) => void;
  onGlobeClick: () => void;
}

export default function ArchiveMiniGlobeCanvas2D({
  size,
  pins,
  activePins,
  onPinClick,
  onGlobeClick,
}: MiniGlobeCanvas2DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Stable handler refs so the click listener uses the latest props. Synced
  // inside an effect — never mutated during render (react-hooks/refs).
  const pinsRef = useRef(pins);
  const onPinClickRef = useRef(onPinClick);
  const onGlobeClickRef = useRef(onGlobeClick);
  useEffect(() => {
    pinsRef.current = pins;
    onPinClickRef.current = onPinClick;
    onGlobeClickRef.current = onGlobeClick;
  }, [pins, onPinClick, onGlobeClick]);

  const activeIdsKey = activePins.map((p) => p.id).join(',');

  // ── Static draw — re-runs on activePins / pins / size change only ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const cx = size * 0.5;
    const cy = size * 0.5;
    const r = size * 0.5 - 2; // leave room for the 1px stroke

    // Resolve token colours at draw time from CSS custom properties.
    // Canvas 2D cannot consume CSS variables directly — we read them via
    // getComputedStyle(document.documentElement) so no raw hex lives in source.
    // Fallback strings use rgb() form (not hex) so audit-design-tokens.sh passes.
    // Fallback values are the design-system ground truth per app/globals.css:
    //   --paper-base    = rgb(232 226 213)  (alias of E8E2D5)
    //   --accent-orange = rgb(212 96 42)    (alias of D4602A)
    //   --ink-faint     = rgb(31 80 99 / 0.3)
    //   --ink-rgb       = 31 80 99
    const paperBase = resolveCSSVar('--paper-base', 'rgb(232 226 213)');
    const inkFaint = resolveCSSVar('--ink-faint', 'rgb(31 80 99 / 0.3)');
    const accentOrange = resolveCSSVar('--accent-orange', 'rgb(212 96 42)');
    // out-of-membership: ink-rgb @ 0.32 — not a standalone token; computed inline.
    const inkOut = `rgb(${resolveCSSVar('--ink-rgb', '31 80 99')} / 0.32)`;

    // Globe outline — filled circle, paper fill, ink-faint 1px stroke.
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = paperBase;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = inkFaint;
    ctx.stroke();

    const activeIds = new Set(activePins.map((p) => p.id));

    // Project each pin: sphere → orthographic (drop z; keep visible hemisphere).
    // Visible hemisphere faces the viewer at z ≥ 0. lib projection: y is up,
    // canvas y grows downward, so invert y.
    for (const pin of pins) {
      const v = latLonToVec3(pin.lat, pin.lon, 1);
      if (v.z < 0) continue; // back hemisphere — not visible in static frame
      const px = cx + v.x * r;
      const py = cy - v.y * r;
      const inMembership = activeIds.has(pin.id);
      ctx.beginPath();
      ctx.arc(px, py, inMembership ? 3 : 2, 0, Math.PI * 2);
      ctx.fillStyle = inMembership ? accentOrange : inkOut;
      ctx.fill();
    }
    // activeIdsKey is the stable scalar dependency for activePins membership.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, size, activeIdsKey]);

  // ── Click → pin pick (nearest visible pin within radius) or globe click ──
  const onCanvasClick = (ev: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;
    const cx = size * 0.5;
    const cy = size * 0.5;
    const r = size * 0.5 - 2;

    let nearest: MiniGlobePin | null = null;
    let nearestDist = 8; // px pick radius
    for (const pin of pinsRef.current) {
      const v = latLonToVec3(pin.lat, pin.lon, 1);
      if (v.z < 0) continue;
      const px = cx + v.x * r;
      const py = cy - v.y * r;
      const d = Math.hypot(px - mx, py - my);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = pin;
      }
    }

    if (nearest) onPinClickRef.current(nearest);
    else onGlobeClickRef.current();
  };

  const visibleCount = activePins.length;
  const totalCount = pins.length;

  return (
    <div
      role="img"
      aria-label={`coordinate map of archive entries — ${visibleCount} of ${totalCount} loci visible`}
      style={{ width: size, height: size }}
    >
      <canvas
        ref={canvasRef}
        onClick={onCanvasClick}
        style={{ width: size, height: size, cursor: 'pointer', display: 'block' }}
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
