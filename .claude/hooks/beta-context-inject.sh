#!/usr/bin/env bash
# .claude/hooks/beta-context-inject.sh
# UserPromptSubmit hook — STUB (logic merged into persona-tracker.sh)
#
# WHY THIS IS A STUB (TASK-2026-05-23-BETA-INJECTION-HOOK / REVISE-3):
# Claude Code v2.1.x runs UserPromptSubmit hooks in parallel, not sequentially.
# This hook previously read .current-persona written by persona-tracker.sh, but
# both ran concurrently — this hook read stale polaris/genesis content and
# emitted [SKIP] on valid beta sessions.
#
# Fix: all beta overlay injection logic is now inside persona-tracker.sh,
# which detects mode AND injects in one atomic run. This stub exists only to
# preserve the settings.json hook list without configuration churn.
#
# This script does nothing. It drains stdin, logs that it ran as a stub, and
# exits 0. It emits no stdout (no additionalContext injection).
#
# Do not call directly. Registered in .claude/settings.json UserPromptSubmit.

set -uo pipefail

_REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$_REPO_ROOT"

LOG_DIR=".claude/hook-logs"
mkdir -p "$LOG_DIR"

TASK_ID="${CLAUDE_TASK_ID:-${WL_TASK_ID:-session-$(date +%s)}}"
TIMESTAMP="$(date -u +%FT%TZ)"
LOG="$LOG_DIR/${TASK_ID}--beta-context-inject.log"

# Drain stdin (required — hooks that do not drain stdin may cause errors)
INPUT=""
if [[ ! -t 0 ]]; then
  INPUT="$(cat 2>/dev/null || true)"
fi

printf '%s · [STUB] beta-context-inject.sh is a no-op stub — injection handled by persona-tracker.sh · input_length=%s\n' \
  "$TIMESTAMP" "${#INPUT}" >> "$LOG" 2>/dev/null || true

# No stdout — persona-tracker.sh owns additionalContext output for beta sessions.
exit 0
