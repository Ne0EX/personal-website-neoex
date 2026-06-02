'use client';

/**
 * components/ArchiveSurveyAffordance.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * The optional [ ⌕ survey ] button in the archive header strip.
 * Dispatches 'triangulate:open' — the same event the '/' hotkey fires.
 * This is a secondary affordance; it does NOT replace the filter rail or the
 * hotkey.
 *
 * Extracted from app/archive/page.tsx as a separate 'use client' file so that
 * page.tsx can remain a Server Component (CRITICAL RSC boundary — §3).
 *
 * Design spec: docs/design/21-archive-route.md §4
 * Tokens (§6): ink-soft default → accent-orange hover · 150ms ease
 * Owner: Sirius (α-SUR-01)
 */

export function ArchiveSurveyAffordance() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('triangulate:open'))}
      className="t-mono"
      aria-label="Open survey overlay"
      style={{
        appearance: 'none',
        background: 'none',
        border: 'none',
        fontFamily: 'var(--font-mono)',
        fontSize: '9px',
        letterSpacing: '0.3em',
        textTransform: 'uppercase',
        color: 'var(--ink-soft)',
        cursor: 'pointer',
        padding: 0,
        transition: 'color 150ms ease',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--accent-orange)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--ink-soft)';
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = '2px dashed var(--accent-orange)';
        e.currentTarget.style.outlineOffset = '2px';
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = 'none';
      }}
    >
      [ ⌕ survey ]
    </button>
  );
}
