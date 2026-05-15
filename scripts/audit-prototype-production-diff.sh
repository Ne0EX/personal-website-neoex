#!/usr/bin/env bash
# scripts/audit-prototype-production-diff.sh
# Rail: prototype-production-diff (STUB)
# Owner: Canopus (α-HRN-07)
# Introduced: TASK-2026-05-15-META-10 (STUB)
# Real implementation: META-11 (Algol writes pixel-diff logic; Canopus wraps)
#
# Purpose: Detect visual drift between Betelgeuse's prototype and Sirius's production
#   implementation before the brand-bearing surface ships.
#
# This file is an HONEST STUB. It exits 0 with a TODO message.
# It does not block any current task closure.
# Real pixel-diff audit logic is deferred to META-11 because:
#   - Pixel diffing has noise issues that need careful tuning
#   - The Playwright MCP rendering infrastructure needs to stabilize first
#   - The runtime rail (audit-prototype-runtime.sh) handles binary pass/fail;
#     drift detection requires a calibrated threshold approach
#
# Usage:
#   bash scripts/audit-prototype-production-diff.sh
#
# Exit codes (stub):
#   0 — stub pass (always; no real audit logic)
#
# Exit codes (planned — META-11):
#   0 — PASS · pixel drift within acceptable threshold
#   1 — DRIFT-FLAG · drift above warning threshold (review recommended)
#   2 — FAIL · drift above fail threshold (soul-loss in translation)
#   3 — SKIP · no prototype/production pair found for this task
#
# Planned implementation (META-11 contract):
#   1. Locate prototype: prototypes/<surface>/index.html
#   2. Locate production: app/<surface>/page.tsx
#   3. Render both via Playwright MCP at canonical viewport (1440×900)
#   4. Pixel diff (Jimp or pixelmatch) → percentage drift
#   5. Compare against thresholds from .harness/diff-thresholds.json
#   6. Emit: PASS / DRIFT-FLAG / FAIL with drift% and screenshot paths

set -euo pipefail

# TODO(META-11): Algol implements pixel-diff audit logic; Canopus wraps here.
# For now this stub exits cleanly so it doesn't block prototype-layer TASK closures.

echo "[prototype-production-diff] STUB · real pixel-diff audit deferred to META-11"
echo "  When META-11 lands: Algol writes diff logic · Canopus wraps here"
echo "  Prototype path:    prototypes/<surface>/index.html"
echo "  Production path:   app/<surface>/page.tsx"
echo "  Diff method:       Playwright MCP + pixelmatch (planned)"
exit 0
