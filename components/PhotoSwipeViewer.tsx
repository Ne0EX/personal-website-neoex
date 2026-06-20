"use client";

/**
 * PhotoSwipeViewer.tsx — client island
 * ─────────────────────────────────────────────────────────────────────────────
 * Wraps the server-rendered PhotoEntry on mobile (<600px) to add swipe-to-navigate
 * between photos in a roll. Desktop (≥600px) renders children inert — the lightbox
 * overlay handles navigation there.
 *
 * Spec: docs/plans/mossy-inventing-hinton.md §S4 · Photo swipe detail
 *
 * Key decisions:
 *   - Uses router.push (next/navigation) for route-level navigation — keeps URLs
 *     canonical (shareable, back-button, SEO). Server component does per-photo load.
 *   - Prefetches prev/next on mount for instant feels.
 *   - touch-action:pan-y on the wrapper: vertical scroll survives; horizontal drag
 *     is tracked via pointer events.
 *   - NEVER calls setPointerCapture — it re-introduces the CW-11 scroll-trap (see
 *     WorldlineGlobe.tsx onMoveDrag for the reference pattern).
 *   - prefers-reduced-motion: no transform-follow animation in v1; just navigate on
 *     threshold. Motion check is in useEffect (hydration-safe).
 *   - Phone-only gate: matchMedia('(max-width:600px)') in useEffect, same inline idiom
 *     used by GalleryGrid.tsx and TriangulateSearch.tsx. No shared hook.
 *
 * Modeled after: GalleryGrid.tsx (router + matchMedia idiom), TriangulateSearch.tsx
 * (matchMedia + reducedMotion pattern).
 *
 * Owner: Sirius (α-SUR-01) · mobile-native S4
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PhotoSwipeViewerProps {
  /** URL of the previous photo in the roll; null at the start of the roll. */
  prevHref: string | null;
  /** URL of the next photo in the roll; null at the end of the roll. */
  nextHref: string | null;
  children: React.ReactNode;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Minimum horizontal distance (px) to trigger a swipe navigation. */
const SWIPE_THRESHOLD_PX = 60;

// ─────────────────────────────────────────────────────────────────────────────
// PhotoSwipeViewer
// ─────────────────────────────────────────────────────────────────────────────

export function PhotoSwipeViewer({ prevHref, nextHref, children }: PhotoSwipeViewerProps) {
  const router = useRouter();

  // Hydration-safe: read media queries in effect, not during render.
  const [isPhone, setIsPhone] = useState(false);
  // reducedMotion is read here for future v1+ enhancement; v1 navigates without animation.
  const [, setReducedMotion] = useState(false);

  // Pointer tracking state — stored in refs to avoid re-renders on every move.
  const downRef = useRef<{ x: number; y: number } | null>(null);

  // ── Prefetch + media query setup ──────────────────────────────────────────
  useEffect(() => {
    // Phone gate: inline matchMedia idiom (no shared hook — repo convention).
    const mqPhone = window.matchMedia("(max-width: 600px)");
    const mqMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    // queueMicrotask defers setState out of the effect body (same pattern as
    // TriangulateSearch.tsx ~line 632).
    queueMicrotask(() => {
      setIsPhone(mqPhone.matches);
      setReducedMotion(mqMotion.matches);
    });

    const onPhone = (e: MediaQueryListEvent) => setIsPhone(e.matches);
    const onMotion = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mqPhone.addEventListener("change", onPhone);
    mqMotion.addEventListener("change", onMotion);

    // Prefetch adjacent routes so navigation is instant.
    if (prevHref) router.prefetch(prevHref);
    if (nextHref) router.prefetch(nextHref);

    return () => {
      mqPhone.removeEventListener("change", onPhone);
      mqMotion.removeEventListener("change", onMotion);
    };
    // router is stable across renders; prevHref/nextHref are fixed per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prevHref, nextHref]);

  // ── Pointer handlers ───────────────────────────────────────────────────────

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only active on phone; only primary pointer (no multi-touch).
    if (!isPhone) return;
    if (!e.isPrimary) return;
    downRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPhone) return;
    if (!e.isPrimary) return;
    const down = downRef.current;
    downRef.current = null;
    if (!down) return;

    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;

    // Only a horizontal swipe exceeding threshold triggers navigation.
    // |dx| must beat |dy| to avoid triggering on diagonal/vertical scrolls.
    if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) {
        // Left swipe → next photo
        if (nextHref) router.push(nextHref);
      } else {
        // Right swipe → prev photo
        if (prevHref) router.push(prevHref);
      }
    }
  };

  const handlePointerCancel = () => {
    // iOS fires pointercancel aggressively (e.g. during scroll recovery).
    downRef.current = null;
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      // pan-y: vertical scroll passes through to the page; horizontal drag is
      // tracked via pointer events above. NEVER setPointerCapture (CW-11 scroll-trap).
      style={{ touchAction: "pan-y" }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {children}
    </div>
  );
}
