# Worldline Development Plan · 2026-05-15

> Compiled by Polaris (α-OPS-00, root) from four parallel Polaris-subagent deep-dives.
> All four deep-dives signed clean with the post-TASK-13 attribution pattern (the systemic untracked-file signature bug is closed forward).

## table of contents

- [01 · TASKs by PRD](./01-tasks-by-prd.md) · Polaris-A · 245 lines · self_hash `4ac7a499…`
- [02 · per-agent workload view](./02-per-agent-workload.md) · Polaris-B · 235 lines · self_hash `0d228d1c…`
- [03 · E2E test pipeline scope (Algol + Canopus)](./03-e2e-pipeline.md) · Polaris-C · 293 lines · self_hash `d6310a4f…`
- [04 · risks and clarifications](./04-risks-and-clarifications.md) · Polaris-D · 181 lines · self_hash `3d7dc518…`

Total deep-dive material: 954 lines. Read in any order; sections cross-reference each other and the parent journey-architecture.md v1.2.

---

## executive summary

Worldline's design wave is settled (journey-architecture.md v1.2, all 9 flags resolved 2026-05-15). The next development phase decomposes into ~50 TASKs across 8 agents over 3 phases. The plan unblocks every PRD currently in `docs/prds/` (except PRD-02 which is DISCARDED per Peat's #7 decision).

The critical-path constraint is **content schema** (TASK-22 Procyon · velite skeleton) — it blocks Vega and all surface implementations downstream. Open it first.

The single architectural risk that blocks the highest-leverage design TASK is **globe-ontology v1.3 strata divergence** — Polaris-D's lead item that Peat must answer before TASK-14 (AttractorFields binding mechanic) can dispatch cleanly.

---

## phases (Phase 0 → 3)

### PHASE 0 · FOUNDATIONS (Procyon-led)

Sequential because content schema gates everything downstream.

| TASK | scope | agent | model | depends on | blocks |
|---|---|---|---|---|---|
| TASK-22 | velite content skeleton (`content/{articles,fiction,photos}/` + collections + zod schemas) | Procyon | sonnet | — | Vega, all surface impls |
| TASK-30 | PRD-03 deep-dive photo pipeline (sharp + EXIF + variants + schema) | Procyon | sonnet | TASK-22 | TASK-31 photo impl |

Parallel underneath:
| TASK | scope | agent | model | depends on |
|---|---|---|---|---|
| TASK-15 | mark PRD-00 v0.1 as SUPERSEDED | Polaris | n/a | — |
| Peat decision · globe-ontology v1.3 reconcile | conversation | — | — | — |

### PHASE 1 · DESIGN WAVE (Betelgeuse opus-then-fan-out)

Critical mechanic first, then per-surface specs in parallel.

| TASK | scope | agent | model | depends on | blocks |
|---|---|---|---|---|---|
| TASK-14 | AttractorFields ↔ Globe ↔ Divergence binding mechanic | Betelgeuse | **opus** | Peat globe-ontology v1.3 decision (D.1) | TASK-09/10/16/19 |
| TASK-16 | globe-ontology v1.3 reconciliation + revision | Betelgeuse | sonnet | Peat decision + TASK-14 | TASK-18 |

Then 3× Betelgeuse-sonnet parallel:
| TASK | scope | agent | depends on |
|---|---|---|---|
| TASK-09 (β) | article entry spec (PRD-01) | Betelgeuse-1 | TASK-14 |
| TASK-10 (γ) | photo entry + atlas spec (PRD-03) | Betelgeuse-2 | TASK-14 |
| TASK-11-S2 (δ-UI) | NETRA chat UI spec (PRD-05) | Betelgeuse-3 | TASK-14 + TASK-11-S1 |
| TASK-40 | search overlay spec (PRD-04) | Betelgeuse-4 | TASK-14 |
| TASK-60 | responsive system / mobile prototype | Betelgeuse-5 | TASK-14 |

Note: 5x Betelgeuse-sonnet is theoretically parallel but `components/WorldlineGlobe.tsx` is the single-file collision point for downstream Sirius impls (per Polaris-B B.3). Wave 1 dispatches all 5 specs in parallel; impl wave serializes Sirius work.

NETRA prompt arch parallel-but-distinct:
| TASK | scope | agent | model | depends on |
|---|---|---|---|---|
| TASK-50 | chat API route shell | Altair | sonnet | TASK-14 |
| TASK-51 (δ-S1) | NETRA system prompt + tools + refusal taxonomy | Arcturus | **opus** (likely) | TASK-22 + 50 |
| TASK-21 | NETRA character voice spec + audit rail | Arcturus | sonnet | — |

### PHASE 2 · IMPLEMENTATION (Sirius-led)

After specs land. Sirius is the bottleneck — queue depth ~7 incoming + 4 parked. `WorldlineGlobe.tsx` forces serialization at the integration layer.

| wave | TASKs | agent slots |
|---|---|---|
| wave 1 | TASK-24 article-route · TASK-26 curation residue · TASK-62 Nav stratum-indicator | 3× Sirius parallel |
| wave 2 | TASK-31 photo entry · TASK-33 square glyph | 2× Sirius (touch WorldlineGlobe.tsx → serialize) |
| wave 3 | TASK-52 chat drawer · TASK-41 Pagefind impl | 2× Sirius parallel |
| wave 4 | TASK-63 two-step entry transition · TASK-64 hover preview | 2× Sirius |

Each Sirius TASK gates on Algol audit (per `feedback_algol_qa_cross_check` standing rule).

### PHASE 3 · E2E PIPELINE (Algol + Canopus joint)

E2E sets a quality floor before launch. From Polaris-C's section 03 — 5 TASKs:

| TASK | scope | agents | model |
|---|---|---|---|
| TASK-EE1 | Playwright runner + smoke suite + sixth rail | Algol + Canopus | sonnet |
| TASK-EE2 | full E2E test suite covering 9 critical journeys | Algol + Canopus | sonnet |
| TASK-EE3 | visual regression baseline harness (un-park `visual-capture.sh`) | Algol + Canopus | sonnet |
| TASK-EE4 | Lighthouse a11y/perf wrapper + graduate stub audit | Algol + Canopus | sonnet |
| TASK-EE5 | CI workflow at `.github/workflows/e2e.yml` | Canopus | sonnet |

Algol+Canopus collaboration shape detailed in section 03 §C.6 (four handshakes: runner contract, fixture content, visual baselines, Lighthouse graduation).

---

## critical path

```
Peat globe-ontology v1.3 decision (D.1)
    ↓
TASK-22 velite skeleton (Procyon)  ←──── runs in parallel
    ↓                                       │
TASK-14 AttractorFields binding (Betelgeuse opus)
    ↓
TASK-16 globe-ontology reconcile
    ↓
TASK-18 placement functions (Sirius)
    ↓
TASK-19 Globe integration
    ↓
TASK-33 square glyph + TASK-31 photo entry
    ↓
TASK-63 two-step entry transition
    ↓
v1 photo-on-Globe SHIPPABLE
```

Parallel underneath the critical path: NETRA wave (TASK-50/51/52), search wave (TASK-40/41/42), feeds (TASK-42), mobile prototype (TASK-60).

---

## decisions Peat owes (from Polaris-D §D.8)

Blocking-weight ordered:

1. **globe-ontology v1.3 strata divergence** — co-equal vs toggleable framings. BLOCKS TASK-14. **highest priority.**
2. PRD-02 curation-map residue rule (what survives the discard)
3. Mobile prototype cadence (when Betelgeuse hands off mobile spec → Sirius)
4. self-signature paradox fix priority (Canopus task)
5. 3 audit-stub real impls priority (audit-next-api / voice / a11y)
6. Algol stall recovery plan acceptance

Once Peat answers #1 (globe v1.3), TASK-14 unblocks and Phase 1 launches.

---

## same-agent parallelism opportunities (from Polaris-A §A.4 + Polaris-B §B.3)

| wave | parallel slots | TASKs |
|---|---|---|
| Phase 1 wave 1 | 5× Betelgeuse-sonnet | TASK-09 + TASK-10 + TASK-11-S2 + TASK-40 + TASK-60 |
| Phase 1 wave 2 | 3× Betelgeuse-sonnet | TASK-16 + TASK-21 + (any wave-1 carry) |
| Phase 2 wave 1 | 3× Sirius-sonnet | TASK-24 + TASK-26 + TASK-62 |
| Phase 2 wave 2 | 2× Sirius (serialized at WorldlineGlobe.tsx) | TASK-31 + TASK-33 |
| Phase 0 | 2× Procyon-sonnet | TASK-25 + TASK-30 (after TASK-22) |
| Phase 3 | Algol-sonnet || Canopus-sonnet (parallel-by-construction) | All EE TASKs |
| Arcturus | serialized | TASK-51 (likely opus) → TASK-21 |
| Algol audit | parallel-by-construction | every TASK closure routes through her |

Polaris-B identifies **Sirius and Arcturus as the two critical-path single-threads**. Watch for over-queuing.

---

## opus override ledger (from Polaris-D §D.7)

All rubric-warranted per `project_model_tier_dispatch` memory:

| TASK | agent | reason | status |
|---|---|---|---|
| TASK-06 S2 | Betelgeuse | multi-surface 22-image rendered review | ✅ shipped |
| TASK-08 | Betelgeuse | novel-direction multi-surface synthesis (7+ artifacts) | ✅ shipped |
| TASK-14 | Betelgeuse | binding mechanic across 3 components + S;G cosmology | 🟡 planned |
| TASK-51 | Arcturus | NETRA system-prompt architecture (rubric explicit case) | 🟡 likely |

4 opus dispatches across the v1 design wave is well within budget.

---

## E2E philosophy (compressed from Polaris-C §C.1)

E2E for Worldline is unusual: 3D Three.js Globe + MDX content + photo pipeline + build-time feeds + AI chat with streaming. The pipeline tests:
- Browser flows (Boot → Globe → click → entry → back)
- Build-time correctness (content compiles, schemas valid, feeds well-formed)
- Visual regression (screenshot diffs at multiple viewports)
- A11y floor (Lighthouse ≥95 on entry templates per anti-Codex audit §10)
- NETRA chat round-trip (mocked streaming for determinism)

Phased rollout: smoke (1 week post-impl) → regression suite (2 weeks) → perf+a11y+cross-browser (post-launch).

---

## risks (compressed from Polaris-D §D.6)

- **Platform flakiness** — 3 Algol stalls observed this session. Polaris-D's mitigations: tighter prompts (done), pre-staged evidence (done), Polaris-verify fallback documented (done), escalation at 3+ medium-TASK stalls.
- **Three.js render flake in E2E** — Polaris-C §C.11 flagged. Mitigations: deterministic camera state via `window.__worldlineProbe__`, frame-stable screenshot waits, SSIM-augmented diffs.
- **Sirius single-threading on WorldlineGlobe.tsx** — Polaris-B §B.3 noted. Mitigations: spec all Globe-touching TASKs to share contracts; Sirius wave 2 explicitly serialized.
- **NETRA mock drift** — Arcturus's real prompts may diverge from E2E fixture recordings. Mitigations: recorded-SSE snapshots regenerated each release; voice eval rail catches drift.

---

## v1 definition of done (from Polaris-D §D.5)

7 must-exist surfaces:
1. Globe (existing) + stratum chooser + Nav stratum-indicator
2. Boot sequence with click/any-key dismiss
3. Article entry page (one real article shipped)
4. Photo entry page + photo atlas (one real photo set shipped)
5. NETRA chat overlay drawer (one round-trip works)
6. ChapterIndex + AttractorFields functional (with binding mechanic from TASK-14)
7. Search overlay + 3 feeds (RSS + Atom + JSON Feed)

8-step demo path: land → see Globe → pick stratum → click article node → read article → back to Globe → click N → ask NETRA → close → back to Globe.

Audit floor: every entry surface ≥ Lighthouse 95 a11y · territory rail 100% green · design-tokens rail 0 violations.

---

## next action

Peat answers globe-ontology v1.3 strata question (D.1) → Polaris opens TASK-22 (Procyon velite skeleton) **immediately** as Phase 0 kickoff. TASK-14 (Betelgeuse opus) follows once the strata decision is encoded.

All other TASKs queue behind these two.

---

*polaris · α-OPS-00 · root assembly · 2026-05-15*
