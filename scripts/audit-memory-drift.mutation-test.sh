#!/usr/bin/env bash
# =============================================================================
# scripts/audit-memory-drift.mutation-test.sh
#
# ADVERSARIAL mutation test harness for the M2 memory-drift sensor
# (scripts/audit-memory-drift.sh). Algol (α-VER-06) · refutation run.
#
# SCOPE / SAFETY (binding):
#   - Operates ENTIRELY inside a private mktemp sandbox. It NEVER reads, scans,
#     or mutates any real tracked file, the real auto-memory dir, or the real
#     ledger. All WL_* overrides point at the sandbox.
#   - .claude/beta/** is never touched (sandbox has no beta surface).
#   - trap 'rm -rf "$SBX"' EXIT restores (tears down) the sandbox on EVERY exit
#     path (success, error, signal) — POLICY-NO-INPLACE-MUTATION honored.
#   - No network, no curl/wget, no destructive ops on tracked files.
#
# It exercises four discriminator cases against the sensor:
#   A · ALL MATCH          → expect exit 0 (PASS)
#   B · SILENT MUTATION    → temp copy edited, ledger NOT updated → expect != 0
#   C · MATCH AFTER REVERT → restore content → expect exit 0 again
#   D · DELETION PROBE     → delete a ledgered node → OBSERVE exit code
#                            (adversarial: does an erased provenance node still
#                             report green? disk->ledger-only iteration suspected)
# =============================================================================
set -uo pipefail

SCRIPT="/Users/neospiritth/codingspace/personal_website/scripts/audit-memory-drift.sh"

SBX="$(mktemp -d)"
trap 'rm -rf "$SBX"' EXIT

REPO="$SBX/repo"
AUTOMEM="$SBX/automem"
mkdir -p "$REPO/.claude/handoffs" "$REPO/.claude/signatures" "$AUTOMEM"
LEDGER="$SBX/ledger.jsonl"

digest() { sha256sum "$1" | awk '{print $1}'; }

H="$REPO/.claude/handoffs/H-001.json"
S="$REPO/.claude/signatures/SIG-001.json"
M="$REPO/MEMORY.md"
A="$AUTOMEM/user_peat.md"

printf 'handoff body v1\n'     > "$H"
printf 'signature body v1\n'   > "$S"
printf 'memory index v1\n'     > "$M"
printf 'auto memory node v1\n' > "$A"

emit() {
  jq -cn --arg p "$1" --arg s "$2" --arg a "algol-test" --arg t "2026-06-04T00:00:00Z" \
    '{path:$p,sha256:$s,author:$a,ts:$t}'
}

# Ledger keys mirror integrity-write-ledger.sh canonicalization EXACTLY:
#   in-repo  -> repo-relative, no leading "./"
#   auto-mem -> absolute path
{
  emit ".claude/handoffs/H-001.json"      "$(digest "$H")"
  emit ".claude/signatures/SIG-001.json"  "$(digest "$S")"
  emit "MEMORY.md"                        "$(digest "$M")"
  emit "$A"                               "$(digest "$A")"
} > "$LEDGER"

echo "=== Sandbox ledger (4 ledgered nodes) ==="
cat "$LEDGER"
echo

run() {
  WL_INTEGRITY_LEDGER="$LEDGER" \
  WL_REPO_ROOT="$REPO" \
  WL_AUTO_MEMORY_DIR="$AUTOMEM" \
  WL_MEMORY_MD="$M" \
  CLAUDE_PROJECT_DIR="$REPO" \
  bash "$SCRIPT" 2>&1
}

divider() { printf '\n################ %s ################\n' "$1"; }

divider "CASE A · ALL MATCH (expect exit 0)"
out="$(run)"; rc=$?
printf '%s\n>>> EXIT: %d\n' "$out" "$rc"
A_RC=$rc

divider "CASE B · SILENT MUTATION of signature node (ledger NOT updated; expect != 0)"
# tamper: rewrite the signature content WITHOUT appending a ledger line
printf 'signature body v1 -- TAMPERED out of band\n' > "$S"
out="$(run)"; rc=$?
printf '%s\n>>> EXIT: %d\n' "$out" "$rc"
B_RC=$rc

divider "CASE C · MATCH AFTER REVERT (restore content; expect exit 0)"
printf 'signature body v1\n' > "$S"   # exact original bytes -> hash matches ledger
out="$(run)"; rc=$?
printf '%s\n>>> EXIT: %d\n' "$out" "$rc"
C_RC=$rc

divider "CASE D · DELETION PROBE — delete a ledgered node (expect non-zero after fix)"
# Adversarial: a ledgered signature is erased. Provenance gone.
# Before the reverse ledger→disk pass fix this returned exit 0 (FALSE-HAVE).
# After the fix the reverse pass detects the missing ledgered node and exits 1.
rm -f "$S"
echo "(deleted ledgered node: .claude/signatures/SIG-001.json — still has a ledger entry)"
out="$(run)"; rc=$?
printf '%s\n>>> EXIT: %d\n' "$out" "$rc"
D_RC=$rc

divider "VERDICT MATRIX"
printf 'CASE A all-match      : exit %d  (expect 0)\n' "$A_RC"
printf 'CASE B silent-mutate  : exit %d  (expect non-zero == catches drift)\n' "$B_RC"
printf 'CASE C revert-match   : exit %d  (expect 0)\n' "$C_RC"
printf 'CASE D delete-ledgered: exit %d  (expect non-zero — MISSING = TAMPER/DRIFT)\n' "$D_RC"

divider "ASSERT"
FAIL=0
[[ "$A_RC" -eq 0 ]]  || { printf 'FAIL: Case A expected 0, got %d\n' "$A_RC";  FAIL=1; }
[[ "$B_RC" -ne 0 ]]  || { printf 'FAIL: Case B expected non-zero, got 0\n';     FAIL=1; }
[[ "$C_RC" -eq 0 ]]  || { printf 'FAIL: Case C expected 0, got %d\n' "$C_RC";  FAIL=1; }
[[ "$D_RC" -ne 0 ]]  || { printf 'FAIL: Case D expected non-zero (deletion=MISSING/TAMPER), got 0 — FALSE-HAVE NOT FIXED\n'; FAIL=1; }
if [[ "$FAIL" -eq 0 ]]; then
  printf 'ALL CASES PASS — M2 deletion blind spot closed\n'
  exit 0
else
  exit 1
fi
