/**
 * lib/content/visibility.ts
 * -------------------------
 * Defensive draft gate for public surfaces in every environment.
 * The store-as-source contract (2026-06-12, DL2) retired dev-public draft preview.
 * Public reads already select published rows; this also rejects draft records
 * passed directly to a public surface. Owner preview uses store/admin-reads and
 * must not apply this public predicate.
 *
 * Orthogonal to `status` (maturity ladder: seed|ongoing|refined|settled).
 * `status` is NEVER read here. Do NOT conflate the two.
 *
 * Consumer: every lib/content list helper + every public detail route page.
 * Owner: Procyon (α-IDX-03) · TASK-2026-09-12-PUBLICATION
 */

/**
 * Returns true when an entry should be hidden from public surfaces in the
 * current environment (development, test, and production share one policy).
 *
 * @param entry - Any content record that may carry a `draft` boolean field.
 *   Accepts a loose shape so the same helper works across Article, Fiction,
 *   and PhotoSidecar without requiring a union import.
 */
export function isHiddenFromPublic(entry: { draft?: boolean }): boolean {
  return entry.draft === true
}
