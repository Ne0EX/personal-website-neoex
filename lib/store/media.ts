/**
 * lib/store/media.ts
 * ---------------------------------------------------------------------------
 * Storage URL helpers for the Supabase photos bucket.
 *
 * §4.2 object key scheme:
 *   photos/<roll>/<photo_id>/<size>-<sourceHash10>.<fmt>
 *
 * publicVariantUrl(key) → full CDN URL for an object in the public photos bucket.
 * Used by map.ts to assemble variant URLs before handing records to consumers.
 *
 * Owner: Procyon (α-IDX-03) · store-as-source S3
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

/**
 * Returns the public CDN URL for a variant object stored in the `photos` bucket.
 * @param key - bucket-relative key, e.g. "2026-05-bangkok/DSCF0003/medium-abc123def.webp"
 */
export function publicVariantUrl(key: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/photos/${key}`
}
