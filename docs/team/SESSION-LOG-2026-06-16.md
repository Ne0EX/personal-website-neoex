# Session log — 2026-06-15 → 06-16 · store-as-source live-test bugfix sprint

Branch `genesis/store-as-source`. Peat live-testing the console/upload/globe after the
store-as-source cutover; Polaris orchestrating fix workflows (ultracode on). Spans two
days (date rolled mid-session). All work committed on the branch; push stays Peat's.

## Set out to do
Fix the bugs Peat hit while using the real console + globe, and make iPhone-HEIC
uploads work. No new features — polish + correctness until he's comfortable adding content.

## What happened (in order — STATUS #12–#16)

1. **#12 back-from-/archive content vanished + NeX globe rotation** (`86e94c4`, `581b542`, `a7c1d31`).
   - ChapterIndex cards were SSR-baked `opacity-0` + revealed only by an anime.js effect; on
     back-forward nav the effect didn't complete → cards stuck invisible. Fix: cards default-visible,
     fade is pure progressive enhancement; reduced-motion sets opacity:1 (`af89334`).
   - **NeX rotation — fixed the WRONG code path first** (`581b542` = idle auto-rotation) and a verify
     "passed" it by checking the sign MATH, never dragging → false green. Peat re-tested by dragging:
     still reversed. Real bug = the DRAG handler (nex orbits the camera +θ while all/neo rotate the
     globe +θ → opposite apparent motion). Fix: negate the nex orbit angle (`a7c1d31`); verified by
     ACTUALLY dragging (chrome-devtools, numeric before/after). → lesson `feedback_verify_coverage_asymmetry`.

2. **#13 RAF console upload "หาย"** (`cc5c9c6` + 17-orphan sweep). Reproduced the real browser RAF
   upload (the path never actually tested — only the service-role script had been). The upload
   SUCCEEDS server-side; "หาย" = the new node never appeared because `ConsoleApp` inits
   `useState(initialNodes)` and React ignores the post-`revalidatePath` RSC payload. Fix: an
   `onUploadSuccess` callback → `setNodes` (client-state, no reload). Swept 17 orphan originals
   (accumulated QA test uploads) via `scripts/sweep-storage-orphans.ts`. Killed stray :3193 dev server.

3. **#14 SELF-INFLICTED OUTAGE — Tailwind/codegraph-socket build error** (`5f2d229`→`4dbfca0`).
   While reverting #13 stalled-agent scratch I removed a `@source not "./.codegraph"` guard, judging it
   redundant (".codegraph is gitignored"). WRONG — Turbopack's Tailwind scan reads the codegraph Unix
   socket as text → binary garbage → CSS parse fail. Plus the running dev server was serving a STALE
   `.next` cache (byte-identical error across restarts, "stale" banner). Final fix: `@import
   "tailwindcss" source(none)` + allowlist `../app`,`../components` (the only dirs with classes) —
   structurally can't scan the socket; verified via standalone `@tailwindcss/postcss` AND in real
   Turbopack after a `.next` cache-clear + restart (Peat-authorised kill). → updated memory
   `reference_codegraph_socket_tailwind_panic`.

4. **#15 HEIC (HEVC) support + visible upload failures** (`478ff31`, `5622691`). iPhone HEICs are
   HEVC-encoded; sharp's libheif has AV1 but no HEVC decoder (#5's "HEIC works" used an AV1 file =
   false confidence). Reproduced exactly on `~/Downloads/IMG_7481.HEIC`, proved `heic-convert` (WASM
   libheif WITH HEVC) decodes it before recommending. Peat chose server-side heic-convert. Ingest now
   routes HEIC/HEIF → heic-convert→JPEG → sharp variants; `HEIC_DECODE_FAILED` + rollback on failure.
   QuickUploadBar no longer auto-collapses when a batch has a failure → failures stay legible (the real
   "หาย" mechanism for FAILED uploads). **Proven on Peat's machine** (terminal: decoded to JPEG → POST
   200 → node IMG_7481 appeared).

5. **#16 console KIND filter + search** (`10b5bd0`). The rail mapped the full `nodes`; `activeFilter`
   only styled the pill. Now filters by kind + query (mirrors `ConsoleCanvas.matchesQuery`) with a live
   count + empty-state. Peat-checked OK.

6. **0 vulnerabilities** (`0ce4c7a`). `npm install heic-convert` surfaced 7 audit vulns — all
   dev/build-time transitive, production NOT exploitable; `--force` would downgrade Next 16→9 (rejected).
   Removed unused `velite` + `gray-matter` (store-as-source/DL7 made them dead) + `overrides.postcss
   ^8.5.10` → `npm audit` = **0**. **Blast-radius miss:** removing velite also dropped `@mdx-js/mdx`
   (127 packages removed) which `lib/store/mdx.tsx` imports directly (`evaluate()` for DB MDX bodies) →
   tsc broke; re-added `@mdx-js/mdx ^3.1.1` as a direct dep. → lesson `feedback_dep_removal_blast_radius`.

## Key decisions (who)
- HEIC approach = **server-side heic-convert** (Peat, AskUserQuestion) over client-convert / reject.
- Vuln approach = **remove dead deps + postcss override**, never `--force` (Polaris, Peat-ran the gated npm).
- NeX/back-nav/filter fixes = mechanical, Polaris-orchestrated.

## Self-inflicted (named, for honesty)
- NeX fix on the wrong code path + analytical-only verify (false green) — caught by Peat dragging.
- Reverted a load-bearing codegraph guard → build outage — recovered, guard now committed permanently.
- velite removal blast radius (@mdx-js/mdx) — recovered with one re-install.
All three → memories so they don't recur.

## Lessons → memory (this session)
- `feedback_verify_coverage_asymmetry` (updated) — interaction bugs must be verified by performing the
  interaction; fix the path the USER touches, not an adjacent one.
- `reference_next16_single_dev_lock` (new) — Next16/Turbopack locks one dev server per dir; QA agents
  can't boot a parallel `next dev`; the 43MB-RAF verify stalled because agents /tmp-copied to get one.
- `reference_codegraph_socket_tailwind_panic` (updated) — gitignore ≠ Turbopack scan-exclude; use
  `source(none)`+allowlist; clear `.next` + restart is the reliable clear; don't revert a load-bearing guard.
- `feedback_dep_removal_blast_radius` (new) — "unused" dep can transitively provide a package the app
  imports directly; "N packages removed" = run tsc immediately; npm-audit-0 ≠ app-builds.

## Ground truth at close
`git status` tracked tree clean. `tsc --noEmit` = 0. `npm audit` = 0 vulnerabilities. DB baseline
entries=13 / photo_assets=8 / places=5 / alpha=Bangkok (sacred slugs intact; HEIC IMG_7481 + RAF
DSCF0835 are Peat's real uploads). Dev server :3000 handed back to Peat (his terminal).

## Parked / handoff (Peat-seam)
- **Vercel deploy** + **photo originals backfill** (held-pending, block_until 2026-06-26). Migrated
  photos DSCF0002-0005/0344 show "AWAITING IMAGE" until originals land.
- Flagged team debts carry `must_close_by` dates in STATUS (film-sim preview cosmetic, test-delete-b2.ts,
  RAW-43MB-verify-stall, vuln-velite-analysis CLOSED).
- Scheduled cloud routine fires 2026-06-19 to audit flagged items (needs branch pushed to origin).
- **Peat will return with a content-usage summary** ("ลง content … แล้วมาสรุปว่าต้องทำอะไรเพิ่ม") — next
  session picks up from his real-use feedback.
