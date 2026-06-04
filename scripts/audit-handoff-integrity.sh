#!/usr/bin/env bash
# scripts/audit-handoff-integrity.sh
# Sensor M1 — handoff integrity audit.
# Owner: Canopus (α-HRN-07)
# Task: TASK-2026-06-04-INTEGRITY-SENSOR-M1 · v2 (FALSE-HAVE fixes)
#
# PURPOSE
# -------
# For each .claude/handoffs/from-<agent>/*.md, assert:
#   (a) SHA_MATCH    — on-disk sha256 equals the *latest* ledger entry for that path
#   (b) AUTHOR_MATCH — the containing directory name ("from-<dir>") matches the
#                      recorded WL_AGENT in the ledger entry
#   (c) APPEND_ONLY  — distinct sha256 count across all ledger entries for that path:
#                      == 1 → clean; == 2 → WARN (within-session Write-then-Edit);
#                      >= 3 → BLOCK exit 1 (sustained churn indicates rewrites).
#                      A tamper layered on a 2-sha re-edit is still caught by (a).
#
# NOTE: in-file hash-chain (prev_hash) protection is NOT provided here. The
# real producer (integrity-write-ledger.sh) emits no prev_hash field. Ledger-line
# integrity is provided by the append-only CI-witness over the protected
# integrity-witness ref; see scripts/audit-ledger-append-only.sh.
#
# FALSE-HAVE FIXES (v2 — TASK-2026-06-04-INTEGRITY-SENSOR-M1)
# ---------------------------------------------------------------
# Fix 1 (Refutation A — forged unlisted handoff):
#   Under WL_INTEGRITY_WIRED=1, unlisted_on_disk > 0 is a distinct non-zero exit
#   (exit 4 UNVERIFIABLE_PRESENT), not a prose-only bucket that leaves exit 0.
#   When WL_INTEGRITY_WIRED is unset (default pre-wiring), the prior "informational"
#   behavior is preserved so the honest pre-wiring state stays exit 3 / exit 0.
#
# Fix 2 (Refutation B — in-file hash-chain — STRIPPED, see NOTE above):
#   The in-file prev_hash chain was vestigial: the real producer never emits
#   prev_hash, so every production ledger line was a legacy CHAIN_WARN and
#   CHAIN_BROKEN could only fire against synthetic test fixtures. The claim of
#   chain protection has been removed. Ledger-line integrity is delegated to
#   scripts/audit-ledger-append-only.sh over the CI-witness ref.
#
# Fix 3 (Refutation C — malformed-line truncation):
#   INDEXED_PATHS is built with `jq -R 'fromjson? // empty'` per line so one
#   malformed line cannot abort the stream. All well-formed lines after the bad
#   one are still indexed. The per-path jq calls (all_shas, latest_sha,
#   latest_author) use the same line-tolerant form. If INDEXED_PATHS is empty
#   after line-tolerant parsing despite the ledger having handoff-path lines,
#   that is PARSE_FAILURE → exit 2 (not a silent empty index).
#
# Fix 4 (C4 — canonicalization under WL_HANDOFFS_DIR override):
#   Check-2 disk-walk canonicalization now strips the HANDOFFS_DIR prefix from
#   each disk path and reconstructs the canonical repo-relative path as
#   ".claude/handoffs/<remainder>", matching the form stored in INDEXED_PATHS.
#   This makes the unlisted counter correct under test overrides and production.
#
# MULTI-ENTRY LEDGER SEMANTICS
# The ledger is JSONL, append-only. A single path may have multiple
# entries (idempotent re-records of the same write produce the same sha). Checks:
#   (a) vs latest entry — catches out-of-band edits that bypassed the hook
#   (b) vs latest entry — author field from that same entry
#   (c) count of distinct shas across all entries:
#         1 → clean; 2 → WARN (within-session re-edit); >=3 → BLOCK (sustained churn)
#       A 2-sha WARN does not change the exit code; (a) SHA_MATCH still fires if the
#       on-disk file no longer matches the latest ledger sha (tamper-on-top-of-edit).
#
# EXIT CODES
# ----------
#   0 — all ledger-entry files verified OK;
#       if WL_INTEGRITY_WIRED is unset, unlisted files are informational only
#   1 — at least one MISMATCH detected on assertion (a) or (b), or 3+ distinct shas
#       for a path (c). A 2-sha (c) result is WARN only and does not contribute to
#       exit 1. All genuine tamper/forge paths still exit 1 or 4.
#   2 — internal error: bad arguments, missing dependency, or PARSE_FAILURE
#       on the handoff-path index
#   3 — LEDGER_ABSENT or LEDGER_EMPTY — cannot verify anything; fail-closed
#       This is the honest state when the hook is not yet wired. NOT exit 0.
#   4 — UNVERIFIABLE_PRESENT: WL_INTEGRITY_WIRED=1 and unlisted_on_disk > 0
#       (a handoff is on disk with no ledger entry — forged / unrecorded)
#
# AUTHOR:UNKNOWN POLICY
# If the ledger records author="unknown" (the WL_AGENT-unset fallback), that is
# treated as AUTHOR_UNKNOWN — reported as a distinct failure, not a silent pass.
# An unknown author on a handoff file is a provenance gap.
#
# LEDGER PATH
# Default: ${CLAUDE_PROJECT_DIR}/.harness/integrity-ledger.jsonl
# Override (tests): WL_INTEGRITY_LEDGER=/path/to/temp.jsonl
#
# HANDOFFS ROOT
# Default: ${CLAUDE_PROJECT_DIR}/.claude/handoffs
# Override (tests): WL_HANDOFFS_DIR=/path/to/temp/handoffs
#
# WIRED MODE
# WL_INTEGRITY_WIRED=1 — set only after the hook is wired AND the ledger has
# been seeded with all existing handoffs. Enables exit 4 on unlisted files.
# Default (unset) — unlisted files are informational, not failures.
#
# SCOPE GUARDS (binding — from task spec)
#   - .claude/beta/** is NEVER read, scanned, or touched (Track B, consult-pending)
#   - POLICY-NO-INPLACE-MUTATION: this script only reads; it does not modify
#     any tracked file
#   - No curl/wget/rm; no destructive commands
#
# STANDALONE RUN
#   bash scripts/audit-handoff-integrity.sh
#   WL_INTEGRITY_LEDGER=/tmp/test.jsonl WL_HANDOFFS_DIR=/tmp/htest bash scripts/audit-handoff-integrity.sh
#   WL_INTEGRITY_WIRED=1 WL_INTEGRITY_LEDGER=/tmp/test.jsonl WL_HANDOFFS_DIR=/tmp/htest bash scripts/audit-handoff-integrity.sh
#
# LOGS TO
#   .claude/hook-logs/<task_id>--audit-handoff-integrity.log
#
# NOT WIRED via settings.json — this is a standalone audit rail (like audit-design-tokens.sh),
# not a PostToolUse handler. See .harness/proposed-wiring-M.md for the rail entry proposal.
# Do NOT wire until WL_INTEGRITY_WIRED exit-4 semantics and ledger seeding are complete.

set -uo pipefail

# ---------------------------------------------------------------------------
# Dependencies check
# ---------------------------------------------------------------------------
for dep in jq sha256sum awk grep sort; do
  if ! command -v "$dep" >/dev/null 2>&1; then
    printf 'ERROR [audit-handoff-integrity] missing dependency: %s\n' "$dep" >&2
    exit 2
  fi
done

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
REPO_DIR="${CLAUDE_PROJECT_DIR:-/Users/neospiritth/codingspace/personal_website}"
LEDGER="${WL_INTEGRITY_LEDGER:-$REPO_DIR/.harness/integrity-ledger.jsonl}"
HANDOFFS_DIR="${WL_HANDOFFS_DIR:-$REPO_DIR/.claude/handoffs}"
WIRED="${WL_INTEGRITY_WIRED:-}"   # set to "1" only after hook is wired + ledger seeded

LOG_DIR="$REPO_DIR/.claude/hook-logs"
mkdir -p "$LOG_DIR" 2>/dev/null || true
TASK_ID="${CLAUDE_TASK_ID:-${WL_TASK_ID:-session-$(date +%s)}}"
LOG="$LOG_DIR/${TASK_ID}--audit-handoff-integrity.log"

TIMESTAMP="$(date -u +%FT%TZ)"

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------
log() {
  printf '%s [audit-handoff-integrity] %s\n' "$TIMESTAMP" "$*" >> "$LOG" 2>/dev/null || true
}

emit() {
  # Writes to stdout (structured output) and log
  printf '%s\n' "$*"
  log "$*"
}

# ---------------------------------------------------------------------------
# SCOPE GUARD: refuse to scan .claude/beta/** even if WL_HANDOFFS_DIR points there
# ---------------------------------------------------------------------------
if [[ "$HANDOFFS_DIR" == *".claude/beta"* ]]; then
  emit "ERROR reason=SCOPE_VIOLATION detail=WL_HANDOFFS_DIR points into .claude/beta which is excluded"
  exit 2
fi

# ---------------------------------------------------------------------------
# Start
# ---------------------------------------------------------------------------
log "start ts=$TIMESTAMP ledger=$LEDGER handoffs=$HANDOFFS_DIR wired=${WIRED:-0}"
emit "AUDIT-HANDOFF-INTEGRITY ts=$TIMESTAMP"
emit "  ledger=$LEDGER"
emit "  handoffs=$HANDOFFS_DIR"
emit "  wired_mode=${WIRED:-0}"

# ---------------------------------------------------------------------------
# GATE: ledger must exist and be non-empty
# ---------------------------------------------------------------------------
if [[ ! -f "$LEDGER" ]]; then
  emit "RESULT status=LEDGER_ABSENT reason=ledger file does not exist at $LEDGER"
  emit "  Cannot verify any handoff integrity. Hook is not yet wired."
  emit "  Wire integrity-write-ledger.sh to begin accumulating entries."
  log "exit 3 LEDGER_ABSENT"
  exit 3
fi

# Count handoff-relevant entries (filter to .claude/handoffs/ paths in the ledger)
# grep -c exits 1 on no-match AND prints "0" — do NOT use `|| echo 0` here;
# that would produce "0\n0" (two values) which breaks the arithmetic comparison.
LEDGER_ENTRY_COUNT="$(grep -c '"path"' "$LEDGER" 2>/dev/null || true)"
LEDGER_ENTRY_COUNT="${LEDGER_ENTRY_COUNT:-0}"
if [[ "$LEDGER_ENTRY_COUNT" -eq 0 ]]; then
  emit "RESULT status=LEDGER_EMPTY reason=ledger exists but has zero entries"
  emit "  Cannot verify any handoff integrity. Hook may be wired but no writes have occurred yet."
  log "exit 3 LEDGER_EMPTY"
  exit 3
fi

# Same reasoning as LEDGER_ENTRY_COUNT: grep -c exits 1 on no-match AND prints
# "0", so || echo 0 would produce "0\n0". Use || true and default instead.
HANDOFF_ENTRY_COUNT="$(grep '\.claude/handoffs/' "$LEDGER" 2>/dev/null | grep -c '"path"' || true)"
HANDOFF_ENTRY_COUNT="${HANDOFF_ENTRY_COUNT:-0}"
emit "  ledger_total_entries=$LEDGER_ENTRY_COUNT handoff_entries=$HANDOFF_ENTRY_COUNT"

if [[ "$HANDOFF_ENTRY_COUNT" -eq 0 ]]; then
  emit "RESULT status=LEDGER_NO_HANDOFF_ENTRIES reason=ledger has entries but none for .claude/handoffs/"
  emit "  All handoff files are unverifiable. Hook may be wired but no handoff writes recorded."
  log "exit 3 LEDGER_NO_HANDOFF_ENTRIES"
  exit 3
fi

# ---------------------------------------------------------------------------
# NOTE (M1-hygiene TASK-2026-06-04-M1-CHAIN-STRIP):
# In-file hash-chain (prev_hash / CHAIN_BROKEN) was stripped from this script.
# The real producer (integrity-write-ledger.sh) emits no prev_hash field, so the
# chain check was vestigial — every production line triggered CHAIN_WARN and
# CHAIN_BROKEN could only fire against synthetic fixtures.
# Ledger-line integrity is provided by scripts/audit-ledger-append-only.sh over
# the protected integrity-witness ref, not by this script.
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Build in-memory index from ledger with LINE-TOLERANT parsing
# (Refutation C — malformed-line truncation)
#
# Replace: jq -r 'select(.path | test(...)) | .path' "$LEDGER"
# With:    jq -Rc 'fromjson? // empty' "$LEDGER" | jq -r 'select(.path | test(...)) | .path'
#
# jq -R reads each line as a raw string; fromjson? // empty parses it as JSON
# and emits the object on success, or nothing on failure. This means one bad line
# is skipped and subsequent lines are still processed.
#
# PARSE_FAILURE guard: if INDEXED_PATHS is empty but HANDOFF_ENTRY_COUNT > 0,
# the ledger has handoff-path lines but we couldn't index any — that is an
# internal error, not a silent empty index. Exit 2.
# ---------------------------------------------------------------------------
INDEXED_PATHS="$(jq -Rc 'fromjson? // empty' "$LEDGER" 2>/dev/null \
  | jq -r 'select(.path | test("\\.claude/handoffs/")) | .path' 2>/dev/null \
  | sort -u)"

if [[ -z "$INDEXED_PATHS" ]]; then
  if [[ "$HANDOFF_ENTRY_COUNT" -gt 0 ]]; then
    emit "ERROR check=PARSE_FAILURE reason=ledger has ${HANDOFF_ENTRY_COUNT} handoff entries but none could be indexed (all lines malformed?)"
    emit "  This is an internal error — the ledger may be corrupted or all handoff lines are malformed."
    log "exit 2 PARSE_FAILURE"
    exit 2
  fi
  emit "RESULT status=LEDGER_NO_HANDOFF_ENTRIES reason=no .claude/handoffs paths parseable from ledger"
  log "exit 3 parse-empty"
  exit 3
fi

# ---------------------------------------------------------------------------
# Audit loop
# ---------------------------------------------------------------------------
FAIL_COUNT=0
WARN_COUNT=0
OK_COUNT=0
UNLISTED_COUNT=0
FAIL_REASONS=""

# Helper: append a failure reason to FAIL_REASONS (newline-separated)
add_failure() {
  local reason="$1"
  FAIL_COUNT=$(( FAIL_COUNT + 1 ))
  FAIL_REASONS="${FAIL_REASONS}${reason}
"
  emit "  FAIL $reason"
  log "FAIL $reason"
}

# ---------------------------------------------------------------------------
# Check 1: For each path recorded in the ledger, verify on-disk state.
# This catches (a) sha mismatch and (c) append-only violation.
# (b) author check is also done here per-entry.
# Per-path jq calls also use line-tolerant fromjson? // empty (Fix 3).
# ---------------------------------------------------------------------------
while IFS= read -r canon_path; do
  [[ -z "$canon_path" ]] && continue

  # Scope guard: skip anything that looks like beta (belt-and-suspenders)
  if [[ "$canon_path" == *".claude/beta/"* ]]; then
    log "SKIP (beta exclusion): $canon_path"
    continue
  fi

  # Extract the agent dir from the path: .claude/handoffs/from-<agent>/...
  # The canonical path is repo-relative: .claude/handoffs/from-<agent>/<file>
  dir_segment="$(printf '%s' "$canon_path" | awk -F'/' '{print $3}')"
  # dir_segment should be "from-<agent>"
  if [[ "$dir_segment" != from-* ]]; then
    add_failure "path=$canon_path check=DIR_FORMAT reason=directory segment '${dir_segment}' does not match from-<agent> pattern"
    continue
  fi
  # Extract agent name from "from-<agent>"
  dir_agent="${dir_segment#from-}"

  # Resolve actual file path.
  # canon_path is always ".claude/handoffs/from-<agent>/<file>" (repo-relative).
  # When WL_HANDOFFS_DIR is overridden (tests), we resolve relative to that dir
  # by stripping the ".claude/handoffs/" prefix. In production, HANDOFFS_DIR is
  # $REPO_DIR/.claude/handoffs, so the result is identical to $REPO_DIR/$canon_path.
  handoff_rel="${canon_path#.claude/handoffs/}"
  actual_file="$HANDOFFS_DIR/$handoff_rel"

  # --- (a) SHA_MATCH and (c) APPEND_ONLY ---
  # Pull all entries for this path from ledger with line-tolerant parsing (Fix 3).
  all_shas="$(jq -Rc 'fromjson? // empty' "$LEDGER" 2>/dev/null \
    | jq -r --arg p "$canon_path" 'select(.path==$p) | .sha256' 2>/dev/null)"
  latest_sha="$(printf '%s' "$all_shas" | tail -n1)"
  latest_author="$(jq -Rc 'fromjson? // empty' "$LEDGER" 2>/dev/null \
    | jq -r --arg p "$canon_path" 'select(.path==$p) | .author' 2>/dev/null \
    | tail -n1)"

  # (c) APPEND_ONLY: count distinct shas
  # R3 FIX (CAVEAT 1 — within-session false-positive):
  #   A legitimate Write-then-Edit of the same handoff in one session produces exactly
  #   2 distinct sha256 values in the ledger (initial Write + post-Edit re-record).
  #   That is NOT an integrity violation — it is normal hook-routed re-recording.
  #   Escalating to a block (exit 1) on 2-sha cases was a false-positive that would
  #   fire on every session where a handoff was refined.
  #
  #   New semantics:
  #     distinct_sha_count == 2 → WARN (logged and surfaced in SUMMARY; no exit-1)
  #     distinct_sha_count >= 3 → BLOCK via add_failure (sustained churn; exit 1)
  #
  #   Genuine closures preserved:
  #     (a) SHA_MATCH — still checked below; a tamper on top of a legit re-edit still
  #         exits 1 (the "continue to check (a)" path below handles this)
  #     (c) 3+-sha — still blocks
  distinct_sha_count="$(printf '%s' "$all_shas" | sort -u | grep -c . 2>/dev/null || echo 0)"
  if [[ "$distinct_sha_count" -ge 3 ]]; then
    add_failure "path=$canon_path check=APPEND_ONLY reason=ledger records ${distinct_sha_count} distinct sha256 values — sustained churn indicates in-place rewrites (hook-routed mutation of immutable handoff)"
    # Still continue to check (a) and (b) — more information is better
  elif [[ "$distinct_sha_count" -eq 2 ]]; then
    WARN_COUNT=$(( WARN_COUNT + 1 ))
    emit "  WARN path=$canon_path check=APPEND_ONLY reason=ledger records 2 distinct sha256 values — consistent with within-session Write-then-Edit; review if unexpected"
    log "WARN APPEND_ONLY 2-sha within-session path=$canon_path"
    # Still continue to check (a) and (b) — a tamper layered on a re-edit still exits 1 via SHA_MATCH
  fi

  # (a) SHA_MATCH: file must exist and match latest ledger sha
  if [[ ! -f "$actual_file" ]]; then
    add_failure "path=$canon_path check=SHA_MATCH reason=FILE_MISSING — file exists in ledger but not on disk"
    continue
  fi
  on_disk_sha="$(sha256sum "$actual_file" | awk '{print $1}' 2>/dev/null)" || {
    add_failure "path=$canon_path check=SHA_MATCH reason=SHA256_FAILED — could not compute on-disk hash"
    continue
  }
  if [[ "$on_disk_sha" != "$latest_sha" ]]; then
    add_failure "path=$canon_path check=SHA_MATCH reason=SHA_MISMATCH ledger_sha=${latest_sha} on_disk_sha=${on_disk_sha} — file was modified after the ledger recorded it (out-of-band edit bypassed the hook)"
    continue
  fi

  # (b) AUTHOR_MATCH: dir agent must match ledger author
  if [[ "$latest_author" == "unknown" ]]; then
    add_failure "path=$canon_path check=AUTHOR_MATCH reason=AUTHOR_UNKNOWN — ledger records author=unknown (WL_AGENT was unset when written); provenance gap"
    continue
  fi
  if [[ "$latest_author" != "$dir_agent" ]]; then
    add_failure "path=$canon_path check=AUTHOR_MATCH reason=AUTHOR_MISMATCH dir_agent=${dir_agent} ledger_author=${latest_author} — file is under from-${dir_agent}/ but ledger records a different agent"
    continue
  fi

  OK_COUNT=$(( OK_COUNT + 1 ))
  log "OK path=$canon_path sha=$on_disk_sha author=$latest_author"

done <<< "$INDEXED_PATHS"

# ---------------------------------------------------------------------------
# Check 2: For each on-disk handoff file, count unverifiable (not in ledger).
#
# FIX 4 (C4 — canonicalization under WL_HANDOFFS_DIR override):
# Previous code stripped $REPO_DIR/ from disk paths. When WL_HANDOFFS_DIR
# points to a temp dir, the disk path has no $REPO_DIR prefix, so stripping
# produced the wrong result and the grep against INDEXED_PATHS always failed.
#
# New approach: strip the HANDOFFS_DIR prefix from each disk path, then
# reconstruct the canonical form ".claude/handoffs/<remainder>". This matches
# the form stored in INDEXED_PATHS regardless of whether HANDOFFS_DIR is the
# production path or a test override.
# ---------------------------------------------------------------------------
DISK_FILE_COUNT=0
while IFS= read -r disk_file; do
  [[ -z "$disk_file" ]] && continue

  # Skip beta (should not exist under handoffs, but belt-and-suspenders)
  if [[ "$disk_file" == *".claude/beta/"* ]]; then
    continue
  fi

  DISK_FILE_COUNT=$(( DISK_FILE_COUNT + 1 ))

  # FIX 4: reconstruct canonical path by stripping HANDOFFS_DIR prefix.
  # Normalize HANDOFFS_DIR to not have trailing slash for consistent stripping.
  norm_hdir="${HANDOFFS_DIR%/}"
  # Strip the HANDOFFS_DIR prefix from disk_file.
  remainder="${disk_file#${norm_hdir}/}"
  # Reconstruct canonical repo-relative path (no leading "./")
  canon=".claude/handoffs/${remainder}"

  # Check if this path appears in the indexed set
  if ! printf '%s\n' "$INDEXED_PATHS" | grep -qxF "$canon"; then
    UNLISTED_COUNT=$(( UNLISTED_COUNT + 1 ))
    log "UNLISTED path=$canon (not in ledger)"
  fi

done < <(find "$HANDOFFS_DIR" -type f -name "*.md" 2>/dev/null | sort)

# ---------------------------------------------------------------------------
# FIX 1: WIRED MODE — UNLISTED_ON_DISK must be a distinct non-zero exit
# (Refutation A — forged unlisted handoff)
#
# When WL_INTEGRITY_WIRED=1 and unlisted_on_disk > 0:
#   - A handoff is present on disk with no ledger entry.
#   - This means it was written out-of-band, bypassing the integrity-write-ledger
#     hook — which is exactly what a forged handoff looks like.
#   - Exit 4 (UNVERIFIABLE_PRESENT) rather than exit 0.
#
# When WL_INTEGRITY_WIRED is unset (pre-wiring):
#   - Unlisted files are expected (most existing files have no ledger entry yet).
#   - Informational only; does not affect exit code. Same as pre-v2 behavior.
#
# IMPORTANT: this check runs BEFORE the FAIL_COUNT check so that a wired-mode
# unlisted violation is not masked by a clean (FAIL_COUNT=0) result.
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
emit ""
emit "SUMMARY"
emit "  disk_files=$DISK_FILE_COUNT"
emit "  ledger_indexed=$HANDOFF_ENTRY_COUNT"
emit "  verified_ok=$OK_COUNT"
emit "  warned=$WARN_COUNT  (2-sha within-session re-edits; not failures)"
emit "  failed=$FAIL_COUNT"
if [[ "${WIRED:-}" == "1" ]]; then
  emit "  unlisted_on_disk=$UNLISTED_COUNT  (WIRED MODE: any unlisted = UNVERIFIABLE_PRESENT -> exit 4)"
else
  emit "  unlisted_on_disk=$UNLISTED_COUNT  (not in ledger — not failures while hook is unwired)"
fi

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  emit ""
  emit "FAILURES (${FAIL_COUNT}):"
  while IFS= read -r reason; do
    [[ -z "$reason" ]] && continue
    emit "  - $reason"
  done <<< "$FAIL_REASONS"
  emit ""
  emit "RESULT status=FAIL exit=1"
  log "exit 1 FAIL count=$FAIL_COUNT"
  exit 1
fi

# FIX 1: wired-mode UNLISTED gate (must come after FAIL_COUNT=0 path)
if [[ "${WIRED:-}" == "1" ]] && [[ "$UNLISTED_COUNT" -gt 0 ]]; then
  emit ""
  emit "UNVERIFIABLE_PRESENT: ${UNLISTED_COUNT} on-disk handoff file(s) have no ledger entry."
  emit "  In wired mode this indicates a forged or out-of-band handoff bypassed the write hook."
  emit "  Remediation: either seed the ledger for these files (integrity-write-ledger.sh --seed),"
  emit "  or investigate — an unrecorded handoff is a provenance gap."
  emit ""
  emit "RESULT status=UNVERIFIABLE_PRESENT exit=4"
  log "exit 4 UNVERIFIABLE_PRESENT unlisted=$UNLISTED_COUNT wired=1"
  exit 4
fi

emit ""
emit "RESULT status=OK exit=0"
emit "  All ${OK_COUNT} ledger-indexed handoff files verified clean."
if [[ "$UNLISTED_COUNT" -gt 0 ]]; then
  emit "  ${UNLISTED_COUNT} on-disk handoff file(s) have no ledger entry — cannot verify."
  emit "  Wire integrity-write-ledger.sh to accumulate entries for future files."
fi
log "exit 0 OK verified=$OK_COUNT unlisted=$UNLISTED_COUNT"
exit 0
