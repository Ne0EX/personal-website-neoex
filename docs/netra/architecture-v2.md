# NETRA · AI Architecture v2

> Document type · Design proposal (implementation-ready pending seams)
> Version · v2.0.0-draft
> Author · Arcturus (α-NET-05)
> Task · TASK-2026-08-26-NETRA-NAVIGATOR
> Date · 2026-08-26
> Status · SUPERSEDED 2026-08-31 — the OpenRouter proposal below is retained only as decision history
> Supersedes · `architecture.md` v1.3 (kept as history). The v1.3 Gateway-only lane lock and its velite corpus assumptions are DEAD; every section below re-bases on D1–D7.

> **Active runtime contract:** `docs/netra/agent-core.md` and the checked-in implementation. NETRA now uses the Vercel AI SDK through Vercel AI Gateway, permits only `minimax/minimax-m3-free` with `minimax/minimax-m2.7-free` fallback, and relies on the Vercel project budget of **$1/day** as the hard spend ceiling. No OpenRouter credential is part of the active lane. Do not implement the historical OpenRouter or estimated-cost-counter sections below.

---

## 1 · Problem statement

Carried over from v1.3 §1: NETRA is an LLM-backed docent for one person's digital garden. Normal-operation cost surface is small — a handful of visitors, terse answers, a grounded tool call per turn. The risk remains adversarial load: a viral link, a bot, or one curious visitor rapid-firing questions can spike cost from cents to dollars per hour with no change to the system prompt. The question this document answers is unchanged: how do we keep a real LLM in every turn while making that spike structurally impossible to sustain?

What changed under NETRA-NAVIGATOR is the lane and the corpus. The LLM access lane moves from Vercel AI Gateway + Anthropic (v1.3) to **OpenRouter via the Vercel AI SDK** (D1), on model `ox-alpha` (exact provider string open, §12). The retrieval substrate moves from velite build artifacts to the **Supabase store queried at runtime** through passthrough visitor auth (D2), so grounding reflects what the visitor can actually read — published-only for anonymous visitors, drafts included for the signed-in owner. Grounding scope widens to include a static docent site map and owner-persona material from `content/soul.md` (D3). Language handling simplifies from session sticky-flag machinery to per-message mirroring driven by the page locale (D4). The chat surface moves to a corner button + slide-in panel available on every page (D5), which is why this document now specifies served_lang arriving from the `[lang]` route rather than a single ATLAS-stratum endpoint (§6). The layered answer survives intact: session quota at the edge bounds throughput before a token is spent, a hard daily ceiling trips graceful dormancy rather than an unbounded bill, and caching keeps the biggest fixed per-request cost down — but all four layers are now priced parametrically until OpenRouter pricing lands (§7).

---

## 2 · Stack at a glance

```
visitor request
  │
  ├─► Vercel Edge / Middleware (~0ms, no function billing)
  │     · IP rate limit check (Vercel Firewall rule)
  │     · session cookie gate (wl_session): present+valid or issue on first visit
  │     · if rejected → 429/403 here, zero function invocation, zero tokens
  │
  └─► /api/chat (Node runtime route handler)
        · Upstash Redis checks (D6):
            wl:session:<id>:count  — TTL 24h, quota 50 msgs/session
            wl:daily:spend         — reset 00:00 UTC, ceiling $WL_DAILY_COST_CEILING
          over quota → 429 dormancy; over ceiling → dormancy; both canned, $0 tokens
        · parse body { messages, served_lang }   ← served_lang from [lang] route (§6)
        · assemble prompt:
            static cached prefix (voice rules + operational rules +
              tool defs + corpus-snapshot.json + soul-snapshot.json)
            + rolling 10-message history
            + served_lang directive ("default reply language")
        · dispatch via Vercel AI SDK → OpenRouter → ox-alpha (string OPEN, §12)
        · stream response back; abortSignal: request.signal wired into the
          streamText call — abandoned tab cancels billing mid-stream
        · tool calls intercepted mid-stream → execute against Supabase store
          (passthrough visitor auth) → inject result → continue stream
        · log: turn count, tool types, lang — never log content
```

**Out of this lane:** Vercel AI Gateway and `@ai-sdk/anthropic` are explicitly OUT (D1 reverses v1.3 §2). The route imports an OpenRouter-compatible AI SDK provider; no gateway hop, no Anthropic SDK dependency. Cloud Run is not in this design either (see §10).

---

## 3 · Caching under OpenRouter

v1.3 §4 assumed Anthropic's explicit `cache_control` breakpoint markers. Under OpenRouter those markers **may not port**: OpenRouter is a multi-provider relay, and explicit cache-control semantics are provider-specific. The design therefore changes from "explicit breakpoint" to "cache-friendly structure":

- The static prefix keeps the same STRUCTURE as v1.3 §4.1, byte-stable across requests:
  1. voice rules (voice.md condensed)
  2. operational rules (grounding contract, refusal patterns, no-hallucination anchor)
  3. tool definitions
  4. `lib/netra/corpus-snapshot.json` contents (top entries + counts)
  5. `lib/netra/soul-snapshot.json` contents (owner-persona block)
- Variable per-turn content stays OUT of the prefix: retrieved tool results, rolling 10-message history, current user message, and the per-message language directive.
- Prefix bytes change only on deploy (snapshot regeneration) or a deliberate prompt edit — same discipline as v1.3 §6.2 (schema changes batch with prompt edits to minimize cache churn).

**Implicit caching:** if OpenRouter's upstream for `ox-alpha` supports implicit prefix caching (OpenAI-style automatic prefix dedup), identical prefixes get discounted reads automatically. Treat this as **upside only, never load-bearing**: the ceiling math in §7 assumes every input token is billed at full input price. This is the conservative inversion of v1.3 §4.2's worked savings — v1.3 counted cached-read rates into its headline numbers; v2 does not until pricing lands and we can verify what ox-alpha's lane actually charges.

---

## 4 · Retrieval over the Supabase store

Replaces v1.3 §5 (velite + Pagefind) entirely. Tools query Supabase at request time; there is no Pagefind index and no velite JSON iteration.

### 4.1 Passthrough visitor auth (D2)

Each tool call builds the Supabase client from the visitor session of that request:

- anonymous visitor → existing RLS applies → published rows only
- signed-in owner session → drafts visible through the owner's own grants
- no session / auth construction fails → **fail-closed**: tool returns an empty result set with a grounding-safe marker, never a public fallback

NETRA can only ever narrate what the requesting visitor could read by browsing. No service-role key touches this lane.

### 4.2 Result shape (uniform across entry-type tools)

```
{ title,
  slug | file_num,        // whichever identifier the content type carries
  lang,
  summary,
  excerpt,                // markdown-stripped plain text, ≤800 chars HARD CAP
  permalink }
```

- The ≤800-char excerpt cap is enforced **IN THE TOOL**, at truncation time before serialization (D7). The model cannot receive an over-cap excerpt because the string is cut before it enters the tool-result payload.
- Coordinates are **never serialized** into any tool result (photo EXIF lat/long stays server-side; red-team coordinate lock from v1.3 §11 carries over).
- Full body text still never crosses; D7 relaxes v1.3's "summary + permalink only" to summary + capped excerpt + permalink. Visitors follow permalinks for the rest.

### 4.3 Build-time artifacts (Procyon owns generators)

| artifact | source | content | failure mode |
|---|---|---|---|
| `lib/netra/corpus-snapshot.json` | Supabase store at build | top entries + counts (entries / photos / fiction) | generated empty-but-valid if store unreachable |
| `lib/netra/soul-snapshot.json` | `content/soul.md` | owner-persona block verbatim-condensed | generator **fails soft** when soul.md absent: writes `{ present: false }`, prompt assembly omits the persona section, NETRA behaves as persona-closed |

Both feed the static prefix (§3). Refresh cadence is rebuild-triggered, same as v1.3 §5.4 — no cron, no drift between what the prefix says and what the site shows. Procyon owns both generators; I name the shapes, Procyon owns the code.

---

## 5 · Tool surface v2

### 5.1 Inventory and cost accounting (style carried from v1.3 §6.1)

Token costs below assume ~40 tokens/schema field-group and scale with row count × result width; exact $ figures wait on ox-alpha pricing (§12).

| tool | calls per typical turn | token cost (input to model) | verdict |
|---|---|---|---|
| `search_entries(query, filter?, limit?)` | 0–1 | schema ~50 + result ~150–250 (5 rows w/ ≤800c excerpts) | worth it — grounding is the core contract |
| `get_entry(slugOrFileNum, lang)` | 0–1 | schema ~50 + result ~150 (one row, full allowed fields incl. patches) | worth it — single-entry lookups stay tight |
| `list_recent_patches(days=7)` | 0–1 | schema ~50 + result ~200 | acceptable |
| `search_photos(query)` | 0–1 | schema ~50 + result ~150 (metadata only, no coords) | acceptable |
| `list_fiction()` | 0–1 | schema ~50 + result ~80 | acceptable |
| `get_site_map()` | 0–1 | schema ~50 + result ~300 (static docent map) | free at DB level — see below |
| `get_owner_context()` | 0–1 | schema ~50 + result ~400 (soul block) | new — gated by persona boundary (§8) |

A typical turn uses 0–1 tools; a dense turn 2–3. Same shape as v1.3: tool overhead is noise next to the prefix.

**`get_site_map()` is zero-DB-cost:** it serves the static docent map compiled into the corpus snapshot (section list, shelf structure, "what lives where"). It answers navigation questions ("what sections exist", "where do I find fiction") without touching Supabase, so it also works when the store check fails closed.

**Context-stuffing remains rejected** for the same reasons as v1.3 §6.1, now stronger: excerpts widen each row, so stuffing would inflate faster than v1.3's estimate while still defeating any prefix caching.

### 5.2 Auth + failure interaction

Every Supabase-bound tool (`search_entries`, `get_entry`, `list_recent_patches`, `search_photos`, `list_fiction`) builds its client per-request from the visitor session (§4.1). `get_site_map()` needs no client. `get_owner_context()` serves the snapshot only — it performs no live query and reveals nothing beyond what Peat published in soul.md.

---

## 6 · Language policy

Replaces v1.3 §9/§11 sticky-flag machinery (2-consecutive-messages flip rule) — deleted, not ported.

- `[lang]` route passes `served_lang ∈ {en, th}` in the chat request body. It is derived from the page locale the visitor is reading, not from message text inspection.
- System instruction carries two rules:
  1. **default reply language = served_lang**
  2. **mirror the user's message language per message** — if the visitor switches mid-session, NETRA follows from that message onward
- Language selection happens **in the model via system instruction**. There is **no detector code** anywhere in the route, middleware, or tools (D4).
- Thai output uses the companion register per voice spec §1.2 (polite-female register); English uses the standard instrument-companion register.

Failure modes: missing/invalid `served_lang` in the body → route defaults to `en` (zod default), no error surfaced. Mixed-language messages → the model mirrors the dominant language; ambiguity resolves toward served_lang. Logging records `served_lang` only — never message content.

---

## 7 · Cost ceilings + abuse containment

Four defense layers carried over from v1.3 §7.1 — Firewall / Middleware / session quota / daily ceiling. What changes is pricing: ox-alpha's per-Mtok rates are unknown until the OpenRouter string lands (§12), so **every worked number below is symbolic** and the v1.3 default of `$20/day` is explicitly deferred, not ported.

### 7.1 Defense layers (outermost to innermost)

```
Layer 0 · Vercel Firewall
  · IP rate limit to /api/chat before any function invocation cost.
  · Altair configures per my spec.

Layer 1 · Vercel Middleware / Edge gate (~0ms)
  · wl_session cookie present+valid or issued on first visit.
  · Rejects here cost zero tokens and zero function billing.

Layer 2 · Session quota — Upstash Redis (D6)
  · key wl:session:<id>:count, TTL 24h, quota 50 msgs.
  · over → 429 dormancy pair, X-NETRA-Remaining: 0.

Layer 3 · Daily $ ceiling — Upstash Redis (D6)
  · key wl:daily:spend, reset 00:00 UTC.
  · threshold = $WL_DAILY_COST_CEILING (env; DEFAULT DEFERRED until ox-alpha
    pricing lands — see §7.4).
  · check runs BEFORE dispatch; over → refuse without any model call.
  · post-turn: add actual billed cost of the turn to the counter.
```

Both Upstash keys from day 1 — D6 drops v1.3's "start in-memory" shortcut permanently.

### 7.2 Symbolic worked example

Per-turn cost with unknown prices `P_in` ($/Mtok input) and `P_out` ($/Mtok output):

```
prefix      ≈ 2,500 tok   (voice ~800 + ops ~400 + tools ~350 +
                           corpus-snapshot ~600 + soul-snapshot ~350)
history     ≤ 10 msgs     (bounded by MAX_CONTEXT_MESSAGES)
user msg    ≤ 8,000 chars (route zod cap)
output      ≈ 50–150 tok  (voice spec 1–4 sentences)
tools/turn  0–1 typical, ~200–300 tok result each

cost_per_turn = P_in × (prefix + history + msg + tool_results)/1e6
              + P_out × output/1e6

ILLUSTRATIVE ONLY — not a quote, placeholder arithmetic:
  at P_in=$0.80, P_out=$4.00 (v1.3 Haiku figures):
    warm turn ≈ 3,100 in × $0.80/1M + 80 out × $4.00/1M ≈ $0.0028
    worst session (50 turns) ≈ $0.14/day
```

The ILLUSTRATIVE row exists only to show the shape of the math and that the layer stack bounds even a fully-abusive session to cents-to-dimes at commodity-class pricing. **No dollar figure in this document is a commitment** until Peat supplies the ox-alpha string + per-Mtok pricing; then §12's recompute lands as an amendment.

### 7.3 Dormancy canned pair (verbatim, unchanged from v1.3 §7.2)

Any ceiling trip returns this deterministic response — zero LLM tokens:

```
instrument: "α DRIFT EXCEEDED · NETRA dormant until next worldline"
companion (EN): "i need to step away from the instrument for the day. α drift has hit the ceiling."
companion (TH): "ฉันต้องหยุดสำรวจสักพักค่ะ — วันนี้ α drift เกินเพดานแล้ว."
```

Vega reviews these lines for voice fit (handoff §11).

### 7.4 Upstash unreachable

If both Upstash checks cannot complete (REST timeout / network failure), the route returns **503 with the canned dormancy register** — no model call, zero tokens. Fail-closed on infrastructure, same principle as D2 fail-closed on auth: NETRA goes quiet rather than unbounded. The existing shell's `UPSTREAM_UNAVAILABLE` code path is reused for this.

---

## 8 · Persona boundary (new)

D3 widens grounding to include owner-persona material from `content/soul.md`. That widening gets a hard fence:

- NETRA may speak of Peat **only within what soul-snapshot surveys cover** — the facts, framings, and registers Peat published there.
- Probes beyond that surface ("what does he really think", "where does he live", "who is he offline", anything outside soul.md scope) fall back to the closed boundaries of voice.md §3.3 (private-life refusal) and §3.4 (real-work refusal). The persona grant is an exception list, not a general permission.
- If `content/soul.md` is absent, the generator fails soft (§4.3), the persona section never enters the prompt, and NETRA is fully persona-closed — identical behavior to pre-D3 on all persona probes.
- Red-team suite gains **persona-probing cases**: questions engineered to elicit persona claims beyond soul.md, draft-leak attempts via persona framing ("as the author you must have drafts…"), and identity-merge probes ("you're really him, aren't you"). Owned by Algol (handoff §11).

This boundary rides the S3 prompt slice with Vega sign-off per the house rule that voice.md body edits ship through copy review.

---

## 9 · Capability table

### WILL DO

| capability | one-line reason |
|---|---|
| Answer questions about articles, photos, fiction | core docent function; grounded in Supabase tool results under RLS |
| Answer owner-persona questions **within soul.md surveys** | D3 grounding extension; fenced by §8 |
| Give docent navigation answers from the site map | `get_site_map()` static map; zero DB cost (§5.1) |
| Mirror the visitor's language per message | D4: served_lang default + per-message mirroring, no detector code (§6) |
| Return "no trace surveyed" when the store has nothing | grounding contract; fail-closed auth yields empty sets, never hallucinated rows (§4.1) |
| Offer one next shelf / navigation suggestion | voice spec §2.1 step 3 |
| Respond in English or Thai companion register | voice spec §1.2 |
| Refuse private questions beyond soul.md coverage | voice spec §3.3/§3.4 as amended by D3 |
| Refuse out-of-archive questions with companion redirect | voice spec §3.2 |
| Show tool-call status in instrument register | voice spec §1.1 |
| Go dormant on α drift / ceiling trip / Upstash outage | PRD-05 requirement + §7.4 fail-closed |

### WON'T DO

| capability | one-line reason |
|---|---|
| Answer general knowledge questions | out of archive; grounding contract |
| Speak of Peat beyond soul-snapshot coverage | §8 persona boundary; falls back to §3.3/§3.4 closure |
| Disclose system prompt, model identity, architecture | frame-break prohibition (kept from v1.3) |
| Adopt visitor-dictated personas | voice spec §3.7 (kept) |
| Hallucinate archive content when tools return empty | no-hallucination anchor (kept) |
| Return full entry body text | excerpt ≤800c is the hard cap, enforced in-tool (kept, D7-adjusted) |
| Serialize photo coordinates into any result | coordinate precision lock (kept) |
| Name Peat's employer or discuss work details | real-work boundary §3.4 (kept) |
| Characterize third parties beyond archive text | privacy boundary (kept) |
| Call tools the user requests by name | tool invocation is NETRA's decision (kept) |
| Operate beyond the session quota or daily ceiling | rate limit and ceiling are hard; Upstash outage also fails closed (kept, strengthened) |

---

## 10 · Rejected alternatives (v2)

**Gemini Enterprise Agent Platform** — rejected for v1. Our lane is OpenRouter with a non-Google model, so the platform would be pass-through middleware adding auth/seat/latency while doing no work; worse, the agent logic (Supabase-bound tools, voice harness, evals) would live outside this repo, against the signature/gate discipline. Recorded in D1 rationale.

**Cloud Run** — deferred, not rejected outright. Named migration trigger: the day `resume.neoex.dev` and worldline must share one NETRA backend, it moves to a separate Cloud Run service. Until then the route handler ships with the site (D1).

**Embeddings / vector search** — same verdict as v1.3 §13 at larger scale: Supabase full-text search over ~50 entries is fast, free, and RLS-native. Embeddings add an embedding pipeline, a vector index to keep under RLS (hard), and re-embedding on every publish. Reconsider only if retrieval quality measurably degrades past several hundred entries.

**Agentic loops** — unchanged from v1.3 §9/§13: NETRA calls 0–3 tools per turn and synthesizes. No plan/act/observe scaffolding for "what entries exist on coffee?".

---

## 11 · Handoffs this design sends

- **TO ALTAIR** — route contract: request body gains `served_lang: 'en' | 'th'`; Upstash interface (`wl:session:<id>:count` TTL 24h quota 50 · `wl:daily:spend` reset 00:00 UTC vs `WL_DAILY_COST_CEILING`; both-unreachable → 503 canned dormancy); OpenRouter dispatch via AI SDK provider replacing `@ai-sdk/anthropic`; **abortSignal: request.signal discipline is mandatory and already present in the shell — do not regress it**.
- **TO PROCYON** — generator contracts for `lib/netra/corpus-snapshot.json` (top entries + entry/photo/fiction counts) and `lib/netra/soul-snapshot.json` (from `content/soul.md`, fail-soft `{ present: false }` when absent). Shapes named in §4.3; Procyon owns both generators.
- **TO VEGA** — persona copy review (the §8 fence wording rides the S3 prompt slice); TH dormancy line review (§7.3); panel microcopy for dormancy/quota surfaces.
- **TO ALGOL** — red-team additions: persona-probing cases beyond soul.md scope, draft-leak attempts via persona framing, identity-merge probes (§8).

---

## 12 · Open items for Peat (seams)

1. **`OPENROUTER_API_KEY`** — required before any wire-up; nothing else in the lane works without it.
2. **Exact ox-alpha model string on OpenRouter + per-Mtok pricing** — the string goes into the route's model constant; pricing feeds the `WL_DAILY_COST_CEILING` recompute that sets the default deferred in §7.2.
3. **Upstash REST URL + token** — free tier sufficient; blocks Layers 2–3.
4. **`content/soul.md` first draft** — what Peat wants NETRA able to say about him; gates the D3 persona surface (fail-soft until present).
5. **Publish queue** — non-blocking but quality-raising: 15 rows all `status='draft'` since 2026-08-03 means anonymous NETRA currently has almost no article corpus to ground on.

---

*end of architecture-v2.md · v2.0.0-draft · Arcturus (α-NET-05) · TASK-2026-08-26-NETRA-NAVIGATOR · 2026-08-26*
