# TO · Sirius (α-SUR-01, Frontend Engineer)
# FROM · Polaris (α-OPS-00)
# TASK · TASK-2026-05-15-26
# TYPE · TASK CONTRACT (DRAFT · **BLOCKED-ON-PEAT-DECISION**)
# CREATED · 2026-05-15
# MODEL TIER · sonnet (rule-table + Nav indicator wire — no architecture novelty)

---

## **BLOCKED-ON-PEAT-DECISION** · gate before any work begins

### Gate · PRD-02 curation-map "first-stratum-touched" rule contract

Per DEV-PLAN-D §D.1.2: the curation map is preserved as session-passive default ("first-stratum-touched"
keys ChapterIndex ordering, AttractorFields default, ATLAS default). **No PRD owns the rule's exact
behavior table.** Sirius cannot implement without it.

Additional unresolved tension surfaced post-DEV-PLAN: STATUS.md Peat decision #2 (2026-05-15) declared
**"ChapterIndex SORT = chronological ALWAYS · NOT stratum-dependent"** and noted "curation map applies
to Globe node rendering (relationships), NOT to ChapterIndex sort order." This **contradicts** the
DEV-PLAN-A TASK-26 framing that the curation map "keys ChapterIndex ordering."

Two unanswered questions for Peat before this TASK can dispatch:

1. **Scope of the curation map under the revised rule** · If ChapterIndex sort is always chronological,
   what surface does the first-stratum-touched rule key against? Candidates per journey-arch §6.1 +
   STATUS.md #2:
   - (a) ATLAS default framing (Ne0 / NeX / Ne0N) on first session entry
   - (b) AttractorFields default-active attractor on stratum entry
   - (c) Globe node prominence (which pins glow at idle in each stratum)
   - (d) some combination
2. **Rule-table format Peat will ratify** · DEV-PLAN-D recommended either a tiny micro-PRD or a
   Polaris-drafted 3×N rule table ratified in handoff. Which path?

### next action · Polaris (root) surfaces decision request to Peat

This contract opens with the gate. **Do not draft past it.** Once Peat answers, root-Polaris encodes
decisions and re-issues this contract with concrete rule-table + Nav indicator scope.

---

## scope (provisional · gated by decision above)

Implement curation map as session-passive default (whatever surface(s) Peat scopes) AND Nav
stratum-indicator (`· STRATUM Ne0` in head bar) per journey-arch v1.2 §3.6.

> **Note**: Per DEV-PLAN-A §A.2 + STATUS.md, Nav stratum-indicator is filed separately as TASK-62
> (`TASK-2026-05-15-62-nav-stratum-indicator.md` already exists). This TASK-26 may shrink to
> curation-map-only depending on Peat's #1 answer above. Coordinate at dispatch time.

## canonical inputs (READ FIRST — non-negotiable, once unblocked)

1. **Peat's decision answer** (TBD — gate above) — root-Polaris will fold into this contract
2. **`docs/design/journey-architecture.md` v1.2** §6 (strata reframing) + §6.1 (curation map hybrid
   acceptance) + §3.6 (Nav stratum-indicator)
3. **`docs/design/attractor-binding-mechanic.md`** (TASK-14) — relationship between stratum default
   and AttractorFields default-active attractor (§4 state machine)
4. **`lib/content/` accessors** (TASK-22) — typed access to Article / Photo / Fiction collections
5. **`components/ChapterIndex.tsx`** — current sort behavior (chronological per STATUS.md #2)
6. **`components/Nav.tsx`** — existing nav component to extend with stratum indicator (or coordinate
   with TASK-62 if separately filed)

## deliverables (provisional · gated)

- `lib/curation/first-stratum-touched.ts` — pure-fn rule applying Peat's ratified rule table
  - inputs · session state (first stratum visited), current stratum
  - output · whatever surface the rule keys (per answer #1 above)
- localStorage write/read at `wl:first-stratum-touched` (single key, immutable for session)
- Wire into whichever component(s) Peat scopes (ATLAS / ChapterIndex relationships / AttractorFields default)

## constraints (provisional)

- **Do NOT modify** `components/WorldlineGlobe.tsx` — serialization point; not this TASK's scope
- **Do NOT modify** ChapterIndex sort order — Peat #2 locked chronological (STATUS.md)
- **Do NOT** reintroduce the fork screen — PRD-02 hard fork is DISCARDED (D.4)
- All localStorage writes hydration-safe (read on client only)
- All colors via CSS vars, no raw hex
- Honor `prefers-reduced-motion`

## harness protocol (when unblocked)

- Step 0 · `bash .claude/hooks/pre-task.sh TASK-2026-05-15-26 sirius`
- sign with `WL_AGENT=sirius WL_NEXT=polaris WL_SUMMARY="curation map first-stratum-touched (TASK-26)" bash .claude/hooks/sign-work.sh TASK-2026-05-15-26`
- return at `.claude/handoffs/from-sirius/TASK-2026-05-15-26--to-polaris.md`

## acceptance criteria (provisional)

- Rule table implemented matches Peat's ratified spec exactly
- First-stratum write occurs once per session (immutable after first write)
- Hydration-safe (no SSR mismatch)
- Surface affected by the rule visibly responds on first session entry
- territory + design-tokens rails green
- Signature v2 clean
- Algol audit ready per standing rule

## downstream impact

Unblocks:
- v1 demo path step 2 (stratum-aware default behavior on first land)
- residue of PRD-02 closed (per Peat's hybrid acceptance journey-arch §6.1)

---

*polaris · α-OPS-00 · 2026-05-15 · TASK-26 draft contract (META-2 pre-stage) · **GATE OPEN***
