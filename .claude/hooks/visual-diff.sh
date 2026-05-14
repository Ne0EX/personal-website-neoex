#!/usr/bin/env bash
# .claude/hooks/visual-diff.sh
# Usage: bash .claude/hooks/visual-diff.sh <task_id>
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

# Mark task as awaiting Betelgeuse
echo "awaiting-betelgeuse" > "$OUT_DIR/STATUS"
echo "[visual-diff] task marked awaiting-betelgeuse at $OUT_DIR/STATUS"
echo "[visual-diff] Betelgeuse reviews before handoff finalization."
exit 0
