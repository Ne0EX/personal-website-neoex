#!/usr/bin/env bash
# .claude/hooks/untrusted-fetch-gate.sh
# PreToolUse hook — Egress-class allowlist gate (deny-default).
#
# WHAT IT DOES
# ------------
# Intercepts every tool call that issues an outbound network request and
# applies a deny-default domain allowlist check before the call executes.
#
# COVERED EGRESS CLASS (Control 11 — all outbound-fetch-capable tools):
#
#   URL-bearing tools (domain allowlist check):
#     WebFetch
#     mcp__playwright__browser_navigate
#     mcp__playwright__browser_navigate_back
#     mcp__playwright__browser_network_request
#     mcp__playwright__browser_tabs             (action:"new" only; url present)
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__navigate_page
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__new_page
#     mcp__claude_ai_Notion__notion-fetch
#
#   Text-query tools (no URL — checked via token):
#     WebSearch  (__WEBSEARCH_ALLOW__ token in allowlist)
#
#   Uncertain-egress tools (gated: blocked unless explicitly opted-in):
#     mcp__playwright__browser_evaluate     (JS eval — can issue fetch())
#     mcp__playwright__browser_run_code_unsafe (arbitrary code)
#     mcp__playwright__browser_fill_form    (can POST to arbitrary URLs)
#     mcp__playwright__browser_drop         (can trigger navigation)
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__evaluate_script
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__lighthouse_audit
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__performance_start_trace
#                                           (flagged: egress uncertain — see §UNCERTAIN)
#     mcp__claude_ai_Google_Drive__authenticate
#     mcp__claude_ai_Gmail__authenticate
#     mcp__claude_ai_Google_Calendar__*     (all calendar tools hit Google APIs)
#     mcp__claude_ai_Airtable__*            (all Airtable tools hit Airtable APIs)
#     mcp__claude_ai_Figma__*               (all Figma tools hit Figma APIs)
#     mcp__claude_ai_Quartr__*              (hits Quartr APIs)
#     mcp__claude_ai_S_P_Global__*          (hits S&P Global APIs)
#     mcp__claude_ai_Google_Cloud_BigQuery__* (hits GCP APIs)
#     mcp__claude_ai_Notion__*              (all Notion tools hit Notion APIs)
#     mcp__plugin_supabase_supabase__*      (hits Supabase APIs)
#     mcp__plugin_vercel_vercel__*          (hits Vercel APIs)
#
#   SKIP (known non-egress built-in tools — explicit allow-list):
#     Read, Edit, MultiEdit, Write, Bash, Glob, Grep, LS
#     NotebookEdit, TodoWrite, Task, BashOutput, KillBash
#     Skill, SlashCommand, ToolSearch, ExitPlanMode
#     mcp__playwright__browser_snapshot, mcp__playwright__browser_console_messages
#     mcp__playwright__browser_tabs (action:list/close/select — no url present)
#     mcp__playwright__browser_wait_for, mcp__playwright__browser_press_key
#     mcp__playwright__browser_type, mcp__playwright__browser_click
#     mcp__playwright__browser_hover, mcp__playwright__browser_resize
#     mcp__playwright__browser_select_option, mcp__playwright__browser_handle_dialog
#     mcp__playwright__browser_close, mcp__playwright__browser_tabs (non-new)
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__take_screenshot
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__take_snapshot
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__list_pages
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__select_page
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__get_console_message
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__list_console_messages
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__list_network_requests
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__get_network_request
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__press_key
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__type_text
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__click
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__fill
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__fill_form (DOM only)
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__hover
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__scroll
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__drag
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__handle_dialog
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__wait_for
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__upload_file
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__close_page
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__resize_page
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__emulate
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__cursor_position
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__performance_analyze_insight
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__performance_stop_trace
#     mcp__plugin_chrome-devtools-mcp_chrome-devtools__take_heapsnapshot
#     (all mcp__computer-use__* tools — local desktop control, no outbound fetch)
#
#   DEFAULT (unlisted tools — BLOCK via handle_uncertain_egress):
#     Any tool not in the above classes falls to *) and is blocked.
#     RATIONALE: the gate is deny-default for TOOLS as well as DOMAINS.
#     An unenumerated or newly-added egress tool must not be silently
#     allowed; it must appear on the SKIP list or the UNCERTAIN class
#     (with a matching __UNCERTAIN_EGRESS_ALLOW__ token) before it passes.
#     To add a tool: classify it (URL-bearing / uncertain / non-egress),
#     add it to the correct class above, and update the matching case below.
#
# NOTE ON MATCHER SCOPE: the settings.json matcher at §2b wires this hook
# on "WebFetch|WebSearch". Under that matcher, every case branch below
# WebSearch is INERT (only WebFetch and WebSearch fire in production).
# Algol exercises all branches by piping JSON directly — that is by design.
#
# SAFE-WIRING BOUND (do not remove this comment):
#   This hook is safe ONLY with an egress-scoped matcher.
#   Do NOT wire it with a catch-all matcher (e.g., "*") without first:
#     (a) Expanding the SKIP list to cover every non-egress tool in the
#         full live toolset (the deferred-tools system-reminder is the
#         authoritative inventory — check it when the toolset changes).
#     (b) Re-running the self-verify script for all non-egress tools
#         that should pass through (exit 0), confirming no over-block.
#   Under a catch-all matcher the fail-closed *) branch routes every
#   unenumerated built-in (StructuredOutput, SendUserFile, advisor, etc.)
#   to BLOCK, bricking the harness. A targeted matcher is the safe posture.
#
# POSTURE: fail-closed.
#   - exit 2 on allowlist violation (Claude Code PreToolUse block code)
#   - exit 2 on parse failure (non-JSON stdin / jq error → BLOCK, not allow)
#   - exit 2 on uncertain-egress tools not explicitly opted in
#   - exit 2 on any tool not enumerated in SKIP, URL-bearing, or UNCERTAIN
#   - exit 0 on allow
#
# PUBLIC-SUFFIX PROTECTION:
#   An allowlist entry that is itself a public suffix (e.g. github.io,
#   vercel.app, pages.dev) must NOT let arbitrary subdomains through.
#   The gate detects known public suffixes and falls back to EXACT-HOST
#   matching rather than eTLD+1 matching when the allowlist entry is
#   itself a public suffix. This closes the multi-tenant bypass.
#
#   Known public suffixes list is in: PUBLIC_SUFFIXES array (line ~130).
#   If a new public-suffix domain is added to the allowlist, add it here
#   too so the gate knows to match exact rather than eTLD+1.
#
# ALLOWLIST FORMAT (unchanged):
#   Default: ${CLAUDE_PROJECT_DIR:-.}/.harness/fetch-allowlist.txt
#   Override (for tests): WL_FETCH_ALLOWLIST=/path/to/alt-allowlist.txt
#   Special token: __WEBSEARCH_ALLOW__ — enables WebSearch text queries.
#   Special token: __UNCERTAIN_EGRESS_ALLOW__<tool_suffix> — opts in one
#     uncertain-egress tool. E.g. __UNCERTAIN_EGRESS_ALLOW__browser_evaluate.
#
# EXIT CODES:
#   0 — allow
#   2 — BLOCK (Claude Code PreToolUse block code)
#
# BASH COMPATIBILITY: bash 3.2 (macOS default). No associative arrays.
# IDEMPOTENT: same input + same allowlist → same result.
# LOGS TO: .claude/hook-logs/<task_id>--untrusted-fetch-gate.log
#
# Owner: Canopus · α-HRN-07
# Task: TASK-2026-06-04-MEMORY-POISONING-A (M3 sensor — FALSE-HAVE fix)
# Not wired yet — see .harness/proposed-wiring-M.md (Peat gates wiring)

set -uo pipefail

REPO_DIR="${CLAUDE_PROJECT_DIR:-/Users/neospiritth/codingspace/personal_website}"
LOG_DIR="$REPO_DIR/.claude/hook-logs"
mkdir -p "$LOG_DIR" 2>/dev/null || true

TASK_ID="${CLAUDE_TASK_ID:-${WL_TASK_ID:-session-$(date +%s)}}"
AGENT="${WL_AGENT:-unknown}"
LOG="$LOG_DIR/${TASK_ID}--untrusted-fetch-gate.log"
TIMESTAMP="$(date -u +%FT%TZ)"
ALLOWLIST="${WL_FETCH_ALLOWLIST:-$REPO_DIR/.harness/fetch-allowlist.txt}"

# ---------------------------------------------------------------------------
# Known public suffixes — domains that are TLD-equivalent (each subdomain is a
# different owner). If an allowlist entry is one of these, the gate uses
# EXACT-HOST matching, NOT eTLD+1 matching, to prevent multi-tenant bypass.
#
# If you add a public-suffix domain to the allowlist (e.g. github.io,
# vercel.app, pages.dev, netlify.app), add it here so the gate knows.
# ---------------------------------------------------------------------------
PUBLIC_SUFFIXES="github.io vercel.app pages.dev netlify.app workers.dev \
  firebaseapp.com web.app herokuapp.com azurewebsites.net cloudfront.net \
  amplifyapp.com s3.amazonaws.com glitch.me replit.dev codepen.io \
  stackblitz.io codesandbox.io surge.sh render.com fly.dev"

# ---------------------------------------------------------------------------
# block <reason> [url_or_detail]
# Emits structured block response and exits 2.
# ---------------------------------------------------------------------------
block() {
  local reason="$1"
  local detail="${2:-}"
  local msg
  msg="$(printf '{"decision":"block","reason":"%s"}' "$reason")"

  printf '[fetch-gate] %s · BLOCK · agent=%s · %s · detail=%s\n' \
    "$TIMESTAMP" "$AGENT" "$reason" "$detail" >> "$LOG" 2>/dev/null || true

  # Claude Code reads stdout for block message when exit=2
  printf '%s\n' "$msg"
  printf '\n'
  printf 'BLOCKED by untrusted-fetch-gate: %s\n' "$reason"
  if [[ -n "$detail" ]]; then
    printf 'Detail: %s\n' "$detail"
  fi
  printf '\n'
  printf 'To allow this domain, add it to .harness/fetch-allowlist.txt and\n'
  printf 'add a WebFetch(domain:%s) allow entry in .claude/settings.local.json.\n' \
    "$(printf '%s' "$detail" | sed 's|^.*://||;s|/.*||')"
  exit 2
}

# ---------------------------------------------------------------------------
# block_uncertain <tool_name>
# Block a tool in the uncertain-egress class with a specific message.
# ---------------------------------------------------------------------------
block_uncertain() {
  local tool="$1"
  local msg
  msg="$(printf '{"decision":"block","reason":"uncertain-egress tool not explicitly opted in: %s"}' "$tool")"

  printf '[fetch-gate] %s · BLOCK (uncertain-egress) · agent=%s · tool=%s\n' \
    "$TIMESTAMP" "$AGENT" "$tool" >> "$LOG" 2>/dev/null || true

  printf '%s\n' "$msg"
  printf '\n'
  printf 'BLOCKED by untrusted-fetch-gate (uncertain-egress): %s\n' "$tool"
  printf '\n'
  printf 'This tool is in the uncertain-egress class — it may issue outbound\n'
  printf 'network requests whose destination cannot be statically gated here.\n'
  printf 'To opt in, add __UNCERTAIN_EGRESS_ALLOW__%s to\n' \
    "${tool##*__}"
  printf '.harness/fetch-allowlist.txt after Peat review.\n'
  printf 'Ref: .claude/hooks/untrusted-fetch-gate.sh §UNCERTAIN-EGRESS-CLASS\n'
  exit 2
}

# ---------------------------------------------------------------------------
# allowlist_file_check
# Returns 0 if allowlist file is readable; exits 2 if not (fail-closed).
# ---------------------------------------------------------------------------
allowlist_file_check() {
  if [[ ! -f "$ALLOWLIST" ]]; then
    printf '[fetch-gate] %s · BLOCK (allowlist missing) · path=%s\n' \
      "$TIMESTAMP" "$ALLOWLIST" >> "$LOG" 2>/dev/null || true
    block "fetch-allowlist.txt not found — no domains are authorized; add .harness/fetch-allowlist.txt to authorize fetches" "$ALLOWLIST"
  fi
  if [[ ! -r "$ALLOWLIST" ]]; then
    block "fetch-allowlist.txt is not readable — deny by default" "$ALLOWLIST"
  fi
}

# ---------------------------------------------------------------------------
# is_public_suffix <domain>
# Returns 0 if the domain is in the PUBLIC_SUFFIXES list, 1 otherwise.
# Used to decide whether to match exact-host or eTLD+1.
# ---------------------------------------------------------------------------
is_public_suffix() {
  local d="$1"
  local s
  for s in $PUBLIC_SUFFIXES; do
    if [[ "$s" == "$d" ]]; then
      return 0
    fi
  done
  return 1
}

# ---------------------------------------------------------------------------
# extract_registered_domain <hostname>
# Strips one level of subdomain(s) to arrive at the registered domain
# (eTLD+1) for common TLDs. Best-effort heuristic (not a full PSL parser).
#
# Strategy:
#   For hostnames with >2 labels and where the second-to-last label is not
#   a known two-letter country-code second-level (co, com, net, org, gov, edu
#   under a ccTLD like .co.uk, .com.au), strip everything before the last two
#   labels. For known two-part TLDs (e.g. co.uk, com.au), keep last three.
#
# Examples:
#   raw.githubusercontent.com → github.com (strip subdomain)
#   api.github.com           → github.com
#   www.mager.co             → mager.co
#   loooom.xyz               → loooom.xyz (already eTLD+1)
#   foo.bar.baz.example.com  → example.com
#   attacker.github.io       → github.io  (public suffix — caller decides)
# ---------------------------------------------------------------------------
extract_registered_domain() {
  local host="$1"
  # Strip port if present
  host="${host%%:*}"
  # Lowercase
  host="$(printf '%s' "$host" | tr '[:upper:]' '[:lower:]')"

  # Count labels
  local label_count
  label_count="$(printf '%s' "$host" | tr -cd '.' | wc -c)"
  label_count=$(( label_count + 1 ))

  if (( label_count <= 2 )); then
    # Already bare eTLD+1 or TLD-only (treat as-is)
    printf '%s' "$host"
    return
  fi

  # Check for known two-part TLDs by looking at last two labels
  local last2
  last2="$(printf '%s' "$host" | rev | cut -d'.' -f1-2 | rev)"
  case "$last2" in
    co.uk|com.au|net.au|org.au|co.nz|co.jp|co.in|com.br|com.mx|gov.uk|org.uk|me.uk|net.uk|co.za|org.za|com.sg|co.id|com.ph|ac.uk)
      # Three-label registered domain
      printf '%s' "$host" | rev | cut -d'.' -f1-3 | rev
      return
      ;;
  esac

  # Default: last two labels
  printf '%s' "$host" | rev | cut -d'.' -f1-2 | rev
}

# ---------------------------------------------------------------------------
# extract_host_from_url <url>
# Returns the hostname from a URL. Strips scheme, userinfo, path, port.
# Also strips the userinfo@ prefix (prevents github.com@evil.example trick).
# ---------------------------------------------------------------------------
extract_host_from_url() {
  local url="$1"
  # Strip scheme (http://, https://, etc.)
  local no_scheme="${url#*://}"
  # Strip path (everything after first /)
  local host_port="${no_scheme%%/*}"
  # Strip userinfo (everything before @, if present)
  if [[ "$host_port" == *@* ]]; then
    host_port="${host_port##*@}"
  fi
  # Strip port
  local host="${host_port%%:*}"
  # Lowercase
  printf '%s' "$host" | tr '[:upper:]' '[:lower:]'
}

# ---------------------------------------------------------------------------
# is_domain_allowed <hostname> <registered_domain>
# Returns 0 if found in allowlist, 1 if not.
#
# PUBLIC-SUFFIX PROTECTION:
#   Iterates the allowlist. For each allowlist entry:
#   - If the entry IS a public suffix (e.g. github.io): compare exact-host
#     (full subdomain-included hostname) against the entry — NOT eTLD+1.
#     This means github.io in the allowlist ONLY allows exactly github.io,
#     not attacker.github.io.
#   - Otherwise: compare the caller's registered domain against the entry
#     (the normal eTLD+1 match — github.com allows api.github.com, etc.)
#
# Allowlist lines are bare hostnames (no scheme, no path, no port).
# Lines starting with '#' or blank are skipped.
# ---------------------------------------------------------------------------
is_domain_allowed() {
  local full_host="$1"
  local reg_domain="$2"
  while IFS= read -r line; do
    # Strip trailing whitespace
    line="${line%%[[:space:]]*}"
    # Skip comments and blank lines
    [[ -z "$line" ]] && continue
    [[ "$line" == \#* ]] && continue
    # Skip special tokens
    [[ "$line" == __* ]] && continue
    # Normalize to lowercase for comparison
    local entry
    entry="$(printf '%s' "$line" | tr '[:upper:]' '[:lower:]')"

    if is_public_suffix "$entry"; then
      # Public suffix: require EXACT HOST match (not eTLD+1)
      # This prevents github.io allowlist entry from granting attacker.github.io
      if [[ "$full_host" == "$entry" ]]; then
        return 0
      fi
    else
      # Normal single-owner domain: eTLD+1 match (allows subdomains)
      if [[ "$entry" == "$reg_domain" ]]; then
        return 0
      fi
    fi
  done < "$ALLOWLIST"
  return 1
}

# ---------------------------------------------------------------------------
# is_websearch_allowed
# Returns 0 if __WEBSEARCH_ALLOW__ token is present in allowlist, 1 if not.
# ---------------------------------------------------------------------------
is_websearch_allowed() {
  grep -qE '^[[:space:]]*__WEBSEARCH_ALLOW__[[:space:]]*$' "$ALLOWLIST" 2>/dev/null
}

# ---------------------------------------------------------------------------
# is_uncertain_egress_allowed <tool_name>
# Returns 0 if __UNCERTAIN_EGRESS_ALLOW__<suffix> token is present, 1 if not.
# The suffix is the trailing portion after the last __ in the tool name.
# E.g. mcp__playwright__browser_evaluate → suffix: browser_evaluate
# ---------------------------------------------------------------------------
is_uncertain_egress_allowed() {
  local tool="$1"
  local suffix="${tool##*__}"
  grep -qE "^[[:space:]]*__UNCERTAIN_EGRESS_ALLOW__${suffix}[[:space:]]*$" "$ALLOWLIST" 2>/dev/null
}

# ---------------------------------------------------------------------------
# handle_uncertain_egress <tool_name>
# Checks the opt-in token; blocks unless present.
# ---------------------------------------------------------------------------
handle_uncertain_egress() {
  local tool="$1"
  if is_uncertain_egress_allowed "$tool"; then
    printf '[fetch-gate] %s · ALLOW (uncertain-egress opted-in) · agent=%s · tool=%s\n' \
      "$TIMESTAMP" "$AGENT" "$tool" >> "$LOG" 2>/dev/null || true
    exit 0
  fi
  block_uncertain "$tool"
}

# ---------------------------------------------------------------------------
# check_url_against_allowlist <url> <tool_name>
# Extracts host and registered domain from a URL and checks the allowlist.
# Blocks if domain not in allowlist or if URL is empty.
# ---------------------------------------------------------------------------
check_url_against_allowlist() {
  local url="$1"
  local tool="$2"

  if [[ -z "$url" ]]; then
    block "${tool} call has no URL in tool_input — blocked by default" "(empty)"
  fi

  local full_host
  full_host="$(extract_host_from_url "$url")"
  if [[ -z "$full_host" ]]; then
    block "Could not extract hostname from URL" "$url"
  fi

  local reg_domain
  reg_domain="$(extract_registered_domain "$full_host")"

  printf '[fetch-gate] checking · tool=%s · url=%s · host=%s · reg_domain=%s\n' \
    "$tool" "$url" "$full_host" "$reg_domain" >> "$LOG" 2>/dev/null || true

  if is_domain_allowed "$full_host" "$reg_domain"; then
    printf '[fetch-gate] %s · ALLOW · tool=%s · domain=%s\n' \
      "$TIMESTAMP" "$tool" "$reg_domain" >> "$LOG" 2>/dev/null || true
    exit 0
  fi

  # Produce a clear block message. If full_host != reg_domain the mismatch
  # matters (public-suffix case: github.io in allowlist does NOT grant
  # attacker.github.io; show both so the operator understands why).
  if [[ "$full_host" != "$reg_domain" ]]; then
    block "host '$full_host' (reg-domain '$reg_domain') is not authorized — allowlist entry must match exact host for public-suffix domains (.harness/fetch-allowlist.txt)" "$url"
  else
    block "domain '$reg_domain' is not in the fetch allowlist (.harness/fetch-allowlist.txt)" "$url"
  fi
}

# ---------------------------------------------------------------------------
# Parse tool input from stdin (PreToolUse passes JSON on stdin)
#
# FAIL-CLOSED ON PARSE FAILURE:
#   If stdin is empty — there is no tool invocation to gate; pass through.
#   If stdin is non-empty but jq cannot parse it, OR if jq is absent,
#   we BLOCK rather than defaulting to allow. This ensures that a corrupted
#   or injected non-JSON payload cannot bypass the gate by making
#   tool_name unreadable.
#
#   Exception: truly empty stdin (no bytes) is not a fetch attempt and exits 0.
# ---------------------------------------------------------------------------
RAW_INPUT="$(cat)"

# Empty stdin is not a fetch call — pass through
if [[ -z "$RAW_INPUT" ]]; then
  printf '[fetch-gate] %s · skip (empty stdin) · agent=%s\n' \
    "$TIMESTAMP" "$AGENT" >> "$LOG" 2>/dev/null || true
  exit 0
fi

# Attempt to parse tool_name. Capture jq's exit code separately.
TOOL_NAME=""
JQ_EC=0
TOOL_NAME="$(printf '%s' "$RAW_INPUT" | jq -r '.tool_name // empty' 2>/dev/null)" || JQ_EC=$?

# jq failed (absent, or malformed JSON) — fail CLOSED
if (( JQ_EC != 0 )) || [[ -z "$TOOL_NAME" ]]; then
  # Distinguish: was the input parseable at all?
  PARSE_CHECK_EC=0
  printf '%s' "$RAW_INPUT" | jq -e '.' >/dev/null 2>&1 || PARSE_CHECK_EC=$?
  if (( PARSE_CHECK_EC != 0 )); then
    # Non-JSON or jq absent: fail closed
    printf '[fetch-gate] %s · BLOCK (parse-failure) · agent=%s · jq_ec=%d\n' \
      "$TIMESTAMP" "$AGENT" "$JQ_EC" >> "$LOG" 2>/dev/null || true
    block "untrusted-fetch-gate: stdin is non-JSON or jq is absent — failing closed (parse failure)" "(stdin)"
  fi
  # Parseable JSON but no tool_name field — not a PreToolUse event; pass through
  printf '[fetch-gate] %s · skip (no tool_name in JSON) · agent=%s\n' \
    "$TIMESTAMP" "$AGENT" >> "$LOG" 2>/dev/null || true
  exit 0
fi

printf '[fetch-gate] %s · start · tool=%s · agent=%s\n' \
  "$TIMESTAMP" "$TOOL_NAME" "$AGENT" >> "$LOG" 2>/dev/null || true

# ---------------------------------------------------------------------------
# EGRESS CLASS DISPATCH
#
# Over-gate is safe; under-gate is the false-HAVE.
# If a tool's egress capability is uncertain, GATE it (see UNCERTAIN class).
#
# Classification:
#   URL_BEARING  — tool takes a URL param; gate against allowlist
#   TEXT_QUERY   — tool takes a text query (no URL); gate via token
#   UNCERTAIN    — tool may issue outbound fetches; gate via opt-in token
#   SKIP         — tool has no network-egress capability; explicit pass-through
#   DEFAULT (*)  — any tool not enumerated above is BLOCKED via
#                  handle_uncertain_egress.
#
# DENY-DEFAULT FOR TOOLS (not just domains):
#   The *) branch is intentionally fail-closed. Any newly-added or renamed
#   egress tool falls here and is blocked until it is explicitly classified.
#   This closes the *)=allow completeness gap that let browser_tabs through.
#   To add a new tool: classify it (URL-bearing / uncertain / non-egress),
#   add it to the matching case label, and update the header comment above.
# ---------------------------------------------------------------------------
case "$TOOL_NAME" in

  # -------------------------------------------------------------------------
  # URL_BEARING — domain allowlist check
  # -------------------------------------------------------------------------
  WebFetch|\
  mcp__playwright__browser_navigate|\
  mcp__playwright__browser_navigate_back|\
  mcp__playwright__browser_network_request|\
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__navigate_page|\
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__new_page|\
  mcp__claude_ai_Notion__notion-fetch)

    allowlist_file_check

    URL="$(printf '%s' "$RAW_INPUT" | jq -r '.tool_input.url // .tool_input.href // ""' 2>/dev/null || true)"
    check_url_against_allowlist "$URL" "$TOOL_NAME"
    ;;

  # -------------------------------------------------------------------------
  # URL_BEARING — mcp__playwright__browser_tabs (action:"new" only)
  #
  # browser_tabs is a multi-action tool:
  #   action:"new"            — opens a new tab to a URL (egress-capable)
  #   action:"list"/"close"/"select" — no URL; no egress
  #
  # Gate only when a url is present in tool_input. If no url field, this
  # is a list/close/select call and must pass through (exit 0).
  # Sharing the URL_BEARING branch above is wrong: that branch calls
  # check_url_against_allowlist which BLOCKS on empty URL, which would
  # over-block the non-navigating actions.
  # -------------------------------------------------------------------------
  mcp__playwright__browser_tabs)
    allowlist_file_check

    URL="$(printf '%s' "$RAW_INPUT" | jq -r '.tool_input.url // ""' 2>/dev/null || true)"
    if [[ -z "$URL" ]]; then
      # No url present — list/close/select action; no egress
      printf '[fetch-gate] %s · ALLOW (browser_tabs no-url action) · agent=%s\n' \
        "$TIMESTAMP" "$AGENT" >> "$LOG" 2>/dev/null || true
      exit 0
    fi
    check_url_against_allowlist "$URL" "$TOOL_NAME"
    ;;

  # -------------------------------------------------------------------------
  # TEXT_QUERY — no URL to gate; check opt-in token
  # -------------------------------------------------------------------------
  WebSearch)
    allowlist_file_check

    QUERY="$(printf '%s' "$RAW_INPUT" | jq -r '.tool_input.query // ""' 2>/dev/null || echo "")"
    if is_websearch_allowed; then
      printf '[fetch-gate] ALLOW WebSearch · query_preview=%.60s\n' "$QUERY" >> "$LOG" 2>/dev/null || true
      exit 0
    else
      block "WebSearch is not permitted — add __WEBSEARCH_ALLOW__ to .harness/fetch-allowlist.txt to enable" "query:$QUERY"
    fi
    ;;

  # -------------------------------------------------------------------------
  # UNCERTAIN — egress capability cannot be statically determined from URL
  # param; block unless explicitly opted in via allowlist token.
  #
  # REVIEW-LIST: the tools below are confirmed or suspected to issue outbound
  # requests whose destination cannot be inspected at the hook layer.
  # Each is listed here for review. To opt in one, add the token:
  #   __UNCERTAIN_EGRESS_ALLOW__<tool_suffix>
  # to .harness/fetch-allowlist.txt (requires Peat sign-off).
  # -------------------------------------------------------------------------

  # Playwright: JS eval / code execution may call fetch() to arbitrary URLs
  mcp__playwright__browser_evaluate|\
  mcp__playwright__browser_run_code_unsafe|\
  mcp__playwright__browser_fill_form|\
  mcp__playwright__browser_drop)
    allowlist_file_check
    handle_uncertain_egress "$TOOL_NAME"
    ;;

  # Chrome DevTools: script eval + lighthouse (fetches URLs)
  # performance_start_trace: flagged — egress uncertain (may beacon to external
  # endpoints depending on trace target configuration); kept in UNCERTAIN until
  # confirmed non-egress.
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__evaluate_script|\
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__lighthouse_audit|\
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__performance_start_trace)
    allowlist_file_check
    handle_uncertain_egress "$TOOL_NAME"
    ;;

  # External service MCP tools — ALL calls hit external APIs; the URL is
  # implicit in the MCP server itself, not visible in tool_input.
  # Gate the entire namespace via the UNCERTAIN class.
  mcp__claude_ai_Google_Drive__*|\
  mcp__claude_ai_Gmail__*|\
  mcp__claude_ai_Google_Calendar__*|\
  mcp__claude_ai_Google_Cloud_BigQuery__*|\
  mcp__claude_ai_Airtable__*|\
  mcp__claude_ai_Figma__*|\
  mcp__claude_ai_Quartr__*|\
  mcp__claude_ai_S_P_Global__*|\
  mcp__claude_ai_Notion__*|\
  mcp__plugin_supabase_supabase__*|\
  mcp__plugin_vercel_vercel__*)
    allowlist_file_check
    handle_uncertain_egress "$TOOL_NAME"
    ;;

  # -------------------------------------------------------------------------
  # SKIP — known non-egress tools; explicit pass-through.
  #
  # WHY EXPLICIT INSTEAD OF *)=exit 0:
  #   *) is now fail-closed (see DEFAULT block below). Any unenumerated tool
  #   is blocked, not silently allowed. This means every non-egress tool that
  #   agents use legitimately must be listed here so it is not blocked.
  #   If a new built-in or MCP tool is added that has no outbound-network
  #   capability, add it here with a brief justification. If its egress status
  #   is uncertain, add it to UNCERTAIN instead (opt-in token required).
  #
  # Claude Code built-ins — local file/shell operations only
  Read|Edit|MultiEdit|Write|Bash|Glob|Grep|LS|\
  NotebookEdit|TodoWrite|Task|BashOutput|KillBash|\
  Skill|SlashCommand|ToolSearch|ExitPlanMode)
    printf '[fetch-gate] %s · ALLOW (non-egress built-in) · tool=%s · agent=%s\n' \
      "$TIMESTAMP" "$TOOL_NAME" "$AGENT" >> "$LOG" 2>/dev/null || true
    exit 0
    ;;

  # Playwright tools confirmed non-egress (DOM read/interact/inspect, no navigation)
  # Enumerated against the deferred-tools system-reminder list (authoritative inventory).
  # NOTE: browser_evaluate, browser_run_code_unsafe, browser_fill_form, and
  # browser_drop are NOT listed here — they are in UNCERTAIN above and must
  # stay there. browser_tabs is NOT listed here — it has its own URL_BEARING
  # branch above (action:"new" with url → gated; others → exit 0 inline).
  # browser_navigate / browser_navigate_back / browser_network_request are
  # in URL_BEARING — do not add them here.
  mcp__playwright__browser_snapshot|\
  mcp__playwright__browser_take_screenshot|\
  mcp__playwright__browser_console_messages|\
  mcp__playwright__browser_wait_for|\
  mcp__playwright__browser_press_key|\
  mcp__playwright__browser_type|\
  mcp__playwright__browser_click|\
  mcp__playwright__browser_hover|\
  mcp__playwright__browser_resize|\
  mcp__playwright__browser_select_option|\
  mcp__playwright__browser_handle_dialog|\
  mcp__playwright__browser_close|\
  mcp__playwright__browser_drag|\
  mcp__playwright__browser_file_upload|\
  mcp__playwright__browser_network_requests)
    printf '[fetch-gate] %s · ALLOW (playwright non-egress) · tool=%s · agent=%s\n' \
      "$TIMESTAMP" "$TOOL_NAME" "$AGENT" >> "$LOG" 2>/dev/null || true
    exit 0
    ;;

  # Chrome DevTools tools confirmed non-egress (DOM read/interact/inspect)
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__take_screenshot|\
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__take_snapshot|\
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__list_pages|\
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__select_page|\
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__get_console_message|\
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__list_console_messages|\
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__list_network_requests|\
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__get_network_request|\
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__press_key|\
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__type_text|\
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__click|\
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__fill|\
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__fill_form|\
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__hover|\
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__scroll|\
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__drag|\
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__handle_dialog|\
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__wait_for|\
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__upload_file|\
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__close_page|\
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__resize_page|\
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__emulate|\
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__cursor_position|\
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__performance_analyze_insight|\
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__performance_stop_trace|\
  mcp__plugin_chrome-devtools-mcp_chrome-devtools__take_heapsnapshot)
    printf '[fetch-gate] %s · ALLOW (chrome-devtools non-egress) · tool=%s · agent=%s\n' \
      "$TIMESTAMP" "$TOOL_NAME" "$AGENT" >> "$LOG" 2>/dev/null || true
    exit 0
    ;;

  # computer-use tools — local desktop control only; no outbound network fetch
  mcp__computer-use__*)
    printf '[fetch-gate] %s · ALLOW (computer-use local-desktop) · tool=%s · agent=%s\n' \
      "$TIMESTAMP" "$TOOL_NAME" "$AGENT" >> "$LOG" 2>/dev/null || true
    exit 0
    ;;

  # -------------------------------------------------------------------------
  # DEFAULT — deny-default for TOOLS (fail-closed).
  #
  # Any tool not explicitly classified above (URL-bearing, text-query,
  # uncertain, or SKIP) falls here and is BLOCKED via handle_uncertain_egress.
  # This is intentional: an unenumerated tool must be reviewed and placed in
  # the correct class before it can pass. The *) branch is NOT a catch-all
  # allow; it is a catch-all BLOCK that forces explicit classification.
  #
  # To fix a legitimate tool blocked here:
  #   1. Determine if it issues outbound network requests.
  #   2. If yes with a URL param → add to URL_BEARING.
  #   3. If yes but URL not inspectable → add to UNCERTAIN (opt-in token req'd).
  #   4. If no egress → add to SKIP.
  #   5. Update the header comment in the file.
  # -------------------------------------------------------------------------
  *)
    # Route through handle_uncertain_egress so the operator can opt in via
    # __UNCERTAIN_EGRESS_ALLOW__<tool_suffix> in fetch-allowlist.txt — consistent
    # with all other UNCERTAIN branches. Calling block_uncertain directly would
    # contradict the block message (which tells the operator to add a token).
    allowlist_file_check
    printf '[fetch-gate] %s · BLOCK (unenumerated tool — deny-default) · tool=%s · agent=%s\n' \
      "$TIMESTAMP" "$TOOL_NAME" "$AGENT" >> "$LOG" 2>/dev/null || true
    handle_uncertain_egress "$TOOL_NAME"
    ;;

esac
