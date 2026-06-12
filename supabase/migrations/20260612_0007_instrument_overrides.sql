-- Migration: 0007_instrument_overrides
-- Agent: Procyon · α-IDX-03
-- Date: 2026-06-12
-- Branch: genesis/store-as-source
-- Authorization: Peat 2026-06-12 — lens-override on entries table
--
-- Purpose
-- -------
-- Add instrument_overrides jsonb column to public.entries.
-- Holds authored overrides for camera instrument fields that may be absent
-- from EXIF (e.g. manual/adapted lenses have no EXIF lens data).
-- Keys: lens, camera, iso, aperture, shutter, focal — all optional.
--
-- Display contract (decided, do not reopen):
--   displayed/served instrument value = instrument_overrides.<key> ?? photo_assets.exif.<key>
--   photo_assets.exif stays RAW sensor truth — never patched here.
--
-- Privacy note
-- ------------
-- instrument_overrides is authored public display data, NOT coords.
-- Anon SELECT is explicitly granted (mirrors all other public-display columns).
-- DL13 coords column grants are untouched.
--
-- Idempotency
-- -----------
-- ADD COLUMN IF NOT EXISTS: safe to re-apply.
-- GRANT: idempotent in Postgres (no error if privilege already exists).

-- 1. Add the column ---------------------------------------------------
ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS instrument_overrides jsonb;

-- 2. Explicit anon SELECT grant ---------------------------------------
-- DL13 context: anon's table-level SELECT on entries is REVOKED; all
-- readable columns are granted individually. A new column added after
-- that revoke gets NO implicit grant. We must grant it explicitly or
-- anon SELECTs that include this column will fail with a permission error.
-- instrument_overrides is public display data (not coords) — grant is correct.
GRANT SELECT (instrument_overrides) ON public.entries TO anon;
