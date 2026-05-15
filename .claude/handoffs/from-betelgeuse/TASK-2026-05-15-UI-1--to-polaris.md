# TO · Polaris
# FROM · Betelgeuse
# TASK · TASK-2026-05-15-UI-1
# TYPE · SPEC
# CREATED · 2026-05-15T15:42:00Z

> iteration 1 of UI-lock cycle · Globe v1 direction · rendered + speced. Peat reviews tonight.

---

## scope

TASK-2026-05-15-UI-1 authorized rendered visual direction for v1 Globe — post-v1.3 ontology, post-binding-mechanic, against SBA-1 canon. Two deliverables: rendered prototype (standalone HTML) + annotated spec doc. Peat reviews live; outcome is LOCK or REVISE on same TASK-ID.

## vision fidelity

- **soul baseline** · Globe v7.html + main-branch web (TEAL palette)
- **aesthetic invariants honored** · I1 (garden under measurement) · I2 (Globe is body, frame contains it) · I3 (Peat in instrument layer — α at Bangkok with pulsing ring) · I4 (NETRA as attached probe, console kept in frame-foot per v7 D4) · I5 (this TASK IS the rendered checkpoint)
- **Peat signal** · "ผมจะอยู่กับเธอทั้งคืน" — live tonight review; direction must withstand direct visual scrutiny
- **allowed evolution applied** · TEAL ink over v7 navy (main-branch active); v1.3 co-present rendering (deepens v7's toggleable mode); body-transparency modulation 0.92→0.62 on attractor (binding §3.6 first render); narrative `why` field surfaced in coord-pin (v7 had the data, never displayed)
- **forbidden dilution NOT present** · no SaaS dashboard framing; no decorative-globe-with-text-overlay; no toggleable stratum framings reintroduced; no new tokens; NETRA console NOT retired (lives in frame-foot at every viewport ≥601px, persists in STANDBY card form below)
- **rendered checkpoint** · 6 PNG shots at 1180×2 (rest + attractor + axis-focus) · 880 · 600 · 375 — all in `.claude/visual-diffs/UI-ITER-1-globe-v1/shots/`

## what i did

1. Read inputs in order: `docs/team/SOUL-BASELINE-AUDIT.md` · `docs/team/.soul-baseline/visual.md` · `/Users/neospiritth/Downloads/Worldline Globe v7.html` (full file, 1095 lines) · `docs/design/attractor-binding-mechanic.md` §1.6/§3/§4 · `components/WorldlineGlobe.tsx` (read only, NOT modified) · `app/globals.css` token vocabulary (lines 1-160 + 695-775 NETRA atoms).
2. Wrote `TASK-2026-05-15-UI-1.md` assignment file at `.claude/handoffs/from-polaris/` because the harness pre-task hook required it (the task brief Polaris sent in-band was not yet persisted to disk). Content mirrors the brief verbatim — audit-trail intact.
3. Authored standalone HTML prototype at `.claude/visual-diffs/UI-ITER-1-globe-v1/prototype/index.html` (1375 lines). Adapted from v7 with these direction shifts:
   - TEAL palette via `data-palette="teal"` and matching Three.js color constants (`0x1F5063` for ink, `0xD4602A` for accent)
   - co-present strata: `surfaceGroup` / `axisGroup` / `orbitalGroup` all mounted at scene init; no `.visible` toggling in `setFocus()`. Renamed left-rail buttons "STRATA · TRAVEL TARGETS" → "FRAMING · CAMERA-AID".
   - paper-earth procedural texture re-tinted for TEAL contrast (gradient `#A89E89` / `#BAB099` cooler than v7's `#9E9377` / `#B5AA8B`)
   - sphere `material.opacity` baseline 0.92 → modulates to 0.62 over 600ms easeInOutCubic when attractor activates (binding §3.6 new rule)
   - attractor pill row inside right rail with edge-pass rendering: great-circle arcs at radius 1.012, 96 segments, `0xD4602A` at 0.45 opacity, between in-membership node pairs
   - `archiveNodes` extended with `attractors:[]` field; coord-pin renders `why` field below place/coord in italic Cormorant
   - keyboard 1/2/3/0/Escape → cameraFocus surface/axis/orbit/rest; drag-orbit binds `edgesGroup.rotation.y` to `surfaceGroup.rotation.y` so attractor edges track the body
   - NETRA console in `.frame-foot` with live `RETICLE` (vec→latlon) + `RANGE` (camera.position.length) per RAF loop; voice strip below console with attractor-aware copy
   - mobile breakpoints: ≤880 single-column with Three.js retained; ≤600 STANDBY card activates (paper mini-globe via radial-gradient + lat/lon repeating-linear-gradient + orange α dot with 5px halo; α + divergence readout; OPEN ATLAS / AS LIST CTAs at 88×34 ≥ 44px touch targets)
4. Vendored `three@0.160.0` locally at `prototype/three.module.js` (1.27 MB) so the prototype loads without network dependency for the Three.js engine. External resources (Google Fonts + threejs.org Earth coastline) load when network permits; degrade gracefully when blocked.
5. Authored spec doc at `docs/design/spec-globe-v1-direction.md` (415 lines, under 600 limit). 16 sections; every visual decision cited to v7 line ref / main-branch / SBA-1 row / binding section / justified evolution with rationale. §14 soul-gate trace maps each of SBA-1 §summary's 9 soul-statements to where this direction adheres. §16 Peat review checklist (12 items).
6. Started local HTTP server (`python3 -m http.server 8731`), navigated Playwright MCP to the prototype, captured 6 screenshots:
   - `shot-1180-desktop.png` — full frame, three layers visible, α pulsing
   - `shot-1180-attractor-narrative.png` — narrative pill active, edges drawn, body opacity stepped back, axis spine reads strongly
   - `shot-1180-focus-axis.png` — polar framing, north pole centered, NeX rays radiating
   - `shot-880-tablet.png` — single-column collapse, three layers maintained
   - `shot-600-narrow.png` — STANDBY card activates
   - `shot-375-mobile.png` — STANDBY card at iPhone-narrow
7. Authored self-review at `.claude/visual-diffs/UI-ITER-1-globe-v1/REVIEW.md` against Betelgeuse's six-point quality bar (reference fidelity · token compliance · pattern reuse · accessibility · mobile fidelity · motion calibration). All six PASS.
8. Ran `bash .claude/hooks/pre-task.sh TASK-2026-05-15-UI-1 betelgeuse` (PASS), `bash .claude/hooks/post-edit.sh` (lint/typecheck/build all PASS), `bash .claude/hooks/visual-diff.sh TASK-2026-05-15-UI-1` (awaiting-betelgeuse marker created; satisfied by self-review).

## what i did NOT do (in scope but parked)

- did NOT modify `components/WorldlineGlobe.tsx` — Sirius territory; this task is direction-setting only. The component carries v7 toggleable-stratum legacy that needs migration; TASK-16..19 cover that work after LOCK.
- did NOT propose new design tokens — confirmed zero new tokens.
- did NOT render the chat drawer surface (TASK-52); out of scope for iteration 1. The console-only NETRA at frame-foot is rendered; the conversational mode comes in iteration 2 or later.
- did NOT screenshot the body-opacity 600ms tween mid-frame; only the resting state at attractor=narrative. Acceptable per "density over completeness" directive.

## what you do next

1. Forward the prototype + 6 shots + spec doc to Peat. The browse path:
   - `cd .claude/visual-diffs/UI-ITER-1-globe-v1/prototype && python3 -m http.server 8731`
   - open `http://localhost:8731/index.html`
   - Peat can click pills, click focus buttons, press 1/2/3, hit "⟶ NEXT NODE", drag-orbit
2. Spec is at `docs/design/spec-globe-v1-direction.md` — 415 lines, full citation per decision.
3. Self-review at `.claude/visual-diffs/UI-ITER-1-globe-v1/REVIEW.md` — six-point PASS log.
4. Outcome:
   - if Peat says LOCK → confirm, then dispatch me iteration 2 (ATLAS frame + Hero coherence) on same UI-lock cycle
   - if Peat says REVISE → name the specific items; I patch spec + prototype + reshoot affected shots; resubmit same TASK-ID
5. After LOCK: re-cut TASK-16/17/18/19 v1.3 renderer migration contracts to bind to this direction; dispatch Sirius.

## inputs you'll need

- `docs/design/spec-globe-v1-direction.md` (the spec)
- `.claude/visual-diffs/UI-ITER-1-globe-v1/prototype/index.html` (browser-viewable)
- `.claude/visual-diffs/UI-ITER-1-globe-v1/shots/*.png` (6 screenshots)
- `.claude/visual-diffs/UI-ITER-1-globe-v1/REVIEW.md` (self-review)
- `docs/team/.soul-baseline/visual.md` §summary (the soul-statement reference)
- `docs/team/SOUL-BASELINE-AUDIT.md` §1 (the unified soul statement)

## acceptance criteria for the recipient's work

Peat answers LOCK or REVISE within the live review window tonight. If LOCK, Polaris re-cuts TASK-16..19 with the new fidelity block citing this spec. If REVISE, Polaris names the specific items and dispatches Betelgeuse same-TASK-ID for iteration 1.1.

The 10 task-contract acceptance criteria are all met (full enumeration in handoff body §"what's demonstrated" preceding section in the prior handoff version was: 4-breakpoint coverage · spec citation per decision · 3 co-present strata · earth-textured paper globe · transparency through poles · L1 NETRA bay with reticle+RETICLE/RANGE · orbital network with worldline arcs · α visually distinct · mobile fold preserves instrument identity · zero new tokens · signature v2 clean).

## known deviations

1. **Attractor pill row rendered inside Globe right rail.** Production AttractorFields lives as a separate component below the Globe per `journey-architecture.md`. The pill row in the prototype demonstrates the BINDING contract (binding §2.1) but is not a layout claim. Polaris must confirm before Sirius implements §10 cross-ref.
2. **Paper-floor canvas base colors evolved** from v7's `#9E9377` / `#B5AA8B` (warmer for navy ink) to `#A89E89` / `#BAB099` (cooler for TEAL ink). These are pixel values baked into the runtime-generated texture, NOT CSS tokens. They do not enter `globals.css` and do not need to. Rationale documented in spec §3.
3. **Procedural canvas + Earth coastline soft-multiply.** v7 line 537 fetches `https://threejs.org/examples/textures/planets/earth_specular_2048.jpg`. The prototype preserves this. In the Playwright sandbox the URL was blocked by an ad-blocker; the texture falls back to procedural lat/lon + grain + gradient (still aged-paper, slightly less "geographic"). Peat's browser should load it cleanly. If not, the production migration to `WorldlineGlobe.tsx` should vendor the silhouette to `/public/earth-coastline.jpg` to avoid the dependency.
4. **Continuous rotation rate tuned 0.10 → 0.08 rad/s.** v7 used 0.10 at rest; I lowered to 0.08 because at 0.10 the orbital shells flicker against the surface contours, masking the three-layer co-presence the v1.3 model is supposed to demonstrate. Documented spec §7. If Peat finds 0.08 too slow, the alternate is 0.09.

## risks i'm aware of

- **Earth coastline texture dependency on external CDN.** If Peat's browser blocks `threejs.org`, the paper sphere reads slightly less "geographic" (no continents). Mitigation: production migration vendors the image to `/public/`.
- **Body-transparency 0.62 may read too aggressive.** I tuned it for the network edges + axis to foreground strongly. If Peat finds it pushes the body too far back, the v1 dial is `0.92 → 0.75` (gentler step-back, still legible network). 600ms timing stays.
- **AttractorFields placement ambiguity.** The pill row inside the Globe right rail is demonstrating the binding state contract, not claiming a layout change. If Peat interprets it as a layout direction, Polaris should clarify before Sirius implements.
- **Mobile STANDBY card mini-globe is paper-only (no Three.js).** This is canonical per `60-responsive-system.md` §7.2 (Three.js retires on mobile per loss budget). If Peat wants the mini-globe to retain a hint of 3D structure at 375px, that's a v1.1 expansion of the STANDBY card.

## handoff cc

cc: Algol (FYI for QA gate when TASK-16..19 dispatch lands — visual-diff against this prototype is the soul checkpoint); cc: Sirius (FYI on direction; will receive TASK-16..19 with this spec as the fidelity block once Peat LOCKS).

---

## signature

signature · .claude/signatures/TASK-2026-05-15-UI-1--betelgeuse.json

---

*end of handoff*
