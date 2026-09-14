import type { ArchiveEntry } from '@/lib/content/archive'
import { canonicalPath } from './usePagefind'

export interface PublicSearchResult {
  url: string
  meta: {
    title?: string
    kind?: string
    fileNum?: string
    date?: string
    isoDate?: string
    tags?: string
    coord?: string
    place?: string
    drift?: string
    'tended-count'?: string
    'tended-last'?: string
  }
  excerpt: string
}

/** Normalize indexed locale aliases only after reading that locale's public corpus. */
export function publicSearchPath(url: string): string {
  return canonicalPath(url).replace(/^\/(en|th)(?=\/|$)/, '') || '/'
}

/**
 * Pagefind is a deployment snapshot, never publication authority. Match hits
 * against a fresh public corpus and replace stale display metadata. A roll is
 * discoverable only while it contains a public frame. Old index files remain
 * publicly fetchable until the generated output is cleanly replaced and deployed.
 * This gate controls the live search UI; it cannot revoke already downloaded bytes.
 */
export function filterPublicSearchResults(
  results: PublicSearchResult[],
  entries: ArchiveEntry[],
  lang = 'en',
): PublicSearchResult[] {
  const byPath = new Map(entries.map((entry) => [publicSearchPath(entry.route), entry]))
  const rolls = new Map<string, Extract<ArchiveEntry, { kind: 'photo' }>>()
  for (const entry of entries) {
    if (entry.kind === 'photo') {
      const path = `/photos/${entry.roll}`
      const current = rolls.get(path)
      if (!current || entry.isoDate > current.isoDate) rolls.set(path, entry)
    }
  }

  const seen = new Set<string>()
  return results.flatMap((result) => {
    const path = publicSearchPath(result.url)
    const entry = byPath.get(path)
    const roll = rolls.get(path)
    if ((!entry && !roll) || seen.has(path)) return []
    seen.add(path)

    const source = entry ?? roll!
    const locus = entry?.shareLocation ? entry.locus : null
    const coord = locus
      ? `${Math.abs(locus.lat).toFixed(2)}°${locus.lat < 0 ? 'S' : 'N'} · ${Math.abs(locus.lon).toFixed(2)}°${locus.lon < 0 ? 'W' : 'E'}`
      : undefined
    return [{
      url: `${lang === 'th' ? '/th' : ''}${path}`,
      meta: {
        title: entry?.title ?? roll!.roll,
        kind: entry?.kind ?? 'photo-roll',
        fileNum: entry?.id ?? roll!.roll,
        date: source.date,
        isoDate: source.isoDate,
        tags: source.tags.join(', '),
        coord,
        place: locus?.place,
        'tended-count': entry?.kind === 'article' ? String(entry.patches.length || 1) : '1',
        'tended-last': source.lastPatched,
      },
      excerpt: '',
    }]
  })
}
