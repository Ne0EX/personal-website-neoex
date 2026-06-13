-- Migration: 0009b_set_alpha_place_fn
-- Agent: Procyon · α-IDX-03
-- Date: 2026-06-13
-- Branch: genesis/store-as-source
--
-- Purpose
-- -------
-- SQL function for atomic alpha-locus reassignment.
-- Single UPDATE statement: sets is_alpha = (id = p_place_id) on ALL rows.
-- The partial-unique index (places_one_alpha_idx) sees exactly one true per
-- transaction — no momentary double-true is possible.
--
-- Called by setAlphaPlaceImpl (lib/server/store/actions-core.ts) via
-- supabase.rpc('set_alpha_place', { p_place_id: '...' }).
--
-- Security: SECURITY INVOKER — RLS applies; owner-only writes enforced by policy.
-- Returns: the id of the new alpha place (confirms row exists; raises if missing).

-- NOTE: This function was superseded by 0009c which fixes the partial-unique
-- index per-row evaluation order. The live DB has the v2 implementation.
-- See 20260613_0009c_set_alpha_place_fn_v2.sql for the canonical version.

CREATE OR REPLACE FUNCTION public.set_alpha_place(p_place_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.places WHERE id = p_place_id) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'PLACE_NOT_FOUND: place "%" does not exist', p_place_id;
  END IF;
  -- Two-statement path (see 0009c for the fix rationale):
  UPDATE public.places SET is_alpha = false WHERE is_alpha = true;
  UPDATE public.places SET is_alpha = true WHERE id = p_place_id;
  RETURN p_place_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_alpha_place(text) TO authenticated;
