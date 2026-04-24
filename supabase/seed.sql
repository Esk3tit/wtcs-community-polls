-- ============================================================
-- Seed Data: Initial Admin Accounts (ADMN-01, D-10)
-- Uses admin_discord_ids config table (R1 fix).
-- ============================================================
-- Replace these with actual admin Discord user IDs.
-- To find a Discord user ID: Enable Developer Mode in Discord settings,
-- then right-click a user and select "Copy User ID".
--
-- When these users log in via Discord OAuth for the first time,
-- the handle_new_user trigger will check this table and set
-- is_admin = TRUE on their profile automatically.
-- ============================================================

INSERT INTO public.admin_discord_ids (discord_id) VALUES
  ('REPLACE_WITH_ADMIN_1_DISCORD_ID'),
  ('REPLACE_WITH_ADMIN_2_DISCORD_ID')
ON CONFLICT (discord_id) DO NOTHING;

-- ============================================================
-- Seed Data: Categories (D-33)
-- ============================================================
INSERT INTO public.categories (id, name, slug, sort_order) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Lineup Changes', 'lineup-changes', 1),
  ('a0000000-0000-0000-0000-000000000002', 'Map Pool', 'map-pool', 2),
  ('a0000000-0000-0000-0000-000000000003', 'Rules', 'rules', 3)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Seed Data: auth.users shim rows for local dev only.
-- public.profiles.id has FK → auth.users.id, so we must create the auth rows
-- before inserting profiles. supabase/seed.sql runs ONLY on `supabase start`
-- and `supabase db reset` against the local Docker stack — never against
-- hosted Supabase projects — so these fixture auth users are safe here.
-- Mirrors the pattern used in e2e/fixtures/seed.sql (minus the bcrypt password,
-- since these accounts never log in — they only exist to satisfy the FK and
-- act as `created_by` targets for seed polls).
-- ============================================================
-- Empty strings (not NULL) for confirmation_token / recovery_token /
-- email_change_token_new / email_change: GoTrue v2.188+ scans these as
-- Go `string` and errors with "converting NULL to string is unsupported"
-- if any row in auth.users has NULL in these columns — even for rows
-- unrelated to the current sign-in, because GoTrue's user-lookup SELECT
-- scans multiple rows when emails collide. See e2e/fixtures/seed.sql for
-- the same fix and the full explanation.
INSERT INTO auth.users (
  id, instance_id, aud, role, email,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at
) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'seed-admin-1@local', '{"provider":"discord"}', '{"provider_id":"111111111111111111","full_name":"WTCS_Admin","avatar_url":"https://cdn.discordapp.com/embed/avatars/0.png"}',
   '', '', '', '', now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'seed-admin-2@local', '{"provider":"discord"}', '{"provider_id":"222222222222222222","full_name":"MapCommittee","avatar_url":"https://cdn.discordapp.com/embed/avatars/1.png"}',
   '', '', '', '', now(), now())
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Seed Data: Profiles (poll creators)
-- The auth.users INSERT above triggers handle_new_user (from
-- migration 00000000000002_triggers.sql), which auto-creates profile
-- rows with is_admin derived from admin_discord_ids. Since the
-- admin_discord_ids entries above are placeholder strings (not
-- matching the seeded provider_ids), the trigger produces profiles
-- with is_admin=false. We use ON CONFLICT DO UPDATE below to force
-- the seeded is_admin=true and mfa_verified=true — critical because
-- the trigger uses GREATEST(existing, new), so true sticks after.
-- ============================================================
INSERT INTO public.profiles (id, discord_id, discord_username, avatar_url, is_admin, mfa_verified) VALUES
  ('00000000-0000-0000-0000-000000000001', '111111111111111111', 'WTCS_Admin', 'https://cdn.discordapp.com/embed/avatars/0.png', true, true),
  ('00000000-0000-0000-0000-000000000002', '222222222222222222', 'MapCommittee', 'https://cdn.discordapp.com/embed/avatars/1.png', true, true)
ON CONFLICT (id) DO UPDATE SET
  discord_id = EXCLUDED.discord_id,
  discord_username = EXCLUDED.discord_username,
  avatar_url = EXCLUDED.avatar_url,
  is_admin = EXCLUDED.is_admin,
  mfa_verified = EXCLUDED.mfa_verified;

-- ============================================================
-- Seed Data: Suggestions (D-33)
-- Mix: 2 pinned active, 3 non-pinned active, 2 closed (1 addressed, 1 forwarded)
-- ============================================================
INSERT INTO public.polls (id, title, description, status, is_pinned, category_id, created_by, closes_at, closed_at, resolution, image_url) VALUES
  ('b0000000-0000-0000-0000-000000000001', 'Remove MiG-29 12-3 from 11.3 lineup', 'The MiG-29 (12-3) has been overperforming in the 11.3 bracket. Its radar and missile loadout give it a significant advantage over comparable aircraft. Should it be moved up or removed from the lineup?', 'active', true, 'a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NOW() + INTERVAL '7 days', NULL, NULL, NULL),
  ('b0000000-0000-0000-0000-000000000002', 'Add Sinai as permanent map in rotation', 'Sinai has been requested by multiple teams as a permanent addition to the competitive map pool. It offers good balance between long-range engagements and close-quarters combat.', 'active', true, 'a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', NOW() + INTERVAL '14 days', NULL, NULL, 'https://static.warthunder.com/upload/image/!2024/10/sinai_screenshot.jpg'),
  ('b0000000-0000-0000-0000-000000000003', 'Allow mixed nations in 8.7 bracket', 'Currently teams must field a single nation at 8.7. Should we allow mixed-nation lineups to increase variety and reduce queue times?', 'active', false, 'a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', NOW() + INTERVAL '10 days', NULL, NULL, NULL),
  ('b0000000-0000-0000-0000-000000000004', 'Replace Cargo Port with Aral Sea', 'Cargo Port has received negative feedback for spawn camping issues. Aral Sea could be a better fit for the 9.7 bracket.', 'active', false, 'a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', NOW() + INTERVAL '5 days', NULL, NULL, NULL),
  ('b0000000-0000-0000-0000-000000000005', 'Increase round timer from 12 to 15 minutes', 'Several matches have ended due to time rather than objectives. A 15-minute timer would allow more tactical gameplay without dragging matches out.', 'active', false, 'a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', NOW() + INTERVAL '3 days', NULL, NULL, NULL),
  ('b0000000-0000-0000-0000-000000000006', 'Remove uptiers beyond 1.0 BR spread', 'The community voted on whether uptiers beyond 1.0 BR should be eliminated from competitive matchmaking.', 'closed', false, 'a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', NOW() - INTERVAL '7 days', NOW() - INTERVAL '1 day', 'addressed', NULL),
  ('b0000000-0000-0000-0000-000000000007', 'Add Sweden to 10.3 bracket', 'Proposal to include Swedish vehicles in the 10.3 competitive bracket.', 'closed', false, 'a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', NOW() - INTERVAL '14 days', NOW() - INTERVAL '5 days', 'forwarded', NULL)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Seed Data: Choices
-- ============================================================
-- Poll 001: Remove MiG-29
INSERT INTO public.choices (id, poll_id, label, sort_order) VALUES
  ('c0000000-0000-0000-0000-00000000001a', 'b0000000-0000-0000-0000-000000000001', 'Yes, remove it', 1),
  ('c0000000-0000-0000-0000-00000000001b', 'b0000000-0000-0000-0000-000000000001', 'No, keep it', 2)
ON CONFLICT (id) DO NOTHING;

-- Poll 002: Sinai
INSERT INTO public.choices (id, poll_id, label, sort_order) VALUES
  ('c0000000-0000-0000-0000-00000000002a', 'b0000000-0000-0000-0000-000000000002', 'Yes, add Sinai', 1),
  ('c0000000-0000-0000-0000-00000000002b', 'b0000000-0000-0000-0000-000000000002', 'No, current pool is fine', 2),
  ('c0000000-0000-0000-0000-00000000002c', 'b0000000-0000-0000-0000-000000000002', 'Add it but on trial basis', 3)
ON CONFLICT (id) DO NOTHING;

-- Poll 003: Mixed nations
INSERT INTO public.choices (id, poll_id, label, sort_order) VALUES
  ('c0000000-0000-0000-0000-00000000003a', 'b0000000-0000-0000-0000-000000000003', 'Allow mixed nations', 1),
  ('c0000000-0000-0000-0000-00000000003b', 'b0000000-0000-0000-0000-000000000003', 'Keep single nation', 2)
ON CONFLICT (id) DO NOTHING;

-- Poll 004: Cargo Port replacement
INSERT INTO public.choices (id, poll_id, label, sort_order) VALUES
  ('c0000000-0000-0000-0000-00000000004a', 'b0000000-0000-0000-0000-000000000004', 'Replace with Aral Sea', 1),
  ('c0000000-0000-0000-0000-00000000004b', 'b0000000-0000-0000-0000-000000000004', 'Keep Cargo Port', 2),
  ('c0000000-0000-0000-0000-00000000004c', 'b0000000-0000-0000-0000-000000000004', 'Remove Cargo Port, don''t add Aral Sea', 3)
ON CONFLICT (id) DO NOTHING;

-- Poll 005: Round timer
INSERT INTO public.choices (id, poll_id, label, sort_order) VALUES
  ('c0000000-0000-0000-0000-00000000005a', 'b0000000-0000-0000-0000-000000000005', '15 minutes', 1),
  ('c0000000-0000-0000-0000-00000000005b', 'b0000000-0000-0000-0000-000000000005', 'Keep 12 minutes', 2),
  ('c0000000-0000-0000-0000-00000000005c', 'b0000000-0000-0000-0000-000000000005', '13 minutes (compromise)', 3),
  ('c0000000-0000-0000-0000-00000000005d', 'b0000000-0000-0000-0000-000000000005', '10 minutes (shorter)', 4)
ON CONFLICT (id) DO NOTHING;

-- Poll 006: Uptiers (closed)
INSERT INTO public.choices (id, poll_id, label, sort_order) VALUES
  ('c0000000-0000-0000-0000-00000000006a', 'b0000000-0000-0000-0000-000000000006', 'Yes, limit to 1.0 BR', 1),
  ('c0000000-0000-0000-0000-00000000006b', 'b0000000-0000-0000-0000-000000000006', 'No, keep current system', 2)
ON CONFLICT (id) DO NOTHING;

-- Poll 007: Sweden bracket (closed)
INSERT INTO public.choices (id, poll_id, label, sort_order) VALUES
  ('c0000000-0000-0000-0000-00000000007a', 'b0000000-0000-0000-0000-000000000007', 'Yes, add Sweden', 1),
  ('c0000000-0000-0000-0000-00000000007b', 'b0000000-0000-0000-0000-000000000007', 'No', 2),
  ('c0000000-0000-0000-0000-00000000007c', 'b0000000-0000-0000-0000-000000000007', 'Add but with restrictions', 3)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Seed Data: Vote Counts (for closed polls with results)
-- Note: These represent pre-aggregated counts. The increment_vote_count
-- trigger handles this automatically for new votes, but seed data
-- needs manual insertion.
-- ============================================================
-- Poll 006: Uptiers (closed, addressed)
INSERT INTO public.vote_counts (poll_id, choice_id, count) VALUES
  ('b0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-00000000006a', 47),
  ('b0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-00000000006b', 12)
ON CONFLICT (poll_id, choice_id) DO NOTHING;

-- Poll 007: Sweden bracket (closed, forwarded)
INSERT INTO public.vote_counts (poll_id, choice_id, count) VALUES
  ('b0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-00000000007a', 28),
  ('b0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-00000000007b', 15),
  ('b0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-00000000007c', 19)
ON CONFLICT (poll_id, choice_id) DO NOTHING;
