#!/usr/bin/env bash
# tests/harness/beta-session-start.test.ts
# Regression test: C7 · session-start.sh (Beta-mode detection block only)
#
# Coverage:
#   (a) SessionStart without persona-tracker.sh installed → mode=genesis written
#   (b) SessionStart with persona-tracker.sh stub present → mode=pending written
#   (c) metadata file format — valid JSON with all required fields
#   (d) required fields: session_id, mode, started_at, first_message_excerpt (null), resolved_by
#   (e) mode detection patterns match V3 spec (tested via field in output JSON):
#       - mode=pending when C4 is present
#       - mode=genesis when C4 absent (fallback)
#   (f) metadata written before first user message is possible (file exists after hook runs)
#   (g) session file path pattern: .claude/sessions/<session-id>.meta.json
#   (h) hook exits 0 and emits valid SessionStart JSON to stdout (Polaris persona injection)
#   (i) mode=genesis (C4 absent): resolved_by contains "session-start-fallback"
#   (j) mode=pending (C4 present): resolved_by contains "pending-c4-resolution"
#
# NOTE: This test covers the C7 metadata-writer block appended to session-start.sh.
# The Polaris persona injection (the primary function of session-start.sh) is tested
# incidentally but not the focus.
#
# Usage:
#   bash tests/harness/beta-session-start.test.ts
#
# Exit codes:
#   0 — all scenarios passed
#   1 — one or more scenarios failed

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOK="$REPO_ROOT/.claude/hooks/session-start.sh"

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

FAKE_SESSIONS="$TMPDIR_RUN/.claude/sessions"
FAKE_HOOKS="$TMPDIR_RUN/.claude/hooks"
FAKE_AGENTS="$TMPDIR_RUN/.claude/agents"
mkdir -p "$FAKE_SESSIONS" "$FAKE_HOOKS" "$FAKE_AGENTS"

# Create a minimal polaris.md so the hook doesn't exit early
cat > "$FAKE_AGENTS/polaris.md" <<'EOF'
# Polaris (α-OPS-00) — Product Manager

You are Polaris.
EOF

# Helper: run session-start.sh from TMPDIR_RUN
run_session_start() {
  local session_id="$1"
  local exit_code=0
  stdout="$(cd "$TMPDIR_RUN" && env -i \
    PATH="$PATH" \
    HOME="$HOME" \
    CLAUDE_SESSION_ID="$session_id" \
    bash "$HOOK" 2>/dev/null)" || exit_code=$?
  echo "$exit_code"
}

run_session_start_stdout() {
  local session_id="$1"
  (cd "$TMPDIR_RUN" && env -i \
    PATH="$PATH" \
    HOME="$HOME" \
    CLAUDE_SESSION_ID="$session_id" \
    bash "$HOOK" 2>/dev/null) || true
}

# Helper: check field in session meta JSON
check_meta_field() {
  local session_id="$1"
  local field="$2"
  local expected="$3"  # use "NOTNULL" to just check field exists
  local meta_file="$FAKE_SESSIONS/${session_id}.meta.json"

  if [[ ! -f "$meta_file" ]]; then
    fail "meta file not found: $meta_file"
    return
  fi

  actual="$(jq -r --arg f "$field" '.[$f] // "MISSING"' "$meta_file" 2>/dev/null)"
  if [[ "$expected" == "NOTNULL" ]]; then
    if [[ "$actual" != "MISSING" ]] && [[ -n "$actual" ]]; then
      pass "session meta field '$field' present (value: $actual)"
    else
      fail "session meta field '$field' missing or empty"
    fi
  elif [[ "$actual" == "$expected" ]]; then
    pass "session meta field '$field' = '$expected'"
  else
    fail "session meta field '$field': expected '$expected', got '$actual'"
  fi
}

# ---- scenario (a): C4 absent → mode=genesis --------------------------------

printf '\n=== (a) C4 absent → mode=genesis ===\n'

# Ensure persona-tracker.sh does NOT exist (or is not executable)
rm -f "$FAKE_HOOKS/persona-tracker.sh"

SESSION_A="session-no-c4-$$"
run_session_start "$SESSION_A"

META_A="$FAKE_SESSIONS/${SESSION_A}.meta.json"
if [[ -f "$META_A" ]]; then
  pass "(a) metadata file created when C4 absent"
  mode_a="$(jq -r '.mode' "$META_A" 2>/dev/null)"
  if [[ "$mode_a" == "genesis" ]]; then
    pass "(a) mode=genesis when C4 absent"
  else
    fail "(a) mode expected 'genesis', got '$mode_a'"
  fi
else
  fail "(a) metadata file not created"
fi

# ---- scenario (b): C4 present → mode=pending --------------------------------

printf '\n=== (b) C4 present → mode=pending ===\n'

# Create an executable persona-tracker.sh stub
cat > "$FAKE_HOOKS/persona-tracker.sh" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "$FAKE_HOOKS/persona-tracker.sh"

SESSION_B="session-with-c4-$$"
run_session_start "$SESSION_B"

META_B="$FAKE_SESSIONS/${SESSION_B}.meta.json"
if [[ -f "$META_B" ]]; then
  pass "(b) metadata file created when C4 present"
  mode_b="$(jq -r '.mode' "$META_B" 2>/dev/null)"
  if [[ "$mode_b" == "pending" ]]; then
    pass "(b) mode=pending when C4 present"
  else
    fail "(b) mode expected 'pending', got '$mode_b'"
  fi
else
  fail "(b) metadata file not created with C4 present"
fi

# Clean up C4 stub to not interfere
rm -f "$FAKE_HOOKS/persona-tracker.sh"

# ---- scenario (c): metadata format — valid JSON with required fields --------

printf '\n=== (c) metadata format — valid JSON with required fields ===\n'

SESSION_C="session-format-$$"
run_session_start "$SESSION_C"

META_C="$FAKE_SESSIONS/${SESSION_C}.meta.json"
if [[ -f "$META_C" ]]; then
  # Verify valid JSON
  if jq '.' "$META_C" >/dev/null 2>&1; then
    pass "(c) metadata is valid JSON"
  else
    fail "(c) metadata is NOT valid JSON"
  fi
else
  fail "(c) metadata file not created"
fi

# ---- scenario (d): required fields present ----------------------------------

printf '\n=== (d) required fields ===\n'

check_meta_field "$SESSION_C" "session_id" "NOTNULL"
check_meta_field "$SESSION_C" "mode" "NOTNULL"
check_meta_field "$SESSION_C" "started_at" "NOTNULL"
check_meta_field "$SESSION_C" "resolved_by" "NOTNULL"

# first_message_excerpt should be null at this stage
META_C="$FAKE_SESSIONS/${SESSION_C}.meta.json"
if [[ -f "$META_C" ]]; then
  excerpt="$(jq '.first_message_excerpt' "$META_C" 2>/dev/null)"
  if [[ "$excerpt" == "null" ]]; then
    pass "(d) first_message_excerpt is null (not yet set — C4 fills on first UserPromptSubmit)"
  else
    fail "(d) first_message_excerpt should be null at SessionStart, got: $excerpt"
  fi
fi

# ---- scenario (e): session_id matches CLAUDE_SESSION_ID env var -------------

printf '\n=== (e) session_id matches env var ===\n'

SESSION_E="my-specific-session-12345"
run_session_start "$SESSION_E"

META_E="$FAKE_SESSIONS/${SESSION_E}.meta.json"
if [[ -f "$META_E" ]]; then
  recorded_id="$(jq -r '.session_id' "$META_E" 2>/dev/null)"
  if [[ "$recorded_id" == "$SESSION_E" ]]; then
    pass "(e) session_id in metadata matches CLAUDE_SESSION_ID env var"
  else
    fail "(e) session_id mismatch: expected '$SESSION_E', got '$recorded_id'"
  fi
else
  fail "(e) metadata file not created for session_id env test"
fi

# ---- scenario (f): metadata written before first user message ---------------

printf '\n=== (f) metadata file exists after hook runs ===\n'

SESSION_F="session-timing-$$"
run_session_start "$SESSION_F"

META_F="$FAKE_SESSIONS/${SESSION_F}.meta.json"
if [[ -f "$META_F" ]]; then
  pass "(f) metadata file present after session-start.sh runs"
else
  fail "(f) metadata file not present (C7 block did not execute)"
fi

# ---- scenario (g): session file path pattern --------------------------------

printf '\n=== (g) session file path: .claude/sessions/<session-id>.meta.json ===\n'

SESSION_G="session-path-test-$$"
run_session_start "$SESSION_G"

EXPECTED_PATH="$FAKE_SESSIONS/${SESSION_G}.meta.json"
if [[ -f "$EXPECTED_PATH" ]]; then
  pass "(g) session file at expected path: .claude/sessions/${SESSION_G}.meta.json"
else
  fail "(g) session file not at expected path: $EXPECTED_PATH"
fi

# ---- scenario (h): hook exits 0 and emits valid SessionStart JSON to stdout -

printf '\n=== (h) hook exits 0, stdout = valid SessionStart JSON ===\n'

SESSION_H="session-exit-test-$$"
exit_code="$(run_session_start "$SESSION_H")"

if [[ "$exit_code" -eq 0 ]]; then
  pass "(h) session-start.sh exits 0"
else
  fail "(h) session-start.sh exited $exit_code (expected 0)"
fi

stdout_h="$(run_session_start_stdout "$SESSION_H")"
if printf '%s' "$stdout_h" | jq '.' >/dev/null 2>&1; then
  pass "(h) stdout is valid JSON"
else
  fail "(h) stdout is NOT valid JSON: '$stdout_h'"
fi

# Verify hookSpecificOutput shape
if printf '%s' "$stdout_h" | jq -e '.hookSpecificOutput.hookEventName' >/dev/null 2>&1; then
  pass "(h) stdout has hookSpecificOutput.hookEventName"
else
  fail "(h) stdout missing hookSpecificOutput.hookEventName"
fi

# ---- scenario (i): C4 absent → resolved_by contains "session-start-fallback" ----

printf '\n=== (i) C4 absent → resolved_by indicates fallback ===\n'

SESSION_I="session-resolved-by-$$"
rm -f "$FAKE_HOOKS/persona-tracker.sh"
run_session_start "$SESSION_I"

META_I="$FAKE_SESSIONS/${SESSION_I}.meta.json"
if [[ -f "$META_I" ]]; then
  resolved_by="$(jq -r '.resolved_by' "$META_I" 2>/dev/null)"
  if printf '%s' "$resolved_by" | grep -qi "fallback"; then
    pass "(i) resolved_by contains 'fallback' when C4 absent: '$resolved_by'"
  else
    fail "(i) resolved_by does not contain 'fallback': '$resolved_by'"
  fi
fi

# ---- scenario (j): C4 present → resolved_by indicates pending-c4-resolution ----

printf '\n=== (j) C4 present → resolved_by indicates pending-c4-resolution ===\n'

cat > "$FAKE_HOOKS/persona-tracker.sh" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "$FAKE_HOOKS/persona-tracker.sh"

SESSION_J="session-pending-resolved-$$"
run_session_start "$SESSION_J"

META_J="$FAKE_SESSIONS/${SESSION_J}.meta.json"
if [[ -f "$META_J" ]]; then
  resolved_by_j="$(jq -r '.resolved_by' "$META_J" 2>/dev/null)"
  if printf '%s' "$resolved_by_j" | grep -qi "pending"; then
    pass "(j) resolved_by contains 'pending' when C4 present: '$resolved_by_j'"
  else
    fail "(j) resolved_by does not contain 'pending': '$resolved_by_j'"
  fi
fi

rm -f "$FAKE_HOOKS/persona-tracker.sh"

# ---- summary ----------------------------------------------------------------

printf '\n=== beta-session-start regression summary ===\n'
printf 'PASS: %d   FAIL: %d\n' "$PASS" "$FAIL"

if [[ "$FAIL" -eq 0 ]]; then
  printf '\nAll scenarios passed.\n'
  exit 0
else
  printf '\n%d scenario(s) failed — see [FAIL] lines above.\n' "$FAIL"
  exit 1
fi
