---
date: 2026-05-14
author: Polaris (α-OPS-00)
severity: high
status: resolved
fixed_by: Canopus (α-HRN-07)
verified_by: Polaris roll call, 2026-05-14
---

# Polaris had no Agent tool — orchestration collapsed to solo work

## what happened

In prior session(s), Polaris (α-OPS-00) was provisioned without the `Agent` tool. The PM role's core mechanic — decompose a directive into parallel slices, dispatch 3–5 agents in one message, receive signed work, verify — was structurally unavailable. The fallback was the worst possible shape: Polaris executed slices herself.

This is a category violation, not a quality issue. Polaris is explicitly *not* allowed to write code, edit components, or author copy. With no Agent tool, the persona had to either refuse the directive (breaking Peat's flow) or break her own ownership rules (breaking the team's trust model). Both options corrupted the design.

## root cause

The harness configuration that wires subagent capability into the persona files did not include `Agent` on Polaris's tools list. The omission was silent — there was no startup check that verified each persona's tool grant matched the role its prose described. The first signal was behavioral: Polaris doing work she should have been dispatching.

## fix

Canopus restored `Agent` tool access. The specific change lives in Canopus's territory (`.claude/hooks/**` / harness wiring) and should be referenced from her own work record, not duplicated here.

## verification

Roll call on 2026-05-14: Polaris dispatched 8 parallel `Agent` calls (Sirius, Altair, Procyon, Betelgeuse, Arcturus, Algol, Canopus, Vega). All 8 returned standby reports within ~5–8 seconds each, in their own voices, citing their own territories. Parallel dispatch confirmed working end-to-end.

## prevention

Two follow-ups worth considering — not assigned yet, flagging for Peat:

1. **Startup capability check.** Canopus could add a hook that, when a persona file is loaded, verifies the YAML `tools` line includes the tools that role's prose body claims to use. A PM persona that says "I dispatch agents" but has no `Agent` tool should fail loud at session start, not silently mid-task.
2. **Role/tool contract in `FILE-OWNERSHIP.md` or `AGENTS.md`.** A small table — "Polaris MUST have: Agent. Algol MUST have: Read, Bash, Write (tests/, scripts/audit-*)." — makes the dependency explicit so future roster edits don't quietly strip a load-bearing capability.

## lesson for the next Polaris

If you find yourself reaching for `Edit` or `Write` on something outside your own territory, **stop**. Check whether `Agent` is available. If it is not, that is the incident — surface it to Peat immediately. Do not try to "just get it done" by doing the work yourself. The team's design depends on the cut.
