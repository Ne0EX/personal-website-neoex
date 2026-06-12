/**
 * lib/content/worldline.ts
 * ------------------------
 * Worldline-weave inter-entry link helpers (S3 · VISION-2026-05-31 §2.1).
 *
 * S3 store-as-source: corpus loaded from 3 store queries (articles, fiction,
 * photo sidecars) via the anon client instead of the velite cache.
 * Broken-link console.warn validation fires at request/build-time load — same
 * warnings, surfaced at first read (accepted in §6.3 swap list).
 *
 * DL7: no .velite import — replaced by lib/store/reads.ts queries.
 *
 * Owner: Procyon (α-IDX-03) · TASK-2026-05-31-S3-WORLDLINE-SCHEMA / S3-store-swap
 */

import type { WorldlineLink, WorldlineEdge, WorldlineNeighborhood } from './types'
import { getArticles, getArticleByFileNum } from './articles'
import { getFiction } from './fiction'
import { getPhotoSidecars } from './photos'

// ---------------------------------------------------------------------------
// Corpus types
// ---------------------------------------------------------------------------

interface CorpusEntry {
  key: string
  kind: 'article' | 'fiction' | 'photo'
  identifier: string
  title: string
  date: string
  outgoing: WorldlineLink[]
}

export interface ResolvedNeighbor {
  key: string
  kind: 'article' | 'fiction' | 'photo'
  identifier: string
  title: string
  date: string
  label?: string
}

export interface ResolvedNeighborhood {
  incoming: ResolvedNeighbor[]
  outgoing: ResolvedNeighbor[]
}

// ---------------------------------------------------------------------------
// Corpus load — queries the store instead of velite
// ---------------------------------------------------------------------------

// No module-level cache per DL11 (static layer caches; query volume = regenerations)

async function loadCorpus(): Promise<CorpusEntry[]> {
  const [articles, fiction, sidecars] = await Promise.all([
    getArticles(),
    getFiction(),
    getPhotoSidecars(),
  ])

  const entries: CorpusEntry[] = []

  for (const a of articles) {
    entries.push({
      key: `article/${a.fileNum}`,
      kind: 'article',
      identifier: a.fileNum,
      title: a.title,
      date: a.date,
      outgoing: a.worldline_links ?? [],
    })
  }

  for (const f of fiction) {
    entries.push({
      key: `fiction/${f.slug}`,
      kind: 'fiction',
      identifier: f.slug,
      title: f.title,
      date: f.date,
      outgoing: f.worldline_links ?? [],
    })
  }

  for (const s of sidecars) {
    entries.push({
      key: `photos/${s.roll}/${s.id}`,
      kind: 'photo',
      identifier: `${s.roll}/${s.id}`,
      title: s.caption ?? s.id,
      date: s.date,
      outgoing: s.worldline_links ?? [],
    })
  }

  // Validate broken links — warn, do not throw
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

  return entries
}

async function loadReverseIndex(): Promise<Map<string, WorldlineEdge[]>> {
  const corpus = await loadCorpus()
  const index = new Map<string, WorldlineEdge[]>()

  for (const entry of corpus) {
    for (const link of entry.outgoing) {
      const existing = index.get(link.to) ?? []
      existing.push({ from: entry.key, fromKind: entry.kind, label: link.label })
      index.set(link.to, existing)
    }
  }

  return index
}

function canonicalKey(kind: 'article' | 'fiction' | 'photo', identifier: string): string {
  switch (kind) {
    case 'article': return `article/${identifier}`
    case 'fiction': return `fiction/${identifier}`
    case 'photo':   return `photos/${identifier}`
  }
}

// ---------------------------------------------------------------------------
// Public API (unchanged signatures)
// ---------------------------------------------------------------------------

export async function getOutgoingLinks(
  kind: 'article' | 'fiction' | 'photo',
  identifier: string,
): Promise<WorldlineLink[]> {
  const corpus = await loadCorpus()
  const key = canonicalKey(kind, identifier)
  const entry = corpus.find((e) => e.key === key)
  return entry?.outgoing ?? []
}

export async function getIncomingLinks(
  kind: 'article' | 'fiction' | 'photo',
  identifier: string,
): Promise<WorldlineEdge[]> {
  const index = await loadReverseIndex()
  const key = canonicalKey(kind, identifier)
  return index.get(key) ?? []
}

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

export async function resolveNeighborhood(
  kind: 'article' | 'fiction' | 'photo',
  identifier: string,
): Promise<ResolvedNeighborhood> {
  const corpus = await loadCorpus()
  const [outgoingLinks, incomingEdges] = await Promise.all([
    getOutgoingLinks(kind, identifier),
    getIncomingLinks(kind, identifier),
  ])

  const byKey = new Map(corpus.map((e) => [e.key, e]))

  const outgoing: ResolvedNeighbor[] = []
  for (const link of outgoingLinks) {
    const target = byKey.get(link.to)
    if (!target) continue
    outgoing.push({
      key: target.key,
      kind: target.kind,
      identifier: target.identifier,
      title: target.title,
      date: target.date,
      label: link.label,
    })
  }

  const incoming: ResolvedNeighbor[] = []
  for (const edge of incomingEdges) {
    const source = byKey.get(edge.from)
    if (!source) continue
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
