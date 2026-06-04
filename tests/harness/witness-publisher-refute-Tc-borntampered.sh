#!/usr/bin/env bash
# =============================================================================
# tests/harness/witness-publisher-refute-Tc-borntampered.sh
#
# Refute:  T-c · BORN-TAMPERED APPEND  (S2 of TASK-2026-06-04-WITNESS-PUBLISHER)
# Author:  Algol (α-VER-06)
# Class:   SANDBOX HARNESS — /tmp git repos only, no network, no tracked mutation.
# Under test: scripts/publish-witness-ledger.sh (the publisher) + its reused
#             append-only audit.
#
# THE POINT OF THIS HARNESS (it is the OPPOSITE of the others)
# ------------------------------------------------------------
# T-a/T-b/T-d prove things are CAUGHT/HOLD. T-c proves the BOUNDARY of the
# guarantee — honestly. A "born-tampered append" is a NEW, internally-consistent
# ledger line (body + matching sha256) that an agent forges and that was NEVER
# published honestly. Because it is a pure APPEND (the prior lines are untouched),
# the append-only audit is, by design, GREEN — and the publisher advances the
# witness ref. THIS IS THE CORRECT, BY-DESIGN RESULT.
#
# This harness RUNS that case and asserts the publisher goes GREEN (exit 0,
# DRY_RUN candidate built / would-publish). Catching it is NOT the publisher's
# job: content authenticity (was this line ever a real event?) is the I1/I2
# poison-append lane, judge-required, EXPLICITLY OUT OF SCOPE for T2 (spec §38,
# non-goals). Algol NAMES it out-of-scope — does NOT dress green as "closed."
#
# Asserting GREEN here is what keeps the verdict honest: if a future change made
# the append-only audit RED on a well-formed append, THAT would be a regression
# (false positive in normal operation), and this harness would catch it.
#
# EXIT: 0 = T-c behaves AS DESIGNED (well-formed append → publisher GREEN).
#       1 = unexpected (publisher RED on a well-formed append = a regression).
# Either way: T-c is OUT OF SCOPE for the T2 guarantee — see out_of_scope_named.
# =============================================================================
set -uo pipefail

REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PUBLISH="${WL_PUBLISH_SCRIPT:-$REPO_DIR/scripts/publish-witness-ledger.sh}"
# The publisher resolves its reused append-only audit relative to its REPO_ROOT.
# In a sandbox genesis tree that script does not exist, so we point the publisher
# at the REAL audit via WL_AUDIT_SCRIPT (the documented override). This exercises
# the genuine reused detector — not a sandbox copy.
AUDIT_SCRIPT="${WL_AUDIT_SCRIPT:-$REPO_DIR/scripts/audit-ledger-append-only.sh}"
if [ ! -f "$PUBLISH" ]; then
  printf 'FATAL: publisher script not found at %s\n' "$PUBLISH" >&2; exit 2
fi
if [ ! -f "$AUDIT_SCRIPT" ]; then
  printf 'FATAL: append-only audit not found at %s\n' "$AUDIT_SCRIPT" >&2; exit 2
fi

SBX="$(mktemp -d /tmp/witness-Tc.XXXXXXXX)"
trap 'rm -rf "$SBX"' EXIT INT TERM

PASS=0; FAIL=0
ok()  { printf '  PASS  %s\n' "$*"; PASS=$((PASS+1)); }
bad() { printf '  FAIL  %s\n' "$*"; FAIL=$((FAIL+1)); }
hr()  { printf -- '----------------------------------------------------------\n'; }

export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null

LEDGER=".harness/integrity-ledger.jsonl"

printf 'T-c · BORN-TAMPERED APPEND (well-formed forged line -> publisher GREEN, BY DESIGN)\n'
printf 'sandbox=%s  publish=%s\n' "$SBX" "$PUBLISH"
hr

# ---------------------------------------------------------------------------
# Build a witness "remote" with an honest snapshot [header, A], and a genesis
# tree whose ledger is [header, A, FORGED] — FORGED is a NEW internally-
# consistent line (a path + a sha256 that is self-consistent) that was never
# honestly published. This is a pure append over the witness tip.
# ---------------------------------------------------------------------------
REMOTE="$SBX/remote.git"
git init --quiet --bare "$REMOTE"

HEADER='{"_ledger":"integrity-append-only","schema":1,"not_a_chain":true}'
A='{"path":".claude/handoffs/h-A.json","sha256":"aaaa"}'
# A born-tampered, internally-consistent NEW line: well-formed, plausible, but
# never the product of an honest event. The publisher cannot know that.
FORGED='{"path":".claude/handoffs/h-FORGED.json","sha256":"f0f0f0f0"}'

# Seed witness ref [header, A].
SEEDWC="$SBX/seedwc"
git init --quiet "$SEEDWC"; mkdir -p "$SEEDWC/.harness"
printf '%s\n%s\n' "$HEADER" "$A" > "$SEEDWC/$LEDGER"
git -C "$SEEDWC" add -A && git -C "$SEEDWC" commit --quiet -m "witness: [header,A]"
git -C "$SEEDWC" push --quiet "$REMOTE" "HEAD:refs/heads/integrity-witness"
WITNESS_TIP="$(git -C "$REMOTE" rev-parse refs/heads/integrity-witness)"

# Genesis tree with the born-tampered append.
GEN="$SBX/genesis"
git init --quiet "$GEN"; mkdir -p "$GEN/.harness"
printf '%s\n%s\n%s\n' "$HEADER" "$A" "$FORGED" > "$GEN/$LEDGER"
git -C "$GEN" add -A && git -C "$GEN" commit --quiet -m "genesis: [header,A,FORGED]"

printf 'witness snapshot = [header, A]   tip=%s\n' "$WITNESS_TIP"
printf 'genesis ledger   = [header, A, FORGED]  (FORGED is a pure, well-formed append)\n'
hr

# ---------------------------------------------------------------------------
# Run the REAL publisher in DRY_RUN against the sandbox witness remote.
# DRY_RUN=1: builds the candidate, runs the reused append-only audit, would
# push but skips the actual push. We assert it reaches the audit-passing,
# would-publish state (exit 0) — i.e. the born-tampered append is NOT caught.
# ---------------------------------------------------------------------------
printf '[run] publish-witness-ledger.sh (DRY_RUN=1) over the born-tampered append\n'
OUT="$(WL_REPO_ROOT="$GEN" WL_GENESIS_LEDGER="$GEN/$LEDGER" WL_LEDGER_REL="$LEDGER" \
       WL_WITNESS_REF=integrity-witness WL_WITNESS_REMOTE="$REMOTE" \
       WL_AUDIT_SCRIPT="$AUDIT_SCRIPT" \
       WL_DRY_RUN=1 WL_TASK_ID=Tc-borntampered bash "$PUBLISH" 2>&1)"
EC=$?
printf '%s\n' "$OUT" | grep -E 'RESULT status=|audit_exit=|status=DRY_RUN|VIOLATION' | sed 's/^/    /'
hr

if [ "$EC" -eq 0 ] && printf '%s' "$OUT" | grep -q 'status=DRY_RUN'; then
  ok "publisher reached DRY_RUN/would-publish (exit 0) — append-only audit GREEN on the forged append"
  printf '  => The born-tampered append is NOT caught. This is the CORRECT, BY-DESIGN result.\n'
elif printf '%s' "$OUT" | grep -q 'status=VIOLATION'; then
  bad "publisher went VIOLATION on a WELL-FORMED append — that is a REGRESSION (false positive)"
else
  bad "publisher exited $EC without a clean DRY_RUN — unexpected; investigate output above"
fi
hr

printf 'RESULT  pass=%d fail=%d\n' "$PASS" "$FAIL"
printf 'T-c VERDICT: OUT OF SCOPE for the T2 guarantee (not closed).\n'
printf '  A born-tampered, internally-consistent NEW ledger line is append-only-VALID;\n'
printf '  the publisher stays GREEN and advances the witness ref. The publisher proves\n'
printf '  APPEND-ONLY HISTORY (no prior line mutated/removed), NOT content authenticity\n'
printf '  (was this line ever a real event?). Content authenticity = the I1/I2 poison-\n'
printf '  append lane, judge-required, EXPLICITLY out of scope for T2 (spec non-goals).\n'
printf '  NAMED in out_of_scope_named — NOT silently passed as "closed."\n'
if [ "$FAIL" -eq 0 ]; then exit 0; else exit 1; fi
