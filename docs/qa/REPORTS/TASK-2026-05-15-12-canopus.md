# docs/qa/REPORTS/TASK-2026-05-15-12-canopus.md

## task · rail config + 5 audit scripts (2 real + 3 stubs)

## verdict · PASS WITH INTEGRITY-PARTIAL AND TWO DEFECTS FLAGGED

---

## 1 · signature integrity

**schema version:** `signature_schema_version: 2` — present. All v2 required fields present.
`agent`, `agent_designation`, `pre_cutover_codename`, `task_id`, `started_at`, `completed_at`,
`files_touched`, `summary`, `steps`, `hashes.files_sha256`, `hashes.self_hash`, `harness_passed`,
`next_recipient.agent`, `next_recipient.designation`.

Note: `post_edit_passed` is absent from the signature (field not in the payload). The signature's
`harness_passed: true` is present. `post_edit_passed` is a declared required field per the
config's own `signature_policy.fields_required` list (line 61 of worldline-harness.config.json).
This is a minor inconsistency but does not affect SCHEMA.md v2 verification, which does not list
`post_edit_passed` as required in its field notes. Not flagging as SCHEMA-FAIL.

**self_hash recomputation** (`jq -cS 'del(.hashes.self_hash)' | shasum -a 256`):

```
computed  : 1965f7d9217f43756931e91057b703f556b78f27568e76e3d2f04b1e2c707074
claimed   : 1965f7d9217f43756931e91057b703f556b78f27568e76e3d2f04b1e2c707074
verdict   : MATCH
```

**files_sha256 — working tree audit (2 files in `files_touched`):**

| file | sig claims | working tree | verdict |
|------|-----------|--------------|---------|
| `.claude/signatures/AUDIT.md` | `5dcafab1…` | `5dcafab1…` | MATCH |
| `docs/team/STATUS.md` | `e4288aaf…` | `30dcc257…` | **MISMATCH** |

STATUS.md mismatch root cause: same pattern as TASK-08. Polaris (or Canopus themselves) wrote
to STATUS.md after the signature was computed. The signature captured an intermediate STATE.md
that no longer exists. The TASK-12 entry in STATUS.md (lines 289–316) confirms Canopus did
update STATUS.md as required by S5, but the update post-dated the signing moment.

**actual deliverables (not in `files_touched`):**

| file | status | sha256 (working tree) |
|------|--------|-----------------------|
| `.harness/worldline-harness.config.json` | untracked, exists | confirmed present |
| `scripts/audit-territory.sh` | untracked, exists | confirmed present |
| `scripts/audit-design-tokens.sh` | untracked, exists | confirmed present |
| `scripts/audit-next-api.sh` | untracked, exists | confirmed present |
| `scripts/audit-voice.sh` | untracked, exists | confirmed present |
| `scripts/audit-a11y.sh` | untracked, exists | confirmed present |

All six deliverables exist on disk and are verifiable directly. Canopus disclosed this deviation
fully in the return handoff §known deviations — same systemic cause as TASK-08 (no `pre-task.sh`
baseline → untracked files invisible to `git diff HEAD` fallback path → not in `files_touched`).

**next_recipient check:** `α-OPS-00` = Polaris — on roster. PASS.

**pre_cutover_codename check:** `"Rigel"` → Canopus (α-HRN-07) — Nomenclature table confirms. PASS.

**out-of-scope file check:** `git diff HEAD` shows four dirty tracked files:
`.claude/signatures/AUDIT.md`, `README.md`, `components/WorldlineGlobe.tsx`, `docs/team/STATUS.md`.
AUDIT.md and STATUS.md are declared in `files_touched`. README.md and WorldlineGlobe.tsx are
carry-overs from prior tasks (not modified by TASK-12; hash unchanged). Not declared in signature
— correct: the baseline-aware algorithm would exclude them (their hashes match their pre-task state).
CLEAN on carry-over handling.

**STEP 1 VERDICT: INTEGRITY-PARTIAL**

Same classification as TASK-08: fully disclosed, tooling-gap root cause, internally self-consistent
self_hash, real deliverables verified at correct paths. Not INTEGRITY-FAIL (no contradiction between
claims and reality requiring rejection). This is the second consecutive sample confirming the
systemic bug.

---

## 2 · acceptance criteria

**S1 · `.harness/worldline-harness.config.json`**
- Exists: YES
- Valid JSON: YES (jq parse succeeds)
- Shape matches harness-check.sh parser `jq -r '.rails | to_entries[] | "\(.key)\t\(.value.check)"'`: YES
  Output confirms all 5 rails: territory, design-tokens, next-16-api, voice-discipline, accessibility-floor
- Additional metadata fields (description, applies_to, status, rail_doc): present and reasonable
- PASS

**S2 · `scripts/audit-territory.sh`**
- Exists: YES
- Mode 755: YES (`-rwxr-xr-x`)
- `bash -n` syntax clean: YES
- `set -euo pipefail`: YES (line 36)
- Baseline-aware algorithm: YES — reads `.claude/hook-logs/<TASK_ID>--baseline.json`,
  falls back to full `git diff HEAD` with stderr warning if absent
- Permanent whitelist (STATUS.md, AUDIT.md, handoffs, signatures, hook-logs): YES — all present
- Ambiguity default (unassigned → FAIL with `file:unassigned`): YES — verified in smoke test:
  README.md correctly reports `:unassigned`
- POSIX awk (no GNU extensions): YES

Smoke tests run:
```
WL_AGENT=canopus WL_TASK_ID=TASK-SMOKE-TEST → FAIL (README.md:unassigned, WorldlineGlobe.tsx:sirius)
[correct: no baseline, full diff shows carry-overs not in canopus territory]

WL_AGENT=sirius WL_TASK_ID=NONEXISTENT-smoke → FAIL (README.md:unassigned)
[correct: WorldlineGlobe.tsx NOT listed because sirius owns it, README.md correctly unassigned]
```

Recursive self-violation test (canopus touching WorldlineGlobe.tsx in baseline-aware mode):
FAIL with `components/WorldlineGlobe.tsx:sirius` — CORRECT.

STATUS.md whitelist test (canopus "modifying" STATUS.md in baseline-aware mode):
PASS — whitelist correctly suppresses the violation.

**DEFECT D1 — glob parsing for parenthetical file-ownership lines (NON-BLOCKING, must fix)**

FILE-OWNERSHIP.md line 129: `- \`scripts/audit-*.sh\` (shells that wrap Algol's audit scripts)`
The awk parser strips em-dash comments but not parenthetical comments. Because this line has
NO em-dash separator, the full line after backtick-stripping becomes the glob:
`scripts/audit-*.sh (shells that wrap Algol's audit scripts)`

This glob will NOT match `scripts/audit-territory.sh`. Verified by direct test: staging
`scripts/audit-territory.sh` and running the territory check with a baseline-aware mode returns
`scripts/audit-territory.sh:unassigned` (FAIL) instead of PASS.

Same issue affects `.gitignore` line (but dormant — .gitignore is tracked and clean, so it
only triggers if .gitignore is modified in a future task).

Affected globs where parenthetical is not stripped:
- `scripts/audit-*.sh (shells that wrap Algol's audit scripts)` — active issue, will fire on first commit of audit scripts
- `.gitignore (runtime artifact entries` — partial strip (em-dash mid-comment); produces `.gitignore (runtime artifact entries` which also won't match `.gitignore`

The real deliverables (the audit scripts themselves) are currently untracked, so this defect has
not yet caused a false positive in practice. It WILL trigger the first time Canopus's scripts
are committed and the territory rail runs against a commit that includes them.

Fix: awk parser must also strip `[[:space:]](.*` patterns (parenthetical comments) from the glob.

**S3 · `scripts/audit-design-tokens.sh`**
- Exists: YES
- Mode 755: YES
- `bash -n` syntax clean: YES
- Whitelist (app/globals.css, WorldlineGlobe.tsx): YES
- Tailwind inline-hex decision: REJECT (strict) per contract — YES, documented in header
- Current tree: PASS (13 files scanned, 0 violations outside whitelist) — verified by direct
  `-E` grep scan: confirmed no hex outside the two whitelisted files.
- BSD/GNU grep fallback logic: present

**DEFECT D2 — design-tokens grep branch mismatch (NON-BLOCKING on current tree, WILL cause silent false negatives)**

The GNU-detection logic `grep --version 2>&1 | grep -q 'GNU'` fires against macOS's
`/usr/bin/grep` which identifies itself as "BSD grep, GNU compatible". The string "GNU" appears
in the version output → the GNU branch fires → `grep -nP` is invoked.

`/usr/bin/grep` (BSD grep 2.6.0-FreeBSD) does NOT support `-P` (Perl-compatible regex).
When invoked with `-P`, it exits with code 2 and prints to stderr (`grep: invalid option -- P`).
The script captures output as `MATCHES=$(grep -nP ... 2>/dev/null || true)`. The `2>/dev/null`
swallows the error message; the `|| true` swallows the exit code 2; `MATCHES` is assigned empty.

Result: the GNU branch silently produces no violations on macOS, making the rail a no-op.

The current tree DOES pass legitimately (no hex outside whitelist), but the mechanism is broken.
Any future violation would be silently missed.

The BSD fallback branch (`-E`) works correctly (verified by direct test). The fix is to check
for `-P` support explicitly (`grep -P '' /dev/null 2>/dev/null && echo yes || echo no`) rather
than relying on the "GNU" string in the version output, OR to remove the branch distinction
entirely and always use `-E` (which works on both GNU grep and BSD grep).

**S4 · Three stubs**
- All three (`audit-next-api.sh`, `audit-voice.sh`, `audit-a11y.sh`): mode 755, bash -n clean
- All exit 0 with stub message: YES (verified)
- Stub messages include rail name + TODO + tracking reference: YES
- Header comments document required collaborators and unblock conditions: YES, clearly written
  (audit-voice.sh documents Arcturus → Algol → Canopus dependency chain)
- None accidentally FAIL the harness: CONFIRMED (all exit 0)

PASS on stub implementation.

**S5 · Harness verification**
- `harness-check.sh` exits 0 with all 5 rails reporting: VERIFIED

```
[harness] task=TASK-2026-05-15-12
  [pass] territory :: [territory] PASS — all files within canopus's territory
  [pass] design-tokens :: [design-tokens] PASS — no raw hex outside whitelist (scanned 13 file(s))
  [pass] next-16-api :: [next-16-api] STUB — rail not enforcing yet
  [pass] voice-discipline :: [voice-discipline] STUB — rail not enforcing yet
  [pass] accessibility-floor :: [accessibility-floor] STUB — rail not enforcing yet
[harness] PASS — all rails clean
exit: 0
```

PASS.

**STEP 2 VERDICT: PASS WITH TWO DEFECTS FLAGGED (non-blocking on current tree)**

The two defects (D1 glob parsing, D2 grep branch) are real bugs that will cause silent failures
in future tasks. They are classified non-blocking here because:
- D1: all deliverable scripts are currently untracked; the bug has no victim yet
- D2: the current tree is genuinely clean; the detection failure has no false negative consequence today

Both should be fixed before the first commit that includes the audit scripts.

---

## 3 · quality bar — substance of the 2 real audits

**territory script quality**

The whitelist logic is correct and well-reasoned. Adding AUDIT.md to the permanent whitelist
(not in the original contract's spec, but disclosed in §known deviations) is a sound design
decision given parallel task execution. Algol concurs.

The awk glob extractor correctly handles em-dash stripped comment lines and backtick-quoted paths
for most entries. The parenthetical issue (D1 above) is the only pattern miss.

The fallback behavior (full git diff + stderr warning) is consistent with sign-work.sh's fallback
semantics — good design for consistency.

Untracked file limitation is documented in code comments at lines 70-74 and in the return handoff.
This is acceptable disclosure, not evasion.

**design-tokens script quality**

The scan scope (app/**, components/**), whitelist, and strict Tailwind decision are all correct
per contract. The violation report format (`file:line:value`) matches the contract spec. The
fix instructions in the script footer are well-written.

The only quality issue is D2 (silent grep failure on macOS), which is a behavioral defect.

**STEP 3 VERDICT: GOOD QUALITY — defects flagged are implementation bugs, not design problems**

---

## 4 · regression scan

All existing hook scripts (`pre-task.sh`, `harness-check.sh`, `post-edit.sh`, `sign-work.sh`,
`pre-handoff.sh`) syntax-clean after TASK-12 (`bash -n` confirms). TASK-12 did not modify any
hook scripts — Canopus correctly identified that only `.harness/` and `scripts/audit-*.sh` needed
to be touched.

Hook flow (pre-task.sh → harness-check.sh → post-edit.sh → sign-work.sh → pre-handoff.sh):
No breakage introduced. harness-check.sh now executes meaningfully instead of warning about
missing config.

`harness-check.sh` with full env exits 0: VERIFIED above.

**STEP 4 VERDICT: NO REGRESSIONS**

---

## 5 · accessibility

Not applicable — no UI surface changed.

---

## 6 · cross-impact

Scripts deployed to `scripts/` and config to `.harness/` — both Canopus territory per FILE-OWNERSHIP.md.
AUDIT.md modified (Algol territory, whitelisted). STATUS.md modified (Polaris territory, whitelisted).

Harness-check.sh reads `.harness/worldline-harness.config.json` — config was absent before this task,
causing harness-check.sh to warn and exit 0. Now it runs all 5 rails. This is additive, not breaking:
existing consumers of harness-check.sh see a richer output, same exit semantics (0 = pass).

New territory rail will now flag agents who make cross-territory edits if run from a baseline-aware
env. This is the intended effect. Territory rail correctly fires on sirius touching README.md:unassigned
and correctly passes for canopus on STATUS.md (whitelisted).

**STEP 6 VERDICT: CLEAN**

---

## defect summary (for Canopus)

**D1 · territory script glob parser doesn't strip parenthetical comments**
Severity: MUST FIX before scripts are committed (will cause false violations)
File: `scripts/audit-territory.sh`
Location: `extract_globs()` awk function and `ALL_AGENT_GLOBS` awk block
Affected FILE-OWNERSHIP.md lines: line 129 (`scripts/audit-*.sh (shells...)`), line 135 (`.gitignore (runtime...`)
Fix: add `gsub(/ +\([^)]*\).*/, "", line)` (strip `<space>(...)` parenthetical) before the em-dash strip,
OR restructure FILE-OWNERSHIP.md entries to use em-dash for all comment separators.

**D2 · design-tokens script silently no-ops on macOS due to grep -P not supported**
Severity: MUST FIX before relying on this rail to enforce (currently false-passes silently)
File: `scripts/audit-design-tokens.sh`
Location: grep branch detection at line 79
Current: `grep --version 2>&1 | grep -q 'GNU'` — matches BSD grep "GNU compatible" string
Fix: probe for `-P` support directly (`grep -P '' /dev/null 2>/dev/null`) OR always use `-E`
(the `-E` branch already works correctly; remove the branch distinction entirely)

---

## signature audit entry

See `.claude/signatures/AUDIT.md` for the condensed entry.

---

## notes (not blocking, forwarded to Polaris)

- This is the **second consecutive INTEGRITY-PARTIAL** on the same root cause (untracked files +
  no `pre-task.sh` baseline). TASK-08 (Betelgeuse) and TASK-12 (Canopus). The hook proposal
  from TASK-08 (`git ls-files --others --exclude-standard` in sign-work.sh fallback) should become
  TASK-13. Two data points establish the pattern as systemic.

- The three stub scripts have excellent documentation. The dependency chain for audit-voice
  (Arcturus → Algol → Canopus sequential) is correctly identified and will save confusion when
  those TASKs are opened.

- The AUDIT.md whitelist decision is sound and should be codified in FILE-OWNERSHIP.md: add a
  clarifying note that AUDIT.md is cross-agent shared state (same class as STATUS.md). Currently
  only STATUS.md has this note.

- `worldline-harness.config.json` is not mode 755 (it's 644, a config file). This is correct —
  no need to make a JSON config executable. Noted for completeness.

---

*algol · α-VER-06 · 2026-05-15*
