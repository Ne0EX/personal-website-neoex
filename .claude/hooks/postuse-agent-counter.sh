#!/usr/bin/env bash
# .claude/hooks/postuse-agent-counter.sh
# PostToolUse(Agent) wave-boundary checkpoint trigger.
#
# Fires after each Agent tool use. Maintains a per-session, per-turn counter
# using a temp file keyed on CLAUDE_SESSION_ID. When counter >= N=3 in the
# current turn window, fires save-checkpoint.sh with trigger=postuse-threshold
# and resets the counter.
#
# This protects against rate-limit-during-dispatch: checkpoint exists BEFORE
# wave 4+ agents start consuming quota.
#
# ZERO MODEL CALLS. Pure shell + filesystem.

set -uo pipefail
# Note: reads that may fail on missing files use '|| true' guards

THRESHOLD=3

# Derive a stable temp-dir path from session context
SESSION_KEY="${CLAUDE_SESSION_ID:-nosession}"
TMP_DIR="/tmp/wl-checkpoint-${SESSION_KEY}"
mkdir -p "$TMP_DIR"

COUNTER_FILE="$TMP_DIR/agent-tool-count"
TURN_FILE="$TMP_DIR/current-turn"

# Determine current turn marker (use CLAUDE_TASK_ID + current minute as proxy,
# since we don't have an explicit turn counter from the harness)
CURRENT_TURN_MARKER="${CLAUDE_TASK_ID:-notask}-$(date -u '+%Y%m%d%H%M')"

# If turn marker changed, reset counter (new turn window)
LAST_TURN=""
if [[ -f "$TURN_FILE" ]]; then
  LAST_TURN="$(cat "$TURN_FILE" 2>/dev/null || true)"
fi
if [[ "$LAST_TURN" != "$CURRENT_TURN_MARKER" ]]; then
  printf '0' > "$COUNTER_FILE"
  printf '%s' "$CURRENT_TURN_MARKER" > "$TURN_FILE"
fi

# Increment counter (safe read with default)
CURRENT="0"
if [[ -f "$COUNTER_FILE" ]]; then
  CURRENT="$(cat "$COUNTER_FILE" 2>/dev/null || echo '0')"
  CURRENT="${CURRENT:-0}"
fi
NEXT=$((CURRENT + 1))
printf '%d' "$NEXT" > "$COUNTER_FILE"

# Check threshold
if [[ "$NEXT" -ge "$THRESHOLD" ]]; then
  # Reset counter so next wave also gets a checkpoint (not just first threshold cross)
  printf '0' > "$COUNTER_FILE"

  # Determine repo root for the hook call
  REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

  # Force-enable so checkpoint fires regardless of session guard
  WL_CHECKPOINT_ALWAYS=1 bash "$REPO_ROOT/.claude/hooks/save-checkpoint.sh" \
    "postuse-threshold" \
    "agent-count=$NEXT threshold=$THRESHOLD session=$SESSION_KEY" \
    2>/dev/null || true
fi

exit 0
