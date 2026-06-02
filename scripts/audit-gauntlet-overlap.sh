#!/usr/bin/env bash
# scripts/audit-gauntlet-overlap.sh
#
# Owner: Canopus (α-HRN-07) — TASK-2026-05-30-HARNESS-IS-OUGHT-SEPARATOR-B3B
# Rail: gauntlet-overlap-composition
#
# Thin shell wrapper for audit-gauntlet-overlap.ts
#
# Usage: bash scripts/audit-gauntlet-overlap.sh <page_url>
#   page_url — URL of the rendered page to audit (must be served via HTTP)
#
# Environment:
#   ALLOWED_OVERLAPS — path to allowed-overlaps.json (default: .harness/allowed-overlaps.json)
#   VERBOSE — set to "true" for verbose stderr output
#
# Exit codes (mirrors TS script):
#   0 — no unlisted overlaps (GREEN)
#   1 — unlisted overlaps found (RED)
#   2 — input malformed / file unreadable
#   3 — Playwright unavailable (WARN — does not block handoff alone)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PAGE_URL="${1:-http://localhost:3000}"
ALLOWED_OVERLAPS="${ALLOWED_OVERLAPS:-$REPO_ROOT/.harness/allowed-overlaps.json}"
VERBOSE="${VERBOSE:-false}"

LOG_DIR="$REPO_ROOT/.claude/hook-logs"
mkdir -p "$LOG_DIR"
if [[ -n "${CLAUDE_TASK_ID:-}" ]]; then
  LOG_FILE="$LOG_DIR/${CLAUDE_TASK_ID}--gauntlet-overlap.log"
else
  LOG_FILE="$LOG_DIR/gauntlet-overlap--$(date -u +%Y%m%d-%H%M%S).log"
fi

echo "[gauntlet-overlap] page_url=$PAGE_URL" >&2
echo "[gauntlet-overlap] allowed_overlaps=$ALLOWED_OVERLAPS" >&2

INPUT_JSON=$(jq -n \
  --arg page_url "$PAGE_URL" \
  --arg allowed "$ALLOWED_OVERLAPS" \
  --argjson verbose "$VERBOSE" \
  '{"page_url": $page_url, "allowed_overlaps_path": $allowed, "verbose": $verbose}')

set +e
OUTPUT=$(echo "$INPUT_JSON" | npx tsx "$REPO_ROOT/scripts/audit-gauntlet-overlap.ts" 2>&1)
EXIT_CODE=$?
set -e

echo "$OUTPUT" | tee -a "$LOG_FILE"

if [[ $EXIT_CODE -eq 0 ]]; then
  echo "[PASS] [gauntlet-overlap] no unlisted z-index overlaps" | tee -a "$LOG_FILE"
elif [[ $EXIT_CODE -eq 1 ]]; then
  echo "[FAIL] [gauntlet-overlap] unlisted overlaps found — see output above" | tee -a "$LOG_FILE"
elif [[ $EXIT_CODE -eq 3 ]]; then
  echo "[WARN] [gauntlet-overlap] Playwright unavailable — check is skipped" | tee -a "$LOG_FILE"
  exit 3
else
  echo "[FAIL] [gauntlet-overlap] exit code $EXIT_CODE — check stderr" | tee -a "$LOG_FILE"
fi

exit $EXIT_CODE
