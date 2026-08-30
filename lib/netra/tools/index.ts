import { tool } from 'ai'
import { z } from 'zod'
import type {
  NetraKnowledge,
  NetraPageContext,
  NetraPatchTrace,
  NetraTrace,
} from '@/lib/netra/contracts'
import { isNetraResourcePage } from '@/lib/netra/page-context'

const MAX_EXCERPT_LENGTH = 800
const MAX_LIST_RESULTS = 10

/** Project adapter values so accidental extra store fields never reach the model. */
function publicTrace(trace: NetraTrace): NetraTrace {
  return {
    title: trace.title,
    slug: trace.slug,
    lang: trace.lang,
    summary: trace.summary,
    excerpt: trace.excerpt.slice(0, MAX_EXCERPT_LENGTH),
    permalink: trace.permalink,
  }
}

function publicPatchTrace(trace: NetraPatchTrace): NetraPatchTrace {
  return {
    ...publicTrace(trace),
    patch: {
      n: trace.patch.n,
      date: trace.patch.date,
      note: trace.patch.note,
    },
  }
}

function pageReference(page: NetraPageContext): Record<string, unknown> {
  switch (page.kind) {
    case 'article':
      return { kind: page.kind, pathname: page.pathname, lang: page.lang, fileNum: page.fileNum }
    case 'fiction':
      return { kind: page.kind, pathname: page.pathname, lang: page.lang, slug: page.slug }
    case 'photo-roll':
      return { kind: page.kind, pathname: page.pathname, lang: page.lang, roll: page.roll }
    case 'photo-entry':
      return { kind: page.kind, pathname: page.pathname, lang: page.lang, roll: page.roll, id: page.id }
    case 'home':
    case 'archive':
    case 'photos-index':
      return { kind: page.kind, pathname: page.pathname, lang: page.lang }
    case 'unknown':
      return { kind: page.kind, pathname: null, lang: page.lang, reason: page.reason }
  }
}

/**
 * Creates one read-only tool set for one request.
 *
 * Knowledge and page context are lexical dependencies by design. Tool
 * execution never recovers request state from AI SDK context or module state.
 */
export function createNetraTools(
  knowledge: NetraKnowledge,
  page: NetraPageContext,
) {
  return {
    get_current_page: tool({
      description: 'Retrieve the visible archive resource represented by the captured current article, fiction, photo roll, or photo page. Use for questions that refer to "this page". Static index and home pages are already described in prompt context.',
      inputSchema: z.object({}),
      execute: async () => {
        if (!isNetraResourcePage(page)) {
          return {
            status: page.kind === 'unknown' ? 'unresolved' : 'static-context',
            page: pageReference(page),
            trace: null,
          }
        }

        const trace = await knowledge.getCurrentPage(page)
        return {
          status: trace ? 'resolved' : 'not-found',
          page: pageReference(page),
          trace: trace ? publicTrace(trace) : null,
        }
      },
    }),
    search_entries: tool({
      description: 'Search session-visible archive entries by words. Use for archive-wide topics or when no exact resource identifier is known.',
      inputSchema: z.object({
        query: z.string().min(1).max(200),
        filter: z.enum(['articles', 'photos', 'fiction', 'places', 'all']).default('all'),
        limit: z.number().int().min(1).max(10).default(5),
      }),
      execute: async (input) => {
        const traces = await knowledge.searchEntries(input)
        return traces.slice(0, input.limit).map(publicTrace)
      },
    }),
    get_entry: tool({
      description: 'Fetch one session-visible archive entry by exact file number or slug. Use when the visitor names a specific entry.',
      inputSchema: z.object({
        slugOrFileNum: z.string().min(1).max(120),
        lang: z.enum(['en', 'th']).optional(),
      }),
      execute: async (input) => {
        const trace = await knowledge.getEntry({
          slugOrFileNum: input.slugOrFileNum,
          lang: input.lang ?? page.lang,
        })
        return trace ? publicTrace(trace) : null
      },
    }),
    list_recent_patches: tool({
      description: 'List recent visible archive patches. Use only for questions about changes or recent repairs.',
      inputSchema: z.object({
        days: z.number().int().min(1).max(90).default(7),
      }),
      execute: async (input) => {
        const traces = await knowledge.listRecentPatches(input)
        return traces.slice(0, MAX_LIST_RESULTS).map(publicPatchTrace)
      },
    }),
    search_photos: tool({
      description: 'Search visible photo journal entries by words. Use for photo-specific subject, roll, or field-note questions.',
      inputSchema: z.object({
        query: z.string().min(1).max(200),
        limit: z.number().int().min(1).max(10).default(5),
      }),
      execute: async (input) => {
        const traces = await knowledge.searchPhotos(input)
        return traces.slice(0, input.limit).map(publicTrace)
      },
    }),
    list_fiction: tool({
      description: 'List visible fiction transmissions. Use for a fiction shelf overview, not for article or photo questions.',
      inputSchema: z.object({}),
      execute: async () => {
        const traces = await knowledge.listFiction()
        return traces.slice(0, MAX_LIST_RESULTS).map(publicTrace)
      },
    }),
    list_places: tool({
      description: 'List visible ATLAS place nodes. Use for place overviews; coordinates are never available.',
      inputSchema: z.object({}),
      execute: async () => {
        const traces = await knowledge.listPlaces()
        return traces.slice(0, MAX_LIST_RESULTS).map(publicTrace)
      },
    }),
  }
}

export type NetraTools = ReturnType<typeof createNetraTools>
