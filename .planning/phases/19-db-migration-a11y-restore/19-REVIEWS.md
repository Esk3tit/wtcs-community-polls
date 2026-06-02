---
phase: 19
reviewers: [codex, gemini, cursor]
reviewed_at: 2026-06-02T08:26:00Z
plans_reviewed: [19-01-PLAN.md, 19-02-PLAN.md, 19-03-PLAN.md]
self_skipped: claude
unavailable: [opencode, qwen]
coderabbit_skipped: "reviews working-tree diff, not planning artifacts — N/A for plan review"
---

# Cross-AI Plan Review — Phase 19: DB Migration + A11y Restore

Three external reviewers ran to completion (codex gpt-5.5, gemini, cursor). Claude
skipped as self. opencode and qwen are not installed. coderabbit reviews the git
working-tree diff rather than planning artifacts, so it is not applicable to a plan
review.

## Codex Review (gpt-5.5)

## Summary

The plans are well-scoped and mostly aligned with Phase 19, but Plan 19-01 has one potentially blocking SQL correctness issue: `current_setting(..., true) != 'on'` is not null-safe. PostgreSQL documents that missing settings return `NULL` when `missing_ok=true`, and `NULL != 'on'` will not enter the branch. That can fail open for direct client updates unless handled with `IS DISTINCT FROM` or `COALESCE`. The frontend/a11y plan is solid.

## Strengths

- Good phase split: migration/test work, UI/a11y work, then validation/deploy checks.
- `CREATE OR REPLACE` preserves trigger function OIDs, which is the right migration shape.
- Transaction-local `set_config(..., true)` is the right pooling-safe direction; PostgreSQL scopes it to the current transaction.
- Immutable profile fields remain outside the trusted-context gate.
- `CardTitle asChild` matches the repo's existing `Button`/`Badge` Radix `Slot.Root` pattern.
- Heading tests already assert `getByRole('heading', { level: 2 })`, so UIDN-06 has a meaningful validator.

## Concerns

- **HIGH:** `IF current_setting('app.trusted_profile_update', true) != 'on' THEN` is unsafe if the setting is absent. PostgreSQL returns `NULL` for absent settings with `missing_ok=true`; use `IS DISTINCT FROM 'on'` or `COALESCE(..., '') <> 'on'`. (See divergence note in Consensus — for *custom* GUCs Postgres returns `''`, not NULL.)
- **HIGH:** The RPC success test may not prove the trusted path if `memberUser` already has `mfa_verified=true` and `guild_member=true`. A no-op protected-column update can pass even if the GUC bypass is broken.
- **HIGH:** The GUC approach blocks direct PostgREST table updates from setting the flag, but the trust boundary becomes `update_profile_after_auth`. If that RPC is executable by ordinary authenticated clients and trusts caller-supplied `p_mfa_verified` / `p_guild_member`, this phase closes `is_admin` direct escalation but may still leave 2FA/guild-state spoofing through the RPC.
- **MEDIUM:** Cleanup only restoring `mfa_verified` and `guild_member` is insufficient. The red-state `is_admin=true` direct-update test can leave `memberUser` admin unless `is_admin=false` is restored.
- **MEDIUM:** `guild_member` is protected but not directly tested. The test should cover all protected columns changed by this trigger branch.
- **MEDIUM:** Plan 03 mixes local and linked/production commands. `db push` is remote by default; `db lint --linked` lints the linked project, not the local stack.
- **LOW:** Grep gates are useful but brittle. If built-ins are fully qualified as `pg_catalog.set_config`, the proposed "contains `PERFORM set_config`" gate may false-fail.

## Suggestions

- Implement the gate as `IF pg_catalog.current_setting('app.trusted_profile_update', true) IS DISTINCT FROM 'on' THEN ...`.
- In the RPC test, first use service-role to set `mfa_verified=false` and/or `guild_member=false`, then call `update_profile_after_auth(... true ...)`, assert `error` is null, and read the row back to confirm protected values changed.
- Add a post-RPC direct update attempt using the same authed client and expect rejection (proves the transaction-local flag did not leak across HTTP requests).
- Reset `memberUser` in `beforeEach`/`afterEach`, including `is_admin=false`, `mfa_verified=true`, `guild_member=true`.
- Parameterize direct protected-column rejection tests for `is_admin`, `mfa_verified`, `guild_member`.
- Split Plan 03 into local validation and production release (explicit normal-order `supabase db push --linked` + `db lint --linked --fail-on warning` + smoke).
- Explicitly document or fix `update_profile_after_auth` grants; if it is a trusted server path, consider revoking public/authenticated execute and routing through an Edge Function that validates Discord state server-side.

## Risk Assessment

**HIGH as written.** Once the gate null-handling and the RPC/direct tests are strengthened, the implementation risk drops substantially; the remaining larger risk is whether `update_profile_after_auth` itself is a trustworthy boundary.

---

## Gemini Review

### 1. Summary
The plans are well-structured and align with the "debt-zero" mandate of v1.4. The transition to a session-GUC trusted-context flag is the correct architectural choice for Supabase/PostgREST environments. The UI plan correctly employs Radix polymorphism to resolve the heading hierarchy. However, a critical logic flaw in the SQL gate implementation must be addressed.

### 2. Strengths
- **Regression-First Engineering**: Plan 19-01 includes a specific regression test (`profile-trigger-gate.test.ts`) to prove the fix.
- **Transaction-Local Scoping**: `is_local=true` for `set_config` ensures the GUC is cleared on `COMMIT`/`ROLLBACK`, preventing poisoned connections under PgBouncer.
- **Polymorphic Restoration**: `asChild` for `CardTitle` is the idiomatic shadcn/ui approach.
- **Security Best Practices**: `SECURITY DEFINER` + `SET search_path = ''` maintains hardening standards.

### 3. Concerns
- **HIGH: SQL Null Logic Bypass**: `current_setting('...', true) != 'on'` — if missing, `current_setting` returns `NULL`, `NULL != 'on'` is `NULL`, treated as FALSE in `IF`, so the gate block is skipped on direct client updates, **leaving the privilege escalation path open.** (See divergence note — contested for custom GUCs.)
- **MEDIUM: Radix Slot Export**: Plan refers to `Slot.Root`. Standard export from `@radix-ui/react-slot` is `Slot`. Verify the project's import.
- **MEDIUM: Function Overloading**: `CREATE OR REPLACE` overloads (rather than replaces) if the parameter list changed since migration 14, potentially leaving the vulnerable version active.
- **LOW: Package Naming**: Verify `radix-ui` vs scoped `@radix-ui/react-slot` in `package.json`.

### 4. Suggestions
- Fix the gate with `IS DISTINCT FROM` or `COALESCE(current_setting(..., true), '') != 'on'`.
- Schema-qualify `pg_catalog.set_config` / `pg_catalog.current_setting` given `search_path=''`.
- Verify `Slot` import in `card.tsx`.
- Add a test for a non-protected column (e.g. `display_name`) to prove normal updates still work when the GUC is absent.

### 5. Risk Assessment: MEDIUM
Architecturally sound; the `NULL` logic issue is a silent failure that would persist the vulnerability. Once corrected to `IS DISTINCT FROM`, risk drops to **LOW**. UI changes are low-risk. **Verification Note**: success hinges on the integration test failing *before* the fix and passing *after* — ensure the runner hits the local DB, not cached state.

---

## Cursor Review

# Cross-AI Plan Review: Phase 19 — DB Migration + A11y Restore

## 1. Summary

The three plans are **well-aligned with the codebase and locked decisions (D-01–D-07)**. Migration 15 correctly targets the real bug in migration 14 (`IF current_user = session_user` is never true inside a `SECURITY DEFINER` trigger), the transaction-local GUC pattern matches an existing repo precedent (`app.e2e_seed_allowed` in `e2e/fixtures/seed.sql`), and the UI work mirrors `button.tsx` / `badge.tsx` exactly. The main gaps are **documentation/acceptance drift** (SC2 vs local-only push), a **misleading afterAll comment** (service role bypasses trigger via the `WHEN` clause, not RLS), and **incomplete regression coverage** (`guild_member` and allowed-column paths).

## 2. Strengths

- **Correct root-cause analysis** — migration 14's inverted gate: protected checks run only when `current_user = session_user`, but in the trigger `current_user` is always the definer owner and `session_user` is `authenticated`, so the block never runs.
- **GUC design matches constraints.** Transaction-local `set_config(..., true)` + `current_setting(..., missing_ok=true)` + `!= 'on'` gate is the right pairing.
- **Precedent in-repo.** `app.e2e_seed_allowed` already uses the same `current_setting(..., true) IS DISTINCT FROM 'true'` pattern in seed SQL.
- **Migration hygiene.** `CREATE OR REPLACE`, no `DROP FUNCTION`, `SET search_path = ''`, grep gates.
- **Regression test would catch the bug.** Direct `authed` update succeeds today; post-fix must error. RED pre-push, GREEN post-push.
- **Admin paths won't break.** `demote_admin_guarded` is `SECURITY INVOKER`, revoked from `authenticated`; trigger `WHEN` limits firing to `role = authenticated`.
- **UIDN-06 plan is minimal and conventional.**
- **Threat model is substantive** (T-19-02 GUC via PostgREST, T-19-03 PgBouncer/`is_local`, T-19-05 OID/CREATE OR REPLACE).

## 3. Concerns

| Severity | Concern |
|----------|---------|
| **MEDIUM** | **SC2 vs Plan 19-03 scope.** ROADMAP SC2 says migration "deploys to production" with zero new advisor WARNs. Plan 19-03 applies via **local** push and runs `db lint --linked`. Phase closure must not treat local push alone as satisfying SC2 unless verification explicitly defers prod to milestone ship. |
| **MEDIUM** | **`afterAll` cleanup rationale is wrong in the plan text.** Plan says service role "bypasses the trigger." Service role bypasses **RLS**, not triggers. Cleanup works because the trigger `WHEN (current_setting('role') = 'authenticated')` means service-role JWT updates **do not fire** the trigger. Wrong mental model risks a future broken teardown. |
| **MEDIUM** | **Incomplete protected-column coverage.** Plan tests `mfa_verified` and `is_admin` only; `guild_member` is in the same guarded set and is auth-flow critical. |
| **LOW** | **No test that benign self-updates still work** (`discord_username` / `avatar_url` via `authed` should still succeed). |
| **LOW** | **19-01 must_haves wording (line 18)** says trigger checks `current_setting(...) = 'on'`; implementation uses `!= 'on'`. Acceptance text is ambiguous. |
| **LOW** | **Stale STATE.md framing** still claims protected-column branch is "likely dead" — contradicted by RLS policy + trigger enforcement. |
| **LOW** | **Plan 19-03 lint verify inconsistency** — action uses `db lint --linked`; automated verify uses `db lint` without `--linked`. |
| **LOW** | **Wave 1 RED tests** — CI on a branch before 19-03 could fail unless workflow gates integration on migration apply. |

**Security-specific (addressed, residuals noted):**

| Severity | Concern |
|----------|---------|
| **LOW** | Treat GUC name as a **single-writer contract** (only `update_profile_after_auth`); any future `SECURITY DEFINER` fn exposing `set_config` on the same GUC reopens the path. |
| **LOW** | `!= 'on'` vs empty string — **correct**: unset GUC → `''` → enforcement runs. |
| **LOW** | PgBouncer transaction pooling — `is_local=true` is the right mitigation. |

## 4. Suggestions

- Clarify SC2 in 19-03 verification (prod deploy satisfied at milestone ship; Phase 19 proves local apply + lint + integration + smoke).
- Fix afterAll documentation: restore via `serviceRole` because trigger `WHEN` excludes `service_role`, not because triggers are bypassed.
- Add fourth integration case: direct `authed` UPDATE to `guild_member: false` → same error pattern.
- Add fifth case: `authed` UPDATE `{ discord_username }` only → `error === null` (proves gate doesn't block allowed columns).
- Align 19-01 acceptance line 18 with D-02.
- Make 19-03 lint command consistent.
- Phase verify checklist: explicit "prod migration applied" row separate from "local migration applied."

## 5. Risk Assessment

**Overall: MEDIUM (implementation LOW, verification/closure MEDIUM)**

- **Implementation risk is LOW.** Small SQL change following migration 14 patterns; admin/service-role paths unlikely to regress.
- **Security closure risk is LOW** once migration 15 is applied: GUC approach is sound for PostgREST; transaction-local scope addresses pooling; inverted `!= 'on'` handles unset GUC correctly with `missing_ok=true`. The integration test **would have caught** the original bug.
- **Verification/closure risk is MEDIUM** because (1) SC2 prod wording not executed in 19-03, (2) coverage skips `guild_member` and allowed-column sanity, (3) misleading afterAll/docs.

**GUC direct answers:** sound; client cannot set GUC via normal supabase-js APIs; transaction-local holds under PgBouncer; inverted logic handles `search_path=''` and empty `current_setting` correctly (`'' != 'on'` runs checks).

---

## Consensus Summary

### Agreed Strengths (2+ reviewers)
- Correct root-cause fix for migration 14's inverted `current_user = session_user` gate.
- Transaction-local `set_config(..., is_local=true)` is the right pooling-safe (PgBouncer) mechanism.
- `CREATE OR REPLACE` migration shape preserves function OIDs / matches Phase 14 hygiene (`SET search_path = ''`, no `DROP`, grep gates).
- `CardTitle asChild` Radix polymorphism is the idiomatic shadcn/ui fix for UIDN-06, with existing `getByRole('heading', { level: 2 })` assertions as a validator.
- Regression-first design: the integration test is RED pre-fix, GREEN post-fix, and would have caught the original bypass.

### Agreed Concerns (raised by 2+ reviewers)
- **Incomplete protected-column test coverage** (codex + cursor, MEDIUM): `guild_member` is in the guarded set but not directly tested; add a `guild_member` rejection case and an allowed-column (`discord_username`) sanity case.
- **SC2 / production-deploy gap** (codex + cursor, MEDIUM): Plan 19-03 applies the migration locally and lints `--linked`; phase closure must not mark SC2 (prod deploy) done from local push alone. CONTEXT already accepts normal ship order with no users — so this is a closure-tracking item, not a blocker.
- **`db push` / `db lint` local-vs-linked command inconsistency in Plan 19-03** (codex + cursor, MEDIUM/LOW).
- **Defensive null-safety hardening** (codex + gemini, raised HIGH; see divergence): adopt `IS DISTINCT FROM 'on'` and `pg_catalog.`-qualify the GUC built-ins regardless of the divergence outcome — it is strictly safer and matches the in-repo precedent.

### Divergent Views — REQUIRES ADJUDICATION (resolved below)
- **The "SQL NULL bypass" HIGH (codex + gemini) vs cursor's "correct as written."**
  Codex and gemini both flag `current_setting('app.trusted_profile_update', true) != 'on'` as a fail-open HIGH, claiming an unset setting returns `NULL`, and `NULL != 'on'` → `NULL` → gate skipped. Cursor explicitly disagrees, stating that for a *custom* run-time parameter the three-arg `missing_ok=true` form returns the **empty string `''`** (not NULL), so `'' != 'on'` → TRUE → the gate fires correctly when the flag is absent.

  **Adjudication (verified against the repo): cursor is correct for this case.** The project already relies on exactly this behavior at `e2e/fixtures/seed.sql:30` — `current_setting('app.e2e_seed_allowed', true) IS DISTINCT FROM 'true'` works precisely because an unset *custom* GUC yields `''`, and the seed has shipped functioning. The NULL-return behavior codex/gemini cite applies to certain recognized built-in parameters, not to unrecognized custom `app.*` GUCs. Therefore the plan's `!= 'on'` logic does **not** fail open, and this is **not a confirmed open HIGH**.

  However, the recommended remediation (`IS DISTINCT FROM 'on'` + `pg_catalog.` qualification) is still worth adopting: it is behaviorally identical for the safe case, defends against any environment edge case, and matches the existing `IS DISTINCT FROM` precedent in seed.sql. Recommended as a MEDIUM hardening, not a blocker.

- **`Slot.Root` vs `Slot` import (gemini).** Gemini flags `Slot.Root` as possibly wrong (standard export is `Slot`). Codex and cursor both observe the repo's existing `button.tsx`/`badge.tsx` already use the `Slot.Root` form (newer `radix-ui` umbrella package convention), so this matches local convention. Low risk — executor should mirror the existing components; the grep/build gate will catch a genuine mismatch.

### Genuinely Open HIGH Concerns
Two HIGHs raised by codex are NOT contested by the other reviewers and remain open as written:

1. **Weak RPC success-path proof (codex, HIGH).** If `memberUser` already has `mfa_verified=true`/`guild_member=true`, the RPC "trusted path" test is a no-op write that passes even if the GUC bypass is broken. The test must first flip the protected values to a different state via service-role, then call `update_profile_after_auth(...)`, and read back to confirm the change actually took effect. This is a test-validity gap that undermines the DBHY-05 proof.

2. **`update_profile_after_auth` trust-boundary residual (codex, HIGH; cursor LOW-as-residual).** Closing direct PostgREST escalation shifts the entire trust boundary onto the RPC. If `update_profile_after_auth` is executable by ordinary authenticated clients and trusts caller-supplied `p_mfa_verified` / `p_guild_member`, a member could still spoof 2FA / guild state through the RPC. The plan should explicitly document the RPC's grants and the source of truth for those fields (server-derived vs caller-supplied), or route through an Edge Function that validates Discord state server-side. Cursor treats the GUC-name single-writer contract as LOW residual, but codex's framing of the RPC body trusting its own arguments is a distinct, unaddressed escalation surface.

Both are **test/verification and trust-boundary hardening items**, addressable within the phase. Neither is a confirmed code defect that fails the migration, but both leave the security proof incomplete as planned.
