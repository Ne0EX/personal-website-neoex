#!/usr/bin/env bash
# tests/harness/sign-work-steps-validation.test.sh
#
# DEBT-1 regression: sign-work.sh steps validation (SCHEMA-FAIL-STEPS fix).
#
# Prior behaviour: absent steps log → steps:[] emitted, only advisory NOTE.
# Fixed behaviour (go-forward):
#   no steps source → BLOCKED (exit 8), no signature written.
#   WL_STEPS env var → steps captured, signature produced.
#   WL_REQUIRE_STEPS=0 (back-out lever) → WARNING only, not blocked.
#
# CASES:
#   CASE-BLOCK   no steps source → exit 8, SCHEMA-FAIL + BLOCKED in output
#   CASE-WL_STEPS WL_STEPS env → signature produced, steps non-empty
#   CASE-BACKOUT WL_REQUIRE_STEPS=0 → not blocked, WARNING emitted
#
# SAFETY:
#   Each case uses a unique probe task_id (with $$ suffix) that cannot collide
#   with real task IDs (real IDs are TASK-YYYY-MM-DD-NN form).
#   The fake hook-log files written are cleaned up on exit via trap.
#   .claude/signatures/ probe files are removed after each case.
#   The real repo's .claude/hook-logs/ dir is used (sign-work.sh is cwd-relative)
#   but only files with the unique probe task_id are touched.
#
# Run: bash tests/harness/sign-work-steps-validation.test.sh
# Exit 0 iff all assertions hold.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOK="$REPO_DIR/.claude/hooks/sign-work.sh"

if [[ ! -f "$HOOK" ]]; then
  printf 'FATAL: sign-work.sh not found at %s\n' "$HOOK" >&2
  exit 2
fi

# Unique prefix that cannot collide with real task IDs
TID_BASE="PROBE-SW-STEPS-$$"

# Fake log paths — written below and cleaned on exit
LOG_DIR="$REPO_DIR/.claude/hook-logs"
mkdir -p "$LOG_DIR"

# Collect probe files to clean on exit
PROBE_FILES=()
cleanup() {
  for f in "${PROBE_FILES[@]+"${PROBE_FILES[@]}"}"; do
    rm -f "$f" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

PASS=0
FAIL=0
note() { printf '%s\n' "$*"; }
ok()   { PASS=$((PASS+1)); printf '  PASS · %s\n' "$*"; }
bad()  { FAIL=$((FAIL+1)); printf '  FAIL · %s\n' "$*"; }

# Helper: create fake harness log (passing) and post-edit log (passing) for a task id
# so sign-work doesn't abort on those earlier checks before reaching steps validation.
make_logs() {
  local tid="$1"
  local harness_log="$LOG_DIR/${tid}--harness.log"
  local post_edit_log="$LOG_DIR/${tid}--post-edit.log"
  printf '[harness-check] PASS — all rails green\n' > "$harness_log"
  printf 'post-edit: PASS lint=ok tsc=ok build=ok\n' > "$post_edit_log"
  PROBE_FILES+=("$harness_log" "$post_edit_log")
}

# Helper: run sign-work for a given task id from the repo root.
# Additional env vars passed as key=value args after task_id.
run_sign_work() {
  local task_id="$1"; shift
  # sign-work.sh must run from repo root (it uses relative paths for git).
  # Use a temp file to capture combined output; capture exit code separately
  # (subshell assignment `OUT=$(...)` swallows the exit code on some bash versions).
  local _out_file
  _out_file="$(mktemp)"
  (cd "$REPO_DIR" && env \
    HARNESS_REPO_ROOT="$REPO_DIR" \
    WL_AGENT=canopus \
    WL_NEXT=polaris \
    WL_SUMMARY="probe-test-steps-regression" \
    "$@" \
    bash "$HOOK" "$task_id") > "$_out_file" 2>&1
  RC=$?
  OUT="$(cat "$_out_file")"
  rm -f "$_out_file"
}

note "=============================================================="
note "sign-work-steps-validation · DEBT-1 regression test suite"
note "hook: $HOOK"
note "=============================================================="

# ---------------------------------------------------------------------------
# CASE-BLOCK: no steps source → must exit 8 (BLOCKED), SCHEMA-FAIL message
# ---------------------------------------------------------------------------
note ""
note "[CASE-BLOCK] no steps source → expect exit 8 (BLOCKED)"
TID_BLOCK="${TID_BASE}-BLOCK"
make_logs "$TID_BLOCK"
run_sign_work "$TID_BLOCK"
SIG_BLOCK="$REPO_DIR/.claude/signatures/${TID_BLOCK}--canopus.json"
PROBE_FILES+=("$SIG_BLOCK")

note "    RC=$RC"
note "$(printf '%s\n' "$OUT" | grep -E 'SCHEMA-FAIL|BLOCKED|steps' | head -5 | sed 's/^/    /')"

if [[ "$RC" -eq 8 ]]; then
  ok "CASE-BLOCK: exit 8 (BLOCKED)"
else
  bad "CASE-BLOCK: expected exit 8; got RC=$RC. Output: $(printf '%s\n' "$OUT" | tail -5)"
fi
if printf '%s\n' "$OUT" | grep -q 'SCHEMA-FAIL'; then
  ok "CASE-BLOCK: SCHEMA-FAIL message present"
else
  bad "CASE-BLOCK: expected SCHEMA-FAIL in output"
fi
if printf '%s\n' "$OUT" | grep -q 'BLOCKED'; then
  ok "CASE-BLOCK: BLOCKED message present"
else
  bad "CASE-BLOCK: expected BLOCKED message"
fi
# No signature should be written
if [[ ! -f "$SIG_BLOCK" ]]; then
  ok "CASE-BLOCK: no signature file written (correct — blocked)"
else
  bad "CASE-BLOCK: signature file was written despite BLOCK — this is a false-green"
  rm -f "$SIG_BLOCK"
fi

# ---------------------------------------------------------------------------
# CASE-WL_STEPS: WL_STEPS env var → signature produced, steps non-empty
# ---------------------------------------------------------------------------
note ""
note "[CASE-WL_STEPS] WL_STEPS env var → signature produced with non-empty steps"
TID_WL="${TID_BASE}-WL"
make_logs "$TID_WL"
run_sign_work "$TID_WL" "WL_STEPS=read SCHEMA.md
ran sign-work.sh"
SIG_WL="$REPO_DIR/.claude/signatures/${TID_WL}--canopus.json"
PROBE_FILES+=("$SIG_WL")

note "    RC=$RC"

# Accepts exit 0 (clean pass) or exit 4 (flagged but not BLOCKED)
if [[ "$RC" -eq 0 ]] || [[ "$RC" -eq 4 ]]; then
  ok "CASE-WL_STEPS: not blocked (exit $RC)"
else
  bad "CASE-WL_STEPS: expected exit 0 or 4; got RC=$RC. Output: $(printf '%s\n' "$OUT" | tail -5)"
fi
if [[ -f "$SIG_WL" ]]; then
  STEPS_COUNT=$(jq '.steps | length' "$SIG_WL" 2>/dev/null || echo 0)
  if [[ "$STEPS_COUNT" -ge 1 ]]; then
    ok "CASE-WL_STEPS: signature steps non-empty ($STEPS_COUNT step(s))"
  else
    bad "CASE-WL_STEPS: signature has 0 steps — SCHEMA-FAIL-STEPS not fixed"
  fi
  FIRST_STEP=$(jq -r '.steps[0]' "$SIG_WL" 2>/dev/null || echo "")
  if [[ "$FIRST_STEP" == "read SCHEMA.md" ]]; then
    ok "CASE-WL_STEPS: first step value matches WL_STEPS input"
  else
    bad "CASE-WL_STEPS: first step expected 'read SCHEMA.md'; got '$FIRST_STEP'"
  fi
else
  bad "CASE-WL_STEPS: signature file not written at $SIG_WL"
fi

# ---------------------------------------------------------------------------
# CASE-BACKOUT: WL_REQUIRE_STEPS=0 back-out lever → WARNING only, not blocked
# ---------------------------------------------------------------------------
note ""
note "[CASE-BACKOUT] WL_REQUIRE_STEPS=0 → WARNING emitted, not blocked (exit != 8)"
TID_BO="${TID_BASE}-BO"
make_logs "$TID_BO"
run_sign_work "$TID_BO" WL_REQUIRE_STEPS=0
SIG_BO="$REPO_DIR/.claude/signatures/${TID_BO}--canopus.json"
PROBE_FILES+=("$SIG_BO")

note "    RC=$RC"

if [[ "$RC" -ne 8 ]]; then
  ok "CASE-BACKOUT: not blocked (exit $RC — back-out lever worked)"
else
  bad "CASE-BACKOUT: exit 8 — WL_REQUIRE_STEPS=0 did not prevent block"
fi
if printf '%s\n' "$OUT" | grep -qiE 'WL_REQUIRE_STEPS=0|downgrading.*WARNING|WARNING.*steps'; then
  ok "CASE-BACKOUT: WARNING message for empty steps present"
else
  bad "CASE-BACKOUT: expected WARNING about empty steps; got: $(printf '%s\n' "$OUT" | grep -i 'warn\|steps' | head -3)"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
note ""
note "=============================================================="
note "RESULTS · PASS=$PASS FAIL=$FAIL"
note "=============================================================="

[[ "$FAIL" -eq 0 ]] && exit 0 || exit 1
