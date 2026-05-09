"use client";

import { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";
import { DivergenceMeter } from "./DivergenceMeter";
import { WorldlineGlobe } from "./WorldlineGlobe";

/**
 * HeroBlock — compact title strip above a full-width A.T.L.A.S. artifact.
 *
 *   Top strip (single horizontal row):
 *     [ tagrow + italic title ]   [ stack ]   [ compact divergence ]
 *   Below:
 *     [ A.T.L.A.S. — full width ]
 *
 * The title is the "hook word" that enhances the aesthetic without competing
 * with the globe for space. ATLAS is the dominant artifact.
 */
export function HeroBlock() {
  const tagRowRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const subRef = useRef<HTMLParagraphElement | null>(null);
  const stackRef = useRef<HTMLDivElement | null>(null);
  const atlasRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    if (tagRowRef.current) {
      animate(tagRowRef.current, {
        opacity: [0, 1], translateY: [-4, 0], duration: 700, ease: "outCubic",
      });
    }
    if (titleRef.current) {
      animate(titleRef.current, {
        opacity: [0, 1], translateY: [10, 0], filter: ["blur(6px)", "blur(0px)"],
        duration: 900, delay: 200, ease: "outCubic",
      });
    }
    if (subRef.current) {
      animate(subRef.current, {
        opacity: [0, 1], translateY: [4, 0], duration: 800, delay: 600, ease: "outCubic",
      });
    }
    if (stackRef.current) {
      const items = Array.from(
        stackRef.current.querySelectorAll<HTMLSpanElement>(".hero-stack-item")
      );
      animate(items, {
        opacity: [0, 1], duration: 600, delay: stagger(80, { start: 800 }), ease: "outCubic",
      });
    }
    if (atlasRef.current) {
      animate(atlasRef.current, {
        opacity: [0, 1], duration: 1000, delay: 400, ease: "outCubic",
      });
    }
  }, []);

  return (
    <section
      id="hero"
      data-section="hero"
      className="relative z-[3] px-10 pt-10 pb-12 section-rule overflow-hidden"
    >
      {/* ============= TOP STRIP — compact, single horizontal band ============= */}
      <div className="grid items-end gap-x-10 gap-y-5 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto_auto] mb-7">
        {/* LEFT — tagrow + italic title (single line) */}
        <div className="min-w-0">
          <div ref={tagRowRef} className="flex items-center gap-3 t-meta mb-3" style={{ opacity: 0 }}>
            <span className="inline-block w-6 h-px bg-[var(--accent-orange)]" />
            <span>FILE — 000 / GENESIS</span>
            <span className="text-[var(--ink-faint)]">·</span>
            <b className="t-meta-accent">WORLDLINE 1.130426</b>
          </div>

          <h1
            ref={titleRef}
            className="t-display text-[34px] leading-[1.05] tracking-[-0.005em] text-[var(--ink-primary)]"
            style={{ opacity: 0 }}
          >
            an archive of <em className="text-[var(--accent-orange)] not-italic" style={{ fontStyle: "italic" }}>unfinished</em> thought, surveyed openly.
          </h1>

          <p
            ref={subRef}
            className="t-display mt-2.5 max-w-[560px] text-[12.5px] leading-[1.55] text-[var(--ink-soft)]"
            style={{ opacity: 0, fontStyle: "italic" }}
          >
            A digital garden — drafts, half-formed theories, contour maps of coffee, code, narrative,
            and the slow architecture of taste. Not a blog. A laboratory.
          </p>
        </div>

        {/* MIDDLE — counts stack (compact) */}
        <div
          ref={stackRef}
          className="hidden lg:flex items-end gap-7 t-meta tracking-[0.18em]"
        >
          <div className="flex flex-col gap-1">
            <span className="hero-stack-item opacity-0 text-[var(--accent-orange)] text-[14px] font-medium" style={{ fontFamily: "var(--font-type)" }}>047</span>
            <span className="hero-stack-item opacity-0 text-[8.5px]">ENTRIES</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="hero-stack-item opacity-0 text-[var(--ink-primary)] text-[14px] font-medium" style={{ fontFamily: "var(--font-type)" }}>012</span>
            <span className="hero-stack-item opacity-0 text-[8.5px]">ACTIVE</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="hero-stack-item opacity-0 text-[var(--ink-primary)] text-[14px] font-medium" style={{ fontFamily: "var(--font-type)" }}>∞</span>
            <span className="hero-stack-item opacity-0 text-[8.5px]">BRANCHES</span>
          </div>
        </div>

        {/* RIGHT — compact divergence (just label + value, single row) */}
        <div className="hidden lg:flex flex-col items-end gap-2 t-meta">
          <div className="text-[8px] tracking-[0.32em] text-[var(--ink-faint)]">DIVERGENCE</div>
          <DivergenceMeter size="sm" compact />
        </div>
      </div>

      {/* ============= ATLAS — full-width artifact ============= */}
      <div ref={atlasRef} style={{ opacity: 0 }}>
        <WorldlineGlobe />
      </div>
    </section>
  );
}
