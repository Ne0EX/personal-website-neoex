#!/usr/bin/env bash
# =============================================================================
# tests/harness/audit-single-source.fixture.sh
#
# Fixture test for scripts/audit-single-source.sh
# Owner: Canopus (α-HRN-07) — TASK-2026-06-01-AUDIT-SINGLE-SOURCE
#
# IMPORTANT: This test runs entirely in a temp directory. It does NOT touch
# the live working tree. It creates a minimal fake repo structure and points
# the audit at a test registry (WL_SINGLE_SOURCE_REGISTRY) and a test repo
# root (WL_REPO_ROOT). No git state is mutated.
#
# Usage:
#   bash tests/harness/audit-single-source.fixture.sh
#
# Exit codes:
#   0 — all scenarios PASS
#   1 — one or more scenarios FAIL
#
# Scenarios:
#   F1  PASS: canonical only, no duplicates           → exit 0
#   F2  PASS: canonical + byte-identical copy         → exit 0
#   F3  PASS: canonical + importing consumer copy     → exit 0 (importer predicate)
#   F4  FAIL: canonical + divergent copy (byte-diff)  → exit 1  <-- THE BUG IT BLOCKS
#   F5  FAIL: registry file absent                    → exit 2
#   F6  FAIL: canonical path missing                  → exit 3
#   F7  FAIL: two copies — one identical, one divergent → exit 1
# =============================================================================

set -euo pipefail

REPO_ROOT_REAL="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
SCRIPT="${REPO_ROOT_REAL}/scripts/audit-single-source.sh"

PASS_COUNT=0
FAIL_COUNT=0
RESULTS=""

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
  RESULTS="${RESULTS}"$'\n'"  FAIL · $name${detail:+ — $detail}"
}

# Create a temp workspace; cleaned on EXIT regardless of outcome.
WORK=$(mktemp -d)
trap 'rm -rf "${WORK}"' EXIT

echo "audit-single-source fixture test · TASK-2026-06-01-AUDIT-SINGLE-SOURCE"
echo "$(date -u +%FT%TZ)"
echo ""

# ── Helper: write a minimal single-source registry ─────────────────────────
# Arguments: registry_path canonical_path match_pattern [search_globs_array_json]
write_registry() {
  local reg_path="$1"
  local canonical="$2"
  local match_pattern="$3"
  local globs_json="${4:-[\"copies/**\"]}"

  cat > "${reg_path}" << REGEOF
{
  "registry_version": 1,
  "artifacts": [
    {
      "id": "test-artifact",
      "description": "Test artifact for fixture",
      "canonical": "${canonical}",
      "duplicate_search_globs": ${globs_json},
      "match_pattern": "${match_pattern}"
    }
  ]
}
REGEOF
}

# ── Helper: run the audit with the given fake root and registry ─────────────
run_audit() {
  local fake_root="$1"
  local registry="$2"
  local expected_exit="$3"

  set +e
  OUT=$(WL_REPO_ROOT="${fake_root}" \
        WL_SINGLE_SOURCE_REGISTRY="${registry}" \
        bash "${SCRIPT}" 2>&1)
  ACTUAL_EXIT=$?
  set -e

  echo "${OUT}"
  echo "  (exit code: ${ACTUAL_EXIT}, expected: ${expected_exit})"

  if [[ "${ACTUAL_EXIT}" -eq "${expected_exit}" ]]; then
    return 0
  else
    return 1
  fi
}

# ===========================================================================
# F1: canonical only, no duplicates → PASS (exit 0)
# ===========================================================================
echo "[F1] canonical only, no duplicates → expect exit 0 (PASS)"
F1="${WORK}/f1"
mkdir -p "${F1}/components" "${F1}/copies" "${F1}/.claude/hook-logs"
echo "export const Globe = () => null;" > "${F1}/components/WorldlineGlobe.tsx"
write_registry "${WORK}/f1-registry.json" "components/WorldlineGlobe.tsx" "WorldlineGlobe.tsx" '["copies/**"]'

if OUT=$(run_audit "${F1}" "${WORK}/f1-registry.json" 0 2>&1); then
  scenario_pass "F1 · no duplicates → exit 0"
else
  scenario_fail "F1 · no duplicates → exit 0" "got unexpected exit or FAIL output"
fi

# ===========================================================================
# F2: canonical + byte-identical copy → PASS (exit 0)
# ===========================================================================
echo "[F2] byte-identical copy → expect exit 0 (PASS)"
F2="${WORK}/f2"
mkdir -p "${F2}/components" "${F2}/copies/sub" "${F2}/.claude/hook-logs"
echo "export const Globe = () => null;" > "${F2}/components/WorldlineGlobe.tsx"
# Byte-identical copy
cp "${F2}/components/WorldlineGlobe.tsx" "${F2}/copies/sub/WorldlineGlobe.tsx"
write_registry "${WORK}/f2-registry.json" "components/WorldlineGlobe.tsx" "WorldlineGlobe.tsx" '["copies/**"]'

if OUT=$(run_audit "${F2}" "${WORK}/f2-registry.json" 0 2>&1); then
  scenario_pass "F2 · byte-identical copy → exit 0"
else
  scenario_fail "F2 · byte-identical copy → exit 0" "$(echo "${OUT}" | tail -5)"
fi

# ===========================================================================
# F3: canonical + importing consumer copy → PASS (exit 0)
# ===========================================================================
echo "[F3] importing consumer copy → expect exit 0 (PASS)"
F3="${WORK}/f3"
mkdir -p "${F3}/components" "${F3}/copies/sub" "${F3}/.claude/hook-logs"
echo "export const Globe = () => <div>real globe</div>;" > "${F3}/components/WorldlineGlobe.tsx"
# Consumer: different content but imports the canonical via @/ alias
cat > "${F3}/copies/sub/WorldlineGlobe.tsx" << 'CONSUMER'
// This is a wrapper that imports the canonical
import { Globe } from '@/components/WorldlineGlobe';
export const MiniGlobe = () => <Globe scale={0.5} />;
CONSUMER
write_registry "${WORK}/f3-registry.json" "components/WorldlineGlobe.tsx" "WorldlineGlobe.tsx" '["copies/**"]'

if OUT=$(run_audit "${F3}" "${WORK}/f3-registry.json" 0 2>&1); then
  scenario_pass "F3 · importing consumer → exit 0"
else
  scenario_fail "F3 · importing consumer → exit 0" "$(echo "${OUT}" | tail -5)"
fi

# ===========================================================================
# F4: canonical + divergent copy (byte-diff, no import) → FAIL (exit 1)
#     THIS IS THE PRIMARY BUG-BLOCKING SCENARIO
# ===========================================================================
echo "[F4] divergent copy (neither byte-identical nor importer) → expect exit 1 (FAIL)"
F4="${WORK}/f4"
mkdir -p "${F4}/components" "${F4}/copies/worktree" "${F4}/.claude/hook-logs"
echo "export const Globe = () => null;  // canonical version" > "${F4}/components/WorldlineGlobe.tsx"
# Divergent copy: different content, no import of canonical
echo "export const Globe = () => null;  // OLD divergent prototype version with bug fixes not ported" > "${F4}/copies/worktree/WorldlineGlobe.tsx"
write_registry "${WORK}/f4-registry.json" "components/WorldlineGlobe.tsx" "WorldlineGlobe.tsx" '["copies/**"]'

set +e
OUT_F4=$(WL_REPO_ROOT="${F4}" \
         WL_SINGLE_SOURCE_REGISTRY="${WORK}/f4-registry.json" \
         bash "${SCRIPT}" 2>&1)
EXIT_F4=$?
set -e

echo "${OUT_F4}"
echo "  (exit code: ${EXIT_F4}, expected: 1)"

if [[ "${EXIT_F4}" -eq 1 ]] && echo "${OUT_F4}" | grep -q "DIVERGENT DUPLICATE"; then
  scenario_pass "F4 · divergent copy → exit 1 with DIVERGENT DUPLICATE"
else
  scenario_fail "F4 · divergent copy → exit 1 with DIVERGENT DUPLICATE" "exit=${EXIT_F4}"
fi

# ===========================================================================
# F5: registry file absent → FAIL (exit 2)
# ===========================================================================
echo "[F5] registry absent → expect exit 2"
F5="${WORK}/f5"
mkdir -p "${F5}/.claude/hook-logs"

set +e
OUT_F5=$(WL_REPO_ROOT="${F5}" \
         WL_SINGLE_SOURCE_REGISTRY="${WORK}/nonexistent-registry.json" \
         bash "${SCRIPT}" 2>&1)
EXIT_F5=$?
set -e

echo "${OUT_F5}"
echo "  (exit code: ${EXIT_F5}, expected: 2)"

if [[ "${EXIT_F5}" -eq 2 ]]; then
  scenario_pass "F5 · registry absent → exit 2"
else
  scenario_fail "F5 · registry absent → exit 2" "exit=${EXIT_F5}"
fi

# ===========================================================================
# F6: canonical file missing → FAIL (exit 3)
# ===========================================================================
echo "[F6] canonical file missing → expect exit 3"
F6="${WORK}/f6"
mkdir -p "${F6}/components" "${F6}/.claude/hook-logs"
# No WorldlineGlobe.tsx created — canonical is absent
write_registry "${WORK}/f6-registry.json" "components/WorldlineGlobe.tsx" "WorldlineGlobe.tsx" '["copies/**"]'

set +e
OUT_F6=$(WL_REPO_ROOT="${F6}" \
         WL_SINGLE_SOURCE_REGISTRY="${WORK}/f6-registry.json" \
         bash "${SCRIPT}" 2>&1)
EXIT_F6=$?
set -e

echo "${OUT_F6}"
echo "  (exit code: ${EXIT_F6}, expected: 3)"

if [[ "${EXIT_F6}" -eq 3 ]]; then
  scenario_pass "F6 · canonical missing → exit 3"
else
  scenario_fail "F6 · canonical missing → exit 3" "exit=${EXIT_F6}"
fi

# ===========================================================================
# F7: two copies — one byte-identical, one divergent → FAIL (exit 1)
#     (confirms partial-pass doesn't swallow a divergent sibling)
# ===========================================================================
echo "[F7] one identical + one divergent copy → expect exit 1 (FAIL)"
F7="${WORK}/f7"
mkdir -p "${F7}/components" "${F7}/copies/a" "${F7}/copies/b" "${F7}/.claude/hook-logs"
echo "export const Globe = () => null;" > "${F7}/components/WorldlineGlobe.tsx"
# Copy A: byte-identical — should pass
cp "${F7}/components/WorldlineGlobe.tsx" "${F7}/copies/a/WorldlineGlobe.tsx"
# Copy B: divergent — should trigger FAIL
echo "export const Globe = () => null; // stale prototype differs here" > "${F7}/copies/b/WorldlineGlobe.tsx"
write_registry "${WORK}/f7-registry.json" "components/WorldlineGlobe.tsx" "WorldlineGlobe.tsx" '["copies/**"]'

set +e
OUT_F7=$(WL_REPO_ROOT="${F7}" \
         WL_SINGLE_SOURCE_REGISTRY="${WORK}/f7-registry.json" \
         bash "${SCRIPT}" 2>&1)
EXIT_F7=$?
set -e

echo "${OUT_F7}"
echo "  (exit code: ${EXIT_F7}, expected: 1)"

if [[ "${EXIT_F7}" -eq 1 ]] && echo "${OUT_F7}" | grep -q "DIVERGENT DUPLICATE"; then
  scenario_pass "F7 · mixed (one identical + one divergent) → exit 1"
else
  scenario_fail "F7 · mixed (one identical + one divergent) → exit 1" "exit=${EXIT_F7}"
fi

# ===========================================================================
# Results
# ===========================================================================
echo ""
echo "--- audit-single-source fixture results ---"
echo "${RESULTS}" | grep -v '^$' | while IFS= read -r r; do
  if echo "${r}" | grep -q '^  PASS'; then
    printf "${GREEN}%s${NC}\n" "${r}"
  else
    printf "${RED}%s${NC}\n" "${r}"
  fi
done
echo ""
echo "  ${PASS_COUNT} PASS · ${FAIL_COUNT} FAIL"
echo ""

if [[ ${FAIL_COUNT} -eq 0 ]]; then
  echo "audit-single-source fixture test · ALL PASS"
  exit 0
else
  echo "audit-single-source fixture test · FAILURES DETECTED" >&2
  exit 1
fi
