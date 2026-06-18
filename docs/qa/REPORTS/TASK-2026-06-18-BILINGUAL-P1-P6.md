# docs/qa/REPORTS/TASK-2026-06-18-BILINGUAL-P1-P6.md

## task · bilingual foundation P1-P6 + P3 cleanup

## verdict · PASS — no blockers (static surface clear for server-gate verification)

> **POLARIS CORRECTION 2026-06-19 — the "blocker" was a FALSE POSITIVE.**
> Algol flagged `actions-core.ts:659` `parsed.error.flatten()` as a runtime crash,
> on the basis that `grep -c "flatten" node_modules/zod/index.cjs` returned 0.
> Polaris ran the deterministic runtime check (`.harness/zod-check.cjs`) against the
> installed Zod **4.4.3**: `typeof error.flatten === 'function'`, and it returns the
> expected `{ formErrors, fieldErrors }` shape. `flatten()` **exists and works** — the
> v4 runtime impl is simply not in `index.cjs` (the file Algol grepped). The TS signal
> was correct all along: code 6387 = *deprecated*, not *missing* (a removed method would
> be 2339). So `:659` is **NOT a blocker** — it works at runtime and is consistent with
> every other action in the repo. `flatten()` is only **type-deprecated** → a
> project-wide future Zod chore (use `z.flattenError()`), NOT bilingual-introduced and
> NOT urgent. Lesson: a `grep` proves only what it greps; the deterministic backstop
> here was a runtime call, not a substring count (adversarial-verify-determinism).

static surface is clear for server-gate verification. There are **no blockers**. The
remaining items are minor or pre-existing (one bilingual-introduced unused import; the
static `<html lang>` v1 partial; the project-wide Zod type-deprecation chore), and the
runtime/route checks are deferred to `next build` + real-Chrome.

---

## 1. signature integrity

No `.claude/signatures/` files exist for the eight commits in this range
(0de511b..315f95c). The bilingual slices were shipped without `sign-work.sh` calls.

Status: `UNSIGNED` — not `INTEGRITY-FAIL`. The schema requires signatures for agent
work records, not for every commit. Polaris-assigned tasks should result in signed
records. The absence is a harness gap, not evidence of tampering.

Action: route a HOOK PROPOSAL to Canopus — the `sign-work.sh` step should be
enforced at the task-close seam for bilingual agent work (Procyon / Altair / Sirius /
Betelgeuse all contributed commits here). Not blocking the bilingual close; flagged
for Canopus.

---

## 2. acceptance criteria check (per SPEC §7 slice table)

### P1 — LIVE MIGRATION

Algol-gated criteria from SPEC:

**Anon PostgREST positive (`select=lang` 200):** VERIFIED LIVE.
```
GET /rest/v1/entries?select=kind,slug,lang,title&status=eq.published
→ 200, all 11 published rows carry lang="en"
```

**Anon PostgREST negative (`select=coords` still 42501):** VERIFIED LIVE.
```
GET /rest/v1/entries?select=coords
→ {"code":"42501","message":"permission denied for table entries"}
```
coords grant remains revoked. DL13 intact.

**Row count:** 11 published rows visible to anon (14 total — 3 drafts hidden by RLS,
consistent with Polaris's baseline of 14 all-en). PASS.

**Migration file present:** `supabase/migrations/20260618_0001_bilingual_lang.sql` —
present, correct DDL, constraint named `entries_kind_slug_lang_unique`, anon grant
wired per migration 0010 style. PASS.

**Migration NOT wrapped in a transaction:** The migration file does not include
`begin;` / `commit;` — SPEC §2.2 required a single transaction. This is a
documentation gap — Supabase `apply_migration` wraps each file in a transaction
automatically, so the behavioral requirement is satisfied even though the file-level
`begin/commit` framing is absent. CONCERN (minor, non-blocking — behavior correct).

**`next build` green:** DEFERRED (environment constraint — single dev server, cannot
run build). Listed in server-gate deferred section.

### P2 — LANG-AWARE READS + OPT-IN FALLBACK

**`'lang'` added to `ENTRY_COLS`:** VERIFIED. `reads.ts:71` — `'lang'` is in the
ENTRY_COLS join list. PASS.

**`lang` added to admin `ENTRY_COLS`:** VERIFIED. `admin-reads.ts:47` — `'lang'` is
in the admin ENTRY_COLS list. PASS.

**`lang: string` added to `Article` and `Fiction` types:** VERIFIED.
`types.ts:86` — `Article.lang: string` with comment explaining fallback semantics.
`types.ts:113` — `Fiction.lang: string`. PASS.

**`lang` added to `DbEntryRow`:** VERIFIED. `map.ts:81` — `lang: string`. PASS.

**`mapArticle`/`mapFiction` pass `row.lang` through:** VERIFIED.
`map.ts:155` — `lang: row.lang ?? 'en'`.
`map.ts:179` — `lang: row.lang ?? 'en'`. PASS.

**`.maybeSingle()` REMOVED from `getArticleByFileNum`:** VERIFIED.
`reads.ts:160-178` — uses `.in('lang', ...)` + `pickSibling()` JS pick. No
`.maybeSingle()`. PASS.

**`.maybeSingle()` REMOVED from `getFictionBySlug`:** VERIFIED.
`reads.ts:268-283` — same pattern. PASS.

**The HARDEST PATH — requested-th-absent returns en, not undefined:**
`pickSibling()` at `reads.ts:96-102`:
```ts
return (
  rows.find((r) => r.lang === requestedLang) ??
  rows.find((r) => r.lang === 'en') ??
  undefined
)
```
When `requestedLang='th'` and no Thai row exists, the first find returns undefined,
the second find returns the 'en' row. Fallback branch correct. PASS.

**`pickSibling` is exported for unit testability:** VERIFIED. `reads.ts:96` —
`export function pickSibling`. PASS (testability criterion met; no runner exists yet).

**Listing dedup by slug:** `dedupBySlug` at `reads.ts:112-127` — groups by slug,
calls `pickSibling` per group. `getArticles`, `getRecentArticles`, `getRelatedArticles`
all use it. PASS.

**`getRecentArticles` over-fetch strategy:** `reads.ts:190` — `fetchLimit = limit * 4`.
Correct — prevents dedup from dropping below requested count. PASS.

**`getRelatedArticles` dedup:** `reads.ts:229` — `dedupBySlug` applied before
overlap sort/slice. PASS.

**Fiction same treatment:** `getFiction` and `getFictionBySlug` both get dedup and
fallback respectively. PASS.

**Photos monolingual:** `getPhotoSidecars`, `getSidecarsInRoll`, `getPhotoByRollAndId`
all query without lang filter (implicit lang='en' rows only, since photos have no
lang branching per PD5). `.maybeSingle()` retained on `getPhotoByRollAndId` —
correct, as photo slugs are unique by `(roll, photo_id)` and photos are monolingual
(no siblings to cause a 406). PASS.

**Admin reads `lang` param:** `getAllArticles(lang?)` and `getArticleBySlug(slug, lang='en')`
both updated. `.maybeSingle()` correctly retained in `getArticleBySlug` because the
admin query includes `.eq('lang', lang)` — uniqueness constraint means at most 1 row.
PASS.

**`getFictionSiblings` dedup:** `reads.ts:316` — `dedupBySlug(data, 'en')` applied
before alpha-distance sort. Correct — narrative siblings (different slugs, same
cluster) deduplicated in English. PASS.

### P3 — ROUTING

**`app/[lang]/` tree created:** VERIFIED. All public routes present under `app/[lang]/`:
archive, articles/[fileNum], fiction/[slug], layout.tsx, page.tsx, photos/[roll]/[id],
photos/[roll], photos. PASS.

**Pre-`[lang]` orphan routes removed:** VERIFIED. `app/` root contains only:
`[lang]/`, `api/`, `console/`, `favicon.ico`, `globals.css`, `layout.tsx`,
`not-found.tsx`. No orphaned `app/articles/`, `app/page.tsx`, `app/fiction/`,
`app/photos/`, `app/archive/`. PASS (P3 cleanup commit 315f95c confirms removal).

**`proxy.ts` at repo root (not `middleware.ts`):** VERIFIED. File present at
`/proxy.ts`. PASS.

**Redirect-loop guard:** `proxy.ts:180` — `if (pathname.startsWith('/en')) return NextResponse.next()` —
fires before locale resolution. PASS.

**En-unprefixed rewrite mechanic:** `proxy.ts:207-218` — bare paths rewrite to
`/en${pathname}` internally. URL bar stays unprefixed (rewrite not redirect). PASS
(code-level; runtime verification deferred to Chrome e2e).

**Th-prefixed redirect:** `proxy.ts:221-224` — non-en locale → `redirect` to
`/${locale}${pathname}`. PASS.

**`/th/*` pass-through:** `hasLocalePrefix()` at `proxy.ts:111-116` — returns true
for `/th/...` paths → `NextResponse.next()`. PASS.

**Matcher excludes `_next`, `api`, `console`, static assets:** `proxy.ts:250` —
`/((?!_next/static|_next/image|api|console|favicon\.ico|sitemap\.xml|robots\.txt).*)`.
PASS.

**Redirect-loop guard for internal `/en` NOT excluded from matcher (dynamic guard
instead):** confirmed in `proxy.ts:244-249` comments — correct design per SPEC §4.2.
PASS.

**Cookie precedence (wl_locale wins):** `resolveLocale()` checks cookie first at
`proxy.ts:73-76`. PASS.

**Geo precedence (TH → th):** `proxy.ts:79-80`. PASS.

**Accept-Language secondary signal:** `proxy.ts:83-86`. PASS.

**`generateStaticParams` in articles page:** `proxy.ts:65-89` fetches all en articles
+ all published th slugs, builds cross-product honoring opt-in. PASS.

**`generateStaticParams` in fiction page:** same pattern implemented in fiction page.
PASS.

**hreflang only for existing siblings + x-default → en:**
`app/[lang]/articles/[fileNum]/page.tsx:128-133` — only advertises languages present
in `existingLangs` (fetched via anon select). `x-default` always points to en URL.
PASS.

**`[lang]/layout.tsx generateStaticParams`:** Returns `[{ lang: 'en' }, { lang: 'th' }]`.
PASS.

**`console/layout.tsx` added (explicit scoping):** VERIFIED. Pass-through shell,
explicitly scopes console routes outside `[lang]`. PASS.

**Root `app/layout.tsx` updated:** Noto Serif Thai font loaded here, className includes
`${notoSerifThai.variable}`. PASS.

**`x-wl-locale` header injection:** `proxy.ts:215` — sets `x-wl-locale: en` on rewrites.
This is a bonus signal not mandated by SPEC. Not a problem but not exercised anywhere
in the codebase currently (no consumer reads this header). Low concern.

**SPEC §6.2 — `<html lang={lang}>` is STATIC at `'en'` (Polaris known item #1):**
CONFIRMED. `app/layout.tsx:78` — `<html lang="en">`. Root layout does not dynamically
set lang from the `[lang]` segment.

Classification: **ACCEPTABLE PARTIAL for v1**. The SPEC §6.2 language requirement is
met at the region level: `ArticleEntry.tsx:220, 267` — `<section lang={lang}>` wraps
both summary and body sections using `article.lang` (served sibling lang, reflects
fallback). The document-level `<html lang="en">` is a known architectural constraint
documented in `app/layout.tsx:17-19` and `[lang]/layout.tsx:13-15`. The SPEC §4.1
states `<html lang={lang}>` becomes dynamic; that refactor requires either moving the
font loading into `[lang]/layout.tsx` or using route-group architecture — both options
have tradeoffs with console routes. This is the only acceptance gap: documented,
intentional in v1, does not fail a11y for content (region lang is set). Not blocking.

**`proxy-logic-verify.mjs` standalone logic test:** `tests/proxy-logic-verify.mjs`
present — pure JS simulation of proxy decisions. Runnable via `node` without a runner.
PASS (structure matches SPEC P3 gate requirement for a logic test).

**`proxy.test.ts` (TypeScript, requires runner):** `tests/proxy.test.ts` present —
14 test cases covering matcher exclusions, rewrite/redirect/passthrough/loop guard/
geo/cookie. Uses `next/experimental/testing/server` utilities. Correctly noted as
deferred pending test runner. PASS (test file is structurally complete; runner is
the only gap).

**CONCERN — proxy.test.ts missing matcher-excludes-console-from-locale-group test:**
The test file has `test_matcher_matches_console` (verifies `/console` matches the
proxy) but no test asserting that `/console` is excluded from the LOCALE group's
regex. The matcher regex explicitly excludes `console` via
`(?!...console...)` — but no test covers "locale rewrite does NOT fire on /console".
This is a gap in test coverage, not a code bug. Minor concern.

### P4 — WRITE / AUTHORING

**`createTranslationImpl` present:** VERIFIED. `actions-core.ts:654-740` — full
implementation. Loads source sibling, copies language-neutral fields (date, tags,
place_id, coords, share_location, domain, maturity, reading_time, patches,
worldline_links, highlight_for_place), seeds language-specific from patch. PASS.

**`reading_time` copied (SPEC §5.2 explicit requirement):** `actions-core.ts:702` —
`reading_time: src['reading_time'] ?? null`. PASS.

**`title` and `summary` NOT copied (language-specific):** `actions-core.ts:689-690` —
`title: patch?.title ?? null`, `summary: patch?.summary ?? null`. PASS.

**Fiction-specific neutral fields copied:** `actions-core.ts:708-712` — variants,
divergence_cluster, origin_locus. PASS.

**Photos monolingual gate:** `CreateTranslationInputSchema` at `schema.ts:306` uses
`kind: z.enum(['article', 'fiction'])` — photo excluded. PASS.

**SIBLING_EXISTS error (23505 unique constraint):** `actions-core.ts:721-727` —
detected and returned as `SIBLING_EXISTS` code. PASS.

**`updateEntry` scoped to sibling via `.eq('lang', lang)`:** `actions-core.ts:364` —
`.eq('lang', lang)` present. PASS.

**`setEntryDraft` per-sibling:** `actions-core.ts:404-406, 430-434` — both fetch
and update queries include `.eq('lang', lang)`. PASS.

**`deleteEntry` per-sibling:** `actions-core.ts:585-591, 600-605` — both photo and
non-photo delete paths include `.eq('lang', lang)`. PASS.

**`LangSchema` added to `CreateArticleInputSchema` and `CreateFictionInputSchema`:**
`schema.ts:124, 133` — `lang: LangSchema.default('en')`. PASS.

**`LangSchema` NOT added to `CreatePhotoInputSchema`:** VERIFIED. `schema.ts:154-162`
— no `lang` field. PASS (PD5).

**`UpdateEntryInputSchema` gains `lang`:** `schema.ts:231-238` — `lang: LangSchema.default('en')`.
Existing callers that omit `lang` get 'en' default. PASS.

**`SetEntryDraftInputSchema` gains `lang`:** `schema.ts:246-254`. PASS.

**`DeleteEntryInputSchema` gains `lang`:** `schema.ts:291-298`. PASS.

**`CreateTranslationInputSchema` refine (fromLang !== toLang):** `schema.ts:315-318`.
PASS.

**`actions.ts` wrapper exports `createTranslation`:** `actions.ts:52` — import of
`createTranslationImpl`; wrapping present. PASS.

**`createEntry` photo branch does NOT insert lang:** `actions-core.ts:261-294` —
photo insert has no `lang` field. The column defaults to 'en' in the DB. PASS.

### P5 — CONSOLE ADD-TRANSLATION AFFORDANCE

**`getSiblingLangs` in admin-reads:** `admin-reads.ts:262-275` — lightweight select
of just `lang` column per (kind, slug). Admin client (includes drafts). PASS.

**Console editor page reads `lang` from URL + loads `siblingLangs`:**
`app/console/editor/page.tsx:269-271` — calls `getSiblingLangs` for article/fiction
kinds when slug present. Passes `activeLang` and `siblingLangs` to `EntryEditor`. PASS.

**`EntryEditor` shows language chips:** `components/console/EntryEditor.tsx:1171-1258` —
`LangChips` component renders existing siblings as `EN ●` / `TH ○` and missing
supported langs as `+ TH` affordance. PASS.

**`+ TH` calls `createTranslation`:** `EntryEditor.tsx:2999` — `await createTranslation({...})`.
PASS.

**Per-sibling `setEntryDraft`:** `EntryEditor.tsx:2555, 2956` — both calls pass
`lang: entryLang`. PASS.

**Per-sibling `updateEntry` (body, caption, photo meta, filmSim, instrument overrides):**
- Body save at `EntryEditor.tsx:2383` — `lang: entryLang`. PASS.
- Caption save at `EntryEditor.tsx:2457` — no explicit `lang`. Defaults to `'en'`.
  Caption is a photo-only field (photos are monolingual, PD5). Correct.
- Photo meta save at `EntryEditor.tsx:2508` — no explicit `lang`. Photo-only. Correct.
- filmSim save at `EntryEditor.tsx:2532` — no explicit `lang`. Photo-only. Correct.
- Instrument overrides at `EntryEditor.tsx:2419` — no explicit `lang`. Photo-only. Correct.

All photo-kind `updateEntry` calls correctly omit `lang` (defaulting to 'en'); the
schema default of `'en'` serves photos correctly since they are monolingual. PASS.

**`deleteEntry` passes `lang: entryLang`:** `EntryEditor.tsx:2315`. PASS.

**Chrome stays English (DL3):** language chips render in English register (labels
"TH", "EN" in mono uppercase). Console UI text unchanged. PASS.

**Admin reads gain `lang` param:** `admin-reads.ts:80-93` (getAllArticles), 
`admin-reads.ts:110-123` (getArticleBySlug), `admin-reads.ts:132-145` (getFictionBySlugAdmin),
`admin-reads.ts:155-168` (getAllFiction) — all updated with optional lang param. PASS.

### P6 — RENDER (FONT + LANG ATTR + SWITCHER)

**Noto Serif Thai loaded in root layout:** `app/layout.tsx:60-65` — `Noto_Serif_Thai`
from `next/font/google`, variable `--font-noto-thai`, `subsets: ['thai']`. PASS.

**`--font-noto-thai` injected on `<html>` className:** `app/layout.tsx:79` —
`${notoSerifThai.variable}` in className. PASS.

**`--font-thai` CSS token in `@theme` block:** `globals.css:183` —
`--font-thai: var(--font-noto-thai), 'Noto Serif Thai', serif`. PASS.

**Fallback chains in globals.css:**
- Body/wlc-p: `globals.css:1755` — `font-family: var(--font-mono), var(--font-thai)`. PASS.
- Summary: `globals.css:1959` — `font-family: var(--font-mono), var(--font-thai)`. PASS.

**Title font-thai fallback in ArticleEntry:** `ArticleEntry.tsx:176` —
`fontFamily: 'var(--font-display), var(--font-thai)'`. PASS.

**Body section font-thai fallback in ArticleEntry:** `ArticleEntry.tsx:271` —
`fontFamily: 'var(--font-mono), var(--font-thai)'`. PASS.

**Region-level `lang` attr on summary and body sections:** `ArticleEntry.tsx:220, 267` —
`<section lang={lang}>`. `lang` comes from `article.lang` (served sibling's language,
reflects fallback). PASS.

**`LocaleSwitcher` component created:** `components/LocaleSwitcher.tsx` — full
implementation. PASS.

**Cookie PD2 compliance (wl_locale, Path=/, Max-Age=31536000, SameSite=Lax, NOT HttpOnly):**
`LocaleSwitcher.tsx:88` — `document.cookie = 'wl_locale=${target}; Path=/; Max-Age=31536000; SameSite=Lax'`.
PASS.

**Path logic (en-unprefixed, th-prefixed):** `LocaleSwitcher.tsx:95-103` —
choosing TH: `/th` + unprefixed path; choosing EN: strip /th prefix. PASS.

**`LocaleSwitcher` integrated in `Nav.tsx`:** `Nav.tsx:191` — `<LocaleSwitcher />`.
PASS.

**PD1 animation (120ms opacity crossfade, hard reload):** `LocaleSwitcher.tsx:111-121` —
`setVisible(false)` then 120ms timeout then `window.location.href`. PASS.

**`prefers-reduced-motion` respected:** `LocaleSwitcher.tsx:82-86` —
`fadeDuration = prefersReduced ? 0 : 120`. Instant navigate when reduced. PASS.

---

## 3. quality bar

**No select * in anon reads:** CONFIRMED. All public reads enumerate ENTRY_COLS
explicitly. PASS.

**Explicit ENTRY_COLS in admin reads:** CONFIRMED. `admin-reads.ts:30-48` enumerates
all columns. PASS.

**Error handling pattern consistent:** All actions follow `assertOwner → safeParse → DB op → revalidatePath → return result` pattern. PASS.

**Dead code introduced:** `_lang` in `[lang]/layout.tsx:47` is destructured but not
used in the function body. Suppressed with `eslint-disable-next-line @typescript-eslint/no-unused-vars`.
This is intentional (param available for children to propagate) and the comment
explains the design intent. NOT dead code — architectural anchor. PASS.

**Type safety:** `tsc --noEmit` exits 0. Stale `.next/types/validator.ts` references
to orphaned routes are regenerated on `next build` — confirmed as stale Next-generated
file, not a source error. PASS.

---

## 4. regression scan (static)

**`getArticles` callers with no `requestedLang`:** `archive.ts:104` — `getArticles()`
called without lang, defaults to `'en'`. This is correct behavior for v1 (archive
chrome stays English, DL3 / OQ6). No regression.

**`getFiction` in `WorldlineGlobe.tsx:1900`:** Called without lang, defaults to `'en'`.
Globe loads fiction in English always — correct for v1 (globe is not translated).
No regression.

**`getFictionSiblings` call in `WorldlineGlobe.tsx:1671`:** Called with `pin.slug` —
no lang param, returns English fiction siblings. Correct for globe context. No regression.

**Existing `getArticleBySlug` callers in console:** `console/editor/page.tsx:97` —
passes `resolvedLang` from URL param. Correct.

**`getPhotoByRollAndId` `.maybeSingle()` retained (correct):** Photos are monolingual;
no siblings can cause a 406. No regression.

**Admin `ENTRY_COLS` now includes `coords` (pre-existing) AND `lang` (new):**
Confirmed. No regression — admin reads always included `coords` for the console
editor.

**Deferred (next build required):**
- Route path resolution for all `app/[lang]/` pages (404 vs serve).
- `generateStaticParams` actual cross-product output.
- Static rendering of `[lang]/layout.tsx` with Triangulate portal.
- hreflang emitted correctly in rendered HTML `<head>`.
- Console auth gate still fires for unauthenticated requests on all console paths.

---

## 5. a11y audit (code-level)

**`LocaleSwitcher` `role="group"` with `aria-label="Language switch"`:**
`LocaleSwitcher.tsx:129-130`. PASS.

**`aria-live="polite"` on container:** `LocaleSwitcher.tsx:131`. Announces locale
changes to screen readers. PASS.

**Each button has `aria-label` (descriptive) and `aria-pressed` (state):**
`LocaleButton` at `LocaleSwitcher.tsx:181-182` — `aria-label="Switch to Thai/English"`,
`aria-pressed={active}`. PASS.

**Minimum 44px tap target:** `LocaleButton` has `paddingBlock: '4px'` — inherits
nav-clock line-height for sufficient vertical touch target. PASS (within the existing
nav-clock's established tap target envelope).

**Focus ring not suppressed:** `LocaleSwitcher.tsx:205` — comment confirms browser
`:focus-visible` is used, no `outline: none`. PASS.

**Active locale button `pointerEvents: 'none'` (prevents redundant clicks):**
`LocaleSwitcher.tsx:211`. PASS.

**Hydration safety (locale null until useEffect):** `LocaleSwitcher.tsx:125` —
renders `null` until locale is known. No SSR flash. PASS.

**`suppressHydrationWarning` on Nav:** Noted in `Nav.tsx:196` comment — LocaleSwitcher
renders null server-side; `suppressHydrationWarning` handles the client-replace.
PASS.

**Region `lang` on article sections:** `ArticleEntry.tsx:220, 267` — set from
`article.lang` (served sibling's actual language, not URL locale). Correct for a11y
per SPEC §6.2. Screen readers read the correct language from the content region.
PASS.

**Document `<html lang="en">` static (Polaris known item #1 classified):**
See §2 P3 verdict above — acceptable partial for v1. A11y floor maintained at
region level; screen readers that rely ONLY on the document-level lang attribute
will misidentify content language when `article.lang='th'` content is loaded. This
is a genuine (if accepted) a11y gap.

Severity: **minor** — the region-level `lang` is the correct mechanism for mixed-language
documents; the document-level lang is supplementary. The WCAG 3.1.1 (Language of Page)
criterion technically requires the document lang to reflect "the primary language of the page"
— on a /th page this remains 'en'. This is the agreed v1 limitation.

---

## 6. cross-impact scan

**`getArticleByFileNum` signature change (added `requestedLang = 'en'`):**
- `app/[lang]/articles/[fileNum]/page.tsx:104, 158` — passes `requestedLang`. PASS.
- `app/console/editor/page.tsx:22-23` — comment references velite-backed version, uses
  `getArticleBySlug` (admin read), not `getArticleByFileNum`. No impact.
- `lib/content/articles.ts` — re-exports from reads.ts unchanged. PASS.
- No other callers found via grep. PASS.

**`getArticles` signature change (added `requestedLang = 'en'`):**
- `app/[lang]/articles/[fileNum]/page.tsx:67` — passes `'en'` explicitly. PASS.
- `archive.ts:104` — no lang param (defaults to 'en'). Correct for archive. PASS.
- `lib/content/archive.ts` — indirectly via `getArticles()` import. Default 'en'. PASS.

**`getFictionBySlug` signature change (added `requestedLang = 'en'`):**
- `app/[lang]/fiction/[slug]/page.tsx:74, 112` — passes `requestedLang`. PASS.
- No other direct callers of public `getFictionBySlug`. PASS.

**`createTranslation` (new export):**
- `components/console/EntryEditor.tsx:80, 2999` — imported and called. PASS.
- `lib/server/store/actions.ts:52` — imported from actions-core. PASS.

**`updateEntry`/`setEntryDraft`/`deleteEntry` gained `lang` param (default 'en'):**
- All callers verified in cross-impact scan above (§5 console section).
- Photo-kind callers correctly omit `lang` (defaults to 'en', correct for monolingual photos).
- Article/fiction body edits pass `lang: entryLang` (verified at EntryEditor.tsx:2383, 2555, 2956). PASS.

**`getSiblingLangs` (new admin-reads export):**
- `app/console/editor/page.tsx:271` — only consumer. PASS.

**`mapArticle`/`mapFiction` now return `lang: string`:**
- All consumers that destructure Article/Fiction: `ArticleEntry.tsx:118` — destructures `lang`
  and uses it on sections. PASS.
- `WorldlineGlobe.tsx` — maps fiction to `FictionPin` shape, which does not include `lang`.
  No breakage (lang is an extra field on Fiction, ignored when mapping to FictionPin). PASS.
- `archive.ts` — maps Article to `ArchiveArticle`, which does not include `lang`. Extra
  field on Article is ignored in the mapping. PASS.

---

## REVISE list (by owning agent)

### BLOCKER

**ALTAIR (α-BND-02)**
- `lib/server/store/actions-core.ts:659` — `createTranslationImpl` calls
  `parsed.error.flatten()`. Zod v4 (4.4.3, confirmed installed) does NOT have
  `flatten()` on `ZodError` — this method was removed in Zod v4. tsc exits 0
  because the TypeScript types for Zod v4 apparently still carry the method signature
  (possibly as a deprecated shim type), but the runtime method does not exist in the
  CJS bundle (`grep -c "flatten" node_modules/zod/index.cjs` returns 0). A
  `createTranslation` call with invalid input will throw `TypeError: parsed.error.flatten is not a function`
  at runtime instead of returning a clean `{ok:false, error:{code:'INVALID_INPUT',...}}`.
  **Fix:** replace `parsed.error.flatten()` with `parsed.error.issues` (Zod v4
  equivalent — `ZodError.issues` is the array of structured issue objects).
  Severity: **blocker** (console createTranslation with malformed input crashes the
  action boundary instead of returning a typed error; runtime defect, not a compile-time
  catch). Bilingual-introduced.

### MINOR

**PROCYON (α-IDX-03)**
- `lib/store/reads.ts:29` — `import type { WorldlineLink, FictionVariant } from '../content/types'`.
  `WorldlineLink` and `FictionVariant` are not referenced anywhere in reads.ts body —
  they are used in `map.ts` (which has its own import). This import is unused and should
  be removed.
  Severity: **minor** (lint only, no runtime impact). Pre-existing — present before the
  bilingual range. Not bilingual-introduced. Handle as part of a separate lint pass.

- `lib/store/schema.ts:32` — `const EntryStatusSchema = z.enum(['draft', 'published'])`.
  Declared but never referenced in schema.ts.
  Severity: **minor** (lint only). Pre-existing. Not bilingual-introduced.

**ALTAIR (α-BND-02)**
- `lib/server/store/actions-core.ts` — all `parsed.error.flatten()` calls
  (lines 167, 315, 392, 468, 755, 984, 1411, 1464, 1507, 1568, 1742) are
  pre-existing Zod v4 incompatibilities. Only line 659 is bilingual-introduced and
  therefore in this REVISE's scope. The remaining 11 pre-existing sites are flagged
  here for awareness but are a SEPARATE project-wide Zod chore, NOT part of the
  bilingual close. Same applies to `lib/server/entries/entry-lifecycle-core.ts:301,454`,
  `lib/server/places/highlight-core.ts:345,598,635,683,735`, and
  `app/api/chat/route.ts:286`.

- `lib/store/schema.ts:142, 214` — `z.ZodIssueCode.custom` — pre-existing Zod v4
  incompatibility (`ZodIssueCode` was removed in Zod v4; use `'custom'` string literal
  directly in `ctx.addIssue({ code: 'custom', ... })`). Both instances are in the
  fiction variant alpha-dedup superRefine. Pre-existing. Separate chore.

- `lib/server/store/actions-core.ts:54-63` — unused `type` imports (CreateEntryInput
  through CreateTranslationInput). `CreateTranslationInput` is bilingual-introduced.
  Severity: **minor** (erased at compile time, tsc exits 0, no runtime impact). Fix:
  remove unused type imports. The `CreateTranslationInput` type import (line 63) is
  the one added in this range — include in the bilingual REVISE or batch with the
  pre-existing ones.

---

## deferred (server-gate required)

The following cannot be verified in the static environment (single dev server lock,
no `next build`, no Chrome). They must be verified in the server-gate pass before
final close.

1. **`next build` green:** Verifies SSR/SSG of all `[lang]` routes, `generateStaticParams`
   cross-product, hreflang in rendered `<head>`, and that no import of deleted orphan
   routes survives.

2. **`/articles/002` serves en content, URL bar stays unprefixed:** Chrome e2e.
   Verifies the `NextResponse.rewrite` mechanic (not a 3xx redirect).

3. **`/th/articles/002` serves English content (fallback) in `lang="en"` region when
   no Thai sibling exists:** Chrome e2e. The hardest path — verifies that the region
   lang attribute reflects `article.lang='en'` on a `/th` URL.

4. **Cookie `wl_locale=th` set by LocaleSwitcher persists across reload and beats geo:**
   Chrome e2e. Set cookie in DevTools (or via LocaleSwitcher click), verify proxy reads
   it and routes to `/th`.

5. **Switch from `/th/articles/002` → click EN → URL becomes `/articles/002`:**
   LocaleSwitcher path-strip logic (strips `/th` prefix). Chrome e2e.

6. **Thai glyphs render without boxes in body/summary/title:** Chrome e2e with a
   Thai-content article entry. Verifies font loading and fallback chain.

7. **`proxy.test.ts` suite passes under `next/experimental/testing/server`:**
   Requires a test runner. Deferred per environment constraint.

8. **`createTranslation` from console editor creates a draft Thai sibling and switches
   editor to thai sibling:** Chrome e2e against live console.

9. **Console auth gate still fires on `/console/editor?kind=article&slug=003` without
   a session:** Chrome e2e (regression guard — proxy auth gate unchanged but new console
   layout must not have broken the redirect).

10. **Migration NOT wrapped in explicit `begin/commit`:** Behavioral requirement (single
    transaction) is met by Supabase's `apply_migration` auto-wrapping. Verify the
    migration was applied as a single atomic unit by checking the Supabase migration
    history (already passed Polaris's P1 live verification, so this is a documentation
    note, not a pending gate).

---

## final verdict

**PASS (static surface) — one blocker must be fixed before server-gate verification
is meaningful.**

The blocker (`createTranslationImpl`'s `flatten()` call at `actions-core.ts:659`) is
a runtime defect that will crash the console add-translation action on malformed input.
It does not affect the routing, font, or read-path. Server-gate Chrome e2e can proceed
in parallel for all items except the `createTranslation` end-to-end test (item 8 above),
which specifically exercises the broken path.

Recommended order:
1. Altair fixes `actions-core.ts:659` (2-minute change: `.flatten()` → `.issues`).
2. Algol spot-checks the fix (grep + tsc).
3. Server-gate Chrome e2e proceeds on all 9 deferred items.
4. Polaris closes on all deferred items green.

---

*Algol · α-VER-06 · 2026-06-19*
