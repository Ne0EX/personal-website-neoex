/**
 * lib/store/media.ts
 * ---------------------------------------------------------------------------
 * Checked delivery URLs for the private Supabase photos bucket.
 *
 * §4.2 object key scheme:
 *   photos/<roll>/<photo_id>/<size>-<sourceHash10>.<fmt>
 *
 * publicVariantUrl(key) → same-origin URL that checks access on every request.
 * Used by map.ts to assemble variant URLs before handing records to consumers.
 *
 * Owner: Altair (α-BND-02) · draft-media privacy boundary
 */

/**
 * Retains the existing mapper API without exposing a public or signed storage URL.
 * @param key - bucket-relative key, e.g. "2026-05-bangkok/DSCF0003/medium-abc123def.webp"
 */
export function publicVariantUrl(key: string): string {
  return `/api/media/photos/${key.split('/').map(encodeURIComponent).join('/')}`
}
