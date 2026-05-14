#!/usr/bin/env bash
# scripts/render-html.sh
# Minimal helper: renders a local HTML file to PNG at a given viewport using Playwright.
#
# Usage:
#   bash scripts/render-html.sh <html-path> <out-png-path> [WxH] [--stage <data-screen-label>]
#
# Arguments:
#   html-path         Absolute or relative path to the local HTML file
#   out-png-path      Where to write the output PNG
#   WxH               Viewport dimensions, default 1180x760 (format: WIDTHxHEIGHT)
#   --stage <label>   If provided, clips screenshot to the .stage element with
#                     data-screen-label="<label>" instead of full viewport
#
# Behavior:
#   - Starts a temporary HTTP server in the HTML's parent directory (handles CORS/XHR)
#   - Launches Playwright headless Chromium
#   - Loads the file via http://127.0.0.1:<ephemeral-port>/<filename>
#   - Waits for React/Babel to finish rendering (networkidle + settle delay)
#   - If --stage is given: uses Playwright locator screenshot to clip the element
#   - Otherwise: full viewport screenshot
#   - NO interactivity, NO scroll, NO clicks — first frame only
#   - Tears down HTTP server on exit
#   - Idempotent: re-running with same args produces the same output
#   - Exits 0 on success, non-zero on failure
#
# Requires: node v18+, python3, playwright installed (npx playwright@latest install chromium)
#
# Owner: Canopus (α-HRN-07)
# Part of: TASK-2026-05-14-06 render-capability infrastructure

set -euo pipefail

HTML_PATH="${1:-}"
OUT_PATH="${2:-}"
VIEWPORT="${3:-1180x760}"
STAGE_LABEL=""

# Parse optional --stage argument (must be after the first 3 positional args)
shift 3 2>/dev/null || true
while [[ $# -gt 0 ]]; do
  case "$1" in
    --stage) STAGE_LABEL="${2:-}"; shift 2 ;;
    *) echo "render-html: unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$HTML_PATH" || -z "$OUT_PATH" ]]; then
  echo "Usage: render-html.sh <html-path> <out-png-path> [WxH] [--stage <label>]" >&2
  exit 1
fi

if [[ ! -f "$HTML_PATH" ]]; then
  echo "render-html: HTML file not found: $HTML_PATH" >&2
  exit 1
fi

# Resolve to absolute paths
HTML_ABS="$(cd "$(dirname "$HTML_PATH")" && pwd)/$(basename "$HTML_PATH")"
HTML_DIR="$(dirname "$HTML_ABS")"
HTML_FILE="$(basename "$HTML_ABS")"

# Parse viewport
WIDTH="${VIEWPORT%%x*}"
HEIGHT="${VIEWPORT##*x}"

# Ensure output directory exists
mkdir -p "$(dirname "$OUT_PATH")"

# -------------------------------------------------------------------
# Locate playwright node_modules
# -------------------------------------------------------------------
find_playwright_modules() {
  if [[ -n "${PLAYWRIGHT_NODE_MODULES:-}" && -d "$PLAYWRIGHT_NODE_MODULES" ]]; then
    echo "$PLAYWRIGHT_NODE_MODULES"; return
  fi
  if [[ -d "node_modules/playwright" ]]; then
    echo "$(pwd)/node_modules"; return
  fi
  local npx_cache="${HOME}/.npm/_npx"
  if [[ -d "$npx_cache" ]]; then
    local pkg_json
    pkg_json="$(find "$npx_cache" -maxdepth 4 -name "package.json" \
      -path "*/playwright/package.json" 2>/dev/null | head -1)"
    if [[ -n "$pkg_json" ]]; then
      echo "$(dirname "$(dirname "$pkg_json")")"; return
    fi
  fi
  return 1
}

PLAYWRIGHT_MODULES="$(find_playwright_modules)" || {
  echo "render-html: playwright not found." >&2
  echo "  Install with: npx playwright@latest install chromium" >&2
  exit 2
}

# -------------------------------------------------------------------
# Pick an ephemeral port for the local HTTP server
# -------------------------------------------------------------------
pick_port() {
  python3 -c "import socket; s=socket.socket(); s.bind(('127.0.0.1',0)); print(s.getsockname()[1]); s.close()"
}
HTTP_PORT="$(pick_port)"

# Start HTTP server; serve the HTML's parent directory
python3 -m http.server "$HTTP_PORT" --bind 127.0.0.1 \
  --directory "$HTML_DIR" \
  &>/tmp/render-html-http-$$.log &
HTTP_PID=$!

# Cleanup on exit
cleanup() {
  kill "$HTTP_PID" 2>/dev/null || true
  rm -f "$TMP_SCRIPT" 2>/dev/null || true
}
trap cleanup EXIT

# Wait briefly for server to be ready
sleep 0.4

# Build URL
PAGE_URL="http://127.0.0.1:${HTTP_PORT}/${HTML_FILE}"

# -------------------------------------------------------------------
# Write the Node.js render script to a temp file
# -------------------------------------------------------------------
TMP_SCRIPT="$(mktemp /tmp/render-html-XXXXXX.cjs)"

cat > "$TMP_SCRIPT" <<'NODE_EOF'
// Playwright stage-aware screenshot helper
// Called by render-html.sh — do not invoke directly
'use strict';
const { chromium } = require('playwright');

(async () => {
  const url        = process.argv[2];
  const outPath    = process.argv[3];
  const width      = parseInt(process.argv[4], 10);
  const height     = parseInt(process.argv[5], 10);
  const stageLabel = process.argv[6] || '__none__';

  if (!url || !outPath || isNaN(width) || isNaN(height)) {
    console.error('render-html node script: missing arguments');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport:          { width, height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // Suppress console noise from the design tool's omelette scripts
  page.on('console', () => {});
  page.on('pageerror', () => {});

  // Load via local HTTP server (avoids CORS/XHR restrictions on file://)
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  // Wait for at least one .stage element (React has rendered)
  try {
    await page.waitForSelector('.stage', { timeout: 15000 });
  } catch (e) {
    console.error('render-html: no .stage elements found after 15 s');
    await browser.close();
    process.exit(2);
  }

  // Settle time: let CSS animations reach their first keyframe
  await page.waitForTimeout(800);

  if (stageLabel !== '__none__') {
    // Playwright locator screenshot — clips exactly to the element's bounding box
    const escaped  = stageLabel.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const selector = `.stage[data-screen-label="${escaped}"]`;
    const locator  = page.locator(selector);
    const count    = await locator.count();
    if (count === 0) {
      console.error('render-html: stage not found: ' + stageLabel);
      await browser.close();
      process.exit(3);
    }
    await locator.first().screenshot({ path: outPath, type: 'png' });
  } else {
    // Full viewport — no scroll, no interaction
    await page.screenshot({ path: outPath, type: 'png', fullPage: false });
  }

  await browser.close();
  process.exit(0);
})().catch((err) => {
  console.error('render-html fatal:', err.message);
  process.exit(99);
});
NODE_EOF

# -------------------------------------------------------------------
# Execute
# -------------------------------------------------------------------
NODE_PATH="$PLAYWRIGHT_MODULES" \
  node "$TMP_SCRIPT" \
    "$PAGE_URL" \
    "$OUT_PATH" \
    "$WIDTH" \
    "$HEIGHT" \
    "${STAGE_LABEL:-__none__}"
