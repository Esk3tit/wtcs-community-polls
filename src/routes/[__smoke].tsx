/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense } from 'react'
import { createFileRoute, notFound } from '@tanstack/react-router'

interface SmokeSearch {
  render?: '1'
}

const RenderThrowSmoke = lazy(() =>
  import('@/components/debug/RenderThrowSmoke').then(m => ({
    default: m.RenderThrowSmoke,
  }))
)

export const Route = createFileRoute('/__smoke')({
  // TanStack's default search parser is parseSearchWith(JSON.parse), which
  // coerces a bare `?render=1` to the number 1. Accept both forms.
  validateSearch: (search: Record<string, unknown>): SmokeSearch => {
    const r = search.render
    if (r === '1' || r === 1) return { render: '1' }
    return {}
  },
  beforeLoad: () => {
    if (import.meta.env.VITE_NETLIFY_CONTEXT === 'production') {
      throw notFound()
    }
  },
  component: SmokePage,
})

function SmokePage() {
  const { render } = Route.useSearch()
  if (render !== '1') {
    return (
      <p className="text-sm text-muted-foreground">
        Smoke route. Append <code>?render=1</code> to trigger a render-phase throw.
      </p>
    )
  }
  return (
    <Suspense fallback={null}>
      <RenderThrowSmoke />
    </Suspense>
  )
}
