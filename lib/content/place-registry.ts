/**
 * lib/content/place-registry.ts
 * ------------------------------
 * Authoritative L1 place list for the place-aware globe.
 *
 * WHAT THIS IS:
 *   A Peat-curated, zod-validated static registry of L1 (city-level) places.
 *   This is NOT a velite collection — places have no MDX body, so a data
 *   collection would be structurally unjustified. A standalone module gives the
 *   same schema guarantee (zod) with less indirection.
 *
 * WHAT THIS IS NOT:
 *   - Auto-clustered from GPS proximity (spec §5.4: "Places are Peat-curated")
 *   - An L2 district registry (L2 = future; parentId is latent/null at L1)
 *   - An observer-node registry (OBSERVER_NODES stays in lib/entries.ts, untouched)
 *
 * SEEDED FROM (2026-06-07):
 *   The 4 distinct place strings found in existing MDX content:
 *     "Bangkok · TH"     → content/articles/000-genesis.mdx (coords.place)
 *     "Kyoto · JP"       → content/articles/003-architecture-of-taste.mdx
 *     "Chiang Mai · TH"  → content/articles/002-stride-pause.mdx
 *     "Yirgacheffe · ET" → content/articles/001-four-pours.mdx
 *   Plus photos/2026-05-bangkok (4 sidecars) and photos/2026-04-chiang-mai (1 sidecar).
 *
 *   NOTE — San Francisco is present in the legacy lib/entries.ts RECENT_ENTRIES
 *   array for article 000 ("notes from a paused engineer"), but the REAL MDX
 *   at content/articles/000-genesis.mdx has coords.place = "Bangkok · TH".
 *   RECENT_ENTRIES is a legacy stub. The canonical ground truth is the MDX file.
 *   Bangkok is seeded; San Francisco is NOT.
 *
 * COORDS SOURCE:
 *   Each place coord is taken from the article's coords field (articles have
 *   non-optional coords; they represent the authored capture locus for that piece).
 *   Photo servedCoords are rounded to ~1.1km and NOT used as the authoritative
 *   place coord — article coords are more precise and article always appears first
 *   in the curation flow.
 *
 * WEIGHT:
 *   Weight is NOT stored here. It is computed at query time in lib/content/places.ts
 *   by counting articles + photo sidecars whose derived placeId matches this entry.
 *   Storing weight here would create a stale-by-default counter.
 *
 * FLAGS TO PEAT (per spec §15 + advisor):
 *   1. CANONICAL ID SCHEME: The spec §2.1 shows both "bangkok" (city-only) and
 *      "kyoto-jp" (city+country-code) as examples — it is inconsistent. This seed
 *      uses city-only slugs ("bangkok", "kyoto", "chiang-mai", "yirgacheffe").
 *      Country-disambiguation will be needed if two cities share a slug across
 *      countries. Peat should ratify the scheme before any content references the IDs.
 *   2. CANONICAL COORD: Each place coord defaults to the article's declared coords.
 *      Spec §5.4 says Peat assigns coordinates manually in the console (lat/lon entry).
 *      These seeds are "best available"; Peat should review and override if a
 *      city-centroid differs from the article's specific locus.
 *
 * Owner: Procyon (α-IDX-03) · place-aware-globe-spec.md §14
 * Consumed by: lib/content/places.ts
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FROZEN — DO NOT HAND-EDIT place-registry.data.json
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// As of store-as-source S8 (2026-06-12, DL15), the authoritative place registry
// has moved to the `public.places` Supabase table (project aitqswnbtpexrxqpoiwo).
//
// place-registry.data.json is now MIGRATION INPUT + PRE-STORE HISTORY ONLY:
//   - It was used as the seed for `scripts/migrate-to-store.ts` (S2).
//   - It must never be edited by hand again — edits will diverge from the DB.
//   - New places go through the console UI → `createPlace` store action (§7).
//   - Coord fixes go through the console → `savePlaceCoord` store action (§7).
//
// If you are reading this because you want to add or fix a place:
//   → Open /console (Peat-authed) → Place panel → Add place / Fix coord.
//   → The change lands in public.places and is live immediately via RLS + cache.
//   → Do NOT edit the JSON file.
//
// Canopus (α-HRN-07) · store-as-source S8
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { z } from 'zod'
import rawPlaces from './place-registry.data.json'

// ---------------------------------------------------------------------------
// Place schema — matches spec §14 item 1 / §2.1 atom
// ---------------------------------------------------------------------------

export const PlaceSchema = z.object({
  /**
   * Stable slug-form identifier. Kebab-case. City-only (see FLAG 1 above).
   * Examples: "bangkok" · "kyoto" · "chiang-mai" · "yirgacheffe"
   */
  id: z.string().regex(/^[a-z0-9-]+$/, 'place id must be kebab-case'),

  /**
   * Hierarchy level. Currently always 1 (city/area).
   * L2 (district) is designed for but not built — spec §6, §13.
   * The field is present so the consumer type supports nesting without a repaint.
   */
  level: z.union([z.literal(1), z.literal(2)]),

  /**
   * Parent place id (L2 only). Always null for L1.
   * Latent field: present in type, always null at L1 launch.
   */
  parentId: z.string().nullable(),

  /**
   * Display name. Used in globe tooltip, front-door panel header, console rail.
   * Format: "{City} · {COUNTRY_CODE}" — matches existing coords.place convention.
   */
  name: z.string().min(1),

  /**
   * Globe anchor — single lat/lon point per place.
   * Source at L1 launch: taken from the article's coords field for that place.
   * Peat may override in the console; that value is the canonical coord thereafter.
   */
  coord: z.object({
    lat: z.number(),
    lon: z.number(),
  }),
})

export type Place = z.infer<typeof PlaceSchema>

// ---------------------------------------------------------------------------
// Seeded L1 registry — loaded from place-registry.data.json
// ---------------------------------------------------------------------------
//
// place-registry.data.json is the runtime write target for coord edits and
// new places added via the console (Altair writes it; Peat reviews the diff
// and commits — NOT a production write). The seed entries match the original
// hand-authored values exactly; provenance is documented in this file's
// header comment above ("SEEDED FROM").
//
// The JSON import is intentionally untyped (the inferred type has level: number,
// not 1|2). Zod narrows every record via PlaceSchema.safeParse below — if a
// JSON entry violates the schema the module throws at load time (fail-fast).

// Validate at module load — fails fast if any JSON entry violates schema.
const validated = (rawPlaces as unknown[]).map((p, i) => {
  const result = PlaceSchema.safeParse(p)
  if (!result.success) {
    const idHint =
      p !== null && typeof p === 'object' && 'id' in p ? String((p as Record<string, unknown>).id) : '?'
    throw new Error(
      `place-registry: invalid place at index ${i} (id=${idHint}): ${JSON.stringify(result.error.issues)}`,
    )
  }
  return result.data
})

/**
 * All seeded L1 places, validated.
 * Consumers should use lib/content/places.ts for the enriched query API
 * (weight, highlights, content lists).
 */
export const PLACE_REGISTRY: readonly Place[] = Object.freeze(validated)

/**
 * Look up a place by id. Returns undefined if not found.
 * O(n) — registry is small; build-time usage only.
 */
export function getPlaceById(id: string): Place | undefined {
  return PLACE_REGISTRY.find((p) => p.id === id)
}

// ---------------------------------------------------------------------------
// Place derivation helpers
// ---------------------------------------------------------------------------

/**
 * Derives a placeId from a coords.place string (the existing place label format).
 *
 * Strategy: normalize the label — lowercase, strip " · <COUNTRY>" suffix,
 * replace spaces with hyphens — and check against the registry.
 *
 * Examples:
 *   "Bangkok · TH"     → "bangkok"
 *   "Chiang Mai · TH"  → "chiang-mai"
 *   "Kyoto · JP"       → "kyoto"
 *   "Yirgacheffe · ET" → "yirgacheffe"
 *
 * Returns undefined if no registry match is found.
 * Called by lib/content/places.ts for articles (which always have coords.place).
 */
export function deriveArticlePlaceId(coordsPlace: string): string | undefined {
  // Strip country code suffix (" · XX"), lowercase, replace spaces with hyphens
  const slug = coordsPlace
    .split(' · ')[0]
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
  return PLACE_REGISTRY.find((p) => p.id === slug) ? slug : undefined
}

/**
 * Derives a placeId from a roll slug (the roll directory name format).
 *
 * Strategy: extract the place segment from "YYYY-MM-<place-slug>" and check
 * against the registry.
 *
 * Examples:
 *   "2026-05-bangkok"     → "bangkok"
 *   "2026-04-chiang-mai"  → "chiang-mai"
 *
 * Returns undefined if no registry match is found.
 * Called by lib/content/places.ts for photo sidecars.
 *
 * PRIVACY NOTE: This derives place membership from the roll slug (which is public
 * via the roll index route /photos/<roll>). It is NOT derived from servedCoords
 * or EXIF GPS. This means photos with shareLocation=false are correctly assigned
 * to their place (roll slug is public information; roll index page is public).
 * GPS privacy is a separate concern — this is place taxonomy, not GPS surfacing.
 */
export function derivePhotoPlaceId(rollSlug: string): string | undefined {
  // Roll format: YYYY-MM-<place-slug>
  // Strip YYYY-MM- prefix (first two hyphen segments)
  const parts = rollSlug.split('-')
  if (parts.length < 3) return undefined
  // Candidate: everything after "YYYY-MM-"
  const candidate = parts.slice(2).join('-')
  return PLACE_REGISTRY.find((p) => p.id === candidate) ? candidate : undefined
}
