import { StrictMode, type ErrorInfo } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import * as Sentry from '@sentry/react'
import { PostHogProvider } from 'posthog-js/react'
import { initPostHog } from '@/lib/posthog'
import { ConsentProvider } from '@/contexts/ConsentContext'
import { AppErrorFallback } from '@/components/AppErrorFallback'
import { routeTree } from './routeTree.gen'
import './index.css'

if (import.meta.env.DEV) {
  if (!import.meta.env.VITE_SENTRY_DSN) {
    console.warn('[sentry] VITE_SENTRY_DSN not set — error monitoring disabled. Set it in .env.local to enable Sentry in dev.')
  } else {
    console.info('[sentry] active', {
      env: import.meta.env.VITE_NETLIFY_CONTEXT || import.meta.env.MODE,
    })
  }
}

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  // Use `||` not `??`: an unset Netlify $CONTEXT shell-substitutes to the empty
  // string, which `??` would forward verbatim as `environment: ""`.
  environment: import.meta.env.VITE_NETLIFY_CONTEXT || import.meta.env.MODE,
  release: import.meta.env.VITE_COMMIT_SHA,
  // Replay is intentionally absent — attached lazily after consent opt-in via
  // `loadSentryReplayIfConsented()` so opted-out users never load the bundle.
  // dedupeIntegration is pinned explicitly: the OBSV-01 capture path emits up
  // to three events per render-phase throw (ErrorBoundary auto-capture +
  // onError belt + onCaughtError → reactErrorHandler), and we rely on Dedupe
  // to collapse them. Pinning protects the contract from silent removal.
  integrations: [Sentry.browserTracingIntegration(), Sentry.dedupeIntegration()],
  tracesSampleRate: 0.1,
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

const container = document.getElementById('root')
if (!container) throw new Error('Root container missing')

// Tag the active scope BEFORE delegating so the boundary tag survives
// Sentry.Dedupe regardless of which path's event is kept (without this, the
// hook event has no boundary tag and dedupe may drop the tagged ErrorBoundary
// event). Pass `undefined` for uncaught so reactErrorHandler reports
// mechanism.handled=false, matching React's own classification.
const taggedHandler = (kind: 'uncaught' | 'caught' | 'recoverable') =>
  (error: unknown, info: ErrorInfo) => {
    Sentry.withScope((scope) => {
      scope.setTag('boundary', 'app-root')
      scope.setTag('react.errorHandlerKind', kind)
      if (import.meta.env.DEV && kind === 'uncaught') {
        console.warn('[sentry] uncaught', error, info.componentStack)
      }
      const cb = kind === 'uncaught' ? undefined : () => {}
      Sentry.reactErrorHandler(cb)(error, info)
    })
  }

createRoot(container, {
  onUncaughtError: taggedHandler('uncaught'),
  onCaughtError: taggedHandler('caught'),
  onRecoverableError: taggedHandler('recoverable'),
}).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={<AppErrorFallback />}
      showDialog={false}
      beforeCapture={(scope) => {
        scope.setTag('boundary', 'app-root')
      }}
      onError={(error: unknown, componentStack: string, eventId: string): void => {
        // eventId goes in `contexts`, not `tags` — high cardinality would
        // blow Sentry's free-tier tag-key index.
        Sentry.captureException(error, {
          tags: { boundary: 'app-root' },
          contexts: {
            react: { componentStack },
            linked_event: { eventId },
          },
        })
      }}
    >
      <PostHogProvider client={posthog}>
        <ConsentProvider>
          <RouterProvider router={router} />
        </ConsentProvider>
      </PostHogProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
