/**
 * app/[lang]/articles/[fileNum]/page.tsx — server component (dynamic route)
 * ─────────────────────────────────────────────────────────────────────────────
 * Moved from app/articles/[fileNum]/page.tsx (bilingual P3 refactor).
 * Now receives [lang] from the parent segment and threads it into the read.
 *
 * Routing (SPEC §4.2):
 *   /articles/002     → proxy rewrites internally to /en/articles/002 → lang='en'
 *   /th/articles/002  → lang='th', served from the Thai sibling if it exists,
 *                       else falls back to the English sibling (§3.2 opt-in fallback)
 *
 * hreflang (PD3 / SPEC §4.3):
 *   Each article page emits <link rel="alternate"> ONLY for languages that
 *   actually exist for that article + x-default → the en (authored-fallback) URL.
 *   A fallback is NOT advertised as a real translation.
 *
 * generateStaticParams (SPEC §4.3):
 *   Cross-product of locales × published articles, honouring opt-in:
 *   - every article at lang='en' (authored, always exists)
 *   - each article at lang='th' ONLY if a published Thai sibling exists
 *   dynamicParams remains true (default) so an untranslated article at /th/...
 *   renders at request time via the P2 fallback (serving English text in lang="en"
 *   region).
 *
 * Draft gate: article.draft===true → notFound()
 * Unknown slug: getArticleByFileNum returns undefined → notFound()
 *
 * Owner: Altair (α-BND-02) · bilingual P3
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { ArticleEntry } from '@/components/ArticleEntry'
import { getArticles, getArticleByFileNum, getNextEntries, getPublishedArticleCount } from '@/lib/content'
import { renderMdxBody } from '@/lib/store/mdx'
import { anonClient } from '@/lib/store/supabase/anon'

// ─────────────────────────────────────────────────────────────────────────────
// Supported locales — kept in sync with proxy.ts SUPPORTED_LOCALES
// ─────────────────────────────────────────────────────────────────────────────
const SUPPORTED_LOCALES = ['en', 'th'] as const

// ─────────────────────────────────────────────────────────────────────────────
// Helper: fetch the set of languages that ACTUALLY exist for an article.
// Used for hreflang (PD3) — we only advertise languages with a real sibling.
// ─────────────────────────────────────────────────────────────────────────────
async function getExistingLangsForArticle(fileNum: string): Promise<string[]> {
  const { data, error } = await anonClient
    .from('entries')
    .select('lang')
    .eq('kind', 'article')
    .eq('slug', fileNum)
    .eq('status', 'published')

  if (error) return ['en'] // safe fallback — always advertise en
  return (data ?? []).map((r: { lang: string }) => r.lang)
}

// ─────────────────────────────────────────────────────────────────────────────
// Static generation — cross-product of locales × published articles.
// en: all articles (authored, always exist).
// th: only articles that have a published Thai sibling.
// ─────────────────────────────────────────────────────────────────────────────
export async function generateStaticParams() {
  // Fetch all published en articles (the authoritative list of article identities).
  const enArticles = await getArticles('en')
  const params: Array<{ lang: string; fileNum: string }> = []

  // All articles always have an en param.
  for (const a of enArticles) {
    params.push({ lang: 'en', fileNum: a.fileNum })
  }

  // th: only where a published Thai sibling exists.
  // Fetch all published th rows in a single query.
  const { data: thRows } = await anonClient
    .from('entries')
    .select('slug')
    .eq('kind', 'article')
    .eq('status', 'published')
    .eq('lang', 'th')

  const thSlugs = new Set((thRows ?? []).map((r: { slug: string }) => r.slug))
  for (const slug of thSlugs) {
    params.push({ lang: 'th', fileNum: slug })
  }

  return params
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-article metadata (includes hreflang — PD3)
// ─────────────────────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; fileNum: string }>
}): Promise<Metadata> {
  const { lang, fileNum } = await params
  const requestedLang = SUPPORTED_LOCALES.includes(lang as typeof SUPPORTED_LOCALES[number])
    ? lang
    : 'en'
  const article = await getArticleByFileNum(fileNum, requestedLang)

  if (!article || article.draft) {
    return { title: 'Article Not Found · Worldline' }
  }

  // Build hreflang alternates (PD3): only for languages that ACTUALLY exist.
  const existingLangs = await getExistingLangsForArticle(fileNum)

  // Base URL — use NEXT_PUBLIC_SITE_URL if set, else relative.
  // hreflang requires absolute URLs for full SEO benefit.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://worldline.neoex.com'
  const enUrl = `${siteUrl}/articles/${fileNum}`
  const thUrl = `${siteUrl}/th/articles/${fileNum}`

  const alternates: Metadata['alternates'] = {
    // x-default always points at the en (authored-fallback) URL.
    canonical: requestedLang === 'en' ? enUrl : thUrl,
    languages: {
      'x-default': enUrl,
    },
  }

  // Only advertise a language if a real sibling exists for it.
  if (existingLangs.includes('en')) {
    alternates.languages!['en'] = enUrl
  }
  if (existingLangs.includes('th')) {
    alternates.languages!['th'] = thUrl
  }

  return {
    title: `${article.title} · FILE ${fileNum} · Worldline · ∇ Neospirit`,
    description: article.summary,
    alternates,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────────────────────────────────────
export default async function ArticlePage({
  params,
}: {
  params: Promise<{ lang: string; fileNum: string }>
}) {
  const { lang, fileNum } = await params

  // Guard: unknown lang segment → treat as en (proxy should have caught this,
  // but dynamicParams=true means unexpected segments can reach here).
  const requestedLang = SUPPORTED_LOCALES.includes(lang as typeof SUPPORTED_LOCALES[number])
    ? lang
    : 'en'

  const article = await getArticleByFileNum(fileNum, requestedLang)

  // notFound() covers: unknown slug, deleted entry, draft in public.
  if (!article || article.draft) {
    notFound()
  }

  // DL4: render MDX body from the store (falls back to null → ArticleEntry shows placeholder)
  // SPEC 1+2: run getNextEntries + getPublishedArticleCount in parallel with the body render.
  // All three are independent reads — no sequential dependency.
  const [body, nextEntries, articlesCount] = await Promise.all([
    renderMdxBody(article.body),
    getNextEntries(article, requestedLang),
    getPublishedArticleCount(requestedLang),
  ])

  return <ArticleEntry article={article} body={body} nextEntries={nextEntries} articlesCount={articlesCount} />
}
