# SESSION LOG · 2026-06-06 — photo-route dev panic (codegraph socket) → fix + capture

> Narrative companion to STATUS.md (per-task ledger). Read this first for the arc. Casual debug session, not a GENESIS TASK.

## What we set out to do
Peat: "ผมรัน npm run build ไม่ผ่านอ่ะ" → then "แล้วผมจะเปิด localhost มาดูไงอ่ะ" → then "เวลาเข้าหน้าที่มีรูปมักจะเข้าไม่ได้" (Runtime Error screenshot). A walk-in support session: get the site running locally and fix the photo routes.

## The arc
1. **"Build ไม่ผ่าน" was a false alarm.** Ran `npm run build` twice — it PASSED both times (velite → next build → pagefind, 17/17 static pages, TypeScript clean, exit 0). Couldn't reproduce a failure. The confusion was conceptual: `npm run build` compiles then **exits to the prompt** (no server) — Peat read "dropped back to the shell" as a crash. Clarified build (compile-and-exit) vs **`npm run dev`** (serves localhost:3000).
2. **Started `next dev`** in the background → localhost:3000 ready. (curl smoke-test was gate-blocked — by-design; used build's 17/17 prerender + the browser MCP as proof instead.)
3. **The real bug surfaced** — photo routes showed "An unexpected Turbopack error occurred — see `next dev`". The browser overlay is generic; the REAL panic was a FATAL block in the dev-server log with a **URL-encoded** Turbopack panic.
4. **Decoded the panic → root cause** (systematic-debugging, evidence before fix): Tailwind v4 (`@tailwindcss/postcss`) source-scan, while processing `components/PhotoEntry.palette.css`, walked into `.codegraph/` and tried to `read()` **`.codegraph/daemon.sock`** — a **Unix socket** (confirmed mode `srw-------`, codegraph daemon) — as a file → **`os error 102` (ENOTSUP)** → Turbopack panic → `/photos/[roll]/[id]` 500. Confirmed `.codegraph/` was NOT root-gitignored (`??`) and the nested `.codegraph/.gitignore` doesn't cover the socket. **`next build` passed throughout** (different read path) — that divergence was the tell. NOT a code bug.
5. **Fix = one line:** gitignore `/.codegraph/` at the repo root (with a load-bearing comment) → Tailwind v4 skips gitignored paths → never reads the socket. Correct hygiene anyway (per-machine local index + daemon + socket).
6. **Verified to ground truth, false-green-guarded** (advisor-flagged): confirmed the socket was STILL PRESENT at test time (daemon up — else a green proves nothing) → restarted `next dev` (Turbopack won't re-read .gitignore live) → drove `/photos/2026-04-chiang-mai/DSCF0001` via the Playwright MCP → **HTTP 200, page renders fully (film-sim switcher / NETRA / footer), console errors 0, NO FATAL in the dev log.** Screenshot looked at, not just status-checked.
7. **Captured** — memory + a new G10 in `worldline-build-verify` + the `dev-route-panic-diagnose` workflow + this log.

## Key decisions (who decided)
- **Peat:** capture today as a skill + a workflow + "update per policy" (this close-session ritual).
- **Polaris (advisor-confirmed):** fix at the gitignore layer (not `@source not` — that's the fallback; not moving the socket — out of scope); extend `worldline-build-verify` with G10 rather than duplicate; keep the workflow read-only (apply/verify in the main loop, not in-workflow where the gate blocks); the socket-in-tree detector = HOOK CANDIDATE for Canopus, noted-not-built (honors the skill+hook standing rule without scope-creep).

## Shipped (working tree — commit gated on Peat's branch call, see below)
- `.gitignore` +5 lines: `/.codegraph/` ignore with a load-bearing comment. **Already active on disk** (the fix works now without a commit; the commit is for durability).
- `.claude/skills/worldline-build-verify/SKILL.md`: **G10** (non-source files in the scanned tree → Turbopack panic; decode-the-dev-log diagnostic; build≠dev) + 2026-06-06 run-log entry. (gitignored — local tooling)
- `.claude/workflows/dev-route-panic-diagnose.js`: read-only diagnostic workflow, parameterized by `{route, symptom}`. (gitignored — local tooling)
- Memory `reference-codegraph-socket-tailwind-panic` + MEMORY.md index line.

## Parked / open
- **COMMIT — Peat-seam (branch base):** the `.gitignore` fix is tooling-hygiene → **not main** (web-only; main's lean .gitignore doesn't even carry these blocks) and **not** the zero-trust working branch (unrelated — "แยก branch ให้ดี"). Recommended: a dedicated branch off the tooling base (`genesis/orchestration-foundations`). Surfaced to Peat as the one narrow decision; push stays Peat's.
- **Canopus (hook candidate):** a non-regular-file-in-tree detector (socket/FIFO under repo root not gitignored → warn) pairs with G10. Mechanically detectable; not built this session. No date — backlog candidate, raise at next harness pass.
- **Stray `next dev`** (`btsmqosth`) left RUNNING on :3000 so Peat can keep browsing (against G1's "no stray dev" by intent, not oversight). Stop it with TaskStop / Ctrl-C when done.
