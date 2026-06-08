/**
 * lib/content/visibility.ts
 * -------------------------
 * Single shared predicate for draft-visibility gating on public surfaces.
 *
 * RULE (Peat + advisor, 2026-06-08 — EDITOR-LIFECYCLE-GAP-AUDIT §"Resolved build decisions"):
 *   - `draft: true` hides an entry from the live public site in production.
 *   - Drafts remain visible on dev public routes (preserves localhost preview).
 *   - The console/editor ALWAYS sees all entries including drafts — it must NOT
 *     go through this predicate; it uses the getAllArticles/getAllFiction/etc variants.
 *
 * PROD-ONLY (NODE_ENV='production'):
 *   isHiddenFromPublic(entry) === true  → exclude from public lists, 404 on detail route
 *   isHiddenFromPublic(entry) === false → serve normally
 *
 * NON-PRODUCTION (development, test):
 *   isHiddenFromPublic always returns false → drafts are visible everywhere.
 *
 * Orthogonal to `status` (maturity ladder: seed|ongoing|refined|settled).
 * `status` is NEVER read here. Do NOT conflate the two.
 *
 * Consumer: every lib/content list helper + every public detail route page.
 * Owner: Procyon (α-IDX-03) · T1 lifecycle — draft schema (2026-06-08)
 */

/**
 * Returns true when an entry should be hidden from public surfaces in the
 * current environment.
 *
 * @param entry - Any content record that may carry a `draft` boolean field.
 *   Accepts a loose shape so the same helper works across Article, Fiction,
 *   and PhotoSidecar without requiring a union import.
 */
export function isHiddenFromPublic(entry: { draft?: boolean }): boolean {
  return entry.draft === true && process.env.NODE_ENV === 'production'
}
