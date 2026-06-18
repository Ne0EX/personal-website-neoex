/**
 * app/[lang]/photos/page.tsx — server component
 * ─────────────────────────────────────────────────────────────────────────────
 * Moved from app/photos/page.tsx (bilingual P3 refactor).
 * Photos are monolingual (PD5 — a photo does not "translate"; caption is
 * language-neutral). The [lang] param is received but not used for content.
 *
 * Design reference: docs/design/SPEC-2026-06-14-photo-gallery.md (Betelgeuse)
 * Owner: Altair (α-BND-02) · bilingual P3
 */

import type { Metadata } from 'next'
import { PageShell } from '@/components/PageShell'
import { Nav } from '@/components/Nav'
import { MarginaliaHUD, ScrollMeter } from '@/components/MarginaliaHUD'
import { CornerMarks } from '@/components/CornerMarks'
import { GalleryGrid, type GalleryRollGroup, type GalleryView } from '@/components/GalleryGrid'
import { getPhotoSidecars } from '@/lib/content/photos'
import type { PhotoSidecar } from '@/lib/content/types'

export const metadata: Metadata = {
  title: 'Photographs · Worldline · ∇ Neospirit',
  description:
    'A gallery of photographs from the A.T.L.A.S. archive. Browse by roll, then go deeper into any frame.',
}

function groupByRoll(sidecars: PhotoSidecar[]): GalleryRollGroup[] {
  const rollMap = new Map<string, PhotoSidecar[]>()
  for (const sidecar of sidecars) {
    const existing = rollMap.get(sidecar.roll)
    if (existing) {
      existing.push(sidecar)
    } else {
      rollMap.set(sidecar.roll, [sidecar])
    }
  }

  const rollLatestDate = (photos: PhotoSidecar[]) =>
    photos.reduce((max, p) => (p.isoDate > max ? p.isoDate : max), '')

  const groups: GalleryRollGroup[] = Array.from(rollMap.entries())
    .sort(([, a], [, b]) => rollLatestDate(b).localeCompare(rollLatestDate(a)))
    .map(([roll, photos]) => ({
      roll,
      photos: photos.map((s) => ({
        roll: s.roll,
        id: s.id,
        caption: s.caption,
        date: s.isoDate.replace(/-/g, '.'),
        variants: s.variants,
      })),
    }))

  return groups
}

interface PhotosPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function PhotosIndexPage({ searchParams }: PhotosPageProps) {
  const params = await searchParams
  const rawView = Array.isArray(params.view) ? params.view[0] : params.view
  const view: GalleryView =
    rawView === 'flat' ? 'flat'
    : rawView === 'place' ? 'place'
    : 'timeline'

  const sidecars = await getPhotoSidecars()
  const rollGroups = groupByRoll(sidecars)
  const totalFrames = sidecars.length
  const totalRolls = rollGroups.length

  return (
    <PageShell>
      <main className="paper-canvas min-h-screen overflow-hidden pr-7">
        <CornerMarks />
        <ScrollMeter />
        <MarginaliaHUD />
        <Nav />

        <a href="#gallery-grid" className="wl-skip-link">
          Skip to gallery
        </a>

        <div
          style={{
            position: 'relative',
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '0 32px 48px',
          }}
        >
          <GalleryGrid
            rollGroups={rollGroups}
            initialView={view}
            sidecars={sidecars}
            totalFrames={totalFrames}
            totalRolls={totalRolls}
          />

          <footer
            aria-label="Gallery summary"
            style={{
              marginTop: '48px',
              paddingTop: '12px',
              borderTop: '1px solid var(--ink-hairline)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--meta-size)',
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: 'var(--ink-faint)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <span>
              {String(totalFrames).padStart(2, '0')} FRAME{totalFrames !== 1 ? 'S' : ''} DOCUMENTED
            </span>
            <span>WORLDLINE · 1.130426</span>
          </footer>
        </div>
      </main>
    </PageShell>
  )
}
