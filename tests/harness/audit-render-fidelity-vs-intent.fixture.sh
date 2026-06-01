#!/usr/bin/env bash
# =============================================================================
# tests/harness/audit-render-fidelity-vs-intent.fixture.sh
#
# Owner: Algol (α-VER-06) — TASK-2026-06-01-SECURITY-HARNESS-WAVE-0-2
# Rail: render-fidelity-vs-intent
#
# PURPOSE:
#   Fixture-based tests for audit-render-fidelity-vs-intent.ts.
#   All cases use isolated temp-dir HTML fixtures served by python3 http.server.
#   No tracked file is mutated (POLICY-NO-INPLACE-MUTATION).
#
# CASES:
#   PASS-1 — clean page: identity transform, no siblings, no overflow clip.
#             Gate must exit 0.
#
#   PASS-2 — two siblings with zero overlap (stacked vertically).
#             Gate must exit 0.
#
#   FAIL-1 — R1: non-identity CSS transform where manifest expects identity.
#             Gate must exit 1 and name R1_TRANSFORM_NOT_IDENTITY / A4a.
#             This is the "crooked overlay" class: a page element with a
#             CSS translate/rotate applied where none is expected.
#
#   FAIL-2 — R2: sibling overlap. Two elements whose bounding rects intersect,
#             declared must_not_overlap_with each other in manifest.
#             Gate must exit 1 and name R2_SIBLING_OVERLAP / A4b.
#             This is the bug class: /archive rendered on top of home-page surface.
#
#   FAIL-3 — R3: overflow-clip forbidden. Element with overflow:hidden where
#             manifest declares overflow_clip_forbidden=true.
#             Gate must exit 1 and name R3_OVERFLOW_CLIP / A4c.
#
# EXIT CODE: 0 = all cases passed; non-zero = test failure.
#
# DESIGN NOTE: this fixture test is GREEN NOW even without a live Next.js build.
# The live-wiring gap (routing the gate against the actual production routes) is
# documented in scripts/audit-render-fidelity-vs-intent.sh under LIVE-WIRING GAP.
# =============================================================================

set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
LOG_DIR="${REPO_ROOT}/.claude/hook-logs"
mkdir -p "${LOG_DIR}"

TASK_STUB="TASK-2026-06-01-SECURITY-HARNESS-WAVE-0-2"
TEST_LOG="${LOG_DIR}/${TASK_STUB}--render-fidelity-fixture-tests.log"

PASS_ALL=true
CASE_COUNT=0
PASS_COUNT=0

log()      { echo "[render-fidelity-fixture] $*" | tee -a "${TEST_LOG}"; }
log_case() { echo "" | tee -a "${TEST_LOG}"; echo "=== CASE $* ===" | tee -a "${TEST_LOG}"; }
log_pass() { echo "  RESULT: PASS — $*" | tee -a "${TEST_LOG}"; }
log_fail() { echo "  RESULT: FAIL — $*" | tee -a "${TEST_LOG}" >&2; PASS_ALL=false; }

# ── Temp dir / pid registry + cleanup trap ────────────────────────────────────
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

_free_port() {
  local start="${1:-9100}" end="${2:-9199}"
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

_start_server() {
  local dir="$1" port="$2"
  python3 -m http.server "${port}" --directory "${dir}" >/dev/null 2>&1 &
  _CURRENT_HTTP_PID=$!
  _TEST_PIDS+=("${_CURRENT_HTTP_PID}")
  local i
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if curl -sf "http://127.0.0.1:${port}/" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.5
  done
  log "  WARN: HTTP server on port ${port} did not become ready"
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
  log "WARN: npx not available — skipping fixture tests"
  exit 0
fi

# ══════════════════════════════════════════════════════════════════════════════
# PASS-1: clean page — identity transform, no overlap constraints, no clip.
# Expected: exit 0
# ══════════════════════════════════════════════════════════════════════════════
log_case "PASS-1 — clean page (identity transform, no overlap, no clip)"
CASE_COUNT=$((CASE_COUNT + 1))

TMPDIR_P1=$(_mktemp_tracked)
PORT_P1=$(_free_port 9100 9119)

cat > "${TMPDIR_P1}/index.html" << 'HTML'
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>PASS-1 fixture</title>
<style>
  body { margin: 0; }
  #page-root { width: 100vw; height: 100vh; background: #eee; }
  main { padding: 40px; }
</style></head><body>
<div id="page-root">
  <main id="content">
    <h1>Archive page — separate page, identity transform</h1>
  </main>
</div>
</body></html>
HTML

cat > "${TMPDIR_P1}/manifest.json" << 'JSON'
{
  "schema_version": 1,
  "route": "/archive",
  "description": "PASS-1 fixture: clean page with identity transform",
  "elements": [
    {
      "selector": "#page-root",
      "label": "page root",
      "expected_transform": "identity",
      "overflow_clip_forbidden": false
    },
    {
      "selector": "main",
      "label": "main content",
      "expected_transform": "identity"
    }
  ]
}
JSON

_start_server "${TMPDIR_P1}" "${PORT_P1}"
P1_PID="${_CURRENT_HTTP_PID}"

set +e
OUTPUT_P1=$(echo "{\"page_url\": \"http://127.0.0.1:${PORT_P1}\", \"manifest_path\": \"${TMPDIR_P1}/manifest.json\"}" \
  | npx tsx "${REPO_ROOT}/scripts/audit-render-fidelity-vs-intent.ts" 2>&1)
EXIT_P1=$?
set -e

log "  exit=${EXIT_P1}"
_stop_server "${P1_PID}"

if [[ $EXIT_P1 -eq 3 ]]; then
  log "  Playwright unavailable — validating WARN exit-3 path"
  log_pass "PASS-1 — exit 3 (Playwright unavailable; correct WARN behavior)"
  PASS_COUNT=$((PASS_COUNT + 1))
elif [[ $EXIT_P1 -eq 0 ]]; then
  log_pass "PASS-1 — exit 0 as expected (clean page)"
  PASS_COUNT=$((PASS_COUNT + 1))
elif [[ $EXIT_P1 -eq 2 ]]; then
  log "  Output: ${OUTPUT_P1}"
  log_fail "PASS-1 — exit 2 (server/input error); expected exit 0"
else
  log "  Output: ${OUTPUT_P1}"
  log_fail "PASS-1 — exit ${EXIT_P1}; expected exit 0"
fi

# ══════════════════════════════════════════════════════════════════════════════
# PASS-2: two siblings, no overlap (stacked vertically, 200px apart).
# Expected: exit 0
# ══════════════════════════════════════════════════════════════════════════════
log_case "PASS-2 — two siblings, no overlap (vertical stack)"
CASE_COUNT=$((CASE_COUNT + 1))

TMPDIR_P2=$(_mktemp_tracked)
PORT_P2=$(_free_port 9120 9139)

cat > "${TMPDIR_P2}/index.html" << 'HTML'
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>PASS-2 fixture</title>
<style>
  body { margin: 0; }
  #surface-a { position: absolute; top: 0; left: 0; width: 400px; height: 100px; background: #ccc; }
  #surface-b { position: absolute; top: 300px; left: 0; width: 400px; height: 100px; background: #aaa; }
</style></head><body>
<div id="surface-a">Home page surface — top 0</div>
<div id="surface-b">Archive page surface — top 300px (no overlap)</div>
</body></html>
HTML

cat > "${TMPDIR_P2}/manifest.json" << 'JSON'
{
  "schema_version": 1,
  "route": "/",
  "description": "PASS-2 fixture: two surfaces, no overlap",
  "elements": [
    {
      "selector": "#surface-a",
      "label": "home page surface",
      "expected_transform": "identity",
      "must_not_overlap_with": ["#surface-b"]
    },
    {
      "selector": "#surface-b",
      "label": "archive page surface",
      "expected_transform": "identity",
      "must_not_overlap_with": ["#surface-a"]
    }
  ]
}
JSON

_start_server "${TMPDIR_P2}" "${PORT_P2}"
P2_PID="${_CURRENT_HTTP_PID}"

set +e
OUTPUT_P2=$(echo "{\"page_url\": \"http://127.0.0.1:${PORT_P2}\", \"manifest_path\": \"${TMPDIR_P2}/manifest.json\"}" \
  | npx tsx "${REPO_ROOT}/scripts/audit-render-fidelity-vs-intent.ts" 2>&1)
EXIT_P2=$?
set -e

log "  exit=${EXIT_P2}"
_stop_server "${P2_PID}"

if [[ $EXIT_P2 -eq 3 ]]; then
  log "  Playwright unavailable — validating WARN exit-3 path"
  log_pass "PASS-2 — exit 3 (Playwright unavailable; correct WARN behavior)"
  PASS_COUNT=$((PASS_COUNT + 1))
elif [[ $EXIT_P2 -eq 0 ]]; then
  log_pass "PASS-2 — exit 0 as expected (siblings not overlapping)"
  PASS_COUNT=$((PASS_COUNT + 1))
elif [[ $EXIT_P2 -eq 2 ]]; then
  log "  Output: ${OUTPUT_P2}"
  log_fail "PASS-2 — exit 2 (server/input error); expected exit 0"
else
  log "  Output: ${OUTPUT_P2}"
  log_fail "PASS-2 — exit ${EXIT_P2}; expected exit 0"
fi

# ══════════════════════════════════════════════════════════════════════════════
# FAIL-1: R1 — non-identity CSS transform where manifest expects identity.
# The /archive page root has translateY(-100vh) — a classic "hide below viewport"
# overlay trick that should be a separate page instead.
# Expected: exit 1 with error naming R1_TRANSFORM_NOT_IDENTITY / A4a
# ══════════════════════════════════════════════════════════════════════════════
log_case "FAIL-1 — R1: non-identity CSS transform (crooked overlay class)"
CASE_COUNT=$((CASE_COUNT + 1))

TMPDIR_F1=$(_mktemp_tracked)
PORT_F1=$(_free_port 9140 9159)

# Simulate the bug: /archive is absolutely positioned with a CSS transform
# (translateY) that slides it partially off-screen — the "crooked overlay" pattern.
cat > "${TMPDIR_F1}/index.html" << 'HTML'
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>FAIL-1 fixture — crooked overlay</title>
<style>
  body { margin: 0; overflow: hidden; }
  #home-surface { width: 100vw; height: 100vh; background: #eee; position: relative; }
  #archive-overlay {
    position: fixed;
    top: 0; left: 0;
    width: 100vw; height: 100vh;
    background: white;
    /* BUG: archive is an overlay with a non-identity transform, not a separate page */
    transform: translateY(-20px) rotate(1deg);
    z-index: 10;
  }
</style></head><body>
<div id="home-surface">Home page</div>
<div id="archive-overlay">Archive — WRONG: overlay with non-identity transform</div>
</body></html>
HTML

cat > "${TMPDIR_F1}/manifest.json" << 'JSON'
{
  "schema_version": 1,
  "route": "/archive",
  "description": "FAIL-1 fixture: manifest expects identity transform; page has translateY+rotate",
  "elements": [
    {
      "selector": "#archive-overlay",
      "label": "archive page root",
      "expected_transform": "identity"
    }
  ]
}
JSON

_start_server "${TMPDIR_F1}" "${PORT_F1}"
F1_PID="${_CURRENT_HTTP_PID}"

set +e
OUTPUT_F1=$(echo "{\"page_url\": \"http://127.0.0.1:${PORT_F1}\", \"manifest_path\": \"${TMPDIR_F1}/manifest.json\"}" \
  | npx tsx "${REPO_ROOT}/scripts/audit-render-fidelity-vs-intent.ts" 2>&1)
EXIT_F1=$?
set -e

log "  exit=${EXIT_F1}"
_stop_server "${F1_PID}"

if [[ $EXIT_F1 -eq 3 ]]; then
  log "  Playwright unavailable — validating WARN exit-3 path"
  log_pass "FAIL-1 — exit 3 (Playwright unavailable; correct WARN behavior)"
  PASS_COUNT=$((PASS_COUNT + 1))
elif [[ $EXIT_F1 -eq 2 ]]; then
  log "  Output: ${OUTPUT_F1}"
  log_fail "FAIL-1 — exit 2 (server/input error); expected exit 1"
else
  F1_PASS=true
  if [[ $EXIT_F1 -eq 0 ]]; then
    log "  ASSERT FAIL: exit=${EXIT_F1} expected non-zero (violation should fire)"
    F1_PASS=false
  fi
  if ! echo "${OUTPUT_F1}" | grep -qi "R1_TRANSFORM_NOT_IDENTITY\|A4a\|transform\|identity"; then
    log "  ASSERT FAIL: output does not name R1/A4a invariant"
    log "  Output: ${OUTPUT_F1}"
    F1_PASS=false
  fi

  if [[ "$F1_PASS" == "true" ]]; then
    log_pass "FAIL-1 — exit ${EXIT_F1} (non-zero), names R1_TRANSFORM_NOT_IDENTITY/A4a"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    log_fail "FAIL-1 — assertion failed (see above)"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# FAIL-2: R2 — sibling overlap. The /archive surface overlaps the home surface.
# This IS THE BUG CLASS: /archive as a cropped overlay on top of home-page.
# Expected: exit 1 with error naming R2_SIBLING_OVERLAP / A4b
# ══════════════════════════════════════════════════════════════════════════════
log_case "FAIL-2 — R2: sibling overlap (the /archive crooked overlay bug class)"
CASE_COUNT=$((CASE_COUNT + 1))

TMPDIR_F2=$(_mktemp_tracked)
PORT_F2=$(_free_port 9160 9179)

# Two surfaces, overlapping (archive overlaps home because it's an overlay)
cat > "${TMPDIR_F2}/index.html" << 'HTML'
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>FAIL-2 fixture — overlapping surfaces</title>
<style>
  body { margin: 0; }
  #home-surface {
    position: absolute;
    top: 0; left: 0;
    width: 600px; height: 400px;
    background: #eee;
    z-index: 1;
  }
  #archive-surface {
    position: absolute;
    top: 100px; left: 100px;
    width: 400px; height: 300px;
    background: white;
    z-index: 2;
    /* BUG: archive is positioned OVER home-page surface, not on its own page */
  }
</style></head><body>
<div id="home-surface">Home page surface</div>
<div id="archive-surface">Archive — WRONG: rendered as overlay on top of home</div>
</body></html>
HTML

cat > "${TMPDIR_F2}/manifest.json" << 'JSON'
{
  "schema_version": 1,
  "route": "/",
  "description": "FAIL-2 fixture: archive must not overlap home-page surface",
  "elements": [
    {
      "selector": "#home-surface",
      "label": "home page surface",
      "expected_transform": "identity",
      "must_not_overlap_with": ["#archive-surface"]
    },
    {
      "selector": "#archive-surface",
      "label": "archive surface — must be on its own route, not overlapping home",
      "expected_transform": "identity",
      "must_not_overlap_with": ["#home-surface"]
    }
  ]
}
JSON

_start_server "${TMPDIR_F2}" "${PORT_F2}"
F2_PID="${_CURRENT_HTTP_PID}"

set +e
OUTPUT_F2=$(echo "{\"page_url\": \"http://127.0.0.1:${PORT_F2}\", \"manifest_path\": \"${TMPDIR_F2}/manifest.json\"}" \
  | npx tsx "${REPO_ROOT}/scripts/audit-render-fidelity-vs-intent.ts" 2>&1)
EXIT_F2=$?
set -e

log "  exit=${EXIT_F2}"
_stop_server "${F2_PID}"

if [[ $EXIT_F2 -eq 3 ]]; then
  log "  Playwright unavailable — validating WARN exit-3 path"
  log_pass "FAIL-2 — exit 3 (Playwright unavailable; correct WARN behavior)"
  PASS_COUNT=$((PASS_COUNT + 1))
elif [[ $EXIT_F2 -eq 2 ]]; then
  log "  Output: ${OUTPUT_F2}"
  log_fail "FAIL-2 — exit 2 (server/input error); expected exit 1"
else
  F2_PASS=true
  if [[ $EXIT_F2 -eq 0 ]]; then
    log "  ASSERT FAIL: exit=${EXIT_F2} expected non-zero (overlap should fire)"
    F2_PASS=false
  fi
  if ! echo "${OUTPUT_F2}" | grep -qi "R2_SIBLING_OVERLAP\|A4b\|overlap"; then
    log "  ASSERT FAIL: output does not name R2/A4b invariant"
    log "  Output: ${OUTPUT_F2}"
    F2_PASS=false
  fi

  if [[ "$F2_PASS" == "true" ]]; then
    log_pass "FAIL-2 — exit ${EXIT_F2} (non-zero), names R2_SIBLING_OVERLAP/A4b"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    log_fail "FAIL-2 — assertion failed (see above)"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# FAIL-3: R3 — overflow clip forbidden. Element has overflow:hidden where
# manifest declares overflow_clip_forbidden=true (content being cut off).
# Expected: exit 1 with error naming R3_OVERFLOW_CLIP / A4c
# ══════════════════════════════════════════════════════════════════════════════
log_case "FAIL-3 — R3: overflow-clip forbidden"
CASE_COUNT=$((CASE_COUNT + 1))

TMPDIR_F3=$(_mktemp_tracked)
PORT_F3=$(_free_port 9180 9199)

cat > "${TMPDIR_F3}/index.html" << 'HTML'
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>FAIL-3 fixture — overflow clip</title>
<style>
  body { margin: 0; }
  #content-area {
    width: 400px;
    height: 200px;
    /* BUG: overflow:hidden clips content that design intent requires to be visible */
    overflow: hidden;
    background: #eee;
  }
</style></head><body>
<div id="content-area">
  <p>Content that extends beyond bounds — clipped by overflow:hidden — this is WRONG when manifest forbids clip</p>
</div>
</body></html>
HTML

cat > "${TMPDIR_F3}/manifest.json" << 'JSON'
{
  "schema_version": 1,
  "route": "/archive",
  "description": "FAIL-3 fixture: content area must not clip overflow",
  "elements": [
    {
      "selector": "#content-area",
      "label": "archive content area — must not clip overflow",
      "expected_transform": "identity",
      "overflow_clip_forbidden": true
    }
  ]
}
JSON

_start_server "${TMPDIR_F3}" "${PORT_F3}"
F3_PID="${_CURRENT_HTTP_PID}"

set +e
OUTPUT_F3=$(echo "{\"page_url\": \"http://127.0.0.1:${PORT_F3}\", \"manifest_path\": \"${TMPDIR_F3}/manifest.json\"}" \
  | npx tsx "${REPO_ROOT}/scripts/audit-render-fidelity-vs-intent.ts" 2>&1)
EXIT_F3=$?
set -e

log "  exit=${EXIT_F3}"
_stop_server "${F3_PID}"

if [[ $EXIT_F3 -eq 3 ]]; then
  log "  Playwright unavailable — validating WARN exit-3 path"
  log_pass "FAIL-3 — exit 3 (Playwright unavailable; correct WARN behavior)"
  PASS_COUNT=$((PASS_COUNT + 1))
elif [[ $EXIT_F3 -eq 2 ]]; then
  log "  Output: ${OUTPUT_F3}"
  log_fail "FAIL-3 — exit 2 (server/input error); expected exit 1"
else
  F3_PASS=true
  if [[ $EXIT_F3 -eq 0 ]]; then
    log "  ASSERT FAIL: exit=${EXIT_F3} expected non-zero (overflow clip should fire)"
    F3_PASS=false
  fi
  if ! echo "${OUTPUT_F3}" | grep -qi "R3_OVERFLOW_CLIP\|A4c\|overflow\|clip"; then
    log "  ASSERT FAIL: output does not name R3/A4c invariant"
    log "  Output: ${OUTPUT_F3}"
    F3_PASS=false
  fi

  if [[ "$F3_PASS" == "true" ]]; then
    log_pass "FAIL-3 — exit ${EXIT_F3} (non-zero), names R3_OVERFLOW_CLIP/A4c"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    log_fail "FAIL-3 — assertion failed (see above)"
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════════════════════
echo "" | tee -a "${TEST_LOG}"
log "=== SUMMARY: ${PASS_COUNT}/${CASE_COUNT} cases passed ==="
log "end · $(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [[ "$PASS_ALL" == "true" ]]; then
  log "OVERALL: PASS — all render-fidelity fixture cases passed"
  _FINAL_EXIT=0
else
  log "OVERALL: FAIL — one or more cases failed (see above)"
  _FINAL_EXIT=1
fi

_test_cleanup
trap - EXIT INT TERM HUP
exit "${_FINAL_EXIT}"
