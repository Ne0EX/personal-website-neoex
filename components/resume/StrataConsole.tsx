"use client";

import { DOMAIN_GLYPH, DOMAIN_LABEL, DOMAIN_ORDER, DOMAIN_SHORT } from "@/lib/resume-data";
import { strataCounts, type StratumId } from "@/lib/netra/archive";
import { useStratum } from "./SurveyLedgerShell";

/** Digit each pill answers to — mirrors SurveyLedgerShell's keydown map. */
const KEY_SHORTCUT: Record<StratumId, string> = { all: "0", llm: "1", ml: "2", data: "3", vision: "4" };

/**
 * StrataConsole — the pill row that narrows (never hides) the résumé by
 * domain. Built on `.af-pill` (app/globals.css — ported verbatim from
 * soul-atlas's worldline-atoms.css); `.is-active` marks the current
 * selection the same way `NetraBay.tsx`'s `netra-bay-jump` buttons mark
 * `aria-expanded` state — a plain `<button>` row, no external state lib.
 *
 * `data-strata-console` is load-bearing: `survey-ledger.css`'s print block
 * hides this console on paper (`[data-strata-console] { display: none }`)
 * — narrowing an on-screen view has no meaning on a printed page.
 *
 * The live region's text is derived straight from `stratum` (no effect):
 * every stratum change re-renders this component with new text, and an
 * `aria-live="polite"` region announces a text-content change on its own —
 * "announcing narrowing once per change" falls out of that for free.
 */
export function StrataConsole() {
  const { stratum, setStratum } = useStratum();
  const counts = strataCounts();

  const announceText =
    stratum === "all"
      ? `showing all strata — ${counts.all} traces, nothing narrowed`
      : `narrowed to ${DOMAIN_LABEL[stratum].toLowerCase()} — ${counts[stratum]} traces highlighted, the rest only dims`;

  return (
    <nav
      aria-label="Strata console"
      data-strata-console
      className="relative z-[3] px-6 sm:px-11 pb-6 flex flex-col gap-2.5"
    >
      <div className="flex flex-wrap gap-2" role="group" aria-label="Narrow the résumé by domain">
        <button
          type="button"
          className={`af-pill${stratum === "all" ? " is-active" : ""}`}
          aria-pressed={stratum === "all"}
          aria-keyshortcuts={KEY_SHORTCUT.all}
          /* Algol S14 3c (WCAG 2.5.3 label-in-name): the old label ("All
             strata — 05 traces") didn't contain the visible text as a
             contiguous string — "strata" split "All" from "— 05". Lead
             with the exact visible text, then append the description. */
          aria-label={`ALL — ${String(counts.all).padStart(2, "0")}, show all strata`}
          onClick={() => setStratum("all")}
        >
          ◎ ALL — {String(counts.all).padStart(2, "0")}
        </button>
        {DOMAIN_ORDER.map((domain) => (
          <button
            key={domain}
            type="button"
            className={`af-pill${stratum === domain ? " is-active" : ""}`}
            aria-pressed={stratum === domain}
            aria-keyshortcuts={KEY_SHORTCUT[domain]}
            aria-label={`${DOMAIN_SHORT[domain]} — ${String(counts[domain]).padStart(2, "0")}, narrow to ${DOMAIN_LABEL[domain]}`}
            onClick={() => setStratum(domain)}
          >
            {DOMAIN_GLYPH[domain]} {DOMAIN_SHORT[domain]} — {String(counts[domain]).padStart(2, "0")}
          </button>
        ))}
      </div>

      <p className="t-meta text-[8px] tracking-[0.22em] text-[var(--ink-faint)]">
        STRATA NARROW — NOTHING HIDES · KEYS 0–4
      </p>
      <p className="t-meta text-[8px] tracking-[0.22em] text-[var(--ink-faint)]">
        ◎ NETRA HOLDS THE BAY BELOW — ⟶ POINT AT ANY SURFACE, OR TRANSMIT A QUERY ( / )
      </p>

      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announceText}
      </span>
    </nav>
  );
}
