#!/usr/bin/env bash
# .claude/hooks/auto-baseline.sh
# PostToolUse Write|Edit|MultiEdit hook — auto-captures the dirty-file baseline on
# first edit of a task session, so sign-work.sh can filter carry-overs even when
# the agent did not invoke pre-task.sh manually.
#
# Contract:
#   - NO-OP when TASK_ID is empty (casual / non-task session).
#   - IDEMPOTENT: never overwrites an existing baseline file.
#   - FAIL-OPEN: every fallible op uses || true; baseline failure must never abort the edit chain.
#   - Does NOT use -e (set -uo pipefail only) — an observer hook must not abort the chain on error.
#
# Wiring (emitted by Canopus settings_wiring — NOT done by this script):
#   PostToolUse · matcher: Write|Edit|MultiEdit · command: bash .claude/hooks/auto-baseline.sh
#
# See docs/harness/RAIL-DEFINITIONS.md § "Rail: auto-baseline (Phase 0 · slice 0.1)"

set -uo pipefail

# ------------------------------------------------------------------
# 1. Anchor to repo root.
# ------------------------------------------------------------------
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$REPO_ROOT"

# ------------------------------------------------------------------
# 2. Resolve TASK_ID. Empty → casual/non-task session → no-op.
# ------------------------------------------------------------------
TASK_ID="${WL_TASK_ID:-${CLAUDE_TASK_ID:-}}"
if [[ -z "$TASK_ID" ]]; then
  exit 0
fi

# ------------------------------------------------------------------
# 3. Resolve AGENT.
# ------------------------------------------------------------------
AGENT="${WL_AGENT:-unknown}"

# ------------------------------------------------------------------
# 4. Idempotency guard — never overwrite an existing baseline.
#    This is the load-bearing guarantee: whether written by pre-task.sh
#    or a prior auto-capture, the first baseline wins.
# ------------------------------------------------------------------
LOG_DIR=".claude/hook-logs"
mkdir -p "$LOG_DIR" 2>/dev/null || true
BASELINE_FILE="${LOG_DIR}/${TASK_ID}--baseline.json"
AUTO_LOG="${LOG_DIR}/${TASK_ID}--auto-baseline.log"

if [[ -f "$BASELINE_FILE" ]]; then
  exit 0
fi

# ------------------------------------------------------------------
# 5. Capture baseline — exact same logic as pre-task.sh lines 71-113.
#    Schema must be byte-identical: sign-work.sh reads .files as a
#    path→hash map and any schema drift silently breaks carry-over
#    filtering.
# ------------------------------------------------------------------

# Collect all tracked files that are currently modified vs HEAD (staged or unstaged).
# --diff-filter=AMD: Added, Modified, Deleted (no Renamed — those are two entries).
TRACKED_ENTRIES=$(git diff --name-only --diff-filter=AMD HEAD 2>/dev/null \
  | sort \
  | while read -r f; do
      if [[ -f "$f" ]]; then
        h=$(sha256sum "$f" 2>/dev/null | awk '{print $1}') || h="ERROR"
      else
        # Deleted file — record sentinel so sign-work knows it was gone at task start
        h="DELETED"
      fi
      jq -n --arg p "$f" --arg h "$h" '{($p): $h}' 2>/dev/null || true
    done \
  | jq -s 'add // {}' 2>/dev/null) || TRACKED_ENTRIES="{}"

# Collect all currently untracked files (not staged, not tracked, not gitignored).
# Record their sha256 hashes so sign-work.sh can detect if an untracked carry-over
# was subsequently modified by this task (hash change = task touched it).
UNTRACKED_ENTRIES=$(git ls-files --others --exclude-standard 2>/dev/null \
  | sort \
  | while read -r f; do
      if [[ -f "$f" ]]; then
        h=$(sha256sum "$f" 2>/dev/null | awk '{print $1}') || h="ERROR"
      else
        h="DELETED"
      fi
      jq -n --arg p "$f" --arg h "$h" '{($p): $h}' 2>/dev/null || true
    done \
  | jq -s 'add // {}' 2>/dev/null) || UNTRACKED_ENTRIES="{}"

# Merge tracked and untracked entries into one baseline map
BASELINE_JSON=$(jq -n \
  --argjson tracked "$TRACKED_ENTRIES" \
  --argjson untracked "$UNTRACKED_ENTRIES" \
  --arg task_id "$TASK_ID" \
  --arg agent "$AGENT" \
  '{recorded_at: now | todate, task_id: $task_id, agent: $agent, files: ($tracked + $untracked)}' \
  2>/dev/null) || true

# Write the baseline file only if we produced valid JSON
if [[ -n "${BASELINE_JSON:-}" ]]; then
  printf '%s\n' "$BASELINE_JSON" > "$BASELINE_FILE" 2>/dev/null || true
  BASELINE_COUNT=$(printf '%s\n' "$BASELINE_JSON" | jq '.files | length' 2>/dev/null || echo "?")
  printf '[auto-baseline] task=%s agent=%s files=%s → %s\n' \
    "$TASK_ID" "$AGENT" "$BASELINE_COUNT" "$BASELINE_FILE" >> "$AUTO_LOG" 2>/dev/null || true
else
  printf '[auto-baseline] task=%s agent=%s ERROR — jq failed, baseline not written\n' \
    "$TASK_ID" "$AGENT" >> "$AUTO_LOG" 2>/dev/null || true
fi

# ------------------------------------------------------------------
# 7. Always exit 0 — observer hooks must never abort the edit chain.
# ------------------------------------------------------------------
exit 0
