#!/usr/bin/env bash
# Quick probe: empty ledger file -> exit 5
set -uo pipefail
AUDIT="/Users/neospiritth/codingspace/personal_website/scripts/audit-memory-drift.sh"
S="$(mktemp -d 2>/dev/null || mktemp -d -t m2empty)"
trap 'rm -rf "$S"' EXIT
FREPO="$S/repo"; FAUTO="$S/auto"; LEDGER="$S/ledger.jsonl"
mkdir -p "$FREPO/.claude/handoffs" "$FAUTO"
printf '' > "$LEDGER"
OUT="$(WL_REPO_ROOT="$FREPO" WL_INTEGRITY_LEDGER="$LEDGER" WL_AUTO_MEMORY_DIR="$FAUTO" WL_MEMORY_MD="$FREPO/MEMORY.md" WL_TASK_ID="m2-empty" bash "$AUDIT" 2>&1)"; EX=$?
echo "empty-ledger exit=$EX (want 5)"
echo "$OUT" | grep -E 'NOTICE|empty|exit 5' | head -3
[[ "$EX" == 5 ]] && echo "OK" || echo "FAIL"
