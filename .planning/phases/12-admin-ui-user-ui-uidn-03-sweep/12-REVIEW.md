---
phase: 12-admin-ui-user-ui-uidn-03-sweep
reviewed: 2026-05-12T17:10:00Z
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
  info: 1
  total: 2
status: issues_found
---

# Phase 12: Code Review Report (Iter-3 Final Verification)

**Reviewed:** 2026-05-12T17:10:00Z
**Depth:** deep
**Files Reviewed:** 16
**Status:** issues_found
**Prior gate state (asserted by orchestrator):** lint 0 · tsc 0 · vitest 393/393

## Summary

Verified iter-3 fix commits against the five iter-2 findings. All five fixes
land cleanly:

| Iter-2 finding | Fix commit | Verified |
|---|---|---|
| WR-01 (rot tags in `src/__tests__/`)              | `cf96083` | yes — no `iter|round|cycle|phase-N` archaeology in the two test files; project-wide grep confirms no source-side rot tags remain |
| IN-01 (title lookup inside `setItems` updater)    | `20f8d3c` | yes — `target/title` computed at `AdminSuggestionsTab.tsx:146-147` BEFORE the `setItems((cur) => ...)` call at `:148`; updater is pure |
| IN-02 (stale-response guard in `useVoteCounts`)   | `fb08663` | yes — `fetchIdRef` increments at `:43`, single guard at `:79` covers both subsequent `setVoteCounts` (`:94`) and `setResultsHidden` (`:110`) because no async work happens between them. The early-empty path also has its own guard at `:55`. |
| IN-03 (tautological keyboard-Enter assertion)     | `e1cc4a5` | yes — `image-input.test.tsx:97` spies on `hiddenInput.click`, `:106` asserts `clickSpy.toHaveBeenCalled()` after `user.keyboard('{Enter}')`; the wiring is `Browse Button onClick → openPicker → fileRef.current?.click()` which the spy genuinely observes |
| IN-04 (discriminated `inflight` reason)           | `0f0667c` | partial — hook returns `{ ok: false, reason: 'inflight' \| 'error' }`; caller short-circuits via `pendingVisibility.has(pollId)` at `:139`; revert path correctly skips on `reason === 'inflight'` at `:169`. However, a residual race in the same `handleToggleResultsVisibility` flow re-enables the Switch while the first request is still in flight — see WR-01 below. |

Cross-file traces:
- `useVoteCounts` ↔ `SuggestionList` ↔ `useSuggestions`: `votedPollIds` derivation is order-stable via `pollIdsKey` sort+join; setState ordering on stale responses is correctly gated; `deferSetState` cleanup wires return-from-effect to `cancel`.
- `useToggleResultsVisibility` ↔ `AdminSuggestionsTab` ↔ `AdminSuggestionRow`: discriminated-union contract is type-safe; Switch `disabled` driven by `isPendingVisibility` prop derived from `pendingVisibility.has(s.id)`.
- e2e `poll-fixture` ↔ `results-visibility.spec`: title-generation paths intentionally diverge (spec generates its own title for EF-driven create); the fixture's `Date.now()-${testInfo.workerIndex}` slug stays unused by this spec, no contamination.
- `polls_effective` view ↔ `AdminSuggestion` row type: shape matches; the `Array<{ poll_id, count: number | null }>` cast in `AdminSuggestionsTab.fetchAll` is defensively wider than the schema (`vote_counts.count: number` is NOT NULL), which is fine but worth noting.

One residual WARNING surfaced from the iter-3 IN-04 fix — see below. One INFO
on a defensive-but-mismatched type cast.

## Critical Issues

_(none)_

## Warnings

### WR-01: `setPendingVisibility(delete pollId)` unconditionally re-enables Switch on `reason === 'inflight'`, partially defeating the rapid-double-click fix

**File:** `src/components/admin/AdminSuggestionsTab.tsx:159-169`

**Issue:**
The iter-3 IN-04 fix correctly skips the **optimistic-state revert** on
`reason === 'inflight'`, but the **pending-marker cleanup** that runs
between the `await` and that guard removes the in-flight marker added
by the FIRST (still-pending) handler. Trace:

```
handler 1 (click 1, nextHidden=true):
  L139  pendingVisibility.has(pollId) → false        // empty → continue
  L148  setItems(... results_hidden: true)           // optimistic
  L153  setPendingVisibility(s).add(pollId)
  L158  await toggleResultsVisibility(...)           // EF call: SLOW

handler 2 (click 2, fires before React commits handler 1's setPendingVisibility):
  L139  pendingVisibility.has(pollId) → false        // closure stale → MISS
  L148  setItems(... results_hidden: ?)              // may flip back
  L153  setPendingVisibility(s).add(pollId)          // idempotent
  L158  await toggleResultsVisibility(...)
        // hook hits inflightRef → returns synchronously:
        //   { ok: false, reason: 'inflight' }
  L159  setPendingVisibility(s).delete(pollId)       // ← BUG: removes
                                                     //   handler 1's marker
  L169  if (res.reason === 'inflight') return        // skips revert (OK)

… handler 1 is still awaiting the EF. Switch.disabled is now FALSE.
```

After handler 2 returns, the Switch is re-enabled even though handler 1's
EF is still in flight. The comment at `:130-138` explicitly identifies
this exact scenario as the motivation for the fix ("its pending-delete
step re-enabled the Switch while the first request was still in flight")
— but the implemented guard only protects the revert path, not the
pending-delete path.

Data integrity is preserved: the hook's `inflightRef` gate blocks the
duplicate EF invoke regardless. The defect is UI-only — the Switch
becomes clickable during the in-flight window, allowing further
hammering that produces visible state churn (and, if handler 2's
`nextHidden` differed from handler 1's, an inverted optimistic flip
that persists until handler 1's `fetchAll()` reconciliation).

The race window requires React to NOT have committed handler 1's
`setPendingVisibility` before click 2 fires (concurrent-mode
deprioritization, rapid keyboard space/enter, or aggressive double-tap
on mobile). Narrow but matches the documented attack surface the fix
was supposed to close.

**Fix:**
Skip the pending-delete when the hook reports `inflight` — the in-flight
marker still belongs to the first handler:

```tsx
const res = await toggleResultsVisibility({ poll_id: pollId, hidden: nextHidden, title })
if (!res.ok && res.reason === 'inflight') {
  // Handler 1 still owns the pending marker AND the optimistic state.
  // Do NOT touch pendingVisibility (would re-enable Switch prematurely),
  // do NOT revert items (handler 1's flip is the source of truth).
  return
}
setPendingVisibility((s) => {
  const n = new Set(s)
  n.delete(pollId)
  return n
})
if (!res.ok) {
  // Real EF/network error — revert + reconcile.
  setItems((cur) =>
    cur.map((it) =>
      it.id === pollId ? { ...it, results_hidden: !nextHidden } : it,
    ),
  )
  void fetchAll()
  return
}
void fetchAll()
```

Optionally also guard the optimistic flip at `:148-152`: if handler 2's
`nextHidden` equals the value handler 1 already wrote, the flip is
idempotent; if it inverts, the user sees a wrong-state flash for ~RTT.
The cleanest belt-and-suspenders is to consult the synchronous
`inflightRef` (exposed via a `peek` method on the hook) BEFORE running
any setState, or to move the optimistic flip below the await so it
only runs once the hook has admitted the call.

## Info

### IN-01: `vote_counts.count` cast type widens schema (`number` → `number | null`)

**File:** `src/components/admin/AdminSuggestionsTab.tsx:72`

**Issue:**
The cast at line 72 says
`Array<{ poll_id: string; count: number | null }>`, but `database.types.ts:237`
declares `vote_counts.Row.count: number` (NOT NULL — the schema-level
constraint is documented in the migration). The `(r.count ?? 0)` defensive
fallback is harmless but the wider cast obscures the schema invariant for
readers.

**Fix:**
Tighten the cast to match the schema, drop the redundant `?? 0`:

```ts
for (const r of (vcData ?? []) as Array<{ poll_id: string; count: number }>) {
  counts[r.poll_id] = (counts[r.poll_id] ?? 0) + r.count
}
```

Or simply import the generated `Tables<'vote_counts'>` row type instead
of restating the shape inline.

---

_Reviewed: 2026-05-12T17:10:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
