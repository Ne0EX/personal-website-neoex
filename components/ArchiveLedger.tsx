'use client';

/**
 * components/ArchiveLedger.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Year-grouped ledger of all archive entries. Client component — manages
 * URL filter state (useSearchParams + useRouter for browser back/forward),
 * "LOAD NEXT 20" pagination, and scroll-position restore on browser-back.
 *
 * Design spec: docs/design/21-archive-route.md §4, §6, §8, §9, §11, §12
 *              docs/design/20-archive.md §9.3 (scroll restore), §15.1 (row anatomy)
 * Reference component: components/ChapterIndex.tsx (entry-card row vocabulary;
 *   hover wash rgba(212,96,42,0.04); .entry-glitch underline draw; 5-line anatomy).
 *
 * Row anatomy (5-line — per spec §4 ledger ASCII + §8 typography):
 *   1. FILE — NNN · YYYY.MM.DD · STATUS · NM  (t-meta, ink-soft; accent values accent-orange)
 *   2. Title (t-display italic, ink-primary; .entry-glitch draw animation)
 *   3. Domain tag(s) — first tag accent-orange, rest ink-soft (t-meta)
 *   4. LOCUS lat°N lon°E · DRIFT –N.NN  (t-meta; omitted when locus=null)
 *   5. Type glyph + label  (◯ ARTICLE | ■ PHOTO | ◆ FICTION, t-meta)
 *
 * Pagination: initial slice of PAGE_SIZE entries. "LOAD NEXT 20" button
 * appends the next slice. Button only shown when entries > 60 (spec §4).
 *
 * Scroll restore: sessionStorage key 'wl:archive-scroll' — saved on row click,
 * restored on mount when URL params match (spec §12, 20-archive.md §9.3).
 *
 * Token compliance (§6):
 *   row hover bg:  rgba(212, 96, 42, 0.04) — ChapterIndex carry-over, documented
 *   title:         var(--ink-primary) · Cormorant italic 18px
 *   meta labels:   var(--ink-soft) · t-meta 9px UPPERCASE
 *   accent values: var(--accent-orange)
 *   section year:  §NN in accent-orange, rest ink-soft
 *   focus ring:    outline 2px dashed var(--accent-orange); offset 2px
 *
 * Accessibility (§12):
 *   Ledger: <ol> with <li> per entry. Each <li> is a single <a> link.
 *   Year sections: <section aria-label="YEAR YYYY"><h2 class="t-meta">...</h2><ol>
 *   Enter on row navigates. Focus ring visible on <a>.
 *   Keyboard shortcut 'f' focuses first filter pill (delegated — handled here
 *   because the ledger owns the keydown listener per §12).
 *
 * ArchiveFilters is rendered in the right rail (ArchivePage), not here.
 * ArchiveLedger only controls the left column entry list.
 *
 * Owner: Sirius (α-SUR-01)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { ArchiveEntry } from '@/lib/content';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Initial + increment page size. */
const PAGE_SIZE = 20;

/**
 * Threshold above which the "LOAD NEXT 20" button is shown.
 * Per spec §4: only shown if entries > 60.
 */
const PAGINATION_THRESHOLD = 60;

/** sessionStorage key for scroll position restore (20-archive.md §9.3). */
const SCROLL_KEY = 'wl:archive-scroll';

// ─── Type helpers ─────────────────────────────────────────────────────────────

type EntryType = 'article' | 'photo' | 'fiction';

/** Glyph + full label per entry kind — §8 typography table */
const KIND_LABEL: Record<EntryType, { glyph: string; label: string }> = {
  article: { glyph: '◯', label: 'ARTICLE' },
  photo:   { glyph: '■', label: 'PHOTO' },
  fiction: { glyph: '◆', label: 'FICTION' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * ArchiveLedgerRow — a single entry row.
 * Entire row is a single <a> link (spec §12 semantic structure).
 * Modelled on ChapterIndex.tsx entry-card anatomy.
 */
function ArchiveLedgerRow({
  entry,
  onNavigate,
  hovered,
  onRowHover,
  rowRef,
}: {
  entry: ArchiveEntry;
  onNavigate: (entry: ArchiveEntry) => void;
  /** True when the globe pin (or this row) is the active hover target (§5.8). */
  hovered: boolean;
  /** Forward hover sync — row hover/focus → globe pin highlight. */
  onRowHover?: (entryId: string | null) => void;
  /** Set by the parent so a pin-side hover can scrollIntoView this row. */
  rowRef?: (el: HTMLAnchorElement | null) => void;
}) {
  const { glyph, label } = KIND_LABEL[entry.kind];

  // Build the meta line — FILE · DATE · STATUS · READING TIME
  // Articles have status + readingTime; photos/fiction have just date.
  const metaLine = (() => {
    if (entry.kind === 'article') {
      return `FILE — ${entry.fileNum} · ${entry.date} · ${entry.status.toUpperCase()} · ${entry.readingTime}M`;
    }
    if (entry.kind === 'photo') {
      return `FILE — ${entry.id} · ${entry.date}`;
    }
    // fiction
    return `FILE — ${entry.id} · ${entry.date}`;
  })();

  // Tags — first tag accent-orange, rest ink-soft (§8)
  const tags = entry.tags ?? [];
  const domain = entry.domain ?? '';

  return (
    <a
      ref={rowRef}
      href={entry.route}
      className={`entry-card${hovered ? ' archive-row-hovered' : ''}`}
      onClick={(e) => {
        // Prevent default so we can save scroll before navigating.
        // Then delegate to the router via onNavigate. Standard <a> is used
        // so browser opens in new tab on Ctrl/Cmd+click without special handling.
        // Only intercept plain left-click.
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey && e.button === 0) {
          e.preventDefault();
          onNavigate(entry);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onNavigate(entry);
        }
      }}
      // ── Forward hover sync (§5.8) — row hover/focus → globe pin highlight ──
      onMouseEnter={() => onRowHover?.(entry.id)}
      onMouseLeave={() => onRowHover?.(null)}
      style={{
        display: 'block',
        padding: '14px 0',
        paddingLeft: '4px',
        paddingRight: '12px',
        textDecoration: 'none',
        color: 'inherit',
        borderBottom: '1px dashed var(--ink-dashed)',
        // Hover bg via className .entry-card + CSS in globals (rgba(212,96,42,0.04))
        // Transition 150ms ease per §9 — globals.css already has the rule.
        transition: 'background 150ms ease',
        outline: 'none',
        cursor: 'pointer',
      }}
      onFocus={(e) => {
        // Focus ring — 2px dashed accent-orange per §12 / §6
        e.currentTarget.style.outline = '2px dashed var(--accent-orange)';
        e.currentTarget.style.outlineOffset = '2px';
        // Keyboard hover sync — focusing a row marks its pin (§5.8 / §12).
        onRowHover?.(entry.id);
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = 'none';
        onRowHover?.(null);
      }}
    >
      {/* Line 1 — meta: FILE · DATE · STATUS */}
      <div
        className="t-meta"
        style={{ marginBottom: '6px', color: 'var(--ink-soft)' }}
      >
        {entry.kind === 'article' ? (
          <>
            <span style={{ color: 'var(--ink-soft)' }}>FILE — </span>
            <span style={{ color: 'var(--accent-orange)' }}>{entry.fileNum}</span>
            <span style={{ color: 'var(--ink-soft)' }}> · {entry.date} · </span>
            <span style={{ color: 'var(--accent-orange)' }}>{entry.status.toUpperCase()}</span>
            <span style={{ color: 'var(--ink-soft)' }}> · {entry.readingTime}M</span>
          </>
        ) : (
          <span style={{ color: 'var(--ink-soft)' }}>{metaLine}</span>
        )}
      </div>

      {/* Line 2 — Title with entry-glitch draw animation (ChapterIndex pattern) */}
      <div
        className="t-display"
        style={{
          fontSize: '18px',
          fontStyle: 'italic',
          fontWeight: 400,
          lineHeight: 1.25,
          color: 'var(--ink-primary)',
          marginBottom: '6px',
        }}
      >
        {/* .entry-glitch applies the marching-dash underline draw from globals.css.
            The animation is already reduced-motion gated in globals.css. */}
        <span className="entry-glitch" data-text={entry.title}>
          {entry.title}
        </span>
      </div>

      {/* Line 3 — Domain / tags */}
      {(domain || tags.length > 0) && (
        <div
          className="t-meta"
          style={{
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            marginBottom: '5px',
          }}
        >
          {/* Domain first — accent-orange per §8 */}
          {domain && (
            <span style={{ color: 'var(--accent-orange)' }}>{domain.toUpperCase()}</span>
          )}
          {tags.map((tag, i) => (
            <span key={tag} style={{ color: i === 0 && !domain ? 'var(--accent-orange)' : 'var(--ink-soft)' }}>
              {tag.toUpperCase()}
            </span>
          ))}
        </div>
      )}

      {/* Line 4 — Locus + drift (omitted when locus=null — §11 / §4)
          Assign to a local variable so TypeScript's narrowing flow works
          correctly on the discriminated union (entry.locus typed 'null' for
          fiction prevents narrowing inside JSX expressions). */}
      {(() => {
        const locus = entry.locus;
        if (!locus) return null;
        return (
          <div className="t-meta" style={{ marginBottom: '5px', color: 'var(--ink-soft)' }}>
            <span>LOCUS </span>
            <span style={{ color: 'var(--accent-orange)' }}>
              {locus.lat.toFixed(2)}°N {locus.lon.toFixed(2)}°E
            </span>
            {/* drift is null in the current schema for all entry kinds.
                Reserved display slot for when drift becomes non-null. */}
            {locus.place && (
              <span> · {locus.place.toUpperCase()}</span>
            )}
          </div>
        );
      })()}

      {/* Line 5 — Type glyph + label */}
      <div className="t-meta" style={{ color: 'var(--ink-soft)' }}>
        <span>{glyph} {label}</span>
      </div>
    </a>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ArchiveLedgerProps {
  /**
   * All entries passed from the RSC — pre-fetched, serialized as props.
   * The ledger filters client-side via URL params for instant interaction
   * and browser back/forward support.
   */
  entries: ArchiveEntry[];

  /**
   * Callback fired when the active filter changes, so the parent (ArchiveClient)
   * can derive the matching MiniGlobePin[] for the right rail.
   * Receives filtered entries so the caller does not re-derive.
   */
  onFilterChange?: (filtered: ArchiveEntry[]) => void;

  /**
   * Bidirectional hover sync (§5.8). The entry id currently hovered on the
   * globe (or in this ledger). When set, the matching row gets the hover wash
   * and is scrolled into view (pin-side hover). null = no hover.
   */
  hoveredId?: string | null;

  /** Forward hover sync — row hover/focus reports the id (or null) up. */
  onRowHover?: (entryId: string | null) => void;
}

export function ArchiveLedger({
  entries,
  onFilterChange,
  hoveredId = null,
  onRowHover,
}: ArchiveLedgerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeType = (searchParams.get('type') as EntryType | null) ?? null;

  // ── Filter entries client-side per URL param ──
  const filtered = useMemo(() => {
    if (!activeType) return entries;
    return entries.filter((e) => e.kind === activeType);
  }, [entries, activeType]);

  // ── Notify parent of filter change so it can sync MiniGlobe activePins ──
  const prevFilteredRef = useRef<ArchiveEntry[]>([]);
  useEffect(() => {
    if (prevFilteredRef.current !== filtered) {
      prevFilteredRef.current = filtered;
      onFilterChange?.(filtered);
    }
  }, [filtered, onFilterChange]);

  // ── Pagination ──
  // Only show pagination when total filtered entries exceed the threshold.
  const showPagination = filtered.length > PAGINATION_THRESHOLD;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reset visible count when filter changes (new filter = fresh page).
  const prevActiveTypeRef = useRef(activeType);
  useEffect(() => {
    if (prevActiveTypeRef.current !== activeType) {
      prevActiveTypeRef.current = activeType;
      setVisibleCount(PAGE_SIZE);
    }
  }, [activeType]);

  const visibleEntries = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );

  const loadMore = useCallback(() => {
    setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length));
  }, [filtered.length]);

  // ── Year grouping — year-descending ──
  const yearGroups = useMemo(() => {
    const map = new Map<number, ArchiveEntry[]>();
    for (const e of visibleEntries) {
      const yr = e.year;
      if (!map.has(yr)) map.set(yr, []);
      map.get(yr)!.push(e);
    }
    // Sort years descending (most recent first)
    return Array.from(map.entries()).sort(([a], [b]) => b - a);
  }, [visibleEntries]);

  // ── Scroll restore — 20-archive.md §9.3 ──
  // On mount: restore scroll if the scroll key exists and URL params match.
  // On row navigate: save scroll to sessionStorage.
  useEffect(() => {
    // Hydration-safe: sessionStorage reads are inside useEffect, never during render.
    const savedScroll = sessionStorage.getItem(SCROLL_KEY);
    const savedParams = sessionStorage.getItem(`${SCROLL_KEY}:params`);
    if (savedScroll && savedParams === searchParams.toString()) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: parseInt(savedScroll, 10), behavior: 'instant' as ScrollBehavior });
      });
    }
  }, [searchParams]);

  const handleNavigate = useCallback(
    (entry: ArchiveEntry) => {
      // Save scroll before navigating — restores on browser-back if params match.
      sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
      sessionStorage.setItem(`${SCROLL_KEY}:params`, searchParams.toString());
      router.push(entry.route);
    },
    [router, searchParams],
  );

  // ── Keyboard shortcut 'f' → focus first filter pill (§12) ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Do not intercept when focus is in an input/textarea/select.
      const tag = (e.target as HTMLElement).tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'f') {
        const firstPill = document.querySelector<HTMLElement>(
          '[data-archive-filter-region] button:not(:disabled)',
        );
        firstPill?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Counts for ArchiveFilters (passed up via context is impractical here;
  //    parent (page.tsx) passes full entries so counts are derived here as a
  //    utility for the parent to feed to ArchiveFilters via counts prop). ──
  // Note: this component does NOT render ArchiveFilters — that lives in the
  // right rail in ArchivePage. Counts are derived here for convenience.

  // ── Bidirectional hover — scroll the hovered row into view (pin-side) ──
  // rowRefs maps entry id → anchor element. When hoveredId changes (from the
  // globe pin raycast), we scrollIntoView({ block: 'nearest' }) so the row the
  // visitor is pointing at on the globe comes into view in the ledger.
  const rowRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const prevHoveredRef = useRef<string | null>(null);
  useEffect(() => {
    // Only act on transitions INTO a hover (not on clear) and only when the
    // hover did not originate from the ledger itself (we cannot know origin, so
    // scrollIntoView({ block:'nearest' }) is a no-op when already visible — safe).
    if (hoveredId && hoveredId !== prevHoveredRef.current) {
      const el = rowRefs.current.get(hoveredId);
      el?.scrollIntoView({ block: 'nearest' });
    }
    prevHoveredRef.current = hoveredId;
  }, [hoveredId]);

  // ── Empty state ──
  const isEmpty = filtered.length === 0;

  return (
    <div id="archive-ledger" role="main">
      {isEmpty ? (
        // Empty state (§11) — copy from spec (Vega-supplied register per spec)
        <div
          className="t-mono"
          style={{
            fontSize: '9px',
            color: 'var(--ink-faint)',
            textTransform: 'uppercase',
            letterSpacing: '0.3em',
            padding: '40px 0',
          }}
        >
          {activeType ? (
            <>
              {/* Empty state: instrument-register "comment-as-copy" — spec §11 */}
              <span style={{ color: 'var(--ink-faint)' }}>{'// no entries match this survey.'}{' '}</span>
              <button
                type="button"
                onClick={() => router.push(pathname, { scroll: false })}
                style={{
                  background: 'none',
                  border: 'none',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '9px',
                  letterSpacing: '0.3em',
                  textTransform: 'uppercase',
                  color: 'var(--ink-soft)',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                  transition: 'color 150ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--accent-orange)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--ink-soft)';
                }}
              >
                [ ◯ clear all filters ]
              </button>
            </>
          ) : (
            <>
              <span style={{ color: 'var(--ink-faint)' }}>{'// no entries surveyed yet.'}{' '}</span>
              <Link
                href="/"
                style={{ color: 'var(--ink-soft)', transition: 'color 150ms ease' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--accent-orange)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--ink-soft)'; }}
              >
                [ ◯ RETURN TO ATLAS ]
              </Link>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Year-grouped sections */}
          {yearGroups.map(([year, yearEntries], sectionIdx) => (
            <section
              key={year}
              aria-label={`YEAR ${year}`}
              style={{ marginBottom: '28px' }}
            >
              {/* Section header — § NN · YEAR — YYYY */}
              <h2
                className="t-meta"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px',
                  paddingBottom: '6px',
                  borderBottom: '1px dashed var(--ink-dashed)',
                }}
              >
                {/* §NN in accent-orange; rest in ink-soft */}
                <span style={{ color: 'var(--accent-orange)' }}>
                  § {String(sectionIdx + 1).padStart(2, '0')}
                </span>
                <span style={{ color: 'var(--ink-soft)' }}>
                  · YEAR — {year}
                </span>
              </h2>

              {/* Ordered list — semantically ordered entries (§12) */}
              <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {yearEntries.map((entry) => (
                  <li key={entry.id}>
                    <ArchiveLedgerRow
                      entry={entry}
                      onNavigate={handleNavigate}
                      hovered={hoveredId === entry.id}
                      onRowHover={onRowHover}
                      rowRef={(el) => {
                        if (el) rowRefs.current.set(entry.id, el);
                        else rowRefs.current.delete(entry.id);
                      }}
                    />
                  </li>
                ))}
              </ol>
            </section>
          ))}

          {/* "LOAD NEXT 20" button — only when entries > PAGINATION_THRESHOLD and
              more entries remain beyond the current slice (§4). */}
          {showPagination && visibleCount < filtered.length && (
            <div style={{ paddingTop: '20px', paddingBottom: '40px' }}>
              <button
                type="button"
                onClick={loadMore}
                className="t-mono"
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
                [ LOAD NEXT 20 ]
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Derive entry counts for ArchiveFilters from the full entries array.
 * Called in page.tsx to feed the counts prop to ArchiveFilters.
 */
export function deriveFilterCounts(
  entries: ArchiveEntry[],
): { all: number; article: number; photo: number; fiction: number } {
  let article = 0;
  let photo = 0;
  let fiction = 0;
  for (const e of entries) {
    if (e.kind === 'article') article++;
    else if (e.kind === 'photo') photo++;
    else fiction++;
  }
  return { all: entries.length, article, photo, fiction };
}
