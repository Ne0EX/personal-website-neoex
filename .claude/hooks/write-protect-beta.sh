#!/usr/bin/env bash
# .claude/hooks/write-protect-beta.sh
# PostToolUse hook — enforces write-protection for .claude/beta/** files.
#
# Purpose
# -------
# Beta's primary memory text is write-protected against non-Beta agents.
# Non-Beta agents may only write inside explicitly-delimited "calibration
# blocks" that they own. Beta (BETA_PERSONA_LOADED=1) writes freely anywhere
# in .claude/beta/**.
#
# Calibration block delimiter spec (Vega V1 — ground truth):
#   BLOCK_START:  ^— calibration · ([a-z]+) · (\d{4}-\d{2}-\d{2}) —$
#   BLOCK_END:    ^—$
#
# Algorithm
# ---------
# For each file under .claude/beta/** that was written or edited:
#   1. Parse calibration blocks: build a flat file mapping line_num → owner
#   2. Compute which lines in the new content differ from HEAD (unified diff)
#   3. For each changed line:
#      a. If inside own block → ALLOW
#      b. If inside another agent's block → BLOCK
#      c. If outside any block AND caller != beta → BLOCK
#   4. BETA_PERSONA_LOADED=1 → skip all checks, allow
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
# BYPASS: Beta persona active
# --------------------------------------------------------------------------
if [[ "${BETA_PERSONA_LOADED:-0}" == "1" ]]; then
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

# --------------------------------------------------------------------------
# check_file <path>
# Returns 0 = PASS, 1 = BLOCK
# --------------------------------------------------------------------------
check_file() {
  local file_path="$1"
  local normalized="${file_path#./}"

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

  # --------------------------------------------------------------------------
  # Parse calibration blocks in CURRENT file.
  # Write a flat map: line_num<TAB>owner (empty owner = not in block)
  # Using a temp file to avoid associative arrays (bash 3.2 compat).
  # --------------------------------------------------------------------------
  BLOCK_MAP="$TMP_DIR/block-map"
  > "$BLOCK_MAP"

  local current_owner=""
  local line_num=0
  while IFS= read -r line; do
    line_num=$(( line_num + 1 ))
    if LC_ALL=C grep -qE "$BLOCK_START_RE" <<< "$line" 2>/dev/null; then
      current_owner="$(LC_ALL=C grep -oE "$BLOCK_START_RE" <<< "$line" \
        | LC_ALL=C sed -E 's/^— calibration · ([a-z]+) · .*/\1/' 2>/dev/null || echo "")"
    elif LC_ALL=C grep -qE "$BLOCK_END_RE" <<< "$line" 2>/dev/null && [[ -n "$current_owner" ]]; then
      current_owner=""
    fi
    printf '%s\t%s\n' "$line_num" "$current_owner" >> "$BLOCK_MAP"
  done < "$CURRENT_FILE"

  # --------------------------------------------------------------------------
  # Identify changed line numbers in the NEW (current) file using unified diff.
  # Parse @@ hunk headers: "+<start>[,<count>]" gives new-file line ranges.
  # --------------------------------------------------------------------------
  CHANGED_LINES_FILE="$TMP_DIR/changed-lines"
  > "$CHANGED_LINES_FILE"

  diff -u "$HEAD_FILE" "$CURRENT_FILE" 2>/dev/null \
    | grep -E '^@@' \
    | while IFS= read -r hunk_header; do
        start_count="$(echo "$hunk_header" | grep -oE '\+[0-9]+(,[0-9]+)?' | head -1 | tr -d '+')"
        [[ -z "$start_count" ]] && continue
        start="${start_count%%,*}"
        if echo "$start_count" | grep -q ','; then
          count="${start_count##*,}"
        else
          count="1"
        fi
        i=0
        while [[ "$i" -lt "$count" ]]; do
          echo $(( start + i ))
          i=$(( i + 1 ))
        done
      done | sort -un > "$CHANGED_LINES_FILE" 2>/dev/null || true

  # If no changed lines found, pass (can happen with context-only hunks)
  if [[ ! -s "$CHANGED_LINES_FILE" ]]; then
    printf '[write-protect] PASS (no changed lines in diff): %s\n' "$normalized" | tee -a "$LOG"
    return 0
  fi

  # --------------------------------------------------------------------------
  # Check each changed line against block map
  # --------------------------------------------------------------------------
  VIOLATIONS_FILE="$TMP_DIR/violations"
  > "$VIOLATIONS_FILE"

  while IFS= read -r lnum; do
    [[ -z "$lnum" ]] && continue
    # Look up owner for this line number in block map
    owner="$(grep -E "^${lnum}	" "$BLOCK_MAP" | cut -f2 || echo "")"

    if [[ -z "$owner" ]]; then
      # Outside any calibration block — primary text
      printf 'line %s: outside calibration block (primary text) — only Beta may write here\n' "$lnum" >> "$VIOLATIONS_FILE"
    elif [[ "$owner" != "$AGENT" ]]; then
      # Inside another agent's block
      printf 'line %s: inside calibration block owned by '"'"'%s'"'"' — only '"'"'%s'"'"' may write here\n' \
        "$lnum" "$owner" "$owner" >> "$VIOLATIONS_FILE"
    fi
    # else: inside own block → allowed
  done < "$CHANGED_LINES_FILE"

  if [[ -s "$VIOLATIONS_FILE" ]]; then
    VCOUNT="$(wc -l < "$VIOLATIONS_FILE" | tr -d ' ')"
    printf '[write-protect] BLOCKED — %s violation(s) in %s:\n' "$VCOUNT" "$normalized" | tee -a "$LOG" >&2
    while IFS= read -r v; do
      printf '  %s\n' "$v" | tee -a "$LOG" >&2
    done < "$VIOLATIONS_FILE"
    printf '[write-protect] FIX: revert this edit.\n' | tee -a "$LOG" >&2
    printf '[write-protect] To add a calibration note, wrap it in:\n' | tee -a "$LOG" >&2
    printf '[write-protect]   — calibration · %s · %s —\n' "$AGENT" "$(date +%Y-%m-%d)" | tee -a "$LOG" >&2
    printf '[write-protect]   <your content>\n' | tee -a "$LOG" >&2
    printf '[write-protect]   —\n' | tee -a "$LOG" >&2
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
