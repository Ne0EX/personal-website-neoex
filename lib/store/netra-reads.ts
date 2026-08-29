/** Request-scoped, RLS-backed reads for NETRA. Never use the anon singleton here. */
import type { SupabaseClient } from '@supabase/supabase-js'

export type NetraClient = SupabaseClient
export type NetraFilter = 'articles' | 'photos' | 'fiction' | 'all'

export interface NetraResult {
  title: string
  slug: string
  lang: string
  summary: string
  excerpt: string
  permalink: string
}

const RESULT_COLUMNS = 'slug,kind,title,lang,summary,body,roll,photo_id'
const PATCH_COLUMNS = `${RESULT_COLUMNS},patches`
const SEARCH_COLUMNS = ['title', 'summary', 'body'] as const
const SEARCH_TOKEN_PATTERN = /[\p{L}\p{M}\p{N}]+/gu
const MAX_SEARCH_QUERY_LENGTH = 200
const MAX_SEARCH_TOKENS = 8
const MAX_SEARCH_TOKEN_LENGTH = 64

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

function permalink(kind: string, slug: string, roll?: string | null, photoId?: string | null): string {
  if (kind === 'article') return `/articles/${slug}`
  if (kind === 'fiction') return `/fiction/${slug}`
  return `/photos/${roll ?? slug}/${photoId ?? ''}`.replace(/\/$/, '')
}

function mapRow(row: Record<string, unknown>): NetraResult {
  return {
    title: String(row.title ?? row.slug ?? ''),
    slug: String(row.slug ?? ''),
    lang: String(row.lang ?? 'en'),
    summary: String(row.summary ?? ''),
    excerpt: excerpt(String(row.body ?? '')),
    permalink: permalink(String(row.kind), String(row.slug), row.roll as string | null, row.photo_id as string | null),
  }
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

export async function getEntry(client: NetraClient, slugOrFileNum: string, lang = 'en'): Promise<NetraResult | null> {
  const { data, error } = await client.from('entries').select(RESULT_COLUMNS).eq('slug', slugOrFileNum).in('lang', Array.from(new Set([lang, 'en']))).order('lang')
  if (error) throw new Error(`NETRA entry failed: ${error.message}`)
  const rows = (data ?? []) as Record<string, unknown>[]
  const row = rows.find((candidate) => candidate.lang === lang) ?? rows.find((candidate) => candidate.lang === 'en')
  return row ? mapRow(row) : null
}

export async function listRecentPatches(client: NetraClient, days = 7): Promise<Array<NetraResult & { patch: { n: number; date: string; note: string } }>> {
  const { data, error } = await client.from('entries').select(PATCH_COLUMNS).not('patches', 'is', null).order('iso_date', { ascending: false }).limit(100)
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
