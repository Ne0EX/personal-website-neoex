#!/usr/bin/env bash
# scripts/audit-render-fidelity-vs-intent.sh
#
# Owner: Algol (α-VER-06) — TASK-2026-06-01-SECURITY-HARNESS-WAVE-0-2
# Rail: render-fidelity-vs-intent
# Barrier class: HARD-BARRIER
# Mode: block
#
# PURPOSE:
#   Playwright renders the ACTUAL production route and diffs the live layout
#   signature against the design-intent manifest for that route. Exits NONZERO
#   when any of the three deterministic violations are present:
#
#     R1 (A4a) — transform !== identity where identity is expected
#     R2 (A4b) — bounding-box overlap of siblings that must not overlap
#     R3 (A4c) — overflow-clip of content where clip is forbidden
#
#   Aesthetic scoring (shadow judge) is non-blocking and never drives the exit
#   code. It runs silently inside the TS script.
#
#   BUG THIS CATCHES: /archive shipped as a crooked overlay when Peat designed
#   it as a separate page. No gate compared the rendered surface to design
#   intent. This gate would have fired nonzero on that day.
#
# USAGE:
#   bash scripts/audit-render-fidelity-vs-intent.sh <page_url> <manifest_path>
#
#   page_url      — URL of the rendered page (must be served via HTTP)
#   manifest_path — path to the design-intent manifest JSON
#                   (see .harness/render-fidelity-manifests/ for examples)
#
# ENVIRONMENT:
#   VERBOSE=true  — verbose stderr output from the TS script
#
# EXIT CODES:
#   0  — all deterministic checks pass (GREEN)
#   1  — one or more deterministic violations (RED — HARD-BARRIER)
#   2  — input malformed / manifest unreadable / coverage assertion failed
#   3  — Playwright unavailable (WARN — advisory; does not block handoff alone)
#
# LIVE-WIRING GAP (see bottom of this file for full note):
#   When the app cannot build locally (e.g. missing env vars, no velite cache),
#   the gate runs against fixture HTML instead of the real Next.js build. The
#   fixture-based path is deterministic and tests the same logic. The gap is
#   documented honestly in the LIVE-WIRING GAP section below.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/browser-fixture.sh
source "${REPO_ROOT}/scripts/lib/browser-fixture.sh"

PAGE_URL="${1:-}"
MANIFEST_PATH="${2:-$REPO_ROOT/.harness/render-fidelity-manifests/archive.json}"
VERBOSE="${VERBOSE:-false}"

if [[ -z "$PAGE_URL" ]]; then
  browser_fixture_start_next "${REPO_ROOT}" "${WL_BROWSER_PORT:-4173}" "/en/archive" || exit 2
  trap 'browser_fixture_stop' EXIT
  PAGE_URL="${BROWSER_FIXTURE_BASE_URL}/en/archive"
fi

if [[ ! -f "$MANIFEST_PATH" ]]; then
  echo "[render-fidelity] ERROR: manifest not found: $MANIFEST_PATH" >&2
  exit 2
fi

LOG_DIR="$REPO_ROOT/.claude/hook-logs"
mkdir -p "$LOG_DIR"
if [[ -n "${CLAUDE_TASK_ID:-}" ]]; then
  LOG_FILE="$LOG_DIR/${CLAUDE_TASK_ID}--render-fidelity.log"
else
  LOG_FILE="$LOG_DIR/render-fidelity--$(date -u +%Y%m%d-%H%M%S).log"
fi

echo "[render-fidelity] page_url=$PAGE_URL" >&2
echo "[render-fidelity] manifest=$MANIFEST_PATH" >&2

INPUT_JSON=$(jq -n \
  --arg page_url "$PAGE_URL" \
  --arg manifest_path "$MANIFEST_PATH" \
  --argjson verbose "$VERBOSE" \
  '{"page_url": $page_url, "manifest_path": $manifest_path, "verbose": $verbose}')

set +e
OUTPUT=$(printf '%s\n' "$INPUT_JSON" | node --import tsx "$REPO_ROOT/scripts/audit-render-fidelity-vs-intent.ts" 2>&1)
EXIT_CODE=$?
set -e

echo "$OUTPUT" | tee -a "$LOG_FILE"

if [[ $EXIT_CODE -eq 0 ]]; then
  echo "[PASS] [render-fidelity] all deterministic layout checks clean" | tee -a "$LOG_FILE"
elif [[ $EXIT_CODE -eq 1 ]]; then
  echo "[FAIL] [render-fidelity] layout signature violations found — see output above" | tee -a "$LOG_FILE"
elif [[ $EXIT_CODE -eq 3 ]]; then
  echo "[WARN] [render-fidelity] Playwright unavailable — check is skipped" | tee -a "$LOG_FILE"
  exit 3
else
  echo "[FAIL] [render-fidelity] exit code $EXIT_CODE — check stderr" | tee -a "$LOG_FILE"
fi

exit $EXIT_CODE

# ──────────────────────────────────────────────────────────────────────────────
# LIVE-WIRING GAP (honest documentation per harness discipline)
# ──────────────────────────────────────────────────────────────────────────────
#
# This gate requires a running HTTP server serving the compiled Next.js app.
# The full live-route path is:
#
#   1. npm run build  (velite + next build)
#   2. npm run start  (or next start)
#   3. bash scripts/audit-render-fidelity-vs-intent.sh \
#        http://localhost:3000/archive \
#        .harness/render-fidelity-manifests/archive.json
#
# In CI (or when the app can't build locally due to missing env vars or velite
# cache absence), the gate DOES NOT automatically run against the real route.
#
# WHAT IS SHIPPED NOW (deterministic, fixture-based):
#   - The TS script logic is complete and deterministic (all three rules).
#   - The fixture-based test (tests/harness/audit-render-fidelity-vs-intent.fixture.sh)
#     spins up temp HTML servers and verifies PASS and FAIL cases via exit code.
#   - This proves the logic is correct independently of the live build.
#
# WHAT REMAINS FOR LIVE WIRING (a later task):
#   - Wire this check into harness-check.sh for the routes listed in the
#     manifests under .harness/render-fidelity-manifests/.
#   - Confirm the Next.js build is available in CI before running.
#   - Add a skip-if-no-server guard (similar to skip_if_playwright_unavailable
#     in the prototype-runtime rail) for local-only / offline sessions.
#
# The shadow judge (aesthetic scoring) is advisory-only and never blocks. It
# currently returns a no-op note on first run because no saved baseline rects
# exist. A future task can add a "snapshot" command that saves baseline rects
# to the manifest, enabling drift detection on subsequent runs.
# ──────────────────────────────────────────────────────────────────────────────
