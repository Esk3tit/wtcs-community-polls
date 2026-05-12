---
phase: 12-admin-ui-user-ui-uidn-03-sweep
reviewed: 2026-05-12T16:47:00Z
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
  warning: 1
  info: 4
  total: 5
status: issues_found
---

# Phase 12: Code Review Report (Iteration 2)

**Reviewed:** 2026-05-12T16:47:00Z
**Depth:** deep
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Iteration 2 re-review of the auto-fix loop. Iteration 1's BLOCKER fixes (CR-01 per-poll inflight `Set`, CR-02 functional `setItems`) and WARNING fixes (WR-01..05) are correctly implemented and verified through trace analysis of the optimistic-flip + polling paths. Gate replay (lint 0, tsc 0, vitest 14/14 on the touched specs) reproduces clean.

WR-06 (rot-tag removal from `src/`) is **incomplete**: six rot-tag comments still live under `src/__tests__/`. The CR/WR/IN tag taxonomy is in scope of CLAUDE.md's "no review-round / phase-ID archaeology in `src/`" rule — `src/__tests__/` is unambiguously `src/`. This is the only outstanding WARNING.

Four INFO-level concerns are net-new (not present in iteration 1) — three are minor quality regressions introduced by the iteration-1 rewrites, one is a pre-existing trivial-assertion test that the iteration-1 audit missed.

No new BLOCKER-class defects were introduced. The fix commits did not regress any verified behavior in the e2e or unit specs that exercise these surfaces.

## Warnings

### WR-01: Residual rot tags in `src/__tests__/` violate CLAUDE.md "no archaeology in src/" rule

**Files:**
- `src/__tests__/admin/image-input.test.tsx:50` — `// bug UIDN-03 D-13 set out to fix).`
- `src/__tests__/suggestions/suggestion-list.test.tsx:153` — `// Test 1: CATG-02 -- displays active suggestions from server-filtered query`
- `src/__tests__/suggestions/suggestion-list.test.tsx:174` — `// Test 2: CATG-03 -- filters by category when pill is clicked`
- `src/__tests__/suggestions/suggestion-list.test.tsx:214` — `// Test 3: CATG-04 -- searches by text with debounced input`
- `src/__tests__/suggestions/suggestion-list.test.tsx:243` — `// Test 4: CATG-04 -- shows no-matches empty state when filters exclude all`
- `src/__tests__/suggestions/suggestion-list.test.tsx:265` — `// Test 5: CATG-02 -- shows no-active empty state when no suggestions exist`

**Issue:** The phase context for WR-06 enumerated `UIDN-03, VIS-08, MR-06, LR-07, RSLT-04, D-NN` as rot tags to remove. The iteration-1 sweep (commit `ac3e861`) cleared production source files but left six rot tags in test files. Two distinct violations are present:

1. `image-input.test.tsx:50` carries `UIDN-03 D-13` — directly named in the WR-06 spec.
2. `suggestion-list.test.tsx` carries five `CATG-NN` rot tags — not literally listed in WR-06's enumeration but unambiguously the same anti-pattern per CLAUDE.md (`feedback_no_review_archaeology_in_source.md`: "source comments WHY-only, never cite plan/round/phase IDs").

The CLAUDE.md rule and the linked user memory both target `src/` as a whole, with no `__tests__/` exception. Leaving plan/phase IDs in tests rots identically once the planning artifacts are pruned — the test comment becomes a dangling reference to a phase ID with no surviving context.

**Fix:** Replace the rot-tag prefixes with the actual behavioral description the test exercises. Both the test name string and the human comment already describe the behavior; the `CATG-02` / `UIDN-03 D-13` prefixes carry zero semantic weight to a future reader.

```ts
// src/__tests__/admin/image-input.test.tsx:50
// Region MUST NOT also be a button (dual-role anti-pattern: a single
// landing zone should not announce as both region AND button to AT).
expect(
  screen.queryByRole('button', { name: /image upload/i }),
).toBeNull()
```

```ts
// src/__tests__/suggestions/suggestion-list.test.tsx — replace each tagged comment
// Test 1: displays active suggestions from server-filtered query
// Test 2: filters by category when pill is clicked
// Test 3: searches by text with debounced input
// Test 4: shows no-matches empty state when filters exclude all
// Test 5: shows no-active empty state when no suggestions exist
```

## Info

### IN-01: Closure-captured `title` mutated inside `setItems` updater (React purity violation)

**File:** `src/components/admin/AdminSuggestionsTab.tsx:128-143`

**Issue:** The iteration-1 functional-setItems fix introduced a side effect inside the state updater function. `title` is declared outside the updater (line 130), then reassigned inside the `setItems((cur) => { ... })` callback (line 133), then read after the updater completes (line 143).

```ts
let title = 'this suggestion'
setItems((cur) => {
  const target = cur.find((it) => it.id === pollId)
  if (target) title = target.title          // <-- side effect inside pure updater
  return cur.map((it) => ...)
})
...
const res = await toggleResultsVisibility({ poll_id: pollId, hidden: nextHidden, title })
```

React 19 in `StrictMode` (active per `src/main.tsx`) intentionally double-invokes state updaters in development to surface impure updaters. The reassignment is idempotent (`title` ends up with the same value either way), so the current behavior is correct — but the pattern silently violates the documented React contract and trains future readers that updaters can have side effects. If a future refactor changes the lookup to anything that can vary across invocations (e.g., a `Date.now()` stamp, a counter), the StrictMode-only second invocation will quietly desync the value.

The pattern was unnecessary — the row was already in state when the user clicked the Switch on it, so `items.find(...)` outside the updater reads the same data without breaching the updater contract.

**Fix:**
```ts
const handleToggleResultsVisibility = useCallback(
  async (pollId: string, nextHidden: boolean) => {
    // Read title from current state OUTSIDE the updater. The row is
    // guaranteed to exist because the user just clicked its Switch.
    const target = items.find((it) => it.id === pollId)
    const title = target?.title ?? 'this suggestion'

    setItems((cur) =>
      cur.map((it) =>
        it.id === pollId ? { ...it, results_hidden: nextHidden } : it,
      ),
    )
    // ... rest unchanged
  },
  [items, toggleResultsVisibility, fetchAll],
)
```

Adding `items` to the dep array does not break the CR-02 correctness argument — that argument is about the `setItems` UPDATER not capturing stale state, which the functional form already handles. The `title` lookup is read-only and reading stale `items` is harmless (`title` is cosmetic toast copy only).

### IN-02: `useVoteCounts` lacks stale-response guard; concurrent `fetchCounts` can race

**File:** `src/hooks/useVoteCounts.ts:35-99`

**Issue:** Iteration 1 added the `pollIdsKey` `useMemo` to stabilize the dep, and the initial fetch is deferred via `deferSetState`. However, `fetchCounts` itself has no fetch-ID guard like the one in `AdminSuggestionsTab.tsx:42-83` (`fetchIdRef`).

Two concurrent invocations are possible:
1. The deferred initial-fetch macrotask (`useEffect` line 103-108) fires AFTER `usePolling` has already scheduled the first tick (line 32 of `usePolling.ts`: `timeoutId = setTimeout(tick, delay)`). Both setTimeouts can be in flight if `delay` is short or the initial fetch is slow.
2. When `pollIdsKey` changes, the effect cleanup cancels the pending macrotask, BUT does not cancel an already-in-flight `fetchCounts` call from the previous `pollIdsKey`. The new effect schedules a fresh `fetchCounts`; both writes land via `setVoteCounts`/`setResultsHidden` in arrival order. The earlier (stale) result wins if it arrives last.

The race is benign in steady state (8 s cadence, sub-second responses) but not impossible — e.g., a slow first response after sign-in followed by a rapid `userVotes` update yields the stale data displayed.

`AdminSuggestionsTab` solved the same class of race with a `fetchIdRef` (line 45 increment + line 57/71/78/82 compare). For parity and defense-in-depth, `useVoteCounts` should adopt the same pattern.

**Fix:** Add a monotonic ID and compare before each setState:
```ts
const fetchIdRef = useRef(0)
const fetchCounts = useCallback(async () => {
  const id = ++fetchIdRef.current
  const ids = pollIdsKey ? pollIdsKey.split('|') : []
  if (ids.length === 0) {
    if (id !== fetchIdRef.current) return
    setVoteCounts(new Map())
    setResultsHidden(new Map())
    return
  }
  const [vcResult, hiddenResult] = await Promise.all([...])
  if (id !== fetchIdRef.current) return // stale
  // ... setState calls
}, [pollIdsKey])
```

### IN-03: Test `Browse Button is keyboard-reachable and activates with Enter` makes a tautological assertion

**File:** `src/__tests__/admin/image-input.test.tsx:92-103`

**Issue:** The test focuses the Browse button, asserts it has focus, sends `{Enter}`, then asserts:
```ts
expect(browse).toBeInTheDocument()
```

This assertion is true regardless of whether Enter did anything — the button never unmounts in this scenario. The test's title claims it verifies a keyboard regression but the body verifies nothing the focus/in-document checks didn't already prove. The companion test at lines 105-113 (`clicking Browse Button triggers the hidden file input`) DOES correctly use a click-spy on the hidden input; the Enter test should mirror that pattern.

The test's own comment acknowledges the gap ("the actual file picker open cannot be observed in jsdom"), but the right response is to spy on the hidden input's `.click()` and assert it fired on Enter — that's exactly the regression the test claims to guard.

**Fix:**
```ts
it('Browse Button is keyboard-reachable and activates with Enter (regression)', async () => {
  const user = userEvent.setup()
  const { container } = render(<ImageInput value={null} onChange={() => {}} />)
  const hiddenInput = container.querySelector('input[type="file"]') as HTMLInputElement
  const clickSpy = vi.spyOn(hiddenInput, 'click')
  const browse = screen.getByRole('button', { name: /browse files/i })
  browse.focus()
  expect(browse).toHaveFocus()
  await user.keyboard('{Enter}')
  // Enter on a focused native button dispatches click, which calls openPicker(),
  // which calls fileRef.current.click() — the actual regression contract.
  expect(clickSpy).toHaveBeenCalled()
})
```

### IN-04: Rapid double-click on same row's Switch creates a UX flicker without explanation

**Files:**
- `src/hooks/useToggleResultsVisibility.ts:17`
- `src/components/admin/AdminSuggestionsTab.tsx:128-165`

**Issue:** When the inflight gate (`inflightRef.current.has(input.poll_id)`) trips on a rapid second click on the SAME row, the hook returns `{ ok: false as const }` without toasting and without distinguishing this case from a real EF failure. The caller sees `!res.ok` and runs the revert + `fetchAll()` path identical to a real network error. The user sees the Switch flip-flicker (B→A→B) with no toast, no console warning, no aria-live status. This is indistinguishable from a flaky network from the user's perspective.

The Switch's `disabled={isPendingVisibility}` prop guards against this in practice, but the window between the first click's event handler running (`setPendingVisibility` queued) and the next React render (Switch becomes disabled) is non-zero. In React 19 concurrent mode the gap can stretch under load.

Additionally, after the second click hits the gate, the second handler's pending-removal step (line 144-148) DELETES the pollId from `pendingVisibility` while the FIRST request is still in flight — re-enabling the Switch prematurely. A third click in that window will hit the gate again.

This is not a correctness bug — `fetchAll` reconciles eventually — but it is a UX defect introduced by the iteration-1 inflight-Set design.

**Fix (one option):** Treat the inflight-gate trip as a distinct return shape and skip the optimistic-flip on the caller side:
```ts
// useToggleResultsVisibility.ts
if (inflightRef.current.has(input.poll_id)) {
  return { ok: false as const, reason: 'inflight' as const }
}
// ...
return { ok: false as const, reason: 'error' as const }
```
```ts
// AdminSuggestionsTab.tsx — short-circuit before optimistic state change
if (pendingVisibility.has(pollId)) return
```

Alternative: track pending count per-pollId so the second click's delete doesn't decrement below the first click's lifetime. The fundamental design (separate inflight state in hook vs pending state in caller) duplicates the same concept in two places, which is the root cause of the desync.

---

## Reviewer Verification Notes

The following iteration-1 fixes were verified through trace analysis:

- **CR-01** (`useToggleResultsVisibility.ts:13-43`) — per-poll `Set` correctly admits concurrent flips on different rows. Confirmed via reading the gate-check at line 17 and the `finally` cleanup at line 39.
- **CR-02** (`AdminSuggestionsTab.tsx:97-122, 128-165`) — both `handleTogglePin` and `handleToggleResultsVisibility` use functional `setItems((cur) => ...)`. No stale lexical capture of `items`.
- **WR-01** (`useVoteCounts.ts:30-33`) — `pollIdsRef` mutation in render is gone; `pollIdsKey` is a `useMemo`-stabilized derived string.
- **WR-02** (`useVoteCounts.ts:31`) — `[...votedPollIds].sort().join('|')` is order-insensitive.
- **WR-03** (`useVoteCounts.ts:68-72, 84-89`) — transient fetch errors keep previous counts/`resultsHidden` rather than resetting. Note: the zero-ids path (line 41-50) intentionally RESETS (sign-out clears stale results); the "preserve prior counts" claim applies specifically to the network-error blip, not the zero-ids input. Verified consistent with the inline comments.
- **WR-04** (`AdminSuggestionRow.tsx:90`) — `(v) => onToggleResultsVisibility(s.id, !v)`. Tautology removed.
- **WR-05** (`results-visibility.spec.ts:163-165`) — `toContainText('Results temporarily hidden by admin')` asserts the AlertTitle copy directly.
- **WR-06** — production source files clean; test files retain rot tags (see WR-01 above).

Gates: Vitest passes on the touched specs (14/14). ESLint clean across all 15 files.

---

_Reviewed: 2026-05-12T16:47:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
