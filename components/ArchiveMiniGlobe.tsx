'use client';

/**
 * components/ArchiveMiniGlobe.tsx
 * ------------------------------
 * Wrapper for the `mini-globe` soul-atom. Feature-detects WebGL and renders the
 * Three.js variant when available, the static Canvas 2D variant otherwise. This
 * single component serves BOTH the /archive right-rail (size 300) and the
 * Triangulate search overlay (size 348 — replacing the old MiniGlobeStub).
 *
 * Design spec: docs/design/21-archive-route.md §5 (mini-globe atom) + §5.6
 * (props contract). The wrapper performs NO privacy logic — pins are pre-gated
 * by getMiniGlobePins() (lib/content/archive.ts §5.7). It renders what it gets.
 *
 * WebGL detection is hydration-safe: the first paint is always the Canvas 2D
 * fallback (deterministic on server + client). After mount, useEffect probes for
 * a WebGL context and, when present, swaps in the Three.js variant. This avoids
 * a hydration mismatch from reading `window.WebGLRenderingContext` during render.
 *
 * Both child variants are dynamically imported with `ssr: false` (next/dynamic —
 * node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md) because Three.js
 * touches `window`/WebGL and must never run during SSR.
 */

import { useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import type { MiniGlobePin } from '@/lib/content';

/**
 * Props contract — docs/design/21-archive-route.md §5.6.
 * MiniGlobePin = { id, kind, lat, lon, route, title } from @/lib/content.
 */
export interface ArchiveMiniGlobeProps {
  /**
   * Canvas edge length in px (both width + height).
   * /archive right-rail: 300. Triangulate overlay: 348.
   */
  size: 300 | 348;

  /**
   * All public-locus entries to render as pins. ONLY entries that passed the
   * privacy gate in getMiniGlobePins() reach this prop. The component does NOT
   * re-gate.
   */
  pins: MiniGlobePin[];

  /**
   * Subset of `pins` currently in membership per active filter / search state.
   * in-membership → accent-orange. out-of-membership → ink @ 0.32. When no
   * filter is active, activePins === pins (all in membership).
   */
  activePins?: MiniGlobePin[];

  /**
   * Bidirectional hover sync (Triangulate overlay REQUIRED; /archive v1 omits).
   */
  hoveredEntryId?: string | null;
  onPinHover?: (entryId: string | null) => void;

  /** Called when a visible pin is clicked. Caller handles navigation. */
  onPinClick?: (pin: MiniGlobePin) => void;

  /**
   * Called when empty globe surface (no pin under cursor) is clicked.
   * /archive: navigate to '/'. Overlay: navigate to '/' + close overlay.
   */
  onGlobeClick?: () => void;
}

// Both variants are client-only (Three.js / canvas touch the browser). ssr:false
// keeps them out of the server render. The Canvas2D fallback is also the
// deterministic first-paint, so it loads eagerly; Three.js loads on demand.
const ArchiveMiniGlobeThreeJS = dynamic(
  () => import('./ArchiveMiniGlobeThreeJS'),
  { ssr: false },
);
const ArchiveMiniGlobeCanvas2D = dynamic(
  () => import('./ArchiveMiniGlobeCanvas2D'),
  { ssr: false },
);

/** Probe for a usable WebGL context. Runs only in the browser (post-mount). */
function probeWebGL(): boolean {
  if (typeof window === 'undefined') return false;
  if (!('WebGLRenderingContext' in window)) return false;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    return gl != null;
  } catch {
    return false;
  }
}

// useSyncExternalStore-backed WebGL detection. The server + first-client snapshot
// is always `false` (→ deterministic Canvas2D first paint, no hydration
// mismatch). The client snapshot probes once and memoises the result, so the
// store value is stable and React upgrades to Three.js after hydration without
// a synchronous setState-in-effect (react-hooks/set-state-in-effect compliant).
let webglMemo: boolean | null = null;
function getClientWebGL(): boolean {
  if (webglMemo === null) webglMemo = probeWebGL();
  return webglMemo;
}
// No external mutation source — WebGL availability does not change at runtime.
function subscribeNoop(): () => void {
  return () => {};
}

export function ArchiveMiniGlobe({
  size,
  pins,
  activePins,
  hoveredEntryId,
  onPinHover,
  onPinClick,
  onGlobeClick,
}: ArchiveMiniGlobeProps) {
  // First paint is the deterministic Canvas2D fallback (server snapshot false →
  // no hydration mismatch). After hydration the client snapshot reports actual
  // WebGL availability and React upgrades to the Three.js variant.
  const useThree = useSyncExternalStore(
    subscribeNoop,
    getClientWebGL, // client snapshot
    () => false, // server snapshot
  );

  // No-op defaults keep the child prop contract total without forcing callers to
  // pass handlers they do not need (the /archive rail v1 omits hover).
  const resolvedActivePins = activePins ?? pins;
  const handlePinClick = onPinClick ?? (() => {});
  const handleGlobeClick = onGlobeClick ?? (() => {});

  const shared = {
    size,
    pins,
    activePins: resolvedActivePins,
    hoveredEntryId,
    onPinHover,
    onPinClick: handlePinClick,
    onGlobeClick: handleGlobeClick,
  };

  // FIX-G: distinct stable React keys so React fully remounts on a FRESH canvas
  // DOM node when the variant swaps (Canvas2D first paint → ThreeJS after WebGL
  // probe). Without distinct keys, React reuses the same <canvas>, and a canvas
  // that already has a 2D context cannot acquire a WebGL context — Three.js
  // throws "Canvas has an existing context of a different type". Distinct keys
  // guarantee each variant owns its own canvas element.
  if (useThree) {
    return <ArchiveMiniGlobeThreeJS key="mini-globe-three" {...shared} />;
  }
  return <ArchiveMiniGlobeCanvas2D key="mini-globe-2d" {...shared} />;
}

export default ArchiveMiniGlobe;
export type { MiniGlobePin };
