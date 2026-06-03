---
phase: 19-db-migration-a11y-restore
fixed_at: 2026-06-03T00:00:00Z
review_path: .planning/phases/19-db-migration-a11y-restore/19-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 2
skipped: 1
status: partial
---

# Phase 19: Code Review Fix Report

**Fixed at:** 2026-06-03
**Source review:** .planning/phases/19-db-migration-a11y-restore/19-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03)
- Fixed: 2 (WR-01, WR-02)
- Skipped: 1 (WR-03 — accepted residual, won't-fix this phase)

## Fixed Issues

### WR-01: Integration test comment states an incorrect reason for why serviceRole bypasses the trigger

**Files modified:** `e2e/integration/profile-trigger-gate.test.ts`
**Commit:** 76f000f
**Applied fix:** Replaced the incorrect `beforeEach` rationale ("serviceRole bypasses RLS entirely, so it operates as the function owner context where the GUC check does not apply") with the correct trigger-WHEN explanation: `on_profile_self_update` is declared `WHEN (current_setting('role') = 'authenticated')`, so a `service_role` connection (role='service_role') never executes the trigger body or its GUC gate. The comment now explicitly states this is a trigger-WHEN bypass, NOT an RLS bypass. The other serviceRole references the review cross-cited (afterAll restore at ~48-49 and case (e) ordered proof at ~95-101) do not repeat the false rationale, so no further edits in those spots were needed.

### WR-02: GUC bypass widens trust to is_admin, not just the columns the RPC writes

**Files modified:** `supabase/migrations/00000000000015_trusted_profile_update_guc.sql`
**Commit:** 0d0e03e
**Applied fix:** Moved the `is_admin` immutability check out of the GUC-gated branch and into the always-enforced immutable-columns block, alongside id/discord_id/created_at. `mfa_verified` and `guild_member` remain inside the GUC-gated branch (those are the only columns `update_profile_after_auth` writes). The exception message wording `'Cannot change is_admin via client'` was preserved verbatim so integration test case (b)'s regex (`/is_admin via client/i`) still matches. Function signatures, `search_path`, `pg_catalog` qualification, and the REVOKE/GRANT were left untouched. The `COMMENT ON FUNCTION public.profile_self_update_allowed` body was updated to accurately describe is_admin as unconditional (it previously grouped is_admin with the GUC-gated columns).

**Verification note:** This migration is PL/pgSQL; no standalone parser is available without connecting to the database (forbidden by scope this phase). Tier 1 (re-read) confirmed balanced IF/END IF blocks, intact `$$` delimiters, and the preserved exception message. The orchestrator will re-apply the migration (`supabase db reset`) and re-run the integration suite for full semantic verification.

## Skipped Issues

### WR-03: Residual trust boundary — caller-supplied p_mfa_verified / p_guild_member are not server-validated

**File:** `supabase/migrations/00000000000015_trusted_profile_update_guc.sql:42-51, 112-120`
**Reason:** skipped (won't-fix this phase). The review's own Fix block states: "Track as a follow-up. The COMMENT at lines 112-120 already records the residual accurately; no change required for this phase." This is an accepted residual (tracked as T-19-07), already documented in the migration COMMENT and PROJECT.md. The durable fix (server-side MFA/guild re-validation via an Edge Function, then dropping the `authenticated` EXECUTE grant in favor of `service_role`-only) is out of scope for phase 19. The RPC's trust model and EXECUTE grants were left unchanged.
**Original issue:** `update_profile_after_auth` trusts the caller-supplied `p_mfa_verified` / `p_guild_member` booleans verbatim. An authenticated user can call the RPC directly via PostgREST and self-attest these flags regardless of real Discord state, because the RPC sets the trusted GUC and the trigger then permits the write. DBHY-05 explicitly scopes this as an accepted residual.

---

_Fixed: 2026-06-03_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
