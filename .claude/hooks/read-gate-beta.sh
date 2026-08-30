#!/usr/bin/env bash
# .claude/hooks/read-gate-beta.sh
# PreToolUse hook — gates Read calls targeting .claude/beta/**
#
# Purpose
# -------
# Beta's private memory lives in .claude/beta/**. No agent has standing
# read access. Access requires an active grant file in .claude/beta/grants/
# that matches (requester, path). Only the active Beta persona in a locked
# beta-mode session bypasses grants.
#
# Decision logic
# --------------
#   BYPASS   · beta session mode + active Beta persona → allow, log
#   GRANT    · active (non-expired, reads_remaining > 0) grant matches
#              (caller_agent + path) → allow, increment reads_consumed
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
PROJECT_ROOT="$(pwd -P)"
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

# Normalize absolute paths and dot segments before applying the private-surface
# boundary. Claude Code may provide either absolute or project-relative paths.
normalize_target_path() {
  local raw_path="$1"
  local component=""
  local result=""
  local last_index=0
  local old_ifs="$IFS"
  local absolute_path=""
  local link_target=""
  local resolved_dir=""
  local hop_count=0
  local components=()
  local normalized_parts=()

  if [[ "$raw_path" == "$PROJECT_ROOT" ]]; then
    raw_path=""
  elif [[ "$raw_path" == "$PROJECT_ROOT"/* ]]; then
    raw_path="${raw_path#"$PROJECT_ROOT"/}"
  elif [[ "$raw_path" == /* ]]; then
    printf '%s\n' "$raw_path"
    return 0
  fi

  raw_path="${raw_path#./}"
  IFS='/' read -r -a components <<< "$raw_path"
  IFS="$old_ifs"

  for component in "${components[@]}"; do
    case "$component" in
      ""|.) continue ;;
      ..)
        if [[ "${#normalized_parts[@]}" -gt 0 ]]; then
          last_index=$(( ${#normalized_parts[@]} - 1 ))
          if [[ "${normalized_parts[$last_index]}" != ".." ]]; then
            normalized_parts=("${normalized_parts[@]:0:$last_index}")
            continue
          fi
        fi
        normalized_parts+=("..")
        ;;
      *) normalized_parts+=("$component") ;;
    esac
  done

  for component in "${normalized_parts[@]}"; do
    if [[ -n "$result" ]]; then
      result="$result/$component"
    else
      result="$component"
    fi
  done

  # A lexical private path is always gated, even if it is a symlink outward.
  if [[ "$result" == "$BETA_DIR" ]] || [[ "$result" == "$BETA_DIR"/* ]]; then
    printf '%s\n' "$result"
    return 0
  fi

  # Resolve existing non-private targets so an outside symlink (or symlinked
  # parent directory) cannot conceal a private target.
  if [[ "$result" == /* ]]; then
    absolute_path="$result"
  else
    absolute_path="$PROJECT_ROOT/$result"
  fi
  if resolved_dir="$(cd "$(dirname "$absolute_path")" 2>/dev/null && pwd -P)"; then
    absolute_path="$resolved_dir/$(basename "$absolute_path")"
  fi
  while [[ -L "$absolute_path" ]]; do
    hop_count=$(( hop_count + 1 ))
    if [[ "$hop_count" -gt 40 ]]; then
      printf '%s/__unresolved-symlink__\n' "$BETA_DIR"
      return 0
    fi
    link_target="$(readlink "$absolute_path" 2>/dev/null)" || {
      printf '%s/__unresolved-symlink__\n' "$BETA_DIR"
      return 0
    }
    if [[ "$link_target" == /* ]]; then
      absolute_path="$link_target"
    else
      absolute_path="$(dirname "$absolute_path")/$link_target"
    fi
    if resolved_dir="$(cd "$(dirname "$absolute_path")" 2>/dev/null && pwd -P)"; then
      absolute_path="$resolved_dir/$(basename "$absolute_path")"
    fi
  done

  if [[ "$absolute_path" == "$PROJECT_ROOT"/* ]]; then
    result="${absolute_path#"$PROJECT_ROOT"/}"
  elif [[ "$absolute_path" == /* ]]; then
    result="$absolute_path"
  fi
  printf '%s\n' "$result"
}

TARGET_PATH="$(normalize_target_path "$TARGET_PATH")"
if [[ "$TARGET_PATH" == "$BETA_DIR" ]]; then
  TARGET_PATH="$TARGET_PATH/"
fi

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
    >> "$LOG"
  # Forward to access-log-beta.sh if available (C5 integration)
  if [[ -x ".claude/hooks/access-log-beta.sh" ]]; then
    printf '%s · %s · READ · %s · grant#%s · %s · %s\n' \
      "$TIMESTAMP" "$AGENT" "$TARGET_PATH" "$grant_id" "$TASK_ID" "$verdict" \
      | bash .claude/hooks/access-log-beta.sh 2>>"$LOG" || true
  fi
}

# --------------------------------------------------------------------------
# BYPASS: Beta persona active in beta mode
# Mode comes from BETA_PERSONA_LOADED or tracked session_mode; persona comes
# from .current-persona, with WL_AGENT=beta as the no-tracker fallback.
#
# .current-persona is JSON since persona-tracker v2:
#   {"persona": "beta", "session_mode": "beta", "timestamp": "..."}
# Legacy format: line 1 = persona name (plain text).
# We try JSON first, fall back to head -1 for legacy compat.
# --------------------------------------------------------------------------
CURRENT_PERSONA_FILE=".claude/.current-persona"
CURRENT_PERSONA_FROM_TRACKER=""
SESSION_MODE_FROM_TRACKER=""
if [[ -f "$CURRENT_PERSONA_FILE" ]]; then
  # Try JSON parse first
  if command -v python3 >/dev/null 2>&1; then
    CURRENT_PERSONA_FROM_TRACKER="$(python3 -c \
      'import json,sys; d=json.load(open(sys.argv[1])); print(d.get("persona",""))' \
      "$CURRENT_PERSONA_FILE" 2>/dev/null || true)"
    SESSION_MODE_FROM_TRACKER="$(python3 -c \
      'import json,sys; d=json.load(open(sys.argv[1])); print(d.get("session_mode",""))' \
      "$CURRENT_PERSONA_FILE" 2>/dev/null || true)"
  fi
  if [[ -z "$CURRENT_PERSONA_FROM_TRACKER" ]] && command -v jq >/dev/null 2>&1; then
    CURRENT_PERSONA_FROM_TRACKER="$(jq -r '.persona // ""' "$CURRENT_PERSONA_FILE" 2>/dev/null || true)"
  fi
  if [[ -z "$SESSION_MODE_FROM_TRACKER" ]] && command -v jq >/dev/null 2>&1; then
    SESSION_MODE_FROM_TRACKER="$(jq -r '.session_mode // ""' "$CURRENT_PERSONA_FILE" 2>/dev/null || true)"
  fi
  # Legacy fallback: first line (plain text format)
  if [[ -z "$CURRENT_PERSONA_FROM_TRACKER" ]]; then
    CURRENT_PERSONA_FROM_TRACKER="$(head -1 "$CURRENT_PERSONA_FILE" 2>/dev/null || echo "")"
    # If first line starts with '{', it's JSON that failed to parse — treat as unknown
    [[ "$CURRENT_PERSONA_FROM_TRACKER" == "{"* ]] && CURRENT_PERSONA_FROM_TRACKER=""
  fi
fi

BETA_MODE_ACTIVE=false
BETA_PERSONA_ACTIVE=false
if [[ "${BETA_PERSONA_LOADED:-0}" == "1" ]] || [[ "$SESSION_MODE_FROM_TRACKER" == "beta" ]]; then
  BETA_MODE_ACTIVE=true
fi
if [[ "$CURRENT_PERSONA_FROM_TRACKER" == "beta" ]] \
  || { [[ -z "$CURRENT_PERSONA_FROM_TRACKER" ]] && [[ "$AGENT" == "beta" ]]; }; then
  BETA_PERSONA_ACTIVE=true
fi

if [[ "$BETA_MODE_ACTIVE" == "true" ]] && [[ "$BETA_PERSONA_ACTIVE" == "true" ]]; then
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

  # Valid JSON with an incomplete authorization schema is not an active grant.
  # In particular, a missing expiry must never become an unbounded grant.
  if ! printf '%s' "$grant_json" | jq -e '
    type == "object" and
    (.grant_id | type == "string" and length > 0) and
    (.requester | type == "string" and length > 0) and
    (.files_granted | type == "array" and length > 0 and all(.[]; type == "string" and length > 0)) and
    (.expires_at | type == "string" and length > 0) and
    (.max_reads | type == "number" and . > 0 and floor == .) and
    (.reads_consumed | type == "number" and . >= 0 and floor == .)
  ' >/dev/null 2>&1; then
    continue
  fi

  grant_id="$(echo "$grant_json" | jq -r '.grant_id // ""')"
  requester="$(echo "$grant_json" | jq -r '.requester // ""')"
  expires_at="$(echo "$grant_json" | jq -r '.expires_at // ""')"
  max_reads="$(echo "$grant_json" | jq -r '.max_reads // 0')"
  reads_consumed="$(echo "$grant_json" | jq -r '.reads_consumed // 0')"

  # Check requester matches this agent
  [[ "$requester" == "$AGENT" ]] || continue

  # Check path is in files_granted
  path_match="$(echo "$grant_json" | jq -r --arg p "$TARGET_PATH" '
    .files_granted[]? as $granted | select(
      $granted == $p or
      (($granted | endswith("/**")) and
        ($p | startswith($granted[0:-2]))) or
      (($granted | endswith("/*")) and
        ($p | startswith($granted[0:-1])) and
        ($p[($granted[0:-1] | length):] | test("^[^/]+$")))
    ) | $granted' 2>/dev/null | head -1)"
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
