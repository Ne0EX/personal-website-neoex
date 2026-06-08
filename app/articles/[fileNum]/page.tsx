/**
 * app/articles/[fileNum]/page.tsx — server component (dynamic route)
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders a single article entry at /articles/<fileNum>.
 *
 * Route: [fileNum] = zero-padded 3-digit article identifier (e.g. "001").
 * params is a Promise in this Next.js version — must be awaited.
 * Docs: node_modules/next/dist/docs/01-app/03-api-reference/04-functions/
 *   generate-static-params.md
 *
 * Static generation: generateStaticParams() returns all article fileNums
 * from the velite articles cache so every known article is pre-rendered
 * at build time.
 *
 * 404: notFound() when the fileNum does not resolve in the articles cache.
 *
 * Chrome reuse: via EntryShell (which mounts PageShell, Nav, MarginaliaHUD,
 * ScrollMeter, CornerMarks). No re-derivation of global atoms.
 *
 * Design spec:  docs/design/12-entry-routes.md (Betelgeuse · α-VIS-04)
 * Vision lock:  docs/team/VISION-2026-05-31-search-lineage-console.md §1.3 S2
 * Owner: Sirius (α-SUR-01) · S2 article-entry (VISION-2026-05-31)
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { ArticleEntry } from '@/components/ArticleEntry'
import { getArticles, getArticleByFileNum } from '@/lib/content'
import { isHiddenFromPublic } from '@/lib/content/visibility'

// ─────────────────────────────────────────────────────────────────────────────
// Static generation — pre-render all known article fileNums at build time.
// ─────────────────────────────────────────────────────────────────────────────
export async function generateStaticParams() {
  const articles = await getArticles()
  return articles.map((a) => ({ fileNum: a.fileNum }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-article metadata
// params is a Promise in this Next.js version — await before destructuring.
// ─────────────────────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ fileNum: string }>
}): Promise<Metadata> {
  const { fileNum } = await params
  const article = await getArticleByFileNum(fileNum)

  if (!article || isHiddenFromPublic(article)) {
    return { title: 'Article Not Found · Worldline' }
  }

  return {
    title: `${article.title} · FILE ${fileNum} · Worldline · ∇ Neospirit`,
    description: article.summary,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page component
// params is a Promise in this Next.js version — await before destructuring.
// ─────────────────────────────────────────────────────────────────────────────
export default async function ArticlePage({
  params,
}: {
  params: Promise<{ fileNum: string }>
}) {
  // params is a Promise in this Next.js version — await before destructuring.
  const { fileNum } = await params

  const article = await getArticleByFileNum(fileNum)

  // 404 when fileNum does not resolve OR entry is a draft in production.
  if (!article || isHiddenFromPublic(article)) {
    notFound()
  }

  return <ArticleEntry article={article} />
}
