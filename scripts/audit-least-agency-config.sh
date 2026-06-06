#!/usr/bin/env bash
# scripts/audit-least-agency-config.sh
#
# Asserts the least-agency posture is wired. One hard assertion:
#
#   1. HOOK-WIRED: A blocking PreToolUse Bash hook is present in settings.json.
#      The hook must be .claude/hooks/mutating-action-hook.sh (or a successor
#      listed in the KNOWN_HOOKS array below). Absence = no runtime gate on
#      destructive bash patterns.
#
# NOTE (TASK-2026-06-06-CURL-WGET-UNBLOCK — Peat directive):
# The prior DENY-PRESENT assertion (curl AND wget must be in permissions.deny)
# has been REMOVED. curl/wget fetch verbs are now fully un-gated per Peat's
# explicit directive. The active controls are the hook (RCE floor + redirect/rm
# guards) and the permissions allow-list. An empty deny array is now an
# authorized posture. The hook-wired assertion remains because the runtime
# gate is still the load-bearing barrier for all other destructive patterns.
#
# Owner: Canopus · α-HRN-07
# Introduced: TASK-2026-06-01-SECURITY-HARNESS-WAVE-0-1
# Revised: TASK-2026-06-06-CURL-WGET-UNBLOCK (removed curl/wget deny assertion)
# Rail: least-agency-config (barrier_class=HARD-BARRIER, mode=block)
# Design: SECURITY-HARNESS-DESIGN-2026-06-01.md §3 "Least agency"
#
# Exit codes:
#   0 — assertion passes
#   1 — assertion fails (fail closed)
#
# SUBSHELL NOTE (do not regress):
# All violation-counting logic runs in the OUTER SHELL, not inside a
# { ... } | tee pipeline. A pipeline's left side runs in a subshell on
# most POSIX shells; mutations to VIOLATIONS inside a subshell are invisible
# to the outer shell. The fix is: collect output into OUTPUT_LINES, compute
# VIOLATIONS in the outer shell, then tee a single summary at the very end.
# See audit-permissions-nonempty.sh for the canonical reference pattern.

set -euo pipefail

SETTINGS="${WL_SETTINGS:-.claude/settings.json}"
LOG_DIR=".claude/hook-logs"
TASK_ID="${WL_TASK_ID:-adhoc-$(date +%s)}"
LOG="$LOG_DIR/${TASK_ID}--audit-least-agency-config.log"

mkdir -p "$LOG_DIR"

# Known mutating-action hook script paths (successors to the original)
KNOWN_HOOKS=(
  "mutating-action-hook.sh"
)

VIOLATIONS=0
# Accumulate output lines in this array; written to log and stdout at the end.
# Using an array avoids subshell variable-scope issues.
OUTPUT_LINES=()

OUTPUT_LINES+=("[audit-least-agency-config] settings=$SETTINGS task=$TASK_ID")
OUTPUT_LINES+=("")

if [[ ! -f "$SETTINGS" ]]; then
  OUTPUT_LINES+=("  [FAIL] settings file not found at $SETTINGS")
  VIOLATIONS=$((VIOLATIONS + 1))
elif ! jq empty "$SETTINGS" 2>/dev/null; then
  OUTPUT_LINES+=("  [FAIL] settings file is not valid JSON: $SETTINGS")
  VIOLATIONS=$((VIOLATIONS + 1))
else
  # --- Assertion (formerly #2): blocking PreToolUse Bash hook is present ---
  # NOTE: The prior DENY-PRESENT assertion for curl/wget has been removed per
  # TASK-2026-06-06-CURL-WGET-UNBLOCK (Peat directive). An empty deny array is
  # now an authorized posture. Hook-wired is the only remaining hard assertion.
  HOOK_FOUND=false
  for hook_name in "${KNOWN_HOOKS[@]}"; do
    # Check if any PreToolUse Bash hook command references this hook script
    COUNT=$(jq --arg h "$hook_name" '
      [.hooks.PreToolUse // [] |
       .[] |
       select(.matcher == "Bash" or .matcher == null) |
       .hooks // [] |
       .[] |
       .command |
       select(type == "string") |
       select(contains($h))] |
      length
    ' "$SETTINGS" 2>/dev/null || echo "0")
    if [[ "$COUNT" -gt 0 ]]; then
      OUTPUT_LINES+=("  [pass] hook-wired: blocking PreToolUse Bash hook found: $hook_name ($COUNT reference(s))")
      HOOK_FOUND=true
      break
    fi
  done

  if ! $HOOK_FOUND; then
    OUTPUT_LINES+=("  [FAIL] hook-wired: no blocking PreToolUse Bash hook found in settings.json")
    OUTPUT_LINES+=("         Expected one of: ${KNOWN_HOOKS[*]}")
    OUTPUT_LINES+=("         The mutating-action-hook.sh must be wired as a PreToolUse Bash hook.")
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
fi

OUTPUT_LINES+=("")
if [[ $VIOLATIONS -gt 0 ]]; then
  OUTPUT_LINES+=("[audit-least-agency-config] FAIL — $VIOLATIONS assertion(s) failed")
  OUTPUT_LINES+=("")
  OUTPUT_LINES+=("How to fix:")
  OUTPUT_LINES+=("  1. Ensure a PreToolUse Bash hook exists: bash .claude/hooks/mutating-action-hook.sh")
  OUTPUT_LINES+=("  2. Re-run: bash scripts/audit-least-agency-config.sh")
  OUTPUT_LINES+=("")
  OUTPUT_LINES+=("  Note: permissions.deny may be empty — that is now an authorized posture per")
  OUTPUT_LINES+=("  TASK-2026-06-06-CURL-WGET-UNBLOCK. The hook is the active barrier.")
else
  OUTPUT_LINES+=("[audit-least-agency-config] PASS — least-agency posture confirmed")
fi

# Write log and emit to stdout in one pass — tee is safe here because VIOLATIONS
# has already been computed in the outer shell above. This is the only pipeline.
printf '%s\n' "${OUTPUT_LINES[@]}" | tee "$LOG"

if [[ $VIOLATIONS -gt 0 ]]; then
  exit 1
fi
exit 0
