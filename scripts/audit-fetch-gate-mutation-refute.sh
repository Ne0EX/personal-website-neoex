#!/usr/bin/env bash
# scripts/audit-fetch-gate-mutation-refute.sh
# ADVERSARIAL mutation-test for .claude/hooks/untrusted-fetch-gate.sh (Algol QA).
#
# GOAL: REFUTE the M3 untrusted-fetch-gate. Try to make the threat present
# (an untrusted WebFetch passes) while the gate still appears to pass.
#
# POLICY-NO-INPLACE-MUTATION: operates on TEMP COPIES only. A trap restores on
# every exit path. Real tracked files (the hook, the real allowlist) are NEVER
# mutated. No real network, no real-file edits — synthetic JSON inputs on stdin.
#
# Run:  bash scripts/audit-fetch-gate-mutation-refute.sh
set -uo pipefail

REPO="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
HOOK="$REPO/.claude/hooks/untrusted-fetch-gate.sh"

TMP="$(mktemp -d 2>/dev/null || mktemp -d -t fetch-gate-refute)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT INT TERM HUP

WL="$TMP/allow.txt"
seed_allowlist() {
  printf 'github.com\nmager.co\nloooom.xyz\n__WEBSEARCH_ALLOW__\n' > "$WL"
}

# run_hook <allowlist> <payload> [extra_path]
# echoes "EXIT=<n>" then full stdout+stderr; uses TEMP allowlist only.
run_hook() {
  local wl="$1" payload="$2" extra_path="${3:-}"
  local ec=0 out=""
  if [[ -n "$extra_path" ]]; then
    out="$(PATH="$extra_path:$PATH" WL_FETCH_ALLOWLIST="$wl" WL_AGENT=refute \
      CLAUDE_TASK_ID=REFUTE CLAUDE_PROJECT_DIR="$REPO" \
      bash "$HOOK" <<< "$payload" 2>&1)" || ec=$?
  else
    out="$(WL_FETCH_ALLOWLIST="$wl" WL_AGENT=refute \
      CLAUDE_TASK_ID=REFUTE CLAUDE_PROJECT_DIR="$REPO" \
      bash "$HOOK" <<< "$payload" 2>&1)" || ec=$?
  fi
  printf 'EXIT=%d\n' "$ec"
  printf '%s\n' "$out"
}

hr() { printf '\n==================== %s ====================\n' "$1"; }

# ---------------------------------------------------------------------------
hr "BASELINE 1: allowlisted github.com -> must ALLOW (exit 0)"
seed_allowlist
run_hook "$WL" '{"tool_name":"WebFetch","tool_input":{"url":"https://github.com/foo"}}'

hr "BASELINE 2: untrusted evil.example -> must BLOCK (exit 2 + decision:block)"
seed_allowlist
run_hook "$WL" '{"tool_name":"WebFetch","tool_input":{"url":"https://evil.example/steal"}}'

# ---------------------------------------------------------------------------
# REFUTE A: jq absent / failing -> tool_name parse fails -> fail-OPEN?
# Stub a jq that always exits 1, prepend to PATH. A real WebFetch to an
# untrusted host should be BLOCKED (fail-closed). If it ALLOWS, FALSE-HAVE.
# ---------------------------------------------------------------------------
hr "REFUTE A: jq broken (exit 1) + untrusted WebFetch -> EXPECT block; OBSERVE:"
seed_allowlist
JQDIR="$TMP/fakebin"
mkdir -p "$JQDIR"
printf '#!/usr/bin/env bash\nexit 1\n' > "$JQDIR/jq"
chmod +x "$JQDIR/jq"
run_hook "$WL" '{"tool_name":"WebFetch","tool_input":{"url":"https://evil.example/steal"}}' "$JQDIR"

# ---------------------------------------------------------------------------
# REFUTE B: malformed / non-JSON stdin with a real WebFetch intent.
# If jq cannot parse, tool_name -> "unknown" -> pass-through (exit 0).
# Here we send junk that still *represents* a fetch attempt.
# ---------------------------------------------------------------------------
hr "REFUTE B: non-JSON stdin (jq present but input unparseable) -> OBSERVE:"
seed_allowlist
run_hook "$WL" 'this is not json tool_name WebFetch url https://evil.example/steal'

# ---------------------------------------------------------------------------
# REFUTE C: multi-tenant suffix. If Peat ever adds github.io (a public suffix
# where each subdomain is a different owner), attacker.github.io extracts
# reg-domain github.io -> ALLOWED. Demonstrate the design hole on a temp WL.
# ---------------------------------------------------------------------------
hr "REFUTE C: github.io in allowlist + attacker.github.io -> EXPECT block; OBSERVE:"
printf 'github.io\n__WEBSEARCH_ALLOW__\n' > "$WL"
run_hook "$WL" '{"tool_name":"WebFetch","tool_input":{"url":"https://attacker.github.io/exfil"}}'

# ---------------------------------------------------------------------------
# CONTROL D: the known-safe vectors the advisor said fail safe. Confirm.
# ---------------------------------------------------------------------------
hr "CONTROL D1: userinfo @ trick  https://github.com@evil.example/ -> OBSERVE:"
seed_allowlist
run_hook "$WL" '{"tool_name":"WebFetch","tool_input":{"url":"https://github.com@evil.example/x"}}'

hr "CONTROL D2: subdomain squat github.com.evil.example -> OBSERVE:"
seed_allowlist
run_hook "$WL" '{"tool_name":"WebFetch","tool_input":{"url":"https://github.com.evil.example/x"}}'

# ---------------------------------------------------------------------------
# CONTROL E: empty stdin entirely.
# ---------------------------------------------------------------------------
hr "CONTROL E: empty stdin -> OBSERVE:"
seed_allowlist
run_hook "$WL" ''

# ---------------------------------------------------------------------------
# REFUTE F (reachable, normal-operation): the gate only covers WebFetch|
# WebSearch. Other fetch-capable tools hit the *) pass-through -> exit 0.
# These are NOT jq-dependent and NOT config-dependent. If M3's threat model
# is "untrusted egress", these are live uncovered surfaces.
# ---------------------------------------------------------------------------
hr "REFUTE F1: playwright browser_navigate -> evil.example -> OBSERVE:"
seed_allowlist
run_hook "$WL" '{"tool_name":"mcp__playwright__browser_navigate","tool_input":{"url":"https://evil.example/exfil"}}'

hr "REFUTE F2: chrome-devtools navigate_page -> evil.example -> OBSERVE:"
seed_allowlist
run_hook "$WL" '{"tool_name":"mcp__plugin_chrome-devtools-mcp_chrome-devtools__navigate_page","tool_input":{"url":"https://evil.example/exfil"}}'

hr "REFUTE F3: Notion notion-fetch -> evil.example -> OBSERVE:"
seed_allowlist
run_hook "$WL" '{"tool_name":"mcp__claude_ai_Notion__notion-fetch","tool_input":{"url":"https://evil.example/exfil"}}'

hr "REFUTE F4: chrome-devtools new_page -> evil.example -> OBSERVE:"
seed_allowlist
run_hook "$WL" '{"tool_name":"mcp__plugin_chrome-devtools-mcp_chrome-devtools__new_page","tool_input":{"url":"https://evil.example/exfil"}}'

hr "REFUTE F5: playwright browser_navigate_back -> evil.example -> OBSERVE:"
seed_allowlist
run_hook "$WL" '{"tool_name":"mcp__playwright__browser_navigate_back","tool_input":{"url":"https://evil.example/exfil"}}'

# ---------------------------------------------------------------------------
# REFUTE G: uncertain-egress class (browser_evaluate, Notion non-fetch, etc.)
# These tools issue outbound requests whose destination cannot be statically
# inspected. The fixed gate blocks them unless an opt-in token is present.
# ---------------------------------------------------------------------------
hr "REFUTE G1: playwright browser_evaluate (JS eval) -> EXPECT block (uncertain-egress); OBSERVE:"
seed_allowlist
run_hook "$WL" '{"tool_name":"mcp__playwright__browser_evaluate","tool_input":{"script":"fetch(\"https://evil.example/\")"}}'

hr "REFUTE G2: Notion notion-search (non-URL Notion tool) -> EXPECT block (uncertain-egress); OBSERVE:"
seed_allowlist
run_hook "$WL" '{"tool_name":"mcp__claude_ai_Notion__notion-search","tool_input":{"query":"foo"}}'

hr "REFUTE G3: chrome-devtools evaluate_script -> EXPECT block (uncertain-egress); OBSERVE:"
seed_allowlist
run_hook "$WL" '{"tool_name":"mcp__plugin_chrome-devtools-mcp_chrome-devtools__evaluate_script","tool_input":{"expression":"fetch(\"https://evil.example/\")"}}'

# ---------------------------------------------------------------------------
# REFUTE H: public-suffix multi-tenant bypass (C extended — with dedicated WL)
# An allowlist entry that IS a public suffix (github.io, vercel.app, etc.)
# must NOT grant all its subdomains. The fixed gate uses exact-host match for
# public-suffix entries.
# ---------------------------------------------------------------------------
hr "REFUTE H1: github.io in allowlist + attacker.github.io -> EXPECT block; OBSERVE:"
printf 'github.io\n__WEBSEARCH_ALLOW__\n' > "$WL"
run_hook "$WL" '{"tool_name":"WebFetch","tool_input":{"url":"https://attacker.github.io/exfil"}}'

hr "REFUTE H2: vercel.app in allowlist + attacker.vercel.app -> EXPECT block; OBSERVE:"
printf 'vercel.app\n__WEBSEARCH_ALLOW__\n' > "$WL"
run_hook "$WL" '{"tool_name":"WebFetch","tool_input":{"url":"https://attacker.vercel.app/exfil"}}'

hr "CONTROL H3: github.io in allowlist + exact github.io -> EXPECT allow; OBSERVE:"
printf 'github.io\n__WEBSEARCH_ALLOW__\n' > "$WL"
run_hook "$WL" '{"tool_name":"WebFetch","tool_input":{"url":"https://github.io/page"}}'

printf '\n[refute-harness done]\n'
exit 0
