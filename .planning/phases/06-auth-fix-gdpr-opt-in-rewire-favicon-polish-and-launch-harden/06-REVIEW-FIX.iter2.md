---
phase: 06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden
fixed_at: 2026-04-26T00:00:00Z
review_path: .planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-04-26
**Source review:** .planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (0 critical, 6 warning — Info deferred)
- Fixed: 6
- Skipped: 0

All six warnings were applied cleanly. After all fixes, the full Vitest suite was rerun: **40 files / 386 tests pass**. `tsc -b --noEmit` exited clean. No regressions detected.

## Fixed Issues

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
_Iteration: 1_
