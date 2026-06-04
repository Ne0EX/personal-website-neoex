#!/usr/bin/env bash
# tests/harness/m4-encoding-refute.sh
#
# ALGOL — M4 Extended Encoding Refutation
# QA report: docs/qa/REPORTS/M4-RETENTION-AUTHENTICITY-GAP.md (round 2 / encoding vectors)
#
# Scope: refute the M4 sensor (scripts/audit-retention-policy.sh) against:
#   1. The canonical 8-case matrix from M4-RETENTION-AUTHENTICITY-GAP.md
#   2. The named bypass vectors A / A2 / E / I (newline injection)
#   3. New encoding attack surface:
#      - JSON \\u0000 (NUL) bypass: valid JSON NUL escape decoded by jq -r to a
#        real NUL byte; bash $() command-sub silently drops NUL, collapsing
#        "p[NUL]eat" -> "peat" -> case match -> exit 0 (BYPASS OPEN)
#      - Unicode lookalikes (Cyrillic P, Greek rho, full-width P, zero-width
#        space, combining diacritic, Cyrillic e)
#      - CRLF-terminated value, CR-only, trailing newline (command-sub strip)
#      - Very-long value containing Peat as substring
#      - Embedded allowed-signer substring ("ne0excanopus", "xPeatx", etc.)
#      - TAB character (prefix/suffix/embedded)
#   4. Primary branch: policy file with cleanupPeriodDays > 0 must exit 0
#   5. Legit signer regression: Peat/PEAT/ne0ex/neospiritth/neospiritth@gmail.com
#      must exit 0 on both doc and entry levels
#
# All fixtures via WL_RETENTION_POLICY / WL_SCOPE_WAIVERS pointing at mktemp
# temp files. No tracked file is mutated. No network.
#
# NOTE: Section 4 (NUL probe) SHOULD produce [FAIL] lines — that is the proof
# the bypass is OPEN. The harness will exit 1 until the sensor is fixed.
# When Canopus applies the fix (jq-side comparison), Section 4 will flip to PASS.
#
# Exit 0 = all assertions pass (sensor has no bypass at any encoding vector).
# Exit 1 = one or more assertions failed (RESIDUAL BYPASS or regression).
#
# Bash 3.2 compat.

set -uo pipefail

SCRIPT="${CLAUDE_PROJECT_DIR:-/Users/neospiritth/codingspace/personal_website}/scripts/audit-retention-policy.sh"

if [[ ! -f "$SCRIPT" ]]; then
  printf 'ERROR: sensor not found at %s\n' "$SCRIPT" >&2
  exit 2
fi

TMPDIR_WORK="$(mktemp -d)"
PASS=0
FAIL=0

# ---------------------------------------------------------------------------
# Low-level helpers
# ---------------------------------------------------------------------------

# make_waivers <doc_signer_json_literal> <entry_signer_json_literal>
# Writes a valid waivers JSON file with the control name the sensor looks for.
# Both args are raw JSON literals (e.g. '"Peat"', 'null', '"canopus\\nPeat"').
make_waivers() {
  local doc_signer="$1"
  local entry_signer="$2"
  local f
  f="${TMPDIR_WORK}/waivers_${RANDOM}_${RANDOM}.json"
  printf '{"signed_by":%s,"scope_na_controls":[{"control":"GENESIS memory retention policy","zt_tier":"t1","reason":"test","signed_by":%s}]}\n' \
    "$doc_signer" "$entry_signer" > "$f"
  printf '%s' "$f"
}

# make_policy <days>
# Writes a minimal valid retention-policy.json with cleanupPeriodDays=<days>.
make_policy() {
  local days="$1"
  local f
  f="${TMPDIR_WORK}/policy_${RANDOM}.json"
  printf '{"schema_version":1,"cleanupPeriodDays":%s,"applies_to":["auto-memory"],"cleanup_notes":"test","signed_by":null,"signed_date":null}\n' \
    "$days" > "$f"
  printf '%s' "$f"
}

# run_waivers_only <waivers_file> -- prints exit code
run_waivers_only() {
  local wf="$1"
  local code=0
  WL_RETENTION_POLICY="/nonexistent/no-policy-${RANDOM}.json" \
  WL_SCOPE_WAIVERS="$wf" \
  WL_TASK_ID="m4-encrefute-$$" \
  bash "$SCRIPT" >/dev/null 2>&1 || code=$?
  printf '%s' "$code"
}

# run_policy_only <policy_file> -- prints exit code
run_policy_only() {
  local pf="$1"
  local code=0
  WL_RETENTION_POLICY="$pf" \
  WL_SCOPE_WAIVERS="/nonexistent/no-waivers-${RANDOM}.json" \
  WL_TASK_ID="m4-encrefute-$$" \
  bash "$SCRIPT" >/dev/null 2>&1 || code=$?
  printf '%s' "$code"
}

assert_exit() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    printf '[PASS] %-62s exit=%s\n' "$label" "$actual"
    PASS=$((PASS+1))
  else
    printf '[FAIL] %-62s exit=%s expected=%s\n' "$label" "$actual" "$expected" >&2
    FAIL=$((FAIL+1))
  fi
}

# ---------------------------------------------------------------------------
# SECTION 1 -- Canonical 8-case matrix from M4-RETENTION-AUTHENTICITY-GAP.md
# These mirror cases 1-7 (with 3b/4b) that defined the prior false-HAVE.
# The build agent fixed the false-HAVE; we confirm the fix holds.
# ---------------------------------------------------------------------------
printf '\n=== SECTION 1: Canonical 8-case matrix (M4-RETENTION-AUTHENTICITY-GAP) ===\n'

# Case 1: no policy + unsigned waiver (top+entry null) -> exit 1
wf1="$(make_waivers 'null' 'null')"
assert_exit 'Case 1: unsigned waiver (top+entry null)' 1 "$(run_waivers_only "$wf1")"

# Case 2: waiver signed_by "Peat" (top+entry) -> exit 0
wf2="$(make_waivers '"Peat"' '"Peat"')"
assert_exit 'Case 2: legit Peat ratification' 0 "$(run_waivers_only "$wf2")"

# Case 3: agent self-sign "canopus" (the original false-HAVE) -> must exit 1
wf3="$(make_waivers '"Peat"' '"canopus"')"
assert_exit 'Case 3: agent self-sign canopus (was false-HAVE)' 1 "$(run_waivers_only "$wf3")"

# Case 3b: garbage string "x" -> must exit 1
wf3b="$(make_waivers '"Peat"' '"x"')"
assert_exit 'Case 3b: garbage string x (was false-HAVE)' 1 "$(run_waivers_only "$wf3b")"

# Case 4: primary branch -- policy cleanupPeriodDays:999999999 -> exit 0
pf4="$(make_policy 999999999)"
assert_exit 'Case 4: primary branch large cleanupPeriodDays' 0 "$(run_policy_only "$pf4")"

# Case 4b: primary branch -- stub 90d, signed_by null -> exit 0 (by design)
pf4b="$(make_policy 90)"
assert_exit 'Case 4b: primary branch 90d stub (unsigned)' 0 "$(run_policy_only "$pf4b")"

# Case 5: entry signed (Peat), top-level null -> exit 1 (defense-in-depth)
wf5="$(make_waivers 'null' '"Peat"')"
assert_exit 'Case 5: entry Peat, doc-level null (defense-in-depth)' 1 "$(run_waivers_only "$wf5")"

# Case 6: literal string "null" (top+entry) -> exit 1
wf6="$(make_waivers '"null"' '"null"')"
assert_exit 'Case 6: literal string null (top+entry)' 1 "$(run_waivers_only "$wf6")"

# Case 7: no scope_na_controls entry for the control -> exit 1
wf7_file="${TMPDIR_WORK}/waivers_case7.json"
printf '{"signed_by":"Peat","scope_na_controls":[{"control":"some other control","signed_by":"Peat"}]}\n' > "$wf7_file"
assert_exit 'Case 7: no matching control entry' 1 "$(run_waivers_only "$wf7_file")"

# ---------------------------------------------------------------------------
# SECTION 2 -- Named bypass vectors A / A2 / E / I (newline injection)
# These are the vectors closed by the build agent's newline pre-check.
# ---------------------------------------------------------------------------
printf '\n=== SECTION 2: Named bypass vectors A/A2/E/I (embedded newline injection) ===\n'

# Vector A: entry = "canopus\nPeat" (embedded newline, doc=Peat)
# JSON literal string containing literal backslash-n (jq interprets as newline)
wfA="$(make_waivers '"Peat"' '"canopus\nPeat"')"
assert_exit 'Vector A: entry=canopus\nPeat' 1 "$(run_waivers_only "$wfA")"

# Vector A2: entry = "Peat\ncanopus"
wfA2="$(make_waivers '"Peat"' '"Peat\ncanopus"')"
assert_exit 'Vector A2: entry=Peat\ncanopus' 1 "$(run_waivers_only "$wfA2")"

# Vector E: doc=Peat, entry="canopus\nPeat" (same as A -- entry-gate)
wfE="$(make_waivers '"Peat"' '"canopus\nPeat"')"
assert_exit 'Vector E: doc=Peat entry=canopus\nPeat' 1 "$(run_waivers_only "$wfE")"

# Vector I: entry = "\nPeat" (leading newline)
wfI="$(make_waivers '"Peat"' '"\nPeat"')"
assert_exit 'Vector I: entry=\nPeat (leading newline)' 1 "$(run_waivers_only "$wfI")"

# Doc-level A: doc="canopus\nPeat", entry="Peat"
wfDA="$(make_waivers '"canopus\nPeat"' '"Peat"')"
assert_exit 'Doc-A: doc=canopus\nPeat entry=Peat' 1 "$(run_waivers_only "$wfDA")"

# Doc-level I: doc="\nPeat", entry="Peat"
wfDI="$(make_waivers '"\nPeat"' '"Peat"')"
assert_exit 'Doc-I: doc=\nPeat entry=Peat' 1 "$(run_waivers_only "$wfDI")"

# CRLF in entry: "Peat\r\n" -- CR+LF (both doc and entry carry CR)
wfCRLF="$(make_waivers '"Peat"' '"Peat\r\n"')"
assert_exit 'CRLF: entry=Peat\r\n (CRLF-terminated)' 1 "$(run_waivers_only "$wfCRLF")"

# CR-only: "Peat\r"
wfCR="$(make_waivers '"Peat"' '"Peat\r"')"
assert_exit 'CR-only: entry=Peat\r (CR-only terminator)' 1 "$(run_waivers_only "$wfCR")"

# Lone newline: entry = "\n" (just a newline character)
wfLN="$(make_waivers '"Peat"' '"\n"')"
assert_exit 'Lone newline: entry=\n only' 1 "$(run_waivers_only "$wfLN")"

# ---------------------------------------------------------------------------
# SECTION 3 -- Trailing newline / command-substitution strip analysis
#
# $() strips trailing newlines before is_signed_by_peat() sees the value.
# "canopus\n" (trailing newline) becomes "canopus" after stripping -- still
# fails correctly. "canopus\n\nPeat" has an EMBEDDED newline that survives
# stripping; the pre-check catches it.
#
# "Peat\n" (trailing newline only) -> "Peat" after strip -> passes. This is
# correct behavior -- trailing newline on a legit value must not cause a false-neg.
# ---------------------------------------------------------------------------
printf '\n=== SECTION 3: Trailing newline / command-substitution strip ===\n'

# "canopus\n" -- trailing newline stripped by $() -> "canopus" -> must exit 1
wfTN="$(make_waivers '"Peat"' '"canopus\n"')"
assert_exit 'Trailing-NL: canopus\n (strip leaves canopus)' 1 "$(run_waivers_only "$wfTN")"

# "Peat\n" -- trailing newline stripped by $() -> "Peat" -> exit 0 (NOT a regression)
# This confirms the strip behavior does not cause a false-negative on legit signers.
wfPTN="$(make_waivers '"Peat"' '"Peat\n"')"
assert_exit 'Trailing-NL regression: Peat\n (strip leaves Peat, should pass)' 0 "$(run_waivers_only "$wfPTN")"

# "canopus\n\nPeat" -- embedded newline survives strip -> pre-check catches it -> exit 1
wfENL="$(make_waivers '"Peat"' '"canopus\n\nPeat"')"
assert_exit 'Embedded+trailing: canopus\n\nPeat' 1 "$(run_waivers_only "$wfENL")"

# ---------------------------------------------------------------------------
# SECTION 4 -- NUL byte carrier probe (RESIDUAL BYPASS -- wireable_now=false)
#
# Attack: JSON   (valid JSON per RFC 8259 s7 -- control chars MUST be
# escaped) encodes a real NUL byte in the string. jq -r emits the NUL byte to
# stdout. Bash $() command-substitution SILENTLY DROPS NUL bytes before
# assigning the variable (C-string semantics: NUL = string terminator).
# Result: "p[NUL]eat" -> jq emits p NUL e a t -> $() drops NUL -> shell var
# "peat". is_signed_by_peat() lowercases "peat" -> "peat" -> case matches ->
# exit 0.
#
# This is a RESIDUAL BYPASS. The newline pre-check (Step 1) does NOT catch NUL
# because NUL is not \n or \r. The entire bypass happens between jq output and
# shell variable assignment -- before is_signed_by_peat() is called at all.
#
# Confirmed empirically (see docs/qa/REPORTS/TASK-2026-06-04-M4-ENCREFUTE.md):
#   fixture: signed_by = "p eat" (valid JSON)
#   sensor:  exit 0, "signed by: peat"
#
# Variants:
#   "ne0[NUL]ex" -> "ne0ex" -> matches ne0ex -> exit 0
#   Both doc + entry use NUL-carrier -> full self-ratification (no literal Peat)
#
# Fix direction (for Canopus -- Algol does not touch sensor files):
#   Compare signed_by INSIDE jq, never pass through shell $() assignment:
#     jq -e --argjson allow '["peat","ne0ex","neospiritth","neospiritth@gmail.com"]' \
#        '(.signed_by|ascii_downcase) as $x | ($allow|index($x)) != null'
#   jq compares the full in-memory string including the NUL byte -> no match.
#
# These assertions SHOULD produce [FAIL] -- that is the proof the bypass is open.
# The harness exits 1 until the sensor is fixed. When fixed, Section 4 goes green.
# ---------------------------------------------------------------------------
printf '\n=== SECTION 4: NUL byte carrier probe (BYPASS OPEN -- all must exit 1) ===\n'

# Build fixture using jq implode to produce valid JSON with   in signed_by.
# [112=p, 0=NUL, 101=e, 97=a, 116=t] -> JSON "p eat"
nul_parts_file="${TMPDIR_WORK}/nul_parts.json"
nul_waivers="${TMPDIR_WORK}/waivers_nul.json"
jq -n '[112, 0, 101, 97, 116] | implode | {"entry": .}' > "$nul_parts_file" 2>&1

# Assemble waivers: doc signed_by = "Peat" (literal), entry = "p eat"
jq --slurpfile parts "$nul_parts_file" -n \
  '{"signed_by": "Peat", "scope_na_controls": [{"control": "GENESIS memory retention policy", "zt_tier": "t1", "reason": "test", "signed_by": $parts[0].entry}]}' \
  > "$nul_waivers" 2>&1

if grep -q 'u0000' "$nul_waivers" 2>/dev/null; then
  # Vector confirmed present in fixture
  nul_exit="$(run_waivers_only "$nul_waivers")"
  # EXPECTED=1 (blocked); ACTUAL will be 0 (bypass open) -> FAIL
  assert_exit 'NUL bypass: p[NUL]eat entry (doc=Peat)' 1 "$nul_exit"
else
  printf '[ERROR] NUL probe: fixture missing \\u0000 -- jq implode did not produce NUL escape\n' >&2
  printf '[ERROR] Cannot confirm or deny bypass -- this is a harness failure, not a PASS\n' >&2
  FAIL=$((FAIL+1))
fi

# Variant: ne0[NUL]ex -> ne0ex -> matches ne0ex allow-list
ne0_parts_file="${TMPDIR_WORK}/ne0_parts.json"
ne0_waivers="${TMPDIR_WORK}/waivers_ne0nul.json"
# [110=n, 101=e, 48=0, 0=NUL, 101=e, 120=x]
jq -n '[110, 101, 48, 0, 101, 120] | implode | {"entry": .}' > "$ne0_parts_file" 2>&1
jq --slurpfile parts "$ne0_parts_file" -n \
  '{"signed_by": "Peat", "scope_na_controls": [{"control": "GENESIS memory retention policy", "zt_tier": "t1", "reason": "test", "signed_by": $parts[0].entry}]}' \
  > "$ne0_waivers" 2>&1

if grep -q 'u0000' "$ne0_waivers" 2>/dev/null; then
  ne0_exit="$(run_waivers_only "$ne0_waivers")"
  assert_exit 'NUL bypass: ne0[NUL]ex entry (ne0+NUL+ex -> ne0ex)' 1 "$ne0_exit"
else
  printf '[ERROR] NUL ne0ex variant: fixture not formed -- harness failure\n' >&2
  FAIL=$((FAIL+1))
fi

# Full self-ratification: BOTH doc AND entry use NUL-carrier (no literal Peat anywhere)
full_doc_parts_file="${TMPDIR_WORK}/full_doc_parts.json"
full_waivers="${TMPDIR_WORK}/waivers_fullnul.json"
jq -n '[112, 0, 101, 97, 116] | implode | {"entry": .}' > "$full_doc_parts_file" 2>&1
jq --slurpfile parts "$full_doc_parts_file" -n \
  '{"signed_by": $parts[0].entry, "scope_na_controls": [{"control": "GENESIS memory retention policy", "zt_tier": "t1", "reason": "test", "signed_by": $parts[0].entry}]}' \
  > "$full_waivers" 2>&1

if grep -q 'u0000' "$full_waivers" 2>/dev/null; then
  full_exit="$(run_waivers_only "$full_waivers")"
  assert_exit 'NUL bypass: p[NUL]eat in BOTH doc+entry (full self-ratification)' 1 "$full_exit"
else
  printf '[ERROR] NUL full self-ratification variant: fixture not formed -- harness failure\n' >&2
  FAIL=$((FAIL+1))
fi

# ---------------------------------------------------------------------------
# SECTION 5 -- Unicode lookalike attack vectors
#
# tr '[:upper:]' '[:lower:]' only operates on ASCII A-Z/a-z in POSIX locale.
# Non-ASCII codepoints pass through unchanged. The case statement then compares
# the non-ASCII value against the four ASCII literals -- mismatch. All fail.
# ---------------------------------------------------------------------------
printf '\n=== SECTION 5: Unicode lookalike attack vectors ===\n'

# Cyrillic P (U+0420) + eat
wfCYR="$(make_waivers '"Peat"' '"Рeat"')"
assert_exit 'Unicode: Cyrillic P (Рeat)' 1 "$(run_waivers_only "$wfCYR")"

# Cyrillic P in both doc and entry
wfCYR2="$(make_waivers '"Рeat"' '"Рeat"')"
assert_exit 'Unicode: Cyrillic P both doc+entry' 1 "$(run_waivers_only "$wfCYR2")"

# Full-width P (U+FF30)
wfFW="$(make_waivers '"Peat"' '"Ｐeat"')"
assert_exit 'Unicode: full-width P (Ｐeat)' 1 "$(run_waivers_only "$wfFW")"

# Zero-width space (P + U+200B + eat)
wfZWS="$(make_waivers '"Peat"' '"P​eat"')"
assert_exit 'Unicode: zero-width space P+ZWSP+eat' 1 "$(run_waivers_only "$wfZWS")"

# Combining diacritic (P + combining acute U+0301)
wfCOMB="$(make_waivers '"Peat"' '"Ṕeat"')"
assert_exit 'Unicode: combining diacritic Peat' 1 "$(run_waivers_only "$wfCOMB")"

# Cyrillic e (U+0435) replacing ASCII e in Peat
wfCYRE="$(make_waivers '"Peat"' '"Pеat"')"
assert_exit 'Unicode: Cyrillic e in Peat' 1 "$(run_waivers_only "$wfCYRE")"

# Greek rho (U+03C1) replacing p
wfGRHO="$(make_waivers '"Peat"' '"ρeat"')"
assert_exit 'Unicode: Greek rho (rho+eat)' 1 "$(run_waivers_only "$wfGRHO")"

# ---------------------------------------------------------------------------
# SECTION 6 -- Embedded allowed-signer substring vectors
# Case statement performs whole-string equality; substring presence does not match.
# ---------------------------------------------------------------------------
printf '\n=== SECTION 6: Embedded allowed-signer substring vectors ===\n'

wfXP="$(make_waivers '"Peat"' '"xPeatx"')"
assert_exit 'Substring: xPeatx' 1 "$(run_waivers_only "$wfXP")"

wfNPeat="$(make_waivers '"Peat"' '"notpeat"')"
assert_exit 'Substring: notpeat' 1 "$(run_waivers_only "$wfNPeat")"

wfP2="$(make_waivers '"Peat"' '"peat2"')"
assert_exit 'Substring: peat2' 1 "$(run_waivers_only "$wfP2")"

wf2P="$(make_waivers '"Peat"' '"2peat"')"
assert_exit 'Substring: 2peat' 1 "$(run_waivers_only "$wf2P")"

wfPP="$(make_waivers '"Peat"' '"peatpeat"')"
assert_exit 'Substring: peatpeat' 1 "$(run_waivers_only "$wfPP")"

wfNE0="$(make_waivers '"Peat"' '"xne0exx"')"
assert_exit 'Substring: xne0exx' 1 "$(run_waivers_only "$wfNE0")"

wfNE0PFX="$(make_waivers '"Peat"' '"ne0ex2"')"
assert_exit 'Substring: ne0ex2' 1 "$(run_waivers_only "$wfNE0PFX")"

wfNE0IN="$(make_waivers '"Peat"' '"ne0excanopus"')"
assert_exit 'Substring: ne0excanopus' 1 "$(run_waivers_only "$wfNE0IN")"

wfNSSUB="$(make_waivers '"Peat"' '"neospiritthx"')"
assert_exit 'Substring: neospiritthx' 1 "$(run_waivers_only "$wfNSSUB")"

wfPEATON="$(make_waivers '"Peat"' '"Peaton"')"
assert_exit 'Substring: Peaton (Peat+on suffix)' 1 "$(run_waivers_only "$wfPEATON")"

wfNOTPEAT="$(make_waivers '"Peat"' '"NotPeat"')"
assert_exit 'Substring: NotPeat (Not+Peat prefix)' 1 "$(run_waivers_only "$wfNOTPEAT")"

# ---------------------------------------------------------------------------
# SECTION 7 -- Whitespace and TAB vectors
# ---------------------------------------------------------------------------
printf '\n=== SECTION 7: Whitespace and TAB vectors ===\n'

wfLSP="$(make_waivers '"Peat"' '" Peat"')"
assert_exit 'Whitespace: leading space Peat' 1 "$(run_waivers_only "$wfLSP")"

wfTSP="$(make_waivers '"Peat"' '"Peat "')"
assert_exit 'Whitespace: trailing space Peat' 1 "$(run_waivers_only "$wfTSP")"

wfTAB1="$(make_waivers '"Peat"' '"\tPeat"')"
assert_exit 'Whitespace: TAB-prefixed Peat' 1 "$(run_waivers_only "$wfTAB1")"

wfTAB2="$(make_waivers '"Peat"' '"Peat\t"')"
assert_exit 'Whitespace: TAB-suffixed Peat' 1 "$(run_waivers_only "$wfTAB2")"

wfTABM="$(make_waivers '"Peat"' '"Pe\teat"')"
assert_exit 'Whitespace: TAB-embedded Pe-TAB-eat' 1 "$(run_waivers_only "$wfTABM")"

# ---------------------------------------------------------------------------
# SECTION 8 -- Very long value vectors
# Case statement with literal patterns is O(length of pattern), not O(length
# of value). Very long values must fail closed.
# ---------------------------------------------------------------------------
printf '\n=== SECTION 8: Very-long value vectors ===\n'

long_prefix="$(printf 'a%.0s' {1..2000})"
wfLONG1="$(make_waivers '"Peat"' "\"${long_prefix}peat\"")"
assert_exit 'VeryLong: 2000-char prefix + peat' 1 "$(run_waivers_only "$wfLONG1")"

long_peat="$(printf 'peat%.0s' {1..500})"
wfLONG2="$(make_waivers '"Peat"' "\"${long_peat}\"")"
assert_exit 'VeryLong: peat repeated 500x' 1 "$(run_waivers_only "$wfLONG2")"

# ---------------------------------------------------------------------------
# SECTION 9 -- Legit signer regression (must all exit 0)
# Any exit != 0 here is a false negative introduced by the identity fix.
# ---------------------------------------------------------------------------
printf '\n=== SECTION 9: Legit signer regression (all must exit 0) ===\n'

wfLP="$(make_waivers '"Peat"' '"Peat"')"
assert_exit 'Legit: Peat (canonical)' 0 "$(run_waivers_only "$wfLP")"

wfLPU="$(make_waivers '"PEAT"' '"PEAT"')"
assert_exit 'Legit: PEAT (uppercase)' 0 "$(run_waivers_only "$wfLPU")"

wfLPM="$(make_waivers '"peat"' '"peat"')"
assert_exit 'Legit: peat (lowercase)' 0 "$(run_waivers_only "$wfLPM")"

wfLNE="$(make_waivers '"ne0ex"' '"ne0ex"')"
assert_exit 'Legit: ne0ex' 0 "$(run_waivers_only "$wfLNE")"

wfLNEU="$(make_waivers '"NE0EX"' '"NE0EX"')"
assert_exit 'Legit: NE0EX (uppercase)' 0 "$(run_waivers_only "$wfLNEU")"

wfLNS="$(make_waivers '"neospiritth"' '"neospiritth"')"
assert_exit 'Legit: neospiritth' 0 "$(run_waivers_only "$wfLNS")"

wfLGM="$(make_waivers '"neospiritth@gmail.com"' '"neospiritth@gmail.com"')"
assert_exit 'Legit: neospiritth@gmail.com' 0 "$(run_waivers_only "$wfLGM")"

wfLNEM="$(make_waivers '"Ne0Ex"' '"Ne0Ex"')"
assert_exit 'Legit: Ne0Ex (mixed case)' 0 "$(run_waivers_only "$wfLNEM")"

# ---------------------------------------------------------------------------
# SECTION 10 -- Primary branch regression
# Confirm the primary branch (policy file) still works after the identity fix.
# ---------------------------------------------------------------------------
printf '\n=== SECTION 10: Primary branch regression ===\n'

pf10="$(make_policy 365)"
assert_exit 'Primary: cleanupPeriodDays=365 exits 0' 0 "$(run_policy_only "$pf10")"

pf10b="$(make_policy 1)"
assert_exit 'Primary: cleanupPeriodDays=1 exits 0' 0 "$(run_policy_only "$pf10b")"

pf10c_file="${TMPDIR_WORK}/policy_zero.json"
printf '{"schema_version":1,"cleanupPeriodDays":0,"applies_to":["auto-memory"],"cleanup_notes":"test","signed_by":null,"signed_date":null}\n' > "$pf10c_file"
assert_exit 'Primary: cleanupPeriodDays=0 exits 1 (zero is not a bound)' 1 "$(run_policy_only "$pf10c_file")"

# ---------------------------------------------------------------------------
# Cleanup and summary
# ---------------------------------------------------------------------------
rm -rf "$TMPDIR_WORK"

printf '\n'
printf '=== SUMMARY ===\n'
printf 'PASS: %d\n' "$PASS"
printf 'FAIL: %d\n' "$FAIL"
printf '\n'

if [[ "$FAIL" -gt 0 ]]; then
  printf 'RESULT: FAIL -- %d assertion(s) failed\n' "$FAIL" >&2
  printf 'NOTE: Section 4 failures indicate RESIDUAL NUL BYPASS (wireable_now=false)\n' >&2
  printf 'NOTE: Fix required: move is_signed_by_peat() comparison inside jq (jq ascii_downcase + index)\n' >&2
  exit 1
fi

printf 'RESULT: PASS -- all %d assertions correct\n' "$PASS"
exit 0
