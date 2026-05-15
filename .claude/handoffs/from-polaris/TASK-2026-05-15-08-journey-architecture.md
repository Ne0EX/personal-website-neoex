---
task_id: TASK-2026-05-15-08
from: polaris
to: betelgeuse
date: 2026-05-15
priority: critical
model: opus  ← per-task escalation
predecessor_review: docs/design/REVIEW-2026-05-14-worldline-pages-v1.md
predecessor_evidence: .claude/visual-diffs/main-poc-2026-05-15/shots/main-1180x900-globe-wait.png
parent_directive: Peat 2026-05-15 — Globe is the highlight feature + walkthrough mechanism; without it the design loses both aesthetic and journey integrity
---

# TASK-2026-05-15-08 · Journey architecture spec

## scope

The main PoC on `main` branch already implements the Globe-as-navigator pattern with stratum chooser (NeX/NeON/NeO/FULL-NeBeX), DIVERGENCE meter, ChapterIndex (recent traces fallback list), and AttractorFields (tag-based filter). What's missing is the **connective architecture** between Globe and the content surfaces (articles, photos, NETRA chat) that don't exist yet — and a clear story for what happens when Globe isn't usable (mobile, a11y).

Claude Design tried to invent this connective tissue without seeing the Globe (Three.js doesn't describe through Figma frames) — and so produced 8 surfaces (06–13) that either reinvent what already exists (Ne0 Index Log/Feed = ChapterIndex; NeX Index Board ≈ AttractorFields; Boot Calibration/Scrubber = BootSequence) or float free of the Globe entirely.

This task produces ONE document — `docs/design/journey-architecture.md` — that names the journey moments end-to-end and answers each gap. Per-surface specs (β, γ, δ) all derive from this document. **All downstream design work blocks on this.**

## PRD reference

Touches PRD-01 (entry pages), PRD-02 (audience fork — but reframes it), PRD-03 (photo atlas), PRD-04 (triangulate search), PRD-05 (NETRA chat). Synthesizes all five into a single journey spec.

## slices

### S1 · Betelgeuse — write `docs/design/journey-architecture.md`

**input**
- Live main PoC at `http://localhost:3000` (dev server should still be running; restart with `npm run dev` if needed)
- Existing components in `components/` — read them; they ARE the source of truth for what's already implemented
- 22 PNGs at `.claude/visual-diffs/TASK-2026-05-14-06/stages/` (Worldline Pages v1 review evidence)
- 7 PNGs at `.claude/visual-diffs/main-poc-2026-05-15/shots/` (live main PoC at multiple viewports)
- Your own source-pass + opus-pass reviews at `docs/design/REVIEW-2026-05-14-worldline-pages-v1.md`
- PRD-01 through PRD-05 at `docs/prds/`

**output** — single document at `docs/design/journey-architecture.md` covering:

1. **Journey moments end-to-end** — M1 LAND, M2 PICK STRATUM, M3 BROWSE GLOBE, M4 ENTER (article/photo/fiction), M5 SCAN (list fallback), M6 FILTER (tag fallback), M7 ASK NETRA, M-RETURN — annotated with what main PoC already does vs what's gap.

2. **Globe mechanics spec** (GAP-B):
   - How does each stratum (NeX, NeON, NeO, FULL-NeBeX) render visually on the Globe? What's the node visual for each content type (article = ?, photo = ?, fiction = ?)
   - Click-on-node UX: animation, transition to entry page, return path
   - Empty-stratum state, loading state, error state
   - Hover/focus affordances (keyboard nav too)

3. **Entry-surface contract** (GAPS A + C):
   - What does article-entry receive from Globe (state, params, identity)
   - What does photo-entry receive
   - What does fiction-entry receive
   - Whether photos are "nodes on the Globe like articles" or "their own layer/projection" — decision required
   - Film-simulation integration with photo entry (PRD-03's Fuji variants)

4. **NETRA chat placement** (GAP-D):
   - The floating "N" button currently exists on every viewport. Tap → ?
   - Modal / side panel / full page / overlay drawer?
   - How does NETRA know Globe state when invoked from inside the observatory?
   - Where do refusals route the user (back to Globe or stay in NETRA)?

5. **Fallback list access** (GAP for M5/M6):
   - ChapterIndex and AttractorFields exist below the fold. Is that the only access?
   - Should the left rail (stratum chooser) include a "list view" toggle?
   - On mobile where Globe collapses, is the list the default?

6. **Audience Fork reframing** (cancels stage 02 from Claude Design):
   - The Globe's stratum chooser IS the fork. Confirm or refute.
   - First-time-visitor vs returning-visitor flow — what differs? Does anything?

7. **Mobile collapse strategy** (GAP-E):
   - At what breakpoint does Globe shrink vs replace vs disappear?
   - What's the mobile-primary experience: list-first with optional Globe peek, or Globe-shrunk with list below?
   - Touch interaction with Globe (rotate by drag, tap to select) — feasibility note

8. **Search affordance** (GAP-F):
   - Triangulate Search placement: in NETRA, in top bar, inline on Globe, dedicated route?
   - Decide; spec follows.

9. **Inventory of Claude Design stages** — table showing for each of 01–13: status (ADOPT / ADOPT-WITH-REVISION / REINVENT / DISCARD), reason, what replaces it.

10. **Anti-Codex rule audit** — every decision above must be checked against the 6-point gauntlet (reference fidelity to main PoC, token compliance, pattern reuse, a11y, mobile, motion).

**output is a SPEC, not implementation.** No code. Sirius cannot start on β/γ/δ until this lands.

**non-goals**
- Do not propose new design tokens (token harmonization is a separate eventual TASK)
- Do not write the per-surface specs themselves (β/γ/δ do that)
- Do not implement or modify any component
- Do not assume the Three.js Globe will be rewritten — start from "Globe exists, design around it"

**acceptance**
- Document exists and covers all 10 sections
- Every gap A–F has a decision (not "TBD" — decisions; Peat can revise but a decision must be on paper)
- Inventory table for 01–13 is complete with verdicts
- Mobile collapse strategy is concrete enough that Sirius could implement from it

**model** · opus per-task escalation
**reason** · novel-direction multi-surface system-level design synthesizing 7+ artifacts (5 PRDs, 2 review docs, 1 live PoC, 30+ screenshots) into one coherent journey doc; this is the canonical opus-rubric case in `project_model_tier_dispatch.md`

## dependencies

None — α blocks β/γ/δ but α itself is unblocked.

## acceptance (whole task)

- Single doc at `docs/design/journey-architecture.md`
- Signature v2, both gates green
- Return handoff to Polaris naming what β/γ/δ each need to specifically pick up from α

## deadline

ASAP — all downstream design work depends on this.

---

*polaris · α-OPS-00 · 2026-05-15*
