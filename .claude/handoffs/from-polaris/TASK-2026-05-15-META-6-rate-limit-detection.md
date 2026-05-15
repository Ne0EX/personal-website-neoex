# TO · Canopus (α-HRN-07)
# FROM · Polaris (α-OPS-00)
# TASK · TASK-2026-05-15-META-6
# TYPE · TASK CONTRACT
# CREATED · 2026-05-15
# MODEL TIER · sonnet
# TRIGGER · Peat directive 2026-05-15 — rate-limit detection so 100-agent dispatch is safe; today's cascade took down 12 agents simultaneously without warning

---

## scope

Build a deterministic **rate-limit awareness mechanism** — detect when Polaris is approaching Anthropic burst quota and emit warning BEFORE the next dispatch. Without this, big waves cascade-fail at the worst moment.

Today's evidence: 12-agent burst hit account-level limit; ALL active subagents lost their model loop simultaneously. The only signal was rate-limit response messages AFTER the failure.

## vision fidelity

not applicable · harness telemetry work, no brand surface touched

## canonical inputs

- Today's rate-limit incident · disk artifacts in `.claude/handoffs/` show "rate limit hit" messages and missing return handoffs as evidence
- `.claude/hooks/pre-task.sh` + `session-start.sh` + `on-dispatch.sh` (hook pattern references)
- `/tmp/claude-*/tasks/*.output` (subagent transcripts — may contain rate-limit response payloads with Anthropic headers; check if `x-ratelimit-*` or similar are present)
- `.claude/settings.json` (PreToolUse(Agent) wiring point)
- Vercel knowledge update — Anthropic API rate-limit conventions
- `.claude/hooks/save-checkpoint.sh` (META-4 product) — coordinate; rate-limit warning should also force a checkpoint

## deliverables

1. `.claude/hooks/rate-limit-watch.sh` — runs on PreToolUse(Agent):
   - Read recent dispatches log (count subagent dispatches in last N seconds)
   - If response transcript available, extract `x-ratelimit-*` headers and persist to `.claude/audit/rate-limit-state.ndjson`
   - Estimate "burst budget remaining" using simple sliding-window heuristic
   - Emit JSON to stdout with `{level: ok|warn|critical, suggested_action: proceed|delay|abort}`
2. `.claude/audit/rate-limit-state.ndjson` (gitignored) — running state
3. `scripts/check-rate-limit.sh` — manual invoke for Peat / Polaris
4. `docs/harness/RAIL-DEFINITIONS.md` update — new "Rate-limit awareness rail" section

## constraints

- **No external API calls** — pure observation from local state + subagent transcripts
- Deterministic; survives across sessions (state in ndjson)
- Fail-safe: if heuristic uncertain → return `level=warn`, never `critical` falsely (false positives are costly)
- Hook latency < 200ms on PreToolUse
- Do NOT block dispatch — emit signal only; Polaris reviews `level` before next Agent call. Per VISION-FIDELITY §9 Canopus note: "preserve human judgment while preventing silent omission"

## harness protocol

- pre-task.sh Step 0 (use `TASK-2026-05-15-META-6`)
- sign-work.sh
- Return handoff at `.claude/handoffs/from-canopus/TASK-2026-05-15-META-6--to-polaris.md`

## acceptance criteria

- Hook fires on PreToolUse(Agent); written ndjson grows
- Smoke test simulating burst (≥10 dispatches in 60s) emits `level=warn` at threshold N=8 or similar (tunable)
- Manual `bash scripts/check-rate-limit.sh` outputs current state in human-readable form
- No false `critical` on cold start (no history)
- Signature v2 clean

## downstream impact

Polaris can dispatch confidently at scale — read `check-rate-limit.sh` output before each big wave; if `warn` → delay or chunk into smaller batches.

Feeds into META-7 (pre-burst gate) which uses this signal as one input.

---

*polaris · α-OPS-00 · 2026-05-15 · prevent silent cascade*
