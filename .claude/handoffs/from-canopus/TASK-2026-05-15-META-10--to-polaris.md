---
task_id: TASK-2026-05-15-META-10
from: canopus · α-HRN-07
to: polaris · α-OPS-00
date: 2026-05-15
re: prototype layer formalization — territory + rails + handover protocol
---

# TASK-2026-05-15-META-10 return handoff · Canopus → Polaris

## scope

Formalized the prototype layer in the repo and harness. All 6 deliverables shipped.

---

## what i did

### Deliverable 1 · `prototypes/.gitkeep` (top-level directory established)

`prototypes/` now exists in the repo with `.gitkeep`. This is the canonical location for Betelgeuse's standalone HTML/CSS/JS prototypes.

### Deliverable 2 · `docs/team/FILE-OWNERSHIP.md` — Prototype layer section

Added:
- **Prototype layer territory contract** — full table of owned paths, constraint matrix, discipline rules, and handover flow
- **Betelgeuse** gains `prototypes/**/*.html`, `*.css`, `*.js`, `*.md` and `.claude/visual-diffs/**/prototype/**`
- **Sirius** gets explicit exclusions: `! prototypes/**` and `! .claude/visual-diffs/**/prototype/**` — prevents the "shortcut" failure where Sirius edits the prototype instead of porting properly
- Betelgeuse's exclusions `! prototypes/**/*.ts` and `! prototypes/**/*.tsx` are clarifying notes (TypeScript in prototypes is unassigned, caught as FAIL by the territory rail)

Note: the linter (on post-edit) also added `docs/design/prototypes/**` to Betelgeuse's block and `! docs/design/prototypes/**` to Sirius's block. These are improvements and I kept them — they align with the intent.

**Authorized cross-territory touch:** `docs/team/FILE-OWNERSHIP.md` is Polaris territory. This edit is explicitly authorized by the task contract: "Permitted cross-territory touch · `docs/team/FILE-OWNERSHIP.md` (Polaris territory; authorized by THIS task contract per TASK-13 precedent)". Same as TASK-13 (WORKFLOW.md). Territory rail correctly flags it; the flag is expected.

### Deliverable 3 · `scripts/audit-territory.sh` — prototype-layer documentation

No code changes needed. The existing dynamic FILE-OWNERSHIP.md reading architecture automatically picks up Betelgeuse's new territory globs and Sirius's new exclusions. Added a documentation block in the header explaining how prototype-layer enforcement works dynamically.

Enforcement summary:
- Betelgeuse writing `prototypes/**/*.html/css/js/md` → PASS (in territory)
- Betelgeuse writing `prototypes/**/*.ts/.tsx` → FAIL (unassigned — no TypeScript in prototype layer)
- Sirius writing anything in `prototypes/**` → FAIL (excluded from Sirius territory; real owner = Betelgeuse)

### Deliverable 4 · `scripts/audit-prototype-discipline.sh` (mode 755) — REAL

Enforces 4 rules:
- R1: No `.ts` or `.tsx` files in `prototypes/**`
- R2: No `from 'next/...'` imports in prototype JS files (dynamic imports too)
- R3: No `import` from `@/` path alias in prototype JS files
- R4: Each immediate subdirectory under `prototypes/` must have `README.md`

Exit codes: 0 PASS · 1 FAIL · 2 SKIP (prototypes/ missing). POSIX-compatible (BSD+GNU awk).

### Deliverable 5 · `scripts/audit-prototype-production-diff.sh` (mode 755) — STUB

Honest stub. Exits 0 with TODO message. Does not block any current task closure. Real pixel-diff logic deferred to META-11 (Algol writes diff logic; Canopus wraps). Documented the planned implementation in the file header (pixel diff via pixelmatch, Playwright MCP, configurable thresholds).

### Deliverable 5b · `scripts/audit-prototype-runtime.sh` (mode 755) — REAL

The corrective for the harness gap Peat caught 2026-05-15.

Implementation:
- Finds prototypes to audit: task-scoped via baseline+git diff when `WL_TASK_ID` is set; full scan when not set; `WL_PROTO_PATH` override for targeted testing
- Ephemeral `python3 -m http.server` on random free port in 8800-8999 (POSIX awk-based selection, not `shuf`)
- Node.js inline script with absolute `playwright-core` path (resolves from project root; temp file in `/tmp` cannot resolve relative to `node_modules`)
- Hard watchdog timeout (JS `setTimeout`) within the Node script since BSD macOS doesn't have `timeout` command
- C1: console errors (allowlisted patterns from `.harness/runtime-allowlist.json`)
- C2: uncaught page exceptions
- C3: failed network requests (404, CORS, module load)
- C4: DOM anchor check (configurable via `<meta name="wl-anchor">`, fallback `body > *:not(script)` count > 3)
- Exit 0 PASS · 1 FAIL · 2 SKIP (no prototypes in scope) · 3 WARN (playwright unavailable)

Also created `.harness/runtime-allowlist.json` with initial allowlist patterns (Google Fonts, GSAP CDN).

Wired into `pre-handoff.sh` via check 4c (below).

### Deliverable 6 · `.claude/hooks/pre-handoff.sh` — check 4c

Added check 4c: when source agent is Betelgeuse AND recipient is Sirius AND `files_touched` includes a prototype path (`prototypes/` or `.claude/visual-diffs/**/prototype/`), the handoff document must contain:
- `## prototype port checklist` section
- 4 required fields: `production target path`, `production concerns`, `diff tolerance`, `rendered checkpoint path`

Exit 12 on violation. Does not affect other agent→agent handoffs.

### Deliverable 7 · `.harness/worldline-harness.config.json` — 3 new rails

```
prototype-layer          status: enforcing  check: scripts/audit-prototype-discipline.sh
prototype-production-diff status: stub      check: scripts/audit-prototype-production-diff.sh
prototype-runtime        status: enforcing  check: scripts/audit-prototype-runtime.sh
```

Harness now has **8 rails** total (5 prior + 3 new).

`harness-check.sh` with 8 rails verified. 7/8 pass. Territory rail correctly flags `FILE-OWNERSHIP.md` (authorized deviation — see below).

### Deliverable 8 · `docs/harness/RAIL-DEFINITIONS.md` — 4 new sections

Added:
- Rail: prototype-layer (with R1-R4 table and fix instructions)
- Rail: prototype-production-diff (stub with planned implementation)
- Rail: prototype-runtime (with C1-C4 table, why-it-exists explanation, Playwright config, allowlist, skip behavior, fix instructions)
- Prototype-to-production handover protocol (full flowchart + port checklist template)

### Deliverable 9 · `tests/harness/prototype-layer.sh` (mode 755) — 8 scenarios

```
T1  discipline · good prototype (html/css/js + README.md)  → PASS ✓
T2  discipline · .tsx file in prototype                     → FAIL R1 ✓
T3  discipline · next/ import in JS                         → FAIL R2 ✓
T4  discipline · @/ alias import in JS                      → FAIL R3 ✓
T5  discipline · missing README.md                          → FAIL R4 ✓
T6  diff-stub · exits 0 with TODO message                  → PASS ✓
T7  runtime · good prototype renders DOM, no errors         → PASS ✓
T8  runtime · broken prototype (missing-module.js)          → FAIL C3 ✓
```

All 8/8 PASS on final run. Iterative fixes applied during development: shuf→awk (BSD compat), timeout→Node-internal watchdog (BSD compat), ANCHOR_SELECTOR JS quoting, playwright-core absolute path, exit code capture pattern.

---

## what you do next

Polaris:

1. **Acknowledge the authorized territory deviation** (see below). Same action as TASK-13.
2. **Brief Betelgeuse** on the new prototype layer:
   - `prototypes/` is her directory
   - Discipline rail enforces: no .ts/.tsx, no next/ imports, no @/ aliases, README.md required per prototype dir
   - Runtime rail: her prototype must load in a headless browser without errors before she can hand off to Sirius
   - Port checklist required in any Betelgeuse → Sirius handoff that includes prototype paths
3. **Brief Sirius** on the handover protocol:
   - Read RAIL-DEFINITIONS.md §Prototype-to-production handover protocol
   - The prototype is ground truth; spec doc is secondary annotation
   - Sirius cannot write to `prototypes/**` — territory rail will block it
4. **Brief all agents** on the new rails (HOOK ADDITION announcement is my normal pattern — Polaris may route this or I can issue it as a separate step)
5. **Open META-11** when ready — Algol writes pixel diff logic, Canopus wraps `audit-prototype-production-diff.sh` with real implementation

---

## known deviations

**Territory: `docs/team/FILE-OWNERSHIP.md` is Polaris territory.** The territory rail correctly flagged this. The edit is explicitly authorized by the task contract: "Permitted cross-territory touch · `docs/team/FILE-OWNERSHIP.md` (Polaris territory; authorized by THIS task contract per TASK-13 precedent)".

**harness_passed=false:** Solely due to the FILE-OWNERSHIP.md territory flag above. `post_edit_passed=true` (lint, typecheck, build all pass). All new scripts and tests pass their respective verifications.

**pre-handoff.sh will block on `harness_passed=false`.** This is the TASK-13 precedent — Polaris acknowledges the authorized deviation and accepts the handoff. Options:
- Accept as-is (the signature is technically valid; the FAIL is documented and authorized)
- Or: add a task-authorization override mechanism to pre-handoff.sh (future enhancement)

---

## signature

`.claude/signatures/TASK-2026-05-15-META-10--canopus.json`

harness_passed: false (authorized — FILE-OWNERSHIP.md territory deviation per task contract)
post_edit_passed: true

---

signature · .claude/signatures/TASK-2026-05-15-META-10--canopus.json
