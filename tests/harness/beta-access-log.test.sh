#!/usr/bin/env bash
# tests/harness/beta-access-log.test.ts
# Regression test: C5 · access-log-beta.sh
#
# Coverage:
#   (a) ALLOW event (Mode A piped) → line appended with OK verdict
#   (b) UNAUTHORIZED event (Mode A piped) → line appended with "UNAUTHORIZED ⚠" marker
#   (c) ALLOW event (Mode B explicit args) → line appended with OK verdict
#   (d) UNAUTHORIZED event (Mode B explicit args) → line appended correctly
#   (e) entry format matches spec: <timestamp> · <agent> · <OP> · <path> · grant#<id> · <task-id> · <verdict>
#   (f) append-only invariant — existing lines not modified
#   (g) missing ACCESS-LOG.md → file created with header
#   (h) log write failure → exits 0 with stderr warning (fail-soft)
#   (i) invalid usage (no args, no stdin) → exits 0 with stderr warning
#
# Usage:
#   bash tests/harness/beta-access-log.test.ts
#
# Exit codes:
#   0 — all scenarios passed
#   1 — one or more scenarios failed

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOK="$REPO_ROOT/.claude/hooks/access-log-beta.sh"

PASS=0
FAIL=0

pass() { printf '[PASS] %s\n' "$1"; PASS=$((PASS+1)); }
fail() { printf '[FAIL] %s\n' "$1"; FAIL=$((FAIL+1)); }

if [[ ! -f "$HOOK" ]]; then
  printf 'FATAL: hook not found at %s\n' "$HOOK" >&2
  exit 1
fi

TMPDIR_RUN="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_RUN"' EXIT

FAKE_BETA_DIR="$TMPDIR_RUN/.claude/beta"
FAKE_LOG_DIR="$TMPDIR_RUN/.claude/hook-logs"
ACCESS_LOG="$FAKE_BETA_DIR/ACCESS-LOG.md"
mkdir -p "$FAKE_BETA_DIR" "$FAKE_LOG_DIR"

# Helper: run hook from TMPDIR_RUN (piped mode)
run_log_pipe() {
  local event_line="$1"
  (cd "$TMPDIR_RUN" && printf '%s' "$event_line" | env -i \
    PATH="$PATH" \
    HOME="$HOME" \
    WL_TASK_ID="TEST-ACCESS-LOG" \
    bash "$HOOK" 2>/dev/null)
}

run_log_pipe_exit() {
  local event_line="$1"
  local exit_code=0
  (cd "$TMPDIR_RUN" && printf '%s' "$event_line" | env -i \
    PATH="$PATH" \
    HOME="$HOME" \
    WL_TASK_ID="TEST-ACCESS-LOG" \
    bash "$HOOK" 2>/dev/null) || exit_code=$?
  echo "$exit_code"
}

# Helper: run hook from TMPDIR_RUN (explicit args mode)
run_log_args_exit() {
  local exit_code=0
  (cd "$TMPDIR_RUN" && env -i \
    PATH="$PATH" \
    HOME="$HOME" \
    WL_TASK_ID="TEST-ACCESS-LOG" \
    bash "$HOOK" "$@" 2>/dev/null) || exit_code=$?
  echo "$exit_code"
}

run_log_args() {
  (cd "$TMPDIR_RUN" && env -i \
    PATH="$PATH" \
    HOME="$HOME" \
    WL_TASK_ID="TEST-ACCESS-LOG" \
    bash "$HOOK" "$@" 2>/dev/null)
}

TS="2026-05-23T12:00:00Z"

# ---- scenario (a): ALLOW event piped → OK appended -------------------------

printf '\n=== (a) ALLOW event (Mode A) → OK appended ===\n'

rm -f "$ACCESS_LOG"
OK_LINE="${TS} · algol · READ · .claude/beta/notes.md · grant#g_abc · TASK-TEST · OK"
exit_code="$(run_log_pipe_exit "$OK_LINE")"

if [[ "$exit_code" -eq 0 ]]; then
  pass "(a) ALLOW event exits 0"
else
  fail "(a) ALLOW event exit code $exit_code (expected 0)"
fi

if [[ -f "$ACCESS_LOG" ]] && grep -qF "$OK_LINE" "$ACCESS_LOG" 2>/dev/null; then
  pass "(a) OK event line appended to ACCESS-LOG.md"
else
  fail "(a) OK event line not found in ACCESS-LOG.md"
fi

# ---- scenario (b): UNAUTHORIZED event piped → marker appended ---------------

printf '\n=== (b) UNAUTHORIZED event (Mode A) → UNAUTHORIZED ⚠ appended ===\n'

UNAUTH_LINE="${TS} · canopus · READ · .claude/beta/private.md · grant#- · TASK-TEST · UNAUTHORIZED ⚠"
exit_code="$(run_log_pipe_exit "$UNAUTH_LINE")"

if [[ "$exit_code" -eq 0 ]]; then
  pass "(b) UNAUTHORIZED event exits 0 (non-blocking)"
else
  fail "(b) UNAUTHORIZED event exit code $exit_code (expected 0)"
fi

if [[ -f "$ACCESS_LOG" ]] && grep -qF "UNAUTHORIZED ⚠" "$ACCESS_LOG" 2>/dev/null; then
  pass "(b) UNAUTHORIZED ⚠ marker appended to ACCESS-LOG.md"
else
  fail "(b) UNAUTHORIZED ⚠ marker not found in ACCESS-LOG.md"
fi

# ---- scenario (c): ALLOW event via explicit args (Mode B) -------------------

printf '\n=== (c) ALLOW event (Mode B explicit args) → OK appended ===\n'

exit_code="$(run_log_args_exit \
  "$TS" "polaris" "READ" ".claude/beta/notes.md" "g_xyz" "TASK-TEST" "OK")"

if [[ "$exit_code" -eq 0 ]]; then
  pass "(c) Mode B ALLOW exits 0"
else
  fail "(c) Mode B ALLOW exit code $exit_code (expected 0)"
fi

if grep -q "polaris" "$ACCESS_LOG" 2>/dev/null && grep -q "g_xyz" "$ACCESS_LOG" 2>/dev/null; then
  pass "(c) Mode B ALLOW event appended with correct fields"
else
  fail "(c) Mode B ALLOW event not found with expected fields in ACCESS-LOG.md"
fi

# ---- scenario (d): UNAUTHORIZED via explicit args (Mode B) ------------------

printf '\n=== (d) UNAUTHORIZED event (Mode B) ===\n'

exit_code="$(run_log_args_exit \
  "$TS" "altair" "READ" ".claude/beta/secret.md" "-" "TASK-TEST" "UNAUTHORIZED ⚠")"

if [[ "$exit_code" -eq 0 ]]; then
  pass "(d) Mode B UNAUTHORIZED exits 0 (non-blocking)"
else
  fail "(d) Mode B UNAUTHORIZED exit code $exit_code (expected 0)"
fi

if grep -q "altair" "$ACCESS_LOG" 2>/dev/null; then
  pass "(d) Mode B UNAUTHORIZED event appended"
else
  fail "(d) Mode B UNAUTHORIZED event not found in ACCESS-LOG.md"
fi

# ---- scenario (e): entry format matches spec --------------------------------

printf '\n=== (e) entry format matches spec ===\n'

rm -f "$ACCESS_LOG"
run_log_args \
  "2026-05-23T15:00:00Z" "algol" "READ" ".claude/beta/notes.md" "g_fmt_test" "TASK-FMT" "OK"

# Spec format: <timestamp> · <agent> · <OP> · <path> · grant#<id|-> · <task-id|-> · <OK|UNAUTHORIZED ⚠>
EXPECTED_PATTERN="2026-05-23T15:00:00Z · algol · READ · .claude/beta/notes.md · grant#g_fmt_test · TASK-FMT · OK"
if grep -qF "$EXPECTED_PATTERN" "$ACCESS_LOG" 2>/dev/null; then
  pass "(e) entry format matches spec: '$EXPECTED_PATTERN'"
else
  actual_line="$(grep '2026-05-23T15:00:00Z' "$ACCESS_LOG" 2>/dev/null || echo 'NOT FOUND')"
  fail "(e) entry format mismatch. Expected: '$EXPECTED_PATTERN'. Got: '$actual_line'"
fi

# ---- scenario (f): append-only — existing lines not modified ----------------

printf '\n=== (f) append-only invariant ===\n'

rm -f "$ACCESS_LOG"

# Write initial event
run_log_pipe "${TS} · algol · READ · .claude/beta/a.md · grant#g_1 · TASK-1 · OK"
first_count="$(grep -c '·' "$ACCESS_LOG" 2>/dev/null || echo 0)"

# Write second event
run_log_pipe "${TS} · polaris · READ · .claude/beta/b.md · grant#g_2 · TASK-2 · OK"
second_count="$(grep -c '·' "$ACCESS_LOG" 2>/dev/null || echo 0)"

if [[ "$second_count" -gt "$first_count" ]]; then
  pass "(f) append-only: line count increased from $first_count to $second_count"
else
  fail "(f) append-only: count did not increase (first=$first_count second=$second_count)"
fi

# Verify first line still present
if grep -qF "grant#g_1" "$ACCESS_LOG" 2>/dev/null; then
  pass "(f) first entry still present after second append"
else
  fail "(f) first entry was overwritten (not append-only)"
fi

# ---- scenario (g): missing ACCESS-LOG.md → file created with header --------

printf '\n=== (g) missing ACCESS-LOG.md → file initialized with header ===\n'

rm -f "$ACCESS_LOG"
run_log_pipe "${TS} · algol · READ · .claude/beta/new.md · grant#g_new · TASK-NEW · OK"

if [[ -f "$ACCESS_LOG" ]]; then
  pass "(g) ACCESS-LOG.md created when missing"
  if grep -q "Beta Private Memory" "$ACCESS_LOG" 2>/dev/null; then
    pass "(g) ACCESS-LOG.md contains header"
  else
    fail "(g) ACCESS-LOG.md missing header"
  fi
else
  fail "(g) ACCESS-LOG.md not created"
fi

# ---- scenario (h): fail-soft — log write failure exits 0 -------------------

printf '\n=== (h) fail-soft: log write failure exits 0 ===\n'

# Make ACCESS-LOG.md a directory to force write failure
rm -f "$ACCESS_LOG"
mkdir -p "$ACCESS_LOG"

exit_code=0
(cd "$TMPDIR_RUN" && printf '%s' "${TS} · algol · READ · .claude/beta/x.md · grant#- · TASK-X · OK" | \
  env -i PATH="$PATH" HOME="$HOME" WL_TASK_ID="TEST-ACCESS-LOG" \
  bash "$HOOK" 2>/dev/null) || exit_code=$?

if [[ "$exit_code" -eq 0 ]]; then
  pass "(h) fail-soft: log write failure exits 0"
else
  fail "(h) fail-soft: expected exit 0 on write failure, got $exit_code"
fi

# Restore ACCESS-LOG.md
rmdir "$ACCESS_LOG" 2>/dev/null || true

# ---- scenario (i): invalid usage (interactive tty-like, no args) → exits 0 -

printf '\n=== (i) invalid usage → exits 0 (non-blocking) ===\n'

exit_code=0
(cd "$TMPDIR_RUN" && env -i \
  PATH="$PATH" HOME="$HOME" WL_TASK_ID="TEST-ACCESS-LOG" \
  bash "$HOOK" 2>/dev/null < /dev/null) || exit_code=$?

if [[ "$exit_code" -eq 0 ]]; then
  pass "(i) invalid usage exits 0 (non-blocking)"
else
  fail "(i) invalid usage exited $exit_code (expected 0)"
fi

# ---- summary ----------------------------------------------------------------

printf '\n=== beta-access-log regression summary ===\n'
printf 'PASS: %d   FAIL: %d\n' "$PASS" "$FAIL"

if [[ "$FAIL" -eq 0 ]]; then
  printf '\nAll scenarios passed.\n'
  exit 0
else
  printf '\n%d scenario(s) failed — see [FAIL] lines above.\n' "$FAIL"
  exit 1
fi
