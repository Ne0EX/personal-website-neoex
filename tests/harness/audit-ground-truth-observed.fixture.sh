#!/usr/bin/env bash
# =============================================================================
# tests/harness/audit-ground-truth-observed.fixture.sh
#
# Owner: Algol (α-VER-06)
# Introduced: TASK-2026-06-01-SECURITY-HARNESS-SENSOR-GROUND-TRUTH
#
# Fixture tests for scripts/audit-ground-truth-observed.sh.
# Asserts the EXIT CODE of the script under each scenario.
# Uses only isolated temp-dir fixtures — no tracked files are mutated.
#
# POLICY-NO-INPLACE-MUTATION: every test case constructs its own fixture tree
# under mktemp -d. The real scripts/audit-ground-truth-observed.sh is invoked
# against those fixtures via WL_TASK_MANIFEST + WL_OBSERVED_DIR test seams.
# No tracked file is ever modified.
#
# Usage:
#   bash tests/harness/audit-ground-truth-observed.fixture.sh
#
# Exit codes:
#   0 — all cases PASS
#   1 — one or more cases FAIL
#
# Cases (SHOULD-PASS — gate must exit 0):
#   SP-1  clean single route: PNG exists, sha256 matches, ack=true, no window
#   SP-2  clean two routes:   both PNGs + observed.json entries, sha256 ok
#   SP-3  root route (/):     slug = root.png
#   SP-4  nested route:       /photos/2026 → photos_2026.png
#   SP-5  window present, artifact within window
#   SP-6  WL_TASK_MANIFEST + WL_OBSERVED_DIR override
#
# Cases (SHOULD-FAIL — gate must exit NONZERO):
#   SF-1  manifest missing:                exit 2
#   SF-2  manifest invalid JSON:           exit 2
#   SF-3  shipped_routes empty:            exit 3
#   SF-4  observed.json missing:           exit 4
#   SF-5  observed.json invalid JSON:      exit 4
#   SF-6  PNG missing:                     exit 1 (route-level)
#   SF-7  ack=false:                       exit 1
#   SF-8  sha256 mismatch:                 exit 1
#   SF-9  sha256 field missing:            exit 1
#   SF-10 stale PNG (mtime predates window): exit 1
#   SF-11 observed_at missing when window present: exit 1
#   SF-12 no entry in observed.json for route:     exit 1
# =============================================================================

set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SCRIPT="${REPO_ROOT}/scripts/audit-ground-truth-observed.sh"

if [[ ! -f "${SCRIPT}" ]]; then
  echo "FAIL: script not found at ${SCRIPT}" >&2
  exit 1
fi

# ── counters ──────────────────────────────────────────────────────────────────
PASS_COUNT=0
FAIL_COUNT=0

pass() { echo "  PASS · ${1}"; PASS_COUNT=$(( PASS_COUNT + 1 )); }
fail() { echo "  FAIL · ${1} — ${2}" >&2; FAIL_COUNT=$(( FAIL_COUNT + 1 )); }

# ── temp-dir cleanup ──────────────────────────────────────────────────────────
WORK_ROOT="$(mktemp -d)"
trap 'rm -rf "${WORK_ROOT}"' EXIT INT TERM HUP

# IMPORTANT: make_dir sets LAST_DIR (not via echo/command-substitution) so that
# _case_counter increments in the OUTER shell, not a subshell. Using make_dir; D="${LAST_DIR}"
# would run make_dir in a subshell where the _case_counter increment is invisible
# to the parent — all cases would alias to case_1 and share each other's fixtures.
_case_counter=0
LAST_DIR=""
make_dir() {
  _case_counter=$(( _case_counter + 1 ))
  LAST_DIR="${WORK_ROOT}/case_${_case_counter}"
  mkdir -p "${LAST_DIR}/observed"
}

# ── fixture helpers ───────────────────────────────────────────────────────────

# _make_manifest <dir> [--no-window] [--empty-routes] <route...>
_make_manifest() {
  local dir="$1"; shift
  local no_window=false
  local empty_routes=false
  local routes=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --no-window)    no_window=true; shift ;;
      --empty-routes) empty_routes=true; shift ;;
      *)              routes+=("$1"); shift ;;
    esac
  done

  local routes_json="[]"
  if [[ "${empty_routes}" == "false" && ${#routes[@]} -gt 0 ]]; then
    routes_json=$(printf '%s\n' "${routes[@]}" | jq -R . | jq -s .)
  fi

  if [[ "${no_window}" == "true" ]]; then
    jq -n --arg tid "TASK-FIXTURE" --argjson routes "${routes_json}" \
      '{"task_id":$tid,"shipped_routes":$routes}' > "${dir}/task-manifest.json"
  else
    jq -n --arg tid "TASK-FIXTURE" --argjson routes "${routes_json}" \
      --arg sa "2026-06-01T00:00:00Z" --arg ca "2026-06-01T23:59:59Z" \
      '{"task_id":$tid,"shipped_routes":$routes,"started_at":$sa,"completed_at":$ca}' \
      > "${dir}/task-manifest.json"
  fi
}

# _route_to_slug <route>
_route_to_slug() {
  local route="$1"
  if [[ "${route}" == "/" ]]; then
    echo "root"
  else
    local s="${route#/}"
    echo "${s//\//_}"
  fi
}

# Minimal 1x1 red PNG, base64-encoded, no external dep
_MINIMAL_PNG_B64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=="

_make_png() {
  local path="$1"
  mkdir -p "$(dirname "${path}")"
  echo "${_MINIMAL_PNG_B64}" | base64 -d > "${path}" 2>/dev/null \
    || python3 -c "
import base64, sys
open(sys.argv[1], 'wb').write(base64.b64decode('${_MINIMAL_PNG_B64}'))
" "${path}"
}

_sha256() {
  sha256sum "$1" | awk '{print $1}'
}

# _make_observed_json <dir> <route> <png_path> [options]
# Options:
#   --ack-false          write ack=false
#   --omit-sha           omit sha256 field
#   --omit-observed-at   omit observed_at field
#   --stale-observed-at  set observed_at to 2025-01-01 (before any task window)
# Creates/overwrites ${dir}/observed/observed.json with a single-route entry.
_make_observed_json() {
  local dir="$1"
  local route="$2"
  local png_path="$3"
  shift 3
  local ack_false=false
  local omit_sha=false
  local omit_observed_at=false
  local stale_observed_at=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --ack-false)         ack_false=true; shift ;;
      --omit-sha)          omit_sha=true; shift ;;
      --omit-observed-at)  omit_observed_at=true; shift ;;
      --stale-observed-at) stale_observed_at=true; shift ;;
      *)                   shift ;;
    esac
  done

  local sha256=""
  [[ "${omit_sha}" == "false" ]] && sha256=$(_sha256 "${png_path}")

  local ack="true"
  [[ "${ack_false}" == "true" ]] && ack="false"

  local observed_at="2026-06-01T10:00:00Z"
  [[ "${stale_observed_at}" == "true" ]] && observed_at="2025-01-01T00:00:00Z"

  mkdir -p "${dir}/observed"

  if [[ "${omit_sha}" == "true" && "${omit_observed_at}" == "true" ]]; then
    jq -n --arg r "${route}" --argjson a "${ack}" \
      '{"routes":[{"route":$r,"ack":$a}]}' > "${dir}/observed/observed.json"
  elif [[ "${omit_sha}" == "true" ]]; then
    jq -n --arg r "${route}" --argjson a "${ack}" --arg oa "${observed_at}" \
      '{"routes":[{"route":$r,"ack":$a,"observed_at":$oa}]}' > "${dir}/observed/observed.json"
  elif [[ "${omit_observed_at}" == "true" ]]; then
    jq -n --arg r "${route}" --arg s "${sha256}" --argjson a "${ack}" \
      '{"routes":[{"route":$r,"sha256":$s,"viewport":{"width":1280,"height":800},"ack":$a}]}' \
      > "${dir}/observed/observed.json"
  else
    jq -n --arg r "${route}" --arg s "${sha256}" --argjson a "${ack}" --arg oa "${observed_at}" \
      '{"routes":[{"route":$r,"sha256":$s,"viewport":{"width":1280,"height":800},"ack":$a,"observed_at":$oa}]}' \
      > "${dir}/observed/observed.json"
  fi
}

# _append_route_to_observed_json <dir> <route> <png_path>
# Appends a route entry to an existing observed.json.
_append_route_to_observed_json() {
  local dir="$1"
  local route="$2"
  local png_path="$3"
  local sha256
  sha256=$(_sha256 "${png_path}")
  local existing="${dir}/observed/observed.json"
  local updated
  updated=$(jq --arg r "${route}" --arg s "${sha256}" \
    '.routes += [{"route":$r,"sha256":$s,"viewport":{"width":1280,"height":800},"ack":true}]' \
    "${existing}")
  echo "${updated}" > "${existing}"
}

# ── _run: invoke script with test-seam env vars pointing at temp dir ─────────
LAST_EXIT=0
LAST_OUTPUT=""

_run() {
  local dir="$1"
  local verbose="${2:-}"
  LAST_OUTPUT=""
  LAST_EXIT=0
  LAST_OUTPUT=$(
    WL_TASK_ID="TASK-FIXTURE" \
    WL_TASK_MANIFEST="${dir}/task-manifest.json" \
    WL_OBSERVED_DIR="${dir}/observed" \
    bash "${SCRIPT}" "TASK-FIXTURE" ${verbose} 2>&1
  ) || LAST_EXIT=$?
}

# ── _run_bare: no WL_OBSERVED_DIR, only WL_TASK_MANIFEST (for SF-1 / SF-2 / SF-3
#              where we want to trigger failures that happen before the observed
#              dir is even consulted, so we still need WL_OBSERVED_DIR set to
#              avoid looking at the real tree)
_run_bare() {
  local dir="$1"
  LAST_OUTPUT=""
  LAST_EXIT=0
  LAST_OUTPUT=$(
    WL_TASK_ID="TASK-FIXTURE" \
    WL_TASK_MANIFEST="${dir}/task-manifest.json" \
    WL_OBSERVED_DIR="${dir}/observed" \
    bash "${SCRIPT}" "TASK-FIXTURE" 2>&1
  ) || LAST_EXIT=$?
}

# ─────────────────────────────────────────────────────────────────────────────
# SHOULD-PASS cases
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "=== SHOULD-PASS cases ==="

# SP-1: clean single route, no window
echo ""
echo "--- SP-1: clean single route (no window) ---"
make_dir; D="${LAST_DIR}"
_make_manifest "${D}" --no-window "/archive"
_make_png "${D}/observed/archive.png"
_make_observed_json "${D}" "/archive" "${D}/observed/archive.png" --omit-observed-at
_run "${D}"
if [[ "${LAST_EXIT}" -eq 0 ]]; then
  pass "SP-1: exit 0 (clean single route, no window)"
else
  fail "SP-1" "expected exit 0, got ${LAST_EXIT}. Output: ${LAST_OUTPUT}"
fi

# SP-2: clean two routes, no window
echo ""
echo "--- SP-2: clean two routes (no window) ---"
make_dir; D="${LAST_DIR}"
_make_manifest "${D}" --no-window "/archive" "/photos"
_make_png "${D}/observed/archive.png"
_make_observed_json "${D}" "/archive" "${D}/observed/archive.png" --omit-observed-at
_make_png "${D}/observed/photos.png"
_append_route_to_observed_json "${D}" "/photos" "${D}/observed/photos.png"
_run "${D}"
if [[ "${LAST_EXIT}" -eq 0 ]]; then
  pass "SP-2: exit 0 (two routes, no window)"
else
  fail "SP-2" "expected exit 0, got ${LAST_EXIT}. Output: ${LAST_OUTPUT}"
fi

# SP-3: root route /
echo ""
echo "--- SP-3: root route (/) ---"
make_dir; D="${LAST_DIR}"
_make_manifest "${D}" --no-window "/"
_make_png "${D}/observed/root.png"
_make_observed_json "${D}" "/" "${D}/observed/root.png" --omit-observed-at
_run "${D}"
if [[ "${LAST_EXIT}" -eq 0 ]]; then
  pass "SP-3: exit 0 (root route / → root.png)"
else
  fail "SP-3" "expected exit 0, got ${LAST_EXIT}. Output: ${LAST_OUTPUT}"
fi

# SP-4: nested route /photos/2026 → photos_2026.png
echo ""
echo "--- SP-4: nested route ---"
make_dir; D="${LAST_DIR}"
_make_manifest "${D}" --no-window "/photos/2026"
_make_png "${D}/observed/photos_2026.png"
_make_observed_json "${D}" "/photos/2026" "${D}/observed/photos_2026.png" --omit-observed-at
_run "${D}"
if [[ "${LAST_EXIT}" -eq 0 ]]; then
  pass "SP-4: exit 0 (nested route /photos/2026 → photos_2026.png)"
else
  fail "SP-4" "expected exit 0, got ${LAST_EXIT}. Output: ${LAST_OUTPUT}"
fi

# SP-5: task window present, artifact within window
# Window: 2026-06-01T00:00:00Z .. 2026-06-01T23:59:59Z
# PNG mtime: touched to 2026-06-01 10:30 (within window)
# observed_at: 2026-06-01T10:00:00Z (within window)
echo ""
echo "--- SP-5: artifact within task window ---"
make_dir; D="${LAST_DIR}"
_make_manifest "${D}" "/archive"   # includes default window
_make_png "${D}/observed/archive.png"
# Set mtime to 2026-06-01 10:30:00 UTC.
# Epoch: 2026-06-01 10:30:00 UTC = 1748773800
touch -t "202606011030.00" "${D}/observed/archive.png" 2>/dev/null \
  || python3 -c "import os; os.utime('${D}/observed/archive.png', (1748773800, 1748773800))" 2>/dev/null \
  || true
_make_observed_json "${D}" "/archive" "${D}/observed/archive.png"
_run "${D}"
if [[ "${LAST_EXIT}" -eq 0 ]]; then
  pass "SP-5: exit 0 (artifact within task window)"
else
  fail "SP-5" "expected exit 0, got ${LAST_EXIT}. Output: ${LAST_OUTPUT}"
fi

# SP-6: WL_TASK_MANIFEST + WL_OBSERVED_DIR both pointing at non-default locations
echo ""
echo "--- SP-6: WL_TASK_MANIFEST + WL_OBSERVED_DIR override ---"
make_dir; D="${LAST_DIR}"
CUSTOM_MANIFEST="${WORK_ROOT}/custom-manifest.json"
CUSTOM_OBS_DIR="${WORK_ROOT}/custom-observed"
mkdir -p "${CUSTOM_OBS_DIR}"
jq -n '{"task_id":"TASK-FIXTURE","shipped_routes":["/about"]}' > "${CUSTOM_MANIFEST}"
_make_png "${CUSTOM_OBS_DIR}/about.png"
# Build observed.json directly in CUSTOM_OBS_DIR
SHA=$(_sha256 "${CUSTOM_OBS_DIR}/about.png")
jq -n --arg sha "${SHA}" \
  '{"routes":[{"route":"/about","sha256":$sha,"viewport":{"width":1280,"height":800},"ack":true}]}' \
  > "${CUSTOM_OBS_DIR}/observed.json"
LAST_EXIT=0
LAST_OUTPUT=$(
  WL_TASK_ID="TASK-FIXTURE" \
  WL_TASK_MANIFEST="${CUSTOM_MANIFEST}" \
  WL_OBSERVED_DIR="${CUSTOM_OBS_DIR}" \
  bash "${SCRIPT}" "TASK-FIXTURE" 2>&1
) || LAST_EXIT=$?
if [[ "${LAST_EXIT}" -eq 0 ]]; then
  pass "SP-6: exit 0 (WL_TASK_MANIFEST + WL_OBSERVED_DIR override)"
else
  fail "SP-6" "expected exit 0, got ${LAST_EXIT}. Output: ${LAST_OUTPUT}"
fi

# ─────────────────────────────────────────────────────────────────────────────
# SHOULD-FAIL cases
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "=== SHOULD-FAIL cases ==="

# SF-1: manifest missing → exit 2
echo ""
echo "--- SF-1: manifest missing ---"
make_dir; D="${LAST_DIR}"
# No task-manifest.json created — but observed dir exists
LAST_EXIT=0
LAST_OUTPUT=$(
  WL_TASK_ID="TASK-FIXTURE" \
  WL_TASK_MANIFEST="${D}/task-manifest.json" \
  WL_OBSERVED_DIR="${D}/observed" \
  bash "${SCRIPT}" "TASK-FIXTURE" 2>&1
) || LAST_EXIT=$?
if [[ "${LAST_EXIT}" -eq 2 ]]; then
  pass "SF-1: exit 2 (manifest missing)"
else
  fail "SF-1" "expected exit 2, got ${LAST_EXIT}. Output: ${LAST_OUTPUT}"
fi

# SF-2: manifest invalid JSON → exit 2
echo ""
echo "--- SF-2: manifest invalid JSON ---"
make_dir; D="${LAST_DIR}"
echo "not-json" > "${D}/task-manifest.json"
_run_bare "${D}"
if [[ "${LAST_EXIT}" -eq 2 ]]; then
  pass "SF-2: exit 2 (manifest invalid JSON)"
else
  fail "SF-2" "expected exit 2, got ${LAST_EXIT}. Output: ${LAST_OUTPUT}"
fi

# SF-3: shipped_routes empty → exit 3
echo ""
echo "--- SF-3: shipped_routes empty ---"
make_dir; D="${LAST_DIR}"
_make_manifest "${D}" --no-window --empty-routes
_run_bare "${D}"
if [[ "${LAST_EXIT}" -eq 3 ]]; then
  pass "SF-3: exit 3 (shipped_routes empty)"
else
  fail "SF-3" "expected exit 3, got ${LAST_EXIT}. Output: ${LAST_OUTPUT}"
fi

# SF-4: observed.json missing (observed dir exists but no observed.json) → exit 4
echo ""
echo "--- SF-4: observed.json missing ---"
make_dir; D="${LAST_DIR}"
_make_manifest "${D}" --no-window "/archive"
# observed dir was created by make_dir but observed.json is absent
_run_bare "${D}"
if [[ "${LAST_EXIT}" -eq 4 ]]; then
  pass "SF-4: exit 4 (observed.json missing)"
else
  fail "SF-4" "expected exit 4, got ${LAST_EXIT}. Output: ${LAST_OUTPUT}"
fi

# SF-5: observed.json invalid JSON → exit 4
echo ""
echo "--- SF-5: observed.json invalid JSON ---"
make_dir; D="${LAST_DIR}"
_make_manifest "${D}" --no-window "/archive"
echo "broken" > "${D}/observed/observed.json"
_run_bare "${D}"
if [[ "${LAST_EXIT}" -eq 4 ]]; then
  pass "SF-5: exit 4 (observed.json invalid JSON)"
else
  fail "SF-5" "expected exit 4, got ${LAST_EXIT}. Output: ${LAST_OUTPUT}"
fi

# SF-6: PNG missing → exit 1 (route-level)
echo ""
echo "--- SF-6: PNG missing ---"
make_dir; D="${LAST_DIR}"
_make_manifest "${D}" --no-window "/archive"
# observed.json present but no archive.png
jq -n '{"routes":[{"route":"/archive","sha256":"aaaa","viewport":{"width":1280,"height":800},"ack":true}]}' \
  > "${D}/observed/observed.json"
_run_bare "${D}"
if [[ "${LAST_EXIT}" -ne 0 ]]; then
  pass "SF-6: exit ${LAST_EXIT} (PNG missing → route-level fail)"
else
  fail "SF-6" "expected nonzero exit, got 0"
fi

# SF-7: ack=false → exit 1
echo ""
echo "--- SF-7: ack=false ---"
make_dir; D="${LAST_DIR}"
_make_manifest "${D}" --no-window "/archive"
_make_png "${D}/observed/archive.png"
_make_observed_json "${D}" "/archive" "${D}/observed/archive.png" --ack-false --omit-observed-at
_run "${D}"
if [[ "${LAST_EXIT}" -ne 0 ]]; then
  pass "SF-7: exit ${LAST_EXIT} (ack=false)"
else
  fail "SF-7" "expected nonzero exit, got 0"
fi

# SF-8: sha256 mismatch → exit 1
echo ""
echo "--- SF-8: sha256 mismatch ---"
make_dir; D="${LAST_DIR}"
_make_manifest "${D}" --no-window "/archive"
_make_png "${D}/observed/archive.png"
# Write observed.json with a deliberately wrong sha256
jq -n '{"routes":[{"route":"/archive","sha256":"0000000000000000000000000000000000000000000000000000000000000000","viewport":{"width":1280,"height":800},"ack":true}]}' \
  > "${D}/observed/observed.json"
_run "${D}"
if [[ "${LAST_EXIT}" -ne 0 ]]; then
  pass "SF-8: exit ${LAST_EXIT} (sha256 mismatch)"
else
  fail "SF-8" "expected nonzero exit, got 0"
fi

# SF-9: sha256 field missing → exit 1
echo ""
echo "--- SF-9: sha256 field missing ---"
make_dir; D="${LAST_DIR}"
_make_manifest "${D}" --no-window "/archive"
_make_png "${D}/observed/archive.png"
_make_observed_json "${D}" "/archive" "${D}/observed/archive.png" --omit-sha --omit-observed-at
_run "${D}"
if [[ "${LAST_EXIT}" -ne 0 ]]; then
  pass "SF-9: exit ${LAST_EXIT} (sha256 field missing)"
else
  fail "SF-9" "expected nonzero exit, got 0"
fi

# SF-10: stale PNG (mtime predates task window start) → exit 1
# Task window: 2026-06-01T00:00:00Z .. 2026-06-01T23:59:59Z
# PNG mtime set to 2025-01-01 (epoch 1735689600)
echo ""
echo "--- SF-10: stale PNG (mtime predates task window) ---"
make_dir; D="${LAST_DIR}"
_make_manifest "${D}" "/archive"   # includes window
_make_png "${D}/observed/archive.png"
# Force mtime to 2025-01-01 00:00:00 UTC
touch -t "202501010000.00" "${D}/observed/archive.png" 2>/dev/null \
  || python3 -c "import os; os.utime('${D}/observed/archive.png', (1735689600, 1735689600))" 2>/dev/null \
  || true
# observed_at is within window (mtime predates it, so E1 fires)
_make_observed_json "${D}" "/archive" "${D}/observed/archive.png"
_run "${D}"
if [[ "${LAST_EXIT}" -ne 0 ]]; then
  pass "SF-10: exit ${LAST_EXIT} (stale PNG mtime predates task window)"
else
  fail "SF-10" "expected nonzero exit (stale mtime). Output: ${LAST_OUTPUT}"
fi

# SF-11: observed_at missing when task window present → exit 1
echo ""
echo "--- SF-11: observed_at missing (window declared) ---"
make_dir; D="${LAST_DIR}"
_make_manifest "${D}" "/archive"   # includes window
_make_png "${D}/observed/archive.png"
# Set mtime to within window
touch -t "202606011030.00" "${D}/observed/archive.png" 2>/dev/null \
  || python3 -c "import os; os.utime('${D}/observed/archive.png', (1748773800, 1748773800))" 2>/dev/null \
  || true
# omit observed_at — E2 must fire
_make_observed_json "${D}" "/archive" "${D}/observed/archive.png" --omit-observed-at
_run "${D}"
if [[ "${LAST_EXIT}" -ne 0 ]]; then
  pass "SF-11: exit ${LAST_EXIT} (observed_at missing when window declared)"
else
  fail "SF-11" "expected nonzero exit. Output: ${LAST_OUTPUT}"
fi

# SF-12: no entry in observed.json for the shipped route → exit 1
echo ""
echo "--- SF-12: no entry for route in observed.json ---"
make_dir; D="${LAST_DIR}"
_make_manifest "${D}" --no-window "/archive"
_make_png "${D}/observed/archive.png"
# observed.json has only /other, not /archive
jq -n '{"routes":[{"route":"/other","sha256":"aaaa","viewport":{"width":1280,"height":800},"ack":true}]}' \
  > "${D}/observed/observed.json"
_run "${D}"
if [[ "${LAST_EXIT}" -ne 0 ]]; then
  pass "SF-12: exit ${LAST_EXIT} (no entry for route in observed.json)"
else
  fail "SF-12" "expected nonzero exit, got 0"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "=============================="
echo "Results: ${PASS_COUNT} passed, ${FAIL_COUNT} failed"
echo "=============================="

if [[ "${FAIL_COUNT}" -gt 0 ]]; then
  echo "FAIL — ${FAIL_COUNT} case(s) did not meet expectations" >&2
  exit 1
fi

echo "PASS — all cases correct"
exit 0
