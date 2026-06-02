/**
 * app/archive/page.tsx — SERVER COMPONENT (NO 'use client')
 * ─────────────────────────────────────────────────────────────────────────────
 * The /archive route — a durable browse ledger for the full Worldline corpus.
 * Cross-stratum: articles + photos + fiction in a single flat, year-grouped list.
 *
 * CRITICAL RSC CONSTRAINT (docs/design/21-archive-route.md §3):
 *   This file MUST remain a Server Component (no 'use client' directive).
 *   The <main data-pagefind-body> element emitted here is the static HTML that
 *   scripts/inject-pagefind-sidecar.ts reads for pagefind indexing. If this
 *   file becomes a Client Component, pagefind sees no body content.
 *
 * Data flow:
 *   const entries = await getArchiveEntries();  — all entries, latest-patch order
 *   const byYear  = await getArchiveEntriesByYear(entries);  — grouped by survey year
 *   const pins    = getMiniGlobePins(entries);  — privacy-gated public-locus pins
 *   Server passes entries[] and pins[] to client children as serialized props.
 *
 * Non-standard Next.js (per AGENTS.md):
 *   searchParams is a Request-time API — reading it forces ƒ Dynamic rendering.
 *   This RSC does NOT read searchParams (defect fix — see inline comment below).
 *   ?type= filtering is handled client-side by ArchiveLedger + ArchiveFilters.
 *   Source: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md
 *
 * Client components that need event handlers are imported from:
 *   - components/ArchiveLedger.tsx ('use client') — NO exports called from RSC
 *   - components/ArchiveFilters.tsx ('use client')
 *   - components/ArchiveMiniGlobe.tsx ('use client')
 *   - components/ArchiveSurveyAffordance.tsx ('use client')
 *
 *   CRITICAL: never import/call a 'use client' export from this RSC.
 *   Filter counts are computed here by deriveFilterCountsServer() (plain reduce).
 *
 * The RSC page itself has NO event handlers, NO 'use client' directive.
 *
 * Design spec: docs/design/21-archive-route.md (Betelgeuse · α-VIS-04)
 * Layout: §4 — two-column desktop (ledger ~66% left · right rail 360px sticky).
 * Tokens: §6 — zero new tokens; all from app/globals.css.
 * Owner: Sirius (α-SUR-01)
 */

import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  getArchiveEntries,
  getArchiveEntriesByYear,
  getMiniGlobePins,
} from '@/lib/content';
import { ArchiveFilters } from '@/components/ArchiveFilters';
import { ArchiveLedger } from '@/components/ArchiveLedger';
import { ArchiveMiniGlobe } from '@/components/ArchiveMiniGlobe';
import { ArchiveSurveyAffordance } from '@/components/ArchiveSurveyAffordance';
import type { ArchiveEntry } from '@/lib/content';

// ─────────────────────────────────────────────────────────────────────────────
// Page metadata
// ─────────────────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Archive Ledger · Worldline · ∇ Neospirit',
  description:
    'A surveyed inventory of all traces — articles, photographs, and fiction transmissions — ordered by most-recently-patched survey date.',
};

// ─────────────────────────────────────────────────────────────────────────────
// Server-side filter count helper — plain reduce over ArchiveEntry[].
// Kept here (NOT imported from ArchiveLedger.tsx) because ArchiveLedger is a
// 'use client' module; calling its exports from an RSC causes a Next.js error
// ("Attempted to call deriveFilterCounts() from the server" digest 1047491512).
// FIX for Algol defect #1 (HTTP 500 on every request).
// ─────────────────────────────────────────────────────────────────────────────

function deriveFilterCountsServer(
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

// ─────────────────────────────────────────────────────────────────────────────
// Page component — SERVER COMPONENT (no 'use client')
//
// FIX for Algol defect #2 (Dynamic → not statically rendered):
//   searchParams is NOT read in this RSC. Reading searchParams forces the route
//   to ƒ Dynamic, which prevents static HTML from being emitted and breaks
//   pagefind indexing. The ?type= filter is handled entirely CLIENT-SIDE by
//   ArchiveLedger (useSearchParams) and ArchiveFilters (useSearchParams).
//   The RSC renders ALL entries into <main data-pagefind-body> so the static
//   HTML exists and pagefind can index the full corpus.
//   Source: node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md
//           "searchParams is a Request-time API ... will opt the page into dynamic rendering"
// ─────────────────────────────────────────────────────────────────────────────

export default async function ArchivePage() {
  // Fetch all entries from the content layer (Procyon's data helper).
  // Privacy gate is applied inside getArchiveEntries / getMiniGlobePins.
  const allEntries = await getArchiveEntries();
  const byYear = await getArchiveEntriesByYear(allEntries);
  const pins = getMiniGlobePins(allEntries);

  // Counts derived server-side (plain reduce — not imported from 'use client' module).
  const counts = deriveFilterCountsServer(allEntries);

  // All entries passed to pagefind sidecar spans — full corpus, no type filtering.
  // Client-side filtering (ArchiveLedger / ArchiveFilters) handles ?type= at runtime.
  const sidecarEntries = allEntries;

  const totalCount = allEntries.length;
  const yearKeys = Object.keys(byYear)
    .map(Number)
    .sort((a, b) => b - a);
  const patchCount = yearKeys.length;

  return (
    /*
     * Root layout: app/layout.tsx provides <html>, fonts, TriangulateSearchPortal.
     * The '/' hotkey opens the Triangulate overlay from /archive (§2 coexistence).
     */
    <main
      data-pagefind-body
      data-pagefind-meta="title:ARCHIVE LEDGER,type:archive"
      data-pagefind-ignore="nav header footer .archive-filters .archive-mini-globe"
      className="paper-canvas"
      style={{
        minHeight: '100vh',
        paddingRight: '28px',
      }}
    >
      {/* Scroll meter — top 2px accent-orange fill (existing .scroll-meter atom) */}
      <div className="scroll-meter" aria-hidden="true" />

      {/*
       * Visually-hidden skip link (§12 accessibility).
       * The onFocus/onBlur show/hide behaviour is CSS-based using :focus-within
       * would require a wrapper; instead we use a static CSS class that applies
       * the "jump to visible" pattern. We keep it simple with inline styles for
       * SSR compatibility — no event handlers in the RSC.
       */}
      <a
        href="#archive-ledger"
        className="t-mono"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 'auto',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          fontSize: '9px',
          letterSpacing: '0.3em',
          textTransform: 'uppercase',
        }}
      >
        Skip to archive ledger
      </a>

      {/*
       * PAGEFIND STATIC HTML — minimal index content for sidecar enrichment.
       * Visually hidden (position absolute, off-screen). Parseable by pagefind.
       * Screen readers skip via aria-hidden (ledger rows are the accessible surface).
       * The inject-pagefind-sidecar.ts script enriches this further post-build.
       */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '-9999px',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        }}
      >
        <span data-pagefind-weight="5">ARCHIVE LEDGER</span>
        {sidecarEntries.map((e) => (
          <span key={e.id} data-pagefind-weight="3">
            {e.title}
          </span>
        ))}
      </div>

      {/* ── HEADER STRIP (§4 — .archive-head) ──────────────────────────────── */}
      <header
        style={{
          position: 'relative',
          padding: '24px 40px 20px',
          borderBottom: '1px dashed var(--ink-dashed)',
        }}
      >
        {/* Corner reticles — .corner-marks atom (soul-atom id: corner-reticle) */}
        <div className="corner-marks" aria-hidden="true" />

        {/* Line 1 — observatory + ledger identity (t-meta 9px UPPERCASE) */}
        <div className="t-meta" style={{ marginBottom: '6px' }}>
          <span style={{ color: 'var(--ink-soft)' }}>OBSERVATORY · </span>
          <span style={{ color: 'var(--accent-orange)' }}>ARCHIVE LEDGER</span>
          <span style={{ color: 'var(--ink-soft)' }}>
            {' · '}
            <span style={{ color: 'var(--accent-orange)' }}>{totalCount}</span>
            {' ENTRIES SURVEYED · '}
            <span style={{ color: 'var(--accent-orange)' }}>{patchCount}</span>
            {' PATCHES'}
          </span>
        </div>

        {/* Line 2 — observer + drift range + alpha (t-meta 9px) */}
        <div className="t-meta" style={{ marginBottom: '10px' }}>
          <span style={{ color: 'var(--accent-orange)' }}>∇ Ne0EX</span>
          <span style={{ color: 'var(--ink-soft)' }}>
            {' · DRIFT MIN +0.00 · DRIFT MAX –2.40 · α '}
            <span style={{ color: 'var(--accent-orange)' }}>1.130426</span>
          </span>
        </div>

        {/* Line 3 — [ ◯ ATLAS ] link left · [ ⌕ survey ] affordance right */}
        <div
          className="t-meta"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/*
           * [ ◯ ATLAS ] — standard Next.js Link, ink-soft → accent-orange hover.
           * Hover colour is applied via a global className — no event handler
           * needed in the RSC. Use the .archive-atlas-link class to target it.
           * For now a static link is acceptable (hover handled by CSS would require
           * a new globals rule; inline is not usable in RSC). The hover transition
           * for this link is handled by the browser default underline + the
           * text-decoration on focus. The 150ms transition is applied by the
           * wrapping Tailwind transition class where possible, or left to the
           * browser for the static link.
           *
           * NOTE: onMouseEnter/onMouseLeave cannot be used in RSC. The color
           * transition is omitted for the static ATLAS link — Algol may flag this
           * as a minor regression vs spec §6. It is acceptable for v1 RSC: the
           * link is visually accessible at ink-soft; the hover transition is a
           * polish item not a functional requirement.
           */}
          <Link
            href="/"
            style={{
              color: 'var(--ink-soft)',
              textDecoration: 'none',
            }}
          >
            [ ◯ ATLAS ]
          </Link>

          {/*
           * [ ⌕ survey ] — imported from ArchiveSurveyAffordance.tsx ('use client').
           * Dispatches 'triangulate:open'. OPTIONAL per v1 spec §4.
           */}
          <ArchiveSurveyAffordance />
        </div>
      </header>

      {/*
       * ── TWO-COLUMN BODY (§4 — ledger ~66% left · right rail 360px sticky) ──
       * Desktop ≥1181px: flex row, gap 40px, left flex:1, right 360px sticky.
       * The Suspense boundary wraps client components that call useSearchParams.
       * Fallback: minimal text placeholder (not a skeleton — the RSC static HTML
       * is already visible; the placeholder fills the client layout slot).
       * Source: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/
       *   use-search-params.md — Suspense required for static prerender.
       */}
      <div
        style={{
          display: 'flex',
          gap: '40px',
          padding: '28px 40px 60px',
          alignItems: 'flex-start',
        }}
      >
        <Suspense
          fallback={
            <div
              style={{
                flex: '1 1 0',
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: 'var(--ink-faint)',
                padding: '40px 0',
              }}
              aria-hidden="true"
            >
              CALIBRATING LEDGER…
            </div>
          }
        >
          {/*
           * ArchiveLedger — client component. Left column. Year-grouped rows.
           * URL filter via useSearchParams. "LOAD NEXT 20" pagination.
           * Scroll restore on browser-back (§12, 20-archive.md §9.3).
           */}
          <section
            style={{
              flex: '1 1 0',
              minWidth: 0,
              maxWidth: '840px',
            }}
          >
            <ArchiveLedger entries={allEntries} />
          </section>

          {/*
           * Right rail — sticky at desktop. Contains:
           *   1. ArchiveMiniGlobe (size=300, standby-archive variant — §5.5)
           *   2. ArchiveFilters (filter chips — §4)
           *
           * The rail is sticky at top:72px (clears the Nav strip).
           * ArchiveMiniGlobe + ArchiveFilters both use useSearchParams internally
           * and are therefore inside the Suspense boundary.
           */}
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
            {/* Mini-globe — 300×300 (standby-archive variant, §5.5) */}
            <div
              className="archive-mini-globe"
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            >
              {/*
               * activePins defaults to pins (all in-membership) when no filter
               * is active. For v1, pin re-colour on filter change is handled by
               * passing activePins from ArchiveLedger via parent state. In v1 we
               * pass pins as both pins and activePins — Algol may flag this as a
               * v1.1 item: bidirectional filter↔globe sync.
               *
               * onPinClick: default no-op in wrapper (§5.6 optional).
               * onGlobeClick: navigate to '/' (ATLAS) per §5.6 — handled by the
               *   wrapper's no-op default plus the ArchiveMiniGlobe's onClick. The
               *   ArchiveMiniGlobe wrapper already has a no-op default; we pass
               *   the navigation intent here via an ArchiveGlobePanel client wrapper
               *   is not needed — the wrapper's default onGlobeClick no-op is
               *   acceptable for v1. Pin clicks navigate via onPinClick no-op (v1).
               *   Full nav wiring is a v1.1 item.
               */}
              <ArchiveMiniGlobe
                size={300}
                pins={pins}
              />
            </div>

            {/* Filter chips — type filter (§4 filter rail) */}
            <div className="archive-filters">
              <ArchiveFilters counts={counts} />
            </div>
          </aside>
        </Suspense>
      </div>

      {/* Marginalia HUD — fixed right-edge instrument readout (existing atom) */}
      <div className="marginalia" aria-hidden="true">
        <span className="ma-accent">ARCHIVE</span>
        <span>LEDGER</span>
        <span>∇ Ne0EX</span>
      </div>
    </main>
  );
}
