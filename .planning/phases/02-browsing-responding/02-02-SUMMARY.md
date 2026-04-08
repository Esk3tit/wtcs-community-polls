---
phase: 02-browsing-responding
plan: 02
subsystem: voting-and-results
tags: [edge-function, voting, polling, results, archive]
dependency_graph:
  requires: [02-01]
  provides: [submit-vote-edge-function, vote-ui-components, result-bars, archive-page]
  affects: [03-01, 04-01]
tech_stack:
  added: [deno-edge-function, sonner-toast]
  patterns: [race-safe-unique-constraint, rls-gated-results, visibility-api-polling, optimistic-updates]
key_files:
  created:
    - supabase/functions/_shared/cors.ts
    - supabase/functions/submit-vote/index.ts
    - src/hooks/usePolling.ts
    - src/hooks/useVoteSubmit.ts
    - src/hooks/useVoteCounts.ts
    - src/components/suggestions/ChoiceButtons.tsx
    - src/components/suggestions/ResultBars.tsx
  modified:
    - src/components/suggestions/SuggestionCard.tsx
    - src/components/suggestions/SuggestionList.tsx
    - src/routes/archive.tsx
decisions:
  - Race-safe duplicate prevention via DB UNIQUE constraint (23505 -> 409), no check-then-insert
  - RLS-enforced respondent-gated result visibility on vote_counts table
  - 8-second polling interval with visibility API pause for active suggestions
  - Archive page reuses SuggestionList with status="closed" for RSLT-05 verification
metrics:
  duration: 3m
  completed: 2026-04-07
  tasks_completed: 2
  tasks_total: 2
  files_created: 7
  files_modified: 3
---

# Phase 02 Plan 02: Vote Submission & Result Display Summary

Edge Function vote submission with race-safe UNIQUE constraint enforcement, respondent-gated result bars with 8s live polling via visibility API, and Archive page for closed suggestion results.

## What Was Built

### Task 1: Edge Function, Voting Hooks, and Choice/Result Components

**submit-vote Edge Function** (`supabase/functions/submit-vote/index.ts`):
- CORS preflight handling
- JWT authentication via `getUser()`
- Poll-active status validation (rejects votes on closed suggestions)
- Choice-poll relationship validation (prevents cross-poll choice injection)
- Direct INSERT with UNIQUE constraint (`votes_one_per_user_per_poll`) as race-safe duplicate prevention -- catches PostgreSQL error code `23505` and returns HTTP 409

**usePolling hook** (`src/hooks/usePolling.ts`):
- Generic `setInterval`-based polling with configurable delay
- `document.visibilityState` check prevents background tab queries
- `clearInterval` cleanup on unmount or delay change
- Pass `delay=null` to disable (used for closed suggestions)

**useVoteSubmit hook** (`src/hooks/useVoteSubmit.ts`):
- Invokes Edge Function via `supabase.functions.invoke('submit-vote')`
- Double-click protection via `submittingPollId` state gating
- Optimistic vote update + immediate vote count refetch on success
- Toast notifications for success, duplicate, and error states

**useVoteCounts hook** (`src/hooks/useVoteCounts.ts`):
- Fetches `vote_counts` table (RLS enforces respondent-only visibility)
- Returns `Map<pollId, Map<choiceId, count>>` structure
- Polls every 8 seconds for active suggestions via usePolling
- Disabled polling for closed suggestions (fetch once on mount)

**ChoiceButtons component** (`src/components/suggestions/ChoiceButtons.tsx`):
- Pre-vote: renders choice buttons in 2-col grid (2 choices) or 1-col (3+)
- Spinner on clicked button during submission, all buttons disabled
- Closed + not responded: shows "This topic is closed" message
- Footer shows response count or "Be the first to respond"

**ResultBars component** (`src/components/suggestions/ResultBars.tsx`):
- Post-vote: percentage bars with `role="meter"` accessibility
- User's choice highlighted with Check icon and `bg-primary` bar
- Non-user choices use `bg-muted-foreground/20`
- Uses `calcPercentage` from format.ts

### Task 2: Wire Voting into SuggestionCard/List and Build Archive

**SuggestionCard** updated to render real components:
- Pre-vote / closed+not-responded: renders ChoiceButtons
- Post-vote: renders ResultBars with live vote counts
- Removed `data-slot="choices"` placeholder entirely

**SuggestionList** wired with voting hooks:
- `useVoteCounts(votedPollIds, enablePolling)` for live counts
- `useVoteSubmit(addOptimisticVote, refetchVoteCounts)` for submission
- Passes real `submitVote`, `voteCounts`, `submittingPollId`, `submittingChoiceId` to cards
- `enablePolling = status === 'active'` -- closed suggestions fetch once

**Archive page** (`src/routes/archive.tsx`):
- Replaced shell with `<SuggestionList status="closed" />`
- Reuses all filtering, card rendering, and result display infrastructure
- Enables RSLT-05 verification (respondent-gated results after close)

## Deviations from Plan

None -- plan executed exactly as written.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | e3d0285 | feat(02-02): add vote submission Edge Function, polling hooks, and choice/result components |
| 2 | 8f1b949 | feat(02-02): wire voting and results into SuggestionCard/List and build Archive page |

## Threat Mitigations Implemented

| Threat ID | Mitigation |
|-----------|------------|
| T-02-04 | JWT auth + poll-active check + choice-poll validation + direct INSERT with UNIQUE constraint |
| T-02-05 | Edge Function validates `choice.poll_id === poll_id` via dual equality query |
| T-02-06 | DB UNIQUE constraint `votes_one_per_user_per_poll`, catches 23505 -> 409 |
| T-02-07 | RLS on `vote_counts` requires existing vote record; non-voters get zero rows |
| T-02-08 | JWT verification via `getUser()` as first operation after CORS |
| T-02-11 | Poll status check before INSERT, returns 400 for non-active polls |

## Known Stubs

None -- all components are wired to real data sources via Supabase hooks.

## Self-Check: PASSED

All 10 files verified present. Both commits (e3d0285, 8f1b949) verified in git log. TypeScript compilation passes with zero errors.
