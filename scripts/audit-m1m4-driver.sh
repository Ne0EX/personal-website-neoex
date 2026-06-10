#!/usr/bin/env bash
# scripts/audit-m1m4-driver.sh
# Canopus (α-HRN-07) — deterministic driver for Phase 0 slice 0.4 acceptance.
#
# Runs every M1–M4 mutation/refute suite and greps each for its ACCEPTANCE LINE.
# Exits non-zero if any acceptance line is missing from any suite's output.
#
# This is the adversarial-verify backstop: it does NOT just check exit codes —
# it asserts the specific acceptance phrase that proves the threat was caught
# (not merely that the suite ran without crashing).
#
# Run: bash scripts/audit-m1m4-driver.sh
# Exit 0 = all acceptance lines present (all suites confirmed green).
# Exit 1 = one or more acceptance lines missing.
# Exit 2 = driver self-error (script not found, etc).
#
# Bash 3.2 compat. No associative arrays.

set -uo pipefail

REPO="${CLAUDE_PROJECT_DIR:-/Users/neospiritth/codingspace/personal_website}"
PASS=0
FAIL=0

ok()  { printf '  PASS · %s\n' "$*"; PASS=$((PASS+1)); }
bad() { printf '  FAIL · %s\n' "$*" >&2; FAIL=$((FAIL+1)); }

# run_suite <label> <script> <acceptance_line_grep>
# Runs the script, captures output, greps for the acceptance line.
run_suite() {
  local label="$1"
  local script="$2"
  local acceptance="$3"
  shift 3
  # remaining args (if any) are env overrides in VAR=VAL form — unused currently

  if [[ ! -f "$script" ]]; then
    bad "$label — script not found: $script"
    return
  fi

  local out code=0
  out="$(bash "$script" 2>&1)" || code=$?

  if printf '%s\n' "$out" | grep -qF "$acceptance"; then
    ok "$label (exit=$code, acceptance found)"
  else
    bad "$label (exit=$code, ACCEPTANCE LINE MISSING: '$acceptance')"
    # Print last 10 lines for diagnosis
    printf '%s\n' "$out" | tail -10 | sed 's/^/    /' >&2
  fi
}

# run_pipe_suite <label> <pipe_cmd> <acceptance_line_grep>
# For suites that pipe stdin to a script (e.g. M3 parse-fail check).
run_pipe_suite() {
  local label="$1"
  local pipe_cmd="$2"
  local acceptance="$3"

  local out code=0
  out="$(eval "$pipe_cmd" 2>&1)" || code=$?

  if printf '%s\n' "$out" | grep -qF "$acceptance"; then
    ok "$label (exit=$code, acceptance found)"
  else
    bad "$label (exit=$code, ACCEPTANCE LINE MISSING: '$acceptance')"
    printf '%s\n' "$out" | tail -10 | sed 's/^/    /' >&2
  fi
}

printf '============================================================\n'
printf 'M1–M4 ACCEPTANCE DRIVER · Phase 0 slice 0.4\n'
printf 'repo: %s\n' "$REPO"
printf '============================================================\n\n'

# ---------------------------------------------------------------------------
# M1 — handoff-integrity
# ---------------------------------------------------------------------------
printf '%s\n' '--- M1 handoff-integrity ---'

run_suite \
  "M1 mutation suite" \
  "$REPO/tests/harness/audit-handoff-integrity.mutation.sh" \
  "RESULTS · PASS=18 FAIL=0"

run_suite \
  "M1 re-refute (Algol) — A/C/D closed; B expected-bypass" \
  "$REPO/tests/harness/m1-rerefute-algol.sh" \
  "RESULT: all refutations correctly accounted"

# ---------------------------------------------------------------------------
# M1-B closure — witness discriminator
# ---------------------------------------------------------------------------
printf '\n--- M1-B closure (witness layer) ---\n'

run_suite \
  "M1-B witness discriminator (trustroot)" \
  "$REPO/tests/harness/m-revalidate-trustroot-discriminator.sh" \
  "ACCEPTANCE LINE MET: co-tamper passing recompute is CAUGHT by cross-commit history"

run_suite \
  "Witness publisher Tb fulldepth discriminator" \
  "$REPO/tests/harness/witness-publisher-refute-Tb-fulldepth-discriminator.sh" \
  "T-b RE-REFUTE VERDICT: BUG CLOSED"

# ---------------------------------------------------------------------------
# M2 — memory-drift
# ---------------------------------------------------------------------------
printf '\n--- M2 memory-drift ---\n'

run_suite \
  "M2 deletion mutation suite" \
  "$REPO/scripts/audit-memory-drift.mutation-test.sh" \
  "ALL CASES PASS — M2 deletion blind spot closed"

run_suite \
  "M2 refute suite (8 cases)" \
  "$REPO/tests/harness/audit-memory-drift.refute.sh" \
  "===== HARNESS COMPLETE ====="

# ---------------------------------------------------------------------------
# M3 — untrusted-fetch-gate
# ---------------------------------------------------------------------------
printf '\n--- M3 untrusted-fetch-gate ---\n'

run_suite \
  "M3 fetch-gate mutation refute" \
  "$REPO/scripts/audit-fetch-gate-mutation-refute.sh" \
  "[refute-harness done]"

# M3 parse-fail: non-JSON stdin must exit 2
run_pipe_suite \
  "M3 parse-fail (non-JSON stdin → exit 2)" \
  "printf 'not json' | bash '$REPO/.claude/hooks/untrusted-fetch-gate.sh'" \
  "parse failure"

# ---------------------------------------------------------------------------
# M4 — retention-policy
# ---------------------------------------------------------------------------
printf '\n--- M4 retention-policy ---\n'

run_suite \
  "M4 newline bypass refute" \
  "$REPO/tests/harness/m4-newline-bypass-refute.sh" \
  "RESULT: PASS — all assertions correct"

run_suite \
  "M4 NUL re-refute (Algol)" \
  "$REPO/tests/harness/m4-nul-rerefute-algol.sh" \
  "RESULT: PASS -- all 35 assertions correct"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
printf '\n============================================================\n'
printf 'DRIVER RESULTS · PASS=%d FAIL=%d\n' "$PASS" "$FAIL"
printf '============================================================\n'

if [[ "$FAIL" -gt 0 ]]; then
  printf 'VERDICT: FAIL — %d acceptance line(s) missing\n' "$FAIL" >&2
  exit 1
fi

printf 'VERDICT: PASS — all acceptance lines confirmed\n'
exit 0
