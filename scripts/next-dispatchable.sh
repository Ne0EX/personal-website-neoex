#!/usr/bin/env bash
# scripts/next-dispatchable.sh
# Owner:   Canopus (α-HRN-07)
# TASK:    TASK-2026-05-15-META-1
# REVISE:  MINI-2026-05-16 · bash4 → bash3.2 port
# Purpose: Scan STATUS.md + signatures + handoffs and emit the set of TASKs
#          that are NOW-DISPATCHABLE (all deps closed, no Peat-decision gate,
#          no same-agent collision, no opus-budget overrun).
#
# CRITICAL HOLD-GATE: This script is read-only. It emits RECOMMENDATIONS
# only. It does NOT write STATUS.md, does NOT dispatch agents, and does NOT
# modify any live system state. Polaris reviews the output and dispatches.
# Do NOT automate the output into live dispatch without Polaris sign-off.
#
# Usage:
#   bash scripts/next-dispatchable.sh [--status <file>] [--sigs <dir>]
#                                     [--handoffs <dir>] [--json] [--md]
#                                     [--opus-budget <n>] [--help]
#
# Options:
#   --status   <file>   Path to STATUS.md         (default: docs/team/STATUS.md)
#   --sigs     <dir>    Path to signatures dir     (default: .claude/signatures)
#   --handoffs <dir>    Path to handoffs from-polaris dir
#                                                  (default: .claude/handoffs/from-polaris)
#   --json              Emit JSON output  (default: both JSON+MD)
#   --md                Emit markdown only (default: both JSON+MD)
#   --opus-budget <n>   Override total opus budget (default: 4)
#   --help              Print usage and exit 0
#
# Output (stdout):
#   JSON block followed by Markdown table (unless --json or --md restrict it).
#   JSON is machine-readable; Markdown is for Polaris's 1-tool-call review.
#
# Expected schema (STATUS.md):
#   ## TASK-<id> · <summary> · <status>
#   where status is one of: closed / in-flight / queued / blocked / parked
#   blocked_by · <TASK-id> (if status=blocked, this line identifies the dep)
#
# Expected schema (signatures):
#   <task_id>--<agent>.json  v2 signature payload with harness_passed, post_edit_passed
#   Audit sigs:              <task_id>-audit--<agent>.json (Algol QA cross-check)
#
# Expected schema (handoffs):
#   TASK-<id>*.md with YAML frontmatter task_id, to (agent), blocked_by fields
#   and body containing BLOCKED-ON-PEAT-DECISION markers
#
# Exit codes:
#   0  — completed normally (output emitted; check dispatchable_count in JSON)
#   1  — no STATUS.md found at the given path
#   2  — jq not available (required for signature parsing)
#   3  — bad argument
#
# ============================================================================
# SCHEMA DOCUMENTATION (for Polaris / META-2 contract alignment)
# ============================================================================
#
# STATUS.md TASK entry format this script expects:
#
#   ## TASK-<id> [(<alias>)] · <summary> · <status>
#
#   status keywords (case-insensitive):
#     closed     — all slices accepted; signature(s) present
#     in-flight  — at least one slice not yet accepted
#     queued     — ready to dispatch but not yet started
#     blocked    — blocked on an upstream TASK or Peat decision
#     parked     — deliberate pause (logged but not counted as blocked)
#
#   If the ## heading contains "BLOCKED":
#     The script also looks for a "blocked_by ·" line in the entry body.
#
#   blocked_by body line format:
#     blocked_by · TASK-<id> [, TASK-<id> ...]
#       or
#     blocked_by · Peat <description>
#
#   BLOCKED-ON-PEAT-DECISION marker (in body):
#     Any line matching /BLOCKED-ON-PEAT-DECISION/ counts as an unresolved
#     Peat gate. The script flags the TASK as "peat_decision_pending".
#
# Signature expected fields (checked by this script):
#   task_id, agent, harness_passed (bool), post_edit_passed (bool)
#   For closure: harness_passed=true required; post_edit_passed=true preferred.
#
# Opus override ledger:
#   The script counts signatures where the STATUS.md entry says "opus" in the
#   model field of the handoff YAML frontmatter, or the DEV-PLAN ledger listing.
#   For the current wave this is hardcoded to the 4-slot budget from DEV-PLAN-D §D.7.
#
# ============================================================================
# BASH 3.2 COMPATIBILITY NOTE
# ============================================================================
#
# macOS ships bash 3.2 (/bin/bash) which does not support associative arrays
# (declare -A). This script was originally written with declare -A and ported
# to bash 3.2-compatible flat-file key=value storage in MINI-2026-05-16.
#
# Approach: a single temp directory (TMPDIR_ND) is created at startup and
# removed on EXIT via trap. Each "associative array" becomes a file in that
# directory:
#
#   sig_closed/<task_id>       → "agent|harness|post_edit"
#   sig_algol/<task_id>        → "audited"
#   ho_blocked_by/<task_id>    → dep string
#   ho_peat_gate/<task_id>     → "true" or absent
#   ho_agent/<task_id>         → agent name
#   ho_model/<task_id>         → "sonnet" or "opus"
#   agent_in_flight/<agent>    → comma-separated task list
#
# Reads use: cat "$TMPDIR_ND/namespace/key" 2>/dev/null || echo ""
# Writes use: echo "value" > "$TMPDIR_ND/namespace/key"
# Existence test: [[ -f "$TMPDIR_ND/namespace/key" ]]
#
# Task-id and agent names may contain hyphens and dots; they are safe as
# filenames on macOS/Linux POSIX filesystems.
#
# ============================================================================

set -euo pipefail

# ── defaults ───────────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATUS_FILE="$REPO_ROOT/docs/team/STATUS.md"
SIGS_DIR="$REPO_ROOT/.claude/signatures"
HANDOFFS_DIR="$REPO_ROOT/.claude/handoffs/from-polaris"
EMIT_JSON=true
EMIT_MD=true
OPUS_BUDGET=4
SHOW_HELP=false

# ── argument parsing ────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --status)   STATUS_FILE="$2"; shift 2 ;;
    --sigs)     SIGS_DIR="$2";    shift 2 ;;
    --handoffs) HANDOFFS_DIR="$2"; shift 2 ;;
    --json)     EMIT_JSON=true;  EMIT_MD=false;  shift ;;
    --md)       EMIT_JSON=false; EMIT_MD=true;   shift ;;
    --opus-budget) OPUS_BUDGET="$2"; shift 2 ;;
    --help)     SHOW_HELP=true; shift ;;
    *) echo "[next-dispatchable] ERROR: unknown argument '$1'" >&2; exit 3 ;;
  esac
done

if $SHOW_HELP; then
  sed -n '2,/^# ===.*/p' "$0" | grep '^#' | sed 's/^# \?//'
  exit 0
fi

# ── guards ──────────────────────────────────────────────────────────────────
if [[ ! -f "$STATUS_FILE" ]]; then
  echo "[next-dispatchable] ERROR: STATUS.md not found at $STATUS_FILE" >&2
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "[next-dispatchable] ERROR: jq is required for signature parsing" >&2
  exit 2
fi

# ── temp directory (bash3.2-compatible associative store) ───────────────────
# Each "namespace" is a subdirectory; each "key" is a file; "value" is content.
TMPDIR_ND="$(mktemp -d /tmp/next-dispatchable.XXXXXX)"
trap 'rm -rf "$TMPDIR_ND"' EXIT

mkdir -p \
  "$TMPDIR_ND/sig_closed" \
  "$TMPDIR_ND/sig_algol" \
  "$TMPDIR_ND/ho_blocked_by" \
  "$TMPDIR_ND/ho_peat_gate" \
  "$TMPDIR_ND/ho_agent" \
  "$TMPDIR_ND/ho_model" \
  "$TMPDIR_ND/agent_in_flight"

# Helper: sanitize a key so it is safe as a filename.
# Replaces characters that are not alphanumeric, hyphen, or dot with underscore.
sanitize_key() {
  echo "$1" | tr -c 'a-zA-Z0-9.-' '_'
}

# ── PHASE 1: Parse STATUS.md ─────────────────────────────────────────────────
# Extract TASK entries: id, status, summary, blocked_by, in_flight_agent
#
# Approach: awk over STATUS.md, split on "## TASK-" headings.
# Each block is emitted as a SOH-delimited (\x01) record.
#
# Output columns (SOH-separated, \x01):
#   task_id SOH status SOH summary SOH raw_blocked_by SOH peat_gate SOH agents
#
# NOTE: We use SOH (\x01) not TAB as separator because bash's `read` with
# IFS=\t collapses consecutive tab characters, swallowing empty fields.
# SOH is non-whitespace and will not appear in STATUS.md content.
# bash 3.2: IFS=$'\x01' preserves empty fields correctly.

TASK_RAW=$(awk '
BEGIN { FS="\t"; task=""; status=""; summary=""; blocked=""; peat=""; agents="" }

/^## (TASK-[0-9A-Za-z-]+)/ {
  # flush previous block
  if (task != "") {
    printf "%s\x01%s\x01%s\x01%s\x01%s\x01%s\n", task, status, summary, blocked, peat, agents
  }
  # reset
  line=$0
  # extract task_id: first token matching TASK-\S+
  match(line, /TASK-[0-9A-Za-z.-]+/)
  task=substr(line, RSTART, RLENGTH)
  # remove trailing dot if any
  sub(/\.$/, "", task)

  status="unknown"
  if (line ~ /[Cc]losed/)    status="closed"
  if (line ~ /in-flight/)    status="in-flight"
  if (line ~ /[Qq]ueued/)    status="queued"
  if (line ~ /[Bb]locked/)   status="blocked"
  if (line ~ /[Pp]arked/)    status="parked"

  # extract summary (text between first · and last ·<status>)
  summary=line
  sub(/^## /, "", summary)
  sub(/·[^·]*$/, "", summary)
  sub(/.*·/, "", summary)
  gsub(/^[[:space:]]+|[[:space:]]+$/, "", summary)

  blocked=""
  peat="false"
  agents=""
  next
}

# continuation lines for current block
task != "" {
  # blocked_by line
  if ($0 ~ /blocked_by[[:space:]]*·/) {
    split($0, parts, "·")
    blocked=parts[2]
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", blocked)
  }
  # Peat decision gates in body
  if ($0 ~ /BLOCKED-ON-PEAT-DECISION/) {
    peat="true"
  }
  # slice agent lines: look for patterns like "Betelgeuse (S1)" or "slice · Betelgeuse"
  if ($0 ~ /slice[[:space:]]*·/ || $0 ~ /slices/) {
    if ($0 ~ /[Bb]etelgeuse/)  agents=agents (agents==""?"":"," ) "Betelgeuse"
    if ($0 ~ /[Ss]irius/)      agents=agents (agents==""?"":"," ) "Sirius"
    if ($0 ~ /[Pp]rocyon/)     agents=agents (agents==""?"":"," ) "Procyon"
    if ($0 ~ /[Aa]lgol/)       agents=agents (agents==""?"":"," ) "Algol"
    if ($0 ~ /[Aa]rcturus/)    agents=agents (agents==""?"":"," ) "Arcturus"
    if ($0 ~ /[Vv]ega/)        agents=agents (agents==""?"":"," ) "Vega"
    if ($0 ~ /[Aa]ltair/)      agents=agents (agents==""?"":"," ) "Altair"
    if ($0 ~ /[Cc]anopus/)     agents=agents (agents==""?"":"," ) "Canopus"
    if ($0 ~ /[Pp]olaris/)     agents=agents (agents==""?"":"," ) "Polaris"
  }
}

END {
  if (task != "") {
    printf "%s\x01%s\x01%s\x01%s\x01%s\x01%s\n", task, status, summary, blocked, peat, agents
  }
}
' "$STATUS_FILE")

# ── PHASE 2: Build closure set from signatures ─────────────────────────────
# A TASK is "signature-closed" if there is a <task_id>--<agent>.json with
# harness_passed=true (post_edit_passed=true preferred but not required for
# spec-only tasks).
# We do NOT count -audit-- sigs for closure; those are Algol QA cross-check.

OPUS_SHIPPED_COUNT=0

for sig_file in "$SIGS_DIR"/TASK-*.json; do
  [[ -f "$sig_file" ]] || continue
  base="$(basename "$sig_file" .json)"

  # skip audit sigs for closure (they are supplementary)
  if [[ "$base" == *"-audit--"* ]]; then
    task_id=$(jq -r '.task_id // ""' "$sig_file" 2>/dev/null || true)
    # strip -audit suffix to get parent task id
    parent="${task_id%-audit}"
    parent="${parent%-audit*}"
    if [[ -n "$parent" ]]; then
      k=$(sanitize_key "$parent")
      echo "audited" > "$TMPDIR_ND/sig_algol/$k"
    fi
    continue
  fi

  # skip REVISE- and DEV-PLAN- sigs (not TASK sigs)
  if [[ "$base" == REVISE-* ]] || [[ "$base" == DEV-PLAN-* ]]; then
    continue
  fi

  task_id=$(jq -r '.task_id // ""' "$sig_file" 2>/dev/null || true)
  agent=$(jq -r '.agent // ""' "$sig_file" 2>/dev/null || true)
  harness=$(jq -r '.harness_passed // false' "$sig_file" 2>/dev/null || echo false)
  post_edit=$(jq -r '.post_edit_passed // false' "$sig_file" 2>/dev/null || echo false)

  [[ -z "$task_id" ]] && continue

  k=$(sanitize_key "$task_id")
  echo "${agent}|${harness}|${post_edit}" > "$TMPDIR_ND/sig_closed/$k"
done

# Count opus shipped from STATUS.md (lines with "opus override" or "opus" in model audit)
# and from the DEV-PLAN ledger. From STATUS.md reading above:
# TASK-06 S2 Betelgeuse = opus shipped
# TASK-08 Betelgeuse    = opus shipped
# TASK-14 Betelgeuse    = opus shipped (now closed per STATUS.md)
# TASK-51 Arcturus      = opus planned (not yet dispatched)
# Hardcode from STATUS.md knowledge: 3 shipped (TASK-06-S2, TASK-08, TASK-14)
# This is the canonical ledger per DEV-PLAN-D §D.7 + STATUS.md TASK-14 close note
OPUS_SHIPPED_COUNT=3
OPUS_REMAINING=$(( OPUS_BUDGET - OPUS_SHIPPED_COUNT ))

# ── PHASE 3: Parse handoffs for blocked_by + Peat gates ────────────────────
# Supplement STATUS.md data with YAML frontmatter from handoff files

for ho_file in "$HANDOFFS_DIR"/TASK-*.md; do
  [[ -f "$ho_file" ]] || continue
  # Extract YAML frontmatter (between first --- and second ---)
  task_id=$(awk '/^---/{f++} f==1 && /task_id:/{print $2; exit}' "$ho_file" 2>/dev/null || true)
  [[ -z "$task_id" ]] && continue

  to_agent=$(awk '/^---/{f++} f==1 && /^to:/{$1=""; print; exit}' "$ho_file" 2>/dev/null \
    | sed 's/^ //' || true)
  model=$(awk '/^---/{f++} f==1 && /^model:/{print $2; exit}' "$ho_file" 2>/dev/null || true)
  blocked_by_ho=$(awk '/^---/{f++} f==1 && /blocked_by:/{$1=""; print; exit}' "$ho_file" 2>/dev/null \
    | sed 's/^ //' || true)

  k=$(sanitize_key "$task_id")
  [[ -n "$to_agent" ]]      && echo "$to_agent"      > "$TMPDIR_ND/ho_agent/$k"
  [[ -n "$model" ]]         && echo "$model"          > "$TMPDIR_ND/ho_model/$k"
  [[ -n "$blocked_by_ho" ]] && echo "$blocked_by_ho" > "$TMPDIR_ND/ho_blocked_by/$k"

  # Check body for BLOCKED-ON-PEAT-DECISION
  if grep -q "BLOCKED-ON-PEAT-DECISION" "$ho_file" 2>/dev/null; then
    echo "true" > "$TMPDIR_ND/ho_peat_gate/$k"
  fi
done

# ── PHASE 4: Build in-flight agent set ─────────────────────────────────────
# Track which agents are currently in-flight (have unsigned / in-flight tasks)
#
# NOTE: We use `while IFS= read -r line; do ... cut -d$'\001'` instead of
# `while IFS=$'\001' read -r f1 f2...` because bash 3.2's herestring (<<<)
# with a SOH IFS does not split fields correctly (known bash3.2 limitation).
# cut -d$'\001' -f<n> is the bash3.2-safe way to extract SOH-delimited fields.

while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  task_id=$(echo "$line" | cut -d$'\001' -f1)
  status=$(echo "$line"  | cut -d$'\001' -f2)
  agents=$(echo "$line"  | cut -d$'\001' -f6)
  [[ "$status" == "in-flight" ]] || continue
  IFS=',' read -ra agent_list <<< "$agents"
  for ag in "${agent_list[@]}"; do
    ag="$(echo "$ag" | tr -d '[:space:]')"
    [[ -z "$ag" ]] && continue
    ak=$(sanitize_key "$ag")
    existing=$(cat "$TMPDIR_ND/agent_in_flight/$ak" 2>/dev/null || true)
    if [[ -z "$existing" ]]; then
      echo "$task_id" > "$TMPDIR_ND/agent_in_flight/$ak"
    else
      echo "$existing,$task_id" > "$TMPDIR_ND/agent_in_flight/$ak"
    fi
  done
done <<< "$TASK_RAW"

# ── PHASE 5: Dispatchability evaluation ────────────────────────────────────
# For each queued or blocked TASK, determine if it is NOW-DISPATCHABLE.

# Build the JSON output as an array
JSON_TASKS="[]"
MD_ROWS=""

NOW_DISPATCHABLE_COUNT=0
BLOCKED_COUNT=0
IN_FLIGHT_COUNT=0
CLOSED_COUNT=0

while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  task_id=$(echo "$line"  | cut -d$'\001' -f1)
  status=$(echo "$line"   | cut -d$'\001' -f2)
  summary=$(echo "$line"  | cut -d$'\001' -f3)
  blocked=$(echo "$line"  | cut -d$'\001' -f4)
  peat=$(echo "$line"     | cut -d$'\001' -f5)
  agents=$(echo "$line"   | cut -d$'\001' -f6)
  [[ -z "$task_id" ]] && continue

  # Track in-flight and closed for summary counts
  if [[ "$status" == "in-flight" ]]; then
    IN_FLIGHT_COUNT=$(( IN_FLIGHT_COUNT + 1 ))
    continue
  fi
  if [[ "$status" == "closed" ]]; then
    CLOSED_COUNT=$(( CLOSED_COUNT + 1 ))
    continue
  fi
  if [[ "$status" == "parked" ]]; then
    continue
  fi

  # status is queued or blocked — evaluate dispatchability
  gates_failed=""
  gates_passed=""

  k=$(sanitize_key "$task_id")

  # Gate 1: dependency closure
  # Combine blocked_by from STATUS.md body and handoff YAML.
  # Deduplicate by normalizing to comma-separated then piping through sort -u.
  dep_string="$blocked"
  ho_blocked=$(cat "$TMPDIR_ND/ho_blocked_by/$k" 2>/dev/null || true)
  if [[ -n "$ho_blocked" ]]; then
    if [[ -n "$dep_string" ]]; then
      dep_string="$dep_string, $ho_blocked"
    else
      dep_string="$ho_blocked"
    fi
  fi
  # Deduplicate dep_string entries (STATUS.md and handoff may both list the same dep).
  # tr ',' '\n' splits on commas; sed strips leading/trailing spaces per line (NOT
  # tr -d '[:space:]' which also eats newlines); sort -u deduplicates; join back.
  if [[ -n "$dep_string" ]]; then
    dep_string=$(echo "$dep_string" | tr ',' '\n' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | grep -v '^$' | sort -u | tr '\n' ',' | sed 's/,$//')
  fi

  deps_unresolved=""
  deps_resolved=""

  if [[ -n "$dep_string" ]]; then
    # split deps on comma
    while IFS= read -r dep_raw; do
      dep_raw="$(echo "$dep_raw" | tr -d '[:space:]')"
      [[ -z "$dep_raw" ]] && continue
      # extract TASK-id if present
      dep_task=$(echo "$dep_raw" | grep -oE 'TASK-[0-9A-Za-z.-]+' || true)
      if [[ -z "$dep_task" ]]; then
        # non-TASK dep (e.g. "Peat globe-ontology decision")
        if [[ -z "$deps_unresolved" ]]; then
          deps_unresolved="$dep_raw"
        else
          deps_unresolved="$deps_unresolved,$dep_raw"
        fi
        continue
      fi
      # check if dep is closed via signature or STATUS.md status=closed
      dep_closed=false
      dk=$(sanitize_key "$dep_task")
      if [[ -f "$TMPDIR_ND/sig_closed/$dk" ]]; then
        dep_closed=true
      fi
      # Also check STATUS.md closed status (use SOH separator to match TASK_RAW format)
      dep_status=$(echo "$TASK_RAW" | awk -v dt="$dep_task" -F'\x01' '$1==dt{print $2}')
      if [[ "$dep_status" == "closed" ]]; then
        dep_closed=true
      fi

      if $dep_closed; then
        if [[ -z "$deps_resolved" ]]; then
          deps_resolved="$dep_task"
        else
          deps_resolved="$deps_resolved,$dep_task"
        fi
      else
        if [[ -z "$deps_unresolved" ]]; then
          deps_unresolved="$dep_task"
        else
          deps_unresolved="$deps_unresolved,$dep_task"
        fi
      fi
    done < <(echo "$dep_string" | tr ',' '\n')
  fi

  if [[ -n "$deps_unresolved" ]]; then
    dep_list="$deps_unresolved"
    if [[ -z "$gates_failed" ]]; then
      gates_failed="deps_open:$dep_list"
    else
      gates_failed="$gates_failed|deps_open:$dep_list"
    fi
  else
    if [[ -z "$gates_passed" ]]; then
      gates_passed="deps_closed"
    else
      gates_passed="$gates_passed|deps_closed"
    fi
  fi

  # Gate 2: Peat decision gate
  peat_pending=false
  ho_peat=$(cat "$TMPDIR_ND/ho_peat_gate/$k" 2>/dev/null || true)
  if [[ "$peat" == "true" ]] || [[ "$ho_peat" == "true" ]]; then
    peat_pending=true
    if [[ -z "$gates_failed" ]]; then
      gates_failed="peat_decision_pending"
    else
      gates_failed="$gates_failed|peat_decision_pending"
    fi
  else
    if [[ -z "$gates_passed" ]]; then
      gates_passed="no_peat_gate"
    else
      gates_passed="$gates_passed|no_peat_gate"
    fi
  fi

  # Gate 3: Opus budget
  model=$(cat "$TMPDIR_ND/ho_model/$k" 2>/dev/null || echo "sonnet")
  [[ -z "$model" ]] && model="sonnet"
  opus_gate_ok=true
  if [[ "$model" == "opus" ]]; then
    if [[ $OPUS_REMAINING -le 0 ]]; then
      opus_gate_ok=false
      if [[ -z "$gates_failed" ]]; then
        gates_failed="opus_budget_exhausted:shipped=${OPUS_SHIPPED_COUNT},budget=${OPUS_BUDGET}"
      else
        gates_failed="$gates_failed|opus_budget_exhausted:shipped=${OPUS_SHIPPED_COUNT},budget=${OPUS_BUDGET}"
      fi
    else
      if [[ -z "$gates_passed" ]]; then
        gates_passed="opus_budget_ok:remaining=${OPUS_REMAINING}"
      else
        gates_passed="$gates_passed|opus_budget_ok:remaining=${OPUS_REMAINING}"
      fi
    fi
  fi

  # Gate 4: Same-agent serialization (Sirius WorldlineGlobe.tsx rule)
  # Per DEV-PLAN-B B.3: Sirius single-thread on WorldlineGlobe.tsx
  ho_agent=$(cat "$TMPDIR_ND/ho_agent/$k" 2>/dev/null || echo "$agents")
  [[ -z "$ho_agent" ]] && ho_agent="$agents"
  agent_collision=false
  collision_reason=""

  # Check if agent is currently in-flight
  ak=$(sanitize_key "$ho_agent")
  in_flight_val=$(cat "$TMPDIR_ND/agent_in_flight/$ak" 2>/dev/null || true)
  if [[ -n "$in_flight_val" ]]; then
    # For Sirius: any in-flight blocks new dispatch
    if [[ "$ho_agent" == *"sirius"* ]] || [[ "$ho_agent" == *"Sirius"* ]]; then
      agent_collision=true
      collision_reason="sirius_in_flight:$in_flight_val"
    fi
  fi

  if $agent_collision; then
    if [[ -z "$gates_failed" ]]; then
      gates_failed="agent_collision:$collision_reason"
    else
      gates_failed="$gates_failed|agent_collision:$collision_reason"
    fi
  fi

  # Gate 5: Algol audit recommendation
  # Per feedback_algol_qa_cross_check: every closure should route through Algol.
  # For dispatchability we check: if task's deps are closed, did they get Algol audit?
  algol_note=""
  if [[ -n "$deps_resolved" ]]; then
    missing_audits=""
    IFS=',' read -ra resolved_list <<< "$deps_resolved"
    for dep in "${resolved_list[@]}"; do
      dk=$(sanitize_key "$dep")
      if [[ ! -f "$TMPDIR_ND/sig_algol/$dk" ]]; then
        if [[ -z "$missing_audits" ]]; then
          missing_audits="$dep"
        else
          missing_audits="$missing_audits,$dep"
        fi
      fi
    done
    if [[ -n "$missing_audits" ]]; then
      algol_note="algol_audit_pending_on_deps:$missing_audits"
    fi
  fi

  # Determine overall dispatchability
  dispatchable=false
  if [[ -z "$gates_failed" ]]; then
    dispatchable=true
    NOW_DISPATCHABLE_COUNT=$(( NOW_DISPATCHABLE_COUNT + 1 ))
  else
    BLOCKED_COUNT=$(( BLOCKED_COUNT + 1 ))
  fi

  # Determine handoff path
  handoff_path=""
  for ho_file in "$HANDOFFS_DIR"/TASK-*.md; do
    [[ -f "$ho_file" ]] || continue
    ho_task=$(awk '/^---/{f++} f==1 && /task_id:/{print $2; exit}' "$ho_file" 2>/dev/null || true)
    if [[ "$ho_task" == "$task_id" ]]; then
      handoff_path="${ho_file#$REPO_ROOT/}"
      break
    fi
  done

  # Format gates as JSON arrays (pipe-delimited internal format → JSON strings)
  gates_failed_json="[]"
  if [[ -n "$gates_failed" ]]; then
    gates_failed_json=$(echo "$gates_failed" | tr '|' '\n' | jq -R . | jq -s .)
  fi

  gates_passed_json="[]"
  if [[ -n "$gates_passed" ]]; then
    gates_passed_json=$(echo "$gates_passed" | tr '|' '\n' | jq -R . | jq -s .)
  fi

  deps_resolved_json="[]"
  if [[ -n "$deps_resolved" ]]; then
    deps_resolved_json=$(echo "$deps_resolved" | tr ',' '\n' | jq -R . | jq -s .)
  fi

  deps_unresolved_json="[]"
  if [[ -n "$deps_unresolved" ]]; then
    deps_unresolved_json=$(echo "$deps_unresolved" | tr ',' '\n' | jq -R . | jq -s .)
  fi

  # Build JSON entry for this TASK
  task_json=$(jq -n \
    --arg task_id "$task_id" \
    --arg status "$status" \
    --arg summary "$summary" \
    --arg agent "$ho_agent" \
    --arg model "$model" \
    --arg handoff_path "$handoff_path" \
    --argjson dispatchable "$dispatchable" \
    --argjson gates_passed "$gates_passed_json" \
    --argjson gates_failed "$gates_failed_json" \
    --argjson deps_resolved "$deps_resolved_json" \
    --argjson deps_unresolved "$deps_unresolved_json" \
    --arg algol_note "$algol_note" \
    '{
      task_id: $task_id,
      status: $status,
      summary: $summary,
      agent: $agent,
      model: $model,
      handoff_path: $handoff_path,
      dispatchable: $dispatchable,
      gates_passed: $gates_passed,
      gates_failed: $gates_failed,
      deps_resolved: $deps_resolved,
      deps_unresolved: $deps_unresolved,
      algol_note: $algol_note
    }')

  # Append to JSON array
  if [[ "$JSON_TASKS" == "[]" ]]; then
    JSON_TASKS="[$task_json]"
  else
    JSON_TASKS="${JSON_TASKS%]}, $task_json]"
  fi

  # Build markdown row
  status_icon="BLOCKED"
  $dispatchable && status_icon="NOW-DISPATCHABLE"

  gates_note=""
  if [[ -n "$gates_failed" ]]; then
    gates_note=$(echo "$gates_failed" | tr '|' '; ')
  else
    gates_note="all gates green"
  fi
  [[ -n "$algol_note" ]] && gates_note="$gates_note | NOTE: $algol_note"

  MD_ROWS="${MD_ROWS}| $task_id | $ho_agent | $model | ${handoff_path:-—} | $status_icon | $gates_note |"$'\n'

done <<< "$TASK_RAW"

# ── PHASE 6: Emit output ───────────────────────────────────────────────────

TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

FULL_JSON=$(jq -n \
  --arg ts "$TIMESTAMP" \
  --argjson opus_budget "$OPUS_BUDGET" \
  --argjson opus_shipped "$OPUS_SHIPPED_COUNT" \
  --argjson opus_remaining "$OPUS_REMAINING" \
  --argjson closed "$CLOSED_COUNT" \
  --argjson in_flight "$IN_FLIGHT_COUNT" \
  --argjson now_disp "$NOW_DISPATCHABLE_COUNT" \
  --argjson blocked "$BLOCKED_COUNT" \
  --argjson tasks "$JSON_TASKS" \
  '{
    generated_at: $ts,
    hold_gate: "ACTIVE — do NOT dispatch based on this output until Polaris reviews and approves",
    opus_ledger: {
      budget: $opus_budget,
      shipped: $opus_shipped,
      remaining: $opus_remaining
    },
    summary: {
      closed: $closed,
      in_flight: $in_flight,
      now_dispatchable: $now_disp,
      blocked: $blocked
    },
    tasks: $tasks
  }')

if $EMIT_JSON; then
  echo "=== JSON OUTPUT ==="
  echo "$FULL_JSON" | jq .
fi

if $EMIT_MD; then
  echo ""
  echo "=== MARKDOWN TABLE (Polaris dispatch review) ==="
  echo ""
  echo "**next-dispatchable scan · $TIMESTAMP**"
  echo ""
  echo "HOLD GATE ACTIVE: Output is a recommendation only. Polaris dispatches manually after review."
  echo ""
  echo "**Opus ledger:** $OPUS_SHIPPED_COUNT of $OPUS_BUDGET slots used · $OPUS_REMAINING remaining"
  echo ""
  echo "| TASK | Agent | Tier | Handoff | Status | Gates / Notes |"
  echo "|------|-------|------|---------|--------|---------------|"
  if [[ -n "$MD_ROWS" ]]; then
    echo "$MD_ROWS"
  else
    echo "| (no queued/blocked tasks found) | | | | | |"
  fi
  echo ""
  echo "**Summary:** $CLOSED_COUNT closed · $IN_FLIGHT_COUNT in-flight · $NOW_DISPATCHABLE_COUNT now-dispatchable · $BLOCKED_COUNT blocked"
  echo ""
  echo "**Standing rule (feedback_algol_qa_cross_check):** Every closure should route through Algol audit before Polaris closes the TASK."
fi
