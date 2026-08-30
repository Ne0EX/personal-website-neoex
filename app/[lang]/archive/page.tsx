/**
 * app/[lang]/archive/page.tsx — SERVER COMPONENT (NO 'use client')
 * ─────────────────────────────────────────────────────────────────────────────
 * Moved from app/archive/page.tsx (bilingual P3 refactor).
 *
 * CRITICAL RSC CONSTRAINT: This file MUST remain a Server Component.
 * The <main data-pagefind-body> element emitted here is the static HTML that
 * scripts/inject-pagefind-sidecar.ts reads for pagefind indexing. If this
 * file becomes a Client Component, pagefind sees no body content.
 *
 * The [lang] param is available but the archive ledger v1 chrome stays English
 * (DL3 / OQ6 — chrome i18n deferred). The archive content itself (article titles
 * etc.) is monolingual in v1.
 *
 * Owner: Altair (α-BND-02) · bilingual P3
 */

import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import {
  getArchiveEntries,
  getArchiveEntriesByYear,
  getMiniGlobePins,
} from '@/lib/content'
import { ArchiveClient } from '@/components/ArchiveClient'
import { ArchiveSurveyAffordance } from '@/components/ArchiveSurveyAffordance'
import { Nav } from '@/components/Nav'
import type { ArchiveEntry } from '@/lib/content'

export const metadata: Metadata = {
  title: 'Archive Ledger · Worldline · ∇ Neospirit',
  description:
    'A surveyed inventory of all traces — articles, photographs, and fiction transmissions — ordered by most-recently-patched survey date.',
}

function deriveFilterCountsServer(
  entries: ArchiveEntry[],
): { all: number; article: number; photo: number; fiction: number } {
  let article = 0
  let photo = 0
  let fiction = 0
  for (const e of entries) {
    if (e.kind === 'article') article++
    else if (e.kind === 'photo') photo++
    else fiction++
  }
  return { all: entries.length, article, photo, fiction }
}

export default async function ArchivePage() {
  const allEntries = await getArchiveEntries()
  const byYear = await getArchiveEntriesByYear(allEntries)
  const pins = getMiniGlobePins(allEntries)
  const counts = deriveFilterCountsServer(allEntries)
  const sidecarEntries = allEntries
  const totalCount = allEntries.length
  const yearKeys = Object.keys(byYear)
    .map(Number)
    .sort((a, b) => b - a)
  const patchCount = yearKeys.length

  return (
    <main
      data-page="archive"
      data-pagefind-body
      data-pagefind-meta="title:ARCHIVE LEDGER,type:archive"
      data-pagefind-ignore="nav header footer .archive-filters .archive-mini-globe"
      className="paper-canvas"
      style={{ minHeight: '100vh' }}
    >
      <div className="scroll-meter" aria-hidden="true" />
      <Nav />
      <a href="#archive-ledger" className="wl-skip-link">
        Skip to archive ledger
      </a>
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
      <header
        style={{
          position: 'relative',
          padding: '24px 40px 20px',
          borderBottom: '1px dashed var(--ink-dashed)',
        }}
      >
        <div className="corner-marks" aria-hidden="true" />
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
        <div className="t-meta" style={{ marginBottom: '10px' }}>
          <span style={{ color: 'var(--accent-orange)' }}>∇ Ne0EX</span>
          <span style={{ color: 'var(--ink-soft)' }}>
            {' · DRIFT MIN +0.00 · DRIFT MAX –2.40 · α '}
            <span style={{ color: 'var(--accent-orange)' }}>1.130426</span>
          </span>
        </div>
        <div
          className="t-meta"
          style={{ display: 'flex', alignItems: 'center', gap: '16px' }}
        >
          <Link
            href="/"
            className="archive-atlas-link"
            style={{ color: 'var(--ink-soft)', textDecoration: 'none' }}
          >
            [ ◯ ATLAS ]
          </Link>
          <ArchiveSurveyAffordance />
        </div>
      </header>
      <div className="archive-body">
        <Suspense
          fallback={
            <div
              style={{
                gridColumn: '1 / 2',
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
          <ArchiveClient entries={allEntries} pins={pins} counts={counts} />
        </Suspense>
      </div>
      <div className="marginalia" aria-hidden="true">
        <span className="ma-accent">ARCHIVE</span>
        <span>LEDGER</span>
        <span>∇ Ne0EX</span>
      </div>
    </main>
  )
}
