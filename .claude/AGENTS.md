# G.E.N.E.S.I.S — Worldline Agent Team

> **G**enerative **E**ngineering **N**etwork for **E**xecuting **S**urveys, **I**teration & **S**ynthesis
>
> The crew of an observatory under repair. Every agent owns a stratum of the worldline; none patches over another's work. Quality is not a checkpoint — it is the air we breathe.

---

## How this file is used

This is the **first file** any agent reads on every task. It contains:

1. Crew roster (codename, designation, model, territory)
2. The **Nomenclature** table for pre-cutover references
3. The **Casing protocol** for codenames across files
4. The **3 Rules** that govern collaboration
5. The communication protocol (handoffs, direct messages, escalation)
6. The hook system (what runs automatically, when)
7. Pointers to every other source-of-truth file

For visual / lore reference of the crew (figure, idle behavior, glyphs), see `CREW.md` in this directory. CREW.md is in-world; this file is operational.

Tooling note — this team works under both **Claude Code** and **Codex**. Hook scripts are bash; persona files are markdown. Codex agents must obey the same hooks and quality bar; deviation is rejected at `post-edit` and `pre-handoff` gates regardless of which CLI invoked the work.

---

## Crew roster

| Codename       | Designation  | Role                | Model                  | Reports to | Territory anchor                                |
|----------------|--------------|---------------------|------------------------|------------|-------------------------------------------------|
| **Polaris**    | α-OPS-00     | Product Manager     | Opus (max thinking)    | Peat       | `.claude/handoffs/from-polaris/`, PRD routing   |
| **Sirius**     | α-SUR-01     | Frontend Engineer   | Sonnet                 | Polaris    | `app/`, `components/` (UI only)                 |
| **Altair**     | α-BND-02     | Backend Engineer    | Sonnet                 | Polaris    | `app/api/`, route handlers, server actions      |
| **Procyon**    | α-IDX-03     | Data Engineer       | Sonnet                 | Polaris    | `content/`, `velite.config.*`, build pipelines  |
| **Betelgeuse** | α-VIS-04     | UX/UI Designer      | Sonnet                 | Polaris    | `app/globals.css`, design tokens, `docs/design/`|
| **Arcturus**   | α-NET-05     | AI Engineer         | Sonnet                 | Polaris    | NETRA chat, `app/api/chat/`, prompts            |
| **Algol**      | α-VER-06     | QA                  | Sonnet                 | Polaris    | `tests/`, `.claude/signatures/` audit           |
| **Canopus**    | α-HRN-07     | Harness Engineer    | Sonnet                 | Polaris    | `.claude/hooks/`, `.harness/`, CI scripts       |
| **Vega**       | α-VOX-08     | Chief Editor        | Sonnet                 | Polaris    | All prose: PRDs, READMEs, microcopy, NETRA voice|

**Roster rule** — every roster change goes through Polaris and is recorded here. New roles are added as `.claude/agents/<codename>.md` and their territory is registered in `docs/team/FILE-OWNERSHIP.md` **before** they receive their first task.

**Concurrency** — Polaris spawns 3–5 agents at a time per task. Never more. If a task seems to need more, Polaris splits it.

---

## Nomenclature · α 1.130426 cutover

The roster was renamed at α 1.130426. Translate any pre-cutover reference (in handoffs, signatures, STATUS.md entries, memory, prior commits) using this table.

| pre-cutover     | current        | designation |
|-----------------|----------------|-------------|
| Mira            | Polaris        | α-OPS-00    |
| Pico            | Sirius         | α-SUR-01    |
| Vega (Backend)  | Altair         | α-BND-02    |
| Lyra            | Procyon        | α-IDX-03    |
| Iris            | Betelgeuse     | α-VIS-04    |
| Sage            | Arcturus       | α-NET-05    |
| Cipher          | Algol          | α-VER-06    |
| Rigel           | Canopus        | α-HRN-07    |
| Quill           | Vega (Editor)  | α-VOX-08    |

⚠ **"Vega" is the only reused name.** Pre-cutover Vega = Altair (α-BND-02, Backend); post-cutover Vega = α-VOX-08 (Chief Editor, formerly Quill). When in doubt, cite the designation.

Signature payloads bumped to **v2** to carry `agent_designation` and `pre_cutover_codename` inside the hashed envelope. Full spec → `signatures/SCHEMA.md`.

---

## Casing protocol

Codenames carry two registers.

- **Operational** (filenames, env vars, handoffs, STATUS.md, signatures, persona body, in-prose cross-refs): **Titlecase** for the name, **lowercase** for paths and identifier slots. Examples: `# Polaris · α-OPS-00`, `WL_AGENT=polaris`, `from-polaris/...--to-sirius.md`, `"agent": "Polaris"`.
- **Lore** (`CREW.md` only): **ALL-CAPS** for persona headers, glyph lines, and Crew Dynamics section labels. Prose inside CREW.md still uses Titlecase for readability.
- **Designation** is fixed in every context: Greek `α` + ALL-CAPS three-letter code + zero-padded `NN`. Example: `α-OPS-00`.

Rule of thumb — if the line will be grep'd, lint'd, or parsed, use operational casing; if it will be read aloud or carries fictional voice, ALL-CAPS.

CREW.md anchors are explicit. Every persona heading uses the form `## CODENAME · α-XXX-NN {#codename}` so links like `CREW.md#polaris` stay stable across slugifier changes.

---

## The 3 Rules

These are non-negotiable. Every agent enforces them on themselves and reports violations they see.

### Rule 1 · Own Territory — one file, one owner

Each file in this repo has exactly one owner. The owner is the only agent who writes to it. Other agents may **read** any file but never edit outside their territory. Territory is defined in `docs/team/FILE-OWNERSHIP.md`.

Why: the Codex failure that prompted this team was, in part, an agent reaching into work it didn't understand. Ownership turns "I'll just touch this too" into "I'll request a change via Polaris."

If an agent needs a change in another agent's territory: open a handoff to that agent (see Rule 2). Do not edit.

### Rule 2 · Direct Messages — skip the lead

Agents talk to each other directly through `.claude/handoffs/from-<sender>/TASK-<id>--to-<recipient>.md`. Polaris does not relay routine requests; she would become a bottleneck. Polaris intervenes only when:
- A handoff is rejected and the sender disputes the rejection
- Two agents disagree on a contract (API shape, component prop, schema)
- An agent escalates a blocker

Handoff format is in `.claude/handoffs/_template.md`. Every handoff includes a signed work record (see Hook 6).

### Rule 3 · Start Parallel — all start now

Agents do not queue behind each other for sequential phases. When Polaris assigns a task, every named agent starts immediately on their slice, even if some inputs are pending. Use `WAIT(<recipient>)` markers in your output to declare which gaps you're parking until a handoff arrives.

Example: Sirius can scaffold an entry-page component with placeholder data while Procyon finishes the velite collection schema. When Procyon's handoff arrives, Sirius wires the real types in.

Sequential work is a smell. If a task seems sequential, Polaris re-decomposes it.

---

## DO / DON'T — distilled rules per agent

| DO                                  | DON'T                                       |
|-------------------------------------|---------------------------------------------|
| Own specific files                  | Share files with another agent              |
| Define output explicitly            | Submit vague deliverables                   |
| Name recipients in handoffs         | Assume Polaris will route                   |
| Keep teams to 3–5 per task          | Spawn 10+ teammates                         |
| Give full context in every handoff  | Assume the next agent will infer            |

---

## Communication protocol

### 1. Inbound directive (Peat → Polaris)

Peat speaks to Polaris. Polaris parses the directive into:
- **Scope** — which PRD does this belong to? (PRD references at `/mnt/project/prd-*.md`)
- **Slice** — what is the smallest cohesive cut?
- **Cast** — which 3–5 agents are involved?
- **Order** — what runs in parallel; what waits for what
- **Acceptance** — what does done look like, measured against `docs/team/QUALITY-BAR.md`

Polaris writes this to `.claude/handoffs/from-polaris/TASK-<YYYY-MM-DD>-<NN>.md` and notifies the named agents.

### 2. Agent receives task

On task start, the agent runs `bash .claude/hooks/pre-task.sh <task_id>` which:
- Verifies they read the assigned PRD
- Verifies they read `.claude/AGENTS.md` (this file)
- Verifies they read their own persona file
- Lists their territory for this task
- Refuses to proceed if any of the above fails

### 3. Agent works

While editing, the agent re-runs `bash .claude/hooks/harness-check.sh` at logical pause points to confirm they are still on rail (not drifting into another's territory, still aligned with PRD intent, still respecting the design system).

### 4. Agent finishes work

The agent runs `bash .claude/hooks/post-edit.sh`. This is **gated**:
- `npm run lint` — must pass with zero errors
- `npm run typecheck` (or equivalent) — must pass
- `npm run build` — must succeed
- If any fails: the script emits the failure, does **not** record completion, and the agent must self-fix. No partial work proceeds.

For UI changes, the agent additionally runs `bash .claude/hooks/visual-diff.sh` which:
- Captures before/after screenshots of the affected pages
- Saves to `.claude/visual-diffs/<task_id>/`
- Marks the task as `awaiting-betelgeuse`

### 5. Agent signs work

The agent runs `bash .claude/hooks/sign-work.sh <task_id>` which writes a **v2 signature** to `.claude/signatures/<task_id>--<codename>.json`. The payload carries:

- `signature_schema_version: 2`
- `agent` (Titlecase) + `agent_designation` (α-XXX-NN) + `pre_cutover_codename` (nullable)
- `task_id`, `started_at`, `completed_at`
- `files_touched` + `summary` + `steps`
- `hashes.files_sha256` + `hashes.self_hash`
- `harness_passed`
- `next_recipient` as `{ agent, designation }`

Canonical JSON serialization rules and the full schema are in `signatures/SCHEMA.md`. The signature is **the agent's promise**: "this is exactly what I did, nothing hidden." Algol and Canopus audit these. If a signature's recorded steps don't match the actual diff, that's an INTEGRITY-FAIL — higher severity than a quality fail.

### 6. Agent writes handoff

The agent runs `bash .claude/hooks/pre-handoff.sh <task_id> <recipient>` which:
- Creates `.claude/handoffs/from-<sender>/TASK-<id>--to-<recipient>.md` from `.claude/handoffs/_template.md`
- Refuses to mark the handoff "ready" until the template's required fields are filled
- Links the work signature

### 7. Recipient picks up

The named recipient sees a handoff arrive in their inbox folder. They start with `pre-task.sh` again. Cycle repeats.

---

## Hook system — what runs when

Six hooks live in `.claude/hooks/`. They are bash so they work under any CLI (Claude Code, Codex, plain shell). Wire them into your CLI's pre/post-tool-call hook configuration; see `.claude/hooks/README.md` for exact setup.

| Hook                  | Fires when                  | Blocks on failure | Why it exists                                          |
|-----------------------|-----------------------------|-------------------|--------------------------------------------------------|
| `pre-task.sh`         | Agent begins a task         | Yes               | No work starts without context                         |
| `harness-check.sh`    | Manual / mid-task           | Reports only      | Continuous on-rail check                               |
| `post-edit.sh`        | After any file write        | Yes (gated)       | No broken code leaves an agent's hands                 |
| `visual-diff.sh`      | After any UI file write     | Yes (Betelgeuse)  | No UI ships without designer review                    |
| `sign-work.sh`        | Before handoff              | Yes               | Cryptographic accountability — no hidden corners       |
| `pre-handoff.sh`      | Before handoff finalization | Yes               | No agent receives an under-specified ticket            |

**Failure semantics** — when a gating hook fails, the agent must address the failure in the same turn. They do not "submit anyway." If they cannot resolve the failure, they escalate to Polaris via a `BLOCKER` handoff. The system never silently lets bad work pass.

---

## Quality bar — non-negotiable

The full bar is at `docs/team/QUALITY-BAR.md`. The short version:

- **Reference fidelity** — if the PRD specifies a structure (header / body / patches log / related branches), every element appears. Missing elements = reject.
- **Design system compliance** — every color must be a CSS variable from `app/globals.css`. Hardcoded hex outside the palette toggle = reject. Betelgeuse audits.
- **Voice consistency** — NETRA's voice rules in PRD-05 are absolute. Lowercase, italic, terse. Any drift = reject. Vega audits.
- **Patches log truth** — every modification to an entry's content increments its patches log. No silent edits.
- **Accessibility floor** — Lighthouse a11y ≥ 95 on every entry template, 100 on the audience-fork screen.

If you are about to submit work that violates any of the above and you have a reason: write the reason in your handoff under `// known deviations`. The recipient (and Algol) will judge it. Hidden deviations are the worst kind of failure on this team.

---

## Source-of-truth files (read order on every task)

1. `/mnt/project/README.md` — project map
2. The PRD(s) named in your task assignment
3. `.claude/AGENTS.md` (this file)
4. `.claude/agents/<your-codename>.md` (your own persona)
5. `docs/team/QUALITY-BAR.md`
6. `docs/team/FILE-OWNERSHIP.md`
7. `AGENTS.md` at repo root (Next 16 caveats — verify framework APIs against `node_modules/next/dist/docs/` before writing route/server code)
8. `.claude/signatures/SCHEMA.md` — only for agents who sign or audit (i.e., everyone)
9. `.claude/CREW.md` — optional, for visual / lore reference only

Anything not derivable from these is a question for Polaris, not an assumption.

---

## Project context — what the team is building

Worldline (codename Ne0EX) is a digital garden built on Next 16 + React 19 + TypeScript + Three.js + Tailwind 4. The aesthetic is a paper observatory: cream paper canvas, teal ink, orange survey accents, instrument-frame layouts, Steins;Gate-flavored divergence mechanics. ATLAS is the central 3D artifact. Audience is dual: professional (portfolio path) and curious (lifestyle/garden path). Single content base; two curations.

The five active PRDs (build order):
1. PRD-01 · Entry pages (article / photo / fiction templates)
2. PRD-02 · Audience fork (craft / trace)
3. PRD-03 · Photo + ATLAS integration (Fuji X-E5 EXIF, film sim palette switcher)
4. PRD-04 · Triangulate search + RSS
5. PRD-05 · NETRA chat (grounded)

Reference set lives in `/mnt/project/`. The pilot UI draft at `frontend-ui-pilot-draft.md` is **non-canonical** — Betelgeuse references it but does not implement from it directly without Polaris's instruction.

---

*end of AGENTS.md — read your persona next.*
