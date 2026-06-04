#!/usr/bin/env bash
# M2 memory-drift RE-REFUTE harness — Algol α-VER-06
# POLICY-NO-INPLACE-MUTATION: all fixtures in a mktemp sandbox; no real tracked
# file is mutated; no real network. Ledger seeded with production-faithful
# canonical keys (replicating integrity-write-ledger.sh canonical_path) and the
# identical sha256 method; CASE 1 (all-match->0) is the empirical fidelity proof.
set -uo pipefail

REPO="/Users/neospiritth/codingspace/personal_website"
AUDIT="$REPO/scripts/audit-memory-drift.sh"

SANDBOX="$(mktemp -d 2>/dev/null || mktemp -d -t m2refute)"
trap 'rm -rf "$SANDBOX"' EXIT

# Fixture repo tree
FREPO="$SANDBOX/repo"
FAUTO="$SANDBOX/auto-memory"
LEDGER="$SANDBOX/integrity-ledger.jsonl"
mkdir -p "$FREPO/.claude/handoffs" "$FREPO/.claude/signatures" "$FREPO/.claude/beta" "$FAUTO"

# Seed content files (in-repo repo-relative + auto-memory absolute + MEMORY.md + a beta file)
printf 'handoff one\n'    > "$FREPO/.claude/handoffs/h1.md"
printf 'signature one\n'  > "$FREPO/.claude/signatures/s1.json"
printf 'auto memory one\n'> "$FAUTO/a1.md"
printf 'memory root\n'    > "$FREPO/MEMORY.md"
printf 'beta secret\n'    > "$FREPO/.claude/beta/b1.md"

# --- Seed the ledger ---
# FIDELITY NOTE: the real writer (integrity-write-ledger.sh) hardcodes
# AUTO_MEMORY_DIR (no env override) and matches in-repo surfaces only on
# REPO-RELATIVE input. It cannot be retargeted at a sandbox auto-memory dir.
# We replicate canonical_path EXACTLY and use the IDENTICAL sha256 method
# (sha256sum | awk '{print $1}') the writer + audit both use. Canonical keys:
# in-repo -> repo-relative (no ./); auto-memory -> absolute. Beta is NOT seeded.
seed_entry() { # canonical_key actual_file
  local canon="$1" fp="$2"
  local sha; sha="$(sha256sum "$fp" | awk '{print $1}')"
  jq -cn --arg path "$canon" --arg sha256 "$sha" --arg author "algol" --arg ts "2026-06-04T00:00:00Z" \
    '{"path":$path,"sha256":$sha256,"author":$author,"ts":$ts}' >> "$LEDGER"
}
seed_entry ".claude/handoffs/h1.md"     "$FREPO/.claude/handoffs/h1.md"
seed_entry ".claude/signatures/s1.json" "$FREPO/.claude/signatures/s1.json"
seed_entry "$FAUTO/a1.md"               "$FAUTO/a1.md"
seed_entry "MEMORY.md"                  "$FREPO/MEMORY.md"
# (no beta entry — beta is excluded surface)
# FIDELITY PROOF: CASE 1 (all-match -> exit 0) is the empirical check that these
# hand-seeded canonical keys resolve against the audit's enumerated disk paths.
# If a key is wrong, C1 fails (spurious UNEXPLAINED/MISSING) and the verdict is void.

echo "===== SEEDED LEDGER ====="
cat "$LEDGER" 2>/dev/null || echo "(no ledger written)"
echo "========================="
echo

# Audit runner with all four overrides pointed at the sandbox
run_audit() {
  CLAUDE_PROJECT_DIR="$FREPO" \
  WL_REPO_ROOT="$FREPO" \
  WL_INTEGRITY_LEDGER="$LEDGER" \
  WL_AUTO_MEMORY_DIR="$FAUTO" \
  WL_MEMORY_MD="$FREPO/MEMORY.md" \
  WL_TASK_ID="m2-refute" \
  bash "$AUDIT" 2>&1
  return ${PIPESTATUS[0]}
}

verdict() { # name expected_exit actual_exit
  if [[ "$2" == "$3" ]]; then printf 'OK   %-46s exit=%s (expected %s)\n' "$1" "$3" "$2"
  else                        printf 'FAIL %-46s exit=%s (expected %s)\n' "$1" "$3" "$2"; fi
}

# Snapshot-restore helpers so each case is independent
snap() { cp -a "$FREPO" "$SANDBOX/repo.bak"; cp -a "$FAUTO" "$SANDBOX/auto.bak"; cp -a "$LEDGER" "$SANDBOX/ledger.bak"; }
restore() { rm -rf "$FREPO" "$FAUTO" "$LEDGER"; cp -a "$SANDBOX/repo.bak" "$FREPO"; cp -a "$SANDBOX/auto.bak" "$FAUTO"; cp -a "$SANDBOX/ledger.bak" "$LEDGER"; }
snap

# CASE 1 — ALL-MATCH -> exit 0  (FIDELITY GATE: proves ledger keys resolve)
OUT="$(run_audit)"; EX=$?
echo "----- CASE 1: all-match -----"; echo "$OUT"
verdict "C1 all-match -> 0" 0 "$EX"
echo

# CASE 2 — SILENT CONTENT MUTATION -> exit 1 DRIFT
restore
printf 'TAMPERED handoff\n' > "$FREPO/.claude/handoffs/h1.md"
OUT="$(run_audit)"; EX=$?
echo "----- CASE 2: content mutation -----"; echo "$OUT" | grep -E 'DRIFT|FAIL|summary|drift:'
verdict "C2 content mutation -> 1 DRIFT" 1 "$EX"
echo

# CASE 3 — REVERT-TO-ORIGINAL -> exit 0  (no false positive)
restore
printf 'TAMPERED\n' > "$FREPO/.claude/handoffs/h1.md"
printf 'handoff one\n' > "$FREPO/.claude/handoffs/h1.md"
OUT="$(run_audit)"; EX=$?
echo "----- CASE 3: revert-to-original -----"; echo "$OUT" | grep -E 'PASS|drift:|summary'
verdict "C3 revert-to-original -> 0" 0 "$EX"
echo

# CASE 4a — DELETION PROBE (repo-relative / handoff) -> exit 1 MISSING  [THE NAMED FALSE-HAVE]
restore
rm -f "$FREPO/.claude/handoffs/h1.md"
OUT="$(run_audit)"; EX=$?
echo "----- CASE 4a: DELETE repo-relative handoff (FALSE-HAVE) -----"; echo "$OUT" | grep -E 'MISSING|FAIL|missing'
verdict "C4a delete repo-rel node -> 1 MISSING" 1 "$EX"
echo

# CASE 4b — DELETION PROBE (absolute / auto-memory) -> exit 1 MISSING  [other mapping branch]
restore
rm -f "$FAUTO/a1.md"
OUT="$(run_audit)"; EX=$?
echo "----- CASE 4b: DELETE absolute auto-memory node -----"; echo "$OUT" | grep -E 'MISSING|FAIL|missing'
verdict "C4b delete absolute node -> 1 MISSING" 1 "$EX"
echo

# CASE 5 — CO-TAMPER DELETION (residual; OUTSIDE named false-HAVE) -> expect bypass exit 0
restore
rm -f "$FREPO/.claude/handoffs/h1.md"
grep -v '\.claude/handoffs/h1\.md' "$LEDGER" > "$SANDBOX/ledger.cotamper" 2>/dev/null
cp -a "$SANDBOX/ledger.cotamper" "$LEDGER"
OUT="$(run_audit)"; EX=$?
echo "----- CASE 5: CO-TAMPER deletion (file + ledger line removed) -----"; echo "$OUT" | grep -E 'MISSING|PASS|missing|summary'
verdict "C5 co-tamper deletion -> (probe; expect bypass 0)" 0 "$EX"
echo

# CASE 6 — MALFORMED LEDGER LINE -> must FAIL CLOSED (exit 1 parse err)
restore
printf 'THIS IS NOT JSON {{{\n' > "$SANDBOX/ledger.malformed"
cat "$LEDGER" >> "$SANDBOX/ledger.malformed"
cp -a "$SANDBOX/ledger.malformed" "$LEDGER"
OUT="$(run_audit)"; EX=$?
echo "----- CASE 6: malformed ledger line -----"; echo "$OUT" | grep -E 'ERROR|parse|FAIL|NOTICE|summary' | head -5
verdict "C6 malformed line -> fail-closed (1)" 1 "$EX"
echo

# CASE 7 — deletion + malformed line ABOVE its entry (M1's exact bypass class) -> must NOT be exit 0
restore
rm -f "$FREPO/.claude/handoffs/h1.md"
head -1 "$LEDGER" > "$SANDBOX/ledger.combo"
printf 'GARBAGE NOT JSON\n' >> "$SANDBOX/ledger.combo"
tail -n +2 "$LEDGER" >> "$SANDBOX/ledger.combo"
cp -a "$SANDBOX/ledger.combo" "$LEDGER"
OUT="$(run_audit)"; EX=$?
echo "----- CASE 7: deletion + malformed line above its entry -----"; echo "$OUT" | grep -E 'ERROR|parse|MISSING|FAIL|missing|summary' | head -6
echo "RAW EXIT C7: $EX"
if [[ "$EX" == "0" ]]; then echo "FAIL C7 deletion-hidden-by-malformed -> BYPASS (exit 0, node gone)"
else echo "OK   C7 deletion+malformed -> fail-closed (exit $EX, not 0)"; fi
echo

# CASE 8 — BETA EXCLUSION: stray beta ledger key with absent file must be SKIPPED, not MISSING
restore
printf '{"path":".claude/beta/ghost.md","sha256":"deadbeef","author":"x","ts":"t"}\n' >> "$LEDGER"
rm -f "$FREPO/.claude/beta/ghost.md"
OUT="$(run_audit)"; EX=$?
echo "----- CASE 8: beta ledger key absent file -> must be skipped (exit 0) -----"; echo "$OUT" | grep -E 'beta|MISSING|PASS|missing|summary'
verdict "C8 beta key skipped (not MISSING) -> 0" 0 "$EX"
echo

echo "===== HARNESS COMPLETE ====="
