#!/usr/bin/env bash
# tests/harness/dev-clobber-guard.fixture.sh
#
# Fixture + self-contained test runner for .claude/hooks/dev-clobber-guard.sh
#
# Tests SHOULD-BLOCK (live dev + prod trigger) and SHOULD-ALLOW (no dev, safe
# commands, grep/commit-message false-positive guards) and SHOULD-ADVISORY
# (dev start commands — exit 0 with advisory message).
#
# THE BLOCK CASES require a live `next dev` process. We inject a stub process
# by launching a sleep that names itself `next dev` via exec, then cleaning up
# after the test run.
#
# Exits 0 if all assertions pass; exits 1 with a summary on failure.
#
# Usage: bash tests/harness/dev-clobber-guard.fixture.sh
#
# Owner: Canopus · α-HRN-07
# Introduced: TASK-2026-06-03-DEV-CLOBBER-GUARD-G1

set -euo pipefail

HOOK=".claude/hooks/dev-clobber-guard.sh"
PASS_COUNT=0
FAIL_COUNT=0

# Helper: build a Claude Code-style PreToolUse JSON payload
bash_payload() {
  local cmd="$1"
  jq -cn --arg cmd "$cmd" '{"tool_name":"Bash","tool_input":{"command":$cmd}}'
}

# Assertion helpers
assert_blocked() {
  local label="$1"
  local payload="$2"
  local exit_code=0
  printf '%s' "$payload" | bash "$HOOK" > /dev/null 2>&1 || exit_code=$?
  if [[ $exit_code -eq 2 ]]; then
    echo "  [PASS] SHOULD-BLOCK: $label"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "  [FAIL] SHOULD-BLOCK: $label (expected exit 2, got $exit_code)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

assert_allowed() {
  local label="$1"
  local payload="$2"
  local exit_code=0
  printf '%s' "$payload" | bash "$HOOK" > /dev/null 2>&1 || exit_code=$?
  if [[ $exit_code -eq 0 ]]; then
    echo "  [PASS] SHOULD-ALLOW: $label"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "  [FAIL] SHOULD-ALLOW: $label (expected exit 0, got $exit_code)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

assert_advisory() {
  local label="$1"
  local payload="$2"
  local exit_code=0
  OUTPUT=$(printf '%s' "$payload" | bash "$HOOK" 2>&1) || exit_code=$?
  # Advisory must: exit 0 (non-blocking) AND emit the advisory text
  if [[ $exit_code -eq 0 ]] && printf '%s' "$OUTPUT" | grep -q "ADVISORY"; then
    echo "  [PASS] SHOULD-ADVISORY: $label"
    PASS_COUNT=$((PASS_COUNT + 1))
  elif [[ $exit_code -ne 0 ]]; then
    echo "  [FAIL] SHOULD-ADVISORY: $label (expected exit 0, got $exit_code — advisory must not block)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  else
    echo "  [FAIL] SHOULD-ADVISORY: $label (exit 0 but no ADVISORY text in output)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

# --------------------------------------------------------------------------
# STUB PROCESS MANAGEMENT
#
# To test blocking behavior we need a live process that ps will report as
# "next dev". We achieve this by launching a background process named with
# argv[0] = "next" and argv[1] = "dev" using `exec -a` (bash 4+) wrapped
# in a subshell, or by simply launching a long sleep with a script that sets
# $0. The cleanest portable approach on macOS/Linux: use `perl -e 'exec("next",
# "dev", "sleep"); exec "sleep", 3600'` but that requires perl.
#
# Simplest portable stub: launch a background bash that sets its process name
# via `exec -a 'next dev' sleep 3600`. `exec -a NAME` renames argv[0] in ps.
# This appears in ps output as "next dev" matching the grep pattern.
#
# Note: `ps -eo pid,command` on macOS shows the process name (argv[0]) followed
# by the arguments. `exec -a 'next dev' sleep 3600` sets argv[0] to 'next dev'
# (a single arg with a space) — ps shows "next dev 3600". The hook's grep pattern
# `grep -E "next[[:space:]]+dev"` matches this. Verified on Darwin 25.x.
# --------------------------------------------------------------------------

STUB_PID=""

start_stub_dev() {
  # Launch a background process whose argv[0] contains "next dev"
  # Use a script approach since exec -a with spaces is bash-version-sensitive
  STUB_SCRIPT=$(mktemp /tmp/next-dev-stub.XXXXXX.sh)
  printf '#!/bin/bash\nexec -a "next dev" sleep 300\n' > "$STUB_SCRIPT"
  chmod +x "$STUB_SCRIPT"
  bash "$STUB_SCRIPT" &
  STUB_PID=$!
  # Give it a moment to appear in ps
  sleep 0.3
}

stop_stub_dev() {
  if [[ -n "$STUB_PID" ]]; then
    kill "$STUB_PID" 2>/dev/null || true
    wait "$STUB_PID" 2>/dev/null || true
    STUB_PID=""
  fi
  # Clean up any leftover stub scripts
  rm -f /tmp/next-dev-stub.*.sh 2>/dev/null || true
}

# Ensure cleanup on exit
trap stop_stub_dev EXIT

# --------------------------------------------------------------------------
echo "=== dev-clobber-guard fixture test ==="
echo ""
echo "--- SHOULD-BLOCK (requires live stub dev process) ---"
echo "  Starting stub 'next dev' process..."
start_stub_dev
echo "  Stub PID: $STUB_PID"
echo ""

# These should all block because a live `next dev` is running
assert_blocked "next build (direct)"             "$(bash_payload 'next build')"
assert_blocked "next start (direct)"             "$(bash_payload 'next start')"
assert_blocked "npm run build"                   "$(bash_payload 'npm run build')"
assert_blocked "npm run start"                   "$(bash_payload 'npm run start')"
assert_blocked "pnpm build"                      "$(bash_payload 'pnpm build')"
assert_blocked "pnpm run build"                  "$(bash_payload 'pnpm run build')"
assert_blocked "pnpm start"                      "$(bash_payload 'pnpm start')"
assert_blocked "yarn build"                      "$(bash_payload 'yarn build')"
assert_blocked "yarn run build"                  "$(bash_payload 'yarn run build')"
assert_blocked "yarn start"                      "$(bash_payload 'yarn start')"
assert_blocked "next build with flag"            "$(bash_payload 'next build --profile')"
assert_blocked "next start with port"            "$(bash_payload 'next start -p 3000')"

echo ""
echo "  Stopping stub dev process..."
stop_stub_dev
echo ""

echo "--- SHOULD-ALLOW (no live dev process) ---"

# Production build triggers — should ALLOW when no dev process alive
assert_allowed "next build (no dev alive)"        "$(bash_payload 'next build')"
assert_allowed "next start (no dev alive)"        "$(bash_payload 'next start')"
assert_allowed "npm run build (no dev alive)"     "$(bash_payload 'npm run build')"
assert_allowed "npm run start (no dev alive)"     "$(bash_payload 'npm run start')"
assert_allowed "pnpm build (no dev alive)"        "$(bash_payload 'pnpm build')"
assert_allowed "yarn build (no dev alive)"        "$(bash_payload 'yarn build')"

# Safe commands that must never trigger (false-positive guards)
# grep with "next dev" as a pattern — 'next' is an argument, not a command
assert_allowed "grep next dev pattern"            "$(bash_payload "grep 'next dev' .claude/hooks/dev-clobber-guard.sh")"
assert_allowed "grep next build pattern"          "$(bash_payload "grep -r 'next build' scripts/")"
# git commit message containing trigger words — stored inside a -m quoted string
assert_allowed "git commit mentioning next dev"   "$(bash_payload "git commit -m 'fix: do not run next dev alongside next build'")"
assert_allowed "git commit mentioning npm build"  "$(bash_payload "git commit -m 'docs: npm run build is the production command'")"
# echo/printf with trigger words as string arguments
assert_allowed "echo mentioning next build"       "$(bash_payload "echo 'run next build after killing dev'")"
assert_allowed "printf mentioning npm run start"  "$(bash_payload "printf 'next step: npm run start'")"
# jq/cat/grep usage
assert_allowed "jq on settings"                   "$(bash_payload 'jq . .claude/settings.json')"
assert_allowed "cat package.json"                 "$(bash_payload 'cat package.json')"
assert_allowed "ls hooks"                         "$(bash_payload 'ls .claude/hooks/')"
# Audit scripts
assert_allowed "bash audit script"                "$(bash_payload 'bash scripts/audit-design-tokens.sh')"
assert_allowed "bash this hook"                   "$(bash_payload 'bash .claude/hooks/dev-clobber-guard.sh')"
# git status / diff / log (read ops)
assert_allowed "git status"                       "$(bash_payload 'git status')"
assert_allowed "git diff stat"                    "$(bash_payload 'git diff --stat HEAD')"
# Non-Bash tool passthrough
assert_allowed "Read tool passthrough"            "$(jq -cn '{"tool_name":"Read","tool_input":{"file_path":"package.json"}}')"
assert_allowed "Write tool passthrough"           "$(jq -cn '{"tool_name":"Write","tool_input":{"file_path":"x.txt","content":"y"}}')"
# next dev itself is NOT blocked (advisory only)
assert_allowed "next dev itself not blocked"      "$(bash_payload 'next dev')"
assert_allowed "npm run dev itself not blocked"   "$(bash_payload 'npm run dev')"
assert_allowed "pnpm dev itself not blocked"      "$(bash_payload 'pnpm dev')"

echo ""
echo "--- SHOULD-ADVISORY (exit 0 + advisory message) ---"

# When starting next dev, advisory is printed but NOT blocked
assert_advisory "next dev starts advisory"        "$(bash_payload 'next dev')"
assert_advisory "npm run dev starts advisory"     "$(bash_payload 'npm run dev')"
assert_advisory "pnpm dev starts advisory"        "$(bash_payload 'pnpm dev')"
assert_advisory "pnpm run dev starts advisory"    "$(bash_payload 'pnpm run dev')"
assert_advisory "yarn dev starts advisory"        "$(bash_payload 'yarn dev')"

echo ""
echo "=== RESULTS: $PASS_COUNT passed, $FAIL_COUNT failed ==="

if [[ $FAIL_COUNT -gt 0 ]]; then
  echo "FIXTURE FAIL — $FAIL_COUNT assertion(s) did not meet expected behavior"
  exit 1
fi
echo "FIXTURE PASS — all assertions satisfied"
exit 0
