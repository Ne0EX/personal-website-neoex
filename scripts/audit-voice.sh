#!/usr/bin/env bash
# scripts/audit-voice.sh
# Rail: voice-discipline
# Owner: Canopus (α-HRN-07)
# Status: STUB — not yet enforcing
#
# TODO: This rail is not yet implemented.
# Implementation requires (two collaborators, sequential):
#
#   1. Arcturus (α-NET-05) — NETRA voice spec must be formalized in lib/netra/ as a
#      machine-readable contract: a list of required voice patterns, disallowed drift
#      patterns, and canonical examples for each. This spec does not exist yet.
#      Without it, this rail cannot know what "correct NETRA voice" looks like.
#
#   2. Algol (α-VER-06) — TypeScript audit script (scripts/audit-voice.ts) that:
#       a. Reads the voice spec from lib/netra/ (Arcturus's output)
#       b. Scans lib/netra/prompts/** and components/*Netra*.tsx for drift patterns
#       c. Reports file:line:drift-description for each violation
#
#   3. Canopus — replace this stub with a bash wrapper that calls scripts/audit-voice.ts
#
# Follow-up TASK proposal: TASK_audit-voice
#   Agents: Arcturus (voice spec formalization) + Algol (TS audit logic) + Canopus (wrapper)
#   Unblock condition: Arcturus ships the machine-readable voice spec; Algol writes the
#   TypeScript checker; Canopus wires the bash wrapper.
#   Sequencing: Arcturus → Algol → Canopus (strict dependency chain)
#
# Tracked in docs/team/STATUS.md known-gaps section.

echo "[voice-discipline] STUB — rail not enforcing yet (see TASK candidates in STATUS.md)"
exit 0
