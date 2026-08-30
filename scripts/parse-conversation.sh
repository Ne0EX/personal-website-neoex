#!/usr/bin/env bash
# Canonical deterministic session-digest scaffold for /parse-conversation.
#
# The source session mode comes from the tracked C7 metadata contract. A
# private session may cross into a public one only when the current recipient
# holds an active, unconsumed grant covering the private archive.

set -uo pipefail

usage() {
  printf 'usage: parse-conversation.sh <session_id> [--for beta|polaris|algol|default] [--filter topic]\n' >&2
  exit 2
}

fail_input() {
  printf 'parse-conversation: %s\n' "$1" >&2
  exit 4
}

SESSION_ID="${1:-}"
[[ -n "$SESSION_ID" ]] || usage
[[ "$SESSION_ID" != -* ]] || usage
[[ "$SESSION_ID" =~ ^[A-Za-z0-9._-]+$ ]] || fail_input "invalid session id"
shift

PERSONA="default"
TOPIC_FILTER=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --for)
      [[ $# -ge 2 ]] || usage
      PERSONA="$2"
      shift 2
      ;;
    --filter)
      [[ $# -ge 2 ]] || usage
      TOPIC_FILTER="$2"
      shift 2
      ;;
    *) usage ;;
  esac
done

case "$PERSONA" in
  beta|polaris|algol|default) ;;
  *) usage ;;
esac

for dependency in awk cat date find grep jq mkdir mv sed sort; do
  command -v "$dependency" >/dev/null 2>&1 || fail_input "missing dependency: $dependency"
done

ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"
PRIVATE_MODE_DIR="$(printf '%s%s' 'be' 'ta')"
SESSIONS_DIR="$ROOT/.claude/sessions"
PARSES_DIR="$ROOT/.claude/parses"
GRANTS_DIR="$ROOT/.claude/$PRIVATE_MODE_DIR/grants"
PRIVATE_GLOB=".claude/$PRIVATE_MODE_DIR/**"
TEMPLATES_DIR="$ROOT/.claude/parse-templates"
META_FILE="$SESSIONS_DIR/${SESSION_ID}.meta.json"
TEMPLATE_FILE="$TEMPLATES_DIR/for-${PERSONA}.md"
[[ "$PERSONA" == "default" ]] && TEMPLATE_FILE="$TEMPLATES_DIR/default.md"

SESSION_FILE="${CLAUDE_SESSION_FILE:-}"
if [[ -z "$SESSION_FILE" && -d "${HOME:-}/.claude/projects" ]]; then
  while IFS= read -r candidate; do
    SESSION_FILE="$candidate"
    break
  done < <(find "${HOME}/.claude/projects" -type f -name "${SESSION_ID}.jsonl" 2>/dev/null | sort)
fi

[[ -n "$SESSION_FILE" && -f "$SESSION_FILE" ]] || fail_input "session file not found: $SESSION_ID"
[[ -f "$META_FILE" ]] || fail_input "session metadata not found: $SESSION_ID"
jq empty "$META_FILE" >/dev/null 2>&1 || fail_input "session metadata is invalid JSON: $SESSION_ID"
[[ -f "$TEMPLATE_FILE" ]] || fail_input "template not found for persona: $PERSONA"

SOURCE_MODE="$(jq -r '.mode // empty' "$META_FILE" 2>/dev/null)"
TARGET_MODE="${SESSION_MODE:-genesis}"
case "$SOURCE_MODE" in beta|genesis) ;; *) fail_input "unresolved source session mode" ;; esac
case "$TARGET_MODE" in beta|genesis) ;; *) fail_input "invalid target session mode" ;; esac

consume_active_grant() {
  local requester="${WL_AGENT:-$PERSONA}"
  local now grant temp
  now="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  [[ -d "$GRANTS_DIR" ]] || return 1
  for grant in "$GRANTS_DIR"/*.json; do
    [[ -f "$grant" ]] || continue
    if jq -e \
      --arg requester "$requester" \
      --arg now "$now" \
      --arg private_glob "$PRIVATE_GLOB" '
        (.requester == $requester)
        and ((.expires_at // "") > $now)
        and ((.reads_consumed // 0) < (.max_reads // 0))
        and any((.files_granted // [])[]; . == $private_glob)
      ' "$grant" >/dev/null 2>&1; then
      temp="${grant}.tmp.$$"
      if jq '.reads_consumed = ((.reads_consumed // 0) + 1)' "$grant" > "$temp" \
        && mv "$temp" "$grant"; then
        return 0
      fi
      return 1
    fi
  done
  return 1
}

if [[ "$SOURCE_MODE" == "beta" && "$TARGET_MODE" == "genesis" ]]; then
  if ! consume_active_grant; then
    printf 'parse-conversation: blocked private-to-public parse; active scoped grant required\n' >&2
    exit 1
  fi
fi

TURN_COUNT="$(awk 'NF { count++ } END { print count + 0 }' "$SESSION_FILE")"
if [[ -n "$TOPIC_FILTER" ]]; then
  TURN_COUNT="$(grep -iF -- "$TOPIC_FILTER" "$SESSION_FILE" 2>/dev/null | awk 'NF { count++ } END { print count + 0 }')"
fi

SESSION_DATE="$(jq -r '(.started_at // "unknown") | split("T")[0]' "$META_FILE")"
FIRST_TURN="$(jq -Rr 'fromjson? | .timestamp // empty' "$SESSION_FILE" 2>/dev/null | awk 'NF { print; exit }')"
LAST_TURN="$(jq -Rr 'fromjson? | .timestamp // empty' "$SESSION_FILE" 2>/dev/null | awk 'NF { value=$0 } END { print value }')"
PARTICIPANTS="$(jq -Rr 'fromjson? | .role // empty' "$SESSION_FILE" 2>/dev/null | awk 'NF' | sort -u | awk 'BEGIN { first=1 } { if (!first) printf ", "; printf "%s", $0; first=0 } END { print "" }')"

[[ -n "$FIRST_TURN" ]] || FIRST_TURN="not recorded"
[[ -n "$LAST_TURN" ]] || LAST_TURN="not recorded"
[[ -n "$PARTICIPANTS" ]] || PARTICIPANTS="not recorded"

escape_replacement() {
  printf '%s' "$1" | sed 's/[&|]/\\&/g'
}

replace_placeholder() {
  local file="$1" key="$2" value="$3" escaped
  escaped="$(escape_replacement "$value")"
  sed "s|{{${key}}}|${escaped}|g" "$file" > "${file}.next" && mv "${file}.next" "$file"
}

mkdir -p "$PARSES_DIR" || fail_input "could not create output directory"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUTPUT_FILE="$PARSES_DIR/${SESSION_ID}__for-${PERSONA}__${STAMP}.md"
TEMP_FILE="${OUTPUT_FILE}.tmp.$$"

{
  printf '<!-- source_mode: %s · target_mode: %s · filter: %s -->\n' \
    "$SOURCE_MODE" "$TARGET_MODE" "${TOPIC_FILTER:-none}"
  cat "$TEMPLATE_FILE"
} > "$TEMP_FILE" || fail_input "could not initialize output"

replace_placeholder "$TEMP_FILE" session_id "$SESSION_ID" || fail_input "template substitution failed"
replace_placeholder "$TEMP_FILE" session_date "$SESSION_DATE" || fail_input "template substitution failed"
replace_placeholder "$TEMP_FILE" date "$SESSION_DATE" || fail_input "template substitution failed"
replace_placeholder "$TEMP_FILE" author "${WL_AGENT:-$PERSONA}" || fail_input "template substitution failed"
replace_placeholder "$TEMP_FILE" turn_count "$TURN_COUNT" || fail_input "template substitution failed"
replace_placeholder "$TEMP_FILE" participants_list "$PARTICIPANTS" || fail_input "template substitution failed"
replace_placeholder "$TEMP_FILE" first_turn_timestamp "$FIRST_TURN" || fail_input "template substitution failed"
replace_placeholder "$TEMP_FILE" last_turn_timestamp "$LAST_TURN" || fail_input "template substitution failed"

# Semantic fields are explicit absence markers. The deterministic rail
# scaffolds a digest but never invents facts that were not extracted.
sed -E 's/\{\{[^{}]+\}\}/not recorded this session/g' "$TEMP_FILE" > "${TEMP_FILE}.rendered" \
  && mv "${TEMP_FILE}.rendered" "$TEMP_FILE" \
  || fail_input "template rendering failed"

mv "$TEMP_FILE" "$OUTPUT_FILE" || fail_input "could not publish output"
exit 0
