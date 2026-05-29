# docs/qa/REPORTS/TASK-2026-05-29-SOUL-FACTORY.md

## task · Soul Factory — canonical soul-atom gallery

## verdict · FAIL (REVISE to Betelgeuse pending)

The core infrastructure (manifest schema, drift gate, harness wiring, Rule 5 protocol,
mini-globe hardening) passes all checks. One blocking item: a V8 lookbehind bug in
my own P2B audit code was silently skipping px-value detection in longer atom sections,
causing the gate to report 0 violations when 21 genuine uncited literals exist in the
gallery HTML. I fixed the scanner; REVISE is routed to Betelgeuse.

---

## 1 · Signature integrity

All 7 non-self signatures verified. Results:

| Agent | Phase | self_hash | files_sha256 | Notes |
|-------|-------|-----------|--------------|-------|
| Canopus | P0 | MATCH | P0 files superseded by P2 (expected chain evolution) | CLEAN |
| Betelgeuse | P1 (gallery initial) | MATCH | gallery.html + manifest.json superseded by P2-CLEANUP + P3 | CLEAN |
| Sirius | P2A (impl_ref fill) | MATCH | manifest.json superseded by P3 | CLEAN |
| Canopus | P2 (grep fix + gate) | MATCH | All current — OK | CLEAN |
| Betelgeuse | P2-CLEANUP (violations→0) | MATCH | gallery.html superseded by P3 | CLEAN |
| Vega | P2C-SIGNOFF (item 7) | MATCH | betelgeuse.md current — OK | CLEAN |
| Sirius | P3 (mini-globe hardening) | MATCH | All current — OK | CLEAN |
| Algol | P2B (self-excluded per Polaris dispatch) | — | — | EXCLUDED |

File hash mismatches on P0/P1/P2A/P2-CLEANUP are expected: later phases updated the same
files. Each later signature matches the current working tree. No integrity failures.

Roster + nomenclature: all five agents present (Canopus=Rigel/α-HRN-07, Betelgeuse=Iris/α-VIS-04,
Sirius=Pico/α-SUR-01, Vega=Quill/α-VOX-08, Algol=Cipher/α-VER-06). All designations verified
against AGENTS.md. All next_recipient designations valid current roster members.

P3 Sirius hand-authored signature: timestamp consistency confirmed (started 2026-05-29T05:05+07:00
= 2026-05-28T22:05Z, completed 2026-05-28T22:23Z, ~18 minutes — plausible). All required v2
fields present. Harness-debt fallback documented in STATUS.

Note: P1 Betelgeuse `post_edit_passed: false` is present in the signature. This predates
P2-CLEANUP and is consistent with the 20 violations found at that stage. Not an integrity defect
in P1 itself.

---

## 2 · Acceptance criteria

| Criterion | Result |
|-----------|--------|
| 12-atom gallery with token_refs + cited main_branch_refs | PASS — manifest has 12 atoms, all with impl_ref filled (Sirius P2A), all token_refs non-empty. |
| Drift gate enforces invariant | FAIL-THEN-FIXED — gate was exiting 0 with false-negative due to V8 lookbehind bug. Scanner now corrected; gate exits 1 on 21 real violations. Gallery needs Betelgeuse REVISE. |
| Rule 5 in workflow doc | PASS — docs/team/WORKFLOW-HTML-FIRST-SPEC.md row 5, confirmed. |
| Item 7 in betelgeuse.md anti-Codex checklist | PASS — "Atom reuse" at line 127 of .claude/agents/betelgeuse.md, confirmed. |
| Mini-globe reproduces per spec §11 | PASS — P3 gallery.html has the canonical standby variant (130×130 radial-gradient sphere body, repeating-linear lat/lon grid, curved-toward-poles graticule overlay, inked rim, Ne0N axis spine, orange pole beacons, α observer mark at Bangkok offset with 5px halo + reticle ring). spec-globe-v1-direction.md §11 L327 verified at line 327. All colours tokenised. Geometry in gate-exempt block with spec citation. |
| Gate exit 0 on current gallery | FAIL — gate exits 1 after scanner fix; 21 violations. REVISE to Betelgeuse. |

---

## 3 · Quality bar

- All atoms cite real tokens (zero new CSS custom properties introduced). Token refs
  verified grep-match against app/globals.css by both shell gate and TS audit.
- Variants confirmed as states/fidelity levels, not competing concepts. Globe:
  full/standby. Corner-reticle: default/micro. Type-roles: display/typewriter/meta. All valid.
- main_branch_refs with line numbers confirmed against working tree (line±3 tolerance).
  All pass. The spec §11 L327 reference passes.
- No new dependencies introduced. Gallery is standalone HTML.

---

## 4 · Regression scan

- `npm run build`: PASS (compiled in 2.9s, 4 static pages generated, no TypeScript errors).
- `node --test tests/soul-atom-drift-audit.test.mjs`: 10/10 PASS (after my lint + regex fix).
- `node --test tests/worldline-globe-coordinates.test.mjs`: 4/4 PASS.
- `bash tests/harness/prototype-layer.sh`: 8/8 PASS.
- `bash .claude/hooks/pre-handoff.sh TASK-TEST-REGRESSION sirius`: default (non-soul-atlas) path exits 0 — Canopus P2 branch additions did not regress the default path.
- `bash .claude/hooks/visual-diff.sh TASK-TEST-REGRESSION`: non-soul-atlas path exits 0 — default visual-diff path unaffected.

---

## 5 · Accessibility

Gallery is internal tooling (.claude/visual-diffs/soul-atlas/gallery.html). Not
publicly served; not a production surface. a11y audit not applicable. N/A.

The standby mini-globe in the gallery does carry `role="img"` and a descriptive
`aria-label` (verified in gallery.html lines 651-652). This is good practice but
not a blocking gate item since this is internal tooling.

---

## 6 · Cross-impact

No agent in the SOUL-FACTORY chain modified production `app/` or `components/` code.
Verified: no SOUL-FACTORY signature lists app/globals.css or components/WorldlineGlobe.tsx
in files_touched. (Both files show as dirty in the working tree but from pre-existing
earlier-task modifications, not from any SOUL-FACTORY phase.)

ATLASStandby.tsx is correctly flagged as a Rule-5 follow-up not yet built. The P3
standby render lives entirely in gallery.html (gate-exempt style block + HTML section).
No production surface was changed.

betelgeuse.md and docs/team/WORKFLOW-HTML-FIRST-SPEC.md were modified by Vega/Betelgeuse
in P2C as intended. These are their respective territories.

---

## Item A — Lint diagnostics (cleared)

4 unused declarations removed from my own P2B files:

- `scripts/audit-soul-atom-drift.ts:211` — `lineOf()` function: deleted (was never called).
- `tests/soul-atom-drift-audit.test.mjs:24` — `execSync` import: removed from destructure.
- `tests/soul-atom-drift-audit.test.mjs` test 5 — `status` destructured but not asserted: replaced `{ stdout, status }` with `{ stdout }`.
- `tests/soul-atom-drift-audit.test.mjs` test 6 — same pattern: replaced.

All 10 tests pass after the changes.

---

## Item B — Regex blind-spot (REAL — hardened; REVISE routed to Betelgeuse)

**Finding:** The blind spot is real and was hiding genuine violations. The lookbehind
patterns `(?<!var\([^)]*)` on px-value and rem-value cause V8 catastrophic backtracking
on atom sections containing prose text with long parenthetical spans. The globe section's
variant-note "Same soul at small fidelity: paper sphere (radial-gradient body + curved
graticule + inked rim)" contains a 52-character non-) span at position 3760. This causes
the lookbehind to exhaust V8's backtracking budget, silently returning zero matches for
the entire regex on the full processed string.

Measured: lookbehind correctly finds "601px" in globe section at prefix lengths ≤3812;
fails completely at ≥3819 (the position where the long prose parenthetical begins). Same
failure pattern on other atoms with prose parentheticals: corner-reticle, dashed-hairline,
alpha-node, type-roles, alpha-watermark, attractor-pill.

**Root cause confirmed:** The lookbehind is redundant. `stripVars()` already blanks all
`var(--...)` expressions before the patterns execute. The lookbehind was a vestigial guard
that became a reliability hazard.

**Fix applied:** Replaced both problematic patterns with simple equivalents:
- `(?<!var\([^)]*)-?\d+(?:\.\d+)?px(?![^)]*\))` → `-?\d+(?:\.\d+)?px`
- `(?<!var\([^)]*)\d+(?:\.\d+)?rem(?![^)]*\))` → `\d+(?:\.\d+)?rem`

**Violations surfaced:** 21 uncited literals across 7 atoms (corner-reticle, dashed-hairline,
alpha-node, alpha-watermark, attractor-pill, type-roles, globe). These are scaffold stage
sizing values, atom render values, and prose appearance-value descriptions that were never
visible to the gate before this fix.

**Gate status after fix:** exits 1 (FAIL) on the current gallery. REVISE routed to Betelgeuse
at `.claude/handoffs/from-algol/REVISE-2026-05-29-SOUL-FACTORY-GALLERY--to-betelgeuse.md`.

**Betelgeuse's resolution paths:**
1. Move scaffold stage sizing (min-width/min-height inline style attrs) to the
   per-atom rules in the gate-exempt style block (same as P2-CLEANUP did for other values).
2. Cite or move inline font-sizes (type-roles 24px, 28px) — these are atom appearance values.
3. Remove or rephrase prose text mentions of raw px values, or add to main_branch_refs.

---

## Overall verdict on soul factory soundness

The factory is structurally sound:
- Manifest schema is correct and machine-readable.
- 12 atoms are present with impl_refs, token_refs, and main_branch_refs.
- The drift gate ARCHITECTURE works (shell + TS layers, blocking exit codes, harness wiring).
- Rule 5 is in the workflow doc. Item 7 is in Betelgeuse's checklist.
- Mini-globe standby reproduces per spec §11 L327.

The gallery content has 21 uncited literals that the gate is now correctly catching.
These are Betelgeuse's work to resolve. Once resolved and gate returns to exit 0, the
soul factory is fully operational.

---

## my signature
`.claude/signatures/TASK-2026-05-29-SOUL-FACTORY-AUDIT--algol.json`

*Algol · α-VER-06 · 2026-05-29*
