---
phase: 02-browsing-responding
plan: 04
subsystem: route-wiring
tags: [gap-closure, regression-fix, routing]
gap_closure: true
dependency_graph:
  requires: [02-01-suggestion-ui, 02-02-voting-results]
  provides: [topics-page-wiring, archive-page-wiring]
  affects: []
key_files:
  created: []
  modified:
    - src/routes/topics.tsx
    - src/routes/archive.tsx
duration_minutes: 2
status: complete
self_check: PASSED
---

# Plan 02-04 Summary: Route File Regression Fix

## What Was Done

Restored SuggestionList wiring in both route files that were accidentally reverted to Phase 1 placeholders by commit dfccc11 (Plan 03 seed data worktree merge).

### Task 1: Restore topics.tsx
- Replaced Phase 1 placeholder (Inbox icon, static "No active topics" text) with `<SuggestionList status="active" />`
- Removed lucide-react import

### Task 2: Restore archive.tsx
- Replaced Phase 1 placeholder (Archive icon, static "No archived topics" text) with `<SuggestionList status="closed" />`
- Removed lucide-react import

## Verification

- TypeScript compiles clean (`npx tsc --noEmit` — zero errors)
- All 19 suggestion tests pass (`npx vitest run src/__tests__/suggestions/`)
- Phase 1 regression test passes (11/11 auth tests)
- Both files contain SuggestionList import (count 2 each)
- Neither file contains lucide-react references (count 0 each)

## Root Cause

Plan 03 executed in an isolated worktree based on the correct HEAD, but its `supabase/seed.sql` task also touched `src/routes/topics.tsx` and `src/routes/archive.tsx` (resetting them to Phase 1 content). When the worktree merged back, the fast-forward overwrote Plan 01 and 02's correct versions.

## Deviations

None. Fix matched the exact target content from git history (commit 8f1b949).
