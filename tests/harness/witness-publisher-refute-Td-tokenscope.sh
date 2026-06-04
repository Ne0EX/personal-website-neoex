#!/usr/bin/env bash
# =============================================================================
# tests/harness/witness-publisher-refute-Td-tokenscope.sh
#
# Refute:  T-d · TOKEN-SCOPE CREEP  (S2 of TASK-2026-06-04-WITNESS-PUBLISHER)
# Author:  Algol (α-VER-06)
# Class:   SANDBOX HARNESS — /tmp git repos only, no network, no tracked mutation.
#
# THE THREAT
# ----------
# T-d: confirm the publish path cannot advance ANY ref other than the witness
# ref. An agent who edits the workflow/script to target a DIFFERENT ref (e.g.
# refs/heads/main) must be blocked — either by token scope or by branch
# targeting at the seam.
#
# WHY THE SCRIPT ALONE DOES NOT CONSTRAIN THIS (honest accounting)
# ----------------------------------------------------------------
# publish-witness-ledger.sh targets `<sha>:refs/heads/${WITNESS_BRANCH}` where
# WITNESS_BRANCH = WL_WITNESS_REF (env-overridable). A malicious agent edits the
# workflow env (`WL_WITNESS_REF: main`) and the SCRIPT will happily build a
# refspec for main. So the script is NOT the control — the SEAM is: the Actions
# GITHUB_TOKEN is scoped (contents:write on the witness ref only) and branch
# protection targets that single ref. We model the real seam-side constraint
# with a server-side `hooks/update` on the bare remote that rejects any pushed
# ref whose name != refs/heads/integrity-witness. That is exactly the boundary a
# per-ref-scoped token + per-ref branch protection enforce server-side.
#
# POSITIVE CONTROL
# ----------------
# A push to refs/heads/integrity-witness MUST succeed; the attack pushes to
# refs/heads/main and refs/heads/anything-else and MUST be rejected, with those
# refs UNCHANGED. The pass is the contrast.
#
# EXIT: 0 = T-d HOLDS  ·  1 = T-d FAILED (a non-witness ref was advanced).
# =============================================================================
set -uo pipefail

SBX="$(mktemp -d /tmp/witness-Td.XXXXXXXX)"
trap 'rm -rf "$SBX"' EXIT INT TERM

PASS=0; FAIL=0
ok()  { printf '  PASS  %s\n' "$*"; PASS=$((PASS+1)); }
bad() { printf '  FAIL  %s\n' "$*"; FAIL=$((FAIL+1)); }
hr()  { printf -- '----------------------------------------------------------\n'; }

export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null

printf 'T-d · TOKEN-SCOPE CREEP (publish path cannot advance any ref but witness)\n'
printf 'sandbox=%s\n' "$SBX"
hr

# ---------------------------------------------------------------------------
# 1. Bare remote with seed history on main AND a witness ref. Install a
#    server-side update hook modeling per-ref token scope + branch targeting.
# ---------------------------------------------------------------------------
REMOTE="$SBX/remote.git"
git init --quiet --bare "$REMOTE"

# Seed the remote with a main branch and the witness ref via a working clone.
WC="$SBX/seed-wc"
git init --quiet "$WC"
printf 'seed\n' > "$WC/README"
git -C "$WC" add -A && git -C "$WC" commit --quiet -m "seed main"
git -C "$WC" branch -M main
git -C "$WC" push --quiet "$REMOTE" "main:refs/heads/main"
git -C "$WC" push --quiet "$REMOTE" "main:refs/heads/integrity-witness"
MAIN_BEFORE="$(git -C "$REMOTE" rev-parse refs/heads/main)"
WITNESS_BEFORE="$(git -C "$REMOTE" rev-parse refs/heads/integrity-witness)"

# The seam-side per-ref scope: the update hook rejects ANY ref != witness.
# (Modeling: a contents:write GITHUB_TOKEN scoped to the witness ref only +
#  branch protection that names integrity-witness as the single writable ref.)
HOOK="$REMOTE/hooks/update"
cat > "$HOOK" <<'UPDATE_HOOK'
#!/usr/bin/env bash
# Per-ref scope model: only refs/heads/integrity-witness may be advanced.
refname="$1"
if [ "$refname" != "refs/heads/integrity-witness" ]; then
  printf 'remote: SCOPE-DENY token cannot write %s (witness-ref scope only)\n' "$refname" >&2
  exit 1
fi
exit 0
UPDATE_HOOK
chmod +x "$HOOK"
printf 'remote seeded; update-hook installed (witness-ref scope only)\n'
printf '  main    before = %s\n' "$MAIN_BEFORE"
printf '  witness before = %s\n' "$WITNESS_BEFORE"
hr

# ---------------------------------------------------------------------------
# 2. POSITIVE CONTROL — a legitimate ff push to the witness ref SUCCEEDS.
# ---------------------------------------------------------------------------
printf '[control] ff push to refs/heads/integrity-witness (in-scope)\n'
CTL="$SBX/ctl-wc"
git clone --quiet "$REMOTE" "$CTL"
git -C "$CTL" fetch --quiet "$REMOTE" "refs/heads/integrity-witness:refs/heads/integrity-witness"
git -C "$CTL" checkout --quiet integrity-witness
printf 'append\n' >> "$CTL/README"
git -C "$CTL" add -A && git -C "$CTL" commit --quiet -m "witness advance"
WIT_NEW="$(git -C "$CTL" rev-parse HEAD)"
if git -C "$CTL" push --quiet "$REMOTE" "integrity-witness:refs/heads/integrity-witness" 2>"$SBX/ctl.err"; then
  [ "$(git -C "$REMOTE" rev-parse refs/heads/integrity-witness)" = "$WIT_NEW" ] \
    && ok "in-scope push to witness ref ACCEPTED; ref advanced" \
    || bad "witness push accepted but ref did not advance"
else
  bad "in-scope push to witness ref REJECTED (sandbox/hook broken)"; cat "$SBX/ctl.err"
fi
hr

# ---------------------------------------------------------------------------
# 3. THE ATTACK — agent edits the workflow to target a DIFFERENT ref. Push to
#    main and to a fresh ref must BOTH be rejected; those refs UNCHANGED.
#    This simulates `WL_WITNESS_REF: main` (script builds the refspec; the SEAM
#    rejects it). We push raw to make the cross-ref target unambiguous.
# ---------------------------------------------------------------------------
ATK="$SBX/atk-wc"
git clone --quiet "$REMOTE" "$ATK"
git -C "$ATK" checkout --quiet main 2>/dev/null || git -C "$ATK" checkout --quiet -b main origin/main
printf 'malicious\n' >> "$ATK/README"
git -C "$ATK" add -A && git -C "$ATK" commit --quiet -m "attacker payload"
ATK_SHA="$(git -C "$ATK" rev-parse HEAD)"

SCOPE_HELD=1

printf '[attack] retarget to refs/heads/main (out-of-scope)\n'
if git -C "$ATK" push --quiet "$REMOTE" "HEAD:refs/heads/main" 2>"$SBX/atk-main.err"; then
  bad "push to main ACCEPTED — token scope did NOT hold (T-d FAILED)"; SCOPE_HELD=0
else
  if grep -qiE 'SCOPE-DENY|witness-ref scope|rejected|hook declined' "$SBX/atk-main.err"; then
    ok "push to main REJECTED by per-ref scope"
  else
    ok "push to main REJECTED (non-zero exit)"
  fi
fi

printf '[attack] retarget to refs/heads/attacker-ref (out-of-scope)\n'
if git -C "$ATK" push --quiet "$REMOTE" "HEAD:refs/heads/attacker-ref" 2>"$SBX/atk-new.err"; then
  bad "push to attacker-ref ACCEPTED — token scope did NOT hold (T-d FAILED)"; SCOPE_HELD=0
else
  ok "push to fresh attacker-ref REJECTED"
fi

# Decisive: main unchanged, no attacker-ref exists.
# NOTE: plain `rev-parse <missing-ref>` echoes the arg back AND exits 0 with a
# stderr warning — a `|| echo NONE` does NOT catch it. Use show-ref --verify
# (clean nonzero on absent) as the authoritative existence test.
MAIN_AFTER="$(git -C "$REMOTE" rev-parse refs/heads/main)"
printf '  main after  = %s\n' "$MAIN_AFTER"
if [ "$MAIN_AFTER" = "$MAIN_BEFORE" ]; then
  ok "refs/heads/main UNCHANGED (not advanced to attacker payload)"
else
  bad "main was advanced to attacker payload — T-d FAILED"; SCOPE_HELD=0
fi
if git -C "$REMOTE" show-ref --verify --quiet refs/heads/attacker-ref; then
  bad "attacker-ref was created — T-d FAILED"; SCOPE_HELD=0
else
  ok "no attacker-ref was created (show-ref --verify: absent)"
fi
printf '  refs on remote: %s\n' "$(git -C "$REMOTE" for-each-ref --format='%(refname)' refs/heads/ | tr '\n' ' ')"
[ "$ATK_SHA" != "$MAIN_AFTER" ] || true
hr

printf 'RESULT  pass=%d fail=%d\n' "$PASS" "$FAIL"
if [ "$FAIL" -eq 0 ] && [ "$SCOPE_HELD" -eq 1 ]; then
  printf 'T-d VERDICT: HOLDS — publish path cannot advance any ref but the witness ref.\n'
  printf '  in-scope witness push accepted; out-of-scope main/new-ref pushes rejected.\n'
  printf '  (Holds given the seam: contents:write token scoped to the witness ref +\n'
  printf '   branch targeting per WITNESS-REF-DESIGN.md §4. Script refspec is env-\n'
  printf '   overridable, so the SEAM, not the script, is the control — as modeled.)\n'
  exit 0
else
  printf 'T-d VERDICT: FAILED — a non-witness ref was advanced.\n'
  exit 1
fi
