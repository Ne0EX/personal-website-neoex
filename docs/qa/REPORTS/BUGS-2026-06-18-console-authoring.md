# Bug log — console authoring (store-as-source)

**Intake:** Peat, 2026-06-18, 5 bugs from live use of `/console` + `/console/editor`.
**Branch:** `genesis/store-as-source` · **Store:** Supabase `aitqswnbtpexrxqpoiwo`.
**Diagnosis:** read-only workflow `wf_a85ae1b2-010` (5 parallel recon + 1 adversarial foundation-verify, no mutations, no edits).
**Status:** #1/#2/#3a/#4 **SHIPPED + browser-verified + Supabase-write-proven 2026-06-18** (commits `088be28`, `b98c0f4`, `8884907`, `360b975`; signatures `5a55466`). #3b + #5 held for Peat.

## Verification (2026-06-18, live :3000 + Supabase, Polaris-driven chrome-devtools)

- **Widgets render+behave (live console):** date input defaults today; DOMAIN dropdown = identity/reflection/method/meta; TAGS combobox adds via suggestion (`essay`) AND creatable (`qa-sentinel`), chips removable; SUMMARY counter `n / 300` + maxLength.
- **Supabase write e2e (sentinel create→verify→delete):** committed one draft sentinel through the new widgets → DB row had `date=2026.06.18` (dotted, no dash-leak), `iso_date=2026-06-18` (type date), `domain=method` (lowercase enum), `tags={essay,qa-sentinel}` (text[]), `summary` 49 chars, `status=draft`. Then deleted ONLY that exact id (`7c296044…`) → count restored to **14** exactly (4 article · 9 photo · 1 fiction), all real rows incl `DSCF0344` intact. No stray MDX export file.
- **#4 editor (article 002):** source pane now fills height — full 5045-char body visible past the intro (was clipped); outline click ("WHAT I CARRY FORWARD") scrolls BOTH source textarea AND preview pane (was a dead no-op). Screenshots in `.harness/qa-2026-06-18-editor-002-*.png`.
- **Public regression (`/articles/002`):** renders identically, zero console errors/warnings — markdown.tsx id addition is inert on public (uses `renderMdxBody`, not `Blocks`).
- **Algol revise items resolved:** F6 hydration (`todayIso()` in JSX) fixed via useState lazy init (`360b975`); 4 missing signatures backfilled + self-hash-verified (`5a55466`).
- **Canopus systemic finding:** `sign-work.sh` only runs on a dirty tree (can't sign post-commit) → recommends a `post-commit` hook to auto-sign while task env vars are live. Prevents the unsigned-commit class. Deferred to Peat (harness change).
- **#6 pagebreak/prose spacing (public article page) — SHIPPED + verified (`2578ca0`):** Peat reported the public `/articles/*` pagebreak (`---`/hr) had no spacing + cramped prose. Root cause: `renderMdxBody` registered only Pullquote → bare `<p>/<h2>/<hr>` with no class, and globals.css had no `.wl-body` block-spacing rules (the editor preview's `wlc-*` rhythm was never shared). Fix (Betelgeuse spec → Sirius, approach B): shared `lib/store/mdxComponents.tsx` binds MDX elements to `wlc-*` classes (used by `renderMdxBody`; single source of truth), styled under `.wl-body` in globals.css. Pagebreak = `3em` symmetric margin, 40% width, centered dashed hairline (`--ink-dashed`) — a deliberate thematic break, not a divider. **Verified live** (computed styles on :3000): h2 = Cormorant italic 25px / 55px top-margin; hr = 40.5px symmetric / 254px (40%) width. Screenshot `.harness/qa-2026-06-18-public-002-prose-FIXED.png`.
- **OPERATIONAL FINDING — Turbopack CSS HMR stuck on Peat's :3000:** the `2578ca0` globals.css change did NOT hot-reload — the dev server kept serving a *pre-change* CSS chunk (verified by fetching the served stylesheet: had `--ink-dashed` but not `wl-body`/`wlc-hr`), even though the JS (`mdx.tsx`) hot-reloaded (classes applied). An mtime-only `touch` didn't dislodge it; a **content change** (trailing comment, since reverted) forced the recompile and the rules then served correctly. So globals.css edits won't appear on a long-running dev server until a content-touch or restart. (Only #6 touched globals.css; #1–#4 form CSS was component-scoped styled-jsx, hot-reloaded fine.)
- **Pre-existing (not from this batch, out of scope):** `getAllRolls` imported-not-called in page.tsx; `EntryStatusSchema` unused + `ZodIssueCode` deprecated in schema.ts — surfaced by file-touch, predate this work.

---

## Headline — Bug #4 is NOT a mockup

Peat's biggest fear ("เหมือนทุกอย่างเป็น mockup") is **refuted**. The store holds the full body and is the single source of truth. Two independent reads confirm:

- `entries` row `slug=002` → `length(body)=5045 chars`, full article (head = `*Stride wasn't failing…*`, tail = `That is a reasonable thing to know about yourself.`), `summary=196 chars` in a **separate** column.
- The MDX export matches: `content/articles/002-stride-pause.mdx` body portion = ~5045 chars (frontmatter stripped) — exact match. `content/` is the **untracked export mirror**, not the live source.
- Editor LOAD → SAVE → public RENDER all hit **one** column `entries.body`: load `admin-reads.ts:33` (ENTRY_COLS incl `body`) → `EntryEditor.tsx:1878-1880` (`md` ← `initialDraft.body`) → save `EntryEditor.tsx:2095` (`updateEntry patch:{body: md}`) → `actions-core.ts:354-356` → public `app/articles/[fileNum]/page.tsx:72-75` reads same column. No divergent / legacy / velite source exists (velite removed).
- The `‖ SAVE 5045 CH` counter in Peat's own screenshot = the full 5045 chars ARE loaded in the source pane.

So #4 is **two small UI/wiring defects**, not a foundation gap. **Do NOT migrate or backfill `entries.body` for 002** — that would overwrite the correct body.

---

## Triage

| # | Bug | Class | Scope | Owner | Public-facing? |
|---|-----|-------|-------|-------|----------------|
| 1 | DATE = free-text → calendar picker | quick-win | small | Sirius + Altair | no (console) |
| 2 | DOMAIN/TAGS = free-text → dropdown + auto-add | quick-win | medium | Sirius + Procyon | no (console) |
| 3a | SUMMARY form length cap (≤3 bullet / 2-3 sentences) | quick-win | trivial | Sirius | no (console) |
| 3b | SUMMARY renders after title, before body | quick-win* | small | Sirius (+Betelgeuse) | **YES (article page)** |
| 4 | outline body "empty" + dead outline-click | quick-win | small | Sirius | no (console, auth-gated) |
| 5 | bilingual: top-right switch, default en, geo-autoswitch | **direction DECIDED**; storage model pending | feature | Sirius/Altair/Betelgeuse/Procyon | YES |

\* placement is Peat-specified (not directional); only the visual treatment + null-summary guard need care.

---

## Per-bug findings

### #1 — DATE picker
- **Now:** `<input type="text" placeholder="YYYY.MM.DD">` at `ConsoleEntryForm.tsx:234-239`; value flows free-form to `createEntry`.
- **Store nuance (important):** TWO columns — `date` (text, dotted `YYYY.MM.DD`) + `iso_date` (real `date` type, `YYYY-MM-DD`). `SlugDateSchema` (`schema.ts:27-29`) enforces the **dot** regex. A native `<input type="date">` emits **dashes** → would FAIL the dot regex. `iso_date` drives sort (`reads.ts` localeCompare).
- **Fix:** date picker (ISO out) → normalize to dotted `date` + valid `iso_date` in the write path. **Do not change column types.** Owner Sirius (widget) + Altair (write-path normalize, `actions-core.ts`/`entry-lifecycle-core.ts`).

### #2 — DOMAIN dropdown + TAGS creatable combobox
- **Now:** both plain text inputs (`ConsoleEntryForm.tsx:245-263`).
- **DOMAIN:** fixed app enum `['identity','reflection','method','meta']` (`schema.ts:34`; DB column is free `text`, no CHECK). Live distinct: identity, meta, method, reflection (+ NULL on photos). → read-only dropdown **sourced from `DomainSchema` enum** (don't hardcode a divergent list).
- **TAGS:** Postgres `text[]` array, free vocab. Live distinct tags: `coffee, essay, genesis, identity, meta, method, reflection, stride, transmission`. → creatable combobox: suggest-from-existing + type-to-add (matches Peat's "dropdown / auto add จากการพิมพ์"). Needs a new admin read `getAllTags()` (distinct `unnest(tags)`) — Procyon. **Not** a controlled vocabulary (Peat asked for auto-add).
- Owner Sirius (widgets) + Procyon (`getAllTags`).

### #3 — SUMMARY
- **3a form:** textarea `ConsoleEntryForm.tsx:269-275`, no length cap; schema `summary: z.string().optional()` (`schema.ts:102`). → add `maxLength` + char counter. **Open default:** ~300 chars (≈ 2-3 sentences / 3 short bullets). Optional `z.string().max()` server guard.
- **3b render:** TODAY summary only renders as a **fallback placeholder INSIDE the body** when body is empty (`ArticleEntry.tsx:228-241`) and is **hidden** when a body exists (`body ?? placeholder` guard, line 219). Peat wants it as its own section after title, before body. → extract into a distinct lede section before the body div; reuse the existing Cormorant-italic + orange-border style; **guard on `article.summary` existing** (else blank gap). Editor preview (`ArticlePreview.tsx:248-253`) gets same fix. Public-facing → Betelgeuse treatment + Algol + browser verify.

### #4 — editor body "empty" + dead outline-click
- **(A) "empty after intro":** SOURCE textarea `.src-text` (`EntryEditor.tsx:423-437`, flex:1 / overflow-y:auto / line-height:1.9) holds all 5045 chars in its internal scroll with **no overflow affordance** → reads as empty below the intro. *Caveat: the pure-white-below-intro in the screenshot is slightly atypical for a simple scroll-overflow (5045 chars should fill many lines). **Confirm the exact symptom in-browser before fixing** — rule out a draft-vs-published body divergence. (chrome-devtools attach to the running :3000, read textarea `.value.length` + `scrollHeight`.)*
- **(B) dead outline-click:** `scrollToHeading` (`EntryEditor.tsx:1472-1481`) querySelects `#slug` inside the **preview** pane (`previewRefId='ed-preview'`), but `markdown.tsx:113-143` emits `<h2>/<h3>` with **no `id`** → always null → silent no-op. Also a textarea can't be scrolled via querySelector (needs `selectionStart`+`scrollTop` math). → emit slug `id`s on preview headings (additive, shared with public Blocks renderer — verify no public regression) AND/OR add textarea-scroll math for the SOURCE pane.
- Owner Sirius (+ markdown.tsx).

### #5 — bilingual → **DIRECTION DECIDED by Peat 2026-06-18** (now a feature, not a quick bug)

**Peat's decision (verbatim intent):** language selector at **top-right**; first design = a Thai/English **switch (toggle)**; **default = English**; **auto-switch by viewer region** (from Thailand → Thai, else English); more languages later ("ค่อยว่ากัน") — so the model must **scale to N languages**, not hardcode 2.

This means **content authored in both languages** + UI i18n + geo. Sub-pieces:
- **Switch UI** top-right (Sirius + Betelgeuse) — MVP simple toggle.
- **Geo auto-default** (Altair, middleware/edge) — Vercel `x-vercel-ip-country` header; TH→th, else en. **Nuance:** a manual toggle choice must **persist (cookie) over geo** on later visits, else geo keeps overriding the user. Geo varies the response → caching/SSR implications.
- **Thai font coverage** (Betelgeuse) — currently Latin-only fonts (Cormorant / JetBrains Mono / Special Elite, all `subsets:["latin"]`); Thai falls back to system font, degraded metrics/tone-marks. `--font-thai` was **explicitly cut from v1** (review 2026-05-14). Load a Thai face (e.g. Noto Serif Thai). Needed regardless of storage model.
- **CONTENT storage — the open foundation choice (Peat's call, gates build):** no `lang` column exists today.
  - **(rec) translation-group model:** one entry per (slug, lang) + a shared `translation_group_id`; switch maps between siblings; adding a language = add a row. Scales to N cleanly, smallest per-row schema, language-aware search for free.
  - **(alt) JSONB translations map** on one entry (`{en:{title,body,summary}, th:{…}}`); one row, but every read/write/render + console editor must handle the lang map; scales to N but heavier touch.
  - **(reject) per-language columns** (`title_th`, `body_th`) — does NOT scale to N (migration per language).
- **Backfill reality:** existing entries are English-only; the switch is only meaningful where a translation exists → fall back to the available language otherwise.
- **Per his own form-over-foundation rule:** settle the storage model (short grill/PRD) **before** building. Other 4 bugs are independent of this.

---

## Build plan (on Peat go)

Dependency-ordered, per recipe (one agent/slice, owning persona, self-verify gate, own-paths commit, Algol last):

- **R1 (parallel, disjoint files):** Procyon `getAllTags()` (`admin-reads.ts`) · Altair date write-path normalize (`actions-core.ts`) · Sirius #4 (repro-in-browser first, then `EntryEditor.tsx`+`markdown.tsx`).
- **R2 (serial, after R1 — shares `ConsoleEntryForm.tsx`):** Sirius form batch — #1 picker, #2 domain dropdown + tags combobox, #3a length cap.
- **R3:** Algol gauntlet over the batch + browser verify (chrome-devtools on :3000).

**Held for Peat:** #3b (public article page — placement is yours-specified but treatment + ship-to-public wants your eye) · #5 both decisions.

**Env note:** verification needs Peat's `:3000` (Next16 single-dev lock — agents can't boot a parallel dev). Either Peat runs the live check or grants a consented :3000 drive.
