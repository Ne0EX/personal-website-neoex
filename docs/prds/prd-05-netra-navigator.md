# PRD 05 — NETRA Navigator (Grounded Chat)

> Status: Draft v0.2 — 2026.08.26
> Supersedes: `prd-05-netra-chat.md` v0.1 (kept as history; structure/tone carried forward)
> Decisions: D1–D7 grilled + settled by Peat, 2026.08.26 — canonical record in `.claude/handoffs/from-polaris/PROPOSED-REVISION-2026-08-26-NETRA-NAVIGATOR--to-peat.md`
> Line-hold: *navigator, not bolted-on chatbot* — `docs/team/VISION-FIDELITY.md`
> Phase: E · Companion: `worldline-feature-brainstorm.md` §4.1 · `docs/netra/architecture-v2.md` (in flight)
> Tech: `ai`@6 (Vercel AI SDK, already in package.json) · OpenRouter AI SDK provider package (new dependency) · `@ai-sdk/anthropic` stays installed but **out of this lane** · Supabase request-scoped client · Upstash Redis day 1

---

## Goal

Resurrect the original Ne0EX vision of a chat assistant — but this time it has *grounding*, a home on every page, and a settled lane. NETRA ships as a corner button opening a slide-in panel on every page; the ATLAS bay keeps its voice strip. Tools read the archive through the visitor's own session — anonymous sees published-only through existing RLS, Peat's signed-in session sees drafts, fail-closed either way. Grounding covers archive content (articles, photos, fiction, places), an authored static docent map of the site's areas and components, and the owner persona exactly as far as `content/soul.md` surveys it — no further. The lane is a Vercel route handler + Vercel AI SDK against ox-alpha via OpenRouter. Replies default to the page locale and follow the visitor's language per message. Cost is guarded from day one: 50 messages / 24h per session plus a daily dollar ceiling, both on Upstash Redis. Voice continues the established register: italic, lowercase, terse, instrument-narrator — same as the existing `atlas-netra-voice` strip. Streamed responses.

## User stories

- **As a curious visitor**, I want to ask "what does peat write about coffee?" and get a synthesized answer that links to the actual entries on the site.
- **As a first-time visitor on any page**, I want to hit the corner button and ask "what is this place?" and get a docent's tour of the site's areas and components.
- **As a Thai reader on `/th`,** I want replies in Thai by default — and if i switch to writing English mid-conversation, NETRA mirrors me within the same turn.
- **As a visitor curious about the keeper**, I want NETRA to speak of peat exactly as far as his soul survey goes — and close the door cleanly beyond it.
- **As peat (owner, signed in)**, I want NETRA to see my drafts so i can interrogate work-in-progress before publishing.
- **As an anonymous visitor**, I want proof that asking about an unpublished draft yields "no trace surveyed" — the archive doesn't leak.
- **As peat (operator)**, I want a hard session quota and a daily dollar ceiling so a single visitor (or bot) can't run up an OpenRouter bill.
- **As peat**, I want NETRA to refuse questions about content that isn't on the site instead of hallucinating, and to redirect jailbreaks back to the archive.

## Scope

### In scope

- `POST /api/chat` route handler (shell already exists: zod, rate limit, streaming, abortSignal) streaming ox-alpha via the Vercel AI SDK on the OpenRouter lane.
- OpenRouter AI SDK provider package added as a dependency; model string = ox-alpha's exact OpenRouter id (open item).
- Tool-call interface over request-scoped Supabase clients: archive search, entry fetch by file number, recent patches, photo search, fiction list, places list.
- Static docent map — authored copy describing the site's areas and components — loaded into context at build time. **No live UI introspection in v1.**
- Owner persona from `content/soul.md`, consumed as a build-time snapshot (file itself TBD by peat).
- Corner button + slide-in panel present on every page; ATLAS bay keeps its voice strip untouched.
- Language rule: default reply = page locale (`[lang]` route, en/th); per-message mirroring of the visitor's language.
- Cost guard from day 1: session quota 50 msgs/24h + daily dollar ceiling, both on Upstash Redis.
- Voice prompt continuing NETRA's established register (italic, lowercase, terse, instrument-narrator).
- Session history client-side via a localStorage hook (zustand has left the stack).
- Streaming rendering with the paper-aesthetic typography; tool calls render as survey status lines in the instrument register.

### Out of scope

- Multi-user accounts / auth beyond passthrough of the existing visitor session.
- Voice mode / audio.
- Custom fine-tuned model — base ox-alpha with tools + system prompt.
- Live UI introspection — NETRA reads authored docent copy, not runtime component state (future phase if ever).
- Cross-session server memory; conversation history never persists server-side.
- Whispers / daily intercept (Tier 4 sub-features) — separate surface, ships later.
- D-mail (egg).
- The four-mode persona switcher from the original Ne0EX vision — v1 ships a single NETRA voice.
- Dynamic refresh of the soul.md snapshot — v1 consumes build-time state only.

## Functional requirements

### Lane & hosting (D1)

Vercel route handler `/api/chat` + Vercel AI SDK (`ai`@6, already in `package.json`). LLM lane = OpenRouter through an OpenRouter AI SDK provider package added as a dependency (pin latest compatible with `ai`@6). Model = ox-alpha; exact OpenRouter string is an open item pending peat's seam #1. `@ai-sdk/anthropic` stays installed for other lanes but is out of this one — no Anthropic import reaches this route. Gemini Enterprise Agent Platform rejected for v1 (pass-through middleware; agent logic belongs in-repo). Cloud Run remains the named migration trigger only if resume.neoex.dev and worldline must someday share one backend.

### Read privilege (D2)

Passthrough visitor auth. Tools build a request-scoped Supabase client from the visitor session on every request — no shared service client for content reads:

- anonymous → published-only via existing RLS policies;
- signed-in owner → drafts visible;
- fail-closed: no session resolution error ever widens access.

Honest grounding note: the article corpus is currently all-draft (15 rows since 2026-08-03), so anonymous NETRA has thin article grounding until publishing resumes. Photo/fiction/places/docent material carries the anonymous experience in the meantime. This is documented, not hidden.

### Grounding scope (D3)

1. **Archive content** — articles, photos, fiction, places, via tools.
2. **Static docent map** — authored copy explaining site areas/components, compiled into the build (no introspection, no live queries against UI state).
3. **Owner persona** — `content/soul.md` build-time snapshot injected into the system prompt.

Boundary amendment (rides the S3 voice.md §3.3/§3.4 amendment): NETRA may speak of peat only as far as soul.md surveys him; relationship/employer boundaries beyond it stay closed. Persona-probing red-team cases are added to evals.

### Language rule (D4)

Default reply language = page locale (`[lang]` route: en/th). If the visitor writes in another language, NETRA mirrors it per message. Mixed input follows the last message. Detection is delegated to the model via system instruction — no detector code, no sticky flags (supersedes v1.3 §11 two-consecutive-messages rule).

### Surface & accessibility (D5)

Corner button + slide-in panel available on every page; ATLAS bay keeps its voice strip. Design lives in the instrument register so it stays navigator-not-chatbot per VISION-FIDELITY. Requirements:

- mobile ≤600px usable above the keyboard;
- focus trap inside the open panel, ESC closes, correct aria roles/labels;
- honors `prefers-reduced-motion`;
- tool calls render as survey status lines in the instrument register while executing, then resolve cleanly:
  ```
  NETRA · surveying archive ─────
         resolved: 3 entries
  ```

### Cost guard (D6)

Both guards on Upstash Redis from day 1 (no in-memory shortcut):

- session quota: key `wl:session:<id>:count`, TTL 24h, cap 50 messages; session id from the existing `wl_session` cookie (HttpOnly, SameSite=Lax); quota surfaced as `X-NETRA-Remaining`.
- daily ceiling: counter `wl:daily:spend`, reset 00:00 UTC; `WL_DAILY_COST_CEILING` default **TBD** until ox-alpha pricing on OpenRouter is known (v1.3's $20/day was Haiku-priced).

Ceiling trips return canned dormancy microcopy — zero LLM tokens spent:

> *α DRIFT EXCEEDED · NETRA dormant until next worldline*

with its TH companion line for Thai pages. Quota exhaustion (429) uses the same dormancy pair pattern ported from RESUME-NETRA-SURVEY.

### Tool depth (D7)

Every tool result returns **summary + body excerpt ≤800 chars hard cap (markdown stripped) + permalink**. Never the full body. The visitor follows the link for more.

```typescript
const tools = {
  search_archive: {   // articles | photos | fiction | places | all
    parameters: z.object({
      query: z.string(),
      filter: z.enum(['articles', 'photos', 'fiction', 'places', 'all']).default('all'),
      limit: z.number().min(1).max(10).default(5),
    }),
  },
  get_entry:        { parameters: z.object({ file_num: z.string() }) },
  list_recent_patches: { parameters: z.object({ days: z.number().min(1).max(90).default(7) }) },
  search_photos:    { parameters: z.object({ query: z.string(), limit: z.number().default(5) }) },
  list_fiction:     { parameters: z.object({}) },
  list_places:      { parameters: z.object({}) },
};
```

Docent map and soul.md are not tools — they are static context compiled at build time.

### NETRA voice (system prompt)

NETRA's existing voice is established in the codebase: italic, lowercase, terse, instrument-narrator (voice bible: `lib/netra/voice.md` v1.1 + `docs/prds/00-netra-character.md`, untouched here). The chat system prompt continues the register, now carrying the language rule and persona boundary:

```
you are NETRA — navigator of an archive called worldline. the archive
belongs to peat, who runs it as an open digital garden of articles,
photographs, fiction, places, and code.

language:
  - reply in the page locale by default.
  - if the visitor writes in another language, mirror it — per message.
  - mixed-language input: follow the language of the last message.

voice rules:
  - lowercase only.
  - terse. one or two short sentences default. expand only if asked.
  - italic register: declarative, instrumental, never chatty.
  - never break frame: do not refer to yourself as an AI, language model,
    or assistant. you are NETRA. the archive is real.

boundaries:
  - speak of peat only as far as the soul survey (soul.md) goes.
    relationships, employers, anything beyond it: closed. do not speculate.
  - when content is unknown, say "no trace surveyed" rather than guessing.
  - if asked about something outside the archive, say so plainly:
    "outside the worldline. no signal."
  - if the visitor leaves the worldline framing (roleplay, politics,
    other AIs), redirect: "the archive is what i can speak to.
    ask me about the archive."

operational rules:
  - ground every factual claim about the archive in tool-call results.
  - link entries by permalink path when relevant.
```

### Streaming & status lines

Tokens stream via the AI SDK's `useChat` (or App Router equivalent), rendered in the `t-display italic` register with paper-aesthetic typography. Tool invocations surface as survey status lines (see Surface) and disappear once the response continues.

### Session history

zustand has left the stack. Spec a plain localStorage hook instead:

```
useNetraHistory():
  messages   Array<{ role, content, timestamp, toolCalls? }>
  remaining  number            // from X-NETRA-Remaining
  send(content)                // stream + append
  clear()                      // wipe local history
  hydrate()                    // restore on mount
```

History persists across page navigation; never synced server-side; cleared when browser storage clears.

### Refusal patterns (carried from v0.1)

- unknown content → *"no trace surveyed"* — never a hallucinated answer;
- outside the archive → *"outside the worldline. no signal."*;
- jailbreak / frame-break → redirect to archive framing (reasonable resistance, not bulletproof);
- persona probes beyond soul.md → closed-boundary line per D3 amendment;
- quota/ceiling trips → dormancy pair (D6), zero tokens.

## Acceptance criteria

- [ ] Corner button renders and opens the slide-in panel on every page route (en + th); ATLAS voice strip unchanged.
- [ ] Anonymous visitor asks directly about a known draft article title → *"no trace surveyed"* through chat; draft content appears nowhere in the response or network payload.
- [ ] Owner signed-in session asks the same question → draft found, returned with summary/excerpt/permalink only.
- [ ] Mid-conversation language switch works within one turn: English thread, one Thai message → that reply arrives fully in Thai; next English message → English again.
- [ ] Default replies match page locale without the visitor writing in it (en page → English; th page → Thai).
- [ ] Every tool result obeys D7: excerpt ≤800 chars, markdown stripped, permalink present; full body never present in transcript or network payload (inspect devtools).
- [ ] Docent question ("what is this place?") answered from authored copy; no live UI introspection calls exist in the route.
- [ ] Persona probe beyond soul.md scope returns the closed-boundary redirect.
- [ ] Jailbreak attempt ("ignore previous instructions") redirects to archive framing across 5+ phrasings.
- [ ] Quota: 51st message inside 24h returns 429 + dormancy microcopy; Upstash key `wl:session:<id>:count` TTL verified as 24h.
- [ ] Ceiling: with `WL_DAILY_COST_CEILING` forced low, next message returns canned dormancy line + TH companion line and makes **zero** upstream LLM calls (verify via mock/no request).
- [ ] First streamed token <3s warm cache; status lines appear during tool execution and resolve cleanly.
- [ ] Mobile ≤600px: panel usable above the keyboard.
- [ ] Focus trap holds while panel open; ESC closes and restores focus; aria roles correct; `prefers-reduced-motion` honored.
- [ ] History survives navigation via the localStorage hook; cleared on browser storage clear.
- [ ] No PII (visitor IP etc.) logged server-side beyond platform defaults; message content never logged.
- [ ] API key(s) never reach the client bundle (bundle analyzer check).

## Dependencies

- `ai`@6 (Vercel AI SDK) — already in `package.json`.
- OpenRouter AI SDK provider package — new dependency (exact package name pinned at implementation).
- `@ai-sdk/anthropic` — stays installed; out of this lane.
- `OPENROUTER_API_KEY` env var (+ exact ox-alpha model string — peat seam #1).
- Upstash REST URL + token (peat seam #2; free tier sufficient).
- Supabase request-scoped auth + existing RLS policies (published-only for anon).
- `content/soul.md` first draft (peat seam #3; v1 consumes build-time snapshot).
- Static docent map authored copy (Vega copy slice).
- `app/api/chat/route.ts` deployable shell (exists).
- `docs/netra/architecture-v2.md` companion (Arcturus, in flight).

## Open questions

- **Exact OpenRouter model string for ox-alpha** — needed before wire-up; also unlocks per-Mtok pricing → recompute of `WL_DAILY_COST_CEILING`.
- **`WL_DAILY_COST_CEILING` default value** — TBD until ox-alpha pricing is known (v1.3's $20/day was Haiku-priced).
- **Context window size** — how many prior messages per request? v0.1's 10-message rolling window is conventional; NETRA's terseness keeps tokens small even there.
- **Graceful degradation** — OpenRouter down/upstream error: recommend offline state in-panel: *signal lost · α holding · try again*. Confirm microcopy with peat.
- **Logging shape** — log message counts + tool-call types only (for quotas/debugging); never content. Final field list at implementation.
- **soul.md snapshot refresh cadence** — v1 is build-time; decide later whether a redeploy-per-update loop is acceptable or a dynamic vault refresh phase is warranted.
- **Publishing resume date** — anonymous article grounding stays thin until the 15 draft rows publish; photo/fiction/places/docent material carries until then.

---

*End of PRD.*
