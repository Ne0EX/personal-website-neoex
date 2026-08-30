# PRD 05 — NETRA Navigator (Grounded Chat)

> Status: Implemented v1.0 release candidate — 2026.08.31
> Supersedes: `prd-05-netra-chat.md` v0.1 (kept as history; structure/tone carried forward)
> Decisions: D1–D7 grilled + settled by Peat, 2026.08.26 — canonical record in `.claude/handoffs/from-polaris/PROPOSED-REVISION-2026-08-26-NETRA-NAVIGATOR--to-peat.md`
> Line-hold: *navigator, not bolted-on chatbot* — `docs/team/VISION-FIDELITY.md`
> Phase: E · Companion: `worldline-feature-brainstorm.md` §4.1 · `docs/netra/architecture-v2.md` (in flight)
> Tech: `ai`@6 + `@ai-sdk/react` · Vercel AI Gateway with free-only MiniMax M3 → M2.7 fallback · Supabase request-scoped client · Upstash Redis when configured with a bounded process-local quota fallback

---

## Goal

Resurrect the original Ne0EX vision of a chat assistant — but this time it has *grounding*, a home on every page, and a settled lane. NETRA ships as a corner button opening a slide-in panel on every page; the ATLAS bay keeps its voice strip. Tools read the archive through the visitor's own session — anonymous sees published-only through existing RLS, Peat's signed-in session sees drafts, fail-closed either way. Grounding covers archive content (articles, photos, fiction, places), an authored static docent map of the site's areas and components, and the owner persona exactly as far as `content/soul.md` surveys it — no further. The lane is a Vercel route handler + Vercel AI SDK through Vercel AI Gateway, with a code-level allowlist that can select only MiniMax M3 Free and M2.7 Free in that order. Replies default to the page locale and follow the visitor's language per message. Cost is guarded by 50 messages / 24h per session and a hard Vercel project budget of $1/day. Voice continues the established register: italic, lowercase, terse, instrument-narrator — same as the existing `atlas-netra-voice` strip. Streamed typed UI responses expose tool state and safe public trace links.

## User stories

- **As a curious visitor**, I want to ask "what does peat write about coffee?" and get a synthesized answer that links to the actual entries on the site.
- **As a first-time visitor on any page**, I want to hit the corner button and ask "what is this place?" and get a docent's tour of the site's areas and components.
- **As a Thai reader on `/th`,** I want replies in Thai by default — and if i switch to writing English mid-conversation, NETRA mirrors me within the same turn.
- **As a visitor curious about the keeper**, I want NETRA to speak of peat exactly as far as his soul survey goes — and close the door cleanly beyond it.
- **As peat (owner, signed in)**, I want NETRA to see my drafts so i can interrogate work-in-progress before publishing.
- **As an anonymous visitor**, I want proof that asking about an unpublished draft yields "no trace surveyed" — the archive doesn't leak.
- **As peat (operator)**, I want a hard session quota, free-only model allowlist, and $1/day Gateway ceiling so a single visitor (or bot) cannot create an unbounded bill.
- **As peat**, I want NETRA to refuse questions about content that isn't on the site instead of hallucinating, and to redirect jailbreaks back to the archive.

## Scope

### In scope

- `POST /api/chat` route handler (zod, quota, typed UI streaming, abortSignal) through Vercel AI Gateway.
- Fixed free-only model order: `minimax/minimax-m3-free` primary, `minimax/minimax-m2.7-free` fallback. Any other `NETRA_MODEL` value fails closed before dispatch.
- Tool-call interface over request-scoped Supabase clients: archive search, entry fetch by file number, recent patches, photo search, fiction list, places list.
- Static docent map — authored copy describing the site's areas and components — loaded into context at build time. **No live UI introspection in v1.**
- Owner persona from `content/soul.md`, consumed as a build-time snapshot (file itself TBD by peat).
- Corner button + slide-in panel present on every page; ATLAS bay keeps its voice strip untouched.
- Language rule: default reply = page locale (`[lang]` route, en/th); per-message mirroring of the visitor's language.
- Cost guard from day 1: session quota 50 msgs/24h (shared Upstash when configured; bounded 1,024-session local fallback) + hard Vercel AI Gateway project budget of $1/day.
- Voice prompt continuing NETRA's established register (italic, lowercase, terse, instrument-narrator).
- Session history client-side via a localStorage hook (zustand has left the stack).
- Streaming rendering with the paper-aesthetic typography; tool calls render as survey status lines in the instrument register.

### Out of scope

- Multi-user accounts / auth beyond passthrough of the existing visitor session.
- Voice mode / audio.
- Custom fine-tuned or paid model — v1 is free-only Gateway models with tools + system prompt.
- Live UI introspection — NETRA reads authored docent copy, not runtime component state (future phase if ever).
- Cross-session server memory; conversation history never persists server-side.
- Whispers / daily intercept (Tier 4 sub-features) — separate surface, ships later.
- D-mail (egg).
- The four-mode persona switcher from the original Ne0EX vision — v1 ships a single NETRA voice.
- Dynamic refresh of the soul.md snapshot — v1 consumes build-time state only.

## Functional requirements

### Lane & hosting (D1)

Vercel route handler `/api/chat` + Vercel AI SDK (`ai`@6 and `@ai-sdk/react`). Vercel AI Gateway is the only model egress. The runtime selects `minimax/minimax-m3-free` first and may fall back only to `minimax/minimax-m2.7-free`; both IDs are explicitly allowlisted and paid/non-free IDs fail closed. Vercel deployments authenticate Gateway through OIDC, so no provider API key is part of the application lane. Cloud Run remains a future migration trigger only if resume.neoex.dev and worldline must someday share one backend.

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

The two guards have separate sources of truth:

- session quota: key `wl:session:<id>:count`, TTL 24h, cap 50 messages when Upstash is configured; otherwise a process-local map with a hard 1,024-session capacity. Session identity is a server-generated UUIDv4 in the HttpOnly, SameSite=Lax `wl_session` cookie; quota is surfaced as `X-NETRA-Remaining`.
- daily ceiling: Vercel AI Gateway project budget, hard limit **$1**, refresh period **daily**. This is centrally managed outside application estimates; the code cannot silently raise it.

Ceiling trips return canned dormancy microcopy — zero LLM tokens spent:

> *α DRIFT EXCEEDED · NETRA dormant until next worldline*

with its TH companion line for Thai pages. Quota exhaustion (429) uses the same dormancy pair pattern ported from RESUME-NETRA-SURVEY.

### Tool depth (D7)

Every tool result returns **summary + body excerpt ≤800 chars hard cap (markdown stripped) + permalink**. Never the full body. The visitor follows the link for more.

```typescript
const tools = {
  get_current_page: { parameters: z.object({}) },
  search_entries: {   // articles | photos | fiction | places | all
    parameters: z.object({
      query: z.string(),
      filter: z.enum(['articles', 'photos', 'fiction', 'places', 'all']).default('all'),
      limit: z.number().min(1).max(10).default(5),
    }),
  },
  get_entry:        { parameters: z.object({ slugOrFileNum: z.string(), lang: z.enum(['en', 'th']).optional() }) },
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

Tokens stream through the AI SDK's `useChat` UI-message transport, rendered in NETRA's lowercase mono instrument register (with the Thai mono fallback where needed). Tool invocations surface as typed survey status lines and settle into compact resolved/unresolved provenance with safe same-site public permalinks.

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
- [ ] Ceiling: Vercel AI Gateway reports a project budget of `$1`, refresh `daily`; requests are rejected by Gateway after the hard limit and no paid/non-free model can be selected by application configuration.
- [ ] First streamed token <3s warm cache; status lines appear during tool execution and resolve cleanly.
- [ ] Mobile ≤600px: panel usable above the keyboard.
- [ ] Focus trap holds while panel open; ESC closes and restores focus; aria roles correct; `prefers-reduced-motion` honored.
- [ ] History survives navigation via the localStorage hook; cleared on browser storage clear.
- [ ] No PII (visitor IP etc.) logged server-side beyond platform defaults; message content never logged.
- [ ] API key(s) never reach the client bundle (bundle analyzer check).

## Dependencies

- `ai`@6 (Vercel AI SDK) — already in `package.json`.
- `@ai-sdk/react` — typed client transport and UI message stream consumption.
- Vercel AI Gateway OIDC in Vercel deployments; no OpenRouter or direct-provider credential.
- Vercel project budget configured at `$1`, refresh `daily`.
- Upstash REST URL + token are optional; the bounded local fallback preserves availability when absent.
- Supabase request-scoped auth + existing RLS policies (published-only for anon).
- `content/soul.md` first draft (peat seam #3; v1 consumes build-time snapshot).
- Static docent map authored copy (Vega copy slice).
- `app/api/chat/route.ts` deployable shell (exists).
- `docs/netra/architecture-v2.md` companion (Arcturus, in flight).

## Open questions

- **Context window size** — settled at the latest 10 user turns; client-authored assistant history is never trusted by the route.
- **Graceful degradation** — Gateway/upstream errors resolve to the sanitized in-panel line *signal lost · α holding · try again*.
- **Logging shape** — log message counts + tool-call types only (for quotas/debugging); never content. Final field list at implementation.
- **soul.md snapshot refresh cadence** — v1 is build-time; decide later whether a redeploy-per-update loop is acceptable or a dynamic vault refresh phase is warranted.
- **Publishing resume date** — anonymous article grounding stays thin until the 15 draft rows publish; photo/fiction/places/docent material carries until then.

---

*End of PRD.*
