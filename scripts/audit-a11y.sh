#!/usr/bin/env bash
# Required production-browser WCAG A/AA rail.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec node --import tsx "${REPO_ROOT}/scripts/audit-a11y.ts" --root "${REPO_ROOT}" "$@"
