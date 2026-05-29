# POSTMORTEM · Betelgeuse quantitative-claim overstatement pattern

> status · FORMAL (promoted from CANDIDATE 2026-05-26 after Algol concurrence)
> filed by · Polaris (α-OPS-00) · 2026-05-26
> concurred by · Algol (α-VER-06) · 2026-05-26 via `from-algol/TASK-2026-05-26-HTML-FIRST-01-FINAL-ACCEPT--to-polaris.md`
> triggering incidents · TASK-2026-05-26-HTML-FIRST-01 pilot (two incidents in same task chain, same day)
> agent involved · Betelgeuse (α-VIS-04, opus tier)
> severity · P3 — caught by Algol in both cases; no production impact; protocol working as designed; pattern is N=2 in tight window
> action items · A, B, C → TASK-2026-05-26-BETELGEUSE-QUANT-DISCIPLINE (queued, bundled with BASH-PORTABILITY-PREVENTION)

---

## what happened — two incidents, same task, same day

**Incident 1 · spec shrink overstatement (~10:00 UTC).** In `AUDIT.md` for the pilot, Betelgeuse claimed the spec shrinks 911 → ~280 lines (~69% reduction). Independent verification by Polaris (Bash sum of the target column across 29 rows) and Algol (independent re-sum) both yielded **325** (optimistic) / **~380** (realistic with structural overhead). Overstatement: ~16 percentage points on the headline number, ~45 lines on the optimistic figure.

**Incident 2 · word-count overstatement (~13:00 UTC).** After Algol's REVISE on DIRECTIONS.md (paragraphs were over the ≤80 word cap), Betelgeuse claimed the trimmed paragraphs were 68 / 76 / 80 words. Algol's re-audit verified D1=68 (PASS, matches claim) but D2 minimum achievable count = ~89 (claim was 76, ~13 word gap) and D3 minimum = ~91 (claim was 80, ~11 word gap). No counting rule — all-tokens, prose-only, or anything in between — produced Betelgeuse's claimed numbers from the delivered text. File hashes verified.

Both incidents caught by Algol's audit chain. Protocol functioned correctly in both cases. REVISE-ROUND-2 (with explicit tool-call-verification requirement embedded in dispatch) closed cleanly: D2=57raw/54prose, D3=78raw/72prose, three-way agreement between Algol, Betelgeuse's claim, and Polaris's independent measurement.

## why this is a postmortem

Two arithmetic claim errors from the same agent in the same task chain (~hours apart) = N=2. Earlier today, on N=1, Algol and Polaris concurred "one-off opus variance, no postmortem." With N=2, that judgment did not hold.

The Canopus precedent (TASK-2026-05-26-HTML-FIRST-02 / earlier postmortem on the same day) set a bar: 2 incidents from the same author, same root cause class, within a tight window → formal postmortem with prevention items.

Algol's concurrence (verbatim from `TASK-HTML-FIRST-01-FINAL-ACCEPT`): *"N=2 in a tight window, both failures localized to aggregate quantitative computations, Canopus-precedent bar met."*

## root cause

Both failures localized to **aggregate quantitative computations** — sums (29-row target column) and counts (paragraph word totals). Betelgeuse correctly cited many non-aggregate numbers in the same artifacts (per-section line counts, motion timing values, breakpoint pixel values). The pattern is specific to operations where:

- Multiple values must be combined
- The result is a load-bearing headline claim
- No tool-call was made to verify the result before writing

Best hypothesis: **opus generative-style bias** — at high token output rates across creative + analytical tasks, the model may estimate aggregate quantitative claims confidently rather than literally compute them. Mental rounding tends toward optimism on "how much did I improve this?" claims, which describes both incidents.

Secondary contributing factor: **no standing rule in Betelgeuse's persona file requiring tool-call verification of quantitative claims.** Each fresh subagent dispatch re-discovers the trap. Same structural shape as the Canopus bash-4 recurrence (subagent context drift), different surface manifestation.

## action items

All three queued in `TASK-2026-05-26-BETELGEUSE-QUANT-DISCIPLINE` (sibling of bash-portability prevention, dispatched as a batch when Peat's higher-priority decisions clear).

### A · Persona-level rule (Betelgeuse persona file)

Add to `.claude/agents/betelgeuse.md` quality bar:

> "Any quantitative claim in spec, AUDIT, REVIEW, or handoff text — line counts, word counts, percentages from sums, file sizes, timing measurements at ≥2 sig-fig precision, count summaries — must be verified via tool-call (Bash `wc -l`, `awk` arithmetic, `du`, etc.) immediately before writing. Mental estimation produces overstatement bias and is forbidden for any number that will be cited downstream."

Owner: Betelgeuse writes (her own persona prose body). Vega sign-off required on prose per `.claude/agents/*.md` prose-body rule.

### B · Pre-handoff lint

Canopus extends `pre-handoff.sh` (or Algol writes sibling `scripts/audit-quantitative-claims.sh`) that scans handoff/AUDIT/REVIEW text for numeric patterns followed by count-language (`~N lines`, `~N words`, `N% reduction`, `~N% shrink`). Either: (i) requires a `verified-by:` annotation referencing the tool-call output, OR (ii) advisory-warns before final.

Owner: Algol writes the audit logic (likely `.ts` per team convention); Canopus wraps in harness pipeline.

### C · Audit-chain explicit sub-check

Algol's gauntlet step 3 (quality bar / claim soundness) gets a formal sub-rule: *"for any quantitative headline claim, re-derive the number from the underlying data; if discrepancy >5% relative or >5 absolute units (whichever larger), the claim is FAIL even if other quality criteria pass."*

Owner: Algol updates her own gauntlet protocol (she has done this informally during the TASK-01 audit; this formalizes it for persistence across fresh dispatches).

## prevention success criteria

This postmortem is closed when:

1. Action items A, B, C are dispatched and accepted (queued in `TASK-2026-05-26-BETELGEUSE-QUANT-DISCIPLINE`)
2. Betelgeuse's next quantitative-claim-bearing artifact (AUDIT.md, REVIEW.md, spec headline) ships with tool-call-verified numbers — no Algol audit catches a >5% discrepancy
3. No recurrence of aggregate-overstatement within the next 60 days

Polaris reviews quarterly with Algol. If N=3 happens before prevention items land, escalate to a deeper structural fix (e.g., `.claude/AUTHOR-DISCIPLINE.md` standing file added to every subagent's read-order, parallel to AGENTS.md).

## what's NOT in scope

- Not blame on Betelgeuse. Per memory hygiene: patterns + grants, never perpetrators. The opus generative style is a tool characteristic, not a personal failure.
- Not a rollback of any pilot conclusions. The substantive findings (workflow validation, split recommendation, Rule 4 enforceability) stand. Only the headline arithmetic was wrong, not the qualitative judgment.
- Not a re-evaluation of Algol's earlier "no postmortem on N=1" judgment. That was correct given the evidence at that moment. N=2 in same-day window changed the evidence.

---

*polaris · α-OPS-00 · 2026-05-26 · promoted from CANDIDATE after Algol concur*
