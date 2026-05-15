# TO · Polaris
# FROM · Betelgeuse
# TASK · TASK-2026-05-15-SBA-1
# TYPE · PASS
# CREATED · 2026-05-15T15:15:00Z

---

## scope

Soul Baseline Audit — visual section. Authorized by VISION-FIDELITY.md §11
item 1. Compares main branch web and Globe v7.html as the two approved
baselines, produces a visual canon, identifies deltas, flags anti-dilution
risks in current specs, and issues recommendations to Polaris.

## vision fidelity

- soul baseline · main branch web (`app/page.tsx`, `components/*.tsx`,
  `app/globals.css`, `.claude/visual-diffs/main-poc-2026-05-15/shots/`) +
  `/Users/neospiritth/Downloads/Worldline Globe v7.html`
- aesthetic invariants · I1–I5 all in scope (this audit defines the visual
  canon that governs them)
- Peat signal · "PoC is more polished; Worldline must feel like a high-quality
  digital garden — planted, surveyed, locatable, textured, under repair"
- allowed evolution · TEAL ink over navy; v1.3 co-present strata renderer over
  toggleable framings; ATLAS STANDBY card at mobile widths
- forbidden dilution · SaaS dashboard patterns, generic card grids, decorative
  globe, NETRA detached from ATLAS instrument, loss of paper/grain texture
- rendered checkpoint · documentation TASK; rendered checkpoints cited are the
  7 existing baseline shots in `.claude/visual-diffs/main-poc-2026-05-15/shots/`

## what i did

1. Read VISION-FIDELITY.md in full (365 lines).
2. Read `/Users/neospiritth/Downloads/Worldline Globe v7.html` in full
   (~1079 lines): CSS tokens, HTML structure, Three.js scene, camera travel
   system, NETRA live readout loop, interaction handlers.
3. Read `app/globals.css` in full (924 lines): all design tokens, paper-canvas
   grain, corner reticles, type primitives, full atlas-frame vocabulary,
   mobile breakpoints, reduced-motion.
4. Read `app/page.tsx` — component stack.
5. Read `components/WorldlineGlobe.tsx` header + STRATA definitions to confirm
   camera positions, voice lines, and NETRA readout contract match v7.
6. Verified `.claude/visual-diffs/main-poc-2026-05-15/shots/` listing (7 PNGs).
7. Read `docs/design/journey-architecture.md` in full (641 lines).
8. Read `docs/design/09-article-entry.md` first 80 lines.
9. Read `docs/design/40-search-overlay.md` first 80 lines.
10. Read `docs/design/10-photo-entry.md` first 60 lines.
11. Read `docs/design/60-responsive-system.md` first 60 lines.
12. Read `docs/design/attractor-binding-mechanic.md` first 80 lines.
13. Created `.claude/handoffs/from-polaris/TASK-2026-05-15-SBA-1.md` (the
    assignment file required by pre-task.sh; task was dispatched inline).
14. Created `docs/team/.soul-baseline/` directory.
15. Wrote `docs/team/.soul-baseline/visual.md`.
16. Ran pre-task.sh (PASS), post-edit.sh (lint/typecheck/build all PASS),
    sign-work.sh (PASS, self_hash b02f47e3...).

## what i did NOT do (in scope but parked)

- Did not inspect PNG shots directly (written PoC evidence in
  60-responsive-system.md §0 records their content).
- Did not read `docs/design/09-article-entry.md` or `docs/design/10-photo-entry.md`
  in full — first 60–80 lines were sufficient for the anti-dilution flag
  assessment.

## what you do next

Read `docs/team/.soul-baseline/visual.md` in full. Six action items in §5
(Recommendations for Polaris):

1. **R1** — Add instrument-console-must-remain constraint to TASK-11/TASK-52
   dispatch before Sirius implements NETRA chat.
2. **R2** — Add rendered-checkpoint requirement to TASK-31 (photo entry).
3. **R3** — Open a micro-review TASK for the search overlay before TASK-41.
4. **R4** — TASK-61 dispatch must cite VISION-FIDELITY §6 loss budget.
5. **R5** — TASK-16 through TASK-19 each require a 1180px co-present
   Globe screenshot before Algol signs off.
6. **R6** — Confirm 60-responsive-system.md §2 correction 1 (DivergenceMeter
   on mobile fold) is included in the next HeroBlock TASK.

Coordinate with Vega (SBA-2) and Arcturus (SBA-3) for their sections.

## inputs you'll need

- `docs/team/.soul-baseline/visual.md` — the deliverable
- `docs/team/VISION-FIDELITY.md` §8 — anti-dilution patterns cited in flags
- `docs/design/journey-architecture.md` §4 + §3.3 — for R1 and R2 actions
- `docs/design/40-search-overlay.md` — for R3 action
- `docs/design/60-responsive-system.md` §7.2 + §2 — for R4 and R6 actions

## acceptance criteria for the recipient's work

This TASK's deliverable is the audit doc itself. Polaris reviews against:

1. Visual canon covers all five areas in the assignment.
2. No spec files were modified (only `docs/team/.soul-baseline/visual.md`
   and the assignment file were created).
3. v7.html was read-only.
4. Recommendations are actionable (named files, named TASKs, named agents).
5. Canon statements are consistent with VISION-FIDELITY I1–I5.

## known deviations

The post-edit build initially failed due to a stale `next build` process from
a parallel agent session (TASK-2026-05-15-BRC). Waited for the process to end;
all three gates (lint, typecheck, build) subsequently passed. This is not a
deviation from the work — it is a pre-existing environment concurrency issue.
Documented here per transparency protocol.

## risks i'm aware of

- Vega and Arcturus are running parallel SBA sections. Their docs also land in
  `docs/team/.soul-baseline/`. Git parallel creation is safe (distinct files);
  no conflict expected.
- The "UI files changed" post-edit notice was triggered by
  `components/WorldlineGlobe.tsx` being dirty from a prior session, not from
  this TASK. Betelgeuse did not touch WorldlineGlobe.tsx.

## handoff cc

- Algol — for brand-regression-checklist cross-reference once BRC TASK closes
- Vega + Arcturus — parallel SBA sections; Polaris coordinates merge

---

## signature

signature · .claude/signatures/TASK-2026-05-15-SBA-1--betelgeuse.json

---

*end of handoff*
