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
autonomous: true
requirements: []
tags: [D-04, D-05]

must_haves:
  truths:
    - "PostHog init has opt_out_capturing_by_default: true, opt_out_persistence_by_default: true, respect_dnt: true (D-04)"
    - "Sentry Replay attach is gated on wtcs_consent === 'allow' (D-04); legacy analytics_opted_out check fully removed from sentry.ts"
    - "Sentry error capture remains unconditional — Sentry.init in main.tsx is NOT gated; only Replay attach is gated (D-05)"
    - "ConsentProvider is mounted between PostHogProvider (outer) and RouterProvider (inner) in main.tsx"
    - "AuthContext.posthog.identify() is gated on consent === 'allow' (D-04)"
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
      provides: "posthog.identify() gated on consent === 'allow' (D-04)"
      contains: "useConsent"
  key_links:
    - from: "src/contexts/AuthContext.tsx"
      to: "src/hooks/useConsent.ts"
      via: "consent gate on identify"
      pattern: "useConsent"
    - from: "src/main.tsx"
      to: "src/contexts/ConsentContext.tsx"
      via: "ConsentProvider mount inside PostHogProvider, outside RouterProvider"
      pattern: "<ConsentProvider"
---

<objective>
Phase 2 of the GDPR opt-IN rewire (split per Phase 6 revision). Wire the ConsentContext built in 06-02 into the four library/runtime touchpoints: PostHog config (default-OFF native flags), Sentry Replay loader (consent gate), main.tsx provider tree (ConsentProvider mount), and AuthContext (identify gate).

Purpose: 06-02 ships the context but does not connect it to the libraries. This plan completes the wiring so the default-OFF semantics are observable end-to-end. UI surfaces (banner + chip refactor) come in 06-02c.

Output: posthog.ts, sentry.ts, main.tsx, AuthContext.tsx all consume the consent state; full test suite stays green (with consent-provider wrappers added to AuthProvider-using tests where needed).
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
  <name>Task 2: sentry.ts — flip Replay consent gate to wtcs_consent === 'allow'</name>
  <files>src/lib/sentry.ts</files>
  <read_first>
    - src/lib/sentry.ts (target file — full read; the existing consent check in loadSentryReplayIfConsented is the flip target — find the block via grep, do not rely on literal line numbers)
    - .planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-RESEARCH.md (Pattern 3 Sentry; Pitfall 7 Replay leak)
  </read_first>
  <action>
    In `loadSentryReplayIfConsented`, locate the existing consent check by grepping for `analytics_opted_out` in `src/lib/sentry.ts`. The current block reads (find via grep, not line numbers):

    ```typescript
    //  - `posthog_consent_chip_dismissed` = chip is hidden (user has seen it)
    //  - `analytics_opted_out` = user explicitly chose "Opt out"
    // Only the explicit opt-out blocks Replay. Plain dismissal via X is accepted.
    const optedOut = window.localStorage.getItem('analytics_opted_out') === 'true'
    if (optedOut) return
    ```

    REPLACE that exact block with:

    ```typescript
    // Phase 6 D-04: GDPR opt-IN. Replay is NEVER attached unless the user has
    // explicitly clicked Allow. Single source of truth = localStorage['wtcs_consent'].
    // Sentry ERROR capture remains unconditional (Sentry.init in main.tsx is NOT gated).
    const consent = window.localStorage.getItem('wtcs_consent')
    if (consent !== 'allow') return
    ```

    KEEP everything else: `replayLoaded` guard, `Sentry.getClient()` null-check, dynamic-import-via-`./sentry-replay`, `addIntegration` call. RESEARCH.md Pattern 3 says preserve the code-split shape verbatim.

    Run `npm run lint && npm run test -- --run`.
  </action>
  <verify>
    <automated>npm run lint && grep -c "wtcs_consent" src/lib/sentry.ts && grep -c "analytics_opted_out" src/lib/sentry.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "wtcs_consent" src/lib/sentry.ts` returns ≥ 1.
    - `grep -c "analytics_opted_out" src/lib/sentry.ts` returns 0 (legacy reference removed in this file).
    - `grep -c "loadSentryReplayIfConsented" src/lib/sentry.ts` returns ≥ 1 (function still exists).
    - `npm run lint` exits 0.
    - `npm run test -- --run` exits 0.
  </acceptance_criteria>
  <done>Sentry Replay loader flipped to opt-IN; error capture untouched; tests green.</done>
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
  <name>Task 4: AuthContext.tsx — gate posthog.identify on consent and wrap dependent tests with ConsentProvider</name>
  <files>src/contexts/AuthContext.tsx</files>
  <read_first>
    - src/contexts/AuthContext.tsx (target file — full read; the identify call site lives inside the auth-state effect — find via grep for `posthog.identify(providerId)`)
    - src/hooks/useConsent.ts (built in 06-02)
    - .planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-RESEARCH.md (Pitfall 1: init race; effect re-run is idempotent because of subscription.unsubscribe cleanup)
  </read_first>
  <action>
    Add at top of imports in `src/contexts/AuthContext.tsx`:
    ```typescript
    import { useConsent } from '@/hooks/useConsent'
    ```

    Inside `AuthProvider`, BEFORE the existing `useEffect`, read consent (find the existing useEffect via grep — do not rely on literal line numbers):
    ```typescript
    const { state: consentState } = useConsent()
    ```

    Locate the existing `if (providerId) { posthog.identify(providerId) }` block via:
    ```bash
    grep -n "posthog.identify(providerId)" src/contexts/AuthContext.tsx
    ```

    REPLACE that block with:
    ```typescript
    if (providerId && consentState === 'allow') {
      posthog.identify(providerId)
    }
    ```

    Update the surrounding `useEffect` dependency array — append `consentState` to whatever the current array is. RESEARCH.md Pitfall 1 documents that re-running on consent flip is acceptable because the effect's body checks `verifyingRef.current` and uses `subscription.unsubscribe()` cleanup, so a second run is idempotent.

    NOTE on test wrapper: existing AuthContext-using tests render `<AuthProvider>` directly. After this change, `<AuthProvider>` calls `useConsent()` and will throw 'useConsent must be used within a ConsentProvider'. Wrap those tests:

    ```bash
    grep -rln "<AuthProvider" src/__tests__/
    ```

    PREFERRED approach (structural truth):

    For each match, wrap the existing render so `<AuthProvider>` becomes the child of `<ConsentProvider>`. If the count is ≥ 5 files, ship a tiny render utility instead at `src/__tests__/utils/render-with-providers.tsx`:

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

    Update affected tests to use `renderWithProviders` where they currently use `render`. Verify zero new test failures.

    Run `npm run lint && npm run test -- --run`. Full suite must be green.
  </action>
  <verify>
    <automated>npm run lint && npm run test -- --run && grep -c "useConsent" src/contexts/AuthContext.tsx && grep -E "consentState\s*===\s*'allow'" src/contexts/AuthContext.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "useConsent" src/contexts/AuthContext.tsx` returns ≥ 2 (import + call).
    - `grep -E "consentState\s*===\s*'allow'" src/contexts/AuthContext.tsx` returns ≥ 1.
    - `npm run lint` exits 0.
    - `npm run test -- --run` exits 0 (no regressions; existing tests wrapped with ConsentProvider where they render AuthProvider).
  </acceptance_criteria>
  <done>AuthContext.identify gated on consent; AuthProvider-using tests wrapped with ConsentProvider; full suite green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → PostHog SaaS | Event capture; gated by consent (D-04) |
| Browser → Sentry SaaS (Replay) | Session recording; gated by consent (D-04) |
| Browser → Sentry SaaS (errors) | Error capture; UNGATED per D-05 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-06-06 | Information Disclosure | PostHog capture before consent | mitigate | `opt_out_capturing_by_default: true` config (RESEARCH.md Pattern 2); test asserts zero events pre-Allow (06-02d smoke) |
| T-06-07 | Information Disclosure | Sentry Replay before consent | mitigate | `loadSentryReplayIfConsented` gate flipped to `wtcs_consent === 'allow'` (Task 2); pre-existing M3 code-split keeps Replay bundle off the wire for opt-out users |
| T-06-10 | Repudiation | User claims they never consented but events are flowing | mitigate | 06-02d smoke proves zero events before Allow; `respect_dnt: true` honors browser DNT signal as a secondary gate; consent state is browser-local + auditable via DevTools |
</threat_model>

<verification>
- PostHog config has all three keys: opt_out_capturing_by_default, opt_out_persistence_by_default, respect_dnt
- Sentry Replay loader gates on `wtcs_consent === 'allow'`
- Sentry.init in main.tsx is NOT consent-gated (errors stay unconditional)
- ConsentProvider mounted between PostHogProvider (outer) and RouterProvider (inner)
- AuthContext.identify() gated on consent === 'allow'
- All existing AuthProvider-using tests wrapped with ConsentProvider; zero regressions
</verification>

<success_criteria>
- D-04 default-OFF for PostHog and Sentry Replay; gated single source of truth
- D-05 bundled consent (one decision covers both); Sentry error capture stays unconditional
- Husky pre-commit + lint-staged green; no new lint warnings
- Full test suite green
</success_criteria>

<output>
After completion, create `.planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-02b-SUMMARY.md`.
</output>
