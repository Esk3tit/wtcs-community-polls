// This module is the SINGLE runtime-import site for posthog-js (via @/lib/posthog).
// It is loaded lazily by PostHogGate only after the user has given consent, so
// posthog-js never appears in the critical-path bundle for non-consenting users.
//
// Module-scope side effects run exactly once per page-load when the lazy chunk
// first resolves: initPostHog() initialises the posthog-js client, then
// posthog.setClient() bridges the real client into the facade and drains any
// calls that queued while the chunk was in flight.
//
// The component renders null because nothing in this app calls usePostHog() —
// there are no React-context consumers, so wrapping children (which would
// introduce a Suspense remount risk) is both unnecessary and harmful.
import * as Sentry from '@sentry/react'
import { initPostHog } from '@/lib/posthog'
import { posthog } from '@/lib/posthog-facade'

// posthog-js .init() touches localStorage, cookies, and navigator — any of which
// can throw in locked-down/private-mode browsers. An unguarded throw here would
// reject the dynamic import() and propagate to the app-root error boundary,
// blanking the entire app over a non-critical analytics concern. Degrade
// gracefully instead: log and continue without analytics this session.
try {
  const client = initPostHog()
  // posthog-js initialises opted-OUT (opt_out_capturing_by_default). The facade
  // queue may already hold an identify() and/or opt_in_capturing() that other
  // subtrees enqueued while this chunk was loading; if setClient() drains them
  // while the client is still opted out, a queued identify() no-ops and the
  // session's first identify is lost. Opting in HERE — before the drain —
  // guarantees any queued call lands on an opted-in client regardless of enqueue
  // order. This component only mounts when consent === 'allow', so the persisted
  // flag is authoritative.
  if (window.localStorage.getItem('wtcs_consent') === 'allow') {
    client.opt_in_capturing()
  }
  posthog.setClient(client)
} catch (err) {
  console.error('[posthog] init failed; analytics disabled this session', err)
  Sentry.captureException(err)
}

export function PostHogProviderInner() {
  return null
}
