---
phase: quick-260623-9na
plan: 01
subsystem: suggestions (public results rendering)
status: complete
tags: [bugfix, fail-closed, results-visibility, regression-test]
requires:
  - useVoteCounts resultsHidden map (existing)
  - SuggestionCard resultsHidden gate (existing)
provides:
  - Fail-closed default for the unresolved (unknown) results_hidden window
affects:
  - /topics (active) and /archive (closed) views — both render via SuggestionList
tech-stack:
  added: []
  patterns:
    - "Implicit tri-state via Map presence (present-true / present-false / absent-unknown) with fail-closed consumer default"
key-files:
  created: []
  modified:
    - src/components/suggestions/SuggestionList.tsx
    - src/hooks/useVoteCounts.ts
    - src/__tests__/suggestions/results-visibility.test.tsx
decisions:
  - "Flip consumer default to `?? true` rather than introduce an explicit `boolean | 'unknown'` tri-state — the map-miss already uniquely encodes the unknown window; one-line change, identical fail-closed semantics, no hook signature churn."
metrics:
  duration: ~5m
  completed: 2026-06-23
  tasks: 1
  files: 3
---

# Phase quick-260623-9na Plan 01: Fix Results Flash Before Hide Summary

Eliminated the ~1-2s vote-count "flash" on a voted poll with `results_hidden=true` by flipping the SuggestionList results gate to fail-closed: an unresolved (map-miss) hidden flag now renders as hidden instead of leaking counts on first paint.

## What Changed

- **`src/components/suggestions/SuggestionList.tsx`** — `resultsHidden={resultsHidden.get(suggestion.id) ?? false}` → `?? true`. The map-miss is the not-yet-resolved/unknown window, so it must default to hidden. Updated the nearby WHY comment to explain the fail-closed contract (RLS is the independent DB-layer defense). Covers both `/topics` and `/archive` since both render through this single call site.
- **`src/hooks/useVoteCounts.ts`** — Added a WHY comment at the `resultsHidden` state declaration documenting the consumer contract: an absent entry means "not yet resolved", and consumers MUST treat absence as hidden (fail-closed). No change to the hook's return type or signature.
- **`src/__tests__/suggestions/results-visibility.test.tsx`** — Added an integration `describe` block that renders through `SuggestionList` with a voted poll, populated `voteCounts`, and an EMPTY `resultsHidden` map (the unknown window). Asserts no `meter`/percentage renders and the censored placeholder (`results-hidden-alert-poll-1`) shows. Sibling non-regression test asserts `results_hidden=false` still renders ResultBars (2 meters, 75%/25%).

## TDD Gate Compliance

Single-commit TDD: the RED state was verified before the fix (first new test failed against the current `?? false` behavior — empty `resultsHidden` map produced ResultBars/meters; the other 7 tests, including the non-regression case, passed). GREEN achieved after the `?? true` flip. The test + fix were committed together as one atomic bugfix commit (`0b81f87`) per the quick-task atomic-commit guidance; the RED/GREEN transition is documented here rather than split across `test(...)`/`feat(...)` commits.

## Verification

- `npx vitest run src/__tests__/suggestions/results-visibility.test.tsx src/__tests__/suggestions/suggestion-list.test.tsx` — **14 passed** (9 results-visibility incl. 2 new, 6 suggestion-list). No regressions.
- `npm run lint` — **clean** (eslint, 0 warnings).
- `tsc -b` — **exit 0** (no type errors). Pre-commit hook also re-ran eslint + `tsc -b --noEmit`, both passed.

## Deviations from Plan

None — plan executed as written. The plan's `<action>` flagged ambiguity about where to get a true RED; resolved per its own guidance by driving the RED at the SuggestionList integration level (empty `resultsHidden` map + populated `voteCounts`), which fails against `?? false` and passes after `?? true`.

## Known Stubs

None.

## Commits

- `0b81f87`: fix(quick-260623-9na): fail-closed results gate on first-paint unknown window

## Self-Check: PASSED

- FOUND: src/components/suggestions/SuggestionList.tsx (`?? true`)
- FOUND: src/hooks/useVoteCounts.ts (consumer-contract comment)
- FOUND: src/__tests__/suggestions/results-visibility.test.tsx (new fail-closed tests)
- FOUND commit: 0b81f87
