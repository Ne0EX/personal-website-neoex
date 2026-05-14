# Rail Definitions

> Rail owner · Canopus (α-HRN-07)
> Last updated · 2026-05-14
> Config source · `.harness/worldline-harness.config.json`

---

## What "on rail" means

A rail is a named, automated quality check that applies to specific parts of the working tree. Rails run via `harness-check.sh` at logical pause points during a task. A failed rail does not immediately block work, but a `harness_passed: false` in the signature blocks handoff.

Every rail:
- Has a named check script in `scripts/`
- Is defined in `.harness/worldline-harness.config.json`
- Has an entry below explaining what it checks, why, and how to fix common failures

---

## Rail: territory

**Check:** `scripts/audit-territory.sh`
**Applies to:** all files
**Purpose:** An agent only edits files within its own territory (per `docs/team/FILE-OWNERSHIP.md`). Cross-territory edits require an explicit handoff to the file's owner.

**How to fix a fail:**
- Check `docs/team/FILE-OWNERSHIP.md` to identify who owns the flagged file
- Revert the edit in the flagged file
- Open a handoff to the owning agent requesting the change

---

## Rail: design-tokens

**Check:** `scripts/audit-design-tokens.sh`
**Applies to:** `app/**`, `components/**`
**Purpose:** No raw hex color values (`#[0-9a-fA-F]{3,8}`) outside two whitelisted locations:
- `app/globals.css` — where palette variants are defined
- `components/WorldlineGlobe.tsx` — where Three.js requires numeric color values

**How to fix a fail:**
- The audit emits `file:line` of each offending hex value
- Replace with the corresponding CSS variable from `app/globals.css`
- If the color you need isn't tokenized, that's a Betelgeuse handoff, not a workaround — do not add a CSS variable without design review

---

## Rail: next-16-api

**Check:** `scripts/audit-next-api.sh`
**Applies to:** `app/**`
**Purpose:** No deprecated Next.js API usage. This codebase runs a version with breaking API changes vs training data. The audit flags imports or patterns from deprecated APIs.

**How to fix a fail:**
- Read `node_modules/next/dist/docs/` for the current API
- Replace deprecated patterns per the migration notes

---

## Rail: voice-discipline

**Check:** `scripts/audit-voice.sh`
**Applies to:** `lib/netra/**`, `components/*Netra*.tsx`
**Purpose:** NETRA voice patterns intact in prompts and components. Voice drift in NETRA output is a product quality issue, not just a style issue.

**How to fix a fail:**
- Compare the flagged string against NETRA's voice spec in `lib/netra/`
- Restore the expected pattern; do not paraphrase

---

## Rail: accessibility-floor

**Check:** `scripts/audit-a11y.sh`
**Applies to:** `app/articles/**`, `app/photos/**`, `app/fiction/**`
**Purpose:** Lighthouse a11y score >= 95 for any new entry template. Below this threshold, screen readers and assistive tech have a materially degraded experience.

**How to fix a fail:**
- Run Lighthouse locally: `npx lighthouse http://localhost:3000/<route> --only-categories=accessibility`
- Address the failing audits in the report (almost always: missing alt text, contrast ratio, or semantic structure)

---

## Baseline mechanism — sign-work.sh file discovery

> This section documents the file-scoping mechanism behind `files_touched` in signatures.
> It is not a rail (it does not run in `harness-check.sh`) but it is part of the harness
> contract and belongs in this doc.

### The problem it solves

Worldline frequently has uncommitted files from multiple in-flight tasks in the working tree at any given time. Before 2026-05-14, `sign-work.sh` used `git diff --name-only --diff-filter=AMD HEAD` to discover files to list in `files_touched`. This captured every dirty file in the tree, not just files touched by the current task. Result: signatures with bloated `files_touched` lists and hash drift after signing (a file listed but not part of this task gets updated later, breaking Algol's verification).

### The fix

**`pre-task.sh` writes a baseline snapshot** at `.claude/hook-logs/<task_id>--baseline.json` at task start. The baseline records the sha256 of every file that is already dirty at that moment.

**`sign-work.sh` reads the baseline** and subtracts carry-over files (files whose current hash matches the baseline hash) from the dirty set. Only files that are new, deleted, or modified relative to the baseline appear in `files_touched`.

### Correct workflow

```
1.  bash .claude/hooks/pre-task.sh <task_id> <agent>   # must be FIRST — before any edits
    → writes .claude/hook-logs/<task_id>--baseline.json
    → baseline records carry-overs at this moment

2.  [agent makes edits]

3.  bash .claude/hooks/sign-work.sh <task_id>
    → reads baseline
    → files_touched = (dirty now) - (dirty && unchanged at baseline)
    → only this task's actual edits appear in the signature
```

### Important: pre-task.sh must run before the first edit

If `pre-task.sh` runs after edits, those edits appear in the baseline and sign-work.sh excludes them as carry-overs (because their hashes haven't changed since the baseline was taken). The signature will then list zero task files and `sign-work.sh` will exit 3 ("nothing to sign"). This is the correct behavior — it correctly detected that no new changes occurred after the baseline was established.

**Recovery if this happens:** delete the baseline file and re-run `sign-work.sh`. The fallback path (no baseline) produces the pre-fix behavior (all dirty files listed) with a warning. That's better than a false-clean signature.

### Fallback path

If `.claude/hook-logs/<task_id>--baseline.json` does not exist:
- `sign-work.sh` emits three warning lines to stderr
- Falls back to `git diff HEAD` (original behavior, all dirty files listed)
- Exit codes are unchanged
- The signature is written and is valid; it may contain carry-over files

Algol does not treat a fallback signature differently from a baseline-scoped one. The `files_touched` field is verified by recomputing hashes from the working tree regardless of how the list was derived.

### Baseline file format

```json
{
  "recorded_at": "2026-05-14T10:58:40Z",
  "task_id": "TASK-2026-05-14-XX",
  "agent": "canopus",
  "files": {
    "path/to/carry-over-a.ts": "sha256-hex",
    "path/to/carry-over-b.md": "sha256-hex",
    "path/to/deleted-file.ts": "DELETED"
  }
}
```

The `DELETED` sentinel marks a file that was absent from the working tree at baseline time. If it reappears at sign time, it was restored by this task.

---

*end of RAIL-DEFINITIONS.md*
