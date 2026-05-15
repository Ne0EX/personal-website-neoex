# TO · Canopus (α-HRN-07)
# FROM · Polaris (α-OPS-00)
# TASK · TASK-2026-05-15-META-9
# TYPE · TASK CONTRACT
# CREATED · 2026-05-15
# MODEL TIER · sonnet
# TRIGGER · Peat directive 2026-05-15 — without telemetry we are guessing about bottlenecks; with telemetry we measure

---

## scope

Build a **telemetry rail** that captures per-TASK lifecycle timings + cost signals so Polaris can analyze real bottleneck data rather than relying on intuition. Feeds back into META-1 (next-dispatchable) + META-7 (pre-burst gate) as additional signal sources.

## vision fidelity

not applicable · observability infrastructure, no brand surface touched

## canonical inputs

- `.claude/signatures/*.json` (timestamps + agent + summary already there in v2 schema)
- `.claude/handoffs/from-*/` (mtime → handoff write time)
- `docs/qa/REPORTS/*.md` (Algol audit timestamps)
- `.claude/audit/dispatch.ndjson` (from META-7 if exists; else create)
- Subagent task-notification transcripts at `/tmp/claude-*/tasks/*.output` (duration_ms + token usage exposed)

## deliverables

1. `.claude/hooks/telemetry-capture.sh` — runs on multiple events:
   - PostToolUse(Agent) — log dispatch_ts + agent + task_id
   - When `.claude/signatures/<task>--<agent>.json` lands — log sign_ts + duration + outcome
   - When `docs/qa/REPORTS/<task>-*.md` lands — log audit_ts + verdict
2. `.claude/audit/telemetry.ndjson` (gitignored) — append-only structured log
3. `scripts/telemetry-report.sh` — summarize for Polaris/Peat:
   - Per-agent: average TASK duration, p50/p95
   - Per-tier: opus vs sonnet ratio + duration delta
   - Bottleneck identification: slowest stage (dispatch → sign → audit)
   - Algol audit lag (signature → audit verdict)
   - Stall pattern detection (TASK > 600s with no signature = likely watchdog death)
4. `docs/harness/RAIL-DEFINITIONS.md` update — "Telemetry rail" section

## constraints

- Append-only ndjson (no rewrites; race-safe across parallel agents)
- Privacy: do NOT log file contents or message bodies, only structural metadata
- Bounded size: rotate at 10MB → `.claude/audit/telemetry-archive-YYYY-MM-DD.ndjson`
- Reports are sampling — never make a decision off a single TASK observation; report needs n≥5 for any claim
- Fail-safe: if telemetry hook errors, signal succeeds anyway (telemetry is observability, not enforcement)

## harness protocol

- pre-task.sh Step 0 (use `TASK-2026-05-15-META-9`)
- sign-work.sh
- Return handoff at `.claude/handoffs/from-canopus/TASK-2026-05-15-META-9--to-polaris.md`

## acceptance criteria

- ndjson grows on every Agent dispatch + signature land + audit land
- `bash scripts/telemetry-report.sh` produces useful summary on accumulated data
- Smoke test using synthetic dispatch transcripts
- META-7 pre-burst-check.sh can consume this data (cross-rail integration documented)
- Signature v2 clean

## downstream impact

Within 1-2 sessions of telemetry data:
- Identify whether Sirius single-thread on WorldlineGlobe.tsx is the real bottleneck or just folklore
- Quantify Algol stall frequency (3 stalls = baseline; track if pattern continues or improves with smaller-scope dispatches per D.3.3)
- Measure opus override cost-per-outcome
- Detect 600s watchdog stalls as soon as they happen (TASK dispatched + no signature in 700s = suspected stall)

Telemetry gives Polaris evidence-based dispatch decisions instead of caution-based.

---

*polaris · α-OPS-00 · 2026-05-15 · stop guessing, start measuring*
