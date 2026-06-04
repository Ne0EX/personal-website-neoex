#!/usr/bin/env bash
# tests/harness/m2-local-exitcode-refute.sh
# Algol (α-VER-06) — M2-local exit-code contract refute
#
# Mandate: verify that after the M2-local documentation-alignment fix the exit
# set is exactly {0,1,5} and that "unexplained write" emits exit 1 (not 2, not
# 0). This is the discriminator case that the existing refute suite
# (audit-memory-drift.refute.sh) did NOT exercise — it has no test for a file
# on disk with NO ledger entry.
#
# Cases:
#   C0  structural  — grep exit statements; set must be {0,1,5}, no exit 2
#   C1  fidelity    — all-match → 0 (proves canonical keys resolve correctly)
#   C2  drift       — content-drift → 1 DRIFT
#   C3  deletion    — ledgered node deleted → 1 MISSING  (reverse pass; no regression)
#   C4  DISCRIMINATOR — file on disk, NO ledger entry → 1 UNEXPLAINED (not 2, not 0)
#   C5  revert      — unexplained node removed → back to 0 (no false-positive)
#   C6  absent-ledger — real repo, no WL_INTEGRITY_LEDGER override → exit 5 NOTICE
#
# C5 (co-tamper bypass) is explicitly out of scope: an external witness covers
# it; it is a known residual at the M2 layer and is NOT closed by this fix.
#
# POLICY-NO-INPLACE-MUTATION: all fixtures live in a fresh mktemp sandbox.
# No real tracked file is mutated. No network.

set -uo pipefail

REPO="/Users/neospiritth/codingspace/personal_website"
AUDIT="$REPO/scripts/audit-memory-drift.sh"

SANDBOX="$(mktemp -d 2>/dev/null || mktemp -d -t m2exitcode)"
trap 'rm -rf "$SANDBOX"' EXIT

FREPO="$SANDBOX/repo"
FAUTO="$SANDBOX/auto"
LEDGER="$SANDBOX/ledger.jsonl"
mkdir -p "$FREPO/.claude/handoffs" "$FREPO/.claude/signatures" "$FREPO/.claude/beta" "$FAUTO"

sha_of() { sha256sum "$1" | awk '{print $1}'; }

seed_entry() {
  local canon="$1" fp="$2"
  local sha; sha="$(sha_of "$fp")"
  jq -cn --arg path "$canon" --arg sha256 "$sha" --arg author "algol" --arg ts "2026-06-04T00:00:00Z" \
    '{"path":$path,"sha256":$sha256,"author":$author,"ts":$ts}' >> "$LEDGER"
}

# Seed 4 content files
printf 'handoff one\n'     > "$FREPO/.claude/handoffs/h1.md"
printf 'signature one\n'   > "$FREPO/.claude/signatures/s1.json"
printf 'auto memory one\n' > "$FAUTO/a1.md"
printf 'memory root\n'     > "$FREPO/MEMORY.md"

seed_entry ".claude/handoffs/h1.md"     "$FREPO/.claude/handoffs/h1.md"
seed_entry ".claude/signatures/s1.json" "$FREPO/.claude/signatures/s1.json"
seed_entry "$FAUTO/a1.md"               "$FAUTO/a1.md"
seed_entry "MEMORY.md"                  "$FREPO/MEMORY.md"

run_audit() {
  CLAUDE_PROJECT_DIR="$FREPO" \
  WL_REPO_ROOT="$FREPO" \
  WL_INTEGRITY_LEDGER="$LEDGER" \
  WL_AUTO_MEMORY_DIR="$FAUTO" \
  WL_MEMORY_MD="$FREPO/MEMORY.md" \
  WL_TASK_ID="m2-exitcode-refute" \
  bash "$AUDIT" 2>&1
  return ${PIPESTATUS[0]}
}

verdict() {
  local name="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    printf 'OK   %-52s exit=%s (expected %s)\n' "$name" "$actual" "$expected"
  else
    printf 'FAIL %-52s exit=%s (expected %s)\n' "$name" "$actual" "$expected"
  fi
}

snap() { cp -a "$FREPO" "$SANDBOX/repo.bak"; cp -a "$FAUTO" "$SANDBOX/auto.bak"; cp -a "$LEDGER" "$SANDBOX/ledger.bak"; }
restore() {
  rm -rf "$FREPO" "$FAUTO" "$LEDGER"
  cp -a "$SANDBOX/repo.bak" "$FREPO"
  cp -a "$SANDBOX/auto.bak" "$FAUTO"
  cp -a "$SANDBOX/ledger.bak" "$LEDGER"
}
snap

echo "===== M2-LOCAL EXIT-CODE REFUTE ====="
echo ""

# ---------------------------------------------------------------------------
# C0 — STRUCTURAL: grep exit statements; set must be {0,1,5}; no exit 2
# ---------------------------------------------------------------------------
echo "----- C0: structural exit-code check -----"
EXIT_LINES="$(grep -n 'exit ' "$AUDIT" | grep -v '^.*#' | grep 'exit [0-9]')"
echo "Runtime exit statements:"
echo "$EXIT_LINES" | sed 's/^/  /'
UNIQUE_CODES="$(echo "$EXIT_LINES" | grep -oE 'exit [0-9]+' | awk '{print $2}' | sort -un)"
echo "Unique exit codes in code: $(echo "$UNIQUE_CODES" | tr '\n' ' ')"
HAS_EXIT2="$(echo "$UNIQUE_CODES" | grep -c '^2$' || true)"
EXPECTED_SET_OK=1
for code in $UNIQUE_CODES; do
  case "$code" in
    0|1|5) ;;
    *) EXPECTED_SET_OK=0 ;;
  esac
done
if [[ "$HAS_EXIT2" -eq 0 && "$EXPECTED_SET_OK" -eq 1 ]]; then
  echo "OK   C0 exit-set is {0,1,5}; no exit 2"
else
  echo "FAIL C0 unexpected exit code found (set: $UNIQUE_CODES)"
fi
echo ""

# ---------------------------------------------------------------------------
# C1 — FIDELITY GATE: all-match -> exit 0 (proves ledger keys resolve)
# ---------------------------------------------------------------------------
OUT="$(run_audit)"; EX=$?
echo "----- C1: all-match (fidelity gate) -----"
echo "$OUT" | grep -E 'PASS|summary|pass:'
verdict "C1 all-match -> 0" 0 "$EX"
echo ""

# ---------------------------------------------------------------------------
# C2 — DRIFT: content mutation -> exit 1 DRIFT
# ---------------------------------------------------------------------------
restore
printf 'TAMPERED handoff content\n' > "$FREPO/.claude/handoffs/h1.md"
OUT="$(run_audit)"; EX=$?
echo "----- C2: content-drift -----"
echo "$OUT" | grep -E 'DRIFT|FAIL|drift:'
verdict "C2 content-drift -> 1 DRIFT" 1 "$EX"
echo ""

# ---------------------------------------------------------------------------
# C3 — DELETION (reverse pass): ledgered node deleted -> exit 1 MISSING
# ---------------------------------------------------------------------------
restore
rm -f "$FREPO/.claude/handoffs/h1.md"
OUT="$(run_audit)"; EX=$?
echo "----- C3: deletion (reverse pass) -----"
echo "$OUT" | grep -E 'MISSING|FAIL|missing:'
verdict "C3 deletion -> 1 MISSING (reverse pass not regressed)" 1 "$EX"
echo ""

# ---------------------------------------------------------------------------
# C4 — DISCRIMINATOR: file on disk with NO ledger entry -> exit 1 UNEXPLAINED
#       This is the load-bearing case for the M2-local doc fix.
#       The former header described this as "exit 2"; code emits exit 1.
#       We confirm: (a) exit is 1, (b) exit is NOT 2, (c) UNEXPLAINED emitted.
# ---------------------------------------------------------------------------
restore
printf 'unlisted handoff — never ledgered\n' > "$FREPO/.claude/handoffs/h2.md"
OUT="$(run_audit)"; EX=$?
echo "----- C4: DISCRIMINATOR — unexplained write (h2.md, no ledger entry) -----"
echo "$OUT" | grep -E 'UNEXPLAINED|unexplained|summary'
printf 'C4a exit == 1 (not 0): '
[[ "$EX" == 1 ]] && echo "OK (got $EX)" || echo "FAIL (got $EX)"
printf 'C4b exit != 2 (old doc removed): '
[[ "$EX" != 2 ]] && echo "OK (got $EX, confirmed not 2)" || echo "FAIL (exit 2 still emitted)"
printf 'C4c UNEXPLAINED token emitted: '
echo "$OUT" | grep -q 'UNEXPLAINED' && echo "OK" || echo "FAIL (UNEXPLAINED not in output)"
verdict "C4 unexplained-write -> 1 (DISCRIMINATOR)" 1 "$EX"
echo ""

# ---------------------------------------------------------------------------
# C5 — REVERT: unexplained node removed -> back to exit 0 (no false-positive)
# ---------------------------------------------------------------------------
restore
# h2.md was not in snap (added after snap in C4), so restore is clean
OUT="$(run_audit)"; EX=$?
echo "----- C5: after unexplained removed -> exit 0 -----"
echo "$OUT" | grep -E 'PASS|summary'
verdict "C5 revert -> 0 (no false-positive)" 0 "$EX"
echo ""

# ---------------------------------------------------------------------------
# C6 — REAL REPO / ABSENT LEDGER: no env override -> exit 5 NOTICE, not 0
# ---------------------------------------------------------------------------
echo "----- C6: real-repo absent ledger -> exit 5 NOTICE -----"
REAL_OUT="$(WL_TASK_ID="m2-exitcode-c6" bash "$AUDIT" 2>&1)"; REAL_EX=$?
echo "$REAL_OUT" | grep -E 'NOTICE|ledger absent|exit 5' | head -3
verdict "C6 absent-ledger -> 5 NOTICE (not 0)" 5 "$REAL_EX"
echo ""

# ---------------------------------------------------------------------------
# RESIDUAL NOTE (not a finding against this fix)
# ---------------------------------------------------------------------------
echo "----- Residual note -----"
echo "C5-cotamper (file + ledger line removed together) is a known bypass at"
echo "the M2 layer. It is delegated to the external witness (per task scope:"
echo "'C5 explicitly out-of-scope'). This fix does not claim to close it."
echo "any_bypass_remains = true (co-tamper residual, witness-delegated)"
echo ""

echo "===== REFUTE COMPLETE ====="
