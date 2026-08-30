export type CorpusSnapshotRow = {
  slug: string
  kind: string
  title: string | null
  lang: string
  summary: string | null
}

export type CorpusSnapshot = {
  version: 2
  available: boolean
  generatedAt: string | null
  counts: {
    entries: number
    photos: number
    fiction: number
  } | null
  entries: CorpusSnapshotRow[]
}

export function unavailableCorpusSnapshot(): CorpusSnapshot {
  return {
    version: 2,
    available: false,
    generatedAt: null,
    counts: null,
    entries: [],
  }
}

export function buildCorpusSnapshot(
  rows: CorpusSnapshotRow[],
  generatedAt = new Date().toISOString(),
): CorpusSnapshot {
  return {
    version: 2,
    available: true,
    generatedAt,
    counts: {
      entries: rows.length,
      photos: rows.filter((row) => row.kind === 'photo').length,
      fiction: rows.filter((row) => row.kind === 'fiction').length,
    },
    entries: rows,
  }
}
