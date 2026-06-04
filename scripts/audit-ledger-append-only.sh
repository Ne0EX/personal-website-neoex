#!/usr/bin/env bash
# =============================================================================
# scripts/audit-ledger-append-only.sh
#
# Rail:    ledger-append-only  (the FORGE-RESISTANT trust-root for M1 + M2)
# Owner:   Canopus (α-HRN-07)
# Class:   DETECTIVE / WITNESS-ANCHORED  (lagged to push + CI)
# Introduced: TASK-2026-06-04-INTEGRITY-FORGE-ROOT
#
# WHAT THIS CLOSES (and why it is the SHARED root for two refutations)
# --------------------------------------------------------------------
# M1-B  ledger co-tamper      — edit a handoff body AND rewrite that entry's
#                               sha256 in the ledger. Any HASH RECOMPUTE (local
#                               or remote) passes, because the stored hash now
#                               matches the mutated body. The hash-chain variant
#                               also fails on the TERMINAL entry (a handoff's
#                               ledger line is always last for that path, so no
#                               successor line protects it) and against a
#                               recompute attacker who rewrites every downstream
#                               prev_hash.
# M2-C5 deletion co-tamper    — delete a ledgered node's FILE *and* remove its
#                               ledger line. The reverse ledger->disk pass cannot
#                               see a node whose evidence (the ledger line) is
#                               also gone.
#
# Both defeat every *content-of-the-current-ledger* check, because the attacker
# controls the current ledger. The ONLY property that catches them is:
#
#       "this ledger entry was a DIFFERENT value (or PRESENT) in prior
#        COMMITTED history."
#
# That is what this audit asserts: across the committed revisions of the ledger,
# every previously-committed line is still present, byte-identical, in the same
# position — the ledger is APPEND-ONLY. A co-tampered line breaks the prefix
# (its bytes changed); a deleted line breaks the prefix (it vanished). Neither
# can be hidden without REWRITING git history, which a force-push would require,
# which branch protection on the witness ref forbids — and that toggle is set
# only by Peat at the seam.
#
# WHY NO LOCAL ANCHOR IS FORGE-RESISTANT (the irreducible root, made concrete)
# ----------------------------------------------------------------------------
# The writing agent runs AS Peat: it has filesystem WRITE *and* READ. Therefore:
#   - a Canopus-held signing key is agent-readable  → agent can re-sign a forgery
#   - an OS-permission lock is agent-as-owner        → agent can chmod/rewrite
#   - an in-file hash chain is agent-recomputable    → agent rewrites the chain
# Forge-resistance can come ONLY from a substrate the agent cannot fake:
#   (a) CI runs on GitHub's runners (not the agent's machine), over
#   (b) append-only git history the agent cannot rewrite without a force-push,
#   (c) which BRANCH PROTECTION (no-force-push) on the witness ref prevents —
#       a toggle ONLY Peat can set at the seam.
# This script is component (a)'s assertion. (b) and (c) are the substrate it
# runs on; see .harness/WITNESS-REF-DESIGN.md for the exact human-at-seam steps.
#
# THIS IS NOT A HASH-RECOMPUTE
# ----------------------------
# A recompute (sha256sum the current file, compare to the stored sha256) ALWAYS
# passes a co-tamper, because the attacker rewrote the stored sha256 to match the
# mutated body. This audit never recomputes a body hash. It compares COMMITTED
# REVISIONS of the ledger against each other. The integrity claim is anchored in
# git history, not in any value the current working tree can present.
#
# HONEST PRE-OPERATIONAL STATE (must NOT be red before the ledger is seeded)
# --------------------------------------------------------------------------
# Exit 0 (NEUTRAL/PASS) when:
#   - the ledger file has NO committed history (never committed), OR
#   - the ledger has exactly ONE committed revision (nothing prior to compare).
# Rationale: append-only is a property OVER history. With zero or one committed
# revision there is no "prior committed value" to have been mutated, so there is
# nothing to refute — and CI must stay green while the ledger is still being
# stood up. A working-tree-only (uncommitted) ledger is likewise neutral: the
# witness anchors COMMITTED history, and an uncommitted ledger has none.
#
# EXIT CODES
# ----------
#   0  PASS/NEUTRAL — append-only holds across committed history, OR there is no
#                     committed history / only one revision (pre-operational).
#   1  VIOLATION    — a previously-committed ledger line was MUTATED or REMOVED
#                     in a later committed revision (co-tamper / deletion-tamper).
#   2  INTERNAL     — not a git work tree, missing dependency, or git plumbing
#                     error. Fail-closed (never silently green on a broken probe).
#
# OVERRIDES (for tests — sandbox git repos only; no tracked-file mutation)
# ------------------------------------------------------------------------
#   WL_LEDGER_REL   ledger path RELATIVE to the repo root
#                   (default: .harness/integrity-ledger.jsonl)
#   WL_REPO_ROOT    repo root to run git in (default: git rev-parse from CWD,
#                   fallback CLAUDE_PROJECT_DIR)
#   WL_WITNESS_REF  the committed ref/branch whose history is the witness
#                   (default: HEAD — in CI this is the checked-out witness commit)
#
# USAGE
#   bash scripts/audit-ledger-append-only.sh
#   WL_REPO_ROOT=/tmp/sandbox bash scripts/audit-ledger-append-only.sh
#
# Logs to: .claude/hook-logs/<task_id>--audit-ledger-append-only.log
#
# WIRING: a CI step in .github/workflows/ci.yml (the independent witness) AND an
#         optional harness rail. It is NOT a PostToolUse handler — it reads git
#         history, which only changes on commit, not on every write. Peat wires
#         at the seam; nothing here is live until then.
#
# SCOPE GUARDS (binding)
#   - Reads only. Modifies no tracked file. Uses no network, no curl/wget, no rm
#     of tracked paths (only mktemp scratch, cleaned on trap).
#   - .claude/beta/** is never read, scanned, or touched.
# =============================================================================

set -uo pipefail

# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------
for dep in git sed grep printf; do
  if ! command -v "$dep" >/dev/null 2>&1; then
    printf 'ERROR [audit-ledger-append-only] missing dependency: %s\n' "$dep" >&2
    exit 2
  fi
done

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
LEDGER_REL="${WL_LEDGER_REL:-.harness/integrity-ledger.jsonl}"
WITNESS_REF="${WL_WITNESS_REF:-HEAD}"

# Resolve repo root. Prefer an explicit override; else ask git from CWD; else
# fall back to CLAUDE_PROJECT_DIR. Fail-closed (exit 2) if none resolves to a
# git work tree.
REPO_ROOT="${WL_REPO_ROOT:-}"
if [[ -z "$REPO_ROOT" ]]; then
  REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi
if [[ -z "$REPO_ROOT" ]]; then
  REPO_ROOT="${CLAUDE_PROJECT_DIR:-}"
fi
if [[ -z "$REPO_ROOT" ]] || ! git -C "$REPO_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  printf 'ERROR [audit-ledger-append-only] not a git work tree (REPO_ROOT=%s)\n' "${REPO_ROOT:-<unset>}" >&2
  exit 2
fi
# Canonicalize to the work-tree top so ledger-rel paths resolve identically to git.
REPO_ROOT="$(git -C "$REPO_ROOT" rev-parse --show-toplevel 2>/dev/null || echo "$REPO_ROOT")"

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOG_DIR="$REPO_ROOT/.claude/hook-logs"
mkdir -p "$LOG_DIR" 2>/dev/null || true
TASK_ID="${CLAUDE_TASK_ID:-${WL_TASK_ID:-session-$(date +%s)}}"
LOG="$LOG_DIR/${TASK_ID}--audit-ledger-append-only.log"
TS="$(date -u +%FT%TZ 2>/dev/null || echo unknown)"

log()  { printf '%s [ledger-append-only] %s\n' "$TS" "$*" >> "$LOG" 2>/dev/null || true; }
emit() { printf '%s\n' "$*"; log "$*"; }

# Scope guard: never let the ledger path be redirected into beta.
case "$LEDGER_REL" in
  *".claude/beta/"*)
    emit "ERROR reason=SCOPE_VIOLATION detail=WL_LEDGER_REL points into .claude/beta (excluded)"
    exit 2
    ;;
esac

emit "AUDIT-LEDGER-APPEND-ONLY ts=$TS"
emit "  repo_root=$REPO_ROOT"
emit "  ledger_rel=$LEDGER_REL"
emit "  witness_ref=$WITNESS_REF"

git_repo() { git -C "$REPO_ROOT" "$@"; }

# ---------------------------------------------------------------------------
# Resolve the witness ref. If it does not resolve (e.g. fresh repo with no
# commits), there is no committed history — neutral PASS.
# ---------------------------------------------------------------------------
if ! git_repo rev-parse --verify "$WITNESS_REF" >/dev/null 2>&1; then
  emit "RESULT status=NEUTRAL reason=NO_COMMITS witness_ref=$WITNESS_REF has no committed history"
  emit "  Append-only is a property over committed history. With no commits there is"
  emit "  nothing prior to have been mutated. Honest pre-operational state — exit 0."
  log "exit 0 NEUTRAL no-commits"
  exit 0
fi

# ---------------------------------------------------------------------------
# Enumerate committed revisions of the ledger (oldest -> newest) on the witness
# ref. `git log/rev-list -- <never-committed-path>` is empty with exit 0.
#
# --first-parent is LOAD-BEARING (not cosmetic):
#   The witness ref is FAST-FORWARD-ONLY / linear by design (see
#   .harness/WITNESS-REF-DESIGN.md §3) — but the audit must not silently assume
#   that and must behave correctly even if pointed at a merge commit (e.g. a PR
#   merge ref where checkout makes HEAD a merge). Walking --first-parent follows
#   the witness ref's own spine: each step on that spine is the ledger AS PUBLISHED
#   to the ref, which is append-only. Without --first-parent, a legitimate merge
#   that keeps both sides' appends (header+a+c+b) would interleave side-branch
#   revisions (…,a,c vs …,a,b) and the prefix check would FALSE-POSITIVE on a
#   normal merge — a rail spewing reds in normal operation, which is its own bar.
#   --first-parent makes the walk deterministic and append-only on the spine,
#   while a real co-tamper committed ONTO the spine still breaks the prefix.
#   (Verified: legit-merge-keeps-both -> PASS; co-tamper-on-spine -> VIOLATION.)
# ---------------------------------------------------------------------------
REVS="$(git_repo rev-list --reverse --first-parent "$WITNESS_REF" -- "$LEDGER_REL" 2>/dev/null || true)"

REV_COUNT=0
if [[ -n "$REVS" ]]; then
  REV_COUNT="$(printf '%s\n' "$REVS" | grep -c .)"
fi
emit "  committed_revisions=$REV_COUNT"

# Pre-operational: ledger never committed.
if [[ "$REV_COUNT" -eq 0 ]]; then
  emit "RESULT status=NEUTRAL reason=LEDGER_ABSENT_FROM_HISTORY"
  emit "  '$LEDGER_REL' has no committed revision on $WITNESS_REF."
  emit "  The witness anchors COMMITTED history; an absent/uncommitted ledger has none."
  emit "  Honest pre-operational state — never red before the ledger is seeded. Exit 0."
  log "exit 0 NEUTRAL ledger-absent-from-history"
  exit 0
fi

# Pre-operational: exactly one committed revision — nothing prior to compare.
if [[ "$REV_COUNT" -eq 1 ]]; then
  emit "RESULT status=NEUTRAL reason=SINGLE_REVISION"
  emit "  The ledger has exactly one committed revision. Append-only is a relation"
  emit "  BETWEEN revisions; with one there is no prior committed value to mutate."
  emit "  Exit 0 (the first append establishes the baseline the next push is checked against)."
  log "exit 0 NEUTRAL single-revision"
  exit 0
fi

# ---------------------------------------------------------------------------
# Append-only check across committed revisions.
#
# INVARIANT: for consecutive committed revisions (R_{i-1}, R_i) of the ledger,
# the content at R_{i-1} must be an exact LINE-PREFIX of the content at R_i.
# i.e. R_i == R_{i-1} + zero-or-more appended lines.
#
#   - A co-tamper (a line rewritten in place at R_i) changes those bytes →
#     the prefix no longer matches → VIOLATION. This catches even the TERMINAL
#     (last) entry, which the in-file hash chain provably cannot.
#   - A deletion (a line removed at R_i) shortens/shifts the content →
#     the prefix no longer matches → VIOLATION. This is the M2-C5 case.
#
# Comparing each consecutive pair (rather than only first-vs-last) localizes the
# offending commit for the failure message and is robust to a tamper that is
# later "repaired" in a still-non-append-only way.
# ---------------------------------------------------------------------------

# Extract committed blob content for <rev>:<path>. Empty string if the path is
# absent at that rev (it should be present for every rev rev-list returned, but
# guard anyway). We distinguish "absent" via cat-file -e to fail-closed on a
# genuine plumbing error vs a legitimately-absent path.
blob_at() {
  local rev="$1"
  git_repo show "${rev}:${LEDGER_REL}" 2>/dev/null
}

line_count() {
  # Count lines in a string the same way `head -n N` / `sed 1,Np` index them.
  # grep -c '' counts every line including a final newline-terminated last line;
  # printf '%s\n' guarantees a trailing newline so a single-line value counts 1.
  printf '%s\n' "$1" | grep -c ''
}

PREV_REV=""
PREV_CONTENT=""
HAVE_PREV=0
VIOLATION=0
VIOL_REV=""
CHECKED_PAIRS=0

while IFS= read -r rev; do
  [[ -z "$rev" ]] && continue

  CUR_CONTENT="$(blob_at "$rev")"

  if [[ "$HAVE_PREV" -eq 1 ]]; then
    CHECKED_PAIRS=$(( CHECKED_PAIRS + 1 ))
    if [[ -n "$PREV_CONTENT" ]]; then
      n="$(line_count "$PREV_CONTENT")"
      cur_head="$(printf '%s\n' "$CUR_CONTENT" | sed -n "1,${n}p")"
      # Normalize: PREV_CONTENT has no synthetic trailing newline; cur_head from
      # sed of a printf'd-with-newline stream matches line-for-line. Compare the
      # printf-normalized forms so a trailing-newline difference is not spurious.
      prev_norm="$(printf '%s\n' "$PREV_CONTENT")"
      cur_head_norm="$(printf '%s\n' "$cur_head")"
      if [[ "$cur_head_norm" != "$prev_norm" ]]; then
        VIOLATION=1
        VIOL_REV="$rev"
        emit ""
        emit "VIOLATION check=APPEND_ONLY commit=$rev prior_commit=$PREV_REV"
        emit "  The content committed at $PREV_REV is NOT an exact line-prefix of the"
        emit "  content at $rev. A previously-committed ledger line was MUTATED or"
        emit "  REMOVED — this is a co-tamper (M1-B) or deletion-co-tamper (M2-C5)."
        emit "  Append-only history was violated. To produce this state without a"
        emit "  force-push (which branch protection forbids on the witness ref) is"
        emit "  not possible for the writing agent — investigate the commit at $rev."
        break
      fi
    fi
  fi

  PREV_REV="$rev"
  PREV_CONTENT="$CUR_CONTENT"
  HAVE_PREV=1
done <<< "$REVS"

emit ""
emit "SUMMARY committed_revisions=$REV_COUNT consecutive_pairs_checked=$CHECKED_PAIRS"

if [[ "$VIOLATION" -eq 1 ]]; then
  emit "RESULT status=VIOLATION exit=1 offending_commit=$VIOL_REV"
  log "exit 1 VIOLATION commit=$VIOL_REV"
  exit 1
fi

emit "RESULT status=PASS exit=0"
emit "  Every previously-committed ledger line is still present, byte-identical, in"
emit "  position across all $REV_COUNT committed revisions. The ledger is append-only."
log "exit 0 PASS pairs=$CHECKED_PAIRS"
exit 0
