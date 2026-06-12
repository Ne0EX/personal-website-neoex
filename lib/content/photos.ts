/**
 * lib/content/photos.ts
 * ---------------------
 * Thin re-export of lib/store/reads — the velite cache is replaced by the
 * Supabase store (store-as-source S3, DL7).
 *
 * Two collections served:
 *   Photo (roll descriptors) — from rolls table via mapRoll
 *   PhotoSidecar (per-photo) — from entries where kind='photo' + photo_assets
 *
 * Privacy: getGlobeEligiblePhotos() is DB-enforced (share_location=true + served_coords).
 * DL13: served_coords is the only coords anon sees (column grants + trigger).
 *
 * RollContacts interface kept for Sirius (app/photos/[roll]/page.tsx) compat.
 *
 * Owner: Procyon (α-IDX-03) · store-as-source S3
 */

export {
  getPhotos,
  getPhotosByRoll,
  getPhotoSidecars,
  getSidecarsInRoll,
  getPhotoById,
  getPhotoByRollAndId,
  getRollNavigation,
  getRollContacts,
  getGlobeEligiblePhotos,
  getRollBody,
} from '../store/reads'

// NOTE: getAllPhotoSidecars (admin, draft-inclusive) is NOT re-exported here.
// Import directly from '@/lib/store/admin-reads' in server-only contexts.

export type { RollContacts } from '../store/reads'
export type { Photo, PhotoSidecar } from './types'
