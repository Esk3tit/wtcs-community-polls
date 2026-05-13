---
phase: 06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden
plan: 02b
status: complete
disposition: GDPR opt-IN wiring shipped + R-03 + P-02 closures
date: 2026-04-26
---

# 06-02b — GDPR opt-IN wiring SUMMARY

## Outcome

Default-OFF semantics for PostHog event capture and Sentry Replay are now
observable end-to-end. ConsentContext is wired into all four library /
runtime touchpoints. R-03 AuthContext effect split landed (consent flips
never churn the auth subscription). P-02 Replay-leak reload landed
(decline from allow forces a page reload to terminate live Replay).
Sentry ERROR capture remains unconditional per D-05.

## Completed Tasks

| # | Task | Status | Commit | Files |
|---|------|--------|--------|-------|
| 1 | posthog.ts default-OFF native config | done | `aca1620` | `src/lib/posthog.ts` |
| 2 | sentry.ts gate flip + ConsentContext.decline P-02 reload + 2 new tests | done | `aca1620` | `src/lib/sentry.ts`, `src/contexts/ConsentContext.tsx`, `src/__tests__/contexts/ConsentContext.test.tsx` |
| 3 | main.tsx — mount ConsentProvider between PostHogProvider and RouterProvider | done | `aca1620` | `src/main.tsx` |
| 4 | AuthContext R-03 two-effect split + R-03/P-06 regression test + wrap existing AuthProvider tests | done | `aca1620` | `src/contexts/AuthContext.tsx`, `src/__tests__/contexts/AuthContext.test.tsx` (NEW), `src/__tests__/auth/auth-provider.test.tsx` |

## What was built

**Task 1 — `src/lib/posthog.ts`** — `posthog.init()` config block extended
with three keys: `opt_out_capturing_by_default: true`,
`opt_out_persistence_by_default: true`, `respect_dnt: true`. Init call
itself unchanged (single-init guard kept; PostHog issue #2841 anti-pattern
avoided).

**Task 2 — Sentry Replay gate flip + ConsentContext P-02 reload:**
- `src/lib/sentry.ts` — `loadSentryReplayIfConsented` now checks
  `localStorage.wtcs_consent === 'allow'` instead of
  `localStorage.analytics_opted_out === 'true'`. Legacy reference fully
  removed. Function signature, idempotency guard, dynamic-import path,
  and `addIntegration` call all unchanged.
- `src/contexts/ConsentContext.tsx` — `decline()` now reads previous
  localStorage value before writing 'decline'. If previous was 'allow',
  fires `window.location.reload()` to terminate any active Sentry Replay
  session (P-02; mitigates RESEARCH.md Pitfall 7).
- `src/__tests__/contexts/ConsentContext.test.tsx` — two new tests
  covering P-02: (a) decline from allow → reload called once; (b) decline
  from undecided → reload not called. Test count rises from 8 to 10.

**Task 3 — `src/main.tsx`** — `<ConsentProvider>` mounted as a child of
`<PostHogProvider>` and parent of `<RouterProvider>`. Order matters:
PostHog initializes first via `initPostHog()` so it's ready when
ConsentContext's side-effect bridge calls `posthog.opt_in_capturing()`.
`Sentry.ErrorBoundary` wraps the whole tree from outside; `Sentry.init`
remains unconditional (D-05).

**Task 4 — AuthContext R-03 split + regression test:**
- `src/contexts/AuthContext.tsx` — added `useConsent()` call at the top
  of `AuthProvider`. The original `if (providerId) { posthog.identify(providerId) }`
  block was removed from inside the `onAuthStateChange` callback. A new
  dedicated `useEffect` with deps `[consentState, user]` now performs the
  identify call gated on `consentState === 'allow'`. The auth-subscription
  effect's dependency array stays `[fetchProfile]` — consentState is NOT
  added, so consent flips never re-run `getSession()` /
  `onAuthStateChange` subscription.
- `src/__tests__/contexts/AuthContext.test.tsx` (NEW) — R-03 / P-06
  regression test: user already signed in (mocked supabase session with
  `provider_id: 'discord-12345'`), consent flips undecided → allow,
  identify fires exactly once with `'discord-12345'`. Plus a negative
  test: identify never fires when consent stays undecided.
- `src/__tests__/auth/auth-provider.test.tsx` — 5 `render(<AuthProvider>...)`
  blocks wrapped with `<ConsentProvider>` since AuthProvider now consumes
  `useConsent()`. PostHog + Sentry mocks added so the consent side-effect
  bridge doesn't accidentally call into real analytics.

## Verification

- `npm run lint` exits 0.
- `npm run test -- --run` exits 0; **369/369 tests pass** (was 367 + 2
  new AuthContext.test.tsx tests; the 2 new ConsentContext P-02 tests
  raised that file from 8 to 10 inside the prior 367 count after
  intermediate edits).
- `npm run build` exits 0.
- All Task 1 grep AC pass (3 PostHog config keys present).
- All Task 2 grep AC pass: `wtcs_consent` ×3 in sentry.ts (>=1);
  `analytics_opted_out` ×0 in sentry.ts (legacy ref fully removed);
  `loadSentryReplayIfConsented` ×1; `window.location.reload` ×1 in
  ConsentContext; `previous === 'allow'` ×1; `P-02` ×1 in source + ×1 in
  test.
- All Task 3 grep AC pass: `<ConsentProvider>` ×1, `</ConsentProvider>` ×1,
  Sentry.init not consent-gated.
- All Task 4 grep AC pass: `useConsent` ×2; `useEffect` ×3 (≥2);
  `[consentState, user]` ×3; `posthog.identify` call site ×1 (only the
  new dedicated effect; comment phrasing avoids the literal); auth-subscription
  effect's dependency array does NOT include consentState; new test file
  exists with `R-03` ×2 and `discord-12345` ×2.

## Deviations from Plan

**[Rule 1 — Test-mock hoisting] Vitest hoists `vi.mock()` factories before module init**
- **Found during:** Task 4 first test run.
- **Issue:** The plan's skeleton for the new AuthContext.test.tsx declares
  `const mockIdentify = vi.fn()` BEFORE `vi.mock('@/lib/posthog', () => ({ ... identify: mockIdentify ... }))`.
  Vitest hoists `vi.mock(...)` calls to the top of the file before any
  module-scope `const`/`let` initialization runs, so the factory tries to
  reference `mockIdentify` before it's assigned → `ReferenceError: Cannot
  access 'mockIdentify' before initialization`.
- **Fix:** Wrapped the three mocks (`mockIdentify`, `mockGetSession`,
  `mockOnAuthStateChange`) in `vi.hoisted(() => ({ ... }))` so they lift
  with the mock factories.
- **Files modified:** `src/__tests__/contexts/AuthContext.test.tsx`.
- **Verification:** test file passes 2/2 after the hoist fix.
- **Commit hash:** `aca1620` (single commit; the hoist fix landed before
  the commit).

**[Rule 2 — AC coherence] `posthog.identify` literal appeared in code comment, inflating grep count**
- **Found during:** Task 4 verification.
- **Issue:** The first draft of the new "PostHog identify moved to its own
  effect" comment used the literal phrase `posthog.identify()`, which
  caused `grep -E "posthog\\.identify" | wc -l` to return 2 (one comment +
  one actual call). Plan AC required exactly 1.
- **Fix:** Reworded the comment to "PostHog analytics-identify moved to a
  dedicated effect..." so the literal `posthog.identify` only appears at
  the actual call site.
- **Files modified:** `src/contexts/AuthContext.tsx` (comment text only).
- **Verification:** post-fix `posthog.identify` literal count = 1.
- **Commit hash:** `aca1620`.

**Total deviations:** 2 auto-fixed (1 test-infra hoisting + 1 AC-coherence
comment phrasing). **Impact:** none on behavior; both resolve plan
mechanics issues, not semantics.

## Issues Encountered

- Vitest hoisting behavior bites on first attempts at every test file that
  uses `vi.mock` with closure references. Worth a project convention note
  somewhere ("always wrap mock-factory dependencies in `vi.hoisted()`")
  for future test authors.
- Wrapping 5 existing render blocks one-by-one is tedious; a small
  `renderWithProviders` helper at `src/__tests__/utils/render-with-providers.tsx`
  (mentioned as optional in the plan) would be cleaner if the count grows
  past ~5 files. We have 1 file affected today; helper not warranted yet.

## Carry-forward

- **For 06-02c:** This wiring is invisible to the user. 06-02c builds the
  ConsentBanner (first-visit) + flips ConsentChip to opt-IN state machine,
  giving the user an actual UI to call `useConsent().allow()` /
  `decline()`. Both consume the hook locked here. ConsentChip currently
  uses the legacy `analytics_opted_out` flag — 06-02c rewires it to
  `useConsent()`.
- **For 06-02d:** Once the banner/chip ship, PostHog dashboard live-events
  smoke verifies end-to-end: clean profile + no Allow click → zero events;
  click Allow + reload → pageview within 30s; clean profile + click
  Decline → zero events.
- **For test infra:** consider adding a `vitest-mocks-helper.ts` that
  wraps the common `vi.hoisted` + `vi.mock` pattern used here. Three
  duplicate mock blocks across `ConsentContext.test.tsx`,
  `AuthContext.test.tsx`, and `auth-provider.test.tsx` could share a
  helper.
- **For Phase 7 follow-up issue #17 (Sentry React SDK v10 + React 19
  ErrorBoundary):** still open; orthogonal to this plan but worth noting
  that the consent-flip force-reload (P-02) IS a hard mitigation for the
  Replay-leak case, so even if ErrorBoundary stays broken the Replay
  privacy story is intact for users who explicitly Decline after
  Allowing.

## Authentication Gates

None encountered.
