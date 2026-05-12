-- =====================================================================
-- Phase 11 follow-up #3: atomic last-admin guard for admin demotion
-- Closes PR #26 review threads on demote-admin/index.ts:
--   1. Race: the EF's two-step check-then-update (count admins, then
--      update is_admin=false) was not atomic. Two concurrent demotions
--      could both pass the count check and leave the system with zero
--      admins — a lockout. (CodeRabbit Critical.)
--   2. Audit `before.is_admin` was hardcoded to `true`, lying when the
--      target row was already non-admin (e.g., a stale UI emitting a
--      redundant demote). (CodeRabbit Major.)
--
-- This function performs both — last-admin verification AND the
-- demotion — inside a single transaction with row-level locks. The
-- target row is locked first to pin its prior state; then all admin
-- rows are locked in id order (deterministic — avoids deadlocks with
-- concurrent demote_admin_guarded calls). The count is taken under the
-- locks. Two concurrent demotions serialize through these locks rather
-- than racing.
--
-- Error codes (P0001-P0003) map back to user-facing HTTP statuses in
-- the EF: profile_not_found → 404, already_demoted → 409, last_admin
-- → 400. Distinct codes per failure mode so the EF can map without
-- pattern-matching error messages.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.demote_admin_guarded(
  p_target_user_id uuid
) RETURNS TABLE (id uuid, is_admin_before boolean)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_prior_is_admin boolean;
  v_admin_count int;
BEGIN
  -- Lock target row first to capture prior is_admin under lock.
  SELECT profiles.is_admin INTO v_prior_is_admin
  FROM public.profiles
  WHERE profiles.id = p_target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found' USING errcode = 'P0001';
  END IF;

  IF v_prior_is_admin = false THEN
    RAISE EXCEPTION 'already_demoted' USING errcode = 'P0002';
  END IF;

  -- Lock all admin rows in id order, then count under the lock. The
  -- ORDER BY id makes lock acquisition deterministic so two concurrent
  -- calls cannot deadlock on different lock orders.
  WITH locked_admins AS (
    SELECT profiles.id
    FROM public.profiles
    WHERE profiles.is_admin = true
    ORDER BY profiles.id
    FOR UPDATE
  )
  SELECT count(*) INTO v_admin_count FROM locked_admins;

  IF v_admin_count <= 1 THEN
    RAISE EXCEPTION 'last_admin' USING errcode = 'P0003';
  END IF;

  UPDATE public.profiles
  SET is_admin = false
  WHERE profiles.id = p_target_user_id;

  RETURN QUERY SELECT p_target_user_id, v_prior_is_admin;
END;
$$;

-- Keep this RPC off the public REST surface: only service-role (which
-- bypasses GRANT/REVOKE on functions per Supabase contract) should call
-- it. The demote-admin EF runs as service-role.
REVOKE EXECUTE ON FUNCTION public.demote_admin_guarded(uuid) FROM anon, authenticated, public;

COMMENT ON FUNCTION public.demote_admin_guarded(uuid) IS
  'Atomic last-admin-guarded demotion. Locks the target row, locks all admin rows in id order, verifies >1 admin remains after demotion, performs the UPDATE — all in one transaction. Raises P0001/P0002/P0003 for profile_not_found / already_demoted / last_admin. Service-role only (REVOKE EXECUTE FROM anon/authenticated/public); called by the demote-admin Edge Function.';
