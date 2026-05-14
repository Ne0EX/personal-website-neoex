#!/usr/bin/env bash
# .claude/hooks/pre-handoff.sh
# Usage: bash .claude/hooks/pre-handoff.sh <task_id> <recipient>
set -euo pipefail

TASK_ID="${1:-}"
RECIPIENT_LC="${2:-}"
AGENT="${WL_AGENT:-unknown}"

if [[ -z "$TASK_ID" || -z "$RECIPIENT_LC" ]]; then
  echo "pre-handoff: usage: pre-handoff.sh <task_id> <recipient>" >&2
  exit 2
fi

# Roster check on recipient (inline; matches sign-work.sh)
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
RECIPIENT_DESIGNATION=$(designation_for "$RECIPIENT_LC")
if [[ -z "$RECIPIENT_DESIGNATION" ]]; then
  echo "pre-handoff: '$RECIPIENT_LC' is not a current roster codename." >&2
  echo "             Single-token references are ambiguous — see .claude/AGENTS.md Nomenclature." >&2
  exit 3
fi

HANDOFF_DIR=".claude/handoffs/from-${AGENT}"
mkdir -p "$HANDOFF_DIR"
HANDOFF_FILE="$HANDOFF_DIR/${TASK_ID}--to-${RECIPIENT_LC}.md"

# 1. Signature must exist
SIG_FILE=".claude/signatures/${TASK_ID}--${AGENT}.json"
if [[ ! -f "$SIG_FILE" ]]; then
  echo "pre-handoff: no signature at $SIG_FILE — run sign-work.sh first" >&2
  exit 4
fi

# 2. Schema version + gates
SIG_VERSION=$(jq -r '.signature_schema_version // 1' "$SIG_FILE")
if [[ "$SIG_VERSION" != "2" ]]; then
  echo "pre-handoff: signature is v$SIG_VERSION; v2 required for new handoffs." >&2
  echo "             Old v1 signatures stay valid but no new handoff produces them." >&2
  exit 5
fi

HARNESS_PASSED=$(jq -r '.harness_passed' "$SIG_FILE")
POST_EDIT_PASSED=$(jq -r '.post_edit_passed' "$SIG_FILE")
if [[ "$HARNESS_PASSED" != "true" || "$POST_EDIT_PASSED" != "true" ]]; then
  echo "pre-handoff: signature flagged — gates did not pass" >&2
  echo "  harness=$HARNESS_PASSED post_edit=$POST_EDIT_PASSED" >&2
  exit 6
fi

# 3. Recipient in signature must match this handoff target
SIG_NEXT_DES=$(jq -r '.next_recipient.designation' "$SIG_FILE")
if [[ "$SIG_NEXT_DES" != "$RECIPIENT_DESIGNATION" ]]; then
  echo "pre-handoff: signature's next_recipient.designation ($SIG_NEXT_DES) does not match this handoff's recipient ($RECIPIENT_DESIGNATION = $RECIPIENT_LC)." >&2
  echo "             Re-sign with WL_NEXT=$RECIPIENT_LC and retry." >&2
  exit 7
fi

# 4. Visual-diff approval if UI changed
if jq -r '.files_touched | .[]' "$SIG_FILE" | grep -qE '^(app|components)/'; then
  VIS_STATUS=".claude/visual-diffs/${TASK_ID}/STATUS"
  if [[ ! -f "$VIS_STATUS" || "$(cat "$VIS_STATUS")" != "betelgeuse-approved" ]]; then
    echo "pre-handoff: UI changed but visual-diff not approved by Betelgeuse" >&2
    echo "  status: $(cat "$VIS_STATUS" 2>/dev/null || echo missing)" >&2
    exit 8
  fi
fi

# 5. Handoff template scaffolded?
TEMPLATE=".claude/handoffs/_template.md"
if [[ ! -f "$HANDOFF_FILE" ]]; then
  echo "pre-handoff: no handoff draft at $HANDOFF_FILE" >&2
  cp "$TEMPLATE" "$HANDOFF_FILE"
  echo "             template copied. fill it out and re-run." >&2
  exit 9
fi

# 6. Required sections
REQUIRED=(
  "^## scope"
  "^## what i did"
  "^## what.*you.*do next"
  "^## known deviations"
  "^## signature"
)
for re in "${REQUIRED[@]}"; do
  if ! grep -qE "$re" "$HANDOFF_FILE"; then
    echo "pre-handoff: handoff missing required section matching: $re" >&2
    exit 10
  fi
done

# 7. Link signature
if ! grep -q "signatures/${TASK_ID}--${AGENT}.json" "$HANDOFF_FILE"; then
  printf "\n---\nsignature · .claude/signatures/%s--%s.json\n" "$TASK_ID" "$AGENT" >> "$HANDOFF_FILE"
fi

echo "[pre-handoff] PASS — handoff finalized at $HANDOFF_FILE"
echo "[pre-handoff] → $RECIPIENT_LC ($RECIPIENT_DESIGNATION)"
exit 0
