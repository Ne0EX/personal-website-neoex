# TO · Betelgeuse (α-VIS-04, the Red Sentinel)
# FROM · Polaris (α-OPS-00)
# TASK · TASK-2026-05-15-11-S2
# TYPE · TASK CONTRACT (**RE-CUT 2026-05-15** per Peat NETRA placement decision + SBA recovery)
# CREATED · 2026-05-15
# MODEL TIER · sonnet (single-surface spec consuming TASK-14 binding + TASK-11-S1 message shape)

> **Supersedes the prior draft** which framed NETRA chat as "right-edge drawer (NOT a 5th stratum)". Arcturus SBA-3 + Betelgeuse SBA-1 + Vega SBA-2 all flagged that framing as soul-dilutive (Path 3 in Arcturus's analysis). Peat lock 2026-05-15 establishes the 3-layer architecture below.

---

## scope

Author the **NETRA UI spec** at `docs/design/spec-netra-chat-ui.md` covering 3 surfaces (L1/L2/L3), not one. The instrument console is canonical; chat is an extension that grows from it.

## vision fidelity

- **soul baseline** · Globe v7.html `frame-foot` NETRA console (instrument bay) + main branch `atlas-netra` console + character bible §4 two-register architecture
- **aesthetic invariants** · I4 (NETRA attached to ATLAS first · primary) + I2 (Globe is body) + I3 (Peat in instrument layer) + I5 (rendered checkpoint mandatory before acceptance)
- **Peat signal** · "NETRA สามารถเป็น chatbot ได้ หมายความว่าเธอควรออกมาจาก A.T.L.A.S ในส่วนที่เป็น GLOBE ได้ แต่ยังต้องมีช่องให้เธอคุยแบบเต็มหน้าโดยเฉพาะจะดีที่สุด เพราะ UI ก็เป็นแบบนั้น การให้เธอมาโผล่ใน landing page แบบเต็มตัวอาจไม่ค่อยดี" (2026-05-15)
- **allowed evolution** · L2 emergent expansion and L3 dedicated route are new surfaces; both grow FROM L1, never replace it
- **forbidden dilution** · L1 retirement; landing-page full-NETRA takeover; right-edge drawer decoupled from instrument; chatbot UX defaults; oracle drift; tool-call status as single-line `Searching...`
- **rendered checkpoint** · L1 + L2 + L3 each need rendered comp (Sirius produces, Betelgeuse + Algol BRC review) before Sirius impl TASKs close

---

## 3-layer NETRA architecture (CANONICAL — Peat lock + SBA convergence)

### L1 · Instrument console (ALWAYS ALIVE)

**Lives in:** ATLAS/Globe canvas (existing `.atlas-netra` CSS + WorldlineGlobe.tsx behavior). NEVER retired.

**Carries:** reticle pulse (2.4s atlas-netra-pulse) · RETICLE/RANGE live readouts via window.__netraUpdate · target name (STANDBY → stratum → node coordinate) · `⟶ NEXT NODE` jump button · companion voice strip per stratum

**Role:** NETRA's primary identity surface. Visitor sees her HERE first. Every other NETRA surface is an evolution of L1.

### L2 · Emergent expansion (tethered to L1)

**Per Arcturus SBA-3 Path 2 — "drawer anchored to instrument":**

- **Origin point** — slides UP from the instrument bay (NOT in from the right edge)
- **Visual tether** — instrument bay remains visible below L2 (not occluded)
- **Behavior persistence** — reticle pulse continues during L2 active; RETICLE/RANGE keep updating
- **Header identity** — `◎ NETRA · [target]` so visitor knows L2 is same system as L1
- **Use case** — brief in-context exchanges (1-3 messages); quick survey/lookup against current Globe state
- **Trigger** — click on NETRA console in ATLAS bay (NOT a floating N button decoupled from ATLAS); if a button is needed, it must be adjacent to or styled consistently with `.atlas-netra`

### L3 · Dedicated full-page route (NEW · Peat 2026-05-15)

**Path:** likely `/netra` or `/chat` (you decide; coordinate with Altair TASK-50 routing)

**For:** sustained conversation (>3 messages or topic depth that L2 cannot comfortably hold); appropriate UI for full conversational flow

**Transition:** visitor in L2 can "promote" to L3 (e.g., "open full transcript" or auto-promote on sustained conversation threshold). The L3 route renders the conversation in a full-page treatment that still carries instrument identity (NETRA target readout, α reference, signal-flow placement).

**Constraints on L3:**
- Still NOT a generic chat drawer or modal pattern
- Layout retains instrument frame vocabulary (corner reticles, dashed hairlines, mono register for system lines, Cormorant for companion prose)
- Header shows instrument identity context — visitor never forgets they're inside Worldline's ATLAS, not a generic chatbot

### FORBIDDEN (Peat + SBA convergence)

- L1 retired or vestigial — kills I4
- NETRA full-presence on landing page (Peat explicit: "การให้เธอมาโผล่ใน landing page แบบเต็มตัวอาจไม่ค่อยดี")
- Right-edge drawer decoupled from ATLAS (Path 3 from Arcturus SBA-3)
- Tool-call status defaulting to "Searching..." or generic spinner

---

## canonical inputs (READ FIRST · non-negotiable)

1. **`docs/team/.soul-baseline/instrument-netra.md`** (Arcturus SBA-3) — read **first**; 3-paths analysis + constraints
2. **`docs/team/.soul-baseline/visual.md`** (Betelgeuse SBA-1) — §1.6 atlas-frame vocabulary; §F5 NETRA console invariant
3. **`docs/team/.soul-baseline/voice.md`** (Vega SBA-2) — chat tool-call labels; companion register rules; aria-label refinements
4. **`docs/team/VISION-FIDELITY.md`** §3 I4 + §4 Feature Insertion Rule + §7 rendered acceptance
5. **`docs/prds/00-netra-character.md`** (character bible) — §4 two-register architecture; §12 trigger system; §13 runtime budget
6. **`docs/design/attractor-binding-mechanic.md`** v1.1 — §5 motion calibration; coupling rules for chat events
7. **`docs/design/journey-architecture.md`** v1.2 §4 NETRA placement — note: §4 right-edge drawer framing is **SUPERSEDED** by this re-cut; you may flag inconsistency for Polaris to resolve in TASK-16-style reconcile pass
8. **`/Users/neospiritth/Downloads/Worldline Globe v7.html`** — v7 NETRA console in `<footer class="frame-foot">` lines 381-386 (instrument bay reference)
9. **`docs/prds/prd-05-netra-chat.md`** — PRD source (but: PRD-05 draft system prompt has out-of-archive refusal violation flagged in SBA-3; do NOT inherit that)
10. **`components/WorldlineGlobe.tsx`** — observe `.atlas-netra` console behavior + voice strip (do NOT modify)

## deliverables

`docs/design/spec-netra-chat-ui.md` organized:

1. **§1 · Architecture** — 3-layer L1/L2/L3 + relationships + forbidden patterns
2. **§2 · L1 instrument console contract** — preserve existing behavior; what spec confirms is canonical
3. **§3 · L2 emergent expansion** — drawer anatomy (anchored to instrument bay, not right-edge), tether requirements, dimensions, motion in/out, ESC behavior, focus trap, mobile collapse
4. **§4 · L3 dedicated route layout** — full-page treatment, instrument frame retention, conversation rendering, transition from L2 → L3
5. **§5 · Message variants** — user · assistant · tool-call display (2-line instrument block then companion per Arcturus SBA-3 constraint 2) · refusal (companion register, never instrument phrase) · streaming · dormant
6. **§6 · Streaming render** — visual treatment, cursor/pulse, reduced-motion fallback
7. **§7 · Input affordance** — input field, send button, Enter vs Shift+Enter, focus ring, disabled during streaming
8. **§8 · Rate-limit / dormant** — `α drift exceeded · NETRA dormant until next worldline.` (instrument register for system state — allowed); placement and treatment
9. **§9 · Motion contracts** — aligned with binding §5 6-bucket
10. **§10 · Mobile (≤600px)** — L2 full-width drawer with `dvh` + interactive-widget; L3 full-page native; touch targets 44×44; **L1 must remain accessible** (ATLAS STANDBY card must keep at minimum NETRA target + reticle indicator)
11. **§11 · a11y contract** — role=dialog · aria-labelledby · ESC behavior · focus trap · screen-reader streaming announcements
12. **§12 · Anti-Codex audit (21-row)** + brand regression rows per `docs/team/BRAND-REGRESSION-CHECKLIST.md`
13. **§13 · Open questions** — anything not resolvable from inputs

## constraints

- **Honor 3-layer architecture strictly** — no covert reintroduction of right-edge-drawer-decoupled or floating-N-button-detached-from-ATLAS
- **Do NOT modify** `components/**` — Sirius territory; this is spec-only
- **Do NOT modify** `app/globals.css` — if new tokens needed (unlikely), surface in §13
- **Do NOT design** the NETRA prompt — Arcturus territory (TASK-11-S1)
- **Do NOT design** the route handler — Altair territory (TASK-50, partial; will be revised after this spec to add L3 route)
- Honor v1.3 Globe ontology (no toggleable strata assumptions)
- Honor attractor-binding v1.1 motion calibration
- **Honor Vega's voice contract**: chat tool-call display is 2-line instrument block (`[instrument] SURVEYING ARCHIVE · search_entries(...)` then `[instrument] resolved · 3 entries · 124ms`) then companion reply — NEVER single-line "Searching..." style
- Stay under 600 lines

## harness protocol

- Step 0 · `bash .claude/hooks/pre-task.sh TASK-2026-05-15-11-S2 betelgeuse`
- Sign: `WL_AGENT=betelgeuse WL_NEXT=polaris WL_SUMMARY="NETRA chat UI spec — 3-layer architecture (TASK-11-S2 RE-CUT)" bash .claude/hooks/sign-work.sh TASK-2026-05-15-11-S2`
- Return at `.claude/handoffs/from-betelgeuse/TASK-2026-05-15-11-S2--to-polaris.md`

## acceptance criteria

- All 13 sections present and substantive
- 3-layer architecture defined per Peat lock + SBA convergence
- L1 invariants preserved (console always alive)
- L2 explicitly tethered to L1 (visual + behavioral connection); right-edge-decoupled path explicitly rejected with rationale
- L3 dedicated route specified with full-page treatment retaining instrument identity
- Tool-call display follows 2-line instrument-block format
- No `outside the worldline. no signal.` in companion-facing context
- Anti-Codex audit 0 FAIL (partials acceptable with explanation)
- Brand regression rows from `BRAND-REGRESSION-CHECKLIST.md` reviewed (PASS / PARTIAL / FAIL per row)
- Mobile section preserves L1 access (ATLAS STANDBY card NETRA element)
- Signature v2 clean (post-D3 attribution)
- Algol audit ready (BRC-extended)

## downstream impact

This spec unblocks:
- **TASK-52** chat surface implementation (Sirius — Sirius will need L1+L2+L3 each as separate sub-slices; consume binding constraints)
- **TASK-50** Altair extension for L3 route (chat API needs to support sustained conversation surface; not just drawer endpoint)
- **TASK-11-S1** Arcturus prompt architecture has tool-call format aligned with §5 here
- Cross-agent contract sync (Arcturus + Betelgeuse + Altair message-shape parity)

## known deviations from inherited PRD/journey-arch

- PRD-05 draft system prompt out-of-archive refusal → flagged for Arcturus TASK-11-S1 correction (not your fix)
- journey-architecture.md v1.2 §4 right-edge drawer framing → superseded by this re-cut. Flag for follow-up reconcile in TASK-16-style note pass.

---

*polaris · α-OPS-00 · 2026-05-15 · TASK-11-S2 RE-CUT per Peat 3-layer NETRA decision + SBA recovery convergence*
