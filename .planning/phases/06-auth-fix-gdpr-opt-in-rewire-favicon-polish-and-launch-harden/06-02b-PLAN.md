---
phase: 06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden
plan: 02b
type: execute
wave: 2
depends_on: [06-02]
files_modified:
  - src/lib/posthog.ts
  - src/lib/sentry.ts
  - src/main.tsx
  - src/contexts/AuthContext.tsx
  - src/contexts/ConsentContext.tsx
  - src/__tests__/contexts/ConsentContext.test.tsx
  - src/__tests__/contexts/AuthContext.test.tsx
autonomous: true
requirements: []
tags: [D-04, D-05]

must_haves:
  truths:
    - "PostHog init has opt_out_capturing_by_default: true, opt_out_persistence_by_default: true, respect_dnt: true (D-04)"
    - "Sentry Replay attach is gated on wtcs_consent === 'allow' (D-04); legacy analytics_opted_out check fully removed from sentry.ts"
    - "Sentry error capture remains unconditional — Sentry.init in main.tsx is NOT gated; only Replay attach is gated (D-05)"
    - "ConsentProvider is mounted between PostHogProvider (outer) and RouterProvider (inner) in main.tsx"
    - "AuthContext.posthog.identify() is gated on consent === 'allow' (D-04) AND lives in its OWN dedicated effect (R-03 split): the auth-subscription effect's dependency array does NOT include consentState, so consent flips never re-run getSession()/onAuthStateChange subscription"
    - "When consent flips from 'allow' → 'decline', ConsentContext.decline() forces window.location.reload() to terminate any active Sentry Replay session immediately (P-02; addresses RESEARCH.md Pitfall 7 mid-session leak)"
    - "Regression test 'user already signed in, consent flips undecided → allow, identify fires exactly once with correct providerId' lives in src/__tests__/contexts/AuthContext.test.tsx and passes (R-03 / P-06)"
    - "All existing AuthProvider-using tests pass without regression (consent provider wrapper applied where needed)"
  artifacts:
    - path: "src/lib/posthog.ts"
      provides: "PostHog init with opt_out_capturing_by_default: true (D-04)"
      contains: "opt_out_capturing_by_default"
    - path: "src/lib/sentry.ts"
      provides: "loadSentryReplayIfConsented gated on wtcs_consent === 'allow' (D-04)"
      contains: "wtcs_consent"
    - path: "src/main.tsx"
      provides: "ConsentProvider mounted between PostHogProvider and RouterProvider"
      contains: "ConsentProvider"
    - path: "src/contexts/AuthContext.tsx"
      provides: "posthog.identify() gated on consent === 'allow' in a dedicated effect with deps [consentState, user] (D-04, R-03)"
      contains: "useConsent"
    - path: "src/contexts/ConsentContext.tsx"
      provides: "decline() force-reloads when previous state was 'allow' to terminate live Replay (P-02)"
      contains: "window.location.reload"
    - path: "src/__tests__/contexts/AuthContext.test.tsx"
      provides: "Regression test: retroactive identify on consent flip (R-03 / P-06)"
  key_links:
    - from: "src/contexts/AuthContext.tsx"
      to: "src/hooks/useConsent.ts"
      via: "consent gate on identify, in OWN useEffect with deps [consentState, user]"
      pattern: "useConsent"
    - from: "src/main.tsx"
      to: "src/contexts/ConsentContext.tsx"
      via: "ConsentProvider mount inside PostHogProvider, outside RouterProvider"
      pattern: "<ConsentProvider"
    - from: "src/contexts/ConsentContext.tsx"
      to: "window.location"
      via: "reload on allow → decline transition"
      pattern: "window\\.location\\.reload"
---

<objective>
Phase 2 of the GDPR opt-IN rewire (split per Phase 6 revision iteration 1; further refined in iteration 2 per REVIEWS.md). Wire the ConsentContext built in 06-02 into the four library/runtime touchpoints: PostHog config (default-OFF native flags), Sentry Replay loader (consent gate), main.tsx provider tree (ConsentProvider mount), and AuthContext (identify gate — R-03 isolated to its own effect).

Purpose: 06-02 ships the context but does not connect it to the libraries. This plan completes the wiring so the default-OFF semantics are observable end-to-end, AND addresses three review findings:

- R-03 (HIGH): Splits AuthContext's analytics-identify call into a separate effect with deps [consentState, user], so consent flips do NOT re-run the auth-subscription effect (no churn of supabase.auth.getSession() / onAuthStateChange re-subscribe).
- P-02 (LOW/MEDIUM): ConsentContext.decline() now forces window.location.reload() when the previous state was 'allow', terminating any active Sentry Replay session (RESEARCH.md Pitfall 7).
- P-06 / R-03 regression test: New AuthContext test asserts that a user who is already signed in and then flips consent 'undecided' → 'allow' triggers identify() exactly once with the correct providerId.

UI surfaces (banner + chip refactor) come in 06-02c.

Output: posthog.ts, sentry.ts, main.tsx, AuthContext.tsx, ConsentContext.tsx (P-02 reload), plus a new AuthContext test file and two new tests appended to ConsentContext.test.tsx. Full test suite stays green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-CONTEXT.md
@.planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-RESEARCH.md
@.planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-PATTERNS.md
@.planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-VALIDATION.md
@.planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-REVIEWS.md
@.planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-02-SUMMARY.md
@src/contexts/ConsentContext.tsx
@src/hooks/useConsent.ts
@src/contexts/AuthContext.tsx
@src/lib/posthog.ts
@src/lib/sentry.ts
@src/lib/sentry-replay.ts
@src/main.tsx

<interfaces>
<!-- Existing types and exports executors will use; no codebase exploration needed. -->

From src/lib/posthog.ts (current init shape — keys to ADD: opt_out_capturing_by_default, opt_out_persistence_by_default, respect_dnt):
```typescript
posthog.init(key, {
  api_host: 'https://us.i.posthog.com',
  person_profiles: 'identified_only',
  capture_pageview: 'history_change',
  session_recording: { maskAllInputs: true },
  autocapture: false,
})
```

From src/lib/sentry.ts (existing consent check — to be FLIPPED to wtcs_consent === 'allow'):
```typescript
const optedOut = window.localStorage.getItem('analytics_opted_out') === 'true'
if (optedOut) return
```

From src/contexts/ConsentContext.tsx (built in 06-02):
```typescript
export interface ConsentContextValue {
  state: ConsentState  // 'undecided' | 'allow' | 'decline'
  allow: () => void
  decline: () => void
}
export function ConsentProvider({ children }: { children: ReactNode }): JSX.Element
```

From src/hooks/useConsent.ts (built in 06-02):
```typescript
export function useConsent(): ConsentContextValue
```

R-03 two-effect AuthContext shape (verbatim — paste into AuthContext.tsx):
```typescript
// Effect 1 — auth subscription (UNCHANGED dependency array; consentState NOT a dep)
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    setUser(session?.user ?? null)
    setLoading(false)
  })
  return () => subscription.unsubscribe()
}, [])

// Effect 2 — analytics identify (R-03: own effect with deps [consentState, user])
useEffect(() => {
  if (consentState === 'allow' && user?.user_metadata?.provider_id) {
    posthog.identify(user.user_metadata.provider_id)
  }
}, [consentState, user])
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: posthog.ts — default-OFF native config</name>
  <files>src/lib/posthog.ts</files>
  <read_first>
    - src/lib/posthog.ts (target file — full read)
    - .planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-RESEARCH.md (Pattern 2 PostHog config; Pitfall 1 init race)
  </read_first>
  <action>
    Extend the existing `posthog.init(key, { ... })` config block by adding three new keys. The full new config block (verbatim) is:

    ```typescript
    posthog.init(key, {
      api_host: 'https://us.i.posthog.com',
      person_profiles: 'identified_only',
      capture_pageview: 'history_change',
      session_recording: { maskAllInputs: true },
      autocapture: false,
      // Phase 6 D-04: GDPR opt-IN — capture and persistence are OFF by default.
      // ConsentProvider flips them on after the user clicks Allow via posthog.opt_in_capturing().
      opt_out_capturing_by_default: true,
      opt_out_persistence_by_default: true,
      // Phase 6 D-04: honor browser Do-Not-Track at init time as well.
      respect_dnt: true,
    })
    ```

    KEEP the `posthog.register({ app: 'community-polls' })` call. DO NOT add a consent check around `posthog.init()` itself — that breaks the global singleton (RESEARCH.md anti-pattern; PostHog issue #2841).

    Run `npm run lint && npm run test -- --run`. Both must pass.
  </action>
  <verify>
    <automated>npm run lint && grep -c "opt_out_capturing_by_default: true" src/lib/posthog.ts && grep -c "opt_out_persistence_by_default: true" src/lib/posthog.ts && grep -c "respect_dnt: true" src/lib/posthog.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "opt_out_capturing_by_default: true" src/lib/posthog.ts` returns 1.
    - `grep -c "opt_out_persistence_by_default: true" src/lib/posthog.ts` returns 1.
    - `grep -c "respect_dnt: true" src/lib/posthog.ts` returns 1.
    - `npm run lint` exits 0.
    - `npm run test -- --run` exits 0 (no regressions).
  </acceptance_criteria>
  <done>PostHog default-OFF via three native config keys; init call signature unchanged; tests green.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: sentry.ts flip + ConsentContext.decline reload-when-previous-was-allow (P-02)</name>
  <files>src/lib/sentry.ts, src/contexts/ConsentContext.tsx, src/__tests__/contexts/ConsentContext.test.tsx</files>
  <read_first>
    - src/lib/sentry.ts (target file — full read; existing consent check is the flip target — find via grep, not line numbers)
    - src/contexts/ConsentContext.tsx (target file — full read; built in 06-02; this task adds P-02 reload-on-decline)
    - src/__tests__/contexts/ConsentContext.test.tsx (target file — full read; two new tests appended for P-02)
    - .planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-RESEARCH.md (Pattern 3 Sentry; Pitfall 7 Replay leak — P-02 directly addresses this)
    - .planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-REVIEWS.md (P-02 reload mandate)
  </read_first>
  <action>
    PART A — sentry.ts flip:

    In `loadSentryReplayIfConsented`, locate the existing consent check by grepping for `analytics_opted_out` in `src/lib/sentry.ts`. Current block:

    ```typescript
    //  - `posthog_consent_chip_dismissed` = chip is hidden (user has seen it)
    //  - `analytics_opted_out` = user explicitly chose "Opt out"
    // Only the explicit opt-out blocks Replay. Plain dismissal via X is accepted.
    const optedOut = window.localStorage.getItem('analytics_opted_out') === 'true'
    if (optedOut) return
    ```

    REPLACE with:

    ```typescript
    // Phase 6 D-04: GDPR opt-IN. Replay is NEVER attached unless the user has
    // explicitly clicked Allow. Single source of truth = localStorage['wtcs_consent'].
    // Sentry ERROR capture remains unconditional (Sentry.init in main.tsx is NOT gated).
    const consent = window.localStorage.getItem('wtcs_consent')
    if (consent !== 'allow') return
    ```

    KEEP everything else: `replayLoaded` guard, `Sentry.getClient()` null-check, dynamic-import-via-`./sentry-replay`, `addIntegration` call.

    PART B — ConsentContext P-02 reload-on-decline:

    Locate the `decline` useCallback in `src/contexts/ConsentContext.tsx`. Current shape:

    ```typescript
    const decline = useCallback(() => {
      window.localStorage.setItem(STORAGE_KEY, 'decline')
      setState('decline')
    }, [])
    ```

    REPLACE with (verbatim):

    ```typescript
    const decline = useCallback(() => {
      const previous = window.localStorage.getItem(STORAGE_KEY)
      window.localStorage.setItem(STORAGE_KEY, 'decline')
      setState('decline')
      // Phase 6 P-02 (REVIEWS.md): if the user is flipping FROM allow TO decline,
      // reload the page to terminate any active Sentry Replay session.
      // Replay does not support runtime detach (RESEARCH.md Pitfall 7).
      // We only reload when there is actually a live session to kill — a fresh
      // decline from 'undecided' or 'decline' does nothing surprising.
      if (previous === 'allow') {
        window.location.reload()
      }
    }, [])
    ```

    DO NOT modify `allow` — flipping decline → allow does not need a reload.

    PART C — Tests for P-02:

    Append two tests to the bottom of the existing `describe(...)` block in `src/__tests__/contexts/ConsentContext.test.tsx`. Mirror the existing Consumer-component pattern used in tests 1-8. The location.reload spy uses Object.defineProperty (the standard jsdom workaround):

    ```typescript
    it('decline() reloads the page when previous state was allow (P-02 — terminates live Replay)', () => {
      window.localStorage.setItem('wtcs_consent', 'allow')
      const reloadSpy = vi.fn()
      const originalLocation = window.location
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...originalLocation, reload: reloadSpy },
      })

      function Consumer() {
        const { decline } = useConsent()
        return <button onClick={decline}>decline</button>
      }
      render(
        <ConsentProvider>
          <Consumer />
        </ConsentProvider>,
      )
      fireEvent.click(screen.getByText('decline'))

      expect(reloadSpy).toHaveBeenCalledTimes(1)
      expect(window.localStorage.getItem('wtcs_consent')).toBe('decline')

      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      })
    })

    it('decline() does NOT reload when previous state was undecided', () => {
      const reloadSpy = vi.fn()
      const originalLocation = window.location
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...originalLocation, reload: reloadSpy },
      })

      function Consumer() {
        const { decline } = useConsent()
        return <button onClick={decline}>decline</button>
      }
      render(
        <ConsentProvider>
          <Consumer />
        </ConsentProvider>,
      )
      fireEvent.click(screen.getByText('decline'))

      expect(reloadSpy).not.toHaveBeenCalled()

      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
      })
    })
    ```

    The `useConsent` hook import path matches the existing test imports. The 06-02 test count rises from 8 to 10.

    Run `npm run lint && npm run test -- --run`.
  </action>
  <verify>
    <automated>npm run lint && npm run test -- --run && grep -c "wtcs_consent" src/lib/sentry.ts && grep -c "analytics_opted_out" src/lib/sentry.ts && grep -c "window.location.reload" src/contexts/ConsentContext.tsx && grep -c "previous === 'allow'" src/contexts/ConsentContext.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "wtcs_consent" src/lib/sentry.ts` returns ≥ 1.
    - `grep -c "analytics_opted_out" src/lib/sentry.ts` returns 0 (legacy reference removed in this file).
    - `grep -c "loadSentryReplayIfConsented" src/lib/sentry.ts` returns ≥ 1 (function still exists).
    - `grep -c "window.location.reload" src/contexts/ConsentContext.tsx` returns 1 (P-02 reload).
    - `grep -c "previous === 'allow'" src/contexts/ConsentContext.tsx` returns 1 (gate-on-prior-state guard).
    - `grep -c "P-02" src/contexts/ConsentContext.tsx` returns ≥ 1 (traceability comment to REVIEWS.md).
    - `grep -c "P-02" src/__tests__/contexts/ConsentContext.test.tsx` returns ≥ 1 (test references P-02).
    - `npm run test -- --run src/__tests__/contexts/ConsentContext.test.tsx` reports 10 passing (8 original + 2 P-02).
    - `npm run lint` exits 0.
    - `npm run test -- --run` exits 0.
  </acceptance_criteria>
  <done>Sentry Replay loader flipped to opt-IN; error capture untouched; ConsentContext.decline reloads only when previous state was 'allow' (P-02); two new tests pass; full suite green.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: main.tsx — mount ConsentProvider between PostHogProvider and RouterProvider</name>
  <files>src/main.tsx</files>
  <read_first>
    - src/main.tsx (target file — full read)
    - src/contexts/ConsentContext.tsx (built in 06-02 — confirms exported provider name)
  </read_first>
  <action>
    Add at top of imports:
    ```typescript
    import { ConsentProvider } from '@/contexts/ConsentContext'
    ```

    Update the render tree so `ConsentProvider` sits between `PostHogProvider` (outer) and `RouterProvider` (inner). The render block becomes:

    ```typescript
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <Sentry.ErrorBoundary fallback={<AppErrorFallback />} showDialog={false}>
          <PostHogProvider client={posthog}>
            <ConsentProvider>
              <RouterProvider router={router} />
            </ConsentProvider>
          </PostHogProvider>
        </Sentry.ErrorBoundary>
      </StrictMode>,
    )
    ```

    DO NOT gate `Sentry.init` — error capture is unconditional per D-05.
    DO NOT change order of `initPostHog()` invocation — must run before `<PostHogProvider client={posthog}>`; with `opt_out_capturing_by_default: true` it captures nothing until consent flips.

    Run `npm run lint && npm run build` — build must succeed because main.tsx is the entrypoint.
  </action>
  <verify>
    <automated>npm run lint && npm run build && grep -c "<ConsentProvider>" src/main.tsx && grep -c "</ConsentProvider>" src/main.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "<ConsentProvider>" src/main.tsx` returns 1.
    - `grep -c "</ConsentProvider>" src/main.tsx` returns 1.
    - In `grep -n` output, the line containing `<ConsentProvider>` is AFTER the line containing `<PostHogProvider` and BEFORE the line containing `<RouterProvider`.
    - `grep -E "Sentry\.init\(" src/main.tsx | grep -c "consent"` returns 0 (Sentry.init NOT gated).
    - `npm run lint` exits 0.
    - `npm run build` exits 0.
  </acceptance_criteria>
  <done>ConsentProvider mounted in correct provider-tree position; Sentry.init untouched; build green.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: AuthContext.tsx — R-03 two-effect split (consent gate in OWN effect) + regression test (R-03 / P-06)</name>
  <files>src/contexts/AuthContext.tsx, src/__tests__/contexts/AuthContext.test.tsx</files>
  <read_first>
    - src/contexts/AuthContext.tsx (target file — full read; the identify call site lives inside the auth-state effect — find via grep for `posthog.identify(providerId)`)
    - src/hooks/useConsent.ts (built in 06-02)
    - .planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-RESEARCH.md (Pitfall 1: init race)
    - .planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-REVIEWS.md (R-03 split mandate; P-06 regression test mandate)
  </read_first>
  <action>
    PART A — Two-effect AuthContext split (R-03):

    Add at top of imports in `src/contexts/AuthContext.tsx`:
    ```typescript
    import { useConsent } from '@/hooks/useConsent'
    ```

    Inside `AuthProvider`, BEFORE the existing `useEffect` (find via grep — do not rely on literal line numbers), add:
    ```typescript
    const { state: consentState } = useConsent()
    ```

    R-03 critical structural change: the existing `useEffect` (the one that calls `supabase.auth.getSession()` and subscribes to `supabase.auth.onAuthStateChange`) currently contains the `if (providerId) { posthog.identify(providerId) }` block. The wrong fix is to add `consentState` to its dependency array — that re-runs `getSession()` and re-subscribes `onAuthStateChange` on every consent flip. The right fix is to MOVE the identify call into a SECOND, dedicated effect.

    Locate the existing `if (providerId) { posthog.identify(providerId) }` block in the auth-subscription effect and DELETE it (the identify call moves to its own effect; the auth-subscription effect retains only `setUser`/`setLoading` and `subscription.unsubscribe`).

    Then add IMMEDIATELY AFTER the existing auth-subscription `useEffect` block, paste verbatim:

    ```typescript
    // Phase 6 R-03 (REVIEWS.md): analytics-identify lives in its OWN effect,
    // deps [consentState, user]. The auth-subscription effect above intentionally
    // does NOT depend on consentState — flipping consent must not re-run
    // supabase.auth.getSession() or re-subscribe onAuthStateChange.
    // Covers the case "user already signed in, then consent flips to allow":
    // when consentState becomes 'allow' and user is non-null, identify fires once.
    useEffect(() => {
      if (consentState !== 'allow') return
      const providerId = user?.user_metadata?.provider_id as string | undefined
      if (providerId) {
        posthog.identify(providerId)
      }
    }, [consentState, user])
    ```

    The exact `provider_id` extraction path MUST match the existing code's path (the original `if (providerId) { posthog.identify(providerId) }` block already shows the correct path — copy it). If the existing code currently extracts `provider_id` from `session.user.user_metadata.provider_id` inside the `onAuthStateChange` callback into a local `providerId` const, the new effect must use `user?.user_metadata?.provider_id` because the new effect reads the React `user` state (set by the auth-subscription effect via `setUser`), not the raw session.

    NOTE on test wrapper: existing AuthContext-using tests render `<AuthProvider>` directly. After this change, `<AuthProvider>` calls `useConsent()` and will throw 'useConsent must be used within a ConsentProvider'. Wrap those tests:

    ```bash
    grep -rln "<AuthProvider" src/__tests__/
    ```

    For each match, wrap so `<AuthProvider>` is a child of `<ConsentProvider>`. If the count is ≥ 5 files, ship a tiny render utility at `src/__tests__/utils/render-with-providers.tsx`:

    ```typescript
    import { render, type RenderOptions } from '@testing-library/react'
    import type { ReactElement, ReactNode } from 'react'
    import { ConsentProvider } from '@/contexts/ConsentContext'

    export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
      const Wrapper = ({ children }: { children: ReactNode }) => (
        <ConsentProvider>{children}</ConsentProvider>
      )
      return render(ui, { wrapper: Wrapper, ...options })
    }
    ```

    Update affected tests to use `renderWithProviders` where they currently use `render`.

    PART B — R-03 / P-06 regression test:

    Create `src/__tests__/contexts/AuthContext.test.tsx`. The test asserts: a user already signed in (mocked supabase session present) + consent state flips from undecided → allow → identify fires exactly once with the correct providerId. Skeleton (the executor adapts the supabase mock pattern to match what the existing auth tests use; this skeleton reflects the contract):

    ```typescript
    import { describe, it, expect, vi, beforeEach } from 'vitest'
    import { render, screen, fireEvent, act } from '@testing-library/react'
    import type { ReactNode } from 'react'

    const mockIdentify = vi.fn()
    vi.mock('@/lib/posthog', () => ({
      posthog: {
        opt_in_capturing: vi.fn(),
        opt_out_capturing: vi.fn(),
        identify: mockIdentify,
        reset: vi.fn(),
      },
      initPostHog: vi.fn(),
    }))
    vi.mock('@/lib/sentry', () => ({
      loadSentryReplayIfConsented: vi.fn(),
    }))

    // Mock supabase to return a signed-in session with provider_id, before the
    // first consent flip. Mirror the mock shape used by the existing auth tests.
    const mockOnAuthStateChange = vi.fn()
    let authChangeCallback: ((event: string, session: unknown) => void) | null = null
    vi.mock('@/lib/supabase', () => ({
      supabase: {
        auth: {
          getSession: vi.fn().mockResolvedValue({
            data: {
              session: {
                user: {
                  id: 'u-1',
                  user_metadata: { provider_id: 'discord-12345' },
                  app_metadata: { provider: 'discord' },
                },
                provider_token: 'fake',
                access_token: 'fake',
                refresh_token: 'fake',
                expires_at: 9999999999,
              },
            },
          }),
          onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
            authChangeCallback = cb
            mockOnAuthStateChange(cb)
            return { data: { subscription: { unsubscribe: vi.fn() } } }
          },
        },
      },
    }))

    import { AuthProvider } from '@/contexts/AuthContext'
    import { ConsentProvider } from '@/contexts/ConsentContext'
    import { useConsent } from '@/hooks/useConsent'

    function ConsentTrigger() {
      const { allow } = useConsent()
      return <button onClick={allow}>flip-allow</button>
    }

    function harness({ children }: { children: ReactNode }) {
      return (
        <ConsentProvider>
          <AuthProvider>{children}</AuthProvider>
        </ConsentProvider>
      )
    }

    describe('AuthContext — R-03 retroactive identify on consent flip', () => {
      beforeEach(() => {
        vi.clearAllMocks()
        window.localStorage.clear()
        authChangeCallback = null
      })

      it('user already signed in, consent flips undecided → allow, identify fires exactly once with the correct providerId (R-03 / P-06)', async () => {
        render(harness({ children: <ConsentTrigger /> }))

        // Allow getSession() promise + auth-subscription effect to settle so the
        // user state is populated before consent flips. Equivalent to flushing
        // the microtask queue.
        await act(async () => { await Promise.resolve() })

        expect(mockIdentify).not.toHaveBeenCalled()

        // Flip consent undecided → allow.
        fireEvent.click(screen.getByText('flip-allow'))

        await act(async () => { await Promise.resolve() })

        expect(mockIdentify).toHaveBeenCalledTimes(1)
        expect(mockIdentify).toHaveBeenCalledWith('discord-12345')
      })

      it('does NOT identify when consent stays undecided', async () => {
        render(harness({ children: <span>noop</span> }))
        await act(async () => { await Promise.resolve() })
        expect(mockIdentify).not.toHaveBeenCalled()
      })
    })
    ```

    Run `npm run lint && npm run test -- --run`. Full suite must be green.
  </action>
  <verify>
    <automated>npm run lint && npm run test -- --run && grep -c "useConsent" src/contexts/AuthContext.tsx && grep -E "consentState\s*===\s*'allow'|consentState\s*!==\s*'allow'" src/contexts/AuthContext.tsx && bash -c 'count=$(grep -c "useEffect" src/contexts/AuthContext.tsx); echo "useEffect count in AuthContext: $count"; test "$count" -ge 2'</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "useConsent" src/contexts/AuthContext.tsx` returns ≥ 2 (import + call).
    - `grep -E "consentState\s*===\s*'allow'|consentState\s*!==\s*'allow'" src/contexts/AuthContext.tsx` returns ≥ 1.
    - `grep -c "useEffect" src/contexts/AuthContext.tsx` returns ≥ 2 (TWO useEffects: the original auth-subscription one PLUS the new analytics-identify one).
    - `grep -E "\\[consentState,\\s*user\\]|\\[user,\\s*consentState\\]" src/contexts/AuthContext.tsx` returns ≥ 1 (the new effect's dependency array MUST include both consentState and user; both orderings accepted).
    - `grep -E "posthog\\.identify" src/contexts/AuthContext.tsx | wc -l` returns 1 (only ONE identify call site — the new dedicated effect; the original site inside the auth-subscription effect is removed).
    - The auth-subscription effect's dependency array does NOT include `consentState`. Verify by extracting the auth-subscription effect's deps array (the one containing `onAuthStateChange`) and confirming consentState is absent. Spot-check via:
      ```
      awk '/onAuthStateChange/,/\\}, \\[/' src/contexts/AuthContext.tsx | grep -c "consentState"
      ```
      Returns 0 (consentState does NOT appear inside the auth-subscription effect block).
    - File `src/__tests__/contexts/AuthContext.test.tsx` exists.
    - `grep -c "R-03" src/__tests__/contexts/AuthContext.test.tsx` returns ≥ 1.
    - `grep -c "discord-12345" src/__tests__/contexts/AuthContext.test.tsx` returns ≥ 1 (the regression test asserts the exact providerId).
    - `npm run test -- --run src/__tests__/contexts/AuthContext.test.tsx` reports ≥ 2 passing.
    - `npm run lint` exits 0.
    - `npm run test -- --run` exits 0 (no regressions; existing tests wrapped with ConsentProvider where they render AuthProvider).
  </acceptance_criteria>
  <done>AuthContext split into two effects per R-03; consent flip never re-runs auth subscription; regression test for retroactive identify passes; full suite green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → PostHog SaaS | Event capture; gated by consent (D-04) |
| Browser → Sentry SaaS (Replay) | Session recording; gated by consent (D-04); allow → decline transition forces reload to terminate live session (P-02) |
| Browser → Sentry SaaS (errors) | Error capture; UNGATED per D-05 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-06-06 | Information Disclosure | PostHog capture before consent | mitigate | `opt_out_capturing_by_default: true` config (RESEARCH.md Pattern 2); test asserts zero events pre-Allow (06-02d smoke) |
| T-06-07 | Information Disclosure | Sentry Replay before consent | mitigate | `loadSentryReplayIfConsented` gate flipped to `wtcs_consent === 'allow'` (Task 2); pre-existing M3 code-split keeps Replay bundle off the wire for opt-out users |
| T-06-10 | Repudiation | User claims they never consented but events are flowing | mitigate | 06-02d smoke proves zero events before Allow; `respect_dnt: true` honors browser DNT signal as a secondary gate; consent state is browser-local + auditable via DevTools |
| T-06-20 | Information Disclosure | Sentry Replay continues recording after user revokes consent mid-session (RESEARCH.md Pitfall 7) | mitigate | P-02: ConsentContext.decline forces window.location.reload when previous state was 'allow', terminating the active Replay session immediately. Tested via two new ConsentContext tests in Task 2. |
| T-06-21 | Tampering | Coupling consentState into the auth-subscription effect dependency array re-runs getSession() / re-subscribes onAuthStateChange on every consent flip, risking duplicate events or session-resolution races | mitigate | R-03: identify call moves to its OWN useEffect with deps [consentState, user]; auth-subscription effect's deps remain unchanged. Acceptance criteria asserts useEffect count ≥ 2 AND consentState does not appear inside the auth-subscription block. |
</threat_model>

<verification>
- PostHog config has all three keys: opt_out_capturing_by_default, opt_out_persistence_by_default, respect_dnt
- Sentry Replay loader gates on `wtcs_consent === 'allow'`
- Sentry.init in main.tsx is NOT consent-gated (errors stay unconditional)
- ConsentContext.decline reloads only when previous state was 'allow' (P-02)
- Two new ConsentContext tests cover P-02 (10 total in 06-02 test file)
- ConsentProvider mounted between PostHogProvider (outer) and RouterProvider (inner)
- AuthContext is split into TWO useEffects: auth subscription (no consentState dep) + analytics identify (deps [consentState, user]) — R-03
- Regression test for retroactive identify passes (R-03 / P-06)
- All existing AuthProvider-using tests wrapped with ConsentProvider; zero regressions
</verification>

<success_criteria>
- D-04 default-OFF for PostHog and Sentry Replay; gated single source of truth
- D-05 bundled consent (one decision covers both); Sentry error capture stays unconditional
- R-03 effect split landed; auth subscription is no longer churned by consent flips
- P-02 reload on allow → decline terminates live Replay sessions
- P-06 regression test pinned in src/__tests__/contexts/AuthContext.test.tsx
- Husky pre-commit + lint-staged green; no new lint warnings
- Full test suite green
</success_criteria>

<output>
After completion, create `.planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-02b-SUMMARY.md`.
</output>
