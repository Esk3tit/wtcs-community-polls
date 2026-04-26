---
phase: 06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden
reviewed: 2026-04-26T16:45:00Z
depth: deep
iteration: 2
files_reviewed: 22
files_reviewed_list:
  - src/__tests__/auth/auth-provider.test.tsx
  - src/__tests__/components/ConsentBanner.test.tsx
  - src/__tests__/components/ConsentChip.test.tsx
  - src/__tests__/components/ConsentMutualExclusion.test.tsx
  - src/__tests__/contexts/AuthContext.test.tsx
  - src/__tests__/contexts/AuthContext.verifyingRef.test.tsx
  - src/__tests__/contexts/ConsentContext.test.tsx
  - src/components/auth/AuthErrorPage.tsx
  - src/components/ConsentBanner.tsx
  - src/components/ConsentChip.tsx
  - src/components/debug/DebugAuthOverlay.tsx
  - src/contexts/AuthContext.tsx
  - src/contexts/ConsentContext.tsx
  - src/hooks/useConsent.ts
  - src/lib/auth-helpers.ts
  - src/lib/consent-styles.ts
  - src/lib/posthog.ts
  - src/lib/sentry.ts
  - src/main.tsx
  - src/routes/__root.tsx
  - src/routes/auth/callback.tsx
findings:
  blocker: 0
  warning: 1
  info: 4
  total: 5
status: issues_found
---

# Phase 6: Code Review Report (Iteration 2 — Re-review of Fixes)

**Reviewed:** 2026-04-26
**Depth:** deep
**Iteration:** 2 of `--auto` loop
**Files Reviewed:** 22 (21 source + new verifyingRef test file)
**Status:** issues_found (1 new warning surfaced by WR-04 reorder; the 6 closed warnings remain closed)

## Summary

Iteration 2 re-reviews the six fix commits (`fbe47ba`, `887a89c`, `36f9420`, `3008697`, `c51aa66`, `a186abd`) that closed iteration 1's warnings WR-01..WR-06. All 386 vitest tests pass (40 files); no regressions to existing behavior were detected.

**Verdicts on the closed warnings:**

- **WR-01 (callback .catch):** **Closed correctly.** The `.catch` captures, logs, breadcrumbs, and routes to `/auth/error?reason=auth-failed`. The cancelled-flag + processed.current latch are reordered consistently with WR-04 — both `.then` and `.catch` set `processed.current = true` only on resolution, and both honor `cancelled`.
- **WR-02 (AuthContext bare catch):** **Closed correctly.** `catch (err)` now does `Sentry.captureException` + `console.error` + breadcrumb. PII check passed: `String(err)` in the breadcrumb cannot leak provider_token because no error path in `executeAuthCallback` interpolates the bearer token into its message — Discord API errors expose status code + statusText only; Supabase RPC errors expose error.message which is server-side and does not contain client tokens. The `finally { verifyingRef.current = false }` correctly releases the gate even on the throw path.
- **WR-03 (stale-fetch bail):** **Closed correctly.** `latestUserIdRef.current = userId` is written at the *start* of `fetchProfile`, and both the success path and the catch path bail when the ref no longer matches. The previous data-null clobber bug is gone. Note: `latestUserIdRef` is never reset to null on sign-out, which is intentional and harmless — a subsequent sign-in (same or different user) re-writes the ref before the next fetch.
- **WR-05 (chip sessionStorage):** **Closed correctly.** Dismiss now writes to `window.sessionStorage`, matching `ConsentBanner`. The test asserts both `sessionStorage` is set AND `localStorage` is NOT polluted, which closes the original concern. Minor migration tech debt: any user who dismissed the chip pre-fix has a stale `posthog_consent_chip_dismissed='true'` in `localStorage`. The new code reads from `sessionStorage`, so the stale `localStorage` key is silently orphaned (does not affect rendering). Acceptable; no fix required.
- **WR-06 (verifyingRef tests):** **Closed correctly.** Four new tests in `AuthContext.verifyingRef.test.tsx` exercise (1) the `isOAuthRedirect=true` getSession-skip, (2) the gate-release on `SIGNED_IN` without provider_token, (3) state-suppression mid-`handleAuthCallback`-await with explicit promise hold-and-resolve, (4) auth-helpers shared-promise dedup via `vi.importActual` bypass of the file-scoped mock. All four pass. The dedup test in particular is well-constructed — it directly verifies `mockGetSession.toHaveBeenCalledTimes(1)` across two near-simultaneous handleAuthCallback() calls.

**WR-04 (latch reorder) — closed but introduces one new follow-up warning. See WR-07 below.** The reorder fixes the "wedged spinner on rejection" bug, but the dedup window in `auth-helpers.ts` is exactly "while the promise is in flight." Once the first call resolves and clears `callbackPromise`, a remount that finds `processed.current=false` (because the first resolution was cancelled) will fire a *fresh* executor invocation — which re-calls `update_profile_after_auth` RPC and potentially `supabase.auth.signOut()` on the failure path. Server-side these are idempotent, but the doubled side effects are a behavior change worth documenting.

**Iteration-1 warnings status:** 6 of 6 closed. **Iteration-2 new findings:** 1 warning (WR-07), 4 info.

## Warnings

### WR-07: WR-04 + WR-01 reorder enables double executeAuthCallback() on StrictMode remount path

**File:** `src/routes/auth/callback.tsx:22-65`, `src/lib/auth-helpers.ts:18-28`
**Issue:** With `processed.current = true` now deferred until after the promise resolves (WR-04 fix), and the auth-helpers dedup window being exactly "while `callbackPromise !== null`" (cleared in `finally` after first resolution), the StrictMode double-mount sequence in dev now allows the executor to run twice:

  1. First mount: `processed.current=false` → `handleAuthCallback()` invoked → `callbackPromise` set → executor running.
  2. First mount unmounts (StrictMode dev double-mount cleanup) → cleanup sets `cancelled=true`.
  3. Executor resolves → `.then` fires → `cancelled===true` → bails BEFORE setting `processed.current=true` → `callbackPromise` cleared in finally.
  4. Second mount: `processed.current` is still `false` → calls `handleAuthCallback()` again → fresh executor → second `update_profile_after_auth` RPC call, second `signOut()` on failure paths.

The Phase 6 R-03 doc comment in `AuthContext.tsx:82-83` describes this exact cleanup-vs-resolution race as the *reason* for the verifyingRef gate in onAuthStateChange. But the *callback route* path doesn't have that gate — and the WR-04 reorder makes this re-entry observable in dev StrictMode (and in any rare prod re-route that briefly remounts /auth/callback).

The server-side RPC `update_profile_after_auth` is documented SECURITY DEFINER and idempotent, so functionally this isn't a data-corruption blocker. But it IS:
  - Two `fetch('https://discord.com/api/users/@me')` calls per OAuth flow on dev mounts (rate-limit cost on Discord's side, however small).
  - Two breadcrumb sets in Sentry — confusing the auth-debug timeline.
  - One *or more* additional `supabase.auth.signOut()` calls on the failure-path remount, which can race the legitimate sign-out on the original mount.

**Fix:** Set `processed.current = true` synchronously *and* gate the .then/.catch on it, OR memoize the result for ~1s after resolution so a remount during that window short-circuits. The cleanest fix is option B in auth-helpers:
```ts
let callbackPromise: Promise<AuthCallbackResult> | null = null
let lastResult: { result: AuthCallbackResult; ts: number } | null = null
const RESULT_CACHE_MS = 1500

export async function handleAuthCallback(): Promise<AuthCallbackResult> {
  if (callbackPromise) return callbackPromise
  if (lastResult && Date.now() - lastResult.ts < RESULT_CACHE_MS) return lastResult.result
  callbackPromise = executeAuthCallback()
  try {
    const r = await callbackPromise
    lastResult = { result: r, ts: Date.now() }
    return r
  } finally {
    callbackPromise = null
  }
}
```
This preserves WR-04's retry-on-true-failure intent (cache TTL is short) while preventing StrictMode double-execution.

## Info

### IN-08: callback.tsx `.catch` swallows `cancelled` case without breadcrumb

**File:** `src/routes/auth/callback.tsx:49-50`
**Issue:** When the route unmounts and the rejection arrives, `if (cancelled) return` exits silently — no breadcrumb saying "rejection arrived after route unmount." For an auth-flow debug timeline, knowing the rejection happened (just couldn't be navigated to) is useful. The `.then` cancelled branch has the same pattern but is less interesting because success-after-unmount is benign.
**Fix:** Add a one-line breadcrumb before `return` so Sentry timelines reveal "rejection captured but route had unmounted":
```tsx
if (cancelled) {
  Sentry.addBreadcrumb({
    category: 'auth',
    message: 'callback rejected but route unmounted',
    level: 'warning',
    data: { error: String(err) },
  })
  return
}
```

### IN-09: WR-06 dedup test relies on `vi.importActual` order — fragile

**File:** `src/__tests__/contexts/AuthContext.verifyingRef.test.tsx:259-263`
**Issue:** The dedup test uses `vi.importActual<typeof import('@/lib/auth-helpers')>('@/lib/auth-helpers')` to bypass the file-scoped `vi.mock('@/lib/auth-helpers', ...)`. This works but creates two distinct module instances in test memory: the mocked one (used by `AuthProvider` in earlier `describe` block) and the real one (used here). If a future refactor adds module-level state in auth-helpers consumed by AuthProvider, the two instances would have separate state and the test could pass spuriously. Vitest's `vi.unmock` would be more explicit.
**Fix:** Either (a) split into a separate test file with no top-level mock, or (b) call `vi.doUnmock('@/lib/auth-helpers')` at the top of this `describe` so both `AuthProvider`-driven tests in the prior describe and this dedup test share the real module.

### IN-10: handleAuthCallback dedup window now silently doubled by WR-04 — needs comment

**File:** `src/lib/auth-helpers.ts:15-28`
**Issue:** The dedup comment says "concurrent callers... get the same result without double-executing verification." After WR-04's latch reorder, the *concurrent* window is the same (callbackPromise lifetime), but the *practical* window collapsed: a StrictMode remount calls handleAuthCallback() *after* the previous one resolved, which IS a double-execution from the user's point of view. The comment should explicitly call out "concurrent only — no result memoization across resolution boundary."
**Fix:** Update the comment block above `let callbackPromise` to:
```
// Concurrent-call dedup ONLY — once the in-flight promise resolves and
// callbackPromise is cleared, a subsequent call (e.g. from a /auth/callback
// remount) will start a fresh executor. See Phase 6 WR-07 for the StrictMode
// remount implication.
```

### IN-11: AuthContext.verifyingRef.test.tsx test 3 doesn't assert post-resolution state

**File:** `src/__tests__/contexts/AuthContext.verifyingRef.test.tsx:177-228`
**Issue:** "SIGNED_IN with provider_token while verifying" asserts state-suppression mid-await (good) and asserts `handleAuthCallback` called exactly once (good), but does NOT assert that, post-resolution, the user/loading state actually updates. The gate-release path (`verifyingRef.current = false` in finally) and the subsequent `setSession`/`fetchProfile` are uncovered by this specific test. Test 1 covers `isOAuthRedirect=true → loading stays true` but not `→ resolves to false after success`.
**Fix:** After the `resolveCallback({ success: true })` block, add:
```tsx
await waitFor(() => {
  expect(screen.getByTestId('user-id').textContent).toBe('u-verifying')
  expect(screen.getByTestId('loading').textContent).toBe('false')
})
```
This closes the post-gate-release coverage gap.

---

## Iteration-1 finding status (final)

Six warnings closed correctly. Seven info items from iteration 1 carry over (IN-01 through IN-07) — none were addressed in fix commits since info-tier items don't gate the auto loop. They remain valid follow-up notes in the iteration-1 report.

| ID | Status | Verdict |
|----|--------|---------|
| WR-01 | Closed | `.catch` correctly handles, captures, navigates |
| WR-02 | Closed | Sentry capture + log + breadcrumb; no PII leak |
| WR-03 | Closed | latestUserIdRef bail covers data=null + error paths |
| WR-04 | Closed (with WR-07 follow-up) | Latch deferred; introduces dedup edge case in StrictMode |
| WR-05 | Closed | sessionStorage matches banner tier; test verifies no localStorage write |
| WR-06 | Closed | 4 integration tests cover the verifying gate + dedup |

---

_Reviewed: 2026-04-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
_Iteration: 2 of --auto loop_
