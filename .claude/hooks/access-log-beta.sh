#!/usr/bin/env bash
# .claude/hooks/access-log-beta.sh
# Append-only access log for Beta's private memory.
#
# Usage (two modes)
# -----------------
# Mode A — pipe from read-gate-beta.sh (inline event):
#   echo "<event-line>" | bash .claude/hooks/access-log-beta.sh
#
# Mode B — called with explicit arguments:
#   bash .claude/hooks/access-log-beta.sh <timestamp> <agent> <op> <path> <grant_id> <task_id> <verdict>
#
# Entry format (append-only, one line per event):
#   <timestamp> · <agent> · <OP> · <path> · grant#<id|-> · <task-id|-> · <OK|UNAUTHORIZED ⚠>
#
# The UNAUTHORIZED ⚠ marker is what Algol scans for in audit rounds.
#
# Design
# ------
# - Append-only: never truncates ACCESS-LOG.md
# - Idempotent per event (same call twice = two log lines, both valid)
# - If ACCESS-LOG.md cannot be written, logs to stderr and exits 0
#   (logging failure must not block the gate decision)
# - Logs to hook-log as well as ACCESS-LOG.md
#
# ACCESS-LOG.md lives at .claude/beta/ACCESS-LOG.md (Beta's territory).
# Default: tracked in git (Peat preference = keep). Gitignore-able if desired.

set -euo pipefail

ACCESS_LOG=".claude/beta/ACCESS-LOG.md"
LOG_DIR=".claude/hook-logs"
mkdir -p "$LOG_DIR"

TASK_ID="${CLAUDE_TASK_ID:-${WL_TASK_ID:-session-$(date +%s)}}"
LOG="$LOG_DIR/${TASK_ID}--access-log.log"

# --------------------------------------------------------------------------
# Determine input mode
# --------------------------------------------------------------------------
if [[ "$#" -eq 7 ]]; then
  # Mode B: explicit arguments
  TIMESTAMP="$1"
  AGENT="$2"
  OP="$3"
  PATH_ARG="$4"
  GRANT_ID="$5"
  TASK_ARG="$6"
  VERDICT="$7"
  EVENT_LINE="${TIMESTAMP} · ${AGENT} · ${OP} · ${PATH_ARG} · grant#${GRANT_ID} · ${TASK_ARG} · ${VERDICT}"
elif [[ ! -t 0 ]]; then
  # Mode A: piped event line — read from stdin
  EVENT_LINE="$(cat)"
  # Parse with shell string operations. BSD cut accepts only single-byte
  # delimiters, so using the multibyte middle-dot as cut -d is not portable.
  REMAINING="$EVENT_LINE"
  FIELDS=()
  INVALID_EVENT=false
  field_index=0
  while [[ "$field_index" -lt 6 ]]; do
    if [[ "$REMAINING" != *" · "* ]]; then
      INVALID_EVENT=true
      break
    fi
    FIELDS[$field_index]="${REMAINING%% · *}"
    REMAINING="${REMAINING#* · }"
    field_index=$(( field_index + 1 ))
  done

  if [[ "$INVALID_EVENT" == "true" ]] || [[ -z "$REMAINING" ]] \
    || [[ "$REMAINING" == *" · "* ]] || [[ "$EVENT_LINE" == *$'\n'* ]]; then
    echo "access-log-beta: usage error — piped event must contain exactly seven fields" >&2
    exit 0
  fi

  TIMESTAMP="${FIELDS[0]}"
  AGENT="${FIELDS[1]}"
  OP="${FIELDS[2]}"
  PATH_ARG="${FIELDS[3]}"
  GRANT_RAW="${FIELDS[4]}"
  GRANT_ID="${GRANT_RAW#grant#}"
  TASK_ARG="${FIELDS[5]}"
  VERDICT="$REMAINING"

  for field in "$TIMESTAMP" "$AGENT" "$OP" "$PATH_ARG" "$GRANT_RAW" "$TASK_ARG" "$VERDICT"; do
    if [[ -z "$field" ]]; then
      echo "access-log-beta: usage error — piped event fields must be non-empty" >&2
      exit 0
    fi
  done
else
  echo "access-log-beta: usage error — provide 7 args or pipe an event line" >&2
  exit 0  # non-blocking: logging failure doesn't stop the gate
fi

# --------------------------------------------------------------------------
# Initialize ACCESS-LOG.md if it does not exist
# --------------------------------------------------------------------------
ensure_log_header() {
  if [[ ! -f "$ACCESS_LOG" ]]; then
    mkdir -p "$(dirname "$ACCESS_LOG")"
    cat > "$ACCESS_LOG" <<'HEADER'
# Beta Private Memory — Access Log

> append-only · owner: Beta (α-... / エレ)
> format: `<timestamp> · <agent> · <OP> · <path> · grant#<id|-> · <task-id|-> · <OK|UNAUTHORIZED ⚠>`
> Algol scans for `UNAUTHORIZED ⚠` in audit rounds.

---

HEADER
  fi
}

# --------------------------------------------------------------------------
# Append event to ACCESS-LOG.md (fail-soft)
# --------------------------------------------------------------------------
if ensure_log_header 2>/dev/null && [[ -f "$ACCESS_LOG" ]]; then
  echo "$EVENT_LINE" >> "$ACCESS_LOG" 2>/dev/null || {
    echo "access-log-beta: WARNING — could not write to $ACCESS_LOG" >&2
  }
else
  echo "access-log-beta: WARNING — could not initialize $ACCESS_LOG" >&2
fi

# --------------------------------------------------------------------------
# Also write to hook log
# --------------------------------------------------------------------------
echo "$EVENT_LINE" >> "$LOG" 2>/dev/null || true

# UNAUTHORIZED events go to stderr for immediate visibility
if echo "$VERDICT" | grep -q "UNAUTHORIZED"; then
  echo "access-log-beta: UNAUTHORIZED ACCESS RECORDED — $AGENT · $OP · $PATH_ARG" >&2
fi

exit 0
