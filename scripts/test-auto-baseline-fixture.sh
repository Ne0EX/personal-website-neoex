#!/usr/bin/env bash
# Adversarial fixture tests for .claude/hooks/auto-baseline.sh
# Self-contained; creates an ephemeral git repo in /tmp; cleans up on exit.
#
# Run: bash scripts/test-auto-baseline-fixture.sh

set -euo pipefail

HOOK="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.claude/hooks/auto-baseline.sh"
SIGN_WORK="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.claude/hooks/sign-work.sh"
PASS=0
FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL+1)); }

# -----------------------------------------------------------------------
# Setup: ephemeral git repo
# -----------------------------------------------------------------------
TDIR=$(mktemp -d /tmp/auto-baseline-XXXXXX)
trap 'rm -rf "$TDIR"' EXIT

cd "$TDIR"
git init -q
git config user.email "test@test.com"
git config user.name "test"

# Committed baseline file
printf 'committed content\n' > committed.txt
git add committed.txt
git commit -q -m "init"

echo "=== Fixture 1: EMPTY-TASK NO-OP ==="
# Invoke with empty TASK_IDs; assert no baseline file created anywhere, exit 0
WL_TASK_ID= CLAUDE_TASK_ID= bash "$HOOK" <<< '{"tool_name":"Write","tool_input":{"file_path":"x"}}'
exit_code="$?"
if [[ "$exit_code" -eq 0 ]]; then pass "exit 0 on empty TASK_ID"; else fail "exit was $exit_code not 0"; fi
count=$(find "$TDIR" -name "*--baseline.json" 2>/dev/null | wc -l | tr -d ' ')
if [[ "$count" -eq 0 ]]; then pass "no baseline file created"; else fail "found $count baseline file(s) — should be 0"; fi

echo ""
echo "=== Fixture 2: FIRST-CAPTURE ==="
# Dirty tracked file + untracked file
printf 'dirty content\n' >> committed.txt   # tracked dirty
printf 'untracked content\n' > untracked.txt  # untracked

WL_TASK_ID="T1" WL_AGENT="canopus" bash "$HOOK" <<< '{"tool_name":"Write","tool_input":{"file_path":"committed.txt"}}'
BF=".claude/hook-logs/T1--baseline.json"
if [[ -f "$BF" ]]; then pass "baseline file created at $BF"; else fail "baseline file NOT created"; fi

# Valid JSON?
if jq -e '.' "$BF" > /dev/null 2>&1; then pass "baseline is valid JSON"; else fail "baseline is NOT valid JSON"; fi

# Schema keys: {recorded_at, task_id, agent, files}
keys=$(jq -r 'keys | sort | join(",")' "$BF")
if [[ "$keys" == "agent,files,recorded_at,task_id" ]]; then pass "schema keys correct"; else fail "schema keys wrong: $keys"; fi

# .files is an object
if jq -e '.files | type == "object"' "$BF" > /dev/null 2>&1; then pass ".files is object"; else fail ".files is not an object"; fi

# Both dirty files present with 64-hex sha256
ct_hash=$(jq -r '.files["committed.txt"]' "$BF")
ut_hash=$(jq -r '.files["untracked.txt"]' "$BF")
if [[ ${#ct_hash} -eq 64 ]]; then pass "committed.txt has 64-hex hash"; else fail "committed.txt hash wrong: '$ct_hash'"; fi
if [[ ${#ut_hash} -eq 64 ]]; then pass "untracked.txt has 64-hex hash"; else fail "untracked.txt hash wrong: '$ut_hash'"; fi

# task_id field correct
tid=$(jq -r '.task_id' "$BF")
if [[ "$tid" == "T1" ]]; then pass "task_id = T1"; else fail "task_id wrong: $tid"; fi

# recorded_at present
rat=$(jq -r '.recorded_at' "$BF")
if [[ -n "$rat" && "$rat" != "null" ]]; then pass "recorded_at present: $rat"; else fail "recorded_at missing"; fi

echo ""
echo "=== Fixture 3: IDEMPOTENCY ==="
# Write a sentinel baseline file; invoke hook; assert content unchanged
mkdir -p .claude/hook-logs
SENTINEL='{"sentinel":"CANARY","task_id":"T2","recorded_at":"2000-01-01T00:00:00Z","agent":"test","files":{}}'
printf '%s\n' "$SENTINEL" > ".claude/hook-logs/T2--baseline.json"

WL_TASK_ID="T2" bash "$HOOK" <<< '{"tool_name":"Edit","tool_input":{"file_path":"committed.txt"}}'
result_content=$(cat ".claude/hook-logs/T2--baseline.json")
if printf '%s\n' "$result_content" | grep -q "CANARY"; then
  pass "sentinel unchanged (idempotency holds)"
else
  fail "sentinel was overwritten"
fi

# Mutate-test: prove the -f guard is load-bearing by removing it
MODIFIED_HOOK=$(mktemp /tmp/hook-mod-XXXXXX.sh)
sed 's/if \[\[ -f "\$BASELINE_FILE" \]\]/if false/' "$HOOK" > "$MODIFIED_HOOK"
printf '%s\n' "$SENTINEL" > ".claude/hook-logs/T2--baseline.json"  # restore sentinel
WL_TASK_ID="T2" bash "$MODIFIED_HOOK" <<< '{"tool_name":"Edit","tool_input":{"file_path":"committed.txt"}}'
result_after=$(cat ".claude/hook-logs/T2--baseline.json")
if printf '%s\n' "$result_after" | grep -q "CANARY"; then
  fail "mutate-test: guard removal should allow overwrite but did NOT (guard not at expected location)"
else
  pass "mutate-test: removing -f guard allows overwrite → guard is load-bearing"
fi
rm -f "$MODIFIED_HOOK"

echo ""
echo "=== Fixture 4: END-TO-END carry-over filtering ==="
# New task T3; 1 pre-existing untracked carry-over
printf 'carry over content\n' > carryover.txt   # pre-existing untracked
# Capture baseline before creating the task-created file
WL_TASK_ID="T3" WL_AGENT="canopus" bash "$HOOK" <<< '{"tool_name":"Write","tool_input":{"file_path":"carryover.txt"}}'
BF3=".claude/hook-logs/T3--baseline.json"
if [[ -f "$BF3" ]]; then pass "T3 baseline captured"; else fail "T3 baseline NOT captured"; fi
co_hash=$(jq -r '.files["carryover.txt"] // "ABSENT"' "$BF3")
if [[ "$co_hash" != "ABSENT" && ${#co_hash} -eq 64 ]]; then pass "carryover.txt recorded in baseline"; else fail "carryover.txt NOT in baseline (hash: $co_hash)"; fi

# Simulate task creating a new file
printf 'task created file\n' > task-file.txt

# Run sign-work.sh to check files_touched filtering
sign_output=$(WL_TASK_ID="T3" WL_AGENT="canopus" WL_NEXT="polaris" WL_SUMMARY="auto-baseline fixture test" bash "$SIGN_WORK" "T3" 2>&1 || true)
SIG=".claude/signatures/T3--canopus.json"
if [[ -f "$SIG" ]]; then
  files_touched=$(jq -r '.files_touched[]' "$SIG" 2>/dev/null || true)
  if printf '%s\n' "$files_touched" | grep -q "task-file.txt"; then
    pass "task-file.txt in files_touched"
  else
    fail "task-file.txt NOT in files_touched; files_touched: $files_touched"
  fi
  if printf '%s\n' "$files_touched" | grep -q "carryover.txt"; then
    fail "carryover.txt in files_touched (carry-over NOT filtered)"
  else
    pass "carryover.txt excluded from files_touched (carry-over filtered)"
  fi
else
  # sign-work.sh may fail for other reasons in the isolated repo (e.g. missing WL_TASK_ID env);
  # print what it said and mark advisory
  echo "  INFO: sign-work.sh did not produce signature. Output (first 400 chars):"
  printf '%s\n' "${sign_output:0:400}"
  fail "T3 signature file not created"
fi

echo ""
echo "=== Deterministic backstop ==="
if grep -q 'recorded_at' "$BF" && jq -e '.files|type=="object"' "$BF" > /dev/null 2>&1; then
  pass "backstop: recorded_at present AND .files is object"
else
  fail "backstop: check failed"
fi

echo ""
echo "================================================"
echo "Results: $PASS passed, $FAIL failed"
echo "================================================"
[[ "$FAIL" -eq 0 ]]
