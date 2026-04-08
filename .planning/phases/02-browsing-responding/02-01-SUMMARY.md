---
phase: 02-browsing-responding
plan: 01
subsystem: suggestion-browsing
tags: [ui, components, hooks, types, filtering, search]
dependency_graph:
  requires: [phase-01-foundation]
  provides: [suggestion-types, suggestion-hooks, suggestion-ui, topics-page]
  affects: [02-02-voting, 02-03-results]
tech_stack:
  added: [shadcn-badge, shadcn-collapsible, shadcn-input, shadcn-progress]
  patterns: [server-side-status-filter, client-side-category-search-filter, collapsible-cards, optimistic-vote-prep]
key_files:
  created:
    - src/lib/types/suggestions.ts
    - src/lib/format.ts
    - src/hooks/useDebounce.ts
    - src/hooks/useCategories.ts
    - src/hooks/useSuggestions.ts
    - src/components/ui/badge.tsx
    - src/components/ui/collapsible.tsx
    - src/components/ui/input.tsx
    - src/components/ui/progress.tsx
    - src/components/suggestions/StatusBadge.tsx
    - src/components/suggestions/PinnedBanner.tsx
    - src/components/suggestions/SearchBar.tsx
    - src/components/suggestions/CategoryFilter.tsx
    - src/components/suggestions/EmptyState.tsx
    - src/components/suggestions/SuggestionSkeleton.tsx
    - src/components/suggestions/SuggestionCard.tsx
    - src/components/suggestions/SuggestionList.tsx
  modified:
    - src/routes/topics.tsx
decisions:
  - Server-side status filtering via .eq('status', status) in useSuggestions ensures only matching polls are returned from the database
  - SuggestionCard props interface designed upfront to accept voting state props (submittingPollId, submittingChoiceId, voteCounts) for Plan 02 compatibility
  - Category colors assigned deterministically by index % 4 from a fixed 4-slot palette
  - Creator avatar rendered as placeholder div since profile join is not yet in the query
metrics:
  duration: 3m
  completed: 2026-04-07T04:12:45Z
  tasks_completed: 2
  tasks_total: 2
  files_created: 17
  files_modified: 1
---

# Phase 02 Plan 01: Suggestion Browsing UI Summary

Types, hooks, and UI components for browsing suggestions with category filtering, text search, expand/collapse cards, and pinned banners -- fully wired to the Topics page.

## What Was Built

### Task 1: Types, Utilities, and Data Hooks
- **Types** (`src/lib/types/suggestions.ts`): `SuggestionWithChoices`, `ChoiceWithCount`, `ResolutionStatus`, `CATEGORY_COLORS` with `getCategoryColor()` for deterministic category badge coloring.
- **Format utilities** (`src/lib/format.ts`): `formatTimeRemaining()` converts close timestamps to human-readable text ("3 days left", "Closes soon"). `calcPercentage()` for vote result calculations.
- **useDebounce** (`src/hooks/useDebounce.ts`): Generic debounce hook used for 300ms search input delay.
- **useCategories** (`src/hooks/useCategories.ts`): Fetches categories from Supabase ordered by `sort_order`.
- **useSuggestions** (`src/hooks/useSuggestions.ts`): Core data hook. Queries polls with joined categories and choices. **Server-side** `.eq('status', status)` filter ensures only active or closed polls are returned. Fetches user votes into a `Map<pollId, choiceId>`. Exposes `addOptimisticVote()` for Plan 02.
- **shadcn components**: Installed Badge, Collapsible, Input, Progress into `src/components/ui/`.

### Task 2: UI Components and Topics Page
- **StatusBadge** (`CategoryBadge`, `ResolutionBadge`): Color-coded badges for categories (4-slot palette) and resolution states (addressed/forwarded/closed).
- **PinnedBanner**: Amber banner with Pin icon and time remaining, using negative margins to bleed to card edges.
- **SearchBar**: Controlled input with Search icon, clear button, and `aria-label="Search topics"`.
- **CategoryFilter**: Horizontal pill row with "All" default, `role="tablist"` accessibility, active/inactive styling.
- **EmptyState**: Three variants (no-matches with clear button, no-active, no-archive) matching UI-SPEC copy exactly.
- **SuggestionSkeleton**: 3 pulsing cards with `aria-busy="true"`.
- **SuggestionCard**: Collapsible card supporting pinned (expanded default, amber banner) and non-pinned (collapsed default, click to expand). Accepts full voting prop set for Plan 02 compatibility. Renders choices placeholder with data-slot="choices" for Plan 02 replacement.
- **SuggestionList**: Orchestrates data fetching, category + debounced search filtering, loading/empty states, and card rendering.
- **Topics page** (`src/routes/topics.tsx`): Wired to `SuggestionList status="active"` inside `AuthGuard`.

## Decisions Made

1. **Server-side status filtering**: `useSuggestions(status)` passes status directly to Supabase `.eq('status', status)` -- the database is the gatekeeper, not client-side code.
2. **Forward-compatible card props**: SuggestionCard accepts `onVote`, `voteCounts`, `submittingPollId`, and `submittingChoiceId` now (unused), so Plan 02 only needs to wire data, not refactor the component interface.
3. **Creator placeholder**: Generic avatar circle + "Community" text instead of profile data, since the creator profile join is deferred.
4. **shadcn install path fix**: shadcn CLI created files in literal `@/components/ui/` instead of `src/components/ui/` -- files were moved to the correct location (Rule 3 auto-fix for blocking issue).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn component install path mismatch**
- **Found during:** Task 1, Step 1
- **Issue:** `npx shadcn@latest add` installed 4 components into a literal `@/components/ui/` directory instead of resolving `@` to `src/`.
- **Fix:** Moved all 4 files from `@/components/ui/` to `src/components/ui/` and removed the erroneous `@/` directory.
- **Files modified:** badge.tsx, collapsible.tsx, input.tsx, progress.tsx (moved)
- **Commit:** 0ef7cea

## Known Stubs

| File | Line | Stub | Reason |
|------|------|------|--------|
| `src/components/suggestions/SuggestionCard.tsx` | choices area | `data-slot="choices"` placeholder div | Plan 02 replaces with ChoiceButtons/ResultBars |
| `src/components/suggestions/SuggestionCard.tsx` | footer | Generic "Community" text + placeholder avatar | Creator profile join deferred |
| `src/components/suggestions/SuggestionList.tsx` | handleVote | Empty function body | Plan 02 wires real voting via Edge Function |
| `src/components/suggestions/SuggestionList.tsx` | voteCounts prop | Always `undefined` | Plan 02 wires vote_counts query |

All stubs are intentional and will be resolved by Plan 02 (voting) and Plan 02 (results).

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 0ef7cea | feat(02-01): add shadcn components, types, format utils, and data hooks |
| 2 | 0d40fae | feat(02-01): build suggestion UI components and wire Topics page |

## Self-Check: PASSED

- All 18 created/modified files verified present on disk
- Commit 0ef7cea (Task 1) verified in git log
- Commit 0d40fae (Task 2) verified in git log
- TypeScript compilation: zero errors
