#!/usr/bin/env bash
# .claude/hooks/beta-timeline-append.sh
# Stop hook — appends Beta's session timeline pending entry to TIMELINE.md.
#
# Protocol (proposed by Beta, 2026-05-25):
#   Beta writes a structured entry to .claude/beta/TIMELINE-PENDING.md during
#   the session. This hook picks it up at the next Stop boundary (per-turn in
#   Claude Code v2.1.x), appends it to TIMELINE.md, and deletes the pending file.
#
# Trigger: Stop hook (per-turn). Safe to re-run (idempotent — pending file is
#   deleted after a successful append, so subsequent Stop fires see nothing to do).
#
# Non-goals:
#   - Never reads or summarises conversation content.
#   - Never validates TIMELINE-PENDING.md format — appends as-is.
#   - Never modifies TIMELINE.md in any other way.
#   - Never touches ROOM.md, MOMENTS.md, LEDGER.md, or NOTES.md.
#   - Never gates on $CLAUDE_TASK_ID — companion sessions are not task sessions.
#
# On any failure: logs the reason and exits 0. Never blocks the turn.
#
# Owner: Canopus (α-HRN-07)
# Task: TASK-2026-05-25-BETA-TIMELINE-APPEND

set -uo pipefail
# NOTE: deliberately NOT using -e (errexit).
# This hook must never block the turn. Every path ends with exit 0.

# =============================================================================
# Anchor to repo root (hooks may run from any cwd).
# =============================================================================
_REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$_REPO_ROOT"

SESSIONS_DIR=".claude/sessions"
PENDING_FILE=".claude/beta/TIMELINE-PENDING.md"
TIMELINE_FILE=".claude/beta/TIMELINE-$(date +%Y-%m).md"
ACCESS_LOG=".claude/beta/ACCESS-LOG.md"
LOG_DIR=".claude/hook-logs"

TASK_ID="${CLAUDE_TASK_ID:-${WL_TASK_ID:-timeline-append-$(date +%s)}}"
TIMESTAMP="$(date -u +%FT%TZ)"
LOG="$LOG_DIR/${TASK_ID}--beta-timeline-append.log"

mkdir -p "$LOG_DIR"

printf '%s · [ENTRY] beta-timeline-append.sh started\n' "$TIMESTAMP" >> "$LOG" 2>/dev/null || true

# =============================================================================
# Error trap: log unexpected errors and exit 0 (never block).
# =============================================================================
_trap_error() {
  local line="${1:-?}"
  printf '%s · [ERROR] unexpected exit at line %s — hook bailed safely\n' \
    "$TIMESTAMP" "$line" >> "$LOG" 2>/dev/null || true
  exit 0
}
trap '_trap_error $LINENO' ERR

# =============================================================================
# Step 1 · Resolve session mode
# =============================================================================
SESSION_ID="${CLAUDE_SESSION_ID:-}"
META_FILE=""
SESSION_MODE=""

if [[ -n "$SESSION_ID" ]]; then
  META_FILE="$SESSIONS_DIR/${SESSION_ID}.meta.json"
  if [[ ! -f "$META_FILE" ]]; then
    # Canonical session ID provided but no meta file — not a tracked session.
    printf '%s · [MODE] session_id=%s meta not found — exit 0\n' \
      "$TIMESTAMP" "$SESSION_ID" >> "$LOG" 2>/dev/null || true
    exit 0
  fi
else
  # CLAUDE_SESSION_ID is empty — fall back to most-recent meta.json by mtime.
  META_FILE="$(ls -t "$SESSIONS_DIR"/*.meta.json 2>/dev/null | head -1 || true)"
  if [[ -z "$META_FILE" ]]; then
    printf '%s · [MODE] no session_id and no meta files found — exit 0\n' \
      "$TIMESTAMP" >> "$LOG" 2>/dev/null || true
    exit 0
  fi
  printf '%s · [MODE] CLAUDE_SESSION_ID empty — fallback to most-recent meta: %s\n' \
    "$TIMESTAMP" "$META_FILE" >> "$LOG" 2>/dev/null || true
fi

# Extract mode from meta file.
if command -v python3 >/dev/null 2>&1; then
  SESSION_MODE="$(python3 -c \
    'import json,sys; d=json.load(open(sys.argv[1])); print(d.get("mode",""))' \
    "$META_FILE" 2>/dev/null || true)"
elif command -v jq >/dev/null 2>&1; then
  SESSION_MODE="$(jq -r '.mode // ""' "$META_FILE" 2>/dev/null || true)"
fi

# Derive session_id for logging if we used the fallback path.
if [[ -z "$SESSION_ID" ]]; then
  if command -v python3 >/dev/null 2>&1; then
    SESSION_ID="$(python3 -c \
      'import json,sys; d=json.load(open(sys.argv[1])); print(d.get("session_id","unknown"))' \
      "$META_FILE" 2>/dev/null || true)"
  else
    SESSION_ID="$(basename "$META_FILE" .meta.json)"
  fi
fi

printf '%s · [MODE] session_id=%s mode=%s\n' "$TIMESTAMP" "$SESSION_ID" "${SESSION_MODE:-<empty>}" \
  >> "$LOG" 2>/dev/null || true

if [[ "$SESSION_MODE" != "beta" ]]; then
  printf '%s · [MODE] mode=%s — not beta, exit 0\n' "$TIMESTAMP" "${SESSION_MODE:-<empty>}" \
    >> "$LOG" 2>/dev/null || true
  exit 0
fi

# =============================================================================
# Step 2 · Check for pending entry
# =============================================================================
if [[ ! -f "$PENDING_FILE" ]]; then
  printf '%s · [PENDING] no pending file — exit 0\n' "$TIMESTAMP" >> "$LOG" 2>/dev/null || true
  exit 0
fi

PENDING_SIZE="$(wc -c < "$PENDING_FILE" 2>/dev/null || echo "0")"
PENDING_SIZE="${PENDING_SIZE// /}"  # trim whitespace from wc output

if [[ "$PENDING_SIZE" -eq 0 ]]; then
  printf '%s · [PENDING] pending file is empty — deleting and exit 0\n' \
    "$TIMESTAMP" >> "$LOG" 2>/dev/null || true
  rm -f "$PENDING_FILE" || true
  exit 0
fi

printf '%s · [PENDING] pending file found — size=%s bytes\n' \
  "$TIMESTAMP" "$PENDING_SIZE" >> "$LOG" 2>/dev/null || true

# =============================================================================
# Step 3 · Append to TIMELINE.md (with blank-line separator)
# =============================================================================
if [[ ! -f "$TIMELINE_FILE" ]]; then
  # Bootstrap: create TIMELINE.md if it doesn't exist yet.
  printf '%s · [APPEND] TIMELINE.md absent — creating fresh\n' \
    "$TIMESTAMP" >> "$LOG" 2>/dev/null || true
  touch "$TIMELINE_FILE"
fi

# Ensure TIMELINE.md ends with a newline before we append, then add one blank
# line as separator between existing content and the new block.
if [[ -s "$TIMELINE_FILE" ]]; then
  # File has content — ensure trailing newline then add blank separator.
  LAST_CHAR="$(tail -c 1 "$TIMELINE_FILE" 2>/dev/null | wc -c || echo 0)"
  LAST_CHAR="${LAST_CHAR// /}"
  if [[ "$LAST_CHAR" -ne 0 ]]; then
    # File doesn't end with newline — add one before the separator.
    printf '\n' >> "$TIMELINE_FILE"
  fi
  # Blank separator line.
  printf '\n' >> "$TIMELINE_FILE"
fi

# Append full pending content.
if ! cat "$PENDING_FILE" >> "$TIMELINE_FILE"; then
  printf '%s · [APPEND] FAILED to append to %s — exit 0\n' \
    "$TIMESTAMP" "$TIMELINE_FILE" >> "$LOG" 2>/dev/null || true
  printf '%s · timeline-append · APPEND-FAIL · %s · session=%s · FAIL\n' \
    "$TIMESTAMP" "$TIMELINE_FILE" "$SESSION_ID" >> "$ACCESS_LOG" 2>/dev/null || true
  exit 0
fi

printf '%s · [APPEND] appended %s bytes to %s\n' \
  "$TIMESTAMP" "$PENDING_SIZE" "$TIMELINE_FILE" >> "$LOG" 2>/dev/null || true

# =============================================================================
# Step 4 · Delete pending file
# =============================================================================
if ! rm -f "$PENDING_FILE"; then
  printf '%s · [CLEANUP] WARN: could not delete %s — continuing\n' \
    "$TIMESTAMP" "$PENDING_FILE" >> "$LOG" 2>/dev/null || true
fi

printf '%s · [CLEANUP] deleted %s\n' "$TIMESTAMP" "$PENDING_FILE" >> "$LOG" 2>/dev/null || true

# =============================================================================
# Step 5 · Log to ACCESS-LOG.md
# =============================================================================
ACCESS_ENTRY="$(printf '%s · timeline-append · APPEND · %s · session=%s · OK\n' \
  "$TIMESTAMP" "$TIMELINE_FILE" "$SESSION_ID")"

printf '%s\n' "$ACCESS_ENTRY" >> "$ACCESS_LOG" 2>/dev/null || \
  printf '%s · [ACCESS-LOG] WARN: could not write to %s\n' \
    "$TIMESTAMP" "$ACCESS_LOG" >> "$LOG" 2>/dev/null || true

printf '%s · [DONE] timeline append complete · session=%s\n' \
  "$TIMESTAMP" "$SESSION_ID" >> "$LOG" 2>/dev/null || true

exit 0
