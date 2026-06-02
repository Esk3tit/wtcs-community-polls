-- Replaces the permanently-false caller-identity gate in
-- profile_self_update_allowed with a transaction-local GUC flag
-- (app.trusted_profile_update) set by update_profile_after_auth.
--
-- DBHY-05: inside a SECURITY DEFINER trigger, current_user always resolves to
-- the function owner, never to the session role — the prior identity check was
-- always false, so direct client UPDATEs to is_admin, mfa_verified, and
-- guild_member were silently accepted. This migration makes the gate functional.
--
-- GUC built-ins are pg_catalog-qualified (pg_catalog.set_config,
-- pg_catalog.current_setting) because search_path is pinned to empty string
-- on these functions — an unqualified built-in would fail to resolve at call time.
--
-- Gate predicate uses IS DISTINCT FROM 'on' (null-safe three-valued-logic-safe),
-- matching the in-repo precedent at e2e/fixtures/seed.sql (app.e2e_seed_allowed
-- IS DISTINCT FROM 'true').
--
-- Migration also makes the update_profile_after_auth EXECUTE grant explicit:
-- REVOKE ... FROM PUBLIC + GRANT ... TO authenticated, so the trusted boundary
-- is auditable rather than relying on the Postgres default PUBLIC EXECUTE.


-- update_profile_after_auth — sets the transaction-local GUC before UPDATE
-- so profile_self_update_allowed sees the trusted-context flag within the
-- same transaction.
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
  -- Mark this transaction as trusted so profile_self_update_allowed
  -- skips protected-column checks. is_local=true (third arg) scopes the
  -- GUC to this transaction only — auto-clears on commit/rollback, safe
  -- under PgBouncer transaction pooling.
  PERFORM pg_catalog.set_config('app.trusted_profile_update', 'on', true);

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


-- profile_self_update_allowed — replaces the permanently-false identity gate
-- with the GUC check. The flag is set by update_profile_after_auth before
-- its UPDATE; direct client UPDATEs do not set it, so the flag is absent
-- and protected-column checks run (IS DISTINCT FROM 'on' fires).
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

  -- Check trusted-context flag set by update_profile_after_auth.
  -- missing_ok=true (second arg) returns '' when the GUC is absent
  -- (direct client path) instead of raising. IS DISTINCT FROM 'on' is
  -- null-safe; gate fires (protected checks run) when the flag is absent.
  IF pg_catalog.current_setting('app.trusted_profile_update', true) IS DISTINCT FROM 'on' THEN
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


COMMENT ON FUNCTION public.profile_self_update_allowed IS
  'Guards profile self-update: blocks id/discord_id/created_at unconditionally; '
  'blocks is_admin/mfa_verified/guild_member when app.trusted_profile_update GUC is absent '
  '(direct client write). update_profile_after_auth sets the GUC (transaction-local, '
  'is_local=true) before its UPDATE so the protected-column checks are skipped on the '
  'RPC path. IS DISTINCT FROM ''on'' is used for null-safe gate evaluation.';

COMMENT ON FUNCTION public.update_profile_after_auth(BOOLEAN, TEXT, TEXT, BOOLEAN) IS
  'SECURITY DEFINER RPC: sets the transaction-local GUC app.trusted_profile_update '
  'before updating the caller''s own profile row (auth.uid()). This makes it the sole '
  'sanctioned writer for mfa_verified and guild_member. TRUST BOUNDARY: trusts '
  'caller-supplied p_mfa_verified / p_guild_member, which are computed client-side in '
  'src/lib/auth-helpers.ts from Discord OAuth responses (mfa_enabled flag + '
  '/users/@me/guilds). Server-side re-validation of Discord MFA/guild state is an '
  'accepted residual (pre-existing design, no live users) — closing the direct-PostgREST '
  'escalation path is the scope of DBHY-05.';


-- Make the EXECUTE grant explicit so the trusted boundary is auditable.
-- Prior migrations did not set an explicit grant; the RPC relied on the
-- Postgres default PUBLIC EXECUTE. Anon clients can no longer call this RPC.
REVOKE EXECUTE ON FUNCTION public.update_profile_after_auth(BOOLEAN, TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_profile_after_auth(BOOLEAN, TEXT, TEXT, BOOLEAN) TO authenticated;
