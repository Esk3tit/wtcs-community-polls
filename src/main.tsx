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
// IN-01 (Phase 7 review-fix iteration 2 — info-level): emit a positive
// confirmation in DEV when the DSN IS set, so a developer wondering "is
// Sentry on?" doesn't have to inspect the Network tab. The negative warn
// already existed; this is its symmetric counterpart.
if (import.meta.env.DEV) {
  if (!import.meta.env.VITE_SENTRY_DSN) {
    console.warn(
      '[sentry] VITE_SENTRY_DSN not set — error monitoring disabled. Set it in .env.local to enable Sentry in dev.'
    )
  } else {
    console.info('[sentry] active', {
      env: import.meta.env.VITE_NETLIFY_CONTEXT || import.meta.env.MODE,
    })
  }
}
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  // Phase 7 OBSV-01: distinguish deploy-preview from production for D-08 evidence (review round-2 HIGH-1 fix).
  // VITE_NETLIFY_CONTEXT comes from netlify.toml [build].command shell substitution of $CONTEXT
  // (Plan 01 Task 2). On local `npm run dev` and `vitest`, the variable is undefined → falls back
  // to import.meta.env.MODE so the dev/test experience is unchanged.
  // WR-03 (Phase 7 review-fix iteration 1): use `||` (truthy fallback), not `??`.
  // Shell substitution of an unset $CONTEXT yields the literal empty string
  // (`VITE_NETLIFY_CONTEXT=`), which `??` treats as defined and forwards to
  // Sentry as `environment: ""`. `||` falls through empty strings to MODE,
  // which gives Sentry a sane environment label even on a misconfigured
  // branch deploy or a non-Netlify CI accidentally re-using netlify.toml.
  environment: import.meta.env.VITE_NETLIFY_CONTEXT || import.meta.env.MODE,
  release: import.meta.env.VITE_COMMIT_SHA,
  // WR-02 (Phase 7 review-fix iteration 1): dedupeIntegration is normally
  // included in Sentry's defaultIntegrations, but adding it explicitly here
  // makes the contract auditable. The OBSV-01 capture path fires up to three
  // events for one render-phase throw (ErrorBoundary auto-capture +
  // ErrorBoundary onError belt + createRoot.onCaughtError → reactErrorHandler);
  // Dedupe collapses near-duplicates between paths that share stack/message.
  // Pinning the integration here protects the contract from silent removal
  // in a future SDK upgrade.
  integrations: [Sentry.browserTracingIntegration(), Sentry.dedupeIntegration()],
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

const container = document.getElementById('root')
if (!container) throw new Error('Root container missing')

// Phase 7 OBSV-01: React 19 createRoot error hooks. Without these,
// render-phase errors caught by React's reconciler hit React's default
// handler (console-only) and never reach Sentry's transport. Phase 6
// confirmed this empirically — only setTimeout/onerror mechanism types
// ever landed on production Sentry events.
//
// Round-2 review MEDIUM-5 (Cursor): each hook is wrapped in a
// tagged-handler factory that sets `boundary='app-root'` on the active
// scope BEFORE delegating to Sentry.reactErrorHandler(). This guarantees
// the boundary tag is on the SDK event from the hook path, so when
// Sentry.Dedupe collapses near-duplicates between this path and the
// ErrorBoundary path, the surviving event always carries the boundary
// tag — regardless of which path's event is kept. Without this wrapping,
// dedupe could keep the hook event (no boundary tag) and drop the
// ErrorBoundary event (which has the tag via beforeCapture).
//
// Round-3 review (Cursor): confirmed reactErrorHandler(callback) is
// ADDITIVE — it always runs captureReactException first then invokes
// the callback after (see node_modules/@sentry/react/build/esm/error.js
// lines 90-105 + JSDoc in error.d.ts). The empty inner callback for
// caught/recoverable paths therefore does NOT silence default capture.
//
// Round-4 review WR-01 fix (Phase 7 review-fix iteration 1):
// reactErrorHandler(callback) sets `mechanism.handled = !!callback`
// (see node_modules/@sentry/react/build/esm/error.js:96-100). Passing a
// non-null callback for the `uncaught` kind would mis-flag uncaught
// errors as handled, polluting Sentry's release-health crash-free-sessions
// metric and the handled/unhandled UI badge. Fix: pass `undefined` for
// uncaught (mechanism.handled=false), keep the callback for caught/
// recoverable (mechanism.handled=true). The dev-warn for uncaught moves
// outside reactErrorHandler so the log still fires.
//
// Research: .planning/research/v1.1-SENTRY-ERRORBOUNDARY.md
const taggedHandler = (kind: 'uncaught' | 'caught' | 'recoverable') =>
  (error: unknown, info: ErrorInfo) => {
    Sentry.withScope((scope) => {
      scope.setTag('boundary', 'app-root')
      scope.setTag('react.errorHandlerKind', kind)
      if (import.meta.env.DEV && kind === 'uncaught') {
        console.warn('[sentry] uncaught', error, info.componentStack)
      }
      // WR-01: only the caught/recoverable paths pass a callback so that
      // mechanism.handled mirrors React's own classification. Uncaught
      // errors must report mechanism.handled=false. The callback's actual
      // signature is (err, errInfo, eventId) but we ignore all three —
      // it's a no-op that exists solely to flip mechanism.handled to true.
      const cb =
        kind === 'uncaught'
          ? undefined
          : () => {
              /* additive no-op — keeps mechanism.handled=true */
            }
      Sentry.reactErrorHandler(cb)(error, info)
    })
  }

createRoot(container, {
  onUncaughtError: taggedHandler('uncaught'),
  onCaughtError: taggedHandler('caught'),
  onRecoverableError: taggedHandler('recoverable'),
}).render(
  <StrictMode>
    {/* Phase 7 OBSV-01: onError belt is defense-in-depth — explicitly
        tags the event with boundary='app-root' and
        contexts.react.componentStack so Sentry triage can distinguish
        app-root catches from any future per-route boundaries. beforeCapture
        ensures the boundary='app-root' tag lands on the SDK's own
        ErrorBoundary event (which Sentry.Dedupe deduplicates with the
        onCaughtError event — the tagged-handler factory above guarantees
        the tag is on the hook path's event too, so the surviving deduped
        event always carries the tag regardless of which path deduped).
        The manual onError belt (captureException) is kept as
        defense-in-depth fallback in case dedup removes the SDK event
        instead (Pitfall 5). */}
    <Sentry.ErrorBoundary
      fallback={<AppErrorFallback />}
      showDialog={false}
      beforeCapture={(scope) => {
        scope.setTag('boundary', 'app-root')
      }}
      onError={(error: unknown, componentStack: string, eventId: string): void => {
        Sentry.captureException(error, {
          tags: { boundary: 'app-root', eventId },
          contexts: { react: { componentStack } },
        })
      }}
    >
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
