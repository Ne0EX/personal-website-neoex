# TO · Canopus (α-HRN-07)
# FROM · Polaris (α-OPS-00)
# TASK · TASK-2026-05-15-META-5
# TYPE · TASK CONTRACT
# CREATED · 2026-05-15
# MODEL TIER · sonnet
# TRIGGER · Peat directive 2026-05-15 — robustness wave before resuming Phase 2; verify shipped harness tooling actually works in live state

---

## scope

Validate that META-1, META-3, META-4 work product **actually runs cleanly on live repo state**, not just synthetic fixtures. Today they shipped with rate-limit interruption; return handoffs are partial or missing. Don't trust until verified end-to-end.

## vision fidelity

not applicable · harness verification work, no brand surface touched

## canonical inputs

- `scripts/next-dispatchable.sh` + `scripts/_next-dispatchable.fixture.sh` (META-1 product · already on disk)
- `.claude/hooks/save-checkpoint.sh` + `scripts/save-checkpoint.sh` (META-4 product · in-flight; verify after closure)
- `.claude/hooks/pre-handoff.sh` (META-3 product · STATUS section-lock; verify enforcement)
- `docs/harness/RAIL-DEFINITIONS.md` (rails should be documented post-META-3)
- `docs/team/STATUS.md` (live state; expect section-lock format if META-3 landed)
- `.claude/handoffs/from-canopus/TASK-2026-05-15-META-{1,3,4}--to-polaris.md` if exist · read what shipped vs what's missing

## deliverables

`docs/qa/REPORTS/META-5-live-verify.md` containing:

1. **META-1 verification** — run `bash scripts/next-dispatchable.sh` against current STATUS.md + handoffs + signatures; capture output; assert: emits machine-readable + human-readable forms; correctly identifies which queued TASKs (TASK-23/24/26/31/33/52/11-S1/11-S2) are blocked by Vision Fidelity freeze + which META are dispatchable
2. **META-3 verification** — simulate non-Polaris agent attempting full-file STATUS.md rewrite via pre-handoff.sh; assert: rejected with clear message + recommended staging path; assert: section-append from whitelisted agent passes
3. **META-4 verification** — trigger Stop event (manually emit); trigger PostToolUse(Agent) ≥3 in turn; trigger `bash scripts/save-checkpoint.sh "test"`; assert: `docs/team/SAVE-POINT.md` updated + `.checkpoints/` archive entry created; assert: <1s wall time; assert: zero model calls (read script source)
4. **Patches** — any small fixes needed to make ANY of the three work cleanly · ship as part of THIS TASK · sign together

## constraints

- Do NOT modify any persona file
- Do NOT modify STATUS.md (use staging files per META-3 protocol if needed)
- Verification work only — if you find a SUBSTANTIAL bug needing rewrite, write a follow-up TASK and flag
- Run on real working tree (not isolated branch); use git-stash if you need a clean state for a test

## harness protocol

- pre-task.sh Step 0 (use `TASK-2026-05-15-META-5`)
- sign-work.sh on completion
- Return handoff at `.claude/handoffs/from-canopus/TASK-2026-05-15-META-5--to-polaris.md`

## acceptance criteria

- 3 verification sections completed with PASS/PARTIAL/FAIL verdicts
- All small patches signed in same TASK
- If any of META-1/3/4 has a structural bug → flag as REVISE handoff to its author (yourself, in your META-* role), do NOT silently fix
- Signature v2 clean

## downstream impact

Unblocks **robustness wave** (META-6/7/8/9). Without META-5 passing, no point investing in META-6+ — same untested-tooling risk repeats.

---

*polaris · α-OPS-00 · 2026-05-15 · live verification gate*
