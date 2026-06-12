/**
 * lib/content/archive.ts
 * ----------------------
 * Cross-stratum archive ledger — store-as-source version (S3).
 *
 * S3: loads from lib/store/reads instead of the velite cache.
 * DL7: no .velite import. DL13: photos read served_coords (never raw coords).
 * DL2: public reads from the anon client return published rows only.
 *
 * All ArchiveEntry types and getMiniGlobePins() privacy contract unchanged.
 *
 * Owner: Procyon (α-IDX-03) · store-as-source S3
 */

import { getArticles } from './articles'
import { getFiction } from './fiction'
import { getPhotoSidecars } from './photos'

// ---------------------------------------------------------------------------
// Re-export MiniGlobePin and ArchiveEntry types (consumers import from here)
// ---------------------------------------------------------------------------

export type MiniGlobePin = {
  id: string
  kind: 'article' | 'photo' | 'fiction'
  lat: number
  lon: number
  route: string
  title: string
  place: string
}

export type ArchiveEntry =
  | ArchiveArticle
  | ArchivePhoto
  | ArchiveFiction

export interface ArchiveArticle {
  kind: 'article'
  id: string
  fileNum: string
  title: string
  date: string
  isoDate: string
  lastPatched: string
  year: number
  status: 'seed' | 'ongoing' | 'refined' | 'settled'
  readingTime: number
  domain: string
  tags: string[]
  locus: { lat: number; lon: number; place: string }
  shareLocation: true
  drift: null
  patches: Array<{ n: number; date: string; note: string }>
  route: string
}

export interface ArchivePhoto {
  kind: 'photo'
  id: string
  roll: string
  sidecarId: string
  title: string
  date: string
  isoDate: string
  lastPatched: string
  year: number
  domain: string
  tags: string[]
  filmSim?: string
  locus: { lat: number; lon: number; place: string } | null
  shareLocation: boolean
  drift: null
  route: string
}

export interface ArchiveFiction {
  kind: 'fiction'
  id: string
  slug: string
  title: string
  date: string
  isoDate: string
  lastPatched: string
  year: number
  domain: string
  tags: string[]
  locus: null
  shareLocation: false
  drift: null
  route: string
}

export interface GetArchiveEntriesOptions {
  type?: 'article' | 'photo' | 'fiction'
}

// ---------------------------------------------------------------------------
// Internal loader
// ---------------------------------------------------------------------------

async function loadEntries(): Promise<ArchiveEntry[]> {
  const [articles, fiction, sidecars] = await Promise.all([
    getArticles(),
    getFiction(),
    getPhotoSidecars(),
  ])

  const result: ArchiveEntry[] = []

  for (const a of articles) {
    const sortedPatches = [...(a.patches ?? [])].sort((x, y) => y.n - x.n)
    const lastPatched = sortedPatches.length > 0 ? sortedPatches[0].date : a.isoDate

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
      // DL13: coords is served_coords (already rounded, trigger-maintained)
      locus: a.coords,
      shareLocation: true,
      drift: null,
      patches: (a.patches ?? []).map((p) => ({ n: p.n, date: p.date, note: p.note })),
      route: `/articles/${a.fileNum}`,
    })
  }

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

  for (const s of sidecars) {
    // DL13: servedCoords is the privacy-gated field
    const served = s.servedCoords
    const hasCoords = served !== undefined

    result.push({
      kind: 'photo',
      id: `${s.roll}/${s.id}`,
      roll: s.roll,
      sidecarId: s.id,
      title: s.caption ?? s.id,
      date: s.date,
      isoDate: s.isoDate,
      lastPatched: s.isoDate,
      year: parseInt(s.isoDate.slice(0, 4), 10),
      domain: 'reflection',
      tags: [],
      filmSim: s.exif?.filmSim,
      locus: hasCoords ? { lat: served!.lat, lon: served!.lon, place: served!.place } : null,
      shareLocation: hasCoords,
      drift: null,
      route: `/photos/${s.roll}/${s.id}`,
    })
  }

  return result
}

// ---------------------------------------------------------------------------
// Public API (unchanged)
// ---------------------------------------------------------------------------

export async function getArchiveEntries(opts?: GetArchiveEntriesOptions): Promise<ArchiveEntry[]> {
  const entries = await loadEntries()
  const filtered = opts?.type ? entries.filter((e) => e.kind === opts.type) : entries
  return [...filtered].sort((a, b) => b.lastPatched.localeCompare(a.lastPatched))
}

export async function getArchiveEntriesByYear(
  entries?: ArchiveEntry[],
): Promise<Record<number, ArchiveEntry[]>> {
  const source = entries ?? (await getArchiveEntries())
  const grouped: Record<number, ArchiveEntry[]> = {}
  for (const entry of source) {
    const year = entry.year
    if (!grouped[year]) grouped[year] = []
    grouped[year].push(entry)
  }
  return grouped
}

export function getMiniGlobePins(entries: ArchiveEntry[]): MiniGlobePin[] {
  const pins: MiniGlobePin[] = []

  for (const entry of entries) {
    if (entry.kind === 'fiction') continue

    if (entry.kind === 'article') {
      if (!entry.locus) continue
      pins.push({
        id: entry.fileNum,
        kind: 'article',
        lat: entry.locus.lat,
        lon: entry.locus.lon,
        route: entry.route,
        title: entry.title,
        place: entry.locus.place ?? '',
      })
      continue
    }

    if (entry.kind === 'photo') {
      if (!entry.shareLocation || !entry.locus) continue
      pins.push({
        id: entry.id,
        kind: 'photo',
        lat: entry.locus.lat,
        lon: entry.locus.lon,
        route: entry.route,
        title: entry.title,
        place: entry.locus.place ?? '',
      })
      continue
    }
  }

  return pins
}
