# ECC vs GENESIS Harness — Comparison and Evaluation

**Date:** 2026-05-16
**Status:** lesson learned — reference doc
**Trigger:** Peat shared the affaan-m/everything-claude-code repo (ECC) on 2026-05-16 after seeing it referenced in an article claiming 38 specialized agents, 156 skills, and an AgentShield security platform with 1,282 test scripts.

---

## TL;DR

ECC is a community-aggregated Claude Code extension repo: a skill loader, a learning system, and a marketed security layer (AgentShield) that is largely a separate, early-stage package. Polaris ran an Explore recon and found the repo's marketing significantly overstates what is present in the codebase. We declined wholesale adoption: GENESIS already has clean ownership boundaries, a traceback-based audit contract, and a memory hygiene rule that ECC's auto-capture pattern would directly violate.

---

## Side-by-side evaluation

| ECC component | What it claims | What recon found | GENESIS equivalent | Adopt? | Why |
|---|---|---|---|---|---|
| **Agent roster** | 38 specialized agents | No agent files found matching this count in the repo; likely a count of skill templates re-labeled as agents | 9 agents with designated ownership slots; routing via `.claude/AGENTS.md` crew roster | No | Adding 38 would destroy routing clarity; GENESIS ownership is per-file enforced by `scripts/audit-territory.sh` |
| **Skill system** | 156 on-demand skills | ~156 `/skills/*/SKILL.md` files, real and loadable via `/skill-name` pattern — this claim appears accurate | Superpowers plugin skills + `~/.claude/skills/`; project skills in `.claude/agents/` | No | Superpowers and plugin skills already cover the loader pattern; adding ECC skill namespace alongside would create ambiguity about which loader fires |
| **AgentShield** | 1,282 test scripts, 3 Opus red-team instances (Attacker/Defender/Auditor), auto-fix mode, CI integration | AgentShield is a separate package (`github.com/affaan-m/agentshield`, npm `ecc-agentshield`). ECC contains only a 4.5KB wrapper skill (`/skills/security-scan/SKILL.md`) and a 12KB checklist (`/skills/security-review/SKILL.md`). The "3× Opus red-team" and "auto-fix" are Slice 6 roadmap items, not shipped code. ECC's own CI does not call AgentShield. | NETRA (planned; red-team plan drafted by Arcturus; ~30 targeted cases) | No | AgentShield targets IaC patterns (CloudFormation/Terraform); our attack surface is `/api/chat` + Arcturus prompt injection. Scope mismatch. Roadmap promises are not code. |
| **Continuous Learning** | Learns repo conventions over 2–3 weeks; hook-driven instinct capture; confidence 0.3–0.9 ladder; promotes global when seen in 2+ projects | Real. Uses PreToolUse/PostToolUse hooks; atomic "instincts" stored at `.local/share/ecc-homunculus/projects/<hash>/`; promotion logic confirmed in source. 2–3 week claim unverified. | `.claude/memory/` — manually curated per agent; `MEMORY.md` index referencing typed memory files | No | Auto-capture violates "memory hygiene — no stigma, agent autonomy" rule: instincts would record one agent's behavior as observed by another, bypassing the rule that agents narrate themselves. Manual curation is intentional. |
| **CI/CD security gate** | CI runs AgentShield on every push | ECC's CI runs `npm audit`, IOC scan, and lint on itself only. No AgentShield invocation in any workflow file. | `post-edit.sh` (lint + typecheck + build, blocks on failure); `scripts/audit-territory.sh` enforcing; `.harness/worldline-harness.config.json` rails; GitHub Actions not yet wired | No | Our CI surface is intentionally narrow until NETRA ships; see open question below |
| **Memory** | Cross-session learning; project-scoped storage | Project-scoped storage confirmed; global promotion confirmed; content quality depends on instinct-capture heuristics which are unreviewed | `.claude/memory/` + per-agent signature chain at `.claude/signatures/` | No | Our memory is human-reviewed, typed, and indexed. ECC's instinct store is heuristic and opaque. |
| **Planning gate** | Not explicitly claimed | ECC has no formal pre-task planning gate | `superpowers:brainstorming` skill + `pre-task.sh` which gates every agent task on PRD + AGENTS.md acknowledgment | No | Our gate is already in place and tighter |
| **CLAUDE.md rules** | 38 agents all governed by a central CLAUDE.md | Single CLAUDE.md at repo root imports ECC conventions for all agents; no per-agent territory enforcement found | `/CLAUDE.md` → `@AGENTS.md`; per-agent files at `.claude/agents/<codename>.md`; territory enforced by `scripts/audit-territory.sh` at runtime | No | Our CLAUDE.md is minimal and delegates to AGENTS.md; territory is enforced by hooks, not convention |

---

## The traceback principle — why we do not adopt ECC's instinct capture

GENESIS's audit contract is built on traceback: every piece of work can be traced back to a specific agent, a specific task, and a specific point-in-time hash. This is not a logging nicety — it is the mechanism by which Algol can detect signature forgery, scope creep, and drift between what an agent claimed it did and what it actually touched.

The contract lives in `.claude/signatures/SCHEMA.md`. Version 2 (current) requires:

- `task_id` — links every signature to a dispatched task
- `files_touched` + `hashes.files_sha256` — Algol recomputes these from the working tree and rejects any mismatch (INTEGRITY-FAIL)
- `hashes.self_hash` — computed over canonical JSON of the entire payload excluding itself; Algol re-derives it on audit
- `harness_passed` — if false, the handoff is blocked by `pre-handoff.sh`
- `next_recipient` with designation — Algol confirms the designation exists in the current roster

ECC's Continuous Learning system writes "instincts" about repo conventions derived from observing tool use patterns. That means one agent's session produces records that characterize another agent's behavior or the codebase's conventions without a human review gate. There is no task_id binding, no hash commitment, no Algol verification step. If ECC instincts were running alongside our harness, they would accumulate unsigned claims about the repo that could not be audited and could silently drift from reality over the 2–3 week "learning period." The system would pass Algol's signature checks (because it produces no signatures) while still influencing agent behavior through the instinct store — a blind spot the traceback model is specifically designed to close.

The rule is: every claim that affects agent behavior must be signed and auditable. ECC's instinct store is neither.

---

## Evaluation protocol — future external harnesses

When Peat shares another repo claiming harness, agent, or security capabilities, Polaris should run in this order:

- Dispatch an Explore recon before forming any opinion. Read the actual repo, not the README or article. The gap between marketing and code is often larger than expected.
- Verify each marketing claim against a real file path. "1,282 test scripts" requires 1,282 findable test files. "3× Opus instances" requires code that calls the API.
- Check whether the feature is in the repo or a linked external package. If external, treat it as a separate evaluation.
- Check roadmap language. "Slice 6," "next iteration," "planned" mean the feature does not exist. Do not count roadmap as capability.
- Count active maintainers. A single-maintainer project with a commercial tier and viral growth is a bus-factor risk. Check commit history, not contributor count (stars and forks inflate contributor numbers).
- Check whether the system preserves traceback. Any system that captures cross-agent observations without signing them is incompatible with our audit contract.
- Check whether adoption would require merging two architectural systems. GENESIS's "never blend visual languages" rule applies to harness architecture: two routing systems, two memory systems, two hook layers create ambiguity that degrades quality enforcement.
- Never adopt wholesale. If there is a specific, bounded capability worth cribbing (a particular script pattern, a test structure), adopt that one element and document what was taken and why.
- If uncertain, the default is decline and document. This doc is the model: record what was evaluated and why it was declined, so the decision is not re-litigated without new information.

---

## What we cribbed

No code was copied from ECC. No files were modified based on ECC patterns.

The ECC AgentShield roadmap document (`/docs/architecture/agentshield-enterprise-research-roadmap.md`) is noted as an antipattern for scope: 1,282 test cases targeting a wide surface with three model-tier reviewers is an ambitious architecture that has not shipped after multiple "slices." Our NETRA red-team plan, drafted by Arcturus, targets approximately 30 focused cases against our actual attack surface (`/api/chat`, Arcturus prompt, tool invocations). Scope discipline is the lesson, not any specific technique.

---

## Open question — AgentShield standalone

When NETRA goes live, AgentShield (the standalone package `github.com/affaan-m/agentshield`, not ECC) should be re-evaluated as a possible component of the red-team evaluation pipeline. The re-evaluation condition: AgentShield must be able to emit results in a format that can be ingested by a signed NETRA audit report — meaning Algol can hash the results file, link it to a task_id, and verify it was not altered after the fact. If AgentShield integrates with the signature schema, it is worth testing on our IaC layer (if we add any). If it does not, it remains out of scope.

The re-evaluation should happen as a discrete Explore recon at NETRA launch, not before.

---

*end of ecc-vs-genesis-comparison.md*
