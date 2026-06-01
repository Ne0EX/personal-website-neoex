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
#   F1   PASS: canonical only, no duplicates                      → exit 0
#   F2   PASS: canonical + byte-identical copy                    → exit 0
#   F3   PASS: canonical + importing consumer copy                → exit 0 (importer predicate)
#   F4   FAIL: canonical + divergent copy (byte-diff)             → exit 1  <-- THE PRIMARY BUG
#   F5   FAIL: registry file absent                               → exit 2
#   F6   FAIL: canonical path missing                             → exit 3
#   F7   FAIL: two copies — one identical, one divergent          → exit 1
#   F8   FAIL: Helper-named import NOT accepted as canonical      → exit 1  <-- B1 bypass regression
#             import './WorldlineGlobeHelper' must not satisfy importer predicate
#   F9   FAIL: .jsx copy of .tsx canonical escapes -name match    → exit 1  <-- B3 bypass regression
#             extension-variant scan must catch WorldlineGlobe.jsx
#   F10  PASS: bare-basename relative import still accepted       → exit 0  (B1 fix regression guard)
#   F11  FAIL: comment-alias mention (@/-alias in // comment)     → exit 1  <-- B4 bypass (comment-alias)
#             `// copied from @/components/WorldlineGlobe` MUST NOT satisfy importer predicate
#   F11b FAIL: "// see @/... for reference" comment               → exit 1  <-- B4 bypass (see-comment)
#             `// see @/components/WorldlineGlobe for reference` MUST NOT satisfy importer predicate
#   F12  FAIL: empty artifacts array (artifacts: [])              → exit 2  <-- EMPTY-REGISTRY false-green
#             an empty artifact list is a config error, not a passing state
#   F13  FAIL: missing 'artifacts' key (typo'd as 'artifact')     → exit 2  <-- EMPTY-REGISTRY missing-key
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
# F8: B1-bypass closed — Helper-named importer must NOT satisfy predicate
#     Regression for: "import './WorldlineGlobeHelper'" was falsely counted
#     as a legitimate importer, allowing a divergent WorldlineGlobe copy to
#     exit 0. Anchored pattern must require the match to end at the basename
#     boundary (quote or extension character). SHOULD-FAIL (exit 1).
# ===========================================================================
echo "[F8] SHOULD-FAIL · Helper-named import does NOT satisfy importer predicate → expect exit 1"
F8="${WORK}/f8"
mkdir -p "${F8}/components" "${F8}/copies/sub" "${F8}/.claude/hook-logs"
echo "export const Globe = () => <div>canonical globe</div>;" > "${F8}/components/WorldlineGlobe.tsx"
# Divergent copy: different content, but ONLY imports WorldlineGlobeHelper
# (not WorldlineGlobe). The old substring match accepted this; the anchored
# pattern must reject it.
cat > "${F8}/copies/sub/WorldlineGlobe.tsx" << 'HELPER_CONSUMER'
// This file imports WorldlineGlobeHelper, NOT WorldlineGlobe.
// The old importer predicate (substring) falsely matched this.
import { GlobeHelper } from './WorldlineGlobeHelper';
export const AltGlobe = () => <GlobeHelper scale={1} />;
HELPER_CONSUMER
write_registry "${WORK}/f8-registry.json" "components/WorldlineGlobe.tsx" "WorldlineGlobe.tsx" '["copies/**"]'

set +e
OUT_F8=$(WL_REPO_ROOT="${F8}" \
         WL_SINGLE_SOURCE_REGISTRY="${WORK}/f8-registry.json" \
         bash "${SCRIPT}" 2>&1)
EXIT_F8=$?
set -e

echo "${OUT_F8}"
echo "  (exit code: ${EXIT_F8}, expected: 1)"

# This MUST exit 1 (divergent). If it exits 0 the bypass is still open.
if [[ "${EXIT_F8}" -eq 1 ]] && echo "${OUT_F8}" | grep -q "DIVERGENT DUPLICATE"; then
  scenario_pass "F8 · Helper-import NOT accepted as canonical importer → exit 1 (bypass closed)"
else
  scenario_fail "F8 · Helper-import NOT accepted as canonical importer → exit 1" \
    "exit=${EXIT_F8} — bypass B1 still open if exit=0"
fi

# ===========================================================================
# F9: B3-bypass closed — .jsx copy of .tsx canonical escapes exact -name match
#     Regression for: find -name "WorldlineGlobe.tsx" misses WorldlineGlobe.jsx.
#     The extension-variant expansion must catch the .jsx copy. SHOULD-FAIL (exit 1).
# ===========================================================================
echo "[F9] SHOULD-FAIL · .jsx copy of .tsx canonical is caught → expect exit 1"
F9="${WORK}/f9"
mkdir -p "${F9}/components" "${F9}/copies/sub" "${F9}/.claude/hook-logs"
echo "export const Globe = () => <div>canonical</div>;" > "${F9}/components/WorldlineGlobe.tsx"
# Divergent copy with .jsx extension — different content, no import of canonical.
# The old exact -name "WorldlineGlobe.tsx" predicate silently skipped this file.
echo "export const Globe = () => <div>old jsx copy — not ported</div>;" > "${F9}/copies/sub/WorldlineGlobe.jsx"
write_registry "${WORK}/f9-registry.json" "components/WorldlineGlobe.tsx" "WorldlineGlobe.tsx" '["copies/**"]'

set +e
OUT_F9=$(WL_REPO_ROOT="${F9}" \
         WL_SINGLE_SOURCE_REGISTRY="${WORK}/f9-registry.json" \
         bash "${SCRIPT}" 2>&1)
EXIT_F9=$?
set -e

echo "${OUT_F9}"
echo "  (exit code: ${EXIT_F9}, expected: 1)"

# This MUST exit 1 (divergent). If it exits 0 the .jsx extension escapes detection.
if [[ "${EXIT_F9}" -eq 1 ]] && echo "${OUT_F9}" | grep -q "DIVERGENT DUPLICATE"; then
  scenario_pass "F9 · .jsx divergent copy caught by extension-variant scan → exit 1 (bypass closed)"
else
  scenario_fail "F9 · .jsx divergent copy caught by extension-variant scan → exit 1" \
    "exit=${EXIT_F9} — bypass B3 still open if exit=0"
fi

# ===========================================================================
# F10: PASS — anchored importer pattern still accepts legitimate relative imports
#      Ensures the B1 anchor fix does not break the passing case from F3.
#      A file with: import { Globe } from './WorldlineGlobe'  MUST still exit 0.
# ===========================================================================
echo "[F10] PASS · legitimate bare-basename relative import still accepted → expect exit 0"
F10="${WORK}/f10"
mkdir -p "${F10}/components" "${F10}/copies/sub" "${F10}/.claude/hook-logs"
echo "export const Globe = () => <div>real globe</div>;" > "${F10}/components/WorldlineGlobe.tsx"
# Consumer: imports canonical via bare basename (no extension, quote-terminated).
# This is the legitimate pattern that must continue to pass after the B1 fix.
cat > "${F10}/copies/sub/WorldlineGlobe.tsx" << 'LEGIT_CONSUMER'
// Legitimate consumer — bare-basename import, no extension
import { Globe } from './WorldlineGlobe';
export const MiniGlobe = () => <Globe scale={0.5} />;
LEGIT_CONSUMER
write_registry "${WORK}/f10-registry.json" "components/WorldlineGlobe.tsx" "WorldlineGlobe.tsx" '["copies/**"]'

if OUT=$(run_audit "${F10}" "${WORK}/f10-registry.json" 0 2>&1); then
  scenario_pass "F10 · bare-basename relative import still passes after B1 anchor fix → exit 0"
else
  scenario_fail "F10 · bare-basename relative import still passes after B1 anchor fix → exit 0" \
    "B1 anchor fix broke legitimate importer detection"
fi

# ===========================================================================
# F11: B4-bypass closed — comment-only @/-alias mention MUST NOT satisfy importer
#      A divergent copy whose only canonical-path mention is inside a // comment
#      was previously accepted as a legitimate importer (bare grep -q matched).
#      SHOULD-FAIL (exit 1).
# ===========================================================================
echo "[F11] SHOULD-FAIL · comment-alias mention does NOT satisfy importer predicate → expect exit 1"
F11="${WORK}/f11"
mkdir -p "${F11}/components" "${F11}/copies/sub" "${F11}/.claude/hook-logs"
echo "export const Globe = () => <div>canonical</div>;" > "${F11}/components/WorldlineGlobe.tsx"
# Divergent copy: different content. The ONLY mention of @/components/WorldlineGlobe
# is inside a // comment. The old bare grep matched this; the anchored predicate must not.
cat > "${F11}/copies/sub/WorldlineGlobe.tsx" << 'COMMENT_ONLY'
// copied from @/components/WorldlineGlobe — old prototype, divergent
export const Globe = () => <div>stale copy — not ported</div>;
COMMENT_ONLY
write_registry "${WORK}/f11-registry.json" "components/WorldlineGlobe.tsx" "WorldlineGlobe.tsx" '["copies/**"]'

set +e
OUT_F11=$(WL_REPO_ROOT="${F11}" \
          WL_SINGLE_SOURCE_REGISTRY="${WORK}/f11-registry.json" \
          bash "${SCRIPT}" 2>&1)
EXIT_F11=$?
set -e

echo "${OUT_F11}"
echo "  (exit code: ${EXIT_F11}, expected: 1)"

# MUST exit 1 (divergent). exit 0 means the comment-alias bypass is still open.
if [[ "${EXIT_F11}" -eq 1 ]] && echo "${OUT_F11}" | grep -q "DIVERGENT DUPLICATE"; then
  scenario_pass "F11 · comment-alias NOT accepted as importer → exit 1 (B4 bypass closed)"
else
  scenario_fail "F11 · comment-alias NOT accepted as importer → exit 1" \
    "exit=${EXIT_F11} — bypass B4 still open if exit=0"
fi

# ===========================================================================
# F11b: B4-bypass closed — "// see @/... for reference" MUST NOT satisfy importer
#       Second fixture form: a reference comment with 'see @/...' wording.
#       SHOULD-FAIL (exit 1).
# ===========================================================================
echo "[F11b] SHOULD-FAIL · '// see @/...' reference comment does NOT satisfy importer → expect exit 1"
F11B="${WORK}/f11b"
mkdir -p "${F11B}/components" "${F11B}/copies/sub" "${F11B}/.claude/hook-logs"
echo "export const Globe = () => <div>canonical</div>;" > "${F11B}/components/WorldlineGlobe.tsx"
# Divergent copy: contains "// see @/components/WorldlineGlobe for reference" comment
# but no import statement. The comment mention must not satisfy the importer predicate.
cat > "${F11B}/copies/sub/WorldlineGlobe.tsx" << 'SEE_COMMENT'
// see @/components/WorldlineGlobe for reference
export const Globe = () => <div>stale copy with see-comment</div>;
SEE_COMMENT
write_registry "${WORK}/f11b-registry.json" "components/WorldlineGlobe.tsx" "WorldlineGlobe.tsx" '["copies/**"]'

set +e
OUT_F11B=$(WL_REPO_ROOT="${F11B}" \
           WL_SINGLE_SOURCE_REGISTRY="${WORK}/f11b-registry.json" \
           bash "${SCRIPT}" 2>&1)
EXIT_F11B=$?
set -e

echo "${OUT_F11B}"
echo "  (exit code: ${EXIT_F11B}, expected: 1)"

if [[ "${EXIT_F11B}" -eq 1 ]] && echo "${OUT_F11B}" | grep -q "DIVERGENT DUPLICATE"; then
  scenario_pass "F11b · 'see @/...' reference comment NOT accepted as importer → exit 1 (B4 bypass closed)"
else
  scenario_fail "F11b · 'see @/...' reference comment NOT accepted as importer → exit 1" \
    "exit=${EXIT_F11B} — bypass B4 still open if exit=0"
fi

# ===========================================================================
# F12: EMPTY-REGISTRY false-green closed — empty artifacts array → FAIL (exit 2)
#      An artifacts: [] registry was previously exit 0 ("checking 0 artifacts").
#      This is a configuration error; an empty list proves nothing.
#      SHOULD-FAIL (exit 2).
# ===========================================================================
echo "[F12] SHOULD-FAIL · empty artifacts array → expect exit 2 (config error)"
F12="${WORK}/f12"
mkdir -p "${F12}/.claude/hook-logs"

cat > "${WORK}/f12-registry.json" << 'EMPTYLIST'
{
  "registry_version": 1,
  "artifacts": []
}
EMPTYLIST

set +e
OUT_F12=$(WL_REPO_ROOT="${F12}" \
          WL_SINGLE_SOURCE_REGISTRY="${WORK}/f12-registry.json" \
          bash "${SCRIPT}" 2>&1)
EXIT_F12=$?
set -e

echo "${OUT_F12}"
echo "  (exit code: ${EXIT_F12}, expected: 2)"

if [[ "${EXIT_F12}" -eq 2 ]]; then
  scenario_pass "F12 · empty artifacts array → exit 2 (empty-registry false-green closed)"
else
  scenario_fail "F12 · empty artifacts array → exit 2" \
    "exit=${EXIT_F12} — empty-registry false-green still open if exit=0"
fi

# ===========================================================================
# F13: EMPTY-REGISTRY false-green closed — missing artifacts key → FAIL (exit 2)
#      A registry without an 'artifacts' key entirely (typo'd key name, e.g.
#      "artifact" or "items") silently produced exit 0. Must exit 2 (malformed).
#      SHOULD-FAIL (exit 2).
# ===========================================================================
echo "[F13] SHOULD-FAIL · missing 'artifacts' key in registry → expect exit 2 (malformed)"
F13="${WORK}/f13"
mkdir -p "${F13}/.claude/hook-logs"

# Registry uses a typo'd key "artifact" instead of "artifacts"
cat > "${WORK}/f13-registry.json" << 'MISSINGKEY'
{
  "registry_version": 1,
  "artifact": [
    {
      "id": "test",
      "description": "This key is misnamed — will be invisible to .artifacts accessor",
      "canonical": "components/WorldlineGlobe.tsx",
      "duplicate_search_globs": ["copies/**"],
      "match_pattern": "WorldlineGlobe.tsx"
    }
  ]
}
MISSINGKEY

set +e
OUT_F13=$(WL_REPO_ROOT="${F13}" \
          WL_SINGLE_SOURCE_REGISTRY="${WORK}/f13-registry.json" \
          bash "${SCRIPT}" 2>&1)
EXIT_F13=$?
set -e

echo "${OUT_F13}"
echo "  (exit code: ${EXIT_F13}, expected: 2)"

if [[ "${EXIT_F13}" -eq 2 ]]; then
  scenario_pass "F13 · missing 'artifacts' key → exit 2 (malformed registry)"
else
  scenario_fail "F13 · missing 'artifacts' key → exit 2" \
    "exit=${EXIT_F13} — missing-key false-green still open if exit=0"
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
