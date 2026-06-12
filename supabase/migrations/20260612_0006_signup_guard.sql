-- Migration: 0006_signup_guard
-- Agent: Altair · α-BND-02
-- Date: 2026-06-12
-- Branch: genesis/store-as-source
-- Task: S1-SIGNUP-LIVE gate (Algol S9 finding)
--
-- Purpose
-- -------
-- DB-level signup guard. Enforces that only the site owner
-- (neospiritth@gmail.com) may ever have a row inserted into auth.users,
-- regardless of the Supabase dashboard "Allow new users to sign up" toggle.
-- This makes the DL12 single-user constraint durable at the database layer,
-- not just at the dashboard layer.
--
-- Architecture
-- ------------
-- The function lives in the `public` schema because the migration role
-- (postgres) does not have CREATE privilege in the `auth` schema
-- (owned by supabase_auth_admin). A trigger function in `public` can still
-- fire on auth.users — function schema and table schema are independent in
-- Postgres.
--
-- Provider coverage
-- -----------------
-- This trigger fires for ALL auth providers (email+password, Google OAuth,
-- GitHub OAuth, magic link, phone, etc.) because every provider ultimately
-- INSERTs into auth.users. A future GitHub or Google SSO login will succeed
-- ONLY if the OAuth account's primary email is neospiritth@gmail.com.
--
-- Idempotency
-- -----------
-- Safe to re-apply: uses CREATE OR REPLACE for the function and
-- DROP TRIGGER IF EXISTS before CREATE TRIGGER.
--
-- Scope
-- -----
-- BEFORE INSERT on auth.users only.
-- UPDATE/DELETE on existing rows and all Supabase internal housekeeping
-- on existing rows are completely unaffected.
-- Does NOT affect: Supabase's own internal system writes (they do not
-- insert new auth.users rows under normal operation after setup).

-- 1. Security-definer trigger function (in public schema) ------------
CREATE OR REPLACE FUNCTION public.check_owner_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Guard: only the site owner email may ever be inserted into auth.users.
  -- lower() normalises case so 'NEOSPIRITTH@GMAIL.COM' is still blocked.
  IF lower(NEW.email) <> 'neospiritth@gmail.com' THEN
    RAISE EXCEPTION
      'signup_guard: only the site owner account may be created (received: %)',
      lower(NEW.email)
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Lock down execute — only postgres/service_role may call this fn --
--    Defence-in-depth: even if someone discovers the function name, they
--    cannot invoke it directly as anon or authenticated.
REVOKE EXECUTE ON FUNCTION public.check_owner_signup() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_owner_signup() FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_owner_signup() FROM authenticated;

-- 3. Trigger on auth.users -------------------------------------------
DROP TRIGGER IF EXISTS trg_owner_signup_guard ON auth.users;

CREATE TRIGGER trg_owner_signup_guard
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.check_owner_signup();
