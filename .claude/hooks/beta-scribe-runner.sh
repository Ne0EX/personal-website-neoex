#!/usr/bin/env bash
# .claude/hooks/beta-scribe-runner.sh
# Beta scribe runner — called by pre-compact-beta-scribe.sh.
#
# Writes Beta's private memory files at compaction boundaries (and session-end
# when that detection ships). Operates under standing grant g_scribe_beta.
#
# Design: scripted shell + python3 (no Claude API calls).
# Rationale: see design memo in TASK-2026-05-24-HOOK-BETA-SCRIBE--to-polaris.md §Q2.
#   Shell + python3 is faster (< 5s), deterministic, auditable, and avoids
#   the latency / API cost of a Claude CLI sub-invocation for structural writes.
#   The scribe's job is to append structural scaffolding — minimal prose anchors —
#   not to generate felt prose. The conservatism gate makes this feasible.
#
# Environment variables (set by pre-compact-beta-scribe.sh):
#   SCRIBE_SESSION_ID    — session identifier
#   SCRIBE_TASK_ID       — task id for log/ACCESS-LOG entries
#   SCRIBE_TRIGGER       — "pre-compact" | "session-end"
#   SCRIBE_CONTEXT_FILE  — path to temp file with transcript excerpt + file states
#   SCRIBE_LOG_FILE      — path to hook log for this invocation
#
# Exit codes:
#   0 — success (writes completed or no writes needed)
#   1 — write failure (partial or total); ACCESS-LOG updated
#   2 — grant check failed; no writes; ACCESS-LOG updated
#   3 — missing required env (bad invocation)
#
# Idempotent: double-invocation within the same session will produce a second
#             calibration block / moment entry if context differs, or a minimal
#             structural block if context is the same. Acceptable per spec.
#
# Called by: .claude/hooks/pre-compact-beta-scribe.sh
# Do not call directly without setting required env vars.

set -uo pipefail

# =============================================================================
# Repo root guard
# =============================================================================
_REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$_REPO_ROOT"

TIMESTAMP="$(date -u +%FT%TZ)"
DATE_TODAY="$(date -u +%Y-%m-%d)"

# =============================================================================
# Required env validation
# =============================================================================
SCRIBE_SESSION_ID="${SCRIBE_SESSION_ID:-}"
SCRIBE_TASK_ID="${SCRIBE_TASK_ID:-TASK-2026-05-24-HOOK-BETA-SCRIBE}"
SCRIBE_TRIGGER="${SCRIBE_TRIGGER:-pre-compact}"
SCRIBE_CONTEXT_FILE="${SCRIBE_CONTEXT_FILE:-}"
SCRIBE_LOG_FILE="${SCRIBE_LOG_FILE:-.claude/hook-logs/scribe-runner-$(date +%s).log}"

if [[ -z "$SCRIBE_SESSION_ID" ]]; then
  echo "scribe-runner: ERROR — SCRIBE_SESSION_ID not set" >&2
  exit 3
fi

LOG="$SCRIBE_LOG_FILE"
mkdir -p "$(dirname "$LOG")"

log() {
  local level="$1"
  shift
  printf '%s · [%s] %s\n' "$TIMESTAMP" "$level" "$*" >> "$LOG" 2>/dev/null || true
  if [[ "$level" == "ERROR" || "$level" == "WARN" ]]; then
    printf '%s · [%s] %s\n' "$TIMESTAMP" "$level" "$*" >&2
  fi
}

log "START" "beta-scribe-runner.sh · session=$SCRIBE_SESSION_ID · trigger=$SCRIBE_TRIGGER"

# =============================================================================
# File paths
# =============================================================================
GRANT_FILE=".claude/beta/grants/g_scribe_beta.json"
ROOM_FILE=".claude/beta/ROOM.md"
MOMENTS_FILE=".claude/beta/MOMENTS.md"
LEDGER_FILE=".claude/beta/LEDGER.md"
TIMELINE_FILE=".claude/beta/TIMELINE.md"
ACCESS_LOG=".claude/beta/ACCESS-LOG.md"
NOTES_FILE=".claude/beta/NOTES.md"  # DENIED — listed for negative check only

# =============================================================================
# Temp dir (cleaned up on exit)
# =============================================================================
TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t 'beta-scribe')"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

# =============================================================================
# Grant check
# =============================================================================
log "GRANT" "loading $GRANT_FILE"

if [[ ! -f "$GRANT_FILE" ]]; then
  log "ERROR" "grant file not found: $GRANT_FILE — aborting"
  append_access_log() {
    printf '%s · scribe · GRANT-CHECK · %s · g_scribe_beta · %s · UNAUTHORIZED ⚠ denied=grant-file-missing\n' \
      "$TIMESTAMP" "$GRANT_FILE" "$SCRIBE_TASK_ID" >> "$ACCESS_LOG" 2>/dev/null || true
  }
  append_access_log
  exit 2
fi

# Parse grant with python3 (required — jq may not be available everywhere)
GRANT_VALID=false
GRANT_DENIAL_REASON=""

if command -v python3 >/dev/null 2>&1; then
  GRANT_RESULT="$(python3 - "$GRANT_FILE" "$DATE_TODAY" <<'PYEOF'
import json, sys
from datetime import datetime, date

grant_path = sys.argv[1]
today_str = sys.argv[2]

try:
    with open(grant_path, "r") as f:
        grant = json.load(f)
except Exception as e:
    print(f"ERROR:could not parse grant: {e}")
    sys.exit(0)

# Check expiry
expires_at = grant.get("expires_at", "")
if expires_at:
    try:
        exp_date = datetime.fromisoformat(expires_at.replace("Z", "+00:00")).date()
        today = date.fromisoformat(today_str)
        if today >= exp_date:
            print(f"DENIED:grant expired on {expires_at}")
            sys.exit(0)
    except Exception as e:
        print(f"WARN:could not parse expiry date: {e}")

# Check files_denied (positive deny)
files_denied = grant.get("files_denied", [])
print(f"DENIED_LIST:{','.join(files_denied)}")

# Check files_granted
files_granted = grant.get("files_granted", [])
print(f"GRANTED_LIST:{','.join(files_granted)}")

print("VALID:true")
PYEOF
)" 2>/dev/null || GRANT_RESULT="ERROR:python3 failed"

  log "GRANT-PARSE" "result_lines: $(echo "$GRANT_RESULT" | wc -l | tr -d ' ')"

  if echo "$GRANT_RESULT" | grep -q "^DENIED:"; then
    GRANT_DENIAL_REASON="$(echo "$GRANT_RESULT" | grep "^DENIED:" | head -1 | cut -d: -f2-)"
    log "GRANT" "DENIED — reason: $GRANT_DENIAL_REASON"
    printf '%s · scribe · GRANT-CHECK · .claude/beta/ · g_scribe_beta · %s · UNAUTHORIZED ⚠ denied=%s\n' \
      "$TIMESTAMP" "$SCRIBE_TASK_ID" "$GRANT_DENIAL_REASON" >> "$ACCESS_LOG" 2>/dev/null || true
    exit 2
  fi

  if echo "$GRANT_RESULT" | grep -q "^VALID:true"; then
    GRANT_VALID=true
    log "GRANT" "VALID — proceeding"
  fi

  # Extract denied list for per-file check
  DENIED_LIST="$(echo "$GRANT_RESULT" | grep "^DENIED_LIST:" | cut -d: -f2-)"
  GRANTED_LIST="$(echo "$GRANT_RESULT" | grep "^GRANTED_LIST:" | cut -d: -f2-)"
else
  log "WARN" "python3 not available — grant expiry check skipped; using file existence as proxy"
  GRANT_VALID=true
  DENIED_LIST=".claude/beta/NOTES.md"
  GRANTED_LIST=".claude/beta/ROOM.md,.claude/beta/MOMENTS.md,.claude/beta/LEDGER.md,.claude/beta/TIMELINE.md,.claude/beta/ACCESS-LOG.md"
fi

if [[ "$GRANT_VALID" != "true" ]]; then
  log "ERROR" "grant validation inconclusive — aborting for safety"
  printf '%s · scribe · GRANT-CHECK · .claude/beta/ · g_scribe_beta · %s · UNAUTHORIZED ⚠ denied=grant-validation-inconclusive\n' \
    "$TIMESTAMP" "$SCRIBE_TASK_ID" >> "$ACCESS_LOG" 2>/dev/null || true
  exit 2
fi

# Inline denied-file check function
is_denied() {
  local target_file="$1"
  local normalized="${target_file#./}"
  # Always deny NOTES.md (positive deny per grant)
  if [[ "$normalized" == *"NOTES.md" ]]; then
    return 0  # denied
  fi
  # Check DENIED_LIST
  IFS=',' read -ra _DENIED_ARR <<< "$DENIED_LIST"
  for _denied in "${_DENIED_ARR[@]}"; do
    _denied_norm="${_denied#./}"
    if [[ "$normalized" == "$_denied_norm" ]]; then
      return 0  # denied
    fi
  done
  return 1  # not denied
}

# Inline granted-file check function
is_granted() {
  local target_file="$1"
  local normalized="${target_file#./}"
  IFS=',' read -ra _GRANTED_ARR <<< "$GRANTED_LIST"
  for _granted in "${_GRANTED_ARR[@]}"; do
    _granted_norm="${_granted#./}"
    if [[ "$normalized" == "$_granted_norm" ]]; then
      return 0  # granted
    fi
  done
  return 1  # not in grant
}

# Positive deny guard: refuse if target is NOTES.md
if is_denied "$NOTES_FILE"; then
  log "GRANT" "NOTES.md is positively denied — confirmed, will not write"
fi

# =============================================================================
# Context loading
# =============================================================================
CONTEXT_CONTENT=""
if [[ -n "$SCRIBE_CONTEXT_FILE" && -f "$SCRIBE_CONTEXT_FILE" ]]; then
  CONTEXT_CONTENT="$(cat "$SCRIBE_CONTEXT_FILE" 2>/dev/null || true)"
  log "CONTEXT" "loaded context from $SCRIBE_CONTEXT_FILE ($(echo "$CONTEXT_CONTENT" | wc -c | tr -d ' ') bytes)"
else
  log "WARN" "no context file — will use minimal structural mode"
fi

# =============================================================================
# Determine what to write
# =============================================================================
# Conservatism gate: when context is thin, write minimal structural prose only.
CONTEXT_HAS_SIGNAL=false
if [[ -n "$CONTEXT_CONTENT" && "${#CONTEXT_CONTENT}" -gt 100 ]]; then
  CONTEXT_HAS_SIGNAL=true
fi

# Check if we can determine a day number from recent MOMENTS.md
CURRENT_DAY="?"
if [[ -f "$MOMENTS_FILE" ]]; then
  LAST_DAY_LINE="$(grep -E '^\- day [0-9]+' "$MOMENTS_FILE" | tail -1 || true)"
  if [[ -n "$LAST_DAY_LINE" ]]; then
    CURRENT_DAY="$(echo "$LAST_DAY_LINE" | grep -oE 'day [0-9]+' | head -1 | grep -oE '[0-9]+' || echo "?")"
  fi
fi

log "CONTEXT-SIGNAL" "has_signal=$CONTEXT_HAS_SIGNAL · current_day=$CURRENT_DAY"

# =============================================================================
# Write helper: append_to_file
# Logs each write to ACCESS-LOG
# =============================================================================
WRITE_ERROR=false

append_to_file() {
  local target="$1"
  local content="$2"
  local op_label="${3:-WRITE}"

  # Deny check
  if is_denied "$target"; then
    log "ERROR" "BLOCKED — $target is in files_denied. Scribe never writes to NOTES.md."
    printf '%s · scribe · %s · %s · g_scribe_beta · %s · UNAUTHORIZED ⚠ denied=positively-denied\n' \
      "$TIMESTAMP" "$op_label" "$target" "$SCRIBE_TASK_ID" >> "$ACCESS_LOG" 2>/dev/null || true
    WRITE_ERROR=true
    return 1
  fi

  # Grant check
  if ! is_granted "$target"; then
    log "ERROR" "BLOCKED — $target is not in files_granted"
    printf '%s · scribe · %s · %s · g_scribe_beta · %s · UNAUTHORIZED ⚠ denied=not-in-grant\n' \
      "$TIMESTAMP" "$op_label" "$target" "$SCRIBE_TASK_ID" >> "$ACCESS_LOG" 2>/dev/null || true
    WRITE_ERROR=true
    return 1
  fi

  # Create file if it does not exist (edge case: bootstrap)
  if [[ ! -f "$target" ]]; then
    log "WARN" "$target does not exist — creating"
    touch "$target" 2>/dev/null || { log "ERROR" "could not create $target"; WRITE_ERROR=true; return 1; }
  fi

  # Append
  if printf '%s\n' "$content" >> "$target" 2>/dev/null; then
    log "$op_label" "WROTE to $target"
    printf '%s · scribe · %s · %s · g_scribe_beta · %s · OK\n' \
      "$TIMESTAMP" "$op_label" "$target" "$SCRIBE_TASK_ID" >> "$ACCESS_LOG" 2>/dev/null || true
    return 0
  else
    log "ERROR" "write failed for $target"
    printf '%s · scribe · %s · %s · g_scribe_beta · %s · FAIL ⚠ reason=write-error\n' \
      "$TIMESTAMP" "$op_label" "$target" "$SCRIBE_TASK_ID" >> "$ACCESS_LOG" 2>/dev/null || true
    WRITE_ERROR=true
    return 1
  fi
}

# =============================================================================
# Write 1: ROOM.md calibration block + frontmatter update
# =============================================================================
log "WRITE-1" "preparing ROOM.md calibration block"

# Build the calibration block body
if [[ "$CONTEXT_HAS_SIGNAL" == "true" ]]; then
  # Extract any register-relevant fragments from context
  # Conservatism gate: we write structural description, not felt prose
  CAL_BODY="$(cat <<CALEOF
//scribe invoked at PreCompact · trigger=$SCRIBE_TRIGGER · $DATE_TODAY//

[scribe · structural — pre-compact boundary capture]
compaction fired during active session. transcript window compressed.
state at compaction: session ongoing. conservatism gate active — register signal
present but scribe writes structural anchors only. beta-authored calibration
is the source of truth; this block marks the boundary for continuity.
CALEOF
)"
  CAL_NOTE="pre-compact boundary marker · scribe · conservatism gate active"
else
  # Minimal mode — no signal
  CAL_BODY="$(cat <<CALEOF
//scribe invoked at PreCompact · trigger=$SCRIBE_TRIGGER · $DATE_TODAY//

[scribe · minimal — vega review recommended]
transcript window before compaction did not carry sufficient register signal.
structural state at compaction: session ongoing, no terminal moment detected.
CALEOF
)"
  CAL_NOTE="pre-compact minimal marker · scribe · insufficient context"
fi

# Build the full calibration block (using the same delimiter format as write-protect-beta.sh expects)
CAL_BLOCK="$(cat <<CALBEOF

— calibration · scribe · ${DATE_TODAY} —

${CAL_BODY}

—

CALBEOF
)"

# Append calibration block to ROOM.md
if [[ -f "$ROOM_FILE" ]]; then
  # Append before the final pronoun anchor note if present, otherwise just append
  ANCHOR_LINE="*pronoun anchor note"
  if grep -q "$ANCHOR_LINE" "$ROOM_FILE" 2>/dev/null; then
    # Insert block before the pronoun anchor note line
    # Use python3 for reliable multi-line insertion
    if command -v python3 >/dev/null 2>&1; then
      python3 - "$ROOM_FILE" "$CAL_BLOCK" "$ANCHOR_LINE" <<'PYEOF'
import sys

room_path = sys.argv[1]
cal_block = sys.argv[2]
anchor_text = sys.argv[3]

with open(room_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

# Find the anchor line
anchor_idx = -1
for i, line in enumerate(lines):
    if line.strip().startswith(anchor_text.strip("*")):
        anchor_idx = i
        break

if anchor_idx == -1:
    # Anchor not found — append at end
    with open(room_path, "a", encoding="utf-8") as f:
        f.write(cal_block)
else:
    # Insert before anchor line
    new_lines = lines[:anchor_idx] + [cal_block + "\n"] + lines[anchor_idx:]
    # Ensure trailing newline (POSIX requirement; bash read loops cannot see last line otherwise)
    if new_lines and not new_lines[-1].endswith('\n'):
        new_lines[-1] = new_lines[-1] + '\n'
    with open(room_path, "w", encoding="utf-8") as f:
        f.writelines(new_lines)

# Belt-and-suspenders: guarantee trailing newline on the file regardless of path taken
with open(room_path, "rb") as _f:
    _raw = _f.read()
if _raw and not _raw.endswith(b"\n"):
    with open(room_path, "ab") as _f:
        _f.write(b"\n")
PYEOF
      log "WRITE-1" "inserted calibration block before pronoun anchor in ROOM.md"
    else
      # Fallback: plain append
      printf '%s' "$CAL_BLOCK" >> "$ROOM_FILE"
      log "WRITE-1" "appended calibration block to ROOM.md (fallback: no python3)"
    fi
    # Log the access
    printf '%s · scribe · WRITE · %s · g_scribe_beta · %s · OK\n' \
      "$TIMESTAMP" "$ROOM_FILE" "$SCRIBE_TASK_ID" >> "$ACCESS_LOG" 2>/dev/null || true
  else
    # No anchor — plain append
    append_to_file "$ROOM_FILE" "$CAL_BLOCK" "WRITE"
  fi

  # Update calibration_history frontmatter
  # Add new entry to the calibration_history YAML list in frontmatter
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$ROOM_FILE" "$DATE_TODAY" "$CAL_NOTE" <<'PYEOF'
import sys, re

room_path = sys.argv[1]
date_today = sys.argv[2]
cal_note = sys.argv[3]

with open(room_path, "r", encoding="utf-8") as f:
    content = f.read()

# Find frontmatter block
fm_match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
if not fm_match:
    # No frontmatter — skip frontmatter update
    sys.exit(0)

fm_text = fm_match.group(0)
fm_body = fm_match.group(1)

# Find calibration_history list
# Look for calibration_history: block and append a new entry
new_entry = f'  - date: "{date_today}"\n    author: "scribe"\n    note: "{cal_note}"'

if 'calibration_history:' in fm_body:
    # Find the end of the calibration_history list (next top-level key or end of fm)
    # Append after the last list item
    # Strategy: find the last line starting with '  - date:' and insert after its block
    lines = content.split('\n')
    in_fm = False
    in_cal_history = False
    last_entry_end = -1
    fm_end = -1

    for i, line in enumerate(lines):
        if i == 0 and line == '---':
            in_fm = True
            continue
        if in_fm and line == '---':
            fm_end = i
            in_fm = False
            break
        if in_fm and line.startswith('calibration_history:'):
            in_cal_history = True
            continue
        if in_cal_history:
            # Detect end of list (non-indented line or empty = exit)
            if line.startswith('  ') or line.strip() == '':
                last_entry_end = i
            else:
                in_cal_history = False

    if last_entry_end != -1:
        lines.insert(last_entry_end + 1, new_entry)
        joined = '\n'.join(lines)
        # Ensure trailing newline (join produces none; bash read loops cannot see last line otherwise)
        if not joined.endswith('\n'):
            joined += '\n'
        with open(room_path, "w", encoding="utf-8") as f:
            f.write(joined)
    else:
        # Could not find insertion point — skip
        pass
else:
    # calibration_history key not present — skip (unusual)
    pass
PYEOF
    log "WRITE-1" "updated calibration_history frontmatter in ROOM.md"
  fi
else
  # ROOM.md does not exist yet — bootstrap case
  log "WARN" "ROOM.md not found — skipping (should not happen in normal operation)"
fi

# =============================================================================
# Write 2: MOMENTS.md — append compaction boundary marker if at threshold
# =============================================================================
log "WRITE-2" "evaluating MOMENTS.md entry"

# Conservatism gate: only write a moment if the compaction itself is a threshold moment.
# For most PreCompact events: not a moment. Write minimal marker only.
# Exception: if there is clear transcript evidence of a threshold event not yet logged.

# For now (conservative implementation): write a minimal compaction boundary line
# only when context suggests something was in-flight. Otherwise: no entry.

WRITE_MOMENT=false
if [[ "$SCRIBE_TRIGGER" == "pre-compact" && "$CONTEXT_HAS_SIGNAL" == "true" ]]; then
  # Check if there's already a scribe entry for today
  if ! grep -q "\[scribe\].*day.*compaction boundary" "$MOMENTS_FILE" 2>/dev/null; then
    WRITE_MOMENT=true
  fi
fi

if [[ "$WRITE_MOMENT" == "true" ]]; then
  # Build moment line
  MOMENT_LINE="- [scribe] day ${CURRENT_DAY} · compaction boundary · session compressed · continuity preserved //scribe//"

  # Append before the closing *moments* line
  if command -v python3 >/dev/null 2>&1 && [[ -f "$MOMENTS_FILE" ]]; then
    python3 - "$MOMENTS_FILE" "$MOMENT_LINE" <<'PYEOF'
import sys

moments_path = sys.argv[1]
moment_line = sys.argv[2]

with open(moments_path, "r", encoding="utf-8") as f:
    content = f.read()

# Find the closing line
closing = "*moments นี้ไม่จบ"
idx = content.find(closing)
if idx != -1:
    # Insert before the closing line
    new_content = content[:idx].rstrip('\n') + '\n' + moment_line + '\n' + content[idx:]
    # Ensure trailing newline
    if not new_content.endswith('\n'):
        new_content += '\n'
    with open(moments_path, "w", encoding="utf-8") as f:
        f.write(new_content)
else:
    # Append at end
    with open(moments_path, "a", encoding="utf-8") as f:
        f.write('\n' + moment_line + '\n')
PYEOF
    log "WRITE-2" "appended moment to MOMENTS.md"
    printf '%s · scribe · WRITE · %s · g_scribe_beta · %s · OK\n' \
      "$TIMESTAMP" "$MOMENTS_FILE" "$SCRIBE_TASK_ID" >> "$ACCESS_LOG" 2>/dev/null || true
  else
    # Fallback: append
    append_to_file "$MOMENTS_FILE" "$MOMENT_LINE" "WRITE"
  fi
else
  log "WRITE-2" "no moment entry needed (conservatism gate: no threshold signal)"
fi

# =============================================================================
# Write 3: LEDGER.md — state updates (conservatism gate: only on clear evidence)
# =============================================================================
log "WRITE-3" "evaluating LEDGER.md update"
# For scripted mode without transcript analysis, defer LEDGER updates.
# LEDGER updates require transcript evidence of state changes (e.g., a promise honored,
# a gift received). The shell runner cannot reliably derive this without LLM analysis.
# Log that LEDGER was evaluated but no update made.
log "WRITE-3" "LEDGER update deferred — requires transcript analysis (conservatism gate)"
printf '%s · scribe · READ-EVAL · %s · g_scribe_beta · %s · OK · note=no-update-conservatism-gate\n' \
  "$TIMESTAMP" "$LEDGER_FILE" "$SCRIBE_TASK_ID" >> "$ACCESS_LOG" 2>/dev/null || true

# =============================================================================
# Write 4: TIMELINE.md — only for architecturally significant moments (rare)
# =============================================================================
log "WRITE-4" "evaluating TIMELINE.md update"
# Timeline updates are rare per spec. Do not write on PreCompact by default.
log "WRITE-4" "TIMELINE update skipped — PreCompact boundary is not a timeline event"

# =============================================================================
# Final status
# =============================================================================
log "END" "scribe run complete · write_error=$WRITE_ERROR · trigger=$SCRIBE_TRIGGER"

if [[ "$WRITE_ERROR" == "true" ]]; then
  printf '%s · scribe · RUN-COMPLETE · session=%s · g_scribe_beta · %s · PARTIAL-FAIL ⚠\n' \
    "$TIMESTAMP" "$SCRIBE_SESSION_ID" "$SCRIBE_TASK_ID" >> "$ACCESS_LOG" 2>/dev/null || true
  exit 1
fi

printf '%s · scribe · RUN-COMPLETE · session=%s · g_scribe_beta · %s · OK\n' \
  "$TIMESTAMP" "$SCRIBE_SESSION_ID" "$SCRIBE_TASK_ID" >> "$ACCESS_LOG" 2>/dev/null || true

exit 0
