"use client";

/**
 * ChapterIndex.tsx
 * ──────────────────
 * §01 filtered entry list — recent traces.
 *
 * Props contract (lifted state — see AttractorFilterShell.tsx):
 *   entries          — filtered subset of RECENT_ENTRIES (or full list when activeAttractor="all")
 *   activeAttractor  — used as the useEffect dependency to re-trigger stagger animation
 *                      whenever the filter changes. The value itself is not rendered.
 *
 * Border logic note:
 *   The original code computed `lastTwo` and `isRight` off RECENT_ENTRIES (always 4 entries).
 *   After filtering, the set may be 1–4 items, so we recompute off entries.length.
 *   "lastTwo" means: the last row of cards should NOT have a bottom border. With a 2-col
 *   grid: the last two items form the last row. Single-entry filter → last-one is last row.
 *
 * Owner: Sirius (α-SUR-01) · attractor-filter slice
 */

import { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";
import { type Entry } from "@/lib/entries";

interface Props {
  entries: Entry[];
  /** Active attractor pill label — used as animation trigger only. */
  activeAttractor: string;
}

export function ChapterIndex({ entries, activeAttractor }: Props) {
  const gridRef = useRef<HTMLDivElement | null>(null);

  // Re-run stagger animation whenever the filter changes (activeAttractor dep).
  // Also runs on initial mount (empty-dep behavior is preserved by always including
  // activeAttractor in the dep array — first run is "all", subsequent are filtered).
  // Respects prefers-reduced-motion; skips animation if user prefers none.
  //
  // Back-forward + reduced-motion fix (α-SUR-01 · back-content):
  //   Cards are rendered WITHOUT opacity-0 in the SSR className — they are visible by
  //   default. This useEffect applies opacity:0 inline BEFORE animating, so the stagger
  //   still plays on genuine first render and on filter change. If this effect never fires
  //   (React hydration failure on back-forward navigation) or if the user prefers reduced
  //   motion, cards remain at their default-visible state (opacity:1 inherited, no inline
  //   override). Animation is pure progressive enhancement — it cannot leave content hidden.
  useEffect(() => {
    if (!gridRef.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const cards = Array.from(
      gridRef.current.querySelectorAll<HTMLElement>(".entry-card")
    );

    // Reduced-motion: ensure cards are explicitly visible (no animation, no hidden state).
    // Without this guard, a stale inline style from a previous filter animation could
    // leave cards at opacity:0 if the user toggles reduced-motion mid-session.
    if (reduce) {
      cards.forEach((c) => {
        c.style.opacity = "1";
        c.style.transform = "";
      });
      return;
    }

    // Set cards to invisible via inline style immediately — this is the "starting frame"
    // for the stagger. We do NOT rely on the className for the initial hidden state so
    // that if this effect never runs (hydration failure) cards stay visible.
    cards.forEach((c) => {
      c.style.opacity = "0";
      c.style.transform = "translateY(10px)";
    });

    animate(cards, {
      opacity: [0, 1],
      translateY: [10, 0],
      duration: 700,
      delay: stagger(110),
      ease: "outCubic",
    });
  }, [activeAttractor]);

  return (
    <section
      id="index"
      data-section="01"
      className="relative z-[3] px-10 py-9 section-rule"
    >
      <SectionLabel num="01" label="CHAPTER INDEX // RECENT TRACES" />

      <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2">
        {entries.map((e, i) => {
          // Recompute border suppression from filtered length, not total count.
          // "lastRow" = the last two items in a 2-col grid don't need bottom border.
          const lastTwo = i >= entries.length - 2;
          const isRight = i % 2 === 1;
          return (
            <a
              key={e.fileNum}
              // href was #entry-${e.fileNum} (self-link); changed to real route
              // matching dig-panel idiom at WorldlineGlobe.tsx:2461
              // (fix: chapter-index-cards · α-SUR-01 · wiring-wave1)
              href={`/articles/${e.fileNum}`}
              id={`entry-${e.fileNum}`}
              className={`entry-card group relative cursor-pointer px-7 py-6 transition-colors hover:bg-[rgba(212,96,42,0.04)]
                ${isRight ? "" : "md:border-r md:border-[var(--ink-hairline)]"}
                ${lastTwo ? "" : "border-b border-[var(--ink-hairline)]"}`}
            >
              {/* Diamond reticle */}
              <span
                aria-hidden
                className="absolute top-6 right-7 w-1.5 h-1.5 border border-[rgb(var(--accent-orange-rgb)/0.4)] rotate-45"
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
