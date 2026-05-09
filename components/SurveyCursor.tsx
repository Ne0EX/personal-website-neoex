"use client";

import { useEffect, useRef, useState } from "react";

/**
 * SurveyCursor — custom cartographer-crosshair cursor with a live coordinate
 * readout. Hides the native cursor on fine-pointer devices, falls back to
 * native on touch. Switches to a filled triangulation mark when over
 * interactive elements.
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
      if (labelRef.current) {
        const lon = ((mx / window.innerWidth) * 360 - 180).toFixed(2);
        const lat = (90 - (my / window.innerHeight) * 180).toFixed(2);
        labelRef.current.textContent = `${lon}° / ${lat}°`;
      }
    };

    const onLeave = () => {
      if (rootRef.current) rootRef.current.style.opacity = "0";
      visible = false;
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

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
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
        }}
      >
        0.00° / 0.00°
      </span>
    </div>
  );
}
