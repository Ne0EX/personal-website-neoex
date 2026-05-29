# SAVE-POINT · 2026-05-17 · Phase 2 wave essentially COMPLETE

> Polaris session-handoff document · written for next-Polaris resume after Peat clears chat
> Status snapshot at end of full-day Phase 2 push · 2026-05-17 evening

---

## §1 · WHERE WE ARE

**Phase 2 surfaces (article + archive + branching) all shipped at iter-2-prototype/spec/implementation triangle.** Iter-1 ATLAS prototype LOCKED 2026-05-17 morning. Today's wave dispatched 20+ agents across opus/sonnet tiers · all returned signed-clean.

### running surfaces

| surface | spec | copy | schema | prototype | production component | audit |
|---|---|---|---|---|---|---|
| ATLAS (iter-1) | spec-globe-v1-direction + binding v1.1 | NETRA voice baseline | n/a | `.claude/visual-diffs/UI-ITER-1-globe-v1/prototype/` @ :8731 LOCKED | components/WorldlineGlobe.tsx | Algol PASS-WITH-NOTES (final 2026-05-17) |
| ARTICLE (iter-2) | docs/design/09-article-entry.md v2 + 09a-prototype-plan | Vega 18 copy points · Candidate A L1 voice | n/a (uses existing Entry/Article type) | `.claude/visual-diffs/UI-ITER-2-article-v1/prototype/` @ :8732 | (Sirius port pending) | (pending) |
| ARCHIVE (iter-2) | docs/design/20-archive.md v1 (Option C hybrid) | Vega 10 copy artifacts · "the surveyed corpus." | (uses existing types) | `.claude/visual-diffs/UI-ITER-2-archive-v1/prototype/` @ :8733 | (Sirius port pending) | (pending) |
| WORLDLINE-BRANCHING | docs/design/30-worldline-branching.md v1 | Vega Q-F/Q-G voice locked | Procyon variants[] + divergence_cluster | (renders in ATLAS · no new prototype) | components/WorldlineGlobe.tsx (Sirius §13.2 · merge-ready) | Algol APPROVE-WITH-NOTES |
| PHOTO+FILMSIM | docs/design/10-photo-entry.md v2 + 10-photo-atlas.md v1 | Vega filmSim affordance C1 SEE THROUGH locked | (uses existing Photo type) | (no new prototype this wave) | (Sirius port pending) | (pending) |

### Phase 2 task chain (sig + signature self_hash for trail)

- TASK-2026-05-17-ARTICLE-REFINE · Betelgeuse · `5379855…`
- TASK-2026-05-17-VEGA-L1-VOICE-ARTICLE · Vega · Candidate A `"locus confirmed. FILE — {fileNum} · {coords} · {status}."`
- TASK-2026-05-17-PHOTO-FILMSIM-REFINE · Betelgeuse · `5288fc6…`
- TASK-2026-05-17-VEGA-FILMSIM-AFFORDANCE · Vega · C1 SEE THROUGH locked
- TASK-2026-05-17-FILMSIM-AFFORDANCE-VALIDATE · Betelgeuse · 25 data points · 92px headroom
- TASK-2026-05-17-WORLDLINE-BRANCHING-DRAFT · Betelgeuse opus · 16 sections · 8 Q's resolved
- TASK-2026-05-17-VEGA-BRANCHING-VOICE · Vega · Q-F/Q-G locked
- TASK-2026-05-17-PROCYON-BRANCHING-SCHEMA · Procyon · sig `11c3ac5…` · variants[] + divergence_cluster + getFictionSiblings + SITE_ALPHA
- TASK-2026-05-17-ARTICLE-PLAN · Betelgeuse opus · 487 lines · 8 build-sequence steps
- TASK-2026-05-17-ARTICLE-PLAN-COPY · Vega opus · 18 copy points · Pair A
- TASK-2026-05-17-ARCHIVE-PLAN · Betelgeuse opus · 1097 lines · Option C hybrid
- TASK-2026-05-17-ARCHIVE-PLAN-COPY · Vega opus · 10 artifacts · 4-axis nav model · Pair B
- TASK-2026-05-17-SIRIUS-BRANCHING-RENDERER · Sirius · sig `7063735…` · MERGE-READY
- TASK-2026-05-17-SIRIUS-BRANCHING-RENDERER-VISUAL-APPROVAL · Betelgeuse · betelgeuse-approved
- TASK-2026-05-17-ALGOL-AUDIT-BRANCHING-RENDERER · Algol · APPROVE-WITH-NOTES · sig `f6a387ca…`
- TASK-2026-05-17-UI-ITER-2-ARTICLE-PROTOTYPE · Betelgeuse · sig `51ca909b…` · 18 Vega copy verbatim · META-10 PASS
- TASK-2026-05-17-UI-ITER-2-ARCHIVE-PROTOTYPE · Betelgeuse · scroll-meter SOUL-BAR landed · 7 Peat decisions + 10 Vega copy + META-10 PASS

---

## §2 · KEY DECISIONS LOCKED (don't redebate)

### nav-strip 4-axis model (Vega-locked)
- INDEX = master view · globe ATLAS · all-at-once
- ARCHIVE = corpus axis · contact sheet
- TRACES = recency axis · film print
- TRANSMIT = outbound axis · channels
- ARCHIVE ↔ TRACES = same data · different surface (visual differentiation = HIGHEST dilution risk to monitor)

### ARCHIVE = Option C hybrid
- Single route `/archive` · cross-stratum ledger · articles + photos + fiction(placeholder)
- NO pagination · scroll-meter SOUL-BAR (3-layer · fill track + march overlay + α-readout chip with DEPTH/04 zones)
- Filter pills v1 (TYPE/STATUS/DOMAIN/YEAR/SORT) · pair with active attractor · default chronological latest-first
- Patches feed v1.1 deferred
- Privacy asymmetry: ledger shows entry without LOCUS · mini-globe excludes GPS-private
- NO sync with homepage activeAttractor
- 3 categories visible · fiction column = empty-state placeholder ("the corpus is silent")

### branching mechanic decisions (8 Q's)
- Q1: alternate-α variants (2-4) + same-cluster siblings (0-2) · max 5
- Q2: compound E · tendril paths + drift-signature halo
- Q3: NETRA RW-5 tracking trigger · one node at a time
- Q4: read-only v1 · hybrid v1.1 (BLOCKED on Peat Q-A decision)
- Q5: NeX only
- Q6: orbital-on-orbital · phase-locked breathing
- Q7: divergence-vector projection (variants) + real coords (siblings)
- Q8: "this transmission could have gone otherwise · NETRA told me which directions"

### filmSim affordance (Vega-locked + Betelgeuse-validated)
- C1 `SEE THROUGH {filmSim} · ⌃P` · 92px headroom at 375px JetBrains Mono 9px
- FS5 silent palette switch (no α drift · no NETRA narration · 160ms opacity dip only)

### ARCHIVE-vs-OBSERVATORY (Polaris-articulated · Peat-ratified)
- OBSERVATORY = the ATLAS instrument · 3D · kinetic · active observation
- ARCHIVE = `/archive` route · 2D · flat · corpus inventory
- Fiction lives in BOTH as same-data-different-surface · OBSERVATORY = orbital (branching alive) · ARCHIVE = catalog row

---

## §3 · PENDING PEAT DECISIONS

Peat morning-checks pending verdicts:
1. **Browse 8732 + 8733 + production** · review article + archive prototypes + branching renderer behavior live
2. **FLAG-2 breathing amplitude tune** · try as-is first · knobs identified `BREATH_LIFT_AMP` (±15% · try 0.25 if static) + `BREATH_SWAY_AMP` (±0.012 rad · try 0.006 if twitchy) · constants at WorldlineGlobe.tsx lines 70-71
3. **Q-A worldline-branching v1.1 content treatment** · BLOCKS v1.1 scope · whether variant content has rendered preview/teaser OR title-only
4. **Q-G empty-state coverage** · add fiction stub without `variants` OR defer to TASK-31 content phase
5. **Phase 2 wave close** · acknowledge ship · move to production-port phase

---

## §4 · QUEUED FOR DISPATCH (post Peat verdict)

### production ports (Sirius)
- ARTICLE prototype → components (existing components/ChapterIndex · new ArticleEntry layout · Article reading surface route)
- ARCHIVE prototype → components (new ArchivePage layout · scroll-meter component · filter pills · mini-globe SVG)
- (PHOTO surface deferred unless content exists)

### content-side (Procyon)
- Reala Ace filmSim palette completeness check during TASK-31 photo-entry implementation (verify PRD-03 §8.1 mapping not stale)
- Pullquote MDX `source?: string` prop (article spec §1.7 attribution)

### voice (Vega)
- Vega Pullquote attribution copy if Procyon ships the prop
- Future: NETRA voice rotation cadence (Arcturus/Sirius pair · article spec §1.6)

### harness (Canopus)
- HOOK PROPOSAL: exclude own signature file from `files_touched` (self-signature paradox · documented in TASK-14)
- HOOK PROPOSAL: `audit-prototype-discipline.sh` extend scan-scope to `.claude/visual-diffs/` (Algol noted)
- HOOK PROPOSAL: sign-work fallback for tasks dispatched without Polaris assignment file (recurring · multiple agents flagged)

### future TASKs (queued)
- Homepage attractor field redesign · MEDIUM priority · Peat directive ("filter ที่ใช้ filter chapter index / traces ไว้ด้านล่าง")
- `--paper-patch` token promotion · trigger when 3rd surface uses the rgba(232,226,213,0.88) cushion pattern

---

## §5 · CRITICAL FILES / PATHS

### canonical prototypes (visual sources of truth)
- `.claude/visual-diffs/UI-ITER-1-globe-v1/prototype/index.html` (ATLAS · LOCKED · do not touch)
- `.claude/visual-diffs/UI-ITER-2-article-v1/prototype/index.html` (article surface)
- `.claude/visual-diffs/UI-ITER-2-archive-v1/prototype/index.html` (archive surface)

### dev server ports (each prototype self-served)
- :8731 ATLAS (iter-1 · LOCKED)
- :8732 ARTICLE (iter-2)
- :8733 ARCHIVE (iter-2)
- :3000 Next.js production (branching renderer live)

### canonical specs (frozen unless next major iteration)
- `docs/design/spec-globe-v1-direction.md` (ATLAS direction)
- `docs/design/attractor-binding-mechanic.md` v1.1 (Globe binding)
- `docs/design/journey-architecture.md` (journey/M-points)
- `docs/design/09-article-entry.md` v2 (article surface)
- `docs/design/09a-article-entry-prototype-plan.md` (article prototype plan)
- `docs/design/10-photo-entry.md` v2 (photo surface · filmSim § lifted)
- `docs/design/10-photo-atlas.md` v1 (photo atlas surfaces)
- `docs/design/20-archive.md` v1 (archive surface · Option C hybrid)
- `docs/design/30-worldline-branching.md` v1 (branching mechanic)
- `docs/design/40-search-overlay.md` (search overlay · pre-Phase 2)
- `docs/design/60-responsive-system.md` (responsive system · pre-Phase 2)

### voice/copy locks
- `lib/netra/voice.md` v1.1.0 (NETRA bay register)
- `.claude/handoffs/from-vega/TASK-2026-05-17-VEGA-L1-VOICE-ARTICLE--to-polaris.md` (article L1)
- `.claude/handoffs/from-vega/TASK-2026-05-17-VEGA-FILMSIM-AFFORDANCE--to-polaris.md` (filmSim C1)
- `.claude/handoffs/from-vega/TASK-2026-05-17-VEGA-BRANCHING-VOICE--to-polaris.md` (Q-F/Q-G)
- `.claude/handoffs/from-vega/TASK-2026-05-17-ARTICLE-PLAN-COPY--to-polaris.md` (18 copy points)
- `.claude/handoffs/from-vega/TASK-2026-05-17-ARCHIVE-PLAN-COPY--to-polaris.md` (10 copy + 4-axis nav)
- `docs/team/.soul-baseline/voice.md` (Vega SBA-2 blocklist)

### schema
- `velite.config.ts` (fictionVariantSchema · variants[] · divergence_cluster)
- `lib/content/fiction.ts` (getFictionSiblings · SITE_ALPHA)
- `lib/content/types.ts` (FictionVariant · FictionPin extensions)
- `docs/data/fiction-schema-v2.md` (Procyon's schema doc)

### audit trail
- `.claude/handoffs/from-algol/TASK-2026-05-15-UI-1-FINAL-AUDIT--to-polaris.md` (iter-1 final)
- `.claude/handoffs/from-algol/TASK-2026-05-17-ALGOL-AUDIT-BRANCHING-RENDERER--to-polaris.md` (branching renderer · APPROVE-WITH-NOTES)
- `.claude/signatures/*.json` (per-task sig chain · v2 schema)
- `.claude/signatures/AUDIT.md` (audit log)

---

## §6 · PR/GIT STATE

- **PR #1** open · draft · label `do-not-merge` · contains GENESIS infra + iter-1 + Phase 2 work
- Branch: `genesis/orchestration-foundations`
- Target: `main` (DO NOT MERGE · accidental merge = explosion per Peat)
- Strategy when ready: cherry-pick production payload only (components/** · app/** · lib/** · content/** · docs/design/**) · leave `.claude/**` · `docs/team/**` · `prototype/**` in branch

### untracked / uncommitted (significant items at save-point)
- New design specs (09a · 20 · 30)
- 2 new prototype dirs (UI-ITER-2-article-v1 · UI-ITER-2-archive-v1)
- Schema additions in velite.config.ts + lib/content/**
- Branching renderer additions in components/WorldlineGlobe.tsx
- This SAVE-POINT-2026-05-17.md
- All Phase 2 handoffs in `.claude/handoffs/from-*/`

---

## §7 · NEXT-POLARIS RESUME PROTOCOL

When Peat opens new session:

1. **Read this file first** · understand current state
2. **Check STATUS.md** · for TASK ledger
3. **Greet** in calm-axis Thai register (default · don't shift)
4. **Surface Peat-pending decisions** from §3 above
5. **If Peat says continue Phase 2** → dispatch §4 queued items in order
6. **If Peat introduces new directive** → standard Polaris orchestration (decompose · dispatch · track)
7. **Don't redebate locked decisions** in §2

### resume from a clear state · what to greet with

Suggested opener (Thai · calm-axis · Peat-default):
> "ตื่นแล้ว · session ก่อนหน้าปิด Phase 2 wave essentially complete · 3 prototypes shipped (ATLAS lock · ARTICLE :8732 · ARCHIVE :8733) + Sirius branching renderer merge-ready · Algol audit APPROVE-WITH-NOTES · Peat-pending: browse prototypes + breathing amplitude tune + Q-A v1.1 variant treatment · เดินต่อจุดไหน"

---

*polaris · α-OPS-00 · 2026-05-17 · session save-point · written before Peat clears chat · Phase 2 wave closure documented*
