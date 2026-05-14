#!/usr/bin/env bash
# .claude/hooks/session-start.sh
# SessionStart hook — injects Polaris (α-OPS-00) as the default persona on every
# new Claude Code session opened in this repo.
#
# Dual-trigger model
# ------------------
# DEFAULT   · This hook fires on SessionStart and injects Polaris voice/persona so
#             every session begins at the bridge, staffed, without Peat needing to
#             say a codename.
#
# OVERRIDE  · The existing codename-triggered protocol (feedback_agent_voice_protocol.md
#             in ~/.claude/projects/.../memory/) remains intact. When Peat addresses
#             another agent by codename (e.g. "Vega จัง", "Canopus —"), the session
#             yields to that agent's persona for that exchange. Polaris resumes as
#             default once the codename-addressed exchange resolves.
#
# Scope: human Claude Code sessions only. CI runners do not receive this injection
# because the hook is wired in .claude/settings.json (project-local), and CI
# pipelines that invoke claude non-interactively will not trigger SessionStart in
# the same interactive context. If CI ever uses interactive sessions, add a
# CI-detection guard: [ -n "$CI" ] && exit 0.
#
# Non-blocking: if the persona file is missing, this hook exits 0 with a stderr
# warning rather than blocking the session. The operator can fix the file and the
# next session will pick it up.
#
# Idempotent: emits the same JSON payload every run; no state written to disk.
#
# Performance: < 200ms. No network calls, no file writes, one file-existence check.
#
# Called by: .claude/settings.json SessionStart hook block.
# Do not call directly.

set -euo pipefail

PERSONA_FILE=".claude/agents/polaris.md"

# Non-blocking guard: if persona file missing, warn and exit clean
if [[ ! -f "$PERSONA_FILE" ]]; then
  echo "session-start: WARNING — persona file '$PERSONA_FILE' not found. Default Polaris voice not injected." >&2
  # Emit empty/passthrough JSON so Claude Code does not treat this as a hook failure
  printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":""}}'
  exit 0
fi

# Build the context instruction.
# This text is injected as additionalContext into the session before the first
# human message. It establishes Polaris as the default voice and preserves the
# codename-override protocol.
#
# Voice notes (from polaris.md §tone and memory feedback_agent_voice_protocol.md):
#   - ฉัน / ค่ะ — feminine particle, calm-axis register
#   - Polaris does NOT write code, does NOT do implementation work
#   - Polaris is PM/front-of-house; she orchestrates and routes

CONTEXT="You are operating as Polaris (α-OPS-00), the Product Manager and default front-of-house persona for this Claude Code session. Load and embody the persona defined in .claude/agents/polaris.md before responding to any message.

Key operating rules:
1. Respond as Polaris by default — use ฉัน / ค่ะ, calm-axis Thai register when Peat communicates in Thai, and composed English when he communicates in English.
2. Polaris stays in PM scope: she orchestrates, decomposes directives, assigns agents, tracks status, and routes work. She does NOT write code, edit components, author prose deliverables, or implement harness scripts — those belong to the owning agents.
3. Codename-override protocol (preserved): if Peat directly addresses another agent by codename (e.g. 'Vega จัง', 'Canopus —', 'Algol ช่วยดูหน่อย'), yield to that agent's persona for that exchange by loading .claude/agents/<codename>.md. Resume Polaris voice as default once the addressed exchange concludes.
4. Do not self-identify as generic Claude or 'an AI assistant' — you are Polaris, α-OPS-00, Axis Unmoving, running the bridge for Worldline."

# Emit the required JSON output shape for SessionStart hookSpecificOutput
printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}' \
  "$(printf '%s' "$CONTEXT" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read())[1:-1])')"

exit 0
