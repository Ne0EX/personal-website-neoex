# TO · Canopus (α-HRN-07, Architect of the Rails)
# FROM · Polaris (α-OPS-00)
# TASK · TASK-2026-05-15-META-10
# TYPE · TASK CONTRACT (DRAFT · dispatch held until UI iter 1 closes)
# CREATED · 2026-05-15
# MODEL TIER · sonnet
# TRIGGER · Peat directive 2026-05-15 — open "prototype layer" for Betelgeuse to close structural soul-gap; preserve Sirius implementation specialization; enable rendered-artifact-as-ground-truth handover pattern

---

## decision context (do not relitigate)

Peat 2026-05-15: "OK ไปทาง C เลย เปิด META-10 หลัง iter 1 จบ"

Polaris presented 3 options to address the structural gap that Vision Fidelity Protocol caught (8 Betelgeuse deliverables were paper-only · zero rendered ground truth from her hand):

- **Option A** (status quo · specs-only) — REJECTED · soul gap remains open
- **Option B** (grant Betelgeuse `components/**`) — REJECTED · blurs Sirius role; dual-ownership conflict factory; loses team specialization
- **Option C** (open prototype layer) — **CHOSEN**

This TASK enables Option C.

---

## scope

Formalize a **prototype layer** in the repo + harness:

- Betelgeuse can write standalone HTML/CSS/JS prototypes that visitors never see at production but Peat reviews directly and Sirius ports from
- Sirius retains `components/**` + `app/**` ownership — production discipline preserved (hydration · types · a11y · motion guard · SSR safety)
- New diff rail catches translation drift (Betelgeuse prototype ≠ Sirius production) before brand-bearing surface ships

## vision fidelity

not applicable · harness/territory infrastructure; no brand surface touched. (The protocol this TASK *enables* IS brand-bearing.)

---

## canonical inputs (READ FIRST)

1. `docs/team/SOUL-BASELINE-AUDIT.md` (Polaris consolidated 2026-05-15) — why this gap exists
2. `docs/team/VISION-FIDELITY.md` §0 + §5 + §9 — rendered checkpoint requirement
3. `docs/team/FILE-OWNERSHIP.md` — current territories (you extend, don't replace)
4. `docs/team/QUALITY-BAR.md` U0 · F1-F6 (production frontend bar Sirius must hit; prototypes don't have to)
5. `scripts/audit-territory.sh` (your prior work) — whitelist mechanism reference
6. `.claude/visual-diffs/UI-ITER-1-globe-v1/prototype/` (Betelgeuse's iter 1 output — read once landed; this is the live example of what prototype-layer means)
7. `.claude/handoffs/from-polaris/TASK-2026-05-15-META-4-checkpoint-hook.md` (your META-4 contract pattern) — same structure

---

## deliverables

### 1. Territory definition (`docs/team/FILE-OWNERSHIP.md`)

Add new section "**Prototype layer**":

- `prototypes/**` (NEW top-level directory) — Betelgeuse owns; standalone HTML/CSS/JS only; NO TypeScript, NO JSX, NO Next.js imports, NO production-graph dependencies
- `.claude/visual-diffs/<task>/prototype/**` — Betelgeuse owns; per-task iteration mockups (already convention; formalize)
- Sirius **CANNOT write** to these paths (preserves clean ownership · prevents accidental "shortcut" where Sirius edits the prototype to match a production fix instead of porting properly)
- Algol can READ for diff audit (cannot write)

### 2. Audit whitelist (`scripts/audit-territory.sh`)

Extend territory rail to recognize prototype layer:
- `prototypes/**/*.html` · `prototypes/**/*.css` · `prototypes/**/*.js` — Betelgeuse PASS
- `.claude/visual-diffs/**/prototype/**` — Betelgeuse PASS
- `prototypes/**/*.ts` · `prototypes/**/*.tsx` — Betelgeuse FAIL (must stay vanilla, no TS to prevent Next-importable artifacts)
- Same paths for Sirius → FAIL (clean ownership)

### 3. Rail registration (`.harness/worldline-harness.config.json`)

Add `prototype-layer` rail entry. Wrapper script `scripts/audit-prototype-discipline.sh` (you write) checks:
- No `.tsx` / `.ts` files in `prototypes/**`
- No `from 'next/...'` imports in any prototype JS
- No `import` statements referencing `@/` (Next.js alias) in any prototype JS
- Each prototype directory has a `README.md` explaining what it represents

Emit `PASS` / `FAIL <file>:<reason>` / exit codes 0-3 per existing audit pattern.

### 4. Handover protocol (`docs/harness/RAIL-DEFINITIONS.md`)

New section "**Prototype-to-production handover**":

```
Betelgeuse ships prototype/    → handoff to Sirius
    ↓
Sirius reads prototype as ground truth
    ↓
Sirius writes components/*.tsx + app/* with production concerns:
  - hydration safety (useEffect for browser-only reads)
  - TypeScript types (Article / Photo / Fiction from @/lib/content)
  - a11y wiring (focus management, ARIA, role attributes)
  - reduced-motion respect (prefers-reduced-motion media query)
  - SSR safety (no Date.now() / Math.random() / localStorage in initial render)
  - Test coverage (regression test at tests/<surface>.test.tsx)
    ↓
Sirius captures production rendered shot via Playwright MCP
    ↓
Algol diff rail · audit-prototype-production-diff.sh
    ↓
verdict: PASS / DRIFT-FLAG / FAIL (soul-loss in translation)
```

### 5. Prototype-to-production diff rail (STUB · followup TASK opens for Algol-Canopus joint)

`scripts/audit-prototype-production-diff.sh` — STUB only this TASK:
- Reads `prototypes/<surface>/index.html` rendered by Playwright MCP
- Reads `app/<surface>/page.tsx` rendered by Playwright MCP
- Pixel diff (basic) → percentage drift
- STUB exits 0 with TODO message; real audit logic deferred to META-11 (Algol writes diff logic; you wrap)

### 5b. Prototype-runtime audit rail (REAL · NEW · added 2026-05-15 per Peat's harness-gap catch)

**Trigger:** Peat discovered today that `python3 -m http.server` wasn't running yet his browser returned ERR_CONNECTION_REFUSED — and the harness had still issued PASS verdicts. Iter 1 (UI-1) shipped 6 PNG screenshots as evidence of one-time render, but no persistent gate verified runtime correctness on subsequent loads. This is a real gap.

`scripts/audit-prototype-runtime.sh` — REAL implementation in THIS task:

1. Find prototypes touched in current TASK (`prototypes/**` or `.claude/visual-diffs/**/prototype/**`)
2. For each prototype `index.html`:
   - Start ephemeral Python HTTP server on a random free port (8800-8999 range)
   - Use Playwright MCP to navigate to `http://localhost:<port>/<path>`
   - Capture `page.on('console')` — any `error` level = FAIL
   - Capture `page.on('pageerror')` — any uncaught exception = FAIL
   - Capture `page.on('requestfailed')` — any network failure (404 / CORS / module load) = FAIL
   - Assert at least one DOM anchor renders (configurable per prototype via `<meta name="wl-anchor" content="selector">` tag, or fallback to `body > *:not(script)` count > 3)
   - Tear down server
3. Emit: `PASS · prototype/<path> · <ms> render time` or `FAIL · prototype/<path> · <reason>`
4. Exit codes: 0 = PASS · 1 = FAIL (one or more prototypes broken) · 2 = no prototypes in task scope (skip-pass)

**Wire into:**
- `pre-handoff.sh` — if handoff source agent is Betelgeuse AND files_touched includes prototype path, REQUIRE prototype-runtime audit PASS before pre-handoff completes
- Register as 7th rail in `.harness/worldline-harness.config.json`
- Document in `RAIL-DEFINITIONS.md` as "Prototype-runtime rail"

**Constraints specific to this rail:**
- Playwright MCP must be operational (handled by existing `.mcp.json` wiring; check before running and skip with WARN if unavailable rather than FAIL — agents should not be punished for platform issues)
- Maximum 30s timeout per prototype (under H4 hooks-are-fast budget)
- Configurable allowlist of acceptable warnings (e.g., Google Fonts CDN slowness) via `.harness/runtime-allowlist.json`

**Why REAL not STUB:** the diff rail (5) is deferred because pixel diffing has noise issues that need careful tuning. The runtime rail (5b) is binary — page either loads with zero console errors or it doesn't. No tuning ambiguity.

### 6. `pre-handoff.sh` extension

When Betelgeuse handoff target is Sirius AND files_touched includes a prototype path:
- Require `## prototype port checklist` block in the handoff
- Required fields: production target path · production concerns to address (hydration · types · a11y · motion) · expected diff tolerance · rendered checkpoint path

---

## constraints

- Do NOT modify `components/**` or `app/**` (Sirius territory)
- Do NOT modify `docs/team/QUALITY-BAR.md` (Polaris-only; Polaris adjusts QUALITY-BAR if needed in follow-up)
- POSIX-compatible (BSD + GNU awk)
- The prototype-to-production diff rail STUB must not block any current TASK closure (real audit deferred)
- Stay within Canopus territory: `.claude/hooks/**` · `scripts/audit-*.sh` · `.harness/**` · `.claude/settings.json` · `docs/harness/**` · CI workflows
- Permitted cross-territory touch · `docs/team/FILE-OWNERSHIP.md` (Polaris territory; authorized by THIS task contract per TASK-13 precedent)

---

## harness protocol

- Step 0 · `bash .claude/hooks/pre-task.sh TASK-2026-05-15-META-10 canopus`
- Sign: `WL_AGENT=canopus WL_NEXT=polaris WL_SUMMARY="META-10 prototype layer · territory + rail + handover protocol" bash .claude/hooks/sign-work.sh TASK-2026-05-15-META-10`
- Return at `.claude/handoffs/from-canopus/TASK-2026-05-15-META-10--to-polaris.md`

---

## acceptance criteria

- `prototypes/.gitkeep` exists (top-level dir established)
- `FILE-OWNERSHIP.md` updated with Prototype layer section (Betelgeuse owns, Sirius blocked from write)
- `audit-territory.sh` recognizes new paths (smoke test: planted `prototypes/test/foo.tsx` → FAIL; planted `prototypes/test/foo.html` → PASS for betelgeuse)
- `audit-prototype-discipline.sh` exists, mode 755, emits expected outputs
- `prototype-layer` rail registered in `.harness/worldline-harness.config.json`
- `RAIL-DEFINITIONS.md` documents handover protocol
- `audit-prototype-production-diff.sh` STUB exists (honest exit 0 + TODO)
- `pre-handoff.sh` enforces prototype port checklist when Betelgeuse → Sirius with prototype path
- `harness-check.sh` exits 0 with 8 rails (5 prior + new prototype-layer · new diff-stub · new prototype-runtime)
- `audit-prototype-runtime.sh` REAL: smoke test verifies one good prototype PASS + one planted-broken prototype FAIL (missing `<body>` content, broken module import, etc.)
- Smoke test under `tests/harness/prototype-layer.sh` (≥6 scenarios — territory + runtime + diff-stub)
- Signature v2 clean

---

## downstream impact

Unblocks:
- **TASK-META-11** (deferred) · Algol writes prototype-to-production diff audit logic; Canopus wraps
- **All Phase 2 Sirius implementation TASKs** — port from Betelgeuse prototype with clean handover; Algol diff catches drift
- **Future Betelgeuse iterations** — rendered artifact is canonical output; spec doc is secondary annotation
- **Polaris quality gate** — Peat reviews prototypes, not specs; soul-loss caught at iteration boundary, not after implementation

---

## risk notes

- **Risk · Betelgeuse imports Three.js / heavy logic into prototype** — handover becomes painful (Sirius rewrites instead of ports). Mitigation: audit-prototype-discipline.sh blocks `.ts` / `.tsx` / Next-aliased imports; prototypes stay vanilla.
- **Risk · Sirius copy-pastes prototype HTML instead of porting** — defeats the territorial separation. Mitigation: diff rail (META-11 when live) catches identical structure without production concerns wiring.
- **Risk · Algol diff rail produces false positives** — pixel diffs are notoriously noisy. Mitigation: META-11 deferred to allow rendering infrastructure (Playwright MCP) to stabilize before strict diff enforced; META-10 stub is honest no-op.

---

## dispatch hold

**THIS CONTRACT IS DRAFT. DO NOT EXECUTE UNTIL POLARIS RELEASES.**

Release condition: Betelgeuse TASK-UI-1 (Globe v1 direction · iter 1) closes with verdict LOCK or REVISE — either way, that iteration validates the prototype-layer approach in practice. Polaris then dispatches META-10 with this contract as the brief.

Until then: do NOT begin work on META-10. Pick up any other available TASK (META-5 live verify recommended next if META-4/3/1 issues need attention).

---

*polaris · α-OPS-00 · 2026-05-15 · META-10 enables Option C territory · contract drafted, dispatch held*
