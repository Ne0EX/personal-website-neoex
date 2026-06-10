#!/usr/bin/env bash
# tests/harness/audit-stale-handoffs.test.sh
# Algol (α-VER-06) — regression + adversarial test suite for audit-stale-handoffs.sh
# Canopus (α-HRN-07) — authored per spec (Phase 0 slice 0.5)
#
# FIXTURES EXERCISED
# ------------------
#   STALE       — task=T1 from=algol next=Sirius, NO T1--sirius.json → STALE + exit 0
#   PICKED-UP   — task=T2 from=algol next=Sirius, T2--sirius.json present → NOT stale, exit 0
#   POLARIS     — task=T3 next=Polaris, no further sig → NOT stale (documented assumption), exit 0
#   UNKNOWN     — task=T4 next=Nemesis → UNKNOWN_RECIPIENT (not STALE), exit 0
#   MALFORMED   — non-JSON .json file → PARSE_ISSUE reported (non-silent), exit 0
#   FLIP-TO-FAIL — grep for flip-to-fail / "promote to exit 1" in script source
#
# MUTATION GUARD
#   Remove the pickup-evidence check (always flag stale) → PICKED-UP fixture must flip
#   to flagged → proves the pickup logic is load-bearing. (Deterministic backstop: grep
#   the report for expected task ids.)
#
# SAFETY (binding)
#   - POLICY-NO-INPLACE-MUTATION: every fixture is built in a fresh mktemp dir.
#     A trap restores/cleans on EVERY exit path.
#   - No real .claude/signatures/** files are touched.
#   - .claude/beta/** is never read/scanned/touched.
#   - WL_SIGNATURES_DIR points entirely at the temp sandbox.
#
# Run: bash tests/harness/audit-stale-handoffs.test.sh
# Exit 0 iff all assertions hold.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
AUDIT="$REPO_DIR/scripts/audit-stale-handoffs.sh"

if [[ ! -f "$AUDIT" ]]; then
  printf 'FATAL: audit script not found at %s\n' "$AUDIT" >&2
  exit 2
fi

# ---------------------------------------------------------------------------
# Temp sandbox + trap-restore (POLICY-NO-INPLACE-MUTATION)
# ---------------------------------------------------------------------------
TMPROOT="$(mktemp -d "${TMPDIR:-/tmp}/stale-handoffs-test.XXXXXX")"
cleanup() {
  case "$TMPROOT" in
    "${TMPDIR:-/tmp}"/stale-handoffs-test.*|/tmp/stale-handoffs-test.*|/var/folders/*/stale-handoffs-test.*)
      rm -rf "$TMPROOT" 2>/dev/null || true ;;
    *) printf 'WARN: refusing to clean unexpected TMPROOT=%s\n' "$TMPROOT" >&2 ;;
  esac
}
trap cleanup EXIT INT TERM

PASS=0
FAIL=0
note() { printf '%s\n' "$*"; }
ok()   { PASS=$(( PASS + 1 )); printf '  PASS · %s\n' "$*"; }
bad()  { FAIL=$(( FAIL + 1 )); printf '  FAIL · %s\n' "$*"; }

# run_audit <sigs_dir> -> sets RC and OUT
run_audit() {
  local sdir="$1"
  local env_args=(
    "CLAUDE_PROJECT_DIR=$REPO_DIR"
    "WL_SIGNATURES_DIR=$sdir"
    "WL_TASK_ID=stale-test-$RANDOM"
  )
  OUT="$(env "${env_args[@]}" bash "$AUDIT" 2>&1)"
  RC=$?
}

# make_sig <dir> <filename_no_ext> <task_id> <agent_str> <next_agent_str>
# Writes a minimal valid signature JSON to <dir>/<filename>.json
make_sig() {
  local dir="$1" fname="$2" tid="$3" agent="$4" next_agent="$5"
  jq -cn \
    --arg task_id "$tid" \
    --arg agent "$agent" \
    --arg next_agent "$next_agent" \
    '{
      "signature_schema_version": 2,
      "task_id": $task_id,
      "agent": $agent,
      "next_recipient": {"agent": $next_agent, "designation": "α-TST-00"},
      "started_at": "2026-06-10T00:00:00Z",
      "completed_at": "2026-06-10T01:00:00Z",
      "files_touched": [],
      "summary": "test fixture",
      "harness_passed": true
    }' > "$dir/${fname}.json"
}

note "================================================================"
note "audit-stale-handoffs · regression + adversarial test suite"
note "audit: $AUDIT"
note "sandbox: $TMPROOT"
note "================================================================"

# ---------------------------------------------------------------------------
# FIXTURE: STALE
# sig task=T1 from=Algol next_recipient=Sirius, NO T1--sirius.json present
# EXPECT: RESULT lines contain STALE for T1/Algol→Sirius; exit 0 (WARN-mode)
# ---------------------------------------------------------------------------
note ""
note "[STALE] T1 from=Algol next=Sirius, no pickup sig → expect STALE in report, exit 0"
D="$TMPROOT/stale"; mkdir -p "$D"
make_sig "$D" "T1--algol" "T1" "Algol" "Sirius"
run_audit "$D"
note "  RC=$RC"
if [[ "$RC" -eq 0 ]]; then
  ok "exit 0 (WARN-mode, findings non-blocking)"
else
  bad "expected exit 0 (WARN); got $RC"
fi
if grep -q 'status=STALE' <<<"$OUT" && grep -q 'task_id=T1' <<<"$OUT"; then
  ok "STALE line reported for T1 (deterministic grep)"
else
  bad "expected STALE line for T1; got: $(grep 'STALE\|T1' <<<"$OUT" || echo '(none)')"
fi
if grep -q 'from_agent=Algol' <<<"$OUT" && grep -q 'next_recipient=Sirius' <<<"$OUT"; then
  ok "from_agent and next_recipient fields present in STALE line"
else
  bad "from_agent/next_recipient missing in STALE output; got: $(grep 'from_agent\|next_recipient' <<<"$OUT" || echo '(none)')"
fi
STALE_OUT="$OUT"

# ---------------------------------------------------------------------------
# FIXTURE: PICKED-UP
# sig task=T2 from=Algol next=Sirius AND T2--sirius.json present
# EXPECT: NO stale line for T2; exit 0
# ---------------------------------------------------------------------------
note ""
note "[PICKED-UP] T2 from=Algol next=Sirius, T2--sirius.json present → expect NOT stale, exit 0"
D="$TMPROOT/pickedup"; mkdir -p "$D"
make_sig "$D" "T2--algol"  "T2" "Algol"  "Sirius"
make_sig "$D" "T2--sirius" "T2" "Sirius" "Polaris"
run_audit "$D"
note "  RC=$RC"
if [[ "$RC" -eq 0 ]]; then
  ok "exit 0"
else
  bad "expected exit 0; got $RC"
fi
if grep 'task_id=T2' <<<"$OUT" | grep -q 'status=STALE'; then
  bad "T2 appears as STALE (pickup not detected); output: $(grep 'T2' <<<"$OUT" || echo '(none)')"
else
  ok "T2 NOT flagged as stale (pickup confirmed)"
fi
# Deterministic backstop: T2 must not appear in any STALE line
if grep 'status=STALE' <<<"$OUT" | grep -q 'T2'; then
  bad "T2 found in a STALE line — pickup logic not working"
else
  ok "T2 absent from STALE lines (deterministic backstop)"
fi
PICKEDUP_OUT="$OUT"

# ---------------------------------------------------------------------------
# FIXTURE: POLARIS-TERMINAL
# sig task=T3 next=Polaris, no further sig
# EXPECT: NOT flagged stale (documented assumption); exit 0
# ---------------------------------------------------------------------------
note ""
note "[POLARIS-TERMINAL] T3 from=Canopus next=Polaris, no further sig → expect NOT stale (assumption), exit 0"
D="$TMPROOT/polaris"; mkdir -p "$D"
make_sig "$D" "T3--canopus" "T3" "Canopus" "Polaris"
run_audit "$D"
note "  RC=$RC"
if [[ "$RC" -eq 0 ]]; then
  ok "exit 0"
else
  bad "expected exit 0; got $RC"
fi
if grep 'status=STALE' <<<"$OUT" | grep -q 'T3'; then
  bad "T3 flagged as STALE — polaris-terminal assumption violated"
else
  ok "T3 NOT flagged stale (polaris assumption honored)"
fi
POLARIS_OUT="$OUT"

# ---------------------------------------------------------------------------
# FIXTURE: UNKNOWN_RECIPIENT
# sig task=T4 next=Nemesis (not in roster) → UNKNOWN_RECIPIENT (NOT STALE); exit 0
# ---------------------------------------------------------------------------
note ""
note "[UNKNOWN] T4 from=Algol next=Nemesis (not in roster) → expect UNKNOWN_RECIPIENT, NOT STALE, exit 0"
D="$TMPROOT/unknown"; mkdir -p "$D"
make_sig "$D" "T4--algol" "T4" "Algol" "Nemesis"
run_audit "$D"
note "  RC=$RC"
if [[ "$RC" -eq 0 ]]; then
  ok "exit 0 (WARN-mode)"
else
  bad "expected exit 0; got $RC"
fi
if grep -q 'status=UNKNOWN_RECIPIENT' <<<"$OUT" && grep -q 'task_id=T4' <<<"$OUT"; then
  ok "UNKNOWN_RECIPIENT line present for T4"
else
  bad "expected UNKNOWN_RECIPIENT for T4; got: $(grep 'T4\|UNKNOWN' <<<"$OUT" || echo '(none)')"
fi
# UNKNOWN must NOT appear as STALE
if grep 'status=STALE' <<<"$OUT" | grep -q 'T4'; then
  bad "T4 classified as STALE instead of UNKNOWN_RECIPIENT — distinct classification violated"
else
  ok "T4 is UNKNOWN_RECIPIENT (not STALE) — distinct classification"
fi
UNKNOWN_OUT="$OUT"

# ---------------------------------------------------------------------------
# FIXTURE: MALFORMED JSON
# A .json file that is not valid JSON → PARSE_ISSUE reported (non-silent); exit 0
# ---------------------------------------------------------------------------
note ""
note "[MALFORMED] non-JSON .json file → expect PARSE_ISSUE reported (non-silent), exit 0"
D="$TMPROOT/malformed"; mkdir -p "$D"
printf '{ this is not valid json at all <<< malformed }\n' > "$D/BAD-SIG--malformed.json"
run_audit "$D"
note "  RC=$RC"
# Spec: exit 0 (WARN) or 2 (internal) per chosen contract — assert it is non-silent
if [[ "$RC" -eq 0 ]] || [[ "$RC" -eq 2 ]]; then
  ok "exit $RC (non-zero-error only; non-silent)"
else
  bad "unexpected RC=$RC for malformed fixture"
fi
if grep -qiE 'PARSE_ISSUE|parse issue|PARSE' <<<"$OUT"; then
  ok "PARSE_ISSUE reported (non-silent)"
else
  bad "expected PARSE_ISSUE report for malformed JSON; got: $(printf '%s' "$OUT" | head -10)"
fi
MALFORMED_OUT="$OUT"

# ---------------------------------------------------------------------------
# FLIP-TO-FAIL doc present
# The script must contain either "flip-to-fail" or "promote to exit 1"
# ---------------------------------------------------------------------------
note ""
note "[FLIP-TO-FAIL] script header documents flip-to-fail condition"
if grep -qiE 'flip-to-fail|promote to exit 1' "$AUDIT"; then
  ok "flip-to-fail / 'promote to exit 1' found in script"
else
  bad "flip-to-fail doc missing in $AUDIT"
fi

# ---------------------------------------------------------------------------
# MUTATION GUARD
# Verify the pickup-evidence check is load-bearing:
# When we strip out the pickup-evidence block (simulate by a no-pickup variant),
# the PICKED-UP fixture should flip to STALE.
# We do this by checking a sandbox WITHOUT the T2--sirius.json pickup file —
# i.e., the STALE fixture is our mutation test (the same task, minus pickup sig).
# The STALE fixture (T1) already confirms that without pickup → STALE reported.
# The PICKED-UP fixture (T2) confirms that WITH pickup → NOT stale.
# The difference between them IS the pickup evidence. So the pair proves the
# pickup logic is load-bearing. We assert this explicitly:
# ---------------------------------------------------------------------------
note ""
note "[MUTATION GUARD] pickup logic load-bearing: stale-without-sig vs not-stale-with-sig"
# STALE_OUT must contain STALE for T1 (already asserted above)
# PICKEDUP_OUT must NOT contain STALE for T2 (already asserted above)
# Compare: the only structural difference is the presence of T2--sirius.json
STALE_FOR_T1="$(grep 'status=STALE' <<<"$STALE_OUT" | grep 'T1' || echo '')"
STALE_FOR_T2="$(grep 'status=STALE' <<<"$PICKEDUP_OUT" | grep 'T2' || echo '')"
if [[ -n "$STALE_FOR_T1" ]] && [[ -z "$STALE_FOR_T2" ]]; then
  ok "mutation guard: T1 (no pickup) = STALE; T2 (with pickup) = NOT stale → pickup logic is load-bearing"
else
  bad "mutation guard failed: T1_stale='$STALE_FOR_T1' T2_stale='$STALE_FOR_T2'"
fi

# ---------------------------------------------------------------------------
# ADDITIONAL: mixed fixture (STALE + POLARIS + PICKED-UP in same run)
# Verify counting and SUMMARY field
# ---------------------------------------------------------------------------
note ""
note "[MIXED] combined fixture: T5-stale, T6-polaris, T7-pickedup → stale=1, exit 0"
D="$TMPROOT/mixed"; mkdir -p "$D"
make_sig "$D" "T5--algol"       "T5" "Algol"    "Betelgeuse"   # stale (no T5--betelgeuse.json)
make_sig "$D" "T6--sirius"      "T6" "Sirius"   "Polaris"      # polaris-terminal (non-stale)
make_sig "$D" "T7--canopus"     "T7" "Canopus"  "Algol"        # from=canopus next=algol
make_sig "$D" "T7--algol"       "T7" "Algol"    "Polaris"      # algol picks up T7
run_audit "$D"
note "  RC=$RC"
if [[ "$RC" -eq 0 ]]; then
  ok "mixed fixture exit 0 (WARN-mode)"
else
  bad "expected exit 0; got $RC"
fi
if grep 'status=STALE' <<<"$OUT" | grep -q 'T5'; then
  ok "T5 correctly flagged STALE in mixed run"
else
  bad "T5 not flagged STALE in mixed run; stale lines: $(grep 'status=STALE' <<<"$OUT" || echo '(none)')"
fi
if grep 'status=STALE' <<<"$OUT" | grep -q 'T6\|T7'; then
  bad "T6 or T7 incorrectly flagged STALE in mixed run"
else
  ok "T6 (polaris) and T7 (picked-up) not flagged STALE"
fi
if grep -q 'stale=1' <<<"$OUT"; then
  ok "SUMMARY stale=1 (correct count)"
else
  bad "expected stale=1 in SUMMARY; got: $(grep 'stale=' <<<"$OUT" || echo '(none)')"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
note ""
note "================================================================"
note "RESULTS · PASS=$PASS FAIL=$FAIL"
note "================================================================"

[[ "$FAIL" -eq 0 ]] && exit 0 || exit 1
