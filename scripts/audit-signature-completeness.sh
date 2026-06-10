#!/usr/bin/env bash
# scripts/audit-signature-completeness.sh
# Sensor 0.6 — signature completeness audit (WARN-mode).
# Owner: Canopus (α-HRN-07)
# Task: TASK-2026-06-10-SOUL-FACTORY · Phase 0 slice 0.6
#
# PURPOSE
# -------
# Every TASK recorded in docs/team/STATUS.md should have ≥1 corresponding
# signature in .claude/signatures/. This script reports gaps. The signed/total
# ratio is the denominator for the autonomy metric.
#
# WARN-MODE: exits 0 even when gaps are found. See FLIP-TO-FAIL below.
#
# STATUS.md HEADER EXTRACTION
# ---------------------------
# Only level-2 headers (^## ) are scanned. The regex:
#   grep -aE '^## (TASK|REVISE|MINI)-[0-9]{4}-[0-9]{2}-[0-9]{2}-[A-Z0-9-]+'
# then strip the '## '.
#
# This scopes extraction to headers only — prose body lines that mention a
# task id are NOT counted. A prose mention cannot start with '^## '.
#
# MATCHING RULE (tolerant — over-matching is the safer bias for WARN mode)
# -----------------------------------------------------------------------
# A STATUS task id is considered "signed" if ANY signature file's .task_id
# satisfies one of:
#   (1) EXACT: sig_task_id == status_task_id
#   (2) CONTAINS: status_task_id is a substring of sig_task_id
#       e.g. TASK-2026-05-29-SOUL-FACTORY matches TASK-2026-05-29-SOUL-FACTORY-P0
#   (3) STEM: sig_task_id has a known non-TASK type prefix (REVISE-/MINI-/
#       EXPLORE-/DEV-PLAN-/FIX-/S1-/SURVEY-/BATCH-AUDIT-/BRAINSTORM-/NETRA-RECON-)
#       → replace that prefix with "TASK-" → derived form == status_task_id
#       e.g. REVISE-2099-01-03-BAZ → TASK-2099-01-03-BAZ matches TASK-2099-01-03-BAZ
#       Only the TYPE keyword is replaced; YYYY-MM-DD-SLUG is preserved exactly.
#
# BIAS: over-matching produces false-NOT-gaps (a STATUS task appears signed
# when it might only be signed under a sub-slice). This is the right bias for
# WARN mode — we avoid noisy false gaps that would desensitize the sensor.
# Once the matching rule is confirmed against a full STATUS pass and false-gaps
# are zero, promote to exit 1 on gaps (see FLIP-TO-FAIL below).
#
# FLIP-TO-FAIL
# ------------
# This sensor exits 0 even with gaps. To promote to a blocking check:
#   1. Run against a full STATUS.md pass and confirm no false gaps remain.
#   2. Change the final `exit 0` to `[[ "$GAPS" -eq 0 ]] || exit 1`.
#   3. Update .harness/worldline-harness.config.json to add this rail.
#
# EXIT CODES
# ----------
#   0 — completed (WARN-mode; gaps reported but do not block)
#   2 — internal error: missing dependency or bad arguments
#
# ENVIRONMENT OVERRIDES (for tests — never touch real files)
# ----------------------------------------------------------
#   WL_STATUS_FILE      override path to STATUS.md
#                       default: $REPO_DIR/docs/team/STATUS.md
#   WL_SIGNATURES_DIR   override path to signatures dir
#                       default: $REPO_DIR/.claude/signatures
#
# LOGS TO
#   .claude/hook-logs/<task_id>--audit-signature-completeness.log
#
# NOT WIRED via settings.json — standalone audit rail. See FLIP-TO-FAIL above.
# Style mirrors scripts/audit-handoff-integrity.sh.

set -uo pipefail

# ---------------------------------------------------------------------------
# Dependencies check
# ---------------------------------------------------------------------------
for dep in jq grep find awk; do
  if ! command -v "$dep" >/dev/null 2>&1; then
    printf 'ERROR [audit-signature-completeness] missing dependency: %s\n' "$dep" >&2
    exit 2
  fi
done

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
REPO_DIR="${CLAUDE_PROJECT_DIR:-/Users/neospiritth/codingspace/personal_website}"
STATUS_FILE="${WL_STATUS_FILE:-$REPO_DIR/docs/team/STATUS.md}"
SIGNATURES_DIR="${WL_SIGNATURES_DIR:-$REPO_DIR/.claude/signatures}"

LOG_DIR="$REPO_DIR/.claude/hook-logs"
mkdir -p "$LOG_DIR" 2>/dev/null || true
TASK_ID="${CLAUDE_TASK_ID:-${WL_TASK_ID:-session-$(date +%s)}}"
LOG="$LOG_DIR/${TASK_ID}--audit-signature-completeness.log"

TIMESTAMP="$(date -u +%FT%TZ)"

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------
log() {
  printf '%s [audit-signature-completeness] %s\n' "$TIMESTAMP" "$*" >> "$LOG" 2>/dev/null || true
}

emit() {
  printf '%s\n' "$*"
  log "$*"
}

# ---------------------------------------------------------------------------
# Start
# ---------------------------------------------------------------------------
log "start ts=$TIMESTAMP status_file=$STATUS_FILE signatures_dir=$SIGNATURES_DIR"
emit "AUDIT-SIGNATURE-COMPLETENESS ts=$TIMESTAMP"
emit "  status_file=$STATUS_FILE"
emit "  signatures_dir=$SIGNATURES_DIR"

# ---------------------------------------------------------------------------
# GATE: STATUS.md must exist
# ---------------------------------------------------------------------------
if [[ ! -f "$STATUS_FILE" ]]; then
  emit "ERROR reason=STATUS_ABSENT detail=STATUS.md not found at $STATUS_FILE"
  log "exit 2 STATUS_ABSENT"
  exit 2
fi

# ---------------------------------------------------------------------------
# GATE: signatures dir must exist
# ---------------------------------------------------------------------------
if [[ ! -d "$SIGNATURES_DIR" ]]; then
  emit "ERROR reason=SIGNATURES_DIR_ABSENT detail=signatures dir not found at $SIGNATURES_DIR"
  log "exit 2 SIGNATURES_DIR_ABSENT"
  exit 2
fi

# ---------------------------------------------------------------------------
# Step 1: Extract STATUS task ids from level-2 headers only
#
# Regex: ^## (TASK|REVISE|MINI)-[0-9]{4}-[0-9]{2}-[0-9]{2}-[A-Z0-9-]+
# Only lines that start with '## ' are matched — prose body lines are excluded
# by the '^## ' anchor. A body prose mention cannot start with '^## '.
#
# grep -a: byte-safe read (STATUS.md has Unicode em-dashes in headers).
# grep -oE: extract only the matching token, not the full line.
# ---------------------------------------------------------------------------
STATUS_IDS="$(grep -aE '^## (TASK|REVISE|MINI)-[0-9]{4}-[0-9]{2}-[0-9]{2}-[A-Z0-9-]+' \
  "$STATUS_FILE" \
  | grep -oE '(TASK|REVISE|MINI)-[0-9]{4}-[0-9]{2}-[0-9]{2}-[A-Z0-9-]+')"

TOTAL_STATUS=0
if [[ -n "$STATUS_IDS" ]]; then
  TOTAL_STATUS="$(printf '%s\n' "$STATUS_IDS" | grep -c .)"
fi

emit "  status_tasks_found=$TOTAL_STATUS"
log "status_ids extracted count=$TOTAL_STATUS"

if [[ "$TOTAL_STATUS" -eq 0 ]]; then
  emit "WARN reason=NO_STATUS_TASKS detail=no level-2 headers matching TASK/REVISE/MINI pattern found"
  emit ""
  emit "DENOMINATOR total=0 signed=0 gaps=0"
  emit ""
  emit "RESULT status=OK_EMPTY exit=0 (no tasks found in STATUS.md)"
  log "exit 0 NO_STATUS_TASKS"
  exit 0
fi

# ---------------------------------------------------------------------------
# Step 2: Build a flat lookup string of all sig task_ids + their derivations
#
# For each JSON file (exclude AUDIT.md and SCHEMA.md), read .task_id with jq.
# We build SIGNED_CORPUS: a newline-delimited string containing every sig
# task_id AND its derived form (with known prefixes stripped), so that a
# single grep pass can test both Rule 1/2 and Rule 3 together.
#
# Malformed/non-JSON files are reported but do not crash the script.
#
# Performance: we read all sigs once up front and store in memory. The per-
# status-id check is then a grep against the in-memory corpus — O(n+m) not
# O(n*m).
# ---------------------------------------------------------------------------
SIGNED_CORPUS=""
MALFORMED_COUNT=0

# Known type-prefixes that appear in sig .task_id values but not in STATUS.md headers.
# STATUS.md headers always begin with TASK-YYYY-MM-DD-; sig task_ids may begin with
# REVISE-, MINI-, EXPLORE-, FIX-, etc. followed by the same date+slug.
#
# Rule 3 normalization: replace the non-TASK type prefix with "TASK-" to produce a
# derived form that STATUS id grep can match.
#
# Example: REVISE-2099-01-03-BAZ
#   → sed strips "REVISE-" → "2099-01-03-BAZ"
#   → prepend "TASK-"     → "TASK-2099-01-03-BAZ"
#   → this derived form is added to the corpus
#   → grep -qF "TASK-2099-01-03-BAZ" then hits on the derived form.
#
# Only the TYPE PREFIX (no date) is stripped. The date+slug is preserved so the
# resulting TASK-YYYY-MM-DD-SLUG form matches STATUS headers exactly.
#
# Order: most-specific patterns first (DEV-PLAN has a letter suffix before the slug).
NORM_TYPE_PREFIX_PATTERNS=(
  "^DEV-PLAN-([0-9]{4}-[0-9]{2}-[0-9]{2}-[A-Z]-)"
  "^DEV-PLAN-([0-9]{4}-[0-9]{2}-[0-9]{2}-)"
  "^REVISE-([0-9]{4}-[0-9]{2}-[0-9]{2}-)"
  "^MINI-([0-9]{4}-[0-9]{2}-[0-9]{2}-)"
  "^EXPLORE-([0-9]{4}-[0-9]{2}-[0-9]{2}-)"
  "^FIX-([0-9]{4}-[0-9]{2}-[0-9]{2}-)"
  "^S1-([0-9]{4}-[0-9]{2}-[0-9]{2}-)"
  "^SURVEY-([0-9]{4}-[0-9]{2}-[0-9]{2}-)"
  "^BATCH-AUDIT-([0-9]{4}-[0-9]{2}-[0-9]{2}-)"
  "^BRAINSTORM-([0-9]{4}-[0-9]{2}-[0-9]{2}-)"
  "^NETRA-RECON-([0-9]{4}-[0-9]{2}-[0-9]{2}-)"
)

while IFS= read -r sig_file; do
  [[ -z "$sig_file" ]] && continue

  # Skip non-JSON metadata files
  case "$(basename "$sig_file")" in
    AUDIT.md|SCHEMA.md) continue ;;
  esac

  # Read .task_id; tolerate malformed files
  sig_task_id="$(jq -r '.task_id // empty' "$sig_file" 2>/dev/null)"
  jq_rc=$?

  if [[ $jq_rc -ne 0 ]] || [[ -z "$sig_task_id" ]]; then
    MALFORMED_COUNT=$(( MALFORMED_COUNT + 1 ))
    emit "  WARN sig=malformed_or_empty_task_id file=$(basename "$sig_file")"
    log "WARN malformed_or_empty_task_id file=$sig_file"
    continue
  fi

  # Add raw task_id to corpus (covers Rules 1 and 2 via substring grep)
  SIGNED_CORPUS="${SIGNED_CORPUS}${sig_task_id}
"

  # Add derived (TASK- normalized) form to corpus (covers Rule 3).
  # Replace a known non-TASK type prefix with "TASK-" so that the derived form
  # starts with "TASK-YYYY-MM-DD-" and matches STATUS.md headers directly.
  for pat in "${NORM_TYPE_PREFIX_PATTERNS[@]}"; do
    derived="$(printf '%s' "$sig_task_id" | sed -E "s/${pat}/TASK-\1/" 2>/dev/null || true)"
    if [[ "$derived" != "$sig_task_id" ]]; then
      # Type prefix was replaced — add the TASK-normalized form to corpus
      SIGNED_CORPUS="${SIGNED_CORPUS}${derived}
"
      break  # only apply the first matching normalization
    fi
  done

done < <(find "$SIGNATURES_DIR" -maxdepth 1 -name "*.json" -type f 2>/dev/null | sort)

# Count unique raw task ids for reporting
TOTAL_SIGS=0
SIGNED_IDS_UNIQ="$(printf '%s' "$SIGNED_CORPUS" | sort -u | grep -v '^$' || true)"
if [[ -n "$SIGNED_IDS_UNIQ" ]]; then
  TOTAL_SIGS="$(printf '%s\n' "$SIGNED_IDS_UNIQ" | grep -c .)"
fi

emit "  signature_corpus_entries=$TOTAL_SIGS (raw + derived ids)"
if [[ "$MALFORMED_COUNT" -gt 0 ]]; then
  emit "  malformed_or_missing_task_id=$MALFORMED_COUNT (non-JSON or .task_id absent)"
fi
log "signature_corpus count=$TOTAL_SIGS malformed=$MALFORMED_COUNT"

# ---------------------------------------------------------------------------
# Step 3: For each STATUS task id, determine if it has a matching signature
#
# MATCHING RULE (documented in header):
#   (1) EXACT:    corpus contains a line == status_id
#   (2) CONTAINS: corpus contains a line where status_id is a substring
#   (3) STEM:     corpus contains a line (derived form) that == or contains status_id
#
# Implementation: one grep call per status_id against the in-memory corpus.
# grep -qF matches substrings (Rule 2). Rule 1 is a subset of Rule 2.
# Rule 3 is handled by the derived forms already in the corpus.
# ---------------------------------------------------------------------------

# Parse status from header line (best-effort annotation; does not affect exit code)
get_status_from_header() {
  local task_id="$1"
  local header_line
  header_line="$(grep -aE "^## [^·]*(${task_id})" "$STATUS_FILE" 2>/dev/null | head -1)"
  local lc_line
  lc_line="$(printf '%s' "$header_line" | tr '[:upper:]' '[:lower:]')"

  if printf '%s' "$lc_line" | grep -qE '\bclosed\b|\bdone\b|\bship\b|\bmerge\b'; then
    printf 'closed'
  elif printf '%s' "$lc_line" | grep -qE '\bparked\b|\bdeferred\b|\bblocked\b'; then
    printf 'parked'
  elif printf '%s' "$lc_line" | grep -qE '\bin-flight\b|\bqueued\b|\bbuilding\b|\binstalled\b|\bsettled\b'; then
    printf 'in-flight'
  else
    printf 'unknown'
  fi
}

SIGNED_COUNT=0
GAPS=0
GAP_LINES=""

while IFS= read -r status_id; do
  [[ -z "$status_id" ]] && continue

  # Single grep against corpus: any corpus line that contains status_id as substring.
  # This handles Rules 1, 2, and 3 (because derived forms are in the corpus).
  if printf '%s' "$SIGNED_CORPUS" | grep -qF "$status_id"; then
    SIGNED_COUNT=$(( SIGNED_COUNT + 1 ))
    log "SIGNED task_id=$status_id"
  else
    GAPS=$(( GAPS + 1 ))
    task_status="$(get_status_from_header "$status_id")"
    severity="gap"
    if [[ "$task_status" == "closed" ]]; then
      severity="gap-closed"  # sharper: closed task with no signature
    fi
    GAP_LINE="GAP task_id=$status_id status=$task_status severity=$severity"
    emit "  $GAP_LINE"
    log "$GAP_LINE"
    GAP_LINES="${GAP_LINES}${GAP_LINE}
"
  fi

done <<< "$STATUS_IDS"

# ---------------------------------------------------------------------------
# Coverage calculation
# ---------------------------------------------------------------------------
COVERAGE_PCT=0
if [[ "$TOTAL_STATUS" -gt 0 ]]; then
  COVERAGE_PCT=$(( (SIGNED_COUNT * 100) / TOTAL_STATUS ))
fi

# ---------------------------------------------------------------------------
# Summary output (machine-greppable DENOMINATOR line)
# ---------------------------------------------------------------------------
emit ""
emit "SUMMARY"
emit "  total_status_tasks=$TOTAL_STATUS"
emit "  signed=$SIGNED_COUNT"
emit "  gaps=$GAPS"
emit "  coverage_pct=${COVERAGE_PCT}%"
emit ""
# Machine-greppable denominator line (autonomy metric)
emit "DENOMINATOR total=$TOTAL_STATUS signed=$SIGNED_COUNT gaps=$GAPS"
emit ""

if [[ "$GAPS" -gt 0 ]]; then
  emit "GAPS (${GAPS}) — tasks in STATUS.md with no matching signature:"
  while IFS= read -r gap_line; do
    [[ -z "$gap_line" ]] && continue
    emit "  - $gap_line"
  done <<< "$GAP_LINES"
  emit ""
  emit "  NOTE: severity=gap-closed means a closed/done task has no signature — sharper gap."
  emit "  NOTE: WARN-mode — gaps do not block. See FLIP-TO-FAIL in script header to promote."
fi

emit "RESULT status=WARN_GAPS exit=0"
log "exit 0 WARN_GAPS total=$TOTAL_STATUS signed=$SIGNED_COUNT gaps=$GAPS coverage=$COVERAGE_PCT"

# WARN-MODE: always exit 0.
# FLIP-TO-FAIL: once false-gaps are confirmed zero after a full STATUS pass,
# change this to:  [[ "$GAPS" -eq 0 ]] || exit 1
exit 0
