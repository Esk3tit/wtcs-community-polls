-- Direct regression for public.is_current_user_admin() across 4 identity
-- branches AND exercises one admin-gated RLS table beyond vote_counts
-- (audit_log).
--
-- The 12-cell vote_counts RLS matrix only proves the absence of an admin
-- OR-branch on vote_counts; it does NOT directly prove is_current_user_admin()
-- correctness on admin-gated tables. This fixture closes that gap.
--
-- A direct psql session is privileged (postgres / supabase_admin) and
-- bypasses RLS by default. To prove RLS-correctness rather than
-- privileged-bypass behavior, every SELECT against an RLS-gated table runs
-- under `SET LOCAL ROLE authenticated` paired with a `request.jwt.claims`
-- session-local setting that names the JWT sub.
--
-- Run: psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f tests/sql/is_current_user_admin_regression.sql
--
-- The whole script runs in BEGIN; ... ROLLBACK; so no permanent state is
-- written. ON_ERROR_STOP=1 ensures any RAISE EXCEPTION in a DO block fails
-- the script (non-zero exit).

BEGIN;

-- ---------------------------------------------------------------------------
-- Privileged setup: insert auth.users (FK target) and public.profiles rows.
-- This block runs as the connection's privileged role (postgres /
-- supabase_admin). RESET ROLE is a no-op here because we have not yet SET
-- LOCAL ROLE, but is included for symmetry.
--
-- IMPORTANT: The trigger `on_auth_user_created` defined in
-- `supabase/migrations/00000000000002_triggers.sql` fires on every INSERT
-- INTO auth.users. Its handler `handle_new_user()` already creates a matching
-- `public.profiles` row (also via ON CONFLICT (id) DO UPDATE). The profiles
-- INSERT below therefore MUST use ON CONFLICT (id) DO UPDATE to override the
-- trigger-inserted defaults; otherwise the script aborts with a duplicate-key
-- violation on profiles_pkey.
-- ---------------------------------------------------------------------------
RESET ROLE;

-- profiles.id has FK to auth.users(id) ON DELETE CASCADE. Seed the auth.users
-- rows first. We include raw_user_meta_data so the on_auth_user_created
-- trigger's handle_new_user() COALESCE chain (provider_id -> sub -> id ->
-- NEW.id::TEXT) derives the intended snowflake discord_id rather than
-- falling through to the UUID-as-string last-resort branch. Without this
-- metadata, the trigger-inserted profile row carries a UUID-string
-- discord_id and the fixture's explicit snowflake VALUES would be silently
-- discarded by the ON CONFLICT clause below.
--
-- NOTE: this INSERT is brittle to Supabase auth-schema upgrades. The column
-- list below relies on the rest of auth.users being nullable / having
-- defaults. Supabase has periodically tightened auth.users NOT NULL
-- constraints across minor versions (e.g., confirmation_token,
-- email_change_token_new). If this INSERT starts failing with a new
-- "null value in column ... violates not-null constraint" after a Supabase
-- upgrade, add the offending column here with an empty-string default.
INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, email_confirmed_at, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-00000000a001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'fixture-admin@phase14.test',     '{"provider_id":"900000000000000001"}'::jsonb, NOW(), NOW(), NOW()),
  ('00000000-0000-0000-0000-00000000a002'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'fixture-non-admin@phase14.test', '{"provider_id":"900000000000000002"}'::jsonb, NOW(), NOW(), NOW()),
  ('00000000-0000-0000-0000-00000000a003'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'fixture-no-mfa@phase14.test',    '{"provider_id":"900000000000000003"}'::jsonb, NOW(), NOW(), NOW()),
  ('00000000-0000-0000-0000-00000000a004'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'fixture-no-guild@phase14.test',  '{"provider_id":"900000000000000004"}'::jsonb, NOW(), NOW(), NOW());

-- profiles fixture -- 4 identity branches for is_current_user_admin().
-- The trigger `on_auth_user_created` (supabase/migrations/00000000000002_triggers.sql)
-- fires on INSERT INTO auth.users above and calls handle_new_user(), which INSERTs
-- a matching profiles row with ON CONFLICT (id) DO UPDATE. Therefore the rows
-- below MUST use ON CONFLICT to overwrite the trigger-inserted defaults; a bare
-- INSERT would raise a duplicate-key violation.
INSERT INTO public.profiles (id, discord_id, is_admin, mfa_verified, guild_member, discord_username, avatar_url)
VALUES
  ('00000000-0000-0000-0000-00000000a001'::uuid, '900000000000000001', TRUE,  TRUE,  TRUE,  'fixture_admin',     ''),
  ('00000000-0000-0000-0000-00000000a002'::uuid, '900000000000000002', FALSE, TRUE,  TRUE,  'fixture_non_admin', ''),
  ('00000000-0000-0000-0000-00000000a003'::uuid, '900000000000000003', TRUE,  FALSE, TRUE,  'fixture_no_mfa',    ''),
  ('00000000-0000-0000-0000-00000000a004'::uuid, '900000000000000004', TRUE,  TRUE,  FALSE, 'fixture_no_guild',  '')
ON CONFLICT (id) DO UPDATE SET
  is_admin         = EXCLUDED.is_admin,
  mfa_verified     = EXCLUDED.mfa_verified,
  guild_member     = EXCLUDED.guild_member,
  discord_username = EXCLUDED.discord_username,
  avatar_url       = EXCLUDED.avatar_url,
  updated_at       = NOW();

-- Canary audit_log row -- actor is the admin fixture. Inserted while
-- privileged, before RLS is enforced.
-- NOTE: columns are (actor_id, action, target_type, target_id, before, after)
-- per the audit_log migration (00000000000010_*) -- two JSONB diff columns,
-- NOT a single body column.
INSERT INTO public.audit_log (actor_id, action, target_type, target_id, before, after)
VALUES (
  '00000000-0000-0000-0000-00000000a001'::uuid,
  'fixture-canary',
  'rls-regression-canary',
  NULL,
  NULL,
  '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- Helper: assert that public.is_current_user_admin() returns the expected
-- boolean when called under a given JWT sub. PERFORM is valid INSIDE a DO
-- block / function body, but not at script top level.
--
-- The helper SETs LOCAL ROLE authenticated, then SETs the JWT claim, then
-- calls is_current_user_admin(). is_current_user_admin() is SECURITY DEFINER
-- so it reads profiles as the function owner -- the RLS-policy concern here is
-- about the surrounding session role, not the function body.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp.assert_admin(p_user_id UUID, p_expected BOOLEAN, p_label TEXT)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_actual BOOLEAN;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_user_id::text)::text, true);
  -- SET LOCAL ROLE authenticated is a no-op for the is_current_user_admin()
  -- call below: the function is SECURITY DEFINER so its body always runs as
  -- the function owner regardless of the surrounding session role. The line
  -- is kept here for SYMMETRY with the audit_log DO blocks further down,
  -- where the role-switch IS load-bearing (RLS only engages under a
  -- non-privileged role). Keeping the pattern uniform makes the fixture
  -- easier to read and prevents a future author from mistakenly dropping
  -- the role-switch from blocks that genuinely need it.
  SET LOCAL ROLE authenticated;
  SELECT public.is_current_user_admin() INTO v_actual;
  RESET ROLE;
  IF v_actual IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'FAIL %: expected % got %', p_label, p_expected, v_actual;
  ELSE
    RAISE NOTICE 'PASS %: % == %', p_label, p_expected, v_actual;
  END IF;
END;
$$;

-- Branch 1: admin AND mfa_verified AND guild_member -> TRUE
SELECT pg_temp.assert_admin('00000000-0000-0000-0000-00000000a001'::uuid, TRUE,  'admin');

-- Branch 2: is_admin=FALSE -> FALSE
SELECT pg_temp.assert_admin('00000000-0000-0000-0000-00000000a002'::uuid, FALSE, 'non_admin');

-- Branch 3: mfa_verified=FALSE -> FALSE
SELECT pg_temp.assert_admin('00000000-0000-0000-0000-00000000a003'::uuid, FALSE, 'mfa_false');

-- Branch 4: guild_member=FALSE -> FALSE
SELECT pg_temp.assert_admin('00000000-0000-0000-0000-00000000a004'::uuid, FALSE, 'guild_false');

-- ---------------------------------------------------------------------------
-- Cross-table RLS assertion on public.audit_log.
-- audit_log SELECT policy: USING (public.is_current_user_admin())
-- Under role `authenticated`:
--   - admin JWT sub  -> is_current_user_admin() = TRUE  -> row visible
--   - non-admin JWT  -> is_current_user_admin() = FALSE -> row hidden
-- We MUST SET LOCAL ROLE authenticated because a direct psql session as
-- postgres/supabase_admin bypasses RLS, which would make the non-admin
-- assertion pass for the wrong reason.
-- ---------------------------------------------------------------------------

-- Admin branch -- expect to see the canary row.
DO $$
DECLARE n INT;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a001', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000a001')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT COUNT(*) INTO n FROM public.audit_log WHERE action = 'fixture-canary';
  RESET ROLE;
  IF n = 0 THEN
    RAISE EXCEPTION 'FAIL audit_log/admin: expected >=1 canary row, got 0 (is_current_user_admin returned FALSE for admin fixture, or RLS blocked the row)';
  ELSE
    RAISE NOTICE 'PASS audit_log/admin: % canary row(s) visible under authenticated role', n;
  END IF;
END $$;

-- Non-admin branch -- expect to NOT see the canary row.
DO $$
DECLARE n INT;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000a002', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-00000000a002')::text, true);
  SET LOCAL ROLE authenticated;
  SELECT COUNT(*) INTO n FROM public.audit_log WHERE action = 'fixture-canary';
  RESET ROLE;
  IF n != 0 THEN
    RAISE EXCEPTION 'FAIL audit_log/non_admin: expected 0 canary rows under authenticated role, got % (RLS not enforced, or is_current_user_admin returned TRUE for non-admin fixture)', n;
  ELSE
    RAISE NOTICE 'PASS audit_log/non_admin: 0 canary rows visible under authenticated role (RLS correctly hid the row)';
  END IF;
END $$;

-- Roll back all fixture data. auth.users rows cascade-delete to profiles
-- via the FK; audit_log canary row also rolls back (entire transaction).
ROLLBACK;
