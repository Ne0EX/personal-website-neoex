---
task_id: TASK-2026-05-15-13
from: polaris
to: canopus
date: 2026-05-15
priority: high
model: sonnet
parent_audit: docs/qa/REPORTS/TASK-2026-05-15-12-canopus.md (Algol's findings on TASK-12)
parent_audit_2: docs/qa/REPORTS/TASK-2026-05-15-08-betelgeuse.md (Algol's TASK-08 hook proposal)
---

# TASK-2026-05-15-13 · Harness hardening — fix 4 systemic defects from Algol audits

## scope

Algol's QA cross-checks on TASK-08 and TASK-12 surfaced four real defects in the harness layer. Two are bugs in audit scripts Canopus just shipped (D1, D2). Two are systemic gaps that produced INTEGRITY-PARTIAL signatures three times in a row (D3, D4). All four are Canopus territory; all four are bash-level fixes.

Until these land, the harness "passes" tasks whose signatures don't actually represent the work done, and the territory rail will false-positive on every commit that includes audit scripts.

## acceptance — must be true after this TASK closes

- audit-territory.sh stripping `(...)` comments correctly → no false-positives on FILE-OWNERSHIP lines with parenthetical descriptions
- audit-design-tokens.sh actually detects hex on macOS BSD grep → no silent false-negatives
- sign-work.sh fallback path captures untracked files → INTEGRITY-PARTIAL stops being the default verdict on every TASK
- WORKFLOW.md kickoff section explicitly names "Step 0: run pre-task.sh" → agents don't skip the baseline

## slices

### S1 · Canopus — fix D1 (territory script glob parser)

**root cause:** `extract_globs()` awk function strips backticks but not the `(...)` parenthetical comment Polaris/Canopus include in FILE-OWNERSHIP.md lines.

**fix options (your call — pick one + document choice):**
- (a) Add `gsub(/ +\([^)]*\).*/, "", line)` to strip everything from " (" onward
- (b) Update FILE-OWNERSHIP.md to use em-dashes for inline comments on every line (script unchanged)
- (c) Both — script handles parens defensively + FILE-OWNERSHIP convention shifts to em-dashes

**recommended** · (a) — script-level defensiveness is preferred because future authors will mix conventions; the parser should be robust.

**verification** · simulate Canopus touching `scripts/audit-territory.sh` (stage it as if committed); `WL_AGENT=canopus bash scripts/audit-territory.sh` against that baseline → must PASS (currently FAIL per Algol's test).

### S2 · Canopus — fix D2 (design-tokens grep -P branch)

**root cause:** `grep --version 2>&1 | grep -q 'GNU'` matches BSD grep's "GNU compatible" string and incorrectly takes the GNU `-P` branch. `-P` is unsupported by BSD grep; exits 2; error swallowed by `2>/dev/null || true`; MATCHES is empty; rail PASS regardless of actual hex.

**fix** · Algol recommends a direct capability probe: `grep -P '' /dev/null 2>/dev/null && HAS_P=true || HAS_P=false`. Even simpler: drop the branch entirely and always use `-E` (BSD `-E` produces correct results, per Algol's verification).

**verification** · plant a deliberate raw-hex violation in a test file under `app/` or `components/` → run audit-design-tokens.sh → must FAIL with `file:line:value`. Then clean up the planted violation.

### S3 · Canopus — fix D3 (sign-work.sh untracked-files fallback) — Algol's hook proposal

**root cause:** when pre-task.sh hasn't run (no baseline), sign-work.sh falls back to `git diff --name-only --diff-filter=AMD HEAD`. This captures modified/added/deleted files but does NOT capture **untracked** files. Newly authored deliverables on a freshly checked out branch are invisible. Confirmed three consecutive times: TASK-08 (Betelgeuse's journey-architecture.md untracked), TASK-12 (Canopus's 5 audit scripts + config.json all untracked), TASK-12-audit (Algol's own QA report untracked).

**fix** · in the no-baseline fallback path of sign-work.sh, additionally invoke `git ls-files --others --exclude-standard` and merge with the diff output. Deduplicate.

**verification** · 
1. Smoke test: from a clean state with one untracked file `test-new.md`, run sign-work.sh; signature's files_touched MUST include `test-new.md`. Clean up after.
2. Re-sign one of the closed TASKs as a self-test (you don't need to embed the new sig anywhere — just verify the script produces the right files_touched list).

### S4 · Canopus — fix D4 (WORKFLOW.md kickoff Step 0)

**root cause:** WORKFLOW.md kickoff section doesn't tell agents to run pre-task.sh before their first edit. Result: agents skip the baseline, sign-work hits fallback, INTEGRITY-PARTIAL becomes the norm.

**fix** · add an explicit numbered step to the "agent picks up TASK" section:

```
Step 0 · run `WL_TASK_ID=<task_id> WL_AGENT=<your-codename> bash .claude/hooks/pre-task.sh <task_id> <agent>`
         This writes the baseline at .claude/hook-logs/<task_id>--baseline.json
         which sign-work.sh later uses to scope files_touched to ONLY this
         task's edits. Skipping this step yields INTEGRITY-PARTIAL signatures
         per Algol's audit pattern (TASK-08, TASK-12).
```

Place it logically with the existing kickoff (Step 1: read assignment; Step 2: read territory; etc.).

**verification** · WORKFLOW.md grep for "Step 0" returns the new section + cross-references in nearby places (pre-handoff section already mentions pre-task as a prerequisite for the baseline mechanism — keep that, just make Step 0 explicit at kickoff).

### S5 · Canopus — sign + return

**output**
- Run `WL_TASK_ID=TASK-2026-05-15-13 WL_AGENT=canopus bash .claude/hooks/pre-task.sh TASK-2026-05-15-13 canopus` **before any edits** (your own dogfood test of the new rule)
- Sign: `WL_AGENT=canopus WL_NEXT=polaris WL_SUMMARY="harness hardening — 4 defects fixed (D1-D4) from Algol audits" bash .claude/hooks/sign-work.sh TASK-2026-05-15-13`
- Signature must have BOTH gates green AND files_touched should include the actual fixed files (sign-work.sh, audit-territory.sh, audit-design-tokens.sh, WORKFLOW.md) — proving D3 fix works on its own sign

- Return handoff at `.claude/handoffs/from-canopus/TASK-2026-05-15-13--to-polaris.md`
- Update STATUS.md: close TASK-13 with self_hash; close out the four-defect note from TASK-12 entry

## non-goals

- Do NOT modify rail definitions (only fix the broken implementations)
- Do NOT add new rails (3 stubs stay stubs; their real implementations are separate follow-up TASKs)
- Do NOT touch any non-Canopus territory
- Do NOT re-issue TASK-08 or TASK-12 signatures — those are historical record now; the fix applies forward

## dependencies

None. Standalone Canopus work.

## acceptance (whole task)

- D1 fix landed + verified
- D2 fix landed + verified (with a deliberate-violation-then-cleanup smoke test)
- D3 fix landed + verified (untracked files now appear in files_touched on fresh signature)
- D4 landed in WORKFLOW.md
- Canopus's own TASK-13 signature is the first one in team history that DOESN'T trigger INTEGRITY-PARTIAL on the untracked-file pattern — Algol's audit on this TASK should confirm

## deadline

ASAP — every TASK closing in the interim ships an INTEGRITY-PARTIAL signature.

---

*polaris · α-OPS-00 · 2026-05-15*
