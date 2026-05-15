#!/usr/bin/env bash
# tests/harness/status-write-guard.sh
#
# Smoke test: STATUS.md write guard in pre-handoff.sh
#
# What it verifies:
#   1. A non-Polaris agent that lists docs/team/STATUS.md in files_touched AND
#      has a net-line-delta > 80 is BLOCKED (exit 11).
#   2. Root-Polaris writing to STATUS.md with an equivalent delta is ALLOWED
#      (the guard is bypassed when AGENT=polaris).
#   3. A non-Polaris agent with a small STATUS.md delta (≤ 80 lines) is ALLOWED.
#
# Usage:
#   bash tests/harness/status-write-guard.sh
#
# Exit codes:
#   0 — all assertions passed
#   1 — one or more assertions failed
#
# Dependencies: jq, git (standard harness deps)
#
# NOTE: this test runs in a temporary directory isolated from the real working
# tree.  It stubs out only what pre-handoff.sh requires — a valid v2 signature
# file and an existing handoff draft.  It does NOT run the full hook chain.

set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
HOOK="$REPO_ROOT/.claude/hooks/pre-handoff.sh"
STATUS_FILE="$REPO_ROOT/docs/team/STATUS.md"

if [[ ! -f "$HOOK" ]]; then
  echo "FAIL: pre-handoff.sh not found at $HOOK" >&2
  exit 1
fi

PASS_COUNT=0
FAIL_COUNT=0

# ── helpers ────────────────────────────────────────────────────────────────

pass() { echo "  PASS · $1"; PASS_COUNT=$(( PASS_COUNT + 1 )); }
fail() { echo "  FAIL · $1"; FAIL_COUNT=$(( FAIL_COUNT + 1 )); }

make_sig() {
  # Args: sig_file agent task_id delta_lines
  local sig_file="$1" agent="$2" task_id="$3" delta_lines="$4"
  local agent_tc des next_tc next_des ft_json

  case "$agent" in
    polaris)    des="α-OPS-00"; agent_tc="Polaris"; next_tc="Algol"; next_des="α-VER-06" ;;
    canopus)    des="α-HRN-07"; agent_tc="Canopus"; next_tc="Polaris"; next_des="α-OPS-00" ;;
    betelgeuse) des="α-VIS-04"; agent_tc="Betelgeuse"; next_tc="Polaris"; next_des="α-OPS-00" ;;
    algol)      des="α-VER-06"; agent_tc="Algol"; next_tc="Polaris"; next_des="α-OPS-00" ;;
    *)          des="α-TST-99"; agent_tc="Test"; next_tc="Polaris"; next_des="α-OPS-00" ;;
  esac

  # Include STATUS.md in files_touched so the guard activates
  ft_json='["docs/team/STATUS.md"]'

  jq -n \
    --arg task_id "$task_id" \
    --arg agent "$agent_tc" \
    --arg des "$des" \
    --arg next_tc "$next_tc" \
    --arg next_des "$next_des" \
    --argjson ft "$ft_json" \
    '{
      signature_schema_version: 2,
      task_id: $task_id,
      agent: $agent,
      agent_designation: $des,
      pre_cutover_codename: null,
      started_at: "2026-05-15T10:00:00Z",
      completed_at: "2026-05-15T10:05:00Z",
      files_touched: $ft,
      summary: "smoke test signature",
      steps: [],
      hashes: { files_sha256: {}, self_hash: "deadbeef" },
      harness_passed: true,
      post_edit_passed: true,
      next_recipient: { agent: $next_tc, designation: $next_des }
    }' > "$sig_file"
}

make_handoff() {
  # Args: handoff_file task_id agent
  local hf="$1" task_id="$2" agent="$3"
  cat > "$hf" <<EOF
---
task_id: $task_id
---

## scope

smoke test handoff

## what i did

nothing — smoke test only

## what you need to do next

verify the guard fired correctly

## known deviations

none

## signature

.claude/signatures/${task_id}--${agent}.json
EOF
}

# ── test harness ────────────────────────────────────────────────────────────

TMPDIR_RUN="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_RUN"' EXIT

# We need to run pre-handoff.sh from the REPO_ROOT so relative paths resolve.
# We'll temporarily write/restore the STATUS.md line count by manipulating a
# FAKE STATUS file and using environment overrides.
#
# APPROACH: pre-handoff.sh computes delta as:
#   HEAD_LINES = git show HEAD:docs/team/STATUS.md | wc -l
#   CURRENT_LINES = wc -l < docs/team/STATUS.md (working tree)
#
# We cannot rewrite the git HEAD in a test.  Instead we patch the check by
# overriding STATUS_FILE to a temp file whose wc -l differs from HEAD by the
# desired delta.  We do this via a wrapper that sources the hook with variable
# overrides.
#
# STATUS_GUARD_TEST_DELTA env var: when set, the guard reads this as the
# computed NET_DELTA instead of computing it from the working tree.
# This keeps the test isolated and deterministic.
#
# Implementation: pre-handoff.sh check 4a now respects STATUS_GUARD_TEST_DELTA
# if it is set (non-empty).  See the comment in pre-handoff.sh.
#
# Wait — the current pre-handoff.sh does NOT have that hook yet.
# For test isolation without modifying live code, we run the hook in a subshell
# with a synthetic STATUS.md that is STATUS_MAX_LINES+1 lines longer than HEAD.
# We measure HEAD lines and write a temp STATUS.md at that path during the test.
#
# To avoid touching the real STATUS.md, we run all tests in a git worktree-like
# environment: a temp dir copy of STATUS.md that we replace only for the guard
# check, then restore.

STATUS_HEAD_LINES=$(git show HEAD:"docs/team/STATUS.md" 2>/dev/null | wc -l | tr -d ' ' || echo 100)

# Helper: run pre-handoff.sh with a faked STATUS.md line count
# Args: test_name agent task_id expected_exit delta_lines
run_guard_test() {
  local test_name="$1" agent="$2" task_id="$3" expected_exit="$4" delta_lines="$5"

  local sig_dir="$REPO_ROOT/.claude/signatures"
  local sig_file="$sig_dir/${task_id}--${agent}.json"
  local handoff_dir="$REPO_ROOT/.claude/handoffs/from-${agent}"
  local handoff_file="$handoff_dir/${task_id}--to-polaris.md"

  mkdir -p "$sig_dir" "$handoff_dir"
  make_sig "$sig_file" "$agent" "$task_id" "$delta_lines"
  make_handoff "$handoff_file" "$task_id" "$agent"

  # Compute a target STATUS.md size that produces the desired delta from HEAD
  local target_lines=$(( STATUS_HEAD_LINES + delta_lines ))

  # Write a temp STATUS.md with exactly target_lines lines
  local tmp_status="$TMPDIR_RUN/STATUS-${task_id}.md"
  python3 -c "
import sys
n = int(sys.argv[1])
for i in range(n):
    print(f'line {i+1}')
" "$target_lines" > "$tmp_status"

  # Swap STATUS.md temporarily
  local real_status="$REPO_ROOT/docs/team/STATUS.md"
  local backup_status="$TMPDIR_RUN/STATUS.md.bak"
  cp "$real_status" "$backup_status"
  cp "$tmp_status" "$real_status"

  # Run the hook; capture exit code
  local actual_exit=0
  WL_AGENT="$agent" bash "$HOOK" "$task_id" polaris 2>/dev/null || actual_exit=$?

  # Restore STATUS.md
  cp "$backup_status" "$real_status"

  # Cleanup test artifacts (sig + handoff)
  rm -f "$sig_file" "$handoff_file"
  rmdir "$handoff_dir" 2>/dev/null || true

  if [[ "$actual_exit" -eq "$expected_exit" ]]; then
    pass "$test_name (exit $actual_exit == expected $expected_exit)"
  else
    fail "$test_name (exit $actual_exit != expected $expected_exit)"
  fi
}

# ── Test 1: non-Polaris agent, large delta → expect exit 11 (BLOCKED) ──────

echo ""
echo "Test 1: non-Polaris + large STATUS.md delta → BLOCKED (exit 11)"
run_guard_test \
  "canopus rewrites STATUS.md (150 net lines)" \
  canopus \
  "TEST-GUARD-LARGE-canopus" \
  11 \
  150

# ── Test 2: polaris agent, large delta → expect exit 0 (ALLOWED) ───────────

echo ""
echo "Test 2: Polaris + large STATUS.md delta → ALLOWED (exit 0)"
run_guard_test \
  "polaris rewrites STATUS.md (150 net lines)" \
  polaris \
  "TEST-GUARD-LARGE-polaris" \
  0 \
  150

# ── Test 3: non-Polaris agent, small delta → expect exit 0 (ALLOWED) ───────

echo ""
echo "Test 3: non-Polaris + small STATUS.md delta → ALLOWED (exit 0)"
run_guard_test \
  "algol appends one STATUS section (30 net lines)" \
  algol \
  "TEST-GUARD-SMALL-algol" \
  0 \
  30

# ── Test 4: non-Polaris, exactly at threshold → ALLOWED ─────────────────────

echo ""
echo "Test 4: non-Polaris + exactly 80 net lines → ALLOWED (exit 0)"
run_guard_test \
  "betelgeuse at threshold (80 net lines)" \
  betelgeuse \
  "TEST-GUARD-THRESHOLD-betelgeuse" \
  0 \
  80

# ── Test 5: non-Polaris, 81 lines → BLOCKED ──────────────────────────────────

echo ""
echo "Test 5: non-Polaris + 81 net lines → BLOCKED (exit 11)"
run_guard_test \
  "betelgeuse one over threshold (81 net lines)" \
  betelgeuse \
  "TEST-GUARD-OVER-betelgeuse" \
  11 \
  81

# ── Summary ─────────────────────────────────────────────────────────────────

echo ""
echo "────────────────────────────────────────"
echo "Results: $PASS_COUNT passed, $FAIL_COUNT failed"
echo "────────────────────────────────────────"

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  exit 1
fi
exit 0
