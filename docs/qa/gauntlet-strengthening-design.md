# Gauntlet-Strengthening Design

**owner** · Algol (α-VER-06)
**date** · 2026-05-30
**task** · TASK-2026-05-30-HARNESS-IS-OUGHT-SEPARATOR Wave B Phase 3a
**status** · SPECIFICATION COMPLETE — Canopus wires per this spec

---

## Context

4 times this session, automated checks passed while Peat's eye caught the real issue:
1. False-green regex (drift scanner 7/12 skip)
2. Token-gate vs render-fidelity (Times fallback)
3. Element-presence vs layer-overlap (2D/3D ::before/::after over canvas)
4. Nodes-present-but-sub-pixel

Pattern: the gauntlet checks presence/values; visual COMPOSITION still needs the human/side-by-side eye. The three checks below convert visual-composition from human-eye-only to mechanized denominators.

Each check is specified with:
- **Predicate definition** (what it asserts)
- **Targeted mutation case** (per A1 acceptance — induces failure ONLY through the path under test; no false-RED-attribution)
- **Structured error format** (Step 7b discipline — parse-able by future audits)
- **Enumerable denominator** (per coverage primitive — the denominator must be finite and known before the run)

---

## Check (a) — Overlap/Composition Check

**Purpose:** assert no element renders over a higher-z sibling unless explicitly allowed via a documented z-context.

**Predicate definition:**
```
for each element E in the visible DOM:
  if computed(z-index(E)) > computed(z-index(sibling S)) AND bounding-rect(E) intersects bounding-rect(S):
    unless E is in the allowed-overlap-manifest AND allowed-overlap-manifest[E].reason != null:
      FAIL
```

The allowed-overlap-manifest is a committed JSON file (`.harness/allowed-overlaps.json`) listing element pairs that are intentionally layered (e.g., `::before`/`::after` pseudo-elements on `.standby-render__globe`). Any overlap not in this manifest = RED.

**Real-world specimen:** Sirius's MINI-OVERLAP case — the 2D fallback's `::before`(sphere+graticule)/`::after`(axis) pseudo-elements on `.standby-render__globe` were not gated by `data-mini-live`, causing them to render over the live canvas. This check would have caught it mechanically.

**Targeted mutation case (false-RED-attribution guard):**
- **What to mutate:** add `position: relative; z-index: 2` to an element that overlaps a sibling, WITHOUT adding it to `allowed-overlaps.json`.
- **Expected RED path:** the check finds the overlap AND the element is absent from the manifest → RED.
- **Red must name:** `[overlap-check] element=<selector> overlaps sibling=<selector> at rect=(x,y,w,h) — not in allowed-overlap-manifest.`
- **The mutation MUST NOT:** modify z-index of an element that is already gated (which would fire a different detection path — false-RED-attribution).
- **Assert:** `before.exit == 0 AND after.exit != 0 AND error message names the intersecting pair and manifest absence`.

**Structured error format:**
```
[A3a] element=<CSS-selector> overlaps sibling=<CSS-selector>
      element_rect=(x, y, w, h) sibling_rect=(x, y, w, h)
      computed_z=<z> sibling_z=<z>
      status=UNLISTED (not in .harness/allowed-overlaps.json)
      action=add to allowed-overlaps with reason, OR fix z-context
```

**Enumerable denominator:**
- The denominator is: all rendered elements with a non-`auto` z-index in the session's visual-diff snapshots.
- Pre-run: enumerate from Playwright's `document.querySelectorAll('[style*="z-index"]')` + CSS-computed z-index scan.
- Assert: `elements_checked == total_z-indexed-elements`. If count mismatches → coverage-assert RED.

**Implementation note for Canopus:** this check requires a running Playwright session (ground-truth, not proxy). It runs as part of the visual-diff gauntlet at the render-fidelity step. The `allowed-overlaps.json` file is the canonical waiver — additions require a signed commit.

---

## Check (b) — Min-Legible-Size Check

**Purpose:** assert text and icon elements render at dimensions ≥ legibility floor per `docs/design/60-responsive-system.md` thresholds.

**Predicate definition:**
```
for each text/icon element E in the visible DOM at viewport V:
  if computed_font_size(E, viewport=V) < LEGIBILITY_FLOOR[V]:
    FAIL
  if computed_bounding_rect(E).height < MIN_HEIGHT[V]:
    FAIL
  if computed_bounding_rect(E).width < MIN_WIDTH[V]:  # for icon-only elements
    FAIL
```

**Legibility floors (from 60-responsive-system.md):**
| viewport name | width | min font (text) | min dimension (icon) |
|---|---|---|---|
| WIDE | ≥1180px | 12px | 16×16px |
| DESK | 881–1179px | 12px | 16×16px |
| MID | 601–880px | 12px | 14×14px |
| NARROW | ≤600px | 11px | 12×12px |

**Cross-reference:** The property technique-map TM-04 derivation (`scripts/audit-property-technique-map.ts`) derives the 12px floor from V1 + 60-responsive-system.md. The Playwright-based check in this gauntlet confirms the rendered size at actual viewport dimensions, not the declared CSS value.

**Targeted mutation case (false-RED-attribution guard):**
- **What to mutate:** add `font-size: 8px` to a specific selector (e.g., `.hud-corner-readout .value`) in a CSS override — an element that is currently PASSING the legibility floor.
- **Expected RED path:** the check measures computed font-size at the target selector → 8px < 12px floor → RED.
- **Red must name:** `[min-legible] element=<selector> viewport=<name> computed_font_size=8px below floor 12px`.
- **The mutation MUST NOT:** reduce the size of an element whose sibling or parent is already failing — that fires the wrong detection path.
- **Assert:** `before.exit == 0 AND after.exit != 0 AND error names element+viewport+computed-size+floor`.

**Structured error format:**
```
[A3b] element=<CSS-selector> viewport=<WIDE|DESK|MID|NARROW> at <width>px
      property=font-size computed=<Npx> floor=<Fpx>
      OR
      property=bounding-rect computed=<W>x<H>px floor=<Fw>x<Fh>px
      action=increase font-size or element dimensions above floor
```

**Enumerable denominator:**
- The denominator is: all text-bearing elements + icon-only elements in the rendered page at each of the 4 breakpoints.
- Pre-run: enumerate from `document.querySelectorAll('[class*="text"], [class*="label"], [class*="icon"], [class*="btn"]')` plus semantic role scan.
- Assert: `elements_checked[viewport] == denominator[viewport]` at each breakpoint. 4 assertions, one per breakpoint.
- Coverage failure (any count mismatch) → audit itself is RED.

**Implementation note for Canopus:** runs at 4 viewport widths: 1200px, 1000px, 720px, 375px. Each generates its own denominator and pass/fail set. Aggregate verdict: all must pass for overall GREEN.

---

## Check (c) — Sub-Pixel / Zero-Size Element Detection

**Purpose:** assert no element renders at sub-pixel or zero dimensions where the manifest claims it is visible.

**Predicate definition:**
```
for each atom A in manifest.atoms:
  for each variant V in A.variants:
    render_rect = playwright_bounding_rect(selector=A.render, viewport=V.viewport)
    if render_rect.width < 1 OR render_rect.height < 1:
      FAIL
    if render_rect.width != floor(render_rect.width) OR render_rect.height != floor(render_rect.height):
      # sub-pixel dimension — potentially invisible due to pixel-rounding
      WARN (escalate to FAIL if dimension < 0.5)
```

**Real-world specimen:** In the GLOBE-NODES slice, the 6 archive nodes were sub-pixel (computed radius ~0.2px at canvas coordinate scale) — Peat's eye caught them as invisible despite the node objects existing in the scene. This check would have caught it as: `manifest claims globe archive-node renders visibly; computed canvas projection < 1px`.

**Targeted mutation case (false-RED-attribution guard):**
- **What to mutate:** in a test fixture, shrink the rendering selector element to `width: 0.3px; height: 0.3px` via an inline style override — targeting one specific atom's render element.
- **Expected RED path:** Playwright measures `bounding_rect.width = 0.3`, which is < 1px → RED.
- **Red must name:** `[sub-pixel] atom=<id> variant=<name> selector=<A.render> computed=0.3x0.3px (sub-pixel/zero — manifest claims visible)`.
- **The mutation MUST NOT:** hide an element that is already absent (a different detection path), or set opacity to 0 (that fires a different check).
- **Assert:** `before.exit == 0 AND after.exit != 0 AND error names atom-id+variant+selector+computed-dimensions`.

**Structured error format:**
```
[A3c] atom=<atom_id> variant=<variant_name> selector=<render_selector>
      viewport=<name>px computed_rect=<W>x<H>px
      status=SUB_PIXEL (W<1 or H<1) | ZERO (W==0 or H==0)
      manifest_claim=visible
      action=fix rendering to produce ≥1x1px bounding rect, or mark variant as intentionally-hidden in manifest
```

**Enumerable denominator:**
- The denominator is: `|manifest.atoms| × |variants_per_atom|` (the Cartesian product of all atom × variant pairs).
- Pre-run: compute total = `sum(len(atom.variants) for atom in manifest.atoms)`.
- Assert: `pairs_checked == total`. If count mismatches → coverage-assert RED.
- Current manifest: 16 atoms × ~22 variants = ~48 pairs (varies by atom). Denominator is bounded and known before the run.

**Implementation note for Canopus:** the manifest's `render` field gives the CSS selector for each atom (e.g., `#atom-corner-reticle`). Each variant may require a state trigger (class addition, interaction) before measurement. The `variants` field's `description` gives the trigger hint — Canopus to parse this or add an explicit `render_trigger` field to the manifest schema in B2.

---

## Enumerable denominators summary

| check | denominator | assert | coverage failure |
|---|---|---|---|
| (a) overlap | all z-indexed elements in snapshot | `elements_checked == N` | audit RED |
| (b) min-legible | text+icon elements at each of 4 breakpoints | `elements_checked[vp] == N[vp]` per breakpoint | audit RED |
| (c) sub-pixel | `sum(|variants|)` across all atoms | `pairs_checked == total` | audit RED |

---

## Mutation discipline summary (per A1 acceptance — no false-RED-attribution)

Each mutation targets ONE specific invariant. The mutation MUST NOT trigger any other detection path. The test asserts:
1. `before.exit == 0` (baseline passes)
2. `after.exit != 0` (mutation fails)
3. `error message names the invariant that fired` (not a different one)

This is the false-RED-attribution guard: a RED from the wrong path masks whether the target invariant is working.

---

## Wiring by Canopus

After Polaris routes these specs to Canopus:
1. Canopus implements checks (a), (b), (c) as Playwright-backed audit scripts
2. Canopus registers them in `.harness/worldline-harness.config.json`
3. Canopus wires them into the standard gauntlet in `docs/harness/RAIL-DEFINITIONS.md`
4. Algol verifies each with the targeted mutation case (machine-checked evidence-in-return)

The `allowed-overlaps.json` for check (a) starts empty; Sirius populates it for MINI-OVERLAP on first wiring.
