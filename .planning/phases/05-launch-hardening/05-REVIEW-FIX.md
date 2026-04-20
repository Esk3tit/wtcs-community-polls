---
phase: 05-launch-hardening
fixed_at: 2026-04-19T10:41:00Z
review_path: .planning/phases/05-launch-hardening/05-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 8
skipped: 2
status: partial
---

# Phase 5: Code Review Fix Report

**Fixed at:** 2026-04-19
**Source review:** `.planning/phases/05-launch-hardening/05-REVIEW.md`
**Iteration:** 1 of up to 3 (`--auto` mode)

## Summary

- Findings in scope (Critical + High + Medium + Low + Advisory): 10
- Fixed: 8 (1 High, 2 Medium, 3 Low, 2 Advisory)
- Skipped: 2 (Advisory only — with rationale)

All unit tests green (356/356). TypeScript clean. Build verified and
INEFFECTIVE_DYNAMIC_IMPORT warning no longer emitted. Main bundle
reduced by ~123 KB raw / ~39 KB gz thanks to ME-02 Replay code-split.
ESLint errors present in route files are pre-existing (verified on HEAD
prior to any fix commit) and not introduced by this round.

## Fixed Issues

### HI-01: `ConsentChip` renders outside router context but calls `useRouterState`

**Files modified:** `src/main.tsx`, `src/routes/__root.tsx`
**Commit:** `c98265a`
**Applied fix:** Removed `<ConsentChip />` + its import from `src/main.tsx`
and re-inserted them in `src/routes/__root.tsx` inside `RootLayout`, after
`<Toaster />`. ConsentChip now renders as a descendant of `<RouterProvider>`
so `useRouterState()` has a valid router context. ErrorBoundary +
PostHogProvider still wrap everything at the top level. Unit tests still
pass because `ConsentChip.test.tsx` mocks `@tanstack/react-router`.

### ME-01: CORS fallback echoes `ALLOWED_ORIGINS[0]` to non-allowed origins

**Files modified:** `supabase/functions/_shared/cors.ts`
**Commit:** `b196a26`
**Applied fix:** Changed the non-match fallback from `ALLOWED_ORIGINS[0]` to
the CORS-spec literal string `'null'`. Non-allowlisted origins now get a
response the browser unambiguously rejects and that is clearly visible as
"blocked" in logs. The `ALLOWED_ORIGIN` env escape hatch is preserved.

### AD-02: CORS `Vary` header does not include request-method

**Files modified:** `supabase/functions/_shared/cors.ts`
**Commit:** `b196a26` (bundled with ME-01, same file)
**Applied fix:** Expanded `Vary: Origin` to `Vary: Origin,
Access-Control-Request-Method, Access-Control-Request-Headers`. Defense in
depth against any intermediary that caches preflight responses.

### ME-02: `@sentry/react` is both statically and dynamically imported — Replay collapses into main chunk

**Files modified:** `src/lib/sentry-replay.ts` (new), `src/lib/sentry.ts`
**Commit:** `543b30c`
**Applied fix:** Created `src/lib/sentry-replay.ts` that only re-exports
`replayIntegration` from `@sentry/react`. `sentry.ts` now does
`await import('./sentry-replay')` instead of `await import('@sentry/react')`.
Because `sentry-replay.ts` is only dynamically imported (never statically),
Rolldown places it in its own chunk.

**Build verification:**
- Main chunk: 593.98 KB -> 470.05 KB (191.11 KB -> 152.11 KB gz)
- New `sentry-replay-*.js` chunk: 124.01 KB raw / 39.61 KB gz
- `INEFFECTIVE_DYNAMIC_IMPORT` warning no longer present in build log

### AD-03: `sentry.ts` M3 comment drifts from actual behavior

**Files modified:** `src/lib/sentry.ts`
**Commit:** `543b30c` (bundled with ME-02)
**Applied fix:** Updated the M3 comment block to reflect the new
actual bundler behavior (Replay now really is code-split into its own
chunk). Removed the "tree-shaking handles it" language that was
aspirational rather than descriptive.

### LO-01: `supabase status --output json` key fallback order is fragile

**Files modified:** `.github/workflows/ci.yml`
**Commit:** `732ccb2`
**Applied fix:** When the derived ANON_KEY / SERVICE_ROLE_KEY / DB_URL are
empty, also dump `$STATUS | jq -r 'paths(scalars) | join(".")'` so a future
Supabase CLI shape change is diagnosable from the CI log alone. Only paths
(not values) are logged, and the existing `::add-mask::` coverage on the
key material still applies upstream.

### AD-01: `admin-create.spec.ts` — broad button matcher could select the wrong submit

**Files modified:** `src/components/suggestions/form/SuggestionForm.tsx`,
`e2e/tests/admin-create.spec.ts`
**Commit:** `efcbd4c`
**Applied fix:** Added `data-testid="suggestion-form-submit"` to the
`<Button type="submit">` in `SuggestionForm.tsx` and replaced the loose
`page.getByRole('button', { name: /create|publish|submit/i }).last()`
matcher with `page.getByTestId('suggestion-form-submit')`. Eliminates
the `.last()` race risk against unrelated nested buttons.

### LO-02 + LO-03: `loginAs` ordering + re-login semantics

**Files modified:** `e2e/helpers/auth.ts`
**Commit:** `db93da0`
**Applied fix:** Docs-only hardening. Both findings were flagged "fine in
current code" by the reviewer — no code bug — but the ordering
constraints (await before `page.goto`; re-login requires a fresh
navigation before per-user assertions) are load-bearing and now live in
the JSDoc so future tests don't silently regress.

## Skipped Issues

### AD-04: `netlify.toml` Node version as string not numeric

**File:** `netlify.toml:13`
**Reason:** Per user fix_guidance, Node 22 is fine; `AD-04` is not critical
and pinning to an exact patch version during this review-fix round risks
introducing a new drift issue between local/CI/Netlify Node versions that
was not validated by the review. Deferring to a separate intentional
dependency-pinning task if/when Node patches surface a real concern.

### LO-02 (code change half): auth helper clear-sessions-on-relogin

**File:** `e2e/helpers/auth.ts`
**Reason:** The reviewer explicitly classified the code-change version of
LO-02 as "hardening, not bug" and the current code is correct for today's
four specs. Adding `page.evaluate(window.localStorage.clear())` would
change behavior only if a new test re-logged-in without also re-navigating
— a pattern that does not exist. Captured in the JSDoc addition under
LO-02/LO-03 commit so a future spec that introduces such a pattern
surfaces it explicitly instead of silently relying on implicit init-script
ordering. The code-only change would add risk (the `clearCookies` call
was reviewer-suggested "optional") without fixing a present bug.

## Iteration Notes

This is iteration 1 of up to 3 in `--auto` mode. Per the orchestrator
workflow, a depth=deep code-review re-run should follow to surface any
regressions introduced by the fixes. I did not spawn the reviewer
sub-agent from here because (a) the Agent tool is not available in this
agent's toolset, and (b) spawning sub-agents is the orchestrator's
responsibility. Post-fix verification already performed locally:

- `npx tsc --noEmit -p tsconfig.app.json` — clean
- `npm test -- --run` — 356/356 passed
- `npm run build` — success; `INEFFECTIVE_DYNAMIC_IMPORT` resolved;
  new `sentry-replay-*.js` chunk code-split as intended
- `npm run lint` — 7 pre-existing errors (confirmed present on HEAD
  prior to any fix commit; NOT introduced by this round — see note in
  the ci.yml LO-01 commit for further context)

## Residual items for user attention

1. **Pre-existing ESLint `react-refresh/only-export-components` errors**
   in 5 route files (`src/routes/__root.tsx`, `src/routes/index.tsx`,
   `src/routes/auth/callback.tsx`, `src/routes/auth/error.tsx`, and two
   others). These come from the combination of TanStack Router's
   `createRoute(...)` pattern and the `react-refresh` rule. Not
   introduced by this round. Should be addressed as a separate hygiene
   task or by tuning the lint rule config.
2. **Sentry runtime verification** — ME-02 proves the code-split
   structurally at build time. Full runtime confirmation (opted-in user
   loads `sentry-replay-*.js` over the network on mount; opted-out user
   does not) is a DevTools-Network-tab smoke check that the phase
   verifier should exercise once the app is deployed against real DSNs.
3. **Re-review iteration** — orchestrator should spawn the gsd-code-reviewer
   with depth=deep for iteration 2. No HIGH/CRITICAL findings expected
   given the targeted, minimal nature of the changes, but the auto-mode
   gate guarantees we catch any regression.

---

_Fixed: 2026-04-19T10:41:00Z_
_Fixer: Claude (gsd-code-fixer, Opus 4.7 1M)_
_Iteration: 1_
