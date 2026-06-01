#!/usr/bin/env bash
# =============================================================================
# scripts/audit-single-source.sh
#
# Rail:    single-source
# Owner:   Canopus (α-HRN-07)
# Class:   DETERMINISTIC / HARD-BARRIER
# Introduced: TASK-2026-06-01-AUDIT-SINGLE-SOURCE
#
# Purpose:
#   For each artifact in the single-source registry
#   (.harness/single-source-registry.json), assert that EXACTLY ONE
#   canonical definition exists. Every copy under prototype/handoff/
#   visual-diffs paths must either:
#
#     (A) byte-match the canonical (sha256 identical), OR
#     (B) contain a textual import of the canonical module path
#         (a "consumer" of the canonical, not a divergent blob).
#
#   A file that is neither byte-identical nor an importer is a DIVERGENT
#   DUPLICATE and causes this gate to exit NONZERO.
#
# Bug this gate closes:
#   The globe component (components/WorldlineGlobe.tsx) existed as 3 separate
#   divergent blobs across branches and worktrees. Fixes were scattered to
#   prototypes/handoff artifacts and never ported back to production. This gate
#   detects the divergence deterministically so it cannot go unnoticed.
#
# Registry:
#   .harness/single-source-registry.json  — list of designated single-source
#   artifacts. Each entry names: canonical path, duplicate_search_globs,
#   match_pattern.
#
# Override (testing):
#   WL_SINGLE_SOURCE_REGISTRY=<path>  — point at a test registry (fixture tests)
#   WL_REPO_ROOT=<path>               — override repo root (fixture tests)
#
# Exit codes:
#   0 — all artifacts clean: every copy is either byte-identical or an importer
#   1 — one or more divergent duplicates found (FAIL — blocks handoff)
#   2 — registry file not found or not valid JSON
#   3 — canonical file for an artifact does not exist (registry misconfiguration)
#
# Usage:
#   bash scripts/audit-single-source.sh
#   bash scripts/audit-single-source.sh --verbose
#
# Idempotent: yes. Re-running produces the same result on the same working tree.
# Timing:    O(N_copies × file_size) for sha256. Typical run < 5 seconds.
#
# How to fix a FAIL:
#   The audit emits: copy_path  status=DIVERGENT  canonical=<path>
#   Options:
#     1. Delete the divergent copy if it was a transient prototype artifact.
#     2. Replace the divergent copy with the canonical content (or a byte-identical
#        file) if the copy must remain.
#     3. If the copy is a legitimate consumer module (wraps the canonical), add an
#        import statement: import ... from '<canonical-module-path>'
#        (relative or @/-aliased) so the importer predicate passes.
#   Do NOT fix by editing the canonical to match the copy — the canonical is the
#   source of truth; the copy is what needs to change.
# =============================================================================

set -euo pipefail

REPO_ROOT="${WL_REPO_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
REGISTRY="${WL_SINGLE_SOURCE_REGISTRY:-${REPO_ROOT}/.harness/single-source-registry.json}"
TASK_ID="${CLAUDE_TASK_ID:-adhoc-$(date +%s)}"
LOG_DIR="${REPO_ROOT}/.claude/hook-logs"
LOG_FILE="${LOG_DIR}/${TASK_ID}--single-source.log"
VERBOSE="${1:-}"

mkdir -p "${LOG_DIR}"

# ── logging helpers ──────────────────────────────────────────────────────────
log()   { echo "[single-source] $*" | tee -a "${LOG_FILE}"; }
log_v() {
  if [[ "${VERBOSE}" == "--verbose" ]]; then
    echo "[single-source] $*" | tee -a "${LOG_FILE}"
  else
    echo "[single-source] $*" >> "${LOG_FILE}"
  fi
}
log_err() { echo "[single-source] ERROR: $*" | tee -a "${LOG_FILE}" >&2; }

log "start · task=${TASK_ID} · $(date -u +%Y-%m-%dT%H:%M:%SZ)"
log "registry=${REGISTRY}"

# ── P1: registry must exist ──────────────────────────────────────────────────
if [[ ! -f "${REGISTRY}" ]]; then
  log_err "registry not found at ${REGISTRY}"
  log "FAIL (exit 2)"
  exit 2
fi

# ── P2: registry must be valid JSON ─────────────────────────────────────────
if ! jq empty "${REGISTRY}" 2>/dev/null; then
  log_err "registry is not valid JSON: ${REGISTRY}"
  log "FAIL (exit 2)"
  exit 2
fi

log_v "registry valid JSON"

# ── P2b: registry must have a non-null, non-empty artifacts array ────────────
# EMPTY-REGISTRY FIX: an absent or null .artifacts key silently yielded 0 from
# `jq '.artifacts | length'`, causing the loop to be skipped and the script to
# exit 0 with "checking 0 artifacts" — the cardinal exit-0-on-empty sin.
#
# Guard 1: .artifacts must exist and be non-null → exit 2 (malformed registry)
ARTIFACTS_TYPE=$(jq -r 'if has("artifacts") then (if .artifacts == null then "null" else (.artifacts | type) end) else "missing" end' "${REGISTRY}")
if [[ "${ARTIFACTS_TYPE}" == "missing" || "${ARTIFACTS_TYPE}" == "null" ]]; then
  log_err "registry is malformed: .artifacts key is ${ARTIFACTS_TYPE}"
  log_err "  Expected: { \"artifacts\": [ ... ] }  (non-null array)"
  log "FAIL (exit 2)"
  exit 2
fi
if [[ "${ARTIFACTS_TYPE}" != "array" ]]; then
  log_err "registry is malformed: .artifacts is type '${ARTIFACTS_TYPE}', expected array"
  log "FAIL (exit 2)"
  exit 2
fi

# Guard 2: .artifacts array must have at least one entry → exit nonzero (config error)
# An empty registry is a configuration mistake; passing silently on 0 artifacts hides it.
ARTIFACT_COUNT=$(jq '.artifacts | length' "${REGISTRY}")
if [[ "${ARTIFACT_COUNT}" -eq 0 ]]; then
  log_err "registry defines 0 artifacts — this is a configuration error, not a clean state"
  log_err "  Add at least one artifact entry to .harness/single-source-registry.json"
  log_err "  An empty artifact list proves nothing and should not gate-pass."
  log "FAIL (exit 2)"
  exit 2
fi

# ── Main: iterate artifacts ──────────────────────────────────────────────────
TOTAL_VIOLATIONS=0
log "checking ${ARTIFACT_COUNT} artifact(s)"

for (( ai=0; ai < ARTIFACT_COUNT; ai++ )); do
  ART_ID=$(jq -r ".artifacts[${ai}].id" "${REGISTRY}")
  ART_DESC=$(jq -r ".artifacts[${ai}].description" "${REGISTRY}")
  CANONICAL_REL=$(jq -r ".artifacts[${ai}].canonical" "${REGISTRY}")
  MATCH_PATTERN=$(jq -r ".artifacts[${ai}].match_pattern" "${REGISTRY}")
  CANONICAL="${REPO_ROOT}/${CANONICAL_REL}"

  log ""
  log "artifact[${ai}]: ${ART_ID}"
  log_v "  description: ${ART_DESC}"
  log_v "  canonical:   ${CANONICAL_REL}"
  log_v "  pattern:     ${MATCH_PATTERN}"

  # ── P3: canonical must exist ─────────────────────────────────────────────
  if [[ ! -f "${CANONICAL}" ]]; then
    log_err "  canonical file not found: ${CANONICAL}"
    log_err "  Registry misconfiguration — update .harness/single-source-registry.json"
    log "  FAIL (exit 3) on artifact=${ART_ID}"
    exit 3
  fi

  # ── Compute canonical sha256 ──────────────────────────────────────────────
  CANONICAL_HASH=$(sha256sum "${CANONICAL}" | awk '{print $1}')
  log_v "  canonical sha256: ${CANONICAL_HASH}"

  # ── Compute canonical module import forms ─────────────────────────────────
  # Build a set of import-path substrings that a legitimate consumer would contain.
  # A consumer may import via:
  #   (a) relative path ending in the canonical filename (any depth)
  #   (b) @/-alias path: @/<canonical-rel>  (with or without extension)
  # We match these as substrings within import statements.
  CANONICAL_BASENAME=$(basename "${CANONICAL_REL}" .tsx)
  CANONICAL_BASENAME_FULL=$(basename "${CANONICAL_REL}")

  # Import patterns we will grep for (substring match in source text):
  #   "from '@/<canonical_rel_no_ext>'"
  #   "from './<canonical_basename>'"     (any relative depth covered by */basename)
  #   "require('@/<canonical_rel_no_ext>')"
  #   "import '@/<canonical_rel_no_ext>'"
  CANONICAL_NO_EXT="${CANONICAL_REL%.*}"     # e.g. components/WorldlineGlobe
  IMPORT_ALIAS="@/${CANONICAL_NO_EXT}"       # e.g. @/components/WorldlineGlobe

  # ── B3 hardening: extension-variant names to scan ────────────────────────
  # The registry MATCH_PATTERN uses an exact filename (e.g. WorldlineGlobe.tsx).
  # A .jsx copy of a .tsx canonical has a different extension and is missed by
  # -name "<pattern>". We build the full set of extension variants for the
  # canonical basename so find catches WorldlineGlobe.jsx, .ts, .js as well.
  # Variants are derived from the canonical basename (no-ext) + all JS/TS exts.
  MATCH_NAMES=("${MATCH_PATTERN}")
  for _ext in tsx ts jsx js; do
    _variant="${CANONICAL_BASENAME}.${_ext}"
    # Avoid duplicating the primary pattern if its extension is already in the list
    if [[ "${_variant}" != "${MATCH_PATTERN}" ]]; then
      MATCH_NAMES+=("${_variant}")
    fi
  done

  # ── Scan duplicate_search_globs for copies ───────────────────────────────
  GLOB_COUNT=$(jq ".artifacts[${ai}].duplicate_search_globs | length" "${REGISTRY}")
  COPIES_CHECKED=0
  ARTIFACT_VIOLATIONS=0

  for (( gi=0; gi < GLOB_COUNT; gi++ )); do
    GLOB=$(jq -r ".artifacts[${ai}].duplicate_search_globs[${gi}]" "${REGISTRY}")
    log_v "  scanning glob: ${GLOB}"

    # Expand glob via find. Convert "some/path/**" to a find search root + depth.
    # We strip the trailing /** and search recursively under that directory.
    SEARCH_ROOT="${REPO_ROOT}/${GLOB%%\*\*}"
    SEARCH_ROOT="${SEARCH_ROOT%/}"    # trim trailing /

    [[ -d "${SEARCH_ROOT}" ]] || continue

    # Build -name predicates for the canonical name + extension variants (B3 fix).
    # The registry MATCH_PATTERN uses an exact filename (e.g. WorldlineGlobe.tsx).
    # A .jsx copy of a .tsx canonical has a different extension and escapes an
    # exact -name match. We expand to all JS/TS variants of the canonical basename
    # so find catches WorldlineGlobe.jsx, .ts, .js as well.
    # Syntax: one name  → find ... -name A
    #         many names → find ... \( -name A -o -name B -o ... \)
    _FIND_NAME_ARGS=()
    if [[ ${#MATCH_NAMES[@]} -eq 1 ]]; then
      _FIND_NAME_ARGS=(-name "${MATCH_NAMES[0]}")
    else
      _FIND_NAME_ARGS=(\()
      for _i in "${!MATCH_NAMES[@]}"; do
        if [[ ${_i} -gt 0 ]]; then
          _FIND_NAME_ARGS+=(-o)
        fi
        _FIND_NAME_ARGS+=(-name "${MATCH_NAMES[${_i}]}")
      done
      _FIND_NAME_ARGS+=(\))
    fi

    # Find files matching the name set under the search root, exclude build dirs
    while IFS= read -r -d '' copy_file; do
      # Skip the canonical itself — it is always in scope for match but is correct by definition
      if [[ "${copy_file}" == "${CANONICAL}" ]]; then
        log_v "    skip canonical self: ${copy_file}"
        continue
      fi

      COPIES_CHECKED=$((COPIES_CHECKED + 1))
      COPY_HASH=$(sha256sum "${copy_file}" | awk '{print $1}')
      COPY_REL="${copy_file#${REPO_ROOT}/}"

      # ── (A) Byte-identical check ─────────────────────────────────────────
      if [[ "${COPY_HASH}" == "${CANONICAL_HASH}" ]]; then
        log_v "    PASS (byte-identical): ${COPY_REL}"
        continue
      fi

      # ── (B) Importer check ───────────────────────────────────────────────
      # Check if the copy contains an import of the canonical module.
      # We grep for:
      #   1. The @/-aliased import path within an import/require/export statement
      #   2. The basename (relative import of any depth)
      # This is a textual heuristic; it catches the common cases. A file that
      # wraps/re-exports the canonical should satisfy this predicate.
      #
      # B4 FIX: Pattern 1 was previously a bare `grep -q "${IMPORT_ALIAS}"` which
      # matched the @/-alias path string ANYWHERE in the file, including inside
      # comments (e.g. `// copied from @/components/WorldlineGlobe`).
      # The fix: require the @/-alias path to appear within an import/require/export
      # statement. We apply the SAME context-anchored predicate as Pattern 2:
      #   (from|require|import)[[:space:]]*['"][^'"]*@/...
      # A comment that merely mentions the canonical path MUST NOT satisfy this predicate.
      IS_IMPORTER=false

      # Pattern 1: @/-alias import ANCHORED to import/require/export statement (B4 fix)
      # Escape any regex-special characters in the alias path (dots, slashes).
      IMPORT_ALIAS_ESCAPED="${IMPORT_ALIAS//\./\\.}"
      IMPORT_ALIAS_ESCAPED="${IMPORT_ALIAS_ESCAPED//\//\\/}"
      if grep -qE "(from|require|import|export)[[:space:]]*['\"][^'\"]*${IMPORT_ALIAS_ESCAPED}" "${copy_file}" 2>/dev/null; then
        IS_IMPORTER=true
        log_v "    PASS (imports @-alias '${IMPORT_ALIAS}'): ${COPY_REL}"
      fi

      # Pattern 2: relative import by basename (any relative depth)
      # We look for: from '[./]...<basename>' — covers ../WorldlineGlobe, ./WorldlineGlobe etc.
      # ANCHORED: the match must end at the canonical basename boundary — either at the
      # start of a quote/extension, or at the end of the import path.  This prevents
      # WorldlineGlobeHelper from satisfying the predicate for WorldlineGlobe.
      # Pattern: <basename>(['".]|[jt]sx?['"])
      #   - WorldlineGlobe'   or  WorldlineGlobe"   → bare-name relative import
      #   - WorldlineGlobe.tsx'  / .ts' / .jsx' / .js'  → import with explicit extension
      # Substring-only forms (WorldlineGlobeHelper...) do NOT match.
      if ! $IS_IMPORTER; then
        # Escape dots in basename for grep
        BASENAME_NO_EXT_ESCAPED="${CANONICAL_BASENAME//./\\.}"
        ANCHORED_PATTERN="${BASENAME_NO_EXT_ESCAPED}(['\"]|\\.[jt]sx?['\"])"
        if grep -qE "(from|require|import)[[:space:]]*['\"][^'\"]*${ANCHORED_PATTERN}" "${copy_file}" 2>/dev/null; then
          IS_IMPORTER=true
          log_v "    PASS (relative import of '${CANONICAL_BASENAME}'): ${COPY_REL}"
        fi
      fi

      if $IS_IMPORTER; then
        continue
      fi

      # ── (C) Neither — DIVERGENT DUPLICATE ───────────────────────────────
      log_err "  DIVERGENT DUPLICATE: ${COPY_REL}"
      log_err "    canonical sha256: ${CANONICAL_HASH}"
      log_err "    copy sha256:      ${COPY_HASH}"
      log_err "    Fix options:"
      log_err "      1. Delete the divergent copy (if transient prototype artifact)."
      log_err "      2. Overwrite with canonical content: cp ${CANONICAL_REL} ${COPY_REL}"
      log_err "      3. If this is a consumer/wrapper, add: import ... from '${IMPORT_ALIAS}'"
      ARTIFACT_VIOLATIONS=$((ARTIFACT_VIOLATIONS + 1))

    done < <(find "${SEARCH_ROOT}" \
      "${_FIND_NAME_ARGS[@]}" \
      -not -path "*/node_modules/*" \
      -not -path "*/.next/*" \
      -not -path "*/.turbo/*" \
      -not -path "*/dist/*" \
      -print0 2>/dev/null)
  done

  log "  ${COPIES_CHECKED} copies scanned · ${ARTIFACT_VIOLATIONS} divergent"

  if [[ ${ARTIFACT_VIOLATIONS} -gt 0 ]]; then
    log "  FAIL artifact=${ART_ID} (${ARTIFACT_VIOLATIONS} divergent duplicate(s))"
    TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + ARTIFACT_VIOLATIONS))
  else
    log "  PASS artifact=${ART_ID}"
  fi
done

log ""
if [[ ${TOTAL_VIOLATIONS} -gt 0 ]]; then
  log "FAIL — ${TOTAL_VIOLATIONS} divergent duplicate(s) found across ${ARTIFACT_COUNT} artifact(s)"
  log "  A divergent copy is neither byte-identical to the canonical nor imports it."
  log "  See above for per-copy remediation instructions."
  exit 1
else
  log "PASS — all copies are byte-identical to canonical or legitimate importers"
  exit 0
fi
