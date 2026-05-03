---
phase: 08-e2e-test-hygiene
plan: "01"
subsystem: testing
tags: [playwright, supabase, e2e, fixtures, typescript]

requires:
  - phase: 05-e2e-auth
    provides: "e2e/helpers/auth.ts with loginAs(); e2e/fixtures/test-users.ts with fixtureUsers + FIXTURE_PASSWORD"

provides:
  - "e2e/helpers/auth.ts: lazy getAdminClient() service-role Supabase client (additive, loginAs unchanged)"
  - "e2e/fixtures/poll-fixture.ts: Playwright test.extend<{freshPoll}> fixture with try/catch/finally + AggregateError preservation"

affects:
  - "08-e2e-test-hygiene (plans 02-04 — ESLint E2E-SCOPE rule, browse-respond.spec.ts migration, leak verification)"

tech-stack:
  added: []
  patterns:
    - "Lazy module-scoped service-role client singleton (getAdminClient) — throws only on call without key, not at module-load"
    - "Playwright fixture-of-values with try/catch/finally guarding partial-setup leak window"
    - "Post-finally AggregateError re-throw preserves failing test error when cleanup also fails"
    - "Fixture parameter renamed from 'use' to 'provide' to avoid react-hooks/rules-of-hooks false positive"
    - "deterministic leak-detection marker: description = 'freshPoll fixture row'"

key-files:
  created:
    - e2e/fixtures/poll-fixture.ts
  modified:
    - e2e/helpers/auth.ts

key-decisions:
  - "Rename Playwright use parameter to 'provide' — avoids react-hooks/rules-of-hooks false positive on any name starting with 'use'"
  - "Move throw statements out of finally block to post-finally scope — satisfies no-unsafe-finally ESLint rule while preserving AggregateError semantics"
  - "eslint-disable-next-line no-empty-pattern on freshPoll fixture line — Playwright requires the empty {} destructure for fixture deps"

patterns-established:
  - "Playwright fixture callbacks must not use 'use'-prefixed parameter names (react-hooks lint) — use 'provide', 'give', 'setValue', etc."
  - "Throws inside finally blocks must move post-finally (no-unsafe-finally) — accumulate errors in let variables, throw after the finally block"

requirements-completed:
  - TEST-09

duration: 15min
completed: "2026-05-02"
---

# Phase 08 Plan 01: Fixture Infrastructure Summary

**Lazy service-role Supabase client (getAdminClient) and Playwright freshPoll fixture with try/catch/finally + AggregateError for per-test poll isolation**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-02T00:00:00Z
- **Completed:** 2026-05-02T00:15:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added lazy `getAdminClient()` to `e2e/helpers/auth.ts` — reuses existing `SUPABASE_URL`, throws only when called without `SUPABASE_SERVICE_ROLE_KEY`, does not break anon-only specs at module-load
- Created `e2e/fixtures/poll-fixture.ts` — Playwright `test.extend<{freshPoll}>` fixture that inserts a poll + two choices, guards the partial-setup leak window with try/catch/finally, preserves test errors via AggregateError when cleanup also fails, and uses a single-statement CASCADE DELETE for teardown
- Both files lint clean under `npm run lint --max-warnings=0`; no rot-tag plan/round/PR references in either source file
- `loginAs()` public API is byte-identical to its pre-change shape

## Task Commits

1. **Task 1: Add lazy getAdminClient() to auth.ts** - `9b7b468` (feat)
2. **Task 2: Create freshPoll fixture** - `0afb28e` (feat)

## Files Created/Modified

- `e2e/helpers/auth.ts` — added `SupabaseClient` type import, `_adminClient` lazy singleton, `getAdminClient()` export
- `e2e/fixtures/poll-fixture.ts` — new file: Playwright extended test with `freshPoll` fixture-of-values

## Decisions Made

- **Rename `use` → `provide`:** Playwright fixture callbacks receive a `use` parameter by convention, but ESLint's `react-hooks/rules-of-hooks` rule fires on any function parameter starting with `use`. Renamed to `provide` to avoid the false positive without adding a blanket disable comment.
- **Post-finally re-throw pattern:** ESLint's `no-unsafe-finally` prohibits `throw` inside `finally` blocks. Refactored to accumulate `testErr` and `deleteErr` in outer-scoped variables and re-throw after the `finally` block — semantics are identical (AggregateError when both fail), but the throw sites are outside `finally`.
- **`eslint-disable-next-line no-empty-pattern`:** Playwright's `base.extend` fixture signature requires `{}` as the first destructure argument for the fixture dependency bag. The empty pattern is intentional; the inline disable is the least noisy fix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ESLint lint errors blocked the Task 2 commit**
- **Found during:** Task 2 (poll-fixture.ts creation)
- **Issue:** Three lint errors in the plan's verbatim code: `no-empty-pattern` on `{}` arg, `react-hooks/rules-of-hooks` on `use` param name, `no-unsafe-finally` on `throw` inside `finally`
- **Fix:** Added `eslint-disable-next-line no-empty-pattern` comment; renamed `use` → `provide`; moved throw logic post-`finally` using accumulated `testErr`/`deleteErr` variables
- **Files modified:** `e2e/fixtures/poll-fixture.ts`
- **Verification:** `npm run lint --max-warnings=0` passes; all acceptance criteria (try/catch/finally present, AggregateError present, error branches all rethrow) verified
- **Committed in:** `0afb28e` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking lint errors)
**Impact on plan:** Required reshaping the fixture body to comply with project ESLint config. Functional semantics are identical to the plan spec — partial-setup leak guard, AggregateError test-error preservation, single-statement CASCADE DELETE all intact.

## Issues Encountered

The plan provided verbatim code that assumed the `react-hooks/rules-of-hooks` and `no-unsafe-finally` rules would not apply to `e2e/` files. The project ESLint config applies `reactHooks.configs.flat.recommended` to all `**/*.{ts,tsx}` with no `e2e/` exclusion, so both rules fired. All three lint errors were blocking and resolved via Rule 3.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `getAdminClient()` and `freshPoll` fixture are the prerequisites for Plan 03's `browse-respond.spec.ts` migration (TEST-09 closure)
- Plan 02 (ESLint E2E-SCOPE rule) and Plan 03 (spec consumer) can proceed independently in subsequent waves
- No blockers

## Threat Surface Scan

No new network endpoints, auth paths, or trust-boundary changes introduced beyond what the plan's `<threat_model>` already covers (T-08-01 through T-08-05).

---
*Phase: 08-e2e-test-hygiene*
*Completed: 2026-05-02*

## Self-Check: PASSED

- FOUND: e2e/helpers/auth.ts
- FOUND: e2e/fixtures/poll-fixture.ts
- FOUND: .planning/phases/08-e2e-test-hygiene/08-01-SUMMARY.md
- FOUND commit: 9b7b468 (Task 1)
- FOUND commit: 0afb28e (Task 2)
