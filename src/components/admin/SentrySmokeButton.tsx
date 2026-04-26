// Phase 6 D-08 (R-02): Deploy-preview-only Sentry symbolication smoke.
// This file MUST NEVER be merged to main. The branch `phase6-d08-smoke`
// is created, pushed (Netlify auto-builds a deploy preview), used for
// verification, then DELETED — local AND remote.
//
// IMPLEMENTATION NOTE — diverged from R-02's render-phase guidance:
// Sentry React SDK v10 + React 19's render-error path catches the throw at
// Sentry.ErrorBoundary (AppErrorFallback renders) BUT does not actually
// transmit the captured event to Sentry's server in our config. Verified
// empirically against deploy-preview-16: render-phase throws produce zero
// Sentry events even with a confirmed-working DSN. We pivot to an event-
// handler throw inside a NAMED function so:
//   - Stack frame top is `fireSentrySmoke`, sourcemap-resolvable
//   - Throw escapes ErrorBoundary entirely (event handlers are not in its
//     catch contract — see React docs)
//   - Sentry's globalHandlersIntegration captures the uncaught error and
//     ships it through the proven transport path (verified earlier with
//     setTimeout-throw landing in Sentry)
//
// The render-phase approach was tried first and is in git history as commit
// d8c02ba — kept here as a comment for the post-mortem.

function fireSentrySmoke(): never {
  throw new Error('Sentry sourcemap smoke — Phase 6 D-08 (deploy preview only)')
}

export function SentrySmokeButton() {
  if (
    typeof window === 'undefined' ||
    new URLSearchParams(window.location.search).get('sentry-smoke') !== '1'
  ) {
    return null
  }
  return (
    <button
      type="button"
      data-testid="sentry-smoke-trigger"
      onClick={fireSentrySmoke}
      style={{
        position: 'fixed',
        bottom: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        padding: '0.5rem 1rem',
        background: '#dc2626',
        color: 'white',
        border: 'none',
        borderRadius: '0.5rem',
        cursor: 'pointer',
      }}
    >
      Trigger Sentry smoke
    </button>
  )
}
