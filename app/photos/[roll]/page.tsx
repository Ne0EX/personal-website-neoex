/**
 * app/photos/[roll]/page.tsx — server component (dynamic route)
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders the /photos/<roll> contact sheet.
 *
 * S3 store-as-source: roll body read from rolls table via getRollBody()
 * instead of fs.readFile. A null return means no rolls row → 404.
 * An empty string is a valid roll body (chiang-mai comment-only body = '').
 *
 * Spec §6.3: getRollBody(roll): null = unknown roll → notFound().
 *
 * Owner: Sirius (α-SUR-01) · S1 roll-index / Procyon S3 swap
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

// ─────────────────────────────────────────────────────────────────────────────
// Static generation — pre-render all known roll slugs at build time.
// ─────────────────────────────────────────────────────────────────────────────
export async function generateStaticParams() {
  const sidecars = await getPhotoSidecars()
  const rollSet = new Set(sidecars.map((s) => s.roll))
  return Array.from(rollSet).map((roll) => ({ roll }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared build helper — resolves roll contacts or returns null for 404.
// S3: roll body from the store (rolls table); null = unknown roll → 404.
// Empty string is valid (chiang-mai comment-stripped body = '').
// ─────────────────────────────────────────────────────────────────────────────
async function buildContacts(roll: string) {
  const body = await getRollBody(roll)
  // null = no rolls row for this slug → unknown roll → 404
  if (body === null) return null
  // body === '' is valid (empty roll prose body)
  const contacts = await getRollContacts(roll, body)
  return contacts
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-roll metadata
// ─────────────────────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ roll: string }>
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

// ─────────────────────────────────────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────────────────────────────────────
export default async function PhotoRollPage({
  params,
}: {
  params: Promise<{ roll: string }>
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
