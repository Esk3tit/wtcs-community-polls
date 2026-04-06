-- ============================================================
-- WTCS Community Polls -- Full Database Schema
-- Phase 1: Created upfront per D-08
-- Review R1 fix: admin_discord_ids table replaces pre-inserted profiles
-- Review R2 fix: discord_id extraction uses COALESCE chain
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Table: admin_discord_ids (review R1 fix for FK constraint)
-- Simple config table mapping Discord IDs to admin status.
-- The handle_new_user trigger checks this table on signup.
-- No FK to profiles -- seeded BEFORE any user logs in.
-- ============================================================
CREATE TABLE public.admin_discord_ids (
  discord_id TEXT PRIMARY KEY,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.admin_discord_ids IS 'Config table for initial admin Discord IDs. Checked by handle_new_user trigger to derive admin status on first login.';

-- ============================================================
-- Table: profiles
-- Synced from auth.users via trigger on signup (D-11)
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  discord_id TEXT NOT NULL UNIQUE,
  discord_username TEXT NOT NULL,
  avatar_url TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'User profiles synced from Discord OAuth. One row per authenticated user.';
COMMENT ON COLUMN public.profiles.mfa_verified IS 'Set to true by the update_profile_after_auth RPC function during auth callback. NOT client-writable via RLS -- review R2 security fix.';
COMMENT ON COLUMN public.profiles.is_admin IS 'Derived from admin_discord_ids table on first login. Can also be set by admin promotion in Phase 4.';

-- ============================================================
-- Table: categories
-- ============================================================
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.categories IS 'Admin-managed suggestion categories (e.g., Lineup Changes, Map Pool, Rules).';

-- ============================================================
-- Table: polls
-- Internal name for "suggestions/topics" (D-17)
-- ============================================================
CREATE TABLE public.polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'closed')),
  resolution TEXT
    CHECK (resolution IS NULL OR resolution IN ('addressed', 'forwarded', 'closed')),
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  closes_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.polls IS 'Suggestions/topics created by admins. Internal name "polls" for code alignment.';
COMMENT ON COLUMN public.polls.resolution IS 'Resolution status per D-18: addressed, forwarded, or closed. NULL while active.';

-- ============================================================
-- Table: choices
-- ============================================================
CREATE TABLE public.choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.choices IS 'Response choices within a suggestion. Minimum 2 per poll.';

-- ============================================================
-- Table: votes
-- One response per user per poll (UNIQUE constraint)
-- ============================================================
CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  choice_id UUID NOT NULL REFERENCES public.choices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT votes_one_per_user_per_poll UNIQUE (poll_id, user_id)
);

COMMENT ON TABLE public.votes IS 'User responses. One per user per suggestion, enforced by UNIQUE constraint. choice_id validated by trigger to belong to poll_id.';

-- ============================================================
-- Table: vote_counts
-- Pre-aggregated response counts (maintained by upsert trigger)
-- ============================================================
CREATE TABLE public.vote_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  choice_id UUID NOT NULL REFERENCES public.choices(id) ON DELETE CASCADE,
  count INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT vote_counts_one_per_choice UNIQUE (poll_id, choice_id)
);

COMMENT ON TABLE public.vote_counts IS 'Pre-aggregated response counts. Upserted by trigger on votes INSERT.';

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_votes_poll_user ON public.votes(poll_id, user_id);
CREATE INDEX idx_vote_counts_poll ON public.vote_counts(poll_id);
CREATE INDEX idx_polls_status_created ON public.polls(status, created_at DESC);
CREATE INDEX idx_polls_category ON public.polls(category_id);
CREATE INDEX idx_profiles_discord_id ON public.profiles(discord_id);
