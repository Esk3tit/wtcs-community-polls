---
phase: 02-browsing-responding
reviewed: 2026-04-06T12:00:00Z
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
  critical: 2
  warning: 5
  info: 4
  total: 11
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-04-06T12:00:00Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

Phase 2 implements the browsing and responding flow: suggestion listing with filtering/search, vote submission via Supabase Edge Function, result display with polling, and associated tests. The code is generally well-structured with good separation of concerns, proper ARIA attributes, and solid test coverage.

Key concerns: (1) the CORS configuration uses a wildcard origin which is a security risk for an authenticated endpoint, (2) the Edge Function crashes on missing Authorization header, (3) the `useVoteSubmit` hook has a stale closure over `submittingPollId` that can silently bypass the double-submit guard, and (4) silent error swallowing in data-fetching hooks means users see empty states instead of error messages when queries fail.

## Critical Issues

### CR-01: Edge Function crashes when Authorization header is missing

**File:** `supabase/functions/submit-vote/index.ts:12`
**Issue:** The non-null assertion `req.headers.get('Authorization')!` will pass `null` into the Supabase client if the header is absent (e.g., unauthenticated request, bot probe). While `getUser()` would eventually fail, passing `null` as a header value is undefined behavior and could produce confusing 500 errors instead of a clean 401. More critically, if Supabase client construction throws on `null`, the generic catch block returns "Internal error" -- obscuring the real issue.
**Fix:**
```typescript
const authHeader = req.headers.get('Authorization')
if (!authHeader) {
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
const supabaseUser = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!,
  { global: { headers: { Authorization: authHeader } } }
)
```

### CR-02: Wildcard CORS origin on authenticated endpoint

**File:** `supabase/functions/_shared/cors.ts:2`
**Issue:** `Access-Control-Allow-Origin: *` allows any website to make authenticated requests to the `submit-vote` Edge Function. Since the function processes JWT-authenticated vote submissions, an attacker could craft a malicious page that submits votes on behalf of any logged-in user who visits it (CSRF via CORS). This is especially dangerous because Discord OAuth tokens may be stored as cookies/localStorage that browsers attach automatically.
**Fix:**
```typescript
export const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? 'https://polls.wtcsmapvote.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```
Set `ALLOWED_ORIGIN` to the actual frontend domain. For local development, use an environment variable override.

## Warnings

### WR-01: Stale closure in useVoteSubmit double-submit guard

**File:** `src/hooks/useVoteSubmit.ts:13`
**Issue:** The `submitVote` callback has `submittingPollId` in its dependency array (line 48), but the guard `if (submittingPollId) return` on line 13 captures the value at the time the callback was created. Because `setSubmittingPollId` triggers a re-render that creates a new callback, a rapid double-click could invoke the old callback reference (where `submittingPollId` is still `null`) before React re-renders. The `useCallback` dependency on `submittingPollId` partially mitigates this but does not guarantee the guard fires correctly under race conditions.
**Fix:** Use a ref for the guard instead of relying on state:
```typescript
const submittingRef = useRef(false)

const submitVote = useCallback(async (pollId: string, choiceId: string) => {
  if (submittingRef.current) return
  submittingRef.current = true
  setSubmittingPollId(pollId)
  setSubmittingChoiceId(choiceId)
  try {
    // ... existing logic
  } finally {
    submittingRef.current = false
    setSubmittingPollId(null)
    setSubmittingChoiceId(null)
  }
}, [addOptimisticVote, refetchVoteCounts])
```

### WR-02: Silent error swallowing in useCategories

**File:** `src/hooks/useCategories.ts:16-17`
**Issue:** When the Supabase query fails, the error is silently ignored (`if (!error && data)`). The user sees an empty category list with no indication that something went wrong. This makes debugging production issues difficult and provides a degraded UX without explanation.
**Fix:**
```typescript
if (error) {
  console.error('Failed to fetch categories:', error)
  // Consider exposing error state: setError(error.message)
}
if (data) {
  setCategories(data)
}
```

### WR-03: Silent error swallowing in useSuggestions

**File:** `src/hooks/useSuggestions.ts:25-27`
**Issue:** Same pattern as WR-02. When the polls query or votes query fails, errors are silently dropped. The user sees an empty suggestion list (potentially triggering the "No active topics" empty state) when the real problem is a network or auth failure.
**Fix:**
```typescript
if (error) {
  console.error('Failed to fetch suggestions:', error)
  // Consider adding an error state to surface to the UI
}
```

### WR-04: Silent error swallowing in useVoteCounts

**File:** `src/hooks/useVoteCounts.ts:23-37`
**Issue:** The vote counts query silently discards errors. If the `vote_counts` view is inaccessible (RLS misconfiguration, network issue), result bars will show 0 votes with no indication of failure. This could mislead users into thinking a poll has no responses.
**Fix:** Add error logging and consider an error state:
```typescript
const { data: counts, error } = await supabase
  .from('vote_counts')
  .select('poll_id, choice_id, count')
  .in('poll_id', votedPollIds)

if (error) {
  console.error('Failed to fetch vote counts:', error)
  return // Keep previous counts rather than resetting to empty
}
```

### WR-05: SuggestionCard always open for pinned items has no toggle affordance

**File:** `src/components/suggestions/SuggestionCard.tsx:153-157`
**Issue:** When `isPinned` is true, the card renders `{cardContent}` directly without wrapping it in a `CollapsibleTrigger`. This means pinned cards are always expanded and the user cannot collapse them. However, the ChevronDown icon (line 134-139) is still rendered and rotates based on `isOpen` state, suggesting the card should be collapsible. The chevron misleads users into thinking they can interact with it, but clicking does nothing on pinned cards (no trigger wraps the content).
**Fix:** Either remove the ChevronDown icon for pinned cards, or wrap pinned card content in a CollapsibleTrigger as well:
```tsx
{/* Option A: Hide chevron for pinned */}
{!isPinned && (
  <ChevronDown
    className={cn(
      'size-4 text-muted-foreground transition-transform',
      isOpen && 'rotate-180'
    )}
  />
)}
```

## Info

### IN-01: Unused `totalResponses` prop could show stale value

**File:** `src/components/suggestions/ChoiceButtons.tsx:13`
**Issue:** The `totalResponses` prop is accepted but only used for the footer text. It originates from `voteCounts` in `SuggestionCard`, which may be `undefined` (defaulting to `0`). Before the user votes, `voteCounts` is empty so `totalResponses` is always `0`, making the "Be the first to respond" message show even when there are existing responses. This is by design (pre-vote users should not see counts), but worth documenting the intent explicitly.
**Fix:** Add a comment clarifying this is intentional:
```typescript
// totalResponses is 0 for non-voters by design (RLS hides counts until user votes)
```

### IN-02: Unused import in test file

**File:** `src/__tests__/suggestions/suggestion-list.test.tsx:3`
**Issue:** `act` is imported from `@testing-library/react` but never used in any test case. Similarly `userEvent` is imported on line 3 but never used.
**Fix:** Remove unused imports:
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
// Remove: import userEvent from '@testing-library/user-event'
```

### IN-03: Unused import in test file

**File:** `src/__tests__/suggestions/vote-submission.test.tsx:3`
**Issue:** `waitFor` is imported from `@testing-library/react` but never used.
**Fix:** Remove `waitFor` from the import:
```typescript
import { render, screen, fireEvent, act } from '@testing-library/react'
```

### IN-04: `as unknown as` type assertion in useSuggestions

**File:** `src/hooks/useSuggestions.ts:26`
**Issue:** The double assertion `polls as unknown as SuggestionWithChoices[]` bypasses TypeScript's type checking entirely. This is a code smell that could hide type mismatches between the Supabase query shape and the `SuggestionWithChoices` interface (e.g., if the query result has `categories` as an array but the type expects a single object).
**Fix:** Consider using Supabase's generated types or a runtime validation layer. If the assertion must stay, add a comment explaining why:
```typescript
// Supabase join types don't match our flattened interface; validated by test coverage
setSuggestions(polls as unknown as SuggestionWithChoices[])
```

---

_Reviewed: 2026-04-06T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
