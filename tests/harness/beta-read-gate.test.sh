#!/usr/bin/env bash
# tests/harness/beta-read-gate.test.sh
# Regression test: C1 · read-gate-beta.sh
#
# Coverage:
#   (a) no grant directory → BLOCK (exit 1)
#   (b) active grant matching agent+path → ALLOW + reads_consumed incremented
#   (c) expired grant → BLOCK (exit 1)
#   (d) fully-consumed grant (reads_consumed >= max_reads) → BLOCK (exit 1)
#   (e) beta-mode flag + Beta caller → ALLOW (exit 0)
#   (f) tracked beta mode + Beta persona → ALLOW (exit 0)
#   (f2) Beta persona in genesis mode does not unlock private reads
#   (g) non-beta path → passthrough (exit 0, no gate)
#   (h) UNAUTHORIZED log entry written on BLOCK
#   (i) beta-mode codename override still requires a grant
#   (j) absolute, normalized, and symlinked beta paths cannot bypass the gate
#   (k) documented direct-child and recursive grant patterns match by boundary
#   (l) malformed grant schema fails closed
#
# Usage:
#   bash tests/harness/beta-read-gate.test.sh
#
# Exit codes:
#   0 — all assertions passed
#   1 — one or more assertions failed
#
# Dependencies: jq, bash

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOK="$REPO_ROOT/.claude/hooks/read-gate-beta.sh"

PASS=0
FAIL=0

pass() { printf '[PASS] %s\n' "$1"; PASS=$((PASS+1)); }
fail() { printf '[FAIL] %s\n' "$1"; FAIL=$((FAIL+1)); }

if [[ ! -f "$HOOK" ]]; then
  printf 'FATAL: hook not found at %s\n' "$HOOK" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  printf 'FATAL: jq is required\n' >&2
  exit 1
fi

# ---- temp environment -------------------------------------------------------

TMPDIR_RUN="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_RUN"' EXIT
TMPDIR_REAL="$(cd "$TMPDIR_RUN" && pwd -P)"

# Mirror just the paths the hook reads from the repo root
FAKE_BETA="$TMPDIR_RUN/.claude/beta"
FAKE_GRANTS="$FAKE_BETA/grants"
FAKE_LOG_DIR="$TMPDIR_RUN/.claude/hook-logs"
FAKE_SESSIONS="$TMPDIR_RUN/.claude/sessions"
FAKE_PERSONA="$TMPDIR_RUN/.claude/.current-persona"
PRIVATE_ROOT="${FAKE_BETA#"$TMPDIR_RUN"/}"
mkdir -p "$FAKE_GRANTS" "$FAKE_LOG_DIR" "$FAKE_SESSIONS"

# Utility: run hook from TMPDIR_RUN so all relative paths resolve there
run_hook() {
  local input="$1"
  (cd "$TMPDIR_RUN" && printf '%s' "$input" | env -i \
    PATH="$PATH" \
    WL_AGENT="${WL_AGENT_OVERRIDE:-unknown}" \
    WL_TASK_ID="TEST-READ-GATE" \
    bash "$HOOK" 2>/dev/null)
}

# Utility: run hook and capture exit code
run_hook_exit() {
  local input="$1"
  local exit_code=0
  run_hook "$input" >/dev/null || exit_code=$?
  printf '%s\n' "$exit_code"
}

# Helper: write a grant file
write_grant() {
  local grant_id="$1"
  local requester="$2"
  local path="$3"
  local max_reads="${4:-1}"
  local reads_consumed="${5:-0}"
  local expires_offset_secs="${6:-3600}"
  local expires_at
  expires_at="$(date -u -v "+${expires_offset_secs}S" +%FT%TZ 2>/dev/null \
    || date -u -d "+${expires_offset_secs} seconds" +%FT%TZ 2>/dev/null \
    || python3 -c "from datetime import datetime,timedelta,timezone; print((datetime.now(timezone.utc)+timedelta(seconds=${expires_offset_secs})).strftime('%Y-%m-%dT%H:%M:%SZ'))")"
  jq -n \
    --arg gid "$grant_id" \
    --arg req "$requester" \
    --arg p "$path" \
    --argjson max "$max_reads" \
    --argjson cons "$reads_consumed" \
    --arg exp "$expires_at" \
    '{
      grant_id: $gid,
      request_id: "req_test",
      requester: $req,
      files_granted: [$p],
      scope_reason: "test",
      issued_at: "2026-05-23T00:00:00Z",
      expires_at: $exp,
      max_reads: $max,
      reads_consumed: $cons,
      nonce: "0123456789abcdef0123456789abcdef"
    }' > "$FAKE_GRANTS/${grant_id}.json"
}

# ---- scenario (a): no grant directory → BLOCK --------------------------------

printf '\n=== (a) no grant directory → BLOCK ===\n'

# Remove grants dir to simulate missing
rm -rf "$FAKE_GRANTS"

INPUT='{"tool_name":"Read","tool_input":{"file_path":".claude/beta/notes/test.md"}}'
WL_AGENT_OVERRIDE="algol"
exit_code="$(run_hook_exit "$INPUT")"

if [[ "$exit_code" -eq 1 ]]; then
  pass "(a) no grant directory → exit 1 (BLOCKED)"
else
  fail "(a) no grant directory → expected exit 1, got $exit_code"
fi

# Restore grants dir for subsequent tests
mkdir -p "$FAKE_GRANTS"

# ---- scenario (b): active grant matching agent+path → ALLOW + decrement -----

printf '\n=== (b) active grant → ALLOW + reads_consumed incremented ===\n'

write_grant "g_testactive" "algol" ".claude/beta/notes/test.md" 3 1 3600

INPUT='{"tool_name":"Read","tool_input":{"file_path":".claude/beta/notes/test.md"}}'
WL_AGENT_OVERRIDE="algol"
exit_code="$(run_hook_exit "$INPUT")"

if [[ "$exit_code" -eq 0 ]]; then
  pass "(b) active grant → exit 0 (ALLOWED)"
else
  fail "(b) active grant → expected exit 0, got $exit_code"
fi

# Verify reads_consumed was incremented (1 → 2)
new_consumed="$(jq -r '.reads_consumed' "$FAKE_GRANTS/g_testactive.json" 2>/dev/null || echo "?")"
if [[ "$new_consumed" -eq 2 ]]; then
  pass "(b) reads_consumed incremented 1 → 2"
else
  fail "(b) reads_consumed not incremented correctly (got $new_consumed, expected 2)"
fi

# ---- scenario (c): expired grant → BLOCK ------------------------------------

printf '\n=== (c) expired grant → BLOCK ===\n'

# Remove previous grant
rm -f "$FAKE_GRANTS/g_testactive.json"

# Write grant with negative TTL (already expired)
EXPIRED_AT="$(date -u -v "-3600S" +%FT%TZ 2>/dev/null \
  || date -u -d "-3600 seconds" +%FT%TZ 2>/dev/null \
  || python3 -c "from datetime import datetime,timedelta,timezone; print((datetime.now(timezone.utc)-timedelta(hours=1)).strftime('%Y-%m-%dT%H:%M:%SZ'))")"
jq -n \
  --arg exp "$EXPIRED_AT" \
  '{
    grant_id: "g_expired",
    request_id: "req_exp",
    requester: "algol",
    files_granted: [".claude/beta/notes/test.md"],
    scope_reason: "test",
    issued_at: "2026-05-23T00:00:00Z",
    expires_at: $exp,
    max_reads: 5,
    reads_consumed: 0,
    nonce: "testnonce2"
  }' > "$FAKE_GRANTS/g_expired.json"

INPUT='{"tool_name":"Read","tool_input":{"file_path":".claude/beta/notes/test.md"}}'
WL_AGENT_OVERRIDE="algol"
exit_code="$(run_hook_exit "$INPUT")"

if [[ "$exit_code" -eq 1 ]]; then
  pass "(c) expired grant → exit 1 (BLOCKED)"
else
  fail "(c) expired grant → expected exit 1, got $exit_code"
fi

rm -f "$FAKE_GRANTS/g_expired.json"

# ---- scenario (d): fully consumed grant → BLOCK ----------------------------

printf '\n=== (d) fully consumed grant → BLOCK ===\n'

write_grant "g_consumed" "algol" ".claude/beta/notes/test.md" 2 2 3600

INPUT='{"tool_name":"Read","tool_input":{"file_path":".claude/beta/notes/test.md"}}'
WL_AGENT_OVERRIDE="algol"
exit_code="$(run_hook_exit "$INPUT")"

if [[ "$exit_code" -eq 1 ]]; then
  pass "(d) fully consumed grant → exit 1 (BLOCKED)"
else
  fail "(d) fully consumed grant → expected exit 1, got $exit_code"
fi

rm -f "$FAKE_GRANTS/g_consumed.json"

# ---- scenario (e): BETA_PERSONA_LOADED=1 → ALLOW unconditionally -----------

printf '\n=== (e) BETA_PERSONA_LOADED=1 → ALLOW bypass ===\n'

# No grants at all — should still ALLOW because BETA_PERSONA_LOADED=1
rm -f "$FAKE_GRANTS"/*.json 2>/dev/null || true

INPUT='{"tool_name":"Read","tool_input":{"file_path":".claude/beta/private/secret.md"}}'

exit_code=0
(cd "$TMPDIR_RUN" && printf '%s' "$INPUT" | env -i \
  PATH="$PATH" \
  BETA_PERSONA_LOADED=1 \
  WL_AGENT="beta" \
  WL_TASK_ID="TEST-READ-GATE" \
  bash "$HOOK" 2>/dev/null) || exit_code=$?

if [[ "$exit_code" -eq 0 ]]; then
  pass "(e) BETA_PERSONA_LOADED=1 → exit 0 (bypass ALLOW)"
else
  fail "(e) BETA_PERSONA_LOADED=1 → expected exit 0, got $exit_code"
fi

# ---- scenario (f): .current-persona = "beta" → ALLOW bypass ----------------

printf '\n=== (f) .current-persona = beta → ALLOW bypass ===\n'

printf '%s\n' '{"persona":"beta","session_mode":"beta","timestamp":"2026-05-23T00:00:00Z"}' \
  > "$FAKE_PERSONA"

INPUT='{"tool_name":"Read","tool_input":{"file_path":".claude/beta/private/secret.md"}}'
WL_AGENT_OVERRIDE="beta"
exit_code="$(run_hook_exit "$INPUT")"

if [[ "$exit_code" -eq 0 ]]; then
  pass "(f) .current-persona=beta → exit 0 (bypass ALLOW)"
else
  fail "(f) .current-persona=beta → expected exit 0, got $exit_code"
fi

printf '\n=== (f2) beta persona in genesis mode remains gated ===\n'

printf '%s\n' '{"persona":"beta","session_mode":"genesis","timestamp":"2026-05-23T00:00:00Z"}' \
  > "$FAKE_PERSONA"
WL_AGENT_OVERRIDE="beta"
exit_code="$(run_hook_exit "$INPUT")"
if [[ "$exit_code" -eq 1 ]]; then
  pass "(f2) genesis mode cannot inherit Beta private-read authority"
else
  fail "(f2) genesis-mode Beta persona bypassed gate (exit $exit_code)"
fi

# Clean persona file so it doesn't pollute other tests
rm -f "$FAKE_PERSONA"

# ---- scenario (g): non-beta path → passthrough (exit 0, no gate) -----------

printf '\n=== (g) non-beta path → passthrough ===\n'

INPUT='{"tool_name":"Read","tool_input":{"file_path":"docs/design/spec.md"}}'
WL_AGENT_OVERRIDE="algol"
exit_code="$(run_hook_exit "$INPUT")"

if [[ "$exit_code" -eq 0 ]]; then
  pass "(g) non-beta path → exit 0 (passthrough)"
else
  fail "(g) non-beta path → expected exit 0, got $exit_code"
fi

# ---- scenario (h): UNAUTHORIZED log entry on BLOCK -------------------------

printf '\n=== (h) UNAUTHORIZED log entry written on BLOCK ===\n'

rm -f "$FAKE_GRANTS"/*.json 2>/dev/null || true
mkdir -p "$FAKE_BETA"

INPUT='{"tool_name":"Read","tool_input":{"file_path":".claude/beta/notes/audit.md"}}'
WL_AGENT_OVERRIDE="canopus"

# Run and discard exit code (expect 1)
(cd "$TMPDIR_RUN" && printf '%s' "$INPUT" | env -i \
  PATH="$PATH" \
  WL_AGENT="canopus" \
  WL_TASK_ID="TEST-READ-GATE" \
  bash "$HOOK" 2>/dev/null) || true

# Check the hook log for UNAUTHORIZED marker
GATE_LOG="$FAKE_LOG_DIR/TEST-READ-GATE--read-gate.log"
if [[ -f "$GATE_LOG" ]] && grep -q "UNAUTHORIZED" "$GATE_LOG" 2>/dev/null; then
  pass "(h) UNAUTHORIZED marker written to read-gate log"
else
  fail "(h) UNAUTHORIZED marker not found in read-gate log (log: $GATE_LOG)"
fi

# ---- scenario (i): beta-mode codename override needs grant -----------------

printf '\n=== (i) beta-mode codename override still gated ===\n'

rm -f "$FAKE_GRANTS"/*.json 2>/dev/null || true
printf '%s\n' '{"persona":"polaris","session_mode":"beta","timestamp":"2026-05-23T00:00:00Z"}' \
  > "$FAKE_PERSONA"
INPUT="$(jq -cn --arg p "$PRIVATE_ROOT/private/secret.md" \
  '{tool_name:"Read",tool_input:{file_path:$p}}')"
exit_code=0
(cd "$TMPDIR_RUN" && printf '%s' "$INPUT" | env -i \
  PATH="$PATH" BETA_PERSONA_LOADED=1 WL_AGENT="polaris" \
  WL_TASK_ID="TEST-READ-GATE" bash "$HOOK" >/dev/null 2>/dev/null) || exit_code=$?

if [[ "$exit_code" -eq 1 ]]; then
  pass "(i) non-Beta codename override cannot inherit Beta's read bypass"
else
  fail "(i) beta-mode Polaris read expected BLOCK, got exit $exit_code"
fi
rm -f "$FAKE_PERSONA"

# ---- scenario (j): absolute and normalized paths remain gated --------------

printf '\n=== (j) absolute and normalized beta paths gated ===\n'

absolute_target="$TMPDIR_REAL/$PRIVATE_ROOT/private/secret.md"
INPUT="$(jq -cn --arg p "$absolute_target" '{tool_name:"Read",tool_input:{file_path:$p}}')"
WL_AGENT_OVERRIDE="algol"
exit_code="$(run_hook_exit "$INPUT")"
if [[ "$exit_code" -eq 1 ]]; then
  pass "(j) absolute private path is gated"
else
  fail "(j) absolute private path bypassed gate (exit $exit_code)"
fi

mkdir -p "$TMPDIR_RUN/.claude/other"
normalized_target="$TMPDIR_REAL/.claude/other/../${PRIVATE_ROOT#*/}/private/secret.md"
INPUT="$(jq -cn --arg p "$normalized_target" '{tool_name:"Read",tool_input:{file_path:$p}}')"
exit_code="$(run_hook_exit "$INPUT")"
if [[ "$exit_code" -eq 1 ]]; then
  pass "(j) dot-dot-normalized private path is gated"
else
  fail "(j) normalized private path bypassed gate (exit $exit_code)"
fi

INPUT="$(jq -cn --arg p "$PRIVATE_ROOT" '{tool_name:"Read",tool_input:{file_path:$p}}')"
exit_code="$(run_hook_exit "$INPUT")"
if [[ "$exit_code" -eq 1 ]]; then
  pass "(j) private root directory itself is gated"
else
  fail "(j) private root directory bypassed gate (exit $exit_code)"
fi

mkdir -p "$TMPDIR_RUN/$PRIVATE_ROOT/private"
printf 'private\n' > "$TMPDIR_RUN/$PRIVATE_ROOT/private/secret.md"
ln -s "$PRIVATE_ROOT/private/secret.md" "$TMPDIR_RUN/private-link.md"
INPUT="$(jq -cn --arg p "private-link.md" '{tool_name:"Read",tool_input:{file_path:$p}}')"
exit_code="$(run_hook_exit "$INPUT")"
if [[ "$exit_code" -eq 1 ]]; then
  pass "(j) symlink to a private file is gated"
else
  fail "(j) symlinked private file bypassed gate (exit $exit_code)"
fi

# ---- scenario (k): documented glob semantics -------------------------------

printf '\n=== (k) grant glob semantics and boundaries ===\n'

rm -f "$FAKE_GRANTS"/*.json 2>/dev/null || true
write_grant "g_direct" "algol" "$PRIVATE_ROOT/notes/*" 2 0 3600

INPUT="$(jq -cn --arg p "$PRIVATE_ROOT/notes/direct.md" '{tool_name:"Read",tool_input:{file_path:$p}}')"
exit_code="$(run_hook_exit "$INPUT")"
if [[ "$exit_code" -eq 0 ]]; then
  pass "(k) direct-child grant allows a direct child"
else
  fail "(k) direct-child grant rejected direct child (exit $exit_code)"
fi

INPUT="$(jq -cn --arg p "$PRIVATE_ROOT/notes/nested/file.md" '{tool_name:"Read",tool_input:{file_path:$p}}')"
exit_code="$(run_hook_exit "$INPUT")"
if [[ "$exit_code" -eq 1 ]]; then
  pass "(k) direct-child grant rejects nested descendants"
else
  fail "(k) direct-child grant allowed nested descendant (exit $exit_code)"
fi

rm -f "$FAKE_GRANTS"/*.json 2>/dev/null || true
write_grant "g_recursive" "algol" "$PRIVATE_ROOT/notes/**" 3 0 3600

INPUT="$(jq -cn --arg p "$PRIVATE_ROOT/notes/nested/file.md" '{tool_name:"Read",tool_input:{file_path:$p}}')"
exit_code="$(run_hook_exit "$INPUT")"
if [[ "$exit_code" -eq 0 ]]; then
  pass "(k) recursive grant allows nested descendant"
else
  fail "(k) recursive grant rejected nested descendant (exit $exit_code)"
fi

INPUT="$(jq -cn --arg p "$PRIVATE_ROOT/noteworthy/file.md" '{tool_name:"Read",tool_input:{file_path:$p}}')"
exit_code="$(run_hook_exit "$INPUT")"
if [[ "$exit_code" -eq 1 ]]; then
  pass "(k) recursive grant enforces directory boundary"
else
  fail "(k) recursive grant matched sibling prefix (exit $exit_code)"
fi

# ---- scenario (l): malformed grant fails closed ----------------------------

printf '\n=== (l) malformed grant fails closed ===\n'

rm -f "$FAKE_GRANTS"/*.json 2>/dev/null || true
jq -n --arg p "$PRIVATE_ROOT/notes/test.md" '{
  grant_id: "g_malformed",
  request_id: "req_malformed",
  requester: "algol",
  files_granted: [$p],
  scope_reason: "missing expiry",
  issued_at: "2026-05-23T00:00:00Z",
  max_reads: 1,
  reads_consumed: 0,
  nonce: "0123456789abcdef0123456789abcdef"
}' > "$FAKE_GRANTS/g_malformed.json"

INPUT="$(jq -cn --arg p "$PRIVATE_ROOT/notes/test.md" '{tool_name:"Read",tool_input:{file_path:$p}}')"
exit_code="$(run_hook_exit "$INPUT")"
if [[ "$exit_code" -eq 1 ]]; then
  pass "(l) grant missing expires_at fails closed"
else
  fail "(l) malformed grant allowed read (exit $exit_code)"
fi

# ---- summary ----------------------------------------------------------------

printf '\n=== beta-read-gate regression summary ===\n'
printf 'PASS: %d   FAIL: %d\n' "$PASS" "$FAIL"

if [[ "$FAIL" -eq 0 ]]; then
  printf '\nAll scenarios passed.\n'
  exit 0
else
  printf '\n%d scenario(s) failed — see [FAIL] lines above.\n' "$FAIL"
  exit 1
fi
