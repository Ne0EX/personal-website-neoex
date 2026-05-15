# TO · Sirius (α-SUR-01, Frontend Engineer)
# FROM · Polaris (α-OPS-00)
# TASK · TASK-2026-05-15-31
# TYPE · TASK CONTRACT (draft · pending root-Polaris release)
# CREATED · 2026-05-15
# MODEL TIER · sonnet (route + instrument readout + roll-context — pattern-reuse heavy; γ spec carries novelty)

---

## scope

Implement the photo entry route at `/photos/<roll>/<id>` per γ spec (TASK-10 output) +
PRD-03-photo-atlas-deep-dive. Consumes `EntryShell` (TASK-23) with `kind='photo'`; renders
instrument readout (EXIF block); renders roll-context strip (sibling photos in same roll);
applies film-strip border per γ spec. Consumes TASK-30's processed photo records.

This closes one of the 7 v1 must-exist surfaces (DEV-PLAN-D §D.5.1 #3).

## canonical inputs (READ FIRST — non-negotiable)

1. **γ spec** · `docs/design/spec-photo-entry-atlas.md` (TASK-10 output) — visual + interaction contract
   - flag if not closed; this TASK depends on TASK-10 closing
2. **`docs/prds/PRD-03-photo-atlas.md`** + **`docs/prds/PRD-03-photo-atlas-deep-dive.md`** — instrument readout shape, roll-context behavior, film-sim variants
3. **`docs/design/journey-architecture.md` v1.2** —
   - §3 entry surfaces general
   - §3.3 photo entry specifics
   - §7 responsive table (mobile fallback for instrument readout)
4. **`docs/design/attractor-binding-mechanic.md`** (TASK-14) — §5 binding semantics for surface-stratum (Ne0) photo click flow
5. **`components/EntryShell.tsx`** (TASK-23 output) — layout boundary
6. **`scripts/process-photos.ts` + photo velite collection** (TASK-30 output) — processed records this route consumes via `lib/content` accessors
7. **`lib/content/` accessors** — `getPhotoByRollAndId(roll, id)`, `getPhotosByRoll(roll)`, types
8. **`docs/team/FILE-OWNERSHIP.md`** — Sirius territory
9. **`docs/team/QUALITY-BAR.md`** — a11y / token discipline

## deliverables

- `app/photos/[roll]/[id]/page.tsx` — route file
  - Server component default; client island only for lightbox if needed
  - Fetches via `lib/content` accessor (typed)
  - Renders `<EntryShell kind="photo" {...metadata}>` wrapping body
  - 404 for missing roll or id
- `components/photo/InstrumentReadout.tsx` — EXIF block per γ spec
  - lens · focal length · aperture · shutter · ISO · sensor · film-sim
  - mono 11px aesthetic; tokens only
- `components/photo/RollContextStrip.tsx` — horizontal strip of sibling photos in same roll
  - current photo marked; click navigates within roll
  - keyboard nav: ←/→ arrows traverse roll
- `components/photo/FilmStripBorder.tsx` (or CSS module on EntryShell when `kind='photo'`) — γ spec border treatment
- (deferred · separate TASK-32) roll index `/photos/<roll>` and `/photos` — out of scope here

## constraints

- **Do NOT modify** `components/WorldlineGlobe.tsx` — serialization point; TASK-33 territory
- **Do NOT modify** `app/globals.css` — Betelgeuse territory
- **Do NOT** implement lightbox here unless γ spec demands; can defer to TASK-34 follow-up if cleaner
- **Do NOT** auto-apply film-sim palette · γ spec mandates `[ match palette to CLASSIC CHROME · ⌃P ]`
  *suggestion affordance* (TASK-34 owns the palette switcher; this route just shows the affordance hook)
- **Do NOT** ship raw GPS on client bundle when `share-location: false` · TASK-20 privacy rail
  enforces; this route consumes the sanitized record
- Honor `prefers-reduced-motion`
- SSR/hydration safe
- a11y: alt text required on every `<img>`; instrument readout in semantic table or definition list
- Mobile (≤600px) per journey-arch §7: instrument readout collapses below image; roll-context strip
  horizontal scroll-snap

## harness protocol

- Step 0 · `bash .claude/hooks/pre-task.sh TASK-2026-05-15-31 sirius`
- sign with `WL_AGENT=sirius WL_NEXT=polaris WL_SUMMARY="photo entry route + instrument readout + roll-context (TASK-31)" bash .claude/hooks/sign-work.sh TASK-2026-05-15-31`
- return at `.claude/handoffs/from-sirius/TASK-2026-05-15-31--to-polaris.md`

## acceptance criteria

- `/photos/<roll>/<id>` renders for at least one example photo (post TASK-30 pipeline)
- Wrong roll OR wrong id → Next 16 `notFound()`
- Instrument readout renders all γ-spec fields when present in record (graceful missing-field handling)
- Roll-context strip shows siblings; current photo visibly marked
- ←/→ keyboard nav traverses roll on focus
- `share-location: false` photos render WITHOUT GPS in any client-visible payload (Algol verifies)
- Lighthouse a11y ≥ 95
- Mobile (≤600px): instrument readout collapses; no horizontal scroll on main column (roll strip scroll OK)
- territory + design-tokens rails green
- Signature v2 clean
- Algol audit ready per standing rule (+ privacy regression test carry-over from TASK-22 audit)

## downstream impact

Unblocks:
- **TASK-32** roll index `/photos` + `/photos/<roll>` (separate TASK — same data, different aggregate views)
- **TASK-33** Globe square-glyph extension (this route is the destination for photo-pin click)
- **TASK-34** film-sim palette suggestion affordance (extends `data-palette` toggle)
- v1 demo path step 4 (DEV-PLAN-D §D.5.4)

---

*polaris · α-OPS-00 · 2026-05-15 · TASK-31 draft contract (META-2 pre-stage)*
