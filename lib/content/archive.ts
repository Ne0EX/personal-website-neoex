/**
 * lib/content/archive.ts
 * ----------------------
 * Cross-stratum archive ledger — articles, fiction transmissions, and photos
 * normalised into a single flat ArchiveEntry[] sorted by most-recently-patched.
 *
 * Design spec: docs/design/21-archive-route.md §7.1
 *
 * PRIVACY CONTRACT (HARD — inherited from photo-atlas §1.2 and 20-archive.md §5.5):
 *   Photos appear in the ledger regardless of shareLocation — the ledger is a
 *   full inventory. HOWEVER, getMiniGlobePins() gates on shareLocation===true AND
 *   servedCoords being defined. The velite transform provides a second layer of
 *   defence: PhotoSidecar.servedCoords is undefined whenever shareLocation===false,
 *   so even if the gate here were bypassed, no real coords would be emitted.
 *
 *   Field name: the real privacy-controlling field on both Photo and PhotoSidecar
 *   velite records is `servedCoords` (set only when shareLocation===true in the
 *   velite.config.ts transform). The raw `coords` field is never exposed in served
 *   records — do NOT read `coords` directly. Always read `servedCoords`.
 *
 * Owner: Procyon (α-IDX-03)
 * Consumed by: app/archive/page.tsx (RSC), components/ArchiveLedger (filter client)
 */

import type { Article, Fiction, PhotoSidecar } from './types'

// ---------------------------------------------------------------------------
// MiniGlobePin — defined here so Sirius can import from lib/content/archive
// without reaching into components (which are not yet built).
// Mirror of the interface in docs/design/21-archive-route.md §5.6.
// ---------------------------------------------------------------------------

/**
 * A single pin for the archive mini-globe and the Triangulate overlay globe.
 * Only entries where privacy gate passes are present in this type.
 */
export type MiniGlobePin = {
  /**
   * Unique stable id.
   * articles: fileNum ("003")
   * photos: '<roll>/<id>' ("2026-04-chiang-mai/DSCF0001")
   * fiction: slug ("transmission-001")
   */
  id: string
  kind: 'article' | 'photo' | 'fiction'
  lat: number
  lon: number
  /** Entry route for onPinClick navigation. */
  route: string
  /** Display title for tooltip / accessibility. */
  title: string
}

// ---------------------------------------------------------------------------
// ArchiveEntry discriminated union — the canonical ledger row shape.
// ---------------------------------------------------------------------------

export type ArchiveEntry =
  | ArchiveArticle
  | ArchivePhoto
  | ArchiveFiction

export interface ArchiveArticle {
  kind: 'article'
  /** Stable unique id — fileNum (zero-padded, e.g. "003"). */
  id: string
  fileNum: string
  title: string
  /** Display date YYYY.MM.DD (from frontmatter). */
  date: string
  /** ISO 8601 date for programmatic sort (isoDate from velite transform). */
  isoDate: string
  /**
   * Most-recently-patched ISO 8601 date.
   * patches[last].date if patches exist; otherwise isoDate.
   * Used as the primary sort key for the ledger.
   */
  lastPatched: string
  /** Year extracted from isoDate — used for year-grouped rendering. */
  year: number
  status: 'seed' | 'ongoing' | 'refined' | 'settled'
  /** Estimated reading time in minutes. */
  readingTime: number
  domain: string
  tags: string[]
  /** Real-world locus for this entry. Articles always have coords per schema. */
  locus: { lat: number; lon: number; place: string }
  /**
   * Articles always plot on the mini-globe when a locus is present.
   * Always true — the spec explicitly states articles have no privacy gate.
   */
  shareLocation: true
  drift: null
  patches: Array<{ n: number; date: string; note: string }>
  /** Canonical route for navigation. */
  route: string
}

export interface ArchivePhoto {
  kind: 'photo'
  /**
   * Stable unique id — '<roll>/<sidecarId>' (e.g. "2026-04-chiang-mai/DSCF0001").
   */
  id: string
  roll: string
  sidecarId: string
  /** Caption or roll-slug fallback. */
  title: string
  /** Display date YYYY.MM.DD. */
  date: string
  /** ISO 8601. */
  isoDate: string
  /**
   * For photos, lastPatched === isoDate (photos are immutable field-wise;
   * their capture date is their survey date).
   */
  lastPatched: string
  /** Year from isoDate. */
  year: number
  domain: string
  tags: string[]
  filmSim?: string
  /**
   * Real-world locus. Non-null ONLY when shareLocation===true AND the velite
   * transform emitted servedCoords (the privacy-gated field). Null otherwise.
   * The ledger ALWAYS includes the row; only the locus row is conditionally shown.
   */
  locus: { lat: number; lon: number; place: string } | null
  /**
   * PRIVACY GATE — real field name in velite schema is `servedCoords`.
   * servedCoords is undefined in the velite record when shareLocation===false.
   * This field reflects the effective privacy state: true only when servedCoords
   * was defined (i.e. shareLocation===true AND GPS was in the process-photos cache).
   *
   * If false: entry appears in ledger (locus row omitted) but is NOT passed
   * to mini-globe pins. See getMiniGlobePins().
   */
  shareLocation: boolean
  drift: null
  route: string
}

export interface ArchiveFiction {
  kind: 'fiction'
  /** Stable unique id — slug. */
  id: string
  slug: string
  title: string
  /** Display date YYYY.MM.DD. */
  date: string
  /** ISO 8601. */
  isoDate: string
  /** Same as isoDate — fiction entries do not have a separate patch log. */
  lastPatched: string
  /** Year from isoDate. */
  year: number
  domain: string
  tags: string[]
  /**
   * Fiction has no GPS locus — orbital placement is by meaning-coordinates
   * (domain + date), not physical geography. Always null.
   */
  locus: null
  /**
   * Fiction never plots on the mini-globe. Always false.
   * Matches ArchiveFiction spec in §7.1.
   */
  shareLocation: false
  drift: null
  route: string
}

// ---------------------------------------------------------------------------
// Module-level lazy caches — same lazy-load pattern as articles.ts / photos.ts
// ---------------------------------------------------------------------------

let _entries: ArchiveEntry[] | null = null

async function loadEntries(): Promise<ArchiveEntry[]> {
  if (_entries) return _entries

  const cache = await import('../../.velite')
  const articles = cache.articles as Article[]
  const fiction  = cache.fiction  as Fiction[]
  const sidecars = (cache.photoSidecars as PhotoSidecar[]) ?? []

  const result: ArchiveEntry[] = []

  // ── Articles ──────────────────────────────────────────────────────────────
  for (const a of articles) {
    // Derive lastPatched: highest-n patch date, or isoDate when no patches exist.
    const sortedPatches = [...(a.patches ?? [])].sort((x, y) => y.n - x.n)
    const lastPatched = sortedPatches.length > 0
      ? sortedPatches[0].date
      : a.isoDate

    result.push({
      kind: 'article',
      id: a.fileNum,
      fileNum: a.fileNum,
      title: a.title,
      date: a.date,
      isoDate: a.isoDate,
      lastPatched,
      year: parseInt(a.isoDate.slice(0, 4), 10),
      status: a.status,
      readingTime: a.readingTime,
      domain: a.domain,
      tags: a.tags,
      // Articles always have coords per schema (non-optional field).
      locus: a.coords,
      shareLocation: true,
      drift: null,
      patches: (a.patches ?? []).map(p => ({ n: p.n, date: p.date, note: p.note })),
      route: `/entries/${a.fileNum}`,
    })
  }

  // ── Fiction ───────────────────────────────────────────────────────────────
  for (const f of fiction) {
    result.push({
      kind: 'fiction',
      id: f.slug,
      slug: f.slug,
      title: f.title,
      date: f.date,
      isoDate: f.isoDate,
      lastPatched: f.isoDate,
      year: parseInt(f.isoDate.slice(0, 4), 10),
      domain: f.domain,
      tags: f.tags,
      locus: null,
      shareLocation: false,
      drift: null,
      route: `/fiction/${f.slug}`,
    })
  }

  // ── Photo sidecars ────────────────────────────────────────────────────────
  //
  // PRIVACY: the velite transform exposes `servedCoords` (set only when
  // shareLocation===true). We read servedCoords — never `coords` directly.
  // This is the second layer of defence; the first layer is the velite transform
  // itself which refuses to emit servedCoords when shareLocation===false.
  for (const s of sidecars) {
    // servedCoords is the privacy-gated field. When defined, shareLocation must
    // have been true in the original frontmatter.
    const served = s.servedCoords
    const hasCoords = served !== undefined

    result.push({
      kind: 'photo',
      id: `${s.roll}/${s.id}`,
      roll: s.roll,
      sidecarId: s.id,
      // Caption takes precedence; fall back to the photo id as display label.
      title: s.caption ?? s.id,
      date: s.date,
      isoDate: s.isoDate,
      lastPatched: s.isoDate,
      year: parseInt(s.isoDate.slice(0, 4), 10),
      // Photos carry no domain field in the schema. We derive from roll slug
      // (the roll name encodes place, not thematic domain). Use 'reflection' as
      // the canonical default domain for photos (visual / observation register).
      // SCHEMA GAP NOTE: if a `domain` field is added to PhotoSidecar in the
      // future, read it here. Currently there is none.
      domain: 'reflection',
      // Photos carry no tags field in the PhotoSidecar schema.
      // SCHEMA GAP NOTE: if tags are added to PhotoSidecar, read them here.
      tags: [],
      filmSim: s.exif?.filmSim,
      locus: hasCoords ? { lat: served!.lat, lon: served!.lon, place: served!.place } : null,
      // shareLocation reflects whether servedCoords was actually emitted.
      shareLocation: hasCoords,
      drift: null,
      route: `/photos/${s.roll}/${s.id}`,
    })
  }

  _entries = result
  return _entries
}

// ---------------------------------------------------------------------------
// getArchiveEntries
// ---------------------------------------------------------------------------

export interface GetArchiveEntriesOptions {
  /**
   * Filter by content type. Matches the URL param `/archive?type=…`.
   * When absent, all entry kinds are returned.
   */
  type?: 'article' | 'photo' | 'fiction'
}

/**
 * Returns all archive-eligible entries, default sort: lastPatched descending
 * (most-recently-patched first).
 *
 * Privacy contract:
 *   - Articles: always included (locus always plotted on mini-globe).
 *   - Photos: always included in the ledger (full inventory).
 *     shareLocation=false photos appear in rows but have locus=null.
 *     getMiniGlobePins() enforces the harder gate for coordinates.
 *   - Fiction: always included (no GPS; never on mini-globe).
 *
 * @param opts.type - Optional type filter matching /archive?type=… URL param.
 */
export async function getArchiveEntries(
  opts?: GetArchiveEntriesOptions,
): Promise<ArchiveEntry[]> {
  const entries = await loadEntries()

  const filtered = opts?.type
    ? entries.filter((e) => e.kind === opts.type)
    : entries

  return [...filtered].sort((a, b) => b.lastPatched.localeCompare(a.lastPatched))
}

// ---------------------------------------------------------------------------
// getArchiveEntriesByYear
// ---------------------------------------------------------------------------

/**
 * Returns archive entries grouped by survey year (extracted from entry.isoDate).
 * Within each year the entries are sorted by lastPatched descending (same as
 * getArchiveEntries() default order).
 *
 * Year keys are sorted descending (most recent year first) in the returned
 * Record, though Record key order is insertion-order in JS. Consumers should
 * explicitly sort Object.keys() descending when rendering year sections.
 *
 * @param entries - Pre-fetched entries from getArchiveEntries(). When omitted,
 *   fetches all entries with default sort. Accepts a filtered slice.
 */
export async function getArchiveEntriesByYear(
  entries?: ArchiveEntry[],
): Promise<Record<number, ArchiveEntry[]>> {
  const source = entries ?? (await getArchiveEntries())

  const grouped: Record<number, ArchiveEntry[]> = {}

  for (const entry of source) {
    const year = entry.year
    if (!grouped[year]) {
      grouped[year] = []
    }
    grouped[year].push(entry)
  }

  return grouped
}

// ---------------------------------------------------------------------------
// getMiniGlobePins
// ---------------------------------------------------------------------------

/**
 * Returns the subset of ArchiveEntry[] eligible for mini-globe pin rendering.
 *
 * PRIVACY GATE (HARD contract — docs/design/21-archive-route.md §5.7):
 *   - kind === 'photo'   → ONLY when shareLocation===true AND locus!==null.
 *     The locus field is derived from PhotoSidecar.servedCoords in loadEntries().
 *     servedCoords is only ever defined when shareLocation===true in velite.
 *     This gate is therefore doubly enforced: schema transform AND this function.
 *   - kind === 'article' → ONLY when locus!==null.
 *     Articles always have coords per schema, so this is effectively always true.
 *   - kind === 'fiction' → always excluded (shareLocation is typed false; no GPS).
 *
 * The component that receives MiniGlobePin[] performs NO privacy logic.
 * This function is the sole privacy gate for mini-globe placement.
 *
 * @param entries - Pre-fetched entries from getArchiveEntries(). Must be provided
 *   (not re-fetched internally) so the caller can control type filtering and the
 *   privacy gate is applied to the same slice that drives the ledger.
 */
export function getMiniGlobePins(entries: ArchiveEntry[]): MiniGlobePin[] {
  const pins: MiniGlobePin[] = []

  for (const entry of entries) {
    if (entry.kind === 'fiction') {
      // Fiction never plots. shareLocation is typed false. Skip.
      continue
    }

    if (entry.kind === 'article') {
      // Articles always have locus (non-optional in schema).
      // Still guard explicitly for safety.
      if (!entry.locus) continue
      pins.push({
        id: entry.fileNum,
        kind: 'article',
        lat: entry.locus.lat,
        lon: entry.locus.lon,
        route: entry.route,
        title: entry.title,
      })
      continue
    }

    if (entry.kind === 'photo') {
      // HARD GATE: only emit when shareLocation===true AND locus is defined.
      // locus is set from servedCoords in loadEntries() — servedCoords is
      // undefined in the velite record unless shareLocation===true.
      if (!entry.shareLocation || !entry.locus) continue
      pins.push({
        id: entry.id,
        kind: 'photo',
        lat: entry.locus.lat,
        lon: entry.locus.lon,
        route: entry.route,
        title: entry.title,
      })
      continue
    }
  }

  return pins
}
