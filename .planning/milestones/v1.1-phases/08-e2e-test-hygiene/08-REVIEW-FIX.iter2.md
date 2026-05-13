---
phase: 08-e2e-test-hygiene
fixed_at: 2026-05-03T00:00:00Z
review_path: .planning/phases/08-e2e-test-hygiene/08-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 10
skipped: 1
status: partial
---

# Phase 08: Code Review Fix Report

**Fixed at:** 2026-05-03
**Source review:** `.planning/phases/08-e2e-test-hygiene/08-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 11 (1 BLOCKER + 6 WARNING + 4 INFO)
- Fixed: 10
- Skipped: 1

BL-01 and WR-01 share one commit because they both touch the same
`no-restricted-syntax` selector line in `eslint.config.js`; resolving
one without the other would leave the rule incorrect. The other 8
fixes are atomic per finding.

## Fixed Issues

### BL-01 + WR-01: ESLint rule false-positive on `Promise.all([...])` and false-negative on argument-side `.filter()`

**Files modified:** `eslint.config.js`
**Commit:** `bccaca0`
**Applied fix:** Dropped `all` from the matched method names so `Promise.all([page.goto(...), page.waitForLoadState()])` no longer hard-fails lint, and field-scoped the `:has()` walk via `:has(.callee CallExpression[callee.property.name='filter'])` so `.filter()` calls in arguments (e.g. `toHaveCount(arr.filter(p).length)`) no longer silently satisfy the rule. Verified by:

1. Existing `e2e/tests/browse-respond.spec.ts` and `e2e/tests/filter-search.spec.ts` lint clean.
2. A synthetic `_rule-validation-tmp.spec.ts` (deleted after verification) confirmed the arg-side filter is now flagged with the new `E2E-SCOPE-1` message.
3. Standalone Linter harness exercised 13 representative AST patterns; all 5 expected FAIL cases were flagged and all 8 expected PASS cases (including `Promise.all`, `expect(filter()).toHaveCount`, `someArr.all(x)`, chained `filter().first().toBeVisible()`) were not flagged.

### WR-02: Falsy thrown test error swallowed in fixture cleanup

**Files modified:** `e2e/fixtures/poll-fixture.ts`
**Commit:** `78c057e`
**Applied fix:** Added a `normalizeError(e: unknown): Error` helper at module scope that coerces non-Error throws (null, undefined, plain strings, supabase error shapes) into Error instances. Replaced `throw testErr as Error` (a TypeScript-only assertion that hides the runtime fact that throws accept any value) with `throw normalizeError(testErr)` and applied the same coercion to `deleteErr` and to both arms of the `AggregateError`.

### WR-03: Fixture cleanup leaves orphaned poll if delete fails

**Files modified:** `e2e/global-setup.ts` (new), `e2e/playwright.config.ts`
**Commit:** `3240395`
**Applied fix:** Added a `globalSetup` that deletes any rows where `description = 'freshPoll fixture row'` before the suite runs. Targets the deterministic leak-detection marker so base-seed and additive E2E-seed rows are not affected. Skips silently when `SUPABASE_SERVICE_ROLE_KEY` is unset so non-fixture local runs are unaffected. Cleanup failure logs a warning but does not abort — per-test teardown remains the primary defense.

### WR-04: `getByRole('button', { expanded: false })` is dead code on pinned card

**Files modified:** `e2e/tests/browse-respond.spec.ts`
**Commit:** `0f3298b`
**Applied fix:** Updated the comment to reflect actual behavior: `freshPoll` is pinned, so `SuggestionCard` does not spread `role`/`aria-expanded` onto the wrapper, and `collapsedTrigger.count()` always returns 0. Branch is dead in this spec but kept for resilience if a future fixture flips `is_pinned=false`. Also dropped the `CR-PR4:` plan-id reference per the project's WHY-only source-comment convention.

### WR-05: `loginAs` ANON_KEY assertion typed via cast that elides null safety

**Files modified:** `e2e/helpers/auth.ts`
**Commit:** `6e5c517`
**Applied fix:** Removed the redundant `ANON_KEY as string` cast. The module-top `if (!ANON_KEY) throw …` already narrows `ANON_KEY` from `string | undefined` to `string` via TypeScript's control-flow analysis. Removing the cast surfaces a future refactor that moves the throw inside a function as a real type error rather than silently accepting `undefined`.

### WR-06: README claim about `:has()` walk

**Files modified:** `e2e/README.md`
**Commit:** `b9124ee`
**Applied fix:** Updated the README to reflect the new field-scoped `:has(.callee ...)` semantics. Added explicit pass/fail examples (including the previously-misleading `expect(...).toHaveCount(arr.filter(p).length)` case) and documented why `.all` was dropped from the matched method names so `Promise.all([...])` is no longer false-flagged.

### IN-01: `Date.now()` resolution allows parallel-worker collisions

**Files modified:** `e2e/fixtures/poll-fixture.ts`
**Commit:** `d48ce3d`
**Applied fix:** Appended `testInfo.workerIndex` to the title so the format is now `[E2E] {slug} {Date.now()}-{workerIndex}`. Stable per worker process and effectively zero-cost; eliminates the sub-ms collision window between parallel workers.

### IN-02: `// eslint-disable-next-line no-empty-pattern` is unexplained

**Files modified:** `e2e/fixtures/poll-fixture.ts`
**Commit:** `f2e1958`
**Applied fix:** Added a one-line WHY comment per the project's WHY-only convention: the empty destructure is required by Playwright's fixture signature even when the fixture has no upstream deps.

### IN-03: Inline `/\[E2E/` regex duplicated 5x

**Files modified:** `e2e/tests/filter-search.spec.ts`
**Commit:** `a6d2f8e`
**Applied fix:** Extracted `const E2E_TITLE = /\[E2E/` at module top with a WHY comment about the unclosed bracket. Replaced all 5 inline copies. Verified via `npx eslint e2e/tests/` that the E2E-SCOPE-1 rule still passes — `.filter(E2E_TITLE)` keeps the `.filter()` CallExpression in the chain even though the regex itself is now an Identifier reference. Updated the inline doc comment to reference `E2E_TITLE` rather than the inline regex literal.

## Skipped Issues

### IN-04: `e2e/` has no `tsconfig.json`

**File:** `package.json` (repo-root layout)
**Reason:** Skipped as out-of-scope per the reviewer's own note in REVIEW.md: _"Out of scope for Phase 08; track as Phase 09 candidate."_ The pre-existing gap means editor LSP and `tsc -b` (used in lint-staged) silently skip `e2e/` files; only the Playwright runtime catches type errors there. Adding `e2e/tsconfig.json` extending the node config and including `e2e/**/*.ts` would close the gap but is broader than the Phase 08 hygiene mandate. No source change made.
**Original issue:** `tsconfig.app.json` only includes `src`. `tsconfig.node.json` only includes `vite.config.ts`. The `e2e/` directory is not enumerated in any tsconfig, so type errors there are not caught at commit time.

---

_Fixed: 2026-05-03_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
