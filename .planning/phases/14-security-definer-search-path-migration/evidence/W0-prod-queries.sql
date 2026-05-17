-- ============================================================
-- W0 production-side checks for Phase 14
-- Run in Supabase Studio SQL editor:
--   https://supabase.com/dashboard/project/cbjspmwgyoxxqukcccjr/sql
-- Paste each query's output back into the conversation.
-- ============================================================


-- ------------------------------------------------------------
-- QUERY 1 — CHECK 1: rls_auto_enable ownership (decides R1/R2/R3)
-- Returns 0 or 1 row depending on whether the function exists.
-- Look at: schema, owner, owning_extension, is_security_definer.
-- ------------------------------------------------------------
SELECT
  n.nspname                                 AS schema,
  p.proname                                 AS function_name,
  pg_get_function_identity_arguments(p.oid) AS identity_args,
  p.proowner::regrole                       AS owner,
  p.proacl                                  AS acl,
  p.prosecdef                               AS is_security_definer,
  p.proconfig                               AS config,
  e.extname                                 AS owning_extension,
  pg_get_functiondef(p.oid)                 AS functiondef
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
LEFT JOIN pg_depend d
  ON d.objid = p.oid
  AND d.deptype = 'e'
LEFT JOIN pg_extension e
  ON e.oid = d.refobjid
WHERE p.proname = 'rls_auto_enable';


-- ------------------------------------------------------------
-- QUERY 2 — CHECK 1B: update_profile_after_auth overloads (decides U1/U2/U3)
-- Returns 1 or 2 rows depending on whether the 3-param overload still exists.
-- Look at: num_args. Expect either {4} (U1) or {3, 4} (U2). Single 3 = U3 (stop).
-- ------------------------------------------------------------
SELECT
  n.nspname                                  AS schema,
  p.proname                                  AS function_name,
  pg_get_function_identity_arguments(p.oid)  AS identity_args,
  p.pronargs                                 AS num_args,
  p.prosecdef                                AS is_security_definer,
  p.proconfig                                AS config,
  p.proowner::regrole                        AS owner
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'update_profile_after_auth'
ORDER BY p.pronargs;


-- ------------------------------------------------------------
-- QUERY 3 — CHECK 3: pre-deploy functiondef snapshot (rollback artifact)
-- Returns 6 rows (or 7 if Query 1 → R1 — see instructions below).
-- Paste ALL functiondef rows back; I save them verbatim to
--   evidence/pre-deploy-functiondef-snapshot.sql
-- and that file becomes the rollback source under D-08.
--
-- If Query 1 returned R1 (rls_auto_enable user-owned in public),
--   add a 7th line to the IN-list: 'rls_auto_enable'
-- If Query 1 returned R2/R3, leave as-is (6 entries).
-- ------------------------------------------------------------
SELECT pg_get_functiondef(p.oid) || E';\n' AS functiondef
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'is_current_user_admin',
    'increment_vote_count',
    'update_profile_after_auth',
    'handle_new_user',
    'validate_vote_choice',
    'profile_self_update_allowed'
    -- , 'rls_auto_enable'  -- uncomment if Query 1 → R1
  )
ORDER BY p.proname, p.pronargs;
