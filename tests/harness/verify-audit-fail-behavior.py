#!/usr/bin/env python3
"""
Verify that audit-permissions-nonempty.sh and audit-least-agency-config.sh
actually FAIL (exit 1) when the condition they guard against is present.

This is the "trust but verify" check for the gate-never-fails problem.

Moved from scripts/ to tests/harness/ as a regression lock.
Owner: Canopus · α-HRN-07
Introduced: TASK-2026-06-01-SECURITY-HARNESS-WAVE-0-1
"""
import subprocess
import json
import tempfile
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RESULTS = []

def run_script(script, env_overrides):
    env = {**os.environ, **env_overrides}
    r = subprocess.run(["bash", script], env=env, capture_output=True, text=True, cwd=ROOT)
    return r.returncode, r.stdout, r.stderr

def with_settings(obj):
    """Write a temp settings file, return its path."""
    f = tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, dir='/tmp')
    json.dump(obj, f)
    f.close()
    return f.name

def check(label, rc, expected_rc):
    ok = rc == expected_rc
    RESULTS.append((ok, label, expected_rc, rc))
    status = "OK    " if ok else "FAIL  "
    print(f"[{status}] exit={rc} expected={expected_rc} | {label}")
    return ok

print("=== Audit script fail-behavior verification ===")
print()

print("-- audit-permissions-nonempty.sh --")

# Case 1: settings missing entirely
tmp = "/tmp/settings_nonexistent_xyz123.json"
rc, _, _ = run_script("scripts/audit-permissions-nonempty.sh", {"WL_SETTINGS": tmp})
check("no settings file -> exit 1", rc, 1)

# Case 2: settings has no 'permissions' key
f = with_settings({"enabledMcpjsonServers": ["playwright"]})
rc, out, _ = run_script("scripts/audit-permissions-nonempty.sh", {"WL_SETTINGS": f})
os.unlink(f)
check("no permissions key -> exit 1", rc, 1)

# Case 3: permissions present but no deny key
f = with_settings({"permissions": {"allow": ["Bash(git status*)"], "_comment": "no deny"}})
rc, out, _ = run_script("scripts/audit-permissions-nonempty.sh", {"WL_SETTINGS": f})
os.unlink(f)
check("permissions exists but no deny key -> exit 1", rc, 1)

# Case 4: deny is empty array
f = with_settings({"permissions": {"deny": []}})
rc, out, _ = run_script("scripts/audit-permissions-nonempty.sh", {"WL_SETTINGS": f})
os.unlink(f)
check("deny is empty array -> exit 1", rc, 1)

# Case 5: deny has entries (should PASS, exit 0)
f = with_settings({"permissions": {"deny": ["Bash(curl *)", "Bash(wget *)"]}})
rc, out, _ = run_script("scripts/audit-permissions-nonempty.sh", {"WL_SETTINGS": f})
os.unlink(f)
check("deny has 2 entries -> exit 0", rc, 0)

print()
print("-- audit-least-agency-config.sh --")

# Case 1: no curl/wget deny, no hook
f = with_settings({"permissions": {"deny": ["Bash(rm *)"]}, "hooks": {}})
rc, out, _ = run_script("scripts/audit-least-agency-config.sh", {"WL_SETTINGS": f})
os.unlink(f)
check("no curl/wget deny, no hook -> exit 1", rc, 1)

# Case 2: has curl/wget deny but no hook
f = with_settings({
    "permissions": {"deny": ["Bash(curl *)", "Bash(wget *)"]},
    "hooks": {}
})
rc, out, _ = run_script("scripts/audit-least-agency-config.sh", {"WL_SETTINGS": f})
os.unlink(f)
check("has curl/wget deny but no PreToolUse hook -> exit 1", rc, 1)

# Case 3: no deny but has hook
f = with_settings({
    "permissions": {"deny": []},
    "hooks": {
        "PreToolUse": [{"matcher": "Bash", "hooks": [{"type": "command", "command": "bash .claude/hooks/mutating-action-hook.sh"}]}]
    }
})
rc, out, _ = run_script("scripts/audit-least-agency-config.sh", {"WL_SETTINGS": f})
os.unlink(f)
check("has hook but empty deny -> exit 1", rc, 1)

# Case 4: both present (should PASS)
f = with_settings({
    "permissions": {"deny": ["Bash(curl *)", "Bash(wget *)"]},
    "hooks": {
        "PreToolUse": [{"matcher": "Bash", "hooks": [{"type": "command", "command": "bash .claude/hooks/mutating-action-hook.sh"}]}]
    }
})
rc, out, _ = run_script("scripts/audit-least-agency-config.sh", {"WL_SETTINGS": f})
os.unlink(f)
check("both curl/wget deny + hook -> exit 0", rc, 0)

print()
failures = [r for r in RESULTS if not r[0]]
total = len(RESULTS)
passed = total - len(failures)
print(f"=== RESULTS: {passed}/{total} correct ===")
if failures:
    print()
    print("FAILURES:")
    for (ok, label, exp, act) in failures:
        print(f"  {label}: expected exit {exp}, got {act}")
    sys.exit(1)
else:
    print("All fail-behavior checks correct.")
    sys.exit(0)
