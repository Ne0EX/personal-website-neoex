/**
 * lib/content/worldline.ts
 * ------------------------
 * Worldline-weave inter-entry link helpers (S3 · VISION-2026-05-31 §2.1).
 *
 * Model:
 *   - Outgoing links are declared in frontmatter as `worldline_links: [{ to, label? }]`.
 *   - Incoming edges are computed here at server/build time by reverse-scanning all
 *     entries' worldline_links arrays. They are NEVER stored in frontmatter.
 *   - Broken links (to a non-existent entry) emit console.warn with "[worldline]"
 *     prefix. Build and render continue — dangling refs are preserved.
 *
 * Canonical `to` key format:
 *   "article/<fileNum>"                  e.g. "article/003"
 *   "fiction/<slug>"                     e.g. "fiction/transmission-001"
 *   "photos/<roll>/<id>"                 e.g. "photos/2026-04-chiang-mai/DSCF0001"
 *
 * Callers supply ONLY the identifier (fileNum | slug | "roll/id") — this module
 * builds the full canonical key internally.
 *
 * Design spec: docs/design/16-worldline-schema.md §2
 * Vision lock: VISION-2026-05-31-search-lineage-console.md §2.1 + §4 (worldline-weave)
 *
 * Owner: Procyon (α-IDX-03) · TASK-2026-05-31-S3-WORLDLINE-SCHEMA
 */

import type { WorldlineLink, WorldlineEdge, WorldlineNeighborhood } from './types'

// ---------------------------------------------------------------------------
// Lazy corpus load — same pattern as articles.ts / fiction.ts / photos.ts
// ---------------------------------------------------------------------------

/** Loaded once per process. Reset is only needed in tests (not exposed here). */
let _corpus: CorpusEntry[] | null = null

/** An entry in the combined corpus: every collection item that can participate
 *  in worldline links (articles, fiction, photoSidecars). */
interface CorpusEntry {
  /** Canonical key, e.g. "article/003", "fiction/transmission-001",
   *  "photos/2026-04-chiang-mai/DSCF0001". */
  key: string
  /** Content kind — drives glyph selection in <WorldlineLinks />. */
  kind: 'article' | 'fiction' | 'photo'
  /** Short identifier: fileNum for articles, slug for fiction, "roll/id" for photos. */
  identifier: string
  /** Human-readable title for display in <WorldlineLinks />. */
  title: string
  /** Display date (YYYY.MM.DD) for <WorldlineLinks /> neighbor rows. */
  date: string
  /** Outgoing links declared in this entry's frontmatter. */
  outgoing: WorldlineLink[]
}

/**
 * A resolved neighbor row for rendering in <WorldlineLinks />.
 * Carries the display metadata needed to render a neighbor row without
 * a second velite lookup.
 */
export interface ResolvedNeighbor {
  /** Canonical key of the neighbor, e.g. "article/003". */
  key: string
  kind: 'article' | 'fiction' | 'photo'
  /** Short identifier for routing: fileNum | slug | "roll/id". */
  identifier: string
  title: string
  date: string
  /** Edge label from the source frontmatter (Cormorant italic prose). */
  label?: string
}

/**
 * Resolved 1-hop neighborhood for <WorldlineLinks /> rendering.
 * Incoming edges are from other entries pointing to this one.
 * Outgoing edges are this entry's declared worldline_links.
 */
export interface ResolvedNeighborhood {
  incoming: ResolvedNeighbor[]
  outgoing: ResolvedNeighbor[]
}

async function loadCorpus(): Promise<CorpusEntry[]> {
  if (_corpus) return _corpus

  const cache = await import('../../.velite')

  const entries: CorpusEntry[] = []

  // Articles — keyed "article/<fileNum>"
  for (const a of cache.articles as Array<{ fileNum: string; title: string; date: string; worldline_links?: WorldlineLink[] }>) {
    entries.push({
      key: `article/${a.fileNum}`,
      kind: 'article',
      identifier: a.fileNum,
      title: a.title,
      date: a.date,
      outgoing: a.worldline_links ?? [],
    })
  }

  // Fiction — keyed "fiction/<slug>"
  for (const f of cache.fiction as Array<{ slug: string; title: string; date: string; worldline_links?: WorldlineLink[] }>) {
    entries.push({
      key: `fiction/${f.slug}`,
      kind: 'fiction',
      identifier: f.slug,
      title: f.title,
      date: f.date,
      outgoing: f.worldline_links ?? [],
    })
  }

  // PhotoSidecars — keyed "photos/<roll>/<id>"
  // Photos use id as title (no prose title field) and date from sidecar.
  for (const s of cache.photoSidecars as Array<{ roll: string; id: string; date: string; caption?: string; worldline_links?: WorldlineLink[] }>) {
    entries.push({
      key: `photos/${s.roll}/${s.id}`,
      kind: 'photo',
      identifier: `${s.roll}/${s.id}`,
      title: s.caption ?? s.id,
      date: s.date,
      outgoing: s.worldline_links ?? [],
    })
  }

  // Validate: check every outgoing `to` resolves to an existing corpus key.
  // Emit console.warn for broken links; do NOT throw — build continues.
  const keySet = new Set(entries.map((e) => e.key))
  for (const entry of entries) {
    for (const link of entry.outgoing) {
      if (!keySet.has(link.to)) {
        console.warn(
          `[worldline] broken link: "${entry.key}" → "${link.to}" (no matching entry found)`,
        )
      }
    }
  }

  _corpus = entries
  return _corpus
}

// ---------------------------------------------------------------------------
// Reverse-index — Map<canonicalTo, WorldlineEdge[]>
// Built lazily on first query; invalidated when corpus is reloaded.
// ---------------------------------------------------------------------------

let _reverseIndex: Map<string, WorldlineEdge[]> | null = null

async function loadReverseIndex(): Promise<Map<string, WorldlineEdge[]>> {
  if (_reverseIndex) return _reverseIndex

  const corpus = await loadCorpus()
  const index = new Map<string, WorldlineEdge[]>()

  for (const entry of corpus) {
    for (const link of entry.outgoing) {
      const existing = index.get(link.to) ?? []
      existing.push({
        from: entry.key,
        fromKind: entry.kind,
        label: link.label,
      })
      index.set(link.to, existing)
    }
  }

  _reverseIndex = index
  return _reverseIndex
}

// ---------------------------------------------------------------------------
// Canonical key builder
// ---------------------------------------------------------------------------

/**
 * Build the canonical corpus key for an entry.
 *
 * - article, "003"           → "article/003"
 * - fiction, "transmission-001" → "fiction/transmission-001"
 * - photo,   "2026-04-chiang-mai/DSCF0001" → "photos/2026-04-chiang-mai/DSCF0001"
 */
function canonicalKey(kind: 'article' | 'fiction' | 'photo', identifier: string): string {
  switch (kind) {
    case 'article': return `article/${identifier}`
    case 'fiction': return `fiction/${identifier}`
    case 'photo':   return `photos/${identifier}`
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Outgoing links from an entry's own `worldline_links` frontmatter array.
 *
 * Returns `[]` if the entry has no declared links or does not exist.
 *
 * @param kind       - 'article' | 'fiction' | 'photo'
 * @param identifier - fileNum for articles ("003"); slug for fiction ("transmission-001");
 *                     "roll/id" for photos ("2026-04-chiang-mai/DSCF0001")
 */
export async function getOutgoingLinks(
  kind: 'article' | 'fiction' | 'photo',
  identifier: string,
): Promise<WorldlineLink[]> {
  const corpus = await loadCorpus()
  const key = canonicalKey(kind, identifier)
  const entry = corpus.find((e) => e.key === key)
  return entry?.outgoing ?? []
}

/**
 * Incoming edges pointing to an entry — computed from the reverse-index.
 *
 * Returns `[]` if no other entry links to this one.
 *
 * @param kind       - 'article' | 'fiction' | 'photo'
 * @param identifier - fileNum | slug | "roll/id"
 */
export async function getIncomingLinks(
  kind: 'article' | 'fiction' | 'photo',
  identifier: string,
): Promise<WorldlineEdge[]> {
  const index = await loadReverseIndex()
  const key = canonicalKey(kind, identifier)
  return index.get(key) ?? []
}

/**
 * Full 1-hop neighbourhood for an entry.
 *
 * Returned `outgoing` and `incoming` are guaranteed to share no entries
 * (they represent different directions of the DAG, not duplicates).
 *
 * Consumed by: <WorldlineLinks /> (Sirius) — renders the §worldline section.
 *
 * @param kind       - 'article' | 'fiction' | 'photo'
 * @param identifier - fileNum | slug | "roll/id"
 */
export async function get1HopNeighborhood(
  kind: 'article' | 'fiction' | 'photo',
  identifier: string,
): Promise<WorldlineNeighborhood> {
  const [outgoing, incoming] = await Promise.all([
    getOutgoingLinks(kind, identifier),
    getIncomingLinks(kind, identifier),
  ])
  return { outgoing, incoming }
}

/**
 * Resolved 1-hop neighborhood with display metadata (title, date) for each
 * neighbor. Consumed by <WorldlineLinks /> (Sirius) to render the §worldline
 * section without a second lookup per neighbor.
 *
 * Broken links (target not in corpus) are silently omitted from outgoing;
 * the corpus-level console.warn in loadCorpus() already flags them at build time.
 *
 * @param kind       - 'article' | 'fiction' | 'photo'
 * @param identifier - fileNum | slug | "roll/id"
 */
export async function resolveNeighborhood(
  kind: 'article' | 'fiction' | 'photo',
  identifier: string,
): Promise<ResolvedNeighborhood> {
  const corpus = await loadCorpus()
  const [outgoingLinks, incomingEdges] = await Promise.all([
    getOutgoingLinks(kind, identifier),
    getIncomingLinks(kind, identifier),
  ])

  // Build a fast key → entry map
  const byKey = new Map(corpus.map((e) => [e.key, e]))

  // Resolve outgoing: look up target entry for title/date
  const outgoing: ResolvedNeighbor[] = []
  for (const link of outgoingLinks) {
    const target = byKey.get(link.to)
    if (!target) continue // broken link — omit silently (already warned in loadCorpus)
    outgoing.push({
      key: target.key,
      kind: target.kind,
      identifier: target.identifier,
      title: target.title,
      date: target.date,
      label: link.label,
    })
  }

  // Resolve incoming: look up source entry for title/date
  const incoming: ResolvedNeighbor[] = []
  for (const edge of incomingEdges) {
    const source = byKey.get(edge.from)
    if (!source) continue // should not happen (reverse-index built from corpus itself)
    incoming.push({
      key: source.key,
      kind: source.kind,
      identifier: source.identifier,
      title: source.title,
      date: source.date,
      label: edge.label,
    })
  }

  return { incoming, outgoing }
}
