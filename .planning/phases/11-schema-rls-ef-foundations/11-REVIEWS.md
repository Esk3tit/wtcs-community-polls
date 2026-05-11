---
phase: 11
reviewers: [gemini, codex]
reviewed_at: 2026-05-11T20:58:32Z
plans_reviewed:
  - 11-00-PLAN.md
  - 11-01-PLAN.md
  - 11-02-PLAN.md
  - 11-03-PLAN.md
  - 11-03b-PLAN.md
  - 11-04-PLAN.md
  - 11-05-PLAN.md
attempted_but_skipped:
  - claude (self — running inside Claude Code CLI; skipped for independence)
  - coderabbit (no working-tree diff available; reviews git diff, not plan markdown)
  - cursor (account hit usage limit during invocation)
  - opencode (not installed)
  - qwen (not installed)
---

# Cross-AI Plan Review — Phase 11

## Gemini Review

**Review of Phase 11: Schema + RLS + EF Foundations Plans**

**Overall Summary:** Phase 11 is exceptionally well-planned and meticulously detailed, laying a robust database and server-side foundation for the "Admin Visibility Controls" feature. The plans demonstrate a deep understanding of Supabase's ecosystem, PostgreSQL's Row Level Security (RLS), Edge Function architecture, and robust testing practices. The emphasis on atomicity, security (especially RLS and admin authorization), auditability, and comprehensive integration testing is highly commendable. All plans adhere to project conventions and proactively address potential pitfalls.

---

### Plan 11-00: Wave 0 integration test fixtures

1.  **Summary:** This plan effectively sets up the foundational infrastructure for integration testing in Phase 11. It covers the Vitest configuration, shared test helpers, test scaffolds, and integration into the `package.json` scripts and GitHub Actions CI workflow, ensuring that subsequent test implementation can proceed against a robust and isolated environment.
2.  **Strengths:**
    *   **Clear Separation:** Properly separates unit and integration test configurations and execution, preventing environmental leaks and ensuring faster feedback for unit tests.
    *   **Helper Centralization:** Consolidates common test utilities (client minting, poll management, EF invocation, audit reading) into a single `helpers.ts` file, promoting reusability and maintainability.
    *   **CI Integration:** Thoughtfully integrates the new integration test suite into CI, running it parallel to E2E tests, which optimizes overall CI duration.
    *   **Robustness:** Explicitly avoids injecting placeholder Supabase environment variables into `vitest.config.integration.ts`, forcing the use of real credentials for integration tests, which is crucial for accurate RLS validation.
    *   **Early Scaffolding:** Provides `it.todo()` scaffolds for the actual tests, enabling early setup verification without requiring full test implementation.
3.  **Concerns:**
    *   **Test Isolation for `createFreshPoll` (LOW):** The `createFreshPoll` helper uses `Date.now()` and `testInfo.workerIndex` for title uniqueness. While effective, if multiple parallel tests in the *same worker* call this simultaneously within the same millisecond, there's a theoretical, albeit low, chance of title collision if they don't explicitly pass a unique `suiteSlug`.
4.  **Suggestions:**
    *   Clarify in `createFreshPoll`'s JSDoc that `suiteSlug` is intended to provide further uniqueness *within* a test or `describe` block if multiple polls are created rapidly.
5.  **Risk Assessment:** **LOW.**

---

### Plan 11-01: Migration 10 (polls columns + audit_log + view rewrite + vote_counts policy)

1.  **Summary:** This plan details the critical atomic database migration for Phase 11, introducing new columns for results visibility, establishing a comprehensive `audit_log` table with its RLS, updating the `polls_effective` view, and rewriting the `vote_counts` RLS policy.
2.  **Strengths:**
    *   **Atomicity:** Commitment to a single, atomic migration file with carefully ordered sections.
    *   **RLS Security:** Rigorously defines the `vote_counts` RLS policy covering all edge cases.
    *   **Audit Log Design:** Schema, RLS, and indexing strategy are well-defined, balancing audit integrity with performance.
    *   **Backward Compatibility:** `results_hidden` defaults to `false` for existing polls.
    *   **View Integrity:** Correctly re-applies `security_invoker = on` after view replacement.
3.  **Concerns:**
    *   **Index Over-specification (LOW):** Defining `audit_log` indexes now might be slightly premature without a concrete `audit_log` UI plan.
4.  **Suggestions:** No significant suggestions; the plan is exceptionally thorough.
5.  **Risk Assessment:** **LOW.**

---

### Plan 11-02: Shared audit helper + toggle-results-visibility EF

1.  **Summary:** Introduces the shared `writeAudit` helper and the new `toggle-results-visibility` Edge Function.
2.  **Strengths:**
    *   **Shared Audit Helper:** Centralizes `writeAudit` enforcing a consistent fail-open policy.
    *   **Idempotency:** EF reads current state and only writes an audit log when state actually changes.
    *   **Security:** Reuses `requireAdmin` helper.
    *   **Clarity in Response:** Returns the full updated poll row.
    *   **Error Handling:** Consistent error handling.
3.  **Concerns:**
    *   **`results_hidden_changed_at` on no-op (LOW):** Updated on every call (even no-ops), which could slightly obscure the actual last change time. The audit log itself records the actual state changes.
4.  **Suggestions:** No significant suggestions.
5.  **Risk Assessment:** **LOW.**

---

### Plan 11-03: Audit retrofit batch A (5 EFs) & B (6 EFs)

1.  **Summary:** Systematically retrofits 11 existing mutation-based admin Edge Functions to integrate `writeAudit`.
2.  **Strengths:**
    *   **Systematic Retrofit:** Clear, consistent approach.
    *   **Adherence to `writeAudit` Contract:** Calls placed after mutation success, not wrapped in `try/catch`.
    *   **Detailed Audit Semantics:** Precise `action` strings and `before`/`after` JSONB shapes.
    *   **Special Case Handling:** `close-expired-polls` per-poll auditing with `actor_id: null`.
    *   **No Response Shape Drift.**
3.  **Concerns:**
    *   **`delete-category` `before` state (LOW):** May need a new SELECT to capture name.
    *   **`update-poll` `before` state (LOW):** May be `null` if RPC doesn't return prior values.
4.  **Suggestions:** If trivial, add pre-mutation SELECT for `delete-category` and `update-poll`.
5.  **Risk Assessment:** **LOW.**

---

### Plan 11-03b: create-poll results_hidden extension + audit retrofit (Option A — post-RPC conditional UPDATE)

1.  **Summary:** Extends `create-poll` EF to support `results_hidden`, using post-RPC UPDATE to avoid modifying the RPC.
2.  **Strengths:**
    *   **Robust Input Validation:** Strict boolean type checking.
    *   **RPC Integrity Preservation:** Avoids modifying the `create_poll_with_choices` RPC.
    *   **Comprehensive Auditing:** Emits both `poll_created` and `results_hidden_set_at_creation` audit rows when applicable.
    *   **Idempotency and Timestamps:** Post-RPC UPDATE stamps `results_hidden_changed_at` when set to `true`.
    *   **Isolation:** Modifies only `create-poll/index.ts`.
3.  **Concerns:**
    *   **Two `writeAudit` Calls on True Path (LOW):** Emitting two audit rows for one logical action might be slightly verbose.
4.  **Suggestions:** Consider consolidating to a single `poll_created` entry with `after: {..., results_hidden: true}`.
5.  **Risk Assessment:** **LOW.**

---

### Plan 11-04: TEST-11 12-cell RLS invariant matrix body & TEST-12 admin EF authz + audit row body

1.  **Summary:** Fills out scaffolds for the merge-blocking integration tests for the 12-cell RLS invariant matrix and the `toggle-results-visibility` EF authorization/audit behavior.
2.  **Strengths:**
    *   **P0 Merge Blocker Enforcement.**
    *   **Comprehensive EF Validation:** Security, functionality, audit behavior.
    *   **Proper Test Isolation and Cleanup.**
    *   **Determinism:** Eliminates `it.todo` and `it.skip`.
3.  **Concerns:**
    *   **Timestamp Assertion Strictness (LOW):** Only asserts non-null/ISO-parseable.
    *   **`create-poll` Integration Case (LOW):** Not explicitly covered by a dedicated test case.
4.  **Suggestions:** Consider adding a dedicated `create-poll.test.ts` for `results_hidden=true` audit verification.
5.  **Risk Assessment:** **LOW.**

---

### Plan 11-05: [BLOCKING] supabase db push + functions deploy + ship

1.  **Summary:** Critical final blocking plan for production deployment of Migration 10 and all EFs.
2.  **Strengths:**
    *   **Blocking Nature** — `autonomous: false`.
    *   **Pre-Merge Sanity:** `supabase db reset`, `db push`, `npm run test`, `npm run test:integration`.
    *   **Comprehensive Deployment:** Lists all 13 EFs.
    *   **Robust Post-Deploy Verification:** psql queries + curl smoke tests.
    *   **Threat Mitigation:** Addresses `T-DEPLOY-WRONG-PROJECT` and `T-MIGRATION-PARTIAL-APPLY`.
    *   **Documentation:** SUMMARY + ROADMAP + STATE.md.
3.  **Concerns:**
    *   **Rollback Strategy (LOW):** Defers rollback migration to a hotfix plan.
    *   **`create-poll` Smoke Test (LOW):** Production smoke focuses only on toggle EF.
4.  **Suggestions:** Add a smoke `curl` test for `create-poll` with `results_hidden: true`; emphasize `supabase link` to the correct production project.
5.  **Risk Assessment:** **MEDIUM.**

---

### Overall Risk Assessment for Phase 11: LOW-MEDIUM

The planning for Phase 11 is of very high quality. The detailed research, clear decision-making, and proactive mitigation of security and integrity threats are exemplary. The `LOW-MEDIUM` assessment reflects the inherent risks associated with production deployments involving schema modifications and multiple function updates, even when meticulously planned.

---

## Codex Review

### Summary

The phase is well decomposed and mostly goal-directed: schema/RLS first, EF/audit next, retrofit surface after, invariant tests before deploy. The main problem is not scope, but correctness gaps in the test and deploy plans. As written, the RLS matrix can fail for the wrong reason because `vote_counts` rows may not exist, `castVote` does not clearly create a vote for `memberUser`, the toggle EF idempotency is race-prone, and the deploy plan contains dangerous Supabase command assumptions. I would not execute these plans unchanged.

### Highest-Priority Fixes

- **HIGH:** Fix TEST-11 setup. Always create baseline count data, then vary whether `memberUser` has voted.
- **HIGH:** Fix `castVote` helper to accept `userId`, defaulting to `fixtureUsers.memberUser.id`, and insert via service role.
- **HIGH:** Remove `supabase db push` from the "local pre-merge" gate. It targets the linked remote DB, not local.
- **HIGH:** Align EF deploy commands with the existing deploy workflow flags: `--project-ref`, `--use-api`, and `--no-verify-jwt`.
- **HIGH:** Resolve the policy/spec ambiguity around authenticated admin reads of `vote_counts`.
- **HIGH:** Reconsider `create-poll` post-RPC update, or add compensation. It is not atomic if the update fails after poll creation.
- **MEDIUM:** Make TEST-12 cases independent or explicitly sequential.

### 11-00 Plan Review

**Summary:** Good scaffolding plan, but helper contracts are under-specified in ways that will break TEST-11 later.

**Strengths**
- Separates integration Vitest config from unit Vitest config.
- Keeps real Supabase env required, avoiding false-green RLS tests.
- Adds CI coverage in the right place, parallel to E2E.
- Establishes helper names early for downstream plans.

**Concerns**
- **HIGH:** `castVote()` does not specify `user_id`. The later RLS test requires a vote row for `memberUser`; authenticated clients cannot insert votes because there is no INSERT RLS policy.
- **HIGH:** `createFreshPoll()` creates only one choice and no vote count data. Service-role "bypass" cells expecting `>0` rows will still return 0 if no `vote_counts` rows exist.
- **MEDIUM:** Claiming `results_hidden` is "ignored" pre-migration is inaccurate; PostgREST generally errors on unknown columns.
- **LOW:** `tsconfig.app.json` only includes `src`, so it will not type-check `e2e/integration/helpers.ts`.

**Suggestions**
- Change `castVote(opts)` to include `userId?: string`, use service-role for setup inserts, and default `userId` to `fixtureUsers.memberUser.id`.
- Have `createFreshPoll()` insert two choices and optionally create a baseline vote by another fixture user.
- Add a dedicated TypeScript check path for integration helpers or rely on `vitest run` as the parsing/type sanity gate.

**Risk Assessment:** **MEDIUM.** Infrastructure is sound, but the helper API will cause downstream test failures unless fixed now.

### 11-01 Plan Review

**Summary:** The migration plan is strong and correctly centers the DB as the security boundary, but it has one important requirements ambiguity.

**Strengths**
- Single atomic migration is the right approach.
- Drops old `vote_counts` policy names before creating the new one.
- Re-applies `security_invoker = on` immediately after view replacement.
- Avoids JSONB indexes on `audit_log`, which is appropriate for current scale.
- Creates `audit_log` with nullable `actor_id`, matching cron/system writes.

**Concerns**
- **HIGH:** Policy includes `public.is_current_user_admin() OR (...)`, but VIS-04 says visibility is granted iff caller voted and results are not hidden, with service-role bypass remaining. Authenticated admin bypass needs explicit product approval and test coverage.
- **MEDIUM:** No explicit admin-authenticated RLS test cell exists, despite the policy granting admins broad access.
- **MEDIUM:** Generated Supabase DB types are not updated, which may block Phase 12 when React reads `results_hidden`.

**Suggestions**
- Either remove the admin OR branch, or update VIS-04/TEST-11 to explicitly include authenticated-admin expected behavior.
- Add admin-authenticated matrix cells if the OR branch stays.
- Decide whether DB types are updated in Phase 11 or explicitly deferred to Phase 12.

**Risk Assessment:** **MEDIUM.** Migration shape is good, but the RLS semantics need clarification before merge.

### 11-02 Plan Review

**Summary:** The new EF plan follows existing patterns well, but its idempotency guarantee is not race-safe.

**Strengths**
- Reuses existing auth, CORS, and Supabase client patterns.
- Validates `poll_id` and `hidden` strictly.
- Returns the updated poll row, which supports Phase 12 UI updates.
- Keeps audit helper centralized for retrofit reuse.

**Concerns**
- **HIGH:** Pre-read then update can double-write audit rows under concurrent same-direction toggles. Two callers can both read `false`, both set `true`, and both audit `false → true`.
- **MEDIUM:** `writeAudit()` never throwing conflicts with the plain-language requirement that every change is audited. This is an accepted tradeoff only if documented as "best-effort audit with error logging."
- **LOW:** Source comments reference decision IDs like `D-11`; that conflicts with the project's "WHY-only, no phase archaeology" source-comment rule.

**Suggestions**
- Use a conditional state-change update first, for example update only when `results_hidden` differs, then perform a no-op timestamp touch separately if needed.
- Document audit as fail-open explicitly in planning docs, not source comments.
- Remove `D-*` and phase references from comments in `supabase/functions`.

**Risk Assessment:** **MEDIUM-HIGH.** Function flow is good, but idempotency is not as strong as claimed.

### 11-03 Plan Review

**Summary:** The retrofit is directionally correct but high-touch across many EFs, so the main risk is subtle behavior drift.

**Strengths**
- Clear per-EF action strings and compact JSONB shapes.
- Preserves existing response shapes.
- Correctly excludes read-only EFs.
- Handles cron actor as `actor_id: null`.

**Concerns**
- **MEDIUM:** Adding pre-DELETE/pre-UPDATE reads can change 404/error behavior if not carefully matched to existing patterns.
- **MEDIUM:** The plan does not add runtime tests for the 11 retrofitted EFs, so correctness relies mostly on review and smoke testing.
- **LOW:** Sequential audit writes in `close-expired-polls` are fine at current scale, but could become slow if many expired polls accumulate.

**Suggestions**
- For each EF, record before/after behavior in the summary: response shape unchanged, new DB read added or not, 404 semantics unchanged.
- Add a deploy-time smoke checklist that invokes at least one representative EF from each mutation class.
- Keep any new comments focused on why the audit payload has that shape.

**Risk Assessment:** **MEDIUM.** Scope is broad but manageable if diffs stay small.

### 11-03b Plan Review

**Summary:** Splitting `create-poll` was the right call, but the chosen post-RPC update path weakens atomicity and has an action-string inconsistency.

**Strengths**
- Keeps the existing RPC signature stable.
- Strictly validates `results_hidden`.
- Preserves the current `create-poll` response shape.
- Separates normal creation audit from hidden-at-create audit.

**Concerns**
- **HIGH:** Post-RPC update is not atomic. If poll creation succeeds and the hidden update fails, the EF returns 500 after creating a visible poll.
- **HIGH:** Action string conflicts with earlier D-09: `results_hidden_set_at_creation` vs `results_hidden_set_at_create`.
- **MEDIUM:** This path is not clearly covered by Plan 04 tests, despite being required for Phase 12 creation UI.
- **LOW:** `requirements: TEST-12` is misleading because this plan does not implement TEST-12.

**Suggestions**
- Prefer extending the RPC to accept `results_hidden`, or create a new transactional RPC wrapper.
- If Option A stays, add compensation on update failure, such as deleting the newly created poll or returning a clear partial-success error with cleanup instructions.
- Standardize the action string before implementation.
- Add an integration test for `create-poll` with `results_hidden: true`.

**Risk Assessment:** **HIGH.** The non-atomic write path can create production-visible inconsistency.

### 11-04 Plan Review

**Summary:** This is the most important test plan, but TEST-11's setup is currently flawed and TEST-12 is too order-dependent.

**Strengths**
- Correctly treats the 12-cell matrix as a merge blocker.
- Tests 403, 200, audit row shape, and no-op idempotency.
- Explicitly cleans `audit_log` because `target_id` has no FK.
- Uses real Supabase and Edge Function paths instead of mocks.

**Concerns**
- **HIGH:** Service-role cells expecting `>0` rows will fail unless baseline `vote_counts` rows exist.
- **HIGH:** `voted=true` must mean `memberUser` has a vote. The proposed helper does not guarantee that.
- **MEDIUM:** TEST-12 cases depend on execution order. Case 3 assumes Case 2 already toggled the poll.
- **MEDIUM:** No test covers the `create-poll results_hidden=true` path from 11-03b.
- **LOW:** No negative tests for invalid body, invalid UUID, or 404 poll.

**Suggestions**
- For every TEST-11 poll, create a baseline vote by `adminUser` to produce `vote_counts`; add a `memberUser` vote only when `voted=true`.
- Make TEST-12 tests independent, or wrap them in an explicitly sequential describe block.
- Add a fifth integration case for `create-poll` hidden-at-create, or a separate `create-poll-results-hidden.test.ts`.

**Risk Assessment:** **HIGH.** These tests are supposed to prove the security boundary, but the current setup can produce misleading failures.

### 11-05 Plan Review

**Summary:** The deploy gate is necessary, but the command plan needs correction before use.

**Strengths**
- Correctly separates local validation from production deployment intent.
- Requires post-deploy DB verification of columns, policy, view, and RLS.
- Requires smoke testing the new EF.
- Captures planning-state updates after deployment.

**Concerns**
- **HIGH:** `supabase db push` in Task 05-01 is dangerous. It does not verify a "linked local project"; it pushes to the linked remote database.
- **HIGH:** Deploy commands omit existing production-critical flags: `--project-ref`, `--use-api`, and `--no-verify-jwt`.
- **MEDIUM:** Smoke test says non-admin 403 in must-haves, but the action steps only detail admin curl.
- **MEDIUM:** Production smoke toggling an existing poll can briefly affect real user-visible state.
- **LOW:** DB verification query for `polls` should include `column_default`, not only type/nullability.

**Suggestions**
- Remove local `supabase db push`; use `supabase db reset`, unit tests, integration tests, and link verification only.
- Reuse the existing deploy-all workflow command or mirror it exactly.
- Use a dedicated smoke/test poll, preferably archived or otherwise not community-facing.
- Add explicit non-admin smoke curl.
- Verify `results_hidden` default with `column_default`.

**Risk Assessment:** **HIGH.** The deployment plan has enough command-level risk that it should be revised before execution.

### Overall Risk Assessment

**Overall risk: HIGH until revised, MEDIUM after the listed fixes.**

The architecture and sequencing are solid, and the phase goals are achievable. The risky parts are concentrated in the RLS test setup, authenticated-admin policy ambiguity, non-atomic create path, and production deploy commands. Fixing those would make this a strong Phase 11 plan.

---

## Consensus Summary

Gemini scored Phase 11 LOW-MEDIUM risk and found the plans exceptionally thorough. Codex scored it HIGH until specific revisions are made, identifying 6 HIGH-severity correctness gaps clustered in the test setup, EF idempotency, non-atomic create path, RLS policy/spec ambiguity, and production deploy commands. The two reviewers agreed on the architectural shape and sequencing but diverged sharply on the readiness of several concrete implementation details. Gemini did not surface any HIGH-severity concerns; every HIGH listed below comes from the Codex review and is currently unresolved.

### Agreed Strengths

- Single-file atomic Migration 10 with DROP+CREATE on `vote_counts` policy and `security_invoker = on` re-applied after `polls_effective` rewrite (both reviewers).
- Centralized `writeAudit` shared helper enforcing a consistent fail-open policy across the 13 emitter EFs (both reviewers).
- 12-cell merge-blocking RLS invariant test treated as a P0 gate (both reviewers).
- Clean separation of `npm run test` (unit, `src/__tests__/`) from `npm run test:integration` (`e2e/integration/`) so service-role credentials do not leak into unit CI (both reviewers).
- Preserved EF response shapes during audit retrofit (no breaking changes for existing UI consumers) (both reviewers).
- Cron-source audit rows correctly use `actor_id: null` for `close-expired-polls` (both reviewers).

### Agreed Concerns

- **HIGH — TEST-11 setup is structurally broken (raised by Codex; not refuted by Gemini):**
  - `castVote()` does not specify `user_id`; authenticated clients cannot INSERT votes (no INSERT RLS policy on `votes`), so the "voted=true" cell can never be set up cleanly without service-role + explicit `userId`.
  - `createFreshPoll()` does not generate any baseline `vote_counts` rows, so the service-role "bypass returns >0 rows" cells will fail for the wrong reason (empty source data, not a policy failure).
- **HIGH — Plan 11-03b (`create-poll` post-RPC UPDATE) is not atomic (Codex):** poll creation can succeed while the hidden-flag UPDATE fails, returning 500 after creating a visible poll. No compensation logic specified. Action-string inconsistency (`results_hidden_set_at_creation` per D-09 vs `results_hidden_set_at_create` in the plan body) compounds the risk.
- **HIGH — Plan 11-02 idempotency is race-prone (Codex):** read-then-update sequence allows two concurrent same-direction toggles to both audit `false → true`. Needs a conditional state-change update (`UPDATE ... WHERE results_hidden IS DISTINCT FROM $hidden`) to be truly idempotent under concurrency.
- **HIGH — Plan 11-01 has a VIS-04 / `is_current_user_admin()` policy spec ambiguity (Codex):** the policy as drafted includes an admin OR branch that lets authenticated admins read `vote_counts` regardless of vote state, but VIS-04 says visibility is granted iff caller voted AND results not hidden (service-role bypass only). TEST-11 has no admin-authenticated matrix cell, so the divergence is silent.
- **HIGH — Plan 11-05 contains dangerous Supabase command assumptions (Codex):** `supabase db push` in the "local pre-merge" gate actually targets the linked remote DB (not local); EF deploy commands omit `--project-ref`, `--use-api`, and `--no-verify-jwt` which exist on the established deploy workflow.
- **MEDIUM — `polls_effective` view rewrite does not regenerate Supabase DB types (Codex):** Phase 12 React code reading `results_hidden` will be blocked until types are regenerated. Decide whether to land that in Phase 11 or explicitly defer.
- **MEDIUM — TEST-12 cases are order-dependent (Codex):** Case 3 assumes Case 2 already toggled the poll; needs `describe.serial` semantics or independent setup per case.
- **MEDIUM — No runtime test coverage for the 11 retrofitted EFs (Codex):** correctness relies on review + manual smoke; consider a representative-EF smoke list at deploy time.
- **MEDIUM — `create-poll` `results_hidden=true` path is not tested in Plan 11-04 (both reviewers):** Gemini suggests an optional `create-poll.test.ts`; Codex calls it a required addition.
- **LOW — Source comments in `supabase/functions/` reference decision IDs (e.g. `D-11`) (Codex):** violates the project's "WHY-only, no phase archaeology in source" rule (also flagged in user memory).

### Divergent Views

- **Overall phase risk:** Gemini scored LOW-MEDIUM and found "no significant suggestions" on 11-01, 11-02, 11-03, 11-03b, and 11-04. Codex scored HIGH-until-revised and surfaced 6 HIGH concerns clustered in the same five plans. The divergence is largely a depth-of-correctness-analysis gap — Codex caught implementation-level bugs that Gemini's structural review did not surface.
- **`results_hidden_changed_at` on no-op (Plan 11-02):** Gemini flagged it as LOW (obscures the actual last change time but the audit log compensates). Codex did not raise this point; instead it flagged the same EF for a different race issue.
- **`create-poll` two-audit-row design (Plan 11-03b):** Gemini suggested *consolidating* into a single `poll_created` audit row. Codex took the opposite tack — keep the two-row design but *standardize the action string* and *add compensation* on the non-atomic update path. Pick one direction before implementation.
- **`audit_log` indexes (Plan 11-01):** Gemini flagged as LOW "premature." Codex did not flag — treated the index choice as appropriate for current scale. Defer is fine either way.

### Recommended Next Step

Run `/gsd-plan-phase 11 --reviews` to feed this feedback back into the planner. At minimum, the 6 Codex HIGH concerns should be addressed (TEST-11 setup, `castVote` helper, atomicity of `create-poll`, idempotency of `toggle-results-visibility`, RLS policy admin-bypass spec ambiguity, and Plan 11-05 deploy commands) before any execution begins.
