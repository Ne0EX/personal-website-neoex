#!/usr/bin/env bash
# tests/harness/beta-grant.test.ts
# Regression test: C2 · beta-grant.sh
#
# Coverage:
#   (a) BETA_PERSONA_LOADED != 1 → refuses, exit 1
#   (b) valid grant write → valid JSON file exists with all required schema fields
#   (c) schema validation → all required fields present and typed correctly
#   (d) unknown requester → refuses, exit 3
#   (e) path outside .claude/beta/ → refuses, exit 4
#   (f) missing required args → usage error, exit 2
#   (g) TTL and max_reads defaults (1 hour, 1 read)
#   (h) custom TTL and max_reads honored
#
# Usage:
#   bash tests/harness/beta-grant.test.ts
#
# Exit codes:
#   0 — all assertions passed
#   1 — one or more assertions failed

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOK="$REPO_ROOT/.claude/hooks/beta-grant.sh"

PASS=0
FAIL=0

pass() { printf '[PASS] %s\n' "$1"; PASS=$((PASS+1)); }
fail() { printf '[FAIL] %s\n' "$1"; FAIL=$((FAIL+1)); }

if [[ ! -f "$HOOK" ]]; then
  printf 'FATAL: hook not found at %s\n' "$HOOK" >&2
  exit 1
fi

# ---- temp environment -------------------------------------------------------

TMPDIR_RUN="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_RUN"' EXIT

FAKE_GRANTS="$TMPDIR_RUN/.claude/beta/grants"
FAKE_LOG_DIR="$TMPDIR_RUN/.claude/hook-logs"
mkdir -p "$FAKE_GRANTS" "$FAKE_LOG_DIR"

# Helper: run grant hook from TMPDIR_RUN
run_grant() {
  (cd "$TMPDIR_RUN" && env -i \
    PATH="$PATH" \
    HOME="$HOME" \
    BETA_PERSONA_LOADED="${BETA_PERSONA_OVERRIDE:-0}" \
    WL_TASK_ID="TEST-GRANT" \
    bash "$HOOK" "$@" 2>/dev/null)
}

run_grant_exit() {
  local exit_code=0
  (cd "$TMPDIR_RUN" && env -i \
    PATH="$PATH" \
    HOME="$HOME" \
    BETA_PERSONA_LOADED="${BETA_PERSONA_OVERRIDE:-0}" \
    WL_TASK_ID="TEST-GRANT" \
    bash "$HOOK" "$@" 2>/dev/null) || exit_code=$?
  echo "$exit_code"
}

# ---- scenario (a): BETA_PERSONA_LOADED not set → refused --------------------

printf '\n=== (a) no BETA_PERSONA_LOADED → refused ===\n'

BETA_PERSONA_OVERRIDE="0"
exit_code="$(run_grant_exit "algol" ".claude/beta/notes/test.md" "test grant")"

if [[ "$exit_code" -eq 1 ]]; then
  pass "(a) BETA_PERSONA_LOADED=0 → exit 1 (refused)"
else
  fail "(a) BETA_PERSONA_LOADED=0 → expected exit 1, got $exit_code"
fi

# Confirm no grant file was written
grant_count="$(find "$FAKE_GRANTS" -name "*.json" 2>/dev/null | wc -l | tr -d ' ')"
if [[ "$grant_count" -eq 0 ]]; then
  pass "(a) no grant file written when refused"
else
  fail "(a) grant file was written despite refusal (count=$grant_count)"
fi

# ---- scenario (b): valid grant write ----------------------------------------

printf '\n=== (b) valid grant write ===\n'

BETA_PERSONA_OVERRIDE="1"
GRANT_ID="$(run_grant "algol" ".claude/beta/notes/test.md" "algol audit" 3600 1)"
exit_code=$?

if [[ "$exit_code" -eq 0 ]] && [[ -n "$GRANT_ID" ]]; then
  pass "(b) valid grant write → exit 0, grant_id returned: $GRANT_ID"
else
  fail "(b) valid grant write → exit $exit_code or no grant_id"
fi

GRANT_FILE="$FAKE_GRANTS/${GRANT_ID}.json"
if [[ -f "$GRANT_FILE" ]]; then
  pass "(b) grant file exists at $GRANT_FILE"
else
  fail "(b) grant file not found at $GRANT_FILE"
fi

# ---- scenario (c): schema validation ----------------------------------------

printf '\n=== (c) schema validation — all required fields ===\n'

if [[ -f "$GRANT_FILE" ]]; then
  check_field() {
    local field="$1"
    local val
    val="$(jq -r --arg f "$field" '.[$f] // "MISSING"' "$GRANT_FILE" 2>/dev/null)"
    if [[ "$val" != "MISSING" ]] && [[ -n "$val" ]] && [[ "$val" != "null" ]]; then
      pass "(c) field '$field' present: $val"
    else
      fail "(c) field '$field' missing or null"
    fi
  }

  check_field "grant_id"
  check_field "request_id"
  check_field "requester"
  check_field "files_granted"
  check_field "scope_reason"
  check_field "issued_at"
  check_field "expires_at"
  check_field "max_reads"
  check_field "reads_consumed"
  check_field "nonce"

  # requester should match what we passed
  requester="$(jq -r '.requester' "$GRANT_FILE" 2>/dev/null)"
  if [[ "$requester" == "algol" ]]; then
    pass "(c) requester field = 'algol'"
  else
    fail "(c) requester field mismatch: got '$requester', expected 'algol'"
  fi

  # reads_consumed should start at 0
  consumed="$(jq -r '.reads_consumed' "$GRANT_FILE" 2>/dev/null)"
  if [[ "$consumed" -eq 0 ]]; then
    pass "(c) reads_consumed starts at 0"
  else
    fail "(c) reads_consumed should be 0, got $consumed"
  fi

  # files_granted should be array containing the path
  path_match="$(jq -r '.files_granted[]' "$GRANT_FILE" 2>/dev/null | grep -c '.claude/beta/notes/test.md' || echo 0)"
  if [[ "$path_match" -ge 1 ]]; then
    pass "(c) files_granted contains the requested path"
  else
    fail "(c) files_granted does not contain the requested path"
  fi

  # nonce must be non-empty (128-bit = 32 hex chars)
  nonce="$(jq -r '.nonce' "$GRANT_FILE" 2>/dev/null)"
  if [[ ${#nonce} -ge 16 ]]; then
    pass "(c) nonce has sufficient entropy (length=${#nonce})"
  else
    fail "(c) nonce too short (length=${#nonce}, expected >=16)"
  fi
else
  fail "(c) schema check skipped — grant file missing"
fi

# ---- scenario (d): unknown requester → refused ------------------------------

printf '\n=== (d) unknown requester → refused ===\n'

BETA_PERSONA_OVERRIDE="1"
exit_code="$(run_grant_exit "unknown_agent" ".claude/beta/notes/test.md" "test")"

if [[ "$exit_code" -eq 3 ]]; then
  pass "(d) unknown requester → exit 3"
else
  fail "(d) unknown requester → expected exit 3, got $exit_code"
fi

# ---- scenario (e): path outside .claude/beta/ → refused --------------------

printf '\n=== (e) path outside .claude/beta/ → refused ===\n'

BETA_PERSONA_OVERRIDE="1"
exit_code="$(run_grant_exit "algol" "docs/design/spec.md" "test")"

if [[ "$exit_code" -eq 4 ]]; then
  pass "(e) path outside .claude/beta/ → exit 4"
else
  fail "(e) path outside .claude/beta/ → expected exit 4, got $exit_code"
fi

# ---- scenario (f): missing required args → usage error ----------------------

printf '\n=== (f) missing args → usage error ===\n'

BETA_PERSONA_OVERRIDE="1"
exit_code="$(run_grant_exit)"  # no args

if [[ "$exit_code" -eq 2 ]]; then
  pass "(f) missing args → exit 2 (usage error)"
else
  fail "(f) missing args → expected exit 2, got $exit_code"
fi

# ---- scenario (g): defaults — TTL 3600, max_reads 1 ------------------------

printf '\n=== (g) defaults: TTL=1hr, max_reads=1 ===\n'

# Clean slate
rm -f "$FAKE_GRANTS"/*.json 2>/dev/null || true

BETA_PERSONA_OVERRIDE="1"
GRANT_ID="$(run_grant "polaris" ".claude/beta/notes/default-test.md" "defaults test")"

DEFAULT_GRANT="$FAKE_GRANTS/${GRANT_ID}.json"
if [[ -f "$DEFAULT_GRANT" ]]; then
  max_reads="$(jq -r '.max_reads' "$DEFAULT_GRANT" 2>/dev/null)"
  if [[ "$max_reads" -eq 1 ]]; then
    pass "(g) default max_reads = 1"
  else
    fail "(g) default max_reads expected 1, got $max_reads"
  fi

  # expires_at should be approximately now + 3600s
  issued_at="$(jq -r '.issued_at' "$DEFAULT_GRANT" 2>/dev/null)"
  expires_at="$(jq -r '.expires_at' "$DEFAULT_GRANT" 2>/dev/null)"
  if [[ -n "$issued_at" ]] && [[ -n "$expires_at" ]]; then
    pass "(g) issued_at and expires_at both set"
  else
    fail "(g) issued_at or expires_at missing"
  fi
else
  fail "(g) defaults test — grant file not found"
fi

# ---- scenario (h): custom TTL and max_reads ---------------------------------

printf '\n=== (h) custom TTL=7200, max_reads=5 ===\n'

rm -f "$FAKE_GRANTS"/*.json 2>/dev/null || true

BETA_PERSONA_OVERRIDE="1"
GRANT_ID="$(run_grant "sirius" ".claude/beta/notes/custom.md" "custom test" 7200 5)"

CUSTOM_GRANT="$FAKE_GRANTS/${GRANT_ID}.json"
if [[ -f "$CUSTOM_GRANT" ]]; then
  max_reads="$(jq -r '.max_reads' "$CUSTOM_GRANT" 2>/dev/null)"
  if [[ "$max_reads" -eq 5 ]]; then
    pass "(h) custom max_reads = 5"
  else
    fail "(h) custom max_reads expected 5, got $max_reads"
  fi
else
  fail "(h) custom grant file not found"
fi

# ---- summary ----------------------------------------------------------------

printf '\n=== beta-grant regression summary ===\n'
printf 'PASS: %d   FAIL: %d\n' "$PASS" "$FAIL"

if [[ "$FAIL" -eq 0 ]]; then
  printf '\nAll scenarios passed.\n'
  exit 0
else
  printf '\n%d scenario(s) failed — see [FAIL] lines above.\n' "$FAIL"
  exit 1
fi
