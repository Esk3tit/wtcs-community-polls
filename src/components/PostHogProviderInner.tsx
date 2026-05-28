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
import { initPostHog } from '@/lib/posthog'
import { posthog } from '@/lib/posthog-facade'

const client = initPostHog()
posthog.setClient(client)

export function PostHogProviderInner() {
  return null
}
