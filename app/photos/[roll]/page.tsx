/**
 * app/photos/[roll]/page.tsx — server component (dynamic route)
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders the /photos/<roll> contact sheet — a surveyed register of all
 * frames in a roll in capture sequence.
 *
 * Route: [roll] = one dynamic segment.
 * params is a Promise in this Next.js version — must be awaited.
 *
 * Static generation: generateStaticParams() returns all unique roll slugs
 * from the velite photoSidecars cache so every known roll is pre-rendered
 * at build time.
 *
 * 404: notFound() when the roll slug is not found in the sidecar cache.
 *
 * Closes the D3 "← back to roll" back-link gap:
 *   /photos/2026-05-bangkok/DSCF0002 → a[href="/photos/2026-05-bangkok"] → HERE
 *   Previously 404'd; this route makes the destination real.
 *
 * Roll lede: read directly from content/photos/<roll>/roll.mdx body at
 * build time via fs.readFile. The velite Photo schema does not parse the MDX
 * body — this is intentional (roll.mdx frontmatter only in the Photo collection).
 * Reading at build time is safe for SSG; no runtime filesystem reads.
 *
 * Chrome reuse: PageShell, Nav, MarginaliaHUD, ScrollMeter, CornerMarks —
 * same as homepage and photo-entry route. No re-derivation of atoms.
 *
 * Owner: Sirius (α-SUR-01) · S1 roll-index (VISION-2026-05-31)
 * Design spec: docs/design/11-photo-roll-index.md (Betelgeuse)
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { PageShell } from '@/components/PageShell'
import { Nav } from '@/components/Nav'
import { MarginaliaHUD, ScrollMeter } from '@/components/MarginaliaHUD'
import { CornerMarks } from '@/components/CornerMarks'
import { RollIndex } from '@/components/RollIndex'

import {
  getPhotoSidecars,
  getRollContacts,
} from '@/lib/content/photos'

// ─────────────────────────────────────────────────────────────────────────────
// Static generation — pre-render all known roll slugs at build time.
// Docs: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/
//   generate-static-params.md
// ─────────────────────────────────────────────────────────────────────────────
export async function generateStaticParams() {
  const sidecars = await getPhotoSidecars()
  // Derive unique roll slugs from sidecar records.
  const rollSet = new Set(sidecars.map((s) => s.roll))
  return Array.from(rollSet).map((roll) => ({ roll }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-roll metadata
// params is a Promise in this Next.js version — await before destructuring.
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
// Roll.mdx body reader — reads at build time (SSG), never at runtime.
// Returns empty string when roll.mdx does not exist or has no body.
// ─────────────────────────────────────────────────────────────────────────────
async function readRollMdxBody(roll: string): Promise<string> {
  // Content root is process.cwd()/content (matches velite config root: 'content')
  const rollMdxPath = path.join(process.cwd(), 'content', 'photos', roll, 'roll.mdx')
  try {
    const raw = await fs.readFile(rollMdxPath, 'utf-8')
    // Strip frontmatter (--- ... ---) and return only the body below it.
    const match = raw.match(/^---[\s\S]*?---\s*([\s\S]*)$/)
    return match ? match[1].trim() : ''
  } catch {
    // File missing or unreadable — return empty (no lede)
    return ''
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared build helper — resolves roll contacts or returns null for 404.
// ─────────────────────────────────────────────────────────────────────────────
async function buildContacts(roll: string) {
  const body = await readRollMdxBody(roll)
  const contacts = await getRollContacts(roll, body)
  // A roll with 0 sidecars AND no roll.mdx body means unknown slug → 404.
  // But a roll CAN have 0 frames (empty roll state) — still a valid 200.
  // We distinguish: if no sidecars AND roll.mdx doesn't exist (body read threw),
  // we treat that as unknown. However, roll.mdx existence is the true gate.
  // For now: 404 only when no sidecars for this roll AND no roll.mdx was found.
  // The roll.mdx readFile above returns '' on missing file; sidecars will be empty too.
  // Check: do we know this roll at all?
  const sidecars = await import('@/lib/content/photos').then((m) => m.getSidecarsInRoll(roll))
  if (sidecars.length === 0 && body === '') {
    // Truly unknown roll — no sidecars and no roll.mdx
    // Check if the roll.mdx file actually exists (to allow empty-frame rolls)
    const rollMdxPath = path.join(process.cwd(), 'content', 'photos', roll, 'roll.mdx')
    try {
      await fs.access(rollMdxPath)
      // roll.mdx exists → valid roll (empty frames is allowed)
    } catch {
      return null // Unknown roll → 404
    }
  }
  return contacts
}

// ─────────────────────────────────────────────────────────────────────────────
// Page component
// params is a Promise in this Next.js version — await before destructuring.
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
      {/*
       * Production chrome reuse: PageShell, Nav, MarginaliaHUD, ScrollMeter,
       * CornerMarks — same as homepage and photo-entry route.
       * paper-canvas grain, pr-7 for marginalia gutter.
       */}
      <main className="paper-canvas min-h-screen overflow-hidden pr-7">
        <CornerMarks />
        <ScrollMeter />
        <MarginaliaHUD />
        <Nav />

        {/* Skip link — keyboard a11y */}
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

        {/* Roll contact sheet surface */}
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
