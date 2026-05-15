/**
 * lib/content/articles.ts
 * -----------------------
 * Article query helpers. Build-time safe — all functions return from the
 * velite cache which is generated at build. No runtime I/O.
 *
 * Owner: Procyon (α-IDX-03) · TASK-2026-05-15-22
 */
import type { Article } from './types'

// Import from the velite-generated cache.
// '.velite' is created by `npm run content:build` or the webpack plugin.
// This import is intentionally a dynamic path resolved at build time.
let _articles: Article[] | null = null

async function loadArticles(): Promise<Article[]> {
  if (_articles) return _articles
  // Dynamic import lets Next.js server components call this at build time
  // without requiring a top-level module-level side effect.
  const cache = await import('../../.velite')
  _articles = cache.articles as Article[]
  return _articles
}

/** All articles, sorted newest-first by isoDate. */
export async function getArticles(): Promise<Article[]> {
  const articles = await loadArticles()
  return [...articles].sort((a, b) => b.isoDate.localeCompare(a.isoDate))
}

/** Lookup a single article by its zero-padded fileNum (e.g. "003"). */
export async function getArticleByFileNum(fileNum: string): Promise<Article | undefined> {
  const articles = await loadArticles()
  return articles.find((a) => a.fileNum === fileNum)
}

/**
 * Recent articles for ChapterIndex and HeroBlock counts.
 * Replaces the RECENT_ENTRIES hardcoded array in lib/entries.ts (TASK-25).
 */
export async function getRecentArticles(limit = 4): Promise<Article[]> {
  const articles = await getArticles()
  return articles.slice(0, limit)
}

/**
 * Related articles: share at least one tag with the given article,
 * sorted by tag-overlap count descending, then by isoDate descending.
 * Excludes the source article itself.
 */
export async function getRelatedArticles(source: Article, limit = 3): Promise<Article[]> {
  const all = await getArticles()
  const sourceTags = new Set(source.tags)

  return all
    .filter((a) => a.fileNum !== source.fileNum)
    .map((a) => ({
      article: a,
      overlap: a.tags.filter((t) => sourceTags.has(t)).length,
    }))
    .filter(({ overlap }) => overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || b.article.isoDate.localeCompare(a.article.isoDate))
    .slice(0, limit)
    .map(({ article }) => article)
}
