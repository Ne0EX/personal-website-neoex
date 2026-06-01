#!/usr/bin/env bash
# =============================================================================
# audit-search-index-completeness.sh
#
# Rail: search-index-completeness
# Owner: Algol (α-VER-06)
# key: audit-search-index-completeness
# target class: DETERMINISTIC / HARD-BARRIER
#
# BUG THIS CLOSES:
#   pagefind indexed 2 of 13 pages because the data-pagefind-body elements
#   were only present in Next.js RSC streaming payloads (inside <script> tags),
#   not as real HTML attributes in the static HTML output. Additionally, those
#   RSC payload elements had style="display:none" which would also cause pagefind
#   to skip them even if they were real HTML elements.
#   No gate asserted the index covered the site.
#
# WHAT THIS SCRIPT CHECKS (deterministic, no browser required):
#
#   ASSERTION 1 — COUNT PARITY
#     Enumerate crawlable HTML pages in the pagefind site dir (SITE_DIR,
#     default .next/server/app). Exclude Next.js internal error pages.
#     Read page_count from pagefind-entry.json. Assert page_count == crawlable_count.
#
#   ASSERTION 2 — HIDDEN OR RSC-ONLY PAGEFIND BODY
#     For every HTML file in SITE_DIR, detect any data-pagefind-body element
#     that is inaccessible to pagefind's static crawler because:
#
#     Case A — REAL HTML ELEMENT, HIDDEN BY CSS:
#       An actual <... data-pagefind-body ...> HTML tag with an inline style
#       containing display:none, visibility:hidden, width:0, or height:0.
#       pagefind's static crawler skips CSS-hidden elements.
#
#     Case B — RSC JSON PAYLOAD ONLY:
#       The data-pagefind-body attribute appears as a JSON property inside a
#       <script> tag (Next.js RSC streaming payload): "data-pagefind-body":true
#       This is not a real HTML attribute — pagefind's static HTML parser cannot
#       read it. The content is only accessible after JavaScript hydration.
#
#     Either case means the page's indexed content will be missing or wrong.
#
#   LIVE-WIRING GAP (reported honestly):
#     Both assertions require a completed `npm run build` (which runs
#     velite + next build + pagefind indexing). If the build output is absent
#     this script exits 3 with a clear gap report instead of a false pass.
#     Wire into the post-build step:
#       ... && bash scripts/audit-search-index-completeness.sh
#
# EXIT CODES:
#   0 — PASS: page_count == crawlable_count AND no hidden/RSC-only pagefind-body
#   1 — FAIL: page_count != crawlable_count
#   2 — FAIL: data-pagefind-body is hidden (display:none) or RSC-payload-only
#   3 — SKIP/ERROR: build output absent (SITE_DIR or entry JSON missing)
#   4 — FAIL: pagefind-entry.json not valid JSON or missing page_count
#
#   When both (1) and (2) fire, exit 2 is returned (root-cause priority).
#
# ENVIRONMENT OVERRIDES (fixture / testing):
#   WL_SITE_DIR        — override SITE_DIR (default: .next/server/app)
#   WL_PAGEFIND_ENTRY  — override path to pagefind-entry.json
#   WL_CRAWLABLE_COUNT — inject crawlable count directly (skips fs enumeration)
#   WL_HTML_FILES      — newline-separated list of HTML paths for assertion 2
#                        (used when SITE_DIR is absent in fixture tests)
#
# Usage:
#   bash scripts/audit-search-index-completeness.sh
#   bash scripts/audit-search-index-completeness.sh --verbose
# =============================================================================

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
TASK_ID="${CLAUDE_TASK_ID:-no-task}"
LOG_DIR="${REPO_ROOT}/.claude/hook-logs"
LOG_FILE="${LOG_DIR}/${TASK_ID}--search-index-completeness.log"
VERBOSE="${1:-}"

# ── path resolution ──────────────────────────────────────────────────────────
if [[ -n "${WL_SITE_DIR:-}" ]]; then
  SITE_DIR="${WL_SITE_DIR}"
elif [[ -f "${REPO_ROOT}/pagefind.json" ]]; then
  _PF_SITE=$(python3 "${REPO_ROOT}/scripts/_sic_read_pagefind_site.py" "${REPO_ROOT}/pagefind.json" 2>/dev/null || echo ".next/server/app")
  SITE_DIR="${REPO_ROOT}/${_PF_SITE}"
else
  SITE_DIR="${REPO_ROOT}/.next/server/app"
fi

PAGEFIND_ENTRY="${WL_PAGEFIND_ENTRY:-${REPO_ROOT}/public/pagefind/pagefind-entry.json}"

# ── logging helpers ──────────────────────────────────────────────────────────
mkdir -p "${LOG_DIR}"
log()     { echo "[search-index-completeness] $*" | tee -a "${LOG_FILE}"; }
log_v()   { if [[ "${VERBOSE}" == "--verbose" ]]; then log "$*"; else echo "[search-index-completeness] $*" >> "${LOG_FILE}"; fi; }
log_err() { echo "[search-index-completeness] ERROR: $*" | tee -a "${LOG_FILE}" >&2; }

log "start · task=${TASK_ID} · $(date -u +%Y-%m-%dT%H:%M:%SZ)"
log_v "SITE_DIR=${SITE_DIR}"
log_v "PAGEFIND_ENTRY=${PAGEFIND_ENTRY}"

# ── P0: live-wiring gap check ────────────────────────────────────────────────
GAP=0

if [[ -z "${WL_CRAWLABLE_COUNT:-}" ]] && [[ ! -d "${SITE_DIR}" ]]; then
  log_err "LIVE-WIRING GAP: ${SITE_DIR} not found"
  log_err "  Requires: npm run build   (velite && next build && npm run index:search)"
  GAP=1
fi

if [[ ! -f "${PAGEFIND_ENTRY}" ]]; then
  log_err "LIVE-WIRING GAP: ${PAGEFIND_ENTRY} not found"
  log_err "  Requires: npm run index:search   (pagefind --site .next/server/app ...)"
  GAP=1
fi

if [[ "${GAP}" -eq 1 ]]; then
  log_err ""
  log_err "Integration: add to the build script after 'index:search':"
  log_err "  ... && npm run index:search && bash scripts/audit-search-index-completeness.sh"
  log "SKIP (exit 3) — build output absent; this gate requires a live build to run"
  exit 3
fi

# ── ASSERTION 1: count parity ────────────────────────────────────────────────
# Crawlable count = all .html files under SITE_DIR, excluding Next.js internals.

if [[ -n "${WL_CRAWLABLE_COUNT:-}" ]]; then
  CRAWLABLE_COUNT="${WL_CRAWLABLE_COUNT}"
  log_v "crawlable_count=${CRAWLABLE_COUNT} (injected via WL_CRAWLABLE_COUNT)"
else
  CRAWLABLE_COUNT=$(
    find "${SITE_DIR}" -name "*.html" \
      ! -name "_global-error.html" \
      ! -name "_not-found.html" \
      2>/dev/null \
    | wc -l | tr -d ' '
  )
  log_v "enumerated crawlable HTML pages: ${CRAWLABLE_COUNT}"

  if [[ "${VERBOSE}" == "--verbose" ]]; then
    find "${SITE_DIR}" -name "*.html" \
      ! -name "_global-error.html" \
      ! -name "_not-found.html" \
      2>/dev/null | sort | while IFS= read -r f; do
      log_v "  ${f#${REPO_ROOT}/}"
    done
  fi
fi

# Read page_count from pagefind-entry.json (sum across all language sections).
# Python script written to LOG_DIR to avoid heredoc-in-subshell bash parse issues.
_PF_COUNT_PY="${LOG_DIR}/_sic_pf_count_$$.py"
cat > "${_PF_COUNT_PY}" << 'PYEOF'
import sys, json
entry_path = sys.argv[1]
try:
    with open(entry_path, 'r', encoding='utf-8') as f:
        entry = json.load(f)
except Exception as e:
    print("ERROR: " + str(e), file=sys.stderr)
    sys.exit(1)
langs = entry.get('languages', {})
if not langs:
    print(0)
    sys.exit(0)
total = sum(
    v.get('page_count', 0) for v in langs.values()
    if isinstance(v, dict)
)
print(total)
PYEOF

PF_COUNT_EXIT=0
PF_COUNT_OUTPUT=$(python3 "${_PF_COUNT_PY}" "${PAGEFIND_ENTRY}" 2>/dev/null) || PF_COUNT_EXIT=$?
rm -f "${_PF_COUNT_PY}"

if [[ "${PF_COUNT_EXIT}" -ne 0 ]] || [[ -z "${PF_COUNT_OUTPUT}" ]]; then
  log_err "pagefind-entry.json is not valid JSON or missing page_count: ${PAGEFIND_ENTRY}"
  log "FAIL (exit 4)"
  exit 4
fi

PAGEFIND_PAGE_COUNT="${PF_COUNT_OUTPUT}"

log "pagefind page_count (from entry.json): ${PAGEFIND_PAGE_COUNT}"
log "crawlable_count (from site dir): ${CRAWLABLE_COUNT}"

COUNT_FAIL=0
if [[ "${PAGEFIND_PAGE_COUNT}" -ne "${CRAWLABLE_COUNT}" ]]; then
  log_err "ASSERTION 1 FAIL: page_count=${PAGEFIND_PAGE_COUNT} != crawlable_count=${CRAWLABLE_COUNT}"
  log_err "  pagefind indexed ${PAGEFIND_PAGE_COUNT} page(s) but site has ${CRAWLABLE_COUNT} crawlable page(s)"
  log_err "  Root causes:"
  log_err "    A) data-pagefind-body in Next.js RSC payload (inside <script> tags) — pagefind"
  log_err "       cannot read this; it only reads static HTML attributes"
  log_err "    B) data-pagefind-body element rendered under display:none in static HTML"
  log_err "  Fix: ensure data-pagefind-body appears as a real, visible HTML attribute in"
  log_err "  the static pre-rendered HTML output (next build). Consider server components"
  log_err "  or generateStaticParams with explicit static rendering."
  COUNT_FAIL=1
else
  log "ASSERTION 1 PASS — page_count=${PAGEFIND_PAGE_COUNT} == crawlable_count=${CRAWLABLE_COUNT}"
fi

# ── ASSERTION 2: hidden or RSC-only pagefind-body detection ──────────────────
# Scan HTML files for data-pagefind-body that is inaccessible to pagefind.
# Two cases:
#   Case A: real HTML element with hiding inline CSS
#   Case B: data-pagefind-body only as JSON property inside <script> RSC payload
#
# Python script written to LOG_DIR to avoid heredoc-in-subshell issues.

if [[ -n "${WL_HTML_FILES:-}" ]]; then
  HTML_FILE_LIST="${WL_HTML_FILES}"
elif [[ -d "${SITE_DIR}" ]]; then
  HTML_FILE_LIST=$(
    find "${SITE_DIR}" -name "*.html" \
      ! -name "_global-error.html" \
      ! -name "_not-found.html" \
      2>/dev/null | sort
  )
else
  HTML_FILE_LIST=""
fi

_HIDDEN_PY="${LOG_DIR}/_sic_hidden_$$.py"
cat > "${_HIDDEN_PY}" << 'PYEOF'
import sys, os, re

# HTML file paths come from stdin, one per line.
files = [f for f in sys.stdin.read().split('\n') if f.strip()]

def hiding_properties(style_str):
    """Return list of hiding CSS properties found in an inline style string."""
    found = []
    s = style_str.lower()
    if re.search(r'display\s*:\s*none', s):
        found.append('display:none')
    if re.search(r'visibility\s*:\s*hidden', s):
        found.append('visibility:hidden')
    if re.search(r'width\s*:\s*0(?:px|em|rem|vw|%|ch)?(?:\b|;|\s)', s):
        found.append('width:0')
    if re.search(r'height\s*:\s*0(?:px|em|rem|vh|%|ch)?(?:\b|;|\s)', s):
        found.append('height:0')
    return found

# Case A: real HTML element with data-pagefind-body and hiding inline style.
# Matches an opening HTML tag containing data-pagefind-body as an attribute.
# Uses non-greedy match to avoid spanning multiple tags.
html_attr_re = re.compile(
    r'<[a-zA-Z][^>]*?\bdata-pagefind-body\b[^>]*?>',
    re.DOTALL | re.IGNORECASE
)
# Extract inline style attribute value
style_re = re.compile(
    r'\bstyle\s*=\s*(?:"([^"]*)"|\'([^\']*)\')',
    re.IGNORECASE
)

# Case B: data-pagefind-body as a JSON property inside a <script> RSC payload.
# Pattern: "data-pagefind-body":true inside a <script> tag.
# This indicates the element is only in the RSC streaming payload, not in the
# static HTML — pagefind's static parser cannot read it.
# We detect this by looking for the JSON-escaped form: \"data-pagefind-body\"
# OR the unescaped form inside a script tag.
# In Next.js RSC: the script tag contains JSON with backslash-escaped quotes.
rsc_json_re = re.compile(
    r'(?:\\?"data-pagefind-body\\?":\s*true|"data-pagefind-body"\s*:\s*true)',
    re.IGNORECASE
)
# Detect if the match is inside a <script> tag
script_tag_re = re.compile(r'<script\b[^>]*>(.*?)</script>', re.DOTALL | re.IGNORECASE)

violations = []
for path in files:
    try:
        with open(path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
    except OSError:
        continue

    # ── Case A: real HTML element with hiding CSS ──────────────────────────
    for tag_m in html_attr_re.finditer(content):
        tag_text = tag_m.group(0)
        style_m = style_re.search(tag_text)
        if not style_m:
            continue
        style_val = style_m.group(1) or style_m.group(2) or ''
        hiding = hiding_properties(style_val)
        if hiding:
            line_no = content[:tag_m.start()].count('\n') + 1
            violations.append((path, line_no, 'case-A-hidden-css', ','.join(hiding)))

    # ── Case B: RSC JSON payload ───────────────────────────────────────────
    # Find all <script> blocks and check for data-pagefind-body in their text.
    # Collect all real HTML positions of data-pagefind-body (from Case A scan)
    # to avoid double-counting. Case B is only reported if there is NO real HTML
    # attribute occurrence in the file (i.e., it's ONLY in the RSC payload).
    html_attr_positions = {m.start() for m in html_attr_re.finditer(content)}

    for script_m in script_tag_re.finditer(content):
        script_content = script_m.group(1)
        if rsc_json_re.search(script_content):
            # Check if there's also a real HTML attribute version in this file.
            # If yes, the real HTML version will be checked by Case A.
            # If no real HTML attribute exists, this is Case B: RSC-only.
            if not html_attr_positions:
                line_no = content[:script_m.start()].count('\n') + 1
                violations.append((path, line_no, 'case-B-rsc-only',
                    'data-pagefind-body is in RSC JSON payload only — pagefind cannot read this'))
            # Only report first occurrence per file to avoid noise
            break

if violations:
    for (path, line, case, detail) in violations:
        print("  {}:{} [{}] {}".format(path, line, case, detail))
    sys.exit(1)
else:
    sys.exit(0)
PYEOF

HIDDEN_EXIT=0
HIDDEN_OUTPUT=$(printf '%s\n' "${HTML_FILE_LIST}" | python3 "${_HIDDEN_PY}" 2>/dev/null) || HIDDEN_EXIT=$?
rm -f "${_HIDDEN_PY}"

HIDDEN_FAIL=0
if [[ "${HIDDEN_EXIT}" -ne 0 ]]; then
  log_err "ASSERTION 2 FAIL: data-pagefind-body is inaccessible to pagefind's static crawler"
  echo "${HIDDEN_OUTPUT}" | while IFS= read -r line; do
    [[ -z "${line}" ]] && continue
    log_err "${line}"
  done
  log_err "  case-A-hidden-css: element exists in static HTML but is hidden by CSS"
  log_err "    Fix: remove display:none/visibility:hidden from data-pagefind-body element"
  log_err "  case-B-rsc-only: element is only in the RSC JSON payload inside <script> tag"
  log_err "    Fix: render data-pagefind-body content as static HTML in a server component"
  log_err "    pagefind reads static HTML attributes only, not JS-rendered DOM"
  HIDDEN_FAIL=1
else
  log "ASSERTION 2 PASS — no hidden or RSC-only data-pagefind-body detected"
fi

# ── Final verdict ─────────────────────────────────────────────────────────────
if [[ "${COUNT_FAIL}" -eq 1 ]] && [[ "${HIDDEN_FAIL}" -eq 1 ]]; then
  log "FAIL (exit 2) — count mismatch AND hidden/RSC pagefind-body: root cause is the inaccessible element"
  exit 2
elif [[ "${HIDDEN_FAIL}" -eq 1 ]]; then
  log "FAIL (exit 2) — data-pagefind-body inaccessible to pagefind static crawler"
  exit 2
elif [[ "${COUNT_FAIL}" -eq 1 ]]; then
  log "FAIL (exit 1) — page_count (${PAGEFIND_PAGE_COUNT}) != crawlable_count (${CRAWLABLE_COUNT})"
  exit 1
else
  log "PASS — page_count=${PAGEFIND_PAGE_COUNT} == crawlable_count=${CRAWLABLE_COUNT}; no inaccessible pagefind-body"
  exit 0
fi
