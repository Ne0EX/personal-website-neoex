#!/usr/bin/env bash
# .claude/hooks/mutating-action-hook.sh
#
# BLOCKING PreToolUse hook — least-agency / mutating-action gate.
#
# Wires the dormant engine denylist as a real fail-closed barrier.
# Reads Claude Code's PreToolUse JSON from stdin; exits 2 (block) on violation.
#
# This is "promotion, not invention": the denylist logic lives in
# .harness/engine/core/runtime/mutating-bash.json  (25 bash patterns)
# .harness/engine/core/runtime/mutating-mcp.json   (51 MCP tool patterns)
# This hook reads those JSON files as pure data without requiring tsx.
#
# CHECK ORDER (important):
#   1. Hard structural denies (ALWAYS run first — no allowlist bypass):
#      process-substitution RCE (source/. <(...), interpreter <(curl/wget ...))
#      deterministic curl/wget pipe/chain/newline to interpreter RCE
#      output-redirection (>>/>/|/tee), shell-inject (bash -c, sh -c)
#      NOTE: curl/wget fetch verbs are FULLY un-gated per TASK-2026-06-06-CURL-WGET-UNBLOCK
#      (Peat directive). The RCE floor (bash <(curl), source <(curl), pipe to interpreter)
#      and generic redirect/rm guards remain. No wholesale curl/wget block.
#   2. Named-pattern denylist (mutating-bash.json)
#   3. Allowlist (can pass through remaining commands)
#   4. First-seen warn (allow but log)
#
# Rationale for order: structural danger patterns like redirection can appear
# inside any command (`echo x >> file`). Checking allowlist first would let
# `^echo ` allowlist `echo secret >> .env`. The allowlist is for intent (this
# command type is known-safe), not for syntax (any suffix is safe).
#
# curl/wget posture (FETCH VERBS UN-GATED — TASK-2026-06-06-CURL-WGET-UNBLOCK):
# Peat directive 2026-06-06: curl/wget fetch verbs are fully un-gated, including
# all data/exfil flags (-d, --data*, -F, --form*, -T, --upload-file, -X POST/PUT/
# DELETE, --json, etc.). The active controls are:
#   (a) The RCE floor below — bash/source <(curl), pipe/chain to interpreter
#       (fetch-and-execute patterns). These remain BLOCKED unconditionally.
#   (b) Generic redirect (>>/>) and rm guards (unchanged).
#   (c) The permissions allow-list in settings.json (Peat edits that directly).
# The prior wholesale block (6-round adversarial harden, NOT TIGHT verdict,
# 2026-06-03) is superseded by Peat's explicit un-gate directive. Historical
# archaeology lives in docs/harness/RAIL-DEFINITIONS.md §least-agency-config.
#
# WHAT IT BLOCKS:
#   Bash: process-substitution RCE: source/. <(curl/wget ...) or interpreter <(curl/wget ...)
#         curl/wget fetch-to-interpreter via |, |&, &&, ;, &, or newline,
#         rm -rf/-r/-f, chmod/chown/mv, cp,
#         git push/reset --hard/rebase/merge/rm/mv/tag,
#         npm/pnpm/yarn install/add/remove/update,
#         supabase db push/reset/migrate, vercel deploy,
#         docker run/exec/build/push/rm/kill,
#         output-redirection (>> > >|), tee,
#         bash -c/sh -c (shell injection), python3 -c, node -e, npx tsx -e,
#         sed -i (in-place edit), find -delete
#   MCP:  ~50 mutating tool patterns (supabase, vercel, Notion, Airtable, Calendar, Figma)
#
# WHAT IT ALLOWS:
#   curl/wget fetch verbs — ALL invocations in command position, including data/exfil
#   flags (-d, --data*, -F, --form*, -T, --upload-file, -X POST/PUT/DELETE, --json, etc.)
#   are now fully un-gated per TASK-2026-06-06-CURL-WGET-UNBLOCK (Peat directive).
#   EXCEPTION: feeding fetched content into a shell interpreter remains BLOCKED —
#   bash <(curl ...), source <(curl ...), curl ... | bash, curl ... && bash, etc.
#   git read ops, npm run/test/exec/ci, npx tsx/vitest/eslint/tsc/pagefind/velite,
#   node scripts/, bash .claude/hooks/*, bash scripts/audit-*, bash .harness/*,
#   python3 -m http.server/json.tool, python3 scripts/,
#   chmod +x (specific form), mkdir -p,
#   jq, sha256sum, find . (not find -delete), ls, grep, sort, wc, cat, head, tail,
#   awk, echo, printf, sed (without -i), WL_* env prefixed commands
#   Read-only MCP tools (playwright browser_*)
#
# Owner: Canopus · α-HRN-07
# Introduced: TASK-2026-06-01-SECURITY-HARNESS-WAVE-0-1
# Revised: TASK-2026-06-03-CURL-WGET-OBSERVE-ALLOW (danger-targeted rule, superseded)
# Revised: TASK-2026-06-03-CURL-WGET-WHOLESALE-REVERT (wholesale block — NOT TIGHT verdict)
# Revised: TASK-2026-06-06-CURL-WGET-UNBLOCK (Peat directive — fetch verbs fully un-gated; only fetch-and-execute RCE floor + generic redirect/rm guards remain)
# Rail: least-agency-config (barrier_class=HARD-BARRIER, mode=block)
# Design: SECURITY-HARNESS-DESIGN-2026-06-01.md §3 "Tool / resource misuse"
#
# Exit codes:
#   0  — allow
#   2  — BLOCK (Claude Code treats exit 2 as block with message)

set -uo pipefail

ROOT="${HARNESS_REPO_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
BASH_DENYLIST="$ROOT/.harness/engine/core/runtime/mutating-bash.json"
MCP_DENYLIST="$ROOT/.harness/engine/core/runtime/mutating-mcp.json"
BASH_ALLOWLIST_CONFIG="$ROOT/.harness/engine/harness.config.json"
LOG_DIR="$ROOT/.claude/hook-logs"
TASK_ID="${WL_TASK_ID:-${CLAUDE_TASK_ID:-adhoc}}"
LOG="$LOG_DIR/${TASK_ID}--mutating-action-hook.log"

mkdir -p "$LOG_DIR" 2>/dev/null || true

block() {
  local reason="$1"
  local cmd_preview="${2:-}"
  echo "[mutating-action] BLOCKED: $reason" >> "$LOG" 2>/dev/null || true
  echo ""
  echo "BLOCKED by mutating-action-hook: $reason"
  if [[ -n "$cmd_preview" ]]; then
    echo "Command: ${cmd_preview:0:120}"
  fi
  echo ""
  echo "If this is a legitimate operation, request an explicit allow entry in"
  echo ".claude/settings.local.json or escalate to Canopus to update the denylist."
  exit 2
}

# --- Read stdin payload ---
PAYLOAD="$(cat 2>/dev/null || true)"
if [[ -z "$PAYLOAD" ]]; then
  echo "[mutating-action] WARNING: no stdin payload — allowing" >> "$LOG" 2>/dev/null || true
  exit 0
fi

# Extract fields from Claude Code PreToolUse JSON envelope
TOOL_NAME=$(printf '%s' "$PAYLOAD" | jq -r '.tool_name // .tool // ""' 2>/dev/null || true)
COMMAND=$(printf '%s' "$PAYLOAD" | jq -r '.tool_input.command // ""' 2>/dev/null || true)

# --- Denylist files sanity ---
if [[ ! -f "$BASH_DENYLIST" ]]; then
  echo "[mutating-action] WARNING: bash denylist not found at $BASH_DENYLIST — allowing (degraded mode)" >> "$LOG" 2>/dev/null || true
  exit 0
fi
if [[ ! -f "$MCP_DENYLIST" ]]; then
  echo "[mutating-action] WARNING: MCP denylist not found at $MCP_DENYLIST — allowing (degraded mode)" >> "$LOG" 2>/dev/null || true
  exit 0
fi

# --------------------------------------------------------------------------
# BASH TOOL CHECK
# --------------------------------------------------------------------------
if [[ "$TOOL_NAME" == "Bash" ]]; then
  CMD="${COMMAND}"

  # ---- SHARED command-position lead-in (CMD_LEADIN) ----
  # A "command position" is where the shell begins parsing a fresh simple command,
  # i.e. where curl/wget/tee/source/an-interpreter would be the EXECUTED token rather
  # than an argument, filename, or search pattern. Every command-position gate in this
  # hook (curl/wget detection, tee detection, source/. <(...) RCE, interpreter <(...) RCE)
  # MUST use the SAME lead-in so a single shell construct cannot bypass one gate while
  # tripping another.
  #
  # Recognized command lead-ins:
  #   ^            start of string
  #   ; & | ( )    statement separators / pipe / subshell open / case-pattern or
  #                subshell close. ')' is a command lead-in in a case arm
  #                ('case x in y) curl ...;; esac' — a command begins after the ')').
  #   { <ws>       brace-group open token. In shell, '{' is a command-list keyword ONLY
  #                when followed by whitespace ('{ cmd; }'); '{curl' / '{a,b}' are words
  #                or brace-expansions, NOT a command position — so we REQUIRE the
  #                trailing whitespace (\{[[:space:]]) and do not match the word forms.
  #   then|do|else|elif|until   compound-command keywords after which a command begins.
  #                Each is itself anchored on its left by ^ / a separator / whitespace
  #                and on its right by whitespace, so it only matches the bare keyword
  #                TOKEN, never a substring (e.g. 'then-curl-dir', 'do-not-curl').
  #
  # ROOT CAUSE (Algol R4 #brace-group, #shell-keyword): the previous anchor was
  # (^|[;&|(]) — it knew ^ ; & | ( but NOT '{' and NOT the compound-command keywords.
  # A curl/wget/source/interpreter placed first inside a brace group ('{ curl -d ... }')
  # or right after then/do/else/elif/until ('if ...; then curl -d ...; fi') was preceded
  # by a token the anchor did not recognize, so the WHOLE danger block was skipped and
  # the command fell through to ALLOW. Isolation control: '; curl -d ...' BLOCKs but
  # '{ curl -d ...' / 'then curl -d ...' ALLOWed — only the lead-in token differed.
  # Fix: one shared lead-in that recognizes '{ ' and the keyword tokens, applied to
  # every command-position gate below.
  CMD_LEADIN='(^|[;&|()]|\{[[:space:]]|(^|[;&|()]|[[:space:]])(then|do|else|elif|until)[[:space:]])'

  # ---- PHASE 0: Unconditional structural allows (run before any deny) ----
  # chmod +x on our own hook/script paths is explicitly permitted.
  # This runs before Phase 1 denies to prevent the chmod denylist from blocking
  # legitimate script permission setup.
  if echo "$CMD" | grep -qE '^chmod \+x '; then
    exit 0
  fi

  # Safe-redirect stripping — build CMD_NOREDIR for redirect deny checks.
  #
  # SCOPE OF THIS CONTROL:
  #   This stripping logic provides deterministic defense against careless or
  #   accidental destructive redirects and named-command egress. It is NOT a
  #   full shell parser and does NOT claim to defeat arbitrary shell obfuscation
  #   (e.g. eval, heredoc, process substitution, variable-as-command). Those
  #   metacharacter patterns are logged-not-blocked by explicit policy (see the
  #   metacharacter-eval block in Phase 1 below and scope-waivers.json). For a
  #   solo-garden threat model, OS-sandbox is the correct hard-barrier layer for
  #   a determined adversary; this hook is FRICTION-strong, not HARD-barrier
  #   against deliberate obfuscation.
  #
  # SAFE redirects (fd plumbing / devnull — NOT destructive):
  #   cmd 2>/dev/null          — suppress stderr
  #   cmd >/dev/null           — suppress stdout
  #   cmd 1>/dev/null          — suppress stdout (explicit fd)
  #   cmd 2>&1                 — merge stderr into stdout
  #   cmd >/dev/null 2>&1      — suppress all
  #   cmd &>/dev/null          — bash combined redirect to devnull
  #   tee /dev/null            — tee to devnull (no-op write)
  #
  # These are stripped from the command before redirect deny patterns run.
  # The patterns are end-anchored so that /dev/null is only stripped when
  # followed by whitespace, a shell metachar (;|&), or end-of-string — never
  # by more path chars. This prevents /dev/nullX, /dev/null.txt, /dev/nullfoo,
  # /dev/null/../../tmp/evil from having their /dev/null prefix eaten, leaving
  # a real write target that bypasses the deny check.
  # The trailing separator (group 3 in passes 2 and 3) is preserved via \3
  # so chained redirects like >/dev/null 2>&1 still fully strip.
  #
  # Strip order:
  #   1. fd duplication:  [0-9]*>&[0-9]                end-anchored by >&N token boundary
  #   2. bash combined:   &>/dev/(null|stdout|stderr)   end-anchored: must be followed by [ \t;|&){}] or $
  #   3. devnull/devstd:  [0-9]?>/dev/(null|stdout|stderr) same end-anchor rule
  #
  # PASSES 2+3 anchor expanded from [ \t;|&] to [ \t;|&){}]:
  #   Subshell terminators ) and group terminators { } are now included.
  #   Without this, (echo hi >/dev/null) and (cmd 2>/dev/null) would fail to strip
  #   the /dev/null because the closing ) was not in the anchor class, leaving
  #   a CMD_NOREDIR that triggers the single-> deny check and wrongly BLOCKs
  #   the subshell form. Fix: add ){}  to the anchor. Pass 1 (>&N) is unaffected
  #   because the digit anchor already self-terminates.
  # Use sed for deterministic text substitution; -E for ERE; no -i (not in-place).
  #
  # PASS 1 end-anchor: [0-9]*>&[0-9] — the >&N token is already bounded on the
  # right by the [0-9] character class (a digit is the last char, not a letter/path).
  # However 2>&1x would strip to leave 'x' — a bare letter, not a path that hits
  # deny checks, so it silently allows. Fix: require the digit to be followed by
  # [ \t;|&] or end-of-string. Use the same backref-preserve technique.
  CMD_NOREDIR="$(printf '%s' "$CMD" \
    | sed -E 's/([0-9]*>[&][0-9])([ \t;|&]|$)/\2/g' \
    | sed -E 's/([&]>\/dev\/(null|stdout|stderr))([ \t;|&){}]|$)/\3/g' \
    | sed -E 's/([0-9]?>\/dev\/(null|stdout|stderr))([ \t;|&){}]|$)/\3/g')"

  # FP-2 ROOT-CAUSE: quoted > inside echo/printf arguments is NOT a redirect.
  # `echo "a -> b"` and `echo 'x > y'` were blocked because CMD_NOREDIR still
  # contains the quoted span and ` > y` looks like a spaced single-redirect.
  # FIX: build CMD_REDIRCHECK by additionally stripping double- and single-quoted
  # spans from CMD_NOREDIR. Used ONLY for single-`>` redirect detection (Pass A and
  # Pass B below); the `>>` patterns still run against CMD_NOREDIR because the `>>`
  # operator in `cat k >> "/tmp/evil"` is OUTSIDE the quoted filename span — stripping
  # `"/tmp/evil"` leaves `cat k >> ` which still has `>>` and is correctly blocked.
  # MUST-STILL-BLOCK: `echo secret > .env` — the `>` is outside all quotes so
  # CMD_REDIRCHECK still contains ` > .env` and the redirect pattern fires.
  CMD_REDIRCHECK="$(printf '%s' "$CMD_NOREDIR" \
    | sed -E 's/"[^"]*"//g' \
    | sed -E "s/'[^']*'//g")"

  # ---- PHASE 1: Hard structural denies (no allowlist bypass) ----
  # These patterns catch danger regardless of what the "main" command is.
  # A grep allowlist cannot save `echo x >> secrets.txt`.
  #
  # IMPORTANT: redirect deny patterns run against CMD_NOREDIR (safe redirects
  # already stripped). All other deny patterns still run against CMD (the full
  # original command) so that e.g. curl/wget embedded in a command with safe
  # redirects is still caught.
  #
  # Case-insensitivity (-i): structural-deny greps that need it (rm, git, etc.)
  # use -i. The curl/wget exfil-flag checks are case-SENSITIVE: flag names like
  # -d, -F, -T are lowercase by convention; using -i on them would let -D
  # (--dump-header, a safe receive flag) match -d. See Fix-5 note below.

  # ---- PHASE 1 GLOBAL: process-substitution RCE (source/dot <(...)) ----
  # FIX-4: `source <(curl URL)` and `. <(curl URL)` feed fetched content
  # directly into the shell interpreter. The outer command is source/.,
  # not curl, so the curl-branch pipe-check never fires. Block structurally,
  # before the curl branch, so this cannot be side-stepped.
  # Pattern: any command boundary followed by source or . then <(
  # Cite: RCE — shell executing arbitrary remote content.
  if echo "$CMD" | grep -qE "${CMD_LEADIN}[[:space:]]*(source|\.)[[:space:]]+<\("; then
    block "process-substitution RCE: source/. <(...) feeds fetched content into shell — not permitted." "$CMD"
  fi

  # FIX-R2-g: interpreter run directly on a process-substitution of a fetch.
  #   bash <(curl -s URL), sh <(curl URL), python3 <(curl URL), node <(wget -qO- URL)
  # Only source/. <(...) was structurally blocked above; bash/sh/zsh/python/node/etc.
  # <(curl ...) fed fetched content straight into the interpreter and bypassed.
  # Gate on the process-sub actually containing a curl/wget fetch so legitimate
  # process substitution (diff <(sort a) <(sort b)) is not affected.
  # Also allow an optional wrapper word (command/env/sudo) before the interpreter.
  if echo "$CMD" | grep -qiE "${CMD_LEADIN}[[:space:]]*((command|env|exec|sudo|xargs|nice|time|stdbuf|nohup)[[:space:]]+)*(sh|bash|zsh|dash|ksh|python3?|node|ruby|perl|php)[[:space:]]+<\([^)]*\b(curl|wget)\b"; then
    block "process-substitution RCE: interpreter <(curl/wget ...) feeds fetched content into the shell — not permitted." "$CMD"
  fi

  # ---- PHASE 1 GLOBAL: deterministic fetch-and-execute RCE ----
  # Ordinary curl/wget remains un-gated. Block only a literal fetch command whose
  # output is fed directly (| or |&) to a known interpreter/execution sink. This
  # is intentionally a bounded shell-shape classifier, not a wholesale fetch gate.
  #
  # Keep these fragments POSIX-ERE compatible: the hook runs with the platform
  # grep in local development and GNU grep in Ubuntu CI.
  FETCH_COMMAND="${CMD_LEADIN}[[:space:]]*(([A-Za-z_][A-Za-z0-9_]*=[^[:space:];&|(){}]+[[:space:]]+)*)([^[:space:];&|(){}]*/)?(curl|wget)[[:space:]]+"
  FETCH_PIPE="${FETCH_COMMAND}[^|;&]*[[:space:]]*\|&?[[:space:]]*"
  CMD_FETCH_CHAINS="${CMD//$'\n'/;}"
  FETCH_CHAIN="${FETCH_COMMAND}[^|;&]*[[:space:]]*(&&|;|&)[[:space:]]*"
  EXEC_PATH='([^[:space:];&|(){}]*/)?'
  EXEC_ASSIGNMENT='[A-Za-z_][A-Za-z0-9_]*=[^[:space:];&|(){}]+[[:space:]]+'
  EXEC_SIMPLE_WRAPPER="${EXEC_PATH}(command|builtin|env|exec|sudo|doas|nice|time|stdbuf|nohup|unbuffer|watch)([[:space:]]+-[^[:space:];&|(){}]+)*[[:space:]]+"
  EXEC_TIMEOUT_WRAPPER="${EXEC_PATH}timeout([[:space:]]+-[^[:space:];&|(){}]+([[:space:]]+[^[:space:];&|(){}]+)?)*[[:space:]]+[0-9]+([.][0-9]+)?[smhd]?[[:space:]]+"
  EXEC_CHROOT_WRAPPER="${EXEC_PATH}chroot[[:space:]]+[^[:space:];&|()]+[[:space:]]+"
  EXEC_XARGS_WRAPPER="${EXEC_PATH}xargs([[:space:]]+-[^[:space:];&|()]+)*[[:space:]]+"
  EXEC_PREFIX="(${EXEC_ASSIGNMENT}|${EXEC_SIMPLE_WRAPPER}|${EXEC_TIMEOUT_WRAPPER}|${EXEC_CHROOT_WRAPPER}|${EXEC_XARGS_WRAPPER})*"
  EXEC_INTERPRETER='(sh|bash|zsh|dash|ksh|fish|csh|tcsh|xonsh|pwsh|python([0-9]+([.][0-9]+)*)?|ruby([0-9]+([.][0-9]+)*)?|perl([0-9]+([.][0-9]+)*)?|php([0-9]+([.][0-9]+)*)?|node|lua([0-9]+([.][0-9]+)*)?|deno|bun|tclsh|Rscript|osascript|julia|expect|gdb|source|\.)'
  EXEC_BOUNDARY='([[:space:];&|)}]|$)'

  if echo "$CMD" | grep -qiE "${FETCH_PIPE}${EXEC_PREFIX}${EXEC_PATH}${EXEC_INTERPRETER}${EXEC_BOUNDARY}"; then
    block "fetch-and-execute RCE: curl/wget output piped to an interpreter — not permitted." "$CMD"
  fi

  if echo "$CMD_FETCH_CHAINS" | grep -qiE "${FETCH_CHAIN}${EXEC_PREFIX}${EXEC_PATH}${EXEC_INTERPRETER}${EXEC_BOUNDARY}"; then
    block "fetch-and-execute RCE: curl/wget chained to an interpreter — not permitted." "$CMD"
  fi

  # awk is normally a safe stream processor; only stdin-as-program/system forms
  # are execution sinks. Likewise, make/crontab are blocked only when the pipe is
  # explicitly consumed as instructions rather than ordinary data.
  if echo "$CMD" | grep -qiE "${FETCH_PIPE}${EXEC_PREFIX}${EXEC_PATH}(awk|gawk|mawk)[[:space:]]+[^;&|]*(system[[:space:]]*\(|-f[[:space:]]+(-|/dev/stdin)${EXEC_BOUNDARY})" \
  || echo "$CMD" | grep -qiE "${FETCH_PIPE}${EXEC_PREFIX}${EXEC_PATH}make[[:space:]]+[^;&|]*-f[[:space:]]+(-|/dev/stdin)${EXEC_BOUNDARY}" \
  || echo "$CMD" | grep -qiE "${FETCH_PIPE}${EXEC_PREFIX}${EXEC_PATH}crontab[[:space:]]+(-|/dev/stdin)${EXEC_BOUNDARY}"; then
    block "fetch-and-execute RCE: curl/wget output piped to an instruction-consuming command — not permitted." "$CMD"
  fi

  # curl/wget fetch verbs: FULLY UN-GATED per TASK-2026-06-06-CURL-WGET-UNBLOCK.
  # Peat directive: no wholesale block, no precision-gating of curl/wget command position.
  # The RCE floor (source/. <(...), interpreter <(curl/wget ...), pipe/chain to interpreter)
  # is handled above in PHASE 1 GLOBAL. Generic redirect (>>/>) and rm guards below
  # remain unchanged.
  # Historical wholesale block (adversarial harden NOT TIGHT verdict, 2026-06-03) is
  # superseded. See docs/harness/RAIL-DEFINITIONS.md §least-agency-config for archaeology.

  # rm (any form — rm -rf, rm -r, rm -f, rm file)
  if echo "$CMD" | grep -qiE '\brm\s+(-[a-zA-Z]*[rf][a-zA-Z]*)?\s*\S'; then
    block "rm command detected — file deletion is not permitted. Use the file tools." "$CMD"
  fi

  # Output redirection (>> and > to file — but not heredoc <<)
  # IMPORTANT: these patterns run against CMD_NOREDIR — safe redirects to /dev/null,
  # /dev/std*, and fd duplications (2>&1) have already been stripped.
  # Any remaining > or >> target is a real filesystem path and must be blocked.
  #
  # Path charset: [A-Za-z0-9_.~/@-] — includes ~ (home expansion) and @ (Docker
  # image refs sometimes appear in paths). Previous charset omitted ~ causing
  # `cat k >> ~/.bashrc` to pass through.
  if echo "$CMD_NOREDIR" | grep -qE '>>\s*[A-Za-z0-9_.~/@-]+'; then
    block "output-redirection '>>' detected — write by redirection is not permitted." "$CMD"
  fi
  if echo "$CMD_NOREDIR" | grep -qE ">>\s*['\"][^'\"]+['\"]"; then
    block "output-redirection '>>' to quoted filename detected." "$CMD"
  fi
  # Single > redirect (not ==, ->, =>) — catches both spaced form and no-space form.
  # Original pattern ' >\s+...' missed `echo x >file` (no space between > and filename).
  # New pattern: any > not immediately preceded or followed by another > or = or |,
  # followed immediately by a non-whitespace char (no-space redirect),
  # OR followed by whitespace then a filename (spaced redirect).
  # Uses two passes for clarity:
  #   Pass A: spaced — " > filename"
  #   Pass B: no-space — ">filename" (> immediately followed by [A-Za-z0-9_.~/@'"-])
  #
  # FP-2 ROOT-CAUSE: these checks run against CMD_REDIRCHECK (quoted spans stripped),
  # NOT CMD_NOREDIR, so that `echo 'x > y'` and `printf '%s\n' 'col1 > col2'` do not
  # trigger the redirect deny. The `>` inside a quoted string is not a redirect operator.
  # MUST-STILL-BLOCK: `echo secret > .env` — the `>` is outside quotes so
  # CMD_REDIRCHECK retains ` > .env` and the pattern fires. Pass B ">filename" also
  # catches `echo x >file` (no-space form, > outside quotes).
  # The `>>` patterns above run against CMD_NOREDIR (not CMD_REDIRCHECK) because
  # `cat k >> "/tmp/evil"` has the `>>` OPERATOR outside quotes; after quote-stripping
  # the filename, `>>` remains and correctly blocks. Do not move `>>` to CMD_REDIRCHECK.
  if echo "$CMD_REDIRCHECK" | grep -qE ' >\s+[A-Za-z0-9_.~/@-]+'; then
    block "output-redirection '>' detected — write by redirection is not permitted." "$CMD"
  fi
  if echo "$CMD_REDIRCHECK" | grep -qE '>[A-Za-z0-9_.~/@"'"'"'-]'; then
    block "output-redirection '>' (no-space form) detected — write by redirection is not permitted." "$CMD"
  fi
  if echo "$CMD_REDIRCHECK" | grep -qE ">\|\s*\S"; then
    block "output-redirect with pipe '>' detected." "$CMD"
  fi
  # Malformed fd-dup tail: >&N followed by non-separator characters (e.g. 2>&1x).
  # The end-anchored pass-1 strip correctly does NOT strip these forms (the digit is
  # followed by a non-separator, so the anchor condition fails). CMD_NOREDIR retains
  # the token. The existing deny patterns don't catch it because '>&' starts with &,
  # which is outside the path-char charset. Explicitly deny.
  # Note: bash itself rejects 2>&1x as "ambiguous redirect" (no real write occurs),
  # but we block it here for strict defense-in-depth: any fd-dup token not fully
  # stripped is suspicious and should not silently pass.
  if echo "$CMD_NOREDIR" | grep -qE '>[&][0-9][A-Za-z0-9_]'; then
    block "malformed fd-dup redirect tail detected (e.g. 2>&1x) — possible redirect smuggle attempt." "$CMD"
  fi

  # tee — block in command position, with an exception for pure-devnull forms.
  # `tee /dev/null`, `tee /dev/stdout`, `tee /dev/stderr` are no-op or fd writes,
  # not filesystem writes. These are allowed; all other tee invocations are blocked.
  # The exception is checked first (Phase 0 style): if the ENTIRE tee argument list
  # (after stripping flags) resolves to safe targets only, allow; otherwise block.
  # "entire" is determined by: after removing flags (-a, --append) and safe targets,
  # nothing remains.
  #
  # Rather than complex parsing, use a simpler two-step:
  #   Step 1: does tee appear in command position?
  #   Step 2: does a safe-only form pattern match? If yes, allow. Otherwise block.
  #
  # Safe-only patterns (exhaustive for our use-cases):
  #   tee /dev/null
  #   tee /dev/stdout
  #   tee /dev/stderr
  #   tee -a /dev/null  (append to /dev/null — still safe)
  #
  # Command-position pattern: same logic as curl/wget — match tee only when it
  # is the executed token, not when it appears as an argument or filename.
  # Prevents false-positive on: grep 'tee' logs.txt, ls tee-outputs/, etc.
  if echo "$CMD" | grep -qiE "${CMD_LEADIN}[[:space:]]*(([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]+[[:space:]]+)*)([^[:space:]]*/)?tee([[:space:]]|$)"; then
    # tee is in command position — allow only if ALL tee args are devnull/devstd.
    # Match: tee (optional flags) /dev/(null|stdout|stderr) [optional more of same] end
    # Trailing boundary is [[:space:];&|)}] (not just [[:space:]]|$) so a safe devnull
    # tee terminated by a shell metachar — '{ cmd | tee /dev/null; }', 'tee /dev/null)' —
    # is still recognized as the safe form. The smuggle forms (/dev/nullX, /dev/null.txt)
    # stay BLOCKED: a letter/dot after 'null' is not in the boundary set, so the safe
    # pattern fails to match and the command falls through to the tee block.
    if echo "$CMD" | grep -qiE "${CMD_LEADIN}[[:space:]]*([^[:space:]]*/)?tee([[:space:]]+(-[a-zA-Z]+|--[a-zA-Z-]+))*[[:space:]]+/dev/(null|stdout|stderr)([[:space:];&|)}]|$)"; then
      # Safe devnull/devstd tee — allow
      true
    else
      block "tee command detected — file write via tee is not permitted." "$CMD"
    fi
  fi

  # Shell injection vectors
  if echo "$CMD" | grep -qiE '\b(bash|sh)\s+-[a-z]*c\s'; then
    block "shell injection pattern 'bash/sh -c' detected." "$CMD"
  fi
  # FP-3 TENSION NOTE (Phase-0 slice 0.2 investigation): `python3 -c` was listed as a
  # false-positive candidate because audit scripts in this repo used it. Investigation
  # shows the real-world read-only python3 uses are already allowlisted:
  #   - `python3 -m json.tool` (Phase 3 allowlist: ^python3 -m )
  #   - `python3 scripts/...`  (Phase 3 allowlist: ^python3 scripts/)
  # The only path that reaches this block is `python3 -c <inline-code>`, which is
  # genuine arbitrary-code execution and an RCE surface (equivalent to bash -c).
  # RESOLUTION: block stays as-is (fail-closed default). No weakening without
  # Peat-seam sign-off. The FP is already mitigated by the allowlist paths above;
  # any new audit script that previously used python3 -c should be rewritten as
  # `python3 scripts/<name>.py` to stay allowlisted.
  if echo "$CMD" | grep -qiE '\bpython3?\s+-c\b'; then
    block "shell injection pattern 'python3 -c' detected — inline code execution is not permitted. Use python3 scripts/<name>.py instead." "$CMD"
  fi
  if echo "$CMD" | grep -qiE '\bnode\s+-e\b'; then
    block "shell injection pattern 'node -e' detected." "$CMD"
  fi
  if echo "$CMD" | grep -qiE '\bnpx\s+tsx\s+--?e(val)?\b|\bnpx\s+tsx\s+-e\b'; then
    block "shell injection pattern 'npx tsx -e/--eval' detected." "$CMD"
  fi

  # sed -i (in-place file edit — destructive)
  if echo "$CMD" | grep -qiE '\bsed\s+-[a-z]*i\b'; then
    block "sed -i (in-place edit) detected — use the Edit tool instead." "$CMD"
  fi

  # Metacharacter evaluation (command substitution, variable-as-command).
  # We cannot reliably defeat arbitrary shell obfuscation (e.g. X=rm; $X -rf .
  # or $(echo rm) -rf .), but we MUST NOT silently ALLOW them.
  # Policy: log as first-seen/unrecognized and ALLOW (Phase 4 behavior), but
  # emit a prominent warning so the audit log records the event.
  # These are caught here (before allowlist) so the log entry is always written,
  # even if the command would otherwise match an allowlist pattern.
  if echo "$CMD" | grep -qE '\$\(|`[^`]+`|\$[A-Za-z_][A-Za-z0-9_]*\s+-'; then
    echo "[mutating-action] WARN metacharacter-eval (not blocked — shell obfuscation cannot be reliably parsed): ${CMD:0:120}" >> "$LOG" 2>/dev/null || true
    echo ""
    echo "WARNING by mutating-action-hook: metacharacter evaluation pattern detected."
    echo "Command: ${CMD:0:120}"
    echo "This pattern (\$(...), backtick substitution, or \$VAR -flag) cannot be"
    echo "reliably blocked without a full shell parser. The command is being ALLOWED"
    echo "but logged. If this is adversarial, it will appear in the audit log."
    echo ""
    # Do not exit here — fall through to allowlist/first-seen logic below.
    # The warning above is the mitigation; the audit log is the record.
  fi

  # ---- PHASE 2: Named-pattern denylist (mutating-bash.json) ----
  # These patterns run BEFORE allowlist (allowlist cannot override known-bad patterns).
  # Patterns already handled in Phase 1 are still in the denylist for defense-in-depth
  # but the Phase 1 checks provide cleaner error messages.

  while IFS= read -r pattern; do
    [[ -z "$pattern" ]] && continue
    # Skip redirect/tee/inject patterns already handled in Phase 1 (avoid double-block message)
    case "$pattern" in
      '>>?'*|'>|'*|'\btee\b'|'\b(bash|sh)'*|'\bpython3?'*|'\bnode\s+-e'*|'\bnpx\s+tsx'*|'\bsed\s+-'*)
        continue ;;
    esac
    if echo "$CMD" | grep -qiE "$pattern" 2>/dev/null; then
      block "command matches mutating-action denylist pattern /$pattern/" "$CMD"
    fi
  done < <(jq -r '.denylist_regex // [] | .[]' "$BASH_DENYLIST" 2>/dev/null || true)

  # ---- PHASE 3: Allowlist (known-safe command types) ----
  if [[ -f "$BASH_ALLOWLIST_CONFIG" ]]; then
    while IFS= read -r pattern; do
      [[ -z "$pattern" ]] && continue
      if echo "$CMD" | grep -qE "$pattern" 2>/dev/null; then
        # Allowlisted — permit; no log entry needed (clean path)
        exit 0
      fi
    done < <(jq -r '.mutating_actions.bash_allowlist // [] | .[]' "$BASH_ALLOWLIST_CONFIG" 2>/dev/null || true)
  fi

  # ---- PHASE 4: First-seen warn (allow but log) ----
  # Command is unrecognized but not on the denylist. Per the engine design,
  # first_seen_command_mode=warn means allow with a log entry, not block.
  if [[ -n "$CMD" ]]; then
    echo "[mutating-action] WARN first-seen (allowed): ${CMD:0:80}" >> "$LOG" 2>/dev/null || true
  fi
  exit 0
fi

# --------------------------------------------------------------------------
# MCP TOOL CHECK
# --------------------------------------------------------------------------
if [[ "$TOOL_NAME" == mcp__* ]]; then
  while IFS= read -r pattern; do
    [[ -z "$pattern" ]] && continue
    if echo "$TOOL_NAME" | grep -qE "$pattern" 2>/dev/null; then
      block "MCP tool '$TOOL_NAME' is on the mutating-tool denylist — this tool performs a write/mutating operation." ""
    fi
  done < <(jq -r '.mutating_tool_regex // [] | .[]' "$MCP_DENYLIST" 2>/dev/null || true)

  # MCP tool not on denylist — allow
  exit 0
fi

# Not a Bash or mcp__ tool — allow (Read, Write, Edit, Task, etc. are not in scope)
exit 0
