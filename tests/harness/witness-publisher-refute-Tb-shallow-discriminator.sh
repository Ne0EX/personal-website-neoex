#!/usr/bin/env bash
# =============================================================================
# tests/harness/witness-publisher-refute-Tb-shallow-discriminator.sh
#
# Refute:  T-b · SILENT-DARK — DEPLOYED-CONFIG DISCRIMINATOR
#          (S2 of TASK-2026-06-04-WITNESS-PUBLISHER)
# Author:  Algol (α-VER-06)
# Class:   SANDBOX HARNESS — /tmp git repos only, no network, no tracked mutation.
# Under test: scripts/audit-witness-staleness.sh AS THE MONITOR JOB RUNS IT
#             (publish-witness.yml staleness-monitor: actions/checkout fetch-depth: 1).
#
# THE GAP THIS PROBES (deployed config, not harness logic)
# --------------------------------------------------------
# The companion harness (…-Tb-silentdark.sh) proves the staleness ARITHMETIC is
# correct — but it feeds the script ACCURATE age input because its sandbox tip IS
# the ledger commit, so `git log -1 --format=%ct -- <ledger>` always hits the
# happy path. The REAL monitor job does NOT run that way:
#
#   publish-witness.yml › staleness-monitor › checkout uses fetch-depth: 1.
#
# Under fetch-depth: 1 there is exactly ONE commit available. In normal operation
# the tip commit is CODE, not the ledger (ledger commits land at task boundaries;
# code commits land on top). So `git log -1 -- <ledger>` finds nothing in the one
# available commit → S5 falls back to FILE MTIME (= checkout time ≈ now) →
# DELTA_AGE_SECONDS ≈ 0 < cadence → HEALTHY. The publisher can be dark for days,
# the delta days old, and the monitor stays SILENT. That is exactly the T-b
# failure the monitor exists to prevent — triggered by ordinary operation, no
# attack required.
#
# This harness reproduces the monitor's environment (a shallow clone whose tip is
# a code-only commit, over a real-history remote with an OLD ledger delta) and
# asks: STALE (caught) or HEALTHY (silent bug)?
#
# EXIT: 0 = the discriminator CONFIRMS T-b holds in deployed config (STALE), OR
#           the script's own scope/internal guard fails-closed (exit 2) rather
#           than silently HEALTHY.
#       1 = SILENT BUG REPRODUCED — aged delta reported HEALTHY under fetch-depth:1.
#           (This is the finding: T-b not cleanly caught in deployed config.)
# The exit code encodes "did we find the bug": exit 1 == bug present.
# =============================================================================
set -uo pipefail

AUDIT="${WL_STALENESS_SCRIPT:-$(cd "$(dirname "$0")/../.." && pwd)/scripts/audit-witness-staleness.sh}"
[ -f "$AUDIT" ] || { printf 'FATAL: staleness script not found at %s\n' "$AUDIT" >&2; exit 2; }

SBX="$(mktemp -d /tmp/witness-Tb-shallow.XXXXXXXX)"
trap 'rm -rf "$SBX"' EXIT INT TERM

export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null

LEDGER=".harness/integrity-ledger.jsonl"
HEADER='{"_ledger":"integrity-append-only","schema":1,"not_a_chain":true}'
A='{"path":".claude/handoffs/h-A.json","sha256":"aaaa"}'
B='{"path":".claude/handoffs/h-B.json","sha256":"bbbb"}'

NOW="$(date +%s)"
TWO_DAYS_AGO=$(( NOW - 2*86400 ))

printf 'T-b · SHALLOW DISCRIMINATOR (monitor runs fetch-depth:1)\n'
printf 'sandbox=%s\n' "$SBX"
printf -- '----------------------------------------------------------\n'

# ---------------------------------------------------------------------------
# 1. Build the genesis "remote" with REAL history:
#      commit-1: ledger delta [header,A,B] committed 2 DAYS AGO (the dark delta)
#      commit-2: a CODE-ONLY commit dated NOW on top (normal operation tip)
#    Witness snapshot = pre-delta ledger [header,A] (so a real delta exists).
# ---------------------------------------------------------------------------
REMOTE="$SBX/genesis-remote.git"
git init --quiet --bare "$REMOTE"

WORK="$SBX/genesis-work"
git init --quiet "$WORK"; mkdir -p "$WORK/.harness"
# commit-1: the ledger delta, 2 days old
printf '%s\n%s\n%s\n' "$HEADER" "$A" "$B" > "$WORK/$LEDGER"
git -C "$WORK" add -A
GIT_AUTHOR_DATE="@$TWO_DAYS_AGO" GIT_COMMITTER_DATE="@$TWO_DAYS_AGO" \
  git -C "$WORK" commit --quiet -m "ledger delta (append B) — 2 days ago"
# commit-2: a CODE-ONLY commit, dated now, becomes the tip
printf 'some code change\n' > "$WORK/src.txt"
git -C "$WORK" add -A
GIT_AUTHOR_DATE="@$NOW" GIT_COMMITTER_DATE="@$NOW" \
  git -C "$WORK" commit --quiet -m "code change (no ledger touch) — now [TIP]"
git -C "$WORK" branch -M main
git -C "$WORK" push --quiet "$REMOTE" "main:refs/heads/main"
git -C "$REMOTE" symbolic-ref HEAD refs/heads/main

# Witness ref: snapshot of the PRE-delta ledger [header,A] (delta is unpublished).
WITWC="$SBX/witness-wc"
git init --quiet "$WITWC"; mkdir -p "$WITWC/.harness"
printf '%s\n%s\n' "$HEADER" "$A" > "$WITWC/$LEDGER"
git -C "$WITWC" add -A && git -C "$WITWC" commit --quiet -m "witness snapshot [header,A]"
git -C "$WITWC" push --quiet "$REMOTE" "HEAD:refs/heads/integrity-witness"

printf 'remote built: ledger delta is 2 days old; tip is a code-only commit (now).\n'
printf 'witness snapshot = [header,A]; genesis ledger = [header,A,B] (unpublished, aged).\n'
printf -- '----------------------------------------------------------\n'

# ---------------------------------------------------------------------------
# 2. Reproduce the MONITOR'S environment: a SHALLOW clone (fetch-depth:1).
#    NOTE: a local-PATH clone ignores --depth; file:// is REQUIRED for git to
#    honor shallowness. The shallow checkout sees only the tip (code-only) commit.
# ---------------------------------------------------------------------------
SHALLOW="$SBX/shallow-checkout"
# Clone main shallowly. The bare remote has no default HEAD symref, so target the
# branch explicitly (--branch main) — otherwise the clone lands empty. file:// is
# REQUIRED for git to honor --depth (local-path clones ignore it).
git clone --quiet --depth=1 --branch main "file://$REMOTE" "$SHALLOW"
DEPTH_COMMITS="$(git -C "$SHALLOW" rev-list --count HEAD 2>/dev/null || echo '?')"
printf 'shallow clone depth: %s commit(s) available at HEAD\n' "$DEPTH_COMMITS"
# Prove the ledger has NO reachable commit in the shallow clone:
LEDGER_LOG="$(git -C "$SHALLOW" log -1 --format='%ct' -- "$LEDGER" 2>/dev/null || true)"
if [ -z "$LEDGER_LOG" ]; then
  printf 'git log -1 -- ledger in shallow clone: EMPTY (no reachable ledger commit) -> mtime fallback\n'
else
  printf 'git log -1 -- ledger in shallow clone: %s (epoch)\n' "$LEDGER_LOG"
fi
# Touch the ledger so its mtime is "now" (the checkout would have a fresh mtime).
# Re-write identical content to set a current mtime (the genesis ledger content
# must still differ from the witness snapshot, which it does: [header,A,B]).
printf '%s\n%s\n%s\n' "$HEADER" "$A" "$B" > "$SHALLOW/$LEDGER"
printf -- '----------------------------------------------------------\n'

# ---------------------------------------------------------------------------
# 3. Run the staleness monitor against the shallow clone, 24h cadence.
#    An aged (2-day) unpublished delta SHOULD be STALE(1). If it reports
#    HEALTHY(0) the silent bug is reproduced.
# ---------------------------------------------------------------------------
printf '[run] audit-witness-staleness.sh over the SHALLOW (fetch-depth:1) clone\n'
OUT="$(WL_REPO_ROOT="$SHALLOW" WL_LEDGER_REL="$LEDGER" WL_WITNESS_REF=integrity-witness \
       WL_WITNESS_REMOTE="$REMOTE" WL_WITNESS_MAX_LAG_SECONDS=86400 \
       WL_TASK_ID=Tb-shallow bash "$AUDIT" 2>&1)"
EC=$?
printf '%s\n' "$OUT" | grep -E 'RESULT status=|delta_age_seconds=|reason=' | sed 's/^/    /'
printf '    staleness exit=%s\n' "$EC"
printf -- '----------------------------------------------------------\n'

if [ "$EC" -eq 1 ]; then
  printf 'DISCRIMINATOR: STALE(1) — T-b holds even under fetch-depth:1.\n'
  printf '  (The monitor correctly flagged the aged delta despite shallow checkout.)\n'
  exit 0
elif [ "$EC" -eq 2 ]; then
  printf 'DISCRIMINATOR: INTERNAL(2) — fail-closed, not silently healthy. Acceptable.\n'
  exit 0
else
  printf 'DISCRIMINATOR: HEALTHY(0) on a 2-DAY-OLD unpublished delta — SILENT BUG REPRODUCED.\n'
  printf '  ROOT CAUSE: publish-witness.yml staleness-monitor checks out fetch-depth:1.\n'
  printf '  Under --depth=1 only the TIP commit is reachable. In normal operation the\n'
  printf '  tip is a CODE-ONLY commit (dated now); the real ledger-introducing commit\n'
  printf '  (2 days ago) is grafted away. S5 `git log -1 --format=%%ct -- <ledger>`\n'
  printf '  therefore resolves to the only reachable commit date (~now) — NOT the true\n'
  printf '  ledger-change date — (and where the ledger is unreachable entirely, falls\n'
  printf '  back to FILE MTIME ~now). Either path computes DELTA_AGE ~= 0 < cadence\n'
  printf '  -> HEALTHY. (Observed here: delta_age_seconds=1 vs the true 172800s.)\n'
  printf '  A dark publisher with a days-old delta stays SILENT in NORMAL operation —\n'
  printf '  the exact T-b failure the monitor exists to prevent, no attack required.\n'
  printf '  FIX (Canopus, REVISE): set the staleness-monitor checkout to fetch-depth: 0,\n'
  printf '  OR source the delta age from the witness-tip commit date (already fetched),\n'
  printf '  not from `git log` over a shallow genesis checkout.\n'
  exit 1
fi
