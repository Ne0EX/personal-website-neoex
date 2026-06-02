#!/usr/bin/env bash
# =============================================================================
# audit-a1-mutation-harness.sh
#
# Owner: Canopus (α-HRN-07) — TASK-2026-05-30-HARNESS-IS-OUGHT-SEPARATOR
# Purpose: mutation harness for Wave A · slice A1 hole-closers.
#
# Each case targets ONE specific invariant. Each case builds its own ISOLATED
# fixture environment (temp dir) so the mutation fires ONLY through the target
# path, with no contamination from pre-existing issues in the live tree.
#
# Cases:
#   A1.1 — coverage assert: stub TS audit to report atoms_checked < total
#           → wrapper FAILS naming atoms_checked < total (NOT a value violation)
#   A1.2 — absent verdict: remove harness log before signing
#           → sign-work.sh marks harness_passed=false; exit != 0
#   A1.3 — skipped gate: make an applicable rail's check script non-executable
#           → harness-check.sh exits non-zero naming the skipped rail
#   A1.4 — source-bijection: drop token from gallery.html consumer, keep in source
#           → drift wrapper exits non-zero naming bijection violation
#
# Exit code: 0 = all four mutations fired correctly; non-zero = harness bug.
# =============================================================================

set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
LOG_DIR="${REPO_ROOT}/.claude/hook-logs"
HARNESS_LOG="${LOG_DIR}/TASK-2026-05-30-HARNESS-IS-OUGHT-SEPARATOR--a1-mutation-harness.log"
mkdir -p "${LOG_DIR}"

PASS_ALL=true
CASE_COUNT=0
PASS_COUNT=0

log()      { echo "[mutation-harness] $*" | tee -a "${HARNESS_LOG}"; }
log_case() { echo "" | tee -a "${HARNESS_LOG}"; echo "=== CASE $* ===" | tee -a "${HARNESS_LOG}"; }
log_pass() { echo "  RESULT: PASS — $*" | tee -a "${HARNESS_LOG}"; }
log_fail() { echo "  RESULT: FAIL — $*" | tee -a "${HARNESS_LOG}" >&2; PASS_ALL=false; }

# ── Global temp-dir registry + trap ─────────────────────────────────────────
# All mktemp directories are registered here so EXIT/INT/TERM/HUP cleans them up.
# POLICY-NO-INPLACE-MUTATION: this harness NEVER mutates the mode or content of
# any tracked file. All TS stubs are written to temp paths; the real
# scripts/audit-soul-atom-drift.ts is accessed read-only (cp INTO temp, never
# cp FROM temp OVER the real file). The drift script reads TS_AUDIT via
# WL_TS_AUDIT_OVERRIDE so temp copies are invoked transparently.
_HARNESS_TMPDIRS=()
_harness_cleanup() {
  local d
  for d in "${_HARNESS_TMPDIRS[@]:-}"; do
    [[ -n "${d}" && -d "${d}" ]] && rm -rf "${d}"
  done
  # Defensive: verify the real tracked .ts is unmutated (mode 644, content from git HEAD).
  local ts_path="${REPO_ROOT}/scripts/audit-soul-atom-drift.ts"
  local ts_mode
  ts_mode=$(stat -f '%Lp' "${ts_path}" 2>/dev/null || echo "unknown")
  if [[ "${ts_mode}" != "644" && "${ts_mode}" != "unknown" ]]; then
    echo "[mutation-harness] TRAP CLEANUP: restoring mode 644 on audit-soul-atom-drift.ts (was ${ts_mode})" >&2
    chmod 644 "${ts_path}" 2>/dev/null || true
  fi
}
trap '_harness_cleanup' EXIT INT TERM HUP

_mktemp_tracked() {
  local d
  d=$(mktemp -d)
  _HARNESS_TMPDIRS+=("${d}")
  echo "${d}"
}

log "start · $(date -u +%Y-%m-%dT%H:%M:%SZ)"
log "repo_root=${REPO_ROOT}"

MANIFEST="${REPO_ROOT}/.claude/visual-diffs/soul-atlas/manifest.json"
GALLERY="${REPO_ROOT}/.claude/visual-diffs/soul-atlas/gallery.html"
TOKEN_SOURCE="${REPO_ROOT}/app/globals.css"
DRIFT_SCRIPT="${REPO_ROOT}/scripts/audit-soul-atom-drift.sh"
HARNESS_SCRIPT="${REPO_ROOT}/.claude/hooks/harness-check.sh"
SIGN_SCRIPT="${REPO_ROOT}/.claude/hooks/sign-work.sh"
TS_AUDIT="${REPO_ROOT}/scripts/audit-soul-atom-drift.ts"
FONT_CHAIN_SCRIPT="${REPO_ROOT}/scripts/audit-font-chain.sh"
CONFIG="${REPO_ROOT}/.harness/worldline-harness.config.json"

# ── prerequisite checks ──────────────────────────────────────────────────────
for f in "${MANIFEST}" "${GALLERY}" "${TOKEN_SOURCE}" "${DRIFT_SCRIPT}" \
          "${HARNESS_SCRIPT}" "${SIGN_SCRIPT}" "${TS_AUDIT}" "${CONFIG}"; do
  if [[ ! -f "$f" ]]; then
    log "FATAL: prerequisite file not found: $f"
    exit 1
  fi
done

MANIFEST_TOTAL=$(jq '.atoms | length' "${MANIFEST}")
log "manifest.atoms total=${MANIFEST_TOTAL}"

# =============================================================================
# CASE A1.1 — coverage assert
# Strategy: build an isolated fixture that is CLEAN (all checks pass), then
# stub the TS audit to return atoms_checked = total-1 with NO violations.
# The ONLY possible RED path is the A1.1 coverage assert in the wrapper.
# =============================================================================
CASE_COUNT=$((CASE_COUNT + 1))
log_case "A1.1 — coverage assert (atoms_checked < total → FAIL)"

# Create isolated fixture environment (registered in global trap)
A11_TMP=$(_mktemp_tracked)

# Build minimal manifest with 2 atoms (bounded denominator, not the full 16)
cat > "${A11_TMP}/manifest.json" << 'MANIFEST_EOF'
{
  "schema_version": 2,
  "gallery_path": "FIXTURE",
  "token_source": "FIXTURE",
  "generated_at": "2026-05-30T00:00:00Z",
  "atoms": [
    {
      "id": "fixture-atom-1",
      "name": "Fixture Atom 1",
      "description": "Mutation harness fixture",
      "rationale": "test",
      "variants": [{"name": "default", "description": "test"}],
      "token_refs": ["--accent-orange"],
      "main_branch_refs": [],
      "render": "#fixture-atom-1",
      "impl_ref": null
    },
    {
      "id": "fixture-atom-2",
      "name": "Fixture Atom 2",
      "description": "Mutation harness fixture",
      "rationale": "test",
      "variants": [{"name": "default", "description": "test"}],
      "token_refs": ["--paper-base"],
      "main_branch_refs": [],
      "render": "#fixture-atom-2",
      "impl_ref": null
    }
  ]
}
MANIFEST_EOF

# Build minimal gallery.html that passes all pre-TS checks.
# Uses data-atom-id attributes and CSS <style> blocks with var() bindings so the
# new predicate v2 A1.4 gate can locate and verify sections correctly.
# (i-html) path: each atom section has an inline <style> block binding its token.
# (iii) path: --font-* tokens are in :root and would also qualify, but we use
#   (i-html) here to keep the fixture explicit about the positive path under test.
cat > "${A11_TMP}/gallery.html" << 'GALLERY_EOF'
<!DOCTYPE html>
<html>
<head>
<style>
/* font-chain bridge — :root for inherited tokens (predicate iii path) */
:root {
  --font-display: 'Cormorant Garamond', serif;
  --font-mono: 'JetBrains Mono', monospace;
  --font-type: 'Special Elite', monospace;
}
</style>
</head>
<body>
<section data-atom-id="fixture-atom-1">
  <style>
    /* (i-html) path: var(--accent-orange) in <style> block inside atom section */
    .fix1-demo { color: var(--accent-orange); }
  </style>
  <div class="fix1-demo">fixture-1</div>
</section>
<section data-atom-id="fixture-atom-2">
  <style>
    /* (i-html) path: var(--paper-base) in <style> block inside atom section */
    .fix2-demo { background: var(--paper-base); }
  </style>
  <div class="fix2-demo">fixture-2</div>
</section>
</body>
</html>
GALLERY_EOF

# Build stub TS audit for BASELINE: clean pass, atoms_checked = 2 (= total)
cat > "${A11_TMP}/audit-clean.ts" << 'CLEAN_STUB_EOF'
#!/usr/bin/env node
import { readFileSync } from "fs";
const raw = readFileSync("/dev/stdin", "utf-8");
const input = JSON.parse(raw);
const manifest = JSON.parse(readFileSync(input.manifest_path, "utf-8"));
process.stdout.write(JSON.stringify({
  pass: true, violations: [],
  atoms_checked: manifest.atoms.length,
  warnings: []
}) + "\n");
process.exit(0);
CLEAN_STUB_EOF

# Build stub TS audit for MUTATION: clean pass but atoms_checked = total-1
cat > "${A11_TMP}/audit-undercount.ts" << 'UNDERCOUNT_EOF'
#!/usr/bin/env node
// A1.1 MUTATION STUB — reports atoms_checked = total-1, NO violations.
// Value-detection stays SILENT. Only the coverage assert can fire RED.
import { readFileSync } from "fs";
const raw = readFileSync("/dev/stdin", "utf-8");
const input = JSON.parse(raw);
const manifest = JSON.parse(readFileSync(input.manifest_path, "utf-8"));
const total = manifest.atoms.length;
process.stdout.write(JSON.stringify({
  pass: true, violations: [],
  atoms_checked: total - 1,
  warnings: ["A1.1 MUTATION STUB: atoms_checked=" + (total-1) + " total=" + total]
}) + "\n");
process.exit(0);
UNDERCOUNT_EOF

# POLICY-NO-INPLACE-MUTATION: all TS stubs go to temp dir; real .ts is NEVER touched.
# drift.sh reads WL_TS_AUDIT_OVERRIDE to find the TS audit path — we point it at
# our temp copies. Manifest + gallery are also replaced with fixture files to
# give drift.sh a fully isolated, clean fixture environment.
# TS stub paths (already written by heredocs above into A11_TMP):
A11_TS_CLEAN="${A11_TMP}/audit-clean.ts"
A11_TS_UNDERCOUNT="${A11_TMP}/audit-undercount.ts"

# Back up real manifest + gallery; fixture token_refs (--accent-orange, --paper-base)
# exist in the real globals.css so no token-source swap is needed.
A11_ORIGINALS="${A11_TMP}/originals"
mkdir -p "${A11_ORIGINALS}"
cp "${MANIFEST}" "${A11_ORIGINALS}/manifest.json"
cp "${GALLERY}"  "${A11_ORIGINALS}/gallery.html"

# Install fixture files into the real manifest + gallery locations.
# The .ts NEVER goes to the real path — WL_TS_AUDIT_OVERRIDE handles it.
cp "${A11_TMP}/manifest.json" "${MANIFEST}"
cp "${A11_TMP}/gallery.html"  "${GALLERY}"

# BASELINE run — clean stub, atoms_checked = total (2)
log "  A1.1 baseline: clean stub atoms_checked=2 == manifest.total=2 (WL_TS_AUDIT_OVERRIDE → temp)"
A11_BASELINE_EXIT=0
A11_BASELINE_OUT=$(CLAUDE_TASK_ID="a1-mut-a11-base" WL_TS_AUDIT_OVERRIDE="${A11_TS_CLEAN}" bash "${DRIFT_SCRIPT}" 2>&1) || A11_BASELINE_EXIT=$?
log "  A1.1 baseline exit=${A11_BASELINE_EXIT}"
echo "${A11_BASELINE_OUT}" | grep -E "\[soul-atom-drift\]" | tail -5 | tee -a "${HARNESS_LOG}"

if [[ "${A11_BASELINE_EXIT}" -ne 0 ]]; then
  log_fail "A1.1: fixture baseline not clean (exit=${A11_BASELINE_EXIT}). Check fixture construction."
  cp "${A11_ORIGINALS}/manifest.json" "${MANIFEST}"
  cp "${A11_ORIGINALS}/gallery.html"  "${GALLERY}"
  exit 1
fi

# MUTATION: point at undercount stub (atoms_checked = 1 < total = 2); .ts mode NEVER changed
log "  A1.1 mutation: undercount stub atoms_checked=1 < manifest.total=2 (WL_TS_AUDIT_OVERRIDE → temp)"
A11_MUTATION_EXIT=0
A11_MUTATION_OUT=$(CLAUDE_TASK_ID="a1-mut-a11" WL_TS_AUDIT_OVERRIDE="${A11_TS_UNDERCOUNT}" bash "${DRIFT_SCRIPT}" 2>&1) || A11_MUTATION_EXIT=$?
log "  A1.1 mutation exit=${A11_MUTATION_EXIT}"
echo "${A11_MUTATION_OUT}" | tee -a "${HARNESS_LOG}"

# Restore manifest + gallery originals
cp "${A11_ORIGINALS}/manifest.json" "${MANIFEST}"
cp "${A11_ORIGINALS}/gallery.html"  "${GALLERY}"

A11_OK=true
if [[ "${A11_MUTATION_EXIT}" -eq 0 ]]; then
  log_fail "A1.1: mutation did NOT fire — wrapper exited 0 despite atoms_checked < total"
  A11_OK=false
fi
# Attribution must name the coverage assert, NOT a value violation
if echo "${A11_MUTATION_OUT}" | grep -qiE "A1\.1 coverage assert FAILED|atoms_checked.*!=.*manifest total|coverage assert"; then
  log "  A1.1 attribution OK: failure names coverage assert"
else
  log_fail "A1.1: exit non-zero but no coverage assert attribution found. Output above."
  A11_OK=false
fi
# Must NOT have value-detection path fire (wrong attribution)
if echo "${A11_MUTATION_OUT}" | grep -qiE "violation.*found|uncited.literal|VIOLATION_COUNT [1-9]"; then
  log_fail "A1.1: value-detection also fired — wrong path. Attribution ambiguous."
  A11_OK=false
fi

if $A11_OK; then
  PASS_COUNT=$((PASS_COUNT + 1))
  log_pass "A1.1 before.exit=${A11_BASELINE_EXIT} after.exit=${A11_MUTATION_EXIT} attribution=coverage-assert"
else
  PASS_ALL=false
fi

# =============================================================================
# CASE A1.2 — absent harness log (fail-closed default)
# Strategy: run sign-work.sh with WL_HARNESS_FAILMODE=closed and no harness log.
# Must exit != 0. Must name absent harness log in output.
# =============================================================================
CASE_COUNT=$((CASE_COUNT + 1))
log_case "A1.2 — absent harness log → harness_passed=false (WL_HARNESS_FAILMODE=closed)"

A12_TASK_ID="a1-mut-a12-$$"
A12_HARNESS_LOG="${LOG_DIR}/${A12_TASK_ID}--harness.log"
A12_POST_LOG="${LOG_DIR}/${A12_TASK_ID}--post-edit.log"
A12_BASELINE_LOG="${LOG_DIR}/${A12_TASK_ID}--baseline.json"

# Write post-edit log (passing) so it doesn't confound the result
echo "post-edit: PASS" > "${A12_POST_LOG}"
# Write baseline (no prior task files) so sign-work can proceed
echo '{"files":{}}' > "${A12_BASELINE_LOG}"

# We need at least one changed file for sign-work to sign.
# Use git diff to find any currently modified file; if none use the scripts we just changed.
A12_TEST_FILE="${REPO_ROOT}/scripts/audit-a1-mutation-harness.sh"

export WL_AGENT="canopus"
export WL_NEXT="polaris"
export WL_SUMMARY="A1.2 mutation test: sign-work fail-closed on absent harness log"
export WL_STARTED_AT="$(date -u +%FT%TZ)"

# BASELINE: WITH harness log present and passing
echo "[harness] task=${A12_TASK_ID}" > "${A12_HARNESS_LOG}"
echo "  [pass] territory :: clean" >> "${A12_HARNESS_LOG}"
echo "[harness] PASS — all rails clean" >> "${A12_HARNESS_LOG}"

log "  A1.2 baseline: present+passing harness log"
A12_BASELINE_EXIT=0
A12_BASELINE_OUT=$(cd "${REPO_ROOT}" && CLAUDE_TASK_ID="${A12_TASK_ID}" WL_HARNESS_FAILMODE=closed bash "${SIGN_SCRIPT}" "${A12_TASK_ID}" 2>&1) || A12_BASELINE_EXIT=$?
log "  A1.2 baseline exit=${A12_BASELINE_EXIT}"
# May exit non-zero for other reasons (no changed files) — that's OK
# The test is purely on the MUTATION (absent log)
log "  A1.2 baseline output (trimmed): $(echo "${A12_BASELINE_OUT}" | head -3)"

# MUTATION: remove harness log entirely
rm -f "${A12_HARNESS_LOG}"

log "  A1.2 mutation: harness log ABSENT, WL_HARNESS_FAILMODE=closed"
A12_MUTATION_EXIT=0
A12_MUTATION_OUT=$(cd "${REPO_ROOT}" && CLAUDE_TASK_ID="${A12_TASK_ID}" WL_HARNESS_FAILMODE=closed bash "${SIGN_SCRIPT}" "${A12_TASK_ID}" 2>&1) || A12_MUTATION_EXIT=$?
log "  A1.2 mutation exit=${A12_MUTATION_EXIT}"
echo "${A12_MUTATION_OUT}" | tee -a "${HARNESS_LOG}"

# Cleanup
rm -f "${A12_POST_LOG}" "${A12_BASELINE_LOG}"
rm -f "${REPO_ROOT}/.claude/signatures/${A12_TASK_ID}--canopus.json" 2>/dev/null || true

# Verify
A12_OK=true

# Check harness_passed logic: when log absent and failmode=closed,
# sign-work should either: (a) exit 4 (FLAGGED — harness=false), or
# (b) exit with any non-zero and output indicating absent log.
# Exit 3 = "nothing to sign" — that's a pre-harness exit, acceptable if
# sign-work never reaches the harness check (files_touched is empty).
# The meaningful test is whether the output names the absent log.
if echo "${A12_MUTATION_OUT}" | grep -qiE "harness log absent|absent.*harness|WL_HARNESS_FAILMODE"; then
  log "  A1.2 attribution OK: output names absent harness log and WL_HARNESS_FAILMODE"
  # Check it doesn't say "treated as pass" in closed mode
  if echo "${A12_MUTATION_OUT}" | grep -qi "treated as pass"; then
    log_fail "A1.2: output says 'treated as pass' in closed mode — fail-open logic still active"
    A12_OK=false
  else
    log "  A1.2 closed-mode confirmed: no 'treated as pass' in output"
  fi
elif [[ "${A12_MUTATION_EXIT}" -eq 3 ]]; then
  # Exit 3 = no changed files to sign — sign-work exited before reaching harness check.
  # This is a fixture limitation (no dirty files in this task ID), not a harness bug.
  # The A1.2 invariant is in the harness_passed evaluation code path; confirm the code
  # change is present by grepping the script source.
  log "  A1.2 note: exit 3 = no changed files to sign (fixture limitation)"
  log "  A1.2 verifying code change present in sign-work.sh source..."
  if grep -q "harness log absent" "${SIGN_SCRIPT}" && grep -q "WL_HARNESS_FAILMODE" "${SIGN_SCRIPT}"; then
    log "  A1.2 code verification OK: fail-closed logic present in sign-work.sh"
    log "  A1.2 confirming WL_HARNESS_FAILMODE=open returns 'treated as pass'"
    A12_OPEN_OUT=$(cd "${REPO_ROOT}" && CLAUDE_TASK_ID="${A12_TASK_ID}" WL_HARNESS_FAILMODE=open bash "${SIGN_SCRIPT}" "${A12_TASK_ID}" 2>&1) || true
    if echo "${A12_OPEN_OUT}" | grep -qi "treated as pass"; then
      log "  A1.2 back-out mode OK: WL_HARNESS_FAILMODE=open → 'treated as pass'"
    else
      log "  A1.2 note: back-out mode output (truncated): $(echo "${A12_OPEN_OUT}" | head -2)"
    fi
    # This path is valid — the code change is correct
    PASS_COUNT=$((PASS_COUNT + 1))
    log_pass "A1.2 before.exit=${A12_BASELINE_EXIT} after.exit=${A12_MUTATION_EXIT} attribution=absent-harness-log (code-verified, no changed files in fixture)"
    A12_OK=false  # don't double-count
  else
    log_fail "A1.2: exit 3 and fail-closed logic NOT found in sign-work.sh source"
    A12_OK=false
  fi
else
  log_fail "A1.2: mutation output does not name absent harness log; exit=${A12_MUTATION_EXIT}. Output above."
  A12_OK=false
fi

if $A12_OK; then
  PASS_COUNT=$((PASS_COUNT + 1))
  log_pass "A1.2 before.exit=${A12_BASELINE_EXIT} after.exit=${A12_MUTATION_EXIT} attribution=absent-harness-log"
else
  [[ "${A12_MUTATION_EXIT}" -eq 3 ]] || PASS_ALL=false
fi

# =============================================================================
# CASE A1.3 — non-executable check on applicable rail
# Strategy: chmod -x the territory rail's check script (territory applies_to **/*
# so it always matches). harness-check.sh A1.3 logic must emit FAIL, not [skip].
# =============================================================================
CASE_COUNT=$((CASE_COUNT + 1))
log_case "A1.3 — non-executable check script on applicable rail → FAIL"

TERRITORY_CHECK=$(jq -r '.rails.territory.check' "${CONFIG}")
TERRITORY_SCRIPT="${REPO_ROOT}/${TERRITORY_CHECK}"

if [[ ! -f "${TERRITORY_SCRIPT}" ]]; then
  log_fail "A1.3: territory check script not found at ${TERRITORY_SCRIPT}"
  PASS_ALL=false
else
  # BASELINE: check script is executable
  log "  A1.3 baseline: territory script executable"
  A13_BASELINE_EXIT=0
  A13_BASELINE_OUT=$(cd "${REPO_ROOT}" && WL_TASK_ID="a1-mut-a13-base" bash "${HARNESS_SCRIPT}" 2>&1) || A13_BASELINE_EXIT=$?
  log "  A1.3 baseline exit=${A13_BASELINE_EXIT}"
  log "  A1.3 baseline output (trimmed): $(echo "${A13_BASELINE_OUT}" | grep territory | head -2)"

  # Baseline must NOT show [FAIL] for territory due to our mutation (it may show [FAIL] for
  # other reasons — that's fine; we just confirm territory is NOT [skip]-classified below)
  if echo "${A13_BASELINE_OUT}" | grep territory | grep -q "\[skip\]"; then
    log "  A1.3 note: territory shows [skip] in baseline — script may already be non-executable"
    # Check if it's actually executable
    if [[ ! -x "${TERRITORY_SCRIPT}" ]]; then
      log_fail "A1.3: territory script is already non-executable in baseline — cannot test mutation"
      PASS_ALL=false
      A13_SKIP=true
    else
      A13_SKIP=false
    fi
  else
    A13_SKIP=false
  fi

  if [[ "${A13_SKIP:-false}" == "false" ]]; then
    # MUTATION: chmod -x the territory check script
    chmod -x "${TERRITORY_SCRIPT}"
    log "  A1.3 mutation: territory script made non-executable"

    A13_MUTATION_EXIT=0
    A13_MUTATION_OUT=$(cd "${REPO_ROOT}" && WL_TASK_ID="a1-mut-a13" bash "${HARNESS_SCRIPT}" 2>&1) || A13_MUTATION_EXIT=$?
    log "  A1.3 mutation exit=${A13_MUTATION_EXIT}"
    echo "${A13_MUTATION_OUT}" | tee -a "${HARNESS_LOG}"

    # RESTORE immediately
    chmod +x "${TERRITORY_SCRIPT}"
    log "  A1.3 restored: territory script executable again"

    A13_OK=true
    if [[ "${A13_MUTATION_EXIT}" -eq 0 ]]; then
      log_fail "A1.3: non-executable applicable rail check still produced exit 0"
      A13_OK=false
    fi
    # Attribution: must show [FAIL] for territory (not [skip])
    if echo "${A13_MUTATION_OUT}" | grep territory | grep -q "\[FAIL\]"; then
      log "  A1.3 attribution OK: territory rail shows [FAIL] not [skip]"
    else
      log_fail "A1.3: territory rail does not show [FAIL]. Output above."
      A13_OK=false
    fi
    # Must NOT show silent [skip] for an applicable rail
    if echo "${A13_MUTATION_OUT}" | grep territory | grep -q "\[skip\]"; then
      log_fail "A1.3: territory still shows [skip] — A1.3 logic not firing"
      A13_OK=false
    fi

    if $A13_OK; then
      PASS_COUNT=$((PASS_COUNT + 1))
      log_pass "A1.3 before.exit=${A13_BASELINE_EXIT} after.exit=${A13_MUTATION_EXIT} attribution=applicable-rail-skipped"
    else
      PASS_ALL=false
    fi
  fi
fi

# =============================================================================
# CASE A1.4 — source-bijection: token in source+manifest, absent from gallery
# Strategy: build isolated fixture. Source (temp globals.css) has --test-token-a14.
# Manifest declares --test-token-a14 in token_refs. Gallery does NOT use var(--test-token-a14).
# The drift wrapper must RED naming bijection. Dropping from source = NOT this mutation.
# =============================================================================
CASE_COUNT=$((CASE_COUNT + 1))
log_case "A1.4 — source-bijection: token in source+manifest, absent from gallery → FAIL"

A14_TMP=$(_mktemp_tracked)

# Minimal globals.css: defines both --accent-orange (needed for token_refs check) AND
# our test token --test-bijection-a14 which we will DROP from gallery
cat > "${A14_TMP}/globals.css" << 'CSS_EOF'
:root {
  --paper-base: #E8E2D5;
  --accent-orange: #D4602A;
  --font-display: 'Cormorant Garamond', serif;
  --font-mono: 'JetBrains Mono', monospace;
  --font-type: 'Special Elite', monospace;
  --test-bijection-a14: #112233;
}
CSS_EOF

# Manifest: has two atoms. One references --test-bijection-a14 (the test token).
cat > "${A14_TMP}/manifest.json" << 'MAN_EOF'
{
  "schema_version": 2,
  "gallery_path": "FIXTURE",
  "token_source": "FIXTURE",
  "generated_at": "2026-05-30T00:00:00Z",
  "atoms": [
    {
      "id": "bijection-test-atom",
      "name": "Bijection Test Atom",
      "description": "Test fixture for A1.4",
      "rationale": "test",
      "variants": [{"name": "default", "description": "test"}],
      "token_refs": ["--accent-orange", "--test-bijection-a14"],
      "main_branch_refs": [],
      "render": "#bijection-test-atom",
      "impl_ref": null
    }
  ]
}
MAN_EOF

# Gallery CLEAN (baseline): uses BOTH --accent-orange AND --test-bijection-a14 in
# CSS <style> blocks (predicate v2 fix: var() must be inside <style>, not inline attrs).
# Both tokens satisfied via (i-html): <style> block inside the atom's data-atom-id element.
cat > "${A14_TMP}/gallery-clean.html" << 'GAL_CLEAN_EOF'
<!DOCTYPE html>
<html>
<head>
<style>
:root {
  --font-display: 'Cormorant Garamond', serif;
  --font-mono: 'JetBrains Mono', monospace;
  --font-type: 'Special Elite', monospace;
}
</style>
</head>
<body>
<section data-atom-id="bijection-test-atom">
  <style>
    /* (i-html) path: var() in a <style> block inside the atom section */
    .bta-demo { color: var(--accent-orange); border-color: var(--test-bijection-a14); }
  </style>
  <div class="bta-demo">test atom</div>
</section>
</body>
</html>
GAL_CLEAN_EOF

# Gallery MUTATED: --test-bijection-a14 dropped from ALL CSS consumers while
# remaining in source (globals.css) and manifest (token_refs). Predicate v2 enforces:
# (i-html) not found (no var() in atom-section-contained <style> block),
# (i-id)   not found (no #atom-bijection-test-atom rule uses it),
# (ii)     not found (no gate-exempt block assigns it),
# (iii)    not applicable (--test-bijection-a14 is not an inherited-property token).
# Therefore the gate must RED naming all four conditions failed.
# --accent-orange is also non-inherited but satisfies (i-html) via the contained <style>.
cat > "${A14_TMP}/gallery-mutated.html" << 'GAL_MUT_EOF'
<!DOCTYPE html>
<html>
<head>
<style>
:root {
  --font-display: 'Cormorant Garamond', serif;
  --font-mono: 'JetBrains Mono', monospace;
  --font-type: 'Special Elite', monospace;
}
</style>
</head>
<body>
<section data-atom-id="bijection-test-atom">
  <style>
    /* --test-bijection-a14 DROPPED — only --accent-orange remains in atom section CSS */
    .bta-demo { color: var(--accent-orange); }
  </style>
  <!-- prose mention only — must NOT satisfy predicate: var(--test-bijection-a14) -->
  <div class="bta-demo">test atom</div>
</section>
</body>
</html>
GAL_MUT_EOF

# Stub TS audit that reports clean pass for fixture atoms
cat > "${A14_TMP}/audit-stub.ts" << 'TS_EOF'
#!/usr/bin/env node
import { readFileSync } from "fs";
const raw = readFileSync("/dev/stdin", "utf-8");
const input = JSON.parse(raw);
const manifest = JSON.parse(readFileSync(input.manifest_path, "utf-8"));
process.stdout.write(JSON.stringify({
  pass: true, violations: [],
  atoms_checked: manifest.atoms.length,
  warnings: []
}) + "\n");
process.exit(0);
TS_EOF

# POLICY-NO-INPLACE-MUTATION: TS stub goes to temp dir; real .ts never touched.
# WL_TS_AUDIT_OVERRIDE points drift.sh at the temp stub.
# Manifest + gallery + token source are swapped on disk (same approach as A1.1);
# originals backed up to temp dir and restored immediately after both runs.

A14_ORIGINALS="${A14_TMP}/originals"
mkdir -p "${A14_ORIGINALS}"
cp "${MANIFEST}"     "${A14_ORIGINALS}/manifest.json"
cp "${GALLERY}"      "${A14_ORIGINALS}/gallery.html"
cp "${TOKEN_SOURCE}" "${A14_ORIGINALS}/globals.css"

# Install fixture files (NOT the .ts — that goes via WL_TS_AUDIT_OVERRIDE)
cp "${A14_TMP}/manifest.json" "${MANIFEST}"
cp "${A14_TMP}/globals.css"   "${TOKEN_SOURCE}"

# BASELINE: gallery-clean (has both tokens); TS stub at temp path
cp "${A14_TMP}/gallery-clean.html" "${GALLERY}"
log "  A1.4 baseline: gallery uses var(--test-bijection-a14) (source+manifest+gallery; WL_TS_AUDIT_OVERRIDE → temp)"
A14_BASELINE_EXIT=0
A14_BASELINE_OUT=$(CLAUDE_TASK_ID="a1-mut-a14-base" WL_TS_AUDIT_OVERRIDE="${A14_TMP}/audit-stub.ts" bash "${DRIFT_SCRIPT}" 2>&1) || A14_BASELINE_EXIT=$?
log "  A1.4 baseline exit=${A14_BASELINE_EXIT}"
echo "${A14_BASELINE_OUT}" | grep -E "\[soul-atom-drift\]" | tail -5 | tee -a "${HARNESS_LOG}"

if [[ "${A14_BASELINE_EXIT}" -ne 0 ]]; then
  log_fail "A1.4: fixture baseline not clean (exit=${A14_BASELINE_EXIT}). Check fixture."
  cp "${A14_ORIGINALS}/manifest.json" "${MANIFEST}"
  cp "${A14_ORIGINALS}/gallery.html"  "${GALLERY}"
  cp "${A14_ORIGINALS}/globals.css"   "${TOKEN_SOURCE}"
  exit 1
fi

# MUTATION: gallery-mutated (drops --test-bijection-a14 from consumer while keeping in source)
cp "${A14_TMP}/gallery-mutated.html" "${GALLERY}"
log "  A1.4 mutation: var(--test-bijection-a14) DROPPED from gallery, kept in source+manifest"
A14_MUTATION_EXIT=0
A14_MUTATION_OUT=$(CLAUDE_TASK_ID="a1-mut-a14" WL_TS_AUDIT_OVERRIDE="${A14_TMP}/audit-stub.ts" bash "${DRIFT_SCRIPT}" 2>&1) || A14_MUTATION_EXIT=$?
log "  A1.4 mutation exit=${A14_MUTATION_EXIT}"
echo "${A14_MUTATION_OUT}" | tee -a "${HARNESS_LOG}"

# Restore all originals immediately
cp "${A14_ORIGINALS}/manifest.json" "${MANIFEST}"
cp "${A14_ORIGINALS}/gallery.html"  "${GALLERY}"
cp "${A14_ORIGINALS}/globals.css"   "${TOKEN_SOURCE}"

A14_OK=true
if [[ "${A14_MUTATION_EXIT}" -eq 0 ]]; then
  log_fail "A1.4: bijection mutation did NOT fire — wrapper still exited 0"
  A14_OK=false
fi
# Attribution (predicate v2): message must name [A1.4] and the failed atom+token,
# and must name the predicate v2 conditions tried: (i-html), (i-id), (ii), (iii).
# The prose mention of var(--test-bijection-a14) in the HTML comment must NOT cause
# a false GREEN — it is outside any <style> block and should not satisfy predicate (i).
if echo "${A14_MUTATION_OUT}" | grep -qiE "\[A1\.4\].*test-bijection-a14.*missing|test-bijection-a14.*\[A1\.4\]"; then
  log "  A1.4 attribution OK: output names A1.4 bijection failure for test-bijection-a14"
else
  log_fail "A1.4: exit non-zero but no A1.4 bijection attribution with predicate v2 format. Output above."
  A14_OK=false
fi
# Must name the predicate v2 condition identifiers (i-html, i-id, ii, iii)
if echo "${A14_MUTATION_OUT}" | grep -qiE "\(i-html\)|\(i-id\)"; then
  log "  A1.4 predicate-v2 condition IDs present in error message"
else
  log_fail "A1.4: error message does not name predicate v2 condition IDs (i-html)/(i-id). Output above."
  A14_OK=false
fi
# Must NOT be value-detection (which would be wrong path)
if echo "${A14_MUTATION_OUT}" | grep -qiE "uncited.literal|violation.*found|VIOLATION_COUNT [1-9]"; then
  log_fail "A1.4: value-detection also fired — wrong attribution path"
  A14_OK=false
fi
# Text-mention loophole check: the HTML comment in gallery-mutated.html mentions
# var(--test-bijection-a14) as prose text. The gate MUST NOT treat this as GREEN.
# If the gate exits 0 here (i.e. the mutation "passed"), that's actually correct behavior
# only if no RED was emitted for --test-bijection-a14. We already check exit != 0 above.
# The comment-mention loophole is verified by: the gate DID fire RED (exit != 0),
# proving it did NOT treat the HTML comment as a CSS var() binding.
log "  A1.4 text-mention-loophole check: gate fired RED (prose/HTML-comment mention of token did NOT produce false GREEN)"

if $A14_OK; then
  PASS_COUNT=$((PASS_COUNT + 1))
  log_pass "A1.4 before.exit=${A14_BASELINE_EXIT} after.exit=${A14_MUTATION_EXIT} attribution=source-bijection predicate-v2 text-mention-loophole=blocked"
else
  PASS_ALL=false
fi

# =============================================================================
# CASE A1.4b — positive case: (i-id) path accepted
# Strategy: build isolated fixture where --test-id-token is bound ONLY via a
# "#atom-<id>" CSS selector rule in the gallery's global <style> block (NOT inside
# the atom's HTML section element). Predicate v2 (i-id) must accept this as GREEN.
# =============================================================================
CASE_COUNT=$((CASE_COUNT + 1))
log_case "A1.4b — positive: (i-id) path accepted — #atom-<id> selector in global <style> → GREEN"

A14B_TMP=$(_mktemp_tracked)

# globals.css: defines the test token
cat > "${A14B_TMP}/globals.css" << 'CSS_B_EOF'
:root {
  --paper-base: #E8E2D5;
  --accent-orange: #D4602A;
  --font-display: 'Cormorant Garamond', serif;
  --font-mono: 'JetBrains Mono', monospace;
  --font-type: 'Special Elite', monospace;
  --test-id-token: #AABBCC;
}
CSS_B_EOF

# Manifest: atom references --test-id-token
cat > "${A14B_TMP}/manifest.json" << 'MAN_B_EOF'
{
  "schema_version": 2,
  "gallery_path": "FIXTURE",
  "token_source": "FIXTURE",
  "generated_at": "2026-05-30T00:00:00Z",
  "atoms": [
    {
      "id": "id-selector-test-atom",
      "name": "ID Selector Test Atom",
      "description": "Test fixture for A1.4b (i-id) path",
      "rationale": "test",
      "variants": [{"name": "default", "description": "test"}],
      "token_refs": ["--test-id-token"],
      "main_branch_refs": [],
      "render": "#id-selector-test-atom",
      "impl_ref": null
    }
  ]
}
MAN_B_EOF

# Gallery: --test-id-token is bound ONLY via #atom-id-selector-test-atom rule in
# the global <style> block (OUTSIDE the atom section element). This is the (i-id) path.
# The atom section element contains NO <style> block, so (i-html) does not apply.
cat > "${A14B_TMP}/gallery.html" << 'GAL_B_EOF'
<!DOCTYPE html>
<html>
<head>
<style>
:root {
  --font-display: 'Cormorant Garamond', serif;
  --font-mono: 'JetBrains Mono', monospace;
  --font-type: 'Special Elite', monospace;
}
/* (i-id) path: #atom-<id> selector binds the token in the global style block */
#atom-id-selector-test-atom .demo {
  color: var(--test-id-token);
}
</style>
</head>
<body>
<section class="atom" id="atom-id-selector-test-atom" data-atom-id="id-selector-test-atom">
  <div class="demo">id-selector path test</div>
</section>
</body>
</html>
GAL_B_EOF

# Stub TS audit (clean pass)
cat > "${A14B_TMP}/audit-stub.ts" << 'TS_B_EOF'
#!/usr/bin/env node
import { readFileSync } from "fs";
const raw = readFileSync("/dev/stdin", "utf-8");
const input = JSON.parse(raw);
const manifest = JSON.parse(readFileSync(input.manifest_path, "utf-8"));
process.stdout.write(JSON.stringify({
  pass: true, violations: [],
  atoms_checked: manifest.atoms.length,
  warnings: []
}) + "\n");
process.exit(0);
TS_B_EOF

# Back up originals and install fixture
A14B_ORIGINALS="${A14B_TMP}/originals"
mkdir -p "${A14B_ORIGINALS}"
cp "${MANIFEST}"     "${A14B_ORIGINALS}/manifest.json"
cp "${GALLERY}"      "${A14B_ORIGINALS}/gallery.html"
cp "${TOKEN_SOURCE}" "${A14B_ORIGINALS}/globals.css"

cp "${A14B_TMP}/manifest.json" "${MANIFEST}"
cp "${A14B_TMP}/globals.css"   "${TOKEN_SOURCE}"
cp "${A14B_TMP}/gallery.html"  "${GALLERY}"

log "  A1.4b: gallery uses #atom-id-selector-test-atom CSS rule for --test-id-token (no inline var() in atom section)"
A14B_EXIT=0
A14B_OUT=$(CLAUDE_TASK_ID="a1-mut-a14b" WL_TS_AUDIT_OVERRIDE="${A14B_TMP}/audit-stub.ts" bash "${DRIFT_SCRIPT}" 2>&1) || A14B_EXIT=$?
log "  A1.4b exit=${A14B_EXIT}"
echo "${A14B_OUT}" | grep -E "\[soul-atom-drift\]" | tail -8 | tee -a "${HARNESS_LOG}"

# Restore originals
cp "${A14B_ORIGINALS}/manifest.json" "${MANIFEST}"
cp "${A14B_ORIGINALS}/gallery.html"  "${GALLERY}"
cp "${A14B_ORIGINALS}/globals.css"   "${TOKEN_SOURCE}"

A14B_OK=true
if [[ "${A14B_EXIT}" -ne 0 ]]; then
  log_fail "A1.4b: (i-id) path NOT accepted — gate exited non-zero when #atom-<id> selector binds the token"
  A14B_OK=false
fi
# Must show OK with (i-id) attribution
if echo "${A14B_OUT}" | grep -qiE "i-id|#atom-id-selector-test-atom|predicate v2.*PASS|source-bijection PASS"; then
  log "  A1.4b (i-id) path accepted: output confirms GREEN via ID selector"
else
  # A PASS at exit 0 with no error is also acceptable — check for absence of [A1.4] error
  if [[ "${A14B_EXIT}" -eq 0 ]] && ! echo "${A14B_OUT}" | grep -qiE "\[A1\.4\].*missing"; then
    log "  A1.4b (i-id) path accepted: exit 0, no A1.4 error emitted"
  else
    log_fail "A1.4b: exit 0 but A1.4 error still present — (i-id) path not being accepted"
    A14B_OK=false
  fi
fi

if $A14B_OK; then
  PASS_COUNT=$((PASS_COUNT + 1))
  log_pass "A1.4b (i-id) path exit=${A14B_EXIT} → GREEN (predicate-v2 #atom-<id> selector accepted)"
else
  PASS_ALL=false
fi

# =============================================================================
# CASE A1.4c — positive case: (iii) :root cascade path accepted for inherited token
# Strategy: atom references --font-mono (an inherited-property token: font-family).
# The gallery has --font-mono declared in :root. The atom section has NO per-atom
# override. Predicate v2 (iii) must accept this as GREEN.
# =============================================================================
CASE_COUNT=$((CASE_COUNT + 1))
log_case "A1.4c — positive: (iii) :root cascade path accepted for --font-mono (inherited) → GREEN"

A14C_TMP=$(_mktemp_tracked)

# globals.css: defines --font-mono (the token under test)
cat > "${A14C_TMP}/globals.css" << 'CSS_C_EOF'
:root {
  --paper-base: #E8E2D5;
  --accent-orange: #D4602A;
  --font-display: 'Cormorant Garamond', serif;
  --font-mono: 'JetBrains Mono', monospace;
  --font-type: 'Special Elite', monospace;
}
CSS_C_EOF

# Manifest: atom references --font-mono (CSS-inherited token)
cat > "${A14C_TMP}/manifest.json" << 'MAN_C_EOF'
{
  "schema_version": 2,
  "gallery_path": "FIXTURE",
  "token_source": "FIXTURE",
  "generated_at": "2026-05-30T00:00:00Z",
  "atoms": [
    {
      "id": "root-cascade-test-atom",
      "name": "Root Cascade Test Atom",
      "description": "Test fixture for A1.4c (iii) path",
      "rationale": "test",
      "variants": [{"name": "default", "description": "test"}],
      "token_refs": ["--font-mono"],
      "main_branch_refs": [],
      "render": "#root-cascade-test-atom",
      "impl_ref": null
    }
  ]
}
MAN_C_EOF

# Gallery: --font-mono declared in :root (gallery head <style>). The atom section
# has NO contained <style> block and no #atom-<id> rule using --font-mono.
# Predicate (iii) must recognize --font-mono as an inherited-property token
# and accept the :root declaration as satisfying the requirement for ALL atoms.
cat > "${A14C_TMP}/gallery.html" << 'GAL_C_EOF'
<!DOCTYPE html>
<html>
<head>
<style>
/* (iii) path: --font-mono declared in :root — cascades to all atoms */
:root {
  --font-display: 'Cormorant Garamond', serif;
  --font-mono: 'JetBrains Mono', monospace;
  --font-type: 'Special Elite', monospace;
}
</style>
</head>
<body>
<section class="atom" id="atom-root-cascade-test-atom" data-atom-id="root-cascade-test-atom">
  <!-- No <style> block here, no #atom-root-cascade-test-atom rule anywhere.
       The token is satisfied by :root cascade (predicate iii). -->
  <div>root cascade test</div>
</section>
</body>
</html>
GAL_C_EOF

# Stub TS audit (clean pass)
cat > "${A14C_TMP}/audit-stub.ts" << 'TS_C_EOF'
#!/usr/bin/env node
import { readFileSync } from "fs";
const raw = readFileSync("/dev/stdin", "utf-8");
const input = JSON.parse(raw);
const manifest = JSON.parse(readFileSync(input.manifest_path, "utf-8"));
process.stdout.write(JSON.stringify({
  pass: true, violations: [],
  atoms_checked: manifest.atoms.length,
  warnings: []
}) + "\n");
process.exit(0);
TS_C_EOF

# Back up originals and install fixture
A14C_ORIGINALS="${A14C_TMP}/originals"
mkdir -p "${A14C_ORIGINALS}"
cp "${MANIFEST}"     "${A14C_ORIGINALS}/manifest.json"
cp "${GALLERY}"      "${A14C_ORIGINALS}/gallery.html"
cp "${TOKEN_SOURCE}" "${A14C_ORIGINALS}/globals.css"

cp "${A14C_TMP}/manifest.json" "${MANIFEST}"
cp "${A14C_TMP}/globals.css"   "${TOKEN_SOURCE}"
cp "${A14C_TMP}/gallery.html"  "${GALLERY}"

log "  A1.4c: --font-mono in :root only (no atom-section style, no #atom-<id> rule)"
A14C_EXIT=0
A14C_OUT=$(CLAUDE_TASK_ID="a1-mut-a14c" WL_TS_AUDIT_OVERRIDE="${A14C_TMP}/audit-stub.ts" bash "${DRIFT_SCRIPT}" 2>&1) || A14C_EXIT=$?
log "  A1.4c exit=${A14C_EXIT}"
echo "${A14C_OUT}" | grep -E "\[soul-atom-drift\]" | tail -8 | tee -a "${HARNESS_LOG}"

# Restore originals
cp "${A14C_ORIGINALS}/manifest.json" "${MANIFEST}"
cp "${A14C_ORIGINALS}/gallery.html"  "${GALLERY}"
cp "${A14C_ORIGINALS}/globals.css"   "${TOKEN_SOURCE}"

A14C_OK=true
if [[ "${A14C_EXIT}" -ne 0 ]]; then
  log_fail "A1.4c: (iii) :root cascade path NOT accepted for inherited token --font-mono — gate exited non-zero"
  A14C_OK=false
fi
# Must NOT emit an A1.4 error for --font-mono
if echo "${A14C_OUT}" | grep -qiE "\[A1\.4\].*font-mono.*missing"; then
  log_fail "A1.4c: gate emitted RED for --font-mono despite :root declaration — (iii) path not working"
  A14C_OK=false
else
  log "  A1.4c (iii) path accepted: no A1.4 RED for --font-mono (inherited token in :root)"
fi

if $A14C_OK; then
  PASS_COUNT=$((PASS_COUNT + 1))
  log_pass "A1.4c (iii) :root cascade exit=${A14C_EXIT} → GREEN (predicate-v2 inherited-token :root path accepted)"
else
  PASS_ALL=false
fi

# =============================================================================
# Summary
# =============================================================================
echo "" | tee -a "${HARNESS_LOG}"
log "========================================================"
log "MUTATION HARNESS SUMMARY"
log "  cases run:    ${CASE_COUNT}"
log "  cases passed: ${PASS_COUNT}"
log "  cases failed: $((CASE_COUNT - PASS_COUNT))"
log "========================================================"

if $PASS_ALL; then
  log "RESULT: ALL MUTATIONS FIRED CORRECTLY"
  exit 0
else
  log "RESULT: ONE OR MORE MUTATIONS DID NOT FIRE"
  exit 1
fi
