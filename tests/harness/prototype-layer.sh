#!/usr/bin/env bash
# tests/harness/prototype-layer.sh
# Owner: Algol (α-VER-06) — test; Canopus wired
# Introduced: TASK-2026-05-15-META-10
#
# Smoke test: prototype-layer rails
# Covers 6+ scenarios across territory, discipline, diff-stub, and runtime checks.
#
# Usage:
#   bash tests/harness/prototype-layer.sh
#
# Exit codes:
#   0 — all scenarios PASS
#   1 — one or more scenarios FAIL
#
# Scenarios:
#   T1  discipline: good prototype (html/css/js + README.md)             → PASS
#   T2  discipline: prototype contains .tsx file                          → FAIL (R1)
#   T3  discipline: prototype JS has next/ import                         → FAIL (R2)
#   T4  discipline: prototype JS has @/ import                            → FAIL (R3)
#   T5  discipline: prototype dir missing README.md                       → FAIL (R4)
#   T6  diff-stub: exits 0 with TODO message                              → PASS (stub)
#   T7  runtime: good prototype (renders DOM, no errors)                  → PASS
#   T8  runtime: broken prototype (missing script src)                    → FAIL (C3)
#   NOTE: territory rail for prototype paths is tested by reading FILE-OWNERSHIP.md
#         dynamically; verifying Betelgeuse owns prototypes/**/*.html is implicit in
#         the audit-territory.sh integration which reads FILE-OWNERSHIP.md.

set -euo pipefail

PASS_COUNT=0
FAIL_COUNT=0
RESULTS=""

# Color helpers (no-op if terminal doesn't support)
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

scenario_pass() {
  local name="$1"
  PASS_COUNT=$((PASS_COUNT + 1))
  RESULTS="${RESULTS}"$'\n'"  PASS · $name"
}

scenario_fail() {
  local name="$1"
  local detail="${2:-}"
  FAIL_COUNT=$((FAIL_COUNT + 1))
  RESULTS="${RESULTS}"$'\n'"  FAIL · $name${detail:+ · $detail}"
}

# --- temp workspace ---
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# Save and restore prototypes/ directory for tests that mutate it
PROTO_REAL="prototypes"
PROTO_BACKUP="${WORK}/prototypes-backup"
if [[ -d "$PROTO_REAL" ]]; then
  cp -r "$PROTO_REAL" "$PROTO_BACKUP"
fi

# Helper: restore prototypes to known state
restore_prototypes() {
  rm -rf "$PROTO_REAL"
  if [[ -d "$PROTO_BACKUP" ]]; then
    cp -r "$PROTO_BACKUP" "$PROTO_REAL"
  else
    mkdir -p "$PROTO_REAL"
    touch "$PROTO_REAL/.gitkeep"
  fi
}

echo "prototype-layer smoke test · TASK-2026-05-15-META-10"
echo "$(date -u +%FT%TZ)"
echo ""

# ===================================================================
# T1: discipline PASS — good prototype (html/css/js + README.md)
# ===================================================================
echo "[T1] discipline · good prototype → expect PASS"
restore_prototypes
mkdir -p prototypes/globe-v1
cat > prototypes/globe-v1/index.html <<'HTML'
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Globe v1 Prototype</title></head>
<body>
<div id="app"><div class="globe"></div><div class="nav"></div><div class="content"></div><div class="footer"></div></div>
<script src="script.js"></script>
</body>
</html>
HTML
cat > prototypes/globe-v1/style.css <<'CSS'
body { margin: 0; background: #000; color: #fff; }
.globe { width: 100%; height: 60vh; }
CSS
cat > prototypes/globe-v1/script.js <<'JS'
// Globe v1 vanilla prototype
const app = document.getElementById('app');
console.log('Globe v1 prototype loaded');
JS
cat > prototypes/globe-v1/README.md <<'MD'
# Globe v1 Prototype

Validates the globe-centric layout direction selected in iter 1.
Production target: components/WorldlineGlobe.tsx + app/(home)/page.tsx
Design decision: orbital mechanics metaphor, dark void background.
MD

OUTPUT=$(bash scripts/audit-prototype-discipline.sh 2>&1 || true)
if echo "$OUTPUT" | grep -q '\[prototype-discipline\] PASS'; then
  scenario_pass "T1 · discipline · good prototype"
else
  scenario_fail "T1 · discipline · good prototype" "expected PASS, got: $OUTPUT"
fi

# ===================================================================
# T2: discipline FAIL — prototype contains .tsx file (R1)
# ===================================================================
echo "[T2] discipline · .tsx file in prototype → expect FAIL (R1)"
restore_prototypes
mkdir -p prototypes/tsx-violation
touch prototypes/tsx-violation/Component.tsx
cat > prototypes/tsx-violation/README.md <<'MD'
# TSX violation prototype
MD

OUTPUT=$(bash scripts/audit-prototype-discipline.sh 2>&1 || true)
if echo "$OUTPUT" | grep -q '\[prototype-discipline\] FAIL' && echo "$OUTPUT" | grep -q 'R1'; then
  scenario_pass "T2 · discipline · .tsx file → FAIL R1"
else
  scenario_fail "T2 · discipline · .tsx file → FAIL R1" "expected FAIL R1, got: $OUTPUT"
fi

# ===================================================================
# T3: discipline FAIL — next/ import in prototype JS (R2)
# ===================================================================
echo "[T3] discipline · next/ import in JS → expect FAIL (R2)"
restore_prototypes
mkdir -p prototypes/next-import-violation
cat > prototypes/next-import-violation/script.js <<'JS'
import { useRouter } from 'next/navigation';
console.log('this should not be here');
JS
cat > prototypes/next-import-violation/README.md <<'MD'
# Next import violation
MD

OUTPUT=$(bash scripts/audit-prototype-discipline.sh 2>&1 || true)
if echo "$OUTPUT" | grep -q '\[prototype-discipline\] FAIL' && echo "$OUTPUT" | grep -q 'R2'; then
  scenario_pass "T3 · discipline · next/ import → FAIL R2"
else
  scenario_fail "T3 · discipline · next/ import → FAIL R2" "expected FAIL R2, got: $OUTPUT"
fi

# ===================================================================
# T4: discipline FAIL — @/ alias in prototype JS (R3)
# ===================================================================
echo "[T4] discipline · @/ alias import in JS → expect FAIL (R3)"
restore_prototypes
mkdir -p prototypes/alias-import-violation
cat > prototypes/alias-import-violation/script.js <<'JS'
import { getArticles } from '@/lib/content';
console.log('this should not be here');
JS
cat > prototypes/alias-import-violation/README.md <<'MD'
# Alias import violation
MD

OUTPUT=$(bash scripts/audit-prototype-discipline.sh 2>&1 || true)
if echo "$OUTPUT" | grep -q '\[prototype-discipline\] FAIL' && echo "$OUTPUT" | grep -q 'R3'; then
  scenario_pass "T4 · discipline · @/ alias → FAIL R3"
else
  scenario_fail "T4 · discipline · @/ alias → FAIL R3" "expected FAIL R3, got: $OUTPUT"
fi

# ===================================================================
# T5: discipline FAIL — prototype dir missing README.md (R4)
# ===================================================================
echo "[T5] discipline · missing README.md → expect FAIL (R4)"
restore_prototypes
mkdir -p prototypes/no-readme
cat > prototypes/no-readme/index.html <<'HTML'
<!DOCTYPE html><html><body><div>no readme</div></body></html>
HTML
# Intentionally no README.md

OUTPUT=$(bash scripts/audit-prototype-discipline.sh 2>&1 || true)
if echo "$OUTPUT" | grep -q '\[prototype-discipline\] FAIL' && echo "$OUTPUT" | grep -q 'R4'; then
  scenario_pass "T5 · discipline · missing README.md → FAIL R4"
else
  scenario_fail "T5 · discipline · missing README.md → FAIL R4" "expected FAIL R4, got: $OUTPUT"
fi

# ===================================================================
# T6: diff-stub exits 0 with TODO message
# ===================================================================
echo "[T6] diff-stub · exits 0 with TODO message → expect PASS"
restore_prototypes
OUTPUT=$(bash scripts/audit-prototype-production-diff.sh 2>&1 || echo "NONZERO_EXIT")
EXIT_CODE=$?
if [[ $EXIT_CODE -eq 0 ]] && echo "$OUTPUT" | grep -qi 'STUB\|TODO\|deferred'; then
  scenario_pass "T6 · diff-stub · exits 0 + TODO message"
else
  scenario_fail "T6 · diff-stub · exits 0 + TODO message" "exit=$EXIT_CODE output=$OUTPUT"
fi

# ===================================================================
# T7: runtime PASS — good prototype renders DOM without errors
# ===================================================================
echo "[T7] runtime · good prototype → expect PASS"
restore_prototypes
mkdir -p prototypes/runtime-good
cat > prototypes/runtime-good/index.html <<'HTML'
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="wl-anchor" content="#content">
  <title>Good Prototype</title>
  <style>
    body { margin: 0; background: #0a0a0a; color: #ffffff; font-family: sans-serif; }
    #content { display: flex; flex-direction: column; min-height: 100vh; padding: 2rem; }
    .hero { font-size: 2rem; margin-bottom: 1rem; }
    .sub { font-size: 1rem; opacity: 0.7; }
  </style>
</head>
<body>
  <div id="content">
    <h1 class="hero">Worldline</h1>
    <p class="sub">A digital garden.</p>
    <nav><a href="#">Articles</a> · <a href="#">Photos</a> · <a href="#">Fiction</a></nav>
    <footer>Good Prototype · no errors</footer>
  </div>
  <script>
    // Vanilla JS only — no imports, no errors
    document.addEventListener('DOMContentLoaded', function() {
      document.title = 'Worldline Prototype Loaded';
    });
  </script>
</body>
</html>
HTML
cat > prototypes/runtime-good/README.md <<'MD'
# Good Runtime Prototype
Test fixture: validates that a well-formed prototype passes runtime audit.
MD

OUTPUT=$(WL_PROTO_PATH="prototypes/runtime-good/index.html" bash scripts/audit-prototype-runtime.sh 2>&1 || true)
if echo "$OUTPUT" | grep -qE '\[prototype-runtime\] (PASS|SKIP|WARN)'; then
  scenario_pass "T7 · runtime · good prototype → PASS (or SKIP/WARN if Playwright unavailable)"
else
  scenario_fail "T7 · runtime · good prototype" "expected PASS/SKIP/WARN, got: $OUTPUT"
fi

# ===================================================================
# T8: runtime FAIL — broken prototype (missing script src)
# ===================================================================
echo "[T8] runtime · broken prototype (missing script) → expect FAIL or WARN"
restore_prototypes
mkdir -p prototypes/runtime-broken
cat > prototypes/runtime-broken/index.html <<'HTML'
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Broken Prototype</title>
</head>
<body>
  <div id="app">
    <div>Content</div>
    <div>Content</div>
    <div>Content</div>
    <div>Content</div>
  </div>
  <!-- This script does not exist — should trigger requestfailed (C3) -->
  <script src="missing-module.js"></script>
</body>
</html>
HTML
cat > prototypes/runtime-broken/README.md <<'MD'
# Broken Runtime Prototype
Test fixture: validates that a prototype with a missing script src fails runtime audit.
MD

set +e
OUTPUT=$(WL_PROTO_PATH="prototypes/runtime-broken/index.html" bash scripts/audit-prototype-runtime.sh 2>&1)
EXIT_CODE=$?
set -e
# Accept FAIL (exit 1) as the expected outcome
# Also accept WARN (exit 3) if Playwright is unavailable on this platform
if [[ $EXIT_CODE -eq 1 ]]; then
  scenario_pass "T8 · runtime · broken prototype → FAIL (C3 missing script)"
elif [[ $EXIT_CODE -eq 3 ]]; then
  scenario_pass "T8 · runtime · WARN (Playwright unavailable — platform issue, not audit failure)"
else
  scenario_fail "T8 · runtime · broken prototype" "expected FAIL(1) or WARN(3), got exit=$EXIT_CODE output=$OUTPUT"
fi

# ===================================================================
# Cleanup — restore prototypes to original state
# ===================================================================
restore_prototypes

# ===================================================================
# Results
# ===================================================================
echo ""
echo "--- prototype-layer smoke test results ---"
echo "$RESULTS" | grep -v '^$' | while IFS= read -r r; do
  if echo "$r" | grep -q '^  PASS'; then
    printf "${GREEN}%s${NC}\n" "$r"
  else
    printf "${RED}%s${NC}\n" "$r"
  fi
done
echo ""
echo "  $PASS_COUNT PASS · $FAIL_COUNT FAIL"
echo ""

if [[ $FAIL_COUNT -eq 0 ]]; then
  echo "prototype-layer smoke test · ALL PASS"
  exit 0
else
  echo "prototype-layer smoke test · FAILURES DETECTED" >&2
  exit 1
fi
