# Rail Definitions

> Rail owner · Canopus (α-HRN-07)
> Last updated · 2026-05-15
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

## Rail: STATUS.md write guard

**Check:** embedded in `.claude/hooks/pre-handoff.sh` (check 4a)
**Applies to:** `docs/team/STATUS.md`
**Implemented:** 2026-05-15 · TASK-2026-05-15-meta3 · Canopus
**Root cause addressed:** DIAG-2026-05-15-status-md-race — parallel Polaris subagent writes

### What it checks

When a non-Polaris agent lists `docs/team/STATUS.md` in `files_touched`, pre-handoff.sh
computes the net line delta between the current working tree version and the HEAD-committed
version. If that delta exceeds 80 lines, the handoff is **blocked** (exit 11).

80 lines is a deliberately generous threshold. A normal section-append (one TASK block)
is 20–40 lines. 80 lines gives room for a wide closure block with detailed acceptance
notes. Anything beyond 80 lines is a full-file rewrite — the failure mode that triggers
the race.

### Why this rail exists

`docs/team/STATUS.md` is Polaris-maintained shared state. Before this rail, every agent
had STATUS.md whitelisted as writable territory (to let them append their own closure
sections). When Polaris dispatched four subagents in parallel, each read STATUS.md, each
wrote a section, and the last writer won — erasing the earlier writers' content. Claude
Code's optimistic-concurrency guard caught the race with "File has been modified since
read" but could not resolve it.

The race is eliminated by funneling non-Polaris writes through the staging directory and
letting root-Polaris merge them in a single Edit.

### Protocol — how STATUS.md gets written

```
Participants               What they do
──────────────────────     ─────────────────────────────────────────────────────
Non-Polaris agent          Writes its section to:
                               docs/team/.status-drafts/<task_id>--<agent>.md
                           (plain Markdown fragment; no frontmatter needed)
                           Signs and hands off normally.

Root Polaris               After all parallel subagents complete:
  (the one running         1. Reads every draft in .status-drafts/
  the task loop)           2. Merges them into STATUS.md in a single Edit
                           3. Deletes the draft files
                           This is a single-writer operation — no race.

Root Polaris               May write directly to STATUS.md in its own Edit
  (solo, no subagents)     without staging. The guard exempts AGENT=polaris.
```

### Atomic section format

STATUS.md is composed of atomic sections. Each section is self-contained —
it does not reference line numbers or relative positions in sibling sections.

| Section type              | Heading pattern |
|---------------------------|-----------------|
| TASK entry                | `## TASK-YYYY-MM-DD-NN · <title> · <status>` |
| TASK with qualifier       | `## TASK-YYYY-MM-DD-NN (α) · <title> · <status>` |
| Named section             | `## <section-name>` (e.g., `## Peat decisions log`) |
| Named section sub-item    | `### <sub-item>` (scoped inside named section) |
| Parallelism map           | `## parallelism map (<context>)` |
| Development plan landing  | `## development plan landed · YYYY-MM-DD` |
| Known gaps                | `## known infrastructure gaps (parked — not blocking but logged)` |
| Footer                    | `*last update · <date> · <agent> (<designation>) — <summary>*` |

**Append-only convention:** Non-Polaris agents append to the end (before the footer),
or insert within a named section they own (e.g., Algol appending to an audit sub-section).
They do not modify existing sections written by other agents.

### Structural exception — Polaris subagent bootstrapping

Polaris subagents dispatched for a DEV-PLAN or batch-assignment wave should write
their STATUS sections to `.status-drafts/<task_id>--polaris.md` (even though they are
Polaris-agent instances), because the guard cannot distinguish root-Polaris from a
subagent. Root-Polaris merges after the wave completes.

Operationally: *Polaris instructs its own subagents to use the staging directory.*
The guard at pre-handoff.sh is a safety net — the protocol is upstream of it.

### How to fix a guard failure (exit 11)

1. Check the net delta number in the error message.
2. If it is genuinely a full-file rewrite: revert STATUS.md, extract your section content,
   write it to `docs/team/.status-drafts/<task_id>--<agent>.md`, re-sign, re-run pre-handoff.sh.
3. If it is a legitimate section-append that happens to exceed 80 lines (unusual but valid):
   open a handoff to Polaris explaining why, and request that Polaris run the merge.
   Do not squeeze content to stay under the threshold — signal the anomaly instead.

### Regression test

`tests/harness/status-write-guard.sh` — 5 scenarios covering: large non-Polaris delta
(blocked), large Polaris delta (allowed), small non-Polaris delta (allowed), exactly-at
threshold (allowed), one-over threshold (blocked).

Run: `bash tests/harness/status-write-guard.sh`

---

## Rail: checkpoint

**Hook scripts:** `.claude/hooks/save-checkpoint.sh`, `.claude/hooks/postuse-agent-counter.sh`
**Manual wrapper:** `scripts/save-checkpoint.sh`
**Implemented:** 2026-05-15 · TASK-2026-05-15-META-4 · Canopus
**Root cause addressed:** Rate-limit cascade of 2026-05-15 — 12 agents went down simultaneously; Polaris had to write SAVE-POINT manually (burned tokens). This rail makes that automatic and zero-token.

### What it does

Captures deterministic session state to disk in < 1 second, from pure shell + git + filesystem operations. **Zero model calls.** Survives even when the Anthropic API quota is exhausted, because it runs in a bash subprocess entirely outside the model loop.

Two output artifacts per checkpoint:

| Artifact | Path | Purpose |
|---|---|---|
| Rolling head | `docs/team/SAVE-POINT.md` | Latest checkpoint; Peat reads this single file to resume |
| Timestamped archive | `docs/team/.checkpoints/YYYY-MM-DD-HH-MM-SS.md` | Immutable history; archaeology if rolling head is insufficient |

### Three triggers

| Trigger | When it fires | Guard |
|---|---|---|
| **Stop** (always-on) | Every Claude turn end | Skips if no changes since last checkpoint (git status hash compare); skips if not a task session (no `$CLAUDE_TASK_ID` and `$WL_CHECKPOINT_ALWAYS` not set) |
| **PostToolUse(Agent) threshold** | After each `Agent` tool use | Fires when counter ≥ N=3 in current turn window; counter resets after threshold cross so each new wave gets a checkpoint |
| **Manual** | `bash scripts/save-checkpoint.sh "<note>"` | Always writes; note string appended to checkpoint header |

The three triggers are composable and independent. A wave of 5 agents gets: one postuse-threshold checkpoint at agent #3, and a Stop checkpoint at turn end.

### Checkpoint content (what gets saved)

Every checkpoint captures (no model, pure disk/git reads):

```
## checkpoint <timestamp>
trigger: <stop | postuse-threshold | manual>
note: <optional>
task_id: <$CLAUDE_TASK_ID or none>
session_id: <$CLAUDE_SESSION_ID or none>

### git state
git status --porcelain (head -40)
git log -5 --oneline

### signatures (last 10, newest first)
ls -t .claude/signatures/*.json | head -10

### handoffs (new since last checkpoint)
find .claude/handoffs -name "*.md" -newer .claude/.last-checkpoint | head -15
fallback: ls -t .claude/handoffs/from-*/*.md | head -15

### in-flight signal
grep in-flight|queued|in-progress from STATUS.md → TASK IDs

### tmp task outputs
ls -t /tmp/claude-*/tasks/*.output | head -10

### dirty tree / untracked deliverables
git ls-files --others --exclude-standard | head -30

### resume: diff vs previous checkpoint
diff of git status snapshots between this and previous checkpoint
```

### Storage scheme

- **Archive** (`docs/team/.checkpoints/*.md`): gitignored (runtime artifact). `.gitkeep` tracks the directory so fresh clones have it.
- **Rolling head** (`docs/team/SAVE-POINT.md`): committed in repo. Contains latest checkpoint + last 3 prior checkpoint bodies (tail-friendly, stays < 5 KB).
- **Marker** (`.claude/.last-checkpoint`): gitignored. Records `status_hash`, `timestamp`, `archive_file` for the change-detection guard.

### Resume protocol

```
1. Read docs/team/SAVE-POINT.md           → latest checkpoint, current git state
2. Read docs/team/STATUS.md               → TASK status (trust signatures over STATUS body)
3. Consult docs/team/.checkpoints/        → archaeology if rolling head is insufficient
4. Check .claude/signatures/ for recent   → verify what actually landed on disk
```

### Performance

- Wall time: < 1 second (all ops are local shell + git status + file reads)
- Output size: < 5 KB per checkpoint (git status head-40, log -5, signature list head-10)
- No external calls (no curl, no API)

### Fail-safe behavior

If any sub-command fails (e.g., git not available, STATUS.md not found), the checkpoint writes anyway with partial data and an `### errors` section listing what failed. A partial checkpoint is better than no checkpoint.

### How to fix a failure

The checkpoint hook never blocks the agent (`exit 0` even on sub-command errors). It is observability infrastructure, not a quality gate. If checkpoints stop appearing:

1. Check `.claude/hook-logs/<timestamp>--checkpoint-<trigger>.log` for error detail
2. Verify git is available in the hook's execution context
3. Verify `docs/team/.checkpoints/` directory exists (tracked by `.gitkeep`)
4. If `SAVE-POINT.md` is missing: run `bash scripts/save-checkpoint.sh "manual recovery"` once to re-establish

### Regression test

`tests/harness/checkpoint.sh` — 3 scenarios covering: stop trigger writes (with task context set), postuse-threshold at N=3 fires, manual trigger writes without task context.

Run: `bash tests/harness/checkpoint.sh`

---

## Rail: prototype-visual-ref

**Hook:** `.claude/hooks/prototype-ready.sh`
**Trigger:** PostToolUse(Write|Edit|MultiEdit) on `docs/design/prototypes/**/*.html`
**Implemented:** 2026-05-15 · TASK-2026-05-15-64 · Canopus/Polaris
**Gate:** none — fire-and-continue, always exits 0

### What it does

When Betelgeuse writes an `.html` file to `docs/design/prototypes/`, the hook:
1. Logs `[PROTOTYPE-READY] <filename> — betelgeuse · <task_id>` to `.claude/hook-logs/prototype-ready.log`
2. Writes a minimal notify handoff to `.claude/handoffs/from-betelgeuse/PROTO-<task_id>--to-sirius.md` containing the prototype path and derived spec path

### Why this rail exists

Sirius needs to know when a new visual reference is available without polling. The notify handoff gives Sirius a deterministic signal: "prototype is ready, here is where to find it."

### Non-blocking by design

Prototypes are reference artifacts. A write failure in this hook must never block Betelgeuse's work — the hook exits 0 unconditionally.

---

## Rail: prototype-layer

**Check:** `scripts/audit-prototype-discipline.sh`
**Applies to:** `prototypes/**`, `.claude/visual-diffs/**/prototype/**`
**Status:** enforcing
**Introduced:** 2026-05-15 · TASK-2026-05-15-META-10 · Canopus

**Purpose:** Enforce that the prototype layer stays vanilla — no TypeScript, no JSX, no Next.js imports, no `@/` path aliases. Each prototype directory must have a README.md.

**Why this rail exists:**
Betelgeuse's prototypes are the rendered ground-truth that Sirius ports from. If prototypes contain TypeScript or Next.js imports, they become accidentally importable into the production graph — blurring the ownership boundary and creating hydration risk. Keeping prototypes vanilla preserves the clean handover: Betelgeuse ships working HTML/CSS/JS, Sirius adds the production concerns.

**Rules enforced:**

| Rule | What it checks |
|------|---------------|
| R1 | No `.ts` or `.tsx` files in `prototypes/**` |
| R2 | No `from 'next/...'` import statements in prototype JS files |
| R3 | No `import` statements referencing `@/` in prototype JS files |
| R4 | Each subdirectory directly under `prototypes/` has a `README.md` |

**How to fix a fail:**
- **R1:** Remove or rename the `.ts`/`.tsx` file. Use plain JavaScript. Document types in comments if needed.
- **R2:** Remove the Next.js import. Prototypes are standalone; they cannot reference the production module graph.
- **R3:** Remove the `@/` import. Copy-paste the utility into the prototype directory if you need it.
- **R4:** Add `prototypes/<surface>/README.md` explaining what the prototype represents, what design decision it validates, and which production component it maps to.

---

## Rail: prototype-production-diff (STUB)

**Check:** `scripts/audit-prototype-production-diff.sh`
**Applies to:** `prototypes/**`, `app/**`
**Status:** stub (real logic deferred to META-11)
**Introduced:** 2026-05-15 · TASK-2026-05-15-META-10 · Canopus

**Purpose:** Detect visual drift between Betelgeuse's prototype and Sirius's production implementation before the brand-bearing surface ships. Catches soul-loss in translation — when the implementation diverges from the design intent at the pixel level.

**Current behavior (stub):** exits 0 with a TODO message. Does not block any task closure.

**Planned implementation (META-11):**
1. Locate prototype: `prototypes/<surface>/index.html`
2. Locate production: `app/<surface>/page.tsx`
3. Render both via Playwright MCP at canonical viewport (1440×900)
4. Pixel diff via pixelmatch → percentage drift
5. Compare against thresholds from `.harness/diff-thresholds.json`
6. Emit: `PASS` / `DRIFT-FLAG` / `FAIL` with drift percentage and screenshot paths

**Why deferred:** pixel diffing has tuning challenges (font rendering, anti-aliasing, dynamic content). The runtime rail (prototype-runtime) handles binary pass/fail. Drift detection requires a calibrated threshold approach that needs the rendering infrastructure to stabilize first.

---

## Rail: prototype-runtime

**Check:** `scripts/audit-prototype-runtime.sh`
**Applies to:** `prototypes/**`, `.claude/visual-diffs/**/prototype/**`
**Status:** enforcing
**Introduced:** 2026-05-15 · TASK-2026-05-15-META-10 · Canopus

### What it checks

Loads each prototype `index.html` in a headless Chromium browser and asserts:

| Check | What fails |
|-------|-----------|
| C1 | Any `console.error()` output (unless allowlisted in `.harness/runtime-allowlist.json`) |
| C2 | Any uncaught JS exception (page error) |
| C3 | Any failed network request (404, CORS error, module load failure) |
| C4 | DOM anchor: the body must render at least 4 direct non-script children, OR the prototype must configure a custom selector via `<meta name="wl-anchor" content="selector">` |

### Why this rail exists

Peat caught the gap 2026-05-15: a prototype passed harness (file existence + signature + lint) but returned `ERR_CONNECTION_REFUSED` when he reloaded — because `python3 -m http.server` wasn't running. Iter 1 shipped 6 PNG screenshots as evidence of a one-time render, but no persistent gate verified runtime correctness on subsequent loads. This rail closes that gap permanently.

Existence of files does not prove runtime correctness. This rail does.

### Prototype configuration

Add this tag in the `<head>` to configure a custom DOM anchor selector:

```html
<meta name="wl-anchor" content="#globe-canvas">
```

Without this tag, the fallback heuristic (`body > *:not(script)` count > 3) applies.

### Ephemeral HTTP server

The rail spawns an ephemeral `python3 -m http.server` on a random free port in the `8800-8999` range. This avoids collision with Peat's `localhost:8731` dev server. The server is torn down after each prototype check.

### Allowlist

Warnings from known CDN sources (Google Fonts, etc.) can be allowlisted in `.harness/runtime-allowlist.json` so they do not cause false FAIL verdicts. Edit the `allowed_console_patterns` and `allowed_network_patterns` arrays.

### Skip behavior

If `playwright-core` is unavailable (e.g., fresh clone without browser installation), the rail exits 3 (`WARN`) rather than 1 (`FAIL`). Agents are not punished for platform issues — the WARN is logged and the handoff is not blocked by the runtime rail alone. Polaris may choose to require explicit `playwright install chromium` as a setup step in future.

### Timeout

30 seconds per prototype. Under the H4 hooks-are-fast budget. If a prototype takes longer than 30 seconds to load, it fails C1–C4 via timeout.

### How to fix a fail

- **C1 (console error):** Open the prototype locally (`python3 -m http.server 8888`), open browser DevTools, reproduce the error. Fix the underlying asset, script, or logic issue.
- **C2 (page exception):** A JS error was thrown and nothing caught it. Add a try/catch or fix the root cause.
- **C3 (network failure):** A resource 404'd or was blocked. Check that all `href`/`src` paths are relative and the referenced file exists in the prototype directory.
- **C4 (DOM anchor):** The page rendered empty or too sparse. Ensure the prototype has a real body, or add `<meta name="wl-anchor">` to configure a custom selector.

### Integration with pre-handoff.sh

When Betelgeuse hands off to Sirius AND `files_touched` includes a prototype path, `pre-handoff.sh` checks that a `## prototype port checklist` block is present in the handoff document. This checklist is distinct from the runtime audit — the runtime audit proves the prototype loads, the checklist ensures Sirius knows what production concerns to address when porting.

---

## Prototype-to-production handover protocol

> Introduced 2026-05-15 · TASK-2026-05-15-META-10 · Canopus

This protocol defines the formal flow from Betelgeuse's design prototype to Sirius's production implementation. It is enforced by the `prototype-layer`, `prototype-runtime`, and `prototype-production-diff` rails and by the `pre-handoff.sh` prototype port checklist gate.

```
Betelgeuse ships prototypes/<surface>/
    ├── index.html     (standalone prototype)
    ├── style.css      (prototype-scoped; no Next.js imports)
    ├── script.js      (vanilla JS only)
    └── README.md      (required by discipline rail R4)
    ↓ prototype-runtime rail verifies it loads in browser
    ↓ pre-handoff.sh requires ## prototype port checklist block
    ↓ handoff to Sirius

Sirius reads prototype as ground truth
    ↓
Sirius writes components/*.tsx + app/* with production concerns:
  - hydration safety   (useEffect for browser-only reads)
  - TypeScript types   (Article / Photo / Fiction from @/lib/content)
  - a11y wiring        (focus management, ARIA, role attributes)
  - reduced-motion     (prefers-reduced-motion media query)
  - SSR safety         (no Date.now() / Math.random() / localStorage in initial render)
  - Test coverage      (regression test at tests/<surface>.test.tsx)
    ↓
Sirius captures production rendered shot via Playwright MCP
    ↓
Algol diff rail · audit-prototype-production-diff.sh (META-11 when live)
    ↓
verdict: PASS / DRIFT-FLAG / FAIL (soul-loss in translation)
```

### Prototype port checklist (required in Betelgeuse → Sirius handoff)

The `pre-handoff.sh` gate (check 4c) requires a `## prototype port checklist` section in any Betelgeuse → Sirius handoff that touches prototype paths. Minimum required fields:

```markdown
## prototype port checklist

- production target path: app/<surface>/page.tsx (or components/<name>.tsx)
- production concerns:
  - hydration: [describe any client-only state or effects]
  - types: [describe content types and data shapes]
  - a11y: [describe focus management, ARIA requirements]
  - motion: [describe animation intent; reduced-motion fallback]
  - SSR safety: [any browser-only APIs in the prototype JS]
- expected diff tolerance: [e.g., "fonts may differ; layout must be exact"]
- rendered checkpoint path: .claude/visual-diffs/<task_id>/prototype/screenshot.png
```

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
