---
phase: 05-launch-hardening
plan: 04
subsystem: ui

tags:
  - tanstack-router
  - preload-intent
  - skeleton
  - data-testid
  - ui-spec
  - e2e-selectors
  - m7
  - high1

# Dependency graph
requires:
  - phase: 05-launch-hardening
    provides: "Plan 05-01 pinned TanStack Router 1.168.10 and Playwright 1.59.1; Plan 05-03 removed app-wide defaultPreload from main.tsx (HIGH #1 resolution foundation)"
provides:
  - "SuggestionSkeleton silhouette matching SuggestionCard (bg-card rounded-xl border p-5 + 3 shimmer rows) — UI-SPEC Contract 1 shipped"
  - "preload=\"intent\" on Topics/Archive Links in Navbar + MobileNav — hover prefetches route loaders within ~50ms (UI-SPEC Contract 4)"
  - "Admin Link has NO preload attribute (cold by omission — HIGH #1 clean-room + Pitfall 6 guard)"
  - "data-testid=\"suggestion-card\" on SuggestionCard outer wrapper (unconditional — M7 E2E selector hook)"
  - "data-testid=\"admin-create-suggestion\" on primary admin Create button (M7)"
  - "Decision documented: ResultBars uses role=\"meter\" + visible % text; 05-05 specs text-match or select-by-meter (M7)"
affects:
  - "05-05 Playwright suite — consumes suggestion-card + admin-create-suggestion testids; aligns on meter-role/text-match for result bars"
  - "Future plans reintroducing defaultPreload — MUST add preload={false} to Admin Link to preserve cold-nav trust path"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "UI-SPEC Contract 1: skeletons MUST mirror real component silhouette (shared outer shell classes) to avoid CLS"
    - "UI-SPEC Contract 4 + HIGH #1: per-link opt-in preload; admin routes cold by omission (no defaultPreload to override)"
    - "E2E selector stability: data-testid on outer component wrappers; text-match/role for inner semantic nodes"

key-files:
  created:
    - "src/__tests__/components/SuggestionSkeleton.test.tsx — UI-SPEC Contract 1 regression guard (6 tests)"
  modified:
    - "src/components/suggestions/SuggestionSkeleton.tsx — 3 flat h-24 bars → 3 card silhouette shells"
    - "src/components/layout/Navbar.tsx — preload=\"intent\" on Topics/Archive; comment above Admin explains cold-by-omission"
    - "src/components/layout/MobileNav.tsx — same preload changes as Navbar"
    - "src/components/suggestions/SuggestionCard.tsx — data-testid=\"suggestion-card\" on outer wrapper (pre-ternary)"
    - "src/components/admin/AdminSuggestionsTab.tsx — data-testid=\"admin-create-suggestion\" on primary toolbar Create button"

key-decisions:
  - "Task 3 admin shell target: plan listed AdminShell.tsx which doesn't exist; actual admin shell surface is AdminSuggestionsTab.tsx — testid attached there on the primary (toolbar) Create button. Empty-state duplicate keeps role-based selection."
  - "Task 3 ResultBars: NO source change. ResultBars renders role=\"meter\" (not progressbar) and visible '{percentage}%' + 'N total responses' text. 05-05 must text-match the percentage or use getByRole('meter') — documented for 05-05's executor."
  - "Admin Link gets neither preload=\"intent\" nor preload={false} — omission alone is correct because 05-03 removed defaultPreload. preload={false} would be cargo-cult under the current HIGH #1 shape."

patterns-established:
  - "Skeleton-mirrors-card: any component with a skeleton-loading variant must share the outer shell's Tailwind classes (bg-card rounded-xl border p-5) to keep the visual layout stable across the load → mount transition"
  - "Preload landmine guard: any protected route (beforeLoad redirect) MUST NOT receive preload=\"intent\"; if an app-wide defaultPreload is later reintroduced, each protected Link MUST carry preload={false}"
  - "data-testid placement: attach to the outer component wrapper, unconditionally, before any ternary/spread-props — ensures visibility across all render branches"

requirements-completed:
  - INFR-02
  - TEST-06

# Metrics
duration: 9min
completed: 2026-04-19
---

# Phase 05-launch-hardening Plan 04: UX Polish — Skeleton + Preload + E2E Hooks Summary

**SuggestionSkeleton silhouette now mirrors the real SuggestionCard (bg-card rounded-xl border p-5 + 3 shimmer rows); Topics/Archive Links use preload="intent" in both Navbar and MobileNav with Admin explicitly cold-by-omission; data-testid="suggestion-card" + data-testid="admin-create-suggestion" hooks land for the 05-05 Playwright suite.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-04-19T18:52:xxZ (at invocation, prior to first edit)
- **Completed:** 2026-04-19T19:01:51Z
- **Tasks:** 3 (Task 1 TDD RED + GREEN, Task 2, Task 3)
- **Files modified:** 5 (1 test added, 4 component edits)

## Accomplishments

- UI-SPEC Contract 1 shipped: `SuggestionSkeleton` now renders 3 card-silhouette shells with the exact outer classes as `SuggestionCard` — eliminates CLS on the load → mount transition. 6 regression tests lock the contract.
- UI-SPEC Contract 4 + HIGH #1 (codex review) shipped: Topics/Archive Links in both `Navbar` (desktop) and `MobileNav` opt into TanStack Router `preload="intent"`; Admin Link is cold-by-omission (no attribute at all — `main.tsx` has no `defaultPreload` to override, so preload simply doesn't fire). Pitfall 6 comment blocks above each Admin Link lock the contract against future regressions.
- M7 resolved: `data-testid="suggestion-card"` on `SuggestionCard`'s outer wrapper (unconditional, pre-ternary), and `data-testid="admin-create-suggestion"` on the primary admin Create button. Full text of 05-05's decision tree (including the ResultBars role-meter vs text-match choice) is documented in the Task 3 commit and the Decisions section below.

## Task Commits

All on branch `worktree-agent-af75e6ac` (base `e8cadcc`):

1. **Task 1 RED: failing test for skeleton silhouette** — `dea9252` (test)
2. **Task 1 GREEN: implement silhouette** — `bf1151c` (feat)
3. **Task 2: preload=intent on Topics/Archive** — `6f3ae48` (feat)
4. **Task 3 (M7): data-testid hooks** — `f0f3f39` (feat)

**Plan metadata:** pending (final SUMMARY commit below)

## Files Created/Modified

- `src/__tests__/components/SuggestionSkeleton.test.tsx` (CREATED) — 6 tests locking UI-SPEC Contract 1 (aria-busy + aria-label, 3 card shells, space-y-3, avatar placeholder, >=6 shimmers, no img/text)
- `src/components/suggestions/SuggestionSkeleton.tsx` (MODIFIED) — replaced 12-line 3-flat-bar implementation with 3 card silhouette shells mirroring SuggestionCard
- `src/components/layout/Navbar.tsx` (MODIFIED) — added `preload="intent"` to Topics + Archive Links; Admin Link unchanged with explanatory comment
- `src/components/layout/MobileNav.tsx` (MODIFIED) — same preload changes as Navbar; SheetClose wrappers preserved
- `src/components/suggestions/SuggestionCard.tsx` (MODIFIED) — added `data-testid="suggestion-card"` on outer wrapper div, unconditionally (before `!isPinned` ternary)
- `src/components/admin/AdminSuggestionsTab.tsx` (MODIFIED) — added `data-testid="admin-create-suggestion"` on primary toolbar Create button

## Decisions Made

1. **Task 3 admin shell target — AdminSuggestionsTab.tsx, not AdminShell.tsx.** Plan frontmatter listed `src/components/admin/AdminShell.tsx` in `files_modified`, but this file does not exist in the codebase. The actual admin shell UI composes `AdminTabs` + `AdminSuggestionsTab` + `AdminsList` + `CategoriesList`. The "Create suggestion" trigger (the intent M7 targets for E2E stability) lives inside `AdminSuggestionsTab.tsx` — both the toolbar button and an empty-state duplicate. The toolbar button gets the testid (stable primary target); the empty-state duplicate keeps role-based selection (`getByRole('button', { name: /create suggestion/i })`). Documented in the Task 3 commit.
2. **Task 3 ResultBars — NO source change (option (c) in the plan).** Inspection of `src/components/suggestions/ResultBars.tsx` shows each bar is tagged `role="meter"` (NOT `role="progressbar"` as 05-05's draft speculated) with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`. Visible text nodes include `{percentage}%` and `N total responses`. 05-05's Playwright specs should either (a) select by role `meter` via `page.getByRole('meter')` or (b) text-match the percentage / responses string. This choice is documented in the Task 3 commit so 05-05's executor aligns.
3. **Admin Link: no preload attribute at all (not `preload={false}`).** Plan 05-03 removed the app-wide `defaultPreload` from `src/main.tsx`. Under this shape, omission IS the disable — a Link with no `preload` attribute receives no preload. Adding `preload={false}` would be cargo-cult and would also risk drift if someone later removes it assuming it's redundant. The comment block above each Admin Link documents the contract: "If a future plan re-adds `defaultPreload`, Admin must get `preload={false}` back."
4. **Skeleton test placement** — created `src/__tests__/components/SuggestionSkeleton.test.tsx` (no prior test existed). Followed the existing pattern from `AppErrorFallback.test.tsx` (vitest + testing-library) and used container.querySelector for class-based silhouette assertions since the skeleton is purely visual (no text/roles to target via screen queries).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `files_modified` referenced nonexistent `AdminShell.tsx`**
- **Found during:** Task 3
- **Issue:** Plan's frontmatter `files_modified` and Task 3 `<files>` block listed `src/components/admin/AdminShell.tsx`, which does not exist. Grep for "Create suggestion" confirmed the real shell surface is `AdminSuggestionsTab.tsx`.
- **Fix:** Added `data-testid="admin-create-suggestion"` to the primary toolbar Create button in `src/components/admin/AdminSuggestionsTab.tsx` (the actual admin shell surface hosting the Create trigger). Documented the substitution in the Task 3 commit so 05-05's executor targets the right file.
- **Files modified:** `src/components/admin/AdminSuggestionsTab.tsx`
- **Verification:** `grep -q 'data-testid="admin-create-suggestion"' src/components/admin/AdminSuggestionsTab.tsx` → OK
- **Committed in:** `f0f3f39` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 3 blocking-file-path substitution)
**Impact on plan:** Minimal — plan's intent (stable E2E selector for the admin Create trigger) was preserved; only the target filename changed. No scope creep.

## Issues Encountered

- **Pre-existing test failures (4 in `admin-shell.test.tsx`):** Already documented in `.planning/phases/05-launch-hardening/deferred-items.md` (§05-01 and §05-03 observations). Cause: `src/lib/supabase.ts` throws "Missing Supabase environment variables" in the test environment because no `.env.local` is set in the worktree. Verified pre-existing via `git stash && npm test` — same 4 failures before Task 1 edits. SCOPE BOUNDARY: out of scope for this plan.
- **Pre-existing lint failures (7 `react-refresh/only-export-components` errors):** Also pre-existing per `deferred-items.md`. All 7 are in files NOT modified by this plan (`theme-provider.tsx`, `badge.tsx`, `button.tsx`, `__root.tsx`, `auth/callback.tsx`, `auth/error.tsx`, `routes/index.tsx`). My 5 modified files lint clean. Verified pre-existing via `git stash && npm run lint`.

## User Setup Required

None — this plan is pure UX polish + test-hook additions with no new env vars, auth surfaces, or data paths.

## Next Phase Readiness

- UI-SPEC Contracts 1 and 4 are now shipped and locked by a regression test (Contract 1) + commit comments (Contract 4). README §12 "upgrade ritual" should reference the Pitfall 6 comment blocks so any future router upgrade notices the cold-by-omission invariant.
- 05-05 Playwright suite (Wave 2) now has:
  - Stable `data-testid="suggestion-card"` for browse/respond scenarios
  - Stable `data-testid="admin-create-suggestion"` for admin CRUD scenarios
  - Documented ResultBars selector strategy: `getByRole('meter')` or text-match `{percentage}%` — NOT `role="progressbar"`
- No blockers for 05-05, 05-06, or 05-07.

## Self-Check: PASSED

Verified claims before marking plan complete:

**Files exist:**
- `src/__tests__/components/SuggestionSkeleton.test.tsx` → FOUND
- `src/components/suggestions/SuggestionSkeleton.tsx` → FOUND (modified)
- `src/components/layout/Navbar.tsx` → FOUND (modified)
- `src/components/layout/MobileNav.tsx` → FOUND (modified)
- `src/components/suggestions/SuggestionCard.tsx` → FOUND (modified)
- `src/components/admin/AdminSuggestionsTab.tsx` → FOUND (modified)

**Commits exist in git log:**
- `dea9252` → FOUND (Task 1 RED)
- `bf1151c` → FOUND (Task 1 GREEN)
- `6f3ae48` → FOUND (Task 2)
- `f0f3f39` → FOUND (Task 3)

**Tripwires passed:**
- Skeleton: all 8 grep tripwires OK; 6/6 unit tests pass
- Preload: Navbar & MobileNav each have `preload="intent"` x2; no Admin-link preload; no `defaultPreload` in `main.tsx`
- Testids: `suggestion-card` present before `!isPinned` ternary (line 81 < line 87); `admin-create-suggestion` present

**Build + tests:**
- `npm run build` → exit 0
- `npm test -- --run` → 352 passing, 4 pre-existing failures unchanged (documented in `deferred-items.md`)

---
*Phase: 05-launch-hardening*
*Plan: 04 — UX Polish (Skeleton + Preload + E2E Hooks)*
*Completed: 2026-04-19*
