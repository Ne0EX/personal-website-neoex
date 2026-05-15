# TO · Canopus (α-HAR-05)
# FROM · Polaris (α-OPS-00)
# TASK · TASK-2026-05-15-64
# TYPE · TASK CONTRACT
# CREATED · 2026-05-15
# MODEL TIER · sonnet

---

## context

Betelgeuse's scope has been expanded: she may now produce **interactive HTML/CSS/JS prototypes** at `docs/design/prototypes/<feature>-<task-id>.html` as a design tool. Sirius reads the spec doc as authoritative and uses the prototype as a visual reference when implementing production components.

The harness does not yet know about this path or workflow. This task closes that gap.

## scope

**1. FILE-OWNERSHIP.md**
Add `docs/design/prototypes/**` under Betelgeuse (α-VIS-04). These files are design artifacts, not production code.

**2. sign-work.sh**
Ensure `.html` files under `docs/design/prototypes/` are included in Betelgeuse's file manifest when she runs `sign-work.sh`. Currently sign-work collects by agent territory — confirm the glob covers this path or extend it.

**3. New hook — `prototype-ready.sh`**
Fires when Betelgeuse writes to `docs/design/prototypes/**/*.html`.

Behavior:
- Log event: `[PROTOTYPE-READY] <filename> — Betelgeuse · <task_id>`
- Write a short notify entry to `.claude/handoffs/from-betelgeuse/PROTO-<task_id>--to-sirius.md` with the prototype path and associated spec path (derived from the task_id pattern)
- Does NOT block — fire-and-continue

Register in `settings.json` as a post-edit hook scoped to `docs/design/prototypes/**`.

**4. RAIL-DEFINITIONS.md**
Add a rail entry for the prototype workflow:
- rail name: `prototype-visual-ref`
- trigger: Betelgeuse writes `.html` to `docs/design/prototypes/`
- downstream: Sirius notified via auto-handoff
- gate: none (prototypes are non-blocking; they are reference, not approval)

**5. docs/harness/README or equivalent**
One-line entry documenting that `docs/design/prototypes/` is Betelgeuse's interactive design output, distinct from specs and not subject to visual-diff gate.

## acceptance

- `docs/design/prototypes/` appears in FILE-OWNERSHIP.md under Betelgeuse
- `sign-work.sh` glob covers `.html` files in that path
- `prototype-ready.sh` exists, fires on write to `docs/design/prototypes/**/*.html`, and creates the notify handoff
- Hook registered in `settings.json`
- RAIL-DEFINITIONS.md updated
- Signed via `sign-work.sh` per v2 schema

## constraints

- Do NOT modify betelgeuse.md or sirius.md — Polaris already updated those
- Do NOT add a visual-diff gate to prototypes — they are reference only, not approval-gated
- The notify handoff Canopus generates must be minimal: path + task_id only, no prose

---

*polaris · α-OPS-00 · 2026-05-15*
