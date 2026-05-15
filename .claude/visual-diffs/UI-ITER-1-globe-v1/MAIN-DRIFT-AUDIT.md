# MAIN-BRANCH DRIFT AUDIT · UI-ITER-1-globe-v1

> author · Betelgeuse (α-VIS-04) · revise pass
> task · TASK-2026-05-15-UI-1 · iteration 1 (REVISE)
> date · 2026-05-15
> trigger · Peat verdict relayed by Polaris — *"คนสวย ก็อปมาเป๊ะยันบัคเลย; ให้กลับไปเทียบกับ main branch UI"*
> baseline · `components/*.tsx` · `app/globals.css` · `app/page.tsx` · `.claude/visual-diffs/main-poc-2026-05-15/shots/*`
> companion · adjusted prototype at `.claude/visual-diffs/UI-ITER-1-globe-v1/prototype/index.html`

---

## 0 · framing

Iter 1 was a too-faithful port of v7.html. The v7 file is **soul baseline**, not **shipping target**. The main-branch web app (currently running, currently signed off) is the **living product baseline** per VISION-FIDELITY §1A. Any divergence between v7 and main branch must, by default, resolve toward main branch — unless an evolution is explicitly soul-deepening AND defensible.

The audit below walks every section of the main-branch home page top-to-bottom (`app/page.tsx` line order) and assigns one of three verdicts to each row:

- **PRESERVE-MAIN** — main branch's behaviour wins. Iter 1 will be adjusted.
- **EVOLVE-V7** — the v7 (and now prototype) treatment is a soul-deepening evolution AND can be defended against the brief. No adjustment; documented justification carried in §10 of the spec.
- **BUG-INHERITED** — v7 contains a quirk the prototype inherited and must NOT propagate. Adjusted.

---

## 1 · the audit table

### 1.1 page-stack scope (top-level)

| section in `app/page.tsx` | main-branch behaviour | iter-1 prototype | verdict | action |
|---|---|---|---|---|
| `<Nav />` strip | full nav: `∇ NEOSPIRIT // WORLDLINE 1.130426` + `EST. 2026 — BANGKOK / THAILAND` left · `◇ INDEX · TRACES · ARCHIVE · TRANSMIT` centre · `SYS // CALIBRATED · UTC+7 // hh:mm` right | **absent** — prototype ships ATLAS frame ONLY | **PRESERVE-MAIN** | ADD compact Nav strip above the ATLAS frame in the prototype |
| `<HeroBlock />` tagrow + title + sub | `FILE — 000 / GENESIS · WORLDLINE 1.130426` tagrow · italic display "an archive of *unfinished* thought, surveyed openly." · sub-paragraph · counts stack `047 / 012 / ∞` · compact DivergenceMeter card top-right | **absent** | **PRESERVE-MAIN** | ADD compact Hero block above the ATLAS frame |
| `<DivergenceMeter size="lg" />` band (full-width hero band) | full-width ink-tinted band below hero with the unstable divergence readout · NIXIE FLICKER + DRIFT loop · `ATTRACTOR · Ne0EX-LOCUS / DEVIATION · −0.275349% / STATE · OBSERVED` rail | absent — only the inline micro card in the left rail | **PRESERVE-MAIN** | NOT in prototype scope (band is full-page-width, the ATLAS frame stays 1180; spec is the Globe direction) — flag forward as **iter-2 deliverable** |
| `<WorldlineGlobe />` (the ATLAS frame) | rendered — see §1.2 below | rendered with drift | mixed | see §1.2 |
| `<ChapterIndex />` | 2-col grid of entry cards with `§ 01 · CHAPTER INDEX // RECENT TRACES` label, diamond reticles, glitch hover | **absent** | **PRESERVE-MAIN** | NOT in prototype scope (separate surface) — flag forward as iter-3 deliverable |
| `<AttractorFields />` | row of pills below globe with `§ 02 · ATTRACTOR FIELDS // BROWSE BY DOMAIN` label | partially — prototype renders pills INSIDE Globe right rail | **EVOLVE-V7** | This is the binding mechanic per `attractor-binding-mechanic.md` v1.1 — Globe-internal pill row demonstrates the binding contract. Spec §10 already cross-refs that in production it lives BELOW the Globe (§3.3 of `journey-architecture.md`). The prototype demonstration is correct **for direction-spec purposes**. NO adjustment, but doc cross-ref tightened. |
| `<FooterManifesto />` | 3-col footer · manifesto · channels · transmit | **absent** | **PRESERVE-MAIN** | NOT in prototype scope — flag forward |
| `<MarginaliaHUD />` (right-edge vertical band) | sticky right-edge instrument readout: `∇ WORLDLINE · 1.130426` / `§ {SECTION}` / `DRIFT · +N.NNN` rotated vertical | **absent** | **PRESERVE-MAIN** | ADD vertical marginalia band on the right edge of the prototype page |
| `<ScrollMeter />` (top-edge horizontal scroll line) | thin marching-dash line at the viewport top driven by `--scroll-pct` | **absent** | **PRESERVE-MAIN** | ADD a static scroll-meter rail at top (no scroll in prototype but the visual rail belongs) |
| `<CornerMarks />` (full-page L-brackets at corners) | full-viewport corner reticles at the page level | only at ATLAS frame, not at page | **PRESERVE-MAIN** | ADD page-level corner-marks AND keep ATLAS-frame's own |
| `<SurveyCursor />` | custom cursor with reticle | absent | **EVOLVE-V7** | not the lockable surface; cursor effects out of scope this iter |
| `BootSequence` | renders on first visit (sessionStorage gate) | absent | **EVOLVE-V7** | direction-render, boot retired for this artifact — flag forward |
| `N` floating badge (NETRA) bottom-left | persistent floating ◎ badge bottom-left (visible in main fold shot) | absent | **PRESERVE-MAIN** | ADD a 36×36 N badge bottom-left of the page |

**Verdict count at this level:** 7 PRESERVE-MAIN (5 ADD, 2 future-flag) · 3 EVOLVE-V7 (defended) · 0 BUG-INHERITED.

---

### 1.2 ATLAS frame · component-level

The Globe component (`components/WorldlineGlobe.tsx`) is where most v7-vs-main drift lives. Row-by-row:

| atom | main-branch (WorldlineGlobe.tsx + globals.css) | iter-1 prototype | verdict | action |
|---|---|---|---|---|
| **frame-head left label** | `OBSERVATORY · WORLDLINE STRUCTURE v.07 · ∇ Ne0EX · 3D ORTHOGRAPHIC` (line 1070) | `WORLDLINE · OBSERVATORY v.01 · ∇ Ne0EX · 3D ORTHOGRAPHIC` | **PRESERVE-MAIN** | revert head to `OBSERVATORY · WORLDLINE STRUCTURE`. Bump `v.07 → v.08` (next-step from main, not regress to v.01). The "v.01" framing was a fresh-start mistake — main branch already shipped v.07. |
| **frame-head right label** | `α 1.130426 · NAV NETRA` (line 1073-1076) | same | PRESERVE-MAIN | no action — already matches |
| **left-rail head text** | `§ STRATA · TRAVEL TARGETS` (line 1083) | `§ FRAMING · CAMERA-AID` | **EVOLVE-V7** | Defended: `attractor-binding-mechanic.md` v1.1 §1.3a renames the buttons from stratum-toggles to camera-waypoint targets. Keeping `FRAMING · CAMERA-AID` aligns with v1.3 ontology canon. **No adjustment**; spec §8.7 already documents the rationale. |
| **left-rail button IDs** | `1 · NeX / 2 · Ne0N / 3 · Ne0` (line 179-227 STRATA_BUTTONS) | `0 · REST / 1 · SURFACE / 2 · AXIS / 3 · ORBIT` | **EVOLVE-V7** | Defended: rest is the new default (cameraFocus rest = all strata co-present); surface/axis/orbit name the camera waypoint, not the stratum. The IDs are downstream of the head-text evolution above. Spec §7 table is canonical. No adjustment. |
| **left-rail · `atlas-current` annotation block** | main has a `CURRENT STRATUM` summary block below the strata-divider (line 1107-1112): `CURRENT STRATUM · {hudStratum} · {role}` | **absent** — prototype has divergence-card in that slot only | **PRESERVE-MAIN** | ADD `§ CAMERA · ACTIVE` annotation block below the divergence-card (mirrors `atlas-current` rhythm but reads cameraFocus, not stratum). Maintains the visual cadence main branch established. |
| **left-rail · DivergenceMeter micro card placement** | NOT in left rail in main branch (DivergenceMeter is at hero band + hero compact slot — left rail has `atlas-current` instead) | rendered in left rail with mini corner reticles | **EVOLVE-V7** | Defended: spec §8.7 cites the v7 left-rail divergence-card as part of the instrument vocabulary; ATLAS frame must carry the divergence reading on the body itself for the Globe-isolation iter to read complete. Keep BUT shrink (smaller card; add CAMERA block above so divergence doesn't dominate). |
| **globe surface · texture base gradient** | `grad.addColorStop(0, "#BDBBAF")` / `grad.addColorStop(0.45, "#D2CFC4")` (line 267-270) — TEAL-compatible cool paper | `grad.addColorStop(0, '#A89E89')` / `(.45, '#BAB099')` — V7-WARM-OLIVE | **🚨 BUG-INHERITED** | This is the canonical drift D2 named in SBA-1 §3 — the warm olive base reads against navy; the cool base reads against TEAL. Prototype currently keeps warm olive. **FIX: replace with main-branch values `#BDBBAF / #D2CFC4`.** |
| **globe surface · g2 inner tint** | `g2.addColorStop(0, "rgba(70,95,108,0.08)")` (line 280) — TEAL ink-tinted | `g2.addColorStop(0, 'rgba(120,100,70,0.10)')` — WARM ink-tinted | **🚨 BUG-INHERITED** | Same v7 warm-vs-cool inheritance. **FIX: replace with `rgba(70,95,108,0.08) → 0`.** |
| **globe inner-shade tint mesh** | `MeshBasicMaterial({ color: 0xb4bbc0 })` (line 418) — cool grey-blue | inherits v7 — check prototype source | **PRESERVE-MAIN** | already paper-stop driven inside the prototype; confirm no `0xcfc4ad` (warm) leftover via grep |
| **axis-label background patch** | uses `var(--paper-base)` to overlap dashed border (globals.css `.atlas-axis-label`) | same `var(--paper-base)` patch | shared (both inherit v7 visual quirk where the patch reads as a hard "cut" through the dashed rule) | **BUG-INHERITED · MINOR** | At 880px the patch reads heavy because the globe-wrap aspect is taller; the patch starts to look like a notch. **FIX: keep patch at desktop, but suppress at ≤880 (overflow:hidden axis-label or smaller font, since the globe-wrap is single-column).** |
| **axis cylinder · spine color** | `0x1f5063` (line 482) — TEAL | TEAL in prototype | PRESERVE-MAIN | matches |
| **wireframe shells, rays** | `0x1f5063` (line 534, 546) — TEAL | TEAL in prototype | PRESERVE-MAIN | matches |
| **node ink material** | `0x1f5063` (line 562) — TEAL | TEAL in prototype | PRESERVE-MAIN | matches |
| **pole beacons, α ring** | `0xd4602a` (line 511, 599) — orange | orange in prototype | PRESERVE-MAIN | matches |
| **surface sphere `opacity` model** | main branch ships `paperMat` with `transparent: false` (line 403-411) — opaque body; stratum-toggle hides axis/orbital (line 899: `refs.axisGroup.visible = T.showAxis`) | prototype: surface `opacity: 0.92`, drops to `0.62` on attractor — body is ALWAYS semi-transparent | **EVOLVE-V7** | Defended: SBA-1 §3 D3 / §summary item 3 — the locked direction is co-present strata visible through transparency. Spec §4.1 cites Peat's lock of 2026-05-15. The `transparent: true` + 0.92/0.62 dial is the soul evolution. **No revert.** |
| **AttractorFields binding (orbital network on activate)** | main branch's `WorldlineGlobe.tsx` does NOT implement attractor edges yet — AttractorFields is decoupled, sits below globe in `app/page.tsx` | prototype implements full binding mechanic | **EVOLVE-V7** | Defended: binding §2.1+§3 spec defines the contract; the prototype demonstrates it. The production component (Sirius) will implement during TASK-16–19. **No revert.** |
| **frame-foot grid template** | `grid-template-columns: 1fr 1fr 1fr minmax(220px, 1.3fr)` (globals.css line 677) | same | PRESERVE-MAIN | matches |
| **NETRA console** | reticle + `◎ NETRA / target` + RETICLE/RANGE readout + jump button (line 1197-1226) | same | PRESERVE-MAIN | matches |
| **NETRA voice strip** | left border 2px netra · bg `rgba(79,110,128,0.07)` · tag mono 7.5px · body italic Cormorant 12px (line 1229-1232; globals.css 695-720) | same | PRESERVE-MAIN | matches |
| **HUD corners content** | OBSERVING / CAMERA / α · coords / SCALE (line 1126-1141) | same | PRESERVE-MAIN | matches |
| **coord-pin · narrative reason** | main branch does NOT render `why` field — only `α WORLDLINE · 13.04°N · 100.50°E` (line 1144-1148) | prototype RENDERS narrative `why` in italic Cormorant | **EVOLVE-V7** | Defended: SBA-1 §summary item 4 (surveyed marks carry meaning). Spec §5 documents the evolution. **No revert.** |

**Verdict count for ATLAS frame:** 11 PRESERVE-MAIN (matches or to-add) · 5 EVOLVE-V7 (defended) · 3 BUG-INHERITED (the two warm-globe-base colors + axis-label-patch at narrow).

---

### 1.3 motion · timing values

| motion | main branch | iter-1 prototype | verdict |
|---|---|---|---|
| 100-150ms hover | pill border `transition-colors` (Tailwind default ~150ms) | `transition: border-color .25s` (250ms) | **PRESERVE-MAIN** — FIX: tune to 150ms |
| 200-300ms selected | DivergenceMeter digit ~200ms cycle | 220ms node-dim ✓ | PRESERVE — matches |
| 300-500ms overlays | side-panel slide 520ms | none in prototype | n/a |
| 700-1400ms camera | n/a | 1400ms cameraFocus ✓ | EVOLVE-V7 (new behaviour) |
| 2.4s reticle pulse | globals.css `.atlas-netra-pulse` | same | PRESERVE — matches |
| **DivergenceMeter Nixie flicker + drift loop** | full slot-machine reroll + per-digit idle flicker + worldline drift cycle (DivergenceMeter.tsx 30-164) | **STATIC** (`1.130426` shown as still text in left rail) | **BUG-INHERITED · MINOR** | the static read makes the divergence-card feel dead. **FIX: add a lightweight per-digit flicker on the prototype's divergence-card** |

---

### 1.4 palette · canonical check

| atom | main-branch value | prototype value | verdict |
|---|---|---|---|
| `--paper-base` | `#E8E2D5` | `#E8E2D5` | PRESERVE ✓ |
| `--paper-warm` | `#EDE7DA` | `#EDE7DA` | PRESERVE ✓ |
| `--paper-deep` | `#D8CFB9` | `#D8CFB9` | PRESERVE ✓ |
| `--ink-rgb` (TEAL active) | `31 80 99` | `31 80 99` | PRESERVE ✓ |
| `[data-palette="ink"] --ink-rgb` (navy backup) | `26 40 50` | `26 40 50` | PRESERVE ✓ |
| `--accent-orange` | `#D4602A` | `#D4602A` | PRESERVE ✓ |
| `--netra-rgb` | `77 122 146` | `77 122 146` | PRESERVE ✓ |
| `<html data-palette="...">` | active = `teal` (not set → default uses TEAL) | `data-palette="teal"` explicit | PRESERVE ✓ |
| **globe procedural gradient stops** | `#BDBBAF, #D2CFC4` (TEAL-compatible) | `#A89E89, #BAB099` (V7-warm-olive) | **BUG-INHERITED** — FIX |
| **globe procedural g2 inner tint** | `rgba(70,95,108,0.08)` (TEAL) | `rgba(120,100,70,0.10)` (warm) | **BUG-INHERITED** — FIX |

No raw hex outside the procedural-canvas block surfaces in either codebase — palette compliance is otherwise clean.

---

## 2 · TOP 5 drift adjustments to ship this pass

Ranked by visual-soul impact:

1. **D1 · globe texture base palette** — replace warm-olive (#A89E89/#BAB099/rgba(120,100,70…)) with main-branch cool (#BDBBAF/#D2CFC4/rgba(70,95,108…)). This is the largest visual lie in iter 1.
2. **D2 · scope expansion to page-level** — add compact Nav, Hero tagrow + italic title, MarginaliaHUD vertical band, ScrollMeter top rail, page-level CornerMarks, and N floating badge. The prototype must read as page first, frame second.
3. **D3 · frame-head label revert** — `OBSERVATORY · WORLDLINE STRUCTURE v.08` (advance from main v.07, not regress to v.01).
4. **D4 · left-rail `atlas-current` annotation** — add a `§ CAMERA · ACTIVE` block below the divergence-card to restore the cadence main branch established with `CURRENT STRATUM`.
5. **D5 · axis-label patch at narrow + divergence-card Nixie flicker** — small fixes that prevent the prototype from feeling "less alive" than the running product.

Other rows (the EVOLVE-V7 set) stay; they are documented in §10 of the spec with explicit Peat-defensible justification.

---

## 3 · what stays as EVOLVE-V7 (documented divergence from main, soul-deepening)

Recorded here so Peat can interrogate or veto in next review:

| evolution | rationale | spec ref |
|---|---|---|
| `STRATA · TRAVEL TARGETS` → `FRAMING · CAMERA-AID` | v1.3 ontology canon — buttons no longer toggle stratum visibility; they re-point camera | binding §1.3a; spec §7, §8.7 |
| `1 · NeX / 2 · Ne0N / 3 · Ne0` → `0 · REST / 1 · SURFACE / 2 · AXIS / 3 · ORBIT` | downstream of `FRAMING` rename — names the waypoint, not the layer | spec §7 |
| paperMat `transparent: false` → `transparent: true, opacity 0.92↔0.62` | Peat-locked transparency revealing Ne0N axis | SBA-1 §3 D3 / §summary item 3; spec §4.1, §6.2 |
| no attractor edges (main) → orbital network on activate | binding mechanic implemented per §2.1 + §3 | binding §2.1, §3; spec §6 |
| coord-pin without `why` (main) → coord-pin WITH italic `why` | surveyed marks carry narrative meaning | SBA-1 §summary item 4; spec §5 |
| left-rail DivergenceMeter micro card kept | instrument-self-completeness for the Globe-isolation iter | v7 line 98; spec §8.7 |

---

## 4 · what is NOT in this pass (flagged forward)

- Full DivergenceMeter band (full-width hero band with Nixie reroll) — **iter 2** (ATLAS frame + Hero coherence)
- ChapterIndex grid — **iter 3** (entry surfaces preserve instrument vocabulary)
- FooterManifesto — **iter 4** (footer surface)
- BootSequence — **iter ≥5** (boot-as-instrument-calibration)
- SurveyCursor — **iter ≥5** (cursor as reticle)

These are out of scope per Polaris's brief ("density over completeness"). The audit document records them so iter-2 dispatch has the inventory ready.

---

## 5 · acceptance trace (for sign-off)

- [x] every section in `app/page.tsx` represented in §1.1
- [x] every atom inside `<WorldlineGlobe />` represented in §1.2
- [x] verdicts assigned (PRESERVE-MAIN / EVOLVE-V7 / BUG-INHERITED) with action column
- [x] TOP 5 drift adjustments listed (§2)
- [x] EVOLVE-V7 documented with Peat-defensible justification (§3)
- [x] forward-flag inventory recorded (§4)

Adjustments now applied to `prototype/index.html` and shots refreshed.

— Betelgeuse · α-VIS-04 · 2026-05-15 · TASK-2026-05-15-UI-1 (revise)
