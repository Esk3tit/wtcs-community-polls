---
phase: 02-browsing-responding
plan: 03
subsystem: testing-and-seed-data
tags: [seed-data, tests, vitest, voting, results-visibility, suggestion-list]
dependency_graph:
  requires: [02-01, 02-02]
  provides: [TEST-03, seed-data]
  affects: [supabase/seed.sql, src/__tests__/suggestions/]
tech_stack:
  added: []
  patterns: [vitest-mock-pattern, renderHook-testing, role-based-test-selectors]
key_files:
  created:
    - src/__tests__/suggestions/vote-submission.test.tsx
    - src/__tests__/suggestions/results-visibility.test.tsx
    - src/__tests__/suggestions/suggestion-list.test.tsx
  modified:
    - supabase/seed.sql
decisions:
  - Used deterministic UUIDs for seed data instead of text IDs (schema requires UUID type)
  - Used role=tab selectors for category filter tests to avoid collisions with category badges
  - Mocked useDebounce to return values immediately for synchronous test assertions
metrics:
  duration: ~6 minutes
  completed: "2026-04-07T04:28:00Z"
  tasks: 2
  files_created: 3
  files_modified: 1
---

# Phase 02 Plan 03: Seed Data and Test Coverage Summary

Realistic WTCS seed data and 19 comprehensive tests covering vote submission invariants, results visibility rules, and suggestion list browsing with filtering.

## What Was Done

### Task 1: Extended seed data with realistic WTCS content

Extended `supabase/seed.sql` with:
- 3 categories: Lineup Changes, Map Pool, Rules
- 2 admin profiles for poll creators (deterministic UUIDs)
- 7 suggestions: 2 pinned active, 3 non-pinned active, 2 closed (1 addressed, 1 forwarded)
- 19 total choices across all suggestions (2-4 per suggestion)
- Pre-aggregated vote counts for the 2 closed suggestions
- All INSERTs use `ON CONFLICT DO NOTHING` for idempotency

Commit: `dfccc11`

### Task 2: Created comprehensive test suite (19 tests)

**vote-submission.test.tsx (7 tests):**
1. Invokes Edge Function with correct poll_id and choice_id
2. Shows success toast on successful submission
3. Shows error toast on duplicate vote (409 UNIQUE violation)
4. Disables all buttons during submission (double-click protection)
5. Shows spinner on clicked button during submission
6. Rejects vote on closed suggestion (shows closed message)
7. Rejects vote with missing choice_id (400 error)

**results-visibility.test.tsx (6 tests):**
1. Hides results when user has not voted (pre-vote state)
2. Shows result bars with percentages after voting
3. Highlights user's chosen option with Check icon
4. Shows closed message for non-respondents (respondent-only post-close)
5. Shows result bars for respondents on closed topic
6. Calculates percentages correctly including zero-total edge case (no NaN)

**suggestion-list.test.tsx (6 tests):**
1. Displays active suggestions from server-filtered query
2. Filters by category when pill is clicked
3. Searches by text with debounced input
4. Shows no-matches empty state when filters exclude all
5. Shows no-active empty state when no suggestions exist
6. Combined category + search filtering works correctly

Commit: `43e6f10`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan specified text IDs for UUID columns**
- **Found during:** Task 1
- **Issue:** The plan's seed SQL used text IDs like `'cat-lineup'`, `'poll-001'`, `'choice-001a'` which are invalid for UUID-typed columns in the schema
- **Fix:** Used deterministic UUIDs following a consistent pattern (e.g., `a0000000-...-000000000001` for categories, `b0000000-...-000000000001` for polls, `c0000000-...-00000000001a` for choices)
- **Files modified:** supabase/seed.sql
- **Commit:** dfccc11

**2. [Rule 1 - Bug] Plan's ON CONFLICT for vote_counts used wrong column**
- **Found during:** Task 1
- **Issue:** Plan specified `ON CONFLICT (choice_id) DO NOTHING` but the actual unique constraint is `vote_counts_one_per_choice UNIQUE (poll_id, choice_id)`
- **Fix:** Used `ON CONFLICT (poll_id, choice_id) DO NOTHING` to match the schema
- **Files modified:** supabase/seed.sql
- **Commit:** dfccc11

**3. [Rule 3 - Blocking] Category filter tests collided with category badges**
- **Found during:** Task 2
- **Issue:** `screen.getByText('Rules')` and `screen.getByText('Map Pool')` found multiple elements because category names appear both in filter pills (CategoryFilter) and in suggestion cards (CategoryBadge)
- **Fix:** Used `screen.getAllByRole('tab')` to target only the filter pill buttons, since CategoryFilter renders buttons with `role="tab"`
- **Files modified:** src/__tests__/suggestions/suggestion-list.test.tsx
- **Commit:** 43e6f10

## Pre-existing Issues (Out of Scope)

- `src/__tests__/auth/auth-provider.test.tsx` has 1 failing test (`calls signInWithOAuth with discord provider on signInWithDiscord`). This is a pre-existing failure not caused by this plan's changes. Logged for awareness but not fixed per deviation scope rules.

## Verification Results

- `npx vitest run src/__tests__/suggestions/` -- 19 tests passed (3 files)
- `npx tsc --noEmit` -- zero errors
- `npm test` -- 55/56 pass (1 pre-existing failure in auth-provider unrelated to this plan)

## Known Stubs

None. All test files are complete with real assertions against actual component behavior.

## Self-Check: PASSED

- All 5 files verified present on disk
- Both commits (dfccc11, 43e6f10) verified in git log
- 19/19 tests pass
- TypeScript compiles cleanly
