# NETRA agent core

> Contract version · S1 / `TASK-2026-08-30-NETRA-AGENT-CORE`
> Prompt version · `2.0.0`
> Public module · `@/lib/netra`

`runNetraTurn(input, dependencies)` is the only agent-core runtime entry point.
It streams one NETRA turn while knowing nothing about Next.js, HTTP, Vercel AI
Gateway, Supabase, Redis, cookies, environment variables, or browser state.

## Dependency direction

```text
NetraNavigator
  -> POST /api/chat
    -> createNetraGatewayRuntime({ configuredModel, sessionId })
    -> runNetraTurn(input, { model, providerOptions, knowledge })
      -> createNetraTools(knowledge, normalizedPage)
        -> NetraKnowledge
          -> request-scoped RLS adapter
```

The route owns request validation, quota, provider construction, response
headers, safe error envelopes, and stream-error logging. The knowledge adapter
owns authorization, RLS, query hardening, and storage mapping. The core owns
page normalization, prompt assembly, tool selection affordances, public result
projection, the rolling context bound, and the model-step bound.

## Module map

| Change | File |
| --- | --- |
| Public facade and imports for consumers | `lib/netra/index.ts` |
| Plain input, page, trace, and knowledge contracts | `lib/netra/contracts.ts` |
| Public-path normalization and resource identifiers | `lib/netra/page-context.ts` |
| Static prompt prefix and per-turn request context | `lib/netra/prompts/system.ts` |
| Request-bound read-only tool factory | `lib/netra/tools/index.ts` |
| Three-step AI SDK runtime | `lib/netra/run-turn.ts` |
| Build-time docent/owner material | `lib/netra/corpus-snapshot.json`, `lib/netra/soul-snapshot.json` |

## Public contracts

```ts
type NetraTurnInput = {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  servedLang: 'en' | 'th'
  page: { pathname: string }
  abortSignal?: AbortSignal
}

type NetraTurnDependencies = {
  model: LanguageModel
  knowledge: NetraKnowledge
  providerOptions?: ToolLoopAgentSettings<never, NetraTools>['providerOptions']
  onFinish?: () => void | PromiseLike<void>
}

async function runNetraTurn(
  input: NetraTurnInput,
  dependencies: NetraTurnDependencies,
): Promise<NetraTurnResult>
```

`NetraTurnResult` is the installed AI SDK's `StreamTextResult`. Altair can keep
using `toTextStreamResponse()`. `abortSignal` is passed unchanged to
`ToolLoopAgent.stream()`. The core keeps the latest 10 messages, uses
`stepCountIs(3)`, and caps generated output at 600 tokens; no turn can make more
than three model calls. Request-scoped Gateway attribution and fallback options
are injected through the same typed dependency seam and covered by the fake
model suite.

The storage port is deliberately method-shaped rather than query-shaped:

```ts
interface NetraKnowledge {
  searchEntries(input: {
    query: string
    filter: 'articles' | 'photos' | 'fiction' | 'all'
    limit: number
  }): Promise<readonly NetraTrace[]>

  getEntry(input: {
    slugOrFileNum: string
    lang: 'en' | 'th'
  }): Promise<NetraTrace | null>

  listRecentPatches(input: { days: number }): Promise<readonly NetraPatchTrace[]>
  searchPhotos(input: { query: string; limit: number }): Promise<readonly NetraTrace[]>
  listFiction(): Promise<readonly NetraTrace[]>
  getCurrentPage(page: NetraResourcePageContext): Promise<NetraTrace | null>
}

type NetraTrace = {
  title: string
  slug: string
  lang: 'en' | 'th'
  summary: string
  excerpt: string
  permalink: string
}
```

`createNetraTools` projects these six trace fields explicitly and re-applies
the 800-character excerpt cap. Extra adapter properties cannot reach the model.
Adapters must still omit full bodies, coordinates, auth fields, draft controls,
and other private columns at the query boundary.

## Normalized page context

Call `resolveNetraPageContext(pathname, servedLang)`. A locale prefix wins for
resource lookup; otherwise `servedLang` is the fallback. English public URLs
may be bare because the proxy can rewrite them internally.

| Public hint | Context |
| --- | --- |
| `/`, `/en`, `/th` | `home` |
| `/archive`, `/{lang}/archive` | `archive` |
| `/articles/002`, `/{lang}/articles/002` | `article { fileNum }` |
| `/fiction/transmission-001`, `/{lang}/fiction/transmission-001` | `fiction { slug }` |
| `/photos`, `/{lang}/photos` | `photos-index` |
| `/photos/2026-05-bangkok`, localized equivalent | `photo-roll { roll }` |
| `/photos/2026-05-bangkok/DSCF0002`, localized equivalent | `photo-entry { roll, id }` |

Query strings, hashes, and one trailing slash are stripped. The resolver rejects
oversized paths, encoded or backslash paths, control characters, duplicate
slashes, malformed identifiers, extra segments, and private roots such as
`/api`, `/console`, and `/_next`. Unknown results retain no raw pathname. This
is prompt-injection containment, not authorization: the page hint never grants
read access and every dynamic lookup still goes through request-scoped RLS.

Static pages (`home`, `archive`, `photos-index`) are described by the authored
docent snapshot. Resource pages (`article`, `fiction`, `photo-roll`,
`photo-entry`) are the only page contexts passed to
`NetraKnowledge.getCurrentPage`.

## Tool-selection contract

| Visitor intent | Preferred behavior |
| --- | --- |
| Greeting, navigation, or static docent question | Answer directly from static prompt context |
| “What is this page about?” on a resource page | `get_current_page` |
| Exact file number or slug | `get_entry` |
| Archive-wide topic | `search_entries` |
| Photo-only discovery | `search_photos` |
| Recent changes or repairs | `list_recent_patches` |
| Fiction shelf overview | `list_fiction` |
| Genuinely split target | Ask one concise clarification |
| Empty retrieval | Stop and say `no trace surveyed` |

The model chooses whether and which tool to call. There is no classifier,
planner, forced first tool, workflow registry, or plugin layer. `get_site_map`
and `get_owner_context` no longer exist: both are static snapshots in the
prompt prefix.

## Integration API

### Procyon · storage adapter

Export a request-scoped factory from Procyon's territory with this boundary:

```ts
function createNetraKnowledge(client: NetraClient): NetraKnowledge
```

Map the five existing reads to the object arguments above. Implement
`getCurrentPage` with an exhaustive switch:

- `article` -> visible entry by `page.fileNum` and `page.lang`
- `fiction` -> visible entry by `page.slug` and `page.lang`
- `photo-roll` -> visible roll resource by `page.roll`
- `photo-entry` -> visible photo resource by `page.roll` + `page.id`

The adapter must close over the request's Supabase client. It must not construct
a singleton, use a service role, return Supabase types, or accept `unknown`
page contexts.

### Altair · HTTP and provider adapter

The request body adds a required bounded hint:

```ts
page: z.object({
  pathname: z.string().min(1).max(NETRA_MAX_PATHNAME_LENGTH),
})
```

Resolve it before quota consumption. Return `400 INVALID_BODY` for a missing
hint or a resolver result with `kind: 'unknown'`. Then replace route-owned
`streamText`, `NETRA_SYSTEM_PROMPT`, `netraTools`, and `experimental_context`
assembly with:

```ts
const knowledge = createNetraKnowledge(await createSupabaseServerClient())
const result = await runNetraTurn(
  {
    messages: parsed.messages,
    servedLang: parsed.served_lang,
    page: parsed.page,
    abortSignal: request.signal,
  },
  {
    model: gatewayRuntime.model,
    providerOptions: gatewayRuntime.providerOptions,
    knowledge,
  },
)

void result.consumeStream({
  onError: (error) => logSafeError('upstream stream unavailable', error),
})

return result.toTextStreamResponse({ headers })
```

`createNetraGatewayRuntime` accepts only the explicit `-free` model allowlist,
defaults to `minimax/minimax-m3-free`, falls back only to
`minimax/minimax-m2.7-free`, attributes usage to the canonical post-quota
session ID, and fails closed for every other `NETRA_MODEL` value. Vercel's
project-level AI Gateway budget is the hard daily spend control; the route must
not maintain an estimated-cost counter. Keep parse-before-quota, cookie/session
handling, optional Redis-backed shared quota, safe error envelopes, and response
headers in the route. Vercel deployments authenticate Gateway through OIDC, so
the application does not require an OpenRouter key.

### Sirius · client transport

Send only the current pathname alongside the existing fields:

```ts
JSON.stringify({
  messages: next.slice(-10),
  served_lang: locale,
  page: { pathname },
})
```

`pathname` comes from the documented Next 16 `usePathname()` hook. Do not send
a page kind, ids as separate authority-bearing fields, DOM text, page bodies,
permissions, or a requested tool.

## Offline fakes

No live provider or store is needed. A fake knowledge source is a plain object:

```ts
const knowledge: NetraKnowledge = {
  searchEntries: async () => [],
  getEntry: async () => null,
  listRecentPatches: async () => [],
  searchPhotos: async () => [],
  listFiction: async () => [],
  getCurrentPage: async (page) => ({
    title: page.kind,
    slug: 'fixture',
    lang: page.lang,
    summary: 'fixture trace',
    excerpt: 'fixture excerpt',
    permalink: page.pathname,
  }),
}
```

Use the installed SDK's `MockLanguageModelV3` from `ai/test` and
`simulateReadableStream` from `ai` as the `model` dependency. The mock's
`doStreamCalls` array exposes the normalized system prompt, bounded messages,
and offered tools for deterministic assertions. No OpenRouter key, browser,
Redis, or Supabase process is involved.

After S2/S3/S5 integration, the copy-paste deterministic gate is:

```bash
npx tsc --noEmit && node --import tsx --test tests/netra/agent-core.test.ts
```

The model-backed corpus in `tests/netra/eval-prompts.md` remains a separate,
credentialed evaluation lane and must not run with production keys.

## Extension seams

- New provider: change only the route-side runtime factory and keep the
  `LanguageModel` / `providerOptions` core seam intact.
- New storage/retriever: implement `NetraKnowledge`; do not change prompt or route.
- New public page kind: extend the page union + resolver, then the adapter's
  exhaustive `getCurrentPage` switch and page-context evals.
- New read tool: add the narrow port method only if storage is needed, add one
  factory tool and one prompt selection rule, then add deterministic + eval
  cases. Do not add a registry or plugin framework.
- New static docent or owner material: update its build-time snapshot source;
  do not model it as a fake tool call.
