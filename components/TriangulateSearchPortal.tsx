"use client";

/**
 * TriangulateSearchPortal.tsx — client component
 * ─────────────────────────────────────────────────────────────────────────────
 * Root-level portal for the Triangulate Search overlay.
 *
 * Responsibilities:
 *   1. Listens for the `/` hotkey (guarded: not when an input/textarea has focus)
 *      to open the overlay from anywhere on the site.
 *   2. Listens for the custom "triangulate:open" event dispatched by Nav.tsx
 *      when the ◇ ARCHIVE link is clicked.
 *   3. Manages the open/close boolean state.
 *   4. Renders <TriangulateSearchOverlay> (which mounts into a portal).
 *
 * Mounted at root layout level in app/layout.tsx so the hotkey works on every
 * route, including the globe, photo entries, and article entries.
 *
 * Spec: docs/design/14-triangulate-search.md §overlay + §accessibility
 * Vision lock: VISION-2026-05-31-search-lineage-console.md §1.1 (Π1)
 *
 * prefers-reduced-motion: delegated to TriangulateSearch (transitions).
 *
 * Owner: Sirius (α-SUR-01) · S4 Triangulate Search (VISION-2026-05-31)
 */

import { useCallback, useEffect, useState } from "react";
import { TriangulateSearchOverlay } from "@/components/TriangulateSearch";
import type { MiniGlobePin } from "@/lib/content";

interface TriangulateSearchPortalProps {
  /**
   * The FULL privacy-gated pin set (getMiniGlobePins over the whole corpus) —
   * the SAME source /archive uses. The overlay intersects this with the pagefind
   * result URLs so its globe plots the SAME loci /archive plots. Passed from the
   * server (app/layout.tsx). Defaults to [] for safety.
   */
  allPins?: MiniGlobePin[];
}

export function TriangulateSearchPortal({
  allPins = [],
}: TriangulateSearchPortalProps) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  // ── `/` hotkey listener ─────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Guard: do not trigger if an input element holds focus.
      const tag = (document.activeElement as HTMLElement | null)?.tagName ?? "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      // Guard: meta / ctrl / alt combos are not the trigger.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Guard: only the bare `/` key.
      if (e.key !== "/") return;
      // Do not open if overlay is already open (handled internally).
      if (isOpen) return;
      e.preventDefault();
      open();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, open]);

  // ── Custom event from Nav ◇ ARCHIVE link ───────────────────────────────────
  useEffect(() => {
    const handleOpen = () => open();
    window.addEventListener("triangulate:open", handleOpen);
    return () => window.removeEventListener("triangulate:open", handleOpen);
  }, [open]);

  return (
    <TriangulateSearchOverlay isOpen={isOpen} onClose={close} allPins={allPins} />
  );
}
