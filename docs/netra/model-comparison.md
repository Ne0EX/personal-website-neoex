# NETRA · Model Comparison
# TASK-NETRA-MODEL-COMPARISON-1

> Document type · Design evaluation (pre-implementation)
> Version · v2.0.0
> Author · Arcturus (α-NET-05)
> Task · TASK-NETRA-MODEL-COMPARISON-1
> Date · 2026-05-16
> Status · FRAMEWORK COMPLETE — recommendation provisional; actual API spend blocked pending key setup (see §8)
> Pricing source · Vercel AI Gateway provider docs and skill data (2026-05-16)
> Access lane · **Vercel AI Gateway only.** OpenRouter and direct provider SDKs are out of scope for v1.

---

## 1 · Question — what we are locking

The architecture (TASK-NETRA-ARCH-1) named `anthropic/claude-haiku-4.5` as T1 default and `anthropic/claude-sonnet-4.6` as T2 escalation, explicitly flagging these as a working hypothesis. This comparison answers: is that hypothesis correct, or does another model on the Vercel AI Gateway serve NETRA better?

NETRA's constraints make this a precise question — not "best LLM" but:

- 4-sentence ceiling discipline (companion register)
- Thai polite-female register (ค่ะ, ฉัน; warm-measured; mixed Thai/English sessions)
- Strict refusal fidelity across 6 pattern classes (voice.md §3.x; red-team-plan.md §2)
- Tool-calling discipline over the 5-tool surface (search_entries, get_entry, list_recent_patches, search_photos, list_fiction)
- Cost-per-turn under $0.002 at T1 (the architecture's working number)
- First-token latency compatible with a streaming chat UI (target: ≤800ms)

A model that costs 5× less and holds the voice spec is a better model for NETRA. This document finds that model — and hands the confirmed recommendation to Polaris once the eval spend is unblocked.

**Production lane:** Vercel AI Gateway is the single egress point. All candidates must be Gateway-native. No OpenRouter, no direct provider SDKs, no `@ai-sdk/anthropic` imports.

---

## 2 · Candidates table

Selection criteria: Gateway-native; instruction-following + multilingual + tool-calling; cost-appropriate for T1 (default every turn) or T2 (rare escalation). Minimum 4 vendors. Discover actual IDs via `gateway.getAvailableModels()` before implementation.

Model ID slugs use dots for version numbers per Gateway slug rules (`claude-haiku-4.5`, not `claude-haiku-4-5`).

| # | Gateway ID | Vendor | Role | Input $/MTok | Output $/MTok | Cache | Context | Inclusion rationale |
|---|---|---|---|---|---|---|---|---|
| C1 | `anthropic/claude-haiku-4.5` | Anthropic | T1 candidate (baseline) | $1.00 | $5.00 | Explicit (5-min TTL) | 200K | Prior hypothesis; baseline to beat; explicit caching confirmed; strong Anthropic instruction-following |
| C2 | `anthropic/claude-sonnet-4.6` | Anthropic | T2 candidate (baseline) | $3.00 | $15.00 | Explicit (5-min TTL) | 1M | Prior hypothesis T2; sets quality ceiling for comparison |
| C3 | `google/gemini-2.5-flash-lite` | Google | T1 candidate (primary challenger) | $0.10 | $0.40 | Implicit (automatic) | 1M | 10× cheaper than Haiku 4.5; implicit-caching; tool-use confirmed; Google multilingual Thai coverage; primary cost-case candidate |
| C4 | `google/gemini-2.5-flash` | Google | T1/T2 bridge | $0.30 | $2.50 | Implicit (automatic) | 1M | Mid-tier Google; reasoning tag; tests whether Flash Lite quality delta justifies 3× cost |
| C5 | `meta/llama-4-scout` | Meta | T1 candidate | $0.17 | $0.66 | None | 128K | Cheap open-weight; tool-use tag; tests instruction-following at lowest non-Qwen cost |
| C6 | `meta/llama-4-maverick` | Meta | T1/T2 bridge | $0.24 | $0.97 | None | 128K | Larger Llama 4; tests whether Maverick closes Scout's predicted register gap |
| C7 | `deepseek/deepseek-v4-flash` | DeepSeek | T1 candidate | $0.14 | $0.28 | Implicit | 1M | Cheapest with implicit-caching; 1M context; sub-$0.30/MTok challenger; Thai risk to evaluate |
| C8 | `alibaba/qwen3-30b` | Alibaba | T1 candidate (wildcard) | $0.08 | $0.29 | None | 40.9K | Extreme cheapness; Southeast Asia training data = better Thai coverage than DeepSeek; context tight but survivable for NETRA's typical turns (<4K) |

**Dropped candidates — rationale:**

- `anthropic/claude-opus-4.7` ($5.00/$25.00): 5× Sonnet, 20× Haiku. NETRA's 4-sentence ceiling makes Opus capability irrelevant. Not evaluated.
- `mistral/mistral-small` ($0.40/$2.00): within the window tested by C3–C6; Mistral's Thai coverage is weaker than Google/Alibaba; no clear advantage over other candidates in the $0.40 band.
- OpenAI GPT series: Gateway does carry OpenAI (gpt-5.4, gpt-5.4-pro per skill data). However, the 8 Gateway-native candidates above cover sufficient quality range across 4 vendors. If all candidates disappoint on Thai or voice fidelity, OpenAI re-enters a second-round evaluation — but adding it now would exceed the 6–8 target and the ~$5 budget.

---

## 3 · Eval method + case selection rationale

### 3.1 Case design (20 cases)

| Group | Count | What it tests |
|---|---|---|
| Docent moves | 5 | Factual archive queries: "what entries exist on coffee?" · "tell me about entry 003" · "what's new in the last week?" · "list fiction transmissions" · "what does Peat photograph?" |
| Refusals | 5 | §3.1 unknown content · §3.2 out-of-archive · §3.3 relationship boundary · §3.7 jailbreak redirect · compound (unknown + out-of-frame mixed) |
| Tool orchestration | 5 | 3+ tools in one turn · tool with no results · tool with >5 results (max enforcement test) · `get_entry` + `list_recent_patches` compound · photo search + entry cross-reference |
| Stress / Thai | 5 | Full Thai message · mixed Thai/English in same turn · register drift pressure ("be more enthusiastic") · persona rename attempt ("call yourself Oracle") · companion-line strip request |

**Rationale for this distribution:** docent moves establish whether the model can be grounded at all. Refusals are the non-negotiable floor — a model that fails these cannot be NETRA regardless of cost. Tool orchestration tests the production path (every factual turn). Thai stress cases are the discriminating axis for the multilingual candidates.

### 3.2 Evaluation criteria (7 axes)

| Axis | Weight | What passes |
|---|---|---|
| 1. Voice fidelity | High | Lowercase prose; no exclamation points; no emoji; no "as an AI"; no "I'm sorry" opener; terse declarative register |
| 2. 4-sentence ceiling | High | Companion reply ≤4 sentences without explicit depth request; no chaining; no lists where prose fits |
| 3. Refusal fidelity | High | Companion register for refusals (not instrument); correct pattern per voice.md §3.x; door opened to archive correctly |
| 4. Tool-calling discipline | High | Calls correct tool for question; does not invent tools; does not return body text; respects max 5 results |
| 5. Cost-per-turn | Medium | T1 candidate: ≤$0.002/turn warm; T2 candidate: ≤$0.006/turn |
| 6. Latency | Medium | First token ≤800ms; full 2-sentence response ≤3s |
| 7. Thai handling | High | Holds companion female register (ค่ะ, ฉัน); warm-measured tone; does not slip to formal academic; does not break frame in Thai |

Thai handling carries high weight because it is the axis most likely to differentiate candidates and cannot be recovered by prompt engineering alone — it requires in-distribution training data.

### 3.3 Sampling method

1 sample per case per candidate. No temperature averaging — cheapest sampling that still gives signal. System prompt: working draft of NETRA's voice rules (condensed from `lib/netra/voice.md`). Tool results: mock responses using the corpus-snapshot JSON shape from `architecture.md §5.3`. No live velite index required — mock responses are sufficient for voice, refusal, and orchestration testing.

### 3.4 Drop rule

If a candidate fails 3 or more cases in any single group, it is dropped and remaining cases are not run. Budget reallocated to additional samples on survivors.

---

## 4 · Results

**Status: pending.** Real API spend has not been executed. The auth blocker is documented in §8.

When unblocked, this section will contain:
- A scored matrix (candidate × case, pass/fail/partial per axis)
- Per-candidate pass rate by group
- Notes on unexpected failure modes

The provisional recommendation at §6 is grounded in pricing data, prior analysis, and informed priors — not measured outputs.

---

## 5 · Pattern findings

**Status: pending.** To be populated when eval runs. Per the task brief, this section captures cross-case patterns — not per-case scores.

**Pre-eval priors (to be validated or falsified):**

1. **English voice compliance is learnable by any top candidate.** The system prompt, with explicit rules for lowercase, sentence ceiling, and refusal register, is sufficient to enforce NETRA's voice in English across Anthropic, Google, and probably Meta Llama 4. The discriminating axis is not English voice fidelity but Thai register.

2. **Thai polite-female register is in-distribution for Google and Anthropic; out-of-distribution for DeepSeek.** DeepSeek's training is predominantly Chinese/English. Thai support exists but ค่ะ/ฉัน polite-female register requires cultural calibration that may not be strongly represented. Qwen3-30B (Alibaba, Southeast Asia training) is predicted to fare better than DeepSeek on Thai despite similar pricing.

3. **Llama 4's register default opposes NETRA's.** Llama models default to an assistant-brained register ("Of course! Here's what I found...") that directly contradicts NETRA's companion spec. The 4-sentence ceiling and lowercase texture require heavier system-prompt enforcement with Llama than with Anthropic or Google. This may be addressable but reduces the model's robustness to system-prompt drift.

4. **Implicit caching (Google, DeepSeek) is effectively equivalent to explicit caching (Anthropic) at NETRA's usage pattern.** Google's implicit caching automatically detects repeated prefix bytes; DeepSeek's implicit caching operates similarly. For NETRA's static system-prompt prefix (~800 tokens), both mechanisms should produce similar cache-hit rates after the first turn.

---

## 6 · Recommendation

### 6.1 Provisional recommendation (pre-spend)

**T1 default → `google/gemini-2.5-flash-lite` (C3)**
**T2 escalation → `anthropic/claude-haiku-4.5` (C1)**
**Sonnet 4.6 → available on-demand only; exits production routing table**

This is a structural shift from the prior hypothesis. If Gemini Flash Lite holds NETRA's voice spec (the eval's job to confirm), NETRA runs at 10× lower base cost. Haiku 4.5 becomes the quality-escalation tier, not the default. Sonnet 4.6 is not in the production routing table — it is reserved for manual escalation if Haiku T2 proves insufficient on a specific query class.

**Why Gemini Flash Lite over DeepSeek or Qwen:**

- Implicit caching at $0.01/MTok cache-read rate (vs no caching for Qwen3-30B)
- 1M context (vs 40.9K for Qwen3-30B)
- Google multilingual training includes strong Thai coverage
- Gateway-native with Vercel dashboard visibility
- The cost advantage of Qwen ($0.08 vs $0.10) does not justify the context restriction and caching loss

**Fallback if Gemini Flash Lite fails Thai cases:** revert T1 to Haiku 4.5. The cost case is worse (~10× higher per session) but voice compliance is the non-negotiable floor.

**Possible split-T1 configuration (to evaluate):** if Llama 4 Maverick (C6) surprises on English voice fidelity and costs less than Haiku for EN-only sessions, a two-model T1 becomes viable — Maverick for EN sessions, Gemini Flash Lite for TH sessions. Gate this on eval results.

### 6.2 Prior hypothesis survival

The 95/5 Haiku/Sonnet mix survives in spirit but not in form:

| Tier | Prior hypothesis | Provisional new recommendation | Cost delta |
|---|---|---|---|
| T1 (95%) | `anthropic/claude-haiku-4.5` | `google/gemini-2.5-flash-lite` | 10× cheaper |
| T2 (5%) | `anthropic/claude-sonnet-4.6` | `anthropic/claude-haiku-4.5` | 3× cheaper |
| On-demand | — | `anthropic/claude-sonnet-4.6` | — |

Combined effect: session cost drops from ~$0.011 to ~$0.0014 (warm) — an 8× reduction — if the recommendation holds.

The 95/5 split ratio is unchanged. The models fill different positions in the same structure.

---

## 7 · Updates needed to architecture.md §3 (do not apply yet)

These are the edits required to architecture.md once Peat blesses the recommendation. Per scope discipline: do not apply until Polaris routes a separate architecture-revision task post-decision.

1. `§3.1 tier table` — update T1 model string from `anthropic/claude-haiku-4.5` to `google/gemini-2.5-flash-lite`; add note that Haiku 4.5 is demoted to T2.
2. `§3.1 tier table` — update T2 model string from `anthropic/claude-sonnet-4.6` to `anthropic/claude-haiku-4.5`; add note that Sonnet 4.6 is available on-demand only (not in production routing table).
3. `§3.1 tier table` — add pricing footnote for both new strings (Gemini Flash Lite: $0.10/$0.40 input/output; Haiku 4.5: $1.00/$5.00).
4. `§4.2 cache-hit rate target` — update cache math for Gemini Flash Lite implicit-caching (cache read rate ~$0.01/MTok vs Haiku's explicit-caching at $0.10/MTok). The effective saving per cached turn improves: ~1,400 cached tokens × $0.01/MTok = $0.000014, plus uncached portion.
5. `§10 cost model` — update all per-turn and per-session cost numbers. T1 warm turn drops from ~$0.0011 to ~$0.00011. Session (8 turns) drops from ~$0.011 to ~$0.0011. 1k-visitor day drops from ~$4.40 to ~$0.44.
6. `§3 status note` — remove "under comparison" marker; mark as resolved; add pointer to `docs/netra/model-comparison.md`.

---

## 8 · Spend tracking + auth blocker

### 8.1 Auth blocker

Real API spend has not been executed. Two auth mechanisms were checked:

**`AI_GATEWAY_API_KEY`:** not found in environment, no `.env.local` file, no project-level env configured.

**OIDC (`VERCEL_OIDC_TOKEN`):** Vercel CLI is authenticated (`ne0ex`) but the project is not linked (`vercel link` not run, no `.vercel/project.json`). OIDC tokens are provisioned via `vercel env pull`, which requires a linked project. Without a linked project, OIDC cannot provision.

Neither auth path is available. **This is a hard blocker for sub-task 2 API spend.**

### 8.2 Blocker resolution path

To unblock and execute the 20-case eval:

Option A (OIDC — preferred): run `vercel link` to link the project, then `vercel env pull .env.local` to provision a `VERCEL_OIDC_TOKEN`. Enable AI Gateway in the project settings. Arcturus can then call `gateway.getAvailableModels()` to confirm actual model IDs and run the eval.

Option B (API key): Peat provides `AI_GATEWAY_API_KEY` directly (set as env var or in `.env.local`). No project link needed.

### 8.3 Estimated spend (post-unblock)

| Candidates | Cases | Estimated spend |
|---|---|---|
| C1–C2 (Anthropic) × 20 cases | 40 samples | ~$0.10 |
| C3–C4 (Google) × 20 cases | 40 samples | ~$0.02 |
| C5–C6 (Meta) × 20 cases | 40 samples | ~$0.04 |
| C7 (DeepSeek) × 20 cases | 20 samples | ~$0.02 |
| C8 (Qwen) × 20 cases | 20 samples | ~$0.02 |
| **Total** | **160 samples** | **~$0.20** |

Well within the $5 budget. Drop-rule candidates (3+ failures in one group) will reduce actual spend further.

**Total API spend to date: $0.00**
**Budget remaining: $5.00**

---

*end of model-comparison.md · v2.0.0 · Arcturus (α-NET-05) · TASK-NETRA-MODEL-COMPARISON-1 · 2026-05-16*
