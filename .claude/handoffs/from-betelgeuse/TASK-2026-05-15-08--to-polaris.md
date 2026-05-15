---
task_id: TASK-2026-05-15-08
from: betelgeuse
to: polaris
date: 2026-05-15
priority: critical
model_used: opus (per-task escalation, contract-authorized)
predecessor_review: docs/design/REVIEW-2026-05-14-worldline-pages-v1.md
deliverable: docs/design/journey-architecture.md
signature: .claude/signatures/TASK-2026-05-15-08--betelgeuse.json
self_hash: 427b82dd8ee18ef6cd8a36e39f2520461413cc2d36d938123c120475f2fcf479
---

# TASK-2026-05-15-08 · journey-architecture spec · return handoff

## scope

α-slice of the design wave. Single canonical journey doc that connects the implemented main-PoC Globe to the not-yet-built content surfaces (article, photo, fiction, NETRA, search, return state). Synthesis from: 5 PRDs, 2 ontology revisions, the Worldline Pages v1 review (source + opus rendered passes, 22 PNGs), the live main-PoC at multiple viewports (7 PNGs), and the running `components/WorldlineGlobe.tsx`. The doc is a spec, not implementation; β/γ/δ derive from it.

## what i did

- Read the contract, the predecessor review (both passes), the running Globe component end-to-end, all 5 PRDs, the globe ontology v1.2 (which is actually titled v1.3 inside — recorded as such), and Polaris's STATUS.md S1 line.
- Inspected 4 of the live PoC screenshots directly (1180 globe-wait, 880 fold, 600 fold, 375 fold). The 375 finding alone re-sets mobile priorities: the fold is *empty paper plus the N button*. Anchored §7 around that.
- Wrote `docs/design/journey-architecture.md` (single file, ~660 lines) covering all 10 contract sections: M1–M7 + M-RETURN, Globe mechanics, entry contract, NETRA placement, fallback access, audience-fork reframing, mobile collapse, search affordance, 01–13 inventory, anti-Codex audit.
- Resolved all gaps A–F to *decisions* (not TBDs). Where Peat's intent is ambiguous, tagged `[Peat: confirm or redirect]` and recorded the most-defensible default; collected 9 such flags into §13 for fast review.
- Signed (post_edit_passed=true, harness_passed=true) on second attempt. First attempt failed because post-edit log was missing — ran the hook explicitly, all three gates (lint, typecheck, build) passed cleanly, re-signed.

### key decisions worth your attention

1. **No hard fork screen (§6).** PRD-02 stays in spirit — its curation map survives as a session-passive default keyed off the visitor's first stratum pick — but stage 02 from Claude Design is DISCARDED. The stratum chooser already IS the fork. This is the biggest single call in the doc and the one most likely Peat revisits.

2. **NETRA chat as right-edge drawer, NOT a fifth ATLAS stratum (§4).** PRD-05 recommended the fifth-stratum approach. I reversed it because (a) it forces a Globe rewrite which the contract excludes, (b) the N button is visible on every viewport and the chat surface should match. Drawer reuses the existing in-Globe side panel motion contract (520ms cubic-bezier).

3. **Mobile is list-primary with a Globe-placeholder card and a dedicated `/atlas` route for full-viewport Globe (§7).** Three breakpoints, three modes. At 600px and below, Three.js is not loaded on the fold at all — a placeholder card with `[ OPEN ATLAS ↗ ]` and `[ ↓ AS LIST ]` replaces it. The current PoC's mobile fold being empty paper is unacceptable; this is the fix.

4. **Photo glyph = square, fiction glyph = diamond (§2.2)** — minimal extension to existing pin vocabulary, no new tokens. Fiction-on-Globe is deferred for v1 (PRD-03 itself defers this). Photos live on the surface alongside articles, distinguished by glyph.

5. **Inventory cuts (§9):** stages 02, 06, 07, 12*, 13 DISCARDED. Stages 01B, 04, 08, 09, 10, 11, 12 DEFERRED to later TASKs. ADOPT-WITH-REVISION on stages 01, 03, 05 — these are what β/γ/δ pick up.

### six-point anti-Codex audit summary

All decisions pass. Three ⚠ partials flagged for Sirius implementation attention (off-canvas pin a11y, full-modal entry on mobile, `/atlas` back-button history) and one ⚠ for Algol QA (pinch-zoom disabled may surprise mobile users). No FAILs.

## what you do next

### immediate (Polaris → Peat)

Walk Peat through the 9 `[Peat: confirm or redirect]` flags in §13. The big one is the fork-screen discard (#7 in the list). The rest can be batch-confirmed in a single message. Once Peat confirms or redirects, drop those into the β/γ/δ task contracts before dispatch.

### β · TASK-09 · article entry (Betelgeuse · sonnet)

Pick up from §3.2 (article contract), §3.5 (shared vocabulary across all entries — header strip, section rules, pullquote, code block, patches log, prev/next nav), §9 row 01 (revisions to Claude Design stage 01), §10 audit row 3.3. Specifically: text-only right readout (no pill — resolves REVIEW finding N1), responsive at 880/600/375 (REVIEW upgraded-to-critical), token compliance audit (no raw rgba), Thai variant cut for v1 wave.

### γ · TASK-10 · photo entry + atlas integration (Betelgeuse · sonnet)

Pick up from §2.2 (square glyph spec for Sirius to extend `pinObjects`), §3.3 (photo entry contract — film-strip border, EXIF readout reuses `atlas-readout-row` pattern, roll-context strip), §3.5 (shared vocabulary), §9 row 03 (REVIEW N2 finding — checkered film-leader for empty/loading state, NOT the gradient placeholder). Also includes the `/photos` roll index and `/photos/<roll>` single-roll layouts with mini-map (mini-map is SVG orthographic, not Three.js — PRD-04 §3.2 set this precedent and γ inherits it). Film-simulation toggle is *suggestion only*, never auto-apply.

### δ-S1 · TASK-11 · Arcturus · opus · NETRA prompt arch

Pick up from §4.3 (Globe state flows into prompt context via zustand → /api/chat body → system prompt interpolation), §4.4 (refusal taxonomy), and PRD-05 in full. The prompt itself is Arcturus's territory — I describe the *contract* between the chat surface and the prompt, not the prompt's contents.

### δ-S2 · TASK-11 · Betelgeuse · sonnet · NETRA chat UI

Pick up from §4 (full placement spec — right-edge drawer, 420px desktop, full-viewport mobile, three regions header/thread/composer), §4.5 (mobile composer specifics — dvh, interactive-widget, 44×44 send button), §7.5 (N button state transitions). Motion contract REUSES the existing in-Globe side panel — 520ms cubic-bezier(.2,.8,.2,1). Streaming tokens render in italic Cormorant. Tool-call status line as instrument readout.

### Sirius-side implementation work (downstream, not this wave)

Logged as next-wave work — do NOT dispatch yet:
- off-canvas pin list for keyboard a11y (§2.5)
- pin hover preview tooltip (§2.5, currently missing)
- photo + fiction glyph extension to `WorldlineGlobe.tsx` (§2.2)
- mobile breakpoint compaction of A.T.L.A.S. frame (§7.1)
- ATLAS · STANDBY placeholder card (§7.2)
- `/atlas` dedicated route (§7.3)
- `[ ↓ AS LIST ]` and `[ ⌕ FILTER BY FIELD ]` mono links in A.T.L.A.S. footer (§5.1)
- `wl:boot-seen` localStorage gate for boot-skip on return visits (§1 M-RETURN)
- top-bar `⌕ TRIANGULATE` Nav link + `/` hotkey wiring (§8.1)
- search overlay full-page modal (deferred to its own spec TASK after δ closes)

## known deviations

1. **No pre-task baseline.** `pre-task.sh` was not run before I started, so `sign-work.sh` fell back to full-git-diff and the signature's `files_touched` is *incorrect* — it lists `README.md`, `components/WorldlineGlobe.tsx`, `docs/team/STATUS.md` as touched. **None of those were touched by me.** They are pre-existing uncommitted changes in the working tree from earlier work. The only file I actually wrote in this task is `docs/design/journey-architecture.md`. Recommend Polaris note this in STATUS.md per the same pattern as TASK-04's `post_edit_passed=false` carry-over from worktree artifacts (this is the same class of issue — workflow tooling gap, not a substantive problem). Going forward, all agents should run `pre-task.sh` at the start of every task; consider adding this to the WORKFLOW.md kickoff checklist.

2. **The ontology v1.3 vs running-Globe divergence is unresolved.** The ontology says strata are co-equal/visible-simultaneously; the running Globe makes them toggleable camera framings. I designed around the as-shipped behavior (toggleable) and flagged this in §0 ground rule 2 and §6.1. If Peat wants the co-present model, several decisions in this doc would re-thread (notably §2 stratum visual differences and §6 audience fork). Recommend treating this as a separate Polaris→Peat conversation, not as a blocker on β/γ/δ.

3. **`UI files changed` post-edit notice.** Hook flagged that `components/WorldlineGlobe.tsx` is modified in working tree — same carry-over as #1. I did not touch the component. Visual-diff was NOT run because this TASK is spec-only. No visual change to gate against.

4. **Live dev server not curl'd or playwright'd.** I worked from the pre-staged screenshots which were authoritative. The contract said the live server was available "if needed" — it wasn't needed once I had the 7 PNGs in hand.

5. **Document length.** ~660 lines. This is on the long side for a single spec doc but I judged the synthesis warranted it (10 mandatory sections, decision matrix, inventory of 13 stages, gauntlet audit of 21 decisions). If Polaris wants it split (e.g., journey moments + decisions in one doc, inventory + audit in an appendix), that's a structural revise that I can return in a short follow-up.

## signature

- `.claude/signatures/TASK-2026-05-15-08--betelgeuse.json`
- self_hash · `427b82dd8ee18ef6cd8a36e39f2520461413cc2d36d938123c120475f2fcf479`
- harness_passed · true
- post_edit_passed · true (lint + typecheck + build all green; visual-diff not applicable for spec-only)
- next_recipient · Polaris (α-OPS-00)
- model used · opus (per-task escalation per contract; logged as opus override #2 of this session)

---

*betelgeuse · α-VIS-04 · the Red Sentinel · journey-architecture.md delivered · ready for β/γ/δ dispatch*
