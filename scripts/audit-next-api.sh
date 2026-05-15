#!/usr/bin/env bash
# scripts/audit-next-api.sh
# Rail: next-16-api
# Owner: Canopus (α-HRN-07)
# Status: STUB — not yet enforcing
#
# TODO: This rail is not yet implemented.
# Implementation requires:
#   - A TypeScript audit script (Algol's territory: scripts/audit-next-api.ts) that:
#       1. Reads the current Next.js version from node_modules/next/package.json
#       2. Cross-references a maintained list of deprecated API patterns
#          (e.g., getInitialProps, pages/ router APIs, _document/_app imports that
#          are invalid in the App Router, useRouter from next/router vs next/navigation)
#       3. Greps app/** for each deprecated pattern and reports file:line:pattern
#   - This bash wrapper calls that TS script via tsx/ts-node and passes through exit codes
#   - The specific deprecated-API list must come from reading node_modules/next/dist/docs/
#     per the AGENTS.md instruction — it cannot be hard-coded from training data
#
# Follow-up TASK proposal: TASK_audit-next-api
#   Agents: Algol (TS audit logic) + Canopus (bash wrapper)
#   Unblock condition: Algol writes scripts/audit-next-api.ts; Canopus replaces this stub
#
# Tracked in docs/team/STATUS.md known-gaps section.

echo "[next-16-api] STUB — rail not enforcing yet (see TASK candidates in STATUS.md)"
exit 0
