---
phase: 14
cycle: 2
reviewers: [gemini, codex]
reviewed_at: 2026-05-17T01:31:52Z
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
cycle_1_high_concerns:
  - id: H1-cycle1
    summary: "TEST-11 verification insufficient for is_current_user_admin() — needed direct regression test against an admin-gated table beyond vote_counts (e.g. audit_log)"
    cycle_2_resolution: "PARTIALLY RESOLVED — Task 07b added with correct INTENT (audit_log + 4 identity branches) but implementation is brittle per Codex: FK seed to auth.users missing, audit_log column names wrong (payload vs before/after), PERFORM used in plain SQL (only valid in PL/pgSQL), and RLS likely bypassed because psql session runs as superuser without explicit SET LOCAL ROLE authenticated. Gemini independently flagged the same RLS-bypass concern (MEDIUM). Both reviewers converge: Task 07b currently asserts a SHAPE but cannot actually prove is_current_user_admin() behavior end-to-end as written."
    status: PARTIALLY_RESOLVED
  - id: H2-cycle1
    summary: "rls_auto_enable '0 WARNs or 1 if system-owned' wording conflicted with DBHY-02's literal zero — needed formal resolution before execute"
    cycle_2_resolution: "FULLY RESOLVED — W0 Check 1 introduces an R1/R2/R3 outcome gate; R2 requires a SEPARATE REQUIREMENTS.md amendment commit BEFORE Task 01 begins (docs(req): amend DBHY-02 with rls_auto_enable carve-out). Codex explicitly confirms: 'fully resolved as a planning/control issue'. Gemini independently confirms: 'requires a formal Requirements amendment commit if the function is found to be system-owned'. Verifiable acceptance criterion in W0 resume-signal."
    status: FULLY_RESOLVED
new_concerns_raised:
  - id: H3-cycle2
    severity: HIGH
    raised_by: codex
    summary: "Task 07b RLS branch may not actually test RLS — direct psql session runs as privileged user; SET LOCAL ROLE authenticated missing; canary insert relying on 'default RLS bypass' means the non-admin SELECT may see rows for the wrong reason"
    status: UNRESOLVED
  - id: H4-cycle2
    severity: HIGH
    raised_by: codex
    summary: "update_profile_after_auth overload handling likely wrong — migration 2 defines a 3-param function and migration 3 defines a 4-param function. CREATE OR REPLACE does not replace across signatures, so a stale 3-param SECURITY DEFINER overload may remain unhardened and DBHY-02 may stay dirty (residual 0011 WARN)"
    status: UNRESOLVED
  - id: M1-cycle2
    severity: MEDIUM
    raised_by: gemini
    summary: "Regression role context — psql superuser bypasses RLS unless SET ROLE authenticated or FORCE ROW LEVEL SECURITY is applied (converges with H3-cycle2 from Codex)"
    status: UNRESOLVED
  - id: M2-cycle2
    severity: MEDIUM
    raised_by: codex
    summary: "SQL fixture uses top-level PERFORM set_config(...) which is invalid in plain SQL scripts (PERFORM is PL/pgSQL only); must be SELECT set_config(...) at script level"
    status: UNRESOLVED
  - id: M3-cycle2
    severity: MEDIUM
    raised_by: codex
    summary: "W0 R1 says copy rls_auto_enable body from Query A's pg_get_functiondef, but Query A as written does not SELECT pg_get_functiondef(p.oid)"
    status: UNRESOLVED
  - id: L1-cycle2
    severity: LOW
    raised_by: codex
    summary: "R2 and R3 outcomes overlap for 'public but extension-owned' rls_auto_enable — extension-owned should always be R2 unless advisor/support state is ambiguous"
    status: UNRESOLVED
  - id: L2-cycle2
    severity: LOW
    raised_by: gemini
    summary: "Catalog assertion proconfig only reflects function-level SET search_path, not unqualified body references (mitigated by Task 01 grep + Task 02-05 linting)"
    status: ACKNOWLEDGED_MITIGATED
---

# Cross-AI Plan Review — Phase 14 (Cycle 2)

## Gemini Review

# Cross-AI Plan Review — Phase 14: Security-Definer Search-Path Migration (Cycle 2)

## 1. Summary
The implementation plan for Phase 14 is of high quality and demonstrates exceptional attention to the security and integrity of the database layer. **Both Cycle 1 HIGH concerns are FULLY RESOLVED.**

The replan addresses the `is_current_user_admin()` verification gap by introducing a direct SQL regression fixture (Task 07b) that exercises multiple identity branches and real RLS impact on the `audit_log` table. The `rls_auto_enable` ambiguity is resolved via a blocking Wave 0 decision tree that mandates a formal Requirements amendment commit if the function is found to be system-owned. Furthermore, the plan has been significantly hardened with machine-enforced functiondef diffs, catalog assertions, and a pre-deploy emergency rollback snapshot, reducing the residual risk of the migration.

## 2. Strengths
*   **Comprehensive Regression (Task 07b):** The new SQL fixture directly verifies the internal logic of `is_current_user_admin()` against 4 identity scenarios (Admin, Non-Admin, MFA-false, Guild-false), moving beyond the limited scope of the TEST-11 matrix.
*   **Machine-Enforced Identity (Tasks 02-05 & 08b):** The use of `diff -u` with normalized search paths and the `pg_proc` catalog assertion ensures that body identity and attributes (like `STABLE` and `SECURITY DEFINER`) are preserved with cryptographic-like precision.
*   **Rollback Robustness (W0 Check 3):** Pre-staging a service-role-usable restore SQL snapshot *before* the push mitigates the risk of an admin lockout if the RLS gating function is corrupted during deployment.
*   **Extension/Auth Audit (W0 Check 2):** Proactively checking for bare extension function calls (e.g., `gen_random_uuid`) and `auth.uid()` qualifiers prevents runtime "function does not exist" errors that often plague `search_path = ''` migrations.
*   **Procedural Discipline (W0 Outcome R2):** The requirement to commit a requirements amendment *before* proceeding with execution in the system-owned case ensures the documentation remains the single source of truth and prevents acceptance-criteria "drift" during the task.

## 3. Concerns
*   **MEDIUM (New): Regression Role Context:** In `tests/sql/is_current_user_admin_regression.sql` (Task 07b), the script executes as the `psql` session user (likely `postgres` or the local superuser). In Postgres, Row Level Security is bypassed for the table owner/superuser unless `FORCE ROW LEVEL SECURITY` is applied.
    *   *Impact:* The "non-admin" check might fail with `FAIL audit_log/non_admin: expected 0 rows, got 1` because the superuser sees the canary row regardless of the JWT claim.
*   **LOW (New): Catalog Assertion Scope:** W0 Check 1 Query A is excellent, but note that `proconfig` only reflects attributes set via `SET search_path = ''` at the function level. While this matches the migration's strategy, it does not verify that the *body* lacks unqualified references (though Task 01's grep and Task 02-05's linting do cover this).

## 4. Suggestions
*   **Force RLS in Regression:** In `tests/sql/is_current_user_admin_regression.sql`, add `SET ROLE authenticated;` after the profile inserts, or use `ALTER TABLE public.audit_log FORCE ROW LEVEL SECURITY;` within the transaction to ensure the `SELECT` statements actually exercise the RLS logic. Remember to `RESET ROLE;` if needed before the `ROLLBACK;`.
*   **Evidence Naming:** In Task 08b, ensure the `advisor-zero-warns.png` screenshot clearly shows the "System-owned" context for `rls_auto_enable` if Outcome R2 was selected, to provide definitive proof for the requirements carve-out.

## 5. Risk Assessment
**Overall Risk: MEDIUM**

While the migration touches the core security backbone of the application (`is_current_user_admin`), the risk has been successfully downgraded from **HIGH** to **MEDIUM** due to the rigorous verification layers (diffs, catalog checks, and direct regression). The implementation is now protected by both static (grep/diff) and dynamic (smoke/regression) gates.

**Verdict:** The plan is **APPROVED FOR EXECUTION** provided the regression role context is handled.

---

## Codex Review

## Summary

Verdict: **one HIGH concern is fully resolved in intent but only partially resolved in executable detail; the other is fully resolved.** W0 Check 1 now gives DBHY-02 a formal R1/R2/R3 decision path, and R2 requires a separate `REQUIREMENTS.md` amendment before Task 01, so the "0 WARNs vs 1 system-owned WARN" ambiguity is **fully resolved** as a planning/control issue. Task 07b targets the right missing coverage, but the proposed SQL fixture is currently not runnable and may not exercise RLS correctly, so the `is_current_user_admin()` concern is **partially resolved**, not fully.

## Strengths

- W0's R1/R2/R3 gate is a real resolution mechanism, not hand-waving. Requiring a requirement-amendment commit before implementation is the right audit trail.
- `audit_log` is the right non-`vote_counts` table to test: its SELECT policy directly uses `public.is_current_user_admin()` in [00000000000010_results_hidden_audit.sql](/Users/khaiphan/code/wtcs-community-polls/supabase/migrations/00000000000010_results_hidden_audit.sql:73).
- Catalog assertions add real safety: `prosecdef`, `provolatile`, `proconfig`, owner, ACL, and overload checks catch mistakes grep will miss.
- Pre-staged `pg_get_functiondef` restore SQL materially improves rollback readiness.
- Extension-function and `auth.uid()` audits are useful, low-cost checks.
- TEST-11 is now correctly positioned as `vote_counts` regression coverage, not as proof of `is_current_user_admin()`.

## Concerns

- **HIGH, REMAINING:** Task 07b does not fully close the `is_current_user_admin()` gap as written. The fixture inserts directly into `public.profiles`, but `profiles.id` has an FK to `auth.users`; the planned `00000000-...a001` users are not seeded, so the script will fail. It also inserts `public.audit_log (..., payload)`, but `audit_log` has `before` / `after`, not `payload`.

- **HIGH, NEW:** The Task 07b RLS branch may not test RLS. A direct `psql "$LOCAL_DB_URL"` session is likely privileged unless it explicitly switches to `authenticated`. The plan says it "relies on default RLS bypass" for the canary insert, but that same bypass would also make the non-admin `audit_log` SELECT see rows. The test needs `SET LOCAL ROLE authenticated` or a real Supabase authed client for assertion reads.

- **MEDIUM, NEW:** The SQL fixture has invalid top-level `PERFORM set_config(...)` statements. Plain SQL scripts need `SELECT set_config(...)`; `PERFORM` only works inside PL/pgSQL blocks/functions.

- **HIGH, NEW:** `update_profile_after_auth` overload handling is likely wrong. Migration 2 defines a 3-param function, and migration 3 defines a 4-param function with a default; `CREATE OR REPLACE` does not replace across signatures. The plan assumes exactly one function name entry, but on-disk history suggests a stale 3-param SECURITY DEFINER overload may still exist. If present, Migration 14 must harden or drop it, or DBHY-02 may remain dirty.

- **MEDIUM, NEW:** W0 R1 says to copy `rls_auto_enable` from Query A's `pg_get_functiondef`, but Query A does not select `pg_get_functiondef(p.oid)`. Add it explicitly.

- **LOW, NEW:** R2 and R3 overlap for "public but extension-owned" `rls_auto_enable`. Make extension-owned always R2 unless the advisor/support state is ambiguous.

- **LOW, REMAINING:** The functiondef diff is valuable, but local comparison against source-file text still allows manual interpretation. Post-deploy pre/post `pg_get_functiondef` diff should be strict after normalizing only `SET search_path`.

## Suggestions

- Replace Task 07b with a Vitest integration test using existing fixture auth clients, or fix the SQL script to:
  - insert matching `auth.users` rows first, or reuse existing fixture users;
  - use `SELECT set_config(...)`;
  - set both `request.jwt.claim.sub` and `request.jwt.claims` if using direct SQL;
  - insert the canary as privileged setup, then `SET LOCAL ROLE authenticated` for admin/non-admin SELECT assertions;
  - use valid `audit_log` columns.
- Add a W0 catalog query for `update_profile_after_auth` signatures. If the 3-param overload exists, decide explicitly: harden both overloads or drop the obsolete one after confirming app calls the 4-param RPC.
- Add `pg_get_functiondef(p.oid)` to W0 Query A for `rls_auto_enable`.
- Make post-deploy normalized `diff -u` require exit code 0. Since both sides are `pg_get_functiondef`, formatting drift should not be expected there.

## Risk Assessment

Overall risk remains **HIGH until Task 07b and overload handling are corrected**. The replan substantially improves controls, but the new direct regression test is currently brittle enough to fail before it proves anything, and the possible `update_profile_after_auth` overload could leave a SECURITY DEFINER function unhardened. With those fixes, residual risk drops to **MEDIUM**.

---

## Consensus Summary

Two independent reviewers (Gemini, Codex) reviewed `14-01-PLAN.md` in cycle 2. Cursor returned a usage-limit error; CodeRabbit requires a git diff (plan-only review has none); OpenCode and Qwen are not installed.

### Cycle 1 HIGH concerns — verdict

- **H1 (TEST-11 → is_current_user_admin direct regression on audit_log): PARTIALLY RESOLVED.** Both reviewers agree the INTENT is correct — Task 07b targets the right table (`audit_log`, whose SELECT policy directly calls `public.is_current_user_admin()` per migration 10) and the right four identity branches. **However, Gemini and Codex independently converge on the same execution gap**: the fixture's `psql` session is privileged (superuser/postgres), so the "non-admin sees zero rows" assertion may pass for the WRONG reason (superuser bypasses RLS, not that `is_current_user_admin()` returned FALSE). Codex additionally surfaces three implementation bugs that would prevent the fixture from running at all: (a) `profiles.id` FK to `auth.users` not seeded, (b) `audit_log` column is `before`/`after`, not `payload`, (c) top-level `PERFORM set_config(...)` is invalid SQL (PL/pgSQL-only). **As written, Task 07b cannot pass its own acceptance criteria — therefore the cycle-1 HIGH remains PARTIALLY RESOLVED, not FULLY RESOLVED.**

- **H2 (`rls_auto_enable` / DBHY-02 wording ambiguity): FULLY RESOLVED.** Both reviewers explicitly confirm: W0 Check 1's R1/R2/R3 outcome decision tree, combined with the requirement that R2 commit a separate `docs(req): amend DBHY-02 with rls_auto_enable carve-out` BEFORE Task 01 begins, makes the carve-out auditable and unambiguous. Codex: "fully resolved as a planning/control issue." Gemini: "ensures the documentation remains the single source of truth and prevents acceptance-criteria drift."

### New HIGH concerns raised in cycle 2

1. **HIGH (Codex; converges with Gemini MEDIUM) — Task 07b RLS-not-actually-tested.** The fixture's reads run under a privileged `psql` session. RLS is bypassed for superusers / table owners unless `FORCE ROW LEVEL SECURITY` is enabled or the session explicitly `SET LOCAL ROLE authenticated`. Mitigation: add `SET LOCAL ROLE authenticated;` before the `SELECT` assertions, or run the canary INSERT as a privileged setup block and re-enter as authenticated for the read assertions.

2. **HIGH (Codex) — `update_profile_after_auth` overload handling.** Migration 2 defined a 3-param SECURITY DEFINER function; migration 3 added a 4-param SECURITY DEFINER function with a default. `CREATE OR REPLACE FUNCTION` only replaces a function with a matching signature — it does NOT drop or replace overloads. If the 3-param overload still exists in production (research did not confirm absence), Migration 14 hardens only the 4-param overload and leaves the 3-param overload unhardened — meaning DBHY-02's "zero 0011 WARNs" may not be met even after migration. Mitigation: add a W0 catalog query that enumerates ALL `update_profile_after_auth` overloads by `pg_get_function_identity_arguments`, and decide explicitly per overload (harden or DROP).

### New MEDIUM concerns

3. **MEDIUM (Codex) — Invalid `PERFORM set_config(...)` at top level.** Plain SQL scripts need `SELECT set_config(...)`; `PERFORM` is PL/pgSQL-only. Mitigation: rewrite the fixture's top-level role-switching as `SELECT set_config(...)`.

4. **MEDIUM (Codex) — W0 R1 references `pg_get_functiondef` output but Query A omits it.** Mitigation: add `pg_get_functiondef(p.oid)` to Query A's SELECT list.

5. **MEDIUM (Gemini, converges with Codex HIGH #1) — Regression role context.** Same issue as Codex's HIGH #1; Gemini's framing of severity is lower but the underlying defect is identical.

### New LOW concerns

6. **LOW (Codex) — R2/R3 overlap.** R3 fires on "found in public but with extension dependency OR admin-only ACL", but R2 already covers extension-owned. Tighten: make extension-owned always R2; reserve R3 for ambiguous/support cases.

7. **LOW (Codex) — Post-deploy functiondef diff should be strict (exit code 0).** Both sides are `pg_get_functiondef` output; formatting drift is not expected.

8. **LOW (Gemini) — `proconfig` catalog assertion does not verify body content.** Acknowledged — Task 01 grep + Task 02-05 linting + functiondef diff cover the body check.

### Agreed Strengths (both reviewers)

- W0 Check 1 R1/R2/R3 gate with R2's separate amendment commit is a real audit-trail mechanism, not hand-waving.
- `audit_log` is the correct non-`vote_counts` admin-gated table to exercise (migration 10's SELECT policy calls `public.is_current_user_admin()` directly).
- Catalog assertions (`prosecdef`, `provolatile`, `proconfig`, `proowner`, `proacl`) provide attribute-level safety that grep cannot.
- Pre-staged `pg_get_functiondef` restore SQL materially improves rollback readiness (admin-lockout defense).
- Extension-function and `auth.uid()` audits are useful, low-cost checks.
- TEST-11 is now correctly positioned as `vote_counts` regression coverage, not as proof of `is_current_user_admin()`.

### Divergent Views — risk verdict

- **Gemini:** MEDIUM. Both cycle-1 HIGHs FULLY RESOLVED. APPROVED FOR EXECUTION (with regression role context fix as a SHOULD).
- **Codex:** HIGH (drops to MEDIUM only after Task 07b and overload handling are corrected). H1 PARTIALLY RESOLVED; H4 (overload) is a NEW HIGH.

The divergence is rooted in implementation depth: Gemini accepts the SHAPE of Task 07b as evidence of intent (correct table, correct branches); Codex requires the fixture to actually run and exercise RLS correctly before crediting it as resolution. **The conservative posture (Codex) governs cycle accounting** — H1 stays PARTIALLY RESOLVED and the 2 NEW Codex HIGHs (Task 07b RLS-actually-tested, `update_profile_after_auth` overload) are counted as live.

### Recommended Actions Before Execute (cycle 2)

1. **(HIGH)** Fix Task 07b fixture: (a) seed matching `auth.users` rows before inserting profiles, OR reuse existing fixture users; (b) use `audit_log`'s actual columns (`before`/`after` not `payload`); (c) replace top-level `PERFORM set_config(...)` with `SELECT set_config(...)`; (d) wrap RLS-asserting SELECTs in `SET LOCAL ROLE authenticated;` blocks (privileged setup → `RESET ROLE` → authenticated read assertion). Alternative: replace with Vitest integration test using existing supabase-js fixture auth clients.
2. **(HIGH)** Add a W0 catalog query enumerating ALL `update_profile_after_auth` overloads by `pg_get_function_identity_arguments`; decide explicitly per overload (harden or DROP). If the 3-param overload is found, Migration 14 must either drop it or harden it explicitly.
3. **(MEDIUM)** Add `pg_get_functiondef(p.oid)` to W0 Check 1 Query A's SELECT list so the R1 outcome's "copy body from Query A" instruction is executable.
4. **(LOW)** Tighten R2/R3 overlap: extension-owned ⇒ R2 unambiguously; reserve R3 for ambiguous/support cases.
5. **(LOW)** Post-deploy normalized functiondef `diff -u` should require exit 0 (both sides are `pg_get_functiondef`).

To incorporate this feedback, run: `/gsd:plan-phase 14 --reviews`
