#!/usr/bin/env bash
# .claude/hooks/visual-diff.sh
# Usage: bash .claude/hooks/visual-diff.sh <task_id>
#
# STATUS schema (allowed values for .claude/visual-diffs/<task_id>/STATUS):
#   exploring              — 2+ directions under directions/ not yet reviewed
#   awaiting-direction-lock — directions in place, >=1 shot, Peat review pending
#   locked                 — one direction promoted to prototype/
#   revise-N               — locked prototype in REVISE round N (e.g. revise-1, revise-2)
#   awaiting-betelgeuse    — visual-diff gate: pending Betelgeuse review
#   betelgeuse-approved    — final approval
#
# See: docs/harness/RAIL-DEFINITIONS.md#visual-diff-status-schema
set -euo pipefail

TASK_ID="${1:-${WL_TASK_ID:-}}"
if [[ -z "$TASK_ID" ]]; then
  echo "visual-diff: missing task_id" >&2
  exit 2
fi

OUT_DIR=".claude/visual-diffs/$TASK_ID"
mkdir -p "$OUT_DIR/before" "$OUT_DIR/after"

echo "[visual-diff] capturing screenshots for task=$TASK_ID"

# Detect changed routes from the diff
ROUTES=$(git diff --name-only --diff-filter=AM 2>/dev/null \
  | grep -E '^(app|components)/' \
  | xargs -r -n1 dirname \
  | sort -u \
  | sed -E 's|^app||; s|/page\.tsx$||; s|^$|/|' \
  | sort -u)

if [[ -z "$ROUTES" ]]; then
  echo "[visual-diff] no route changes detected — manual review required"
  echo "[visual-diff] add screenshots manually to $OUT_DIR/{before,after}/"
  exit 0
fi

echo "[visual-diff] routes to capture:"
echo "$ROUTES" | sed 's/^/  /'

if [[ -x scripts/visual-capture.sh ]]; then
  bash scripts/visual-capture.sh "$TASK_ID" "$ROUTES"
else
  echo "[visual-diff] scripts/visual-capture.sh missing — Canopus must implement it" >&2
  echo "[visual-diff] for now, manually screenshot routes above to $OUT_DIR/{before,after}/"
fi

# Run directions/ discipline audit (html-first-spec-discipline rail)
# This audit runs BEFORE marking awaiting-betelgeuse.
# Blocking violations (Rule 4) prevent the STATUS write and exit non-zero.
AUDIT_SCRIPT="scripts/audit-visual-diff-directions.sh"
if [[ -x "$AUDIT_SCRIPT" ]]; then
  echo "[visual-diff] running directions discipline audit..."
  if ! bash "$AUDIT_SCRIPT" "$TASK_ID"; then
    echo "[visual-diff] BLOCK — directions audit found Rule 4 violations." >&2
    echo "[visual-diff] Resolve soul-baseline issues before marking awaiting-betelgeuse." >&2
    echo "[visual-diff] See scripts/audit-visual-diff-directions.sh output above for details." >&2
    exit 1
  fi
  echo "[visual-diff] directions audit passed."
else
  echo "[visual-diff] WARN: $AUDIT_SCRIPT not found or not executable — directions audit skipped" >&2
fi

# Soul-atom drift gate — runs when soul-atlas files are in the changed set.
# Blocks awaiting-betelgeuse write if audit exits 1/2/4/5/6 (hard failures).
# Exit 3 (TS absent) is also blocking in Phase 2.
SOUL_ATLAS_CHANGED=$(git diff --name-only --diff-filter=AM 2>/dev/null \
  | grep -E '^\.claude/visual-diffs/soul-atlas/' || true)
if [[ -n "${SOUL_ATLAS_CHANGED}" ]]; then
  echo "[visual-diff] soul-atlas files changed — running soul-atom-drift audit..."
  SOUL_AUDIT_SCRIPT="scripts/audit-soul-atom-drift.sh"
  if [[ -x "${SOUL_AUDIT_SCRIPT}" ]]; then
    SOUL_AUDIT_EXIT=0
    bash "${SOUL_AUDIT_SCRIPT}" || SOUL_AUDIT_EXIT=$?
    if [[ "${SOUL_AUDIT_EXIT}" -ne 0 ]]; then
      echo "[visual-diff] BLOCK — soul-atom-drift audit failed (exit ${SOUL_AUDIT_EXIT})." >&2
      echo "[visual-diff] Resolve soul-atlas drift violations before marking awaiting-betelgeuse." >&2
      echo "[visual-diff] See scripts/audit-soul-atom-drift.sh output above for details." >&2
      exit 1
    fi
    echo "[visual-diff] soul-atom-drift audit passed."
  else
    echo "[visual-diff] WARN: ${SOUL_AUDIT_SCRIPT} not found or not executable — soul-atom-drift audit skipped" >&2
  fi
fi

# Mark task as awaiting Betelgeuse
echo "awaiting-betelgeuse" > "$OUT_DIR/STATUS"
echo "[visual-diff] task marked awaiting-betelgeuse at $OUT_DIR/STATUS"
echo "[visual-diff] Betelgeuse reviews before handoff finalization."
exit 0
