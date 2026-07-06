/** The bay's reticle glyph — ported from NETRA Bay.dc.html lines 62-70 (24×24 viewBox). */
export function NetraReticle() {
  return (
    <span className="reticle" aria-hidden="true">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1" />
        <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1" />
        <line x1="12" y1="3" x2="12" y2="9" stroke="currentColor" strokeWidth="1" />
        <line x1="12" y1="15" x2="12" y2="21" stroke="currentColor" strokeWidth="1" />
        <line x1="3" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1" />
        <line x1="15" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1" />
      </svg>
    </span>
  );
}
