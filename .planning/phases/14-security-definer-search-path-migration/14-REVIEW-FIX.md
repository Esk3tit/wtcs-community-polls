---
phase: 14-security-definer-search-path-migration
fixed_at: 2026-05-17T00:00:00Z
review_path: .planning/phases/14-security-definer-search-path-migration/14-REVIEW.md
iteration: 2
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 14: Code Review Fix Report (Iteration 2)

**Fixed at:** 2026-05-17
**Source review:** `.planning/phases/14-security-definer-search-path-migration/14-REVIEW.md`
**Iteration:** 2

**Summary:**
- Findings in scope: 3 (Info-only, `--all` flag passed)
- Fixed: 3
- Skipped: 0
- Final regression-fixture run: **6 PASS / 0 FAIL / psql exit 0** against `supabase_db_wtcs-community-polls`.

## Fixed Issues

### IN-01: Stale `COMMENT ON FUNCTION` text in catalog after migration 14 re-emit

**Files modified:** `supabase/migrations/00000000000002_triggers.sql`
**Commit:** `b2fb5bc`
**Applied fix:** Rewrote both `COMMENT ON FUNCTION` strings in migration 2 source so they accurately describe the post-migration-14 behavior:

- `profile_self_update_allowed`: now mentions the `current_user = session_user` gate and that SECURITY DEFINER callers bypass the protected-column checks (migration 4 + migration 14 behavior).
- `handle_new_user`: dropped the "WARNING on fallback" claim (migration 14 removed the `RAISE WARNING`) and renamed it to a silent fallback, pointing readers at the migration-14 header for the observability follow-up.

Added a `--` NOTE above each statement explaining the production-deploy invariant: the live `pg_description` rows in PROD will remain stale (because migration 14 was already applied and did not re-emit these COMMENTs), but the source is now coherent for fresh re-applies (local dev stacks). Intentionally did NOT add `COMMENT ON FUNCTION` statements to migration 14 itself — doing so would create a repo/prod divergence on the already-applied migration. Closing the PROD `pg_description` drift is deferred to a future migration.

### IN-02: Forward-reference NOTE missing on two other functions superseded by migration 14

**Files modified:** `supabase/migrations/00000000000003_guild_membership.sql`, `supabase/migrations/00000000000004_fix_trigger_rpc_context.sql`
**Commit:** `ac8e9ef`
**Applied fix:** Added inline `--` forward-reference NOTE comments mirroring the iteration-1 IN-01 pattern (which added the same near `handle_new_user` in migration 2):

- Migration 04 (`profile_self_update_allowed`): NOTE indicates the body is re-emitted by migration 14 with `SET search_path = ''`, otherwise byte-identical.
- Migration 03 (4-param `update_profile_after_auth`): NOTE indicates migration 14 drops the 3-param overload (defined in migration 2) and re-emits this 4-param signature with `SET search_path = ''`.

Targeted the source where each function was *last* defined before migration 14 (per user guidance), so a chronological reader sees the forward reference at the most-relevant edit point. Pure comment-only change; no behavioral diff.

### IN-03: Fixture comment retains a `:line-range` cross-reference to migration 10

**Files modified:** `tests/sql/is_current_user_admin_regression.sql`, `.planning/phases/14-security-definer-search-path-migration/evidence/is_current_user_admin_regression.txt`
**Commit:** `97f5351`
**Applied fix:** Dropped `lines 47-56` from the audit_log canary NOTE (fixture line 84). Rephrased to reference the migration filename pattern `00000000000010_*` instead — same approach as the iteration-1 IN-02 precedent. The phrase "two JSONB diff columns, NOT a single body column" was preserved as the semantic anchor.

Re-ran the regression fixture to confirm the fix did not break it: 6 PASS / 0 FAIL / psql exit 0. Refreshed `evidence/is_current_user_admin_regression.txt` to match the new NOTICE line offsets (+1 across the board, since adding one comment line earlier in the fixture shifted every subsequent statement by one line).

## Skipped Issues

None.

## Verification

Final regression-fixture run after all three fixes were committed:

```
docker exec -i supabase_db_wtcs-community-polls psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -f - < tests/sql/is_current_user_admin_regression.sql
```

Result: **6 PASS notices** (admin, non_admin, mfa_false, guild_false, audit_log/admin, audit_log/non_admin), **0 FAIL exceptions**, `ROLLBACK` at end, **psql exit 0**.

## Production State Notes

Per the user's production-deploy invariant directive, NO changes in this iteration require re-pushing migration 14 to production:

- The IN-01 fix updates `COMMENT ON FUNCTION` strings in **migration 2 source only**. Migration 2 was applied to production long ago; the source edit affects only future fresh re-applies (local dev stacks). Production's `pg_description` rows remain stale until a future migration explicitly issues new `COMMENT ON FUNCTION` statements — this is documented as a known small gap in the NOTE block.
- The IN-02 fix adds inline `--` SQL comments to migrations 3 and 4 source. SQL source comments do not affect database state.
- The IN-03 fix touches a test fixture and its evidence artifact; neither is executed by `supabase db push`.
- Migration 14 was NOT modified — production-deploy invariant respected.

---

_Fixed: 2026-05-17_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
