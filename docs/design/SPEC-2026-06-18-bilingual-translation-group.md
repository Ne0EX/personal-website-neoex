# SPEC-2026-06-18 — Worldline Bilingual Foundation (translation-group)

> Status: DESIGN DOC — no code, no migration run from this document.
> Foundation issue: #5 (bilingual). Sits on the store-as-source Supabase foundation
> (SPEC-2026-06-12-store-as-source-supabase.md, ref `aitqswnbtpexrxqpoiwo`,
> branch `genesis/store-as-source`).
> Architect: Polaris. Implementation routes through the GENESIS roster (see §7 slice table),
> every signed slice gated by Algol audit before close.

---

## 0. Summary

Add a language dimension to Worldline content as a **translation-group** keyed on the
existing `slug` plus a new `lang` column — one article identity (`fileNum`), N
language siblings. Translation is **opt-in per article**; a missing requested
language **falls back to the authored language** (read still resolves). Public
routing is **locale-prefix with English UNPREFIXED** (`/articles/002` = en,
`/th/articles/002` = Thai), driven by a Next.js 16 **`proxy.ts`** (NOT `middleware.ts`).
A geo default (Vercel `x-vercel-ip-country`: TH→th, else en) picks the first
locale; a **cookie override persists and beats geo**. A top-right **TH / EN switch**
sits beside the Nav clock. **Thai font** (Noto Serif Thai via `next/font/google`)
is wired with a graceful Latin fallback. A **console add-translation affordance**
lets the owner author a sibling. **Chrome / nav i18n is RECOMMENDED-DEFERRED**
(architect recommendation, pending Peat — OQ6). Peat's 2026-06-18 intent
(BUGS-2026-06-18 §#5 line 76) named **UI i18n** as in-scope; this spec *recommends*
deferring chrome i18n so v1 stays the content + routing + font + switch foundation.
Under that recommendation the chrome (nav labels, system readouts, console UI) stays
English in v1; only article/fiction *content* gains a language dimension. **This cut
is the architect's, not Peat's — see OQ6.**

This is the foundation. Edges-based translation linking, NETRA graph-RAG over
languages, and full chrome i18n are explicitly out of scope (Phase B / later).

---

## 1. Decision Log

### DL1 — MODEL: translation-group, opt-in, fallback to authored language
**DECIDED (Peat).** Each translation is a **sibling row** in `entries` sharing the same
`(kind, slug)` and differing on a new `lang` column. The set of siblings sharing a
`slug` is the *translation group*. `slug` (= `fileNum` for articles) is the stable,
language-agnostic article identity. Translating an article is **optional**: an
article may exist in `en` only. When a reader requests a language that has no sibling,
the read **falls back to the authored language** of that article (the language the
piece was originally written in; in practice today, `en`).

- **Rejected: JSONB map** (`{en: {...}, th: {...}}` inside one row). Reason: every
  read/write touches the whole blob; per-language publish status, per-language
  completeness checks, and per-language draft/publish independence become app-level
  hacks; PostgREST column grants can't gate per-language; no clean uniqueness.
- **Rejected: per-language columns** (`title_en`, `title_th`, `body_en`, `body_th`).
  Reason: schema churns on every new language; doesn't scale to N; sparse columns;
  CHECK constraints multiply per language.
- **Chosen: row-per-language** keeps every existing per-row mechanism (RLS, column
  grants, publish-completeness, draft/publish status, triggers) working unchanged
  per sibling, and scales to N languages with zero schema change.

### DL2 — ROUTING: locale-prefix, English UNPREFIXED, `/th` prefixed
**PROPOSED (architect — routing was NOT part of Peat's 2026-06-18 brief; pending
sign-off, OQ7).** Peat decided default-en, switch, geo, cookie-persistence; he did
**not** specify any URL strategy (no `/th/` prefix, no unprefixed-en). The shape below
is the architect's recommendation, consistent with his "default en", and is a durable,
SEO-load-bearing commitment — confirm before P3. URLs:
- `/articles/002` → English (unprefixed, unchanged from today).
- `/th/articles/002` → Thai.
- Generalizes: any future locale `xx` lives at `/xx/...`; English alone is the bare path.

Rationale: hreflang-clean, shareable per-language URLs, SEO-distinct, scales to N
locales. English-unprefixed means the existing English URL space is preserved
byte-for-byte (no `/en/...` redirect churn, no broken inbound links).

### DL3 — v1 SCOPE
**MIXED PROVENANCE.** Items 1–7 below trace to Peat's 2026-06-18 brief (switch,
default-en, geo, cookie-persists, scale-to-N, Thai font, author-in-both-languages).
The chrome-i18n **deferral** in this DL is an **architect recommendation, NOT Peat's
decision** — Peat's brief explicitly included UI i18n (§0, OQ6). v1 *as proposed* ships:
1. Content translation-pairs (the DL1 model) for **articles** (fiction
   proposed-included, photos proposed-monolingual — pending OQ1, not yet settled v1
   scope).
2. Locale routing (DL2) via `proxy.ts` + `app/[lang]/` tree.
3. Top-right **TH / EN switch** (beside the Nav clock).
4. **Geo default**: `x-vercel-ip-country` header — `TH` → `th`, everything else → `en`.
5. **Cookie override** that persists across sessions and **beats geo / Accept-Language**.
6. **Thai font** — Noto Serif Thai via `next/font/google`, with Latin fallback chain.
7. **Console add-translation affordance** — owner can author a sibling translation.

**DEFERRED out of v1:** Accept-Language as anything more than a secondary signal,
automated machine translation, per-language NETRA, edges-based translation linkage.
**RECOMMENDED-DEFERRED (architect, pending Peat — OQ6):** chrome / nav / console-UI
i18n (under the recommendation the chrome stays **English** in v1 even when viewing
`/th/...` content). Peat named UI i18n in-scope; deferring it is the architect's call
to keep v1 to the foundation, not Peat's. Confirm or pull chrome i18n into v1 (OQ6).

### Parked defaults (architect-chosen unless Peat overrides — flagged in Open Questions)
- **PD1 — Switch animation:** instant crossfade of the TH/EN labels (~120ms opacity),
  no layout shift; the navigation itself is a hard `window.location` reload (locale
  is resolved server-side by the proxy). No elaborate transition in v1. (OQ2)
- **PD2 — Cookie name & shape:** `wl_locale`, value `en` | `th`, `Path=/`,
  `Max-Age=31536000` (1 year), `SameSite=Lax`, not `HttpOnly` (the client switch
  must set it). (OQ3)
- **PD3 — hreflang:** each article page emits `<link rel="alternate" hreflang="en"
  href="…/articles/002">`, `hreflang="th" href="…/th/articles/002">` **only for
  languages that actually exist** for that article, plus
  `hreflang="x-default"` → the English (authored-fallback) URL. No alternate is
  emitted for a language with no published sibling (so crawlers don't index a
  fallback as a real translation). (OQ4)
- **PD4 — Supported-locale set:** `['en', 'th']` in v1, with the `lang` column typed
  as free `text` (CHECK against an app-level allowlist, NOT a Postgres enum) so
  adding a locale is a one-line allowlist change, not a migration.
- **PD5 — Photos are monolingual** (recommendation, see OQ1): a photo does not
  "translate"; its caption is treated as language-neutral metadata. Photo entries do
  not get a `lang`-variant model; they default `lang='en'` for storage consistency.

---

## 2. Schema + LIVE MIGRATION plan (Peat-gated)

### 2.1 Target shape

Current `entries` has `UNIQUE (kind, slug)` (SPEC-2026-06-12 line 127). The bilingual
foundation replaces this with `UNIQUE (kind, slug, lang)`. A translation group is the
set of rows sharing `(kind, slug)`; `lang` distinguishes siblings.

New column:
- `lang text NOT NULL DEFAULT 'en'` — display + routing metadata, **public** (anon
  SELECT granted), NOT a security boundary, NOT GPS-gated.

No separate translation-group table and no FK linkage row is needed: the group key
is `(kind, slug)` itself.

> **DEVIATION FROM PEAT'S RECOMMENDATION — confirm (OQ8).** Peat's 2026-06-18
> recommendation (BUGS-2026-06-18 §#5 line 81) was "one entry per (slug, lang) **+ a
> shared `translation_group_id`**." This spec adopts row-per-(slug, lang) faithfully but
> **proposes deferring the explicit `translation_group_id`**, because `(kind, slug)`
> already serves as the group key until Phase B edges/NETRA need a stable, slug-rename-
> survivable id. This is a deviation Peat can veto, not a silent architect call —
> confirm dropping `translation_group_id` for v1 (OQ8). If kept, it is one extra
> `uuid` column shared across siblings, populated at first-sibling creation.

### 2.2 The migration (a DISCRETE, Peat-approved step)

> **GATE — Peat-at-seam.** This is a LIVE DDL change against the production Supabase
> project (`aitqswnbtpexrxqpoiwo`). It is its own approval step (slice P1, §7). Do
> NOT bundle it with any other slice. Snapshot before; verify after.

Exact DDL (single transaction; run via the Supabase migration mechanism /
`apply_migration`, recorded as a numbered migration file under `supabase/migrations/`,
NOT an ad-hoc `execute_sql`):

```sql
-- 20260618_0001_bilingual_lang.sql
begin;

-- 1. Add the language column. DEFAULT 'en' backfills all existing rows in place.
alter table public.entries
  add column lang text not null default 'en';

-- 2. App-level allowlist guard (NOT a pg enum — keeps adding a locale to a
--    one-line app change, not a migration). Permissive set for forward-compat.
alter table public.entries
  add constraint entries_lang_chk check (lang in ('en', 'th'));

-- 3. Swap the uniqueness scope from (kind, slug) to (kind, slug, lang).
--    Drop the existing constraint by its actual name (resolve via
--    information_schema before running — see 2.3) then add the composite.
alter table public.entries
  drop constraint <ACTUAL_kind_slug_unique_constraint_name>;
alter table public.entries
  add constraint entries_kind_slug_lang_unique unique (kind, slug, lang);

-- 4. Column grant — anon must be able to SELECT lang (routing/display data).
--    Mirrors migration 0010's explicit column-grant pattern (DL13).
grant select (lang) on public.entries to anon;

commit;
```

Backfill: step 1's `DEFAULT 'en'` sets all existing 14 rows (**4 articles + 1 fiction +
9 photos = 14**, verified against live `aitqswnbtpexrxqpoiwo` 2026-06-18) to `lang='en'`
atomically — no separate `UPDATE` needed.
This preserves the entire current single-language corpus and its history.

Triggers (`entries_updated`, `entries_served_coords`) are unaffected — `lang` is not a
trigger target. RLS policies (`entries_read` = `status='published' OR is_owner()`,
plus the owner-only insert/update/delete policies) are **unchanged**: language is
public metadata, not an access boundary.

### 2.3 Pre-flight (do BEFORE writing the migration file)

The original `UNIQUE (kind, slug)` constraint name is auto-assigned by the remote DB.
Resolve it first (read-only):
```sql
select conname from pg_constraint
where conrelid = 'public.entries'::regclass and contype = 'u';
```
Substitute the real name into step 3. Also confirm migration 0010's exact anon
column-grant statement so step 4 matches that style (additive `grant select (lang)`,
not a full re-grant).

### 2.4 Verification (Peat-gated, the verify-anon-rest-path discipline)

> **CRITICAL — do NOT verify with `execute_sql`.** `execute_sql` runs as superuser and
> **bypasses RLS and column grants**, so it will report green even if anon is broken
> (this exact false-green broke all public routes 500 in fix-wave-3 B4). Verify the
> grant the way a real visitor hits it.

Acceptance checks (all must pass before the slice closes):
1. **Anon PostgREST positive:** `GET /rest/v1/entries?select=kind,slug,lang,title&status=eq.published`
   with the **anon publishable key** returns 200 with `lang` populated (`en` on every
   backfilled row).
2. **Anon PostgREST negative (regression guard):**
   `GET /rest/v1/entries?select=coords` with the anon key still returns **42501**
   (coords stays revoked — confirms the migration didn't widen grants; pairs with the
   DL13 coords-still-42501 negative check).
3. **`next build` passes** against the live DB (the build statically renders article
   pages through the anon client; a broken grant surfaces as a build-time 500).
4. **Uniqueness:** attempting to insert a second `(article, '002', 'en')` row fails on
   `entries_kind_slug_lang_unique`; inserting `(article, '002', 'th')` succeeds.
   **Probe with `status='draft'`** (drafts are exempt from `entries_check5`/`check6`
   completeness — verified live: check5 is `status <> 'published' OR (…NOT NULL)`), OR
   populate all completeness fields. A `status='published'` insert with null
   coords/reading_time/summary fails on **`entries_check5`, not the unique
   constraint** — that confound would make the test a false-negative ("uniqueness
   works" when it's really check5 rejecting). The uniqueness probe must isolate
   `entries_kind_slug_lang_unique` as the only thing that can reject the duplicate.
5. **Row count unchanged** — the 14 existing rows survive with `lang='en'`; baseline
   captured before the migration matches after (per the test-cleanup blast-radius
   discipline: assert exact pre/post counts).

Rollback: `drop constraint entries_kind_slug_lang_unique; add constraint … unique
(kind, slug); drop column lang;` (the column drop cascades the CHECK and the anon
grant). Safe because no app code ships referencing `lang` until slice P1 is verified
green — slices P2+ depend on P1.

---

## 3. Read-path changes (lang-aware + opt-in fallback)

All public reads live in `lib/store/reads.ts` (anon client) and `lib/store/admin-reads.ts`
(owner client). Mapper: `lib/store/map.ts`; types: `lib/store/types.ts`.

### 3.1 Type + mapper + column list
- Add `'lang'` to `ENTRY_COLS` (`reads.ts:36-69`) and to the admin `ENTRY_COLS`
  (`admin-reads.ts:30-45`). Without this, any anon query selecting `lang` fails 42501.
- Add `authoredLang: string` (or `lang: string`) to the `Article` interface
  (`types.ts:52-80`) and the `Fiction` interface; add `lang` to `DbEntryRow`
  (`map.ts:36-76`); `mapArticle`/`mapFiction` pass `row.lang` through. Body remains a
  raw monolingual string per sibling — **no in-mapper translation**.

### 3.2 Single-entry read with opt-in fallback
`getArticleByFileNum(fileNum)` → `getArticleByFileNum(fileNum, requestedLang = 'en')`.

The current `.eq('slug', fileNum).maybeSingle()` (reads.ts:92-103, the `.maybeSingle()`
is at **reads.ts:98**) assumes one row per slug — multi-language **violates** that, and
**`.maybeSingle()` must be REMOVED**: PostgREST returns **406** from `.maybeSingle()`
whenever >1 row matches, which is exactly the sibling case (both a `th` and an `en` row
for one slug). Resolve with a single fetch of both candidate rows + a JS pick (one
round-trip, no `.maybeSingle()`, no fragile SQL ordering):

```
const { data } = await anonClient
  .from('entries')
  .select(ENTRY_COLS)            // ENTRY_COLS now includes 'lang'
  .eq('kind', 'article')
  .eq('slug', fileNum)
  .in('lang', [requestedLang, 'en'])   // requested OR authored-fallback (0..2 rows)
// NO .maybeSingle() — siblings make it throw 406. Pick in JS:
const row =
  data?.find(r => r.lang === requestedLang) ??   // requested language, if present
  data?.find(r => r.lang === 'en') ??            // authored fallback
  undefined
```

This is the **opt-in fallback**: a Thai reader on an article with no Thai sibling
silently gets the English text (and the page sets `lang="en"` on that content region —
§6). (Do NOT use `.order('lang', { ascending: requestedLang < 'en' })` — lexical
ordering does not reliably put the requested language first for arbitrary locale codes;
the JS `.find` pick is unambiguous.) The same `.maybeSingle()` removal + JS-pick applies
to `getFictionBySlug` (§3.5).

`generateMetadata` and the page component thread `requestedLang` from the
`[lang]` route segment (§4).

### 3.3 Listing reads (dedup to one row per group)
`getArticles()` / `getRecentArticles()` (reads.ts:79-117) currently return every
published row. With siblings they'd return duplicates (one per language). Strategy
(honors opt-in: fallback variants must NOT pad the listing):

- Query published rows, then **dedup by `slug`** in JS, choosing per group:
  the row whose `lang === requestedLang` if present, else the `en` (authored) row.
- Net effect: each article appears **once** in a listing, in the requested language
  if it has one, otherwise in English. Articles that aren't translated still show up
  (in English) — the listing is never thinned by missing translations.

(Alternative: push the dedup to SQL via `DISTINCT ON (slug)` with a CASE order — but
PostgREST can't express `DISTINCT ON` cleanly, so JS dedup after a `status=published`
fetch is the implementable path. Volume is tiny.)

### 3.4 Related articles
`getRelatedArticles(source, limit)` (reads.ts:119-145) filters `.neq('slug',
source.fileNum)`. With siblings this already correctly excludes **all** language
variants of the source (they share the slug) — good. But the result set now contains
sibling duplicates of *other* articles. Apply the same **dedup-by-slug** + prefer-
requested-lang pass (§3.3) **before** the overlap sort/slice, so a related article
isn't returned N times.

### 3.5 Fiction & Photos
- **Fiction:** same treatment as articles (slug is kebab-case, but the (slug, lang)
  model is identical). `getFictionBySlug(slug, requestedLang)` with the same fallback.
- **Photos:** **monolingual** (PD5 / OQ1). `getPhotoByRollAndId` etc. read with an
  implicit `lang='en'` and do not branch on requested language. Storage paths
  (`photos/<roll>/<photo_id>/…`) are language-independent and unchanged.

### 3.6 Admin reads
`getAllArticles()` / `getArticleBySlug()` (admin-reads.ts:70-99) return all rows for
the owner. Add an optional `lang` param; default behavior loads the `en` sibling so
existing console screens work unchanged. The console editor's translation view (§5)
passes an explicit `lang` to load a specific sibling for editing.

---

## 4. Routing — VERIFIED Next.js 16.2.6 approach

> Ground truth: `package.json:30` = Next 16.2.6. Per
> `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`
> and `…/02-guides/internationalization.md`, **`middleware.ts` is renamed to
> `proxy.ts`** (file convention changed in v16.0.0) and there is **no `next.config`
> i18n block** (Pages-Router-only, gone). `next.config.ts` here holds only a `distDir`
> override — no i18n config is added or supported.

### 4.1 Route tree refactor
Wrap the app in a `[lang]` segment:
- `app/layout.tsx` → `app/[lang]/layout.tsx`. The root layout receives
  `params: Promise<{ lang: string }>`; the hardcoded `<html lang="en">`
  (`layout.tsx:49`) becomes `<html lang={lang}>`.
- All public routes move under `app/[lang]/`: `app/[lang]/page.tsx`,
  `app/[lang]/articles/[fileNum]/page.tsx`, `app/[lang]/photos/*`,
  `app/[lang]/fiction/[slug]/`, `app/[lang]/archive/`.
- `app/console/` does **NOT** move under `[lang]` (chrome i18n deferred — console
  stays English, single locale, DL3).

### 4.2 `proxy.ts` (repo root, beside `app/`)
`export function proxy(request: NextRequest)`. Runs before rendering. Logic
(asymmetric: en unprefixed, th prefixed):

1. If `pathname` already starts with `/th/` (or any known non-en locale prefix) →
   pass through (it carries an explicit locale).
2. If `pathname` is a console / api / static path → pass through untouched.
3. Otherwise (an unprefixed path, candidate for en or a redirect): resolve the
   **effective locale** by precedence (§4.4):
   - **cookie `wl_locale`** (manual choice) — wins;
   - else **geo** `x-vercel-ip-country` (`TH` → `th`, else `en`);
   - else **Accept-Language** (secondary; `th*` → `th`, else `en`);
   - else `en`.
4. If effective locale is **`en`** → **serve as-is**, no redirect; the URL bar stays
   unprefixed. (Internally the `[lang]` segment resolves `lang='en'` — see 4.3.)
5. If effective locale is **`th`** → `redirect` to `/th{pathname}`.

This avoids any `/` → `/en/` redirect, preserving the English URL space byte-for-byte
(DL2).

> **PINNED MECHANIC (load-bearing, not a footnote).** The Next i18n *guide*
> (`…/02-guides/internationalization.md`) only documents the **symmetric** pattern —
> redirect EVERY unprefixed path to `/${locale}/…`, which would force `/en/…` and
> break DL2. There is **no worked example** of an unprefixed default locale mapped onto
> `app/[lang]`. So the en-unprefixed shape rests on `proxy.md`'s **`NextResponse.rewrite`**
> (documented, `proxy.md:285`, `:440` propagates RSC headers automatically), NOT on the
> i18n guide. Exact mechanic:
> - Bare path (e.g. `/articles/002`, effective locale `en`) → `return
>   NextResponse.rewrite(new URL('/en' + pathname + search, request.url))`. The URL bar
>   stays `/articles/002`; the `app/[lang]` tree resolves `lang='en'` internally.
> - `/th/*` → pass through untouched (it already carries the prefix; the `[lang]`
>   segment resolves `lang='th'`).
> - `/console`, `/api`, `/_next`, static assets → **excluded from the matcher** so the
>   rewrite never re-enters and cannot loop.
> - **Redirect-loop guard:** the internal `/en/...` target must itself be matcher-
>   excluded OR short-circuited at proxy entry (`if (pathname.startsWith('/en')) return
>   NextResponse.next()`), otherwise the rewritten request re-triggers the proxy → loop.
> This is verified, not deferred — see P3 gate (the `unstable_doesProxyMatch` +
> `isRewrite` / `getRewrittenUrl` unit test) and the real-Chrome check.

`export const config = { matcher: [...] }` excludes `/_next`, static assets, `/api`,
and `/console`.

### 4.3 `generateStaticParams`
- **Root** `app/[lang]/layout.tsx`: returns `[{ lang: 'en' }, { lang: 'th' }]`.
- **Article page** `app/[lang]/articles/[fileNum]/page.tsx`: returns the **cross-
  product** of locale × published article — but honoring opt-in, prerender:
  - every article at `lang: 'en'` (authored/fallback always exists), AND
  - each article at `lang: 'th'` **only if a published Thai sibling exists**.
  Build cost grows by (≈ #articles + #th-translations), not a flat ×N. Articles
  without a Thai sibling are not prerendered at `/th/...`; `dynamicParams=true`
  (current default, per the page's header comment) lets a `/th/...` request for an
  untranslated article render at request time via the §3.2 fallback (serving English
  text inside a `lang="en"` region) — acceptable, and rare.

### 4.4 Geo + cookie precedence (manual choice WINS)
Precedence, highest first: **cookie `wl_locale`** > geo (`x-vercel-ip-country`) >
Accept-Language > `en`. The cookie is set only by the user clicking the switch (§6),
so a manual choice always overrides geo. Local dev has no `x-vercel-ip-country` header
→ falls through to Accept-Language → `en` (Thai is exercised locally by setting the
cookie in devtools). This matches the verified `proxy.md` cookie-before-headers
pattern.

---

## 5. Write / authoring path

Write actions live in `lib/server/store/actions-core.ts`; Zod in `lib/store/schema.ts`.

### 5.1 `createEntry`
Article auto-numbering (`actions-core.ts:174-188`) stays unchanged — `slug`/`fileNum`
is language-agnostic, so the **first** sibling of an article (the authored one)
auto-assigns the next `003`-style number with `lang='en'` (default). Add an optional
`lang` to `CreateEntryInputSchema` / `CreateArticleInputSchema` /
`CreateFictionInputSchema` (`z.enum(['en','th']).default('en')`).
`CreatePhotoInputSchema` does **not** gain `lang` (PD5).

### 5.2 Translation siblings — `createTranslation`
Rather than overload `createEntry` with sibling-array loops, add a **dedicated**
action `createTranslation({ kind, slug, fromLang, toLang, patch })`:
- Loads the source sibling `(kind, slug, fromLang)`.
- Inserts a **new row** with the same `slug` but `lang = toLang`, `status='draft'`,
  copying language-neutral fields **`date, tags, place, coords, domain, maturity,
  reading_time`** and taking translated `title` / `summary` / `body` from `patch`
  (blank-seeded if the owner wants to start from scratch).
- **Completeness intent (verified against live `entries_check5`/`check6`).** A
  published article requires `title, domain, maturity, reading_time, summary, coords`
  all NOT NULL; published fiction requires `title, domain, summary`. `createTranslation`
  copies the **language-neutral** completeness fields — `coords, domain, maturity,
  reading_time` (so the sibling is publishable without the owner re-entering them) —
  but does **NOT** copy `title` / `summary` (they are language-specific and must be
  translated). **Intended, not a surprise:** the new draft sibling will be blocked from
  publish by the per-sibling `check5`/`check6` until the owner supplies the translated
  `title` + `summary`; the console surfaces this as a per-sibling publish-completeness
  error (§5.4). The earlier draft of this list omitted `reading_time` — a sibling
  seeded without it would be silently un-publishable on a language-neutral field, so
  `reading_time` is copied.
- Preserves atomic per-row semantics; keeps `createEntry`/`updateEntry` signatures
  simple.

### 5.3 `updateEntry` / `setEntryDraft` / `deleteEntry`
Each must resolve to **one sibling** by `(kind, slug, lang)`:
- `updateEntry(kind, slug, patch)` → add `lang` (default `'en'`) so the
  `.eq('kind').eq('slug')` query gains `.eq('lang', lang)` and patches exactly one row.
- `setEntryDraft(kind, slug, lang, draft)` → publish/unpublish is **per-sibling**.
  The DL14 publish-completeness check applies **per language** (each sibling validated
  independently). Translation model is "each sibling publishes on its own" — an English
  article can be published while its Thai sibling is still a draft. (No cross-language
  all-or-none gate in v1.)
- `deleteEntry(kind, slug, lang)` → deletes **only the target sibling**; other
  siblings survive (chosen policy (a): translations are independently deletable, no
  cascade trigger). For photos, the existing `entry_id` storage cleanup is unchanged.
- `SetEntryDraftInputSchema` gains `lang`; `UpdateEntryInputSchema` gains optional
  `lang`. `revalidatePath('/', 'layout')` still fires on every mutation (DL11) — no
  per-language revalidate logic needed (layout-wide invalidation already covers
  `/th/...`).

### 5.4 Console add-translation affordance (UX sketch — owner: Sirius / Betelgeuse)
On the console article editor, when viewing an article that has only an `en` sibling:
- A row of **language chips** near the title: `EN ●` (authored, active) and a
  `+ TH` "add translation" affordance.
- Clicking `+ TH` calls `createTranslation` (seeds a draft Thai sibling) and switches
  the editor to the Thai sibling (`?lang=th` / a `lang` tab). The editor then loads
  that sibling via admin-reads (§3.6).
- Once a Thai sibling exists, the chips show `EN ● / TH ○` and clicking toggles which
  sibling is being edited. Each sibling has its own draft/publish toggle
  (`setEntryDraft` per lang). Publish-completeness errors render per-sibling.
- Visual language stays inside the existing console design system (no new visual
  vocabulary; chrome stays English per DL3). Microcopy owned by Vega (§7).

---

## 6. Render — Thai font, lang attribute, switch component

### 6.1 Thai font (Noto Serif Thai via `next/font`)
Ground truth: `app/layout.tsx:2-27` loads Cormorant / JetBrains Mono / Special Elite,
all `subsets:['latin']` → no Thai glyphs (boxes). `app/globals.css:175-178` defines
`--font-display` / `--font-mono` / `--font-type`; no `--font-thai`.

Wiring:
- Add `Noto_Serif_Thai` from `next/font/google`, `subsets:['thai']`, mapped to
  `--font-thai`, in the (now) `app/[lang]/layout.tsx`. Variable added to the `<html>`
  className alongside the existing three.
- Add `--font-thai` to the `@theme` block in `globals.css`.
- **Fallback chains** (so Thai content renders Thai glyphs while Latin stays the
  existing register): extend the body/summary/MDX font stacks to append the Thai
  family *after* the Latin family — e.g.
  `.wl-body .wlc-p { font-family: var(--font-mono), var(--font-thai), ui-monospace, monospace; }`
  (globals.css:1745), `.wl-summary__body` (1947-1951), and the title
  (`ArticleEntry.tsx:165-178`, currently `var(--font-display)`). For Thai titles the
  display serif (Cormorant) has no Thai glyphs, so a Thai-content title region should
  resolve to Noto Serif Thai. Betelgeuse owns the exact token + class design so the
  two registers (Latin display vs Thai serif) read as one design language, not two
  blended ones (visual-language-hygiene rule).

### 6.2 `lang` attribute on rendered content
- `<html lang={lang}>` becomes dynamic from the `[lang]` segment (§4.1).
- The article body/summary region carries the **content's actual language**, which may
  differ from the page locale when a fallback occurred (§3.2): a Thai page serving an
  untranslated article wraps that English body in `<section lang="en">`. So the page
  sets the *region* `lang` from `article.authoredLang`/the served sibling's `lang`,
  independent of the URL locale. This is correct for screen readers and search.
- MDX (`lib/store/mdx.tsx`, `mdxComponents.tsx`) needs no per-element `lang`; the
  region-level `lang` on the wrapping `<section>` is sufficient. (Inline mixed-language
  spans are out of scope for v1 — one sibling = one language.)

### 6.3 Top-right TH / EN switch (owner: Sirius UI, Betelgeuse design, Vega microcopy)
Ground truth anchor: the Nav clock block (`components/Nav.tsx:189-199`,
`SYS // CALIBRATED` + `UTC+7 // HH:MM` + `StratumIndicator`) is the top-right cluster.
- Add a small `'use client'` `LocaleSwitcher` in/next to the `nav-clock` cell:
  `TH · EN`, current locale emphasized, in the existing `t-meta` mono register (chrome
  stays English-styled — the switch is a control, not translated chrome).
- onClick: set `document.cookie = "wl_locale=<choice>; Path=/; Max-Age=31536000;
  SameSite=Lax"` (PD2), then navigate:
  - choosing **TH** → `window.location.href = "/th" + currentUnprefixedPath`;
  - choosing **EN** → set cookie `en` and `window.location.href =
    currentPathWithThStripped` (unprefixed).
- On reload the proxy reads `wl_locale` first (§4.4), so the manual choice persists and
  beats geo. Switch animation = PD1 (instant label crossfade; hard reload).

---

## 7. Slice table (dependency order; each Algol-gated)

> Migration first and gated. No slice consuming `lang` ships before P1 verifies green
> (anon-REST + `next build`, NOT `execute_sql`). Every signed slice routes through
> Algol audit before Polaris closes.

| # | Slice | Owner | Algol gate |
|---|-------|-------|-----------|
| **P1** | **LIVE MIGRATION (Peat-gated)**: add `lang` column + CHECK, swap unique to `(kind,slug,lang)`, anon `GRANT SELECT (lang)`, backfill `en`. Numbered migration file, single txn. | Procyon (α-IDX-03) | Anon PostgREST positive (`select=lang` 200) **and** negative (`select=coords` still 42501) via **publishable key**; `next build` green; row count == pre-migration baseline; uniqueness positive/negative. NO `execute_sql` verification. |
| **P2** | Read-path lang-awareness + opt-in fallback: `ENTRY_COLS += lang`, `Article`/`Fiction`/`DbEntryRow` types, mapper passthrough, `getArticleByFileNum(fileNum, lang)` fallback, listing/related dedup-by-slug. | Procyon (types/reads), Altair (fallback semantics) | `tsc` clean; unit-level: requested-th-present → th row; requested-th-absent → en row (the HARDEST path — verify the fallback branch, not just the happy en path); listing returns one row per group; related excludes all source siblings + dedups. |
| **P3** | Routing: `app/[lang]/` tree refactor, `proxy.ts` (geo + cookie + Accept-Language precedence, en-unprefixed asymmetry), dynamic `<html lang>`, `generateStaticParams` cross-product (en-all + th-where-exists), hreflang (PD3). Depends P1+P2. | Altair (α-NAV-?? routing/geo/proxy) | `/articles/002` serves en unprefixed (URL unchanged); `/th/articles/002` serves Thai; cookie override beats a simulated `x-vercel-ip-country: TH`; `next build` prerenders expected (lang,fileNum) set; no redirect loop on `/`; hreflang only for existing siblings + x-default→en. **MANDATORY rewrite unit test** (`next/experimental/testing/server`): `unstable_doesProxyMatch` asserts the matcher EXCLUDES `/_next`, `/api`, `/console` (and the internal `/en` re-entry); for a bare path `isRewrite(response)===true` and `getRewrittenUrl()` ends `/en/...` (NOT a redirect, no `/`→`/en` 3xx); `/th/*` is pass-through. Then verified in real Chrome (chrome-devtools MCP), not Playwright. |
| **P4** | Write/authoring: `createTranslation` action, `lang` on `updateEntry`/`setEntryDraft`/`deleteEntry`, Zod schema updates (per-sibling publish/completeness, independent delete, photos monolingual). Depends P1. | Procyon (schema/actions) | Create th sibling → new row same slug diff lang; publish en while th draft (independent); update patches one sibling only; delete th leaves en (no cascade); photo create rejects/ignores `lang`. **Test-cleanup blast-radius discipline**: delete ONLY exact created IDs, assert return to exact baseline. |
| **P5** | Console add-translation affordance: language chips, `+ TH` → `createTranslation` + sibling editor tab, per-sibling publish toggle, admin-reads `lang` param. Depends P4. | Sirius (α-SUR-01) UI · Betelgeuse design · Vega microcopy | Owner can add a Thai sibling from the editor, edit + publish it independently, switch siblings; chrome stays English; no new visual vocabulary; verified in real Chrome against live console. |
| **P6** | Render: Noto Serif Thai via `next/font`, `--font-thai` token + fallback chains (body/summary/title/MDX), region-level `lang` attr from served sibling, top-right `LocaleSwitcher` (cookie set + reload), switch microcopy. Depends P3 (route) + P2 (served-lang). | Betelgeuse (α-??-?? font/tokens/switch design) · Sirius (switch wire) · Vega (microcopy) | Thai article renders Thai glyphs (no boxes) with Latin chrome intact; fallback article shows English body in `lang="en"` region on a `/th` page; switch sets `wl_locale` + persists across reload + beats geo; one design language not two blended (worldline-soul / visual-language-hygiene check). |

---

## 8. Open questions / risks for Peat

- **OQ1 — Fiction & Photos coverage (NOT in Peat's brief — proposed boundary).** Peat's
  2026-06-18 ask spoke of "content"/"entries", not fiction or photos specifically.
  Spec *proposes*: **fiction = translatable** (same model as articles), **photos =
  monolingual** (PD5 — a photo doesn't "translate"; caption is language-neutral).
  Confirm, or scope v1 to articles-only. This is unsettled until you answer.
- **OQ6 — Chrome / nav / console-UI i18n (BLOCKER-class provenance — DL3).** Peat's
  2026-06-18 intent (BUGS §#5 line 76) **explicitly named UI i18n as in-scope**: "content
  authored in both languages + **UI i18n** + geo." This spec *recommends* deferring chrome
  i18n to keep v1 to the content + routing + font + switch foundation. **That cut is the
  architect's, not yours.** Confirm the deferral, or pull chrome i18n into v1 (it would add
  a `messages/{en,th}.json` + a server-side `t()` for nav labels / system readouts /
  console UI — a meaningful scope increase). The whole DL3 chrome-deferral hangs on your
  answer here.
- **OQ7 — URL routing strategy (was NOT in your brief — DL2).** You decided default-en,
  switch, geo, cookie-persistence; you did **not** specify a URL shape. The architect
  *proposes* English-unprefixed (`/articles/002`) + `/th/` prefixed, which preserves your
  existing article URLs byte-for-byte and is consistent with "default en." But URL shape is
  a durable, SEO-load-bearing commitment — confirm the en-unprefixed + `/th/` scheme, or
  pick symmetric (`/en/` + `/th/`, all prefixed).
- **OQ8 — `translation_group_id` (deviation from YOUR recommendation — §2.1).** Your
  2026-06-18 rec (BUGS §#5 line 81) was "(slug, lang) **+ a shared
  `translation_group_id`**." The spec adopts (slug, lang) faithfully but **proposes
  dropping the explicit `translation_group_id`**, using `(kind, slug)` as the group key
  until Phase B edges/NETRA need a rename-survivable stable id. Confirm dropping it for
  v1, or keep it as a shared `uuid` column now (cheap to add at migration time, awkward to
  backfill later).
- **OQ2 — Switch transition (PD1).** Instant label crossfade + hard reload is the
  default. If you want a softer cross-locale transition (the worldline-soul "earned,
  not splayed" register), that's a Betelgeuse design pass — flag it.
- **OQ3 — Cookie name/lifetime (PD2).** `wl_locale`, 1-year, `Lax`. OK?
- **OQ4 — hreflang policy (PD3).** Emit alternates only for languages that actually
  exist for an article, plus `x-default` → English. Confirm we do NOT advertise a
  fallback as a real translation.
- **OQ5 — Authored-language field name.** `authoredLang` on the served type vs reusing
  the served sibling's `lang`. They coincide except during fallback (page locale `th`,
  served sibling `en`). The region `lang` attribute (§6.2) must reflect the *served*
  sibling's language, not the URL locale — confirm that's the intended a11y/SEO
  behavior.
- **RISK-1 — Migration is LIVE on production data.** Mitigated by single-txn DDL,
  in-place `DEFAULT 'en'` backfill, anon-REST + `next build` verification (NOT
  superuser `execute_sql`), pre/post row-count assertion, and a clean rollback path.
  Still a Peat-at-seam approval.
- **RISK-2 — Static-params explosion.** Cross-product is bounded by honoring opt-in
  (th prerendered only where a sibling exists) + `dynamicParams=true` for the rest;
  build cost stays ≈ articles + translations, not flat ×N.
- **RISK-3 — Proxy en-unprefixed rewrite mechanics.** This is the one routing claim the
  Next *i18n guide* does NOT back (it only shows symmetric redirect-to-`/${locale}`).
  The mechanic is now **PINNED** against `proxy.md` (§4.2): `NextResponse.rewrite` to an
  internal `/en/...`, matcher excludes `/_next`/`/api`/`/console`/internal-`/en`, with an
  explicit redirect-loop guard. It is **proven before P3 gates**, not deferred — the P3
  gate now requires the `unstable_doesProxyMatch` + `isRewrite`/`getRewrittenUrl` unit
  test (assert no `/`→`/en` redirect, no loop) AND a real-Chrome check. Treat the
  rewrite as load-bearing.
- **RISK-4 — Chrome stays English on `/th` pages (architect recommendation, NOT a Peat
  decision — see OQ6).** Under the *recommended* deferral, a Thai reader sees Thai article
  content inside English nav/system chrome. Peat named UI i18n in-scope, so this is the
  single highest-stakes open question (OQ6), not a settled v1 boundary. Flag if it reads as
  unfinished and chrome i18n should be pulled into v1.

---

## 9. Adjudication (architect-review, 2026-06-18)

Three adversarial lenses (DIRECTIVE FIDELITY, TECHNICAL vs THIS REPO, SECURITY /
PRIVACY / DATA-INTEGRITY) raised 10 issues. Provenance ground truth: BUGS-2026-06-18
§#5 (line 76 "content authored in both languages + UI i18n + geo"; line 81 "(slug,
lang) + a shared `translation_group_id`"). Live store ground truth: project
`aitqswnbtpexrxqpoiwo`, queried 2026-06-18.

| # | Lens | Severity | Verdict | Why |
|---|------|----------|---------|-----|
| 1 | Directive fidelity | blocker | **APPLIED** | DL3 chrome-deferral was stamped "DECIDED (Peat)" but Peat's line-76 intent **included** UI i18n. Re-labeled as architect recommendation; added **OQ6** (the decision is Peat's to make); §0, DL3, DEFERRED block, RISK-4 all corrected. Did NOT cut anything Peat decided — the *deferral* was never his. |
| 2 | Directive fidelity | blocker | **APPLIED** | DL2 routing was stamped "DECIDED (Peat)" but Peat never specified a URL strategy. Re-labeled **PROPOSED (architect)**; substance kept (en byte-for-byte, existing URLs unbroken); added **OQ7** for explicit sign-off on the durable URL shape. |
| 3 | Directive fidelity | major | **APPLIED** | §2.1 dropped Peat's own recommended `translation_group_id` while framing it as a neutral architect call. Now named as a **deviation from Peat's recommendation** + added **OQ8** (vetoable). Model otherwise faithful (row-per-lang, opt-in, fallback-to-authored, not-JSONB, not-per-lang-columns all honored). |
| 4 | Directive fidelity | minor | **APPLIED** | §0/DL3 asserted fiction/photos as "default-included" ahead of OQ1. Softened to "proposed-included / proposed-monolingual pending OQ1"; OQ1 itself re-flagged as not-in-Peat's-brief. |
| 5 | Technical vs repo | major | **APPLIED** | en-unprefixed rewrite was a P2 footnote; the i18n *guide* only shows the symmetric redirect (would force `/en/`). Pinned the mechanic against `proxy.md` (`NextResponse.rewrite` to internal `/en`, matcher excludes `/_next`/`/api`/`/console`/internal-`/en`, explicit loop guard), made it load-bearing in §4.2, and added a **mandatory `unstable_doesProxyMatch` + `isRewrite`/`getRewrittenUrl` unit test** to the P3 gate (verified the API exists in `proxy.md`). |
| 6 | Technical vs repo | minor | **APPLIED** | Deleted the broken `.order(requestedLang < 'en').maybeSingle()` sketch from §3.2 (it throws PostgREST 406 on the sibling case it must handle). Kept only the `.in([...])` + JS `.find` pick. Stated `.maybeSingle()` must be **removed from `getArticleByFileNum` (reads.ts:98)** — verified that line. Extended to `getFictionBySlug`. |
| 7 | Security / data-integrity | minor | **APPLIED** | §2.2 photo count corrected to the verified live breakdown **4 articles + 1 fiction + 9 photos = 14** (was "5 photo sidecars + remainder"). Migration unaffected; verification baseline now matches reality. |
| 8 | Security / data-integrity | minor | **APPLIED** | Duplicate of #7 (same per-kind breakdown error from a second lens). Resolved by the same §2.2 correction. |
| 9 | Security / data-integrity | minor | **APPLIED** | P1 check #4 now mandates the uniqueness probe insert with `status='draft'` (or full completeness fields) so `entries_kind_slug_lang_unique` — not `entries_check5` — is the only possible rejector. Verified live: check5 = `status<>'published' OR (…NOT NULL)`, drafts exempt. Prevents a false-negative "uniqueness works." |
| 10 | Security / data-integrity | minor | **APPLIED** | §5.2 `createTranslation` now copies `reading_time` (verified language-neutral completeness field in `entries_check5`) and explicitly states `title`/`summary` are NOT copied (language-specific) → the per-sibling publish-completeness block is **intended**, surfaced as a console error, not a surprise. |

**Applied: 10. Rejected: 0.** No issue was an over-strict nit; every one was either a
genuine provenance fault (Peat's authority stamped on architect calls / a deviation from
his own words) or a verified-against-ground-truth technical/data correction. No Peat
decision was weakened — the two "DECIDED (Peat)" demotions *restore* fidelity by removing
his name from cuts and strategies he did not author.

**Migration gate status:** the LIVE DDL on production `aitqswnbtpexrxqpoiwo` remains
explicitly **Peat-at-seam** — §2.2 GATE banner, P1 slice, RISK-1, and anon-REST-not-
`execute_sql` verification (§2.4) all intact. No migration is run from this document.
```
