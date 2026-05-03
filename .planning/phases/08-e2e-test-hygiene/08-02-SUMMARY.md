---
phase: 08-e2e-test-hygiene
plan: 02
subsystem: testing
tags: [eslint, playwright, e2e, documentation, no-restricted-syntax]

requires:
  - phase: 08-e2e-test-hygiene/08-01
    provides: freshPoll fixture, poll-fixture.ts, e2e/fixtures/seed.sql, e2e structure

provides:
  - ESLint no-restricted-syntax rule scoped to e2e/tests/**/*.spec.ts enforcing E2E-SCOPE-1
  - e2e/README.md documenting E2E-SCOPE-1, freshPoll fixture, two-layer seed, run-locally, and gotchas
  - package.json e2e npm script for local-dev symmetry

affects: [08-e2e-test-hygiene/08-03]

tech-stack:
  added: []
  patterns:
    - "E2E-SCOPE-1: list locators must filter to [E2E]-prefixed rows before .first/.nth/.last/.all/.toHaveCount"
    - "ESLint :has() walk selector catches .filter() anywhere in call chain — no false positives on compliant code"
    - "eslint-disable-next-line no-restricted-syntax -- WHY escape-hatch for DOM-scoped locators"

key-files:
  created:
    - e2e/README.md
  modified:
    - eslint.config.js
    - package.json

key-decisions:
  - "Used :has() AST walk (not > direct-child) in selector — confirmed zero false positives on all four existing specs post-Plan-03 migration per RESEARCH §3"
  - "e2e npm script omits --grep @smoke to keep local usage generic; CI adds the flag directly in ci.yml"
  - "Rule intentionally fires on unmigrated browse-respond.spec.ts and filter-search.spec.ts — this is the forcing function for Plan 03"

patterns-established:
  - "E2E-SCOPE-1: always Locator.filter({ hasText: /\\[E2E\\]/ }) before list assertions on shared DB"
  - "WHY-only comments in source files — no plan/round/PR/issue rot tags"

requirements-completed:
  - TEST-08

duration: 12min
completed: 2026-05-02
---

# Phase 08 Plan 02: ESLint E2E Guard + README + npm Script Summary

**ESLint no-restricted-syntax rule blocking unscoped list locators in e2e specs, plus e2e/README.md documenting E2E-SCOPE-1 and freshPoll fixture patterns**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-02T00:00:00Z
- **Completed:** 2026-05-02T00:12:00Z
- **Tasks:** 3
- **Files modified:** 3 (eslint.config.js, package.json, e2e/README.md)

## Accomplishments

- Added flat-config block to `eslint.config.js` scoped to `e2e/tests/**/*.spec.ts` with `:has()` walk selector that fires on `.toHaveCount/.first/.nth/.all/.last` without a preceding `.filter()` anywhere in the call chain
- Added `"e2e": "playwright test --config e2e/playwright.config.ts"` to `package.json` scripts for local-dev symmetry with `npm run lint` / `npm test`
- Created `e2e/README.md` (139 lines) covering E2E-SCOPE-1 rule, escape-hatch convention, `freshPoll` fixture usage, two-layer seed explainer, run-locally instructions, and common gotchas

## Plan-Level Verification Result

Running `npx eslint e2e/tests/` fires on:
- `browse-respond.spec.ts` L24, L32, L40 (unmigrated)
- `filter-search.spec.ts` L31, L62 (unmigrated)

Does NOT fire on `admin-create.spec.ts` or `auth-errors.spec.ts` (zero matched call sites).

This is the EXPECTED forcing function — these failures are NOT a Plan 02 regression. Plan 03 migrates both unmigrated specs to clear the rule.

## Task Commits

1. **Task 1: Append no-restricted-syntax flat-config block** - `1b93685` (feat)
2. **Task 2: Add e2e npm script to package.json** - `a420dde` (chore)
3. **Task 3: Create e2e/README.md** - `89d85fe` (docs)

## Files Created/Modified

- `eslint.config.js` — New flat-config block scoped to `e2e/tests/**/*.spec.ts` with `:has()` walk selector for E2E-SCOPE-1
- `package.json` — Added `e2e` script (`playwright test --config e2e/playwright.config.ts`)
- `e2e/README.md` — 139-line doc: E2E-SCOPE-1 rule + escape-hatch + freshPoll fixture + two-layer seed + run-locally + gotchas

## Decisions Made

- `:has()` AST walk (not `>` direct-child) per RESEARCH §3: the direct-child form false-positives on chained calls; `:has()` catches `.filter()` anywhere in the chain
- Lint rule intentionally fires on unmigrated specs before Plan 03 lands — CI's `lint-and-unit` job blocks the `e2e` job, making this a hard gate
- No `--grep @smoke` in the `e2e` npm script — generic is correct for local dev; CI handles the grep flag

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Plan 03 is unblocked: it migrates `browse-respond.spec.ts` and `filter-search.spec.ts` to clear the E2E-SCOPE-1 lint errors introduced here
- `npm run lint` WILL fail until Plan 03 lands — this is expected and documented above
- `e2e/README.md` is the authoritative reference for the E2E-SCOPE-1 convention; Plan 03 can cite it

---
*Phase: 08-e2e-test-hygiene*
*Completed: 2026-05-02*
