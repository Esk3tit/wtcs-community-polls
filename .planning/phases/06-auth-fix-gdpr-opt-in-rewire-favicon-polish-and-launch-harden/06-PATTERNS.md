# Phase 6: Auth fix, GDPR opt-IN rewire, favicon polish, and launch hardening — Pattern Map

**Mapped:** 2026-04-25
**Files analyzed:** 17 (4 NEW, 11 MODIFIED, 2 NEW non-code outputs in `public/`)
**Analogs found:** 17 / 17

---

## File Classification

Grouped by Phase 6 scope bucket. Status: NEW = created this phase; MOD = existing file edited this phase; REPLACED = binary asset overwritten.

### Bucket A — Auth Bug Fix (D-01, D-02)

| File | Status | Role | Data Flow | Closest Analog | Match |
|------|--------|------|-----------|----------------|-------|
| `src/contexts/AuthContext.tsx` | MOD | context-provider | event-driven (auth lifecycle) | self (instrumenting in place) | exact |
| `src/components/auth/AuthErrorPage.tsx` | MOD | component | request-response (render-time breadcrumb) | self (instrumenting in place; **NO DOM diff** per UI-SPEC Surface 4) | exact |
| `src/routes/auth/callback.tsx` | MOD | route-component | event-driven (OAuth promise resolution) | self (instrumenting in place) | exact |
| `src/lib/auth-helpers.ts` | MOD | utility/lib | request-response | self (instrumenting in place) | exact |
| `src/components/debug/DebugAuthOverlay.tsx` | NEW | component (DEV-only) | event-driven (subscribes to consent + storage state) | `src/components/ConsentChip.tsx` (fixed-position card overlay) | role-match |
| `src/__tests__/components/DebugAuthOverlay.test.tsx` | NEW (or skipped) | test | n/a | `src/__tests__/components/ConsentChip.test.tsx` | exact |

### Bucket B — GDPR Opt-IN Rewire (D-03, D-04, D-05, D-06)

| File | Status | Role | Data Flow | Closest Analog | Match |
|------|--------|------|-----------|----------------|-------|
| `src/contexts/ConsentContext.tsx` | NEW | context-provider | event-driven (localStorage + storage events) | `src/contexts/AuthContext.tsx` | role-match |
| `src/hooks/useConsent.ts` | NEW | hook | request-response (context read) | `src/hooks/useAuth.ts` | exact |
| `src/components/ConsentBanner.tsx` | NEW | component | event-driven (consent state + click handlers) | `src/components/ConsentChip.tsx` | exact |
| `src/components/ConsentChip.tsx` | MOD | component | event-driven (state-machine flipped) | self (rewording + state-machine inversion) | exact |
| `src/lib/posthog.ts` | MOD | lib/init | request-response (init + opt-toggle) | self (add `opt_out_capturing_by_default: true`) | exact |
| `src/lib/sentry.ts` (`loadSentryReplayIfConsented`) | MOD | lib/init | event-driven (consent gate read) | self (swap `analytics_opted_out` check for `wtcs_consent === 'allow'`) | exact |
| `src/lib/sentry-replay.ts` | UNCHANGED | lib/init | n/a | self (re-export module preserved verbatim) | exact |
| `src/main.tsx` | MOD | entry-point | bootstrap | self (mount `ConsentProvider`, do NOT gate `Sentry.init`) | exact |
| `src/routes/__root.tsx` | MOD | layout/route | composition | self (mount `<ConsentBanner />` next to `<ConsentChip />` inside router tree; lazy-mount `<DebugAuthOverlay />` under `import.meta.env.DEV`) | exact |
| `src/__tests__/components/ConsentChip.test.tsx` | MOD | test | n/a | self (invert assertions to opt-IN state machine) | exact |
| `src/__tests__/components/ConsentBanner.test.tsx` | NEW | test | n/a | `src/__tests__/components/ConsentChip.test.tsx` | exact |

### Bucket C — Favicon + Title Polish (D-07, D-10)

| File | Status | Role | Data Flow | Closest Analog | Match |
|------|--------|------|-----------|----------------|-------|
| `public/favicon.svg` | REPLACED | asset (SVG) | n/a | existing `public/favicon.svg` (Vite scaffold) | role-only |
| `public/favicon.ico` | NEW | asset (binary, multi-res) | n/a | none (legacy format; first instance) | none |
| `public/apple-touch-icon.png` | NEW | asset (PNG 180×180) | n/a | `src/assets/wtcs-logo.png` (source image) | source-asset |
| `public/favicon-dark.svg` (conditional) | NEW (optional) | asset (SVG) | n/a | new `public/favicon.svg` | exact (sibling) |
| `index.html` | MOD | entry/template | n/a | self (replace `<title>`, add `<meta name="description">`, expand `<link rel="icon">` block) | exact |

### Bucket D — Cleanup (D-08, D-09)

| File | Status | Role | Data Flow | Closest Analog | Match |
|------|--------|------|-----------|----------------|-------|
| `.planning/REQUIREMENTS.md` | MOD | doc | n/a | self (Status column flips per phase evidence) | exact |
| `.planning/phases/05-launch-hardening/05-VERIFICATION.md` | MOD | doc | n/a | self (close Sentry sourcemap human-verification item) | exact |
| (Sentry sourcemap verification trigger) | EPHEMERAL | dev-only artifact | n/a | none — see D-08 (admin-only debug throw, rolled back same commit) | none |

---

## Pattern Assignments

### Bucket A — Auth Bug Fix

#### `src/contexts/AuthContext.tsx` (MOD — add Sentry breadcrumbs)

**Analog:** self. Existing imports + structure preserved. Add `import * as Sentry from '@sentry/react'` and breadcrumb calls at four instrumented points (mount, getSession resolution, onAuthStateChange dispatch, handleAuthCallback rejection).

**Imports pattern (existing, lines 1-7) — extend with Sentry import:**
```typescript
import { createContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { handleAuthCallback } from '@/lib/auth-helpers'
import { posthog } from '@/lib/posthog'
import type { Profile } from '@/lib/types/suggestions'
// + Phase 6 D-01:
import * as Sentry from '@sentry/react'
import { useConsent } from '@/hooks/useConsent'  // for the identify() gate (D-04)
```

**Existing identify() call (lines 110-117) — gate on consent (D-04):**
```typescript
if (newSession?.user) {
  // PostHog identify — AFTER the auth gate (verification succeeded).
  // Discord snowflake (provider_id) ONLY — NEVER email/username/discriminator (T-05-05).
  // Defensive: skip if provider_id is missing (Assumption A5).
  const providerId = newSession.user.user_metadata?.provider_id
  if (providerId) {
    posthog.identify(providerId)
  }
```

**Divergence (Phase 6 must take):**
- Wrap `posthog.identify(providerId)` in `if (consentState === 'allow') { ... }` — D-04 explicit requirement.
- Add Sentry breadcrumbs per RESEARCH.md Pattern 4: single `category: 'auth'`, `level: 'info'` for normal flow, `level: 'warning'` for the rejection branch in `handleAuthCallback`. Six-key constraint applies — only `category | message | level | timestamp | data | type`.
- Do NOT change auth flow logic. Breadcrumbs are passive observers.
- Do NOT change `useEffect` dependency array shape (`[fetchProfile]`). Adding the consent context creates a new subscription path, NOT a new effect.

#### `src/components/auth/AuthErrorPage.tsx` (MOD — breadcrumb only, NO DOM diff)

**Analog:** self. UI-SPEC Surface 4 locks zero visual change.

**Existing render path (lines 45-49) — add breadcrumb in render body:**
```typescript
export function AuthErrorPage({ reason }: AuthErrorPageProps) {
  const { signInWithDiscord } = useAuth()
  const config = errorConfig[reason] || errorConfig['auth-failed']
  const Icon = config.icon
```

**Divergence:**
- Add `useEffect(() => { Sentry.addBreadcrumb({ category: 'auth', message: 'AuthErrorPage rendered', level: 'warning', data: { reason } }) }, [reason])` BEFORE the `return (` block.
- Add `import * as Sentry from '@sentry/react'` and `import { useEffect } from 'react'`.
- Zero DOM diff — UI-checker MUST compare against pre-Phase-6 snapshot for pixel-equivalence.

#### `src/routes/auth/callback.tsx` (MOD — breadcrumb on resolution)

**Analog:** self. Existing handler (lines 15-26):
```typescript
useEffect(() => {
  if (processed.current) return
  processed.current = true

  handleAuthCallback().then((result) => {
    if (result.success) {
      navigate({ to: '/' })
    } else {
      navigate({ to: '/auth/error', search: { reason: result.reason } })
    }
  })
}, [navigate])
```

**Divergence:**
- Add `Sentry.addBreadcrumb({ category: 'auth', message: 'callback route mounted' })` at the top of the `useEffect`.
- Add a second breadcrumb inside `.then((result) => { ... })` BEFORE the `navigate(...)`, with `data: { success: result.success, reason: result.reason ?? null }`.
- Do NOT mutate the navigate logic — diagnostic-only.

#### `src/lib/auth-helpers.ts` (MOD — breadcrumb on rejection branch)

**Analog:** self. Six-key constraint applies; the existing rejection-result discriminator (`{ success: false, reason: '2fa-required' | 'not-in-server' | 'session-expired' | 'auth-failed' }`) is the natural breadcrumb payload.

**Divergence:**
- At each `return { success: false, reason: '...' }` site, prepend `Sentry.addBreadcrumb({ category: 'auth', message: 'handleAuthCallback rejected', level: 'warning', data: { reason: '...' } })`.

#### `src/components/debug/DebugAuthOverlay.tsx` (NEW — DEV-only diagnostic panel)

**Analog:** `src/components/ConsentChip.tsx` (fixed-position card pattern, dismiss icon convention).

**Imports + container pattern from analog (lines 1-6, 52-53):**
```typescript
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
// ...
<div className="fixed bottom-4 right-4 z-40 rounded-lg border bg-card shadow-md p-3 max-w-[min(20rem,calc(100vw-2rem))] transition-opacity">
```

**Divergence (Phase 6 specifics from UI-SPEC Surface 3):**
- **Anchor flips to `bottom-4 left-4`** (opposite corner from ConsentChip/Banner so they never collide).
- **Width `min(28rem, calc(100vw - 2rem))`**, max-height `calc(100vh - 2rem)` with `overflow-y-auto`.
- **Container classes:** `bg-card rounded-xl border shadow-md p-4` (matches AppErrorFallback's container at `src/components/AppErrorFallback.tsx:15` — `bg-card rounded-xl border p-6`).
- Five sections (Session, Cookies, localStorage, Breadcrumbs, Console errors), each with `text-sm font-medium` heading, `font-mono text-xs` raw values, and a per-section `<Button variant="ghost" size="sm">` Copy affordance feeding the Sonner toast (`Toaster` already mounted in `__root.tsx:23`).
- Dismiss `×` aria-label `"Close debug panel"` (NOT `"Dismiss"` — that's the banner/chip).
- Truncate Supabase tokens to first 8 chars + `…`. Raw values = `font-mono text-xs`.
- Lazy-mount via `import.meta.env.DEV` + `lazy(() => import('@/components/debug/DebugAuthOverlay'))` in `__root.tsx`. Production bundle drops the entire `src/components/debug/` chunk.
- No PostHog identify, no analytics emit — diagnostic-only.

#### `src/__tests__/components/DebugAuthOverlay.test.tsx` (NEW or skipped)

**Analog:** `src/__tests__/components/ConsentChip.test.tsx` (mock conventions, RTL setup).

**Mock pattern from analog (lines 1-26):**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mockOptOut = vi.fn()
vi.mock('@/lib/posthog', () => ({
  posthog: { opt_out_capturing: (...args: unknown[]) => mockOptOut(...args), identify: vi.fn(), reset: vi.fn() },
  initPostHog: vi.fn(),
}))
// ...
beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  currentPathname = '/'
})
```

**Divergence:**
- Pure dev-tool — RESEARCH.md Pattern 5 explicitly marks the test as **optional** (skip is acceptable since the file is tree-shaken from production).
- If included: assert env-gating (mount under `import.meta.env.DEV=true`, no-render under `false`), assert sections render with current cookie/localStorage names, assert the Sonner toast fires on Copy success (mock `navigator.clipboard.writeText`).

---

### Bucket B — GDPR Opt-IN Rewire

#### `src/contexts/ConsentContext.tsx` (NEW — single source of truth for `wtcs_consent`)

**Analog:** `src/contexts/AuthContext.tsx`. Reuse the createContext + provider + named-context-export pattern, including the lint-driven hook split.

**Provider structure pattern from analog (lines 1-2, 19-25, 156-170, 172-175):**
```typescript
import { createContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
// ...
const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  // ...
  return (
    <AuthContext.Provider value={{ session, user, profile, loading, isAdmin, signOut, signInWithDiscord }}>
      {children}
    </AuthContext.Provider>
  )
}

// useAuth hook lives in src/hooks/useAuth.ts to satisfy react-refresh/only-export-components
export { AuthContext }
export type { AuthState }
```

**Divergence (Phase 6):**
- Storage-backed init via a `readConsent()` helper that handles the one-shot Phase-5 → Phase-6 migration: if `analytics_opted_out === 'true'` and `wtcs_consent` absent, write `wtcs_consent='decline'` and clear the legacy key (UI-SPEC Storage table; RESEARCH.md Pattern 1 lines 293-304).
- Add `window.addEventListener('storage', onStorage)` to sync cross-tab flips (RESEARCH.md Pitfall 7 — replay leak via stale subscription).
- `allow()` and `decline()` as `useCallback` actions, both writing to `localStorage` AND setting React state in the same call.
- Side-effect bridge to PostHog runtime toggles lives INSIDE a `useEffect` keyed on `state`: on `'allow'` → `posthog.opt_in_capturing()` + `void loadSentryReplayIfConsented()`; on `'decline'` → `posthog.opt_out_capturing()` (do NOT detach Replay; existing Phase 5 idempotent loader pattern is preserved).
- Mount in `src/main.tsx` OUTSIDE `<RouterProvider>` but INSIDE `<PostHogProvider>` so consent state is available to `__root.tsx`'s ConsentBanner/ConsentChip.

#### `src/hooks/useConsent.ts` (NEW)

**Analog:** `src/hooks/useAuth.ts` — verbatim shape (the file is 11 lines and the pattern is locked).

**Full analog (lines 1-11):**
```typescript
import { useContext } from 'react'
import { AuthContext } from '@/contexts/AuthContext'
import type { AuthState } from '@/contexts/AuthContext'

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
```

**Divergence:** swap `AuthContext` → `ConsentContext`, `AuthState` → `ConsentContextValue`, `useAuth` → `useConsent`, error message → `'useConsent must be used within a ConsentProvider'`. Otherwise identical.

#### `src/components/ConsentBanner.tsx` (NEW — first-visit banner)

**Analog:** `src/components/ConsentChip.tsx`. Inherits placement convention, dismiss-`X` pattern, admin-route hide.

**Container + dismiss pattern from analog (lines 24-79):**
```typescript
export function ConsentChip() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return window.localStorage.getItem(DISMISS_KEY) === 'true'
  })
  // ...
  if (dismissed) return null
  if (pathname.startsWith('/admin')) return null
  // ...
  return (
    <div className="fixed bottom-4 right-4 z-40 rounded-lg border bg-card shadow-md p-3 max-w-[min(20rem,calc(100vw-2rem))] transition-opacity">
      <div className="flex items-start gap-2">
        <p className="text-xs text-muted-foreground leading-relaxed flex-1">
          {/* body copy */}
        </p>
        <Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={handleDismiss} aria-label="Dismiss">
          <X className="size-3" />
        </Button>
      </div>
    </div>
  )
}
```

**Divergence (UI-SPEC Surface 1):**
- Read state via `useConsent()` instead of direct localStorage reads. Render only when `state === 'undecided'` AND `!pathname.startsWith('/admin')`.
- Body copy verbatim: `We can record anonymous usage to help us improve this site.` + `No tracking starts until you choose.` (no exclamation marks; no emoji).
- Two CTAs in a button row: `<Button onClick={allow}>Allow</Button>` and `<Button variant="outline" onClick={decline}>Decline</Button>`. **Touch targets ≥44px** — use `size="default"` per UI-SPEC accessibility constraint.
- Dismiss `×` (no decision recorded; banner re-shows next visit) sets a session-only flag — NOT the persistent `wtcs_consent` key. Reuse the existing `posthog_consent_chip_dismissed` key OR introduce `wtcs_consent_banner_dismissed_session` (executor's call; one-line difference).
- DO NOT use `bg-destructive` for Decline — UI-SPEC Color table explicitly forbids destructive coloring on Decline.

#### `src/components/ConsentChip.tsx` (MOD — flip state machine)

**Analog:** self. The component, placement, dismiss `×` behavior, and admin-route hide all stay. Only the state-machine inverts.

**Existing opt-out path (lines 40-50) — TO BE REPLACED:**
```typescript
const handleOptOut = () => {
  posthog.opt_out_capturing()
  window.localStorage.setItem(DISMISS_KEY, 'true')
  window.localStorage.setItem(OPT_OUT_KEY, 'true')
  setDismissed(true)
}
```

**Existing body copy + button (lines 55-65) — TO BE REPLACED:**
```typescript
<p className="text-xs text-muted-foreground leading-relaxed flex-1">
  Anonymous usage data helps us improve this.{' '}
  <Button variant="link" size="sm" className="h-auto p-0 align-baseline" onClick={handleOptOut}
    title="Stop sending anonymous analytics — persists across sessions">
    Opt out
  </Button>
</p>
```

**Divergence (UI-SPEC Surface 2):**
- Read state via `useConsent()`. Render `null` when `state === 'undecided'` (banner is in charge) OR when on `/admin/*` OR when session-dismissed.
- Two render branches:
  - `state === 'allow'`: body `Anonymous usage analytics are on.`, action `<Button variant="link">Turn off</Button>` → calls `decline()` from the hook.
  - `state === 'decline'`: body `Anonymous usage analytics are off.`, action `<Button variant="link">Turn on</Button>` → calls `allow()` from the hook.
- Drop the direct `posthog.opt_out_capturing()` call — that's now ConsentProvider's responsibility (single source of truth, RESEARCH.md Pattern 1).
- Drop the `loadSentryReplayIfConsented()` mount call — also ConsentProvider's responsibility on `state` flip.
- KEEP: dismiss `×` (session-scope, `posthog_consent_chip_dismissed` key); admin-route hide; `useRouterState` pathname read.
- KEEP banned phrasings out: no `Help us make this awesome!`, no `We use cookies to enhance your experience`, no exclamation marks, no emoji.

#### `src/lib/posthog.ts` (MOD — `opt_out_capturing_by_default: true`)

**Analog:** self.

**Existing `posthog.init()` call (lines 12-28):**
```typescript
export function initPostHog() {
  if (initialized || typeof window === 'undefined') return posthog
  const key = import.meta.env.VITE_POSTHOG_KEY
  if (!key) return posthog
  posthog.init(key, {
    api_host: 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: 'history_change',
    session_recording: { maskAllInputs: true },
    autocapture: false,
  })
  posthog.register({ app: 'community-polls' })
  initialized = true
  return posthog
}
```

**Divergence (RESEARCH.md Pattern 2 lines 358-368):**
- Add three keys to the `posthog.init()` config object: `opt_out_capturing_by_default: true`, `opt_out_persistence_by_default: true`, `respect_dnt: true`.
- DO NOT add a consent check around the `posthog.init()` call itself — keep init unconditional so the global SDK reference doesn't no-op silently elsewhere (Pitfall 1; PostHog issue #18898).
- Source of truth for "is capture on?" is `posthog.opt_in_capturing()` / `posthog.opt_out_capturing()` driven by `ConsentProvider`, NOT a build-time conditional.

#### `src/lib/sentry.ts::loadSentryReplayIfConsented` (MOD — flip consent check)

**Analog:** self.

**Existing consent check (lines 30-35):**
```typescript
//  - `posthog_consent_chip_dismissed` = chip is hidden (user has seen it)
//  - `analytics_opted_out` = user explicitly chose "Opt out"
// Only the explicit opt-out blocks Replay. Plain dismissal via X is accepted.
const optedOut = window.localStorage.getItem('analytics_opted_out') === 'true'
if (optedOut) return
```

**Divergence (RESEARCH.md Pattern 3 lines 396-406):**
- Replace the two lines above with:
  ```typescript
  const consent = window.localStorage.getItem('wtcs_consent')
  if (consent !== 'allow') return
  ```
- Update the surrounding comment block to describe the opt-IN semantics.
- KEEP: `replayLoaded` guard; `Sentry.getClient()` null-check; dynamic-import-via-`./sentry-replay` (M3 / ME-02 code-split — RESEARCH.md says preserve verbatim).
- DO NOT gate `Sentry.init()` itself in `main.tsx` — error capture must stay unconditional per D-05.

#### `src/lib/sentry-replay.ts` (UNCHANGED)

**Analog:** self. Re-export module is preserved verbatim per RESEARCH.md Pattern 3 ("preserved verbatim — that pattern keeps the ~40 KB Replay code out of the main bundle").

**Divergence:** none.

#### `src/main.tsx` (MOD — wire ConsentProvider)

**Analog:** self.

**Existing provider tree (lines 45-61):**
```typescript
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<AppErrorFallback />} showDialog={false}>
      <PostHogProvider client={posthog}>
        <RouterProvider router={router} />
      </PostHogProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
```

**Divergence:**
- Insert `<ConsentProvider>` BETWEEN `<PostHogProvider>` and `<RouterProvider>`. Order matters: ConsentProvider must be a descendant of PostHogProvider (so it can call `posthog.opt_in_capturing()` against an initialized client) AND an ancestor of `<RouterProvider>` (so descendants under `__root.tsx` can call `useConsent()`).
- DO NOT gate `Sentry.init()` (lines 23-33). Error capture is unconditional per D-05.
- DO NOT change `initPostHog()` invocation order — it must run before `<PostHogProvider client={posthog}>` so the client reference is valid; but with `opt_out_capturing_by_default: true` it captures nothing until consent flips.

#### `src/routes/__root.tsx` (MOD — mount banner + dev overlay)

**Analog:** self.

**Existing layout (lines 13-33):**
```typescript
function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider defaultTheme="system" storageKey="wtcs-ui-theme">
        <div className="min-h-svh bg-background">
          <Navbar />
          <main className="mx-auto max-w-2xl px-4 pt-4 md:px-6 md:pt-6"><Outlet /></main>
        </div>
        <Toaster />
        <ConsentChip />
      </ThemeProvider>
    </AuthProvider>
  )
}
```

**Divergence:**
- Add `<ConsentBanner />` adjacent to `<ConsentChip />` (banner only renders when `state === 'undecided'`; chip only renders when state is `allow`/`decline` — they are mutually exclusive by render guard).
- Add a lazy-loaded `<DebugAuthOverlay />` mount per RESEARCH.md Pattern 5 lines 478-498:
  ```typescript
  const DebugAuthOverlay = import.meta.env.DEV
    ? lazy(() => import('@/components/debug/DebugAuthOverlay'))
    : null
  // ...
  {DebugAuthOverlay && new URLSearchParams(window.location.search).get('debug') === 'auth' && (
    <Suspense fallback={null}><DebugAuthOverlay /></Suspense>
  )}
  ```
- KEEP: `AuthProvider`, `ThemeProvider`, `Navbar`, `Outlet`, `Toaster`, ConsentChip-inside-router-tree placement (HI-01 carry-forward).

#### `src/__tests__/components/ConsentChip.test.tsx` (MOD — invert assertions)

**Analog:** self.

**Existing assertions to replace (lines 37-69):**
```typescript
it('renders the default copy verbatim', () => {
  render(<ConsentChip />)
  expect(screen.getByText(/Anonymous usage data helps us improve this\./)).toBeInTheDocument()
})

it('renders null when localStorage.posthog_consent_chip_dismissed is already true', () => { ... })

it('Opt out click: calls posthog.opt_out_capturing() AND sets both localStorage flags (M1 gate for Replay)', () => {
  render(<ConsentChip />)
  fireEvent.click(screen.getByRole('button', { name: /opt out/i }))
  expect(mockOptOut).toHaveBeenCalledTimes(1)
  expect(window.localStorage.getItem('posthog_consent_chip_dismissed')).toBe('true')
  expect(window.localStorage.getItem('analytics_opted_out')).toBe('true')
})
```

**Divergence:**
- New tests must wrap `<ConsentChip />` in a real or mocked `<ConsentProvider>` (or mock `useConsent` directly with `vi.mock('@/hooks/useConsent', ...)`).
- New copy assertions: `Anonymous usage analytics are on.` (in `'allow'` state), `Anonymous usage analytics are off.` (in `'decline'` state).
- New click test: `Turn off` button calls `decline()` from hook; `Turn on` button calls `allow()`. Drop the direct `mockOptOut` assertion — that responsibility moved to `ConsentProvider`.
- New render-null test: chip is `null` when `state === 'undecided'`.
- KEEP: admin-route hide test; dismiss-`X` test (session-only flag, no consent change).
- DROP: the M1 lazy-Replay-load assertion — that moved to `ConsentProvider`'s effect, not the chip.

#### `src/__tests__/components/ConsentBanner.test.tsx` (NEW)

**Analog:** `src/__tests__/components/ConsentChip.test.tsx`. Reuse the vitest + RTL + module-mock conventions verbatim.

**Mock + setup pattern from analog (lines 1-35):**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/lib/posthog', () => ({
  posthog: { opt_out_capturing: vi.fn(), opt_in_capturing: vi.fn(), identify: vi.fn(), reset: vi.fn() },
  initPostHog: vi.fn(),
}))
vi.mock('@/lib/sentry', () => ({ loadSentryReplayIfConsented: vi.fn() }))

let currentPathname = '/'
vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => unknown }) =>
    select({ location: { pathname: currentPathname } }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  currentPathname = '/'
})
```

**Divergence:**
- Wrap render in `<ConsentProvider>` (real provider, not mocked) so the storage-keyed state machine is actually exercised end-to-end.
- Tests required (UI-SPEC Surface 1 + Storage table):
  1. Banner renders when `localStorage.wtcs_consent` is unset (undecided).
  2. Banner does NOT render when `wtcs_consent === 'allow'` or `'decline'`.
  3. Banner does NOT render on `/admin/*`.
  4. Click `Allow` writes `wtcs_consent='allow'`, calls `posthog.opt_in_capturing()` (verify mock), removes banner from DOM.
  5. Click `Decline` writes `wtcs_consent='decline'`, does NOT call `posthog.opt_in_capturing()`, removes banner from DOM.
  6. Click `×` does NOT write `wtcs_consent`; banner re-renders on remount (simulates page reload).
  7. Migration: when `analytics_opted_out='true'` and `wtcs_consent` unset on initial render, expect `wtcs_consent` set to `'decline'` and `analytics_opted_out` cleared (one-shot migration per Storage table).
- Verbatim copy assertion: `screen.getByText('We can record anonymous usage to help us improve this site.')`.

---

### Bucket C — Favicon + Title Polish

#### `public/favicon.svg` (REPLACED) + `public/favicon.ico` (NEW) + `public/apple-touch-icon.png` (NEW) + optional `public/favicon-dark.svg`

**Analog:** existing `public/favicon.svg` (Vite scaffold, currently 0 bytes per `wc -l`; binary). Source asset is `src/assets/wtcs-logo.png` (226×200 RGBA per UI-SPEC).

**Existing `<link>` line in `index.html` (line 5):**
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
```

**Divergence (UI-SPEC Surface 5 + RESEARCH.md Pattern 6):**
- Generate the multi-format set via realfavicongenerator.net using `src/assets/wtcs-logo.png` as input. Commit outputs directly to `public/`. No new npm dep; no build-step toolchain.
- Files to write (UI-SPEC table): `favicon.ico` (multi-res 16/32/48), `favicon.svg` (scalable, replaces scaffold), `apple-touch-icon.png` (180×180).
- **Visually verify the 16×16 raster.** If the 226×200 source loses recognizability at 16×16, fall back to a hand-simplified SVG variant (UI-SPEC visual constraint).
- **Dark-mode variant:** prefer the embedded-CSS approach in RESEARCH.md Pattern 6 (single SVG with internal `@media (prefers-color-scheme: dark)`). Only emit `public/favicon-dark.svg` + `<link media>` if the embedded approach can't be authored cleanly.
- Pitfall 8 (RESEARCH.md): the existing `public/favicon.svg` is 9.5 KB Vite scaffold; overwriting it is intentional. Verify the new file is committed AFTER the generator run; a stale cache-served `favicon.svg` is the most common failure mode.

#### `index.html` (MOD)

**Analog:** self.

**Existing head (lines 1-8):**
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>wtcs-community-polls</title>
  </head>
```

**Divergence (UI-SPEC Surface 5 + 6):**
- Replace `<title>wtcs-community-polls</title>` with `<title>WTCS Community Suggestions</title>` (locked, 26 chars).
- Add `<meta name="description" content="Share opinions on War Thunder Competitive Scene proposals. Verified Discord identity, one response per account, transparent results." />` (locked, 153 chars).
- Expand the `<link rel="icon">` block to the locked order (UI-SPEC Surface 5):
  ```html
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
  <link rel="icon" type="image/x-icon" href="/favicon.ico" />
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
  <!-- Dark variant ONLY if needed -->
  ```
- KEEP: `<meta charset>`, `<html lang="en">`, viewport meta, `<div id="root">`, script tag.
- OUT OF SCOPE: Open Graph / Twitter card meta tags (UI-SPEC explicit).

---

### Bucket D — Cleanup

#### `.planning/REQUIREMENTS.md` (MOD — Status column sync per D-09)

**Analog:** self. RESEARCH.md flagged a likely-candidate list (AUTH-01/02/04/05, ADMN-01, VOTE-01/02/03, RSLT-01/02/03/04/05, CATG-02/03/04, UIDN-01/02/03, INFR-03/04, TEST-01/02/03/04). The audit happens at planning time; status flips are evidence-driven, not assumption-driven.

**Divergence:**
- For each candidate row, check the relevant phase's UAT (`04-UAT.md`) or VERIFICATION (`05-VERIFICATION.md`) record. Mark `Complete` ONLY where evidence exists.
- One atomic commit per file (D-09 explicit).
- DO NOT mark `Complete` for the 9th Phase 4 UAT test (cross-account verification) — that's the explicit out-of-scope item.

#### `.planning/phases/05-launch-hardening/05-VERIFICATION.md` (MOD — close Sentry sourcemap item per D-08)

**Analog:** self.

**Divergence:**
- Trigger a real production error (admin-only debug throw, deliberate EF malformed payload, or one-time CI smoke — Claude's discretion per CONTEXT.md).
- Confirm in the Sentry UI that the resulting issue shows un-minified function names + source-map-resolved line numbers.
- Attach screenshot evidence to the verification entry; flip the human-verification frontmatter item to closed.
- **Roll back the deliberate-error path in the same commit.** No test artifacts left in `main`.

---

## Shared Patterns (cross-cutting)

### Imports
**Source:** `@/` path alias is universal (`tsconfig.app.json` + Vite config). All new files use `@/components`, `@/contexts`, `@/hooks`, `@/lib`. NO relative `../` imports across module boundaries (matches every analog read).
**Apply to:** every NEW file in this phase.

### Lint-driven hook split (`react-refresh/only-export-components`)
**Source:** `src/contexts/AuthContext.tsx:172` + `src/hooks/useAuth.ts:1-11`.
```typescript
// useAuth hook lives in src/hooks/useAuth.ts to satisfy react-refresh/only-export-components
export { AuthContext }
export type { AuthState }
```
**Apply to:** `src/contexts/ConsentContext.tsx` + `src/hooks/useConsent.ts`. Context file exports the context object + provider only. Hook file is its own module.

### Module-scope guard for one-shot init
**Source:** `src/lib/posthog.ts:5` (`let initialized = false`) + `src/lib/sentry.ts:15` (`let replayLoaded = false`).
```typescript
let initialized = false
export function initPostHog() {
  if (initialized || typeof window === 'undefined') return posthog
  // ...
  initialized = true
  return posthog
}
```
**Apply to:** any new init helper that must survive StrictMode double-invoke. ConsentProvider's PostHog opt-in/out side-effect must be idempotent (toggling `opt_in_capturing()` twice is harmless, but check for state-change first to avoid log noise).

### Fixed-position card overlay
**Source:** `src/components/ConsentChip.tsx:53` (`fixed bottom-4 right-4 z-40 rounded-lg border bg-card shadow-md p-3 max-w-[min(20rem,calc(100vw-2rem))]`) + `src/components/AppErrorFallback.tsx:15` (`bg-card rounded-xl border p-6`).
**Apply to:** `ConsentBanner` (use `right-4`), `DebugAuthOverlay` (use `left-4`), each with the same `bg-card border` surface vocabulary. Banner uses `rounded-lg` + `p-3`; debug overlay uses `rounded-xl` + `p-4` per UI-SPEC.

### Dismiss `×` icon convention
**Source:** `src/components/ConsentChip.tsx:67-76`.
```typescript
<Button variant="ghost" size="icon" className="size-6 shrink-0" onClick={handleDismiss} aria-label="Dismiss">
  <X className="size-3" />
</Button>
```
**Apply to:** `ConsentBanner` (aria-label `"Dismiss"`), `DebugAuthOverlay` (aria-label `"Close debug panel"`). Lucide `X`, `size-3` icon inside `size-6` button shell.

### Sentry breadcrumb six-key constraint
**Source:** RESEARCH.md Pattern 4 (citation: `develop.sentry.dev/sdk/data-model/event-payloads/breadcrumbs/`).
```typescript
Sentry.addBreadcrumb({
  category: 'auth',
  message: '...',
  level: 'info' | 'warning',
  data: { ... custom payload ... },
})
```
**Apply to:** every new breadcrumb call site in `AuthContext.tsx`, `routes/auth/callback.tsx`, `lib/auth-helpers.ts`, `components/auth/AuthErrorPage.tsx`. Single `category: 'auth'`. Custom info goes inside `data`. `level: 'info'` for normal flow, `level: 'warning'` for rejection branches, never `'error'` (Sentry generates an event for those automatically).

### Vitest + RTL test scaffolding
**Source:** `src/__tests__/components/ConsentChip.test.tsx:1-35`.
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/lib/posthog', () => ({ ... }))
vi.mock('@/lib/sentry', () => ({ loadSentryReplayIfConsented: vi.fn() }))
vi.mock('@tanstack/react-router', () => ({ useRouterState: ({ select }) => select({ location: { pathname: currentPathname } }) }))

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  currentPathname = '/'
})
```
**Apply to:** `ConsentBanner.test.tsx` (NEW), `ConsentChip.test.tsx` (modified), and optional `DebugAuthOverlay.test.tsx`. Reuse the mock conventions verbatim.

### Error tone (Phase 1 D-05/06/07 carry-forward)
**Source:** `src/components/auth/AuthErrorPage.tsx:14, 22, 30, 38` (no exclamation marks; direct, helpful copy).
**Apply to:** all new user-facing copy this phase — `ConsentBanner`, `ConsentChip` rewordings, `<title>`, `<meta name="description">`. Banned: `Help us make this awesome!`, `We use cookies to enhance your experience`, any `!`, any emoji.

### Storage migration (one-shot, opt-OUT → opt-IN)
**Source:** UI-SPEC Storage table; RESEARCH.md Pattern 1 lines 293-304.
**Apply to:** `ConsentContext.readConsent()`. On first read, if `analytics_opted_out === 'true'` AND `wtcs_consent` is absent, set `wtcs_consent='decline'` and clear the legacy key. Decline is the safe default under opt-IN. No rollback path needed.

---

## No Analog Found

| File | Role | Reason | Mitigation |
|------|------|--------|------------|
| `public/favicon.ico` | binary asset (multi-res ICO) | First instance in repo; no precedent for the legacy ICO format | Generate via realfavicongenerator.net (UI-SPEC Surface 5 — locked tooling decision); commit as binary blob |
| `public/apple-touch-icon.png` | binary asset (180×180 PNG) | First instance; only existing PNG asset is `src/assets/wtcs-logo.png` (226×200, source) | Same generator output; commit as binary blob |
| Sentry sourcemap-verification trigger | ephemeral dev artifact | No precedent — Phase 5 produced sourcemap *upload* infra (CI/Sentry CLI) but never the *trigger-then-roll-back* pattern | Discretion per D-08: pick admin-only debug route, deliberate EF malformed payload, OR one-shot CI smoke. Whichever choice, the trigger is rolled back in the SAME commit that closes the verification entry — no test code in `main`. |

---

## Metadata

**Analog search scope:** `src/components/`, `src/contexts/`, `src/hooks/`, `src/lib/`, `src/routes/`, `src/__tests__/components/`, `index.html`, `public/`.
**Files scanned (Read):** 11 source files, 1 HTML template, 4 Phase-6 planning docs (`06-CONTEXT.md`, `06-RESEARCH.md` Patterns 1-6 + Code Examples sections, `06-UI-SPEC.md`, `CLAUDE.md`).
**Pattern extraction date:** 2026-04-25.
**Analog ranking signal:** every new file has a same-role analog already in repo (ConsentChip → Banner/DebugOverlay; AuthContext → ConsentContext; useAuth → useConsent; ConsentChip.test.tsx → ConsentBanner.test.tsx). The only "no analog" cases are favicon binaries and a one-shot dev artifact for Sentry sourcemap verification.
