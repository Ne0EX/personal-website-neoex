## scope

Implement Option A (Polaris-only orchestrator permissions) per Peat's sign-off.
Add `Task` tool to Polaris frontmatter, enforce dispatch depth rule in WORKFLOW.md,
create dispatch audit hook.

## what i did

**Files changed (original task):**

1. `.claude/agents/polaris.md` — added `tools:` frontmatter line:
   ```
   tools: Task, Read, Edit, Write, Bash, Glob, Grep, ToolSearch, Skill, WebSearch, WebFetch
   ```

2. `docs/team/WORKFLOW.md` — inserted "Dispatch depth" section.

3. `.claude/hooks/on-dispatch.sh` — new non-blocking dispatch audit hook.

4. `.claude/hooks/README.md` — added documentation entry for on-dispatch.sh.

## verification result

**STATUS: VERIFICATION FAILED · partial revert — 2026-05-14**

Polaris ran `ToolSearch select:Task,Agent` from a subagent session. Neither tool appeared.
Root cause confirmed: `tools:` frontmatter field does not surface dispatch tools in subagent
sessions. This is a platform-tier limitation of the current Claude Code version — not a config
block or syntax error.

## what was reverted vs kept

**REVERTED:**
- `.claude/agents/polaris.md` — `tools:` line removed. It did not work and created a false
  impression that Polaris had Task dispatch capability. Any future reader seeing that line would
  be misled.

**KEPT (updated):**
- `docs/team/WORKFLOW.md` — "Dispatch depth" section kept in full. Wording updated to accurately
  reflect the platform reality: Polaris is the planning orchestrator; actual Task dispatch runs
  through Peat's root session. Subagents cannot dispatch subagents in current Claude Code.
  Section now instructs teams to revisit if the platform capability changes.

- `.claude/hooks/on-dispatch.sh` — kept. The hook is valid as a root-session PreToolUse hook
  on `Task` in `.claude/settings.json`. It was never designed to be called from within a
  subagent; the incorrect framing was in the README, not in the hook implementation itself.

- `.claude/hooks/README.md` — "on-dispatch.sh" entry updated. Removed "Polaris calls this hook"
  framing. Now correctly states: fires at root session, wired as PreToolUse on Task, platform
  limitation documented.

## platform limitation confirmed

Subagents in Claude Code (current version) cannot dispatch further subagents via the Task tool,
regardless of `tools:` frontmatter. The Task and Agent tools are available only in Peat's root
interactive session. This is not configurable via agent file frontmatter.

## Algol audit items (reduced — 2 of 4 remain relevant)

1. ~~Verify tools: frontmatter syntax~~ — MOOT. The line has been removed; platform confirmed
   it has no effect for Task injection.

2. Record this verification result in the audit trail — this document serves that purpose.
   Algol should note the platform finding in AUDIT.md.

3. ~~Add regression check: grep "^tools:" polaris.md~~ — MOOT. The line is removed; the
   correct check is now that polaris.md does NOT have a `tools:` line claiming Task capability
   (since the claim would be false). Algol may optionally add a note in AUDIT.md that `tools:`
   frontmatter is inert for Task/Agent tools in Claude Code subagent sessions.

4. Review on-dispatch.sh `date` call portability (macOS vs Linux) — still relevant. Current
   implementation tries `date -u +%FT%TZ` then falls back to `date -u`. Should be verified on
   macOS zsh environment.

## known deviations

- `tools:` frontmatter experiment failed. Platform limitation documented in WORKFLOW.md.
- on-dispatch.sh was designed under the assumption Polaris would call it from a subagent.
  Corrected: hook is valid only at root session level, wired via settings.json PreToolUse.

## signature

Canopus · α-HRN-07
Task: TASK-POLARIS-ORCHESTRATOR-2026-05-14 (verification follow-up)
Completed: 2026-05-14
Files touched:
  - .claude/agents/polaris.md (tools: line removed)
  - docs/team/WORKFLOW.md (dispatch depth section wording updated)
  - .claude/hooks/README.md (on-dispatch entry corrected)
  - .claude/handoffs/from-canopus/polaris-orchestrator-permissions-2026-05-14.md (status updated)
