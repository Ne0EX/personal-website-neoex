# Soul Baseline Audit · Consolidated

> Owner · Polaris (α-OPS-00) · merging SBA-1 + SBA-2 + SBA-3
> Trigger · VISION-FIDELITY.md §11 item 1 · 2026-05-15
> Status · CANON v1.0 — locked direction for all brand-bearing work going forward

---

## 1 · The unified soul statement

**Worldline is a paper instrument that contains a surveyed archive.** The Globe is the archive's body (not its decoration). NETRA is the archive's navigator (attached to the instrument bay). Peat is present through the instrument layer — α, divergence, observer locus, surveyed nodes — not through a biography card.

The three baselines align on this:

- **main branch web** preserves the paper/ink palette, three-font hierarchy (Cormorant / JetBrains Mono / Special Elite), corner reticles, dashed hairlines, marginalia, scroll-meter, DivergenceMeter, ATLAS frame, ChapterIndex / AttractorFields rhythm
- **Worldline Globe v7.html** preserves the soul depth: aged-paper procedural texture, three co-present spatial systems visible through each other (surface · axis · orbital shells), surveyed nodes at real GPS with narrative reasons, live NETRA reticle / range readouts, signal-flow sequence (EMITTED → BORNE → ARCHIVED → NAVIGATED with NETRA last)
- **character bible** (`docs/prds/00-netra-character.md`) preserves NETRA as librarian-witness with two registers (instrument · companion), not as a chatbot persona

---

## 2 · Three source documents

| section | author | file | lines |
|---|---|---|---|
| visual canon | Betelgeuse (α-VIS-04) | `docs/team/.soul-baseline/visual.md` | 582 |
| voice canon | Vega (α-VOX-08) | `docs/team/.soul-baseline/voice.md` | 402 |
| NETRA/instrument canon | Arcturus (α-NET-05) | `docs/team/.soul-baseline/instrument-netra.md` | 135 |

These are the source-of-truth for what each dimension preserves. Read those for full evidence. This file consolidates the cross-dimensional findings + Polaris action queue.

---

## 3 · Polaris-prioritized action queue (cross-section synthesis)

### TIER A · IMMEDIATE FIX (today's rendered surfaces)

**A1 · `WorldlineGlobe.tsx:106` NETRA default voice line (Vega T5)**
- Current breaks instrument register with UI-help text
- Vega supplied corrected copy at hand
- Assignment: **Sirius · string change only, no logic change**
- Patch:
  - from: `"standing by, ne0ex aggregate in view. cycle ⟶ JUMP, click any pin, or strike 1 / 2 / 3 to enter a stratum."`
  - to: `"standing by · ne0ex aggregate in view. any node anchors the reticle. keys 1 · 2 · 3 narrow to a stratum."`

**A2 · `WorldlineGlobe.tsx:1265-1298` article panel aria-label (Vega T6)**
- `aria-label="Close article"` → `aria-label="close entry"`
- Batch with A1 in same Sirius dispatch

### TIER B · TASK CONTRACT RE-CUTS (before any further dispatch)

| TASK | revision needed | source flag |
|---|---|---|
| TASK-11-S2 chat UI | **3-layer NETRA placement** (Peat 2026-05-15) — re-cut DONE this turn | SBA-3 Path 2 + Peat decision |
| TASK-31 photo entry impl | film-strip border subordinate to EXIF readout block | SBA-1 F3 |
| TASK-40 search overlay | voice contract: `SURVEY ARCHIVE` not "SEARCH"; not "No results found" — instrument-coordinate empty state | SBA-1 F4 + SBA-2 T1 |
| TASK-41 Pagefind impl | visual comp review before Sirius implements | SBA-1 R3 |
| TASK-09 article entry | dossier surface (not blog post); FILE number + coordinates + status before title; "article" never as visible copy | SBA-2 T3 |
| TASK-60 responsive system | ATLAS STANDBY card label check; mobile DivergenceMeter | SBA-1 F6 + SBA-2 T2 + R4 |
| TASK-61 ATLAS STANDBY card impl | link explicitly to VISION-FIDELITY §6 loss budget; 375px render check | SBA-1 R4 |
| TASK-16 → TASK-19 v1.3 renderer | rendered checkpoint at 1180px showing 3 co-present layers before close | SBA-1 R5 |

### TIER C · NETRA PERSONA RECONCILIATION (recovery item #4)

Per Arcturus SBA-3 §5(a) — produce **runtime split** per character bible §13.2:

- **C1** · `docs/netra-runtime-rules.md` (~500 words, prompt-injectable) — Arcturus drafts · Vega register-reviews
- **C2** · voice.md v1.0.0 §6 "ATLAS bay instrument spec" — claim reticle/range/target/jump as NETRA territory (Arcturus owns)
- **C3** · explicit lock: instrument register = ATLAS bay; companion register = chat surface; visually connected, not separate

**Replaces draft system prompt in PRD-05** which contained `"outside the worldline. no signal."` as out-of-archive refusal — character bible §10.2 + voice.md §3.2 both prohibit in companion context. Canonical replacement: `"that sits outside the archive. i can't see it from here."`

### TIER D · TASK-11-S1 (NETRA system prompt · Arcturus opus likely) — constraints baked in

3 constraints Arcturus SBA-3 §5(c) identified — pre-staged for δ-S1 dispatch when Arcturus available:

1. Refusal phrase correction (use companion register replacement)
2. Tool-call status: 2-line instrument block (`SURVEYING ARCHIVE · search_entries(...)` then `resolved · 3 entries · 124ms`) before companion reply
3. "no trace surveyed" must remain terse — no apology opener, no expansion

### TIER E · GATING (downstream dependency)

**E1 · TASK-50 chat surface not visitor-accessible until velite cache populated** — Procyon dependency check before NETRA chat launches publicly. Per character bible §8.4: NETRA returning `no trace surveyed` for empty content is correct behavior; but visitors will read this as broken feature.

---

## 4 · Forbidden patterns (cross-section blocklist)

### Visual (SBA-1)
- film-strip-as-frame-identity (border must be subordinate to instrument)
- two-column "SaaS search modal" layout
- floating chat surface decoupled from instrument console
- mobile flat-text without paper-canvas / dashed borders / reticles
- toggleable stratum framings reintroduced (v1.3 co-present is canonical)

### Voice (SBA-2)
- marketing verbs (discover · explore · unlock · transform · empower · journey · curate · showcase)
- generic CTAs (read more · learn more · click here · find out more · get started)
- second-person flattery ("you're going to love" · "designed for you")
- biography cards ("Hi, I'm Peat...")
- chatbot framings ("How can I help you today?" · "Ask me anything")
- emoji-as-affordance (instrument glyphs `◎ ◇ ⟶ ∇` are not emoji — those are allowed)
- SaaS status labels (draft · published · archived · pending) — replaced by lifecycle metaphors (seed · ongoing · refined · settled)
- SaaS structural labels (Dashboard · Feed · Profile · Settings)

### NETRA / instrument (SBA-3)
- L1 instrument console retired or vestigial
- right-edge drawer decoupled from instrument (Path 3 — current TASK-11-S2 draft, NOW SUPERSEDED)
- chatbot UX defaults (typing indicators · welcome prompts · "Ask me anything")
- oracle drift (NETRA-as-deep-philosopher — character bible §0 warns against)
- `"outside the worldline. no signal."` in companion context (instrument-only phrase)
- single-line tool-call status (must be 2-line instrument block then companion)
- NETRA full-presence takeover on landing page (Peat 2026-05-15)

---

## 5 · Allowed evolution (soul preserves)

- TEAL ink (`31 80 99`) over navy (`26 40 50`) — palette toggle remains; soul is in contrast ratio + accent-orange, not specific hue
- v1.3 co-present strata renderer — **deepens** soul (three spatial systems always visible)
- Earth-textured Globe (already canonical per attractor-binding v1.1 §1.6)
- Transparency revealing Ne0N axis (Peat-confirmed 2026-05-15)
- Bangkok as instrument-layer presence (UTC+7 clock, `EST. 2026 — BANGKOK / THAILAND` in nav — not biographical)
- NETRA 3-layer architecture: L1 instrument console (canonical) + L2 emergent expansion (tethered to L1) + L3 dedicated full-page route (Peat 2026-05-15)

---

## 6 · Brand-bearing rendering checkpoint (per VISION-FIDELITY §7)

Peat must review checkpoints when:

- Globe / ATLAS renderer changes (TASK-14 binding mechanic ✅ done; TASK-16/18/19 renderer migration pending)
- First viewport changes (Hero, ChapterIndex, AttractorFields — landed; mobile fold pending)
- NETRA placement changes (✅ Peat answered 3-layer 2026-05-15)
- Digital garden navigation model changes (search overlay TASK-40 will trigger this)
- Betelgeuse or Polaris cannot tell if soul survived

---

## 7 · Operating sentence (VISION-FIDELITY §12)

> Agents may compress scope, but must not compress soul.

---

## 8 · Cumulative state at audit time

**Closed today:**
- Phase 0 foundations: TASK-22 velite skeleton · TASK-22-cosign · TASK-22-audit · TASK-25 content bodies · TASK-30 photo pipeline · TASK-21 NETRA voice spec v1.0.0
- Phase 1 design wave: TASK-08 REVISE-2 journey-arch v1.2 · TASK-14 attractor-binding v1.1 · TASK-16 ontology reconcile · TASK-09 β article entry · TASK-10 γ photo entry+atlas · TASK-40 search overlay · TASK-60 responsive system
- Sirius: TASK-62 Nav stratum indicator
- META harness: META-1 next-dispatchable.sh · META-3 STATUS section-lock (no return handoff but on disk) · META-4 checkpoint hook LIVE
- Recovery: SBA-1 + SBA-2 + SBA-3 + BRC (this consolidation)

**Pending Peat-decision-resolved → Polaris-action-needed:**
- 8 META-2 contracts need fidelity-block re-cut (Tier B)
- A1+A2 immediate Sirius fix
- C1+C2+C3 NETRA Persona Reconciliation
- E1 velite gating contract

**Robustness wave queued (META-5..9 contracts drafted):**
- META-5 live-verify META-1/3/4
- META-6 rate-limit detection
- META-7 pre-burst gate
- META-8 fidelity-block enforcement script
- META-9 telemetry rail

---

## 9 · Resume protocol

Future Polaris (or after session break):

1. Read this file FIRST → 90% of state in 5 minutes
2. Then `docs/team/VISION-FIDELITY.md` for the rail
3. Then `docs/team/SAVE-POINT.md` (auto-checkpoint rolling head, META-4 product)
4. Then `docs/team/STATUS.md` (granular TASK entries)
5. Recovery wave is closed; Tier A/B/C are next-action

---

*polaris · α-OPS-00 · soul baseline audit consolidated · 2026-05-15*
