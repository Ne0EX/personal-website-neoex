# Console Places-Curation — build plan & write-path decision (2026-06-08)

> Polaris orchestration record. Grounds the multi-agent build for Peat's #2 ask
> ("console links real articles + controls what shows on the globe"). Resolved
> with advisor review (5 flags absorbed). Schema-native, dev-only authoring.
> Spec: `docs/design/place-aware-globe-spec.md` §5 (curation surface) + §4.1.

## What this builds
The console gains a **PLACES rail block** + **highlight editor panel**: Peat marks
**1 article + ≤5 ordered photos** as a place's curated front-door highlights, and
sets/adjusts the place **coordinate**. Saves persist to content + a place-data file
(**local authoring**, Peat reviews the git diff + commits — NOT production-publish,
which stays deferred).

## Write-path architecture (the seam)
Schema-native, NOT an overlay file — highlights live **per-record** in MDX
frontmatter exactly where `lib/content/places.ts` + the globe already read them.

| target | field(s) | file | owner |
|---|---|---|---|
| article highlight | `placeId`, `highlightForPlace` | `content/articles/*.mdx` | write: Altair · shape: Procyon |
| photo rank | `placeId`, `highlightRank` (1–5) | `content/photos/<roll>/DSCF*.mdx` | write: Altair · shape: Procyon |
| place coord / new place | `coord`, atom | `lib/content/place-registry.data.json` (NEW) | Procyon migrates registry→JSON; Altair writes |

- **No production write.** Server action is **dev-only** (`NODE_ENV !== 'production'`
  guard); Vercel FS is read-only. Local authoring → diff → commit is the publish path.
- **The live-mutating-action hook does not apply** — the action runs at app runtime
  (`next dev`), not via an agent's Bash tool.

## Decoupled-state contract (advisor flag #1 — top false-green risk)
Do **not** assume "velite watches → save → console reflects." Decouple editor truth:
- Editor seeds from `places.ts` on open; holds working curation in **React state**.
- SAVE → action persists files **and returns the authoritative new state**; client
  updates from the **return value** (no velite refetch / `router.refresh` for the
  immediate panel + rail card).
- velite-regen only matters for (a) the **globe** — build-time, prod is static, fine;
  (b) **reopening the same place later** — a separate, explicitly-verified item, not
  the critical path.
- **Acceptance:** "save → reflect" must be ground-truthed in a real browser cycle
  (Polaris does this independently — never gate the victory on a workflow self-report).

## Advisor flags baked into the build
1. **Decoupled return** (above) — shapes Altair's return signature + Sirius state.
2. **Surgical frontmatter write, NOT gray-matter** — insert/replace only the 3 fields
   inside the `---` fence; preserves key order, quotes, comments → clean diffs +
   byte-identical body. Procyon owns the pure `setFrontmatterField` transform.
3. **Transactional clear is load-bearing** — setting article B clears article A
   (`places.ts` throws on >1 article highlight). `places.ts` does **not** enforce
   unique photo ranks (only ≤5) → **the action is the sole guard** against dup ranks;
   write contiguous unique `1..N`. Algol tests switch-A→B-clears-A + ranks 1..N.
4. **Photo picking is degraded until the pipeline runs** — `thumbWebp` is undefined
   until `process-photos` runs (blocked on Peat's source JPEGs). Photo strip shows
   **frame ID + capture date/EXIF** as the distinguisher, dashed placeholder, never a
   broken `<img>`. Article highlights + coords are **fully curatable now**.
5. **§4.1 partial-save** — no "article required" gate; photo-only & article-only saves
   both valid; SAVE disabled only when neither is set. (Confirmed against spec.)

## Ownership (Zero-Trust — each agent born deny-by-default, owns its lane)
- **Procyon** `lib/content/**` — registry → `place-registry.data.json` (zod-validated
  loader, API stable) + pure `lib/content/frontmatter-edit.ts` (`setFrontmatterField`/
  `removeFrontmatterField`, body byte-preserved). No fs writes; no UI.
- **Betelgeuse** `app/globals.css` — confirm/add tokens for PLACES card + editor
  (most exist: `--paper-warm`, `--ink-dashed`, `--accent-orange`, `--ink-soft`).
  Additive, public byte-identical.
- **Vega** — returns the canonical microcopy map (rail, editor, NOT-SET / disabled /
  empty / degraded-photo states, NETRA "no highlights curated yet"). Sirius places it.
- **Altair** `lib/server/**` — dev-only guarded actions `savePlaceHighlights` /
  `savePlaceCoord` / `createPlace`; decoupled authoritative return; transactional
  clear; zod validation; path-containment; atomic write. Reads Next 16.2.6 docs first.
- **Sirius** `components/console/**`, `app/console/**` — PLACES rail block + highlight
  editor panel; optimistic-from-return state; degraded photo slots; a11y Tab/Enter/Esc.
- **Algol** `tests/**`, `scripts/audit-*` — six-step gauntlet; body byte-identical,
  transactional clear, dev-guard, partial-save, public byte-identical, post-save
  `places.ts` constraints hold (a build after save must not throw).

## Sequence (workflow `console-places-curation`)
`Foundation` (Procyon ∥ Betelgeuse ∥ Vega) → `Actions` (Altair) → `UI` (Sirius) →
`QA` (Algol). Contracts threaded via structured output. Polaris independently
ground-truths save→reflect in a browser before sign-off.
