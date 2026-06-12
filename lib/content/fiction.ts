/**
 * lib/content/fiction.ts
 * ----------------------
 * Thin re-export of lib/store/reads — the velite cache is replaced by the
 * Supabase store (store-as-source S3, DL7).
 *
 * Public reads use the anon client (RLS = published only).
 * getAllFiction() is the console variant — see lib/store/admin-reads.ts.
 *
 * Owner: Procyon (α-IDX-03) · store-as-source S3
 */

export {
  getFiction,
  getFictionBySlug,
  getFictionSiblings,
} from '../store/reads'

// NOTE: getAllFiction (admin, draft-inclusive) is NOT re-exported here.
// Import directly from '@/lib/store/admin-reads' in server-only contexts.

export type { Fiction } from './types'
