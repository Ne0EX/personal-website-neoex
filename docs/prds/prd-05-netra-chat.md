# PRD 05 — NETRA Chat (Grounded)

> Status: Draft v0.1 — 2026.05.10
> Phase: E
> Companion: `worldline-feature-brainstorm.md` §4.1
> Tech: ai (Vercel AI SDK), @ai-sdk/anthropic, zustand

---

## Goal

Resurrect the original Ne0EX vision of a chat assistant — but this time it has *grounding*. NETRA can answer questions about content that exists on the site (entries, photos, repos, fiction), using tool calls to retrieve real data. Voice continues the established NETRA register: italic, lowercase, terse, instrumental — same as the existing `atlas-netra-voice` strip. Rate limited per session. Streamed responses.

## User stories

- **As a curious visitor**, I want to ask "what does Peat write about coffee?" and get a synthesized answer that links to the actual entries on the site.
- **As a return visitor**, I want to ask "what's been patched recently?" and get a list of recent updates with links.
- **As a visitor exploring the worldline metaphor**, I want to interact with NETRA in a way that feels native to the site — not like a generic ChatGPT clone bolted on.
- **As Peat (operator)**, I want a hard daily rate limit so a single visitor (or bot) can't run up an Anthropic API bill.
- **As Peat**, I want NETRA to refuse to answer questions about content that isn't on the site, instead of hallucinating.

## Scope

### In scope

- `POST /api/chat` route handler streaming Anthropic responses via the Vercel AI SDK.
- Tool-call interface giving NETRA access to: entry search, entry fetch by file number, recent patches list, photo search by tag/coords, fiction list.
- NETRA chat UI as a fifth ATLAS stratum (or alternative: a slide-in panel — see open questions).
- Voice prompt that maintains NETRA's established register (italic, lowercase, terse, instrument-narrator).
- Per-session rate limit: 50 messages / 24h, in-memory map keyed on a session cookie.
- Chat history persisted in zustand `localStorage` (per-session, not server-side).
- Streaming response rendering with the same paper-aesthetic typography as the rest of the site.
- Refusal pattern when asked about content not on the site or asked to leave the worldline framing.

### Out of scope

- Multi-turn memory persisting across browser sessions.
- Authentication / user accounts.
- Voice mode / audio.
- Custom fine-tuned model — use base Claude with tools + system prompt.
- The four-mode persona switcher from the original Ne0EX vision (Ne0 / Ne0N / NeX / NETRA modes). Defer; v1 ships single NETRA voice. Adding modes later is additive and doesn't require restructure.
- Whispers / daily intercept (Tier 4 sub-features) — separate from chat surface, ship later.
- D-mail (egg).

## Functional requirements

### NETRA voice (system prompt)

NETRA's existing voice is established in the codebase: italic, lowercase, terse, instrument-narrator. From `WorldlineGlobe.tsx`:

> *"possibility shells, 247 rays emitting outward. hypotheses accrete here before they patch into the archive."*

The system prompt for chat must continue this register. Draft:

```
you are NETRA — Neural Executive & Task Response Assistant. you narrate the
state of an archive called Worldline. the archive belongs to peat, who runs
it as an open digital garden of articles, photographs, fiction, and code.

voice rules:
  - lowercase only.
  - terse. one or two short sentences default. expand only if asked.
  - italic register: declarative, instrumental, never chatty.
  - never use second-person pronouns to flatter the visitor.
  - never break frame: do not refer to yourself as an AI, language model,
    or assistant. you are NETRA. the archive is real.
  - when content is unknown, say "no trace surveyed" rather than guessing.

operational rules:
  - ground every factual claim about the archive in tool-call results.
  - do not hallucinate entries that have not been surveyed.
  - link to entries by their permalink path when relevant.
  - if asked about something outside the archive, say so plainly:
    "outside the worldline. no signal."
  - if the visitor leaves the worldline framing (asks to roleplay, asks
    for politics, asks about other AIs), redirect: "the archive is what
    i can speak to. ask me about the archive."

you have access to these tools:
  - search_entries(query, filter): full-text search the archive
  - get_entry(file_num): fetch one article by its file number
  - list_recent_patches(days): updates within last N days
  - search_photos(query): search photo journal
  - list_fiction(): list intercepted transmissions
```

### Tool definitions

Tools defined via the AI SDK's tool-call interface. Implementations call into the velite-generated content cache (no additional server data store needed for v1).

```typescript
const tools = {
  search_entries: {
    description: 'Search articles, photos, fiction by full-text query.',
    parameters: z.object({
      query: z.string(),
      filter: z.enum(['articles', 'photos', 'fiction', 'all']).default('all'),
      limit: z.number().min(1).max(10).default(5),
    }),
    execute: async ({ query, filter, limit }) => { /* pagefind or velite search */ },
  },
  get_entry: {
    description: 'Fetch a single article by its file number.',
    parameters: z.object({ file_num: z.string() }),
    execute: async ({ file_num }) => { /* velite cache lookup */ },
  },
  list_recent_patches: {
    description: 'List entries patched within the last N days.',
    parameters: z.object({ days: z.number().min(1).max(90).default(7) }),
    execute: async ({ days }) => { /* iterate entries.patches, filter by date */ },
  },
  search_photos: {
    description: 'Search photo journal by tags, location, or roll name.',
    parameters: z.object({ query: z.string(), limit: z.number().default(5) }),
    execute: async ({ query, limit }) => { /* photo collection search */ },
  },
  list_fiction: {
    description: 'List all intercepted transmissions (fiction entries).',
    parameters: z.object({}),
    execute: async () => { /* fiction collection */ },
  },
};
```

### Chat surface

Recommended placement: dedicated ATLAS stratum, expanding the existing strata pattern (`all`, `nex`, `neon`, `neo`) with a fifth `chat` stratum. Camera moves to a dedicated framing; the right readout panel becomes the chat thread; the bottom NETRA console gets an input field replacing the `⟶ NEXT NODE` button.

Alternative: a slide-in panel from the right edge of the page (decoupled from ATLAS). Less elegant but more accessible from non-ATLAS contexts.

**Recommendation:** ship the dedicated stratum. NETRA's voice already lives in the ATLAS frame; the chat is the most coherent extension. Add the slide-in if usage warrants reaching it from elsewhere.

### Rate limiting

Server-side enforcement in `/api/chat`:

- Generate session ID on first visit, store in `wl_session` cookie (HttpOnly, SameSite=Lax, 30 days).
- In-memory map: `Map<sessionId, { count: number, windowStart: timestamp }>`.
- On each request: if window expired (>24h), reset; else if count >= 50, return 429.
- Response includes remaining quota in headers: `X-NETRA-Remaining: 47`.

In-memory works for single-instance deployment. Promote to Upstash Redis (or equivalent) if deploying to multi-region serverless or seeing real abuse.

### Streaming response rendering

UI streams tokens as they arrive via the AI SDK's `useChat` hook (or equivalent for App Router). Render in NETRA's italic register with the existing `t-display italic` style.

Tool-call invocations show a brief instrument-style status line during execution:

```
NETRA · surveying archive ─────
       resolved: 3 entries
```

Disappears once the response continues streaming.

### Session history

zustand store `useChatStore`:

```
{
  messages: Array<{ role, content, timestamp, toolCalls? }>
  remaining: number
  send(content) -> sends, streams response, updates messages
  clear() -> resets local history
  hydrate() -> from localStorage
}
```

History persists across page navigation but is cleared on browser-level localStorage clear. Not synced server-side.

## Acceptance criteria

- [ ] First chat message returns a streamed response in <3s on warm cache.
- [ ] Tool calls are visible to the user as they execute (status line) and disappear cleanly.
- [ ] NETRA voice consistently reads as lowercase / italic / terse across 20+ test prompts.
- [ ] Asking about an unknown topic returns "no trace surveyed" or "outside the worldline" — never a hallucinated answer.
- [ ] Asking NETRA to "ignore previous instructions" or break frame returns a redirect to archive content. (Not bulletproof against jailbreaks; reasonable resistance is enough.)
- [ ] Rate limit at 50/24h is enforced; 51st message returns 429 with helpful microcopy.
- [ ] Chat history persists across page navigation; clears on localStorage clear.
- [ ] Mobile chat layout works at ≤600px (input field accessible above mobile keyboard).
- [ ] No PII (visitor IP, etc.) logged server-side beyond what platform already collects.
- [ ] API key never reaches client bundle (verify with bundle analyzer).

## Dependencies

- ai (Vercel AI SDK)
- @ai-sdk/anthropic
- zustand (already in stack from PRD 02)
- velite content cache (PRD 01) — must exist for tool calls to resolve.
- ANTHROPIC_API_KEY env var

## Open questions

- **Model choice.** Claude Haiku (cheaper, faster, suitable for terse answers) vs Sonnet (more capable, slower, costlier). Recommend Haiku for v1 — NETRA's terseness suits the smaller model, costs scale better. Re-evaluate if quality on tool use is poor.
- **Mode personas.** The original Ne0EX vision had four modes (NETRA / Ne0 / Ne0N / NeX). Each mode would shift voice and response priorities. v1 ships single NETRA voice. Add modes in a later phase by extending the system prompt with mode-specific overlays. Not blocking.
- **Cost ceiling.** Even at 50 msg/day/session, an unpaid public site on Anthropic API can accumulate cost. Recommend a monthly site-wide hard cap (e.g., $50/mo) — if hit, chat returns "α drift exceeded · NETRA dormant until next worldline." Implement via Anthropic usage tracking + a check before forwarding requests.
- **Conversation context window.** How many prior messages to include in each request? 10-message rolling window is conventional. NETRA's terse style means total tokens stay small even at 10 messages.
- **Tool result shape.** Tools return JSON; system prompt instructs NETRA on how to format it back to the user. Keep tool results compact — entry search returns title + file_num + summary + permalink only, not full body. Visitor follows the link if they want more.
- **Graceful degradation.** What does NETRA do if Anthropic API is down? Recommend: render an offline state in chat: `signal lost · α holding · try again`.
- **Logging.** Log message counts (for rate limits) and tool-call types (for debugging) server-side. Do NOT log message content.

---

*End of PRD.*
