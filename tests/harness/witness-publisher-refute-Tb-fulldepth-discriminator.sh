#!/usr/bin/env bash
# =============================================================================
# tests/harness/witness-publisher-refute-Tb-fulldepth-discriminator.sh
#
# Refute:  T-b · SILENT-DARK — DEPLOYED-CONFIG RE-REFUTE (post-Canopus fix)
#          (Re-refute after publish-witness.yml staleness-monitor changed from
#           fetch-depth:1 to fetch-depth:0 per Canopus REVISE handoff)
# Author:  Algol (α-VER-06)
# Class:   SANDBOX HARNESS — /tmp git repos only, no network, no tracked mutation.
# Under test: scripts/audit-witness-staleness.sh WITH the FIXED checkout config
#             (publish-witness.yml staleness-monitor: fetch-depth: 0 = full history).
#
# CONTEXT — WHAT CHANGED
# ----------------------
# R4 (witness-publisher-refute-Tb-shallow-discriminator.sh) proved that under
# fetch-depth:1 a days-old unpublished ledger delta was reported HEALTHY:
#   - Only 1 commit available in the shallow clone → tip = code-only commit
#   - `git log -1 -- <ledger>` found nothing → mtime fallback → age≈1s
#   - DELTA_AGE_SECONDS≈1 < 86400 → exit 0 HEALTHY (BUG REPRODUCED)
#
# Canopus's fix: set staleness-monitor fetch-depth to 0 (full history).
# Confirmed in the YAML:
#   staleness-monitor / Checkout genesis / with: fetch-depth: 0
# with inline comment:
#   "Under depth 1, git log -1 -- <ledger> returns the tip-commit timestamp
#    rather than the ledger-delta timestamp, causing a days-old unpublished
#    delta to read as ~1 second old → false HEALTHY."
#
# RE-REFUTE CLAIM UNDER TEST
# --------------------------
# With a FULL clone (no --depth flag, all history available):
#   - `git log -1 --format=%ct -- <ledger>` resolves to the real ledger-delta
#     commit, dated 2 days ago (172800s).
#   - DELTA_AGE_SECONDS≈172800 > 86400 → exit 1 STALE (BUG CLOSED).
# The decisive evidence is delta_age_seconds≈172800, NOT merely exit 1.
# Exit 1 could come from the fail-closed unknown-age path (no age emitted);
# only "delta_age_seconds≈172800" confirms the fix fires for the right reason.
#
# SANDBOX CONFIGURATION
# ---------------------
# Same remote layout as the shallow discriminator:
#   commit-1: ledger delta (2 days old) — the old unpublished delta
#   commit-2: code-only commit (now) — the normal-operation tip
# Witness ref: pre-delta ledger (unpublished delta pending)
# Clone: FULL history (no --depth), modeling the fixed fetch-depth:0 checkout.
#
# EXIT CODES
#   0  BUG CLOSED — STALE(1) with delta_age_seconds≈172800 (right reason)
#   1  BUG PERSISTS — HEALTHY(0) on aged delta (fix did not work)
#   2  INCONCLUSIVE — exit 1 without delta_age_seconds line (fail-closed path,
#      not the right-reason evidence; treated as inconclusive not closed)
# =============================================================================
set -uo pipefail

AUDIT="${WL_STALENESS_SCRIPT:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/audit-witness-staleness.sh}"
[ -f "$AUDIT" ] || { printf 'FATAL: staleness script not found at %s\n' "$AUDIT" >&2; exit 2; }

SBX="$(mktemp -d /tmp/witness-Tb-fulldepth.XXXXXXXX)"
trap 'rm -rf "$SBX"' EXIT INT TERM

export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null

LEDGER=".harness/integrity-ledger.jsonl"
HEADER='{"_ledger":"integrity-append-only","schema":1,"not_a_chain":true}'
A='{"path":".claude/handoffs/h-A.json","sha256":"aaaa"}'
B='{"path":".claude/handoffs/h-B.json","sha256":"bbbb"}'

NOW="$(date +%s)"
TWO_DAYS_AGO=$(( NOW - 2*86400 ))   # 172800s > 86400s cadence — the aged delta
ONE_HOUR_AGO=$(( NOW - 3600 ))      # 3600s < 86400s cadence — fresh (control)

# Acceptable delta for "≈172800": within 600s (10 minute test-run window).
AGE_LOWER=$(( 172800 - 600 ))
AGE_UPPER=$(( 172800 + 600 ))

PASS=0; FAIL=0; WARN=0
ok()   { printf '  PASS  %s\n' "$*"; PASS=$((PASS+1)); }
bad()  { printf '  FAIL  %s\n' "$*"; FAIL=$((FAIL+1)); }
warn() { printf '  WARN  %s\n' "$*"; WARN=$((WARN+1)); }
hr()   { printf -- '----------------------------------------------------------\n'; }

printf 'T-b FULL-DEPTH DISCRIMINATOR (staleness monitor, post-Canopus fix, fetch-depth:0)\n'
printf 'sandbox=%s\n' "$SBX"
hr

# ---------------------------------------------------------------------------
# Build the genesis "remote" with REAL history — same layout as R4 shallow test:
#   commit-1: ledger delta [header,A,B] committed 2 DAYS AGO (the dark delta)
#   commit-2: a CODE-ONLY commit dated NOW on top (normal-operation tip)
# Witness ref: pre-delta ledger [header,A] (delta is unpublished).
# ---------------------------------------------------------------------------
printf '[setup] building remote: 2-commit genesis (ledger-delta 2d ago + code tip now)\n'
REMOTE="$SBX/genesis-remote.git"
git init --quiet --bare "$REMOTE"

WORK="$SBX/genesis-work"
git init --quiet "$WORK"
mkdir -p "$WORK/.harness"

# commit-1: ledger delta, 2 days old
printf '%s\n%s\n%s\n' "$HEADER" "$A" "$B" > "$WORK/$LEDGER"
git -C "$WORK" add -A
GIT_AUTHOR_DATE="@$TWO_DAYS_AGO" GIT_COMMITTER_DATE="@$TWO_DAYS_AGO" \
  git -C "$WORK" commit --quiet -m "ledger delta (append B) — 2 days ago"
COMMIT1="$(git -C "$WORK" rev-parse HEAD)"

# commit-2: code-only commit dated NOW — this is the shallow tip in R4
printf 'some code change\n' > "$WORK/src.txt"
git -C "$WORK" add -A
GIT_AUTHOR_DATE="@$NOW" GIT_COMMITTER_DATE="@$NOW" \
  git -C "$WORK" commit --quiet -m "code change (no ledger touch) — now [TIP]"
COMMIT2="$(git -C "$WORK" rev-parse HEAD)"
git -C "$WORK" branch -M main
git -C "$WORK" push --quiet "$REMOTE" "main:refs/heads/main"
git -C "$REMOTE" symbolic-ref HEAD refs/heads/main

# Witness ref: pre-delta ledger [header,A]
WITWC="$SBX/witness-wc"
git init --quiet "$WITWC"
mkdir -p "$WITWC/.harness"
printf '%s\n%s\n' "$HEADER" "$A" > "$WITWC/$LEDGER"
git -C "$WITWC" add -A
git -C "$WITWC" commit --quiet -m "witness snapshot [header,A]"
git -C "$WITWC" push --quiet "$REMOTE" "HEAD:refs/heads/integrity-witness"

printf '  commit-1 (ledger delta, 2d ago) = %s\n' "$COMMIT1"
printf '  commit-2 (code tip, now)        = %s\n' "$COMMIT2"
printf '  witness ref points at: pre-delta [header,A] (delta unpublished)\n'
hr

# ===========================================================================
# SCENARIO 1 — THE CRITICAL CASE (fix discriminator)
# Full clone (no --depth), models fetch-depth:0. An aged (2-day) delta MUST
# be STALE exit 1, and delta_age_seconds must be ≈172800 (the RIGHT REASON).
# Under the R4 bug (shallow), this was HEALTHY exit 0 with delta_age≈1.
# ===========================================================================
printf '[scenario 1] FULL clone (no --depth), aged 2-day delta — MUST be STALE(1) + delta_age≈172800\n'

FULL="$SBX/full-checkout"
# NO --depth flag: full history, both commits reachable, git log resolves real age.
git clone --quiet --branch main "file://$REMOTE" "$FULL"
FULL_COMMITS="$(git -C "$FULL" rev-list --count HEAD 2>/dev/null || echo '?')"
printf '  full clone depth: %s commit(s) at HEAD\n' "$FULL_COMMITS"

# Verify git log resolves the real ledger-delta commit epoch.
LEDGER_LOG_EPOCH="$(git -C "$FULL" log -1 --format='%ct' -- "$LEDGER" 2>/dev/null || true)"
printf '  git log -1 %%ct -- ledger: %s (expected ≈%s)\n' "$LEDGER_LOG_EPOCH" "$TWO_DAYS_AGO"
if [ -n "$LEDGER_LOG_EPOCH" ]; then
  printf '  git log resolves ledger commit → mtime fallback WILL NOT fire\n'
  ok "scenario1: git log finds real ledger-delta epoch in full clone"
else
  bad "scenario1: git log returned empty even on full clone — unexpected"
fi

# Run the staleness monitor.
OUT="$(WL_REPO_ROOT="$FULL" WL_LEDGER_REL="$LEDGER" WL_WITNESS_REF=integrity-witness \
       WL_WITNESS_REMOTE="$REMOTE" WL_WITNESS_MAX_LAG_SECONDS=86400 \
       WL_TASK_ID=Tb-fulldepth-s1 bash "$AUDIT" 2>&1)"
EC1=$?
printf '%s\n' "$OUT" | grep -E 'RESULT status=|delta_age_seconds=|reason=' | sed 's/^/    /'
printf '    exit=%s\n' "$EC1"

# Extract delta_age_seconds.
DELTA_AGE="$(printf '%s' "$OUT" | grep -o 'delta_age_seconds=[0-9]*' | head -1 | cut -d= -f2 || true)"
printf '  delta_age_seconds observed: %s\n' "${DELTA_AGE:-<not emitted>}"

if [ "$EC1" -eq 1 ] && [ -n "$DELTA_AGE" ] && [ "$DELTA_AGE" -ge "$AGE_LOWER" ] && [ "$DELTA_AGE" -le "$AGE_UPPER" ]; then
  ok "scenario1: exit=1 STALE + delta_age_seconds≈172800 — FIX CONFIRMED (right reason)"
elif [ "$EC1" -eq 1 ] && [ -z "$DELTA_AGE" ]; then
  warn "scenario1: exit=1 but NO delta_age_seconds emitted — fail-closed path, not right-reason evidence"
  FAIL=$((FAIL+1))
  printf '  INCONCLUSIVE: fix cannot be confirmed without the delta_age_seconds line\n'
elif [ "$EC1" -eq 0 ]; then
  bad "scenario1: exit=0 HEALTHY on a 2-day-old delta — FIX DID NOT WORK (T-b still open)"
  printf '  delta_age_seconds=%s — same silent-false-green as R4 shallow discriminator\n' "${DELTA_AGE:-<not emitted>}"
else
  bad "scenario1: exit=$EC1 unexpected"
fi
hr

# ===========================================================================
# SCENARIO 2 — CONTROL: fresh delta (1h old) — HEALTHY exit 0 (no false alarm)
# The fix must not introduce false positives on in-cadence deltas.
# ===========================================================================
printf '[scenario 2] CONTROL — full clone, fresh delta (1h old), cadence 24h → HEALTHY(0)\n'

REMOTE2="$SBX/genesis-remote2.git"
WORK2="$SBX/genesis-work2"
WITWC2="$SBX/witness-wc2"
git init --quiet --bare "$REMOTE2"
git init --quiet "$WORK2"; mkdir -p "$WORK2/.harness"
printf '%s\n%s\n%s\n' "$HEADER" "$A" "$B" > "$WORK2/$LEDGER"
git -C "$WORK2" add -A
GIT_AUTHOR_DATE="@$ONE_HOUR_AGO" GIT_COMMITTER_DATE="@$ONE_HOUR_AGO" \
  git -C "$WORK2" commit --quiet -m "ledger delta 1h ago"
printf 'code tip\n' > "$WORK2/src.txt"
git -C "$WORK2" add -A
GIT_AUTHOR_DATE="@$NOW" GIT_COMMITTER_DATE="@$NOW" \
  git -C "$WORK2" commit --quiet -m "code tip now"
git -C "$WORK2" branch -M main
git -C "$WORK2" push --quiet "$REMOTE2" "main:refs/heads/main"
git -C "$REMOTE2" symbolic-ref HEAD refs/heads/main

git init --quiet "$WITWC2"; mkdir -p "$WITWC2/.harness"
printf '%s\n%s\n' "$HEADER" "$A" > "$WITWC2/$LEDGER"
git -C "$WITWC2" add -A
git -C "$WITWC2" commit --quiet -m "witness snapshot"
git -C "$WITWC2" push --quiet "$REMOTE2" "HEAD:refs/heads/integrity-witness"

FULL2="$SBX/full-checkout2"
git clone --quiet --branch main "file://$REMOTE2" "$FULL2"
OUT2="$(WL_REPO_ROOT="$FULL2" WL_LEDGER_REL="$LEDGER" WL_WITNESS_REF=integrity-witness \
        WL_WITNESS_REMOTE="$REMOTE2" WL_WITNESS_MAX_LAG_SECONDS=86400 \
        WL_TASK_ID=Tb-fulldepth-s2 bash "$AUDIT" 2>&1)"
EC2=$?
printf '%s\n' "$OUT2" | grep -E 'RESULT status=|delta_age_seconds=|reason=' | sed 's/^/    /'
printf '    exit=%s\n' "$EC2"
AGE2="$(printf '%s' "$OUT2" | grep -o 'delta_age_seconds=[0-9]*' | head -1 | cut -d= -f2 || true)"
printf '  delta_age_seconds observed: %s\n' "${AGE2:-<not emitted (healthy path)>}"
if [ "$EC2" -eq 0 ]; then
  ok "scenario2 (control): HEALTHY(0) — fresh delta within cadence, no false alarm"
else
  bad "scenario2 (control): exit=$EC2 — fresh delta incorrectly flagged STALE (false alarm introduced)"
fi
hr

# ===========================================================================
# SCENARIO 3 — CONTROL: no delta (witness current) — HEALTHY exit 0
# ===========================================================================
printf '[scenario 3] CONTROL — full clone, witness current (no pending delta) → HEALTHY(0)\n'

REMOTE3="$SBX/genesis-remote3.git"
WORK3="$SBX/genesis-work3"
WITWC3="$SBX/witness-wc3"
git init --quiet --bare "$REMOTE3"
git init --quiet "$WORK3"; mkdir -p "$WORK3/.harness"
printf '%s\n%s\n' "$HEADER" "$A" > "$WORK3/$LEDGER"
git -C "$WORK3" add -A
GIT_AUTHOR_DATE="@$TWO_DAYS_AGO" GIT_COMMITTER_DATE="@$TWO_DAYS_AGO" \
  git -C "$WORK3" commit --quiet -m "genesis ledger 2d ago"
git -C "$WORK3" branch -M main
git -C "$WORK3" push --quiet "$REMOTE3" "main:refs/heads/main"
git -C "$REMOTE3" symbolic-ref HEAD refs/heads/main

# Witness matches genesis exactly — no pending delta.
git init --quiet "$WITWC3"; mkdir -p "$WITWC3/.harness"
printf '%s\n%s\n' "$HEADER" "$A" > "$WITWC3/$LEDGER"
git -C "$WITWC3" add -A
git -C "$WITWC3" commit --quiet -m "witness snapshot = genesis (current)"
git -C "$WITWC3" push --quiet "$REMOTE3" "HEAD:refs/heads/integrity-witness"

FULL3="$SBX/full-checkout3"
git clone --quiet --branch main "file://$REMOTE3" "$FULL3"
OUT3="$(WL_REPO_ROOT="$FULL3" WL_LEDGER_REL="$LEDGER" WL_WITNESS_REF=integrity-witness \
        WL_WITNESS_REMOTE="$REMOTE3" WL_WITNESS_MAX_LAG_SECONDS=86400 \
        WL_TASK_ID=Tb-fulldepth-s3 bash "$AUDIT" 2>&1)"
EC3=$?
printf '%s\n' "$OUT3" | grep -E 'RESULT status=|delta_age_seconds=|reason=' | sed 's/^/    /'
printf '    exit=%s\n' "$EC3"
if [ "$EC3" -eq 0 ]; then
  ok "scenario3 (control): HEALTHY(0) — no pending delta, witness current, no false alarm"
else
  bad "scenario3 (control): exit=$EC3 — current witness incorrectly flagged STALE (false alarm)"
fi
hr

# ===========================================================================
# SUMMARY AND VERDICT
# ===========================================================================
printf 'RESULT  pass=%d fail=%d warn=%d\n' "$PASS" "$FAIL" "$WARN"
hr

if [ "$FAIL" -eq 0 ] && [ "$WARN" -eq 0 ]; then
  printf 'T-b RE-REFUTE VERDICT: BUG CLOSED\n'
  printf '  Under fetch-depth:0 (full history), a 2-day-old unpublished ledger\n'
  printf '  delta is now correctly reported STALE (exit 1) with delta_age_seconds≈172800.\n'
  printf '  Controls: fresh-delta HEALTHY (no false alarm); witness-current HEALTHY.\n'
  printf '  The R4 shallow discriminator proved the bug in the old deployed config;\n'
  printf '  this test proves the fix in the new config (fetch-depth:0 in YAML).\n'
  printf '\n'
  printf '  RESIDUALS (named, non-blocking, unchanged from R4):\n'
  printf '  - publisher + monitor share one YAML file; disabling both is one edit.\n'
  printf '    Backstop: required-status-check at the seam (Peat wires per WITNESS-REF-DESIGN §4).\n'
  printf '  - Content-delta gating: a dark publisher with NO pending ledger change\n'
  printf '    is correctly HEALTHY (quiet ledger = no signal to stale). By design.\n'
  printf '  - git log returns the LATEST ledger-touch date; if multiple unpublished\n'
  printf '    commits touch the ledger, the script measures from the newest touch,\n'
  printf '    not the oldest. Minor undercount; out-of-scope for this fix.\n'
  printf '\n'
  printf '  wireable_now: ready (inert pending Peat seam per WITNESS-REF-DESIGN §4)\n'
  exit 0
else
  printf 'T-b RE-REFUTE VERDICT: INCONCLUSIVE OR STILL OPEN\n'
  if [ "$FAIL" -gt 0 ]; then
    printf '  FAIL paths detected — T-b may still be open or fix fires for wrong reason.\n'
  fi
  if [ "$WARN" -gt 0 ]; then
    printf '  WARN: exit=1 without delta_age_seconds — fail-closed path, not right-reason evidence.\n'
  fi
  exit 1
fi
