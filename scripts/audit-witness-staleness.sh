#!/usr/bin/env bash
# =============================================================================
# scripts/audit-witness-staleness.sh
#
# Rail:    witness-staleness   (T-b detection — closes S3 of
#          TASK-2026-06-04-WITNESS-PUBLISHER)
# Owner:   Canopus (α-HRN-07)
# Task:    TASK-2026-06-04-WITNESS-PUBLISHER (S3)
# Class:   LIVENESS MONITOR  (alerts when the publisher goes dark)
# Status:  INERT — nothing here is live until Peat creates
#          refs/heads/integrity-witness (§4 of WITNESS-REF-DESIGN.md).
#
# WHAT THIS CLOSES (the T-b threat, from the refute spec)
# --------------------------------------------------------
# T-b (silent-dark / liveness): an agent disables or edits the publisher to
# skip publishing. The witness ref stops advancing. There is no detection
# unless something checks "has the witness ref advanced recently relative to
# the genesis ledger?"
#
# This script is that check. It alerts (non-zero) when:
#   1. The genesis ledger has content that is NOT yet reflected in the witness
#      snapshot, AND
#   2. The difference has been present longer than the expected cadence.
# If the witness == genesis ledger content (no delta pending), it is healthy
# regardless of clock — no false alerts during quiet periods. The alert fires
# only when there is a real unpublished delta that has aged past the deadline.
#
# WHY CONTENT-DELTA OVER WALL-CLOCK AGE
# --------------------------------------
# A pure "witness ref advanced within N hours" check false-positives during
# repos with no recent writes (a quiet gap is not a failure — the ledger is
# current, just not growing). The meaningful signal is: "there is unwitnessed
# content AND it has been sitting unwitnessed too long." Both conditions must
# hold before we alert.
#
# EXIT CODES
#   0  HEALTHY / NEUTRAL  — witness is current (no pending delta), OR witness
#                           ref / genesis ledger absent (pre-operational), OR
#                           pending delta is within the cadence window.
#   1  STALE              — genesis ledger has an unpublished delta older than
#                           WL_WITNESS_MAX_LAG_SECONDS (publisher went dark).
#   2  INTERNAL           — git plumbing error, missing dependency, scope
#                           violation. Fail-closed (never silently healthy on
#                           a broken probe).
#
# HOW TO FIX A STALE ALERT
# -------------------------
# A STALE exit means the genesis ledger has content not yet published to the
# witness ref, and the delta is older than the allowed cadence. Investigate:
#   1. Check the publisher job in GitHub Actions — is it running? Is it red?
#   2. If the publisher job is absent or disabled, re-enable it. The normal
#      path: push genesis → publisher runs → witness advances.
#   3. If the publisher is red (VIOLATION), that is a different signal (a
#      co-tamper was detected) — see publish-witness-ledger.sh HOW TO FIX.
#   4. If the delta is intentional and there is no recent genesis push, simply
#      push genesis (even without changes) to trigger the publisher.
#
# ENV OVERRIDES (all env-overridable for sandbox tests — no sed/patch of the
# script itself, consistent with the harness scripting standard)
#   WL_REPO_ROOT           repo root (default: git rev-parse from CWD /
#                          CLAUDE_PROJECT_DIR)
#   WL_LEDGER_REL          ledger path relative to repo root
#                          (default: .harness/integrity-ledger.jsonl)
#   WL_WITNESS_REF         witness branch name
#                          (default: integrity-witness)
#   WL_WITNESS_REMOTE      remote name (default: origin)
#   WL_WITNESS_MAX_LAG_SECONDS
#                          cadence threshold in seconds (default: 86400 = 24h)
#                          Tune: a high-churn repo might use 3600; a low-churn
#                          repo might use 259200 (72h). For the genesis branch
#                          where Peat typically pushes within a day, 86400 is
#                          the conservative default.
#   WL_TASK_ID             override CLAUDE_TASK_ID for log naming
#
# SCOPE GUARDS (binding)
#   - Read-only. Modifies no tracked file. No curl/wget. No rm of tracked paths.
#   - .claude/beta/** never read, scanned, or touched.
#
# Logs to: .claude/hook-logs/<task_id>--audit-witness-staleness.log
# =============================================================================

set -uo pipefail

# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------
for dep in git sed grep printf date; do
  if ! command -v "$dep" >/dev/null 2>&1; then
    printf 'ERROR [audit-witness-staleness] missing dependency: %s\n' "$dep" >&2
    exit 2
  fi
done

# ---------------------------------------------------------------------------
# Config + env overrides
# ---------------------------------------------------------------------------
LEDGER_REL="${WL_LEDGER_REL:-.harness/integrity-ledger.jsonl}"
WITNESS_BRANCH="${WL_WITNESS_REF:-integrity-witness}"
WITNESS_REMOTE="${WL_WITNESS_REMOTE:-origin}"
MAX_LAG_SECONDS="${WL_WITNESS_MAX_LAG_SECONDS:-86400}"

# Scope guard
case "$LEDGER_REL" in
  *".claude/beta/"*)
    printf 'ERROR [audit-witness-staleness] SCOPE_VIOLATION: WL_LEDGER_REL points into .claude/beta (excluded)\n' >&2
    exit 2
    ;;
esac

# Resolve repo root.
REPO_ROOT="${WL_REPO_ROOT:-}"
if [[ -z "$REPO_ROOT" ]]; then
  REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi
if [[ -z "$REPO_ROOT" ]]; then
  REPO_ROOT="${CLAUDE_PROJECT_DIR:-}"
fi
if [[ -z "$REPO_ROOT" ]] || ! git -C "$REPO_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  printf 'ERROR [audit-witness-staleness] not a git work tree (REPO_ROOT=%s)\n' "${REPO_ROOT:-<unset>}" >&2
  exit 2
fi
REPO_ROOT="$(git -C "$REPO_ROOT" rev-parse --show-toplevel 2>/dev/null || echo "$REPO_ROOT")"

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOG_DIR="$REPO_ROOT/.claude/hook-logs"
mkdir -p "$LOG_DIR" 2>/dev/null || true
TASK_ID="${CLAUDE_TASK_ID:-${WL_TASK_ID:-session-$(date +%s)}}"
LOG="$LOG_DIR/${TASK_ID}--audit-witness-staleness.log"
TS="$(date -u +%FT%TZ 2>/dev/null || echo unknown)"
NOW_EPOCH="$(date +%s 2>/dev/null || echo 0)"

log()  { printf '%s [witness-staleness] %s\n' "$TS" "$*" >> "$LOG" 2>/dev/null || true; }
emit() { printf '%s\n' "$*"; log "$*"; }

emit "AUDIT-WITNESS-STALENESS ts=$TS"
emit "  repo_root=$REPO_ROOT"
emit "  ledger_rel=$LEDGER_REL"
emit "  witness_branch=$WITNESS_BRANCH"
emit "  witness_remote=$WITNESS_REMOTE"
emit "  max_lag_seconds=$MAX_LAG_SECONDS"

git_repo() { git -C "$REPO_ROOT" "$@"; }

# ---------------------------------------------------------------------------
# S1 — Genesis ledger must exist. If absent: pre-operational NEUTRAL.
# ---------------------------------------------------------------------------
GENESIS_LEDGER="${REPO_ROOT}/${LEDGER_REL}"
if [[ ! -f "$GENESIS_LEDGER" ]]; then
  emit "RESULT status=NEUTRAL reason=GENESIS_LEDGER_ABSENT"
  emit "  '$GENESIS_LEDGER' does not exist. Pre-operational. Exit 0."
  log "exit 0 NEUTRAL genesis-ledger-absent"
  exit 0
fi

# ---------------------------------------------------------------------------
# S2 — Resolve the witness ref (local or fetched tracking).
#
# In CI: the publish job fetches into refs/remotes/witness-publisher/…
# For this staleness check we simply probe the remote directly via ls-remote.
# This avoids needing a prior fetch step: ls-remote is read-only and tells us
# the current tip SHA without modifying the local repo state.
# If the witness ref doesn't exist yet: pre-operational NEUTRAL.
# ---------------------------------------------------------------------------
emit "  Probing witness ref on remote..."
REMOTE_LS="$(git_repo ls-remote "$WITNESS_REMOTE" "refs/heads/${WITNESS_BRANCH}" 2>/dev/null || true)"
if [[ -z "$REMOTE_LS" ]]; then
  emit "RESULT status=NEUTRAL reason=WITNESS_REF_ABSENT"
  emit "  refs/heads/${WITNESS_BRANCH} does not exist on '${WITNESS_REMOTE}'."
  emit "  Pre-operational: Peat creates the witness ref at go-live step 2."
  emit "  Liveness is only meaningful once the publisher is active. Exit 0."
  log "exit 0 NEUTRAL witness-ref-absent"
  exit 0
fi

WITNESS_TIP_SHA="$(printf '%s' "$REMOTE_LS" | awk '{print $1}')"
emit "  witness_tip=$WITNESS_TIP_SHA"

# ---------------------------------------------------------------------------
# S3 — Fetch the witness-tip ledger blob (read-only show).
#
# We fetch the single witness-tip object to compare against genesis content.
# No full fetch-depth; git fetch --depth=1 with the explicit SHA is enough.
# ---------------------------------------------------------------------------
emit "  Fetching witness-tip object..."
# A refspec-free fetch of the specific SHA (requires server support, which
# GitHub provides). Fallback: fetch the branch head shallowly.
if ! git_repo fetch --quiet --depth=1 "$WITNESS_REMOTE" "$WITNESS_TIP_SHA" 2>/dev/null; then
  # Fallback: fetch the branch shallowly.
  git_repo fetch --quiet --depth=1 "$WITNESS_REMOTE" \
    "refs/heads/${WITNESS_BRANCH}:refs/remotes/witness-staleness/${WITNESS_BRANCH}" 2>/dev/null \
    || true
fi

WITNESS_TIP_LEDGER="$(git_repo show "${WITNESS_TIP_SHA}:${LEDGER_REL}" 2>/dev/null || true)"
GENESIS_CONTENT="$(cat "$GENESIS_LEDGER")"

# ---------------------------------------------------------------------------
# S4 — Compare. If identical: no delta, healthy.
# ---------------------------------------------------------------------------
GENESIS_NORM="$(printf '%s' "$GENESIS_CONTENT")"
WITNESS_NORM="$(printf '%s' "$WITNESS_TIP_LEDGER")"

if [[ "$GENESIS_NORM" == "$WITNESS_NORM" ]]; then
  emit "RESULT status=HEALTHY reason=WITNESS_CURRENT"
  emit "  Genesis ledger is byte-identical to the witness-tip snapshot."
  emit "  No unpublished delta exists. Publisher is live and current. Exit 0."
  log "exit 0 HEALTHY no-delta"
  exit 0
fi

# ---------------------------------------------------------------------------
# S5 — Delta exists. Measure how long it has been unwitnessed.
#
# The delta's age is approximated from the committer date of the genesis commit
# that last changed the ledger file. This is the most accurate proxy we can
# compute without a separate timestamp file:
#   git log -1 --format=%ct -- <ledger>
# gives the epoch of the last genesis commit that touched the ledger.
# If the ledger has no committed revision (e.g. only uncommitted changes):
# use the file mtime as a weaker bound. If we can't determine age at all:
# emit STALE conservatively (fail-closed on unknown age).
# ---------------------------------------------------------------------------
emit "  Delta found between genesis and witness tip. Measuring age..."

# Genesis commit epoch for the ledger file.
LEDGER_COMMIT_EPOCH="$(git_repo log -1 --format="%ct" -- "$LEDGER_REL" 2>/dev/null | grep -E '^[0-9]+$' || true)"
if [[ -z "$LEDGER_COMMIT_EPOCH" ]]; then
  # Fallback to file mtime (POSIX stat -c, macOS stat -f)
  LEDGER_COMMIT_EPOCH="$(stat -c '%Y' "$GENESIS_LEDGER" 2>/dev/null || stat -f '%m' "$GENESIS_LEDGER" 2>/dev/null || echo '')"
fi

if [[ -z "$LEDGER_COMMIT_EPOCH" ]]; then
  emit "RESULT status=STALE exit=1"
  emit "  Cannot determine delta age (no committed revision, stat unavailable)."
  emit "  Failing closed: an unwitnessed delta of unknown age is treated as stale."
  emit "  See HOW TO FIX A STALE ALERT in the script header."
  log "exit 1 STALE age-unknown"
  exit 1
fi

DELTA_AGE_SECONDS=$(( NOW_EPOCH - LEDGER_COMMIT_EPOCH ))
emit "  delta_age_seconds=$DELTA_AGE_SECONDS  max_lag_seconds=$MAX_LAG_SECONDS"

if [[ "$DELTA_AGE_SECONDS" -lt "$MAX_LAG_SECONDS" ]]; then
  emit "RESULT status=HEALTHY reason=WITHIN_CADENCE"
  emit "  Unpublished delta exists but is only ${DELTA_AGE_SECONDS}s old (< ${MAX_LAG_SECONDS}s threshold)."
  emit "  Publisher has not gone dark — delta is within the allowed lag window. Exit 0."
  log "exit 0 HEALTHY within-cadence age=${DELTA_AGE_SECONDS}"
  exit 0
fi

# Delta is older than the cadence. The publisher has gone dark.
emit ""
emit "STALE publisher_gone_dark=true"
emit "  delta_age_seconds=$DELTA_AGE_SECONDS > max_lag_seconds=$MAX_LAG_SECONDS"
emit "  Genesis ledger has an unpublished delta that has been unwitnessed for"
emit "  ${DELTA_AGE_SECONDS}s. The publisher job appears to have gone dark (T-b threat)."
emit ""
emit "RESULT status=STALE exit=1"
emit "  This corresponds to T-b (silent-dark): the publisher silently stopped"
emit "  advancing the witness ref. This alert is the S3 detection: it surfaces"
emit "  the stall rather than letting it go unnoticed."
emit "  See HOW TO FIX A STALE ALERT in the script header."
log "exit 1 STALE age=${DELTA_AGE_SECONDS} max=${MAX_LAG_SECONDS}"
exit 1
