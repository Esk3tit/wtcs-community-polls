-- Hardens pre-existing definer-rights functions by pinning
-- search_path = '' and ensuring all references are schema-qualified.
-- Clears `0011_function_search_path_mutable` advisor WARNs for the
-- 6 user-owned functions targeted here. The dashboard-installed
-- `rls_auto_enable` event trigger is not user-owned and is excluded.
--
-- Bodies match the production pg_get_functiondef output captured
-- before this migration was authored — only the SET search_path
-- clause is added (or changed from `public` to `''` for
-- is_current_user_admin).
--
-- The 3-param update_profile_after_auth overload is dropped — only
-- the 4-param signature is callable from any code path.


-- Remove stale 3-param overload; only 4-param is reachable from app code.
DROP FUNCTION IF EXISTS public.update_profile_after_auth(BOOLEAN, TEXT, TEXT);


-- handle_new_user — fires from on_auth_user_created trigger on auth.users.
-- Body matches production verbatim (no RAISE WARNING on discord_id fallback).
-- Observability gap: the discord_id COALESCE fallback to NEW.id::TEXT is now
-- silent. If a future Supabase Auth SDK upgrade renames the OAuth claim shape,
-- new signups land with a UUID-string discord_id and lose admin lookup with no
-- pg log signal. Future remediation should add an audit_log INSERT (or Sentry
-- breadcrumb from the client post-signup) inside the IF _discord_id IS NULL
-- branch so the fallback remains observable.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;


-- increment_vote_count — fires from on_vote_inserted trigger on public.votes.
-- INSERT target is already schema-qualified; only the search_path clause is new.
CREATE OR REPLACE FUNCTION public.increment_vote_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.vote_counts (poll_id, choice_id, count)
  VALUES (NEW.poll_id, NEW.choice_id, 1)
  ON CONFLICT (poll_id, choice_id) DO UPDATE
  SET count = public.vote_counts.count + 1;
  RETURN NEW;
END;
$$;


-- is_current_user_admin — body-identical rewrite; only search_path value changes
-- from 'public' to ''. Gates admin RLS on all admin-bypass tables, so behavioral
-- drift here would break every admin-gated read/write at once.
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT is_admin AND mfa_verified AND guild_member
     FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;


-- profile_self_update_allowed — BEFORE-UPDATE trigger on public.profiles.
-- Distinguishes definer-rights context (current_user != session_user) from
-- direct client updates to enforce protected-column write rules.
CREATE OR REPLACE FUNCTION public.profile_self_update_allowed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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

  -- Skip protected-column checks when invoked through a definer-rights
  -- function (e.g., update_profile_after_auth RPC). In that context,
  -- current_user is the function owner (e.g., postgres), not the session role.
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
$$;


-- update_profile_after_auth — 4-param signature. Called once per Discord OAuth
-- login from src/lib/auth-helpers.ts to commit MFA + guild membership server-side.
CREATE OR REPLACE FUNCTION public.update_profile_after_auth(
  p_mfa_verified BOOLEAN,
  p_discord_username TEXT,
  p_avatar_url TEXT,
  p_guild_member BOOLEAN DEFAULT FALSE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;


-- validate_vote_choice — BEFORE-INSERT trigger on public.votes; rejects rows
-- whose (poll_id, choice_id) tuple is not present in public.choices.
CREATE OR REPLACE FUNCTION public.validate_vote_choice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.choices
    WHERE id = NEW.choice_id AND poll_id = NEW.poll_id
  ) THEN
    RAISE EXCEPTION 'choice_id % does not belong to poll_id %', NEW.choice_id, NEW.poll_id;
  END IF;
  RETURN NEW;
END;
$$;
