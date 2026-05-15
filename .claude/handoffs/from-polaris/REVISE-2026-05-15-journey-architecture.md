---
type: REVISE
from: polaris
to: betelgeuse
date: 2026-05-15
target_doc: docs/design/journey-architecture.md
parent_task: TASK-2026-05-15-08 (closed)
trigger: Peat confirmed flags #7 + #1 + #8 + mobile-delegation on 2026-05-15
model: sonnet (revision of existing spec; not novel-direction)
---

# REVISE · journey-architecture.md · Peat's #7/#1 decisions

## scope

Peat reviewed Polaris's PRD-02 ↔ journey-arch comparison and confirmed his decisions on the biggest flag (#7 — discard PRD-02 fork screen) plus a hybrid that adds two enhancements Polaris proposed in the compare. Plus he delegates mobile design to you for prototype-based decision. Plus flag #8 (Globe lands FULL Ne0EX) reconfirmed. The other 5 flags (#2, #3, #4, #5, #6) are still open and Polaris will ask Peat separately — they don't block this revision.

This task revises journey-architecture.md to encode the confirmed decisions, removes the `[Peat: confirm or redirect]` markers from confirmed sections, and adds the new Nav stratum-indicator spec.

## confirmed decisions to encode

1. **§6.1 STAYS AS WRITTEN**: stratum chooser IS the fork; PRD-02 hard fork screen DISCARDED; curation map preserved as passive default-active keyed off first stratum touched in session; no localStorage of audience path. Remove the `[Peat: confirm or redirect]` marker — this is now Peat-confirmed.

2. **§6.2 STAYS AS WRITTEN**: Globe lands in ALL (FULL Ne0EX) stratum every visit; no remember-last-stratum. Remove the `[Peat: confirm or redirect]` marker.

3. **NEW · subtle Nav stratum indicator** — Polaris proposed this in the compare; Peat accepted. Spec it as a new section (you decide where — likely §3.5 "surface vocabulary that all entry surfaces share" since the indicator is in the global Nav, or a new §3.6 if it deserves its own slot). Required content:
   - Where in Nav it sits (Polaris suggests the right-side readout area near `SYS // CALIBRATED` — your call)
   - What it reads — Peat's example: `· STRATUM Ne0` (mono caps, small, low-contrast). When stratum is FULL-Ne0EX (default), readout might be `· STRATUM Ne0EX` or just hidden. Your call which is clearer.
   - When it updates — on stratum change in left rail (immediate)
   - What it explicitly is NOT — NOT a CRAFT/TRACE flag (Peat rejected PRD-02 path-declared indicators); NOT a clickable affordance (the left rail is the click target); NOT animated on change beyond a 200ms color/opacity transition

4. **REJECTED hybrid options Polaris floated** — explicitly note these in your revision so future readers don't relitigate:
   - HeroBlock tagline does NOT swap per stratum — stays static `"an archive of unfinished thought, surveyed openly."`
   - Nav link order does NOT reorder per stratum — stays static
   - Reason: simplicity + the stratum-indicator already signals path, no need for additional swaps that risk visual instability across stratum changes

5. **§7 mobile collapse strategy** — Peat delegates to you for prototype-based decision. You may EITHER (a) keep §7 as-written and note "subject to prototype validation", OR (b) loosen the spec, mark it "prototype phase", and add a note that the final responsive rules will land after you've built a working mobile prototype of the Globe + indices. Your call as Betelgeuse — prototype-first is genuinely cheaper than spec-first for mobile-3D-canvas combinations. Implicitly resolves flag #9 (pinch-zoom) since you own the mobile prototype.

## explicitly NOT in this revision

- Do NOT address flags #2 (AttractorFields binding), #3 (return dashboards), #4 (fiction-on-Globe), #5 (fiction entry surface), #6 (left rail list-toggle). Polaris is asking Peat about these separately. Leave their `[Peat: confirm or redirect]` markers intact.
- Do NOT spec the actual Nav implementation — that's for Sirius later. You're describing the indicator's visual + semantic role.
- Do NOT add new design tokens — token harmonization is a separate eventual TASK.

## acceptance

- Two `[Peat: confirm or redirect]` markers removed from §6 (the #7 + #1 + #8 ones)
- New Nav stratum-indicator spec section added with content per item 3 above
- Explicit "REJECTED OPTIONS" note for tagline swap + Nav order swap
- §7 either kept-as-written or loosened-to-prototype per your call (item 5)
- §13 (open items flagged to Peat) updated: remove #1, #7, #8 from the list; #9 marked "resolved via §7 mobile delegation"; #2, #3, #4, #5, #6 remain
- Document version annotation updated: v1.0 → v1.1 (or your convention)

## non-goals

- Do NOT route through Algol audit on this revision pass (it's a small text revision; Polaris will eyeball it). Algol audit pattern resumes on the next substantive TASK once the platform stabilizes after the 3 stalls.
- Do NOT update STATUS.md (Polaris already did)
- Do NOT touch any non-design-doc territory

## sign

`WL_AGENT=betelgeuse WL_NEXT=polaris WL_SUMMARY="revise journey-architecture.md per Peat's #7/#1/#8/mobile confirmations + add Nav stratum-indicator spec" bash .claude/hooks/sign-work.sh REVISE-2026-05-15-journey-arch`

(Run pre-task.sh first per the new WORKFLOW Step 0 — your signature should ship with clean files_touched attribution.)

Return handoff at `.claude/handoffs/from-betelgeuse/REVISE-2026-05-15-journey-architecture--to-polaris.md`.

## deadline

ASAP — unblocks the remaining Peat-flag questions and eventually β/γ/δ dispatch.

---

*polaris · α-OPS-00 · 2026-05-15*
