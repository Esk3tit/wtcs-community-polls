import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import * as Sentry from '@sentry/react'
import { PostHogProvider } from 'posthog-js/react'
import { initPostHog } from '@/lib/posthog'
import { ConsentProvider } from '@/contexts/ConsentContext'
import { AppErrorFallback } from '@/components/AppErrorFallback'
import { routeTree } from './routeTree.gen'
import './index.css'

// HIGH #1 (codex review): NO app-wide preload default on the router
// (intentionally omitted from createRouter call below). Per-link opt-in only
// happens in Plan 05-04 on Topics/Archive links. Rationale: the admin route's
// beforeLoad redirects non-admins on hover, which would fire on intent-preload.
// Explicit preload="intent" on user-facing links only is safer
// (05-RESEARCH.md Pitfall 6).
//
// M1 (codex review): Sentry.init does NOT include the Replay integration here.
// Replay is lazily attached by ConsentChip's mount effect via
// src/lib/sentry.ts::loadSentryReplayIfConsented() AFTER the localStorage
// opt-out check. Users who opt out never load the Replay bundle — also
// code-splits Replay from the main bundle (M3 mitigation).
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_COMMIT_SHA,
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.1,
  // Replay sample rates stay set so that when Replay is later attached via
  // addIntegration(), it honors these values:
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
})

const posthog = initPostHog()

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<AppErrorFallback />} showDialog={false}>
      <PostHogProvider client={posthog}>
        {/* HI-01 (Phase 5 review): ConsentChip was previously rendered here as
            a SIBLING of RouterProvider. That meant ConsentChip's
            `useRouterState()` call had no router context (TanStack Router's
            context is propagated only to descendants of RouterProvider). The
            chip now lives inside src/routes/__root.tsx's RootLayout so it
            sits UNDER the router tree AND keeps access to AuthProvider +
            ThemeProvider, while ErrorBoundary + PostHogProvider still wrap
            everything from the outside. */}
        {/* Phase 6 D-04: ConsentProvider sits BETWEEN PostHogProvider (outer)
            and RouterProvider (inner). This positioning means: (a) PostHog is
            already initialized (via initPostHog() above) when ConsentContext
            calls posthog.opt_in_capturing() / opt_out_capturing(), and (b)
            every route under RouterProvider can call useConsent() — including
            the new ConsentBanner + ConsentChip components mounted inside
            __root.tsx. Sentry.init in main.tsx is intentionally NOT gated;
            error capture stays unconditional per D-05. */}
        <ConsentProvider>
          <RouterProvider router={router} />
        </ConsentProvider>
      </PostHogProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
