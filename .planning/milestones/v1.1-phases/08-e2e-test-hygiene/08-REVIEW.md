---
phase: 08-e2e-test-hygiene
reviewed: 2026-05-03T00:00:00Z
depth: deep
files_reviewed: 9
files_reviewed_list:
  - e2e/README.md
  - e2e/fixtures/poll-fixture.ts
  - e2e/helpers/auth.ts
  - e2e/tests/browse-respond.spec.ts
  - e2e/tests/filter-search.spec.ts
  - eslint.config.js
  - package.json
  - e2e/global-setup.ts
  - e2e/playwright.config.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 08: Code Review Report (Iteration 3 — final)

**Reviewed:** 2026-05-03
**Depth:** deep
**Files Reviewed:** 9
**Status:** clean

## Summary

Final auto-loop iteration (3 of 3). Verified that the three iteration-2 fixes
are intact and that no new regressions surfaced from the patches. No issues
found — `--auto` loop may terminate.

## Verification of Iteration 2 Fixes

| Prev ID | Resolution | Verified |
|---------|------------|----------|
| WR-A1 | `e2e/helpers/auth.ts:36-46` defines `getAnonKey()` invoked only inside `loginAs` (line 85). Module-top no longer touches `VITE_SUPABASE_ANON_KEY`. `e2e/global-setup.ts` imports only `getAdminClient`, so its line-19 early-return on missing `SUPABASE_SERVICE_ROLE_KEY` is no longer short-circuited. Mirrors the existing lazy-singleton pattern for the admin client. | yes |
| IN-A1 | `e2e/tests/filter-search.spec.ts:10` is now `const E2E_TITLE = /\[E2E[\] ]/`. Character class accepts `]` (plain `[E2E]`) or space (tagged variants like `[E2E SMOKE]`); rejects `[E2EX...]`. Comment at lines 5-9 documents the trade-off. | yes |
| IN-A2 | `eslint.config.js:57` regex is `/^(toHaveCount\|first\|nth\|last\|count)$/` (added `count`). `e2e/README.md:14` lists `.count` in the convention. Escape-hatch comments with WHY justifications: `e2e/tests/browse-respond.spec.ts:38, 40, 48`. | yes |

## Regression Scan (deep depth)

Cross-file checks performed against the import graph rooted at the changed files:

1. **`Locator.count()` callsites** — `browse-respond.spec.ts:41` is escape-hatched (DOM-scoped inside fixture card); `filter-search.spec.ts:46-49, 70-73` chain `.filter()` in the callee subtree. The `:has(.callee CallExpression[callee.property.name='filter'])` field-scoped walk short-circuits both. No shared-DB list bypasses the rule.

2. **`expect(...).toHaveCount(N)`** — single occurrence at `filter-search.spec.ts:84` wraps a chain that already carries `.filter()` on the callee side. Lint passes.

3. **`auth.ts:28` `PROJECT_REF` derivation** — `new URL(SUPABASE_URL).hostname.split('.')[0] || 'localhost'` covers the zero-segment hostname edge case; `SUPABASE_URL` itself has a `??` fallback (line 26). Defensive and correct.

4. **`poll-fixture.ts` cleanup ladder** — try/catch/finally + `AggregateError` preserves both test-error and cleanup-error; `normalizeError` (line 118) coerces non-`Error` throws so the Playwright reporter renders them. Unchanged from iteration 1; no regression introduced by iteration-2 patches.

5. **`global-setup.ts:19` early-return** — composes cleanly with the lazy admin-client singleton in `auth.ts:122-138`. Concrete repro from WR-A1 (running the suite without either env var) now exits gracefully without the ANON_KEY assertion firing at module-top.

6. **`playwright.config.ts:34-43` webServer** — gated on `!CI`; `reuseExistingServer: true` is tautological inside the `!CI` branch and correctly hardcoded.

7. **`package.json`** — unchanged in dependency set across iterations 2-3. No new transitive dependencies, no version churn.

8. **README accuracy** — `e2e/README.md:14, 21-23, 32-37` correctly describe the rule's method-name set including `.count`, the `.callee` field-scope, and the argument-side `.filter()` non-bypass. README and rule agree.

## Notes (non-findings, recorded for trail)

1. **`testErr === undefined` ambiguity after `throw undefined`** — pre-existing pattern in `poll-fixture.ts`; `throw undefined` is exceedingly rare. Not flagged in iterations 1-2; intentionally not reopened.

2. **Cross-run race on shared DB** — `globalSetup`'s deterministic-marker DELETE (`description='freshPoll fixture row'`) could in principle race against an in-flight concurrent `npm run e2e` against the same DB. Out of scope for a local-only test stack; flagged in iteration 1 notes for awareness only.

3. **PostgrestError extends Error** — verified in iteration 1 (`node_modules/@supabase/postgrest-js`); `normalizeError` correctly preserves the original instance through `instanceof Error` short-circuit.

---

_Reviewed: 2026-05-03_
_Reviewer: Claude (gsd-code-reviewer, Opus 4.7 1M)_
_Depth: deep_
