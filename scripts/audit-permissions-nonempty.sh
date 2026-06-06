#!/usr/bin/env bash
# scripts/audit-permissions-nonempty.sh
#
# Gate: asserts .claude/settings.json has a valid permissions block and an
# allow-list that is non-empty (establishes that tool-gating is configured).
#
# NOTE (TASK-2026-06-06-CURL-WGET-UNBLOCK — Peat directive):
# An empty permissions.deny is now an authorized posture. The prior hard-fail
# on deny.length == 0 has been downgraded to an informational pass. The active
# controls are the mutating-action-hook.sh (RCE floor + redirect/rm guards) and
# the permissions allow-list in settings.json, not the deny-list length.
# The .permissions block must still be present (establishing intent), and the
# allow-list must be non-empty (confirming explicit tool-gating is configured).
#
# This script:
#   1. Asserts .claude/settings.json exists.
#   2. Asserts .permissions key is present and not null.
#   3. If .permissions.deny is present and non-empty: reports count (informational).
#      If .permissions.deny is absent or empty: reports it as authorized (no fail).
#   4. Asserts .permissions.allow is present and has >= 1 entry (allow-list gating
#      is the primary access-control surface when deny-list is empty).
#
# Owner: Canopus · α-HRN-07
# Introduced: TASK-2026-06-01-SECURITY-HARNESS-WAVE-0-1
# Revised: TASK-2026-06-06-CURL-WGET-UNBLOCK (allow empty deny; check allow-list)
# Rail: permissions-nonempty (barrier_class=HARD-BARRIER, mode=block)
# Design: SECURITY-HARNESS-DESIGN-2026-06-01.md §3 "P3 Least privilege"
#
# Exit codes:
#   0 — permissions block present; allow-list non-empty
#   1 — permissions block absent/null, or allow-list missing/empty

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
  echo "How to fix: .claude/settings.json must have a .permissions block with a non-empty allow array."
  echo "Example minimum:"
  echo '  {"permissions": {"allow": ["Bash(git status)", "Bash(npm run *)"], "deny": []}, ...}'
  echo ""
  echo "Note: permissions.deny may be empty — that is an authorized posture per"
  echo "TASK-2026-06-06-CURL-WGET-UNBLOCK. The active barrier is mutating-action-hook.sh."
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

# Check .permissions.deny — informational only (empty deny is authorized per TASK-2026-06-06-CURL-WGET-UNBLOCK)
DENY_COUNT=$(jq '(.permissions.deny // []) | length' "$SETTINGS" 2>/dev/null || echo "0")
if [[ "$DENY_COUNT" -gt 0 ]]; then
  echo "[audit-permissions-nonempty] INFO: permissions.deny has $DENY_COUNT rule(s)" | tee -a "$LOG"
else
  # Empty deny is an authorized posture — the hook is the active barrier, not the deny-list.
  echo "[audit-permissions-nonempty] INFO: permissions.deny is empty or absent — authorized posture per TASK-2026-06-06-CURL-WGET-UNBLOCK" | tee -a "$LOG"
fi

# Check .permissions.allow is present and non-empty — this is the primary access-control
# surface when the deny-list is empty. An absent or empty allow-list means tool-gating
# is not configured and the permissions block is effectively a no-op.
ALLOW_COUNT=$(jq '(.permissions.allow // []) | length' "$SETTINGS" 2>/dev/null || echo "0")
if [[ "$ALLOW_COUNT" -eq 0 ]]; then
  fail "'.permissions.allow' is absent or empty in $SETTINGS — tool-gating is not configured; add explicit allow entries"
fi

echo "[audit-permissions-nonempty] PASS: $SETTINGS has permissions block with allow-list ($ALLOW_COUNT rule(s)); deny-list=$DENY_COUNT rule(s)" | tee "$LOG"
exit 0
