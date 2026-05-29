#!/usr/bin/env bash
# scripts/audit-visual-diff-directions.sh
# Audits .claude/visual-diffs/<TASK_ID>/directions/ discipline.
#
# Usage:
#   bash scripts/audit-visual-diff-directions.sh <task_id>
#   bash scripts/audit-visual-diff-directions.sh <task_id> --check-only
#
# Exit codes:
#   0  — PASS (no blocking violations; advisory warnings may have been emitted)
#   1  — BLOCK (one or more Rule 4 soul-baseline violations; handoff refused)
#   2  — usage error
#
# Severity model (Peat directive 2026-05-26):
#   ADVISORY — items 1, 2, 5, 7 (layout + STATUS hygiene + DIRECTIONS.md existence)
#   BLOCKING  — items 3, 4, 6 (Rule 4 soul-baseline fields + path resolution + carried-forward)
#
# Rationale (quote in blocking messages):
#   "การ design ต้องทำจาก prototype เป็นรากฐาน ... keep ความเป็น unity ได้ ...
#    เก็บตรงนี้ไว้ harness + เป็น policy ด้วย" — Peat, 2026-05-26
#
# Rail: html-first-spec-discipline
# Doc:  docs/harness/RAIL-DEFINITIONS.md#rail-html-first-spec-discipline
# Spec: docs/team/WORKFLOW-HTML-FIRST-SPEC.md Rule 4 + §5

set -uo pipefail

# ---------------------------------------------------------------------------
# Arguments
# ---------------------------------------------------------------------------
TASK_ID="${1:-}"
if [[ -z "$TASK_ID" ]]; then
  echo "audit-visual-diff-directions: usage: $0 <task_id> [--check-only]" >&2
  exit 2
fi

CHECK_ONLY=false
if [[ "${2:-}" == "--check-only" ]]; then
  CHECK_ONLY=true
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
VD_DIR="$REPO_ROOT/.claude/visual-diffs/$TASK_ID"
DIRECTIONS_DIR="$VD_DIR/directions"
STATUS_FILE="$VD_DIR/STATUS"
TOP_DIRECTIONS_MD="$VD_DIR/DIRECTIONS.md"
LOG_DIR="$REPO_ROOT/.claude/hook-logs"

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/${TASK_ID}--audit-visual-diff-directions.log"

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------
TS() { date -u '+%Y-%m-%dT%H:%M:%SZ'; }

log()      { printf '[%s] %s\n' "$(TS)" "$*" | tee -a "$LOG_FILE"; }
advisory() { printf '[ADVISORY] %s\n' "$*" | tee -a "$LOG_FILE" >&2; }
block()    { printf '[BLOCK]    %s\n' "$*" | tee -a "$LOG_FILE" >&2; }

log "audit-visual-diff-directions: task=$TASK_ID"

# ---------------------------------------------------------------------------
# Guard: VD directory must exist
# ---------------------------------------------------------------------------
if [[ ! -d "$VD_DIR" ]]; then
  log "SKIP — visual-diffs directory not found: $VD_DIR"
  exit 0
fi

# ---------------------------------------------------------------------------
# Guard: if no directions/ directory, nothing to check. This is the forward-
# only guard. Pre-spec-workflow tasks (e.g. UI-ITER-1-globe-v1) have no
# directions/ and MUST NOT be flagged as violations.
# ---------------------------------------------------------------------------
if [[ ! -d "$DIRECTIONS_DIR" ]]; then
  log "SKIP — no directions/ directory at $DIRECTIONS_DIR (pre-workflow or not yet started)"
  exit 0
fi

log "directions/ found — running discipline checks"

BLOCKING_VIOLATIONS=0
ADVISORY_VIOLATIONS=0

# ---------------------------------------------------------------------------
# Helper: read STATUS value (empty string if file absent)
# ---------------------------------------------------------------------------
read_status() {
  if [[ -f "$STATUS_FILE" ]]; then
    tr -d '[:space:]' < "$STATUS_FILE"
  else
    echo ""
  fi
}

STATUS_VAL="$(read_status)"

# ---------------------------------------------------------------------------
# Helper: check that a README.md contains all required Rule 4 fields.
# Returns 0 if all present, 1 if any missing.
# Emits MISSING_FIELDS (space-separated) to stdout.
# ---------------------------------------------------------------------------
check_rule4_fields() {
  local readme="$1"
  local missing=""
  local required_fields=(
    "soul-baseline:"
    "connection-point:"
    "continuity:"
    "evolution:"
    "bet:"
  )
  for field in "${required_fields[@]}"; do
    if ! grep -qiE "^[[:space:]]*${field}" "$readme" 2>/dev/null; then
      missing="$missing $field"
    fi
  done
  echo "$missing"
}

# ---------------------------------------------------------------------------
# Helper: extract soul-baseline path from a README.md
# Returns the value after "soul-baseline:" (first match, trimmed)
# ---------------------------------------------------------------------------
extract_soul_baseline() {
  local readme="$1"
  grep -iE "^[[:space:]]*soul-baseline:" "$readme" 2>/dev/null \
    | head -1 \
    | sed -E 's/^[[:space:]]*soul-baseline:[[:space:]]*//' \
    | tr -d '\r' \
    | xargs  # trim
}

# ---------------------------------------------------------------------------
# S2-item-1 · directions/ contains 2-4 subdirectories named direction-{1..N}
# Severity: ADVISORY
# ---------------------------------------------------------------------------
log "--- S2-item-1: directions/ subdirectory count and naming ---"

DIRECTION_DIRS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && DIRECTION_DIRS+=("$line")
done < <(find "$DIRECTIONS_DIR" -mindepth 1 -maxdepth 1 -type d -name 'direction-[0-9]*' | sort)

DIRECTION_COUNT="${#DIRECTION_DIRS[@]}"

# Also check for any directories that do NOT match direction-N naming
ALL_SUBDIRS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && ALL_SUBDIRS+=("$line")
done < <(find "$DIRECTIONS_DIR" -mindepth 1 -maxdepth 1 -type d | sort)
UNEXPECTED_COUNT=0
for subdir in "${ALL_SUBDIRS[@]}"; do
  basename_dir="$(basename "$subdir")"
  if [[ ! "$basename_dir" =~ ^direction-[0-9]+$ ]]; then
    advisory "S2-item-1: unexpected subdirectory '$basename_dir' in directions/ (expected direction-{N} naming)"
    UNEXPECTED_COUNT=$(( UNEXPECTED_COUNT + 1 ))
  fi
done

if [[ "$DIRECTION_COUNT" -lt 2 ]]; then
  advisory "S2-item-1: directions/ has $DIRECTION_COUNT direction-N subdirector(ies); minimum is 2 for multi-direction exploration (Rule 2)"
  ADVISORY_VIOLATIONS=$(( ADVISORY_VIOLATIONS + 1 ))
elif [[ "$DIRECTION_COUNT" -gt 4 ]]; then
  advisory "S2-item-1: directions/ has $DIRECTION_COUNT direction-N subdirectories; maximum is 4 (consider consolidating before review)"
  ADVISORY_VIOLATIONS=$(( ADVISORY_VIOLATIONS + 1 ))
else
  log "S2-item-1: PASS — $DIRECTION_COUNT direction(s) found (valid range 2-4)"
fi

# ---------------------------------------------------------------------------
# S2-item-2 · each direction-N/ contains index.html + README.md
# Severity: ADVISORY
# ---------------------------------------------------------------------------
log "--- S2-item-2: index.html + README.md presence in each direction ---"

ITEM2_FAIL=0
for dir in "${DIRECTION_DIRS[@]}"; do
  dname="$(basename "$dir")"
  if [[ ! -f "$dir/index.html" ]]; then
    advisory "S2-item-2: $dname/index.html is missing"
    ITEM2_FAIL=1
  fi
  if [[ ! -f "$dir/README.md" ]]; then
    advisory "S2-item-2: $dname/README.md is missing"
    ITEM2_FAIL=1
  fi
done

if [[ "$ITEM2_FAIL" -eq 0 ]]; then
  log "S2-item-2: PASS — index.html + README.md present in all ${DIRECTION_COUNT} direction(s)"
else
  ADVISORY_VIOLATIONS=$(( ADVISORY_VIOLATIONS + 1 ))
fi

# ---------------------------------------------------------------------------
# S2-item-3 · Rule 4 fields present in each direction-N/README.md
# Severity: BLOCKING
# ---------------------------------------------------------------------------
log "--- S2-item-3: Rule 4 required fields in each direction README.md (BLOCKING) ---"

ITEM3_FAIL=0
for dir in "${DIRECTION_DIRS[@]}"; do
  dname="$(basename "$dir")"
  readme="$dir/README.md"
  if [[ ! -f "$readme" ]]; then
    # Already reported under item 2; missing README means items 3+4 also fail
    block "S2-item-3: $dname/README.md is absent — Rule 4 fields cannot be verified"
    block "  Rationale: \"การ design ต้องทำจาก prototype เป็นรากฐาน ... keep ความเป็น unity ได้\" (Peat, 2026-05-26)"
    block "  Fix: add README.md with soul-baseline: connection-point: continuity: evolution: bet:"
    ITEM3_FAIL=1
    continue
  fi

  MISSING="$(check_rule4_fields "$readme")"
  if [[ -n "$MISSING" ]]; then
    block "S2-item-3: $dname/README.md is missing required Rule 4 fields: $MISSING"
    block "  Rationale: \"การ design ต้องทำจาก prototype เป็นรากฐาน ... keep ความเป็น unity ได้\" (Peat, 2026-05-26)"
    block "  Fix: add missing fields. See docs/team/WORKFLOW-HTML-FIRST-SPEC.md §5 for required format."
    ITEM3_FAIL=1
  else
    log "S2-item-3: PASS — $dname/README.md has all Rule 4 fields"
  fi
done

if [[ "$ITEM3_FAIL" -ne 0 ]]; then
  BLOCKING_VIOLATIONS=$(( BLOCKING_VIOLATIONS + 1 ))
fi

# ---------------------------------------------------------------------------
# S2-item-4 · soul-baseline path must resolve to an existing file
# Severity: BLOCKING
# ---------------------------------------------------------------------------
log "--- S2-item-4: soul-baseline path resolution (BLOCKING) ---"

ITEM4_FAIL=0
for dir in "${DIRECTION_DIRS[@]}"; do
  dname="$(basename "$dir")"
  readme="$dir/README.md"
  if [[ ! -f "$readme" ]]; then
    continue  # missing README already flagged under item 3
  fi

  SB_VALUE="$(extract_soul_baseline "$readme")"

  if [[ -z "$SB_VALUE" ]]; then
    # Field was absent — caught by item 3; don't double-count
    continue
  fi

  # Reject blank-slate declarations explicitly
  SB_LOWER="$(echo "$SB_VALUE" | tr '[:upper:]' '[:lower:]')"
  case "$SB_LOWER" in
    none|blank*|"blank-slate"|"n/a"|"-"|"")
      block "S2-item-4: $dname/README.md declares soul-baseline: '$SB_VALUE'"
      block "  Rule 4 forbids blank-slate generation. Declare a path to an existing locked prototype."
      block "  Rationale: \"การ design ต้องทำจาก prototype เป็นรากฐาน ... keep ความเป็น unity ได้\" (Peat, 2026-05-26)"
      block "  Fix: set soul-baseline to a path like .claude/visual-diffs/UI-ITER-1-globe-v1/prototype/index.html"
      ITEM4_FAIL=1
      continue
      ;;
  esac

  # Resolve path: if relative (no leading /), resolve from repo root
  if [[ "$SB_VALUE" == /* ]]; then
    RESOLVED="$SB_VALUE"
  else
    RESOLVED="$REPO_ROOT/$SB_VALUE"
  fi

  if [[ ! -f "$RESOLVED" ]]; then
    block "S2-item-4: $dname/README.md soul-baseline path does not resolve:"
    block "  declared:  $SB_VALUE"
    block "  resolved:  $RESOLVED"
    block "  The referenced prototype must exist before this direction is valid."
    block "  Rationale: \"การ design ต้องทำจาก prototype เป็นรากฐาน ... keep ความเป็น unity ได้\" (Peat, 2026-05-26)"
    block "  Fix: update soul-baseline to a path that resolves to a real file, or ensure the baseline prototype exists."
    ITEM4_FAIL=1
  else
    log "S2-item-4: PASS — $dname soul-baseline resolves: $SB_VALUE"
  fi
done

if [[ "$ITEM4_FAIL" -ne 0 ]]; then
  BLOCKING_VIOLATIONS=$(( BLOCKING_VIOLATIONS + 1 ))
fi

# ---------------------------------------------------------------------------
# S2-item-5 · if prototype/ and directions/ coexist, STATUS must not be exploring
# Severity: ADVISORY
# ---------------------------------------------------------------------------
log "--- S2-item-5: STATUS coherence when prototype/ coexists with directions/ ---"

if [[ -d "$VD_DIR/prototype" ]]; then
  if [[ "$STATUS_VAL" == "exploring" ]]; then
    advisory "S2-item-5: prototype/ exists alongside directions/ but STATUS='exploring'"
    advisory "  Lock has already happened. Update STATUS to 'locked' or remove the stale exploring annotation."
    advisory "  See docs/harness/RAIL-DEFINITIONS.md for the STATUS value table."
    ADVISORY_VIOLATIONS=$(( ADVISORY_VIOLATIONS + 1 ))
  else
    log "S2-item-5: PASS — STATUS='$STATUS_VAL' is coherent with prototype/ presence"
  fi
else
  log "S2-item-5: N/A — prototype/ does not yet exist alongside directions/"
fi

# ---------------------------------------------------------------------------
# S2-item-6 · if STATUS is locked/past, prototype/index.html must exist AND
#             prototype/README.md must carry forward soul-baseline
# Severity: BLOCKING
# ---------------------------------------------------------------------------
log "--- S2-item-6: prototype requirements when STATUS is locked/past (BLOCKING) ---"

LOCKED_STATUSES=("locked" "revise-1" "revise-2" "revise-3" "revise-4" "betelgeuse-approved")

IS_LOCKED=false
for s in "${LOCKED_STATUSES[@]}"; do
  if [[ "$STATUS_VAL" == "$s" ]]; then
    IS_LOCKED=true
    break
  fi
done
# Also match revise-N generically
if [[ "$STATUS_VAL" =~ ^revise-[0-9]+$ ]]; then
  IS_LOCKED=true
fi

ITEM6_FAIL=0
if $IS_LOCKED; then
  PROTO_HTML="$VD_DIR/prototype/index.html"
  PROTO_README="$VD_DIR/prototype/README.md"

  if [[ ! -f "$PROTO_HTML" ]]; then
    block "S2-item-6: STATUS='$STATUS_VAL' (locked/past) but prototype/index.html does not exist"
    block "  A locked direction must be promoted to prototype/. Ensure index.html is present."
    block "  Rationale: \"การ design ต้องทำจาก prototype เป็นรากฐาน ... keep ความเป็น unity ได้\" (Peat, 2026-05-26)"
    ITEM6_FAIL=1
  else
    log "S2-item-6: PASS — prototype/index.html exists"
  fi

  if [[ ! -f "$PROTO_README" ]]; then
    block "S2-item-6: STATUS='$STATUS_VAL' (locked/past) but prototype/README.md does not exist"
    block "  prototype/README.md must carry forward the soul-baseline field from the chosen direction."
    ITEM6_FAIL=1
  else
    SB_IN_PROTO="$(extract_soul_baseline "$PROTO_README")"
    if [[ -z "$SB_IN_PROTO" ]]; then
      block "S2-item-6: prototype/README.md is missing the soul-baseline field"
      block "  The locked prototype README must carry forward soul-baseline from the chosen direction."
      block "  Rationale: \"การ design ต้องทำจาก prototype เป็นรากฐาน ... keep ความเป็น unity ได้\" (Peat, 2026-05-26)"
      block "  Fix: add 'soul-baseline: <path>' to prototype/README.md"
      ITEM6_FAIL=1
    else
      log "S2-item-6: PASS — prototype/README.md has soul-baseline: $SB_IN_PROTO"
    fi
  fi
fi

if [[ "$ITEM6_FAIL" -ne 0 ]]; then
  BLOCKING_VIOLATIONS=$(( BLOCKING_VIOLATIONS + 1 ))
fi

# ---------------------------------------------------------------------------
# S2-item-7 · DIRECTIONS.md exists at task root when directions/ exists,
#             contains soul-baseline field + "unity check" heading
# Severity: ADVISORY
# ---------------------------------------------------------------------------
log "--- S2-item-7: DIRECTIONS.md existence and structure ---"

if [[ ! -f "$TOP_DIRECTIONS_MD" ]]; then
  advisory "S2-item-7: DIRECTIONS.md is absent at $TOP_DIRECTIONS_MD"
  advisory "  Per §3 of the workflow spec, Betelgeuse writes DIRECTIONS.md summarising all directions"
  advisory "  with a top-level soul-baseline field and a 'unity check' section."
  advisory "  See docs/team/WORKFLOW-HTML-FIRST-SPEC.md §3 step 3."
  ADVISORY_VIOLATIONS=$(( ADVISORY_VIOLATIONS + 1 ))
else
  ITEM7_WARN=0
  if ! grep -qiE "^[[:space:]]*soul-baseline:" "$TOP_DIRECTIONS_MD"; then
    advisory "S2-item-7: DIRECTIONS.md is missing a top-level 'soul-baseline:' field"
    ITEM7_WARN=1
  fi
  if ! grep -qiE "^#+[[:space:]]*unity[[:space:]]+check" "$TOP_DIRECTIONS_MD"; then
    advisory "S2-item-7: DIRECTIONS.md is missing a 'unity check' section heading"
    ITEM7_WARN=1
  fi
  if [[ "$ITEM7_WARN" -eq 0 ]]; then
    log "S2-item-7: PASS — DIRECTIONS.md has soul-baseline field + unity check heading"
  else
    ADVISORY_VIOLATIONS=$(( ADVISORY_VIOLATIONS + 1 ))
  fi
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
log "--- SUMMARY ---"
log "  advisory violations : $ADVISORY_VIOLATIONS"
log "  blocking violations : $BLOCKING_VIOLATIONS"

if [[ "$BLOCKING_VIOLATIONS" -gt 0 ]]; then
  log "RESULT: BLOCK — $BLOCKING_VIOLATIONS blocking Rule 4 violation(s). Handoff refused until resolved."
  log "  Advisory violations (non-blocking): $ADVISORY_VIOLATIONS"
  exit 1
elif [[ "$ADVISORY_VIOLATIONS" -gt 0 ]]; then
  log "RESULT: ADVISORY — $ADVISORY_VIOLATIONS advisory violation(s). Work may continue but clean-up is expected."
  exit 0
else
  log "RESULT: PASS — all checks passed."
  exit 0
fi
