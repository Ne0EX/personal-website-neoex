#!/usr/bin/env bash
# =============================================================================
# scripts/publish-witness-ledger.sh
#
# Rail:    witness-publisher  (T2 go-live step 5, option b)
# Owner:   Canopus (α-HRN-07)
# Task:    TASK-2026-06-04-WITNESS-PUBLISHER (S1)
# Class:   AUTOMATED PUBLISHER / FORGE-RESISTANT
# Status:  INERT — nothing here is live until Peat wires at the seam (§4 of
#          .harness/WITNESS-REF-DESIGN.md). Do NOT call directly; invoked by
#          .github/workflows/publish-witness.yml.
#
# WHAT THIS DOES (in one sentence)
# ---------------------------------
# Reads the current ledger from the genesis checkout, verifies it is a pure
# append-only superset of the witness-ref's last snapshot, then synthesizes a
# new ledger-only snapshot commit on top of the witness ref and fast-forward-
# advances the protected refs/heads/integrity-witness to it.
#
# WHY A SNAPSHOT COMMIT, NOT A GENESIS-TIP FF
# --------------------------------------------
# genesis/* is a rebasing branch. If we fast-forwarded the witness ref directly
# to genesis's tip, a subsequent genesis rebase would cause the next push to
# attempt a non-ff — RED in normal operation. Instead we build a synthetic
# commit whose parent is the witness-ref tip, containing only the ledger file.
# That makes the witness history an independent ledger spine
#   [seed-commit, snap-1, snap-2, …]
# entirely decoupled from genesis history and never invalidated by a rebase.
# (See .harness/WITNESS-REF-DESIGN.md §3.1 for the design rationale.)
#
# HOW REUSE OF audit-ledger-append-only.sh WORKS
# -----------------------------------------------
# We do NOT copy the append-only comparison loop. Instead we:
#   1. Build a candidate commit (parent = witness tip) carrying the genesis
#      ledger blob.
#   2. Set WL_WITNESS_REF=<candidate-sha> and run the existing audit.
#   3. Exit code 0 (PASS/NEUTRAL) → ff-push the candidate to the witness ref.
#      Exit code 1 (VIOLATION) → refuse to push (detect tamper, RED).
#      Exit code 2 (INTERNAL)  → refuse to push, fail-closed (infrastructure error).
# This is the authoritative reuse: the same detector, the same logic, the same
# exit codes. Algol's S2 refute exercises this exact path.
#
# DETECTION VS PREVENTION
# -----------------------
# This script is DETECTIVE. It does not block a co-tamper at write time; it
# reveals one at push time. Window = push cadence. The forge-resistance comes
# from the fact that this runs on GitHub's substrate (the agent cannot fake a
# green) over a witness ref protected by branch-no-force-push (a toggle only
# Peat sets). See WITNESS-REF-DESIGN.md §6 for the full statement.
#
# SELF-CHECK (sandbox)
#   WL_REPO_ROOT       = path to real or sandbox repo
#   WL_GENESIS_LEDGER  = path to genesis ledger (default auto from WL_REPO_ROOT)
#   WL_WITNESS_REF     = ref name for the witness branch (default: integrity-witness)
#   WL_WITNESS_REMOTE  = remote name or URL for the witness ref push
#                        (default: origin; override with file:// for sandbox tests)
#   WL_LEDGER_REL      = ledger path relative to repo root (matches audit script)
#   WL_TASK_ID         = override CLAUDE_TASK_ID for log file naming
#   WL_AUDIT_SCRIPT    = path to audit-ledger-append-only.sh (default auto-resolved)
#   WL_DRY_RUN         = 1 → build candidate commit, run audit, but skip the push
#
# EXIT CODES
#   0  PASS / NEUTRAL  — witness ref advanced (or already current), OR pre-operational
#                        (witness ref absent / single-revision ledger)
#   1  VIOLATION       — a prior-published line was mutated or removed; NOT pushed
#   2  INTERNAL        — git plumbing error, missing dep, scope violation; NOT pushed
#
# HOW TO FIX A VIOLATION
# ----------------------
# A VIOLATION exit means a previously-committed ledger line was mutated or
# removed since the last witness snapshot. To investigate:
#   1. Compare the failing commit in the witness chain against the prior one:
#        git diff <prior-witness-sha> <candidate-sha> -- .harness/integrity-ledger.jsonl
#   2. Find the line that changed (a co-tamper) or disappeared (a deletion-tamper).
#   3. Restore the affected ledger line to its committed value, commit, and
#      re-push genesis — the publisher will re-run and pass once append-only
#      holds again.
#   4. If a deliberate rotation is intended, see .harness/WITNESS-REF-DESIGN.md §3.3
#      for the proper Peat-gated rotation procedure.
#
# SCOPE GUARDS (binding — never weaken without Canopus sign-off)
#   - Reads only from genesis checkout and witness ref.
#   - Writes ONLY to refs/heads/integrity-witness on the remote. No other ref.
#   - No rm of tracked files, no curl/wget, no --force push.
#   - .claude/beta/** never read, scanned, or touched.
#
# Logs to: .claude/hook-logs/<task_id>--publish-witness-ledger.log
# =============================================================================

set -uo pipefail

# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------
for dep in git sed grep printf mktemp; do
  if ! command -v "$dep" >/dev/null 2>&1; then
    printf 'ERROR [publish-witness-ledger] missing dependency: %s\n' "$dep" >&2
    exit 2
  fi
done

# ---------------------------------------------------------------------------
# Config + env overrides
# ---------------------------------------------------------------------------
LEDGER_REL="${WL_LEDGER_REL:-.harness/integrity-ledger.jsonl}"
WITNESS_BRANCH="${WL_WITNESS_REF:-integrity-witness}"
WITNESS_REMOTE="${WL_WITNESS_REMOTE:-origin}"
DRY_RUN="${WL_DRY_RUN:-0}"

# Scope guard: ledger must not live inside .claude/beta/
case "$LEDGER_REL" in
  *".claude/beta/"*)
    printf 'ERROR [publish-witness-ledger] SCOPE_VIOLATION: WL_LEDGER_REL points into .claude/beta (excluded)\n' >&2
    exit 2
    ;;
esac

# Resolve repo root from WL_REPO_ROOT, then git, then CLAUDE_PROJECT_DIR.
REPO_ROOT="${WL_REPO_ROOT:-}"
if [[ -z "$REPO_ROOT" ]]; then
  REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi
if [[ -z "$REPO_ROOT" ]]; then
  REPO_ROOT="${CLAUDE_PROJECT_DIR:-}"
fi
if [[ -z "$REPO_ROOT" ]] || ! git -C "$REPO_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  printf 'ERROR [publish-witness-ledger] not a git work tree (REPO_ROOT=%s)\n' "${REPO_ROOT:-<unset>}" >&2
  exit 2
fi
REPO_ROOT="$(git -C "$REPO_ROOT" rev-parse --show-toplevel 2>/dev/null || echo "$REPO_ROOT")"

# Genesis ledger path (absolute).
GENESIS_LEDGER="${WL_GENESIS_LEDGER:-${REPO_ROOT}/${LEDGER_REL}}"

# Audit script: try the canonical location relative to REPO_ROOT; allow override.
AUDIT_SCRIPT="${WL_AUDIT_SCRIPT:-${REPO_ROOT}/scripts/audit-ledger-append-only.sh}"
if [[ ! -f "$AUDIT_SCRIPT" ]]; then
  printf 'ERROR [publish-witness-ledger] audit script not found: %s\n' "$AUDIT_SCRIPT" >&2
  exit 2
fi

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOG_DIR="$REPO_ROOT/.claude/hook-logs"
mkdir -p "$LOG_DIR" 2>/dev/null || true
TASK_ID="${CLAUDE_TASK_ID:-${WL_TASK_ID:-session-$(date +%s)}}"
LOG="$LOG_DIR/${TASK_ID}--publish-witness-ledger.log"
TS="$(date -u +%FT%TZ 2>/dev/null || echo unknown)"

log()  { printf '%s [publish-witness-ledger] %s\n' "$TS" "$*" >> "$LOG" 2>/dev/null || true; }
emit() { printf '%s\n' "$*"; log "$*"; }

emit "PUBLISH-WITNESS-LEDGER ts=$TS"
emit "  repo_root=$REPO_ROOT"
emit "  ledger_rel=$LEDGER_REL"
emit "  witness_branch=$WITNESS_BRANCH"
emit "  witness_remote=$WITNESS_REMOTE"
emit "  dry_run=$DRY_RUN"

git_repo() { git -C "$REPO_ROOT" "$@"; }

# ---------------------------------------------------------------------------
# S0 — Check genesis ledger exists. If absent: pre-operational NEUTRAL.
# ---------------------------------------------------------------------------
if [[ ! -f "$GENESIS_LEDGER" ]]; then
  emit "RESULT status=NEUTRAL reason=GENESIS_LEDGER_ABSENT"
  emit "  '$GENESIS_LEDGER' does not exist in the genesis checkout."
  emit "  Pre-operational (ledger not yet seeded). Honest exit 0."
  log "exit 0 NEUTRAL genesis-ledger-absent"
  exit 0
fi

# ---------------------------------------------------------------------------
# S1 — Fetch the witness ref so we can read its tip blob.
#
# If the witness ref does not exist on the remote yet (Peat hasn't done §4
# step 2), we cannot publish — exit NEUTRAL (don't try to create the ref;
# only Peat creates it). If the remote itself is unreachable in sandbox (no
# network), let git produce a specific error caught below.
# ---------------------------------------------------------------------------
emit "  Fetching witness ref from remote..."

FETCH_REFSPEC="refs/heads/${WITNESS_BRANCH}:refs/remotes/witness-publisher/${WITNESS_BRANCH}"
if ! git_repo fetch "$WITNESS_REMOTE" "$FETCH_REFSPEC" 2>/dev/null; then
  # Distinguish "ref doesn't exist yet" from a real network error by checking
  # whether the remote is reachable at all.
  if git_repo ls-remote --exit-code "$WITNESS_REMOTE" "refs/heads/${WITNESS_BRANCH}" >/dev/null 2>&1; then
    emit "ERROR [publish-witness-ledger] fetch of witness ref failed (remote reachable but fetch errored)"
    log "exit 2 INTERNAL fetch-failed"
    exit 2
  else
    # Remote is unreachable OR the ref does not exist.
    REMOTE_HAS_REF="$(git_repo ls-remote "$WITNESS_REMOTE" "refs/heads/${WITNESS_BRANCH}" 2>/dev/null | grep -c . || true)"
    if [[ "$REMOTE_HAS_REF" -eq 0 ]]; then
      emit "RESULT status=NEUTRAL reason=WITNESS_REF_ABSENT"
      emit "  refs/heads/${WITNESS_BRANCH} does not exist on remote '${WITNESS_REMOTE}'."
      emit "  Pre-operational: Peat creates the witness ref at go-live step 2."
      emit "  Nothing to publish against. Honest exit 0."
      log "exit 0 NEUTRAL witness-ref-absent"
      exit 0
    fi
    emit "ERROR [publish-witness-ledger] remote '${WITNESS_REMOTE}' unreachable"
    log "exit 2 INTERNAL remote-unreachable"
    exit 2
  fi
fi

WITNESS_TIP_REF="refs/remotes/witness-publisher/${WITNESS_BRANCH}"
WITNESS_TIP_SHA="$(git_repo rev-parse "${WITNESS_TIP_REF}" 2>/dev/null || true)"
if [[ -z "$WITNESS_TIP_SHA" ]]; then
  emit "RESULT status=NEUTRAL reason=WITNESS_REF_ABSENT"
  emit "  refs/heads/${WITNESS_BRANCH} resolved to empty (ref was just created or never seeded)."
  emit "  Pre-operational: nothing to compare against. Honest exit 0."
  log "exit 0 NEUTRAL witness-ref-tip-unresolvable"
  exit 0
fi
emit "  witness_tip=$WITNESS_TIP_SHA"

# ---------------------------------------------------------------------------
# S2 — Compare genesis ledger content to the witness-tip ledger blob.
#
# If they are byte-identical, the witness is already current — nothing to do.
# This is idempotent: pushing genesis twice with no ledger change is healthy.
# ---------------------------------------------------------------------------
WITNESS_TIP_LEDGER="$(git_repo show "${WITNESS_TIP_SHA}:${LEDGER_REL}" 2>/dev/null || true)"
GENESIS_CONTENT="$(cat "$GENESIS_LEDGER")"

# Normalize: strip a trailing newline from both for comparison.
GENESIS_NORM="$(printf '%s' "$GENESIS_CONTENT")"
WITNESS_NORM="$(printf '%s' "$WITNESS_TIP_LEDGER")"

if [[ "$GENESIS_NORM" == "$WITNESS_NORM" ]]; then
  emit "RESULT status=CURRENT"
  emit "  Genesis ledger is byte-identical to the witness-tip snapshot."
  emit "  Witness ref is already current. Nothing to publish. Exit 0."
  log "exit 0 CURRENT no-change"
  exit 0
fi

# ---------------------------------------------------------------------------
# S3 — Build a candidate commit on top of the witness tip.
#
# WHY NOT ff genesis directly: genesis is a rebasing branch. A genesis rebase
# after a direct ff would make the next push a non-ff → RED in normal operation.
# Instead we build a lightweight snapshot commit:
#   tree  = witness-tip tree + ledger path overwritten with genesis blob
#   parent= witness tip
# The witness history becomes [seed, snap-1, snap-2, ...] — independent of
# genesis revisions, never broken by a rebase.
#
# We build the tree using a temporary git index (GIT_INDEX_FILE):
#   1. read-tree: populate the temp index from the witness-tip tree
#   2. update-index: replace the ledger blob with the genesis blob
#   3. write-tree: produce the new tree SHA
# This handles subdirectory paths correctly (mktree cannot handle paths with
# slashes; read-tree + update-index can). The temp index is cleaned on exit.
# GIT_AUTHOR_* and GIT_COMMITTER_* are set to a canonical service identity
# so the witness history is attributable and deterministic.
# ---------------------------------------------------------------------------
emit "  Building candidate snapshot commit on witness tip..."

# Temporary index file — cleaned on any exit via trap.
TMPIDX="$(mktemp /tmp/witness-pub-idx.XXXXXXXX)"
trap 'rm -f "$TMPIDX"' EXIT INT TERM

# Write the genesis ledger blob into the object store.
BLOB_SHA="$(printf '%s' "$GENESIS_CONTENT" | git_repo hash-object -w --stdin 2>/dev/null)"
if [[ -z "$BLOB_SHA" ]]; then
  emit "ERROR [publish-witness-ledger] failed to hash-object the genesis ledger"
  log "exit 2 INTERNAL hash-object-failed"
  exit 2
fi
emit "  blob_sha=$BLOB_SHA"

# Resolve the witness-tip tree.
WITNESS_TIP_TREE="$(git_repo rev-parse "${WITNESS_TIP_SHA}^{tree}" 2>/dev/null || true)"
if [[ -z "$WITNESS_TIP_TREE" ]]; then
  emit "ERROR [publish-witness-ledger] could not resolve tree for witness tip $WITNESS_TIP_SHA"
  log "exit 2 INTERNAL witness-tip-tree-unresolvable"
  exit 2
fi

# Populate temp index from witness-tip tree, then overlay the ledger blob.
if ! GIT_INDEX_FILE="$TMPIDX" git_repo read-tree "$WITNESS_TIP_TREE" 2>/dev/null; then
  emit "ERROR [publish-witness-ledger] failed to read-tree $WITNESS_TIP_TREE"
  log "exit 2 INTERNAL read-tree-failed"
  exit 2
fi
if ! GIT_INDEX_FILE="$TMPIDX" git_repo update-index \
    --add --cacheinfo "100644,${BLOB_SHA},${LEDGER_REL}" 2>/dev/null; then
  emit "ERROR [publish-witness-ledger] failed to update-index for $LEDGER_REL"
  log "exit 2 INTERNAL update-index-failed"
  exit 2
fi
TREE_SHA="$(GIT_INDEX_FILE="$TMPIDX" git_repo write-tree 2>/dev/null)"
rm -f "$TMPIDX"
trap - EXIT INT TERM

if [[ -z "$TREE_SHA" ]]; then
  emit "ERROR [publish-witness-ledger] failed to write-tree"
  log "exit 2 INTERNAL write-tree-failed"
  exit 2
fi
emit "  tree_sha=$TREE_SHA"

# Commit with a canonical service identity.
CANDIDATE_SHA="$(
  GIT_AUTHOR_NAME="worldline-witness-publisher" \
  GIT_AUTHOR_EMAIL="witness-publisher@worldline.local" \
  GIT_COMMITTER_NAME="worldline-witness-publisher" \
  GIT_COMMITTER_EMAIL="witness-publisher@worldline.local" \
  GIT_AUTHOR_DATE="$TS" \
  GIT_COMMITTER_DATE="$TS" \
  git_repo commit-tree "$TREE_SHA" \
    -p "$WITNESS_TIP_SHA" \
    -m "witness: ledger snapshot ${TS} [task=${TASK_ID}]" \
    2>/dev/null
)"
if [[ -z "$CANDIDATE_SHA" ]]; then
  emit "ERROR [publish-witness-ledger] failed to commit-tree"
  log "exit 2 INTERNAL commit-tree-failed"
  exit 2
fi
emit "  candidate_sha=$CANDIDATE_SHA"

# ---------------------------------------------------------------------------
# S4 — Run the existing append-only audit over the candidate ref.
#
# WL_WITNESS_REF is set to the candidate SHA so the audit walks
# [... witness_tip, candidate] — exactly the two-revision window proving
# genesis-ledger is a pure append over the last published snapshot.
# WL_REPO_ROOT is pinned to our repo root for sandbox correctness.
# The audit script logs to its own log; we capture its stdout for relay.
# ---------------------------------------------------------------------------
emit ""
emit "  Running audit-ledger-append-only.sh over candidate..."

AUDIT_OUT="$(
  WL_REPO_ROOT="$REPO_ROOT" \
  WL_LEDGER_REL="$LEDGER_REL" \
  WL_WITNESS_REF="$CANDIDATE_SHA" \
  WL_TASK_ID="${TASK_ID}--witness-pub-audit" \
  bash "$AUDIT_SCRIPT" 2>&1
)"
AUDIT_EXIT=$?

# Relay the audit output prefixed so it's readable in CI logs.
while IFS= read -r line; do
  emit "  [audit] $line"
done <<< "$AUDIT_OUT"

emit ""
emit "  audit_exit=$AUDIT_EXIT"

if [[ "$AUDIT_EXIT" -eq 1 ]]; then
  emit "RESULT status=VIOLATION exit=1"
  emit "  The audit detected a previously-published ledger line was MUTATED or"
  emit "  REMOVED in the genesis checkout. This is a co-tamper (M1-B) or deletion-"
  emit "  tamper (M2-C5). The witness ref will NOT be advanced."
  emit "  See HOW TO FIX A VIOLATION in the script header above."
  log "exit 1 VIOLATION audit-refused"
  exit 1
fi

if [[ "$AUDIT_EXIT" -ne 0 ]]; then
  emit "RESULT status=ERROR exit=2"
  emit "  The audit exited with code $AUDIT_EXIT (INTERNAL). Refusing to publish."
  emit "  This is a fail-closed infrastructure error — investigate the audit output."
  log "exit 2 INTERNAL audit-exit=$AUDIT_EXIT"
  exit 2
fi

# ---------------------------------------------------------------------------
# S5 — Fast-forward the witness ref to the candidate.
#
# Plain ff push: no --force, ever. If the ref has advanced since we fetched
# (a race), git will refuse the non-ff push and exit non-zero — spurious but
# safe. Resolved by the concurrency: group in the workflow (only one publisher
# job at a time per branch). We push the candidate SHA explicitly so the push
# is exactly the commit we audited, not whatever HEAD happens to be.
# ---------------------------------------------------------------------------
if [[ "$DRY_RUN" == "1" ]]; then
  emit "RESULT status=DRY_RUN"
  emit "  DRY_RUN=1: audit passed, candidate ready ($CANDIDATE_SHA), push SKIPPED."
  emit "  Would push: $WITNESS_TIP_SHA -> $CANDIDATE_SHA"
  emit "  Remote: $WITNESS_REMOTE refs/heads/${WITNESS_BRANCH}"
  log "exit 0 DRY_RUN candidate=$CANDIDATE_SHA"
  exit 0
fi

emit "  Pushing candidate to witness ref (ff only)..."
PUSH_REFSPEC="${CANDIDATE_SHA}:refs/heads/${WITNESS_BRANCH}"
PUSH_OUT="$(git_repo push "$WITNESS_REMOTE" "$PUSH_REFSPEC" 2>&1)"
PUSH_EXIT=$?

while IFS= read -r line; do
  emit "  [push] $line"
done <<< "$PUSH_OUT"

if [[ "$PUSH_EXIT" -ne 0 ]]; then
  emit "RESULT status=PUSH_FAILED exit=2"
  emit "  git push exited $PUSH_EXIT. Possible causes:"
  emit "    - Branch-protection refused a non-ff (expected if a race / another"
  emit "      job already advanced the ref — re-run is safe)."
  emit "    - Token lacks contents:write on refs/heads/${WITNESS_BRANCH}."
  emit "    - Network error."
  emit "  Witness ref NOT advanced."
  log "exit 2 PUSH_FAILED push_exit=$PUSH_EXIT"
  exit 2
fi

emit "RESULT status=PUBLISHED"
emit "  Witness ref advanced: $WITNESS_TIP_SHA -> $CANDIDATE_SHA"
emit "  remote: $WITNESS_REMOTE refs/heads/${WITNESS_BRANCH}"
log "exit 0 PUBLISHED old=$WITNESS_TIP_SHA new=$CANDIDATE_SHA"
exit 0
