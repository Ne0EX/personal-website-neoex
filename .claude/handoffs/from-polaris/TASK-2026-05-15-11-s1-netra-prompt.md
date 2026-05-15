# TO · Arcturus (α-NET-05, AI Engineer)
# FROM · Polaris (α-OPS-00)
# TASK · TASK-2026-05-15-11-S1
# TYPE · TASK CONTRACT (draft · pending root-Polaris release)
# CREATED · 2026-05-15
# MODEL TIER · **opus likely** (rubric match per DEV-PLAN-D §D.7: NETRA system-prompt architecture — full prompt + tool surface + refusal taxonomy + context injection + rate-limit copy; novel single-surface, no PoC reference)
# tier-decision · root-Polaris finalizes at dispatch; sonnet acceptable if Arcturus shows strong baseline draft

---

## scope

Author the NETRA prompt architecture: system prompt module, tool surface (5 tool implementations
hooks/contracts), refusal taxonomy, context-injection rules, rate-limit response copy. Output is
**spec-level** (`docs/netra/*.md`) — implementation lands in TASK-51 from this contract.

This is the AI-side foundation for the chat surface. Pairs with TASK-11-S2 (Betelgeuse chat UI spec)
and TASK-50 (Altair route shell). All three must converge on a shared message + tool-call shape.

## canonical inputs (READ FIRST — non-negotiable)

1. **`docs/prds/PRD-00-netra-character.md`** v1.0 — voice/character bible (settled)
2. **`docs/prds/PRD-05-netra-chat.md`** — runtime grounding · session shape · rate limit (50/24h) · dormant copy
3. **`docs/design/attractor-binding-mechanic.md`** (TASK-14) — chat-event ↔ Globe coupling (if any per Peat); how NETRA references the binding mechanic in tool descriptions
4. **TASK-50 output** · `app/api/chat/route.ts` shell — the route this prompt's tools execute through; depends on TASK-50 closing first
5. **TASK-21 output** · `docs/netra/voice-spec.md` — voice discipline rules (companion-vs-instrument register markers); MUST be honored in system prompt; depends on TASK-21 closing
6. **`docs/design/journey-architecture.md` v1.2** §4 NETRA placement + behavior
7. **MEMORY note `feedback_thai_register`** — ข้า > กู for masc agents; NB no particle; fold into voice rules
8. **`lib/content/` accessors** (TASK-22) — tools that surface content (articles/photos/fiction) hit these typed accessors; design tool descriptions to align with the typed shape
9. **`docs/team/FILE-OWNERSHIP.md`** — Arcturus territory (`lib/netra/**`, `docs/netra/**`)

## deliverables

`docs/netra/prompt-architecture.md` — primary spec, organized:

1. **§1 NETRA persona inputs (compressed)** — character bible distilled into prompt-effective tokens
2. **§2 System prompt** — full text of the system prompt module (multi-line; markdown-fenced)
3. **§3 Tool surface (5 tools minimum)** — each tool:
   - name · purpose · input schema (zod-ish JSON schema) · output schema · when NETRA should call it
   - candidates: `recall_entry(slug)`, `search_content(query)`, `current_worldline()`, `locate_on_globe(slug)`, `divergence_reading()`
   - exact set negotiable; Arcturus decides based on what surfaces NETRA needs to ground against
4. **§4 Refusal taxonomy** — concrete refusal phrasings for: out-of-corpus questions · privacy-sanitized queries · rate-limit exceeded (dormant copy) · adversarial / jailbreak attempts · NSFW
5. **§5 Context-injection rules** — what content (if any) gets injected into the prompt vs. fetched via tool; budget for token spend per turn
6. **§6 Rate-limit interaction** — 50/24h per session cookie; client-visible response when exceeded (PRD-05 `α drift exceeded · NETRA dormant until next worldline.`)
7. **§7 Voice & register** — companion-vs-instrument marker convention; Thai register policy (per TASK-21 + memory); examples
8. **§8 Cross-agent contracts** — message shape · tool-call shape · streaming chunk shape (paired with Altair TASK-50 + Betelgeuse TASK-11-S2)
9. **§9 Test fixtures (10 prompts minimum)** — eval prompts demonstrating each refusal category + each tool call; lands at `tests/netra/eval-prompts.md` (Arcturus territory) as side artifact

## constraints

- **Do NOT modify** `app/api/chat/route.ts` shell — Altair territory; this spec describes contracts the shell consumes
- **Do NOT implement** `lib/netra/prompts/*.ts` or `lib/netra/tools/*.ts` — TASK-51 implementation TASK
- **Do NOT design** chat UI — TASK-11-S2 (Betelgeuse) parallel TASK
- **Do NOT** introduce new design tokens
- Honor v1.3 Globe ontology if any tool references coordinates (`OBSERVER_AXIS_NODES` per axis Y-position semantics)
- Refusal copy must align with Vega voice; Vega sign-off on refusal phrasings before TASK-51 implementation
- Eval prompts at `tests/netra/eval-prompts.md` — Arcturus owns this; Algol owns the runner (`scripts/eval-netra.ts`)

## harness protocol

- Step 0 · `bash .claude/hooks/pre-task.sh TASK-2026-05-15-11-S1 arcturus`
- sign with `WL_AGENT=arcturus WL_NEXT=polaris WL_SUMMARY="NETRA prompt architecture + tool surface + refusal taxonomy (TASK-11-S1)" bash .claude/hooks/sign-work.sh TASK-2026-05-15-11-S1`
- return at `.claude/handoffs/from-arcturus/TASK-2026-05-15-11-S1--to-polaris.md`

## acceptance criteria

- All 9 sections present and substantive
- System prompt text is complete (no `[TBD]` placeholders)
- Minimum 5 tools defined with input/output schemas
- Refusal taxonomy covers at least 5 categories with concrete phrasings (Vega sign-off received before close)
- Cross-agent message/tool-call/streaming-chunk shapes documented (compatible with Vercel AI SDK)
- 10+ eval prompts at `tests/netra/eval-prompts.md` demonstrate each category and each tool
- Signature v2 clean (post-D3 attribution)
- Algol audit ready per standing rule (+ Vega prose review on refusal copy)

## downstream impact

Unblocks:
- **TASK-11-S2** δ-UI chat spec (Betelgeuse — depends on this prompt arch for message-shape contract)
- **TASK-51** prompt + tool implementation (`lib/netra/{prompts,tools}/**`) — direct child TASK
- **TASK-52** chat drawer (Sirius — consumes via TASK-50 route + TASK-51 modules)
- The voice-discipline audit rail (TASK-21 graduation from STUB-PASS to real audit)

---

*polaris · α-OPS-00 · 2026-05-15 · TASK-11-S1 draft contract (META-2 pre-stage)*
