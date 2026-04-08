---
phase: 03-response-integrity
reviewed: 2026-04-07T12:00:00Z
depth: deep
files_reviewed: 13
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
  - src/routes/auth/error.tsx
  - supabase/functions/submit-vote/index.ts
  - supabase/migrations/00000000000003_guild_membership.sql
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-04-07T12:00:00Z
**Depth:** deep
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 03 adds Discord guild membership verification at login time and per-user rate limiting via Upstash Redis in the submit-vote Edge Function. The security architecture is well-designed: fail-closed behavior is consistent throughout auth-helpers.ts, the submit-vote function enforces guild membership at submission time (not just login), rate limiting is positioned before body parsing, and the migration correctly blocks client-side writes to `guild_member` via the trigger guard. Test coverage for fail-closed behavior is thorough.

One critical issue was found: the TypeScript `database.types.ts` has not been regenerated after the migration that adds the `guild_member` column, creating a type-safety gap across the codebase. Four warnings cover a race between dual `handleAuthCallback` call sites, an unsafe type assertion on the error route, a silent failure mode when the guild ID env var is missing, and a missing `mfa_verified` check in the Edge Function's submission-time enforcement.

## Critical Issues

### CR-01: `database.types.ts` missing `guild_member` column -- type-safety gap

**File:** `src/lib/types/database.types.ts:151-183`
**Issue:** The migration `00000000000003_guild_membership.sql` adds `guild_member BOOLEAN NOT NULL DEFAULT FALSE` to the `profiles` table, but `database.types.ts` has not been regenerated. The `Profile` type (re-exported via `src/lib/types/suggestions.ts` and used in `AuthContext.tsx`) does not include `guild_member`. This means:
- TypeScript will not catch any misspelling of `guild_member` in client code
- The `profile` object in `AuthContext` will have the field at runtime (from Supabase `select('*')`) but TypeScript won't know about it
- Any future code trying to read `profile.guild_member` will get a compile error despite working at runtime

**Fix:** Regenerate types after applying the migration:
```bash
npx supabase gen types typescript --local > src/lib/types/database.types.ts
```

The `Row` type for `profiles` should then include:
```typescript
guild_member: boolean
```

## Warnings

### WR-01: Dual `handleAuthCallback` call sites risk double execution

**File:** `src/contexts/AuthContext.tsx:68-69` and `src/routes/auth/callback.tsx:18`
**Issue:** `handleAuthCallback()` is called from two independent locations:
1. `AuthContext.tsx` line 69: inside `onAuthStateChange` when `event === 'SIGNED_IN' && newSession?.provider_token`
2. `callback.tsx` line 18: on mount of the `/auth/callback` route

Currently `signInWithDiscord` uses `redirectTo: window.location.origin` (root), so the normal flow triggers path 1 only. However, Supabase config (`supabase/config.toml` line 17) lists `http://localhost:5173/auth/callback` as an additional redirect URL. If anyone changes `redirectTo` to include `/auth/callback`, or if Supabase falls back to the site URL during the OAuth flow, both paths fire: the callback route calls `handleAuthCallback()` AND `onAuthStateChange` fires `SIGNED_IN` with `provider_token`, causing two Discord API calls, two RPC calls, and a race condition on sign-out.

**Fix:** Add a guard in `callback.tsx` to skip its own `handleAuthCallback` call since `AuthContext` already handles it, or add a module-level deduplication flag:
```typescript
// In auth-helpers.ts -- add deduplication
let callbackInProgress = false
export async function handleAuthCallback(): Promise<AuthCallbackResult> {
  if (callbackInProgress) return { success: true } // Already running
  callbackInProgress = true
  try {
    // ... existing logic
  } finally {
    callbackInProgress = false
  }
}
```

### WR-02: Unsafe type assertion on error route search params

**File:** `src/routes/auth/error.tsx:13`
**Issue:** The `reason` search param is cast with `as '2fa-required' | 'session-expired' | 'auth-failed' | 'not-in-server'` without runtime validation. A user can navigate to `/auth/error?reason=xss-payload` and the value passes through unchecked. While `AuthErrorPage` has a fallback (`errorConfig[reason] || errorConfig['auth-failed']` on line 47), the `reason` prop type is declared as a strict union, so TypeScript trusts the assertion and won't catch invalid values.

**Fix:** Validate in `validateSearch`:
```typescript
const VALID_REASONS = ['2fa-required', 'session-expired', 'auth-failed', 'not-in-server'] as const
type ErrorReason = typeof VALID_REASONS[number]

export const Route = createFileRoute('/auth/error')({
  validateSearch: (search: Record<string, unknown>): { reason: ErrorReason } => ({
    reason: VALID_REASONS.includes(search.reason as ErrorReason)
      ? (search.reason as ErrorReason)
      : 'auth-failed',
  }),
  component: AuthErrorRoute,
})
```

### WR-03: Silent login block when `VITE_WTCS_GUILD_ID` env var is missing

**File:** `src/lib/auth-helpers.ts:96`
**Issue:** `const WTCS_GUILD_ID = import.meta.env.VITE_WTCS_GUILD_ID || ''` silently falls back to empty string. If the env var is not set (e.g., missing from deployment config), no guild ID will ever match, and ALL users will be rejected with `not-in-server` -- with no error log indicating the env var is the root cause. This is fail-closed (good for security) but makes debugging very difficult.

**Fix:** Add an explicit check with a descriptive error:
```typescript
const WTCS_GUILD_ID = import.meta.env.VITE_WTCS_GUILD_ID
if (!WTCS_GUILD_ID) {
  console.error('VITE_WTCS_GUILD_ID is not configured. All guild membership checks will fail.')
  await supabase.auth.signOut()
  return { success: false, reason: 'auth-failed' }
}
```

### WR-04: Submit-vote Edge Function does not verify `mfa_verified` at submission time

**File:** `supabase/functions/submit-vote/index.ts:71-76`
**Issue:** The Edge Function checks `profile.guild_member` at submission time (line 77) but does not check `profile.mfa_verified`. The auth callback verifies MFA at login and sets `mfa_verified = true` in the profile, but if a user later disables 2FA on Discord, their existing session remains valid and `mfa_verified` stays `true` in the DB until the next login. This is acceptable as a design decision (MFA is verified per-login, not per-submission), but it creates an asymmetry with the guild membership enforcement pattern. If the intent is defense-in-depth, `mfa_verified` should also be checked at submission time.

**Fix:** If defense-in-depth is desired, add `mfa_verified` to the profile select:
```typescript
const { data: profile } = await supabaseAdmin
  .from('profiles')
  .select('guild_member, mfa_verified')
  .eq('id', user.id)
  .single()

if (!profile?.guild_member || !profile?.mfa_verified) {
  return new Response(
    JSON.stringify({ error: 'Your account does not meet the requirements to respond' }),
    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
```

## Info

### IN-01: `.env.example` missing `VITE_WTCS_GUILD_ID` documentation

**File:** `.env.example:3`
**Issue:** The `VITE_WTCS_GUILD_ID=` line has no comment explaining what value to put there or where to find it, unlike the other env vars which have placeholder values. New developers won't know this is the Discord server/guild ID.

**Fix:** Add a descriptive comment:
```
# Discord server (guild) ID for WTCS membership verification
# Find in Discord: Server Settings > Widget > Server ID, or right-click server name > Copy Server ID
VITE_WTCS_GUILD_ID=your-discord-guild-id-here
```

### IN-02: Rate limit source analysis tests are brittle

**File:** `src/__tests__/integrity/rate-limit-edge-function.test.ts:18-46`
**Issue:** These tests read the Edge Function source code as a string and assert on substring presence (e.g., `expect(submitVoteSource).toContain("slidingWindow(5, '60 s')")`). While creative for verifying structural properties without running Deno, any refactoring of the Edge Function code (renaming variables, reformatting, adding comments between tokens) will break these tests even if behavior is unchanged. This is a maintenance concern, not a correctness issue.

**Fix:** Accept as a known trade-off and add a comment in the test file explaining the brittleness and why it's chosen over integration tests (Deno runtime not available in Vitest). Consider adding a note about updating these tests when refactoring the Edge Function.

---

_Reviewed: 2026-04-07T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
