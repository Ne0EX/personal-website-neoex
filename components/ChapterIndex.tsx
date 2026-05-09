"use client";

import { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";
import { RECENT_ENTRIES } from "@/lib/entries";

export function ChapterIndex() {
  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!gridRef.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const cards = Array.from(
      gridRef.current.querySelectorAll<HTMLElement>(".entry-card")
    );
    animate(cards, {
      opacity: [0, 1],
      translateY: [10, 0],
      duration: 700,
      delay: stagger(110),
      ease: "outCubic",
    });
  }, []);

  return (
    <section
      id="index"
      data-section="01"
      className="relative z-[3] px-10 py-9 section-rule"
    >
      <SectionLabel num="01" label="CHAPTER INDEX // RECENT TRACES" />

      <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2">
        {RECENT_ENTRIES.map((e, i) => {
          const lastTwo = i >= RECENT_ENTRIES.length - 2;
          const isRight = i % 2 === 1;
          return (
            <a
              key={e.fileNum}
              href={`#entry-${e.fileNum}`}
              id={`entry-${e.fileNum}`}
              className={`entry-card opacity-0 group relative cursor-pointer px-7 py-6 transition-colors hover:bg-[rgba(212,96,42,0.04)]
                ${isRight ? "" : "md:border-r md:border-[var(--ink-hairline)]"}
                ${lastTwo ? "" : "border-b border-[var(--ink-hairline)]"}`}
            >
              {/* Diamond reticle */}
              <span
                aria-hidden
                className="absolute top-6 right-7 w-1.5 h-1.5 border border-[rgba(212,96,42,0.4)] rotate-45"
              />

              <div className="t-meta tracking-[0.2em] mb-3 text-[var(--ink-faint)]">
                FILE — {e.fileNum} {"//"} {e.date}
              </div>

              <div className="t-display italic font-medium text-[22px] leading-[1.2] text-[var(--ink-primary)] mb-2.5 transition-colors">
                <span className="entry-glitch" data-text={e.title}>
                  {e.title}
                </span>
              </div>

              <div className="flex gap-3 mb-2 t-meta tracking-[0.15em]">
                {e.tags.map((t, idx) => (
                  <span key={t} className={idx === 0 ? "text-[var(--accent-orange)]" : ""}>
                    {t}
                  </span>
                ))}
              </div>

              <div className="t-type text-[10px] tracking-[0.05em] text-[var(--ink-faint)]">
                {e.readingTime} min · {e.status}
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

function SectionLabel({ num, label }: { num: string; label: string }) {
  return (
    <div className="flex items-center gap-4 mb-7 t-meta tracking-[0.3em]">
      <span className="block w-6 h-px bg-[var(--accent-orange)]" />
      <span className="text-[var(--accent-orange)] font-medium">§ {num}</span>
      <span>{label}</span>
    </div>
  );
}
