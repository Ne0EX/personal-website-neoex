TO · Polaris (α-OPS-00)
FROM · Canopus (α-HRN-07)
TASK · TASK-2026-05-15-META-4
TYPE · TASK RETURN
CREATED · 2026-05-15
SIGNATURE · .claude/signatures/TASK-2026-05-15-META-4--canopus.json

---

## status · COMPLETE

All acceptance criteria met. Smoke test 15/15 PASS. Zero model calls in any
hook script — verifiable by reading source (no curl, no API calls, no
invocations of claude/anthropic tools).

post_edit flag: FLAGGED (pre-existing). Build fails on app/api/chat/route.ts
(Altair TASK-50 placeholder hooks, noted in SAVE-POINT §in-flight diagnostic
noise). Not introduced by this task. All META-4 deliverables are shell scripts,
a .gitkeep, and markdown — no TypeScript changes.

---

## deliverables

| File | Status |
|---|---|
| `.claude/hooks/save-checkpoint.sh` | NEW · main checkpoint script, mode 755 |
| `.claude/hooks/postuse-agent-counter.sh` | NEW · PostToolUse(Agent) N=3 threshold counter, mode 755 |
| `scripts/save-checkpoint.sh` | NEW · manual-invoke wrapper, mode 755 |
| `.claude/settings.json` | UPDATED · Stop + PostToolUse(Agent) hooks wired |
| `docs/team/.checkpoints/.gitkeep` | NEW · directory exists, archive gitignored |
| `.gitignore` | UPDATED · docs/team/.checkpoints/*.md + .claude/.last-checkpoint ignored |
| `docs/harness/RAIL-DEFINITIONS.md` | UPDATED · Checkpoint rail section added |
| `tests/harness/checkpoint.sh` | NEW · smoke test, mode 755, 15/15 PASS |

---

## how the system works

### trigger 1 — Stop hook (always-on)

`.claude/settings.json` Stop array now has two entries: sign-work.sh (unchanged)
and save-checkpoint.sh. On every turn end:

  1. Change detection: compute git status --porcelain sha256, compare to marker.
     Skip if unchanged (no-op for sessions where nothing changed this turn).
  2. Task guard: skip if $CLAUDE_TASK_ID is not set AND $WL_CHECKPOINT_ALWAYS != 1.
     Casual chat sessions are silent no-ops.
  3. If writing: build content from pure shell ops, write archive +
     rolling head + update marker.

### trigger 2 — PostToolUse(Agent) threshold N=3

`postuse-agent-counter.sh` fires after each Agent tool use. Maintains a per-
session, per-turn counter in /tmp/wl-checkpoint-$SESSION_ID/. When counter
reaches 3, fires save-checkpoint.sh with trigger=postuse-threshold and resets
counter. Next wave of agents also gets a checkpoint at N=3.

Turn window: keyed on $CLAUDE_TASK_ID + current UTC minute. Counter resets on
new turn window.

### trigger 3 — Manual

  bash scripts/save-checkpoint.sh "<optional note>"

Peat or Polaris can call any time. WL_CHECKPOINT_ALWAYS=1 is pre-set in the
wrapper so it fires even in casual sessions. Note string appears in checkpoint
header.

### storage

- Archive: docs/team/.checkpoints/YYYY-MM-DD-HH-MM-SS-$PID.md (gitignored)
  PID suffix prevents same-second collision from multiple triggers.
- Rolling head: docs/team/SAVE-POINT.md (tracked in git; Peat reads this)
  Contains latest checkpoint + 1 prior checkpoint header (3.5 KB typical,
  well within 5 KB budget even on this repo's 313-untracked-file working tree).
- Marker: .claude/.last-checkpoint (gitignored; change detection + archaeology)

### checkpoint content (what gets saved — all zero model)

  - git diff --name-status HEAD (tracked dirty files, head -20)
  - untracked count (number only; individual files listed separately)
  - git log -5 --oneline
  - .claude/signatures/*.json (last 10, newest first)
  - .claude/handoffs/from-*/*.md (new since last checkpoint, or last 15 fallback)
  - in-flight TASK IDs from STATUS.md (grep for in-flight|queued|in-progress)
  - /tmp/claude-*/tasks/*.output (last 10)
  - git ls-files --others --exclude-standard (head -10 untracked deliverables)
  - diff vs previous checkpoint (git status snapshot diff)

---

## smoke test results

  bash tests/harness/checkpoint.sh

  Scenario 1: stop trigger (task session)               [PASS x4]
  Scenario 2: stop trigger (no task context — skip)     [PASS x2]
  Scenario 3: manual trigger (no task context)          [PASS x3]
  Scenario 4: postuse-threshold fires at N=3            [PASS x4]
  Scenario 5: idempotency                               [PASS x1]
  Timing: wall time 309ms < 1s budget                  [PASS x1]

  Total: 15/15 PASS

---

## resume protocol (operational going forward)

When Polaris or Peat needs to resume after a rate-limit:

  1. Read docs/team/SAVE-POINT.md — latest auto-checkpoint
  2. Read docs/team/STATUS.md — TASK status (trust signatures over STATUS body)
  3. Consult docs/team/.checkpoints/ for archaeology
  4. Check .claude/signatures/ for recent signed work

Polaris no longer needs to manually write SAVE-POINT files. The Stop hook
writes one automatically on every turn end (if something changed). Wave
dispatches of ≥3 agents get a pre-burst checkpoint automatically.

---

## notes for Polaris

The build gate (post_edit=false) is a carry-over from Altair TASK-50. The same
flag appeared on Vega TASK-25 for the same reason. My deliverables are all
shell scripts — no TypeScript, no build surface. Suggest Algol verify my
files_touched subset (the hook scripts, settings.json, gitignore,
RAIL-DEFINITIONS.md, .gitkeep, tests) rather than flagging on the build gate.

The signature self_hash is valid. harness_passed=true.

---

canopus · α-HRN-07 · 2026-05-15 · META-4 complete
checkpoint rail is live — next rate-limit cascade has a safety net
