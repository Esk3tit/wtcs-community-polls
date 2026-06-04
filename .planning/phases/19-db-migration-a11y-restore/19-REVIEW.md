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
  warning: 0
  info: 4
  total: 4
status: clean
---

# Phase 19: Code Review Report (Re-review)

**Reviewed:** 2026-06-03T00:00:00Z
**Depth:** deep
**Files Reviewed:** 7
**Status:** clean

## Summary

This is a re-review after a prior fix pass. All three prior Warning findings were
verified resolved (or accepted) against the current on-disk state, and a fresh
adversarial deep pass — including cross-file tracing of the trigger/RPC trust
boundary, column nullability, the trigger `WHEN` clause, the `SECURITY DEFINER`
role-resolution path, and test-mock-vs-component destructuring contracts —
surfaced no new Critical or Warning defects.

Remaining items are all INFO-tier: accepted residuals, intentional design choices,
or patterns that match established in-repo conventions. None are actionable.

### Prior findings — verification of resolution

- **WR-01 (RESOLVED):** `profile-trigger-gate.test.ts:31-35` — the `beforeEach`
  comment now correctly attributes the serviceRole trigger skip to the trigger's
  `WHEN (current_setting('role') = 'authenticated')` clause (a trigger-WHEN bypass,
  not an RLS bypass). Cross-checked against the actual trigger declaration in
  `00000000000002_triggers.sql:41-45` — the `WHEN` clause exists and matches.
- **WR-02 (RESOLVED):** `00000000000015_trusted_profile_update_guc.sql:85-87` — the
  `is_admin` immutability check is in the always-enforced block (outside the
  GUC-gated branch, lines 93-101). Only `mfa_verified`/`guild_member` remain
  GUC-gated. Verified correct.
- **WR-03 (ACCEPTED RESIDUAL, T-19-07):** caller-supplied `p_mfa_verified` /
  `p_guild_member` are not server-revalidated. Documented in the function COMMENT
  (lines 117-125), PROJECT.md, and 19-SECURITY.md. Re-classified below as INFO.

### Deep-pass correctness checks (all PASS, no findings)

- **NULL-safety of unconditional `!=` checks:** `is_admin`, `mfa_verified`,
  `guild_member`, `discord_id`, `created_at` are all `NOT NULL` in
  `00000000000000_schema.sql:29-34` and `00000000000003_guild_membership.sql:8`.
  `!=` therefore cannot evaluate to NULL (which would silently skip a `RAISE`),
  so the immutability/protected checks are sound. The GUC gate itself uses the
  null-safe `IS DISTINCT FROM 'on'`, which is correct for the missing-GUC path.
- **RPC trust path:** `update_profile_after_auth` is `SECURITY DEFINER` but does
  not `SET ROLE`, so `current_setting('role')` stays `'authenticated'` during its
  `UPDATE` — the trigger still fires and relies on the transaction-local
  `app.trusted_profile_update='on'` (is_local=true) flag to skip protected checks.
  Test case (e) proves this end-to-end with a non-no-op precondition flip.
- **GUC leak guard:** `is_local=true` auto-clears on commit; test case (f) proves
  the flag does not leak to a subsequent direct UPDATE on the same pooled client.
- **`CREATE OR REPLACE FUNCTION` preserves trigger binding:** migration 15 replaces
  only the function bodies; the existing `on_profile_self_update` trigger remains
  bound. Correct — no re-`CREATE TRIGGER` needed.
- **Test-mock fidelity:** `categories-tab` mock returns `{ count, error }` matching
  `CategoriesList.handleAskDelete` destructuring; `admins-tab` mock chain
  `from().select().eq().order()` matches `AdminsList.refetch`. `useCategories`
  always returns `refetch` (`useCategories.ts:46`), so component contracts hold.
- **Stale-request guard:** `AdminsList.refetch` uses a `requestSeq` ref to drop
  out-of-order responses; `deferSetState` cleanup cancels the pending timer. No
  setState-after-unmount or race.

## Info

### IN-01: Accepted trust-boundary residual — caller-supplied MFA/guild flags not server-revalidated

**File:** `supabase/migrations/00000000000015_trusted_profile_update_guc.sql:117-125`
**Issue:** `update_profile_after_auth` trusts `p_mfa_verified` / `p_guild_member`,
which are computed client-side in `src/lib/auth-helpers.ts` from Discord OAuth
responses. A determined authenticated caller could invoke the RPC directly with
`p_mfa_verified=true`. This is the documented, accepted residual T-19-07: the
DBHY-05 scope was to close the direct-PostgREST column-escalation path, not to
re-validate Discord state server-side. Recorded in the function COMMENT, PROJECT.md,
and 19-SECURITY.md. No live users.
**Fix:** None required for this phase (accepted residual). Future hardening: have
the Edge Function / RPC re-derive MFA and guild membership from the Discord API
server-side rather than trusting caller-supplied booleans.

### IN-02: "pre-migration" temporal comment in AdminsList / CategoriesList

**File:** `src/components/admin/AdminsList.tsx:88-91`, `src/components/admin/CategoriesList.tsx:165-168`
**Issue:** Both comments reference "pre-migration row density" to explain the
`py-0 / p-0` overrides on the shadcn Card. This is legitimate WHY context (it
explains why the default Card padding is cancelled — to preserve the prior list
row density) rather than a plan/round/phase-ID rot tag, so it does not violate the
CLAUDE.md "no review-round archaeology" rule. The word "pre-migration" is a mild
temporal reference that could read as stale once the migration is long past.
**Fix:** Optional — reword to the timeless rationale, e.g. "cancel shadcn Card's
default vertical padding so list rows keep a compact density inside the bordered
container." Not required.

### IN-03: CardTitle typed as `ComponentProps<"div">` while rendering an `<h2>` via asChild

**File:** `src/components/ui/card.tsx:32-45`
**Issue:** `CardTitle` accepts `React.ComponentProps<"div"> & { asChild?: boolean }`
even though `AdminsList`/`CategoriesList` use `asChild` to render a native `<h2>`.
The prop type does not reflect the heading element. This is the accepted shadcn
`asChild` trade-off — `Slot.Root` forwards props to the child regardless of the
declared `"div"` type, and the consumers correctly supply a real `<h2>` so the
accessibility tree gets a level-2 heading (asserted by both test suites). Behavior
is correct.
**Fix:** None required — matches the established shadcn vendoring pattern. Changing
the generic prop type would diverge from upstream shadcn and offer no runtime benefit.

### IN-04: Vitest integration spec lives under `e2e/`

**File:** `e2e/integration/profile-trigger-gate.test.ts`
**Issue:** This is a Vitest spec (`import ... from 'vitest'`) located under `e2e/`,
which otherwise houses Playwright tests. The file header documents this is an
integration regression test run via the integration harness (not Playwright), and
sibling files (`vote-counts-rls.test.ts`, etc.) follow the same convention. Purely
an organizational nit; no correctness impact.
**Fix:** None required — matches the established `e2e/integration/` convention.

---

_Reviewed: 2026-06-03T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
