"use client";

import { useEffect, useRef, useState } from "react";
import {
  WL_GLOBE_COORD_EVENT,
  type GlobeCoordDetail,
} from "@/lib/client-state/globe-store";

/**
 * SurveyCursor — custom cartographer-crosshair cursor with a live coordinate
 * readout. Hides the native cursor on fine-pointer devices, falls back to
 * native on touch. Switches to a filled triangulation mark when over
 * interactive elements.
 *
 * Coordinate gate (FIX 2026-06-01):
 *   The coordinate label is shown ONLY when the cursor is over the globe
 *   canvas (detected via `closest("[data-globe-canvas]")`). When not over
 *   the globe, the label is empty/hidden.
 *
 * Real coordinate wiring (FIX 2026-06-01):
 *   WorldlineGlobe dispatches WL_GLOBE_COORD_EVENT with the earth-fixed
 *   { lat, lon } from its raycaster on every pointermove hit. SurveyCursor
 *   subscribes and uses that real coordinate when over the globe, or clears
 *   the label on pointer-leave / sphere-miss. The previous viewport-derived
 *   fake coordinate (mx/innerWidth * 360 - 180) has been removed.
 */
export function SurveyCursor() {
  const [enabled, setEnabled] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    if (!fine) return;
    queueMicrotask(() => setEnabled(true));

    document.documentElement.classList.add("hide-native-cursor");

    let raf = 0;
    let mx = -100, my = -100;
    let visible = false;

    const onMove = (e: MouseEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (!visible && rootRef.current) {
        rootRef.current.style.opacity = "1";
        visible = true;
      }
      const t = e.target as Element | null;
      const isInteractive = !!t?.closest(
        "a, button, [role=button], [data-cursor=triangulate]"
      );
      if (rootRef.current) {
        rootRef.current.dataset.mode = isInteractive ? "triangulate" : "survey";
      }

      // Gate: show coordinate label ONLY when cursor is over the globe canvas.
      // When not over the globe, HIDE the entire panel so no empty box renders.
      // Real coordinate value is provided by WL_GLOBE_COORD_EVENT (see below).
      const overGlobe = !!t?.closest("[data-globe-canvas]");
      if (!overGlobe && labelRef.current) {
        labelRef.current.style.display = "none";
      }
    };

    const onLeave = () => {
      if (rootRef.current) rootRef.current.style.opacity = "0";
      visible = false;
    };

    // Listen for real earth-fixed coordinates broadcast from WorldlineGlobe.
    // detail = { lat, lon } on sphere hit; detail = null on miss or pointer-leave.
    const onGlobeCoord = (e: Event) => {
      const detail = (e as CustomEvent<GlobeCoordDetail>).detail;
      if (!labelRef.current) return;
      if (detail === null) {
        // Sphere miss or pointer-leave — HIDE the panel entirely (no empty box).
        labelRef.current.style.display = "none";
      } else {
        // Real earth-fixed coordinate — show the panel and populate it.
        const lonStr = detail.lon.toFixed(2);
        const latStr = detail.lat.toFixed(2);
        labelRef.current.style.display = "";
        labelRef.current.textContent = `${lonStr}° / ${latStr}°`;
      }
    };

    const tick = () => {
      if (rootRef.current) {
        rootRef.current.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    window.addEventListener("mousemove", onMove);
    document.addEventListener("mouseleave", onLeave);
    window.addEventListener(WL_GLOBE_COORD_EVENT, onGlobeCoord);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      window.removeEventListener(WL_GLOBE_COORD_EVENT, onGlobeCoord);
      document.documentElement.classList.remove("hide-native-cursor");
    };
  }, []);

  if (!enabled) return null;

  return (
    <div
      ref={rootRef}
      className="survey-cursor"
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        pointerEvents: "none",
        zIndex: 9999,
        opacity: 0,
        transition: "opacity 180ms ease-out",
      }}
    >
      <svg
        width="44"
        height="44"
        viewBox="-22 -22 44 44"
        style={{ position: "absolute", left: -22, top: -22 }}
      >
        <g className="sc-survey">
          <circle cx="0" cy="0" r="6" fill="none" stroke="var(--accent-orange)" strokeWidth="0.8" />
          <line x1="-12" y1="0" x2="-9"  y2="0" stroke="var(--accent-orange)" strokeWidth="0.8" />
          <line x1="9"   y1="0" x2="12"  y2="0" stroke="var(--accent-orange)" strokeWidth="0.8" />
          <line x1="0" y1="-12" x2="0" y2="-9" stroke="var(--accent-orange)" strokeWidth="0.8" />
          <line x1="0" y1="9"   x2="0" y2="12" stroke="var(--accent-orange)" strokeWidth="0.8" />
          <circle cx="0" cy="0" r="0.9" fill="var(--accent-orange)" />
        </g>
        <g className="sc-triangulate">
          <polygon points="0,-9 7.8,4.5 -7.8,4.5" fill="var(--accent-orange)" />
          <line x1="-13" y1="0" x2="-10" y2="0" stroke="var(--accent-orange)" strokeWidth="0.9" />
          <line x1="10"  y1="0" x2="13"  y2="0" stroke="var(--accent-orange)" strokeWidth="0.9" />
        </g>
      </svg>

      {/* Coordinate label — shown ONLY when cursor is over the globe with a
          real earth-fixed coordinate. Initial state: hidden (display:none) so
          no empty bordered box appears before or after globe contact.
          WL_GLOBE_COORD_EVENT handler sets display="" on hit, "none" on miss. */}
      <span
        ref={labelRef}
        className="t-mono"
        style={{
          position: "absolute",
          left: 16,
          top: 14,
          fontSize: 9,
          letterSpacing: "0.18em",
          color: "var(--ink-soft)",
          background: "var(--paper-base)",
          padding: "2px 5px",
          whiteSpace: "nowrap",
          border: "1px solid var(--ink-faint)",
          display: "none",
        }}
      />
    </div>
  );
}
