# section D · risks and clarifications

> Author · Polaris (α-OPS-00) · instance D of root-Polaris parallel deployment
> Source-of-truth date · 2026-05-15
> Sibling sections · 01-tasks-by-prd (A) · 02-* (B) · 03-* (C)
>
> Scope guard · this section names risks + open clarifications. It does NOT propose new TASKs. Polaris-A owns the TASK roster.

---

## D.1 unresolved Polaris↔Peat conversations (block downstream work)

These items are NOT in journey-arch §13 (all 9 flags there are resolved). They surface from cross-document comparison and from Algol's audit trail.

### D.1.1 globe-ontology v1.3 divergence — strata co-equal vs toggleable
- **flagged by** · Betelgeuse, journey-architecture.md §0 ground rule #2 + §12 non-goal
- **what's unresolved** · `00-globe-ontology-1.2.md` v1.3 §1.1 declares the three strata (Ne0 / NeX / Ne0N) **co-equal and co-present in the same scene · "none is hidden behind a toggle."** The running `WorldlineGlobe.tsx` treats strata as **four camera framings (ALL / NeX / Ne0N / Ne0) toggled by left-rail buttons + keys 1/2/3/0/ESC.** journey-arch §6 records the as-shipped behavior; it does NOT reconcile the ontology. v0.1 of the ontology has the same co-equal language — this is not a regression, it is a never-closed gap.
- **recommended question to Peat** · "Which is canonical for v1: (a) treat the ontology v1.3 §1.1 'co-equal, no toggle' clause as forward-aspirational and ship toggleable framings, updating the ontology with a v1-shipped clause; (b) revise the Globe to render all three strata simultaneously and demote the left rail to a camera-focus aid; (c) hybrid — strata data is always co-present (pins/edges/axis always rendered) but camera framings remain as an attention aid?"
- **downstream impact if not resolved** · γ (TASK-10 photo entry) and the future Globe-mechanics TASK both inherit this ambiguity. Pin/glyph rendering rules (square photo, circle article, diamond fiction) work either way, but motion/visibility contracts diverge. AttractorFields TASK-14 binding inherits it most acutely — binding-to-what depends on whether all strata are always visible.

### D.1.2 PRD-02 curation-map "first-stratum-touched" rule — implementation contract
- **flagged by** · journey-arch §6.1 (Polaris hybrid accepted by Peat)
- **what's unresolved** · The curation map is preserved as "a passive default-active rule keyed on the visitor's first stratum choice in the session." No PRD owns the rule's exact behavior table (ChapterIndex ordering, AttractorFields default, ATLAS default stratum × Ne0/NeX/neutral). Sirius will block at implementation time without a contract.
- **recommended question to Peat** · "Do you want this rule lifted into a tiny micro-PRD (or appendix to PRD-02 even though the fork screen is killed), or is it acceptable for Polaris to draft the 3×N rule table and have you ratify in handoff?"
- **downstream impact** · low at design-wave; medium at implementation wave.

### D.1.3 mobile prototype-phase delegation — review cadence
- **flagged by** · journey-arch §3.6 prototype-phase notice + §7 delegation
- **what's unresolved** · Peat delegated mobile design to Betelgeuse for prototype-based decision. journey-arch §7.1 breakpoint table is current best-defensible, not locked. Pinch-zoom flag #9 implicitly resolved by this delegation. No checkpoint defined for when Betelgeuse's prototype gets reviewed and the table locked.
- **recommended question to Peat** · "Do you want the mobile prototype reviewed inline by Betelgeuse and shipped, or do you want a review handoff to you before §7 is locked?"
- **downstream impact** · γ photo entry mobile spec (TASK-10) targets the 880/600/375 table; if the table moves, γ moves.

---

## D.2 known meta-bugs not yet TASK'd

### D.2.1 self-signature paradox
- **caught by** · Algol during TASK-13 audit prep, before her last 600s watchdog stall (STATUS.md TASK-13 closure note)
- **symptom** · A signature file's own path in `files_touched` can never have its `hashes.files_sha256[<self>]` match `sha256(file-on-disk)` because the file contains its own `self_hash` field that was computed BEFORE being embedded in the file. Structural, not an agent error.
- **workaround options recorded by Algol** · (a) exclude own signature from `files_touched`; (b) document the structural exception in SCHEMA.md; (c) two-pass sign (write file → compute final hash → write a small sidecar with the final hash).
- **owner** · Canopus (sign-work.sh + SCHEMA.md territory)
- **risk if untouched** · every future signature that includes its own path produces an unavoidable INTEGRITY-PARTIAL, polluting the audit trail and conditioning the team to ignore real integrity failures.

### D.2.2 three audit-rail stubs need real implementations
- `scripts/audit-next-api.sh` — needs Algol Next 16 API audit logic; Canopus wraps
- `scripts/audit-voice.sh` — needs Arcturus voice spec + Algol audit logic; Canopus wraps
- `scripts/audit-a11y.sh` — needs Lighthouse runner; Algol authors; Canopus wraps
- All three are currently honest stubs (exit 0 + TODO message) and pass harness-check trivially. They are NOT enforcing anything.
- **risk** · false-green signal. Anyone reading `harness-check` output sees `STUB-PASS` and may forget the rail is dormant. Three real audits live or die on this work.

### D.2.3 visual-capture.sh parked
- Deferred for separate TASK since TASK-06 (STATUS.md known infrastructure gaps section).
- Status quo: `scripts/fetch-design-bundle.sh` covers the Path-A path; Playwright MCP covers Path-B; visual-capture.sh as originally scoped is not currently required.
- **risk** · low while Path-B holds. If Playwright MCP wiring breaks (e.g., chromium upgrade), Path-A bundle script is the only fallback and visual-capture.sh remains the documented-but-absent recovery tool.

### D.2.4 pre-existing eslint inline-hex edge cases
- **history** · TASK-05 added `.claude/worktrees/**` to eslint globalIgnores. TASK-07 added `.claude/visual-diffs/**` for the same class. The pattern repeats: harness-adjacent artifacts trip lint.
- **risk** · the next harness-adjacent directory (e.g., `.claude/visual-diffs/main-poc-2026-05-15/`, `.claude/hook-logs/`) may surface the same class of failures and stall a future post-edit gate. Canopus owns; tag for follow-up at next post-edit failure.

---

## D.3 Algol audit deviations (3 stalls)

### D.3.1 what happened
TASK-13's audit station experienced **three consecutive 600s-watchdog stalls** (Canopus TASK-13 work-end stall + 2 Algol audit retry stalls). STATUS.md TASK-13 DEVIATION block records the pattern. Polaris-verified work product via direct file inspection + smoke tests instead. The model classifier earlier in session also returned "temporarily unavailable" — suggests transient platform issue, not Algol persona malfunction.

### D.3.2 what this violated
The standing rule `feedback_algol_qa_cross_check` requires Algol QA cross-check on every closed TASK. TASK-13 closed with Polaris-only verification. Documented in STATUS.md as known deviation; not fabricated.

### D.3.3 verification plan going forward
- **next medium-sized TASK** (likely TASK-14 AttractorFields binding by Betelgeuse, or TASK-09 article entry spec by Betelgeuse) — re-attempt Algol audit cross-check. If it lands cleanly, deviation is platform-transient; close it.
- **if Algol stalls again** · break the audit into smaller scopes (per-section, not per-TASK) so each Algol dispatch is under the threshold that triggers the 600s deliberation moment.
- **if 3+ consecutive medium-TASK Algol audits stall** · escalate to Peat for tooling change (possibly a non-subagent verification script Polaris runs herself).
- **interim measure** · Polaris already implemented tighter Algol dispatch prompts in the retry pattern; keep this active.

---

## D.4 PRD discards (things explicitly NOT in v1)

Recorded here so future readers do not relitigate.

- **PRD-02 hard fork screen** · DISCARDED per flag #7 confirmation (journey-arch §6 reframe). The stratum chooser IS the fork. *Do not propose a fork screen again without a Peat reopen.*
- **HeroBlock tagline swap per stratum** · REJECTED (Peat 2026-05-15, journey-arch §6.3). Tagline stays static.
- **Nav link reorder per stratum** · REJECTED (Peat 2026-05-15, journey-arch §6.3). Order stays fixed.
- **Fiction entry surfaces** · DEFERRED per flag #5 with Polaris decision rule (journey-arch §3.4): open follow-up TASK for `Nav: FICTION` if `content/fiction/ > 3` OR newcomers struggle.
- **Return dashboards (stages 12* / 13)** · DISCARDED per flag #3 + M-RETURN decision. No return dashboards in v1; the Globe itself is the return signal. Boot dismissal via click-anywhere / any-key.
- **`/log` and `/feed` Ne0 index variants (stages 06 / 07)** · DISCARDED (journey-arch §9). `ChapterIndex.tsx` already serves the index role.
- **NeX Index Board scatter projection (stage 09)** · DEFERRED (journey-arch §9). Parked experiment, not load-bearing for v1.
- **Article Entry Thai variant (stage 01B)** · DISCARDED FOR V1 (journey-arch §9). `--font-thai` not wired; depends on Procyon.

### D.4.1 reversal worth flagging — fiction-on-Globe IS in v1
Flag #4 was earlier read as "fiction deferred"; the 2026-05-15 REVERSAL (journey-arch §13) puts fiction glyphs (short story + novel, diamond glyph) on the Globe in v1, while fiction **entry surfaces** remain deferred. This distinction is easy to relitigate. Future readers: glyphs IN, dedicated pages/routes OUT.

---

## D.5 v1 scope edges — definition of done for the design wave

### D.5.1 surfaces that must exist
1. **Globe (A.T.L.A.S. frame)** · already implemented; pin glyph extension for photos (square) + fiction (diamond) ships within γ + Sirius implementation TASK.
2. **β · article entry page** (TASK-09 spec → later Sirius impl)
3. **γ · photo entry + `/photos` + `/photos/<roll>`** (TASK-10 spec → later Sirius impl)
4. **δ · NETRA chat drawer + prompt architecture** (TASK-11 S1 Arcturus opus + S2 Betelgeuse sonnet)
5. **TASK-14 AttractorFields ↔ Globe ↔ Divergence binding mechanic** (Betelgeuse opus, blocking β/γ/δ dispatch)
6. **Nav stratum-indicator** (journey-arch §3.6 — Sirius implementation)
7. **Mobile collapse per §7 breakpoint table** (Betelgeuse prototype validation, then Sirius implementation)

### D.5.2 surfaces explicitly out of v1
Search overlay (PRD-04) · Boot revisions (stages 10/11/12) · fiction routes · Thai article variant · `/log` and `/feed` indices · NeX scatter board · return dashboards.

### D.5.3 audits that must pass
- territory + design-tokens rails enforcing (already real)
- next-16-api + voice + a11y rails moved from STUB-PASS to real (D.2.2 dependency)
- Lighthouse a11y ≥ 95 per surface (β / γ / δ / mobile prototype)
- no raw hex / rgba in shipped components (existing audit)
- every signed TASK has Algol cross-check (post D.3 stabilization)

### D.5.4 demo path — what Peat walks a visitor through
1. Land on `/` · boot plays (~2.5s, dismissible) · A.T.L.A.S. visible
2. Pick a stratum (left rail or 1/2/3/0) · camera framing animates · Nav indicator updates
3. Click a pin · side panel preview → READ ENTRY → entry page (β)
4. Click a photo glyph · photo entry (γ) · roll context strip · film-sim affordance
5. Open NETRA (N button bottom-left) · drawer slides in · ask a question · streamed reply
6. ESC closes drawer · return to Globe · stratum preserved
7. Mobile (≤600px) · ATLAS · STANDBY card → `[OPEN ATLAS ↗]` → /atlas full-viewport Globe
8. Search · `/` hotkey or `⌕ TRIANGULATE` nav link · overlay opens · results + mini-globe

If any step is missing on the day Peat demos, v1 is not done.

---

## D.6 platform risks (not team-side)

### D.6.1 600s watchdog
- Hard limit. Long deliberation moments without streamed tokens trip it.
- Mitigations already in place: tighter Algol dispatch prompts; Polaris-verify fallback documented.

### D.6.2 transient model-classifier unavailability
- Observed once in TASK-13 session.
- No mitigation; not in our control. Monitor incidence rate.

### D.6.3 recommendations
- Keep heavy audits scoped narrowly (per-section, not full-TASK) when possible
- Polaris-verify is acceptable fallback when stalls hit ≥3 consecutive; document deviation
- If pattern persists into TASK-14 / 15, escalate to Peat for tooling reconsideration
- Track per-session stall count in STATUS.md or AUDIT.md (currently informal)

---

## D.7 cost ledger — opus overrides this session

Per `project_model_tier_dispatch` memory · opus override requires rubric match (multi-surface system synthesis · novel direction · cross-PRD reconciliation).

| TASK / slice | agent | tier | rubric match | outcome |
|---|---|---|---|---|
| TASK-06 S2 · rendered review | Betelgeuse | opus | multi-surface system-level review of 22 images across 13 stages | DONE · 7 source findings reverified + 7 new (N1–N7) · signed ef5cf6f5 |
| TASK-08 · journey-architecture | Betelgeuse | opus | novel-direction multi-surface synthesis (Globe + entries + NETRA + mobile + search + 13-stage inventory) | DONE · 635 lines · 21-row audit · 0 FAIL · signed 427b82dd · audited 8d88240a |
| TASK-14 (planned) · AttractorFields binding | Betelgeuse | opus | cross-system mechanic (AttractorFields ↔ Globe ↔ Divergence — S;G cosmology binding) | QUEUED · blocks β/γ/δ |

Rubric verification: all three opus overrides are warranted. TASK-08 and TASK-14 both require multi-surface reasoning that sonnet would fragment.

Future opus likely needed (NOT yet executed):
- **TASK-11 S1 · Arcturus · NETRA prompt architecture** — full prompt + tool surface + refusal taxonomy + context-injection + rate-limit copy. Single-surface but high-novelty, no PoC reference. Rubric match: opus likely warranted; sonnet acceptable if Arcturus shows strong baseline. Final call at dispatch time.

No unwarranted opus overrides logged. Cost discipline intact.

---

## D.8 next priority decisions Peat owes

Concise checklist · ordered by blocking weight.

1. **globe-ontology v1.3 reconcile direction** (D.1.1) — blocks TASK-14 framing + Globe mechanics TASK + γ
2. **mobile prototype review cadence** (D.1.3) — blocks γ mobile spec lock
3. **PRD-02 curation-map "first-stratum-touched" rule** (D.1.2) — blocks ChapterIndex/AttractorFields implementation
4. **Approval to dispatch TASK-15 onward wave** — pending root-Polaris consolidation of sections A/B/C/D into the dispatchable plan
5. **Approval to retry Algol cross-check on next medium TASK** (D.3.3) — needed to close the standing-rule deviation
6. **Whether the 3 stub audit rails (D.2.2) should be promoted before or after the per-surface specs ship** — sequencing call; affects how many TASKs run in parallel

---

*polaris · α-OPS-00 · instance D · 2026-05-15 · DEV-PLAN section D · risks and clarifications*
