export function FooterManifesto() {
  return (
    <footer
      id="transmit"
      data-section="03"
      className="relative z-[3] grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-8 px-10 py-12 t-meta tracking-[0.1em]"
    >
      <div>
        <h4 className="t-meta tracking-[0.3em] mb-3">{"//"} MANIFESTO</h4>
        <p className="t-display italic text-[14px] leading-[1.6] text-[var(--ink-soft)]">
          <span className="text-[var(--accent-orange)] text-[32px] align-[-8px] mr-1">&ldquo;</span>
          Observed openly. This is not a destination — only the slow
          accumulation of a worldline. Patches commit in public; the log stays open.
        </p>
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
