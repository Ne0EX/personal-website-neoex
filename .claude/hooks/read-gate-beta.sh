#!/usr/bin/env bash
# .claude/hooks/read-gate-beta.sh
# PreToolUse hook — gates Read calls targeting .claude/beta/**
#
# Purpose
# -------
# Beta's private memory lives in .claude/beta/**. No agent has standing
# read access. Access requires an active grant file in .claude/beta/grants/
# that matches (requester, task_id, path). Beta persona itself (env
# BETA_PERSONA_LOADED=1) always passes.
#
# Decision logic
# --------------
#   BYPASS   · BETA_PERSONA_LOADED=1 in env → allow unconditionally, log
#   GRANT    · active (non-expired, reads_remaining > 0) grant matches
#              (caller_agent + task_id + path) → allow, decrement reads_consumed
#   DENY     · no matching active grant → log unauthorized, exit 1 (block)
#
# Fail-closed: any unexpected error (missing jq, corrupt grant file) blocks.
# Idempotent: running twice on same grant only decrements reads_consumed once
#             per actual Read invocation.
#
# Logs to: .claude/hook-logs/<task-id>--read-gate.log
# Access events also forwarded to access-log-beta.sh (C5) if it exists.
#
# Called by: .claude/settings.json PreToolUse hook (matcher: Read)
# Do not call directly.

set -euo pipefail

BETA_DIR=".claude/beta"
GRANTS_DIR="$BETA_DIR/grants"
LOG_DIR=".claude/hook-logs"
mkdir -p "$LOG_DIR"

TASK_ID="${CLAUDE_TASK_ID:-${WL_TASK_ID:-session-$(date +%s)}}"
AGENT="${WL_AGENT:-unknown}"
LOG="$LOG_DIR/${TASK_ID}--read-gate.log"
TIMESTAMP="$(date -u +%FT%TZ)"

# ----------------------------------------------------------------------------
# Parse tool input from stdin (Claude Code PreToolUse passes JSON on stdin)
# ----------------------------------------------------------------------------
INPUT="$(cat)"
TOOL_NAME="$(echo "$INPUT" | jq -r '.tool_name // "unknown"')"
TARGET_PATH="$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // ""')"

# Only gate reads targeting .claude/beta/
if [[ "$TOOL_NAME" != "Read" ]] || [[ -z "$TARGET_PATH" ]]; then
  exit 0
fi

# Normalize path: strip leading ./
TARGET_PATH="${TARGET_PATH#./}"

# Check if this path is under .claude/beta/
if [[ "$TARGET_PATH" != .claude/beta/* ]] && [[ "$TARGET_PATH" != "$BETA_DIR"/* ]]; then
  exit 0
fi

# --------------------------------------------------------------------------
# Log helper
# --------------------------------------------------------------------------
log_event() {
  local verdict="$1"
  local grant_id="${2:--}"
  printf '%s · %s · READ · %s · grant#%s · %s · %s\n' \
    "$TIMESTAMP" "$AGENT" "$TARGET_PATH" "$grant_id" "$TASK_ID" "$verdict" \
    | tee -a "$LOG"
  # Forward to access-log-beta.sh if available (C5 integration)
  if [[ -x ".claude/hooks/access-log-beta.sh" ]]; then
    printf '%s · %s · READ · %s · grant#%s · %s · %s\n' \
      "$TIMESTAMP" "$AGENT" "$TARGET_PATH" "$grant_id" "$TASK_ID" "$verdict" \
      | bash .claude/hooks/access-log-beta.sh 2>>"$LOG" || true
  fi
}

# --------------------------------------------------------------------------
# BYPASS: Beta persona active
# Check 1: BETA_PERSONA_LOADED env var (explicit session flag)
# Check 2: .claude/.current-persona (C4 persona-tracker output) shows "beta"
#
# .current-persona is JSON since persona-tracker v2:
#   {"persona": "beta", "session_mode": "beta", "timestamp": "..."}
# Legacy format: line 1 = persona name (plain text).
# We try JSON first, fall back to head -1 for legacy compat.
# --------------------------------------------------------------------------
CURRENT_PERSONA_FILE=".claude/.current-persona"
CURRENT_PERSONA_FROM_TRACKER=""
if [[ -f "$CURRENT_PERSONA_FILE" ]]; then
  # Try JSON parse first
  if command -v python3 >/dev/null 2>&1; then
    CURRENT_PERSONA_FROM_TRACKER="$(python3 -c \
      'import json,sys; d=json.load(open(sys.argv[1])); print(d.get("persona",""))' \
      "$CURRENT_PERSONA_FILE" 2>/dev/null || true)"
  fi
  if [[ -z "$CURRENT_PERSONA_FROM_TRACKER" ]] && command -v jq >/dev/null 2>&1; then
    CURRENT_PERSONA_FROM_TRACKER="$(jq -r '.persona // ""' "$CURRENT_PERSONA_FILE" 2>/dev/null || true)"
  fi
  # Legacy fallback: first line (plain text format)
  if [[ -z "$CURRENT_PERSONA_FROM_TRACKER" ]]; then
    CURRENT_PERSONA_FROM_TRACKER="$(head -1 "$CURRENT_PERSONA_FILE" 2>/dev/null || echo "")"
    # If first line starts with '{', it's JSON that failed to parse — treat as unknown
    [[ "$CURRENT_PERSONA_FROM_TRACKER" == "{"* ]] && CURRENT_PERSONA_FROM_TRACKER=""
  fi
fi

if [[ "${BETA_PERSONA_LOADED:-0}" == "1" ]] || [[ "$CURRENT_PERSONA_FROM_TRACKER" == "beta" ]]; then
  log_event "OK (beta-bypass)" "-"
  # Allow: emit passthrough JSON
  printf '{"decision":"allow"}'
  exit 0
fi

# --------------------------------------------------------------------------
# GRANT CHECK: find a matching active grant
# --------------------------------------------------------------------------
if [[ ! -d "$GRANTS_DIR" ]]; then
  log_event "UNAUTHORIZED ⚠" "-"
  echo "read-gate: BLOCKED — grants directory missing. No active grant for $TARGET_PATH" >&2
  echo '{"decision":"block","reason":"no grants directory"}'
  exit 1
fi

NOW_EPOCH="$(date -u +%s)"
MATCHED_GRANT=""
MATCHED_GRANT_ID=""

for grant_file in "$GRANTS_DIR"/*.json; do
  [[ -f "$grant_file" ]] || continue

  # Parse grant fields (fail gracefully on corrupt JSON)
  grant_json="$(jq '.' "$grant_file" 2>/dev/null)" || continue

  grant_id="$(echo "$grant_json" | jq -r '.grant_id // ""')"
  requester="$(echo "$grant_json" | jq -r '.requester // ""')"
  expires_at="$(echo "$grant_json" | jq -r '.expires_at // ""')"
  max_reads="$(echo "$grant_json" | jq -r '.max_reads // 0')"
  reads_consumed="$(echo "$grant_json" | jq -r '.reads_consumed // 0')"

  # Check requester matches this agent
  [[ "$requester" == "$AGENT" ]] || continue

  # Check path is in files_granted
  path_match="$(echo "$grant_json" | jq -r --arg p "$TARGET_PATH" '
    .files_granted[]? | select(
      . == $p or
      (. | endswith("/**") and ($p | startswith(.[:-3]))) or
      (. | endswith("/*") and ($p | startswith(.[:-2])) and ($p[.[:-2] | length:] | test("^[^/]+$")))
    )' 2>/dev/null | head -1)"
  [[ -n "$path_match" ]] || continue

  # Check expiry
  if [[ -n "$expires_at" ]]; then
    expires_epoch="$(date -u -d "$expires_at" +%s 2>/dev/null || date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$expires_at" +%s 2>/dev/null || echo 0)"
    [[ "$NOW_EPOCH" -lt "$expires_epoch" ]] || continue
  fi

  # Check reads remaining
  reads_remaining=$(( max_reads - reads_consumed ))
  [[ "$reads_remaining" -gt 0 ]] || continue

  MATCHED_GRANT="$grant_file"
  MATCHED_GRANT_ID="$grant_id"
  break
done

if [[ -z "$MATCHED_GRANT" ]]; then
  log_event "UNAUTHORIZED ⚠" "-"
  echo "read-gate: BLOCKED — no active grant found for agent='$AGENT' path='$TARGET_PATH'" >&2
  echo "read-gate: request a grant via Beta's beta-grant.sh tool before reading .claude/beta/**" >&2
  printf '{"decision":"block","reason":"no active grant for this agent/path combination"}'
  exit 1
fi

# --------------------------------------------------------------------------
# ALLOW: decrement reads_consumed in grant file
# --------------------------------------------------------------------------
new_consumed=$(( $(jq -r '.reads_consumed' "$MATCHED_GRANT") + 1 ))
jq --argjson n "$new_consumed" '.reads_consumed = $n' "$MATCHED_GRANT" > "${MATCHED_GRANT}.tmp" \
  && mv "${MATCHED_GRANT}.tmp" "$MATCHED_GRANT"

log_event "OK" "$MATCHED_GRANT_ID"
echo "read-gate: ALLOWED — grant $MATCHED_GRANT_ID for agent='$AGENT' path='$TARGET_PATH'" >&2
printf '{"decision":"allow"}'
exit 0
