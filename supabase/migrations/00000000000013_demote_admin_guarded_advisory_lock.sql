-- =====================================================================
-- Phase 11 follow-up #4: demote_admin_guarded — advisory-lock serialization
-- Closes PR #26 Greptile P1 review on migration 12's deadlock window.
--
-- The migration-12 implementation acquired locks in two phases:
--   1. SELECT ... FOR UPDATE on the target profile row
--   2. WITH locked_admins AS (SELECT ... FOR UPDATE ORDER BY id) to count
--      remaining admins under lock
--
-- The accompanying comment claimed ORDER BY id "avoids deadlocks", but
-- Postgres acquires FOR UPDATE locks during the heap scan, not after
-- sorting. Two concurrent demotions targeting different admins (A demotes
-- X; B demotes Y) hold their target locks, then both scan the admin set
-- in heap order. If the scan encounters Y before X (call A) and X before
-- Y (call B) — typical for unrelated heap layouts — the two calls
-- circular-wait on each other's target lock. Postgres detects the
-- deadlock and aborts one transaction (40P01), which the EF surfaces as
-- a 500 to the user.
--
-- Fix: replace both FOR UPDATE phases with a transaction-scoped advisory
-- lock keyed on hashtext('demote_admin_guarded'). The lock serializes
-- ALL concurrent demote_admin_guarded calls through a single mutex;
-- only one transaction holds it at a time, so the read/count/update
-- sequence is effectively single-threaded across the whole operation.
-- pg_advisory_xact_lock auto-releases on COMMIT or ROLLBACK.
--
-- Trade-off: throughput is limited to one demotion at a time globally.
-- For this project (0–10 admins, demote is a manual admin tool, never
-- bulk) the limit is far above the realistic call rate. Correctness >
-- concurrency here.
--
-- This is a forward-only migration that uses CREATE OR REPLACE to swap
-- the function body in place. The function signature and error codes
-- are unchanged, so the demote-admin Edge Function does not need to be
-- redeployed.
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
  -- Transaction-scoped advisory lock serializes ALL concurrent
  -- demote_admin_guarded calls. The hashtext('demote_admin_guarded')
  -- key is deterministic, so every transaction targets the same lock
  -- slot; pg_advisory_xact_lock blocks until the slot is free.
  PERFORM pg_advisory_xact_lock(hashtext('demote_admin_guarded'));

  -- With the advisory lock held, no other demote_admin_guarded call can
  -- be mutating profiles concurrently, so the unsynchronized read and
  -- count below are safe — a no-FOR-UPDATE plain SELECT is equivalent
  -- to a locked read under serialized access.
  SELECT profiles.is_admin INTO v_prior_is_admin
  FROM public.profiles
  WHERE profiles.id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found' USING errcode = 'P0001';
  END IF;

  IF v_prior_is_admin = false THEN
    RAISE EXCEPTION 'already_demoted' USING errcode = 'P0002';
  END IF;

  SELECT count(*) INTO v_admin_count
  FROM public.profiles
  WHERE profiles.is_admin = true;

  IF v_admin_count <= 1 THEN
    RAISE EXCEPTION 'last_admin' USING errcode = 'P0003';
  END IF;

  UPDATE public.profiles
  SET is_admin = false
  WHERE profiles.id = p_target_user_id;

  RETURN QUERY SELECT p_target_user_id, v_prior_is_admin;
END;
$$;

-- Re-apply the REVOKE because CREATE OR REPLACE FUNCTION can reset some
-- function attributes; explicit REVOKE keeps the function off the
-- PostgREST surface for non-service-role callers.
REVOKE EXECUTE ON FUNCTION public.demote_admin_guarded(uuid) FROM anon, authenticated, public;

COMMENT ON FUNCTION public.demote_admin_guarded(uuid) IS
  'Atomic last-admin-guarded demotion. Serializes concurrent calls via pg_advisory_xact_lock(hashtext(''demote_admin_guarded'')) — replaces migration 12''s FOR UPDATE pattern, which had a heap-scan-order deadlock window. Raises P0001/P0002/P0003 for profile_not_found / already_demoted / last_admin. Service-role only (REVOKE EXECUTE FROM anon/authenticated/public); called by the demote-admin Edge Function.';
