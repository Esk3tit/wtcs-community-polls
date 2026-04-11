---
phase: 02-browsing-responding
verified: 2026-04-07T05:15:00Z
status: resolved
resolved: 2026-04-11T00:00:00Z
resolved_by: 02-UAT.md
score: 7/7 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 5/7
  gaps_closed:
    - "User sees a browsable list of active suggestions on the main page, filterable by category tabs and searchable by text"
    - "A user who has not responded to a closed suggestion cannot see its results; only respondents can view results even after the suggestion closes"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Browse active suggestions on /topics page"
    expected: "Authenticated user sees suggestion cards loaded from Supabase with expand/collapse, category filtering, and text search"
    why_human: "Visual layout, touch target sizing, and mobile responsiveness cannot be verified programmatically"
    resolved_by: "02-UAT.md test 9 (Mobile responsiveness) — pass"
  - test: "Submit a response and verify respond-then-reveal flow"
    expected: "Click a choice button, see spinner, then choice buttons replaced by result bars with percentages and counts"
    why_human: "End-to-end flow requires running app with Supabase backend and real Edge Function invocation"
    resolved_by: "02-UAT.md test 5 (Vote submission works) — pass"
  - test: "Verify live polling updates"
    expected: "After voting, have a second user vote. First user's result bars update within 8 seconds without page refresh."
    why_human: "Requires multiple simultaneous sessions and real-time observation"
    resolved_by: "02-UAT.md test 7 (Live polling updates results) — pass"
---

# Phase 2: Browsing & Responding Verification Report

**Phase Goal:** Authenticated users can browse active suggestions, submit one response per suggestion through server-validated Edge Functions, and see live-updating results only after responding
**Verified:** 2026-04-07T05:15:00Z
**Resolved:** 2026-04-11 — all three human_verification items covered by 02-UAT.md (tests 5, 7, 9 — all pass)
**Status:** resolved
**Re-verification:** Yes -- after gap closure (Plan 04)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User sees a browsable list of active suggestions on the main page, filterable by category tabs and searchable by text | VERIFIED | `src/routes/topics.tsx` imports and renders `<SuggestionList status="active" />` inside `<AuthGuard>`. SuggestionList wires useSuggestions (server-side `.eq('status', status)`), CategoryFilter, SearchBar with useDebounce. Gap CLOSED by Plan 04. |
| 2 | User can open a suggestion, select a choice, and submit their response -- the response is persisted and cannot be changed or deleted | VERIFIED | SuggestionCard uses Collapsible for expand/collapse. ChoiceButtons calls useVoteSubmit which invokes Edge Function `submit-vote`. Edge Function (101 lines) does direct INSERT with UNIQUE constraint `votes_one_per_user_per_poll`. RLS prevents UPDATE/DELETE on votes. |
| 3 | Before responding, user sees the choices but no results; after responding, user sees live percentages and raw response counts | VERIFIED | ChoiceButtons renders pre-vote state. ResultBars renders post-vote with `role="meter"` and `aria-valuenow`. useVoteCounts fetches from `vote_counts` table which is RLS-gated to respondents only. |
| 4 | Response counts update automatically every 5-10 seconds without page refresh via HTTP polling | VERIFIED | `useVoteCounts.ts` uses `POLL_INTERVAL = 8000` (8s, within 5-10s range). `usePolling.ts` checks `document.visibilityState === 'visible'` before each tick. Disabled for closed suggestions. |
| 5 | A user who has not responded to a closed suggestion cannot see its results; only respondents can view results even after the suggestion closes | VERIFIED | RLS policy on `vote_counts` requires existing vote record. ChoiceButtons shows "This topic is closed. Only respondents can view results." for non-respondents. `src/routes/archive.tsx` now imports and renders `<SuggestionList status="closed" />`. Gap CLOSED by Plan 04. |
| 6 | Suggestion browsing, responding, and results are fully usable on phone screens | UNCERTAIN | Components use Tailwind responsive classes. Requires human visual verification on mobile viewport. Routed to human verification. |
| 7 | Response submission and result visibility have unit/integration tests | VERIFIED | 19 tests across 3 files all pass: vote-submission (7 tests), results-visibility (6 tests), suggestion-list (6 tests). Covers one-response enforcement, respond-then-reveal, respondents-only results. |

**Score:** 7/7 truths verified (6 VERIFIED, 1 UNCERTAIN routed to human)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/types/suggestions.ts` | Derived UI types | VERIFIED | Exports SuggestionWithChoices, ChoiceWithCount, CATEGORY_COLORS, getCategoryColor |
| `src/lib/format.ts` | Time/percentage formatters | VERIFIED | Exports formatTimeRemaining, calcPercentage |
| `src/hooks/useSuggestions.ts` | Server-filtered poll query | VERIFIED | `.eq('status', status)` server-side filter, returns suggestions + userVotes Map |
| `src/hooks/useCategories.ts` | Category fetcher | VERIFIED | Queries categories ordered by sort_order |
| `src/hooks/useDebounce.ts` | Debounce hook | VERIFIED | Generic debounce with configurable delay |
| `src/hooks/useVoteSubmit.ts` | Edge Function invoker | VERIFIED | Invokes 'submit-vote', optimistic updates, toast notifications |
| `src/hooks/usePolling.ts` | Visibility-aware polling | VERIFIED | visibilityState check, clearInterval cleanup |
| `src/hooks/useVoteCounts.ts` | Vote count fetcher with polling | VERIFIED | Queries vote_counts (RLS-gated), 8s polling for active |
| `src/components/suggestions/SuggestionCard.tsx` | Collapsible card with vote states | VERIFIED | Imports ChoiceButtons + ResultBars + Collapsible |
| `src/components/suggestions/SuggestionList.tsx` | List with filtering and vote wiring | VERIFIED | Imports all 5 hooks, passes real vote data to cards |
| `src/components/suggestions/ChoiceButtons.tsx` | Pre-vote choice buttons | VERIFIED | Disabled during submit, closed-suggestion message |
| `src/components/suggestions/ResultBars.tsx` | Post-vote result bars | VERIFIED | role="meter", aria-valuenow, calcPercentage |
| `src/components/suggestions/StatusBadge.tsx` | Category + resolution badges | VERIFIED | Exports CategoryBadge, ResolutionBadge |
| `src/components/suggestions/PinnedBanner.tsx` | Amber pinned banner | VERIFIED | Imports formatTimeRemaining, Pin + Clock icons |
| `src/components/suggestions/SearchBar.tsx` | Search input | VERIFIED | aria-label="Search topics", clear button |
| `src/components/suggestions/CategoryFilter.tsx` | Category pill filter | VERIFIED | role="tablist", role="tab" on pills |
| `src/components/suggestions/EmptyState.tsx` | Empty state variants | VERIFIED | 3 variants: no-matches, no-active, no-archive |
| `src/components/suggestions/SuggestionSkeleton.tsx` | Loading skeleton | VERIFIED | aria-busy="true", pulsing cards |
| `supabase/functions/submit-vote/index.ts` | Edge Function | VERIFIED | Deno.serve, JWT auth, 23505->409 UNIQUE enforcement |
| `supabase/functions/_shared/cors.ts` | CORS headers | VERIFIED | Exports corsHeaders |
| `src/routes/topics.tsx` | Topics page with SuggestionList | VERIFIED | Imports SuggestionList, renders with status="active" inside AuthGuard. Gap CLOSED. |
| `src/routes/archive.tsx` | Archive page with SuggestionList | VERIFIED | Imports SuggestionList, renders with status="closed" inside AuthGuard. Gap CLOSED. |
| `supabase/seed.sql` | Extended seed data | VERIFIED | 3 categories, 2 profiles, 7 polls, choices for all, vote counts for closed |
| `src/__tests__/suggestions/vote-submission.test.tsx` | Vote submission tests | VERIFIED | 7 tests, describe('Vote submission') |
| `src/__tests__/suggestions/results-visibility.test.tsx` | Results visibility tests | VERIFIED | 6 tests, describe('Results visibility') |
| `src/__tests__/suggestions/suggestion-list.test.tsx` | Suggestion list tests | VERIFIED | 6 tests, describe('SuggestionList') |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| topics.tsx | SuggestionList | direct import | WIRED | `import { SuggestionList }` + `<SuggestionList status="active" />` |
| archive.tsx | SuggestionList | direct import | WIRED | `import { SuggestionList }` + `<SuggestionList status="closed" />` |
| SuggestionList | useSuggestions | hook call | WIRED | Import + useSuggestions(status) call |
| SuggestionList | useVoteCounts | hook call | WIRED | Import + useVoteCounts(...) call |
| SuggestionList | useVoteSubmit | hook call | WIRED | Import + useVoteSubmit(...) call |
| SuggestionList | SuggestionCard | component render | WIRED | Import + rendered in map |
| SuggestionCard | ChoiceButtons | component render | WIRED | Import + rendered conditionally |
| SuggestionCard | ResultBars | component render | WIRED | Import + rendered conditionally |
| useSuggestions | supabase.from('polls') | Supabase query | WIRED | .eq('status', status) server-side filter |
| useVoteSubmit | supabase.functions.invoke('submit-vote') | Edge Function call | WIRED | invoke with poll_id/choice_id body |
| useVoteCounts | supabase.from('vote_counts') | Supabase query | WIRED | RLS-gated query |
| usePolling | document.visibilityState | Visibility API | WIRED | Check before executing callback |
| submit-vote Edge Function | UNIQUE constraint | PostgreSQL 23505 | WIRED | Catches code '23505', returns 409 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| SuggestionList | suggestions | useSuggestions -> supabase.from('polls') | DB query with .eq('status') | FLOWING |
| SuggestionList | voteCounts | useVoteCounts -> supabase.from('vote_counts') | DB query, RLS-gated | FLOWING |
| SuggestionList | categories | useCategories -> supabase.from('categories') | DB query ordered by sort_order | FLOWING |
| ResultBars | choices/voteCounts | Props from SuggestionCard | Passed through from SuggestionList | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compiles | `npx tsc --noEmit` | Zero errors (empty output) | PASS |
| All suggestion tests pass | `npx vitest run src/__tests__/suggestions/` | 19/19 pass (3 files, 1.88s) | PASS |
| Topics route wired | grep SuggestionList src/routes/topics.tsx | Found: import + render | PASS |
| Archive route wired | grep SuggestionList src/routes/archive.tsx | Found: import + render | PASS |
| No Phase 1 remnants | grep lucide-react in route files | No matches | PASS |
| Edge Function exists | File check submit-vote/index.ts | Deno.serve present | PASS |
| Server-side status filter | grep .eq.*status in useSuggestions | Pattern found | PASS |
| UNIQUE violation handling | grep 23505 in submit-vote | Pattern found | PASS |

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
| RSLT-05 | 02-02 | Only respondents see results even after close | SATISFIED | RLS policy exists, ChoiceButtons closed message exists, archive.tsx now renders SuggestionList with status="closed" |
| CATG-02 | 02-01 | Active suggestions in browsable list | SATISFIED | topics.tsx renders SuggestionList with status="active", useSuggestions fetches from DB |
| CATG-03 | 02-01 | Filter by category tabs | SATISFIED | CategoryFilter component with role="tablist", wired through SuggestionList, tested |
| CATG-04 | 02-01 | Search/filter by text | SATISFIED | SearchBar with useDebounce, wired through SuggestionList, tested |
| INFR-04 | 02-02 | Response writes through Edge Functions | SATISFIED | submit-vote Edge Function handles all response writes |
| TEST-03 | 02-03 | Response submission and result visibility tests | SATISFIED | 19 tests pass covering vote submission, results visibility, suggestion list filtering |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/components/suggestions/SuggestionCard.tsx | ~122 | Comment: "Creator avatar placeholder -- profile data not in query yet" | INFO | Cosmetic only -- generic avatar circle shown. Does not block any Phase 2 goal. |

### Human Verification Required

### 1. Mobile-First Responsive Design

**Test:** Browse /topics on a phone-sized viewport (375px width). Open a suggestion, vote, view results.
**Expected:** Cards stack full-width, choice buttons are tap-friendly (min 44px targets), result bars are readable, no horizontal scroll anywhere.
**Why human:** SC6 requires visual verification of responsive layout, touch target sizing, and scroll behavior.

### 2. End-to-End Respond-Then-Reveal Flow

**Test:** Log in with Discord, navigate to /topics, expand a suggestion, click a choice button.
**Expected:** Spinner appears on clicked button, all buttons disabled, then replaced by result bars with percentages. Toast confirms "Response recorded".
**Why human:** Requires running Supabase Edge Function against real database, cannot verify with unit tests alone.

### 3. Live Polling Updates

**Test:** After voting, have a second user vote on the same suggestion. Watch the first user's result bars.
**Expected:** Counts update within 8 seconds without page refresh. When tab is backgrounded and re-focused, update fires.
**Why human:** Requires multiple simultaneous sessions and real-time observation.

### Gaps Summary

No gaps remaining. Both previously identified gaps have been closed by Plan 04:

1. **topics.tsx regression** -- CLOSED. File now imports and renders `<SuggestionList status="active" />` inside `<AuthGuard>`. No Phase 1 placeholder remnants.
2. **archive.tsx regression** -- CLOSED. File now imports and renders `<SuggestionList status="closed" />` inside `<AuthGuard>`. No Phase 1 placeholder remnants.

All 13 Phase 2 requirements are SATISFIED. All 26 artifacts are VERIFIED. All 13 key links are WIRED. All 4 data flows are FLOWING. TypeScript compiles clean. All 19 tests pass. Status is `human_needed` solely for 3 items requiring visual/interactive verification.

---

_Verified: 2026-04-07T05:15:00Z_
_Verifier: Claude (gsd-verifier)_
