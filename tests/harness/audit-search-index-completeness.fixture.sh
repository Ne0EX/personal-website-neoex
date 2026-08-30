#!/usr/bin/env bash
# =============================================================================
# tests/harness/audit-search-index-completeness.fixture.sh
#
# Owner: Algol (α-VER-06)
# Rail: search-index-completeness
# key: audit-search-index-completeness
#
# Fixture tests for scripts/audit-search-index-completeness.sh.
# Asserts EXIT CODES only — no text parsing.
# Cases run inline (no subshells) so PASS_COUNT/FAIL_COUNT propagate correctly.
#
# The cardinal sin this harness kills: exit-0-always. Every SHOULD-FAIL case
# MUST produce a nonzero exit code. If the script exits 0 on a violation,
# that is the test failure — not just advisory output.
#
# Usage:
#   bash tests/harness/audit-search-index-completeness.fixture.sh
#
# Exit codes:
#   0 — all cases PASS
#   1 — one or more FAIL
#
# ─── Design notes ────────────────────────────────────────────────────────────
# Assertion 1 (count parity) and Assertion 2 (pagefind accessibility) are
# tested independently:
#
#   run_a1 <entry> <crawlable_count> — bypass FS enumeration via WL_CRAWLABLE_COUNT
#   run_a2 <entry> <count> <html_files> — bypass find via WL_HTML_FILES
#
# Assertion 2 checks TWO cases:
#   case-A: real HTML element with data-pagefind-body hidden by CSS
#   case-B: data-pagefind-body ONLY in RSC JSON payload inside <script> tag
#           (the confirmed bug in this repo — Next.js RSC streaming)
# ─────────────────────────────────────────────────────────────────────────────
#
# SHOULD-PASS (script must exit 0):
#   SP-1  A1: page_count=3 == crawlable=3
#   SP-2  A2: data-pagefind-body as real HTML attr, no hiding CSS
#   SP-3  A2: aria-hidden="true" on data-pagefind-body, no display:none
#   SP-4  A1: multilang entry sum == crawlable
#
# SHOULD-FAIL (script must exit NONZERO):
#   SF-1  A1: page_count < crawlable                → nonzero, exit 1
#   SF-2  A1: page_count > crawlable                → nonzero, exit 1
#   SF-3  A2-caseA: display:none on real HTML attr  → nonzero, exit 2
#   SF-4  A2-caseA: visibility:hidden               → nonzero, exit 2
#   SF-5  A2-caseA: width:0                         → nonzero, exit 2
#   SF-6  A2-caseA: height:0                        → nonzero, exit 2
#   SF-7  A2-caseB: RSC JSON payload only           → nonzero, exit 2
#   SF-8  A1+A2 both fail → root-cause exit 2
#   SF-9  entry.json invalid JSON                   → nonzero, exit 4
#   SF-10 site dir absent, no count override        → nonzero, exit 3
#
# LIVE-FIXTURE (optional; requires npm run build):
#   LF-1  current build/index pair satisfies the full audit
#   LF-2  current HTML satisfies the isolated pagefind-body audit
# =============================================================================

set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SCRIPT="${REPO_ROOT}/scripts/audit-search-index-completeness.sh"

if [[ ! -f "${SCRIPT}" ]]; then
  printf "FAIL: script not found at %s\n" "${SCRIPT}" >&2
  exit 1
fi

# ── counters and helpers ──────────────────────────────────────────────────────
PASS_COUNT=0
FAIL_COUNT=0

pass() { printf "  PASS · %s\n" "${1}"; PASS_COUNT=$(( PASS_COUNT + 1 )); }
fail() { printf "  FAIL · %s — %s\n" "${1}" "${2}" >&2; FAIL_COUNT=$(( FAIL_COUNT + 1 )); }

assert_exit() {
  local label="$1" expected="$2" actual="$3"
  if [[ "${actual}" -eq "${expected}" ]]; then
    pass "${label} (exit ${actual})"
  else
    fail "${label}" "expected exit ${expected}, got exit ${actual}"
  fi
}

assert_nonzero() {
  local label="$1" actual="$2"
  if [[ "${actual}" -ne 0 ]]; then
    pass "${label} (exit ${actual}, nonzero as required)"
  else
    fail "${label}" "expected NONZERO exit (must not silently pass a violation), got exit 0"
  fi
}

# ── temp-dir registry + cleanup ───────────────────────────────────────────────
WORK_ROOT="$(mktemp -d)"
trap 'rm -rf "${WORK_ROOT}"' EXIT INT TERM HUP

_case_idx=0
new_case_dir() {
  _case_idx=$(( _case_idx + 1 ))
  local d="${WORK_ROOT}/c${_case_idx}"
  mkdir -p "${d}"
  echo "${d}"
}

# ── fixture helpers ───────────────────────────────────────────────────────────

write_entry() {
  local path="$1" count="$2"
  mkdir -p "$(dirname "${path}")"
  printf '{"version":"1.5.2","languages":{"en":{"hash":"abc","wasm":"en","page_count":%d}}}' \
    "${count}" > "${path}"
}

write_entry_multilang() {
  local path="$1" en="$2" th="$3"
  mkdir -p "$(dirname "${path}")"
  printf '{"version":"1.5.2","languages":{"en":{"hash":"a","wasm":"en","page_count":%d},"th":{"hash":"b","wasm":"th","page_count":%d}}}' \
    "${en}" "${th}" > "${path}"
}

# write_html_real_attr <path>
# A page with data-pagefind-body as a real HTML attribute (no style).
write_html_real_attr() {
  local path="$1"
  mkdir -p "$(dirname "${path}")"
  printf '<!DOCTYPE html><html><head><title>T</title></head><body><div data-pagefind-body="true">Metadata.</div><main><p>Content.</p></main></body></html>' \
    > "${path}"
}

# write_html_real_attr_hidden <path> <style>
# A page with data-pagefind-body as a real HTML attribute WITH hiding style.
write_html_real_attr_hidden() {
  local path="$1" style="$2"
  mkdir -p "$(dirname "${path}")"
  printf '<!DOCTYPE html><html><head><title>T</title></head><body><div data-pagefind-body="true" style="%s">Metadata.</div><main><p>Content.</p></main></body></html>' \
    "${style}" > "${path}"
}

# write_html_rsc_only <path>
# A page where data-pagefind-body is ONLY in the RSC JSON payload inside
# a <script> tag — simulates the Next.js RSC streaming output.
# This is the confirmed bug pattern in this repo.
write_html_rsc_only() {
  local path="$1"
  mkdir -p "$(dirname "${path}")"
  # The RSC payload uses JSON with backslash-escaped quotes as seen in the real file:
  # "data-pagefind-body\":true,\"aria-hidden\":true,\"style\":{\"display\":\"none\"}"
  printf '<!DOCTYPE html><html><head><title>T</title></head><body><div hidden=""><!--$--><!--/$--></div><main><p>Content rendered client-side.</p></main><script>self.__next_f=self.__next_f||[];self.__next_f.push([1,"5:[\"$\",\"div\",null,{\"data-pagefind-body\":true,\"aria-hidden\":true,\"style\":{\"display\":\"none\"},\"children\":[\"hello\"]}]"])</script></body></html>' \
    > "${path}"
}

# ── run helpers ───────────────────────────────────────────────────────────────
RC=0

# run_a1 <entry_path> <crawlable_count>
# Test Assertion 1 only: inject count to bypass FS enumeration.
run_a1() {
  local entry="$1" count="$2"
  RC=0
  env \
    WL_SITE_DIR="/nonexistent_${$}" \
    WL_PAGEFIND_ENTRY="${entry}" \
    WL_CRAWLABLE_COUNT="${count}" \
    CLAUDE_TASK_ID="fixture-test" \
    bash "${SCRIPT}" >/dev/null 2>/dev/null || RC=$?
}

# run_a2 <entry_path> <crawlable_count> <html_files_newline_separated>
# Test Assertion 2: inject both count and html file list.
run_a2() {
  local entry="$1" count="$2" html_files="$3"
  RC=0
  env \
    WL_SITE_DIR="/nonexistent_${$}" \
    WL_PAGEFIND_ENTRY="${entry}" \
    WL_CRAWLABLE_COUNT="${count}" \
    WL_HTML_FILES="${html_files}" \
    CLAUDE_TASK_ID="fixture-test" \
    bash "${SCRIPT}" >/dev/null 2>/dev/null || RC=$?
}

# run_full <site_dir> <entry_path>
# Run both assertions using real FS paths.
run_full() {
  local site="$1" entry="$2"
  RC=0
  env \
    WL_SITE_DIR="${site}" \
    WL_PAGEFIND_ENTRY="${entry}" \
    CLAUDE_TASK_ID="fixture-test" \
    bash "${SCRIPT}" >/dev/null 2>/dev/null || RC=$?
}

# ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ── ──
printf "\n=== audit-search-index-completeness fixture tests ===\n"
printf "\n--- SHOULD-PASS ---\n"

# SP-1: A1: page_count=3, crawlable=3
D="$(new_case_dir)"
write_entry "${D}/entry.json" 3
run_a1 "${D}/entry.json" 3
assert_exit "SP-1  A1: page_count=3 == crawlable=3" 0 "${RC}"

# SP-2: A2: data-pagefind-body as real HTML attribute, no hiding CSS
D="$(new_case_dir)"
write_html_real_attr "${D}/page.html"
write_entry "${D}/entry.json" 1
run_a2 "${D}/entry.json" 1 "${D}/page.html"
assert_exit "SP-2  A2: real HTML attr, no hiding CSS" 0 "${RC}"

# SP-3: A2: aria-hidden="true" but NO display:none — not a violation
# Only CSS hiding properties matter; aria-hidden alone does not trigger.
D="$(new_case_dir)"
mkdir -p "${D}"
printf '<!DOCTYPE html><html><body><div data-pagefind-body="true" aria-hidden="true">M.</div></body></html>' \
  > "${D}/page.html"
write_entry "${D}/entry.json" 1
run_a2 "${D}/entry.json" 1 "${D}/page.html"
assert_exit "SP-3  A2: aria-hidden only, no display:none → not a violation" 0 "${RC}"

# SP-4: A1: multilang entry: en=2 + th=1 = 3, crawlable=3
D="$(new_case_dir)"
write_entry_multilang "${D}/entry.json" 2 1
run_a1 "${D}/entry.json" 3
assert_exit "SP-4  A1: multilang (en=2 + th=1 = 3) == crawlable=3" 0 "${RC}"

printf "\n--- SHOULD-FAIL ---\n"

# SF-1: A1: page_count < crawlable_count
D="$(new_case_dir)"
write_entry "${D}/entry.json" 2
run_a1 "${D}/entry.json" 5
assert_nonzero "SF-1  A1: page_count=2 < crawlable=5 → must FAIL" "${RC}"
assert_exit    "SF-1  A1: exit code must be 1" 1 "${RC}"

# SF-2: A1: page_count > crawlable_count
D="$(new_case_dir)"
write_entry "${D}/entry.json" 10
run_a1 "${D}/entry.json" 2
assert_nonzero "SF-2  A1: page_count=10 > crawlable=2 → must FAIL" "${RC}"
assert_exit    "SF-2  A1: exit code must be 1" 1 "${RC}"

# SF-3: A2-caseA: display:none on real HTML element
D="$(new_case_dir)"
write_html_real_attr_hidden "${D}/article.html" "display:none"
write_entry "${D}/entry.json" 1
run_a2 "${D}/entry.json" 1 "${D}/article.html"
assert_nonzero "SF-3  A2-caseA: display:none on real HTML attr → must FAIL" "${RC}"
assert_exit    "SF-3  A2-caseA: exit code must be 2" 2 "${RC}"

# SF-4: A2-caseA: visibility:hidden on real HTML element
D="$(new_case_dir)"
write_html_real_attr_hidden "${D}/page.html" "visibility:hidden"
write_entry "${D}/entry.json" 1
run_a2 "${D}/entry.json" 1 "${D}/page.html"
assert_nonzero "SF-4  A2-caseA: visibility:hidden → must FAIL" "${RC}"
assert_exit    "SF-4  A2-caseA: exit code must be 2" 2 "${RC}"

# SF-5: A2-caseA: width:0 on real HTML element
D="$(new_case_dir)"
write_html_real_attr_hidden "${D}/page.html" "width:0;overflow:hidden"
write_entry "${D}/entry.json" 1
run_a2 "${D}/entry.json" 1 "${D}/page.html"
assert_nonzero "SF-5  A2-caseA: width:0 → must FAIL" "${RC}"
assert_exit    "SF-5  A2-caseA: exit code must be 2" 2 "${RC}"

# SF-6: A2-caseA: height:0 on real HTML element
D="$(new_case_dir)"
write_html_real_attr_hidden "${D}/page.html" "height:0px;overflow:hidden"
write_entry "${D}/entry.json" 1
run_a2 "${D}/entry.json" 1 "${D}/page.html"
assert_nonzero "SF-6  A2-caseA: height:0 → must FAIL" "${RC}"
assert_exit    "SF-6  A2-caseA: exit code must be 2" 2 "${RC}"

# SF-7: A2-caseB: data-pagefind-body ONLY in RSC JSON payload
# This is the exact bug in the current repo: Next.js RSC streaming puts
# data-pagefind-body in <script> JSON, not as a real HTML attribute.
D="$(new_case_dir)"
write_html_rsc_only "${D}/article.html"
write_entry "${D}/entry.json" 1
run_a2 "${D}/entry.json" 1 "${D}/article.html"
assert_nonzero "SF-7  A2-caseB: RSC-only pagefind body → must FAIL" "${RC}"
assert_exit    "SF-7  A2-caseB: exit code must be 2" 2 "${RC}"

# SF-8: A1+A2 both fail → root-cause exit 2
# crawlable=2, page_count=1, AND one file has hidden body
D="$(new_case_dir)"
write_html_real_attr_hidden "${D}/p1.html" "display:none"
write_html_real_attr "${D}/p2.html"
write_entry "${D}/entry.json" 1   # 1 indexed because p1 is hidden; crawlable=2
run_a2 "${D}/entry.json" 2 "${D}/p1.html"$'\n'"${D}/p2.html"
assert_nonzero "SF-8  A1+A2 both fail → must FAIL" "${RC}"
assert_exit    "SF-8  A1+A2: exit code must be 2 (root-cause priority)" 2 "${RC}"

# SF-9: invalid JSON entry.json
D="$(new_case_dir)"
printf 'not json {{' > "${D}/entry.json"
run_a1 "${D}/entry.json" 3
assert_nonzero "SF-9  invalid JSON entry.json → must FAIL" "${RC}"
assert_exit    "SF-9  exit code must be 4" 4 "${RC}"

# SF-10: site dir absent, no WL_CRAWLABLE_COUNT → exit 3
D="$(new_case_dir)"
write_entry "${D}/entry.json" 3
RC=0
env \
  WL_SITE_DIR="${D}/site_does_not_exist" \
  WL_PAGEFIND_ENTRY="${D}/entry.json" \
  CLAUDE_TASK_ID="fixture-test" \
  bash "${SCRIPT}" >/dev/null 2>/dev/null || RC=$?
assert_nonzero "SF-10 site dir absent → must FAIL (gap report)" "${RC}"
assert_exit    "SF-10 exit code must be 3" 3 "${RC}"

# ── LIVE-FIXTURE ──────────────────────────────────────────────────────────────
printf "\n--- LIVE-FIXTURE ---\n"

REAL_ENTRY="${REPO_ROOT}/public/pagefind/pagefind-entry.json"
REAL_SITE_DIR="${REPO_ROOT}/.next/server/app"

# LF-1: when build artifacts exist, the current build/index pair is green.
if [[ -f "${REAL_ENTRY}" ]] && [[ -d "${REAL_SITE_DIR}" ]]; then
  run_full "${REAL_SITE_DIR}" "${REAL_ENTRY}"
  assert_exit "LF-1  current build/index pair satisfies full audit" 0 "${RC}"
else
  printf "  SKIP · LF-1 — build output not present (run npm run build)\n"
fi

# LF-2: isolate the pagefind-body assertion against current HTML.
if [[ -d "${REAL_SITE_DIR}" ]] && [[ -f "${REAL_ENTRY}" ]]; then
  REAL_CRAWLABLE=$(find "${REAL_SITE_DIR}" -name "*.html" ! -name "_global-error.html" ! -name "_not-found.html" 2>/dev/null | wc -l | tr -d ' ')
  REAL_HTML_FILES=$(find "${REAL_SITE_DIR}" -name "*.html" ! -name "_global-error.html" ! -name "_not-found.html" 2>/dev/null | sort)
  # Use injected crawlable count matching the real count so A1 passes,
  # isolating the A2 assertion.
  run_a2 "${REAL_ENTRY}" "${REAL_CRAWLABLE}" "${REAL_HTML_FILES}"
  assert_exit "LF-2  current HTML satisfies pagefind-body audit" 0 "${RC}"
else
  printf "  SKIP · LF-2 — .next/server/app not present\n"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
printf "\n=== Results ===\n"
printf "  PASS: %d\n" "${PASS_COUNT}"
printf "  FAIL: %d\n" "${FAIL_COUNT}"
printf "\n"

if [[ "${FAIL_COUNT}" -gt 0 ]]; then
  printf "SUITE FAIL — %d case(s) failed\n" "${FAIL_COUNT}"
  exit 1
else
  printf "SUITE PASS — all cases passed\n"
  exit 0
fi
