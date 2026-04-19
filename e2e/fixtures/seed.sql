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

-- ------------------------------------------------------------
-- auth.users — fixture accounts with bcrypt-hashed shared password.
-- `crypt()` + `gen_salt('bf')` are provided by pgcrypto, which Supabase
-- enables by default.
-- ------------------------------------------------------------
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'playwright-user-member@test.local', crypt('playwright-fixture-only-do-not-use-in-prod', gen_salt('bf')),
   now(), '{"provider":"email"}', '{"provider_id":"100000000000000001"}', now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'playwright-user-admin@test.local', crypt('playwright-fixture-only-do-not-use-in-prod', gen_salt('bf')),
   now(), '{"provider":"email"}', '{"provider_id":"100000000000000002"}', now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'playwright-user-no2fa@test.local', crypt('playwright-fixture-only-do-not-use-in-prod', gen_salt('bf')),
   now(), '{"provider":"email"}', '{"provider_id":"100000000000000003"}', now(), now()),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'playwright-user-notmember@test.local', crypt('playwright-fixture-only-do-not-use-in-prod', gen_salt('bf')),
   now(), '{"provider":"email"}', '{"provider_id":"100000000000000004"}', now(), now())
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- public.profiles — 4 matching profile rows. Covers all D-08 spec needs:
--   memberUser    — mfa_verified + guild_member      (happy path)
--   adminUser     — is_admin + mfa + guild_member    (admin-create spec)
--   no2faUser     — mfa_verified FALSE               (auth-errors 2fa variant)
--   notInServer   — guild_member FALSE               (auth-errors not-in-server)
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
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- admin_discord_ids — opt the admin fixture Discord ID into auto-admin on
-- first login (mirrors the production pattern — handle_new_user trigger).
-- ------------------------------------------------------------
INSERT INTO public.admin_discord_ids (discord_id) VALUES
  ('100000000000000002')
ON CONFLICT (discord_id) DO NOTHING;

-- ------------------------------------------------------------
-- Fixture polls — 3 active + 1 closed. Titles include recognizable tokens
-- for the filter-search spec (e.g. "MiG-29" for a narrow search).
-- Category IDs reference the existing `supabase/seed.sql` rows.
-- Created_by points to the fixture admin user so the FK is valid.
-- ------------------------------------------------------------
INSERT INTO public.polls (id, title, description, status, is_pinned, category_id, created_by, closes_at, closed_at, resolution, image_url) VALUES
  ('d0000000-0000-0000-0000-000000000001',
   '[E2E] Remove MiG-29 12-3 from 11.3 lineup',
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
