# Workflow

> How a directive from Peat becomes shipped code. End-to-end. Read once; reference when something feels off.

---

## The full cycle

```
peat (directive)
  ↓
polaris (decomposes into TASK assignment, names 3-5 agents, defines parallelism)
  ↓
.claude/handoffs/from-polaris/TASK-<id>.md  ←── this is the contract
  ↓
[ named agents pick up in parallel ]
  ↓
each agent: pre-task.sh → work → harness-check.sh (periodically) → post-edit.sh → visual-diff.sh (if UI) → sign-work.sh → pre-handoff.sh
  ↓
handoff to next named agent (or to algol for QA, or back to polaris)
  ↓
algol (signature audit + acceptance audit + regression scan)
  ↓
algol passes → polaris (STATUS.md updated, closed)
algol revises → back to implementing agent → loop
  ↓
polaris reports to peat (CLOSE handoff)
```

---

## Example walk-through — TASK-2026-05-14-02 · audience fork screen

This trace shows the workflow on a concrete task.

### Step 1 · Peat directs Polaris

Peat in Claude Code terminal:

> "Polaris, please start work on PRD-02 audience fork. Betelgeuse owns the visual direction; reference the pilot draft but don't copy it directly."

### Step 2 · Polaris decomposes

Polaris reads:

- The directive
- `/mnt/project/prd-02-audience-fork.md` in full
- `/mnt/project/frontend-ui-pilot-draft.md` audience-fork section (reference, non-canonical)
- `docs/team/STATUS.md` (no conflicting in-flight work)
- Personas of betelgeuse, sirius, vega, algol

Polaris writes `.claude/handoffs/from-polaris/TASK-2026-05-14-02.md`:

- **scope** — ship the post-boot fork screen with persistence and switch affordance
- **slices** — S1 Betelgeuse (spec), S2 Sirius (component + persistence), S3 Vega (microcopy), S4 Algol (QA)
- **dependencies** — S2 and S3 start in parallel with placeholders; finalize after S1
- **non-goals** — do not redesign Nav, do not implement curation map for ChapterIndex
- **acceptance** — fork screen renders first visit + persists choice + switch returns to fork, a11y = 100

Polaris updates `STATUS.md`.

### Step 3 · Betelgeuse picks up S1

Betelgeuse runs `WL_AGENT=betelgeuse WL_TASK_ID=TASK-2026-05-14-02 bash .claude/hooks/pre-task.sh TASK-2026-05-14-02 betelgeuse`. The hook:

- Confirms assignment file exists
- Confirms betelgeuse.md, AGENTS.md, QUALITY-BAR.md, FILE-OWNERSHIP.md are all readable
- Lists betelgeuse's territory for this task

Betelgeuse reads PRD-02 in full, the pilot draft's audience-fork section, and the existing components (`Nav.tsx`, `PageShell.tsx`, `BootSequence.tsx`) to understand context.

Betelgeuse writes `docs/design/fork-screen-v1.md` with the spec. While drafting, she runs `bash .claude/hooks/harness-check.sh` to confirm she's still in her territory. She is.

Betelgeuse runs `WL_AGENT=betelgeuse WL_SUMMARY="design spec for audience fork screen v1" WL_NEXT=sirius bash .claude/hooks/sign-work.sh TASK-2026-05-14-02`. Signature lands at `.claude/signatures/TASK-2026-05-14-02--betelgeuse.json`, conforming to v2 schema.

Betelgeuse runs `bash .claude/hooks/pre-handoff.sh TASK-2026-05-14-02 sirius`. The hook:

- Copies `_template.md` to `from-betelgeuse/TASK-2026-05-14-02--to-sirius.md`
- Betelgeuse fills in the sections
- Re-running the hook validates and finalizes

### Step 4 · Sirius picks up S2 (in parallel with S1, with placeholders)

Sirius has been working in parallel since S2's start time. His initial pass uses placeholder copy and placeholder layout — declared in `## known deviations` of an interim handoff to Polaris.

When Betelgeuse's spec lands, Sirius checks his inbox (`find .claude/handoffs/ -name "*--to-sirius.md"`), sees `from-betelgeuse/TASK-2026-05-14-02--to-sirius.md`, reads the spec.

Sirius revises `components/AudienceFork.tsx` per the spec:

- Two-path layout with equal sizing
- ESC handler + skip
- localStorage write to `wl:audience-path`
- Hydration-safe (useEffect read pattern)
- Mobile breakpoints

After each batch of edits, `post-edit.sh` runs and passes. After the final edit, `visual-diff.sh` captures before/after screenshots and marks the task `awaiting-betelgeuse`.

Sirius signs and writes a handoff `from-sirius/TASK-2026-05-14-02--to-betelgeuse.md` asking for visual-diff approval.

### Step 5 · Betelgeuse reviews the visual diff

Betelgeuse reads the screenshots at `.claude/visual-diffs/TASK-2026-05-14-02/`. Runs through her six-check review (reference fidelity, token compliance, pattern reuse, accessibility, mobile fidelity, motion calibration).

Two paths are sized equal at desktop. At 600px they stack but the typography drops one size — Betelgeuse notes this is acceptable.

Betelgeuse writes `.claude/visual-diffs/TASK-2026-05-14-02/REVIEW.md` with PASS, updates `.claude/visual-diffs/TASK-2026-05-14-02/STATUS` to `betelgeuse-approved`.

She signs her review and sends a handoff back to Sirius: PASS, proceed to Algol.

### Step 6 · Vega ships microcopy in parallel (S3)

Vega drafted copy while waiting on Betelgeuse's spec. Once the spec is final, she confirms her copy fits the layout, runs `audit-voice.sh` (no marketing verbs, both descriptions parallel, 12 words each), signs, and hands off to Sirius with `DRAFT`.

Sirius replaces placeholder strings with Vega's final copy. Another `post-edit.sh` cycle, another `visual-diff.sh` — but since the only change is text content, Betelgeuse's approval covers it (her review already validated the typography style).

Sirius signs the final version, writes a handoff to Algol.

### Step 7 · Algol audits

Algol's `pre-task.sh` runs. They read:

- The TASK from Polaris
- The signed work records from Sirius, Betelgeuse, Vega
- The diff
- The acceptance criteria
- `.claude/signatures/SCHEMA.md` (the canonical verification spec)

Algol runs the gauntlet:

1. Signature integrity (v2 verification per SCHEMA.md) — all three signatures match their diffs. PASS.
2. Acceptance criteria — every item from Polaris's TASK. PASS.
3. Quality bar — F1 (reference fidelity), F2 (tokens), F3 (pattern reuse), F4 (a11y), F5 (motion), F6 (hydration). All PASS.
4. Regression scan — 12 existing pages still build, no behavior changed. PASS.
5. Accessibility — Lighthouse a11y = 100 at 375px. PASS.
6. Cross-impact — `Nav` consumes the new audience store; Algol confirms Nav still works.

Algol writes `docs/qa/REPORTS/TASK-2026-05-14-02.md` with verdict PASS WITH NOTES (the unset/craft visual collapse note — non-blocking, FYI for next task).

Algol adds a regression test at `tests/audience-fork.test.tsx`.

Algol hands off to Polaris: PASS.

### Step 8 · Polaris closes

Polaris reads Algol's report, audits the signatures one more time (her own audit, independent of Algol's), updates `STATUS.md`:

```
TASK-2026-05-14-02 · audience fork screen · CLOSED 2026-05-15
  Betelgeuse · spec at docs/design/fork-screen-v1.md     · signed d12e5077…
  Sirius     · components/AudienceFork.tsx + persistence · signed 8a3f9c4b…
  Vega       · microcopy logged in MICROCOPY.md          · signed 4b6f8a90…
  Algol      · QA report at docs/qa/REPORTS/TASK-...     · signed 9e2c3a8d…
```

Polaris sends Peat a CLOSE handoff:

```
TO · peat
FROM · polaris
TASK-2026-05-14-02 · CLOSED

shipped · audience fork screen renders on first visit, persists
          choice in wl:audience-path, switch from Nav returns to
          fork, mobile fork at ≤600px stacks vertically.

a11y · 100 (Lighthouse, mobile 375px)
deviations declared · none
regressions · none

algol noted: visual collapse risk between 'unset' and 'craft' in
ChapterIndex ordering. flagged for next task.

next task suggestions (your call):
  - the ChapterIndex curation map (next slice of PRD-02)
  - the Nav switch affordance UI (currently functional but unstyled)
  - move to PRD-03 photo + ATLAS integration
```

---

## What happens when something fails

### A hook fails

The agent must fix before handoff. The hook log captures what failed. The agent re-runs the hook to confirm fix.

If the agent cannot fix, they open a BLOCKER handoff to Polaris with the specific hook output.

### A signature audit fails (INTEGRITY-FAIL)

Algol's audit detects diff vs. signature mismatch. Algol writes `INTEGRITY-FAIL` to Polaris. Polaris:

1. Re-runs Algol's audit independently
2. If confirmed, writes a postmortem at `docs/team/POSTMORTEMS/<task>--<agent>.md`
3. The agent re-signs accurately
4. The slice cycle restarts

Repeat INTEGRITY-FAILs from the same agent escalates to Peat.

### Algol rejects on quality bar

Algol writes REVISE handoff back to the implementing agent with specific failing criteria. Agent revises. Two REVISEs on the same criterion = flagged. Three = postmortem trigger.

### Two agents disagree

Example: Altair says "this endpoint returns X"; Sirius integrates expecting Y. They handoff back and forth. After two rounds: Polaris intervenes. Polaris reads both positions, writes a contract decision, both agents implement against it.

### Polaris and Peat disagree

Rare; Peat overrides. Polaris documents the override in `STATUS.md` and proceeds.

---

## What this workflow optimizes for

- **Transparency** — every step is traceable. Every decision is in writing.
- **Parallelism** — every agent starts work immediately, even with placeholders.
- **Quality** — every gate is automated where possible, audited where not.
- **Recoverability** — when something goes wrong, the postmortem improves the system, not blame.
- **Speed** — three-to-five agent teams beat ten-agent teams. Direct handoffs beat lead-routing.

---

*end of WORKFLOW.md*
