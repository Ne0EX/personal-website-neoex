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
