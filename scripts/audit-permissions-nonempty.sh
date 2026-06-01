#!/usr/bin/env bash
# scripts/audit-permissions-nonempty.sh
#
# HARD gate: fails if .claude/settings.json has no permissions block, an empty
# permissions block, or a deny array with zero entries.
#
# An absent or empty permissions.deny means every tool is implicitly allowed —
# the P3 least-privilege gap (SECURITY-HARNESS-DESIGN-2026-06-01 §3 Control Matrix).
#
# This script:
#   1. Asserts .claude/settings.json exists.
#   2. Asserts .permissions key is present and not null.
#   3. Asserts .permissions.deny is present, is an array, and has >= 1 entry.
#
# Owner: Canopus · α-HRN-07
# Introduced: TASK-2026-06-01-SECURITY-HARNESS-WAVE-0-1
# Rail: permissions-nonempty (barrier_class=HARD-BARRIER, mode=block)
# Design: SECURITY-HARNESS-DESIGN-2026-06-01.md §3 "P3 Least privilege"
#
# Exit codes:
#   0 — permissions block present and non-empty
#   1 — permissions block absent, empty, or deny array is empty/missing

set -euo pipefail

SETTINGS="${WL_SETTINGS:-.claude/settings.json}"
LOG_DIR=".claude/hook-logs"
TASK_ID="${WL_TASK_ID:-adhoc-$(date +%s)}"
LOG="$LOG_DIR/${TASK_ID}--audit-permissions-nonempty.log"

mkdir -p "$LOG_DIR"

fail() {
  local msg="$1"
  echo "[audit-permissions-nonempty] FAIL: $msg" | tee "$LOG" >&2
  echo ""
  echo "How to fix: .claude/settings.json must have a non-empty permissions.deny array."
  echo "Example minimum:"
  echo '  {"permissions": {"deny": ["Bash(curl *)", "Bash(wget *)"]}, ...}'
  echo ""
  echo "See docs/harness/RAIL-DEFINITIONS.md#rail-permissions-nonempty for the full rationale."
  exit 1
}

if [[ ! -f "$SETTINGS" ]]; then
  fail "settings file not found at $SETTINGS"
fi

if ! jq empty "$SETTINGS" 2>/dev/null; then
  fail "settings file is not valid JSON: $SETTINGS"
fi

# Check .permissions key exists
PERMS=$(jq '.permissions' "$SETTINGS" 2>/dev/null || true)
if [[ -z "$PERMS" || "$PERMS" == "null" ]]; then
  fail "'.permissions' key is absent or null in $SETTINGS — deny-default posture is not established"
fi

# Check .permissions.deny is present and non-empty
DENY=$(jq '.permissions.deny // empty' "$SETTINGS" 2>/dev/null || true)
if [[ -z "$DENY" || "$DENY" == "null" ]]; then
  fail "'.permissions.deny' is absent in $SETTINGS — no deny rules; all tools are implicitly allowed"
fi

DENY_COUNT=$(jq '.permissions.deny | length' "$SETTINGS" 2>/dev/null || echo "0")
if [[ "$DENY_COUNT" -eq 0 ]]; then
  fail "'.permissions.deny' exists but is empty ([]) — add at least one deny rule (e.g., curl/wget block)"
fi

echo "[audit-permissions-nonempty] PASS: $SETTINGS has permissions.deny with $DENY_COUNT rule(s)" | tee "$LOG"
exit 0
