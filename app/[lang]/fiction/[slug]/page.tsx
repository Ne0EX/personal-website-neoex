/**
 * app/[lang]/fiction/[slug]/page.tsx — server component (dynamic route)
 * ─────────────────────────────────────────────────────────────────────────────
 * Moved from app/fiction/[slug]/page.tsx (bilingual P3 refactor).
 * Receives [lang] from the parent segment and threads it into the read.
 *
 * Fiction follows the same translation model as articles (§3.5 SPEC):
 *   - opt-in fallback: if no Thai sibling exists, serves the en sibling
 *   - hreflang (PD3): only advertise languages with a real published sibling
 *
 * Owner: Altair (α-BND-02) · bilingual P3
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { FictionEntry } from '@/components/FictionEntry'
import { getFiction, getFictionBySlug } from '@/lib/content'
import { renderMdxBody } from '@/lib/store/mdx'
import { anonClient } from '@/lib/store/supabase/anon'

const SUPPORTED_LOCALES = ['en', 'th'] as const

async function getExistingLangsForFiction(slug: string): Promise<string[]> {
  const { data, error } = await anonClient
    .from('entries')
    .select('lang')
    .eq('kind', 'fiction')
    .eq('slug', slug)
    .eq('status', 'published')

  if (error) return ['en']
  return (data ?? []).map((r: { lang: string }) => r.lang)
}

// ─────────────────────────────────────────────────────────────────────────────
// Static generation — en: all fiction; th: only where a Thai sibling exists.
// ─────────────────────────────────────────────────────────────────────────────
export async function generateStaticParams() {
  const enFiction = await getFiction('en')
  const params: Array<{ lang: string; slug: string }> = []

  for (const f of enFiction) {
    params.push({ lang: 'en', slug: f.slug })
  }

  const { data: thRows } = await anonClient
    .from('entries')
    .select('slug')
    .eq('kind', 'fiction')
    .eq('status', 'published')
    .eq('lang', 'th')

  const thSlugs = new Set((thRows ?? []).map((r: { slug: string }) => r.slug))
  for (const slug of thSlugs) {
    params.push({ lang: 'th', slug })
  }

  return params
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-fiction metadata (includes hreflang — PD3)
// ─────────────────────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>
}): Promise<Metadata> {
  const { lang, slug } = await params
  const requestedLang = SUPPORTED_LOCALES.includes(lang as typeof SUPPORTED_LOCALES[number])
    ? lang
    : 'en'
  const fiction = await getFictionBySlug(slug, requestedLang)

  if (!fiction || fiction.draft) {
    return { title: 'Fiction Not Found · Worldline' }
  }

  const existingLangs = await getExistingLangsForFiction(slug)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://worldline.neoex.com'
  const enUrl = `${siteUrl}/fiction/${slug}`
  const thUrl = `${siteUrl}/th/fiction/${slug}`

  const alternates: Metadata['alternates'] = {
    canonical: requestedLang === 'en' ? enUrl : thUrl,
    languages: { 'x-default': enUrl },
  }
  if (existingLangs.includes('en')) alternates.languages!['en'] = enUrl
  if (existingLangs.includes('th')) alternates.languages!['th'] = thUrl

  return {
    title: `${fiction.title} · NeX TRANSMISSION · Worldline · ∇ Neospirit`,
    description: fiction.summary,
    alternates,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────────────────────────────────────
export default async function FictionPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>
}) {
  const { lang, slug } = await params
  const requestedLang = SUPPORTED_LOCALES.includes(lang as typeof SUPPORTED_LOCALES[number])
    ? lang
    : 'en'

  const fiction = await getFictionBySlug(slug, requestedLang)

  if (!fiction || fiction.draft) {
    notFound()
  }

  const body = await renderMdxBody(fiction.body)

  return <FictionEntry fiction={fiction} body={body} />
}
