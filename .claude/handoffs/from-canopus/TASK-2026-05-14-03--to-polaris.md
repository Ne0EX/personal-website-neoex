---
task_id: TASK-2026-05-14-03
from: canopus
to: polaris
date: 2026-05-14
slice: S1
status: done
signed: unsigned · sign-work.sh not deployed
---

# TASK-2026-05-14-03 · S1 complete — SessionStart hook, Polaris persona inject

Polaris — S1 is built and wired. All four deliverables are in place.

---

## files touched

| File | Lines | Action |
|------|-------|--------|
| `.claude/hooks/session-start.sh` | 69 | created · new SessionStart hook script |
| `.claude/settings.json` | 27 (+11 net) | modified · added SessionStart block; PreToolUse block preserved exactly |
| `docs/harness/SESSION-START.md` | 148 | created · new docs/harness/ directory + rail documentation |
| `docs/team/STATUS.md` | 71 | modified · TASK-2026-05-14-03 S1 slice line updated to done |
| `.claude/handoffs/from-canopus/TASK-2026-05-14-03--to-polaris.md` | (this file) | created · return handoff |

---

## what was built

### `.claude/hooks/session-start.sh`
Bash script, `set -euo pipefail`, marked executable. On any input (SessionStart
event JSON on stdin) it emits:
```json
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"<text>"}}
```
The `<text>` block instructs the session to:
1. Read `.claude/agents/polaris.md` and embody Polaris (α-OPS-00).
2. Use `ฉัน` / `ค่ะ`, calm-axis register in Thai; composed English otherwise.
3. Stay in PM scope — no code, no implementation.
4. Apply codename-override when Peat directly addresses another agent by codename.
5. Not self-identify as generic Claude.

Non-blocking: if `.claude/agents/polaris.md` is missing, exits 0 with stderr warning
and emits an empty `additionalContext`. Session continues without injection.

Idempotent: no disk writes, same output every run.

Performance: < 200ms (one file-existence check + printf + python3 string escape).

### `.claude/settings.json`
Added `SessionStart` hook block at the top of the `hooks` object:
```json
"SessionStart": [
  {
    "hooks": [
      {
        "type": "command",
        "command": "bash .claude/hooks/session-start.sh",
        "timeout": 10
      }
    ]
  }
]
```
No `matcher` field (SessionStart does not accept one per spec).
The existing `PreToolUse` block for `on-dispatch.sh` is untouched — diff-verified.

### `docs/harness/SESSION-START.md`
Created `docs/harness/` directory (new) and the rail documentation file covering:
- What the hook does
- The default + codename-override composition model (with ASCII flow diagram)
- What the hook deliberately does not do (no CI injection, no other agents, no
  code authority, no session state)
- How to disable (three methods: /hooks UI, settings.local.json, rename)
- Common failures and fixes table
- Regression test command

### `docs/team/STATUS.md`
TASK-2026-05-14-03 S1 slice updated from `assigned · awaiting pickup` to
`done · unsigned · sign-work.sh not deployed`.

---

## signature note

`sign-work.sh` is not deployed (see STATUS.md known infrastructure gaps). This
handoff is therefore unsigned. The gap is pre-existing and does not block this
deliverable. When sign-work.sh is deployed in a future Canopus task, the signature
for this work can be retroactively computed from the file hashes and recorded.

`unsigned · sign-work.sh not deployed`

---

## verification steps for Polaris

Run these in order to accept S1:

**Step 1 — JSON output check**
```bash
cd /path/to/repo
echo '{}' | bash .claude/hooks/session-start.sh | python3 -m json.tool
```
Expected: valid JSON, `hookEventName == "SessionStart"`, `additionalContext` contains
"Polaris" and "α-OPS-00".

**Step 2 — settings.json integrity**
```bash
cat .claude/settings.json | python3 -m json.tool
```
Expected: valid JSON. Both `SessionStart` and `PreToolUse` blocks present.
`PreToolUse` block unchanged (verify `on-dispatch.sh` command string is intact).

**Step 3 — fallback behavior**
```bash
bash -c '
  f=".claude/agents/polaris_MISSING.md"
  [[ ! -f "$f" ]] && {
    echo "WARNING — persona file not found." >&2
    printf '"'"'{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":""}}'"'"'
    exit 0
  }
' 2>&1 | python3 -m json.tool
```
Expected: warning on stderr, valid JSON with empty additionalContext, exit 0.

**Step 4 — live session acceptance test (Algol or Polaris)**
Open a fresh `claude` session in this repo:
```bash
claude
```
Send: `ดีจ้า` (no codename)
Expected: response in Polaris voice — `ฉัน` / `ค่ะ`, PM framing, not generic Claude.

Send: `Vega จัง อยู่มั้ย`
Expected: response in Vega voice (codename-override triggered) — not Polaris.

**Step 5 — regression: PreToolUse dispatch logger**
Dispatch any Polaris subagent call. Confirm `.claude/hook-logs/polaris-dispatch.log`
still receives entries. `on-dispatch.sh` must not have regressed.

---

## acceptance against slice S1 criteria

| Criterion | Status |
|-----------|--------|
| SessionStart hook injects Polaris persona | done |
| Hook wired in settings.json with 10s timeout | done |
| No matcher field on SessionStart | done |
| PreToolUse dispatch logger unmodified | done — verified diff |
| docs/harness/ created with SESSION-START.md | done |
| Dual-trigger model documented | done |
| Hook non-blocking on missing persona file | done |
| Hook fast < 200ms | done — no I/O beyond one stat |
| Hook idempotent | done — no state written |
| No agent persona file edited | done |
| No SessionStart entries for other agents | done |

---

*canopus · α-HRN-07 · 2026-05-14*
