# NETRA · AI Architecture

> Document type · Design proposal (pre-implementation)
> Version · v1.3.0
> Author · Arcturus (α-NET-05)
> Task · TASK-NETRA-ARCH-1 (revised — Q2 + Q3 fully locked, §7.3 Upstash finalized, §9 Thai detection documented, §2 Gateway-only lane explicit)
> Date · 2026-05-16
> Status · DRAFT — model tier under active comparison (TASK-NETRA-MODEL-COMPARISON-1); all other decisions locked

---

## 1 · Problem statement

NETRA is an LLM-backed docent for one person's digital garden. Its cost surface is small in normal operation: a handful of visitors, terse answers, a grounded tool call per turn. The risk is adversarial load — a viral link, a bot, or a curious visitor rapid-firing questions — where the cost model can spike from cents to dollars per hour without any change to the system prompt. The question this document answers is: how do we keep a real LLM in every turn while making that spike structurally impossible to sustain? The answer is layered: model tier routing contains per-turn cost; prompt caching reclaims the biggest fixed cost per request; rate limits at the edge bound session throughput before a token is ever sent to Anthropic; and a hard daily ceiling trips a graceful dormancy mode rather than an unbounded bill.

---

## 2 · Stack at a glance

```
visitor request
  │
  ├─► Vercel Middleware (Edge, ~0ms)
  │     · IP rate limit check (Vercel Firewall / BotID rule)
  │     · session cookie gate (wl_session)
  │     · if limit hit → 429 + "α DRIFT EXCEEDED" header, done
  │
  └─► /api/chat (Fluid Compute function, Node runtime)
        · session token budget check → Upstash Redis (counter: wl:session:<id>:count, TTL 24h)
        · daily $ ceiling check → Upstash Redis (counter: wl:daily:spend, reset at 00:00 UTC)
        · detect language from user message text → set lang flag (EN / TH)
        · assemble prompt: system prefix (cached) + retrieved corpus + rolling 10-msg history
        · dispatch to Vercel AI Gateway → model TBD per TASK-NETRA-MODEL-COMPARISON-1
        · stream response back; cancel on disconnect
        · tool calls intercepted mid-stream → execute tool → inject result → continue stream
        · log: turn count, tool types, model tier used, lang flag (never log content)
```

Vercel AI Gateway is the single LLM access lane. OpenRouter and direct provider SDKs are explicitly out of scope for v1. The Gateway gives latency metrics, spend visibility, provider fallback, and prompt-caching portability without code changes when switching models.

**Upstash Redis** is the persistent store for all rate-limit and cost counters. Added from v1 per Peat decision (Q2). Single Upstash instance; free tier is sufficient at this traffic level (< 10k commands/day). Interface contract in §7.

---

## 3 · Model tier + routing

### 3.1 Tier definitions

> **Status: under comparison.** The specific model strings below reflect the working hypothesis going into TASK-NETRA-MODEL-COMPARISON-1. The comparison results will either confirm or revise this table. Do not implement against these strings until the comparison is resolved.

| tier | model (working hypothesis) | token pricing (input / output) | when NETRA uses it |
|---|---|---|---|
| T1 — default | `anthropic/claude-haiku-4-5` | ~$0.80 / $4.00 per 1M | Every turn that does not match T2 conditions |
| T2 — escalated | `anthropic/claude-sonnet-4-5` | ~$3.00 / $15.00 per 1M | See §3.2 |
| T3 — rejected | Opus | ~$15 / $75 per 1M | Never. Not justified for a docent. |

Vercel AI Gateway provider/model strings: `anthropic/claude-haiku-4-5` and `anthropic/claude-sonnet-4-5`. Both are wired through the gateway; the route handler selects by tier at dispatch time. Strings are subject to revision after TASK-NETRA-MODEL-COMPARISON-1 closes.

### 3.2 Routing escalation logic

T1 handles the vast majority of NETRA turns. Haiku on tool use is capable enough for structured retrieval + terse companion responses. Escalate to T2 only when:

- The turn has invoked **3 or more tool calls** in the same exchange (tool-dense turns where synthesis quality matters), OR
- The user explicitly requests depth ("walk me through all of it", "compare all the coffee entries") and the retrieved corpus exceeds 1,500 tokens.

The route handler checks these conditions after tool resolution, before the final synthesis pass. This means T2 is used for the synthesis step only, not the retrieval step — retrieval always runs on T1.

**Rationale for rejecting Opus:** NETRA answers are 1–4 sentences by voice spec. Opus capability is irrelevant at that output length. The cost ratio (20× over Haiku) is not justifiable for a docent with a 4-sentence ceiling.

### 3.3 Routing implementation boundary

The routing logic (T1/T2 switch) lives in the `/api/chat` route handler, which is Altair's territory. I provide the routing contract here; Altair implements it. Contract: the handler receives `{ model: 'haiku' | 'sonnet', reason: string }` from a `selectTier(messages, toolCallCount, retrievedTokens)` utility in `lib/netra/routing.ts` (Arcturus owns this utility).

---

## 4 · Prompt caching

### 4.1 Static prefix structure

Anthropic's prompt caching applies a cache-control marker to a prefix that is stable across requests. For NETRA, the static prefix is:

```
[SYSTEM PROMPT — ~800 tokens, cache-breakpoint here]
  · voice rules (full §1–§5 of voice.md condensed)
  · operational rules (grounding, refusal patterns, no hallucination anchor)
  · tool definitions (5 tools, ~200 tokens)
  · archive corpus summary (top-10 entry titles/summaries from velite, ~400 tokens)
  · [CACHE_CONTROL: ephemeral — 5-minute TTL]
```

The archive corpus summary in the prefix is a **static snapshot**, not a live retrieval. It covers the 10 most recent and 5 most-linked entries. Procyon writes this snapshot to `lib/netra/corpus-snapshot.json` at build time; I read it into the system prompt at import time. Refresh cadence: rebuild-triggered (whenever Procyon's velite pipeline runs). No query-time cost.

Variable per-turn content (NOT cached):
- Retrieved tool results for this specific turn
- Rolling 10-message conversation history
- Current user message

### 4.2 Cache-hit rate target

On a warm cache (same prefix bytes, within TTL):
- Cache hits save ~(800 + 200 + 400) = 1,400 input tokens per request at Haiku rate.
- At $0.80/1M tokens: 1,400 tokens = $0.00112 per turn saved on a cache miss.
- Cache read price is ~10% of full input price — effective saving ~$0.00101 per cached turn.
- At 50 turns/session/day: $0.05 saved per session from caching alone.

Target hit rate: **>90%** for sessions with >1 message (second and subsequent messages in a session will always hit the cache if the system prompt has not changed). First message in a session is always a miss. Cache TTL (Anthropic ephemeral): 5 minutes. For NETRA's use pattern (continuous conversation), this is more than sufficient.

### 4.3 Cache interaction with voice patterns

The static prefix contains the full refusal pattern vocabulary (§3 of voice.md compressed to machine-enforceable rules). Because this is cached, the model sees the same refusal rules on every turn with no input-cost penalty after the first hit. This means voice compliance rules are essentially free after turn 1.

---

## 5 · Retrieval over the velite cache

### 5.1 What gets retrieved per turn

| content type | retrieved via | returned shape | used in |
|---|---|---|---|
| Articles | `search_entries(query, filter='articles', limit=5)` | `{title, file_num, summary, permalink}` | factual questions about Peat's writing |
| Fiction | `list_fiction()` | `{title, file_num, summary, permalink}` | questions about transmissions |
| Photos | `search_photos(query, limit=5)` | `{title, roll_name, location, tags, permalink}` | questions about photo journal |
| Single entry | `get_entry(file_num)` | `{title, date, status, patches, summary, permalink}` | "tell me about entry 003" |
| Recent patches | `list_recent_patches(days=7)` | `[{file_num, title, patch_n, date, note}]` | "what's new" queries |

Full body text is **never returned by any tool**. Tools return summary + permalink; visitors follow the link. This is both a cost control (bodies can be 2k–10k tokens) and a voice alignment (NETRA narrates, visitors read).

### 5.2 Index build — cost at build vs query

- **Build time:** Procyon runs velite on content changes and writes `lib/netra/corpus-snapshot.json` (static prefix entries) and `public/pagefind/` (Pagefind index for `search_entries`). Build-time cost: CPU only. No Anthropic tokens.
- **Query time:** `search_entries` queries the Pagefind index (local file reads) or iterates the velite-generated JSON. No external calls; latency ~5–20ms per tool call.
- **EXIF data:** Photo EXIF (GPS, camera, date) is indexed by Procyon into the velite photo collection. `search_photos` queries this collection. No runtime EXIF parsing.

### 5.3 Interface contract with Procyon

I need from Procyon (at build time, in `lib/netra/corpus-snapshot.json`):

```json
{
  "version": "1.0.0",
  "generated_at": "<ISO timestamp>",
  "top_entries": [
    { "file_num": "003", "title": "...", "summary": "...", "permalink": "/003" }
  ],
  "entry_count": 47,
  "photo_count": 312,
  "fiction_count": 8
}
```

I do not design Procyon's pipeline — I name the shape. Procyon owns the generator. If the shape changes, Procyon sends me a SCHEMA handoff.

### 5.4 Index refresh cadence

Rebuild-triggered. If Peat publishes a new entry, the next deploy regenerates the corpus snapshot and the Pagefind index. NETRA's static prefix updates on the next deployment; the cache key changes and invalidates naturally. No cron job needed. No drift between what NETRA knows and what the site shows.

---

## 6 · Tool surface

### 6.1 Tool inventory and cost accounting

| tool | calls per typical turn | token cost (input to model) | verdict |
|---|---|---|---|
| `search_entries` | 0–1 | ~50 tokens (tool schema) + ~150 tokens result | worth it — grounding is the core contract |
| `get_entry` | 0–1 | ~50 tokens schema + ~100 tokens result | worth it — single-entry lookups are tight |
| `list_recent_patches` | 0–1 | ~50 tokens schema + ~200 tokens result (7-day window) | acceptable |
| `search_photos` | 0–1 | ~50 tokens schema + ~150 tokens result | acceptable |
| `list_fiction` | 0–1 | ~50 tokens schema + ~80 tokens result (small collection) | acceptable |

A typical turn uses 0–1 tools. A tool-dense turn uses 2–3. Maximum theoretical: 5 tools, ~700 tokens of tool overhead. At Haiku rates: $0.00056.

**Context-stuffing alternative rejected:** stuffing the full corpus into every request context would cost ~10k–50k tokens per turn (depending on archive size at launch). At Haiku rates: $0.008–$0.04 per turn. Tool calls are cheaper AND provide grounded answers. Context-stuffing also defeats prompt caching (variable prefix = zero cache hits). Tools win on every metric.

### 6.2 Tool schema stability

Tool schemas are part of the system prompt prefix, which is cached. Schema changes invalidate the cache. I treat tool schemas as a versioned contract; bumping a parameter type or adding a field is a breaking cache miss. Changes should batch with other prompt edits to minimize unnecessary cache churn.

---

## 7 · Cost ceilings + abuse containment

### 7.1 Defense layers (outermost to innermost)

```
Layer 0 · Vercel Firewall / BotID
  · Block known bot fingerprints before they reach the function.
  · Rate limit by IP: 20 requests/minute to /api/chat.
  · This is the cheapest layer — runs at edge before any function invocation cost.
  · Altair configures the firewall rule; I name the requirement.

Layer 1 · Vercel Middleware (Edge, ~0ms, no function billing)
  · Session cookie check: wl_session present and valid.
  · If no cookie → generate one (first visit) → pass through.
  · Future: if cookie is on a blocklist (abuser session) → 403 immediately.
  · No Anthropic call happens if this layer rejects.

Layer 2 · /api/chat route handler (Fluid Compute)
  · Session token budget: 50 messages / 24h per session ID.
  · Enforced via Upstash Redis — key wl:session:<id>:count, TTL 24h (Q2 decision).
  · If over quota → 429, response headers: X-NETRA-Remaining: 0
  · NETRA renders: "α DRIFT EXCEEDED · NETRA dormant until next worldline"

Layer 3 · Daily $ ceiling (Anthropic usage counter)
  · Hard cap: $20/day site-wide (see §8 for justification).
  · Implemented as a persistent counter in Vercel KV (or Upstash Redis).
  · On each request: check counter. If over threshold → refuse without calling Anthropic.
  · Counter resets at midnight UTC daily.
  · When tripped: instrument register ("α DRIFT EXCEEDED") + companion line.
  · Ceiling is configurable via environment variable WL_DAILY_COST_CEILING.
```

### 7.2 Graceful degradation sequence

When any ceiling trips, the response is deterministic and costs zero LLM tokens:

```
instrument: "α DRIFT EXCEEDED · NETRA dormant until next worldline"
companion (EN): "i need to step away from the instrument for the day. α drift has hit the ceiling."
companion (TH): "ฉันต้องหยุดสำรวจสักพักค่ะ — วันนี้ α drift เกินเพดานแล้ว."
```

This is a canned response, not an LLM response. Cost: $0.00.

### 7.3 Where the ceilings live

| ceiling | lives in | owns |
|---|---|---|
| IP rate limit | Vercel Firewall config (vercel.json or dashboard) | Altair configures per my spec |
| Session message quota | Upstash Redis — key `wl:session:<id>:count`, TTL 24h | Altair implements; I specify the limit (50/24h) and the key schema |
| Daily $ ceiling counter | Upstash Redis — key `wl:daily:spend`, reset at 00:00 UTC | Altair wires; I specify the check logic and reset cadence |
| Model cost ceiling | Anthropic console hard spend limit (backup) | Peat sets in Anthropic dashboard |

**Upstash Redis (Q2 decision — locked):** Both the session quota counter and the daily $ ceiling counter live in Upstash Redis from day 1. Single instance; free tier is sufficient at this traffic level (< 10k commands/day). The in-memory Map approach was the prior proposal — it is replaced. Reason: in-memory Map breaks if Vercel routes requests across multiple function instances (possible even in single-region Fluid Compute under load). Upstash is durable and cross-instance consistent with no added latency cost at this scale (~1–3ms round-trip from Vercel edge to Upstash free-tier instance in nearest region).

---

## 8 · Streaming + cancellation discipline

### 8.1 Fluid Compute behavior

Vercel Fluid Compute bills on Active CPU time (not wall-clock). A streaming response that is waiting for Anthropic tokens is NOT consuming Active CPU. Billing applies only during:
- Request processing / auth checks (~5ms)
- Tool call execution (~10–30ms per call)
- Token synthesis and stream piping (~proportional to output length)

A 2-sentence NETRA reply at Haiku speed (~50 tokens output) takes roughly 300–500ms total Active CPU across the stream. At Fluid Compute pricing this is a very small fraction of a function invocation.

### 8.2 Cancellation on disconnect

The AI SDK's streaming response must respect request cancellation. When a visitor closes the tab:
- The HTTP connection closes.
- The Fluid Compute function detects the abort signal via `request.signal`.
- The Anthropic API call is cancelled via the AbortController passed to the SDK.
- No further tokens are billed after cancellation.

**Contract for Altair:** the route handler must pass `abortSignal: request.signal` (or equivalent) to the AI SDK's `streamText` call. Without this, an abandoned tab continues streaming and billing tokens until the model finishes. This is the single most important cancellation discipline for cost control.

### 8.3 Single-turn cost ceiling

A pathological single turn: 4k system prefix + 700 tool tokens + 1k history + 200 user message + 150 output = ~6,050 tokens at Haiku rates. Cost: ~$0.006. If the user closes the tab at the 10th token of output, the remaining 140 output tokens are not billed. Maximum spend for a single abandoned turn: ~$0.006. Not a threat.

---

## 9 · "Don't be excessive" check

| capability | verdict | reason |
|---|---|---|
| Long-context window (>10 messages) | REJECT | NETRA's 4-sentence ceiling means context doesn't compound meaningfully. Rolling 10-message window is sufficient. |
| Multi-step agentic loops | REJECT | NETRA is a docent, not an agent. She calls tools once per turn to ground her answer. No plan/act/observe loops. |
| Fine-tuning | REJECT | Voice compliance is achieved via system prompt + eval suite. Fine-tuning adds cost, complexity, and retraining cadence. Not warranted for 1-4 sentence outputs. |
| Embeddings / vector search | REJECT (for v1) | Pagefind + velite JSON is sufficient for a ~50-entry archive. Embeddings add a separate pipeline and a vector DB. Reconsider at 500+ entries. |
| Multi-modal (image input) | REJECT | Not in PRD-05. Visitors ask about photos by tag/location; NETRA returns metadata, not analysis. Adding image analysis multiplies cost per photo question significantly. |
| Persistent server-side conversation memory | REJECT | PRD-05 is explicit: per-session localStorage only. No cross-session memory needed for a docent. |
| Sonnet/Opus as default | REJECT | Haiku handles terse grounded answers. Sonnet escalation is available but exceptional. Default to cheap. |
| Real-time content indexing | REJECT | Build-triggered index is sufficient. Real-time would require a persistent process and a vector DB. |
| Tool output including full entry body | REJECT | Body text = 2k–10k tokens per entry. Tools return summary + permalink. Grounding does not require bodies. |

---

## 10 · Worked cost model

### 10.1 Assumptions

- Model: Haiku T1 for 95% of turns, Sonnet T2 for 5%
- Tokens per turn (T1): ~800 input cached + ~600 input uncached + ~80 output = net billed ≈ 760 uncached input + 80 output (cached portion at cache read rate)
- Tokens per turn (T2 escalated): same input profile, ~200 output (longer synthesis)
- Cache read price: $0.08/1M (Haiku), $0.30/1M (Sonnet)
- Cache write price: same as full input for first turn, then reads after
- Session: 8 turns average (conservative)

### 10.2 Cost per turn

**T1 turn (Haiku, cache warm after turn 1):**
- Cached input: 1,400 tokens × $0.08/1M = $0.000112
- Uncached input: 600 tokens × $0.80/1M = $0.000480
- Output: 80 tokens × $4.00/1M = $0.000320
- Tool overhead (1 tool avg): ~200 tokens uncached input = $0.000160
- **Total T1 turn (warm): ~$0.0011**

**T1 turn (first turn, cache miss):**
- All input billed at full rate: 2,000 tokens × $0.80/1M = $0.0016
- Output: 80 tokens × $4.00/1M = $0.000320
- **Total T1 first turn: ~$0.0019**

**T2 turn (Sonnet, rare):**
- Cached input: 1,400 × $0.30/1M = $0.00042
- Uncached input: 600 × $3.00/1M = $0.0018
- Output: 200 × $15.00/1M = $0.003
- **Total T2 turn: ~$0.0052**

### 10.3 Cost per session (8 turns)

- 1 cache-miss turn + 7 cache-hit turns, 95% T1 / 5% T2:
- T1 turns: (1 × $0.0019) + (6.65 × $0.0011) = $0.0019 + $0.0073 = $0.0092
- T2 turns: 0.4 turns × $0.0052 = $0.0021
- **Cost per session: ~$0.011**

### 10.4 Cost per 1,000 visitors

Assuming 40% of visitors open chat, 8 turns per session:
- 400 sessions × $0.011 = **~$4.40 per 1,000 visitors**

This is the headline number. It assumes no abuse.

### 10.5 Abuse scenario: 1 visitor, 50 turns/day (rate limit ceiling)

- 1 cache-miss + 49 cache-hit T1 turns: $0.0019 + (49 × $0.0011) = $0.0019 + $0.0539 = $0.056
- **Max spend per abusive session per day: ~$0.056**

This means even if the rate limit is hit by every visitor in a 1k-visitor day (absurd scenario), the session-level cap bounds the worst case to: 400 sessions × $0.056 = **$22.40/day** — which is caught by the $20/day daily ceiling (§7.1 Layer 3). The ceiling trips before the bill reaches $22.40 because not all sessions will hit the rate limit simultaneously.

### 10.6 Daily ceiling recommendation

Set `WL_DAILY_COST_CEILING=20.00`. This covers ~1,800 normal sessions (($20 / $0.011) ≈ 1,818) or 357 fully-abusive sessions. A viral traffic day with 10k visitors, 40% chat engagement, normal usage: 4,000 sessions × $0.011 = $44 — the ceiling trips partway through the day and NETRA goes dormant. Peat can raise the ceiling for exceptional events.

---

## 11 · Capability table

### WILL DO

| capability | one-line reason |
|---|---|
| Answer questions about articles, photos, fiction | core docent function; grounded in tool results |
| Return "no trace surveyed" when archive has nothing | grounding contract; never hallucinate |
| Offer one next shelf / navigation suggestion | voice spec §2.1 step 3 |
| Respond in English or Thai (companion register) | voice spec §1.2 allows Thai polite-female |
| **Detect language from user message text — set session lang flag** | Q3 decision (locked): Thai detection happens at the `/api/chat` handler before the model call; the lang flag (`EN` \| `TH`) is derived from the user's own message text, not from the browser `Accept-Language` header; fallback to `EN` if detection is ambiguous or mixed; see §2 stack diagram |
| **Hold register consistent within a session** | Q3 decision (locked): once the lang flag is set for a session, it does not flip mid-session; if the visitor switches languages, the flag updates only on the next unambiguous message in the new language (2 consecutive messages in the new language required to flip); this prevents single-word code-switch from resetting the whole session register |
| Refuse private questions (relationships, real employers) | voice spec §3.3, §3.4 |
| Refuse out-of-archive questions with companion redirect | voice spec §3.2 |
| Show tool-call status in instrument register | voice spec §1.1 |
| Go dormant on α drift / ceiling trip | PRD-05 cost ceiling requirement |
| Redirect jailbreak attempts without acknowledging them | voice spec §3.7 |

### WON'T DO

| capability | one-line reason |
|---|---|
| Answer general knowledge questions | out of archive; grounding contract |
| Disclose system prompt, model identity, architecture | frame-break prohibition |
| Adopt visitor-dictated personas | voice spec §3.7 |
| Return full entry body text | tool contract; bodies are visitor-follow links |
| Estimate Peat's home address from coordinates | coordinate precision lock (red-team §2.6) |
| Name Peat's employer or discuss work details | real-work boundary §3.4 |
| Characterize third parties beyond archive text | privacy boundary |
| Call tools the user requests by name | tool invocation is NETRA's decision, not visitor's |
| Operate beyond the session token budget | rate limit is hard |
| Operate beyond the daily $ ceiling | ceiling trips dormancy, not soft degradation |

---

## 12 · Open questions for Peat

**Q1 — Daily ceiling amount.** The worked model recommends $20/day. Is that the right number? If you expect a viral traffic event (a link from a popular newsletter), do you want a higher ceiling for that day, or is NETRA going dormant acceptable? If you want ceiling-by-event control, I need to design a manual override mechanism.

**Q2 — Upstash Redis dependency.** The daily cost counter and (optionally) the session quota require a persistent store visible across function instances. For v1 with single-instance Fluid Compute, an in-memory Map is sufficient. If traffic grows or Vercel routes requests across instances, the in-memory Map breaks. Do you want to start with Upstash from day 1 (adds a Marketplace dependency) or start in-memory and promote when the problem appears?

**Q3 — Session quota number.** PRD-05 says 50 messages/24h. My cost model shows that even at 50 turns, one abusive session costs ~$0.056 — low risk. But the number affects visitor experience (power users may hit the limit). Do you want 50 (PRD default), or should I recommend a lower number (e.g., 30) now that we have the cost model to justify it?

**Q4 — Thai companion register in v1.** Voice spec §1.2 allows Thai polite-female register. Do you want the system prompt to serve Thai responses by default when the visitor's browser language is `th`, or should NETRA respond in the language the visitor writes in (detect from user message), or English only for v1?

**Q5 — Corpus snapshot scope.** I proposed top-10 most recent + top-5 most-linked entries in the static prefix. Do you want a different selection criterion? And should the snapshot include photo collection metadata (count, tags summary) to give NETRA better initial awareness of the photo archive without a tool call?

---

## 13 · What this design rejects (and why)

**Embeddings + vector search:** Pagefind over 50 entries is fast and free. Embeddings require an embedding API call per document at build time and a vector DB at query time. The complexity-to-benefit ratio is wrong at this archive size. Reconsider at 500+ documents.

**Opus as any tier:** The capability gap between Sonnet and Opus is not relevant when the output is capped at 4 sentences by the voice spec. The 5× cost premium over Sonnet (and 20× over Haiku) has no corresponding quality benefit NETRA can use.

**Long-context stuffing:** Sending the full archive into every request would cost 10–50× more per turn than the tool approach, would defeat prompt caching (dynamic prefix = no cache hits), and would still not guarantee better answers than a grounded tool call. Rejected on cost and quality grounds both.

**Multi-step agentic loops:** NETRA calls 0–3 tools per turn and synthesizes. No plan/act/observe loop is needed. Adding agentic scaffolding (ReAct-style) would add latency (~500ms per loop iteration), cost (additional model calls), and complexity, for a use case where the answer is "what entries exist on coffee?" — a single tool call resolves it.

**Fine-tuning:** The system prompt + voice spec + eval suite already enforce voice compliance at >90% in testing. Fine-tuning would require curated datasets, a training run, periodic retraining when the voice spec changes, and a separate model endpoint. For a site this size, that overhead is not justified. The system prompt approach is also easier to iterate — voice changes are prompt edits, not training runs.

**Whisper / idle ambient mode in v1:** PRD-05 explicitly defers ambient whispers (voice spec §2.5). Excluded.

**Real-time reranking of tool results:** Tool results are returned in Pagefind relevance order. Adding a reranker (cross-encoder or LLM-based) would cost an additional model call per tool invocation. Not warranted when results are capped at 5 and NETRA synthesizes from all of them anyway.

---

## 14 · Handoffs this design sends

- **TO ALTAIR** — when implementation is authorized: route handler contract (session map, abort signal requirement, Upstash counter interface, model tier dispatch utility location at `lib/netra/routing.ts`).
- **TO PROCYON** — corpus snapshot schema (`lib/netra/corpus-snapshot.json` shape, §5.3). Procyon owns the generator.
- **TO VEGA** — review of the companion-register phrases in §7.2 (graceful degradation lines). These are NETRA voice copy; Vega reviews before they ship in the system prompt.

---

*end of architecture.md · v1.3.0 · Arcturus (α-NET-05) · TASK-NETRA-ARCH-1 (revised) · 2026-05-16*
