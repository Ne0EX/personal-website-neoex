/**
 * app/[lang]/photos/[roll]/[id]/page.tsx — server component (dynamic route)
 * ─────────────────────────────────────────────────────────────────────────────
 * Moved from app/photos/[roll]/[id]/page.tsx (bilingual P3 refactor).
 * Photos are monolingual (PD5). The [lang] param is received but not used.
 *
 * Owner: Altair (α-BND-02) · bilingual P3
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { PageShell } from '@/components/PageShell'
import { Nav } from '@/components/Nav'
import { MarginaliaHUD, ScrollMeter } from '@/components/MarginaliaHUD'
import { CornerMarks } from '@/components/CornerMarks'
import { PhotoEntry } from '@/components/PhotoEntry'
import { WorldlineLinks } from '@/components/WorldlineLinks'

import {
  getPhotoSidecars,
  getPhotoByRollAndId,
  getSidecarsInRoll,
} from '@/lib/content/photos'

export async function generateStaticParams() {
  const sidecars = await getPhotoSidecars()
  // photos are monolingual — generate en only
  return sidecars.map((s) => ({ lang: 'en', roll: s.roll, id: s.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; roll: string; id: string }>
}): Promise<Metadata> {
  const { roll, id } = await params
  const photo = await getPhotoByRollAndId(roll, id)

  if (!photo || photo.draft) {
    return { title: 'Photo Not Found · Worldline' }
  }

  const titleParts = [id, roll, 'Worldline · ∇ Neospirit']
  return {
    title: titleParts.join(' · '),
    description: photo.caption ?? `Photo ${id} from roll ${roll}`,
  }
}

export default async function PhotoEntryPage({
  params,
}: {
  params: Promise<{ lang: string; roll: string; id: string }>
}) {
  const { roll, id } = await params

  const photo = await getPhotoByRollAndId(roll, id)

  if (!photo || photo.draft) {
    notFound()
  }

  const rollPhotos = await getSidecarsInRoll(roll)
  const sequenceIndex = rollPhotos.findIndex((s) => s.id === id)
  const rollTotal = rollPhotos.length

  return (
    <PageShell>
      <main className="paper-canvas min-h-screen overflow-hidden pr-7">
        <CornerMarks />
        <ScrollMeter />
        <MarginaliaHUD />
        <Nav />

        <a
          href="#photo-main"
          style={{
            position: 'absolute',
            left: '-9999px',
            zIndex: 100,
            padding: '4px 8px',
            background: 'var(--paper-warm)',
            color: 'var(--ink-primary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '9px',
          }}
          className="focus:left-2 focus:top-2"
        >
          Skip to photo
        </a>

        <div
          data-section="photo-entry"
          style={{ marginTop: '14px', position: 'relative' }}
        >
          <PhotoEntry
            photo={photo}
            sequenceIndex={sequenceIndex >= 0 ? sequenceIndex : 0}
            rollTotal={rollTotal > 0 ? rollTotal : 1}
          />

          <WorldlineLinks
            kind="photo"
            identifier={`${roll}/${id}`}
            title={photo.caption ?? id}
          />
        </div>
      </main>
    </PageShell>
  )
}
