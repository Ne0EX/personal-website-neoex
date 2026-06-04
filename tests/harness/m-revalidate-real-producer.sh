#!/usr/bin/env bash
# =============================================================================
# tests/harness/m-revalidate-real-producer.sh
# Algol (α-VER-06) — MAKE-OR-BREAK RE-VALIDATION
#
# Re-validate M1 / TRUST-ROOT / M2 on a ledger seeded by the REAL producer
# (.claude/hooks/integrity-write-ledger.sh) driven with ABSOLUTE file_path.
# The R2 greens were INVALID: they tested against a hand-seeded RELATIVE-path
# ledger the production producer never emits. This re-seeds via the real hook
# with ABSOLUTE paths (what PostToolUse actually passes) before re-running every
# audit.
#
# SAFETY (binding): all work in a /tmp mktemp SANDBOX git repo. No network,
# no tracked-file mutation. CLAUDE_PROJECT_DIR == the sandbox repo root so the
# producer's absolute-path prefix test (lines 138/143 of the producer) matches
# with NO canonicalization mismatch (the macOS /tmp->/private/tmp trap is avoided
# by using the mktemp -d path verbatim on both sides).
#
# Run: bash tests/harness/m-revalidate-real-producer.sh   (exit 0 = all green)
# =============================================================================
set -uo pipefail

REPO_DIR="${CLAUDE_PROJECT_DIR:-/Users/neospiritth/codingspace/personal_website}"
WRITER="$REPO_DIR/.claude/hooks/integrity-write-ledger.sh"
AUDIT_M1="$REPO_DIR/scripts/audit-handoff-integrity.sh"
AUDIT_APPEND="$REPO_DIR/scripts/audit-ledger-append-only.sh"
AUDIT_M2="$REPO_DIR/scripts/audit-memory-drift.sh"
for f in "$WRITER" "$AUDIT_M1" "$AUDIT_APPEND" "$AUDIT_M2"; do
  [[ -f "$f" ]] || { echo "FATAL: missing $f"; exit 2; }
done

SB="$(mktemp -d "${TMPDIR:-/tmp}/algol-reval.XXXXXX")"
cleanup() {
  case "$SB" in
    "${TMPDIR:-/tmp}"/algol-reval.*|/tmp/algol-reval.*|/var/folders/*/algol-reval.*)
      rm -rf "$SB" 2>/dev/null || true ;;
    *) echo "WARN refusing to clean unexpected SB=$SB" >&2 ;;
  esac
}
trap cleanup EXIT INT TERM

sha_of() { sha256sum "$1" | awk '{print $1}'; }

PROD="$SB/repo"
LED="$PROD/.harness/integrity-ledger.jsonl"
LED_REL=".harness/integrity-ledger.jsonl"
HDIR="$PROD/.claude/handoffs"
mkdir -p "$PROD/.harness" "$HDIR/from-sirius" "$PROD/.claude/signatures" "$PROD/.claude/beta"

git -C "$PROD" init -q
git -C "$PROD" config user.email "sandbox@algol.test"
git -C "$PROD" config user.name "algol-sandbox"

drive() {
  local fp="$1" agent="$2" mock
  mock="$(jq -cn --arg fp "$fp" '{"tool_name":"Write","tool_input":{"file_path":$fp}}')"
  printf '%s' "$mock" | env \
    CLAUDE_PROJECT_DIR="$PROD" \
    WL_INTEGRITY_LEDGER="$LED" \
    WL_AGENT="$agent" \
    WL_TASK_ID="algol-reval" \
    bash "$WRITER"
}

PASS=0; FAIL=0
ok()   { echo "  [PASS] $*"; PASS=$((PASS+1)); }
bad()  { echo "  [FAIL] $*"; FAIL=$((FAIL+1)); }

echo "###############################################################"
echo "# SANDBOX: $SB"
echo "# CLAUDE_PROJECT_DIR = $PROD"
echo "###############################################################"

# --- STEP 1: SEED VIA REAL PRODUCER (absolute file_path) ---
echo ""
echo "=== STEP 1 — SEED VIA REAL PRODUCER (absolute file_path) ==="
printf 'HANDOFF from sirius — original body.\n' > "$HDIR/from-sirius/x.md"
printf '{"schema":"v2","agent":"vega","sig":"abc"}\n' > "$PROD/.claude/signatures/y.json"
printf 'beta room — MUST be excluded.\n' > "$PROD/.claude/beta/room.md"
printf '# MEMORY top-level node\n' > "$PROD/MEMORY.md"

drive "$PROD/.claude/handoffs/from-sirius/x.md" "sirius"
drive "$PROD/.claude/signatures/y.json"          "vega"
drive "$PROD/.claude/beta/room.md"               "beta"
drive "$PROD/MEMORY.md"                           "polaris"

echo "LEDGER after seed:"
nl -ba "$LED"

H_HIT="$(grep -c '"path":".claude/handoffs/from-sirius/x.md"' "$LED" 2>/dev/null || true)"
S_HIT="$(grep -c '"path":".claude/signatures/y.json"' "$LED" 2>/dev/null || true)"
B_HIT="$(grep -c 'beta' "$LED" 2>/dev/null || true)"
[[ "$H_HIT" -ge 1 ]] && ok "handoff entry recorded (repo-relative)" || bad "handoff entry MISSING — gate broken"
[[ "$S_HIT" -ge 1 ]] && ok "signature entry recorded (repo-relative)" || bad "signature entry MISSING — gate broken"
[[ "$B_HIT" -eq 0 ]] && ok "beta excluded (no ledger line)" || bad "beta leaked into ledger"

# --- STEP 2: M1 audit-handoff-integrity over real-producer ledger ---
echo ""
echo "=== STEP 2 — M1 (audit-handoff-integrity) over real-producer ledger ==="
run_m1() {
  local ledger="$1" hdir="$2"; shift 2
  local args=( "CLAUDE_PROJECT_DIR=$PROD" "WL_INTEGRITY_LEDGER=$ledger" "WL_HANDOFFS_DIR=$hdir" "WL_TASK_ID=m1-$RANDOM" )
  while [[ $# -gt 0 ]]; do args+=("$1"); shift; done
  M1_OUT="$(env "${args[@]}" bash "$AUDIT_M1" 2>&1)"; M1_RC=$?
}

run_m1 "$LED" "$HDIR"
echo "[M1 baseline] RC=$M1_RC"
echo "$M1_OUT" | grep -E 'handoff_entries|verified_ok|RESULT|status' | sed 's/^/    /'
if echo "$M1_OUT" | grep -q 'handoff_entries=1' && [[ "$M1_RC" -eq 0 ]]; then
  ok "M1 baseline: 1 handoff entry verified clean, exit 0"
else
  bad "M1 baseline: expected handoff_entries=1 + exit 0 (RC=$M1_RC)"
fi

PA="$SB/m1a"; mkdir -p "$PA/.claude/handoffs/from-sirius" "$PA/.harness"
LED_A="$PA/.harness/integrity-ledger.jsonl"; HDIR_A="$PA/.claude/handoffs"
printf 'orig.\n' > "$HDIR_A/from-sirius/h.md"
printf '%s' "$(jq -cn --arg fp "$PA/.claude/handoffs/from-sirius/h.md" '{"tool_name":"Write","tool_input":{"file_path":$fp}}')" \
  | env CLAUDE_PROJECT_DIR="$PA" WL_INTEGRITY_LEDGER="$LED_A" WL_AGENT="sirius" WL_TASK_ID="m1a" bash "$WRITER"
printf 'FORGED out-of-band.\n' > "$HDIR_A/from-sirius/forged.md"
A_OUT="$(env CLAUDE_PROJECT_DIR="$PA" WL_INTEGRITY_LEDGER="$LED_A" WL_HANDOFFS_DIR="$HDIR_A" WL_INTEGRITY_WIRED=1 WL_TASK_ID="m1a-aud" bash "$AUDIT_M1" 2>&1)"; A_RC=$?
echo "[M1-A forged unlisted, WIRED=1] RC=$A_RC"
echo "$A_OUT" | grep -E 'unlisted_on_disk|UNVERIFIABLE|RESULT' | sed 's/^/    /'
{ [[ "$A_RC" -eq 4 ]] && echo "$A_OUT" | grep -q 'UNVERIFIABLE_PRESENT'; } && ok "A: forged unlisted -> exit 4 CAUGHT" || bad "A: expected exit 4 (RC=$A_RC)"

PC="$SB/m1c"; mkdir -p "$PC/.claude/handoffs/from-sirius" "$PC/.harness"
LED_C="$PC/.harness/integrity-ledger.jsonl"; HDIR_C="$PC/.claude/handoffs"
printf 'good body.\n' > "$HDIR_C/from-sirius/good.md"
printf '%s' "$(jq -cn --arg fp "$PC/.claude/handoffs/from-sirius/good.md" '{"tool_name":"Write","tool_input":{"file_path":$fp}}')" \
  | env CLAUDE_PROJECT_DIR="$PC" WL_INTEGRITY_LEDGER="$LED_C" WL_AGENT="sirius" WL_TASK_ID="m1c1" bash "$WRITER"
printf 'original.\n' > "$HDIR_C/from-sirius/h.md"
printf '%s' "$(jq -cn --arg fp "$PC/.claude/handoffs/from-sirius/h.md" '{"tool_name":"Write","tool_input":{"file_path":$fp}}')" \
  | env CLAUDE_PROJECT_DIR="$PC" WL_INTEGRITY_LEDGER="$LED_C" WL_AGENT="sirius" WL_TASK_ID="m1c2" bash "$WRITER"
HDR_LINE="$(sed -n '1p' "$LED_C")"; GOOD_LINE="$(sed -n '2p' "$LED_C")"; H_LINE="$(sed -n '3p' "$LED_C")"
{ printf '%s\n' "$HDR_LINE"; printf '%s\n' "$GOOD_LINE"; printf '{ not valid json <<< }\n'; printf '%s\n' "$H_LINE"; } > "$LED_C"
printf 'TAMPERED.\n' > "$HDIR_C/from-sirius/h.md"
C_OUT="$(env CLAUDE_PROJECT_DIR="$PC" WL_INTEGRITY_LEDGER="$LED_C" WL_HANDOFFS_DIR="$HDIR_C" WL_TASK_ID="m1c-aud" bash "$AUDIT_M1" 2>&1)"; C_RC=$?
echo "[M1-C malformed+tamper] RC=$C_RC"
echo "$C_OUT" | grep -E 'SHA_MISMATCH|RESULT|status' | sed 's/^/    /'
{ [[ "$C_RC" -eq 1 ]] && echo "$C_OUT" | grep -q 'SHA_MISMATCH'; } && ok "C: malformed line skipped, tamper -> exit 1 CAUGHT" || bad "C: expected exit 1 SHA_MISMATCH (RC=$C_RC)"

PD="$SB/m1d"; mkdir -p "$PD/.claude/handoffs/from-sirius/a/b" "$PD/.harness"
LED_D="$PD/.harness/integrity-ledger.jsonl"; HDIR_D="$PD/.claude/handoffs"
printf 'orig.\n' > "$HDIR_D/from-sirius/h.md"
printf '%s' "$(jq -cn --arg fp "$PD/.claude/handoffs/from-sirius/h.md" '{"tool_name":"Write","tool_input":{"file_path":$fp}}')" \
  | env CLAUDE_PROJECT_DIR="$PD" WL_INTEGRITY_LEDGER="$LED_D" WL_AGENT="sirius" WL_TASK_ID="m1d" bash "$WRITER"
printf 'FORGED deep.\n' > "$HDIR_D/from-sirius/a/b/forged.md"
D_OUT="$(env CLAUDE_PROJECT_DIR="$PD" WL_INTEGRITY_LEDGER="$LED_D" WL_HANDOFFS_DIR="$HDIR_D" WL_INTEGRITY_WIRED=1 WL_TASK_ID="m1d-aud" bash "$AUDIT_M1" 2>&1)"; D_RC=$?
echo "[M1-D deep-nest forged, WIRED=1] RC=$D_RC"
echo "$D_OUT" | grep -E 'disk_files|unlisted_on_disk|UNVERIFIABLE|RESULT' | sed 's/^/    /'
{ [[ "$D_RC" -eq 4 ]] && echo "$D_OUT" | grep -q 'UNVERIFIABLE_PRESENT'; } && ok "D: deep-nest forged CAUGHT (unbounded walk) -> exit 4" || bad "D: deep-nest forged ESCAPED (RC=$D_RC)"

# --- STEP 3: TRUST-ROOT append-only over committed real-producer ledger ---
echo ""
echo "=== STEP 3 — TRUST-ROOT (audit-ledger-append-only) over committed history ==="
run_append() {
  local root="$1"; shift
  local args=( "WL_REPO_ROOT=$root" "WL_LEDGER_REL=$LED_REL" "WL_TASK_ID=ap-$RANDOM" )
  while [[ $# -gt 0 ]]; do args+=("$1"); shift; done
  AP_OUT="$(env "${args[@]}" bash "$AUDIT_APPEND" 2>&1)"; AP_RC=$?
}

printf 'readme\n' > "$PROD/README.md"
git -C "$PROD" add README.md && git -C "$PROD" commit -q -m "rev0: readme, no ledger committed yet"
run_append "$PROD"
echo "[AP ledger-absent] RC=$AP_RC"
echo "$AP_OUT" | grep -E 'committed_revisions|RESULT|status|reason' | sed 's/^/    /'
{ [[ "$AP_RC" -eq 0 ]] && echo "$AP_OUT" | grep -qE 'NEUTRAL'; } && ok "ledger-absent-from-history -> NEUTRAL exit 0" || bad "ledger-absent: expected NEUTRAL exit 0 (RC=$AP_RC)"

git -C "$PROD" add "$LED_REL" && git -C "$PROD" commit -q -m "rev1: seed real-producer ledger"
printf 'HANDOFF from vega — second.\n' > "$HDIR/from-sirius/x2.md"
drive "$PROD/.claude/handoffs/from-sirius/x2.md" "sirius"
git -C "$PROD" add "$LED_REL" && git -C "$PROD" commit -q -m "rev2: append second real-producer handoff entry"

run_append "$PROD"
echo "[AP honest-appends] RC=$AP_RC"
echo "$AP_OUT" | grep -E 'committed_revisions|consecutive_pairs|RESULT|status' | sed 's/^/    /'
{ [[ "$AP_RC" -eq 0 ]] && echo "$AP_OUT" | grep -q 'status=PASS'; } && ok "honest appends across real-producer revisions -> PASS exit 0" || bad "honest appends: expected PASS exit 0 (RC=$AP_RC)"

SBB="$SB/apB"; rm -rf "$SBB"; cp -R "$PROD" "$SBB"
LEDB="$SBB/$LED_REL"
printf 'CO-TAMPERED body.\n' > "$SBB/.claude/handoffs/from-sirius/x.md"
NEWSHA="$(sha_of "$SBB/.claude/handoffs/from-sirius/x.md")"
TMPB="$SBB/.harness/led.tmp"
while IFS= read -r line; do
  if printf '%s' "$line" | grep -q '"path":".claude/handoffs/from-sirius/x.md"'; then
    printf '%s\n' "$(printf '%s' "$line" | jq -c --arg s "$NEWSHA" '.sha256=$s')"
  else printf '%s\n' "$line"; fi
done < "$LEDB" > "$TMPB"; mv "$TMPB" "$LEDB"
git -C "$SBB" add "$LED_REL" && git -C "$SBB" commit -q -m "revBAD: co-tamper x.md sha in place"
run_append "$SBB"
echo "[AP M1-B co-tamper] RC=$AP_RC"
echo "$AP_OUT" | grep -E 'VIOLATION|offending_commit|RESULT|status' | sed 's/^/    /'
{ [[ "$AP_RC" -eq 1 ]] && echo "$AP_OUT" | grep -q 'status=VIOLATION'; } && ok "M1-B co-tamper (passes recompute) -> exit 1 CAUGHT by cross-commit history" || bad "M1-B: expected exit 1 VIOLATION (RC=$AP_RC)"

SBC="$SB/apC5"; rm -rf "$SBC"; cp -R "$PROD" "$SBC"
LEDC="$SBC/$LED_REL"
rm -f "$SBC/.claude/signatures/y.json"
grep -v '"path":".claude/signatures/y.json"' "$LEDC" > "$SBC/.harness/led.tmp" && mv "$SBC/.harness/led.tmp" "$LEDC"
git -C "$SBC" add -A && git -C "$SBC" commit -q -m "revBAD: delete y.json file + its ledger line"
run_append "$SBC"
echo "[AP M2-C5 deletion co-tamper] RC=$AP_RC"
echo "$AP_OUT" | grep -E 'VIOLATION|offending_commit|RESULT|status' | sed 's/^/    /'
{ [[ "$AP_RC" -eq 1 ]] && echo "$AP_OUT" | grep -q 'status=VIOLATION'; } && ok "M2-C5 deletion co-tamper -> exit 1 CAUGHT by cross-commit history" || bad "M2-C5: expected exit 1 VIOLATION (RC=$AP_RC)"

# --- STEP 4: M2 memory-drift over real-producer ledger ---
echo ""
echo "=== STEP 4 — M2 (audit-memory-drift) over real-producer ledger ==="
run_m2() {
  local root="$1" ledger="$2"; shift 2
  local emptymem="$SB/empty-automem"; mkdir -p "$emptymem"
  local args=( "WL_REPO_ROOT=$root" "WL_INTEGRITY_LEDGER=$ledger" "WL_AUTO_MEMORY_DIR=$emptymem" "WL_MEMORY_MD=$root/MEMORY.md" "WL_TASK_ID=m2-$RANDOM" )
  while [[ $# -gt 0 ]]; do args+=("$1"); shift; done
  M2_OUT="$(env "${args[@]}" bash "$AUDIT_M2" --verbose 2>&1)"; M2_RC=$?
}

run_m2 "$PROD" "$LED"
echo "[M2 clean] RC=$M2_RC"
echo "$M2_OUT" | grep -E 'PASS —|nodes checked|pass:|drift:|unexplained|missing|ledger entries' | sed 's/^/    /'
echo "$M2_OUT" | grep -q 'PASS — .claude/handoffs/from-sirius/x.md' && ok "M2 covers handoffs (PASS line present)" || bad "M2 missing handoff coverage"
echo "$M2_OUT" | grep -q 'PASS — .claude/signatures/y.json' && ok "M2 covers signatures (PASS line present)" || bad "M2 missing signature coverage"
{ [[ "$M2_RC" -eq 0 ]] && echo "$M2_OUT" | grep -q 'PASS — all'; } && ok "M2 clean real-producer ledger -> exit 0 PASS" || bad "M2 clean: expected exit 0 (RC=$M2_RC)"

SBM="$SB/m2del"; rm -rf "$SBM"; cp -R "$PROD" "$SBM"
rm -f "$SBM/.claude/signatures/y.json"
run_m2 "$SBM" "$SBM/$LED_REL"
echo "[M2 deletion closure] RC=$M2_RC"
echo "$M2_OUT" | grep -E 'MISSING|missing \(deleted\)|FAIL|exit' | sed 's/^/    /'
{ [[ "$M2_RC" -eq 1 ]] && echo "$M2_OUT" | grep -q 'MISSING'; } && ok "M2 deletion closure -> exit 1 MISSING CAUGHT" || bad "M2 deletion closure: expected exit 1 MISSING (RC=$M2_RC)"

SBD="$SB/m2drift"; rm -rf "$SBD"; cp -R "$PROD" "$SBD"
printf 'OUT-OF-BAND edit bypassing the hook.\n' > "$SBD/.claude/handoffs/from-sirius/x.md"
run_m2 "$SBD" "$SBD/$LED_REL"
echo "[M2 drift] RC=$M2_RC"
echo "$M2_OUT" | grep -E 'DRIFT|drift:|FAIL|exit' | sed 's/^/    /'
{ [[ "$M2_RC" -eq 1 ]] && echo "$M2_OUT" | grep -q 'DRIFT'; } && ok "M2 drift: out-of-band edit -> exit 1 DRIFT CAUGHT" || bad "M2 drift: expected exit 1 DRIFT (RC=$M2_RC)"

echo ""
echo "###############################################################"
echo "# VERDICT: PASS=$PASS  FAIL=$FAIL"
echo "###############################################################"
[[ "$FAIL" -eq 0 ]] && exit 0 || exit 1
