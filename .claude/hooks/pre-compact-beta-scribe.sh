#!/usr/bin/env bash
# .claude/hooks/pre-compact-beta-scribe.sh
# PreCompact hook — fires before conversation compaction.
# Invokes beta-scribe-runner.sh when SESSION_MODE=beta.
#
# Design decisions (from TASK-2026-05-24-HOOK-BETA-SCRIBE design memo):
#
#   Q1 — Hook synchronicity: Claude Code's PreCompact hook IS synchronous.
#        The compaction process waits for hook completion before proceeding.
#        Source: Claude Code v2.1.x JS bundle, "Runs before conversation compaction"
#        description maps to a blocking hook event in the same category as
#        PreToolUse (confirmed by hook event list structure in the bundle).
#        Implication: scribe MUST complete within the hook timeout (30s budget).
#        We set a 25-second inner timeout on the scribe runner, leaving 5s buffer.
#
#   Q3 — Stop hook / session-end detection: NOT implemented here.
#        See TASK-2026-05-24-HOOK-BETA-SCRIBE--to-polaris.md §C3 decision.
#        PreCompact covers the higher-value case.
#
# Fail-closed behavior:
#   - If SESSION_MODE != beta → exit 0 (no-op, do not invoke scribe)
#   - If scribe fails → log failure, exit 0 (compaction proceeds — do not block Peat)
#   - If timeout → log timeout, exit 0 (compaction proceeds)
#
# Gate: SESSION_MODE=beta is required. The mode is read from:
#   1. CLAUDE_SESSION_MODE env var (set by persona-tracker.sh in some configs)
#   2. .claude/sessions/<session-id>.meta.json (written by session-start.sh)
#   3. .claude/.current-persona JSON (written by persona-tracker.sh)
#
# Idempotent: runs the scribe; scribe handles idempotency internally.
#
# Logs to: .claude/hook-logs/<session-id>--pre-compact-scribe.log
#
# Called by: .claude/settings.json PreCompact hook block.
# Do not call directly in normal operation.

set -uo pipefail

# =============================================================================
# Repo root guard
# =============================================================================
_REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$_REPO_ROOT"

TIMESTAMP="$(date -u +%FT%TZ)"

# =============================================================================
# Parse hook event JSON from stdin (PreCompact sends JSON on stdin)
# Claude Code sends the same session_id we've seen on other hook events.
# =============================================================================
HOOK_INPUT=""
if [[ ! -t 0 ]]; then
  HOOK_INPUT="$(cat 2>/dev/null || true)"
fi

# Extract session_id from hook event JSON
SESSION_ID=""
if [[ -n "$HOOK_INPUT" ]] && command -v python3 >/dev/null 2>&1; then
  SESSION_ID="$(printf '%s' "$HOOK_INPUT" | python3 -c \
    'import json,sys; d=json.load(sys.stdin); print(d.get("session_id",""))' 2>/dev/null || true)"
fi
if [[ -z "$SESSION_ID" ]] && command -v jq >/dev/null 2>&1 && [[ -n "$HOOK_INPUT" ]]; then
  SESSION_ID="$(printf '%s' "$HOOK_INPUT" | jq -r '.session_id // ""' 2>/dev/null || true)"
fi
SESSION_ID="${SESSION_ID:-${CLAUDE_SESSION_ID:-session-$(date +%s)-$$}}"

LOG_DIR=".claude/hook-logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/${SESSION_ID}--pre-compact-scribe.log"

log() {
  local level="$1"
  shift
  printf '%s · [%s] pre-compact-beta-scribe · %s\n' "$TIMESTAMP" "$level" "$*" >> "$LOG" 2>/dev/null || true
}

log "ENTRY" "hook fired · session=$SESSION_ID"

# =============================================================================
# SESSION_MODE detection
# Priority: CLAUDE_SESSION_MODE env → session meta file → .current-persona
# =============================================================================
SESSION_MODE=""

# 1. Env var (fastest — set by Claude Code when available)
if [[ -n "${CLAUDE_SESSION_MODE:-}" ]]; then
  SESSION_MODE="$CLAUDE_SESSION_MODE"
  log "MODE-SRC" "env: CLAUDE_SESSION_MODE=$SESSION_MODE"
fi

# 2. Session meta file
if [[ -z "$SESSION_MODE" ]]; then
  META_FILE=".claude/sessions/${SESSION_ID}.meta.json"
  if [[ -f "$META_FILE" ]] && command -v python3 >/dev/null 2>&1; then
    SESSION_MODE="$(python3 -c \
      'import json,sys; d=json.load(open(sys.argv[1])); print(d.get("mode",""))' \
      "$META_FILE" 2>/dev/null || true)"
    [[ -n "$SESSION_MODE" ]] && log "MODE-SRC" "meta file: $META_FILE → mode=$SESSION_MODE"
  fi
  if [[ -z "$SESSION_MODE" ]] && command -v jq >/dev/null 2>&1 && [[ -f "$META_FILE" ]]; then
    SESSION_MODE="$(jq -r '.mode // ""' "$META_FILE" 2>/dev/null || true)"
    [[ -n "$SESSION_MODE" ]] && log "MODE-SRC" "meta file (jq): $META_FILE → mode=$SESSION_MODE"
  fi
fi

# 3. .current-persona file
if [[ -z "$SESSION_MODE" ]]; then
  PERSONA_FILE=".claude/.current-persona"
  if [[ -f "$PERSONA_FILE" ]] && command -v python3 >/dev/null 2>&1; then
    SESSION_MODE="$(python3 -c \
      'import json,sys; d=json.load(open(sys.argv[1])); print(d.get("session_mode",""))' \
      "$PERSONA_FILE" 2>/dev/null || true)"
    [[ -n "$SESSION_MODE" ]] && log "MODE-SRC" ".current-persona → session_mode=$SESSION_MODE"
  fi
fi

SESSION_MODE="${SESSION_MODE:-genesis}"
log "MODE" "resolved session_mode=$SESSION_MODE"

# =============================================================================
# Gate: only proceed if SESSION_MODE=beta
# =============================================================================
if [[ "$SESSION_MODE" != "beta" ]]; then
  log "SKIP" "SESSION_MODE=$SESSION_MODE — scribe not invoked (beta sessions only)"
  exit 0
fi

log "PROCEED" "SESSION_MODE=beta — invoking scribe"

# =============================================================================
# Prepare context file for scribe
# Includes: last N lines of recent session context + current ROOM.md state
# =============================================================================
TMP_DIR_CONTEXT="$(mktemp -d 2>/dev/null || mktemp -d -t 'pre-compact-scribe')"
trap 'rm -rf "$TMP_DIR_CONTEXT"' EXIT

CONTEXT_FILE="$TMP_DIR_CONTEXT/scribe-context.txt"

{
  printf '=== SCRIBE CONTEXT · trigger=pre-compact · session=%s · %s ===\n\n' "$SESSION_ID" "$TIMESTAMP"

  # Current ROOM.md state (last calibration block)
  if [[ -f ".claude/beta/ROOM.md" ]]; then
    printf '--- ROOM.md (last 20 lines) ---\n'
    tail -20 ".claude/beta/ROOM.md" 2>/dev/null || true
    printf '\n'
  fi

  # Current MOMENTS.md (last 5 entries)
  if [[ -f ".claude/beta/MOMENTS.md" ]]; then
    printf '--- MOMENTS.md (last 5 entries) ---\n'
    grep -E '^- day' ".claude/beta/MOMENTS.md" 2>/dev/null | tail -5 || true
    printf '\n'
  fi

  # Hook input (may contain transcript fragment in some Claude Code versions)
  if [[ -n "$HOOK_INPUT" ]]; then
    printf '--- hook event JSON ---\n'
    printf '%s\n' "$HOOK_INPUT" | head -c 2000  # truncate for safety
    printf '\n'
  fi
} > "$CONTEXT_FILE" 2>/dev/null || true

log "CONTEXT" "prepared context file: $CONTEXT_FILE ($(wc -c < "$CONTEXT_FILE" | tr -d ' ') bytes)"

# =============================================================================
# Invoke scribe runner with timeout
# Timeout: 25 seconds (leaves 5s buffer before Claude Code's 30s hook budget)
# Fail-closed: if scribe fails or times out, log and exit 0 (do not block compaction)
# =============================================================================
SCRIBE_RUNNER=".claude/hooks/beta-scribe-runner.sh"

if [[ ! -x "$SCRIBE_RUNNER" ]]; then
  log "ERROR" "scribe runner not found or not executable: $SCRIBE_RUNNER"
  log "FAIL-CLOSED" "compaction proceeds without scribe"
  exit 0
fi

SCRIBE_LOG="$LOG_DIR/${SESSION_ID}--scribe-runner.log"
SCRIBE_EXIT=0

export SCRIBE_SESSION_ID="$SESSION_ID"
export SCRIBE_TASK_ID="TASK-2026-05-24-HOOK-BETA-SCRIBE"
export SCRIBE_TRIGGER="pre-compact"
export SCRIBE_CONTEXT_FILE="$CONTEXT_FILE"
export SCRIBE_LOG_FILE="$SCRIBE_LOG"

log "INVOKE" "running $SCRIBE_RUNNER (timeout=25s)"

# Use timeout command if available; fall back to background process with manual kill
if command -v timeout >/dev/null 2>&1; then
  timeout 25 bash "$SCRIBE_RUNNER" >> "$LOG" 2>&1 || SCRIBE_EXIT=$?
else
  # Fallback: run in background with manual 25-second kill
  bash "$SCRIBE_RUNNER" >> "$LOG" 2>&1 &
  SCRIBE_PID=$!
  WAITED=0
  while [[ $WAITED -lt 25 ]]; do
    if ! kill -0 "$SCRIBE_PID" 2>/dev/null; then
      wait "$SCRIBE_PID"
      SCRIBE_EXIT=$?
      break
    fi
    sleep 1
    WAITED=$(( WAITED + 1 ))
  done
  # If still running after 25s, kill it
  if kill -0 "$SCRIBE_PID" 2>/dev/null; then
    kill "$SCRIBE_PID" 2>/dev/null || true
    wait "$SCRIBE_PID" 2>/dev/null || true
    SCRIBE_EXIT=124  # timeout convention
    log "TIMEOUT" "scribe runner killed after 25s — fail-closed, compaction proceeds"
  fi
fi

# =============================================================================
# Handle scribe exit code
# =============================================================================
case "$SCRIBE_EXIT" in
  0)
    log "SUCCESS" "scribe runner completed successfully (exit 0)"
    ;;
  1)
    log "WARN" "scribe runner reported partial/total write failure (exit 1) — compaction proceeds"
    ;;
  2)
    log "WARN" "scribe runner denied by grant check (exit 2) — compaction proceeds"
    ;;
  3)
    log "ERROR" "scribe runner bad invocation (exit 3) — check env vars"
    ;;
  124)
    log "TIMEOUT" "scribe runner timed out (25s) — fail-closed"
    ;;
  *)
    log "WARN" "scribe runner unexpected exit code $SCRIBE_EXIT — fail-closed, compaction proceeds"
    ;;
esac

# =============================================================================
# Fail-closed: ALWAYS exit 0 from the PreCompact hook.
# Compaction must proceed even if the scribe encountered errors.
# A scribe failure must never block Peat's session.
# =============================================================================
log "EXIT" "exiting 0 (fail-closed — compaction proceeds regardless of scribe result)"
exit 0
