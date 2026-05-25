/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense, useCallback } from 'react'
import { createFileRoute, notFound } from '@tanstack/react-router'
import * as Sentry from '@sentry/react'

interface SmokeSearch {
  render?: '1'
  // Two distinct values so Sentry.dedupeIntegration() does not collapse both
  // scenarios into a single event — each literal message is unique per scenario.
  fire?: 'render' | 'dedupe'
}

const RenderThrowSmoke = lazy(() =>
  import('@/components/debug/RenderThrowSmoke').then(m => ({
    default: m.RenderThrowSmoke,
  }))
)

// Declared outside SmokePage so React's identity check is stable across
// re-renders — avoids the react-hooks/static-components rule violation.
function SmokeFallback() {
  return <p className="text-sm text-muted-foreground">Smoke throw captured.</p>
}

export const Route = createFileRoute('/__smoke')({
  // TanStack's default search parser is parseSearchWith(JSON.parse), which
  // coerces a bare `?render=1` to the number 1. Accept both forms.
  validateSearch: (search: Record<string, unknown>): SmokeSearch => {
    const r = search.render
    const f = search.fire
    const result: SmokeSearch = {}
    if (r === '1' || r === 1) result.render = '1'
    if (f === 'render' || f === 'dedupe') result.fire = f
    return result
  },
  beforeLoad: () => {
    if (import.meta.env.VITE_NETLIFY_CONTEXT === 'production') {
      throw notFound()
    }
  },
  component: SmokePage,
})

function SmokePage() {
  const { render, fire } = Route.useSearch()

  // Surface the captured event ID for human verifiers (DevTools console)
  // and future automation (DOM dataset). Lives on the LOCAL boundary's
  // onError so SmokePage is not unmounted before the write — the
  // app-level boundary in src/main.tsx would replace this whole subtree.
  const surfaceEventId = useCallback(
    (_error: unknown, _componentStack: string, eventId: string) => {
      // eslint-disable-next-line no-console -- intentional eventId surface for smoke verifier
      console.log('[smoke] sentry.eventId', eventId)
      document.body.dataset.sentryEventId = eventId ?? ''
    },
    []
  )

  if (fire === 'render' || fire === 'dedupe') {
    // Literal message strings are load-bearing: Sentry events are filtered by
    // these exact strings in the dashboard. Keep them stable across releases.
    const message = fire === 'render' ? 'OBSV-03 render' : 'OBSV-05 dedupe'
    return (
      <Sentry.ErrorBoundary
        fallback={<SmokeFallback />}
        // Canonical tag mirrors src/main.tsx root boundary so whichever event
        // Sentry.dedupeIntegration() keeps still carries `boundary: app-root`.
        beforeCapture={(scope) => scope.setTag('boundary', 'app-root')}
        onError={surfaceEventId}
      >
        <Suspense fallback={<p className="text-sm text-muted-foreground">Loading smoke component…</p>}>
          <RenderThrowSmoke message={message} />
        </Suspense>
      </Sentry.ErrorBoundary>
    )
  }

  if (render === '1') {
    return (
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading smoke component…</p>}>
        <RenderThrowSmoke />
      </Suspense>
    )
  }

  return (
    <p className="text-sm text-muted-foreground">
      Smoke route. Append <code>?render=1</code> to trigger a render-phase throw,{' '}
      <code>?fire=render</code> for a render smoke, or{' '}
      <code>?fire=dedupe</code> for a dedupe smoke.
    </p>
  )
}
