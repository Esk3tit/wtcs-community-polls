---
phase: 14
cycle: 3
reviewers: [gemini, codex]
reviewed_at: 2026-05-17T01:59:09Z
plans_reviewed:
  - 14-01-PLAN.md
skipped_reviewers:
  - claude (self — running inside Claude Code, skipped for independence)
  - cursor (usage limit hit on free tier)
  - coderabbit (working tree clean — no diff to review; plan artifacts already committed)
  - opencode (not installed)
  - qwen (not installed)
cycle_2_high_concerns:
  - id: H1-cycle1
    severity: HIGH
    summary: "tests/sql/is_current_user_admin_regression.sql broken: FK to auth.users not seeded, wrong audit_log column names, top-level PERFORM invalid in plain SQL"
    cycle_3_resolution: "PARTIALLY RESOLVED — Codex caught a NEW deterministic failure: the fixture seeds auth.users (FK ✓), uses (before, after) columns (✓), and wraps PERFORM in DO blocks (✓), BUT the on_auth_user_created trigger fires handle_new_user() which INSERTs INTO public.profiles BEFORE the fixture's explicit profile INSERT runs, so the fixture's bare INSERT INTO public.profiles will hit a unique-key violation on profiles.id. Gemini marked FULLY RESOLVED based on the three documented gaps; Codex (deeper migration-trigger inspection) found the fourth bug that still prevents the fixture from running."
  - id: H3-cycle2
    severity: HIGH
    summary: "RLS branch may not test RLS — superuser bypass; needs SET LOCAL ROLE authenticated"
    cycle_3_resolution: "FULLY RESOLVED IN PLAN, DEPENDENT ON H1 — fixture now wraps every RLS-asserting SELECT in SET LOCAL ROLE authenticated; ... RESET ROLE (verified at lines 78, 118, 134 in tests/sql/is_current_user_admin_regression.sql). Plan verify block grep-asserts >=3 occurrences. Both reviewers agree the design closes H3. However, H3 cannot be exercised end-to-end until H1 is fixed."
  - id: H4-cycle2
    severity: HIGH
    summary: "update_profile_after_auth overload safety — CREATE OR REPLACE FUNCTION does not cross signatures"
    cycle_3_resolution: "PARTIALLY RESOLVED — Codex found internal plan inconsistency: W0 Check 1B correctly enumerates overloads with U1/U2/U3 decision tree, and Task 01 (line 429) allows U2 'harden both overloads' as a permitted path. BUT downstream verification gates contradict the harden-both path — Task 02-05 acceptance criterion line 565 requires 'exactly ONE row' per function name, and post-deploy Task 08b CHECK 3 (line 1021) requires 'each function name appears exactly once'. Line 1100 attempts to reconcile by saying overload count is 'expected per name', but the earlier hard 'exactly one' gates still fire and would block U2-harden-both. Gemini missed this inconsistency."
---

# Cross-AI Plan Review — Phase 14 (Cycle 3)

## Gemini Review

The cycle-3 replan for Phase 14 is **exceptionally thorough** and demonstrates a "defense-in-depth" approach to database migration and verification. It systematically addresses every concern raised in prior reviews with machine-enforced assertions and clear decision trees.

### 1. Summary of Resolution
The cycle-2 **HIGH** concerns (H1, H3, H4) are **FULLY RESOLVED**:
*   **H1 (Broken fixture):** The rewritten SQL fixture correctly seeds `auth.users` (resolving FK constraints), uses the verified `(before, after)` columns for `audit_log`, and wraps `PERFORM` logic inside `DO` blocks/functions to ensure valid SQL script execution.
*   **H3 (RLS bypass):** The fixture now explicitly employs `SET LOCAL ROLE authenticated` before every RLS-asserting `SELECT`. This ensures that the testing role actually lacks the `BYPASSRLS` attribute, providing a true validation of the policies.
*   **H4 (Overload safety):** The inclusion of **W0 Check 1B** to enumerate function signatures and the subsequent **Task 01** conditional logic ensures that stale overloads (like the 3-param version of `update_profile_after_auth`) are either removed or hardened, leaving no unhardened security-definer surfaces.

### 2. Strengths
*   **Machine-Enforced Verification:** The use of `diff -u` with line normalization for function definitions and structured catalog assertions (`prosecdef`, `provolatile`, `proconfig`) replaces manual inspection with deterministic, repeatable checks.
*   **Wave 0 Pre-flights:** The plan gates implementation on critical research (overload enumeration, `rls_auto_enable` ownership, extension function audit), preventing "flying blind" into production.
*   **Emergency Rollback Robustness:** Pre-staging a service-role-usable `pg_get_functiondef` snapshot provides a viable recovery path even if a developer is accidentally locked out of the Studio admin UI.
*   **Identity Branch Coverage:** The regression test covers all four logical branches of the `is_current_user_admin()` AND chain, ensuring that a fix for one (e.g., `SET search_path`) doesn't silently break another (e.g., MFA or Guild checks).

### 3. Concerns & Resolution Status

| ID | Prior Concern | Status | Acceptance / Mitigation in Plan |
| :--- | :--- | :--- | :--- |
| **H1** | **Broken SQL Fixture** (FKs/Columns/Syntax) | **FULLY RESOLVED** | Task 07b fixture seeds `auth.users`, uses `before/after` columns, and moves `PERFORM` into `pg_temp` helpers/`DO` blocks. |
| **H3** | **RLS Bypass in Testing** (Privileged Session) | **FULLY RESOLVED** | Fixture uses `SET LOCAL ROLE authenticated` around all read assertions; Task 07b `<verify>` block greps for this specifically. |
| **H4** | **Overload Safety** (Incomplete Hardening) | **FULLY RESOLVED** | W0 Check 1B enumerates overloads; Task 01 implements explicit `DROP` or double-hardening based on the W0 outcome. |
| **M1** | **Regression Role Context** | **FULLY RESOLVED** | Integrated into Task 07b via `SET LOCAL ROLE`. |
| **M3** | **W0 Query Completeness** | **FULLY RESOLVED** | Query A now includes `pg_get_functiondef` for executable body capture. |

### 4. Suggestions
*   **Audit Log Context (Minor):** In the `is_current_user_admin_regression.sql` fixture, consider adding a check that the `actor_id` in the returned `audit_log` row matches the admin fixture ID to ensure the row visibility is tied to the correct identity context, though `action = 'fixture-canary'` is likely sufficient within a single transaction.
*   **Local DB URL Transparency:** Ensure the `LOCAL_DB_URL` used in tasks is explicitly derived from `npx supabase status` to avoid "connection refused" errors if the local port has drifted.

### 5. Risk Assessment: **LOW**
The plan has moved from a "surgical update" to a "verified hardening" model. By combining pre-deploy catalog snapshots, machine-enforced body diffs, and multi-branch RLS regression tests, the risk of a production outage or a silent security regression is effectively mitigated. The "fix-forward" strategy is backed by a concrete emergency rollback artifact, providing a solid safety net.

---

## Codex Review

**Summary**
Cycle-3 is improved, but I would not approve it as fully resolved. H3 is effectively resolved in design because the fixture now switches to `authenticated` around the assertion reads. H4 is only partially resolved because the overload decision tree exists, but the later count/catalog gates conflict with the "harden both overloads" path. H1 is still partially resolved: the fixture fixed the FK seed, `before`/`after`, and top-level `PERFORM` issues, but it introduces a new deterministic failure because inserting into `auth.users` fires `on_auth_user_created`, which already creates `public.profiles` rows before the fixture's explicit profile insert.

**Strengths**

- Good choice of `audit_log` for the direct RLS regression; its policy directly uses `public.is_current_user_admin()` in `supabase/migrations/00000000000010_results_hidden_audit.sql:73`.
- The fixture now uses the correct `audit_log` columns: `before` and `after`, not `payload`.
- `SET LOCAL ROLE authenticated` is present around the direct function check and both `audit_log` RLS checks.
- W0 overload enumeration for `update_profile_after_auth` is the right mechanism; `CREATE OR REPLACE` does not cross signatures.
- Post-deploy `pg_get_functiondef` and catalog assertions are strong controls for a risky DB migration.

**Concerns**

- **HIGH — H1: PARTIALLY RESOLVED.** The fixture seeds `auth.users`, but `supabase/migrations/00000000000002_triggers.sql:137` has an `AFTER INSERT ON auth.users` trigger that executes `handle_new_user()`, which `INSERT INTO public.profiles (id, ...) ON CONFLICT (id) DO UPDATE SET ...` at line 113. The fixture then does a plain `INSERT INTO public.profiles` at `tests/sql/is_current_user_admin_regression.sql:40`, so it will fail with a unique-key violation on `profiles.id`.
  Acceptance: profile seeding must use `UPDATE public.profiles ... WHERE id IN (...)` after `auth.users` insert, or `INSERT ... ON CONFLICT (id) DO UPDATE SET ...`, and `psql -v ON_ERROR_STOP=1 -f` must exit 0 with 6 PASS notices.

- **H3: FULLY RESOLVED IN PLAN, pending executable fixture.** The role-switching gap is addressed: the fixture switches to `authenticated` before the direct function call and both `audit_log` SELECTs at `tests/sql/is_current_user_admin_regression.sql` lines 78, 118, 134.
  Acceptance: after fixing H1, the `audit_log/admin` branch sees the canary row and `audit_log/non_admin` sees 0 rows under `authenticated`.

- **HIGH — H4: PARTIALLY RESOLVED.** W0 correctly enumerates overloads, but the rest of the plan is internally inconsistent. Task 01 allows U2 "harden both" at `14-01-PLAN.md:429`, while Task 02-05 still requires exactly one `update_profile_after_auth` row at `14-01-PLAN.md:565` ("for each function name there is exactly ONE row..."), and post-deploy CHECK 3 says every function name appears exactly once at `14-01-PLAN.md:1021`. Line 1100 mentions "expected overload count per name" but never overrides the earlier hard "exactly ONE" gates.
  Acceptance: either mandate DROP of the stale 3-param overload everywhere (single retained signature path), or rewrite all overload-count gates to compute `expected_function_blocks = base_functions + retained_extra_overloads` and use that variable consistently across Task 02-05 acceptance + Task 08b CHECK 3.

- **MEDIUM — `rls_auto_enable` R2 classification is too broad.** The plan treats `proowner = postgres` as system-owned at `14-01-PLAN.md:244`. Supabase user migrations often create functions owned by `postgres`, so owner alone does not prove system ownership.
  Acceptance: R2 should require `owning_extension IS NOT NULL`, non-user schema plus support/dashboard confirmation, or absence from `pg_proc`. `public` + `postgres` + no extension should be R1 or R3, not R2.

**Suggestions**

- Change the fixture profile seed to an upsert:
  `INSERT INTO public.profiles (...) VALUES (...) ON CONFLICT (id) DO UPDATE SET is_admin=EXCLUDED.is_admin, mfa_verified=EXCLUDED.mfa_verified, guild_member=EXCLUDED.guild_member, discord_username=EXCLUDED.discord_username, avatar_url=EXCLUDED.avatar_url`.
- Add a seed sanity assertion before `audit_log` insert: exactly four profiles exist with the intended `is_admin/mfa_verified/guild_member` combinations.
- Simplify H4 by choosing one path: prefer dropping the stale 3-param overload after confirming app code calls the 4-param RPC.
- If "harden both" remains allowed, compute `expected_function_blocks = base_functions + retained_extra_overloads` and use that in every grep/catalog gate.
- Tighten R2 for `rls_auto_enable`; do not use `proowner=postgres` alone as proof.

**Risk Assessment**

Overall risk remains **HIGH as written** because the new fixture likely fails before proving anything, and H4's verification gates are internally inconsistent. After the profile upsert fix and a single explicit overload policy, residual risk drops to **MEDIUM** for a production DB hardening migration.

---

## Skipped Reviewers

- **Claude** — skipped for independence (this cross-AI review is being orchestrated from Claude Code).
- **Cursor** — invoked but returned "You've hit your usage limit. Get Cursor Pro for more Agent usage..." Output was empty; skipped.
- **CodeRabbit** — invoked but failed with "No files found for review". CodeRabbit reviews git diffs of staged/unstaged changes; the cycle-3 planning artifacts are all committed and the working tree is clean, so there is nothing for CodeRabbit to scan. Not applicable to plan-only review.
- **OpenCode, Qwen** — not installed on this machine.

---

## Consensus Summary

Two independent reviewers (Gemini, Codex) reviewed the cycle-3 replan of `14-01-PLAN.md` plus the rewritten `tests/sql/is_current_user_admin_regression.sql` fixture. **Verdicts diverge sharply on the residual HIGH count.**

### Cycle-2 HIGH concerns — cycle-3 verdict

- **H1 (broken fixture): PARTIALLY RESOLVED.** Three of four documented bugs from cycle 2 are fixed (FK seed to `auth.users` present, `(before, after)` columns used, `PERFORM` moved into `DO`/`pg_temp` helpers). However Codex found a NEW deterministic failure mode that cycle 1 and cycle 2 reviewers missed: the `on_auth_user_created` trigger on `auth.users` fires `handle_new_user()` which inserts into `public.profiles` BEFORE the fixture's explicit `INSERT INTO public.profiles`. The fixture's bare INSERT will hit a unique-key violation on `profiles.id` (verified — see `supabase/migrations/00000000000002_triggers.sql:113` and `tests/sql/is_current_user_admin_regression.sql:40`). The fix is small (UPSERT or `UPDATE WHERE id IN (...)`), but the fixture as written cannot pass its own acceptance criterion. Gemini missed this because it did not cross-reference the trigger file with the fixture. **The conservative posture (Codex) governs: H1 remains PARTIALLY RESOLVED.**

- **H3 (RLS-not-actually-tested): FULLY RESOLVED IN PLAN, EXECUTION GATED ON H1.** Both reviewers agree the design correctly addresses the RLS-bypass concern: `SET LOCAL ROLE authenticated` is wrapped around every RLS-asserting SELECT in the fixture (lines 78, 118, 134 — 3 occurrences, matching the plan's `grep -c >= 3` gate). The role-context fix is conceptually closed. However, H3 cannot be exercised end-to-end until H1's profile-INSERT collision is fixed, so it does not count as VERIFIED yet. **Counted as FULLY RESOLVED for design**, but with a verification dependency on H1.

- **H4 (update_profile_after_auth overload safety): PARTIALLY RESOLVED.** W0 Check 1B is correct in shape (enumerate overloads via `pg_get_function_identity_arguments`, branch on U1/U2/U3) and Task 01 contains a DROP-or-harden block. However Codex found that the downstream verification gates are internally inconsistent with the U2-harden-both branch: line 565 (Task 02-05 acceptance) demands "exactly ONE row" per function name, line 1021 (post-deploy CHECK 3) demands "the function name appears exactly ONCE". These hard gates would FAIL the U2-harden-both path even when the harden-both path is the action selected at Task 01. Line 1100 ("expected overload count per name") attempts a reconciliation but never explicitly overrides the earlier "exactly ONE" assertions. Without a single source of truth for `expected_function_blocks`, the U2-harden-both path is unverifiable as written. Gemini missed this contradiction. **The conservative posture (Codex) governs: H4 remains PARTIALLY RESOLVED.**

### NEW concerns raised in cycle 3

1. **MEDIUM (Codex) — `rls_auto_enable` R2 classification is too broad.** Line 244 of the plan treats `proowner = supabase_admin / postgres / a non-user role` as automatic R2 (system-owned). Supabase user migrations routinely create functions owned by `postgres`, so owner alone is insufficient. R2 should require `owning_extension IS NOT NULL` (the only unambiguous extension marker), or `pg_proc.pronamespace` outside `public`, plus support confirmation. As written, the W0 step may misclassify a user-owned function as R2 and trigger an unnecessary DBHY-02 amendment.

### Agreed Strengths (both reviewers)

- Machine-enforced verification: `diff -u` with normalization, catalog assertions on `prosecdef`/`provolatile`/`proconfig`/`proowner`, grep gates on the migration file.
- `audit_log` is the right table for the regression — its SELECT policy directly invokes `public.is_current_user_admin()` (per migration 10 line 77).
- W0 Wave-0 pre-flight pattern: enumerate the unknowns (overloads, ownership) BEFORE touching the migration.
- Emergency rollback artifact (service-role-usable `pg_get_functiondef` snapshot) is a strong control.
- Identity branch coverage (admin / non-admin / mfa_false / guild_false) exercises every AND-arm of `is_current_user_admin()`.

### Divergent Views — risk verdict

- **Gemini: LOW.** All three cycle-2 HIGHs FULLY RESOLVED; minor polish suggestions only.
- **Codex: HIGH as written, dropping to MEDIUM after a profile UPSERT fix and a single explicit overload policy.** Found two unresolved items missed by Gemini: the trigger-driven duplicate-key in the fixture, and the internal contradiction between Task 01's U2-harden-both branch and the downstream "exactly ONE row" gates.

The divergence is rooted in cross-reference depth: Gemini accepts the design as written; Codex traces the fixture against the migration trigger graph and traces the U2 branch through every downstream gate. **The conservative posture (Codex) governs cycle accounting.** H1 and H4 stay PARTIALLY RESOLVED and count as live HIGH concerns. H3 is FULLY RESOLVED in design (counted as resolved) but cannot be end-to-end verified until H1 is fixed.

### Recommended Actions Before Execute (cycle 3)

1. **(HIGH — H1 follow-up)** Change the fixture's `INSERT INTO public.profiles` to `INSERT ... ON CONFLICT (id) DO UPDATE SET is_admin=EXCLUDED.is_admin, mfa_verified=EXCLUDED.mfa_verified, guild_member=EXCLUDED.guild_member, discord_username=EXCLUDED.discord_username, avatar_url=EXCLUDED.avatar_url`. Rationale: `handle_new_user()` fires on `INSERT INTO auth.users` and ON CONFLICT-DOes-UPDATEs the matching `public.profiles` row first (only `id, discord_id, discord_username, avatar_url, is_admin` columns), so the fixture must UPSERT (not bare INSERT) and must also set the `mfa_verified` / `guild_member` columns explicitly because the trigger does not. Verify: `psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f tests/sql/is_current_user_admin_regression.sql` exits 0 with 6 PASS NOTICEs.

2. **(HIGH — H4 follow-up)** Pick one canonical overload policy and unify the gates:
   - **Option A (recommended):** Always DROP the stale 3-param overload — Task 01 unconditionally emits `DROP FUNCTION IF EXISTS public.update_profile_after_auth(BOOLEAN, TEXT, TEXT);` before the 4-param CREATE OR REPLACE. Then every "exactly ONE row" gate remains literally true. U2 collapses into U1.
   - **Option B:** If U2-harden-both must remain an option, introduce a single `expected_overload_count[function_name]` table at W0 completion, and rewrite every "exactly ONE row" gate (lines 27, 565, 1021, 1053, 1100) to consult this table.

3. **(MEDIUM)** Tighten R2 to require `owning_extension IS NOT NULL`. `proowner = postgres` alone is insufficient evidence of system ownership and may mis-route a user-owned function to a DBHY-02 carve-out.

### Verifiable Acceptance Criteria for Each Live HIGH

| Concern | Acceptance Criterion |
|---------|----------------------|
| H1 | `grep -n "ON CONFLICT" tests/sql/is_current_user_admin_regression.sql` returns >=1 line covering the profiles INSERT; `psql -v ON_ERROR_STOP=1 -f tests/sql/is_current_user_admin_regression.sql` exits 0 and emits 6 PASS NOTICEs (4 identity + 2 audit_log) on a fresh `supabase db reset --local` |
| H4 | EITHER (Option A) `grep -n "DROP FUNCTION IF EXISTS public.update_profile_after_auth(BOOLEAN, TEXT, TEXT)" supabase/migrations/00000000000014_*.sql` returns >=1 line AND all "exactly ONE row" gates remain literal; OR (Option B) `14-01-PLAN.md` defines `expected_overload_count` per function name and every overload-count gate references it explicitly |
