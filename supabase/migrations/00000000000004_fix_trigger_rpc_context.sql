-- ============================================================
-- Fix: Allow SECURITY DEFINER RPCs to modify protected columns
-- The profile_self_update_allowed trigger was blocking the
-- update_profile_after_auth RPC from setting mfa_verified and
-- guild_member because it fires on ALL updates, not just client ones.
--
-- Fix: Skip protected-column checks when current_user != session_user,
-- which indicates the UPDATE is coming from a SECURITY DEFINER function
-- (where current_user = function owner, session_user = original caller).
-- ============================================================

CREATE OR REPLACE FUNCTION public.profile_self_update_allowed()
RETURNS TRIGGER AS $$
BEGIN
  -- Always enforce immutable columns regardless of caller
  IF NEW.id != OLD.id THEN
    RAISE EXCEPTION 'Cannot change profile id';
  END IF;
  IF NEW.discord_id != OLD.discord_id THEN
    RAISE EXCEPTION 'Cannot change discord_id';
  END IF;
  IF NEW.created_at != OLD.created_at THEN
    RAISE EXCEPTION 'Cannot change created_at';
  END IF;

  -- Skip protected-column checks when called from SECURITY DEFINER functions
  -- (e.g., update_profile_after_auth RPC). In that context, current_user is
  -- the function owner (e.g., postgres), not the session role (authenticated).
  IF current_user = session_user THEN
    -- Direct client update — enforce protected column restrictions
    IF NEW.is_admin != OLD.is_admin THEN
      RAISE EXCEPTION 'Cannot change is_admin via client';
    END IF;
    IF NEW.mfa_verified != OLD.mfa_verified THEN
      RAISE EXCEPTION 'Cannot change mfa_verified via client -- use update_profile_after_auth RPC';
    END IF;
    IF NEW.guild_member != OLD.guild_member THEN
      RAISE EXCEPTION 'Cannot change guild_member via client -- use update_profile_after_auth RPC';
    END IF;
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
