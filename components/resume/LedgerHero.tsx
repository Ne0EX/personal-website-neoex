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

      <div className="t-meta mt-4 tracking-[0.24em] text-[var(--ink-primary)]">{HERO.title}</div>

      <div className="ledger-hero-stack">
        <p className="wl-lede max-w-[62ch]">{HERO.lede}</p>

        <div
          data-survey={channels.id}
          data-survey-label={channels.label}
          className="flex flex-col gap-1.5 text-right t-meta"
        >
          {CONTACT.links.map((link) => (
            <a
              key={link.id}
              href={link.href}
              target="_blank"
              rel="noopener"
              className="text-[var(--ink-primary)] tracking-[0.16em] hover:text-[var(--accent-orange)] transition-colors"
            >
              {link.label} <span className="text-[var(--accent-orange)]">→</span>
            </a>
          ))}
          <a
            href={CONTACT.emailHref}
            className="text-[var(--ink-primary)] tracking-[0.16em] hover:text-[var(--accent-orange)] transition-colors"
          >
            {CONTACT.email} <span className="text-[var(--accent-orange)]">→</span>
          </a>
        </div>
      </div>
    </header>
  );
}
