import { CONTACT, HERO, LIFECYCLE_META } from "@/lib/resume-data";
import { requireNode } from "./requireNode";

/**
 * LedgerHero — the observer's dossier header. Ported from
 * `Worldline Résumé - NETRA Survey.dc.html`'s `<header data-survey="observer">`.
 *
 * Two `data-survey` regions live here: the header itself ("observer") and
 * the channels block ("channels"). CONTACT is email-only by construction
 * (lib/resume-data.ts has no phone field) — there is nothing to strip
 * here, the phone line the prototype had simply has no data to render.
 */
export function LedgerHero() {
  const observer = requireNode("observer");
  const channels = requireNode("channels");
  const lifecycle = LIFECYCLE_META[HERO.lifecycle];

  return (
    <header
      data-survey={observer.id}
      data-survey-label={observer.label}
      className="relative z-[3] px-6 sm:px-11 pt-9 sm:pt-10 pb-8"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 mb-5">
        <div className="dossier-head">
          <span className="file">FILE — RÉSUMÉ / OBSERVER α</span>
          <span className="coords">
            {HERO.coords.lat.toFixed(4)}°N · {HERO.coords.lon.toFixed(4)}°E
          </span>
          <span>SURVEYED — {HERO.surveyedOn}</span>
        </div>
        <span className={`lifecycle lifecycle--${HERO.lifecycle} ml-auto`}>
          <span className="glyph">{lifecycle.glyph}</span> {lifecycle.label}
        </span>
      </div>

      <div className="flex items-start gap-3.5">
        <span className="t-meta text-[var(--accent-orange)] tracking-normal mt-3.5 sm:mt-4" aria-hidden>
          α
        </span>
        <h1 className="wl-h1 ledger-name">
          {HERO.firstName} <span className="text-[var(--accent-orange)]">&ldquo;{HERO.nickname}&rdquo;</span>{" "}
          {HERO.lastName}
        </h1>
      </div>

      {/* Algol S14 3a: this title line is a <div>, not a heading, on purpose —
          it's a byline under the h1, not a section head. The real h1→h3
          skip lived in SectionLabel (fixed there: div → h2). */}
      <div className="t-meta mt-4 tracking-[0.24em] text-[var(--ink-primary)]">{HERO.title}</div>

      <div className="ledger-hero-stack">
        <p className="wl-lede max-w-[62ch]">{HERO.lede}</p>

        <div
          data-survey={channels.id}
          data-survey-label={channels.label}
          className="flex flex-col gap-1.5 text-right t-meta"
        >
          {/* Algol S14 3b: these stacked links measured 372×14px (coarse
              viewport) — under the 24px touch-target floor. `channel-link`
              is a coarse-pointer-only hit-area hook (survey-ledger.css §3),
              same `::before` inset technique as `.af-pill`/`.netra-bay-jump`;
              no visual change, painted box stays pixel-identical. */}
          {CONTACT.links.map((link) => (
            <a
              key={link.id}
              href={link.href}
              target="_blank"
              rel="noopener"
              className="channel-link text-[var(--ink-primary)] tracking-[0.16em] hover:text-[var(--accent-orange)] transition-colors"
            >
              {link.label} <span className="text-[var(--accent-orange)]">→</span>
            </a>
          ))}
          <a
            href={CONTACT.emailHref}
            className="channel-link text-[var(--ink-primary)] tracking-[0.16em] hover:text-[var(--accent-orange)] transition-colors"
          >
            {CONTACT.email} <span className="text-[var(--accent-orange)]">→</span>
          </a>
        </div>
      </div>
    </header>
  );
}
