#!/usr/bin/env bash
# Named rail wrapper. Contract logic and envelope validation live in the shared
# Canopus bridge; Algol owns the TypeScript audit and its regression tests.

set -u -o pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${SCRIPT_DIR}/audit-security-netra-contracts.sh" console
