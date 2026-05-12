---
phase: 12-admin-ui-user-ui-uidn-03-sweep
plan: 04
subsystem: voter-ui
tags:
  - vis-08
  - voter-ui
  - shadcn
  - alert
  - polling
requirements:
  - VIS-08
one_liner: "Voter-side hidden-state Alert: useVoteCounts polls polls_effective.results_hidden on the same 8s cadence, SuggestionCard renders an EyeOff Alert with the voter's own choice surfaced when (voted AND results_hidden)."
dependency_graph:
  requires:
    - 12-00 (database.types.ts regen with polls_effective.results_hidden)
  provides:
    - voter-side VIS-08 surface; data-testid={`results-hidden-alert-${pollId}`} for Plan 06 TEST-13
  affects:
    - src/hooks/useVoteCounts.ts (return shape grows by `resultsHidden`)
    - src/components/suggestions/SuggestionCard.tsx (new `resultsHidden: boolean` prop)
    - src/components/suggestions/SuggestionList.tsx (forwards prop to card)
tech_stack:
  added: []
  patterns:
    - "Batched polling — vote_counts + polls_effective in a single Promise.all per tick (1 RTT, free-tier safe)"
    - "Layered defense — DB-level RLS gates count rows on hidden polls; UI branch is the usability layer above it"
key_files:
  created: []
  modified:
    - src/hooks/useVoteCounts.ts
    - src/components/suggestions/SuggestionCard.tsx
    - src/components/suggestions/SuggestionList.tsx
    - src/__tests__/suggestions/suggestion-list.test.tsx
decisions:
  - "Hold previous resultsHidden map on transient query error (do NOT reset to empty/visible) — prevents a network blip from flipping the UI from hidden to visible mid-session."
  - "Boolean(...) defensive coerce on row.results_hidden — guards against view-level nullability inference (the underlying column is NOT NULL; default to false / visible on any null reading)."
  - "Comment rephrased from `from('polls')` to `the base polls table directly` — the polls-effective-invariant regex scans full source text including comments and would otherwise false-positive."
metrics:
  duration_minutes: 8
  tasks_completed: 2
  files_modified: 4
  completed_date: 2026-05-12
---

# Phase 12 Plan 04: VIS-08 Voter-side Hidden State Summary

Wave 2 of Phase 12 closes the voter-facing half of v1.2 admin visibility. The Phase 11 RLS policy (VIS-04) already blocks `vote_counts` reads when `results_hidden = true` — without a matching UI branch, voters who had already voted would see an empty 0/N count bar with no explanation. Plan 04 adds:

1. An extension to `useVoteCounts` that polls `polls_effective.results_hidden` on the same 8s cadence (D-11). Both reads are batched into a single `Promise.all` round-trip.
2. A three-way branch in `SuggestionCard` — when a voter has voted AND the poll is hidden, a shadcn `<Alert>` block with an `<EyeOff>` icon and the locked title "Results temporarily hidden by admin" replaces `<ResultBars>`. The voter's own choice is surfaced as a `Your response: {label}` line above the Alert (D-10).
3. Call-site wiring in `SuggestionList.tsx` — the sole consumer of `useVoteCounts` and renderer of `<SuggestionCard>`. Routes (`topics.tsx`, `archive.tsx`) need no edits because they render `<SuggestionList />`, not `<SuggestionCard />` directly.
4. Test-mock update — `src/__tests__/suggestions/suggestion-list.test.tsx` already mocks `useVoteCounts`; the factory now returns `resultsHidden: new Map()` so the destructure does not yield `undefined.get(...)` at runtime. The lucide-react mock gains an `EyeOff` stub because `SuggestionCard` now imports it at module-load.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Extend useVoteCounts with results_hidden polling | a903f67 | src/hooks/useVoteCounts.ts |
| 2 | Branch SuggestionCard + wire SuggestionList + update test mock | 0405910 | src/components/suggestions/SuggestionCard.tsx, src/components/suggestions/SuggestionList.tsx, src/__tests__/suggestions/suggestion-list.test.tsx |

## Verification

- `npm run lint` — clean (no warnings, no errors)
- `npx tsc -b` — clean (no diagnostics)
- `npm run test` — 41 files / 390 tests passed
- `src/__tests__/admin/polls-effective-invariant.test.ts` — both invariants pass (the new SELECT targets `polls_effective`, the WHY comment was rephrased to avoid triggering the regex on the literal `from('polls')` substring)
- Grep-level checks for locked surfaces:
  - `Results temporarily hidden by admin` literal present in SuggestionCard
  - `data-testid={\`results-hidden-alert-${...}\`}` on the wrapper div
  - `Your response:` voter's-choice line present
  - `EyeOff` icon imported and rendered inside the Alert
  - `resultsHidden` destructured from `useVoteCounts` in SuggestionList
  - `resultsHidden.get(suggestion.id) ?? false` forwarded to each SuggestionCard

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] polls-effective-invariant regex matched a WHY comment**
- **Found during:** Task 12-04-01 verification (the invariant test failed after the initial commit was prepared).
- **Issue:** The first draft of the new WHY comment in `useVoteCounts.ts` read `// ... (zero direct from('polls') reads in src/).`. The invariant test regex `/from\(\s*['"]polls['"]\s*\)/` scans the entire file as text, including comments, so it flagged the file as an offender even though the actual SELECT targets `polls_effective`.
- **Fix:** Rephrased the comment to `// ... (never the base polls table directly) ...` — same intent, no triggering substring.
- **Files modified:** `src/hooks/useVoteCounts.ts`
- **Tracked in:** Task 12-04-01 commit `a903f67`

**2. [Rule 2 — Missing critical] lucide-react mock missing EyeOff stub**
- **Found during:** Task 12-04-02 — anticipated rather than reactive. `SuggestionCard` now imports `EyeOff` from `lucide-react`, and `src/__tests__/suggestions/suggestion-list.test.tsx` factor-mocks `lucide-react` with an explicit allow-list of icons. Without adding `EyeOff` the mock would shadow it as `undefined` at module-load.
- **Fix:** Added `EyeOff: () => <span data-testid="eye-off-icon" />` to the `vi.mock('lucide-react', ...)` factory.
- **Files modified:** `src/__tests__/suggestions/suggestion-list.test.tsx`
- **Tracked in:** Task 12-04-02 commit `0405910`

No architectural changes (Rule 4) required.

## Threat Surface Scan

No new threat surface beyond what the plan's `<threat_model>` already covers. The new `polls_effective.select('id, results_hidden')` query is a public anon-key read against a view whose security model is set by Phase 11 (`security_invoker = on`); columns exposed are exactly the row shape captured in `database.types.ts`. The vote_counts read path is unchanged. The voter's-choice line surfaces only the voter's own `userChoiceId` against the suggestion's public choice list — no aggregate / cross-user leak.

## Known Stubs

None. The voter UI is wired end-to-end: `polls_effective.results_hidden` is the live source of truth (driven by the Phase 11 EF), the polling cadence picks up admin flips within ~8s, and the UI branch + RLS DB defense both fire correctly without further plans needed for VIS-08 closure.

## Self-Check: PASSED

- `src/hooks/useVoteCounts.ts` — modified (verified via `git log -1 --name-only a903f67`).
- `src/components/suggestions/SuggestionCard.tsx` — modified (verified via `git log -1 --name-only 0405910`).
- `src/components/suggestions/SuggestionList.tsx` — modified (same commit).
- `src/__tests__/suggestions/suggestion-list.test.tsx` — modified (same commit).
- Commits `a903f67` and `0405910` present in `git log --oneline -5`.
- Plan success criteria (lint + tsc + tests green, no STATE/ROADMAP modifications, two atomic commits, SUMMARY.md present): met.
