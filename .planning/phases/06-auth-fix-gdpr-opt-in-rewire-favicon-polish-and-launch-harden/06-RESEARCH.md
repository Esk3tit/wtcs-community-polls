# Phase 6: Auth fix, GDPR opt-IN rewire, favicon polish, and launch hardening - Research

**Researched:** 2026-04-25
**Domain:** Browser auth diagnostics + GDPR consent gating + static asset polish + requirements audit
**Confidence:** HIGH for stack/patterns, MEDIUM for auth-bug differential (root cause not yet observed)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Auth Bug Fix**
- **D-01:** Diagnose-first strategy. Add Sentry breadcrumbs around the entire auth flow (AuthContext mount, Supabase session resolution, OAuth callback handler, AuthErrorPage render path) and a temporary dev-only `?debug=auth` URL query that surfaces a panel with: current Supabase session shape, all `sb-*` cookies, all `sb-*` localStorage keys, last 5 Sentry breadcrumbs, and any console errors captured in the last 30s. Capture this state from the user's main browser, identify root cause, ship a targeted fix. Do NOT ship a guess. The escape-hatch ("Clear stuck session" button) is explicitly **deferred**.
- **D-02:** Manual repro is the FIRST plan task. Before any code change, the planner must include a manual reproduction checklist in the user's main browser (clear cookies/localStorage; disable extensions one at a time; check 3P-cookie setting; try a second profile). If steps (1)-(4) resolve the symptom, the bug is environmental, not a code defect — diagnose-first work still ships, but code-level investigation can be scoped down.

**GDPR Opt-IN Rewire**
- **D-03:** First-visit non-blocking banner + persistent flipped footer chip.
- **D-04:** Default state is OFF for both PostHog and Sentry Replay until consent. Refactor `src/lib/posthog.ts`, `src/lib/sentry-replay.ts`, `src/main.tsx`, and `AuthContext`'s `posthog.identify()` so init is gated on consent, not unconditional.
- **D-05:** Bundled consent — one Allow/Decline covers both PostHog and Sentry Replay. Sentry **error** capture is NOT gated.
- **D-06:** Global opt-IN — no geo-detection. Same UX worldwide.

**Cleanup**
- **D-07:** Favicon replacement from `src/assets/wtcs-logo.png` (16/32 PNG + 180x180 apple-touch + dark-mode variant if needed). UI-SPEC locks **realfavicongenerator.net** as the workflow.
- **D-08:** Trigger a real production error and confirm symbolicated stack trace in Sentry. Roll back the deliberate-error path immediately after.
- **D-09:** Audit REQUIREMENTS.md and update Status column for v1 requirements that actually shipped in Phases 1-5 but were never marked Complete.
- **D-10:** Replace `<title>wtcs-community-polls</title>` with `<title>WTCS Community Suggestions</title>` and add `<meta name="description">` (~155 chars).

### Claude's Discretion
- Exact `?debug=auth` overlay UI mechanism (env-gated import vs Vite define vs runtime check)
- Sentry breadcrumb category/level naming for the auth flow (single `category: "auth"` vs sub-categories)
- Banner copy exact wording (UI-SPEC locks `Allow` / `Decline` / `We can record anonymous usage to help us improve this site.`)
- Banner dismissal storage mechanism (UI-SPEC locks `localStorage` key `wtcs_consent`)
- Whether to add a separate `/privacy` page (default = inline copy in banner)
- Sentry sourcemap-verification trigger mechanism (admin-only debug route vs deliberate EF malformed-payload vs CI smoke test)

### Deferred Ideas (OUT OF SCOPE)
- "Clear stuck session and retry" escape-hatch button on AuthErrorPage
- Separate granular toggles for analytics vs replay
- EU-only opt-IN with default-ON elsewhere
- Discord webhook on auth failure or consent change
- `/privacy` page as a separate route (default = inline)
- Phase 4 UAT 9th test (cross-account verification — requires second human)
- Open Graph / Twitter card meta tags
</user_constraints>

<phase_requirements>
## Phase Requirements

Phase 6 was added 2026-04-25 as a roadmap evolution and does **not** introduce new REQ-IDs. Instead, it **closes status drift** on existing v1 REQ-IDs from Phases 1-5 that are still marked Pending in `REQUIREMENTS.md` despite shipping (D-09).

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can log in via Discord OAuth | Phase 1 closure + Phase 6 D-01 fix; verified live in Phase 4 UAT 2026-04-25 |
| AUTH-02 | User without Discord 2FA rejected with clear error | Phase 1 closure + AuthErrorPage variant verified |
| AUTH-04 | Session persists across browser refresh | Phase 1 closure |
| AUTH-05 | User can log out from any page | Phase 1 closure |
| ADMN-01 | Initial admin accounts seeded by Discord user ID | Phase 1 D-10 (seed migration) |
| VOTE-01 | One response per suggestion (UNIQUE constraint) | Phase 2 + Phase 4 UAT |
| VOTE-02 | Response submission via Edge Function | Phase 2 + 04-UAT.md |
| VOTE-03 | Response cannot be changed/deleted | Phase 2 RLS policy |
| RSLT-01 to RSLT-05 | Results visibility rules | Phase 2 |
| CATG-02 to CATG-04 | Active list / filter / search | Phase 2 + Phase 4 |
| UIDN-01 to UIDN-03 | Light/dark mode, mobile-first, shadcn polish | Phase 1 |
| INFR-03 | Reads via supabase-js + RLS | Phase 1 + verified in 05-VERIFICATION |
| INFR-04 | Writes via Edge Functions | Phase 2 + 05-VERIFICATION |
| TEST-01 to TEST-04 | Test infrastructure, auth/vote/integrity tests | Phase 1-3 closure |

The audit is **evidence-based**: each REQ-ID flipped to Complete must cite the specific phase artifact (UAT entry, VERIFICATION entry, or merged-test file) that proves it shipped. Don't mark Complete on assumption.
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Budget:** $0/month — Supabase free tier, Netlify legacy free tier, Upstash Redis free tier. **No new paid services in this phase.**
- **Stack lock:** Vite + React 19 + TS + TanStack Router + shadcn/ui + Tailwind v4. Discord OAuth via Supabase native provider only.
- **Tone:** Direct, helpful. No exclamation marks. No emojis. No hype words. Phase 1 D-05/06/07.
- **Terminology:** User-facing copy uses "suggestions/topics/opinions/responses". NEVER "polls/votes". Internal code/DB may use either. PROJECT.md.
- **GSD workflow:** Direct repo edits outside a GSD command are forbidden. Phase 6 already in `/gsd-execute-phase` track.
- **No `cd` between commands;** prefer absolute paths (CLAUDE.md operational rule).

## Summary

Phase 6 is a four-bucket cleanup pass with **no new product features**. The technical novelty is concentrated in two areas:

1. **Inverting the existing opt-OUT consent model** without introducing a new race condition between Sentry init, PostHog init, AuthContext.identify(), and ConsentBanner mount. The codebase already has a lazy-attach pattern for Sentry Replay (`loadSentryReplayIfConsented`) that proves the architecture works; the planner extends the same pattern to PostHog `init()` itself, and adds a single source-of-truth localStorage key (`wtcs_consent`) that all three subscribers (PostHog, Sentry Replay, AuthContext) read.

2. **Diagnosing the Discord OAuth bug** that reproduces only in the user's main browser. The verified key insight from Supabase docs: **the supabase-js browser SDK stores auth state in localStorage by default, NOT third-party cookies** (CONTEXT.md D-02 step 3 over-indexes on the 3P-cookie hypothesis). The PKCE flow stores a `*-code-verifier` key in localStorage at OAuth start; if anything wipes that key between `signInWithOAuth()` and the callback, the callback fails with `invalid request: both auth code and code verifier should be non-empty`. That single failure mode covers the strongest extension/profile differentials.

The other two buckets (favicon, title/meta, REQUIREMENTS audit, Sentry symbolication verification) are mechanical hygiene with low research surface.

**Primary recommendation:** Build a `useConsent()` hook backed by a single localStorage key with a `storage` event listener for cross-tab sync, gate `posthog.init()` and `loadSentryReplayIfConsented()` and `posthog.identify()` on the hook value, instrument the auth flow with Sentry breadcrumbs using a single `category: "auth"` and sub-typed messages, and ship the favicon set from realfavicongenerator.net committed directly to `public/`. Use only PostHog's native `opt_out_capturing_by_default: true` config rather than guarding the `init()` call itself — it's the supported GDPR-defensible default per PostHog docs.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Discord OAuth flow | Browser / Client (supabase-js) | Supabase Auth backend | Supabase docs confirm browser SDK uses 1st-party storage (localStorage); PKCE state lives client-side |
| Consent state storage | Browser / Client (localStorage) | — | Single user-agent fact; no server-side persistence needed; UI-SPEC explicitly REJECTS cookie-based consent storage |
| Consent state propagation | Browser / Client (React context + `storage` event) | — | Cross-tab sync via DOM `storage` event API; no server roundtrip |
| Sentry error capture (always on) | Browser / Client | Sentry SaaS | Init in `main.tsx`; module-scope guard; PII-free per Phase 5 D-13 |
| Sentry Replay (consent-gated) | Browser / Client (lazy-attach) | Sentry SaaS | Existing `loadSentryReplayIfConsented` pattern proves this tier owns the gating |
| PostHog analytics (consent-gated) | Browser / Client | PostHog SaaS | Use `opt_out_capturing_by_default: true` config; flip via `opt_in_capturing()` after consent |
| `?debug=auth` overlay | Browser / Client (DEV build only) | — | `import.meta.env.DEV` runtime gate ensures zero prod bytes |
| Favicon set | CDN / Static (Netlify edge) | — | `public/` files; Netlify default cache headers; no `netlify.toml` change required |
| `<title>` + `<meta name="description">` | CDN / Static (Vite-built `index.html`) | — | Build-time only; no runtime concern |
| REQUIREMENTS.md status audit | Repository / Documentation | — | No code surface — pure markdown edit |
| Sentry symbolication verification | Browser / Client (one-shot trigger) | Sentry SaaS dashboard | One-time deliberate error; rolled back same commit |

## Standard Stack

### Core (already installed — no new deps for Phase 6)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@sentry/react` | 10.49.0 | Error capture + breadcrumbs + Replay | Already wired in `src/lib/sentry.ts`; Replay lazy-attach pattern proven [VERIFIED: package.json] |
| `posthog-js` | 1.369.3 | Analytics + session replay | Already wired in `src/lib/posthog.ts`; supports `opt_out_capturing_by_default` natively [VERIFIED: package.json] |
| `@supabase/supabase-js` | 2.101.1 | Auth + DB client | Already wired; PKCE flow + localStorage storage adapter [VERIFIED: package.json] |
| `@tanstack/react-router` | 1.168.10 | Routing | Already wired; `useRouterState` used by ConsentChip for `/admin/*` gate [VERIFIED: package.json] |
| React | 19.2.4 | UI framework | Locked [VERIFIED: package.json] |
| Vite | 8.0.5 | Build / `import.meta.env.DEV` | Locked; provides DEV/PROD env gating [VERIFIED: package.json] |
| `posthog-js/react` | (peer) | `<PostHogProvider>` already mounted in `main.tsx` | Already wrapping the router — no change to provider tree |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn `Button` | n/a | Banner CTAs | Banner Allow/Decline + debug overlay copy buttons |
| shadcn `Card` (or raw `bg-card rounded-xl border`) | n/a | Banner / debug overlay container | Per UI-SPEC, raw div is acceptable per Phase 5 AppErrorFallback precedent |
| shadcn `Sonner` toast | n/a | Debug overlay copy-to-clipboard ack | Already mounted globally |
| Lucide `X`, `Copy` | n/a | Dismiss + copy icons | Already in use |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `opt_out_capturing_by_default: true` config | Conditional `posthog.init()` call | Conditional init breaks the `posthog-js/react` `<PostHogProvider client={posthog}>` contract — the provider expects a real client object. Config-flag approach keeps the provider tree stable. |
| `localStorage` for consent state | Cookie-based consent | UI-SPEC explicitly REJECTS cookies (D-04 rationale: this phase fixes a cross-site-cookie auth bug; using more cookies for consent contradicts the cleanup goal). |
| `useConsent()` hook + Context | Imperative `loadAnalytics()` from a top-level effect | Hook is cleaner for `AuthContext`'s `identify()` gate — it can read consent in the same render pass as session resolution. Imperative pattern would require side-channel signaling. |
| realfavicongenerator.net | `vite-plugin-favicons` (build-time) | Build-time plugin adds toolchain weight for a one-shot operation; UI-SPEC locks the manual workflow. |
| realfavicongenerator.net | hand-crafted SVG | Hand-crafted SVG can't produce the multi-resolution `.ico` legacy fallback in one pass. |

**No new packages installed in this phase.** All gating, banner UI, debug overlay, and favicon work uses libraries already in the dependency tree.

**Version verification (npm registry, 2026-04-25):**

Already-installed library versions in this project are locked per Phase 5 D-16. We do NOT bump dependencies in Phase 6 — the existing pinned versions (above) are what code targets.

## Architecture Patterns

### System Architecture Diagram

Consent + analytics + auth interaction (Phase 6 target state):

```
                                  ┌────────────────────────┐
        First load                │   index.html (CDN)      │
        ─────────────►            │  - <title>              │
                                  │  - <meta description>   │
                                  │  - <link rel="icon" …>  │
                                  └───────────┬─────────────┘
                                              │
                                              ▼
                              ┌────────────────────────────────┐
                              │  src/main.tsx (Browser)         │
                              │                                 │
                              │  Sentry.init() ── ALWAYS on    │
                              │       (errors only, no Replay)  │
                              │                                 │
                              │  initPostHog() ── reads consent │
                              │       opt_out_capturing_by_     │
                              │       default: true             │
                              │  ─────────────────────────────  │
                              │  <PostHogProvider client={...}> │
                              │   <ErrorBoundary>               │
                              │    <RouterProvider>             │
                              │     <ConsentProvider>           │
                              │      ConsentBanner | ConsentChip│
                              │      DebugAuthOverlay (DEV)     │
                              │     </ConsentProvider>          │
                              │    </RouterProvider>            │
                              │   </ErrorBoundary>              │
                              │  </PostHogProvider>             │
                              └────────────┬────────────────────┘
                                           │
                                           ▼
            ┌─────────────────────────────────────────────────┐
            │  ConsentProvider (NEW — useConsent hook)         │
            │                                                  │
            │  state: 'undecided' | 'allow' | 'decline'        │
            │  source: localStorage['wtcs_consent']            │
            │  cross-tab: window.addEventListener('storage')   │
            │                                                  │
            │  on flip to 'allow':                             │
            │   ├─► posthog.opt_in_capturing()                │
            │   ├─► loadSentryReplayIfConsented()             │
            │   └─► AuthContext re-runs identify gate         │
            │                                                  │
            │  on flip to 'decline':                           │
            │   ├─► posthog.opt_out_capturing()               │
            │   └─► (Replay never attaches; already-attached  │
            │        Replay continues until next page load)   │
            └────────┬─────────────────────────────────────────┘
                     │
                     ▼
       ┌──────────────────────────────────┐       ┌──────────────────────────────┐
       │  AuthContext (existing)           │       │  Discord OAuth flow           │
       │   getSession()  ───────────────►  │ ────► │  1. signInWithOAuth(discord)  │
       │   onAuthStateChange ─────────────►│       │     stores PKCE verifier in   │
       │   handleAuthCallback (2FA gate)   │       │     localStorage              │
       │                                   │       │  2. Discord redirect          │
       │   if (consent==='allow' &&        │       │  3. /auth/callback             │
       │       providerId)                 │       │     reads verifier ← FAILURE  │
       │     posthog.identify(providerId)  │       │     POINT if extension wiped │
       │                                   │       │     localStorage              │
       │   ── adds Sentry breadcrumbs ──   │       │  4. handleAuthCallback        │
       │      category: 'auth'             │       │     verifies 2FA + guild      │
       └──────────────────────────────────┘       └──────────────────────────────┘

       ?debug=auth (DEV ONLY, lazy-loaded):
       ┌──────────────────────────────────────┐
       │  reads document.cookie sb-*           │
       │  reads localStorage sb-*              │
       │  reads supabase.auth.getSession()     │
       │  reads last 5 Sentry breadcrumbs      │
       │  proxies console.error for 30s        │
       └──────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── components/
│   ├── ConsentBanner.tsx           # NEW — first-visit banner
│   ├── ConsentChip.tsx             # MODIFIED — flipped state machine
│   └── debug/
│       └── DebugAuthOverlay.tsx    # NEW — DEV-only diagnostic panel
├── contexts/
│   ├── AuthContext.tsx             # MODIFIED — gate identify() on consent
│   └── ConsentContext.tsx          # NEW — single source of truth for consent state
├── hooks/
│   └── useConsent.ts               # NEW — exposes consent state + actions
├── lib/
│   ├── posthog.ts                  # MODIFIED — opt_out_capturing_by_default
│   ├── sentry.ts                   # UNCHANGED in Phase 6 (Replay loader stays)
│   └── sentry-replay.ts            # UNCHANGED (already isolated)
├── routes/
│   └── auth/
│       ├── callback.tsx            # MODIFIED — Sentry breadcrumbs
│       └── error.tsx               # MODIFIED — Sentry breadcrumbs
└── __tests__/
    └── components/
        ├── ConsentBanner.test.tsx  # NEW
        ├── ConsentChip.test.tsx    # MODIFIED — inverted state machine
        └── DebugAuthOverlay.test.tsx  # NEW (or skipped if pure dev tool)

public/
├── favicon.ico                     # NEW (multi-res 16/32/48)
├── favicon.svg                     # REPLACED (new WTCS-branded; embedded dark-mode CSS)
├── apple-touch-icon.png            # NEW (180x180)
└── _redirects                      # UNCHANGED

index.html                          # MODIFIED — title, meta, link tags

REQUIREMENTS.md                     # MODIFIED — Status column flipped per evidence
```

### Pattern 1: Single-source-of-truth consent context

**What:** A React context provider mounted at the top of the tree, backed by a single `localStorage` key, with a `storage` event listener for cross-tab sync. All consent-aware code (`posthog.ts`, `sentry-replay.ts`, `AuthContext`) reads from the hook, not from `localStorage` directly.

**When to use:** Any time multiple subscribers need to react to a single piece of user-agent state that may change at runtime (consent flip, opt-out flip).

**Example:**

```typescript
// src/contexts/ConsentContext.tsx
// Source: standard React context pattern + DOM storage event API
//   (https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event)
import { createContext, useEffect, useState, useCallback } from 'react'
import type { ReactNode } from 'react'

export type ConsentState = 'undecided' | 'allow' | 'decline'
const STORAGE_KEY = 'wtcs_consent'

interface ConsentContextValue {
  state: ConsentState
  allow: () => void
  decline: () => void
}

export const ConsentContext = createContext<ConsentContextValue | undefined>(undefined)

function readConsent(): ConsentState {
  if (typeof window === 'undefined') return 'undecided'
  const v = window.localStorage.getItem(STORAGE_KEY)
  if (v === 'allow' || v === 'decline') return v
  // One-shot migration from Phase 5 opt-OUT key (UI-SPEC Storage table).
  if (window.localStorage.getItem('analytics_opted_out') === 'true') {
    window.localStorage.setItem(STORAGE_KEY, 'decline')
    window.localStorage.removeItem('analytics_opted_out')
    return 'decline'
  }
  return 'undecided'
}

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConsentState>(readConsent)

  useEffect(() => {
    // Cross-tab sync: another tab's banner/chip flip propagates here.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setState(readConsent())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const allow = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEY, 'allow')
    setState('allow')
  }, [])

  const decline = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEY, 'decline')
    setState('decline')
  }, [])

  return (
    <ConsentContext.Provider value={{ state, allow, decline }}>
      {children}
    </ConsentContext.Provider>
  )
}
```

The `useConsent` hook lives in `src/hooks/useConsent.ts` to satisfy `react-refresh/only-export-components` (same lint rule that pushed `useAuth` out of `AuthContext.tsx`).

### Pattern 2: PostHog opt-IN via `opt_out_capturing_by_default`

**What:** Initialize PostHog unconditionally with `opt_out_capturing_by_default: true`. This loads the SDK but suppresses all capture until `posthog.opt_in_capturing()` is called. The `<PostHogProvider client={posthog}>` tree stays intact regardless of consent state.

**When to use:** When you need a single SDK instance with a runtime-toggleable capture state, AND you want to keep the React provider stable.

**Example:**

```typescript
// src/lib/posthog.ts (Phase 6 target)
// Source: https://posthog.com/docs/privacy/data-collection
//   "Set opt_out_capturing_by_default to true to opt users out by default"
import posthog from 'posthog-js'

let initialized = false

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
    // Phase 6 GDPR opt-IN — capture is suppressed until opt_in_capturing() runs.
    opt_out_capturing_by_default: true,
    opt_out_persistence_by_default: true,
    respect_dnt: true,
  })
  posthog.register({ app: 'community-polls' })
  initialized = true
  return posthog
}

export { posthog }
```

The flip happens elsewhere (e.g., a `useEffect` inside `ConsentProvider`):

```typescript
// inside ConsentProvider effect, when state flips to 'allow':
posthog.opt_in_capturing()
// when state flips to 'decline':
posthog.opt_out_capturing()
```

This avoids two known PostHog landmines:
1. Conditional init breaks `posthog.identify()` calls elsewhere (the global no-ops silently). [CITED: github.com/PostHog/posthog/issues/18898]
2. `has_opted_out_capturing()` returns `false` when no preference is set, leading some apps to skip showing a banner — we side-step this by relying on our own `wtcs_consent` localStorage key as the source of truth, never on PostHog's internal flags. [CITED: github.com/PostHog/posthog-js/issues/1547]

### Pattern 3: Sentry error capture stays unconditional; Replay stays consent-gated

**What:** `Sentry.init()` runs in `main.tsx` regardless of consent and captures errors. Replay attaches via `loadSentryReplayIfConsented()` only when consent is `allow`. The existing pattern stays — Phase 6 only changes the consent source from `analytics_opted_out` (opt-OUT) to `wtcs_consent` (opt-IN).

**When to use:** Whenever error capture is operationally necessary (always on) but session recording is GDPR-sensitive (opt-IN).

**Example:** Existing `src/lib/sentry.ts::loadSentryReplayIfConsented` already does the right thing structurally; only the localStorage check changes:

```typescript
// CURRENT (opt-OUT):
const optedOut = window.localStorage.getItem('analytics_opted_out') === 'true'
if (optedOut) return

// PHASE 6 TARGET (opt-IN):
const consent = window.localStorage.getItem('wtcs_consent')
if (consent !== 'allow') return
```

The dynamic-import + isolated re-export module (`src/lib/sentry-replay.ts`) is preserved verbatim — that pattern keeps the ~40 KB Replay code out of the main bundle for non-consented users (Phase 5 ME-02 / M3 mitigation).

### Pattern 4: Sentry breadcrumbs for the auth flow

**What:** Add breadcrumbs at instrumented points in the auth lifecycle. Use a single `category: "auth"` and message-driven differentiation so the Sentry issue UI groups them cleanly.

**When to use:** Whenever you need post-mortem visibility into a sequence of events leading up to an error.

**Example:**

```typescript
// Source: https://docs.sentry.io/platforms/javascript/guides/react/enriching-events/breadcrumbs/
import * as Sentry from '@sentry/react'

// AuthContext mount:
Sentry.addBreadcrumb({
  category: 'auth',
  message: 'AuthContext mounted',
  level: 'info',
  data: { isOAuthRedirect },
})

// Supabase session resolution:
Sentry.addBreadcrumb({
  category: 'auth',
  message: 'getSession() resolved',
  level: 'info',
  data: { hasSession: !!initialSession, hasUser: !!initialSession?.user },
})

// onAuthStateChange:
Sentry.addBreadcrumb({
  category: 'auth',
  message: `onAuthStateChange: ${event}`,
  level: 'info',
  data: { event, hasSession: !!newSession, hasProviderToken: !!newSession?.provider_token },
})

// handleAuthCallback failure:
Sentry.addBreadcrumb({
  category: 'auth',
  message: 'handleAuthCallback rejected',
  level: 'warning',
  data: { reason: result.reason },
})

// AuthErrorPage mount:
Sentry.addBreadcrumb({
  category: 'auth',
  message: 'AuthErrorPage rendered',
  level: 'warning',
  data: { reason: searchParams.reason },
})
```

**Six-key constraint:** Sentry drops breadcrumb keys that aren't `type`, `category`, `message`, `level`, `timestamp`, or `data`. [CITED: develop.sentry.dev/sdk/data-model/event-payloads/breadcrumbs/] Keep all custom info inside `data`. [VERIFIED: Sentry React breadcrumbs docs]

**Levels:** Use `info` for normal flow events, `warning` for auth-rejection branches, `error` reserved for unexpected throws (Sentry will create an event for those automatically).

### Pattern 5: DEV-only debug overlay via `import.meta.env.DEV` + dynamic import

**What:** A debug component that lives only in dev builds. Vite's `import.meta.env.DEV` is replaced with a literal `true`/`false` at build time, so the dead branch tree-shakes out of production.

**When to use:** Diagnostic UI that must not ship to users.

**Example:**

```typescript
// In RootLayout or a dedicated mount point:
import { lazy, Suspense } from 'react'
import { useSearchParams } from '@tanstack/react-router'  // or window.location

const DebugAuthOverlay = import.meta.env.DEV
  ? lazy(() => import('@/components/debug/DebugAuthOverlay'))
  : null

export function RootLayout({ children }: { children: ReactNode }) {
  const searchParams = new URLSearchParams(window.location.search)
  const debugOn = searchParams.get('debug') === 'auth'

  return (
    <>
      {children}
      {DebugAuthOverlay && debugOn && (
        <Suspense fallback={null}>
          <DebugAuthOverlay />
        </Suspense>
      )}
    </>
  )
}
```

In production builds, `DebugAuthOverlay` is `null`, the dynamic `import()` is unreachable, and Rolldown drops the entire `src/components/debug/` chunk from the build. Verified zero-cost pattern; matches Phase 5's Sentry-Replay code-split idiom.

### Pattern 6: Dark-mode SVG favicon via embedded CSS (NOT `<link media>`)

**What:** Use a single SVG favicon that contains an embedded `<style>` block with a `prefers-color-scheme: dark` media query. The browser re-renders the SVG when system theme changes.

**When to use:** When you want one icon that adapts to OS dark mode without shipping two files.

**Example:**

```xml
<!-- public/favicon.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <style>
    .icon { fill: #0a0a0a; }
    @media (prefers-color-scheme: dark) {
      .icon { fill: #fafafa; }
    }
  </style>
  <path class="icon" d="..." />
</svg>
```

**Browser support [CITED: blog.tomayac.com/2019/09/21/prefers-color-scheme-in-svg-favicons-for-dark-mode-icons/, web.dev/articles/building/an-adaptive-favicon]:**
- Chrome/Edge: Full support
- Firefox: Tab + bookmark support
- Safari 15.6+: SVG favicon support; embedded media query honors **OS** preference, not browser theme

**Critical caveat:** The `<link rel="icon" media="(prefers-color-scheme: dark)" ...>` attribute approach has spotty support — embedded CSS inside the SVG is the reliable path. UI-SPEC's example HTML lists a `<link media>` variant; the planner should prefer the embedded-CSS approach in the SVG itself unless realfavicongenerator.net's output already produces a contrast-acceptable mark for both themes (in which case no dark variant is needed at all per UI-SPEC's "ONLY if needed" caveat).

### Anti-Patterns to Avoid

- **Conditional `posthog.init()` based on consent:** breaks the global `posthog` singleton — `posthog.identify()` calls elsewhere become silent no-ops. Use `opt_out_capturing_by_default: true` instead. [CITED: github.com/PostHog/posthog-js/issues/2841]
- **Reading `posthog.has_opted_out_capturing()` to gate the banner:** returns `false` when no decision has been made (PR #1176 behavior change), leading to apps thinking the user consented when they hadn't. Use your own localStorage key. [CITED: github.com/PostHog/posthog-js/issues/1547]
- **Cookie-based consent storage:** UI-SPEC explicitly forbids it (D-04 rationale). Stick to `localStorage`.
- **Branching consent UX on country/locale headers:** D-06 rejects this; matches the project's Russian-VPN architectural assumption.
- **Geo-detecting EU users for opt-IN:** rejected D-06 — same UX worldwide.
- **Hand-rolling the `<title>` SEO truncation logic:** Just write a string ≤60 chars for title, ≤160 chars for description. Locked verbatim in UI-SPEC.
- **Adding new env vars for the consent system:** None needed. `wtcs_consent` is browser-local. The Phase 5 D-12 env-var layout (`VITE_SENTRY_DSN`, `VITE_POSTHOG_KEY`) carries forward unchanged.
- **`<link rel="icon" media="(prefers-color-scheme: dark)" ...>` as the primary dark-mode mechanism:** spotty browser support. Prefer embedded CSS inside the SVG. [CITED: web.dev adaptive favicon article]
- **Logging full Supabase tokens in the debug overlay:** UI-SPEC requires truncating to first 8 chars + `…`. Tokens in screenshots are a real exfiltration risk even in dev.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-tab consent sync | Polling localStorage in a `setInterval` | Native DOM `storage` event listener | Built-in, fires only on actual changes from OTHER tabs (own-tab writes don't trigger it — sync via `setState` directly), zero overhead |
| GDPR opt-IN default for PostHog | Conditional init / global proxy / try-catch around capture calls | `opt_out_capturing_by_default: true` config | Native, supported, GDPR-defensible, doesn't break the React provider tree |
| Sentry Replay opt-IN | Re-creating `Sentry.init()` after consent | `client.addIntegration(replayIntegration())` | Existing pattern in `src/lib/sentry.ts` already does this correctly; preserve as-is |
| Multi-format favicon set | Hand-crafting `.ico`, multiple PNG sizes | realfavicongenerator.net (one-shot manual) | Generates ico/png/svg/apple-touch in one pass with correct metadata; UI-SPEC locks this tool |
| `import.meta.env.DEV` gating | Custom env-flag plumbing | Vite-built-in | Replaced with literal at build time; tree-shakes dead branches automatically |
| Cookie enumeration in debug overlay | Manual parser | `document.cookie.split('; ').filter(c => c.startsWith('sb-'))` | One-liner; no library needed |
| localStorage enumeration | Custom hook | `Object.keys(localStorage).filter(k => k.startsWith('sb-'))` | Built-in browser API |
| Sentry breadcrumb collection | Custom buffer | Sentry's internal scope | Last 100 breadcrumbs available via `Sentry.getCurrentScope()` (or whichever scope-API the SDK exposes); `?debug=auth` reads from that, doesn't maintain its own buffer |
| HTML title/meta truncation | Char-counting library | Just write the strings | Locked verbatim in UI-SPEC; no runtime concern |

**Key insight:** Phase 6 is structurally a pattern-flipping phase — almost everything has an existing, working pattern in the Phase 5 codebase. The primary risk is *not extending those patterns cleanly*. The planner should resist any temptation to refactor adjacent code (e.g., the `loadSentryReplayIfConsented` Replay loader, the `posthog-js/react` provider tree, the AuthContext OAuth-redirect handling). Flip the consent source key, change one config option in `posthog.init`, add breadcrumbs, swap the favicon, write the new title — keep the diff surgical.

## Runtime State Inventory

> Phase 6 is a partial refactor (consent model invert + favicon swap), not a rename, but it touches stored client-side state. Audit applies.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| **Stored data (browser localStorage)** | `analytics_opted_out` (Phase 5 opt-OUT key) — present in any browser that previously visited the site under Phase 5 semantics. `posthog_consent_chip_dismissed` (Phase 5 session-dismiss key) — kept as-is. | One-shot migration in `ConsentProvider.readConsent()`: if `analytics_opted_out === 'true'` AND `wtcs_consent` is absent, set `wtcs_consent='decline'` and `removeItem('analytics_opted_out')`. UI-SPEC Storage & State Contracts already specifies this migration path. |
| **Stored data (browser localStorage — supabase-js)** | `sb-<project-ref>-auth-token` (Supabase session), `*-code-verifier` keys (PKCE flow during OAuth handshake) | NO migration. These are owned by supabase-js and untouched in this phase. The debug overlay (D-01) READS them; doesn't write. |
| **Stored data (PostHog internal)** | `ph_<project>_posthog` cookie/localStorage (PostHog persistence), `ph_<project>_postohg_consent` if `opt_out_persistence_by_default` is set | None — PostHog manages its own keys. Verify `respect_dnt: true` flag in init still honors browser DNT setting. |
| **Live service config** | None — no n8n / Datadog / Cloudflare Tunnel-style external config in this stack. | None. |
| **OS-registered state** | None — no Task Scheduler / launchd / pm2 entries. | None. |
| **Secrets and env vars** | `VITE_SENTRY_DSN`, `VITE_POSTHOG_KEY` (Phase 5 D-12) — UNCHANGED. No new env vars introduced by Phase 6. | None. CONTEXT.md confirms: "no new env vars beyond what Phase 5 D-12 already provides." |
| **Build artifacts / installed packages** | `dist/` (Vite build) will rebuild with new favicon set, new `<title>` in `index.html`, new bundle hash. Netlify auto-deploys on push-to-main. | Verify cache headers: `netlify.toml` does not set explicit `Cache-Control` for favicon files; Netlify default is `Cache-Control: public, max-age=0, must-revalidate` for HTML and `max-age=31536000, immutable` for hashed assets. **Favicon is unhashed** (`/favicon.svg`, `/favicon.ico`, `/apple-touch-icon.png`) — Netlify serves these with the HTML cache profile, so a deploy invalidates cached favicons within one navigation. No `netlify.toml` change required. |

**Migration path for users on the live site:** First page-load after the Phase 6 deploy, `ConsentProvider.readConsent()` runs once per browser. If user previously opted out (Phase 5), they're migrated to `decline`. If user previously consented implicitly (default Phase 5 behavior), they're treated as `undecided` and see the new banner. This is the GDPR-defensible posture — explicit re-consent on the new opt-IN model.

## Common Pitfalls

### Pitfall 1: Race between `Sentry.init`, `initPostHog`, and the consent context

**What goes wrong:** If `posthog.identify()` runs in `AuthContext` before `ConsentProvider` has read localStorage, the identify call is suppressed (correct) but the user's session is then "anonymous" in PostHog forever — no retroactive identify happens when consent flips to `allow`.

**Why it happens:** AuthContext's `useEffect` may fire before the consent listener has settled, especially under React StrictMode's double-invoke.

**How to avoid:** AuthContext consumes the `useConsent()` hook directly. The `posthog.identify(providerId)` call is wrapped in:
```typescript
if (consent === 'allow' && providerId) posthog.identify(providerId)
```
AND a separate `useEffect` watches `[consent, user]` together — when consent flips to `allow` AND a user is already signed in, fire `identify()` retroactively.

**Warning signs:** PostHog dashboard shows authenticated users with `distinct_id` matching anonymous device IDs instead of Discord snowflakes.

### Pitfall 2: Banner re-shows after Allow/Decline due to localStorage write race

**What goes wrong:** User clicks Allow; banner state flips locally; navigation happens before `setItem` completes (rare but possible on slow disks); next page load reads stale state.

**Why it happens:** `localStorage.setItem` is synchronous in the WHATWG spec, but React's render commit is asynchronous. The banner's "fade out" animation could complete before the next route navigation kicks in.

**How to avoid:** Write to localStorage SYNCHRONOUSLY before calling `setState`. UI-SPEC Pattern 1 above does this correctly — the localStorage write happens in the click handler, not in a `useEffect`.

**Warning signs:** Banner reappears immediately after a click; localStorage shows no `wtcs_consent` key.

### Pitfall 3: `?debug=auth` ships to production

**What goes wrong:** A misconfigured runtime check exposes the debug overlay (with sb-* localStorage values, breadcrumbs, etc.) to all users.

**Why it happens:** Using a `window.location` check instead of `import.meta.env.DEV`; using a runtime config flag that defaults open; importing the debug component statically (defeats tree-shaking).

**How to avoid:** Two-layer defense: (1) `import.meta.env.DEV` literal at the top of the file (Vite replaces with `false` in prod, dead-code-eliminates the import); (2) the dynamic `import()` ensures the chunk is never bundled into prod even if the env check fails.

**Warning signs:** `dist/assets/` contains a chunk whose source map references `DebugAuthOverlay.tsx`. Verify with: `grep -r "DebugAuthOverlay" dist/` after a prod build — should return zero matches.

### Pitfall 4: PKCE code_verifier wiped between `signInWithOAuth` and callback

**What goes wrong:** OAuth callback fails with `invalid request: both auth code and code verifier should be non-empty`. User sees `/auth/error?reason=auth-failed`. This is the **strongest hypothesis for the auth bug per CONTEXT.md D-01**.

**Why it happens:** A browser extension (Privacy Badger, uBlock, "Clear cookies on tab close" type extensions, anti-tracking extensions) wipes localStorage for the Supabase domain between the `signInWithOAuth` redirect and the callback redirect. Incognito mode with no extensions doesn't trigger this — explains the diagnostic. [CITED: github.com/supabase/auth/issues/2099]

**How to avoid:** Diagnose first per D-01 — the debug overlay surfaces the missing `*-code-verifier` localStorage key as direct evidence. If confirmed, the v1 fix is the deferred escape-hatch button (NOT in scope for Phase 6 per D-01 deferral); Phase 6 ships only the breadcrumbs that prove the failure mode.

**Warning signs:** User's main browser shows zero `*-code-verifier` keys in localStorage after clicking "Sign in with Discord" but BEFORE Discord redirects back. Sentry breadcrumb timeline shows `signInWithOAuth` → `onAuthStateChange: SIGNED_IN` → `handleAuthCallback rejected` with `reason: 'auth-failed'`.

### Pitfall 5: Supabase first-party-cookie myth

**What goes wrong:** Plan assumes Supabase auth uses cross-site cookies between the app domain and the Supabase project domain. This was the framing in CONTEXT.md D-02 step 3. Supabase's own docs are explicit: **"Supabase Auth only uses 1st-party cookies for authentication and not 3rd party cookies"**, and the browser SDK defaults to **localStorage**, not cookies. [CITED: github.com/orgs/supabase/discussions/22072, github.com/orgs/supabase/discussions/21824]

**Why it happens:** Confusion between Supabase Auth's gateway calls (which DO go to `<project>.supabase.co`, but use `Authorization: Bearer` header tokens, not session cookies) and the OAuth provider's cookies (which never reach the app).

**How to avoid:** D-02's manual repro checklist still tests the right things (extensions, profile state, OAuth-side cookie blocking) — but the **diagnostic priority should be reordered**: PKCE localStorage state FIRST (Pitfall 4), THEN extension shields, THEN third-party-cookie settings (which mostly affect only the Discord OAuth callback URL fragment handoff, not Supabase storage). Chrome's third-party-cookie deprecation has been **abandoned** as of 2024-2025 [CITED: privacysandbox.google.com/blog/update-on-the-plan-for-phase-out-of-third-party-cookies-on-chrome] — the moving-target risk in CONTEXT.md is overstated.

**Warning signs:** Spending plan time on cross-site-cookie testing before checking localStorage persistence.

### Pitfall 6: ConsentChip migration test surface

**What goes wrong:** Existing `src/__tests__/components/ConsentChip.test.tsx` has six tests targeting the opt-OUT state machine (e.g., asserts `analytics_opted_out` localStorage key writes). After the flip, these tests fail and a planner under time pressure could `--skip` them rather than rewrite.

**Why it happens:** The Phase 5 test suite was correct for Phase 5 semantics; it documents the inverted contract.

**How to avoid:** Plan task explicitly REWRITES the test file. The new test must cover: undecided→hidden, allow→`Anonymous usage analytics are on`, decline→`Anonymous usage analytics are off`, link clicks flip the state, dismiss `×` is session-only, `/admin/*` hides the chip, `localStorage.wtcs_consent` reads/writes are correct, and the one-shot migration from `analytics_opted_out='true'` produces a `decline` state.

**Warning signs:** Test file contains references to `analytics_opted_out` after the phase ships.

### Pitfall 7: Sentry Replay leak after consent flip from `allow` → `decline`

**What goes wrong:** User initially consents, Replay attaches and starts recording. User then flips to `decline` mid-session. Replay continues recording until the page is reloaded.

**Why it happens:** Sentry Replay's `addIntegration` is one-way — there's no public `removeIntegration` API on `@sentry/react@10.x`.

**How to avoid:** Document the limitation in the consent banner copy or in user-facing privacy text (UI-SPEC may already cover this). For v1, accept the trade — the user's NEXT page load honors the new decline. Architecturally clean alternative (deferred): force a `window.location.reload()` on flip to `decline`, which tears down the SDK clean. UI-SPEC has not specified this; flag for the planner.

**Warning signs:** Sentry dashboard shows replay sessions starting before a consent-decline timestamp logged in PostHog.

### Pitfall 8: realfavicongenerator output overwrites the existing 9.5 KB `public/favicon.svg`

**What goes wrong:** Existing `public/favicon.svg` is the Vite scaffold (9522 bytes). realfavicongenerator outputs a fresh `favicon.svg` plus an `.ico` and `apple-touch-icon.png`. If the planner forgets to also `git rm` (or just overwrite) the old file in the same commit, the bundle ends up serving stale assets in some browsers.

**Why it happens:** Generated favicon-set zip is unpacked to `public/` and overwrites by name; only files NOT in the zip survive. `favicon.ico` is new; `apple-touch-icon.png` is new; `favicon.svg` overwrites cleanly.

**How to avoid:** Plan task lists each `public/` file overwritten by name. Verify with `git status` after extraction — should show modifications to `favicon.svg`, additions of `favicon.ico` + `apple-touch-icon.png`. The Vite-scaffold `public/icons.svg` (5031 bytes, sprite sheet) is unrelated and stays.

**Warning signs:** Browser tab still shows the React/Vite atom logo after deploy.

### Pitfall 9: REQUIREMENTS.md table-of-traceability divergence

**What goes wrong:** The `## v1 Requirements` checkboxes flip but the `## Traceability` table at the bottom doesn't, or vice versa. Verifier flags inconsistency.

**Why it happens:** The same status info is encoded in two places.

**How to avoid:** D-09 audit task explicitly updates BOTH locations atomically. A scripted-grep verification step at end of plan: `grep -E "^- \[(x| )\]" REQUIREMENTS.md` (top section) cross-checked against the `| ID | Phase | Status |` rows (bottom section). Mismatch = blocker.

**Warning signs:** Verifier surfaces "REQ-XXX checkbox says complete but traceability table says Pending."

## Code Examples

Verified patterns from official sources:

### PostHog opt-IN initialization

```typescript
// Source: https://posthog.com/docs/privacy/data-collection
// "Set opt_out_capturing_by_default to true to opt users out by default"
posthog.init(VITE_POSTHOG_KEY, {
  api_host: 'https://us.i.posthog.com',
  opt_out_capturing_by_default: true,
  opt_out_persistence_by_default: true,
  respect_dnt: true,
  // ... other config
})

// Later, when user consents:
posthog.opt_in_capturing()
posthog.identify(discordSnowflake)

// Later, when user revokes:
posthog.opt_out_capturing()
```

### Sentry breadcrumb at an instrumentation point

```typescript
// Source: https://docs.sentry.io/platforms/javascript/guides/react/enriching-events/breadcrumbs/
import * as Sentry from '@sentry/react'

Sentry.addBreadcrumb({
  category: 'auth',                      // groups in issue UI
  message: 'handleAuthCallback rejected',
  level: 'warning',                      // 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug'
  data: {                                // ALL custom payload goes here
    reason: result.reason,
    hasProviderToken: !!session?.provider_token,
  },
})
```

### Cross-tab localStorage sync via `storage` event

```typescript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event
// "The storage event fires on the Window object when a storage area
//  (localStorage) has been modified IN ANOTHER DOCUMENT (different tab)."
useEffect(() => {
  const onStorage = (e: StorageEvent) => {
    if (e.key === 'wtcs_consent') {
      setState(readConsent())
    }
  }
  window.addEventListener('storage', onStorage)
  return () => window.removeEventListener('storage', onStorage)
}, [])
```

### `<title>` + `<meta>` patch in `index.html`

```html
<!-- Source: HTML5 spec; UI-SPEC locks the strings -->
<title>WTCS Community Suggestions</title>
<meta name="description" content="Share opinions on War Thunder Competitive Scene proposals. Verified Discord identity, one response per account, transparent results." />
```

### Favicon `<link>` block (post-realfavicongenerator)

```html
<!-- Source: https://realfavicongenerator.net/favicon-guides/understanding-favicon-elements -->
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
```

### Embedded dark-mode CSS in SVG favicon

```xml
<!-- Source: web.dev/articles/building/an-adaptive-favicon -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <style>
    .icon { fill: #18181b; }            /* light theme: near-black */
    @media (prefers-color-scheme: dark) {
      .icon { fill: #fafafa; }          /* dark theme: near-white */
    }
  </style>
  <path class="icon" d="..." />
</svg>
```

### `?debug=auth` overlay state-collection helpers

```typescript
// Cookie enumeration:
const sbCookies = document.cookie
  .split('; ')
  .filter(c => c.startsWith('sb-'))
  .map(c => {
    const [name, ...rest] = c.split('=')
    return { name, value: rest.join('=').slice(0, 16) + '…' }
  })

// localStorage enumeration:
const sbLocalStorage = Object.keys(window.localStorage)
  .filter(k => k.startsWith('sb-'))
  .map(k => ({ key: k, value: window.localStorage.getItem(k)!.slice(0, 16) + '…' }))

// Supabase session:
const { data: { session } } = await supabase.auth.getSession()
const sessionShape = session ? {
  user_id: session.user.id,
  expires_at: session.expires_at,
  provider: session.user.app_metadata.provider,
  access_token_preview: session.access_token.slice(0, 8) + '…',
} : null

// Last 5 Sentry breadcrumbs (read from current scope):
import * as Sentry from '@sentry/react'
const scope = Sentry.getCurrentScope()
const breadcrumbs = scope.getScopeData().breadcrumbs.slice(-5)

// Console error proxy (mount in useEffect, restore in cleanup):
const errors: string[] = []
const original = console.error
console.error = (...args: unknown[]) => {
  errors.push(args.map(String).join(' '))
  original.apply(console, args)
}
return () => { console.error = original }
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 5 opt-OUT (analytics on by default; user can decline) | Phase 6 opt-IN (analytics off by default; user must allow) | 2026-04-25 (this phase) | GDPR-defensible posture; matches user's stated compliance line per memory `feedback_gdpr_consent.md` |
| Conditional `posthog.init()` based on consent | Unconditional init with `opt_out_capturing_by_default: true` | PostHog adopted this pattern in posthog-js 1.x to support GDPR while keeping a single SDK instance | Provider tree stays stable; identify() calls don't silently fail elsewhere |
| Multi-file PNG-only favicon set | SVG-primary with PNG/ICO fallbacks + apple-touch-icon | Modern browsers (Chrome, FF, Safari 15.6+) all support SVG favicons natively | One scalable mark renders crisp at any size; embedded dark-mode CSS adapts to OS theme |
| Chrome third-party cookie deprecation | **Reversed in 2024-2025** — Google retired the Privacy Sandbox initiative | 2024-07-22 announcement, 2025-10-17 confirmation | The "moving target" framing in CONTEXT.md D-02 step 3 is overstated; 3P cookies remain available cross-browser |
| Sentry Replay attached at init | Sentry Replay attached lazily via `addIntegration()` after consent | Phase 5 ME-02 / M3 mitigation | Code-splits Replay (~40 KB) out of the main bundle for non-consenting users; preserved verbatim in Phase 6 |

**Deprecated/outdated:**
- `<link rel="icon" media="(prefers-color-scheme: dark)" ...>` as a primary dark-mode mechanism — works in Chrome but spotty elsewhere; embedded CSS in the SVG body is the reliable approach.
- `posthog.has_opted_out_capturing()` as a banner-gating signal — its semantics changed in PR #1176 and now returns `false` for "no decision," which can produce GDPR-non-compliant flows. Use your own localStorage key.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Auth bug root cause is PKCE code_verifier loss in localStorage (Pitfall 4) | Pitfalls / Summary | Plan still ships diagnose-first instrumentation correctly; only the "what fix is appropriate" question shifts. Low risk because D-01 explicitly mandates diagnose-first, no preemptive fix. [ASSUMED — strongest hypothesis from Supabase storage architecture, NOT verified against the actual user environment] |
| A2 | The 60-day Dependabot reset clock from Phase 5 D-16 has not yet fired and no urgent CVE forces a Phase 6 dependency bump | Stack | If a critical advisory drops, Phase 6 may need a separate dep-bump task. Verify with `npm audit --audit-level=high` early in execution. [ASSUMED] |
| A3 | Netlify default cache headers handle the unhashed favicon files acceptably (no `netlify.toml` change required) | Runtime State Inventory / netlify.toml constraint | If users see stale Vite-scaffold favicon for too long, a `Cache-Control` rule may be needed. Low risk — Netlify default for unhashed assets is `must-revalidate`. [ASSUMED — based on Netlify docs default behavior, not verified against the live deploy] |
| A4 | realfavicongenerator.net's output is sufficient at 16×16 for the WTCS logo; no hand-simplified SVG fallback needed | Favicon | UI-SPEC already flags this for visual verification. If detail loss is significant, executor falls back to hand-simplified SVG per UI-SPEC. [ASSUMED — depends on the actual logo geometry] |
| A5 | The 7 v1 requirements pending checkbox audit (D-09) all have evidence in Phase 1-5 UAT/VERIFICATION files; no requirement is genuinely incomplete | REQUIREMENTS audit | If any req is incomplete, the audit must NOT mark it complete; instead surface as a Phase 7 candidate. The audit instructions in D-09 already require evidence-citation. [ASSUMED] |
| A6 | The deliberate-error trigger for Sentry symbolication (D-08) can be a temporary admin-only debug route that is rolled back in the same plan execution; no separate revert PR needed | D-08 verification | If reviewer policy requires an explicit revert PR, plan adds a second commit. Low risk — single-commit roll-forward-then-roll-back is standard practice. [ASSUMED] |
| A7 | `Sentry.getCurrentScope().getScopeData().breadcrumbs` is the public API to read breadcrumbs in `@sentry/react@10.49.0` for the debug overlay's "last 5 breadcrumbs" panel | Code Examples | If the API has changed in v10.x, the debug overlay falls back to a custom buffer (acceptable since it's DEV-only). [ASSUMED — verify against `@sentry/react@10.49.0` types during execution] |

**If the planner / discuss-phase wants to convert any of these to verified facts before execution:** A1 is the most consequential (drives diagnose-first scope); A7 is the most easily verified (read the SDK's TypeScript types).

## Open Questions

1. **Does the auth bug reproduce after a fresh PKCE flow with NO extensions?**
   - What we know: User's incognito works, main-browser fails. Extensions are the leading hypothesis.
   - What's unclear: Whether a clean main-browser profile (extensions disabled, full storage clear) reproduces.
   - Recommendation: D-02's manual repro checklist is the right gate — execute it as plan task #1 before any code change.

2. **Should consent flip from `allow` → `decline` force a page reload?**
   - What we know: Sentry Replay continues recording until reload (Pitfall 7). PostHog `opt_out_capturing()` IS effective immediately.
   - What's unclear: Whether the 1-page-load Replay leak is acceptable or surface-blocking for v1.
   - Recommendation: Accept for v1; document inline. If users surface the concern post-launch, add a `window.location.reload()` on flip to `decline` (one-line fix).

3. **Does Phase 4 UAT 9th test deserve its own GH issue or is it fine living in 04-UAT.md?**
   - What we know: Out of Phase 6 scope per CONTEXT.md.
   - What's unclear: Whether tracking discipline is happy with the markdown-only home.
   - Recommendation: Skip — out of scope per memory `project_phase_6_planned.md`.

4. **Is there value in adding a single `data-testid="consent-banner"` for future E2E coverage?**
   - What we know: Phase 5 added `data-testid` hooks for Playwright; banner doesn't have one.
   - What's unclear: Whether the planner wants a unit test, an E2E `@smoke` extension, or no test at all for the new banner.
   - Recommendation: Unit test the banner via Vitest + RTL (matches existing ConsentChip test pattern); skip E2E for v1 (banner is non-blocking and doesn't gate any user journey).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node + npm | Build | ✓ | (Phase 5 lock: Node 22 in `netlify.toml`) | — |
| `@sentry/react` | Breadcrumbs + ErrorBoundary | ✓ | 10.49.0 (locked) | — |
| `posthog-js` | Consent-gated analytics | ✓ | 1.369.3 (locked) — supports `opt_out_capturing_by_default` | — |
| `@supabase/supabase-js` | Auth + session shape in debug overlay | ✓ | 2.101.1 (locked) | — |
| Vite `import.meta.env.DEV` | Debug overlay env gate | ✓ | Vite 8.0.5 (locked) | — |
| realfavicongenerator.net | Favicon set generation | ✓ (web tool, no install required) | live web service | If the service is down: hand-craft SVG + skip `.ico` (modern browsers accept SVG-only); deferred dark-mode variant |
| Sentry SaaS dashboard | D-08 symbolication verification | ✓ (Phase 5 wired) | live web service | If symbolication fails: re-verify sourcemap upload step in Netlify build log per Phase 5 ME (already verified per 05-VERIFICATION re-verify 2026-04-25) |
| User's main browser | D-01 / D-02 manual auth repro | ✓ (the bug is reproduced there by definition) | — | If repro vanishes: bug was environmental; close as "diagnose-only" with breadcrumbs shipped |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None — all required tooling is either installed or freely available.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (unit/integration) — already wired per Phase 1 TEST-01 + Phase 5 closure. Playwright (E2E) — already wired per Phase 5 D-04. |
| Config file | `vitest.config.ts` (project root, existing); `e2e/playwright.config.ts` (Phase 5) |
| Quick run command | `npm test` (Vitest) |
| Full suite command | `npm test && npm run e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| D-03 banner first-visit | Banner renders when `wtcs_consent` localStorage absent | unit (Vitest + RTL) | `npm test -- ConsentBanner` | ❌ Wave 0 — new file |
| D-03 banner Allow click | Allow click writes `wtcs_consent='allow'`, removes banner | unit | `npm test -- ConsentBanner` | ❌ Wave 0 |
| D-03 banner Decline click | Decline click writes `wtcs_consent='decline'`, removes banner | unit | `npm test -- ConsentBanner` | ❌ Wave 0 |
| D-03 banner dismiss `×` | Dismiss without decision: no localStorage write; banner re-shows next mount | unit | `npm test -- ConsentBanner` | ❌ Wave 0 |
| D-04 PostHog gating | `posthog.opt_in_capturing` called on flip to `allow`; `opt_out_capturing` on flip to `decline` | unit | `npm test -- ConsentBanner ConsentChip` | ❌ Wave 0 (rewrite of existing test) |
| D-04 Sentry Replay gating | `loadSentryReplayIfConsented` reads `wtcs_consent` (not `analytics_opted_out`) | unit | `npm test -- sentry` | ⚠️ MODIFY — `src/lib/sentry.ts` test if it exists; update assertion |
| D-04 AuthContext identify gate | `posthog.identify` only called when `consent==='allow' && providerId` | unit (mock posthog) | `npm test -- AuthContext` | ⚠️ MODIFY — existing AuthContext tests if any; add gate test |
| ConsentChip flipped state machine | Allow→`Turn off` link; Decline→`Turn on` link; toggle behavior | unit | `npm test -- ConsentChip` | ⚠️ MODIFY — existing test (covers opt-OUT) needs full rewrite |
| Phase 5 → Phase 6 migration | `analytics_opted_out='true'` AND no `wtcs_consent` → migration sets `wtcs_consent='decline'` | unit | `npm test -- ConsentContext` | ❌ Wave 0 — new file |
| Cross-tab consent sync | `storage` event with `key='wtcs_consent'` triggers re-render | unit (jsdom dispatchEvent) | `npm test -- ConsentContext` | ❌ Wave 0 |
| D-01 breadcrumbs presence | `Sentry.addBreadcrumb` called with `category: 'auth'` at AuthContext mount, getSession resolution, onAuthStateChange, callback rejection, AuthErrorPage render | unit (mock Sentry) | `npm test -- AuthContext routes/auth` | ❌ Wave 0 — new file (or fold into AuthContext.test) |
| D-01 debug overlay DEV-only | In test `import.meta.env.DEV === true` → component imports; in prod build, dist grep shows zero references | grep-based smoke test | `grep -r DebugAuthOverlay dist/` | ❌ Wave 0 — add to verifier checklist |
| D-07 favicon files exist | `public/favicon.ico`, `public/favicon.svg`, `public/apple-touch-icon.png` all present | grep-based smoke test | `ls public/favicon.ico public/favicon.svg public/apple-touch-icon.png` | ❌ Wave 0 — manual verify |
| D-07 favicon links in index.html | All 4 `<link>` tags present in correct order | grep-based smoke test | `grep -E "link rel=.icon\|apple-touch" index.html` | ❌ Wave 0 — manual verify |
| D-10 title + meta description | `<title>WTCS Community Suggestions</title>`; `<meta name="description"...>` present and ≤160 chars | grep-based smoke test | `grep -E "<title>\|name=.description" index.html` | ❌ Wave 0 — manual verify |
| D-08 Sentry symbolication | Sentry dashboard issue shows un-minified function names | manual-only | (open Sentry UI, capture screenshot) | manual — log in `06-VERIFICATION.md::human_verification:` |
| D-09 REQUIREMENTS sync | Top-section checkboxes + bottom-section traceability table agree | grep-based audit | scripted check (parse markdown) | ❌ Wave 0 — verifier task |
| D-02 manual auth repro | All 4 steps tried in user's main browser | manual-only | (user-driven) | manual — first plan task per D-02 |

### Sampling Rate

- **Per task commit:** `npm test -- <touched_files_pattern>` (sub-second feedback for unit tests)
- **Per wave merge:** `npm test` (full Vitest suite) + `npm run e2e -- --grep @smoke` (Phase 5 smoke set)
- **Phase gate:** `npm test && npm run e2e` (full unit + E2E suites green) BEFORE `/gsd-verify-work`. ALSO: production deploy gate — verify favicon renders in browser tab, `<title>` appears in tab title bar, Sentry symbolication produces a clean stack trace.

### Wave 0 Gaps

- [ ] `src/__tests__/components/ConsentBanner.test.tsx` — covers D-03 (banner first-visit, Allow, Decline, dismiss, hidden after decision)
- [ ] `src/__tests__/contexts/ConsentContext.test.tsx` — covers consent state read, write, cross-tab sync, Phase 5 migration
- [ ] `src/__tests__/hooks/useConsent.test.tsx` — covers hook contract, throws outside provider
- [ ] `src/__tests__/components/ConsentChip.test.tsx` — REWRITE existing file for inverted state machine (D-04)
- [ ] `src/__tests__/contexts/AuthContext.test.tsx` — add test for `posthog.identify` consent gate (or extend if exists)
- [ ] `src/__tests__/lib/sentry-replay.test.ts` (or update existing sentry test) — assert `wtcs_consent` is read, not `analytics_opted_out`
- [ ] No new Playwright spec required — banner is non-blocking and doesn't gate user journeys; existing `@smoke` set still passes (verify ConsentChip's `/admin/*` hidden behavior in `admin-create.spec.ts` continues to work)
- [ ] Framework install: NONE — Vitest + RTL + Playwright all already wired (Phase 1 + Phase 5)

### Phase Acceptance Criteria (proof of success)

A reviewer should be able to confirm Phase 6 succeeded by checking:

1. **Auth bug**: Sentry breadcrumbs appear in any captured Sentry issue with `category: 'auth'` at the 5 instrumentation points. `?debug=auth` overlay in DEV opens and shows session/cookies/localStorage/breadcrumbs/errors panels. Manual D-02 reproduction either resolves the symptom or is captured in a follow-up note.
2. **GDPR opt-IN**: First page-load in a fresh browser shows the banner. Network tab shows ZERO requests to `*.posthog.com` (capture endpoint) and ZERO `*.sentry.io/api/.../envelope/` Replay events before clicking Allow. After clicking Allow, both flows resume. After clicking Decline, neither flow resumes (Replay leak limitation in Pitfall 7 documented). PostHog dashboard shows new sessions only with Discord-snowflake `distinct_id`s.
3. **Favicon**: Browser tab in Chrome, Firefox, Safari shows the WTCS mark (not Vite atom). iOS home-screen "Add to Home Screen" produces a 180×180 WTCS icon. Dark-mode browser chrome (macOS dark mode) renders the favicon with adequate contrast.
4. **Title + meta**: `<title>` reads "WTCS Community Suggestions" in the browser tab. `<meta name="description">` is present and ≤160 chars. View-source confirms.
5. **Sentry symbolication**: Open the deliberate-error issue in Sentry dashboard. Stack trace shows un-minified function names and source-map-resolved line numbers. Screenshot attached to `06-VERIFICATION.md::human_verification:`. Deliberate-error trigger reverted in the same merge.
6. **REQUIREMENTS**: `git diff REQUIREMENTS.md` shows N checkboxes flipped from `[ ]` to `[x]` AND the corresponding traceability rows flipped from `Pending` to `Complete`. Each flip cites evidence in plan summary or commit body.

## Security Domain

> Phase 6 covers consent UI + auth diagnostic + static asset polish. Security ASVS categories that apply:

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes (read-only — no auth code change in v1.0) | Existing Supabase Discord OAuth + 2FA gate (Phase 1 + Phase 3); Phase 6 only adds breadcrumbs |
| V3 Session Management | yes (read-only — debug overlay surfaces session shape but never exfiltrates) | Token truncation in debug overlay (UI-SPEC: first 8 chars + `…`); DEV-only build gating |
| V4 Access Control | yes | ConsentChip hidden on `/admin/*` (existing); banner same gate (UI-SPEC); no privilege change |
| V5 Input Validation | yes (`?debug=auth` query param) | The query param is a boolean check (`searchParams.get('debug') === 'auth'`) — no string interpolation, no injection surface |
| V6 Cryptography | no | None hand-rolled; all crypto delegated to Supabase Auth + browser TLS |
| V7 Errors & Logging | yes | Sentry breadcrumbs MUST NOT contain PII (no email, no Discord username, no token bodies). Verify in code review. |
| V8 Data Protection | yes | localStorage `wtcs_consent` is non-PII (binary preference). Token truncation in debug overlay. |
| V9 Communications | yes | Sentry/PostHog ingest endpoints already covered by deferred CSP (Phase 5 `netlify.toml` comment); no change in Phase 6 |
| V12 Files and Resources | yes | Favicon files served from `public/` via Netlify; standard CDN headers; no execution surface |
| V14 Configuration | yes | `import.meta.env.DEV` gate prevents debug overlay from shipping; `respect_dnt: true` in PostHog config respects browser DNT signal |

### Known Threat Patterns for Phase 6 surface

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Debug overlay leaks tokens to screenshots | Information Disclosure | Truncate to 8 chars + `…` (UI-SPEC); DEV-only build gate; document the no-screenshot-of-overlay convention |
| Consent state spoofed via DevTools localStorage edit | Tampering | Accept — user-agent state is by definition under user control. The threat model is the user themselves; spoofing only affects their own analytics record. |
| `?debug=auth` enabled in prod via build misconfig | Information Disclosure | Two-layer defense: `import.meta.env.DEV` literal + dynamic import (Pitfall 3); verifier grep on `dist/` |
| Sentry breadcrumb leaks Discord user info | Information Disclosure | Breadcrumbs `data` field MUST NOT include `email`, `username`, `discriminator`, full token. Phase 5 D-13 PII rules carry forward. |
| Favicon URL malformed → 404 cascades | Denial of Service (low) | All 4 `<link>` href paths verified manually; Netlify serves `public/` files by default |
| Banner click hijacked by overlay extension | Tampering | UI-SPEC requires non-blocking banner (no scrim, no z-index above modal layer); accept extension-level UX risk |
| Consent flip race causes events to be sent before opt-out | Information Disclosure | `posthog.opt_out_capturing()` is synchronous and clears queued events (PostHog docs); accept the synchronous flip as sufficient |

## Sources

### Primary (HIGH confidence)
- [PostHog Controlling Data Collection](https://posthog.com/docs/privacy/data-collection) — `opt_out_capturing_by_default`, `opt_out_persistence_by_default`, `respect_dnt`
- [PostHog GDPR compliance docs](https://posthog.com/docs/privacy/gdpr-compliance) — opt-IN banner pattern
- [Sentry React Breadcrumbs](https://docs.sentry.io/platforms/javascript/guides/react/enriching-events/breadcrumbs/) — `addBreadcrumb` API + level options
- [Sentry Breadcrumbs Interface (Developer Docs)](https://develop.sentry.dev/sdk/data-model/event-payloads/breadcrumbs/) — six-key constraint (type/category/message/level/timestamp/data)
- [Supabase Auth — third-party cookies discussion](https://github.com/orgs/supabase/discussions/22072) — Supabase Auth uses 1st-party storage
- [Supabase Auth — access_token in local storage discussion](https://github.com/orgs/supabase/discussions/21824) — browser SDK default storage
- [Supabase PKCE flow docs](https://supabase.com/docs/guides/auth/sessions/pkce-flow) — `*-code-verifier` localStorage key behavior
- [Supabase Auth issue #2099](https://github.com/supabase/auth/issues/2099) — empty code_verifier failure mode
- [MDN: Window storage event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event) — cross-tab localStorage sync
- [web.dev Adaptive Favicon](https://web.dev/articles/building/an-adaptive-favicon) — embedded CSS in SVG for dark mode

### Secondary (MEDIUM confidence)
- [PostHog issue #1547](https://github.com/PostHog/posthog-js/issues/1547) — `has_opted_out_capturing` semantics changed in PR #1176
- [PostHog issue #2841](https://github.com/PostHog/posthog-js/issues/2841) — `opt_out_capturing_by_default` + cookieless mode interaction
- [PostHog issue #18898](https://github.com/PostHog/posthog/issues/18898) — opting out affects feature flags
- [tomayac.com prefers-color-scheme SVG favicons](https://blog.tomayac.com/2019/09/21/prefers-color-scheme-in-svg-favicons-for-dark-mode-icons/) — dark-mode SVG favicon pattern
- [SVG Favicon browser support](https://faviconbuilder.com/guides/svg-favicon-browser-support/) — Safari 15.6+ support
- [realfavicongenerator.net guides](https://realfavicongenerator.net/favicon-guides/understanding-favicon-elements) — apple-touch-icon 180×180 single-size since iOS 8

### Tertiary (LOW confidence — informational)
- [Privacy Sandbox update on third-party cookies](https://privacysandbox.google.com/blog/update-on-the-plan-for-phase-out-of-third-party-cookies-on-chrome) — 2024 reversal
- [OneTrust on Privacy Sandbox shutdown](https://www.onetrust.com/blog/google-drops-plans-for-third-party-cookie-choice-prompt-in-chrome/) — 2025 confirmation
- [Adweek on Privacy Sandbox death](https://www.adweek.com/media/googles-privacy-sandbox-is-officially-dead/) — context for CONTEXT.md D-02 step 3 framing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and version-locked; PostHog opt-IN config and Sentry breadcrumbs API verified against official docs
- Architecture: HIGH — patterns mirror existing Phase 5 implementation (`loadSentryReplayIfConsented`, ConsentChip placement); minimal novelty
- Pitfalls: MEDIUM-HIGH — Pitfall 4 (PKCE code_verifier) is the strongest hypothesis but UNVERIFIED in the user's actual environment; the rest are well-documented landmines
- GDPR pattern (PostHog opt-IN): HIGH — directly verified against PostHog official docs
- Favicon dark-mode: MEDIUM — embedded-CSS approach verified; Safari behavior (OS preference vs browser preference) noted as a known quirk
- Auth bug differential: MEDIUM — diagnose-first scope is correct, root cause hypothesis (A1) is informed but not confirmed

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (30 days for stable). Auth-bug hypotheses (A1) should be re-validated against actual repro evidence captured during D-01 execution; if repro shows a different signal, Pitfall 4 may not be the primary failure mode.
