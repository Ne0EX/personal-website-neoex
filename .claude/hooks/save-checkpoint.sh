#!/usr/bin/env bash
# .claude/hooks/save-checkpoint.sh
# Deterministic, zero-token checkpoint capture.
#
# Usage (direct):
#   bash .claude/hooks/save-checkpoint.sh [trigger] [note]
#
# trigger: stop | postuse-threshold | manual  (default: stop)
# note:    optional free-text appended to checkpoint header (manual trigger only)
#
# Wired via .claude/settings.json:
#   Stop hook        → trigger=stop
#   PostToolUse(Agent) threshold → trigger=postuse-threshold
#   Manual           → scripts/save-checkpoint.sh "<note>"
#
# ZERO MODEL CALLS. Pure shell + git + filesystem ops only.
# POSIX awk/grep/sed (BSD + GNU compatible).
# Idempotent: identical output modulo timestamp.
# Fail-safe: partial data + errors section if any sub-command fails.
#
# Performance target: < 1 second wall time.
# Output target: < 5 KB per checkpoint file.

set -uo pipefail  # note: no -e (we collect errors manually for fail-safe)

# ─── guards ───────────────────────────────────────────────────────────────────

TRIGGER="${1:-stop}"
NOTE="${2:-}"

# Guard 1: Only run in task-context sessions unless forced
# (stop trigger always runs; manual always runs; postuse-threshold always runs —
# but for stop, skip if no task context and WL_CHECKPOINT_ALWAYS is not set)
if [[ "$TRIGGER" == "stop" ]]; then
  if [[ -z "${CLAUDE_TASK_ID:-}" && "${WL_CHECKPOINT_ALWAYS:-0}" != "1" ]]; then
    # casual chat session — skip silently
    exit 0
  fi
fi

# ─── constants ────────────────────────────────────────────────────────────────

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
CHECKPOINT_DIR="$REPO_ROOT/docs/team/.checkpoints"
ROLLING_HEAD="$REPO_ROOT/docs/team/SAVE-POINT.md"
LAST_CHECKPOINT_MARKER="$REPO_ROOT/.claude/.last-checkpoint"
LOG_DIR="$REPO_ROOT/.claude/hook-logs"
TIMESTAMP="$(date -u '+%Y-%m-%d-%H-%M-%S')"
TIMESTAMP_HUMAN="$(date -u '+%Y-%m-%d %H:%M:%S') UTC"
# Add PID suffix to avoid same-second collisions (manual + immediate stop in same second)
ARCHIVE_FILE="$CHECKPOINT_DIR/${TIMESTAMP}-$$.md"

mkdir -p "$CHECKPOINT_DIR" "$LOG_DIR"

# ─── guard 2: skip if no changes since last checkpoint (stop trigger only) ────

if [[ "$TRIGGER" == "stop" && -f "$LAST_CHECKPOINT_MARKER" ]]; then
  # Cheap change detection: compare git status hash to marker content
  CURRENT_STATUS_HASH="$(git status --porcelain 2>/dev/null | sha256sum | awk '{print $1}')"
  LAST_STATUS_HASH="$(cat "$LAST_CHECKPOINT_MARKER" 2>/dev/null | awk '/^status_hash:/{print $2}')"
  if [[ "$CURRENT_STATUS_HASH" == "$LAST_STATUS_HASH" && -n "$CURRENT_STATUS_HASH" ]]; then
    # No changes — skip silently
    exit 0
  fi
fi

# ─── error collector (fail-safe) ──────────────────────────────────────────────

ERRORS=""
collect() {
  # Run a command, capture stdout, append any error to ERRORS
  local label="$1"; shift
  local out
  if out="$("$@" 2>&1)"; then
    printf '%s' "$out"
  else
    ERRORS="${ERRORS}  - ${label}: exit $? — $(printf '%s' "$out" | head -3)\n"
    printf '(unavailable)'
  fi
}

# ─── assemble checkpoint content ──────────────────────────────────────────────

# Build header
NOTE_LINE=""
if [[ -n "$NOTE" ]]; then
  NOTE_LINE="note: ${NOTE}"
else
  NOTE_LINE="note: (none)"
fi

TASK_CONTEXT="${CLAUDE_TASK_ID:-none}"
SESSION_CONTEXT="${CLAUDE_SESSION_ID:-none}"

# Section: git state (capped hard to control output size)
# Tracked dirty only (modified/staged) — avoids bloating with untracked noise
GIT_STATUS_TRACKED="$(git diff --name-status HEAD 2>/dev/null | head -20 || true)"
# Untracked count only (not enumerated here — enumerated in dirty-tree section)
GIT_UNTRACKED_COUNT="$(git ls-files --others --exclude-standard 2>/dev/null | wc -l | tr -d ' ' || echo '?')"
GIT_STATUS="${GIT_STATUS_TRACKED}
(+${GIT_UNTRACKED_COUNT} untracked — see dirty tree section)"
GIT_LOG="$(collect "git-log" git log -5 --oneline 2>/dev/null || true)"

# Section: signatures (last 10, newest first)
SIG_LIST="$(ls -t "$REPO_ROOT/.claude/signatures/"*.json 2>/dev/null | head -10 | while read -r f; do
  base="$(basename "$f")"
  printf '  %s\n' "$base"
done || echo '  (none)')"

# Section: handoffs — files newer than last checkpoint marker
if [[ -f "$LAST_CHECKPOINT_MARKER" ]]; then
  HANDOFFS_NEW="$(find "$REPO_ROOT/.claude/handoffs" -name "*.md" -newer "$LAST_CHECKPOINT_MARKER" -type f 2>/dev/null | head -15 | while read -r f; do
    printf '  %s\n' "${f#$REPO_ROOT/}"
  done)"
  if [[ -z "$HANDOFFS_NEW" ]]; then
    HANDOFFS_NEW="  (none newer than last checkpoint)"
  fi
else
  # Fallback: list most recent 15 handoffs by modification time
  HANDOFFS_NEW="$(ls -t "$REPO_ROOT/.claude/handoffs/from-"*/*.md 2>/dev/null | head -15 | while read -r f; do
    printf '  %s\n' "${f#$REPO_ROOT/}"
  done || echo '  (none)')"
fi

# Section: in-flight signal from STATUS.md
STATUS_FILE="$REPO_ROOT/docs/team/STATUS.md"
IN_FLIGHT_TASKS="(STATUS.md not found)"
if [[ -f "$STATUS_FILE" ]]; then
  # Extract TASK IDs with in-flight|queued|in-progress markers
  # POSIX awk: look for lines with TASK- patterns near in-flight/queued keywords
  IN_FLIGHT_TASKS="$(grep -E '(in-flight|queued|in-progress|dispatched)' "$STATUS_FILE" 2>/dev/null \
    | grep -oE 'TASK-[0-9]{4}-[0-9]{2}-[0-9]{2}-[A-Za-z0-9-]+' \
    | sort -u \
    | head -20 \
    | while read -r t; do printf '  %s\n' "$t"; done || echo '  (none found)')"
  if [[ -z "$IN_FLIGHT_TASKS" ]]; then
    IN_FLIGHT_TASKS="  (no in-flight tasks found in STATUS.md)"
  fi
fi

# Temp task outputs
TMP_TASK_OUTPUTS="$(ls -t /tmp/claude-*/tasks/*.output 2>/dev/null | head -10 | while read -r f; do
  printf '  %s\n' "$f"
done || echo '  (none)')"

# Section: dirty tree deliverables (untracked files — capped at 10 for size budget)
DIRTY_UNTRACKED="$(git ls-files --others --exclude-standard 2>/dev/null | head -10 | while read -r f; do
  printf '  %s\n' "$f"
done || echo '  (none)')"

# Section: resume hints — diff vs previous checkpoint (file-level)
DIFF_VS_PREV="(no previous checkpoint)"
if [[ -f "$LAST_CHECKPOINT_MARKER" ]]; then
  PREV_FILE="$(awk '/^archive_file:/{print $2}' "$LAST_CHECKPOINT_MARKER" 2>/dev/null)"
  if [[ -n "$PREV_FILE" && -f "$PREV_FILE" ]]; then
    DIFF_LINES="$(diff <(grep '^  ' "$PREV_FILE" 2>/dev/null || true) <(printf '%s\n' "$GIT_STATUS" | sed 's/^/  /') 2>/dev/null | head -20 || true)"
    if [[ -n "$DIFF_LINES" ]]; then
      DIFF_VS_PREV="$DIFF_LINES"
    else
      DIFF_VS_PREV="  (no diff — identical git state)"
    fi
  fi
fi

# ─── write checkpoint ─────────────────────────────────────────────────────────

CONTENT="## checkpoint ${TIMESTAMP_HUMAN}
trigger: ${TRIGGER}
${NOTE_LINE}
task_id: ${TASK_CONTEXT}
session_id: ${SESSION_CONTEXT}

### git state
\`\`\`
\$ git status --porcelain | head -40
${GIT_STATUS}

\$ git log -5 --oneline
${GIT_LOG}
\`\`\`

### signatures (last 10, newest first)
${SIG_LIST}

### handoffs (new since last checkpoint)
${HANDOFFS_NEW}

### in-flight signal
\`\`\`
${IN_FLIGHT_TASKS}
\`\`\`

### tmp task outputs
${TMP_TASK_OUTPUTS}

### dirty tree / untracked deliverables
\`\`\`
${DIRTY_UNTRACKED}
\`\`\`

### resume: diff vs previous checkpoint (file-level git status)
\`\`\`
${DIFF_VS_PREV}
\`\`\`"

# Append errors section if any sub-command failed
if [[ -n "$ERRORS" ]]; then
  CONTENT="${CONTENT}

### errors (partial data — some commands failed)
$(printf '%b' "$ERRORS")"
fi

# ─── write archive (timestamped, immutable) ───────────────────────────────────

printf '%s\n' "$CONTENT" > "$ARCHIVE_FILE"

# ─── write rolling head (SAVE-POINT.md) ──────────────────────────────────────
# Format: latest checkpoint first, then previous content (capped at ~100 lines)

PREV_CONTENT=""
if [[ -f "$ROLLING_HEAD" ]]; then
  # Keep at most 1 prior checkpoint header line from the rolling head
  # (just the timestamp and trigger line for archaeology reference).
  # Hard-cap at 30 lines to stay within the 5 KB rolling-head budget.
  PREV_CONTENT="$(awk '
    /^## checkpoint / { count++; if (count > 1) exit; print; next }
    count == 1 && /^(trigger|note|task_id):/ { print }
  ' "$ROLLING_HEAD" 2>/dev/null | head -30 || true)"
fi

{
  printf '# SAVE-POINT (rolling head — auto-generated; do not hand-edit)\n'
  printf '> last updated: %s\n' "$TIMESTAMP_HUMAN"
  printf '> trigger: %s\n' "$TRIGGER"
  printf '> archive: %s\n\n' "${ARCHIVE_FILE#$REPO_ROOT/}"
  printf '%s\n' "$CONTENT"
  if [[ -n "$PREV_CONTENT" ]]; then
    printf '\n---\n\n## prior checkpoints (last 3)\n\n'
    printf '%s\n' "$PREV_CONTENT"
  fi
} > "$ROLLING_HEAD"

# ─── update last-checkpoint marker ───────────────────────────────────────────

CURRENT_STATUS_HASH="$(git status --porcelain 2>/dev/null | sha256sum | awk '{print $1}')"
{
  printf 'timestamp: %s\n' "$TIMESTAMP"
  printf 'trigger: %s\n' "$TRIGGER"
  printf 'archive_file: %s\n' "$ARCHIVE_FILE"
  printf 'status_hash: %s\n' "$CURRENT_STATUS_HASH"
} > "$LAST_CHECKPOINT_MARKER"

# ─── log ─────────────────────────────────────────────────────────────────────

LOG_FILE="$LOG_DIR/${TIMESTAMP}--checkpoint-${TRIGGER}.log"
{
  printf '[save-checkpoint] trigger=%s timestamp=%s\n' "$TRIGGER" "$TIMESTAMP_HUMAN"
  printf '[save-checkpoint] archive → %s\n' "${ARCHIVE_FILE#$REPO_ROOT/}"
  printf '[save-checkpoint] rolling head → docs/team/SAVE-POINT.md\n'
  if [[ -n "$ERRORS" ]]; then
    printf '[save-checkpoint] WARNING: partial data — some sub-commands failed\n'
    printf '%b' "$ERRORS"
  else
    printf '[save-checkpoint] PASS — clean checkpoint\n'
  fi
} > "$LOG_FILE"

# Also emit to stderr so hook runner sees confirmation
printf '[save-checkpoint] PASS — %s → %s\n' "$TRIGGER" "${ARCHIVE_FILE#$REPO_ROOT/}" >&2

exit 0
