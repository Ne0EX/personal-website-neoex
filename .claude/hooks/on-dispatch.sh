#!/usr/bin/env bash
# .claude/hooks/on-dispatch.sh
# Logs Polaris dispatch events to .claude/hook-logs/polaris-dispatch.log
# Usage: bash .claude/hooks/on-dispatch.sh <task_id> <target_agent> [<slice_id>]
#
# Called by Polaris before each Task dispatch. Non-blocking — exits 0 always.
# Fails silently (logs to stderr) so dispatch is never gated by this hook.
#
# Rule: only Polaris should call this. If another agent calls it, the
# log entry records the caller and the anomaly is auditable by Algol.

set -uo pipefail

TASK_ID="${1:-unknown-task}"
TARGET_AGENT="${2:-unknown-agent}"
SLICE_ID="${3:-}"
CALLER="${WL_AGENT:-unknown}"
LOG_DIR=".claude/hook-logs"
LOG="$LOG_DIR/polaris-dispatch.log"

mkdir -p "$LOG_DIR" 2>/dev/null || true

TIMESTAMP="$(date -u +%FT%TZ 2>/dev/null || date -u)"
ENTRY="[dispatch] ts=$TIMESTAMP caller=$CALLER task=$TASK_ID target=$TARGET_AGENT"
[[ -n "$SLICE_ID" ]] && ENTRY="$ENTRY slice=$SLICE_ID"

# Guard: warn if caller is not polaris
if [[ "$CALLER" != "polaris" && "$CALLER" != "unknown" ]]; then
  ENTRY="$ENTRY ANOMALY=non-polaris-dispatch"
  echo "on-dispatch: WARNING — dispatch called by '$CALLER', not 'polaris'. This violates WORKFLOW.md dispatch depth rule." >&2
  echo "             If intentional, escalate to Canopus to update the harness rule." >&2
fi

echo "$ENTRY" >> "$LOG" 2>/dev/null || true
echo "[on-dispatch] logged: $ENTRY"
exit 0
