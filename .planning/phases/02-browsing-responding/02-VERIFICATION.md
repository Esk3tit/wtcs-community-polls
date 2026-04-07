---
phase: 02-browsing-responding
verified: 2026-04-07T04:40:00Z
status: gaps_found
score: 5/7 must-haves verified
overrides_applied: 0
gaps:
  - truth: "User sees a browsable list of active suggestions on the main page, filterable by category tabs and searchable by text"
    status: failed
    reason: "src/routes/topics.tsx was correctly wired in commit 0d40fae (Plan 01) but was reverted to Phase 1 placeholder by commit dfccc11 (Plan 03 seed data). Current file shows Inbox icon and static text instead of SuggestionList component."
    artifacts:
      - path: "src/routes/topics.tsx"
        issue: "Contains Phase 1 placeholder (Inbox icon, static empty state) instead of SuggestionList with status='active'"
    missing:
      - "Restore topics.tsx to import and render SuggestionList with status='active' (revert the regression from commit dfccc11)"
  - truth: "A user who has not responded to a closed suggestion cannot see its results; only respondents can view results even after the suggestion closes"
    status: failed
    reason: "src/routes/archive.tsx was correctly wired in commit 8f1b949 (Plan 02) but was reverted to Phase 1 placeholder by commit dfccc11 (Plan 03 seed data). Without the Archive page rendering SuggestionList, closed suggestion result visibility cannot be verified end-to-end."
    artifacts:
      - path: "src/routes/archive.tsx"
        issue: "Contains Phase 1 placeholder (Archive icon, static empty state) instead of SuggestionList with status='closed'"
    missing:
      - "Restore archive.tsx to import and render SuggestionList with status='closed' (revert the regression from commit dfccc11)"
human_verification:
  - test: "Browse active suggestions on /topics page after route fix"
    expected: "Authenticated user sees suggestion cards loaded from Supabase with expand/collapse, category filtering, and text search"
    why_human: "Visual layout, touch target sizing, and mobile responsiveness cannot be verified programmatically"
  - test: "Submit a response and verify respond-then-reveal flow"
    expected: "Click a choice button, see spinner, then choice buttons replaced by result bars with percentages and counts"
    why_human: "End-to-end flow requires running app with Supabase backend and real Edge Function invocation"
  - test: "Verify mobile-first responsive design for suggestions"
    expected: "Suggestion cards, choice buttons, and result bars are fully usable on phone screens with tap-friendly targets and no horizontal scroll"
    why_human: "SC6 requires visual verification of responsive design across screen sizes"
---

# Phase 2: Browsing & Responding Verification Report

**Phase Goal:** Authenticated users can browse active suggestions, submit one response per suggestion through server-validated Edge Functions, and see live-updating results only after responding
**Verified:** 2026-04-07T04:40:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User sees a browsable list of active suggestions on the main page, filterable by category tabs and searchable by text | FAILED | `src/routes/topics.tsx` is Phase 1 placeholder (Inbox icon, static text). SuggestionList exists and is fully functional but NOT wired to the route. Regression introduced by commit dfccc11. |
| 2 | User can open a suggestion, select a choice, and submit their response -- the response is persisted and cannot be changed or deleted | VERIFIED | SuggestionCard has Collapsible expand/collapse (168 lines). ChoiceButtons renders choice buttons that call useVoteSubmit. Edge Function at `supabase/functions/submit-vote/index.ts` (101 lines) does direct INSERT with UNIQUE constraint enforcement. RLS prevents UPDATE/DELETE on votes. |
| 3 | Before responding, user sees the choices but no results; after responding, user sees live percentages and raw response counts | VERIFIED | ChoiceButtons renders pre-vote state. ResultBars renders post-vote with `role="meter"` and `aria-valuenow`. useVoteCounts fetches from `vote_counts` table which is RLS-gated to respondents only. |
| 4 | Response counts update automatically every 5-10 seconds without page refresh via HTTP polling | VERIFIED | `useVoteCounts.ts` uses `POLL_INTERVAL = 8000` (8s, within 5-10s range). `usePolling.ts` checks `document.visibilityState === 'visible'` before each tick. Disabled for closed suggestions. |
| 5 | A user who has not responded to a closed suggestion cannot see its results; only respondents can view results even after the suggestion closes | FAILED | RLS policy on `vote_counts` and ChoiceButtons "This topic is closed. Only respondents can view results." message exist. However, `src/routes/archive.tsx` is Phase 1 placeholder -- the Archive page does NOT render SuggestionList, so closed suggestion results are not accessible to users. Regression from commit dfccc11. |
| 6 | Suggestion browsing, responding, and results are fully usable on phone screens | UNCERTAIN | Components use Tailwind responsive classes but visual verification requires human testing on mobile. Routed to human verification. |
| 7 | Response submission and result visibility have unit/integration tests | VERIFIED | 19 tests across 3 files all pass: vote-submission (7 tests), results-visibility (6 tests), suggestion-list (6 tests). Covers one-response enforcement, respond-then-reveal, respondents-only results. |

**Score:** 5/7 truths verified (4 VERIFIED, 2 FAILED, 1 UNCERTAIN routed to human)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/types/suggestions.ts` | Derived UI types | VERIFIED | Exports SuggestionWithChoices, ChoiceWithCount, CATEGORY_COLORS, getCategoryColor |
| `src/lib/format.ts` | Time/percentage formatters | VERIFIED | Exports formatTimeRemaining, calcPercentage |
| `src/hooks/useSuggestions.ts` | Server-filtered poll query | VERIFIED | `.eq('status', status)` server-side filter, returns suggestions + userVotes Map |
| `src/hooks/useCategories.ts` | Category fetcher | VERIFIED | Queries categories ordered by sort_order |
| `src/hooks/useDebounce.ts` | Debounce hook | VERIFIED | Generic debounce with configurable delay |
| `src/hooks/useVoteSubmit.ts` | Edge Function invoker | VERIFIED | 51 lines, invokes 'submit-vote', optimistic updates, toast notifications |
| `src/hooks/usePolling.ts` | Visibility-aware polling | VERIFIED | 25 lines, visibilityState check, clearInterval cleanup |
| `src/hooks/useVoteCounts.ts` | Vote count fetcher with polling | VERIFIED | 52 lines, queries vote_counts (RLS-gated), 8s polling for active |
| `src/components/suggestions/SuggestionCard.tsx` | Collapsible card with vote states | VERIFIED | 168 lines, imports ChoiceButtons + ResultBars + Collapsible |
| `src/components/suggestions/SuggestionList.tsx` | List with filtering and vote wiring | VERIFIED | 110 lines, imports all 5 hooks, passes real vote data to cards |
| `src/components/suggestions/ChoiceButtons.tsx` | Pre-vote choice buttons | VERIFIED | 71 lines, disabled during submit, closed-suggestion message |
| `src/components/suggestions/ResultBars.tsx` | Post-vote result bars | VERIFIED | 86 lines, role="meter", aria-valuenow, calcPercentage |
| `src/components/suggestions/StatusBadge.tsx` | Category + resolution badges | VERIFIED | Exports CategoryBadge, ResolutionBadge |
| `src/components/suggestions/PinnedBanner.tsx` | Amber pinned banner | VERIFIED | Imports formatTimeRemaining, Pin + Clock icons |
| `src/components/suggestions/SearchBar.tsx` | Search input | VERIFIED | aria-label="Search topics", clear button |
| `src/components/suggestions/CategoryFilter.tsx` | Category pill filter | VERIFIED | role="tablist", role="tab" on pills |
| `src/components/suggestions/EmptyState.tsx` | Empty state variants | VERIFIED | 3 variants: no-matches, no-active, no-archive |
| `src/components/suggestions/SuggestionSkeleton.tsx` | Loading skeleton | VERIFIED | aria-busy="true", 3 pulsing cards |
| `supabase/functions/submit-vote/index.ts` | Edge Function | VERIFIED | 101 lines, Deno.serve, JWT auth, 23505->409 UNIQUE enforcement |
| `supabase/functions/_shared/cors.ts` | CORS headers | VERIFIED | Exports corsHeaders |
| `src/routes/topics.tsx` | Topics page with SuggestionList | FAILED | Phase 1 placeholder -- regression from commit dfccc11 |
| `src/routes/archive.tsx` | Archive page with SuggestionList | FAILED | Phase 1 placeholder -- regression from commit dfccc11 |
| `supabase/seed.sql` | Extended seed data | VERIFIED | 3 categories, 2 profiles, 7 polls, 19 choices, vote counts for closed |
| `src/__tests__/suggestions/vote-submission.test.tsx` | Vote submission tests | VERIFIED | 7 tests, describe('Vote submission') |
| `src/__tests__/suggestions/results-visibility.test.tsx` | Results visibility tests | VERIFIED | 6 tests, describe('Results visibility') |
| `src/__tests__/suggestions/suggestion-list.test.tsx` | Suggestion list tests | VERIFIED | 6 tests, describe('SuggestionList') |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| topics.tsx | SuggestionList | direct import | NOT_WIRED | Regression: file contains Inbox import instead of SuggestionList |
| archive.tsx | SuggestionList | direct import | NOT_WIRED | Regression: file contains Archive import instead of SuggestionList |
| SuggestionList | useSuggestions | hook call | WIRED | Line 2: import, Line 14: useSuggestions(status) |
| SuggestionList | useVoteCounts | hook call | WIRED | Line 5: import, Line 23: useVoteCounts(...) |
| SuggestionList | useVoteSubmit | hook call | WIRED | Line 6: import, Line 24: useVoteSubmit(...) |
| SuggestionList | SuggestionCard | component render | WIRED | Line 11: import, rendered in map |
| SuggestionCard | ChoiceButtons | component render | WIRED | Line 10: import, rendered conditionally |
| SuggestionCard | ResultBars | component render | WIRED | Line 11: import, rendered conditionally |
| useSuggestions | supabase.from('polls') | Supabase query | WIRED | .eq('status', status) server-side filter |
| useVoteSubmit | supabase.functions.invoke('submit-vote') | Edge Function call | WIRED | Line 19: invoke with poll_id/choice_id body |
| useVoteCounts | supabase.from('vote_counts') | Supabase query | WIRED | Line 24: RLS-gated query |
| usePolling | document.visibilityState | Visibility API | WIRED | Line 16: check before executing callback |
| submit-vote Edge Function | UNIQUE constraint | PostgreSQL 23505 | WIRED | Line 81: catches code '23505', returns 409 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| SuggestionList | suggestions | useSuggestions -> supabase.from('polls') | DB query with .eq('status') | FLOWING (when wired to route) |
| SuggestionList | voteCounts | useVoteCounts -> supabase.from('vote_counts') | DB query, RLS-gated | FLOWING (when wired to route) |
| SuggestionList | categories | useCategories -> supabase.from('categories') | DB query ordered by sort_order | FLOWING (when wired to route) |
| ResultBars | choices/voteCounts | Props from SuggestionCard | Passed through from SuggestionList | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Tests pass | `npx vitest run src/__tests__/suggestions/` | 19/19 pass (3 files) | PASS |
| TypeScript compiles | `npx tsc --noEmit` | Zero errors (empty output) | PASS |
| Edge Function exists | File check supabase/functions/submit-vote/index.ts | 101 lines, Deno.serve present | PASS |
| Topics route wired | Check topics.tsx for SuggestionList import | Contains Inbox import (placeholder) | FAIL |
| Archive route wired | Check archive.tsx for SuggestionList import | Contains Archive import (placeholder) | FAIL |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| VOTE-01 | 02-02 | One response per suggestion (DB UNIQUE constraint) | SATISFIED | UNIQUE constraint `votes_one_per_user_per_poll`, Edge Function catches 23505->409, test covers duplicate rejection |
| VOTE-02 | 02-02 | Response via Edge Function with server-side validation | SATISFIED | `supabase/functions/submit-vote/index.ts` with JWT auth, poll-active check, choice-poll validation |
| VOTE-03 | 02-02 | Response immutable after submission | SATISFIED | RLS prevents UPDATE/DELETE on votes table, no client-side edit capability |
| RSLT-01 | 02-02 | Results hidden until user responds | SATISFIED | RLS on vote_counts requires existing vote record; ChoiceButtons shows buttons pre-vote, tested |
| RSLT-02 | 02-02 | Live percentages and counts after responding | SATISFIED | ResultBars with role="meter", calcPercentage, count display, tested |
| RSLT-03 | 02-02 | Pre-aggregated response counts via trigger | SATISFIED | vote_counts table with increment trigger (Phase 1 schema), queried by useVoteCounts |
| RSLT-04 | 02-02 | Frontend polls every 5-10s for live updates | SATISFIED | usePolling at 8000ms with visibilityState check |
| RSLT-05 | 02-02 | Only respondents see results even after close | BLOCKED | RLS policy exists, ChoiceButtons closed message exists, but Archive page is placeholder -- cannot verify end-to-end |
| CATG-02 | 02-01 | Active suggestions in browsable list | BLOCKED | SuggestionList exists and works, but topics.tsx route is placeholder -- suggestions not visible to users |
| CATG-03 | 02-01 | Filter by category tabs | BLOCKED | CategoryFilter component works (tested), but unreachable because topics.tsx is placeholder |
| CATG-04 | 02-01 | Search/filter by text | BLOCKED | SearchBar with useDebounce works (tested), but unreachable because topics.tsx is placeholder |
| INFR-04 | 02-02 | Response writes through Edge Functions | SATISFIED | submit-vote Edge Function handles all response writes |
| TEST-03 | 02-03 | Response submission and result visibility tests | SATISFIED | 19 tests pass covering vote submission, results visibility, suggestion list filtering |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/routes/topics.tsx | 3 | Phase 1 placeholder content (Inbox icon, static text) -- regression from commit dfccc11 | BLOCKER | Breaks SC1: users cannot see suggestions |
| src/routes/archive.tsx | 3 | Phase 1 placeholder content (Archive icon, static text) -- regression from commit dfccc11 | BLOCKER | Breaks SC5: users cannot access closed suggestion results |
| src/components/suggestions/SuggestionCard.tsx | 122 | Comment "Creator avatar placeholder -- profile data not in query yet" | INFO | Cosmetic only -- generic avatar shown, not blocking |

### Human Verification Required

### 1. Mobile-First Responsive Design

**Test:** After route fix, browse /topics on a phone-sized viewport (375px width). Open a suggestion, vote, view results.
**Expected:** Cards stack full-width, choice buttons are tap-friendly (min 44px targets), result bars are readable, no horizontal scroll anywhere.
**Why human:** SC6 requires visual verification of responsive layout, touch target sizing, and scroll behavior.

### 2. End-to-End Respond-Then-Reveal Flow

**Test:** After route fix, log in with Discord, navigate to /topics, expand a suggestion, click a choice button.
**Expected:** Spinner appears on clicked button, all buttons disabled, then replaced by result bars with percentages. Toast confirms "Response recorded".
**Why human:** Requires running Supabase Edge Function against real database, cannot verify with unit tests alone.

### 3. Live Polling Updates

**Test:** After voting, have a second user vote on the same suggestion. Watch the first user's result bars.
**Expected:** Counts update within 8 seconds without page refresh. When tab is backgrounded and re-focused, update fires.
**Why human:** Requires multiple simultaneous sessions and real-time observation.

### Gaps Summary

**Root cause:** Commit `dfccc11` (Plan 03, Task 1 -- seed data) accidentally reverted both `src/routes/topics.tsx` and `src/routes/archive.tsx` to their Phase 1 placeholder states. This undid the correct wiring performed by commit `0d40fae` (Plan 01) and commit `8f1b949` (Plan 02).

**Impact:** All components, hooks, Edge Function, and tests are fully implemented and substantive. The ONLY issue is that the two route files are not importing SuggestionList. This is a 2-line fix per file (change import and replace JSX), but it blocks 4 out of 7 success criteria and 4 out of 13 requirements.

**Fix required:**
1. Restore `src/routes/topics.tsx` to import and render `<SuggestionList status="active" />` inside `<AuthGuard>`
2. Restore `src/routes/archive.tsx` to import and render `<SuggestionList status="closed" />` inside `<AuthGuard>`

These are the exact changes from commits `0d40fae` and `8f1b949` that need to be re-applied.

---

_Verified: 2026-04-07T04:40:00Z_
_Verifier: Claude (gsd-verifier)_
