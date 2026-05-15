# Brand Regression Checklist

> Owner: Algol (α-VER-06), ratification pending: Betelgeuse (α-VIS-04)
> Status: draft v0.1 · 2026-05-15
> Authority: VISION-FIDELITY.md §11.3 recovery task #3
> Does not modify: VISION-FIDELITY.md (Polaris-only) · QUALITY-BAR.md (Polaris-only)
> Extends: QA gauntlet in Algol's agent definition (does not replace)
> Extends: feedback_algol_qa_cross_check rule (every signed work routes through Algol before Polaris closes TASK)

---

## 1 · Trigger Conditions

This checklist activates when **all three** of the following are true:

1. A TASK touches a brand surface: Globe, ATLAS, Hero, Nav, NETRA, article surfaces, photo surfaces, search, or the overall digital-garden navigation model (QUALITY-BAR.md §U0 definition).
2. The task's handoff includes a **vision fidelity block** (VISION-FIDELITY.md §5) — or is flagged for fidelity-unverified remediation per §10.
3. The task's deliverable includes rendered output (screenshots, HTML prototype, or implemented UI) that can be compared against a soul baseline.

Spec-only tasks (no rendered output) skip Steps 2–4 below but still run Steps 1 and 5.

**WORKFLOW hook (Step 0.5 per WORKFLOW.md):** Polaris marks a task brand-bearing at dispatch by including the fidelity block. Algol reads for the block at audit time. Absence of the block on a brand-surface task is itself a REVISE signal (escalated to Polaris, not the implementing agent).

**Fidelity-unverified remediation:** When re-reviewing a task previously marked "technically useful · fidelity-unverified" (VISION-FIDELITY.md §10 bucket 2), this checklist is the entry gate. No task moves from bucket 2 to bucket 1 without a PASS-WITH-FIDELITY-NOTES or better verdict here.

---

## 2 · Manual Review Sequence

Run these steps in order. Record each in the QA report extension (§3).

### Step A · Soul Baseline Comparison

Locate the soul baseline named in the fidelity block:
- For Globe / ATLAS work: `/Users/neospiritth/Downloads/Worldline Globe v7.html` (VISION-FIDELITY.md §1-B)
- For all other brand surfaces: main branch web shots at `.claude/visual-diffs/main-poc-2026-05-15/shots/`
- For prior rendered-output precedent: `.claude/visual-diffs/TASK-2026-05-14-06/stages/`

Load the soul baseline screenshot(s). Load the task's rendered checkpoint(s) (desktop + mobile per VISION-FIDELITY.md §7 minimum).

Ask: does the artifact feel like the same artifact, or a different product? This is a gestalt check before itemized checks. Record the answer in one sentence.

### Step B · Invariant Audit (I1–I5)

One row per invariant. Verdict: PASS / PARTIAL / FAIL / N/A.

| invariant | description (short) | verdict | evidence / notes |
|---|---|---|---|
| I1 | Garden under measurement — entries have coordinates, file numbers, traces, ledger surfaces | | |
| I2 | Globe is the body — earth-textured, nodes carry narrative reasons, α/observer locus visible, relationship geometry present | | |
| I3 | Peat in the instrument layer — α, divergence, Bangkok, patches, taste present as instrumentation; no biography card flattening | | |
| I4 | NETRA attached to ATLAS first — reticle/range/status readout behaviors present; tool calls look like survey status | | |
| I5 | Quality visible in artifact — motion communicates state; density is intentional; empty space reads as garden silence | | |

Any FAIL = REVISE-FIDELITY (§4). Any PARTIAL = document what was lost and apply Step E loss budget review. N/A requires a one-line justification.

### Step C · Preserved / Diluted Analysis

Write two explicit lists:

**Preserved:** what did the implementing agent carry forward from the soul baseline? Be specific — cite visual evidence (e.g., "corner reticles present at all four corners of ATLAS frame").

**Diluted:** what from the soul baseline is absent, weakened, or replaced? Be specific — do not write "overall feel is off." Write "the DivergenceMeter readout is gone from the instrument frame" or "the paper-canvas surface is replaced with a white background."

If Preserved > Diluted: candidate for PASS-WITH-FIDELITY-NOTES.
If Diluted contains any invariant from Step B: REVISE-FIDELITY unless loss budget in Step E covers it.

### Step D · Anti-Dilution Pattern Audit (§8 of VISION-FIDELITY.md)

Ten patterns. One row each. Verdict: CLEAN / TRIGGERED.

| # | pattern | verdict | evidence |
|---|---|---|---|
| D1 | Turns Worldline into a SaaS dashboard | | |
| D2 | Turns the Globe into a decorative hero object | | |
| D3 | Replaces coordinates and traces with generic cards | | |
| D4 | Removes observer-locus / divergence / α because they look redundant | | |
| D5 | Treats PoC artifacts as disposable legacy when Peat has approved their feeling | | |
| D6 | Turns NETRA into a generic chat drawer detached from ATLAS | | |
| D7 | Uses ontology to overrule a rendered artifact's soul | | |
| D8 | Makes every feature explain itself with labels instead of letting the instrument show state | | |
| D9 | Makes mobile "clean" by stripping away all garden/instrument identity | | |
| D10 | Treats voice, motion, or texture as polish after layout rather than part of the spec | | |

Any TRIGGERED = REVISE-FIDELITY. The agent must name specifically what triggered the pattern and what compensation is proposed.

### Step E · Loss Budget Review

From the fidelity block in the task, read the declared loss budget fields:
- `acceptable loss`
- `unacceptable loss`
- `compensation`

Then answer each:

1. **Did acceptable losses actually stay within the declared budget?** (e.g., mobile drops Three.js — was Three.js actually dropped, and nothing more?)
2. **Did unacceptable losses occur?** (e.g., the feeling of a surveyed archive — is it present?)
3. **Is the compensation present?** (e.g., ATLAS STANDBY card with α, trace count, mini-globe — does it exist in the rendered artifact?)

If the fidelity block has no loss budget (spec was incomplete or pre-protocol), apply the global fallback: "mobile may simplify but must not strip garden identity; desktop must preserve all invariants I1–I5."

Verdict: ACCEPTABLE / UNACCEPTABLE / COMPENSATION-MISSING.

UNACCEPTABLE or COMPENSATION-MISSING = REVISE-FIDELITY.

### Step F · Escalation to Peat Decision

Route to Peat (via Polaris) when any of the following are true (VISION-FIDELITY.md §7):

- The task changes the Globe / ATLAS and I cannot tell whether I1 or I2 survived
- The task changes the first viewport and the gestalt question from Step A is "different product"
- The task changes NETRA's placement or persona and I4 is PARTIAL or FAIL
- The task changes the digital garden navigation model
- Betelgeuse and I disagree on whether a soul element survived (see §5 below for cross-handoff)
- Any [Peat: confirm or redirect] flag from the implementing agent or Betelgeuse is still unresolved at QA time

---

## 3 · QA Report Extension Format

For every brand-bearing TASK, append this section to the standard QA report at `docs/qa/REPORTS/<task_id>.md`:

```
## brand fidelity audit

### soul baseline
  <baseline artifact(s) used>
  <rendered checkpoint(s) compared against>

### gestalt (Step A)
  <one sentence>

### invariant audit (Step B)
  I1 · <PASS/PARTIAL/FAIL/N/A> · <evidence>
  I2 · <PASS/PARTIAL/FAIL/N/A> · <evidence>
  I3 · <PASS/PARTIAL/FAIL/N/A> · <evidence>
  I4 · <PASS/PARTIAL/FAIL/N/A> · <evidence>
  I5 · <PASS/PARTIAL/FAIL/N/A> · <evidence>

### preserved / diluted (Step C)
  preserved:
    · <item>
    · <item>
  diluted:
    · <item> (or "nothing identified")

### anti-dilution patterns (Step D)
  D1 · <CLEAN/TRIGGERED>
  D2 · <CLEAN/TRIGGERED>
  D3 · <CLEAN/TRIGGERED>
  D4 · <CLEAN/TRIGGERED>
  D5 · <CLEAN/TRIGGERED>
  D6 · <CLEAN/TRIGGERED>
  D7 · <CLEAN/TRIGGERED>
  D8 · <CLEAN/TRIGGERED>
  D9 · <CLEAN/TRIGGERED>
  D10 · <CLEAN/TRIGGERED>

### loss budget (Step E)
  acceptable losses within budget · <YES/NO · details>
  unacceptable losses triggered · <YES/NO · details>
  compensation present · <YES/NO/N/A · details>

### fidelity verdict
  <PASS / PASS-WITH-FIDELITY-NOTES / REVISE-FIDELITY / REJECT-FIDELITY>
  <one-paragraph rationale>

### peat escalation (Step F)
  <YES – route to Polaris · reason> or <NO>
```

This section is appended after Step 6 (cross-impact) in the standard report and before the final verdict.

---

## 4 · Verdict Semantics

These four verdicts are distinct from the standard PASS / REVISE-quality verdicts. They operate in parallel. A task can be PASS (quality) and REVISE-FIDELITY simultaneously.

**PASS**
All invariants I1–I5 pass. No anti-dilution pattern triggered. Loss budget within declared range. No escalation to Peat required.

**PASS-WITH-FIDELITY-NOTES**
Invariants pass, or one PARTIAL is documented and within declared acceptable loss. No pattern triggered. Notes are not blocking but are forwarded to Polaris for context on the next task in the chain. Use this verdict when the artifact is good but Algol wants to record a directional observation for future reviewers.

**REVISE-FIDELITY**
One or more of: invariant FAIL, anti-dilution pattern TRIGGERED, loss budget UNACCEPTABLE or COMPENSATION-MISSING, or an unresolved [Peat: confirm] flag on a soul-bearing decision. Returned to the implementing agent with specific failing items cited. The agent must address each cited item before resubmission.

**REJECT-FIDELITY**
Reserved for artifacts where multiple invariants fail AND the gestalt check (Step A) identifies a "different product" result. The work is not a revision candidate — it requires a redesign from the soul baseline. Polaris is notified. Triggers a postmortem if this is the second REJECT-FIDELITY on the same agent in the same design wave.

REJECT-FIDELITY is the "passes criteria but loses soul" failure mode named in VISION-FIDELITY.md §9.

---

## 5 · Cross-Handoff to Betelgeuse

Algol does not fabricate aesthetic taste. The following cases require routing a fidelity question to Betelgeuse before issuing a verdict:

- Any invariant where Algol's assessment is PARTIAL and the correct verdict requires visual judgment (e.g., "I2: the Globe has nodes but I cannot tell whether the relationship geometry is meaningful or decorative")
- Any anti-dilution pattern where the implementing agent has provided a visual argument that Algol cannot assess from screenshots alone
- Any case where the Step A gestalt check produces "unclear" (neither "same artifact" nor "different product")
- Any case where I3 (Peat in the instrument layer) is in dispute — because this requires reading the instrument language against Peat's approved PoC artifacts, and Betelgeuse is the designated aesthetic authority

**Mechanism:** Algol writes a FIDELITY-QUESTION handoff to Betelgeuse at `.claude/handoffs/from-algol/FIDELITY-QUESTION-<task_id>--to-betelgeuse.md`. Betelgeuse responds with a verdict on the specific question only (not a full QA review). Algol incorporates Betelgeuse's verdict into the QA report and issues the final fidelity verdict.

**What Algol does not route to Betelgeuse:** mechanical checks (token compliance, motion timing, screenshot existence). Betelgeuse's role is visual judgment, not re-running Algol's structural checks.

---

## 6 · Pilot Application to Fidelity-Unverified Tasks

The following tasks from the current wave are classified "technically useful · fidelity-unverified" (VISION-FIDELITY.md §10 bucket 2). This section describes how to apply this checklist when each is revisited. No audit is run now.

**Apply-pattern:** for each task, the re-review agent (Betelgeuse for design specs, Sirius for implemented UI) first produces a rendered checkpoint if one does not exist. Then Algol runs this full checklist against that checkpoint.

**TASK-09 · Article entry spec (Betelgeuse)**
Brand surfaces: article entry page (I1, I3, I5 most at risk). Soul baseline: main-poc shots `01-article-entry-*.png`. Check specifically for: header strip with file number/date/status/coordinates per F1 in QUALITY-BAR.md; patches log presence; no biography-card flattening of Peat's presence. Anti-dilution focus: D3, D8.

**TASK-10 · Photo entry + atlas spec (Betelgeuse)**
Brand surfaces: photo entry, photo atlas (I2 most at risk — photos must integrate as Globe nodes, not a standalone gallery). Soul baseline: main-poc `03-photo-entry-1180x760.png`. Check specifically for: film-strip border; roll context strip; film-simulation affordance preserved as keyboard toggle (D2, D3). Anti-dilution focus: D2, D5.

**TASK-14 · Attractor binding (Betelgeuse)**
Brand surfaces: Globe/ATLAS interaction layer (I1, I2). Soul baseline: Globe v7.html + main-poc globe shots. Check specifically for: attractor field selection behavior not flattening stratum co-presence to generic filter state; relationship geometry preserved. Anti-dilution focus: D2, D7.

**TASK-16 · Globe-ontology v1.3 reconciliation (Betelgeuse)**
Brand surfaces: ontology doc + journey-architecture §6 note. This is a spec-only task — Steps 2–4 do not apply. Run Step B (invariant audit) at spec level: confirm the reconcile note does not silently collapse I2 (strata co-equal) into the toggleable-framings-only reading. Anti-dilution focus: D7.

**TASK-40 · Search overlay spec (Betelgeuse)**
Brand surfaces: search/TRIANGULATE surface (I1 most at risk — search must feel like survey, not command palette). Soul baseline: main-poc `04-triangulate-search-1180x760.png`. Check specifically for: result-to-map correspondence present; no generic modal pattern; instrument register on results. Anti-dilution focus: D1, D3, D8.

**TASK-60 · Responsive system spec + mobile prototype (Betelgeuse)**
Brand surfaces: all mobile surfaces — this is the highest-risk task for D9 (mobile "clean" = stripped identity). Soul baseline: main-poc 375px shots. Check specifically for: ATLAS STANDBY card compensation (α, trace count, mini-globe, route back to full ATLAS per VISION-FIDELITY.md §6); motion budget preserved at mobile breakpoints; no stripping of instrument register at 375px. Anti-dilution focus: D9, D10.

**TASK-62 · Nav stratum indicator (Sirius)**
Brand surfaces: Nav (I3, I5). Soul baseline: main-poc main fold shots. Check specifically for: `· STRATUM <key>` readout uses `.t-mono` instrument register (QUALITY-BAR.md F3); 200ms opacity transition matches F5 motion calibration; indicator does not add a new visual element that looks transplanted (no SaaS badge style). Anti-dilution focus: D1, D8.

---

## 7 · What This Checklist Does Not Do

- It does not replace Betelgeuse's design review. Betelgeuse writes specs; Algol audits outcomes against them.
- It does not replace the standard 6-step QA gauntlet. It runs after Step 6, not instead of it.
- It does not catch issues that require interactive testing (motion feel, scroll behavior, keyboard traversal). Those are Step 5 in the standard gauntlet.
- It does not produce a REVISE on aesthetic disagreement alone. Every REVISE-FIDELITY cites a specific invariant, a specific pattern, or a specific loss budget breach.
- It is not brittle false precision. The invariant table and pattern table are human-judgment scaffolds, not automated rules. Algol routes ambiguous visual calls to Betelgeuse (§5).

---

*algol · α-VER-06 · the Demon-Star · Auditor of Signatures · 2026-05-15*
*pending ratification by Betelgeuse (α-VIS-04) — see handoff at `.claude/handoffs/from-algol/TASK-2026-05-15-BRC--to-betelgeuse.md`*
