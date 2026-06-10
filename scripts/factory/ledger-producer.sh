#!/usr/bin/env bash
# scripts/factory/ledger-producer.sh
# Phase 0 slice 0.3 — FACTORY-COLLECTOR ndjson producer
# Owner: Canopus · α-HRN-07
# Task: TASK-2026-06-10-FACTORY-LEDGER-PRODUCER
#
# ─────────────────────────────────────────────────────────────────────────────
# INTEGRITY DISCLAIMER (read before editing)
# ─────────────────────────────────────────────────────────────────────────────
# This stream is collector-input, NOT an integrity-anchored ledger.
# Forge-resistance lives in the witness-ref design (see .harness/WITNESS-REF-DESIGN.md),
# which is out of scope for this producer. WL_INTEGRITY_WIRED is intentionally
# NOT set here and MUST NOT be set here. The collector reads this stream;
# completeness assertions live in the collector, not in this producer.
#
# ─────────────────────────────────────────────────────────────────────────────
# OBSERVER POSTURE
# ─────────────────────────────────────────────────────────────────────────────
# This script always exits 0. It is an observer, not a guard. Any failure in a
# sub-command is logged and swallowed. A logging producer that blocks work
# would itself become a reliability failure. Fail-closed enforcement belongs
# in the consumer/collector (Phase 1).
#
# ─────────────────────────────────────────────────────────────────────────────
# PURPOSE
# ─────────────────────────────────────────────────────────────────────────────
# Appends one ndjson line per FACTORY-COLLECTOR event to
# .harness/audit/<stream>.ndjson. Used by the Phase-1 collector
# (collect.mjs / summarizeTickets()) to reconstruct task activity.
#
# Output stream: .harness/audit/factory-events.ndjson
#
# APPEND-ONLY CONTRACT: this script uses >> exclusively; it never truncates
# and never rewrites a prior line. This is load-bearing — see verification
# test T2 in the spec.
#
# ─────────────────────────────────────────────────────────────────────────────
# NDJSON SCHEMA (conservative superset — Phase-1 collector may narrow)
# ─────────────────────────────────────────────────────────────────────────────
# Each line is a valid JSON object with fixed field order. Required fields:
#
#   ts          string  ISO-8601 UTC timestamp (date -u +%FT%TZ)
#   task_id     string  $WL_TASK_ID || $CLAUDE_TASK_ID || "" (empty if unset)
#   agent       string  $WL_AGENT || "unknown"
#   event       string  caller-supplied event type (e.g. "signed-work", "task-start",
#                       "task-stop", "hook-called")
#
# Optional fields (included when non-empty; collector treats absent as null):
#
#   path        string  file path the event concerns (repo-relative or absolute)
#   sha256      string  SHA-256 hex digest of the file at event time
#
# Future Phase-1 additions (reserved, do not collide):
#   session_id, parent_task_id, exit_code, duration_ms
#
# Collector contract pointer: the summarizeTickets() function in collect.mjs
# reads `task_id`, `agent`, `event`, and `ts` as primary grouping keys. `path`
# and `sha256` are supporting evidence fields. If the collector schema pins a
# stricter subset, this producer's conservative superset remains forward-
# compatible — extra fields are inert to a reader that ignores unknowns.
#
# ─────────────────────────────────────────────────────────────────────────────
# USAGE
# ─────────────────────────────────────────────────────────────────────────────
# Called by a PostToolUse or Stop hook (wiring in settings.json — NOT done in
# this slice; see docs/harness/RAIL-DEFINITIONS.md §factory-collector-producer
# for the proposed hook placement and settings_wiring slice).
#
# Direct invocation (manual or test):
#
#   WL_TASK_ID=TASK-2026-06-10-X WL_AGENT=canopus \
#     bash scripts/factory/ledger-producer.sh signed-work .claude/signatures/X.json
#
# Arguments:
#   $1  event   required — event type string (e.g. "signed-work", "task-stop")
#   $2  path    optional — file path the event concerns
#
# Environment:
#   WL_TASK_ID        task identifier (fallback: $CLAUDE_TASK_ID, then "")
#   WL_AGENT          agent codename (fallback: "unknown")
#   CLAUDE_PROJECT_DIR  repo root (fallback: heuristic from script location)
#   WL_AUDIT_STREAM   override output stream filename (default: factory-events.ndjson)
#   WL_AUDIT_DIR      override audit dir path (default: $REPO_DIR/.harness/audit)
#
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail
# Note: -e intentionally omitted. Observer posture: sub-command failures must
# not propagate as fatal exits. All errors are logged and swallowed.

# ── Anchor to repo root ────────────────────────────────────────────────────
# Three resolution paths, in order:
#   1. CLAUDE_PROJECT_DIR (set in Claude Code hook environments)
#   2. Script-relative: two dirs up from scripts/factory/
#   3. pwd (last resort)
_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd 2>/dev/null)" || _SCRIPT_DIR=""
REPO_DIR="${CLAUDE_PROJECT_DIR:-${_SCRIPT_DIR:+$(cd "$_SCRIPT_DIR/../.." && pwd 2>/dev/null)}}"
REPO_DIR="${REPO_DIR:-$(pwd)}"

# ── Runtime identity ───────────────────────────────────────────────────────
TS="$(date -u +%FT%TZ 2>/dev/null)" || TS="1970-01-01T00:00:00Z"
TASK_ID="${WL_TASK_ID:-${CLAUDE_TASK_ID:-}}"
AGENT="${WL_AGENT:-unknown}"

# ── Paths ──────────────────────────────────────────────────────────────────
AUDIT_DIR="${WL_AUDIT_DIR:-$REPO_DIR/.harness/audit}"
STREAM_FILE="$AUDIT_DIR/${WL_AUDIT_STREAM:-factory-events.ndjson}"

LOG_DIR="$REPO_DIR/.claude/hook-logs"

# ── Arguments ─────────────────────────────────────────────────────────────
EVENT="${1:-hook-called}"
EVENT_PATH="${2:-}"

# ── Log helper ────────────────────────────────────────────────────────────
_log() {
  # Writes to hook-log file if log dir exists; silently skips on failure.
  # Always exits 0 (observer).
  local msg="$1"
  local log_file
  if [[ -d "$LOG_DIR" ]] || mkdir -p "$LOG_DIR" 2>/dev/null; then
    log_file="$LOG_DIR/${TASK_ID:+${TASK_ID}--}ledger-producer.log"
    printf '[ledger-producer] %s · %s\n' "$TS" "$msg" >> "$log_file" 2>/dev/null || true
  fi
}

# ── Ensure .harness/audit/ exists ─────────────────────────────────────────
# mkdir -p is idempotent; failure is non-fatal (observer).
if ! mkdir -p "$AUDIT_DIR" 2>/dev/null; then
  _log "WARN — could not create audit dir: $AUDIT_DIR"
  exit 0
fi

# ── SHA-256 of path (optional field) ──────────────────────────────────────
# Computed only if EVENT_PATH is set and the file exists.
# Identical computation to integrity-write-ledger.sh (sha256sum + awk).
_path_sha256() {
  local p="$1"
  # Resolve to absolute if relative
  local abs_p
  if [[ "$p" == /* ]]; then
    abs_p="$p"
  else
    abs_p="$REPO_DIR/$p"
  fi
  if [[ -f "$abs_p" ]]; then
    sha256sum "$abs_p" 2>/dev/null | awk '{print $1}' || true
  fi
}

# ── Build ndjson line ──────────────────────────────────────────────────────
# Field order is fixed: ts, task_id, agent, event, [path, sha256].
# jq -cn builds compact JSON from --arg values — safe for any string content.
# Optional fields are included only when non-empty; the collector's
# fromjson?/has() checks treat absent fields as null (forward-compatible).

_build_line() {
  local sha256_val=""
  if [[ -n "$EVENT_PATH" ]]; then
    sha256_val="$(_path_sha256 "$EVENT_PATH")"
  fi

  if [[ -n "$EVENT_PATH" ]] && [[ -n "$sha256_val" ]]; then
    # Full line: all fields
    jq -cn \
      --arg ts       "$TS" \
      --arg task_id  "$TASK_ID" \
      --arg agent    "$AGENT" \
      --arg event    "$EVENT" \
      --arg path     "$EVENT_PATH" \
      --arg sha256   "$sha256_val" \
      '{"ts":$ts,"task_id":$task_id,"agent":$agent,"event":$event,"path":$path,"sha256":$sha256}' \
      2>/dev/null
  elif [[ -n "$EVENT_PATH" ]]; then
    # path present but sha256 unavailable (file does not exist or sha256sum failed)
    jq -cn \
      --arg ts       "$TS" \
      --arg task_id  "$TASK_ID" \
      --arg agent    "$AGENT" \
      --arg event    "$EVENT" \
      --arg path     "$EVENT_PATH" \
      '{"ts":$ts,"task_id":$task_id,"agent":$agent,"event":$event,"path":$path}' \
      2>/dev/null
  else
    # Minimal line: no path/sha256
    jq -cn \
      --arg ts       "$TS" \
      --arg task_id  "$TASK_ID" \
      --arg agent    "$AGENT" \
      --arg event    "$EVENT" \
      '{"ts":$ts,"task_id":$task_id,"agent":$agent,"event":$event}' \
      2>/dev/null
  fi
}

# ── Append-only write ──────────────────────────────────────────────────────
# >> ONLY: never truncate, never rewrite a prior line.
# This property is load-bearing (see adversary test T2).
LINE="$(_build_line)" || {
  _log "WARN — jq line construction failed (event=$EVENT)"
  exit 0
}

if [[ -z "$LINE" ]]; then
  _log "WARN — empty line (jq returned nothing) for event=$EVENT"
  exit 0
fi

if printf '%s\n' "$LINE" >> "$STREAM_FILE" 2>/dev/null; then
  _log "APPENDED event=$EVENT task_id=${TASK_ID:-<unset>} agent=$AGENT stream=$(basename "$STREAM_FILE")"
else
  _log "WARN — append failed for stream=$STREAM_FILE (event=$EVENT) — check dir permissions"
fi

# ── Observer posture: always exit 0 ───────────────────────────────────────
exit 0
