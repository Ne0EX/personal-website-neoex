#!/usr/bin/env bash
# =============================================================================
# scripts/audit-memory-drift.sh
#
# Rail:    memory-drift  (M2 sensor — GENESIS memory integrity)
# Owner:   Canopus (α-HRN-07)
# Class:   DETERMINISTIC / HARD-BARRIER
# Introduced: TASK-2026-06-04-INTEGRITY-HASH-ON-WRITE (M2 sensor)
#
# Purpose
# -------
# Assert that every GENESIS memory node's current sha256 matches the hash the
# integrity ledger (.harness/integrity-ledger.jsonl) has on record.
# Also flag any node whose file exists on disk but has NO ledger entry —
# an "unexplained write" that bypassed the write-ledger hook.
#
# An "on-record hash" is the sha256 in the LATEST ledger entry for that path.
# The ledger is append-only; a mutable node (MEMORY.md, handoffs, auto-memory
# files) accumulates one entry per write. The latest entry is the ground truth:
# any out-of-band mutation (edit that bypassed the ledger hook) makes the
# current file hash differ from the latest recorded hash.
#
# For write-once nodes (.claude/signatures/*.json) there is exactly one entry,
# so latest == first. The semantics collapse correctly.
#
# GENESIS memory surfaces (per integrity-write-ledger.sh — must stay in sync):
#   1. AUTO_MEMORY_DIR/**   — absolute-path files; ledger key = absolute path
#   2. .claude/handoffs/**  — repo-relative, no leading "./"
#   3. .claude/signatures/**— repo-relative, no leading "./"
#   4. MEMORY.md            — repo-relative ("MEMORY.md")
#
# Excluded surfaces (must be checked first before any file reads):
#   .claude/beta/**         — Track B, consult-pending; never read/scan/touch
#
# Semantics
# ---------
# Exit 0 — all nodes pass (current hash == latest ledger hash) AND no
#           unexplained writes (every node has at least one ledger entry) AND
#           every ledgered node is present on disk.
#
# Exit 1 — one or more of these failure conditions detected:
#           (a) DRIFT: a node exists on disk but current hash != latest-ledger
#               hash. Emits: node path, expected hash, actual hash.
#           (b) MISSING: a ledgered node is absent from disk. A node that was
#               erased after ledger recording is indistinguishable from tamper;
#               treated as TAMPER/DRIFT. Detected by the reverse ledger→disk
#               pass (additive, after the forward disk→ledger pass).
#
# Unexplained writes (nodes with NO ledger entry) also exit 1 (BLOCK).
#           A node can only be in this state if it was written after the
#           ledger hook was wired, without the hook firing. Pre-ledger files
#           (created before the hook was wired) do NOT count as unexplained
#           writes — see Pre-operational note below.
#
# Exit-code contract (per harness rail wiring §2c):
#   0 PASS / 1 BLOCK / 5 WARN (pre-operational).
#   There is no exit 2.  Unexplained writes are BLOCK (exit 1), not a
#   distinct exit code.  The rail wiring table at .harness/proposed-wiring-M.md
#   §2c is the authority: any unmapped exit code would break the rail.
#
# NOTE: drift, missing, and unexplained writes can all occur in one run.
#       All three accumulate separate counters and all emit their FAIL
#       prose before the single exit 1. The reverse ledger→disk pass
#       closes the deletion blind spot: deleting a ledgered node previously
#       caused a silent count drop (4→3 nodes checked) and exit 0 — now
#       exit 1 MISSING is emitted and the sensor fails closed.
#
# Exit 5 — ledger file absent entirely. This is the "pre-operational" state:
#           the hooks are not wired, no writes have been recorded. The audit
#           emits a NOTICE and exits 5 (non-zero — not a pass). Callers
#           (harness-check.sh, stop hook) must treat exit 5 as NOTICE, not
#           FAIL — no work can be assessed against a non-existent ledger.
#           See "Pre-operational" note below.
#
# Pre-operational note
# --------------------
# The integrity-write-ledger.sh hook must be wired in settings.json (at Peat's
# gate) BEFORE this audit has anything to read. Until then:
#   - The ledger file (.harness/integrity-ledger.jsonl) does not exist.
#   - All GENESIS memory files are "pre-ledger" — they exist before any
#     ledger entries were written.
#   - Treating every pre-ledger file as "unexplained" would be a noise cannon
#     that blocks day-one operation.
#
# Design decision: exit 5 (not exit 2) when the ledger is absent. Harness
# and stop-hook wrappers must check for exit 5 specifically and route it as
# a soft NOTICE, not a hard FAIL, until the ledger has been seeded.
#
# Baseline seeding: after the hooks are wired, a one-time pass of every
# existing GENESIS memory file through the ledger (a "seed run") is required
# before this audit can meaningfully cover pre-existing nodes. That seed run
# is a separate writer task — this script is a reader. See proposed-wiring-M.md
# for the seeding prerequisite.
#
# Overrides (for tests — temp copies only per POLICY-NO-INPLACE-MUTATION)
# -----------------------------------------------------------------------
#   WL_INTEGRITY_LEDGER=/path/to/temp.jsonl  — override ledger path
#   WL_REPO_ROOT=/path/to/repo               — override repo root
#   WL_AUTO_MEMORY_DIR=/path/to/dir          — override auto-memory dir
#   WL_MEMORY_MD=/path/to/MEMORY.md          — override MEMORY.md path
#
# Usage
# -----
#   bash scripts/audit-memory-drift.sh
#   bash scripts/audit-memory-drift.sh --verbose    (emit PASS lines too)
#
# Idempotent: yes. Same working tree → same result.
# Timing:     O(N_ledger_entries × sha256) for current-file hashing.
#             Typical run < 5 seconds for a well-bounded ledger.
#
# Logs to: .claude/hook-logs/<task_id>--audit-memory-drift.log
#
# Wiring: Stop hook + harness rail (see .harness/proposed-wiring-M.md).
#         NOT a PostToolUse Write matcher — this is an audit, not a per-write
#         event handler.
# =============================================================================

set -uo pipefail

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
REPO_DIR="${WL_REPO_ROOT:-${CLAUDE_PROJECT_DIR:-/Users/neospiritth/codingspace/personal_website}}"
AUTO_MEMORY_DIR="${WL_AUTO_MEMORY_DIR:-/Users/neospiritth/.claude/projects/-Users-neospiritth-codingspace-personal-website/memory}"
MEMORY_MD="${WL_MEMORY_MD:-$REPO_DIR/MEMORY.md}"

LOG_DIR="$REPO_DIR/.claude/hook-logs"
mkdir -p "$LOG_DIR" 2>/dev/null || true

TASK_ID="${CLAUDE_TASK_ID:-${WL_TASK_ID:-session-$(date +%s)}}"
LOG="$LOG_DIR/${TASK_ID}--audit-memory-drift.log"
TIMESTAMP="$(date -u +%FT%TZ)"

LEDGER="${WL_INTEGRITY_LEDGER:-$REPO_DIR/.harness/integrity-ledger.jsonl}"

VERBOSE=false
if [[ "${1:-}" == "--verbose" ]]; then
  VERBOSE=true
fi

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
log() { printf '[memory-drift] %s\n' "$*" >> "$LOG" 2>/dev/null || true; }
info() { printf '[memory-drift] %s\n' "$*"; log "$*"; }
warn() { printf '[memory-drift] WARN — %s\n' "$*" >&2; log "WARN — $*"; }

sha256_of() {
  # Compute sha256 identical to integrity-write-ledger.sh and sign-work.sh.
  sha256sum "$1" 2>/dev/null | awk '{print $1}'
}

# ---------------------------------------------------------------------------
# Pre-operational check — absent ledger
# ---------------------------------------------------------------------------
log "start · ts=$TIMESTAMP · ledger=$LEDGER"

if [[ ! -f "$LEDGER" ]]; then
  printf '[memory-drift] NOTICE — ledger absent: %s\n' "$LEDGER"
  printf '[memory-drift] This is the pre-operational state: integrity-write-ledger.sh\n'
  printf '[memory-drift] has not been wired (or no writes have been recorded yet).\n'
  printf '[memory-drift] Once the hook is wired and a baseline seed run completes,\n'
  printf '[memory-drift] this audit can assess drift. See .harness/proposed-wiring-M.md\n'
  printf '[memory-drift] for seeding prerequisites.\n'
  log "exit 5 — ledger absent"
  exit 5
fi

# ---------------------------------------------------------------------------
# Load ledger — build "latest hash per canonical path" index.
#
# The ledger is JSONL (one JSON object per line). We want the LAST entry for
# each unique path value. Strategy: slurp all lines, group by path, take
# the last element's sha256. Using jq for correctness (paths may contain
# spaces or special chars).
#
# Output format: one line per path, tab-separated: <path>\t<sha256>
# We collect into temp files (bash 3.2 compat — no associative arrays).
# ---------------------------------------------------------------------------
TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t 'memory-drift')"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

LATEST_INDEX="$TMP_DIR/latest_index.tsv"   # <path> TAB <sha256>

# jq: read all lines as an array, group by .path, for each group take the
# last element's .path and .sha256. Output as TSV.
#
# We use inputs + -n rather than slurp to avoid loading the whole file into
# memory at once (scalability).
jq -r -n \
  --argjson ledger "$(jq -s '.' "$LEDGER" 2>/dev/null)" \
  '
    $ledger
    | group_by(.path)
    | .[]
    | last
    | [ .path, .sha256 ]
    | @tsv
  ' 2>/dev/null > "$LATEST_INDEX" || {
    printf '[memory-drift] ERROR — failed to parse ledger: %s\n' "$LEDGER" >&2
    log "exit 1 — ledger parse error"
    exit 1
  }

LEDGER_ENTRY_COUNT="$(wc -l < "$LATEST_INDEX" | tr -d ' ')"
log "ledger parsed — unique paths indexed: $LEDGER_ENTRY_COUNT"

if [[ "$LEDGER_ENTRY_COUNT" -eq 0 ]]; then
  printf '[memory-drift] NOTICE — ledger exists but contains no valid entries.\n'
  printf '[memory-drift] Treat as pre-operational. See .harness/proposed-wiring-M.md\n'
  log "exit 5 — ledger empty"
  exit 5
fi

# ---------------------------------------------------------------------------
# Enumerate GENESIS memory nodes on disk.
#
# Surfaces (must mirror integrity-write-ledger.sh exactly):
#   1. AUTO_MEMORY_DIR/**    — all files recursively; ledger key = absolute path
#   2. .claude/handoffs/**   — repo-relative
#   3. .claude/signatures/** — repo-relative
#   4. MEMORY.md             — repo-relative "MEMORY.md"
#
# EXCLUSION: .claude/beta/** — checked FIRST before any read.
# ---------------------------------------------------------------------------

enumerate_nodes() {
  # --- Surface 1: auto-memory dir ---
  if [[ -d "$AUTO_MEMORY_DIR" ]]; then
    find "$AUTO_MEMORY_DIR" -type f 2>/dev/null | while IFS= read -r f; do
      # Beta exclusion: auto-memory dir is outside the repo and outside .claude/beta;
      # no beta exclusion needed here, but guard for safety.
      printf '%s\n' "$f"
    done
  fi

  # --- Surfaces 2-3: in-repo dirs ---
  for dir_rel in ".claude/handoffs" ".claude/signatures"; do
    local dir_abs="$REPO_DIR/$dir_rel"
    if [[ -d "$dir_abs" ]]; then
      find "$dir_abs" -type f 2>/dev/null | while IFS= read -r f; do
        # Beta exclusion first (defensive — these dirs are not beta, but guard)
        case "$f" in
          */.claude/beta/*) continue ;;
        esac
        # Emit as repo-relative (no leading "./")
        printf '%s\n' "${f#$REPO_DIR/}"
      done
    fi
  done

  # --- Surface 4: MEMORY.md ---
  if [[ -f "$MEMORY_MD" ]]; then
    printf 'MEMORY.md\n'
  fi
}

# ---------------------------------------------------------------------------
# Cross-reference: for each node, look up latest ledger hash, compare.
# ---------------------------------------------------------------------------
DRIFT_COUNT=0
UNEXPLAINED_COUNT=0
MISSING_COUNT=0
PASS_COUNT=0
NODE_TOTAL=0

# We iterate enumerate_nodes output. For each node:
#   - Determine its actual file path and canonical ledger key.
#   - Look it up in the LATEST_INDEX.
#   - If not found: unexplained write.
#   - If found: compute sha256, compare.

lookup_latest_hash() {
  # grep the TSV for a line whose first field (path) matches exactly.
  # Using awk for exact-field match (grep could partial-match).
  # $1 = canonical path (key), $2 = tsv file
  awk -v key="$1" -F'\t' 'NF>=2 && $1==key { print $2 }' "$2" | tail -1
}

while IFS= read -r node; do
  [[ -z "$node" ]] && continue
  NODE_TOTAL=$(( NODE_TOTAL + 1 ))

  # Determine canonical path and actual file path.
  # Surface 1 (auto-memory): node is already absolute.
  # Surfaces 2-4 (in-repo): node is repo-relative.
  if [[ "$node" == /* ]]; then
    canon="$node"
    actual="$node"
  else
    canon="$node"
    actual="$REPO_DIR/$node"
  fi

  # Look up in latest index.
  latest_hash="$(lookup_latest_hash "$canon" "$LATEST_INDEX")"

  if [[ -z "$latest_hash" ]]; then
    # No ledger entry — unexplained write.
    printf '[memory-drift] UNEXPLAINED — no ledger entry: %s\n' "$canon"
    log "UNEXPLAINED — no entry: $canon"
    UNEXPLAINED_COUNT=$(( UNEXPLAINED_COUNT + 1 ))
    continue
  fi

  # Compute current hash.
  if [[ ! -f "$actual" ]]; then
    # Node is in ledger but file is gone. The reverse ledger→disk pass (below)
    # is the authoritative detector for this case and will emit MISSING + exit 1.
    # Skip here to avoid double-counting; the reverse pass covers this quadrant.
    log "NOTICE (fwd-skip) — file absent, reverse pass will flag: $canon"
    continue
  fi

  current_hash="$(sha256_of "$actual")"

  if [[ -z "$current_hash" ]]; then
    warn "sha256 failed for $actual"
    DRIFT_COUNT=$(( DRIFT_COUNT + 1 ))
    continue
  fi

  if [[ "$current_hash" == "$latest_hash" ]]; then
    if $VERBOSE; then
      printf '[memory-drift] PASS — %s\n' "$canon"
      log "PASS — $canon"
    else
      log "PASS — $canon"
    fi
    PASS_COUNT=$(( PASS_COUNT + 1 ))
  else
    printf '[memory-drift] DRIFT — %s\n' "$canon"
    printf '              expected (ledger-latest): %s\n' "$latest_hash"
    printf '              actual   (current file):  %s\n' "$current_hash"
    log "DRIFT — $canon expected=$latest_hash actual=$current_hash"
    DRIFT_COUNT=$(( DRIFT_COUNT + 1 ))
  fi

done < <(enumerate_nodes)

# ---------------------------------------------------------------------------
# Reverse pass: ledger → disk.
#
# The forward pass above iterates disk→ledger: every file that exists on disk
# is looked up in the ledger. This correctly catches unexplained writes and
# hash drift for existing files — but it silently skips any ledger entry whose
# file has been DELETED. A deletion of a ledgered node is indistinguishable
# from tampering (provenance destroyed); it must exit 1, not exit 0.
#
# This pass iterates every unique path in LATEST_INDEX. For each key:
#   - Resolve the actual file path using the same mapping as the forward pass.
#   - Apply the beta exclusion guard first.
#   - If the file EXISTS: the forward pass already covered it — skip (no double
#     count).
#   - If the file is ABSENT: emit MISSING and increment MISSING_COUNT.
#
# After this pass: PASS + DRIFT + MISSING == LEDGER_ENTRY_COUNT (modulo beta
# skips), so a deletion is detectably reflected in the count rather than a
# silent drop from N→N-1 nodes checked.
# ---------------------------------------------------------------------------
log "reverse pass — checking ledger entries against disk (${LEDGER_ENTRY_COUNT} keys)"

while IFS=$'\t' read -r lpath lhash; do
  [[ -z "$lpath" ]] && continue

  # Beta exclusion — a ledger key could reference a .claude/beta/** path.
  case "$lpath" in
    */.claude/beta/*|.claude/beta/*) continue ;;
  esac

  # Resolve actual file path — identical mapping to the forward pass.
  if [[ "$lpath" == /* ]]; then
    lactual="$lpath"
  else
    lactual="$REPO_DIR/$lpath"
  fi

  # If the file exists, the forward pass handled it — skip to avoid
  # double-counting pass/drift entries.
  if [[ -e "$lactual" ]]; then
    continue
  fi

  # File is absent; this is a ledgered node with no file on disk.
  printf '[memory-drift] MISSING — ledgered node absent from disk: %s\n' "$lpath"
  printf '              last recorded hash: %s\n' "$lhash"
  log "MISSING — ledgered node absent from disk: $lpath last_hash=$lhash"
  MISSING_COUNT=$(( MISSING_COUNT + 1 ))

done < "$LATEST_INDEX"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
printf '\n[memory-drift] --- summary ---\n'
printf '[memory-drift] nodes checked (fwd):  %d\n' "$NODE_TOTAL"
printf '[memory-drift] pass:                 %d\n' "$PASS_COUNT"
printf '[memory-drift] drift:                %d\n' "$DRIFT_COUNT"
printf '[memory-drift] unexplained write:    %d\n' "$UNEXPLAINED_COUNT"
printf '[memory-drift] missing (deleted):    %d\n' "$MISSING_COUNT"
printf '[memory-drift] ledger entries:       %d\n' "$LEDGER_ENTRY_COUNT"

log "summary — total=$NODE_TOTAL pass=$PASS_COUNT drift=$DRIFT_COUNT unexplained=$UNEXPLAINED_COUNT missing=$MISSING_COUNT ledger=$LEDGER_ENTRY_COUNT"

if [[ "$DRIFT_COUNT" -gt 0 ]] || [[ "$UNEXPLAINED_COUNT" -gt 0 ]] || [[ "$MISSING_COUNT" -gt 0 ]]; then
  if [[ "$DRIFT_COUNT" -gt 0 ]]; then
    printf '\n[memory-drift] FAIL — %d node(s) have hash drift.\n' "$DRIFT_COUNT"
    printf '[memory-drift] A DRIFT node was written after the ledger hook fired but\n'
    printf '[memory-drift] the file content no longer matches the last recorded hash.\n'
    printf '[memory-drift] FIX: identify and revert the out-of-band edit, or re-run\n'
    printf '[memory-drift] the write through the hook (WL_AGENT set) so a new ledger\n'
    printf '[memory-drift] entry is recorded.\n'
  fi
  if [[ "$UNEXPLAINED_COUNT" -gt 0 ]]; then
    printf '\n[memory-drift] FAIL — %d node(s) have no ledger entry (unexplained write).\n' "$UNEXPLAINED_COUNT"
    printf '[memory-drift] An UNEXPLAINED node was written after the ledger hook was\n'
    printf '[memory-drift] wired but the hook did not fire (or the agent bypassed it).\n'
    printf '[memory-drift] NOTE: if this node pre-dates hook wiring, run the baseline\n'
    printf '[memory-drift] seed pass first (see .harness/proposed-wiring-M.md).\n'
    printf '[memory-drift] FIX: re-run the write through the hook so it is recorded,\n'
    printf '[memory-drift] or run the seed pass if the node is pre-ledger.\n'
  fi
  if [[ "$MISSING_COUNT" -gt 0 ]]; then
    printf '\n[memory-drift] FAIL — %d ledgered node(s) are absent from disk (TAMPER/DRIFT).\n' "$MISSING_COUNT"
    printf '[memory-drift] A MISSING node had a ledger entry but the file no longer exists.\n'
    printf '[memory-drift] Deletion of a ledgered GENESIS memory node is treated as tamper:\n'
    printf '[memory-drift] provenance cannot be verified without the file.\n'
    printf '[memory-drift] FIX: restore the file from git history or identify who deleted\n'
    printf '[memory-drift] it and whether the deletion was authorized. If intentional,\n'
    printf '[memory-drift] record an explicit deprecation entry in the ledger and re-run.\n'
  fi
  # Exit 1 (BLOCK) covers all three failure classes: drift, missing, and
  # unexplained writes.  The header formerly documented unexplained-only as
  # exit 2, but the harness rail wiring contract (§2c — 0 PASS / 1 BLOCK /
  # 5 WARN) has no slot for exit 2; any unmapped exit code breaks the rail.
  # Decision: keep exit 1 for all BLOCK conditions; align header to code.
  # Exit 5 remains reserved for the pre-operational ledger-absent state only.
  # Ref: TASK-2026-06-04-MEMORY-POISONING-A.md §2c + REVISE round 1 M2 notes.
  log "exit 1 — drift=$DRIFT_COUNT unexplained=$UNEXPLAINED_COUNT missing=$MISSING_COUNT"
  exit 1
fi

printf '\n[memory-drift] PASS — all %d node(s) match their ledger hashes; no missing nodes.\n' "$PASS_COUNT"
log "exit 0 — PASS"
exit 0
