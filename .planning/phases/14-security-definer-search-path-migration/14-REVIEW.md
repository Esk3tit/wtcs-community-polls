---
phase: 14-security-definer-search-path-migration
reviewed: 2026-05-17T00:00:00Z
depth: deep
files_reviewed: 2
files_reviewed_list:
  - supabase/migrations/00000000000014_harden_security_definer_search_path.sql
  - tests/sql/is_current_user_admin_regression.sql
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-05-17
**Depth:** deep
**Files Reviewed:** 2
**Status:** issues_found

## Summary

Phase 14 hardens six pre-existing `SECURITY DEFINER` functions by pinning `SET search_path = ''` and ensuring every body reference is schema-qualified. The migration is structurally correct, idempotent, and preserves OID + grants where it should. The accompanying SQL fixture (`tests/sql/is_current_user_admin_regression.sql`) exercises four identity branches of `is_current_user_admin()` plus two RLS branches on `public.audit_log` under `SET LOCAL ROLE authenticated`.

Two WARNING-level findings:

1. The migration silently supersedes the `RAISE WARNING` branch in `handle_new_user`'s discord_id fallback. This is intentional per plan ("production-verbatim") but eliminates an observability hook with no docstring acknowledging the observability loss, no Sentry/audit_log substitute, and no migration-2 update to keep the source-of-truth coherent.
2. The fixture's `INSERT INTO public.profiles … ON CONFLICT (id) DO UPDATE` does NOT include `discord_id` in the SET list. The trigger-inserted row uses a UUID-as-text fallback (because `raw_user_meta_data` is NULL on the fixture's privileged `INSERT INTO auth.users`), and the fixture's explicit snowflake values (`'900000000000000001'`, etc.) are silently discarded. The test still passes because `is_current_user_admin()` does not read `discord_id`, but the fixture data does not match the comment claim ("4 identity branches") in a column-accurate sense and will mislead anyone extending the fixture to assert against `discord_id`.

Five INFO-level findings cover comment archaeology, comment-vs-source drift, and minor robustness gaps.

No BLOCKER findings. All schema-qualification is correct; no unqualified table or function reference would 42P01 at runtime under `search_path = ''`. The `DROP FUNCTION IF EXISTS` targets only the 3-param overload and does not strip grants from the 4-param signature.

## Structural Findings (fallow)

_No structural findings block was supplied with this review request; structural pre-pass was not performed for this phase._

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Silent loss of `RAISE WARNING` observability in `handle_new_user` discord_id fallback

**File:** `supabase/migrations/00000000000014_harden_security_definer_search_path.sql:38-40`
**Issue:** Migration 2's `handle_new_user` raises a `WARNING` (with `Keys present: %`) when the discord_id fallback chain returns NULL, before falling back to `NEW.id::TEXT`. Migration 14 silently removes that `RAISE WARNING`, citing "Body matches production verbatim (no RAISE WARNING on discord_id fallback)" at line 21. The plan documents that production has already drifted from migration 2 source — but this re-emit makes the drift normative across all environments (local, staging, prod) on the next `supabase db reset --local`.

This is a real observability loss: if a future Supabase Auth SDK upgrade changes the OAuth claim shape (e.g., `provider_id` is renamed), every new signup will silently fall through to `NEW.id::TEXT` and get a UUID-string in `profiles.discord_id`. That row would then never match `admin_discord_ids` lookups (admins lose admin status on re-auth), and there would be NO warning, NO Sentry breadcrumb, NO audit row to alert operators. The only signal would be downstream: "Why isn't this admin's `is_admin` flag being derived?"

The migration neither documents WHY production dropped the warning nor proposes an alternative observability hook (e.g., `INSERT INTO public.audit_log (...)` with `action = 'discord_id_fallback'`).
**Fix:** Either (a) restore the `RAISE WARNING` and update the production function to match (the migration becomes a true "harden-only" pass), or (b) add an `INSERT INTO public.audit_log (...)` write inside the IF-NULL branch so the fallback is observable post-hoc, or (c) at minimum, add a WHY comment in migration 14 explaining what observability replaces the dropped warning (Sentry? PostHog? cron audit job?) so the next reader knows the gap is intentional and where to look.

### WR-02: Fixture `profiles` ON CONFLICT silently discards explicit `discord_id` values

**File:** `tests/sql/is_current_user_admin_regression.sql:56-67`
**Issue:** The fixture `INSERT INTO public.profiles (..., discord_id, ...) VALUES (..., '900000000000000001', ...) ON CONFLICT (id) DO UPDATE SET is_admin = EXCLUDED.is_admin, mfa_verified = EXCLUDED.mfa_verified, guild_member = EXCLUDED.guild_member, discord_username = EXCLUDED.discord_username, avatar_url = EXCLUDED.avatar_url;` does NOT include `discord_id` in the `DO UPDATE SET` clause.

Because the fixture's `INSERT INTO auth.users` does not provide `raw_user_meta_data`, the `on_auth_user_created` trigger fires `handle_new_user()` which COALESCEs through three NULL-yielding `->>'…'` operators and falls back to `NEW.id::TEXT`. The trigger-inserted profile therefore has `discord_id = '00000000-0000-0000-0000-00000000a001'` (etc.). When the fixture's profiles INSERT then hits ON CONFLICT, `discord_id` is NOT updated — the snowflake values in the VALUES clause are silently discarded.

Today this is harmless because `is_current_user_admin()` reads only `is_admin AND mfa_verified AND guild_member`, never `discord_id`. But (a) the comment block at line 50-55 describes these as "4 identity branches" implying full-row correctness, and (b) any extension of this fixture to assert on `discord_id` (e.g., a follow-up test for `handle_new_user`'s discord_id derivation) will read a value the author did not intend.
**Fix:** Add `discord_id = EXCLUDED.discord_id` to the `DO UPDATE SET` clause:
```sql
ON CONFLICT (id) DO UPDATE SET
  discord_id       = EXCLUDED.discord_id,
  is_admin         = EXCLUDED.is_admin,
  mfa_verified     = EXCLUDED.mfa_verified,
  guild_member     = EXCLUDED.guild_member,
  discord_username = EXCLUDED.discord_username,
  avatar_url       = EXCLUDED.avatar_url;
```
Alternatively, seed `raw_user_meta_data` on the `INSERT INTO auth.users` so the trigger inserts the intended discord_id from the start, e.g.:
```sql
INSERT INTO auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
VALUES ('00000000-0000-0000-0000-00000000a001'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'fixture-admin@phase14.test', '{"provider_id":"900000000000000001"}'::jsonb, NOW(), NOW()), ...
```

## Info

### IN-01: Migration 14 silently overrides migration 2's `handle_new_user` source — no cross-reference comment in migration 2

**File:** `supabase/migrations/00000000000014_harden_security_definer_search_path.sql:20-68` and `supabase/migrations/00000000000002_triggers.sql:86-135`
**Issue:** A reader of migration 2 sees `handle_new_user` with the `RAISE WARNING ...` branch and reasonably believes that's the runtime behavior. After migration 14 runs, the function is silently replaced (CREATE OR REPLACE) and the warning branch is gone. Migration 2 is not updated to reference this supersession, and there's no `-- See migration 14 for production-verbatim rewrite` pointer.
**Fix:** Add a one-line WHY comment at the top of the migration 2 function definition (or as a `COMMENT ON FUNCTION` update in migration 14) noting that the function is re-emitted by migration 14 and the runtime body is the migration-14 form. Example for migration 14: append `COMMENT ON FUNCTION public.handle_new_user IS 'Re-emitted by migration 14 from production pg_get_functiondef snapshot. Diverges from migration 2 source by dropping the RAISE WARNING on discord_id fallback. See .planning/phases/14-… for rationale.';`. (Note: per CLAUDE.md, plan refs do not belong in src/ comments, so the comment can stop at "Re-emitted by migration 14" without naming the plan file.)

### IN-02: Fixture comment references migration file:line as cross-source archaeology

**File:** `tests/sql/is_current_user_admin_regression.sql:29-30` and `51-52`
**Issue:** The fixture comments cite `supabase/migrations/00000000000002_triggers.sql:137` to point at the trigger source. CLAUDE.md project convention states: "No review-round / phase-ID archaeology in source comments — source comments WHY-only". A file:line reference is not a phase ID, and it is genuinely WHY-explanatory (it tells the reader why ON CONFLICT is mandatory), so this is borderline rather than a violation. The risk: line numbers go stale on the next migration-2 edit and become subtly wrong.
**Fix:** Drop the `:137` line number and keep the file path, or drop the file reference entirely and rephrase as: "Trigger `on_auth_user_created` (defined in `supabase/migrations/00000000000002_triggers.sql`) fires on every INSERT INTO auth.users …". This preserves WHY without pinning to a churn-prone line number.

### IN-03: `phase-14` literal in fixture's audit_log canary row will become misleading after Phase 14 ships

**File:** `tests/sql/is_current_user_admin_regression.sql:77`
**Issue:** `target_type = 'phase-14'` is a hardcoded literal. After this phase ships, the string becomes a permanent test-fixture-only sentinel that conveys nothing meaningful about what the canary tests. Any subsequent phase 15+ regression that re-uses this fixture (or copies it) carries the `phase-14` artifact forward.
**Fix:** Replace with a stable, phase-agnostic literal such as `'is_current_user_admin_regression'` or `'rls-regression-canary'`. The fixture WHERE clause at lines 141 and 157 already filters on `action = 'fixture-canary'` (also a literal but at least phase-agnostic), so `target_type` can be similarly phase-agnostic.

### IN-04: Plan/phase-ID rot inside migration 14 docstring header

**File:** `supabase/migrations/00000000000014_harden_security_definer_search_path.sql:3-4`
**Issue:** The header references `0011_function_search_path_mutable` (Supabase advisor code, not a phase ID — this is fine) and "the 6 user-owned functions targeted here" (descriptive, fine). It does NOT contain phase/review-round archaeology — so this is a positive observation: the migration header follows CLAUDE.md convention. Flagging here only to acknowledge it was checked and is clean.
**Fix:** No action required.

### IN-05: `auth.users` fixture INSERT omits NOT NULL safety margin for forward-compat

**File:** `tests/sql/is_current_user_admin_regression.sql:43-48`
**Issue:** The fixture inserts only `(id, instance_id, aud, role, email, created_at, updated_at)` into `auth.users`, relying on Supabase's current schema where the other columns are nullable / have defaults. Supabase has periodically tightened `auth.users` NOT NULL constraints across minor versions (e.g., `email_change_token_new`, `confirmation_token`). On a fresh Supabase upgrade, this fixture could break with `null value in column "<x>" violates not-null constraint` — a confusing failure mode for the next debugger.
**Fix:** Either (a) defensively populate the known-volatile `auth.users` columns with empty strings (`confirmation_token = ''`, `email_change_token_new = ''`, etc.), or (b) add a short comment at line 39-42 noting the brittle dependency: `-- NOTE: brittle to Supabase auth-schema upgrades; if this INSERT starts failing with new NOT NULL columns, add the new column with an empty-string default here.`. Option (b) is lower-effort and arguably better for free-tier-on-managed-Supabase.

---

## Cross-File Analysis Notes

Deep-depth concerns from the review prompt — explicitly verified, all CLEAN:

1. **Unqualified references under `search_path = ''`:** All 6 function bodies use `public.profiles`, `public.admin_discord_ids`, `public.vote_counts`, `public.choices`, `auth.uid()`. Built-ins (`COALESCE`, `EXISTS`, `GREATEST`, `NOW()`, `RAISE EXCEPTION`, trigger record fields `NEW`/`OLD`, `EXCLUDED` in ON CONFLICT) live in `pg_catalog` (always implicitly searched) or are language constructs. No 42P01 risk. ✅

2. **Drop-then-recreate ACL stripping:** `DROP FUNCTION IF EXISTS public.update_profile_after_auth(BOOLEAN, TEXT, TEXT)` targets ONLY the 3-param overload. The 4-param signature `(BOOLEAN, TEXT, TEXT, BOOLEAN)` is a distinct function in pg_proc (different `proargtypes`), unaffected by this DROP. `CREATE OR REPLACE FUNCTION` for the 4-param then preserves any existing grants on that signature. No app caller invokes the 3-param signature (verified: `src/lib/auth-helpers.ts:209` passes 4 args; `src/lib/types/database.types.ts:377` types only the 4-arg form). ✅

3. **`is_current_user_admin` body-identicality claim:** Migration 9's body normalized = `SELECT COALESCE((SELECT is_admin AND mfa_verified AND guild_member FROM public.profiles WHERE id = auth.uid()), false);`. Migration 14's body normalized = identical. Only the `SET search_path` value differs (`public` → `''`). Volatility (`STABLE`) and `SECURITY DEFINER` flag preserved. OID preserved by CREATE OR REPLACE — RLS policies that reference this function via OID continue to work without re-creating policies. ✅

4. **`handle_new_user` divergence from migration 2:** Migration 14 drops the `RAISE WARNING` branch present in migration 2 line 104. Documented intentional ("production-verbatim"). Flagged as WR-01 for observability loss + IN-01 for source-coherence.

5. **`profile_self_update_allowed` divergence from migration 2/3/4:** Migration 14 matches migration 4 (the last edit) — `current_user = session_user` gate around `is_admin`/`mfa_verified`/`guild_member` checks; immutable-column checks (id, discord_id, created_at) always enforced. Body byte-identical to migration 4 modulo the `SET search_path` clause. ✅

6. **`increment_vote_count` / `validate_vote_choice`:** Bodies byte-identical to migration 2 modulo `SET search_path = ''`. Tables already qualified. ✅

7. **Idempotency under repeated apply:** Every statement is `CREATE OR REPLACE` or `DROP … IF EXISTS`. Migration 14 can be re-applied N times without error. ✅

8. **Trigger graph preservation:** Trigger definitions (`on_auth_user_created`, `on_profile_self_update`, `on_vote_validate_choice`, `on_vote_inserted`) reference functions by name (resolved at execution time via pg_proc OID). `CREATE OR REPLACE` preserves OID, so triggers continue to bind correctly. ✅

9. **RLS policy binding preservation:** Policy `"Audit log visible to admins"` (migration 10) and policies in migration 5 reference `public.is_current_user_admin()` by signature. CREATE OR REPLACE preserves OID; policies bind correctly. ✅

10. **`SET LOCAL ROLE authenticated` correctness in fixture:** Helper `pg_temp.assert_admin` correctly sequences `set_config` → `SET LOCAL ROLE authenticated` → call → `RESET ROLE`. Exception path: `RESET ROLE` would not execute, but transaction-wide `ROLLBACK` ends the script under `ON_ERROR_STOP=1`, so role state cannot leak across scripts. ✅

11. **JWT claim wiring:** Fixture sets BOTH `request.jwt.claim.sub` AND `request.jwt.claims` (defensive — `auth.uid()` reads either). ✅

12. **PERFORM placement:** All `PERFORM` statements are inside DO blocks or function bodies (lines 98, 99, 138, 139, 154, 155); none at top level. ✅

13. **`SET LOCAL ROLE authenticated` wraps every RLS-asserting SELECT:** Lines 100, 140, 156. Both audit_log SELECTs covered. ✅

14. **`current_setting('role')` trigger guard:** Migration 2 line 44 `WHEN (current_setting('role') = 'authenticated')` does NOT fire during privileged fixture INSERT (role GUC defaults to `'default'`, never `'authenticated'` under a postgres/supabase_admin session). Fixture INSERT path is safe regardless of `profile_self_update_allowed` body. ✅

---

_Reviewed: 2026-05-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
