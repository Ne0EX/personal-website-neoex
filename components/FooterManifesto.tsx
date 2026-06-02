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
        <ul className="leading-[2] text-[var(--ink-primary)]">
          {[
            { label: "anilist", href: "#" },
            { label: "letterboxd", href: "#" },
            { label: "github", href: "#" },
            { label: "airtable.coffee", href: "#" },
          ].map((x) => (
            <li key={x.label}>
              <a
                href={x.href}
                className="hover:text-[var(--accent-orange)] transition-colors"
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
        <ul className="leading-[2] text-[var(--ink-primary)]">
          {[
            { label: "peat@—", href: "mailto:" },
            { label: "rss / atom", href: "#" },
            { label: "now page", href: "#" },
            { label: "colophon", href: "#" },
          ].map((x) => (
            <li key={x.label}>
              <a
                href={x.href}
                className="hover:text-[var(--accent-orange)] transition-colors"
              >
                <span className="text-[var(--accent-orange)]">→ </span>
                {x.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
