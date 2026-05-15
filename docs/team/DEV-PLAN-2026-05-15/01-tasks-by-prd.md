# DEV-PLAN-2026-05-15 · Section A · TASKs by PRD

> Author · Polaris-A (α-OPS-00 · instance A) · 2026-05-15
> Scope · TASKs decomposed by PRD. Sibling sections cover model-tier audit, ontology divergence, and dispatch order.
> Baseline · 9 journey-architecture flags resolved (v1.2); queued TASKs 09/10/11 unblocked; TASK-14 (AttractorFields binding, Betelgeuse opus) reserved.
> TASK IDs · TASK-15 onward (TASK-14 already claimed).

---

## section A · TASKs by PRD

### PRD-00-globe-ontology.md (v0.1)
**status:** SUPERSEDED-BY-v1.3 (do not implement against this version)
**existing assignment:** none directly; TASK-08 (journey-architecture) cites it as a predecessor
**gaps:** retained only for changelog provenance; conflicts with v1.3 on strata model (toggleable vs co-equal)
**proposed new TASKs:**
- TASK-15 · mark v0.1 as SUPERSEDED, add header pointer to v1.3 · Vega · sonnet · depends on nothing · BLOCKS nothing · S

### PRD-00-globe-ontology-1.2.md (v1.3 — current canonical)
**status:** partial (spec exists; running Globe diverges; reconciliation owed)
**existing assignment:** TASK-08 (journey-architecture) records the divergence; TASK-14 (AttractorFields binding) consumes it
**gaps:**
- `OBSERVER_NODES` → `OBSERVER_AXIS_NODES` migration in `lib/entries.ts` (semantics change: geographic → axis Y-position)
- `edges` frontmatter shape (list of `{type, target, note?}`) not yet wired in velite schemas
- `SITE_EPOCH` / `SITE_HORIZON` constants for date→latitude normalization not defined
- orbit shell radius `k`, lateral-drift tag hash algorithm (§12.1) — pure-fn, needs file + tests
- the strata-co-equal-vs-toggleable divergence flagged (running Globe = 4 camera framings) — **Polaris-D territory**, referenced here for completeness
- privacy-sanitized payload rule (v1.3 hard contract) — affects what the orbit/surface layers ship to client
- repos glyph deferred per journey-arch (out of v1)
**proposed new TASKs:**
- TASK-16 · ontology-v1.3 reconciliation spec (audit running Globe vs v1.3; emit a per-clause delta + cut list) · Polaris (root) → Betelgeuse drafts spec · sonnet · depends on TASK-14 closing · BLOCKS TASK-17, TASK-18 · M
- TASK-17 · `OBSERVER_AXIS_NODES` data migration + `lib/entries.ts` rewrite · Procyon · sonnet · depends on TASK-16 · BLOCKS TASK-19 · M
- TASK-18 · orbit-placement pure functions (`lib/globe/placement.ts`: domain→meridian, date→latitude with epoch/horizon, tag-hash drift) + unit tests · Procyon (pure-fn lib lives in `lib/`) + Algol (tests) · sonnet · depends on TASK-16 · BLOCKS TASK-19 · M
- TASK-19 · WorldlineGlobe.tsx integration of placement + edge rendering (great-circle arcs at k×R, 4 edge styles per ontology §4.4) · Sirius · sonnet · depends on TASK-17, TASK-18 · BLOCKS none in this section · L
- TASK-20 · privacy sanitization rail (build-time scrub of GPS for `share-location: false`; never reaches client bundle) · Procyon (build step) + Algol (rail) · sonnet · depends on TASK-22 (velite skeleton) · BLOCKS PRD-03 surface · S

### PRD-00-netra-character.md
**status:** covered for *voice/character bible* (v1.0 settled); partial for *runtime grounding*
**existing assignment:** TASK-11 S1 (Arcturus opus · system prompt + tool surface + refusal taxonomy)
**gaps:**
- voice-discipline audit rail (currently stub `scripts/audit-voice.sh`) — needs an Arcturus-authored voice spec + Algol TS logic
- companion-vs-instrument register marker convention for MDX/components (so audit can find violations)
- Thai register policy file (Peat-confirmed: ข้า > กู for masc; NB no particle) needs to live somewhere voice-audit can read
**proposed new TASKs:**
- TASK-21 · voice spec + audit logic (Arcturus authors `docs/netra/voice-spec.md`; Algol writes `scripts/audit-voice.ts`; Canopus wraps in `audit-voice.sh`) · Arcturus + Algol + Canopus · sonnet (Arcturus default; opus override not warranted — spec, not prompt arch) · depends on TASK-11 S1 closing · BLOCKS none hard, unblocks rail · M

### PRD-01-entry-pages.md
**status:** partial (specs exist for article β, photo γ; fiction deferred per journey-arch §3.4)
**existing assignment:** TASK-09 (β article spec, Betelgeuse sonnet), TASK-10 (γ photo spec, Betelgeuse sonnet)
**gaps:**
- velite collections + zod schemas for `articles`, `photos`, `fiction` not yet defined in code (specs exist, implementation does not)
- shared entry-page shell component (`components/EntryShell.tsx`) — three templates share header strip / footer / related branches / prev-next
- article body component (MDX + shiki + rehype-pretty-code + marginal sidenotes)
- patches log component (semantic `<ol>`, mono 11px)
- related branches block (reuses ChapterIndex card pattern per journey-arch §3.2)
- migration of `RECENT_ENTRIES` hardcoded array → MDX files in `content/articles/`
- Thai font wiring (`--font-thai` via next/font) — explicitly deferred but tracked
**proposed new TASKs:**
- TASK-22 · velite + collections skeleton (config + 3 zod schemas + content cache emit) · Procyon · sonnet · depends on nothing · BLOCKS TASK-23, TASK-24, TASK-25, TASK-26, TASK-30, TASK-31, TASK-33 · L
- TASK-23 · `components/EntryShell.tsx` + shared header-strip + footer (per journey-arch §3.5 vocabulary) · Sirius · sonnet · depends on TASK-22, TASK-09 closing · BLOCKS TASK-24, TASK-25 · M
- TASK-24 · article entry route `/entries/<fileNum>` + body + sidenotes + patches log + related branches · Sirius (component + route) + Vega (body migrations + copy review) · sonnet · depends on TASK-23 · BLOCKS none · L
- TASK-25 · migrate `RECENT_ENTRIES` → `content/articles/*.mdx` (frontmatter Procyon + body Vega, co-signed per FILE-OWNERSHIP.md) · Procyon + Vega · sonnet · depends on TASK-22 · BLOCKS TASK-24 finalize · M

### PRD-02-audience-fork.md
**status:** DISCARDED — stratum chooser IS the fork per journey-arch §6.1 (Peat confirmed 2026-05-15)
**existing assignment:** none active
**gaps:** N/A — closed surface
**proposed new TASKs:**
- TASK-26 · curation map preserved as session-passive default (first-stratum-touched keys ChapterIndex ordering) + Nav stratum-indicator (`· STRATUM Ne0`) per journey-arch §3.6 · Sirius · sonnet · depends on TASK-22 · BLOCKS none · S
  > This is the *residue* of PRD-02 that Peat accepted from Polaris's hybrid proposal. Not a re-opening of the fork screen.

### PRD-03-photo-atlas.md (the *what*)
**status:** partial — spec γ exists (TASK-10); build pipeline not started
**existing assignment:** TASK-10 (γ photo entry + atlas spec, Betelgeuse sonnet)
**gaps:** same root cause as PRD-03-deep-dive; combined gaps listed there
**proposed new TASKs:** see PRD-03-deep-dive

### PRD-03-photo-atlas-deep-dive.md (the *how*)
**status:** not started in code (spec is detailed; nothing implemented)
**existing assignment:** none in code; γ design spec at TASK-10 covers visual contract
**gaps:**
- `scripts/process-photos.ts` build step (exifr → sharp variants → emit typed records)
- photo velite collection + sidecar `.mdx` discovery
- photo entry route `/photos/<roll>/<id>` with instrument readout + roll-context strip
- `/photos` roll index route
- `/photos/<roll>` single-roll route with contact sheet + SVG mini-map
- Globe square-glyph extension (`pinObjects` discriminated by `kind: 'article' | 'photo' | 'fiction'`)
- lightbox via `yet-another-react-lightbox`
- film-simulation palette switcher (extends existing `data-palette` toggle) — *suggestion affordance*, not auto-apply
- privacy hardening (GPS scrubbed unless `share-location: true`) — covered by TASK-20 rail
- git-lfs decision for binary photos
**proposed new TASKs:**
- TASK-30 · `scripts/process-photos.ts` + photo velite collection + sidecar discovery · Procyon · sonnet · depends on TASK-22 · BLOCKS TASK-31, TASK-32, TASK-33 · L
- TASK-31 · photo entry route `/photos/<roll>/<id>` + instrument readout + roll-context + film-strip border (per γ spec) · Sirius · sonnet · depends on TASK-23 (EntryShell), TASK-30, TASK-10 closing · BLOCKS TASK-33 · L
- TASK-32 · roll index `/photos` + single-roll `/photos/<roll>` (contact sheet + SVG mini-map) · Sirius · sonnet · depends on TASK-30 · BLOCKS none · M
- TASK-33 · WorldlineGlobe.tsx square-glyph extension + photo-pin layer + lightbox integration · Sirius · sonnet · depends on TASK-19 (placement integration), TASK-30 · BLOCKS none · M
- TASK-34 · film-simulation palette suggestion affordance (`[ match palette to CLASSIC CHROME · ⌃P ]`) extending `data-palette` toggle · Betelgeuse (tokens) + Sirius (UI) · sonnet · depends on TASK-31 · BLOCKS none · S
- TASK-35 · git-lfs setup + repo-size policy for `content/photos/**` binaries · Canopus · sonnet · depends on TASK-30 · BLOCKS first photo roll commit · S

### PRD-04-triangulate-search.md
**status:** not started; spec is concrete
**existing assignment:** none (logged as next-wave per journey-arch §9 row 04)
**gaps:**
- Pagefind index build wiring (`postbuild` hook → `/_pagefind/`)
- search overlay component (`/` hotkey + `⌕` nav affordance, full-page modal per journey-arch §8.1)
- SVG mini-globe (NOT Three.js mini-instance — orthographic projection)
- result row: title / type / date / tags / drift-from-α (Bangkok 13.7563°N, 100.5018°E)
- `scripts/generate-feeds.ts` (RSS 2.0 + Atom 1.0 + JSON Feed 1.1 + per-section)
- `<link rel="alternate">` discovery in `app/layout.tsx`
- responsive: mini-globe collapses below list at ≤600px
**proposed new TASKs:**
- TASK-40 · search overlay spec (final design pass against journey-arch §8) · Betelgeuse · sonnet · depends on TASK-22 closing (so search has real content) · BLOCKS TASK-41 · S
- TASK-41 · search overlay implementation + Pagefind wiring + SVG mini-globe + lazy-load client · Sirius (UI) + Canopus (Pagefind build hook) · sonnet · depends on TASK-40, TASK-22 · BLOCKS none · L
- TASK-42 · `scripts/generate-feeds.ts` + 6 feed outputs + `<link rel="alternate">` head injection · Procyon (script) + Sirius (head wiring) · sonnet · depends on TASK-22 · BLOCKS none · M

### PRD-05-netra-chat.md
**status:** partial — δ-S1 (prompt arch) + δ-S2 (chat UI design) specs queued; runtime not built
**existing assignment:** TASK-11 S1 (Arcturus opus · prompt arch), TASK-11 S2 (Betelgeuse sonnet · chat UI design), TASK-11 S3 (cross-agent contract sync)
**gaps:**
- `app/api/chat/route.ts` shell (Altair) — streaming Vercel AI SDK endpoint + per-session rate limit (50/24h, in-memory map keyed on session cookie)
- `lib/netra/prompts/*.ts` + `lib/netra/tools/*.ts` implementations (Arcturus, from TASK-11 S1 spec)
- chat drawer UI implementation (Sirius, from TASK-11 S2 spec) — right-edge drawer, NOT 5th stratum
- zustand chat-history persistence (localStorage, per-session)
- mobile chat (full-width drawer, `dvh` + interactive-widget per journey-arch §4.5)
- chat-endpoint cost ceiling response copy (`α drift exceeded · NETRA dormant until next worldline.`)
**proposed new TASKs:**
- TASK-50 · `app/api/chat/route.ts` shell + rate limit + session cookie · Altair · sonnet · depends on TASK-11 S1 + S2 + S3 closing, TASK-22 (tool calls need content cache) · BLOCKS TASK-51, TASK-52 · M
- TASK-51 · `lib/netra/{prompts,tools}/**` implementation per TASK-11 S1 spec (system prompt module, 5 tool implementations against velite cache, refusal taxonomy) · Arcturus · sonnet (opus only if S1 spec demands; default sonnet) · depends on TASK-50 shell + TASK-22 · BLOCKS TASK-52 finalize · L
- TASK-52 · right-edge chat drawer component + zustand store + streaming render + mobile dvh layout · Sirius · sonnet · depends on TASK-50, TASK-51, TASK-11 S2 closing · BLOCKS none · L

---

## section A.2 · cross-PRD TASKs

TASKs that don't belong to one PRD but unblock multiple. (TASK-22 listed under PRD-01 is the canonical foundational; restated here for visibility.)

- **TASK-22 · velite + content skeleton** · Procyon · sonnet · L · **foundational — BLOCKS most downstream work** (article entry, photo pipeline, search index, feeds, NETRA tool calls). Restated for visibility; primary owner under PRD-01.
- **TASK-14 · AttractorFields binding mechanic** (already planned by root-Polaris) · Betelgeuse · **opus** · L · cross-cuts PRD-00 (orbital placement) + PRD-01 (entry tag binding) + PRD-03 (photo tag binding) — Divergence-meter / AttractorFields / Globe tri-binding per Peat 2026-05-15 reframe of flag #2. BLOCKS TASK-16, TASK-19. Opus justified: novel-direction multi-surface mechanic, no existing pattern to reuse.
- **TASK-60 · responsive system spec + mobile prototype** (Betelgeuse) · sonnet · M · journey-arch §7 left mobile collapse to Betelgeuse for prototype-based decision (per Peat 2026-05-15). Output is a per-breakpoint contract for 880 / 600 / 375 that Sirius implements. Depends on TASK-09/10/11 spec content closing. BLOCKS TASK-24, TASK-31, TASK-52 mobile-layer.
- **TASK-61 · ATLAS · STANDBY placeholder card + `/atlas` route** (per journey-arch §7.2–§7.3) · Sirius · sonnet · S · depends on TASK-60. The mobile-primary surface when Globe canvas is replaced. BLOCKS none.
- **TASK-62 · Nav stratum-indicator implementation** (`· STRATUM Ne0` in head bar; Peat-confirmed hybrid addition) · Sirius · sonnet · S · depends on TASK-22. Tied to TASK-26 curation map. Separate file from curation logic; one slice ≠ one TASK only when ownership splits (FILE-OWNERSHIP.md says Sirius owns components; this is Sirius end-to-end).
- **TASK-63 · two-step entry pattern (preview side panel → full route)** in `WorldlineGlobe.tsx` · Sirius · sonnet · M · depends on TASK-23 (EntryShell exists), TASK-24, TASK-31. Per journey-arch §2.3 — side panel stays as preview; click navigates to entry route. BLOCKS none.
- **TASK-64 · hover preview tooltip + photo/fiction glyph distinctions in `WorldlineGlobe.tsx`** · Sirius · sonnet · M · depends on TASK-19, TASK-33. Closes PRD-01 acceptance for "hover preview" + PRD-03 §3.2 photo glyph + ontology §4.5 fiction ring/diamond. BLOCKS none.

---

## section A.3 · dependency graph (ASCII)

```
                          TASK-22 (velite skeleton · Procyon)          [foundational root]
                                  │
        ┌─────────────────────────┼─────────────────────────┬──────────────────┬─────────────────┐
        ▼                         ▼                         ▼                  ▼                 ▼
   TASK-23 (EntryShell)      TASK-25 (RECENT migrate)  TASK-30 (photo build)  TASK-42 (feeds)  TASK-26 (curation)
        │                         │                         │
        ▼                         ▼                         ▼
   TASK-24 (article route)   ──────────────────────────► (TASK-24 finalize)
        │
        │   TASK-14 (AttractorFields binding · Betelgeuse OPUS) ─────► TASK-16 (ontology v1.3 reconciliation)
        │                                                                    │
        │                                                          ┌─────────┴─────────┐
        │                                                          ▼                   ▼
        │                                                     TASK-17 (axis nodes) TASK-18 (placement fns)
        │                                                          │                   │
        │                                                          └─────────┬─────────┘
        │                                                                    ▼
        │                                                              TASK-19 (Globe integration)
        │                                                                    │
        │                                                      ┌─────────────┴─────────────┐
        │                                                      ▼                           ▼
        │                                                 TASK-33 (square glyph)      TASK-64 (hover + glyph variants)
        │                                                      │
        ▼                                                      ▼
   TASK-63 (two-step entry pattern) ◄────────────────────  TASK-31 (photo route) ────► TASK-32 (roll index)
                                                               │
                                                               ▼
                                                          TASK-34 (palette suggestion)

   TASK-60 (responsive spec · Betelgeuse) ──► TASK-61 (/atlas + STANDBY card)
                                          └─► (gates mobile work on TASK-24 / TASK-31 / TASK-52)

   TASK-11 S1+S2+S3 (NETRA spec wave · queued) ──► TASK-50 (route shell · Altair)
                                              ──► TASK-51 (prompts+tools · Arcturus) ──► TASK-52 (chat drawer UI · Sirius)

   TASK-40 (search overlay spec · Betelgeuse) ──► TASK-41 (search impl · Sirius+Canopus)

   TASK-20 (privacy rail · Procyon+Algol) ──► gates first photo roll publish
   TASK-21 (voice spec + audit) ──► unblocks audit-voice.sh rail
   TASK-35 (git-lfs)  ──► gates first photo roll commit
   TASK-62 (Nav stratum-indicator)  ──► standalone
   TASK-15 (mark v0.1 superseded · Vega) ──► standalone
```

**Critical path (longest single chain to a shippable v1):**
`TASK-09/10/11 (specs close) → TASK-14 (AttractorFields, opus) → TASK-16 (reconciliation) → TASK-18 (placement fns) → TASK-19 (Globe integration) → TASK-33 (photo glyph) → TASK-31 (photo route) → TASK-63 (two-step entry) → v1 photo-on-Globe shippable.`

Estimated L+L+M+M+M+L+M = roughly 7 L/M units on the long pole. TASK-22 (velite skeleton) is foundational but parallelizable with TASK-14, so it does not extend the critical path — it runs underneath.

---

## section A.4 · same-agent parallelism opportunities

The team has multi-instance capability for any agent. Below: explicit moments where 2x or 3x of the same agent works simultaneously on **different files with no shared state**.

**Betelgeuse (already-planned parallel triple) — design wave:**
- TASK-09 (article spec · `docs/design/spec-article-entry.md`)
- TASK-10 (photo spec · `docs/design/spec-photo-entry-atlas.md`)
- TASK-11 S2 (chat UI spec · `docs/design/spec-netra-chat-ui.md`)
- All three are sonnet, all three independent files, all three depend only on TASK-08 closing. **3× Betelgeuse confirmed live.**

**Betelgeuse — post-design-wave second triple (after TASK-14 closes):**
- TASK-16 (ontology reconciliation spec · `docs/design/spec-ontology-v1.3-delta.md`)
- TASK-40 (search overlay spec · `docs/design/spec-search-overlay.md`)
- TASK-60 (responsive spec + mobile prototype · `docs/design/spec-responsive-system.md`)
- All sonnet, all independent files. **3× Betelgeuse second wave.**

**Sirius — implementation parallel triple (after TASK-22 + TASK-23 close):**
- TASK-24 (article route · `app/entries/[fileNum]/page.tsx`)
- TASK-26 (curation map + ordering · `lib/curation/*.ts` + `components/ChapterIndex.tsx` wire)
- TASK-62 (Nav stratum-indicator · `components/Nav.tsx`)
- All sonnet, all independent files. **3× Sirius wave 1.**

**Sirius — implementation parallel double (after TASK-19 + TASK-30 close):**
- TASK-31 (photo route · `app/photos/[roll]/[id]/page.tsx`)
- TASK-33 (Globe square-glyph extension · `components/WorldlineGlobe.tsx`)
- Both sonnet, technically TASK-33 touches WorldlineGlobe.tsx which is delicate — but TASK-31 does not touch it. Clean parallel. **2× Sirius wave 2.**

**Procyon — data-pipeline parallel double (after TASK-22 closes):**
- TASK-25 (`RECENT_ENTRIES` → MDX migration · `content/articles/**` frontmatter)
- TASK-30 (`scripts/process-photos.ts` + photo collection · `scripts/` + `velite.config.ts` photo block)
- Both sonnet, both touch Procyon-only files. **2× Procyon.**

**Arcturus — single-instance only:**
- NETRA prompt + tools is a single coherent surface. Arcturus does not parallelize against herself; she serializes (TASK-11 S1 → TASK-21 voice spec → TASK-51 implementation). Trying to split would fragment the voice.

**Canopus — single-instance preferred:**
- Harness work touches shared `.harness/` config + `.claude/hooks/`. Two Canopus instances editing config files is high-collision. TASK-35 (git-lfs) + TASK-41 search-build-hook can run sequentially with negligible cost.

**Algol — parallel against Algol-as-auditor is structurally always available:**
- Algol audits every signed TASK. That is parallel by construction (one audit per signed task; multiple audits per day).
- Algol also writes audit-script TS logic (TASK-18 tests, TASK-20 rail, TASK-21 voice). These are independent files. **Up to 3× Algol on audit-script TS work** if dispatched simultaneously.

---

*end of section A · Polaris-A signs off · sibling sections continue.*
