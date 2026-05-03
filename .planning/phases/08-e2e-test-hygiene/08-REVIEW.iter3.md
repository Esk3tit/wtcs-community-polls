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
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 08: Code Review Report (Iteration 2)

**Reviewed:** 2026-05-03
**Depth:** deep
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Iteration 1 fixes verified. All ten previous findings (BL-01, WR-01..WR-06, IN-01..IN-03) are resolved as designed. ESLint runs clean across `e2e/tests/**` with the field-scoped `:has(.callee ...)` selector, supabase `PostgrestError` correctly extends `Error` so `normalizeError` preserves message/stack for the most common error shape, and `globalSetup`'s deterministic-marker DELETE is safe against base/additive seed rows.

One regression introduced by the iteration-1 fix for WR-03 surfaces a behavior change in failure mode rather than a correctness bug — surfaced as WARNING. Two minor info items document permissive-regex and method-coverage concerns that do not affect current behavior but are worth noting.

## Verification of Iteration 1 Fixes

| Prev ID | Resolution | Verified |
|---------|------------|----------|
| BL-01 | `eslint.config.js:57` drops `.all` from method-name alternation; README.md:34-37 explains. | yes |
| WR-01 | `eslint.config.js:62` uses `:not(:has(.callee CallExpression[callee.property.name='filter']))` — `.callee` field-prefix scopes the descendant walk to the callee MemberExpression subtree. ESLint runs clean across all 4 specs. | yes |
| WR-02 | `poll-fixture.ts:118-120` defines `normalizeError`, used at lines 107/111/112. PostgrestError extends Error (verified in node_modules) so message/stack survive. | yes |
| WR-03 | `e2e/global-setup.ts` registered via `playwright.config.ts:21`. Targets `description='freshPoll fixture row'` (deterministic marker, distinct from base/additive seed rows). | yes (with WR-A1 caveat below) |
| WR-04 | `browse-respond.spec.ts:33-37` documents the dead-branch rationale and the `is_pinned` invariant. | yes |
| WR-05 | `auth.ts:64-72` validates `fixtureUserId` with helpful error; lines 74-77 document ANON_KEY narrowing. | yes |
| WR-06 | `e2e/README.md:25-37` accurately describes `.callee` field-scope and `.all` removal. | yes |
| IN-01 | `filter-search.spec.ts:23-29` documents collision avoidance and SMOKE token rationale. | yes |
| IN-02 | `browse-respond.spec.ts:38, 47` carry WHY-justified eslint-disable comments. | yes |
| IN-03 | `filter-search.spec.ts:8` extracts `E2E_TITLE` named regex constant with comment on the unclosed-bracket choice. | yes |

## Warnings

### WR-A1: `globalSetup` import-time throw can short-circuit the SERVICE_ROLE_KEY early-return

**File:** `e2e/global-setup.ts:1` (chain through `e2e/helpers/auth.ts:29-35`)
**Severity:** WARNING
**Issue:**
`global-setup.ts` line 1 imports `getAdminClient` from `./helpers/auth`. `auth.ts` lines 29-35 contain a **module-top-level throw** if `VITE_SUPABASE_ANON_KEY` is unset. Module-load runs before any function body, so this throw fires before `globalSetup`'s line-19 early-return on `SUPABASE_SERVICE_ROLE_KEY` can execute.

Behavior change introduced by iteration 1: before WR-03, no top-level entry point imported `auth.ts` outside fixture/spec context, so the ANON_KEY assertion was reliably "you're trying to log in, you need an anon key." Now `globalSetup` runs unconditionally for every `npm run e2e` invocation — including ad-hoc local runs that don't use `freshPoll` and don't need either key. The early-return on line 19 was clearly intended to make globalSetup tolerant of missing env in such runs (matching the lazy-singleton pattern documented at `auth.ts:113`), but the module-top-level ANON_KEY throw defeats that intent.

Concrete repro: `unset VITE_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY && npm run e2e -- --grep auth-errors` — the `auth-errors.spec.ts` spec doesn't need either env var (per `auth.ts:113` comment), but globalSetup now blocks the entire run with the ANON_KEY message.

The error message is helpful (loud failure, not silent), so this is a UX/maintenance concern rather than a correctness bug. Importance is bounded by how often the suite is run without env vars — likely rare in practice.

**Fix:**
Either (a) move the ANON_KEY check from module-top to inside `loginAs` so the assertion fires only when actually used, mirroring the lazy `getAdminClient` pattern; or (b) inline the admin-client construction in `global-setup.ts` (just the supabase `createClient` + `delete()` call, ~8 lines) to avoid importing `auth.ts` at all from the global-setup boundary.

```ts
// Option (a) — auth.ts:
function getAnonKey(): string {
  const k = process.env.VITE_SUPABASE_ANON_KEY
  if (!k) throw new Error('VITE_SUPABASE_ANON_KEY env var required for loginAs. ...')
  return k
}
export async function loginAs(page: Page, fixtureUserId: string): Promise<void> {
  const ANON_KEY = getAnonKey()
  // ... rest unchanged
}
```

Option (a) is preferred — it preserves the lazy-singleton intent already established for `getAdminClient` and removes the asymmetry between the two clients.

## Info

### IN-A1: `E2E_TITLE` regex is permissively open-ended

**File:** `e2e/tests/filter-search.spec.ts:8`
**Severity:** INFO
**Issue:**
`const E2E_TITLE = /\[E2E/` has no closing anchor — it matches `[E2E]`, `[E2E SMOKE]`, but also any future title that begins with `[E2E` followed by anything (e.g., `[E2EXX]`, `[E2EFakeTag]`). Today no fixture or seed produces such a string, so this is theoretical. The accompanying comment (lines 5-7) acknowledges the unclosed bracket is intentional, so the trade-off is explicit and documented.

**Fix (optional):**
Tighten to `/\[E2E[\] ]/` — matches `[E2E]` and `[E2E ` (followed by space, as in `[E2E SMOKE]`) but rejects `[E2EX...]`. Skip if the additional precision isn't worth the readability cost.

### IN-A2: ESLint rule does not cover `Locator.count()`

**File:** `eslint.config.js:57`, `e2e/tests/filter-search.spec.ts:47, 71`
**Severity:** INFO
**Issue:**
The rule's method-name regex is `/^(toHaveCount|first|nth|last)$/`. `Locator.count()` (the imperative companion to `toHaveCount`) is NOT covered. `filter-search.spec.ts` lines 44-47 and 68-71 both call `.count()` after a `.filter()`, so they're correct in practice — but a future spec that writes `await page.getByTestId('suggestion-card').count()` (no filter) will pass lint while drifting silently as the seed grows.

This is consistent with the README ("`.toHaveCount`, `.first`, `.nth`, `.last`, `.all`") which also omits `.count`, so the documentation and rule agree. Calling out as a gap rather than a defect.

**Fix (optional):**
Add `count` to the method-name regex: `(toHaveCount|first|nth|last|count)`. Update README correspondingly. Verify no existing test depends on un-filtered `.count()` (greppable; current usage is filter-prefixed).

---

## Notes (non-findings, recorded for trail)

1. **PostgrestError preserves stack via `normalizeError`** — verified in `node_modules/@supabase/postgrest-js/src/PostgrestError.ts:6`: `class PostgrestError extends Error`. The `instanceof Error` short-circuit in `normalizeError` keeps the original class instance, so message/stack/code/details/hint remain accessible through the raised error. WR-02 fix is robust against the most common cleanup-failure shape.

2. **`globalSetup` race window** — Playwright's `globalSetup` is documented to complete before any worker spins up, so it cannot race with in-flight inserts within the same `npm run e2e` invocation. Cross-run races (two concurrent `npm run e2e` against the same shared DB) remain possible but are out of scope for a local-only test stack.

3. **`testErr === undefined` after `throw undefined`** — `let testErr: unknown` initialises to `undefined`, so a literal `throw undefined` inside the try block is indistinguishable from "no throw" at the post-finally re-throw. This is a pre-existing pattern (predates iteration 1) and `throw undefined` is exceedingly rare in practice. Not flagged.

4. **WHY comments on eslint-disable lines** — `browse-respond.spec.ts:38, 47` carry concrete justifications ("DOM-scoped inside fixture card; only one collapsed trigger exists"). PR-review enforcement of WHY-quality is documented in README. IN-02 resolved.

---

_Reviewed: 2026-05-03_
_Reviewer: Claude (gsd-code-reviewer, Opus 4.7 1M)_
_Depth: deep_
