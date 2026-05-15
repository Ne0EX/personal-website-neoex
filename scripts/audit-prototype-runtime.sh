#!/usr/bin/env bash
# scripts/audit-prototype-runtime.sh
# Rail: prototype-runtime
# Owner: Canopus (α-HRN-07)
# Introduced: TASK-2026-05-15-META-10
#
# Purpose: Verify that every prototype touched in the current TASK actually loads
#   in a headless browser without console errors, page exceptions, or network failures.
#   This is the corrective for the harness-gap Peat caught 2026-05-15: harness issued
#   PASS verdicts but the prototype returned ERR_CONNECTION_REFUSED on reload because
#   the python3 http.server wasn't running. File existence + signature + lint does not
#   prove runtime correctness. This rail does.
#
# Usage:
#   WL_TASK_ID=<task_id> bash scripts/audit-prototype-runtime.sh
#   # or standalone (scans all prototypes):
#   bash scripts/audit-prototype-runtime.sh
#
# Environment:
#   WL_TASK_ID   — task id; used to scope audit to prototypes touched in this task.
#                  If not set, audits ALL prototypes under prototypes/** and
#                  .claude/visual-diffs/**/prototype/**
#
# Exit codes:
#   0 — PASS · all prototypes in scope loaded without errors
#   1 — FAIL · one or more prototypes failed runtime check
#   2 — SKIP · no prototypes in task scope (skip-pass; not a failure)
#   3 — WARN · Playwright unavailable (skip with warning; agents not punished for platform issues)
#
# Runtime checks per prototype:
#   C1  No console.error() or console.warn() with severity=error
#   C2  No uncaught JS exceptions (page errors)
#   C3  No failed network requests (404, CORS, module load failure)
#   C4  At least one DOM anchor renders:
#         - Configurable via <meta name="wl-anchor" content="selector"> in the HTML
#         - Fallback heuristic: body > *:not(script) element count > 3
#
# Constraints:
#   - Maximum 30 seconds per prototype (H4 hooks-are-fast budget)
#   - Ephemeral HTTP server on random port in 8800-8999 range (avoids Peat's localhost:8731)
#   - Allowlisted warnings: .harness/runtime-allowlist.json (e.g., Google Fonts CDN slowness)
#   - Skip with WARN (exit 3) if playwright-core unavailable
#
# How to fix a fail:
#   C1: Open DevTools on the failing prototype. Address the console error. Common causes:
#       - Missing asset (image, font, script) → add or fix the path
#       - JavaScript syntax error → fix the syntax
#       - CORS error from external CDN → check the CDN URL or use a local copy
#   C2: A page exception means JavaScript threw and nothing caught it.
#       Run locally: python3 -m http.server 8888 in the prototype dir, open browser.
#   C3: A network failure means a resource 404'd or was blocked.
#       Check href/src paths are relative and the file exists.
#   C4: The DOM anchor check failed — the page appears empty.
#       Ensure the prototype has a body with at least 4 direct children that are not <script>.
#       Or add <meta name="wl-anchor" content="your-selector"> to configure a custom selector.

set -euo pipefail

TASK_ID="${WL_TASK_ID:-}"
# WL_PROTO_PATH: optional override — if set, audit only this specific index.html path.
# Used by smoke tests to target a single planted prototype without git scope complexity.
PROTO_PATH_OVERRIDE="${WL_PROTO_PATH:-}"
LOG_DIR=".claude/hook-logs"
mkdir -p "$LOG_DIR"
LOG_SUFFIX="${TASK_ID:+${TASK_ID}--}prototype-runtime.log"
LOG="$LOG_DIR/${LOG_SUFFIX}"

ALLOWLIST_FILE=".harness/runtime-allowlist.json"
PROTO_ROOT="prototypes"
VISUAL_DIFF_ROOT=".claude/visual-diffs"

TIMEOUT_SEC=30

# --- helper: find free port in 8800-8999 ---
# POSIX-compatible (no shuf; BSD awk generates random order)
find_free_port() {
  local port
  # Generate 200 random ports in 8800-8999 range using awk (available on both GNU+BSD)
  local candidates
  candidates=$(awk 'BEGIN { srand(); for(i=0;i<200;i++) printf "%d\n", int(rand()*200)+8800 }')
  while IFS= read -r port; do
    [[ -z "$port" ]] && continue
    # Try lsof; fall back to nc if lsof is not available
    if command -v lsof &>/dev/null; then
      if ! lsof -i ":${port}" &>/dev/null 2>&1; then
        echo "$port"
        return 0
      fi
    else
      # Fallback: try connecting; if connection refused, port is free
      if ! nc -z 127.0.0.1 "$port" &>/dev/null 2>&1; then
        echo "$port"
        return 0
      fi
    fi
  done <<< "$candidates"
  echo ""
}

# --- helper: check playwright availability ---
check_playwright() {
  local pw_core
  pw_core="$(node -e "require('playwright-core'); console.log('ok')" 2>/dev/null || echo "fail")"
  [[ "$pw_core" == "ok" ]] && return 0
  return 1
}

# --- collect prototypes to audit ---
collect_prototypes() {
  local task_id="$1"
  local found=()

  if [[ -n "$task_id" ]]; then
    # Task-scoped: look for prototypes touched in this task
    # Check task baseline for files in prototype paths
    local baseline=".claude/hook-logs/${task_id}--baseline.json"
    local git_diff
    git_diff=$(git diff --name-only --diff-filter=AMD HEAD 2>/dev/null | sort || true)
    local untracked
    untracked=$(git ls-files --others --exclude-standard 2>/dev/null | sort || true)
    local all_files
    all_files=$(printf '%s\n%s\n' "$git_diff" "$untracked" | sort -u | grep -v '^$' || true)

    # Find prototype directories from touched files
    local proto_dirs=()
    while IFS= read -r f; do
      [[ -z "$f" ]] && continue
      # prototypes/<surface>/... → prototypes/<surface>/
      if [[ "$f" == prototypes/*/* ]]; then
        local dir
        dir=$(dirname "$f")
        # Normalize to immediate prototype dir (one level under prototypes/)
        local surface
        surface=$(echo "$f" | awk -F/ '{print $1"/"$2}')
        proto_dirs+=("$surface")
      fi
      # .claude/visual-diffs/<task>/prototype/...
      if [[ "$f" == .claude/visual-diffs/*/prototype/* ]]; then
        local pdir
        pdir=$(echo "$f" | grep -oE '^\.claude/visual-diffs/[^/]+/prototype' || true)
        [[ -n "$pdir" ]] && proto_dirs+=("$pdir")
      fi
    done <<< "$all_files"

    # Deduplicate and find index.html in each
    local deduped
    deduped=$(printf '%s\n' "${proto_dirs[@]}" | sort -u | grep -v '^$' || true)
    while IFS= read -r pdir; do
      [[ -z "$pdir" ]] && continue
      local idx="${pdir}/index.html"
      if [[ -f "$idx" ]]; then
        found+=("$idx")
      fi
    done <<< "$deduped"

    # Fallback: if no task-specific prototypes found but prototypes dir exists, scan all
    if [[ ${#found[@]} -eq 0 ]]; then
      # No prototype files touched in this task → skip
      echo "" && return 0
    fi
  else
    # No task ID: scan all prototypes under prototypes/ and visual-diff prototype dirs
    while IFS= read -r -d '' idx; do
      found+=("$idx")
    done < <(find "$PROTO_ROOT" -name 'index.html' -print0 2>/dev/null)
    while IFS= read -r -d '' idx; do
      found+=("$idx")
    done < <(find "$VISUAL_DIFF_ROOT" -path '*/prototype/index.html' -print0 2>/dev/null)
  fi

  printf '%s\n' "${found[@]}"
}

# --- load allowlist patterns ---
load_allowlist() {
  if [[ -f "$ALLOWLIST_FILE" ]]; then
    jq -r '.allowed_console_patterns[]? // empty' "$ALLOWLIST_FILE" 2>/dev/null || true
  fi
}

ALLOWLIST_PATTERNS=$(load_allowlist)

# --- check playwright ---
if ! check_playwright; then
  echo "[prototype-runtime] WARN · playwright-core unavailable — skipping runtime audit (exit 3)" | tee "$LOG"
  echo "[prototype-runtime] Install via: npm install playwright-core in the project root" | tee -a "$LOG"
  exit 3
fi

# --- collect prototypes ---
if [[ -n "$PROTO_PATH_OVERRIDE" ]]; then
  # Direct override: audit only the specified index.html path
  if [[ -f "$PROTO_PATH_OVERRIDE" ]]; then
    PROTOTYPES="$PROTO_PATH_OVERRIDE"
  else
    echo "[prototype-runtime] FAIL · WL_PROTO_PATH override '$PROTO_PATH_OVERRIDE' not found" | tee "$LOG"
    exit 1
  fi
else
  PROTOTYPES=$(collect_prototypes "$TASK_ID")
fi

if [[ -z "$PROTOTYPES" ]]; then
  echo "[prototype-runtime] SKIP · no prototypes in task scope (exit 2)" | tee "$LOG"
  exit 2
fi

echo "[prototype-runtime] task=${TASK_ID:-all} · auditing:" | tee "$LOG"
echo "$PROTOTYPES" | while IFS= read -r p; do
  [[ -z "$p" ]] && continue
  echo "  $p" | tee -a "$LOG"
done

# --- audit each prototype ---
OVERALL_PASS=true
RESULTS=""

while IFS= read -r PROTO_INDEX; do
  [[ -z "$PROTO_INDEX" ]] && continue

  PROTO_DIR=$(dirname "$PROTO_INDEX")
  PROTO_NAME=$(echo "$PROTO_DIR" | sed 's|/|--|g')

  echo "[prototype-runtime] → auditing: $PROTO_INDEX" | tee -a "$LOG"

  # Find a free port
  PORT=$(find_free_port)
  if [[ -z "$PORT" ]]; then
    echo "[prototype-runtime] FAIL · $PROTO_INDEX · could not find free port in 8800-8999 range" | tee -a "$LOG"
    OVERALL_PASS=false
    RESULTS="${RESULTS}"$'\n'"FAIL · $PROTO_INDEX · no free port"
    continue
  fi

  # Start ephemeral HTTP server
  # Use Python's http.server; serve from PROTO_DIR so relative paths resolve correctly
  SERVER_LOG="$LOG_DIR/${TASK_ID:+${TASK_ID}--}http-server-${PORT}.log"
  python3 -m http.server "$PORT" --directory "$PROTO_DIR" >"$SERVER_LOG" 2>&1 &
  SERVER_PID=$!

  # Brief wait for server to bind
  sleep 0.5

  # Build allowlist JS array for inline Node script
  ALLOWLIST_JS_ARRAY="[]"
  if [[ -n "$ALLOWLIST_PATTERNS" ]]; then
    ALLOWLIST_JS_ARRAY=$(echo "$ALLOWLIST_PATTERNS" | jq -R . | jq -s . 2>/dev/null || echo "[]")
  fi

  # Extract meta[name="wl-anchor"] selector if present in the HTML
  ANCHOR_META=$(grep -oE '<meta[^>]+name="wl-anchor"[^>]*>' "$PROTO_INDEX" 2>/dev/null || true)
  ANCHOR_SELECTOR=""
  if [[ -n "$ANCHOR_META" ]]; then
    ANCHOR_SELECTOR=$(echo "$ANCHOR_META" | grep -oE 'content="[^"]*"' | sed 's/content="//;s/"//' || true)
  fi

  # Build the Node script content into a temp file
  # (avoids `timeout` command which is not available on macOS BSD)
  NODE_SCRIPT=$(mktemp /tmp/wl-runtime-XXXXXX.js)
  # shellcheck disable=SC2064
  trap "rm -f '$NODE_SCRIPT'; kill '$SERVER_PID' 2>/dev/null || true" EXIT

  # Safely encode ANCHOR_SELECTOR as a JSON value for embedding in JS
  # If empty → null (JS null); if set → "selector string" (JSON-quoted)
  if [[ -n "$ANCHOR_SELECTOR" ]]; then
    ANCHOR_SELECTOR_JS=$(jq -n --arg s "$ANCHOR_SELECTOR" '$s')
  else
    ANCHOR_SELECTOR_JS="null"
  fi

  # Resolve absolute path to playwright-core so the temp script can require it
  # regardless of working directory. Node's module resolution starts from the
  # script file's location; since the temp file lives in /tmp it cannot find
  # node_modules/ relative to the project root.
  PW_CORE_PATH=$(node -e "console.log(require.resolve('playwright-core'))" 2>/dev/null || echo "")
  if [[ -z "$PW_CORE_PATH" ]]; then
    echo "[prototype-runtime] WARN · playwright-core unavailable — skipping runtime audit (exit 3)" | tee -a "$LOG"
    kill "$SERVER_PID" 2>/dev/null || true
    rm -f "$NODE_SCRIPT"
    OVERALL_PASS=false
    RESULTS="${RESULTS}"$'\n'"WARN · $PROTO_INDEX · playwright-core not resolvable"
    continue
  fi

  cat > "$NODE_SCRIPT" <<NODESCRIPT
const { chromium } = require('${PW_CORE_PATH}');

const ALLOWLIST = ${ALLOWLIST_JS_ARRAY};
const ANCHOR_SELECTOR = ${ANCHOR_SELECTOR_JS};
const FALLBACK_SELECTOR = 'body > *:not(script)';
const URL = 'http://localhost:${PORT}/index.html';
const HARD_TIMEOUT_MS = ${TIMEOUT_SEC}000;

// Hard watchdog: exit FAIL if entire script hangs beyond TIMEOUT_SEC
const watchdog = setTimeout(() => {
  console.log('FAIL');
  console.log('  ERROR: audit timed out after ${TIMEOUT_SEC}s');
  process.exit(1);
}, HARD_TIMEOUT_MS + 2000);

(async () => {
  let browser;
  const errors = [];
  const pageErrors = [];
  const netFails = [];

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // C1: console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        const isAllowed = ALLOWLIST.some(p => text.includes(p));
        if (!isAllowed) {
          errors.push('console.error: ' + text);
        }
      }
    });

    // C2: uncaught page exceptions
    page.on('pageerror', err => {
      pageErrors.push('pageerror: ' + err.message);
    });

    // C3: failed network requests
    page.on('requestfailed', req => {
      const url = req.url();
      const isAllowed = ALLOWLIST.some(p => url.includes(p));
      if (!isAllowed) {
        netFails.push('requestfailed: ' + url + ' · ' + (req.failure()?.errorText || 'unknown'));
      }
    });

    const startMs = Date.now();
    await page.goto(URL, { waitUntil: 'networkidle', timeout: ${TIMEOUT_SEC}000 });
    const ms = Date.now() - startMs;

    // C4: DOM anchor check
    let anchorCount = 0;
    const selector = ANCHOR_SELECTOR || FALLBACK_SELECTOR;
    try {
      anchorCount = await page.locator(selector).count();
    } catch (e) {
      errors.push('anchor-check-error: ' + e.message);
    }

    clearTimeout(watchdog);
    await browser.close();

    // Report
    const allErrors = [...errors, ...pageErrors, ...netFails];

    if (allErrors.length > 0) {
      console.log('FAIL');
      allErrors.forEach(e => console.log('  ERROR: ' + e));
    } else if (anchorCount <= 3 && !ANCHOR_SELECTOR) {
      console.log('FAIL');
      console.log('  ERROR: DOM anchor check failed · body > *:not(script) count=' + anchorCount + ' (expected > 3)');
      console.log('  Fix: add <meta name="wl-anchor" content="your-selector"> to configure a custom anchor');
    } else {
      console.log('PASS · ' + ms + 'ms · anchor=' + (ANCHOR_SELECTOR || FALLBACK_SELECTOR) + '(' + anchorCount + ')');
    }
  } catch (e) {
    clearTimeout(watchdog);
    if (browser) await browser.close().catch(() => {});
    console.log('FAIL');
    console.log('  ERROR: ' + e.message);
  }
})();
NODESCRIPT

  # Run the Node script; capture output
  PLAYWRIGHT_RESULT=$(node "$NODE_SCRIPT" 2>&1 || echo "EXCEPTION:$?")
  rm -f "$NODE_SCRIPT"
  # Reset the trap to just kill server (script file already removed)
  trap "kill '$SERVER_PID' 2>/dev/null || true" EXIT

  # Kill HTTP server
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true

  echo "[prototype-runtime]   result: $PLAYWRIGHT_RESULT" | tee -a "$LOG"

  if echo "$PLAYWRIGHT_RESULT" | grep -q '^PASS'; then
    RESULTS="${RESULTS}"$'\n'"PASS · $PROTO_INDEX · $(echo "$PLAYWRIGHT_RESULT" | head -1 | sed 's/^PASS · //')"
  else
    OVERALL_PASS=false
    FAIL_REASONS=$(echo "$PLAYWRIGHT_RESULT" | grep 'ERROR:' | sed 's/^  //' || echo "unknown")
    RESULTS="${RESULTS}"$'\n'"FAIL · $PROTO_INDEX · $FAIL_REASONS"
  fi

done <<< "$PROTOTYPES"

# --- final report ---
RESULTS=$(printf '%s' "$RESULTS" | grep -v '^$' || true)
PASS_COUNT=$(echo "$RESULTS" | grep -c '^PASS' || echo 0)
FAIL_COUNT=$(echo "$RESULTS" | grep -c '^FAIL' || echo 0)

echo "" | tee -a "$LOG"
echo "[prototype-runtime] --- summary ---" | tee -a "$LOG"
echo "$RESULTS" | while IFS= read -r r; do
  [[ -z "$r" ]] && continue
  echo "  $r" | tee -a "$LOG"
done
echo "[prototype-runtime] $PASS_COUNT PASS · $FAIL_COUNT FAIL" | tee -a "$LOG"

if $OVERALL_PASS; then
  echo "[prototype-runtime] PASS · all prototypes in scope loaded without errors"
  exit 0
else
  echo "[prototype-runtime] FAIL · $FAIL_COUNT prototype(s) failed runtime check" >&2
  echo "  See $LOG for detail." >&2
  exit 1
fi
