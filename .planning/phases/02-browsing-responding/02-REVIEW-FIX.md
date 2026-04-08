---
phase: 02-browsing-responding
fixed_at: 2026-04-06T12:30:00Z
review_path: .planning/phases/02-browsing-responding/02-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-04-06T12:30:00Z
**Source review:** .planning/phases/02-browsing-responding/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: Edge Function crashes when Authorization header is missing

**Files modified:** `supabase/functions/submit-vote/index.ts`
**Commit:** 12d7907
**Applied fix:** Removed non-null assertion on `req.headers.get('Authorization')`. Added explicit null check that returns a clean 401 JSON response with CORS headers before the Supabase client is constructed.

### CR-02: Wildcard CORS origin on authenticated endpoint

**Files modified:** `supabase/functions/_shared/cors.ts`
**Commit:** 9dce379
**Applied fix:** Replaced `Access-Control-Allow-Origin: *` with `Deno.env.get('ALLOWED_ORIGIN') ?? 'https://polls.wtcsmapvote.com'`. Production defaults to the real domain; local development can override via the `ALLOWED_ORIGIN` environment variable.

### WR-01: Stale closure in useVoteSubmit double-submit guard

**Files modified:** `src/hooks/useVoteSubmit.ts`
**Commit:** 8dec04c
**Applied fix:** Added `useRef(false)` as a race-safe guard (`submittingRef.current`). The ref is set to `true` synchronously before any async work and reset in the `finally` block. Removed `submittingPollId` from the `useCallback` dependency array since the ref-based guard eliminates the stale closure issue. State setters (`setSubmittingPollId`, `setSubmittingChoiceId`) are retained for UI feedback.

### WR-02: Silent error swallowing in useCategories

**Files modified:** `src/hooks/useCategories.ts`
**Commit:** a2552a9
**Applied fix:** Split the `if (!error && data)` guard into separate `if (error)` and `if (data)` blocks. Errors are now logged via `console.error('Failed to fetch categories:', error)`. Data is still set when available (error and data are not mutually exclusive in Supabase responses).

### WR-03: Silent error swallowing in useSuggestions

**Files modified:** `src/hooks/useSuggestions.ts`
**Commit:** 13501d4
**Applied fix:** Same pattern as WR-02. Split the `if (!error && polls)` guard into separate error logging and data-setting blocks. Errors are logged via `console.error('Failed to fetch suggestions:', error)`.

### WR-04: Silent error swallowing in useVoteCounts

**Files modified:** `src/hooks/useVoteCounts.ts`
**Commit:** 00aabdc
**Applied fix:** Destructured `error` from the Supabase query response. On error, logs via `console.error` and returns early -- preserving the previous `voteCounts` state rather than resetting to an empty map. This prevents misleading "0 votes" display when the query fails.

### WR-05: SuggestionCard always open for pinned items has no toggle affordance

**Files modified:** `src/components/suggestions/SuggestionCard.tsx`
**Commit:** 39c52db
**Applied fix:** Wrapped the `ChevronDown` icon in `{!isPinned && (...)}` so it only renders for non-pinned (collapsible) cards. Pinned cards are always expanded and no longer show a misleading interactive chevron.

## Skipped Issues

None -- all findings were fixed.

---

_Fixed: 2026-04-06T12:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
