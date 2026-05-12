---
phase: 12-admin-ui-user-ui-uidn-03-sweep
plan: 03
subsystem: admin-ui
tags: [vis-07, admin, shadcn, switch, sonner, optimistic-toast]

# Dependency graph
requires:
  - phase: 11-schema-rls-ef-foundations
    provides: polls.results_hidden column; polls_effective view projection; toggle-results-visibility EF (admin-gated, idempotent, race-safe)
  - phase: 12-admin-ui-user-ui-uidn-03-sweep
    plan: 00
    provides: src/components/ui/switch.tsx vendored shadcn primitive; regenerated database.types.ts with polls.results_hidden flowing through polls_effective Row type
provides:
  - useToggleResultsVisibility hook (optimistic + sonner toast + revert; mirrors usePinPoll precedent per D-01)
  - AdminSuggestionRow inline Switch cluster (D-05/D-06/D-07: right side, action-form label, mobile Eye/EyeOff icon swap)
  - AdminSuggestionsTab per-row pending Set + handleToggleResultsVisibility (optimistic + revert + reconcile)
  - data-testid={`visibility-switch-${pollId}`} locator surface for Plan 06 TEST-13
affects:
  - 12-04 (VIS-08 user-facing hidden-state Alert) — no direct coupling but consumes the same `results_hidden` field
  - 12-05 / 12-06 — TEST-13 Playwright spec will drive the Switch via this testid

# Tech tracking
tech-stack:
  added: []  # No new deps — uses shadcn Switch (Wave 1) + existing sonner/lucide-react/supabase-js
  patterns:
    - "Admin mutation hook = useState(submitting) + useRef(inflightRef) + try/catch/finally + extractFunctionErrorMessage + symmetric sonner toast — replicated from usePinPoll verbatim"
    - "Optimistic + per-row pending Set: multiple rows can be in-flight independently; pendingVisibility: Set<string> grows on click, shrinks on response"
    - "Switch wrapped in <label className=\"... min-h-[44px] cursor-pointer\"> for WCAG 2.5.5 + 2.5.8 click-through + 44px touch target"

key-files:
  created:
    - src/hooks/useToggleResultsVisibility.ts
    - .planning/phases/12-admin-ui-user-ui-uidn-03-sweep/12-03-SUMMARY.md
  modified:
    - src/components/admin/AdminSuggestionRow.tsx
    - src/components/admin/AdminSuggestionsTab.tsx

key-decisions:
  - "Defensive boolean coerce on Switch onCheckedChange: `v === true ? false : true` — the shadcn Switch primitive's onCheckedChange signature is `boolean` for a controlled Switch, but a defensive coerce avoids the TypeScript-narrow surprise if Radix ever widens to `boolean | 'indeterminate'` in a future major. Net behavior is identical to `!v` for the boolean-only path."
  - "Per-row pending Set vs single isSubmitting flag — the hook itself owns a single `submitting` state, but the caller layers a per-pollId Set so two rows can be in-flight concurrently without one disabling the other's Switch. This is a strict improvement over usePinPoll's caller pattern; the pin path didn't need it because pinning is rarely concurrent across rows."
  - "No re-sort in handleToggleResultsVisibility — results_hidden does not affect the server ORDER BY (is_pinned DESC, created_at DESC), unlike pin which re-sorts. The optimistic update only patches results_hidden in-place; fetchAll() is the authoritative reconciliation."

requirements-completed: []  # VIS-07 marked complete by orchestrator at phase end (not per-plan)

# Metrics
duration: ~15 min
completed: 2026-05-12
---

# Phase 12 Plan 03: VIS-07 Admin Switch + Optimistic Toast Summary

**Wired the VIS-07 inline admin Switch into `AdminSuggestionRow`, plus the new `useToggleResultsVisibility` hook and `AdminSuggestionsTab` optimistic-flip handler. Admins can now toggle `results_hidden` per suggestion via a state-mirroring Switch with adaptive mobile/desktop layout, in-flight Loader2, symmetric sonner toast, and revert-on-error — matching the `usePinPoll` precedent verbatim per D-01.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-12T21:11Z (approx — after Wave 1 dependency landed)
- **Completed:** 2026-05-12T21:25Z
- **Tasks:** 2 (both autonomous, no checkpoints)
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- **`src/hooks/useToggleResultsVisibility.ts` created** — mirrors `usePinPoll` shape exactly:
  - `submitting` state + `inflightRef` rapid-click guard
  - `supabase.functions.invoke('toggle-results-visibility', { body: { poll_id, hidden } })`
  - Symmetric success toast per VIS-07 D-03: `'Results hidden for: {title}'` / `'Results visible for: {title}'`
  - Error toast via `extractFunctionErrorMessage(error, 'Could not update visibility. Try again.')` — surfaces 403/404/4xx body messages when the EF returns them
  - Returns `{ ok: true | false } as const` discriminated union
- **`AdminSuggestionRow.tsx` updated:**
  - `AdminSuggestion` type gains `results_hidden: boolean` (Plan 00 type regen makes this strict — `polls_effective` Row already projects it)
  - New props: `onToggleResultsVisibility(pollId, nextHidden)` callback + optional `isPendingVisibility?: boolean`
  - Right side wrapped in a `flex items-center gap-2 shrink-0` cluster holding the new Switch + existing `SuggestionKebabMenu`
  - Switch cluster: `<label>` wrap with `min-h-[44px] cursor-pointer select-none`, Switch `checked={!resultsHidden}` (ON = visible per D-06), adaptive label (`hidden sm:inline` "Hide/Show results" ≥ sm) + lucide `Eye`/`EyeOff` icon swap (`sm:hidden inline-flex` < sm) per D-07
  - In-flight: Switch `disabled` + `aria-busy` + adjacent `Loader2 animate-spin` per D-02
  - `aria-label` reflects CURRENT state per UI-SPEC Accessibility Contract (Radix convention)
  - `data-testid={`visibility-switch-${s.id}`}` locator on the Switch primitive for Plan 06 TEST-13
- **`AdminSuggestionsTab.tsx` updated:**
  - Imports + destructures `useToggleResultsVisibility`
  - New `pendingVisibility: Set<string>` state — per-pollId in-flight tracking so multiple rows can toggle concurrently
  - `handleToggleResultsVisibility` mirrors `handleTogglePin` shape: optimistic local flip → fire EF → revert + return on `!res.ok` → `void fetchAll()` reconciliation on success
  - Title pulled from the row snapshot at handler entry (used only for toast interpolation — does not flow to EF body, which is strictly `{ poll_id, hidden }` per Phase 11 EF contract)
  - No re-sort in optimistic step (unlike `handleTogglePin`) — `results_hidden` doesn't affect server ORDER BY
  - Passes `onToggleResultsVisibility` + `isPendingVisibility={pendingVisibility.has(s.id)}` down to each row

All verification gates passed: `npm run lint` (0 errors), `npx tsc -b` (exit 0), `npm run test` (390/390 passing — including `polls-effective-invariant.test.ts` and the existing optimistic-pin tests).

## Task Commits

Each task committed atomically on `worktree-agent-af9e3cd16061d81ec`:

1. **Task 12-03-01: Create useToggleResultsVisibility hook** — `5b591b9` (feat)
2. **Task 12-03-02: Wire VIS-07 Switch into AdminSuggestionRow + AdminSuggestionsTab** — `f24be78` (feat)

## Files Created/Modified

- `src/hooks/useToggleResultsVisibility.ts` (created, 45 LOC) — admin mutation hook for `toggle-results-visibility` EF (optimistic + symmetric sonner toast + structured error extraction + inflightRef rapid-click guard)
- `src/components/admin/AdminSuggestionRow.tsx` (modified, +51/−5 LOC) — type gains `results_hidden`, props gain `onToggleResultsVisibility` + `isPendingVisibility`, right-side cluster now holds the inline VisibilitySwitch + kebab
- `src/components/admin/AdminSuggestionsTab.tsx` (modified, +30/−5 LOC) — new hook import + pendingVisibility Set + handleToggleResultsVisibility callback + props passed to each row

## Decisions Made

- **Defensive boolean coerce on `Switch.onCheckedChange`.** The handler is `(v) => onToggleResultsVisibility(s.id, v === true ? false : true)` rather than the terser `!v`. For a controlled `<Switch checked={...}>` the Radix primitive only ever emits `true | false`, but the broader `SwitchPrimitive.Root` signature is `(checked: boolean) => void` — using an explicit identity guard insulates against a future Radix surface widening (e.g., to a checkbox-like `'indeterminate'`) without changing the boolean-only behavior today.
- **Per-row pending Set in the tab, not per-row state in the row.** The hook's `submitting` state is *single-mutation* (matches `usePinPoll`'s shape). The tab adds a `Set<string>` keyed by `pollId` so two admins-or-clicks across two rows can race without disabling each other's Switch. Strict superset of the usePinPoll caller's UX.
- **No re-sort in the optimistic update.** `handleTogglePin` re-sorts because `is_pinned` is the first sort key on the server; `results_hidden` is not in the server ORDER BY, so the optimistic flip is a pure in-place patch. The post-mutation `fetchAll()` still reconciles canonical server state.
- **Defensive `title` fallback.** `handleToggleResultsVisibility` pulls `target?.title ?? 'this suggestion'` so a poll that was deleted between optimistic-flip and EF response (mid-air race) still surfaces a sensible toast string. The EF body itself is unaffected — it only receives `{ poll_id, hidden }`.

## Deviations from Plan

None. The plan executed exactly as written.

The plan's `<interfaces>` block sketched both an explicit `if (inflightRef.current) return { ok: false as const }` guard and a defensive boolean coerce on the Switch handler. Both were honored verbatim in the implementation. The "VisibilitySwitch render shape" was inlined into `AdminSuggestionRow.tsx` (no extracted sub-component) — the plan explicitly said "planner's discretion; inline is fine given the row is only 90 lines"; inline kept the change atomic in a single file.

The pre-existing `const rows = ((data ?? []) as unknown) as AdminSuggestion[]` unknown-cast in `AdminSuggestionsTab.tsx` was left untouched. The plan flagged this as an "optional cleanup beyond Phase 12 scope, leave it for a follow-up unless it actively errors." It compiles fine post-Plan-00 type regen; deferred to a future hygiene plan.

## Threat Surface Scan

No new trust boundaries introduced. The hook calls a Phase 11 EF that is already admin-gated (`requireAdmin` + 403 path verified by Phase 11 TEST-12). The audit-row write happens server-side on a state change; the inflightRef + Switch `disabled` during in-flight prevents the user-intent → double-audit race per T-12-03-03/T-12-03-05.

No `from('polls')` direct reads added — `polls-effective-invariant.test.ts` continues to pass.

## Self-Check: PASSED

- `src/hooks/useToggleResultsVisibility.ts`: FOUND
- `src/components/admin/AdminSuggestionRow.tsx` contains `results_hidden: boolean`: FOUND
- `src/components/admin/AdminSuggestionRow.tsx` contains `onToggleResultsVisibility`: FOUND
- `src/components/admin/AdminSuggestionRow.tsx` contains `` data-testid={`visibility-switch- ``: FOUND
- `src/components/admin/AdminSuggestionsTab.tsx` contains `useToggleResultsVisibility`: FOUND
- `src/components/admin/AdminSuggestionsTab.tsx` contains `handleToggleResultsVisibility`: FOUND
- `src/components/admin/AdminSuggestionsTab.tsx` contains `pendingVisibility`: FOUND
- Commit `5b591b9` (Task 1): FOUND in `git log --all`
- Commit `f24be78` (Task 2): FOUND in `git log --all`
- `npm run lint`: exit 0
- `npx tsc -b`: exit 0
- `npm run test`: 390 / 390 passing
- `polls-effective-invariant.test.ts`: 2 / 2 passing

---
*Phase: 12-admin-ui-user-ui-uidn-03-sweep*
*Plan: 03*
*Completed: 2026-05-12*
