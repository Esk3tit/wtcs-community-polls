---
phase: 03-response-integrity
plan: 02
subsystem: rate-limiting
tags: [upstash, redis, rate-limit, edge-function, tdd]
dependency_graph:
  requires: [03-01]
  provides: [per-user-rate-limiting, fail-closed-redis]
  affects: [supabase/functions/submit-vote/index.ts]
tech_stack:
  added: ["@upstash/ratelimit@2", "@upstash/redis@1"]
  patterns: [sliding-window-rate-limit, fail-closed, source-analysis-testing]
key_files:
  created:
    - src/__tests__/integrity/rate-limit-toast.test.tsx
    - src/__tests__/integrity/rate-limit-edge-function.test.ts
    - .planning/phases/03-response-integrity/deferred-items.md
  modified:
    - supabase/functions/submit-vote/index.ts
decisions:
  - "Source-analysis testing pattern for Deno Edge Functions that cannot run in Vitest"
  - "Guild member query selector used for position test instead of column name to avoid comment false-positive"
metrics:
  duration: 2 minutes
  completed: "2026-04-08T02:49:30Z"
---

# Phase 03 Plan 02: Rate Limiting Summary

Per-user Upstash Redis sliding window rate limiting (5 req/60s) on submit-vote Edge Function, with fail-closed Redis behavior and TDD test coverage via source-analysis pattern.

## What Was Done

### Task 1: Add Upstash rate limiting to submit-vote Edge Function with server-side and client-side tests (TDD)

**RED phase** (commit `011b55b`):
- Created `src/__tests__/integrity/rate-limit-toast.test.tsx` with 3 client-side tests verifying 429 toast display, D-09 message text, and no optimistic update on rate limit
- Created `src/__tests__/integrity/rate-limit-edge-function.test.ts` with 9 source-analysis tests verifying keying on user.id, sliding window config, code position (before guild check + body parse), fail-closed behavior, and 429 response format
- 9 tests failed as expected (rate limiting not yet in Edge Function)

**GREEN phase** (commit `683cbab`):
- Added `@upstash/ratelimit@2` and `@upstash/redis@1` imports to Edge Function
- Created module-level `Ratelimit` instance with `slidingWindow(5, '60 s')` and `prefix: 'wtcs:vote'`
- Inserted rate limit check after auth verification, before guild_member check and body parsing
- 429 response returns D-09 message: "Too many responses too quickly. Please wait a moment and try again."
- `ratelimit.limit()` is NOT in a nested try/catch -- Redis failure propagates to outer catch (500, fail-closed)
- Fixed test: guild_member position test uses `.select('guild_member')` selector to avoid matching rate limit comments
- All 12 integrity tests pass

**Final submit-vote flow:**
1. CORS preflight
2. Method check (POST only)
3. Auth verification (JWT via getUser)
4. Rate limit check (per user.id, Upstash sliding window 5/60s)
5. Guild member check (profiles.guild_member via service_role)
6. Parse and validate request body
7. Validate poll exists and is active
8. Validate choice belongs to poll
9. INSERT vote (UNIQUE constraint enforcement)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed guild_member position test false-positive**
- **Found during:** Task 1 GREEN phase
- **Issue:** Test searched for `guild_member` string but found it in rate limit comment before the actual DB query, causing position assertion to fail
- **Fix:** Changed test to search for `.select('guild_member')` (the actual DB query) instead of bare `guild_member`
- **Files modified:** `src/__tests__/integrity/rate-limit-edge-function.test.ts`
- **Commit:** `683cbab`

## Out-of-Scope Discoveries

**Pre-existing test failures in `src/__tests__/suggestions/vote-submission.test.tsx`:**
2 tests fail on the base commit (verified) due to incorrect mock pattern -- mocks use `{ data: { error: '...' } }` but `useVoteSubmit` uses `error.context.json()` pattern. Logged to `deferred-items.md`. Not caused by Plan 02 changes.

## Verification Results

- `npx vitest run src/__tests__/integrity/` -- 12 tests pass (2 files)
- Full test suite: 76 pass, 2 pre-existing failures (unrelated)
- Edge Function contains all required patterns (imports, config, position, fail-closed, response format)

## Checkpoint: Task 2 (human-verify)

Task 2 requires human setup of Upstash Redis external service. See plan for instructions.

## Self-Check: PASSED

- All 5 files verified present on disk
- Commits `011b55b` (TDD RED) and `683cbab` (TDD GREEN) verified in git log
- 12/12 integrity tests pass
