/**
 * app/[lang]/photos/[roll]/page.tsx — server component (dynamic route)
 * ─────────────────────────────────────────────────────────────────────────────
 * Moved from app/photos/[roll]/page.tsx (bilingual P3 refactor).
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
import { RollIndex } from '@/components/RollIndex'

import {
  getPhotoSidecars,
  getRollBody,
  getRollContacts,
} from '@/lib/content/photos'

export async function generateStaticParams() {
  const sidecars = await getPhotoSidecars()
  const rollSet = new Set(sidecars.map((s) => s.roll))
  // photos are monolingual — only generate en params (proxy rewrites bare /photos/...
  // to /en/photos/...; /th/photos/... also resolves here via dynamicParams=true)
  return Array.from(rollSet).map((roll) => ({ lang: 'en', roll }))
}

async function buildContacts(roll: string) {
  const body = await getRollBody(roll)
  if (body === null) return null
  const contacts = await getRollContacts(roll, body)
  return contacts
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; roll: string }>
}): Promise<Metadata> {
  const { roll } = await params
  const contacts = await buildContacts(roll)

  if (!contacts) {
    return { title: 'Roll Not Found · Worldline' }
  }

  const { sidecars, dateRange } = contacts
  const frameCount = sidecars.length
  return {
    title: `${roll} · ${frameCount} frame${frameCount !== 1 ? 's' : ''} · Worldline · ∇ Neospirit`,
    description: `Contact sheet for roll ${roll}. ${frameCount} frame${frameCount !== 1 ? 's' : ''}${dateRange ? ', ' + dateRange : ''}. A.T.L.A.S. photo archive.`,
  }
}

export default async function PhotoRollPage({
  params,
}: {
  params: Promise<{ lang: string; roll: string }>
}) {
  const { roll } = await params

  const contacts = await buildContacts(roll)
  if (!contacts) {
    notFound()
  }

  return (
    <PageShell>
      <main className="paper-canvas min-h-screen overflow-hidden pr-7">
        <CornerMarks />
        <ScrollMeter />
        <MarginaliaHUD />
        <Nav />

        <a
          href="#roll-contact-sheet"
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
          Skip to contact sheet
        </a>

        <div
          id="roll-contact-sheet"
          style={{ marginTop: '14px', position: 'relative' }}
        >
          <RollIndex roll={roll} contacts={contacts} />
        </div>
      </main>
    </PageShell>
  )
}
