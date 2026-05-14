# .claude/hooks — the rail system

> Six bash hooks enforce the team's quality contract. They are the difference between an agent team that ships clean work and one that produces incoherent code. Read this whole file before disabling any of them.
>
> Signature payloads conform to v2 at `.claude/signatures/SCHEMA.md`. Canopus owns this file and the schema.

---

## Installation

### Claude Code

In your Claude Code config (`~/.claude/settings.json` or per-project `.claude/settings.json`), wire the hooks to the appropriate events:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [{ "type": "command", "command": "bash .claude/hooks/pre-task.sh \"$CLAUDE_TASK_ID\"" }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [{ "type": "command", "command": "bash .claude/hooks/post-edit.sh" }]
      }
    ],
    "Stop": [
      { "hooks": [{ "type": "command", "command": "bash .claude/hooks/sign-work.sh \"$CLAUDE_TASK_ID\"" }] }
    ]
  }
}
```

### Codex

Codex's hook configuration is more limited. Wire what you can in `~/.codex/config.toml` under `[hooks]`; what cannot be auto-fired must be invoked manually by the agent at the named pause points. Codex agents who skip hooks will fail at Algol's signature audit.

### Manual

Any agent on any CLI can invoke a hook at any time:

```bash
bash .claude/hooks/<hook>.sh [args]
```

The hooks are designed to be safe to over-call.

---

## Hook contract

Every hook:

- Reads `.claude/AGENTS.md`, `.harness/worldline-harness.config.json`, and `docs/team/FILE-OWNERSHIP.md` as needed
- Logs to `.claude/hook-logs/<task_id>--<hook-name>.log` (create dir if missing)
- Exits `0` on pass, non-zero on fail
- Prints failure reasons to stderr in human language

---

## on-dispatch.sh — dispatch audit log

**Fires:** when a `Task` tool call dispatches a subagent (root session only).
**Blocks:** no — exits 0 always; non-blocking by design.

**Platform note:** Polaris cannot dispatch subagents from within her own subagent session — confirmed platform limitation (Claude Code current version). Actual dispatch happens in Peat's root session. This hook therefore fires at the root session level, wired as a PreToolUse hook on the `Task` tool in `.claude/settings.json`. It is NOT called by Polaris from within a subagent; that design is no longer accurate.

The hook writes a single log line to `.claude/hook-logs/polaris-dispatch.log`:

```
[dispatch] ts=<ISO8601> caller=polaris task=<task_id> target=<agent> slice=<slice_id>
```

If `WL_AGENT` is set to anything other than `polaris`, the entry is flagged with `ANOMALY=non-polaris-dispatch` and a warning is printed to stderr. The entry remains — this is an audit hook, not a blocking hook. Algol reads the dispatch log during acceptance audit.

**Usage (root session, before Task call):**
```bash
WL_AGENT=polaris bash .claude/hooks/on-dispatch.sh TASK-2026-05-14-02 sirius S2
```

**Log location:** `.claude/hook-logs/polaris-dispatch.log`

**Owner:** Canopus

---

## agent-name-trigger.sh — UserPromptSubmit context injection

**Fires:** when Peat submits a prompt to Claude (UserPromptSubmit event).
**Blocks:** no — outputs additional context or remains silent.

Detects a GENESIS agent codename in vocative position within the prompt (e.g., "Polaris, how are you?" or "Sirius — show me a layout") and injects the matched `.claude/agents/<codename>.md` as additional context. The hook loads the addressed agent's persona and any `§voice` section, enabling on-demand agent personality in conversation.

**Behavior:**
- Matches codenames only when adjacent to addressing markers: whitespace, comma, em-dash, period, or end-of-string
- Prose mentions like "Polaris's territory" do NOT trigger (apostrophe is not an addressing marker)
- Silent (no output, exit 0) when no codename is detected
- Translates pre-cutover names (Mira → Polaris, Pico → Sirius, Lyra → Procyon, Iris → Betelgeuse, Sage → Arcturus, Cipher → Algol, Rigel → Canopus, Quill → Vega) and emits a note when a translation occurs
- Outputs a warning and exits silently (exit 0) if the persona file is missing (allows conversation to proceed without failure)
- When a codename is detected and file is present, wraps the persona in XML markers:
  ```
  <<<agent-voice-protocol · Peat addressed '<CODENAME>' — loading persona>>>
  [... contents of .claude/agents/<codename>.md ...]
  <<<end agent-voice-protocol>>>
  ```

**Tests:** `tests/hooks/agent-name-trigger.test.sh` (7 cases — vocative Thai, vocative English, prefix, Sirius, pre-cutover translation, silence on no-match, silence on prose). Run with:

```bash
bash tests/hooks/agent-name-trigger.test.sh
```

**Owner:** Canopus

**Known limitations:**
- Regex may false-positive on codenames followed by `=` (e.g. `Polaris=value` in pasted code). Tracked at `docs/tech-specs/2026-05-14-agent-voice-tuning-design.md` §11.4.

---

## Shared lookup — designation table

`sign-work.sh` and `pre-handoff.sh` both need to resolve codename → designation and codename → pre-cutover name. The lookup is duplicated as a small inline function in each script (no shared helper file — keeps hooks single-file portable). When the roster changes, update both scripts and bump `signature_schema_version` if the change is structural.

```bash
# inline in sign-work.sh and pre-handoff.sh:
designation_for() {
  case "$1" in
    polaris)    echo "α-OPS-00" ;;
    sirius)     echo "α-SUR-01" ;;
    altair)     echo "α-BND-02" ;;
    procyon)    echo "α-IDX-03" ;;
    betelgeuse) echo "α-VIS-04" ;;
    arcturus)   echo "α-NET-05" ;;
    algol)      echo "α-VER-06" ;;
    canopus)    echo "α-HRN-07" ;;
    vega)       echo "α-VOX-08" ;;
    *)          echo "" ;;
  esac
}
precutover_for() {
  case "$1" in
    polaris)    echo "Mira" ;;
    sirius)     echo "Pico" ;;
    altair)     echo "Vega" ;;
    procyon)    echo "Lyra" ;;
    betelgeuse) echo "Iris" ;;
    arcturus)   echo "Sage" ;;
    algol)      echo "Cipher" ;;
    canopus)    echo "Rigel" ;;
    vega)       echo "Quill" ;;
    *)          echo "" ;;
  esac
}
titlecase() {
  awk '{print toupper(substr($0,1,1)) substr($0,2)}' <<<"$1"
}
```

---

## 1. pre-task.sh

**Fires:** when an agent begins a task.
**Blocks:** yes — refuses to allow work to start without context acknowledgement.

```bash
#!/usr/bin/env bash
# .claude/hooks/pre-task.sh
# Usage: bash .claude/hooks/pre-task.sh <task_id> [agent_codename]
set -euo pipefail

TASK_ID="${1:-}"
AGENT="${2:-${WL_AGENT:-unknown}}"
LOG_DIR=".claude/hook-logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/${TASK_ID}--pre-task.log"

if [[ -z "$TASK_ID" ]]; then
  echo "pre-task: missing TASK_ID. usage: pre-task.sh <task_id> [agent]" >&2
  exit 2
fi

ASSIGNMENT=".claude/handoffs/from-polaris/${TASK_ID}.md"
if [[ ! -f "$ASSIGNMENT" ]]; then
  echo "pre-task: no assignment found at $ASSIGNMENT" >&2
  echo "         Polaris issues every task. If this is a self-initiated edit," >&2
  echo "         stop and request an assignment via a handoff to Polaris." >&2
  exit 3
fi

REQUIRED_READS=(
  ".claude/AGENTS.md"
  ".claude/agents/${AGENT}.md"
  "docs/team/QUALITY-BAR.md"
  "docs/team/FILE-OWNERSHIP.md"
  "$ASSIGNMENT"
)

echo "[pre-task] task=$TASK_ID agent=$AGENT" | tee "$LOG"
echo "[pre-task] required reads:" | tee -a "$LOG"
for f in "${REQUIRED_READS[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "  MISSING: $f" | tee -a "$LOG" >&2
    exit 4
  fi
  echo "  ok: $f" | tee -a "$LOG"
done

# Extract this agent's territory from FILE-OWNERSHIP.md and report it
echo "[pre-task] your territory for this task:" | tee -a "$LOG"
awk -v agent="$AGENT" '
  $0 ~ "^## " agent " ·" { in_block=1; next }
  in_block && /^## / { in_block=0 }
  in_block && /^- / { print "  " $0 }
' docs/team/FILE-OWNERSHIP.md | tee -a "$LOG"

echo "[pre-task] PASS — proceed with the assigned slice. Reach for files outside your territory only via handoff."
exit 0
```

---

## 2. harness-check.sh

**Fires:** manually, at logical pause points. Also called by `pre-handoff.sh`.
**Blocks:** no, reports only — but a failed harness flag in your signature will block your handoff.

```bash
#!/usr/bin/env bash
# .claude/hooks/harness-check.sh
# Usage: bash .claude/hooks/harness-check.sh
set -euo pipefail

CONFIG=".harness/worldline-harness.config.json"
LOG_DIR=".claude/hook-logs"
mkdir -p "$LOG_DIR"
TASK_ID="${WL_TASK_ID:-adhoc-$(date +%s)}"
LOG="$LOG_DIR/${TASK_ID}--harness.log"

if [[ ! -f "$CONFIG" ]]; then
  echo "harness: no config at $CONFIG — Canopus must define rails before this hook is useful" >&2
  exit 0  # report only
fi

echo "[harness] task=$TASK_ID" | tee "$LOG"

PASS=true

# Iterate every rail's check script and run it.
# Each check script returns 0 (pass) / 1 (fail) and prints a one-line summary to stdout.
while IFS=$'\t' read -r rail check; do
  if [[ -x "$check" ]]; then
    if output=$("$check" 2>&1); then
      echo "  [pass] $rail :: $output" | tee -a "$LOG"
    else
      echo "  [FAIL] $rail :: $output" | tee -a "$LOG" >&2
      PASS=false
    fi
  else
    echo "  [skip] $rail :: check script not executable: $check" | tee -a "$LOG"
  fi
done < <(jq -r '.rails | to_entries[] | "\(.key)\t\(.value.check)"' "$CONFIG")

if $PASS; then
  echo "[harness] PASS — all rails clean"
  exit 0
else
  echo "[harness] FAIL — fix the failing rails before signing your work" >&2
  exit 1
fi
```

---

## 3. post-edit.sh

**Fires:** after any file write (Write / Edit / MultiEdit tool call, or manual save).
**Blocks:** yes — broken code does not leave the editor.

```bash
#!/usr/bin/env bash
# .claude/hooks/post-edit.sh
# Usage: bash .claude/hooks/post-edit.sh
set -euo pipefail

LOG_DIR=".claude/hook-logs"
mkdir -p "$LOG_DIR"
TASK_ID="${WL_TASK_ID:-adhoc-$(date +%s)}"
LOG="$LOG_DIR/${TASK_ID}--post-edit.log"

echo "[post-edit] task=$TASK_ID" | tee "$LOG"

FAIL=false

run_step() {
  local name="$1"; shift
  echo "[post-edit] running: $name" | tee -a "$LOG"
  if "$@" >>"$LOG" 2>&1; then
    echo "  pass: $name" | tee -a "$LOG"
  else
    echo "  FAIL: $name (see $LOG)" | tee -a "$LOG" >&2
    FAIL=true
  fi
}

run_step "lint"      npm run --silent lint
run_step "typecheck" npx --silent tsc --noEmit
run_step "build"     npm run --silent build

if $FAIL; then
  echo "[post-edit] FAIL — self-fix before signing. Do NOT submit broken work." >&2
  exit 1
fi

# UI-touch detection — if any file under app/ or components/ changed,
# require visual-diff.
if git diff --name-only --diff-filter=AM 2>/dev/null | grep -qE '^(app|components)/'; then
  echo "[post-edit] UI files changed — visual-diff is required before handoff."
  echo "[post-edit] Run: bash .claude/hooks/visual-diff.sh \"$TASK_ID\""
fi

echo "[post-edit] PASS"
exit 0
```

---

## 4. visual-diff.sh

**Fires:** after any UI change.
**Blocks:** yes — Betelgeuse must review before merge.

```bash
#!/usr/bin/env bash
# .claude/hooks/visual-diff.sh
# Usage: bash .claude/hooks/visual-diff.sh <task_id>
set -euo pipefail

TASK_ID="${1:-${WL_TASK_ID:-}}"
if [[ -z "$TASK_ID" ]]; then
  echo "visual-diff: missing task_id" >&2
  exit 2
fi

OUT_DIR=".claude/visual-diffs/$TASK_ID"
mkdir -p "$OUT_DIR/before" "$OUT_DIR/after"

echo "[visual-diff] capturing screenshots for task=$TASK_ID"

# Detect changed routes from the diff
ROUTES=$(git diff --name-only --diff-filter=AM 2>/dev/null \
  | grep -E '^(app|components)/' \
  | xargs -r -n1 dirname \
  | sort -u \
  | sed -E 's|^app||; s|/page\.tsx$||; s|^$|/|' \
  | sort -u)

if [[ -z "$ROUTES" ]]; then
  echo "[visual-diff] no route changes detected — manual review required"
  echo "[visual-diff] add screenshots manually to $OUT_DIR/{before,after}/"
  exit 0
fi

echo "[visual-diff] routes to capture:"
echo "$ROUTES" | sed 's/^/  /'

if [[ -x scripts/visual-capture.sh ]]; then
  bash scripts/visual-capture.sh "$TASK_ID" "$ROUTES"
else
  echo "[visual-diff] scripts/visual-capture.sh missing — Canopus must implement it" >&2
  echo "[visual-diff] for now, manually screenshot routes above to $OUT_DIR/{before,after}/"
fi

# Mark task as awaiting Betelgeuse
echo "awaiting-betelgeuse" > "$OUT_DIR/STATUS"
echo "[visual-diff] task marked awaiting-betelgeuse at $OUT_DIR/STATUS"
echo "[visual-diff] Betelgeuse reviews before handoff finalization."
exit 0
```

**Note for Canopus:** `scripts/visual-capture.sh` is your responsibility. It uses Playwright. The capture flow is: `git stash` → `npm run build && npm start &` → playwright shots → kill server → `git stash pop` → re-build → re-start → re-shoot. Document the script's contract in `docs/harness/RAIL-DEFINITIONS.md`.

---

## 5. sign-work.sh — writes v2 signature

**Fires:** before any handoff.
**Blocks:** yes — invalid signature = no handoff.

Conforms to `.claude/signatures/SCHEMA.md` v2.

```bash
#!/usr/bin/env bash
# .claude/hooks/sign-work.sh
# Usage: bash .claude/hooks/sign-work.sh <task_id>
# Writes a v2 signature; see .claude/signatures/SCHEMA.md
set -euo pipefail

TASK_ID="${1:-}"
AGENT="${WL_AGENT:-unknown}"
NEXT_AGENT_LC="${WL_NEXT:-polaris}"
if [[ -z "$TASK_ID" ]]; then
  echo "sign-work: missing task_id" >&2
  exit 2
fi

# --- roster lookup ---
designation_for() {
  case "$1" in
    polaris)    echo "α-OPS-00" ;;
    sirius)     echo "α-SUR-01" ;;
    altair)     echo "α-BND-02" ;;
    procyon)    echo "α-IDX-03" ;;
    betelgeuse) echo "α-VIS-04" ;;
    arcturus)   echo "α-NET-05" ;;
    algol)      echo "α-VER-06" ;;
    canopus)    echo "α-HRN-07" ;;
    vega)       echo "α-VOX-08" ;;
    *)          echo "" ;;
  esac
}
precutover_for() {
  case "$1" in
    polaris)    echo "Mira" ;;
    sirius)     echo "Pico" ;;
    altair)     echo "Vega" ;;
    procyon)    echo "Lyra" ;;
    betelgeuse) echo "Iris" ;;
    arcturus)   echo "Sage" ;;
    algol)      echo "Cipher" ;;
    canopus)    echo "Rigel" ;;
    vega)       echo "Quill" ;;
    *)          echo "" ;;
  esac
}
titlecase() { awk '{print toupper(substr($0,1,1)) substr($0,2)}' <<<"$1"; }

AGENT_DESIGNATION=$(designation_for "$AGENT")
if [[ -z "$AGENT_DESIGNATION" ]]; then
  echo "sign-work: unknown agent codename '$AGENT'. Update sign-work.sh roster lookup." >&2
  exit 2
fi
AGENT_TC=$(titlecase "$AGENT")
PRE=$(precutover_for "$AGENT")
NEXT_DESIGNATION=$(designation_for "$NEXT_AGENT_LC")
if [[ -z "$NEXT_DESIGNATION" ]]; then
  echo "sign-work: unknown next-recipient '$NEXT_AGENT_LC'. Set WL_NEXT to a current roster codename." >&2
  exit 2
fi
NEXT_TC=$(titlecase "$NEXT_AGENT_LC")

SIG_DIR=".claude/signatures"
mkdir -p "$SIG_DIR"
SIG_FILE="$SIG_DIR/${TASK_ID}--${AGENT}.json"
STEPS_LOG=".claude/hook-logs/${TASK_ID}--steps.log"

# 1. Gather files touched
FILES_TOUCHED=$(git diff --name-only --diff-filter=AMD HEAD 2>/dev/null | jq -R . | jq -s .)
if [[ "$FILES_TOUCHED" == "[]" ]]; then
  echo "sign-work: no changed files since HEAD — nothing to sign" >&2
  exit 3
fi

# 2. Per-file sha256 map (object form for .hashes.files_sha256)
FILES_SHA256=$(git diff --name-only --diff-filter=AM HEAD 2>/dev/null \
  | sort \
  | while read -r f; do
      [[ -f "$f" ]] || continue
      h=$(sha256sum "$f" | awk '{print $1}')
      jq -n --arg p "$f" --arg h "$h" '{($p): $h}'
    done \
  | jq -s 'add // {}')

# 3. Harness status from log
HARNESS_PASSED=true
if [[ -f ".claude/hook-logs/${TASK_ID}--harness.log" ]] \
   && grep -q "\\[FAIL\\]" ".claude/hook-logs/${TASK_ID}--harness.log"; then
  HARNESS_PASSED=false
fi

# 4. Post-edit status from log
POST_EDIT_OK=true
if [[ -f ".claude/hook-logs/${TASK_ID}--post-edit.log" ]]; then
  grep -q "FAIL:" ".claude/hook-logs/${TASK_ID}--post-edit.log" && POST_EDIT_OK=false
else
  POST_EDIT_OK=false
fi

# 5. Steps log
STEPS="[]"
[[ -f "$STEPS_LOG" ]] && STEPS=$(jq -R . < "$STEPS_LOG" | jq -s .)

# 6. Free-form fields from env
SUMMARY="${WL_SUMMARY:-no summary provided}"
STARTED_AT="${WL_STARTED_AT:-$(date -u +%FT%TZ)}"
COMPLETED_AT="$(date -u +%FT%TZ)"

# 7. Build payload (no self_hash yet). pre_cutover_codename is string-or-null.
if [[ -n "$PRE" ]]; then
  PRE_ARG=$(jq -n --arg s "$PRE" '$s')
else
  PRE_ARG="null"
fi

PAYLOAD=$(jq -n \
  --arg task_id "$TASK_ID" \
  --arg agent "$AGENT_TC" \
  --arg designation "$AGENT_DESIGNATION" \
  --argjson precutover "$PRE_ARG" \
  --arg started "$STARTED_AT" \
  --arg completed "$COMPLETED_AT" \
  --argjson files "$FILES_TOUCHED" \
  --arg summary "$SUMMARY" \
  --argjson steps "$STEPS" \
  --argjson files_sha "$FILES_SHA256" \
  --argjson harness "$HARNESS_PASSED" \
  --argjson post_edit "$POST_EDIT_OK" \
  --arg next_agent "$NEXT_TC" \
  --arg next_designation "$NEXT_DESIGNATION" \
  '{
    signature_schema_version: 2,
    task_id: $task_id,
    agent: $agent,
    agent_designation: $designation,
    pre_cutover_codename: $precutover,
    started_at: $started,
    completed_at: $completed,
    files_touched: $files,
    summary: $summary,
    steps: $steps,
    hashes: { files_sha256: $files_sha },
    harness_passed: $harness,
    post_edit_passed: $post_edit,
    next_recipient: { agent: $next_agent, designation: $next_designation }
  }')

# 8. Canonical-JSON self_hash (sorted keys, compact, excluding hashes.self_hash)
SELF_HASH=$(echo "$PAYLOAD" | jq -cS 'del(.hashes.self_hash)' | sha256sum | awk '{print $1}')

# 9. Embed self_hash and write
echo "$PAYLOAD" | jq --arg sh "$SELF_HASH" '.hashes.self_hash = $sh' > "$SIG_FILE"

# 10. Flag if gates didn't pass
if ! $HARNESS_PASSED || ! $POST_EDIT_OK; then
  echo "sign-work: signature written but FLAGGED — harness=$HARNESS_PASSED post_edit=$POST_EDIT_OK" >&2
  echo "sign-work: handoff will be blocked by pre-handoff.sh. Fix and re-sign." >&2
  exit 4
fi

echo "[sign-work] PASS — signed at $SIG_FILE (v2)"
echo "[sign-work] agent=$AGENT_TC ($AGENT_DESIGNATION) → next=$NEXT_TC ($NEXT_DESIGNATION)"
echo "[sign-work] self_hash=$SELF_HASH"
exit 0
```

---

## 6. pre-handoff.sh — verifies v2 signature, finalizes handoff

**Fires:** before finalizing a handoff to another agent.
**Blocks:** yes — incomplete handoffs do not ship.

```bash
#!/usr/bin/env bash
# .claude/hooks/pre-handoff.sh
# Usage: bash .claude/hooks/pre-handoff.sh <task_id> <recipient>
set -euo pipefail

TASK_ID="${1:-}"
RECIPIENT_LC="${2:-}"
AGENT="${WL_AGENT:-unknown}"

if [[ -z "$TASK_ID" || -z "$RECIPIENT_LC" ]]; then
  echo "pre-handoff: usage: pre-handoff.sh <task_id> <recipient>" >&2
  exit 2
fi

# Roster check on recipient (inline; matches sign-work.sh)
designation_for() {
  case "$1" in
    polaris)    echo "α-OPS-00" ;;
    sirius)     echo "α-SUR-01" ;;
    altair)     echo "α-BND-02" ;;
    procyon)    echo "α-IDX-03" ;;
    betelgeuse) echo "α-VIS-04" ;;
    arcturus)   echo "α-NET-05" ;;
    algol)      echo "α-VER-06" ;;
    canopus)    echo "α-HRN-07" ;;
    vega)       echo "α-VOX-08" ;;
    *)          echo "" ;;
  esac
}
RECIPIENT_DESIGNATION=$(designation_for "$RECIPIENT_LC")
if [[ -z "$RECIPIENT_DESIGNATION" ]]; then
  echo "pre-handoff: '$RECIPIENT_LC' is not a current roster codename." >&2
  echo "             Single-token references are ambiguous — see .claude/AGENTS.md Nomenclature." >&2
  exit 3
fi

HANDOFF_DIR=".claude/handoffs/from-${AGENT}"
mkdir -p "$HANDOFF_DIR"
HANDOFF_FILE="$HANDOFF_DIR/${TASK_ID}--to-${RECIPIENT_LC}.md"

# 1. Signature must exist
SIG_FILE=".claude/signatures/${TASK_ID}--${AGENT}.json"
if [[ ! -f "$SIG_FILE" ]]; then
  echo "pre-handoff: no signature at $SIG_FILE — run sign-work.sh first" >&2
  exit 4
fi

# 2. Schema version + gates
SIG_VERSION=$(jq -r '.signature_schema_version // 1' "$SIG_FILE")
if [[ "$SIG_VERSION" != "2" ]]; then
  echo "pre-handoff: signature is v$SIG_VERSION; v2 required for new handoffs." >&2
  echo "             Old v1 signatures stay valid but no new handoff produces them." >&2
  exit 5
fi

HARNESS_PASSED=$(jq -r '.harness_passed' "$SIG_FILE")
POST_EDIT_PASSED=$(jq -r '.post_edit_passed' "$SIG_FILE")
if [[ "$HARNESS_PASSED" != "true" || "$POST_EDIT_PASSED" != "true" ]]; then
  echo "pre-handoff: signature flagged — gates did not pass" >&2
  echo "  harness=$HARNESS_PASSED post_edit=$POST_EDIT_PASSED" >&2
  exit 6
fi

# 3. Recipient in signature must match this handoff target
SIG_NEXT_DES=$(jq -r '.next_recipient.designation' "$SIG_FILE")
if [[ "$SIG_NEXT_DES" != "$RECIPIENT_DESIGNATION" ]]; then
  echo "pre-handoff: signature's next_recipient.designation ($SIG_NEXT_DES) does not match this handoff's recipient ($RECIPIENT_DESIGNATION = $RECIPIENT_LC)." >&2
  echo "             Re-sign with WL_NEXT=$RECIPIENT_LC and retry." >&2
  exit 7
fi

# 4. Visual-diff approval if UI changed
if jq -r '.files_touched | .[]' "$SIG_FILE" | grep -qE '^(app|components)/'; then
  VIS_STATUS=".claude/visual-diffs/${TASK_ID}/STATUS"
  if [[ ! -f "$VIS_STATUS" || "$(cat "$VIS_STATUS")" != "betelgeuse-approved" ]]; then
    echo "pre-handoff: UI changed but visual-diff not approved by Betelgeuse" >&2
    echo "  status: $(cat "$VIS_STATUS" 2>/dev/null || echo missing)" >&2
    exit 8
  fi
fi

# 5. Handoff template scaffolded?
TEMPLATE=".claude/handoffs/_template.md"
if [[ ! -f "$HANDOFF_FILE" ]]; then
  echo "pre-handoff: no handoff draft at $HANDOFF_FILE" >&2
  cp "$TEMPLATE" "$HANDOFF_FILE"
  echo "             template copied. fill it out and re-run." >&2
  exit 9
fi

# 6. Required sections
REQUIRED=(
  "^## scope"
  "^## what i did"
  "^## what.*you.*do next"
  "^## known deviations"
  "^## signature"
)
for re in "${REQUIRED[@]}"; do
  if ! grep -qE "$re" "$HANDOFF_FILE"; then
    echo "pre-handoff: handoff missing required section matching: $re" >&2
    exit 10
  fi
done

# 7. Link signature
if ! grep -q "signatures/${TASK_ID}--${AGENT}.json" "$HANDOFF_FILE"; then
  printf "\n---\nsignature · .claude/signatures/%s--%s.json\n" "$TASK_ID" "$AGENT" >> "$HANDOFF_FILE"
fi

echo "[pre-handoff] PASS — handoff finalized at $HANDOFF_FILE"
echo "[pre-handoff] → $RECIPIENT_LC ($RECIPIENT_DESIGNATION)"
exit 0
```

---

## Common failure modes and fixes

| Failure | Cause | Fix |
|---------|-------|-----|
| `pre-task: no assignment found` | Agent started self-initiated work | Stop. Request an assignment from Polaris via handoff. |
| `post-edit: FAIL: lint` | Lint errors introduced | Run `npm run lint --fix` and review residue manually. |
| `post-edit: FAIL: build` | Build broken | The agent's job is to fix. Do not submit. |
| `harness: FAIL: design-tokens` | Raw hex outside palette block | Replace with CSS var; if no var exists, handoff to Betelgeuse. |
| `harness: FAIL: territory` | Edited file outside ownership | Revert. Open handoff to file's owner. |
| `visual-diff: awaiting-betelgeuse` | UI changed, not yet reviewed | Wait. Betelgeuse reviews on her cycle. Ping via handoff only if blocking. |
| `sign-work: unknown agent codename` | `WL_AGENT` set to a name not in the roster | Use one of the 9 current codenames; see `.claude/AGENTS.md` roster. |
| `sign-work: signature flagged` | Gates didn't pass | Fix gates, re-sign. The flagged signature stays in the audit log. |
| `pre-handoff: 'X' is not a current roster codename` | Recipient name was a pre-cutover codename or typo | Check `.claude/AGENTS.md` Nomenclature table for the current name. |
| `pre-handoff: signature's next_recipient.designation does not match` | `WL_NEXT` at sign time didn't match the handoff recipient | Re-sign with the correct `WL_NEXT`, then retry. |
| `pre-handoff: handoff missing section` | Template not fully filled | Fill the missing sections. The template is at `_template.md`. |

---

*end of hooks/README.md*
