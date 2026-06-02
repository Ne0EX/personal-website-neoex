#!/usr/bin/env bash
# scripts/audit-gauntlet-sub-pixel.sh
#
# Owner: Canopus (α-HRN-07) — TASK-2026-05-30-HARNESS-IS-OUGHT-SEPARATOR-B3B
# Rail: gauntlet-sub-pixel-detection
#
# Thin shell wrapper for audit-gauntlet-sub-pixel.ts
#
# Usage: bash scripts/audit-gauntlet-sub-pixel.sh <gallery_url>
#   gallery_url — URL of the soul-atom gallery to audit (must be served via HTTP)
#
# Environment:
#   MANIFEST_PATH — path to manifest.json (default: .claude/visual-diffs/soul-atlas/manifest.json)
#   VERBOSE — set to "true" for verbose stderr output
#
# Exit codes (mirrors TS script):
#   0 — all pairs >= 1x1px (GREEN)
#   1 — sub-pixel or zero-size violations (RED)
#   2 — input malformed / coverage assertion failed
#   3 — Playwright unavailable (WARN)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GALLERY_URL="${1:-http://localhost:8888}"
MANIFEST_PATH="${MANIFEST_PATH:-$REPO_ROOT/.claude/visual-diffs/soul-atlas/manifest.json}"
VERBOSE="${VERBOSE:-false}"

LOG_DIR="$REPO_ROOT/.claude/hook-logs"
mkdir -p "$LOG_DIR"
if [[ -n "${CLAUDE_TASK_ID:-}" ]]; then
  LOG_FILE="$LOG_DIR/${CLAUDE_TASK_ID}--gauntlet-sub-pixel.log"
else
  LOG_FILE="$LOG_DIR/gauntlet-sub-pixel--$(date -u +%Y%m%d-%H%M%S).log"
fi

echo "[gauntlet-sub-pixel] gallery_url=$GALLERY_URL" >&2
echo "[gauntlet-sub-pixel] manifest_path=$MANIFEST_PATH" >&2

INPUT_JSON=$(jq -n \
  --arg gallery_url "$GALLERY_URL" \
  --arg manifest "$MANIFEST_PATH" \
  --argjson verbose "$VERBOSE" \
  '{"gallery_url": $gallery_url, "manifest_path": $manifest, "verbose": $verbose}')

set +e
OUTPUT=$(echo "$INPUT_JSON" | npx tsx "$REPO_ROOT/scripts/audit-gauntlet-sub-pixel.ts" 2>&1)
EXIT_CODE=$?
set -e

echo "$OUTPUT" | tee -a "$LOG_FILE"

if [[ $EXIT_CODE -eq 0 ]]; then
  echo "[PASS] [gauntlet-sub-pixel] all atom x variant pairs render >= 1x1px" | tee -a "$LOG_FILE"
elif [[ $EXIT_CODE -eq 1 ]]; then
  echo "[FAIL] [gauntlet-sub-pixel] sub-pixel or zero-size violations found — see output above" | tee -a "$LOG_FILE"
elif [[ $EXIT_CODE -eq 3 ]]; then
  echo "[WARN] [gauntlet-sub-pixel] Playwright unavailable — check is skipped" | tee -a "$LOG_FILE"
  exit 3
else
  echo "[FAIL] [gauntlet-sub-pixel] exit code $EXIT_CODE — check stderr" | tee -a "$LOG_FILE"
fi

exit $EXIT_CODE
