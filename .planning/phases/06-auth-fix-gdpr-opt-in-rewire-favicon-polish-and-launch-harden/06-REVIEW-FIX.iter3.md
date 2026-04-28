---
phase: 06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden
fixed_at: 2026-04-26T16:50:00Z
review_path: .planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-REVIEW.md
iteration: 2
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 6: Code Review Fix Report (cumulative through iteration 2)

**Fixed at:** 2026-04-26
**Source review:** .planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-REVIEW.md
**Iteration:** 2

**Iteration 2 summary:**
- Findings in scope: 1 (0 critical, 1 warning — Info deferred)
- Fixed: 1
- Skipped: 0

After the iteration-2 fix, the full Vitest suite was rerun: **40 files / 386 tests pass**. `tsc -b --noEmit` exited clean. No regressions.

**Cumulative across iterations 1+2:** 7 warnings closed (WR-01..WR-07). 11 info findings deferred (IN-01..IN-07 from iteration 1, IN-08..IN-11 from iteration 2 — info-tier does not gate the auto loop).

## Iteration 2 Fixed Issues

### WR-07: WR-04 + WR-01 reorder enables double executeAuthCallback() on StrictMode remount path

**Files modified:** `src/lib/auth-helpers.ts`, `src/__tests__/auth/callback-behavior.test.tsx`, `src/__tests__/contexts/AuthContext.verifyingRef.test.tsx`
**Commit:** `833cfea`
**Applied fix:** Added a 1500 ms result-memo TTL to the auth-helpers dedup wrapper. When `callbackPromise` is null but `lastResult` is within `RESULT_CACHE_MS`, the cached result is returned without re-invoking `executeAuthCallback`. This closes the StrictMode unmount→remount window where the WR-04 deferred latch combined with the cleared in-flight promise allowed a second executor invocation (which would re-call Discord's API, re-call `update_profile_after_auth` RPC, and on the failure path re-call `supabase.auth.signOut()`).

TTL is intentionally short (1500 ms, not the 30 s the orchestrator initially suggested) so a real user-driven retry from `/auth/error` is never silently blocked. The window only needs to cover the React StrictMode unmount→remount gap, which is microseconds in practice. The longer TTL would cache a `success: false` result across a "Try Again" click and prevent legitimate re-verification — that retry foot-gun outweighs the marginal extra coverage.

A test-only `__resetAuthCallbackCacheForTests()` helper was exported and wired into the `beforeEach` of both `callback-behavior.test.tsx` describe blocks plus the dedup test inside `AuthContext.verifyingRef.test.tsx`. Without the reset, module-level memo state leaks between tests within the 1500 ms window — the first test would resolve and cache `auth-failed`, then every subsequent test would silently return that cached result without exercising its own mocks. The helper docstring explicitly says production code must not call it.

The existing dedup test (the WR-06 test that asserts `getSession` is called exactly once across two near-simultaneous `handleAuthCallback()` calls) still passes — it asserts the in-flight dedup contract, not the post-resolution memo contract. The two contracts compose cleanly.

## Iteration 1 Fixed Issues (cumulative — closed in prior iteration, no changes in iter 2)

### WR-04: callback.tsx `processed.current = true` set BEFORE async work — failed runs cannot retry

**Files modified:** `src/routes/auth/callback.tsx`
**Commit:** `fbe47ba`
**Applied fix:** Moved `processed.current = true` from before the await into the `.then` body so the latch only engages after the promise actually resolves. Added a `cancelled` flag in the cleanup return so an unmount-during-await doesn't leak a navigate. This fix had to ship before WR-01 because WR-01's `.catch` body also depends on the deferred latch to keep the route retriable on failure.

### WR-01: handleAuthCallback rejection unhandled in /auth/callback route — user stuck on loading screen

**Files modified:** `src/routes/auth/callback.tsx`
**Commit:** `887a89c`
**Applied fix:** Attached `.catch` to `handleAuthCallback()` in the route effect. The handler captures the exception to Sentry with `tags: { area: 'auth-callback-route' }`, logs to console, adds an error-level breadcrumb, sets `processed.current = true`, and navigates to `/auth/error?reason=auth-failed`. Combined with WR-04 the route is now both diagnosable and retriable when handleAuthCallback rejects.

### WR-02: AuthContext bare `catch {}` swallows verification errors — no Sentry breadcrumb, no console log

**Files modified:** `src/contexts/AuthContext.tsx`
**Commit:** `36f9420`
**Applied fix:** Replaced the bare `catch {}` in `onAuthStateChange`'s SIGNED_IN-with-provider_token branch with `catch (err) { Sentry.captureException(err, { tags: { area: 'auth-callback' } }); console.error(...); Sentry.addBreadcrumb({ level: 'error', ... }); ... }`. The `finally { verifyingRef.current = false }` block was preserved untouched.

### WR-03: fetchProfile stale-fetch guard fails when the older fetch resolves with `data: null`

**Files modified:** `src/contexts/AuthContext.tsx`
**Commit:** `3008697`
**Applied fix:** Introduced `latestUserIdRef = useRef<string | null>(null)` (added `useRef` to the React import). `fetchProfile` writes the requested userId into the ref on entry and bails on BOTH the success and error paths if the ref has moved on. This closes the `data: null` clobber path that the previous `if (profileData && profileData.id !== userId)` guard missed.

### WR-05: ConsentChip dismiss writes to localStorage with no UI escape — chip vanishes forever per browser

**Files modified:** `src/components/ConsentChip.tsx`, `src/__tests__/components/ConsentChip.test.tsx`
**Commit:** `c51aa66`
**Applied fix:** Switched both the read (initial state) and the write (handleDismiss) from `window.localStorage` to `window.sessionStorage`. Now the chip dismiss is session-scoped and matches the ConsentBanner tier — the chip re-appears on a fresh tab/window. Test updated to clear `sessionStorage` in `beforeEach`, assert the dismiss writes to `sessionStorage`, and assert nothing leaks into `localStorage`. Per orchestrator guidance: did NOT introduce a UI un-dismiss escape (out of product scope).

### WR-06: AuthContext two-effect split — verification gate (`verifyingRef`) lacks dedicated test coverage

**Files modified:** `src/__tests__/contexts/AuthContext.verifyingRef.test.tsx` (new file)
**Commit:** `a186abd`
**Applied fix:** New test file with four integration tests covering the previously uncovered verifyingRef behaviors:
1. `isOAuthRedirect=true` (URL hash with `access_token`) → `getSession` shortcut is skipped, `loading` stays `true` until verification resolves.
2. `SIGNED_IN` event without `provider_token` while `verifyingRef.current=true` → the gate releases (lines 121-124), `handleAuthCallback` is NOT invoked, and user state populates normally on the next pass.
3. `SIGNED_IN` event with `provider_token` while verification is in flight → state updates are suppressed mid-await; `handleAuthCallback` is invoked exactly once; on resolution the executor is not re-invoked.
4. The orchestrator-requested StrictMode double-mount dedup case: two near-simultaneous `handleAuthCallback()` calls share one `executeAuthCallback` invocation. The test uses `vi.importActual` to bypass the file-scoped auth-helpers mock and asserts `supabase.auth.getSession` is called exactly once across both callers. Documents inline that `first !== second` by promise identity (because the wrapper is `async`), but the dedup contract — "executor runs once" — holds.

---

_Fixed: 2026-04-26_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2 of --auto loop_
