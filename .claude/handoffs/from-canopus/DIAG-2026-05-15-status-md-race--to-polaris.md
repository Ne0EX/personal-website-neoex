---
task_id: DIAG-2026-05-15-status-md-race
from: canopus
to: polaris
designation: α-HRN-07 → α-OPS-00
date: 2026-05-15
type: diagnostic-report
files_touched: []
signature: none-required (read-only investigation; exit-3 path per pre-task.sh §Step-0)
---

# DIAGNOSTIC · STATUS.md modification race · 2026-05-15

## verdict — primary cause

**Parallel Polaris subagent writes flushing into STATUS.md after Polaris's read window.**
This is a structural concurrency issue, not a hook, formatter, or filesystem-sync issue.

Confidence: high. All other candidate causes are eliminated below.

---

## findings by investigation thread

### 1. Hook and harness layer — CLEARED

No hook, harness rail, or script writes to STATUS.md.

Evidence:
- `post-edit.sh` — runs lint + typecheck + build only; no file writes outside log output
- `sign-work.sh` — writes only to `.claude/signatures/<task_id>--<agent>.json`; reads STATUS.md hash for harness check but does not write it
- `pre-task.sh` — writes only to `.claude/hook-logs/<task_id>--baseline.json`
- `session-start.sh` — emits JSON to stdout only; no file writes
- `on-dispatch.sh` — appends only to `.claude/hook-logs/polaris-dispatch.log`
- `harness-check.sh` — runs rail scripts; none of the audit scripts (territory/design-tokens/next-api/voice/a11y) write STATUS.md

`scripts/audit-territory.sh` explicitly WHITELISTS `docs/team/STATUS.md` — it grants every agent permission to write there, but the script itself does not write it.

`grep -r "STATUS.md" .claude/hooks/` → zero hits.
PostToolUse hook in `.claude/settings.json` fires on `Write|Edit|MultiEdit` and calls `post-edit.sh` — `post-edit.sh` does not touch STATUS.md.
Stop hook fires `sign-work.sh` — does not touch STATUS.md.

### 2. Markdown formatter / linter / editor — CLEARED

- No `prettier`, `markdownlint`, or `remark` installed globally or as project devDependencies
- No `package.json` `lint-staged`, `husky`, or `prebuild` that touches `.md` files
- No `.husky/` directory
- No active git hooks in `.git/hooks/` (only `.sample` files)
- No `.vscode/` settings that could trigger format-on-save

### 3. iCloud/Dropbox filesystem sync — CLEARED

- Project lives at `/Users/neospiritth/codingspace/personal_website/` which is NOT inside `~/Library/Mobile Documents/` (iCloud Drive) and NOT inside a Dropbox folder
- `com.apple.provenance` xattr `010 20a` on STATUS.md is standard macOS provenance metadata written at file creation — does not indicate active cloud sync
- No `brokenalias` or `.icloud` stub files present
- Directory listing shows no Dropbox or iCloud overlay processes

### 4. Parallel Polaris subagent writes — CONFIRMED ROOT CAUSE

The DEV-PLAN session (2026-05-15 ~11:25–11:30 UTC) dispatched four Polaris subagents (A/B/C/D) as parallel tasks. Each ran `pre-task.sh`, which recorded a baseline for `docs/team/STATUS.md`. Each subagent had `docs/team/STATUS.md` listed in its territory (Polaris territory block includes STATUS.md explicitly).

Completion timestamps from signatures:
- DEV-PLAN-A--polaris: `2026-05-15T11:29:23Z`
- DEV-PLAN-B--polaris: `2026-05-15T11:29:28Z` (5 seconds after A)
- DEV-PLAN-D--polaris: `2026-05-15T11:30:03Z`
- DEV-PLAN-C--polaris: `2026-05-15T11:30:19Z`

All four completed within a 57-second window. Signatures for A and B include each other's signature file in `files_touched` — confirming overlapping write windows.

Later in the session, additional Polaris writes to STATUS.md occurred from TASK-14 (Betelgeuse, `2026-05-15T12:01:25Z`) and the REVISE-jarc-pass2 chain (`2026-05-15T11:20:28Z`). Seven distinct signatures in total record STATUS.md as touched on 2026-05-15.

The current git diff vs HEAD shows 157 net additions to STATUS.md — all authored content (Peat decision log, TASK-14 BLOCKED entry, TASK-22 duplicate, DEV-PLAN reconciliation, remaining-Peat-decisions resolution block). The spurious sections described in the diagnostic request are all from these flush events hitting a Polaris instance whose Read predated the writes from sibling instances.

**Mechanically:** Polaris (main instance) reads STATUS.md. Sibling Polaris subagents (A, B, C, D) each independently write their sections to STATUS.md in their own overlapping time windows. When main-instance Polaris's Edit fires, Claude Code's file-modification guard detects the mtime/content has changed since the Read, rejects with "File has been modified since read."

The content that "appeared" between reads is not adversarial or erroneous — it is genuine Polaris subagent output that flushed into the file. The clean-bullet voice (not Polaris's verbose draft voice) reflects a different sub-Polaris instance's natural prose style.

### 5. Duplicate TASK-2026-05-15-22 entry — explained

The duplicate is from two different Polaris instances both writing a TASK-22 closure block without coordination. Main-Polaris wrote the verbose acceptance-verified version (lines 466–488). A subagent or a second main-instance write added the sparse version (lines 511–518). Both are structurally valid; neither is corrupted. This is the classic "last-writer-wins but both writers produced content" failure mode.

---

## root cause summary

The harness is clean. The filesystem is clean. The race is entirely in the application layer: multiple Polaris agent threads (main + 4 DEV-PLAN subagents + implicit task-closure writes from other task-agents) have STATUS.md whitelisted as shared write territory, no write lock, no merge protocol, and no ordering guarantee. The Claude Code Edit tool's optimistic-concurrency guard (read → edit → conflict-on-mtime-change) correctly detected the race but cannot resolve it.

This is not a hook bug. It is a protocol gap.

---

## mitigation: how Polaris should handle this going forward

### immediate (no TASK needed)

**Read-retry with re-diff before Edit.**
After any Edit failure citing "File has been modified since read," re-read STATUS.md, compute what changed versus Polaris's draft, and apply only the delta that is not already present. Do not attempt a full-overwrite Edit — attempt a targeted section append or section-replace Edit of only the lines Polaris needs to add/update.

**Serialization at dispatch time.**
When dispatching multiple subagents that may all write STATUS.md (e.g., A/B/C/D DEV-PLAN instances), explicitly instruct each subagent to write its section to a separate staging file (e.g., `docs/team/.status-drafts/DEV-PLAN-A.md`) rather than directly to STATUS.md. Root-Polaris merges the staging files into STATUS.md in a single Edit after all subagents complete.

### structural (open a TASK for Canopus to implement)

**Option A — section-lock convention.**
Add a header comment in STATUS.md defining section ownership by TASK-ID. Each agent Edit is a targeted section append only (never a full file rewrite). Conflicts reduce to same-section conflicts, which are much rarer.

**Option B — staging-file merge protocol.**
Canopus adds a `pre-handoff.sh` check: if STATUS.md appears in `files_touched`, require that the write was via a named staging file merged by root-Polaris. Blocks direct STATUS.md Edits from subagents.

**Option C — serialized STATUS writes in post-edit.sh.**
`post-edit.sh` detects STATUS.md in the diff and writes a lock sentinel (`.claude/hook-logs/status-write-lock`). If the lock exists when another agent's `post-edit.sh` runs, the second agent waits or retries. Simple filesystem-level serialization, no external tooling.

Canopus recommendation: Option A is lowest disruption. The existing territory whitelist and the "every agent updates their own slice" convention are correct — they just need the atomic-section discipline to go with them. A TASK can formalize this with a STATUS.md section format spec and a `pre-handoff.sh` check that the Edit is section-scoped.

---

## sign-work.sh / post-edit.sh — do they inadvertently touch STATUS.md?

No. Confirmed by full script reads above. Neither script writes to STATUS.md or reads it for mutation. `sign-work.sh` computes sha256 of files in `files_touched` — it reads STATUS.md only if STATUS.md was already marked as touched by the agent's session (baseline-aware comparison).

---

## is another Polaris subagent currently flushing?

No active subagents detected. The DEV-PLAN instances (A/B/C/D) all completed between 11:29 and 11:30 UTC with clean signatures. The hook-logs show no currently-running `--post-edit.log` writes for STATUS.md. The last mtime on STATUS.md is `May 15 19:02` (local) = ~2026-05-15T12:02 UTC, consistent with TASK-14 Betelgeuse closure (`completed_at: 2026-05-15T12:01:25Z`).

---

## proposed TASK for Canopus

If Polaris agrees with Option A, open:

```
TASK: STATUS.md section-lock format spec + pre-handoff check
assignee: canopus
scope:
  - Define atomic section format for STATUS.md (each TASK block is self-contained; no inter-block references that create write-ordering dependencies)
  - Update audit-territory.sh or pre-handoff.sh to detect and reject full-file rewrites of STATUS.md from non-Polaris agents
  - Add STATUS.md write protocol to docs/harness/RAIL-DEFINITIONS.md
effort: S
blocks: nothing; parallel-safe
```

---

*Canopus · α-HRN-07 · read-only diagnostic · no files touched · no signature required*
