---
phase: 03-response-integrity
reviewed: 2026-04-07T14:30:00Z
depth: deep
iteration: 2
files_reviewed: 14
files_reviewed_list:
  - .env.example
  - .husky/pre-commit
  - src/__tests__/auth/auth-error-page.test.tsx
  - src/__tests__/auth/auth-provider.test.tsx
  - src/__tests__/auth/callback-behavior.test.tsx
  - src/__tests__/integrity/rate-limit-edge-function.test.ts
  - src/__tests__/integrity/rate-limit-toast.test.tsx
  - src/components/auth/AuthErrorPage.tsx
  - src/contexts/AuthContext.tsx
  - src/lib/auth-helpers.ts
  - src/lib/types/database.types.ts
  - src/routes/auth/error.tsx
  - supabase/functions/submit-vote/index.ts
  - supabase/migrations/00000000000003_guild_membership.sql
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 03: Code Review Report (Iteration 2)

**Reviewed:** 2026-04-07T14:30:00Z
**Depth:** deep
**Files Reviewed:** 14
**Status:** issues_found

## Summary

This is the second review iteration following fixes for CR-01, WR-01, WR-02, WR-03, and WR-04 from iteration 1. All five prior issues are confirmed resolved:

- **CR-01 FIXED:** `database.types.ts` now includes `guild_member` in profiles Row, Insert, and Update types, plus `p_guild_member` in the RPC function args.
- **WR-01 FIXED:** `callbackInProgress` deduplication guard added to `auth-helpers.ts` with `finally` cleanup.
- **WR-02 FIXED:** `VALID_REASONS` array with `includes()` check in `src/routes/auth/error.tsx` validates the `reason` search param at runtime, defaulting to `'auth-failed'`.
- **WR-03 FIXED:** Explicit `console.error` and fail-closed return when `VITE_WTCS_GUILD_ID` is missing in `auth-helpers.ts:102-107`.
- **WR-04 FIXED:** `submit-vote/index.ts:73` now selects `'guild_member, mfa_verified'` and checks both at line 77.

However, the WR-04 fix introduced a regression in an existing source-analysis test, and the WR-01 deduplication guard has a semantic issue where concurrent callers receive a false `success: true`.

Cross-file analysis was performed tracing `handleAuthCallback` call chains (AuthContext -> auth-helpers, callback route -> auth-helpers), `useVoteSubmit` -> submit-vote Edge Function, and the Profile type flow (database.types.ts -> suggestions.ts -> AuthContext.tsx).

## Warnings

### WR-01: Test regression from WR-04 fix -- select string mismatch breaks source-analysis test

**File:** `src/__tests__/integrity/rate-limit-edge-function.test.ts:45`
**Issue:** The test at line 45 uses `submitVoteSource.indexOf(".select('guild_member')")` to locate the guild membership check in the Edge Function source. The WR-04 fix changed `submit-vote/index.ts:73` from `.select('guild_member')` to `.select('guild_member, mfa_verified')`. The `indexOf` call now returns `-1`, causing `expect(guildCheckLine).toBeGreaterThan(-1)` to fail. This test is broken by the iteration-1 fix.
**Fix:**
```typescript
// Line 45: Update the search string to match the new select query
const guildCheckLine = submitVoteSource.indexOf(".select('guild_member, mfa_verified')")
```

### WR-02: Deduplication guard returns success: true without verification

**File:** `src/lib/auth-helpers.ts:19`
**Issue:** When `callbackInProgress` is `true` (a concurrent call is already executing), the function returns `{ success: true }` immediately without performing any 2FA or guild membership verification. The second caller (e.g., the callback route component at `src/routes/auth/callback.tsx:18`) receives a "success" result and navigates to `/`. If the first call ultimately fails and signs the user out, the second caller has already acted on a false positive. In practice, the `onAuthStateChange` result in `AuthContext` controls actual auth state, so the user gets signed out shortly after -- but there is a brief window where the callback route navigates to `/` before the sign-out takes effect.
**Fix:** Use a shared promise so both callers receive the real result:
```typescript
let callbackPromise: Promise<AuthCallbackResult> | null = null

export async function handleAuthCallback(): Promise<AuthCallbackResult> {
  if (callbackPromise) return callbackPromise
  callbackPromise = executeAuthCallback()
  try {
    return await callbackPromise
  } finally {
    callbackPromise = null
  }
}

async function executeAuthCallback(): Promise<AuthCallbackResult> {
  // ... existing try/catch/finally logic (without the callbackInProgress guard)
}
```
This ensures both callers get the same real result without double-executing the verification.

## Info

### IN-01: Test suite does not reset module-level callbackInProgress state

**File:** `src/__tests__/auth/callback-behavior.test.tsx`
**Issue:** The `callbackInProgress` module-level variable in `auth-helpers.ts` is not explicitly reset between tests. Currently this works because every test `await`s `handleAuthCallback()` to completion (reaching the `finally` block). However, if a test were to time out or throw during execution without completing the `finally` block, the variable would remain `true` and silently cause all subsequent tests in the suite to return `{ success: true }` without verification -- making test failures invisible.
**Fix:** If adopting the shared-promise approach from WR-02, this concern is resolved. Otherwise, export a test-only reset function:
```typescript
// In auth-helpers.ts
export function __resetCallbackStateForTests() { callbackInProgress = false }

// In test beforeEach
beforeEach(() => { __resetCallbackStateForTests() })
```

---

_Reviewed: 2026-04-07T14:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
