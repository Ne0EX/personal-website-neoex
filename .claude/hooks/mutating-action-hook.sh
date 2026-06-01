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
#      net-egress (curl/wget), output-redirection (>>/>/|/tee), shell-inject (bash -c, sh -c)
#   2. Named-pattern denylist (mutating-bash.json)
#   3. Allowlist (can pass through remaining commands)
#   4. First-seen warn (allow but log)
#
# Rationale for order: structural danger patterns like redirection can appear
# inside any command (`echo x >> file`). Checking allowlist first would let
# `^echo ` allowlist `echo secret >> .env`. The allowlist is for intent (this
# command type is known-safe), not for syntax (any suffix is safe).
#
# WHAT IT BLOCKS:
#   Bash: curl/wget (net-egress), rm -rf/-r/-f, chmod/chown/mv, cp,
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

  # ---- PHASE 1: Hard structural denies (no allowlist bypass) ----
  # These patterns catch danger regardless of what the "main" command is.
  # A grep allowlist cannot save `echo x >> secrets.txt`.
  #
  # IMPORTANT: redirect deny patterns run against CMD_NOREDIR (safe redirects
  # already stripped). All other deny patterns still run against CMD (the full
  # original command) so that e.g. curl/wget embedded in a command with safe
  # redirects is still caught.
  #
  # Case-insensitivity (-i): all grep calls here use -i so that uppercase
  # variants (CURL, RM, Git push) are caught. LLMs emit lowercase in practice
  # but case-insensitive matching is cheap and closes the bypass cleanly.
  #
  # Net-egress command-position check: matches curl/wget only when they appear as
  # the executed token (command position), NOT as arguments, filenames, or search
  # patterns. This prevents over-blocking legitimate commands like:
  #   grep -r 'curl' scripts/       (curl as argument to grep)
  #   bash scripts/curl-helper.sh   (curl as part of a filename)
  #   npm run curl-test              (curl as part of npm script name)
  #   find . -name '*curl*' -type f  (curl as part of a glob)
  #   awk '/curl/' file.log          (curl as part of awk pattern)
  #
  # Pattern components:
  #   (^|[;&|(])             — command position: start, or after ; & | (
  #   [[:space:]]*           — optional whitespace after separator
  #   (VAR=val[[:space:]]+)* — zero or more env-var prefix assignments
  #   ([^[:space:]]*/)?      — optional path prefix ending with / (/usr/bin/, ./, etc.)
  #   (curl|wget)            — the executable token itself
  #   ([[:space:]]|$)        — followed by whitespace or end-of-string
  #
  # Still catches all bypass forms:
  #   /usr/bin/curl, /usr/local/bin/curl  (absolute path prefix)
  #   FOO=bar curl, A=b B=c curl          (env-prefix wrapping)
  #   CURL, Curl                           (case-insensitive via -i)
  #   ls; curl, ls | curl, ls && curl     (command chaining)

  # Net-egress
  if echo "$CMD" | grep -qiE '(^|[;&|(])[[:space:]]*(([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]+[[:space:]]+)*)([^[:space:]]*/)?curl([[:space:]]|$)' \
  || echo "$CMD" | grep -qiE '(^|[;&|(])[[:space:]]*(([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]+[[:space:]]+)*)([^[:space:]]*/)?wget([[:space:]]|$)'; then
    block "net-egress denied — curl/wget not permitted. Use the WebFetch tool instead." "$CMD"
  fi

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
  if echo "$CMD_NOREDIR" | grep -qE ' >\s+[A-Za-z0-9_.~/@-]+'; then
    block "output-redirection '>' detected — write by redirection is not permitted." "$CMD"
  fi
  if echo "$CMD_NOREDIR" | grep -qE '>[A-Za-z0-9_.~/@"'"'"'-]'; then
    block "output-redirection '>' (no-space form) detected — write by redirection is not permitted." "$CMD"
  fi
  if echo "$CMD_NOREDIR" | grep -qE ">\|\s*\S"; then
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
  if echo "$CMD" | grep -qiE '(^|[;&|(])[[:space:]]*(([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]+[[:space:]]+)*)([^[:space:]]*/)?tee([[:space:]]|$)'; then
    # tee is in command position — allow only if ALL tee args are devnull/devstd.
    # Match: tee (optional flags) /dev/(null|stdout|stderr) [optional more of same] end
    if echo "$CMD" | grep -qiE '(^|[;&|(])[[:space:]]*([^[:space:]]*/)?tee([[:space:]]+(-[a-zA-Z]+|--[a-zA-Z-]+))*[[:space:]]+/dev/(null|stdout|stderr)([[:space:]]|$)'; then
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
  if echo "$CMD" | grep -qiE '\bpython3?\s+-c\b'; then
    block "shell injection pattern 'python3 -c' detected." "$CMD"
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
