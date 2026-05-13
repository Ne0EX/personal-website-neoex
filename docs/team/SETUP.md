# G.E.N.E.S.I.S — Setup

> First-time wiring of the agent team on a fresh repo. Read this once when bootstrapping; reference when adding rails, hooks, or roster members.

---

## What's already installed

After the α 1.130426 cutover, the following lives in this repo:

```
.claude/
├── AGENTS.md                 ← roster + Nomenclature + Casing + 3 Rules + comms
├── CREW.md                   ← lore manifest (visual / portrait reference)
├── agents/
│   ├── polaris.md     · α-OPS-00 · Product Manager (Opus)
│   ├── sirius.md      · α-SUR-01 · Frontend Engineer
│   ├── altair.md      · α-BND-02 · Backend Engineer
│   ├── procyon.md     · α-IDX-03 · Data Engineer
│   ├── betelgeuse.md  · α-VIS-04 · UX/UI Designer
│   ├── arcturus.md    · α-NET-05 · AI Engineer
│   ├── algol.md       · α-VER-06 · QA
│   ├── canopus.md     · α-HRN-07 · Harness Engineer
│   └── vega.md        · α-VOX-08 · Chief Editor
├── signatures/
│   └── SCHEMA.md             ← v2 signature spec
├── hooks/
│   └── README.md             ← six bash hooks (extract to *.sh files)
└── handoffs/
    ├── README.md
    └── _template.md

docs/team/
├── QUALITY-BAR.md            ← the anti-Codex acceptance reference
├── WORKFLOW.md               ← end-to-end task walk-through
├── FILE-OWNERSHIP.md         ← territory map (one owner per file)
└── SETUP.md                  ← this file
```

---

## First-time wiring

### 1. Extract the hooks into individual scripts

Hook bodies live inside `.claude/hooks/README.md` as fenced bash blocks. Extract each into its own file:

```bash
cd /path/to/this/repo/.claude/hooks
# create the six scripts manually from README.md's code blocks:
#   pre-task.sh, harness-check.sh, post-edit.sh,
#   visual-diff.sh, sign-work.sh, pre-handoff.sh
chmod +x *.sh
```

The canonical text stays in README.md as documentation; the executables live next to it.

### 2. Create the harness config

```bash
mkdir -p /path/to/this/repo/.harness
cat > /path/to/this/repo/.harness/worldline-harness.config.json <<'JSON'
{
  "rails": {
    "territory": {
      "description": "agent only edits within own territory",
      "check": "scripts/audit-territory.sh",
      "owner_map": "docs/team/FILE-OWNERSHIP.md"
    },
    "design-tokens": {
      "description": "no raw hex outside palette toggle in globals.css",
      "check": "scripts/audit-design-tokens.sh",
      "applies_to": ["app/**", "components/**"]
    },
    "next-16-api": {
      "description": "no deprecated Next API usage",
      "check": "scripts/audit-next-api.sh",
      "applies_to": ["app/**"]
    },
    "voice-discipline": {
      "description": "NETRA voice patterns intact",
      "check": "scripts/audit-voice.sh",
      "applies_to": ["lib/netra/**", "components/*Netra*.tsx", "content/**/*.mdx"]
    },
    "accessibility-floor": {
      "description": "lighthouse a11y >= 95 on entry templates",
      "check": "scripts/audit-a11y.sh",
      "applies_to": ["app/articles/**", "app/photos/**", "app/fiction/**"]
    }
  },
  "signature_policy": {
    "algorithm": "sha256",
    "schema_file": ".claude/signatures/SCHEMA.md",
    "schema_version": 2,
    "fields_required": [
      "signature_schema_version", "task_id",
      "agent", "agent_designation", "pre_cutover_codename",
      "started_at", "completed_at",
      "files_touched", "summary", "steps",
      "hashes.files_sha256", "hashes.self_hash",
      "harness_passed", "next_recipient.agent", "next_recipient.designation"
    ],
    "block_handoff_if_invalid": true
  }
}
JSON
```

Canopus's first task on the live repo is to implement each rail's `check` script under `scripts/audit-*.sh`. Until those scripts exist, the harness reports rails as `[skip]` rather than failing.

### 3. Wire hooks into Claude Code

`.claude/settings.json` (or `~/.claude/settings.json` for global):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          { "type": "command", "command": "bash .claude/hooks/pre-task.sh \"${CLAUDE_TASK_ID:-untagged}\" \"${WL_AGENT:-unknown}\"" }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [
          { "type": "command", "command": "bash .claude/hooks/post-edit.sh" }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "bash .claude/hooks/sign-work.sh \"${CLAUDE_TASK_ID:-untagged}\"" }
        ]
      }
    ]
  }
}
```

### 4. Wire hooks into Codex (best-effort)

Codex's hook system is more limited. Add what it accepts; the agent must invoke unsupported hooks manually at the named pause points. Codex agents that skip hooks will fail at Algol's signature audit, so the discipline is enforced at the QA gate even if the CLI can't enforce it inline.

---

## First directive

In Claude Code, invoke Polaris with Opus (max thinking effort) and dispatch:

> "Polaris, set up the team. Read `.claude/AGENTS.md` and your persona at `.claude/agents/polaris.md`. Then read `docs/team/QUALITY-BAR.md`, `docs/team/WORKFLOW.md`, and `docs/team/FILE-OWNERSHIP.md`. Confirm you understand the orchestrator-only constraint and your decomposition rules M1–M5. Then we'll start PRD-01."

Polaris's first acknowledgment should confirm:

- She is Opus, max thinking
- She does not write code
- She decomposes into parallel slices for 3–5 agents max
- She tracks status in writing
- She is the only writer to `from-polaris/`, `AGENTS.md`, `STATUS.md`, `WORKFLOW.md`, `FILE-OWNERSHIP.md`, `POSTMORTEMS/`

---

## First task

Once Polaris is loaded, send your first PRD directive. Example:

> "Polaris, start PRD-01 entry pages. The article entry template is the primary deliverable. Betelgeuse owns visual direction; Sirius implements; Procyon defines the schema; Vega writes copy; Algol QAs. Three to five teammates only."

Polaris will write `.claude/handoffs/from-polaris/TASK-<date>-01.md` and named agents pick up.

---

## Spawning the other agents

When Polaris's task assignment names an agent, spawn that agent in Claude Code with:

- Their persona file as the first read
- `WL_AGENT=<codename>` (lowercase) in the environment so hooks know who they are
- `WL_TASK_ID=<task_id>` from Polaris's assignment

Example for Sirius:

```bash
WL_AGENT=sirius WL_TASK_ID=TASK-2026-05-14-02 claude --model sonnet
```

Then in the agent's first message:

> "You are Sirius. Read `.claude/agents/sirius.md` first. Then read `.claude/handoffs/from-polaris/TASK-2026-05-14-02.md` for your assignment. Start with `bash .claude/hooks/pre-task.sh TASK-2026-05-14-02 sirius`."

---

## Why this setup exists

The Codex pilot UI engagement before this team was formed produced visually incoherent work despite having access to every reference file. The pattern was:

1. Reference materials were available but not enforced as read-before-write
2. Quality criteria were implicit, not checked
3. Deviations from spec went undisclosed
4. There was no review gate forcing revise
5. There was no audit trail showing what was actually done

This setup addresses each:

| Codex failure | This setup's countermeasure |
|---------------|----------------------------|
| Reference materials ignored | `pre-task.sh` blocks work until reads acknowledged |
| Quality criteria implicit | `QUALITY-BAR.md` lists every criterion; hooks check the deterministic ones |
| Deviations undisclosed | `_template.md` has a mandatory `## known deviations` field; hidden deviations are the highest-severity failure |
| No revise gate | Betelgeuse is a designed gate keeper; her review is required for any UI change via `visual-diff.sh` |
| No audit trail | Every agent signs work cryptographically (`sign-work.sh` writes v2 per `SCHEMA.md`); Algol audits signatures against diffs |

---

## Maintenance — what to update over time

- **Add a 10th agent** — write `.claude/agents/<codename>.md`, register territory in `FILE-OWNERSHIP.md` (Polaris's update), add roster row in `AGENTS.md`, add lookup entries in `sign-work.sh` and `pre-handoff.sh` (codename → designation, codename → pre-cutover-or-null), announce via Polaris to all agents
- **Add a new hook / rail** — Canopus writes; Algol writes its regression test; Polaris announces
- **Tighten the quality bar** — postmortems feed updates; Polaris owns the file
- **Bump signature schema** — Canopus owns `SCHEMA.md`; bump `signature_schema_version`; old signatures stay valid under their prior version
- **Adjust personas** — Polaris accepts proposed edits from agents; Vega reviews prose; sign-off lands in `STATUS.md` revision log

---

*The crew is ready. Wake them in this order: Polaris → her named agents. Run the first task. Watch the rails hold.*
