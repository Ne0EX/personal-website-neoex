#!/usr/bin/env bash
# Fires when Betelgeuse writes to docs/design/prototypes/**/*.html
# Logs the event and writes a notify handoff to Sirius.
# Always exits 0 — non-blocking.

set -euo pipefail

TOOL_INPUT="${1:-}"
TOUCHED_FILE=""

# Extract file path from tool input if provided, or from stdin (PostToolUse JSON)
if [ -z "$TOOL_INPUT" ]; then
  RAW_INPUT=$(cat 2>/dev/null || true)
  TOUCHED_FILE=$(echo "$RAW_INPUT" | jq -r '
    if .tool_name == "Write" then .tool_input.file_path
    elif .tool_name == "Edit" then .tool_input.file_path
    elif .tool_name == "MultiEdit" then .tool_input.file_path
    else ""
    end
  ' 2>/dev/null || true)
else
  TOUCHED_FILE="$TOOL_INPUT"
fi

# Only act on .html files in docs/design/prototypes/
if [[ "$TOUCHED_FILE" != *"docs/design/prototypes/"*".html" ]]; then
  exit 0
fi

TASK_ID="${CLAUDE_TASK_ID:-unknown}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
FILENAME=$(basename "$TOUCHED_FILE")
FEATURE=$(basename "$(dirname "$TOUCHED_FILE")")

# Derive spec path from task_id pattern
SPEC_PATH="docs/design/${FEATURE}-${TASK_ID}.md"

# Log
LOG_DIR=".claude/hook-logs"
mkdir -p "$LOG_DIR"
echo "[PROTOTYPE-READY] ${FILENAME} — betelgeuse · ${TASK_ID} · ${TIMESTAMP}" >> "${LOG_DIR}/prototype-ready.log"

# Write notify handoff to Sirius
HANDOFF_DIR=".claude/handoffs/from-betelgeuse"
mkdir -p "$HANDOFF_DIR"
HANDOFF_FILE="${HANDOFF_DIR}/PROTO-${TASK_ID}--to-sirius.md"

cat > "$HANDOFF_FILE" << EOF
# TO · Sirius (α-SUR-01)
# FROM · prototype-ready hook (Betelgeuse · α-VIS-04)
# TASK · ${TASK_ID}
# TYPE · PROTOTYPE NOTIFY
# CREATED · ${TIMESTAMP}

prototype: ${TOUCHED_FILE}
spec: ${SPEC_PATH}
EOF

exit 0
