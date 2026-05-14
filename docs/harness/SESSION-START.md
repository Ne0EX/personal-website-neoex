# SessionStart Hook — Default Polaris Persona

> Rail owner · Canopus (α-HRN-07)
> Last updated · 2026-05-14
> Hook source · `.claude/hooks/session-start.sh`
> Settings wiring · `.claude/settings.json` § SessionStart

---

## What this hook does

On every new Claude Code session opened in this repo, the `SessionStart` hook fires
and injects context instructing the root session to:

1. Read `.claude/agents/polaris.md` — the full Polaris persona definition.
2. Adopt Polaris (α-OPS-00) voice and operating rules by default, before any message
   from Peat arrives.
3. Apply the codename-override protocol described below.

The result: a fresh terminal, `claude` → the bridge is staffed. Peat types `ดีจ้า`
with no codename and gets Polaris voice (`ฉัน` / `ค่ะ`, calm-axis register), not
generic Claude.

This closes the gap observed on 2026-05-14: clean session with no codename returned
"ดีจ้า Peat — มีอะไรให้ช่วยวันนี้?" (generic helpful-assistant default) rather than
Polaris.

---

## How it composes with the codename-trigger protocol

The hook implements a **default + codename-override** model:

```
Session opens
     │
     ▼
[SessionStart] session-start.sh fires
     │   injects: "you are Polaris by default"
     ▼
Polaris voice active ──────────── DEFAULT STATE
     │
     │  Peat types: "ดีจ้า" (no codename)
     ▼
Polaris responds in Polaris voice       ✓

     │  Peat types: "Vega จัง อยู่มั้ย"
     ▼
Codename-override fires (memory: feedback_agent_voice_protocol.md)
  → load .claude/agents/vega.md §voice
  → respond as Vega                     ✓ override
     │
     │  Peat's exchange with Vega concludes
     ▼
Resume Polaris as default               ✓ default restored
```

The two layers are independent:
- The SessionStart hook sets the initial default once at session open.
- The codename-trigger protocol (in `~/.claude/projects/.../memory/feedback_agent_voice_protocol.md`)
  operates message-by-message throughout the session.

Neither layer interferes with the other. The hook does not re-fire mid-session;
the codename protocol does not need to know the hook exists.

---

## What this hook deliberately does not do

**No auto-load for other agents.**
Only Polaris is the default front-of-house. Sirius, Vega, Canopus, and all other
agents remain codename-triggered. This is by design: the bridge has one default
occupant. Adding more defaults would defeat the purpose of having a default at all.

**No CI injection.**
The hook is wired in `.claude/settings.json` (project-local, human interactive
sessions). CI pipelines that invoke `claude` non-interactively do not trigger
SessionStart in the same interactive context. If CI sessions ever become interactive,
add a `[ -n "$CI" ] && exit 0` guard at the top of `session-start.sh`.

**No code or implementation authority injected.**
The context block explicitly constrains Polaris to PM scope: orchestrate, decompose,
assign, route. The hook does not expand her authority beyond her persona definition.

**No session-to-session state.**
The hook emits only `additionalContext` (a string). It writes nothing to disk.
No `.claude/session-state.*` files, no lock files, no side effects.

---

## How to disable temporarily

**Method 1 — `/hooks` UI inside Claude Code**
Open the Hooks panel with `/hooks`, find the SessionStart entry, and toggle it off.
Re-enable after your session is done.

**Method 2 — settings.local.json override**
Create `.claude/settings.local.json` (gitignored by convention) with an empty
SessionStart block to shadow the project setting:

```json
{
  "hooks": {
    "SessionStart": []
  }
}
```

This file overrides `.claude/settings.json` locally without modifying the repo.
Delete or empty it to restore the hook.

**Method 3 — temporary rename**
Rename `session-start.sh` to `session-start.sh.disabled`. The command will fail
silently (the settings command exits non-zero but Claude Code will continue). Rename
back to restore.

---

## Common failures and fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| Session opens with generic Claude voice | Hook not firing | Check `/hooks` UI; verify settings.json SessionStart block exists |
| Warning: "persona file not found" in stderr | `.claude/agents/polaris.md` missing or moved | Restore the file; hook exits 0 and session continues, just without injection |
| `python3: command not found` | python3 not on PATH | Ensure python3 is installed; it's used for JSON string escaping |
| Hook output is not valid JSON | Bug in session-start.sh | Run `echo '{}' | bash .claude/hooks/session-start.sh | python3 -m json.tool` to diagnose |

---

## Regression test

The hook is idempotent. To manually verify it:

```bash
# From repo root
echo '{}' | bash .claude/hooks/session-start.sh | python3 -m json.tool
```

Expected: valid JSON with `hookSpecificOutput.hookEventName == "SessionStart"` and
`additionalContext` containing the Polaris instruction block.

Automated regression test ownership: Algol (α-QA-05). If a test is added at
`tests/harness/session-start.test.*`, it is Algol's to maintain; this doc stays as
the human-readable spec.

---

*end of SESSION-START.md*
