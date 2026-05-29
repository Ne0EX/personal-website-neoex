# docs/qa/REPORTS/TASK-2026-05-26-HTML-FIRST-02.md

## task · TASK-2026-05-26-HTML-FIRST-02 · html-first-spec harness wiring

## auditor · Algol (α-VER-06) · 2026-05-26

## verdict · PASS WITH NOTES

---

## 1. signature integrity audit

Agent: Canopus (α-HRN-07) · pre-cutover codename: Rigel

**Schema version:** v2 — PASS
**Required fields present:** all 13 required v2 fields present — PASS
**self_hash recompute:** stored `3c69db3b…` matches computed `3c69db3b…` — PASS
**next_recipient:** `Polaris / α-OPS-00` — matches current roster — PASS
**pre_cutover_codename:** `Rigel → Canopus → α-HRN-07` — confirmed via AGENTS.md Nomenclature table — PASS

**files_touched count:** 1583 (no-baseline fallback artifact — acknowledged)

The FLAGGED ADVISORY (sign-work.sh exit 4, `post_edit_passed=false`) is correctly documented in the return handoff under "FLAGGED ADVISORY — sign-work exit 4." Root cause is the no-baseline fallback: `pre-task.sh` was not run for this hook-task dispatch, so `files_touched` captures the full working-tree dirty set. This is the established hook-task carry-over pattern, accepted by prior precedent (AUDIT.md entries for META-1, META-10, TASK-2026-05-24-HOOK-BETA-SCRIBE, and others).

**Deliverable presence in files_touched** — all six primary deliverables confirmed:

| file | present |
|---|---|
| `scripts/audit-visual-diff-directions.sh` | PRESENT |
| `.claude/handoffs/from-canopus/TASK-2026-05-26-HTML-FIRST-02--to-polaris.md` | PRESENT |
| `.claude/hooks/visual-diff.sh` | PRESENT |
| `.claude/hooks/pre-handoff.sh` | PRESENT |
| `docs/harness/RAIL-DEFINITIONS.md` | PRESENT |
| `.harness/worldline-harness.config.json` | PRESENT |

**`steps: []`** — empty array. This is the known sign-work.sh auto-generation limitation (no `TASK-ID--steps.log` written during the session). Confirmed non-blocking per prior audit precedent (TASK-08, wave-3 report, this pattern appears in >50% of hook-task signatures). Non-blocking; noted.

**No `flagged` / `flag_reason` field in JSON.** The `sign-work.sh` script does not write these fields into the JSON payload — it communicates FLAGGED status via exit code 4 and stderr only. The reason is documented in the handoff prose. This is a known tool limitation, not malfeasance. The self_hash is consistent with the actual JSON content, so no tampering occurred.

**Verdict:** ADVISORY — FLAGGED per hook-task precedent. Not INTEGRITY-FAIL. All core deliverables verified in files_touched, self_hash clean.

---

## 2. acceptance criteria

Source: Polaris dispatch `.claude/handoffs/from-polaris/TASK-2026-05-26-HTML-FIRST-02--to-canopus.md`

| criterion | result | citation |
|---|---|---|
| STATUS schema extended; documented in RAIL-DEFINITIONS.md | PASS | `docs/harness/RAIL-DEFINITIONS.md` §"Visual-diff STATUS schema" at line 1239; all 6 values present with full table + state machine + invariants |
| `directions/` discipline audit added and tested against UI-ITER-1-globe-v1 (no false positive) | PASS | `scripts/audit-visual-diff-directions.sh` present and executable; UI-ITER-1-globe-v1 test: exit 0, SKIP message — no false positive confirmed by Algol live run |
| Tested against synthetic fixture with directions/ | PASS | Algol re-ran Canopus's smoke-test fixture independently (see Step 4 below); results match Canopus's reported output exactly |
| `pre-handoff.sh` warning wired and tested | PASS | check 4d present at line 187–222 of pre-handoff.sh; advisory for prototype absence + 220-line spec cap; does not block handoff |
| Rail entry added | PASS | `docs/harness/RAIL-DEFINITIONS.md` §"Rail: html-first-spec-discipline" at line 1269; harness config entry at `.harness/worldline-harness.config.json` line 70–83 |
| Algol notified | PASS (self-satisfied — I am Algol; cc in handoff received) |

**All acceptance criteria: PASS**

---

## 3. quality bar

**Script discipline**

- `set -uo pipefail` at top — correct. Note: `set -e` is absent. This is intentional per the script's design — it accumulates violations into counters and exits at the summary rather than failing fast. Intentional and consistent with the severity model. PASS.
- Exit codes: 0 (PASS/ADVISORY), 1 (BLOCK), 2 (usage error) — clean semantics, documented in header comments. PASS.
- Log format: `[YYYY-MM-DDTHH:MM:SSZ] message` for informational lines; `[ADVISORY]` and `[BLOCK]` prefixes on stderr for violation lines. Consistent throughout. PASS.
- Error messages: all BLOCK messages include the policy rationale (Peat's directive quote), the specific fix, and a reference to the spec file. Advisory messages reference the relevant spec section. Clarity is high. PASS.
- Idempotency: the script is read-only; it does not write any state. Running it twice produces the same output. PASS.
- Functions: `check_rule4_fields`, `extract_soul_baseline`, `read_status`, `log`, `advisory`, `block`, `TS` — all well-scoped with no side effects. PASS.

**Edge case handling**

- No `directions/` directory: exits 0 silently with SKIP message at line 76–79. Confirmed live. PASS.
- Only one direction: advisory S2-item-1 fires (minimum 2 required), but script does not crash. Confirmed in Algol's own fixture run (EXIT=1 due to blank-slate blocking, not crash). PASS.
- `prototype/` without `directions/`: the guard at line 76 means if `directions/` is absent, script SKIPs regardless of `prototype/` state. This means the prototype-without-directions case never reaches S2-item-5 or S2-item-6. This is correct behavior — S2-items 5 and 6 are only coherent when `directions/` exists. PASS.
- Broken symlinks in soul-baseline path: the `-f` test at line 272 (`[[ ! -f "$RESOLVED" ]]`) returns true for broken symlinks (symlink exists but target does not). A broken symlink would correctly be reported as a blocking violation. PASS.
- `soul-baseline:` present but empty value: `extract_soul_baseline` would return an empty string; item 4 has a `[[ -z "$SB_VALUE" ]]` guard at line 247 that skips without double-counting (already caught by item 3 field check). PASS.
- Directory names with spaces: the `while IFS= read -r line` pattern correctly handles spaces in filenames. The `find -name 'direction-[0-9]*'` pattern restricts to valid names that won't contain spaces by the naming convention. PASS.

**One minor issue (non-blocking):** the `advisory()` function redirects to stderr (`>&2`) but the `log()` function goes to stdout (tee'd to log file). The BLOCK and ADVISORY prefix lines therefore appear only on stderr, not on stdout. In a terminal, the user sees all output intermixed because stderr and stdout merge. But a caller that captures stdout will miss the ADVISORY/BLOCK lines. The `visual-diff.sh` wrapper does not capture stdout — it simply checks exit code — so this has no functional impact. This is a pre-existing design choice consistent with the harness convention. I record it as a NOTE, not a fail.

---

## 4. regression scan — bash 3.2 portability (PRIMARY CHECK)

I re-ran Canopus's smoke test independently under `/bin/bash` (macOS stock, bash 3.2) on a freshly created fixture. This is the first-party verification of the compat fix.

**Bash 4 builtin scan — no remaining issues:**
`grep -nE 'mapfile|readarray|declare -A'` on `scripts/audit-visual-diff-directions.sh` — zero matches. The portable `while IFS= read -r line` pattern is at lines 142–144 and 150–152. CLEAN.

**Fixture test (INVALID — blank-slate soul-baseline):**

```
mkdir -p .claude/visual-diffs/_algol-audit-fixture/directions/direction-1
echo '<html></html>' > .../direction-1/index.html
printf 'soul-baseline: blank-slate\nconnection-point: x\ncontinuity: x\nevolution: x\nbet: x\n' > .../direction-1/README.md
echo "exploring" > .../STATUS
/bin/bash scripts/audit-visual-diff-directions.sh _algol-audit-fixture
```

**Result:**
- No bash error messages. No `mapfile: command not found`. No `unbound variable`. PASS.
- S2-item-1: ADVISORY (1 direction, minimum 2). Correct.
- S2-item-4: BLOCK — `direction-1/README.md declares soul-baseline: 'blank-slate'`. Message correctly names the violation. Correct.
- Summary: 2 advisory, 1 blocking. EXIT=1. Correct.

Output matches Canopus's reported smoke-test output exactly. PASS.

**Fixture cleanup:** `rm -rf .claude/visual-diffs/_algol-audit-fixture` — confirmed clean.

**Regression on pre-existing visual-diff directories:**

- `UI-ITER-1-globe-v1` (no `directions/`): EXIT=0, SKIP message. No false positive. PASS.
- `TASK-2026-05-15-UI-1` (no `directions/`): EXIT=0, SKIP message. No false positive. PASS.
- `TASK-2026-05-26-PHOTO-PROTOTYPE-FIRST` (has `directions/` — a real post-workflow directory): EXIT=0, all S2 checks PASS, DIRECTIONS.md present with soul-baseline + unity check. PASS. This is the first live validation of the audit script against a real compliant directions/ directory. The audit is not breaking existing compliant work.

**Verdict: PASS.** No bash 4 builtins remain. Script runs correctly under bash 3.2.

---

## 5. accessibility

N/A — harness-only deliverable. No UI surfaces changed.

---

## 6. cross-impact scan

**`visual-diff.sh` integration:**
The new audit invocation is at lines 54–66. It calls `bash "$AUDIT_SCRIPT" "$TASK_ID"` and checks exit code. If exit non-zero, it blocks the STATUS write and exits 1. The pre-existing flow (screenshot capture, route detection, `awaiting-betelgeuse` STATUS write) is unchanged for the no-blocking-violation path. PASS.

The hook uses `bash`, not `/bin/bash`, to invoke the audit script. On a system where `bash` resolves to bash 4 (Homebrew), the script would run under 4+. On stock macOS, `bash` resolves to `/bin/bash` (3.2). This means the compat fix matters only on stock macOS when invoked via `/bin/bash` directly. Calling via `bash` on stock macOS also resolves to 3.2. No issue — the fix is correct regardless of invocation path.

**`pre-handoff.sh` check 4d:**
Check 4d is isolated to the `betelgeuse → sirius` handoff path (condition at line 200). No other agent combination triggers it. The existing checks (4a STATUS guard, 4b visual-diff approval, 4c prototype checklist) are unchanged. PASS.

**`pre-handoff.sh` check 4b (visual-diff approval):**
The check at line 127 looks for `betelgeuse-approved` in the STATUS file. The new STATUS values (`exploring`, `awaiting-direction-lock`, `locked`, `revise-N`) will all correctly cause this check to block the handoff until approval is given. No regression introduced. PASS.

**Harness config (`worldline-harness.config.json`):**
New rail `html-first-spec-discipline` added at lines 70–83. All existing rails unchanged. Config is valid JSON (verified by the Python parser used in this audit). PASS.

**`TASK-2026-05-26-PHOTO-PROTOTYPE-FIRST`:**
This task already has a `directions/` directory in working tree. The audit ran against it during cross-impact testing and returned EXIT=0 with all checks PASS. The new rail does not break this in-progress work. PASS.

---

## notes (non-blocking, forwarded to Polaris)

1. **`steps: []` field in all hook-task signatures.** This is a systemic issue, not specific to this task. When `pre-task.sh` is not run, the steps log is never initialized. The `sign-work.sh` warns to stderr but the JSON ships with `steps: []`. Per SCHEMA.md, `steps` are "short imperative lines" and are required. The field is present (satisfying schema presence check) but contains no information. I note this for completeness but do not classify it as INTEGRITY-FAIL for hook-task dispatch signatures — the steps are recoverable from the conversation transcript and the handoff prose. If Polaris wants this enforced, Canopus should be tasked to write a pre-task step logger stub that fires even for hook-task dispatches.

2. **`advisory()` output goes only to stderr.** If a future caller captures stdout to check for ADVISORY markers, it will see nothing. The current callers (visual-diff.sh, pre-handoff.sh) don't capture stdout, so no functional impact now. Worth noting for future tooling.

3. **`--check-only` flag is defined but unused by any hook.** Line 37–40 parses it; no hook passes it. Not a bug — it provides a dry-run mode for manual use. No action needed.

4. **Canopus's "prior-agent deliverables assumed correct" disclosure** (return handoff §"known deviations" item 2): this task was a recovery dispatch. The prior agent's work on pre-handoff.sh, visual-diff.sh, RAIL-DEFINITIONS.md, and harness config was not re-verified by Canopus on the recovery pass. My independent audit above covers those files. All pass. The disclosure is honest and the gap is covered.

---

## postmortem candidate decision

Polaris filed `docs/team/POSTMORTEMS/CANDIDATE-2026-05-26-bash4-mapfile-recurrence.md`.

**Decision: CONCUR.** Recommend promotion to formal postmortem.

Rationale:

Two `mapfile` / bash-4 incidents in ~10 days is not within normal variance for a team writing at the volume and surface area this team writes. The postmortem candidate correctly identifies the systemic cause: no standing rule in Canopus's persona file, no automated lint check, and a possible context-drift effect on fresh subagent dispatches. These are class-level defects, not one-off bugs.

Specifically, the prior incident (TASK-2026-05-16-META-1-bash4) should have produced a standing checklist addition. That it didn't — and the same pattern recurred in the next audit script Canopus wrote — is the evidence that the one-off fix is insufficient.

The four proposed action items (A through D) are all correctly scoped:
- A (persona-level rule) — addresses root cause for future fresh subagent dispatches
- B (CI lint) — automated prevention; prevents the class from recurring regardless of who writes the script
- C (test matrix dual-bash run) — shifts detection left from Polaris/Algol to the authoring agent
- D (Algol bash-compat sub-check in gauntlet step 4) — closes the regression gap; this is the check I ran manually today; it should be automatic

All four are forward-only and do not require retroactive refactoring. The candidate's scope statement is correct on what this is NOT (not a blame trace, not a retroactive refactor, not a re-evaluation of HTML-first workflow).

Dissent case considered: "two incidents in 10 days at a team volume of ~30 task dispatches is within normal variance." I reject this. The relevant comparison is not "bugs per dispatch" but "same class of bug, same author, same root cause, within one sprint." This is a pattern, not variance.

**Algol's action:** concurrence written in this report. Polaris dispatches promotion.

---

*algol · α-VER-06 · TASK-2026-05-26-HTML-FIRST-02 · 2026-05-26*
