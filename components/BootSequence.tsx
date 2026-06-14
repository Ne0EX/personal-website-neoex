"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "animejs";

const LINES = [
  "INITIALIZING WORLDLINE …",
  "ATTACHING TRACE :: ATLAS / NETRA",
  "RESOLVING ATTRACTOR FIELD …",
  "PATCHING DIVERGENCE :: 1.130426",
  "BREAKPOINT SET @ α-LOCUS",
  "OBSERVATORY :: ONLINE",
  "WORLDLINE PATCHED · OBSERVING.",
];

/**
 * BootSequence — terminal-style typing → divergence calibration → fade out.
 * Used as <BootSequence onDoneAction={...} /> from a wrapper that gates the page.
 */
export function BootSequence({ onDoneAction }: { onDoneAction?: () => void }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [printed, setPrinted] = useState<string[]>([]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      queueMicrotask(() => setPrinted(LINES));
      const t = setTimeout(() => onDoneAction?.(), 200);
      return () => clearTimeout(t);
    }

    let cancelled = false;
    let i = 0;

    const next = () => {
      if (cancelled) return;
      if (i >= LINES.length) {
        // Fade entire boot panel out, then resolve.
        if (rootRef.current) {
          animate(rootRef.current, {
            opacity: [1, 0],
            duration: 700,
            ease: "outCubic",
            onComplete: () => onDoneAction?.(),
          });
        } else {
          onDoneAction?.();
        }
        return;
      }
      setPrinted((p) => [...p, LINES[i]]);
      i += 1;
      setTimeout(next, 220 + Math.random() * 120);
    };

    const startId = setTimeout(next, 220);
    return () => {
      cancelled = true;
      clearTimeout(startId);
    };
  }, [onDoneAction]);

  // Whenever a new line prints, animate it in.
  useEffect(() => {
    if (!rootRef.current) return;
    const lines = rootRef.current.querySelectorAll<HTMLDivElement>(".boot-line");
    const last = lines[lines.length - 1];
    if (!last) return;
    animate(last, {
      opacity: [0, 1],
      translateX: [-6, 0],
      duration: 320,
      ease: "outCubic",
    });
  }, [printed.length]);

  // Caret blink.
  const caretRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!caretRef.current) return;
    const a = animate(caretRef.current, {
      opacity: [1, 0],
      duration: 600,
      ease: "stepsOut(2)",
      loop: true,
      direction: "alternate",
    });
    return () => { a.pause(); };
  }, []);

  return (
    // boot-footer fix (α-SUR-01, 2026-06-14): paper-canvas sets position:relative
    // which overrides the Tailwind `fixed` class, collapsing the overlay to a
    // relative block at the bottom of the page. Fix: bg-[var(--paper-base)] for
    // the background color on the outer fixed div; paper-canvas texture is moved
    // to an absolute inner child so it doesn't clobber `position:fixed`.
    <div
      ref={rootRef}
      className="fixed inset-0 z-[50] flex items-center justify-center bg-[var(--paper-base)]"
    >
      {/* paper texture layer — absolute so it doesn't disturb the fixed positioning */}
      <div className="paper-canvas absolute inset-0 z-[0]" aria-hidden="true" />
      <div className="corner-marks" />

      <div className="relative z-[3] w-[min(560px,82vw)] px-8 py-7 paper-warm-surface border border-[var(--ink-faint)]">
        <div className="flex items-center justify-between t-meta tracking-[0.2em] pb-2 mb-4 section-rule-dashed">
          <span className="t-meta-accent">∇ WORLDLINE / BOOT</span>
          <span>SEQ — 000</span>
        </div>

        <div className="t-mono text-[12px] leading-[1.9] text-[var(--ink-primary)]">
          {printed.map((line, idx) => (
            <div key={idx} className="boot-line opacity-0">
              <span className="text-[var(--accent-orange)] mr-2">›</span>
              {line}
            </div>
          ))}
          <div className="t-mono text-[12px] leading-[1.9]">
            <span className="text-[var(--accent-orange)] mr-2">›</span>
            <span ref={caretRef} className="inline-block w-2 h-3 align-middle bg-[var(--ink-primary)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
