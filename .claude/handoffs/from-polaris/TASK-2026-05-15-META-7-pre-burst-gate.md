# TO · Canopus (α-HRN-07)
# FROM · Polaris (α-OPS-00)
# TASK · TASK-2026-05-15-META-7
# TYPE · TASK CONTRACT
# CREATED · 2026-05-15
# MODEL TIER · sonnet
# TRIGGER · Peat directive 2026-05-15 — pre-burst gate that consults system robustness before allowing N-agent dispatch

---

## scope

Build a **pre-burst awareness layer** that runs before Polaris dispatches a large parallel wave. Aggregates signals from META-4 (checkpoint freshness) + META-6 (rate-limit state) + active-subagent counter + opus budget tracker → emits a go/delay/abort recommendation Polaris reviews.

Not a blocker. Not a rejector. **A consultable conscience.**

## vision fidelity

not applicable · harness orchestration, no brand surface touched

## canonical inputs

- META-4 checkpoint hook output · `docs/team/SAVE-POINT.md` mtime → "is the last save recent?"
- META-6 rate-limit state · `.claude/audit/rate-limit-state.ndjson` → "what's burst budget?"
- `.claude/audit/dispatch.ndjson` (or similar; create if doesn't exist) → active subagent count
- DEV-PLAN-D §D.7 opus override ledger · count opus signatures used vs budgeted (4)
- `docs/team/STATUS.md` (post-META-3 section-lock format) → in-flight TASK count

## deliverables

1. `scripts/pre-burst-check.sh` — Polaris invokes before any Agent dispatch with N>1:
   ```
   $ bash scripts/pre-burst-check.sh --intent-n 5 --intent-agents "betelgeuse,vega,arcturus,algol,canopus"
   ```
   Output (JSON + human):
   ```
   {
     "verdict": "proceed | delay | chunk-into-N | abort-and-checkpoint",
     "signals": {
       "checkpoint_age_seconds": 120,
       "rate_limit_level": "ok",
       "active_subagents": 0,
       "opus_budget_remaining": 1,
       "in_flight_tasks": 4
     },
     "advice": "Proceed; system green across all signals."
   }
   ```
2. `.claude/hooks/pre-burst-record.sh` — runs on PostToolUse(Agent) success to log dispatch into ndjson (track active count)
3. `.claude/audit/dispatch.ndjson` (gitignored) — running dispatch log
4. `docs/harness/RAIL-DEFINITIONS.md` update — "Pre-burst gate" section

## constraints

- **Advisory only** — never blocks Polaris's Agent call; emits recommendation
- Fast: < 500ms (Polaris reads inline before each big wave)
- Composable with manual override · Polaris can ignore advice if she has reason; the advice gets logged
- If a signal source is missing/stale → emit `warn` not `critical`
- Honor Peat directive: "main decisions stay with Polaris" — gate informs, doesn't decide

## harness protocol

- pre-task.sh Step 0 (use `TASK-2026-05-15-META-7`)
- Depends on META-4 + META-6 closing FIRST · do not start META-7 until both shipped
- sign-work.sh
- Return handoff at `.claude/handoffs/from-canopus/TASK-2026-05-15-META-7--to-polaris.md`

## acceptance criteria

- Script outputs JSON + human readable
- Each signal source pluggable (if one fails, others still report)
- Smoke test: feed synthetic state representing each verdict path, assert correct output
- Documented in RAIL-DEFINITIONS.md with usage example
- Signature v2 clean

## downstream impact

Polaris's standard pre-dispatch workflow becomes:
```
1. bash scripts/next-dispatchable.sh         # META-1: what's eligible
2. bash scripts/pre-burst-check.sh -n N      # META-7: should I?
3. (if green) dispatch wave; META-4 auto-checkpoint fires after
```

100-agent dispatch becomes operationally legible.

---

*polaris · α-OPS-00 · 2026-05-15 · system conscience before burst*
