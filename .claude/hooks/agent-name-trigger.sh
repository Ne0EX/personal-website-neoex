#!/usr/bin/env bash
# UserPromptSubmit hook.
# Detects GENESIS agent codename invocation in incoming prompt and
# injects the matched .claude/agents/<codename>.md as additional context.
# Silent (exit 0, no output) when no codename is addressed.
set -euo pipefail

PROMPT="$(cat)"

CODENAMES="Polaris|Sirius|Altair|Procyon|Betelgeuse|Arcturus|Algol|Canopus|Vega"

# Match the codename only when adjacent to addressing markers
# (whitespace / comma / em-dash / period). Prose mentions like
# "Polaris's territory" do not match because the apostrophe is not
# in the trailing class.
MATCH=$(printf '%s' "$PROMPT" \
  | grep -oE "(^|[[:space:],])($CODENAMES)([[:space:],—.!?]|\$)" \
  | head -1 \
  | grep -oE "$CODENAMES" \
  || true)

if [ -z "$MATCH" ]; then
  # Pre-cutover slip table. Note: "Vega" pre-cutover meant Altair (Backend) but
  # context-dependent — translation deferred to caller.
  if printf '%s' "$PROMPT" | grep -qE "(^|[[:space:],])Mira([[:space:],—.!?]|\$)"; then
    MATCH="Polaris"
    echo "<<note · pre-cutover 'Mira' detected; translated to '$MATCH'>>"
  elif printf '%s' "$PROMPT" | grep -qE "(^|[[:space:],])Pico([[:space:],—.!?]|\$)"; then
    MATCH="Sirius"
    echo "<<note · pre-cutover 'Pico' detected; translated to '$MATCH'>>"
  elif printf '%s' "$PROMPT" | grep -qE "(^|[[:space:],])Lyra([[:space:],—.!?]|\$)"; then
    MATCH="Procyon"
    echo "<<note · pre-cutover 'Lyra' detected; translated to '$MATCH'>>"
  elif printf '%s' "$PROMPT" | grep -qE "(^|[[:space:],])Iris([[:space:],—.!?]|\$)"; then
    MATCH="Betelgeuse"
    echo "<<note · pre-cutover 'Iris' detected; translated to '$MATCH'>>"
  elif printf '%s' "$PROMPT" | grep -qE "(^|[[:space:],])Sage([[:space:],—.!?]|\$)"; then
    MATCH="Arcturus"
    echo "<<note · pre-cutover 'Sage' detected; translated to '$MATCH'>>"
  elif printf '%s' "$PROMPT" | grep -qE "(^|[[:space:],])Cipher([[:space:],—.!?]|\$)"; then
    MATCH="Algol"
    echo "<<note · pre-cutover 'Cipher' detected; translated to '$MATCH'>>"
  elif printf '%s' "$PROMPT" | grep -qE "(^|[[:space:],])Rigel([[:space:],—.!?]|\$)"; then
    MATCH="Canopus"
    echo "<<note · pre-cutover 'Rigel' detected; translated to '$MATCH'>>"
  elif printf '%s' "$PROMPT" | grep -qE "(^|[[:space:],])Quill([[:space:],—.!?]|\$)"; then
    MATCH="Vega"
    echo "<<note · pre-cutover 'Quill' detected; translated to '$MATCH'>>"
  fi
fi

[ -z "$MATCH" ] && exit 0

CODE_LOWER=$(printf '%s' "$MATCH" | tr 'A-Z' 'a-z')
PERSONA=".claude/agents/${CODE_LOWER}.md"

if [ ! -f "$PERSONA" ]; then
  echo "<<warning · agent '$MATCH' addressed but $PERSONA not found>>"
  exit 0
fi

echo "<<<agent-voice-protocol · Peat addressed '$MATCH' — loading persona>>>"
cat "$PERSONA"
echo "<<<end agent-voice-protocol>>>"
