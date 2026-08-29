#!/usr/bin/env bash
# scripts/audit-prototype-discipline.sh
# Rail: prototype-layer
# Owner: Canopus (α-HRN-07)
# Introduced: TASK-2026-05-15-META-10
#
# Purpose: Enforce that prototypes/** stays vanilla (no TypeScript, no Next.js
#   imports, no @/ path aliases) and that every production prototype directory
#   has a README.md. Legacy visual-diff prototype bundles can be included
#   explicitly with --include-visual-diffs; CI keeps that task-artifact scope
#   deferred until its README contract is migrated.
#
# Usage:
#   bash scripts/audit-prototype-discipline.sh
#   bash scripts/audit-prototype-discipline.sh --production-only
#   bash scripts/audit-prototype-discipline.sh --include-visual-diffs
#
# No environment variables required. Runs against the current working tree.
#
# Exit codes:
#   0 — all checks pass
#   1 — one or more violations; list printed as "file:reason" to stdout
#   2 — production prototypes/ directory does not exist (skip; layer not yet populated)
#   3 — internal error (unexpected)
#
# Rules enforced:
#   R1  No .ts or .tsx files in the selected prototype roots
#   R2  No 'from "next/...' or "from 'next/..." import statements in prototype JS files
#   R3  No import statements referencing @/ (Next.js alias) in prototype JS files
#   R4  Each prototype directory must contain a README.md
#
# How to fix a fail:
#   R1: Remove or rename the .ts/.tsx file. Prototypes use plain JavaScript only.
#       If you need types, document them in comments; do not use TypeScript syntax.
#   R2: Remove the Next.js import. Prototypes are standalone; they cannot reference
#       the production module graph.
#   R3: Remove the @/ import. Prototypes cannot use the Next.js path alias.
#       If you need a shared utility, copy-paste it into the prototype directory.
#   R4: Add a README.md in the prototype directory explaining what it represents,
#       what design decision it validates, and which production component it maps to.

set -euo pipefail

PROTO_DIR="prototypes"
VISUAL_DIFF_DIR=".claude/visual-diffs"
INCLUDE_VISUAL_DIFFS=false

case "${1:-}" in
  ""|"--production-only"|"--verbose")
    ;;
  "--include-visual-diffs")
    INCLUDE_VISUAL_DIFFS=true
    ;;
  *)
    echo "[prototype-discipline] ERROR · unsupported option: ${1}" >&2
    exit 3
    ;;
esac

PROTOTYPE_DIRS=()

if [[ -d "${PROTO_DIR}" ]]; then
  PROTOTYPE_DIRS+=("${PROTO_DIR}")
fi

# Visual-diff prototypes live at .claude/visual-diffs/<task>/prototype/. Find
# only those directories; the surrounding visual-diff task folders are not
# themselves prototype roots. Sorting makes findings stable across filesystems.
# They are opt-in because existing task bundles predate the production README
# contract and are intentionally deferred in the R0 CI census.
if [[ "${INCLUDE_VISUAL_DIFFS}" == "true" && -d "${VISUAL_DIFF_DIR}" ]]; then
  while IFS= read -r prototype_dir; do
    [[ -z "${prototype_dir}" ]] || PROTOTYPE_DIRS+=("${prototype_dir}")
  done < <(
    find "${VISUAL_DIFF_DIR}" -mindepth 2 -maxdepth 2 -type d -name prototype -print 2>/dev/null \
      | LC_ALL=C sort
  )
fi

# --- guard: production prototype root must exist ---
if [[ "${#PROTOTYPE_DIRS[@]}" -eq 0 ]]; then
  echo "[prototype-discipline] SKIP · prototypes/ does not exist (exit 2)"
  exit 2
fi

VIOLATIONS=""
SCANNED=0
DIRS_CHECKED=0

# --- R1: no .ts or .tsx files ---
for prototype_root in "${PROTOTYPE_DIRS[@]}"; do
  while IFS= read -r f; do
    [[ -z "${f}" ]] && continue
    VIOLATIONS="${VIOLATIONS}"$'\n'"${f}:R1 · TypeScript not allowed in prototype layer (use vanilla JS)"
  done < <(
    find "${prototype_root}" \( -name '*.ts' -o -name '*.tsx' \) \
      -not -path '*/.gitkeep' -type f -print 2>/dev/null | LC_ALL=C sort
  )
done

# --- R2 + R3: scan JS files for forbidden import patterns ---
for prototype_root in "${PROTOTYPE_DIRS[@]}"; do
  while IFS= read -r f; do
    [[ -z "${f}" ]] && continue
    SCANNED=$((SCANNED + 1))

    # R2: Next.js imports
    if grep -qE "from ['\"]next/" "$f" 2>/dev/null; then
      LINE_NUM=$(grep -nE "from ['\"]next/" "$f" 2>/dev/null | head -1 | cut -d: -f1)
      VIOLATIONS="${VIOLATIONS}"$'\n'"${f}:${LINE_NUM}:R2 · Next.js import forbidden in prototype (from 'next/...')"
    fi
    # Also catch: import('next/...') dynamic imports
    if grep -qE "import\(['\"]next/" "$f" 2>/dev/null; then
      LINE_NUM=$(grep -nE "import\(['\"]next/" "$f" 2>/dev/null | head -1 | cut -d: -f1)
      VIOLATIONS="${VIOLATIONS}"$'\n'"${f}:${LINE_NUM}:R2 · Next.js dynamic import forbidden in prototype"
    fi

    # R3: @/ path alias imports
    if grep -qE "from ['\"]@/" "$f" 2>/dev/null; then
      LINE_NUM=$(grep -nE "from ['\"]@/" "$f" 2>/dev/null | head -1 | cut -d: -f1)
      VIOLATIONS="${VIOLATIONS}"$'\n'"${f}:${LINE_NUM}:R3 · @/ alias import forbidden in prototype (no Next.js path resolution)"
    fi
    if grep -qE "import\(['\"]@/" "$f" 2>/dev/null; then
      LINE_NUM=$(grep -nE "import\(['\"]@/" "$f" 2>/dev/null | head -1 | cut -d: -f1)
      VIOLATIONS="${VIOLATIONS}"$'\n'"${f}:${LINE_NUM}:R3 · @/ alias dynamic import forbidden in prototype"
    fi

  done < <(
    find "${prototype_root}" -name '*.js' -not -path '*/.gitkeep' -type f -print 2>/dev/null \
      | LC_ALL=C sort
  )
done

# --- R4: each prototype directory must have README.md ---
if [[ -d "${PROTO_DIR}" ]]; then
  while IFS= read -r subdir; do
    [[ -z "${subdir}" ]] && continue
    DIRS_CHECKED=$((DIRS_CHECKED + 1))
    if [[ ! -f "${subdir}/README.md" ]]; then
      VIOLATIONS="${VIOLATIONS}"$'\n'"${subdir}:R4 · prototype directory missing README.md (explain what this prototype represents)"
    fi
  done < <(
    find "${PROTO_DIR}" -mindepth 1 -maxdepth 1 -type d -print 2>/dev/null \
      | LC_ALL=C sort
  )
fi

for subdir in "${PROTOTYPE_DIRS[@]}"; do
  [[ "${subdir}" == "${PROTO_DIR}" ]] && continue
  DIRS_CHECKED=$((DIRS_CHECKED + 1))
  if [[ ! -f "${subdir}/README.md" ]]; then
    VIOLATIONS="${VIOLATIONS}"$'\n'"${subdir}:R4 · prototype directory missing README.md (explain what this prototype represents)"
  fi
done

# --- emit result ---
VIOLATIONS=$(printf '%s' "$VIOLATIONS" | grep -v '^$' || true)

if [[ -z "$VIOLATIONS" ]]; then
  echo "[prototype-discipline] PASS · $SCANNED JS file(s) scanned · $DIRS_CHECKED prototype dir(s) checked"
  exit 0
else
  VCOUNT=$(echo "$VIOLATIONS" | grep -c '.' || echo 0)
  echo "[prototype-discipline] FAIL · $VCOUNT violation(s):"
  echo "$VIOLATIONS" | while IFS= read -r v; do
    [[ -z "$v" ]] && continue
    echo "  $v"
  done
  echo ""
  echo "  See scripts/audit-prototype-discipline.sh header for fix instructions."
  exit 1
fi
