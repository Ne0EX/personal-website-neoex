-- 0012 · Fix REVISE regression from 0011 + the public-read 500.
--
-- Migration 0011 added entries.film_sim but did NOT grant anon column-level SELECT on it.
-- lib/store/reads.ts ENTRY_COLS (used by the PUBLIC anon client) includes 'film_sim',
-- so every anon `select=...,film_sim,...` returned PostgREST 42501 → ALL public routes 500
-- and `next build` (SSG anon reads) failed.
--
-- film_sim is AUTHORED PUBLIC DISPLAY DATA — the public photo page shows the film simulation,
-- the same class as instrument_overrides (already anon-readable). Grant COLUMN-LEVEL SELECT only,
-- preserving the DL13 invariant (raw `coords` stays anon-revoked; verified: anon select=coords still 42501).
--
-- NOTE the broader lesson recorded with this fix: 0010's grant-pare "passed" QA because it was
-- verified via execute_sql (postgres superuser, bypasses PostgREST role grants) instead of the
-- real anon PostgREST path. Grant changes MUST be verified through the anon REST endpoint.

GRANT SELECT (film_sim) ON public.entries TO anon;
