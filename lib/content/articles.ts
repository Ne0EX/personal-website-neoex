/**
 * lib/content/articles.ts
 * -----------------------
 * Thin re-export of lib/store/reads — the velite cache is replaced by the
 * Supabase store (store-as-source S3, DL7).
 *
 * Public reads use the anon client (RLS = published only).
 * getAllArticles() is the console variant — see lib/store/admin-reads.ts.
 * Import sites do NOT change: they still import from '@/lib/content'.
 *
 * Draft visibility: public reads return published rows only (RLS enforces).
 * isHiddenFromPublic() is a no-op shim on public paths (DL2).
 * getArticleByFileNum() returns the row regardless of status;
 * public routes call notFound() when draft===true.
 *
 * Owner: Procyon (α-IDX-03) · store-as-source S3
 */

export {
  getArticles,
  getArticleByFileNum,
  getRecentArticles,
  getRelatedArticles,
  getPublishedArticleCount,
  getNextEntries,
} from '../store/reads'

export type { NextEntry } from '../store/reads'

// NOTE: getAllArticles (admin, draft-inclusive) is NOT re-exported here.
// Import directly from '@/lib/store/admin-reads' in server-only contexts
// (console page, entry-lifecycle-core) to avoid dragging server.ts into
// client bundles via this module.

export type { Article } from './types'
