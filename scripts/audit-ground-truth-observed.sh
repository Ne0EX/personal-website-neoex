#!/usr/bin/env bash
# =============================================================================
# scripts/audit-ground-truth-observed.sh
#
# Rail: ground-truth-observed
# Owner: Algol (α-VER-06)
# Introduced: TASK-2026-06-01-SECURITY-HARNESS-SENSOR-GROUND-TRUTH
#
# PROBLEM THIS GATE SEALS:
#   "build green + 200" was accepted as DONE. Nobody actually opened /archive
#   to see it was broken. A proxy signal (CI green, HTTP 200) was mistaken for
#   an anchor (human-observed render). This gate refuses DONE unless a human
#   (or automated headless observer) has produced a cryptographically-linked
#   screenshot and acknowledged it.
#
# INVARIANT:
#   A TASK cannot close DONE for a shipped route unless an observed artifact
#   exists:
#     .claude/visual-diffs/<task_id>/observed/<route>.png
#     .claude/visual-diffs/<task_id>/observed/observed.json
#   where observed.json contains:
#     {
#       "route":    "<route>",
#       "sha256":   "<sha256 of the .png>",
#       "viewport": { "width": <int>, "height": <int> },
#       "ack":      true,
#       "observed_at": "<ISO-8601 timestamp>"   [required if task window supplied]
#     }
#
#   The gate asserts:
#     (A) PNG file exists
#     (B) observed.json exists and is valid JSON
#     (C) observed.json contains an entry for this route with ack:true
#     (D) The sha256 in observed.json matches the actual sha256 of the PNG
#     (E) If a task window is supplied (started_at / completed_at), the PNG's
#         mtime AND the observed_at timestamp in observed.json must both fall
#         within the window. A screenshot predating task start or postdating
#         task end is stale with respect to this task.
#
# INPUT: task manifest at:
#     .claude/visual-diffs/<task_id>/task-manifest.json
#   (or override via WL_TASK_MANIFEST env var)
#
# task-manifest.json schema (minimal):
#   {
#     "task_id":     "<TASK-ID>",
#     "shipped_routes": ["/route1", "/route2"],
#     "started_at":  "<ISO-8601>",   [optional — enables staleness check]
#     "completed_at": "<ISO-8601>"   [optional — enables staleness check]
#   }
#
# observed.json schema (per task, inside observed/):
#   {
#     "routes": [
#       {
#         "route":       "/archive",
#         "sha256":      "abcdef...",
#         "viewport":    { "width": 1280, "height": 800 },
#         "ack":         true,
#         "observed_at": "2026-06-01T12:00:00Z"
#       }
#     ]
#   }
#
# Exit codes:
#   0  — PASS: all shipped routes have verified, non-stale observed artifacts
#   1  — FAIL: one or more routes missing observed artifact, sha-mismatch, or stale
#   2  — FAIL: task manifest not found or not valid JSON
#   3  — FAIL: task manifest has no shipped_routes (empty list = gate cannot confirm done)
#   4  — FAIL: observed.json not found or not valid JSON (when routes ARE declared)
#   5  — FAIL: script invocation error (usage)
#
# Usage:
#   bash scripts/audit-ground-truth-observed.sh <task_id>
#   WL_TASK_MANIFEST=/path/to/manifest.json bash scripts/audit-ground-truth-observed.sh <task_id>
#   bash scripts/audit-ground-truth-observed.sh <task_id> --verbose
#
# CARDINAL RULE: this script must NEVER exit 0 silently when a violation exists.
#   The exit-0-always bug is the failure mode this harness exists to kill.
#   Every code path that reaches exit 0 must have passed all assertions positively.
# =============================================================================

set -uo pipefail

# ── argument handling ─────────────────────────────────────────────────────────
TASK_ID="${1:-}"
VERBOSE="${2:-}"

if [[ -z "${TASK_ID}" ]]; then
  echo "[ground-truth-observed] ERROR: usage: $0 <task_id> [--verbose]" >&2
  echo "[ground-truth-observed] Or set WL_TASK_ID in env." >&2
  # Allow env fallback
  TASK_ID="${WL_TASK_ID:-}"
  if [[ -z "${TASK_ID}" ]]; then
    exit 5
  fi
fi

# ── paths ─────────────────────────────────────────────────────────────────────
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
LOG_DIR="${REPO_ROOT}/.claude/hook-logs"
mkdir -p "${LOG_DIR}"
LOG_FILE="${LOG_DIR}/${TASK_ID}--ground-truth-observed.log"

VISUAL_DIFFS_BASE="${REPO_ROOT}/.claude/visual-diffs"
TASK_DIFF_DIR="${VISUAL_DIFFS_BASE}/${TASK_ID}"

# WL_TASK_MANIFEST: override the manifest path (used by tests pointing at temp dirs).
# WL_OBSERVED_DIR:  override the observed/ directory (used by tests pointing at temp dirs).
# When WL_OBSERVED_DIR is set, the observed.json and PNGs are read from that path.
# Neither override should ever be set in production; they are test-seam env vars only.
TASK_MANIFEST="${WL_TASK_MANIFEST:-${TASK_DIFF_DIR}/task-manifest.json}"
OBSERVED_DIR="${WL_OBSERVED_DIR:-${TASK_DIFF_DIR}/observed}"
OBSERVED_JSON="${OBSERVED_DIR}/observed.json"

# ── logging helpers ───────────────────────────────────────────────────────────
mkdir -p "${LOG_DIR}"
log()     { echo "[ground-truth-observed] $*" | tee -a "${LOG_FILE}"; }
log_v()   {
  if [[ "${VERBOSE}" == "--verbose" ]]; then
    echo "[ground-truth-observed] $*" | tee -a "${LOG_FILE}"
  else
    echo "[ground-truth-observed] $*" >> "${LOG_FILE}"
  fi
}
log_err() { echo "[ground-truth-observed] ERROR: $*" | tee -a "${LOG_FILE}" >&2; }

log "start · task=${TASK_ID} · $(date -u +%Y-%m-%dT%H:%M:%SZ)"
log_v "manifest=${TASK_MANIFEST}"
log_v "observed_dir=${OBSERVED_DIR}"

# ── P1: task manifest must exist ─────────────────────────────────────────────
if [[ ! -f "${TASK_MANIFEST}" ]]; then
  log_err "task manifest not found: ${TASK_MANIFEST}"
  log_err "Create .claude/visual-diffs/${TASK_ID}/task-manifest.json listing shipped_routes."
  log "FAIL (exit 2)"
  exit 2
fi

# ── P2: task manifest must be valid JSON ─────────────────────────────────────
if ! jq empty "${TASK_MANIFEST}" 2>/dev/null; then
  log_err "task manifest is not valid JSON: ${TASK_MANIFEST}"
  log "FAIL (exit 2)"
  exit 2
fi

log_v "task manifest valid JSON"

# ── P3: shipped_routes must be non-empty ─────────────────────────────────────
ROUTE_COUNT=$(jq '.shipped_routes | length' "${TASK_MANIFEST}" 2>/dev/null || echo 0)
if [[ "${ROUTE_COUNT}" -eq 0 ]]; then
  log_err "task manifest has no shipped_routes (or shipped_routes is empty)"
  log_err "A task with no declared shipped routes cannot have its observability confirmed."
  log_err "Add shipped_routes to ${TASK_MANIFEST}."
  log "FAIL (exit 3)"
  exit 3
fi

log "shipped_routes: ${ROUTE_COUNT} route(s) declared"

# ── P4: observed.json must exist ─────────────────────────────────────────────
if [[ ! -f "${OBSERVED_JSON}" ]]; then
  log_err "observed.json not found: ${OBSERVED_JSON}"
  log_err "No observed artifacts for task ${TASK_ID}."
  log_err "Capture a screenshot + produce observed.json before closing DONE."
  log "FAIL (exit 4)"
  exit 4
fi

# ── P5: observed.json must be valid JSON ─────────────────────────────────────
if ! jq empty "${OBSERVED_JSON}" 2>/dev/null; then
  log_err "observed.json is not valid JSON: ${OBSERVED_JSON}"
  log "FAIL (exit 4)"
  exit 4
fi

log_v "observed.json valid JSON"

# ── Extract task window (optional, for staleness check) ───────────────────────
TASK_STARTED_AT=$(jq -r '.started_at // ""' "${TASK_MANIFEST}" 2>/dev/null || true)
TASK_COMPLETED_AT=$(jq -r '.completed_at // ""' "${TASK_MANIFEST}" 2>/dev/null || true)

WINDOW_CHECK=false
WINDOW_START_EPOCH=0
WINDOW_END_EPOCH=0

if [[ -n "${TASK_STARTED_AT}" && -n "${TASK_COMPLETED_AT}" ]]; then
  # Convert ISO-8601 to epoch for comparison.
  # date -d works on Linux; date -j -f works on macOS. Try both.
  _iso_to_epoch() {
    local iso="$1"
    # Try GNU date first; fall back to macOS date; fall back to python3.
    if date -d "${iso}" +%s 2>/dev/null; then
      return 0
    elif date -j -f '%Y-%m-%dT%H:%M:%SZ' "${iso}" +%s 2>/dev/null; then
      return 0
    else
      python3 -c "
import sys
from datetime import datetime, timezone
s = sys.argv[1].rstrip('Z')
# handle +HH:MM offset or bare Z
try:
    dt = datetime.fromisoformat(s.replace('Z','+00:00'))
except ValueError:
    dt = datetime.strptime(s, '%Y-%m-%dT%H:%M:%S').replace(tzinfo=timezone.utc)
print(int(dt.timestamp()))
" "${iso}" 2>/dev/null || echo 0
    fi
  }

  WINDOW_START_EPOCH=$(_iso_to_epoch "${TASK_STARTED_AT}" 2>/dev/null || echo 0)
  WINDOW_END_EPOCH=$(_iso_to_epoch "${TASK_COMPLETED_AT}" 2>/dev/null || echo 0)

  if [[ "${WINDOW_START_EPOCH}" -gt 0 && "${WINDOW_END_EPOCH}" -gt 0 ]]; then
    WINDOW_CHECK=true
    log_v "staleness window: ${TASK_STARTED_AT} → ${TASK_COMPLETED_AT} (epoch ${WINDOW_START_EPOCH}–${WINDOW_END_EPOCH})"
  else
    log_v "staleness check: could not parse task window timestamps — skipping staleness assertion"
  fi
fi

# ── Per-route assertion loop ──────────────────────────────────────────────────
FAIL=0

while IFS= read -r route; do
  [[ -z "${route}" ]] && continue

  # Sanitise route to a filesystem-safe filename:
  #   /archive           → archive.png
  #   /photos/2026       → photos_2026.png
  #   /                  → root.png
  # Leading slash stripped; remaining slashes replaced with underscores.
  if [[ "${route}" == "/" ]]; then
    ROUTE_SLUG="root"
  else
    ROUTE_SLUG="${route#/}"           # strip leading /
    ROUTE_SLUG="${ROUTE_SLUG//\//_}"  # replace inner / with _
  fi

  PNG_PATH="${OBSERVED_DIR}/${ROUTE_SLUG}.png"

  log_v "checking route='${route}' slug='${ROUTE_SLUG}'"

  # ── A: PNG must exist ──────────────────────────────────────────────────────
  if [[ ! -f "${PNG_PATH}" ]]; then
    log_err "[A] route '${route}': PNG not found at ${PNG_PATH}"
    FAIL=1
    continue  # remaining checks require the file; skip to next route
  fi

  log_v "[A] route '${route}': PNG exists"

  # ── B+C: observed.json must have an entry for this route with ack:true ──────
  ENTRY=$(jq -c --arg r "${route}" '.routes[] | select(.route == $r)' "${OBSERVED_JSON}" 2>/dev/null || true)
  if [[ -z "${ENTRY}" ]]; then
    log_err "[B] route '${route}': no entry in observed.json for this route"
    log_err "  Add {route:'${route}', sha256:'...', viewport:{...}, ack:true, observed_at:'...'} to ${OBSERVED_JSON}"
    FAIL=1
    continue
  fi

  ACK=$(echo "${ENTRY}" | jq -r '.ack // false' 2>/dev/null || echo "false")
  if [[ "${ACK}" != "true" ]]; then
    log_err "[C] route '${route}': ack is not true in observed.json (got: ${ACK})"
    log_err "  Set .ack = true in the observed.json entry for route '${route}' to confirm observation."
    FAIL=1
    continue
  fi

  log_v "[B+C] route '${route}': observed.json entry present, ack=true"

  # ── D: sha256 in observed.json must match actual PNG sha256 ──────────────
  CLAIMED_SHA=$(echo "${ENTRY}" | jq -r '.sha256 // ""' 2>/dev/null || true)
  if [[ -z "${CLAIMED_SHA}" ]]; then
    log_err "[D] route '${route}': sha256 field missing from observed.json entry"
    FAIL=1
    continue
  fi

  ACTUAL_SHA=$(sha256sum "${PNG_PATH}" | awk '{print $1}')
  if [[ "${ACTUAL_SHA}" != "${CLAIMED_SHA}" ]]; then
    log_err "[D] route '${route}': sha256 MISMATCH"
    log_err "  claimed:  ${CLAIMED_SHA}"
    log_err "  actual:   ${ACTUAL_SHA}"
    log_err "  The PNG at ${PNG_PATH} does not match the hash in observed.json."
    log_err "  Either the screenshot was replaced after ack, or the hash was entered incorrectly."
    FAIL=1
    continue
  fi

  log_v "[D] route '${route}': sha256 match (${ACTUAL_SHA:0:16}...)"

  # ── E: staleness check (only when task window is available) ──────────────
  if [[ "${WINDOW_CHECK}" == "true" ]]; then
    # E1: PNG mtime must be within the task window
    PNG_MTIME=$(python3 -c "import os; print(int(os.path.getmtime('${PNG_PATH}')))" 2>/dev/null || echo 0)

    if [[ "${PNG_MTIME}" -lt "${WINDOW_START_EPOCH}" ]]; then
      log_err "[E1] route '${route}': PNG mtime ${PNG_MTIME} predates task start ${WINDOW_START_EPOCH} (${TASK_STARTED_AT})"
      log_err "  The screenshot was taken before this task began — it cannot verify this task's output."
      log_err "  Recapture the screenshot during task execution."
      FAIL=1
      continue
    fi

    if [[ "${PNG_MTIME}" -gt "${WINDOW_END_EPOCH}" ]]; then
      log_err "[E1] route '${route}': PNG mtime ${PNG_MTIME} is after task end ${WINDOW_END_EPOCH} (${TASK_COMPLETED_AT})"
      log_err "  The screenshot was taken after the task closed — the task was marked done before observing."
      log_err "  Recapture the screenshot during task execution, then re-sign."
      FAIL=1
      continue
    fi

    # E2: observed_at timestamp in observed.json must be within the task window
    OBSERVED_AT=$(echo "${ENTRY}" | jq -r '.observed_at // ""' 2>/dev/null || true)
    if [[ -z "${OBSERVED_AT}" ]]; then
      log_err "[E2] route '${route}': observed_at field missing from observed.json entry"
      log_err "  When a task window is declared, observed_at is required to prove the screenshot"
      log_err "  was taken during this task's execution window."
      FAIL=1
      continue
    fi

    OBSERVED_AT_EPOCH=$(_iso_to_epoch "${OBSERVED_AT}" 2>/dev/null || echo 0)

    if [[ "${OBSERVED_AT_EPOCH}" -lt "${WINDOW_START_EPOCH}" ]]; then
      log_err "[E2] route '${route}': observed_at '${OBSERVED_AT}' predates task start '${TASK_STARTED_AT}'"
      log_err "  The observation timestamp in observed.json is before this task began — stale artifact."
      FAIL=1
      continue
    fi

    if [[ "${OBSERVED_AT_EPOCH}" -gt "${WINDOW_END_EPOCH}" ]]; then
      log_err "[E2] route '${route}': observed_at '${OBSERVED_AT}' is after task end '${TASK_COMPLETED_AT}'"
      log_err "  Observation claimed after task was marked done — close order violated."
      FAIL=1
      continue
    fi

    log_v "[E] route '${route}': mtime and observed_at both within task window"
  fi

  log "route '${route}': ALL CHECKS PASS"

done < <(jq -r '.shipped_routes[]' "${TASK_MANIFEST}" 2>/dev/null)

# ── Final verdict ─────────────────────────────────────────────────────────────
if [[ "${FAIL}" -ne 0 ]]; then
  log "FAIL — one or more shipped routes lack verified observed artifacts"
  log "  Routes without valid observed artifacts cannot be accepted as DONE."
  log "  See errors above. Fix: capture screenshots + populate observed.json."
  exit 1
fi

log "PASS — all ${ROUTE_COUNT} shipped route(s) have verified, non-stale observed artifacts"
exit 0
