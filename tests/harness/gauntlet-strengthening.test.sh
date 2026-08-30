#!/usr/bin/env bash
# =============================================================================
# tests/harness/gauntlet-strengthening.test.sh
#
# Owner: Canopus (α-HRN-07) — TASK-2026-05-30-HARNESS-IS-OUGHT-SEPARATOR-B3B
# Purpose: targeted mutation tests for the 3 gauntlet-strengthening checks (a)(b)(c).
#
# Each case targets ONE specific invariant. Per A1 acceptance discipline:
#   - before.exit == 0  (baseline passes)
#   - after.exit != 0   (mutation fires)
#   - error message names the invariant that fired (not a different path)
#
# POLICY-NO-INPLACE-MUTATION: all mutations operate on ISOLATED FIXTURES in
# temp directories. No tracked file is mutated. The real scripts are invoked
# by passing modified inputs via temp-dir HTML files — NOT by modifying the
# scripts themselves.
#
# Cases:
#   A3a — overlap: baseline HTML has no overlap; mutation adds overlapping z-index element.
#          Absent from allowed-overlaps.json → overlap check fires naming the pair.
#   A3b — min-legible: baseline HTML has 16px text; mutation injects 8px font-size.
#          Below all legibility floors → min-legible check fires naming element+viewport+size.
#   A3c — sub-pixel: baseline manifest atom renders 40x40px; mutation shrinks to 0.3px.
#          Sub-pixel → sub-pixel check fires naming atom-id+variant+selector+computed-rect.
#
# Exit code: 0 = all three mutation cases fired correctly; non-zero = test failure.
# =============================================================================

set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
LOG_DIR="${REPO_ROOT}/.claude/hook-logs"
mkdir -p "${LOG_DIR}"

TASK_STUB="TASK-2026-05-30-HARNESS-IS-OUGHT-SEPARATOR-B3B"
TEST_LOG="${LOG_DIR}/${TASK_STUB}--gauntlet-mutation-tests.log"

PASS_ALL=true
CASE_COUNT=0
PASS_COUNT=0

log()      { echo "[gauntlet-test] $*" | tee -a "${TEST_LOG}"; }
log_case() { echo "" | tee -a "${TEST_LOG}"; echo "=== CASE $* ===" | tee -a "${TEST_LOG}"; }
log_pass() { echo "  RESULT: PASS — $*" | tee -a "${TEST_LOG}"; }
log_fail() { echo "  RESULT: FAIL — $*" | tee -a "${TEST_LOG}" >&2; PASS_ALL=false; }

# ── Global temp-dir and pid registry + trap ──────────────────────────────────
# POLICY-NO-INPLACE-MUTATION: registers all mktemp dirs for cleanup at exit.
# No tracked file is ever modified — all mutations are in temp HTML fixtures.
_TEST_TMPDIRS=()
_TEST_PIDS=()

_test_cleanup() {
  local d pid
  for pid in "${_TEST_PIDS[@]:-}"; do
    [[ -n "${pid}" ]] && kill "${pid}" 2>/dev/null || true
  done
  for d in "${_TEST_TMPDIRS[@]:-}"; do
    [[ -n "${d}" && -d "${d}" ]] && rm -rf "${d}" || true
  done
  return 0
}
trap '_test_cleanup' EXIT INT TERM HUP

_mktemp_tracked() {
  local d
  d=$(mktemp -d)
  _TEST_TMPDIRS+=("${d}")
  echo "${d}"
}

# Helper: find a free port in the given range
# Usage: _free_port <start> <end>
_free_port() {
  local start="${1:-8900}" end="${2:-8999}"
  python3 -c "
import socket
for p in range(${start}, ${end}):
    try:
        s = socket.socket()
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind(('127.0.0.1', p))
        s.close()
        print(p)
        break
    except OSError:
        pass
"
}

# Helper: start HTTP server and wait for it to serve HTTP responses (not just TCP).
# Uses separate port ranges per case to avoid Playwright disk-cache collisions
# (Playwright caches by URL — same localhost:PORT would reuse cached baseline HTML
# when served as mutation, causing false-GREEN on the mutation assertion).
# Sets _CURRENT_HTTP_PID to the server's PID.
_start_server() {
  local dir="$1"
  local port="$2"
  python3 -m http.server "${port}" --directory "${dir}" >/dev/null 2>&1 &
  _CURRENT_HTTP_PID=$!
  _TEST_PIDS+=("${_CURRENT_HTTP_PID}")
  # Wait up to 5 seconds for the server to serve an actual HTTP 200
  # TCP connectivity is necessary but not sufficient — poll with curl instead.
  local i
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if curl -sf "http://127.0.0.1:${port}/" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done
  log "  WARN: HTTP server on port ${port} did not become ready in time"
  return 1
}

_stop_server() {
  local pid="$1"
  kill "${pid}" 2>/dev/null || true
  wait "${pid}" 2>/dev/null || true
}

log "start · $(date -u +%Y-%m-%dT%H:%M:%SZ)"
log "repo_root=${REPO_ROOT}"

if ! command -v npx &>/dev/null; then
  log "WARN: npx not available — skipping mutation tests"
  exit 0
fi

# ── A3a: Overlap/Composition Mutation ────────────────────────────────────────
# Baseline and mutation use DIFFERENT ports to avoid Playwright's disk-cache
# reusing the cached mutation page when serving baseline on the same origin.
log_case "A3a — overlap/composition mutation"
CASE_COUNT=$((CASE_COUNT + 1))

TMPDIR_A3A_BASE=$(_mktemp_tracked)
TMPDIR_A3A_MUT=$(_mktemp_tracked)
PORT_A3A_BASE=$(_free_port 8910 8929)
PORT_A3A_MUT=$(_free_port 8930 8949)

# Empty allowed-overlaps manifest
cat > "${TMPDIR_A3A_BASE}/ao.json" << 'ALLOWED_JSON'
{"allowed_overlaps": []}
ALLOWED_JSON
cat > "${TMPDIR_A3A_MUT}/ao.json" << 'ALLOWED_JSON'
{"allowed_overlaps": []}
ALLOWED_JSON

# BASELINE fixture: two divs at DIFFERENT vertical positions — NO overlap
cat > "${TMPDIR_A3A_BASE}/index.html" << 'BASELINE_HTML'
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>A3a baseline</title>
<style>
  #el-a { position: absolute; top: 0; left: 0; width: 100px; height: 100px; z-index: 1; background: red; }
  #el-b { position: absolute; top: 200px; left: 0; width: 100px; height: 100px; z-index: 2; background: blue; }
</style></head><body>
<div id="el-a">A</div>
<div id="el-b">B — no overlap (200px below A)</div>
</body></html>
BASELINE_HTML

# MUTATION fixture: el-b overlaps el-a AND has higher z-index — NOT in allowed-overlaps
cat > "${TMPDIR_A3A_MUT}/index.html" << 'MUTATION_HTML'
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>A3a mutation</title>
<style>
  #el-a { position: absolute; top: 0; left: 0; width: 100px; height: 100px; z-index: 1; background: red; }
  #el-b { position: absolute; top: 50px; left: 50px; width: 100px; height: 100px; z-index: 2; background: blue; }
</style></head><body>
<div id="el-a">A</div>
<div id="el-b">B — OVERLAPS A (z:2 over z:1, NOT in allowed-overlaps)</div>
</body></html>
MUTATION_HTML

_start_server "${TMPDIR_A3A_BASE}" "${PORT_A3A_BASE}"
A3A_BASE_PID="${_CURRENT_HTTP_PID}"

_start_server "${TMPDIR_A3A_MUT}" "${PORT_A3A_MUT}"
A3A_MUT_PID="${_CURRENT_HTTP_PID}"

set +e
BEFORE_OUTPUT_A3A=$(echo "{\"page_url\": \"http://localhost:${PORT_A3A_BASE}\", \"allowed_overlaps_path\": \"${TMPDIR_A3A_BASE}/ao.json\"}" \
  | npx tsx "${REPO_ROOT}/scripts/audit-gauntlet-overlap.ts" 2>&1)
BEFORE_EXIT_A3A=$?
set -e
log "  A3a before.exit=${BEFORE_EXIT_A3A}"

if [[ $BEFORE_EXIT_A3A -eq 3 ]]; then
  log_fail "A3a — Playwright unavailable; required CI mutation coverage cannot skip"
  _stop_server "${A3A_BASE_PID}"
  _stop_server "${A3A_MUT_PID}"
elif [[ $BEFORE_EXIT_A3A -eq 2 ]]; then
  log "A3a: baseline returned exit 2 (connection/input error)"
  log "  Output: ${BEFORE_OUTPUT_A3A}"
  log_fail "A3a — baseline failed with exit 2 (server/connection issue)"
  _stop_server "${A3A_BASE_PID}"
  _stop_server "${A3A_MUT_PID}"
else
  # Playwright available — test full mutation path (mutation served from different port/origin)
  set +e
  AFTER_OUTPUT_A3A=$(echo "{\"page_url\": \"http://localhost:${PORT_A3A_MUT}\", \"allowed_overlaps_path\": \"${TMPDIR_A3A_MUT}/ao.json\"}" \
    | npx tsx "${REPO_ROOT}/scripts/audit-gauntlet-overlap.ts" 2>&1)
  AFTER_EXIT_A3A=$?
  set -e
  log "  A3a after.exit=${AFTER_EXIT_A3A}"

  _stop_server "${A3A_BASE_PID}"
  _stop_server "${A3A_MUT_PID}"

  A3A_PASS=true
  if [[ $BEFORE_EXIT_A3A -ne 0 ]]; then
    log "  ASSERT FAIL: before.exit=${BEFORE_EXIT_A3A} expected 0"
    log "  BEFORE_OUTPUT: ${BEFORE_OUTPUT_A3A}"
    A3A_PASS=false
  fi
  if [[ $AFTER_EXIT_A3A -eq 0 ]]; then
    log "  ASSERT FAIL: after.exit=0 expected non-zero (mutation should fire)"
    A3A_PASS=false
  fi
  if ! echo "${AFTER_OUTPUT_A3A}" | grep -q "A3a\|UNLISTED\|overlap"; then
    log "  ASSERT FAIL: error output does not name the overlap invariant"
    log "  AFTER_OUTPUT: ${AFTER_OUTPUT_A3A}"
    A3A_PASS=false
  fi

  if [[ "$A3A_PASS" == "true" ]]; then
    log_pass "A3a — before.exit=0, after.exit=${AFTER_EXIT_A3A} (non-zero), error names overlap invariant"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    log_fail "A3a — assertion failed (see above)"
  fi
fi

# ── A3b: Min-Legible-Size Mutation ───────────────────────────────────────────
log_case "A3b — min-legible-size mutation"
CASE_COUNT=$((CASE_COUNT + 1))

TMPDIR_A3B_BASE=$(_mktemp_tracked)
TMPDIR_A3B_MUT=$(_mktemp_tracked)
PORT_A3B_BASE=$(_free_port 8950 8969)
PORT_A3B_MUT=$(_free_port 8970 8989)

# BASELINE fixture: text at 16px (well above all floors including NARROW=11px)
cat > "${TMPDIR_A3B_BASE}/index.html" << 'BASELINE_HTML_B'
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>A3b baseline</title>
<style>
  button { font-size: 16px; padding: 8px 16px; display: inline-block; }
</style></head><body>
<button id="primary-action">OPEN ATLAS</button>
<p style="font-size: 16px;">text element at 16px</p>
</body></html>
BASELINE_HTML_B

# MUTATION fixture: font-size: 8px (below NARROW=11px AND all floors)
cat > "${TMPDIR_A3B_MUT}/index.html" << 'MUTATION_HTML_B'
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>A3b mutation</title>
<style>
  button { font-size: 8px; padding: 4px 8px; display: inline-block; }
</style></head><body>
<button id="primary-action">OPEN ATLAS (8px — BELOW ALL LEGIBILITY FLOORS)</button>
<p style="font-size: 8px;">text at 8px — below floor</p>
</body></html>
MUTATION_HTML_B

_start_server "${TMPDIR_A3B_BASE}" "${PORT_A3B_BASE}"
A3B_BASE_PID="${_CURRENT_HTTP_PID}"

_start_server "${TMPDIR_A3B_MUT}" "${PORT_A3B_MUT}"
A3B_MUT_PID="${_CURRENT_HTTP_PID}"

set +e
BEFORE_OUTPUT_A3B=$(echo "{\"page_url\": \"http://localhost:${PORT_A3B_BASE}\"}" \
  | npx tsx "${REPO_ROOT}/scripts/audit-gauntlet-min-legible.ts" 2>&1)
BEFORE_EXIT_A3B=$?
set -e
log "  A3b before.exit=${BEFORE_EXIT_A3B}"

if [[ $BEFORE_EXIT_A3B -eq 3 ]]; then
  log_fail "A3b — Playwright unavailable; required CI mutation coverage cannot skip"
  _stop_server "${A3B_BASE_PID}"
  _stop_server "${A3B_MUT_PID}"
elif [[ $BEFORE_EXIT_A3B -eq 2 ]]; then
  log "A3b: baseline returned exit 2"
  log "  Output: ${BEFORE_OUTPUT_A3B}"
  log_fail "A3b — baseline failed with exit 2"
  _stop_server "${A3B_BASE_PID}"
  _stop_server "${A3B_MUT_PID}"
else
  set +e
  AFTER_OUTPUT_A3B=$(echo "{\"page_url\": \"http://localhost:${PORT_A3B_MUT}\"}" \
    | npx tsx "${REPO_ROOT}/scripts/audit-gauntlet-min-legible.ts" 2>&1)
  AFTER_EXIT_A3B=$?
  set -e
  log "  A3b after.exit=${AFTER_EXIT_A3B}"

  _stop_server "${A3B_BASE_PID}"
  _stop_server "${A3B_MUT_PID}"

  A3B_PASS=true
  if [[ $BEFORE_EXIT_A3B -ne 0 ]]; then
    log "  ASSERT FAIL: before.exit=${BEFORE_EXIT_A3B} expected 0"
    log "  BEFORE_OUTPUT: ${BEFORE_OUTPUT_A3B}"
    A3B_PASS=false
  fi
  if [[ $AFTER_EXIT_A3B -eq 0 ]]; then
    log "  ASSERT FAIL: after.exit=0 expected non-zero"
    log "  AFTER_OUTPUT: ${AFTER_OUTPUT_A3B}"
    A3B_PASS=false
  fi
  if ! echo "${AFTER_OUTPUT_A3B}" | grep -q "A3b\|BELOW_LEGIBILITY_FLOOR\|floor\|font-size"; then
    log "  ASSERT FAIL: error output does not name the min-legible invariant"
    log "  AFTER_OUTPUT: ${AFTER_OUTPUT_A3B}"
    A3B_PASS=false
  fi

  if [[ "$A3B_PASS" == "true" ]]; then
    log_pass "A3b — before.exit=0, after.exit=${AFTER_EXIT_A3B} (non-zero), error names legibility invariant"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    log_fail "A3b — assertion failed (see above)"
  fi
fi

# ── A3c: Sub-Pixel / Zero-Size Mutation ──────────────────────────────────────
log_case "A3c — sub-pixel/zero-size mutation"
CASE_COUNT=$((CASE_COUNT + 1))

TMPDIR_A3C_BASE=$(_mktemp_tracked)
TMPDIR_A3C_MUT=$(_mktemp_tracked)
PORT_A3C_BASE=$(_free_port 8820 8839)
PORT_A3C_MUT=$(_free_port 8840 8859)

# Minimal manifest: 1 atom, 1 variant (used by BOTH baseline and mutation servers)
cat > "${TMPDIR_A3C_BASE}/manifest.json" << 'MANIFEST_JSON'
{
  "schema_version": 2,
  "atoms": [
    {
      "id": "test-atom",
      "render": "#atom-test-element",
      "variants": [
        { "name": "default", "description": "default state" }
      ]
    }
  ]
}
MANIFEST_JSON
cp "${TMPDIR_A3C_BASE}/manifest.json" "${TMPDIR_A3C_MUT}/manifest.json"

# BASELINE: atom renders at 40x40px (well above 1x1px floor)
cat > "${TMPDIR_A3C_BASE}/index.html" << 'BASELINE_HTML_C'
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>A3c baseline</title>
<style>
  #atom-test-element { width: 40px; height: 40px; background: orange; display: block; }
</style></head><body>
<div id="atom-test-element">atom</div>
</body></html>
BASELINE_HTML_C

# MUTATION: shrink the render element to 0.3px (sub-pixel, manifest claims visible)
cat > "${TMPDIR_A3C_MUT}/index.html" << 'MUTATION_HTML_C'
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>A3c mutation</title>
<style>
  #atom-test-element { width: 0.3px; height: 0.3px; background: orange; display: block; overflow: hidden; }
</style></head><body>
<div id="atom-test-element">atom — SUB-PIXEL 0.3x0.3px</div>
</body></html>
MUTATION_HTML_C

_start_server "${TMPDIR_A3C_BASE}" "${PORT_A3C_BASE}"
A3C_BASE_PID="${_CURRENT_HTTP_PID}"

_start_server "${TMPDIR_A3C_MUT}" "${PORT_A3C_MUT}"
A3C_MUT_PID="${_CURRENT_HTTP_PID}"

set +e
BEFORE_OUTPUT_A3C=$(echo "{\"gallery_url\": \"http://localhost:${PORT_A3C_BASE}\", \"manifest_path\": \"${TMPDIR_A3C_BASE}/manifest.json\"}" \
  | npx tsx "${REPO_ROOT}/scripts/audit-gauntlet-sub-pixel.ts" 2>&1)
BEFORE_EXIT_A3C=$?
set -e
log "  A3c before.exit=${BEFORE_EXIT_A3C}"

if [[ $BEFORE_EXIT_A3C -eq 3 ]]; then
  log_fail "A3c — Playwright unavailable; required CI mutation coverage cannot skip"
  _stop_server "${A3C_BASE_PID}"
  _stop_server "${A3C_MUT_PID}"
elif [[ $BEFORE_EXIT_A3C -eq 2 ]]; then
  log "A3c: baseline returned exit 2"
  log "  Output: ${BEFORE_OUTPUT_A3C}"
  log_fail "A3c — baseline failed with exit 2"
  _stop_server "${A3C_BASE_PID}"
  _stop_server "${A3C_MUT_PID}"
else
  set +e
  AFTER_OUTPUT_A3C=$(echo "{\"gallery_url\": \"http://localhost:${PORT_A3C_MUT}\", \"manifest_path\": \"${TMPDIR_A3C_MUT}/manifest.json\"}" \
    | npx tsx "${REPO_ROOT}/scripts/audit-gauntlet-sub-pixel.ts" 2>&1)
  AFTER_EXIT_A3C=$?
  set -e
  log "  A3c after.exit=${AFTER_EXIT_A3C}"

  _stop_server "${A3C_BASE_PID}"
  _stop_server "${A3C_MUT_PID}"

  A3C_PASS=true
  if [[ $BEFORE_EXIT_A3C -ne 0 ]]; then
    log "  ASSERT FAIL: before.exit=${BEFORE_EXIT_A3C} expected 0"
    log "  BEFORE_OUTPUT: ${BEFORE_OUTPUT_A3C}"
    A3C_PASS=false
  fi
  if [[ $AFTER_EXIT_A3C -eq 0 ]]; then
    log "  ASSERT FAIL: after.exit=0 expected non-zero"
    A3C_PASS=false
  fi
  if ! echo "${AFTER_OUTPUT_A3C}" | grep -q "A3c\|SUB_PIXEL\|sub_pixel\|sub-pixel\|test-atom"; then
    log "  ASSERT FAIL: error output does not name the sub-pixel invariant"
    log "  AFTER_OUTPUT: ${AFTER_OUTPUT_A3C}"
    A3C_PASS=false
  fi

  if [[ "$A3C_PASS" == "true" ]]; then
    log_pass "A3c — before.exit=0, after.exit=${AFTER_EXIT_A3C} (non-zero), error names sub-pixel invariant"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    log_fail "A3c — assertion failed (see above)"
  fi
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "" >> "${TEST_LOG}" || true
log "=== SUMMARY: ${PASS_COUNT}/${CASE_COUNT} cases passed ==="
log "end · $(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [[ "$PASS_COUNT" -ne "$CASE_COUNT" ]]; then
  PASS_ALL=false
fi

if [[ "$PASS_ALL" == "true" ]]; then
  log "OVERALL: PASS — all gauntlet mutation cases fired correctly"
  _FINAL_EXIT=0
else
  log "OVERALL: FAIL — one or more cases failed (see above)"
  _FINAL_EXIT=1
fi

# Explicit cleanup before exit so trap does not interfere with exit code
_test_cleanup
trap - EXIT INT TERM HUP
exit "${_FINAL_EXIT}"
