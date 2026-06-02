#!/usr/bin/env bash
# .claude/hooks/harness-check.sh
# Usage: bash .claude/hooks/harness-check.sh [--changed-files <file-list>]
#
# A1.3 SKIP-IS-RED: a [skip] on a rail whose applies_to matches the changed
# file set is now a FAIL, not a silent pass. A non-executable or missing check
# script on an applicable rail means the gate is missing — fail closed.
#
# --changed-files <file>  optional: path to a newline-delimited file listing
#   all files changed in this task. When provided, skips are classified against
#   applies_to patterns. When absent, ALL rails are treated as applicable (safe
#   default: no false-negative from a missing file list).
set -euo pipefail

CONFIG=".harness/worldline-harness.config.json"
LOG_DIR=".claude/hook-logs"
mkdir -p "$LOG_DIR"
TASK_ID="${WL_TASK_ID:-adhoc-$(date +%s)}"
LOG="$LOG_DIR/${TASK_ID}--harness.log"

CHANGED_FILES_ARG=""
if [[ "${1:-}" == "--changed-files" && -n "${2:-}" ]]; then
  CHANGED_FILES_ARG="$2"
fi

if [[ ! -f "$CONFIG" ]]; then
  echo "harness: no config at $CONFIG — Canopus must define rails before this hook is useful" >&2
  exit 0  # report only
fi

echo "[harness] task=$TASK_ID" | tee "$LOG"

PASS=true

# matches_applies_to <rail_key>
# Returns exit 0 (yes, rail is applicable) or 1 (not applicable, can truly skip).
# If --changed-files was not provided, always returns 0 (treat all rails as applicable).
# applies_to patterns from config are shell globs — we use `fnmatch`-style matching
# via bash's case statement.
matches_applies_to() {
  local rail_key="$1"
  local patterns
  patterns=$(jq -r --arg r "$rail_key" '.rails[$r].applies_to // ["**/*"] | .[]' "$CONFIG" 2>/dev/null || echo "**/*")

  if [[ -z "${CHANGED_FILES_ARG}" ]]; then
    # No changed-files list supplied — conservatively assume all rails apply
    return 0
  fi

  if [[ ! -f "${CHANGED_FILES_ARG}" ]]; then
    # Can't read the file list — conservatively assume rail applies
    return 0
  fi

  while IFS= read -r pattern; do
    [[ -z "$pattern" ]] && continue
    # Read every changed file; if any matches the pattern, the rail applies
    while IFS= read -r changed_file; do
      [[ -z "$changed_file" ]] && continue
      # Use bash glob matching via case
      case "$changed_file" in
        $pattern) return 0 ;;
        *) : ;;
      esac
    done < "${CHANGED_FILES_ARG}"
  done <<< "$patterns"

  return 1  # no changed file matched any applies_to pattern
}

# Iterate every rail's check script and run it.
# Each check script returns 0 (pass) / 1 (fail) and prints a one-line summary to stdout.
# A1.3: a skip on an APPLICABLE rail = FAIL (not silent pass).
while IFS=$'\t' read -r rail check; do
  if [[ -x "$check" ]]; then
    if output=$("$check" 2>&1); then
      echo "  [pass] $rail :: $output" | tee -a "$LOG"
    else
      echo "  [FAIL] $rail :: $output" | tee -a "$LOG" >&2
      PASS=false
    fi
  else
    # Script is not executable (missing, not found, or has no +x bit).
    # A1.3: determine if this rail applies to the changed file set.
    if matches_applies_to "$rail"; then
      # Rail applies — a skip here is a missing gate — RED
      echo "  [FAIL] $rail :: check script not executable or missing: $check (A1.3: applicable rail cannot be skipped — fix or make executable)" | tee -a "$LOG" >&2
      PASS=false
    else
      # Rail does not apply to the changed set — skip is safe
      echo "  [skip] $rail :: check script not applicable to changed files: $check" | tee -a "$LOG"
    fi
  fi
done < <(jq -r '.rails | to_entries[] | "\(.key)\t\(.value.check)"' "$CONFIG")

if $PASS; then
  echo "[harness] PASS — all rails clean"
  exit 0
else
  echo "[harness] FAIL — fix the failing rails before signing your work" >&2
  exit 1
fi
