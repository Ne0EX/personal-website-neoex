#!/usr/bin/env bash
# tests/harness/gate-config-write-guard.test.sh
#
# DEBT-2 regression: gate-config-write-guard.sh PreToolUse hook.
#
# The mutating-action hook gates Bash commands only. .harness/engine/** and
# .claude/hooks/** were silently writable via Edit/Write/NotebookEdit tools.
# This hook closes that seam (deny-by-default, fail-closed).
#
# CASES:
#   CASE-BLOCK-EDIT      Edit to .harness/engine/core/runtime/mutating-bash.json → blocked (exit 2)
#   CASE-BLOCK-WRITE     Write to .claude/hooks/sign-work.sh → blocked (exit 2)
#   CASE-BLOCK-NOTEBOOK  NotebookEdit to .harness/engine/core/runtime/any.json → blocked (exit 2)
#   CASE-ALLOW-OTHER     Edit to components/ArchiveQuery.tsx → allowed (exit 0)
#   CASE-ALLOW-SEAM      Edit to protected path with WL_GATE_CONFIG_SEAM=1 → allowed (exit 0)
#   CASE-ALLOW-SETTINGS  Edit to .claude/settings.json (not under .claude/hooks/) → allowed (exit 0)
#
# Run: bash tests/harness/gate-config-write-guard.test.sh
# Exit 0 iff all assertions hold.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOK="$REPO_DIR/.claude/hooks/gate-config-write-guard.sh"

if [[ ! -f "$HOOK" ]]; then
  printf 'FATAL: gate-config-write-guard.sh not found at %s\n' "$HOOK" >&2
  exit 2
fi

PASS=0
FAIL=0
note() { printf '%s\n' "$*"; }
ok()   { PASS=$((PASS+1)); printf '  PASS · %s\n' "$*"; }
bad()  { FAIL=$((FAIL+1)); printf '  FAIL · %s\n' "$*"; }

# Helper: build a PreToolUse JSON payload and pipe it to the hook.
# Usage: run_hook <tool_name> <file_path> [env_overrides...]
# Sets RC and OUT.
run_hook() {
  local tool_name="$1"
  local file_path="$2"
  shift 2
  local _payload
  _payload="$(printf '{"tool_name":"%s","tool_input":{"file_path":"%s","old_string":"x","new_string":"y"}}' \
    "$tool_name" "$file_path")"
  local _out_file
  _out_file="$(mktemp)"
  printf '%s' "$_payload" | env \
    HARNESS_REPO_ROOT="$REPO_DIR" \
    "$@" \
    bash "$HOOK" > "$_out_file" 2>&1
  RC=$?
  OUT="$(cat "$_out_file")"
  rm -f "$_out_file"
}

note "=============================================================="
note "gate-config-write-guard · DEBT-2 regression test suite"
note "hook: $HOOK"
note "=============================================================="

# ---------------------------------------------------------------------------
# CASE-BLOCK-EDIT: Edit to mutating-bash.json → blocked
# ---------------------------------------------------------------------------
note ""
note "[CASE-BLOCK-EDIT] Edit → .harness/engine/core/runtime/mutating-bash.json → expect exit 2"
run_hook "Edit" "$REPO_DIR/.harness/engine/core/runtime/mutating-bash.json"
note "    RC=$RC"
if [[ "$RC" -eq 2 ]]; then
  ok "CASE-BLOCK-EDIT: exit 2 (BLOCKED)"
else
  bad "CASE-BLOCK-EDIT: expected exit 2; got RC=$RC"
fi
if printf '%s\n' "$OUT" | grep -qi 'BLOCKED'; then
  ok "CASE-BLOCK-EDIT: BLOCKED message present"
else
  bad "CASE-BLOCK-EDIT: expected BLOCKED in output; got: $(printf '%s\n' "$OUT" | head -3)"
fi
if printf '%s\n' "$OUT" | grep -qi 'WL_GATE_CONFIG_SEAM'; then
  ok "CASE-BLOCK-EDIT: sanctioned-path instruction (WL_GATE_CONFIG_SEAM) present"
else
  bad "CASE-BLOCK-EDIT: expected WL_GATE_CONFIG_SEAM instruction in output"
fi

# ---------------------------------------------------------------------------
# CASE-BLOCK-WRITE: Write to .claude/hooks/sign-work.sh → blocked
# ---------------------------------------------------------------------------
note ""
note "[CASE-BLOCK-WRITE] Write → .claude/hooks/sign-work.sh → expect exit 2"
run_hook "Write" "$REPO_DIR/.claude/hooks/sign-work.sh"
note "    RC=$RC"
if [[ "$RC" -eq 2 ]]; then
  ok "CASE-BLOCK-WRITE: exit 2 (BLOCKED)"
else
  bad "CASE-BLOCK-WRITE: expected exit 2; got RC=$RC"
fi

# ---------------------------------------------------------------------------
# CASE-BLOCK-NOTEBOOK: NotebookEdit to .harness/engine/.../ → blocked
# ---------------------------------------------------------------------------
note ""
note "[CASE-BLOCK-NOTEBOOK] NotebookEdit → .harness/engine/core/runtime/test.json → expect exit 2"
# NotebookEdit uses notebook_path, not file_path — test with a patched payload
_nb_payload="$(printf '{"tool_name":"NotebookEdit","tool_input":{"notebook_path":"%s","cell_id":"1","new_source":"x"}}' \
  "$REPO_DIR/.harness/engine/core/runtime/test.json")"
_nb_out="$(mktemp)"
printf '%s' "$_nb_payload" | env HARNESS_REPO_ROOT="$REPO_DIR" bash "$HOOK" > "$_nb_out" 2>&1
NB_RC=$?
NB_OUT="$(cat "$_nb_out")"
rm -f "$_nb_out"
note "    RC=$NB_RC"
if [[ "$NB_RC" -eq 2 ]]; then
  ok "CASE-BLOCK-NOTEBOOK: exit 2 (BLOCKED)"
else
  bad "CASE-BLOCK-NOTEBOOK: expected exit 2; got RC=$NB_RC. Output: $(printf '%s\n' "$NB_OUT" | head -3)"
fi

# ---------------------------------------------------------------------------
# CASE-ALLOW-OTHER: Edit to components/ArchiveQuery.tsx → allowed
# ---------------------------------------------------------------------------
note ""
note "[CASE-ALLOW-OTHER] Edit → components/ArchiveQuery.tsx → expect exit 0 (allowed)"
run_hook "Edit" "$REPO_DIR/components/ArchiveQuery.tsx"
note "    RC=$RC"
if [[ "$RC" -eq 0 ]]; then
  ok "CASE-ALLOW-OTHER: exit 0 (allowed)"
else
  bad "CASE-ALLOW-OTHER: expected exit 0; got RC=$RC. Output: $(printf '%s\n' "$OUT" | head -3)"
fi

# ---------------------------------------------------------------------------
# CASE-ALLOW-SETTINGS: Edit to .claude/settings.json (NOT under .claude/hooks/)
# ---------------------------------------------------------------------------
note ""
note "[CASE-ALLOW-SETTINGS] Edit → .claude/settings.json → expect exit 0 (not a protected path)"
run_hook "Edit" "$REPO_DIR/.claude/settings.json"
note "    RC=$RC"
if [[ "$RC" -eq 0 ]]; then
  ok "CASE-ALLOW-SETTINGS: exit 0 (.claude/settings.json is not under .claude/hooks/)"
else
  bad "CASE-ALLOW-SETTINGS: expected exit 0; got RC=$RC. Output: $(printf '%s\n' "$OUT" | head -3)"
fi

# ---------------------------------------------------------------------------
# CASE-ALLOW-SEAM: Edit to protected path with WL_GATE_CONFIG_SEAM=1 → allowed
# ---------------------------------------------------------------------------
note ""
note "[CASE-ALLOW-SEAM] Edit → mutating-bash.json with WL_GATE_CONFIG_SEAM=1 → expect exit 0"
run_hook "Edit" "$REPO_DIR/.harness/engine/core/runtime/mutating-bash.json" WL_GATE_CONFIG_SEAM=1
note "    RC=$RC"
if [[ "$RC" -eq 0 ]]; then
  ok "CASE-ALLOW-SEAM: exit 0 (Peat-at-seam marker respected)"
else
  bad "CASE-ALLOW-SEAM: expected exit 0 with seam open; got RC=$RC"
fi
if printf '%s\n' "$OUT" | grep -qi 'SEAM OPEN\|AUTHORIZED'; then
  ok "CASE-ALLOW-SEAM: SEAM OPEN / AUTHORIZED message present"
else
  bad "CASE-ALLOW-SEAM: expected SEAM OPEN or AUTHORIZED message; got: $(printf '%s\n' "$OUT" | head -3)"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
note ""
note "=============================================================="
note "RESULTS · PASS=$PASS FAIL=$FAIL"
note "=============================================================="

[[ "$FAIL" -eq 0 ]] && exit 0 || exit 1
