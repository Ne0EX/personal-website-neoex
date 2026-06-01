# Name-Collision Resolution — 2026-06-01

**Task:** TASK-2026-06-01-SECURITY-HARNESS-WAVE-0-1
**Author:** Canopus · α-HRN-07

## What the collision was

Two separate artifacts shared the name "worldline-harness":

| Artifact | Location | State | Owner |
|---|---|---|---|
| Active rail registry | `.harness/worldline-harness.config.json` | **LIVE** — enforcing 13 rails | Canopus |
| Dormant ported engine | `worldline-harness/.harness/` | **DORMANT** — fires on nothing; farm-erp anchors; no npm scripts | Carried from farm-erp |

This made "worldline-harness" mean two different things in two different places.

## Resolution

`.harness/` is the single live root. One config root, one rail vocabulary.

The dormant engine was moved from `worldline-harness/.harness/` → **`.harness/engine/`**.

Path references inside the engine that previously assumed the old location have been updated:
- `.harness/engine/adapters/claude-code/_lib.sh` — tsx resolution + cli.ts invocation path
- `.harness/engine/core/sensors/mutating-action.ts` — mutating-bash.json / mutating-mcp.json paths

The original `worldline-harness/` directory remains on disk (not deleted) — it can be removed
from version control by Polaris at the commit boundary, or retained as a gitignored backup.
The `.gitignore` should be updated to ignore `worldline-harness/` if retention is preferred.

## What is NOT changed

- `.harness/worldline-harness.config.json` — identity, config version, all rail definitions
  unchanged. The name of this file is deliberate: it is the config for the worldline-harness
  system. It does not move.
- `.harness/axioms-v1.json` and `.harness/axioms-v1.schema.json` — unchanged
- `.harness/runtime-allowlist.json` and `.harness/allowed-overlaps.json` — unchanged
- All hook scripts in `.claude/hooks/` — unchanged

## Engine adaptation status (post-move)

The engine is still DORMANT as a whole — no npm scripts, no pre-commit symlink, no
active sensor wiring yet. That is Wave 1 work. The move here is substrate-only.

The blocking PreToolUse hook wired in Wave 1 (`mutating-action-hook.sh`) reads the
engine's denylist JSON directly as pure data — it does not depend on tsx or the full
engine runtime being installed. That is the "promotion, not invention" path described
in the design doc.

## Single worldline-harness going forward

```
.harness/                       ← live root (Canopus territory)
  worldline-harness.config.json ← active rail registry (THE config)
  axioms-v1.json                ← signed axiom registry
  engine/                       ← dormant ported engine (adapting)
    harness.config.json         ← engine sensor/judge config (subordinate)
    core/sensors/               ← sensor implementations (used by Wave 1 hook)
    core/runtime/               ← denylist JSON (consumed by Wave 1 hook)
    adapters/claude-code/       ← will replace on-dispatch.sh and hooks when engine activates
    anchors/curated/            ← worldline design-rails, tech-rails, intent, workflow
    audit/                      ← historical attestations from farm-erp (preserved, not active)
```
