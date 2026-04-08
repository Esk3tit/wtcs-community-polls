---
phase: 03-response-integrity
plan: 01
subsystem: auth
tags: [discord, oauth, guilds, guild-membership, edge-functions, supabase, rls]

# Dependency graph
requires:
  - phase: 01-foundation-authentication
    provides: Discord OAuth with 2FA enforcement, auth callback, profiles table, submit-vote Edge Function
provides:
  - Guild membership check at login time via Discord OAuth guilds scope
  - guild_member column on profiles table with SECURITY DEFINER RPC protection
  - Downstream guild_member enforcement in submit-vote Edge Function
  - AuthErrorPage not-in-server variant with Discord invite link
  - Comprehensive guild check test coverage (8 tests for all failure modes)
affects: [04-admin, 05-launch]

# Tech tracking
tech-stack:
  added: []
  patterns: [url-aware-fetch-mocking, fail-closed-guild-check, downstream-enforcement]

key-files:
  created:
    - supabase/migrations/00000000000003_guild_membership.sql
  modified:
    - src/lib/auth-helpers.ts
    - src/contexts/AuthContext.tsx
    - src/components/auth/AuthErrorPage.tsx
    - src/routes/auth/error.tsx
    - supabase/functions/submit-vote/index.ts
    - src/__tests__/auth/callback-behavior.test.tsx
    - src/__tests__/auth/auth-error-page.test.tsx
    - src/__tests__/auth/auth-provider.test.tsx
    - .env.example

key-decisions:
  - "WTCS_GUILD_ID read inside function (not module-level constant) to support test-time env injection"
  - "Guild check uses provider_token from OAuth flow, not Bot API, per D-01/D-03"
  - "Discord invite link https://discord.gg/wtcs is placeholder -- project owner must provide actual permanent invite URL"

patterns-established:
  - "URL-aware fetch mocking: createGuildAwareFetchMock helper differentiates responses by URL for multi-endpoint testing"
  - "Downstream enforcement: security-critical checks enforced both at login time and at submission time"

requirements-completed: [AUTH-03, TEST-04]

# Metrics
duration: 12min
completed: 2026-04-08
---

# Phase 3 Plan 01: Guild Membership Verification Summary

**Discord server membership verification at login via OAuth guilds scope with fail-closed error handling, downstream enforcement in submit-vote, and WTCS-themed error page**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-08T02:37:47Z
- **Completed:** 2026-04-08T02:49:00Z
- **Tasks:** 2 completed (Task 3 is checkpoint:human-verify)
- **Files modified:** 9

## Accomplishments
- Guild membership check integrated into auth callback with fail-closed handling for API errors, network errors, malformed responses, and empty guild lists
- submit-vote Edge Function enforces guild_member at submission time (prevents stale session bypasses)
- AuthErrorPage shows "WTCS Server Membership Required" with Discord invite link for non-members
- 10 new tests added (8 guild callback + 2 error page), all 40 auth tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration, guild membership check, downstream enforcement, and tests**
   - `b529734` (test: TDD RED -- failing guild membership tests)
   - `31f1405` (feat: TDD GREEN -- guild check implementation + migration + downstream enforcement)
2. **Task 2: AuthErrorPage not-in-server variant and error route update** - `083efef` (feat)
3. **Task 3: Push database schema and configure WTCS Guild ID** - checkpoint:human-verify (pending)

## Files Created/Modified
- `supabase/migrations/00000000000003_guild_membership.sql` - Adds guild_member column, updates trigger guard and RPC
- `src/lib/auth-helpers.ts` - Guild check via Discord guilds API after MFA, fail-closed on all errors
- `src/contexts/AuthContext.tsx` - OAuth scopes extended to include 'guilds'
- `supabase/functions/submit-vote/index.ts` - Downstream guild_member enforcement before vote processing
- `src/components/auth/AuthErrorPage.tsx` - not-in-server variant with Users icon and Discord invite
- `src/routes/auth/error.tsx` - Accepts 'not-in-server' reason parameter
- `src/__tests__/auth/callback-behavior.test.tsx` - 8 new guild check tests with URL-aware fetch mocks
- `src/__tests__/auth/auth-error-page.test.tsx` - 2 new not-in-server tests
- `src/__tests__/auth/auth-provider.test.tsx` - Updated OAuth scope expectation to include 'guilds'
- `.env.example` - Added VITE_WTCS_GUILD_ID placeholder

## Decisions Made
- WTCS_GUILD_ID read inside handleAuthCallback function body (not module-level constant) to support test-time env var injection via import.meta.env
- Guild check uses provider_token from Supabase OAuth flow (not Bot API) per research decision D-01/D-03
- Discord invite link https://discord.gg/wtcs is a placeholder -- project owner must supply the actual permanent invite URL

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed auth-provider test OAuth scope assertion**
- **Found during:** Task 2 (AuthErrorPage update)
- **Issue:** Existing test expected `scopes: 'identify email'` but we changed AuthContext to `'identify email guilds'`
- **Fix:** Updated test assertion to match new scopes
- **Files modified:** src/__tests__/auth/auth-provider.test.tsx
- **Verification:** All 40 auth tests pass
- **Committed in:** 083efef (Task 2 commit)

**2. [Rule 1 - Bug] Moved WTCS_GUILD_ID from module-level to function-level**
- **Found during:** Task 1 GREEN phase
- **Issue:** Module-level `const WTCS_GUILD_ID = import.meta.env.VITE_WTCS_GUILD_ID` captures empty string at import time; tests setting env in beforeEach have no effect
- **Fix:** Moved the env var read inside handleAuthCallback so it reads at call time
- **Files modified:** src/lib/auth-helpers.ts
- **Verification:** All 19 callback tests pass
- **Committed in:** 31f1405 (Task 1 GREEN commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered
- Pre-existing failures in vote-submission.test.tsx (2 tests) -- unrelated to this plan's changes, confirmed by running tests on pre-change code. Out of scope.

## User Setup Required

Task 3 (checkpoint:human-verify) requires:
- Push database migration: `supabase db push`
- Set WTCS Guild ID in `.env.local`: `VITE_WTCS_GUILD_ID=<your-guild-id>`
- Replace placeholder Discord invite link `https://discord.gg/wtcs` with actual permanent invite URL

## Next Phase Readiness
- Guild membership verification complete for auth flow and submission enforcement
- Pending: database migration push and guild ID configuration (Task 3 checkpoint)
- Ready for Phase 3 Plan 02 after checkpoint approval

---
*Phase: 03-response-integrity*
*Completed: 2026-04-08*
