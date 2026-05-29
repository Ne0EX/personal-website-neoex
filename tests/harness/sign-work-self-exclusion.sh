#!/usr/bin/env bash
# tests/harness/sign-work-self-exclusion.sh
# Owner: Canopus (α-HRN-07)
# Introduced: TASK-2026-05-18-CANOPUS-WAVE2-P1-IMPLEMENT
#
# Regression test: self-signature exclusion from files_touched in sign-work.sh.
#
# Verifies that sign-work.sh never lists the signature file it is producing
# in the files_touched array of that same signature — covering both the
# baseline-aware path and the fallback path.
#
# Usage:
#   bash tests/harness/sign-work-self-exclusion.sh
#
# Exit codes:
#   0 — all scenarios PASS
#   1 — one or more scenarios FAIL
#
# Scenarios:
#   T1  baseline-aware path · signature file excluded from files_touched
#   T2  fallback path (no baseline) · signature file excluded from files_touched
#   T3  post-exclusion empty · only the signature file was "new" → exit 3
#   T4  multiple deliverables + signature · deliverables present, signature absent
#
# Each scenario runs in a fresh isolated git repo so it does not touch or
# depend on the real working tree state.
#
# Dependencies: git, jq, sha256sum (standard harness deps — same as sign-work.sh)

set -uo pipefail

REPO_ROOT="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
SIGN_WORK="$REPO_ROOT/.claude/hooks/sign-work.sh"

if [[ ! -f "$SIGN_WORK" ]]; then
  echo "FAIL: sign-work.sh not found at $SIGN_WORK" >&2
  exit 1
fi

PASS_COUNT=0
FAIL_COUNT=0

pass() { echo "  PASS · $1"; PASS_COUNT=$(( PASS_COUNT + 1 )); }
fail() { echo "  FAIL · $1 — $2"; FAIL_COUNT=$(( FAIL_COUNT + 1 )); }

# ── scaffold: create a minimal isolated git repo ────────────────────────────
#
# Each scenario calls make_isolated_repo to set CURRENT_REPO.
# NOTE: we avoid returning the path via $(make_isolated_repo) because
# command substitution $(...) runs in a subshell. A global counter incremented
# inside that subshell would NOT be visible in the outer shell. We instead
# write the path to a variable via a function that is called for its side effects,
# not its stdout. This keeps the counter in the outer shell's scope.
#
# Cleanup is handled by a shared trap on WORK_ROOT.

WORK_ROOT="$(mktemp -d)"
trap 'rm -rf "$WORK_ROOT"' EXIT

scenario_count=0
CURRENT_REPO=""

make_isolated_repo() {
  # Increment the counter and set CURRENT_REPO (side effects, no stdout).
  # Call as: make_isolated_repo; REPO="$CURRENT_REPO"
  scenario_count=$(( scenario_count + 1 ))
  local repo="$WORK_ROOT/repo-${scenario_count}"
  mkdir -p "$repo"
  git -C "$repo" init -q
  git -C "$repo" config user.email "canopus@worldline.test"
  git -C "$repo" config user.name "Canopus Test"
  # Create .claude/signatures and .claude/hook-logs so sign-work.sh can write there
  mkdir -p "$repo/.claude/signatures"
  mkdir -p "$repo/.claude/hook-logs"
  CURRENT_REPO="$repo"
}

# Wire up the roster and required env for sign-work.sh
# WL_AGENT, WL_NEXT, WL_SUMMARY, WL_DOC_ONLY, WL_STARTED_AT

run_sign_work() {
  # Args: repo_path task_id [extra env vars passed as key=value strings]
  local repo="$1" task_id="$2"
  shift 2
  (
    cd "$repo"
    # Mandatory env for a clean run
    export WL_AGENT="canopus"
    export WL_NEXT="polaris"
    export WL_SUMMARY="Test task summary for self-exclusion regression"
    export WL_DOC_ONLY="0"
    export WL_STARTED_AT="2026-05-18T00:00:00Z"
    # WL_REQUIRE_SUMMARY not set — summary guard in warn mode only
    # Apply any extra env overrides
    for kv in "$@"; do
      export "$kv"
    done
    bash "$SIGN_WORK" "$task_id" 2>/dev/null
  )
  return $?
}

sig_path_for() {
  # Return the relative path of the signature file (as sign-work.sh computes it)
  local repo="$1" task_id="$2"
  echo ".claude/signatures/${task_id}--canopus.json"
}

# ── T1: baseline-aware path — signature excluded ─────────────────────────────
#
# Setup: a tracked file is modified and recorded in the baseline.
# The signature file is untracked at baseline time (new for this task).
# Expected: signature file NOT in files_touched; the tracked file IS present.

echo ""
echo "[T1] baseline-aware path · signature file excluded"

{
  make_isolated_repo; REPO="$CURRENT_REPO"
  TASK="TASK-T1-SELF-EXCLUSION"
  SIG_FILE=$(sig_path_for "$REPO" "$TASK")

  # Commit an initial file so git has a HEAD
  echo "initial" > "$REPO/deliverable.md"
  git -C "$REPO" add deliverable.md
  git -C "$REPO" commit -q -m "init"

  # Modify the tracked file to make it dirty (this task's work)
  echo "modified by this task" > "$REPO/deliverable.md"

  # Build the baseline: record pre-task snapshot.
  # Baseline format: { "files": { "<path>": "<sha256>" | "DELETED" } }
  # The signature file does NOT exist yet at baseline time (new for this task).
  # The deliverable.md is tracked-dirty but its pre-task hash differs from current.
  BASELINE_HASH=$(sha256sum "$REPO/deliverable.md" | awk '{print $1}')
  # Simulate a different baseline hash (content was "initial\n", which has a different hash)
  INIT_HASH=$(printf 'initial\n' | sha256sum | awk '{print $1}')
  BASELINE_MAP=$(jq -n --arg p "deliverable.md" --arg h "$INIT_HASH" '{"files": {($p): $h}}')
  echo "$BASELINE_MAP" > "$REPO/.claude/hook-logs/${TASK}--baseline.json"

  # Create a post-edit log so post_edit_passed is true
  echo "PASS: lint clean" > "$REPO/.claude/hook-logs/${TASK}--post-edit.log"

  set +e
  run_sign_work "$REPO" "$TASK"
  EXIT=$?
  set -e

  FULL_SIG="$REPO/$SIG_FILE"
  if [[ ! -f "$FULL_SIG" ]]; then
    fail "T1" "signature file was not written (exit=$EXIT)"
  else
    # Check that the signature file itself is not in files_touched
    SIG_IN_FT=$(jq --arg s "$SIG_FILE" '[.files_touched[] | select(. == $s)] | length' "$FULL_SIG" 2>/dev/null || echo "error")
    DELIVERABLE_IN_FT=$(jq '[.files_touched[] | select(. == "deliverable.md")] | length' "$FULL_SIG" 2>/dev/null || echo "error")

    if [[ "$SIG_IN_FT" == "0" && "$DELIVERABLE_IN_FT" == "1" ]]; then
      pass "T1 · signature file absent from files_touched; deliverable.md present"
    elif [[ "$SIG_IN_FT" != "0" ]]; then
      fail "T1" "signature file found in files_touched (count=$SIG_IN_FT)"
    else
      fail "T1" "deliverable.md missing from files_touched (count=$DELIVERABLE_IN_FT, exit=$EXIT)"
    fi
  fi
}

# ── T2: fallback path (no baseline) — signature excluded ─────────────────────
#
# Setup: no baseline file. sign-work.sh uses git ls-files --others fallback.
# The signature file will appear in --others (untracked) sweep.
# Expected: signature file NOT in files_touched; other untracked file IS present.

echo ""
echo "[T2] fallback path (no baseline) · signature file excluded"

{
  make_isolated_repo; REPO="$CURRENT_REPO"
  TASK="TASK-T2-SELF-EXCLUSION"
  SIG_FILE=$(sig_path_for "$REPO" "$TASK")

  # Commit an initial file so git has HEAD
  echo "initial" > "$REPO/committed.md"
  git -C "$REPO" add committed.md
  git -C "$REPO" commit -q -m "init"

  # Create an untracked deliverable (this task's work product)
  mkdir -p "$REPO/docs"
  echo "# Task output" > "$REPO/docs/output.md"

  # No baseline file — fallback path activates
  # Post-edit log for pass
  echo "PASS: lint clean" > "$REPO/.claude/hook-logs/${TASK}--post-edit.log"

  set +e
  run_sign_work "$REPO" "$TASK"
  EXIT=$?
  set -e

  FULL_SIG="$REPO/$SIG_FILE"
  if [[ ! -f "$FULL_SIG" ]]; then
    fail "T2" "signature file was not written (exit=$EXIT)"
  else
    SIG_IN_FT=$(jq --arg s "$SIG_FILE" '[.files_touched[] | select(. == $s)] | length' "$FULL_SIG" 2>/dev/null || echo "error")
    OUTPUT_IN_FT=$(jq '[.files_touched[] | select(. == "docs/output.md")] | length' "$FULL_SIG" 2>/dev/null || echo "error")

    if [[ "$SIG_IN_FT" == "0" && "$OUTPUT_IN_FT" == "1" ]]; then
      pass "T2 · fallback path: signature file absent; docs/output.md present"
    elif [[ "$SIG_IN_FT" != "0" ]]; then
      fail "T2" "signature file found in files_touched on fallback path (count=$SIG_IN_FT)"
    else
      fail "T2" "docs/output.md missing from files_touched on fallback path (count=$OUTPUT_IN_FT, exit=$EXIT)"
    fi
  fi
}

# ── T3: post-exclusion empty — only signature file was new → exit 3 ──────────
#
# Setup: the only untracked file is the (to-be-written) signature file itself.
# After exclusion, FILES_TOUCHED is empty → sign-work.sh must exit 3.

echo ""
echo "[T3] post-exclusion empty · only signature new → expect exit 3"

{
  make_isolated_repo; REPO="$CURRENT_REPO"
  TASK="TASK-T3-SELF-EXCLUSION"
  SIG_FILE=$(sig_path_for "$REPO" "$TASK")

  # Commit an initial file so git has HEAD; no modifications, no new files
  echo "initial" > "$REPO/base.md"
  git -C "$REPO" add base.md
  git -C "$REPO" commit -q -m "init"

  # No baseline — fallback path.
  # No untracked files other than what sign-work.sh itself will create (.claude/signatures/...).
  # sign-work.sh writes the sig file mid-run; the jq sweep for --others will pick it up.
  # But after exclusion it should be gone, leaving [] → exit 3.
  #
  # However: sign-work.sh writes the file AFTER FILES_TOUCHED is computed and AFTER the
  # exclusion. The --others sweep therefore does NOT see the signature file yet on either
  # path (it is written at step 9, after FILES_TOUCHED is locked in at step 1).
  #
  # To correctly test T3 we need to simulate the scenario where the signature file
  # appears in FILES_TOUCHED before exclusion. This happens on the baseline path when
  # the signature file is NOT_IN_BASELINE — meaning the baseline was recorded before the
  # signature file was written, and the untracked sweep sees it as new.
  #
  # We achieve this by writing the signature file into the repo manually (so git sees it
  # as untracked before sign-work runs), AND providing a baseline that does not include
  # it. Then the baseline-aware untracked loop adds it to TASK_FILES_TOUCHED.
  # After exclusion it becomes empty → exit 3.
  #
  # Pre-create the signature file (simulates a re-sign scenario where a prior partial
  # run left the file on disk before the exclusion fix was applied).
  mkdir -p "$REPO/.claude/signatures"
  echo '{"placeholder": true}' > "$REPO/.claude/signatures/${TASK}--canopus.json"

  # Strategy: commit the hook-log files into the git repo so they are tracked and
  # unchanged — they will not appear in either the git diff sweep or the --others
  # sweep. The only untracked file sign-work.sh will see is the pre-created
  # signature file, which is then excluded → FILES_TOUCHED empty → exit 3.

  # Write and commit the post-edit log (tracked = not in --others sweep)
  echo "PASS: lint clean" > "$REPO/.claude/hook-logs/${TASK}--post-edit.log"

  # Build and commit a baseline that records base.md with its current hash.
  # The baseline file will be committed (tracked), so it also stays out of --others.
  INIT_HASH=$(sha256sum "$REPO/base.md" | awk '{print $1}')
  jq -n \
    --arg p1 "base.md" --arg h1 "$INIT_HASH" \
    '{"files": {($p1): $h1}}' \
    > "$REPO/.claude/hook-logs/${TASK}--baseline.json"

  # Commit all hook-log files so they are tracked clean (not in --others or diff sweep)
  git -C "$REPO" add ".claude/hook-logs/${TASK}--post-edit.log"
  git -C "$REPO" add ".claude/hook-logs/${TASK}--baseline.json"
  git -C "$REPO" commit -q -m "commit hook-logs to make them tracked"

  set +e
  run_sign_work "$REPO" "$TASK"
  EXIT=$?
  set -e

  if [[ "$EXIT" -eq 3 ]]; then
    pass "T3 · post-exclusion empty → exit 3 (nothing to sign)"
  elif [[ "$EXIT" -eq 0 || "$EXIT" -eq 4 ]]; then
    # Sign succeeded — check if signature file leaked into files_touched
    FULL_SIG="$REPO/$SIG_FILE"
    if [[ -f "$FULL_SIG" ]]; then
      SIG_IN_FT=$(jq --arg s "$SIG_FILE" '[.files_touched[] | select(. == $s)] | length' "$FULL_SIG" 2>/dev/null || echo "error")
      FT_LEN=$(jq '.files_touched | length' "$FULL_SIG" 2>/dev/null || echo "error")
      fail "T3" "expected exit 3 but got exit=$EXIT; files_touched has $FT_LEN entries, sig_in_ft=$SIG_IN_FT"
    else
      fail "T3" "expected exit 3 but got exit=$EXIT (sig file not written either)"
    fi
  else
    fail "T3" "unexpected exit code: $EXIT (expected 3)"
  fi
}

# ── T4: multiple deliverables + signature → only signature excluded ───────────
#
# Setup: two deliverable files are new (not in baseline). Signature file also
# appears as untracked (via the pre-creation trick from T3).
# Expected: both deliverables in files_touched; signature file absent.

echo ""
echo "[T4] multiple deliverables + signature · only signature excluded"

{
  make_isolated_repo; REPO="$CURRENT_REPO"
  TASK="TASK-T4-SELF-EXCLUSION"
  SIG_FILE=$(sig_path_for "$REPO" "$TASK")

  # Commit base
  echo "initial" > "$REPO/existing.md"
  git -C "$REPO" add existing.md
  git -C "$REPO" commit -q -m "init"

  # Create two deliverables (new, not in baseline)
  mkdir -p "$REPO/docs/harness"
  echo "# Rail A" > "$REPO/docs/harness/rail-a.md"
  echo "# Rail B" > "$REPO/docs/harness/rail-b.md"

  # Pre-create the signature file so it appears in the untracked sweep (T3 note above)
  mkdir -p "$REPO/.claude/signatures"
  echo '{"placeholder": true}' > "$REPO/.claude/signatures/${TASK}--canopus.json"

  # Baseline: existing.md is tracked and unchanged. Deliverables and sig file are absent
  # from baseline (NOT_IN_BASELINE → this task created them).
  INIT_HASH=$(sha256sum "$REPO/existing.md" | awk '{print $1}')
  BASELINE_MAP=$(jq -n --arg p "existing.md" --arg h "$INIT_HASH" '{"files": {($p): $h}}')
  echo "$BASELINE_MAP" > "$REPO/.claude/hook-logs/${TASK}--baseline.json"

  echo "PASS: lint clean" > "$REPO/.claude/hook-logs/${TASK}--post-edit.log"

  set +e
  run_sign_work "$REPO" "$TASK"
  EXIT=$?
  set -e

  FULL_SIG="$REPO/$SIG_FILE"
  if [[ ! -f "$FULL_SIG" ]]; then
    fail "T4" "signature file was not written (exit=$EXIT)"
  else
    SIG_IN_FT=$(jq --arg s "$SIG_FILE" '[.files_touched[] | select(. == $s)] | length' "$FULL_SIG" 2>/dev/null || echo "error")
    RAIL_A_IN_FT=$(jq '[.files_touched[] | select(. == "docs/harness/rail-a.md")] | length' "$FULL_SIG" 2>/dev/null || echo "error")
    RAIL_B_IN_FT=$(jq '[.files_touched[] | select(. == "docs/harness/rail-b.md")] | length' "$FULL_SIG" 2>/dev/null || echo "error")

    VERDICT="PASS"
    DETAIL=""

    if [[ "$SIG_IN_FT" != "0" ]]; then
      VERDICT="FAIL"
      DETAIL="signature file present in files_touched (count=$SIG_IN_FT)"
    fi
    if [[ "$RAIL_A_IN_FT" != "1" ]]; then
      VERDICT="FAIL"
      DETAIL="${DETAIL:+$DETAIL; }docs/harness/rail-a.md missing (count=$RAIL_A_IN_FT)"
    fi
    if [[ "$RAIL_B_IN_FT" != "1" ]]; then
      VERDICT="FAIL"
      DETAIL="${DETAIL:+$DETAIL; }docs/harness/rail-b.md missing (count=$RAIL_B_IN_FT)"
    fi

    if [[ "$VERDICT" == "PASS" ]]; then
      pass "T4 · two deliverables present; signature file absent"
    else
      fail "T4" "$DETAIL"
    fi
  fi
}

# ── summary ──────────────────────────────────────────────────────────────────

echo ""
echo "--- sign-work-self-exclusion smoke test results ---"
echo "  $PASS_COUNT PASS · $FAIL_COUNT FAIL"
echo ""

if [[ "$FAIL_COUNT" -eq 0 ]]; then
  echo "sign-work-self-exclusion · ALL PASS"
  exit 0
else
  echo "sign-work-self-exclusion · FAILURES DETECTED" >&2
  exit 1
fi
