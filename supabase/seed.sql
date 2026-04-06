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
