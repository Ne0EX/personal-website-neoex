import { tool } from 'ai'
import { z } from 'zod'
import { getEntry, listFiction, listRecentPatches, searchEntries, searchPhotos, type NetraClient } from '@/lib/store/netra-reads'
import soulSnapshot from '@/lib/netra/soul-snapshot.json'

type Context = { supabase: NetraClient; lang: 'en' | 'th' }
function context(value: unknown): Context {
  const result = value as Partial<Context> | undefined
  if (!result?.supabase) throw new Error('NETRA read context unavailable')
  return result as Context
}

export const netraTools = {
  search_entries: tool({
    description: 'search published or session-visible archive entries by words',
    inputSchema: z.object({ query: z.string().min(1).max(200), filter: z.enum(['articles', 'photos', 'fiction', 'all']).default('all'), limit: z.number().int().min(1).max(10).default(5) }),
    execute: (input, options) => searchEntries(context(options.experimental_context).supabase, input.query, input.filter, input.limit),
  }),
  get_entry: tool({
    description: 'fetch one session-visible entry by file number or slug',
    inputSchema: z.object({ slugOrFileNum: z.string().min(1).max(120), lang: z.enum(['en', 'th']).optional() }),
    execute: (input, options) => { const ctx = context(options.experimental_context); return getEntry(ctx.supabase, input.slugOrFileNum, input.lang ?? ctx.lang) },
  }),
  list_recent_patches: tool({
    description: 'list recent visible patches from the archive',
    inputSchema: z.object({ days: z.number().int().min(1).max(90).default(7) }),
    execute: (input, options) => listRecentPatches(context(options.experimental_context).supabase, input.days),
  }),
  search_photos: tool({
    description: 'search visible photo journal entries by words',
    inputSchema: z.object({ query: z.string().min(1).max(200), limit: z.number().int().min(1).max(10).default(5) }),
    execute: (input, options) => searchPhotos(context(options.experimental_context).supabase, input.query, input.limit),
  }),
  list_fiction: tool({
    description: 'list visible fiction transmissions',
    inputSchema: z.object({}),
    execute: (_input, options) => listFiction(context(options.experimental_context).supabase),
  }),
  get_site_map: tool({
    description: 'explain the authored map of public site areas',
    inputSchema: z.object({}),
    execute: async () => ({ map: 'atlas, archive, photos, fiction, articles; console-boundary is not surveyed.' }),
  }),
  get_owner_context: tool({
    description: 'read the explicitly surveyed public-safe owner context',
    inputSchema: z.object({}),
    execute: async () => soulSnapshot.present ? soulSnapshot.content : { present: false, message: 'that boundary is not surveyed.' },
  }),
}
