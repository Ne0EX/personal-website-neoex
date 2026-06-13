-- Migration: 0009c_set_alpha_place_fn_v2
-- Agent: Procyon · α-IDX-03
-- Date: 2026-06-13
--
-- Fix: Postgres partial unique indexes evaluate per-row within a statement,
-- not deferred to statement end. A single-statement UPDATE causes a unique
-- violation when the new true row is written before the old true row is cleared.
--
-- Correct approach: two statements in one transaction —
--   1. Clear all is_alpha (no row is true)
--   2. Set target is_alpha = true (exactly one row true)
-- Within the function's implicit transaction, this is safe and can never
-- produce double-true. The partial-unique index is satisfied after each stmt.

CREATE OR REPLACE FUNCTION public.set_alpha_place(p_place_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Verify the target place exists
  SELECT EXISTS (SELECT 1 FROM public.places WHERE id = p_place_id) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'PLACE_NOT_FOUND: place "%" does not exist', p_place_id;
  END IF;

  -- Step 1: clear all alpha flags (partial-unique index: 0 rows true — satisfied)
  UPDATE public.places SET is_alpha = false WHERE is_alpha = true;

  -- Step 2: set exactly one (partial-unique index: 1 row true — satisfied)
  UPDATE public.places SET is_alpha = true WHERE id = p_place_id;

  RETURN p_place_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_alpha_place(text) TO authenticated;
