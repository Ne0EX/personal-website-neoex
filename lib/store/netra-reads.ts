/** Request-scoped, RLS-backed reads for NETRA. Never use the anon singleton here. */
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  NetraArchiveFilter,
  NetraKnowledge,
  NetraLanguage,
  NetraPatchTrace,
  NetraResourcePageContext,
  NetraTrace,
} from '@/lib/netra/contracts'

export type NetraClient = SupabaseClient
export type NetraFilter = NetraArchiveFilter
export type NetraResult = NetraTrace

const RESULT_COLUMNS = 'slug,kind,title,lang,summary,body,roll,photo_id'
const PATCH_COLUMNS = `${RESULT_COLUMNS},patches`
const SEARCH_COLUMNS = ['title', 'summary', 'body'] as const
const SEARCH_TOKEN_PATTERN = /[\p{L}\p{M}\p{N}]+/gu
const MAX_SEARCH_QUERY_LENGTH = 200
const MAX_SEARCH_TOKENS = 8
const MAX_SEARCH_TOKEN_LENGTH = 64
const MAX_CURRENT_ROLL_FRAMES = 12

/** Build raw PostgREST syntax exclusively from fixed operators and safe word tokens. */
function searchFilter(query: string): string | null {
  const boundedQuery = Array.from(query).slice(0, MAX_SEARCH_QUERY_LENGTH).join('').normalize('NFKC')
  const tokens = Array.from(
    new Set(
      (boundedQuery.match(SEARCH_TOKEN_PATTERN) ?? [])
        .map((token) => Array.from(token).slice(0, MAX_SEARCH_TOKEN_LENGTH).join(''))
        .filter(Boolean),
    ),
  ).slice(0, MAX_SEARCH_TOKENS)

  if (tokens.length === 0) return null

  const tokenFilters = tokens.map((token) =>
    SEARCH_COLUMNS.map((column) => `${column}.ilike.%${token}%`).join(','),
  )

  if (tokenFilters.length === 1) return tokenFilters[0]
  return `and(${tokenFilters.map((filter) => `or(${filter})`).join(',')})`
}

function stripMarkdown(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#*_>`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function excerpt(body: string | null | undefined): string {
  return stripMarkdown(body ?? '').slice(0, 800)
}

function permalink(
  kind: string,
  slug: string,
  roll?: string | null,
  photoId?: string | null,
): string {
  if (kind === 'article') return `/articles/${slug}`
  if (kind === 'fiction') return `/fiction/${slug}`
  return `/photos/${roll ?? slug}/${photoId ?? ''}`.replace(/\/$/, '')
}

function rowLanguage(value: unknown): NetraLanguage {
  return value === 'th' ? 'th' : 'en'
}

function mapRow(row: Record<string, unknown>): NetraResult {
  return {
    title: String(row.title ?? row.slug ?? ''),
    slug: String(row.slug ?? ''),
    lang: rowLanguage(row.lang),
    summary: String(row.summary ?? ''),
    excerpt: excerpt(String(row.body ?? '')),
    permalink: permalink(
      String(row.kind),
      String(row.slug),
      row.roll as string | null,
      row.photo_id as string | null,
    ),
  }
}

function languageCandidates(lang: NetraLanguage): NetraLanguage[] {
  return lang === 'en' ? ['en'] : [lang, 'en']
}

function pickLocalizedRow(
  rows: Record<string, unknown>[],
  lang: NetraLanguage,
): Record<string, unknown> | undefined {
  return rows.find((row) => row.lang === lang)
    ?? rows.find((row) => row.lang === 'en')
}

export async function searchEntries(client: NetraClient, query: string, filter: NetraFilter = 'all', limit = 5): Promise<NetraResult[]> {
  const filterExpression = searchFilter(query)
  if (!filterExpression) return []

  let request = client.from('entries').select(RESULT_COLUMNS).or(filterExpression)
  if (filter === 'articles') request = request.eq('kind', 'article')
  if (filter === 'photos') request = request.eq('kind', 'photo')
  if (filter === 'fiction') request = request.eq('kind', 'fiction')
  const { data, error } = await request.order('iso_date', { ascending: false }).limit(Math.min(10, Math.max(1, limit)))
  if (error) throw new Error(`NETRA search failed: ${error.message}`)
  return ((data ?? []) as Record<string, unknown>[]).map(mapRow)
}

export async function getEntry(
  client: NetraClient,
  slugOrFileNum: string,
  lang: NetraLanguage = 'en',
): Promise<NetraResult | null> {
  const { data, error } = await client
    .from('entries')
    .select(RESULT_COLUMNS)
    .eq('slug', slugOrFileNum)
    .in('lang', languageCandidates(lang))
    .order('lang')
  if (error) throw new Error(`NETRA entry failed: ${error.message}`)
  const rows = (data ?? []) as Record<string, unknown>[]
  const row = pickLocalizedRow(rows, lang)
  return row ? mapRow(row) : null
}

export async function listRecentPatches(
  client: NetraClient,
  days = 7,
): Promise<NetraPatchTrace[]> {
  const { data, error } = await client
    .from('entries')
    .select(PATCH_COLUMNS)
    .not('patches', 'is', null)
    .order('iso_date', { ascending: false })
    .limit(100)
  if (error) throw new Error(`NETRA patches failed: ${error.message}`)
  const cutoff = Date.now() - Math.min(90, Math.max(1, days)) * 86400000
  return ((data ?? []) as Record<string, unknown>[]).flatMap((row) => {
    const patches = Array.isArray(row.patches) ? row.patches as Array<{ n: number; date: string; note: string }> : []
    return patches.filter((patch) => Date.parse(patch.date.replace(/\./g, '-')) >= cutoff).map((patch) => ({ ...mapRow(row), patch }))
  })
}

export async function searchPhotos(client: NetraClient, query: string, limit = 5): Promise<NetraResult[]> {
  return searchEntries(client, query, 'photos', limit)
}

export async function listFiction(client: NetraClient): Promise<NetraResult[]> {
  const { data, error } = await client.from('entries').select(RESULT_COLUMNS).eq('kind', 'fiction').order('iso_date', { ascending: false }).limit(50)
  if (error) throw new Error(`NETRA fiction failed: ${error.message}`)
  return ((data ?? []) as Record<string, unknown>[]).map(mapRow)
}

async function getLocalizedResource(
  client: NetraClient,
  kind: 'article' | 'fiction',
  slug: string,
  lang: NetraLanguage,
): Promise<NetraResult | null> {
  const { data, error } = await client
    .from('entries')
    .select(RESULT_COLUMNS)
    .eq('kind', kind)
    .eq('slug', slug)
    .in('lang', languageCandidates(lang))
    .limit(2)

  if (error) throw new Error(`NETRA current ${kind} failed: ${error.message}`)
  const row = pickLocalizedRow(
    (data ?? []) as Record<string, unknown>[],
    lang,
  )
  return row ? mapRow(row) : null
}

async function getCurrentPhotoEntry(
  client: NetraClient,
  roll: string,
  photoId: string,
  lang: NetraLanguage,
): Promise<NetraResult | null> {
  const { data, error } = await client
    .from('entries')
    .select(RESULT_COLUMNS)
    .eq('kind', 'photo')
    .eq('roll', roll)
    .eq('photo_id', photoId)
    .in('lang', languageCandidates(lang))
    .limit(2)

  if (error) throw new Error(`NETRA current photo failed: ${error.message}`)
  const row = pickLocalizedRow(
    (data ?? []) as Record<string, unknown>[],
    lang,
  )
  return row ? mapRow(row) : null
}

/**
 * `rolls` rows are public even when all of their frames are draft-only. Build
 * this trace from a bounded set of request-visible photo rows so the current
 * page lookup cannot reveal an otherwise hidden roll through a side channel.
 */
async function getCurrentPhotoRoll(
  client: NetraClient,
  roll: string,
): Promise<NetraResult | null> {
  const { data, error } = await client
    .from('entries')
    .select(RESULT_COLUMNS)
    .eq('kind', 'photo')
    .eq('roll', roll)
    .order('photo_id', { ascending: true })
    .limit(MAX_CURRENT_ROLL_FRAMES + 1)

  if (error) throw new Error(`NETRA current photo roll failed: ${error.message}`)
  const rows = (data ?? []) as Record<string, unknown>[]
  if (rows.length === 0) return null

  const visibleRows = rows.slice(0, MAX_CURRENT_ROLL_FRAMES)
  const traces = visibleRows.map(mapRow)
  const visibleRoll = String(visibleRows[0].roll ?? '')
  if (!visibleRoll) return null

  const frameIds = visibleRows
    .map((row) => String(row.photo_id ?? ''))
    .filter(Boolean)
  const hasMoreFrames = rows.length > MAX_CURRENT_ROLL_FRAMES
  const summary = frameIds.length > 0
    ? `visible frames · ${frameIds.join(' · ')}${hasMoreFrames ? ' · …' : ''}`
    : `${visibleRows.length}${hasMoreFrames ? '+' : ''} visible frames`
  const rollExcerpt = excerpt(
    traces
      .flatMap((trace) => [trace.summary, trace.excerpt])
      .filter(Boolean)
      .join(' '),
  )

  return {
    title: `photo roll · ${visibleRoll}`,
    slug: visibleRoll,
    lang: traces[0].lang,
    summary,
    excerpt: rollExcerpt,
    permalink: `/photos/${visibleRoll}`,
  }
}

function unsupportedResourcePage(page: never): never {
  throw new Error(`Unsupported NETRA resource page kind: ${String(page)}`)
}

async function getCurrentPage(
  client: NetraClient,
  page: NetraResourcePageContext,
): Promise<NetraResult | null> {
  switch (page.kind) {
    case 'article':
      return getLocalizedResource(client, 'article', page.fileNum, page.lang)
    case 'fiction':
      return getLocalizedResource(client, 'fiction', page.slug, page.lang)
    case 'photo-entry':
      return getCurrentPhotoEntry(client, page.roll, page.id, page.lang)
    case 'photo-roll':
      return getCurrentPhotoRoll(client, page.roll)
    default:
      return unsupportedResourcePage(page)
  }
}

/** Bind every NETRA read to the request's cookie-aware, RLS-governed client. */
export function createNetraKnowledge(client: NetraClient): NetraKnowledge {
  return {
    searchEntries: ({ query, filter, limit }) =>
      searchEntries(client, query, filter, limit),
    getEntry: ({ slugOrFileNum, lang }) =>
      getEntry(client, slugOrFileNum, lang),
    listRecentPatches: ({ days }) => listRecentPatches(client, days),
    searchPhotos: ({ query, limit }) => searchPhotos(client, query, limit),
    listFiction: () => listFiction(client),
    getCurrentPage: (page) => getCurrentPage(client, page),
  }
}
