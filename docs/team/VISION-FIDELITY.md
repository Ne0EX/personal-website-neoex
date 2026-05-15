# Vision Fidelity Protocol

> Owner: Polaris (α-OPS-00)
> Status: v0.1 · 2026-05-15
> Trigger: Peat identified a hidden gap: specs preserved feature requirements, but allowed brand, voice, and soul to dilute during handoff.
> Applies to: every brand-bearing Worldline task before implementation or acceptance.

---

## 0 · Why This Exists

Worldline does not fail only when a feature is missing. It also fails when the feature exists but the artifact no longer feels like Peat's digital garden.

The current workflow is good at preserving engineering facts:

- scope
- file ownership
- acceptance criteria
- tests
- signatures
- accessibility
- token compliance

It is weaker at preserving aesthetic intent:

- the feeling of a digital garden under survey
- the sense that content is planted, locatable, and repaired over time
- Peat's presence in the instrument layer, not only in prose
- NETRA as a navigator inside the garden, not a generic AI feature
- the quiet density, paper texture, cartographic motion, and observational rhythm of the approved PoCs

This is **semantic compression loss**. Peat's signal gets translated into PRD, task, spec, implementation, and audit. Each step may be technically correct while still losing soul.

The protocol below makes that loss explicit and reviewable.

---

## 1 · Approved Baseline Artifacts

These artifacts are not generic inspiration. They are approved examples of Worldline's desired direction.

### A · Main Branch Web

**Canonical role:** approved living product baseline.

This is the web experience Peat has allowed to stand as the current product direction. It is not perfect, and it may contain technical or visual debt, but it represents the current accepted continuity of Worldline.

Use it to preserve:

- the existing rhythm of the page
- the established paper/archive palette
- the global navigation tone
- the current relationship between Hero, Globe, ChapterIndex, AttractorFields, and footer
- any interaction or density Peat has already accepted in rendered form

Do not use it as an excuse to freeze weak implementation details. When it conflicts with a stronger approved PoC, identify the conflict and route it to Polaris.

### B · `Worldline Globe v7.html`

**Path:** `/Users/neospiritth/Downloads/Worldline Globe v7.html`

**Canonical role:** approved soul baseline for the ATLAS / Globe / digital-garden instrument.

This artifact preserves a specific feeling that must not be flattened:

- the Globe is the body of the archive, not a decorative hero
- content has coordinates, origins, and survey marks
- Peat is present inside the instrument through α, divergence, observer locus, surveyed nodes, and narrative reasons
- NETRA is attached to ATLAS as navigator/readout before becoming a chat surface
- the interface feels like a digital garden measured by a cartographic instrument
- the artifact has real craft: paper-earth texture, contours, axis, field shells, nodes, worldline arc, camera travel, keyboard control, drag orbit, NETRA jump, and live readouts

When designing Globe-adjacent features, this file is higher priority than abstract ontology prose unless Peat explicitly says otherwise. Ontology must serve the v7 soul. It must not replace it.

---

## 2 · Priority Stack

Peat's current priority order:

1. **Digital Garden Feeling**  
   The web must feel like a living, high-quality digital garden: planted, surveyed, locatable, textured, and under repair.

2. **Peat In The System**  
   Peat's taste, contradictions, craft, habits, and observer-locus must be present throughout the product, not only in article prose.

3. **NETRA Persona**  
   NETRA matters deeply, but she is downstream of the garden. She should emerge from the ATLAS/archive system, not sit beside it as a generic AI assistant.

This priority order matters when tradeoffs occur.

---

## 3 · Aesthetic Invariants

These must survive every brand-bearing task.

### I1 · Worldline Is A Garden Under Measurement

Content is not a list of cards. It is planted, found, surveyed, revisited, patched, and connected.

Implementation signals:

- entries have file numbers, dates, status, coordinates, patches, or trace marks
- surfaces use ruled ledgers, dossiers, reticles, hairlines, and readouts
- search behaves like survey, not a generic command palette
- archives feel accumulated, not arranged for marketing conversion

### I2 · The Globe Is The Body

ATLAS / Globe is the spatial body of the archive.

Implementation signals:

- the Globe is earth-textured or geographically meaningful
- nodes carry narrative reasons, not only type labels
- α / observer locus remains visible in the instrument layer
- relationship geometry matters: arcs, shells, fields, coordinates, or paths
- camera movement changes spatial context, not just visual state

### I3 · Peat Exists In The Instrument Layer

The site should not require an About page to communicate Peat. His presence is mediated through the system.

Implementation signals:

- α, divergence, observer locus, Bangkok, patches, taste, tools, and repair language appear as instrumentation
- facts about Peat are not flattened into biography cards
- contradictions can remain visible when they create character
- the system may be affectionate or wry, but never promotional

### I4 · NETRA Is Attached To ATLAS First

NETRA is not "a chat feature bolted on." She is a navigator inside the archive.

Implementation signals:

- NETRA retains reticle/range/status/readout behaviors
- tool calls look like survey status, not chatbot typing indicators
- the chat surface grows from the existing NETRA console or ATLAS bay
- companion voice is grounded in `docs/prds/00-netra-character.md`
- instrument register and companion register remain distinct

### I5 · Quality Is Visible In The Artifact

Passing a spec is not enough. The artifact must show craft.

Implementation signals:

- rendered checkpoints exist before final acceptance
- motion communicates state
- density feels intentional, not cluttered
- empty space feels like paper/garden silence, not missing content
- responsive compromises preserve feeling, not just layout

---

## 4 · Feature Insertion Rule

New features must enter Worldline as behavior inside the existing artifact, not as foreign blocks.

Examples:

- NETRA chat enters through ATLAS / NETRA console behavior before becoming a drawer.
- Search enters as a survey overlay with result-to-map correspondence, not a generic modal.
- Article pages enter as archive dossiers opened from nodes, not standalone blog templates.
- Photo surfaces enter as opt-in coordinate traces and contact sheets, not a generic gallery.
- Mobile Globe fallbacks preserve surveyed-archive feeling even when Three.js is dropped.

The question before implementation:

> How does this feature grow out of the garden without changing the kind of artifact the garden is?

If the answer is unclear, Polaris must not dispatch implementation.

---

## 5 · Required Fidelity Block

Every brand-bearing task must include this block before ordinary scope and acceptance criteria.

```text
vision fidelity
  soul baseline · <approved artifact(s), exact file/path/section>
  aesthetic invariants · <I1-I5 items this task must preserve>
  Peat signal · <short quote or paraphrase of Peat's intent>
  allowed evolution · <what may change from the baseline>
  forbidden dilution · <what must not happen even if the feature "works">
  rendered checkpoint · <screenshot/prototype/browser review required before acceptance>
```

If a task touches Globe, ATLAS, Hero, Nav, NETRA, article surfaces, photo surfaces, search, or overall information architecture and lacks this block, it is incomplete.

---

## 6 · Loss Budget

Some loss is acceptable when moving across breakpoints, platforms, or implementation constraints. Hidden loss is not.

Every spec must name its loss budget:

- **acceptable loss:** what can be simplified without harming soul
- **unacceptable loss:** what cannot be removed even if technically redundant
- **compensation:** what replaces a lost affordance at another viewport or surface

Example:

```text
Mobile may drop Three.js from the home fold.
It may not drop the feeling that the archive is surveyed.
Compensation: ATLAS STANDBY card must preserve α, trace count, mini-globe, and route back to full ATLAS.
```

---

## 7 · Rendered Acceptance

For brand-bearing UI, paper approval is provisional. Acceptance requires a rendered checkpoint.

Minimum:

- desktop screenshot
- mobile screenshot
- one interaction state if the task changes behavior
- comparison note against the soul baseline

Peat does not need to review every checkpoint, but Peat must review checkpoints when:

- the task changes the Globe / ATLAS
- the task changes the first viewport
- the task changes NETRA's placement or persona
- the task changes the digital garden navigation model
- Betelgeuse or Polaris cannot clearly tell whether the soul survived

---

## 8 · Anti-Dilution Patterns

Reject or revise work that does any of the following:

- turns Worldline into a SaaS dashboard
- turns the Globe into a decorative hero object
- replaces coordinates and traces with generic cards
- removes observer-locus / divergence / α because they look redundant
- treats PoC artifacts as disposable legacy when Peat has approved their feeling
- turns NETRA into a generic chat drawer detached from ATLAS
- uses ontology to overrule a rendered artifact's soul
- makes every feature explain itself with labels instead of letting the instrument show state
- makes mobile "clean" by stripping away all garden/instrument identity
- treats voice, motion, or texture as polish after layout rather than part of the spec

---

## 9 · Team Responsibilities

### Polaris

- Adds the fidelity block to every relevant task.
- Refuses to dispatch brand-bearing implementation without a soul baseline.
- Marks prior work as `technically useful · fidelity-unverified` when appropriate.
- Routes ambiguous tradeoffs to Peat before implementation.

### Betelgeuse

- Treats approved PoCs as soul baselines, not loose inspiration.
- Writes aesthetic invariants into specs before layout details.
- Reviews rendered artifacts against feeling, not only token/layout compliance.
- Names what was lost, what was preserved, and what evolved.

### Vega

- Protects Peat's language, rhythm, and non-generic voice.
- Flags phrases that flatten Peat into marketing, biography, or generic product prose.
- Reviews task descriptions and surface copy for brand dilution.

### Arcturus

- Keeps NETRA's runtime persona aligned with `docs/prds/00-netra-character.md`.
- Ensures machine/audit specs do not replace character specs.
- Preserves NETRA as librarian-witness and ATLAS navigator, not only grounded assistant.

### Sirius

- Implements against rendered soul baselines, not just text specs.
- Raises a blocker if a spec is technically clear but visually/aesthetically underdetermined.
- Provides screenshots or local browser evidence before claiming brand-bearing UI is done.

### Algol

- Adds brand regression review to QA for relevant tasks.
- Flags "passes criteria but loses soul" as a legitimate failure mode.
- Audits rendered checkpoints against this protocol.

### Canopus

- Encodes the workflow where useful, but avoids turning soul review into brittle false precision.
- Adds hook/rail reminders for missing fidelity blocks.
- Preserves room for human judgment while preventing silent omission.

### Procyon / Altair

- Preserve the data/API structures that allow the garden feeling to exist: coordinates, patches, traceability, source labels, privacy boundaries, and grounded tool results.
- Raise blockers when a requested simplification would erase metadata the front end needs for soul.

---

## 10 · Current Work Classification

Until re-reviewed under this protocol, existing work falls into three buckets:

1. **Approved baseline**
   - main branch web
   - `/Users/neospiritth/Downloads/Worldline Globe v7.html`

2. **Technically useful · fidelity-unverified**
   - design specs written before this protocol
   - UI implementation work that passed structural checks but was not rendered against the baseline
   - NETRA guardrail/audit specs that do not fully preserve character bible intent

3. **Rejected / revise**
   - work that visibly flattens the digital garden into generic product UI
   - work that removes soul-bearing instrumentation without compensation
   - work that contradicts Peat's approved artifacts without an explicit Peat decision

Do not delete bucket 2 work. Mine it. Re-accept only after fidelity review.

---

## 11 · First Recovery Tasks

These are the next tasks Polaris should open before more brand-bearing implementation:

1. **Soul Baseline Audit**
   - Betelgeuse + Vega + Arcturus
   - Compare main branch web and Globe v7.
   - Output a concise canon of what each preserves.

2. **Handoff Template Update**
   - Polaris + Canopus
   - Add the required fidelity block to task/handoff templates and workflow docs.

3. **Brand Regression Checklist**
   - Algol + Betelgeuse
   - Define manual review steps for rendered acceptance.

4. **NETRA Persona Reconciliation**
   - Arcturus + Vega
   - Reconcile `lib/netra/voice.md` with `docs/prds/00-netra-character.md` so audit guardrails do not flatten persona.

5. **Globe Direction Re-cut**
   - Polaris + Betelgeuse, then Sirius
   - Recut the Globe/ATLAS implementation path with Globe v7 as soul baseline and v1.3 ontology as supporting model, not replacement.

---

## 12 · Operating Sentence

> Agents may compress scope, but must not compress soul.

The team may simplify implementation. It may not silently dilute Peat's vision.

---

*Polaris · α-OPS-00 · 2026-05-15*
