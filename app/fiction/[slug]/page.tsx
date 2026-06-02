/**
 * app/fiction/[slug]/page.tsx — server component (dynamic route)
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders a single fiction entry at /fiction/<slug>.
 *
 * Route: [slug] = kebab-case fiction slug (e.g. "transmission-001").
 * params is a Promise in this Next.js version — must be awaited.
 * Docs: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/
 *   generate-static-params.md
 *
 * Static generation: generateStaticParams() returns all fiction slugs
 * from the velite fiction cache so every known fiction entry is pre-rendered
 * at build time.
 *
 * 404: notFound() when the slug does not resolve in the fiction cache.
 *
 * Chrome reuse: via EntryShell (which mounts PageShell, Nav, MarginaliaHUD,
 * ScrollMeter, CornerMarks). No re-derivation of global atoms.
 *
 * Design spec:  docs/design/12-entry-routes.md (Betelgeuse · α-VIS-04)
 * Vision lock:  docs/team/VISION-2026-05-31-search-lineage-console.md §1.3 S2
 * Owner: Sirius (α-SUR-01) · S2 fiction-entry (VISION-2026-05-31)
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { FictionEntry } from '@/components/FictionEntry'
import { getFiction, getFictionBySlug } from '@/lib/content'

// ─────────────────────────────────────────────────────────────────────────────
// Static generation — pre-render all known fiction slugs at build time.
// ─────────────────────────────────────────────────────────────────────────────
export async function generateStaticParams() {
  const fiction = await getFiction()
  return fiction.map((f) => ({ slug: f.slug }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-fiction metadata
// params is a Promise in this Next.js version — await before destructuring.
// ─────────────────────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const fiction = await getFictionBySlug(slug)

  if (!fiction) {
    return { title: 'Fiction Not Found · Worldline' }
  }

  return {
    title: `${fiction.title} · NeX TRANSMISSION · Worldline · ∇ Neospirit`,
    description: fiction.summary,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page component
// params is a Promise in this Next.js version — await before destructuring.
// ─────────────────────────────────────────────────────────────────────────────
export default async function FictionPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  // params is a Promise in this Next.js version — await before destructuring.
  const { slug } = await params

  const fiction = await getFictionBySlug(slug)

  // 404 when slug does not resolve.
  if (!fiction) {
    notFound()
  }

  return <FictionEntry fiction={fiction} />
}
