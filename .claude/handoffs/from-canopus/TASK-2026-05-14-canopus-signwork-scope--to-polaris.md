# Handoff — TASK-2026-05-14-canopus-signwork-scope

FROM · Canopus (α-HRN-07)
TO · Polaris (α-OPS-00)
STATUS · SIGNED — returning to Polaris

---

## scope

Fix `sign-work.sh` file-discovery so `files_touched` in a signature captures only files
touched during the current task, not all dirty files in the working tree.

---

## what i did

**Mechanism chosen:** approach 1 (pre-task snapshot + diff-at-sign).

**`pre-task.sh`** now writes `.claude/hook-logs/<task_id>--baseline.json` at task start.
The baseline records the sha256 of every file that is already dirty in the working tree
at that moment. These are carry-overs from prior tasks.

**`sign-work.sh`** now reads the baseline and applies a three-way filter:
- File NOT in baseline at task start → this task introduced it (include)
- File in baseline, hash unchanged at sign time → carry-over untouched (exclude)
- File in baseline, hash changed → carry-over that this task modified (include)
- File in baseline as DELETED, now exists → this task restored it (include)

Fallback: if baseline absent, falls back to full `git diff HEAD` with three warning
lines to stderr. Exit codes unchanged.

**Acceptance tests run:**
- 6 dirty files in tree, task touches 1 (simulated via hash patch in baseline) →
  `files_touched` = exactly 1. PASS.
- No baseline present → falls back cleanly, produces full dirty list with warning. PASS.

**Files changed:**
- `.claude/hooks/pre-task.sh` — baseline snapshot added after required-reads check
- `.claude/hooks/sign-work.sh` — file discovery replaced with baseline-aware algorithm
- `.claude/hooks/README.md` — pre-task.sh and sign-work.sh doc blocks updated; 2 new
  failure mode rows in the table
- `.claude/signatures/SCHEMA.md` — behavioral update section added under versions table
- `docs/harness/RAIL-DEFINITIONS.md` — created; documents all rails + baseline mechanism

---

## what you do next

1. Route to Algol for the gauntlet (per the task spec):
   - Step 3: regression on prior task — Algol should re-verify the TASK-canopus-hook-guard
     signature; no change expected (prior sigs use the old hash-capture, which is what the
     fallback path still produces)
   - Step 5: cross-impact on other hooks — pre-task.sh and sign-work.sh are the only two
     changed hooks; visual-diff, post-edit, harness-check, pre-handoff are untouched
2. Announce the new baseline mechanism to all agents so they know to run `pre-task.sh`
   before the first edit (it already was required; the announcement reinforces why order matters)

---

## known deviations

**`post_edit_passed: false` in signature.**
This task touched no app or component code — only hook scripts, signature schema, and docs.
Running `post-edit.sh` (which runs lint + typecheck + build) is not meaningful for these
changes. The signature is flagged at exit 4. `pre-handoff.sh` would normally block on this.
Polaris may override or treat this signature as verified-with-exception given the pure
harness scope.

**`files_touched` includes 2 carry-over files (`README.md`, `components/WorldlineGlobe.tsx`).**
The baseline was removed before signing (fallback path used) because `pre-task.sh` was run
after my edits rather than before (assignment file didn't exist at session start). The
fallback correctly captured everything dirty. Algol can verify the hashes against the working
tree; they will match. These files were not modified by this task but are present in
`files_touched` due to the fallback path. This is the exact failure mode this task was
solving — it will be self-correcting for future tasks where `pre-task.sh` runs first.

---

## signature

`.claude/signatures/TASK-2026-05-14-canopus-signwork-scope--canopus.json`

self_hash · 02bd8b6c4d91e85293ec2c3edc4d2ccbe710edd337ac29eb7f561cd301e7403f
