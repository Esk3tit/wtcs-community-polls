---
phase: 06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden
plan: 02c
type: execute
wave: 2
depends_on: [06-02b]
files_modified:
  - src/components/ConsentBanner.tsx
  - src/components/ConsentChip.tsx
  - src/routes/__root.tsx
  - src/__tests__/components/ConsentChip.test.tsx
  - src/__tests__/components/ConsentBanner.test.tsx
autonomous: true
requirements: []
tags: [D-03, D-06]

must_haves:
  truths:
    - "On first visit (no wtcs_consent localStorage key), a non-blocking banner renders at bottom-4 right-4 with body 'We can record anonymous usage to help us improve this site.' and 'Allow' / 'Decline' buttons (D-03)"
    - "After a decision is recorded, the ConsentChip in the footer flips to a state-aware label: 'Anonymous usage analytics are on. Turn off' or 'Anonymous usage analytics are off. Turn on' (D-03)"
    - "Same UX for every visitor — no geo-detection, no country-header branching, no locale-conditional copy (D-06)"
    - "ConsentChip and ConsentBanner are mutually exclusive by render guard: undecided → banner only; allow/decline → chip only"
    - "ConsentChip tests inverted to opt-IN state machine; ConsentBanner test suite added (15 tests total across the two files)"
    - "ConsentBanner Allow and Decline buttons carry className=\"min-h-11\" to meet the 44px mobile touch-target minimum (P-05 — REVIEWS.md)"
  artifacts:
    - path: "src/components/ConsentBanner.tsx"
      provides: "First-visit non-blocking banner (D-03)"
      exports: ["ConsentBanner"]
    - path: "src/components/ConsentChip.tsx"
      provides: "Persistent footer chip with flipped state machine (D-03)"
      contains: "useConsent"
    - path: "src/routes/__root.tsx"
      provides: "Mounts <ConsentBanner /> and <ConsentChip /> as siblings"
      contains: "<ConsentBanner"
    - path: "src/__tests__/components/ConsentBanner.test.tsx"
      provides: "Tests for first-visit render, Allow/Decline writes, /admin hide, dismiss-X, migration"
    - path: "src/__tests__/components/ConsentChip.test.tsx"
      provides: "Tests for inverted state machine"
  key_links:
    - from: "src/components/ConsentBanner.tsx"
      to: "src/hooks/useConsent.ts"
      via: "useConsent reads state and calls allow/decline"
      pattern: "useConsent"
    - from: "src/components/ConsentChip.tsx"
      to: "src/hooks/useConsent.ts"
      via: "useConsent reads state and calls allow/decline"
      pattern: "useConsent"
---

<objective>
Phase 3 of the GDPR opt-IN rewire (split per Phase 6 revision). Build the user-facing surfaces: ConsentBanner (first-visit) and a fully refactored ConsentChip (state-aware footer chip). Mount both in __root.tsx. Update existing ConsentChip tests for the inverted state machine and add a ConsentBanner test suite.

Purpose: 06-02 + 06-02b deliver the consent state and library wiring; this plan delivers the only UI surfaces the user sees. Without this plan there is no visible way to opt in or change a decision.

Output: Two components, one route mount, two test files (15 tests total — 7 ConsentChip + 8 ConsentBanner). Full test count across the consent system is 8 (06-02) + 15 (this plan) = 23 new/updated tests.
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
@.planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-UI-SPEC.md
@.planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-VALIDATION.md
@.planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-REVIEWS.md
@.planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-02-SUMMARY.md
@.planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-02b-SUMMARY.md
@src/components/ConsentChip.tsx
@src/contexts/ConsentContext.tsx
@src/hooks/useConsent.ts
@src/routes/__root.tsx
@src/__tests__/components/ConsentChip.test.tsx

<interfaces>
<!-- Existing types and exports executors will use; no codebase exploration needed. -->

From src/hooks/useConsent.ts (built in 06-02):
```typescript
export function useConsent(): {
  state: 'undecided' | 'allow' | 'decline'
  allow: () => void
  decline: () => void
}
```

From @tanstack/react-router (already used in current ConsentChip):
```typescript
useRouterState({ select: (s) => s.location.pathname })
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create ConsentBanner; refactor ConsentChip; mount both in __root.tsx</name>
  <files>src/components/ConsentBanner.tsx, src/components/ConsentChip.tsx, src/routes/__root.tsx</files>
  <read_first>
    - src/components/ConsentChip.tsx (target file — full read; both NEW analog AND target of refactor)
    - src/routes/__root.tsx (target file — full read; will mount ConsentBanner adjacent to ConsentChip)
    - .planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-UI-SPEC.md (Surface 1 banner + Surface 2 chip state machine)
    - .planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-PATTERNS.md (Bucket B: ConsentBanner + ConsentChip pattern assignments)
  </read_first>
  <action>
    A) Create `src/components/ConsentBanner.tsx`. Paste verbatim:

    ```typescript
    import { useState } from 'react'
    import { X } from 'lucide-react'
    import { useRouterState } from '@tanstack/react-router'
    import { Button } from '@/components/ui/button'
    import { useConsent } from '@/hooks/useConsent'

    // Phase 6 D-03: First-visit non-blocking GDPR opt-IN banner.
    // Renders ONLY when consent state is 'undecided' AND not on /admin/*.
    // Dismiss X = session-only hide; banner re-shows on next page load.

    const SESSION_DISMISS_KEY = 'wtcs_consent_banner_dismissed_session'

    export function ConsentBanner() {
      const { state, allow, decline } = useConsent()
      const pathname = useRouterState({ select: (s) => s.location.pathname })
      const [sessionDismissed, setSessionDismissed] = useState<boolean>(() => {
        if (typeof window === 'undefined') return true
        return window.sessionStorage.getItem(SESSION_DISMISS_KEY) === 'true'
      })

      if (state !== 'undecided') return null
      if (pathname.startsWith('/admin')) return null
      if (sessionDismissed) return null

      const handleDismiss = () => {
        window.sessionStorage.setItem(SESSION_DISMISS_KEY, 'true')
        setSessionDismissed(true)
      }

      return (
        <div className="fixed bottom-4 right-4 z-40 rounded-lg border bg-card shadow-md p-4 max-w-[min(20rem,calc(100vw-2rem))] transition-opacity">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground leading-relaxed">
                We can record anonymous usage to help us improve this site.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                No tracking starts until you choose.
              </p>
              <div className="flex gap-2 mt-3">
                {/* P-05 (REVIEWS.md): explicit min-h-11 (44px) to meet WCAG 2.5.5 / Apple HIG mobile touch-target minimum on iOS Safari, where shadcn default Button height (~36px) misses the recommended threshold. */}
                <Button className="min-h-11" onClick={allow}>Allow</Button>
                <Button variant="outline" className="min-h-11" onClick={decline}>Decline</Button>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0"
              onClick={handleDismiss}
              aria-label="Dismiss"
            >
              <X className="size-3" />
            </Button>
          </div>
        </div>
      )
    }
    ```

    Body lines copied verbatim from UI-SPEC Surface 1. NO exclamation marks. NO emojis. `Allow` is default-variant Button (primary); `Decline` is `variant="outline"` (NOT `variant="destructive"` per UI-SPEC color table). P-05 (REVIEWS.md): both buttons MUST carry `className="min-h-11"` so they meet the 44px mobile touch-target minimum — shadcn default button height is ~36px and falls below the WCAG / Apple HIG threshold on iOS Safari.

    B) REFACTOR `src/components/ConsentChip.tsx` to the new state-aware shape (UI-SPEC Surface 2). REPLACE the file's entire body with:

    ```typescript
    import { useState } from 'react'
    import { X } from 'lucide-react'
    import { useRouterState } from '@tanstack/react-router'
    import { Button } from '@/components/ui/button'
    import { useConsent } from '@/hooks/useConsent'

    // Phase 6 D-04: persistent footer chip with state-aware copy.
    // - 'allow'    → "Anonymous usage analytics are on. Turn off"
    // - 'decline'  → "Anonymous usage analytics are off. Turn on"
    // - 'undecided'→ null (banner is in charge)
    //
    // Dismiss X is session-scope (existing posthog_consent_chip_dismissed key
    // carries forward) — does NOT change the consent decision.

    const DISMISS_KEY = 'posthog_consent_chip_dismissed'

    export function ConsentChip() {
      const { state, allow, decline } = useConsent()
      const pathname = useRouterState({ select: (s) => s.location.pathname })
      const [dismissed, setDismissed] = useState<boolean>(() => {
        if (typeof window === 'undefined') return true
        return window.localStorage.getItem(DISMISS_KEY) === 'true'
      })

      if (state === 'undecided') return null
      if (pathname.startsWith('/admin')) return null
      if (dismissed) return null

      const handleDismiss = () => {
        window.localStorage.setItem(DISMISS_KEY, 'true')
        setDismissed(true)
      }

      const isAllow = state === 'allow'
      const body = isAllow
        ? 'Anonymous usage analytics are on.'
        : 'Anonymous usage analytics are off.'
      const actionLabel = isAllow ? 'Turn off' : 'Turn on'
      const actionTitle = isAllow
        ? 'Stop sending anonymous analytics'
        : 'Start sending anonymous analytics'
      const handleAction = isAllow ? decline : allow

      return (
        <div className="fixed bottom-4 right-4 z-40 rounded-lg border bg-card shadow-md p-3 max-w-[min(20rem,calc(100vw-2rem))] transition-opacity">
          <div className="flex items-start gap-2">
            <p className="text-xs text-muted-foreground leading-relaxed flex-1">
              {body}{' '}
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 align-baseline"
                onClick={handleAction}
                title={actionTitle}
              >
                {actionLabel}
              </Button>
            </p>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0"
              onClick={handleDismiss}
              aria-label="Dismiss"
              title="Hide this notice"
            >
              <X className="size-3" />
            </Button>
          </div>
        </div>
      )
    }
    ```

    Drop the prior direct `posthog.opt_out_capturing()` call AND the `loadSentryReplayIfConsented()` mount effect — both responsibilities moved to ConsentProvider in 06-02. Drop the `OPT_OUT_KEY` constant entirely. KEEP `DISMISS_KEY` and the `useRouterState` admin-route hide.

    C) MOUNT `<ConsentBanner />` in `src/routes/__root.tsx`. Add to imports:

    ```typescript
    import { ConsentBanner } from '@/components/ConsentBanner'
    ```

    Inside `RootLayout()` JSX, REPLACE the existing single `<ConsentChip />` line with two siblings:

    ```typescript
    <ConsentBanner />
    <ConsentChip />
    ```

    Banner and chip are mutually exclusive by render guard, so they never visually collide.

    Run `npm run lint`. ConsentChip tests will fail in this task — that's expected, Task 2 fixes them.
  </action>
  <verify>
    <automated>npm run lint && grep -c "We can record anonymous usage to help us improve this site\." src/components/ConsentBanner.tsx && grep -c "Anonymous usage analytics are on\." src/components/ConsentChip.tsx && grep -c "Anonymous usage analytics are off\." src/components/ConsentChip.tsx && grep -c "<ConsentBanner" src/routes/__root.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `src/components/ConsentBanner.tsx` exists with `export function ConsentBanner`.
    - `grep -c "We can record anonymous usage to help us improve this site\." src/components/ConsentBanner.tsx` returns 1 (verbatim UI-SPEC copy).
    - `grep -c "No tracking starts until you choose\." src/components/ConsentBanner.tsx` returns 1.
    - `grep -E ">Allow<" src/components/ConsentBanner.tsx` returns ≥ 1; `grep -E ">Decline<" src/components/ConsentBanner.tsx` returns ≥ 1.
    - `grep -c "variant=\"destructive\"" src/components/ConsentBanner.tsx` returns 0 (Decline is NOT destructive).
    - `grep -c "min-h-11" src/components/ConsentBanner.tsx` returns ≥ 2 (P-05: both Allow and Decline buttons carry the explicit 44px touch-target class).
    - `grep -c "Anonymous usage analytics are on\." src/components/ConsentChip.tsx` returns 1.
    - `grep -c "Anonymous usage analytics are off\." src/components/ConsentChip.tsx` returns 1.
    - `grep -c "Turn off\|Turn on" src/components/ConsentChip.tsx` returns ≥ 2.
    - `grep -c "opt_out_capturing\|loadSentryReplayIfConsented" src/components/ConsentChip.tsx` returns 0 (responsibilities moved to ConsentProvider).
    - `grep -c "OPT_OUT_KEY\|analytics_opted_out" src/components/ConsentChip.tsx` returns 0 (legacy fully removed).
    - `grep -c "<ConsentBanner" src/routes/__root.tsx` returns 1.
    - `grep -c "<ConsentChip" src/routes/__root.tsx` returns 1.
    - `npm run lint` exits 0.
  </acceptance_criteria>
  <done>ConsentBanner exists with verbatim UI-SPEC copy, ConsentChip refactored to state-aware shape, both mounted in __root.tsx, no exclamation marks, no destructive coloring on Decline, lint green.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Update ConsentChip tests (inverted state machine) and add ConsentBanner tests</name>
  <files>src/__tests__/components/ConsentChip.test.tsx, src/__tests__/components/ConsentBanner.test.tsx</files>
  <read_first>
    - src/__tests__/components/ConsentChip.test.tsx (target file — full read; existing assertions need inverting)
    - src/components/ConsentChip.tsx (the refactored target — built in Task 1)
    - src/components/ConsentBanner.tsx (the new component — built in Task 1)
    - src/contexts/ConsentContext.tsx (real provider used in test renders)
    - .planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-PATTERNS.md (Bucket B: test divergence specifics)
  </read_first>
  <action>
    A) REWRITE `src/__tests__/components/ConsentChip.test.tsx`. Reuse the existing mock + setup pattern (vitest, RTL, posthog mock, sentry mock, useRouterState mock), but wrap each render with the real `<ConsentProvider>`. New assertions:

    ```typescript
    import { describe, it, expect, vi, beforeEach } from 'vitest'
    import { render, screen, fireEvent } from '@testing-library/react'

    vi.mock('@/lib/posthog', () => ({
      posthog: {
        opt_in_capturing: vi.fn(),
        opt_out_capturing: vi.fn(),
        identify: vi.fn(),
        reset: vi.fn(),
      },
      initPostHog: vi.fn(),
    }))
    vi.mock('@/lib/sentry', () => ({
      loadSentryReplayIfConsented: vi.fn(),
    }))

    let currentPathname = '/'
    vi.mock('@tanstack/react-router', () => ({
      useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => unknown }) =>
        select({ location: { pathname: currentPathname } }),
    }))

    import { ConsentChip } from '@/components/ConsentChip'
    import { ConsentProvider } from '@/contexts/ConsentContext'

    function renderChip() {
      return render(
        <ConsentProvider>
          <ConsentChip />
        </ConsentProvider>,
      )
    }

    describe('ConsentChip (UI-SPEC Surface 2 — flipped opt-IN state machine)', () => {
      beforeEach(() => {
        vi.clearAllMocks()
        window.localStorage.clear()
        currentPathname = '/'
      })

      it('renders null when consent state is undecided (banner is in charge)', () => {
        const { container } = renderChip()
        expect(container).toBeEmptyDOMElement()
      })

      it('renders allow-state copy when wtcs_consent === allow', () => {
        window.localStorage.setItem('wtcs_consent', 'allow')
        renderChip()
        expect(screen.getByText('Anonymous usage analytics are on.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /turn off/i })).toBeInTheDocument()
      })

      it('renders decline-state copy when wtcs_consent === decline', () => {
        window.localStorage.setItem('wtcs_consent', 'decline')
        renderChip()
        expect(screen.getByText('Anonymous usage analytics are off.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /turn on/i })).toBeInTheDocument()
      })

      it('Turn off click in allow state writes wtcs_consent=decline', () => {
        window.localStorage.setItem('wtcs_consent', 'allow')
        renderChip()
        fireEvent.click(screen.getByRole('button', { name: /turn off/i }))
        expect(window.localStorage.getItem('wtcs_consent')).toBe('decline')
      })

      it('Turn on click in decline state writes wtcs_consent=allow', () => {
        window.localStorage.setItem('wtcs_consent', 'decline')
        renderChip()
        fireEvent.click(screen.getByRole('button', { name: /turn on/i }))
        expect(window.localStorage.getItem('wtcs_consent')).toBe('allow')
      })

      it('renders null when pathname starts with /admin', () => {
        window.localStorage.setItem('wtcs_consent', 'allow')
        currentPathname = '/admin/polls'
        const { container } = renderChip()
        expect(container).toBeEmptyDOMElement()
      })

      it('Dismiss X click sets posthog_consent_chip_dismissed only (no consent flip)', () => {
        window.localStorage.setItem('wtcs_consent', 'allow')
        renderChip()
        fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
        expect(window.localStorage.getItem('posthog_consent_chip_dismissed')).toBe('true')
        expect(window.localStorage.getItem('wtcs_consent')).toBe('allow')
      })
    })
    ```

    DROP the prior tests for: `Opt out click ... opt_out_capturing AND analytics_opted_out` (legacy opt-OUT behavior); `loadSentryReplayIfConsented on mount` (responsibility moved to ConsentProvider).

    B) CREATE `src/__tests__/components/ConsentBanner.test.tsx`:

    ```typescript
    import { describe, it, expect, vi, beforeEach } from 'vitest'
    import { render, screen, fireEvent } from '@testing-library/react'

    vi.mock('@/lib/posthog', () => ({
      posthog: {
        opt_in_capturing: vi.fn(),
        opt_out_capturing: vi.fn(),
        identify: vi.fn(),
        reset: vi.fn(),
      },
      initPostHog: vi.fn(),
    }))
    vi.mock('@/lib/sentry', () => ({
      loadSentryReplayIfConsented: vi.fn(),
    }))

    let currentPathname = '/'
    vi.mock('@tanstack/react-router', () => ({
      useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => unknown }) =>
        select({ location: { pathname: currentPathname } }),
    }))

    import { ConsentBanner } from '@/components/ConsentBanner'
    import { ConsentProvider } from '@/contexts/ConsentContext'

    function renderBanner() {
      return render(
        <ConsentProvider>
          <ConsentBanner />
        </ConsentProvider>,
      )
    }

    describe('ConsentBanner (UI-SPEC Surface 1 — first-visit GDPR opt-IN)', () => {
      beforeEach(() => {
        vi.clearAllMocks()
        window.localStorage.clear()
        window.sessionStorage.clear()
        currentPathname = '/'
      })

      it('renders verbatim copy on first visit (undecided state)', () => {
        renderBanner()
        expect(
          screen.getByText('We can record anonymous usage to help us improve this site.'),
        ).toBeInTheDocument()
        expect(screen.getByText('No tracking starts until you choose.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /^allow$/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /^decline$/i })).toBeInTheDocument()
      })

      it('does not render when wtcs_consent === allow', () => {
        window.localStorage.setItem('wtcs_consent', 'allow')
        const { container } = renderBanner()
        expect(container).toBeEmptyDOMElement()
      })

      it('does not render when wtcs_consent === decline', () => {
        window.localStorage.setItem('wtcs_consent', 'decline')
        const { container } = renderBanner()
        expect(container).toBeEmptyDOMElement()
      })

      it('does not render on /admin/* routes', () => {
        currentPathname = '/admin/categories'
        const { container } = renderBanner()
        expect(container).toBeEmptyDOMElement()
      })

      it('Allow click writes wtcs_consent=allow and removes banner from DOM', () => {
        renderBanner()
        fireEvent.click(screen.getByRole('button', { name: /^allow$/i }))
        expect(window.localStorage.getItem('wtcs_consent')).toBe('allow')
        expect(screen.queryByRole('button', { name: /^allow$/i })).not.toBeInTheDocument()
      })

      it('Decline click writes wtcs_consent=decline and removes banner from DOM', () => {
        renderBanner()
        fireEvent.click(screen.getByRole('button', { name: /^decline$/i }))
        expect(window.localStorage.getItem('wtcs_consent')).toBe('decline')
        expect(screen.queryByRole('button', { name: /^decline$/i })).not.toBeInTheDocument()
      })

      it('Dismiss X does NOT write wtcs_consent (banner re-shows on next mount)', () => {
        const { unmount } = renderBanner()
        fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
        expect(window.localStorage.getItem('wtcs_consent')).toBeNull()
        unmount()
        const { container } = renderBanner()
        expect(container).toBeEmptyDOMElement()
        window.sessionStorage.clear()
        unmount()
        renderBanner()
        expect(
          screen.getByText('We can record anonymous usage to help us improve this site.'),
        ).toBeInTheDocument()
      })

      it('Migrates legacy analytics_opted_out=true to decline (ConsentProvider one-shot)', () => {
        window.localStorage.setItem('analytics_opted_out', 'true')
        const { container } = renderBanner()
        expect(container).toBeEmptyDOMElement()
        expect(window.localStorage.getItem('wtcs_consent')).toBe('decline')
        expect(window.localStorage.getItem('analytics_opted_out')).toBeNull()
      })
    })
    ```

    Run `npm run test -- --run`. All ConsentChip tests + new ConsentBanner tests must be green.
  </action>
  <verify>
    <automated>npm run lint && npm run test -- --run src/__tests__/components/ConsentChip.test.tsx src/__tests__/components/ConsentBanner.test.tsx src/__tests__/contexts/ConsentContext.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - File `src/__tests__/components/ConsentBanner.test.tsx` exists.
    - File `src/__tests__/components/ConsentChip.test.tsx` exists with updated assertions.
    - `grep -c "Anonymous usage analytics are on\." src/__tests__/components/ConsentChip.test.tsx` returns ≥ 1.
    - `grep -c "Anonymous usage analytics are off\." src/__tests__/components/ConsentChip.test.tsx` returns ≥ 1.
    - `grep -c "We can record anonymous usage to help us improve this site\." src/__tests__/components/ConsentBanner.test.tsx` returns ≥ 1.
    - `grep -c "analytics_opted_out" src/__tests__/components/ConsentChip.test.tsx` returns 0 (legacy assertion removed).
    - `grep -c "loadSentryReplayIfConsented" src/__tests__/components/ConsentChip.test.tsx` returns 0 (legacy assertion removed; tested in ConsentContext.test.tsx instead).
    - `npm run test -- --run src/__tests__/components/ConsentBanner.test.tsx` reports 8 passing.
    - `npm run test -- --run src/__tests__/components/ConsentChip.test.tsx` reports 7 passing.
    - `npm run test -- --run` (full suite) exits 0.
  </acceptance_criteria>
  <done>ConsentChip tests inverted to opt-IN state machine; ConsentBanner test suite added with 8 cases; full test suite green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| User → Banner click | UX-only; banner fires allow/decline through the existing useConsent API |
| Browser localStorage | Banner reads wtcs_consent (existing 06-02 surface) and writes wtcs_consent_banner_dismissed_session to sessionStorage |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-06-17 | Tampering | Banner copy mutated to a non-UI-SPEC string by a future edit | mitigate | Verbatim UI-SPEC copy is grep-asserted in acceptance_criteria; any drift fails verify |
| T-06-18 | Information Disclosure | Banner appearing on /admin/* could imply analytics is enabled there pre-consent | mitigate | Render guard on `/admin` prefix; tested ('does not render on /admin/* routes') |
</threat_model>

<verification>
- ConsentBanner renders verbatim UI-SPEC copy on first visit
- ConsentChip flipped to state-aware copy (Anonymous usage analytics are on/off)
- Both mounted in __root.tsx
- 15 new/updated tests green (7 ConsentChip + 8 ConsentBanner)
- No exclamation marks or emojis in user-facing copy
</verification>

<success_criteria>
- D-03 banner ships with verbatim copy + Allow/Decline + dismiss-X
- D-06 same code path for every visitor (no geo branching)
- 15 new tests pass; full suite stays green
- Husky pre-commit + lint-staged green
</success_criteria>

<output>
After completion, create `.planning/phases/06-auth-fix-gdpr-opt-in-rewire-favicon-polish-and-launch-harden/06-02c-SUMMARY.md`.
</output>
