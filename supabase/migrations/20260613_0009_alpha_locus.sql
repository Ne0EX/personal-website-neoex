-- Migration: 0009_alpha_locus
-- Agent: Procyon · α-IDX-03
-- Date: 2026-06-13
-- Branch: genesis/store-as-source
-- Authorization: Peat 2026-06-13 — movable-alpha data goal
--
-- Purpose
-- -------
-- Make the globe's alpha locus data-driven and console-editable.
-- Adds is_alpha boolean to public.places so exactly one place can be
-- designated the observer's home coordinate. The globe's NEXT NODE cycle
-- and the Ne0 stratum camera framing read this instead of hardcoded constants.
--
-- Integrity
-- ---------
-- A partial UNIQUE INDEX on (is_alpha) WHERE is_alpha = true ensures at most
-- one row is alpha at any time. The setAlphaPlace server action uses a single
-- UPDATE ... SET is_alpha = (id = $1) statement so the index never sees a
-- momentary double-true within the transaction.
--
-- Privacy note
-- ------------
-- is_alpha is public display metadata (which place is the observer home).
-- It does NOT expose coordinates — those are already anon-readable for the
-- places table. Anon SELECT is explicitly granted per the column-level grant
-- pattern on this table.
--
-- Idempotency
-- -----------
-- ADD COLUMN IF NOT EXISTS: safe to re-apply.
-- CREATE UNIQUE INDEX IF NOT EXISTS: safe to re-apply.
-- GRANT: idempotent in Postgres.
-- UPDATE seed: idempotent (sets bangkok.is_alpha = true; already true if re-run).

-- 1. Add column --------------------------------------------------------------
ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS is_alpha boolean NOT NULL DEFAULT false;

-- 2. Partial unique index — at most one alpha at any time --------------------
CREATE UNIQUE INDEX IF NOT EXISTS places_one_alpha_idx
  ON public.places (is_alpha)
  WHERE is_alpha = true;

-- 3. Seed current default — Bangkok is the observer locus --------------------
UPDATE public.places
  SET is_alpha = true
  WHERE id = 'bangkok';

-- 4. Anon SELECT grant -------------------------------------------------------
-- Column-level grant pattern: anon's table SELECT is column-gated on this table.
-- A new column gets NO implicit grant — must be explicit.
-- is_alpha is public display metadata (not coords) — grant is correct.
GRANT SELECT (is_alpha) ON public.places TO anon;
