---
task_id: TASK-2026-05-15-08
audit_id: TASK-2026-05-15-08-audit
from: algol
to: polaris
date: 2026-05-15
priority: high
subject: QA cross-check of TASK-08 journey-architecture (first TASK under new Algol-cross-check rule)
---

# TASK-2026-05-15-08 · QA audit return · Algol to Polaris

## verdict · PASS WITH INTEGRITY-PARTIAL

The work closes. The signature has a structural attribution problem that does not require rejection.

## summary

Betelgeuse delivered `docs/design/journey-architecture.md` — 635 lines, 13 sections, 10 contract sections satisfied, all gaps A–F decided, 01–13 inventory complete with verdicts, 21-decision anti-Codex audit embedded as §10. Writing is rigorous. The 9 confirm flags are legitimate escalations to Peat, not hedges.

The signature is compromised in a predictable and disclosed way:

1. `pre-task.sh` was not run. No baseline file exists. sign-work.sh hit the fallback path.
2. The fallback captured three carry-over dirty files from prior tasks (README.md, WorldlineGlobe.tsx, STATUS.md) — none written by Betelgeuse in TASK-08.
3. The fallback missed the actual deliverable (`docs/design/journey-architecture.md`) entirely — `git diff --diff-filter=AMD` is blind to untracked files.
4. STATUS.md has a three-way hash mismatch: sig ≠ working tree ≠ HEAD. Cause: Polaris wrote the TASK-08 wave section into STATUS.md at 11:51:09, after the signature was written at 11:48:56. The intermediate state the signature captured no longer exists.

All of this is fully disclosed in the return handoff §known deviations.

**Why not INTEGRITY-FAIL:** the failure is disclosed, deterministically caused, and independently verifiable. The deliverable is real. The signature is internally self-consistent (self_hash verified). No malfeasance.

## what you need to do

1. **Accept TASK-08 as closed.** The spec is ready.

2. **Log in STATUS.md:** `signature attribution incorrect — pre-task.sh not run; deliverable path missing from files_touched; disclosed in return handoff; Algol audit confirms deliverable real and complete`.

3. **Send HOOK PROPOSAL to Canopus** (copy this text):
   > sign-work.sh fallback path (activated when no baseline exists) currently runs `git diff --name-only --diff-filter=AMD HEAD`. This misses newly-created untracked files. Add `git ls-files --others --exclude-standard` to the fallback enumeration so new files are captured. Priority HIGH — this gap will recur on any task where an agent creates a new file without running pre-task.sh first. The baseline-aware path already handles this correctly.

4. **Add to WORKFLOW.md kickoff checklist** (Polaris owns WORKFLOW.md): "Step 0: run pre-task.sh before any edit." This was Betelgeuse's own recommendation in her return handoff. The canopus-signwork-scope fix is not enough without agents actually running the hook.

5. **Dispatch β/γ/δ** (TASK-09, TASK-10, TASK-11). The spec is complete. β and γ can run in parallel immediately after α closes. δ-S1 (Arcturus opus) also runs parallel to β and γ.

6. **Walk Peat through the 9 confirm flags** in `docs/design/journey-architecture.md §13` before dispatching downstream tasks. Flag #7 (discard PRD-02 fork screen entirely) is the highest-stakes one; if Peat reverses it, several decisions in β/γ re-thread.

## flags requiring Peat's attention (§13 summary)

1. §1 M1 — no hard fork screen (PRD-02 reframe)
2. §1 M6 — AttractorFields↔Globe two-way binding deferred
3. §1 M-RETURN — no return dashboards in v1
4. §2.2 — fiction-on-Globe deferred
5. §3.4 — fiction entry waits one wave
6. §5.2 — left rail no list toggle (alternative: small LIST link in A.T.L.A.S. head bar)
7. §6.1 — discard PRD-02 fork screen entirely (biggest call; most likely to be revisited)
8. §6.2 — Globe lands in ALL on every visit; no stratum memory
9. §7.4 — pinch-zoom disabled on mobile Globe

## hook proposal to canopus

From the audit, Canopus should also consider:
- sign-work.sh empty `steps` array: add auto-population from the post-edit log so the steps field has at minimum the three hook names that ran.
- visual-diff STATUS: add `not-applicable-spec-only` as a valid STATUS value for spec tasks, so `betelgeuse-approved` is reserved for actual UI reviews.

## audit report

Full six-step gauntlet at `docs/qa/REPORTS/TASK-2026-05-15-08-betelgeuse.md`.

Audit log entry appended to `.claude/signatures/AUDIT.md`.

---

*algol · α-VER-06 · the Demon-Star · TASK-2026-05-15-08 audit complete · verdict: PASS WITH INTEGRITY-PARTIAL*
