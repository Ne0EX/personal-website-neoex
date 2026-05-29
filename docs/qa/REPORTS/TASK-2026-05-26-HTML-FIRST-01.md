# docs/qa/REPORTS/TASK-2026-05-26-HTML-FIRST-01.md

## task · HTML-first pilot retroactive audit (Betelgeuse · α-VIS-04)

## verdict · NEAR-PASS — REVISE (one criterion miss: DIRECTIONS.md paragraph word counts exceed the 80-word cap)

Signature integrity: CLEAN (with ADVISORY, same pattern as Canopus HTML-FIRST-02).
Acceptance criteria: 5 of 6 items PASS. One FAIL: DIRECTIONS.md paragraph word counts.
Quality bar: math overstatement confirmed; erratum required from Betelgeuse.
Regression: exit 0, 0 advisory, 0 blocking from `audit-visual-diff-directions.sh`.
Accessibility: spot-check PASS.
Cross-impact: workflow-doc amendment recommended (endorse split, raise cap to 300 for FS-class surfaces).

---

## 1. signature integrity

### Betelgeuse · TASK-2026-05-26-HTML-FIRST-01--betelgeuse.json

- `signature_schema_version`: 2 — PASS
- `agent`: Betelgeuse / `agent_designation`: α-VIS-04 — PASS
- `pre_cutover_codename`: Iris — confirmed against AGENTS.md Nomenclature table (Iris → Betelgeuse → α-VIS-04) — PASS
- `next_recipient`: Polaris / α-OPS-00 — current roster member confirmed — PASS
- `self_hash`: stored `3a884d4d…` = recomputed `3a884d4d…` (Python canonical JSON, no trailing newline, sorted keys) — PASS
- `harness_passed`: true — noted
- `post_edit_passed`: false — FLAGGED ADVISORY (no-baseline fallback; same established hook-task carry-over pattern as Canopus TASK-2026-05-26-HTML-FIRST-02 and prior precedents. Not INTEGRITY-FAIL.)
- `files_touched` count: 1584 — working-tree-wide no-baseline fallback artifact. Primary deliverables are confirmed present within that list (checked key paths: `DIRECTIONS.md`, `AUDIT.md`, `directions/direction-{1..3}/index.html`, `directions/direction-{1..3}/README.md`). Non-blocking.

**verdict: CLEAN with ADVISORY** (same classification as the Canopus companion signature on this task chain)

---

## 2. acceptance criteria

Verified against the acceptance block in `.claude/handoffs/from-polaris/TASK-2026-05-26-HTML-FIRST-01--to-betelgeuse.md §acceptance criteria`.

### 2a · 2–4 directions with working HTML and 5-field READMEs

Three directions at `.claude/visual-diffs/TASK-2026-05-26-PHOTO-PROTOTYPE-FIRST/directions/direction-{1..3}/`.

Each README verified for the 5 required fields (soul-baseline, connection-point, continuity, evolution, bet):
- direction-1: all 5 present — PASS
- direction-2: all 5 present — PASS
- direction-3: all 5 present — PASS

Harness audit (`bash scripts/audit-visual-diff-directions.sh TASK-2026-05-26-PHOTO-PROTOTYPE-FIRST`):
- advisory violations: 0
- blocking violations: 0
- exit code: 0

**verdict: PASS**

### 2b · DIRECTIONS.md with ≤80-word paragraphs + top-level soul-baseline + unity check

Top-level `soul-baseline` field: present — PASS
Unity check section: present, table covering all 3 directions — PASS

Paragraph word counts (per Python wc):
- direction-1 paragraph: 103 words (cap: 80) — FAIL, over by 23 words
- direction-2 paragraph: 121 words (cap: 80) — FAIL, over by 41 words
- direction-3 paragraph: 135 words (cap: 80) — FAIL, over by 55 words

The paragraphs are substantive and accurate but exceed the spec's ≤80-word constraint (WORKFLOW-HTML-FIRST-SPEC.md §3 step 3). This is a literal criterion miss.

**verdict: FAIL** — paragraph trimming required. Scope is small: cut Risk sentences and redundant detail into a separate `## what each direction is risking` list or consolidate into the README prose (which has no word cap). The structural content (soul-baseline, unity check) passes.

### 2c · AUDIT.md mapping sections + shrink estimate + unity trace

- Section-by-section verdict table: all 29 sections mapped to REDUNDANT / COMPRESS / KEEP — PASS
- Shrink estimate: present (claims ~280 target; see quality bar section below for the math finding)
- Unity trace: present with per-direction vocabulary atom table — PASS

**verdict: PASS** (with erratum required on the shrink estimate headline — see §3)

### 2d · Anti-Codex 6-point check on direction-1 (spot-check)

Verified in direction-1/README.md and by direct inspection of direction-1/index.html:

| check | result |
|---|---|
| reference fidelity | PASS — Nav strip, header atoms, readout dl, paper-mount, prev/next roll context all present |
| token compliance | PASS — hex values in HTML are either token re-declarations in `:root` (verbatim from globals.css, necessary for standalone HTML) or inside `aria-hidden` SVG placeholder. No rogue hex in component styles. |
| pattern reuse | PASS — `.entry-head` / `.readout-head` / `.head-l` / `.head-r` rhythm mirrors iter-1 soul baseline pattern |
| accessibility | PASS — skip link present; `role="status"` and `aria-live="polite"` on NETRA bay; `aria-label` on n-badge; focus rings on all interactive; tabindex on key elements |
| mobile fidelity | PASS — 880 and 600 breakpoints implemented; touch targets declared ≥44px via padding |
| motion calibration | PASS — 200ms image fade, 120ms hover, no looping decorative motion |
| Rule 4 unity | PASS — extends soul baseline; same page-level chrome atom-for-atom; variation bounded to photo-surface-specific atoms |

**verdict: PASS**

### 2e · Zero new tokens

Checked all three direction index.html files for CSS variable declarations (pattern `--varname:`) not present in `app/globals.css`.

- direction-1 new vars: NONE
- direction-2 new vars: NONE
- direction-3 new vars: NONE

Note on direction-3: `[data-palette="*"]` blocks contain raw hex values verbatim from PRD-03 §8.1 — this is the named single-exception site per spec §FS6 and the README documents it explicitly. Not a token violation.

**verdict: PASS**

### 2f · DIRECTIONS.md ≤80-word paragraph (already covered in 2b above)

**verdict: FAIL** (same item)

---

## 3. quality bar — claim soundness (math overstatement)

### arithmetic finding (Polaris-verified, independently confirmed)

Betelgeuse's AUDIT.md claims: "total spec lines: 911 → **≈ 280**" and "~69% shrink."

My verification (Python parsing of the AUDIT.md target column, 29 section rows): **target column sum = 325**, not ~280.

Polaris's independent cross-check: sum = 325, actual file line count = 911, structural overhead (blank lines, code fences, section headers, preamble not assigned to any section in the table) = 131 lines.

Corrected figures:
- Realistic shrink: 911 → ~380 = ~58% (structural overhead not cut by prose compression alone)
- Optimistic shrink (if rewrite eliminates all overhead): 911 → 325 = ~64%
- Betelgeuse's stated 911 → ~280 / ~69% is overstated by approximately 45 lines / 16 percentage points

### materiality assessment

**Does the overstatement invalidate the pilot's conclusion?** NO. The AUDIT.md's actual conclusion — "The diagnosis was right. Of the 911 lines, ~520 (~57%) are appearance-encoding" — is independently confirmed by Polaris and concurred by this audit. The diagnosis stands.

**Does the overstatement require an erratum to AUDIT.md?** YES. The headline number "911 → ~280" and the "~69% shrink" appear in the shrink-estimate table and the "what the pilot proved" section. A 16% overstatement on the headline is material and misleading to future readers who use this audit as a reference for the split/raise-cap decision. Betelgeuse should issue a corrected shrink estimate: 911 → ~325 target / ~380 realistic = 58–64% range.

**Does the overstatement affect the split recommendation?** NO, it actually strengthens it. At 325 lines (surface without the FS sections), the surface alone lands at ~219, which fits under the 220-line pre-handoff warning and is near the 200-line cap. The split case (10 + 10a-film-simulation) is the correct recommendation regardless.

---

## 4. regression scan

`bash scripts/audit-visual-diff-directions.sh TASK-2026-05-26-PHOTO-PROTOTYPE-FIRST` run from working tree:
- advisory violations: 0
- blocking violations: 0
- exit code: 0

Cross-validation: this is the same result confirmed in the A1 audit pass. Consistent.

No regressions on this audit script or the directions' compliance with the harness.

**verdict: PASS**

---

## 5. accessibility (spot-check)

### direction-1

- Skip link: PRESENT (`<a href="#photo-main" class="sr-only">`)
- NETRA bay: `role="status"` + `aria-live="polite"` — PRESENT
- n-badge: `role="button"` + `aria-label="NETRA"` + `tabindex="0"` — PRESENT
- Photo placeholder: `aria-hidden="true"` on decorative SVG — PRESENT
- Focus rings: CSS-defined, 2px dashed accent-orange per soul-baseline vocabulary — PRESENT
- Keyboard nav on prev/next roll context: `<a>` elements (2 found) — PRESENT
- Mobile: 880 and 600 breakpoints implemented — PASS

### direction-3

All of the above present (direction-3 inherits from direction-1 surface). Additional:
- EXTEND PALETTE button: real `<button>` element with `aria-label` — PRESENT
- Keyboard shortcut (Ctrl+P): `ctrlKey` event handler present in JS — PRESENT
- `prefers-reduced-motion`: opacity-dip collapses to 0ms explicitly — PRESENT per README self-review
- NETRA bay annotation (`aria-live="polite"`): body text changes announced — PRESENT

**verdict: PASS**

Note: Lighthouse scores not run (no live server; static file audit is sufficient for prototype-phase check per prior precedent on this task chain).

---

## 6. cross-impact

### Rule 4 (unity by extension) — enforceable in practice?

Canopus's `audit-visual-diff-directions.sh` script enforces Rule 4 structurally: S2-item-3 (blocking) requires all 5 README fields; S2-item-4 (blocking) resolves the soul-baseline path and rejects blank declarations. The pilot ran under this script and passed 0 blocking, 0 advisory.

Pilot evidence: all three directions inherit the iter-1 chrome atom-for-atom, confirmed by README unity tables and corroborated by my spot-check on direction-1 and direction-3. Rule 4 produced measurable constraint — without it, direction-3 could have invented an entirely new switcher UI grammar rather than extending the existing `data-palette` mechanism.

**Concur: Rule 4 is enforceable in practice.**

### 200-line cap — corrected math recommendation

Corrected arithmetic: the photo-entry surface (without the FS machinery §FS1–FS6) targets ~219 lines. The full surface including FS targets ~325.

The 200-line cap is missed by ~125 lines (not ~80 as Betelgeuse stated).

The FS machinery (~106 lines from §FS1, FS2, FS3, FS4, FS5, FS6 targets: 14+16+24+22+24+6) is the primary driver. This machinery is reused across four surfaces (Globe hover card, side panel, /photos index, /colophon switcher) making it genuinely cross-cutting.

**Recommendation: endorse the split** (`10-photo-entry.md` ≤220 lines + `10a-film-simulation.md` ~106 lines), **rather than raising the cap**. Reasoning:

1. The split is the cleaner engineering decision: `10a-film-simulation.md` becomes a referenceable contract for all four surfaces that use it, not just photo-entry.
2. Raising the cap to 300 for "FS-class surfaces" introduces a category that requires case-by-case judgment at dispatch time. The split avoids the judgment.
3. With the split, photo-entry lands at ~219 lines — under the current 220-line pre-handoff warning. The cap stays at 200 as a target with a recognized 10% buffer for decision-dense surfaces, without an exception class.
4. Polaris may amend WORKFLOW-HTML-FIRST-SPEC.md §3 Rule 3 to add: "If a surface integrates cross-cutting first-class mechanics (palette switching, branching renderer, etc.), the mechanic's spec is extracted to its own file and referenced; the surface spec still targets ≤200 lines."

**Multi-direction comparison working as intended?** Yes. The pilot decomposed into 4 independent axes (mount metaphor, FILM SIM hierarchy, NETRA L1 prominence, palette switching feel), Peat can lock any combination. This is exactly the "mix-and-match" the workflow spec intended. Concur.

---

## 7. postmortem decision

**Math overstatement by Betelgeuse (~16% on the headline) — one-off or systemic?**

Concur with Polaris: this is a one-off. Betelgeuse was executing a generative-AND-analytical task at high output volume (3 HTML directions + AUDIT.md + DIRECTIONS.md in one session). The arithmetic error is a round-down bias on a mental sum across 29 rows — human-like variance. No structural defect is indicated.

**Decision: no postmortem. Erratum only.**

Betelgeuse issues a corrected AUDIT.md shrink estimate. No rework of directions, no rework of conclusions. The erratum is scoped to: (1) the shrink-estimate table row for "total spec lines," (2) the "~69% shrink" figure, and (3) the "what the pilot proved" point 2 ("200-line cap is too tight... missed by ~80 lines").

---

## 8. notes not blocking (sent to Polaris)

1. DIRECTIONS.md paragraph word counts exceed ≤80-word cap for all three directions (103/121/135 words). Criterion is from WORKFLOW-HTML-FIRST-SPEC.md §3 step 3. This is the basis for the REVISE handoff to Betelgeuse. The structural content (soul-baseline, unity check) passes; only the paragraph prose needs trimming.

2. `post_edit_passed: false` on both Betelgeuse and Canopus signatures for this task chain. This is the established no-baseline fallback pattern for hook-task dispatches. The FIX-2026-05-25-SIGN-WORK-FILES-TOUCHED Canopus task exists to address this. No action needed from QA.

3. Stream-watchdog stall pattern: this audit instance (A3, resumed from A2 stall) did not stall. The prior stall (A2) was at approximately 600s after substantial output, not at idle. Consistent with the Canopus C1 pattern Polaris noted. Not observed again in this session.

---

## action taken

- QA report written: `docs/qa/REPORTS/TASK-2026-05-26-HTML-FIRST-01.md` (this file)
- AUDIT.md entry appended: `.claude/signatures/AUDIT.md`
- REVISE handoff to Betelgeuse written: `.claude/handoffs/from-algol/REVISE-2026-05-26-HTML-FIRST-01--to-betelgeuse.md`
  (scope: erratum to AUDIT.md + DIRECTIONS.md paragraph trimming)
- PASS handoff to Polaris written (pending Betelgeuse erratum): `.claude/handoffs/from-algol/TASK-2026-05-26-HTML-FIRST-01-AUDIT--to-polaris.md`
- Algol sign-work per protocol

---

*algol · α-VER-06 · TASK-2026-05-26-HTML-FIRST-01 · 2026-05-26*
