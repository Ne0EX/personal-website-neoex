#!/usr/bin/env bash
# scripts/audit-prototype-discipline.sh
# Rail: prototype-layer
# Owner: Canopus (α-HRN-07)
# Introduced: TASK-2026-05-15-META-10
#
# Purpose: Enforce that prototypes/** stay vanilla (no TypeScript, no Next.js imports,
#   no @/ path aliases) and that every prototype directory has a README.md.
#
# Usage:
#   bash scripts/audit-prototype-discipline.sh
#
# No environment variables required. Runs against the current working tree.
#
# Exit codes:
#   0 — all checks pass
#   1 — one or more violations; list printed as "file:reason" to stdout
#   2 — prototypes/ directory does not exist (skip-pass; layer not yet populated)
#   3 — internal error (unexpected)
#
# Rules enforced:
#   R1  No .ts or .tsx files in prototypes/**
#   R2  No 'from "next/...' or "from 'next/..." import statements in prototype JS files
#   R3  No import statements referencing @/ (Next.js alias) in prototype JS files
#   R4  Each subdirectory directly under prototypes/ must contain a README.md
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

# --- guard: prototypes dir must exist ---
if [[ ! -d "$PROTO_DIR" ]]; then
  echo "[prototype-discipline] SKIP · prototypes/ does not exist (exit 2)"
  exit 2
fi

VIOLATIONS=""
SCANNED=0
DIRS_CHECKED=0

# --- R1: no .ts or .tsx files ---
while IFS= read -r -d '' f; do
  VIOLATIONS="${VIOLATIONS}"$'\n'"${f}:R1 · TypeScript not allowed in prototype layer (use vanilla JS)"
done < <(find "$PROTO_DIR" \( -name '*.ts' -o -name '*.tsx' \) -not -path '*/.gitkeep' -print0 2>/dev/null)

# --- R2 + R3: scan JS files for forbidden import patterns ---
while IFS= read -r -d '' f; do
  SCANNED=$((SCANNED + 1))

  # R2: Next.js imports
  if grep -qE "from ['\"]next/" "$f" 2>/dev/null; then
    LINENO=$(grep -nE "from ['\"]next/" "$f" 2>/dev/null | head -1 | cut -d: -f1)
    VIOLATIONS="${VIOLATIONS}"$'\n'"${f}:${LINENO}:R2 · Next.js import forbidden in prototype (from 'next/...')"
  fi
  # Also catch: import('next/...') dynamic imports
  if grep -qE "import\(['\"]next/" "$f" 2>/dev/null; then
    LINENO=$(grep -nE "import\(['\"]next/" "$f" 2>/dev/null | head -1 | cut -d: -f1)
    VIOLATIONS="${VIOLATIONS}"$'\n'"${f}:${LINENO}:R2 · Next.js dynamic import forbidden in prototype"
  fi

  # R3: @/ path alias imports
  if grep -qE "from ['\"]@/" "$f" 2>/dev/null; then
    LINENO=$(grep -nE "from ['\"]@/" "$f" 2>/dev/null | head -1 | cut -d: -f1)
    VIOLATIONS="${VIOLATIONS}"$'\n'"${f}:${LINENO}:R3 · @/ alias import forbidden in prototype (no Next.js path resolution)"
  fi
  if grep -qE "import\(['\"]@/" "$f" 2>/dev/null; then
    LINENO=$(grep -nE "import\(['\"]@/" "$f" 2>/dev/null | head -1 | cut -d: -f1)
    VIOLATIONS="${VIOLATIONS}"$'\n'"${f}:${LINENO}:R3 · @/ alias dynamic import forbidden in prototype"
  fi

done < <(find "$PROTO_DIR" -name '*.js' -not -path '*/.gitkeep' -print0 2>/dev/null)

# --- R4: each immediate subdirectory must have README.md ---
while IFS= read -r -d '' subdir; do
  DIRS_CHECKED=$((DIRS_CHECKED + 1))
  if [[ ! -f "${subdir}/README.md" ]]; then
    VIOLATIONS="${VIOLATIONS}"$'\n'"${subdir}:R4 · prototype directory missing README.md (explain what this prototype represents)"
  fi
done < <(find "$PROTO_DIR" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null)

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
