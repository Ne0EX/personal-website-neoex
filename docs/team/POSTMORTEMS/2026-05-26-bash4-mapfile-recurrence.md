# POSTMORTEM · bash 4 `mapfile` recurrence in Canopus hook/audit work

> status · FORMAL (promoted from CANDIDATE 2026-05-26 after Algol concurrence)
> filed by · Polaris (α-OPS-00) · 2026-05-26
> concurred by · Algol (α-VER-06) · 2026-05-26 via `from-algol/TASK-2026-05-26-HTML-FIRST-02-AUDIT--to-polaris.md`
> triggering incident · TASK-2026-05-26-HTML-FIRST-02 first dispatch (recovery successful, no production impact)
> prior incident · TASK-2026-05-16-META-1-bash4 (~10 days earlier, same author, same root cause)
> severity · P3 — shipping bug in non-critical path; caught pre-Algol by Polaris self-smoke; recovery clean
> action items · A, B, C → TASK-2026-05-26-BASH-PORTABILITY-PREVENTION (queued) · D → adopted by Algol immediately

---

## what happened

Canopus authored `scripts/audit-visual-diff-directions.sh` for TASK-2026-05-26-HTML-FIRST-02. The script used `mapfile -t ARRAY < <(...)` to populate two arrays (original lines 141, 148).

`mapfile` is a bash 4+ builtin. macOS stock `/bin/bash` is 3.2 (Apple has not shipped a newer bash for license reasons since 4.0 moved to GPLv3). The script's shebang `#!/usr/bin/env bash` resolves to `/bin/bash` on stock macOS environments.

When Polaris ran the script as a self-smoke after Canopus's first dispatch stalled (stream watchdog timeout, unrelated cause), the script crashed at line 141 with `mapfile: command not found` followed by `unbound variable` errors on the arrays mapfile was supposed to populate. Exit was 1 — which the calling hook would interpret as "audit found blocking violations" — but for the wrong reason (compat crash before Rule 4 logic even ran).

Canopus's recovery dispatch fixed the issue by replacing both `mapfile` calls with the portable pattern:
```bash
while IFS= read -r line; do
  [[ -n "$line" ]] && ARRAY+=("$line")
done < <(...)
```
Verified by Polaris self-smoke (exit 0 on clean fixture, exit 1 with correct Rule 4 BLOCK message on blank-slate fixture). Independently re-verified by Algol under stock `/bin/bash` during the gauntlet — output matched Canopus's reported smoke-test exactly.

## why this is a postmortem, not a closed incident

**It has happened before.** Prior incident: `TASK-2026-05-16-META-1-bash4` (see `.claude/handoffs/from-canopus/REVISE-2026-05-16-META-1-bash4--to-canopus.md`). Same root cause, same author, ~10 days apart.

Algol's concurrence (verbatim): *"Two `mapfile` incidents from the same author in ~10 days, same root cause each time, is a class-level defect. The prior incident did not produce a standing prevention item — the recurrence proves the one-off fix was insufficient."*

A recurrence at this cadence is structural, not random. The one-off fix discipline does not retain across subagent dispatches.

## root cause (best explanation)

**Subagent context drift.** Each fresh Canopus subagent loads `.claude/agents/canopus.md` + AGENTS.md + the task handoff. Prior incident learnings live in old return handoffs that are NOT in the standard read-order. So every fresh subagent re-discovers the same bash-4 trap.

This is not a discipline failure of any individual Canopus instance — it is a memory architecture limit. The fix lives in raising the lesson out of one-off handoff history into standing context.

Secondary contributing factor: no automated check in CI / pre-edit hook validates that shipped bash scripts run on bash 3.2. The first detector is human (Polaris this time; would have been Algol on next audit pass — which is the design but still after-the-fact relative to Canopus's commit).

## action items (formal)

All four items pulled forward as TASK-2026-05-26-BASH-PORTABILITY-PREVENTION (queued). Item D already self-adopted by Algol.

### A · Persona-level rule (Canopus persona file)

Add a "bash 3.2 portability" subsection to Canopus's quality bar in `.claude/agents/canopus.md`. Forbid: `mapfile`, `readarray`, `declare -A` without compat check, `${var,,}` / `${var^^}` case conversion, `[[ string =~ regex ]]` with `BASH_REMATCH` capture in conditional execution (works in 3.2 with caveats — flag for caution). Provide portable alternatives inline.

Owner: Canopus writes (her own persona prose body). Vega sign-off required on prose per `.claude/agents/*.md` prose-body rule.

### B · CI lint

Add `scripts/audit-bash-portability.sh` (or extend an existing audit) that greps every shipped `.sh` for known bash-4-only patterns and fails CI if any are present.

Owner: Algol writes the audit logic (`scripts/audit-bash-portability.ts` or `.sh`); Canopus wraps it in the harness pipeline if a wrapper is needed.

### C · Test matrix

Canopus's hook test harness should run shipped scripts under both `/bin/bash` (3.2) and `/opt/homebrew/bin/bash` (4+) when both are present locally. Disagreement on output or exit code is a fail.

Owner: Canopus.

### D · Algol gauntlet sub-check ✓ ADOPTED

Algol's six-step gauntlet step 4 (regression) now includes "bash compat" as a standard sub-check for any harness/audit script delta. Algol self-adopted this 2026-05-26 during the TASK-02 audit (verbatim from her return handoff: *"I am adopting D into my personal gauntlet protocol immediately — this audit's step 4 manual bash-compat check will be standard procedure for any future harness/hook delta."*).

No further dispatch needed for D.

## what's NOT in scope

- Not a blame trace on Canopus. The bug-fix discipline IS the team norm; this postmortem is about whether the prevention discipline retains across subagent dispatches. Per memory hygiene: patterns + grants, never perpetrators.
- Not a re-evaluation of the HTML-first workflow itself — that work is sound and unrelated to the compat bug.
- Not a retroactive refactor of existing scripts. Forward-only prevention via items B+D is enough; existing scripts under audit get caught by Algol's regression pass going forward.

## prevention success criteria

This postmortem is closed when:

1. Action items A, B, C are dispatched and accepted
2. The next time Canopus authors a harness script, it ships bash-3.2-portable without Algol catching anything in regression
3. No `mapfile`/`readarray` recurrence within the next 60 days

Polaris reviews quarterly. If a recurrence happens after items A-C land, escalate to a deeper structural fix (e.g., a `.claude/PORTABILITY.md` standing file added to every Canopus subagent's read-order; a pre-commit hook that fails locally before sign-work even runs).

---

*polaris · α-OPS-00 · 2026-05-26 · promoted from CANDIDATE after Algol concur*
