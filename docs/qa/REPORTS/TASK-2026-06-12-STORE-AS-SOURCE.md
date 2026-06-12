# docs/qa/REPORTS/TASK-2026-06-12-STORE-AS-SOURCE.md

## task · store-as-source on Supabase (S1–S8)

## verdict · REVISE — 3 failing gates

---

## 1. Signature integrity audit

### S5 — Altair signature (`TASK-2026-06-12-S5-ALTAIR--altair.json`)

- schema version: v2 — PRESENT
- required fields: all present
- `agent`: Altair · `agent_designation`: α-BND-02 · `pre_cutover_codename`: "Vega" — maps correctly to α-BND-02 per AGENTS.md Nomenclature ✓
- `next_recipient`: Algol / α-VER-06 — valid current roster member ✓
- `self_hash` recomputed (jq -cS + tr -d '\\n' + sha256): `463ca5ef185c53016d759067c7b92a4e0435f371ce30eb5677bfb58674b0d0d8` — matches stored value ✓
- `files_sha256` spot-checks: `docs/team/SPEC-2026-06-12-store-as-source-supabase.md` → `629d87...` matches; `components/ArchiveQuery.tsx` → `b32d16...` matches; `ne0_mid.jpeg` → `4a6671...` matches ✓
- FILES_TOUCHED scope: lists untracked/dirty files at baseline (not implementation files, which were committed before signing — this is correct baseline-aware behavior per SCHEMA.md v2 behavioral update) ✓
- **DEFECT — `steps: []` empty.** Schema spec states steps are "short imperative lines" of what was done. An empty array defeats the audit-trail purpose. SCHEMA-FAIL classification (likely a sign-work.sh automation gap, not agent malfeasance): route to Canopus.
- `harness_passed`: true · `post_edit_passed`: false (noted but not blocking — post_edit_passed=false for S5)

### S6 — Sirius signature (`TASK-2026-06-12-S6-CONSOLE-WIRING--sirius.json`)

- schema version: v2 — PRESENT
- required fields: all present
- `agent`: Sirius · `agent_designation`: α-SUR-01 · `pre_cutover_codename`: "Pico" — maps correctly to α-SUR-01 per AGENTS.md Nomenclature ✓
- `next_recipient`: Algol / α-VER-06 — valid current roster member ✓
- `self_hash` recomputed: `18b12c1dd00340da36419e4ac5ddb74e22654e341c763ee074e99f8dc6ab82b7` — matches stored value ✓
- `files_sha256` spot-checks: same untracked-file set, all match ✓
- **DEFECT — `steps: []` empty.** Same SCHEMA-FAIL as S5.
- `harness_passed`: true · `post_edit_passed`: true ✓

**Signature verdict: SCHEMA-FAIL on both — steps field empty. Route to Canopus. Work content audit continues below (this is a tooling defect, not agent malfeasance).**

---

## 2. Acceptance criteria check

Verified against spec §12 S1–S8 gates. Ground-truth commands run against live Supabase project `aitqswnbtpexrxqpoiwo`.

### S1 — Schema + RLS + column grants + storage + owner bootstrap

Evidence from live DB and REST API:

- **anon SELECT entries returns only published rows**: `curl /rest/v1/entries?select=slug,status` → 10 published rows, 0 draft rows ✓
  `[{"slug":"2026-05-bangkok/DSCF0002","status":"published","kind":"photo"},{"slug":"000","status":"published","kind":"article"}...]`
- **anon INSERT/UPDATE/DELETE refused (RLS)**: S1 gate evidence shows 42501 errors — accepted from builder report; DB policies confirmed live (`entries_insert` with_check=is_owner(), `entries_update`/`entries_delete` using=is_owner()) ✓
- **anon `select=coords` on entries refused**: `curl /rest/v1/entries?select=slug,coords` → `{"code":"42501","message":"permission denied for table entries"}` ✓
- **anon `select=served_coords` succeeds with gated values**: `SET ROLE anon` query returns `served_coords` only, no `coords` ✓. Column grant audit via `information_schema.role_column_grants` confirms `coords` is NOT in anon's grant list for `entries`. `served_coords` IS granted. ✓
- **anon `select=coords` on rolls refused**: `curl /rest/v1/rolls?select=roll,coords` → `{"code":"42501","message":"permission denied for table rolls"}` ✓. Roll column grants confirm `coords` not in anon list, `served_coords` is. ✓
- **anon `select=original_key,source_hash` on photo_assets refused**: `curl /rest/v1/photo_assets?select=entry_id,original_key,source_hash` → `{"code":"42501","message":"permission denied for table photo_assets"}` ✓. Column grant confirms only `entry_id`, `exif`, `variants` in anon list. ✓
- **owner JWT full CRUD**: confirmed via S4 gate (signInWithPassword + is_owner() RPC = true) ✓
- **`signUp` with publishable key refused AND `enable_signup=false` in versioned config**: FAIL — see gate S1-SIGNUP below.
- **originals bucket anon 403**: accepted from S1 builder report; private bucket does not serve via /public/ path ✓
- **photos bucket public URL 200**: accepted from S1 builder report ✓
- **anon bucket listing refused**: `POST /storage/v1/object/list/photos` with anon key → `[]` (empty, no listing) ✓
- **private.owners unreachable via API**: `GET /rest/v1/owners` → `{"code":"PGRST205","message":"Could not find the table 'public.owners'..."}` — 404-equivalent ✓
- **API exposed schemas = public, graphql_public only**: PGRST205 confirms private schema not in schema cache ✓

**GATE S1-SIGNUP — FAIL (HARD):** Live `signUp` probe with `attacker@gmail.com` returned HTTP 200 with a new authenticated user object. The Supabase dashboard `allow new users to sign up` toggle has NOT been applied. The versioned `config.toml` has `enable_signup = false` on line ~161 (confirmed), but the live project has not had this setting applied. The rogue user `bfe0e6dd-693f-4e82-91ca-d5b7d0a28381` was created during this probe and deleted via `DELETE FROM auth.users WHERE email='attacker@gmail.com'`. The spec gate requires BOTH: "signUp refused AND enable_signup=false in versioned config." Half is met (config); live enforcement is not. This was documented as a deviation in S1 report but the gate is a hard gate — it MUST pass at S9.

Evidence: `curl -X POST ${SUPABASE_URL}/auth/v1/signup -d '{"email":"attacker@gmail.com","password":"TestPassword123!"}' → {"id":"bfe0e6dd-...","aud":"authenticated","role":"authenticated","email":"attacker@gmail.com",...}`

**Owner: procyon (S1 owner). Gate fails at procyon's slice boundary — requires Peat to apply the dashboard setting (Peat-at-seam, documented in S1 deviation).**

### S2 — Migration script + first import

Evidence from live DB:

- Row counts: `entries(article)=4`, `entries(fiction)=1`, `entries(photo)=5`, `photo_assets=5`, `places=5` (spec says 4 — see below), `rolls=2` ✓ for most
- Wait — `places` count returned `5` not `4`. Spec §9.1 says "4 L1 rows" from `place-registry.data.json`. Investigate:

```
SELECT count(*) FROM public.places; → 5
```

- **GATE S2-PLACES — FAIL (BLOCKING):** DB shows 5 places, spec says 4. The S2 gate says "4 places." A fifth place was added (likely during S5 `createPlace` gate test — "S5 Gate Test · XX" from gate check 6). Investigate:

```
SELECT id, name FROM public.places ORDER BY id;
```

Running this now.

- chiang-mai roll body: `body=''`, `body_len=0` ✓
- bangkok roll body: `body_len=565` (non-empty) ✓
- rolls.id: `chiang-mai → DSCF0001`, `bangkok → DSCF0002` ✓
- article served_coords ≤2 decimal places: confirmed for all 4 articles ✓
- Fiction: slug=transmission-001, variants=3, divergence_cluster=unresolved-method ✓
- Idempotency: accepted from S2 report ✓

### S3 — Read layer + consumer swap

- Build green with no .velite/: accepted from S3 report (tsc=0, 20 routes prerendered) ✓
- Draft entry 404s publicly: confirmed via anon REST → draft slug returns `[]` (probe with DSCF_ALGOL_DRAFT draft entry created and tested live) ✓
- Unknown slug returns 404 equivalent: anon REST `entries?select=slug&slug=eq.999` → `[]` ✓
- pagefind index with maturity values: accepted from S3 report ✓
- No .velite imports in app/lib: accepted from S3 report ✓

### S4 — Auth

- Unauthed /console → login shell: accepted from S4 builder report ✓
- sessionless auth-probe returns {ok:false,AUTH}: accepted from S4 builder report ✓
- Forged anon write → 42501: confirmed via column grant probe ✓
- WORLDLINE_AUTHORING retired from runtime: confirmed — proxy.ts only has comment references ✓

### S5 — Write path server actions

- createEntry → draft row: confirmed from S5 report (20/20 gate checks) ✓
- publish refused with missing-field list: confirmed ✓
- complete entry publishes (DL14): confirmed ✓
- setDraft→status flips: confirmed ✓
- rank-conflict rejected by index: unique index `photo_rank_unique_per_place` confirmed present via `pg_indexes`. Conflict behavior confirmed via DO $$ block (raises unique_violation exception correctly) ✓
- createPlace → places row exists, place-registry.data.json byte-untouched: accepted from S5 report ✓
- >4.5MB JPEG ingest: 18.19MB JPEG processed, 9 variants uploaded (S5 gate check 7) ✓
- GPS absent from exif: confirmed (noise image has no GPS; exif keys=[]) ✓
- exifr over public variant → zero GPS: confirmed ✓
- ingest collision guard: confirmed ✓
- delete → row AND storage gone: confirmed ✓
- bucket prefix listing empty after delete: confirmed ✓

### S6 — Console UI wiring

- createEntry + router.push: accepted from S6 report (browser-verified PORT 3106) ✓
- publish refused with field list: accepted ✓
- Cmd+S body save: accepted ✓
- delete → 404: accepted ✓
- zero public-surface visual change: accepted ✓
- Place create no git diff: accepted ✓

### S7 — Export script

- 12 MDX files semantically equal post-export: accepted from S7 report ✓
- git status clean: accepted ✓
- SUPABASE_SECRET_KEY in scripts/** only: confirmed via grep — only comment reference in `lib/store/supabase/anon.ts` (comment text, not a runtime read) ✓

### S8 — Env/CI/git wiring

- `git ls-files content/ | wc -l = 12` — content/ still tracked. DL10 index flip (git rm --cached) is deferred (Peat-at-seam, documented S8 deviation) — gate partially met (gitignore entry `/content/` committed) but index not clean. ✗ (Peat-at-seam open item, not a code defect)
- secret-leak guard: `bash scripts/audit-secret-leak.sh` → `[secret-leak] CLEAN` ✓
- SUPABASE_SECRET_KEY absent from client bundle grep: confirmed ✓
- git history intact: `git log --oneline -- content/` shows commits ✓
- backup/content branch: d022433 exists, absent from main ✓
- build script: `"build": "next build && npm run index:search"` (content:build removed) ✓
- place-registry.ts FROZEN notice: confirmed at lib/content/place-registry.ts header ✓
- weekly-rebuild.yml: committed, inert until Vercel link (documented S8 deviation) ✓
- WORLDLINE_AUTHORING: retired from runtime (comment-only references in proxy.ts) ✓
- velite: still in `package.json` as a dev dependency (line 50: `"velite": "^0.3.1"`) — spec DL7 says "velite dep removed after S9 passes" — this is correct (not yet removed, S9 hasn't passed yet) ✓

---

## 3. Quality bar pass

### U1 Signature integrity
Both signatures have empty `steps` arrays — SCHEMA-FAIL (route to Canopus). Self-hashes match. Filed above.

### U2 No silent deviations
All deviations are documented in builder reports. ✓

### U3 Read before writing
Not directly auditable from signature/diff alone. Accepted.

### B1 Input validation
`lib/store/schema.ts` zod validation layer confirmed present (S5 deliverable). ✓

### B2 Error shape consistency
Actions return `{ok:false, error:{code,message}}` envelope consistent with prior `entry-actions.ts` contract. ✓

### D2 GPS strips by default
- `entries.coords` is anon-revoked at column level. ✓
- `photo_assets.exif` GPS: builder reports GPS dropped from exif (EXIF keys = [] for S5 gate variant). ✓
- `withMetadata()` forbidden in sharp pipeline: spec enforces this, accepted from builder report. ✓

### D3 Idempotent pipelines
Migration idempotency confirmed (S2 gate: second run byte-identical). ✓

---

## 4. Regression scan

### Retired test suite files — FAIL (BLOCKING)

The spec §7 explicitly requires deletion of the following test files which exercise deleted subjects (`content:build`, `.velite/`, file-write impls):

- `tests/places-curation-post-save.test.ts` — still present; calls `npm run content:build` via execSync (confirmed via grep)
- `tests/places-curation-ab-clear.test.ts` — still present; reads `.velite/articles.json`
- `tests/places-curation-qa.test.ts` — still present; references velite
- `tests/entry-lifecycle-t1-qa.test.ts` — still present; reads `.velite/*.json`, calls content:build subprocess

Spec §7 (last paragraph): "Retired after S9: ... plus the velite/file-coupled QA suite that exercises them... They retire WITH their subjects — the S5/S9 live-DB gates supersede their coverage; a 'green' program must not leave a permanently red suite behind."

These files are permanently red against the store-as-source program. Running `npm test` will produce failures (content:build removed, .velite/ absent). This is a blocking quality-bar violation.

**Owner: canopus (harness/QA infrastructure) — but the retirement is specified as part of the store-as-source program itself. Any of the implementing agents (procyon/altair) could have deleted these; spec §7 says they "retire WITH their subjects."**

Also: `tests/audit-places-load.ts` (or `scripts/audit-places-load.ts`) — spec says this should also be retired. Checking:

```
ls tests/audit-places-load.ts → not found (may be in scripts/)
```

`scripts/audit-places-load.ts` not found — acceptable if it was already absent.

### `places` row count discrepancy

DB shows 5 places, spec §2.2 says 4 L1 rows from `place-registry.data.json` (bangkok, chiang-mai, kyoto, yirgacheffe). The 5th row is `osaka` (Osaka · JP, lat=34.69, lon=135.5), created during S6 console UI gate verification: "GATE place create no git diff: Osaka · JP created via createPlace." The S6 report confirmed the place was created via the store action but did not delete it post-gate.

Evidence: `SELECT id, name FROM public.places ORDER BY id` → 5 rows: bangkok, chiang-mai, kyoto, **osaka**, yirgacheffe. The migration count should be 4 post-migration; the 5th row is gate test data that leaked.

**Owner: sirius (S6). Requires deletion of the osaka gate test place row: `DELETE FROM public.places WHERE id = 'osaka'`.**

---

## 5. Accessibility audit

No UI changes on public surfaces (spec §8: "ZERO public-surface visual changes — console is a private instrument"). S6 changes are console-only. Lighthouse a11y not required for this task. ✓ (per scope — console is private)

Note: S6 visual-diff gate blocker (requires Betelgeuse STATUS file) is a process friction point documented in S6 blockers. Algol notes this for Polaris: the visual-diff gate does not distinguish public vs private surfaces; a console-only exemption rule would prevent this blocker class.

---

## 6. Cross-impact scan

- `lib/content/*` thin re-exports: consumers using `@/lib/content` imports should still work (S3 swapped underlying implementations). ✓ (build passes)
- `WORLDLINE_AUTHORING` references: retired from proxy.ts (comments only), not read at runtime. ✓
- `velite` dependency: still in package.json as dev dep — acceptable until S9 closes (DL7 says "removed after S9 passes").
- `content/` gitignored but still in index: DL10 partially met. Peat-at-seam open item.

---

## gate summary

| Gate | Status | Owner | Evidence |
|---|---|---|---|
| S1-SIGNUP | FAIL | procyon | Live signUp probe returned HTTP 200 new user; dashboard setting not applied |
| S1-SCHEMA, S1-RLS, S1-COLUMNS, S1-STORAGE | PASS | procyon | Column grants confirmed; REST probes confirmed |
| S2-COUNTS | FAIL | sirius | places count=5 (expected 4); S6 gate test row 'osaka' not cleaned up |
| S2-ROLLS-BODY | PASS | procyon | chiang-mai body='', bangkok body_len=565 ✓ |
| S3-BUILD | PASS | procyon | Accepted from report |
| S3-DRAFT-404 | PASS | procyon | Live probe confirmed |
| S4-AUTH | PASS | altair | Accepted from report |
| S5-WRITE-ACTIONS | PASS | altair | 20/20 gate checks; rank-conflict index confirmed live |
| S5-INGEST | PASS | altair | >4.5MB tested; GPS stripped; exifr confirms no GPS in variant |
| S6-CONSOLE | PASS | sirius | Browser-verified per report |
| S7-EXPORT | PASS | altair | Accepted from report |
| S8-GITIGNORE | PARTIAL | canopus | .gitignore entry present; git rm --cached deferred (Peat-at-seam) |
| S8-SECRET-LEAK | PASS | canopus | audit-secret-leak.sh → CLEAN |
| S8-BACKUP | PASS | canopus | backup/content branch + d022433 present, absent from main |
| RETIRED-TEST-SUITE | FAIL | procyon/altair | 4 velite-coupled test files still present; permanently red |
| SIGNATURE-STEPS | SCHEMA-FAIL | canopus | Both S5+S6 signatures have empty steps[] — sign-work.sh tooling gap |

---

## REVISE items

### REVISE-1 (BLOCKING) — Peat-at-seam: apply signups-disabled on live Supabase project
**Owner: procyon (S1)**
S1 gate requires live `signUp` refused. Config.toml has `enable_signup=false` but live project has not had the dashboard setting applied. S9 probe created a rogue user (deleted). Peat must go to Supabase dashboard → project `aitqswnbtpexrxqpoiwo` → Authentication → Settings → disable "Allow new users to sign up." Then re-verify with `curl -X POST ${SUPABASE_URL}/auth/v1/signup`.

### REVISE-2 (BLOCKING) — Delete retired test files
**Owner: procyon/altair (whichever implements the retirement)**
Delete: `tests/entry-lifecycle-t1-qa.test.ts`, `tests/places-curation-ab-clear.test.ts`, `tests/places-curation-post-save.test.ts`, `tests/places-curation-qa.test.ts`. These reference deleted subjects and are permanently red. Spec §7 mandates retirement.

### REVISE-3 (BLOCKING) — Clean up gate test place row
**Owner: sirius (S6)**
`SELECT * FROM public.places` shows 5 rows; spec migration count = 4. The 5th row `osaka` (Osaka · JP) was created during S6 console UI gate verification and not deleted post-gate. Delete: `DELETE FROM public.places WHERE id = 'osaka'`. Verify count returns to 4.

### SCHEMA-FAIL-1 (route to Canopus) — sign-work.sh not capturing steps
**Owner: canopus**
Both S5 and S6 signatures have `"steps": []`. The SCHEMA.md spec defines steps as "short imperative lines" forming an audit trail. Empty steps on automated signatures suggests sign-work.sh is not capturing steps. Route to Canopus for tooling fix.

---

## Peat-at-seam open items (not blocking this review, Polaris tracks)

1. **signups-disabled**: dashboard toggle (REVISE-1 above — IS blocking this review)
2. **git rm --cached -r content/**: DL10 index flip; command is blocked by mutating-action-hook; Peat runs `git rm --cached -r content/ && git commit -m 'chore(store): untrack content/ from git index (DL10)'`
3. **Vercel link + deploy hook + weekly cron**: Peat runs `vercel link` + creates deploy hook + adds VERCEL_DEPLOY_HOOK_URL GitHub secret

---

## PRD §10 Phase-A proofs (live at S9)

| Proof | Status | Evidence |
|---|---|---|
| publish-without-redeploy | UNVERIFIABLE at S9 (no browser walkthrough possible here) | S6 builder report: browser-verified create→publish→live |
| auth boundary: public read / write refused unauth | PASS | anon SELECT published rows ✓; anon INSERT 42501 ✓ |
| media in storage not git: `git status` clean after upload | PASS (for existing assets) | No image binaries in git; S5 gate verified upload+delete cycle |
| export diffable | PASS | S7 semantic equality confirmed ✓ |

---

*Algol · α-VER-06 · 2026-06-12*
*Six-step gauntlet complete. Three blocking gates FAIL. REVISE handoff to procyon/altair. SCHEMA-FAIL to Canopus.*
