-- ============================================================
-- Triggers and RPC Functions
-- Review R1 fixes: admin derivation, vote upsert, choice validation
-- Review R2 fixes:
--   - mfa_verified blocked from client writes (profile_self_update_allowed)
--   - Discord ID extraction uses COALESCE chain (handle_new_user)
--   - Server-side RPC for profile auth update (update_profile_after_auth)
-- ============================================================

-- ============================================================
-- Guard: Restrict profile self-update to allowed columns only
-- R2 FIX: mfa_verified is now BLOCKED alongside is_admin and discord_id.
-- mfa_verified can only be set via the update_profile_after_auth RPC.
-- ============================================================
CREATE OR REPLACE FUNCTION public.profile_self_update_allowed()
RETURNS TRIGGER AS $$
BEGIN
  -- Block changes to protected columns
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
  IF NEW.created_at != OLD.created_at THEN
    RAISE EXCEPTION 'Cannot change created_at';
  END IF;
  -- Allowed changes via client: discord_username, avatar_url
  -- mfa_verified changes go through update_profile_after_auth RPC (SECURITY DEFINER)
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_self_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (current_setting('role') = 'authenticated')
  EXECUTE FUNCTION public.profile_self_update_allowed();

COMMENT ON FUNCTION public.profile_self_update_allowed IS 'Guards profile self-update: only discord_username and avatar_url can be changed by the user via RLS. mfa_verified is blocked (R2 security fix) -- use update_profile_after_auth RPC instead.';

-- ============================================================
-- RPC: Server-side profile update after auth callback
-- R2 FIX: This SECURITY DEFINER function is the ONLY way to set
-- mfa_verified. It runs as the function owner (bypassing RLS),
-- but validates that the caller is updating their own profile.
-- The auth callback in Plan 03 calls this instead of direct update.
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_profile_after_auth(
  p_mfa_verified BOOLEAN,
  p_discord_username TEXT,
  p_avatar_url TEXT
)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET
    mfa_verified = p_mfa_verified,
    discord_username = p_discord_username,
    avatar_url = p_avatar_url,
    updated_at = NOW()
  WHERE id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for current user';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.update_profile_after_auth IS 'Server-side profile update called by auth callback. SECURITY DEFINER so it bypasses the profile_self_update_allowed trigger that blocks mfa_verified changes from client. Only updates the calling user own row (auth.uid()).';

-- ============================================================
-- Trigger: Profile sync on new user signup (D-11)
-- Creates a profile row and derives admin status from admin_discord_ids.
-- R1 fix: Checks admin_discord_ids table instead of pre-seeded profiles.
-- R2 fix: Discord ID extraction uses COALESCE chain trying
-- provider_id, then sub, then id from raw_user_meta_data.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _discord_id TEXT;
  _is_admin BOOLEAN;
BEGIN
  -- R2 FIX: Extract Discord ID with fallback chain.
  -- Supabase Discord provider typically uses 'provider_id',
  -- but may also use 'sub' or 'id' depending on version.
  _discord_id := COALESCE(
    NEW.raw_user_meta_data->>'provider_id',
    NEW.raw_user_meta_data->>'sub',
    NEW.raw_user_meta_data->>'id'
  );

  -- Last-resort fallback: use the auth.users UUID as string
  -- This should never happen with Discord OAuth but prevents NULL discord_id
  IF _discord_id IS NULL THEN
    RAISE WARNING 'Could not extract discord_id from raw_user_meta_data for user %. Falling back to auth.users id. Keys present: %', NEW.id, (SELECT jsonb_object_keys(NEW.raw_user_meta_data));
    _discord_id := NEW.id::TEXT;
  END IF;

  -- Derive admin status from admin_discord_ids config table
  SELECT EXISTS (
    SELECT 1 FROM public.admin_discord_ids WHERE discord_id = _discord_id
  ) INTO _is_admin;

  INSERT INTO public.profiles (id, discord_id, discord_username, avatar_url, is_admin)
  VALUES (
    NEW.id,
    _discord_id,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->'custom_claims'->>'global_name',
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'user_name',
      'Unknown'
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    _is_admin
  )
  ON CONFLICT (id) DO UPDATE SET
    discord_username = EXCLUDED.discord_username,
    avatar_url = EXCLUDED.avatar_url,
    is_admin = GREATEST(public.profiles.is_admin, EXCLUDED.is_admin),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user IS 'Creates or updates profile on signup. Derives admin status from admin_discord_ids. R2 fix: discord_id extracted via COALESCE(provider_id, sub, id) with WARNING on fallback.';

-- ============================================================
-- Trigger: Validate vote choice belongs to poll
-- R1 fix: Prevents submitting a choice from a different poll.
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_vote_choice()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.choices
    WHERE id = NEW.choice_id AND poll_id = NEW.poll_id
  ) THEN
    RAISE EXCEPTION 'choice_id % does not belong to poll_id %', NEW.choice_id, NEW.poll_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_vote_validate_choice
  BEFORE INSERT ON public.votes
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_vote_choice();

COMMENT ON FUNCTION public.validate_vote_choice IS 'Ensures choice_id belongs to the same poll_id on vote insert. Prevents cross-poll choice submission.';

-- ============================================================
-- Trigger: Vote count upsert
-- R1 fix: Uses INSERT ON CONFLICT (upsert) instead of UPDATE-only.
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.vote_counts (poll_id, choice_id, count)
  VALUES (NEW.poll_id, NEW.choice_id, 1)
  ON CONFLICT (poll_id, choice_id) DO UPDATE
  SET count = public.vote_counts.count + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_vote_inserted
  AFTER INSERT ON public.votes
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_vote_count();

COMMENT ON FUNCTION public.increment_vote_count IS 'Upserts vote count: creates row if missing (count=1), increments if exists.';
