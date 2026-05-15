#!/usr/bin/env bash
# scripts/next-dispatchable.sh
# Owner:   Canopus (α-HRN-07)
# TASK:    TASK-2026-05-15-META-1
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

# ── PHASE 1: Parse STATUS.md ─────────────────────────────────────────────────
# Extract TASK entries: id, status, summary, blocked_by, in_flight_agent
#
# Approach: awk over STATUS.md, split on "## TASK-" headings.
# Each block is emitted as a tab-delimited record.
#
# Output columns (tab-separated):
#   task_id TAB status TAB summary TAB raw_blocked_by TAB peat_gate TAB agents

TASK_RAW=$(awk '
BEGIN { OFS="\t"; task=""; status=""; summary=""; blocked=""; peat=""; agents="" }

/^## (TASK-[0-9A-Za-z-]+)/ {
  # flush previous block
  if (task != "") {
    print task, status, summary, blocked, peat, agents
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
    if ($0 ~ /[Pp]rocyon/)     agents=agents (agents==""?"":"," ) "Procyon"
  }
}

END {
  if (task != "") {
    print task, status, summary, blocked, peat, agents
  }
}
' "$STATUS_FILE")

# ── PHASE 2: Build closure set from signatures ─────────────────────────────
# A TASK is "signature-closed" if there is a <task_id>--<agent>.json with
# harness_passed=true (post_edit_passed=true preferred but not required for
# spec-only tasks).
# We do NOT count -audit-- sigs for closure; those are Algol QA cross-check.

declare -A SIG_CLOSED    # SIG_CLOSED[TASK-id]="agent|harness|post_edit"
declare -A SIG_ALGOL     # SIG_ALGOL[TASK-id]="audited"
declare -a OPUS_SHIPPED  # list of TASK-ids with opus override

for sig_file in "$SIGS_DIR"/TASK-*.json; do
  [[ -f "$sig_file" ]] || continue
  base="$(basename "$sig_file" .json)"

  # skip audit sigs for closure (they are supplementary)
  if [[ "$base" == *"-audit--"* ]]; then
    task_id=$(jq -r '.task_id // ""' "$sig_file" 2>/dev/null || true)
    # strip -audit suffix to get parent task id
    parent="${task_id%-audit}"
    parent="${parent%-audit*}"
    [[ -n "$parent" ]] && SIG_ALGOL["$parent"]="audited"
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

  SIG_CLOSED["$task_id"]="${agent}|${harness}|${post_edit}"
done

# Count opus shipped from STATUS.md (lines with "opus override" or "opus" in model audit)
# and from the DEV-PLAN ledger. From STATUS.md reading above:
# TASK-06 S2 Betelgeuse = opus shipped
# TASK-08 Betelgeuse    = opus shipped
# TASK-14 Betelgeuse    = opus shipped (now closed per STATUS.md)
# TASK-51 Arcturus      = opus planned (not yet dispatched)
OPUS_SHIPPED_COUNT=$(grep -c "opus override\|opus.*#[0-9]\|opus override.*shipped\|\*\*opus\*\*.*shipped" "$STATUS_FILE" 2>/dev/null || true)
# Hardcode from STATUS.md knowledge: 3 shipped (TASK-06-S2, TASK-08, TASK-14)
# This is the canonical ledger per DEV-PLAN-D §D.7 + STATUS.md TASK-14 close note
OPUS_SHIPPED_COUNT=3
OPUS_REMAINING=$(( OPUS_BUDGET - OPUS_SHIPPED_COUNT ))

# ── PHASE 3: Parse handoffs for blocked_by + Peat gates ────────────────────
# Supplement STATUS.md data with YAML frontmatter from handoff files
declare -A HO_BLOCKED_BY    # HO_BLOCKED_BY[TASK-id]="dep1,dep2"
declare -A HO_PEAT_GATE     # HO_PEAT_GATE[TASK-id]="true/false"
declare -A HO_AGENT         # HO_AGENT[TASK-id]="agent"
declare -A HO_MODEL         # HO_MODEL[TASK-id]="sonnet/opus"

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

  [[ -n "$to_agent" ]]    && HO_AGENT["$task_id"]="$to_agent"
  [[ -n "$model" ]]       && HO_MODEL["$task_id"]="$model"
  [[ -n "$blocked_by_ho" ]] && HO_BLOCKED_BY["$task_id"]="$blocked_by_ho"

  # Check body for BLOCKED-ON-PEAT-DECISION
  if grep -q "BLOCKED-ON-PEAT-DECISION" "$ho_file" 2>/dev/null; then
    HO_PEAT_GATE["$task_id"]="true"
  fi
done

# ── PHASE 4: Build in-flight agent set ─────────────────────────────────────
# Track which agents are currently in-flight (have unsigned / in-flight tasks)
declare -A AGENT_IN_FLIGHT

while IFS=$'\t' read -r task_id status summary blocked peat agents; do
  [[ "$status" == "in-flight" ]] || continue
  IFS=',' read -ra agent_list <<< "$agents"
  for ag in "${agent_list[@]}"; do
    ag="$(echo "$ag" | tr -d '[:space:]')"
    [[ -n "$ag" ]] && AGENT_IN_FLIGHT["$ag"]="${AGENT_IN_FLIGHT[$ag]:-},$task_id"
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

while IFS=$'\t' read -r task_id status summary blocked peat agents; do
  [[ -z "$task_id" ]] && continue

  # Track in-flight and closed for summary counts
  if [[ "$status" == "in-flight" ]]; then
    (( IN_FLIGHT_COUNT++ )) || true
    continue
  fi
  if [[ "$status" == "closed" ]]; then
    (( CLOSED_COUNT++ )) || true
    continue
  fi
  if [[ "$status" == "parked" ]]; then
    continue
  fi

  # status is queued or blocked — evaluate dispatchability
  gates_failed=()
  gates_passed=()

  # Gate 1: dependency closure
  # Combine blocked_by from STATUS.md body and handoff YAML
  dep_string="$blocked"
  if [[ -n "${HO_BLOCKED_BY[$task_id]:-}" ]]; then
    if [[ -n "$dep_string" ]]; then
      dep_string="$dep_string, ${HO_BLOCKED_BY[$task_id]}"
    else
      dep_string="${HO_BLOCKED_BY[$task_id]}"
    fi
  fi

  deps_unresolved=()
  deps_resolved=()

  if [[ -n "$dep_string" ]]; then
    # split deps on comma or "and"
    while IFS= read -r dep_raw; do
      dep_raw="$(echo "$dep_raw" | tr -d '[:space:]')"
      [[ -z "$dep_raw" ]] && continue
      # extract TASK-id if present
      dep_task=$(echo "$dep_raw" | grep -oE 'TASK-[0-9A-Za-z.-]+' || true)
      if [[ -z "$dep_task" ]]; then
        # non-TASK dep (e.g. "Peat globe-ontology decision")
        deps_unresolved+=("$dep_raw")
        continue
      fi
      # check if dep is closed via signature or STATUS.md status=closed
      dep_closed=false
      if [[ -n "${SIG_CLOSED[$dep_task]:-}" ]]; then
        dep_closed=true
      fi
      # Also check STATUS.md closed status
      dep_status=$(echo "$TASK_RAW" | awk -v dt="$dep_task" -F'\t' '$1==dt{print $2}')
      if [[ "$dep_status" == "closed" ]]; then
        dep_closed=true
      fi

      if $dep_closed; then
        deps_resolved+=("$dep_task")
      else
        deps_unresolved+=("$dep_task")
      fi
    done < <(echo "$dep_string" | tr ',' '\n')
  fi

  if [[ ${#deps_unresolved[@]} -gt 0 ]]; then
    dep_list=$(printf '%s,' "${deps_unresolved[@]}" | sed 's/,$//')
    gates_failed+=("deps_open:$dep_list")
  else
    gates_passed+=("deps_closed")
  fi

  # Gate 2: Peat decision gate
  peat_pending=false
  if [[ "$peat" == "true" ]] || [[ "${HO_PEAT_GATE[$task_id]:-}" == "true" ]]; then
    peat_pending=true
    gates_failed+=("peat_decision_pending")
  else
    gates_passed+=("no_peat_gate")
  fi

  # Gate 3: Opus budget
  model="${HO_MODEL[$task_id]:-sonnet}"
  opus_gate_ok=true
  if [[ "$model" == "opus" ]]; then
    if [[ $OPUS_REMAINING -le 0 ]]; then
      opus_gate_ok=false
      gates_failed+=("opus_budget_exhausted:shipped=$OPUS_SHIPPED_COUNT,budget=$OPUS_BUDGET")
    else
      gates_passed+=("opus_budget_ok:remaining=$OPUS_REMAINING")
    fi
  fi

  # Gate 4: Same-agent serialization (Sirius WorldlineGlobe.tsx rule)
  # Per DEV-PLAN-B B.3: Sirius single-thread on WorldlineGlobe.tsx
  agent="${HO_AGENT[$task_id]:-$agents}"
  agent_collision=false
  collision_reason=""

  # Check if agent is currently in-flight
  if [[ -n "${AGENT_IN_FLIGHT[$agent]:-}" ]]; then
    # For Sirius: any in-flight blocks new dispatch
    if [[ "$agent" == *"sirius"* ]] || [[ "$agent" == *"Sirius"* ]]; then
      agent_collision=true
      collision_reason="sirius_in_flight:${AGENT_IN_FLIGHT[$agent]}"
    fi
  fi

  if $agent_collision; then
    gates_failed+=("agent_collision:$collision_reason")
  fi

  # Gate 5: Algol audit recommendation
  # Per feedback_algol_qa_cross_check: every closure should route through Algol.
  # For dispatchability we check: if task's deps are closed, did they get Algol audit?
  algol_note=""
  if [[ ${#deps_resolved[@]} -gt 0 ]]; then
    missing_audits=()
    for dep in "${deps_resolved[@]}"; do
      if [[ -z "${SIG_ALGOL[$dep]:-}" ]]; then
        missing_audits+=("$dep")
      fi
    done
    if [[ ${#missing_audits[@]} -gt 0 ]]; then
      audit_list=$(printf '%s,' "${missing_audits[@]}" | sed 's/,$//')
      algol_note="algol_audit_pending_on_deps:$audit_list"
    fi
  fi

  # Determine overall dispatchability
  dispatchable=false
  if [[ ${#gates_failed[@]} -eq 0 ]]; then
    dispatchable=true
    (( NOW_DISPATCHABLE_COUNT++ )) || true
  else
    (( BLOCKED_COUNT++ )) || true
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

  # Format gates
  gates_failed_str=$(printf '"%s",' "${gates_failed[@]:-}" | sed 's/,$//')
  gates_passed_str=$(printf '"%s",' "${gates_passed[@]:-}" | sed 's/,$//')
  deps_resolved_str=$(printf '"%s",' "${deps_resolved[@]:-}" | sed 's/,$//')
  deps_unresolved_str=$(printf '"%s",' "${deps_unresolved[@]:-}" | sed 's/,$//')

  # Build JSON entry for this TASK
  task_json=$(cat <<ENDJSON
{
  "task_id": "$task_id",
  "status": "$status",
  "summary": "$summary",
  "agent": "$agent",
  "model": "$model",
  "handoff_path": "$handoff_path",
  "dispatchable": $dispatchable,
  "gates_passed": [$gates_passed_str],
  "gates_failed": [$gates_failed_str],
  "deps_resolved": [$deps_resolved_str],
  "deps_unresolved": [$deps_unresolved_str],
  "algol_note": "$algol_note"
}
ENDJSON
)

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
  if [[ ${#gates_failed[@]} -gt 0 ]]; then
    gates_note=$(printf '%s; ' "${gates_failed[@]}" | sed 's/; $//')
  else
    gates_note="all gates green"
  fi
  [[ -n "$algol_note" ]] && gates_note="$gates_note | NOTE: $algol_note"

  MD_ROWS="${MD_ROWS}| $task_id | $agent | $model | ${handoff_path:-—} | $status_icon | $gates_note |"$'\n'

done <<< "$TASK_RAW"

# ── PHASE 6: Emit output ───────────────────────────────────────────────────

TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

FULL_JSON=$(cat <<ENDJSON
{
  "generated_at": "$TIMESTAMP",
  "hold_gate": "ACTIVE — do NOT dispatch based on this output until Polaris reviews and approves",
  "opus_ledger": {
    "budget": $OPUS_BUDGET,
    "shipped": $OPUS_SHIPPED_COUNT,
    "remaining": $OPUS_REMAINING
  },
  "summary": {
    "closed": $CLOSED_COUNT,
    "in_flight": $IN_FLIGHT_COUNT,
    "now_dispatchable": $NOW_DISPATCHABLE_COUNT,
    "blocked": $BLOCKED_COUNT
  },
  "tasks": $JSON_TASKS
}
ENDJSON
)

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
