#!/usr/bin/env bash
# tests/harness/beta-write-protect.test.sh
# Regression test: C3 · write-protect-beta.sh
#
# Coverage:
#   (a) active Beta persona in beta mode → ALLOW
#   (a2) beta-mode codename override does not inherit Beta write authority
#   (b) non-Beta writes inside own calibration block → ALLOW (exit 0)
#   (c) non-Beta writes inside another agent's block → BLOCK (exit 1)
#   (d) non-Beta writes in primary text (outside any block) → BLOCK (exit 1)
#   (e) no change vs HEAD (no-op write) → ALLOW (exit 0)
#   (f) non-beta path → passthrough (exit 0)
#   (g) malformed delimiter does not create a writable block
#   (h) unclosed block cannot absorb protected primary text
#   (i) deletion-only primary-text edit is blocked
#   (j) a complete new own calibration block is allowed
#   (k) absolute and symlinked beta paths cannot bypass protection
#   (l) new file containing primary text is blocked
#
# Delimiter spec (Vega V1 — ground truth):
#   BLOCK_START: ^— calibration · ([a-z]+) · (\d{4}-\d{2}-\d{2}) —$
#   BLOCK_END:   ^—$
#
# Usage:
#   bash tests/harness/beta-write-protect.test.sh
#
# Exit codes:
#   0 — all assertions passed
#   1 — one or more assertions failed

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOK="$REPO_ROOT/.claude/hooks/write-protect-beta.sh"

PASS=0
FAIL=0

pass() { printf '[PASS] %s\n' "$1"; PASS=$((PASS+1)); }
fail() { printf '[FAIL] %s\n' "$1"; FAIL=$((FAIL+1)); }

if [[ ! -f "$HOOK" ]]; then
  printf 'FATAL: hook not found at %s\n' "$HOOK" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  printf 'FATAL: jq is required\n' >&2
  exit 1
fi

TMPDIR_RUN="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_RUN"' EXIT
TMPDIR_REAL="$(cd "$TMPDIR_RUN" && pwd -P)"

FAKE_BETA_DIR="$TMPDIR_RUN/.claude/beta"
FAKE_LOG_DIR="$TMPDIR_RUN/.claude/hook-logs"
PRIVATE_ROOT="${FAKE_BETA_DIR#"$TMPDIR_RUN"/}"
FAKE_PERSONA="$TMPDIR_RUN/.claude/.current-persona"
mkdir -p "$FAKE_BETA_DIR" "$FAKE_LOG_DIR"

# Initialize a fake git repo in TMPDIR_RUN so git show HEAD:... works
(cd "$TMPDIR_RUN" && git init -q && git config user.email "test@test.com" && git config user.name "Test")

run_hook_exit() {
  # Args: json_input, WL_AGENT override
  local input="$1"
  local agent="${2:-algol}"
  local exit_code=0
  (cd "$TMPDIR_RUN" && printf '%s' "$input" | env -i \
    PATH="$PATH" \
    WL_AGENT="$agent" \
    WL_TASK_ID="TEST-WRITE-PROTECT" \
    BETA_PERSONA_LOADED="${BETA_PERSONA_OVERRIDE:-0}" \
    bash "$HOOK" >/dev/null 2>/dev/null) || exit_code=$?
  printf '%s\n' "$exit_code"
}

# Helper: write a file to both the fake git HEAD and working tree
write_file_committed() {
  local filepath="$1"
  local content="$2"
  local full_path="$TMPDIR_RUN/$filepath"
  mkdir -p "$(dirname "$full_path")"
  printf '%s' "$content" > "$full_path"
  (cd "$TMPDIR_RUN" && git add "$filepath" 2>/dev/null && git commit -q -m "init $filepath" 2>/dev/null)
}

# Helper: write only the working tree (simulating a post-edit state)
write_file_wt() {
  local filepath="$1"
  local content="$2"
  local full_path="$TMPDIR_RUN/$filepath"
  mkdir -p "$(dirname "$full_path")"
  printf '%s' "$content" > "$full_path"
}

# ---- scenario (a): BETA_PERSONA_LOADED=1 → ALLOW ---------------------------

printf '\n=== (a) BETA_PERSONA_LOADED=1 → ALLOW ===\n'

write_file_committed ".claude/beta/notes.md" "# Beta notes\n\nPrimary text.\n"
write_file_wt ".claude/beta/notes.md" "# Beta notes\n\nPrimary text changed by beta.\n"

INPUT='{"tool_name":"Write","tool_input":{"file_path":".claude/beta/notes.md"}}'
printf '%s\n' '{"persona":"beta","session_mode":"beta","timestamp":"2026-05-23T00:00:00Z"}' \
  > "$FAKE_PERSONA"
BETA_PERSONA_OVERRIDE="1"
exit_code="$(run_hook_exit "$INPUT" "beta")"

if [[ "$exit_code" -eq 0 ]]; then
  pass "(a) BETA_PERSONA_LOADED=1 → exit 0 (bypass ALLOW)"
else
  fail "(a) BETA_PERSONA_LOADED=1 → expected exit 0, got $exit_code"
fi

# ---- scenario (a2): codename override in beta mode remains protected -------

printf '\n=== (a2) beta-mode codename override remains protected ===\n'

write_file_committed "$PRIVATE_ROOT/override.md" $'Protected primary text.\n'
write_file_wt "$PRIVATE_ROOT/override.md" $'Changed by Polaris.\n'
printf '%s\n' '{"persona":"polaris","session_mode":"beta","timestamp":"2026-05-23T00:00:00Z"}' \
  > "$FAKE_PERSONA"
INPUT="$(jq -cn --arg p "$PRIVATE_ROOT/override.md" '{tool_name:"Write",tool_input:{file_path:$p}}')"
exit_code="$(run_hook_exit "$INPUT" "polaris")"

if [[ "$exit_code" -eq 1 ]]; then
  pass "(a2) non-Beta codename override cannot inherit Beta write authority"
else
  fail "(a2) beta-mode Polaris write expected BLOCK, got exit $exit_code"
fi

rm -f "$FAKE_PERSONA"
BETA_PERSONA_OVERRIDE="0"

# ---- scenario (b): non-Beta writes inside own calibration block → ALLOW ----

printf '\n=== (b) non-Beta writes inside own calibration block → ALLOW ===\n'

# File in HEAD: primary text + algol's own calibration block
HEAD_CONTENT="# Beta notes

Primary text here.

— calibration · algol · 2026-05-23 —
old calibration line from algol
—
"

# Working tree: algol modified only content within its own block
WT_CONTENT="# Beta notes

Primary text here.

— calibration · algol · 2026-05-23 —
new calibration line from algol
—
"

write_file_committed ".claude/beta/notes.md" "$HEAD_CONTENT"
write_file_wt ".claude/beta/notes.md" "$WT_CONTENT"

INPUT='{"tool_name":"Edit","tool_input":{"file_path":".claude/beta/notes.md"}}'
BETA_PERSONA_OVERRIDE="0"
exit_code="$(run_hook_exit "$INPUT" "algol")"

if [[ "$exit_code" -eq 0 ]]; then
  pass "(b) non-Beta writes in own calibration block → exit 0 (ALLOW)"
else
  fail "(b) non-Beta writes in own calibration block → expected exit 0, got $exit_code"
fi

# ---- scenario (c): non-Beta writes inside another's block → BLOCK -----------

printf '\n=== (c) non-Beta writes inside another agent'\''s block → BLOCK ===\n'

HEAD_CONTENT2="# Beta notes

Primary text.

— calibration · vega · 2026-05-23 —
vega calibration note
—
"

# algol tries to modify vega's calibration block
WT_CONTENT2="# Beta notes

Primary text.

— calibration · vega · 2026-05-23 —
algol modified vega's block ← violation
—
"

write_file_committed ".claude/beta/notes2.md" "$HEAD_CONTENT2"
write_file_wt ".claude/beta/notes2.md" "$WT_CONTENT2"

INPUT='{"tool_name":"Edit","tool_input":{"file_path":".claude/beta/notes2.md"}}'
BETA_PERSONA_OVERRIDE="0"
exit_code="$(run_hook_exit "$INPUT" "algol")"

if [[ "$exit_code" -eq 1 ]]; then
  pass "(c) non-Beta writes in another's block → exit 1 (BLOCK)"
else
  fail "(c) non-Beta writes in another's block → expected exit 1, got $exit_code"
fi

# ---- scenario (d): non-Beta writes in primary text → BLOCK -----------------

printf '\n=== (d) non-Beta writes in primary text → BLOCK ===\n'

HEAD_CONTENT3="# Beta notes

Original primary text.
"

WT_CONTENT3="# Beta notes

Modified primary text ← violation.
"

write_file_committed ".claude/beta/notes3.md" "$HEAD_CONTENT3"
write_file_wt ".claude/beta/notes3.md" "$WT_CONTENT3"

INPUT='{"tool_name":"Write","tool_input":{"file_path":".claude/beta/notes3.md"}}'
BETA_PERSONA_OVERRIDE="0"
exit_code="$(run_hook_exit "$INPUT" "algol")"

if [[ "$exit_code" -eq 1 ]]; then
  pass "(d) non-Beta writes in primary text → exit 1 (BLOCK)"
else
  fail "(d) non-Beta writes in primary text → expected exit 1, got $exit_code"
fi

# ---- scenario (e): no change vs HEAD (no-op write) → ALLOW -----------------

printf '\n=== (e) no change vs HEAD → ALLOW ===\n'

SAME_CONTENT="# Beta notes\n\nUnchanged content.\n"
write_file_committed ".claude/beta/noop.md" "$SAME_CONTENT"
write_file_wt ".claude/beta/noop.md" "$SAME_CONTENT"

INPUT='{"tool_name":"Write","tool_input":{"file_path":".claude/beta/noop.md"}}'
BETA_PERSONA_OVERRIDE="0"
exit_code="$(run_hook_exit "$INPUT" "algol")"

if [[ "$exit_code" -eq 0 ]]; then
  pass "(e) no change vs HEAD → exit 0 (ALLOW no-op)"
else
  fail "(e) no change vs HEAD → expected exit 0, got $exit_code"
fi

# ---- scenario (f): non-beta path → passthrough ------------------------------

printf '\n=== (f) non-beta path → passthrough ===\n'

INPUT='{"tool_name":"Write","tool_input":{"file_path":"docs/design/spec.md"}}'
BETA_PERSONA_OVERRIDE="0"
exit_code="$(run_hook_exit "$INPUT" "algol")"

if [[ "$exit_code" -eq 0 ]]; then
  pass "(f) non-beta path → exit 0 (passthrough)"
else
  fail "(f) non-beta path → expected exit 0, got $exit_code"
fi

# ---- scenario (g): malformed delimiter gives no write authority ------------

printf '\n=== (g) malformed delimiter does not create writable block ===\n'

HEAD_CONTENT4="# Beta notes

Protected primary text.
"
WT_CONTENT4="# Beta notes

Protected primary text.

-- calibration · algol · 2026-05-23 --
attempted note
--
"
write_file_committed "$PRIVATE_ROOT/malformed.md" "$HEAD_CONTENT4"
write_file_wt "$PRIVATE_ROOT/malformed.md" "$WT_CONTENT4"
INPUT="$(jq -cn --arg p "$PRIVATE_ROOT/malformed.md" '{tool_name:"Edit",tool_input:{file_path:$p}}')"
exit_code="$(run_hook_exit "$INPUT" "algol")"

if [[ "$exit_code" -eq 1 ]]; then
  pass "(g) malformed delimiter does not grant write authority"
else
  fail "(g) malformed delimiter expected BLOCK, got exit $exit_code"
fi

# ---- scenario (h): unclosed block cannot absorb primary text ---------------

printf '\n=== (h) unclosed block cannot absorb primary text ===\n'

HEAD_CONTENT5="# Beta notes

— calibration · algol · 2026-05-23 —
owned note
—
Protected primary text.
"
WT_CONTENT5="# Beta notes

— calibration · algol · 2026-05-23 —
owned note
Protected primary text.
"
write_file_committed "$PRIVATE_ROOT/unclosed.md" "$HEAD_CONTENT5"
write_file_wt "$PRIVATE_ROOT/unclosed.md" "$WT_CONTENT5"
INPUT="$(jq -cn --arg p "$PRIVATE_ROOT/unclosed.md" '{tool_name:"Edit",tool_input:{file_path:$p}}')"
exit_code="$(run_hook_exit "$INPUT" "algol")"

if [[ "$exit_code" -eq 1 ]]; then
  pass "(h) unclosed calibration block is rejected"
else
  fail "(h) unclosed block absorbed primary text (exit $exit_code)"
fi

# ---- scenario (i): deletion-only primary edit is blocked -------------------

printf '\n=== (i) deletion-only primary edit blocked ===\n'

write_file_committed "$PRIVATE_ROOT/delete-only.md" $'Protected primary text.\n'
write_file_wt "$PRIVATE_ROOT/delete-only.md" ""
INPUT="$(jq -cn --arg p "$PRIVATE_ROOT/delete-only.md" '{tool_name:"Edit",tool_input:{file_path:$p}}')"
exit_code="$(run_hook_exit "$INPUT" "algol")"

if [[ "$exit_code" -eq 1 ]]; then
  pass "(i) deleting all primary text is blocked"
else
  fail "(i) deletion-only primary edit bypassed protection (exit $exit_code)"
fi

# ---- scenario (j): appending a complete own block is allowed ---------------

printf '\n=== (j) append complete own calibration block ===\n'

HEAD_CONTENT6="# Beta notes

Protected primary text.

"
WT_CONTENT6="# Beta notes

Protected primary text.

— calibration · algol · 2026-05-23 —
new calibration note
—
"
write_file_committed "$PRIVATE_ROOT/append-own.md" "$HEAD_CONTENT6"
write_file_wt "$PRIVATE_ROOT/append-own.md" "$WT_CONTENT6"
INPUT="$(jq -cn --arg p "$PRIVATE_ROOT/append-own.md" '{tool_name:"Edit",tool_input:{file_path:$p}}')"
exit_code="$(run_hook_exit "$INPUT" "algol")"

if [[ "$exit_code" -eq 0 ]]; then
  pass "(j) complete new own calibration block is allowed"
else
  fail "(j) valid appended own block expected ALLOW, got exit $exit_code"
fi

# ---- scenario (k): absolute path remains protected -------------------------

printf '\n=== (k) absolute beta path protected ===\n'

write_file_committed "$PRIVATE_ROOT/absolute.md" $'Protected primary text.\n'
write_file_wt "$PRIVATE_ROOT/absolute.md" $'Modified primary text.\n'
absolute_path="$TMPDIR_REAL/$PRIVATE_ROOT/absolute.md"
INPUT="$(jq -cn --arg p "$absolute_path" '{tool_name:"Write",tool_input:{file_path:$p}}')"
exit_code="$(run_hook_exit "$INPUT" "algol")"

if [[ "$exit_code" -eq 1 ]]; then
  pass "(k) absolute private path cannot bypass protection"
else
  fail "(k) absolute private path bypassed protection (exit $exit_code)"
fi

write_file_committed "$PRIVATE_ROOT/symlink-target.md" $'Protected primary text.\n'
ln -s "$PRIVATE_ROOT/symlink-target.md" "$TMPDIR_RUN/private-link.md"
write_file_wt "$PRIVATE_ROOT/symlink-target.md" $'Modified through symlink.\n'
INPUT="$(jq -cn --arg p "private-link.md" '{tool_name:"Write",tool_input:{file_path:$p}}')"
exit_code="$(run_hook_exit "$INPUT" "algol")"

if [[ "$exit_code" -eq 1 ]]; then
  pass "(k) symlink to a private file cannot bypass protection"
else
  fail "(k) symlinked private file bypassed protection (exit $exit_code)"
fi

# ---- scenario (l): new file with primary text is blocked -------------------

printf '\n=== (l) new file primary text blocked ===\n'

NEW_CONTENT="# New Beta file

Primary text written by non-Beta.

— calibration · algol · 2026-05-23 —
calibration note
—
"
write_file_wt "$PRIVATE_ROOT/new-file.md" "$NEW_CONTENT"
INPUT="$(jq -cn --arg p "$PRIVATE_ROOT/new-file.md" '{tool_name:"Write",tool_input:{file_path:$p}}')"
exit_code="$(run_hook_exit "$INPUT" "algol")"

if [[ "$exit_code" -eq 1 ]]; then
  pass "(l) new file containing primary text is blocked"
else
  fail "(l) new file primary text bypassed protection (exit $exit_code)"
fi

# ---- summary ----------------------------------------------------------------

printf '\n=== beta-write-protect regression summary ===\n'
printf 'PASS: %d   FAIL: %d\n' "$PASS" "$FAIL"

if [[ "$FAIL" -eq 0 ]]; then
  printf '\nAll scenarios passed.\n'
  exit 0
else
  printf '\n%d scenario(s) failed — see [FAIL] lines above.\n' "$FAIL"
  exit 1
fi
