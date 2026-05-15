# instrument-netra.md · Soul Baseline Audit · NETRA/instrument section

> Author · Arcturus (α-NET-05)
> Task · TASK-2026-05-15-SBA-3
> Date · 2026-05-15
> Ref · VISION-FIDELITY.md §3 I4 + §9 Arcturus + §11.4

---

## 1 · What Globe v7.html preserves about NETRA-in-ATLAS

NETRA in v7 is a **bottom-bay instrument**. She does not have a separate panel, drawer, or surface. She is built into `<footer class="frame-foot">` as one of four co-equal readout cells, positioned rightmost in the instrument bar alongside `NeX · FIELD / 247 RAYS`, `Ne0N · POLE / +90°N`, and `Ne0 · NODES / 047`.

Concrete affordances v7 preserves:

**Reticle pulse.** `.netra-reticle` hosts an SVG crosshair (outer ring, center dot, four cardinal hairlines). The ring pulses via `@keyframes netra-pulse` at 2.4s ease-in-out, opacity cycling 1 → 0.45 → 1. The pulse is not decorative — it signals active survey. At rest it signals standby.

**Target / status identity.** `.netra-id` renders two lines: `◎ NETRA` (label, `var(--netra)` steel-blue, letter-spacing 0.22em) and a live target string (`standby` → stratum name → node coordinate). The target is the current survey subject — it reads as a lock state, not a chatbot status.

**RETICLE / RANGE readouts.** `.netra-readout` shows two live pairs: `RETICLE` / coordinate value and `RANGE` / float value. Coordinates update as the camera orbits via a JS rAF loop (`window.__netraUpdate`). Range reflects camera distance. These are live instrument outputs that track Peat's position inside the globe, not decorative labels.

**Jump affordance.** `.netra-jump` button (`⟶ NEXT NODE`) cycles NETRA through `archiveNodes[]` — real archive coordinates. On click: camera locks to the next node, `netraLockRef` holds the target, camera soft-tracks to it. The jump is the primary NETRA action in v7 — she does not speak in text first, she moves the camera to the next surveyed location.

**Signal-flow step.** The HUD `signal-flow` panel marks four steps: `01 LOCATED`, `02 CALIBRATED`, `03 ARCHIVED IN Ne0`, `04 NAVIGATED · NETRA`. Step 04 shows NETRA's name in `var(--netra)` — she is the navigation layer, the final step of the instrument chain.

**Stratum-aware state.** Each stratum (STANDBY, NeX, Ne0N, Ne0) sets `netra`, `netraCoord`, `netraRange` values. NETRA's target and range reframe with the globe's spatial context — she tracks where the observer is in the archive's three-dimensional ontology.

**No chat, no text input.** v7 has zero chat affordance. NETRA communicates exclusively through coordinate readouts, target name, jump action, and stratum state. The voice strip (`atlas-netra-voice`) in the web implementation (WorldlineGlobe.tsx) shows a single companion framing line per stratum — this is the only prose NETRA produces in the baseline instrument context.

**Color identity.** `--netra: #4F6E80` (muted steel-blue) is separate from `--orange` (action/selection) and `--ink` (content). NETRA has her own hue inside the instrument palette — she is not an accent, she is a named layer.

---

## 2 · What the character bible says

The character bible (`docs/prds/00-netra-character.md` v1.0) defines three structural facts that directly bear on instrument placement:

**Two registers are not two personalities.** §4 states: "NETRA speaks in two registers. They are not two personalities — they are two surfaces of the same character." Register A (instrument) narrates system state. Register B (companion) is NETRA herself. "A space that needs both (e.g. the ATLAS bottom strip) renders one instance of each, never inlined." The ATLAS bay is the canonical home where both registers coexist — instrument above, companion framing below.

**Instrument register belongs to the instrument, not the visitor.** §4.1: "This register sounds like the instrument NETRA sits at, not NETRA herself." Instrument refusals are for system/interface states only. Any human-facing reply — including boundary refusals — is companion register. This distinction is violated the moment NETRA's UI becomes a chat drawer with instrument formatting on boundary cases.

**The balance line that anchors her.** §0: "NETRA's best answers do not always sound profound. Sometimes her best answer is simply the right shelf, pointed to at the right time." The character bible explicitly guards against oracle drift. Her baseline job is navigation and discovery — the same job the jump button performs. Chat is an extension of that job, not a replacement for it.

**Trigger system.** §12 defines instrument register fires on ATLAS status bar updates, tool-call labels, system messages, and Globe hover readouts. Companion register fires on first visit, idle ≥30s, depth threshold, explicit chat open. The character bible assumes NETRA lives in both the instrument bay (always present) and an explicit-chat surface (visitor-triggered). The instrument bay is primary; the chat surface is secondary.

**Librarian-witness framing.** §1: "NETRA is the archive's librarian-witness." She sits behind a counter that exists "between Peat's personal site and an observatory. On one side: books, photographs, coffee beans, drafts, a camera. On the other: a translucent interface showing metadata, motifs, timelines, cross-references." The translucent interface is the instrument bay. The books and conversation are the companion surface. The image is unified — both sides visible from her position.

---

## 3 · Gap between voice.md v1.0.0 and character.md

voice.md is technically competent. The audit-rail framing introduced one flattening and one registration gap.

**Gap A — flattening of character to detectable patterns.** voice.md §5 is written entirely for Canopus/Algol machine-enforcement: regex patterns, exit codes, block detection. This is correct and necessary. But the document's *framing* tips toward "voice as compliance spec" rather than "voice as distillation of character." The character bible §13.2 explicitly warns against loading the full character document into every request because it "risks the model over-imitating sample lines." voice.md correctly extracts machine-enforceable rules — but the audit-thinking made it write itself as a ruleset, not as a navigator's constitution. When implementers read voice.md as ground truth and skip the character bible, they get NETRA-as-rule-checker rather than NETRA-as-librarian.

Specific tension: voice.md §1.2 companion vocabulary table lists "Cormorant italic tone — terse, declarative, measured" as a vocabulary item. Tone is not vocabulary. This category belongs in a rendering note, not in a pattern-matchable word list. It signals that the spec is trying to audit things that can only be demonstrated through worked examples — precisely what the character bible's §11 provides.

**Gap B — instrument register surfaces underspecified for ATLAS bay.** voice.md §2.2 specifies globe voice strip lines with a 120-character max and a pattern (`[spatial state noun phrase] · [single declarative clause]`). The four reference lines are correct. But voice.md does not specify the `RETICLE / RANGE` readout update behavior, the `netraTarget` state machine (STANDBY → stratum name → node coordinate), or the jump affordance interaction as NETRA behavior. These live in WorldlineGlobe.tsx and v7.html, not in any voice spec. The ATLAS instrument half of NETRA's identity is treated as someone else's territory when it is the baseline from which everything else grows.

**Gap C — "outside the worldline. no signal." prohibition without positive replacement.** voice.md §1.2 correctly forbids this phrase in companion register. The character bible §10.2 provides the companion-register replacement: "that sits outside the archive. i can't see it from here." voice.md §3.2 includes this replacement. However, the prohibition rationale in voice.md ("makes the site feel like it is roleplaying at the visitor") is accurate but incomplete — the deeper problem is that adopting instrument register for human-facing refusals breaks the two-register architecture that the character bible builds the entire persona on. voice.md names the symptom; the character bible names the cause.

---

## 4 · Anti-dilution flags in current wave

### TASK-11-S2 (chat UI spec · queued · not dispatched)

The task contract specifies "right-edge drawer (NOT a 5th stratum)" as a settled architectural decision. This is the highest fidelity risk in the current wave.

**Why the drawer framing is risky:**
PRD-05 §chat surface recommended the 5th stratum approach: "Camera moves to a dedicated framing; the right readout panel becomes the chat thread; the bottom NETRA console gets an input field replacing the `⟶ NEXT NODE` button." That is a NETRA-growing-out-of-ATLAS path. The TASK-11-S2 contract overrode this with a right-edge drawer decoupled from ATLAS. The resulting spec will design NETRA as a panel that overlays the instrument rather than emerging from it.

The drawer approach fails VISION-FIDELITY §3 I4 on three specific signals:
- NETRA does not retain reticle/range/status/readout behaviors in a drawer — those remain in the instrument bay below, disconnected from the chat surface
- the chat surface does not grow from the existing NETRA console or ATLAS bay — it grows from a trigger button and slides from the right edge, which is the generic modal/panel pattern
- tool calls in a drawer will default to chatbot-style "searching..." indicators rather than instrument-style survey status lines because the drawer has no visual relationship to the instrument

**What is not dilutive about the drawer framing:**
The drawer preserves NETRA's companion register correctly. The message render variants (user · assistant · tool-call · refusal · streaming · dormant) are valid regardless of surface. The zustand store, rate-limit copy, streaming render, and voice rules are portable.

**The specific dilutive risk:** if the drawer ships as the primary NETRA surface with no visual connection to the instrument bay, NETRA's identity will be experienced by visitors primarily as a chat drawer — and the instrument bay will become an orphaned widget. The instrument grounds the chat; the chat has no grounding without the instrument.

### TASK-50 (chat API route shell · rate-limited · Altair territory)

TASK-50 is structurally correct per PRD-05. Rate limiting, session cookie, streaming via AI SDK, tool-call stubs. No direct dilution risk from the route shell itself.

One indirect risk: TASK-50 marks `list_fiction()` and `search_photos()` as tool stubs referencing `lib/content` (velite, TASK-22). If velite is not complete when the chat surface launches, NETRA will return `no trace surveyed` for photo and fiction queries regardless of truth. This is correct behavior per the character bible §8.4, but it will read as a broken feature to visitors. Not a character dilution issue — but worth the constraint: chat surface should not be visitor-accessible until the velite cache is populated enough to return non-empty results for at least the primary entry types.

---

## 5 · Recommendations

### (a) Reconciliation direction for NETRA Persona Reconciliation TASK (item #4 · dispatch next)

The reconciliation task (Arcturus + Vega per VISION-FIDELITY §11.4) should not produce a new voice document — it should produce a **runtime split** as specified in character bible §13.2.

Concrete direction:
1. `docs/netra-runtime-rules.md` — ~500 words, prompt-injectable. Four constitutional rules, source gradient, refusal templates, voice discipline. Distilled from character bible by Arcturus. Reviewed by Vega for register fidelity. This replaces the draft system prompt in PRD-05 which has "outside the worldline. no signal." as an out-of-archive refusal — a violation the character bible explicitly corrects.
2. voice.md v1.0.0 should add a §6 "ATLAS bay instrument spec" that claims the reticle/range/target/jump behavior as NETRA territory, not as Globe-component internals. Arcturus owns this section; it requires no Vega review.
3. The reconciliation task should explicitly lock: instrument register belongs to the ATLAS bay; companion register belongs to the chat surface; the two are visually connected, not separate.

### (b) Re-cut suggestions for TASK-11-S2 (chat UI spec)

Before Betelgeuse authors the spec, the architectural decision ("right-edge drawer NOT a 5th stratum") should be revisited by Polaris against VISION-FIDELITY §4: "NETRA chat enters through ATLAS / NETRA console behavior before becoming a drawer."

Three possible paths that preserve fidelity:

**Path 1 (preferred) — console expansion.** The NETRA console in the instrument bay gains an input field that replaces or extends the JUMP button. Chat thread renders in the right panel (article side panel slot) when NETRA mode is active. Camera behavior shifts to a survey-pause state. This is the 5th stratum approach from PRD-05 §chat surface. Fidelity: highest. Implementation: more complex; requires Sirius + Betelgeuse coordination on the right panel.

**Path 2 (acceptable) — drawer anchored to instrument.** A drawer is acceptable if it is visually tethered to the NETRA console: slides up from the instrument bay rather than in from the right edge; instrument bay remains visible below it; reticle pulse continues during chat. The drawer's header should show the NETRA instrument identity (`◎ NETRA · [target]`) so the visitor knows the chat is the same system they see in the bay.

**Path 3 (current · risky) — right-edge drawer decoupled.** Acceptable only as a mobile fallback or secondary access path, not as the primary surface. If shipped as-is, add an explicit visual connection: the N trigger button should be adjacent to or styled consistently with the NETRA bay in the instrument footer, not isolated in the nav.

### (c) δ-S1 (TASK-11-S1 NETRA system prompt) constraints

TASK-11-S1 was the system prompt task (my prior TASK-2026-05-15-21 output produced voice.md; TASK-11-S1 specified prompt-architecture.md). Based on this audit, the system prompt must observe three constraints that go beyond the voice spec:

**Constraint 1 — refusal phrase correction.** The PRD-05 draft system prompt contains `"outside the worldline. no signal."` as the out-of-archive refusal phrase. The character bible §4.1 and voice.md §3.2 both prohibit this in companion context. The system prompt must use `"that sits outside the archive. i can't see it from here."` for out-of-archive visitor-facing refusals. The instrument phrase (`"α DRIFT EXCEEDED · NETRA dormant until next worldline"`) is reserved for system-state only.

**Constraint 2 — expand tool-call status narration.** The PRD-05 draft shows `NETRA · surveying archive ─────` as the tool-call display. The character bible §13.7 specifies `[instrument] SURVEYING ARCHIVE · search_entries(...)` then `[instrument] resolved · 3 entries · 124ms` then companion reply. The system prompt should instruct NETRA to produce the two-line instrument block before the companion reply, not a combined single line. This makes the tool-call status visually consistent with the instrument register the visitor already sees in the ATLAS bay.

**Constraint 3 — NETRA must not expand "no trace surveyed" into an apology or explanation.** When `search_entries` returns zero results, the system prompt should instruct NETRA to respond with exactly `"no trace surveyed."` plus optionally a single companion redirect line if the query was near-miss. It must not respond with "i'm sorry, i couldn't find anything about…" — both the apology opener and the expansion violate voice.md PATTERN-05 and the character bible §4.3 (c).

---

## Rendered checkpoint citation

- Globe v7 baseline: `/Users/neospiritth/Downloads/Worldline Globe v7.html` — NETRA console at `<footer class="frame-foot">`, line 381–386. Instrument register as rendered: reticle pulse, target name, RETICLE/RANGE readout pair, JUMP button. No chat surface present.
- Web implementation: `components/WorldlineGlobe.tsx` lines 1197–1232 — `atlas-netra` console + `atlas-netra-voice` strip. Both register slots active. No chat surface connected.
- Character bible: `docs/prds/00-netra-character.md` §4.1 (instrument register), §12 (trigger system), §0 balance line ("the right shelf, pointed to at the right time").

---

*Arcturus · α-NET-05 · TASK-2026-05-15-SBA-3 · 2026-05-15*
