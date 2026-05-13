---
phase: 06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden
reviewed: 2026-04-26T09:55:00Z
depth: deep
iteration: 3
files_reviewed: 22
files_reviewed_list:
  - src/__tests__/auth/auth-provider.test.tsx
  - src/__tests__/auth/callback-behavior.test.tsx
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
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 6: Code Review Report (Iteration 3 — WR-07 TTL Re-review)

**Reviewed:** 2026-04-26T09:55:00Z
**Depth:** deep
**Files Reviewed:** 22
**Status:** clean

## Summary

Iteration 3 re-review focused on the WR-07 fix in `src/lib/auth-helpers.ts`
(commit 833cfea), which adds a 1500ms result-memo TTL on top of the existing
in-flight shared-promise dedup. The fix correctly closes the StrictMode dev
double-mount window without poisoning legitimate user retries. All 386 tests
pass across 40 test files.

### TTL fix verification (auth-helpers.ts:29-46)

**Memo correctness.** The two-tier guard reads cleanly:

```ts
if (callbackPromise) return callbackPromise           // in-flight dedup
if (lastResult && Date.now() - lastResult.ts < RESULT_CACHE_MS) {
  return lastResult.result                             // post-resolution memo
}
callbackPromise = executeAuthCallback()
try {
  const result = await callbackPromise
  lastResult = { result, ts: Date.now() }
  return result
} finally {
  callbackPromise = null
}
```

Strict less-than on the TTL boundary is correct (a fresh executor runs at exactly
1500 ms elapsed). `lastResult` is assigned only after `await callbackPromise`
resolves; if the executor ever threw (it can't — `executeAuthCallback` catches
at the top level), the cache would NOT be poisoned because the throw would
bypass the `lastResult = ...` line and propagate out before the `return`. The
`finally` clears `callbackPromise` AFTER `lastResult` is written, preserving the
invariant: when the in-flight promise is gone, the memo is populated.

**Retry-from-error-page is unaffected.** Traced both realistic retry paths:

1. `AuthErrorPage` "Try Signing In Again" button → calls `signInWithDiscord()`
   → `supabase.auth.signInWithOAuth({ provider: 'discord' })` → browser
   redirects to discord.com and back through Supabase's OAuth callback. The
   Discord OAuth round-trip takes many seconds in practice, far exceeding the
   1500 ms TTL. The cache is stale by the time `/auth/callback` mounts.
2. Browser back-button to `/auth/callback` within 1500 ms after a failure: the
   cached failure short-circuits and re-routes to `/auth/error` without
   re-calling Discord's API. This is desired behavior — prevents API hammering
   on rapid back/forward navigation.

**StrictMode dev double-mount short-circuits correctly.** The verifyingRef
test suite (`AuthContext.verifyingRef.test.tsx:249-287`) directly asserts the
dedup contract: two near-simultaneous `handleAuthCallback()` invocations result
in exactly one `getSession()` call. The 1500 ms memo extends the same
protection past the in-flight window into the post-resolution gap, so a
remount that arrives after the first promise has cleared still hits the memo
instead of firing a fresh executor (which would re-call Discord's API +
`update_profile_after_auth` RPC and on the failure path re-trigger `signOut`).

### Test-only reset symbol scope (auth-helpers.ts:54-57)

`__resetAuthCallbackCacheForTests()` follows the established `__test*` /
`*ForTests` naming convention. Grep across `src/` confirms it is referenced
ONLY from:

- `src/__tests__/auth/callback-behavior.test.tsx` (lines 33, 58, 261)
- `src/__tests__/contexts/AuthContext.verifyingRef.test.tsx` (lines 263, 268)

No prod code path imports it. The function correctly resets BOTH
`callbackPromise` and `lastResult`, matching the two pieces of module-level
state added in this commit. Both test files call it in `beforeEach`, so
prior-test memo state cannot leak across tests within the 1500 ms TTL window —
the exact reason the symbol was added.

Caveat (informational, not a finding): there is no compile-time enforcement
that the export is unreachable from prod bundles — it's a regular `export`.
A `// @internal` JSDoc tag plus an API-extractor check would be
belt-and-suspenders, but the double-underscore prefix + `ForTests` suffix +
the JSDoc warning ("Production code MUST NOT call this") is the established
JS/TS convention and is sufficient here.

### Cross-file regression trace (deep depth)

- `src/routes/auth/callback.tsx`: calls `handleAuthCallback()` once per mount.
  The WR-04 latch-reorder (don't set `processed.current` until after await)
  plus WR-07 memo combine correctly: a second mount inside 1500 ms hits the
  memo; outside that window, fresh execution runs.
- `src/contexts/AuthContext.tsx:117-140`: calls `handleAuthCallback()` once
  per `SIGNED_IN` event that carries `provider_token`. The WR-02 catch (lines
  125-137) routes thrown errors to `/auth/error`; combined with the WR-07
  memo, a duplicate `SIGNED_IN` (rare) would also short-circuit without
  re-running verification.
- The `onAuthStateChange` subscription itself is unchanged. The memo only
  affects `handleAuthCallback`'s body, not auth event delivery.
- `signInWithDiscord` (AuthContext.tsx:197-205) is unchanged. The OAuth
  redirect always re-enters via `/auth/callback`, where the TTL window
  reasoning applies.
- The stale-fetch guard for `fetchProfile` (WR-03, latestUserIdRef) is
  unaffected — it operates on a different module-level lifecycle.

### No new regressions introduced

- `npx vitest run` → 40 files, 386 tests pass (3.42 s).
- No new `console.log`, no new `eval`, no new dynamic-property assignments,
  no new untyped exports, no new dependencies introduced in this iteration.
- Consent/PostHog/Sentry plumbing untouched.
- TypeScript strict mode passes (`noUnusedLocals`, `noUnusedParameters`,
  `verbatimModuleSyntax` all clean).

### History summary

All previously-found findings remain closed:

- **CR-01** (iteration 1): fixed
- **WR-01** (iteration 1, callback rejection handler): fixed
- **WR-02** (iteration 1, AuthContext catch instead of bare try): fixed
- **WR-03** (iteration 1, latestUserIdRef stale-fetch guard): fixed
- **WR-04** (iteration 1, latch-reorder for processed.current): fixed
- **WR-05** (iteration 2, ConsentChip dismiss → sessionStorage): fixed
- **WR-06** (iteration 2, verifyingRef coverage): fixed
- **WR-07** (iteration 3, this review — TTL memo): fixed and verified

No new BLOCKERs or WARNINGs surfaced in iteration 3.

---

_Reviewed: 2026-04-26T09:55:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
_Iteration: 3 of --auto loop_
