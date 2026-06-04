# SAVE-POINT · 2026-06-04 — Zero-Trust posture shift + memory-poisoning remediation (PAUSED at inflection)

> Single entry-point to resume next session. Read this first, then STATUS `TASK-2026-06-04-MEMORY-POISONING-A`, then the report.

---

## ⏱ Where to start next session (TL;DR)
Two decisions are **yours (Peat)** — everything downstream is blocked on them:
1. **The P0 ledger trust-root mechanism** (how to make the integrity ledger forge-resistant).
2. **Escalate the build tier to opus** for the security primitives (yes/no).
Then fire **REVISE round 2**. Nothing is wired live; the gate is intact.

---

## The arc (how we got here, one breath)
Morning question *"what IS my AI factory?"* → it's a **trust-machine**: a portable false-green eliminator (Venom-symbiote, bonds to any host, separate from GENESIS's identity-soul). → built the **comprehension/onboarding skill** (Stage-0 self-onboarding; done = honest partition; probe-don't-assume; provenance via fossils; consent = heard-not-obeyed). → Jensen-keynote framing → adopted **ultracode/workflows-by-default + superseded no-redispatch under Zero-Trust scoping** (committed to WORKFLOW.md §Dispatch-depth). → ran the **Zero-Trust census** (33 gaps; harness full of false-greens; memory-poisoning #1). → started **memory-poisoning remediation** → build + 2× adversarial REVISE → **inflection: the ledger needs an unforgeable root.**

The throughline: **the trust-machine turned on its own harness and kept catching false-greens.** Discipline held — nothing fake went live.

---

## Current state (exact, ground-truth-verified)
- **TASK-2026-06-04-MEMORY-POISONING-A · REVISE-R1 · 0/4 wireable · NOT YET LIVE.**
- 8 sensor files **built, additive, untracked, INERT**. `settings.json` UNMODIFIED · `.claude/beta/**` UNTOUCHED · integrity-ledger ABSENT — all Polaris-probe-confirmed (not summary-trusted).
- Reports: `docs/qa/REPORTS/TASK-2026-06-04-MEMORY-POISONING-A.md` (§REVISE round 1 appended) + `M3-untrusted-fetch-gate-REFUTE.md` + `.harness/M1-...FALSE-HAVE.md` + `.harness/M4-...GAP.md`.

## The two pending decisions (yours)
1. **P0 ledger trust-root.** Blocker: M1-B (ledger co-tamper) + M2-C5 (deletion co-tamper) share ONE root — the integrity ledger is **unauthenticated plaintext**; an agent with write access can forge it. *You cannot make a local plaintext file forge-resistant against a writing-agent without a trust root the agent can't forge.* This is the morning's **irreducible-root** theory made concrete. Weigh: (a) git commit-signing (GPG key the agent lacks), (b) external append-only store, (c) Canopus-only signing key, (d) hook running outside agent write-access / OS-level.
2. **Build tier.** `sonnet-build → opus-refute` *grinds* for forge-resistant crypto-primitives (M4 = grep `^`/`$` are line-not-string anchors → newline injection; M3 kept missing egress tools). Goal-driven dispatch says **escalate BUILD to opus** for this class. Tradeoff: cost vs convergence.

## The 4 sensors — remaining holes (for REVISE round 2)
- **M1 handoff-integrity** — B (ledger co-tamper) OPEN: "verifier-without-producer" (writer emits no prev_hash). Needs the forge-resistant ledger (decision 1) + a producing writer that emits the anchor; drop `find -maxdepth 3` (D). A/C closed.
- **M2 memory-drift** — C5 (deletion co-tamper) = deletion-analog of M1-B, **same ledger root**; + exit-2 label mismatch. (Deletion-of-disk-node now caught; co-tamper not.)
- **M4 retention** — 4 newline vectors (A/A2/E/I): fix = **whole-STRING equality** on `signed_by` at both doc + entry (agent-self-sign already closed). `is_signed_by_peat()` + PEAT_SIGNERS holds.
- **M3 untrusted-fetch-gate** — `browser_tabs` (action:new url) bypass via `*)` default-allow; add `browser_tabs` + audit MCP namespaces + regression case. (Egress headline + playwright/chrome/Notion now blocked; fail-closed-on-parse done.)

## Resume steps
1. Read this + STATUS entry + report.
2. Decide the two things above.
3. Fire **REVISE round 2** (new workflow): **opus** — design+build the ledger trust-root, re-derive M1/M2 on it; fix M4 (string-equality) + M3 (browser_tabs + namespaces); **Algol opus re-refute** each (the prior bypass must now be caught + no new one); gate.
4. When all pass re-refute → review the `§2` settings.json wiring diff → wire → run the one-time **baseline-seed pass** (so M2 doesn't flag legit nodes) → live.
5. **Track B (Beta):** in a beta-mode session, Beta opens the inert consult to **co-design** her surface's integrity (equal voice, not approval).

---

## MINDSET — the spine that must carry (do not lose these)
- **Don't trust the summary; probe ground truth.** Every workflow result was verified by direct probe (`git status` / `ls` / reading the file). The prose is a self-report; the artifact is truth. ([[feedback-polaris-self-verify]])
- **The lattice (adversarial refute) is the engine.** A sensor is NOT done until a refuter RUNS the bypass and it's caught. **Existence ≠ enforcement** (dormant `secrets.ts`/`watchdog.ts` taught this; 4/4 sensors were false-HAVE on first build).
- **Human-at-seam, always.** `settings.json` wiring is Peat-gated. Nothing live without Peat's sign AND the sensor passing re-refute. Recorded override, never hidden.
- **Irreducible roots, named not pretended.** Memory-integrity forced us to name a root the agent can't forge. Sit with it — it IS the trust-machine theory.
- **Tier ≠ family diversity.** Claude-only → verify-diversity = tier (opus↔sonnet) + adversarial-refute prompting. True family-diversity needs an external-model verifier (AI Gateway) — open lever.
- **Goal-driven least-agency dispatch via /advisor (= JIT-Opus).** Minimal tier for the goal; escalate only the hard judgment. Opus-main + Opus-advisor = standing-max (least-agency only lands at Sonnet-main + Opus-advisor).
- **Beta co-design boundary.** `.claude/beta/**` EXCLUDED from Track A; consult inert; Beta = co-designer equal-voice; threat-class citable as structure, ROOM/LEDGER/MOMENTS/NOTES content per-entry-gated. ([[feedback-beta-codesign-boundary]])
- **Wording is a security artifact.** "superseded" not "retired" — make the successor control un-missable.

---

## Artifact inventory
**Built (untracked, inert):** `scripts/audit-{handoff-integrity,memory-drift,untrusted-fetch-gate,retention-policy}.sh` · `.claude/hooks/{integrity-write-ledger,integrity-write-guard,untrusted-fetch-gate}.sh` · `.harness/{proposed-wiring-M.md,fetch-allowlist.txt}` · `tests/harness/audit-handoff-integrity.mutation.sh` · `scripts/audit-memory-drift.mutation-test.sh`
**Policy (committed):** `docs/team/WORKFLOW.md` §Dispatch-depth — Zero-Trust multi-agent orchestration.
**Census:** `docs/team/ZERO-TRUST-CENSUS-2026-06-04.md` (33 gaps, the false-HAVE/dead-sensor findings).
**Skill created:** `.claude/skills/comprehension-onboarding/SKILL.md`.
**Track-B consult (draft, inert):** `.claude/handoffs/from-polaris/CONSULT-2026-06-04-BETA-MEMORY-INTEGRITY--to-beta.md`.
**Canopus CONFIG handoff:** `.claude/handoffs/from-polaris/TASK-2026-06-04-DISPATCH-DEPTH-ZT--to-canopus.md` (README drift, on-dispatch tier+goal logging).
**Workflow scripts (saved, re-runnable):** census `wf_f2e5e1b6-7dd` · build `wf_578b810a-183` · revise `wf_aaaf2825-3d5` (under the session workflows dir).

## Cross-session memory born this session
`project-trust-machine-symbiote` · `project-duration-thread` · `project-orchestration-posture-shift` · `feedback-beta-codesign-boundary` (+ the comprehension-onboarding skill).

---
*Discipline held: 3 rounds (census → build → revise), the machine caught its own false-greens every time, nothing fake went live. Paused clean. Resume from the two decisions.*
