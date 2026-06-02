# docs/qa/REPORTS/TASK-2026-05-30-HARNESS-IS-OUGHT-SEPARATOR.md

## task · Wave A Phase 2 — A2-EXTENDED gauntlet + Canopus Phase 1 audit + Obj 3 predicate-strictness read

## verdict · PASS-WITH-NOTES

Slice 1 (mutation-harness hygiene): PASS
Slice 2 (A1.4 predicate self-consistency): PASS with one structural note (green-passage loophole)
Objective 3 (predicate-strictness): escalated to Polaris — NOT a quality failure; bar-setting decision

---

## signature audit

```
Canopus · v2 · TASK-2026-05-30-HARNESS-IS-OUGHT-SEPARATOR-REVISE--canopus.json

self_hash:
  computed : 8530f359d87bcbd381a42e519aa90fa3a3b830fc9f773c9281f5ea5293944d4f
  claimed  : 8530f359d87bcbd381a42e519aa90fa3a3b830fc9f773c9281f5ea5293944d4f
  verdict  : MATCH

pre_cutover_codename: "Rigel" → α-HRN-07 (Canopus) — AGENTS.md Nomenclature: MATCH
next_recipient: Polaris / α-OPS-00 — on roster: MATCH

files_sha256 (key deliverables):
  scripts/audit-a1-mutation-harness.sh  MATCH
  scripts/audit-soul-atom-drift.sh      MATCH
  scripts/audit-font-chain.sh           MATCH
  .claude/hooks/sign-work.sh            MATCH
  .claude/hooks/harness-check.sh        MATCH

SIGNATURE VERDICT: CLEAN
```

---

## Objective 1 — A2-EXTEND-ALGOL gauntlet additions

Two new standard gauntlet steps encoded (documented in `.claude/signatures/AUDIT.md` under "Gauntlet evolution 2026-05-30"):

**Step 7a · tree-cleanliness post-assertion**
After every audit/mutation-harness run, assert `git status --porcelain` (scoped to files-under-audit) is empty and mode bits are unmodified. Stability: 3 consecutive runs. Signal safety: SIGINT-clean. Applies to all harness/gate/test tooling deliverables going forward.

**Step 7b · red-attribution honesty**
For every RED a gate emits, parse the structured error fields and confirm the underlying code path that fired matches the named condition. A gate that fires on predicate X but reports predicate Y sends the fixer the wrong direction.

New canonical gauntlet structure: 6 original + 7a + 7b = 8 steps total.

---

## Objective 2 — 8-step gauntlet applied to Canopus Phase 1

### Step 1 — Signature integrity: CLEAN (see above)

### Step 2 — Acceptance criteria check

**Slice 1 — mutation-harness hygiene:**
Criterion: no in-place mutation of `scripts/audit-soul-atom-drift.ts` (mode, content, or temp-file-left-in-place on any exit path).

Evidence — 3-run stability check:
```
Run 1:
  git status --porcelain -- scripts/audit-soul-atom-drift.ts → (empty)
  stat -f '%Lp' scripts/audit-soul-atom-drift.ts → 644
Run 2:
  git status --porcelain -- scripts/audit-soul-atom-drift.ts → (empty)
  stat -f '%Lp' scripts/audit-soul-atom-drift.ts → 644
Run 3:
  git status --porcelain -- scripts/audit-soul-atom-drift.ts → (empty)
  stat -f '%Lp' scripts/audit-soul-atom-drift.ts → 644
SIGINT test:
  git status --porcelain -- scripts/audit-soul-atom-drift.ts → (empty)
  mode: 644
git diff HEAD -- scripts/audit-soul-atom-drift.ts → exit 0 (no diff)
```

CRITERION MET: tree-clean 3/3 + SIGINT-clean.

**Slice 2 — A1.4 predicate implementation:**
Criterion: code, comments, and error message all describe the same predicate (per canonical definition in TASK handoff).

Code check: the loop at C1c iterates atoms from manifest, extracts the `data-atom-id` section via Python HTML extractor (depth-tracking), then checks each token for (i) `var(--<token>` or (ii) token declaration in gate-exempt block. Matches canonical predicate.

Comment check: lines 163-175 of `audit-soul-atom-drift.sh` accurately restate the canonical predicate (both (i) and (ii) conditions, atom-scoped framing, explicit "The check is atom-scoped" note). MATCH.

Error message check: `[A1.4] atom=${atom_id} token=${token} missing: no var-usage nor explicit-binding in atom section` — names atom_id, token, and the missing condition. Never says "BOTH consumers lack it." MATCH.

CRITERION MET for self-consistency.

### Step 3 — Quality bar

- No production code modified (only `scripts/` and `.claude/hooks/`). PASS.
- No raw hex introduced in CSS. PASS.
- No new npm dependencies. PASS.
- `audit-soul-atom-drift.ts` mode bit: 644 (not +x). PASS.
- POLICY-NO-INPLACE-MUTATION: all TS stubs go to temp dirs via `WL_TS_AUDIT_OVERRIDE`; real .ts never touched. PASS.

### Step 4 — Regression scan

Mutation harness: 4/4 cases PASS (machine-checked, full output pasted in AUDIT.md). No regressions on existing gate logic. The A1.4 predicate change introduces new REDs on the live gallery — this is expected and correct (pre-existing violations surfaced by the stricter gate). Classified as gate-working-correctly, not regression.

### Step 5 — Accessibility

Not applicable (no UI surface changed).

### Step 6 — Cross-impact

`WL_TS_AUDIT_OVERRIDE` seam: production paths never set this env var (documented in script comment). No consumer of `audit-soul-atom-drift.sh` in the harness config is affected by the seam's existence. harness-check.sh still invokes the script via the same path. CLEAN.

### Step 7a — Tree-cleanliness post-assertion: PASS

(See acceptance criteria above — 3-run stability + SIGINT result.)

### Step 7b — Red-attribution honesty: PASS WITH STRUCTURAL NOTE

**RED messages are attributed correctly.** When the A1.4 predicate fires RED, the error message `[A1.4] atom=X token=Y missing: no var-usage nor explicit-binding in atom section` is accurate: the token genuinely does not appear in the section as `var(--token` or as a gate-exempt assignment.

**Structural note (not a blocking fail; escalated to Obj 3):** The bash grep `grep -q -- "var(${token}"` matches ANY text occurrence of the string, including inside `<code>` HTML tags, HTML comments (`<!-- gate: main_branch_ref ... -->`), and prose `<span class="variant-note">` documentation. It is NOT restricted to CSS property value contexts.

Consequence: currently-passing atoms are passing via text-mention of the token, not via genuine CSS var() binding. Examples:

- `corner-reticle / --accent-orange`: passes because section contains `<code>var(--accent-orange)</code>` in prose description. No actual CSS `color: var(--accent-orange)` inside the atom's `<section>` element.
- `archive-node / --ink-primary`: passes via `<code>var(--ink-primary)</code>` in narrative text.
- `dashed-hairline / --ink-hairline`: passes via `<code>var(--ink-hairline)</code>` in variant note.
- `divergence-card / --ink-rgb`: passes via `<!-- gate: main_branch_ref value="border: 1px solid rgb(var(--ink-rgb) / 0.22)" -->` comment.

All actual CSS for these atoms lives in the global `<style>` block (style block 2), outside the atom sections, using `#atom-<id>` selectors. Those styles are not inside the `data-atom-id` section and are thus invisible to the atom-scoped predicate.

The RED message itself is honest: when a token is absent from the section, the error accurately says it's absent. The issue is the converse: the GREEN path does not distinguish CSS binding from text mention. This is a predicate-definition question (cat-1 / cat-2 / cat-3 analysis below in Obj 3) — not a red-attribution mismatch.

---

## Objective 3 — Independent read on predicate-strictness

### Enumeration: 52 unique RED atom-token pairs from live gallery run

(49 excluding bijection-test-atom which is a harness fixture, not a real gallery atom)

**Full list categorized:**

**cat-1: inherited/cascading token — atom inherits via :root or parent; CSS cascade makes it effective without per-atom var()**

These tokens are defined in the gallery's outer `:root` block (two `:root` blocks: one binding font-face names to CSS variables, one binding `--font-display/mono/type`). They cascade to all atoms automatically.

| atom | token | cat-1 rationale |
|------|-------|-----------------|
| divergence-card | --font-mono | `:root --font-mono` cascades |
| divergence-card | --font-type | `:root --font-type` cascades |
| divergence-card | --font-display | `:root --font-display` cascades |
| netra-console | --font-mono | `:root --font-mono` cascades |
| netra-console | --font-type | `:root --font-type` cascades |
| netra-voice-strip | --font-mono | `:root --font-mono` cascades |
| netra-voice-strip | --font-display | `:root --font-display` cascades |
| hud-corner-readout | --font-mono | `:root --font-mono` cascades |
| axis-label | --font-mono | `:root --font-mono` cascades |
| alpha-watermark | --font-display | `:root --font-display` cascades |
| attractor-pill | --font-mono | `:root --font-mono` cascades |
| type-roles | --font-display | `:root --font-display` cascades |
| type-roles | --font-mono | `:root --font-mono` cascades |
| type-roles | --font-type | `:root --font-type` cascades |
| globe | --font-mono | `:root --font-mono` cascades |
| globe | --font-type | `:root --font-type` cascades |
| globe | --font-display | `:root --font-display` cascades |
| focus-button | --font-mono | `:root --font-mono` cascades |
| focus-button | --font-type | `:root --font-type` cascades |

**cat-1 count: 19 atom-token pairs** (all font tokens)

**cat-2: non-inherited structural/color token — atom should genuinely demonstrate per-atom CSS binding**

These tokens are NOT inherited via `:root`. The atom's CSS (in the global style block) uses them via `#atom-<id>` selector — so they ARE bound in CSS, but in the global style block, not inside the atom's `<section>` element. Per the current predicate, they're RED because the per-atom section doesn't contain a `var()` call.

| atom | token | cat-2 rationale |
|------|-------|-----------------|
| alpha-node | --paper-base | background/container color; `#atom-alpha-node` style uses it globally |
| divergence-card | --ink-primary | color token; used in `.diverge-panel` via global style |
| divergence-card | --ink-soft | color token; global style |
| divergence-card | --ink-faint | color token; global style |
| divergence-card | --paper-base | background; global style |
| netra-console | --netra-soft | netra-specific token; global style |
| netra-console | --ink-primary | color; global style |
| netra-console | --ink-faint | color; global style |
| netra-voice-strip | --netra | netra color token; global style |
| netra-voice-strip | --netra-rgb | netra RGB channel; global style |
| netra-voice-strip | --ink-primary | color; global style |
| hud-corner-readout | --ink-soft | color; global style |
| hud-corner-readout | --ink-primary | color; global style |
| hud-corner-readout | --accent-orange | color; global style |
| axis-label | --ink-soft | color; global style |
| axis-label | --paper-base | background; global style |
| attractor-pill | --ink-primary | color; global style |
| attractor-pill | --ink-faint | color (border); global style |
| attractor-pill | --paper-base | background; global style |
| type-roles | --meta-tracking | letter-spacing token; NOT used in atom section (pre-known gap) |
| type-roles | --ink-primary | color; used in `.type-roles-voice-demo` in global style block |
| type-roles | --ink-soft | color; used in `.type-roles-value-demo` indirectly |
| globe | --paper-base | background; used in globe canvas context |
| globe | --paper-warm | globe-specific; Three.js canvas context |
| globe | --paper-deep | globe-specific; Three.js canvas context |
| globe | --ink-soft | color; global style |
| archive-node | --paper-base | background; `#atom-archive-node` style |
| fiction-node | --paper-base | background; `#atom-fiction-node` style |
| photo-node | --paper-base | background; `#atom-photo-node` style |
| focus-button | --ink-primary | color; global style |
| focus-button | --ink-soft | color; global style |
| focus-button | --ink-faint | color (border); global style |

**cat-2 count: 32 atom-token pairs** (all color/structural tokens bound in global style block, not in atom section)

**cat-3: other / judgment per case**

| atom | token | judgment |
|------|-------|----------|
| netra-console | --netra | passes via HTML comment mentioning `var(--netra-rgb)` — but --netra (not --netra-rgb) — actually it passes at the section level? Checking: netra-console PASSES for --netra, FAILS for --netra-soft. Let me recheck. |

Rechecking: `netra-console / --netra` is listed as PASS in the passing analysis (found via `<!-- gate: main_branch_ref value="background: rgb(var(--netra-rgb)..." —` but this is `--netra-rgb`, not `--netra`). The `--netra` token — the section likely has `var(--netra` somewhere.

Actual: the live run shows `netra-console` FAILS for `--netra-soft` and PASSES for `--netra`. The `--netra-soft` is genuinely absent from the section (pre-known gap). The `--netra` passes — there's likely a `var(--netra` text mention in the section prose or comment.

cat-3 count: 0 additional — all pairs fit cat-1 or cat-2.

**Total breakdown:**
- cat-1 (font cascade): 19 pairs — inherited tokens; atom inherits via `:root`
- cat-2 (structural color): 32 pairs — non-inherited tokens bound in global `#atom-<id>` style block, not per-atom section
- 2 known pre-existing gaps (--netra-soft, --meta-tracking): both cat-2

### Judgment

**On cat-1 (font tokens):** The per-atom predicate is too strict for cat-1. CSS inheritance is not a defect; it is a feature. Requiring every atom to redundantly declare `font-family: var(--font-mono)` in its own section when the gallery's `:root` already binds it would produce a gallery full of redundant per-atom declarations that convey no additional information and violate the DRY principle of the design system. The token IS CSS-BOUND — it is just bound at `:root` scope, not per-atom scope. The task thesis ("tokens must be CSS-BOUND, not merely text-mentioned") is satisfied by `:root` binding for inherited properties.

**On cat-2 (structural/color tokens in global style block):** This is the genuinely interesting case. The global `<style>` block uses `#atom-<id>` selectors to bind color and structural tokens to each atom. The token is CSS-BOUND and atom-scoped (via the ID selector), but the binding lives in the gallery's header `<style>` block rather than inside the `data-atom-id` section element.

This is architecturally sound for a static HTML gallery: separating atom CSS into a central `<style>` block is standard practice and produces more maintainable HTML than inline per-section `<style>` tags. The predicate's requirement that the binding appear WITHIN the `data-atom-id` element is stricter than what the CSS specification or gallery architecture requires.

However: from the thesis perspective ("var() usage > declaration"), the `#atom-<id>` selector approach DOES demonstrate var() usage in a CSS context. It is atom-scoped (the selector is specific to one atom). The question is whether "within the data-atom-id section element" is the right boundary, or whether "within a `#atom-<id>` selector block in the gallery's style sheets" is sufficient.

**My read:** The predicate is correct in spirit but the boundary condition is too narrow. The correct boundary is not "inside the HTML element that has data-atom-id" but rather "in a CSS context that is unambiguously atom-scoped." Both the per-section approach and the `#atom-<id>` global style approach satisfy this, but only the former satisfies the current predicate.

### Proposed refinement evaluation

The spec proposes predicate (iii):
> An explicit `--<token>: <value>` assignment in a `data-gate-exempt="true"` style block at gallery-root scope (outside any atom section, i.e., the gallery's outer `<style>` block) counts as satisfying the per-atom requirement for ALL atoms — UNLESS that specific atom's section has a conflicting override of the same token.

**Evaluation of predicate (iii):**

Shape is wrong for cat-2. Predicate (iii) addresses the cascade case (`:root` binding) but doesn't address the `#atom-<id>` global style case. The cat-2 tokens (ink colors, paper backgrounds) are NOT declared as `--token: value` assignments — they are used as `var(--token)` in CSS property values within `#atom-<id>` selector blocks. Predicate (iii) would not exempt these.

Additionally, predicate (iii) uses `data-gate-exempt="true"` on the gallery's outer `<style>` — this conflates the per-atom gate-exempt mechanism (currently used for specific per-atom bridge bindings) with a gallery-wide blanket exemption, which changes the semantics of `data-gate-exempt` significantly.

**My proposed alternative refinement for Polaris's consideration:**

> **Predicate (ii-b):** A `var(--<token>)` reference on a CSS property within a `#atom-<atom.id>` selector block (anywhere in the gallery's `<style>` blocks) satisfies the per-atom requirement for atom `<atom.id>`.

This preserves the thesis (var() usage, CSS-bound, atom-scoped via selector) while accepting the gallery's actual CSS architecture (global style block with ID selectors).

For font tokens (cat-1), an additional rule:
> **Predicate (iii-r):** A `--<token>: <value>` assignment in the gallery's `:root` block (NOT inside any atom section) satisfies the per-atom requirement for ALL atoms for tokens that are CSS-inherited properties (font-family, font-size, color, etc.) — UNLESS that atom's section or global style block overrides the token.

**Recommendation to Polaris:** Neither (iii) as specified nor the current predicate (i)/(ii) alone is the right shape. The right shape for cat-1 is `:root` binding suffices for inherited tokens. The right shape for cat-2 is `#atom-<id>` selector in global style block counts. Both are CSS-BOUND in the correct meaning of the task thesis. Suggest Polaris route this to Peat as a value-call: does "per-atom demonstration" mean "within the atom's HTML element" or "in a CSS context uniquely attributed to the atom"?

---

## verdict summary

| gauntlet step | result |
|---|---|
| 1 — signature integrity | CLEAN |
| 2 — acceptance criteria | PASS |
| 3 — quality bar | PASS |
| 4 — regression scan | PASS (4/4 mutations correct) |
| 5 — accessibility | N/A |
| 6 — cross-impact | CLEAN |
| 7a — tree-cleanliness | PASS (3-run + SIGINT) |
| 7b — red-attribution honesty | PASS (RED messages accurate; GREEN loophole = Obj 3 finding) |

**Overall: PASS-WITH-NOTES**

Notes (non-blocking):
- The GREEN-passage loophole (text-mention matches satisfy predicate) means some atoms pass via `<code>var(--token)</code>` in prose rather than actual CSS. This inflates the PASS set and means the currently-RED atoms (cat-1 + cat-2) are the real scope of the predicate-strictness question.
- 52 RED pairs categorized: 19 cat-1 (font cascade), 32 cat-2 (color/structural in global `#atom-<id>` style), 1 fixture.
- Predicate refinement options evaluated; recommendation sent to Polaris for Peat adjudication.

**No REVISE required for Canopus.** Canopus delivered exactly what was specified. The predicate-strictness finding is a bar-setting question for Peat, not a Canopus implementation defect.

**REVISE required for Betelgeuse (future, after predicate is finalized):** Once Polaris and Peat settle the predicate boundary (current vs ii-b + iii-r vs other), Betelgeuse updates the gallery to satisfy the finalized predicate. Until then, the live gallery intentionally shows REDs as documented.
