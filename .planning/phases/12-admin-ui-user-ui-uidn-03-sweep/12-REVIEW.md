---
phase: 12-admin-ui-user-ui-uidn-03-sweep
reviewed: 2026-05-12T00:00:00Z
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
  critical: 2
  warning: 6
  info: 5
  total: 13
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-05-12T00:00:00Z
**Depth:** deep
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 12 ships VIS-06 (admin Checkbox at create), VIS-07 (admin Switch + optimistic toast on `AdminSuggestionRow`), VIS-08 (voter hidden-state Alert + 8s polling on `polls_effective`), UIDN-03 (shadcn cleanup), and TEST-13 (Playwright happy-path). The `polls_effective` read invariant is preserved across the changed files (`useVoteCounts.ts` and `AdminSuggestionsTab.tsx` both go through the view; the lint-time regex guard in `polls-effective-invariant.test.ts` remains satisfied for the new code).

Cross-file analysis surfaced two **BLOCKER** correctness defects:

1. The `useToggleResultsVisibility` hook holds a *singleton* `inflightRef` gate. The caller (`AdminSuggestionsTab`) advertises **per-row** independence via a `pendingVisibility: Set<string>` and disables only the originating row's `Switch` — but a second row's flip submitted while the first is in flight is **silently swallowed** by the hook's early return. The optimistic UI flips back when no EF call is ever made, with no toast and no recovery path. This breaks the "multiple rows in-flight independently" contract written into the inline comment.

2. The `handleToggleResultsVisibility` (and `handleTogglePin`) optimistic-update closure captures `items` lexically and rolls back to `prev = items`. Two concurrent flips against different rows race: the second flip's `prev` snapshot already contains the first flip's optimistic mutation, and on first-flip failure the revert path restores the *combined* state, masking the second flip's effect. Functional `setItems` (or per-poll diff-revert) is required.

The remaining warnings concern stale-closure / render-phase mutation in `useVoteCounts`, an out-of-scope WHY-only-comment policy breach across six source files, and an E2E spec assertion that does not match the production hidden-alert markup. Findings below are ordered by severity.

## Critical Issues

### CR-01: `useToggleResultsVisibility` global inflight gate silently drops concurrent per-row flips

**File:** `src/hooks/useToggleResultsVisibility.ts:14-15`
**Issue:** The hook returns one closure with one `inflightRef`. The early-return `if (inflightRef.current) return { ok: false as const }` blocks the EF invoke for *any* second call while another is in flight — regardless of `poll_id`. But the consumer in `AdminSuggestionsTab` (line 121) optimistically flips `results_hidden` for the second row, sets a per-row pending entry, then receives `{ ok: false }` *without* a toast (the hook's error toasts only fire after a real `error` or `catch`, never on the inflight bail-out). The result: the row's `results_hidden` is reverted via `setItems(prev)` (which itself is buggy — see CR-02), no user-facing feedback is given, and the admin has no idea the second click was ignored. The inline header comment explicitly claims "Per-row pending Set lets multiple rows be in-flight independently" — the hook breaks that contract.

**Fix:** Move the inflight guard from a hook-singleton to a per-poll key, or drop it entirely (the caller already disables the originating row's Switch via `isPendingVisibility`, which is the actual rapid-double-click guard for a single row). Minimal patch:

```typescript
const inflightRef = useRef<Set<string>>(new Set())

const toggleResultsVisibility = useCallback(
  async (input: { poll_id: string; hidden: boolean; title: string }) => {
    if (inflightRef.current.has(input.poll_id)) return { ok: false as const }
    inflightRef.current.add(input.poll_id)
    setSubmitting(true)
    try {
      // ...existing body...
    } finally {
      inflightRef.current.delete(input.poll_id)
      setSubmitting(inflightRef.current.size > 0)
    }
  },
  [],
)
```

### CR-02: Optimistic-revert closures in `AdminSuggestionsTab` race on concurrent flips and restore stale state

**File:** `src/components/admin/AdminSuggestionsTab.tsx:97-115, 121-148`
**Issue:** Both `handleTogglePin` and `handleToggleResultsVisibility` capture `items` lexically and use `prev = items` as the revert snapshot. The closures are recreated whenever `items` changes (it's in the dep list), but a click handler that has *already started awaiting* the EF call holds the **pre-await** `items` value. If a second flip lands between (a) the first flip's `setItems(optimistic)` and (b) the first flip's await resolution, the second handler's `prev = items` is now the post-first-flip optimistic state. On first-flip *failure*, `setItems(prev)` restores the snapshot that **already contains the second flip's mutation only as a base** — but the second flip's `target` lookup also reads from a stale list, so its own optimistic mutation may layer atop pre-first-flip state. Net effect: a failed flip can either (1) overwrite a successful sibling flip's optimistic state, or (2) leak the failed-flip's mutation into the post-revert tree. The `fetchAll()` reconciliation eventually corrects this, but only on success — *failed* paths return without reconciliation (lines 109-110 and 141-143).

**Fix:** Use functional `setItems` updates that diff only the target row, so concurrent flips never trample each other:

```typescript
// Apply
setItems((cur) =>
  cur.map((it) => (it.id === pollId ? { ...it, results_hidden: nextHidden } : it)),
)
// Revert (on EF failure)
setItems((cur) =>
  cur.map((it) => (it.id === pollId ? { ...it, results_hidden: !nextHidden } : it)),
)
```

The same fix applies to `handleTogglePin` — and because pin affects ordering, the revert path there must also re-sort. Alternative: trigger `fetchAll()` on the failure path too, accepting one extra round-trip in exchange for guaranteed convergence.

## Warnings

### WR-01: `useVoteCounts` writes `pollIdsRef.current` during render (React 19 concurrent-mode hazard)

**File:** `src/hooks/useVoteCounts.ts:21-22`
**Issue:** `pollIdsRef.current = votedPollIds` executes on every render of the consumer (`SuggestionList`). Ref mutation during render is explicitly called out as an anti-pattern in the React 19 docs because concurrent rendering may run a render that is later discarded — leaving the ref pointing at the discarded snapshot while the surviving render's `fetchCounts` reads it. The `pollIdsKey` dependency on `useCallback` (line 78) does the right thing only because `pollIdsRef` is mutated *before* `fetchCounts` reruns, but the assignment is order-fragile and StrictMode double-invocation in development can mask the race.

**Fix:** Either thread `votedPollIds` directly into `fetchCounts` via dependency, or move the ref assignment into `useEffect`:

```typescript
useEffect(() => {
  pollIdsRef.current = votedPollIds
}, [pollIdsKey])
```

Better still: drop the ref entirely. `pollIdsKey` is already a stable serialization; reconstruct `ids` from it inside `fetchCounts`:

```typescript
const fetchCounts = useCallback(async () => {
  const ids = pollIdsKey ? pollIdsKey.split(',') : []
  // ...
}, [pollIdsKey])
```

### WR-02: `useVoteCounts` `pollIdsKey` is order-sensitive — reorderings cause spurious refetches and key collisions on commas

**File:** `src/hooks/useVoteCounts.ts:20`
**Issue:** `votedPollIds.join(',')` produces different strings for `['a','b']` vs `['b','a']`, even though the set of polls is identical. If `votedPollIds` ever surfaces with a different iteration order (e.g., after a Map mutation that changes insertion order — `userVotes` is a Map in `useSuggestions.ts:19`), `fetchCounts` is rebuilt and the polling timer in `usePolling` is reset (see `usePolling.ts:38` — the effect deps are `[delay]` only, but `fetchCounts` is re-passed each render and `savedCallback.current` updates do not reset the timer; however, the *initial-fetch* effect at `useVoteCounts.ts:81-83` does refire on every `fetchCounts` identity change). Additionally, `','` is not a separator that any UUID or text-id will contain today, but a future ID format with commas (unlikely but unguarded) would cause a key collision.

**Fix:** Sort before joining, or use a Set-equality check:

```typescript
const pollIdsKey = useMemo(() => [...votedPollIds].sort().join('|'), [votedPollIds])
```

### WR-03: `useVoteCounts` `error` branch comments lie about "Keep previous counts" — code still drops to empty when `votedPollIds.length === 0` on subsequent ticks

**File:** `src/hooks/useVoteCounts.ts:26-30`
**Issue:** Lines 26-30 unconditionally call `setVoteCounts(new Map())` / `setResultsHidden(new Map())` when `ids.length === 0`. This is the correct behavior for the "user logged out / no votes" transition. But the comment at line 50 ("Keep previous counts rather than resetting to empty") implies the hook is robust to transient blips — it is *not* robust when the consumer momentarily passes an empty `votedPollIds` (which can happen during `useSuggestions` refetch if `userVotes` is initialized to `new Map()` and the `votedPollIds` derivation at `SuggestionList.tsx:33-36` runs before votes load). The result: voter-side UI briefly flips from "hidden-alert" to "ChoiceButtons" mid-poll when `userVotes` clears for a tick.

**Fix:** Either (a) guard the reset behind a "we explicitly saw an empty list, not loading" signal from the caller, or (b) only reset when the previous tick also had zero ids. Lower-risk option: have `useSuggestions` not clobber `userVotes` mid-refetch — keep the previous Map until the new one arrives.

### WR-04: `AdminSuggestionRow` `onCheckedChange` boolean conversion is needlessly contorted

**File:** `src/components/admin/AdminSuggestionRow.tsx:90`
**Issue:** `(v) => onToggleResultsVisibility(s.id, v === true ? false : true)` is the inverse of `v`, but written as a ternary on `v === true` it (a) suggests a non-boolean third state that does not exist in Radix `Switch.onCheckedChange` (which emits `boolean`), and (b) trips static analysis tools that flag tautology-style ternaries. If a future Radix release ever passed something other than `true`/`false` (it won't, by contract), the current expression collapses the third value to `true`, which silently *hides* results — the more dangerous direction.

**Fix:** `onCheckedChange={(v) => onToggleResultsVisibility(s.id, !v)}`. Same semantics, far more obvious, and trivially correct for the entire boolean domain.

### WR-05: E2E spec `results-visibility.spec.ts` asserts hidden-alert text "Your response" — but visible-result branch also renders results, and there is no negative assertion that the hidden Alert is in the alert subtree

**File:** `e2e/tests/results-visibility.spec.ts:154-157`
**Issue:** The assertion `expect(...).toContainText('Your response')` (line 156) is scoped to the hidden-alert wrapper testid, which is correct. But the wrapper testid `results-hidden-alert-${pollId}` (`SuggestionCard.tsx:134`) wraps **both** the "Your response: ..." line **and** the actual `<Alert>` with `<AlertTitle>Results temporarily hidden by admin</AlertTitle>`. The "Your response" text alone is also rendered by the *visible* branch via `ResultBars` (which highlights the user's vote with the choice label). A future refactor that moves the "Your response" copy into `ResultBars` would silently satisfy this assertion even with the alert wrapper hidden. The strong post-unhide assertion at line 176 (`[role="meter"]`) is properly stable; the hidden-state assertion should mirror it by targeting the Alert title.

**Fix:** Replace the text assertion with the actual hide-state marker:

```typescript
await expect(
  page.getByTestId(`results-hidden-alert-${createdPollId}`)
).toContainText('Results temporarily hidden by admin')
```

### WR-06: WHY-only / no-rot-tag comment policy violated in six source files (MEMORY.md `feedback_no_review_archaeology_in_source`)

**File:** multiple — see locations below
**Issue:** Project policy (CLAUDE.md "Comments" + MEMORY.md `feedback_no_review_archaeology_in_source.md`) is explicit: "source comments WHY-only, never cite plan/round/phase IDs (rot tags); plan refs belong in PR/commit, not src/". The changed files introduce or retain the following rot tags:

- `src/components/suggestions/form/DropZone.tsx:1` — `UIDN-03 D-13`, "v1.1 audit"
- `src/components/suggestions/form/ImageInput.tsx:36, 101` — `LR-07`, `UIDN-03 D-13`
- `src/components/suggestions/SuggestionList.tsx:16, 39, 66` — `MR-06`, `VIS-08`
- `src/components/suggestions/SuggestionCard.tsx:127-129` — `VIS-08`
- `src/hooks/useVoteCounts.ts:5, 13-15, 35` — `RSLT-04`, `VIS-08 D-11`
- `src/components/admin/AdminSuggestionRow.tsx` — clean (no rot tags) — verified

These are not "what does this code do" comments — they're plan-ID archaeology that becomes stale the moment ROADMAP changes. The TEST-13 spec header (`e2e/tests/results-visibility.spec.ts:6`) is borderline since spec headers in this project routinely cite tickets and live outside `src/`; flag is **info-tier** there (see IN-04).

**Fix:** Rewrite each comment to explain the WHY without the ID. Example for `DropZone.tsx:1`:

```typescript
// Drag-region (outer div with role="region") and keyboard-Browse entry
// (inner shadcn Button) are split so screen readers don't announce a
// dual-role landing zone — see DESIGN-SYSTEM.md for the rationale.
```

The plan-ID is preserved in git history; the source comment should survive a `ROADMAP.md` rename.

## Info

### IN-01: `AdminSuggestionRow` truncated title risks information loss without title-attribute fallback

**File:** `src/components/admin/AdminSuggestionRow.tsx:81`
**Issue:** `<p className="text-sm font-medium mt-1 truncate">{s.title}</p>` truncates with CSS but does not surface the full title via `title={s.title}` or an `aria-label`. Admins reviewing a list with similar titles ("Remove MiG-29 12-3..." × 5 variants) cannot disambiguate without clicking through.
**Fix:** Add `title={s.title}` to the `<p>` so hover surfaces the full text and assistive tech can fall back to it.

### IN-02: `AdminSuggestionRow` Switch `aria-label` reads current state, not the action it performs

**File:** `src/components/admin/AdminSuggestionRow.tsx:93`
**Issue:** `aria-label={resultsHidden ? 'Results currently hidden' : 'Results currently visible'}` describes the present state. Switch best-practice (W3C ARIA APG) is to label the toggle by the *control's purpose* and let `aria-checked` (which Radix sets via `data-state`) carry the current state. Screen readers will currently announce both: "Results currently visible, switch, on" which is mildly redundant. More importantly, the visible label next to the Switch (line 96-98) reads `resultsHidden ? 'Show results' : 'Hide results'` — describing the *action*, which is the opposite framing. Sighted and screen-reader users see/hear contradictory phrasings.
**Fix:** Use a static action-oriented label: `aria-label="Toggle results visibility"`. Let `aria-checked` carry state.

### IN-03: `useToggleResultsVisibility` `submitting` state is exported but unused by the caller

**File:** `src/hooks/useToggleResultsVisibility.ts:9, 44`
**Issue:** `submitting` is returned (line 44) but `AdminSuggestionsTab` never destructures it (line 41 only takes `toggleResultsVisibility`). The per-row `pendingVisibility` Set is the actual loading-state surface. The unused `submitting` state still triggers re-renders of any future consumer that subscribes — and pairs awkwardly with the singleton inflight gate flagged in CR-01.
**Fix:** Once CR-01 is fixed and the gate is per-poll, derive `submitting` from `inflightRef.current.size > 0` or remove it. Either way, drop unused returns.

### IN-04: TEST-13 spec header retains plan-ID archaeology (`VIS-06 + VIS-07 + VIS-08`, "ROADMAP SC4", "D-10", "D-16", "M7")

**File:** `e2e/tests/results-visibility.spec.ts:6-37`
**Issue:** The spec header is dense with ROADMAP/plan IDs. Specs live outside `src/`, so the MEMORY.md prohibition is softer here, but the same drift risk applies: the IDs will become opaque the moment ROADMAP shifts. Mitigation is fine for now (per-project tolerance for test-tier IDs); flagging for parity with WR-06.
**Fix:** Optional — paraphrase the cross-references to behavior ("admin checkbox at create time", "admin Switch with optimistic toast", "voter hidden-state alert with 8s polling") and let git blame surface the requirement ID.

### IN-05: `poll-fixture.ts` references `[__smoke]` route and grep-tag stripping that is now unused by this spec

**File:** `e2e/fixtures/poll-fixture.ts:52-57`
**Issue:** The fixture sanitizes `[@grep-tag]` markers from `testInfo.title` for cosmetic readability in the rendered card title. `results-visibility.spec.ts` is the only consumer here and *does* carry `[@smoke]`, so the sanitization is exercised — but the spec also uses `Date.now()` to compose its title outside the fixture (line 46), so the fixture's title-uniqueness logic is duplicated. Not a defect — minor coupling cost.
**Fix:** No action required. Note in case a future refactor consolidates title-generation.

---

_Reviewed: 2026-05-12T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
