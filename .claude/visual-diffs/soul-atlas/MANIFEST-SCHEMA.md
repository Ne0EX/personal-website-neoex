# Soul-atom gallery — manifest schema

> owner · Canopus (α-HRN-07)
> introduced · TASK-2026-05-29-SOUL-FACTORY-P0
> schema_version · 2 (updated TASK-2026-05-29-SOUL-FACTORY-FIDELITY — added production_ref field)
> gate · scripts/audit-soul-atom-drift.sh → scripts/audit-soul-atom-drift.ts (Algol, Phase 2)

---

## Purpose

The soul-atom gallery renders each recurring design primitive exactly once, with its
variants, token bindings, real code pointers, and rationale. New surfaces compose from
these atoms instead of re-deriving them from prose. This manifest is the machine-readable
index that the drift gate reads to verify every appearance value in the gallery traces
back to either a CSS custom property in `app/globals.css` or a cited main-branch literal.

---

## The drift invariant (enforced by the gate)

> Every appearance value (color / size / spacing / timing) that appears in the gallery
> HTML must resolve to a `token_ref` that exists in `app/globals.css` OR a cited
> `main_branch_ref`. Any uncited raw appearance literal is a gate FAIL.

"Appearance value" means: color, background, border-color, opacity, font-size,
letter-spacing, line-height, padding, margin, gap, width, height, border-radius,
transition-duration, animation-duration, z-index.

"Cited" means: the literal and its exact source (file + line) are declared in
`main_branch_refs` inside the manifest entry for this atom. A literal that matches
a `main_branch_ref.value` but is not listed is still uncited — the gate is checking
the manifest, not guessing at provenance.

Three.js numeric color constants (`0xD4602A`) in gallery script blocks are exempt from
the gate — they are runtime canvas values, not CSS appearances, and their palette-
equivalents are documented in the atom's `description` field.

---

## File layout

```
.claude/visual-diffs/soul-atlas/
├── MANIFEST-SCHEMA.md     ← this file
├── manifest.json          ← the machine-readable index (Betelgeuse fills, gate reads)
├── gallery.html           ← the rendered catalog (Betelgeuse authors, Phase 1)
└── README.md              ← Peat-facing orientation
```

The manifest and gallery HTML live together. The gallery references atoms by `id`. The
gate verifies atoms by reading `manifest.json` then scanning `gallery.html` for the
corresponding `data-atom-id` sections.

---

## Schema — `manifest.json`

Top-level shape:

```json
{
  "schema_version": 1,
  "gallery_path": ".claude/visual-diffs/soul-atlas/gallery.html",
  "token_source": "app/globals.css",
  "generated_at": "<ISO-8601>",
  "atoms": [ <atom-entry>, ... ]
}
```

### Atom entry shape

```json
{
  "id": "<kebab-case unique identifier>",
  "name": "<human name>",
  "description": "<one-sentence role in the design system>",
  "rationale": "<why this atom exists — the soul reason, not the CSS reason>",
  "variants": [
    {
      "name": "<variant name>",
      "description": "<what state / fidelity this variant shows>"
    }
  ],
  "token_refs": [
    "<CSS custom property name>"
  ],
  "main_branch_refs": [
    {
      "file": "<repo-relative path>",
      "line": <integer or null>,
      "value": "<verbatim literal exactly as it appears in that file>",
      "role": "<what this literal does in the atom>"
    }
  ],
  "render": "<CSS selector or anchor for this atom's section in gallery.html>",
  "impl_ref": "<repo-relative path to canonical implementation, or null>",
  "production_ref": {
    "component": "<repo-relative path to the production component or route>",
    "screenshot": "<repo-relative path to a committed reference screenshot (PNG), or null>"
  }
}
```

### Field rules

| field | required | notes |
|-------|----------|-------|
| `id` | YES | kebab-case, unique across the manifest |
| `name` | YES | title-case display name |
| `description` | YES | one sentence |
| `rationale` | YES | the soul reason for this atom's existence — citable back to SBA-1 |
| `variants` | YES | minimum 1 entry; variants are state/fidelity variants ONLY (default/hover/active, or full/standby). Never competing aesthetic concepts — that would violate design-unity Rule 4 |
| `variants[].name` | YES | brief label |
| `variants[].description` | YES | one line describing what this variant communicates |
| `token_refs` | YES | list of CSS custom property names. May be empty `[]` if and only if ALL appearance values are covered by `main_branch_refs` (rare; requires explicit gate comment) |
| `main_branch_refs` | YES | list of cited raw literals. Empty `[]` is valid when all appearances are tokenized. Any non-tokenized appearance literal MUST appear here |
| `main_branch_refs[].file` | YES | repo-relative path |
| `main_branch_refs[].line` | NO | integer or null; include when the value is a specific line |
| `main_branch_refs[].value` | YES | verbatim literal from that file — character-exact match |
| `main_branch_refs[].role` | YES | one line: what this value does |
| `render` | YES | the gallery.html anchor: `#atom-<id>` convention |
| `impl_ref` | NO | nullable; Sirius fills in Phase 3 |
| `production_ref` | NO | nullable object; populated when the production component/route exists |
| `production_ref.component` | YES (if production_ref present) | repo-relative path to the production component or route that renders this atom |
| `production_ref.screenshot` | YES (if production_ref present) | repo-relative path to a committed reference screenshot (PNG) taken from production at a known-good state; `null` if not yet captured |

### The `production_ref` field — render-fidelity anchor

The `production_ref` field connects a gallery atom to its production implementation. It exists to make render-fidelity verification tractable.

**Why it matters:**

The token-drift gate checks that gallery appearance values trace to tokens or cited literals. It does NOT check that the gallery atom visually matches what the production component actually renders. `production_ref` is the machine-readable link that enables a second, separate check: does the gallery atom still look like the production component, or has production drifted (or was the gallery never accurate to begin with)?

TASK-2026-05-29-SOUL-FACTORY-FIDELITY found that a token-green gallery can render fundamentally wrong — font-chain silent breakage (all text Times serif), 3D→2D abstraction loss (globe stub vs production Three.js scene). The `production_ref` field does not prevent these on its own, but it is the required input for the render-fidelity gauntlet step that does.

**When to populate it:**

- When the production component exists (i.e., `impl_ref` is non-null and the component has been built by Sirius)
- The `screenshot` sub-field is populated by Algol after a successful Playwright comparison run
- The `screenshot` path must point to a committed PNG in the repo (not a temporary/local path)

**Format example:**

```json
"production_ref": {
  "component": "components/WorldlineGlobe.tsx",
  "screenshot": ".claude/visual-diffs/soul-atlas/shots/fidelity-check/prod-globe-wrap.png"
}
```

A null `production_ref` is valid when the atom has no production implementation yet (e.g., speculative atoms, standby variants awaiting a Phase 3 surface). It is not valid once `impl_ref` is populated and the component has been built — at that point, Betelgeuse is responsible for populating `production_ref.component` and requesting an Algol fidelity run to capture `production_ref.screenshot`.

---

### Render-fidelity gauntlet — REQUIRED for any soul-atlas change

> **This is a standing protocol, not a one-time check.**

Whenever any file under `.claude/visual-diffs/soul-atlas/` changes (gallery.html, manifest.json, atom CSS), the following gauntlet must complete before the soul-atlas change reaches `betelgeuse-approved`:

**Step 1 · Token-drift gate** (automated, run by `scripts/audit-soul-atom-drift.sh`)
Verifies that all appearance values in gallery atoms trace to token_refs in `app/globals.css` or cited `main_branch_refs`. Also verifies font-chain presence (see §rail-font-chain-presence in `docs/harness/RAIL-DEFINITIONS.md`). This step is automated and blocking.

**Step 2 · Font-chain presence check** (automated, embedded in Step 1)
Verifies `--font-display`, `--font-mono`, `--font-type` are explicitly bound in gallery.html outside the Tailwind build pipeline. If absent, all text atoms fall back to Times serif silently. This step is automated and blocking (cannot reach PASS in Step 1 without it).

**Step 3 · Gallery render verification** (Algol · Playwright · REQUIRED)
Algol opens the gallery URL in a headless browser and compares computed styles for the affected atoms against their `production_ref.screenshot`. Specifically:
- `getComputedStyle(document.documentElement).getPropertyValue('--font-display')` must be non-empty
- `getComputedStyle(document.documentElement).getPropertyValue('--font-mono')` must be non-empty
- `getComputedStyle(document.documentElement).getPropertyValue('--font-type')` must be non-empty
- Each atom with a `production_ref.screenshot` must be screenshot-compared against that reference

This step is performed by Algol and is REQUIRED before any soul-atlas task is marked complete. The fidelity report is filed at `docs/qa/REPORTS/<task-id>-FIDELITY.md`.

**Step 4 · Production-ref screenshot update** (Algol, when production changes)
When a production component referenced by `production_ref.component` changes, Algol re-runs the Playwright comparison and updates `production_ref.screenshot`. The manifest entry is bumped to reflect the new screenshot. Betelgeuse evaluates whether the gallery atom still accurately represents the updated production component.

**Root cause addressed:** TASK-2026-05-29-SOUL-FACTORY-FIDELITY — the token-drift gate passed on the soul-atom gallery but the gallery rendered with all text in Times serif (font-chain infrastructure failure) and the globe atom was a 2D stub vs the production Three.js scene (3D→2D abstraction loss). Neither failure was visible to the token gate. The gauntlet formalizes the human+Playwright comparison that Algol performed post-hoc as a standing required step.

---

### Variants discipline

Variants express STATES or FIDELITY LEVELS of the same atom:

- States: `default`, `hover`, `active`, `focus`, `disabled`, `drift-warning`
- Fidelity: `full` (≥601px), `standby` (≤600px)
- Mode-determined: `teal-palette`, `ink-palette` (only when a single atom visually
  differs between palettes and both must be shown)

NEVER use variants to express competing aesthetic directions. Variants are for one
atom showing all its expected states — not for "version A vs version B" exploration.
That is what `directions/` is for, and it lives outside the gallery.

---

## Worked example — atom: `corner-reticle`

This is Betelgeuse's template. One complete atom entry:

```json
{
  "id": "corner-reticle",
  "name": "Corner Reticle",
  "description": "Engineering-blueprint L-bracket marks at two corners of a containing surface.",
  "rationale": "SBA-1 §summary item 8 — corner reticles are soul invariant I4: 'paper instrument with surveyed marks'. Their presence signals 'this surface is measured, not decorative'. Removing them from any primary surface violates soul continuity.",
  "variants": [
    {
      "name": "default",
      "description": "Top-left and bottom-right L-brackets at 12×12px, 1px accent-orange border, pseudo-elements on .corner-marks"
    },
    {
      "name": "micro",
      "description": "8×8px L-brackets on the divergence card (.diverge-panel::before/::after) — same atom, smaller scale, same token"
    }
  ],
  "token_refs": [
    "--accent-orange"
  ],
  "main_branch_refs": [
    {
      "file": "app/globals.css",
      "line": 160,
      "value": "12px",
      "role": "reticle arm length (default variant) — .corner-marks::before/::after width + height"
    },
    {
      "file": "app/globals.css",
      "line": 154,
      "value": "16px",
      "role": "inset from edge (default variant) — .corner-marks inset"
    },
    {
      "file": "app/globals.css",
      "line": 342,
      "value": "8px",
      "role": "arm length (micro variant) — .diverge-panel::before/::after width + height"
    },
    {
      "file": "app/globals.css",
      "line": 336,
      "value": "-1px",
      "role": "micro variant top/left offset — positions L-bracket flush with panel border"
    }
  ],
  "render": "#atom-corner-reticle",
  "impl_ref": "app/globals.css",
  "production_ref": {
    "component": "app/globals.css",
    "screenshot": null
  }
}
```

### What makes this entry correct

1. The only color (`--accent-orange`) is a `token_ref`. No hex appears in the gallery
   section for this atom except inside a `data-atom-raw-allowed="true"` comment that
   identifies it as a Three.js canvas value (not applicable here).
2. The four size values that are raw numbers (12px, 16px, 8px, -1px) are all cited in
   `main_branch_refs` with file + line + verbatim value. The gate verifies these by
   checking that the gallery HTML uses the same values at the `#atom-corner-reticle`
   section.
3. Variants are `default` and `micro` — both are the same atom at different scales, not
   competing designs.
4. `rationale` cites SBA-1 §summary item 8, making the soul reason auditable.
5. `impl_ref` points to `app/globals.css` where `.corner-marks` lives.
6. `production_ref` has `component` set (same as `impl_ref` for a pure-CSS atom) and
   `screenshot: null` because `.corner-marks` has no standalone production screenshot.
   Once Algol runs a Playwright fidelity check and captures a screenshot of the
   production corner reticle context, `production_ref.screenshot` should be populated.

---

## Gallery HTML conventions (Betelgeuse's contract)

Each atom in `gallery.html` must:

1. Have a containing element with `id="atom-<atom-id>"` and `data-atom-id="<atom-id>"`.
2. Declare each variant in a child with `data-atom-variant="<variant-name>"`.
3. Use only CSS custom properties (`var(--...)`) for appearance values that correspond
   to `token_refs`. If a raw value must appear (cited `main_branch_ref`), it must be
   annotated with a sibling comment: `<!-- gate: main_branch_ref value="12px" -->`.
4. Never introduce a raw appearance literal that is not in the manifest. The gate fails
   closed: an uncited literal is a FAIL, not a warning.

The gallery is a standalone HTML file. It references only `app/globals.css` (via a
relative `<link>` tag) and loads no JavaScript except Three.js stubs for the globe atom.
All font loading is via the same `@font-face` declarations as the main site. No build
step, no imports, no `@/` aliases — the gallery must remain prototype-layer-clean per
the existing `prototype-layer` rail.

---

*end of MANIFEST-SCHEMA.md*
