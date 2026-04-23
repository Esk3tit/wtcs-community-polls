---
phase: 02-browsing-responding
reviewed: 2026-04-06T21:58:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - src/components/suggestions/CategoryFilter.tsx
  - src/components/suggestions/ChoiceButtons.tsx
  - src/components/suggestions/EmptyState.tsx
  - src/components/suggestions/PinnedBanner.tsx
  - src/components/suggestions/ResultBars.tsx
  - src/components/suggestions/SearchBar.tsx
  - src/components/suggestions/StatusBadge.tsx
  - src/components/suggestions/SuggestionCard.tsx
  - src/components/suggestions/SuggestionList.tsx
  - src/components/suggestions/SuggestionSkeleton.tsx
  - src/components/ui/badge.tsx
  - src/components/ui/collapsible.tsx
  - src/components/ui/input.tsx
  - src/components/ui/progress.tsx
  - src/hooks/useCategories.ts
  - src/hooks/useDebounce.ts
  - src/hooks/usePolling.ts
  - src/hooks/useSuggestions.ts
  - src/hooks/useVoteCounts.ts
  - src/hooks/useVoteSubmit.ts
  - src/lib/format.ts
  - src/lib/types/suggestions.ts
  - supabase/functions/_shared/cors.ts
  - supabase/functions/submit-vote/index.ts
  - supabase/seed.sql
  - src/__tests__/suggestions/results-visibility.test.tsx
  - src/__tests__/suggestions/suggestion-list.test.tsx
  - src/__tests__/suggestions/vote-submission.test.tsx
findings:
  critical: 0
  warning: 0
  info: 4
  total: 4
status: clean
---

# Phase 2: Code Review Report (Iteration 2)

**Reviewed:** 2026-04-06T21:58:00Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** clean

## Summary

This is iteration 2 of the code review, following fixes applied for all 7 issues (2 critical, 5 warning) identified in iteration 1. All fixes have been verified as correctly applied:

- **CR-01 (Auth header null check):** `submit-vote/index.ts` now guards against missing Authorization header with an explicit null check and clean 401 response before constructing the Supabase client. Verified at lines 12-18.
- **CR-02 (CORS wildcard):** `cors.ts` now uses `Deno.env.get('ALLOWED_ORIGIN')` with a safe production default of `https://polls.wtcsmapban.com`. Verified at line 2.
- **WR-01 (Double-submit guard):** `useVoteSubmit.ts` now uses a `useRef(false)` guard that is synchronously set before async work, eliminating the stale closure race condition. Dependencies correctly reduced to `[addOptimisticVote, refetchVoteCounts]`. Verified at lines 11, 14, 51.
- **WR-02/03/04 (Silent error swallowing):** `useCategories.ts`, `useSuggestions.ts`, and `useVoteCounts.ts` all now log errors via `console.error` with descriptive messages. `useVoteCounts` additionally preserves previous state on error instead of resetting. Verified in each file.
- **WR-05 (Misleading chevron on pinned cards):** `SuggestionCard.tsx` now conditionally renders the ChevronDown icon only for non-pinned cards via `{!isPinned && (...)}`. Verified at line 134.

No new critical or warning issues were introduced by the fixes. The codebase is well-structured with proper input validation on the Edge Function, race-safe vote submission, correct CORS restrictions, RLS-enforced result visibility, and solid test coverage across 3 test suites. Four minor info-level observations from iteration 1 are carried forward for completeness.

## Info

### IN-01: Unused `totalResponses` shows 0 for non-voters (by design)

**File:** `src/components/suggestions/ChoiceButtons.tsx:13`
**Issue:** The `totalResponses` prop is `0` for non-voters because `voteCounts` is empty pre-vote (RLS hides counts). The "Be the first to respond" message may display even when responses exist. This is by design -- pre-vote users should not see counts -- but a clarifying comment would help future maintainers.
**Fix:** Add a comment:
```typescript
// totalResponses is 0 for non-voters by design (RLS hides counts until user votes)
```

### IN-02: Unused imports in suggestion-list test

**File:** `src/__tests__/suggestions/suggestion-list.test.tsx:3`
**Issue:** `act` (from `@testing-library/react`) and `userEvent` (from `@testing-library/user-event`) are imported but never used in any test case. TypeScript's `noUnusedLocals` should catch this at build time.
**Fix:** Remove unused imports:
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
// Remove: import userEvent from '@testing-library/user-event'
```

### IN-03: Unused import in vote-submission test

**File:** `src/__tests__/suggestions/vote-submission.test.tsx:3`
**Issue:** `waitFor` is imported from `@testing-library/react` but never used.
**Fix:** Remove `waitFor` from the import:
```typescript
import { render, screen, fireEvent, act } from '@testing-library/react'
```

### IN-04: Double type assertion in useSuggestions

**File:** `src/hooks/useSuggestions.ts:29`
**Issue:** `polls as unknown as SuggestionWithChoices[]` bypasses TypeScript's type checking entirely. This could hide mismatches between the Supabase query result shape and the `SuggestionWithChoices` interface. The test suite provides some coverage, but a runtime shape mismatch would surface as a silent rendering bug rather than a type error.
**Fix:** Add a clarifying comment:
```typescript
// Supabase join types don't match our flattened interface; validated by test coverage
setSuggestions(polls as unknown as SuggestionWithChoices[])
```

---

_Reviewed: 2026-04-06T21:58:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
