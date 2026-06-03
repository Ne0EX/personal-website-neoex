#!/usr/bin/env bash
# .claude/hooks/dev-clobber-guard.sh
#
# BLOCKING PreToolUse hook — G1 dev-clobber guard.
#
# Enforces worldline-build-verify G1: a stray `next dev` clobbers the shared
# .next directory (dev mode), which breaks production `next start`. On 2026-06-02
# this served the whole site unstyled. This hook blocks a production build or
# serve from starting while a `next dev` process is alive.
#
# TRIGGER (blocking):
#   command is about to run a production build or serve — i.e. matches:
#     next build, next start, npm run build, npm run start,
#     pnpm build, pnpm start, yarn build, yarn start
#   in command position (not as a grep pattern, not in a commit message,
#   not as a filename argument — see detection logic below).
#   If a live `next dev` process is found → BLOCK (exit 2) with PID and fix.
#   If no live `next dev` → allow (exit 0).
#
# TRIGGER (advisory, non-blocking):
#   command starts a `next dev` or `npm run dev` — emit a one-line reminder
#   to kill it when done. Does NOT block.
#
# COMMAND-POSITION ANCHORING:
#   Matches `next build|start`, `npm run build|start`, `pnpm build|start`,
#   `yarn build|start` only when they appear as the EXECUTED token — i.e. at
#   start of string, or after a command separator (; & | () with optional
#   whitespace and optional env-var prefix assignments (KEY=val pattern).
#   This mirrors the curl/wget command-position logic in mutating-action-hook.sh.
#   Safe non-matches (tested in fixture):
#     grep "next build" foo.txt         — 'next' is an argument to grep
#     git commit -m "npm run build"     — inside a quoted string
#     echo "next start docs"            — 'next' after echo (advisory only)
#
# COMPOSITION:
#   This hook runs ALONGSIDE mutating-action-hook.sh (both are PreToolUse Bash).
#   Both are registered in settings.json; Claude Code runs all matching hooks.
#   This hook does NOT duplicate or replace mutating-action-hook.sh logic.
#   It has a narrower scope: only production-build-vs-dev-process conflicts.
#
# EXIT CODES:
#   0  — allow (no conflict, or command is not a build/serve/dev trigger)
#   2  — BLOCK (Claude Code treats exit 2 as block with message)
#
# Owner: Canopus · α-HRN-07
# Introduced: TASK-2026-06-03-DEV-CLOBBER-GUARD-G1
# Rail: dev-clobber-guard (barrier_class=HARD-BARRIER, mode=block)
# Policy: worldline-build-verify G1

set -uo pipefail

ROOT="${HARNESS_REPO_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
LOG_DIR="$ROOT/.claude/hook-logs"
TASK_ID="${WL_TASK_ID:-${CLAUDE_TASK_ID:-adhoc}}"
LOG="$LOG_DIR/${TASK_ID}--dev-clobber-guard.log"

mkdir -p "$LOG_DIR" 2>/dev/null || true

block() {
  local reason="$1"
  local extra="${2:-}"
  echo "[dev-clobber-guard] BLOCKED: $reason" >> "$LOG" 2>/dev/null || true
  echo ""
  echo "BLOCKED by dev-clobber-guard [worldline-build-verify G1]"
  echo ""
  echo "  $reason"
  if [[ -n "$extra" ]]; then
    echo "  $extra"
  fi
  echo ""
  echo "  How to fix: kill the dev process, then re-run the production build."
  echo "  Reference: worldline-build-verify G1 (docs/harness/RAIL-DEFINITIONS.md#rail-dev-clobber-guard)"
  exit 2
}

# --- Read stdin payload ---
PAYLOAD="$(cat 2>/dev/null || true)"
if [[ -z "$PAYLOAD" ]]; then
  exit 0
fi

# Extract fields
TOOL_NAME=$(printf '%s' "$PAYLOAD" | jq -r '.tool_name // .tool // ""' 2>/dev/null || true)
COMMAND=$(printf '%s' "$PAYLOAD" | jq -r '.tool_input.command // ""' 2>/dev/null || true)

# Only intercept Bash tool calls
[[ "$TOOL_NAME" != "Bash" ]] && exit 0

CMD="$COMMAND"

# --------------------------------------------------------------------------
# COMMAND-POSITION DETECTION
#
# The command-position anchor pattern is:
#   (^|[;&|(])          — start of string, or after separator ; & | (
#   [[:space:]]*        — optional whitespace
#   (KEY=val[[:space:]]+)* — zero or more env-var prefix assignments
#   ([^[:space:]]*/)?   — optional absolute path prefix (e.g. /usr/local/bin/)
#
# Followed by the executable token, then whitespace or end-of-string.
#
# IMPORTANT: for `npm run build` and `pnpm build` the token sequence spans two
# words. We match the full multi-word sequence from command position:
#   npm run build|start
#   pnpm build|start  (pnpm run build|start also accepted)
#   yarn build|start  (yarn run build|start also accepted)
#   next build|next start
#
# We do NOT match:
#   grep "next build" ...  — 'next' is an arg to grep (not in cmd-pos)
#   echo "npm run build"   — inside a quoted string argument
#   git commit -m "..."    — the pattern is inside a flag argument value
#   comment lines           — treated as a string argument to echo/printf
#
# DETECTION APPROACH:
#   Two separate matchers, one for each class of trigger:
#
#   PROD_TRIGGER — matches production build/serve invocations (blocking)
#   DEV_TRIGGER  — matches `next dev` or `npm run dev` (advisory)
#
# The anchor regex is anchored at command position. We use extended grep (-E).
# --------------------------------------------------------------------------

# Command-position anchor component (reused in both patterns):
#   (^|[;&|(])[[:space:]]*(([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]+[[:space:]]+)*)([^[:space:]]*/)?
# This is identical to the curl/wget anchor in mutating-action-hook.sh.
# Below we embed it directly in the full pattern for clarity.

# Production-trigger pattern components (each is a separate grep to keep patterns readable):
#   - `next build` or `next start`
#   - `npm run build` or `npm run start`
#   - `pnpm build` or `pnpm run build` or `pnpm start` or `pnpm run start`
#   - `yarn build` or `yarn run build` or `yarn start` or `yarn run start`

is_prod_trigger() {
  local cmd="$1"
  # Pattern 1: next build | next start  (command-position anchored)
  if printf '%s' "$cmd" | grep -qE '(^|[;&|(])[[:space:]]*(([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]+[[:space:]]+)*)([^[:space:]]*/)?next[[:space:]]+(build|start)([[:space:]]|$)' 2>/dev/null; then
    return 0
  fi
  # Pattern 2: npm run build | npm run start  (command-position anchored)
  if printf '%s' "$cmd" | grep -qE '(^|[;&|(])[[:space:]]*(([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]+[[:space:]]+)*)([^[:space:]]*/)?npm[[:space:]]+run[[:space:]]+(build|start)([[:space:]]|$)' 2>/dev/null; then
    return 0
  fi
  # Pattern 3: pnpm build | pnpm run build | pnpm start | pnpm run start  (command-position anchored)
  if printf '%s' "$cmd" | grep -qE '(^|[;&|(])[[:space:]]*(([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]+[[:space:]]+)*)([^[:space:]]*/)?pnpm[[:space:]]+(run[[:space:]]+)?(build|start)([[:space:]]|$)' 2>/dev/null; then
    return 0
  fi
  # Pattern 4: yarn build | yarn run build | yarn start | yarn run start  (command-position anchored)
  if printf '%s' "$cmd" | grep -qE '(^|[;&|(])[[:space:]]*(([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]+[[:space:]]+)*)([^[:space:]]*/)?yarn[[:space:]]+(run[[:space:]]+)?(build|start)([[:space:]]|$)' 2>/dev/null; then
    return 0
  fi
  return 1
}

# Dev-trigger pattern: next dev | npm run dev | pnpm dev | yarn dev
is_dev_trigger() {
  local cmd="$1"
  if printf '%s' "$cmd" | grep -qE '(^|[;&|(])[[:space:]]*(([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]+[[:space:]]+)*)([^[:space:]]*/)?next[[:space:]]+dev([[:space:]]|$)' 2>/dev/null; then
    return 0
  fi
  if printf '%s' "$cmd" | grep -qE '(^|[;&|(])[[:space:]]*(([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]+[[:space:]]+)*)([^[:space:]]*/)?npm[[:space:]]+run[[:space:]]+dev([[:space:]]|$)' 2>/dev/null; then
    return 0
  fi
  if printf '%s' "$cmd" | grep -qE '(^|[;&|(])[[:space:]]*(([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]+[[:space:]]+)*)([^[:space:]]*/)?pnpm[[:space:]]+(run[[:space:]]+)?dev([[:space:]]|$)' 2>/dev/null; then
    return 0
  fi
  if printf '%s' "$cmd" | grep -qE '(^|[;&|(])[[:space:]]*(([A-Za-z_][A-Za-z0-9_]*=[^[:space:]]+[[:space:]]+)*)([^[:space:]]*/)?yarn[[:space:]]+(run[[:space:]]+)?dev([[:space:]]|$)' 2>/dev/null; then
    return 0
  fi
  return 1
}

# --------------------------------------------------------------------------
# Check: is this a production build/serve command?
# --------------------------------------------------------------------------
if is_prod_trigger "$CMD"; then
  # Scan for live `next dev` processes
  # Pattern: process named "next dev" or "next-server" in dev mode
  # Excludes: grep itself (grep -v grep)
  DEV_PROCS=$(ps -eo pid,command 2>/dev/null | grep -E "next[[:space:]]+dev|next-server.*dev" | grep -v grep || true)

  if [[ -n "$DEV_PROCS" ]]; then
    # Extract PID list for the message
    PIDS=$(printf '%s\n' "$DEV_PROCS" | awk '{print $1}' | tr '\n' ' ' | sed 's/[[:space:]]*$//')
    echo "[dev-clobber-guard] BLOCKED: prod-build-while-dev-alive pids=$PIDS cmd=${CMD:0:80}" >> "$LOG" 2>/dev/null || true

    # Format the process lines for the block message
    PROC_LINES=$(printf '%s\n' "$DEV_PROCS" | head -5)

    block \
      "A live 'next dev' process is running — it will clobber .next (dev mode) and break production serve." \
      "Running dev process(es):
$(printf '%s\n' "$PROC_LINES" | sed 's/^/    /')

  PID(s): $PIDS
  Kill with: kill $PIDS"
  fi

  # No dev process — allow the production build
  echo "[dev-clobber-guard] allow: prod-trigger, no live dev process: ${CMD:0:80}" >> "$LOG" 2>/dev/null || true
  exit 0
fi

# --------------------------------------------------------------------------
# Advisory: is this a dev start command?
# --------------------------------------------------------------------------
if is_dev_trigger "$CMD"; then
  echo "[dev-clobber-guard] ADVISORY: dev start detected — remember to kill it before running production build" >> "$LOG" 2>/dev/null || true
  # Print advisory to stdout (Claude Code surfaces hook stdout)
  echo ""
  echo "ADVISORY [dev-clobber-guard G1]: 'next dev' started — remember to kill this process before"
  echo "  running 'next build' or 'next start'. A live dev server clobbers .next and breaks production serve."
  echo "  Kill with: kill <pid>  or  pkill -f 'next dev'"
  echo ""
  # Do NOT block — dev itself is allowed
  exit 0
fi

# Not a prod-trigger or dev-trigger — allow
exit 0
