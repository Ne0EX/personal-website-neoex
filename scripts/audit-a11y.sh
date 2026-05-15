#!/usr/bin/env bash
# scripts/audit-a11y.sh
# Rail: accessibility-floor
# Owner: Canopus (α-HRN-07)
# Status: STUB — not yet enforcing
#
# TODO: This rail is not yet implemented.
# Implementation requires:
#
#   1. A Lighthouse runner (Algol's territory) that:
#       a. Starts the dev server (or uses a pre-built static export)
#       b. Runs Lighthouse with --only-categories=accessibility against each changed route
#          under app/articles/**, app/photos/**, app/fiction/**
#       c. Parses the Lighthouse JSON output and checks that score >= 95
#       d. Reports failing routes with their actual score and the specific failing audits
#
#      Lighthouse can be invoked via: npx lighthouse http://localhost:3000/<route>
#        --only-categories=accessibility --output=json --chrome-flags="--headless"
#      The Playwright MCP server (wired via .mcp.json) is available as an alternative
#      path — see docs/harness/RENDERING.md for the infrastructure map.
#
#   2. Algol writes scripts/audit-a11y.ts as the TypeScript runner
#
#   3. Canopus replaces this stub with a bash wrapper that:
#       a. Starts the dev server if not already running
#       b. Calls scripts/audit-a11y.ts
#       c. Passes through exit codes
#       d. Cleans up the server process
#
# Note: This rail is intentionally slow (Lighthouse takes ~5–15s per route).
#   It should run in CI on PR rather than on every harness-check.sh invocation.
#   Canopus will parallelize route checks when implementing the real wrapper.
#
# Follow-up TASK proposal: TASK_audit-a11y
#   Agents: Algol (Lighthouse runner + TS script) + Canopus (bash wrapper + CI wiring)
#   Unblock condition: Algol ships scripts/audit-a11y.ts with a working Lighthouse run
#
# Tracked in docs/team/STATUS.md known-gaps section.

echo "[accessibility-floor] STUB — rail not enforcing yet (see TASK candidates in STATUS.md)"
exit 0
