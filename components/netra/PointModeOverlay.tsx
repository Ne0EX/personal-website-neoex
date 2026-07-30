"use client";

import { useImperativeHandle, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import "./netra-bay.css";

// A `useSyncExternalStore`-based "has the client committed yet" read —
// the same hydration-safety shape netra-bay-local.ts uses for the
// localStorage-backed log (see that file's header comment), applied here
// to "can `createPortal` target `document.body` yet". This repo's
// eslint-config-next ships the React Compiler's `Recommended` preset,
// which flags `useState(false)` + `useEffect(() => setState(true), [])`
// as a `react-hooks/set-state-in-effect` error (setState called
// synchronously inside an effect body) — `useSyncExternalStore` sidesteps
// that entirely: there is no setState call at all, just a snapshot that
// differs between server (`false`) and client (`true`), which React
// itself reconciles right after the first client commit.
function subscribeNever() {
  return () => {};
}
function getClientMountedSnapshot() {
  return true;
}
function getServerMountedSnapshot() {
  return false;
}

export interface PointModeOverlayHandle {
  /** Paint the four-corner bracket + label chip over `rect`; flips the label below the rect when `rect.top < 34`. */
  show: (rect: DOMRect, label: string) => void;
  /** Same as `show`, plus a brief opacity flash (touch pick confirmation) — no-op animation under `prefers-reduced-motion: reduce` (see netra-bay.css). */
  flash: (rect: DOMRect, label: string) => void;
  /** Hide the overlay (stays mounted — just not painted) and clear any flash state. */
  hide: () => void;
}

/**
 * PointModeOverlay — the point-mode reticle brackets, portaled to
 * `document.body` so it paints above every page surface regardless of
 * local stacking contexts (z-59 — one below the bay dock's z-60, per
 * netra-bay.css's `[data-netra-root]`). Visual reference: NETRA Bay.dc.html
 * lines 86-92 (four L-bracket corner spans + one label chip); design canon
 * per /worldline-design — `--accent-orange`, radius 0, no shadows.
 *
 * Ref-driven per usePointMode.ts's hard rule ("ZERO setState on
 * mousemove"): `show`/`flash`/`hide` mutate the portaled DOM node directly
 * via `useImperativeHandle` — a mousemove never triggers a React
 * re-render here, only a `getBoundingClientRect` + a handful of style
 * writes inside the caller's own rAF throttle.
 *
 * `mounted` gates the `createPortal` call: `document` doesn't exist during
 * SSR, so the portal can only be created after the first client commit.
 * Server and the first client paint both render `null` (`mounted` reads
 * `false` on both — see the `useSyncExternalStore` pair above), so there
 * is no hydration mismatch.
 */
export function PointModeOverlay({ ref }: { ref?: React.Ref<PointModeOverlayHandle> }) {
  const mounted = useSyncExternalStore(subscribeNever, getClientMountedSnapshot, getServerMountedSnapshot);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLSpanElement | null>(null);

  useImperativeHandle(
    ref,
    () => {
      function paint(rect: DOMRect, label: string) {
        const container = containerRef.current;
        const labelEl = labelRef.current;
        if (!container || !labelEl) return;
        container.style.display = "block";
        container.style.left = `${rect.left}px`;
        container.style.top = `${rect.top}px`;
        container.style.width = `${rect.width}px`;
        container.style.height = `${rect.height}px`;
        labelEl.textContent = label;
        labelEl.classList.toggle("is-below", rect.top < 34);
      }

      return {
        show(rect, label) {
          containerRef.current?.classList.remove("is-flashing");
          paint(rect, label);
        },
        flash(rect, label) {
          paint(rect, label);
          const container = containerRef.current;
          if (!container) return;
          // Restart the animation even if a previous flash is still settling
          // — force a reflow so re-adding the class restarts the CSS animation.
          container.classList.remove("is-flashing");
          void container.offsetWidth;
          container.classList.add("is-flashing");
        },
        hide() {
          const container = containerRef.current;
          if (!container) return;
          container.style.display = "none";
          container.classList.remove("is-flashing");
        },
      };
    },
    []
  );

  if (!mounted) return null;

  return createPortal(
    <div ref={containerRef} className="netra-point-overlay" aria-hidden="true" style={{ display: "none" }}>
      <span className="netra-point-corner netra-point-corner-tl" />
      <span className="netra-point-corner netra-point-corner-tr" />
      <span className="netra-point-corner netra-point-corner-bl" />
      <span className="netra-point-corner netra-point-corner-br" />
      <span ref={labelRef} className="netra-point-label">
        SURFACE
      </span>
    </div>,
    document.body
  );
}
