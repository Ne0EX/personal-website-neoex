# Whole-Site QA — Worldline — 2026-06-13

**Program:** Polaris QA program (synth slice)
**Branch:** `genesis/store-as-source`
**HEAD:** `f473785` — `docs(qa): attractor-filter verify — PASS (algol slice)`
**Build:** prebuilt `.next` from Phase Build · BUILD_ID `BaYSYAVwrx2o1eYrJnrfV` (2026-06-13 14:24) · 13 app routes in manifest · `tsc --noEmit` exit 0
**Phase 0:** PASS — port 3000 clear, git tree clean (only untracked tooling/harness/probe artifacts; all source committed)

This report merges six dimension sweeps plus an independent adversarial-verify pass into one whole-site verdict. Each broken finding listed below was independently re-derived by the adversarial verifier from source/SQL ground truth — none is a test artifact, accepted state, or soul-by-design.

---

## 1 · Per-surface summary

| Surface | Findings | works | intentional-inert | data-gap | needs-peat | env | broken | Verdict |
|---|---|---|---|---|---|---|---|---|
| Public home + globe | 24 | 17 | 2 | 1 | 0 | 3 | **1** | ISSUES (1 degrades) |
| Public archive + search | 29 | 27 | 0 | 0 | 2 | 0 | 0 | CLEAN (2 needs-peat cosmetic) |
| Public content + 404 | 18 | 12 | 2 | 4 | 0 | 0 | 0 | CLEAN |
| Security / RLS / storage / privacy | 16 | 14 | 0 | 0 | 1 | 0 | **1** | ISSUES (1 degrades + 1 needs-peat) |
| Code integrity | 7 | 4 | 2 | 0 | 0 | 0 | **1** | ISSUES (1 cosmetic) |
| Console write-lifecycle | 24 | 22 | 0 | 0 | 0 | 0 | **2** | ISSUES (2 degrade) |
| **TOTAL** | **118** | **96** | **6** | **5** | **3** | **3** | **5** | **ISSUES** |

---

## 2 · Counts per verdict

| Verdict | Count | Meaning |
|---|---|---|
| works | 96 | Verified functional against prebuilt production output / live DB / source. |
| intentional-inert | 6 | Deliberately un-wired at this stage (exploration-not-exhibition shell, empty attractor pills, no `/photos` index, PRE-STORE frame nav). Not bugs. |
| data-gap | 5 | Foundation present, content/edges/plugins not authored yet (H2 heading IDs, pullquotes, WorldlineLinks 0-edge, Bangkok highlights, chiang-mai 0-frame roll). Not bugs. |
| needs-peat | 3 | Cannot be settled by automation alone — a Peat decision or a manual browser confirm. |
| env | 3 | Pre-branch documented-red tests + runner-format mismatch. Not regressions. |
| **broken** | **5** | **Confirmed defects.** 4 degrade behavior, 1 cosmetic hygiene. |

**Regression check:** zero regressions introduced beyond the items below. The 2 documented-red tests (`console-gate-contract`, `worldline-globe-coordinates`) are pre-branch and unchanged (66 pass / 2 fail = the documented pair). Lighthouse a11y 100/100 desktop + mobile on `/archive`. No console errors across home, archive, content, or the Triangulate lifecycle.

---

## 3 · Prioritized open issues (confirmed-broken first)

Ordered: degrades before cosmetic.

### DEGRADES

**B1 · NeX panel leak — stale place panel stays open on NETRA jump to fiction node**
*Surface:* public home / globe · *Owner:* **sirius** · *Fix-size:* S (one line)
`jumpToFictionPin` (`components/WorldlineGlobe.tsx` ~L1746–1798) clears the NETRA lock and sets the NeX target but never calls `setSelectedId(null)`. `PlaceFrontDoorPanel` is rendered `open={!!selectedId}` (L2446), so after cycling Yirgacheffe → NeX via NEXT NODE the prior place panel remains visible (`aria-hidden='false'`) layered behind the NeX reticle. The early `return` at L1798 bypasses all three other dismissal paths (ESC L1012, click-miss L1328, panel `onClose` L2451). The code comment at L1744 acknowledges the no-*open* side but the symmetric no-*close* side is absent.
*Fix:* add `setSelectedId(null)` inside `jumpToFictionPin` before the early return, matching `jumpToPlace`.

**B2 · Photo delete leaves orphaned CDN storage objects**
*Surface:* console write-lifecycle (PHOTO) · *Owner:* **altair** · *Fix-size:* M
`deleteEntry` / `deleteEntryImpl` (`lib/server/entries/entry-lifecycle-core.ts:424`) removes the `entries` and `photo_assets` rows but never calls the Supabase Storage delete API for the photo variants. Post-delete the CDN variant URL still returns HTTP 200 — DB rows gone (entries 11→10, photo_assets 6→5) but the bucket objects persist as orphans. Orphan-sweep logic already exists at `scripts/sweep-storage-orphans.ts:183` (`sweepOrphanVariants`) and can be reused/factored.
*Fix:* in the delete handler, enumerate `photo_assets.variants` for the entry and issue a storage `.remove()` for each key (all sizes/formats) inside the same transaction/teardown, then verify a post-delete GET returns 404-class.

**B3 · LENS instrument-override cannot be cleared via the console UI once set**
*Surface:* console write-lifecycle (PHOTO) · *Owner:* **sirius** · *Fix-size:* S
The LENS field in the photo editor is marked required (asterisk). Submitting an empty string is rejected by form validation, so `entries.instrument_overrides.lens` persists and there is no UI path to delete the override and fall back to raw EXIF. (Underlying write semantics are correct — raw `photo_assets.exif` is left untouched; this is purely a missing clear affordance in the form.)
*Fix:* make LENS non-required in the override editor and treat empty-submit as "delete `instrument_overrides.lens`" (or add an explicit ✕/RESET control that writes the key removal).

**B4 · Anon role holds over-wide table grants (TRUNCATE / TRIGGER / REFERENCES / INSERT / UPDATE / DELETE) on public tables**
*Surface:* security / RLS / DB · *Owner:* **procyon** · *Fix-size:* S (one REVOKE migration)
Independently confirmed: `anon` holds `DELETE, INSERT, REFERENCES, TRIGGER, TRUNCATE, UPDATE` on `entries`, `photo_assets`, and `rolls` (`has_table_privilege('anon','public.entries','TRUNCATE')=true`). `relrowsecurity=true` but `relforcerowsecurity=false`, and PostgreSQL has no RLS policy command for TRUNCATE — so RLS does NOT neutralize it. Root cause: a blanket `GRANT ALL ON ALL TABLES IN SCHEMA public` at setup (identical over-grants exist on `authenticated`).
*Blast radius today:* PostgREST does not expose TRUNCATE over HTTP → REST API blast radius is **zero**. The theoretical path is a direct Postgres connection via the `anon` role (pooler 6543 with the public anon key), which could `TRUNCATE public.entries` with no barrier. Defense-in-depth, not an active live exploit.
*Fix:* a `REVOKE` migration paring `anon` (and `authenticated`) down to exactly the column-level `SELECT` already in use; drop TRUNCATE/TRIGGER/REFERENCES/INSERT/UPDATE/DELETE table grants. Verify with a re-run of `information_schema.table_privileges`.

### COSMETIC

**B5 · Stray probe scratch files at repo root (`.check_storage_tmp.mjs`, `.check_storage2_tmp.mjs`)**
*Surface:* code integrity / repo hygiene · *Owner:* **altair** · *Fix-size:* XS
Both files (1822 B / 2825 B, timestamped Jun 12 16:13–16:14) are untracked and ungitignored — `git check-ignore -v` exits 1 with no output. Each opens with `createClient` + a hardcoded-absolute-path `readFileSync('…/.env.local')`, unambiguous interactive probe debris from a prior session. The only legitimate root `.mjs` are `eslint.config.mjs` and `postcss.config.mjs` (both tracked).
*Fix:* `git clean` the two scratch files (do NOT `rm` — live-action gate). Optionally add `.check_*_tmp.mjs` to `.gitignore` to prevent recurrence. No source change.

> Note: this synth slice produced its own analogous root debris this session (`.harness/staging/verdict_tally.py`, `.claude/qa-home-*.png`). Same XS hygiene class; fold into the same B5 sweep.

---

## 4 · DATA-GAP / NEEDS-PEAT (separated — NOT bugs)

### data-gap (foundation present, content/plugins not authored)

| # | Surface | Item | Why it is a gap, not a bug |
|---|---|---|---|
| D1 | content/articles | H2 headings render with **no `id` attribute** | No `rehypeSlug`/`rehypeAutolinkHeadings` in `lib/store/mdx.tsx` `evaluate()`. No spec in `docs/design/12-entry-routes.md` requires anchor IDs and no in-page TOC consumes them. Add the rehype plugin only if/when a TOC ships. |
| D2 | content/articles | No pullquotes authored | `<Pullquote>` component exists; zero usages in `content/articles/*.mdx`. Authoring, not code. |
| D3 | all entries | WorldlineLinks `§ worldline` section absent everywhere | `WorldlineLinks` correctly returns `null` on 0 edges; `worldline_links` has 0 rows authored (known 0-edge graph). |
| D4 | globe / Bangkok panel | HIGHLIGHTS shows `NOT CURATED YET` | Matches DECISION §15 Option A placeholder; no highlights authored for Bangkok yet. |
| D5 | photos/chiang-mai | Roll renders at HTTP 200 with **0 frames** | `getSidecarsInRoll` filters `status='published'`; `DSCF0001.mdx` exists on disk but was never ingested to a DB row. Ingest, not code. |

### needs-peat (a decision or a manual confirm only Peat can give)

| # | Surface | Item | What is needed |
|---|---|---|---|
| P1 | security / storage | **Draft entry DSCF0344's photo variants are publicly reachable on the CDN.** The `photos` bucket is `public=true` with no per-object entry-status gate. The path is not enumerable via anon REST (entry hidden, `photo_assets` anon-inaccessible) but the pattern is deterministic and the bytes are live (thumb/medium/full → HTTP 200). | **Peat decision:** is draft-image privacy in scope? If yes, this becomes a confirmed bug needing per-object/path-prefix gating or a separate private bucket for draft variants. If draft images are acceptably semi-public-by-obscurity, it stays a documented accepted-risk. Leaning security-relevant — flag for an explicit call. |
| P2 | archive / hover-sync | Row↔globe hover highlight (bidirectional) | Source path is present and correct (`ArchiveLedger.tsx` L160 `onRowHover` → `setHoveredId` → mini-globe; globe→row `scrollIntoView` L410–430) but a scripted `mouseenter` triggers the row's `<a>` navigation side-effect, so the **visual** highlight can't be confirmed by automation. Needs one manual browser hover. Cosmetic. |
| P3 | archive / skip link | Skip-link visual reveal on Tab | CSS is correct (`globals.css` L305–319: `:focus` reveals to `top:8px` with orange dashed outline) but the automated Tab test hit a devtools page-switching constraint. Needs one manual Tab press to confirm reveal. Cosmetic. |

---

## 5 · Overall verdict

**ISSUES.**

The site does not block exploration anywhere — all public read surfaces (home, globe cycle, archive, search, content, 404, draft gate) are functional, a11y is 100/100, and no console errors appear. But five confirmed-broken findings exist, four of which **degrade** behavior, so this is not SHIP-CLEAN:

- **B1** (NeX panel leak, sirius, S) — a visible UX defect on the public globe.
- **B2** (photo-delete CDN orphans, altair, M) — silent storage leak; data-integrity debt that compounds.
- **B3** (LENS override can't be cleared, sirius, S) — console authoring dead-end.
- **B4** (anon over-wide grants, procyon, S) — defense-in-depth gap; zero REST blast radius today but a real direct-connection TRUNCATE path. Not a live exploit, but security-class.
- **B5** (scratch files, altair, XS) — cosmetic repo hygiene only.

Recommended close-out order: **B1 + B3** (small frontend fixes, ship the public/console polish), then **B2** (storage integrity), then **B4** (REVOKE migration, defense-in-depth), then **B5** (git clean). Resolve the **P1** draft-image-privacy decision before the next deploy — it is the only finding that could escalate from needs-peat to a security bug.

---

*Synthesized from: DIMENSION 1 (home/globe), DIMENSION 2 (archive/search), DIMENSION 3 (content/404), SECURITY/RLS/STORAGE/PRIVACY, DIMENSION 5 (code integrity), CONSOLE WRITE-LIFECYCLE, and the adversarial-verify pass over the broken set. 118 findings total.*
