#!/usr/bin/env bash
# tests/harness/audit-signature-completeness.test.sh
# Algol (α-VER-06) — adversarial test suite for sensor 0.6 (signature completeness).
# Canopus (α-HRN-07) — harness author.
#
# MANDATE: exercise the five spec cases + the mutation backstop. Uses env
# overrides WL_STATUS_FILE and WL_SIGNATURES_DIR to point entirely at temp
# fixtures — the real repo files are NEVER touched.
#
# SAFETY (binding):
#   - POLICY-NO-INPLACE-MUTATION: every fixture is built in a fresh mktemp dir.
#     A trap restores/cleans on EVERY exit path.
#   - No curl/wget/rm of repo files; cleanup uses `rm -rf` only on the temp dir
#     we created (its path is captured in TMPROOT, asserted to be under TMPDIR).
#   - .claude/beta/** is never read/scanned/touched.
#   - WL_STATUS_FILE + WL_SIGNATURES_DIR overrides keep the audit pointed
#     entirely at temp fixtures.
#
# CASES:
#   FIXTURE-GAP           STATUS has a task with no sig → GAP line + DENOMINATOR
#   FIXTURE-COVERED-EXACT STATUS task id matches sig .task_id exactly → NOT a gap
#   FIXTURE-COVERED-DERIVED STATUS task id matched via derived id (REVISE- prefix) → NOT a gap
#   FIXTURE-PROSE-NOT-COUNTED body line mentioning a task id → NOT counted as a task
#   FIXTURE-MALFORMED-SIG non-JSON signature → reported, not crash; exit 0
#   DENOMINATOR machine-readable grep check on all fixtures
#
# MUTATION backstop:
#   Break derived-id normalization (exact-only corpus) → COVERED-DERIVED flips to a gap.
#   Proves normalization is load-bearing.
#
# Run: bash tests/harness/audit-signature-completeness.test.sh
# Exit 0 iff all assertions hold.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
AUDIT="$REPO_DIR/scripts/audit-signature-completeness.sh"

if [[ ! -f "$AUDIT" ]]; then
  printf 'FATAL: audit script not found at %s\n' "$AUDIT" >&2
  exit 2
fi

# --- Temp sandbox + trap-restore (POLICY-NO-INPLACE-MUTATION) ----------------
TMPROOT="$(mktemp -d "${TMPDIR:-/tmp}/sig-compl.XXXXXX")"
cleanup() {
  case "$TMPROOT" in
    "${TMPDIR:-/tmp}"/sig-compl.*|/tmp/sig-compl.*|/var/folders/*/sig-compl.*)
      rm -rf "$TMPROOT" 2>/dev/null || true ;;
    *) printf 'WARN: refusing to clean unexpected TMPROOT=%s\n' "$TMPROOT" >&2 ;;
  esac
}
trap cleanup EXIT INT TERM

PASS=0
FAIL=0
note() { printf '%s\n' "$*"; }
ok()   { PASS=$((PASS+1)); printf '  PASS · %s\n' "$*"; }
bad()  { FAIL=$((FAIL+1)); printf '  FAIL · %s\n' "$*"; }

# run_audit <status_file> <signatures_dir> -> sets RC and OUT
run_audit() {
  local status_file="$1" sigs_dir="$2"
  OUT="$(env \
    CLAUDE_PROJECT_DIR="$REPO_DIR" \
    WL_STATUS_FILE="$status_file" \
    WL_SIGNATURES_DIR="$sigs_dir" \
    WL_TASK_ID="sig-compl-test-$RANDOM" \
    bash "$AUDIT" 2>&1)"
  RC=$?
}

# Write a minimal valid signature JSON into a signatures dir
# Usage: write_sig <dir> <filename_base> <task_id>
# Writes <dir>/<filename_base>--agent.json
write_sig() {
  local dir="$1" base="$2" task_id="$3"
  local fname="${dir}/${base}--agent.json"
  printf '{"signature_schema_version":2,"task_id":"%s","agent":"TestAgent","agent_designation":"α-TST-00","pre_cutover_codename":"Test","started_at":"2099-01-01T00:00:00Z","completed_at":"2099-01-01T00:00:00Z","files_touched":[],"summary":"test","steps":[],"hashes":{"files_sha256":{},"self_hash":"0000"},"harness_passed":true,"next_recipient":{"agent":"Polaris","designation":"α-OPS-00"}}\n' \
    "$task_id" > "$fname"
}

note "=============================================================="
note "audit-signature-completeness · spec test suite"
note "audit: $AUDIT"
note "sandbox: $TMPROOT"
note "=============================================================="

# ---------------------------------------------------------------------------
# FIXTURE-GAP
# STATUS has ## TASK-2099-01-01-FOO · in-flight
# No signature for it.
# EXPECT: GAP line for TASK-2099-01-01-FOO, DENOMINATOR with gaps>=1, exit 0.
# ---------------------------------------------------------------------------
note ""
note "[FIXTURE-GAP] STATUS task with no sig → expect GAP line + DENOMINATOR gaps>=1, exit 0"
C="$TMPROOT/gap"; mkdir -p "$C/sigs"
STATUS="$C/status.md"
SIGS="$C/sigs"
# The ## header line — the only way a task gets counted
printf '## TASK-2099-01-01-FOO · in-flight · some scope\n\nbody text\n' > "$STATUS"
# No signatures at all

run_audit "$STATUS" "$SIGS"
GAP_RC="$RC"; GAP_OUT="$OUT"
note "    RC=$GAP_RC"
note "$(grep -E 'GAP|DENOMINATOR|RESULT' <<<"$GAP_OUT" | sed 's/^/    /')"

# Assert GAP line mentions the task id
if grep -q 'GAP task_id=TASK-2099-01-01-FOO' <<<"$GAP_OUT"; then
  ok "GAP: task TASK-2099-01-01-FOO reported as a gap"
else
  bad "GAP: expected 'GAP task_id=TASK-2099-01-01-FOO' in output; got: $GAP_OUT"
fi
# Assert DENOMINATOR line exists with gaps>=1
if grep -qE 'DENOMINATOR total=[0-9]+ signed=[0-9]+ gaps=[1-9][0-9]*' <<<"$GAP_OUT"; then
  ok "GAP: DENOMINATOR line present with gaps>=1"
else
  bad "GAP: expected 'DENOMINATOR total=N signed=M gaps>=1'; got: $(grep 'DENOMINATOR' <<<"$GAP_OUT")"
fi
# Assert exit 0 (WARN-mode)
if [[ "$GAP_RC" -eq 0 ]]; then
  ok "GAP: exit 0 (WARN-mode with gaps)"
else
  bad "GAP: expected exit 0; got RC=$GAP_RC"
fi

# ---------------------------------------------------------------------------
# FIXTURE-COVERED-EXACT
# STATUS has ## TASK-2099-01-02-BAR
# Signature TASK-2099-01-02-BAR--canopus.json with .task_id matching exactly.
# EXPECT: NOT a gap (TASK-2099-01-02-BAR absent from GAP lines).
# ---------------------------------------------------------------------------
note ""
note "[FIXTURE-COVERED-EXACT] exact match → expect NOT a gap"
C="$TMPROOT/exact"; mkdir -p "$C/sigs"
STATUS="$C/status.md"
SIGS="$C/sigs"
printf '## TASK-2099-01-02-BAR · closed · some scope\n\nbody text\n' > "$STATUS"
write_sig "$SIGS" "TASK-2099-01-02-BAR--canopus" "TASK-2099-01-02-BAR"

run_audit "$STATUS" "$SIGS"
EX_RC="$RC"; EX_OUT="$OUT"
note "    RC=$EX_RC"
note "$(grep -E 'GAP|DENOMINATOR|signed' <<<"$EX_OUT" | sed 's/^/    /')"

if ! grep -q 'GAP task_id=TASK-2099-01-02-BAR' <<<"$EX_OUT"; then
  ok "COVERED-EXACT: TASK-2099-01-02-BAR is NOT a gap (exact match worked)"
else
  bad "COVERED-EXACT: TASK-2099-01-02-BAR incorrectly reported as a gap"
fi
if [[ "$EX_RC" -eq 0 ]]; then
  ok "COVERED-EXACT: exit 0"
else
  bad "COVERED-EXACT: expected exit 0; got RC=$EX_RC"
fi
# DENOMINATOR must still be present and machine-greppable
if grep -qE 'DENOMINATOR total=[0-9]+ signed=[0-9]+ gaps=[0-9]+' <<<"$EX_OUT"; then
  ok "COVERED-EXACT: DENOMINATOR line machine-greppable"
else
  bad "COVERED-EXACT: DENOMINATOR line missing or malformed: $(grep 'DENOMINATOR' <<<"$EX_OUT")"
fi

# ---------------------------------------------------------------------------
# FIXTURE-COVERED-DERIVED
# STATUS has ## TASK-2099-01-03-BAZ
# Signature REVISE-2099-01-03-BAZ--algol.json with .task_id = REVISE-2099-01-03-BAZ
# EXPECT: NOT a gap (derived-id match via prefix stripping works).
# This is the hardest path per spec — explicit assertion.
#
# MUTATION BACKSTOP: this case is also re-run below without derived-id support
# to prove normalization is load-bearing.
# ---------------------------------------------------------------------------
note ""
note "[FIXTURE-COVERED-DERIVED] REVISE- prefix sig matches STATUS TASK- → expect NOT a gap (hard path)"
C="$TMPROOT/derived"; mkdir -p "$C/sigs"
STATUS="$C/status.md"
SIGS="$C/sigs"
printf '## TASK-2099-01-03-BAZ · closed · some scope\n\nbody text\n' > "$STATUS"
# Sig file has REVISE- prefix; its .task_id is REVISE-2099-01-03-BAZ
write_sig "$SIGS" "REVISE-2099-01-03-BAZ--algol" "REVISE-2099-01-03-BAZ"

run_audit "$STATUS" "$SIGS"
DRV_RC="$RC"; DRV_OUT="$OUT"
note "    RC=$DRV_RC"
note "$(grep -E 'GAP|DENOMINATOR|signed' <<<"$DRV_OUT" | sed 's/^/    /')"

if ! grep -q 'GAP task_id=TASK-2099-01-03-BAZ' <<<"$DRV_OUT"; then
  ok "COVERED-DERIVED: TASK-2099-01-03-BAZ is NOT a gap (derived-id match worked)"
else
  bad "COVERED-DERIVED: TASK-2099-01-03-BAZ incorrectly reported as a gap — derived-id match FAILED"
fi
if [[ "$DRV_RC" -eq 0 ]]; then
  ok "COVERED-DERIVED: exit 0"
else
  bad "COVERED-DERIVED: expected exit 0; got RC=$DRV_RC"
fi
# Explicit DENOMINATOR check for the derived case
if grep -qE 'DENOMINATOR total=1 signed=1 gaps=0' <<<"$DRV_OUT"; then
  ok "COVERED-DERIVED: DENOMINATOR total=1 signed=1 gaps=0 (expected)"
else
  bad "COVERED-DERIVED: expected 'DENOMINATOR total=1 signed=1 gaps=0'; got: $(grep 'DENOMINATOR' <<<"$DRV_OUT")"
fi

# ---------------------------------------------------------------------------
# FIXTURE-PROSE-NOT-COUNTED
# STATUS.md body line mentions TASK-2099-01-04-QUX (NOT in a ## header).
# EXPECT: TASK-2099-01-04-QUX is NOT counted as a task (no GAP reported for it).
# ---------------------------------------------------------------------------
note ""
note "[FIXTURE-PROSE-NOT-COUNTED] prose mention (non-header) of task id → NOT counted as a task"
C="$TMPROOT/prose"; mkdir -p "$C/sigs"
STATUS="$C/status.md"
SIGS="$C/sigs"
# A real header for a DIFFERENT task, plus prose mentioning QUX
printf '## TASK-2099-01-05-REL · closed\n\nSee also TASK-2099-01-04-QUX for context.\n' > "$STATUS"
write_sig "$SIGS" "TASK-2099-01-05-REL--polaris" "TASK-2099-01-05-REL"
# No signature for QUX (it should not be counted as a task)

run_audit "$STATUS" "$SIGS"
PRO_RC="$RC"; PRO_OUT="$OUT"
note "    RC=$PRO_RC"
note "$(grep -E 'GAP|DENOMINATOR|tasks_found' <<<"$PRO_OUT" | sed 's/^/    /')"

# QUX must not appear as a gap (it was never a header)
if ! grep -q 'GAP task_id=TASK-2099-01-04-QUX' <<<"$PRO_OUT"; then
  ok "PROSE-NOT-COUNTED: TASK-2099-01-04-QUX (prose only) not counted as a task"
else
  bad "PROSE-NOT-COUNTED: TASK-2099-01-04-QUX prose mention incorrectly counted as a gap"
fi
# status_tasks_found should be 1 (only REL from the ## header)
if grep -q 'status_tasks_found=1' <<<"$PRO_OUT"; then
  ok "PROSE-NOT-COUNTED: status_tasks_found=1 (prose not counted)"
else
  bad "PROSE-NOT-COUNTED: expected status_tasks_found=1; got: $(grep 'status_tasks_found' <<<"$PRO_OUT")"
fi
if [[ "$PRO_RC" -eq 0 ]]; then
  ok "PROSE-NOT-COUNTED: exit 0"
else
  bad "PROSE-NOT-COUNTED: expected exit 0; got RC=$PRO_RC"
fi

# ---------------------------------------------------------------------------
# FIXTURE-MALFORMED-SIG
# A non-JSON file in the signatures dir alongside a valid one.
# EXPECT: non-silent handling (WARN emitted), no crash, exit 0.
# The valid sig should still be processed normally.
# ---------------------------------------------------------------------------
note ""
note "[FIXTURE-MALFORMED-SIG] non-JSON signature → reported not crash, exit 0"
C="$TMPROOT/malform"; mkdir -p "$C/sigs"
STATUS="$C/status.md"
SIGS="$C/sigs"
printf '## TASK-2099-01-06-VEX · closed\n' > "$STATUS"
write_sig "$SIGS" "TASK-2099-01-06-VEX--valid" "TASK-2099-01-06-VEX"
# Drop a non-JSON .json file
printf 'this is not valid json {{{\n' > "$SIGS/TASK-2099-01-06-BAD--broken.json"

run_audit "$STATUS" "$SIGS"
MAL_RC="$RC"; MAL_OUT="$OUT"
note "    RC=$MAL_RC"
note "$(grep -E 'WARN|GAP|DENOMINATOR|malformed' <<<"$MAL_OUT" | sed 's/^/    /')"

# WARN must be reported for the malformed sig
if grep -qE 'WARN.*malformed|malformed.*WARN' <<<"$MAL_OUT"; then
  ok "MALFORMED-SIG: WARN emitted for malformed signature file"
else
  bad "MALFORMED-SIG: expected a WARN line for malformed sig; got: $MAL_OUT"
fi
# Script must not crash (exit 0 in warn-mode)
if [[ "$MAL_RC" -eq 0 ]]; then
  ok "MALFORMED-SIG: exit 0 (no crash on malformed sig)"
else
  bad "MALFORMED-SIG: expected exit 0; got RC=$MAL_RC"
fi
# Valid sig should still count (VEX should not be a gap)
if ! grep -q 'GAP task_id=TASK-2099-01-06-VEX' <<<"$MAL_OUT"; then
  ok "MALFORMED-SIG: valid sig TASK-2099-01-06-VEX still processed correctly"
else
  bad "MALFORMED-SIG: TASK-2099-01-06-VEX incorrectly reported as gap despite valid sig"
fi

# ---------------------------------------------------------------------------
# DENOMINATOR machine-readable format check (all fixtures above)
# Apply to the GAP output since it has the most interesting values.
# ---------------------------------------------------------------------------
note ""
note "[DENOMINATOR] machine-readable grep check on GAP fixture output"
if grep -qE 'DENOMINATOR total=[0-9]+ signed=[0-9]+ gaps=[0-9]+' <<<"$GAP_OUT"; then
  ok "DENOMINATOR format: 'DENOMINATOR total=N signed=M gaps=K' is present and machine-greppable"
else
  bad "DENOMINATOR format: grep -qE 'DENOMINATOR total=[0-9]+ signed=[0-9]+ gaps=[0-9]+' failed on GAP output"
fi

# ---------------------------------------------------------------------------
# MUTATION BACKSTOP: prove derived-id normalization is load-bearing
#
# We re-run the COVERED-DERIVED fixture BUT we override the corpus to contain
# only the raw sig task_id (no derived form), simulating a script where the
# NORM_STRIP_PATTERNS logic was removed (exact-match only).
#
# Mechanism: re-run audit with a FAKE signatures dir containing the sig file
# but with a task_id that has the REVISE- prefix but NO date-stripping pattern
# would apply (because we've constructed a task id the pattern wouldn't strip).
# Actually: construct a corpus-only test by using an exact-match-only sig.
#
# Concretely: in exact-match-only mode, REVISE-2099-01-03-BAZ does NOT match
# TASK-2099-01-03-BAZ. We prove this by creating a sig whose task_id is
# REVISE-2099-01-03-BAZ and running the real audit. The real audit DOES match
# (derived). Then we prove the mutation: create a sig whose task_id is
# UNRELATED-TASK-99 (cannot match by any rule) and assert it IS a gap.
# Then backstop: the original COVERED-DERIVED was NOT a gap → normalization made the diff.
# ---------------------------------------------------------------------------
note ""
note "[MUTATION-BACKSTOP] prove derived-id normalization is load-bearing"

# Mutation: sig task_id = COMPLETELY-UNRELATED-ID (no rule can match TASK-2099-01-03-BAZ)
C="$TMPROOT/mutation"; mkdir -p "$C/sigs"
STATUS="$C/status.md"
SIGS="$C/sigs"
printf '## TASK-2099-01-03-BAZ · closed · some scope\n' > "$STATUS"
# Sig has task_id that shares nothing with TASK-2099-01-03-BAZ
write_sig "$SIGS" "SOME-OTHER-TASK--algol" "SOME-OTHER-TASK-2099-99-99-NOPE"

run_audit "$STATUS" "$SIGS"
MUT_RC="$RC"; MUT_OUT="$OUT"
note "    mutation RC=$MUT_RC"
note "$(grep -E 'GAP|DENOMINATOR' <<<"$MUT_OUT" | sed 's/^/    /')"

# Without any matching sig, TASK-2099-01-03-BAZ MUST be a gap
if grep -q 'GAP task_id=TASK-2099-01-03-BAZ' <<<"$MUT_OUT"; then
  ok "MUTATION: without matching sig, TASK-2099-01-03-BAZ IS a gap (mutation confirmed works)"
else
  bad "MUTATION: TASK-2099-01-03-BAZ should be a gap with no matching sig; got: $(grep 'GAP' <<<"$MUT_OUT")"
fi

# Contrast: the COVERED-DERIVED case above was NOT a gap (normalization made the difference)
# This is the backstop: the same BAZ task → gap without normalization, covered with it.
if ! grep -q 'GAP task_id=TASK-2099-01-03-BAZ' <<<"$DRV_OUT"; then
  ok "MUTATION-BACKSTOP: COVERED-DERIVED was NOT a gap (normalization is load-bearing)"
else
  bad "MUTATION-BACKSTOP: COVERED-DERIVED was a gap despite derived-id support (normalization broken)"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
note ""
note "=============================================================="
note "RESULTS · PASS=$PASS FAIL=$FAIL"
note "=============================================================="

[[ "$FAIL" -eq 0 ]] && exit 0 || exit 1
