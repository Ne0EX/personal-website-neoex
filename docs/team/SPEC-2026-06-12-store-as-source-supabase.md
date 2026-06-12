# SPEC 2026-06-12 — Store-as-source on Supabase · finish worldline-console

> **Authority:** Peat directive 2026-06-12 ("finish worldline-console completely — create/delete article, upload/delete photo, everything syncs with the public site; content+media ONLINE in a database, nothing new leaks into git") + Peat-approved D0–D7 (`~/.claude/plans/recursive-sparking-stardust.md` §6) + implement-plan `docs/team/IMPLEMENT-PLAN-2026-06-09-worldline-foundation.md` §2 Phase A.
> **Stack (DECIDED, closes PRD §7 "store tech / auth / media"):** Supabase — project ref `aitqswnbtpexrxqpoiwo`, region `ap-southeast-1`, **FREE TIER** (≈500MB DB, ≈1GB storage, **no server-side image transform API** → variants pre-generated with sharp, same as today's pipeline). Standalone Worldline store (NOT shared with personal-os).
> **This spec is Phase A (A1–A6) made concrete.** Engineers implement WITHOUT reopening design. Phase B edges / embeddings / NETRA graph-RAG are extension points only (§2.6) — do **not** build them this round.

---

## 1 · Decision log (this spec's calls — conflicts decided here, with rationale)

| # | decision | rationale |
|---|---|---|
| **DL1** | **`status` enum = `draft\|published`** (publish state). The old velite `status` maturity ladder (`seed\|ongoing\|refined\|settled`, `velite.config.ts:68`) becomes column **`maturity`**. The read API maps back: served `Article.status = maturity`, `Article.draft = (status='draft')` — every consumer (globe stage radius, archive, editor) stays byte-compatible. | Directive names `status draft\|published`; visibility.ts explicitly warns not to conflate the two — DB names disambiguate, API mapping preserves contracts. |
| **DL2** | **Dev-draft-preview on public routes is RETIRED.** `lib/content/visibility.ts:34-36` (`NODE_ENV` branch) no longer governs: public reads go through the **anon** Supabase client and RLS returns published rows only, in ALL environments. Draft preview lives in the console editor (which sees everything via the authed client). `visibility.ts` stays in the tree as a compile-compat no-op on public paths. | One read path; the app server never holds `SUPABASE_SECRET_KEY` (directive: secret = migration/admin scripts ONLY), so there is no privileged runtime read to emulate the old dev behavior. |
| **DL3** | **Photo upload is direct-to-storage, NOT FormData-through-server-action.** Browser (authed) uploads the original to the private `originals` bucket via supabase-js, then calls `ingestPhoto` server action with just the object key. | Conflict with the sketch ("FormData → sharp"): Next server-action body default is **1MB** (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md` §bodySizeLimit) and Vercel functions cap request bodies at **~4.5MB** — an X-E5 JPEG is 15–25MB. Direct-to-storage is the only path that works deployed. Still chunked per photo (one upload + one action per file). Storage RLS keeps it Peat-only. |
| **DL4** | **MDX body render lands this round** through the existing seam (`components/ArticleEntry.tsx:86` `body?: ReactNode`; `components/FictionEntry.tsx:149-153` `WAIT(Procyon)`), compiled from the DB `body` column with `@mdx-js/mdx` `evaluate` server-side. | Pulls implement-plan Phase D1 forward — authorized by Peat 2026-06-12 "finish console completely / everything syncs": a created article whose body never renders publicly is not synced. Bodies are plain Markdown today (recon: zero JSX in any body), so risk is minimal; the seam was designed for exactly this. |
| **DL5** | **Pagefind index rebuilds at deploy, from the store** (anon client → published rows only, consuming `map.ts`-SERVED records §6.3). Staleness is **bounded ≤1 week**: a weekly scheduled Vercel Deploy Hook (§11) rebuilds the index, and PublishPanel's done state offers a **REINDEX** affordance (§8) firing the same hook for publishes that want immediate searchability. | Pre-store every publish WAS a deploy, so the index could never lag content; post-store publishes don't deploy, so without a bound a published entry could stay invisible to Triangulate (a public surface) indefinitely. Weekly hook + opt-in REINDEX restore a bound without building runtime search (PRD §4 "later"). The same weekly hook is the free-tier auto-pause keep-alive (§4.4) — one mechanism, two problems. |
| **DL6** | **NETRA untouched this round.** `app/api/chat/route.ts` tools are stubs (recon: "no tools implemented yet"); nothing there reads velite at runtime. Wiring to the store = Phase C. | Directive allows deferring NETRA if public pages + search stay correct. They do. |
| **DL7** | **velite leaves the build.** `package.json:7` becomes `next build && npm run index:search`. `velite.config.ts` is kept (read-only reference for schema parity) until S9 passes, then deletable. `.velite/` goes dead. | `content/**` becomes a gitignored export (§9) — fresh clones/Vercel have no MDX files, so a velite build step would produce empty collections and break everything. The store is the source (D4). |
| **DL8** | **`worldline_links` stays a `jsonb` column on entries** (mirror of today's frontmatter). The typed/weighted/provenance **edges table is a documented extension point only** (§2.6) — do not create it. | D5/D6 (weave, graph-RAG) are explicitly out of this round's scope per the directive. The jsonb column keeps `lib/content/worldline.ts` semantics identical. |
| **DL9** | **Hard delete.** `deleteEntry` removes the DB row AND its storage objects (variants + original). No soft-delete state. | Directive: "delete photo … DB row + storage objects". Git history of the MDX era + future MDX exports are the recovery layer (D2). |
| **DL10** | **`content/` itself becomes the gitignored export directory.** `git rm --cached -r content` + `.gitignore` entry; history stays (D2 "MDX-in-git = history/backup"). The export script (§10) writes snapshots back into `content/` in today's exact layout. | Satisfies both directive clauses ("content/** becomes gitignored exports" + "writes MDX snapshots to a gitignored export dir") with one directory and familiar diffable paths. |
| **DL11** | **Cache strategy = static prerender + `revalidatePath('/', 'layout')` on every mutation.** No `cacheComponents` / `cacheTag` adoption this round. | Personal-gallery scale (D0): dozens of pages; one layout-wide invalidation per write is correct and instant (verified `revalidatePath.md`: callable in Server Functions, `'layout'` type invalidates everything beneath root). Tag bookkeeping buys nothing at this scale; revisit with the weave. |
| **DL12** | **Auth = Supabase email+password, single user, signups disabled.** Closes PRD §7 auth-provider question (Auth.js candidate from the implement-plan §1 table is dropped — Supabase Auth ships with the decided stack; one fewer dependency, RLS integrates natively). Signup-disable is **codified in versioned config** (§3.2), not a dashboard click. | Stack decision implies it; allowlist enforced in DB (§3.1), not just app code. A dashboard toggle can silently revert on re-create/restore; config survives. |
| **DL13** | **Privacy Layer 2 moves to the DB trust boundary.** Raw `coords` is NOT anon-readable: anon's table-level SELECT on `entries`/`rolls` is revoked and re-granted column-by-column EXCLUDING `coords` (§3.2; same treatment drops `photo_assets.original_key`/`source_hash`). A trigger-maintained **`served_coords jsonb`** is what anon reads: photos/rolls → `share_location ? round2(coords) : null`; articles/fiction → `round2(coords)` (authored city-centroids unaffected in practice). `map.ts` consumes `served_coords`; raw coords are owner-only (cookie client / admin-reads). | RLS is row-level only — PostgREST exposes every granted COLUMN of visible rows to the publishable key, which ships in the browser bundle by design. App-side gating in `map.ts` is bypassed by `GET /rest/v1/entries?select=coords&status=eq.published`; in the velite world raw coords never reached any public artifact. Column grants + SQL-computed served value are the only placement where the 2-decimal locality policy (Peat 2026-06-01) actually holds. Residual (named): `authenticated` keeps the columns — safe because signups are config-disabled (DL12) and `private.owners` is the floor. |
| **DL14** | **Per-kind required-field CHECKs bind PUBLISHED rows only.** §2.4 article/fiction completeness CHECKs gain a `status <> 'published' or …` guard; drafts may be minimal. `lib/store/schema.ts` enforces full per-kind completeness inside `setEntryDraft`'s publish path — publish refused with a missing-field list until complete. | The new-entry form (`ConsoleApp.tsx:249`) collects only kind/title/date/domain/tags/summary — INSERT-time completeness would make every console article-create fail at the DB, breaking the first directive capability. Draft-required vs publish-required is a design call: decided here, not at implementation. |
| **DL15** | **Place lifecycle moves to table-writes; `place-registry.data.json` is FROZEN.** `createPlace`/`savePlaceCoord` are ported as §7 store actions (the console's add-place / fix-coord flows survive, `assertDev` → `assertOwner`); the JSON file becomes migration-input + pre-store history only — never hand-edited again (S8 prepends a header comment pointing at the `places` table; it may stay tracked as pre-store history). | `PlaceHighlightEditor.tsx:54-56,593,623` calls `savePlaceCoord`/`createPlace` (`place-actions.ts`), whose impls rewrite the git-tracked JSON (`highlight-core.ts:57,:291`). Unported: either new content leaks into git while the runtime reads the `places` table (directive violation + sync break — the new place never appears publicly), or the flows break and §2.4's highlight CHECKs lose their producer. |

---

## 2 · Postgres schema (DDL — apply as migration `0001_store_as_source.sql`)

Field superset is ground-truthed against `velite.config.ts:98-187` (articles), `:267-369` (fiction), `:394-437` (rolls), `:470-686` (photo sidecars), and `lib/content/place-registry.data.json`.

### 2.1 Enums + helpers

```sql
create type entry_kind   as enum ('article','fiction','photo');
create type entry_status as enum ('draft','published');

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
```

### 2.2 `places` — port of `lib/content/place-registry.data.json` (data-only registry, 4 L1 rows)

```sql
create table public.places (
  id        text primary key,                      -- kebab slug ('bangkok')
  level     int  not null default 1 check (level in (1,2)),
  parent_id text references public.places(id),
  name      text not null,                         -- 'Bangkok · TH'
  lat       double precision not null,
  lon       double precision not null
);
```

### 2.3 `rolls` — port of roll.mdx descriptors (`velite.config.ts:394-437`)

```sql
create table public.rolls (
  roll           text primary key
                 check (roll ~ '^\d{4}-\d{2}-[a-z0-9-]+$'),
  id             text not null,                    -- legacy roll.mdx frontmatter `id` (bangkok=DSCF0002, chiang-mai=DSCF0001);
                                                   -- console photo nodes read Photo.id (`app/console/page.tsx:155-161`,
                                                   -- `editor/page.tsx:106-108`) — keep it so Photo stays field-for-field identical (§6.1)
  caption        text,
  share_location boolean not null default false,
  coords         jsonb,                            -- raw {lat,lon,place} | null — anon-REVOKED (DL13, §3.2)
  served_coords  jsonb,                            -- trigger-maintained (DL13): share_location ? round2(coords) : null
  date           text not null check (date ~ '^\d{4}\.\d{2}\.\d{2}$'),
  iso_date       date not null,
  body           text not null default '',         -- roll.mdx prose lede (may be empty — chiang-mai's body is a lone
                                                   -- placeholder comment, normalized to '' at migration §9.2)
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create trigger rolls_updated before update on public.rolls
  for each row execute function public.set_updated_at();
```

### 2.4 `entries` — the unified content table

```sql
create table public.entries (
  id                  uuid primary key default gen_random_uuid(),
  kind                entry_kind   not null,
  slug                text         not null,   -- article: '003' · fiction: 'transmission-001' · photo: '<roll>/<id>'
  status              entry_status not null default 'draft',

  -- shared authored fields
  title               text,
  date                text not null check (date ~ '^\d{4}\.\d{2}\.\d{2}$'),
  iso_date            date not null,
  domain              text check (domain in ('identity','reflection','method','meta')),
  tags                text[] not null default '{}',
  summary             text,
  coords              jsonb,                    -- RAW {lat,lon,place} — anon-REVOKED at column level (DL13, §3.2); never anon-readable
  served_coords       jsonb,                    -- trigger-maintained (DL13) — the ONLY coords anon can read
  share_location      boolean not null default false,
  place_id            text references public.places(id),
  highlight_for_place boolean not null default false,
  patches             jsonb not null default '[]'::jsonb,   -- [{n,date,note}]
  worldline_links     jsonb not null default '[]'::jsonb,   -- [{to,label?}] (DL8)
  body                text  not null default '',            -- raw MDX body

  -- article-only
  maturity            text check (maturity in ('seed','ongoing','refined','settled')),  -- old velite `status` (DL1)
  reading_time        int,

  -- fiction-only
  origin_locus        jsonb,
  variants            jsonb,                    -- [{alpha,delta_summary,drift?,slug?}] ≤4, unique alpha (app-validated)
  divergence_cluster  text,

  -- photo-only
  roll                text references public.rolls(roll),
  photo_id            text,                     -- 'DSCF0001'
  caption             text,
  override_place      text,
  highlight_rank      int check (highlight_rank between 1 and 5),

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (kind, slug),

  -- per-kind slug shape — ports the path-containment regexes
  -- (lib/server/entries/entry-lifecycle-core.ts:220-250) into the DB
  check (kind <> 'article' or slug ~ '^\d{3}$'),
  check (kind <> 'fiction' or slug ~ '^[a-z0-9-]+$'),
  check (kind <> 'photo'   or slug ~ '^\d{4}-\d{2}-[a-z0-9-]+/[A-Za-z0-9_-]{1,40}$'),

  -- per-kind required/forbidden fields — completeness binds at PUBLISH only (DL14); drafts may be minimal
  check (kind <> 'photo'   or (roll is not null and photo_id is not null and slug = roll || '/' || photo_id)),
  check (kind  = 'photo'   or (roll is null and photo_id is null)),
  check (kind <> 'article' or status <> 'published'
                           or (title is not null and domain is not null and maturity is not null
                               and reading_time is not null and summary is not null and coords is not null)),
  check (kind <> 'fiction' or status <> 'published'
                           or (title is not null and domain is not null and summary is not null)),
  check (kind <> 'photo'   or domain is null),
  -- highlights require an explicit place (console highlight editor always writes place_id)
  check (not highlight_for_place or place_id is not null),
  check (highlight_rank is null or place_id is not null)
);

create index entries_kind_status on public.entries (kind, status);
create index entries_roll        on public.entries (roll) where kind = 'photo';
create index entries_place       on public.entries (place_id) where place_id is not null;

-- cross-record constraints, today enforced at build in lib/content/places.ts assertHighlightConstraints():
-- max 1 article highlight per place; photo ranks unique per place (rank ∈ 1..5 ⇒ max 5 per place)
create unique index one_article_highlight_per_place on public.entries (place_id)
  where kind = 'article' and highlight_for_place;
create unique index photo_rank_unique_per_place on public.entries (place_id, highlight_rank)
  where kind = 'photo' and highlight_rank is not null;

create trigger entries_updated before update on public.entries
  for each row execute function public.set_updated_at();

-- DL13: SQL-computed privacy gate. set_served_coords() (plpgsql, before insert/update on
-- entries + rolls): photo entries + rolls → share_location ? {lat,lon rounded to 2 decimals} : null;
-- article/fiction entries → coords rounded to 2 decimals. served_coords is therefore safe
-- BY CONSTRUCTION for any reader — the round/gate cannot be skipped by bypassing app code.
create trigger entries_served_coords before insert or update of coords, share_location
  on public.entries for each row execute function public.set_served_coords();
create trigger rolls_served_coords before insert or update of coords, share_location
  on public.rolls for each row execute function public.set_served_coords();
```

### 2.5 `photo_assets` — EXIF + variant manifest (port of `.cache/<id>.json`, `scripts/process-photos.ts:295-296,377-387`)

```sql
create table public.photo_assets (
  entry_id     uuid primary key references public.entries(id) on delete cascade,
  original_key text,          -- key in 'originals' bucket; NULL until an original is ingested (§9.4)
  source_hash  text,          -- 10-char SHA-1 of source JPEG (content-addressed idempotency, as today)
  exif         jsonb,         -- {camera,lens,filmSim,aperture,shutter,iso,focal,focal35,captureTime} | null
  variants     jsonb          -- {thumb|medium|full: {jpg,webp,avif}} of BUCKET-RELATIVE keys (§4.2) | null
);
```

`exif.coords` is **never** stored here — EXIF GPS is dropped at ingest unless `share_location` (Layer-1 gate ported from `scripts/process-photos.ts:361-372`); raw declared coords live only in `entries.coords`, **anon-revoked at the column level with `served_coords` as the only anon-readable value** (Layer 2, DL13 + §3.2 — the gate holds against direct PostgREST access, not just app reads). Both defence layers survive the migration (recon risk: "must preserve both gates"). `original_key` + `source_hash` are likewise anon-revoked (they advertise exact private-bucket paths).

### 2.6 Extension point — edges + embeddings (D5/D6 — **DO NOT BUILD this round**)

Documented shape for Phase B, reserved names, no DDL applied:

```sql
-- PHASE B (do not create now):
-- create table public.edges (
--   id uuid primary key default gen_random_uuid(),
--   from_entry uuid not null references public.entries(id) on delete cascade,
--   to_entry   uuid not null references public.entries(id) on delete cascade,
--   type text not null, weight real not null default 1.0,
--   provenance text not null check (provenance in ('declared','derived')),
--   state text not null default 'accepted' check (state in ('suggested','accepted','rejected')),
--   unique (from_entry, to_entry, type)
-- );
-- embeddings: enable extension vector; add column entries.embedding vector(1536) + ivfflat index.
-- Migration path: worldline_links jsonb (DL8) backfills edges(provenance='declared') in Phase B.
```

---

## 3 · RLS — single-user allowlist (Peat), public reads published-only

### 3.1 Owner allowlist

```sql
create schema if not exists private;
create table private.owners (user_id uuid primary key);
-- seeded once by scripts/setup-owner.ts (§5.2) with Peat's auth uid

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as
$$ select coalesce((select auth.uid()) in (select user_id from private.owners), false) $$;
-- security definer: callable by anon/authenticated without exposing private.owners.
-- (select auth.uid()) wrapper = initplan caching per supabase-postgres-best-practices.
```

### 3.2 Table policies

```sql
alter table public.entries      enable row level security;
alter table public.rolls        enable row level security;
alter table public.places      enable row level security;
alter table public.photo_assets enable row level security;
alter table private.owners      enable row level security;   -- no policies ⇒ no API access at all

-- entries: public sees published; owner sees everything; owner-only writes
create policy entries_read   on public.entries for select using (status = 'published' or (select public.is_owner()));
create policy entries_insert on public.entries for insert with check ((select public.is_owner()));
create policy entries_update on public.entries for update using ((select public.is_owner())) with check ((select public.is_owner()));
create policy entries_delete on public.entries for delete using ((select public.is_owner()));

-- rolls + places: public read, owner-only writes (same insert/update/delete trio as entries)
create policy rolls_read  on public.rolls  for select using (true);
create policy places_read on public.places for select using (true);
-- …owner-only insert/update/delete policies identical in shape to entries_*.

-- photo_assets: visible iff parent entry is visible (drafts' exif/variants don't leak)
create policy assets_read on public.photo_assets for select using (
  exists (select 1 from public.entries e
          where e.id = entry_id and (e.status = 'published' or (select public.is_owner())))
);
-- …owner-only insert/update/delete.

-- DL13 column grants. Postgres column privileges don't SUBTRACT from a table grant,
-- so: revoke anon's table-level SELECT, re-grant explicitly column-by-column EXCLUDING
-- the raw columns. The migration enumerates every column; excluded from anon:
--   entries.coords · rolls.coords · photo_assets.original_key · photo_assets.source_hash
revoke select on public.entries      from anon;
revoke select on public.rolls        from anon;
revoke select on public.photo_assets from anon;
grant  select (/* all columns EXCEPT coords */)                    on public.entries      to anon;
grant  select (/* all columns EXCEPT coords */)                    on public.rolls        to anon;
grant  select (/* all columns EXCEPT original_key, source_hash */) on public.photo_assets to anon;
```

**Signups disabled — codified, not a dashboard click (DL12):** S1 sets `enable_signup = false` (email confirmations off, all OAuth providers off) via `supabase/config.toml` / Management API **as part of the migration step**, so it is versioned and survives project re-create/restore instead of silently drifting. S9 hard-gates it: `signUp` with the publishable key must be refused. This is surface-reduction only — `private.owners` is the real authorization floor: a rogue authenticated account is not an owner, so RLS grants it nothing beyond anon-equivalent published reads.

---

## 4 · Storage

### 4.1 Buckets

| bucket | public | file_size_limit | holds |
|---|---|---|---|
| `photos` | **yes** (public read via CDN URL) | 25MB | pre-generated variants only |
| `originals` | **no** (private) | 50MB | source JPEGs (RAW/HEIC decode = later phase per D7) |

Create via Supabase MCP/dashboard with exactly this config.

### 4.2 Object key scheme (ports `scripts/process-photos.ts:235-237,270`)

- originals: `originals/<roll>/<photo_id>.<ext>` → e.g. `2026-05-bangkok/DSCF0002.jpg`
- variants: `photos/<roll>/<photo_id>/<size>-<sourceHash10>.<fmt>` — size ∈ `thumb|medium|full` (320/1280/2400px), fmt ∈ `jpg|webp|avif`, quality tiers identical to `process-photos.ts:90-100`.

`photo_assets.variants` stores **bucket-relative keys**. `lib/store/media.ts` exposes `publicVariantUrl(key) = ${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${key}`; the read mapper (§6.2) assembles full URLs into the served `variants` field so `components/PhotoEntry.tsx:373-380` and `components/RollIndex.tsx:37-73` consume them unchanged (they treat `variants.medium.webp` as an opaque URL string).

### 4.3 Storage policies (`storage.objects`)

```sql
-- NO anon select policy on the photos bucket: public-bucket objects already serve via
-- /storage/v1/object/public/** WITHOUT RLS; omitting the policy keeps anon LISTING off,
-- so draft-variant exposure is capability-URL-only (see note below).
create policy buckets_owner_read on storage.objects for select to authenticated
  using (bucket_id in ('photos','originals') and (select public.is_owner()));
create policy owner_insert on storage.objects for insert to authenticated
  with check (bucket_id in ('photos','originals') and (select public.is_owner()));
-- …owner-only update/delete with the same predicate.
```

**Accepted exposure — draft variants are capability URLs.** Variants of DRAFT photos live in the public `photos` bucket from ingest onward: anyone holding the exact URL can fetch them. Accepted for a single-author site because the key embeds the unguessable `sourceHash10` (§4.2 — the migration/ingest MUST always include it, also for draft photos) and anon cannot list the bucket (no select policy above); RLS on `photo_assets` hides draft keys from the API. Revisit with a private-bucket + publish-time copy if this ever stops being acceptable. The S9 draft-leak probe covers this storage side explicitly (§12). Variants upload with `cacheControl: 3600` so a deleted object stops resolving from the CDN within an hour (§7 deleteEntry).

### 4.4 Free-tier quota + availability cliffs (explicit)

Ground truth: the repo holds **zero** image binaries today — `content/photos` is 28K of .mdx; no source JPEGs and no `.cache/` exist on this checkout (recon `find`). Budget per photo ≈ original 15–25MB + variants ≈ 4–6MB ⇒ free 1GB ≈ **~30–50 photos with originals** (~32 at the 31MB worst case, ~50 at the 15MB end), or 150–200 variants-only. This covers the current 5-photo corpus (~100–155MB) with headroom. **Upgrade path (documented, not built):** at ~70% quota either (a) Supabase Pro $25/mo → 100GB, or (b) D7 cold-storage move — originals migrate to R2/local archive, variants stay; `photo_assets.original_key` becomes an external URI. Decision deferred until the quota is actually approached.

Storage is **not** the only free-tier ceiling:

- **Auto-pause:** free projects are paused after ~1 week of low API activity. DL11's full prerender makes a quiet week plausible (cached pages never hit the DB; no publish ⇒ no traffic). A paused project breaks first-visit renders of new slugs, the console, photo variant URLs, AND the next deploy (build queries the store in `generateStaticParams`, §11). **Mitigation:** the weekly scheduled Deploy Hook (§11) — the build's store queries are the keep-alive; the same hook bounds search staleness (DL5). **Recovery:** dashboard → Restore project (manual unpause), then redeploy.
- **Egress:** ~5GB/month on the public `photos` bucket CDN — the dimension a traffic spike hits first on a photo site. Watch it alongside the ~70% storage trigger.

---

## 5 · Auth — single user, login at /console

### 5.1 Clients (deps: `@supabase/supabase-js`, `@supabase/ssr`)

- `lib/store/supabase/anon.ts` — module-singleton `createClient(URL, PUBLISHABLE_KEY)`. Used by ALL public reads incl. `generateStaticParams` (no cookies — safe at build time).
- `lib/store/supabase/server.ts` — `createServerClient` (cookie-bound, `@supabase/ssr`). Used by console pages, server actions, ingest. Reading cookies makes console routes dynamic — correct.
- `lib/store/supabase/browser.ts` — `createBrowserClient`. Used by the login form + direct-to-storage upload (DL3).

### 5.2 Owner bootstrap — `scripts/setup-owner.ts` (run locally, ONCE, with `SUPABASE_SECRET_KEY`)

1. `auth.admin.createUser({ email: 'neospiritth@gmail.com', password: <prompted, not logged>, email_confirm: true })`.
2. `insert into private.owners (user_id) values (<created uid>)`.
3. Prints the uid; idempotent (skips if user/row exists).

### 5.3 Gate replacement — `proxy.ts`

Current behavior (`proxy.ts:33-46`): production 404 unless `WORLDLINE_AUTHORING=1`. **Superseded (PRD §8) — but the proxy STAYS fail-closed:**

- `proxy.ts` keeps matcher `['/console', '/console/:path*']`, does the `@supabase/ssr` session-refresh pass (cookie refresh), then calls `getUser()`: **no user ⇒ every matched path is rewritten to `/console`** (which renders `<ConsoleLogin/>`, §8.1) — the requested console route never executes. The proxy remains the single deny-by-default choke point: a future console sub-route added without its own page gate is still unreachable unauthenticated. No `WORLDLINE_AUTHORING` (flag retired everywhere). The rewrite does NOT ship to production until the S4 fail-closed gate passes.
- `app/console/page.tsx` + `app/console/editor/page.tsx`: server-side `supabase.auth.getUser()`; **no user → render `<ConsoleLogin/>`** — defence-in-depth BEHIND the proxy, not the gate itself. Authed non-owner is impossible by construction (signups disabled) but is treated as unauthenticated anyway.
- Every server action calls `assertOwner()` (replaces `assertDev()`, `lib/server/places/highlight-core.ts:67-83` / `entry-lifecycle-core.ts`): `getUser()` non-null AND `rpc('is_owner')` true, else `{ok:false, error:{code:'AUTH'}}`. **Final enforcement is RLS** — even a bypassed action cannot write (defence in depth; proxy/UI are convenience layers only).

### 5.4 Env vars

| var | where | use |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` + Vercel | all clients (already present in `.env.local`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local` + Vercel | anon + browser clients (already present) |
| `SUPABASE_SECRET_KEY` | `.env.local` ONLY — **never Vercel, never the app runtime, never the client bundle** | `scripts/migrate-to-store.ts`, `scripts/setup-owner.ts`, `scripts/export-mdx.ts`, `scripts/sweep-storage-orphans.ts` only |

**Secret containment is repo-wide, not bundle-only:** a CI/pre-commit grep (§11) scans ALL tracked files for `sb_secret_` / the literal key and asserts `SUPABASE_SECRET_KEY` is referenced only under `scripts/**` — never `app/**` or `lib/store/**`. The S8 client-bundle grep alone misses server-side references and stray debug dumps (`.gitignore`'s `.env*` only catches dotenv-shaped files). Backstop: the key is absent from Vercel, so even an accidental server reference is `undefined` in prod.

---

## 6 · Data-access layer — `lib/store/**` replaces every velite consumer

### 6.1 Modules

```
lib/store/
  supabase/{anon,server,browser}.ts   (§5.1)
  types.ts        hand-written Article/Fiction/Photo/PhotoSidecar/Place interfaces — field-for-field
                  identical to today's velite-inferred shapes (lib/content/types.ts:1-269 enumerates them)
  schema.ts       zod schemas porting velite validation (velite.config.ts regexes/enums/limits incl.
                  variants≤4 + unique-alpha superRefine :312-325) — shared by write actions + migration
  map.ts          row → served record (§6.2)
  reads.ts        every public read fn (anon client). Anon reads enumerate columns explicitly —
                  never select('*'): the DL13 column grants make star-select fail for anon
  admin-reads.ts  getAll* console variants (cookie server client → RLS shows drafts)
  media.ts        publicVariantUrl (§4.2)
  mdx.tsx         renderMdxBody(source): Promise<ReactNode> — @mdx-js/mdx `evaluate` + react/jsx-runtime,
                  components: { Pullquote } (components/Pullquote.tsx) (DL4)
```

### 6.2 `map.ts` — the contract-preserving mapper (load-bearing)

- `draft` = `status === 'draft'`; article `status` (served) = `maturity` (DL1).
- `isoDate` = `iso_date` as `YYYY-MM-DD` string (velite parity, `velite.config.ts:182-186`).
- **Privacy Layer 2 is DB-enforced (DL13), not mapper-enforced:** `map.ts` consumes the trigger-maintained `served_coords` column (photos/rolls: null unless `share_location`, rounded 2 decimals ~1.1km — semantics of `velite.config.ts:609-641`; articles/fiction: rounded 2 decimals — authored city-centroids are unaffected in practice, and the boundary now also holds if a future article is anchored somewhere precise). Raw `coords` never reaches the anon client at all (column grants §3.2); served public records carry no raw coords, exactly as the velite build artifact did. Owner editing reads raw coords via `admin-reads` (cookie client).
- photo `variants` keys → full public URLs via `media.ts`; `exif` passed through; both `undefined` when `photo_assets` row is null/empty (components already render placeholders — `PhotoEntry.tsx`, `RollIndex.tsx`).
- roll-descriptor (`Photo`) records map `rolls.id` → `Photo.id` (legacy field the console photo nodes/editor lookup read — §2.3).

### 6.3 Swap list — consumer by consumer (signatures FROZEN; `lib/content/*` become thin re-exports of `lib/store`, so `@/lib/content` import sites do not change)

| consumer (velite read site) | swap |
|---|---|
| `lib/content/articles.ts:27` (`import('.velite')`) | `getArticles/getAllArticles/getArticleByFileNum/getRecentArticles/getRelatedArticles` → `lib/store/reads.ts` (+`admin-reads` for `getAllArticles`); sort/filter logic ports as-is |
| `lib/content/fiction.ts:30` | `getFiction/getAllFiction/getFictionBySlug/getFictionSiblings` (SITE_ALPHA drift math ports unchanged) |
| `lib/content/photos.ts:35,62` | all 10 fns. `getRollContacts(roll, rollMdxBody)` keeps its signature; the caller now passes `rolls.body` from the store |
| `app/photos/[roll]/page.tsx:88-127` `fs.readFile(roll.mdx)` | replaced by `getRollBody(roll): Promise<string \| null>` — **null = no `rolls` row**; the `:115-127` 404 branch (today an `fs.access` existence probe) ports onto null, so a known roll with empty body still 200s and an unknown roll still 404s |
| `lib/content/worldline.ts:85` (corpus + reverse index) | corpus loads from 3 store queries; broken-link `console.warn` validation moves to request/build-time load (acceptable: same warnings, surfaced at first read; recon risk noted + accepted) |
| `lib/content/places.ts:129,136` + `place-registry.data.json` | registry → `places` table (the JSON is frozen post-migration, DL15); `deriveArticlePlaceId/derivePhotoPlaceId` fallback logic (`place-registry.ts:165-200`) stays pure/unchanged; `assertHighlightConstraints` becomes a no-op shim (DB indexes §2.4 now enforce); place WRITES → §7 store actions |
| `lib/content/types.ts:15-20` (`import type {…} from '../../.velite'`) | re-point the `Article/Fiction/Photo/PhotoSidecar` type exports at `lib/store/types.ts` (S3 — without this, `tsc` breaks the moment `.velite/` is gone on a fresh clone) |
| `lib/content/archive.ts:190` | `getArchiveEntries/getArchiveEntriesByYear/getMiniGlobePins` — ArchiveEntry mapping ports as-is |
| `lib/content/globe-pins.ts` | no direct velite import — unchanged |
| `app/layout.tsx:44-45`, `app/archive/page.tsx`, all entry routes' `generateStaticParams`/`generateMetadata` | unchanged — functions swapped underneath. **One contract added:** every detail route calls `notFound()` when the store read returns null — a single path that 404s both deleted entries (their stale URL must not re-render with `dynamicParams: true`, §6.4) and draft probes |
| `app/console/page.tsx:73-76`, `app/console/editor/page.tsx` | switch to `admin-reads` (cookie client, drafts visible) |
| `scripts/inject-pagefind-sidecar.ts:369-372` (`.velite/*.json` reads) | read the same four datasets **through `lib/store/map.ts`-served records** (same mapper as public reads — DL1's status/maturity mapping and the DL13 coords gate apply to the search index by construction; raw rows would feed `status='published'` where the templates expect the maturity ladder), via **anon** client (RLS = published-only ⇒ the script's own draft filter at `:93` becomes redundant but harmless) (DL5) |
| `components/ArticleEntry.tsx:86` + `FictionEntry.tsx:149-153` body seams | article/fiction pages pass `body={await renderMdxBody(entry.body)}` (DL4); omitted-body fallback behavior retained for empty bodies |
| `lib/content/visibility.ts` | retained, semantics per DL2 |
| NETRA `app/api/chat/route.ts` | untouched (DL6) |

### 6.4 Caching / instant publish (DL11)

- All public routes keep `generateStaticParams` (now enumerating from the store at build). `dynamicParams` stays default `true` ⇒ an entry **published after deploy renders on first visit** and is then cached — this is the no-rebuild path for NEW slugs.
- Every write action ends with `revalidatePath('/', 'layout')` ⇒ all pages (entry pages, /archive, layout globe pins) regenerate on next visit. **D3 acceptance: store-write → revalidate → live in seconds, zero builds.**
- Module-level lazy caches in `lib/content/*` (`_articles` etc.) are **dropped** in `lib/store` — each render queries the store; renders are cached by the static layer, so query volume = regenerations, not page views. At personal scale this is free-tier-trivial.

---

## 7 · Write path — server actions (supersede `lib/server/entries/*` + `lib/server/places/*` file-writes)

All in `lib/server/store/` (`'use server'` thin wrappers + testable core, same layering as today's `entry-actions.ts`/`entry-lifecycle-core.ts`). Every action: (1) `assertOwner()` (§5.3) → (2) zod validation via `lib/store/schema.ts` (the DB CHECKs §2.4 are the backstop) → (3) mutation through the **cookie server client** (RLS enforces) → (4) `revalidatePath('/', 'layout')` → (5) return the authoritative record (`{ok:true, …}` / `{ok:false, error:{code,message}}` — same envelope as `entry-actions.ts:93-119` so existing UI handlers keep working).

| action | I/O + behavior |
|---|---|
| `createEntry` | `{kind, fields…, body?}` → insert with `status='draft'` — **minimal drafts are valid (DL14)**: kind+slug suffice; blank `date` defaults to today (the `date` NOT NULL + regex CHECK still binds at insert). Article slug = next free fileNum unless given; returns full entry. Fiction `variants` unique-alpha validated. |
| `updateEntry` | `{kind, slug, patch}` — any authored field **incl. `body`** (editor SAVE), `maturity`, `patches`, coords, tags… |
| `setEntryDraft` | `{kind, slug, draft:boolean}` → maps to `status` (DL1). **Publish path (`draft:false`) re-validates full per-kind completeness via `lib/store/schema.ts` and refuses with a missing-field list until complete (DL14).** Contract identical to `entry-actions.ts:93-97` — `EntryEditor.tsx:1707-1723` handlers swap import only. |
| `deleteEntry` | `{kind, slug}` → kind=photo: **storage first, row second** — list+remove `photos/<roll>/<photo_id>/*` variants + the `original_key` object, **verify the bucket prefix lists empty**, then delete the row (`photo_assets` cascades). Partial storage failure ⇒ `{ok:false}` with the surviving keys, row intact (retry-safe; the orphan sweep below is the reconciler). Variants were uploaded with `cacheControl: 3600` (§4.3) so the CDN stops serving within an hour. Returns `{ok, deleted}` (same contract as `entry-actions.ts:115-119`). (DL9) |
| `createRoll` | `{roll, date, caption?, shareLocation?, coords?, body?}` → insert `rolls` row. |
| `ingestPhoto` | `{roll, photoId, originalKey}` — server side of the upload (DL3): download original from `originals` (owner session) → `exifr` extract (port `process-photos.ts:321-372` incl. FUJI_SIM_MAP `:108-153` and the GPS-drop Layer-1 gate) → `sharp` 3×3 variants (port `:90-100,232-276` — **`.withMetadata()` is FORBIDDEN in the port**: the current generator strips all EXIF incl. GPS by default and `.rotate()` bakes orientation first; re-adding it would re-embed GPS into the world-readable bucket; S5 gates with exifr) → upload variants to `photos` bucket (`cacheControl: 3600`) → **upsert** `entries(kind='photo', status='draft')` + `photo_assets` keyed by `(kind, slug)`. **Upsert is collision-guarded:** it fills missing exif/variants on a migrated sidecar (§9.4); if the existing row already HAS variants, refuse without explicit `overwrite: true` (prevents a colliding photoId from silently destroying another photo's assets). Add `export const maxDuration = 60` to `app/console/page.tsx` + `app/console/editor/page.tsx` (sharp on a 40MP JPEG needs headroom). |
| `createPlace` | `{id, name, lat, lon, level?, parentId?}` → insert `public.places` row. Same return contract as `place-actions.ts:114-117` (DL15). |
| `savePlaceCoord` | `{placeId, lat, lon}` → update `public.places`. Same return contract as `place-actions.ts:97-100` (DL15). |
| `savePlaceHighlights` | `{placeId, articleSlug\|null, photoFrames:[{roll,id}]}` — port `highlight-core.ts` to a single Postgres function `public.save_place_highlights(...)` (security **invoker** ⇒ RLS applies), called via `rpc`: clears the place's old highlight fields + sets new ones in one transaction; partial unique indexes (§2.4) are the integrity backstop. Same return contract as `place-actions.ts:82-86` so `ConsoleApp.onPlaceSaved` (`ConsoleApp.tsx:304-333`) is unchanged. |

**Upload client flow (per photo, sequential):** browser client `storage.from('originals').upload('<roll>/<photoId>.<ext>', file)` → on success `ingestPhoto({roll, photoId, originalKey})` → UI appends the returned frame. Chunked per photo by construction; no body-limit config needed (DL3).

**Orphan sweep — `scripts/sweep-storage-orphans.ts`** (local, `SUPABASE_SECRET_KEY`, idempotent): reconciles both buckets against `photo_assets` — removes `originals/**` objects with no row (the browser uploads BEFORE `ingestPhoto`, so a failed action or closed tab strands an original; storage waste, not a public leak) and `photos/**` variants whose entry is gone (failed deletes). Run after any failed delete and periodically.

**Retired after S9:** `lib/server/entries/entry-actions.ts`, `entry-lifecycle-core.ts`, `lib/server/places/highlight-core.ts`, **`lib/server/places/place-actions.ts`** (file-write impls — superseded by the table-write actions above, DL15), `lib/content/frontmatter-edit.ts` (pure-string YAML editing is obsolete — metadata lives in Postgres), **plus the velite/file-coupled QA suite that exercises them**: `tests/places-curation-post-save.test.ts`, `tests/places-curation-ab-clear.test.ts`, `tests/places-curation-qa.test.ts`, `tests/entry-lifecycle-t1-qa.test.ts` (they `execSync` the deleted `content:build`, doctor `.velite/*.json`, and assert `git diff content/`) and `scripts/audit-places-load.ts` (dynamic-imports `.velite`). They retire WITH their subjects — the S5/S9 live-DB gates supersede their coverage; a "green" program must not leave a permanently red suite behind.

---

## 8 · Console UI deltas (private instrument — ZERO public-surface visual changes)

1. **`<ConsoleLogin/>`** — rendered by `/console` when unauthenticated (§5.3): email+password, `signInWithPassword` via browser client, console idiom (JetBrains Mono, scanline restraint — it's a door, not a page). No public nav link; no signup affordance.
2. **New entry** — `ConsoleApp.tsx:261-283` `persist()` stops synthesizing local ids → calls `createEntry`; on `ok` → `router.push('/console/editor?kind=…&slug=…')`. The form stays minimal (kind/title/date/domain/tags/summary — `ConsoleApp.tsx:249`): a valid DRAFT per DL14; coords/maturity/readingTime are completed in the editor before publish.
3. **Real body editing** — `EntryEditor` source pane loads `entry.body` from `admin-reads` (replaces mock `SAMPLE_MD`); SAVE → `updateEntry`; FULL PREVIEW renders via the same `renderMdxBody` seam the public page uses (true WYSIWYG).
4. **Delete with confirm** — existing confirm flow + `/console?removed=` navigation (`ConsoleApp.tsx:192-216`) kept; only the action import changes.
5. **Photo manager** — `PhotoManager.tsx:58-100` drops `MOCK_FRAMES` for real roll sidecars (`admin-reads`); roll picker (existing rolls + inline `createRoll`); `ImportZone.tsx:58-67` `onImport` wired to the §7 upload flow with per-file progress states (uploading → processing → done/failed); per-frame delete with confirm → `deleteEntry`.
6. **PublishPanel** (`PublishPanel.tsx:1-77`, mocked) — wired to reality: *review* lists the entry's status delta (publish refused with the DL14 missing-field list when incomplete), *running* = `setEntryDraft(draft:false)` in flight, *done* = revalidated + shows the live public path **+ a REINDEX affordance** that fires the Vercel Deploy Hook (§11) for publishes that should be searchable before the weekly rebuild (DL5). The 2s mock timer dies.
7. **PlaceHighlightEditor** (`PlaceHighlightEditor.tsx:54-56,593,623`) — swaps its `place-actions` imports for the §7 `createPlace`/`savePlaceCoord`/`savePlaceHighlights` store actions. Same return contracts, zero UI change (DL15).
8. Post-write state stays return-value-driven (decoupled-state contract, `ConsoleApp.tsx:140-216`) — no refetch loops added.

---

## 9 · Migration — `scripts/migrate-to-store.ts` (local, `SUPABASE_SECRET_KEY`)

1. **Parse** `content/**/*.mdx` with `gray-matter` (NOT velite output — `.velite/*.json` is metadata-only and photo records there have raw coords already stripped; the DB needs raw authored values + body). Validate via `lib/store/schema.ts`.
2. **Upsert order:** places (from `lib/content/place-registry.data.json` — **after migration the file is FROZEN per DL15**: migration input + pre-store history only) → rolls (incl. prose body — **comment-only bodies normalized**: strip `/<!--[\s\S]*?-->/` then trim, store `''` if nothing remains; chiang-mai's body is a lone placeholder comment, today stripped only at read by `extractMdxLede`; also migrate the legacy roll.mdx `id` frontmatter into `rolls.id`, §2.3) → entries (4 articles, 1 fiction, 5 photo sidecars). `status` = frontmatter `draft:true` ? `'draft'` : `'published'`; `maturity` = old `status`; `iso_date` derived (dots→hyphens). Backfill explicit `place_id` via the derivation fns wherever `highlight_for_place`/`highlight_rank` is set (satisfies §2.4 CHECKs).
3. **Idempotent:** upsert on `(kind, slug)` / pk everywhere; re-running yields identical row counts (verified in S9).
4. **Photos:** ground truth — **no source JPEGs or `.cache/` exist on this checkout** (recon `find`), so the first run is metadata-only: `photo_assets` rows with null `exif`/`variants` (public UI already renders placeholders). `--photos-dir <path>` flag: if originals are found there, run the §7 ingest core locally (exif + variants + uploads) during migration. Otherwise originals re-enter via the console upload flow — `ingestPhoto` upserts onto the migrated sidecars.
5. **Then flip git:** `git rm --cached -r content` + add `content/` to `.gitignore` (DL10; the existing `.gitignore:103-111` photo-binary rules become redundant but harmless — leave them). `/public/photos/` is already ignored (`.gitignore:108`). **Git history keeps every MDX file ever committed — that history IS the D2 backup of the pre-store era; nothing is rewritten.** Commit message must note the flip. Per the live-mutating-action gate: use `git rm --cached`, never `rm`.

---

## 10 · Export (D2 — minimal this round)

`scripts/export-mdx.ts` (local, `SUPABASE_SECRET_KEY` — drafts included): reads the store, serializes frontmatter (stable key order, today's quoting conventions) + body, writes **today's exact layout** into the now-gitignored `content/` (DL10): `content/articles/<fileNum>-<kebab-title>.mdx`, `content/fiction/<slug>.mdx`, `content/photos/<roll>/roll.mdx` + `<photo_id>.mdx`. Acceptance: run after migration ⇒ files semantically equal to the originals (frontmatter field set + body byte-equal; formatting drift allowed and documented). **Full git-export automation (auto-commit cadence, deploy hooks) = explicitly deferred** (implement-plan O5).

**Backup clause — D2 must stay real post-store.** Without this, every entry written after S8 exists in exactly one copy on a free-tier Postgres (no automated DB backups on free; `content/` gitignored) — D2's diff/revert/backup purpose would silently shrink to "pre-store era only". Decided mechanism: an npm script **`backup:content`** = run `scripts/export-mdx.ts`, then `git add -f content && git commit` onto the dedicated **private branch `backup/content`** — never merged to `main` (main-is-web-only policy holds). Cadence: after every writing session, minimum weekly. S8 creates the branch + script; richer automation stays O5.

---

## 11 · Build / env / CI

- `package.json:7` → `"build": "next build && npm run index:search"`; drop `content:build`. velite dep removed after S9 (DL7).
- New deps (runtime): `@supabase/supabase-js`, `@supabase/ssr`, `@mdx-js/mdx`; (scripts/server): `sharp`, `exifr`, `gray-matter`, `zod` (promote from velite's transitive to direct).
- Vercel env: the two `NEXT_PUBLIC_*` vars only (§5.4). Build now queries Supabase in `generateStaticParams` ⇒ local `npm run build` requires `.env.local`; document in README-adjacent build notes.
- `next.config.ts`: **no changes** — no `bodySizeLimit` raise needed (DL3); photos render via raw `<img>` (`PhotoEntry.tsx:373-380`), not `next/image`, so no `images.remotePatterns`.
- **Weekly scheduled Deploy Hook** — register a Vercel Deploy Hook; a weekly cron (Vercel cron or GitHub Action) fires it. One mechanism, two problems: the rebuild's store queries are the free-tier auto-pause keep-alive (§4.4) AND bound pagefind staleness to ≤1 week (DL5). PublishPanel's REINDEX (§8.6) fires the same hook on demand.
- **Secret-leak guard (CI/pre-commit):** repo-wide grep over tracked files for `sb_secret_` / the literal key; assert `SUPABASE_SECRET_KEY` appears only under `scripts/**` (§5.4).
- Retire `WORLDLINE_AUTHORING` from Vercel + docs.
- `proxy.ts` rewrite per §5.3 (fail-closed gate retained).

---

## 12 · Slice plan (workflow owners per implement-plan §9 roster)

| id | slice | owner | depends | Algol acceptance gate (ground truth, not reports) |
|---|---|---|---|---|
| **S1** | Schema + RLS + column grants + storage + owner bootstrap — migrations §2–§4 applied to `aitqswnbtpexrxqpoiwo`; buckets created; `scripts/setup-owner.ts` run; signups disabled in versioned config | procyon | — | anon select on entries returns 0 draft rows + all published; anon INSERT/UPDATE/DELETE refused (RLS error); **anon `select=coords` on entries AND rolls refused (column grant), `select=served_coords` returns gated values only (null on `share_location=false`, ≤2 decimals otherwise); anon select of `photo_assets.original_key,source_hash` refused**; owner JWT full CRUD ok incl. raw coords; `signUp` with publishable key refused AND `enable_signup=false` present in versioned config; `originals` anon read 403, `photos` public URL 200, **anon bucket LISTING refused**; `private.owners` unreachable via API; **API exposed schemas = `public, graphql_public` only** (anon GET `/rest/v1/owners` 404s) |
| **S2** | Migration script + first import (`scripts/migrate-to-store.ts`, §9.1–9.4) | procyon | S1 | row counts exactly 4/1/5 articles/fiction/photos + 2 rolls + 4 places; rerun ⇒ identical counts (idempotent); field-level diff vs `.velite/*.json` ground truth incl. `served_coords` parity after mapping; bangkok roll body non-empty, **chiang-mai body `''` after comment-strip**; `rolls.id` migrated (bangkok=DSCF0002, chiang-mai=DSCF0001); article `served_coords` rounded ≤2 decimals |
| **S3** | Read layer + swap (`lib/store/**` incl. `lib/content/types.ts` re-point, §6) + MDX body render + pagefind script swap + velite out of build (§11) | procyon | S1, S2 | `npm run build` green with NO `.velite/` present; HTML diff of every public route pre/post swap — identical except the new article/fiction body region; pagefind index contains the same entry set AND **sidecar `status` field carries maturity values** (served-record proof); a draft entry 404s publicly; a deleted/unknown slug 404s via `notFound()`; `tsc` = 0 on a clone with `.velite/` absent |
| **S4** | Auth — supabase clients, `proxy.ts` rewrite (fail-closed), ConsoleLogin functional shell, `assertOwner` (§5) | altair | S1 | deployed: unauthed `/console` **AND `/console/editor` AND every matched sub-route** → login, never console HTML (proxy choke-point proof — **required to pass BEFORE the rewrite ships to production**); Peat login → console; direct server-action invocation without session → `{ok:false,AUTH}` AND a forged write with anon key dies at RLS; `WORLDLINE_AUTHORING` gone |
| **S5** | Write path — all §7 actions + ingest pipeline + place actions/rpc + orphan sweep | altair | S1, S4 | each action verified against live DB: create→row exists draft; minimal draft `setEntryDraft(false)` → refused with missing-field list, complete entry publishes (DL14); setDraft→status flips + `revalidatePath` fires; delete photo→row AND storage objects gone — **bucket prefix listing empty + variant URL 404 on cache-busted fetch**; ingest of a >4.5MB JPEG succeeds end-to-end (proves DL3); exif filmSim normalized; GPS absent from assets when `share_location=false`; **exifr over a generated public variant → zero GPS (and no EXIF block)**; ingest onto a row that already has variants refused without `overwrite:true`; rank-conflict insert rejected by index; **`createPlace` via action → `places` row exists, `place-registry.data.json` byte-untouched, `git status` clean** |
| **S6** | Console UI wiring (§8) — login polish, new-entry, body edit, photo upload UI, deletes, PublishPanel, PlaceHighlightEditor swap | sirius | S3, S4, S5 | browser walkthrough: **create minimal draft → publish refused with field list → complete in editor → publish succeeds** → **public page live with body, zero deploys** (D3 gate); upload 2 photos into a new roll → frames render with real variants; delete a PUBLISHED photo → gone from console + public roll + storage **and its former public URL returns 404**; create place + fix coord through the console (no git diff); no public-surface visual diff (screenshot compare vs pre-slice) |
| **S7** | Export script (§10) | altair | S2, S3 | post-migration export reproduces all 12 MDX files semantically equal (frontmatter set + body) in gitignored `content/`; `git status` clean |
| **S8** | Env/CI/git wiring — Vercel envs, build script, gitignore flip + `git rm --cached`, retired flags, deploy-hook cron, secret-leak guard, `backup/content` branch + `backup:content` script, `place-registry.data.json` frozen-header comment (§9.5, §10, §11) | canopus | S1 (flip itself gated on S9 read-parity passing) | Vercel build green from a clean clone (no content/); `SUPABASE_SECRET_KEY` absent from Vercel env list AND client bundle grep AND **repo-wide grep clean (references only under `scripts/**`)**; `git ls-files content/` empty post-flip; history intact (`git log -- content/` non-empty); weekly deploy-hook cron registered + fired once (build succeeds); `backup:content` run once → commit exists on `backup/content`, absent from `main` |
| **S9** | Full verify gate — the Algol six-step over the whole program | algol | S1–S8 | the four PRD §10 Phase-A proofs run live: publish-without-redeploy; auth boundary (read public / write refused unauth); media in storage not git (`git status` clean after upload); export diffable. Plus: hardest-path coverage per verify-coverage-asymmetry — the >4.5MB upload, **the draft-leak probe across ALL THREE surfaces (DB rows, coords/asset columns via raw PostgREST, storage objects — the last is the documented capability-URL acceptance §4.3)**, the rank-conflict, the empty-variants placeholder photo, deleted-entry URL 404, the retired QA suite actually deleted (no red tests against a green program) |

Ordering: S1 → {S2, S4} → {S3, S5} → {S6, S7} → S8 → S9. S2∥S4 and S3∥S5 are parallelizable.

---

## 13 · Out of scope (do not build, do not reopen)

Edges table / derived suggestions / accept-reject UI (Phase B) · embeddings + pgvector (Phase B/C) · NETRA store wiring (Phase C, DL6) · RAW/HEIC decode + cold storage (D7 later; JPEG-only this round) · runtime/semantic search (DL5 — the weekly reindex bound IS in scope) · git-export **automation** (§10 — the manual `backup:content` cadence IS in scope) · private-bucket draft variants / signed URLs (capability-URL exposure accepted §4.3) · multi-user anything (D5: single-user is a feature).

*Spec author: architect subagent, 2026-06-12. Conflicts with PRD/implement-plan are decided in §1 with rationale; everything else aligns with D0–D7.*
