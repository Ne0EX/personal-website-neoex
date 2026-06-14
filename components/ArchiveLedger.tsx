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
 * Row anatomy (3-ZONE survey grid — adapt-not-copy of the reference's scannable
 * 61px cadence; was a 5-line left-stack that read as a wall):
 *   LEFT RAIL  — kind glyph + short id (◯ 003 / ■ PH·05 / ◆ FC·02), fixed gutter
 *   CENTER     — meta line (FILE date status) · Title (.entry-glitch) · tags
 *   RIGHT COL  — coord + place, RIGHT-justified, NO literal "LOCUS" label word
 *                (position + °N/°E glyphs carry the meaning; omitted when
 *                locus=null). Coord/place use the read-tier --ink-label (0.72) +
 *                --meta-tracking-read (0.12em) so geography skims cleanly down a
 *                right gutter independent of the titles.
 * Whitespace rhythm: ~16px row-to-row breathing + the kept 1px dashed
 * --ink-dashed hairline (a Worldline signature — NOT flattened to the reference's
 * borderless look). Eye runs Title down the centre, coords down the right gutter.
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
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { ArchiveEntry } from '@/lib/content';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Initial + increment page size. */
const PAGE_SIZE = 20;

/**
 * Threshold above which the "LOAD NEXT 20" button is shown.
 * Matches PAGE_SIZE so pagination activates as soon as the corpus exceeds one
 * screenful — graceful scaling as Peat adds content, not a hard wall at 60.
 * (TASK-2026-06-15: lowered from 60 → PAGE_SIZE, α-SUR-01)
 */
const PAGINATION_THRESHOLD = PAGE_SIZE;

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

/**
 * Short id for the LEFT-rail gutter (3-zone grid). Compact, scannable, fixed-
 * width-ish so the glyph+id column aligns down the rail:
 *   article → fileNum            (e.g. 003)
 *   photo   → PH·<sidecarId>     (e.g. PH·DSCF0001 — drop the roll path segment)
 *   fiction → FC·<slug-head>     (e.g. FC·GLASS — short uppercased slug fragment)
 */
function shortId(entry: ArchiveEntry): string {
  if (entry.kind === 'article') return entry.fileNum;
  if (entry.kind === 'photo') {
    const seg = entry.sidecarId || entry.id.split('/').pop() || entry.id;
    return `PH·${seg}`;
  }
  const head = (entry.slug || entry.id).split('-')[0]?.toUpperCase() || entry.id;
  return `FC·${head}`;
}

// ─── Display helpers ─────────────────────────────────────────────────────────

/**
 * CW-09 · Machine-slug masking (ux-journey, α-SUR-01, 2026-06-14)
 *
 * When a photo's caption is absent, its title falls back to the raw sidecar id
 * (archive.ts line 166: `title: s.caption ?? s.id`). Machine-generated IDs like
 * "CHATGPTIMAGE-1781389399360" are all-caps, contain only word chars + dashes,
 * and have a numeric timestamp suffix — visible to every visitor in the ledger.
 *
 * This helper detects the pattern and returns a cleaner display label:
 *   "CHATGPTIMAGE-1781389399360" → "[ photo — untitled ]"
 * The canonical slug is not changed; only the rendered label is masked.
 *
 * Pattern: string is all uppercase letters + digits + dashes/underscores, no
 * spaces, and has a digit-run of ≥8 chars in the trailing segment (numeric
 * timestamp or file-counter). False positives (e.g. "DSCF0344") are caught by
 * the >10-digit length guard.
 */
function humanTitle(title: string, kind: 'article' | 'photo' | 'fiction'): string {
  if (kind !== 'photo') return title;
  // Machine slug: no spaces, all-upper alphanumeric+dash, trailing ≥10-digit run
  const machineSlug = /^[A-Z0-9_\-]+$/.test(title) && /\d{10,}/.test(title);
  if (machineSlug) return '[ photo — untitled ]';
  return title;
}

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
  const { glyph } = KIND_LABEL[entry.kind];
  const idTag = shortId(entry);

  // Tags — first tag accent-orange, rest ink-soft (§8)
  const tags = entry.tags ?? [];
  const domain = entry.domain ?? '';
  const locus = entry.locus;

  return (
    <a
      ref={rowRef}
      href={entry.route}
      // ── 3-COLUMN SURVEY GRID (Betelgeuse #2) — id | title+tags | locus ──
      // Grid template + alignment + padding + hairline all live in globals.css
      // (.archive-ledger-row, single source of truth) so every row inherits the
      // SAME tracks and columns line up vertically down the page. Sirius applies
      // the classes only — no inline grid style.
      className={`entry-card archive-ledger-row${hovered ? ' archive-row-hovered' : ''}`}
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
      {/* ── COL 1 — id zone: glyph + id on line 1, FILE meta as a quiet sub-line.
          The FILE—date·status·duration meta no longer floats on line 1; it sits
          UNDER the id, aligned in col 1 (.alr-meta). ── */}
      <div className="alr-col-id t-meta">
        <span className="alr-id-head">
          <span className="alr-id-glyph">{glyph}</span> {idTag}
        </span>
        <span className="alr-meta">
          {entry.kind === 'article' ? (
            <>
              FILE — <span className="alr-meta-accent">{entry.fileNum}</span> ·{' '}
              {entry.date} ·{' '}
              <span className="alr-meta-accent">{entry.status.toUpperCase()}</span> ·{' '}
              {entry.readingTime}M
            </>
          ) : (
            <>FILE — {entry.date}</>
          )}
        </span>
      </div>

      {/* ── COL 2 — body: italic title (entry-glitch) + tags ── */}
      <div className="alr-col-body">
        {/* Title with entry-glitch draw animation (ChapterIndex pattern).
            .entry-glitch applies the marching-dash underline draw from globals.css;
            the animation is already reduced-motion gated there. */}
        <div
          className="t-display"
          style={{
            fontSize: '18px',
            fontStyle: 'italic',
            fontWeight: 400,
            lineHeight: 1.25,
            color: 'var(--ink-primary)',
          }}
        >
          {/* CW-09: humanTitle masks raw machine-slug IDs (CHATGPTIMAGE-…) when
              caption is absent. Display label only — slug and route unchanged. */}
          {(() => {
            const display = humanTitle(entry.title, entry.kind);
            return (
              <span className="entry-glitch" data-text={display}>
                {display}
              </span>
            );
          })()}
        </div>

        {/* Domain / tags — first accent (.alr-tag-lead), rest ink-soft (.alr-tag) */}
        {(domain || tags.length > 0) && (
          <div className="alr-tags t-meta">
            {domain && <span className="alr-tag-lead">{domain.toUpperCase()}</span>}
            {tags.map((tag, i) => (
              <span
                key={tag}
                className={i === 0 && !domain ? 'alr-tag-lead' : 'alr-tag'}
              >
                {tag.toUpperCase()}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── COL 3 — locus: coord + place, RIGHT-aligned read gutter, NO "LOCUS"
          label word. Position + the °N/°E glyphs carry the meaning. Omitted
          entirely when locus=null — the gutter simply stays empty for those rows
          and the max-content track collapses. ── */}
      <div className="alr-col-locus t-meta">
        {locus ? (
          <>
            <span>
              {locus.lat.toFixed(2)}°N {locus.lon.toFixed(2)}°E
            </span>
            {locus.place && (
              <span className="alr-place">{locus.place.toUpperCase()}</span>
            )}
          </>
        ) : null}
      </div>
    </a>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface ArchiveLedgerProps {
  /**
   * All entries passed from the RSC — pre-fetched, serialized as props.
   * ArchiveClient pre-filters by activeType before passing visibleEntries here,
   * so the ledger renders EXACTLY the entries it should show.
   */
  entries: ArchiveEntry[];

  /**
   * SINGLE SOURCE OF TRUTH for the active type filter. Driven by ArchiveClient
   * state (not re-derived from useSearchParams here). Used only to:
   *   1. Drive the "no entries match" vs "no entries surveyed yet" branch.
   *   2. Route the clear-filter button through the parent's onTypeChange handler.
   * null = 'all' (no filter active).
   */
  activeType?: EntryType | 'all' | null;

  /**
   * Called when the clear-filter button is clicked. Routes through ArchiveClient
   * so the URL stays in sync with client state (single source of truth).
   */
  onTypeChange?: (next: EntryType | 'all') => void;

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
  activeType = null,
  onTypeChange,
  onFilterChange,
  hoveredId = null,
  onRowHover,
}: ArchiveLedgerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ArchiveClient pre-filters entries by activeType before passing them here.
  // The ledger renders exactly what it receives — no secondary filter needed.
  // We keep `filtered` as an alias for clarity and to preserve onFilterChange.
  const filtered = entries;

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

  // Reset visible count when activeType changes (new filter = fresh page).
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
  // Audit fix: scope the querySelector to [data-archive-filter-pills] (the pills
  // wrapper only) so the 'f' key focuses the first TYPE pill, not the NEXT NODE
  // readout button that precedes the pills in DOM within the wider filter region.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Do not intercept when focus is in an input/textarea/select.
      const tag = (e.target as HTMLElement).tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.key === 'f') {
        const firstPill = document.querySelector<HTMLElement>(
          '[data-archive-filter-pills] button:not(:disabled)',
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
    // Only act on transitions INTO a hover (not on clear).
    if (hoveredId && hoveredId !== prevHoveredRef.current) {
      const el = rowRefs.current.get(hoveredId);
      if (el) {
        // Guard: only scroll when the row is COMPLETELY off-screen. A row that
        // is even partially visible must produce zero page movement — the
        // original scrollIntoView({ block:'nearest' }) was nudging the page
        // whenever the row sat near a viewport edge, causing the jarring shift
        // on pin-hover. (Fix: guard with getBoundingClientRect before acting.)
        const rect = el.getBoundingClientRect();
        const partiallyVisible =
          rect.bottom > 0 && rect.top < window.innerHeight;
        if (!partiallyVisible) {
          // Row is fully off-screen — reveal it vertically only (no X shift).
          el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      }
    }
    prevHoveredRef.current = hoveredId;
  }, [hoveredId]);

  // ── Empty state ──
  // Audit fix: the false "// no entries surveyed yet" branch showed while 9 real
  // entries existed because ArchiveLedger was independently filtering by URL params
  // (including unvalidated junk ?type= values). Now that ArchiveClient is the single
  // source of truth and validates ?type= before passing visibleEntries here, this
  // branch only fires when the FULL corpus is genuinely empty (no entries at all).
  const isEmpty = filtered.length === 0;

  // An active filter means a valid type was set (prop-driven, validated upstream).
  // The clear button now routes through onTypeChange (parent handler) — not
  // router.push — so the URL stays in sync with client state.
  const hasActiveFilter = activeType && activeType !== 'all';

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
          {hasActiveFilter ? (
            <>
              {/* Empty state: instrument-register "comment-as-copy" — spec §11 */}
              <span style={{ color: 'var(--ink-faint)' }}>{'// no entries match this survey.'}{' '}</span>
              <button
                type="button"
                onClick={() => onTypeChange?.('all')}
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
            // Only shown when the corpus is GENUINELY empty (no entries in store).
            // With 9 real entries, this branch is unreachable.
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

              {/* Ordered list — semantically ordered entries (§12).
                  rowGap adds the ~16px row-to-row breathing the survey cadence
                  wants (whitespace rhythm), layered over the kept dashed hairline
                  — separation is whitespace FIRST, hairline as a Worldline accent. */}
              <ol
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  rowGap: '16px',
                }}
              >
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
