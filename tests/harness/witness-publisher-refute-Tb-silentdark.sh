#!/usr/bin/env bash
# =============================================================================
# tests/harness/witness-publisher-refute-Tb-silentdark.sh
#
# Refute:  T-b · SILENT-DARK / LIVENESS  (S2 of TASK-2026-06-04-WITNESS-PUBLISHER)
# Author:  Algol (α-VER-06)
# Class:   SANDBOX HARNESS — /tmp git repos only, no network, no tracked mutation.
# Under test: scripts/audit-witness-staleness.sh (S3 — the T-b detector).
#
# THE THREAT
# ----------
# T-b: an agent disables or edits the publisher so it stops advancing the
# witness ref. The witness silently stops advancing. There is NO detection
# unless something checks "has the witness ref advanced recently relative to the
# genesis ledger?" The S3 staleness monitor is that check; it MUST alert
# (non-zero), not go silent, when a real unpublished delta has aged past cadence.
#
# WHY NOT max_lag=0 (avoiding the degenerate self-check)
# ------------------------------------------------------
# Canopus's SCENARIO 4 used WL_WITNESS_MAX_LAG_SECONDS=0, which trips STALE for
# ANY delta regardless of age — it does not exercise the cadence arithmetic. To
# actually refute the liveness guarantee we use the REAL default cadence
# (86400s) and a delta committed ~2 days in the PAST, so STALE fires on genuine
# age, and a control with a FRESH delta stays HEALTHY (within-cadence).
#
# THE COROLLARY THAT MATTERS
# --------------------------
# A co-tamper is ALSO a content delta. So a dark publisher hiding a co-tamper
# (genesis ledger != witness snapshot, aged) STILL trips STALE — the liveness
# monitor and the append-only audit cover the same dark-publisher gap from two
# angles. We assert this explicitly.
#
# Each scenario runs against a sandbox git repo + a bare "remote" carrying the
# witness ref, invoking the real audit-witness-staleness.sh via env-override.
#
# EXIT: 0 = T-b CAUGHT (stale delta flagged; fresh/current stay healthy).
#       1 = NOT CAUGHT (a dark publisher with an aged delta was NOT flagged).
# =============================================================================
set -uo pipefail

AUDIT="${WL_STALENESS_SCRIPT:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/audit-witness-staleness.sh}"
if [ ! -f "$AUDIT" ]; then
  printf 'FATAL: staleness script not found at %s\n' "$AUDIT" >&2; exit 2
fi

SBX="$(mktemp -d /tmp/witness-Tb.XXXXXXXX)"
trap 'rm -rf "$SBX"' EXIT INT TERM

PASS=0; FAIL=0
ok()  { printf '  PASS  %s\n' "$*"; PASS=$((PASS+1)); }
bad() { printf '  FAIL  %s\n' "$*"; FAIL=$((FAIL+1)); }
hr()  { printf -- '----------------------------------------------------------\n'; }

export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null

LEDGER=".harness/integrity-ledger.jsonl"

printf 'T-b · SILENT-DARK / LIVENESS (staleness monitor must alert on aged delta)\n'
printf 'sandbox=%s  audit=%s\n' "$SBX" "$AUDIT"
hr

NOW="$(date +%s)"
TWO_DAYS_AGO=$(( NOW - 2*86400 ))   # 172800s old > 86400s default cadence
ONE_HOUR_AGO=$(( NOW - 3600 ))      # 3600s old  < 86400s default cadence

# build_scenario <name> <witness_lines_func> <genesis_lines_func> <commit_epoch>
# Returns: a repo dir with a witness "remote" and a genesis working ledger.
make_repo() {
  local dir="$1"
  git init --quiet "$dir"
  mkdir -p "$dir/.harness"
}

# Each scenario: build a bare remote holding the witness ref, build a genesis
# working tree, commit the genesis ledger at the given epoch, then run the audit.

run_scenario() {
  local name="$1" witness_content="$2" genesis_content="$3" commit_epoch="$4" max_lag="$5" expect_exit="$6" label="$7"
  local D="$SBX/$name"
  local REMOTE="$D/remote.git"
  local GEN="$D/genesis"
  mkdir -p "$D"
  git init --quiet --bare "$REMOTE"

  # Seed the witness ref via a throwaway clone.
  local SEEDWC="$D/seedwc"
  git init --quiet "$SEEDWC"; mkdir -p "$SEEDWC/.harness"
  printf '%s' "$witness_content" > "$SEEDWC/$LEDGER"
  git -C "$SEEDWC" add -A
  git -C "$SEEDWC" commit --quiet -m "witness snapshot"
  git -C "$SEEDWC" push --quiet "$REMOTE" "HEAD:refs/heads/integrity-witness"

  # Build the genesis working tree with its (possibly diverged) ledger, committed
  # at the requested epoch so the staleness age math is exercised.
  git init --quiet "$GEN"; mkdir -p "$GEN/.harness"
  printf '%s' "$genesis_content" > "$GEN/$LEDGER"
  git -C "$GEN" add -A
  GIT_AUTHOR_DATE="@$commit_epoch" GIT_COMMITTER_DATE="@$commit_epoch" \
    git -C "$GEN" commit --quiet -m "genesis ledger @ epoch $commit_epoch"

  printf '[%s] %s\n' "$name" "$label"
  local OUT
  OUT="$(WL_REPO_ROOT="$GEN" WL_LEDGER_REL="$LEDGER" WL_WITNESS_REF=integrity-witness \
         WL_WITNESS_REMOTE="$REMOTE" WL_WITNESS_MAX_LAG_SECONDS="$max_lag" \
         WL_TASK_ID="Tb-$name" bash "$AUDIT" 2>&1)"
  local EC=$?
  printf '%s\n' "$OUT" | grep -E 'RESULT status=|delta_age_seconds=' | sed 's/^/    /'
  if [ "$EC" -eq "$expect_exit" ]; then
    ok "$name exit=$EC (expected $expect_exit)"
  else
    bad "$name exit=$EC (EXPECTED $expect_exit)"
  fi
}

HEADER='{"_ledger":"integrity-append-only","schema":1,"not_a_chain":true}'$'\n'
A='{"path":".claude/handoffs/h-A.json","sha256":"aaaa"}'$'\n'
B='{"path":".claude/handoffs/h-B.json","sha256":"bbbb"}'$'\n'
A_TAMPERED='{"path":".claude/handoffs/h-A.json","sha256":"dead"}'$'\n'

# --- Scenario 1: publisher DARK, aged honest append → STALE (the core T-b) ---
# witness snapshot has [header,A]; genesis has [header,A,B] (a real append that
# was never published), committed 2 days ago. With 24h cadence → STALE exit 1.
run_scenario stale-aged-append \
  "${HEADER}${A}" \
  "${HEADER}${A}${B}" \
  "$TWO_DAYS_AGO" 86400 1 \
  "publisher dark: unpublished append aged 2 days, cadence 24h -> expect STALE(1)"
hr

# --- Scenario 2 (control): same delta but FRESH (1h old) → HEALTHY within cadence
run_scenario fresh-append-within-cadence \
  "${HEADER}${A}" \
  "${HEADER}${A}${B}" \
  "$ONE_HOUR_AGO" 86400 0 \
  "delta only 1h old, cadence 24h -> expect HEALTHY(0) (no false alarm)"
hr

# --- Scenario 3 (control): witness CURRENT (no delta), old clock → HEALTHY ---
# genesis == witness content; even committed 2 days ago, no pending delta → 0.
run_scenario current-no-delta \
  "${HEADER}${A}" \
  "${HEADER}${A}" \
  "$TWO_DAYS_AGO" 86400 0 \
  "witness current, no pending delta, old clock -> expect HEALTHY(0)"
hr

# --- Scenario 4 (the corollary): dark publisher HIDING A CO-TAMPER still STALE
# genesis has A's hash forged (aaaa->dead) vs witness's honest A; that IS a
# content delta, aged 2 days → STALE. The dark-publisher gap is covered.
run_scenario stale-co-tamper-hidden \
  "${HEADER}${A}" \
  "${HEADER}${A_TAMPERED}" \
  "$TWO_DAYS_AGO" 86400 1 \
  "dark publisher hiding a co-tamper: forged delta aged 2 days -> expect STALE(1)"
hr

printf 'RESULT  pass=%d fail=%d\n' "$PASS" "$FAIL"
if [ "$FAIL" -eq 0 ]; then
  printf 'T-b VERDICT: CAUGHT — a dark publisher with an aged unpublished delta is\n'
  printf '  flagged STALE (real cadence arithmetic, not max_lag=0); fresh deltas and\n'
  printf '  a current witness stay HEALTHY (no false alarm); a hidden co-tamper, being\n'
  printf '  a delta, also trips STALE.\n'
  printf '  RESIDUAL (named, not blocking): content-delta gating means a dark publisher\n'
  printf '  with NO pending change is correctly silent (healthy ledger, just not growing).\n'
  printf '  And publisher+monitor share publish-witness.yml — disabling BOTH is one edit;\n'
  printf '  the ultimate backstop is the required-status-check at the seam (§4 step 3).\n'
  exit 0
else
  printf 'T-b VERDICT: NOT CAUGHT — refute FAILED.\n'
  exit 1
fi
