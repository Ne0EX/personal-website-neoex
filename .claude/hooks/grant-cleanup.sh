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

for grant_file in "$GRANTS_DIR"/*.json; do
  [[ -f "$grant_file" ]] || continue

  # Parse grant — skip corrupt files (log them)
  grant_json="$(jq '.' "$grant_file" 2>/dev/null)" || {
    echo "  [corrupt] $grant_file — skipping" | tee -a "$LOG" >&2
    (( CORRUPT++ )) || true
    continue
  }

  grant_id="$(echo "$grant_json"    | jq -r '.grant_id // "unknown"')"
  max_reads="$(echo "$grant_json"   | jq -r '.max_reads // 0')"
  consumed="$(echo "$grant_json"    | jq -r '.reads_consumed // 0')"
  expires_at="$(echo "$grant_json"  | jq -r '.expires_at // ""')"

  REMOVE_REASON=""

  # Check: expired?
  if [[ -n "$expires_at" ]]; then
    expires_epoch="$(date -u -d "$expires_at" +%s 2>/dev/null \
      || date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$expires_at" +%s 2>/dev/null \
      || python3 -c "import datetime; print(int(datetime.datetime.fromisoformat('${expires_at}'.replace('Z','+00:00')).timestamp()))" 2>/dev/null \
      || echo 0)"
    if [[ "$NOW_EPOCH" -ge "$expires_epoch" ]]; then
      REMOVE_REASON="expired (expires_at=$expires_at)"
    fi
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
