#!/usr/bin/env python3
"""Verify the current fail/pass contracts of the two permissions audits."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


ROOT = Path(__file__).resolve().parents[2]
TIMEOUT_SECONDS = 10
RESULTS = []
MISSING = object()
INVALID_JSON = object()


def run_case(temp_dir, label, script, settings, expected_rc):
    """Run one isolated settings fixture and verify exit code plus verdict text."""
    case_number = len(RESULTS) + 1
    settings_path = temp_dir / f"settings-{case_number}.json"
    if settings is INVALID_JSON:
        settings_path.write_text("{not-json\n", encoding="utf-8")
    elif settings is not MISSING:
        settings_path.write_text(json.dumps(settings), encoding="utf-8")

    env = os.environ.copy()
    env.update({
        "WL_SETTINGS": str(settings_path),
        "WL_TASK_ID": f"ci-audit-fail-behavior-{case_number}",
        "LC_ALL": "C",
        "TZ": "UTC",
    })

    try:
        result = subprocess.run(
            ["bash", str(ROOT / script)],
            env=env,
            capture_output=True,
            text=True,
            cwd=ROOT,
            timeout=TIMEOUT_SECONDS,
            check=False,
        )
        actual_rc = result.returncode
        verdict = "PASS" if expected_rc == 0 else "FAIL"
        audit_name = Path(script).stem
        expected_output = f"[{audit_name}] {verdict}"
        output_ok = expected_output in (result.stdout + result.stderr)
        detail = "" if output_ok else f"; missing output {expected_output!r}"
    except subprocess.TimeoutExpired:
        actual_rc = "timeout"
        output_ok = False
        detail = f" after {TIMEOUT_SECONDS}s"

    ok = actual_rc == expected_rc and output_ok
    RESULTS.append((ok, label, expected_rc, actual_rc, detail))
    status = "OK    " if ok else "FAIL  "
    print(f"[{status}] exit={actual_rc} expected={expected_rc} | {label}")


missing_tools = [name for name in ("bash", "jq", "tee", "date") if not shutil.which(name)]
if missing_tools:
    print(f"Missing audit prerequisites: {', '.join(missing_tools)}", file=sys.stderr)
    sys.exit(2)

print("=== Audit script fail-behavior verification ===")

with tempfile.TemporaryDirectory(prefix="worldline-audit-contract-") as temp_name:
    temp_dir = Path(temp_name)

    print("\n-- audit-permissions-nonempty.sh --")
    permissions_script = "scripts/audit-permissions-nonempty.sh"
    run_case(temp_dir, "missing settings -> fail", permissions_script, MISSING, 1)
    run_case(temp_dir, "invalid JSON -> fail", permissions_script, INVALID_JSON, 1)
    run_case(temp_dir, "missing permissions -> fail", permissions_script, {}, 1)
    run_case(
        temp_dir,
        "null permissions -> fail",
        permissions_script,
        {"permissions": None},
        1,
    )
    run_case(
        temp_dir,
        "allow present and deny absent -> pass",
        permissions_script,
        {"permissions": {"allow": ["Bash(git status*)"]}},
        0,
    )
    run_case(
        temp_dir,
        "empty deny and missing allow -> fail",
        permissions_script,
        {"permissions": {"deny": []}},
        1,
    )
    run_case(
        temp_dir,
        "nonempty deny and missing allow -> fail",
        permissions_script,
        {"permissions": {"deny": ["Bash(curl *)", "Bash(wget *)"]}},
        1,
    )
    run_case(
        temp_dir,
        "empty deny and nonempty allow -> pass",
        permissions_script,
        {"permissions": {"deny": [], "allow": ["Bash(git status*)"]}},
        0,
    )
    run_case(
        temp_dir,
        "nonempty deny and nonempty allow -> pass",
        permissions_script,
        {
            "permissions": {
                "deny": ["Bash(curl *)", "Bash(wget *)"],
                "allow": ["Bash(git status*)"],
            }
        },
        0,
    )

    print("\n-- audit-least-agency-config.sh --")
    least_agency_script = "scripts/audit-least-agency-config.sh"
    hook = {
        "matcher": "Bash",
        "hooks": [
            {
                "type": "command",
                "command": "bash .claude/hooks/mutating-action-hook.sh",
            }
        ],
    }
    run_case(temp_dir, "missing settings -> fail", least_agency_script, MISSING, 1)
    run_case(temp_dir, "invalid JSON -> fail", least_agency_script, INVALID_JSON, 1)
    run_case(
        temp_dir,
        "deny present but no hook -> fail",
        least_agency_script,
        {"permissions": {"deny": ["Bash(curl *)"]}, "hooks": {}},
        1,
    )
    run_case(
        temp_dir,
        "empty deny with Bash hook -> pass",
        least_agency_script,
        {"permissions": {"deny": []}, "hooks": {"PreToolUse": [hook]}},
        0,
    )
    run_case(
        temp_dir,
        "hook-only fixture -> pass (permissions audited separately)",
        least_agency_script,
        {"hooks": {"PreToolUse": [hook]}},
        0,
    )
    run_case(
        temp_dir,
        "correct command under wrong matcher -> fail",
        least_agency_script,
        {"hooks": {"PreToolUse": [{**hook, "matcher": "Read"}]}},
        1,
    )
    run_case(
        temp_dir,
        "unrelated Bash hook -> fail",
        least_agency_script,
        {
            "hooks": {
                "PreToolUse": [
                    {
                        "matcher": "Bash",
                        "hooks": [{"type": "command", "command": "bash other-hook.sh"}],
                    }
                ]
            }
        },
        1,
    )
    run_case(
        temp_dir,
        "deny entries plus Bash hook -> pass",
        least_agency_script,
        {
            "permissions": {"deny": ["Bash(curl *)", "Bash(wget *)"]},
            "hooks": {"PreToolUse": [hook]},
        },
        0,
    )

print()
failures = [result for result in RESULTS if not result[0]]
print(f"=== RESULTS: {len(RESULTS) - len(failures)}/{len(RESULTS)} correct ===")
if failures:
    print("\nFAILURES:")
    for _, label, expected, actual, detail in failures:
        print(f"  {label}: expected exit {expected}, got {actual}{detail}")
    sys.exit(1)

print("All fail-behavior checks matched the current contracts.")
