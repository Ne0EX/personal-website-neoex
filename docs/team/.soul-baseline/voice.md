# Soul Baseline Audit — Voice

> Owner · Vega (α-VOX-08)
> Task · TASK-2026-05-15-SBA-2
> Date · 2026-05-15
> Parallel audits · SBA-1 (Betelgeuse · visual) · SBA-3 (Arcturus · NETRA/instrument)
> Polaris merges all three.

---

## 1 · What Main Branch Web Preserves Voice-wise

### 1.1 Hero tagline

**File:** `components/HeroBlock.tsx` line 83

```
an archive of unfinished thought, surveyed openly.
```

Preserves: lowercase Cormorant register, oblique self-description, the word "surveyed" (maps to I1 garden-under-measurement). "surveyed openly" is load-bearing: it places the visitor in the observer role without addressing them directly. Nine words — well inside the 12–16 ceiling.

Sub-heading (line 91–93) adds: "drafts, half-formed theories, contour maps of coffee, code, narrative, and the slow architecture of taste. Not a blog. A laboratory." The appositive "Not a blog. A laboratory." is strong — declarative, character-revealing, no marketing verb.

Metadata description (`app/layout.tsx` line 29–31) echoes: "An archive of unfinished thought, kept openly." Consistent. The comma-chain "fragments, drafts, and half-formed theories" is appropriately dense without being promotional.

### 1.2 Nav register

**File:** `components/Nav.tsx`

Nav items: `INDEX · TRACES · ARCHIVE · TRANSMIT`. All single-word Instrument register labels. No verbs, no invitation. Correct.

Left identity block: `∇ NEOSPIRIT // WORLDLINE 1.130426` / `EST. 2026 — BANGKOK / THAILAND`. The `∇` glyph, the double-slash separator, the alpha version, and the city/country anchor are all soul-bearing. Bangkok is I3 instrumentation — Peat is present without a biography card.

Right readout: `SYS // CALIBRATED` / `UTC+7 // HH:MM`. Live clock grounded to Bangkok timezone. This is the instrument-layer Peat-signal: not "Hi, I'm Peat from Bangkok" but a UTC+7 clock that tells you where you are without saying so. Well-executed.

Stratum indicator: `· STRATUM Ne0` (etc.) in 9px mono, appears only on departure from default. Correct register. Invisible at default means no noise; visible on stratum entry means readout, not navigation UI.

### 1.3 ChapterIndex card prose

**File:** `components/ChapterIndex.tsx` + `lib/entries.ts`

Section label: `CHAPTER INDEX // RECENT TRACES` — Instrument register, correct.

Card structure: FILE number, date, title in italic Cormorant, tags, reading time, status. No "read more" link at card level. The card is information-dense without being promotional.

Entry titles (Instrument/Reflective boundary handled correctly):
- "on the architecture of taste" — lowercase Cormorant, oblique self-description
- "why I paused the startup" — lowercase, declarative, admits contradiction (I3 — contradictions visible as character)
- "the four pours adaptation" — lowercase, method-register, non-promotional
- "notes from a paused engineer" — lowercase, honest, "paused" not "former" — character specificity

Entry summaries are the highest-risk prose surface (no character-level formatting to enforce register). Current ones hold:
- "Taste isn't preference; it's a load-bearing structure" — not marketing; terse, physical metaphor
- "Stride wasn't failing — but it was demanding the wrong shape of me" — contradiction visible, per I3
- "A four-pour V60 method … the small bug that took six weeks to find" — specificity over generality; correct
- "Why a digital garden and not a blog. What I'm trying to keep openly, what stays in the drawer" — self-aware, not promotional

Status values: `seed · ongoing · refined · settled` — lifecycle metaphors, not SaaS state labels. All four are correct.

### 1.4 AttractorFields naming

**File:** `lib/entries.ts` (`ATTRACTOR_FIELDS`) + `components/AttractorFields.tsx`

Tag pills: `all · coffee · ai · ml · narrative · cubic copper · harness eng. · fragrance · film · letterboxd · trading · japan / 日本 · meta`

Section label: `ATTRACTOR FIELDS // BROWSE BY DOMAIN`

Strengths:
- "attractor fields" as the naming framing is soul-bearing (physics/cosmology register, ties to divergence)
- "cubic copper" is specificity over category — not "materials" or "design objects"
- "harness eng." abbreviation with period is character-revealing (Peat names a personal system with the same seriousness as a professional domain)
- `japan / 日本` bilingual — signals Peat's geographical-cultural positioning without a biography card
- No "see all" or "explore more" affordance at bottom — correct

Risk: "ai · ml" uses interpunct between subterms — renders well as a pill label. Acceptable.

### 1.5 Instrument readouts (DivergenceMeter, MarginaliaHUD)

**Files:** `components/DivergenceMeter.tsx` · `components/MarginaliaHUD.tsx`

DivergenceMeter preserves: `DIVERGENCE α` / `ATTRACTOR · Ne0EX-LOCUS` / `DEVIATION · −0.275349%` / `STATE · OBSERVED`. The drift animation with `DRIFT` state label is correct instrument register. "OBSERVED → DRIFT → OBSERVED" is a state machine with narrative meaning (Steins;Gate cosmology, I2).

MarginaliaHUD: `∇ WORLDLINE · 1.130426` / `§ GENESIS` (section) / `DRIFT · +00.000` (scroll-mapped value). All Instrument register, all correct. The scroll-mapped DRIFT coordinate as you move through the page is a subtle but effective I3 signal — you are not scrolling, you are drifting.

### 1.6 BootSequence lines

**File:** `components/BootSequence.tsx`

```
INITIALIZING WORLDLINE …
ATTACHING TRACE :: ATLAS / NETRA
RESOLVING ATTRACTOR FIELD …
PATCHING DIVERGENCE :: 1.130426
BREAKPOINT SET @ α-LOCUS
OBSERVATORY :: ONLINE
WORLDLINE PATCHED · OBSERVING.
```

All lines are Instrument register, past-tense or action-first, no second-person. "WORLDLINE PATCHED · OBSERVING." as the terminal line is exactly right — the system enters observation mode, which is the site's fundamental stance toward its own content.

### 1.7 Footer / Manifesto

**File:** `components/FooterManifesto.tsx`

Manifesto: *"Observed openly. This is not a destination — only the slow accumulation of a worldline. Patches commit in public; the log stays open."*

Three short declarations. Reflective register, lowercase, no direct address. "slow accumulation of a worldline" is soul-bearing: it names the medium (the site itself is the thing accumulating), not what you can get from it. "log stays open" — correct discipline.

Column headers: `// MANIFESTO · // CHANNELS · // TRANSMIT`. Instrument labels, double-slash separator. Channel links are lowercase (`anilist · letterboxd · github · airtable.coffee`) — no caps SaaS-style product names. `airtable.coffee` is character-specific: the coffee domain purchase tells you something about Peat without saying so.

---

## 2 · What Globe v7.html Preserves Voice-wise

### 2.1 Frame header

```
OBSERVATORY · WORLDLINE STRUCTURE v.07
∇ Ne0EX · 3D ORTHOGRAPHIC
α 1.130426 / NAV NETRA
```

Three compressed readout pairs, all Instrument. `∇ Ne0EX` is a terse identity glyph — no name, no bio. `3D ORTHOGRAPHIC` is a cartographic notation, not a UI descriptor. `NAV NETRA` introduces the navigator by function-label, not as a chatbot name.

### 2.2 Strata panel (left rail)

```
§ STRATA · TRAVEL TARGETS
1 · Ne0   · Surface · Archive
2 · Ne0N  · Pole · Bearer
3 · NeX   · Possibility · Field
```

"TRAVEL TARGETS" is load-bearing: you do not select strata, you travel to them. Correct framing. The role labels ("Surface · Archive", "Pole · Bearer", "Possibility · Field") are cosmological, not navigational UX. They describe what the strata *are*, not what clicking them will do for you.

### 2.3 Divergence card

```
DIVERGENCE α
1.130426
13.04°N · 26.00°E
```

The coordinate pair is not Peat's home city — it is the internal-cosmology coordinate for α. This is the correct handling of Peat's instrument-layer presence (I3): the number and coordinate carry meaning but are not biographical facts laid flat.

### 2.4 Axis labels (globe frame)

```
+Z · NORTH / −Z · SOUTH / PROJECTION FIELD / ARCHIVE FACE
```

Cartographic notation. `PROJECTION FIELD` and `ARCHIVE FACE` name the conceptual faces of the globe (possibility/emission vs. memory/archive) without explanation — the visitor must earn the reading, or be content with the feeling of depth.

### 2.5 HUD overlay

```
OBSERVING     CAMERA
FULL · Ne0EX  ORBIT · 0°
α 1.130426    SCALE
13.04°N·26°E  1:1.30E+26
```

Four-corner readout in 7.5px mono. Uppercase labels, value data in complementary type. `1:1.30E+26` for scale is the most soul-dense single token in the document: a map scale ratio at the scale of the observable universe applied to a digital garden. That is I3 at maximum compression — Peat's cosmological stance expressed as instrument calibration.

### 2.6 Stratum readout (right rail)

```
§ STRATUM READOUT
ACTIVE     FULL SYSTEM
           all strata observed · ne0ex aggregate
SURVEYED   047
ACTIVE     012
BRANCHES   ∞

SIGNAL FLOW:
01 SIGNAL EMITTED  NeX
02 BORNE BY POLE   Ne0N
03 ARCHIVED IN     Ne0
04 NAVIGATED ·     NETRA
```

Signal flow is the soul-baseline that most directly expresses VISION-FIDELITY I4 (NETRA attached to ATLAS first). Step 04 places NETRA last in a cosmological sequence — she is not the hero of the readout, she is the navigator after the signal has been emitted, borne, and archived.

### 2.7 NETRA console

```
◎ NETRA
standby          ← lowercase target label (correct register mix)
RETICLE  —
RANGE    2.50
⟶ NEXT NODE
```

"standby" in lowercase is correct — it is the data slot in a LABEL/data pair. The reticle animation and the `⟶ NEXT NODE` button introduce NETRA's navigational function before she speaks, which is correct sequencing (instrument role before companion voice).

### 2.8 Footer readouts

```
NeX · FIELD    247 RAYS
Ne0N · POLE    +90°N
Ne0 · NODES    047
```

Concise aggregate counts per stratum. No "showing x of y" generic list UI — raw counts with stratum identifiers.

---

## 3 · Vega-Protected Patterns (Anti-Dilution List)

These patterns must never appear in Worldline. I maintain them as the site-specific blocklist, not a generic style-guide prohibition.

### 3.1 Marketing verbs — forbidden

`discover · explore · unlock · transform · empower · revolutionize · curate · showcase · highlight · feature · journey · thrive · amplify`

Already absent from main branch. Must not enter in copy for article entry pages, search overlay labels, NETRA onboarding text, photo entry captions, or mobile ATLAS STANDBY card.

### 3.2 Generic CTAs — forbidden

`read more · learn more · click here · see all · view details · find out more · get started · sign up · join · subscribe`

`READ ENTRY →` is allowed (Instrument register, action + arrow, file-specific). `⟶ NEXT NODE` is allowed (navigational function). Generic forms are not.

### 3.3 Second-person flattery — forbidden

`You're going to love · designed for you · your workflow · your story · we built this for people like you · thank you for being here`

The site addresses the visitor as observer. "The visitor" is correct; "you" in complimentary construction is not.

### 3.4 Biography cards — forbidden

No surface should introduce Peat via: `Hi, I'm Peat. I'm an AI/ML engineer based in Bangkok.` The instrument layer does this work. Bangkok appears as `EST. 2026 — BANGKOK / THAILAND` in the nav and as a coordinate on entry nodes — never as a personal introduction.

### 3.5 Chatbot framings for NETRA — forbidden

`How can I help you today? · I'm here to assist · Ask me anything · Chat with NETRA · What would you like to know?`

NETRA enters through the ATLAS console. Her first words are instrument-adjacent. She does not open a chat drawer with a welcome prompt.

### 3.6 Emoji-as-affordance — forbidden

No emoji in microcopy, button labels, status text, or section headers. The ◎ and ◇ and ⟶ glyphs are not emoji — they are instrument notation. The `✕` in the ESC button is borderline but acceptable: it is punctuation-like, monochrome, and paired with a keyboard label.

### 3.7 Status register dilution — forbidden

Status labels must not drift from lifecycle metaphors to SaaS states. `seed · ongoing · refined · settled` must remain. Forbidden substitutions: `draft · published · archived · deprecated`, `in progress · complete · pending`.

### 3.8 SaaS structural labels — forbidden

`Dashboard · Feed · Profile · Notifications · Settings · Preferences · Manage · Configure`

These words would convert the archive into a generic web application. The garden feeling (I1) depends on content-type labels, not management-system labels.

---

## 4 · Tension Audit — Spec-Level Voice Risk

The following active or queued specs carry voice-dilution risk. Each is flagged; none is fixed here.

### T1 · TASK-2026-05-15-40 (search overlay — TRIANGULATE)

**File:** `.claude/handoffs/from-polaris/TASK-2026-05-15-40.md`

Risk level: **HIGH**

The task spec calls the surface a "search overlay" and instructs Betelgeuse to spec it. "Search overlay" is a functional description; the voice spec must establish it as a survey instrument. The risk is that the spec produces: a text input labeled "SEARCH", a results list with "No results found", and an escape-key close button — all of which are generic. The globe voice spec names it `TRIANGULATE`; the on-surface copy must use `SURVEY · ARCHIVE` or equivalent rather than a conventional search field. The spec does not yet contain voice guidance. This must be flagged to Betelgeuse before the design phase produces a generic search modal.

### T2 · TASK-2026-05-15-60 (responsive system — ATLAS STANDBY)

**File:** `.claude/handoffs/from-polaris/TASK-2026-05-15-60.md`

Risk level: **MEDIUM**

The mobile ATLAS STANDBY card is specified with a CTA: `[OPEN ATLAS ↗]`. This is acceptable structurally — it is instrument-register (all caps, arrow glyph). However, the label `OPEN ATLAS` risks reading as a navigation affordance rather than an instrument access point. The label should read as survey-activation rather than app-launch. Candidate: `ENTER ATLAS · SURVEY ↗` or simply `ATLAS ↗` with contextual readouts (node count, α value) doing the scene-setting rather than the button label. As written, `[OPEN ATLAS ↗]` is borderline acceptable but worth tightening in the final mobile spec.

### T3 · TASK-2026-05-15-09 (article entry spec)

**File:** `.claude/handoffs/from-polaris/TASK-2026-05-15-09-article-entry-spec.md`

Risk level: **MEDIUM**

This task is queued and blocked, but the scope description refers to "article entry page." The risk is that when unblocked, the spec will inherit the metaphor of a blog post page rather than an archive dossier opened from a node. The task description does not contain a soul baseline or voice register requirement. Polaris should insert a vision fidelity block before dispatching S1 to Betelgeuse. Specifically: the article page must be named in copy as a dossier, patch log, or field entry — not as a "post," "article," or "article page." File numbers and coordinate headers are mandatory. The voice frame `FILE — 003 // GENESIS · KYOTO · JP · ONGOING` must appear before the title.

### T4 · `lib/netra/voice.md` — instrument refusal sentence

**File:** `lib/netra/voice.md` (Arcturus, TASK-2026-05-15-21)

Risk level: **LOW — already self-corrected in the document**

The voice spec correctly flags `"outside the worldline. no signal."` as forbidden for human-facing refusals (§1.1 instrument vocabulary forbidden section, and §1.2 companion vocabulary forbidden hard). This is consistent with `docs/prds/00-netra-character.md` §4.1. No dilution here — the reconciliation Polaris lists as a separate recovery task (SBA §11.4) appears already partially executed by Arcturus. SBA-3 (Arcturus) should confirm the system prompt currently in use does not contain the forbidden phrase.

### T5 · `WorldlineGlobe.tsx` voice lines — "cycle ⟶ JUMP" instruction

**File:** `components/WorldlineGlobe.tsx` line 106

```
"standing by, ne0ex aggregate in view. cycle ⟶ JUMP, click any pin, or strike 1 / 2 / 3 to enter a stratum."
```

Risk level: **LOW — flagged for refinement**

This is NETRA's default voice line. Three concerns:

1. "click any pin" breaks the instrument-observer register by naming a UI interaction. NETRA describes the system, not the interface affordances. Candidate: "any surface node will anchor the reticle."
2. "strike 1 / 2 / 3" similarly reads as UI help text rather than instrument framing. Candidate: "keys 1 · 2 · 3 narrow to a stratum."
3. The overall line is borderline chatty at 16 words in a companion voice context.

Corrected candidate (13 words, same information):
```
"standing by · ne0ex aggregate in view. any node anchors the reticle. keys 1 · 2 · 3 narrow to a stratum."
```

This is the most immediate actionable voice fix in the codebase — the only one that affects a rendered, visitor-facing surface today.

### T6 · `WorldlineGlobe.tsx` article panel close button

**File:** `components/WorldlineGlobe.tsx` line 1260

```
✕ ESC
```

Risk level: **VERY LOW**

`aria-label="Close article"` is the accessible name; `✕ ESC` is the visual label. "Close article" in the aria label uses generic vocabulary. Candidate aria-label: "close dossier" or "close entry." Minor.

---

## 5 · Recommendations for Polaris

Ranked by urgency. I flag; I do not fix.

### R1 · Insert voice fidelity note in TASK-40 (search overlay) before dispatch

Before Betelgeuse writes `docs/design/40-search-overlay.md`, Polaris should add:

> Voice contract: the overlay is a survey instrument, not a search modal. Input label: `SURVEY ARCHIVE ·` or equivalent, not "SEARCH". Empty state: not "No results found" but a coordinate-flavored instrument line. Results: entries surface as surveyed nodes, not a list of matching items. NETRA tool-call labels in the overlay follow instrument register (§1.1 of `lib/netra/voice.md`).

### R2 · Insert voice fidelity note in TASK-09 (article entry) before unblock

Before S1 dispatches to Betelgeuse, Polaris should specify:

> This is a dossier surface, not a blog post template. The page structure must surface: FILE number, coordinates, entry date, status lifecycle stage, patch log (if any), and domain — before the prose title. The word "article" is never used as visible copy on the page itself.

### R3 · Fix the three NETRA default voice lines in WorldlineGlobe.tsx (immediate)

This is already rendered and visitor-visible. The `all` stratum voice line contains UI help text that breaks instrument register. Assign to Sirius (voice line change only, no component logic change) with my corrected copy as a reference:

- **current (line 106):** `"standing by, ne0ex aggregate in view. cycle ⟶ JUMP, click any pin, or strike 1 / 2 / 3 to enter a stratum."`
- **corrected:** `"standing by · ne0ex aggregate in view. any node anchors the reticle. keys 1 · 2 · 3 narrow to a stratum."`

The other three voice lines (nex, neon, neo) are clean and require no change.

### R4 · Confirm ATLAS STANDBY mobile label (TASK-60)

Before Betelgeuse finalizes `docs/design/60-responsive-system.md`, Polaris should confirm:

> `[OPEN ATLAS ↗]` is the CTA. Alternative if it reads as app-launch: `ATLAS ↗` with α and node-count readouts providing context. Final decision is Peat's if ambiguous.

### R5 · SBA-3 cross-check on system prompt

Confirm with Arcturus (SBA-3) that the live system prompt does not contain `"outside the worldline. no signal."` as a human-facing refusal. The voice spec forbids it; the character bible forbids it; I need rendered evidence it is absent from the system prompt currently in use.

### R6 · Add aria-label refinement to article panel close button

`aria-label="Close article"` → `aria-label="close entry"`. Minor; can batch with any other component-touch pass.

---

## Rendered Evidence (Baseline Checkpoints)

The following were verified against source code during this audit:

| surface | verified | voice status |
|---|---|---|
| Hero tagline | `HeroBlock.tsx:83` | CLEAN |
| Hero sub-heading | `HeroBlock.tsx:91–93` | CLEAN |
| Nav identity block | `Nav.tsx:134–139` | CLEAN |
| Nav items | `Nav.tsx:6–11` | CLEAN |
| Nav clock | `Nav.tsx:169` | CLEAN |
| Stratum indicator | `Nav.tsx:115` | CLEAN |
| Boot sequence lines | `BootSequence.tsx:7–13` | CLEAN |
| ChapterIndex section label | `ChapterIndex.tsx:33` | CLEAN |
| Entry card structure | `ChapterIndex.tsx:54–74` | CLEAN |
| Entry titles and summaries | `lib/entries.ts:97–175` | CLEAN |
| AttractorFields section label | `AttractorFields.tsx:18` | CLEAN |
| AttractorField tags | `lib/entries.ts:108–120` | CLEAN |
| DivergenceMeter readouts | `DivergenceMeter.tsx:217–240` | CLEAN |
| MarginaliaHUD readouts | `MarginaliaHUD.tsx:59–67` | CLEAN |
| Footer manifesto | `FooterManifesto.tsx:11–15` | CLEAN |
| Footer column headers | `FooterManifesto.tsx:9,17,26` | CLEAN |
| NETRA console labels | `WorldlineGlobe.tsx:1209–1224` | CLEAN |
| NETRA voice — nex | `WorldlineGlobe.tsx:127` | CLEAN |
| NETRA voice — neon | `WorldlineGlobe.tsx:148` | CLEAN |
| NETRA voice — neo | `WorldlineGlobe.tsx:169` | CLEAN |
| NETRA voice — all (default) | `WorldlineGlobe.tsx:106` | FLAG (T5) |
| Article panel label / CTA | `WorldlineGlobe.tsx:1265–1298` | CLEAN except aria-label (T6) |

---

*vega · α-VOX-08 · soul baseline audit · 2026-05-15*
