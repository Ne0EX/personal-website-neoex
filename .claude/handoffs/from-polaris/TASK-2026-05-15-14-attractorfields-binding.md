# TO · Betelgeuse (α-VIS-04, the Red Sentinel)
# FROM · Polaris (α-OPS-00)
# TASK · TASK-2026-05-15-14
# TYPE · TASK CONTRACT
# CREATED · 2026-05-15
# MODEL TIER · opus (rubric: cross-system mechanic across 3 components + S;G cosmology binding)

---

## scope

Author the design spec for the **AttractorFields ↔ Globe ↔ Divergence binding mechanic**. Three systems coupled directly per S;G cosmology:

- **Divergence** — which-worldline the visitor is currently observing (the α reading; site's current value `1.130426`)
- **AttractorFields** — narrative-mass pulling effect (the field that gathers related entries / pulls camera / weights NeX orbit positions)
- **Globe** — spatial coordinates (the canonical ontology v1.3 strata: surface · orbit · axis, co-present)

These are not three separate features. They are facets of one mechanic. The spec must show how a change in one *forces* a change in the others (binding contract).

## Peat's globe-strata decision (2026-05-15)

**Resolved to OPTION (b)** of DEV-PLAN-D.1.1: proceed with v1.3 strata model — co-equal, simultaneously rendered, no toggle. The v1.3 ontology IS the answer; the document is canonical. Toggleable framings in current `WorldlineGlobe.tsx` are LEGACY and will be retired per the migration plan. Your binding mechanic must assume the v1.3 renderer as the target.

## canonical inputs (READ FIRST — non-negotiable)

1. **`docs/prds/00-globe-ontology-1.2.md` v1.3** — the strata ontology IS the Globe model
   - §1.1 lines 27–44 · co-present, co-equal, no toggle
   - §"This ontology supersedes" lines 614–650 · migration plan + what is REMOVED (strata toggle buttons, camera-mode hiding)
   - §5 · prominence rule, axis legibility
   - §6 · edge types (`diverged_from` / `merged_with` / `collapsed_into` / `adjacent`) — directly relevant to AttractorFields edge rendering
2. **`docs/design/journey-architecture.md` v1.2** — §2 (Globe), §3 (entry surfaces), §6 (strata + fork reframing)
3. **`.claude/handoffs/from-polaris/FEEDBACK-2026-05-15-peat-on-betelgeuse-design.md`** — Peat's PoC-vs-design feedback. Three locked direction shifts to fold in:
   - **earth-textured Globe** (real continents visible; coordinate-space is geographic) — visual base layer constraint
   - **orbital network feel** (lines connecting nodes; relationships rendered as visible edges) — informs AttractorFields-membership visualization directly
   - **transparency revealing Ne0N axis** (visitor sees through to the inner axis) — Peat called this "genuinely beautiful"; keep & evolve
4. **Worldline Globe v7.html** — Peat's Globe-focused design reference. NOT currently extracted. Use `scripts/fetch-design-bundle.sh` if URL still live; otherwise check Peat's `~/Downloads/` (ask Polaris to relay). If unobtainable, proceed without — your spec is text + ASCII diagrams, not pixel-perfect reproduction.

## deliverables

`docs/design/14-attractorfields-binding.md` — primary spec, organized as:

1. **§1 The three-body binding** — what couples to what, with directional arrows + diagram
2. **§2 Divergence as global state** — how α (1.130426) reads, propagates, drives field strength; relationship to `OBSERVER_NODES`
3. **§3 AttractorFields formal model** — data model (what is an attractor), membership semantics, strength computation, how it renders (edges? glow? weighted positions on the NeX orbit?)
4. **§4 Globe rendering contract under v1.3** — co-equal strata are *always* rendered. Document what left rail does in the new world (camera-focus aid only? removed entirely? Peat-decision-required-here-with-recommendation)
5. **§5 Binding semantics** — concrete worked examples: when visitor clicks an article (NeX orbit), what happens to AttractorFields? When AttractorFields shift, what does the camera do? When α drifts, what visually changes?
6. **§6 Motion contracts** — frame budgets, easing curves, what's animated vs. what's instant; reuse tokens from journey-arch §2.x where possible
7. **§7 Anti-Codex audit (21-row template)** — reference fidelity, token compliance, pattern reuse, a11y, mobile, motion, etc.
8. **§8 Migration impact on `WorldlineGlobe.tsx`** — high-level (Sirius's later impl TASK consumes this; do not write code)
9. **§9 Open questions for Peat** — anything you cannot resolve from inputs

## constraints

- **Do NOT modify** `components/WorldlineGlobe.tsx` — Sirius territory; this TASK is spec-only
- **Do NOT propose new design tokens** — token TASKs are separate
- **Do NOT design new surfaces** — β/γ/δ specs are queued separately and consume your binding output
- **Honor v1.3 ontology strictly** — no covert reintroduction of toggleable framings. If you need a left-rail mechanic, it must be a camera-focus aid that *never hides* strata, or recommend removal
- **Stay under 800 lines** — denser than journey-arch (635). This spec is more mechanical than architectural

## harness protocol

- Step 0 · run `pre-task.sh "TASK-2026-05-15-14"` BEFORE first edit (per WORKFLOW.md kickoff)
- Run anti-Codex audit per §10 of journey-arch as you draft (self-check; Algol cross-checks after)
- Sign with `sign-work.sh`; expect post-D3 clean attribution
- Return handoff at `.claude/handoffs/from-betelgeuse/TASK-2026-05-15-14--to-polaris.md`

## acceptance criteria

- All 9 sections present
- v1.3 ontology constraints honored throughout (auditor will check §1.1 + §"This ontology supersedes" compliance line-by-line)
- FEEDBACK directions visibly folded in (earth-textured / orbital network / transparency) — flag explicitly where in the spec each was applied
- Anti-Codex audit 0 FAIL (partials acceptable with explanation)
- Signature v2 clean, both gates green
- Algol audit ready to cross-check on completion (per D.3.3 standing rule — Algol stall recovery applies)

## downstream impact

This spec unblocks:
- **TASK-16** · globe-ontology v1.3 reconciliation revision (Betelgeuse sonnet)
- **TASK-09 (β)** · article entry spec — consumes binding for NeX orbit click semantics
- **TASK-10 (γ)** · photo entry + atlas — consumes binding for surface stratum interaction
- **TASK-11-S2 (δ-UI)** · NETRA chat UI — consumes binding for chat-event ↔ Globe coupling

The 3× Betelgeuse-sonnet parallel wave (β/γ/δ) launches immediately after your signature lands.

---

*polaris · α-OPS-00 · 2026-05-15 · TASK-14 unblocked by Peat globe-v1.3 confirmation "ทำ 1.3 STRATA"*
