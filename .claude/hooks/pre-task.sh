#!/usr/bin/env bash
# .claude/hooks/pre-task.sh
# Usage: bash .claude/hooks/pre-task.sh <task_id> [agent_codename]
set -euo pipefail

TASK_ID="${1:-}"
AGENT="${2:-${WL_AGENT:-unknown}}"
LOG_DIR=".claude/hook-logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/${TASK_ID}--pre-task.log"

if [[ -z "$TASK_ID" ]]; then
  echo "pre-task: missing TASK_ID. usage: pre-task.sh <task_id> [agent]" >&2
  exit 2
fi

# Accept either the canonical short form (TASK-<id>.md) or a descriptive long form
# (TASK-<id>-<slug>.md). Polaris sometimes names the file with a descriptive suffix
# for readability; the harness treats both as valid assignment evidence.
ASSIGNMENT=""
ASSIGNMENT_CANONICAL=".claude/handoffs/from-polaris/${TASK_ID}.md"
if [[ -f "$ASSIGNMENT_CANONICAL" ]]; then
  ASSIGNMENT="$ASSIGNMENT_CANONICAL"
else
  # Look for a descriptive variant: TASK-<id>-<slug>.md
  ASSIGNMENT_LONG=$(find ".claude/handoffs/from-polaris" -maxdepth 1 -name "${TASK_ID}-*.md" 2>/dev/null | head -1 || true)
  if [[ -n "$ASSIGNMENT_LONG" ]]; then
    ASSIGNMENT="$ASSIGNMENT_LONG"
  fi
fi
if [[ -z "$ASSIGNMENT" ]]; then
  echo "pre-task: no assignment found at $ASSIGNMENT_CANONICAL (or ${TASK_ID}-<slug>.md)" >&2
  echo "         Polaris issues every task. If this is a self-initiated edit," >&2
  echo "         stop and request an assignment via a handoff to Polaris." >&2
  exit 3
fi

REQUIRED_READS=(
  ".claude/AGENTS.md"
  ".claude/agents/${AGENT}.md"
  "docs/team/QUALITY-BAR.md"
  "docs/team/FILE-OWNERSHIP.md"
  "$ASSIGNMENT"
)

echo "[pre-task] task=$TASK_ID agent=$AGENT" | tee "$LOG"
echo "[pre-task] required reads:" | tee -a "$LOG"
for f in "${REQUIRED_READS[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "  MISSING: $f" | tee -a "$LOG" >&2
    exit 4
  fi
  echo "  ok: $f" | tee -a "$LOG"
done

# Extract this agent's territory from FILE-OWNERSHIP.md and report it
echo "[pre-task] your territory for this task:" | tee -a "$LOG"
awk -v agent="$AGENT" '
  $0 ~ "^## " agent " ·" { in_block=1; next }
  in_block && /^## / { in_block=0 }
  in_block && /^- / { print "  " $0 }
' docs/team/FILE-OWNERSHIP.md | tee -a "$LOG"

# Baseline snapshot — record sha256 of every currently-dirty file so
# sign-work.sh can distinguish carry-over dirty files from files this task touches.
# Also record untracked files so sign-work.sh can exclude pre-existing untracked
# carry-overs (files that were already untracked before this task started).
BASELINE_FILE="$LOG_DIR/${TASK_ID}--baseline.json"
echo "[pre-task] recording dirty-file baseline → $BASELINE_FILE" | tee -a "$LOG"

# Collect all tracked files that are currently modified vs HEAD (staged or unstaged).
# --diff-filter=AMD: Added, Modified, Deleted (no Renamed — those are two entries).
TRACKED_ENTRIES=$(git diff --name-only --diff-filter=AMD HEAD 2>/dev/null \
  | sort \
  | while read -r f; do
      if [[ -f "$f" ]]; then
        h=$(sha256sum "$f" | awk '{print $1}')
      else
        # Deleted file — record sentinel so sign-work knows it was gone at task start
        h="DELETED"
      fi
      jq -n --arg p "$f" --arg h "$h" '{($p): $h}'
    done \
  | jq -s 'add // {}')

# Collect all currently untracked files (not staged, not tracked, not gitignored).
# Record their sha256 hashes so sign-work.sh can detect if an untracked carry-over
# was subsequently modified by this task (hash change = task touched it).
UNTRACKED_ENTRIES=$(git ls-files --others --exclude-standard 2>/dev/null \
  | sort \
  | while read -r f; do
      if [[ -f "$f" ]]; then
        h=$(sha256sum "$f" | awk '{print $1}')
      else
        h="DELETED"
      fi
      jq -n --arg p "$f" --arg h "$h" '{($p): $h}'
    done \
  | jq -s 'add // {}')

# Merge tracked and untracked entries into one baseline map
BASELINE_JSON=$(jq -n \
  --argjson tracked "$TRACKED_ENTRIES" \
  --argjson untracked "$UNTRACKED_ENTRIES" \
  --arg task_id "$TASK_ID" \
  --arg agent "$AGENT" \
  '{recorded_at: now | todate, task_id: $task_id, agent: $agent, files: ($tracked + $untracked)}')

echo "$BASELINE_JSON" > "$BASELINE_FILE"
BASELINE_COUNT=$(echo "$BASELINE_JSON" | jq '.files | length')
TRACKED_COUNT=$(echo "$TRACKED_ENTRIES" | jq 'length')
UNTRACKED_COUNT=$(echo "$UNTRACKED_ENTRIES" | jq 'length')
echo "[pre-task] baseline: $TRACKED_COUNT tracked dirty + $UNTRACKED_COUNT untracked (total $BASELINE_COUNT) carry-over file(s) recorded" | tee -a "$LOG"

echo "[pre-task] PASS — proceed with the assigned slice. Reach for files outside your territory only via handoff."
exit 0
