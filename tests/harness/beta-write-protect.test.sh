#!/usr/bin/env bash
# tests/harness/beta-write-protect.test.ts
# Regression test: C3 · write-protect-beta.sh
#
# Coverage:
#   (a) BETA_PERSONA_LOADED=1 → ALLOW, no checks
#   (b) non-Beta writes inside own calibration block → ALLOW (exit 0)
#   (c) non-Beta writes inside another agent's block → BLOCK (exit 1)
#   (d) non-Beta writes in primary text (outside any block) → BLOCK (exit 1)
#   (e) no change vs HEAD (no-op write) → ALLOW (exit 0)
#   (f) non-beta path → passthrough (exit 0)
#   (g) BLOCK_START delimiter regex matches V1 spec exactly
#   (h) BLOCK_END delimiter regex matches V1 spec exactly
#   (i) write inside own block when file is new (no HEAD) → BLOCK for primary text
#
# Delimiter spec (Vega V1 — ground truth):
#   BLOCK_START: ^— calibration · ([a-z]+) · (\d{4}-\d{2}-\d{2}) —$
#   BLOCK_END:   ^—$
#
# Usage:
#   bash tests/harness/beta-write-protect.test.ts
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

TMPDIR_RUN="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_RUN"' EXIT

FAKE_BETA_DIR="$TMPDIR_RUN/.claude/beta"
FAKE_LOG_DIR="$TMPDIR_RUN/.claude/hook-logs"
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
    HOME="$HOME" \
    WL_AGENT="$agent" \
    WL_TASK_ID="TEST-WRITE-PROTECT" \
    BETA_PERSONA_LOADED="${BETA_PERSONA_OVERRIDE:-0}" \
    bash "$HOOK" 2>/dev/null) || exit_code=$?
  echo "$exit_code"
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
BETA_PERSONA_OVERRIDE="1"
exit_code="$(run_hook_exit "$INPUT" "algol")"

if [[ "$exit_code" -eq 0 ]]; then
  pass "(a) BETA_PERSONA_LOADED=1 → exit 0 (bypass ALLOW)"
else
  fail "(a) BETA_PERSONA_LOADED=1 → expected exit 0, got $exit_code"
fi

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

# ---- scenario (g): BLOCK_START delimiter regex matches V1 spec exactly -----

printf '\n=== (g) BLOCK_START delimiter regex matches V1 spec ===\n'

# V1 spec: ^— calibration · ([a-z]+) · (\d{4}-\d{2}-\d{2}) —$
# em-dash (—) + space + "calibration" + space + middle-dot (·) + space + codename + space + · + space + date + space + —

VALID_START="— calibration · algol · 2026-05-23 —"
INVALID_STARTS=(
  "-- calibration · algol · 2026-05-23 --"    # wrong dashes
  "— Calibration · Algol · 2026-05-23 —"     # uppercase codename
  "— calibration algol 2026-05-23 —"           # missing dots
  "—calibration · algol · 2026-05-23—"         # no spaces around em-dash
)

# Test using grep -E against the actual regex from the hook
BLOCK_START_RE='^— calibration · ([a-z]+) · ([0-9]{4}-[0-9]{2}-[0-9]{2}) —$'

if printf '%s' "$VALID_START" | grep -qE "$BLOCK_START_RE"; then
  pass "(g) BLOCK_START V1 pattern matches canonical delimiter"
else
  fail "(g) BLOCK_START V1 pattern DOES NOT match canonical delimiter"
fi

all_invalid_rejected=true
for inv in "${INVALID_STARTS[@]}"; do
  if printf '%s' "$inv" | grep -qE "$BLOCK_START_RE"; then
    fail "(g) BLOCK_START V1 pattern incorrectly matched: '$inv'"
    all_invalid_rejected=false
  fi
done
if $all_invalid_rejected; then
  pass "(g) BLOCK_START V1 pattern correctly rejects all invalid variants"
fi

# ---- scenario (h): BLOCK_END delimiter regex matches V1 spec exactly --------

printf '\n=== (h) BLOCK_END delimiter regex matches V1 spec ===\n'

BLOCK_END_RE='^—$'
VALID_END="—"
INVALID_ENDS=("--" "— " " —" "———" "---")

if printf '%s' "$VALID_END" | grep -qE "$BLOCK_END_RE"; then
  pass "(h) BLOCK_END V1 pattern matches canonical delimiter"
else
  fail "(h) BLOCK_END V1 pattern DOES NOT match canonical delimiter"
fi

all_invalid_rejected=true
for inv in "${INVALID_ENDS[@]}"; do
  if printf '%s' "$inv" | grep -qE "$BLOCK_END_RE"; then
    fail "(h) BLOCK_END V1 pattern incorrectly matched: '$inv'"
    all_invalid_rejected=false
  fi
done
if $all_invalid_rejected; then
  pass "(h) BLOCK_END V1 pattern correctly rejects all invalid variants"
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
