#!/usr/bin/env bash
# Required deterministic NETRA voice source-contract rail.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec node --import tsx "${REPO_ROOT}/scripts/audit-voice.ts" --root "${REPO_ROOT}" "$@"
