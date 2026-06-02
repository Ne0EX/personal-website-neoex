#!/usr/bin/env bash
# scripts/audit-axiom-gate-join-coverage.sh
#
# Thin shell wrapper for audit-axiom-gate-join-coverage.ts
#
# Owner: Canopus (α-HRN-07) — wired in TASK-2026-05-30-HARNESS-IS-OUGHT-SEPARATOR-B3B
# Rail:  axiom-gate-join-coverage (worldline-harness.config.json)
#
# Usage (standalone): bash scripts/audit-axiom-gate-join-coverage.sh [TODAY_ISO]
#   TODAY_ISO — optional ISO date override (YYYY-MM-DD) for simulating post-deadline runs
#               default: today's date (date -u +%F)
#
# Usage (via harness-check.sh): invoked automatically when axiom-gate-join-coverage rail applies.
#
# Exit codes (mirrors the TS script):
#   0 — all axiom↔gate pairs green
#   1 — bijection violations (red axioms or red gates)
#   2 — input malformed / file unreadable / coverage assertion failed
#
# Log output: written to .claude/hook-logs/<CLAUDE_TASK_ID>--axiom-gate-join-coverage.log
# (if CLAUDE_TASK_ID is set). Always emits structured JSON to stdout.
#
# Invocation pattern for tsx:
#   echo '{"registry_path":..., "harness_config_path":..., "today":..., "verbose":true}' \
#     | npx tsx scripts/audit-axiom-gate-join-coverage.ts
# The wrapper below constructs the JSON input and pipes it to the TS script.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REGISTRY="${REGISTRY_PATH:-$REPO_ROOT/.harness/axioms-v1.json}"
HARNESS_CFG="${HARNESS_CONFIG_PATH:-$REPO_ROOT/.harness/worldline-harness.config.json}"
TODAY="${1:-$(date -u +%F)}"
VERBOSE="${VERBOSE:-false}"

# Logging
LOG_DIR="$REPO_ROOT/.claude/hook-logs"
mkdir -p "$LOG_DIR"

if [[ -n "${CLAUDE_TASK_ID:-}" ]]; then
  LOG_FILE="$LOG_DIR/${CLAUDE_TASK_ID}--axiom-gate-join-coverage.log"
else
  LOG_FILE="$LOG_DIR/axiom-gate-join-coverage--$(date -u +%Y%m%d-%H%M%S).log"
fi

echo "[axiom-gate-join-coverage] registry=$REGISTRY" >&2
echo "[axiom-gate-join-coverage] harness_config=$HARNESS_CFG" >&2
echo "[axiom-gate-join-coverage] today=$TODAY" >&2

if [[ ! -f "$REGISTRY" ]]; then
  echo "[FAIL] [axiom-gate-join-coverage] registry not found: $REGISTRY" | tee -a "$LOG_FILE" >&2
  exit 2
fi
if [[ ! -f "$HARNESS_CFG" ]]; then
  echo "[FAIL] [axiom-gate-join-coverage] harness config not found: $HARNESS_CFG" | tee -a "$LOG_FILE" >&2
  exit 2
fi

INPUT_JSON=$(jq -n \
  --arg registry "$REGISTRY" \
  --arg harness "$HARNESS_CFG" \
  --arg today "$TODAY" \
  --argjson verbose "$VERBOSE" \
  '{"registry_path": $registry, "harness_config_path": $harness, "today": $today, "verbose": $verbose}')

# Run the TS audit; capture output and exit code
set +e
OUTPUT=$(echo "$INPUT_JSON" | npx tsx "$REPO_ROOT/scripts/audit-axiom-gate-join-coverage.ts" 2>&1)
EXIT_CODE=$?
set -e

echo "$OUTPUT" | tee -a "$LOG_FILE"

if [[ $EXIT_CODE -eq 0 ]]; then
  echo "[PASS] [axiom-gate-join-coverage] all axiom↔gate pairs green" | tee -a "$LOG_FILE"
elif [[ $EXIT_CODE -eq 1 ]]; then
  echo "[FAIL] [axiom-gate-join-coverage] bijection violations found — see output above" | tee -a "$LOG_FILE"
elif [[ $EXIT_CODE -eq 2 ]]; then
  echo "[FAIL] [axiom-gate-join-coverage] input malformed or coverage assertion failed" | tee -a "$LOG_FILE"
else
  echo "[FAIL] [axiom-gate-join-coverage] unexpected exit code: $EXIT_CODE" | tee -a "$LOG_FILE"
fi

exit $EXIT_CODE
