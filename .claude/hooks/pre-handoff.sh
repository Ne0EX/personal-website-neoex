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

# 4a. STATUS.md write guard
#
# docs/team/STATUS.md is shared Polaris-maintained state.  Concurrent agent
# writes are the confirmed root cause of the STATUS.md modification race
# (DIAG-2026-05-15-status-md-race).  This guard enforces the write protocol:
#
#   - Root Polaris (AGENT=polaris) may write freely — exempt from this check.
#   - Any other agent that lists STATUS.md in files_touched must have made a
#     SECTION-SCOPED edit only (not a full-file rewrite).  Heuristic: if the
#     net line delta vs HEAD exceeds STATUS_MAX_LINES it is treated as a
#     full-file rewrite and the handoff is blocked (exit 11).
#
# The safe path for non-Polaris agents: write the STATUS section to
#   docs/team/.status-drafts/<task_id>--<agent>.md
# Root-Polaris merges all drafts into STATUS.md in a single Edit.
#
# STATUS_MAX_LINES rationale: a normal section-append is 20-40 lines.
# 80 is generous headroom.  Anything beyond 80 is structurally a rewrite.

STATUS_MAX_LINES=80
STATUS_GUARD_FILE="docs/team/STATUS.md"

if jq -r '.files_touched | .[]' "$SIG_FILE" | grep -qF "$STATUS_GUARD_FILE"; then
  if [[ "$AGENT" != "polaris" ]]; then
    HEAD_LINES=0
    CURRENT_LINES=0
    if git cat-file -e HEAD:"$STATUS_GUARD_FILE" 2>/dev/null; then
      HEAD_LINES=$(git show HEAD:"$STATUS_GUARD_FILE" | wc -l | tr -d ' ')
    fi
    if [[ -f "$STATUS_GUARD_FILE" ]]; then
      CURRENT_LINES=$(wc -l < "$STATUS_GUARD_FILE" | tr -d ' ')
    fi
    NET_DELTA=$(( CURRENT_LINES - HEAD_LINES ))
    [[ "$NET_DELTA" -lt 0 ]] && NET_DELTA=$(( -NET_DELTA ))

    if [[ "$NET_DELTA" -gt "$STATUS_MAX_LINES" ]]; then
      echo "pre-handoff: STATUS.md write guard — BLOCKED (exit 11)" >&2
      echo "  agent '$AGENT' net STATUS.md delta = $NET_DELTA lines (max $STATUS_MAX_LINES)." >&2
      echo "  A delta this large indicates a full-file rewrite, which causes the" >&2
      echo "  parallel-write race (DIAG-2026-05-15-status-md-race)." >&2
      echo "" >&2
      echo "  SAFE PATH:" >&2
      echo "    1. Revert your STATUS.md edits." >&2
      echo "    2. Write your section to:" >&2
      echo "         docs/team/.status-drafts/${TASK_ID}--${AGENT}.md" >&2
      echo "    3. Polaris merges all drafts → STATUS.md in a single Edit." >&2
      echo "" >&2
      echo "  EXCEPTION: if Polaris explicitly authorized a large STATUS.md write," >&2
      echo "  request that Polaris run the merge (AGENT=polaris bypasses this guard)." >&2
      exit 11
    fi
  fi
fi

# 4b. Visual-diff approval if UI changed
if jq -r '.files_touched | .[]' "$SIG_FILE" | grep -qE '^(app|components)/'; then
  VIS_STATUS=".claude/visual-diffs/${TASK_ID}/STATUS"
  if [[ ! -f "$VIS_STATUS" || "$(cat "$VIS_STATUS")" != "betelgeuse-approved" ]]; then
    echo "pre-handoff: UI changed but visual-diff not approved by Betelgeuse" >&2
    echo "  status: $(cat "$VIS_STATUS" 2>/dev/null || echo missing)" >&2
    exit 8
  fi
fi

# 4c. Prototype port checklist — required when Betelgeuse hands off to Sirius
#     with prototype files in files_touched.
#
# When Betelgeuse (designer) hands to Sirius (implementer) AND the handoff includes
# prototype paths, Sirius needs a structured port checklist to address production
# concerns (hydration, types, a11y, motion, SSR) that don't appear in a vanilla
# HTML prototype. Without this checklist, soul-loss occurs silently at porting time.
#
# Required fields when triggered:
#   - production target path (which app/* or components/* file Sirius writes)
#   - production concerns to address (hydration · types · a11y · motion · SSR safety)
#   - expected diff tolerance (how much visual drift from prototype is acceptable)
#   - rendered checkpoint path (Playwright screenshot from prototype run)
#
# Triggered when: source agent = betelgeuse AND recipient = sirius AND
#                 files_touched contains a prototype path.

PROTO_CHECKLIST_REQUIRED=false
if [[ "$AGENT" == "betelgeuse" && "$RECIPIENT_LC" == "sirius" ]]; then
  if jq -r '.files_touched | .[]' "$SIG_FILE" | grep -qE '^(prototypes/|\.claude/visual-diffs/.*/prototype/)'; then
    PROTO_CHECKLIST_REQUIRED=true
  fi
fi

if $PROTO_CHECKLIST_REQUIRED; then
  if [[ -f "$HANDOFF_FILE" ]]; then
    if ! grep -qiE '^##\s+prototype\s+port\s+checklist' "$HANDOFF_FILE"; then
      echo "pre-handoff: Betelgeuse → Sirius handoff with prototype path requires" >&2
      echo "  '## prototype port checklist' section in the handoff document." >&2
      echo "" >&2
      echo "  Required fields:" >&2
      echo "    - production target path   (which app/* or components/* Sirius writes)" >&2
      echo "    - production concerns      (hydration · types · a11y · motion · SSR safety)" >&2
      echo "    - expected diff tolerance  (acceptable visual drift from prototype)" >&2
      echo "    - rendered checkpoint path (Playwright screenshot from prototype run)" >&2
      echo "" >&2
      echo "  Add the section to $HANDOFF_FILE and re-run pre-handoff.sh." >&2
      exit 12
    fi
    # Validate that the checklist has at least the four required fields
    CHECKLIST_FIELDS=("production target" "production concerns" "diff tolerance" "rendered checkpoint")
    for field in "${CHECKLIST_FIELDS[@]}"; do
      if ! grep -qiE "${field}" "$HANDOFF_FILE"; then
        echo "pre-handoff: prototype port checklist is missing required field: '$field'" >&2
        echo "  Add '$field:' to the '## prototype port checklist' section." >&2
        exit 12
      fi
    done
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
