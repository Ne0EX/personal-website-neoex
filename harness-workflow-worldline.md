# Worldline harness workflow

> Drop-in `.harness/` adapted from the Billion Farm ERP harness for the
> Worldline Next.js 16 personal-site repo.
> Generated: 2026.05.10

## What this is

A self-contained `.harness/` folder you can copy into the root of the
`worldline` repo. It wraps the same Red Pincer architecture you ran for the
Billion Farm ERP — anchors, deterministic sensors, LLM judges, chained
attestations, multi-agent dispatch — but the rails are rebuilt for
Worldline's actual drift surface (PRD scope creep, Three.js globe, design
tokens, Next 16 patterns).

## Architecture at a glance

```
.harness/
├── README.md                  ← operator manual (worldline-flavored)
├── harness.config.json        ← sensor modes, judge modes, allowlists
├── package.json               ← vitest + tsx + types
├── package-lock.json
├── vitest.config.ts
│
├── anchors/                   ← single source of truth for "what this is"
│   └── curated/
│       ├── intent.md          ← project intent, audiences, phase ship gate
│       ├── design-rails.md    ← paper palette, NETRA voice, globe rules
│       ├── tech-rails.md      ← Next 16, velite, server vs client, env
│       ├── progression.md     ← current phase, settled / fluid / parked
│       └── workflow.md        ← Red Pincer cycle, multi-agent dispatch
│
├── core/
│   ├── cli.ts                 ← entrypoint; dispatches sensors + judges
│   ├── types.ts               ← NormalizedEvent, SituationReport, etc.
│   ├── install.js             ← idempotent installer
│   ├── globals.d.ts           ← ambient types
│   ├── tsconfig.json
│   │
│   ├── runtime/               ← config tables consumed by sensors
│   │   ├── phase-scope.json           ← *NEW* — phase A-E definitions
│   │   ├── globe-discipline.json      ← *NEW* — globe file restrictions
│   │   ├── netra-voice-shallow.json   ← *NEW* — NETRA voice patterns
│   │   ├── mutating-bash.json         ← bash denylist (carries over)
│   │   ├── mutating-mcp.json          ← MCP allowlist (carries over)
│   │   ├── normalize.ts               ← event normalization (carries over)
│   │   ├── dispatch.ts                ← sensor dispatch (carries over)
│   │   ├── render.ts                  ← situation-report rendering
│   │   └── situation-report.ts        ← SR builder
│   │
│   ├── sensors/               ← deterministic checks (no LLM calls)
│   │   ├── _common.ts
│   │   ├── task-discipline.ts         ← Red Pincer phase gate (verbatim)
│   │   ├── phase-scope.ts             ← *NEW* — PRD phase ordering
│   │   ├── globe-discipline.ts        ← *NEW* — Three.js restrictions
│   │   ├── netra-voice-shallow.ts     ← *NEW* — voice register check
│   │   ├── tokens.ts                  ← token discipline (path tweak)
│   │   ├── next16.ts                  ← Next 16 deprecations (verbatim)
│   │   ├── secrets.ts                 ← key/token scan (patterns adjusted)
│   │   ├── placement.ts               ← file placement (paths adjusted)
│   │   ├── test-presence.ts           ← test colocation (paths adjusted)
│   │   ├── typecheck.ts               ← TS error scan (paths adjusted)
│   │   ├── lint.ts                    ← ESLint scan (paths adjusted)
│   │   └── mutating-action.ts         ← bash/MCP allowlist (verbatim)
│   │
│   ├── judges/                ← predictive checks (LLM-based)
│   │   ├── llm-client.ts              ← model fallback chain
│   │   ├── task-substance.ts          ← Haiku boilerplate detector
│   │   ├── watchdog.ts                ← Sonnet/Haiku per-stop scan (prompt rewritten)
│   │   └── heavy.ts                   ← Opus pre-commit scan (prompt rewritten)
│   │
│   ├── audit/                 ← attestation + ledger machinery (verbatim)
│   ├── anchor/                ← anchor extractors (carries over minus rls)
│   ├── lib/                   ← hash, fs, exec, diff helpers
│   ├── lsp/                   ← LSP host + clients
│   └── cli/                   ← task lifecycle subcommands (verbatim)
│
├── adapters/
│   ├── README.md              ← adapter contract
│   ├── claude-code/           ← session-start, pre/post tool, stop hooks
│   ├── git/                   ← pre-commit + prepare-commit-msg (paths adjusted)
│   ├── codex/                 ← stub (Phase 2)
│   └── copilot-cli/           ← stub (Phase 2)
│
├── audit/                     ← committed ledgers (start empty)
│   ├── index.ndjson
│   ├── overrides.ndjson
│   ├── anchor-versions.ndjson
│   ├── promotions.ndjson
│   ├── phase-transitions.ndjson  ← *NEW* — phase advancement records
│   ├── attestations/
│   └── digests/
│
├── state/                     ← runtime state (gitignored)
└── __smoke__/, __tests__/     ← carries over verbatim
```

## Drift surfaces → sensors mapping

You picked four drift surfaces. Each maps to specific machinery:

### 1. PRD scope creep → `phase-scope` sensor (block)

The most important new sensor for Worldline. Lives at
`core/sensors/phase-scope.ts` + config at `core/runtime/phase-scope.json`.

**What it does:**
- Reads `current_phase` from `phase-scope.json` (single source of truth).
- For every edit / write event, checks the file path against:
  - `always_blocked_paths` (Tier 5/6 paths — blocked throughout phase 1)
  - `common_paths_always_allowed` (configs, layouts, baseline components)
  - Allowed paths for current phase + earlier phases
- Also extracts package imports from new content and checks them against:
  - `always_blocked_packages` (`tone`, `@react-three/fiber`, `@react-three/drei`)
  - Phase-gated `allowed_packages_added` per phase
- If the path / package belongs to a later phase, blocks with a pointer to
  the right PRD's acceptance criteria.

**What it doesn't do:**
- It doesn't infer phase from PRD progress automatically. **You manually
  advance** by editing `current_phase` in `phase-scope.json` and
  `Current phase` in `progression.md`. Pre-commit verifies they agree —
  divergence blocks.

**Why this design:** The whole point of the harness is to make phase
advancement a deliberate act with an audit trail (`audit/phase-transitions.ndjson`),
not something that happens by accident.

### 2. Three.js globe drift → `globe-discipline` sensor (block)

**What it does:**
- Restricts `three`, `simplex-noise`, `@react-three/fiber`, `@react-three/drei`
  imports to `components/WorldlineGlobe.tsx`, `components/AtlasInstrument.tsx`,
  `lib/cartography.ts`. Any other file importing these is blocked.
- When a globe file IS edited, checks the active task's contract for a
  `globe` interface kind. If the contract doesn't declare it, flags the
  edit as out-of-contract.
- Detects re-declaration of settled constants (`STAGE_RADIUS`, `DOMAIN_ANGLE`,
  `OBSERVER_NODES`, `ATTRACTOR_FIELDS`) — flags any const assignment.

**Why this design:** the globe is the most aesthetically load-bearing part
of the codebase and the easiest to drift on. By forcing globe-touching tasks
to declare `globe:<surface>` in the contract, the watchdog judge gets a
concrete description to compare the diff against.

### 3. Design tokens / palette → `design-token-audit` sensor (block, carries over)

The Billion Farm sensor is reused with one small change:
`TOKEN_FILE` is now `app/globals.css` (was `design-system/colors_and_type.css`).

It scans every `.tsx` and `.css` outside `app/globals.css` for raw hex / rgb /
hsl literals. Flags them. Also covers a subtle Worldline-specific concern: the
PRD-03 film-simulation palette switcher needs CSS-var redefinition under
`[data-palette="..."]` blocks, which lives only in `app/globals.css` — so the
sensor's exemption naturally aligns with the right authoring surface.

### 4. Next 16 API patterns → `next16-deprecations` sensor (block, carries over)

The Billion Farm sensor catches the same patterns that bite Worldline:
- `cookies()` / `headers()` not awaited (Next 16 promise return).
- `params.x` destructured without await.
- `images.domains` (replaced by `remotePatterns` in 16).

Patterns live in `core/anchor/extract-next16.ts`. Add new ones there as Next 16
docs reveal more. The `tech-rails.md` rule "read `node_modules/next/dist/docs/`
before touching Next APIs" backstops this — the sensor catches what the docs
catch.

## Sensors removed from Billion Farm

- `rls-coverage` → no Supabase in Worldline.
- `migration-ordering` → no SQL migrations.
- `extract-rls.ts` extractor also removed.

## Sensors carried over verbatim

- `task-discipline` — Red Pincer phase ordering on the task cycle.
- `mutating-action-allowlist` — bash denylist + MCP gating.
- `lint-changed`, `typecheck-changed` — paths adjusted to repo root.
- `test-presence` — paths adjusted to `(components|lib)/`.
- `secrets-scan` — patterns adjusted (no LINE; added Anthropic key + GitHub token + ANTHROPIC_API_KEY-in-client detector).
- `file-placement` — paths adjusted (`app|components|lib|scripts|content|types`, no `web/` prefix).

## NETRA voice — split between sensor and judge

NETRA voice is hard to pin with a single check. Split into two layers:

### Shallow (deterministic, warn) — `netra-voice-shallow`

Catches the easy cases via regex on string literals in NETRA voice zones:
- `I am` / `I'm` (NETRA never uses first-person "I").
- `As an AI` / `as a language model` / `as an assistant` (frame breaks).
- `great question` / `happy to help` / `thanks for asking` (second-person flatter).
- Exclamation marks (NETRA tone is flat).
- Chatty greetings (`Hello there`, `Welcome`, `Greetings`).
- Wrong "don't know" (canonical is `no trace surveyed`).

Voice zones are determined by:
1. Files under `components/atlas-netra-voice/`, `components/NetraChat/`,
   `components/AtlasStratumChat/`, `lib/netra/system-prompt.ts`,
   `components/MarginaliaHud.tsx` — always in scope.
2. Any file with `// netra-voice-zone` comment near the top.

Mode: **warn**, not block. False positives on non-NETRA strings in a NETRA file
are real and shouldn't block commits.

### Deep (predictive, warn) — `watchdog` judge

The watchdog judge prompt is rewritten to call out NETRA voice as one of four
focal areas. It reads the diff after every agent stop and judges the register
of any new strings against `design-rails.md`. Mode: **warn** — judge errors and
debatable register calls shouldn't block.

## Multi-agent dispatch protocol

Per workflow anchor, the Worldline harness expects:

| Layer | Model | When |
|---|---|---|
| Architect / consult (parent) | Opus 4.7 → 4.6 fallback | Always. Reads PRDs, fills plan/discovery/contract. |
| Executor (subagent) | Haiku 4.5 (default) | Implement + Quality + Deploy + Monitor. |
| Executor (subagent) | Sonnet 4.6 (escalation) | Haiku quality fail / ambiguity / >3 files non-trivial. |
| Executor (subagent) | Opus (rare) | Documented reason in dispatch prompt. |

Architect dispatches via:

```bash
npx tsx .harness/core/cli.ts task subagent-prompt \
  --title "Add Sidenote MDX component" \
  --dispatcher-type haiku-exec
```

The CLI emits a sealed dispatch prompt containing:
- Task ID (chained to architect's task).
- The contract (already filled by architect).
- Anchor hash.
- Allowed-files surface.
- Acceptance gate.
- Escalation triggers.

The architect prepends this to its `Agent` tool call. The executor's first
action is `harness:task start <task-id>` — the harness blocks any earlier
mutation. The executor's last action is `harness:task complete`. Orphans
surface at architect's next pre-commit.

## Phase ship-gate cadence (Worldline)

The phase advancement protocol — explicit and audited:

```
Phase A in flight (current_phase = "A")
  ↓
PRD-01 acceptance criteria all checked
  ↓
Edit progression.md "Current phase" line: A → B
Edit phase-scope.json "current_phase": "A" → "B"
Append entry to audit/phase-transitions.ndjson
  ↓
npm run harness:verify   # confirms phase-scope honors B
  ↓
Phase B opens (zustand + audience-fork files now allowed)
```

Pre-commit verifies progression.md and phase-scope.json agree. Diverging is a block.

## Installation in worldline repo

```bash
# 1. Copy the .harness/ folder into the worldline repo root.
cp -r path/to/this/.harness /path/to/worldline/

# 2. Add npm scripts to worldline's package.json (if not present):
#    "harness:install": "node .harness/core/install.js",
#    "harness:look": "node .harness/core/install.js && cat .harness/state/last-situation/situation.json 2>/dev/null || echo 'no situation report yet'",
#    "harness:verify": "tsx .harness/core/cli.ts pre-commit --no-block",
#    "harness:anchors:refresh": "tsx .harness/core/cli.ts anchors refresh",
#    "harness:overrides": "tsx .harness/core/cli.ts overrides --days 30",
#    "harness:digest": "tsx .harness/core/cli.ts digest",
#    "harness:smoke": "tsx .harness/__smoke__/red-pincer/run.ts"

# 3. Install harness's own dev deps (vitest + tsx + types):
cd .harness && npm install && cd ..

# 4. Install root (so tsx is reachable):
npm install --save-dev tsx

# 5. Run the installer (symlinks pre-commit, registers CC hooks):
npm run harness:install

# 6. Run a verify to confirm the pipeline runs clean against current HEAD:
npm run harness:verify

# 7. Bootstrap the first task to test the cycle:
npx tsx .harness/core/cli.ts task genesis
```

After install, every Edit/Write/MultiEdit/mutating-Bash will run through the
sensor pipeline. If `red_pincer.enabled: true` (the default), no mutation
will succeed until a task's contract phase is filled.

## What's deliberately NOT included

- **`audit/2026-05-02/`** — the Billion Farm session history. Wiped clean for
  a fresh ledger.
- **`anchors/extracted/`** — gitignored anyway; regenerated at install.
- **`node_modules/`** — run `npm install` inside `.harness/` after copying.
- **A pre-extracted `next16-deprecations.json`** — the default patterns in
  `core/anchor/extract-next16.ts` are sufficient at start. Refresh as you find
  more in the Next 16 docs.

## Things to verify before relying on the harness

Before treating any sensor as production-correct on Worldline, smoke-test:

1. `phase-scope` blocks `app/api/chat/route.ts` while `current_phase = "A"`.
2. `globe-discipline` blocks a `three` import in a freshly-created
   `components/SomeNewThing.tsx`.
3. `netra-voice-shallow` flags a string `"Hello! I'm NETRA."` in
   `components/atlas-netra-voice/test.tsx`.
4. `design-token-audit` blocks `color: '#ff0000'` introduced in
   `components/HeroBlock.tsx`.
5. `next16-deprecations` blocks `const c = cookies()` (no await) in any
   route handler.
6. `task-discipline` blocks an Edit when no active task exists.
7. Phase advancement: edit both `progression.md` and `phase-scope.json` to "B",
   commit, verify the previously-blocked `app/api/chat/route.ts` is still
   blocked (phase B doesn't open chat — phase E does).

## Skill candidate

If the team grows or you start dispatching many phase-gated tasks, the
**phase-advance** action is a clear Skill candidate: it has a fixed-shape
output (edit two files, append a ledger line, run verify) and benefits from
the same input across many invocations. Build it when the third manual
phase advance lands on disk.

## Caveats

- **The pipeline is faithful to the Billion Farm architecture, but the
  Worldline-specific sensors (`phase-scope`, `globe-discipline`,
  `netra-voice-shallow`) have not been smoke-tested in a running install.**
  The smoke-test list above is the right next step before wiring it to a
  blocking pre-commit.
- **The `.harness/` directory references repo paths like `app/`,
  `components/`, `lib/`.** If the worldline repo's actual layout differs
  (e.g., the components live in `src/components/`), update the regexes in
  `phase-scope.json`, the path strings in `globe-discipline.json`, and the
  `placement.ts` regex.
- **Watchdog and heavy judges run in `shadow` / `warn` mode by default.**
  Promote to `block` only after reading 30+ verdicts in `audit/index.ndjson`
  and confirming low false-positive rate (per the standard promotion protocol
  documented in the README).
- **The `task-substance` model uses `claude-haiku-4-5-20251001` per phase.**
  If Anthropic ships a newer Haiku, update `harness.config.json`
  `judges.task-substance.model_per_phase`.

## Files in this drop-in

Everything is at `worldline-harness/.harness/...`. Move it to your worldline
repo root and rename to `.harness`. The paired top-level `worldline-harness/
harness-workflow-worldline.md` is this document; copy that to `docs/` if you
want it tracked in the worldline repo.

_End of document._
