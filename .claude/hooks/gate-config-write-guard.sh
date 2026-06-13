#!/usr/bin/env bash
# .claude/hooks/gate-config-write-guard.sh
#
# BLOCKING PreToolUse hook — gate-config write protection.
#
# Matches: Edit | Write | NotebookEdit
#
# The mutating-action PreToolUse hook gates Bash commands only. This
# means .harness/engine/core/runtime/mutating-bash.json and all other
# gate-config files under .harness/engine/** and .claude/hooks/** were
# silently writable via the Edit/Write/NotebookEdit tools. This hook
# closes that seam.
#
# PROTECTED PATHS (deny-by-default):
#   .harness/engine/**          — all engine runtime and sensor configs
#   .claude/hooks/**            — all hook scripts
#
# To allow an edit to a protected path, a Peat-at-seam marker must be
# present. The marker is the env var WL_GATE_CONFIG_SEAM=1, which Peat
# sets explicitly when authorizing harness infrastructure changes.
#
# SANCTIONED PATH for gate-config changes:
#   1. Peat sets: export WL_GATE_CONFIG_SEAM=1
#   2. Agent performs the edit.
#   3. Peat unsets: unset WL_GATE_CONFIG_SEAM
#
# The env var must be set in the terminal session that launches Claude Code;
# it is not settable by an agent via Bash (the mutating-action hook blocks
# the shell-env assignment to prevent self-unblocking).
#
# Owner: Canopus · α-HRN-07
# Introduced: TASK-2026-06-13-HARNESS-DEBT (DEBT-2 edit-tool gate seam)
# Rail: least-agency-config (barrier_class=HARD-BARRIER, mode=block)
#
# Exit codes:
#   0  — allow
#   2  — BLOCK (Claude Code treats exit 2 as block with message)

set -uo pipefail

ROOT="${HARNESS_REPO_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
LOG_DIR="$ROOT/.claude/hook-logs"
TASK_ID="${WL_TASK_ID:-${CLAUDE_TASK_ID:-adhoc}}"
LOG="$LOG_DIR/${TASK_ID}--gate-config-write-guard.log"

mkdir -p "$LOG_DIR" 2>/dev/null || true

block() {
  local reason="$1"
  local path_preview="${2:-}"
  echo "[gate-config-write-guard] BLOCKED: $reason" >> "$LOG" 2>/dev/null || true
  echo ""
  echo "BLOCKED by gate-config-write-guard: $reason"
  if [[ -n "$path_preview" ]]; then
    echo "Path: $path_preview"
  fi
  echo ""
  echo "Gate-config paths (.harness/engine/** and .claude/hooks/**) are"
  echo "protected. To authorize an edit, Peat must set:"
  echo "  export WL_GATE_CONFIG_SEAM=1"
  echo "in the terminal session before launching Claude Code."
  echo ""
  echo "This is a Peat-at-seam control. Agents cannot self-unblock."
  exit 2
}

# --- Read stdin payload ---
PAYLOAD="$(cat 2>/dev/null || true)"
if [[ -z "$PAYLOAD" ]]; then
  echo "[gate-config-write-guard] WARNING: no stdin payload — allowing" >> "$LOG" 2>/dev/null || true
  exit 0
fi

# Extract tool name and file path from Claude Code PreToolUse JSON
TOOL_NAME=$(printf '%s' "$PAYLOAD" | jq -r '.tool_name // .tool // ""' 2>/dev/null || true)

# Only act on Edit, Write, NotebookEdit
case "$TOOL_NAME" in
  Edit|Write|NotebookEdit|MultiEdit) ;;
  *) exit 0 ;;
esac

# Extract the target path — field differs by tool
# Edit: .tool_input.file_path
# Write: .tool_input.file_path
# NotebookEdit: .tool_input.notebook_path
# MultiEdit: .tool_input.file_path
FILE_PATH=$(printf '%s' "$PAYLOAD" | jq -r '
  .tool_input.file_path //
  .tool_input.notebook_path //
  ""
' 2>/dev/null || true)

if [[ -z "$FILE_PATH" ]]; then
  # No path extractable — allow (cannot determine target)
  exit 0
fi

# Normalize: strip leading repo root prefix if absolute, then strip leading ./
NORM_PATH="${FILE_PATH#"$ROOT/"}"
NORM_PATH="${NORM_PATH#./}"

# Check if path falls under a protected prefix
_PROTECTED=false
case "$NORM_PATH" in
  .harness/engine/*|.claude/hooks/*)
    _PROTECTED=true ;;
  # Absolute paths that start with the repo root + protected dirs
esac
# Also catch absolute paths that resolve inside repo protected dirs
case "$FILE_PATH" in
  "$ROOT/.harness/engine/"*|"$ROOT/.claude/hooks/"*)
    _PROTECTED=true ;;
esac

if [[ "$_PROTECTED" == "false" ]]; then
  # Not a protected path — allow
  echo "[gate-config-write-guard] allow $TOOL_NAME $NORM_PATH" >> "$LOG" 2>/dev/null || true
  exit 0
fi

# Protected path — check Peat-at-seam marker
if [[ "${WL_GATE_CONFIG_SEAM:-0}" == "1" ]]; then
  echo "[gate-config-write-guard] SEAM OPEN: WL_GATE_CONFIG_SEAM=1 — allowing $TOOL_NAME $NORM_PATH" >> "$LOG" 2>/dev/null || true
  echo ""
  echo "gate-config-write-guard: WL_GATE_CONFIG_SEAM=1 is set — gate-config write AUTHORIZED."
  echo "Path: $NORM_PATH"
  echo ""
  exit 0
fi

# No seam marker — block
block "$TOOL_NAME to protected gate-config path (WL_GATE_CONFIG_SEAM not set)" "$NORM_PATH"
