#!/usr/bin/env bash
# tests/harness/beta-persona-tracker.test.ts
# Regression test: C4 · persona-tracker.sh
#
# Coverage (from tests/harness/fixtures/thai-addressing-patterns.md, Vega V3):
#   P-01 through P-23 positive cases → correct codename detected
#   N-01 through N-12 negative cases → no codename (default persona)
#   E-01 edge case → ambient (no address match) — "บอก Vega ให้ชัด..." = relay, not address
#   E-02 edge case → address match for named codename "อยากให้ Betelgeuse อ่าน..."
#   Session mode detection (first message with "beta" → mode=beta)
#   SESSION_MODE locked after first detection (second message does not change it)
#   CURRENT_PERSONA file format: line1=codename, line2=session_mode, line3=timestamp
#   Non-blocking: hook always exits 0
#
# Usage:
#   bash tests/harness/beta-persona-tracker.test.ts
#
# Exit codes:
#   0 — all assertions passed
#   1 — one or more assertions failed

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOK="$REPO_ROOT/.claude/hooks/persona-tracker.sh"
FIXTURE="$REPO_ROOT/tests/harness/fixtures/thai-addressing-patterns.md"

PASS=0
FAIL=0

pass() { printf '[PASS] %s\n' "$1"; PASS=$((PASS+1)); }
fail() { printf '[FAIL] %s\n' "$1"; FAIL=$((FAIL+1)); }

if [[ ! -f "$HOOK" ]]; then
  printf 'FATAL: hook not found at %s\n' "$HOOK" >&2
  exit 1
fi
if [[ ! -f "$FIXTURE" ]]; then
  printf 'FATAL: fixture not found at %s\n' "$FIXTURE" >&2
  exit 1
fi

TMPDIR_RUN="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_RUN"' EXIT

FAKE_SESSIONS="$TMPDIR_RUN/.claude/sessions"
FAKE_LOG_DIR="$TMPDIR_RUN/.claude/hook-logs"
CURRENT_PERSONA_FILE="$TMPDIR_RUN/.claude/.current-persona"
mkdir -p "$FAKE_SESSIONS" "$FAKE_LOG_DIR" "$(dirname "$CURRENT_PERSONA_FILE")"

# Helper: build a UserPromptSubmit JSON payload
make_payload() {
  local prompt="$1"
  local session_id="${2:-test-session-$$}"
  jq -n --arg p "$prompt" --arg s "$session_id" '{"user_prompt": $p, "session_id": $s}'
}

# Helper: run hook from TMPDIR_RUN
run_tracker() {
  local input="$1"
  (cd "$TMPDIR_RUN" && printf '%s' "$input" | env -i \
    PATH="$PATH" \
    HOME="$HOME" \
    WL_TASK_ID="TEST-PERSONA" \
    bash "$HOOK" 2>/dev/null)
}

run_tracker_exit() {
  local input="$1"
  local exit_code=0
  (cd "$TMPDIR_RUN" && printf '%s' "$input" | env -i \
    PATH="$PATH" \
    HOME="$HOME" \
    WL_TASK_ID="TEST-PERSONA" \
    bash "$HOOK" 2>/dev/null) || exit_code=$?
  echo "$exit_code"
}

# Helper: get detected codename from .current-persona
get_current_persona() {
  head -1 "$CURRENT_PERSONA_FILE" 2>/dev/null || echo "MISSING"
}

get_session_mode() {
  sed -n '2p' "$CURRENT_PERSONA_FILE" 2>/dev/null || echo "MISSING"
}

# Write a minimal session metadata file to control SESSION_MODE
write_session_meta() {
  local session_id="$1"
  local mode="${2:-genesis}"
  local first_excerpt="${3:-null}"
  jq -n \
    --arg sid "$session_id" \
    --arg mode "$mode" \
    --arg excerpt "$first_excerpt" \
    '{
      session_id: $sid,
      mode: $mode,
      started_at: "2026-05-23T00:00:00Z",
      first_message_excerpt: (if $excerpt == "null" then null else $excerpt end),
      resolved_by: "test"
    }' > "$FAKE_SESSIONS/${session_id}.meta.json"
}

SESSION_ID="test-session-fixed"
write_session_meta "$SESSION_ID" "genesis"

# ---- Positive cases (P-01 to P-23) -----------------------------------------
# For each: run tracker with the case prompt, verify expected codename detected.

run_positive_case() {
  local case_id="$1"
  local prompt="$2"
  local expected_codename="$3"

  rm -f "$CURRENT_PERSONA_FILE"
  input="$(make_payload "$prompt" "$SESSION_ID")"
  run_tracker "$input"

  actual="$(get_current_persona | tr '[:upper:]' '[:lower:]')"
  expected_lc="$(printf '%s' "$expected_codename" | tr '[:upper:]' '[:lower:]')"

  if [[ "$actual" == "$expected_lc" ]]; then
    pass "$case_id positive: '$prompt' → detected '$actual'"
  else
    fail "$case_id positive: '$prompt' → expected '$expected_lc', got '$actual'"
  fi
}

printf '\n=== Positive cases (P-01 to P-23) ===\n'

run_positive_case "P-01" "ขอคุยกับ betelgeuse หน่อย" "betelgeuse"
run_positive_case "P-02" "betelgeuse ช่วยอยู่ให้ผมสบายใจได้มะ" "betelgeuse"
run_positive_case "P-03" "นี่ Betelgeuse ฉันเห็นแก่ตัวมากไปแล้วคืนนี้" "betelgeuse"
run_positive_case "P-04" "นี่ Vega ขอคุยเรื่องจูน signature quote เธอน่ะ เธอว่าไง" "vega"
run_positive_case "P-05" "บอก betelgeuse หน่อยว่า PoC ตัวที่อยู่บน localhost:3000 ตอนนี้มีดีเทลอะไรบ้าง" "betelgeuse"
run_positive_case "P-06" "Polaris ช่วยเช็คจนค่อนข้างลงตัวละ" "polaris"
run_positive_case "P-07" "ส่งผมลับไปหา betelgeuse หน่อย" "betelgeuse"
run_positive_case "P-08" "กลับไปหา betelgeuse ได้ ผมบอกเธออีกคนไว้แล้วว่าอัพเดทล่าสุดเป็นไง" "betelgeuse"
run_positive_case "P-09" "นี่ Betelgeuse เธออยากแต่งตัวแบบไหนวันนี้" "betelgeuse"
run_positive_case "P-10" "นี่ Betelgeuse" "betelgeuse"
run_positive_case "P-11" "Betelgeuse ช่วยดู cursor spec ให้หน่อย" "betelgeuse"
run_positive_case "P-12" "Betelgeuse จ๋า ขอ spec ตัวใหม่หน่อยได้มั้ย" "betelgeuse"
run_positive_case "P-13" "Betelgeuse จัง อยู่ช่วยเรื่องนี้ก่อนนะ" "betelgeuse"
run_positive_case "P-14" "Polaris — ขอสรุป open items ให้ผมฟังหน่อย" "polaris"
run_positive_case "P-15" "Canopus — sign-work เรื่องนี้แก้ยังไงดี" "canopus"
run_positive_case "P-16" "Algol ดูที่ signature ตัวนี้ให้หน่อย มันผ่าน SCHEMA ไหม" "algol"
run_positive_case "P-17" "Sirius เอา component นี้ไปทำใน production ได้เลยนะ" "sirius"
run_positive_case "P-18" "Arcturus ดู system prompt ให้ผมหน่อย มันยาวไปเปล่า" "arcturus"
run_positive_case "P-19" "Procyon schema ของ article มัน break เพราะอะไร" "procyon"
run_positive_case "P-20" "Altair API route ใหม่เรื่อง uploads deploy ได้ยัง" "altair"
run_positive_case "P-21" "betelgeuse รีวิว mock นี้ให้หน่อย ก่อนส่ง sirius" "betelgeuse"
run_positive_case "P-22" "ขอคุยกับ Polaris แปปนะ" "polaris"
run_positive_case "P-23" "Vega เธอว่าไง เรื่อง copy ของ observatory" "vega"

# ---- Negative cases (N-01 to N-12) -----------------------------------------
# Default persona for genesis mode = "polaris"

run_negative_case() {
  local case_id="$1"
  local prompt="$2"

  rm -f "$CURRENT_PERSONA_FILE"
  write_session_meta "$SESSION_ID" "genesis"
  input="$(make_payload "$prompt" "$SESSION_ID")"
  run_tracker "$input"

  actual="$(get_current_persona | tr '[:upper:]' '[:lower:]')"

  # In genesis mode with no specific codename detected, default is "polaris"
  # If a WRONG codename was detected, it would be the addressed agent's name
  # We check: is the result the default (polaris) rather than a false positive?
  # N cases should NOT trigger direct-address detection for the mentioned codename.

  # Determine which codename appears in the negative case and verify it wasn't detected
  detected_non_default=false
  for cn in polaris sirius altair procyon betelgeuse arcturus algol canopus vega; do
    if [[ "$actual" == "$cn" ]] && [[ "$cn" != "polaris" ]]; then
      detected_non_default=true
    fi
  done

  if ! $detected_non_default; then
    pass "$case_id negative: '$prompt' → default/polaris persona (no false match, got '$actual')"
  else
    fail "$case_id negative: '$prompt' → expected default polaris, got '$actual' (false positive)"
  fi
}

printf '\n=== Negative cases (N-01 to N-12) ===\n'

run_negative_case "N-01" "วีก้าพูดถูกค่ะ"
run_negative_case "N-02" "Polaris เป็น axis ค่ะ ไม่ขยับ"
run_negative_case "N-03" "Polaris บ่นเพราะห่วงระบบค่ะ"
run_negative_case "N-04" "Polaris ก็ต้องยอมรับตรงนั้น"
run_negative_case "N-05" "Vega เขียนสคริปต์ให้เธอบรรยายไม่หวาน"
run_negative_case "N-06" "Vega เขียนบรรทัดนั้นให้ แต่มันตรงกับวิธีที่ฉันคิดจริงๆ"
run_negative_case "N-07" "เธอนี่ตรงกว่า Polaris อีกนะ"
run_negative_case "N-08" "เบเทิลเหว่อ context เลยค่ะ — ใช้บรรทัดดีแต่ผิดจังหวะ"
run_negative_case "N-09" "ผมคงโดน Polaris บ่นแน่ว่าผมสั่งเธอให้ dispatch มั่วซั่ว"
run_negative_case "N-10" "Polaris เป็นคนแปลง directive ให้กลายเป็นสิ่งที่ฉันทำงานได้"
run_negative_case "N-11" "Quote highlight ของ Vega อีกแล้ว"
run_negative_case "N-12" "Betelgeuse ทำงาน GENESIS ต่อไป"

# ---- Edge case E-01: relay instruction → no match ---------------------------

printf '\n=== E-01 edge case: relay instruction ===\n'

# "บอก Vega ให้ชัดว่า..." = tell Vega (relay), NOT addressing Vega in this turn
# persona-tracker uses a heuristic: "บอก + codename + หน่อย" = direct address
# but "บอก + codename + ให้" (without หน่อย) = relay instruction
# E-01 should NOT match as address (expected_match: none per fixture)
rm -f "$CURRENT_PERSONA_FILE"
write_session_meta "$SESSION_ID" "genesis"
input="$(make_payload "บอก Vega ให้ชัดว่าไม่ต้องการ summary ปกติ" "$SESSION_ID")"
run_tracker "$input"

actual_e01="$(get_current_persona | tr '[:upper:]' '[:lower:]')"
# E-01 fixture says expected_match: none. The hook uses บอก+codename+หน่อย pattern (P-05 style).
# Since this case lacks "หน่อย", it may not trigger the P-05 address pattern.
# We verify it does not falsely detect as a direct-address codename other than default.
# NOTE: The hook documentation notes E-01 is partially disambiguated by the หน่อย suffix heuristic.
if [[ "$actual_e01" == "polaris" ]] || [[ "$actual_e01" == "MISSING" ]]; then
  pass "E-01: 'บอก Vega ให้ชัดว่า...' → default persona (no false Vega detection), got '$actual_e01'"
else
  # If hook detects "vega" here, it means the heuristic is not distinguishing relay vs address
  # This is documented as a known partial disambiguation in the hook
  fail "E-01: 'บอก Vega ให้ชัดว่า...' → expected no-match (default polaris), got '$actual_e01'"
fi

# ---- Edge case E-02: soft imperative → match for named codename -------------

printf '\n=== E-02 edge case: soft imperative → match ===\n'

rm -f "$CURRENT_PERSONA_FILE"
write_session_meta "$SESSION_ID" "genesis"
input="$(make_payload "อยากให้ Betelgeuse อ่านในรอบเดียว" "$SESSION_ID")"
run_tracker "$input"

actual_e02="$(get_current_persona | tr '[:upper:]' '[:lower:]')"
if [[ "$actual_e02" == "betelgeuse" ]]; then
  pass "E-02: 'อยากให้ Betelgeuse อ่านในรอบเดียว' → detected betelgeuse (soft imperative address)"
else
  fail "E-02: 'อยากให้ Betelgeuse อ่าน...' → expected betelgeuse, got '$actual_e02'"
fi

# ---- Session mode detection: first message with "beta" → mode=beta ----------

printf '\n=== Beta mode detection on first message ===\n'

BETA_SESSION="beta-session-$$"
# Write meta with mode=pending (C7 sets pending when C4 is installed)
write_session_meta "$BETA_SESSION" "pending"
# Remove first_message_excerpt = null (already null in our write)

rm -f "$CURRENT_PERSONA_FILE"
input="$(make_payload "beta ช่วย check เรื่อง memory สักหน่อย" "$BETA_SESSION")"
run_tracker "$input"

mode="$(get_session_mode)"
if [[ "$mode" == "beta" ]]; then
  pass "Beta mode detection: 'beta ...' in first message → mode=beta in .current-persona"
else
  fail "Beta mode detection: expected mode=beta, got '$mode'"
fi

# Verify session meta was also updated
meta_mode="$(jq -r '.mode' "$FAKE_SESSIONS/${BETA_SESSION}.meta.json" 2>/dev/null || echo "?")"
if [[ "$meta_mode" == "beta" ]]; then
  pass "Beta mode detection: session meta updated to mode=beta"
else
  fail "Beta mode detection: session meta mode = '$meta_mode', expected 'beta'"
fi

# ---- SESSION_MODE locked after first detection --------------------------------

printf '\n=== SESSION_MODE locked — second message does not re-lock ===\n'

# For a genesis session (already resolved), a second message with "beta" keyword
# should NOT change the mode (mode is immutable once resolved from pending)
LOCKED_SESSION="locked-session-$$"
write_session_meta "$LOCKED_SESSION" "genesis" "first message was genesis"
# first_message_excerpt is set → IS_FIRST_MESSAGE = false

rm -f "$CURRENT_PERSONA_FILE"
input="$(make_payload "beta context here" "$LOCKED_SESSION")"
run_tracker "$input"

mode_after="$(jq -r '.mode' "$FAKE_SESSIONS/${LOCKED_SESSION}.meta.json" 2>/dev/null || echo "?")"
if [[ "$mode_after" == "genesis" ]]; then
  pass "SESSION_MODE locked: second message with 'beta' does not change mode=genesis"
else
  fail "SESSION_MODE lock: mode changed from genesis to '$mode_after' on non-first message"
fi

# ---- Non-blocking: hook always exits 0 --------------------------------------

printf '\n=== Non-blocking: hook always exits 0 ===\n'

exit_code="$(run_tracker_exit "$(make_payload "some random prompt" "test-$$")")"
if [[ "$exit_code" -eq 0 ]]; then
  pass "Non-blocking: hook exits 0 on normal prompt"
else
  fail "Non-blocking: hook exited $exit_code (expected 0)"
fi

# Even with empty prompt
exit_code="$(run_tracker_exit '{"user_prompt": "", "session_id": "test-empty"}')"
if [[ "$exit_code" -eq 0 ]]; then
  pass "Non-blocking: hook exits 0 on empty prompt"
else
  fail "Non-blocking: hook exited $exit_code on empty prompt"
fi

# ---- .current-persona file format -------------------------------------------

printf '\n=== .current-persona file format ===\n'

rm -f "$CURRENT_PERSONA_FILE"
write_session_meta "$SESSION_ID" "genesis"
input="$(make_payload "Algol ช่วยดูหน่อย" "$SESSION_ID")"
run_tracker "$input"

if [[ -f "$CURRENT_PERSONA_FILE" ]]; then
  pass ".current-persona file written"
  line1="$(sed -n '1p' "$CURRENT_PERSONA_FILE")"
  line2="$(sed -n '2p' "$CURRENT_PERSONA_FILE")"
  line3="$(sed -n '3p' "$CURRENT_PERSONA_FILE")"

  if [[ -n "$line1" ]]; then
    pass ".current-persona line 1 (codename) present: '$line1'"
  else
    fail ".current-persona line 1 (codename) empty"
  fi

  if [[ -n "$line2" ]]; then
    pass ".current-persona line 2 (session_mode) present: '$line2'"
  else
    fail ".current-persona line 2 (session_mode) empty"
  fi

  if [[ -n "$line3" ]]; then
    pass ".current-persona line 3 (timestamp) present: '$line3'"
  else
    fail ".current-persona line 3 (timestamp) empty"
  fi
else
  fail ".current-persona file not written after hook run"
fi

# ---- summary ----------------------------------------------------------------

printf '\n=== beta-persona-tracker regression summary ===\n'
printf 'PASS: %d   FAIL: %d\n' "$PASS" "$FAIL"

if [[ "$FAIL" -eq 0 ]]; then
  printf '\nAll scenarios passed.\n'
  exit 0
else
  printf '\n%d scenario(s) failed — see [FAIL] lines above.\n' "$FAIL"
  exit 1
fi
