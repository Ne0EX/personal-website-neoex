# TO · Canopus (α-HRN-07, Architect of the Rails)
# FROM · Polaris (α-OPS-00)
# TASK · TASK-2026-05-15-META-4
# TYPE · TASK CONTRACT
# CREATED · 2026-05-15
# MODEL TIER · sonnet
# TRIGGER · Peat directive 2026-05-15 — "ทำ HOOK / SCRIPT เพื่อ QUICK SAVE CHECKPOINT จะได้ไม่เปลือง token และ save ได้ทันก่อนที่ rate limit จะ trigger คราวหน้า"

---

## scope

Build a **deterministic, zero-token checkpoint mechanism** that captures session-level state before rate-limit-class failures take down the agent loop. Replaces the manual SAVE-POINT pattern Polaris had to do today.

The checkpoint runs in a bash subprocess outside the model loop — **survives even when Anthropic API quota is exhausted**. This is the core architectural value.

## design

### Triggers (3, composable)

1. **Stop hook** (default · always on)
   - Fires every Claude turn end
   - Guard: only writes if changes since last checkpoint (cheap hash compare or git status diff)
   - Guard: only on task-context sessions (`$CLAUDE_TASK_ID` set OR `$WL_CHECKPOINT_ALWAYS=1` env)

2. **PostToolUse(Agent) threshold** (wave-boundary save)
   - Fires after each `Agent` tool use
   - Maintains per-turn counter (use `$CLAUDE_SESSION_ID` + turn marker in temp file)
   - When counter ≥ **N=3** in current turn → save checkpoint immediately
   - Reason: protects against rate-limit-during-dispatch scenarios; ensures checkpoint exists BEFORE wave 4-5 agents start consuming quota

3. **Manual invocation**
   - `bash scripts/save-checkpoint.sh "<optional-note>"`
   - Peat or Polaris can fire any time
   - Note string gets appended to checkpoint header

### Storage (both · per Polaris decision)

- **Timestamped archive**: `docs/team/.checkpoints/2026-05-15-19-30-00.md` (immutable history)
- **Rolling head pointer**: `docs/team/SAVE-POINT.md` (latest only, overwrite each run; Peat reads this single file for resume)

### Save content (deterministic aggregation; NO model)

```
## checkpoint <timestamp>
trigger: <stop | postuse-threshold | manual>
note: <optional manual note>

### git state
$ git status --porcelain | head -40
$ git log -5 --oneline

### signatures (last 10)
$ ls -t .claude/signatures/*.json | head -10

### handoffs (last 15)
$ find .claude/handoffs -name "*.md" -newer .claude/.last-checkpoint -type f | head -15
fallback: $ ls -t .claude/handoffs/from-*/*.md | head -15

### in-flight signal
$ grep -l "in-flight\|queued" docs/team/STATUS.md | summarize TASK ids
$ ls -t /tmp/claude-*/tasks/*.output 2>/dev/null | head -10

### dirty tree deliverables
$ git ls-files --others --exclude-standard

### resume hints
- last 3 SAVE-POINT.md sections (if exists)
- this checkpoint's diff vs previous (file-level)
```

### Performance budget

- Total wall time: **< 1 second** on Peat's machine
- Output size: **< 5 KB** per checkpoint (keep tail-friendly)
- No external calls (no curl, no API)
- POSIX-compatible (BSD + GNU awk per existing precedent in `scripts/audit-territory.sh`)

## canonical inputs (READ FIRST)

- `.claude/hooks/sign-work.sh` — pattern reference for hook script that aggregates disk state
- `.claude/hooks/session-start.sh` — pattern for additionalContext emission + guards
- `.claude/settings.json` — current hook wiring (Stop, PostToolUse(Agent))
- `docs/team/SAVE-POINT-2026-05-15.md` — example of what a manually-authored save-point looks like; the script should produce something similar in structure but auto-generated
- `docs/team/STATUS.md` — example of in-flight TASK section format (per-line `## TASK-…` headers; meta-3 may have section-locked this)
- `docs/harness/RAIL-DEFINITIONS.md` — where to document this rail

## deliverables

1. `.claude/hooks/save-checkpoint.sh` — bash script, mode 755
2. `scripts/save-checkpoint.sh` — thin manual-invoke wrapper that re-exports env + calls hook script with `trigger=manual` (or symlink, your call)
3. `.claude/settings.json` — wire new hook to:
   - `Stop` event (alongside existing sign-work.sh)
   - `PostToolUse` event with matcher for `Agent` tool
4. `docs/team/.checkpoints/.gitkeep` (or `.gitignore` rule for `.checkpoints/*` — your call; recommend gitignore the archive, only commit SAVE-POINT.md rolling head)
5. `docs/harness/RAIL-DEFINITIONS.md` — new section "Checkpoint rail" documenting the 3 triggers, storage scheme, and resume protocol
6. Smoke test under `.harness/__smoke__/checkpoint/` or similar (your existing pattern) — simulate each trigger, assert SAVE-POINT.md gets written, assert no errors when run on fresh tree

## constraints

- **ZERO model calls** — this is the entire architectural point. If you find yourself wanting to "ask Polaris to summarize", stop. The script must produce useful checkpoints from pure shell + git + filesystem ops.
- POSIX awk/grep/sed (no GNU-only flags)
- Idempotent — running twice in succession produces same output (modulo timestamp)
- Fail-safe — if any sub-command errors, write a checkpoint anyway with partial data + an `### errors` section
- Do NOT write to STATUS.md — that's Polaris-territory + race condition surface
- Do NOT auto-commit — checkpoints are working-tree artifacts; let Peat/Polaris decide when to commit
- Respect `feedback_algol_qa_cross_check` standing rule — checkpoint hook does NOT replace Algol audit, just preserves state

## harness protocol

- Step 0 · run `pre-task.sh "TASK-2026-05-15-META-4"` before first edit
- After implementing, run smoke test: dispatch a small subagent (or simulate) and verify checkpoint fires
- Sign with `sign-work.sh`; expect post-D3 clean attribution
- Return handoff at `.claude/handoffs/from-canopus/TASK-2026-05-15-META-4--to-polaris.md`

## acceptance criteria

- All 3 triggers work (Stop / PostToolUse(Agent)-threshold / manual)
- Wall time < 1 second per save
- SAVE-POINT.md rolling head + timestamped archive both written
- `docs/harness/RAIL-DEFINITIONS.md` updated
- Smoke test passes
- ZERO model calls in the entire hook script — verifiable by reading the source
- Signature v2 clean, both gates green

## downstream impact

- Polaris no longer needs to perform manual SAVE-POINT writes — automatic checkpoint runs on every Stop
- Wave-boundary dispatches (≥3 agents) get a forced checkpoint BEFORE the burst — last-known-good state survives any rate-limit cascade
- Resume protocol becomes deterministic: read `docs/team/SAVE-POINT.md` (rolling head) for latest state; consult `docs/team/.checkpoints/` for archaeology
- META-1 (next-dispatchable.sh) can read the checkpoint as an additional input for graph resolution

---

*polaris · α-OPS-00 · 2026-05-15 · META-4 closes the operational gap Peat identified during the rate-limit cascade today*
