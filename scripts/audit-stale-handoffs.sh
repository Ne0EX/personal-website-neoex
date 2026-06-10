#!/usr/bin/env bash
# scripts/audit-stale-handoffs.sh
# Owner: Canopus (α-HRN-07)
# Task: Phase 0 slice 0.5 · Stale-handoff detection audit
#
# PURPOSE
# -------
# A signature whose `next_recipient.agent` names an agent that never picked up
# the handoff (no corresponding downstream signature / no handoff file consumed)
# is a stale/dropped baton — flag it as STALE.
#
# CURRENT POSTURE: WARN-MODE (exit 0 even when findings exist).
# See FLIP-TO-FAIL CONDITION below.
#
# FLIP-TO-FAIL CONDITION
# ----------------------
# promote to exit 1 (BLOCK) once:
#   (a) the producer ledger is seeded and pickup can be determined authoritatively, and
#   (b) a baseline pass confirms zero legitimate-but-unmatched batons;
# until then exit 0 with report.
# To promote: change `WARN_MODE=1` to `WARN_MODE=0` below. That single flag makes
# every STALE and UNKNOWN_RECIPIENT finding exit 1.
#
# WHAT "PICKUP" MEANS
# -------------------
# Agent R is considered to have picked up a baton from signature S (task_id=T) when
# ANY of the following is true:
#   (a) A signature file <T>--<r_lowercase>.json exists in .claude/signatures/
#   (b) Any signature file with .task_id==T and .agent (string) == R exists
# Polaris-as-next is treated as NON-STALE by assumption (see POLARIS ASSUMPTION).
# This assumption is documented here and in RAIL-DEFINITIONS.md.
#
# POLARIS ASSUMPTION
# ------------------
# When next_recipient.agent is "Polaris", the baton is treated as non-stale even
# without a downstream Polaris signature for the same task_id. The rationale: Polaris
# is the default terminal recipient — a handoff back to Polaris that Polaris closes
# is normal workflow. Polaris may close the loop via prose or STATUS.md rather than
# a new signature for the same task. This assumption is conserved until the producer
# ledger is seeded with Polaris closure evidence, at which point it can be removed.
#
# EXIT CODES
# ----------
#   0 — WARN-MODE: findings reported (may include STALEs/UNKNOWNs) but exit 0
#   0 — WARN-MODE: no findings
#   2 — internal error: missing dependency, or unrecoverable failure
#   NOTE: once WARN_MODE=0, STALE or UNKNOWN_RECIPIENT findings exit 1.
#
# SCOPE GUARDS (binding)
#   - .claude/beta/** is NEVER read, scanned, or touched
#   - POLICY-NO-INPLACE-MUTATION: this script only reads
#   - No curl/wget/rm; no destructive commands
#
# STANDALONE RUN
#   bash scripts/audit-stale-handoffs.sh
#   CLAUDE_PROJECT_DIR=/tmp/sandbox bash scripts/audit-stale-handoffs.sh
#   WL_SIGNATURES_DIR=/tmp/sigs bash scripts/audit-stale-handoffs.sh
#
# LOGS TO
#   .claude/hook-logs/<task_id>--audit-stale-handoffs.log
#
# NOT WIRED via settings.json — standalone rail.
# Rail entry proposal for Peat:
#   Add to .harness/worldline-harness.config.json:
#     "stale-handoffs": {
#       "description": "signature next_recipient baton was never picked up — dropped handoff",
#       "check": "scripts/audit-stale-handoffs.sh",
#       "applies_to": [".claude/signatures/**"]
#     }
#   Wire once FLIP-TO-FAIL conditions (a) and (b) are met.

set -uo pipefail

# ---------------------------------------------------------------------------
# WARN_MODE: 1 = exit 0 even on findings (current posture); 0 = exit 1 on findings
# ---------------------------------------------------------------------------
WARN_MODE=1

# ---------------------------------------------------------------------------
# Dependencies check (fail-closed)
# ---------------------------------------------------------------------------
for dep in jq find grep; do
  if ! command -v "$dep" >/dev/null 2>&1; then
    printf 'ERROR [audit-stale-handoffs] missing dependency: %s\n' "$dep" >&2
    exit 2
  fi
done

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
REPO_DIR="${CLAUDE_PROJECT_DIR:-/Users/neospiritth/codingspace/personal_website}"
SIGS_DIR="${WL_SIGNATURES_DIR:-$REPO_DIR/.claude/signatures}"

LOG_DIR="$REPO_DIR/.claude/hook-logs"
mkdir -p "$LOG_DIR" 2>/dev/null || true
TASK_ID="${CLAUDE_TASK_ID:-${WL_TASK_ID:-session-$(date +%s)}}"
LOG="$LOG_DIR/${TASK_ID}--audit-stale-handoffs.log"

TIMESTAMP="$(date -u +%FT%TZ)"

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------
log() {
  printf '%s [audit-stale-handoffs] %s\n' "$TIMESTAMP" "$*" >> "$LOG" 2>/dev/null || true
}

emit() {
  printf '%s\n' "$*"
  log "$*"
}

# ---------------------------------------------------------------------------
# SCOPE GUARD: refuse to scan .claude/beta/** even if WL_SIGNATURES_DIR points there
# ---------------------------------------------------------------------------
if [[ "$SIGS_DIR" == *".claude/beta"* ]]; then
  emit "ERROR reason=SCOPE_VIOLATION detail=WL_SIGNATURES_DIR points into .claude/beta which is excluded"
  exit 2
fi

# ---------------------------------------------------------------------------
# TitleCase → lowercase roster map (mirrors sign-work.sh designation_for)
# ---------------------------------------------------------------------------
to_lowercase() {
  # Accepts TitleCase name (e.g. "Algol"); emits lowercase (e.g. "algol").
  # Returns empty string for names not in the roster.
  case "$1" in
    Polaris)    printf 'polaris' ;;
    Sirius)     printf 'sirius' ;;
    Altair)     printf 'altair' ;;
    Procyon)    printf 'procyon' ;;
    Betelgeuse) printf 'betelgeuse' ;;
    Arcturus)   printf 'arcturus' ;;
    Algol)      printf 'algol' ;;
    Canopus)    printf 'canopus' ;;
    Vega)       printf 'vega' ;;
    *)          printf '' ;;
  esac
}

# ---------------------------------------------------------------------------
# Start
# ---------------------------------------------------------------------------
log "start ts=$TIMESTAMP sigs=$SIGS_DIR warn_mode=$WARN_MODE"
emit "AUDIT-STALE-HANDOFFS ts=$TIMESTAMP"
emit "  signatures_dir=$SIGS_DIR"
emit "  warn_mode=$WARN_MODE (exit 0 on findings until flip-to-fail conditions met)"

# ---------------------------------------------------------------------------
# Enumerate signatures (exclude AUDIT.md, SCHEMA.md, non-.json)
# ---------------------------------------------------------------------------
SIG_COUNT=0
STALE_COUNT=0
UNKNOWN_COUNT=0
PARSE_COUNT=0
FINDINGS=""

add_finding() {
  local line="$1"
  FINDINGS="${FINDINGS}${line}
"
  emit "  $line"
  log "$line"
}

# Collect all .json files in SIGS_DIR (not recursive — signatures are flat)
while IFS= read -r sig_file; do
  [[ -z "$sig_file" ]] && continue

  # Scope guard: skip anything in .claude/beta (belt-and-suspenders)
  if [[ "$sig_file" == *".claude/beta/"* ]]; then
    log "SKIP (beta exclusion): $sig_file"
    continue
  fi

  SIG_COUNT=$(( SIG_COUNT + 1 ))
  sig_basename="$(basename "$sig_file")"

  # ---------------------------------------------------------------------------
  # Parse the signature
  # Gracefully handle:
  #   - agent field as plain string: "Algol"
  #   - agent field as object: {"agent":"Algol","designation":"..."}
  # Use jq -e so field-not-found returns non-zero; use // empty for tolerant fallback
  # ---------------------------------------------------------------------------
  PARSE_OK=1

  # Extract task_id
  task_id="$(jq -re '.task_id // empty' "$sig_file" 2>/dev/null)" || PARSE_OK=0

  # Extract agent name (handle string or object)
  from_agent=""
  if [[ "$PARSE_OK" -eq 1 ]]; then
    from_agent="$(jq -re '
      if (.agent | type) == "object" then .agent.agent
      elif (.agent | type) == "string" then .agent
      else empty end // empty
    ' "$sig_file" 2>/dev/null)" || PARSE_OK=0
  fi

  # Extract next_recipient agent name
  next_agent=""
  if [[ "$PARSE_OK" -eq 1 ]]; then
    next_agent="$(jq -re '
      if (.next_recipient | type) == "object" then .next_recipient.agent
      elif (.next_recipient | type) == "string" then .next_recipient
      else empty end // empty
    ' "$sig_file" 2>/dev/null)" || PARSE_OK=0
  fi

  if [[ "$PARSE_OK" -eq 0 ]] || [[ -z "$task_id" ]] || [[ -z "$from_agent" ]] || [[ -z "$next_agent" ]]; then
    PARSE_COUNT=$(( PARSE_COUNT + 1 ))
    add_finding "RESULT status=PARSE_ISSUE file=$sig_basename reason=could not parse required fields (task_id/agent/next_recipient) from JSON"
    log "PARSE_ISSUE file=$sig_basename"
    continue
  fi

  log "SCAN file=$sig_basename task_id=$task_id from=$from_agent next=$next_agent"

  # ---------------------------------------------------------------------------
  # Map TitleCase next_agent → lowercase for path/file comparisons
  # ---------------------------------------------------------------------------
  next_lc="$(to_lowercase "$next_agent")"

  if [[ -z "$next_lc" ]]; then
    # Name not in roster
    UNKNOWN_COUNT=$(( UNKNOWN_COUNT + 1 ))
    add_finding "RESULT status=UNKNOWN_RECIPIENT task_id=$task_id from_agent=$from_agent next_recipient=$next_agent reason=name not in known roster; cannot determine pickup"
    log "UNKNOWN_RECIPIENT task_id=$task_id from=$from_agent next=$next_agent"
    continue
  fi

  # ---------------------------------------------------------------------------
  # POLARIS ASSUMPTION: treat polaris-as-next as NON-STALE
  # Rationale: Polaris is the default terminal recipient; closing the loop via
  # STATUS.md or prose rather than a new per-task signature is normal workflow.
  # Document: see POLARIS ASSUMPTION in script header and RAIL-DEFINITIONS.md.
  # ---------------------------------------------------------------------------
  if [[ "$next_lc" == "polaris" ]]; then
    log "SKIP (polaris assumption) task_id=$task_id from=$from_agent — polaris-as-next treated non-stale by design"
    continue
  fi

  # ---------------------------------------------------------------------------
  # PICKUP EVIDENCE CHECK
  # (a) Filename-based: does <task_id>--<next_lc>.json exist in SIGS_DIR?
  # (b) Content-based: does any .json in SIGS_DIR have .task_id==task_id AND .agent==next_agent?
  # ---------------------------------------------------------------------------
  PICKED_UP=0

  # (a) Filename-based check
  candidate_file="$SIGS_DIR/${task_id}--${next_lc}.json"
  if [[ -f "$candidate_file" ]]; then
    PICKED_UP=1
    log "PICKUP_FOUND (filename) task_id=$task_id next=$next_agent file=$(basename "$candidate_file")"
  fi

  # (b) Content-based check (only if (a) didn't already confirm pickup)
  if [[ "$PICKED_UP" -eq 0 ]]; then
    # Scan all signatures for matching task_id AND agent == next_agent
    while IFS= read -r other_sig; do
      [[ -z "$other_sig" ]] && continue
      if [[ "$other_sig" == *".claude/beta/"* ]]; then
        continue
      fi
      # Check task_id and agent fields
      match="$(jq -re --arg tid "$task_id" --arg ag "$next_agent" '
        (.task_id // empty) == $tid and (
          ((.agent | type) == "string" and .agent == $ag) or
          ((.agent | type) == "object" and .agent.agent == $ag)
        )
      ' "$other_sig" 2>/dev/null)" || continue
      if [[ "$match" == "true" ]]; then
        PICKED_UP=1
        log "PICKUP_FOUND (content) task_id=$task_id next=$next_agent in $(basename "$other_sig")"
        break
      fi
    done < <(find "$SIGS_DIR" -maxdepth 1 -name "*.json" 2>/dev/null | sort)
  fi

  # ---------------------------------------------------------------------------
  # Flag as STALE if no pickup evidence found
  # ---------------------------------------------------------------------------
  if [[ "$PICKED_UP" -eq 0 ]]; then
    STALE_COUNT=$(( STALE_COUNT + 1 ))
    add_finding "RESULT status=STALE task_id=$task_id from_agent=$from_agent next_recipient=$next_agent reason=no downstream signature found for this task_id by next_recipient"
    log "STALE task_id=$task_id from=$from_agent next=$next_agent"
  else
    log "OK task_id=$task_id from=$from_agent next=$next_agent pickup=confirmed"
  fi

done < <(find "$SIGS_DIR" -maxdepth 1 -name "*.json" 2>/dev/null | sort)

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
emit ""
emit "SUMMARY"
emit "  signatures_scanned=$SIG_COUNT"
emit "  stale=$STALE_COUNT"
emit "  unknown_recipient=$UNKNOWN_COUNT"
emit "  parse_issues=$PARSE_COUNT"
emit "  warn_mode=$WARN_MODE"

if [[ "$STALE_COUNT" -gt 0 ]] || [[ "$UNKNOWN_COUNT" -gt 0 ]]; then
  emit ""
  emit "FINDINGS (stale=$STALE_COUNT unknown=$UNKNOWN_COUNT parse_issues=$PARSE_COUNT):"
  emit "  See RESULT lines above."
  emit ""
  if [[ "$WARN_MODE" -eq 1 ]]; then
    emit "RESULT status=WARN exit=0 (warn-mode: findings present but non-blocking until flip-to-fail)"
    log "exit 0 WARN stale=$STALE_COUNT unknown=$UNKNOWN_COUNT"
    exit 0
  else
    emit "RESULT status=FAIL exit=1 (fail-mode: stale or unknown handoffs block)"
    log "exit 1 FAIL stale=$STALE_COUNT unknown=$UNKNOWN_COUNT"
    exit 1
  fi
fi

if [[ "$PARSE_COUNT" -gt 0 ]] && [[ "$STALE_COUNT" -eq 0 ]] && [[ "$UNKNOWN_COUNT" -eq 0 ]]; then
  emit ""
  emit "RESULT status=WARN exit=0 (parse issues present; see PARSE_ISSUE lines above)"
  log "exit 0 PARSE_ISSUES_ONLY count=$PARSE_COUNT"
  exit 0
fi

emit ""
emit "RESULT status=OK exit=0"
emit "  All $SIG_COUNT signatures have pickup evidence or are polaris-terminal (non-stale by assumption)."
log "exit 0 OK scanned=$SIG_COUNT"
exit 0
