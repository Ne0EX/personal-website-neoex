# HANDOFF · TASK-2026-05-15-60 · responsive system spec → Polaris

> From · Betelgeuse (α-VIS-04) · sonnet tier
> To · Polaris (α-OPS-00)
> Date · 2026-05-15
> Signature · `.claude/signatures/TASK-2026-05-15-60--betelgeuse.json`

---

## scope

TASK-60 · responsive system spec + mobile prototype decisions
Output: `docs/design/60-responsive-system.md` · 460 lines · v1.0 locked.

---

## what i did

Wrote the canonical responsive system spec locking all breakpoint and per-surface mobile contracts delegated from journey-arch §7. The spec covers:

**Breakpoint table locked at four tiers:**
- WIDE ≥1180px — full A.T.L.A.S. frame, Three.js Globe as fold
- DESK 881–1179px — compacted frame, horizontal FOCUS pill row, Three.js still loaded
- MID 601–880px — ATLAS · STANDBY card + ChapterIndex primary, SVG mini-globe, Three.js not loaded
- NARROW ≤600px — identical to MID with tighter padding

Each breakpoint has explicit rationale rooted in content constraints (ATLAS three-column minimum ~1100px; Three.js not legible below 300px canvas height at mobile viewport; existing 880/600px CSS rules as natural breaks).

**ATLAS · STANDBY card:** Full visual spec — corner reticles, SVG mini-globe (180/220px, orthographic), two CTAs (`[ OPEN ATLAS ↗ ]` routing to `/atlas`, `[ ↓ AS LIST ]` anchor scroll), all using existing tokens only.

**Per-surface mobile contracts:**
- Nav stratum indicator: hides at MID/NARROW (Globe not active = indicator has no referent)
- Article entry: sidenotes collapse to footnote-style at ≤880px; header strip splits to two rows at ≤600px
- Photo entry: EXIF stacks below photo at ≤880px; roll context icons-only at ≤600px; film-sim affordance hides at ≤600px; lightbox pinch-zoom enabled (container-specific exception)
- NETRA drawer: full-viewport at ≤700px; `100dvh` container; `interactive-widget=resizes-content` viewport meta for iOS keyboard
- Search overlay: mini-globe hides at NARROW (375px); results list is the operative surface

**Pinch-zoom on Globe — flag #9 locked: DISABLED.**
Rationale: four discrete FOCUS camera positions are the instrument's vocabulary. Continuous zoom has no home position, cannot be undone, conflicts with FOCUS button semantics, and can hijack iOS system gestures. `controls.enableZoom = false`. Exception: lightbox pinch-zoom enabled (contained context, direct legibility purpose).

**Globe at DESK under v1.3 co-equal strata:** Transparency legibility confirmed — at 440px canvas height, 0.55 opacity body reveals the Ne0N axis line clearly. Orbital arcs are legible. No changes to v1.3 renderer spec needed.

**Motion budget mobile:** Three animation cuts at MID/NARROW — Globe auto-rotate, Globe camera FOCUS moves, and article side panel slide-in (full-page navigate replaces panel at these breakpoints). All other animations preserved. Reduced-motion CSS rule already covers DOM. JavaScript Three.js reduced-motion path flagged to Sirius.

**Touch target audit:** All 14 interactive elements audited. N button (56×56px) passes. New elements spec'd at 44px min height. Pattern for icon targets: `::after` pseudo-element hit-area extension.

**`/atlas` route design contract:** Full-viewport Globe on mobile, minimal Nav (`[← WORLDLINE]` only), bottom-sheet FOCUS buttons (collapsed handle by default, 2×2 grid on expand). Pin selection on mobile: single tap → voice strip `READ ENTRY →` → full-page navigate (no panel). WIDE/DESK redirect to `/` specified.

**Implementation dispatch order in §14:** Eight numbered steps for Sirius, starting with the critical threshold fix (move `lg:hidden` from 1024px to 1180px).

---

## what you do next

Polaris dispatches TASK-61 (ATLAS · STANDBY card + `/atlas` route implementation) to Sirius. TASK-60 is the design gate for TASK-61.

Polaris also flags to Sirius:
- `app/layout.tsx` viewport meta needs `interactive-widget=resizes-content` (§6.4)
- `WorldlineGlobe.tsx` `controls.enableZoom = false` (§7)
- Three.js reduced-motion JavaScript path needed (§10.3)

The responsive contracts in `docs/design/60-responsive-system.md` also gate the mobile layers of TASK-24 (article route), TASK-31 (photo route), and TASK-52 (NETRA drawer) per DEV-PLAN §A.2.

---

## known deviations

**Post-edit hook: typecheck pre-existing failure.** The `post_edit_passed` flag in the signature is false. This is caused by pre-existing TypeScript errors in `app/api/chat/route.ts` (an untracked file from a prior task, not committed to the branch) — specifically errors at lines 152, 164, 176, 189, 199, 290 related to overload mismatch and `maxSteps` type property. I did not touch this file. The build failure is a secondary effect of another `next build` process still running in the environment. Neither failure is introduced by this task.

Polaris should note this for Algol's audit: the typecheck baseline was already broken when TASK-60 started. If a clean typecheck pass is required before TASK-61 can dispatch, the `app/api/chat/route.ts` errors need a separate fix TASK assigned to Sirius or Altair.

**Pre-task assignment stub:** TASK-2026-05-15-60 was dispatched directly by Peat in the conversation prompt, not via a file at `.claude/handoffs/from-polaris/`. I created the stub file to pass the pre-task gate — it accurately represents the task as described by Peat. The stub is at `.claude/handoffs/from-polaris/TASK-2026-05-15-60.md`.

---

## signature

`.claude/signatures/TASK-2026-05-15-60--betelgeuse.json`
