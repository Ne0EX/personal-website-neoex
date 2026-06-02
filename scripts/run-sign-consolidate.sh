#!/usr/bin/env bash
# Temporary script to run sign-work.sh with env vars for CONSOLIDATE-TO-CLOSE task
# Remove after signing is complete.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

export WL_AGENT=canopus
export WL_NEXT=algol
export WL_STARTED_AT="2026-06-01T00:00:00+07:00"
export WL_SUMMARY="CONSOLIDATE-TO-CLOSE: fixed subshell-redirect over-block (anchor ){}), diagnosed sign-work trailing-newline cohort split (50 sigs), updated SCHEMA.md; all three test suites green (113/113 fixture, 74/74 probe, 9/9 audit-fail)."

bash .claude/hooks/sign-work.sh TASK-2026-06-01-SECURITY-HARNESS-CONSOLIDATE-TO-CLOSE
