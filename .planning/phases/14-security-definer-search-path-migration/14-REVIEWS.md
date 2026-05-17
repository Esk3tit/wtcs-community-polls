---
phase: 14
reviewers: [gemini, codex]
reviewed_at: 2026-05-17T01:14:13Z
plans_reviewed: [14-01-PLAN.md]
skipped_reviewers:
  - reviewer: claude
    reason: "Running inside Claude Code CLI — skipped for independence (review.md self-skip rule)"
  - reviewer: cursor
    reason: "Cursor agent returned usage-limit error — empty output discarded"
  - reviewer: coderabbit
    reason: "coderabbit review --prompt-only requires a git diff / changed files; Phase 14 has no source diff yet (plan-only review)"
  - reviewer: opencode
    reason: "Not installed on system"
  - reviewer: qwen
    reason: "Not installed on system"
---

# Cross-AI Plan Review — Phase 14: Security-Definer Search-Path Migration

## Gemini Review

# Phase 14 Plan Review: Security-Definer Search-Path Migration

## 1. Summary
The implementation plan for Phase 14 is exceptionally well-structured, demonstrating a deep understanding of the security risks associated with `SECURITY DEFINER` functions in Supabase. It correctly prioritizes **OID stability** by choosing `CREATE OR REPLACE` over `ALTER`, and the use of the **TEST-11 12-cell RLS matrix** as a regression suite is a professional-grade safety measure. The plan proactively addresses discrepancies between previous requirements and actual research findings (e.g., the `increment_vote_count` body state and `update_profile_after_auth` signature), which significantly reduces the likelihood of "overload pollution" or migration failures.

## 2. Strengths
*   **OID Stability:** Using `CREATE OR REPLACE FUNCTION` ensures that triggers and other DB objects referencing these functions by OID do not break.
*   **Regression-Led Validation:** Leveraging the existing `e2e/integration/vote-counts-rls.test.ts` (TEST-11) provides empirical proof that the admin-gating logic remains intact.
*   **Pre-flight Checkpoints:** Wave 0's focus on `rls_auto_enable` ownership prevents "fighting the platform" if that function is indeed system-managed.
*   **Signature Accuracy:** Explicitly identifying the 4-parameter signature for `update_profile_after_auth` avoids the common pitfall of creating unintended function overloads.
*   **Body-Drift Prevention:** The use of `pg_get_functiondef` to compare the post-migration state with the authoritative migration source is a robust way to ensure no logic was lost during the search-path hardening.

## 3. Concerns
*   **Extension Function Qualification (Severity: MEDIUM):**
    When `search_path` is set to `''`, Postgres only searches `pg_catalog` (and `pg_temp`) by default. If any of the 7 functions utilize functions from extensions (e.g., `gen_random_uuid()` from `pgcrypto` or `uuid_generate_v4()` from `uuid-ossp`), those calls **must** be qualified as `extensions.gen_random_uuid()`. The plan mentions qualifying table names but does not explicitly mandate a check for extension-provided functions.
*   **Rollback Path Viability (Severity: MEDIUM):**
    The plan relies on "fix-forward via Studio." However, if `is_current_user_admin()` is accidentally broken in a way that returns `false` or throws an error for all users, the developer might lose the RLS permissions required to execute the fix via the SQL Editor if they are relying on admin-level access.
*   **`auth` Schema Qualification (Severity: LOW):**
    Functions like `auth.uid()` or `auth.jwt()` are technically in the `auth` schema. While most Supabase code already qualifies these, a "body-identical" copy-paste from a previous migration that relied on a `public, auth` search path might fail if `auth.uid()` was called simply as `uid()` (unlikely but possible).

## 4. Suggestions
*   **Audit for Extensions:** Before Wave 1, search the bodies of the 7 functions for `gen_random_uuid`, `uuid_generate_v4`, or any `citext` operations. Ensure these are qualified with `extensions.` in the new migration.
*   **"Break-Glass" Local Test:** In Wave 1, after the local `db reset`, manually verify that a local "admin" user can still perform a protected action (like pinning a poll) using a script, rather than just relying on the RLS matrix test. This confirms "real-world" admin identity propagation.
*   **Service Role Backup:** Note in the strategy that if the "fix-forward" via Studio fails due to RLS lockout, the `service_role` key (which bypasses RLS) should be used via a local script or the Supabase CLI to restore the functions.
*   **Strict `pg_get_functiondef` Comparison:** Ensure the comparison logic in Task 02 accounts for the fact that `pg_get_functiondef` output will now include the `SET search_path` line, whereas the source migration 9 code might not have had it.

## 5. Risk Assessment
**Overall Risk: MEDIUM**

The technical change is relatively straightforward (adding a configuration line and schema prefixes), but the **impact of failure is high**. Because `is_current_user_admin` is the backbone of the project's security model, even a minor syntax error could result in a total lockout of administrative functions or a silent failure of security policies. However, the plan's heavy emphasis on local replay, automated RLS testing, and linting makes this risk manageable and acceptable.

---

## Codex Review

## 1. **Summary**

The plan is generally strong: it correctly treats this as a high-risk DB hygiene migration, uses `CREATE OR REPLACE FUNCTION` for OID stability, calls out the known signature/body traps, and includes local replay, linting, production smoke, and evidence capture. The main weaknesses are verification depth: `TEST-11` does not appear to meaningfully prove `is_current_user_admin()` behavior if `vote_counts` no longer uses the admin OR-branch, `rls_auto_enable` handling may conflict with the “zero WARNs” requirement, and the rollback path is too manual for a migration touching admin-gating RLS.

## 2. **Strengths**

- Correctly locks on `CREATE OR REPLACE FUNCTION`, preserving trigger/function OIDs when signatures match.
- Correctly incorporates research corrections: `increment_vote_count` already uses `public.vote_counts`, and `update_profile_after_auth` must use the 4-param signature.
- Good focus on `is_current_user_admin()` preserving `STABLE` and body identity.
- Local `supabase db reset --local` before deploy is the right gate for migration replay safety.
- Dual linting, before and after production deploy, gives useful advisor evidence.
- Production `submit-vote` smoke directly exercises the most user-visible failure path: vote insert plus `increment_vote_count`.
- DBHY-04 doc scope is well contained and avoids touching the already-correct SQL block.

## 3. **Concerns**

- **HIGH:** `TEST-11` is not enough to prove `is_current_user_admin()` behavior. The current `vote_counts` policy intentionally has no admin OR-bypass, so the 12-cell matrix mostly proves the absence of that branch, not the correctness of the function that gates other admin RLS policies.

- **HIGH:** `rls_auto_enable` handling may violate DBHY-02. The plan allows “0 WARNs or 1 for system-owned `rls_auto_enable`,” but the stated requirement says zero `0011_function_search_path_mutable` WARNs. That exception needs to be formally resolved, not left as an acceptance ambiguity.

- **MEDIUM:** The W0 `rls_auto_enable` check is too narrow. Looking only in `public` does not fully establish whether the advisor warning is user-fixable. It should inspect schema, owner, identity args, extension dependency, ACL, and the exact advisor output.

- **MEDIUM:** `pg_get_functiondef` manual comparison is useful but brittle. It should be automated and repeated post-deploy. A local-only visual diff can miss production drift or a mistaken deploy artifact.

- **MEDIUM:** `supabase db reset` and lint do not prove PL/pgSQL bodies have all user objects qualified. PL/pgSQL can compile with unresolved object names until runtime. The plan has a targeted `INSERT INTO` grep, but not a comprehensive static/runtime check for all rewritten functions.

- **MEDIUM:** Rollback via Studio `CREATE OR REPLACE` is directionally acceptable, but too informal. For a function gating admin RLS across multiple tables, the restore SQL should be pre-staged and verified before deploy.

- **LOW:** Grep-based checks are fragile. `grep -n STABLE` can match comments, `grep -c` pipelines can have surprising exit codes, and PASS/FAIL text matching can be noisy.

- **LOW:** The `increment_vote_count_smoke.sql` fixture is not runnable by design, so it adds process weight without much assurance. A real targeted integration test would be better.

## 4. **Suggestions**

- Add a direct `is_current_user_admin()` regression test with admin, non-admin, MFA-false, and guild-false identities. Also test at least one actual admin-gated RLS table such as `audit_log`.

- Add a catalog assertion query for every target function:
  `pg_get_function_identity_arguments`, `prosecdef`, `provolatile`, `proconfig`, `proowner`, and `proacl`. This catches wrong volatility, missing `SECURITY DEFINER`, wrong owner, wrong defaults, and accidental overloads.

- Make the body-identical check machine-enforced: capture expected `pg_get_functiondef`, normalize only the `SET search_path` line, and run `diff -u`. Repeat this against production after `db push`.

- Strengthen W0 for `rls_auto_enable` with a query across all non-system schemas plus `pg_depend` extension ownership. If it is truly not user-fixable, amend DBHY-02/phase gate explicitly before implementation.

- Add runtime checks for the other affected functions: invalid vote choice rejection, profile RPC update, protected profile self-update rejection, and ideally a new-user/auth trigger path if practical.

- Pre-create an emergency restore SQL artifact containing the current production definitions for all touched functions. The rollback can still be fix-forward, but it should not depend on copying from old migrations during an incident.

- Prefer targeted test commands over full-suite text greps, for example a direct Vitest invocation for `e2e/integration/vote-counts-rls.test.ts` plus exit-code based validation.

## 5. **Risk Assessment**

**Overall risk: HIGH.** The migration itself is conceptually simple, but it touches `SECURITY DEFINER` functions, one of which gates admin RLS behavior across multiple tables. The current plan has good operational discipline, but the verification does not yet prove the highest-risk behavior strongly enough, and the `rls_auto_enable`/zero-WARN requirement is unresolved. With direct admin-function tests, catalog assertions, post-deploy functiondef diffs, and pre-staged restore SQL, the residual risk would drop to **MEDIUM**.

---

## Consensus Summary

Two independent reviewers (Gemini, Codex) reviewed `14-01-PLAN.md`. Cursor and CodeRabbit were unavailable (usage limit / no diff). Both reviewers agree the plan is well-structured and follows best practices for `SECURITY DEFINER` hardening, but raised actionable concerns about verification depth and rollback robustness.

### Agreed Strengths (raised by both reviewers)

- **`CREATE OR REPLACE FUNCTION` for OID stability** is the correct primitive (vs. `ALTER FUNCTION` or DROP+CREATE) — preserves trigger references, atomic body+attribute rewrite.
- **Wave 0 gate on `rls_auto_enable` ownership** prevents writing a migration block against a system function — good pre-flight discipline.
- **`is_current_user_admin()` body-identical mechanism (`pg_get_functiondef` diff + `STABLE` preserved)** is the right approach to guarantee admin RLS semantics survive the rewrite.
- **Local `supabase db reset --local` replay before push** is the cheapest credible defect-detection stage.
- **Dual lint (`--linked` pre-deploy + post-deploy)** gives advisor-level evidence on both ends.
- **Plan correctly absorbs the two RESEARCH.md corrections** (`increment_vote_count` already uses `public.vote_counts`; `update_profile_after_auth` must use the 4-param signature).

### Agreed Concerns (raised by 2+ reviewers — highest priority)

- **Rollback path is too informal for the blast radius of `is_current_user_admin()` (MEDIUM in Gemini, MEDIUM in Codex).** Both reviewers note that "fix-forward via Studio `CREATE OR REPLACE`" assumes the developer retains admin RLS access; if `is_current_user_admin()` is broken, the admin path may be locked out. Mitigation: pre-stage emergency restore SQL artifact containing current production function definitions; document the service-role fallback path (Supabase CLI / direct service-role key) for the case where Studio admin path is unavailable.

### Divergent Views

- **Overall risk rating diverges:** Gemini calls it **MEDIUM**; Codex calls it **HIGH** (would drop to MEDIUM with the verification + rollback hardening). Gemini focuses on the technical simplicity of the SQL change; Codex weights the verification-depth gap more heavily. The plan currently labels the phase as HIGH risk in the ROADMAP, which aligns with Codex.

### Codex-only HIGH concerns (require resolution before execute)

1. **TEST-11 does not strongly prove `is_current_user_admin()` behavior.** The current `vote_counts` policy intentionally has NO admin OR-bypass, so the 12-cell matrix mostly proves the *absence* of the admin branch on that one table — it does not directly test that `is_current_user_admin()` correctly grants/denies access on the *other* admin-gated tables. **Suggested mitigation:** add a direct catalog/regression assertion for `is_current_user_admin()` against at least one other admin-gated RLS table (e.g., `audit_log`), with admin / non-admin / MFA-false / guild-false fixtures.
2. **`rls_auto_enable` "0 WARNs or 1 if system-owned" exception conflicts with DBHY-02 wording.** DBHY-02 says zero WARNs; the plan allows a residual WARN. **Suggested mitigation:** before execute, either (a) prove `rls_auto_enable` is non-user-fixable and formally amend DBHY-02 / Phase 14 success criteria to explicitly allow that single residual WARN, or (b) reach a definitive resolution path (e.g., Supabase support ticket / table-ownership claim) so DBHY-02 reads literally.

### Gemini-only concerns (lower severity, worth addressing)

- **Extension-function qualification audit (MEDIUM):** before Wave 1, grep all 7 function bodies for `gen_random_uuid`, `uuid_generate_v4`, `citext`, etc. — under `search_path = ''` these must be `extensions.<fn>` (currently only DML target qualification is mandated by the plan).
- **`auth.uid()` qualification check (LOW):** verify body-identical copies do not regress to bare `uid()` (unlikely given the verbatim-copy mandate, but worth grep-confirming).
- **`pg_get_functiondef` baseline accounts for `SET search_path` line addition (LOW):** the diff baseline must allow for the search_path attribute itself to differ; otherwise the diff check trivially fails.

### Recommended Actions Before Execute

1. **(HIGH)** Resolve the `rls_auto_enable` / DBHY-02 wording ambiguity — either prove non-fixable and amend the requirement, or commit to a fix path.
2. **(HIGH)** Strengthen the `is_current_user_admin()` verification — add a direct catalog query / RLS-policy check on at least one admin-gated table beyond `vote_counts` (e.g., `audit_log`) to give TEST-11 real semantic coverage of the function.
3. **(MEDIUM)** Pre-stage emergency restore SQL — capture current production `pg_get_functiondef` output for all 6 (or 7) target functions into `evidence/pre-deploy-functiondef-snapshot.sql` BEFORE running `supabase db push`. This becomes the canonical rollback artifact.
4. **(MEDIUM)** Add a catalog assertion task in Wave 1 that queries `prosecdef`, `provolatile`, `proconfig`, `proowner`, `proacl` per target function — catches missing `SECURITY DEFINER`, stripped `STABLE`, wrong owner, accidental overload in one query.
5. **(MEDIUM)** Make the `pg_get_functiondef` body-identical check machine-enforced (`diff -u` after normalizing the `SET search_path` line) instead of manual visual inspection.
6. **(MEDIUM)** Extension-function audit before Wave 1 (grep for `gen_random_uuid`, `uuid_generate_v4`, `citext`).
7. **(LOW)** Replace `grep -i 'PASS\|pass'` style validation in Task 07 with direct exit-code-based test runner invocation for `e2e/integration/vote-counts-rls.test.ts`.

To incorporate this feedback into the plan, run: `/gsd:plan-phase 14 --reviews`
