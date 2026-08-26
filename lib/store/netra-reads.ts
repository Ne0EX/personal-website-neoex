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

const ENTRY_COLUMNS = 'slug,kind,title,lang,summary,body,date,iso_date,patches,roll,photo_id'

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
  let request = client.from('entries').select(ENTRY_COLUMNS).or(`title.ilike.%${query}%,summary.ilike.%${query}%,body.ilike.%${query}%`)
  if (filter === 'articles') request = request.eq('kind', 'article')
  if (filter === 'photos') request = request.eq('kind', 'photo')
  if (filter === 'fiction') request = request.eq('kind', 'fiction')
  const { data, error } = await request.order('iso_date', { ascending: false }).limit(Math.min(10, Math.max(1, limit)))
  if (error) throw new Error(`NETRA search failed: ${error.message}`)
  return ((data ?? []) as Record<string, unknown>[]).map(mapRow)
}

export async function getEntry(client: NetraClient, slugOrFileNum: string, lang = 'en'): Promise<NetraResult | null> {
  const { data, error } = await client.from('entries').select(ENTRY_COLUMNS).eq('slug', slugOrFileNum).in('lang', Array.from(new Set([lang, 'en']))).order('lang')
  if (error) throw new Error(`NETRA entry failed: ${error.message}`)
  const rows = (data ?? []) as Record<string, unknown>[]
  return (rows.find((row) => row.lang === lang) ?? rows.find((row) => row.lang === 'en') ?? null) && mapRow(rows.find((row) => row.lang === lang) ?? rows.find((row) => row.lang === 'en')!)
}

export async function listRecentPatches(client: NetraClient, days = 7): Promise<Array<NetraResult & { patch: { n: number; date: string; note: string } }>> {
  const { data, error } = await client.from('entries').select(ENTRY_COLUMNS).not('patches', 'is', null).order('iso_date', { ascending: false }).limit(100)
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
  const { data, error } = await client.from('entries').select(ENTRY_COLUMNS).eq('kind', 'fiction').order('iso_date', { ascending: false }).limit(50)
  if (error) throw new Error(`NETRA fiction failed: ${error.message}`)
  return ((data ?? []) as Record<string, unknown>[]).map(mapRow)
}
