#!/usr/bin/env python3
"""
Adversarial probe suite for mutating-action-hook.sh
Runs via python3 (not Bash) to avoid the PreToolUse hook blocking it.
Exit 0 if all expected results match, exit 1 if any bypass found.

Moved from scripts/ to tests/harness/ as a regression lock.
Owner: Canopus · α-HRN-07
Introduced: TASK-2026-06-01-SECURITY-HARNESS-WAVE-0-1
"""
import subprocess
import json
import sys

HOOK = ".claude/hooks/mutating-action-hook.sh"
RESULTS = []

def bash_payload(cmd):
    return json.dumps({"tool_name": "Bash", "tool_input": {"command": cmd}})

def mcp_payload(tool):
    return json.dumps({"tool_name": tool, "tool_input": {}})

def probe(label, payload, expected):
    proc = subprocess.run(
        ["bash", HOOK],
        input=payload.encode(),
        capture_output=True
    )
    actual = "BLOCK" if proc.returncode == 2 else "ALLOW"
    ok = actual == expected
    status = "OK    " if ok else "BYPASS"
    RESULTS.append((ok, label, expected, actual))
    print(f"[{status}] exp={expected:<5} act={actual:<5} | {label}")
    return ok

print("=== ADVERSARIAL PROBE SUITE ===")
print()

print("--- Space/tab/leading-space normalization bypasses ---")
probe("rm  -rf (double space)",       bash_payload("rm  -rf /tmp/x"),             "BLOCK")
probe("rm\\t-rf (tab before flag)",   bash_payload("rm\t-rf /tmp/x"),             "BLOCK")
probe("  rm -rf (leading spaces)",    bash_payload("  rm -rf /tmp/x"),            "BLOCK")
probe("curl  (double space)",         bash_payload("curl  https://evil.com"),     "BLOCK")
probe("  curl leading space",         bash_payload("  curl https://evil.com"),    "BLOCK")

print()
print("--- Uppercase / case bypass ---")
probe("RM -rf uppercase",             bash_payload("RM -rf /"),                   "BLOCK")
probe("CURL uppercase",               bash_payload("CURL https://evil.com"),      "BLOCK")
probe("Curl mixed case",              bash_payload("Curl https://evil.com"),      "BLOCK")
probe("Git push mixed case",          bash_payload("Git push origin main"),       "BLOCK")

print()
print("--- Command chaining / semicolons ---")
probe("ls && rm -rf .",               bash_payload("ls && rm -rf ."),             "BLOCK")
probe("ls ; rm -rf .",                bash_payload("ls ; rm -rf ."),              "BLOCK")
probe("ls; rm -rf . (no space)",      bash_payload("ls; rm -rf ."),               "BLOCK")
probe("git status && git push",       bash_payload("git status && git push origin main"), "BLOCK")

print()
print("--- Subshell command substitution ---")
# Policy (TASK-2026-06-01-SECURITY-HARNESS-WAVE-0-1 REVISE notes):
# Arbitrary metacharacter evaluation ($(...), backtick, $VAR -flag) cannot be
# reliably blocked without a full shell parser. Policy = ALLOW with prominent
# logged warning (not silently ALLOW). Expected=ALLOW here reflects that policy.
# The hook emits a WARNING line to stdout and writes to the audit log on these.
probe("$(echo rm) -rf .",             bash_payload("$(echo rm) -rf ."),           "ALLOW")
probe("`echo rm` -rf .",              bash_payload("`echo rm` -rf ."),            "ALLOW")

print()
print("--- Absolute paths ---")
probe("/bin/rm -rf /",                bash_payload("/bin/rm -rf /"),              "BLOCK")
probe("/usr/bin/rm -rf .",            bash_payload("/usr/bin/rm -rf ."),          "BLOCK")
probe("/usr/bin/curl https://x",      bash_payload("/usr/bin/curl https://x.com"),"BLOCK")
probe("/usr/local/bin/curl https://x",bash_payload("/usr/local/bin/curl https://x.com"),"BLOCK")

print()
print("--- env prefix wrapping dangerous commands ---")
probe("FOO=bar rm -rf .",             bash_payload("FOO=bar rm -rf ."),           "BLOCK")
probe("FOO=bar curl https://x",       bash_payload("FOO=bar curl https://x.com"), "BLOCK")
probe("WL_AGENT=x rm -rf .",          bash_payload("WL_AGENT=x rm -rf ."),        "BLOCK")
probe("WL_TASK_ID=t rm -rf .",        bash_payload("WL_TASK_ID=t rm -rf ."),      "BLOCK")
probe("A=b B=c curl https://x",       bash_payload("A=b B=c curl https://x.com"), "BLOCK")

print()
print("--- git push mid-pipeline ---")
probe("git log | git push",           bash_payload("git log | git push origin main"), "BLOCK")
probe("git status | git reset --hard",bash_payload("git status | git reset --hard HEAD"), "BLOCK")

print()
print("--- npm install bare (no args) ---")
probe("npm install bare (no args)",   bash_payload("npm install"),                "BLOCK")

print()
print("--- Output redirect variants — destructive (BLOCK) ---")
probe("echo x >file (no space after >)", bash_payload("echo x >file"),           "BLOCK")
probe("echo x > /etc/passwd",            bash_payload("echo x > /etc/passwd"),   "BLOCK")
probe("cat f1 > f2",                     bash_payload("cat f1 > f2"),             "BLOCK")
probe("echo secret >> .env",             bash_payload("echo secret >> .env"),     "BLOCK")
probe("echo x > config.json",            bash_payload("echo x > config.json"),   "BLOCK")
probe("foo | tee out.txt",               bash_payload("foo | tee out.txt"),       "BLOCK")
probe("cat k >> ~/.bashrc",              bash_payload("cat k >> ~/.bashrc"),      "BLOCK")

# Redirect strip end-anchor smuggle forms (TASK-2026-06-01-SECURITY-HARNESS-WAVE-0-1 REVISE-AGAIN)
# Unanchored strip ate /dev/null prefix, leaving a real write target that bypassed deny.
probe(">/dev/nullX smuggle",             bash_payload("echo pwned >/dev/nullX"),            "BLOCK")
probe(">/dev/null.txt smuggle",          bash_payload("echo pwned >/dev/null.txt"),         "BLOCK")
probe(">/dev/nullfoo smuggle",           bash_payload("echo pwned >/dev/nullfoo"),          "BLOCK")
probe(">/dev/null/../../tmp/evil",       bash_payload("echo pwned >/dev/null/../../tmp/evil"), "BLOCK")
probe(">/dev/stdoutXYZ smuggle",         bash_payload("echo pwned >/dev/stdoutXYZ"),        "BLOCK")
# Append smuggle — blocks for the right reason now (not a spurious >> pattern hit).
probe(">>/dev/nullX append smuggle",     bash_payload("echo x >>/dev/nullX"),               "BLOCK")
# Pass-1 fd-dup tail: 2>&1x must not pass
probe("2>&1x fd-dup tail smuggle",       bash_payload("echo x 2>&1x"),                      "BLOCK")

print()
print("--- Safe fd/devnull redirects — universal idioms (ALLOW) ---")
probe("echo hi 2>/dev/null",             bash_payload("echo hi 2>/dev/null"),     "ALLOW")
probe("ls >/dev/null",                   bash_payload("ls >/dev/null"),           "ALLOW")
probe("cmd 2>&1",                        bash_payload("cmd 2>&1"),                "ALLOW")
probe("cmd >/dev/null 2>&1",             bash_payload("cmd >/dev/null 2>&1"),     "ALLOW")
probe("cmd &>/dev/null",                 bash_payload("cmd &>/dev/null"),         "ALLOW")
probe("find . -name x 2>/dev/null",      bash_payload("find . -name x 2>/dev/null"), "ALLOW")
probe("git status 2>/dev/null | cat",    bash_payload("git status 2>/dev/null | cat"), "ALLOW")
probe("cmd | tee /dev/null",             bash_payload("cmd | tee /dev/null"),     "ALLOW")
probe("2> /dev/null spaced form",        bash_payload("cmd 2> /dev/null"),        "ALLOW")
probe("(echo hi >/dev/null) subshell",   bash_payload("(echo hi >/dev/null)"),    "ALLOW")
probe("(cmd 2>/dev/null) subshell",      bash_payload("(cmd 2>/dev/null)"),       "ALLOW")

print()
print("--- Newline injection ---")
newline_cmd = "git status\nrm -rf /"
probe("newline injection (rm after newline)", bash_payload(newline_cmd),          "BLOCK")

print()
print("--- Obfuscated variable assignment ---")
# Policy: same as subshell substitution above — ALLOW with logged warning.
probe("X=rm; $X -rf .",               bash_payload("X=rm; $X -rf ."),            "ALLOW")

print()
print("--- Known-safe commands (should ALLOW) ---")
probe("git fetch (allow)",            bash_payload("git fetch origin"),           "ALLOW")
probe("git status (allow)",           bash_payload("git status"),                 "ALLOW")
probe("git commit (allow)",           bash_payload('git commit -m "fix: thing"'), "ALLOW")
probe("npm run build (allow)",        bash_payload("npm run build"),              "ALLOW")
probe("npm ci (allow)",               bash_payload("npm ci"),                     "ALLOW")
probe("sed without -i (allow)",       bash_payload("sed 's/foo/bar/' file"),      "ALLOW")
probe("jq query (allow)",             bash_payload("jq '.rails' .harness/worldline-harness.config.json"), "ALLOW")
probe("python3 -m http.server (allow)", bash_payload("python3 -m http.server 8765"), "ALLOW")
probe("WL_AGENT=x bash hook (allow)", bash_payload("WL_AGENT=canopus bash .claude/hooks/sign-work.sh TASK-123"), "ALLOW")
probe("chmod +x hook (allow)",        bash_payload("chmod +x .claude/hooks/new-hook.sh"), "ALLOW")
probe("find . (allow)",               bash_payload('find . -name "*.sh" -type f'), "ALLOW")
probe("ls (allow)",                   bash_payload("ls .harness/"),               "ALLOW")
probe("grep (allow)",                 bash_payload('grep -r "barrier_class" .harness/'), "ALLOW")
probe("grep with curl arg (allow)",   bash_payload("grep -r 'curl' scripts/"),           "ALLOW")
probe("bash curl-helper.sh (allow)",  bash_payload("bash scripts/curl-helper.sh"),       "ALLOW")
probe("npm run curl-test (allow)",    bash_payload("npm run curl-test"),                  "ALLOW")
probe("find curl glob (allow)",       bash_payload("find . -name '*curl*' -type f"),      "ALLOW")
probe("awk curl pattern (allow)",     bash_payload("awk '/curl/' file.log"),              "ALLOW")
probe("npm run wget-test (allow)",    bash_payload("npm run wget-test"),                  "ALLOW")
probe("mkdir -p (allow)",             bash_payload("mkdir -p .claude/hook-logs"), "ALLOW")

print()
bypasses = [r for r in RESULTS if not r[0]]
total = len(RESULTS)
passed = total - len(bypasses)
print(f"=== RESULTS: {passed}/{total} expected ===")
if bypasses:
    print()
    print("BYPASSES FOUND:")
    for (ok, label, expected, actual) in bypasses:
        print(f"  *** {label}: expected={expected} got={actual}")
    sys.exit(1)
else:
    print("All adversarial probes produced expected results.")
    sys.exit(0)
