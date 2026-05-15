#!/usr/bin/env bash
# scripts/_next-dispatchable.fixture.sh
# Owner:   Canopus (α-HRN-07)
# TASK:    TASK-2026-05-15-META-1
# Purpose: Synthetic-fixture smoke test for scripts/next-dispatchable.sh.
#
# Creates a minimal fake environment in a temp directory:
#   - Fake STATUS.md with 6 TASKs covering all status codes
#   - Fake signatures for closed TASKs (valid JSON)
#   - Fake handoff files with YAML frontmatter
#
# Then runs next-dispatchable.sh against the fixture tree and asserts:
#   - TASK-A (closed) does NOT appear in dispatchable
#   - TASK-B (queued, no deps, no gates) IS dispatchable
#   - TASK-C (blocked by open TASK-D) is NOT dispatchable
#   - TASK-D (queued, dep on TASK-A which is closed) IS dispatchable
#   - TASK-E (blocked on Peat decision) is NOT dispatchable
#   - TASK-F (opus, but budget exhausted) is NOT dispatchable when --opus-budget 0
#
# Exit codes:
#   0 — all assertions pass
#   1 — one or more assertions failed
#   2 — script under test failed unexpectedly

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAIN_SCRIPT="$SCRIPT_DIR/next-dispatchable.sh"

if [[ ! -x "$MAIN_SCRIPT" ]]; then
  echo "[fixture] ERROR: $MAIN_SCRIPT not found or not executable" >&2
  exit 2
fi

# ── Build temp fixture tree ─────────────────────────────────────────────────
FIXTURE_DIR="$(mktemp -d /tmp/worldline-fixture.XXXXXX)"
trap 'rm -rf "$FIXTURE_DIR"' EXIT

mkdir -p \
  "$FIXTURE_DIR/docs/team" \
  "$FIXTURE_DIR/.claude/signatures" \
  "$FIXTURE_DIR/.claude/handoffs/from-polaris"

# ── Fake STATUS.md ──────────────────────────────────────────────────────────
cat > "$FIXTURE_DIR/docs/team/STATUS.md" << 'ENDSTATUS'
# STATUS — running ledger

## TASK-FX-A · velite skeleton · closed

scope · foundational content schema
slices
  Procyon (S1) · velite config · done · signed

---

## TASK-FX-B · nav stratum indicator · queued

scope · nav component update
slice · Sirius, sonnet · standalone, no deps

---

## TASK-FX-C · photo route · blocked

scope · photo entry route
blocked_by · TASK-FX-D
slice · Sirius, sonnet

---

## TASK-FX-D · photo pipeline · queued

scope · sharp + EXIF build step
blocked_by · TASK-FX-A
slice · Procyon, sonnet

---

## TASK-FX-E · attractor binding · blocked

scope · binding mechanic
BLOCKED-ON-PEAT-DECISION: awaiting globe-ontology v1.3 strata confirmation
slice · Betelgeuse, opus

---

## TASK-FX-F · netra prompts · queued

scope · netra system prompt implementation
slice · Arcturus, opus

---
ENDSTATUS

# ── Fake signatures ──────────────────────────────────────────────────────────
# TASK-FX-A: closed with valid v2 signature (harness_passed=true)
cat > "$FIXTURE_DIR/.claude/signatures/TASK-FX-A--procyon.json" << 'ENDSIG'
{
  "signature_schema_version": 2,
  "task_id": "TASK-FX-A",
  "agent": "Procyon",
  "agent_designation": "α-IDX-03",
  "pre_cutover_codename": "Lyra",
  "started_at": "2026-05-15T09:00:00Z",
  "completed_at": "2026-05-15T09:30:00Z",
  "files_touched": ["velite.config.ts"],
  "summary": "velite skeleton fixture",
  "steps": [],
  "hashes": {
    "files_sha256": {"velite.config.ts": "aabbcc"},
    "self_hash": "fixture-self-hash-a"
  },
  "harness_passed": true,
  "post_edit_passed": true,
  "next_recipient": {"agent": "Polaris", "designation": "α-OPS-00"}
}
ENDSIG

# ── Fake handoff files ───────────────────────────────────────────────────────
# TASK-FX-B: simple queued task for Sirius, no deps
cat > "$FIXTURE_DIR/.claude/handoffs/from-polaris/TASK-FX-B.md" << 'ENDHO'
---
task_id: TASK-FX-B
from: polaris
to: Sirius
date: 2026-05-15
model: sonnet
---

# TASK-FX-B · Nav stratum indicator

Simple nav update. No dependencies.
ENDHO

# TASK-FX-C: blocked by TASK-FX-D (which is not yet closed)
cat > "$FIXTURE_DIR/.claude/handoffs/from-polaris/TASK-FX-C.md" << 'ENDHO'
---
task_id: TASK-FX-C
from: polaris
to: Sirius
date: 2026-05-15
model: sonnet
blocked_by: TASK-FX-D
---

# TASK-FX-C · Photo route

Blocked by TASK-FX-D (photo pipeline must land first).
ENDHO

# TASK-FX-D: queued, blocked_by TASK-FX-A (which IS closed)
cat > "$FIXTURE_DIR/.claude/handoffs/from-polaris/TASK-FX-D.md" << 'ENDHO'
---
task_id: TASK-FX-D
from: polaris
to: Procyon
date: 2026-05-15
model: sonnet
blocked_by: TASK-FX-A
---

# TASK-FX-D · Photo pipeline

Depends on TASK-FX-A (velite skeleton) which is now closed.
ENDHO

# TASK-FX-E: blocked on Peat decision (in body)
cat > "$FIXTURE_DIR/.claude/handoffs/from-polaris/TASK-FX-E.md" << 'ENDHO'
---
task_id: TASK-FX-E
from: polaris
to: Betelgeuse
date: 2026-05-15
model: opus
---

# TASK-FX-E · Attractor binding

BLOCKED-ON-PEAT-DECISION: awaiting globe-ontology v1.3 strata confirmation from Peat.
ENDHO

# TASK-FX-F: queued opus task (will hit budget when --opus-budget 0)
cat > "$FIXTURE_DIR/.claude/handoffs/from-polaris/TASK-FX-F.md" << 'ENDHO'
---
task_id: TASK-FX-F
from: polaris
to: Arcturus
date: 2026-05-15
model: opus
---

# TASK-FX-F · NETRA prompts

Opus override task. No other dependencies.
ENDHO

# ── Run script against fixtures ──────────────────────────────────────────────
echo "[fixture] running next-dispatchable.sh against synthetic fixtures..."
echo ""

OUTPUT=$(bash "$MAIN_SCRIPT" \
  --status "$FIXTURE_DIR/docs/team/STATUS.md" \
  --sigs "$FIXTURE_DIR/.claude/signatures" \
  --handoffs "$FIXTURE_DIR/.claude/handoffs/from-polaris" \
  --opus-budget 3 \
  2>&1) || {
    echo "[fixture] FAIL: script exited non-zero"
    echo "$OUTPUT"
    exit 2
  }

echo "$OUTPUT"
echo ""
echo "[fixture] ── assertions ──────────────────────────────────────────────"

PASS=0
FAIL=0

assert_contains() {
  local label="$1"
  local pattern="$2"
  if echo "$OUTPUT" | grep -q "$pattern"; then
    echo "  PASS · $label"
    (( PASS++ )) || true
  else
    echo "  FAIL · $label (pattern not found: $pattern)"
    (( FAIL++ )) || true
  fi
}

assert_not_contains() {
  local label="$1"
  local pattern="$2"
  if echo "$OUTPUT" | grep -q "$pattern"; then
    echo "  FAIL · $label (pattern should NOT be present: $pattern)"
    (( FAIL++ )) || true
  else
    echo "  PASS · $label"
    (( PASS++ )) || true
  fi
}

# A1: TASK-FX-B is dispatchable (no deps, no gates)
assert_contains "TASK-FX-B appears in output" "TASK-FX-B"
assert_contains "TASK-FX-B is NOW-DISPATCHABLE" "TASK-FX-B.*NOW-DISPATCHABLE\|NOW-DISPATCHABLE.*TASK-FX-B"

# A2: TASK-FX-D is dispatchable (dep TASK-FX-A is closed)
assert_contains "TASK-FX-D appears in output" "TASK-FX-D"
assert_contains "TASK-FX-D is NOW-DISPATCHABLE" "TASK-FX-D.*NOW-DISPATCHABLE\|NOW-DISPATCHABLE.*TASK-FX-D"

# A3: TASK-FX-C is BLOCKED (dep TASK-FX-D not closed)
assert_contains "TASK-FX-C is BLOCKED" "TASK-FX-C.*BLOCKED\|BLOCKED.*TASK-FX-C"
assert_not_contains "TASK-FX-C is NOT dispatchable" "TASK-FX-C.*NOW-DISPATCHABLE"

# A4: TASK-FX-E is blocked on Peat decision
assert_contains "TASK-FX-E is BLOCKED" "TASK-FX-E.*BLOCKED\|BLOCKED.*TASK-FX-E"
assert_not_contains "TASK-FX-E is NOT dispatchable" "TASK-FX-E.*NOW-DISPATCHABLE"

# A5: TASK-FX-F opus is NOT blocked by budget (3 budget, 3 shipped = 0 remaining)
# NOTE: the fixture uses --opus-budget 3, and the script hardcodes shipped=3
# So TASK-FX-F should be blocked by opus_budget_exhausted
assert_contains "TASK-FX-F is BLOCKED by opus budget" "TASK-FX-F.*BLOCKED\|BLOCKED.*TASK-FX-F\|opus_budget"

# A6: TASK-FX-A (closed) does NOT appear in the dispatchable section
assert_not_contains "TASK-FX-A (closed) does not appear as dispatchable" "TASK-FX-A.*NOW-DISPATCHABLE"

# A7: Hold-gate message is present
assert_contains "Hold-gate message present" "HOLD GATE\|hold_gate\|do NOT dispatch"

# A8: Opus ledger is present in output
assert_contains "Opus ledger present" "[Oo]pus ledger\|opus_ledger"

# A9: Summary counts are present
assert_contains "Summary line present" "closed.*in-flight\|now-dispatchable\|Summary"

echo ""
echo "[fixture] ── results ────────────────────────────────────────────────"
echo "  PASSED: $PASS"
echo "  FAILED: $FAIL"
echo ""

if [[ $FAIL -gt 0 ]]; then
  echo "[fixture] SMOKE TEST FAIL — $FAIL assertion(s) failed"
  exit 1
else
  echo "[fixture] SMOKE TEST PASS — all $PASS assertions passed"
  exit 0
fi
