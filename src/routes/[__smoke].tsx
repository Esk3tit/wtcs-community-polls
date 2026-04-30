// Source: structural analog src/routes/topics.tsx (validateSearch shape)
//       + Context7 /tanstack/router not-found-errors.md (notFound + beforeLoad)
//       + .planning/phases/07-observability-hardening/07-CONTEXT.md D-02..D-06
//       + .planning/phases/07-observability-hardening/07-RESEARCH.md Pattern 3 + 4 + Code Example §E

/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense } from 'react'
import { createFileRoute, notFound } from '@tanstack/react-router'

interface SmokeSearch {
  render?: '1'
}

// Phase 7 D-03: lazy-loaded so the smoke chunk only downloads when someone
// visits /__smoke?render=1. autoCodeSplitting in vite.config.ts handles the
// chunk boundary for free. Named export → lazy default-shim per
// RESEARCH Pattern 5 + Pattern 3.
const RenderThrowSmoke = lazy(() =>
  import('@/components/debug/RenderThrowSmoke').then(m => ({
    default: m.RenderThrowSmoke,
  }))
)

export const Route = createFileRoute('/__smoke')({
  // Phase 7 hotfix (PR #21 deploy-preview verification): TanStack Router's
  // default search parser uses parseSearchWith(JSON.parse), which coerces
  // the URL value `1` to the JS number 1 — strict `=== '1'` (string) is
  // therefore always false and ?render=1 silently falls through to the
  // inert hint paragraph. String() coerce accepts both 1 (number) and '1'
  // (URL-encoded JSON string) — matches the URL the docs (ROADMAP SC #1,
  // 07-CONTEXT D-05) tell users to visit.
  validateSearch: (search: Record<string, unknown>): SmokeSearch =>
    String(search.render) === '1' ? { render: '1' } : {},
  // Phase 7 D-04 + D-06: live prod returns a standard 404 — the route
  // appears not to exist. VITE_NETLIFY_CONTEXT is populated from Netlify's
  // built-in $CONTEXT in netlify.toml's build command (Plan 01 Task 2).
  // For local dev (`npm run dev`) the env var is undefined → guard
  // evaluates false → smoke is reachable. Matches D-04 ("non-prod = preview
  // + branch + dev").
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
