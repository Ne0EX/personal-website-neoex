"use client";

/**
 * AttractorFields.tsx
 * ─────────────────────
 * §02 pill strip — browse-by-domain attractor filter.
 *
 * Props contract (lifted state — see AttractorFilterShell.tsx):
 *   activeAttractor  — currently selected pill (or "all")
 *   onSelect         — callback; shell handles toggle (click active → "all")
 *   memberCounts     — map of pill label → count of matching RECENT_ENTRIES
 *
 * Empty-pill treatment (soul-consistent):
 *   Pills with memberCounts[tag] === 0 are rendered dimmed (opacity-40)
 *   and non-interactive, signalling there is no corpus yet for that field.
 *   They do NOT trigger a selection or change visual state on hover.
 *   As Peat writes + tags more entries, pills populate automatically.
 *
 * "all" always has count === entries.length and is never empty.
 *
 * Owner: Sirius (α-SUR-01) · attractor-filter slice
 */

import { ATTRACTOR_FIELDS } from "@/lib/entries";

interface Props {
  activeAttractor: string;
  onSelect: (tag: string) => void;
  memberCounts: Record<string, number>;
}

export function AttractorFields({ activeAttractor, onSelect, memberCounts }: Props) {
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
          const isActive = tag === activeAttractor;
          const isEmpty = (memberCounts[tag] ?? 0) === 0;

          if (isEmpty) {
            // Dim + disable: no pointer, no focus, purely decorative.
            // Rendered as <span> (not <button>) so it is correctly excluded
            // from keyboard tab order and screen-reader button role.
            return (
              <span
                key={tag}
                aria-disabled="true"
                title={`${tag} — no entries yet`}
                className="px-3 py-1.5 font-mono uppercase tracking-[0.15em] text-[10px] border
                  border-[var(--ink-faint)] opacity-40 cursor-not-allowed select-none"
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "var(--ink-faint)",
                }}
              >
                {tag}
              </span>
            );
          }

          return (
            /*
             * CW-16 · attractor pill touch target (ux-journey, α-SUR-01, 2026-06-14)
             * Active pills (ALL, coffee, meta) were 29px tall on mobile — below 44px min.
             * minHeight:44px + display:flex + alignItems:center → ≥44px tap zone.
             * py-1.5 padding kept for visual rhythm; overridden by minHeight on mobile.
             */
            <button
              key={tag}
              type="button"
              onClick={() => onSelect(tag)}
              aria-pressed={isActive}
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
                minHeight: "44px",
                display: "flex",
                alignItems: "center",
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
