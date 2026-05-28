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
import { useConsent } from '@/hooks/useConsent'

// Declared at module scope so React.lazy deduplicates the import across renders.
// Declaring it inside the component body would recreate the reference every
// render, defeating React.lazy's built-in dedup and triggering repeated fetches.
const LazyPostHogLoader = lazy(() =>
  import('@/components/PostHogProviderInner').then((m) => ({
    default: m.PostHogProviderInner,
  })),
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
