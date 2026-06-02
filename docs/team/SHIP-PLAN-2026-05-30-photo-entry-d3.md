# SHIP PLAN — `/photos/<roll>/<id>` · D3 production ship

> author · Polaris (α-OPS-00) · 2026-05-30 (v2 — revised after Peat review)
> task · TASK-2026-05-30-PHOTO-ENTRY-D3-SHIP
> origin · Peat directive 2026-05-30: redesign an abandoned visual-diff page + connect to web production (test the master-design loop end-to-end)
> brainstorming-flow output · this doc is the validated design / ship plan; transitions to writing-plans next.
> v2 changes · softened §0/§8 framing per Peat #1; resolved palette gate handling per #2; specified server/client mechanism per #3; concrete sidecar precondition per #4; render-fidelity scope per #5; small notes A/B/C addressed; "Deferred decisions" section added (honest, not "no TBD").
> v3 changes (Peat review 2 — bugs/inconsistencies) · **A** fixed palette CSS to compound selectors (descendant combinator would silently not match — load-bearing for D3); **B** `paper-mount` committed to **catalogue-first** (new gallery atom, Betelgeuse adds before handoff so atom-reuse gate passes; D6 decided, removed from deferred table); **C** transitionend `setTimeout` fallback to guarantee class cleanup on interrupt; **D** §8 wording tightened to "verifiable at spec-handoff" (atom-reuse gate verifies *spec* citations, not *code*; spec→code link is still human review).
> v4 changes (Peat review 3 — skill sync + cleanup) · **#1** step 1a now **dual-writes** `paper-mount` to BOTH the gallery AND the `worldline-design` skill atom catalog — preserves the "compose from the skill" thesis (otherwise skill stays at 16 atoms while gallery grows to 17 → exactly the skill↔gallery drift this system fights). Honestly named: this manual dual-write IS another 1.0 gap (alongside gitignored/single-machine), goes away when one artifact is generated from the other. **#2** §7 gate wording updated (gallery now includes paper-mount; "untouched" was stale). **#3** `data-palette="base"` visual state defined explicitly (= native unstyled image; no palette CSS rule targets `[data-palette="base"]`; "revert to base" = set the attribute back to `"base"`, image renders as-shot).

---

## 0 · goal

Ship the **first** production surface that demonstrably composes against the soul-atlas master design system, taking the loop from *"declared rule"* to *"verifiable in code"*. The honest framing (per Peat 2026-05-30 review):

- The `worldline-design` skill and `app/globals.css` share ancestry (skill was lifted verbatim from globals.css). What this ship proves is that the loop is **checkable** — Rule 5 + the atom-reuse pre-handoff gate verify the production surface cites the skill's atoms, and the drift gate would correctly fail if the skill drifted from the gallery.
- It does **not** prove production is *generated* from the skill — that would require production to import the skill artifact directly. We are not there. See §8 for the honest delta.

Concretely: turn the photo-entry detail page from "abandoned prototype" into "live route in the production site," composing from the `worldline-design` skill as the binding reference, with Algol verifying.

## 1 · scope (in / out)

**In this ship:**
- One new Next.js dynamic route: `app/photos/[roll]/[id]/page.tsx` — single photo entry detail.
- Two new components: `components/PhotoEntry.tsx` (server) and `components/FilmSimSwitcher.tsx` (client).
- One co-located CSS file: `components/PhotoEntry.palette.css` (the four PRD-03 §8.1 palettes — see §3 + §4 for raw-hex exception handling).
- Direction-locked to **D3** (Peat 2026-05-30): paper-mount metaphor · accent filmSim in readout + ambient in mount · NETRA L1 always-on solid bay · **LIVE palette switching** (Classic Chrome / Acros / Reala Ace / Velvia per PRD-03 §8.1) + NETRA "borrowed eye" narration.
- Compose from `worldline-design` skill atoms.
- Algol render-fidelity verification at 1180 / 880 / 600 / 375 — scoped (see §7).

**Explicitly OUT (flagged for separate ships):**
- `/photos` roll index — TASK-32 (Sirius).
- `/photos/<roll>` single-roll atlas / contact sheet — TASK-32.
- Globe square-glyph extension to mark photo entries on the globe — TASK-33.
- Prev/next photo navigation within a roll — stub a "← back to roll" link if helpful, but no carousel.
- Keyboard navigation between rolls.
- Search.
- Peat's three uploaded test photos (Mustang Blu × 2 + the concrete-corner architecture frame) — Peat to drop into `content/photos/_inbox/` or a new roll dir; Procyon runs `scripts/process-photos.ts` to generate sidecars + variants. Not in this ship.

## 2 · route + data

**Route:** `app/photos/[roll]/[id]/page.tsx`
- Server component.
- `generateStaticParams()` reads `photoSidecars` collection from velite.
- `generateMetadata({ params })` for per-photo `<title>`.
- 404 (`notFound()`) when `(roll, id)` does not resolve.

**Precondition (verify BEFORE dispatch — Polaris, ≤2 min):**
- Run `npx velite build` to refresh the cache (currently STALE: cache has 1 sidecar, `content/photos/` has 5 MDX sidecars: `2026-04-chiang-mai/DSCF0001.mdx` + `2026-05-bangkok/DSCF0002–0005.mdx`).
- Confirm `.velite/photoSidecars.json` length is non-empty (target: 5).
- Pin one concrete `(roll, id)` for §7 acceptance — e.g. `(2026-05-bangkok, DSCF0002)` — and verify the sidecar's fields (`roll`, `id`, `kind: photo-sidecar`, `date`, `caption`, `shareLocation`) are present (already confirmed for DSCF0002).
- If `scripts/process-photos.ts` has not run for these rolls (variants missing in sidecar), still ship without responsive variants for v1; flag as Procyon follow-up.

**Data helper (small, scoped):**
- Add `getPhotoByRollAndId(roll: string, id: string): Promise<PhotoSidecar | null>` + roll context lookup to `lib/content/photos.ts`.
- **Owner: Sirius** (route consumer; helper is trivially scoped; Procyon is not in this dispatch wave).

## 3 · components

### `components/PhotoEntry.tsx` (server)
- Three-column grid `[260 · 1fr · 240]` (D3 baseline, inherited from D1).
- Root carries `data-photo-entry-root` (the marker FilmSimSwitcher will mutate) and `data-palette="base"` initial value. **`base` is the native unstyled image** — no palette CSS rule targets `[data-palette="base"]`; the four palette blocks override only when a non-base sim is active. "Revert to base" therefore means set the attribute back to `"base"` and the image renders as-shot.
- **Left aside (260):** roll context (roll slug · sequence within roll · `← back to roll` stub link · roll narrative excerpt if present).
- **Center (1fr):** paper-mount — 12px `--paper-warm` margin + 1px `--ink-faint` rule framing the image; ambient `--ink-soft` FILM SIM label at mount footer.
- **Right aside (240):** EXIF as `<dl>` with `tabular-nums` lock; NETRA L1 bay always-on solid border, GPS or "no coord" state; CTAs.
- Page-level chrome (Nav, Marginalia HUD, scroll-meter, page corner reticles, N badge, paper-canvas grain) — REUSE existing homepage atoms.
- Atom composition (cited by id in Betelgeuse's `## atoms used` table): **`paper-mount` (NEW gallery atom — Betelgeuse catalogues BEFORE handoff; see §6 step 1)**, `netra-console`, `netra-voice-strip`, `hud-corner-readout`, `corner-reticle`, `type-roles` (Cormorant italic for narrative; mono uppercase 0.22em for labels; Special Elite for numerals/coords), `dashed-hairline`.

### `components/FilmSimSwitcher.tsx` (client — `'use client'`)
- Renders 4 `<button>` palette options (Classic Chrome / Acros / Reala Ace / Velvia) styled as attractor-pill-like controls.
- **Server/client split mechanism (resolved per Peat #3):** PhotoEntry is server and renders the root marker `[data-photo-entry-root]` with `data-palette="base"`. FilmSimSwitcher is client and on `onClick` mutates the marker imperatively:
  ```ts
  const root = document.querySelector<HTMLElement>('[data-photo-entry-root]');
  if (!root) return;
  root.dataset.palette = sim;
  ```
  This runs post-hydration (onClick is safe). No state lifted across the boundary; no client wrapper around the server surface.
- Brief opacity-dip via `document.body.classList.add('is-palette-switching')`, removed on `transitionend` — **with a `setTimeout` fallback (transition duration + ~50ms buffer)** to guarantee cleanup if `transitionend` doesn't fire (rapid back-to-back switches or browser quirk). Cancel any in-flight fallback timer on the next click. **Skipped entirely under `prefers-reduced-motion: reduce`** (instant swap; no class added, no fallback needed).
- Updates the NETRA voice strip text to extend with `(borrowed eye · <sim>)` when `sim !== 'base'`; reverts on base. Uses the same imperative DOM pattern on the NETRA voice element (also marked with a data-attribute).

### `components/PhotoEntry.palette.css` (co-located, side-effect imported)
- 4 blocks using **compound** selectors (per Peat v3 #A): `[data-photo-entry-root][data-palette="classic-chrome"] img { … }`, `[data-photo-entry-root][data-palette="acros"] img { … }`, `[data-photo-entry-root][data-palette="reala-ace"] img { … }`, `[data-photo-entry-root][data-palette="velvia"] img { … }` — verbatim raw hex from PRD-03 §8.1. **DO NOT use a descendant combinator** (`[data-palette="x"] [data-photo-entry-root]` with a space) — the two data-attributes live on the *same* element, so the descendant form silently never matches and the live switch would do nothing.
- Imported via `import './PhotoEntry.palette.css'` from PhotoEntry.tsx (side-effect). Stays in the regular CSS cascade (not a CSS module — module class mangling would defeat the `[data-palette]` global selector).

## 4 · binding to the `worldline-design` skill — and the palette exception

- Every dispatched agent (Betelgeuse, Sirius, Algol) **invokes `/worldline-design` first** — default-binding via `.claude/AGENTS.md` + their personas (2026-05-30).
- Betelgeuse's per-ship design spec composes from atoms in the skill and includes the Rule 5 `## atoms used` table; the atom-reuse pre-handoff check verifies citations resolve in the gallery manifest.

**Drift gate scope — honest clarification (per Peat #2):**
- `scripts/audit-soul-atom-drift.{sh,ts}` scans the **gallery** (`.claude/visual-diffs/soul-atlas/gallery.html`). It does **not** scan production `app/` or `components/`.
- "Zero new tokens in production" is enforced as a **workflow norm** via Betelgeuse's anti-Codex checklist (token-compliance check) + code review + Rule 5 atom-reuse — **not** by a static drift gate on production code.
- The 4 raw-hex palettes are the **first named production exception site** to the no-raw-hex norm, documented in **PRD-03 §8.1**. They live in `components/PhotoEntry.palette.css`. Because the drift gate does not reach production, no `<!-- gate: exempt -->` marker or `data-gate-exempt` attribute is needed there — the exception is a documented workflow allowance, not a gate suppression.
- **Candidate skill update (not in this ship):** add a short "Production raw-hex exception register" file to `worldline-design` skill listing every named exception site (`PhotoEntry.palette.css` will be the first entry). Prevents this becoming a re-decide-per-ship question for future palette/media surfaces. Owner: Betelgeuse + Vega sign-off, follow-up TASK.

## 5 · what we reuse from production (don't rebuild)

- `app/globals.css` — all tokens.
- Nav, Marginalia HUD, scroll-meter, page corner marks, paper-canvas grain — existing in homepage layout.
- Font loading (`next/font/google`).

## 6 · agents + sequencing

1. **Betelgeuse (sonnet)** — TWO sub-deliverables, in order:
   1a. **Catalogue `paper-mount` as a new atom in BOTH the gallery AND the `worldline-design` skill** (per Peat v4 #1 — preserves the "compose from the skill" thesis; the alternative leaves the skill at 16 atoms while the gallery grows to 17, exactly the skill↔gallery drift the whole system fights):
      - **Gallery** (`.claude/visual-diffs/soul-atlas/`): manifest entry (id, name, description, rationale, variants `default`/`narrow` if needed, `token_refs: [--paper-warm, --ink-faint]`, `main_branch_refs` for the 12px / 1px geometry cited verbatim from `app/globals.css`), `gallery.html #atom-paper-mount` section rendering a specimen. Run `bash scripts/audit-soul-atom-drift.sh` → exit 0.
      - **Skill** (`.claude/skills/worldline-design/`): add the `paper-mount` rule to `worldline-atoms.css` (the skill's atom catalog) and update the README INDEX entry if present. **Recommended:** add a `preview/paper-mount.html` card so the skill's Design System tab carries the specimen too — matches the gallery section, low cost.
      - **Honest:** this is a **manual dual-write** = another 1.0 gap (alongside the gitignored / single-machine gap noted in §8). It goes away when one artifact is generated from the other; for now, the catalogue-first decision treats it as an explicit, named manual sync.
      - **Both MUST land before the per-ship spec hands off** — otherwise (a) the atom-reuse pre-handoff gate will FAIL on `paper-mount` not resolving in the gallery manifest (per §7), AND (b) the skill agents invoke will be missing `paper-mount`, undercutting the §0 thesis.
   1b. **Per-ship design spec** in `docs/design/` (≤200 lines per workflow Rule 3) composing D3 prototype + `worldline-design` skill; includes the `## atoms used` table citing `paper-mount` (now in manifest) + the existing atoms.
2. **Sirius (sonnet)** — implements the route + 2 components + the palette CSS file + the helper per Betelgeuse's spec.
3. **Algol (sonnet)** — Playwright render-fidelity (see §7 for scope); confirms gates; signs.

Sequential (each blocks the next).

**Opus escalation trigger (per Peat small note B):** escalate **Sirius → opus** if either (a) the server/client palette mechanism turns out non-trivial under hydration (e.g., race with Fast Refresh, SSR/CSR drift), OR (b) the PRD-03 §8.1 palette CSS interacts unexpectedly with the existing cascade (specificity collision with paper-mount, image filter compounding). Polaris re-dispatches at opus + logs the override.

## 7 · acceptance — render-fidelity scope (per Peat #5)

Render-fidelity matches are scoped to the **photo-entry surface region** (the three-column grid: roll-context aside / paper-mount center / EXIF + NETRA aside, plus the FilmSimSwitcher). The following production chrome is **expected to differ** from the standalone D3 prototype and is NOT a fail:
- Nav strip (production has the full site nav; prototype was standalone).
- Marginalia HUD on right edge (production global).
- Scroll-meter top rail (production global).
- Page corner reticles + N floating badge (production global).
- Paper-canvas grain (same atom, applied via production layout — read as identical).

Pass criteria:
- `/photos/2026-05-bangkok/DSCF0002` renders the D3 surface region (3-col grid, paper-mount, NETRA L1, EXIF readout, FilmSimSwitcher) at 1180 / 880 / 600 / 375 with composition matching the D3 prototype at the surface region.
- FilmSim switcher swaps `data-palette` live + image treatment changes + NETRA voice strip extends `(borrowed eye · <sim>)` and reverts on base.
- Reduced-motion: switcher is instant (no opacity-dip).
- All atoms cited in Betelgeuse's `## atoms used` table resolve in the gallery manifest (atom-reuse PRE-handoff PASS).
- `bash scripts/audit-soul-atom-drift.sh` → exit 0; `bash scripts/audit-font-chain.sh` → exit 0 (gallery now includes the new `paper-mount` atom from step 1a; drift gate verifies the addition is token-compliant + nothing else regressed).
- `npm run build` clean; `npx tsc --noEmit` clean.
- No regression on homepage `/`.

## 8 · what success means for the master-design-system question (honest framing — per Peat #1)

After this ship, the master-design-system answer moves from **"declared rule"** to **"verifiable at spec-handoff"** (precise framing per Peat v3 #D):
- The atom-reuse pre-handoff gate proves at handoff time that the **spec** cites the skill's atoms (not re-derives from prose). It does NOT prove the *code* uses them — the spec → code linkage is still human review (Betelgeuse anti-Codex checklist + reviewer attention). Making spec → code static is the next axis to harden.
- The drift gate would correctly fail if the gallery drifted from its tokens.
- Betelgeuse's persona rejects specs that violate the skill's README.

This is a **verifiability** advance, not a single-source-of-truth advance. Production still reads tokens from `app/globals.css`; the skill is a co-equal artifact lifted from the same ancestor. The drift gate doesn't reach production code.

**What 1.0 actually requires** (next ship cycle, NOT this one):
- Production imports the skill artifact directly (e.g., skill's `colors_and_type.css` becomes the source `globals.css` re-exports from, OR production component CSS literally `import`s the skill's `worldline-atoms.css`). Then drift becomes impossible by construction, not by gate.
- The skill itself is committed (currently gitignored on Peat's machine — single-machine fragility).
- Coverage spans all surfaces (this ship is one of many).

So: this ship is a milestone on the right axis, not the destination.

## 9 · deferred decisions + owner (per Peat small note C — honest, not "no TBD")

| # | decision | owner | when resolved |
|---|---|---|---|
| D1 | Whether to ship without responsive-variant images if `scripts/process-photos.ts` has not run for these rolls | Polaris (during §2 precondition check) | before dispatch |
| D2 | NETRA voice text update target — exact data-attribute selector on the voice element | Sirius (during PhotoEntry implementation) | during impl |
| D3 | Stub `← back to roll` link target — link to `/photos/<roll>` (route does not exist yet) vs link to homepage | Sirius | during impl; default = `/photos/<roll>` (404 acceptable; the OUT-of-scope route comes next) |
| D4 | Exact opacity-dip timing curve | Betelgeuse (spec) → Sirius (impl) | during Betelgeuse spec authoring |
| D5 | Whether to formalize the "production raw-hex exception register" in the skill as a follow-up TASK | Polaris, after this ship | after Algol PASS |

> **D6 was deferred in v2; DECIDED in v3 as catalogue-first** (paper-mount → new gallery atom, Betelgeuse adds before handoff). Rationale: high recurrence (atlas + contact-sheet will reuse), catalogue-first matches the "compose from atoms" thesis, removes a drift pattern at the root, strengthens §0 claim. Mechanics in §3 + §6 step 1a.

These are NOT "no TBD"; they are scoped deferrals with owners + resolution timing. Honest.

---

*polaris · α-OPS-00 · TASK-2026-05-30-PHOTO-ENTRY-D3-SHIP · 2026-05-30 v2*
