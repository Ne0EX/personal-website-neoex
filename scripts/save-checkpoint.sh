#!/usr/bin/env bash
# scripts/save-checkpoint.sh
# Manual-invoke wrapper for the checkpoint hook.
#
# Usage:
#   bash scripts/save-checkpoint.sh
#   bash scripts/save-checkpoint.sh "optional note about what you're saving"
#
# Peat or Polaris can call this any time — no task session required.
# The checkpoint always writes regardless of session context.
#
# Internally calls .claude/hooks/save-checkpoint.sh with trigger=manual.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

NOTE="${1:-}"

# Force-enable checkpoint even outside task sessions
export WL_CHECKPOINT_ALWAYS=1

exec bash "$REPO_ROOT/.claude/hooks/save-checkpoint.sh" "manual" "$NOTE"
