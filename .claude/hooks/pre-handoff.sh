#!/usr/bin/env bash
# .claude/hooks/pre-handoff.sh
# Usage: bash .claude/hooks/pre-handoff.sh <task_id> <recipient>
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
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

# 4d. HTML-first-spec advisory warnings (visual-surface specs)
#
# When a Betelgeuse -> Sirius handoff references a visual surface TASK, warn (advisory) if:
#   (a) The associated prototype/index.html does not exist at the expected visual-diffs path, OR
#   (b) The associated docs/design/<surface>.md exceeds 220 lines
#       (200-line cap + 20-line tolerance per docs/team/WORKFLOW-HTML-FIRST-SPEC.md §4)
#
# These warnings do NOT block the handoff — they are advisory flags that reference the spec
# so the reader has the why. The blocking gates for Rule 4 live in
# scripts/audit-visual-diff-directions.sh (called by visual-diff.sh).
#
# Triggered when: agent = betelgeuse AND recipient = sirius AND task touches visual surfaces.

if [[ "$AGENT" == "betelgeuse" && "$RECIPIENT_LC" == "sirius" ]]; then
  # (a) Prototype existence check
  PROTO_PATH=".claude/visual-diffs/${TASK_ID}/prototype/index.html"
  if [[ ! -f "$PROTO_PATH" ]]; then
    echo "[pre-handoff] ADVISORY: prototype not found at $PROTO_PATH" >&2
    echo "  A locked prototype should exist before handing off to Sirius." >&2
    echo "  See docs/team/WORKFLOW-HTML-FIRST-SPEC.md §3 step 5 (direction lock)." >&2
  fi

  # (b) Spec line-count check — scan docs/design/*.md files touched by this task
  SPEC_LINE_CAP=220
  # Identify surface spec files in files_touched that live under docs/design/
  while IFS= read -r fpath; do
    if [[ "$fpath" =~ ^docs/design/[^/]+\.md$ && -f "$fpath" ]]; then
      SPEC_LINES=$(wc -l < "$fpath" | tr -d ' ')
      if [[ "$SPEC_LINES" -gt "$SPEC_LINE_CAP" ]]; then
        echo "[pre-handoff] ADVISORY: $fpath is $SPEC_LINES lines (cap is $SPEC_LINE_CAP for visual surfaces)" >&2
        echo "  Specs past 220 lines stop being read and step into prototype territory." >&2
        echo "  See docs/team/WORKFLOW-HTML-FIRST-SPEC.md §3 Rule 3 + §4 for what belongs in prototype vs spec." >&2
      fi
    fi
  done < <(jq -r '.files_touched | .[]' "$SIG_FILE" 2>/dev/null)
fi

# 4e. Atom-reuse check — triggered when HANDOFF_TYPE=SPEC and recipient is Sirius.
#
# Rule 5 (WORKFLOW-HTML-FIRST-SPEC.md, proposed by Betelgeuse Phase 2c):
#   Every surface spec handed to Sirius must list the gallery atom ids it uses.
#   This check enforces that the "atoms used" table exists, that every cited atom
#   id is present in the gallery manifest, and that new atoms are already landed.
#
# Fail codes written to log (also echoed to stderr):
#   ATOM-TABLE-MISSING    — no "atoms used" table in the spec
#   ATOM-ID-NOT-FOUND     — "from gallery=yes" row cites an id absent from manifest
#   NEW-ATOM-NOT-LANDED   — "new" atom id absent from manifest or gallery.html
#
# Warnings (non-blocking):
#   RE-DERIVE-SUSPECTED   — raw visual primitive description found outside a code fence

ATOM_CHECK_EXIT=0
if [[ "${HANDOFF_TYPE:-}" == "SPEC" && "$RECIPIENT_LC" == "sirius" ]]; then
  ATOM_LOG_DIR="${REPO_ROOT:-.}/.claude/hook-logs"
  mkdir -p "${ATOM_LOG_DIR}"
  ATOM_LOG="${ATOM_LOG_DIR}/${TASK_ID}--atom-check.log"
  MANIFEST="${REPO_ROOT:-.}/.claude/visual-diffs/soul-atlas/manifest.json"
  GALLERY="${REPO_ROOT:-.}/.claude/visual-diffs/soul-atlas/gallery.html"

  atom_log() { echo "[atom-check] $*" | tee -a "${ATOM_LOG}"; }
  atom_err() { echo "[atom-check] FAIL: $*" | tee -a "${ATOM_LOG}" >&2; }
  atom_warn() { echo "[atom-check] WARN: $*" | tee -a "${ATOM_LOG}" >&2; }

  atom_log "start · task=${TASK_ID} · recipient=${RECIPIENT_LC} · $(date -u +%Y-%m-%dT%H:%M:%SZ)"

  # Locate the surface spec: scan files_touched for docs/design/*.md
  SPEC_FILE=""
  while IFS= read -r fpath; do
    if [[ "$fpath" =~ ^docs/design/[^/]+\.md$ && -f "${REPO_ROOT:-.}/$fpath" ]]; then
      SPEC_FILE="${REPO_ROOT:-.}/$fpath"
      atom_log "spec file: $fpath"
      break
    fi
  done < <(jq -r '.files_touched | .[]' "$SIG_FILE" 2>/dev/null)

  if [[ -z "$SPEC_FILE" ]]; then
    atom_log "no docs/design/*.md in files_touched — atom-reuse check not applicable; skipping"
  else
    # Check manifest and gallery exist (required for any meaningful atom check)
    if [[ ! -f "${MANIFEST}" ]]; then
      atom_err "ATOM-TABLE-MISSING (pre-condition) — soul-atlas manifest.json not found; cannot verify atom ids"
      ATOM_CHECK_EXIT=1
    elif ! jq empty "${MANIFEST}" 2>/dev/null; then
      atom_err "ATOM-TABLE-MISSING (pre-condition) — manifest.json is invalid JSON"
      ATOM_CHECK_EXIT=1
    else
      # ── 1. Check atoms-used table exists ──────────────────────────────────────
      # The table must have an "## atoms used" heading (case-insensitive, optional spaces)
      if ! grep -qiE '^##[[:space:]]+atoms[[:space:]]+used' "${SPEC_FILE}"; then
        atom_err "ATOM-TABLE-MISSING — surface spec has no 'atoms used' table (Rule 5): ${SPEC_FILE}"
        ATOM_CHECK_EXIT=1
      else
        atom_log "atoms used table found"

        # ── 2. Parse each row of the atoms-used table ─────────────────────────
        # Table format (Betelgeuse §2):
        #   | atom id               | from gallery | role ...  |
        # We grep for pipe-delimited rows after the heading.
        # Bash 3.2: no mapfile, no associative arrays. Use positional parsing.

        IN_TABLE=0
        while IFS= read -r line; do
          # Detect heading
          if echo "$line" | grep -qiE '^##[[:space:]]+atoms[[:space:]]+used'; then
            IN_TABLE=1
            continue
          fi
          # Stop at next ## heading
          if [[ "$IN_TABLE" -eq 1 ]] && echo "$line" | grep -qE '^##'; then
            IN_TABLE=0
            break
          fi
          # Skip if not in table
          [[ "$IN_TABLE" -eq 0 ]] && continue
          # Skip separator and header rows (contain only dashes/pipes/spaces)
          echo "$line" | grep -qE '^\|[-| :]+\|$' && continue
          echo "$line" | grep -qiE '^\|[[:space:]]*atom[[:space:]]+id' && continue
          # Must be a pipe-delimited data row
          echo "$line" | grep -qE '^\|' || continue

          # Extract columns: | atom id | from gallery | role |
          # col1=atom_id, col2=from_gallery
          raw_atom_id=$(echo "$line" | awk -F'|' '{print $2}' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
          raw_from_gallery=$(echo "$line" | awk -F'|' '{print $3}' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

          # Strip markdown backtick wrapping from atom_id if present
          atom_id=$(echo "$raw_atom_id" | sed 's/`//g')
          from_gallery=$(echo "$raw_from_gallery" | tr '[:upper:]' '[:lower:]')

          [[ -z "$atom_id" ]] && continue

          atom_log "checking row: id='${atom_id}' from_gallery='${from_gallery}'"

          if echo "$from_gallery" | grep -qE '^yes$'; then
            # ── 2a. "from gallery=yes" — must exist in manifest ─────────────
            if ! jq -e --arg id "$atom_id" '.atoms[] | select(.id == $id)' "${MANIFEST}" >/dev/null 2>&1; then
              atom_err "ATOM-ID-NOT-FOUND: '${atom_id}' — cited as existing gallery atom but absent from manifest"
              ATOM_CHECK_EXIT=1
            else
              atom_log "atom '${atom_id}' found in manifest (from gallery=yes)"
            fi

          elif echo "$from_gallery" | grep -qiE '^new[[:space:]]*[—\-]'; then
            # ── 2b. "new — manifest entry at <atom-id>" ─────────────────────
            # Extract the atom-id from the column value.
            # Betelgeuse format: "new — manifest entry at `<id>`" or "new — manifest entry at <id>"
            new_id=$(echo "$from_gallery" | sed 's/.*entry at[[:space:]]*//' | sed 's/`//g' | sed 's/[[:space:]]*$//')
            # If extraction yields empty, fall back to the atom_id column value
            [[ -z "$new_id" ]] && new_id="$atom_id"

            MISSING_PART=""
            # Check manifest
            if ! jq -e --arg id "$new_id" '.atoms[] | select(.id == $id)' "${MANIFEST}" >/dev/null 2>&1; then
              MISSING_PART="manifest"
            fi
            # Check gallery.html section (data-atom-id="<id>")
            if [[ -f "${GALLERY}" ]]; then
              if ! grep -q -- "data-atom-id=\"${new_id}\"" "${GALLERY}"; then
                if [[ -n "$MISSING_PART" ]]; then
                  MISSING_PART="${MISSING_PART}+gallery.html"
                else
                  MISSING_PART="gallery.html"
                fi
              fi
            else
              if [[ -n "$MISSING_PART" ]]; then
                MISSING_PART="${MISSING_PART}+gallery.html(not found)"
              else
                MISSING_PART="gallery.html(not found)"
              fi
            fi

            if [[ -n "$MISSING_PART" ]]; then
              atom_err "NEW-ATOM-NOT-LANDED: '${new_id}' — spec claims new atom but gallery entry is absent (${MISSING_PART})"
              ATOM_CHECK_EXIT=1
            else
              atom_log "new atom '${new_id}' landed in manifest + gallery.html"
            fi
          fi

        done < "${SPEC_FILE}"

        # ── 3. Inverse re-derive scan (non-blocking warnings) ────────────────
        # Scan for raw visual primitive prose descriptions outside code fences.
        # Patterns from Betelgeuse §4: JetBrains Mono, Cormorant Garamond,
        # Special Elite, corner-marks, dashed, reticle.
        REDERIVE_TERMS="JetBrains Mono|Cormorant Garamond|Special Elite|corner-marks|corner mark|reticle|dashed border|dashed hairline"
        IN_FENCE=0
        LINE_NO=0
        while IFS= read -r line; do
          LINE_NO=$(( LINE_NO + 1 ))
          # Track code fences
          if echo "$line" | grep -qE '^[[:space:]]*```'; then
            if [[ "$IN_FENCE" -eq 0 ]]; then
              IN_FENCE=1
            else
              IN_FENCE=0
            fi
            continue
          fi
          [[ "$IN_FENCE" -eq 1 ]] && continue
          # Check for re-derive patterns
          if echo "$line" | grep -qiE "${REDERIVE_TERMS}"; then
            match=$(echo "$line" | grep -oiE "${REDERIVE_TERMS}" | head -1)
            atom_warn "RE-DERIVE-SUSPECTED: '${match}' at line ${LINE_NO} — consider citing gallery atom instead of re-describing"
          fi
        done < "${SPEC_FILE}"

      fi  # atoms-used table found
    fi  # manifest exists
  fi  # spec file found

  if [[ "$ATOM_CHECK_EXIT" -eq 0 ]]; then
    atom_log "PASS — atom-reuse check clean"
  else
    atom_log "FAIL — atom-reuse check found violations (see above)"
    echo "[pre-handoff] atom-reuse check FAILED — resolve ATOM-* violations before handoff to Sirius" >&2
    exit 13
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
