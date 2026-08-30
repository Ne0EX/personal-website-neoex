#!/usr/bin/env bash
# .claude/hooks/write-protect-beta.sh
# PostToolUse hook — enforces write-protection for .claude/beta/** files.
#
# Purpose
# -------
# Beta's primary memory text is write-protected against non-Beta agents.
# Non-Beta agents may only write inside explicitly-delimited "calibration
# blocks" that they own. In beta mode, the active Beta persona writes freely
# in .claude/beta/**.
#
# Calibration block delimiter spec (Vega V1 — ground truth):
#   BLOCK_START:  ^— calibration · ([a-z]+) · (\d{4}-\d{2}-\d{2}) —$
#   BLOCK_END:    ^—$
#
# Algorithm
# ---------
# For each file under .claude/beta/** that was written or edited:
#   1. Parse complete calibration blocks in HEAD and current content
#   2. Remove only caller-owned blocks from both protected projections
#   3. Require the protected projections to remain byte-for-byte equivalent
#   4. Beta-mode + active Beta persona → skip content checks, allow
#
# Failure mode
# ------------
# On BLOCK: print violation to stderr and exit 1 (PostToolUse fail-closed).
# The calling agent must revert the edit. Guidance is printed to stderr.
#
# Bash compatibility: uses temp files instead of associative arrays for
# bash 3.2 compatibility (macOS default bash). Requires: diff, git, jq.
#
# Idempotent: running twice on the same unchanged file produces the same result.
# Logs to: .claude/hook-logs/<task-id>--write-protect.log
#
# Called by: .claude/settings.json PostToolUse (matcher: Write|Edit|MultiEdit)
# Do not call directly.

set -euo pipefail

LOG_DIR=".claude/hook-logs"
mkdir -p "$LOG_DIR"
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd -P)"
BETA_DIR=".claude/beta"

TASK_ID="${CLAUDE_TASK_ID:-${WL_TASK_ID:-session-$(date +%s)}}"
AGENT="${WL_AGENT:-unknown}"
LOG="$LOG_DIR/${TASK_ID}--write-protect.log"
TIMESTAMP="$(date -u +%FT%TZ)"

# Temp dir for per-file scratch (cleaned up on exit)
TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t 'write-protect')"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

# --------------------------------------------------------------------------
# Parse tool input from stdin (PostToolUse passes JSON on stdin)
# --------------------------------------------------------------------------
INPUT="$(cat)"
TOOL_NAME="$(echo "$INPUT" | jq -r '.tool_name // "unknown"')"

# Extract the file path(s) touched — handles Write, Edit, MultiEdit shapes
extract_paths() {
  local json="$1"
  local tool="$2"
  case "$tool" in
    Write)
      echo "$json" | jq -r '.tool_input.file_path // ""'
      ;;
    Edit)
      echo "$json" | jq -r '.tool_input.file_path // ""'
      ;;
    MultiEdit)
      echo "$json" | jq -r '.tool_input.file_path // (.tool_input.edits[]?.file_path // "")' 2>/dev/null \
        | sort -u
      ;;
    *)
      echo ""
      ;;
  esac
}

case "$TOOL_NAME" in
  Write|Edit|MultiEdit) ;;
  *) exit 0 ;;
esac

# --------------------------------------------------------------------------
# BYPASS: Beta persona active in beta mode
# --------------------------------------------------------------------------
CURRENT_PERSONA_FILE=".claude/.current-persona"
CURRENT_PERSONA_FROM_TRACKER=""
SESSION_MODE_FROM_TRACKER=""
if [[ -f "$CURRENT_PERSONA_FILE" ]]; then
  CURRENT_PERSONA_FROM_TRACKER="$(jq -r '.persona // ""' "$CURRENT_PERSONA_FILE" 2>/dev/null || true)"
  SESSION_MODE_FROM_TRACKER="$(jq -r '.session_mode // ""' "$CURRENT_PERSONA_FILE" 2>/dev/null || true)"
  if [[ -z "$CURRENT_PERSONA_FROM_TRACKER" ]]; then
    CURRENT_PERSONA_FROM_TRACKER="$(head -1 "$CURRENT_PERSONA_FILE" 2>/dev/null || true)"
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
  printf '[write-protect] %s · beta-bypass · %s\n' "$TIMESTAMP" "$TOOL_NAME" >> "$LOG"
  exit 0
fi

# --------------------------------------------------------------------------
# Delimiter regexes (ERE for grep -E)
# Using LC_ALL=C to ensure byte-level matching; the delimiters use em-dash
# and middle-dot characters. On UTF-8 locales this works; LC_ALL=C is safer.
# --------------------------------------------------------------------------
BLOCK_START_RE='^— calibration · ([a-z]+) · ([0-9]{4}-[0-9]{2}-[0-9]{2}) —$'
BLOCK_END_RE='^—$'

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

  if [[ "$result" == "$BETA_DIR" ]] || [[ "$result" == "$BETA_DIR"/* ]]; then
    printf '%s\n' "$result"
    return 0
  fi

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

# --------------------------------------------------------------------------
# check_file <path>
# Returns 0 = PASS, 1 = BLOCK
# --------------------------------------------------------------------------
check_file() {
  local file_path="$1"
  local normalized
  normalized="$(normalize_target_path "$file_path")"

  # Only gate files under .claude/beta/
  if [[ "$normalized" != .claude/beta/* ]]; then
    return 0
  fi

  printf '[write-protect] checking: %s (agent=%s)\n' "$normalized" "$AGENT" | tee -a "$LOG"

  # File must exist after the write
  if [[ ! -f "$normalized" ]]; then
    printf '[write-protect] BLOCKED — %s does not exist after write (unexpected)\n' "$normalized" | tee -a "$LOG" >&2
    return 1
  fi

  # Get the HEAD version
  HEAD_FILE="$TMP_DIR/head-content"
  CURRENT_FILE="$TMP_DIR/current-content"
  if git cat-file -e "HEAD:$normalized" 2>/dev/null; then
    git show "HEAD:$normalized" > "$HEAD_FILE" 2>/dev/null || printf '' > "$HEAD_FILE"
  else
    printf '' > "$HEAD_FILE"
  fi
  cp "$normalized" "$CURRENT_FILE"

  # If content is unchanged vs HEAD (no-op write), pass
  if diff -q "$HEAD_FILE" "$CURRENT_FILE" >/dev/null 2>&1; then
    printf '[write-protect] PASS (no change vs HEAD): %s\n' "$normalized" | tee -a "$LOG"
    return 0
  fi

  # Compare the protected projection of HEAD and the current file. The
  # projection removes complete blocks owned by the caller and preserves every
  # primary-text line and every other agent's block. Equality therefore allows
  # edits/additions/removals only inside the caller's own complete blocks. It
  # also catches deletion-only edits and attempts to move a delimiter around
  # protected text, both of which line-number-only diff parsing can miss.
  build_protected_projection() {
    local source_file="$1"
    local output_file="$2"
    local current_owner=""
    local line=""

    : > "$output_file"
    while IFS= read -r line || [[ -n "$line" ]]; do
      if LC_ALL=C grep -qE "$BLOCK_START_RE" <<< "$line" 2>/dev/null; then
        # Nested starts make ownership ambiguous; reject the whole file.
        [[ -z "$current_owner" ]] || return 1
        current_owner="$(LC_ALL=C sed -E \
          's/^— calibration · ([a-z]+) · .*/\1/' <<< "$line" 2>/dev/null)"
        if [[ "$current_owner" != "$AGENT" ]]; then
          printf '%s\n' "$line" >> "$output_file"
        fi
      elif LC_ALL=C grep -qE "$BLOCK_END_RE" <<< "$line" 2>/dev/null \
        && [[ -n "$current_owner" ]]; then
        if [[ "$current_owner" != "$AGENT" ]]; then
          printf '%s\n' "$line" >> "$output_file"
        fi
        current_owner=""
      elif [[ "$current_owner" != "$AGENT" ]]; then
        printf '%s\n' "$line" >> "$output_file"
      fi
    done < "$source_file"

    # An unclosed block could absorb all following primary text, so fail closed.
    [[ -z "$current_owner" ]]
  }

  HEAD_PROTECTED="$TMP_DIR/head-protected"
  CURRENT_PROTECTED="$TMP_DIR/current-protected"
  if ! build_protected_projection "$HEAD_FILE" "$HEAD_PROTECTED" \
    || ! build_protected_projection "$CURRENT_FILE" "$CURRENT_PROTECTED"; then
    printf '[write-protect] BLOCKED — malformed or unclosed calibration block in %s\n' \
      "$normalized" | tee -a "$LOG" >&2
    return 1
  fi

  if ! diff -q "$HEAD_PROTECTED" "$CURRENT_PROTECTED" >/dev/null 2>&1; then
    printf '[write-protect] BLOCKED — protected primary text or another agent block changed in %s\n' \
      "$normalized" | tee -a "$LOG" >&2
    printf '[write-protect] FIX: revert this edit or use a complete block owned by %s.\n' \
      "$AGENT" | tee -a "$LOG" >&2
    return 1
  fi

  printf '[write-protect] PASS: %s\n' "$normalized" | tee -a "$LOG"
  return 0
}

# --------------------------------------------------------------------------
# Process all touched paths
# --------------------------------------------------------------------------
BLOCKED=false
PATHS="$(extract_paths "$INPUT" "$TOOL_NAME")"

while IFS= read -r fpath; do
  [[ -z "$fpath" ]] && continue
  if ! check_file "$fpath"; then
    BLOCKED=true
  fi
done <<< "$PATHS"

if $BLOCKED; then
  echo "write-protect: BLOCKED — revert the flagged edits and retry." >&2
  exit 1
fi

printf '[write-protect] %s · PASS\n' "$TIMESTAMP" >> "$LOG"
exit 0
