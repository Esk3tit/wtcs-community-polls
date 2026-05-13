# Phase 03 Deferred Items

## Pre-existing Test Failures (out of scope)

**File:** `src/__tests__/suggestions/vote-submission.test.tsx`
**Tests:** "shows error toast on duplicate vote (409 UNIQUE violation)" and "rejects vote with missing choice_id (400 error)"
**Root cause:** Mock pattern uses `{ data: { error: '...' }, error: { message: '...' } }` but `useVoteSubmit` expects `{ data: null, error: { context: { json: () => ... } } }` (supabase-js v2 FunctionsHttpError pattern). The mocks don't match the actual error handling path.
**Discovered during:** Plan 02 Task 1 full test suite run
**Verified:** Same failures exist on base commit (a4f4275) without Plan 02 changes
**Impact:** These tests give false negatives -- the actual error handling works correctly (as demonstrated by the new rate-limit-toast tests which use the correct mock pattern)
