#!/usr/bin/env bash
# UserPromptSubmit hook.
# Detects G.E.N.E.S.I.S agent codename invocation in the incoming prompt and
# injects the matched .claude/agents/<codename>.md as additional context.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

RAW_PROMPT="$(cat)"

GENESIS_PROMPT_RAW="$RAW_PROMPT" python3 - <<'PY'
import json
import os
import re
import sys

raw = os.environ.get("GENESIS_PROMPT_RAW", "")

try:
    payload = json.loads(raw)
    prompt = payload.get("prompt", raw)
except Exception:
    prompt = raw

agents = {
    "polaris": "Polaris",
    "sirius": "Sirius",
    "altair": "Altair",
    "procyon": "Procyon",
    "betelgeuse": "Betelgeuse",
    "arcturus": "Arcturus",
    "algol": "Algol",
    "canopus": "Canopus",
    "vega": "Vega",
}

pre_cutover = {
    "mira": "Polaris",
    "pico": "Sirius",
    "lyra": "Procyon",
    "iris": "Betelgeuse",
    "sage": "Arcturus",
    "cipher": "Algol",
    "rigel": "Canopus",
    "quill": "Vega",
}

names = sorted(
    list(agents.values()) + [name.lower() for name in agents.values()],
    key=len,
    reverse=True,
)

# Vocative only: a codename must be framed as direct address, not possessive
# prose such as "Polaris's territory".
before = r"(^|[\s,([{]|พี่|คุณ)"
after = r"($|[\s,).:;!?]|—|-|ค่ะ|ครับ|จัง|หน่อย)"
pattern = re.compile(before + r"(" + "|".join(map(re.escape, names)) + r")" + after, re.IGNORECASE)

match = pattern.search(prompt)
note = ""
if match:
    addressed = agents[match.group(2).lower()]
else:
    addressed = ""
    for old, new in pre_cutover.items():
        old_pattern = re.compile(before + re.escape(old) + after, re.IGNORECASE)
        if old_pattern.search(prompt):
            addressed = new
            note = f"<<note · pre-cutover '{old.title()}' detected; translated to '{new}'>>\n"
            break

if not addressed:
    sys.exit(0)

code = addressed.lower()
persona = os.path.join(".claude", "agents", f"{code}.md")
if not os.path.isfile(persona):
    print(f"<<warning · agent '{addressed}' addressed but {persona} not found>>")
    sys.exit(0)

with open(persona, "r", encoding="utf-8") as handle:
    body = handle.read().rstrip()

sys.stdout.write(note)
print(f"<<<agent-voice-protocol · Peat addressed '{addressed}' — loading persona>>>")
print(body)
print("<<<end agent-voice-protocol>>>")
PY
