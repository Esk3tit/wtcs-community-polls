---
phase: 12-admin-ui-user-ui-uidn-03-sweep
reviewed: 2026-05-13T00:24:26Z
depth: deep
files_reviewed: 16
files_reviewed_list:
  - e2e/fixtures/poll-fixture.ts
  - e2e/tests/results-visibility.spec.ts
  - src/__tests__/admin/image-input.test.tsx
  - src/__tests__/suggestions/suggestion-list.test.tsx
  - src/components/admin/AdminSuggestionRow.tsx
  - src/components/admin/AdminSuggestionsTab.tsx
  - src/components/suggestions/form/DropZone.tsx
  - src/components/suggestions/form/ImageInput.tsx
  - src/components/suggestions/SearchBar.tsx
  - src/components/suggestions/SuggestionCard.tsx
  - src/components/suggestions/SuggestionList.tsx
  - src/components/ui/checkbox.tsx
  - src/components/ui/switch.tsx
  - src/hooks/useToggleResultsVisibility.ts
  - src/hooks/useVoteCounts.ts
  - src/lib/types/database.types.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: issues_found
---

# Phase 12: Code Review Report (iter-4 / WR-01-residual verification)

**Reviewed:** 2026-05-13T00:24:26Z
**Depth:** deep
**Files Reviewed:** 16
**Status:** issues_found (Info-tier only; matches iter-2/iter-3 precedent — info findings keep `issues_found` per project taxonomy)

## Summary

Plain re-review checkpoint after commit `860c241` (the iter-3 follow-up fix
that closes WR-01 residual via Option A reorder). Verdict on the four
targeted checks from the orchestrator prompt:

**1. WR-01 residual is genuinely closed.** The reorder in
`handleToggleResultsVisibility` (AdminSuggestionsTab.tsx:158-169) moves the
`if (!res.ok && res.reason === 'inflight') return` guard ABOVE the
unconditional `setPendingVisibility` delete. Traced through all three return
paths (success, real error, inflight gate trip) and through the
rapid-double-click race against the same row. On inflight gate trip,
handler 2 now early-returns BEFORE touching `pendingVisibility`, so
handler 1's pending marker AND optimistic items flip both remain
authoritative until handler 1's EF resolves. No tampering by handler 2.
The exact failure mode the prior WR-01 documented ("its pending-delete
step re-enabled the Switch while the first request was still in flight")
is eliminated.

**2. `handleTogglePin` was not touched.**
`git diff 860c241^..860c241 -- src/components/admin/AdminSuggestionsTab.tsx`
shows the iter-3 commit modified only lines inside
`handleToggleResultsVisibility` (lines 128-186). `handleTogglePin`
(lines 97-122) is byte-identical to its iter-1 form. Re-read in full to
confirm.

**3. Inline comments are WHY-only with no rot tags.** Scanned all 16
in-scope files for plan/round/phase/iter IDs (`WR-`, `CR-`, `IN-`, `HI-`,
`LR-`, `ME-`, `VIS-`, `phase N`, `round N`, `iter-N`, `review-round`). The
only ID-shaped matches are `E2E-SCOPE-1` in `poll-fixture.ts:14` and
`results-visibility.spec.ts:44,115` — these are PROJECT LINT CONVENTION
IDs referenced by name in the comments themselves ("the project's
E2E-SCOPE-1 lint convention"), NOT review/plan archaeology. Allowed per
`feedback_no_review_archaeology_in_source.md` ("plan refs belong in
PR/commit, not src/"). The new comments inserted by commit `860c241`
(lines 158-163, 171-172) explain WHY (inflight ownership, source of
truth) without mentioning plan IDs.

**4. No regressions introduced by the reorder.** Per-path trace:

| Path | Behaviour | Identical to pre-reorder? |
|---|---|---|
| Success (`res.ok === true`) | Line 164 guard's `!res.ok` is false → skipped. Pending cleared at 165-169. `!res.ok` block at 170 skipped. `fetchAll` at 183 runs. | yes |
| Real error (`res.ok === false`, `reason === 'error'`) | Line 164 guard's `reason === 'inflight'` is false → NOT taken. Pending cleared at 165-169. Revert + `fetchAll` at 170-181 runs. | yes |
| Inflight gate trip (`res.ok === false`, `reason === 'inflight'`) | NEW: early return at 164 BEFORE pending-delete. Pending stays set (handler 1 still owns it). Items stay flipped (handler 1's flip is source of truth). | new — this is the fix |
| Rapid double-click same row | Handler 2's caller-side `pendingVisibility.has` guard misses (stale closure); handler 2 still calls `setItems` and `setPendingVisibility` idempotently (no-ops on already-flipped row and already-added set), then awaits the hook, gets synchronous inflight rejection, early-returns at 164. Net: zero state change from handler 2. | net no-op |
| Three rapid clicks (restoration on click 3) | Either caller-side guard catches click 3 (pending set committed) or hook-side gate catches it (pending not committed). Either way, handler 1's `fetchAll` reconciles to server truth. Two-flip UI wobble is acceptable for genuine 3-click input. | acceptable |

**Cross-file deep checks (depth=deep):**

- `useToggleResultsVisibility` discriminated-union return shape
  (`{ok: true} | {ok: false, reason: 'inflight'} | {ok: false, reason: 'error'}`)
  narrows correctly at the AdminSuggestionsTab call site. TS check
  `!res.ok && res.reason === 'inflight'` narrows `res` to the inflight
  variant without `as` casts.
- `useToggleResultsVisibility`'s inflight gate is per-poll-id (`Set`), and
  the gate's `inflightRef.delete` runs in the `try`/`finally` regardless
  of the EF outcome. Confirmed that synchronous-inflight-branch early
  return (hook line 21-22) does NOT enter the `try` block and therefore
  does NOT remove the gate that handler 1 still owns.
- `useVoteCounts` stale-fetch guard (line 79) precedes BOTH
  `setVoteCounts` (94) and `setResultsHidden` (110); no async work
  separates them so a single guard at line 79 covers the paired writes
  atomically per fetch generation. Empty-path also guarded at line 55.
- `SuggestionCard` hidden-state branch (line 132-147) preserves the
  voter's-choice context inside the same alert wrapper — matches the e2e
  spec's STEP 4 assertion against `results-hidden-alert-${pollId}`
  testid (line 142). STEP 6 post-unhide check targets `role="meter"`
  inside `ResultBars`, the documented stable marker.
- `database.types.ts` schema reports `vote_counts.count: number` (NOT
  NULL); `AdminSuggestionsTab.tsx:72` defensively casts to
  `Array<{count: number | null}>` and coalesces with `?? 0`. The
  defensive code is correct regardless of which type is right — see
  IN-01 below.
- e2e `poll-fixture` ↔ `results-visibility.spec.ts`: spec generates its
  own `[E2E] results-visibility ${Date.now()}` title (line 47) for the
  EF-driven create; fixture's `Date.now()-${testInfo.workerIndex}` slug
  is intentionally unused by this spec. No contamination. The spec's
  service-role `eq('title', title).single()` is deterministic per run
  because `Date.now()` is millisecond-unique.
- `poll-fixture.ts` setup/teardown error handling: `setupErr` and
  `deleteErr` correctly preserved through `try`/`catch`/`finally`;
  `AggregateError` constructor used to surface both when both fail.
  Re-throw logic at lines 117-124 runs after `finally` to satisfy
  `no-unsafe-finally`. Comment at lines 102-105 correctly documents that
  `provide()` resolves normally on test-body failure (Playwright fixture
  semantic), so test-body failures don't flow through `catch`.

No new bugs found. Two Info-tier items remain.

## Critical Issues

_(none)_

## Warnings

_(none)_

## Info

### IN-01: vote_counts.count schema-widening type cast (iter-3 IN-01 carryover, still open)

**File:** `src/components/admin/AdminSuggestionsTab.tsx:72`
**Issue:** The cast `(vcData ?? []) as Array<{ poll_id: string; count: number | null }>` widens `vote_counts.count` from the typegen-declared `number` (`src/lib/types/database.types.ts:237`) to nullable. The downstream `(r.count ?? 0)` coalesce works regardless, so this is correctness-neutral, but the assertion lies about the schema — either the typegen is wrong (column is actually nullable at the view level), or the assertion is wrong (column is non-null and the coalesce is defensive against a non-existent case).
**Carryover note:** Open intentionally. The phase_context confirms the user ran `--fix` only on the WR-01 residual, not `--all`. Listed here for tracking continuity with iter-3 review.
**Fix:** Two options:
  1. If `count` truly cannot be null (matches schema), drop the wider type assertion and the `?? 0`:
     ```typescript
     for (const r of (vcData ?? []) as Array<{ poll_id: string; count: number }>) {
       counts[r.poll_id] = (counts[r.poll_id] ?? 0) + r.count
     }
     ```
     Or simply import the generated `Tables<'vote_counts'>` row type to avoid restating the shape inline.
  2. If view-level nullability genuinely exists, regenerate types from the live DB (`supabase gen types typescript`) so the schema reflects reality and the wider cast becomes redundant rather than contradictory.

### IN-02: handleTogglePin has a structurally similar latent race that the iter-3 WR-01 fix did not address (intentional per phase_context — surfaced for visibility)

**File:** `src/components/admin/AdminSuggestionsTab.tsx:97-122` (caller) and `src/hooks/usePinPoll.ts:8-13` (hook)
**Issue:** `usePinPoll` uses a SINGLETON boolean `inflightRef` (`useRef(false)` at line 8) and returns plain `{ ok: false }` with no `reason` discriminant on the inflight branch (line 12). Consequently `handleTogglePin` CANNOT distinguish "rapid double-click on same row" (handler 2 saw handler 1's inflight) from "real EF/network error". On the second handler's `{ok: false}` return, `handleTogglePin` (lines 105-117) reverts items unconditionally — overwriting handler 1's still-pending optimistic flip. Handler 1's eventual `fetchAll` reconciles to server truth, so this is a UI-flicker concern (pin → unpin → pin), not a data correctness bug. Same SHAPE as the WR-01 residual that was just fixed in `handleToggleResultsVisibility`, with two key differences making it worse:
  - The singleton inflight gate in `usePinPoll` also blocks pin-flips on DIFFERENT rows while any one is in flight (a separate, pre-existing issue).
  - `handleTogglePin` has no caller-side pending-set guard at all (no `pendingPin` equivalent to `pendingVisibility`).
**Carryover note:** phase_context explicitly asked to verify `handleTogglePin` "wasn't accidentally touched" — confirmed it was not. The latent issue here is OUT of scope for the iter-3 fix and is surfaced as Info only so a future phase planner can decide whether to harmonize the two handlers. Not a regression; pre-existing as of iter-1.
**Fix (if a future phase wants to harmonize):**
  1. Change `usePinPoll` to a per-poll `Set<string>` like `useToggleResultsVisibility` (the singleton gate also blocks legitimate concurrent pin-flips on different rows — a separate, latent bug).
  2. Add a `reason: 'inflight' | 'error'` discriminant to the failure return.
  3. Apply the Option A reorder in `handleTogglePin` (early-return on `res.reason === 'inflight'` before any revert):
     ```tsx
     const res = await pinPoll({ poll_id: pollId, is_pinned: nextPinned })
     if (!res.ok && res.reason === 'inflight') return
     if (!res.ok) {
       setItems((cur) => sortAdminSuggestions(
         cur.map((it) => (it.id === pollId ? { ...it, is_pinned: !nextPinned } : it)),
       ))
       void fetchAll()
       return
     }
     void fetchAll()
     ```

---

_Reviewed: 2026-05-13T00:24:26Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
