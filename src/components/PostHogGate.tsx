// Consent gate for lazy PostHog loading.
//
// CRITICAL STRUCTURAL INVARIANT: {children} is a SIBLING of the <Suspense>
// boundary, NOT a descendant. When state !== 'allow', the lazy loader is simply
// not rendered — posthog-js is never fetched. When state flips to 'allow', the
// loader mounts as a side-effect sibling: <Suspense fallback={null}> can only
// replace <LazyPostHogLoader /> (which renders null anyway) with null — the
// router in {children} is completely unaffected. This is the fix for the
// verified defect where nesting children inside the suspending component caused
// the entire router subtree to blank/remount during the lazy-import window.
import { lazy, Suspense, type ReactNode } from 'react'
import * as Sentry from '@sentry/react'
import { useConsent } from '@/hooks/useConsent'

// Declared at module scope so React.lazy deduplicates the import across renders.
// Declaring it inside the component body would recreate the reference every
// render, defeating React.lazy's built-in dedup and triggering repeated fetches.
//
// The dynamic import() can reject on its own (chunk fetch / CDN / network
// failure) before initPostHog even runs. An unguarded rejection would propagate
// through Suspense to the app-root error boundary and blank the entire app over
// a non-critical analytics concern. Catch it, report to Sentry, and resolve to a
// no-op component so the app keeps rendering without analytics this session.
const LazyPostHogLoader = lazy(() =>
  import('@/components/PostHogProviderInner')
    .then((m) => ({ default: m.PostHogProviderInner }))
    .catch((err) => {
      // Log locally too (symmetry with PostHogProviderInner's init catch): when
      // the Sentry DSN is unset (dev), Sentry.captureException leaves no signal.
      console.error('[posthog] lazy loader import failed; analytics disabled this session', err)
      Sentry.captureException(err)
      return { default: () => null }
    }),
)

export function PostHogGate({ children }: { children: ReactNode }) {
  const { state } = useConsent()
  return (
    <>
      {children}
      {state === 'allow' && (
        <Suspense fallback={null}>
          <LazyPostHogLoader />
        </Suspense>
      )}
    </>
  )
}
