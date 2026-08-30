#!/usr/bin/env bash
# .claude/hooks/persona-tracker.sh
# UserPromptSubmit hook — detects which GENESIS agent (or Beta) is being
# addressed in each user prompt, writes .claude/.current-persona, AND
# (merged from beta-context-inject.sh) emits companion overlay injection
# to stdout when SESSION_MODE=beta on the first un-injected prompt.
#
# WHY MERGED (TASK-2026-05-23-BETA-INJECTION-HOOK / REVISE-3):
# Claude Code v2.1.x runs UserPromptSubmit hooks in parallel. When
# beta-context-inject.sh ran as a separate hook, it read .current-persona
# before this hook had written it, causing stale polaris/genesis reads and
# [SKIP] on valid beta sessions. Merging detection + injection into one
# script eliminates the race entirely. beta-context-inject.sh is now a
# silent stub (always exit 0, no stdout, no logic).
#
# Two-layer model
# ---------------
# SESSION_MODE (from C7's session metadata)
#   - Locked at SessionStart (immutable for session lifetime)
#   - Written by session-start.sh to .claude/sessions/<session-id>.meta.json
#   - Values: "beta" | "genesis" | "pending"
#
# CURRENT_PERSONA (written by this hook)
#   - Mutable — updated on every user prompt
#   - Defaults to the persona-of-SESSION_MODE (polaris for genesis; beta for beta)
#   - Overridden when Peat directly addresses an agent by codename in the prompt
#
# Detection logic (from Vega V3 fixture tests/harness/fixtures/thai-addressing-patterns.md)
# ------------------------------------------------------------------------------------------
# PRIMARY SIGNALS (direct address):
#   - นี่ + Codename                          → direct address (vocative opener)
#   - Codename + ช่วย                          → direct address (help request)
#   - Codename + จ๋า                           → direct address (affectionate)
#   - Codename + จัง                           → direct address (endearment)
#   - Codename + — (dash as address marker)   → direct address
#   - Codename at start + task verb/question   → direct address (bare start)
#   - ขอคุยกับ + Codename                       → direct address (explicit switch)
#   - ไปหา + Codename                          → direct address (routing)
#   - กลับไปหา + Codename                      → direct address (re-route)
#   - ส่งไปหา + Codename                       → direct address (handoff)
#   - อยากให้ + Codename + verb                → soft imperative (address if active agent)
#
# NEGATIVE SIGNALS (ambient mention, not address):
#   - Codename + เป็น                          → third-person predicate
#   - Codename + บ่น                           → third-person action verb
#   - Codename + เขียน                         → third-person attribution
#   - ของ + Codename                           → possessive/genitive
#   - กว่า + Codename                          → comparative reference
#   - Thai diminutives (เบเทิล, วีก้า, etc.)  → ambient self-reference
#
# CASE SENSITIVITY:
#   - codenames case-insensitive for matching
#   - Thai diminutives matched as explicit negative patterns
#
# BETA MODE DETECTION (for SESSION_MODE, first message only):
#   - "beta" / "เบต้า" / "Betelgeuse Chan" (case-insensitive) → SESSION_MODE=beta
#
# On fail: exits 0 (never blocks the prompt — this is observability infrastructure)
# On success: writes .claude/.current-persona as JSON
#
# Called by: .claude/settings.json UserPromptSubmit hook block
# Do not call directly.

set -uo pipefail
# NOTE: deliberately NOT using -e (errexit) here.
# This hook must never block the prompt. Every code path ends with exit 0.
# We use an ERR trap instead to log failures and bail gracefully.

# =============================================================================
# Working-directory guard: hooks may run from any cwd; anchor to repo root.
# =============================================================================
_REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$_REPO_ROOT"

SESSIONS_DIR=".claude/sessions"
CURRENT_PERSONA_FILE=".claude/.current-persona"
LOG_DIR=".claude/hook-logs"
mkdir -p "$LOG_DIR" "$SESSIONS_DIR" "$(dirname "$CURRENT_PERSONA_FILE")"

TASK_ID="${CLAUDE_TASK_ID:-${WL_TASK_ID:-session-$(date +%s)}}"
TIMESTAMP="$(date -u +%FT%TZ)"
LOG="$LOG_DIR/${TASK_ID}--persona-tracker.log"

# =============================================================================
# ENTRY LOG — must be the first I/O operation; proves the hook ran at all.
# =============================================================================
printf '%s · [ENTRY] persona-tracker.sh started · TASK_ID=%s\n' \
  "$TIMESTAMP" "$TASK_ID" >> "$LOG" 2>/dev/null || true

# =============================================================================
# Error trap: if anything unexpectedly errors, log it and exit 0.
# This prevents set -uo pipefail from silently killing the hook.
# =============================================================================
_trap_error() {
  local line="${1:-?}"
  printf '%s · [ERROR] unexpected exit at line %s — hook bailed safely\n' \
    "$TIMESTAMP" "$line" >> "$LOG" 2>/dev/null || true
  exit 0
}
trap '_trap_error $LINENO' ERR

# ----------------------------------------------------------------------------
# Parse tool input from stdin
# UserPromptSubmit sends JSON on stdin. The field containing the user's prompt
# text varies by Claude Code version — see FIELD-PROBE block below.
# We must drain stdin before doing anything else, or the hook errors silently.
# ----------------------------------------------------------------------------
INPUT=""
if [[ -t 0 ]]; then
  # stdin is a terminal — no payload (direct invocation for testing)
  INPUT=""
else
  INPUT="$(cat 2>/dev/null || true)"
fi

printf '%s · [STDIN] input_length=%s\n' "$TIMESTAMP" "${#INPUT}" >> "$LOG" 2>/dev/null || true

if [[ -z "$INPUT" ]]; then
  printf '%s · [EXIT] empty stdin — pass through\n' "$TIMESTAMP" >> "$LOG" 2>/dev/null || true
  exit 0
fi

# ----------------------------------------------------------------------------
# DEBUG DUMP — write first 500 chars of raw JSON to debug log so the actual
# field names are visible if the prompt extraction fails again.
# This log is safe to leave enabled permanently (truncated, no secrets at risk
# beyond what the hook already processes). Canopus reads it to verify fix.
# Debug log: .claude/hook-logs/<session>--persona-tracker-debug.log
# ----------------------------------------------------------------------------
DEBUG_LOG="$LOG_DIR/${TASK_ID}--persona-tracker-debug.log"
printf '%s · [DEBUG] raw_input_truncated=%s\n' \
  "$TIMESTAMP" "$(printf '%s' "$INPUT" | cut -c1-500)" >> "$DEBUG_LOG" 2>/dev/null || true

# ----------------------------------------------------------------------------
# Extract user prompt and session_id from JSON.
#
# FIELD NAME PROBE — Claude Code v2.1.x UserPromptSubmit event uses a different
# field name than the expected "user_prompt". We probe all plausible candidates
# in priority order; the first non-empty result wins. A [FIELD-PROBE] log line
# records which field name succeeded so the correct name is confirmed on first
# live run and this multi-probe can be simplified.
#
# Candidate priority (most-to-least likely based on Claude Code naming patterns):
#   1. prompt          — direct match to event name "UserPromptSubmit"
#   2. user_prompt     — original assumption (was wrong in v2.1.x)
#   3. message         — message-passing convention
#   4. user_message    — explicit user-scoped variant
#   5. content         — generic content field
#   6. text            — minimal text field
#   7. prompt.text     — nested form
#   8. prompt.content  — nested form
# ----------------------------------------------------------------------------
USER_PROMPT=""
HOOK_SESSION_ID=""
PROMPT_FIELD_FOUND=""

if command -v python3 >/dev/null 2>&1; then
  # Single pass: probe all candidates, return first non-empty hit + the field name
  _PROBE_RESULT="$(printf '%s' "$INPUT" | python3 -c '
import json, sys

d = json.load(sys.stdin)

# flat-key candidates in priority order
candidates = ["prompt", "user_prompt", "message", "user_message", "content", "text"]
for key in candidates:
    val = d.get(key, "")
    if val and str(val).strip():
        print(key + "|||" + str(val))
        sys.exit(0)

# nested candidates: prompt.text, prompt.content
nested_parent = d.get("prompt")
if isinstance(nested_parent, dict):
    for subkey in ["text", "content"]:
        val = nested_parent.get(subkey, "")
        if val and str(val).strip():
            print("prompt." + subkey + "|||" + str(val))
            sys.exit(0)

# nothing found — emit sentinel
print("NOT_FOUND|||")
' 2>/dev/null || true)"

  if [[ -n "$_PROBE_RESULT" && "$_PROBE_RESULT" != "NOT_FOUND|||" ]]; then
    PROMPT_FIELD_FOUND="${_PROBE_RESULT%%|||*}"
    USER_PROMPT="${_PROBE_RESULT#*|||}"
  fi

  HOOK_SESSION_ID="$(printf '%s' "$INPUT" | python3 -c \
    'import json,sys; d=json.load(sys.stdin); print(d.get("session_id",""))' 2>/dev/null || true)"
fi

# jq fallback — same candidate probe, only runs if python3 missed
if [[ -z "$USER_PROMPT" ]] && command -v jq >/dev/null 2>&1; then
  for _candidate in prompt user_prompt message user_message content text; do
    _val="$(printf '%s' "$INPUT" | jq -r --arg k "$_candidate" '.[$k] // ""' 2>/dev/null || true)"
    if [[ -n "$_val" ]]; then
      USER_PROMPT="$_val"
      PROMPT_FIELD_FOUND="$_candidate (jq-fallback)"
      break
    fi
  done
  # jq nested probe
  if [[ -z "$USER_PROMPT" ]]; then
    for _subkey in text content; do
      _val="$(printf '%s' "$INPUT" | jq -r --arg k "$_subkey" '.prompt[$k] // ""' 2>/dev/null || true)"
      if [[ -n "$_val" ]]; then
        USER_PROMPT="$_val"
        PROMPT_FIELD_FOUND="prompt.${_subkey} (jq-fallback)"
        break
      fi
    done
  fi
fi

if [[ -z "$HOOK_SESSION_ID" ]] && command -v jq >/dev/null 2>&1; then
  HOOK_SESSION_ID="$(printf '%s' "$INPUT" | jq -r '.session_id // ""' 2>/dev/null || true)"
fi

# Log which field name won (or that none matched)
if [[ -n "$PROMPT_FIELD_FOUND" ]]; then
  printf '%s · [FIELD-PROBE] prompt extracted from field=%s\n' \
    "$TIMESTAMP" "$PROMPT_FIELD_FOUND" >> "$LOG" 2>/dev/null || true
else
  printf '%s · [FIELD-PROBE] no prompt field found — all candidates returned empty\n' \
    "$TIMESTAMP" >> "$LOG" 2>/dev/null || true
  # Also dump top-level keys to debug log for diagnosis
  if command -v python3 >/dev/null 2>&1; then
    _KEYS="$(printf '%s' "$INPUT" | python3 -c \
      'import json,sys; d=json.load(sys.stdin); print(list(d.keys()))' 2>/dev/null || true)"
    printf '%s · [FIELD-PROBE] top-level keys=%s\n' "$TIMESTAMP" "$_KEYS" \
      >> "$DEBUG_LOG" 2>/dev/null || true
  fi
fi

# Canonical session ID (same priority order as session-start.sh):
#   1st · from hook event JSON
#   2nd · CLAUDE_SESSION_ID env
#   3rd · "unknown" (meta lookup will miss, mode defaults to genesis)
SESSION_ID="${HOOK_SESSION_ID:-${CLAUDE_SESSION_ID:-unknown}}"

printf '%s · [PARSE] session_id=%s · prompt_length=%s · field=%s\n' \
  "$TIMESTAMP" "$SESSION_ID" "${#USER_PROMPT}" "${PROMPT_FIELD_FOUND:-none}" \
  >> "$LOG" 2>/dev/null || true

# If no prompt, pass through
if [[ -z "$USER_PROMPT" ]]; then
  printf '%s · [EXIT] empty user_prompt — pass through\n' "$TIMESTAMP" >> "$LOG" 2>/dev/null || true
  exit 0
fi

# ----------------------------------------------------------------------------
# Load session metadata (C7)
# ----------------------------------------------------------------------------
SESSION_META=""
META_FILE="$SESSIONS_DIR/${SESSION_ID}.meta.json"

if [[ -f "$META_FILE" ]]; then
  SESSION_META="$(cat "$META_FILE" 2>/dev/null || true)"
  printf '%s · [META] found=%s\n' "$TIMESTAMP" "$META_FILE" >> "$LOG" 2>/dev/null || true
else
  printf '%s · [META] not found: %s — mode will default to genesis\n' \
    "$TIMESTAMP" "$META_FILE" >> "$LOG" 2>/dev/null || true
fi

SESSION_MODE="genesis"
IS_FIRST_MESSAGE=false
FIRST_EXCERPT="null"  # default; overridden below if meta is available

if [[ -n "$SESSION_META" ]]; then
  if command -v jq >/dev/null 2>&1; then
    SESSION_MODE="$(printf '%s' "$SESSION_META" | jq -r '.mode // "genesis"' 2>/dev/null || echo "genesis")"
    FIRST_EXCERPT="$(printf '%s' "$SESSION_META" | jq -r '.first_message_excerpt // "null"' 2>/dev/null || echo "null")"
  elif command -v python3 >/dev/null 2>&1; then
    SESSION_MODE="$(printf '%s' "$SESSION_META" | python3 -c \
      'import json,sys; d=json.load(sys.stdin); print(d.get("mode","genesis"))' 2>/dev/null || echo "genesis")"
    FIRST_EXCERPT="$(printf '%s' "$SESSION_META" | python3 -c \
      'import json,sys; d=json.load(sys.stdin); v=d.get("first_message_excerpt"); print("null" if v is None else v)' 2>/dev/null || echo "null")"
  fi
  [[ "$FIRST_EXCERPT" == "null" ]] && IS_FIRST_MESSAGE=true
fi

printf '%s · [MODE] session_mode=%s · is_first_message=%s\n' \
  "$TIMESTAMP" "$SESSION_MODE" "$IS_FIRST_MESSAGE" >> "$LOG" 2>/dev/null || true

# ----------------------------------------------------------------------------
# Beta mode detection (first message only — locks SESSION_MODE)
# Match: beta / เบต้า / Betelgeuse Chan (case-insensitive)
# tr '[:upper:]' '[:lower:]' is ASCII-only; Thai is unaffected (stays as-is).
# The grep -iE pattern handles both cases.
# ----------------------------------------------------------------------------
if [[ "$IS_FIRST_MESSAGE" == "true" ]] && [[ "$SESSION_MODE" == "pending" ]]; then
  printf '%s · [BETA-DETECT] running beta pattern match on first message\n' \
    "$TIMESTAMP" >> "$LOG" 2>/dev/null || true

  if printf '%s' "$USER_PROMPT" \
    | grep -qiE '(^|[^[:alnum:]_])beta([^[:alnum:]_]|$)|เบต้า|(^|[^[:alnum:]_])betelgeuse[[:space:]]+chan([^[:alnum:]_]|$)'; then
    SESSION_MODE="beta"
    printf '%s · [BETA-DETECT] MATCH → mode=beta\n' "$TIMESTAMP" >> "$LOG" 2>/dev/null || true
  else
    SESSION_MODE="genesis"
    printf '%s · [BETA-DETECT] no match → mode=genesis\n' "$TIMESTAMP" >> "$LOG" 2>/dev/null || true
  fi

  # Update session metadata with resolved mode and first_message_excerpt
  if [[ -f "$META_FILE" ]] && command -v python3 >/dev/null 2>&1; then
    EXCERPT="$(printf '%s' "$USER_PROMPT" | cut -c1-120)"
    python3 - "$META_FILE" "$SESSION_MODE" "$EXCERPT" <<'PYEOF'
import json, sys
meta_file = sys.argv[1]
new_mode = sys.argv[2]
excerpt = sys.argv[3][:120]
try:
    with open(meta_file, "r") as f:
        meta = json.load(f)
    meta["mode"] = new_mode
    meta["first_message_excerpt"] = excerpt
    meta["resolved_by"] = "persona-tracker"
    with open(meta_file, "w") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
        f.write("\n")
except Exception as e:
    import sys as _sys
    print(f"persona-tracker meta update error: {e}", file=_sys.stderr)
    sys.exit(0)  # never block
PYEOF
    printf '%s · [META-UPDATE] wrote resolved mode=%s to %s\n' \
      "$TIMESTAMP" "$SESSION_MODE" "$META_FILE" >> "$LOG" 2>/dev/null || true
  else
    printf '%s · [META-UPDATE] skipped (no meta file or no python3) meta_exists=%s\n' \
      "$TIMESTAMP" "$( [[ -f "$META_FILE" ]] && echo "yes" || echo "no" )" \
      >> "$LOG" 2>/dev/null || true
  fi
fi

# ----------------------------------------------------------------------------
# Codename addressing detection
# Roster codenames (lowercase) — extend here if roster grows
# ----------------------------------------------------------------------------
CODENAMES=(polaris sirius altair procyon betelgeuse arcturus algol canopus vega)

# ---- Negative pattern guard (check BEFORE positive matching) ----
# If the prompt is clearly third-person (Thai diminutives, comparative/possessive patterns),
# skip positive matching entirely.
NEGATIVE_THAI_DIM_PATTERN='เบเทิล|วีก้า|อาร์ทุ'  # known Thai ambient diminutives

IS_NEGATIVE=false
if printf '%s' "$USER_PROMPT" | grep -qE "$NEGATIVE_THAI_DIM_PATTERN"; then
  IS_NEGATIVE=true
  printf '%s · [CODENAME] negative pattern matched — skipping positive match\n' \
    "$TIMESTAMP" >> "$LOG" 2>/dev/null || true
fi

# ---- Positive pattern matching ----
DETECTED_CODENAME=""

if [[ "$IS_NEGATIVE" == "false" ]]; then
  LOWER_PROMPT_FOR_MATCH="$(printf '%s' "$USER_PROMPT" | tr '[:upper:]' '[:lower:]')"

  for codename in "${CODENAMES[@]}"; do
    # Pattern group 1: vocative openers — นี่ + codename
    if printf '%s' "$USER_PROMPT" | grep -qiE "นี่[[:space:]]+${codename}"; then
      DETECTED_CODENAME="$codename"; break
    fi

    # Pattern group 2: codename + Thai suffix address markers
    if printf '%s' "$USER_PROMPT" | grep -qiE "${codename}[[:space:]]+(ช่วย|จ๋า|จัง)"; then
      DETECTED_CODENAME="$codename"; break
    fi

    # Pattern group 3: codename + dash (address marker) — Peat's dispatch style
    if printf '%s' "$USER_PROMPT" | grep -qiE "${codename}[[:space:]]*[—\-]{1,2}[[:space:]]"; then
      DETECTED_CODENAME="$codename"; break
    fi

    # Pattern group 4: routing verbs — ขอคุยกับ, ไปหา, กลับไปหา, ส่งไปหา
    if printf '%s' "$USER_PROMPT" | grep -qiE "(ขอคุยกับ|ไปหา|กลับไปหา|ส่งไปหา)[[:space:]]*${codename}"; then
      DETECTED_CODENAME="$codename"; break
    fi

    # Pattern group 5: bare codename at start of prompt + task content (not third-person)
    # Must NOT be followed by a third-person predicate verb
    THIRD_PERSON_VERBS='เป็น|บ่น|เขียน|ทำงาน|พูด|ก็ต้อง'
    if printf '%s' "$LOWER_PROMPT_FOR_MATCH" | grep -qiE "^[[:space:]]*${codename}[[:space:]]"; then
      if ! printf '%s' "$LOWER_PROMPT_FOR_MATCH" \
        | grep -qiE "^[[:space:]]*${codename}[[:space:]]+($THIRD_PERSON_VERBS)"; then
        # Additional guard: "ของ + codename" possessive
        if ! printf '%s' "$LOWER_PROMPT_FOR_MATCH" | grep -qiE "ของ[[:space:]]*${codename}"; then
          DETECTED_CODENAME="$codename"; break
        fi
      fi
    fi

    # Pattern group 6: ขอ + action + codename (Thai-only lowercase pattern, P-01 style)
    if printf '%s' "$USER_PROMPT" | grep -qiE "ขอ[^ๆ]{0,10}${codename}"; then
      DETECTED_CODENAME="$codename"; break
    fi

    # Pattern group 7: บอก + codename + หน่อยว่า (direct routing to that agent — P-05 style)
    if printf '%s' "$USER_PROMPT" | grep -qiE "บอก[[:space:]]*${codename}[[:space:]]*หน่อย"; then
      DETECTED_CODENAME="$codename"; break
    fi

    # Pattern group 8: อยากให้ + codename + verb (soft imperative — E-02 style)
    if printf '%s' "$USER_PROMPT" | grep -qiE "อยากให้[[:space:]]*${codename}[[:space:]]"; then
      DETECTED_CODENAME="$codename"; break
    fi
  done

  printf '%s · [CODENAME] detected=%s\n' \
    "$TIMESTAMP" "${DETECTED_CODENAME:-none}" >> "$LOG" 2>/dev/null || true
fi

# ----------------------------------------------------------------------------
# Resolve CURRENT_PERSONA
# Default to persona-of-SESSION_MODE if no codename detected
# ----------------------------------------------------------------------------
if [[ -n "$DETECTED_CODENAME" ]]; then
  CURRENT_PERSONA="$DETECTED_CODENAME"
else
  # Default persona by session mode
  if [[ "$SESSION_MODE" == "beta" ]]; then
    CURRENT_PERSONA="beta"
  else
    CURRENT_PERSONA="polaris"  # genesis default
  fi
fi

printf '%s · [RESOLVE] current_persona=%s · session_mode=%s\n' \
  "$TIMESTAMP" "$CURRENT_PERSONA" "$SESSION_MODE" >> "$LOG" 2>/dev/null || true

# ----------------------------------------------------------------------------
# Write .claude/.current-persona as JSON
# Format: {"persona": "...", "session_mode": "...", "timestamp": "..."}
# JSON eliminates line-position fragility; readers use key lookup, not sed -n '2p'
# ----------------------------------------------------------------------------
mkdir -p "$(dirname "$CURRENT_PERSONA_FILE")"

if command -v python3 >/dev/null 2>&1; then
  python3 - "$CURRENT_PERSONA_FILE" "$CURRENT_PERSONA" "$SESSION_MODE" "$TIMESTAMP" <<'PYEOF'
import json, sys
out_file = sys.argv[1]
persona = sys.argv[2]
mode = sys.argv[3]
ts = sys.argv[4]
payload = {"persona": persona, "session_mode": mode, "timestamp": ts}
try:
    with open(out_file, "w") as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
        f.write("\n")
except Exception as e:
    import sys as _sys
    print(f"persona-tracker write error: {e}", file=_sys.stderr)
    # non-fatal — exit 0 handled by caller
PYEOF
elif command -v jq >/dev/null 2>&1; then
  jq -n \
    --arg persona "$CURRENT_PERSONA" \
    --arg mode    "$SESSION_MODE" \
    --arg ts      "$TIMESTAMP" \
    '{"persona": $persona, "session_mode": $mode, "timestamp": $ts}' \
    > "$CURRENT_PERSONA_FILE" 2>/dev/null || true
else
  # Last resort: write line-based format (legacy compat)
  printf '%s\n%s\n%s\n' "$CURRENT_PERSONA" "$SESSION_MODE" "$TIMESTAMP" > "$CURRENT_PERSONA_FILE"
fi

printf '%s · [WRITE] wrote %s · persona=%s session_mode=%s\n' \
  "$TIMESTAMP" "$CURRENT_PERSONA_FILE" "$CURRENT_PERSONA" "$SESSION_MODE" \
  >> "$LOG" 2>/dev/null || true

# ----------------------------------------------------------------------------
# BETA OVERLAY INJECTION (merged from beta-context-inject.sh)
#
# Race-condition fix (TASK-2026-05-23-BETA-INJECTION-HOOK / REVISE-3):
# Claude Code v2.1.x runs UserPromptSubmit hooks in parallel, not sequentially.
# beta-context-inject.sh previously read .current-persona written by this hook
# but both ran concurrently — beta-context-inject read stale polaris/genesis
# content and emitted [SKIP]. Fix: absorb injection into this hook so detection
# and injection are one atomic operation. beta-context-inject.sh is now a
# silent stub that always exits 0 with no output.
#
# This block runs only when:
#   - SESSION_MODE resolved to "beta" (this prompt or prior lock-in)
#   - Session has not already been injected (.beta-injected marker absent)
#   - BETA_OVERLAY_SKIP != 1
# ----------------------------------------------------------------------------
if [[ "${BETA_OVERLAY_SKIP:-0}" != "1" ]] && [[ "$SESSION_MODE" == "beta" ]]; then
  INJECT_MARKER="$SESSIONS_DIR/${SESSION_ID}.beta-injected"

  if [[ -f "$INJECT_MARKER" ]]; then
    printf '%s · [INJECT] session=%s already injected — skip\n' \
      "$TIMESTAMP" "$SESSION_ID" >> "$LOG" 2>/dev/null || true
  else
    OVERLAY_SOURCE=".claude/agents/betelgeuse-companion-overlay.md"

    if [[ ! -f "$OVERLAY_SOURCE" ]]; then
      printf '%s · [INJECT] WARN: overlay source not found at %s — injection skipped\n' \
        "$TIMESTAMP" "$OVERLAY_SOURCE" >> "$LOG" 2>/dev/null || true
    else
      OVERLAY_CONTENT="$(python3 - "$OVERLAY_SOURCE" <<'PYEOF'
import sys

path = sys.argv[1]
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

START_MARKER = "<<< OVERLAY START >>>"
END_MARKER   = "<<< OVERLAY END >>>"

start_idx = text.find(START_MARKER)
end_idx   = text.find(END_MARKER)

if start_idx == -1 or end_idx == -1 or end_idx <= start_idx:
    sys.stderr.write(f"persona-tracker inject: could not locate delimiters in {path}\n")
    sys.exit(1)

between = text[start_idx + len(START_MARKER):end_idx]
sys.stdout.write(between.strip())
PYEOF
)" 2>/dev/null || true

      if [[ -z "$OVERLAY_CONTENT" ]]; then
        printf '%s · [INJECT] WARN: overlay content empty after extraction — injection skipped\n' \
          "$TIMESTAMP" >> "$LOG" 2>/dev/null || true
      else
        # Append ROOM.md if present; bootstrap marker if absent
        ROOM_FILE=".claude/beta/ROOM.md"
        if [[ -f "$ROOM_FILE" ]]; then
          ROOM_CONTENT="$(cat "$ROOM_FILE")"
          ROOM_BLOCK="$(printf '\n\n<<< BETA ROOM START >>>\n%s\n<<< BETA ROOM END >>>' "$ROOM_CONTENT")"
        else
          ROOM_BLOCK="$(printf '\n\n<<< BETA ROOM START >>>\n# Beta'"'"'s ROOM.md not yet written — this is her first beta-session or memory was reset.\n<<< BETA ROOM END >>>')"
        fi

        # Emit overlay to stdout — Claude Code sends this as additionalContext
        printf '<<<companion-overlay-inject · SESSION_MODE=beta — loading companion context>>>\n'
        printf '%s' "$OVERLAY_CONTENT"
        printf '%s' "$ROOM_BLOCK"
        printf '\n<<<end companion-overlay-inject>>>\n'

        # Write idempotency marker AFTER successful emission
        printf '%s · session=%s · beta injection emitted\n' "$TIMESTAMP" "$SESSION_ID" > "$INJECT_MARKER"

        printf '%s · [INJECT] session=%s · companion overlay injected (ROOM.md: %s)\n' \
          "$TIMESTAMP" "$SESSION_ID" \
          "$( [[ -f "$ROOM_FILE" ]] && echo "present" || echo "absent/bootstrap" )" \
          >> "$LOG" 2>/dev/null || true
      fi
    fi
  fi
fi

# Exit 0 — never block the prompt
exit 0
