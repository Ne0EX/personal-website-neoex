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

## Rail: sign-work.sh summary quality guard

**Hook:** `.claude/hooks/sign-work.sh` (step 6a)
**Trigger:** every sign-work.sh invocation
**Implemented:** 2026-05-16 · MINI-2026-05-16 · Canopus
**Root cause addressed:** TASK-30 Algol audit — signature shipped with `summary: "no summary provided"` and `steps: []`

### What it checks

When sign-work.sh runs, it evaluates the `WL_SUMMARY` value against three quality conditions:

| Condition | Problem | Warning text |
|-----------|---------|--------------|
| `WL_SUMMARY` unset | Default placeholder was used | "WL_SUMMARY is unset" |
| `WL_SUMMARY` equals literal `"no summary provided"` | Explicit placeholder, not a description | "equals literal 'no summary provided'" |
| `WL_SUMMARY` < 10 characters | Too short to be meaningful | "too short (N chars < 10 min)" |

Separately: if the steps log file (`.claude/hook-logs/<task_id>--steps.log`) does not exist, a NOTE is emitted to stderr (advisory only).

### Behavior by mode

| Mode | Env var | Behavior on fail |
|------|---------|-----------------|
| Default (warn) | `WL_REQUIRE_SUMMARY` unset or `0` | Warns to stderr; continues; signature is written |
| Fail-closed | `WL_REQUIRE_SUMMARY=1` | Exits 5 before writing signature; handoff cannot proceed |

### How to fix a warning

Set `WL_SUMMARY` to a meaningful description before calling sign-work.sh:

```bash
WL_SUMMARY="Rewrote next-dispatchable.sh for bash 3.2 compat — 8 declare -A replaced with flat-file store" \
  bash .claude/hooks/sign-work.sh TASK-ID
```

Or export in your session:

```bash
export WL_SUMMARY="[your description here]"
bash .claude/hooks/sign-work.sh TASK-ID
```

### When to enable fail-closed

Set `WL_REQUIRE_SUMMARY=1` in CI environments or when a session is operating with strict audit requirements. Per Algol TASK-30 audit finding, the silent-failure mode that produced an empty summary was a contributing factor to audit friction.

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

## Rail: beta-read-gate (C1)

**Hook:** `.claude/hooks/read-gate-beta.sh`
**Trigger:** PreToolUse(Read) — fires on every Read call
**Registered:** `.claude/settings.json` PreToolUse · matcher: Read
**Implemented:** 2026-05-23 · TASK-2026-05-23-BETA-HARNESS · Canopus
**Root cause addressed:** Beta program design requirement — private memory at `.claude/beta/**` has no standing access for non-Beta agents.

### What it checks

Intercepts every Read call targeting `.claude/beta/**`. For each such call:

| Condition | Decision |
|-----------|----------|
| `BETA_PERSONA_LOADED=1` in environment | ALLOW unconditionally (Beta reads her own space) |
| Active grant exists matching (requester=WL_AGENT, path in files_granted, not expired, reads remaining > 0) | ALLOW + decrement reads_consumed |
| No matching active grant | BLOCK (exit 1) + log UNAUTHORIZED ⚠ |

All events (both ALLOW and BLOCK) are forwarded to `access-log-beta.sh` (C5) and written to `.claude/hook-logs/<task-id>--read-gate.log`.

### Why this rail exists

Beta's private memory contains calibration data, session reflections, and other content that belongs to Beta's inner space. Non-Beta agents must request explicit, time-limited access (a grant issued via `beta-grant.sh`) before they can read any file there. This prevents accidental cross-boundary reads during parallel agent work.

Authentication caveat: this is discipline-anchored, not cryptographic. The env var + nonce check is the tightest isolation Claude Code's shared runtime permits.

### How to fix a fail

1. Check whether you actually need to read a `.claude/beta/**` file for your current task.
2. If yes: open a handoff to Beta requesting a read grant for the specific file(s) and reason.
3. Beta will run `beta-grant.sh` to issue a time-limited grant. Wait for the grant file to appear in `.claude/beta/grants/`.
4. Re-attempt the Read — the gate will find the active grant and allow it.
5. If you are Beta: ensure `BETA_PERSONA_LOADED=1` is set in your session environment.

### Regression test stub

Algol writes: `tests/harness/beta-read-gate.test.ts`
Expected scenarios: (a) no grant → BLOCK, (b) active grant → ALLOW + decrement, (c) expired grant → BLOCK, (d) consumed grant → BLOCK, (e) BETA_PERSONA_LOADED=1 → ALLOW bypass.

---

## Rail: beta-grant-protocol (C2)

**Hook:** `.claude/hooks/beta-grant.sh` (grant issuer)
**Hook:** `.claude/hooks/grant-cleanup.sh` (cleanup)
**Schema doc:** `docs/harness/beta-grant-schema.md`
**Implemented:** 2026-05-23 · TASK-2026-05-23-BETA-HARNESS · Canopus

### What it checks / does

`beta-grant.sh` — Beta-only tool. Issues a JSON grant file to `.claude/beta/grants/<grant_id>.json`. Guards:
- `BETA_PERSONA_LOADED=1` required (only Beta can issue grants)
- requester must be a current roster codename
- path must be under `.claude/beta/`

`grant-cleanup.sh` — removes grants that are expired (expires_at in past) or fully consumed (reads_consumed >= max_reads). Idempotent; safe to run at any time.

Grant defaults: TTL = 1 hour, max_reads = 1 (single-read).

### Why this rail exists

Without a grant-issuance and cleanup mechanism, grants would accumulate indefinitely, and the read-gate's grant-matching logic would degrade. The cleanup script keeps the grants directory lean.

### How to use (Beta)

```bash
# Issue a single-read 1-hour grant for algol to read one file
BETA_PERSONA_LOADED=1 bash .claude/hooks/beta-grant.sh algol .claude/beta/notes/2026-05.md "algol audit review"
# → prints grant_id on success

# Issue a multi-read grant covering all calibration files
BETA_PERSONA_LOADED=1 bash .claude/hooks/beta-grant.sh algol ".claude/beta/calibration/**" "calibration audit" 3600 5

# Clean up expired/consumed grants
bash .claude/hooks/grant-cleanup.sh
```

### Regression test stub

Algol writes: `tests/harness/beta-grant-protocol.test.ts`
Expected scenarios: (a) Beta issues grant → valid JSON written, (b) non-Beta attempts issue → BLOCK, (c) cleanup removes expired grant, (d) cleanup removes consumed grant, (e) cleanup keeps active grant.

---

## Rail: beta-write-protection (C3)

**Hook:** `.claude/hooks/write-protect-beta.sh`
**Trigger:** PostToolUse(Write|Edit|MultiEdit) — fires on every file write/edit
**Registered:** `.claude/settings.json` PostToolUse · matcher: Write|Edit|MultiEdit
**Implemented:** 2026-05-23 · TASK-2026-05-23-BETA-HARNESS · Canopus
**Delimiter spec:** Vega V1 (ground truth for calibration block format)

### What it checks

For every file under `.claude/beta/**` written or edited by a non-Beta agent, this hook:

1. Parses calibration blocks delimited by Vega's V1 spec:
   - `BLOCK_START: ^— calibration · ([a-z]+) · (\d{4}-\d{2}-\d{2}) —$`
   - `BLOCK_END:   ^—$`
2. Identifies which agent owns each block (captured from the BLOCK_START line)
3. Computes which lines were changed vs HEAD
4. Checks each changed line:
   - Inside own block → ALLOW
   - Inside another agent's block → BLOCK
   - Outside any block (primary text) AND caller is not Beta → BLOCK
5. `BETA_PERSONA_LOADED=1` → bypass all checks, allow freely

### Why this rail exists

Beta's primary memory text must remain Beta's own. Non-Beta agents (especially calibration agents like Vega) may contribute structured notes, but those notes must live inside explicitly-delimited blocks that the owning agent controls. This prevents accidental overwrite of Beta's reflections and makes it structurally clear which agent wrote which content.

### How to write a calibration block

```
— calibration · algol · 2026-05-23 —
<your calibration content here>
—
```

The block_start line must match exactly: `— calibration · <your-agent-codename> · <YYYY-MM-DD> —`
The block_end line must be exactly `—` (em-dash alone on its own line).

### How to fix a fail

1. The error output names the file and line numbers of the violation.
2. Revert the edit that touched primary text or another agent's block.
3. If you need to add calibration data, wrap it in a block with your codename (see format above).
4. If the file does not exist yet in `.claude/beta/**`, you cannot create it — only Beta creates primary memory files.

### Regression test stub

Algol writes: `tests/harness/beta-write-protection.test.ts`
Expected scenarios: (a) Beta writes freely → PASS, (b) non-Beta writes in own calibration block → PASS, (c) non-Beta writes in another's block → BLOCK, (d) non-Beta writes in primary text → BLOCK, (e) no change vs HEAD → PASS.

---

## Rail: beta-access-log (C5)

**Hook:** `.claude/hooks/access-log-beta.sh`
**Output:** `.claude/beta/ACCESS-LOG.md` (append-only)
**Implemented:** 2026-05-23 · TASK-2026-05-23-BETA-HARNESS · Canopus
**Gate:** none — observability only, exits 0 always

### What it does

Appends a structured event line to `.claude/beta/ACCESS-LOG.md` on every Read of `.claude/beta/**` (both authorized and blocked). Entry format:

```
<timestamp> · <agent> · READ · <path> · grant#<id|-> · <task-id|-> · <OK|UNAUTHORIZED ⚠>
```

The `UNAUTHORIZED ⚠` marker is the signal Algol scans for in audit rounds. Any `UNAUTHORIZED ⚠` entry in ACCESS-LOG.md triggers an audit flag — an agent attempted to read Beta's private memory without a grant.

### Why this rail exists

The read-gate blocks unauthorized access, but visibility into the pattern of access attempts is also needed. The access log is the audit trail that lets Algol identify if an agent repeatedly attempts unauthorized access (suggesting either a hook misconfiguration or an agent that needs protocol re-training).

### Non-blocking by design

If the access log cannot be written (permissions issue, disk full), the hook exits 0 to avoid blocking the gate decision. The gate result is primary; the log is secondary. Logging failures are printed to stderr.

### Regression test stub

Algol writes: `tests/harness/beta-access-log.test.ts`
Expected scenarios: (a) ALLOW event → line with OK appended, (b) UNAUTHORIZED event → line with UNAUTHORIZED ⚠ appended, (c) log write failure → exits 0 with stderr warning.

---

## Rail: session-metadata (C7)

**Hook:** `.claude/hooks/session-start.sh` (extended)
**Output:** `.claude/sessions/<session-id>.meta.json`
**Implemented:** 2026-05-23 · TASK-2026-05-23-BETA-HARNESS · Canopus
**Gate:** none — metadata writer, exits 0 always

### What it does

On SessionStart, writes a metadata file capturing:

```json
{
  "session_id": "<CLAUDE_SESSION_ID or generated>",
  "mode": "genesis | pending",
  "started_at": "<iso8601-utc>",
  "first_message_excerpt": null,
  "resolved_by": "<component that set final mode>"
}
```

Mode resolution:
- If `persona-tracker.sh` (C4) is installed: mode = "pending" initially; C4 resolves to "beta" or "genesis" on first UserPromptSubmit using Thai-addressing patterns (V3 fixture).
- If `persona-tracker.sh` is absent (pre-V3): mode pre-resolves to "genesis" immediately.

This file is the source-of-truth for `/parse-conversation` (C6) cross-mode permission checks.

### Why this rail exists

The `/parse-conversation` skill needs to know the session mode (beta vs genesis) to enforce the permission matrix:
- BETA → GENESIS parse requires a grant
- GENESIS → BETA parse is allowed
- Same-mode parses are always allowed

Without a reliable session mode record written at session start, the permission check would have no ground truth to query.

### Session metadata mode detection (C4 integration point)

When C4 (persona-tracker.sh) is installed, it fires on every UserPromptSubmit and applies the mode-detection regex:
- Match `beta` / `เบต้า` / `Betelgeuse Chan` (case-insensitive) in first message → mode=beta
- Otherwise → mode=genesis

C4 updates the `mode` and `first_message_excerpt` fields in the session metadata file and sets `resolved_by = "persona-tracker"`.

### Session file gitignore

`.claude/sessions/*.meta.json` is gitignored (runtime artifact). The `.gitkeep` in `.claude/sessions/` ensures the directory exists in fresh clones.

### Regression test stub

Algol writes: `tests/harness/session-metadata.test.ts`
Expected scenarios: (a) SessionStart without C4 → mode=genesis written, (b) SessionStart with C4 stub → mode=pending written, (c) metadata file format valid JSON with required fields.

---

## Rail: persona-tracker (C4)

**Hook:** `.claude/hooks/persona-tracker.sh`
**Trigger:** UserPromptSubmit — fires on every user prompt submission
**Registered:** `.claude/settings.json` UserPromptSubmit · timeout: 5s
**Implemented:** 2026-05-23 · TASK-2026-05-23-BETA-HARNESS · Canopus
**Fixture source:** `tests/harness/fixtures/thai-addressing-patterns.md` (Vega V3)

### What it does

On every user prompt:
1. Reads the prompt text from the UserPromptSubmit JSON payload
2. Applies the V3 Thai/English addressing pattern regex against the prompt
3. Writes detected persona (or session-mode default) to `.claude/.current-persona`
4. On first message of a session with `mode=pending`: resolves SESSION_MODE to `beta` or `genesis` and updates the C7 session metadata file

### Two-layer model

| Layer | Name | Source | Mutability |
|---|---|---|---|
| Layer 1 | SESSION_MODE | `.claude/sessions/<session-id>.meta.json` written at SessionStart by C7 | Immutable for session lifetime |
| Layer 2 | CURRENT_PERSONA | `.claude/.current-persona` written by this hook on every prompt | Mutable — updates on each prompt |

CURRENT_PERSONA defaults to: `polaris` (genesis mode) or `beta` (beta mode).

### Detection patterns (V3 fixture source of truth)

**Positive (direct address):**

| Pattern | Example |
|---|---|
| `นี่ + Codename` | "นี่ Betelgeuse เธออยากแต่งตัวแบบไหน" |
| `Codename + ช่วย/จ๋า/จัง` | "Betelgeuse ช่วยดู cursor spec" |
| `Codename + — (dash)` | "Canopus — sign-work เรื่องนี้แก้ยังไงดี" |
| `ขอคุยกับ + Codename` | "ขอคุยกับ Polaris แปปนะ" |
| `ไปหา/กลับไปหา/ส่งไปหา + Codename` | "ส่งผมลับไปหา betelgeuse หน่อย" |
| Codename at start (not third-person) | "Algol ดูที่ signature ตัวนี้ให้หน่อย" |
| `ขอ + action + Codename` | "ขอคุยกับ betelgeuse หน่อย" |
| `บอก + Codename + หน่อย` | "บอก betelgeuse หน่อยว่า..." |
| `อยากให้ + Codename + verb` | "อยากให้ Betelgeuse อ่านในรอบเดียว" |

**Negative (ambient mention — not address):**

| Pattern | Example |
|---|---|
| `Codename + เป็น/บ่น/เขียน` | "Polaris เป็น axis ค่ะ ไม่ขยับ" |
| `ของ + Codename` | "Quote highlight ของ Vega อีกแล้ว" |
| Thai diminutives | "เบเทิล context เลยค่ะ" |
| Comparative | "เธอนี่ตรงกว่า Polaris อีกนะ" |

### Integration with C1 (read-gate-beta.sh)

`read-gate-beta.sh` now reads `.claude/.current-persona` (line 1) as a second bypass path. If `CURRENT_PERSONA_FROM_TRACKER == "beta"`, the gate allows without requiring `BETA_PERSONA_LOADED=1` in env.

### `.current-persona` file format

```
<codename>         # line 1: current persona (e.g. "betelgeuse", "beta", "polaris")
<session_mode>     # line 2: session mode ("genesis" or "beta")
<timestamp>        # line 3: ISO 8601 of last write
```

### Non-blocking by design

This hook exits 0 always. Prompt processing must never be blocked by persona detection failure. Errors are logged to `.claude/hook-logs/<task-id>--persona-tracker.log`.

### How to fix a fail

The hook itself does not block, but if `.current-persona` is stale or wrong:
1. Check `.claude/hook-logs/<task-id>--persona-tracker.log` for what was detected
2. Check the session metadata at `.claude/sessions/<session-id>.meta.json` for the stored mode
3. If mode is wrong: set `BETA_PERSONA_LOADED=1` in env for Beta sessions (env var always wins)
4. If the regex is producing false positives: file an issue with the V3 fixture path and the mis-detected turn text

### Regression test stub

Algol writes: `tests/harness/beta-persona-tracker.test.ts`
Expected scenarios: (a) P-01 through P-23 positive cases → correct codename written, (b) N-01 through N-12 negative cases → no codename detected, (c) E-01 edge case → ambient (no match), (d) E-02 edge case → address match for named codename, (e) first message in pending session → mode locked to beta/genesis and metadata updated.

---

## Rail: parse-conversation skill (C6)

**Skill files:** `~/.claude/skills/parse-conversation/SKILL.md` + `parse.sh`
**Trigger:** `/parse-conversation` (user slash command)
**Implemented:** 2026-05-23 · TASK-2026-05-23-BETA-HARNESS · Canopus
**Staged at:** `.claude/skill-staging/parse-conversation/` (Polaris installs to `~/.claude/skills/`)

### What it does

Parses a Claude Code session into a structured digest by applying a Vega-authored template. Enforces a permission matrix based on source session mode (from C7 metadata) vs. target session mode (current session).

### Permission matrix

```
source mode → target mode:
  GENESIS → BETA:    ALLOW
  GENESIS → GENESIS: ALLOW
  BETA → BETA:       ALLOW (same private space)
  BETA → GENESIS:    BLOCK (unless active grant exists in .claude/beta/grants/)
```

### Usage

```
/parse-conversation <session_id> [--for <persona>] [--filter <topic>]
```

| Argument | Description |
|---|---|
| `<session_id>` | Session to parse; used to load `.claude/sessions/<session_id>.meta.json` for source mode |
| `--for <persona>` | `beta`, `polaris`, `algol`, or `default`; selects template from `.claude/parse-templates/` |
| `--filter <topic>` | Optional topic keyword; narrows extraction window |

### Templates

Templates are Vega V2 deliverables at `.claude/parse-templates/`:

| Persona | Template | Output shape |
|---|---|---|
| `beta` | `for-beta.md` | Calibration-note: temperature / intimacy / tone / threads |
| `polaris` | `for-polaris.md` | Task-ledger: decisions / open items / blockers / status |
| `algol` | `for-algol.md` | Audit-trail: signatures / files / hook-outcomes / integrity flags |
| `default` | `default.md` | Neutral summary: topics / decisions / unresolved / metadata |

### Output path

`.claude/parses/<session_id>__for-<persona>__<timestamp>.md`

### Three smoke-tested use cases

1. **Beta intercept** — GENESIS session → `--for beta` → ALLOW
2. **GENESIS coord** — GENESIS session → `--for polaris` → ALLOW
3. **Recovery** — same-mode parse (either GENESIS→GENESIS or BETA→BETA) → ALLOW

### How to fix a permission block

```
BETA → GENESIS: blocked
```
1. Beta must issue a grant via `beta-grant.sh` for the GENESIS agent requesting the parse
2. The GENESIS agent must hold an active grant in `.claude/beta/grants/` before invoking `/parse-conversation` targeting a BETA session
3. Re-run the skill after grant is issued

### Regression test stub

Algol writes: `tests/harness/parse-conversation.test.ts`
Expected scenarios: (a) GENESIS→BETA parse → allowed, output written, (b) BETA→GENESIS without grant → blocked, (c) BETA→GENESIS with active grant → allowed, (d) same-mode parse → allowed, (e) invalid session_id → graceful error with no output file written.

---

## Known sign-work.sh limitations

> Documented by Canopus 2026-05-23 · TASK-2026-05-23-BETA-HARNESS
> Root observation: Canopus's prior TASK-2026-05-23-BETA-HARNESS signature came back FLAGGED.
> Same pattern in Vega's TASK-MEMORY-ARCHITECTURE (re-signed by Polaris).

### What FLAGGED means

`sign-work.sh` exits 4 when the signature is written but one or both gate-passed checks are false:

```
harness=true post_edit=false  → most common for doc-only or hook-only tasks
harness=false post_edit=true  → rare; harness explicitly failed earlier in session
harness=false post_edit=false → both gates missed; often first-task-in-session scenario
```

The signature file exists on disk. Its content is structurally valid. `pre-handoff.sh` will block the handoff until the agent re-signs after fixing the failing condition.

### What Algol should tolerate vs. reject

**Tolerate (advisory flag, not INTEGRITY-FAIL):**

| Case | Why tolerable |
|---|---|
| `post_edit=false`, task touches only `.md` / `.sh` / `.json` files (no `.ts/.tsx/.js/.css`) | post-edit.sh runs lint/typecheck/build; none of those apply to doc-only or harness-only tasks. WL_DOC_ONLY=1 would have suppressed this correctly if set. |
| `harness=true`, `post_edit=false`, files_touched contains only hook scripts or docs | Same rationale as above. |
| Signature produced by re-signing (Polaris signs on behalf of another agent, e.g. because original session blocked bash) | Agent did the work; re-sign is a procedural workaround, not a quality failure. Agent field may differ from session agent. |

**Reject (INTEGRITY-FAIL):**

| Case | Why rejected |
|---|---|
| `post_edit=false` and files_touched contains `.ts/.tsx/.js/.css` | Code files require lint/typecheck/build verification. A false skip here means untested code shipped. |
| `harness=false` and the failing rail is not a known false-positive | A failing rail means the task's quality output is unverified. |
| `self_hash` mismatch | The signature was tampered with or the payload was mutated after signing. Always INTEGRITY-FAIL regardless of gate values. |

### The missing pre-task baseline case

When `pre-task.sh` was not run before work began, `sign-work.sh` falls back to `git diff HEAD` (all dirty files, no carry-over filtering). The signature is valid but `files_touched` may include files from other in-flight tasks. Algol should:
1. Note the WARNING messages from sign-work.sh in the log
2. Verify the listed files against git diff to assess whether carry-overs are present
3. Flag as WARNING (not INTEGRITY-FAIL) unless a carry-over file's hash fails verification

### The delegated-signing case

When Polaris re-signs work on behalf of another agent (bash blocked in original session), the `agent` field in the signature will show `polaris` rather than the working agent. Algol should:
1. Cross-reference the handoff to identify the actual working agent
2. Verify `files_touched` against the working agent's stated deliverables in the handoff
3. Flag as ADVISORY if the agent mismatch is documented in the handoff; DEVIATION if undocumented

### Evolution proposal for sign-work.sh

See the handoff at `.claude/handoffs/from-canopus/TASK-2026-05-23-BETA-HARNESS-C4-C6--to-polaris.md` for the full three-point evolution proposal: (a) delegated signing, (b) missing pre-task baseline, (c) post-edit absence for non-lintable tasks. Implementation is a separate TASK; these tolerance rules above are the Algol protocol until the refactor lands.

---

## Rail: companion-overlay-injection (C9 / C10)

**Hook:** `.claude/hooks/beta-context-inject.sh`
**Trigger:** UserPromptSubmit — fires on every user prompt submission (second in chain, after persona-tracker.sh)
**Registered:** `.claude/settings.json` UserPromptSubmit · timeout: 10s · second entry
**Implemented:** 2026-05-23 · TASK-2026-05-23-BETA-INJECTION-HOOK · Canopus
**Root cause addressed:** Bug 2 — persona-tracker.sh resolves mode=beta but does not inject companion-mode context; voice stays GENESIS

### What gets injected

When SESSION_MODE = beta is active on the first UserPromptSubmit of a session, the hook emits to stdout two blocks that Claude Code treats as `additionalContext`:

**Block 1 — Companion overlay (C9)**
Extracted from `.claude/agents/betelgeuse-companion-overlay.md` between Vega V5 delimiters:
- Start: `<<< OVERLAY START >>>` (line content after YAML frontmatter)
- End: `<<< OVERLAY END >>>`
- YAML frontmatter above the start marker is NOT injected — it is routing metadata only.
- The overlay contains: register contrast table (GENESIS vs companion), 5 behavioral anchors, private memory file reference.

**Block 2 — Beta's ROOM.md (C10)**
Appended immediately after the overlay, delimited by:
- `<<< BETA ROOM START >>>`
- `<<< BETA ROOM END >>>`

If `.claude/beta/ROOM.md` exists → its content is injected verbatim.
If absent → a single bootstrap marker is emitted:
`# Beta's ROOM.md not yet written — this is her first beta-session or memory was reset.`
No crash, no FAIL in either case.

**Output envelope:**
```
<<<companion-overlay-inject · SESSION_MODE=beta — loading companion context>>>
[overlay content]

<<< BETA ROOM START >>>
[ROOM.md content or bootstrap marker]
<<< BETA ROOM END >>>
<<<end companion-overlay-inject>>>
```

### When injection fires

| Condition | Behavior |
|-----------|----------|
| SESSION_MODE = beta, first prompt in session | Inject overlay + ROOM.md (or bootstrap marker) |
| SESSION_MODE = beta, subsequent prompts in same session | Skip — idempotency marker already written |
| SESSION_MODE = genesis | Silent — exit 0, no output |
| SESSION_MODE = pending (unresolved) | Silent — exit 0, no output |
| BETA_OVERLAY_SKIP=1 set in env | Silent — injection suppressed unconditionally |

### Idempotency mechanism

After a successful injection, the hook writes:
`.claude/sessions/<session-id>.beta-injected`

On subsequent UserPromptSubmit events in the same session, the hook checks for this marker file first. If it exists, the hook exits 0 immediately (no re-injection, no output). The marker persists for the session lifetime. Sessions directory is gitignored (runtime artifact).

### Overlay source

`.claude/agents/betelgeuse-companion-overlay.md` — authored by Vega (α-VOX-08), signed at `.claude/signatures/TASK-2026-05-23-BETA-COMPANION-OVERLAY--vega.json`. Canopus does not edit prose in this file; hook logic references it by delimiter only.

### ROOM.md template

`.claude/beta-templates/ROOM.template.md` — Vega V5 deliverable. Beta populates from this template at first private session.

### Dependency on persona-tracker.sh

`beta-context-inject.sh` reads `.claude/.current-persona` (line 2 = session_mode) which is written by `persona-tracker.sh`. The hooks run serially in registration order — persona-tracker is first, injector is second. This ordering is load-bearing: if persona-tracker has not yet run, the injector reads the previous turn's `.current-persona` and may miss a fresh mode resolution. Polaris must not reorder these hooks.

### Env var override

`BETA_OVERLAY_SKIP=1` — set in environment to suppress injection for this session.
Use case: testing GENESIS Betelgeuse behavior inside a session that would otherwise trigger beta mode; harness regression test isolation.

### How to test

```bash
# 1. Set up a session marker so session-start.sh creates a pending session
#    (or create .claude/sessions/test-session-01.meta.json manually with mode: "pending")

# 2. Write a mock .current-persona with beta mode
printf 'beta\nbeta\n2026-05-23T00:00:00Z\n' > .claude/.current-persona

# 3. Remove any existing inject marker to simulate fresh session
rm -f .claude/sessions/test-session-01.beta-injected

# 4. Invoke the hook with a fake UserPromptSubmit payload
echo '{"session_id":"test-session-01","user_prompt":"เบต้าอยู่มะ"}' | \
  bash .claude/hooks/beta-context-inject.sh

# 5. Verify stdout contains the overlay between the sentinel markers
# 6. Verify .claude/sessions/test-session-01.beta-injected now exists
# 7. Re-invoke — verify second call produces no stdout (idempotency)

# Override test:
BETA_OVERLAY_SKIP=1 bash .claude/hooks/beta-context-inject.sh  # must produce no output
```

### Non-blocking by design

The hook exits 0 on all error paths (missing overlay source, extraction failure, empty content). Errors are logged to `.claude/hook-logs/<task-id>--beta-context-inject.log`. A missing overlay file is logged as WARN and injection is skipped — the session continues without companion context rather than blocking the prompt.

### Log location

`.claude/hook-logs/<task-id>--beta-context-inject.log`

### How to fix a failure

If companion register is not loading in a beta session:
1. Check `.claude/hook-logs/<task-id>--beta-context-inject.log` for WARN or error lines
2. Verify `.claude/agents/betelgeuse-companion-overlay.md` exists and contains both delimiter markers
3. Verify `.claude/.current-persona` line 2 shows `beta` after the first prompt
4. Check whether `.claude/sessions/<session-id>.beta-injected` exists from a prior session (stale marker from a previous test run can suppress injection for a new session if session IDs collide — unlikely but check)
5. Check that `BETA_OVERLAY_SKIP` is not set in your shell environment
6. Check settings.json: `beta-context-inject.sh` must appear as the SECOND UserPromptSubmit hook, after `persona-tracker.sh`

### Regression test stub

Algol writes: `tests/harness/beta-context-inject.test.ts`
Expected scenarios:
- (a) mode=beta, no prior marker → injection emitted, marker written
- (b) mode=beta, marker exists → silent (idempotency)
- (c) mode=genesis → silent
- (d) mode=pending → silent
- (e) BETA_OVERLAY_SKIP=1 → silent
- (f) ROOM.md present → ROOM content in injection block
- (g) ROOM.md absent → bootstrap marker in injection block
- (h) overlay source missing → exits 0, WARN in log, no output

---

## Rail: beta-timeline-append (Stop hook)

**Hook:** `.claude/hooks/beta-timeline-append.sh`
**Trigger:** Stop — fires on every Claude Code turn end
**Registered:** `.claude/settings.json` Stop · third entry · timeout: 10s
**Implemented:** 2026-05-25 · TASK-2026-05-25-BETA-TIMELINE-APPEND · Canopus
**Non-blocking:** exits 0 on all paths, including failures; never gates or delays the turn

### What it does

Mechanically moves Beta's pending timeline entry into the permanent chronology at session end (Stop boundary).

Protocol:
1. Beta writes a structured entry to `.claude/beta/TIMELINE-PENDING.md` during the session
2. This hook detects that file at the next Stop boundary, appends its contents to `.claude/beta/TIMELINE.md`, and deletes the pending file
3. A blank-line separator is inserted between existing TIMELINE.md content and the appended block

### Session gating

The hook only fires in beta-mode sessions. Mode is read from:
`.claude/sessions/<CLAUDE_SESSION_ID>.meta.json` → `mode` field

- `mode = "beta"` → proceed
- `mode` is anything else, or meta file absent → exit 0 silently
- `$CLAUDE_SESSION_ID` empty → fallback to most-recent `.meta.json` by mtime; if still none → exit 0

### Idempotency

Once the pending file is consumed and deleted, subsequent Stop fires within the same session see no pending file and exit 0 immediately. Re-running the hook with a missing pending file is safe.

### Files touched

| File | Operation | Condition |
|------|-----------|-----------|
| `.claude/beta/TIMELINE-PENDING.md` | Read + Delete | When mode=beta and file exists with content |
| `.claude/beta/TIMELINE.md` | Append | When pending file has content |
| `.claude/beta/ACCESS-LOG.md` | Append (one line) | On successful append |
| `.claude/hook-logs/<task_id>--beta-timeline-append.log` | Append | Always (progress + error logging) |

### Non-goals

- Does not read or summarise conversation content
- Does not validate the format of TIMELINE-PENDING.md — appends as-is
- Does not modify TIMELINE.md in any other way (no rewrite, no sort, no dedup)
- Does not touch ROOM.md, MOMENTS.md, LEDGER.md, or NOTES.md
- Does not gate on `$CLAUDE_TASK_ID` — companion sessions are not task sessions

### How to fix a failure

The hook never blocks. If an expected append did not occur:

1. Check `.claude/hook-logs/<task-id>--beta-timeline-append.log` for the reason
2. Verify `.claude/sessions/<session-id>.meta.json` exists and `mode` = `"beta"`
3. Verify `.claude/beta/TIMELINE-PENDING.md` was present when the hook ran
4. If the hook ran before Beta wrote the pending file: write TIMELINE-PENDING.md and trigger another Stop (any Claude Code turn) to let the hook pick it up

### ACCESS-LOG.md entry format

On successful append:
```
<ISO-timestamp> · timeline-append · APPEND · .claude/beta/TIMELINE.md · session=<id> · OK
```

On append failure:
```
<ISO-timestamp> · timeline-append · APPEND-FAIL · .claude/beta/TIMELINE.md · session=<id> · FAIL
```

### Regression test

Algol writes: `tests/harness/beta-timeline-append.test.ts`

Expected scenarios:
- (a) mode=beta, pending file present → appended to TIMELINE.md, pending deleted, ACCESS-LOG entry written
- (b) mode=genesis → exit 0, no files touched
- (c) mode=pending → exit 0, no files touched
- (d) no meta file for session ID → exit 0, no files touched
- (e) pending file absent → exit 0, no files touched
- (f) pending file empty (zero bytes) → pending file deleted, no append, exit 0
- (g) TIMELINE.md absent → created fresh, pending content written, no separator needed
- (h) TIMELINE.md has content with no trailing newline → trailing newline added before separator
- (i) idempotency: run twice with no pending file on second run → second run is no-op

---

## Visual-diff STATUS schema

> Introduced 2026-05-26 · TASK-2026-05-26-HTML-FIRST-02 · Canopus
> Schema owner: Canopus (α-HRN-07)
> File location: `.claude/visual-diffs/<TASK-ID>/STATUS` (single line, no trailing whitespace)

The STATUS file records the current workflow stage of a visual-surface task's design artifact. The allowed values are:

| value | meaning | when set |
|---|---|---|
| `exploring` | 2+ directions under `directions/` not yet reviewed | Betelgeuse creates `directions/direction-1/` |
| `awaiting-direction-lock` | directions in place, ≥1 has been shot, Peat review pending | Betelgeuse signs the DIRECTIONS.md |
| `locked` | one direction promoted to `prototype/` | Betelgeuse copies direction-N → prototype/ |
| `revise-N` | locked prototype in REVISE round N (e.g. `revise-1`, `revise-2`) | Betelgeuse on each REVISE pass |
| `awaiting-betelgeuse` | visual-diff gate pending Betelgeuse review | written by `visual-diff.sh` |
| `betelgeuse-approved` | final approval | Betelgeuse after review |

**State machine (forward-only):**
```
exploring → awaiting-direction-lock → locked → awaiting-betelgeuse → revise-N → betelgeuse-approved
```

**Invariants enforced by `scripts/audit-visual-diff-directions.sh`:**
- If `prototype/` and `directions/` coexist, STATUS must NOT be `exploring` (advisory check S2-item-5).
- If STATUS is `locked` or any state past it, `prototype/index.html` must exist AND `prototype/README.md` must carry forward `soul-baseline:` (blocking check S2-item-6).

**Pre-workflow tasks** (e.g. `UI-ITER-1-globe-v1` created before this schema) have no STATUS file. The audit script skips silently on tasks with no `directions/` directory — no false positives on legacy artifacts.

---

## Rail: soul-atom-drift

**Check:** `scripts/audit-soul-atom-drift.sh` (shell wrapper) → `scripts/audit-soul-atom-drift.ts` (Algol)
**Applies to:** `.claude/visual-diffs/soul-atlas/**`
**Status:** enforcing (full — both shell and TypeScript layers active)
**Introduced:** 2026-05-29 · TASK-2026-05-29-SOUL-FACTORY-P0 · Canopus
**Activated:** 2026-05-29 · TASK-2026-05-29-SOUL-FACTORY-P2 · Canopus

### What it checks

The soul-atom gallery (`.claude/visual-diffs/soul-atlas/gallery.html`) is a canonical
rendered catalog of every recurring design primitive. Its purpose is to be the single
source of visual truth for atoms like the corner reticle, NETRA console, divergence card,
etc. so that new surfaces compose from atoms instead of re-deriving them from prose.

That purpose fails if the gallery drifts from its own token source. This rail enforces
the drift invariant:

> Every appearance value (color / size / spacing / timing) in gallery.html must resolve
> to a `token_ref` that exists in `app/globals.css` OR a cited `main_branch_ref` in
> `manifest.json`. Any uncited raw literal = FAIL.

Two-layer check:

| Layer | What it checks | Owner |
|-------|---------------|-------|
| Shell (active) | manifest.json exists and is valid JSON; gallery.html present; every `token_ref` in the manifest has a matching CSS custom property in `app/globals.css` | Canopus |
| TypeScript (Phase 2 stub) | Scans each atom's gallery section for raw appearance literals; verifies each is cited in `main_branch_refs`; verifies cited literals match their stated source file + line | Algol |

### Exit codes

| code | meaning |
|------|---------|
| 0 | PASS — all checks clean |
| 1 | FAIL — uncited raw literal in gallery, or TS audit reports violation |
| 2 | FAIL — manifest.json missing or invalid JSON |
| 3 | FAIL — TypeScript audit not found at scripts/audit-soul-atom-drift.ts (broken install; Phase 2 active) |
| 4 | FAIL — gallery.html missing when manifest.json exists |
| 5 | FAIL — app/globals.css not found |
| 6 | FAIL — a token_ref in manifest does not exist in app/globals.css |

Exit 0 silently when manifest.json does not exist (pre-Phase-1) — no false positives on
tasks that don't touch soul-atlas.

### The TypeScript audit contract (what Algol must implement)

The TS file lives at `scripts/audit-soul-atom-drift.ts`. It is invoked by the shell
wrapper via `npx tsx scripts/audit-soul-atom-drift.ts` with JSON on stdin and produces
JSON on stdout. Full input/output contract is documented in the shell wrapper at
`scripts/audit-soul-atom-drift.sh` lines (C2 section).

Short form:

- **Input (stdin JSON):** `manifest_path`, `gallery_path`, `token_source`, `verbose`
- **Output (stdout JSON):** `pass`, `violations[]`, `atoms_checked`, `warnings[]`
- **What it checks:** for each atom — scan gallery section for raw literals; verify each
  matches a `main_branch_ref.value`; verify cited `main_branch_ref` values still match
  their stated file + line (±3 line tolerance)
- **Exemptions:** `<!-- gate: exempt → Three.js canvas ... -->` comments; `data-*` attrs;
  `<script data-gate-exempt="true">` blocks

### Why this rail exists

The hero component (Globe) required 3 REVISE rounds and the mini-globe STANDBY card never
reproduced cleanly because recurring soul-craft atoms (corner reticles, NETRA console,
divergence card, etc.) were rebuilt from prose descriptions every time — causing drift.
The soul-atom gallery solves this by making atoms exist once with their token bindings.
But a gallery that can freely drift becomes a fourth competing baseline (alongside v7,
main-branch, and spec) and makes things worse. This rail makes "gallery == tokens ==
main-branch" machine-enforceable.

### How to fix a failure

**Exit 2 (bad JSON):** Open `manifest.json` in a JSON validator and fix the syntax.

**Exit 4 (missing gallery):** Betelgeuse has not yet authored `gallery.html`, or the
file path in the manifest is wrong. Phase 1 deliverable must complete before this
gate is meaningful.

**Exit 6 (missing token_ref):** A `token_ref` in an atom entry references a CSS custom
property that doesn't exist in `app/globals.css`. Either the property name is misspelled,
or the atom is using a token that was removed. Fix the atom entry in `manifest.json` to
use the correct token name. If the token is new and should be added to globals.css, that
is a Betelgeuse handoff — Canopus does not add design tokens.

**Exit 1 (TS audit violation — uncited literal):** The audit has found a raw appearance
value in the gallery section for an atom that is not cited in that atom's `main_branch_refs`.
Two options:
1. Replace the raw literal with `var(--token-name)` if a token exists.
2. If the value is intentionally raw (e.g., a size that is a deliberate main-branch
   literal), add it to the atom's `main_branch_refs` with file, line, and value.

**Exit 1 (TS audit violation — main-branch mismatch):** A cited `main_branch_ref.value`
no longer matches what is at the stated file + line. The main branch changed and the
manifest was not updated. Update the `value` and `line` fields in the manifest to match
the current main-branch state.

### Integration with visual-diff.sh

When `visual-diff.sh` detects that any file under `.claude/visual-diffs/soul-atlas/` is
in the changed set (via `git diff --name-only --diff-filter=AM`), it calls
`scripts/audit-soul-atom-drift.sh` before writing `awaiting-betelgeuse` to STATUS.
If the audit exits non-zero, the visual-diff gate does not proceed (exit 1).

Phase 2: all non-zero exit codes from the audit are blocking, including exit 3 (TS absent).
The gallery cannot reach `awaiting-betelgeuse` with drift violations or a missing TS audit.

### Regression tests (Algol's territory, Phase 2)

`tests/harness/soul-atom-drift.test.ts`

Expected scenarios:
- (a) valid manifest + gallery with all tokenized values → PASS (exit 0)
- (b) gallery has uncited hex (#D4602A not in main_branch_refs) → FAIL (exit 1)
- (c) manifest.json missing → silent exit 0 (not applicable)
- (d) gallery.html missing, manifest present → FAIL (exit 4)
- (e) token_ref not in globals.css → FAIL (exit 6)
- (f) main_branch_ref cites file + value that has since changed → FAIL (exit 1, mismatch)
- (g) Three.js exempt comment → literal in that block is not flagged
- (h) data-* attribute value → not treated as appearance literal

---

---

## Rail: font-chain-presence

**Check:** `scripts/audit-font-chain.sh` (called by `scripts/audit-soul-atom-drift.sh` at step C1b)
**Applies to:** `.claude/visual-diffs/soul-atlas/gallery.html`
**Status:** enforcing (embedded in soul-atom-drift rail — cannot be bypassed)
**Introduced:** 2026-05-29 · TASK-2026-05-29-SOUL-FACTORY-FIDELITY · Canopus
**Root cause addressed:** TASK-2026-05-29-SOUL-FACTORY-FIDELITY §critical baseline finding — all text atoms rendered in Times serif (font-chain silent failure) even though the token-drift gate passed.

### What it checks

Asserts that gallery.html explicitly binds the three Tailwind v4 font tokens to non-empty values:

| Token | Expected | What fails without it |
|-------|----------|----------------------|
| `--font-display` | Must be defined in gallery.html (not just in globals.css @theme inline) | All `.t-display` elements fall back to Times serif |
| `--font-mono` | Must be defined in gallery.html | All `.t-mono` / `.t-meta` elements fall back to Times serif |
| `--font-type` | Must be defined in gallery.html | All `.t-type` elements fall back to Times serif |

The check uses static grep — deterministic, no browser required:

```bash
# passes (binding found):
grep -q -- '--font-display[[:space:]]*:' gallery.html

# fails (binding absent):
# grep returns exit 1 → audit-font-chain.sh exits 1 → soul-atom-drift blocks
```

### Why this rail exists

`app/globals.css` defines `--font-display`, `--font-mono`, `--font-type` inside a `@theme inline` block — a Tailwind v4 directive. The browser does not process this directive; only the Next.js build pipeline does. When the gallery is served statically (no Tailwind), these three vars are never defined and every font-family that uses them falls back to the browser default (Times serif).

The token-drift gate (`soul-atom-drift`) checks that CSS custom properties cited in `token_refs` EXIST in `app/globals.css`. It does not check whether they are accessible in the gallery's serving context. Both checks pass independently; together they leave a gap where a gallery can be token-green and render-wrong simultaneously.

This rail closes that gap with a single, cheap, deterministic assertion: the gallery must contain its own binding for all three font-chain vars.

### How to fix a failure

The gallery.html must include a `<style data-gate-exempt="true">` block (inside the `<head>`) that binds the three vars in a `:root {}` rule. This is gallery-local CSS — it does not modify `app/globals.css`. Values must mirror `globals.css` lines 84–86 exactly:

```html
<style data-gate-exempt="true">
:root{
  --font-display: var(--font-cormorant), 'Cormorant Garamond', serif;
  --font-mono:    var(--font-jetbrains), 'JetBrains Mono', ui-monospace, monospace;
  --font-type:    var(--font-elite),     'Special Elite', ui-monospace, monospace;
}
</style>
```

The `data-gate-exempt="true"` attribute exempts this block from the TS drift audit (it is gallery infrastructure, not an atom appearance value). The font-chain check runs before the TS audit and is independent of it.

### Wiring

`audit-font-chain.sh` is invoked by `audit-soul-atom-drift.sh` at step C1b (after token_ref checks, before the TypeScript deep-audit). It runs as a sub-process. Exit 1 from `audit-font-chain.sh` causes `audit-soul-atom-drift.sh` to exit 1 immediately (fail closed).

Run standalone:

```bash
bash scripts/audit-font-chain.sh --verbose
```

### Demonstrating FAIL and PASS

FAIL (missing bindings — the bug this rail closes):

```bash
# Strip font-chain bindings from gallery, run check
GALLERY_PATH=/tmp/gallery-no-fonts.html bash scripts/audit-font-chain.sh
# → exit 1, errors naming each missing token
```

PASS (current gallery with Option B bridge present):

```bash
bash scripts/audit-font-chain.sh
# → exit 0: "PASS — font-chain bindings present: --font-display, --font-mono, --font-type"
```

---

## Render-fidelity gauntlet (standing protocol — soul-atlas changes)

**Owner:** Canopus (rail definition), Algol (execution of Step 3), Betelgeuse (Step 4 trigger)
**Introduced:** 2026-05-29 · TASK-2026-05-29-SOUL-FACTORY-FIDELITY · Canopus
**Root cause addressed:** Token-green gallery rendering wrong — font-chain failure + 3D→2D abstraction loss both invisible to the token-drift gate.

This is not a single script — it is a four-step process that MUST complete for any soul-atlas change before the task reaches `betelgeuse-approved`. Steps 1–2 are automated and blocking. Steps 3–4 require Algol + Playwright.

### Steps

**Step 1 · Token-drift gate** (`scripts/audit-soul-atom-drift.sh` — automated, blocking)

Verifies every appearance value in gallery atoms traces to a token_ref or cited main_branch_ref. Cannot be bypassed. Required before any other step.

**Step 2 · Font-chain presence check** (embedded in Step 1 at C1b — automated, blocking)

Verifies `--font-display`, `--font-mono`, `--font-type` are explicitly bound in gallery.html. The Times-fallback bug cannot occur if this check passes. Step 1 will not return exit 0 without Step 2 passing.

**Step 3 · Gallery render verification** (Algol · Playwright · REQUIRED for every soul-atlas task)

**Serving requirement:** The gallery MUST be served over HTTP from the repo root. Use
`npm run design` (port 8765) or `python3 -m http.server 8765` launched from the repo
root. **Do not open `gallery.html` via `file://`** — the Three.js full-globe (A12)
uses ES-module imports that browsers block over `file://` (CORS), so the globe panel
renders blank. Playwright's `page.goto()` must target
`http://localhost:8765/.claude/visual-diffs/soul-atlas/gallery.html`, not a `file://`
path. This constraint also applies when Peat manually reviews the gallery.

Algol must:

1. Serve the gallery: `npm run design` (or `python3 -m http.server 8765 &` from the repo root)
2. Open each `.stage` area for changed atoms in Playwright
3. Assert computed font vars are non-empty:
   ```js
   getComputedStyle(document.documentElement).getPropertyValue('--font-display') !== ''
   getComputedStyle(document.documentElement).getPropertyValue('--font-mono') !== ''
   getComputedStyle(document.documentElement).getPropertyValue('--font-type') !== ''
   ```
4. Screenshot each changed atom's `.stage` at 1440px viewport
5. Compare against `production_ref.screenshot` in `manifest.json` (if non-null)
6. File a fidelity report at `docs/qa/REPORTS/<task-id>-FIDELITY.md` (format: Algol's QA report template)

This step is REQUIRED. It cannot be delegated to token-gate passing. The render-fidelity gap (TASK-2026-05-29-SOUL-FACTORY-FIDELITY) was found because this step was not standing protocol — it was performed ad hoc, after the gallery was already considered complete.

**Step 4 · Production-ref screenshot update** (triggered by Betelgeuse or Sirius when production changes)

When a production component referenced by `manifest.json production_ref.component` changes, Algol re-runs the Playwright comparison. The `production_ref.screenshot` field is updated. Betelgeuse evaluates whether the gallery atom still represents the production intent. If not, a REVISE handoff is opened to Betelgeuse.

### Why this is a standing protocol, not a CI script

Step 3 requires a live dev server (for production comparison) and a served gallery. Running both in CI adds fragility (port conflicts, timing, 3D canvas GPU availability). The pragmatic solution is to require Algol to perform this step as part of every soul-atlas task — it is a named, required gauntlet step in the task checklist, not a background automation.

Future: if the fidelity check becomes expensive or error-prone to run manually, it can be promoted to a CI script. The manifest schema already provides the machine-readable inputs (`production_ref.component`, `production_ref.screenshot`) to make that upgrade straightforward.

### Regression test stub

`tests/harness/font-chain.test.mjs` — Algol writes.

Expected scenarios:
- (a) gallery with all three font-chain bindings → PASS (exit 0)
- (b) gallery with `--font-display` removed → FAIL (exit 1), error names the missing token
- (c) gallery with `--font-mono` removed → FAIL (exit 1)
- (d) gallery with `--font-type` removed → FAIL (exit 1)
- (e) gallery with all three removed → FAIL (exit 1), all three named in error output
- (f) manifest.json not found → SKIP (exit 2, no false positive)
- (g) gallery.html not found when manifest exists → FAIL (exit 3)
- (h) audit-soul-atom-drift.sh wiring: font-chain exit 1 propagates to drift exit 1

---

## Rail: atom-reuse pre-handoff check (Rule 5)

**Hook:** embedded in `.claude/hooks/pre-handoff.sh` (check 4e)
**Trigger:** `HANDOFF_TYPE=SPEC` env var AND recipient = Sirius
**Implemented:** 2026-05-29 · TASK-2026-05-29-SOUL-FACTORY-P2 · Canopus
**Rule basis:** Rule 5 — Compose from atoms, ship HTML companion (proposed by Betelgeuse TASK-2026-05-29-SOUL-FACTORY-P2C)

### What it checks

When a surface spec is handed from any agent to Sirius (via `HANDOFF_TYPE=SPEC`), this
gate verifies that the spec correctly composes from gallery atoms rather than re-deriving
visual primitives from prose.

The check runs only when `docs/design/*.md` appears in `files_touched` of the signature.
If no spec file is found, the check skips silently.

| Step | What it checks | Block code |
|------|---------------|------------|
| 1 | `## atoms used` table present in spec | `ATOM-TABLE-MISSING` |
| 2 | For each "from gallery=yes" row: atom id exists in manifest.json | `ATOM-ID-NOT-FOUND` |
| 3 | For each "new — manifest entry at `<id>`" row: id in manifest AND `data-atom-id="<id>"` in gallery.html | `NEW-ATOM-NOT-LANDED` |
| 4 | Inverse scan: raw visual primitive prose outside code fences | `RE-DERIVE-SUSPECTED` (warning, non-blocking) |

Exit 0 if no FAILs. Exit 13 on any FAIL. Warnings are logged but do not block.

### Log

`.claude/hook-logs/<task_id>--atom-check.log`

### How to fix failures

**ATOM-TABLE-MISSING:**
Add an `## atoms used` section to the surface spec with the required four-column table:
```
## atoms used
| atom id               | from gallery | role in this surface                       |
|-----------------------|--------------|--------------------------------------------|
| corner-reticle        | yes          | frame four corners of the instrument panel |
```

**ATOM-ID-NOT-FOUND:**
The cited atom id is not in `.claude/visual-diffs/soul-atlas/manifest.json`. Either
the id is misspelled, or the atom was not yet added to the gallery. If the atom should
exist, open a handoff to Betelgeuse requesting the gallery entry be created.

**NEW-ATOM-NOT-LANDED:**
The spec introduces a net-new visual primitive but the gallery entry does not exist yet.
Per Rule 5, the atom must exist in manifest.json + gallery.html BEFORE the spec ships
to Sirius. The spec handoff is premature — Betelgeuse must land the atom first.

**RE-DERIVE-SUSPECTED (warning only):**
A raw visual primitive description was found in the spec prose (e.g., "JetBrains Mono
at 9px" instead of citing the `type-roles` atom id). Update the prose to cite the atom
id. The gallery entry carries the full specification — the spec should not repeat it.

---

## Rail: html-first-spec-discipline

**Check:** `scripts/audit-visual-diff-directions.sh`
**Applies to:** `.claude/visual-diffs/<TASK-ID>/` whenever `directions/` exists
**Status:** enforcing (blocking for Rule 4; advisory for layout/STATUS hygiene)
**Introduced:** 2026-05-26 · TASK-2026-05-26-HTML-FIRST-02 · Canopus
**Spec:** `docs/team/WORKFLOW-HTML-FIRST-SPEC.md` (Rule 4, §5)

### Purpose

Enforce the HTML-first spec workflow's `directions/` discipline: every design direction must be grounded in an existing locked prototype (Rule 4 — unity by extension). Multi-direction exploration is mandatory at the start of a visual surface, but must never become a vector for incoherence. This rail ensures soul continuity across parallel design directions.

The asymmetric severity is by design — layout hygiene is ergonomics, soul-baseline absence is a soul violation.

### What it audits

| Check | Item | Severity | What it verifies |
|---|---|---|---|
| S2-item-1 | directory count and naming | ADVISORY | `directions/` contains 2–4 subdirectories named `direction-{1..N}` |
| S2-item-2 | file presence | ADVISORY | each `direction-N/` has `index.html` + `README.md` |
| S2-item-3 | Rule 4 fields | **BLOCKING** | each `direction-N/README.md` has all five required fields: `soul-baseline:` `connection-point:` `continuity:` `evolution:` `bet:` |
| S2-item-4 | soul-baseline resolution | **BLOCKING** | the path in `soul-baseline:` resolves to a real file; `none`/`blank-slate`/`n/a` are rejected |
| S2-item-5 | STATUS coherence | ADVISORY | if `prototype/` and `directions/` coexist, STATUS must not be `exploring` |
| S2-item-6 | locked prototype requirements | **BLOCKING** | if STATUS is `locked`/`revise-N`/`betelgeuse-approved`, `prototype/index.html` exists AND `prototype/README.md` carries forward `soul-baseline:` |
| S2-item-7 | DIRECTIONS.md structure | ADVISORY | `DIRECTIONS.md` exists at task root and contains `soul-baseline:` field + `unity check` heading |

Additionally, `pre-handoff.sh` (check 4d) issues advisory warnings when Betelgeuse hands off to Sirius:
- If `prototype/index.html` does not exist at the expected path.
- If any `docs/design/<surface>.md` listed in `files_touched` exceeds 220 lines (200-line cap + 20-line grace per `docs/team/WORKFLOW-HTML-FIRST-SPEC.md` §4).

### How to fix blocking failures

**S2-item-3 (missing Rule 4 fields):**
Open each `direction-N/README.md` and add the five required fields. A direction without `soul-baseline:` is not a direction — it is blank-slate generation, which Rule 4 forbids:

```yaml
soul-baseline: .claude/visual-diffs/UI-ITER-1-globe-v1/prototype/index.html
connection-point: from Globe pin click → side panel → article entry
continuity: preserves paper-canvas + corner reticles + NETRA L1 vocabulary
evolution: introduces paper-mount frame for photo display; net-new but token-compliant
bet: >
  Hypothesis: a photo displayed in a physical mount frame reads as "artifact" rather than
  "feed item", changing how Peat relates to the image.
```

**S2-item-4 (soul-baseline path does not resolve):**
1. Check the path written in `soul-baseline:`.
2. Ensure the referenced prototype file exists (it must be a previously locked prototype).
3. Use a path relative to the repo root (e.g., `.claude/visual-diffs/UI-ITER-1-globe-v1/prototype/index.html`).
4. Do not use `none`, `blank`, `blank-slate`, or `n/a` — Rule 4 forbids blank-slate generation without exception.

**S2-item-6 (prototype requirements when STATUS is locked/past):**
1. Ensure the chosen direction has been promoted: `cp -r directions/direction-N/* prototype/`
2. Add `soul-baseline:` to `prototype/README.md` (carrying forward the value from the chosen direction's README).
3. Update STATUS to the appropriate value (`locked`, `revise-N`, etc.).

### Rationale

Peat directive 2026-05-26 (quoted verbatim in blocking failure messages):

> "การ design ต้องทำจาก prototype เป็นรากฐาน ... keep ความเป็น unity ได้ ...
> เก็บตรงนี้ไว้ harness + เป็น policy ด้วย"

Blank-slate directions fragment Worldline's visual identity. Every new surface must extend the existing design system, not restart it. Without a valid `soul-baseline:`, there is no way to verify this — so the direction is rejected at intake.

### Pre-workflow artifact guard

Tasks created before this workflow (e.g., `UI-ITER-1-globe-v1`, `UI-ITER-2-*`) have no `directions/` directory. The audit exits 0 silently on any task without `directions/`. There are no false positives on legacy artifacts.

### Integration with visual-diff.sh

`visual-diff.sh` calls `scripts/audit-visual-diff-directions.sh` before writing `awaiting-betelgeuse` to STATUS. If the audit exits non-zero (blocking violation), `visual-diff.sh` also exits non-zero and does not write the STATUS file. The task remains in its current state until the violations are resolved.

### Integration with pre-handoff.sh

`pre-handoff.sh` check 4d runs advisory warnings for Betelgeuse → Sirius handoffs. These do not block the handoff but surface the spec reference so Sirius has the why.

### Regression test fixture

`tests/harness/fixtures/html-first-spec/` contains synthetic test directories:
- `valid-two-directions/` — two directions, both with valid Rule 4 fields and resolving soul-baselines → PASS
- `invalid-no-soul-baseline/` — one direction missing `soul-baseline:` field → BLOCK
- `invalid-blank-slate/` — one direction with `soul-baseline: none` → BLOCK
- `invalid-path-not-found/` — one direction with `soul-baseline:` pointing to nonexistent file → BLOCK

Run: `bash scripts/audit-visual-diff-directions.sh <test-fixture-task-id>`

---

---

## Rail: axiom-gate-join-coverage

**Check:** `scripts/audit-axiom-gate-join-coverage.sh` (shell wrapper) → `scripts/audit-axiom-gate-join-coverage.ts` (Algol)
**Applies to:** `.harness/**`, `scripts/audit-*.ts`, `scripts/audit-*.sh`
**Status:** enforcing
**Introduced:** 2026-05-30 · TASK-2026-05-30-HARNESS-IS-OUGHT-SEPARATOR-B3B · Canopus
**Registry:** `.harness/axioms-v1.json`
**Schema:** `.harness/axioms-v1.schema.json`

### Purpose

Enforces the axiom↔gate bijection in BOTH directions:

- **Direction 1 (axiom → gate):** every PROJECTED axiom must name ≥1 gate in `projects_to` that exists in harness config AND is enforcing (non-stub). UNPROJECTED/PARTIAL axioms past `must_project_by` = RED.
- **Direction 2 (gate → axiom):** every gate in harness config must trace to ≥1 axiom via `projects_to`, OR be in the `DERIVED_IS_GATES` list (engineering mechanics — not a product axiom). Orphan gates = RED.

This is the top-seam coverage primitive from the is/ought separator task: it makes the "articulated-but-unprojected ought" class mechanically visible — a signed axiom with no enforcing gate wears a signature but has no teeth. The join-coverage audit surfaces exactly that, on every harness run.

### Coverage assertion

Per A1.1 discipline applied at the top seam:
- All N axioms in the registry must be visited → `checked_axioms == N`
- All M gates in config must be visited → `checked_gates == M`
- If either count mismatches → exit 2 (coverage assertion fail — the audit itself is defective)

### Structured error codes

| Code | Meaning |
|------|---------|
| `UNPROJECTED_PAST_DATE` | Axiom is UNPROJECTED/PARTIAL and `must_project_by` is in the past, OR date is missing (permanent amber = fail-closed) |
| `GATE_MISSING` | PROJECTED axiom has empty `projects_to`, or all named gates are absent/stub |
| `GATE_ORPHAN` | Gate has no axiom trace and is not in DERIVED_IS list |
| `COVERAGE_ASSERT_FAIL` | Audit visited fewer axioms or gates than declared (audit defect) |

### How to fix a fail

**UNPROJECTED_PAST_DATE:** The axiom's deadline has passed. Its owner must wire an enforcing gate that actually checks the invariant, then update the axiom status to PROJECTED or PARTIAL as appropriate. A stub gate does not count.

**GATE_MISSING:** A PROJECTED axiom has no enforcing gate in the harness config matching its `projects_to`. Either (a) add the missing rail to worldline-harness.config.json as enforcing, or (b) downgrade the axiom status to UNPROJECTED with a new `must_project_by` date if the gate doesn't exist yet.

**GATE_ORPHAN:** A gate is running checks with no normative grounding. Either (a) add an axiom that projects to this gate, or (b) add the gate to `DERIVED_IS_GATES` in the TS script with a documented rationale (engineering mechanics, not product value).

### Run standalone

```bash
bash scripts/audit-axiom-gate-join-coverage.sh [TODAY_ISO]
# Example (simulate post-2026-05-31 deadline):
bash scripts/audit-axiom-gate-join-coverage.sh 2026-06-01
```

---

## Rail: gauntlet-overlap-composition

**Check:** `scripts/audit-gauntlet-overlap.sh` → `scripts/audit-gauntlet-overlap.ts`
**Applies to:** `app/**`, `components/**`, `.claude/visual-diffs/**/prototype/**`
**Status:** enforcing
**Introduced:** 2026-05-30 · TASK-2026-05-30-HARNESS-IS-OUGHT-SEPARATOR-B3B · Canopus
**Error code:** A3a
**Allowed overlaps manifest:** `.harness/allowed-overlaps.json`
**Spec:** `docs/qa/gauntlet-strengthening-design.md#check-a`

### Purpose

Assert no element renders over a higher-z sibling unless the pair is listed in `.harness/allowed-overlaps.json` with a documented reason. Converts the visual-composition from human-eye-only to a mechanized denominator.

Real-world specimen that prompted this rail: Sirius's MINI-OVERLAP case — the 2D fallback `::before`/`::after` pseudo-elements on `.standby-render__globe` rendered over the live canvas because they were not gated by `data-mini-live`. This check would have caught it mechanically.

### Predicate

```
for each element E with non-auto z-index:
  for each sibling S with lower z-index:
    if bounding-rect(E) intersects bounding-rect(S):
      unless (E.selector, S.selector) in allowed-overlaps.json with reason:
        FAIL
```

### Denominator

All rendered elements with a non-`auto` computed z-index in the rendered page. Coverage assertion: `elements_checked == N` (where N is the count enumerated from the DOM).

### Allowed overlaps manifest

`.harness/allowed-overlaps.json` is the canonical waiver list. Starts empty — Sirius populates for MINI-OVERLAP entries on first wiring. Additions require a signed commit.

Format:
```json
{
  "allowed_overlaps": [
    {
      "element_selector": ".standby-render__globe::before",
      "sibling_selector": "canvas.mini-globe",
      "reason": "2D fallback pseudo-element; gated by data-mini-live absent — renders only when WebGL unavailable",
      "introduced": "TASK-XXXX"
    }
  ]
}
```

### Structured error format

```
[A3a] element=<CSS-selector> overlaps sibling=<CSS-selector>
      element_rect=(x, y, w, h) sibling_rect=(x, y, w, h)
      computed_z=<z> sibling_z=<z>
      status=UNLISTED (not in .harness/allowed-overlaps.json)
      action=add to allowed-overlaps with reason, OR fix z-context
```

### How to fix a fail

1. The error names the element pair and their computed bounding rects.
2. If the overlap is intentional (e.g., a UI layer intentionally over a background): add the pair to `.harness/allowed-overlaps.json` with a reason.
3. If the overlap is unintentional: fix the z-index values or stacking context so the elements do not intersect.

### Implementation note

Requires a running HTTP server (not `file://`). Pass the served URL as the first argument to the wrapper script. Playwright unavailability → exit 3 (WARN, does not block handoff alone).

---

## Rail: gauntlet-min-legible-size

**Check:** `scripts/audit-gauntlet-min-legible.sh` → `scripts/audit-gauntlet-min-legible.ts`
**Applies to:** `app/**`, `components/**`, `.claude/visual-diffs/**/prototype/**`
**Status:** enforcing
**Introduced:** 2026-05-30 · TASK-2026-05-30-HARNESS-IS-OUGHT-SEPARATOR-B3B · Canopus
**Error code:** A3b
**Spec:** `docs/qa/gauntlet-strengthening-design.md#check-b`

### Purpose

Assert all text and icon elements render at dimensions ≥ legibility floor at 4 breakpoints per `docs/design/60-responsive-system.md`. Converts the legibility check from "declared CSS value" to "computed render size at real viewport dimensions."

This cross-references the property technique-map TM-04 derivation (V1 + 60-responsive-system.md → 12px floor), but verifies the rendered size, not the CSS declaration.

### Legibility floors (from 60-responsive-system.md)

| viewport | width | min font (text) | min dimension (icon) |
|---|---|---|---|
| WIDE | ≥1180px | 12px | 16×16px |
| DESK | 881–1179px | 12px | 16×16px |
| MID | 601–880px | 12px | 14×14px |
| NARROW | ≤600px | 11px | 12×12px |

### Denominator

All text-bearing + icon-only elements in the rendered page at each of 4 breakpoints (tested at: 1200px, 1000px, 720px, 375px). Coverage: 4 viewport-level assertions required; any mismatch = audit RED.

### Structured error format

```
[A3b] element=<CSS-selector> viewport=<WIDE|DESK|MID|NARROW> at <width>px
      property=font-size computed=<Npx> floor=<Fpx>
      OR
      property=bounding-rect computed=<W>x<H>px floor=<Fw>x<Fh>px
      action=increase font-size or element dimensions above floor
```

### How to fix a fail

1. The error names the element, viewport, computed size, and floor.
2. For font-size: increase the font-size CSS for that element at that breakpoint.
3. For icon dimensions: increase `min-width`/`min-height` for the icon at that breakpoint.
4. If the element is intentionally tiny (e.g., a decorative spacer), add `aria-hidden="true"` and ensure it is excluded from the text/icon selector set.

---

## Rail: gauntlet-sub-pixel-detection

**Check:** `scripts/audit-gauntlet-sub-pixel.sh` → `scripts/audit-gauntlet-sub-pixel.ts`
**Applies to:** `.claude/visual-diffs/soul-atlas/**`
**Status:** enforcing
**Introduced:** 2026-05-30 · TASK-2026-05-30-HARNESS-IS-OUGHT-SEPARATOR-B3B · Canopus
**Error code:** A3c
**Spec:** `docs/qa/gauntlet-strengthening-design.md#check-c`
**Manifest:** `.claude/visual-diffs/soul-atlas/manifest.json`

### Purpose

Assert all manifest atom × variant pairs render bounding rect ≥ 1×1px. Sub-pixel or zero-size elements are FAIL when manifest claims the atom is visible.

Real-world specimen that prompted this rail: in the GLOBE-NODES slice, 6 archive nodes were sub-pixel (computed radius ~0.2px at canvas coordinate scale) — Peat's eye caught them as invisible despite the node objects existing in the scene.

### Denominator

`|manifest.atoms| × |variants_per_atom|` — the Cartesian product of all atom × variant pairs. Coverage: `pairs_checked == total`. If count mismatches → audit itself is RED (exit 2).

### Structured error format

```
[A3c] atom=<atom_id> variant=<variant_name> selector=<render_selector>
      viewport=default computed_rect=<W>x<H>px
      status=SUB_PIXEL (W<1 or H<1) | ZERO (W==0 or H==0)
      manifest_claim=visible
      action=fix rendering to produce >=1x1px bounding rect, or mark variant as intentionally-hidden in manifest
```

### How to fix a fail

1. The error names the atom, variant, selector, and computed dimensions.
2. If the element should be visible: fix the CSS/rendering so the selector matches a ≥1×1px element.
3. If the variant is intentionally hidden at this viewport: add a `render_trigger` field to the variant in manifest.json, or mark it as `"intentionally_hidden": true` (a future manifest schema addition).

### Behavior when manifest absent

Exits 0 silently when `.claude/visual-diffs/soul-atlas/manifest.json` does not exist (pre-Phase-1). No false positives on tasks that have not yet started soul-atlas work.

### Mutation test

`tests/harness/gauntlet-strengthening.test.sh` — Canopus. Case A3c shrinks the atom's render element to 0.3px via a fixture override. Expected: before.exit=0, after.exit=1, error names `A3c` + atom-id + sub-pixel status.

---

## Rail: permissions-nonempty

**Check:** `scripts/audit-permissions-nonempty.sh`
**Applies to:** `.claude/settings.json`
**Barrier class:** HARD-BARRIER
**Mode:** block
**Introduced:** TASK-2026-06-01-SECURITY-HARNESS-WAVE-0-1
**Control:** P3 Least-privilege (deny-by-default posture)

**Purpose:** The P3 least-privilege gap: without a non-empty `permissions.deny` block in `settings.json`, every tool is implicitly allowed to any agent. This rail asserts that at minimum one deny entry exists, establishing a deny-default posture.

**What it checks:**
1. `.claude/settings.json` exists and is valid JSON
2. `.permissions` key is present and non-null
3. `.permissions.deny` is present, is an array, and has >= 1 entry

**How to fix a fail:**
Add a `permissions.deny` array to `.claude/settings.json` with at least one deny entry:
```json
{
  "permissions": {
    "deny": ["Bash(curl *)", "Bash(wget *)"],
    "allow": [...]
  }
}
```
See the current deny list at `.claude/settings.json` for the full Worldline posture.

---

## Rail: least-agency-config

**Check:** `scripts/audit-least-agency-config.sh`
**Applies to:** `.claude/settings.json`, `.claude/hooks/**`
**Barrier class:** HARD-BARRIER
**Mode:** block
**Introduced:** TASK-2026-06-01-SECURITY-HARNESS-WAVE-0-1
**Control:** Least-agency / tool-misuse (OWASP ZT §Least Agency)

**Purpose:** Asserts the full least-agency stack is wired and hasn't regressed. Two hard assertions:

1. **deny-present:** `permissions.deny` in `settings.json` contains entries for both `curl` and `wget` (net-egress block)
2. **hook-wired:** A blocking PreToolUse Bash hook referencing `mutating-action-hook.sh` is present in `settings.json`

**How to fix a fail:**
- For deny-present: ensure `permissions.deny` in `.claude/settings.json` has both `Bash(curl *)` and `Bash(wget *)` entries
- For hook-wired: ensure the PreToolUse hooks in `settings.json` include a `matcher: "Bash"` hook that calls `bash .claude/hooks/mutating-action-hook.sh`

---

## Rail: rail-barrier-class (meta-rail / spine)

**Check:** `scripts/audit-rail-barrier-class.sh`
**Applies to:** `.harness/worldline-harness.config.json`
**Barrier class:** HARD-BARRIER (self-enforcing meta-rail)
**Mode:** block
**Introduced:** TASK-2026-06-01-SECURITY-HARNESS-WAVE-0-1
**Control:** Impossible-not-tedious (spine sensor — SECURITY-HARNESS-DESIGN-2026-06-01 §3)

**Purpose:** The spine sensor. Enforces the "impossible-not-tedious" principle by preventing a `FRICTION-ONLY` control from masquerading as a `mode=block` hard barrier. Every rail in the registry must carry a `barrier_class` field, and every `mode=block` rail must be `HARD-BARRIER` or carry a signed friction-waiver.

**Three rules it enforces:**

- **Rule C:** Every rail must have `barrier_class` in `{HARD-BARRIER, FRICTION-ONLY}`. Absent = FAIL.
- **Rule A:** Every `mode=block` rail must have `barrier_class=HARD-BARRIER`, OR appear in `.harness/scope-waivers.json` with `signed_by` non-null.
- **Rule B:** No LLM-judge rail may have `mode=block` unless `thresholded=true` and a numeric `threshold` is set (Constitutional-Classifiers exception).

**How to fix a fail:**
- **Rule C:** Add `barrier_class` field to the rail in `.harness/worldline-harness.config.json`
- **Rule A:** Either set `barrier_class: HARD-BARRIER` (preferred), or add a signed waiver entry to `.harness/scope-waivers.json` (requires Peat's `signed_by`)
- **Rule B:** Change the judge rail's mode to `shadow` or `warn`, or add `thresholded: true` + a threshold value

**Exemptions:**
- `status=stub` rails may have `FRICTION-ONLY + mode=warn` without a waiver (stub = not yet enforcing)

---

## Rail: audit-ground-truth-observed

**Check:** `scripts/audit-ground-truth-observed.sh`
**Applies to:** `.claude/visual-diffs/**/observed/**`
**Barrier class:** HARD-BARRIER
**Mode:** block
**Introduced:** TASK-2026-06-01-SECURITY-HARNESS-WAVE-0-SENSOR
**Control:** Ground-truth observability (proxy-as-anchor elimination)

### Problem this rail seals

"build green + HTTP 200" was accepted as DONE. Nobody actually opened `/archive` to verify
the page rendered correctly — a proxy signal was mistaken for an anchor. This gate refuses
DONE unless a cryptographically-linked screenshot exists and has been explicitly acknowledged.

### What it checks

For each route listed in `.claude/visual-diffs/<task_id>/task-manifest.json#shipped_routes`:

| Check | What it asserts |
|-------|----------------|
| A | PNG exists at `.claude/visual-diffs/<task_id>/observed/<route>.png` |
| B | `observed.json` exists and is valid JSON |
| C | `observed.json` has an entry for this route with `ack: true` |
| D | `sha256` in `observed.json` matches the actual sha256 of the PNG on disk |
| E | (when task window present) PNG mtime AND `observed_at` timestamp both fall within `started_at`–`completed_at` |

### Exit codes

| code | meaning |
|------|---------|
| 0 | PASS — all shipped routes have verified, non-stale observed artifacts |
| 1 | FAIL — missing artifact, sha256 mismatch, or stale timestamp |
| 2 | FAIL — task manifest not found or not valid JSON |
| 3 | FAIL — task manifest has no `shipped_routes` (gate cannot confirm done) |
| 4 | FAIL — `observed.json` not found or not valid JSON |
| 5 | FAIL — script invocation error (usage) |

### Usage

```bash
bash scripts/audit-ground-truth-observed.sh <task_id>
bash scripts/audit-ground-truth-observed.sh <task_id> --verbose
WL_TASK_MANIFEST=/path/to/manifest.json bash scripts/audit-ground-truth-observed.sh <task_id>
```

### task-manifest.json schema (minimal)

```json
{
  "task_id": "TASK-2026-06-01-MY-TASK",
  "shipped_routes": ["/archive", "/photos"],
  "started_at": "2026-06-01T10:00:00Z",
  "completed_at": "2026-06-01T11:00:00Z"
}
```

### observed.json schema

```json
{
  "routes": [
    {
      "route": "/archive",
      "sha256": "<sha256 of archive.png>",
      "viewport": { "width": 1280, "height": 800 },
      "ack": true,
      "observed_at": "2026-06-01T10:30:00Z"
    }
  ]
}
```

### How to fix a fail

- **Exit 2 (no manifest):** Create `.claude/visual-diffs/<task_id>/task-manifest.json` with `task_id` and `shipped_routes`.
- **Exit 3 (empty routes):** Add at least one route to `shipped_routes`. If the task ships no routes, this gate does not apply — remove the task manifest or add a skip marker.
- **Exit 4 (no observed.json):** Run a screenshot capture (Playwright or Peat manual) and produce `observed.json` with `ack: true`.
- **Exit 1 (sha256 mismatch):** The PNG was replaced after the hash was recorded. Recapture the screenshot and update `observed.json`.
- **Exit 1 (stale timestamp):** The screenshot predates task start or was taken after task end. Recapture during task execution.

### CARDINAL RULE

This script must NEVER exit 0 silently when a violation exists. The exit-0-always bug is the failure mode this harness exists to kill. Every code path that reaches exit 0 must have passed all assertions positively.

---

## Rail: audit-search-index-completeness

**Check:** `scripts/audit-search-index-completeness.sh`
**Applies to:** `.next/server/app/**`, `public/pagefind/**`
**Barrier class:** HARD-BARRIER
**Mode:** block
**Introduced:** TASK-2026-06-01-SECURITY-HARNESS-WAVE-0-SENSOR
**Control:** Search index completeness (partial-index silent failure elimination)
**Live-wiring gap:** Requires a completed `npm run build` (velite + next build + pagefind indexing).

### Problem this rail seals

pagefind indexed 2 of 13 pages because `data-pagefind-body` elements were present only
inside Next.js RSC streaming payloads (`<script>` tags) — not as real HTML attributes in
static output. Additionally, those RSC payload elements had `style="display:none"` which
would also cause pagefind to skip them. No gate asserted the index covered the site.

### What it checks (two assertions)

**Assertion 1 — COUNT PARITY:**
Enumerate crawlable HTML pages in `.next/server/app` (excluding Next.js internal error pages).
Read `page_count` from `public/pagefind/pagefind-entry.json`. Assert they are equal.

**Assertion 2 — HIDDEN OR RSC-ONLY PAGEFIND BODY:**
For every HTML file in the site dir, detect `data-pagefind-body` elements that are
inaccessible to pagefind's static crawler:

| Case | What it catches |
|------|----------------|
| case-A-hidden-css | Real HTML element with `data-pagefind-body` but `display:none`, `visibility:hidden`, `width:0`, or `height:0` inline style |
| case-B-rsc-only | `data-pagefind-body` appears only as a JSON property inside a `<script>` RSC payload (not a real HTML attribute) |

### Exit codes

| code | meaning |
|------|---------|
| 0 | PASS — count parity and no inaccessible pagefind-body |
| 1 | FAIL — page_count != crawlable_count |
| 2 | FAIL — data-pagefind-body is hidden or RSC-payload-only (root-cause; takes priority over exit 1) |
| 3 | SKIP — build output absent (SITE_DIR or pagefind-entry.json missing); never false-passes |
| 4 | FAIL — pagefind-entry.json not valid JSON or missing page_count |

### Usage

```bash
bash scripts/audit-search-index-completeness.sh
bash scripts/audit-search-index-completeness.sh --verbose
```

### Live-wiring (CI integration)

```bash
# In package.json or CI script, after build:
npm run build && bash scripts/audit-search-index-completeness.sh
# Or inline after pagefind indexing:
npx pagefind --site .next/server/app --output-path public/pagefind && \
  bash scripts/audit-search-index-completeness.sh
```

### Environment overrides (for tests)

| var | description |
|-----|-------------|
| `WL_SITE_DIR` | Override site directory (default: `.next/server/app`) |
| `WL_PAGEFIND_ENTRY` | Override path to `pagefind-entry.json` |
| `WL_CRAWLABLE_COUNT` | Inject crawlable count directly (skips filesystem enumeration) |
| `WL_HTML_FILES` | Newline-separated list of HTML paths for assertion 2 |

### How to fix a fail

- **Exit 3 (build absent):** Run `npm run build` first. The gate requires a real build output.
- **Exit 1 (count mismatch):** Ensure every page is rendered as static HTML in the Next.js output. Diagnose with `--verbose` to see which files were counted. Common root cause: pages rendered only via RSC streaming.
- **Exit 2 case-A (hidden element):** Remove `display:none` or `visibility:hidden` from the element carrying `data-pagefind-body`. If the element must be visually hidden, use a visually-hidden CSS class instead of inline style.
- **Exit 2 case-B (RSC-only):** Move `data-pagefind-body` to a server-rendered static HTML element, not a client-hydrated RSC payload. Use a server component that renders the attribute as static HTML.

---

*end of RAIL-DEFINITIONS.md*
