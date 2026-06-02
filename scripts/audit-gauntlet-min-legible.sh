#!/usr/bin/env bash
# scripts/audit-gauntlet-min-legible.sh
#
# Owner: Canopus (α-HRN-07) — TASK-2026-05-30-HARNESS-IS-OUGHT-SEPARATOR-B3B
# Rail: gauntlet-min-legible-size
#
# Thin shell wrapper for audit-gauntlet-min-legible.ts
#
# Usage: bash scripts/audit-gauntlet-min-legible.sh <page_url>
#   page_url — URL of the rendered page to audit (must be served via HTTP)
#
# Exit codes (mirrors TS script):
#   0 — all elements at all breakpoints pass (GREEN)
#   1 — violations found (RED)
#   2 — input malformed / coverage assertion failed
#   3 — Playwright unavailable (WARN)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PAGE_URL="${1:-http://localhost:3000}"
VERBOSE="${VERBOSE:-false}"

LOG_DIR="$REPO_ROOT/.claude/hook-logs"
mkdir -p "$LOG_DIR"
if [[ -n "${CLAUDE_TASK_ID:-}" ]]; then
  LOG_FILE="$LOG_DIR/${CLAUDE_TASK_ID}--gauntlet-min-legible.log"
else
  LOG_FILE="$LOG_DIR/gauntlet-min-legible--$(date -u +%Y%m%d-%H%M%S).log"
fi

echo "[gauntlet-min-legible] page_url=$PAGE_URL" >&2

INPUT_JSON=$(jq -n \
  --arg page_url "$PAGE_URL" \
  --argjson verbose "$VERBOSE" \
  '{"page_url": $page_url, "verbose": $verbose}')

set +e
OUTPUT=$(echo "$INPUT_JSON" | npx tsx "$REPO_ROOT/scripts/audit-gauntlet-min-legible.ts" 2>&1)
EXIT_CODE=$?
set -e

echo "$OUTPUT" | tee -a "$LOG_FILE"

if [[ $EXIT_CODE -eq 0 ]]; then
  echo "[PASS] [gauntlet-min-legible] all elements pass legibility floor at all 4 breakpoints" | tee -a "$LOG_FILE"
elif [[ $EXIT_CODE -eq 1 ]]; then
  echo "[FAIL] [gauntlet-min-legible] legibility violations found — see output above" | tee -a "$LOG_FILE"
elif [[ $EXIT_CODE -eq 3 ]]; then
  echo "[WARN] [gauntlet-min-legible] Playwright unavailable — check is skipped" | tee -a "$LOG_FILE"
  exit 3
else
  echo "[FAIL] [gauntlet-min-legible] exit code $EXIT_CODE — check stderr" | tee -a "$LOG_FILE"
fi

exit $EXIT_CODE
