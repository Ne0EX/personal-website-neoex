# DEV-PLAN-2026-05-15 · section C · E2E test pipeline scope (Algol + Canopus)

> **Author** · Polaris (instance C) · α-OPS-00 · parallel deployment under root-Polaris
> **Predecessors** · DEV-PLAN sections A (TASKs by PRD) + B
> **Why this doc exists** · Peat asked explicitly: "หลังจากนี้เราจะเตรียมทำ End-to-End test(E2E) pipeline ด้วย ซึ่ง Algol กับ Canopus ต้องช่วยงานกันและกัน"
> **What this doc is** · scope, not a contract. Algol and Canopus refine inside each TASK when dispatched.

---

## C.1 what "end-to-end" means for Worldline

E2E for Worldline is **a real browser, driving a real production build, walking a real visitor journey from `/` to a terminal moment** (article read, photo viewed, NETRA reply received, search result reached). Real Three.js. Real MDX. Real Pagefind. Real `/api/chat` (with the model itself stubbed — see C.7).

It is **not**:

| layer | scope | owner | runner |
|---|---|---|---|
| unit | one function in isolation (zod schemas, EXIF parser, voice utils) | Procyon · Arcturus · Algol | `node --test` / vitest in `tests/unit/**` |
| component | one React component in jsdom with stubs (HeroBlock, AudienceFork, AttractorFields filter logic) | Sirius writes; Algol audits | vitest in `tests/components/**` |
| audit rails | invariant checks over the repo (territory, tokens, voice, a11y-static, next-16) | Canopus wraps; Algol logic | `bash scripts/audit-*.sh` |
| **E2E** | **real browser + real build + real journey** | **Algol specs + Canopus runner** | **Playwright in `tests/e2e/**`** |

The site is unusual: a Three.js Globe with `role="application"`, MDX with build-time velite, Pagefind index built post-build, NETRA streaming over `/api/chat`. None of these are well-served by jsdom alone. The Globe specifically needs WebGL — Playwright with chromium gives us that.

E2E does **not** validate visual perfection. That belongs to (a) Algol+Canopus visual regression on a fixed set of snapshots, (b) Betelgeuse review against design specs. E2E validates *that the journey reaches the right terminal state*.

---

## C.2 critical user journeys (mapped from journey-arch §1)

For each moment, the E2E test asserts (a) the happy path reaches the expected DOM/URL state and (b) one named failure mode degrades gracefully.

### M1 · LAND
- happy · `/` mounts; `BootSequence` plays (or skips on `wl:boot-seen`); Globe canvas reaches paint within 5s; HeroBlock title text visible; floating N button present.
- failure · WebGL unavailable (`--disable-gl-drawing-buffer` flag) → boot completes, Globe shows `// observatory offline · α drift exceeded …` line, `ChapterIndex` remains usable.

### M2 · PICK STRATUM
- happy · click each of `1 · NeX`, `2 · Ne0N`, `3 · Ne0`, `0 · ALL` in left rail → Nav right-readout updates to `· STRATUM <key>` (except `ALL` which hides per §3.6) → camera tween completes within 1500ms.
- failure · reduced-motion (`prefers-reduced-motion: reduce`) → tween collapses to 0ms cut; readout still updates.

### M3 · BROWSE
- happy · drag canvas in ALL stratum → rotation observable (assert via reading a probe value on `window.__worldlineProbe__` exposed in test mode); tab key reaches off-canvas pin list; hover over pin → preview tooltip appears.
- failure · empty stratum (test fixture with zero entries) → no pins; below-canvas copy `// no traces surveyed …` visible.

### M4 · ENTER (article / photo)
- happy article · click first article pin → side panel opens (520ms); click `READ ENTRY →` → navigates to `/entries/<fileNum>`; entry header strip + body + patches log all in DOM.
- happy photo · click first photo pin (square glyph) → side panel opens → `READ ENTRY →` → `/photos/<roll>/<id>`; film-strip border present; EXIF readout block visible.
- failure · network throttle on entry-page hydration → loading state visible; no client-side error in console.

### M5 · SCAN
- happy · scroll past Globe → ChapterIndex visible and interactive; click `[ ↓ AS LIST ]` in ATLAS footer → anchor jump to `#chapter-index`.

### M6 · FILTER (AttractorFields)
- happy · click an attractor tag → ChapterIndex list narrows to matching entries.
- (binding-to-Globe deferred to TASK-14 per journey-arch §1 M6; do not assert it.)

### M7 · ASK NETRA
- happy · click floating N → drawer slides in from right (520ms); compose message "what is here?" → assert request to `/api/chat` fires with mocked streaming response → first NETRA token appears within 800ms of response start; double-`Esc` closes drawer; focus returns to Globe.
- failure · rate-limit (mock 429) → drawer shows `α drift exceeded · NETRA dormant …` copy; composer disabled.

### M-SEARCH (once PRD-04 ships)
- happy · press `/` → overlay modal opens with results list + SVG mini-globe; type "bangkok" → results filter; ESC closes; focus returns.

### M-RETURN
- happy · second load with `wl:boot-seen=true` cookie/storage → boot does not play; Globe lands in ALL; no audience-path persistence (per §6.1).

### MOBILE (375px viewport)
- happy · `/` → ATLAS · STANDBY placeholder card visible on fold; `[ OPEN ATLAS ↗ ]` routes to `/atlas` full-viewport Globe; floating N stays bottom-left, 56×56 tap target; ChapterIndex is fold-primary below placeholder.

---

## C.3 layered test pyramid for Worldline

```
            ┌──────────┐
            │   E2E    │  real browser · real build · full journeys (C.2)
            ├──────────┤   ~30–60 tests · Playwright · CI ≤10min
            │ component│  per-component integration (jsdom)
            ├──────────┤   ~100–200 tests · vitest · CI ≤2min
            │ unit +   │  schemas (Procyon) · prompt evals (Arcturus) · voice utils
            │ content  │   ~200+ tests · vitest/node:test · CI ≤30s
            ├──────────┤
            │ audit    │  territory · design-tokens · next-16 · voice · a11y-static
            │ rails    │   5 rails (2 real, 3 stub) · run on every edit via post-edit.sh
            └──────────┘
```

The pyramid is **inverted in coverage volume** (lots of unit, fewer E2E) and **right-side-up in trust** (E2E carries the most weight per assertion because it tests the integrated system).

The E2E layer is *new* in this plan. The audit rails layer already exists. The component and unit layers exist sparsely (`tests/worldline-globe-coordinates.test.mjs` is the only file currently in `tests/`).

---

## C.4 Algol's territory in the E2E pipeline

Per FILE-OWNERSHIP, Algol owns `tests/**` (except `tests/netra/eval-prompts.md`), `scripts/audit-*.ts`, `docs/qa/**`, `.claude/signatures/AUDIT.md`.

In the E2E pipeline Algol contributes:

1. **E2E test specs** at `tests/e2e/**.spec.ts` — Playwright TypeScript, one file per surface (`globe-stratum.spec.ts`, `article-entry.spec.ts`, `photo-entry.spec.ts`, `netra-chat.spec.ts`, `mobile-fold.spec.ts`, `returning-visitor.spec.ts`).
2. **Visual regression diff logic** at `scripts/audit-visual.ts` — consumes Canopus's screenshot output, computes per-pixel + perceptual diff (SSIM threshold), writes pass/fail JSON.
3. **Lighthouse audit logic** at `scripts/audit-lighthouse.ts` — wraps the Lighthouse Node API, asserts a11y ≥ 95 and performance budgets; replaces the current `audit-a11y.sh` stub.
4. **NETRA voice eval suite** at `tests/netra/voice-eval.spec.ts` — joint with Arcturus; runs scripted prompts against the model (or mock), asserts voice-pattern invariants (lowercase italic register, refusal taxonomy, no second-person imperatives).
5. **E2E test fixtures** at `tests/fixtures/**` — sample MDX, sample EXIF, mocked `/api/chat` SSE recordings, viewport configurations.
6. **Signature audit hook** for every E2E TASK (already established pattern — extends to E2E without modification).
7. **`docs/qa/E2E-PLAYBOOK.md`** — what the test suite covers, how to read failures, how to update snapshots intentionally.

Algol does **not** write:
- the bash runner (Canopus)
- the CI workflow yaml (Canopus)
- the screenshot-capture script (Canopus)
- the Playwright config (`playwright.config.ts` lives at repo root — Canopus territory under `next.config.*`-adjacent infra; if disputed, Polaris assigns to Canopus since it is wiring, not test logic)

---

## C.5 Canopus's territory in the E2E pipeline

Per FILE-OWNERSHIP, Canopus owns `.claude/hooks/**`, `.harness/**`, `scripts/audit-*.sh`, `scripts/visual-capture.sh`, `.github/workflows/**`, `docs/harness/**`, `playwright.config.ts` (by extension as infra wiring), and `eslint.config.mjs`.

In the E2E pipeline Canopus contributes:

1. **Playwright config** at `playwright.config.ts` — projects (chromium-desktop, chromium-mobile-375, chromium-mobile-iphone), reporters, base URL, web-server hook that runs `pnpm build && pnpm start` against a fixture content set.
2. **E2E runner wrapper** at `scripts/e2e-runner.sh` — orchestrates: build → start server → wait-for-server → run Playwright → tear down. Returns non-zero on any failure.
3. **Audit-e2e wrapper** at `scripts/audit-e2e.sh` — invoked by the harness rail; calls `e2e-runner.sh` with a smoke profile (subset of specs marked `@smoke`).
4. **Visual capture** at `scripts/visual-capture.sh` (currently parked) — uses Playwright to capture a fixed list of viewports × routes at known states, writes PNGs to `.claude/visual-diffs/<task_id>/shots/`. Algol's `audit-visual.ts` then diffs.
5. **Lighthouse runner** at `scripts/lighthouse-runner.sh` — wraps Lighthouse CLI against a running build, emits JSON for Algol's `audit-lighthouse.ts` to score.
6. **CI workflow** at `.github/workflows/e2e.yml` — runs on `pull_request` and `push: main`. Jobs: `lint+typecheck` → `unit+component` → `e2e-smoke` (always) → `e2e-full` (on `main` or label `e2e-full`) → `visual-regression` (always) → `lighthouse` (always; fail only on regression beyond threshold).
7. **Sixth harness rail** added to `.harness/worldline-harness.config.json`:
   ```json
   "e2e-smoke": {
     "description": "Smoke E2E suite (Playwright) passes on a built fixture content set.",
     "check": "scripts/audit-e2e.sh",
     "applies_to": ["app/**", "components/**", "lib/**", "content/**"],
     "status": "stub-until-tests-land",
     "rail_doc": "docs/harness/RAIL-DEFINITIONS.md#rail-e2e-smoke"
   }
   ```
   Status flips to `enforcing` after TASK · "wire E2E runner" lands.
8. **`docs/harness/RAIL-DEFINITIONS.md`** entries for `e2e-smoke`, `visual-regression`, `lighthouse-a11y` (graduating the existing `accessibility-floor` stub).

Canopus does **not** write:
- test specs (Algol)
- audit logic in TypeScript (Algol)
- assertions (Algol)

The clean split holds: **TS = Algol, bash + CI yaml + Playwright config wiring = Canopus.**

---

## C.6 collaboration shape — who does what, when

Three concrete handshakes Algol and Canopus must execute. Each is a separate TASK with both as named agents.

### handshake α — runner contract
- Canopus produces `playwright.config.ts` + `scripts/e2e-runner.sh` first, with **zero specs**.
- Canopus opens handoff to Algol with the runner invocation contract: "running `bash scripts/e2e-runner.sh [--smoke|--full]` from repo root will boot a server at `http://localhost:3000` against `tests/fixtures/content/`, run any `tests/e2e/**.spec.ts` Playwright picks up, and emit JUnit XML to `tests/e2e/.results/`."
- Algol then writes specs against that contract. Algol does **not** modify the runner.

### handshake β — fixture content
- Procyon owns `content/**`. For E2E, Algol cannot write into Procyon's territory but needs deterministic content.
- Resolution: `tests/fixtures/content/**` lives under Algol's `tests/**`. Procyon writes a **content-fixture script** (`scripts/build-test-fixtures.ts`, Procyon territory) that snapshots `content/**` to `tests/fixtures/content/` with deterministic timestamps. Canopus calls this in `e2e-runner.sh` before `pnpm build`.
- Algol writes ONE handoff to Procyon at the start of pipeline work to define what the fixture script outputs.

### handshake γ — visual regression
- Canopus's `scripts/visual-capture.sh` produces a deterministic set of PNGs.
- Algol's `scripts/audit-visual.ts` reads the new shots, diffs against committed baselines under `.claude/visual-baselines/**`, writes a pass/fail report.
- The **baseline update protocol**: when an intentional UI change requires baseline refresh, the agent making the change opens a `BASELINE-UPDATE` handoff to Algol; Algol updates the baseline in the same TASK as the visual change so the diff goes green in one commit. Polaris reviews any baseline update at sign-off.

### handshake δ — Lighthouse a11y graduation
- The existing `accessibility-floor` rail at `scripts/audit-a11y.sh` is a stub. To graduate:
  - Canopus replaces stub with `scripts/lighthouse-runner.sh` that runs Lighthouse against `app/articles/**`, `app/photos/**`, `app/fiction/**` routes against a built server.
  - Algol writes `scripts/audit-lighthouse.ts` that parses Lighthouse output, asserts a11y ≥ 95 + performance budgets, returns exit code.
  - `audit-a11y.sh` becomes a thin wrapper that calls both.
- This is one joint TASK with both as primary.

---

## C.7 tooling decisions

| decision | choice | rationale |
|---|---|---|
| E2E runner | **Playwright** | already wired via MCP (`.mcp.json`, `@playwright/mcp@0.0.75`); supports WebGL chromium for Three.js; built-in screenshot/trace/video; cross-browser available if needed later. No reason to introduce Cypress or WebdriverIO. |
| visual regression | **Playwright `toHaveScreenshot()` + Algol SSIM post-processor** | Playwright's built-in handles deterministic baseline storage; Algol adds SSIM thresholding for perceptual diffs (per-pixel diff is too noisy with Three.js render variance). Baselines committed under `.claude/visual-baselines/<viewport>/<route>.png` (NOT `tests/**` — kept separate so blob churn doesn't pollute test diffs). |
| assertion / report | **JUnit XML + GitHub Actions annotations** | JUnit is universal; GitHub Actions surfaces failures inline on PRs. |
| CI | **GitHub Actions** | `.github/workflows/**` already Canopus territory per FILE-OWNERSHIP; no other CI exists; matches repo conventions. |
| test fixtures | **Procyon-built snapshot of `content/**`** | see handshake β above. Avoids drift between dev and CI content. |
| NETRA chat mock | **recorded SSE streams replayed by Playwright route interception** | real API in CI costs tokens, is flaky, and exposes the API key surface. Algol records 5–10 representative SSE streams (one per prompt category — surface query, refusal, error, rate-limit, tool-use) into `tests/fixtures/netra-streams/`. Playwright `page.route('**/api/chat', …)` intercepts the request and replays. Real-API smoke runs are gated behind a manually-triggered workflow only. |
| Globe state probe | **`window.__worldlineProbe__` exposed only when `NODE_ENV !== 'production'` OR env var `WL_TEST_MODE=1`** | Three.js scene state is not in the DOM. Sirius wires a single read-only probe (stratum, selectedId, cameraPos, isAnimating). Algol asserts against it. The probe is also useful for `scripts/_probe.mjs` already in the repo. |
| browser matrix | **chromium only for v1** | one engine reduces flake; covers ~70% of real traffic; firefox/webkit added in phase 3 if value justifies cost. |
| reduced-motion testing | **Playwright `emulateMedia({ reducedMotion: 'reduce' })`** | built-in, deterministic. |

---

## C.8 phased rollout

E2E for v1 does not need to be exhaustive. Three phases.

### Phase 1 · smoke (v1 ship target)
- ~6 tests covering M1, M4-article, M4-photo, M7-NETRA-happy, M-RETURN, MOBILE-375.
- Runs on every PR. Target wall-clock: **≤4 min**.
- Goal: catch only complete-journey breakage. Not flake-prone, not exhaustive.
- Rail status: `enforcing` once green for 5 consecutive PRs.

### Phase 2 · regression suite (post-v1 hardening)
- Expand to ~30 tests: all M1–M7 paths × happy + named failure mode × desktop + mobile.
- Add visual regression baselines for: HeroBlock, ATLAS frame at each stratum, article entry header strip, photo entry film-strip, NETRA drawer at each region, mobile placeholder card.
- Runs on every PR. Smoke subset gates merge; full suite runs but fails are advisory until 5 consecutive greens.
- Wall-clock target: **≤8 min**.

### Phase 3 · perf / a11y / cross-browser
- Lighthouse a11y graduates to enforcing at ≥95 per surface (replaces stub).
- Lighthouse performance budgets: LCP < 2.5s, CLS < 0.1, INP < 200ms on built production.
- Add firefox + webkit projects to Playwright config; chromium remains required, others advisory.
- NETRA voice-eval suite (joint with Arcturus) lands.
- Wall-clock target: **≤15 min for full matrix.**

Phases are not gated by calendar dates — they ship as the underlying surfaces ship. Phase 1 unblocks when β/γ entry pages land. Phase 2 unblocks after Phase 1 has 5 consecutive greens. Phase 3 unblocks after PRD-05 NETRA ships + visual regression has a settled baseline.

---

## C.9 proposed TASKs to land the E2E pipeline

Five TASKs, in dispatch order. Polaris-instance-A's section numbers begin at TASK-15; these continue. Numbers final at dispatch.

### TASK-EE1 · wire E2E runner (Phase-1 foundation)
- **scope** · Canopus authors `playwright.config.ts`, `scripts/e2e-runner.sh`, `scripts/audit-e2e.sh`. Algol authors ONE smoke spec `tests/e2e/smoke-land.spec.ts` (M1 happy only) to validate the contract. Procyon authors `scripts/build-test-fixtures.ts` per handshake β.
- **agents** · Canopus (primary, sonnet), Algol (sonnet), Procyon (sonnet, narrow scope)
- **model tier** · sonnet across — wiring + one test, no novel design
- **depends-on** · none (runs in parallel with feature work)
- **blocks** · TASK-EE2, TASK-EE3, TASK-EE4
- **output artifact** · runner contract documented in `docs/harness/E2E-RUNNER.md` (Canopus); fixture builder spec in `docs/data/test-fixtures.md` (Procyon)
- **acceptance** · `bash scripts/audit-e2e.sh` exits 0 on a clean build; CI workflow runs and posts JUnit results to PR; `e2e-smoke` rail flipped from `stub-until-tests-land` to `enforcing` once green 5 PRs

### TASK-EE2 · smoke specs for v1 surfaces
- **scope** · Algol writes 5 specs covering M4-article, M4-photo, M7-NETRA-happy, M-RETURN, MOBILE-375 against the runner. Sirius adds `window.__worldlineProbe__` (one handoff from Algol → Polaris → Sirius).
- **agents** · Algol (primary, sonnet), Sirius (sonnet, single probe addition)
- **model tier** · sonnet
- **depends-on** · TASK-EE1; β/γ entry surfaces shipped; PRD-05 NETRA shipped (or stubbed for testing); probe wired
- **blocks** · TASK-EE4 (visual regression needs deterministic shots)
- **output artifact** · 5 spec files in `tests/e2e/**`; NETRA SSE recordings in `tests/fixtures/netra-streams/`
- **acceptance** · all 5 specs green locally 3× consecutively; CI run green; flake rate <2% over 20 runs

### TASK-EE3 · Lighthouse a11y graduation
- **scope** · Canopus writes `scripts/lighthouse-runner.sh`. Algol writes `scripts/audit-lighthouse.ts`. Existing `audit-a11y.sh` rewrites as thin wrapper. Rail status flips from `stub` to `enforcing` at a11y ≥ 95.
- **agents** · Canopus (sonnet), Algol (sonnet)
- **model tier** · sonnet
- **depends-on** · TASK-EE1 (needs the build-and-serve step); at least one entry surface shipped (β or γ)
- **blocks** · none directly; informs Phase 3
- **output artifact** · graduated `accessibility-floor` rail; CI job posting Lighthouse score on every PR; baseline scores recorded in `docs/qa/lighthouse-baselines.md`
- **acceptance** · `/`, `/entries/<first-fileNum>`, `/photos/<first-roll>/<first-id>` each score a11y ≥ 95; performance scores recorded as advisory baselines (not enforced yet)

### TASK-EE4 · visual regression suite
- **scope** · Canopus implements `scripts/visual-capture.sh` (un-parks the file). Algol implements `scripts/audit-visual.ts` with SSIM threshold. Both jointly define the baseline-update protocol and write it into `docs/harness/VISUAL-REGRESSION.md` + `docs/qa/visual-baselines.md`.
- **agents** · Canopus (sonnet), Algol (sonnet)
- **model tier** · sonnet; opus only if the SSIM threshold tuning reveals non-trivial Three.js render variance to model (escalate if so)
- **depends-on** · TASK-EE2 (need deterministic page states to shoot)
- **blocks** · none
- **output artifact** · `.claude/visual-baselines/**` populated with initial PNGs for ~20 viewport×route combinations; new CI job `visual-regression`
- **acceptance** · 3 consecutive clean runs with zero false-positive diffs; one deliberate UI change in a sandbox PR correctly fails; baseline-update protocol exercised once successfully

### TASK-EE5 · NETRA voice-eval suite (Phase-3 wedge)
- **scope** · Arcturus authors the eval prompt set in `tests/netra/eval-prompts.md` (his territory). Algol authors `scripts/eval-netra.ts` runner + voice-pattern assertions. Decides mock-vs-real strategy per prompt category. Adds to CI as advisory job.
- **agents** · Arcturus (opus — prompt design is high-leverage), Algol (sonnet)
- **model tier** · Arcturus opus, Algol sonnet
- **depends-on** · PRD-05 NETRA shipped with stable system prompt + tool defs
- **blocks** · Phase 3 rollout completion
- **output artifact** · eval prompt set; runner; CI job; `docs/qa/netra-voice-eval.md`
- **acceptance** · 10+ prompts evaluated; voice-pattern assertions cover lowercase-italic register, refusal taxonomy, no second-person imperatives, terse-line cadence; first run establishes a baseline that becomes the regression target

---

## C.10 non-goals of this scope doc

- Do not specify which assertions each spec contains — Algol writes those at TASK dispatch.
- Do not specify the exact YAML of `e2e.yml` — Canopus writes that at TASK-EE1.
- Do not retire any existing rail. The 5 current rails stay; we add a 6th.
- Do not redesign the test pyramid retroactively for existing component/unit gaps — that is its own TASK (Algol-led, separate from this E2E plan).
- Do not commit to firefox/webkit in v1.
- Do not commit to real-API NETRA tests in CI for v1 (cost + flake).

---

## C.11 risks Polaris is watching

1. **Three.js render flake.** WebGL output is not deterministic across GPU/driver in CI. Mitigation: SSIM threshold (not per-pixel), single fixed CI runner image, capture Globe in a known-paused state via the probe before snapshot.
2. **Build time on every PR.** `pnpm build` for a content-heavy site is slow. Mitigation: fixture content is small (5 articles, 1 roll, 3 fiction); production build of fixtures is <90s on the GitHub runner.
3. **NETRA mock drift.** Recorded SSE streams become stale if Arcturus changes the system prompt. Mitigation: TASK-EE5 includes a manually-triggered "refresh-recordings" job that hits the real API and overwrites fixtures, gated behind a maintainer label.
4. **Probe leakage.** `window.__worldlineProbe__` must not ship to production. Algol audit rail (TS) enforces: any reference to `__worldlineProbe__` outside `WL_TEST_MODE` guard fails CI.
5. **Baseline churn.** Visual baselines grow with feature work. Mitigation: baselines live under `.claude/visual-baselines/**` (git LFS candidate if blob size grows past 50MB; Canopus monitors).

---

*polaris · α-OPS-00 · instance C · DEV-PLAN-2026-05-15 section C · E2E pipeline scope · for refinement at TASK dispatch by Algol + Canopus*
