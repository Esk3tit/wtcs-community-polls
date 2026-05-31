-- ============================================================================
-- Phase 14 pre-deploy emergency restore SQL — production functiondef snapshot
-- Captured: 2026-05-17 via Supabase Studio SQL editor against project cbjspmwgyoxxqukcccjr
-- Query source: .planning/phases/14-security-definer-search-path-migration/evidence/W0-prod-queries.sql (Query 3)
--
-- Rollback procedure (D-08, fix-forward via Studio):
--   If Migration 14 breaks production, paste any individual function block
--   below into Supabase Studio SQL editor and execute.
--   Service-role required (Studio session has it).
--
-- 7 entries — 6 distinct function names + 2 update_profile_after_auth overloads
-- (3-param + 4-param). The 3-param overload is intentionally captured here
-- (it is dropped by Migration 14 unconditionally per Cycle-3 Option A).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  _discord_id TEXT;
  _is_admin BOOLEAN;
BEGIN
  _discord_id := COALESCE(
    NEW.raw_user_meta_data->>'provider_id',
    NEW.raw_user_meta_data->>'sub',
    NEW.raw_user_meta_data->>'id'
  );

  IF _discord_id IS NULL THEN
    _discord_id := NEW.id::TEXT;
  END IF;

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
$function$
;

CREATE OR REPLACE FUNCTION public.increment_vote_count()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO public.vote_counts (poll_id, choice_id, count)
  VALUES (NEW.poll_id, NEW.choice_id, 1)
  ON CONFLICT (poll_id, choice_id) DO UPDATE
  SET count = public.vote_counts.count + 1;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT is_admin AND mfa_verified AND guild_member
     FROM public.profiles WHERE id = auth.uid()),
    false
  );
$function$
;

CREATE OR REPLACE FUNCTION public.profile_self_update_allowed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_profile_after_auth(p_mfa_verified boolean, p_discord_username text, p_avatar_url text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.update_profile_after_auth(p_mfa_verified boolean, p_discord_username text, p_avatar_url text, p_guild_member boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.validate_vote_choice()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.choices
    WHERE id = NEW.choice_id AND poll_id = NEW.poll_id
  ) THEN
    RAISE EXCEPTION 'choice_id % does not belong to poll_id %', NEW.choice_id, NEW.poll_id;
  END IF;
  RETURN NEW;
END;
$function$
;
