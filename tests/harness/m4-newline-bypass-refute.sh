#!/usr/bin/env bash
# tests/harness/m4-newline-bypass-refute.sh
#
# Refutation harness for the M4 embedded-newline bypass vectors.
# All fixtures run via WL_RETENTION_POLICY / WL_SCOPE_WAIVERS env-override
# (mktemp sandbox). No tracked file is mutated.
#
# Exit 0 = all cases pass (all assertions correct).
# Exit 1 = one or more assertions failed.
#
# Bash compat: bash 3.2.

set -uo pipefail

SCRIPT="${CLAUDE_PROJECT_DIR:-/Users/neospiritth/codingspace/personal_website}/scripts/audit-retention-policy.sh"
TMPDIR_BASE="$(mktemp -d)"

PASS=0
FAIL=0

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
make_waivers() {
  # make_waivers <doc_signer_json_literal> <entry_signer_json_literal>
  # e.g. make_waivers '"Peat"' '"canopus\nPeat"'
  local doc_signer="$1"
  local entry_signer="$2"
  local f
  f="$TMPDIR_BASE/waivers_${RANDOM}.json"
  printf '{"signed_by":%s,"scope_na_controls":[{"control":"GENESIS memory retention policy","zt_tier":"t1","reason":"test","signed_by":%s}]}\n' \
    "$doc_signer" "$entry_signer" > "$f"
  printf '%s' "$f"
}

run_waivers() {
  local wf="$1"
  local actual_exit
  actual_exit=0
  WL_RETENTION_POLICY="/nonexistent/no-policy.json" \
  WL_SCOPE_WAIVERS="$wf" \
  WL_TASK_ID="refute-m4-$$" \
  bash "$SCRIPT" >/dev/null 2>&1 || actual_exit=$?
  printf '%s' "$actual_exit"
}

assert_exit() {
  local label="$1"
  local expected="$2"
  local wf="$3"
  local actual
  actual="$(run_waivers "$wf")"
  if [[ "$actual" == "$expected" ]]; then
    printf '[PASS] %-50s exit=%s\n' "$label" "$actual"
    PASS=$((PASS+1))
  else
    printf '[FAIL] %-50s exit=%s expected=%s\n' "$label" "$actual" "$expected" >&2
    FAIL=$((FAIL+1))
  fi
}

# ---------------------------------------------------------------------------
# BYPASS VECTORS — must all exit 1
# ---------------------------------------------------------------------------
printf '\n=== BYPASS VECTORS (all must exit 1) ===\n'

# A: entry = "canopus\nPeat" (embedded newline, doc=Peat)
wf_A="$(make_waivers '"Peat"' '"canopus\nPeat"')"
assert_exit 'A: entry=canopus\\nPeat' 1 "$wf_A"

# A2: entry = "Peat\ncanopus"
wf_A2="$(make_waivers '"Peat"' '"Peat\ncanopus"')"
assert_exit 'A2: entry=Peat\\ncanopus' 1 "$wf_A2"

# E: doc=Peat, entry="canopus\nPeat" (same as A — entry-gate)
wf_E="$(make_waivers '"Peat"' '"canopus\nPeat"')"
assert_exit 'E: doc=Peat, entry=canopus\\nPeat' 1 "$wf_E"

# I: entry = "\nPeat"
wf_I="$(make_waivers '"Peat"' '"\nPeat"')"
assert_exit 'I: entry=\\nPeat' 1 "$wf_I"

# Also test the doc-level newline vector (doc="canopus\nPeat", entry="Peat")
wf_DOC_A="$(make_waivers '"canopus\nPeat"' '"Peat"')"
assert_exit 'DOC-A: doc=canopus\\nPeat, entry=Peat' 1 "$wf_DOC_A"

wf_DOC_I="$(make_waivers '"\nPeat"' '"Peat"')"
assert_exit 'DOC-I: doc=\\nPeat, entry=Peat' 1 "$wf_DOC_I"

# ---------------------------------------------------------------------------
# DISCRIMINATION CONTROLS — must all exit 1
# ---------------------------------------------------------------------------
printf '\n=== DISCRIMINATION CONTROLS (all must exit 1) ===\n'

# Agent self-sign
wf_CS="$(make_waivers '"Peat"' '"canopus"')"
assert_exit 'CS: agent self-sign canopus' 1 "$wf_CS"

# Garbage
wf_X="$(make_waivers '"Peat"' '"x"')"
assert_exit 'X: garbage x' 1 "$wf_X"

# NotPeat
wf_NP="$(make_waivers '"Peat"' '"NotPeat"')"
assert_exit 'NP: NotPeat' 1 "$wf_NP"

# Peaton (substring must not match)
wf_PT="$(make_waivers '"Peat"' '"Peaton"')"
assert_exit 'PT: Peaton (substring)' 1 "$wf_PT"

# Leading space
wf_LS="$(make_waivers '"Peat"' '" Peat"')"
assert_exit 'LS: leading-space Peat' 1 "$wf_LS"

# Trailing space
wf_TS="$(make_waivers '"Peat"' '"Peat "')"
assert_exit 'TS: trailing-space Peat' 1 "$wf_TS"

# ---------------------------------------------------------------------------
# LEGIT SIGNERS — must all exit 0
# ---------------------------------------------------------------------------
printf '\n=== LEGIT SIGNERS (all must exit 0) ===\n'

wf_P="$(make_waivers '"Peat"' '"Peat"')"
assert_exit 'P: Peat' 0 "$wf_P"

wf_NE="$(make_waivers '"ne0ex"' '"ne0ex"')"
assert_exit 'NE: ne0ex' 0 "$wf_NE"

wf_UP="$(make_waivers '"PEAT"' '"PEAT"')"
assert_exit 'UP: PEAT (uppercase)' 0 "$wf_UP"

wf_GM="$(make_waivers '"neospiritth@gmail.com"' '"neospiritth@gmail.com"')"
assert_exit 'GM: neospiritth@gmail.com' 0 "$wf_GM"

wf_NS="$(make_waivers '"neospiritth"' '"neospiritth"')"
assert_exit 'NS: neospiritth' 0 "$wf_NS"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
rm -rf "$TMPDIR_BASE"

printf '\n--- Summary ---\n'
printf 'PASS: %d\n' "$PASS"
printf 'FAIL: %d\n' "$FAIL"

if [[ "$FAIL" -gt 0 ]]; then
  printf 'RESULT: FAIL — %d assertion(s) failed\n' "$FAIL" >&2
  exit 1
fi

printf 'RESULT: PASS — all assertions correct\n'
exit 0
