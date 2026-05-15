# TO · Sirius (α-SUR-01, Frontend Engineer)
# FROM · Polaris (α-OPS-00)
# TASK · TASK-2026-05-15-33
# TYPE · TASK CONTRACT (draft · pending root-Polaris release)
# CREATED · 2026-05-15
# MODEL TIER · sonnet (Three.js glyph extension; pattern already in WorldlineGlobe.tsx for article circles)

---

## **SIRIUS-SERIALIZATION NOTE** · WorldlineGlobe.tsx single-thread bottleneck

Per DEV-PLAN-B §B.3 + DEV-PLAN-00 master Phase 2 wave 2: **`components/WorldlineGlobe.tsx` is a
single-file collision point.** This TASK and TASK-19 (Globe integration) both touch it.

**Execution rule**: TASK-33 and TASK-19 MUST run **serial**, not parallel. Two Sirius instances
on `WorldlineGlobe.tsx` simultaneously will collide. Polaris dispatches one at a time. Default
sequence: TASK-19 first (placement integration is foundational), then TASK-33 builds the photo glyph
layer on top.

If root-Polaris flips the order, the new pre-task call will include a `WL_TASK_PREVIOUS` env var so
Sirius knows the working state of WorldlineGlobe.tsx at start.

---

## scope

Extend `components/WorldlineGlobe.tsx` with the **square glyph** for photo pin objects per ontology
v1.3 + journey-architecture v1.2 + AttractorFields binding (TASK-14). Adds `pinObjects` discriminator
support (`kind: 'article' | 'photo' | 'fiction'`) with photo → square glyph; integrates lightbox via
`yet-another-react-lightbox`; consumes processed photo records from TASK-30.

Earth-textured Globe base layer per binding §2.1 / §6.2 + Peat's design feedback FEEDBACK-2026-05-15.

## canonical inputs (READ FIRST — non-negotiable)

1. **`docs/design/attractor-binding-mechanic.md`** (TASK-14) —
   - §1.6 earth-textured base + glyph rendering rules
   - §2.1 step 1 earth-texture requirement (Peat feedback locked)
   - §4 state machine (glyph hover / select states)
   - §7.1 component touch list for WorldlineGlobe.tsx
2. **γ spec** · `docs/design/spec-photo-entry-atlas.md` (TASK-10 output) — square glyph visual contract; click → photo entry navigation
3. **`docs/prds/00-globe-ontology-1.2.md` v1.3** —
   - §4.4 edge styles (if photo nodes participate in edges)
   - §4.5 glyph taxonomy (article=circle, photo=square, fiction=diamond)
   - §5 prominence rule
4. **`docs/design/journey-architecture.md` v1.2** §2 Globe interaction model
5. **`scripts/process-photos.ts`** (TASK-30) + photo velite collection — typed records with `coordinates` for placement
6. **`lib/globe/placement.ts`** (TASK-18) — pure-fn placement (domain→meridian, date→latitude)
7. **`components/WorldlineGlobe.tsx` current source** — read entire file before edit; understand current article-pin rendering pattern; reuse it
8. **`.claude/handoffs/from-polaris/FEEDBACK-2026-05-15-peat-on-betelgeuse-design.md`** — Peat's locked direction shifts (earth-textured, orbital network, transparency revealing Ne0N axis)
9. **`docs/team/FILE-OWNERSHIP.md`** — Sirius territory; this file specifically
10. **`docs/team/QUALITY-BAR.md`** — performance budget (Three.js frame budget)

## deliverables

- Edits to `components/WorldlineGlobe.tsx`:
  - Add `pinObjects` discriminated union type (`{ kind: 'article'|'photo'|'fiction', ... }`)
  - Photo pins render as **square** glyph per ontology §4.5
  - Glyph dimensions / stroke / fill per binding §1.6 + γ spec
  - Click handler routes to `/photos/<roll>/<id>` (or opens lightbox per γ spec — confirm at impl)
  - Hover state matches existing article-pin pattern (γ spec exception flagged)
- Lightbox wiring via `yet-another-react-lightbox` (if γ spec lightbox-on-globe-click; otherwise navigate to photo entry route)
- Type exports for `pinObjects` union so TASK-30's processed records can be consumed type-safely
- No new design tokens; consume existing Three.js color constants per binding §1.6

## constraints

- **Do NOT** introduce new design tokens
- **Do NOT** modify `app/globals.css` — Betelgeuse territory
- **Do NOT** modify the placement functions — TASK-18 territory (`lib/globe/placement.ts`)
- **Do NOT** modify TASK-19's integration code unless your glyph layer requires a contract change
  (in which case open a handoff to Polaris before edit)
- **Do NOT** re-introduce strata-toggle behavior — v1.3 co-equal is canonical (binding §1.3)
- Honor `prefers-reduced-motion` for any glyph entrance / hover motion
- Performance: glyph layer must not drop frame budget below 60fps target on desktop / 30fps mobile
- Privacy: photos with `share-location: false` are NOT placed on the Globe (TASK-20 rail enforces;
  this layer trusts the sanitized record)

## harness protocol

- Step 0 · `bash .claude/hooks/pre-task.sh TASK-2026-05-15-33 sirius`
- sign with `WL_AGENT=sirius WL_NEXT=polaris WL_SUMMARY="square glyph photo-pin extension on Globe (TASK-33)" bash .claude/hooks/sign-work.sh TASK-2026-05-15-33`
- return at `.claude/handoffs/from-sirius/TASK-2026-05-15-33--to-polaris.md`
- **post-edit gate must run visual-diff** (UI surface touched) — `scripts/fetch-design-bundle.sh` or Playwright MCP for evidence

## acceptance criteria

- Square glyph renders at correct coordinates for at least 3 example photo records
- Glyph dimensions / stroke / fill match γ spec + binding §1.6
- Click on glyph → navigates to `/photos/<roll>/<id>` (or opens lightbox per final γ contract)
- Hover state functions; reduced-motion respected
- No `share-location: false` photo appears as a pin (Algol regression test confirms)
- Frame budget intact (no measurable FPS drop vs. pre-TASK baseline)
- Lightbox (if integrated) keyboard-navigable; ESC closes
- territory + design-tokens rails green (a11y rail informational pending stub graduation)
- Signature v2 clean
- Algol audit ready per standing rule

## downstream impact

Unblocks:
- **TASK-64** hover preview tooltip + glyph variants (consumes pinObjects union)
- **TASK-32** roll index pages (parallel; not strictly blocked, but coherent demo path)
- v1 demo path step 4 (DEV-PLAN-D §D.5.4 Globe → photo glyph → photo entry)
- Fiction diamond glyph extension (follow-up TASK; same pattern, different `kind`)

---

*polaris · α-OPS-00 · 2026-05-15 · TASK-33 draft contract (META-2 pre-stage) · **SERIALIZE w/ TASK-19***
