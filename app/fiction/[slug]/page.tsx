/**
 * app/fiction/[slug]/page.tsx — server component (dynamic route)
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders a single fiction entry at /fiction/<slug>.
 *
 * S3 store-as-source: reads from lib/store/reads (anon client).
 * Draft gate: fiction.draft===true → notFound().
 * Unknown slug: getFictionBySlug returns undefined → notFound().
 * MDX body: passed via the FictionEntry body seam (DL4).
 *
 * Owner: Sirius (α-SUR-01) · S2 fiction-entry / Procyon S3 body-seam
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { FictionEntry } from '@/components/FictionEntry'
import { getFiction, getFictionBySlug } from '@/lib/content'
import { renderMdxBody } from '@/lib/store/mdx'

// ─────────────────────────────────────────────────────────────────────────────
// Static generation — pre-render all published fiction slugs at build time.
// ─────────────────────────────────────────────────────────────────────────────
export async function generateStaticParams() {
  const fiction = await getFiction()
  return fiction.map((f) => ({ slug: f.slug }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-fiction metadata
// ─────────────────────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const fiction = await getFictionBySlug(slug)

  if (!fiction || fiction.draft) {
    return { title: 'Fiction Not Found · Worldline' }
  }

  return {
    title: `${fiction.title} · NeX TRANSMISSION · Worldline · ∇ Neospirit`,
    description: fiction.summary,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────────────────────────────────────
export default async function FictionPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const fiction = await getFictionBySlug(slug)

  // notFound() covers: unknown slug, deleted entry, draft in public.
  if (!fiction || fiction.draft) {
    notFound()
  }

  // DL4: render MDX body from the store
  const body = await renderMdxBody(fiction.body)

  return <FictionEntry fiction={fiction} body={body} />
}
