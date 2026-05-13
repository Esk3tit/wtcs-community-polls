---
phase: 08-e2e-test-hygiene
reviewed: 2026-05-03T00:00:00Z
depth: deep
files_reviewed: 7
files_reviewed_list:
  - e2e/README.md
  - e2e/fixtures/poll-fixture.ts
  - e2e/helpers/auth.ts
  - e2e/tests/browse-respond.spec.ts
  - e2e/tests/filter-search.spec.ts
  - eslint.config.js
  - package.json
findings:
  blocker: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-05-03
**Depth:** deep
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 08 is a sound hygiene pass — the `freshPoll` fixture is well-structured around try/catch/finally, the lazy admin client correctly defers env validation, and the E2E-SCOPE-1 ESLint rule does catch the bare-counter pattern in straightforward chains. However, the AST selector has a confirmed false-negative (any `.filter()` call in *arguments* to `.toHaveCount`/`.nth`/etc. silently satisfies the `:has()` clause) and a confirmed false-positive (`Promise.all([...])` is flagged as a list-locator violation). One latent bug in the fixture cleanup logic can swallow a falsy thrown test error. A handful of doc/comment drift items round out the findings.

The single BLOCKER is the false-positive on `Promise.all(...)` — it will hard-fail any future spec that adopts the standard Playwright pattern of `await Promise.all([page.click(...), page.waitForResponse(...)])`. The rule's regex `/^(toHaveCount|first|nth|all|last)$/` matches plain `.all` on any object.

## Blockers

### BL-01: ESLint rule false-positive on `Promise.all([...])`

**File:** `eslint.config.js:51`
**Issue:** The `no-restricted-syntax` selector matches CallExpression where `callee.property.name` is `all`. This catches `Promise.all([...])`, `array.all(...)`, and any future `.all()` method on a non-locator object. Reproduction (verified locally with `npx eslint`):

```ts
// In any e2e/tests/*.spec.ts:
await Promise.all([page.goto('/a'), page.waitForLoadState()])
// → error  E2E-SCOPE-1: filter to [E2E] prefix...
```

`Promise.all` is the canonical Playwright pattern for awaiting a navigation triggered by a click, e.g.:

```ts
await Promise.all([
  page.waitForURL('/admin'),
  page.getByTestId('admin-create-suggestion').click(),
])
```

A future spec adopting this pattern will fail lint and the developer will be forced to either disable the rule (defeating its purpose) or contort the chain. Same problem for `Set.prototype` / `Map.prototype` / generic `.all()` callbacks.

**Fix:** Tighten the selector to require the receiver be a Locator-shaped chain. Two options:

1. Anchor to a known Locator entry-point in the same chain. ESLint AST selectors don't backtrack across `.` boundaries cleanly, so the simplest robust fix is matching only when the chain root is `page`/`expect`/a locator-named identifier:

```js
selector:
  "CallExpression[callee.type='MemberExpression']" +
  "[callee.property.name=/^(toHaveCount|first|nth|last)$/]" +  // drop `all` — too generic
  ":not(:has(CallExpression[callee.property.name='filter']))",
```

   Dropping `all` is the cheapest fix since `.all()` on a Locator is rare in practice (the codebase has zero uses) and `Promise.all` is common.

2. Or whitelist `Promise.all` explicitly via a more specific exclusion:

```js
selector:
  "CallExpression[callee.type='MemberExpression']" +
  "[callee.property.name=/^(toHaveCount|first|nth|all|last)$/]" +
  ":not([callee.object.name='Promise'])" +
  ":not(:has(CallExpression[callee.property.name='filter']))",
```

   This still leaves `someArray.all()` etc. as false-positives, so option 1 is preferable.

## Warnings

### WR-01: ESLint rule false-negative — `.filter()` in argument satisfies `:has()`

**File:** `eslint.config.js:51-53`
**Issue:** The `:has(CallExpression[callee.property.name='filter'])` clause descends into ALL descendants, including ARGUMENTS. Any `.filter()` call inside the args of `.toHaveCount(...)` or `.nth(...)` makes the rule think the chain is filtered. Verified locally:

```ts
const arr = ['a', 'b']
// No .filter() on the locator chain — bare unfiltered counter — should fail.
await expect(page.getByTestId('suggestion-card')).toHaveCount(
  arr.filter(x => x === 'a').length,
)
// → ESLint passes silently. BUG.
```

This is the exact bug class the rule is meant to catch (counting an unfiltered shared-DB list). The `arr.filter(...)` in the argument is unrelated to locator filtering, but the AST selector cannot distinguish them.

**Fix:** Restrict `:has()` to look only at the callee subtree (the chain), not the arguments:

```js
selector:
  "CallExpression[callee.type='MemberExpression']" +
  "[callee.property.name=/^(toHaveCount|first|nth|last)$/]" +
  ":not(:has(> MemberExpression CallExpression[callee.property.name='filter']))",
```

The `>` child combinator + `MemberExpression` constrains the descent to the callee chain. Verify against the existing test specs (which use `expect(...).filter().toHaveCount` patterns) before merging — `expect(...)` wraps in another CallExpression so the path may need `> MemberExpression CallExpression > MemberExpression`. Recommend adding a unit test (e.g., `e2e/tests/_rule-fixture.test.ts` or a separate ESLint rule-tester harness) that asserts both the false-negative and false-positive cases.

### WR-02: Falsy thrown test error swallowed in fixture cleanup

**File:** `e2e/fixtures/poll-fixture.ts:83-99`
**Issue:** The `catch (e) { testErr = e }` + `if (testErr !== undefined) throw testErr` pattern fails when the test body throws `undefined` (or any code under `provide()` does `throw undefined`). It also has a subtler problem: `testErr = e` after a successful `provide()` is impossible (provide rejects only on test failure), so the only way `testErr` stays undefined after the catch is "no throw" — but then the block was reached normally, and `testErr` was never assigned. The check is correct in normal flow.

The actual concrete risk is the type cast on the re-throw:

```ts
throw testErr as Error  // line 99
```

`testErr` is `unknown`. `as Error` is a TypeScript-only assertion — runtime `throw` accepts any value. The cast is not load-bearing and is misleading. More importantly, if the original error was `null` (e.g. `supabase-js` returning `null` on a malformed insert path — unlikely but defensive), the test would re-throw `null` which Playwright reports unhelpfully.

**Fix:** Use `instanceof` guard to coerce non-Error throws into Errors:

```ts
if (testErr !== undefined && deleteErr !== undefined) {
  throw new AggregateError(
    [normalizeError(testErr), normalizeError(deleteErr)],
    'fixture cleanup failed after test failure',
  )
}
if (deleteErr !== undefined) throw normalizeError(deleteErr)
if (testErr !== undefined) throw normalizeError(testErr)

function normalizeError(e: unknown): Error {
  return e instanceof Error ? e : new Error(`Non-Error throw: ${String(e)}`)
}
```

### WR-03: Fixture cleanup leaves orphaned poll if delete fails AND test succeeded

**File:** `e2e/fixtures/poll-fixture.ts:88-91`
**Issue:** If the `polls.delete()` call fails (transient network blip, supabase restart, RLS misconfig), the poll row leaks. The rethrow at line 98 surfaces the failure to the test runner, but the leaked row stays in the DB until the next `supabase db reset`. Across many test runs, this could accumulate hundreds of `[E2E]` rows that the next run's fixture-tests share-DB list assertions then count.

The test-shared-DB convention (E2E-SCOPE-1 filter) deliberately tolerates this kind of leak — the filter on `[E2E]` matches them all. But the leak still contradicts the comment at line 19 which describes the `description: 'freshPoll fixture row'` literal as the leak-detection marker.

**Fix:** Either (a) add a one-shot cleanup query at the start of each test session (a `globalSetup` that does `DELETE FROM polls WHERE description = 'freshPoll fixture row'`), or (b) document the residual-leak window explicitly in `e2e/README.md` so a future engineer knows where to look. (a) is cheaper and matches the leak-detection marker design intent.

### WR-04: `firstCard.getByRole('button', { expanded: false })` is dead code on pinned `freshPoll`

**File:** `e2e/tests/browse-respond.spec.ts:35-39`
**Issue:** `freshPoll.is_pinned = true` (poll-fixture.ts line 61). With `is_pinned: true`, `SuggestionCard.tsx` (line 87) does NOT spread the `role: 'button'` / `aria-expanded` props on the wrapper div. ChoiceButtons render plain `<button>` elements with no `aria-expanded` attribute. Playwright's `{ expanded: false }` filter requires `aria-expanded="false"` literally — a button without the attribute does NOT match.

So `collapsedTrigger.count()` always returns 0 against a pinned-true freshPoll. The if-branch never runs. The defensive click is dead code in this exact spec.

This isn't a bug — the spec still works because the choices are already visible — but the comment at line 35 ("only one collapsed trigger exists") is wrong: ZERO collapsed triggers exist on a pinned card. If the fixture ever flips to `is_pinned: false`, the count becomes 1 and the click would fire. The current code is structured to handle that fork; just document why it's defensive scaffolding rather than required.

**Fix:** Update the comment to reflect actual behavior:

```ts
// Defensive: freshPoll is pinned (always-open), so this branch is normally
// dead. Kept for resilience if a future fixture flips is_pinned=false.
// eslint-disable-next-line no-restricted-syntax -- DOM-scoped inside fixture card; at most one collapsed trigger exists when card is unpinned.
const collapsedTrigger = firstCard.getByRole('button', { expanded: false }).first()
```

### WR-05: `loginAs` ANON_KEY assertion typed via cast that elides null safety

**File:** `e2e/helpers/auth.ts:74`
**Issue:** `createClient(SUPABASE_URL, ANON_KEY as string, ...)` — but ANON_KEY is `string | undefined`. The module-top assertion at line 29-35 throws if undefined, which makes the runtime safe. But moving that throw inside a function (refactor risk) would silently break this cast.

Compare with `getAdminClient` (lines 112-126) which validates the key inside the function. The two helpers follow different patterns. The asymmetry is intentional (lazy vs eager) but it leaves the eager helper one refactor away from a `null` Supabase URL/key being passed silently.

**Fix:** Replace the `as string` cast with a sibling assignment that narrows the type:

```ts
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
if (!ANON_KEY) {
  throw new Error('VITE_SUPABASE_ANON_KEY env var required ...')
}
// ANON_KEY is now `string` without cast
```

Since the throw is at module-top before any export, TypeScript's control-flow analysis already narrows ANON_KEY post-throw. The `as string` cast is redundant and removing it is safer.

### WR-06: README says rule walks "the call chain" but `:has()` walks the entire subtree

**File:** `e2e/README.md:25-27`
**Issue:** The README claims:

> The rule walks the call chain via `:has(...)`, so
> `page.getByTestId('x').filter({ hasText: /\[E2E\]/ }).first()` passes

But `:has()` in ESLint AST selectors descends into ALL descendants, not just the call chain — which is precisely how WR-01 false-negatives occur. The doc creates a false sense of safety: a reader will assume `expect(cards).toHaveCount(arr.filter(x).length)` is caught.

**Fix:** Either fix the rule per WR-01 first, then the README is correct; or update the README to warn explicitly about argument-side `.filter()` calls until WR-01 is patched.

## Info

### IN-01: `Date.now()` resolution in `freshPoll` title is millisecond — collisions theoretically possible

**File:** `e2e/fixtures/poll-fixture.ts:53`
**Issue:** Two parallel workers (CI default `workers: 2`) running tests with identical sanitized titles in the same millisecond would produce identical `[E2E] foo 1714694400123` strings. `polls.title` has no UNIQUE constraint, so it's not a hard error — but the spec's own E2E-SCOPE filter (`hasText: freshPoll.title`) would match BOTH cards and `.first()` would be non-deterministic.

In practice this is vanishingly rare (sub-ms test starts with identical sanitized titles), but the comment at line 12 "test-scoped (NOT worker-scoped) on purpose" + parallel workers makes it possible.

**Fix:** Append a worker-id or random nonce: `${slug} ${Date.now()}-${testInfo.workerIndex}` or `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`.

### IN-02: `// eslint-disable-next-line no-empty-pattern` is a maintenance smell

**File:** `e2e/fixtures/poll-fixture.ts:37`
**Issue:** The `freshPoll: async ({}, provide, testInfo) => {` requires an empty destructure to satisfy Playwright's fixture signature (no other fixture deps). The `// eslint-disable-next-line` is necessary but unexplained.

**Fix:** Add a one-line WHY comment per the project convention (CLAUDE.md memory: "no review-round archaeology in source comments"; comment is WHY not what):

```ts
// Empty destructure required by Playwright fixture signature; freshPoll has no upstream deps.
// eslint-disable-next-line no-empty-pattern
freshPoll: async ({}, provide, testInfo) => { ... }
```

### IN-03: Inline filter regex `/\[E2E/` (unclosed bracket) is intentional but cryptic

**File:** `e2e/tests/filter-search.spec.ts:31, 37, 41, 65, 76`
**Issue:** Five inline copies of `.filter({ hasText: /\[E2E/ })`. The unclosed `[E2E` is documented in lines 30-32 (matches both `[E2E]` and `[E2E SMOKE]`). But the duplication risks drift if a sixth call gets typed as `/\[E2E\]/` (closed) and silently misses `[E2E SMOKE]` rows.

**Fix:** Extract a constant at module top:

```ts
// Matches both '[E2E]' and '[E2E SMOKE]' fixture title prefixes.
const E2E_TITLE = /\[E2E/
// ...
.filter({ hasText: E2E_TITLE })
```

Confirmed safe per WR-01-fix candidate: a `MemberExpression > CallExpression`-only `:has()` walk would still see this inline `.filter()` as part of the chain. A constant reference (`Identifier` not `CallExpression`) would NOT satisfy the rule — so an explicit inline `.filter(E2E_TITLE)` call still exists and the rule is happy. Reorganize after WR-01 is fixed.

### IN-04: `e2e/` has no `tsconfig.json` — files compile under root config implicitly

**File:** `package.json` / repo-root layout
**Issue:** `tsconfig.app.json` only includes `src`. `tsconfig.node.json` only includes `vite.config.ts`. The `e2e/` directory is not enumerated in any tsconfig. Playwright runs `.ts` files via its own ts-node-equivalent transpiler, so this works at runtime. But editor LSP and `tsc -b` (used in lint-staged) silently skip `e2e/` — type errors there are not caught at commit time.

This is pre-existing (not introduced by Phase 08) and out of phase scope. Flagging for awareness: a future bug in `poll-fixture.ts` or `auth.ts` (e.g. dropping a return value, `as` cast hiding a real type mismatch) won't be caught by `npm run lint` or pre-commit `tsc -b`. Only the Playwright runtime would surface it.

**Fix:** Add `e2e/tsconfig.json` extending the node config and including `e2e/**/*.ts`. Add it to the root references array. Out of scope for Phase 08; track as Phase 09 candidate.

---

_Reviewed: 2026-05-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
