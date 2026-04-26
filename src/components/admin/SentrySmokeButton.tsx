// Phase 6 D-08 (R-02): Deploy-preview-only Sentry symbolication smoke.
// This file MUST NEVER be merged to main. The branch `phase6-d08-smoke`
// is created, pushed (Netlify auto-builds a deploy preview), used for
// verification, then DELETED — local AND remote. Acceptance criteria
// assert `git log main` shows zero `sentry-smoke` references.
//
// Why render-phase throw (not useEffect): React's ErrorBoundary contract
// guarantees catch for render/lifecycle errors. Effect errors are async
// and may bypass ErrorBoundary, defeating the verification (Codex review
// R-02). A render-phase throw exercises the SAME path a real production
// render error would take, giving direct evidence that the
// ErrorBoundary → AppErrorFallback → Sentry chain symbolicates correctly.
//
// Search-param read: the parent /admin/ route's validateSearch strips
// unknown params, so we cannot use useSearch() to detect ?sentry-smoke=1.
// We read window.location.search directly — this preserves render-phase
// throw semantics AND is invisible to the route's typed search contract.

export function SentrySmokeButton() {
  if (
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('sentry-smoke') === '1'
  ) {
    // Render-phase throw — caught reliably by Sentry.ErrorBoundary in main.tsx.
    throw new Error('Sentry sourcemap smoke — Phase 6 D-08 (deploy preview only)')
  }
  return null
}
