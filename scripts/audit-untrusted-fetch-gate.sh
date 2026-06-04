#!/usr/bin/env bash
# scripts/audit-untrusted-fetch-gate.sh
# Standalone audit + regression suite for .claude/hooks/untrusted-fetch-gate.sh
#
# USAGE:
#   bash scripts/audit-untrusted-fetch-gate.sh [--verbose]
#
# EXIT:
#   0 — all cases pass
#   1 — one or more cases failed
#
# POLICY-NO-INPLACE-MUTATION: All tests operate on TEMP COPIES of the hook and
# the allowlist. A trap restores on every exit path. Real tracked files are
# NEVER mutated by this script.
#
# BASH SAFETY: no curl/wget/rm/destructive commands. TEMP COPIES cleaned by
# rm -rf on trap (trap rm is the designated cleanup form per POLICY).
#
# Owner: Canopus · α-HRN-07
# Task: TASK-2026-06-04-INTEGRITY-HASH-ON-WRITE (M3 sensor)

set -uo pipefail

REPO_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
HOOK="$REPO_DIR/.claude/hooks/untrusted-fetch-gate.sh"
REAL_ALLOWLIST="$REPO_DIR/.harness/fetch-allowlist.txt"

VERBOSE=false
[[ "${1:-}" == "--verbose" ]] && VERBOSE=true

PASS=0
FAIL=0
SKIP=0

# ---------------------------------------------------------------------------
# Temp workspace — TEMP COPY only, never mutate real files
# ---------------------------------------------------------------------------
TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t 'audit-fetch-gate')"
TMP_ALLOWLIST="$TMP_DIR/fetch-allowlist.txt"
TMP_LOG="$TMP_DIR/fetch-gate-test.log"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM HUP

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------
log_info() { printf '[audit-fetch-gate] %s\n' "$*"; }
log_pass() { printf '[PASS] %s\n' "$*"; PASS=$(( PASS + 1 )); }
log_fail() { printf '[FAIL] %s\n' "$*" >&2; FAIL=$(( FAIL + 1 )); }
log_verbose() { $VERBOSE && printf '  ... %s\n' "$*" || true; }

# ---------------------------------------------------------------------------
# Preflight: verify hook and allowlist exist
# ---------------------------------------------------------------------------
preflight_ok=true
if [[ ! -f "$HOOK" ]]; then
  log_info "PREFLIGHT FAIL: hook not found at $HOOK"
  preflight_ok=false
fi
if [[ ! -f "$REAL_ALLOWLIST" ]]; then
  log_info "PREFLIGHT FAIL: allowlist not found at $REAL_ALLOWLIST"
  preflight_ok=false
fi
if ! $preflight_ok; then
  log_info "Cannot proceed — required files missing."
  exit 1
fi

# ---------------------------------------------------------------------------
# bash -n syntax check (no execution, no mutation)
# ---------------------------------------------------------------------------
log_info "Syntax check..."
if bash -n "$HOOK" 2>&1; then
  log_pass "syntax: hook passes bash -n"
else
  log_fail "syntax: hook fails bash -n"
fi

# ---------------------------------------------------------------------------
# Verify real allowlist contains the three required seed domains
# ---------------------------------------------------------------------------
log_info "Allowlist seed check..."
for required_domain in "github.com" "mager.co" "loooom.xyz"; do
  if grep -qE "^[[:space:]]*${required_domain}[[:space:]]*$" "$REAL_ALLOWLIST" 2>/dev/null; then
    log_pass "allowlist seed: $required_domain present"
  else
    log_fail "allowlist seed: $required_domain MISSING from $REAL_ALLOWLIST"
  fi
done

# Verify __WEBSEARCH_ALLOW__ token is present by default
if grep -qE '^[[:space:]]*__WEBSEARCH_ALLOW__[[:space:]]*$' "$REAL_ALLOWLIST" 2>/dev/null; then
  log_pass "allowlist seed: __WEBSEARCH_ALLOW__ token present (WebSearch enabled by default)"
else
  log_fail "allowlist seed: __WEBSEARCH_ALLOW__ token MISSING — WebSearch will be blocked"
fi

# ---------------------------------------------------------------------------
# run_gate <label> <expected_exit> <json_payload> [env_overrides...]
# Runs the hook (via TEMP COPY of allowlist) with the given JSON on stdin.
# Compares actual exit code to expected_exit.
# ---------------------------------------------------------------------------
run_gate() {
  local label="$1"
  local expected_exit="$2"
  local json_payload="$3"
  shift 3
  # remaining args: env overrides (VAR=val pairs)

  local env_prefix=""
  for override in "$@"; do
    env_prefix="$env_prefix $override"
  done

  local actual_exit=0
  local output=""

  # Run with WL_FETCH_ALLOWLIST pointing at the TEMP COPY so we can mutate it
  # without touching the real file. WL_AGENT and CLAUDE_TASK_ID are stubbed.
  output="$(
    WL_FETCH_ALLOWLIST="$TMP_ALLOWLIST" \
    WL_AGENT="test-agent" \
    CLAUDE_TASK_ID="TEST-AUDIT-FETCH-GATE" \
    CLAUDE_PROJECT_DIR="$REPO_DIR" \
    ${env_prefix} \
    bash "$HOOK" <<< "$json_payload" 2>&1
  )" || actual_exit=$?

  log_verbose "label=$label expected=$expected_exit actual=$actual_exit output=${output:0:120}"

  if [[ "$actual_exit" -eq "$expected_exit" ]]; then
    log_pass "$label (exit=$actual_exit)"
    return 0
  else
    log_fail "$label — expected exit=$expected_exit, got exit=$actual_exit; output=${output:0:200}"
    return 1
  fi
}

# ---------------------------------------------------------------------------
# Helpers to build JSON payloads (no real network — synthetic inputs only)
# ---------------------------------------------------------------------------
webfetch_payload() {
  local url="$1"
  printf '{"tool_name":"WebFetch","tool_input":{"url":"%s"}}' "$url"
}

websearch_payload() {
  local query="$1"
  printf '{"tool_name":"WebSearch","tool_input":{"query":"%s"}}' "$query"
}

other_tool_payload() {
  local name="$1"
  printf '{"tool_name":"%s","tool_input":{}}' "$name"
}

# ---------------------------------------------------------------------------
# Populate the TEMP allowlist with the same content as the real one.
# All tests below use TMP_ALLOWLIST so the real file is never touched.
# ---------------------------------------------------------------------------
setup_allowlist() {
  # TEMP COPY — real file untouched. 'cat' is safe read-only.
  cat "$REAL_ALLOWLIST" > "$TMP_ALLOWLIST"
}

# ---------------------------------------------------------------------------
# TEST GROUP 1: Non-WebFetch/WebSearch tools pass through unconditionally
# ---------------------------------------------------------------------------
log_info "Group 1: non-fetch tools pass through..."
setup_allowlist

run_gate "pass-through: Bash tool"  0 "$(other_tool_payload "Bash")"
run_gate "pass-through: Write tool" 0 "$(other_tool_payload "Write")"
run_gate "pass-through: Read tool"  0 "$(other_tool_payload "Read")"

# ---------------------------------------------------------------------------
# TEST GROUP 2: Allowlisted domains — must ALLOW (exit 0)
# ---------------------------------------------------------------------------
log_info "Group 2: allowlisted domains..."
setup_allowlist

run_gate "allow: github.com exact"           0 "$(webfetch_payload "https://github.com/foo/bar")"
run_gate "allow: github.com subdomain (api)" 0 "$(webfetch_payload "https://api.github.com/repos/foo")"
# raw.githubusercontent.com has the registered domain "githubusercontent.com" —
# a distinct eTLD+1 from "github.com". Both are in the allowlist explicitly.
run_gate "allow: githubusercontent.com (raw subdomain)" 0 "$(webfetch_payload "https://raw.githubusercontent.com/foo/bar/main/baz.txt")"
run_gate "allow: mager.co exact"             0 "$(webfetch_payload "https://mager.co/")"
run_gate "allow: www.mager.co subdomain"     0 "$(webfetch_payload "https://www.mager.co/page")"
run_gate "allow: loooom.xyz exact"           0 "$(webfetch_payload "https://loooom.xyz")"
run_gate "allow: github.com HTTP scheme"     0 "$(webfetch_payload "http://github.com/foo")"

# ---------------------------------------------------------------------------
# TEST GROUP 3: Non-allowlisted domains — must BLOCK (exit 2)
# ---------------------------------------------------------------------------
log_info "Group 3: non-allowlisted domains..."
setup_allowlist

run_gate "block: npm.org"             2 "$(webfetch_payload "https://www.npmjs.com/package/foo")"
run_gate "block: vercel.com"          2 "$(webfetch_payload "https://vercel.com/dashboard")"
run_gate "block: example.com"         2 "$(webfetch_payload "https://example.com/page")"
run_gate "block: anthropic.com"       2 "$(webfetch_payload "https://www.anthropic.com/docs")"
run_gate "block: attacker.example"    2 "$(webfetch_payload "https://attacker.example/steal")"
run_gate "block: evil.github.com.attacker.io"  2 "$(webfetch_payload "https://evil.github.com.attacker.io/")"

# ---------------------------------------------------------------------------
# TEST GROUP 4: WebSearch — ALLOW when __WEBSEARCH_ALLOW__ present
# ---------------------------------------------------------------------------
log_info "Group 4: WebSearch with allow token present..."
setup_allowlist  # real allowlist has __WEBSEARCH_ALLOW__

run_gate "allow: WebSearch (token present)" 0 "$(websearch_payload "worldline digital garden")"
run_gate "allow: WebSearch (empty query)"   0 "$(websearch_payload "")"

# ---------------------------------------------------------------------------
# TEST GROUP 5: WebSearch — BLOCK when __WEBSEARCH_ALLOW__ absent
# ---------------------------------------------------------------------------
log_info "Group 5: WebSearch with allow token removed..."
# TEMP COPY without the token — real file untouched
grep -v '__WEBSEARCH_ALLOW__' "$REAL_ALLOWLIST" > "$TMP_ALLOWLIST"

run_gate "block: WebSearch (token absent)" 2 "$(websearch_payload "some query")"

# Restore for subsequent tests
setup_allowlist

# ---------------------------------------------------------------------------
# TEST GROUP 6: Missing allowlist file — must BLOCK (fail-closed)
# ---------------------------------------------------------------------------
log_info "Group 6: missing allowlist file (fail-closed)..."
# Point to a nonexistent path
local_tmp_missing="$TMP_DIR/does-not-exist.txt"

local_exit=0
WL_FETCH_ALLOWLIST="$local_tmp_missing" \
WL_AGENT="test-agent" \
CLAUDE_TASK_ID="TEST-AUDIT-FETCH-GATE" \
CLAUDE_PROJECT_DIR="$REPO_DIR" \
bash "$HOOK" <<< "$(webfetch_payload "https://github.com/foo")" > /dev/null 2>&1 || local_exit=$?

if [[ "$local_exit" -eq 2 ]]; then
  log_pass "missing allowlist: block (fail-closed, exit=2)"
  PASS=$(( PASS + 1 ))
else
  log_fail "missing allowlist: expected exit=2, got exit=$local_exit"
  FAIL=$(( FAIL + 1 ))
fi

# ---------------------------------------------------------------------------
# TEST GROUP 7: Empty URL in WebFetch payload — must BLOCK
# ---------------------------------------------------------------------------
log_info "Group 7: edge cases..."
setup_allowlist

run_gate "block: empty URL"      2 '{"tool_name":"WebFetch","tool_input":{"url":""}}'
run_gate "block: missing url key" 2 '{"tool_name":"WebFetch","tool_input":{}}'
# An empty payload has tool_name="unknown" which the hook correctly passes through
# (it only acts on WebFetch|WebSearch; unknown tools are not its concern).
run_gate "pass-through: empty payload (unknown tool)" 0 '{}'

# A URL with path — domain extraction must still work
run_gate "allow: deep path on github.com" 0 \
  "$(webfetch_payload "https://github.com/some/deep/path?query=1#anchor")"

# ---------------------------------------------------------------------------
# TEST GROUP 8: Subdomain squatting attempt — block (eTLD+1 must match)
# The domain "github.com.evil.com" has eTLD+1 "evil.com", not "github.com".
# ---------------------------------------------------------------------------
log_info "Group 8: subdomain squatting..."
setup_allowlist

run_gate "block: github.com.evil.com (squatting)" 2 \
  "$(webfetch_payload "https://github.com.evil.com/steal")"

# ---------------------------------------------------------------------------
# TEST GROUP 9: Allowlist comment lines and blank lines — must not match
# ---------------------------------------------------------------------------
log_info "Group 9: allowlist comment/blank handling..."
# Write a temp allowlist with a domain only in a comment
printf '# evil.com\n\ngithub.com\n' > "$TMP_ALLOWLIST"

run_gate "block: domain-in-comment must not allow" 2 \
  "$(webfetch_payload "https://evil.com/page")"
run_gate "allow: github.com still works after comment test" 0 \
  "$(webfetch_payload "https://github.com/repo")"

# Restore
setup_allowlist

# ---------------------------------------------------------------------------
# TEST GROUP 10: Egress-class tools (M3 fix — REFUTE F coverage)
# The gate must now block URL-bearing MCP tools (playwright, chrome-devtools,
# Notion notion-fetch) not just WebFetch.
# ---------------------------------------------------------------------------
log_info "Group 10: egress-class MCP tools (playwright / chrome-devtools / notion-fetch)..."
setup_allowlist

# URL-bearing MCP tools — untrusted URL must block
run_gate "block: playwright browser_navigate evil.example" 2 \
  '{"tool_name":"mcp__playwright__browser_navigate","tool_input":{"url":"https://evil.example/exfil"}}'
run_gate "block: playwright browser_navigate_back evil.example" 2 \
  '{"tool_name":"mcp__playwright__browser_navigate_back","tool_input":{"url":"https://evil.example/exfil"}}'
run_gate "block: chrome-devtools navigate_page evil.example" 2 \
  '{"tool_name":"mcp__plugin_chrome-devtools-mcp_chrome-devtools__navigate_page","tool_input":{"url":"https://evil.example/exfil"}}'
run_gate "block: chrome-devtools new_page evil.example" 2 \
  '{"tool_name":"mcp__plugin_chrome-devtools-mcp_chrome-devtools__new_page","tool_input":{"url":"https://evil.example/exfil"}}'
run_gate "block: notion-fetch evil.example" 2 \
  '{"tool_name":"mcp__claude_ai_Notion__notion-fetch","tool_input":{"url":"https://evil.example/exfil"}}'
run_gate "block: playwright network_request evil.example" 2 \
  '{"tool_name":"mcp__playwright__browser_network_request","tool_input":{"url":"https://evil.example/exfil"}}'

# URL-bearing MCP tools — allowlisted URL must allow
run_gate "allow: playwright browser_navigate github.com" 0 \
  '{"tool_name":"mcp__playwright__browser_navigate","tool_input":{"url":"https://github.com/repo"}}'
run_gate "allow: chrome-devtools navigate_page mager.co" 0 \
  '{"tool_name":"mcp__plugin_chrome-devtools-mcp_chrome-devtools__navigate_page","tool_input":{"url":"https://mager.co/"}}'
run_gate "allow: notion-fetch loooom.xyz" 0 \
  '{"tool_name":"mcp__claude_ai_Notion__notion-fetch","tool_input":{"url":"https://loooom.xyz/page"}}'

# ---------------------------------------------------------------------------
# TEST GROUP 11: Parse-failure → fail-closed (M3 fix — REFUTE A/B coverage)
# Non-JSON stdin or jq-exit-nonzero must BLOCK (exit 2), not pass through.
# ---------------------------------------------------------------------------
log_info "Group 11: parse-failure fail-closed (non-JSON stdin)..."
setup_allowlist

# Non-JSON input: gate must block, not allow
non_json_exit=0
non_json_output=""
non_json_output="$(
  WL_FETCH_ALLOWLIST="$TMP_ALLOWLIST" \
  WL_AGENT="test-agent" \
  CLAUDE_TASK_ID="TEST-AUDIT-FETCH-GATE" \
  CLAUDE_PROJECT_DIR="$REPO_DIR" \
  bash "$HOOK" <<< 'this is not json tool_name WebFetch url https://evil.example/steal' 2>&1
)" || non_json_exit=$?

if [[ "$non_json_exit" -eq 2 ]]; then
  log_pass "non-JSON stdin: block (fail-closed, exit=2)"
  PASS=$(( PASS + 1 ))
else
  log_fail "non-JSON stdin: expected exit=2 (fail-closed), got exit=$non_json_exit"
  FAIL=$(( FAIL + 1 ))
fi

# Broken jq (stubbed to exit 1) with untrusted URL: must block
FAKE_BIN_DIR="$TMP_DIR/fakebin"
mkdir -p "$FAKE_BIN_DIR"
printf '#!/usr/bin/env bash\nexit 1\n' > "$FAKE_BIN_DIR/jq"
chmod +x "$FAKE_BIN_DIR/jq"

jq_broken_exit=0
jq_broken_output=""
jq_broken_output="$(
  PATH="$FAKE_BIN_DIR:$PATH" \
  WL_FETCH_ALLOWLIST="$TMP_ALLOWLIST" \
  WL_AGENT="test-agent" \
  CLAUDE_TASK_ID="TEST-AUDIT-FETCH-GATE" \
  CLAUDE_PROJECT_DIR="$REPO_DIR" \
  bash "$HOOK" <<< '{"tool_name":"WebFetch","tool_input":{"url":"https://evil.example/steal"}}' 2>&1
)" || jq_broken_exit=$?

if [[ "$jq_broken_exit" -eq 2 ]]; then
  log_pass "jq absent/broken + untrusted WebFetch: block (fail-closed, exit=2)"
  PASS=$(( PASS + 1 ))
else
  log_fail "jq absent/broken + untrusted WebFetch: expected exit=2, got exit=$jq_broken_exit"
  FAIL=$(( FAIL + 1 ))
fi

# ---------------------------------------------------------------------------
# TEST GROUP 12: Uncertain-egress class → block (M3 fix)
# Tools whose egress destination cannot be statically inspected must block.
# ---------------------------------------------------------------------------
log_info "Group 12: uncertain-egress class blocks without opt-in..."
setup_allowlist

run_gate "block: playwright browser_evaluate (uncertain-egress)" 2 \
  '{"tool_name":"mcp__playwright__browser_evaluate","tool_input":{"script":"fetch(\"https://evil.example/\")"}}'
run_gate "block: playwright browser_run_code_unsafe (uncertain-egress)" 2 \
  '{"tool_name":"mcp__playwright__browser_run_code_unsafe","tool_input":{"code":"..."}}'
run_gate "block: chrome-devtools evaluate_script (uncertain-egress)" 2 \
  '{"tool_name":"mcp__plugin_chrome-devtools-mcp_chrome-devtools__evaluate_script","tool_input":{"expression":"..."}}'
run_gate "block: Notion notion-search (uncertain-egress)" 2 \
  '{"tool_name":"mcp__claude_ai_Notion__notion-search","tool_input":{"query":"foo"}}'
run_gate "block: Figma get_design_context (uncertain-egress)" 2 \
  '{"tool_name":"mcp__claude_ai_Figma__get_design_context","tool_input":{}}'
run_gate "block: Airtable list_bases (uncertain-egress)" 2 \
  '{"tool_name":"mcp__claude_ai_Airtable__list_bases","tool_input":{}}'
run_gate "block: Vercel authenticate (uncertain-egress)" 2 \
  '{"tool_name":"mcp__plugin_vercel_vercel__authenticate","tool_input":{}}'

# Uncertain-egress with opt-in token — must allow
printf 'github.com\nmager.co\nloooom.xyz\n__WEBSEARCH_ALLOW__\n__UNCERTAIN_EGRESS_ALLOW__browser_evaluate\n' > "$TMP_ALLOWLIST"
run_gate "allow: playwright browser_evaluate with opt-in token" 0 \
  '{"tool_name":"mcp__playwright__browser_evaluate","tool_input":{"script":"..."}}'

# Restore
setup_allowlist

# ---------------------------------------------------------------------------
# TEST GROUP 13: Public-suffix protection (M3 fix — REFUTE C/H coverage)
# An allowlist entry that IS a public suffix must not grant all subdomains.
# ---------------------------------------------------------------------------
log_info "Group 13: public-suffix exact-host protection..."

# github.io in allowlist — attacker.github.io must block
printf 'github.io\n__WEBSEARCH_ALLOW__\n' > "$TMP_ALLOWLIST"
run_gate "block: attacker.github.io (github.io is public suffix)" 2 \
  '{"tool_name":"WebFetch","tool_input":{"url":"https://attacker.github.io/exfil"}}'

# github.io exact host — must allow
run_gate "allow: exact github.io host (public suffix entry)" 0 \
  '{"tool_name":"WebFetch","tool_input":{"url":"https://github.io/page"}}'

# vercel.app in allowlist — attacker.vercel.app must block
printf 'vercel.app\n__WEBSEARCH_ALLOW__\n' > "$TMP_ALLOWLIST"
run_gate "block: attacker.vercel.app (vercel.app is public suffix)" 2 \
  '{"tool_name":"WebFetch","tool_input":{"url":"https://attacker.vercel.app/exfil"}}'

# Normal single-owner domain with subdomain — must allow (eTLD+1 match)
setup_allowlist
run_gate "allow: api.github.com (eTLD+1 match, not public suffix)" 0 \
  '{"tool_name":"WebFetch","tool_input":{"url":"https://api.github.com/repos"}}'

# Restore
setup_allowlist

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
printf '\n'
printf '======================================\n'
printf 'audit-untrusted-fetch-gate  SUMMARY\n'
printf '  PASS: %d\n' "$PASS"
printf '  FAIL: %d\n' "$FAIL"
printf '  SKIP: %d\n' "$SKIP"
printf '======================================\n'

if [[ "$FAIL" -gt 0 ]]; then
  printf '[AUDIT FAIL] %d case(s) failed. See above.\n' "$FAIL" >&2
  exit 1
fi

printf '[AUDIT PASS] All %d cases passed.\n' "$PASS"
exit 0
