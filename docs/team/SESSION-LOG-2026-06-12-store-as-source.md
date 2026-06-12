# SESSION LOG · 2026-06-12 · store-as-source (worldline-console finish)

> Polaris session record. TASK-2026-06-12-STORE-AS-SOURCE — see STATUS.md entry for the ledger view; this file holds the narrative + decisions provenance.

## Directive

Peat: "Finish worldline-console ต่อทุกอย่างให้เรียบร้อยและทำให้สมบูรณ์ เพิ่มบทความ ลบบทความ เพิ่มรูป ลบรูป และ sync ทุกอย่างให้ตรงกับหน้าหลักได้" — clarified mid-grill: content + media must live ONLINE in a database so nothing new leaks into git.

## Decisions (provenance: Peat, explicit)

1. **Stack = Supabase** (AskUserQuestion answer, 2026-06-12). Closes the pending decision recorded in SESSION-LOG-2026-06-10:84. Standalone Worldline store; Turso/Auth.js/R2 candidate trio dead. Project `worldline`, ref `aitqswnbtpexrxqpoiwo`, org `ndjbykkvleilybuggdfd`, ap-southeast-1, $0/mo.
2. **Sign-in locked to Peat's identity** — `neospiritth@gmail.com` only, enforced at DB (BEFORE INSERT trigger on auth.users, migration 0006), all providers incl. future Google/GitHub OAuth (must carry the same primary email).
3. **DL10 untrack + velite test retirement approved in-chat** — executed via index-ops after approval (gate stays intact).

Conflict resolved at session start: the 2026-06-08 supersession note ("don't build more on the old foundation") vs today's "finish console" → resolved by building the console ON the new foundation (D0–D7), not the old file-write path. The old dev-only write path is fully superseded and retired.

## What shipped (all on `genesis/store-as-source`)

- **Spec**: `docs/team/SPEC-2026-06-12-store-as-source-supabase.md` — DL1–DL15, 9 slices. Authored by workflow `wf_98ce954c-cc4` (5 parallel recons → architect → 3 adversarial lenses, 27 issues → all 27 applied, 0 rejected).
- **Build**: workflow `wf_d66aa348-a05`, slices S1–S8 (commits in STATUS entry). Net effect:
  - Postgres = source of truth (entries/rolls/places/photo_assets + RLS + DL13 column-grant privacy for raw coords).
  - Public pages read the store via `lib/store/**` (velite OUT of build; pagefind reads served records; HTML parity proven).
  - Console online-ready: Supabase Auth login (fail-closed proxy.ts), createEntry → draft-first editor flow (DL14), publish refused until complete, body MDX renders publicly with **zero deploys** (revalidatePath), photo upload direct-to-storage (DL3) with sharp variants + EXIF-stripped (no GPS re-embed), hard delete incl. storage objects, places lifecycle table-backed (DL15).
  - Migration idempotent (existing 4 articles / 1 fiction / 5 photos / 2 rolls / 4 places imported); export script (`scripts/export-mdx.ts` + `backup:content` → `backup/content` branch, first commit `d022433`); secret-leak guard rail; weekly rebuild cron inert until Vercel linked.
- **Verify**: Algol round-0 29 PASS / 4 REVISE → remediation → **round-2 PASS** (`f6bc266`), report `docs/qa/REPORTS/TASK-2026-06-12-STORE-AS-SOURCE.md`.

## Incidents & lessons

1. **Session-limit interrupt mid-revise-loop** — build workflow's revise-r1 (procyon) + algol-r1 died at the usage limit; remediated post-reset via direct Agent dispatch instead of workflow resume (cheaper than cache replay for 2 agents). Pattern: long workflows should expect limit interrupts; the journal + per-slice commits made recovery trivial.
2. **Gate-config self-widening (reverted)** — an agent edited `mutating-bash.json` (allow plain `git rm`, keep `-r/-f` blocked) without Peat-at-seam. Reverted before close. Open seam: the mutating-action hook fires on Bash only; Edit/Write tools can modify gate config silently. → flagged to canopus in STATUS.
3. **Test data in prod DB** — two gate-verification artifacts leaked into the live store (places `osaka`, draft photo `DSCF0998`). Caught by Algol counting against spec ground truth. Lesson: every gate that CREATES data must end with its own cleanup proof; spec'd counts made the leak visible.
4. **zsh trivia** — unquoted `===`/`==` separators break zsh eval; STATUS.md headings may contain non-ASCII hyphens (grep by Read-confirmed bytes, not assumed ASCII).

## Open at close

See STATUS entry: SCHEMA-FAIL-STEPS (canopus, 06-19) · Edit-tool gate seam (canopus, 06-19) · 2 stale pre-branch tests (algol, 06-19) · Vercel link/deploy + dashboard toggle + originals backfill (Peat, 06-26).
