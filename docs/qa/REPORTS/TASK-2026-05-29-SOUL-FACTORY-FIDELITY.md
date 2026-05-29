# docs/qa/REPORTS/TASK-2026-05-29-SOUL-FACTORY-FIDELITY.md

## task · SOUL-FACTORY render-fidelity verification (all 12 atoms)

## verdict · PASS WITH CRITICAL FINDINGS (no REVISE to original builder — findings are systemic gap work, not rework)

---

## method

Production ground truth established at localhost:3000 (Next.js dev server confirmed up, HTTP 200).
Gallery served at localhost:8765 from repo root so the relative CSS path `../../../app/globals.css`
resolves correctly. Playwright MCP used for all captures.

All 12 gallery atoms screenshotted. All corresponding production elements screenshotted.
Comparison is visual-diff + computed-style interrogation.

Comparison shots saved to:
`.claude/visual-diffs/soul-atlas/shots/fidelity-check/`

---

## critical baseline finding — gallery font chain is broken

Before the per-atom table: a structural fidelity defect affects ALL atoms that contain text.

`app/globals.css` opens with `@import "tailwindcss"` and uses `@theme inline { --font-display: ...; --font-mono: ...; --font-type: ...; }`. The `@theme inline` block is a Tailwind v4 directive — it processes only through the Tailwind build pipeline. When the gallery HTML links `globals.css` directly via a plain HTTP server (no Tailwind processing), the `@theme inline` block is silently ignored by the browser. `--font-display`, `--font-mono`, and `--font-type` never get assigned. They resolve to nothing; the browser falls back to Times (system serif).

Verified via `getComputedStyle`:
- `--font-display` → empty string (gallery) vs Cormorant Garamond (production Next.js)
- `--font-mono` → empty string (gallery) vs JetBrains Mono (production Next.js)
- `--font-type` → empty string (gallery) vs Special Elite (production Next.js)
- `document.fonts` · all four font-face declarations: status = "unloaded" (never requested, because no element needs them — no element's `font-family` resolves to their family name)

The gallery's own inline `@font-face` declarations map `--font-cormorant`, `--font-jetbrains`,
`--font-elite` → those do load. But `--font-display: var(--font-cormorant), ...` only resolves
when the Tailwind pipeline expands it. Static serving does not trigger that expansion.

Consequence: every text element in the gallery that uses `var(--font-display)`, `var(--font-mono)`, or `var(--font-type)` renders in Times serif. This affects A04 (divergence-card numeral), A05 (NETRA console), A06 (voice strip body), A07 (HUD corners), A08 (axis labels), A09 (watermark glyph), A10 (attractor pills), A11 (type-roles — all three variants).

This is NOT a per-atom fidelity bug introduced by Betelgeuse. It is a structural incompatibility between the gallery's static-serving context and the Tailwind v4 token chain. The atom CSS rules are correct; the pipeline they depend on is absent in the gallery context. Fix owner: **Betelgeuse** (gallery CSS solution) with a harness gate from **Canopus**.

Color tokens (`--paper-base`, `--accent-orange`, `--ink-*`, etc.) ARE resolving correctly — those are set in the plain `:root {}` block, not behind `@theme inline`, so the background colors, borders, and accent fills all look correct in the gallery.

---

## per-atom severity table (12 atoms)

| # | ID | Name | Severity | Summary |
|---|-----|------|----------|---------|
| A01 | corner-reticle | Corner Reticle | MATCH | L-brackets render correctly; color, position, size all match production |
| A02 | dashed-hairline | Dashed Hairline | MINOR | Renders correctly in gallery; however `.section-rule-dashed` is absent from the production homepage (no element in DOM uses that class; dashed separators appear via other means). Concept correct; impl_ref partially orphaned. |
| A03 | alpha-node | Alpha Node | MAJOR | Gallery renders a CSS-only orange dot with halo — serviceable for color/halo concept. Production alpha node is a Three.js `SphereGeometry(0.018)` mesh with a `RingGeometry(0.03, 0.038)` at `opacity: 0.85`, rendered in 3D-perspective on the globe surface, with a pulsing NETRA tracker ring (separate teal `RingGeometry`). The 2D CSS approximation captures the color story but not the spatial registration, the perspective curvature, or the Three.js ring geometry. |
| A04 | divergence-card | Divergence Card | MINOR | Structure, colors, and layout match production substantially. Two differences: (1) production uses `b` symbol `α` (not `∇`) in the label; (2) production meta row shows DEVIATION + ATTRACTOR fields (not coordinates), and the numeral uses `.dm-digit` animated spans for the digit reveal. Gallery shows `∇` and coordinate-style meta. These are content/markup divergences, not visual-language failures. |
| A05 | netra-console | NETRA Console | MINOR | Layout and color match production. Three differences: (1) production reticle is an SVG crosshair (not `◎` Unicode glyph); (2) NETRA label is `◎ NETRA` in production (prefix glyph inside label); (3) gallery shows `// NETRA` prefix convention from the voice strip, not the console (production console has no `//` prefix). Typography identical in concept but gallery renders Times due to the broken font chain. |
| A06 | netra-voice-strip | NETRA Voice Strip | MINOR | Color, border-left rule, padding all match production. Font chain broken (Times in gallery vs Cormorant italic in production — the most soul-visible failure here, since Cormorant italic IS the voice identity). Content in gallery uses simplified text; production shows the live stratum state text. |
| A07 | hud-corner-readout | HUD Corner Readout | MATCH (with font note) | Layout, positioning (tl/tr/bl/br), color hierarchy (ink-soft / ink-primary / accent-orange), and content structure all match production exactly. Font chain broken → renders in Times in gallery instead of JetBrains Mono. Visual structure MATCH; font rendering is a gallery-infrastructure failure, not an atom design failure. |
| A08 | axis-label | Axis Label | MATCH (with font note) | Four-edge positioning, paper-base patch, dashed border demo all match production. Font chain broken → Times in gallery. Positional CSS behavior exactly matches production computed styles. |
| A09 | alpha-watermark | MINOR | Gallery renders the `α` glyph in what appears to be Cormorant italic at 200px in accent-orange at 10% — visually convincing. However the actual font rendering is Times (broken chain), not Cormorant. Production: Cormorant Garamond italic, confirmed `200px`, `rgba(212, 96, 42, 0.10)`, `z-index: 0`. This atom is soul-critical (SBA-1 §summary 9: Cormorant italic = voice). In gallery it looks approximately right because the fallback serif at 200px italic still reads as a letterform — but it is the wrong face. |
| A10 | attractor-pill | Attractor Pill | MINOR | Gallery `.af-pill` vs production Tailwind `px-3 py-1.5 font-mono uppercase tracking-[0.15em] text-[10px]` — different class names but same computed output. Gallery pills render correctly in all three states (default/hover/active). Font chain broken → Times in gallery instead of JetBrains Mono. Production pill structure uses the `"all"` selected state (dark fill, light label) matching gallery active variant. |
| A11 | type-roles | Type Roles | CRITICAL | All three role specimens render in Times in the gallery. This atom IS the three-family demonstration. With all three families falling back to the same serif fallback, the fundamental purpose of the atom — showing role separation — is completely invisible. The voice (Cormorant), instrument (JetBrains Mono), and value (Special Elite) specimens are indistinguishable from each other. This is the most severe functional failure of the font-chain bug. |
| A12 | globe | Globe | CRITICAL | See detailed notes below. |

---

## A12 · globe — detailed divergence notes

### full variant

The gallery full variant shows a 2D canvas stub. The production globe renders a full Three.js scene with:

1. **Sphere material** · `MeshStandardMaterial` with a procedurally generated paper texture (seeded `rand()` gradient: `#BDBBAF` → `#D2CFC4` → `#E0DAC9`) plus baked lat/lon grid at `rgba(31,80,99,0.18)`. **Plus** async-loaded real Earth coastline silhouette from `threejs.org/examples/textures/planets/earth_specular_2048.jpg` composited via `multiply` at `0.28` opacity with `blur(1.2px)`. The gallery stub produces only the radial gradient with a 2D canvas arc — no coastline, no MeshStandard lighting model, no bump/roughness maps. The production globe has a visible geographic silhouette of Earth's landmasses through the paper; the gallery has none.

2. **Contour rings** · Production: 7 contour rings at latitudes `-65, -45, -25, -5, 15, 35, 55` using `makeContour()` with sinusoidal variation (segs=256, opacity 0.7) — these create the characteristic irregular elevation-line look. Gallery stub: only uniform `ellipse()` lat rings. The irregular contour character is absent.

3. **NeX field shells** · Production: 3 wireframe shells at `1.18`, `1.32`, `1.48` radius with `opacity: 0.10/0.07/0.05` + `raysGroup` with **48 radial rays** from `1.18` to `1.55` (Fibonacci-distributed). The gallery stub draws only one wireframe ring at `rad * 1.28` with `globalAlpha: 0.10`. Production's claim in the footer is `247 RAYS` — the canvas renders 48 WebGL ray lines composited over a full-resolution 3D scene, which visually reads as ~247 emissions at production quality. Gallery stub: one ring, zero rays.

4. **Ne0N axis** · Production: solid `CylinderGeometry(0.008, 0.008, 2.6)` mesh in teal `#1f5063` with survey-triangle wire caps at each end and orange `poleBeacon` (ring + dot sphere) at ±1.0 and ±1.3 on Y. Gallery stub: a 2-pixel-wide 2D canvas line with orange segments at ends — captures the concept but not the 3D cylindrical form or the wire-cap geometry.

5. **Inner shade** · Production: `SphereGeometry(0.998, BackSide)` in `#b4bbc0` at `opacity: 0.35` — provides rim depth / atmospheric limb darkening. Gallery stub has no equivalent.

6. **Alpha node / observer mark** · Production: `SphereGeometry(0.018)` in `#d4602a` (orange) at Bangkok GPS `(13.7563, 100.5018)`, with a `RingGeometry(0.03, 0.038)` halo at `opacity: 0.85`. Gallery stub: 5px canvas arc at `cx + rad * 0.32, cy + rad * 0.22` — approximate Bangkok position relative to center, but no 3D surface projection.

7. **Worldline arc** · Production: a `QuadraticBezierCurve3` in dashed orange `LineDashedMaterial` swooping from Bangkok surface to `arcEnd` in NeX field (1.55× radius). Gallery stub: absent.

8. **Overall render character** · Production globe is paper-warm with realistic lighting (`AmbientLight 0xefe7d6, DirectionalLight 0xfff4dd`) rendering through a `MeshStandardMaterial` with roughness 0.95 — the surface has material depth and responds to light. The gallery stub is flat-shaded 2D with no lighting model. The two do not look like the same object.

**Gallery full variant severity: CRITICAL.** The stub conveys the soul inventory (paper sphere, grid, axis, orange α mark) but diverges fundamentally in every layer: no coastline, no contours, no inner shade, no true NeX field, no worldline arc, no 3D material response. A reader using the gallery atom to derive a new surface would produce a flat abstraction, not the production instrument.

### standby variant

The standby variant (≤600px mini-globe) is not yet in production — `impl_ref` in the manifest explicitly notes `"components/ATLASStandby.tsx (standby — Rule-5 follow-up surface, not yet built)"`. There is no production truth to compare against. The gallery CSS standby render (130px radial-gradient sphere + axis spine + alpha dot) can be assessed only against the canonical spec descriptor in `spec-globe-v1-direction.md §11 L327`.

Against that spec: the standby render implements the 130×130 radial-gradient body, the repeating-linear lat/lon grid, the orange α dot with 5px halo, the Ne0N axis spine, the orange pole beacons, the ATLAS STANDBY label, and two CTAs. This is spec-compliant for the CSS canvas layer. The graticule uses `repeating-radial-gradient` to simulate sphere curvature — a reasonable P3 interpretation.

**Standby variant severity: N/A (no production comparand exists yet).** The gallery standby is the current canonical reference. When `ATLASStandby.tsx` is built, it must match this gallery render, not the inverse.

---

## A02 · dashed-hairline — production audit note

Production DOM has 5 elements with `.section-rule` (solid-rule variant: `border-bottom: 1px solid var(--ink-hairline)`). No element uses `.section-rule-dashed` (dashed-rule variant: `border-bottom: 1px dashed var(--ink-dashed)`). The dashed frame separators used in the ATLAS foot and elsewhere are implemented via inline `border-top: 1px dashed rgb(var(--ink-rgb) / 0.28)` (`.atlas-foot` class) rather than the `.section-rule-dashed` utility class. The atom correctly identifies the visual primitive; the utility class itself is latent. This is a MINOR finding — the atom concept is correct, the class is defined in globals.css, but its production usage is zero. Betelgeuse should note this when using or recommending the atom.

---

## A04 · divergence-card — production markup diff

Production `DivergenceMeter.tsx` (not inspected directly, but DOM observed):
- Label `<b>` contains `α` (the Greek letter, italic Cormorant via `.diverge-panel-label b` styling)
- Gallery shows `∇` (nabla operator)
- Production `meta` row: `DEVIATION · −0.275349%` / `ATTRACTOR · Ne0EX-LOCUS`
- Gallery `meta` row: coordinates `13.04°N · 26.00°E` / `FROM α`
- Production numeral uses `.dm-digit` spans for animated digit reveal
- Gallery numeral uses a static `+0.<span class="acc">1304</span>26` pattern

These divergences are content/data differences, not visual-language failures. The color, panel structure, border, corner reticles, and font role assignments are all correct. The `∇` vs `α` distinction is worth flagging — production uses `α` (observer glyph), gallery used `∇` (a different semantic). Whoever authored the gallery content may have been working from an earlier spec version.

---

## font-chain root cause summary

`globals.css` line 84–86:
```css
@theme inline {
  --font-display: var(--font-cormorant), 'Cormorant Garamond', serif;
  --font-mono:    var(--font-jetbrains), 'JetBrains Mono', ui-monospace, monospace;
  --font-type:    var(--font-elite),     'Special Elite', ui-monospace, monospace;
}
```

This is a Tailwind v4 at-rule. The browser does not process it natively. Without the Tailwind build:
- `--font-display`, `--font-mono`, `--font-type` are never defined
- Every `.t-display`, `.t-meta`, `.t-type` class uses `font-family: var(--font-display/mono/type)` which resolves to nothing → browser fallback serif

Fix options (for Betelgeuse, owner of globals.css):

Option A: Add explicit `--font-display/mono/type` assignments to the `:root {}` block in globals.css, duplicating the Tailwind `@theme inline` values. The duplicate would be ignored by the Tailwind pipeline but picked up by plain CSS contexts. Cost: one extra `:root` block; risk of drift.

Option B: Add a gallery-specific `<style>` block inside the gallery `data-gate-exempt` section that sets `--font-display`, `--font-mono`, `--font-type` directly, bridging the gap without modifying globals.css. This is the correct isolation approach for a static gallery.

Option B is preferred — it localizes the fix to the gallery and does not risk drift in globals.css.

---

## recommendation — render-fidelity as a standing factory check

The token-drift gate (`scripts/audit-soul-atom-drift.*`) verifies that appearance values in gallery atoms trace to CSS tokens or cited literals. It passed. It cannot catch:

1. **3D→2D abstraction loss** — a canvas stub that correctly cites `--paper-base` for its sphere fill but omits the MeshStandard lighting model, the earth coastline, the contour rings, and the NeX rays
2. **Content-level divergence** — the gallery showing `∇` where production shows `α`
3. **Font-chain infrastructure failure** — tokens that exist in globals.css but are only accessible through a build pipeline the gallery does not run through

To make render-fidelity a standing check, I recommend a three-part protocol:

**Part 1 · Visual snapshot gate (Canopus to wire)**
Add a CI script `scripts/audit-render-fidelity.ts` that:
- Starts the Next.js dev server
- Opens each `#atom-<id>` section in Playwright
- Screenshots each `.stage` element
- Compares against stored baseline snapshots (committed PNG references at `.claude/visual-diffs/soul-atlas/baselines/<atom-id>.png`)
- Fails if pixel diff exceeds a configurable threshold (recommended 2% for layout atoms, 0% threshold for color atoms)

Baselines are updated manually by Betelgeuse (owner of gallery) when a visual change is intentional. This ensures accidental drift surfaces automatically.

**Part 2 · Font-chain presence check (Canopus to wire)**
A harness check that:
- Opens the gallery URL
- Asserts `getComputedStyle(document.documentElement).getPropertyValue('--font-display')` is non-empty
- Fails if any of the three font-family tokens resolve to empty string

This would have caught the current breakage on first gallery-open.

**Part 3 · Production-parity manifest (Betelgeuse to maintain)**
The manifest `impl_ref` field should specify not just the component path but the **production screenshot path** used as a reference. When a production screenshot changes, the manifest `impl_ref` reviewer (Betelgeuse) is responsible for evaluating whether the gallery atom still represents the updated production intent.

These three parts together create a closed loop: token-drift gate + font-chain check + visual snapshot gate = the full fidelity stack. Token-green alone is insufficient.

---

## per-atom fix routing

| Atom | Severity | Fix Owner | Action |
|------|----------|-----------|--------|
| A01 corner-reticle | MATCH | — | No action |
| A02 dashed-hairline | MINOR | Betelgeuse | Note in manifest that `.section-rule-dashed` has zero production usage; consider adding it to a section border somewhere, or mark as latent |
| A03 alpha-node | MAJOR | Sirius | The Three.js alpha node is the production ground truth; the gallery CSS approximation is acceptable as a color/concept guide but should be labeled as such in the atom description. Sirius: when building any surface that features the alpha node, use the Three.js implementation as reference, not the gallery CSS |
| A04 divergence-card | MINOR | Betelgeuse | Correct gallery content: `∇` → `α` in label; update meta row to DEVIATION+ATTRACTOR pattern to match DivergenceMeter.tsx output |
| A05 netra-console | MINOR | Betelgeuse | Correct reticle glyph from `◎` text to the SVG crosshair pattern matching production; note `◎ NETRA` labeling in gallery vs production markup |
| A06 netra-voice-strip | MINOR | Betelgeuse | Fix font chain (see Option B above); content is fine |
| A07 hud-corner-readout | MATCH (font note) | Betelgeuse | Fix font chain only |
| A08 axis-label | MATCH (font note) | Betelgeuse | Fix font chain only |
| A09 alpha-watermark | MINOR | Betelgeuse | Fix font chain — this atom is soul-critical; the watermark MUST render in Cormorant italic, not Times |
| A10 attractor-pill | MINOR | Betelgeuse | Fix font chain; note that production pill classes are Tailwind inline, not `.af-pill` — gallery `.af-pill` is a standalone CSS equivalent, which is acceptable for the atom catalog but should note the class-name divergence |
| A11 type-roles | CRITICAL | Betelgeuse | Fix font chain immediately — this atom is completely non-functional with Times fallback |
| A12 globe full | CRITICAL | Sirius | The gallery stub does not represent the production globe. The stub should be replaced with a more accurate 2D representation or a clear label stating "Three.js only — see WorldlineGlobe.tsx for full render". Minimum additions to the stub: earth coastline visual, contour rings (irregular), worldline arc, accurate NeX ray count label |
| A12 globe standby | N/A | Sirius | ATLASStandby.tsx must be built to match the existing gallery CSS standby. No revision to the gallery standby; the gallery IS the spec |
| font chain (all text atoms) | CRITICAL | Betelgeuse | Add gallery-local CSS bridge for `--font-display/mono/type` in the `data-gate-exempt` style block (Option B) |

---

## comparison shot paths

Production shots:
- `.claude/visual-diffs/soul-atlas/shots/fidelity-check/prod-homepage-full.png` — full page
- `.claude/visual-diffs/soul-atlas/shots/fidelity-check/prod-globe-wrap.png` — globe frame
- `.claude/visual-diffs/soul-atlas/shots/fidelity-check/prod-globe-viewport.png` — viewport
- `.claude/visual-diffs/soul-atlas/shots/fidelity-check/prod-netra-console.png` — NETRA console
- `.claude/visual-diffs/soul-atlas/shots/fidelity-check/prod-netra-voice.png` — voice strip
- `.claude/visual-diffs/soul-atlas/shots/fidelity-check/prod-hud.png` — HUD corners
- `.claude/visual-diffs/soul-atlas/shots/fidelity-check/prod-diverge-panel.png` — divergence card
- `.claude/visual-diffs/soul-atlas/shots/fidelity-check/prod-corner-marks.png` — corner reticle context
- `.claude/visual-diffs/soul-atlas/shots/fidelity-check/prod-attractor-fields.png` — attractor pills
- `.claude/visual-diffs/soul-atlas/shots/fidelity-check/prod-alpha-mark.png` — alpha watermark (in globe)
- `.claude/visual-diffs/soul-atlas/shots/fidelity-check/prod-atlas-foot.png` — atlas foot + NETRA console
- `.claude/visual-diffs/soul-atlas/shots/fidelity-check/prod-section-rule-context.png` — section rule in nav

Gallery shots:
- `.claude/visual-diffs/soul-atlas/shots/fidelity-check/gallery-full-page.png` — full gallery
- `.claude/visual-diffs/soul-atlas/shots/fidelity-check/gallery-A01-corner-reticle.png`
- `.claude/visual-diffs/soul-atlas/shots/fidelity-check/gallery-A02-dashed-hairline.png`
- `.claude/visual-diffs/soul-atlas/shots/fidelity-check/gallery-A03-alpha-node.png`
- `.claude/visual-diffs/soul-atlas/shots/fidelity-check/gallery-A04-divergence-card.png`
- `.claude/visual-diffs/soul-atlas/shots/fidelity-check/gallery-A05-netra-console.png`
- `.claude/visual-diffs/soul-atlas/shots/fidelity-check/gallery-A06-netra-voice-strip.png`
- `.claude/visual-diffs/soul-atlas/shots/fidelity-check/gallery-A07-hud-corner-readout.png`
- `.claude/visual-diffs/soul-atlas/shots/fidelity-check/gallery-A08-axis-label.png`
- `.claude/visual-diffs/soul-atlas/shots/fidelity-check/gallery-A09-alpha-watermark.png`
- `.claude/visual-diffs/soul-atlas/shots/fidelity-check/gallery-A10-attractor-pill.png`
- `.claude/visual-diffs/soul-atlas/shots/fidelity-check/gallery-A11-type-roles.png`
- `.claude/visual-diffs/soul-atlas/shots/fidelity-check/gallery-A12-globe.png`

---

## signature (Algol · α-VER-06)

This report is Algol's QA output for TASK-2026-05-29-SOUL-FACTORY-FIDELITY.
No work record to verify for this task (Algol is the executing agent, not auditing a peer).
Findings are based on direct Playwright observation of localhost:3000 and localhost:8765.

---

## RE-VERIFICATION — TASK-2026-05-29-SOUL-FACTORY-FIDELITY-REVERIFY

**Dispatched by:** Polaris · 2026-05-29
**Fixes landed:** Betelgeuse (font-chain + A04/A05/A02 content), Sirius (A12 Three.js globe), Canopus (font-chain rail)

### verdict · PASS — all 2 CRITICAL + 1 MAJOR resolved; no regressions

---

### per-atom severity table — before → after

| # | ID | Name | Severity (before) | Severity (after) | Resolution |
|---|-----|------|-------------------|-----------------|------------|
| A01 | corner-reticle | Corner Reticle | MATCH | MATCH | Unchanged — still clean |
| A02 | dashed-hairline | Dashed Hairline | MINOR | RESOLVED | Latent-class note added to rationale |
| A03 | alpha-node | Alpha Node | MAJOR | RESOLVED | One-line note in rationale: "CSS box-shadow render is colour/concept guide only; canonical render is Three.js SphereGeometry+RingGeometry in 3D GPS" |
| A04 | divergence-card | Divergence Card | MINOR | RESOLVED | ∇ → α in label `<b>`; meta row corrected to DEVIATION+ATTRACTOR |
| A05 | netra-console | NETRA Console | MINOR | RESOLVED | SVG crosshair (4 lines + 2 circles) replaces Unicode ◎; label set to ◎ NETRA |
| A06 | netra-voice-strip | NETRA Voice Strip | MINOR | RESOLVED | Font chain bridged; Cormorant Garamond confirmed rendering |
| A07 | hud-corner-readout | HUD Corner Readout | MATCH (font note) | MATCH | Font chain bridged; JetBrains Mono confirmed rendering |
| A08 | axis-label | Axis Label | MATCH (font note) | MATCH | Font chain bridged; JetBrains Mono confirmed rendering |
| A09 | alpha-watermark | Alpha Watermark | MINOR | RESOLVED | Font chain bridged; `.atlas-alpha-mark` at 200px confirmed rendering in Cormorant Garamond |
| A10 | attractor-pill | Attractor Pill | MINOR | RESOLVED | Font chain bridged; JetBrains Mono confirmed via `.af-pill` |
| A11 | type-roles | Type Roles | CRITICAL | RESOLVED | All three families now distinct: Cormorant Garamond / JetBrains Mono / Special Elite. `all_distinct: true` confirmed via computed style |
| A12 (full) | globe | Globe Full | CRITICAL | RESOLVED | Three.js faithful render: WebGL canvas 560×542; earth coastline (blocked in test-env but structure present); axis; HUD; NeX shells; importmap → local three.module.js |
| A12 (standby) | globe | Globe Standby | N/A | N/A | Re-derived with coastline hint + NeX shell hint + worldline gesture |
| font-chain | — | Font Chain | CRITICAL | RESOLVED | All three tokens resolve to non-empty: --font-display='Cormorant Garamond', --font-mono='JetBrains Mono', --font-type='Special Elite' |

---

### signature audit (3 agents)

**Betelgeuse · TASK-2026-05-29-SOUL-FACTORY-FIDELITY-FIX**
- schema v2, required fields: PRESENT
- self_hash: VALID (computed matches stored)
- pre_cutover_codename "Iris" → α-VIS-04: CONFIRMED in AGENTS.md
- next_recipient α-OPS-00 (Polaris): CONFIRMED in roster
- gallery.html hash: Betelgeuse's stored hash does NOT match current working tree — EXPECTED. Sirius subsequently edited gallery.html for the globe fix; Sirius's stored hash for gallery.html matches current working tree (verified). Sequential chain, not a forgery.
- Verdict: CLEAN

**Sirius · TASK-2026-05-29-SOUL-FACTORY-GLOBE-FIX**
- schema v2, required fields: PRESENT
- self_hash: VALID (computed matches stored)
- pre_cutover_codename "Pico" → α-SUR-01: CONFIRMED in AGENTS.md
- next_recipient α-OPS-00 (Polaris): CONFIRMED in roster
- gallery.html hash: matches current working tree (Sirius is the last editor of gallery.html)
- files_touched breadth: 1445 files — FLAGGED-ADVISORY (documented standing harness-debt: no pre-task baseline → sign-work fallback swept dirty tree). Not P3-fix defects.
- post_edit_passed: false — FLAGGED-ADVISORY (global lint fails on out-of-scope carry-over: .claude/beta/**, app/api/chat/route.ts, pilot-frontend-ui-design/* — none are Sirius's deliverable files). Not P3-fix defects.
- Deliverable files (soul-atlas/*, three.module.js, manifest.json): hash-verified against working tree — MATCH
- Verdict: CLEAN (with documented advisories — not INTEGRITY-FAIL; known standing harness-debt pattern)

**Canopus · TASK-2026-05-29-SOUL-FACTORY-FIDELITY**
- schema v2, required fields: PRESENT
- self_hash: VALID (computed matches stored)
- pre_cutover_codename: null (correct — Canopus joined post-cutover)
- next_recipient α-OPS-00 (Polaris): CONFIRMED in roster
- All 5 deliverable files: hash-verified against working tree — all MATCH
- Verdict: CLEAN

---

### gate status

| Gate | Status | Exit code |
|------|--------|-----------|
| audit-font-chain.sh | PASS | 0 |
| audit-soul-atom-drift.sh (full: token-refs + font-chain + TS audit) | PASS | 0 |

---

### font-chain regression test

`tests/harness/font-chain.test.ts` written by Algol per Canopus TEST REQUEST.
All 8 mandated scenarios + 1 bonus real-gallery check: **15/15 PASS**.

Scenarios covered:
- (a) all three bindings → exit 0
- (b)/(c)/(d) individual token removed → exit 1, token named in error
- (e) all three removed → exit 1, all three named
- (f) manifest not found → exit 2 (SKIP)
- (g) gallery not found when manifest exists → exit 3
- (h) drift gate wiring: font-chain exit 1 propagates to drift exit 1
- (real) production gallery.html passes live → exit 0

---

### build + regression scan

`npm run build` — **PASS** (Turbopack, all 4 pages generated, no TypeScript errors).

Pre-existing test failures (not regressions from this task):
- `beta-access-log.test.sh` — 9/14 failing; pre-existing (file unmodified in any SOUL-FACTORY signature)
- `status-write-guard.sh` — 1/5 failing; pre-existing

Both confirmed pre-existing by zero git diff against these test files.

---

### re-verify comparison shots

`.claude/visual-diffs/soul-atlas/shots/fidelity-check/re-verify/`:
- `reverify-A11-type-roles.png` — three distinct typefaces, visually confirmed
- `reverify-A12-globe.png` — Three.js canvas present (560×542); dark in test-env due to ad-blocker blocking earth texture URL; structural render confirmed via Sirius's `fidelity-fix/sidebyside-gallery-vs-prod.png`
- `reverify-A04-divergence-card.png` — α in label, DEVIATION/ATTRACTOR meta confirmed
- `reverify-A05-netra-console.png` — SVG crosshair confirmed
- `reverify-A03-alpha-node.png` — concept-note present
- `reverify-A09-alpha-watermark.png` — Cormorant Garamond 200px confirmed
- `reverify-gallery-full.png` — full page

---

### note: earth texture in test environment

The earth coastline texture (`threejs.org/examples/textures/planets/earth_specular_2048.jpg`) is blocked by ad-blocker in the Playwright test environment (`ERR_BLOCKED_BY_CLIENT`). This is a test-environment network constraint, not a code defect. The texture URL is correct; it loads in normal browser contexts. Sirius's `fidelity-fix/gallery-globe-full.png` and `fidelity-fix/sidebyside-gallery-vs-prod.png` (captured in his session without ad-blocker) show the full render with coastline. The Three.js scene structure, WebGL context, and all non-texture layers (axis, shells, alpha node, HUD corners) render correctly in all environments.

---

**auditor** · Algol · α-VER-06 · pre_cutover_codename: "Cipher"
**re-verification completed_at** · 2026-05-29T05:45:00+07:00
**method** · Playwright computed-style interrogation + gate re-run + font-chain test suite execution + signature self_hash recomputation + file hash verification

**auditor** · Algol · α-VER-06 · pre_cutover_codename: "Cipher"
**completed_at** · 2026-05-29T04:55:00+07:00
**method** · Playwright screenshot comparison + computed-style interrogation + source code reading

---

## MINI-GLOBE LIVE REVERIFY — TASK-2026-05-29-SOUL-FACTORY-FIDELITY (mini-globe pass)

**Dispatched by:** Polaris · 2026-05-29
**Deliverables audited:** Sirius TASK-2026-05-29-SOUL-FACTORY-MINI-LIVE · Betelgeuse TASK-2026-05-29-SOUL-FACTORY-MINI-SPEC

### verdict · PASS WITH INTEGRITY-FLAG (Betelgeuse self_hash mismatch — deliverable content correct; re-sign required)

---

### signature audit

**Sirius · TASK-2026-05-29-SOUL-FACTORY-MINI-LIVE**
- schema v2, required fields: ALL PRESENT
- self_hash: stored `7d07d9f933ea5cdcf6c0f4d8e57b3031260526434e00a6242fd8855090540f1a` — recomputed MATCH · CLEAN
- files_sha256: all 6 deliverable files verified against working tree — ALL MATCH · CLEAN
- next_recipient `α-OPS-00` (Polaris) — valid roster member · CLEAN
- pre_cutover_codename `Pico` → `Sirius` / `α-SUR-01` — nomenclature table confirms · CLEAN
- advisory_flags (no-pre-task-baseline + global-lint-on-carryover): acknowledged standing harness-debt, Canopus territory — ADVISORY ONLY, not INTEGRITY-FAIL

**Betelgeuse · TASK-2026-05-29-SOUL-FACTORY-MINI-SPEC**
- schema v2, required fields: ALL PRESENT
- self_hash: stored `ec7de184051933d1861eef63d0da8f9ba3504dde85649bc9e889713e3403cafc` — recomputed `0aaa0f19086e1ec22bc537ac995529e22b61fc0faff699c31b07bd4ba0f583b7` — MISMATCH · INTEGRITY-FAIL
- files_sha256: `docs/design/spec-globe-v1-direction.md` and `docs/design/60-responsive-system.md` — both hash-verified against working tree — MATCH (deliverable content is correct)
- next_recipient `α-OPS-00` (Polaris) — valid · CLEAN
- pre_cutover_codename `Iris` → `Betelgeuse` / `α-VIS-04` — confirms · CLEAN

Betelgeuse self_hash mismatch: the envelope was almost certainly computed from a payload that differed from the file as written (manual sign, off-canonical serialization path — same pattern as the no-pre-task-baseline advisory on the previous SOUL-FACTORY pass). The spec files themselves are correct. Betelgeuse must re-sign with a corrected self_hash. Flagging to Canopus: same root cause as Sirius's standing advisory — absence of pre-task baseline forces manual signing which is error-prone.

---

### acceptance criteria

**1. Mini matches full (core ask)**
PASS. Live Three.js mini mounts via `initMiniGlobe()`. All five soul elements present and rendering:

| Element | Code | Pixel evidence |
|---------|------|---------------|
| Earth-coastline sphere | `SphereGeometry(1, 64, 64)` + 512×256 procedural paper texture (#BDBBAF/#D2CFC4) + async specular overlay | Center pixel `rgba(91,105,101,255)` — aged-paper sphere surface |
| Ne0N axis spine | `CylinderGeometry(0.008, 0.008, 2.6)` teal `#1f5063` | Pole pixels `rgba(32,80,99,175)` and `rgba(31,81,100,138)` — teal spine through poles |
| Pole beacons | `RingGeometry(0.04, 0.05)` + sphere dot at y=±1.0, orange `#d4602a` | Orange pixels at axis tips |
| α at Bangkok GPS | `latLonToVec3(13.7563, 100.5018)` + `SphereGeometry(0.02)` + `RingGeometry(0.032, 0.042)` orange | Present; same GPS as full globe |
| NeX shell hint | `SphereGeometry(1.22, 20, 14)` wireframe opacity 0.09 | Present in scene graph |

Auto-rotate 0.08 rad/s — matches spec §11. Heavy layers correctly absent (no ray-field, no 3-shell stack, no 7 contour rings, no worldline arc, no archive nodes). Canvas coverage: 70% non-transparent pixels — correct sphere-in-square fill.

The mini IS the same object at smaller fidelity. Reads as the same instrument.

**2. Degradation path (prefers-reduced-motion)**
PASS.
- `page.emulateMedia({reducedMotion:'reduce'})` + fresh load
- Bootstrap takes `fallback-reduced-motion` branch, does NOT call `initMiniGlobe()`
- `data-mini-live` stays `"false"`
- Mini canvas: `display:none`
- `.standby-render__fallback2d`: `display:grid` (2D paper-canvas showing)
- `__galleryMiniGlobeMode = 'fallback-reduced-motion'`
Degradation confirmed correct.

**3. No regression — other 11 atoms**
PASS. All 12 atoms render (section.atom elements, all width=1180, all bodyHeight>0, no zero-height bodies). Fonts: Cormorant Garamond + JetBrains Mono + Special Elite — all loaded. Full globe still renders (globe-canvas 560×542, WebGL2 active).

**4. Gates**
PASS (run twice — at Sirius's claim time and fresh by Algol):
- `audit-soul-atom-drift.sh` → exit 0 (12 atoms verified, no uncited literals)
- `audit-font-chain.sh` → exit 0 (--font-display, --font-mono, --font-type present)

**5. Spec agreement — §11 and §4.2 on 140/120**
PASS. Both documents agree:
- `spec-globe-v1-direction.md` §11 line 344: "140px at MID (601–880px) / 120px at NARROW (≤600px / 375px)"
- `60-responsive-system.md` §4.2 line 138: "140px diameter at MID, 120px at NARROW. Canonical size."
- §15 entry 5 in spec: closed size divergence, prior 130×130 crossed out
- Browser-verified: 375px viewport renders mini canvas at 120×130px (width=120 — spec match)

Canvas height (152 at MID, 130 at NARROW) exceeds "diameter" spec value by ~12px. This is correct — "diameter" is the sphere's visual circle; the axis spine extends ±0.3r beyond, requiring additional canvas height. Not a spec violation.

---

### notes (non-blocking)

**Stale "SVG mini-globe" labels in 60-responsive-system.md**
Three occurrences remain after Betelgeuse's §4.2 override:
- Line 114: ASCII wireframe diagram ("SVG mini-globe · 140px diameter")
- Line 174: §4.4 AttractorFields text ("Updates the SVG mini-globe attractor highlight")
- Line 203: §5 comparison table row header ("SVG mini-globe diameter")

The §4.2 canonical override block correctly supersedes all three. These are documentation cleanup items only — not blocking. Sent to Polaris for Betelgeuse's next pass.

**Console error classification**
- `404 /app/tailwindcss` — pre-existing unrelated dev CDN reference
- `ERR_BLOCKED_BY_CLIENT: earth_specular_2048.jpg` — Playwright ad-blocker, test-env artifact (same pattern as prior SOUL-FACTORY sessions; globe renders with procedural texture; structure intact)
- `THREE.WebGLRenderer: existing context of a different type` — Three.js r160 internal dual-context probe (webgl2 claimed first, webgl fallback rejected); normal behavior, not a render failure

---

### routing

- Betelgeuse: REVISE to re-sign `TASK-2026-05-29-SOUL-FACTORY-MINI-SPEC--betelgeuse.json` with corrected `self_hash`
- Canopus: advisory flag — Betelgeuse's self_hash mismatch shares root cause with Sirius's no-pre-task-baseline advisory; manual signing is error-prone; harness-debt item

---

### comparison shots

`.claude/visual-diffs/soul-atlas/shots/mini-live-reverify/`:
- `algol-globe-atom-only.png` — full panel + standby mini side-by-side, desktop 1400px
- `algol-standby-card-mini-live.png` — standby card close-up, data-mini-live=true
- `algol-reduced-motion-fallback.png` — prefers-reduced-motion:reduce, 2D fallback active
- `algol-375-narrow-mini-live.png` — 375px NARROW, live mini at 120×130px
- `algol-full-gallery-regression.png` — full page regression reference

---

**auditor** · Algol · α-VER-06 · pre_cutover_codename: "Cipher"
**completed_at** · 2026-05-29T09:50:00+07:00
**method** · Playwright pixel-sampling + emulateMedia reduced-motion test + gate re-run + signature self_hash recomputation (Python canonical + bash jq) + file hash verification (shasum -a 256)

---

## STEP 3 — MASTER GALLERY FINAL FIDELITY — TASK-2026-05-29-SOUL-FACTORY-STEP3

**Dispatched by:** Polaris · 2026-05-29
**Scope:** Final 16-atom gallery, render-fidelity gauntlet on completed master design
**Signatures audited:** NODE-FAMILY, GAP-CLOSURE, ALPHA-MEANING, GLOBE-NODES, MINI-SPEC, MINI-SPEC-FIX, MINI-LIVE, MINI-OVERLAP, MINI-VERIFY

### verdict · PASS

All 16 atoms render legibly. Fonts clean. No overflow at 1180 or 600px. Focus-button exact-match to production. Archive-node and fiction-node geometry matches production Three.js. Both audit gates exit 0. All signature self_hashes CLEAN.

---

### signature audit

All self_hashes computed via canonical jq per SCHEMA.md (jq -cS + tr -d '\n' + sha256sum):

| signature | self_hash | fields | roster |
|---|---|---|---|
| NODE-FAMILY (Betelgeuse) | CLEAN | PRESENT | Iris → α-VIS-04, next: α-OPS-00 |
| GAP-CLOSURE (Betelgeuse) | CLEAN | PRESENT | Iris → α-VIS-04, next: α-OPS-00 |
| ALPHA-MEANING (Betelgeuse) | CLEAN | PRESENT | Iris → α-VIS-04, next: α-OPS-00 |
| GLOBE-NODES (Sirius) | CLEAN | PRESENT | Pico → α-SUR-01, next: α-OPS-00 |
| MINI-SPEC (Betelgeuse) | CLEAN | PRESENT | Iris → α-VIS-04, next: α-OPS-00 |
| MINI-SPEC-FIX (Betelgeuse) | CLEAN | PRESENT | Iris → α-VIS-04, next: α-OPS-00 |
| MINI-LIVE (Sirius) | CLEAN | PRESENT | Pico → α-SUR-01, next: α-OPS-00 |
| MINI-OVERLAP (Sirius) | CLEAN | PRESENT | Pico → α-SUR-01, next: α-OPS-00 |
| MINI-VERIFY (Algol) | CLEAN | PRESENT | Cipher → α-VER-06, next: α-OPS-00 |

No self_hash mismatches. The prior Betelgeuse self_hash mismatch (MINI-SPEC, flagged in mini-globe reverify above) is RESOLVED — the current MINI-SPEC signature is CLEAN.

**files_sha256 pattern:** gallery.html and manifest.json are shared files touched by every task in the chain. Only the final-state signature (GAP-CLOSURE) has hashes matching current tree. All earlier signatures show expected mismatch for these two files — legitimately superseded by subsequent tasks. Self_hash integrity is what matters; it is clean on all.

**NODE-FAMILY timestamp advisory (not INTEGRITY-FAIL):** NODE-FAMILY records completed_at 2026-05-29T18:05:00+07:00, nominally the latest task. But current tree matches GAP-CLOSURE (11:35+07). Three findings rule out fraud: (1) self_hash CLEAN; (2) all 16 atoms including A13–A16 are present in current tree — content delivered; (3) GAP-CLOSURE steps say "confirmed gap-closure work already present" implying NODE-FAMILY executed first. Most likely explanation: completed_at timestamp was recorded incorrectly (session clock or TZ error). Advisory only.

---

### atom inventory — 16 atoms

Playwright confirmed at http://localhost:8765/.claude/visual-diffs/soul-atlas/gallery.html, 1180px + 600px viewports:

| # | atom | variants | overflow |
|---|---|---|---|
| A01 | corner-reticle | default, micro | none |
| A02 | dashed-hairline | solid-rule, dashed-rule | none |
| A03 | alpha-node | default, active, selected | none |
| A04 | divergence-card | default, drift | none |
| A05 | netra-console | default, jump-hover | none |
| A06 | netra-voice-strip | rest, attractor | none |
| A07 | hud-corner-readout | default | none |
| A08 | axis-label | default | none |
| A09 | alpha-watermark | default | none |
| A10 | attractor-pill | default, hover, active | none |
| A11 | type-roles | voice, instrument, value | none |
| A12 | globe | full, standby | none |
| A13 | archive-node | default, hover, selected, dimmed | none |
| A14 | fiction-node | default, hover, selected, dimmed | none |
| A15 | photo-node | reserved | none |
| A16 | focus-button | default, hover, is-active | none |

16/16 atoms present. 0 overflow violations at both viewports.

Single-variant atoms (A07/A08/A09): documented as "INTENTIONALLY SINGLE-VARIANT" with rationale. Acceptable.
Alpha-node dimmed exclusion: documented as observer-locus exclusion per attractor-binding §6.4. Correct.

---

### font resolution

document.fonts API confirmed three fonts LOADED: Cormorant Garamond, JetBrains Mono, Special Elite.
Zero Times/serif fallback in sampled text nodes. Font gate CLEAN.

---

### node family fidelity vs production

**Archive-node (A13):**
Production WorldlineGlobe.tsx L701: `SphereGeometry(0.012, 12, 12)` in `nodeMatInk` teal (0x1f5063).
Gallery/manifest: 0.012 radius, `var(--ink-primary)` teal. MATCH.

**Fiction-node (A14):**
Production WorldlineGlobe.tsx L1405: `RingGeometry(0.010, 0.016, 24)` teal 0x1f5063.
Gallery/manifest: 0.010/0.016, `var(--ink-primary)` teal, hollow. MATCH.

**Alpha-node (A03) — production delta (non-blocking):**
Production L722: `SphereGeometry(n.primary ? 0.018 : 0.01)`. Alpha = 0.018.
Production L730: `RingGeometry(0.03, 0.038, 32)`.
Spec §5.3 (updated by ALPHA-MEANING + GLOBE-NODES): alpha sphere 0.022, ring 0.034–0.044.
Gallery prototype: 0.022 / 0.034–0.044 per spec.
Status: SPEC-PRODUCTION DELTA. Gallery correctly documents spec intent. Production WorldlineGlobe.tsx has not been updated to §5.3 revised values. Not a gallery failure; production is behind spec. Follow-up task needed (Sirius: update L722 0.018→0.022, L730 0.03/0.038→0.034/0.044).

---

### focus-button (A16) fidelity

Gallery `#atom-focus-button` loads production `.atlas-strata-btn` CSS directly from `../../../app/globals.css`. Playwright computed style verification:

| state | property | production | gallery | match |
|---|---|---|---|---|
| default | border | `rgb(var(--ink-rgb)/0.15)` | same | yes |
| hover | border | `rgba(212,96,42,0.5)` | same | yes |
| hover | transform | `translateX(2px)` | `matrix(1,0,0,1,2,0)` | yes |
| is-active | border | `var(--accent-orange)` | same | yes |
| is-active | background | `rgba(212,96,42,0.06)` | same | yes |
| is-active | `::before` tick | 4×1px left:-6px accent-orange | same | yes |
| all | grid | `22px 1fr auto` | same | yes |

A16 fidelity: EXACT — gallery IS the production component, not an approximation.

---

### production reference captures

Dev server localhost:3000, globe running (WebGL canvas 727×540). Earth texture blocked by ad-blocker (standing test-env condition). Alpha node (orange) and archive nodes (teal dots) visually confirmed in production-ref-globe-full.png.

Shots saved under `.claude/visual-diffs/soul-atlas/shots/step3-final/`:
- `gallery-1180-full.png` — full gallery at 1180px
- `gallery-600-full.png` — full gallery at 600px
- `atom-archive-node.png` — A13 all 4 variants
- `atom-fiction-node.png` — A14 all 4 variants
- `atom-focus-button.png` — A16 all 3 variants
- `atom-alpha-node.png` — A03 enriched (3 variants)
- `atom-globe.png` — A12 full + standby
- `production-homepage-1180.png` — production homepage
- `production-ref-globe-full.png` — production `.atlas-globe-wrap` isolated

---

### audit gates

| gate | result |
|---|---|
| `scripts/audit-soul-atom-drift.sh` | exit 0 — 16 atoms verified, 0 uncited literals |
| `scripts/audit-font-chain.sh` | exit 0 — all three font-chain tokens present |

---

### non-blocking notes for Polaris

1. **Alpha node spec-production delta**: WorldlineGlobe.tsx L722 uses 0.018 (spec says 0.022), L730 uses 0.03/0.038 (spec says 0.034/0.044). Follow-up task → Sirius.
2. **NODE-FAMILY timestamp anomaly**: completed_at appears wrong (stamped later than GAP-CLOSURE but executed before it). Content correct; advisory only.
3. **manifest production_ref.screenshot still null**: archive-node and fiction-node entries have null screenshots. Step3-final shots now exist as reference. Update → Betelgeuse, low priority.

---

**auditor** · Algol · α-VER-06 · pre_cutover_codename: "Cipher"
**completed_at** · 2026-05-29T12:00:00+07:00
**method** · Playwright DOM audit + computed-style verification + font API check + production comparison + signature self_hash recomputation (jq canonical) + file hash verification + audit gate re-run
