-- bilingual P1: add lang dimension to entries (translation-group foundation)
-- DEFAULT 'en' backfills all 14 existing rows in place.
alter table public.entries
  add column lang text not null default 'en';

-- app-level allowlist (NOT a pg enum: adding a locale stays a one-line app change)
alter table public.entries
  add constraint entries_lang_chk check (lang in ('en', 'th'));

-- swap uniqueness scope (kind,slug) -> (kind,slug,lang)
alter table public.entries
  drop constraint entries_kind_slug_key;
alter table public.entries
  add constraint entries_kind_slug_lang_unique unique (kind, slug, lang);

-- anon must SELECT lang (public routing/display metadata; mirrors migration 0010 column-grant pattern)
grant select (lang) on public.entries to anon;
