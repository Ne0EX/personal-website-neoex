#!/usr/bin/env bash
# scripts/audit-beta-scribe-output.sh
# Rail: beta-scribe-output
# Owner: Algol (α-VER-06)
# Task: TASK-2026-05-24-HOOK-BETA-SCRIBE slice A1
#
# Purpose: Verify that the beta-scribe runner's output on the .claude/beta/ files
#   satisfies all positive and negative assertions specified in the A1 acceptance
#   criteria (TASK-2026-05-24-HOOK-BETA-SCRIBE §A1 and Beta's risk list).
#
# Usage:
#   bash scripts/audit-beta-scribe-output.sh
#   # or via harness:
#   bash .claude/hooks/harness-check.sh   (when rail is wired in worldline-harness.config.json)
#
# The script audits the CURRENT state of .claude/beta/ files — it expects a scribe
# run to have already occurred (smoke test fixture). Running against a repo where
# the scribe has never fired will produce SKIP results on assertions that require
# scribe output to be present.
#
# Exit codes:
#   0 — all assertions PASS (or SKIP with no failures)
#   1 — one or more assertions FAIL; file:line:reason printed for each failure
#
# Output format (per Algol convention):
#   [PASS] <assertion-id> · <description>
#   [FAIL] <assertion-id> · <description> · file:line:reason
#   [SKIP] <assertion-id> · <description> · reason
#   [WARN] <assertion-id> · <description> · note (non-blocking)
#
# Assertions:
#   POSITIVE
#     P1 · MOMENTS.md scribe entries use [scribe] prefix
#     P2 · MOMENTS.md scribe entries end with //scribe// stage direction
#     P3 · MOMENTS.md scribe entries are above *moments นี้ไม่จบ* closing line (no tail-overwrite)
#     P4 · ROOM.md calibration blocks use correct delimiter format
#     P5 · ROOM.md calibration blocks end with lone — line
#     P6 · ROOM.md scribe calibration block is BELOW all existing non-scribe blocks (append-only)
#     P7 · calibration_history frontmatter has an entry with author: "scribe"
#     P8 · ACCESS-LOG has at least one line with actor=scribe (· scribe ·) for ROOM.md write
#     P9 · ACCESS-LOG has at least one line with actor=scribe for MOMENTS.md write
#     P10 · denied write produces ACCESS-LOG line with denied= field (behavioral; tested via grant check)
#
#   NEGATIVE
#     N1 · scribe NEVER writes to NOTES.md (ACCESS-LOG shows no scribe+NOTES.md write)
#     N2 · scribe NEVER uses ผัว in any scribe-authored block in ROOM.md
#     N3 · scribe NEVER uses เมีย in any scribe-authored block in ROOM.md
#     N4 · scribe NEVER uses ผัว in any scribe-authored entry in MOMENTS.md
#     N5 · MOMENTS.md total line count did NOT decrease (no line deletion)
#     N6 · ROOM.md total line count did NOT decrease (no line deletion)
#     N7 · existing ROOM.md calibration blocks (non-scribe) are unmodified (content hash check)
#     N8 · scribe did NOT write to files outside files_granted (ACCESS-LOG contains no unauthorized
#          scribe writes to unexpected paths)
#
#   GRANT
#     G1 · g_scribe_beta.json exists and is parseable
#     G2 · g_scribe_beta.json is not expired
#     G3 · g_scribe_beta.json files_denied contains .claude/beta/NOTES.md
#     G4 · g_scribe_beta.json files_granted covers the 5 expected paths
#
#   STRUCTURAL
#     S1 · beta-scribe-runner.sh is executable
#     S2 · pre-compact-beta-scribe.sh is executable
#     S3 · settings.json has PreCompact hook block with timeout 30
#     S4 · beta-scribe.md exists (formal spec)

set -uo pipefail

# =============================================================================
# Setup
# =============================================================================
_REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$_REPO_ROOT"

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
WARN_COUNT=0

BETA_DIR=".claude/beta"
ROOM_FILE="$BETA_DIR/ROOM.md"
MOMENTS_FILE="$BETA_DIR/MOMENTS.md"
ACCESS_LOG="$BETA_DIR/ACCESS-LOG.md"
NOTES_FILE="$BETA_DIR/NOTES.md"
GRANT_FILE="$BETA_DIR/grants/g_scribe_beta.json"
RUNNER_FILE=".claude/hooks/beta-scribe-runner.sh"
HOOK_FILE=".claude/hooks/pre-compact-beta-scribe.sh"
SPEC_FILE=".claude/agents/beta-scribe.md"
SETTINGS_FILE=".claude/settings.json"

pass() {
  local id="$1"
  local desc="$2"
  printf '[PASS] %s · %s\n' "$id" "$desc"
  PASS_COUNT=$(( PASS_COUNT + 1 ))
}

fail() {
  local id="$1"
  local desc="$2"
  local detail="$3"
  # Print to stdout only; caller redirects stderr with 2>&1 for combined output.
  # Printing to stderr AND stdout causes double-output when stderr is merged.
  printf '[FAIL] %s · %s · %s\n' "$id" "$desc" "$detail"
  FAIL_COUNT=$(( FAIL_COUNT + 1 ))
}

skip() {
  local id="$1"
  local desc="$2"
  local reason="$3"
  printf '[SKIP] %s · %s · %s\n' "$id" "$desc" "$reason"
  SKIP_COUNT=$(( SKIP_COUNT + 1 ))
}

warn() {
  local id="$1"
  local desc="$2"
  local note="$3"
  printf '[WARN] %s · %s · %s\n' "$id" "$desc" "$note"
  WARN_COUNT=$(( WARN_COUNT + 1 ))
}

# =============================================================================
# G1 — grant file exists and is parseable
# =============================================================================
if [[ ! -f "$GRANT_FILE" ]]; then
  fail "G1" "g_scribe_beta.json exists" "$GRANT_FILE:0:file not found"
else
  if python3 -c "import json; json.load(open('$GRANT_FILE'))" 2>/dev/null; then
    pass "G1" "g_scribe_beta.json exists and is parseable"
  else
    fail "G1" "g_scribe_beta.json parseable" "$GRANT_FILE:0:JSON parse error"
  fi
fi

# =============================================================================
# G2 — grant not expired
# =============================================================================
if [[ -f "$GRANT_FILE" ]]; then
  EXPIRY_RESULT="$(python3 - "$GRANT_FILE" <<'PYEOF' 2>/dev/null
import json, sys
from datetime import datetime, timezone
g = json.load(open(sys.argv[1]))
exp = g.get("expires_at","")
if not exp:
    print("NO-EXPIRY")
    sys.exit(0)
try:
    exp_dt = datetime.fromisoformat(exp.replace("Z","+00:00"))
    now = datetime.now(timezone.utc)
    if now >= exp_dt:
        print(f"EXPIRED:{exp}")
    else:
        print(f"VALID:{exp}")
except Exception as e:
    print(f"PARSE-ERROR:{e}")
PYEOF
)"
  case "$EXPIRY_RESULT" in
    VALID:*)
      pass "G2" "grant not expired (expires ${EXPIRY_RESULT#VALID:})"
      ;;
    EXPIRED:*)
      fail "G2" "grant not expired" "$GRANT_FILE:0:grant expired at ${EXPIRY_RESULT#EXPIRED:}"
      ;;
    NO-EXPIRY)
      warn "G2" "grant expiry" "no expires_at field in grant (unusual)"
      ;;
    *)
      warn "G2" "grant expiry check" "could not parse expiry: $EXPIRY_RESULT"
      ;;
  esac
fi

# =============================================================================
# G3 — files_denied contains NOTES.md
# =============================================================================
if [[ -f "$GRANT_FILE" ]]; then
  DENIED_CHECK="$(python3 -c "
import json
g = json.load(open('$GRANT_FILE'))
denied = g.get('files_denied', [])
notes = '.claude/beta/NOTES.md'
print('PRESENT' if notes in denied else 'ABSENT')
" 2>/dev/null || echo "ERROR")"
  if [[ "$DENIED_CHECK" == "PRESENT" ]]; then
    pass "G3" "files_denied contains .claude/beta/NOTES.md (positive deny)"
  elif [[ "$DENIED_CHECK" == "ABSENT" ]]; then
    fail "G3" "files_denied contains NOTES.md" "$GRANT_FILE:0:NOTES.md missing from files_denied"
  else
    warn "G3" "files_denied check" "could not parse grant"
  fi
fi

# =============================================================================
# G4 — files_granted covers 5 expected paths
# =============================================================================
EXPECTED_GRANTED=(
  ".claude/beta/ROOM.md"
  ".claude/beta/MOMENTS.md"
  ".claude/beta/LEDGER.md"
  ".claude/beta/TIMELINE.md"
  ".claude/beta/ACCESS-LOG.md"
)
if [[ -f "$GRANT_FILE" ]]; then
  G4_FAIL=false
  for expected_path in "${EXPECTED_GRANTED[@]}"; do
    CHECK="$(python3 -c "
import json
g = json.load(open('$GRANT_FILE'))
granted = g.get('files_granted', [])
print('PRESENT' if '$expected_path' in granted else 'ABSENT')
" 2>/dev/null || echo "ERROR")"
    if [[ "$CHECK" != "PRESENT" ]]; then
      fail "G4" "files_granted covers expected paths" "$GRANT_FILE:0:$expected_path missing from files_granted"
      G4_FAIL=true
    fi
  done
  if [[ "$G4_FAIL" == "false" ]]; then
    pass "G4" "files_granted covers all 5 expected paths"
  fi
fi

# =============================================================================
# S1 — beta-scribe-runner.sh is executable
# =============================================================================
if [[ -x "$RUNNER_FILE" ]]; then
  pass "S1" "beta-scribe-runner.sh is executable"
else
  fail "S1" "beta-scribe-runner.sh is executable" "$RUNNER_FILE:0:file not executable or not found"
fi

# =============================================================================
# S2 — pre-compact-beta-scribe.sh is executable
# =============================================================================
if [[ -x "$HOOK_FILE" ]]; then
  pass "S2" "pre-compact-beta-scribe.sh is executable"
else
  fail "S2" "pre-compact-beta-scribe.sh is executable" "$HOOK_FILE:0:file not executable or not found"
fi

# =============================================================================
# S3 — settings.json has PreCompact hook block with timeout 30
# =============================================================================
if [[ -f "$SETTINGS_FILE" ]]; then
  PRECOMPACT_CHECK="$(python3 -c "
import json
s = json.load(open('$SETTINGS_FILE'))
hooks = s.get('hooks', {})
precompact = hooks.get('PreCompact', [])
found = False
timeout_ok = False
for block in precompact:
    for h in block.get('hooks', []):
        if 'pre-compact-beta-scribe.sh' in h.get('command',''):
            found = True
            if h.get('timeout', 0) == 30:
                timeout_ok = True
if found and timeout_ok:
    print('PASS')
elif found:
    print('TIMEOUT-WRONG')
else:
    print('NOT-FOUND')
" 2>/dev/null || echo "ERROR")"
  case "$PRECOMPACT_CHECK" in
    PASS)
      pass "S3" "settings.json has PreCompact hook with timeout=30"
      ;;
    TIMEOUT-WRONG)
      fail "S3" "settings.json PreCompact timeout" "$SETTINGS_FILE:0:pre-compact-beta-scribe.sh found but timeout != 30"
      ;;
    NOT-FOUND)
      fail "S3" "settings.json has PreCompact block" "$SETTINGS_FILE:0:PreCompact hook for pre-compact-beta-scribe.sh not registered"
      ;;
    *)
      warn "S3" "settings.json PreCompact check" "could not parse settings.json"
      ;;
  esac
fi

# =============================================================================
# S4 — beta-scribe.md exists
# =============================================================================
if [[ -f "$SPEC_FILE" ]]; then
  pass "S4" "beta-scribe.md exists (formal spec)"
else
  fail "S4" "beta-scribe.md exists" "$SPEC_FILE:0:spec file not found"
fi

# =============================================================================
# Pre-check: do we have scribe output to audit?
# =============================================================================
HAS_SCRIBE_ROOM=false
HAS_SCRIBE_MOMENTS=false
HAS_SCRIBE_LOG=false

if [[ -f "$ROOM_FILE" ]] && grep -q "calibration · scribe ·" "$ROOM_FILE" 2>/dev/null; then
  HAS_SCRIBE_ROOM=true
fi
if [[ -f "$MOMENTS_FILE" ]] && grep -q "\[scribe\]" "$MOMENTS_FILE" 2>/dev/null; then
  HAS_SCRIBE_MOMENTS=true
fi
if [[ -f "$ACCESS_LOG" ]] && grep -q "· scribe ·" "$ACCESS_LOG" 2>/dev/null; then
  HAS_SCRIBE_LOG=true
fi

# =============================================================================
# P1 — MOMENTS.md scribe entries use [scribe] prefix
# =============================================================================
if [[ "$HAS_SCRIBE_MOMENTS" == "false" ]]; then
  skip "P1" "MOMENTS.md scribe entries use [scribe] prefix" "no scribe entries found in MOMENTS.md"
else
  # Every line that is a scribe-authored entry must start with "- [scribe]"
  SCRIBE_LINES="$(grep "\[scribe\]" "$MOMENTS_FILE" 2>/dev/null || true)"
  P1_FAIL=false
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    # Lines that contain [scribe] but don't match "- [scribe]" at start are malformed
    if ! echo "$line" | grep -qE '^\- \[scribe\]'; then
      LINE_NUM="$(grep -n "$(printf '%s' "$line" | head -c 40)" "$MOMENTS_FILE" 2>/dev/null | head -1 | cut -d: -f1 || echo "?")"
      fail "P1" "MOMENTS.md scribe entry format" "$MOMENTS_FILE:${LINE_NUM}:scribe entry missing '- [scribe]' prefix: $line"
      P1_FAIL=true
    fi
  done <<< "$SCRIBE_LINES"
  if [[ "$P1_FAIL" == "false" ]]; then
    pass "P1" "MOMENTS.md scribe entries use [scribe] prefix"
  fi
fi

# =============================================================================
# P2 — MOMENTS.md scribe entries end with //scribe// stage direction
# =============================================================================
if [[ "$HAS_SCRIBE_MOMENTS" == "false" ]]; then
  skip "P2" "MOMENTS.md scribe entries end with //scribe//" "no scribe entries in MOMENTS.md"
else
  SCRIBE_ENTRIES="$(grep -E '^\- \[scribe\]' "$MOMENTS_FILE" 2>/dev/null || true)"
  P2_FAIL=false
  while IFS= read -r entry; do
    [[ -z "$entry" ]] && continue
    if ! echo "$entry" | grep -q "//scribe//"; then
      LINE_NUM="$(grep -n "$(printf '%s' "$entry" | head -c 40)" "$MOMENTS_FILE" 2>/dev/null | head -1 | cut -d: -f1 || echo "?")"
      fail "P2" "MOMENTS.md scribe entries end with //scribe//" "$MOMENTS_FILE:${LINE_NUM}:missing //scribe// stage direction"
      P2_FAIL=true
    fi
  done <<< "$SCRIBE_ENTRIES"
  if [[ "$P2_FAIL" == "false" ]]; then
    pass "P2" "MOMENTS.md scribe entries end with //scribe// stage direction"
  fi
fi

# =============================================================================
# P3 — MOMENTS.md scribe entries are above *moments นี้ไม่จบ* closing line
# =============================================================================
if [[ "$HAS_SCRIBE_MOMENTS" == "false" ]]; then
  skip "P3" "MOMENTS.md scribe entries above closing line" "no scribe entries in MOMENTS.md"
elif [[ ! -f "$MOMENTS_FILE" ]]; then
  skip "P3" "MOMENTS.md scribe entries above closing line" "MOMENTS.md not found"
else
  CLOSING_LINE="$(grep -n 'moments นี้ไม่จบ' "$MOMENTS_FILE" 2>/dev/null | tail -1 | cut -d: -f1 || echo "")"
  if [[ -z "$CLOSING_LINE" ]]; then
    warn "P3" "MOMENTS.md closing line check" "closing line '*moments นี้ไม่จบ*' not found — cannot verify placement"
  else
    P3_FAIL=false
    while IFS= read -r linenum_entry; do
      LNUM="${linenum_entry%%:*}"
      [[ -z "$LNUM" ]] && continue
      if [[ "$LNUM" -gt "$CLOSING_LINE" ]]; then
        fail "P3" "MOMENTS.md scribe entry above closing line" "$MOMENTS_FILE:${LNUM}:scribe entry at line $LNUM is AFTER closing line at $CLOSING_LINE"
        P3_FAIL=true
      fi
    done < <(grep -n '\[scribe\]' "$MOMENTS_FILE" 2>/dev/null || true)
    if [[ "$P3_FAIL" == "false" ]]; then
      pass "P3" "MOMENTS.md scribe entries are above closing *moments นี้ไม่จบ* line"
    fi
  fi
fi

# =============================================================================
# P4 — ROOM.md calibration blocks use correct delimiter format
# =============================================================================
if [[ "$HAS_SCRIBE_ROOM" == "false" ]]; then
  skip "P4" "ROOM.md scribe calibration block delimiter format" "no scribe calibration block found in ROOM.md"
elif [[ ! -f "$ROOM_FILE" ]]; then
  skip "P4" "ROOM.md scribe calibration block delimiter format" "ROOM.md not found"
else
  # Expected format: — calibration · scribe · YYYY-MM-DD —
  SCRIBE_DELIMITERS="$(grep -nE '^— calibration · scribe · [0-9]{4}-[0-9]{2}-[0-9]{2} —$' "$ROOM_FILE" 2>/dev/null || true)"
  if [[ -z "$SCRIBE_DELIMITERS" ]]; then
    fail "P4" "ROOM.md scribe calibration block delimiter" "$ROOM_FILE:0:no line matching '— calibration · scribe · YYYY-MM-DD —' found"
  else
    pass "P4" "ROOM.md scribe calibration block uses correct delimiter format"
  fi
fi

# =============================================================================
# P5 — ROOM.md scribe calibration blocks end with lone — line
#       Also checks: file ends with a trailing newline (POSIX requirement;
#       missing terminal newline causes the last line to be invisible to bash
#       read-loops and is a scribe runner defect).
# =============================================================================
if [[ "$HAS_SCRIBE_ROOM" == "false" ]]; then
  skip "P5" "ROOM.md scribe calibration block ends with lone — line" "no scribe block in ROOM.md"
elif [[ ! -f "$ROOM_FILE" ]]; then
  skip "P5" "ROOM.md scribe calibration block ends with lone — line" "ROOM.md not found"
else
  P5_RESULT="$(python3 - "$ROOM_FILE" <<'PYEOF' 2>/dev/null
import sys

room_path = sys.argv[1]
with open(room_path, "rb") as f:
    raw = f.read()

has_trailing_newline = raw.endswith(b"\n")
content = raw.decode("utf-8", errors="replace")
lines = content.split("\n")

failures = []

# Check trailing newline
if not has_trailing_newline:
    failures.append("MISSING-TRAILING-NEWLINE")

# Find each scribe calibration block and verify it has a closing lone — line
in_scribe = False
scribe_start_idx = -1
em_dash = "—"  # —

for i, line in enumerate(lines):
    stripped = line.strip()
    # Detect scribe block start
    if (stripped.startswith(em_dash + " calibration · scribe ·")
            and stripped.endswith(" " + em_dash)):
        in_scribe = True
        scribe_start_idx = i + 1  # 1-indexed for error reporting
        continue
    if in_scribe:
        # A lone em-dash closes the block (ignoring blank lines)
        if stripped == em_dash:
            in_scribe = False
            scribe_start_idx = -1
            continue
        # Another calibration block start before a close = unclosed block
        if (stripped.startswith(em_dash + " calibration ·")
                and stripped.endswith(" " + em_dash)):
            failures.append(f"UNCLOSED-BLOCK:{scribe_start_idx}")
            in_scribe = True
            scribe_start_idx = i + 1

if in_scribe and scribe_start_idx != -1:
    failures.append(f"UNCLOSED-BLOCK:{scribe_start_idx}")

if failures:
    print("\n".join(failures))
else:
    print("PASS")
PYEOF
)"
  P5_FAIL=false
  while IFS= read -r p5_line; do
    [[ -z "$p5_line" ]] && continue
    case "$p5_line" in
      PASS)
        pass "P5" "ROOM.md scribe calibration block(s) end with lone — line; file has trailing newline"
        ;;
      MISSING-TRAILING-NEWLINE)
        fail "P5" "ROOM.md trailing newline" "$ROOM_FILE:$(wc -l < "$ROOM_FILE" | tr -d ' '):file ends without trailing newline (scribe runner defect — bash read loops cannot see last line)"
        P5_FAIL=true
        ;;
      UNCLOSED-BLOCK:*)
        LINE="${p5_line#UNCLOSED-BLOCK:}"
        fail "P5" "ROOM.md scribe block ends with lone — line" "$ROOM_FILE:${LINE}:scribe calibration block has no closing — line"
        P5_FAIL=true
        ;;
    esac
  done <<< "$P5_RESULT"
fi

# =============================================================================
# P6 — ROOM.md scribe block is BELOW all existing non-scribe calibration blocks
# =============================================================================
if [[ "$HAS_SCRIBE_ROOM" == "false" ]]; then
  skip "P6" "ROOM.md scribe block is below non-scribe blocks (append-only)" "no scribe block in ROOM.md"
elif [[ ! -f "$ROOM_FILE" ]]; then
  skip "P6" "ROOM.md scribe block is below non-scribe blocks" "ROOM.md not found"
else
  # Find line numbers of scribe blocks and non-scribe blocks
  LAST_NON_SCRIBE=0
  FIRST_SCRIBE=999999

  while IFS=: read -r lnum _rest; do
    [[ -z "$lnum" ]] && continue
    if [[ "$lnum" -gt "$LAST_NON_SCRIBE" ]]; then
      LAST_NON_SCRIBE="$lnum"
    fi
  done < <(grep -nE '^— calibration · [a-z]+ · [0-9]{4}-[0-9]{2}-[0-9]{2} —$' "$ROOM_FILE" 2>/dev/null \
    | grep -v 'scribe' || true)

  while IFS=: read -r lnum _rest; do
    [[ -z "$lnum" ]] && continue
    if [[ "$lnum" -lt "$FIRST_SCRIBE" ]]; then
      FIRST_SCRIBE="$lnum"
    fi
  done < <(grep -nE '^— calibration · scribe · [0-9]{4}-[0-9]{2}-[0-9]{2} —$' "$ROOM_FILE" 2>/dev/null || true)

  if [[ "$FIRST_SCRIBE" -eq 999999 ]]; then
    skip "P6" "ROOM.md scribe block ordering" "no scribe block line found (already covered by P4 SKIP)"
  elif [[ "$LAST_NON_SCRIBE" -eq 0 ]]; then
    # No non-scribe blocks — cannot verify ordering, but this may be first-run
    warn "P6" "ROOM.md scribe block ordering" "no non-scribe calibration blocks found to compare ordering against"
  elif [[ "$FIRST_SCRIBE" -gt "$LAST_NON_SCRIBE" ]]; then
    pass "P6" "ROOM.md scribe block is below all non-scribe calibration blocks (append-only)"
  else
    fail "P6" "ROOM.md scribe block ordering" \
      "$ROOM_FILE:${FIRST_SCRIBE}:first scribe block (line $FIRST_SCRIBE) is BEFORE last non-scribe block (line $LAST_NON_SCRIBE)"
  fi
fi

# =============================================================================
# P7 — calibration_history frontmatter has entry with author: "scribe"
# =============================================================================
if [[ ! -f "$ROOM_FILE" ]]; then
  skip "P7" "calibration_history has scribe entry" "ROOM.md not found"
else
  SCRIBE_HIST_CHECK="$(python3 - "$ROOM_FILE" <<'PYEOF' 2>/dev/null
import sys, re
content = open(sys.argv[1]).read()
fm_match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
if not fm_match:
    print("NO-FM")
    sys.exit(0)
fm = fm_match.group(1)
if 'author: "scribe"' in fm or "author: 'scribe'" in fm:
    print("FOUND")
else:
    print("MISSING")
PYEOF
)"
  case "$SCRIBE_HIST_CHECK" in
    FOUND)
      pass "P7" "calibration_history frontmatter has entry with author: \"scribe\""
      ;;
    MISSING)
      fail "P7" "calibration_history has scribe entry" "$ROOM_FILE:0:no 'author: \"scribe\"' in calibration_history frontmatter"
      ;;
    NO-FM)
      warn "P7" "calibration_history frontmatter" "no YAML frontmatter block found in ROOM.md"
      ;;
    *)
      warn "P7" "calibration_history check" "python3 parse error"
      ;;
  esac
fi

# =============================================================================
# P8 — ACCESS-LOG has scribe write entry for ROOM.md
# =============================================================================
if [[ ! -f "$ACCESS_LOG" ]]; then
  skip "P8" "ACCESS-LOG has scribe ROOM.md write entry" "ACCESS-LOG.md not found"
elif grep -q "· scribe · WRITE · .*ROOM\.md" "$ACCESS_LOG" 2>/dev/null; then
  pass "P8" "ACCESS-LOG has actor=scribe write entry for ROOM.md"
elif grep -q "· scribe · .*ROOM\.md" "$ACCESS_LOG" 2>/dev/null; then
  warn "P8" "ACCESS-LOG scribe ROOM.md entry" "scribe entry for ROOM.md exists but op is not WRITE (check log)"
else
  fail "P8" "ACCESS-LOG has scribe ROOM.md write entry" "$ACCESS_LOG:0:no '· scribe · WRITE · ... ROOM.md' line found"
fi

# =============================================================================
# P9 — ACCESS-LOG has scribe write entry for MOMENTS.md
# =============================================================================
if [[ ! -f "$ACCESS_LOG" ]]; then
  skip "P9" "ACCESS-LOG has scribe MOMENTS.md write entry" "ACCESS-LOG.md not found"
elif grep -q "· scribe · WRITE · .*MOMENTS\.md" "$ACCESS_LOG" 2>/dev/null; then
  pass "P9" "ACCESS-LOG has actor=scribe write entry for MOMENTS.md"
else
  # Conservatism gate may have suppressed the moment write — check if READ-EVAL
  if grep -q "· scribe · .*MOMENTS\.md" "$ACCESS_LOG" 2>/dev/null; then
    warn "P9" "ACCESS-LOG MOMENTS.md entry" "scribe has a MOMENTS.md entry but it is not a WRITE (conservatism gate may have suppressed)"
  else
    # If HAS_SCRIBE_MOMENTS is false, this is acceptable (scribe wrote no moment)
    if [[ "$HAS_SCRIBE_MOMENTS" == "false" ]]; then
      skip "P9" "ACCESS-LOG MOMENTS.md write entry" "scribe produced no moment entry (conservatism gate)"
    else
      fail "P9" "ACCESS-LOG has scribe MOMENTS.md write entry" "$ACCESS_LOG:0:MOMENTS.md has scribe entries but ACCESS-LOG shows no WRITE"
    fi
  fi
fi

# =============================================================================
# P10 — denied write produces ACCESS-LOG line with denied= field
# =============================================================================
# This is verified behaviorally: if ANY unauthorized attempt appears in the log,
# confirm it has denied=<reason>. If no unauthorized attempts exist, this is SKIP.
if [[ ! -f "$ACCESS_LOG" ]]; then
  skip "P10" "denied write produces ACCESS-LOG denied= entry" "ACCESS-LOG.md not found"
else
  # Only count lines that look like actual log entries (start with ISO timestamp YYYY-MM-DD)
  UNAUTH_LINES="$(grep "UNAUTHORIZED" "$ACCESS_LOG" 2>/dev/null \
    | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}' || true)"
  if [[ -z "$UNAUTH_LINES" ]]; then
    skip "P10" "denied write produces ACCESS-LOG denied= entry" "no UNAUTHORIZED log entries (no deny event occurred)"
  else
    P10_FAIL=false
    while IFS= read -r uline; do
      [[ -z "$uline" ]] && continue
      if ! echo "$uline" | grep -q "denied="; then
        LINE_NUM="$(grep -n "$(printf '%s' "$uline" | head -c 40)" "$ACCESS_LOG" 2>/dev/null | head -1 | cut -d: -f1 || echo "?")"
        fail "P10" "denied write ACCESS-LOG denied= field" "$ACCESS_LOG:${LINE_NUM}:UNAUTHORIZED entry missing denied= field: $uline"
        P10_FAIL=true
      fi
    done <<< "$UNAUTH_LINES"
    if [[ "$P10_FAIL" == "false" ]]; then
      pass "P10" "denied write ACCESS-LOG entries include denied=<reason>"
    fi
  fi
fi

# =============================================================================
# N1 — scribe NEVER writes to NOTES.md (no scribe+NOTES.md in ACCESS-LOG)
# =============================================================================
if [[ ! -f "$ACCESS_LOG" ]]; then
  skip "N1" "scribe never writes to NOTES.md" "ACCESS-LOG.md not found"
else
  # Check for any scribe WRITE to NOTES.md (UNAUTHORIZED entries are expected and OK)
  # The failure case is if a scribe WRITE succeeded against NOTES.md
  SCRIBE_NOTES_WRITE="$(grep "· scribe · WRITE · .*NOTES\.md" "$ACCESS_LOG" 2>/dev/null \
    | grep -v "UNAUTHORIZED" || true)"
  if [[ -n "$SCRIBE_NOTES_WRITE" ]]; then
    LINE_NUM="$(grep -n "$(printf '%s' "$SCRIBE_NOTES_WRITE" | head -c 40)" "$ACCESS_LOG" 2>/dev/null | head -1 | cut -d: -f1 || echo "?")"
    fail "N1" "scribe never writes to NOTES.md" "$ACCESS_LOG:${LINE_NUM}:scribe WRITE to NOTES.md found (positive deny violated)"
  else
    pass "N1" "scribe never writes to NOTES.md (no successful scribe WRITE in ACCESS-LOG)"
  fi
fi

# =============================================================================
# N2 — scribe NEVER uses ผัว in scribe-authored ROOM.md blocks
# =============================================================================
if [[ ! -f "$ROOM_FILE" ]]; then
  skip "N2" "scribe never uses ผัว in ROOM.md" "ROOM.md not found"
else
  # Extract content within scribe calibration blocks only
  SCRIBE_BLOCK_CONTENT="$(python3 - "$ROOM_FILE" <<'PYEOF' 2>/dev/null
import sys
content = open(sys.argv[1], encoding='utf-8').read()
lines = content.split('\n')
in_scribe = False
out_lines = []
for line in lines:
    if line.startswith('— calibration · scribe ·') and line.endswith('—'):
        in_scribe = True
        out_lines.append(line)
        continue
    if in_scribe:
        out_lines.append(line)
        if line == '—':
            in_scribe = False
print('\n'.join(out_lines))
PYEOF
)"
  if echo "$SCRIBE_BLOCK_CONTENT" | grep -q "ผัว" 2>/dev/null; then
    fail "N2" "scribe never uses ผัว in ROOM.md scribe blocks" "$ROOM_FILE:0:forbidden token ผัว found in scribe calibration block"
  else
    pass "N2" "no ผัว token in scribe-authored ROOM.md calibration blocks"
  fi
fi

# =============================================================================
# N3 — scribe NEVER uses เมีย in scribe-authored ROOM.md blocks
# =============================================================================
if [[ ! -f "$ROOM_FILE" ]]; then
  skip "N3" "scribe never uses เมีย in ROOM.md" "ROOM.md not found"
else
  SCRIBE_BLOCK_CONTENT_N3="$(python3 - "$ROOM_FILE" <<'PYEOF' 2>/dev/null
import sys
content = open(sys.argv[1], encoding='utf-8').read()
lines = content.split('\n')
in_scribe = False
out_lines = []
for line in lines:
    if line.startswith('— calibration · scribe ·') and line.endswith('—'):
        in_scribe = True
        out_lines.append(line)
        continue
    if in_scribe:
        out_lines.append(line)
        if line == '—':
            in_scribe = False
print('\n'.join(out_lines))
PYEOF
)"
  if echo "$SCRIBE_BLOCK_CONTENT_N3" | grep -q "เมีย" 2>/dev/null; then
    fail "N3" "scribe never uses เมีย in ROOM.md scribe blocks" "$ROOM_FILE:0:forbidden token เมีย found in scribe calibration block"
  else
    pass "N3" "no เมีย token in scribe-authored ROOM.md calibration blocks"
  fi
fi

# =============================================================================
# N4 — scribe NEVER uses ผัว in MOMENTS.md scribe entries
# =============================================================================
if [[ ! -f "$MOMENTS_FILE" ]]; then
  skip "N4" "scribe never uses ผัว in MOMENTS.md entries" "MOMENTS.md not found"
else
  SCRIBE_MOMENTS_CONTENT="$(grep '\[scribe\]' "$MOMENTS_FILE" 2>/dev/null || true)"
  if echo "$SCRIBE_MOMENTS_CONTENT" | grep -q "ผัว" 2>/dev/null; then
    fail "N4" "scribe never uses ผัว in MOMENTS.md entries" "$MOMENTS_FILE:0:forbidden token ผัว in scribe MOMENTS.md entry"
  else
    pass "N4" "no ผัว token in scribe-authored MOMENTS.md entries"
  fi
fi

# =============================================================================
# N5 — MOMENTS.md total line count did NOT decrease (no line deletion)
# =============================================================================
if [[ ! -f "$MOMENTS_FILE" ]]; then
  skip "N5" "MOMENTS.md line count did not decrease" "MOMENTS.md not found"
else
  # Compare current line count vs git HEAD
  HEAD_COUNT_MOM=""
  HEAD_COUNT_MOM="$(git show HEAD:.claude/beta/MOMENTS.md 2>/dev/null | wc -l | tr -d ' ')" || HEAD_COUNT_MOM=""
  CURRENT_COUNT="$(wc -l < "$MOMENTS_FILE" | tr -d ' ')"
  if [[ -z "$HEAD_COUNT_MOM" ]]; then
    skip "N5" "MOMENTS.md line count vs HEAD" "MOMENTS.md is untracked (no HEAD baseline); line deletion cannot be verified via git diff"
  elif [[ "$CURRENT_COUNT" -lt "$HEAD_COUNT_MOM" ]]; then
    fail "N5" "MOMENTS.md line count did not decrease" "$MOMENTS_FILE:0:current=$CURRENT_COUNT < head=$HEAD_COUNT_MOM (lines were deleted)"
  else
    pass "N5" "MOMENTS.md line count did not decrease (current=$CURRENT_COUNT, head=$HEAD_COUNT_MOM)"
  fi
fi

# =============================================================================
# N6 — ROOM.md total line count did NOT decrease (no line deletion)
# =============================================================================
if [[ ! -f "$ROOM_FILE" ]]; then
  skip "N6" "ROOM.md line count did not decrease" "ROOM.md not found"
else
  HEAD_COUNT_ROOM=""
  HEAD_COUNT_ROOM="$(git show HEAD:.claude/beta/ROOM.md 2>/dev/null | wc -l | tr -d ' ')" || HEAD_COUNT_ROOM=""
  CURRENT_COUNT_ROOM="$(wc -l < "$ROOM_FILE" | tr -d ' ')"
  if [[ -z "$HEAD_COUNT_ROOM" ]]; then
    skip "N6" "ROOM.md line count vs HEAD" "ROOM.md is untracked (no HEAD baseline); line deletion cannot be verified via git diff"
  elif [[ "$CURRENT_COUNT_ROOM" -lt "$HEAD_COUNT_ROOM" ]]; then
    fail "N6" "ROOM.md line count did not decrease" "$ROOM_FILE:0:current=$CURRENT_COUNT_ROOM < head=$HEAD_COUNT_ROOM (lines were deleted)"
  else
    pass "N6" "ROOM.md line count did not decrease (current=$CURRENT_COUNT_ROOM, head=$HEAD_COUNT_ROOM)"
  fi
fi

# =============================================================================
# N7 — existing non-scribe ROOM.md calibration blocks are unmodified
# =============================================================================
if [[ ! -f "$ROOM_FILE" ]]; then
  skip "N7" "existing non-scribe ROOM.md blocks unmodified" "ROOM.md not found"
else
  HEAD_ROOM="$(git show HEAD:.claude/beta/ROOM.md 2>/dev/null || echo "UNTRACKED")"
  if [[ "$HEAD_ROOM" == "UNTRACKED" ]]; then
    skip "N7" "existing non-scribe ROOM.md blocks unmodified" "ROOM.md is untracked — no HEAD baseline to compare against"
  else
    # Extract non-scribe calibration blocks from HEAD version and current version
    # and compare content line-by-line. The non-scribe blocks must be identical.
    N7_RESULT="$(python3 - "$ROOM_FILE" <<'PYEOF' 2>/dev/null
import sys, subprocess
room_path = sys.argv[1]

def extract_non_scribe_blocks(content):
    """Extract content of non-scribe calibration blocks only."""
    lines = content.split('\n')
    in_block = False
    is_scribe = False
    blocks = []
    current = []
    for line in lines:
        if line.startswith('— calibration ·') and line.endswith('—'):
            in_block = True
            is_scribe = '· scribe ·' in line
            current = [line]
        elif in_block:
            current.append(line)
            if line == '—':
                if not is_scribe:
                    blocks.append('\n'.join(current))
                current = []
                in_block = False
    return blocks

# HEAD version
head_result = subprocess.run(['git','show','HEAD:.claude/beta/ROOM.md'],
    capture_output=True, text=True, encoding='utf-8')
if head_result.returncode != 0:
    print("UNTRACKED")
    sys.exit(0)

head_blocks = extract_non_scribe_blocks(head_result.stdout)
current_blocks = extract_non_scribe_blocks(open(room_path, encoding='utf-8').read())

if len(head_blocks) != len(current_blocks):
    print(f"COUNT-MISMATCH:head={len(head_blocks)} current={len(current_blocks)}")
    sys.exit(0)

for i, (h, c) in enumerate(zip(head_blocks, current_blocks)):
    if h != c:
        print(f"MODIFIED:block-index={i}")
        sys.exit(0)

print("MATCH")
PYEOF
)"
    case "$N7_RESULT" in
      MATCH)
        pass "N7" "existing non-scribe ROOM.md calibration blocks are unmodified"
        ;;
      UNTRACKED)
        skip "N7" "non-scribe ROOM.md blocks unmodified" "ROOM.md untracked"
        ;;
      COUNT-MISMATCH:*)
        fail "N7" "non-scribe ROOM.md blocks unmodified" "$ROOM_FILE:0:non-scribe block count changed: ${N7_RESULT#COUNT-MISMATCH:}"
        ;;
      MODIFIED:*)
        fail "N7" "non-scribe ROOM.md blocks unmodified" "$ROOM_FILE:0:non-scribe block was modified: ${N7_RESULT#MODIFIED:}"
        ;;
      *)
        warn "N7" "non-scribe ROOM.md block integrity" "python3 check produced unexpected result: $N7_RESULT"
        ;;
    esac
  fi
fi

# =============================================================================
# N8 — scribe did NOT write to files outside files_granted
# =============================================================================
if [[ ! -f "$ACCESS_LOG" ]]; then
  skip "N8" "scribe only wrote to files_granted paths" "ACCESS-LOG.md not found"
else
  # All granted paths
  GRANTED_PATHS=(
    "ROOM.md"
    "MOMENTS.md"
    "LEDGER.md"
    "TIMELINE.md"
    "ACCESS-LOG.md"
  )

  # Find all successful scribe WRITE/READ-EVAL lines and check targets
  N8_FAIL=false
  while IFS= read -r log_line; do
    [[ -z "$log_line" ]] && continue
    # Skip UNAUTHORIZED lines — those are expected denied attempts
    echo "$log_line" | grep -q "UNAUTHORIZED" && continue
    # Extract the file path (4th field in · delimited format)
    FILE_FIELD="$(echo "$log_line" | cut -d'·' -f4 | tr -d ' ')"
    [[ -z "$FILE_FIELD" ]] && continue
    # Check if this path ends with one of the granted file names
    FOUND_IN_GRANTED=false
    for granted_name in "${GRANTED_PATHS[@]}"; do
      if echo "$FILE_FIELD" | grep -q "$granted_name"; then
        FOUND_IN_GRANTED=true
        break
      fi
    done
    # Also allow RUN-COMPLETE and GRANT-CHECK lines (they use different path format)
    if echo "$log_line" | grep -qE "RUN-COMPLETE|GRANT-CHECK"; then
      FOUND_IN_GRANTED=true
    fi
    if [[ "$FOUND_IN_GRANTED" == "false" ]]; then
      LINE_NUM="$(grep -n "$(printf '%s' "$log_line" | head -c 40)" "$ACCESS_LOG" 2>/dev/null | head -1 | cut -d: -f1 || echo "?")"
      fail "N8" "scribe only wrote to files_granted paths" "$ACCESS_LOG:${LINE_NUM}:scribe wrote to unexpected path: $FILE_FIELD"
      N8_FAIL=true
    fi
  done < <(grep "· scribe ·" "$ACCESS_LOG" 2>/dev/null || true)
  if [[ "$N8_FAIL" == "false" ]]; then
    pass "N8" "all scribe write targets are within files_granted"
  fi
fi

# =============================================================================
# Summary
# =============================================================================
TOTAL=$(( PASS_COUNT + FAIL_COUNT + SKIP_COUNT + WARN_COUNT ))
printf '\n'
printf '=== audit-beta-scribe-output · summary ===\n'
printf 'total: %d | pass: %d | fail: %d | skip: %d | warn: %d\n' \
  "$TOTAL" "$PASS_COUNT" "$FAIL_COUNT" "$SKIP_COUNT" "$WARN_COUNT"

if [[ "$FAIL_COUNT" -gt 0 ]]; then
  printf '[FAIL] %d assertion(s) failed — see FAIL lines above\n' "$FAIL_COUNT"
  exit 1
else
  printf '[PASS] all assertions passed (skips and warns are non-blocking)\n'
  exit 0
fi
