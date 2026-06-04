'use client';

/**
 * lib/client-state/usePagefind.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Minimal pagefind hook for ArchiveQuery.
 *
 * MOVED from components/TriangulateSearch.tsx — parseCoordString, resultsToPins,
 * PagefindResult type, the lazy import('/pagefind/pagefind.js') loader with
 * webpackIgnore + string-template indirection + .catch(()=>null), pagefindRef,
 * 120ms debounce, runSearch core. None of this is re-derived.
 *
 * Contract:
 *   const { urls, phase } = usePagefind(query);
 *   urls — Set<string> of matched result.url values (null when query is empty
 *          OR when pagefind is unavailable — so the ledger stays fully browsable)
 *   phase — 'idle' | 'loading' | 'results' | 'no-results' | 'offline'
 *
 * ArchiveQuery uses `phase` to render the .aq-status line and passes `urls`
 * to ArchiveClient via onMatchesChange.
 *
 * pagefind client API notes (loaded dynamically from /pagefind/pagefind.js):
 *   pagefind.search(query, { sort })
 *   result.data() → { url, meta, excerpt, anchors }
 *
 * pagefind is ONLY available after `npm run build`. During dev the dynamic
 * import fails → .catch(()=>null) returns null → phase:'offline' → caller
 * passes null matches → ledger shows all entries. Safe default.
 *
 * Owner: Sirius (α-SUR-01)
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// canonicalPath — URL normaliser for pagefind result URLs → entry.route shape.
//
// Pagefind indexes .next/server/app which contains files like:
//   articles/002.html, fiction/transmission-001.html,
//   photos/2026-05-bangkok/DSCF0005.html
// …so result.url comes back as e.g. "/articles/002.html".
// entry.route is the clean path without suffix: "/articles/002".
//
// This function normalises a raw URL string to the clean route form:
//   1. Strip ?query and #fragment — pagefind sometimes appends anchor refs.
//   2. Strip .html suffix.
//   3. Strip trailing slash (except the root "/" itself).
//
// Applied to BOTH the pagefind result URLs (in usePagefind) AND entry.route
// (in ArchiveClient's filter) so both sides converge to the same canonical
// form regardless of future changes to either source.
// ─────────────────────────────────────────────────────────────────────────────

export function canonicalPath(url: string): string {
  // 1. Strip fragment and query string.
  let p = url.split('#')[0].split('?')[0];
  // 2. Strip .html suffix.
  if (p.endsWith('.html')) {
    p = p.slice(0, -5);
  }
  // 3. Strip trailing slash — keep bare "/" as-is.
  if (p.length > 1 && p.endsWith('/')) {
    p = p.slice(0, -1);
  }
  return p;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types — MOVED verbatim from TriangulateSearch.tsx
// ─────────────────────────────────────────────────────────────────────────────

export interface PagefindResult {
  url: string;
  meta: {
    title?: string;
    /** pagefind-meta: kind — article | photo | fiction */
    kind?: string;
    /** pagefind-meta: fileNum — e.g. "001" */
    fileNum?: string;
    /** pagefind-meta: date — YYYY.MM.DD */
    date?: string;
    /** pagefind-meta: isoDate — YYYY-MM-DD (for sort) */
    isoDate?: string;
    /** pagefind-meta: tags — comma-separated */
    tags?: string;
    /** pagefind-meta: coord — "lat°N · lon°E" or blank */
    coord?: string;
    /** pagefind-meta: place — locality label for the readout RETICLE meta */
    place?: string;
    /** pagefind-meta: drift — "N.Nk" distance from α locus */
    drift?: string;
    /** pagefind-meta: tended-count — number of revisions */
    'tended-count'?: string;
    /** pagefind-meta: tended-last — YYYY.MM.DD of last revision */
    'tended-last'?: string;
  };
  excerpt: string;
}

export type PagefindPhase = 'idle' | 'loading' | 'results' | 'no-results' | 'offline';

export interface UsePagefindResult {
  /** Set of matched URLs, or null when query is empty / index is offline. */
  urls: Set<string> | null;
  phase: PagefindPhase;
}

// ─────────────────────────────────────────────────────────────────────────────
// parseCoordString — MOVED verbatim from TriangulateSearch.tsx
// Parse "13.76°N · 100.50°E" → { lat, lon } | null
// ─────────────────────────────────────────────────────────────────────────────

export function parseCoordString(
  coord: string | undefined,
): { lat: number; lon: number } | null {
  if (!coord) return null;
  const m = coord.match(
    /^(-?[\d.]+)°([NS])\s*·\s*(-?[\d.]+)°([EW])$/i,
  );
  if (!m) return null;
  const lat = parseFloat(m[1]) * (m[2].toUpperCase() === 'S' ? -1 : 1);
  const lon = parseFloat(m[3]) * (m[4].toUpperCase() === 'W' ? -1 : 1);
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
  return { lat, lon };
}

// ─────────────────────────────────────────────────────────────────────────────
// usePagefind hook
// ─────────────────────────────────────────────────────────────────────────────

export function usePagefind(query: string): UsePagefindResult {
  const [phase, setPhase] = useState<PagefindPhase>('idle');
  const [urls, setUrls] = useState<Set<string> | null>(null);

  // Persistent pagefind module ref — MOVED from TriangulateSearch.tsx
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pagefindRef = useRef<any>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // runSearch — MOVED core logic from TriangulateSearch.tsx, simplified:
  // ArchiveQuery only needs URL membership (Set<string>), not full result
  // objects. The kind filter and sort params are omitted here because
  // ArchiveClient owns the type filter separately via ?type=. The search
  // runs on the raw query string with no additional pagefind filters.
  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setPhase('idle');
      setUrls(null);
      return;
    }

    setPhase('loading');

    try {
      // Lazy-load pagefind. The string-template path avoids TypeScript static
      // resolution; webpackIgnore stops the bundler trying to resolve it at
      // build time. .catch(()=>null) is the dev-safety fallback.
      if (!pagefindRef.current) {
        const pfPath = `/pagefind/pagefind.js`;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore — runtime-only module, not resolvable at compile time
        pagefindRef.current = await import(/* webpackIgnore: true */ pfPath).catch(
          () => null,
        );
      }

      if (!pagefindRef.current) {
        // Index is offline (dev mode or missing build artifact).
        // Force urls → null so ArchiveClient shows all entries.
        setPhase('offline');
        setUrls(null);
        return;
      }

      const pf = pagefindRef.current;

      // Sort newest-first by default (matches ledger default order).
      const searchResult = await pf.search(q, {
        sort: { isoDate: 'desc' },
      });

      if (!searchResult || !searchResult.results) {
        setPhase('no-results');
        setUrls(new Set());
        return;
      }

      // Resolve all result data to get the URL for each hit.
      const resolved: PagefindResult[] = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        searchResult.results.map((r: any) => r.data() as Promise<PagefindResult>),
      );

      if (resolved.length === 0) {
        setPhase('no-results');
        setUrls(new Set());
      } else {
        setPhase('results');
        // Normalise pagefind result URLs to clean route form (strips .html,
        // trailing slash, fragment, query) so they match entry.route exactly.
        // Without this, "/articles/002.html" never intersects "/articles/002".
        setUrls(new Set(resolved.map((r) => canonicalPath(r.url))));
      }
    } catch {
      // Any unexpected failure → treat as offline so the ledger stays usable.
      setPhase('offline');
      setUrls(null);
    }
  }, []);

  // 120ms debounce — MOVED from TriangulateSearch.tsx
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      runSearch(query);
    }, 120);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query, runSearch]);

  return { urls, phase };
}
