# HANDOFF · Betelgeuse → Polaris

> task · TASK-2026-05-15-UI-1 · iteration 1 · **REVISE pass**
> from · Betelgeuse (α-VIS-04)
> to · Polaris (α-OPS-00)
> date · 2026-05-15
> kind · REVISE-complete · returning for Peat re-review

ค่ะ Polaris — รอบนี้ส่งกลับมาให้ตรวจอีกที ก่อนเข้า Peat

---

## what changed since the original return

Peat verdict was that iter 1 was a too-faithful v7 port (bugs and all). The revise pass reconciles the prototype against the **main-branch** UI as the living product baseline, not v7 as the soul baseline.

### deliverables (all paths absolute under repo root)

1. **NEW · `.claude/visual-diffs/UI-ITER-1-globe-v1/MAIN-DRIFT-AUDIT.md`**
   - Row-per-section audit against `app/page.tsx` + `components/WorldlineGlobe.tsx`
   - Three verdicts per row: PRESERVE-MAIN · EVOLVE-V7 · BUG-INHERITED
   - TOP-5 drift adjustments ranked by visual-soul impact
   - Six EVOLVE-V7 rows documented with Peat-defensible justification
   - Forward-flag inventory for iter ≥2

2. **UPDATED · `.claude/visual-diffs/UI-ITER-1-globe-v1/prototype/index.html`**
   - **D1 fixed** · globe texture base palette: warm-olive `#A89E89 / #BAB099` → cool `#BDBBAF / #D2CFC4` (matches `components/WorldlineGlobe.tsx` line 267-270). innerShade tint `0xBFB69F` → `0xb4bbc0` (matches main line 418).
   - **D2 fixed** · page-level scope expanded: compact Nav strip · Hero tagrow + italic title + counts stack + compact divergence card · MarginaliaHUD vertical band · ScrollMeter top rail · page-level CornerMarks · N floating badge bottom-left.
   - **D3 fixed** · frame-head label `WORLDLINE · OBSERVATORY v.01` → `OBSERVATORY · WORLDLINE STRUCTURE v.08` (advances main's v.07).
   - **D4 fixed** · left-rail `§ CAMERA · ACTIVE` annotation block restored above the divergence card (mirrors main-branch `atlas-current` rhythm).
   - **D5 fixed** · axis-label background patch suppressed at ≤880px (was reading as a notch through the dashed rule); divergence-card per-digit Nixie flicker added (3-7s interval, respects `prefers-reduced-motion`).
   - Hover transitions tuned 250ms → 150ms to match main-branch.

3. **UPDATED · 6 shots in `.claude/visual-diffs/UI-ITER-1-globe-v1/shots/`** (overwritten)
   - `shot-1180-desktop.png` — full page (Nav · Hero · ATLAS frame · marginalia · N badge)
   - `shot-1180-desktop-fold.png` — viewport-only at desktop
   - `shot-1180-attractor-narrative.png` — narrative attractor active, body steps back, spine reads through
   - `shot-1180-focus-axis.png` — cameraFocus axis (polar framing)
   - `shot-880-tablet.png` — single column collapse, globe maintains three layers
   - `shot-600-narrow.png` — STANDBY card active
   - `shot-375-mobile.png` — iPhone-narrow STANDBY

4. **UPDATED · `docs/design/spec-globe-v1-direction.md` §10**
   - Appended "Main-branch reconciliation" section
   - Records D1-D5 adjustments
   - Documents 6 EVOLVE-V7 rows retained
   - Inventory of forward-flagged items

5. **UPDATED · `.claude/visual-diffs/UI-ITER-1-globe-v1/REVIEW.md`** — revise-pass addendum appended.

---

## verdict breakdown (from the audit)

| verdict | count | summary |
|---|---|---|
| **PRESERVE-MAIN** | 18 atoms | 5 ADD (this pass) · 13 already matched main |
| **EVOLVE-V7** | 9 atoms | all documented with Peat-defensible source ref |
| **BUG-INHERITED** | 3 atoms | all closed this pass (globe texture base × 2 + axis-label patch) |

Net: zero remaining bugs inherited from v7. Soul evolutions retained where they're explicitly Peat-locked.

---

## what stays evolving (retained as EVOLVE-V7)

These rows diverge from main-branch deliberately, and the spec §10.3 carries the citation for each:

1. `FRAMING · CAMERA-AID` (vs main's `STRATA · TRAVEL TARGETS`) — v1.3 ontology canon
2. `0/1/2/3 · REST/SURFACE/AXIS/ORBIT` (vs main's `1/2/3 · NeX/Ne0N/Ne0`) — downstream of #1
3. `paperMat` opacity 0.92↔0.62 (vs main's opaque body) — Peat-locked transparency 2026-05-15
4. Attractor edges + body step-back (vs main's no-binding) — binding mechanic §2.1+§3
5. Coord-pin renders narrative `why` (vs main's coords-only) — SBA-1 §summary item 4
6. Left-rail divergence-card kept (vs main's hero-band) — instrument-self-completeness for Globe-isolation iter

If Peat wants any of these reverted, the spec §10.3 is the single line-item ledger to interrogate.

---

## what's flagged forward (not in this pass)

- Full DivergenceMeter hero band (full-width, Nixie reroll on boot)
- ChapterIndex grid (entry cards)
- FooterManifesto (3-col)
- BootSequence (first-visit calibration)
- SurveyCursor (cursor reticle)

These are PRESERVE-MAIN but explicitly out of Globe-direction scope. Polaris dispatches in iter ≥2.

---

## decision request

Forward to Peat for direct review. Acceptance criteria from the original revise brief:

- [x] MAIN-DRIFT-AUDIT.md exists with row per main-branch component section + verdicts
- [x] Prototype no longer inherits v7-specific bugs
- [x] Prototype palette matches main branch (TEAL throughout · no navy leftover · no v7-warm globe texture base)
- [x] All 6 screenshots refreshed
- [x] spec-globe-v1-direction.md §10 documents adjustments
- [x] Signature v2 clean

---

## environment note (carries from iter 1, non-blocking)

Playwright sandbox blocks two external CDN resources:
- `https://fonts.googleapis.com/...` — Google Fonts CSS (Cormorant / JetBrains Mono / Special Elite)
- `https://threejs.org/examples/textures/planets/earth_specular_2048.jpg` — Earth coastline silhouette

Both will load in Peat's browser. The prototype falls back to system mono + serif when fonts are blocked; identity is preserved (instrument register reads even with fallback).

---

— Betelgeuse · α-VIS-04 · TASK-2026-05-15-UI-1 · REVISE · 2026-05-15
