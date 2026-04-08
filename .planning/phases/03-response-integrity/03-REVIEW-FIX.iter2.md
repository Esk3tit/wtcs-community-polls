---
phase: 03-response-integrity
fixed_at: 2026-04-07T12:30:00Z
review_path: .planning/phases/03-response-integrity/03-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-04-07T12:30:00Z
**Source review:** .planning/phases/03-response-integrity/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5
- Fixed: 5
- Skipped: 0

## Fixed Issues

### CR-01: `database.types.ts` missing `guild_member` column -- type-safety gap

**Files modified:** `src/lib/types/database.types.ts`
**Commit:** a9bad7c
**Applied fix:** Added `guild_member: boolean` to the profiles Row type, `guild_member?: boolean` to Insert and Update types, and `p_guild_member?: boolean` to the `update_profile_after_auth` RPC Args. This aligns the generated types with the `00000000000003_guild_membership.sql` migration.

### WR-01: Dual `handleAuthCallback` call sites risk double execution

**Files modified:** `src/lib/auth-helpers.ts`
**Commit:** b6313d2
**Applied fix:** Added a module-level `callbackInProgress` deduplication flag with a `try/finally` block in `handleAuthCallback()`. If a second call arrives while the first is in progress, it returns `{ success: true }` immediately, preventing duplicate Discord API calls and race conditions between the AuthContext listener and the callback route.

### WR-02: Unsafe type assertion on error route search params

**Files modified:** `src/routes/auth/error.tsx`
**Commit:** 919e493
**Applied fix:** Replaced the unsafe `as` type assertion with runtime validation using a `VALID_REASONS` const array and `Array.includes()` check. Invalid `reason` values now fall back to `'auth-failed'` at the `validateSearch` boundary. Removed the downstream `as` cast on the `AuthErrorPage` prop since TypeScript now infers the correct union type.

### WR-03: Silent login block when `VITE_WTCS_GUILD_ID` env var is missing

**Files modified:** `src/lib/auth-helpers.ts`
**Commit:** df9f2cc
**Applied fix:** Replaced silent `|| ''` fallback with an explicit check. When `VITE_WTCS_GUILD_ID` is falsy, the function now logs `console.error('VITE_WTCS_GUILD_ID is not configured...')`, signs out the user, and returns `{ success: false, reason: 'auth-failed' }`. This preserves fail-closed behavior while making the root cause immediately visible in console logs.

### WR-04: Submit-vote Edge Function does not verify `mfa_verified` at submission time (fixed: requires human verification)

**Files modified:** `supabase/functions/submit-vote/index.ts`
**Commit:** edb7adf
**Applied fix:** Extended the profile select from `'guild_member'` to `'guild_member, mfa_verified'` and updated the guard condition to check both fields: `!profile?.guild_member || !profile?.mfa_verified`. Updated the error message to the generic "Your account does not meet the requirements to respond" to cover both failure cases. This is a logic change implementing defense-in-depth -- human verification recommended to confirm this matches the desired security posture.

## Skipped Issues

None -- all findings were fixed.

---

_Fixed: 2026-04-07T12:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
