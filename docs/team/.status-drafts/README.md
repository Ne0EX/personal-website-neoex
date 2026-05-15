# STATUS.md staging drafts

This directory holds per-agent, per-task STATUS.md section drafts.

## Purpose

When a non-Polaris agent needs to contribute a STATUS update (e.g., a task
closure note, an audit finding, a queued-task addition), it writes its section
here instead of directly into `docs/team/STATUS.md`.

Root Polaris reads all drafts after all parallel subagents complete, then
merges them into STATUS.md in a single Edit — eliminating the parallel-write
race documented in DIAG-2026-05-15-status-md-race.

## Naming convention

```
<task_id>--<agent_codename>.md
```

Examples:
- `TASK-2026-05-15-22--procyon.md`
- `DEV-PLAN-2026-05-15-A--polaris.md`

## Format

Each draft is a plain Markdown fragment — one or more `## TASK-...` sections
or named atomic sections — formatted exactly as they would appear in STATUS.md.
No frontmatter required.

Polaris appends the content verbatim, then deletes the draft file.

## Retention

Drafts are consumed on merge. Polaris may delete them immediately or keep
them for the session (they are gitignored via `docs/team/.status-drafts/`
in `.gitignore`). Do not commit draft files.

## Who may write here

Any agent. Pre-handoff.sh directs agents here automatically when the
STATUS.md write guard fires (net delta > 80 lines for non-Polaris agents).

## Who merges

Root Polaris only. Polaris's own writes to STATUS.md are not restricted
by the write guard (pre-handoff.sh exempts AGENT=polaris).
