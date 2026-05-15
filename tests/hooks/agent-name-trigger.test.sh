#!/usr/bin/env bash
# Test cases for .claude/hooks/agent-name-trigger.sh
set -u

HOOK=".claude/hooks/agent-name-trigger.sh"
PASS=0
FAIL=0

run_case() {
  local label="$1"
  local input="$2"
  local expect_match="$3"
  local out
  out=$(printf '%s' "$input" | bash "$HOOK" 2>&1 || true)
  if printf '%s' "$out" | grep -qF "$expect_match"; then
    echo "PASS · $label"
    PASS=$((PASS + 1))
  else
    echo "FAIL · $label · expected '$expect_match' in output"
    echo "  got: $out"
    FAIL=$((FAIL + 1))
  fi
}

run_json_case() {
  local label="$1"
  local prompt="$2"
  local expect_match="$3"
  local out
  out=$(python3 -c 'import json,sys; print(json.dumps({"prompt": sys.argv[1]}))' "$prompt" | bash "$HOOK" 2>&1 || true)
  if printf '%s' "$out" | grep -qF "$expect_match"; then
    echo "PASS · $label"
    PASS=$((PASS + 1))
  else
    echo "FAIL · $label · expected '$expect_match' in output"
    echo "  got: $out"
    FAIL=$((FAIL + 1))
  fi
}

run_silent() {
  local label="$1"
  local input="$2"
  local out
  out=$(printf '%s' "$input" | bash "$HOOK" 2>&1 || true)
  if [ -z "$out" ]; then
    echo "PASS · $label (silent)"
    PASS=$((PASS + 1))
  else
    echo "FAIL · $label · expected silence, got: $out"
    FAIL=$((FAIL + 1))
  fi
}

run_case "vocative TH titlecase" "Polaris จัง สวัสดี" "agent-voice-protocol"
run_case "vocative TH lowercase" "ขอคุยกับ polaris หน่อย" "Peat addressed 'Polaris'"
run_case "vocative EN" "Polaris, how are you?" "agent-voice-protocol"
run_case "prefix" "พี่ Polaris ตอนนี้ทำอะไร" "agent-voice-protocol"
run_case "Sirius EN" "Sirius — show me a layout" "Peat addressed 'Sirius'"
for agent in Polaris Sirius Altair Procyon Betelgeuse Arcturus Algol Canopus Vega; do
  run_case "roster · $agent" "$agent ช่วยดูหน่อย" "Peat addressed '$agent'"
done
run_case "pre-cutover Mira" "Mira สวัสดี" "pre-cutover 'Mira' detected"
run_json_case "Codex JSON prompt" "Canopus ตั้ง hooks ให้ที" "Peat addressed 'Canopus'"
run_silent "no match" "what's the weather"
run_silent "prose mention" "Polaris's territory is .claude/handoffs"

echo "---"
echo "$PASS pass · $FAIL fail"
[ "$FAIL" -eq 0 ]
