#!/usr/bin/env bash
# scripts/audit-rail-barrier-class.sh
#
# SPINE SENSOR — Impossible-not-tedious enforcement.
#
# Checks that every rail in .harness/worldline-harness.config.json satisfies
# the barrier_class contract:
#
#   Rule A: Every rail with mode=block MUST have barrier_class=HARD-BARRIER
#           OR appear in .harness/scope-waivers.json with a valid friction-waiver
#           (signed_by non-null).
#
#   Rule B: No LLM-judge rail may have mode=block unless it has thresholded=true
#           and a numeric threshold set (Constitutional-Classifiers exception).
#           Judge rails that lack thresholded=true must be mode=shadow or mode=warn.
#
#   Rule C: Every rail must have a barrier_class field (one of: HARD-BARRIER,
#           FRICTION-ONLY). Absent field = FAIL (treat as uncategorized = unsafe).
#
# Stub rails (status=stub) are exempt from Rule A — they may have
# barrier_class=FRICTION-ONLY with mode=warn without a waiver.
# They are NOT exempt from Rule C (must still have barrier_class field).
#
# Owner: Canopus · α-HRN-07
# Introduced: TASK-2026-06-01-SECURITY-HARNESS-WAVE-0-1
# Rail doc: docs/harness/RAIL-DEFINITIONS.md#rail-rail-barrier-class (the meta-rail)
#
# Exit codes:
#   0 — all rails pass
#   1 — one or more violations found (fail closed)
#   2 — config file missing or not parseable

set -euo pipefail

CONFIG="${HARNESS_CONFIG:-.harness/worldline-harness.config.json}"
WAIVERS="${HARNESS_WAIVERS:-.harness/scope-waivers.json}"
LOG_DIR=".claude/hook-logs"
TASK_ID="${WL_TASK_ID:-adhoc-$(date +%s)}"
LOG="$LOG_DIR/${TASK_ID}--audit-rail-barrier-class.log"

mkdir -p "$LOG_DIR"

# --- config sanity ---
if [[ ! -f "$CONFIG" ]]; then
  echo "[audit-rail-barrier-class] FAIL: config not found at $CONFIG" | tee "$LOG" >&2
  exit 2
fi
if ! jq empty "$CONFIG" 2>/dev/null; then
  echo "[audit-rail-barrier-class] FAIL: config is not valid JSON: $CONFIG" | tee "$LOG" >&2
  exit 2
fi

# --- load waivers (optional) ---
# A waiver entry must have: rail_key (string), reason (non-empty), signed_by (non-null non-empty)
waiver_signed_for() {
  local rail_key="$1"
  if [[ ! -f "$WAIVERS" ]]; then return 1; fi
  signed=$(jq -r --arg k "$rail_key" \
    '.waivers // [] | map(select(.rail_key == $k)) | .[0] | .signed_by // ""' \
    "$WAIVERS" 2>/dev/null || true)
  if [[ -n "$signed" && "$signed" != "null" ]]; then return 0; fi
  return 1
}

VIOLATIONS=0
CHECKED=0

{
  echo "[audit-rail-barrier-class] config=$CONFIG waivers=${WAIVERS:-none} task=$TASK_ID"
  echo ""

  # Iterate all rails
  while IFS=$'\t' read -r rail mode status barrier_class is_judge thresholded threshold; do
    CHECKED=$((CHECKED + 1))

    # Normalize nulls from jq
    mode="${mode:-null}"
    status="${status:-null}"
    barrier_class="${barrier_class:-null}"
    is_judge="${is_judge:-false}"
    thresholded="${thresholded:-false}"
    threshold="${threshold:-null}"

    rail_ok=true
    messages=()

    # Rule C: barrier_class must be present
    if [[ "$barrier_class" == "null" ]]; then
      messages+=("Rule C FAIL: missing barrier_class field (must be HARD-BARRIER or FRICTION-ONLY)")
      rail_ok=false
    elif [[ "$barrier_class" != "HARD-BARRIER" && "$barrier_class" != "FRICTION-ONLY" ]]; then
      messages+=("Rule C FAIL: invalid barrier_class='$barrier_class' (must be HARD-BARRIER or FRICTION-ONLY)")
      rail_ok=false
    fi

    # Rule A: mode=block rails must be HARD-BARRIER or have a signed waiver
    # Exemption: status=stub may have FRICTION-ONLY+mode=warn without waiver
    if [[ "$mode" == "block" ]]; then
      if [[ "$barrier_class" == "FRICTION-ONLY" ]]; then
        # Check for signed waiver
        if waiver_signed_for "$rail"; then
          messages+=("Rule A PASS (waiver): mode=block + FRICTION-ONLY + signed waiver present")
        else
          messages+=("Rule A FAIL: mode=block requires HARD-BARRIER or a signed FRICTION waiver in scope-waivers.json (got FRICTION-ONLY, no waiver)")
          rail_ok=false
        fi
      fi
    fi

    # Rule B: judge rails must not be mode=block unless thresholded
    if [[ "$is_judge" == "true" && "$mode" == "block" ]]; then
      if [[ "$thresholded" != "true" || "$threshold" == "null" ]]; then
        messages+=("Rule B FAIL: judge rail has mode=block but thresholded!=true or threshold not set (Constitutional-Classifiers exception requires both)")
        rail_ok=false
      fi
    fi

    if $rail_ok; then
      msg="PASS: mode=$mode barrier_class=$barrier_class status=$status"
      echo "  [pass] $rail :: $msg"
    else
      for m in "${messages[@]}"; do
        echo "  [FAIL] $rail :: $m" >&2
        echo "  [FAIL] $rail :: $m"
      done
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  done < <(jq -r '
    .rails | to_entries[] |
    [
      .key,
      (.value.mode // "null"),
      (.value.status // "null"),
      (.value.barrier_class // "null"),
      (if .value.judge then "true" else "false" end),
      (.value.thresholded // "false" | tostring),
      (.value.threshold // "null" | tostring)
    ] | @tsv
  ' "$CONFIG")

  echo ""
  echo "[audit-rail-barrier-class] checked=$CHECKED violations=$VIOLATIONS"

  if [[ $VIOLATIONS -gt 0 ]]; then
    echo "[audit-rail-barrier-class] FAIL — $VIOLATIONS rail(s) violate barrier_class contract" >&2
    echo "[audit-rail-barrier-class] FAIL — $VIOLATIONS rail(s) violate barrier_class contract"
    echo ""
    echo "How to fix:"
    echo "  Rule C violation: add barrier_class field to the rail in .harness/worldline-harness.config.json"
    echo "  Rule A violation: either change barrier_class to HARD-BARRIER, or add a signed"
    echo "                    friction-waiver entry to .harness/scope-waivers.json"
    echo "  Rule B violation: change mode from 'block' to 'shadow' or 'warn' for this judge rail,"
    echo "                    or add thresholded:true + a numeric threshold value"
  else
    echo "[audit-rail-barrier-class] PASS — all $CHECKED rails satisfy barrier_class contract"
  fi
} 2>&1 | tee "$LOG"

if [[ $VIOLATIONS -gt 0 ]]; then
  exit 1
fi
exit 0
