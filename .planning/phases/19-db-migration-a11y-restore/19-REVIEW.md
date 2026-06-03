---
phase: 19-db-migration-a11y-restore
reviewed: 2026-06-03T00:00:00Z
depth: deep
files_reviewed: 7
files_reviewed_list:
  - e2e/integration/profile-trigger-gate.test.ts
  - src/__tests__/admin/admins-tab.test.tsx
  - src/__tests__/admin/categories-tab.test.tsx
  - src/components/admin/AdminsList.tsx
  - src/components/admin/CategoriesList.tsx
  - src/components/ui/card.tsx
  - supabase/migrations/00000000000015_trusted_profile_update_guc.sql
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-06-03
**Depth:** deep
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Two themes reviewed: (1) DBHY-05 migration 15 GUC-based gate for `profile_self_update_allowed`, and (2) UIDN-06 polymorphic `CardTitle`.

**Security verdict (DBHY-05):** The core security fix is correct and closes the privilege-escalation path. I traced the full chain: RLS (`migration 01`) permits an `authenticated` user to UPDATE their own profile row (`id = auth.uid()`); the BEFORE-UPDATE trigger fires `WHEN (current_setting('role') = 'authenticated')` (`migration 02`); the new GUC gate (`pg_catalog.current_setting('app.trusted_profile_update', true) IS DISTINCT FROM 'on'`) correctly evaluates to TRUE on the direct-client path (flag absent → `''` via missing_ok) and FALSE only inside `update_profile_after_auth`, which sets the transaction-local flag via `pg_catalog.set_config(..., true)` before its UPDATE. `is_local=true` auto-clears on commit/rollback, so no cross-request leak under PgBouncer transaction pooling. `search_path = ''` is correctly paired with `pg_catalog.`-qualified built-ins and `auth.uid()`/`public.profiles` qualification. The REVOKE FROM PUBLIC + GRANT TO authenticated boundary is sound (`anon` loses an RPC it could not usefully call anyway, since `auth.uid()` would be null → `NOT FOUND`). No BLOCKER-level defects found in the migration.

**A11y verdict (UIDN-06):** `CardTitle` polymorphism via `asChild`/`Slot.Root` is sound — it reuses the exact pattern already shipped in `button.tsx` and `badge.tsx` against `radix-ui@1.4.3`. `AdminsList`/`CategoriesList` now emit a native `<h2>`, a genuine accessibility improvement over `<div role="heading" aria-level={2}>`. Tests assert `getByRole('heading', { level: 2 })`.

Findings below are WARNING and INFO: a misleading test rationale comment, a residual trust-boundary gap (documented but worth flagging for tracking), the over-broad GUC bypass (defense-in-depth), and minor quality items.

## Warnings

### WR-01: Integration test comment states an incorrect reason for why serviceRole bypasses the trigger

**File:** `e2e/integration/profile-trigger-gate.test.ts:32-35` (and `48-49`, `95-101`)
**Issue:** The `beforeEach` comment claims: *"serviceRole writes succeed on the GUC-gated path because ... serviceRole bypasses RLS entirely, so it operates as the function owner context where the GUC check does not apply."* This rationale is factually wrong and could mislead a future maintainer into believing RLS-bypass implies trigger-bypass. RLS bypass and trigger execution are orthogonal — a BEFORE-UPDATE trigger fires regardless of RLS. The *actual* reason serviceRole writes succeed is that the trigger is declared `WHEN (current_setting('role') = 'authenticated')` (migration 02, line 44); a `service_role` connection has `current_setting('role') = 'service_role'`, so the trigger **does not fire at all** for serviceRole. The GUC check is never reached, rather than "not applying." This matters: case (e) step 1 flips `mfa_verified`/`guild_member` via serviceRole — that write only succeeds because the trigger is skipped by the WHEN clause; if a maintainer later removed the WHEN clause (e.g., to also gate service writes), this test's setup would start raising `Cannot change mfa_verified via client` and the false rationale would send them hunting in the wrong place.
**Fix:** Correct the comment to cite the trigger's WHEN clause:
```ts
// serviceRole writes skip the trigger because on_profile_self_update is
// declared WHEN (current_setting('role') = 'authenticated'); a service_role
// connection has role='service_role', so the trigger body (and its GUC gate)
// never executes. This is a trigger-WHEN bypass, NOT an RLS bypass.
```

### WR-02: GUC bypass widens trust to is_admin, not just the columns the RPC writes

**File:** `supabase/migrations/00000000000015_trusted_profile_update_guc.sql:86-97`
**Issue:** When the trusted GUC is set, `profile_self_update_allowed` skips **all three** protected-column checks — `is_admin`, `mfa_verified`, and `guild_member`. But `update_profile_after_auth` only ever writes `mfa_verified`, `guild_member`, `discord_username`, `avatar_url` (lines 44-51); it never touches `is_admin`. The bypass is therefore broader than the sole sanctioned writer needs. Today this is not exploitable: the only function that sets the GUC is `update_profile_after_auth`, and that function's `UPDATE` statement does not change `is_admin`, so `NEW.is_admin = OLD.is_admin` and the check would be a no-op anyway. But the gate grants more authority than required — if a future RPC reuses the `app.trusted_profile_update` GUC (or `update_profile_after_auth` is later extended to accept an `is_admin` param), the trigger would silently permit an `is_admin` flip. Defense-in-depth: the `is_admin` guard should remain unconditional like `id`/`discord_id`/`created_at`, since no legitimate self-update RPC has any reason to change it.
**Fix:** Move the `is_admin` check out of the GUC-gated branch into the always-enforced block:
```sql
  -- Always enforce immutable columns regardless of caller
  IF NEW.id != OLD.id THEN RAISE EXCEPTION 'Cannot change profile id'; END IF;
  IF NEW.discord_id != OLD.discord_id THEN RAISE EXCEPTION 'Cannot change discord_id'; END IF;
  IF NEW.created_at != OLD.created_at THEN RAISE EXCEPTION 'Cannot change created_at'; END IF;
  -- is_admin is NEVER set by any self-update RPC; keep it unconditional.
  IF NEW.is_admin != OLD.is_admin THEN RAISE EXCEPTION 'Cannot change is_admin via client'; END IF;

  IF pg_catalog.current_setting('app.trusted_profile_update', true) IS DISTINCT FROM 'on' THEN
    IF NEW.mfa_verified != OLD.mfa_verified THEN RAISE EXCEPTION 'Cannot change mfa_verified ...'; END IF;
    IF NEW.guild_member != OLD.guild_member THEN RAISE EXCEPTION 'Cannot change guild_member ...'; END IF;
  END IF;
```

### WR-03: Residual trust boundary — caller-supplied p_mfa_verified / p_guild_member are not server-validated

**File:** `supabase/migrations/00000000000015_trusted_profile_update_guc.sql:42-51, 112-120`
**Issue:** `update_profile_after_auth` trusts the caller-supplied `p_mfa_verified` and `p_guild_member` booleans verbatim and writes them as authoritative. These are computed **client-side** in `src/lib/auth-helpers.ts` (MFA from the Discord `mfa_enabled` flag, guild membership from `/users/@me/guilds`). An authenticated user can call the RPC directly via PostgREST — now that the GUC path is the only sanctioned writer — and pass `p_mfa_verified: true, p_guild_member: true` regardless of their real Discord state, since the RPC sets the trusted GUC and the trigger then permits the write. DBHY-05 explicitly scopes this as an **accepted residual** (the catalog COMMENT documents it; no live users; pre-existing design). I am flagging it as a WARNING strictly so it remains tracked rather than silently inherited: closing the direct-PostgREST escalation to *arbitrary* columns is done, but `mfa_verified`/`guild_member` self-attestation through the sanctioned RPC remains open. The only durable fix is server-side re-validation (Edge Function calls Discord with the server-held token, or the RPC verifies against a server-trusted source) before writing these flags.
**Fix:** Track as a follow-up. The COMMENT at lines 112-120 already records the residual accurately; no change required for this phase. Recommended long-term: move MFA/guild attestation into an Edge Function that re-fetches `/users/@me` + `/users/@me/guilds` server-side and passes verified booleans to the RPC, then drop the `authenticated` EXECUTE grant in favor of `service_role`-only.

## Info

### IN-01: `discord_username` is mutated unconditionally inside the trusted RPC but the trigger never protected it — confirm intent

**File:** `supabase/migrations/00000000000015_trusted_profile_update_guc.sql:47`
**Issue:** The RPC overwrites `discord_username` on every auth callback. Integration test case (d) confirms `discord_username` is a non-protected column writable directly by the client. So the value can diverge: a client can rename it directly, and the next login overwrites it from Discord. Not a defect — just confirming the column is intentionally non-protected and last-writer-wins.
**Fix:** None required; behavior is consistent and tested.

### IN-02: Test rationale comment in `card.tsx`-consuming components references "pre-migration row density" — borderline plan archaeology

**File:** `src/components/admin/AdminsList.tsx:88-91`, `src/components/admin/CategoriesList.tsx:165-168`
**Issue:** Comments say "keeps its pre-migration row density." Per project convention (CLAUDE.md: "No review-round / phase-ID archaeology in src/ ... WHY-only"), "pre-migration" is a soft temporal reference. The WHY (cancel shadcn Card default padding to preserve row density) is legitimate; "pre-migration" adds nothing and risks reading as rot once the migration is ancient history.
**Fix:** Drop the temporal qualifier: "py-0 / p-0 cancel shadcn Card's default vertical padding so list rows keep their compact density inside the bordered container."

### IN-03: `CardTitle` typed as `React.ComponentProps<"div">` but renders `<h2>` via Slot — heading-specific props not type-checked

**File:** `src/components/ui/card.tsx:32-45`
**Issue:** With `asChild`, the rendered element is whatever child is passed (`<h2>`), but the prop type stays `React.ComponentProps<"div">`. This is the same trade-off accepted in `button.tsx`/`badge.tsx`, so it is consistent with the codebase. Noting only that consumers get `div` prop typings on a heading element; harmless because the heading is supplied as a child, not via props.
**Fix:** None required; matches established shadcn `asChild` pattern in this repo.

### IN-04: Integration test file lives under `e2e/integration/` but is a Vitest spec, not Playwright

**File:** `e2e/integration/profile-trigger-gate.test.ts:20-21`
**Issue:** The spec imports from `vitest` and from `./helpers` (a Vitest-only integration helper). It is correctly Vitest, but its location under `e2e/` (which CLAUDE.md describes as "Playwright E2E ... outside src/") could mislead. The helper file comment already clarifies "Vitest-only integration helpers — no Playwright imports." Pure organizational nit.
**Fix:** None required; the helper header documents the distinction. Optionally relocate `e2e/integration/` specs under a clearly Vitest-scoped path if the team wants stricter separation.

---

_Reviewed: 2026-06-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
