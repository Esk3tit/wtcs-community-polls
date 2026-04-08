-- ============================================================
-- Guild Membership Column and Updated RPC
-- Phase 3 Plan 01: Discord server membership verification
-- ============================================================

-- Add guild_member column to profiles
ALTER TABLE public.profiles
  ADD COLUMN guild_member BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.guild_member
  IS 'Set to true by update_profile_after_auth RPC when user is verified as a member of the WTCS Discord server at login time via OAuth guilds scope.';

-- Update the profile_self_update_allowed trigger to block guild_member changes from client
CREATE OR REPLACE FUNCTION public.profile_self_update_allowed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.id != OLD.id THEN
    RAISE EXCEPTION 'Cannot change profile id';
  END IF;
  IF NEW.discord_id != OLD.discord_id THEN
    RAISE EXCEPTION 'Cannot change discord_id';
  END IF;
  IF NEW.is_admin != OLD.is_admin THEN
    RAISE EXCEPTION 'Cannot change is_admin via client';
  END IF;
  IF NEW.mfa_verified != OLD.mfa_verified THEN
    RAISE EXCEPTION 'Cannot change mfa_verified via client -- use update_profile_after_auth RPC';
  END IF;
  IF NEW.guild_member != OLD.guild_member THEN
    RAISE EXCEPTION 'Cannot change guild_member via client -- use update_profile_after_auth RPC';
  END IF;
  IF NEW.created_at != OLD.created_at THEN
    RAISE EXCEPTION 'Cannot change created_at';
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RPC to accept guild_member parameter
CREATE OR REPLACE FUNCTION public.update_profile_after_auth(
  p_mfa_verified BOOLEAN,
  p_discord_username TEXT,
  p_avatar_url TEXT,
  p_guild_member BOOLEAN DEFAULT FALSE
)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET
    mfa_verified = p_mfa_verified,
    discord_username = p_discord_username,
    avatar_url = p_avatar_url,
    guild_member = p_guild_member,
    updated_at = NOW()
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for current user';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
