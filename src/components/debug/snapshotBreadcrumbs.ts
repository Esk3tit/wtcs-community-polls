import * as Sentry from '@sentry/react'

// Sentry v10: Sentry.addBreadcrumb writes to the isolation scope by default,
// so reading only getCurrentScope() returns an empty list even when
// breadcrumbs are present. Mirror what the client does on event-send: merge
// global + isolation + current, sort by timestamp ascending, return the
// most recent 5.
//
// Lives in its own file (not co-located with DebugAuthOverlay.tsx) so the
// component file remains a single-export module — required by the
// react-refresh/only-export-components ESLint rule for HMR. Same precedent
// as the 260421-vxb fix.
export function snapshotBreadcrumbs(): unknown[] {
  const all = [
    ...(Sentry.getGlobalScope().getScopeData().breadcrumbs ?? []),
    ...(Sentry.getIsolationScope().getScopeData().breadcrumbs ?? []),
    ...(Sentry.getCurrentScope().getScopeData().breadcrumbs ?? []),
  ]
  all.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
  return all.slice(-5).map((b) => ({
    category: b.category,
    message: b.message,
    level: b.level,
    timestamp: b.timestamp,
    data: b.data,
  }))
}
