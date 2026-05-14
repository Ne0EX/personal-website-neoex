#!/usr/bin/env bash
# .claude/hooks/post-edit.sh
# Usage: bash .claude/hooks/post-edit.sh
set -euo pipefail

LOG_DIR=".claude/hook-logs"
mkdir -p "$LOG_DIR"
TASK_ID="${WL_TASK_ID:-adhoc-$(date +%s)}"
LOG="$LOG_DIR/${TASK_ID}--post-edit.log"

echo "[post-edit] task=$TASK_ID" | tee "$LOG"

FAIL=false

run_step() {
  local name="$1"; shift
  echo "[post-edit] running: $name" | tee -a "$LOG"
  if "$@" >>"$LOG" 2>&1; then
    echo "  pass: $name" | tee -a "$LOG"
  else
    echo "  FAIL: $name (see $LOG)" | tee -a "$LOG" >&2
    FAIL=true
  fi
}

run_step "lint"      npm run --silent lint
run_step "typecheck" npx --silent tsc --noEmit
run_step "build"     npm run --silent build

if $FAIL; then
  echo "[post-edit] FAIL — self-fix before signing. Do NOT submit broken work." >&2
  exit 1
fi

# UI-touch detection — if any file under app/ or components/ changed,
# require visual-diff.
if git diff --name-only --diff-filter=AM 2>/dev/null | grep -qE '^(app|components)/'; then
  echo "[post-edit] UI files changed — visual-diff is required before handoff."
  echo "[post-edit] Run: bash .claude/hooks/visual-diff.sh \"$TASK_ID\""
fi

echo "[post-edit] PASS"
exit 0
