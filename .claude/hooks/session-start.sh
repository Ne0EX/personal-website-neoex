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

set -uo pipefail
# NOTE: deliberately NOT using -e (errexit) here.
# SessionStart is the entry point for every session. If it exits non-zero,
# Claude Code may block the session entirely. We use || true on fallible
# operations instead of -e to ensure graceful degradation.

# =============================================================================
# Working-directory guard: hooks may run from any cwd; anchor to repo root.
# =============================================================================
_REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$_REPO_ROOT"

PERSONA_FILE=".claude/agents/polaris.md"

# Non-blocking guard: if persona file missing, warn and exit clean
if [[ ! -f "$PERSONA_FILE" ]]; then
  echo "session-start: WARNING — persona file '$PERSONA_FILE' not found. Default Polaris voice not injected." >&2
  # Emit empty/passthrough JSON so Claude Code does not treat this as a hook failure
  printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":""}}'
  exit 0
fi

# =============================================================================
# Parse session_id from hook event JSON (stdin at SessionStart).
# Claude Code sends JSON on stdin for SessionStart events.
# We read it here so we can derive the canonical session ID before emitting
# the persona JSON. The JSON is stored; we pass it to the C7 block below.
# If stdin is empty or not JSON, we fall back to CLAUDE_SESSION_ID env var.
# =============================================================================
_STDIN_CONTENT=""
if [[ -t 0 ]]; then
  # stdin is a terminal — no JSON payload (e.g., hook called directly for testing)
  _STDIN_CONTENT=""
else
  _STDIN_CONTENT="$(cat 2>/dev/null || true)"
fi

# Extract session_id from the hook event JSON payload
_HOOK_SESSION_ID=""
if [[ -n "$_STDIN_CONTENT" ]] && command -v python3 >/dev/null 2>&1; then
  _HOOK_SESSION_ID="$(printf '%s' "$_STDIN_CONTENT" | python3 -c \
    'import json,sys; d=json.load(sys.stdin); print(d.get("session_id",""))' 2>/dev/null || true)"
fi
if [[ -z "$_HOOK_SESSION_ID" ]] && command -v jq >/dev/null 2>&1 && [[ -n "$_STDIN_CONTENT" ]]; then
  _HOOK_SESSION_ID="$(printf '%s' "$_STDIN_CONTENT" | jq -r '.session_id // ""' 2>/dev/null || true)"
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

# =============================================================================
# C7 · Session metadata writer (TASK-2026-05-23-BETA-HARNESS)
# Appended by Canopus 2026-05-23. Runs after persona JSON is emitted so the
# stdout JSON is already flushed before we do any file I/O.
# =============================================================================
#
# Writes .claude/sessions/<session-id>.meta.json at SessionStart.
# The /parse-conversation skill (C6) reads source mode from this file.
#
# Metadata fields:
#   session_id            · CLAUDE_SESSION_ID env or generated fallback
#   mode                  · "genesis" | "pending" (C4 persona-tracker resolves to "beta")
#   started_at            · ISO 8601 UTC
#   first_message_excerpt · null at this stage; C4 fills it on first user message
#   resolved_by           · which component set final mode value
#
# Mode detection (full logic lives in C4 persona-tracker.sh):
#   beta    · first user message contains beta / เบต้า / Betelgeuse Chan (case-insensitive)
#   genesis · all other sessions
#
# At SessionStart, the first user message has not arrived yet. We write a
# provisional record. When C4 (persona-tracker.sh) is installed, it updates
# mode to "beta" or "genesis" on first UserPromptSubmit. When C4 is absent
# (pre-V3 fixture), mode pre-resolves to "genesis" here as a safe default.
#
# Session files are gitignored (.claude/sessions/*.meta.json).

_SESSION_DIR=".claude/sessions"
mkdir -p "$_SESSION_DIR"

# Canonical session ID:
#   1st priority · session_id from hook event JSON (parsed above from stdin)
#   2nd priority · CLAUDE_SESSION_ID env var
#   3rd priority · epoch-pid fallback (only when both sources are absent)
#
# IMPORTANT: this ID must match what persona-tracker.sh and beta-context-inject.sh
# will see at UserPromptSubmit — they both parse from hook event JSON stdin, so
# they will also get the same UUID when Claude Code provides it.
#
# When the fallback is used (no JSON, no env), the downstream hooks will also
# fall back (they see the same empty env), so they will look for "unknown.meta.json"
# and miss it — but that only happens in non-interactive / test invocations.
_SESSION_ID="${_HOOK_SESSION_ID:-${CLAUDE_SESSION_ID:-session-$(date +%s)-$$}}"
_SESSION_META_FILE="$_SESSION_DIR/${_SESSION_ID}.meta.json"
_SESSION_STARTED="$(date -u +%FT%TZ)"

# Determine initial mode:
#   - "pending"  · persona-tracker.sh (C4) is installed; it will resolve mode on first UserPromptSubmit
#   - "genesis"  · safe fallback when C4 is absent (pre-V3)
#
# The same detection regex used in persona-tracker.sh applies here as a preview:
#   beta / เบต้า / Betelgeuse Chan (case-insensitive) in first message → mode=beta
#   Otherwise → mode=genesis
# But at SessionStart the first message has not arrived, so we cannot run it here.
# C4 resolves mode on first UserPromptSubmit and updates the metadata file.
_INITIAL_MODE="pending"
_RESOLVED_BY="pending-c4-resolution"
if [[ ! -x ".claude/hooks/persona-tracker.sh" ]]; then
  _INITIAL_MODE="genesis"
  _RESOLVED_BY="session-start-fallback (persona-tracker.sh not installed)"
fi

# Write session metadata
if command -v python3 >/dev/null 2>&1; then
  python3 - <<PYEOF
import json
meta = {
    "session_id": "$_SESSION_ID",
    "mode": "$_INITIAL_MODE",
    "started_at": "$_SESSION_STARTED",
    "first_message_excerpt": None,
    "resolved_by": "$_RESOLVED_BY"
}
with open("$_SESSION_META_FILE", "w") as f:
    json.dump(meta, f, indent=2, ensure_ascii=False)
    f.write("\n")
PYEOF
elif command -v jq >/dev/null 2>&1; then
  jq -n \
    --arg sid     "$_SESSION_ID" \
    --arg mode    "$_INITIAL_MODE" \
    --arg start   "$_SESSION_STARTED" \
    --arg rby     "$_RESOLVED_BY" \
    '{session_id: $sid, mode: $mode, started_at: $start, first_message_excerpt: null, resolved_by: $rby}' \
    > "$_SESSION_META_FILE" 2>/dev/null || true
fi

# Clean up session-local vars
unset _SESSION_DIR _SESSION_ID _SESSION_META_FILE _SESSION_STARTED _INITIAL_MODE _RESOLVED_BY

exit 0
