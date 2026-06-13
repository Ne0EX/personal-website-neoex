-- Migration: 0010_pare_grants
-- Agent: Procyon · α-IDX-03
-- Date: 2026-06-13
-- Branch: genesis/store-as-source
-- Task: B4 QA-fix-wave3 — pare over-wide anon/authenticated table grants
--
-- Problem
-- -------
-- A blanket GRANT ALL ON ALL TABLES IN SCHEMA public at setup left anon and
-- authenticated holding TRUNCATE, TRIGGER, REFERENCES, and (for anon) INSERT,
-- UPDATE, DELETE table-level grants on every public table.
--
-- PostgreSQL has no RLS policy command for TRUNCATE, and relforcerowsecurity is
-- false on all tables, so a direct Postgres connection with the anon role and
-- pooler 6543 can TRUNCATE public.entries with zero barrier.
--
-- RLS gates SELECT/INSERT/UPDATE/DELETE via is_owner() (anon always fails those
-- via PostgREST), but TRUNCATE is entirely outside RLS control.
--
-- Fix
-- ---
-- 1. ANON — revoke every write/structural table grant (INSERT, UPDATE, DELETE,
--    TRUNCATE, REFERENCES, TRIGGER) from entries, photo_assets, rolls, places.
--    Anon keeps column-level SELECT grants already in place (DL13 preserved —
--    coords excluded from SELECT at column level by prior migration, untouched
--    here).
--
-- 2. AUTHENTICATED — revoke TRUNCATE, REFERENCES, TRIGGER (never needed; not
--    RLS-protectable). Retain INSERT, UPDATE, DELETE, SELECT so the owner
--    console write path (RLS-gated by is_owner()) remains intact.
--
-- 3. Set relforcerowsecurity=true on all four tables so that even if the
--    authenticated role is used in a SECURITY DEFINER context that bypasses
--    normal role checks, RLS is still applied. The table owner (postgres) is
--    always exempt from RLS regardless of this flag, so Supabase internals
--    are unaffected.
--
-- Column-level grants are NOT touched. This migration is table-privilege-only.
--
-- Idempotency
-- -----------
-- REVOKE is idempotent: revoking a privilege that is not held is a no-op in
-- Postgres (it raises a WARNING, not an ERROR). Safe to re-apply.

-- ============================================================
-- 1. ANON: strip all write and structural table grants
-- ============================================================

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.entries
  FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.photo_assets
  FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.rolls
  FROM anon;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.places
  FROM anon;

-- ============================================================
-- 2. AUTHENTICATED: strip structural grants only
--    (INSERT / UPDATE / DELETE / SELECT are kept — owner console needs them)
-- ============================================================

REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON public.entries
  FROM authenticated;

REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON public.photo_assets
  FROM authenticated;

REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON public.rolls
  FROM authenticated;

REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON public.places
  FROM authenticated;

-- ============================================================
-- 3. Force RLS for the authenticated role on all tables
--    (postgres/service_role are exempt from RLS regardless)
-- ============================================================

ALTER TABLE public.entries       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.photo_assets  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.rolls         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.places        FORCE ROW LEVEL SECURITY;
