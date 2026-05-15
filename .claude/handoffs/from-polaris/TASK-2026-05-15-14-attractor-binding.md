---
task_id: TASK-2026-05-15-14
from: polaris
to: betelgeuse
date: 2026-05-15
priority: critical
model: opus  ← per-task escalation
parent_directive: Peat 2026-05-15 reframed #2 from defer to design TASK + globe-ontology v1.3 WIN decision + Polaris-A §A.2 critical path
predecessors:
  - journey-architecture.md v1.2 §2 Globe mechanics + §6 audience fork reframing
  - FEEDBACK-2026-05-15-peat-on-betelgeuse-design.md (earth-textured Globe + orbital network + left-rail PoC + Worldline Globe v7.html reference)
  - PRD-00 globe-ontology v1.3 (now canonical per Peat 2026-05-15 — strata co-equal)
---

# TASK-2026-05-15-14 · AttractorFields ↔ Globe ↔ Divergence binding mechanic

## scope

The single most-architecturally-important design TASK in the v1 wave. Three components on the live PoC (DivergenceMeter, Globe/ATLAS, AttractorFields) currently exist as independent surfaces. Per Peat's Steins;Gate-rooted cosmology:

- **DivergenceMeter** = which worldline we're on (1.130426 = current locus)
- **AttractorFields** = events with narrative mass that pull and hold the worldline in place
- **Globe** = the spatial coordinates of those events + the geometry of the worldline

The three are NOT independent — they bind directly. **Your job is to design that binding mechanic.** Sirius cannot implement until this spec exists.

## input

Read in order:
1. `docs/design/journey-architecture.md` v1.2 in full (your own document at the canonical state)
2. `docs/prds/00-globe-ontology-1.2.md` v1.3 (Peat declared this canonical 2026-05-15 — strata Ne0/Ne0N/NeX are CO-EQUAL peers, NOT children of FULL-Ne0EX union)
3. `docs/prds/00-globe-ontology.md` v0.1 (for context on what's superseded — the original §0 distillation framing)
4. `docs/prds/prd-03-photo-atlas.md` + `prd-03-photo-atlas-deep-dive.md` (photos are the surface stratum's primary content)
5. `.claude/handoffs/from-polaris/FEEDBACK-2026-05-15-peat-on-betelgeuse-design.md` (Peat's visual feedback on PoC vs your prior design — earth-textured Globe wins, orbital network wins, left-rail PoC wins, viewing-point + transparency + node-display all keep)
6. Existing components for current state: `components/WorldlineGlobe.tsx`, `components/DivergenceMeter.tsx`, `components/AttractorFields.tsx`
7. Live PoC: `localhost:3000` if dev server is running (start with `npm run dev` if needed)
8. Optionally fetch `Worldline Globe v7.html` from the Claude Design bundle via `scripts/fetch-design-bundle.sh` for Globe-direction reference (URL may have expired; ask Peat if 404)

## Peat's design tweaks bundled into this TASK

Encode these explicitly in your output:

- **CUT** the `012 ACTIVE | 047 OBSERVATION` counter row from HeroBlock area (Peat 2026-05-15: "ยังไม่จำเป็นตอนนี้"). DivergenceMeter stays. Hero title stays. Counter-row disappears in v1.
- Globe must remain earth-textured (real continents visible), not abstract sphere
- Globe's orbital connections between nodes must convey a NETWORK quality (lines/web/relationships visible) — not just points-on-sphere
- Left rail logo treatment follows PoC convention (not whatever Worldline Pages v1 stages proposed)
- Globe transparency revealing Ne0N axis is a KEEP (Peat liked this in your prior work)
- Node-per-content-type glyph system (§2.2 article=circle, photo=square, fiction=diamond) is a KEEP — extends naturally to the binding mechanic

## required document structure

**Output:** `docs/design/attractor-binding-mechanic.md` (new file, your territory under `docs/design/**`)

OR append as a new §11 in `docs/design/journey-architecture.md` if you prefer the single-document approach. Your call as the author. Polaris recommends separate file for v1 because it's a substantial mechanic that deserves its own canonical doc + the journey-arch is settled at v1.2.

Sections required:

### §1 the cosmology — what binds what

The S;G-rooted semantic model spelled out for implementers:
- Divergence = scalar on [0, ∞) read off the worldline's drift from α
- Attractor = a tagged narrative cluster (categorical mass) — coffee, AI/ML, narrative, japan, etc.
- Field = the gravitational pull of an attractor — strength varies by attractor population
- Globe coordinate = where in 3D space each entry sits (lat/lon for photos, computed-orbital for articles/fiction)
- Strata (co-equal per v1.3) = Ne0/Ne0N/NeX as peer layers; FULL-Ne0EX is a VIEW that unions all three, not a parent

How they bind:
- Picking an attractor field in `AttractorFields.tsx` → Globe re-renders to highlight nodes WITHIN that attractor + show inter-node edges that exist within the attractor (this is the "orbital network feel" Peat asked for)
- The DivergenceMeter responds to the picked attractor: the worldline α 1.130426 is conceptually "in this attractor's field," so the meter could (a) show stability indicator (locked when deep in field), (b) drift indicator (when across multiple fields), or (c) just sit static (simpler v1). YOUR DECISION which of these reads correctly for v1.
- Picking a stratum (Ne0/Ne0N/NeX) → Globe filters to that stratum's content type. Attractor selection composes on top of stratum.

### §2 binding contracts (the three pair-wise interactions)

- **AttractorFields ↔ Globe**: when attractor X is picked → Globe (a) keeps full earth + stratum-current rendering as base, (b) overlays orbital network: lines connecting nodes within attractor X, (c) dims nodes not in attractor X, (d) animates the transition (motion calibration per anti-Codex spec — 200-300ms selected-state)
- **AttractorFields ↔ DivergenceMeter**: spec what the meter does when an attractor is picked vs all attractors active. v1 choice: minimal — stays static with the worldline reading. Document the FUTURE extension where meter responds dynamically.
- **Globe ↔ DivergenceMeter**: meter reads the current worldline (axis through globe). When user rotates globe to inspect another locus, meter does NOT change (worldline stays the observer's, not the rotated point's).

### §3 surface vocabulary additions

What's new on the rendered surfaces:
- Attractor "field strength" indicator (text? icon? both?) — minimal v1
- Edge style for inter-node lines (dashed? solid? color? width?)
- Dim-state for out-of-attractor nodes (opacity? saturation? both?)

### §4 states — the exhaustive state machine

For each combination of (stratum chosen, attractor chosen, hover state, rotated state) — what the Globe renders. Polaris-A's critical path expects TASK-19 Globe integration to derive from this — so the state machine must be implementation-ready.

### §5 motion calibration

Per anti-Codex 6-point gauntlet — all transitions specified with timing + easing. Specifically:
- Attractor pick transition (overlay appears): 200-300ms
- Stratum switch: 300-500ms
- Globe rotation (continuous): non-blocking, user-driven
- Edge animation on attractor select: stagger by node-count, capped at 500ms total

### §6 mobile collapse (per §7 of journey-arch + Peat mobile-delegate)

How does the binding mechanic survive at 880/600/375? On mobile-list-primary, attractors become a horizontal pill grid above the list; Globe peek shows binding via a smaller mini-Globe variant. Or other treatment — your decision per the prototype-phase mobile authority.

### §7 implementation handoff to Sirius

Specific contract for downstream:
- Component-level: which components touch which (probably WorldlineGlobe.tsx for the network rendering, AttractorFields.tsx for selection state, a new lib/state hook for binding glue)
- State shape: zustand store or similar with selected attractor, selected stratum, current worldline reading
- API of the binding hook: what Sirius's components call

### §8 anti-Codex audit on every decision

Run your own 6-point gauntlet (reference fidelity, token compliance, pattern reuse, a11y, mobile, motion). Zero FAILs required; partials documented.

### §9 §13 update

If you write to journey-architecture.md (append §11 approach), update §13 with a one-line "TASK-14 binding mechanic spec landed; see §11". If you write a separate doc, cross-reference both ways.

## non-goals

- Do NOT implement any code (this is a spec; Sirius does code in later TASKs)
- Do NOT redesign the strata themselves (v1.3 ontology is canonical; you encode binding for THAT ontology)
- Do NOT design new tokens (token harmonization is a separate parked TASK)
- Do NOT spec NETRA chat integration with the binding (orthogonal; NETRA stays in its drawer per §4 journey-arch)
- Do NOT spec search overlay binding (orthogonal; search is §8 journey-arch + TASK-40)

## acceptance

- New `docs/design/attractor-binding-mechanic.md` OR new §11 in journey-architecture.md
- All 9 sections substantive (not "TBD")
- Anti-Codex audit table present
- Mobile section addressed per Peat-delegation
- Signature v2, both gates green
- Algol audit per standing rule (this is a medium-substantive TASK — good test of whether Algol audit pattern recovers from the 3 stalls; PREP file optional based on platform state)

## sign

Run pre-task.sh first per WORKFLOW Step 0:
```bash
WL_TASK_ID=TASK-2026-05-15-14 WL_AGENT=betelgeuse bash .claude/hooks/pre-task.sh TASK-2026-05-15-14 betelgeuse
```

Sign:
```bash
WL_AGENT=betelgeuse WL_NEXT=polaris WL_SUMMARY="AttractorFields ↔ Globe ↔ Divergence binding mechanic spec (TASK-14 opus)" bash .claude/hooks/sign-work.sh TASK-2026-05-15-14
```

Return handoff at `.claude/handoffs/from-betelgeuse/TASK-2026-05-15-14--to-polaris.md`.

Update STATUS.md: close TASK-14 with self_hash.

## opus override rationale (for the model audit ledger)

Per `project_model_tier_dispatch` memory rubric:
- novel-direction multi-component system-level synthesis ✅
- ties together 3 existing components into a new mechanic ✅
- requires reading 6+ artifacts (PRDs + journey-arch + persona + components + live PoC) ✅
- defines downstream contracts for Sirius implementation ✅
- 4th opus override this session, all rubric-warranted

## dependencies

Globe-ontology v1.3 decision (resolved 2026-05-15). No further blockers. Parallel-safe with TASK-22 (Procyon territory).

## deadline

ASAP. Critical path: this TASK blocks TASK-09 (β article), TASK-10 (γ photo), TASK-11-S2 (δ-UI chat), TASK-16 (globe-ontology reconcile), TASK-19 (Globe integration), TASK-31 (photo entry), TASK-33 (square glyph), TASK-63 (two-step entry).

---

*polaris · α-OPS-00 · 2026-05-15*
