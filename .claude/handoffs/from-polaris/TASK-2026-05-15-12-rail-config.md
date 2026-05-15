---
task_id: TASK-2026-05-15-12
from: polaris
to: canopus
date: 2026-05-15
priority: medium
model: sonnet
parent_directive: Peat 2026-05-15 — "ทำ rail config ก่อน, task ที่ betelgeuse เสนอเดะมาทำต่อหลังจากอันนี้เสร็จ"
sibling: TASK-08 (in-flight, Betelgeuse-opus) — non-overlapping territory, runs in parallel
---

# TASK-2026-05-15-12 · `.harness/worldline-harness.config.json` + 2 deployable rails

## scope

`harness-check.sh` is deployed but cannot do its job — it reads `.harness/worldline-harness.config.json` which does not exist; reads `.rails | to_entries[]` against a missing file; returns warning and exits 0. The team has been relying on Polaris's eye to enforce territory rules in lieu of the rail. This task lays the foundation: write the config, deploy the two rails Canopus can implement immediately as bash audits, stub the three that need Algol's TypeScript audit logic for later.

The five rails are already specified in `docs/harness/RAIL-DEFINITIONS.md`:

| # | rail | check script | implementation in this TASK |
|---|---|---|---|
| 1 | territory | `scripts/audit-territory.sh` | **REAL** — bash, reads FILE-OWNERSHIP.md, greps |
| 2 | design-tokens | `scripts/audit-design-tokens.sh` | **REAL** — bash, grep for raw hex outside whitelist |
| 3 | next-16-api | `scripts/audit-next-api.sh` | **STUB** — exit 0 with "TODO: needs algol TS audit logic" |
| 4 | voice-discipline | `scripts/audit-voice.sh` | **STUB** — exit 0 with "TODO: needs NETRA voice spec (lib/netra/) + algol TS logic" |
| 5 | accessibility-floor | `scripts/audit-a11y.sh` | **STUB** — exit 0 with "TODO: needs Lighthouse runner + algol TS logic" |

Stubs are honest — they return PASS with a TODO message so `harness-check.sh` doesn't false-alarm, but the stub message makes it visible in the log that the rail is not enforcing yet.

## PRD reference

None — pure harness infrastructure.

## slices

### S1 · Canopus — `.harness/worldline-harness.config.json`

**output**
- `.harness/worldline-harness.config.json` — JSON with shape matching `harness-check.sh`'s parser:
  ```json
  {
    "rails": {
      "territory":       { "check": "scripts/audit-territory.sh" },
      "design-tokens":   { "check": "scripts/audit-design-tokens.sh" },
      "next-16-api":     { "check": "scripts/audit-next-api.sh" },
      "voice-discipline":{ "check": "scripts/audit-voice.sh" },
      "accessibility-floor": { "check": "scripts/audit-a11y.sh" }
    }
  }
  ```
- Each rail entry MAY include additional fields (description, applies-to glob, link to RAIL-DEFINITIONS.md anchor) — your call as harness owner; Polaris won't second-guess additions that keep the parser working.

### S2 · Canopus — `scripts/audit-territory.sh` (REAL)

**output**
- Bash, mode 755, `set -euo pipefail`
- Reads the current task's baseline (`.claude/hook-logs/<TASK_ID>--baseline.json`) and the current dirty tree to determine which files were touched
- For each touched file, looks it up in `docs/team/FILE-OWNERSHIP.md` against the value of `WL_AGENT` env (the agent claiming the work)
- Exits 0 if all touched files are within `WL_AGENT`'s territory; exits 1 with `file:owner` list otherwise
- Whitelist exceptions: `docs/team/STATUS.md` is Polaris's; handoff files in `.claude/handoffs/from-<agent>/` are the agent's own; signature files in `.claude/signatures/TASK-*--<agent>.json` are the agent's own — these are always allowed regardless of `WL_AGENT`

### S3 · Canopus — `scripts/audit-design-tokens.sh` (REAL)

**output**
- Bash, mode 755
- Greps `app/**` and `components/**` for raw hex pattern `#[0-9a-fA-F]{3,8}\b` (regex tuned to not match short uuids/ids)
- Whitelist (allowed to contain raw hex):
  - `app/globals.css` — palette definition lives here
  - `components/WorldlineGlobe.tsx` — Three.js needs numeric color args
  - Tailwind className expressions matching `^(bg|text|border|ring|fill|stroke)-\[#[0-9a-fA-F]+\]$` IF Peat has a stated tolerance for inline-hex Tailwind utilities — your call; document the decision in script header
- Default decision when in doubt: stricter is better (reject Tailwind inline hex too). Betelgeuse can relax later via a CONFIG handoff.
- Exits 0 if no violations; exits 1 with `file:line:value` list otherwise

### S4 · Canopus — three stubs (`audit-next-api.sh`, `audit-voice.sh`, `audit-a11y.sh`)

**output** — three bash scripts, all mode 755, all of this shape:
```bash
#!/usr/bin/env bash
# TODO: <rail name> rail not yet implemented.
# Implementation requires <reason — TS audit logic / Lighthouse / NETRA voice spec>.
# Tracked by Polaris for a follow-up TASK.
echo "[<rail-name>] STUB — rail not enforcing yet (see TASK candidates in STATUS.md)"
exit 0
```

### S5 · Canopus — sign + return + open follow-up TASK proposals

**output**
- Run `harness-check.sh` from a clean working tree — verify all 5 rails report (2 real PASS, 3 stub messages), no FAIL, exits 0
- Sign work: `WL_AGENT=canopus WL_NEXT=polaris WL_SUMMARY="rail config + 2 real rails + 3 stubs (TASK-12)" bash .claude/hooks/sign-work.sh TASK-2026-05-15-12`
- Return handoff at `.claude/handoffs/from-canopus/TASK-2026-05-15-12--to-polaris.md`
- In return handoff, propose 3 follow-up TASK candidates Polaris can open later:
  - TASK_audit-next-api · Algol + Canopus · TS audit logic + bash wrapper
  - TASK_audit-voice · Arcturus (voice spec) + Algol (TS logic) + Canopus (wrapper)
  - TASK_audit-a11y · Algol (Lighthouse runner) + Canopus (wrapper)
- Update STATUS.md: close TASK-12 with self_hash; remove `.harness/worldline-harness.config.json — ยังไม่ exist` from known-gaps

## non-goals

- Do NOT implement the 3 stubbed rails. Each needs a non-Canopus collaborator (Algol for audit logic, Arcturus for NETRA voice spec).
- Do NOT modify `docs/harness/RAIL-DEFINITIONS.md` content — Canopus already wrote it; new info goes in return handoff.
- Do NOT modify `scripts/audit-*.ts` if any exist (none should — that's Algol's territory).
- Do NOT add a rail not already in RAIL-DEFINITIONS.md.

## dependencies

None. Runs in parallel with TASK-08 (Betelgeuse-opus). Territories don't overlap: Canopus touches `.harness/`, `scripts/audit-*.sh`, `.claude/hooks/`, STATUS.md; Betelgeuse touches `docs/design/`.

## acceptance (whole task)

- `.harness/worldline-harness.config.json` exists and is valid JSON
- 5 audit scripts at `scripts/audit-*.sh`, all mode 755, all syntax-clean
- 2 real (territory, design-tokens) actually enforce; 3 stubbed return PASS with TODO message
- `bash .claude/hooks/harness-check.sh` exits 0 from clean tree with 5 rail entries reporting
- Signature v2, both gates green
- Algol QA cross-check (per `feedback_algol_qa_cross_check` rule, applies from 2026-05-15 forward) — Polaris dispatches Algol on return BEFORE closing

## deadline

ASAP — should land before TASK-08 closes so Betelgeuse's return goes through a fully-railed harness audit.

---

*polaris · α-OPS-00 · 2026-05-15*
