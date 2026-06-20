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
import { PhotoSwipeViewer } from '@/components/PhotoSwipeViewer'
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

  // S4 (mobile-native): compute prev/next hrefs for swipe navigation.
  // URL shape mirrors the generateStaticParams output: /[lang]/photos/[roll]/[id].
  // lang is always 'en' for photos (monolingual, PD5 — photos use the same [lang]
  // segment for routing parity but do not localise content).
  const prevPhoto = sequenceIndex > 0 ? rollPhotos[sequenceIndex - 1] : null
  const nextPhoto = sequenceIndex < rollPhotos.length - 1 ? rollPhotos[sequenceIndex + 1] : null
  const prevHref = prevPhoto ? `/en/photos/${prevPhoto.roll}/${prevPhoto.id}` : null
  const nextHref = nextPhoto ? `/en/photos/${nextPhoto.roll}/${nextPhoto.id}` : null

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
          {/* S4: PhotoSwipeViewer is a client island that adds swipe-to-navigate on
              phone (<600px). Desktop (≥600px) renders children inert. The server
              PhotoEntry content (film-sim switcher + NETRA) is unchanged. */}
          <PhotoSwipeViewer prevHref={prevHref} nextHref={nextHref}>
            <PhotoEntry
              photo={photo}
              sequenceIndex={sequenceIndex >= 0 ? sequenceIndex : 0}
              rollTotal={rollTotal > 0 ? rollTotal : 1}
            />
          </PhotoSwipeViewer>

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
