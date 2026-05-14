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

# 1. Gather files touched
FILES_TOUCHED=$(git diff --name-only --diff-filter=AMD HEAD 2>/dev/null | jq -R . | jq -s .)
if [[ "$FILES_TOUCHED" == "[]" ]]; then
  echo "sign-work: no changed files since HEAD — nothing to sign" >&2
  exit 3
fi

# 2. Per-file sha256 map (object form for .hashes.files_sha256)
FILES_SHA256=$(git diff --name-only --diff-filter=AM HEAD 2>/dev/null \
  | sort \
  | while read -r f; do
      [[ -f "$f" ]] || continue
      h=$(sha256sum "$f" | awk '{print $1}')
      jq -n --arg p "$f" --arg h "$h" '{($p): $h}'
    done \
  | jq -s 'add // {}')

# 3. Harness status from log
HARNESS_PASSED=true
if [[ -f ".claude/hook-logs/${TASK_ID}--harness.log" ]] \
   && grep -q "\[FAIL\]" ".claude/hook-logs/${TASK_ID}--harness.log"; then
  HARNESS_PASSED=false
fi

# 4. Post-edit status from log
POST_EDIT_OK=true
if [[ -f ".claude/hook-logs/${TASK_ID}--post-edit.log" ]]; then
  grep -q "FAIL:" ".claude/hook-logs/${TASK_ID}--post-edit.log" && POST_EDIT_OK=false
else
  POST_EDIT_OK=false
fi

# 5. Steps log
STEPS="[]"
[[ -f "$STEPS_LOG" ]] && STEPS=$(jq -R . < "$STEPS_LOG" | jq -s .)

# 6. Free-form fields from env
SUMMARY="${WL_SUMMARY:-no summary provided}"
STARTED_AT="${WL_STARTED_AT:-$(date -u +%FT%TZ)}"
COMPLETED_AT="$(date -u +%FT%TZ)"

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
SELF_HASH=$(echo "$PAYLOAD" | jq -cS 'del(.hashes.self_hash)' | sha256sum | awk '{print $1}')

# 9. Embed self_hash and write
echo "$PAYLOAD" | jq --arg sh "$SELF_HASH" '.hashes.self_hash = $sh' > "$SIG_FILE"

# 10. Flag if gates didn't pass
if ! $HARNESS_PASSED || ! $POST_EDIT_OK; then
  echo "sign-work: signature written but FLAGGED — harness=$HARNESS_PASSED post_edit=$POST_EDIT_OK" >&2
  echo "sign-work: handoff will be blocked by pre-handoff.sh. Fix and re-sign." >&2
  exit 4
fi

echo "[sign-work] PASS — signed at $SIG_FILE (v2)"
echo "[sign-work] agent=$AGENT_TC ($AGENT_DESIGNATION) → next=$NEXT_TC ($NEXT_DESIGNATION)"
echo "[sign-work] self_hash=$SELF_HASH"
exit 0
