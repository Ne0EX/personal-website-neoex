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
 *
 * TASK-2026-06-15 (α-SUR-01): Added a faint '/' glyph cue beside the survey
 * button — instrument-label idiom (t-mono, --ink-faint, no hover, no modal).
 * Reads as a keyboard shortcut legend, not an ad. Renders as a non-interactive
 * <span aria-hidden> so it is skipped by screen readers (the button label
 * already announces the affordance semantically).
 */

export function ArchiveSurveyAffordance() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event('triangulate:open'))}
        className="t-mono"
        aria-label="Open survey overlay (or press / to search)"
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

      {/* Instrument-label cue — reads as keyboard legend, not decoration.
          aria-hidden: the button's aria-label already conveys the '/' shortcut
          to screen readers; duplicating it as spoken text is noise.
          No hover state: this is a static instrument readout, not a target. */}
      <span
        aria-hidden="true"
        className="t-mono"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-faint)',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        / TO SEARCH
      </span>
    </span>
  );
}
