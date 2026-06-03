'use client';

/**
 * components/ArchiveClient.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * The interactive island for /archive. The RSC (app/archive/page.tsx) stays a
 * Server Component so the static <main data-pagefind-body> shell survives for
 * pagefind; this client island owns everything that needs hooks / handlers:
 *
 *   - useRouter — pin click → navigate to the entry (goal 3); globe click → '/'.
 *   - hoveredId state — bidirectional hover sync between ledger rows and globe
 *     pins (goal 2). Row hover/focus → pin highlight; pin hover → row wash +
 *     scrollIntoView.
 *   - filtered entries → activePins — pins re-colour on the active ?type filter
 *     (goal 1 completion). in-membership → accent-orange; out → ink @ 0.32.
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

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArchiveLedger } from './ArchiveLedger';
import { ArchiveFilters } from './ArchiveFilters';
import { ArchiveMiniGlobe } from './ArchiveMiniGlobe';
import { getMiniGlobePins } from '@/lib/content';
import type { ArchiveEntry, MiniGlobePin } from '@/lib/content';

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

  // Active ?type filter — read here so activePins recolour matches the ledger
  // (both read the same URL param; no second source of truth).
  const activeType = (searchParams.get('type') as EntryType | null) ?? null;

  // Entries matching the active filter — drives the activePins membership set.
  const filteredEntries = useMemo(
    () => (activeType ? entries.filter((e) => e.kind === activeType) : entries),
    [entries, activeType],
  );

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

  // Goal 3 — pin click navigates to the entry's clean route.
  const handlePinClick = useCallback(
    (pin: MiniGlobePin) => {
      router.push(pin.route);
    },
    [router],
  );

  // Empty-surface click → ATLAS (§5.6).
  const handleGlobeClick = useCallback(() => {
    router.push('/');
  }, [router]);

  return (
    <>
      {/* Ledger — left column (~66%, max 840px). */}
      <section
        style={{
          flex: '1 1 0',
          minWidth: 0,
          maxWidth: '840px',
        }}
      >
        <ArchiveLedger
          entries={entries}
          hoveredId={hoveredId}
          onRowHover={setHoveredId}
        />
      </section>

      {/* Right rail — sticky. Mini-globe + filter chips. */}
      <aside
        data-archive-filter-region
        aria-label="archive filters and globe"
        style={{
          width: '360px',
          flexShrink: 0,
          position: 'sticky',
          top: '72px',
          alignSelf: 'flex-start',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
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
          />
        </div>

        {/* Filter chips — type filter (§4 filter rail). */}
        <div className="archive-filters">
          <ArchiveFilters counts={counts} />
        </div>
      </aside>
    </>
  );
}

export default ArchiveClient;
