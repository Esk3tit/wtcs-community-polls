---
phase: 08-e2e-test-hygiene
fixed_at: 2026-05-03T00:00:00Z
review_path: .planning/phases/08-e2e-test-hygiene/08-REVIEW.md
iteration: 2
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 08: Code Review Fix Report

**Fixed at:** 2026-05-03
**Source review:** `.planning/phases/08-e2e-test-hygiene/08-REVIEW.md`
**Iteration:** 2

**Summary:**
- Findings in scope: 3 (1 warning, 2 info)
- Fixed: 3
- Skipped: 0

## Fixed Issues

### WR-A1: globalSetup import-time throw can short-circuit the SERVICE_ROLE_KEY early-return

**Files modified:** `e2e/helpers/auth.ts`
**Commit:** `8ff74b5`
**Applied fix:** Adopted option (a) from REVIEW.md — moved the `VITE_SUPABASE_ANON_KEY` assertion from module-top into a private `getAnonKey()` helper invoked from inside `loginAs`. The earlier module-top throw fired at import time and defeated `global-setup.ts`'s line-19 early-return on missing `SUPABASE_SERVICE_ROLE_KEY`, blocking ad-hoc local runs that didn't need either supabase key. The new lazy pattern mirrors the pre-existing `getAdminClient()` lazy-singleton design and removes the asymmetry between the two clients. Comment text follows project convention (WHY-only, no rot-tag plan/round IDs in source).

### IN-A1: E2E_TITLE regex is permissively open-ended

**Files modified:** `e2e/tests/filter-search.spec.ts`
**Commit:** `5d63a06`
**Applied fix:** Tightened `E2E_TITLE` from `/\[E2E/` to `/\[E2E[\] ]/`. The character class accepts either `]` (matches plain `[E2E]`) or a space (matches `[E2E SMOKE]` / future `[E2E ANY-TAG]`), so accidental drift like `[E2EX...]` or `[E2EFakeTag]` no longer satisfies the regex. Verified manually with the six probe cases listed in REVIEW.md (3 should-match + 3 should-reject) — all pass. Updated the inline comment to explain the new precision contract.

### IN-A2: ESLint rule does not cover Locator.count()

**Files modified:** `eslint.config.js`, `e2e/README.md`, `e2e/tests/browse-respond.spec.ts`
**Commit:** `aa5a983`
**Applied fix:** Added `count` to the `no-restricted-syntax` method-name regex (now `/^(toHaveCount|first|nth|last|count)$/`). Updated the rule message and `e2e/README.md` to list `.count` alongside the existing methods. Added a WHY-justified `eslint-disable-next-line` to `browse-respond.spec.ts:40` where `await collapsedTrigger.count()` is invoked on a DOM-scoped variable-bound locator (the existing disable on the line above only covered the locator construction, not the subsequent `.count()` call). Verified the rule now flags an unfiltered `await page.getByTestId('x').count()` while still accepting `await page.getByTestId('x').filter({...}).count()`.

## Verification

- `npx eslint e2e/` runs clean across the entire e2e tree after all three fixes.
- TypeScript syntax check on `e2e/helpers/auth.ts` passes (no parse errors introduced by the lazy-helper extraction).
- Probe spec confirmed the IN-A2 rule expansion correctly flags new unfiltered `.count()` calls and continues to allow the filtered chain.
- No source files left in a broken state; no uncommitted changes remain in the worktree.

## Notes

- All three fixes touch test/lint infrastructure only — no production source changes.
- WR-A1 has a small backwards-compat surface: any external code (none in this repo) that previously relied on `auth.ts` failing at import time when `VITE_SUPABASE_ANON_KEY` is unset will now see the failure deferred until `loginAs()` is actually called. Behavior at the call site is unchanged.
- Iteration 1's `.first()` disable comment on `browse-respond.spec.ts:38-39` was preserved verbatim; only the new `.count()` disable on the line below was added.

---

_Fixed: 2026-05-03_
_Fixer: Claude (gsd-code-fixer, Opus 4.7 1M)_
_Iteration: 2_
