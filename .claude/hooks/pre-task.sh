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

ASSIGNMENT=".claude/handoffs/from-polaris/${TASK_ID}.md"
if [[ ! -f "$ASSIGNMENT" ]]; then
  echo "pre-task: no assignment found at $ASSIGNMENT" >&2
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
BASELINE_FILE="$LOG_DIR/${TASK_ID}--baseline.json"
echo "[pre-task] recording dirty-file baseline → $BASELINE_FILE" | tee -a "$LOG"

# Collect all files that are currently modified vs HEAD (staged or unstaged).
# --diff-filter=AMD: Added, Modified, Deleted (no Renamed — those are two entries).
BASELINE_JSON=$(git diff --name-only --diff-filter=AMD HEAD 2>/dev/null \
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
  | jq -s '{recorded_at: now | todate, task_id: "'"$TASK_ID"'", agent: "'"$AGENT"'", files: (add // {})}')

echo "$BASELINE_JSON" > "$BASELINE_FILE"
BASELINE_COUNT=$(echo "$BASELINE_JSON" | jq '.files | length')
echo "[pre-task] baseline: $BASELINE_COUNT carry-over dirty file(s) recorded" | tee -a "$LOG"

echo "[pre-task] PASS — proceed with the assigned slice. Reach for files outside your territory only via handoff."
exit 0
