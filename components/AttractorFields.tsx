"use client";

import { useState } from "react";
import { ATTRACTOR_FIELDS } from "@/lib/entries";

export function AttractorFields() {
  const [active, setActive] = useState<string>("all");

  return (
    <section
      id="attractor"
      data-section="02"
      className="relative z-[3] px-10 py-9 section-rule"
    >
      <div className="flex items-center gap-4 mb-7 t-meta tracking-[0.3em]">
        <span className="block w-6 h-px bg-[var(--accent-orange)]" />
        <span className="text-[var(--accent-orange)] font-medium">§ 02</span>
        <span>ATTRACTOR FIELDS // BROWSE BY DOMAIN</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {ATTRACTOR_FIELDS.map((tag) => {
          const isActive = tag === active;
          return (
            <button
              key={tag}
              type="button"
              onClick={() => setActive(tag)}
              className={`px-3 py-1.5 font-mono uppercase tracking-[0.15em] text-[10px] border transition-colors
                ${
                  isActive
                    ? "bg-[var(--ink-primary)] border-[var(--ink-primary)]"
                    : "border-[var(--ink-faint)] hover:border-[var(--accent-orange)]"
                }`}
              style={{
                fontFamily: "var(--font-mono)",
                color: isActive ? "var(--paper-base)" : "var(--ink-primary)",
                fontWeight: isActive ? 500 : 400,
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.color = "var(--accent-orange)";
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.color = "var(--ink-primary)";
              }}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </section>
  );
}
