import { CONTACT } from "@/lib/resume-data";
import { BangkokClock } from "./BangkokClock";

/**
 * LedgerTopBar — the résumé ledger's single-row instrument strip.
 *
 * Distinct from components/Nav.tsx (main-site chrome — id strip / nav
 * links / clock in a 3-col grid). This surface doesn't carry Worldline
 * page navigation, so the design collapses it to one dashed-rule row:
 * mark → clock → external site link → contact. Modelled after Nav.tsx's
 * t-meta + hover-to-orange link pattern, flattened to match
 * `Worldline Résumé - NETRA Survey.dc.html`'s top-bar markup.
 *
 * "◇ SITE" points at the external neoex.dev (the main Worldline garden,
 * a different domain from this résumé) — verbatim from the design, not
 * a relative link to /atlas.
 */
export function LedgerTopBar() {
  return (
    <div className="ledger-topbar relative z-[3] flex flex-wrap items-baseline gap-x-7 gap-y-2 px-6 sm:px-11 py-4 section-rule-dashed t-meta">
      <span className="text-[var(--ink-soft)]">
        <span className="text-[var(--accent-orange)]">∇</span> WORLDLINE {"//"} NEOSPIRIT
      </span>

      <span className="ml-auto text-[var(--ink-faint)] tracking-[0.2em]">
        <BangkokClock />
      </span>

      <a
        href="https://neoex.dev"
        target="_blank"
        rel="noopener"
        className="text-[var(--ink-soft)] hover:text-[var(--accent-orange)] transition-colors"
      >
        ◇ SITE
      </a>

      <a
        href={CONTACT.emailHref}
        aria-label="Email Peat"
        className="text-[var(--ink-soft)] hover:text-[var(--accent-orange)] transition-colors"
      >
        ⟶ CONTACT
      </a>
    </div>
  );
}
