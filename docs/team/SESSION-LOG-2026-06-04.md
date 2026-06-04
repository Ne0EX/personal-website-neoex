# SESSION LOG · 2026-06-04 — Zero-Trust trust-root to code-complete + commit; RTK; capture

> Narrative companion to STATUS.md (which holds the per-task ledger). Read this first for the arc.

## What we set out to do
Peat: "Polaris pick up เรื่อง zero trust machine." Resume the paused memory-poisoning remediation (census done, Track-A in REVISE 0/4 wireable) and drive it.

## The arc
1. **Re-oriented** off the save-point — paused at "the integrity ledger needs a forge-resistant root the writing agent can't forge." Probed ground truth (didn't trust the summary): the CI witness was **nominal** (ci.yml committed locally only, 15 commits unpushed, zero Actions runs ever, no branch protection on main/genesis). The irreducible root bottoms out in a **GitHub branch-protection toggle only Peat can set**.
2. **Trust-root decided by elimination** (advisor-confirmed): no LOCAL anchor is forge-resistant against an agent with fs write+read; Peat-key signing is ruled out by standing policy; the only un-forgeable root is **the independent-witness CI over append-only git history**. Peat's genuine fork = detective vs preventive → **T2 detective**. Cost honestly named (recurring push coupling).
3. **REVISE rounds R2→R3→R4 (+resume) + a micro-fix** — each a Workflow with **mixed-tier routing** (opus only on the hard judgment: trust-root design/refute + the completeness-critic; sonnet on mechanical fixes). The **opus completeness-critic backstop caught a false-green every round** that the sonnet refuters missed: false-HAVE×4 → NUL-injection → `--seed` that lied → M3 no-op matcher → fetch-depth staleness-lie. **6 catches; nothing fake reached live.** R4 run-1 died on the critic tripping the mutating-gate (`git merge-base`/`>` false-positives) → fixed prompt + `resumeFromRunId`.
4. **Code-complete** — all blockers closed, Polaris-verified in code (not the boolean). Cleared for go-live = pure Peat-seam.
5. **RTK** (Peat's detour, hitting limits) — installed global hook-only; built a fail-safe carve-out, then proved **subagents are env-indistinguishable from main** → "main-only" RTK is architecturally impossible → left dormant-safe; the real lever is Polaris context discipline ([[feedback-context-bloat-lever]]).
6. **Committed** the zero-trust bundle (`0bcc039`, 54 files) on a **dedicated branch** `genesis/zero-trust-trust-root` (Peat: "แยก branch ให้ดี"); unrelated files left untracked; `genesis/orchestration-foundations` untouched.
7. **Captured** — this log + memories + the `adversarial-harden` compounding + the new `close-session` forcing skill.

## Key decisions (who decided)
- **Peat:** trust-root posture = T2 detective; activate publisher as a follow-up automation slice; build tier = mixed (don't blanket-opus); RTK global + don't-touch-agents → on the finding, leave dormant; commit on a separate branch; capture everything as notes + skills + a forcing close ritual.
- **Polaris (recommended, Peat ratified by proceeding):** the elimination argument for the CI-witness root; mixed-tier per-agent routing; resume-on-failure; leave RTK dormant over a useless activation.

## Shipped
Commit `0bcc039` (`genesis/zero-trust-trust-root`): M1–M4 + append-only-CI-witness trust-root + publisher + tests + census/REVISE reports. All **INERT**.

## Parked / open (Peat-seam unless noted)
- **Go-live** of the trust-root (runbook `from-polaris/GO-LIVE-T2-TRUST-ROOT.md`): push branch → seed → wire §2a → WL_INTEGRITY_WIRED + M1/M2 WARN → create `integrity-witness` ref → **branch-protection-no-bypass** → publisher token → M3 matcher → M4 policy → Polaris live co-tamper proof.
- **Canopus:** mutating-gate false-positives (`git merge-base`, `>`-in-string) now cause workflow-agent failures — tighten (STATUS, must_close_by 2026-06-07). RTK-carve-out handoff is moot (dormant).
- **RTK:** telemetry still ON (Peat may `rtk telemetry disable`); dormant-safe.
- **Beta Track-B:** memory-integrity co-design consult still inert.
