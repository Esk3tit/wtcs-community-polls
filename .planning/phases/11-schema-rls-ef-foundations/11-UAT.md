---
status: complete
phase: 11-schema-rls-ef-foundations
source: 11-00-SUMMARY.md, 11-01-SUMMARY.md, 11-02-SUMMARY.md, 11-03-SUMMARY.md, 11-03b-SUMMARY.md, 11-04-SUMMARY.md, 11-05-SUMMARY.md, 11-06-DEPLOY-FOLLOWUP.md
started: 2026-05-11T00:00:00Z
updated: 2026-05-11T00:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Migration 10 + 11 in prod schema_migrations (VIS-01, VIS-09)
expected: Both 'results_hidden_audit' and 'audit_log_fk_hardening' registered; total count = 12
result: pass
evidence: |
  `execute_sql` returned t1_phase_11_migration_count=2, t1_total_migrations=12.
  Migration 10 = results_hidden_audit (Plan 11-01), migration 11 = audit_log_fk_hardening (code-review-fix followup).

### 2. vote_counts RLS policy has NO admin-OR bypass (VIS-04 / REVIEW-FIX-H3)
expected: Single policy "Vote counts visible to voters when not hidden"; qual contains no is_current_user_admin()
result: pass
evidence: |
  t2_vote_counts_policy_count=1, name="Vote counts visible to voters when not hidden",
  t2_no_admin_or_bypass=true. Service-role bypass is the only admin-read path (intentional).

### 3. polls_effective re-projects new columns with security_invoker=on (VIS-09)
expected: View definition includes results_hidden + results_hidden_changed_at; reloptions = {security_invoker=on}
result: pass
evidence: |
  t3_new_cols_projected=2, t3_security_invoker_on=true. Pitfall 2 ("re-apply security_invoker after CREATE OR REPLACE")
  satisfied in migration 10.

### 4. audit_log RLS enforces admin-only SELECT
expected: Anon role returns 0 rows even when admin-owned rows exist
result: pass
evidence: |
  `SET LOCAL ROLE anon; SELECT count(*) FROM audit_log` returned 0 rows. RLS deny-by-default holds for anon.
  (Tested with rows present during the test-5 INSERT phase; anon was still 0.)

### 5. audit_log CHECK constraint shape — UUID case-insensitive + snowflake + NULL (W-05 fix)
expected: Uppercase UUID accepted; lowercase UUID accepted; snowflake accepted; NULL accepted; junk 'not-a-uuid' rejected with check_violation
result: pass
evidence: |
  4 valid shapes inserted successfully (uat_t5_uuid_upper, uat_t5_uuid_lower, uat_t5_snowflake, uat_t5_null);
  DO block confirmed junk 'not-a-uuid' raised check_violation as expected ("PASS: junk target_id correctly rejected by CHECK").
  All 4 valid smoke rows cleaned up. R-01 case-insensitivity (`~*`) fix proven on prod.

### 6. audit_log.actor_id FK ON DELETE SET NULL (W-01 fix)
expected: pg_constraint.confdeltype = 'n' on audit_log_actor_id_fkey
result: pass
evidence: |
  t6_actor_fk_on_delete_set_null=true. Admin profile deletion will no longer block on existing audit rows;
  rows survive with actor_id=NULL (matches cron-actor-null convention).

### 7. 14 Phase 11 EFs deployed ACTIVE with verify_jwt=false (VIS-02, VIS-03)
expected: list_edge_functions returns 14 Phase 11 EFs (toggle-results-visibility v2 + 13 with retrofits at v5/v6/v7), all ACTIVE, all verify_jwt=false
result: pass
evidence: |
  list_edge_functions returned 16 total EFs in prod project; 14 are Phase 11 scope:
    - toggle-results-visibility v2 ACTIVE (new in Plan 11-02; v2 after iter-1 fix redeploy)
    - close-expired-polls v7 ACTIVE
    - close-poll v6, create-category v5, create-poll v6, delete-category v6, delete-poll v6,
      demote-admin v5, pin-poll v5, promote-admin v5, rename-category v6, set-resolution v5, update-poll v6
  All 14 have verify_jwt=false (REVIEW-FIX-H8 satisfied).

### 8. toggle-results-visibility unauthenticated POST returns 401 from EF auth check
expected: curl POST returns HTTP 401 with EF's own {"error":"Unauthorized"} body
result: pass
evidence: |
  POST without Authorization header returned HTTP 401 with body `{"error":"Unauthorized"}` —
  proves EF imports resolved (no 500 from import error), edge-runtime ROUTING reached the function,
  and the EF's own `auth.getUser()` rejection path fires correctly.

### 9. Plan 04 integration test suite enumerates 24 cases (VIS-05, TEST-11, TEST-12)
expected: vitest list lists 24 cases across 3 files (13 RLS matrix + 7 toggle EF + 4 create-poll-hidden)
result: pass
evidence: |
  npx vitest list output broken down by file:
    - vote-counts-rls.test.ts: 13 cases (12-cell RLS matrix + 1 admin-JWT regression sentinel)
    - toggle-results-visibility.test.ts: 7 cases (4 happy + 3 negative per REVIEW-FIX-L3)
    - create-poll-results-hidden.test.ts: 4 cases (REVIEW-FIX-M5 — results_hidden true/false/omitted/string-coerced)
  Total: 24 cases. Zero it.todo, zero it.skip, zero it.only across the suite.

### 10. End-to-end admin UI flow — admin toggles a poll, voter sees hidden state
expected: Admin uses the prod UI to flip results_hidden on a real poll; voter UI reflects the hidden state
result: blocked
blocked_by: prior-phase
reason: |
  Admin UI + voter UI surface for this flow ships in Phase 12 (Admin UI + User UI + UIDN-03 Sweep).
  Phase 11 is the database/EF foundation; end-to-end UI flow is a Phase 12 deliverable.
  The underlying paths (toggle EF authz + audit row + RLS gating) are independently verified by
  tests 2, 4, 5, 7, 8 above + Plan 04 integration suite (24 cases) + Plan 05/06 deploy smokes.

## Summary

total: 10
passed: 9
issues: 0
pending: 0
skipped: 0
blocked: 1

## Gaps

<!-- No gaps. All 9 in-scope tests PASS. Test 10 is properly blocked on a future-phase deliverable. -->
