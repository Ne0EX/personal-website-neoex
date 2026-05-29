# Soul-Atom Gallery

> Betelgeuse · α-VIS-04 · TASK-2026-05-29-SOUL-FACTORY (Phase 1)
> contract · `MANIFEST-SCHEMA.md` (Canopus, Phase 0)

---

## What this is

The recurring soul-craft atoms of Worldline — corner reticles, the NETRA console,
the divergence card, the paper globe — used to be rebuilt from prose every time a new
surface was specced. So they drifted. The hero needed three REVISE rounds; the mini-globe
never reproduced cleanly. The fix is here: **each atom exists once**, rendered with its
variants, bound to its tokens, cited to its source.

New surfaces **compose from these atoms** instead of **re-deriving them from prose**.

This is the soul-baseline (SBA-1 `docs/team/.soul-baseline/visual.md`) materialized as a
rendered artifact. It strengthens the design-unity rule; it does not replace it.

## Viewing

Run from the **repo root**:

```
npm run design
```

The script prints the exact URL to open:

```
http://localhost:8765/.claude/visual-diffs/soul-atlas/gallery.html
```

**Do not open `gallery.html` via `file://`** — the Three.js full-globe (atom A12) uses
ES-module imports (`import * as THREE from 'three'`) which browsers block over `file://`
(CORS restriction). The globe panel renders blank. Only the HTTP-served path works.

The server must start from the repo root (not from this directory) because the gallery
links `app/globals.css` via `../../../app/globals.css` — a path that escapes any
nested server root. `npm run design` handles this automatically.

---

## How to read it

Open the URL printed by `npm run design` in a browser. The gallery links the repo's
`app/globals.css` so tokens resolve, vendored fonts load, and the globe stub runs.

Each atom is one `<section>` with:

- an **id** strip (A01…A12), the human name, and a one-line role
- a **rationale** in Cormorant italic — the *soul* reason it exists, cited to SBA-1
- a **variant grid** — every state / fidelity level of the atom, rendered live
- a **cite block** — the exact `token_refs` (CSS custom properties) and
  `main_branch_refs` (cited raw literals with `file Lnn value`) that the atom is built from

The machine-readable index is `manifest.json` — the same atoms, same citations, in the
shape the drift gate (`scripts/audit-soul-atom-drift.sh`) reads.

## The atoms (12)

| # | atom | variants |
|---|------|----------|
| A01 | corner-reticle | default · micro |
| A02 | dashed-hairline | solid-rule · dashed-rule |
| A03 | alpha-node | default · active |
| A04 | divergence-card | default · drift |
| A05 | netra-console | default |
| A06 | netra-voice-strip | rest · attractor |
| A07 | hud-corner-readout | default |
| A08 | axis-label | default |
| A09 | alpha-watermark | default |
| A10 | attractor-pill | default · hover · active |
| A11 | type-roles | voice · instrument · value |
| A12 | globe | full · **standby (Phase-3 slot)** |

22 variants total.

## The rules this gallery obeys

1. **Every appearance value traces to a token or a citation.** Colors, sizes, spacing,
   timing — each is either `var(--token)` (the token exists in `app/globals.css`) or a
   raw literal cited in the manifest's `main_branch_refs` with file + line + verbatim value.
2. **Zero new tokens.** Nothing here invents a shade, a size, or a font. Every `token_ref`
   already exists in `globals.css`.
3. **Variants are states or fidelity levels only** — never competing aesthetic directions.
   `default / hover / active`, `full / standby`. Anything else would be a fourth baseline,
   which is the exact drift this gallery exists to kill (design-unity Rule 4).

## Two slots reserved for later phases

- **A12 globe · standby** — the ≤600px mini-globe is a **first-pass render only**. Its
  appearance literals (110px diameter, the radial-gradient stops, the box-shadow halos)
  are not yet in `globals.css`. Tokenizing them and folding them into the canonical source
  is **Phase 3 (Sirius, opus)**. `impl_ref` for the globe points at
  `components/WorldlineGlobe.tsx`; the standby variant's canonical hardening is deferred.
- **A12 globe · full** — rendered here through a lightweight 2D canvas **stub** that
  approximates the soul invariants (paper sphere, aged grain, lat/lon contours, axis spine
  visible *through* the sphere, α observer node). The canonical renderer is the Three.js
  scene in `components/WorldlineGlobe.tsx`. Runtime hex constants in the stub are exempt
  from the drift gate (Three.js cannot read CSS variables); their palette equivalents are
  documented in the manifest's globe `description` and in the script comments.

## How a new surface composes from this

When Betelgeuse specs a new surface and Sirius implements it:

1. Find the atoms the surface needs in this gallery (e.g. an entry page wants
   `corner-reticle`, `dashed-hairline`, `hud-corner-readout`, `type-roles`).
2. Reuse the atom's exact `token_refs` and class vocabulary — do not re-derive its
   appearance from the prose spec.
3. If the surface needs a value not covered by any atom, that is a signal: either an atom
   is missing (add it here first) or a token is missing (TOKEN PROPOSAL to Polaris). It is
   *never* a signal to invent a literal inline.

The drift gate enforces this on the gallery itself; the design-unity rule enforces it on
every surface that composes from it.
