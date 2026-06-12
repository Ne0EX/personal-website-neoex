"use client";

import { useEffect, useState } from "react";

const SECTION_LABELS: Record<string, string> = {
  "01": "INDEX",
  "02": "ATTRACTOR",
  "03": "FOOTER",
  hero: "GENESIS",
};

/**
 * MarginaliaHUD — fixed right-edge instrument readout. Three vertical bands:
 *   - Top    :: ∇ WORLDLINE / 1.130426
 *   - Middle :: current section as user scrolls
 *   - Bottom :: scroll progress + drift coords
 * The band style + dashed left border evokes the engineering-blueprint motif
 * called out in PROJECT_BRIEF §3 (axis labels, coordinate readouts).
 */
export function MarginaliaHUD() {
  const [section, setSection] = useState<string>("GENESIS");
  const [drift, setDrift] = useState<string>("+00.000");

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const pct = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
      // Drive the top scroll meter via CSS var.
      document.documentElement.style.setProperty(
        "--scroll-pct",
        `${(pct * 100).toFixed(2)}%`
      );

      // Drift coord — scrubs through divergence-like values as you scroll.
      const driftVal = (pct * 2.6 - 1.3).toFixed(3);
      setDrift((driftVal.startsWith("-") ? "" : "+") + driftVal);

      // Detect current section: walk known section IDs and pick the topmost
      // one whose top is above the viewport mid-line.
      // mid was fixed at 40% which could never be crossed by sections 02/03
      // at max scroll. Now scroll-proportional: at pct=0 → 40%, at pct=1 →
      // 85% — FOOTER (~567px) becomes current at full scroll, ATTRACTOR
      // (~423px) wins in the ~90% band. Top-of-page behavior unchanged.
      // (fix: marginalia-section-label · α-SUR-01 · wiring-wave1)
      const sections = Array.from(
        document.querySelectorAll<HTMLElement>("[data-section]")
      );
      const mid = window.innerHeight * (0.4 + 0.45 * pct);
      let current = "hero";
      for (const s of sections) {
        const r = s.getBoundingClientRect();
        if (r.top < mid) current = s.dataset.section || current;
      }
      setSection(SECTION_LABELS[current] ?? current.toUpperCase());
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <aside className="marginalia" aria-hidden>
      <span>
        ∇ WORLDLINE · <span className="ma-accent">1.130426</span>
      </span>

      <span className="ma-accent">§ {section}</span>

      <span>
        DRIFT · {drift}
      </span>
    </aside>
  );
}

/** Top-edge horizontal scroll meter with marching dashes. */
export function ScrollMeter() {
  return <div className="scroll-meter" aria-hidden />;
}
