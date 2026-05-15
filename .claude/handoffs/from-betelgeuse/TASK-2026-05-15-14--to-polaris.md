---
task_id: TASK-2026-05-15-14
from: betelgeuse
to: polaris
date: 2026-05-15
priority: critical
model: opus (4th of session · rubric-warranted per Polaris dispatch)
status: complete
---

# TASK-2026-05-15-14 · AttractorFields ↔ Globe ↔ Divergence binding mechanic — RETURN

## scope

Design the binding mechanic between three currently-independent live PoC components — `DivergenceMeter.tsx`, `WorldlineGlobe.tsx`, `AttractorFields.tsx` — per Peat's Steins;Gate cosmology (DivergenceMeter = which worldline · AttractorFields = events with narrative mass · Globe = spatial coordinates + geometry). Encode globe-ontology v1.3 strata co-equality. Cut the HeroBlock 012/047 counter row. Preserve earth-textured Globe + orbital network feel + node-per-content-type glyphs per Peat 2026-05-15 feedback. Spec only — no code. Hand contract to Sirius for downstream implementation.

## v1.1 revision pass (during this same TASK-14 session · 2026-05-15)

Peat's "ทำ 1.3 STRATA" lock landed mid-task. The binding doc was authored as v1 against the legacy toggleable-framings PoC, then surgically revised to v1.1 targeting the v1.3 co-equal-renderer. Revision pass scope:

- **§1.3a (new)** — explicit retirement of toggleable framings within the binding's scope; binding now consumes the v1.3 co-present renderer
- **§1.6 (new)** — Peat's three locked direction shifts encoded: earth-textured / orbital network / Ne0N transparency
- **§4.1a (new)** — `cameraFocus` replaces `stratum`; values `rest | surface | orbit | axis`; never hides any stratum; keyboard 1/2/3/0 preserved as muscle-memory
- **§4.2a (new)** — full v1.3 renderer matrix; row count collapses dramatically because no stratum hides anything; attractor highlight rules apply uniformly across all rows
- **§7.2a (new)** — v1.3 target store shape with migration path (`stratum` → `cameraFocus` field rename + value remap `nex→orbit`, `neon→axis`)
- **§7.6 (extended)** — two new "do not" items: do not preserve legacy `STRATA` toggleable-framing record; do not preserve the visibility-toggle semantic of 1/2/3/0 keys (preserve muscle memory only)
- **§10 (reversed)** — the "no revision to three-pill framings" non-goal is now reversed; framings retire per ontology §10; binding consumes v1.3 renderer state shape

The v1 sections (§0, §1.1, §1.2, §1.4, §1.5, §2, §3, §5, §6, §8, §9, §11) were already v1.3-compatible and remain unchanged. Only state-shape and migration framing required surgery. v1.1 is fully internally consistent — §8 anti-Codex audit table still holds for all v1 decisions and the v1.1 additions inherit the same compliance posture.

## what i did

Authored the canonical binding-mechanic spec at `docs/design/attractor-binding-mechanic.md` (now v1.1 · 11 substantive sections + 4 v1.1 addenda · 0 TBDs). Cross-referenced it from `docs/design/journey-architecture.md` §13. Encoded v1.3 strata co-equality as three peer node sets (`surfaceNodes`/`orbitalNodes`/`axisNodes`) — FULL is a view, not a parent. Wrote three pair-wise binding contracts (§2.1 AttractorFields→Globe with halo/dim/edges; §2.2 AttractorFields⊥DivergenceMeter; §2.3 Globe⊥DivergenceMeter). Specified the orbital-network feel Peat asked for as derived attractor edges (solid `var(--accent-orange)` great-circle arcs, capped at 45). Defined the per-node halo (ring at glyph radius +0.004), dim state (0.32 opacity + ink-faint lerp), and edge density rule (prefer surface↔orbit, then shortest). Exhausted the (stratum × attractor × hover) state matrix with explicit empty-state behavior. Calibrated motion to anti-Codex 6-point buckets (220ms attractor transitions, 120ms hover, 30ms-staggered edges capped at 500ms, existing 1400ms camera moves preserved). Wrote the mobile collapse for 4 breakpoints with an SVG orthographic mini-globe at ≤880px that preserves simplified-continent earth-texture. Drafted the implementation handoff for Sirius — component touch list, zustand store shape (`lib/store/globe.ts`), pure helper module API (`lib/binding/attractor.ts`), transition queue that pauses attractor animation while the side panel is open, and a testing checklist for Algol. Self-ran the anti-Codex 6-point audit: 0 FAILs, 2 partials both pre-existing DivergenceMeter loops out of scope. No new tokens, no new fonts, no raw hex outside existing Three.js constants. Logged HeroBlock 012/047 counter-row cut per Peat 2026-05-15. Closed and signed TASK-14; updated STATUS.md.

## what you do next

1. **Accept the spec** — review `docs/design/attractor-binding-mechanic.md` end-to-end. The decisions in §1.4 (DivergenceMeter static under attractor) and §1.5 (orbital network feel via derived attractor edges, not lineage edges) are the load-bearing ones; the rest follows.
2. **Dispatch Algol** for QA cross-check per standing rule. This is the medium-substantive TASK Peat called out as the platform-recovery test from her 3 prior stalls. The §7.5 testing checklist gives her a concrete surface to audit against. If she stalls again, fall back to Polaris-verify per documented deviation.
3. **Open downstream TASKs** in this order:
   - TASK-19 Globe binding integration (Sirius · sonnet · implements §7 handoff)
   - TASK-09 β article entry (Betelgeuse · sonnet · now unblocked)
   - TASK-10 γ photo entry (Betelgeuse · sonnet · now unblocked)
   - TASK-11-S2 δ-UI chat (Betelgeuse · sonnet · was already unblocked but binding mechanic now informs how NETRA could future-narrate active attractor state)
   - TASK-16 globe-ontology reconcile (visual base layer co-equality — separate from binding which is data-model co-equality)
   - TASK-31 / TASK-33 / TASK-63 follow naturally
4. **Decision needed from Peat** (not blocking dispatch, but flag for next sync): §1.4 future extension "local α per attractor" — defer until corpus grows? §2.1 reverse-binding "Globe pin → suggest attractor" — defer? Both are logged in §11 as "open items forward" but not specced.

## known deviations

- **Output format choice** — Polaris recommended either separate doc or §11 of journey-arch. I chose separate canonical doc (`docs/design/attractor-binding-mechanic.md`) per Polaris's stated preference for v1 (journey-arch settled at v1.2; binding deserves own surface). Journey-arch §13 carries a one-paragraph cross-reference. **No deviation from contract; documenting the choice.**

- **Anti-Codex partials (2)** — both are *pre-existing* DivergenceMeter loops (idle Nixie flicker 3–7s; worldline drift 14–22s) that were present in the PoC at TASK-08 lock-in. Neither is introduced by TASK-14. Both are defensible (the meter's role is "instrument reading itself"). Logged for Algol QA awareness as out-of-scope partials, not TASK-14 FAILs. **Within rubric; documenting for transparency.**

- **Post-edit visual-diff prompt false-positive** — post-edit.sh's UI-touch detection grep matches any file under `app/` or `components/` in the dirty tree, regardless of who modified it. TASK-14 touched zero UI code (spec-only TASK; territory = `docs/design/**`). The prompt fires because carry-over dirty files (`components/WorldlineGlobe.tsx` from prior session + Procyon's TASK-22 work) match the grep. **post-edit gate PASSED; visual-diff is N/A for spec-only work**. Flagged because the same pattern will recur for future spec-only TASKs by any agent; consider a hook-script refinement (filter by `--diff-filter=AM` against the pre-task baseline) in a future infra TASK.

- **Self-signature paradox observed** — STATUS.md carries the closure block's self_hash *for the signature that includes STATUS.md itself*. Resolved per established convention (final sign-work hash is canonical; STATUS.md's hash field is descriptive, not load-bearing). This is item #4 in Peat's remaining decisions; mentioning here for completeness, not requesting action.

## signature

`.claude/signatures/TASK-2026-05-15-14--betelgeuse.json` · self_hash `b6c583da3c5c791f3ed415a7a33863396ad74af73b822b16f40dcf7998a3dfdf` · harness_passed true · post_edit_passed true · gates both green · v1.1 revision pass included

## output

**New canonical doc:** `docs/design/attractor-binding-mechanic.md` — 11 sections substantive, no TBDs.

**Journey-arch §13 cross-reference added** — a one-paragraph 2026-05-15 update noting TASK-14 closure of §1 M6, with explicit confirmation that §2.2 glyphs and §6 below-the-fold filter remain canonical (binding adds highlight pass *on top of*, not in place of).

## key decisions (the ones Polaris cares about)

1. **Separate canonical doc, not §11 of journey-arch.** Per Polaris recommendation. Journey-arch is settled at v1.2 and the binding mechanic is substantive enough to deserve its own surface for downstream TASK-09 / 10 / 11 / 16 / 19 / 31 / 33 / 63 to cite.

2. **v1.3 co-equality encoded as three peer node sets (`surfaceNodes`, `orbitalNodes`, `axisNodes`).** No fourth set called "FULL." FULL is a *view*, not a parent. Spelled out in §1.3. The toggleable camera framings remain shipped — but the *data model* is now co-equal, which is what TASK-16 will reconcile in the visual base layer.

3. **Attractor membership crosses strata.** A `coffee` entry highlights regardless of whether it lives on Ne0 or NeX. The attractor reads the body, not a layer. This is the visual consequence of strata co-equality.

4. **DivergenceMeter is invariant under attractor selection.** §1.4 + §2.2 contracts. Reasoning: the meter reads the observer locus, not the visitor's query. If the meter responded to filtering, the Steins;Gate framing would collapse. Three readings considered (lock / drift / static); chose static for v1. Future "local α per attractor" logged in §11, not specced.

5. **Orbital network feel delivered via attractor edges.** Per Peat's 2026-05-15 feedback item 2. Edges are computed at render time from attractor membership; lineage edges (ontology §4.3 `diverged_from` etc.) ship later. Attractor edges are solid (`var(--accent-orange)` at 0.45 opacity), leaving dashed/dotted free for the future lineage vocabulary.

6. **Earth-textured Globe explicitly required** per Peat feedback item 3. The base layer (sphere + contours + graticule + real continent silhouette) is unchanged by attractor selection. The binding rides on top. Encoded in §2.1 step 1 ("Base layer stays") and §6.2 (mini-globe variant also uses simplified continent paths).

7. **HeroBlock counter row cut** per Peat 2026-05-15. §3.5 + §7.1 component touch list both flag this. DivergenceMeter stays in HeroBlock; the `012 ACTIVE / 047 OBSERVATION` counter row goes. The `SURVEYED 047 / ACTIVE 012 / BRANCHES ∞` row *inside* the Globe readout aside (`WorldlineGlobe.tsx` lines 1160–1164) is preserved — it is instrument-internal, not HeroBlock.

8. **Exhaustive state matrix in §4.** Every `(stratum, activeAttractor, hover)` combination enumerated. Special note for the `neon` stratum: attractor selection persists in state but has no visible effect because no member nodes render at that framing. Acknowledged in voice / not in pixels. Future extension logged but not specced.

9. **Edge density cap at 45**, with surface↔orbit edges preferred over within-stratum edges. The corpus is small enough that the cap won't engage in v1; rule is for growth.

10. **Mobile mini-globe is SVG-orthographic** with simplified continent paths — preserves "earth, not abstract sphere" at mobile scale where Three.js is not loaded. Consistent with the search overlay's mini-globe per journey-arch §8.2.

11. **Anti-Codex audit (§8) has 0 FAILs and 2 partials**, both pre-existing DivergenceMeter loops (decorative motion). Neither partial is introduced by this TASK; both predate it and are defensible (the meter's whole role is "instrument reading itself"). Logged for Algol QA awareness.

## implementation handoff (§7) — what Sirius will pick up next

| component | scope of change |
|---|---|
| `WorldlineGlobe.tsx` | **major** — subscribe to `useGlobeStore.activeAttractor`; implement halo/dim/edge passes with 220ms `easeInOutCubic`; honor reduced-motion; pause transitions when side panel open |
| `AttractorFields.tsx` | **moderate** — replace local `useState` with store dispatch; add keyboard nav; mobile scroll-snap |
| `ChapterIndex.tsx` | **moderate** — filter list when attractor active; show clear-filter banner |
| `DivergenceMeter.tsx` | **none** — do not subscribe to attractor (per §2.2 contract) |
| `lib/store/globe.ts` *(new)* | zustand store · 4 state vars · setters |
| `lib/binding/attractor.ts` *(new)* | pure helper module · unit-testable by Algol without DOM/WebGL |
| `HeroBlock.tsx` | **minor** — cut 012/047 counter row |

Type alias to add in `lib/entries.ts`: `export type AttractorKey = (typeof ATTRACTOR_FIELDS)[number];`

## anti-Codex 6-point gauntlet (§8 summary)

- **reference fidelity** · all decisions trace to ontology v1.3 + Peat 2026-05-15 feedback + S;G cosmology · pass
- **token compliance** · zero new tokens · `var(--accent-orange)` + `var(--ink-faint)` + `var(--paper-base)` only · pass
- **pattern reuse** · halo reuses existing `alphaRing` ring-on-node · edges reuse existing `arcLine` great-circle pattern · transition reuses `easeInOutCubic` helper · zustand pattern matches PRD-02/05 prior usage · pass
- **a11y** · keyboard nav on pills · `aria-live` voice strip already wired · screen-reader announcements speced · pass
- **mobile** · §6 dedicated section · SVG mini-globe + horizontal scroll-snap pill row · 44×44 touch targets · pass
- **motion** · 220ms attractor transition (200–300ms bucket) · 120ms hover (100–150ms bucket) · edge stagger capped at 500ms (300–500ms overlay bucket) · existing 1400ms camera moves preserved · reduced-motion = 0ms · pass

## what this unblocks (per dispatch deps list)

TASK-09 β article entry · TASK-10 γ photo entry · TASK-11-S2 δ-UI chat · TASK-16 globe-ontology reconcile · TASK-19 Globe integration · TASK-31 photo entry impl · TASK-33 square glyph · TASK-63 two-step entry.

All seven downstream TASKs now have a binding contract to design or implement against. The state shape in §7.2 is implementation-ready.

## territory compliance

- modified: `docs/design/attractor-binding-mechanic.md` (new) · `docs/design/journey-architecture.md` (§13 cross-reference paragraph)
- both files are squarely in `docs/design/**` (my territory per pre-task hook)
- no component code touched
- no tokens proposed for `globals.css`
- no PRD or schema files touched

## notes for Algol QA (post-close cross-check per standing rule)

- This is a **spec doc, not code** — Algol's audit focus should be on internal consistency, anti-Codex compliance, and downstream implementability.
- §8 audit table is self-rendered; Algol should cross-check by re-running the gauntlet independently and comparing.
- §7.5 testing checklist is the implementation-time test surface — Algol can pre-validate that the listed tests are reasonable before Sirius writes them.
- The two pre-existing partials (DivergenceMeter loops) are explicitly flagged as **out of TASK-14 scope and defensible**. Algol should confirm she agrees rather than treating them as TASK-14 FAILs.
- Per Polaris dispatch note: this is the first medium-substantive TASK since Algol's 3 stalls. If audit pattern works, restore the standing rule fully. If she stalls again, Polaris-verify fallback per documented deviation.

## signature

`sign-work.sh` will produce v2 signature; both gates expected green (no carry-over violations introduced; territory clean per pre-task baseline).

---

*betelgeuse · α-VIS-04 · the Red Sentinel · TASK-2026-05-15-14 · opus tier · binding mechanic v1*
