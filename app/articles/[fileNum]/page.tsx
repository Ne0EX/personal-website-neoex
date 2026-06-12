/**
 * app/articles/[fileNum]/page.tsx — server component (dynamic route)
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders a single article entry at /articles/<fileNum>.
 *
 * S3 store-as-source: reads from lib/store/reads (anon client) instead of
 * the velite cache. generateStaticParams enumerates published articles from
 * the store at build time. dynamicParams=true (default) → a post-deploy
 * published article renders on first visit and is then cached (DL11).
 *
 * Draft gate: article.draft===true → notFound() (DL2: no dev-preview mode).
 * Deleted/unknown slug: getArticleByFileNum returns undefined → notFound().
 *
 * MDX body: passed via the ArticleEntry body seam (DL4).
 *
 * Owner: Sirius (α-SUR-01) · S2 article-entry / Procyon S3 body-seam
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

import { ArticleEntry } from '@/components/ArticleEntry'
import { getArticles, getArticleByFileNum } from '@/lib/content'
import { renderMdxBody } from '@/lib/store/mdx'

// ─────────────────────────────────────────────────────────────────────────────
// Static generation — pre-render all published articles at build time.
// ─────────────────────────────────────────────────────────────────────────────
export async function generateStaticParams() {
  const articles = await getArticles()
  return articles.map((a) => ({ fileNum: a.fileNum }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-article metadata
// ─────────────────────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ fileNum: string }>
}): Promise<Metadata> {
  const { fileNum } = await params
  const article = await getArticleByFileNum(fileNum)

  if (!article || article.draft) {
    return { title: 'Article Not Found · Worldline' }
  }

  return {
    title: `${article.title} · FILE ${fileNum} · Worldline · ∇ Neospirit`,
    description: article.summary,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────────────────────────────────────
export default async function ArticlePage({
  params,
}: {
  params: Promise<{ fileNum: string }>
}) {
  const { fileNum } = await params

  const article = await getArticleByFileNum(fileNum)

  // notFound() covers: unknown slug, deleted entry, draft in public.
  if (!article || article.draft) {
    notFound()
  }

  // DL4: render MDX body from the store (falls back to null → ArticleEntry shows placeholder)
  const body = await renderMdxBody(article.body)

  return <ArticleEntry article={article} body={body} />
}
