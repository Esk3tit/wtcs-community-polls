---
phase: 14-security-definer-search-path-migration
fixed_at: 2026-05-17T08:05:00Z
review_path: .planning/phases/14-security-definer-search-path-migration/14-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 6
skipped: 1
status: all_fixed
---

# Phase 14: Code Review Fix Report

**Fixed at:** 2026-05-17
**Source review:** `.planning/phases/14-security-definer-search-path-migration/14-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (0 critical, 2 warning, 5 info — `--all` flag)
- Fixed: 6 (plus 1 acknowledged no-op for IN-04 which the reviewer already flagged as clean)
- Skipped: 0
- Re-run of `tests/sql/is_current_user_admin_regression.sql` against the local Supabase stack: exit 0, 6 PASS notices, 0 FAIL exceptions, ROLLBACK at end.

## Fixed Issues

### WR-01: Silent loss of `RAISE WARNING` observability in `handle_new_user` discord_id fallback

**Files modified:** `supabase/migrations/00000000000014_harden_security_definer_search_path.sql`
**Commit:** `3db44a8`
**Applied fix:** Added a WHY comment above `handle_new_user` documenting that the production-verbatim body intentionally drops the `RAISE WARNING` from migration 2's discord_id fallback, and pointing future remediation toward an `audit_log` INSERT (or client-side Sentry breadcrumb). Per the user's CRITICAL CONTEXT directive, restoring the `RAISE WARNING` would require a new migration 15 and re-deploy; this finding is addressed by option (c) — the documentation-only fix.

### WR-02: Fixture `profiles` ON CONFLICT silently discards explicit `discord_id` values

**Files modified:** `tests/sql/is_current_user_admin_regression.sql`
**Commit:** `d5c2989`
**Applied fix:** Seeded `raw_user_meta_data` on each `INSERT INTO auth.users` row so the `on_auth_user_created` trigger's `handle_new_user()` COALESCE chain derives the intended snowflake `discord_id` from the trigger path rather than falling through to `NEW.id::TEXT`. This addresses the root cause (the fixture was simulating fake Discord signups without supplying OAuth metadata) instead of patching the symptom. Verified fixture still passes — all 6 PASS notices.

### IN-01: Migration 14 silently overrides migration 2's `handle_new_user` source

**Files modified:** `supabase/migrations/00000000000002_triggers.sql`
**Commit:** `bc2ddcd`
**Applied fix:** Added an inline source comment in migration 2 above `handle_new_user` noting that a later migration re-emits the runtime body with `SET search_path = ''` and without the `RAISE WARNING`. Source comments are runtime-neutral (no database state change), so this addresses the source-coherence gap without requiring a new migration. Per the user's CRITICAL CONTEXT directive, a `COMMENT ON FUNCTION` inside migration 14 was NOT used because it would alter pg_description metadata and require a re-push.

### IN-02: Fixture comments cite migration file:line as cross-source archaeology

**Files modified:** `tests/sql/is_current_user_admin_regression.sql`
**Commit:** `22ba0f8`
**Applied fix:** Dropped the `:137` line-number suffix from both fixture cross-reference comments. Kept the file path so the WHY remains discoverable. The comments are now resilient to future migration 2 edits.

### IN-03: `phase-14` literal in fixture's audit_log canary row

**Files modified:** `tests/sql/is_current_user_admin_regression.sql`
**Commit:** `bdcffd4`
**Applied fix:** Renamed `target_type = 'phase-14'` to `target_type = 'rls-regression-canary'` — a phase-agnostic literal that describes what the canary tests rather than when it was authored. The fixture's `WHERE action = 'fixture-canary'` clauses already filter on `action` not `target_type`, so no other change was needed.

### IN-04: Plan/phase-ID rot inside migration 14 docstring header

**Files modified:** (none — already clean)
**Commit:** (none)
**Applied fix:** No action required. Acknowledged as already clean by the reviewer; this is a positive observation that migration 14's header follows CLAUDE.md convention.

### IN-05: `auth.users` fixture INSERT omits NOT NULL safety margin for forward-compat

**Files modified:** `tests/sql/is_current_user_admin_regression.sql`
**Commit:** `4171bb1`
**Applied fix:** Added a brief WHY comment above the `INSERT INTO auth.users` block noting that the column list is brittle to Supabase auth-schema upgrades and instructing future debuggers to add the offending NOT NULL column with an empty-string default if the INSERT starts failing. Chose option (b) per user directive — comment-only is lower-risk than defensively populating volatile columns.

## Skipped Issues

None.

## Additional Commits

### Evidence refresh

**Files modified:** `.planning/phases/14-security-definer-search-path-migration/evidence/is_current_user_admin_regression.txt`
**Commit:** `004696d`
**Note:** Refreshed regression-fixture evidence to capture post-fix output. Still 6 PASS notices, 0 FAIL exceptions, ROLLBACK at end, exit 0.

## Verification

Re-ran the regression fixture against the local Supabase stack after all fixes were applied:

```
docker exec -i supabase_db_wtcs-community-polls psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -f - < tests/sql/is_current_user_admin_regression.sql
```

Result: exit 0, 6 PASS notices (admin, non_admin, mfa_false, guild_false, audit_log/admin, audit_log/non_admin), 0 FAIL exceptions, ROLLBACK at end.

## Production State Notes

Per the user's CRITICAL CONTEXT directive, NO changes in this fix iteration require re-pushing migration 14 to production:

- The WR-01 fix is a source-only comment in migration 14. Re-applying migration 14 (e.g., via `supabase db reset --local`) produces the same database state.
- The IN-01 fix is a source-only comment in migration 2. Source comments do not affect database state.
- All other fixes are in `tests/sql/is_current_user_admin_regression.sql`, which is never executed by `supabase db push`.
- Migration 14 was NOT modified in any way that alters database state (no `COMMENT ON FUNCTION`, no body changes, no signature changes).

---

_Fixed: 2026-05-17_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
