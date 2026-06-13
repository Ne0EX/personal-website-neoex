'use client';

/**
 * components/ArchiveClient.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * The interactive island for /archive. The RSC (app/archive/page.tsx) stays a
 * Server Component so the static <main data-pagefind-body> shell survives for
 * pagefind; this client island owns everything that needs hooks / handlers:
 *
 *   - useRouter — pin click → navigate to the entry (goal 3); globe click stays
 *     on /archive (clears lock; no home-bounce).
 *   - hoveredId state — bidirectional hover sync between ledger rows and globe
 *     pins (goal 2). Row hover/focus → pin highlight; pin hover → row wash +
 *     scrollIntoView.
 *   - filtered entries → activePins — pins re-colour on the active ?type filter
 *     (goal 1 completion). in-membership → accent-orange; out → ink @ 0.32.
 *
 * SEARCH IS OVERLAY-ONLY (Peat 2026-06-04): the /archive ledger is the
 * EXPLORATION/survey route — it renders the full corpus filtered ONLY by the
 * ?type filter. Full-text search lives in the global Triangulate OVERLAY
 * (TriangulateSearchPortal · '/' hotkey · [ ⌕ survey ] affordance), NOT in this
 * page. The earlier in-page ArchiveQuery island has been removed here.
 *
 * It renders BOTH columns of the two-column body: the ledger (left ~66%) and the
 * sticky right rail (mini-globe + filters). The RSC composes the page chrome
 * (header strip, marginalia, pagefind shell) around it.
 *
 * Why an island and not props on the RSC: an RSC cannot pass function props
 * (onPinClick, onRowHover) or hold state. Keeping the RSC pure preserves the
 * static HTML; this island provides the behaviour.
 *
 * Design spec: docs/design/21-archive-route.md §3 (RSC boundary), §5.6 (props),
 * §5.8 (hover sync), §4 (layout).
 * Owner: Sirius (α-SUR-01)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArchiveLedger } from './ArchiveLedger';
import { ArchiveFilters } from './ArchiveFilters';
import { ArchiveMiniGlobe } from './ArchiveMiniGlobe';
import type { MiniGlobeReadout } from './ArchiveMiniGlobe';
import { ArchiveGlobeReadout } from './ArchiveGlobeReadout';
import { getMiniGlobePins } from '@/lib/content';
import type { ArchiveEntry, MiniGlobePin } from '@/lib/content';

// VALID_ENTRY_TYPES — guard for URL ?type= validation. Any value outside this
// set (e.g. ?type=junk, ?type=undefined) is coerced to 'all' so the ledger
// never shows a false "no entries surveyed yet" empty state with real entries.
const VALID_ENTRY_TYPES = new Set(['article', 'photo', 'fiction']);

type EntryType = 'article' | 'photo' | 'fiction';

interface ArchiveClientProps {
  /** Full corpus from the RSC — pre-fetched, serialized. */
  entries: ArchiveEntry[];
  /** All privacy-gated public-locus pins (full set, pre-computed in the RSC). */
  pins: MiniGlobePin[];
  /** Per-type counts for the filter pills (computed server-side). */
  counts: { all: number; article: number; photo: number; fiction: number };
}

export function ArchiveClient({ entries, pins, counts }: ArchiveClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // BUG-1 FIX + AUDIT FIX (single-source-of-truth): activeType is CLIENT STATE.
  // Initialized ONCE from the URL but validated against VALID_ENTRY_TYPES so a
  // junk ?type= param (e.g. ?type=undefined) never shows the false "no entries
  // surveyed yet" empty state while real entries exist.
  // Filter changes go through handleTypeChange which calls
  // window.history.replaceState (shallow, no navigation, no remount of the globe
  // subtree). The URL is the CANONICAL source; resync via useEffect when
  // searchParams changes externally (e.g. browser-back, external link).
  const [activeType, setActiveType] = useState<EntryType | 'all'>(() => {
    const param = searchParams.get('type');
    return param && VALID_ENTRY_TYPES.has(param) ? (param as EntryType) : 'all';
  });

  // Resync activeType when the URL searchParams change externally (browser-back,
  // navigation from another route with a ?type= param). This keeps the client
  // state in lock-step with the URL without requiring a full remount.
  // setTimeout(0): deferred setState in effect body avoids the cascading-render
  // lint error (react-hooks/set-state-in-effect) — same pattern as Nav.tsx.
  useEffect(() => {
    const param = searchParams.get('type');
    const next = param && VALID_ENTRY_TYPES.has(param) ? (param as EntryType) : 'all';
    const t = setTimeout(() => setActiveType(next), 0);
    return () => clearTimeout(t);
  }, [searchParams]);

  // Called by ArchiveFilters AND ArchiveLedger's clear-filter button. Sets state
  // AND syncs the URL without a full navigation, so /archive?type=photo remains
  // deep-linkable/shareable but the route does NOT re-render and the globe subtree
  // does NOT remount.
  const handleTypeChange = useCallback(
    (next: EntryType | 'all') => {
      setActiveType(next);
      // Shallow URL sync — replaceState creates NO history entry.
      // Trade-off: browser back/forward no longer restores the filter; forward
      // deep-link (/archive?type=photo on first load) still seeds correctly.
      const url = new URL(window.location.href);
      if (next === 'all') {
        url.searchParams.delete('type');
      } else {
        url.searchParams.set('type', next);
      }
      window.history.replaceState(null, '', url.pathname + (url.search || ''));
    },
    [],
  );

  // ── Visible entries — type filter ONLY ──────────────────────────────────────
  // Search is overlay-only now (Peat 2026-06-04): the /archive ledger renders the
  // FULL corpus filtered solely by the activeType state (synced from URL on mount).
  // No in-page search, no ?q=.
  const visibleEntries = useMemo(
    () =>
      activeType !== 'all' ? entries.filter((e) => e.kind === activeType) : entries,
    [entries, activeType],
  );

  // Entries matching the active filter — drives the activePins membership set.
  const filteredEntries = visibleEntries;

  // FIX-F (goal 1 completion): derive activePins from the active filter so the
  // globe pins recolour — in-membership (accent-orange) vs out (ink @ 0.32) —
  // and the caption updates (NN OF NN LOCI VISIBLE). When no filter is active,
  // activePins === pins (all in membership).
  const activePins = useMemo(
    () => getMiniGlobePins(filteredEntries),
    [filteredEntries],
  );

  // Bidirectional hover sync (goal 2) — single source of truth shared by the
  // ledger (rows) and the globe (pins).
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // ── Instrument readout + lock (CLONE of the ATLAS NETRA console) ──
  // readout drives the RETICLE / DRIFT A / BEARING / STRATUM panel under the globe;
  // lockedEntryId is the click-locked node (held reticle). The globe broadcasts
  // both via onReadout / onLockChange; the NEXT NODE button cycles the lock here.
  const [readout, setReadout] = useState<MiniGlobeReadout | null>(null);
  const [lockedEntryId, setLockedEntryId] = useState<string | null>(null);

  // Goal 3 — pin click navigates to the entry's clean route.
  const handlePinClick = useCallback(
    (pin: MiniGlobePin) => {
      router.push(pin.route);
    },
    [router],
  );

  // ANTI-BOUNCE (headline fix 3): a bare-surface click MUST NOT navigate to '/'.
  // Cloning ATLAS L1007, it only clears the lock — free exploration, stay on
  // /archive. The router.push('/') home-bounce is dead.
  const handleGlobeClick = useCallback(() => {
    setLockedEntryId(null);
  }, []);

  // NEXT NODE — cycle the lock through the pin set (clone ATLAS jumpTargets).
  const jumpIdxRef = useRef(0);
  const handleJumpNext = useCallback(() => {
    if (pins.length === 0) return;
    // Advance from the currently-locked pin, or from the start.
    const curIdx = lockedEntryId
      ? pins.findIndex((p) => p.id === lockedEntryId)
      : jumpIdxRef.current - 1;
    const nextIdx = (curIdx + 1 + pins.length) % pins.length;
    jumpIdxRef.current = nextIdx;
    setLockedEntryId(pins[nextIdx].id);
  }, [pins, lockedEntryId]);

  return (
    <>
      {/* Ledger — left column. Width/alignment come from .archive-ledger-col in
          globals.css (max 960px — Betelgeuse #4 page-grid rebalance: wider ledger
          so the 3-col survey table has room to align). No inline width.
          NOTE: passes visibleEntries (search + type filtered) rather than the
          full entries array so the ledger reflects the active search result.
          activeType + onTypeChange are the single source of truth for the filter —
          ArchiveLedger no longer reads useSearchParams independently. */}
      <section className="archive-ledger-col">
        <ArchiveLedger
          entries={visibleEntries}
          activeType={activeType}
          onTypeChange={handleTypeChange}
          hoveredId={hoveredId}
          onRowHover={setHoveredId}
        />
      </section>

      {/* Right rail — instrument rail. Sticky + width + gap come from
          .archive-rail-col in globals.css (340px track, sits FURTHER RIGHT /
          tighter to the edge — Betelgeuse #4). No inline width/sticky. */}
      <aside
        className="archive-rail-col"
        data-archive-filter-region
        aria-label="archive filters and globe"
      >
        {/* Mini-globe — 300×300 (standby-archive variant, §5.5). */}
        <div
          className="archive-mini-globe"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
        >
          <ArchiveMiniGlobe
            size={300}
            pins={pins}
            activePins={activePins}
            hoveredEntryId={hoveredId}
            onPinHover={setHoveredId}
            onPinClick={handlePinClick}
            onGlobeClick={handleGlobeClick}
            onReadout={setReadout}
            lockedEntryId={lockedEntryId}
            onLockChange={setLockedEntryId}
          />

          {/* RETICLE / DRIFT A / BEARING / STRATUM readout — under the globe,
              cloning the observatory NETRA console. aria-live=polite so it's
              announced. */}
          <ArchiveGlobeReadout
            readout={readout}
            hasPins={pins.length > 0}
            onJumpNext={handleJumpNext}
          />
        </div>

        {/* Filter chips — type filter (§4 filter rail).
            BUG-1 FIX: activeType + onTypeChange passed as props so ArchiveFilters
            reads client state (not useSearchParams) and calls no router.push.
            data-archive-filter-pills scopes the 'f' keyboard shortcut to THIS
            pills wrapper only (tighter than the old data-archive-filter-region which
            wrapped the entire right rail including the NEXT NODE readout button). */}
        <div className="archive-filters" data-archive-filter-pills>
          <ArchiveFilters
            counts={counts}
            activeType={activeType}
            onTypeChange={handleTypeChange}
          />
        </div>
      </aside>
    </>
  );
}

export default ArchiveClient;
