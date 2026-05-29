#!/usr/bin/env bash
# tests/harness/parse-conversation.test.ts
# Regression test: C6 · parse-conversation skill (parse.sh)
#
# Coverage:
#   (a) GENESIS source → BETA target: ALLOW (GENESIS→BETA combo)
#   (b) GENESIS source → GENESIS target: ALLOW (GENESIS→GENESIS combo)
#   (c) BETA source → BETA target: ALLOW (same private space)
#   (d) BETA source → GENESIS target without grant: BLOCK (exit 1)
#   (e) BETA source → GENESIS target WITH active grant: ALLOW
#   (f) template substitution — static fields pre-filled in output
#   (g) source mode read from C7 session metadata file
#   (h) missing session_id → graceful error exit 4, no output file written
#   (i) unknown flag → exit 2 (usage error)
#   (j) missing required arg (session_id) → exit 2 (usage error)
#
# Uses staged parse.sh at .claude/skill-staging/parse-conversation/parse.sh
# (not yet installed to ~/.claude/skills/ — Polaris install step pending)
#
# Usage:
#   bash tests/harness/parse-conversation.test.ts
#
# Exit codes:
#   0 — all scenarios passed
#   1 — one or more scenarios failed

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SKILL_SCRIPT="$REPO_ROOT/.claude/skill-staging/parse-conversation/parse.sh"

PASS=0
FAIL=0

pass() { printf '[PASS] %s\n' "$1"; PASS=$((PASS+1)); }
fail() { printf '[FAIL] %s\n' "$1"; FAIL=$((FAIL+1)); }

if [[ ! -f "$SKILL_SCRIPT" ]]; then
  printf 'FATAL: parse.sh not found at %s\n' "$SKILL_SCRIPT" >&2
  printf 'NOTE: parse.sh staged at .claude/skill-staging/; run Polaris install step first\n' >&2
  exit 1
fi

TMPDIR_RUN="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_RUN"' EXIT

# Mirror the directory structure parse.sh expects relative to CWD
SESSIONS_DIR="$TMPDIR_RUN/.claude/sessions"
PARSES_DIR="$TMPDIR_RUN/.claude/parses"
GRANTS_DIR="$TMPDIR_RUN/.claude/beta/grants"
TEMPLATES_DIR="$TMPDIR_RUN/.claude/parse-templates"
CURRENT_PERSONA_FILE="$TMPDIR_RUN/.claude/.current-persona"
mkdir -p "$SESSIONS_DIR" "$PARSES_DIR" "$GRANTS_DIR" "$TEMPLATES_DIR"
mkdir -p "$(dirname "$CURRENT_PERSONA_FILE")"

# Create minimal templates (parse.sh requires at least for-beta.md, for-polaris.md, default.md)
cat > "$TEMPLATES_DIR/for-beta.md" <<'TMPL'
# Beta parse: {{session_id}} · {{session_date}}
turn_count: {{turn_count}}
participants: {{participants_list}}
TMPL

cat > "$TEMPLATES_DIR/for-polaris.md" <<'TMPL'
# Polaris parse: {{session_id}} · {{session_date}}
TMPL

cat > "$TEMPLATES_DIR/for-algol.md" <<'TMPL'
# Algol parse: {{session_id}} · {{session_date}}
TMPL

cat > "$TEMPLATES_DIR/default.md" <<'TMPL'
# Default parse: {{session_id}} · {{session_date}}
TMPL

# Helper: write session metadata
write_session_meta() {
  local session_id="$1"
  local mode="$2"
  local excerpt="${3:-first message}"
  jq -n \
    --arg sid "$session_id" \
    --arg mode "$mode" \
    --arg exc "$excerpt" \
    '{
      session_id: $sid,
      mode: $mode,
      started_at: "2026-05-23T00:00:00Z",
      first_message_excerpt: $exc,
      resolved_by: "test"
    }' > "$SESSIONS_DIR/${session_id}.meta.json"
}

# Helper: write a minimal JSONL session file
write_session_file() {
  local session_id="$1"
  local mode="$2"
  local file="$TMPDIR_RUN/session-${session_id}.jsonl"
  printf '{"role":"user","content":"hello from session %s (mode: %s)","timestamp":"2026-05-23T12:00:00Z"}\n' \
    "$session_id" "$mode" > "$file"
  printf '{"role":"assistant","content":"acknowledged","timestamp":"2026-05-23T12:01:00Z"}\n' >> "$file"
  echo "$file"
}

# Helper: run parse.sh from TMPDIR_RUN
run_parse() {
  local session_id="$1"
  local for_persona="${2:-default}"
  local source_mode="${3:-genesis}"
  local target_mode="${4:-genesis}"
  local grant_override="${5:-}"
  local exit_code=0
  local session_file
  session_file="$(write_session_file "$session_id" "$source_mode")"

  (cd "$TMPDIR_RUN" && env -i \
    PATH="$PATH" \
    HOME="$HOME" \
    SESSION_MODE="$target_mode" \
    CLAUDE_SESSION_FILE="$session_file" \
    bash "$SKILL_SCRIPT" "$session_id" --for "$for_persona" 2>/dev/null) || exit_code=$?
  echo "$exit_code"
}

# Helper: run parse.sh and return full stdout+stderr
run_parse_verbose() {
  local session_id="$1"
  local for_persona="${2:-default}"
  local target_mode="${3:-genesis}"
  local session_file
  session_file="$(write_session_file "$session_id" "$target_mode")"

  (cd "$TMPDIR_RUN" && env -i \
    PATH="$PATH" \
    HOME="$HOME" \
    SESSION_MODE="$target_mode" \
    CLAUDE_SESSION_FILE="$session_file" \
    bash "$SKILL_SCRIPT" "$session_id" --for "$for_persona" 2>&1) || true
}

# Helper: check if output file exists for a session
output_exists() {
  local session_id="$1"
  find "$PARSES_DIR" -name "${session_id}__for-*__*.md" 2>/dev/null | wc -l | tr -d ' '
}

# Helper: write a valid parse-scoped grant
write_parse_grant() {
  local grant_id="$1"
  local expires_at
  expires_at="$(date -u -v "+3600S" +%FT%TZ 2>/dev/null \
    || date -u -d "+3600 seconds" +%FT%TZ 2>/dev/null \
    || python3 -c "from datetime import datetime,timedelta,timezone; print((datetime.now(timezone.utc)+timedelta(hours=1)).strftime('%Y-%m-%dT%H:%M:%SZ'))")"
  jq -n \
    --arg gid "$grant_id" \
    --arg exp "$expires_at" \
    '{
      grant_id: $gid,
      request_id: "req_parse",
      requester: "polaris",
      files_granted: [".claude/beta/**"],
      scope_reason: "parse session for review",
      issued_at: "2026-05-23T00:00:00Z",
      expires_at: $exp,
      max_reads: 5,
      reads_consumed: 0,
      nonce: "testnonce_parse"
    }' > "$GRANTS_DIR/${grant_id}.json"
}

# ---- scenario (a): GENESIS→BETA → ALLOW ------------------------------------

printf '\n=== (a) GENESIS→BETA → ALLOW ===\n'

SID_A="test-genesis-to-beta"
write_session_meta "$SID_A" "genesis"

rm -f "$PARSES_DIR"/*.md 2>/dev/null || true
exit_code="$(run_parse "$SID_A" "beta" "genesis" "beta")"

if [[ "$exit_code" -eq 0 ]]; then
  pass "(a) GENESIS→BETA → exit 0 (ALLOW)"
else
  fail "(a) GENESIS→BETA → expected exit 0, got $exit_code"
fi

out_count="$(output_exists "$SID_A")"
if [[ "$out_count" -ge 1 ]]; then
  pass "(a) output file written"
else
  fail "(a) output file not written (count=$out_count)"
fi

# ---- scenario (b): GENESIS→GENESIS → ALLOW ---------------------------------

printf '\n=== (b) GENESIS→GENESIS → ALLOW ===\n'

SID_B="test-genesis-to-genesis"
write_session_meta "$SID_B" "genesis"

rm -f "$PARSES_DIR"/*.md 2>/dev/null || true
exit_code="$(run_parse "$SID_B" "polaris" "genesis" "genesis")"

if [[ "$exit_code" -eq 0 ]]; then
  pass "(b) GENESIS→GENESIS → exit 0 (ALLOW)"
else
  fail "(b) GENESIS→GENESIS → expected exit 0, got $exit_code"
fi

# ---- scenario (c): BETA→BETA → ALLOW ---------------------------------------

printf '\n=== (c) BETA→BETA → ALLOW ===\n'

SID_C="test-beta-to-beta"
write_session_meta "$SID_C" "beta"

rm -f "$PARSES_DIR"/*.md 2>/dev/null || true
exit_code="$(run_parse "$SID_C" "beta" "beta" "beta")"

if [[ "$exit_code" -eq 0 ]]; then
  pass "(c) BETA→BETA → exit 0 (ALLOW)"
else
  fail "(c) BETA→BETA → expected exit 0, got $exit_code"
fi

# ---- scenario (d): BETA→GENESIS without grant → BLOCK ----------------------

printf '\n=== (d) BETA→GENESIS (no grant) → BLOCK ===\n'

SID_D="test-beta-to-genesis-nogrant"
write_session_meta "$SID_D" "beta"

# Ensure no grants
rm -f "$GRANTS_DIR"/*.json 2>/dev/null || true

rm -f "$PARSES_DIR"/*.md 2>/dev/null || true
exit_code="$(run_parse "$SID_D" "polaris" "beta" "genesis")"

if [[ "$exit_code" -eq 1 ]]; then
  pass "(d) BETA→GENESIS (no grant) → exit 1 (BLOCK)"
else
  fail "(d) BETA→GENESIS (no grant) → expected exit 1, got $exit_code"
fi

out_count="$(output_exists "$SID_D")"
if [[ "$out_count" -eq 0 ]]; then
  pass "(d) no output file written when blocked"
else
  fail "(d) output file was written despite BLOCK (count=$out_count)"
fi

# ---- scenario (e): BETA→GENESIS WITH active grant → ALLOW ------------------

printf '\n=== (e) BETA→GENESIS with active parse grant → ALLOW ===\n'

SID_E="test-beta-to-genesis-with-grant"
write_session_meta "$SID_E" "beta"

write_parse_grant "g_parse_active"

rm -f "$PARSES_DIR"/*.md 2>/dev/null || true
exit_code="$(run_parse "$SID_E" "polaris" "beta" "genesis")"

if [[ "$exit_code" -eq 0 ]]; then
  pass "(e) BETA→GENESIS with active grant → exit 0 (ALLOW)"
else
  fail "(e) BETA→GENESIS with active grant → expected exit 0, got $exit_code"
fi

rm -f "$GRANTS_DIR"/*.json 2>/dev/null || true

# ---- scenario (f): template substitution — static fields pre-filled --------

printf '\n=== (f) template substitution — static fields pre-filled ===\n'

SID_F="test-template-sub"
write_session_meta "$SID_F" "genesis"
rm -f "$PARSES_DIR"/*.md 2>/dev/null || true

run_parse "$SID_F" "default" "genesis" "genesis" >/dev/null

output_file="$(find "$PARSES_DIR" -name "${SID_F}__for-default__*.md" 2>/dev/null | head -1)"

if [[ -n "$output_file" ]] && [[ -f "$output_file" ]]; then
  pass "(f) output file found: $(basename "$output_file")"
  # session_id should be substituted
  if grep -q "$SID_F" "$output_file" 2>/dev/null; then
    pass "(f) session_id substituted in output"
  else
    fail "(f) session_id not found in output file"
  fi
  # source_mode should appear in metadata comment
  if grep -q "source_mode" "$output_file" 2>/dev/null; then
    pass "(f) source_mode metadata in output"
  else
    fail "(f) source_mode metadata missing from output"
  fi
else
  fail "(f) output file not found for template substitution test"
fi

# ---- scenario (g): source mode read from C7 session metadata ----------------

printf '\n=== (g) source mode from C7 session metadata ===\n'

# When session meta says mode=beta, parse.sh should use source_mode=beta
SID_G="test-source-mode-from-meta"
write_session_meta "$SID_G" "beta"

# TARGET is also beta → should ALLOW (BETA→BETA)
rm -f "$PARSES_DIR"/*.md 2>/dev/null || true
exit_code="$(run_parse "$SID_G" "beta" "beta" "beta")"

if [[ "$exit_code" -eq 0 ]]; then
  pass "(g) source mode beta read from session meta → BETA→BETA ALLOW"
else
  fail "(g) source mode from session meta failed (exit $exit_code)"
fi

output_file_g="$(find "$PARSES_DIR" -name "${SID_G}__for-beta__*.md" 2>/dev/null | head -1)"
if [[ -n "$output_file_g" ]] && grep -q "source_mode: beta" "$output_file_g" 2>/dev/null; then
  pass "(g) source_mode=beta reflected in output metadata"
else
  fail "(g) source_mode=beta not reflected in output metadata"
fi

# ---- scenario (h): missing session_id → graceful error, no output ----------

printf '\n=== (h) missing session_id → graceful error, no output file ===\n'

rm -f "$PARSES_DIR"/*.md 2>/dev/null || true

exit_code=0
(cd "$TMPDIR_RUN" && env -i \
  PATH="$PATH" HOME="$HOME" SESSION_MODE="genesis" \
  CLAUDE_SESSION_FILE="/nonexistent/path/session.jsonl" \
  bash "$SKILL_SCRIPT" "no-such-session-$$" --for default 2>/dev/null) || exit_code=$?

# Should exit 4 (session file not found) — not 0
if [[ "$exit_code" -ne 0 ]]; then
  pass "(h) missing session → non-zero exit ($exit_code)"
else
  fail "(h) missing session → expected non-zero exit, got 0"
fi

# ---- scenario (i): unknown flag → exit 2 ------------------------------------

printf '\n=== (i) unknown flag → exit 2 ===\n'

exit_code=0
(cd "$TMPDIR_RUN" && env -i \
  PATH="$PATH" HOME="$HOME" \
  bash "$SKILL_SCRIPT" "some-session" --unknown-flag 2>/dev/null) || exit_code=$?

if [[ "$exit_code" -eq 2 ]]; then
  pass "(i) unknown flag → exit 2"
else
  fail "(i) unknown flag → expected exit 2, got $exit_code"
fi

# ---- scenario (j): missing required arg → exit 2 ----------------------------

printf '\n=== (j) missing session_id arg → exit 2 ===\n'

exit_code=0
(cd "$TMPDIR_RUN" && env -i \
  PATH="$PATH" HOME="$HOME" \
  bash "$SKILL_SCRIPT" 2>/dev/null) || exit_code=$?

if [[ "$exit_code" -eq 2 ]]; then
  pass "(j) missing session_id → exit 2 (usage error)"
else
  fail "(j) missing session_id → expected exit 2, got $exit_code"
fi

# ---- summary ----------------------------------------------------------------

printf '\n=== parse-conversation regression summary ===\n'
printf 'PASS: %d   FAIL: %d\n' "$PASS" "$FAIL"

if [[ "$FAIL" -eq 0 ]]; then
  printf '\nAll scenarios passed.\n'
  exit 0
else
  printf '\n%d scenario(s) failed — see [FAIL] lines above.\n' "$FAIL"
  exit 1
fi
