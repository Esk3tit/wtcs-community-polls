-- Without \set ON_ERROR_STOP on, psql prints the RAISE EXCEPTION from the
-- guard below and then CONTINUES executing the rest of this file — defeating
-- the fail-closed intent. This must be the very first statement so it covers
-- even the guard itself.
\set ON_ERROR_STOP on

-- ============================================================
-- Phase 05-05 — Playwright E2E fixture seed (LOCAL-ONLY)
--
-- HIGH #2 resolution: fixture users with bcrypt-hashed known password
-- so the Playwright `loginAs` helper can authenticate via the public
-- `signInWithPassword` API without needing the service-role key.
--
-- Applied ON TOP of `supabase/seed.sql` (admin Discord IDs + categories).
-- Re-applying is idempotent thanks to ON CONFLICT DO NOTHING throughout.
--
-- NEVER run this against production. It creates known-password auth users
-- that would defeat Discord OAuth gating.
-- ============================================================

-- CR-PR4 fail-closed guard: refuse to apply unless the operator has explicitly
-- opted in via `app.e2e_seed_allowed=true`. The CI step (and any local seed
-- command) MUST set this, e.g.:
--   PGOPTIONS='-c app.e2e_seed_allowed=true' psql "$DATABASE_URL" -f e2e/fixtures/seed.sql
-- This makes accidentally pointing this script at a hosted DB a no-op instead
-- of silently provisioning password-login accounts that would defeat Discord
-- OAuth gating.
DO $$
BEGIN
  IF current_setting('app.e2e_seed_allowed', true) IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION
      'Refusing to apply e2e/fixtures/seed.sql without app.e2e_seed_allowed=true (LOCAL E2E ONLY)';
  END IF;
END $$;

-- ------------------------------------------------------------
-- auth.users — fixture accounts with bcrypt-hashed shared password.
-- `crypt()` + `gen_salt('bf')` are provided by pgcrypto, which Supabase
-- enables by default.
-- ------------------------------------------------------------
-- GoTrue v2.188+ (bundled with Supabase CLI 2.92.1) cannot scan NULL values
-- for confirmation_token, recovery_token, email_change_token_new, email_change
-- because its User struct declares them as `string` (not `sql.NullString`).
-- The auth.users schema leaves these columns nullable without a default, so
-- any row we hand-insert that omits them makes EVERY signInWithPassword call
-- fail with "error finding user: sql: Scan error ... converting NULL to
-- string is unsupported" — the SELECT scans ALL rows matching the email,
-- and any NULL in these columns tanks the whole query.
-- Empty strings match the semantics GoTrue uses for its own internal inserts.
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at
) VALUES
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'playwright-user-member@test.local', crypt('playwright-fixture-only-do-not-use-in-prod', gen_salt('bf')),
   now(), '{"provider":"email"}', '{"provider_id":"100000000000000001"}',
   '', '', '', '', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'playwright-user-admin@test.local', crypt('playwright-fixture-only-do-not-use-in-prod', gen_salt('bf')),
   now(), '{"provider":"email"}', '{"provider_id":"100000000000000002"}',
   '', '', '', '', now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'playwright-user-no2fa@test.local', crypt('playwright-fixture-only-do-not-use-in-prod', gen_salt('bf')),
   now(), '{"provider":"email"}', '{"provider_id":"100000000000000003"}',
   '', '', '', '', now(), now()),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'playwright-user-notmember@test.local', crypt('playwright-fixture-only-do-not-use-in-prod', gen_salt('bf')),
   now(), '{"provider":"email"}', '{"provider_id":"100000000000000004"}',
   '', '', '', '', now(), now())
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- public.profiles — 4 matching profile rows. Covers all D-08 spec needs:
--   memberUser    — mfa_verified + guild_member      (happy path)
--   adminUser     — is_admin + mfa + guild_member    (admin-create spec)
--   no2faUser     — mfa_verified FALSE               (auth-errors 2fa variant)
--   notInServer   — guild_member FALSE               (auth-errors not-in-server)
--
-- The auth.users INSERT above fired the `handle_new_user` trigger, which
-- auto-created profile rows with is_admin/mfa_verified/guild_member all
-- defaulting to FALSE (the trigger doesn't set mfa_verified or guild_member
-- at all; is_admin is derived from admin_discord_ids which at trigger-time
-- does not yet contain 100000000000000002). If we used ON CONFLICT DO NOTHING
-- here, the trigger's FALSE defaults would stick and AdminGuard / mfa flows
-- would refuse the fixture users. DO UPDATE ensures the seed's intended
-- flags win — critical for admin-create and browse-respond specs.
-- Idempotency preserved: re-applying the seed produces the same final row
-- state regardless of how many times it runs.
-- ------------------------------------------------------------
INSERT INTO public.profiles (id, discord_id, discord_username, avatar_url, is_admin, mfa_verified, guild_member) VALUES
  ('11111111-1111-1111-1111-111111111111', '100000000000000001', 'PlaywrightMember',
   'https://cdn.discordapp.com/embed/avatars/0.png', false, true,  true),
  ('22222222-2222-2222-2222-222222222222', '100000000000000002', 'PlaywrightAdmin',
   'https://cdn.discordapp.com/embed/avatars/0.png', true,  true,  true),
  ('33333333-3333-3333-3333-333333333333', '100000000000000003', 'PlaywrightNo2FA',
   'https://cdn.discordapp.com/embed/avatars/0.png', false, false, true),
  ('44444444-4444-4444-4444-444444444444', '100000000000000004', 'PlaywrightNotMember',
   'https://cdn.discordapp.com/embed/avatars/0.png', false, true,  false)
ON CONFLICT (id) DO UPDATE SET
  discord_id = EXCLUDED.discord_id,
  discord_username = EXCLUDED.discord_username,
  avatar_url = EXCLUDED.avatar_url,
  is_admin = EXCLUDED.is_admin,
  mfa_verified = EXCLUDED.mfa_verified,
  guild_member = EXCLUDED.guild_member;

-- ------------------------------------------------------------
-- admin_discord_ids — opt the admin fixture Discord ID into auto-admin on
-- first login (mirrors the production pattern — handle_new_user trigger).
-- ------------------------------------------------------------
INSERT INTO public.admin_discord_ids (discord_id) VALUES
  ('100000000000000002')
ON CONFLICT (discord_id) DO NOTHING;

-- ------------------------------------------------------------
-- Fixture polls — 3 active + 1 closed. Titles include a unique SMOKE token
-- for the filter-search spec to narrow uniquely past the base seed.sql polls.
-- Category IDs reference the existing `supabase/seed.sql` rows.
-- Created_by points to the fixture admin user so the FK is valid.
-- NOTE: The "MiG-29" token also appears in supabase/seed.sql's first poll
-- ("Remove MiG-29 12-3 from 11.3 lineup"), so e2e/tests/filter-search.spec.ts
-- searches for "SMOKE" — uniquely present in this fixture's titles.
-- ------------------------------------------------------------
INSERT INTO public.polls (id, title, description, status, is_pinned, category_id, created_by, closes_at, closed_at, resolution, image_url) VALUES
  ('d0000000-0000-0000-0000-000000000001',
   '[E2E SMOKE] Remove MiG-29 12-3 from 11.3 lineup',
   'Playwright fixture suggestion — lineup change proposal for smoke coverage.',
   'active', false,
   'a0000000-0000-0000-0000-000000000001',
   '22222222-2222-2222-2222-222222222222',
   now() + interval '7 days', NULL, NULL, NULL),
  ('d0000000-0000-0000-0000-000000000002',
   '[E2E] Add Sinai to map rotation',
   'Playwright fixture suggestion — map pool proposal for smoke coverage.',
   'active', true,
   'a0000000-0000-0000-0000-000000000002',
   '22222222-2222-2222-2222-222222222222',
   now() + interval '10 days', NULL, NULL, NULL),
  ('d0000000-0000-0000-0000-000000000003',
   '[E2E] Extend round timer to 15 minutes',
   'Playwright fixture suggestion — rules proposal for smoke coverage.',
   'active', false,
   'a0000000-0000-0000-0000-000000000003',
   '22222222-2222-2222-2222-222222222222',
   now() + interval '5 days', NULL, NULL, NULL),
  ('d0000000-0000-0000-0000-000000000004',
   '[E2E] Archived Sweden bracket proposal',
   'Playwright fixture suggestion — closed, for archive/filter coverage.',
   'closed', false,
   'a0000000-0000-0000-0000-000000000001',
   '22222222-2222-2222-2222-222222222222',
   now() - interval '7 days', now() - interval '1 day', 'forwarded', NULL)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- Fixture choices — Yes/No pairs per poll, plus a 3-way for the timer poll.
-- ------------------------------------------------------------
INSERT INTO public.choices (id, poll_id, label, sort_order) VALUES
  -- MiG-29
  ('e0000000-0000-0000-0000-00000000001a', 'd0000000-0000-0000-0000-000000000001', 'Yes, remove it', 1),
  ('e0000000-0000-0000-0000-00000000001b', 'd0000000-0000-0000-0000-000000000001', 'No, keep it',    2),
  -- Sinai
  ('e0000000-0000-0000-0000-00000000002a', 'd0000000-0000-0000-0000-000000000002', 'Add Sinai',       1),
  ('e0000000-0000-0000-0000-00000000002b', 'd0000000-0000-0000-0000-000000000002', 'Current pool ok', 2),
  -- Timer
  ('e0000000-0000-0000-0000-00000000003a', 'd0000000-0000-0000-0000-000000000003', '15 minutes',      1),
  ('e0000000-0000-0000-0000-00000000003b', 'd0000000-0000-0000-0000-000000000003', 'Keep 12 minutes', 2),
  ('e0000000-0000-0000-0000-00000000003c', 'd0000000-0000-0000-0000-000000000003', '13 minutes',      3),
  -- Sweden (closed)
  ('e0000000-0000-0000-0000-00000000004a', 'd0000000-0000-0000-0000-000000000004', 'Yes, add Sweden', 1),
  ('e0000000-0000-0000-0000-00000000004b', 'd0000000-0000-0000-0000-000000000004', 'No',              2)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Fault injection infrastructure — LOCAL E2E ONLY.
-- Never present in production: guarded by app.e2e_seed_allowed above,
-- which is fail-closed via \set ON_ERROR_STOP on (in-file) and
-- -v ON_ERROR_STOP=1 on both CI psql invocations.
--
-- Title-scoped design: tests arm a row keyed by the unique poll title
-- they are about to create. The trigger fires ONLY for that title, so
-- concurrent integration files using different titles are unaffected.
-- Tests MUST disarm (try/finally) BEFORE afterEach poll cleanup, because
-- a live delete-sentinel would block the compensating DELETE in afterEach.
-- ============================================================

-- Asymmetry note: the TABLE is dropped+recreated (its shape may change across
-- runs, so DROP converges it), while the trigger FUNCTIONS below are CREATE OR
-- REPLACE (signature is stable, so replace-in-place is safe). Do not "simplify"
-- this table to CREATE IF NOT EXISTS — that reintroduces the shape-drift the DROP
-- exists to prevent.
--
-- DROP first: a prior run may have left the table in an older shape
-- (e.g. poll_id-keyed). Dropping guarantees the current (fault_title, ...)
-- schema on every apply — convergent re-seed, not just idempotent.
DROP TABLE IF EXISTS public.test_fault_config;
CREATE TABLE public.test_fault_config (
  fault_title    text        NOT NULL,
  fail_operation text        NOT NULL CHECK (fail_operation IN ('update', 'delete')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fault_title, fail_operation)
);
-- Clear stale sentinels from any crashed prior run (belt-and-suspenders —
-- the DROP+CREATE above already guarantees a fresh table, but this covers
-- any future edit that changes DROP back to CREATE IF NOT EXISTS).
TRUNCATE public.test_fault_config;
-- Service-role supabase-js client can INSERT/DELETE without a policy.
ALTER TABLE public.test_fault_config DISABLE ROW LEVEL SECURITY;

-- BEFORE UPDATE trigger: raises only when a matching (fault_title, 'update')
-- row exists. Empty table = no-op for every role (dormant by default).
-- SECURITY INVOKER: runs with caller privileges — no escalation possible.
CREATE OR REPLACE FUNCTION public.fault_inject_polls_before_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.test_fault_config
    WHERE fail_operation = 'update' AND fault_title = NEW.title
  ) THEN
    RAISE EXCEPTION '[FAULT-INJECT] deliberate UPDATE failure on poll %', NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS fault_inject_polls_update ON public.polls;
CREATE TRIGGER fault_inject_polls_update
  BEFORE UPDATE ON public.polls
  FOR EACH ROW EXECUTE FUNCTION public.fault_inject_polls_before_update();

-- BEFORE DELETE trigger: parallel pattern, keyed on OLD.title.
CREATE OR REPLACE FUNCTION public.fault_inject_polls_before_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.test_fault_config
    WHERE fail_operation = 'delete' AND fault_title = OLD.title
  ) THEN
    RAISE EXCEPTION '[FAULT-INJECT] deliberate DELETE failure on poll %', OLD.id;
  END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS fault_inject_polls_delete ON public.polls;
CREATE TRIGGER fault_inject_polls_delete
  BEFORE DELETE ON public.polls
  FOR EACH ROW EXECUTE FUNCTION public.fault_inject_polls_before_delete();
