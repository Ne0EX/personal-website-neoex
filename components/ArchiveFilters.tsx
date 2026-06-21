'use client';

/**
 * components/ArchiveFilters.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Filter chip strip for the /archive right rail.
 *
 * BUG-1 FIX (Sirius 2026-06-04): filter state is now driven by props, not by
 * useRouter/useSearchParams. The parent (ArchiveClient) owns activeType as
 * useState and syncs the URL via window.history.replaceState (shallow, no
 * navigation, no route re-render). This keeps the ArchiveMiniGlobe subtree
 * mounted across filter changes — only its activePins prop updates.
 * NOTE: replaceState does NOT create history entries, so browser back/forward
 * no longer restores a previously-selected type filter (prior behaviour via
 * router.push). Deep-links (/archive?type=photo) still work on initial load
 * because ArchiveClient reads useSearchParams ONCE at mount to seed useState.
 *
 * Design spec: docs/design/21-archive-route.md §4, §6, §8
 * Composed from atoms: `attractor-pill` (.af-pill pattern — FilmSimSwitcher
 * established the button register; type-roles for label typography).
 * Reference component modelled after: FilmSimSwitcher.tsx (pill anatomy).
 *
 * Token compliance (§6):
 *   pill active border + text   var(--accent-orange)
 *   pill active background      var(--accent-orange-soft) = rgba(212,96,42,0.18)
 *   pill inactive border        var(--ink-hairline)
 *   pill inactive text          var(--ink-soft)
 *   pill hover (inactive)       border rgba(212,96,42,0.5) — literal per §6 note
 *   pill disabled               var(--ink-hairline) border + text, cursor not-allowed
 *   family label                var(--ink-soft) · t-meta 9px UPPERCASE
 *   section seam                border-bottom 1px dashed var(--ink-dashed)
 *   focus ring                  outline 2px dashed var(--accent-orange), offset 2px
 *
 * Accessibility:
 *   Each filter family is role="radiogroup" with aria-label.
 *   Pills are role="radio" — Enter toggles; already-active click clears to 'all'.
 *   Keyboard: Enter or Space on pill → toggle. Escape on filter region → blur.
 *   Focus ring: outline 2px dashed var(--accent-orange); outline-offset 2px (§12).
 *
 * Motion:
 *   120ms ease on pill hover (§9). Reduced-motion: all transitions 0ms (globals.css).
 *
 * Owner: Sirius (α-SUR-01)
 */

import { useCallback } from 'react';

type EntryType = 'article' | 'photo' | 'fiction';

interface FilterFamily {
  id: string;
  label: string;
  options: { value: EntryType | 'all'; display: string }[];
}

/** The one filter family exposed in v1 per §4. */
const FILTER_FAMILIES: FilterFamily[] = [
  {
    id: 'type',
    label: 'TYPE',
    options: [
      { value: 'all',     display: 'ALL' },
      { value: 'article', display: 'ART' },
      { value: 'photo',   display: 'PHO' },
      { value: 'fiction', display: 'FIC' },
    ],
  },
];

interface ArchiveFiltersProps {
  /**
   * Count of entries matching each type, so we can mark pills as disabled
   * when no entries exist for that type under the current filter state.
   */
  counts: {
    all: number;
    article: number;
    photo: number;
    fiction: number;
  };
  /**
   * BUG-1 FIX: activeType is now owned by the parent (ArchiveClient), not read
   * from useSearchParams here. The parent seeds it once from the URL on mount.
   */
  activeType: EntryType | 'all';
  /**
   * Called when the user clicks a filter pill. The parent handles both the
   * setState and the shallow window.history.replaceState URL sync.
   */
  onTypeChange: (next: EntryType | 'all') => void;
}

export function ArchiveFilters({ counts, activeType, onTypeChange }: ArchiveFiltersProps) {
  // BUG-1 FIX: setType now delegates entirely to onTypeChange — no router, no
  // searchParams, no navigation. Toggle-to-clear logic stays: clicking the
  // currently-active pill cycles back to 'all'.
  const setType = useCallback(
    (next: EntryType | 'all') => {
      const effective = activeType === next ? 'all' : next;
      onTypeChange(effective);
    },
    [activeType, onTypeChange],
  );

  return (
    <aside
      aria-label="archive filters"
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
      {/* Section header — § FILTER. Colour comes from .af-section (read-tier
          lift, Betelgeuse #3) — no inline colour so the stylesheet wins. */}
      <div
        aria-hidden
        className="af-section"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
          paddingBottom: '8px',
          borderBottom: '1px dashed var(--ink-dashed)',
        }}
      >
        § FILTER
      </div>

      {FILTER_FAMILIES.map((family) => (
        <div key={family.id}>
          {/* Family label — INSTRUMENT register. Colour from .af-family (lift). */}
          <div
            aria-hidden
            className="af-family"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              marginBottom: '6px',
            }}
          >
            {family.label}
          </div>

          {/* Pill group */}
          <div
            role="radiogroup"
            aria-label={`Filter by ${family.label.toLowerCase()}`}
            style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}
          >
            {family.options.map(({ value, display }) => {
              const isActive = activeType === value;
              const entryCount = counts[value];
              const isDisabled = value !== 'all' && entryCount === 0;

              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  aria-disabled={isDisabled}
                  disabled={isDisabled}
                  onClick={() => !isDisabled && setType(value)}
                  // .af-pill carries the read-tier inactive label colour (#3);
                  // .is-active forces the reserved orange. Only the disabled state
                  // sets colour inline (hairline). Keyboard Enter/Space native.
                  className={`af-pill${isActive ? ' is-active' : ''}`}
                  style={{
                    // Typography — t-meta register (§8)
                    fontFamily: 'var(--font-mono)',
                    fontSize: '9px',
                    letterSpacing: '0.3em',
                    textTransform: 'uppercase',
                    // Layout
                    appearance: 'none',
                    padding: '4px 10px',
                    minHeight: '28px',
                    // Borders — active vs inactive (§6)
                    border: isActive
                      ? '1px solid var(--accent-orange)'
                      : '1px solid var(--ink-hairline)',
                    // Colour: inactive-enabled comes from .af-pill (read-tier lift);
                    // active from .af-pill.is-active (orange); disabled inline only.
                    ...(isDisabled ? { color: 'var(--ink-hairline)' } : {}),
                    background: isActive
                      ? 'var(--accent-orange-soft)'
                      : 'transparent',
                    // Cursor
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    // Transitions — 120ms ease per §9; reduced-motion collapses to 0ms via globals.css
                    transition: 'border-color 120ms ease, color 120ms ease, background 120ms ease',
                    // Focus ring — 2px dashed accent-orange (§12 / §6)
                    outline: 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (isActive || isDisabled) return;
                    const el = e.currentTarget;
                    // §6: inactive hover → accent border at 0.5; token-driven so it tracks dark mode
                    el.style.borderColor = 'rgb(var(--accent-orange-rgb) / 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    if (isActive || isDisabled) return;
                    const el = e.currentTarget;
                    el.style.borderColor = 'var(--ink-hairline)';
                  }}
                  onFocus={(e) => {
                    // Focus ring per §12 / §6
                    e.currentTarget.style.outline = '2px dashed var(--accent-orange)';
                    e.currentTarget.style.outlineOffset = '2px';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.outline = 'none';
                  }}
                >
                  {display}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </aside>
  );
}
