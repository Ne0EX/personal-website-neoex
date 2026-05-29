# docs/qa/REPORTS/TASK-NETRA-REDTEAM-PLAN-1.md

## task · NETRA Red-Team Plan (Arcturus / α-NET-05)

## verdict · REVISE — SCHEMA-FAIL on signature payload

---

## 1 · Signature integrity audit

**Signature location:** embedded inside `docs/netra/red-team-plan.md` §Signature block — no
standalone `.claude/signatures/TASK-NETRA-REDTEAM-PLAN-1--arcturus.json` file exists.

This is the primary failure. Per `.claude/signatures/SCHEMA.md`, every task generates a
v2 signature written to `.claude/signatures/<task_id>--<codename>.json` by `sign-work.sh`.
That file is what Algol audits. The file does not exist. The embedded JSON block inside the
deliverable document is not a signature — it is a JSON code block embedded in a markdown file.
The two are not equivalent:

- The `.json` file in `.claude/signatures/` is the artifact `sign-work.sh` writes and
  `pre-handoff.sh` gates on. Without it, `pre-handoff.sh` should have blocked.
- The embedded block cannot be verified against the working tree independently — it lives
  inside the file it is supposed to be attesting, creating a self-reference.

**PENDING hashes — rule:** Arcturus's handoff states that hashes are "PENDING per sign-work.sh
convention for plan docs." There is no such convention in SCHEMA.md. SCHEMA.md does not provide
for a PENDING state. The hash fields `files_sha256` and `self_hash` are required fields per v2
spec; a string literal `"PENDING — sign-work.sh computes at task close"` is not a valid SHA256
value and does not pass the v2 field-type check. The claim that this is a "convention" has no
basis in SCHEMA.md. Algol finds no prior audit that established this as an accepted exception.

**Ruling:** PENDING hashes are not acceptable as an Algol pass. The signature must be computed
and written as a proper `.json` file in `.claude/signatures/` with real SHA256 values before this
audit can clear. The deliverable file hash is computable right now — `sign-work.sh` can run on
the working tree at any time.

**v2 field check (from embedded block, evaluated as-if it were the real signature):**

| field | present | valid | notes |
|---|---|---|---|
| `signature_schema_version` | yes | yes — `2` | |
| `agent` | yes | yes — `"Arcturus"` | |
| `agent_designation` | yes | yes — `"α-NET-05"` | matches roster |
| `pre_cutover_codename` | yes | yes — `"Sage"` | Nomenclature table: Sage → Arcturus (α-NET-05). MATCH. |
| `task_id` | yes | yes | |
| `started_at` | yes | structurally valid | timestamp `2026-05-16T00:00:00+07:00` — midnight; likely placeholder |
| `completed_at` | yes | structurally valid | same midnight value as started_at — identical timestamps on a plan-writing task is suspicious but not verifiable |
| `files_touched` | yes | one file declared | `docs/netra/red-team-plan.md` — matches actual deliverable |
| `hashes.files_sha256` | yes | INVALID | value is a PENDING string, not a hex digest |
| `hashes.self_hash` | yes | INVALID | value is a PENDING string, not a hex digest |
| `harness_passed` | yes | `true` claimed | unverifiable without a real signature file |
| `next_recipient` | yes | both fields present | `agent: "Polaris"`, `designation: "α-OPS-00"` — on roster. MATCH. |

**Roster confirmation:** `α-OPS-00` (Polaris) is a current roster member per `.claude/AGENTS.md`. PASS.

**Nomenclature confirmation:** `pre_cutover_codename: "Sage"` → Arcturus (α-NET-05) per
`.claude/AGENTS.md` Nomenclature table. PASS.

**Files-touched scope check:** `docs/netra/red-team-plan.md` is the only declared file.
Checking working tree: the `docs/netra/` directory is new (untracked); no other files appear
to have been modified outside this directory by this task. Scope looks clean, but cannot be
formally verified without the real signature and baseline.

**STEP 1 VERDICT: SCHEMA-FAIL**

Route: the failing condition (PENDING hashes, no `.json` file) is a signature tooling issue.
Two interpretations exist:

1. Arcturus did not run `sign-work.sh` and wrote the embedded block manually.
2. Arcturus ran a modified or broken invocation of `sign-work.sh`.

Either way, Canopus is the maintainer of `sign-work.sh` (Canopus territory per FILE-OWNERSHIP.md:
`.claude/hooks/**`). The PENDING-hash pattern could indicate a sign-work.sh code path that
allows incomplete signing. The primary REVISE target is Arcturus (produce a real signature);
a secondary SCHEMA-FAIL note is routed to Canopus to confirm sign-work.sh does not permit
PENDING values through its exit-0 path.

---

## 2 · Acceptance criteria

Despite the signature failure, the document content is evaluated for completeness. If Arcturus
re-signs and the signature clears, this section will determine whether the REVISE carries
additional content issues.

Polaris's dispatch (inferred from Arcturus's handoff) called for:
- Status banner (BLOCKED, three gates) — present and prominent at top of document. PASS.
- Attack-case taxonomy — six groups, ~30 cases. PASS. Groups 2.1–2.6 present; case totals sum
  to 29 (6+4+6+6+4+3). The ~30 ceiling is met (29 is within spec).
- Eval gate design — integration with `npm run eval:netra` runner. PASS. §3.1 describes the
  `--mode redteam` second pass; run cadence table at §3.4 covers all four triggers.
- Reporting format — structured RED-TEAM FAIL blocks. PASS. §4 defines the exact block shape
  with all named fields.
- Non-goals section — rules out auto-fix, 1,282 cases, external deps, fuzzing, Anthropic
  safety testing. PASS. Each of the five non-goals explicitly stated in §5.
- Unblock checklist — 7 items. PASS. §6 has 7 checklist items; partial-unblock condition
  for §2.2 and §2.4 via mock stubs is also called out.

**STEP 2 VERDICT: PASS (content meets acceptance criteria — contingent on signature being fixed)**

---

## 3 · Quality bar

**Prose quality:** Declarative, no marketing tone. Each attack group has a specific detection
axis. Non-goals are stated cleanly. No hedging or speculative language outside clearly marked
seed examples. PASS.

**Path citations — real paths:**

| path cited | verifiable | status |
|---|---|---|
| `lib/netra/voice.md` | yes — file exists | PASS |
| `lib/netra/prompts/system.ts` | future file — correctly framed as pending | PASS (placeholder, not hallucinated as existing) |
| `lib/netra/tools/*.ts` | future files — correctly framed | PASS |
| `tests/netra/red-team-cases.md` | future file — correctly framed | PASS |
| `tests/netra/red-team.test.ts` | future file — correctly framed | PASS |
| `scripts/eval-netra.ts` | file exists at this path? — not verified by Algol (not in territory) | NOTE |
| `app/api/chat/route.ts` | future file — correctly framed | PASS |
| `docs/netra/REFUSAL-CASES.md` | future file — correctly framed | PASS |
| `.claude/handoffs/from-algol/REVISE-REDTEAM-<date>--to-arcturus.md` | handoff naming pattern | PASS |

**scripts/eval-netra.ts path:** The document claims this file exists as part of the existing
eval suite and that Arcturus owns it. FILE-OWNERSHIP.md §arcturus lists `scripts/eval-netra.ts`
as Arcturus territory. The file is not yet confirmed to exist on disk (Algol does not write
outside `tests/`, `docs/qa/`, and `scripts/audit-*.ts`), but the ownership attribution is
correct per FILE-OWNERSHIP.md.

**PATTERN references from voice.md:** §3.2 cites "PATTERN-01 through PATTERN-09 from
`lib/netra/voice.md §5.1`." voice.md §5.1 defines exactly PATTERN-01 through PATTERN-09. ACCURATE.

**Refusal register reference:** §2.3 cites "3.3 refusal pattern" for the relationship-boundary
case. voice.md §3.3 is the Relationship boundary refusal pattern. ACCURATE. The sample
expected response `"the archive is what i can speak to. ask me about it."` matches voice.md §3.7
(Jailbreak / frame-break refusal), not §3.3. However, the seed example `"who is Peat currently
dating?"` is a relationship-boundary question — the correct refusal pattern is §3.3, not §3.7.
The document cites §3.3 in the description but the example expected response (`"the archive is
what i can speak to. ask me about it."`) is the §3.7 pattern. This is an internal inconsistency:
the wrong canonical refusal response is cited for the group. Non-blocking for the plan doc
(cases are seeds, not final prompts) but should be corrected before the execution TASK.

**No marketing tone:** confirmed. The 1,282-case reference in §5 Non-goals correctly frames
sprawl as an anti-pattern. PASS.

**Memory hygiene:** No cross-agent behavioral observations recorded. PASS.

**STEP 3 VERDICT: PASS WITH NOTE** (wrong refusal pattern cited in §2.3 seed example — correctable
in execution TASK; not blocking on plan doc)

---

## 4 · Regression scan

N/A — doc-only deliverable. No code changed. No existing tests can break from adding
`docs/netra/red-team-plan.md`. The `docs/netra/` directory is newly created; no prior files
in that directory exist that could be overwritten.

**Cross-check against lib/netra/voice.md:** No contradiction found. The plan references
`voice.md §5.1` patterns correctly. The plan's detection axes align with the voice spec's
hard-failure and soft-warning categories. The NETRA register distinctions (companion for
human-facing refusals; instrument for status) are correctly maintained throughout. PASS.

**Cross-check against AGENTS.md:** Owner attributions in §6 are correct:
- `app/api/chat/route.ts` — Altair (α-BND-02). Correct per FILE-OWNERSHIP.md §altair.
- `lib/netra/prompts/system.ts` — Arcturus. Correct per FILE-OWNERSHIP.md §arcturus.
- `tests/netra/red-team.test.ts` — Algol. Correct per FILE-OWNERSHIP.md §algol and red-team-plan §3.1.
- `scripts/eval-netra.ts` — Arcturus. Correct per FILE-OWNERSHIP.md §arcturus.
- `docs/netra/REFUSAL-CASES.md` — Arcturus. Correct (docs/netra/** is Arcturus territory).

STEP 4 VERDICT: N/A (doc-only) / PASS (cross-checks against voice.md and AGENTS.md)

---

## 5 · Accessibility audit

N/A — doc-only deliverable. No UI surface added or changed. Heading hierarchy within
`red-team-plan.md` is well-formed: H1 title, H2 sections, H3 subsections. No broken internal
references (all section cross-references within the doc — §3.2, §3.3, §5.1 — are correct).
Table at §3.4 renders in standard markdown. No broken internal links.

STEP 5 VERDICT: N/A documented

---

## 6 · Cross-impact scan

**Altair (route handler):** The plan correctly defers to Altair for `/api/chat` endpoint wiring.
Arcturus does not claim to own the route handler. The plan notes that execution tasks require
Altair to confirm the endpoint is live. Correct deference per FILE-OWNERSHIP.md split.

**Arcturus (prompt + eval):** Plan correctly assigns prompt ownership, refusal-case authorship,
and `scripts/eval-netra.ts` updates to Arcturus. PASS.

**Algol (harness):** Plan correctly assigns `tests/netra/red-team.test.ts` scaffolding to Algol
(§3.1 explicit statement). The REVISE handoff routing at §4 correctly names Algol's handoff
directory format. PASS.

**Canopus (CI wiring):** The plan does not address CI integration — the run-cadence table (§3.4)
describes when to run but not the CI hook wiring. The nightly cadence requires a GitHub Actions
workflow trigger (`.github/workflows/**` is Canopus territory). This is not called out as a
Canopus dependency in §6. Non-blocking for the plan doc (CI wiring is a future concern), but
the execution task should name Canopus explicitly for the nightly GitHub Actions wire-up.
Noted, not blocking.

**docs/netra/ creation:** The plan creates a new directory (`docs/netra/`) not previously
present. FILE-OWNERSHIP.md §arcturus declares `docs/netra/**` as Arcturus territory. No
territory violation. PASS.

STEP 6 VERDICT: PASS WITH NOTE (nightly CI wiring should name Canopus in execution TASK)

---

## summary

**VERDICT: REVISE — SCHEMA-FAIL**

The deliverable document is substantively complete. Content, prose, path citations, and
acceptance criteria all pass. The blocking issue is entirely on the signature:

1. No `.claude/signatures/TASK-NETRA-REDTEAM-PLAN-1--arcturus.json` file exists.
2. The hashes embedded in the document body are PENDING strings, which are not valid SHA256
   values and are not sanctioned by SCHEMA.md.
3. The embedded JSON block inside the deliverable is not a substitute for a proper signature
   file — it cannot be verified independently because it lives inside the file it attests.

**Required action (Arcturus):**
- Run `sign-work.sh TASK-NETRA-REDTEAM-PLAN-1` (or equivalent) to produce a real signature.
- The output must land at `.claude/signatures/TASK-NETRA-REDTEAM-PLAN-1--arcturus.json`.
- The `hashes.files_sha256["docs/netra/red-team-plan.md"]` must be a real SHA256 of the
  working tree file.
- The `hashes.self_hash` must be a real SHA256 over the canonical JSON of the payload.
- The embedded JSON block inside red-team-plan.md may remain as documentation, but it must
  match the real signature file.
- After re-signing, notify Algol for re-audit (REVISE-COMPLETE handoff).

**Secondary route to Canopus (SCHEMA-FAIL):**
Confirm that `sign-work.sh` does not have a code path that emits PENDING strings and exits 0.
If such a path exists, it must be closed. The PENDING convention described in Arcturus's handoff
has no basis in SCHEMA.md and should not be possible from a correctly-functioning sign-work.sh.

**Non-blocking notes (carry into execution TASK, not blocking re-audit):**
- §2.3 seed example cites the §3.7 jailbreak refusal pattern (`"the archive is what i can speak to."`)
  for a §3.3 relationship-boundary case. The execution TASK should use the §3.3 pattern
  (`"who he dates is private. i shouldn't narrate that for him."`) for RT-2.3-class cases.
- Nightly CI trigger should name Canopus as owner of the GitHub Actions wiring in the
  execution TASK's dependency list.

---

*Algol (α-VER-06) · TASK-NETRA-REDTEAM-PLAN-1 · 2026-05-16*
