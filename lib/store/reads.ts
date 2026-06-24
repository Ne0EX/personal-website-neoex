/**
 * lib/store/reads.ts
 * ---------------------------------------------------------------------------
 * Public read functions — use the anon Supabase client.
 * RLS returns published rows only; DL13 column grants exclude raw coords.
 *
 * IMPORTANT: All anon SELECT calls enumerate columns explicitly — never select('*').
 * The DL13 column grants make star-select fail for anon (coord/original_key revoked).
 *
 * Caching strategy (DL11): no module-level cache here (unlike velite lazy-load pattern).
 * Renders are cached by Next.js static layer; query volume = regenerations only.
 *
 * Owner: Procyon (α-IDX-03) · store-as-source S3
 */

import { anonClient } from './supabase/anon'
import {
  mapArticle,
  mapFiction,
  mapPhotoSidecar,
  mapRoll,
  mapPlace,
  type DbEntryRow,
  type DbPhotoAssetRow,
  type DbRollRow,
  type DbPlaceRow,
} from './map'
import type { Article, Fiction, Photo, PhotoSidecar, Place } from './types'

// ---------------------------------------------------------------------------
// Shared column enumerations (DL13 — never select('*') for anon)
// ---------------------------------------------------------------------------

/** All anon-readable columns from entries (raw coords excluded by grant). */
const ENTRY_COLS = [
  'id',
  'kind',
  'slug',
  'status',
  'title',
  'date',
  'iso_date',
  'domain',
  'tags',
  'summary',
  'served_coords',
  'share_location',
  'place_id',
  'highlight_for_place',
  'patches',
  'worldline_links',
  'body',
  'maturity',
  'reading_time',
  'origin_locus',
  'variants',
  'divergence_cluster',
  'roll',
  'photo_id',
  'caption',
  'override_place',
  'highlight_rank',
  // Authored instrument overrides — anon-granted (public display data, not coords).
  // Merged onto served exif in map.ts: display value = instrument_overrides.<key> ?? exif.<key>
  'instrument_overrides',
  // Authored film-sim override — wins over photo_assets.exif.filmSim when set.
  'film_sim',
  // Translation-group lang (SPEC-2026-06-18 §3.1, P1 migration, anon-granted).
  // Without this in the select list, anon would receive a 42501 on the column.
  'lang',
].join(',')

/** Anon-readable columns from photo_assets (original_key + source_hash excluded). */
const ASSET_COLS = 'entry_id,exif,variants'

// ---------------------------------------------------------------------------
// Translation-group helpers (SPEC-2026-06-18 §3.2)
// ---------------------------------------------------------------------------

/**
 * Pure helper: pick the best sibling from a set of 0–2 sibling rows.
 *
 * Contract:
 *   - Prefer the row whose lang === requestedLang.
 *   - If absent, prefer the 'en' (authored fallback) row.
 *   - If neither is present, return undefined.
 *
 * This is the canonical opt-in fallback logic. Factor here so it is unit-testable
 * independently of the Supabase client. (§3.2 SPEC — the "HARDEST path" is the
 * fallback branch: requested lang absent → en row returned, NOT undefined.)
 *
 * @param rows   Raw DB rows (0..N); typically fetched with .in('lang', [requestedLang, 'en'])
 * @param requestedLang  The locale the caller wants (e.g. 'th')
 */
export function pickSibling(rows: DbEntryRow[], requestedLang: string): DbEntryRow | undefined {
  return (
    rows.find((r) => r.lang === requestedLang) ??
    rows.find((r) => r.lang === 'en') ??
    undefined
  )
}

/**
 * Dedup a list of DB rows by slug, choosing per slug-group:
 *   the requestedLang row if present, else the 'en' row.
 *
 * Used by listing reads (getArticles, getRecentArticles, getRelatedArticles)
 * so each article appears once in a listing even when siblings exist.
 * Untranslated articles still appear (in 'en'). (§3.3 SPEC)
 */
function dedupBySlug(rows: DbEntryRow[], requestedLang: string): DbEntryRow[] {
  // Group rows by slug
  const groups = new Map<string, DbEntryRow[]>()
  for (const row of rows) {
    const group = groups.get(row.slug) ?? []
    group.push(row)
    groups.set(row.slug, group)
  }
  // Pick one winner per group
  const result: DbEntryRow[] = []
  for (const group of groups.values()) {
    const picked = pickSibling(group, requestedLang)
    if (picked) result.push(picked)
  }
  return result
}

// ---------------------------------------------------------------------------
// Articles
// ---------------------------------------------------------------------------

/**
 * All published articles, sorted newest-first.
 * Deduped by slug — each article appears once, in requestedLang if translated,
 * else in 'en'. (§3.3 SPEC)
 */
export async function getArticles(requestedLang = 'en'): Promise<Article[]> {
  const { data, error } = await anonClient
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'article')
    .eq('status', 'published')
    .order('iso_date', { ascending: false })

  if (error) throw new Error(`getArticles: ${error.message}`)
  const rows = data as unknown as DbEntryRow[]
  return dedupBySlug(rows, requestedLang).map(mapArticle)
}

/**
 * Single article by fileNum (slug), with opt-in language fallback.
 * Returns undefined when not found or not published.
 *
 * IMPORTANT: .maybeSingle() is NOT used here — PostgREST returns 406 when
 * more than one sibling row matches (both en + th for one slug), which is
 * exactly the bilingual case. Instead we fetch 0..2 candidate rows via .in()
 * and pick the best in JS. (§3.2 SPEC)
 *
 * TASK-PATCH-TRANSLATION: patch note fallback.
 * A newly-seeded Thai sibling starts with patches: [] (no Thai patch notes yet).
 * When the served row has an empty patches array and the en sibling is also
 * present in the fetched rows, we fall back to the en sibling's patches.
 * Fallback text is in English — but it is better than showing nothing for
 * content that describes real revisions. Authors explicitly providing Thai patch
 * notes (non-empty patches on the th sibling) always win over this fallback.
 */
export async function getArticleByFileNum(
  fileNum: string,
  requestedLang = 'en',
): Promise<Article | undefined> {
  // Fetch at most 2 rows: the requested lang and the en fallback.
  // When requestedLang === 'en' this degenerates to a single-lang fetch (set has 1 element).
  const { data, error } = await anonClient
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'article')
    .eq('slug', fileNum)
    .eq('status', 'published')
    .in('lang', Array.from(new Set([requestedLang, 'en'])))

  if (error) throw new Error(`getArticleByFileNum: ${error.message}`)
  const rows = (data ?? []) as unknown as DbEntryRow[]
  const row = pickSibling(rows, requestedLang)
  if (!row) return undefined

  // TASK-PATCH-TRANSLATION: if the served row has no patch notes, fall back
  // to the en sibling's patches (which were already fetched above).
  // This applies only when requestedLang !== 'en' and a th sibling was served.
  // When requestedLang === 'en', rows contains only the en row — no fallback needed.
  let patchFallback: Array<{ n: number; date: string; note: string }> | undefined
  if (row.lang !== 'en' && (!row.patches || row.patches.length === 0)) {
    const enRow = rows.find((r) => r.lang === 'en')
    if (enRow && enRow.patches && enRow.patches.length > 0) {
      patchFallback = enRow.patches
    }
  }

  const article = mapArticle(row)
  if (patchFallback) {
    return { ...article, patches: patchFallback }
  }
  return article
}

/**
 * Recent published articles for ChapterIndex / hero block.
 * Deduped by slug — each article appears once. (§3.3 SPEC)
 */
export async function getRecentArticles(limit = 4, requestedLang = 'en'): Promise<Article[]> {
  // Fetch more than `limit` to ensure dedup doesn't drop us below the requested count.
  // Upper bound: if every article has a sibling, we'd need 2×limit rows to get limit
  // distinct slugs after dedup. A 4× multiplier is safe for realistic volumes.
  const fetchLimit = limit * 4
  const { data, error } = await anonClient
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'article')
    .eq('status', 'published')
    .order('iso_date', { ascending: false })
    .limit(fetchLimit)

  if (error) throw new Error(`getRecentArticles: ${error.message}`)
  const rows = data as unknown as DbEntryRow[]
  return dedupBySlug(rows, requestedLang).slice(0, limit).map(mapArticle)
}

/**
 * Related articles: share at least one tag with source, sorted by overlap then date.
 * Excludes ALL siblings of the source (they share the slug — §3.4 SPEC).
 * Deduped by slug so each related article appears once. (§3.4 SPEC)
 */
export async function getRelatedArticles(
  source: Article,
  limit = 3,
  requestedLang = 'en',
): Promise<Article[]> {
  if (!source.tags || source.tags.length === 0) return []

  const { data, error } = await anonClient
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'article')
    .eq('status', 'published')
    .overlaps('tags', source.tags)
    // Exclude all siblings of the source (they share the slug): §3.4 SPEC.
    // .neq on slug already covers all language variants since they share the slug.
    .neq('slug', source.fileNum)
    .order('iso_date', { ascending: false })

  if (error) throw new Error(`getRelatedArticles: ${error.message}`)

  const sourceTags = new Set(source.tags)
  // Dedup first so overlap sort / slice operates on one row per article. (§3.4 SPEC)
  return dedupBySlug((data as unknown as DbEntryRow[]), requestedLang)
    .map(mapArticle)
    .map((a) => ({
      article: a,
      overlap: a.tags.filter((t) => sourceTags.has(t)).length,
    }))
    .filter(({ overlap }) => overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || b.article.isoDate.localeCompare(a.article.isoDate))
    .slice(0, limit)
    .map(({ article }) => article)
}

/**
 * Count of PUBLISHED articles in the corpus — distinct slugs only.
 *
 * This is the denominator for the ORIENT folio readout: `FILE 003 OF <total>`.
 * It mirrors the exact set `getArticles()` returns: published rows, deduped by
 * slug (each article is one folio regardless of how many translation siblings it
 * has). The count is NOT the max fileNum — fileNums are non-contiguous and cosmology
 * entries share the slug-space.
 *
 * Implementation: fetches slug + lang columns only (minimal payload), then applies
 * the same dedupBySlug logic as getArticles. Supabase PostgREST does not expose
 * COUNT(DISTINCT) directly; the in-JS dedup is a faithful match of the display set.
 *
 * Consumer: article page (app/[lang]/articles/[fileNum]/page.tsx) — called in
 * parallel with getArticleByFileNum; no extra sequential round-trip.
 *
 * Spec: SPEC-2026-06-25-article-continuation.md §2 "ORIENT affordance".
 */
export async function getPublishedArticleCount(requestedLang = 'en'): Promise<number> {
  const { data, error } = await anonClient
    .from('entries')
    .select('slug,lang')
    .eq('kind', 'article')
    .eq('status', 'published')

  if (error) throw new Error(`getPublishedArticleCount: ${error.message}`)
  // Reuse dedupBySlug: count distinct slugs after lang-preference dedup.
  // This is identical to getArticles() minus column fetch + mapping.
  return dedupBySlug((data ?? []) as unknown as DbEntryRow[], requestedLang).length
}

// ---------------------------------------------------------------------------
// Fiction
// ---------------------------------------------------------------------------

/**
 * All published fiction entries, sorted newest-first.
 * Deduped by slug — each entry appears once, in requestedLang if translated,
 * else in 'en'. (§3.5 SPEC — fiction same model as articles)
 */
export async function getFiction(requestedLang = 'en'): Promise<Fiction[]> {
  const { data, error } = await anonClient
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'fiction')
    .eq('status', 'published')
    .order('iso_date', { ascending: false })

  if (error) throw new Error(`getFiction: ${error.message}`)
  const rows = data as unknown as DbEntryRow[]
  return dedupBySlug(rows, requestedLang).map(mapFiction)
}

/**
 * Single published fiction entry by slug, with opt-in language fallback.
 * Same pattern as getArticleByFileNum: .maybeSingle() removed (406 on siblings),
 * 0..2 rows fetched via .in('lang', ...), JS pick applied. (§3.5 SPEC)
 */
export async function getFictionBySlug(
  slug: string,
  requestedLang = 'en',
): Promise<Fiction | undefined> {
  const { data, error } = await anonClient
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'fiction')
    .eq('slug', slug)
    .eq('status', 'published')
    .in('lang', Array.from(new Set([requestedLang, 'en'])))

  if (error) throw new Error(`getFictionBySlug: ${error.message}`)
  const row = pickSibling((data ?? []) as unknown as DbEntryRow[], requestedLang)
  if (!row) return undefined
  return mapFiction(row)
}

const SITE_ALPHA = 1.130426

function _pickAlpha(f: Fiction): number {
  if (f.variants && f.variants.length > 0) return parseFloat(f.variants[0].alpha)
  return SITE_ALPHA
}

/**
 * Sibling NeX nodes within the same divergence_cluster. Returns up to 2.
 * These are narrative siblings (different slugs, same cluster) — not translation
 * siblings. Deduped by slug so translation variants of cluster members don't inflate
 * the result. Always resolves in 'en' (no requestedLang param needed here — the
 * alpha-distance sort is alpha-language-neutral).
 */
export async function getFictionSiblings(slug: string): Promise<Fiction[]> {
  const self = await getFictionBySlug(slug)
  if (!self || !self.divergence_cluster) return []

  const { data, error } = await anonClient
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'fiction')
    .eq('status', 'published')
    .eq('divergence_cluster', self.divergence_cluster)
    .neq('slug', slug)

  if (error) throw new Error(`getFictionSiblings: ${error.message}`)

  const selfAlpha = _pickAlpha(self)
  // Dedup by slug (pick 'en' for each cluster member) before alpha-distance sort.
  return dedupBySlug((data as unknown as DbEntryRow[]), 'en')
    .map(mapFiction)
    .map((f) => ({ entry: f, dist: Math.abs(_pickAlpha(f) - selfAlpha) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 2)
    .map(({ entry }) => entry)
}

// ---------------------------------------------------------------------------
// Photos (roll descriptors)
// ---------------------------------------------------------------------------

const ROLL_COLS = 'roll,id,caption,share_location,served_coords,date,iso_date,body'

/** All rolls, sorted newest-first. */
export async function getPhotos(): Promise<Photo[]> {
  const { data, error } = await anonClient
    .from('rolls')
    .select(ROLL_COLS)
    .order('iso_date', { ascending: false })

  if (error) throw new Error(`getPhotos: ${error.message}`)
  return (data as unknown as DbRollRow[]).map(mapRoll)
}

/** Roll body text for a specific roll. Returns null when roll not found. */
export async function getRollBody(roll: string): Promise<string | null> {
  const { data, error } = await anonClient
    .from('rolls')
    .select('body')
    .eq('roll', roll)
    .maybeSingle()

  if (error) throw new Error(`getRollBody: ${error.message}`)
  return data?.body ?? null
}

// ---------------------------------------------------------------------------
// PhotoSidecars
// ---------------------------------------------------------------------------

/** Join helper: fetches photo_assets for given entry_ids. */
async function fetchAssets(entryIds: string[]): Promise<Map<string, DbPhotoAssetRow>> {
  if (entryIds.length === 0) return new Map()
  const { data, error } = await anonClient
    .from('photo_assets')
    .select(ASSET_COLS)
    .in('entry_id', entryIds)

  if (error) throw new Error(`fetchAssets: ${error.message}`)
  const map = new Map<string, DbPhotoAssetRow>()
  for (const row of (data ?? []) as unknown as DbPhotoAssetRow[]) {
    map.set(row.entry_id, row)
  }
  return map
}

/** All published photo sidecars, newest-first. */
export async function getPhotoSidecars(): Promise<PhotoSidecar[]> {
  const { data, error } = await anonClient
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'photo')
    .eq('status', 'published')
    .order('iso_date', { ascending: false })

  if (error) throw new Error(`getPhotoSidecars: ${error.message}`)
  const rows = data as unknown as DbEntryRow[]
  const assets = await fetchAssets(rows.map((r) => r.id))
  return rows.map((r) => mapPhotoSidecar(r, assets.get(r.id)))
}

/** All published sidecars within a roll, ordered by photo_id ascending (capture sequence). */
export async function getSidecarsInRoll(roll: string): Promise<PhotoSidecar[]> {
  const { data, error } = await anonClient
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'photo')
    .eq('status', 'published')
    .eq('roll', roll)
    .order('photo_id', { ascending: true })

  if (error) throw new Error(`getSidecarsInRoll: ${error.message}`)
  const rows = data as unknown as DbEntryRow[]
  const assets = await fetchAssets(rows.map((r) => r.id))
  return rows.map((r) => mapPhotoSidecar(r, assets.get(r.id)))
}

/** Single sidecar by roll + id. Returns null when not found. */
export async function getPhotoByRollAndId(roll: string, id: string): Promise<PhotoSidecar | null> {
  const { data, error } = await anonClient
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'photo')
    .eq('roll', roll)
    .eq('photo_id', id)
    .maybeSingle()

  if (error) throw new Error(`getPhotoByRollAndId: ${error.message}`)
  if (!data) return null
  const row = data as unknown as DbEntryRow
  const assets = await fetchAssets([row.id])
  return mapPhotoSidecar(row, assets.get(row.id))
}

/** Single sidecar by roll + id. Returns undefined (articles.ts compat). */
export async function getPhotoById(roll: string, id: string): Promise<PhotoSidecar | undefined> {
  return (await getPhotoByRollAndId(roll, id)) ?? undefined
}

/** Roll contacts: sidecars + lede for the roll-index page. */
export interface RollContacts {
  sidecars: PhotoSidecar[]
  lede: string
  dateRange: string
}

export async function getRollContacts(roll: string, rollBody: string): Promise<RollContacts> {
  const sidecars = await getSidecarsInRoll(roll)

  let dateRange = ''
  if (sidecars.length > 0) {
    const sorted = [...sidecars].sort((a, b) => a.isoDate.localeCompare(b.isoDate))
    const first = sorted[0].isoDate.replace(/-/g, '.')
    const last = sorted[sorted.length - 1].isoDate.replace(/-/g, '.')
    dateRange = first === last ? first : `${first} — ${last}`
  }

  // Extract lede: strip comments, return first non-empty paragraph
  const stripped = rollBody.replace(/<!--[\s\S]*?-->/g, '').trim()
  let lede = ''
  if (stripped) {
    for (const para of stripped.split(/\n\n+/)) {
      const clean = para.trim()
      if (clean) { lede = clean; break }
    }
  }

  return { sidecars, lede, dateRange }
}

/** Globe-eligible photos (share_location=true AND served_coords defined). */
export async function getGlobeEligiblePhotos() {
  const { data, error } = await anonClient
    .from('entries')
    .select(ENTRY_COLS)
    .eq('kind', 'photo')
    .eq('status', 'published')
    .eq('share_location', true)
    .not('served_coords', 'is', null)

  if (error) throw new Error(`getGlobeEligiblePhotos: ${error.message}`)
  const rows = data as unknown as DbEntryRow[]
  const assets = await fetchAssets(rows.map((r) => r.id))
  return rows.map((r) => {
    const s = mapPhotoSidecar(r, assets.get(r.id))
    return {
      kind: 'photo' as const,
      roll: s.roll,
      id: s.id,
      caption: s.caption,
      coords: s.servedCoords!,
      isoDate: s.isoDate,
      filmSim: s.exif?.filmSim,
      thumbWebp: s.variants?.thumb.webp,
    }
  })
}

/** Prev/next navigation within a roll. */
export async function getRollNavigation(
  roll: string,
  id: string,
): Promise<{ prev: PhotoSidecar | undefined; next: PhotoSidecar | undefined }> {
  const inRoll = await getSidecarsInRoll(roll)
  const idx = inRoll.findIndex((s) => s.id === id)
  if (idx === -1) return { prev: undefined, next: undefined }
  return {
    prev: idx > 0 ? inRoll[idx - 1] : undefined,
    next: idx < inRoll.length - 1 ? inRoll[idx + 1] : undefined,
  }
}

/** Roll descriptors for a specific roll (compat with getPhotosByRoll). */
export async function getPhotosByRoll(roll: string): Promise<Photo[]> {
  const { data, error } = await anonClient
    .from('rolls')
    .select(ROLL_COLS)
    .eq('roll', roll)
    .order('iso_date', { ascending: true })

  if (error) throw new Error(`getPhotosByRoll: ${error.message}`)
  return (data as unknown as DbRollRow[]).map(mapRoll)
}

// ---------------------------------------------------------------------------
// Next-entry resolver (TASK-RECOMMEND-NEXT)
// ---------------------------------------------------------------------------

/**
 * Slim record for a recommended-next entry card.
 * Carries just what the UI needs — no body, no coords.
 */
export interface NextEntry {
  kind: 'article' | 'fiction'
  /** article → fileNum (e.g. "001"); fiction → slug */
  identifier: string
  title: string
  domain: string
  summary: string
  /** ISO 8601 date for sort (YYYY-MM-DD). */
  isoDate: string
  /**
   * Lang-aware public href for this entry.
   * articles  → /[lang]/articles/[fileNum]   (or /articles/[fileNum] for 'en')
   * fiction   → /[lang]/fiction/[slug]       (or /fiction/[slug] for 'en')
   */
  href: string
  /**
   * Maturity status of the entry ('seed'|'ongoing'|'refined'|'settled').
   * Renders in the meta strip as the status label.
   * Spec: SPEC-2026-06-25-article-continuation.md §1 — meta strip "domain · status · reading-time"
   */
  status: string
  /**
   * Computed reading time in minutes.
   * Spec: SPEC-2026-06-25-article-continuation.md §1 — meta strip "N MIN" readout.
   */
  readingTime: number
  /**
   * Optional worldline edge label from the source entry.
   * Present only when the link is a declared worldline_link AND carries a label field.
   * Absent for chronological-fallback entries (spec §1.3 — silence where no explicit label).
   * Renders in Cormorant italic below the main row (spec §1 edge annotation).
   */
  label?: string
}

/**
 * Build the public href for a NextEntry.
 *
 * Convention (from proxy.ts / bilingual spec):
 *   lang='en' → no lang prefix (proxy canonicalises /articles/... internally
 *                to /en/articles/... but /articles/... is the public URL).
 *   lang='th' → /th/articles/... or /th/fiction/...
 */
function nextEntryHref(kind: 'article' | 'fiction', identifier: string, lang: string): string {
  const prefix = lang === 'en' ? '' : `/${lang}`
  if (kind === 'article') return `${prefix}/articles/${identifier}`
  return `${prefix}/fiction/${identifier}`
}

/**
 * Returns 1–4 recommended next entries for `currentEntry`.
 *
 * Priority:
 *   1. Entries explicitly referenced by currentEntry.worldline_links (outgoing edges).
 *      These are author-curated connections — always preferred.
 *   2. Chronological prev/next articles when worldline_links is empty or yields no
 *      resolved targets (fallback). Returns at most 2 in fallback mode: the
 *      immediately older article and the immediately newer article (if they exist).
 *      No attractor / tag filter on the fallback — the worldline is chronological.
 *
 * lang param: used for hrefs and for dedupBySlug preference when fetching the
 * full article list for fallback (each article appears once, preferred in lang).
 *
 * Constraint: never includes currentEntry itself.
 *
 * NOTE: does not import lib/content/worldline.ts (which imports from this file
 * via lib/content/articles.ts — circular). Instead uses `currentEntry.worldline_links`
 * directly and resolves targets with targeted DB fetches.
 */
export async function getNextEntries(
  currentEntry: Article,
  lang = 'en',
): Promise<NextEntry[]> {
  const links = currentEntry.worldline_links ?? []

  // ── Priority 1: worldline_links ──────────────────────────────────────────
  // Resolve only article targets (fiction links are in the corpus but article
  // pages are the primary surface; fiction support is forward-compatible).
  const articleLinks = links.filter((l) => l.to.startsWith('article/'))

  if (articleLinks.length > 0) {
    const resolved: NextEntry[] = []
    for (const link of articleLinks) {
      const targetFileNum = link.to.replace(/^article\//, '')
      const article = await getArticleByFileNum(targetFileNum, lang)
      if (!article || article.draft || article.fileNum === currentEntry.fileNum) continue
      resolved.push({
        kind: 'article',
        identifier: article.fileNum,
        title: article.title,
        domain: article.domain,
        summary: article.summary,
        isoDate: article.isoDate,
        href: nextEntryHref('article', article.fileNum, lang),
        status: article.status,
        readingTime: article.readingTime,
        // edge annotation: present only when the worldline_link carries a label
        // (spec §1.3 — worldline-link case vs chronological-fallback case)
        label: link.label,
      })
    }
    if (resolved.length > 0) return resolved
    // All links resolved to nothing (broken links or drafts) — fall through to chronological.
  }

  // ── Priority 2: chronological prev/next ──────────────────────────────────
  // getArticles returns newest-first (iso_date DESC). We need the full list so
  // we can find immediate neighbours of currentEntry.
  const all = await getArticles(lang)
  // Sort ascending by iso_date for prev/next index logic.
  const sorted = [...all].sort((a, b) => a.isoDate.localeCompare(b.isoDate))
  const idx = sorted.findIndex((a) => a.fileNum === currentEntry.fileNum)

  const neighbours: NextEntry[] = []
  // Next in time (newer) — the entry published after current.
  if (idx !== -1 && idx < sorted.length - 1) {
    const newer = sorted[idx + 1]
    neighbours.push({
      kind: 'article',
      identifier: newer.fileNum,
      title: newer.title,
      domain: newer.domain,
      summary: newer.summary,
      isoDate: newer.isoDate,
      href: nextEntryHref('article', newer.fileNum, lang),
      status: newer.status,
      readingTime: newer.readingTime,
      // chronological fallback — no label (silence per spec §1.3)
    })
  }
  // Prev in time (older) — the entry published before current.
  if (idx > 0) {
    const older = sorted[idx - 1]
    neighbours.push({
      kind: 'article',
      identifier: older.fileNum,
      title: older.title,
      domain: older.domain,
      summary: older.summary,
      isoDate: older.isoDate,
      href: nextEntryHref('article', older.fileNum, lang),
      status: older.status,
      readingTime: older.readingTime,
      // chronological fallback — no label (silence per spec §1.3)
    })
  }
  return neighbours
}

// ---------------------------------------------------------------------------
// Places
// ---------------------------------------------------------------------------

const PLACE_COLS = 'id,level,parent_id,name,lat,lon,is_alpha'

/** All registered L1 places. */
export async function getAllPlacesFromStore(): Promise<Place[]> {
  const { data, error } = await anonClient
    .from('places')
    .select(PLACE_COLS)
    .order('id', { ascending: true })

  if (error) throw new Error(`getAllPlacesFromStore: ${error.message}`)
  return (data as unknown as DbPlaceRow[]).map(mapPlace)
}

/**
 * Returns the place currently designated as the alpha locus (is_alpha = true).
 *
 * The alpha locus is the globe's observer home coordinate — the Ne0 stratum
 * camera framing and NEXT NODE cycle start here. At most one place is alpha at
 * any time (enforced by places_one_alpha_idx partial unique index).
 *
 * Falls back to the Bangkok hard-coordinates if no place is flagged alpha (safe
 * default preserving existing behaviour during any accidental de-seeded state).
 */
export async function getAlphaPlace(): Promise<Place> {
  const { data, error } = await anonClient
    .from('places')
    .select(PLACE_COLS)
    .eq('is_alpha', true)
    .maybeSingle()

  if (error) throw new Error(`getAlphaPlace: ${error.message}`)

  if (data) return mapPlace(data as unknown as DbPlaceRow)

  // Safe fallback: Bangkok — matches the historical hardcoded ALPHA_LAT/ALPHA_LON.
  // This path should never be reached in a correctly seeded DB, but prevents a
  // globe crash during any transient un-seeded state.
  return {
    id: 'bangkok',
    level: 1,
    parentId: null,
    name: 'Bangkok · TH',
    coord: { lat: 13.7563, lon: 100.5018 },
    isAlpha: true,
  }
}
