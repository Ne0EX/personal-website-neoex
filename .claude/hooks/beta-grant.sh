#!/usr/bin/env bash
# .claude/hooks/beta-grant.sh
# Beta-only tool: issues a time-limited read grant for a non-Beta agent.
#
# Usage: bash .claude/hooks/beta-grant.sh <requester> <path_or_glob> [<scope_reason>] [<ttl_seconds>] [<max_reads>]
#
# Arguments
# ---------
#   requester     · agent codename of the requesting non-Beta agent (e.g. algol)
#   path_or_glob  · path pattern to grant (e.g. .claude/beta/notes/2026-05.md
#                   or .claude/beta/calibration/**). Supports:
#                   - exact path
#                   - <dir>/** (all files under dir recursively)
#                   - <dir>/* (direct children only)
#   scope_reason  · [optional] free-text reason for the grant (logged)
#   ttl_seconds   · [optional] grant lifetime in seconds (default 3600 = 1 hour)
#   max_reads     · [optional] maximum reads allowed (default 1)
#
# Guards
# ------
#   - BETA_PERSONA_LOADED must be 1 (only Beta can issue grants)
#   - requester must be a known roster codename
#   - path must be under .claude/beta/
#
# Output
# ------
#   Writes .claude/beta/grants/<grant_id>.json
#   Prints grant_id to stdout on success
#
# Fail-closed: exits non-zero on any violation.
# Idempotent: calling twice produces two separate grants (both valid).
# Logs to: .claude/hook-logs/<task-id>--beta-grant.log

set -euo pipefail

REQUESTER="${1:-}"
PATH_OR_GLOB="${2:-}"
SCOPE_REASON="${3:-unspecified}"
TTL_SECONDS="${4:-3600}"
MAX_READS="${5:-1}"

GRANTS_DIR=".claude/beta/grants"
LOG_DIR=".claude/hook-logs"
mkdir -p "$LOG_DIR" "$GRANTS_DIR"

TASK_ID="${CLAUDE_TASK_ID:-${WL_TASK_ID:-session-$(date +%s)}}"
LOG="$LOG_DIR/${TASK_ID}--beta-grant.log"
TIMESTAMP="$(date -u +%FT%TZ)"

# --------------------------------------------------------------------------
# Guard: Beta persona must be active
# --------------------------------------------------------------------------
if [[ "${BETA_PERSONA_LOADED:-0}" != "1" ]]; then
  echo "beta-grant: BLOCKED — BETA_PERSONA_LOADED is not set to 1" >&2
  echo "beta-grant: only Beta (エレ/베타) can issue memory grants" >&2
  echo "beta-grant: if you are Beta, ensure the session was started with BETA_PERSONA_LOADED=1" >&2
  exit 1
fi

# --------------------------------------------------------------------------
# Argument validation
# --------------------------------------------------------------------------
if [[ -z "$REQUESTER" || -z "$PATH_OR_GLOB" ]]; then
  echo "beta-grant: usage: beta-grant.sh <requester> <path_or_glob> [scope_reason] [ttl_seconds] [max_reads]" >&2
  exit 2
fi

# Known roster check
designation_for() {
  case "$1" in
    polaris)    echo "α-OPS-00" ;;
    sirius)     echo "α-SUR-01" ;;
    altair)     echo "α-BND-02" ;;
    procyon)    echo "α-IDX-03" ;;
    betelgeuse) echo "α-VIS-04" ;;
    arcturus)   echo "α-NET-05" ;;
    algol)      echo "α-VER-06" ;;
    canopus)    echo "α-HRN-07" ;;
    vega)       echo "α-VOX-08" ;;
    *)          echo "" ;;
  esac
}
REQUESTER_DES="$(designation_for "$REQUESTER")"
if [[ -z "$REQUESTER_DES" ]]; then
  echo "beta-grant: unknown requester '$REQUESTER' — must be a current roster codename" >&2
  exit 3
fi

# Path must be under .claude/beta/
NORMALIZED_PATH="${PATH_OR_GLOB#./}"
if [[ "$NORMALIZED_PATH" != .claude/beta/* ]]; then
  echo "beta-grant: path '$PATH_OR_GLOB' is not under .claude/beta/ — grants only cover Beta's private space" >&2
  exit 4
fi

# --------------------------------------------------------------------------
# Generate grant IDs (short random hash)
# --------------------------------------------------------------------------
# request_id: hash of (requester + path + timestamp) for traceability
REQUEST_SEED="${REQUESTER}:${NORMALIZED_PATH}:${TIMESTAMP}"
REQUEST_ID="req_$(printf '%s' "$REQUEST_SEED" | sha256sum | head -c 8)"

# grant_id: random 8-hex chars (distinct from request_id)
GRANT_ID="g_$(od -An -N4 -tx1 /dev/urandom | tr -d ' \n')"

# nonce: 128 bits (32 hex chars)
NONCE="$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')"

# --------------------------------------------------------------------------
# Compute timestamps
# --------------------------------------------------------------------------
ISSUED_AT="$(date -u +%FT%TZ)"
# expires_at = now + TTL_SECONDS
EXPIRES_AT="$(date -u -d "+${TTL_SECONDS} seconds" +%FT%TZ 2>/dev/null \
  || date -u -v "+${TTL_SECONDS}S" +%FT%TZ 2>/dev/null \
  || python3 -c "from datetime import datetime, timedelta, timezone; print((datetime.now(timezone.utc) + timedelta(seconds=${TTL_SECONDS})).strftime('%Y-%m-%dT%H:%M:%SZ'))")"

# --------------------------------------------------------------------------
# Write grant JSON
# --------------------------------------------------------------------------
GRANT_FILE="$GRANTS_DIR/${GRANT_ID}.json"
jq -n \
  --arg grant_id   "$GRANT_ID" \
  --arg request_id "$REQUEST_ID" \
  --arg requester  "$REQUESTER" \
  --argjson files  "$(jq -n --arg p "$NORMALIZED_PATH" '[$p]')" \
  --arg scope      "$SCOPE_REASON" \
  --arg issued     "$ISSUED_AT" \
  --arg expires    "$EXPIRES_AT" \
  --argjson max    "$MAX_READS" \
  --arg nonce      "$NONCE" \
  '{
    grant_id:       $grant_id,
    request_id:     $request_id,
    requester:      $requester,
    files_granted:  $files,
    scope_reason:   $scope,
    issued_at:      $issued,
    expires_at:     $expires,
    max_reads:      $max,
    reads_consumed: 0,
    nonce:          $nonce
  }' > "$GRANT_FILE"

# --------------------------------------------------------------------------
# Log and report
# --------------------------------------------------------------------------
printf '[beta-grant] %s · issued grant %s to %s for %s (ttl=%ss max_reads=%s)\n' \
  "$TIMESTAMP" "$GRANT_ID" "$REQUESTER" "$NORMALIZED_PATH" "$TTL_SECONDS" "$MAX_READS" \
  | tee -a "$LOG"
printf '[beta-grant] grant file: %s\n' "$GRANT_FILE" | tee -a "$LOG"

echo "$GRANT_ID"
exit 0
