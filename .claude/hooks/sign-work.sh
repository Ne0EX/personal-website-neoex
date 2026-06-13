#!/usr/bin/env bash
# .claude/hooks/sign-work.sh
# Usage: bash .claude/hooks/sign-work.sh <task_id>
# Writes a v2 signature; see .claude/signatures/SCHEMA.md
set -euo pipefail

TASK_ID="${1:-}"
AGENT="${WL_AGENT:-unknown}"
NEXT_AGENT_LC="${WL_NEXT:-polaris}"
if [[ -z "$TASK_ID" ]]; then
  echo "sign-work: missing task_id" >&2
  exit 2
fi

# --- roster lookup ---
designation_for() {
  case "$1" in
    polaris)    echo "α-OPS-00" ;;
    sirius)     echo "α-SUR-01" ;;
    altair)     echo "α-BND-02" ;;
    procyon)    echo "α-IDX-03" ;;
    betelgeuse) echo "α-VIS-04" ;;
    arcturus)   echo "α-NET-05" ;;
    algol)      echo "α-VER-06" ;;
    canopus)    echo "α-HRN-07" ;;
    vega)       echo "α-VOX-08" ;;
    *)          echo "" ;;
  esac
}
precutover_for() {
  case "$1" in
    polaris)    echo "Mira" ;;
    sirius)     echo "Pico" ;;
    altair)     echo "Vega" ;;
    procyon)    echo "Lyra" ;;
    betelgeuse) echo "Iris" ;;
    arcturus)   echo "Sage" ;;
    algol)      echo "Cipher" ;;
    canopus)    echo "Rigel" ;;
    vega)       echo "Quill" ;;
    *)          echo "" ;;
  esac
}
titlecase() { awk '{print toupper(substr($0,1,1)) substr($0,2)}' <<<"$1"; }

AGENT_DESIGNATION=$(designation_for "$AGENT")
if [[ -z "$AGENT_DESIGNATION" ]]; then
  echo "sign-work: unknown agent codename '$AGENT'. Update sign-work.sh roster lookup." >&2
  exit 2
fi
AGENT_TC=$(titlecase "$AGENT")
PRE=$(precutover_for "$AGENT")
NEXT_DESIGNATION=$(designation_for "$NEXT_AGENT_LC")
if [[ -z "$NEXT_DESIGNATION" ]]; then
  echo "sign-work: unknown next-recipient '$NEXT_AGENT_LC'. Set WL_NEXT to a current roster codename." >&2
  exit 2
fi
NEXT_TC=$(titlecase "$NEXT_AGENT_LC")

SIG_DIR=".claude/signatures"
mkdir -p "$SIG_DIR"
SIG_FILE="$SIG_DIR/${TASK_ID}--${AGENT}.json"
STEPS_LOG=".claude/hook-logs/${TASK_ID}--steps.log"

# 1. Gather files touched — baseline-aware file discovery
#
# Strategy (approach 1): pre-task.sh records a snapshot of all dirty files at task
# start into .claude/hook-logs/<task_id>--baseline.json.  At sign time we compute
# the current dirty set, then subtract any file whose sha256 is unchanged vs the
# baseline (= carry-over from a prior task, not touched by this one).
#
# Fallback: if no baseline exists (in-flight tasks started before this fix, or
# manual sign-work invocations), we fall back to the full git diff with a warning.

BASELINE_FILE=".claude/hook-logs/${TASK_ID}--baseline.json"

# D3 FIX: Collect the full picture of "what changed since the baseline":
# - Tracked dirty files: git diff --name-only (files git knows about that changed)
# - Untracked files: git ls-files --others --exclude-standard (newly created, never staged)
#
# Both paths (baseline-aware and fallback) now see the complete set. Without this,
# newly-created deliverables that were never staged were invisible to files_touched —
# the root cause of INTEGRITY-PARTIAL in TASK-08 (Betelgeuse) and TASK-12 (Canopus).
ALL_DIRTY=$(git diff --name-only --diff-filter=AMD HEAD 2>/dev/null | sort)
ALL_UNTRACKED=$(git ls-files --others --exclude-standard 2>/dev/null | sort || true)

if [[ -f "$BASELINE_FILE" ]]; then
  # Load the baseline map (file → hash at task-start time)
  BASELINE_MAP=$(jq -r '.files' "$BASELINE_FILE")

  # For each currently-dirty TRACKED file, keep it in files_touched only if:
  #   a) it was NOT in the baseline at task start (new dirty file = this task added it), OR
  #   b) it WAS in the baseline but its hash has changed (this task modified a carry-over), OR
  #   c) it was in the baseline as DELETED and now exists (this task restored it)
  TASK_FILES_TOUCHED=""
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    BASELINE_HASH=$(echo "$BASELINE_MAP" | jq -r --arg p "$f" '.[$p] // "NOT_IN_BASELINE"')
    if [[ "$BASELINE_HASH" == "NOT_IN_BASELINE" ]]; then
      # Not present at task start → this task introduced the dirty state
      TASK_FILES_TOUCHED="${TASK_FILES_TOUCHED}"$'\n'"$f"
    elif [[ "$BASELINE_HASH" == "DELETED" ]]; then
      # Was deleted at task start; if it exists now, this task created/restored it
      [[ -f "$f" ]] && TASK_FILES_TOUCHED="${TASK_FILES_TOUCHED}"$'\n'"$f"
    else
      # Present at task start — compare current hash to baseline hash
      if [[ -f "$f" ]]; then
        CURRENT_HASH=$(sha256sum "$f" | awk '{print $1}')
        if [[ "$CURRENT_HASH" != "$BASELINE_HASH" ]]; then
          # Hash drifted → this task modified it
          TASK_FILES_TOUCHED="${TASK_FILES_TOUCHED}"$'\n'"$f"
        fi
        # else: unchanged carry-over — excluded
      else
        # File was present at baseline but is now deleted — this task deleted it
        TASK_FILES_TOUCHED="${TASK_FILES_TOUCHED}"$'\n'"$f"
      fi
    fi
  done <<< "$ALL_DIRTY"

  # D3 FIX (baseline-aware path): include currently-untracked files that are either:
  #   a) absent from the baseline entirely → newly created by this task, OR
  #   b) present in the baseline but with a different hash → modified by this task.
  # pre-task.sh now records all untracked files at task start with their sha256 hashes.
  # This mirrors the logic for tracked dirty files above (NOT_IN_BASELINE = new,
  # hash-changed = modified, hash-same = carry-over excluded).
  while IFS= read -r f; do
    [[ -z "$f" ]] && continue
    BASELINE_HASH=$(echo "$BASELINE_MAP" | jq -r --arg p "$f" '.[$p] // "NOT_IN_BASELINE"')
    if [[ "$BASELINE_HASH" == "NOT_IN_BASELINE" ]]; then
      # Not in baseline — created by this task
      TASK_FILES_TOUCHED="${TASK_FILES_TOUCHED}"$'\n'"$f"
    elif [[ "$BASELINE_HASH" == "DELETED" ]]; then
      # Was absent at baseline, now exists as untracked — this task created it
      TASK_FILES_TOUCHED="${TASK_FILES_TOUCHED}"$'\n'"$f"
    else
      # Was untracked at baseline — include only if hash changed (this task modified it)
      if [[ -f "$f" ]]; then
        CURRENT_HASH=$(sha256sum "$f" | awk '{print $1}')
        [[ "$CURRENT_HASH" != "$BASELINE_HASH" ]] && \
          TASK_FILES_TOUCHED="${TASK_FILES_TOUCHED}"$'\n'"$f"
      fi
      # hash-same = pre-existing untracked carry-over → excluded
    fi
  done <<< "$ALL_UNTRACKED"

  # Strip leading blank line and format as JSON array (deduplicate in case of overlap)
  TASK_FILES_TOUCHED=$(printf '%s\n' "$TASK_FILES_TOUCHED" | sort -u | grep -v '^$' || true)
  FILES_TOUCHED=$(printf '%s\n' "$TASK_FILES_TOUCHED" | (grep -v '^$' || true) | jq -R . | jq -s . 2>/dev/null || echo "[]")

  CARRY_OVER_COUNT=$(echo "$ALL_DIRTY" | grep -c '.' || echo 0)
  TASK_COUNT=$(echo "$FILES_TOUCHED" | jq 'length')
  echo "[sign-work] baseline-aware scope: $TASK_COUNT task file(s) from $CARRY_OVER_COUNT total tracked-dirty" >&2
else
  # No baseline — fall back to full git diff + untracked files (D3 fix)
  echo "sign-work: WARNING — no baseline found at $BASELINE_FILE" >&2
  echo "sign-work: falling back to git diff + untracked files (may include carry-overs from prior tasks)" >&2
  echo "sign-work: run pre-task.sh before starting work to enable accurate carry-over filtering" >&2
  # D3 FIX: merge tracked-dirty and untracked, deduplicate, drop empty lines.
  # ALL_UNTRACKED is already computed above (git ls-files --others --exclude-standard).
  ALL_WITH_UNTRACKED=$(printf '%s\n%s\n' "$ALL_DIRTY" "$ALL_UNTRACKED" | sort -u | grep -v '^$' || true)
  FILES_TOUCHED=$(printf '%s\n' "$ALL_WITH_UNTRACKED" | (grep -v '^$' || true) | jq -R . | jq -s . 2>/dev/null || echo "[]")
fi

# Self-signature exclusion — remove the signature file itself from files_touched.
# A signature cannot meaningfully attest to itself: it does not exist at the time
# task-work files are being modified, and its content is determined by this very
# script. Including it creates a self-referential paradox with no audit value.
# Applied here, after both code paths converge on FILES_TOUCHED, so the fix covers
# both the baseline-aware and the fallback path in one place.
SIG_FILE_RELATIVE="${SIG_FILE#./}"   # normalize: strip leading ./ if present
FILES_TOUCHED=$(echo "$FILES_TOUCHED" \
  | jq --arg sig "$SIG_FILE_RELATIVE" '[.[] | select(. != $sig)]')

if [[ "$FILES_TOUCHED" == "[]" || -z "$FILES_TOUCHED" ]]; then
  echo "sign-work: no changed files attributed to this task — nothing to sign" >&2
  exit 3
fi

# 2. Per-file sha256 map (object form for .hashes.files_sha256)
# Only hash files that exist (not deleted-by-this-task entries)
FILES_SHA256=$(echo "$FILES_TOUCHED" | jq -r '.[]' \
  | sort \
  | while read -r f; do
      [[ -f "$f" ]] || continue
      h=$(sha256sum "$f" | awk '{print $1}')
      jq -n --arg p "$f" --arg h "$h" '{($p): $h}'
    done \
  | jq -s 'add // {}')

# 3. Harness status from log
#
# A1.2 FAIL-CLOSED DEFAULT — symmetric with post_edit_passed.
#
# Prior behaviour: harness_passed defaulted to `true` when no harness log was
# present. This was fail-OPEN: an agent that never ran harness-check.sh would
# silently ship a green harness_passed=true signature.
#
# New behaviour (controlled by WL_HARNESS_FAILMODE, default "closed"):
#   closed (default) · absent/empty harness log = NOT pass (harness_passed=false).
#     This is the correctness fix. Run harness-check.sh before signing.
#   open · absent harness log = pass (legacy behaviour; back-out lever).
#
# REVERT COMMAND (one-liner, if this causes an unforeseen team-wide freeze):
#   WL_HARNESS_FAILMODE=open bash .claude/hooks/sign-work.sh <task_id>
# To make open mode the default for a session:
#   export WL_HARNESS_FAILMODE=open
# To restore closed mode (default) after a back-out:
#   unset WL_HARNESS_FAILMODE   # or: export WL_HARNESS_FAILMODE=closed
#
# The flag is a BACK-OUT LEVER, not a staged rollout. Closed mode is correct
# from the first commit. Do not leave WL_HARNESS_FAILMODE=open in any hook
# or CI configuration — it re-opens the false-green class this fix closes.

WL_HARNESS_FAILMODE="${WL_HARNESS_FAILMODE:-closed}"

if [[ -f ".claude/hook-logs/${TASK_ID}--harness.log" ]]; then
  # Log exists: pass unless it contains a [FAIL] line
  if grep -q "\[FAIL\]" ".claude/hook-logs/${TASK_ID}--harness.log"; then
    HARNESS_PASSED=false
  else
    HARNESS_PASSED=true
  fi
else
  # No harness log — apply failmode policy
  if [[ "${WL_HARNESS_FAILMODE}" == "open" ]]; then
    echo "sign-work: WL_HARNESS_FAILMODE=open — absent harness log treated as pass (back-out mode)" >&2
    HARNESS_PASSED=true
  else
    echo "sign-work: harness log absent at .claude/hook-logs/${TASK_ID}--harness.log" >&2
    echo "sign-work: WL_HARNESS_FAILMODE=closed (default) — absent harness log = NOT pass" >&2
    echo "sign-work: Run: bash .claude/hooks/harness-check.sh before signing." >&2
    echo "sign-work: To back out: WL_HARNESS_FAILMODE=open bash .claude/hooks/sign-work.sh ${TASK_ID}" >&2
    HARNESS_PASSED=false
  fi
fi

# 4. Post-edit status from log
#
# WL_DOC_ONLY=1 — set this when a task touches only documentation (no .ts/.tsx/.js/.css
# files). When set, post_edit_passed is asserted true without requiring a post-edit log,
# because lint/typecheck/build checks are not applicable to doc-only deliverables.
#
# Safety valve: if WL_DOC_ONLY=1 but FILES_TOUCHED contains code files, the flag is
# rejected — a code-touching task must run post-edit.sh regardless.
POST_EDIT_OK=true
if [[ "${WL_DOC_ONLY:-0}" == "1" ]]; then
  CODE_FILES=$(echo "$FILES_TOUCHED" | jq -r '.[]' | grep -E '\.(ts|tsx|js|jsx|css|scss|mjs|cjs)$' || true)
  if [[ -n "$CODE_FILES" ]]; then
    echo "sign-work: WL_DOC_ONLY=1 is set but FILES_TOUCHED contains code files:" >&2
    echo "$CODE_FILES" | sed 's/^/  /' >&2
    echo "sign-work: doc-only flag is invalid for code-touching tasks. Run post-edit.sh." >&2
    exit 6
  fi
  echo "[sign-work] WL_DOC_ONLY=1 — post-edit.sh not required for this task (doc-only)" >&2
  POST_EDIT_OK=true
elif [[ -f ".claude/hook-logs/${TASK_ID}--post-edit.log" ]]; then
  grep -q "FAIL:" ".claude/hook-logs/${TASK_ID}--post-edit.log" && POST_EDIT_OK=false
else
  POST_EDIT_OK=false
fi

# 5. Steps log
#
# SCHEMA-FAIL-STEPS FIX (DEBT-1 2026-06-13):
#
# Prior behaviour: if no steps log existed, STEPS defaulted to "[]" with only an
# advisory NOTE to stderr. This was fail-OPEN: a fully automated sign-work
# invocation with no steps log produced a valid-looking signature with steps:[]
# even though SCHEMA.md requires non-empty steps as an audit trail.
#
# New behaviour (fail-closed, default):
#   Sources (in priority order):
#     1. WL_STEPS env var — newline-delimited list of step strings (highest priority;
#        allows programmatic callers to inject steps without a log file).
#     2. ${TASK_ID}--steps.log file — the standard path written during work.
#   If neither source produces at least one non-empty step, the sign is BLOCKED
#   unless WL_REQUIRE_STEPS=0 is explicitly set (the back-out lever).
#
# Back-out lever: set WL_REQUIRE_STEPS=0 to downgrade the block to a WARNING.
#   WL_REQUIRE_STEPS=0 bash .claude/hooks/sign-work.sh <task_id>
#   Default is "1" (fail-closed). Only override for doc-only or migration tasks
#   where steps are not applicable. Document the override in the summary.
#
# REVERT COMMAND:
#   WL_REQUIRE_STEPS=0 bash .claude/hooks/sign-work.sh <task_id>
#
# Existing signatures with steps:[] are immutable (self_hash is computed over the
# payload-as-signed). This fix applies only to new signatures produced go-forward.

STEPS="[]"

# Priority 1: WL_STEPS env var (newline-delimited step strings)
if [[ -n "${WL_STEPS:-}" ]]; then
  STEPS=$(printf '%s\n' "$WL_STEPS" | grep -v '^[[:space:]]*$' | jq -R . | jq -s .)
  echo "[sign-work] steps sourced from WL_STEPS env var ($(echo "$STEPS" | jq 'length') step(s))" >&2
# Priority 2: steps log file
elif [[ -f "$STEPS_LOG" ]]; then
  STEPS=$(grep -v '^[[:space:]]*$' "$STEPS_LOG" | jq -R . | jq -s . 2>/dev/null || echo "[]")
  echo "[sign-work] steps sourced from $STEPS_LOG ($(echo "$STEPS" | jq 'length') step(s))" >&2
fi

# Validate steps non-empty (fail-closed by default)
_STEPS_COUNT=$(echo "$STEPS" | jq 'length')
if [[ "$_STEPS_COUNT" -eq 0 ]]; then
  echo "sign-work: SCHEMA-FAIL — steps is empty." >&2
  echo "  SCHEMA.md requires non-empty steps: short imperative audit-trail lines." >&2
  echo "  Two ways to supply steps:" >&2
  echo "    a) Write step notes (one per line) to: .claude/hook-logs/${TASK_ID}--steps.log" >&2
  echo "       during work; sign-work.sh reads the file at sign time." >&2
  echo "    b) Set WL_STEPS before calling sign-work.sh:" >&2
  echo "       WL_STEPS='read SCHEMA.md\nwrote hooks\nran sign-work.sh' \\" >&2
  echo "         bash .claude/hooks/sign-work.sh $TASK_ID" >&2
  echo "  Back-out lever (downgrades to WARNING):" >&2
  echo "    WL_REQUIRE_STEPS=0 bash .claude/hooks/sign-work.sh $TASK_ID" >&2
  if [[ "${WL_REQUIRE_STEPS:-1}" != "0" ]]; then
    echo "sign-work: BLOCKED — WL_REQUIRE_STEPS is unset or 1 (fail-closed). Provide steps before signing." >&2
    exit 8
  else
    echo "sign-work: WL_REQUIRE_STEPS=0 — downgrading steps-empty block to WARNING. steps:[] will be recorded." >&2
  fi
fi

# 6. Free-form fields from env
SUMMARY="${WL_SUMMARY:-no summary provided}"
STARTED_AT="${WL_STARTED_AT:-$(date -u +%FT%TZ)}"
COMPLETED_AT="$(date -u +%FT%TZ)"

# 6a. Summary quality guard
#
# Algol TASK-30 audit flagged: a signature with summary="no summary provided"
# and steps=[] shipped undetected. This guard warns (not blocks by default)
# when the summary is clearly not a human-authored description.
#
# Fail-closed mode: set WL_REQUIRE_SUMMARY=1 in the environment to turn
# warnings into hard errors (exit 5). Useful in CI or strict-mode sessions.
#
# Conditions that trigger the warning:
#   a) WL_SUMMARY was not set (default "no summary provided" was used)
#   b) WL_SUMMARY equals literal "no summary provided" (explicit but uncrafted)
#   c) WL_SUMMARY is set but < 10 characters (too short to be meaningful)

_SUMMARY_OK=true
_SUMMARY_WARN=""
if [[ -z "${WL_SUMMARY:-}" ]]; then
  _SUMMARY_OK=false
  _SUMMARY_WARN="WL_SUMMARY is unset. Set it to a meaningful description of what this task did."
elif [[ "$SUMMARY" == "no summary provided" ]]; then
  _SUMMARY_OK=false
  _SUMMARY_WARN="WL_SUMMARY equals literal 'no summary provided' — please write an actual summary."
elif [[ "${#SUMMARY}" -lt 10 ]]; then
  _SUMMARY_OK=false
  _SUMMARY_WARN="WL_SUMMARY is too short (${#SUMMARY} chars < 10 min). Add more detail."
fi

if [[ "$_SUMMARY_OK" == "false" ]]; then
  echo "sign-work: WARNING — summary quality check failed:" >&2
  echo "  $_SUMMARY_WARN" >&2
  echo "  Export WL_SUMMARY='<description>' before calling sign-work.sh." >&2
  echo "  Example: WL_SUMMARY='Rewrote next-dispatchable.sh for bash 3.2 compat' bash .claude/hooks/sign-work.sh $TASK_ID" >&2
  if [[ "${WL_REQUIRE_SUMMARY:-0}" == "1" ]]; then
    echo "sign-work: BLOCKED — WL_REQUIRE_SUMMARY=1 is set; summary is required before signing." >&2
    exit 5
  fi
fi

# 7. Build payload (no self_hash yet). pre_cutover_codename is string-or-null.
if [[ -n "$PRE" ]]; then
  PRE_ARG=$(jq -n --arg s "$PRE" '$s')
else
  PRE_ARG="null"
fi

PAYLOAD=$(jq -n \
  --arg task_id "$TASK_ID" \
  --arg agent "$AGENT_TC" \
  --arg designation "$AGENT_DESIGNATION" \
  --argjson precutover "$PRE_ARG" \
  --arg started "$STARTED_AT" \
  --arg completed "$COMPLETED_AT" \
  --argjson files "$FILES_TOUCHED" \
  --arg summary "$SUMMARY" \
  --argjson steps "$STEPS" \
  --argjson files_sha "$FILES_SHA256" \
  --argjson harness "$HARNESS_PASSED" \
  --argjson post_edit "$POST_EDIT_OK" \
  --arg next_agent "$NEXT_TC" \
  --arg next_designation "$NEXT_DESIGNATION" \
  '{
    signature_schema_version: 2,
    task_id: $task_id,
    agent: $agent,
    agent_designation: $designation,
    pre_cutover_codename: $precutover,
    started_at: $started,
    completed_at: $completed,
    files_touched: $files,
    summary: $summary,
    steps: $steps,
    hashes: { files_sha256: $files_sha },
    harness_passed: $harness,
    post_edit_passed: $post_edit,
    next_recipient: { agent: $next_agent, designation: $next_designation }
  }')

# 8. Canonical-JSON self_hash (sorted keys, compact, excluding hashes.self_hash)
# tr -d '\n' strips jq's trailing newline so the byte count fed to sha256sum matches
# the Python canonical reference (json.dumps produces no trailing newline).
# Without this strip, bash hashes N+1 bytes; Python hashes N bytes; digests diverge.
SELF_HASH=$(echo "$PAYLOAD" | jq -cS 'del(.hashes.self_hash)' | tr -d '\n' | sha256sum | awk '{print $1}')

# 9. Embed self_hash and write
echo "$PAYLOAD" | jq --arg sh "$SELF_HASH" '.hashes.self_hash = $sh' > "$SIG_FILE"

# 9a. Post-write PENDING guard — fail closed if any hash field in the produced
# signature contains the substring "PENDING". This catches any future regression where
# a code path substitutes a placeholder instead of a computed value. The check is
# scoped to .hashes only (not summary/steps prose) to avoid false positives when
# an agent legitimately describes PENDING work in their summary text.
HASH_STRINGS=$(jq -r '.hashes | .. | strings' "$SIG_FILE" 2>/dev/null || true)
if echo "$HASH_STRINGS" | grep -qi "PENDING"; then
  echo "sign-work: INTERNAL ERROR — .hashes field contains PENDING string(s)" >&2
  echo "sign-work: signature at $SIG_FILE is invalid; removing it." >&2
  rm -f "$SIG_FILE"
  exit 7
fi

# 10. Flag if gates didn't pass
if ! $HARNESS_PASSED || ! $POST_EDIT_OK; then
  echo "sign-work: signature written but FLAGGED — harness=$HARNESS_PASSED post_edit=$POST_EDIT_OK" >&2
  echo "sign-work: handoff will be blocked by pre-handoff.sh. Fix and re-sign." >&2
  exit 4
fi

echo "[sign-work] PASS — signed at $SIG_FILE (v2)"
echo "[sign-work] agent=$AGENT_TC ($AGENT_DESIGNATION) → next=$NEXT_TC ($NEXT_DESIGNATION)"
echo "[sign-work] self_hash=$SELF_HASH"

# factory telemetry freshness (full rebuild stays the trust anchor — collect.mjs is idempotent)
if [[ -f "scripts/factory/collect.mjs" ]]; then
  node scripts/factory/collect.mjs --task "$TASK_ID" >/dev/null 2>&1 || true
fi

exit 0
