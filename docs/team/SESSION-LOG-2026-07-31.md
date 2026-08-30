# SESSION LOG — 2026-07-02 → 2026-07-31 · RESUME-NETRA-SURVEY

> One long-running session (plan 07-02, build waves 07-02→07-06, integration 07-30, release 07-31). Polaris orchestrating, all 7 GENESIS agents dispatched. Caveman mode on throughout.

## What we set out to do
Peat: redesign **resume.neoex.dev** from his Claude Design bundle (`Portfolio website redesign.zip` — 4 pages), "I still think we can make an improvement on NETRA", plan first, then run the workflow to the end in auto mode.

## Key decisions (all Peat, via AskUserQuestion at plan time)
1. **NETRA Survey ledger** ships as the page (not the observatory treatment, not the 1b rail).
2. **Real LLM + keyword fallback** — `/api/chat` AI Gateway lane, prototype's `window.claude.complete` replaced.
3. **Resume = root `/`** of the standalone worktree app; observatory → `/atlas`.
4. **Full NETRA scope**: voice-spec port · structured tools · mobile point-mode + a11y · injection hardening + evals.
5. **Metrics ship — design is canon** (resume-content.md revved to v2 by Vega).
6. **Contact = email only** — phone number stripped from page, archive, prompt; audit-grep backstop.
7. (07-31, destination question timed out) Release = **`resume-main` branch in same origin** — new-repo creation was classifier-gated to Peat; migration stays open.

## What happened (the arc)
- **Plan**: 3 Explore agents (design bundle · worktree · main-repo NETRA specs) → 2 Plan agents (runtime · frontend) → contracts reconciled (UI-message stream won over plain-text; 6s fallback timeout; constants split client-safe vs server-only). Plan approved.
- **Build waves**: WF-A workflow (S0–S4+S12 clean; surface lane stalled) → ground-truth → WF-A2 (FIN waves; ledger landed, agent died before returning) → WF-A3 (S7 clean, S8 landed-then-killed) → **direct Agent dispatch for S9/S10/S11/S13/S14 — 6/6 clean**.
- **The stall lesson**: workflow runner kills agents at 180s-no-progress ×6. Two causes: (a) dev-clobber-guard blocks `next build` while ANY `next dev` lives (system-wide ps scan — Peat's :3000 counts); (b) xhigh-effort think-gaps >180s between tool calls. Killed agents' code SURVIVES on disk — journal.jsonl + git status = ground truth; re-launch as AUDIT-and-FINISH, never rebuild.
- **QA**: Betelgeuse canon review (PASS, zero atom drift, 3 findings) → REVISE pair-fix with technique-sync (::before inset hit-area = house technique) → Arcturus evals (audit-voice 23 PASS · 0 FAIL; 42 live cases key-gated, exit-2 honest MISS) → Algol full gauntlet (12/13 measured PASS; 1 blocking: iOS-zoom CSS cascade) → Sirius fix → Algol targeted re-verify **PASS**.
- **Release** (Peat: "แยก branch, commit & push, เปิด PR, resolve main release"): branch renamed `genesis/resume-netra-survey`, pushed; `resume-main` created at pre-redesign `577d5f2`; **PR #2 opened + MERGED → `resume-main` = `69f99db`**. Worldline `main` untouched (histories unrelated; main-web-only holds).

## What shipped
8 commits on `genesis/resume-netra-survey` (see STATUS TASK-2026-07-02-RESUME-NETRA-SURVEY for the per-commit ledger). Highlights: recruiter ledger at root with strata narrowing + honest derived counts; **first production companion-register NETRA** (streaming SSE with real tool-lifecycle 2-line blocks, offline `· local` fallback, 429 dormancy pair, point-mode desktop+touch); eval/audit suite; A4 print; Lighthouse a11y 95; zero phone digits repo-wide.

## Parked / open (owners + dates in STATUS)
- Peat-seam: Vercel deploy (`resume-main`) · `AI_GATEWAY_API_KEY` · metric-truthfulness eyeball · optional flash-lite swap · optional separate-repo migration. block_until 2026-08-14.
- Carried RED: F8 main-repo entry-glitch clip-path variant (worktree app fixed, main repo not); F1–F7 article fixes still parked uncommitted on store-as-source.

## Where the knowledge lives
- `worldline-frontend-pipeline` skill — 2026-07 run-log (stall-kill causes, direct-agent fallback, contract-threading from journal.jsonl, pair-fix with technique-sync, targeted re-verify).
- Memories: `dev-clobber-guard-systemwide` (updated with think-stall cause), `project_about_resume_split` (updated to shipped state).
- Plan file: `~/.claude/plans/redesign-resume-neoex-dev-here-is-declarative-llama.md` (full architecture, still accurate).
