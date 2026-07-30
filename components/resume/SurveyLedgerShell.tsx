"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { STRATA_READOUT, type StratumId } from "@/lib/netra/archive";
import { NetraBay } from "@/components/netra/NetraBay";
import { isTypingTarget } from "@/components/netra/netra-bay-local";
import { StrataConsole } from "./StrataConsole";

/**
 * SurveyLedgerShell — the one client boundary that owns the live strata
 * value for the résumé page. Ported behavior from `Worldline Résumé -
 * NETRA Survey.dc.html`'s strata console script (narrows via a `data-
 * stratum` attribute + a 0–4 keymap) plus the print-open/restore pass
 * `NETRA Bay.dc.html` never needed (that prototype had no `<details>`).
 *
 * Composition (see app/page.tsx): this component is the *sole* owner of
 * `StratumContext`, and it renders all three consumers itself — the pill
 * console, the dimmed section wrapper, and the NETRA bay dock — so all
 * three sit inside ONE `<StratumContext.Provider>` regardless of where
 * `app/page.tsx` visually wants them. Concretely:
 *
 *   - `StrataConsole` renders first, right where "after LedgerHero" lands
 *     visually, since `app/page.tsx` places `<SurveyLedgerShell>` there.
 *   - `<div data-stratum-root data-stratum={stratum}>{children}</div>`
 *     wraps ONLY the server sections passed in as `children` — this is
 *     the exact node survey-ledger.css §8 targets
 *     (`[data-stratum-root][data-stratum="llm"] [data-entry]:not(...)`).
 *     `children` is the server-rendered section tree handed down from
 *     `app/page.tsx`; it is never re-created by this component, so a
 *     stratum change re-renders only this wrapper's attribute, not the
 *     sections themselves.
 *   - `NetraBay` is rendered directly by this component (not via context)
 *     — the *minimal* correct wiring: this component already holds
 *     `stratum` in local state before it ever reaches context, so it
 *     just computes `STRATA_READOUT[stratum]` and passes `range`/`ret` as
 *     plain props. NetraBay itself stays untouched and doesn't need to
 *     read StratumContext.
 *
 * One documented deviation from the plan's landmark note ("aside outside
 * main"): because NetraBay needs the *same* provider instance as
 * StrataConsole (React context does not cross sibling subtrees), and this
 * whole shell is mounted inside `<main>` in app/page.tsx, the `<aside>`
 * below ends up DOM-nested inside `<main>` rather than a true sibling.
 * NetraBay is `position: fixed` (netra-bay.css) so this has no visual
 * effect, and a landmark `<aside>` nested in `<main>` is valid HTML/ARIA
 * (non-ideal, not a WCAG failure) — flagged for Betelgeuse/Polaris rather
 * than silently accepted.
 */

interface StratumContextValue {
  stratum: StratumId;
  setStratum: (next: StratumId) => void;
}

const StratumContext = createContext<StratumContextValue | null>(null);

/** Consumed by StrataConsole (and available to any future strata-aware component). Throws outside SurveyLedgerShell — a missing provider is a composition bug, not a degrade-gracefully case. */
export function useStratum(): StratumContextValue {
  const ctx = useContext(StratumContext);
  if (!ctx) throw new Error("useStratum() called outside <SurveyLedgerShell>");
  return ctx;
}

const KEY_TO_STRATUM: Record<string, StratumId> = { "0": "all", "1": "llm", "2": "ml", "3": "data", "4": "vision" };

export function SurveyLedgerShell({ children }: { children: ReactNode }) {
  const [stratum, setStratum] = useState<StratumId>("all");

  // Keys 0–4 narrow the strata console from anywhere on the page — guarded
  // exactly like NetraBay's own "/" focus shortcut (meta/ctrl/alt, IME
  // composition, and any typing target via the shared `isTypingTarget`).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return;
      if (isTypingTarget(e.target)) return;
      const next = KEY_TO_STRATUM[e.key];
      if (!next) return;
      e.preventDefault();
      setStratum(next);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Print: force every folded "SURVEY FULL TRACE" <details> open so the
  // extra bullets are on the page, then restore whichever ones were
  // actually closed before print (never force-open a detail the visitor
  // had already opened themselves — restoring blindly to `false` would
  // fold it back up under them after the print dialog closes).
  useEffect(() => {
    let reopened: HTMLDetailsElement[] = [];
    function onBeforePrint() {
      reopened = Array.from(document.querySelectorAll<HTMLDetailsElement>("details.wl-more:not([open])"));
      for (const details of reopened) details.open = true;
    }
    function onAfterPrint() {
      for (const details of reopened) details.open = false;
      reopened = [];
    }
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, []);

  const value = useMemo<StratumContextValue>(() => ({ stratum, setStratum }), [stratum]);
  const readout = STRATA_READOUT[stratum];

  return (
    <StratumContext.Provider value={value}>
      <StrataConsole />
      <div data-stratum-root data-stratum={stratum}>
        {children}
      </div>
      <aside aria-label="NETRA — survey console">
        <NetraBay range={readout.range} ret={readout.ret} />
      </aside>
    </StratumContext.Provider>
  );
}
