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

# Lint gate: per-slice, not repo-wide.
# Contract: this hook lints only the files touched by the current change set.
# The repo-wide lint floor lives in CI (.github/workflows/ci.yml), so scoping
# here does not remove enforcement — it removes the false-block from pre-existing
# debt in untouched files.
lint_files="$(git diff HEAD --name-only --diff-filter=ACM 2>/dev/null \
  | grep -E '\.(ts|tsx|js|jsx|mjs|cjs)$' || true)"
if [[ -z "$lint_files" ]]; then
  echo "  pass: lint (no lintable files in change set)" | tee -a "$LOG"
else
  # shellcheck disable=SC2086 — word-splitting is intentional here (one file per token)
  run_step "lint" npx --silent eslint $lint_files
fi

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
