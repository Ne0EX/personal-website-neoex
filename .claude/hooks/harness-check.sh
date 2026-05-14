#!/usr/bin/env bash
# .claude/hooks/harness-check.sh
# Usage: bash .claude/hooks/harness-check.sh
set -euo pipefail

CONFIG=".harness/worldline-harness.config.json"
LOG_DIR=".claude/hook-logs"
mkdir -p "$LOG_DIR"
TASK_ID="${WL_TASK_ID:-adhoc-$(date +%s)}"
LOG="$LOG_DIR/${TASK_ID}--harness.log"

if [[ ! -f "$CONFIG" ]]; then
  echo "harness: no config at $CONFIG — Canopus must define rails before this hook is useful" >&2
  exit 0  # report only
fi

echo "[harness] task=$TASK_ID" | tee "$LOG"

PASS=true

# Iterate every rail's check script and run it.
# Each check script returns 0 (pass) / 1 (fail) and prints a one-line summary to stdout.
while IFS=$'\t' read -r rail check; do
  if [[ -x "$check" ]]; then
    if output=$("$check" 2>&1); then
      echo "  [pass] $rail :: $output" | tee -a "$LOG"
    else
      echo "  [FAIL] $rail :: $output" | tee -a "$LOG" >&2
      PASS=false
    fi
  else
    echo "  [skip] $rail :: check script not executable: $check" | tee -a "$LOG"
  fi
done < <(jq -r '.rails | to_entries[] | "\(.key)\t\(.value.check)"' "$CONFIG")

if $PASS; then
  echo "[harness] PASS — all rails clean"
  exit 0
else
  echo "[harness] FAIL — fix the failing rails before signing your work" >&2
  exit 1
fi
