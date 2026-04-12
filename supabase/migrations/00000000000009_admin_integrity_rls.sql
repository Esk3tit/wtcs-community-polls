-- 00000000000009_admin_integrity_rls.sql
--
-- Fix: is_current_user_admin() only checked profiles.is_admin, but the
-- Edge Function requireAdmin also verifies mfa_verified and guild_member.
-- An admin who lost guild membership or MFA after re-auth could bypass
-- the EF layer via direct PostgREST calls and read vote attributions
-- through the admin-bypass RLS branch.
--
-- Align the DB function with the EF integrity check.

CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin AND mfa_verified AND guild_member
     FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

COMMENT ON FUNCTION public.is_current_user_admin IS
  'Returns true only when the authenticated caller has is_admin=true AND mfa_verified=true AND guild_member=true. Aligns with Edge Function requireAdmin integrity checks so direct PostgREST callers cannot bypass the EF layer. SECURITY DEFINER to bypass RLS on profiles. STABLE for per-statement caching.';
