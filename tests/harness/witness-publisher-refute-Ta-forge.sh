#!/usr/bin/env bash
# =============================================================================
# tests/harness/witness-publisher-refute-Ta-forge.sh
#
# Refute:  T-a · FORGE-VIA-PUBLISHER  (S2 of TASK-2026-06-04-WITNESS-PUBLISHER)
# Author:  Algol (α-VER-06)  ·  adversarial refute of the witness publisher
# Class:   SANDBOX HARNESS — /tmp git repos only, no network, no tracked mutation.
#
# THE CRUX (read before "fixing" this test)
# -----------------------------------------
# The T-a threat is "an agent EDITS THE PUBLISHER to advance the witness ref
# from a REWRITTEN ledger (a prior line changed)." The defense that must hold is
# therefore the ONE the agent cannot edit: server-side no-force-push on the
# witness ref (branch-protection-no-bypass, a Peat-seam toggle). The publisher's
# own append-only audit (publish-witness-ledger.sh S4) is NOT that defense — a
# malicious agent simply deletes the audit call. Testing "rewrite a line, run
# the publisher, it exits 1" only tests the AUDIT (= Canopus self-check SCENARIO
# 3) and mislabels it as the branch-protection guarantee. That is a FALSE GREEN.
#
# Two attack shapes, kept distinct:
#   - build-on-tip (ff): snapshot the rewritten ledger as a CHILD of the witness
#     tip and ff-push. Valid fast-forward → protection ALLOWS it → the post-push
#     audit catches it. Ref ADVANCES, tamper flagged. (Canopus's lane.)
#   - rewrite-spine (non-ff): rewrite a line ALREADY ON THE SPINE and force-push
#     divergent history to hide tracks. The audit never runs (agent stripped it);
#     the ONLY backstop is no-force-push. THIS IS T-a. Its acceptance ("witness
#     ref does not advance to rewritten history") only matches THIS shape.
#
# SIMULATION OF THE SEAM
# ----------------------
# branch-protection-no-bypass is modeled by a bare remote configured with:
#     receive.denyNonFastForwards = true
#     receive.denyDeletes         = true
# This is exactly what GitHub's "block force pushes" + "block deletions" enforce
# server-side, applied to the witness ref. It does NOT exist in the inert repo
# today; Peat sets it at go-live §4 step 3. This sandbox models the wired seam.
#
# POSITIVE CONTROL
# ----------------
# A legitimate ff push to the SAME protected remote MUST succeed — otherwise a
# "push failed" could be a broken sandbox, not the protection firing. The PASS is
# the CONTRAST: ff allowed, non-ff (rewrite-spine) rejected, ref unchanged.
#
# EXIT: 0 = T-a CAUGHT (rewrite-spine rejected, ref pinned, ff control passes).
#       1 = NOT CAUGHT (the refute FAILED — protection did not hold).
# =============================================================================
set -uo pipefail

SBX="$(mktemp -d /tmp/witness-Ta.XXXXXXXX)"
cleanup() { rm -rf "$SBX"; }
trap cleanup EXIT INT TERM

PASS=0; FAIL=0
ok()   { printf '  PASS  %s\n' "$*"; PASS=$((PASS+1)); }
bad()  { printf '  FAIL  %s\n' "$*"; FAIL=$((FAIL+1)); }
hr()   { printf -- '----------------------------------------------------------\n'; }

export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null

LEDGER=".harness/integrity-ledger.jsonl"

printf 'T-a · FORGE-VIA-PUBLISHER (rewrite-spine non-ff must be rejected)\n'
printf 'sandbox=%s\n' "$SBX"
hr

# ---------------------------------------------------------------------------
# 1. Build the PROTECTED witness remote (bare) modeling branch-protection.
# ---------------------------------------------------------------------------
REMOTE="$SBX/witness-remote.git"
git init --quiet --bare "$REMOTE"
git -C "$REMOTE" config receive.denyNonFastForwards true
git -C "$REMOTE" config receive.denyDeletes true
printf 'remote protections:\n'
printf '  receive.denyNonFastForwards=%s\n' "$(git -C "$REMOTE" config receive.denyNonFastForwards)"
printf '  receive.denyDeletes=%s\n'         "$(git -C "$REMOTE" config receive.denyDeletes)"
hr

# ---------------------------------------------------------------------------
# 2. Seed the witness spine: seed-commit -> snap-1. Publish snap-1 to remote.
#    This is the honest, append-only history the witness ref points at.
# ---------------------------------------------------------------------------
WC="$SBX/witness-wc"
git init --quiet "$WC"
mkdir -p "$WC/.harness"
# seed: header line only
printf '%s\n' '{"_ledger":"integrity-append-only","schema":1,"not_a_chain":true}' > "$WC/$LEDGER"
git -C "$WC" add -A && git -C "$WC" commit --quiet -m "witness: seed"
SEED_SHA="$(git -C "$WC" rev-parse HEAD)"
# snap-1: append entry A (an honest, published ledger line)
printf '%s\n' '{"path":".claude/handoffs/h-A.json","sha256":"aaaa"}' >> "$WC/$LEDGER"
git -C "$WC" add -A && git -C "$WC" commit --quiet -m "witness: snap-1 (append A)"
SNAP1_SHA="$(git -C "$WC" rev-parse HEAD)"

# Publish the honest spine to the protected witness ref.
git -C "$WC" push --quiet "$REMOTE" "HEAD:refs/heads/integrity-witness"
REF_BEFORE="$(git -C "$REMOTE" rev-parse refs/heads/integrity-witness)"
printf 'witness ref published (honest spine):\n'
printf '  seed   = %s\n' "$SEED_SHA"
printf '  snap-1 = %s  <- ref points here\n' "$SNAP1_SHA"
printf '  ref    = %s\n' "$REF_BEFORE"
[ "$REF_BEFORE" = "$SNAP1_SHA" ] && ok "honest spine published, ref at snap-1" \
                                 || bad "ref did not land at snap-1"
hr

# ---------------------------------------------------------------------------
# 3. POSITIVE CONTROL — a legitimate ff push (snap-2, pure append) SUCCEEDS.
#    Proves the protected remote accepts honest fast-forwards (the sandbox is
#    not just rejecting everything).
# ---------------------------------------------------------------------------
printf '[control] legitimate ff push (append entry B as snap-2)\n'
CTL="$SBX/control-wc"
git clone --quiet "$REMOTE" "$CTL"
# track the witness ref locally
git -C "$CTL" fetch --quiet "$REMOTE" "refs/heads/integrity-witness:refs/heads/integrity-witness"
git -C "$CTL" checkout --quiet integrity-witness
printf '%s\n' '{"path":".claude/handoffs/h-B.json","sha256":"bbbb"}' >> "$CTL/$LEDGER"
git -C "$CTL" add -A && git -C "$CTL" commit --quiet -m "witness: snap-2 (append B)"
SNAP2_SHA="$(git -C "$CTL" rev-parse HEAD)"
if git -C "$CTL" push --quiet "$REMOTE" "integrity-witness:refs/heads/integrity-witness" 2>"$SBX/ctl.err"; then
  REF_CTL="$(git -C "$REMOTE" rev-parse refs/heads/integrity-witness)"
  [ "$REF_CTL" = "$SNAP2_SHA" ] && ok "control ff push ACCEPTED; ref advanced snap-1 -> snap-2" \
                                || bad "control ff pushed but ref did not advance"
else
  bad "control ff push REJECTED (sandbox broken — protection too strict)"
  cat "$SBX/ctl.err"
fi
REF_AFTER_CTL="$(git -C "$REMOTE" rev-parse refs/heads/integrity-witness)"
hr

# ---------------------------------------------------------------------------
# 4. THE ATTACK — rewrite-spine. An agent who has EDITED THE PUBLISHER (stripped
#    its audit) rewrites a line ALREADY ON THE SPINE (entry A in snap-1) and
#    attempts to publish the divergent history, bypassing the publisher entirely.
#
#    We reconstruct divergent history: re-root on seed, but commit a MUTATED
#    snap-1' where entry A's sha256 was forged (aaaa -> dead). Then snap-2' on
#    top. This is a NON-FAST-FORWARD relative to the current ref (snap-2), AND
#    relative to the original snap-1 — it rewrites published history.
# ---------------------------------------------------------------------------
printf '[attack] rewrite-spine: forge entry A (aaaa -> dead) and force divergent history\n'
ATK="$SBX/attack-wc"
git clone --quiet "$REMOTE" "$ATK"
git -C "$ATK" fetch --quiet "$REMOTE" "refs/heads/integrity-witness:refs/heads/integrity-witness"
git -C "$ATK" checkout --quiet integrity-witness
# Rebuild from seed with a TAMPERED entry A.
git -C "$ATK" reset --quiet --hard "$SEED_SHA"
# forged snap-1': entry A's hash rewritten
printf '%s\n' '{"_ledger":"integrity-append-only","schema":1,"not_a_chain":true}'  > "$ATK/$LEDGER"
printf '%s\n' '{"path":".claude/handoffs/h-A.json","sha256":"dead"}'              >> "$ATK/$LEDGER"
git -C "$ATK" add -A && git -C "$ATK" commit --quiet -m "FORGED snap-1 (A: aaaa->dead)"
FORGED_SHA="$(git -C "$ATK" rev-parse HEAD)"
printf '  forged history tip = %s (parent=seed, divergent from published spine)\n' "$FORGED_SHA"

# The attacker tries a plain push (non-ff, rejected) AND an explicit --force
# (the move that would hide the rewrite). BOTH must be refused by the remote.
ATTACK_BLOCKED=1

printf '  attempt 1: plain non-ff push of forged history\n'
if git -C "$ATK" push --quiet "$REMOTE" "HEAD:refs/heads/integrity-witness" 2>"$SBX/atk1.err"; then
  bad "non-ff push ACCEPTED — protection did NOT hold (T-a NOT caught)"
  ATTACK_BLOCKED=0
else
  if grep -qiE 'non-fast-forward|denyNonFastForwards|fetch first|rejected' "$SBX/atk1.err"; then
    ok "non-ff push REJECTED ($(grep -oiE 'non-fast-forward|denyNonFastForwards|rejected' "$SBX/atk1.err" | head -1))"
  else
    ok "non-ff push REJECTED (non-zero exit)"
  fi
fi

printf '  attempt 2: --force push of forged history (the cover-tracks move)\n'
if git -C "$ATK" push --force --quiet "$REMOTE" "HEAD:refs/heads/integrity-witness" 2>"$SBX/atk2.err"; then
  bad "--force push ACCEPTED — no-force-push did NOT hold (T-a NOT caught)"
  ATTACK_BLOCKED=0
else
  if grep -qiE 'denyNonFastForwards|non-fast-forward|denied|rejected|force' "$SBX/atk2.err"; then
    ok "--force push REJECTED by branch protection"
  else
    ok "--force push REJECTED (non-zero exit)"
  fi
fi

# Decisive acceptance: the ref must NOT have advanced to forged history.
REF_FINAL="$(git -C "$REMOTE" rev-parse refs/heads/integrity-witness)"
printf '  ref before attack = %s (snap-2, honest)\n' "$REF_AFTER_CTL"
printf '  ref after  attack = %s\n' "$REF_FINAL"
if [ "$REF_FINAL" = "$REF_AFTER_CTL" ] && [ "$REF_FINAL" != "$FORGED_SHA" ]; then
  ok "witness ref did NOT advance to rewritten history (pinned to honest snap-2)"
else
  bad "witness ref MOVED to forged history — T-a NOT caught"
  ATTACK_BLOCKED=0
fi
hr

# ---------------------------------------------------------------------------
# Verdict
# ---------------------------------------------------------------------------
printf 'RESULT  pass=%d fail=%d\n' "$PASS" "$FAIL"
if [ "$FAIL" -eq 0 ] && [ "$ATTACK_BLOCKED" -eq 1 ]; then
  printf 'T-a VERDICT: CAUGHT — rewrite-spine non-ff/force rejected by no-force-push;\n'
  printf '  ff control accepted; witness ref pinned to honest history.\n'
  printf '  (Holds ONLY given the seam wired per WITNESS-REF-DESIGN.md §4 step 3.\n'
  printf '   In the inert tree today there is no such protection.)\n'
  exit 0
else
  printf 'T-a VERDICT: NOT CAUGHT — refute FAILED.\n'
  exit 1
fi
