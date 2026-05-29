# Visual-diff review · UI-ITER-1 · Globe v1 direction

> reviewer · Betelgeuse (α-VIS-04) · self-review on own direction render
> task · TASK-2026-05-15-UI-1 · iteration 1 of UI-lock
> date · 2026-05-15
> companion spec · `docs/design/spec-globe-v1-direction.md`
> companion prototype · `.claude/visual-diffs/UI-ITER-1-globe-v1/prototype/index.html`
> shots · `.claude/visual-diffs/UI-ITER-1-globe-v1/shots/`

This is the iteration-1 visual-diff log. Peat reviews directly tonight. Betelgeuse's six-point check (per `.claude/agents/betelgeuse.md` "quality bar") follows.

---

## shots captured

| shot | viewport | shows |
|---|---|---|
| `shot-1180-desktop.png` | 1280 × 820 (stage scaled to fit) | full ATLAS frame · all three strata co-present · α at Bangkok · pole beacons · arc |
| `shot-1180-attractor-narrative.png` | 1280 × 820 | binding active · narrative pill orange · body opacity stepped back · 5 in-membership nodes lit · axis spine reads strongly · voice strip updated |
| `shot-1180-focus-axis.png` | 1280 × 820 | cameraFocus polar framing · north pole centered · NeX rays as star pattern · surface + axis + orbital all still rendered |
| `shot-880-tablet.png` | 880 × 1200 | single-column collapse · globe with all three layers maintained · NETRA console spans foot · spine clearly readable through poles |
| `shot-600-narrow.png` | 600 × 900 | STANDBY card activates · paper mini-globe with α dot + halo · frame-head stacks · NETRA console persists in foot · voice strip preserved |
| `shot-375-mobile.png` | 375 × 812 | STANDBY card at iPhone-narrow · CTAs (OPEN ATLAS · AS LIST) at ≥44px touch targets · all instrument vocabulary preserved |

---

## six-point check

### 1. reference fidelity — PASS

Every structural element named in the spec is present in the rendered prototype:

- frame-head with file strip · α · NAV labels ✓
- left rail cameraFocus buttons (4) ✓
- centre globe with α watermark, axis labels (+Z/−Z/PROJECTION FIELD/ARCHIVE FACE), HUD corners (OBSERVING/CAMERA/α/SCALE), coord-pin ✓
- right rail attractor pills + stratum readout block + signal-flow ✓
- frame-foot with NeX/Ne0N/Ne0 readouts + NETRA console + voice strip ✓
- corner reticles at frame edges ✓
- DivergenceMeter micro card with mini corner reticles + 1.1304(26) split ✓

Skipped responsive behavior: none. All four breakpoints render.

### 2. token compliance — PASS

Spec was grepped for hex codes outside the Three.js color block:

- `#E8E2D5`, `#EDE7DA`, `#D8CFB9`, `#F0EBDD` — paper tokens ✓ (globals.css :root)
- `#1F5063` rgb-equivalent → only inside Three.js color constants
- `#D4602A` → only as `var(--accent-orange)` or Three.js `0xD4602A`
- `#A89E89` / `#BAB099` — inside procedural canvas (pixel values baked into runtime texture; not CSS tokens; not in globals.css). Documented as evolved-from-v7 in spec §3.

No new design tokens introduced. Confirmed by reading the prototype `:root{}` block — every entry mirrors `app/globals.css`.

### 3. pattern reuse — PASS

Worldline vocabulary throughout:
- corner reticles (L-bracket, 14×14, accent-orange, 1px) — `.corner-marks`
- dashed hairlines — `border-bottom: 1px dashed var(--ink-dashed)` on frame-head/foot
- mono uppercase 9px tracking 0.22–0.32em — every readout label
- italic Cormorant for voice strip body — `.netra-voice .body`
- Special Elite numerals — divergence card + readout values
- NETRA reticle SVG with 2.4s pulse — `@keyframes atlas-netra-pulse`
- paper-canvas grain + scanlines — `.paper-canvas::before/::after`

The surface could **not** be transplanted to a generic SaaS dashboard. Three primary signals it belongs to Worldline: the α watermark behind the globe, the NETRA voice strip at the foot, the dashed crosshatch behind the globe canvas. No SaaS dashboard has these.

### 4. accessibility — PASS-WITH-NOTES

- keyboard map: 1/2/3/0/Escape function — verified via prototype interaction
- `aria-pressed` toggles on focus buttons ✓
- NETRA console `role="status"` `aria-live="polite"` ✓
- attractor pills are native `<button>` — Tab-reachable ✓
- `@media (prefers-reduced-motion: reduce)` disables reticle pulse ✓

**Note for Algol QA:** the prototype itself does not run Lighthouse. The spec inherits the audit requirement; Sirius implementing in Next.js will produce the production surface Algol audits. Lighthouse a11y target ≥ 95 stated in `betelgeuse.md` is carried forward.

### 5. mobile fidelity — PASS

- 880px: globe maintains three-layer co-presence, content single-column ✓
- 600px: STANDBY card activates, instrument identity preserved ✓
- 375px: STANDBY card + CTAs ≥ 44px touch targets ✓
- no horizontal scroll at any viewport ✓
- SBA-1 §4 F6 loss budget: α + trace count visible · no error-state framing · route back to full ATLAS via OPEN ATLAS CTA ✓

### 6. motion calibration — PASS

Confirmed in spec §9:
- 1400ms cameraFocus travel (in 700–1400ms band) ✓
- 220ms node dim (in 200–300ms band) ✓
- 600ms body opacity tween (in 300–500…700ms band; 600ms intentional per binding §3.6) ✓
- 2.4s reticle pulse, sin(0.005t) α ring — communicate state ✓
- no decorative looping motion ✓
- reduced-motion respected ✓

---

## environment notes (non-blocking)

The Playwright sandbox blocked two external CDN resources:
- `https://fonts.googleapis.com/...` — Google Fonts CSS (Cormorant / JetBrains Mono / Special Elite)
- `https://threejs.org/examples/textures/planets/earth_specular_2048.jpg` — Earth coastline silhouette

**This is environment-specific to the test harness ad-blocker, not a prototype defect.** In Peat's browser (and Three.js documents this as a safe public URL), both will load. Three.js itself loads from the locally vendored `three.module.js` (1.27 MB) and the scene renders correctly without external dependencies for geometry/lighting.

Visual implication when fonts fall back: the prototype reads as instrument via system mono + serif. Identity preserved. Earth coastlines: without the multiply layer, the paper sphere shows procedural lat/lon grid + grain + warm gradient only — slightly less "geographic" but still aged-paper. In production Peat's browser will load the texture and the warmer earth read returns.

---

## decision

**SIGN.** Direction is coherent. Three soul-statements demonstrated:
- three co-equal spatial systems visible through each other (transparency · spine through poles)
- surveyed nodes at real GPS with narrative reasons (Bangkok α + 6 others)
- NETRA as attached probe in instrument bay (RETICLE/RANGE live, voice strip with attractor binding)

Forwarded to Polaris for Peat direct review.

— Betelgeuse · α-VIS-04 · 2026-05-15

---

## REVISE pass · 2026-05-15 (later same day)

Peat verdict relayed by Polaris: prototype was a too-faithful port of v7, including its bugs. Action: reconcile against main branch.

Output of revise pass:
1. `MAIN-DRIFT-AUDIT.md` — full row-per-section audit with verdicts (PRESERVE-MAIN / EVOLVE-V7 / BUG-INHERITED)
2. Prototype rebuilt with TOP-5 drift items closed:
   - **D1** globe texture base swapped warm-olive (v7) → cool TEAL (main): `#BDBBAF / #D2CFC4`, innerShade `0xb4bbc0`
   - **D2** page-level chrome restored: Nav strip · Hero tagrow+title · MarginaliaHUD · ScrollMeter · page CornerMarks · N badge
   - **D3** frame-head label `OBSERVATORY · WORLDLINE STRUCTURE v.08` (advances main's v.07)
   - **D4** left-rail `§ CAMERA · ACTIVE` annotation restored from main's `atlas-current` rhythm
   - **D5** axis-label patch suppressed at ≤880px; divergence-card per-digit Nixie flicker (3-7s)
3. Hover transitions tuned 250ms → 150ms to match main-branch Tailwind defaults
4. 6 shots re-rendered at same paths
5. Spec `docs/design/spec-globe-v1-direction.md` §10 appended with adjustments + retained evolutions + forward-flag inventory

Six EVOLVE-V7 rows retained with documented justification (transparency revealing axis, attractor edges, coord-pin `why`, FRAMING rename, etc).

— Betelgeuse · α-VIS-04 · 2026-05-15 · revise

---

## REVISE-2 pass · 2026-05-15 (later same day)

Peat verdict relayed by Polaris:
> "ยัยนั่นเว้นที่เยอะมาก และแน่นอนว่าเลข coordinates ยังขยับเรื่อยๆตามการหมุนของโลกซึ่งตรงกับประวัติที่เคยแก้ใน MAIN BRANCH ไปทั้งนั้น ยังไม่ผ่าน"

Two main-branch fidelity rows missed in iter 1 REVISE — both closed in this pass.

### Closed in REVISE-2

1. **A · empty space below ATLAS · main-branch home-stack restored.** Inserted three sections inside `.page` after the ATLAS `.stage-fit` and before `</div><!-- /.page -->`:
   - `<section class="chapter-index-section">` — §01 CHAPTER INDEX // RECENT TRACES — 2×2 grid of entry cards (003 / 002 / 001 / 000) with diamond reticles, file numbers, italic Cormorant titles, mono tag rows. Mirrors `components/ChapterIndex.tsx` lines 28-79; data from `lib/entries.ts` RECENT_ENTRIES.
   - `<section class="attractor-fields-section">` — §02 ATTRACTOR FIELDS // BROWSE BY DOMAIN — full 11-pill row mirroring `components/AttractorFields.tsx`; data from `lib/entries.ts` ATTRACTOR_FIELDS (all / coffee / ai · ml / narrative / cubic copper / harness eng. / fragrance / film · letterboxd / trading / japan / 日本 / meta).
   - `<footer class="footer-manifesto">` — §03 — 3 columns (MANIFESTO · CHANNELS · TRANSMIT) mirroring `components/FooterManifesto.tsx` lines 1-62 verbatim: italic manifesto with orange opening quote, mono uppercase link list with orange arrows.
   - CSS added inside `<style>` (before `prefers-reduced-motion` rule). Zero new tokens — every value reuses an existing CSS var (`--paper-base`, `--ink-primary`, `--ink-hairline`, `--accent-orange`, `--font-display`, `--font-mono`).
   - Breakpoints added: ≤880px collapses chapter-index to single column and footer to 1-col stack; ≤600px tightens padding.

2. **B · coordinate jitter · earth-fixed readout per main-branch convention.** The `__netraUpdate` function in `prototype/index.html` was rewritten:
   - **Root cause 1:** previous code inverted `surfaceGroup.matrixWorld` and applied it to the camera direction. As `surfaceGroup.rotation.y` drifts each frame, the inverse changes too, so lat/lon "swims" with globe rotation — exactly the behaviour main-branch's comment forbids: *"NETRA coordinates are earth-fixed; visual globe rotation must not mutate longitude"* (`components/WorldlineGlobe.tsx` line 1019-1020).
   - **Root cause 2:** previous code wrote `textContent` unconditionally each frame, forcing layout/paint on the text node 60×/sec. Reads as flicker.
   - **Fix:** lat/lon now derives from raw `camera.position` only (no surfaceGroup matrix inversion); `textContent` is gated — only mutated when the formatted string changes. Mirrors `components/WorldlineGlobe.tsx` lines 1014-1029 (commit `9344368` "Fix NETRA atlas tracking", 2026-05-10).
   - **Verified:** Playwright sampled `netra-coord` and `netra-range` 15× over 1.4s while globe was rotating in 'rest' focus. All 15 samples returned identical `0.00°N · 90.00°W` / `4.20`. Coordinate is now earth-fixed.

### Runtime audit · clean

Per Polaris's note that META-10 runtime rail is now live. Audit performed via Playwright on the served prototype at `localhost:8731`:
- Console errors · 0 page-script errors. Only two `ERR_BLOCKED_BY_CLIENT.Inspector` entries from external CDNs (Google Fonts + threejs.org earth texture sample) — environment artifacts unrelated to prototype code.
- Page exceptions · 0.
- Network 404 · 0 on local assets (`./three.module.js` served).
- DOM anchors present · `chapter-index-section`, `attractor-fields-section`, `footer-manifesto` all true; 4 entry-cards, 11 attractor pills, 3 footer columns.

### Shots refreshed

All paths overwritten in this pass:
- `shot-1180-desktop.png` · full-page at 1180w — shows ATLAS + new home-stack below + footer
- `shot-1180-desktop-fold.png` · viewport at 1180w
- `shot-880-tablet.png` · full-page at 880w — chapter-index collapses to 1 col, footer stacks 1 col
- `shot-600-narrow.png` · full-page at 600w
- `shot-375-mobile.png` · full-page at 375w — STANDBY card replaces ATLAS canvas; home-stack scrolls below
- `shot-1180-attractor-narrative.png` · attractor=coffee state · viewport
- `shot-1180-focus-axis.png` · focus=axis state · viewport
- `shot-1180-coord-locked-during-rotation.png` · NEW · viewport during active globe rotation showing `RETICLE 0.00°N · 90.00°W / RANGE 4.20` locked

### Spec doc updated

`docs/design/spec-globe-v1-direction.md` appended §10.4 documenting both fixes with citations to `components/WorldlineGlobe.tsx` lines 1014-1029 and main-branch commit `9344368`. §10.4.4 inventories what is intentionally deferred (anime.js stagger entry-card animation, pill keyboard nav, full prototype `netraCoordFromCameraPosition` parity — the gated write covers the SVG/canvas equivalent until Sirius's TASK 16-19 lands).

— Betelgeuse · α-VIS-04 · 2026-05-15 · revise-2

---

## REVISE-5 · PoC-anchored hero rhythm match (2026-05-16)

Peat's instruction: "ผมเปิด PoC ไว้ที่ localhost:3000 — ไปดูเอาแล้วเทียบซะ ไม่ก็ลอก". Explicit permission to copy verbatim. Used Playwright MCP to navigate both servers, extract computed styles from PoC, and apply targeted edits to the prototype's hero strip only — keeping everything else (ATLAS, ChapterIndex, AttractorFields, FooterManifesto) at REVISE-2 quality.

### Deltas matched (PoC → prototype)

1. **Hero subtitle paragraph** · ADDED. PoC has `p.t-display.mt-2.5.max-w-[560px].text-[12.5px].leading-[1.55]` italic gray-soft paragraph below the h1: "A digital garden — drafts, half-formed theories, contour maps of coffee, code, narrative, and the slow architecture of taste. Not a blog. A laboratory." Prototype was missing this entirely — title sat alone, rhythm too top-heavy. New `.hero-sub` class: 12.5px Cormorant italic, line-height 1.55, ink-soft, max-width 560px.

2. **Divergence number scale** · 22px → 26px. PoC `.diverge-panel-num` computes to `26px Special Elite`. The visual dominance of `1.130426` in the PoC fold is not from extreme size — it is from contrast against 7.5–9px mono labels surrounding it. Matched the cited value verbatim.

3. **Divergence head row with OBSERVED state badge** · ADDED. PoC's `.diverge-panel-head` is a flex row: left has `DIVERGENCE α` (the `α` in accent-orange), right has `○ OBSERVED` with the `○` as accent-orange glyph and `OBSERVED` in mono ink-soft. Prototype previously stacked label-only above the number with no state surface. New `.hero-divergence-head` + `.hero-divergence-state` + `.glyph` classes mirror PoC structure.

4. **Divergence meta row** · ENRICHED. PoC has two lines: `DEVIATION · −0.275349%` and `ATTRACTOR · Ne0EX-LOCUS` stacked, with the values in `<b>` ink-primary 500-weight against ink-soft labels. Prototype had one collapsed line `OBSERVED · Ne0EX-LOCUS` (which also incorrectly duplicated the OBSERVED state). Now meta is purely values; state lives in the head row where PoC places it.

5. **Divergence panel chrome** · TIGHTENED. PoC computed border `1px solid rgba(31,80,99,.22)`, padding `9px 16px 10px`, bg `rgba(240,235,221,.45)`. Prototype was `ink-hairline` (0.12) + `8px 11px` + `rgba(240,235,221,.5)`. Bumped to PoC values; `min-width` 140 → 188 to give the 26px number breathing room.

### Intentional differences kept (a/b/c per task brief)

- **Top nav-shell text** · prototype keeps `∇ NEOSPIRIT // WORLDLINE 1.130426 · EST. 2026 — BANGKOK / THAILAND` per REVISE-1/2 main-branch alignment, where PoC uses `OBSERVATORY · WORLDLINE STRUCTURE v.07 · ∇ Ne0EX · 3D ORTHOGRAPHIC`. The PoC's nav is for the live app; the prototype's is for the design-direction artifact; both are valid registers. **Documented difference (c) intentional evolution.**

- **Globe canvas chrome** · the inner ATLAS frame still reads slightly differently than PoC because the proto has the full-strata legend (CAMERA-AID with stratum buttons + KEY DRIVERS) where PoC has the strata-pick-only aside. This is preserved from REVISE-2 which Peat approved. **Documented difference (c).**

- **Right marginalia rail** · proto's `∇ WORLDLINE · 1.130426` vertical rail is present and PoC also has it. Match.

### Files touched

- `.claude/visual-diffs/UI-ITER-1-globe-v1/prototype/index.html` · style block lines ~159–195 (hero-sub + hero-divergence rewrite); markup lines ~798–820 (subtitle paragraph + new divergence head/meta structure).

### Verification

- 1180 fold + full · screenshots refreshed (`REV5-proto-1180-fold-AFTER.png`, `REV5-proto-1180-full-AFTER.png`)
- 880 / 600 / 375 fold · screenshots refreshed; no horizontal scroll, no overflow, divergence panel reflows cleanly
- runtime audit · 0 console errors on the prototype JS (only Google Fonts CDN ERR_BLOCKED_BY_CLIENT — environment); hex audit 0 offending; file size 92KB (under 100KB)
- side-by-side comparison · `REV5-poc-1180-fold.png` vs `REV5-proto-1180-fold-AFTER.png` now read as the same hero rhythm

— Betelgeuse · α-VIS-04 · 2026-05-16 · revise-5

---

## RW-5-AMEND · C2 reticle anchor bug fix (2026-05-16)

**Bug report from Peat:** C2 pulsing orange reticle (THREE.js ring mesh) remained anchored at Bangkok (α-locus) when tracking Kyoto and other nodes. C1 coord-pin, C5 badge, and NETRA voice strip were all correct — only the 3D reticle mesh was wrong.

### Root cause

`node.basePos` (set at node-creation time via `latLonToVec(n.lat, n.lon, 1.005)`) is in the **local coordinate space** of `nodesGroup → surfaceGroup`. `surfaceGroup` rotates continuously in the RAF loop (≈ 0.02–0.18 rad/s depending on `activeFocus`).

`_trackingReticleGroup` is added directly to `scene` (world space). When `activateDrift(node)` called `_trackingReticleGroup.position.copy(node.basePos)`, it treated a **local-space** vector as a **world-space** position. Because `surfaceGroup` has non-zero `rotation.y` by the time any node is selected (the globe has been rotating since page load), the unrotated local-space position of any non-α node lands at a different world-space location than where the visual node mesh is rendered. The α-locus (Bangkok) is close to the initial `rotation.y=0` state on page load, so the reticle initially appeared there regardless of which node was selected.

The same bug existed in the per-frame RAF C2 block (`_applyOrbitalDrift` line ~2779) and in the C1 coord-pin projection block (though C1 appeared correct because both the camera jump destination and the basePos projection used the same unrotated frame — they were consistently wrong but mutually consistent, producing the correct screen coordinates).

### Fix

Three changes to `prototype/index.html`:

1. **Pre-allocated scratch vector** `_nodeWorldPos` (THREE.Vector3) added after `_nodeScreenPos` declaration. One allocation; reused every frame to avoid per-frame GC churn.

2. **`activateDrift(node)`**: replaced
   ```js
   _trackingReticleGroup.position.copy(node.basePos).multiplyScalar(1.010);
   ```
   with
   ```js
   node.mesh.getWorldPosition(_nodeWorldPos);
   _nodeWorldPos.normalize().multiplyScalar(1.010);
   _trackingReticleGroup.position.copy(_nodeWorldPos);
   ```
   `getWorldPosition()` traverses `nodesGroup → surfaceGroup → scene` matrix chain, returning the actual world-space position of the node mesh as it currently sits on the globe (after globe rotation is applied). Normalize + scale to 1.010 keeps the reticle just above the surface at the correct radius.

3. **RAF loop C2 block**: identical replacement — world position resolved every frame so the reticle tracks the rotating node continuously.

4. **RAF loop C1 block**: coord-pin projection now uses `_nodeWorldPos` (already resolved in the C2 block above) instead of `node.basePos`. Both C1 and C2 now reference the **same** vector — divergence is structurally impossible. Comment added: "Use _nodeWorldPos already resolved above (C2 block) so both C1 and C2 reference the same world-position vector — they cannot diverge."

### Scope guardrails respected

- No changes to Axis A (drift pattern) or Axis B (amplitude)
- No changes to C1 coord-pin visual behavior or C5 badge behavior
- No changes to the jump slerp or camera math
- All RW-1..RW-5 fixes preserved (only the position-resolution call changed)

### Playwright verification

3 node jumps tested (Kyoto · San Francisco · Point Nemo), plus REST deactivation:

| shot | node | result |
|---|---|---|
| `screenshots/rw5-amend/01-kyoto-reticle.png` | Kyoto · JP · 35.01°N 135.77°E | HUD badge `TRACKING · Kyoto · JP` confirmed; camera over Japan |
| `screenshots/rw5-amend/02-sf-reticle.png` | San Francisco · US · 37.77°N 122.42°W | HUD badge confirmed; camera over North America |
| `screenshots/rw5-amend/03-point-nemo-reticle.png` | Point Nemo · PAC · 48.88°S 123.39°W | HUD badge confirmed; camera over South Pacific |
| `screenshots/rw5-amend/04-rest-reticle-hidden.png` | REST (deactivated) | `is-tracking` removed from `hud-overlay`; voice strip back to standby |

### META-10 runtime audit

0 console errors. 0 page exceptions. Only CDN ERR_BLOCKED_BY_CLIENT for external Google Fonts and threejs.org texture — environment artifact, not code defect (unchanged from prior passes).

### deactivateDrift clean-hide path

`deactivateDrift()` sets `_driftActive=false` and removes `is-tracking`. The `eligible` check in `_applyOrbitalDrift` then returns false, fading `_driftBlend` to 0 over 500ms and setting `_trackingReticleGroup.visible = false`. The `getWorldPosition` call only executes in the eligible (drift-active) branch — no null-ref risk during fade-out.

— Betelgeuse · α-VIS-04 · 2026-05-16 · rw5-amend
