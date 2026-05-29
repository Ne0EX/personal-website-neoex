#!/usr/bin/env bash
# =============================================================================
# audit-soul-atom-drift.sh
#
# Rail: soul-atom-drift
# Owner: Canopus (α-HRN-07) — TASK-2026-05-29-SOUL-FACTORY-P0
# Run by: harness-check.sh (via worldline-harness.config.json) AND
#         the visual-diff.sh hook when soul-atlas files are in scope.
#
# Purpose:
#   Verify that the soul-atom gallery stays pinned to the canonical
#   design-token source (app/globals.css) and main-branch literals.
#   Drift in the gallery = a fourth competing baseline that makes things WORSE.
#
# The drift invariant (from MANIFEST-SCHEMA.md):
#   Every appearance value (color/size/spacing/timing) in gallery.html
#   must resolve to a token_ref that exists in app/globals.css OR a cited
#   main_branch_ref. Any uncited raw appearance literal = gate FAIL.
#
# Shell wrapper contract:
#   This script (Canopus territory) is the shell harness layer.
#   It validates preconditions, assembles the inputs, invokes the TypeScript
#   audit (Algol territory), and translates the exit code into a gate decision.
#
#   The TypeScript audit lives at:
#     scripts/audit-soul-atom-drift.ts   ← ALGOL FILLS THIS (Phase 2)
#
#   This wrapper will FAIL CLOSED if the TS audit is missing, rather than
#   silently passing a potentially-drifted gallery.
#
# Exit codes:
#   0 — PASS: all atoms verified; no uncited raw literals detected
#   1 — FAIL: one or more uncited raw literals found (gate blocks)
#   2 — FAIL: manifest.json not found or not valid JSON
#   3 — FAIL: TypeScript audit not found at scripts/audit-soul-atom-drift.ts —
#            BLOCKING (Phase 2: TS audit exists; absence now means a broken install,
#            not a deferred stub)
#   4 — FAIL: gallery.html not found when manifest.json exists
#   5 — FAIL: token_source (app/globals.css) not found — cannot verify token_refs
#   6 — FAIL: a token_ref in the manifest does not exist in app/globals.css
#
# Usage:
#   bash scripts/audit-soul-atom-drift.sh
#   bash scripts/audit-soul-atom-drift.sh --verbose
#
# Task-id context:
#   Set CLAUDE_TASK_ID in env before calling — used for log file naming.
#   If unset, "no-task" is used as fallback.
# =============================================================================

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
TASK_ID="${CLAUDE_TASK_ID:-no-task}"
LOG_DIR="${REPO_ROOT}/.claude/hook-logs"
LOG_FILE="${LOG_DIR}/${TASK_ID}--soul-atom-drift.log"
VERBOSE="${1:-}"

MANIFEST="${REPO_ROOT}/.claude/visual-diffs/soul-atlas/manifest.json"
GALLERY="${REPO_ROOT}/.claude/visual-diffs/soul-atlas/gallery.html"
TOKEN_SOURCE="${REPO_ROOT}/app/globals.css"
TS_AUDIT="${REPO_ROOT}/scripts/audit-soul-atom-drift.ts"

# ── logging helpers ─────────────────────────────────────────────────────────
mkdir -p "${LOG_DIR}"
log() { echo "[soul-atom-drift] $*" | tee -a "${LOG_FILE}"; }
log_v() { [[ "${VERBOSE}" == "--verbose" ]] && log "$*" || echo "[soul-atom-drift] $*" >> "${LOG_FILE}"; }
log_err() { echo "[soul-atom-drift] ERROR: $*" | tee -a "${LOG_FILE}" >&2; }

log "start · task=${TASK_ID} · $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# ── P1: manifest.json must exist ────────────────────────────────────────────
if [[ ! -f "${MANIFEST}" ]]; then
  # Exit 0 silently when soul-atlas hasn't been created yet.
  # The gate is not applicable until Betelgeuse creates the gallery (Phase 1).
  # This prevents false-positive failures on tasks that don't touch soul-atlas.
  log "manifest.json not found at ${MANIFEST} — soul-atlas not yet initialised; skipping"
  exit 0
fi

# ── P2: manifest.json must be valid JSON ────────────────────────────────────
if ! jq empty "${MANIFEST}" 2>/dev/null; then
  log_err "manifest.json is not valid JSON: ${MANIFEST}"
  log "FAIL (exit 2)"
  exit 2
fi

log_v "manifest.json valid JSON"

# ── P3: gallery.html must exist if manifest.json exists ─────────────────────
if [[ ! -f "${GALLERY}" ]]; then
  log_err "gallery.html not found at ${GALLERY} — manifest exists but gallery is missing"
  log "FAIL (exit 4)"
  exit 4
fi

# ── P4: token source must exist ─────────────────────────────────────────────
if [[ ! -f "${TOKEN_SOURCE}" ]]; then
  log_err "token source not found at ${TOKEN_SOURCE}"
  log "FAIL (exit 5)"
  exit 5
fi

# ── C1: verify every token_ref exists in globals.css ────────────────────────
# This check is Canopus territory (shell grep) — it does not require the TS audit.
# Format: --<property-name> is present as a CSS custom property definition.
log "checking token_refs against ${TOKEN_SOURCE}"

TOKEN_FAIL=0
while IFS= read -r token_ref; do
  # token_ref from manifest looks like "--accent-orange"
  if ! grep -q -- "${token_ref}" "${TOKEN_SOURCE}"; then
    log_err "token_ref '${token_ref}' not found in ${TOKEN_SOURCE}"
    TOKEN_FAIL=1
  else
    log_v "token_ref '${token_ref}' OK"
  fi
done < <(jq -r '.atoms[].token_refs[]' "${MANIFEST}" 2>/dev/null || true)

if [[ "${TOKEN_FAIL}" -eq 1 ]]; then
  log "FAIL (exit 6) — one or more token_refs missing from globals.css"
  exit 6
fi

log "token_refs check PASS"

# ── C1b: font-chain presence assertion ──────────────────────────────────────
# Verifies that --font-display, --font-mono, --font-type are explicitly bound
# in gallery.html. Tailwind v4 @theme inline does not run in static-serve context;
# without explicit :root bindings all text falls back to Times serif.
# This check would have caught the TASK-2026-05-29-SOUL-FACTORY-FIDELITY breakage
# deterministically — token-drift gate passed but render was wrong.
#
# Script lives at scripts/audit-font-chain.sh (Canopus territory).
# Fails closed (exit 1 on missing binding).
FONT_CHAIN_SCRIPT="${REPO_ROOT}/scripts/audit-font-chain.sh"

if [[ ! -f "${FONT_CHAIN_SCRIPT}" ]]; then
  log_err "font-chain check script not found at ${FONT_CHAIN_SCRIPT}"
  log "FAIL (exit 7) — font-chain script absent; install broken"
  exit 7
fi

log "running font-chain presence check"
FONT_CHAIN_EXIT=0
bash "${FONT_CHAIN_SCRIPT}" "${VERBOSE}" 2>>"${LOG_FILE}" || FONT_CHAIN_EXIT=$?

if [[ "${FONT_CHAIN_EXIT}" -eq 2 ]]; then
  # Exit 2 from font-chain = manifest not found = skip (should not happen here since
  # we already verified manifest exists above, but be defensive)
  log_v "font-chain check: skipped (manifest not found — unexpected in this context)"
elif [[ "${FONT_CHAIN_EXIT}" -ne 0 ]]; then
  log_err "font-chain presence check FAILED (exit ${FONT_CHAIN_EXIT})"
  log "FAIL (exit 1) — font-chain bindings missing; see font-chain log for detail"
  exit 1
else
  log "font-chain check PASS"
fi

# ── C2: invoke the TypeScript deep-audit ────────────────────────────────────
# Algol owns audit-soul-atom-drift.ts.
# Contract for the TS audit (what Algol must implement — Phase 2):
#
#   INPUT  (stdin, JSON):
#     {
#       "manifest_path": "<absolute path to manifest.json>",
#       "gallery_path":  "<absolute path to gallery.html>",
#       "token_source":  "<absolute path to app/globals.css>",
#       "verbose":       true|false
#     }
#
#   OUTPUT (stdout, JSON):
#     {
#       "pass": true|false,
#       "violations": [
#         {
#           "atom_id":     "<atom id>",
#           "atom_name":   "<atom name>",
#           "violation":   "uncited-literal | token-ref-missing | main-branch-mismatch",
#           "detail":      "<human-readable detail>",
#           "gallery_loc": "<line or selector where the violation was found in gallery.html>"
#         }
#       ],
#       "atoms_checked": <integer>,
#       "warnings":      ["<advisory strings>"]
#     }
#
#   EXIT CODES:
#     0 — all atoms pass
#     1 — one or more violations found
#     2 — input malformed or files unreadable (propagated as exit 2 by this wrapper)
#
#   WHAT THE TS AUDIT MUST CHECK:
#
#   For each atom in manifest.json:
#
#   A. Scan the gallery.html section identified by data-atom-id="<atom.id>" for raw
#      appearance literals. An "appearance literal" is any CSS property value that is:
#        - a hex color (#[0-9a-fA-F]{3,8})
#        - an rgb/rgba/hsl call with literal numeric arguments
#        - a pixel value (e.g. 12px, 0.5rem) that is NOT wrapped in var(--...)
#        - an opacity value (e.g. 0.18, 0.45) that is NOT wrapped in var(--...)
#        - a timing value (e.g. 600ms, 1400ms) that is NOT wrapped in var(--...)
#
#   B. For each raw literal found:
#      1. Check if it matches the `value` field of any `main_branch_ref` entry in
#         this atom's manifest entry. If it does → cited, PASS this literal.
#      2. If no matching main_branch_ref → UNCITED LITERAL → violation.
#
#   C. For each main_branch_ref in the atom:
#      1. Verify the cited file exists at the repo root.
#      2. If `line` is provided, verify the cited `value` appears at or near that line
#         (±3 line tolerance for minor edits). If not → MAIN-BRANCH-MISMATCH violation.
#      3. MAIN-BRANCH-MISMATCH is a violation: it means the gallery is citing a literal
#         that has drifted from its stated source. Either the gallery must be updated or
#         the cite must be corrected.
#
#   D. For each token_ref in the atom:
#      (The shell wrapper already checked existence in globals.css at C1 above.
#       The TS audit should also verify the token_ref appears in the gallery section
#       via a var(--<token>) reference, not just that it exists in globals.css.)
#
#   EXEMPTIONS (the TS audit must honour these):
#   - Any content inside <!-- gate: exempt → Three.js canvas ... --> comments is
#     exempt from literal scanning. These mark runtime numeric values that cannot
#     use CSS variables (Three.js requires hex or numeric).
#   - Any attribute value in data-* attributes is exempt (data attributes are metadata,
#     not appearance values).
#   - Content inside <script> tags marked with data-gate-exempt="true" is exempt.

if [[ ! -f "${TS_AUDIT}" ]]; then
  log_err "TypeScript audit not found at ${TS_AUDIT}"
  log_err "Phase 2 transition: scripts/audit-soul-atom-drift.ts must exist."
  log_err "If this is a fresh clone, run: git checkout scripts/audit-soul-atom-drift.ts"
  log "FAIL (exit 3) — TS audit absent; gate blocks (Phase 2 active)"
  exit 3
fi

# Invoke the TS audit via tsx (assumed available; consistent with existing audit scripts)
log "invoking TS audit: ${TS_AUDIT}"

AUDIT_INPUT=$(jq -nc \
  --arg manifest "${MANIFEST}" \
  --arg gallery "${GALLERY}" \
  --arg token_source "${TOKEN_SOURCE}" \
  --argjson verbose "$([[ "${VERBOSE}" == "--verbose" ]] && echo true || echo false)" \
  '{manifest_path: $manifest, gallery_path: $gallery, token_source: $token_source, verbose: $verbose}')

AUDIT_OUTPUT=$(echo "${AUDIT_INPUT}" | npx tsx "${TS_AUDIT}" 2>>"${LOG_FILE}")
AUDIT_EXIT=$?

echo "${AUDIT_OUTPUT}" >> "${LOG_FILE}"

if [[ "${AUDIT_EXIT}" -eq 0 ]]; then
  ATOM_COUNT=$(echo "${AUDIT_OUTPUT}" | jq -r '.atoms_checked // "?"')
  log "PASS — ${ATOM_COUNT} atoms verified; no uncited literals detected"
  exit 0
elif [[ "${AUDIT_EXIT}" -eq 1 ]]; then
  VIOLATION_COUNT=$(echo "${AUDIT_OUTPUT}" | jq '.violations | length' 2>/dev/null || echo "unknown")
  log_err "FAIL — ${VIOLATION_COUNT} violation(s) found:"
  echo "${AUDIT_OUTPUT}" | jq -r '.violations[] | "  atom=\(.atom_id) type=\(.violation) loc=\(.gallery_loc // "?")\n  detail: \(.detail)"' 2>/dev/null | tee -a "${LOG_FILE}" >&2
  log "FAIL (exit 1)"
  exit 1
else
  log_err "TS audit exited ${AUDIT_EXIT} — treating as FAIL"
  log "FAIL (exit 1)"
  exit 1
fi
