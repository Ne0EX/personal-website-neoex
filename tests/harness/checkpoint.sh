#!/usr/bin/env bash
# tests/harness/checkpoint.sh
# Smoke test for the checkpoint rail (TASK-2026-05-15-META-4).
#
# Simulates all 3 triggers, verifies SAVE-POINT.md and archive are written,
# verifies no errors when run on a clean tree.
#
# Usage: bash tests/harness/checkpoint.sh
#
# Exit 0 = all scenarios pass
# Exit 1 = one or more scenarios failed

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOK="$REPO_ROOT/.claude/hooks/save-checkpoint.sh"
COUNTER_HOOK="$REPO_ROOT/.claude/hooks/postuse-agent-counter.sh"
ROLLING_HEAD="$REPO_ROOT/docs/team/SAVE-POINT.md"
CHECKPOINT_DIR="$REPO_ROOT/docs/team/.checkpoints"
MARKER="$REPO_ROOT/.claude/.last-checkpoint"

PASS=0
FAIL=0

pass() { printf '[PASS] %s\n' "$1"; PASS=$((PASS+1)); }
fail() { printf '[FAIL] %s\n' "$1"; FAIL=$((FAIL+1)); }

# ─── setup ───────────────────────────────────────────────────────────────────

# Save and restore any existing marker so smoke test is isolated
MARKER_BACKUP=""
if [[ -f "$MARKER" ]]; then
  MARKER_BACKUP="$(cat "$MARKER")"
fi
# Remove marker so each trigger starts fresh
rm -f "$MARKER"

# ─── scenario 1: stop trigger (with CLAUDE_TASK_ID set) ──────────────────────

printf '\n=== Scenario 1: stop trigger (task session) ===\n'

BEFORE_COUNT="$(ls -1 "$CHECKPOINT_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')"

CLAUDE_TASK_ID="SMOKE-TEST-1" \
  bash "$HOOK" "stop" 2>&1

AFTER_COUNT="$(ls -1 "$CHECKPOINT_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')"

if [[ "$AFTER_COUNT" -gt "$BEFORE_COUNT" ]]; then
  pass "stop trigger wrote archive file"
else
  fail "stop trigger did not write archive file (before=$BEFORE_COUNT after=$AFTER_COUNT)"
fi

if [[ -f "$ROLLING_HEAD" ]]; then
  pass "stop trigger wrote SAVE-POINT.md"
else
  fail "stop trigger did not write SAVE-POINT.md"
fi

if grep -q "trigger: stop" "$ROLLING_HEAD" 2>/dev/null; then
  pass "SAVE-POINT.md contains trigger: stop"
else
  fail "SAVE-POINT.md does not contain trigger: stop"
fi

# Verify < 5 KB
ROLLING_SIZE="$(wc -c < "$ROLLING_HEAD" | tr -d ' ')"
if [[ "$ROLLING_SIZE" -lt 5120 ]]; then
  pass "SAVE-POINT.md size < 5 KB (actual: ${ROLLING_SIZE} bytes)"
else
  fail "SAVE-POINT.md size >= 5 KB (actual: ${ROLLING_SIZE} bytes)"
fi

# ─── scenario 2: stop trigger without task context — should skip ──────────────

printf '\n=== Scenario 2: stop trigger (no task context — should skip) ===\n'

# Remove marker to ensure fresh run
rm -f "$MARKER"

ARCHIVE_BEFORE="$(ls -1t "$CHECKPOINT_DIR"/*.md 2>/dev/null | head -1)"

unset CLAUDE_TASK_ID 2>/dev/null || true
WL_CHECKPOINT_ALWAYS=0 bash "$HOOK" "stop" 2>&1
EXIT_CODE=$?

ARCHIVE_AFTER="$(ls -1t "$CHECKPOINT_DIR"/*.md 2>/dev/null | head -1)"

if [[ "$EXIT_CODE" -eq 0 ]]; then
  pass "stop trigger exits 0 in no-task context (no crash)"
else
  fail "stop trigger exited non-zero in no-task context (exit=$EXIT_CODE)"
fi

if [[ "$ARCHIVE_BEFORE" == "$ARCHIVE_AFTER" ]]; then
  pass "stop trigger correctly skipped (no new archive) in no-task context"
else
  fail "stop trigger wrote checkpoint in casual session (should have skipped)"
fi

# ─── scenario 3: manual trigger (no task context required) ───────────────────

printf '\n=== Scenario 3: manual trigger (no task context) ===\n'

rm -f "$MARKER"
BEFORE_COUNT="$(ls -1 "$CHECKPOINT_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')"

WL_CHECKPOINT_ALWAYS=1 bash "$HOOK" "manual" "smoke-test-note" 2>&1

AFTER_COUNT="$(ls -1 "$CHECKPOINT_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')"

if [[ "$AFTER_COUNT" -gt "$BEFORE_COUNT" ]]; then
  pass "manual trigger wrote archive file"
else
  fail "manual trigger did not write archive file"
fi

if grep -q "trigger: manual" "$ROLLING_HEAD" 2>/dev/null; then
  pass "SAVE-POINT.md contains trigger: manual"
else
  fail "SAVE-POINT.md does not contain trigger: manual"
fi

if grep -q "smoke-test-note" "$ROLLING_HEAD" 2>/dev/null; then
  pass "SAVE-POINT.md contains manual note"
else
  fail "SAVE-POINT.md does not contain manual note"
fi

# ─── scenario 4: postuse-threshold fires at N=3 ──────────────────────────────

printf '\n=== Scenario 4: postuse-threshold fires at N=3 ===\n'

# Use a fake session ID to isolate from real sessions
FAKE_SESSION="smoke-test-session-$$"
rm -rf "/tmp/wl-checkpoint-${FAKE_SESSION}"

BEFORE_COUNT="$(ls -1 "$CHECKPOINT_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')"

# Fire counter 1 — should not trigger checkpoint
CLAUDE_SESSION_ID="$FAKE_SESSION" CLAUDE_TASK_ID="SMOKE-TEST-4" \
  bash "$COUNTER_HOOK" 2>&1
COUNT_AFTER_1="$(ls -1 "$CHECKPOINT_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')"
if [[ "$COUNT_AFTER_1" -eq "$BEFORE_COUNT" ]]; then
  pass "counter=1 does not fire checkpoint (below threshold)"
else
  fail "counter=1 fired checkpoint prematurely"
fi

# Fire counter 2 — should not trigger
CLAUDE_SESSION_ID="$FAKE_SESSION" CLAUDE_TASK_ID="SMOKE-TEST-4" \
  bash "$COUNTER_HOOK" 2>&1
COUNT_AFTER_2="$(ls -1 "$CHECKPOINT_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')"
if [[ "$COUNT_AFTER_2" -eq "$BEFORE_COUNT" ]]; then
  pass "counter=2 does not fire checkpoint (below threshold)"
else
  fail "counter=2 fired checkpoint prematurely"
fi

# Fire counter 3 — should trigger checkpoint
CLAUDE_SESSION_ID="$FAKE_SESSION" CLAUDE_TASK_ID="SMOKE-TEST-4" \
  bash "$COUNTER_HOOK" 2>&1

COUNT_AFTER_3="$(ls -1 "$CHECKPOINT_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')"
if [[ "$COUNT_AFTER_3" -gt "$BEFORE_COUNT" ]]; then
  pass "counter=3 fired checkpoint (threshold reached)"
else
  fail "counter=3 did not fire checkpoint (threshold not triggered)"
fi

# Verify counter reset: next call should not immediately re-trigger
BEFORE_RESET="$COUNT_AFTER_3"
CLAUDE_SESSION_ID="$FAKE_SESSION" CLAUDE_TASK_ID="SMOKE-TEST-4" \
  bash "$COUNTER_HOOK" 2>&1
COUNT_AFTER_RESET="$(ls -1 "$CHECKPOINT_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')"
if [[ "$COUNT_AFTER_RESET" -eq "$BEFORE_RESET" ]]; then
  pass "counter resets after threshold — no immediate re-trigger"
else
  fail "counter did not reset — triggered again at count=1"
fi

# Cleanup fake session temp dir
rm -rf "/tmp/wl-checkpoint-${FAKE_SESSION}"

# ─── scenario 5: idempotency — no-change guard on stop trigger ───────────────

printf '\n=== Scenario 5: idempotency (stop trigger — no changes since last checkpoint) ===\n'

# Run once to establish baseline
CLAUDE_TASK_ID="SMOKE-TEST-5" bash "$HOOK" "stop" 2>&1
BEFORE_COUNT="$(ls -1 "$CHECKPOINT_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')"

# Run again immediately — git status unchanged, should skip
CLAUDE_TASK_ID="SMOKE-TEST-5" bash "$HOOK" "stop" 2>&1
AFTER_COUNT="$(ls -1 "$CHECKPOINT_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')"

if [[ "$AFTER_COUNT" -eq "$BEFORE_COUNT" ]]; then
  pass "idempotency: second stop trigger skipped (no changes)"
else
  fail "idempotency: second stop trigger wrote duplicate checkpoint"
fi

# ─── timing check ────────────────────────────────────────────────────────────

printf '\n=== Timing: wall time for stop trigger ===\n'

rm -f "$MARKER"
START="$(date +%s%N 2>/dev/null || date +%s)"
CLAUDE_TASK_ID="SMOKE-TEST-TIME" bash "$HOOK" "stop" 2>&1
END="$(date +%s%N 2>/dev/null || date +%s)"

# On systems with nanosecond support, compute ms. On systems without, just pass.
if [[ ${#START} -gt 10 ]]; then
  ELAPSED_MS=$(( (END - START) / 1000000 ))
  if [[ "$ELAPSED_MS" -lt 1000 ]]; then
    pass "wall time < 1 second (actual: ${ELAPSED_MS}ms)"
  else
    fail "wall time >= 1 second (actual: ${ELAPSED_MS}ms) — performance budget exceeded"
  fi
else
  pass "wall time check skipped (no nanosecond clock on this platform)"
fi

# ─── restore marker ───────────────────────────────────────────────────────────

if [[ -n "$MARKER_BACKUP" ]]; then
  printf '%s' "$MARKER_BACKUP" > "$MARKER"
fi

# ─── summary ─────────────────────────────────────────────────────────────────

printf '\n=== checkpoint smoke test summary ===\n'
printf 'PASS: %d   FAIL: %d\n' "$PASS" "$FAIL"

if [[ "$FAIL" -eq 0 ]]; then
  printf '\nAll scenarios passed.\n'
  exit 0
else
  printf '\n%d scenario(s) failed — see [FAIL] lines above.\n' "$FAIL"
  exit 1
fi
