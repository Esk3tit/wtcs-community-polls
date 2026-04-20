---
phase: 05-launch-hardening
reviewed: 2026-04-19T10:45:00Z
iteration: 2
depth: deep
files_reviewed: 10
files_reviewed_list:
  - src/main.tsx
  - src/routes/__root.tsx
  - src/components/ConsentChip.tsx
  - src/lib/sentry.ts
  - src/lib/sentry-replay.ts
  - supabase/functions/_shared/cors.ts
  - .github/workflows/ci.yml
  - src/components/suggestions/form/SuggestionForm.tsx
  - e2e/tests/admin-create.spec.ts
  - e2e/helpers/auth.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
supersedes: iteration-1
---

# Phase 5: Code Review Report — Iteration 2

**Reviewed:** 2026-04-19T10:45:00Z
**Depth:** deep (cross-file / import-graph)
**Files Reviewed:** 10 (fixer-touched subset)
**Status:** clean
**Supersedes:** iteration 1 (10 findings, 8 fixed + 2 intentionally deferred)

## Summary

Iteration 2 verifies the 6 fixer commits (`c98265a` through `db93da0`) against
the 8 actionable findings from iteration 1. All fixes applied correctly with
**no regressions** and **no new issues** detected. Full test suite (356/356)
and production build pass.

Verdict: **CLEAN**. Stop iterating.

## Verification of Iteration-1 Fixes

### HI-01 — ConsentChip moved inside router tree (commit c98265a)

**Correctly applied.** `ConsentChip` is now rendered inside `RootLayout` in
`src/routes/__root.tsx:28`, which is the component attached to
`createRootRoute`. RootLayout sits **under** `<RouterProvider>`, so
`useRouterState()` resolves via the propagated router context.

**Mount-effect cardinality check (deep analysis):** `ConsentChip` is rendered
as a sibling of `<Outlet />` (not inside it). The root route persists for the
entire SPA lifecycle; only `<Outlet />` swaps children on route change.
Therefore `useEffect(() => void loadSentryReplayIfConsented(), [])` fires
**once per session** (desired), not once per navigation. Confirmed by
inspecting `RootLayout` structure at `src/routes/__root.tsx:13-31`.

Wrapping order (outer to inner): `StrictMode > ErrorBoundary > PostHogProvider
> RouterProvider > AuthProvider > ThemeProvider > {Navbar, Outlet, Toaster,
ConsentChip}`. ConsentChip has access to Auth + Theme + Router context, while
ErrorBoundary still catches it. Clean.

### ME-02 — Sentry Replay code-split via re-export (commit 543b30c)

**Correctly applied and empirically verified.**

- `src/lib/sentry-replay.ts` re-exports **only** `replayIntegration` from
  `@sentry/react`.
- `src/lib/sentry.ts:43` uses `await import('./sentry-replay')` — the only
  import site for this module. Grep confirms no other file imports
  `sentry-replay` statically or dynamically.
- **Build proof (just ran `npm run build`):** Separate chunk
  `dist/assets/sentry-replay-B4pIhnhe.js` at 124.01 KB raw / 39.61 KB gz.
  No `INEFFECTIVE_DYNAMIC_IMPORT` warning emitted.
- Opt-out users do not fetch this chunk (the `await import` call is gated by
  the `analytics_opted_out` localStorage check in `sentry.ts:34-35`).
- Idempotency preserved via `replayLoaded` flag at `sentry.ts:15, 50`.
- `src/main.tsx:4` still statically imports `* as Sentry from '@sentry/react'`
  for `Sentry.init` + `Sentry.ErrorBoundary`. Tree-shaking correctly keeps
  `replayIntegration` out of the main bundle — confirmed by build output
  (main bundle 470 KB / 152 KB gz does **not** contain replay code, which
  lives solely in the dedicated chunk).

### ME-01 + AD-02 — CORS 'null' fallback + Vary hardening (commit b196a26)

**Correctly applied.** `supabase/functions/_shared/cors.ts:16` returns the
literal string `'null'` for non-allowlisted origins (CORS-spec compliant —
see RFC 6454 §7). `Vary: Origin, Access-Control-Request-Method,
Access-Control-Request-Headers` at line 25 prevents stale-preflight caching.
Env-var escape hatch (`ALLOWED_ORIGIN`) preserved. Allowlist still includes
both prod and localhost dev origin.

### LO-01 — CI key-path dump on failure (commit 732ccb2)

**Correctly applied.** `.github/workflows/ci.yml:99-100` dumps
`jq -r 'paths(scalars) | join(".")'` to surface JSON-shape changes in future
Supabase CLI versions. Dump only fires on the error path (after `if [ -z ... ]`
guard). Since the dump outputs only **key paths** (not values), this is safe:
paths like `API.ANON_KEY` are not secret material even without masking.

### AD-01 — data-testid for admin-create submit (commit efcbd4c)

**Correctly applied.** `data-testid="suggestion-form-submit"` at
`src/components/suggestions/form/SuggestionForm.tsx:234` sits on the **real**
submit button (not a conditional branch). The button renders in the default
form path (`mode === 'create'` or `edit`), after the `loaded`/`loadError`
early-returns. The Playwright spec at `e2e/tests/admin-create.spec.ts:42`
uses `page.getByTestId('suggestion-form-submit')`. Loose role matcher
eliminated.

### LO-02 / LO-03 — loginAs JSDoc clarification (commit db93da0)

**Correctly applied.** `e2e/helpers/auth.ts:46-59` now documents both the
"await before goto" contract (LO-03) and the "re-login requires subsequent
navigation" semantics (LO-02). No runtime behavior change, docs-only.

## Cross-File / Import-Graph Analysis (deep)

- **No circular imports introduced.** `sentry-replay.ts` re-exports from
  `@sentry/react` and is imported only by `sentry.ts` dynamically.
  `sentry.ts` is imported only by `ConsentChip.tsx`. No cycle.
- **No duplicate Sentry integration sources.** Grep confirms
  `replayIntegration` is named exactly once in source (`sentry-replay.ts:17`)
  and consumed once (`sentry.ts:43`).
- **Router context flow validated.** `useRouterState` call sites: only
  `ConsentChip.tsx:25`. Its render site (`__root.tsx:28`) is under
  `RouterProvider` (`main.tsx:57`). No orphaned hook calls.
- **Error propagation unchanged.** No new `throw`/`catch` boundaries;
  `loadSentryReplayIfConsented()` swallows nothing — it `await`s a dynamic
  import whose rejection would surface via the un-awaited `void` in
  `ConsentChip.tsx:34`. Unhandled promise rejection would still be captured
  by Sentry's own `window.onunhandledrejection` hook. Acceptable tradeoff
  for a non-critical analytics side-effect.

## Verification Results

- `npm test -- --run`: **356/356 tests pass** (35 files).
- `npm run build`: clean build, no warnings. Code-split chunk
  `sentry-replay-B4pIhnhe.js` 124.01 KB / 39.61 KB gz confirmed.

## Known Deferred (intentional, not regressions)

These two advisories from iteration 1 were deliberately skipped per the
fix workflow and are **not** resurfaced:

- **AD-04** — Node-pin drift across workflows (cosmetic, deferred to
  Phase 6 infra sweep).
- **LO-02 residual** — "non-bug" loginAs semantic nuance fully captured in
  JSDoc (db93da0); no code change needed.

---

_Reviewed: 2026-04-19T10:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep (iteration 2)_
