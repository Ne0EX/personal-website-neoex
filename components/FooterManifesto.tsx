/*
 * FooterManifesto.tsx — CHANNELS + TRANSMIT columns
 *
 * CW-03 · GitHub href wired to https://github.com/Ne0EX (ux-journey, α-SUR-01, 2026-06-14)
 *         Previously href="#", dead on click. Opens in new tab.
 * CW-06 · resume.neoex.com placeholder added to TRANSMIT (ux-journey, α-SUR-01, 2026-06-14)
 *         Dimmed at var(--ink-faint), pointer-events:none until domain is live.
 *         Treatment mirrors disabled attractor pills (same faint register, no interaction).
 * CW-07 · Anilist, Letterboxd, airtable.coffee URLs wired (ux-journey, α-SUR-01, 2026-06-14).
 *         All confirmed public links supplied by Peat.
 * CW-08 · Footer link touch targets: mobile-only paddingBlock 18px → ~44px tap zone.
 *         All footer links were 12px tall, functionally un-tappable on mobile.
 *         Achieved via .footer-channel-link CSS class gated at @media (max-width: 768px)
 *         so desktop retains original tight spacing. Inline paddingBlock removed.
 */
export function FooterManifesto() {
  return (
    <footer
      id="transmit"
      data-section="03"
      className="relative z-[3] grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-8 px-10 py-12 t-meta tracking-[0.1em]"
    >
      <div>
        <h4 className="t-meta tracking-[0.3em] mb-3">{"//"} MANIFESTO</h4>
        {/* Legibility-register pass (α-VIS-04 / α-SUR-01, 2026-06-01):
            Elevated from <p> + --ink-soft (squint-tier) to <blockquote> +
            .manifesto-block CSS class (read-intentional tier, --ink-body).
            Opening and closing guillemet glyphs now matched — closing was
            previously absent. Structure mirrors Pullquote semantic contract
            (blockquote → p → cite) but uses .manifesto-* footer-context classes,
            not the Pullquote component (which is inline-MDX article scoped).
            See docs/design/70-legibility-registers-PRD-PASS.md §fix-1. */}
        <blockquote className="manifesto-block">
          <p className="manifesto-body">
            <span className="manifesto-glyph" aria-hidden="true">&ldquo;</span>
            Observed openly. This is not a destination — only the slow
            accumulation of a worldline. Patches commit in public; the log stays open.
            <span className="manifesto-glyph close" aria-hidden="true">&rdquo;</span>
          </p>
          {/* vega · α-VOX-08 · 2026-06-02: cite removed. The manifesto speaks
              as the place, not as a person — no authorial "I", no byline. A
              cite here retrofits a signature onto an unsigned axiom and breaks
              the ambient register. The archive names itself by existing. */}
        </blockquote>
      </div>

      <div>
        <h4 className="t-meta tracking-[0.3em] mb-3">{"//"} CHANNELS</h4>
        {/*
         * CW-08 — touch target: links were 12px tall. display:block + paddingBlock
         * brings tap zone to ~44px on mobile. leading-[2] kept on the <ul> for
         * desktop visual rhythm but overridden per-link for mobile tap safety.
         */}
        {/*
         * boot-footer fix (α-SUR-01, 2026-06-14): removed style={{ lineHeight: 1 }}
         * which was overriding the leading-[2] Tailwind class and cramping desktop
         * spacing. The mobile 44px tap zone is handled by .footer-channel-link
         * @media rule in globals.css — no inline style needed here.
         */}
        <ul className="leading-[2] text-[var(--ink-primary)]">
          {[
            /* CW-07: All three URLs wired to confirmed public profiles. */
            { label: "anilist",         href: "https://anilist.co/user/NeospiritTH/",                                       live: true },
            { label: "letterboxd",      href: "https://letterboxd.com/NeospiritTH/",                                        live: true },
            /* CW-03: GitHub wired to confirmed public profile (was href="#"). */
            { label: "github",          href: "https://github.com/Ne0EX",                                                    live: true },
            /* CW-07: Peat's public read-only Airtable coffee share link. */
            { label: "airtable.coffee", href: "https://airtable.com/appiP6I9snDwhlQNv/shrTsqXbjxHyViD3z",                  live: true },
          ].map((x) => (
            <li key={x.label}>
              <a
                href={x.href}
                target="_blank"
                rel="noopener noreferrer"
                className="footer-channel-link hover:text-[var(--accent-orange)] transition-colors"
              >
                <span className="text-[var(--accent-orange)]">→ </span>
                {x.label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="t-meta tracking-[0.3em] mb-3">{"//"} TRANSMIT</h4>
        {/* boot-footer fix: same inline override removed here for TRANSMIT column */}
        <ul className="leading-[2] text-[var(--ink-primary)]">
          {[
            /* address authorized by Peat; visible label stays obfuscated
               (fix: footer-mailto · α-SUR-01 · wiring-wave1) */
            { label: "peat@—", href: "mailto:neospiritth@gmail.com", disabled: false },
            { label: "rss / atom",  href: "#", disabled: false },
            { label: "now page",    href: "#", disabled: false },
            { label: "colophon",    href: "#", disabled: false },
          ].map((x) => (
            <li key={x.label}>
              <a
                href={x.href}
                className="footer-channel-link hover:text-[var(--accent-orange)] transition-colors"
              >
                <span className="text-[var(--accent-orange)]">→ </span>
                {x.label}
              </a>
            </li>
          ))}
          {/*
           * CW-06 · resume.neoex.com placeholder.
           * Dimmed at var(--ink-faint), pointer-events:none, no href until live.
           * Visual treatment = disabled attractor pill register (same faint opacity).
           * When the domain goes live: remove pointerEvents+opacity override, add href.
           * footer-channel-link class provides mobile tap zone on @media ≤768px.
           */}
          <li>
            <span
              aria-hidden="true"
              className="footer-channel-link"
              style={{
                color: "var(--ink-faint)",
                pointerEvents: "none",
                userSelect: "none",
              }}
            >
              <span style={{ color: "var(--ink-faint)" }}>→ </span>
              resume.neoex.com
            </span>
          </li>
        </ul>
      </div>
    </footer>
  );
}
