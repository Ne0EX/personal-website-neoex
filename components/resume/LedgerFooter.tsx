/**
 * LedgerFooter — the closing instrument strip. Ported from
 * `Worldline Résumé - NETRA Survey.dc.html` lines 323-328.
 *
 * A semantic `<footer>` (the design used a bare `<div>`) — the plan's
 * "Motion & a11y" landmark requirement (header/main/aside/footer) applies
 * to this page's composition, and this is the one landmark the ported
 * markup was missing. Rendered in print (unlike `.ledger-topbar`) — this
 * attribution strip is useful on a printed page, same as the retired
 * `/resume` route's bottom instrument stamp.
 *
 * The three strings here are ported verbatim from the design bundle, same
 * as LedgerTopBar.tsx's "∇ WORLDLINE // NEOSPIRIT" — structural instrument
 * chrome, not visitor-facing copy, so it's hardcoded here rather than
 * routed through lib/resume-data.ts (consistent with every sibling
 * component that already made this call).
 *
 * Does NOT render the design's "clearance for the NETRA bay" spacer div —
 * NetraBay isn't mounted on this page in this slice (that's S7's
 * SurveyLedgerShell). S7 owns adding that spacer alongside `<NetraBay>`.
 */
export function LedgerFooter() {
  return (
    <footer className="ledger-footer t-meta relative z-[3] flex flex-wrap items-baseline justify-between gap-4 border-t border-[var(--ink-hairline)] px-6 sm:px-11 py-4">
      <span className="t-meta-accent">∇ WORLDLINE · NEOEX.DEV</span>
      <span className="t-type text-[10px] tracking-[0.04em] normal-case text-[var(--ink-soft)]">resume.neoex.dev</span>
      <span className="text-[var(--ink-soft)]">OBSERVATORY :: ONLINE</span>
    </footer>
  );
}
