#!/usr/bin/env bash
# .claude/hooks/grant-cleanup.sh
# Removes expired and fully-consumed grants from .claude/beta/grants/
#
# Usage: bash .claude/hooks/grant-cleanup.sh [--dry-run]
#
# Flags
# -----
#   --dry-run   · print what would be removed without deleting anything
#
# A grant is eligible for removal when EITHER:
#   - expires_at timestamp is in the past (regardless of reads_consumed)
#   - reads_consumed >= max_reads (fully consumed, regardless of expiry)
#
# Both conditions are checked; either alone is sufficient to remove.
#
# Idempotent: running multiple times produces the same result.
# Fail-closed: if jq is unavailable, script exits 1 with clear message.
# Logs to: .claude/hook-logs/<task-id>--grant-cleanup.log

set -euo pipefail

GRANTS_DIR=".claude/beta/grants"
LOG_DIR=".claude/hook-logs"
mkdir -p "$LOG_DIR"

TASK_ID="${CLAUDE_TASK_ID:-${WL_TASK_ID:-cleanup-$(date +%s)}}"
LOG="$LOG_DIR/${TASK_ID}--grant-cleanup.log"
TIMESTAMP="$(date -u +%FT%TZ)"
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
  esac
done

# Guard: jq is required
if ! command -v jq >/dev/null 2>&1; then
  echo "grant-cleanup: BLOCKED — jq is not available. Cannot safely parse grant files." >&2
  exit 1
fi

echo "[grant-cleanup] $TIMESTAMP dry_run=$DRY_RUN" | tee -a "$LOG"

if [[ ! -d "$GRANTS_DIR" ]]; then
  echo "[grant-cleanup] grants directory does not exist — nothing to clean" | tee -a "$LOG"
  exit 0
fi

NOW_EPOCH="$(date -u +%s)"
REMOVED=0
KEPT=0
CORRUPT=0

parse_iso8601_epoch() {
  local timestamp="$1"
  local parsed=""

  if parsed="$(date -u -d "$timestamp" +%s 2>/dev/null)"; then
    printf '%s\n' "$parsed"
    return 0
  fi
  if parsed="$(date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$timestamp" +%s 2>/dev/null)"; then
    printf '%s\n' "$parsed"
    return 0
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$timestamp" <<'PYEOF'
import datetime
import sys

try:
    value = datetime.datetime.fromisoformat(sys.argv[1].replace("Z", "+00:00"))
    if value.tzinfo is None:
        raise ValueError("timezone required")
    print(int(value.timestamp()))
except (TypeError, ValueError):
    sys.exit(1)
PYEOF
    return $?
  fi
  return 1
}

for grant_file in "$GRANTS_DIR"/*.json; do
  [[ -f "$grant_file" ]] || continue

  # Parse grant — skip corrupt files (log them)
  grant_json="$(jq '.' "$grant_file" 2>/dev/null)" || {
    echo "  [corrupt] $grant_file — skipping" | tee -a "$LOG" >&2
    (( CORRUPT++ )) || true
    continue
  }

  # Cleanup is destructive, so valid JSON is not enough: preserve any file
  # that does not satisfy the documented grant schema for manual inspection.
  if ! printf '%s' "$grant_json" | jq -e '
    type == "object" and
    (.grant_id | type == "string" and length > 0) and
    (.request_id | type == "string" and length > 0) and
    (.requester | type == "string" and length > 0) and
    (.files_granted | type == "array" and length > 0 and all(.[]; type == "string" and length > 0)) and
    (.scope_reason | type == "string") and
    (.issued_at | type == "string" and length > 0) and
    (.expires_at | type == "string" and length > 0) and
    (.max_reads | type == "number" and . > 0 and floor == .) and
    (.reads_consumed | type == "number" and . >= 0 and floor == .) and
    (.nonce | type == "string" and length > 0)
  ' >/dev/null 2>&1; then
    echo "  [corrupt] $grant_file — invalid grant schema; skipping" | tee -a "$LOG" >&2
    CORRUPT=$(( CORRUPT + 1 ))
    continue
  fi

  grant_id="$(echo "$grant_json"    | jq -r '.grant_id // "unknown"')"
  max_reads="$(echo "$grant_json"   | jq -r '.max_reads // 0')"
  consumed="$(echo "$grant_json"    | jq -r '.reads_consumed // 0')"
  expires_at="$(echo "$grant_json"  | jq -r '.expires_at // ""')"

  REMOVE_REASON=""

  # Check: expired?
  if ! expires_epoch="$(parse_iso8601_epoch "$expires_at")"; then
    echo "  [corrupt] $grant_file — invalid expires_at; skipping" | tee -a "$LOG" >&2
    CORRUPT=$(( CORRUPT + 1 ))
    continue
  fi
  if [[ "$NOW_EPOCH" -ge "$expires_epoch" ]]; then
    REMOVE_REASON="expired (expires_at=$expires_at)"
  fi

  # Check: fully consumed?
  if [[ "$consumed" -ge "$max_reads" ]]; then
    if [[ -n "$REMOVE_REASON" ]]; then
      REMOVE_REASON="$REMOVE_REASON + fully-consumed ($consumed/$max_reads)"
    else
      REMOVE_REASON="fully-consumed ($consumed/$max_reads)"
    fi
  fi

  if [[ -n "$REMOVE_REASON" ]]; then
    if $DRY_RUN; then
      echo "  [would-remove] $grant_id · $REMOVE_REASON" | tee -a "$LOG"
    else
      rm -f "$grant_file"
      echo "  [removed] $grant_id · $REMOVE_REASON" | tee -a "$LOG"
    fi
    (( REMOVED++ )) || true
  else
    echo "  [kept] $grant_id" | tee -a "$LOG"
    (( KEPT++ )) || true
  fi
done

echo "[grant-cleanup] done: removed=$REMOVED kept=$KEPT corrupt=$CORRUPT" | tee -a "$LOG"
exit 0
