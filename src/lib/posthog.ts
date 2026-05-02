import posthog from 'posthog-js'

// Module-scope guard so StrictMode double-invoke can't double-init PostHog.
let initialized = false

/**
 * Initializes PostHog once per page-load. No-op when VITE_POSTHOG_KEY is
 * unset (enables local dev without keys — returns the uninitialized posthog
 * instance, which short-circuits capture calls).
 */
export function initPostHog() {
  if (initialized || typeof window === 'undefined') return posthog
  const key = import.meta.env.VITE_POSTHOG_KEY
  if (!key) {
    if (import.meta.env.DEV) {
      console.warn(
        '[posthog] VITE_POSTHOG_KEY not set — analytics disabled. Set it in .env.local to enable PostHog in dev.'
      )
    }
    return posthog
  }
  posthog.init(key, {
    api_host: 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: 'history_change',
    session_recording: { maskAllInputs: true },
    autocapture: false,
    // GDPR opt-IN: capture/persistence off until ConsentProvider flips them on.
    opt_out_capturing_by_default: true,
    opt_out_persistence_by_default: true,
    respect_dnt: true,
  })
  // Tag every event so the shared PostHog project (with the sister WTCS Map
  // Vote Ban app) can filter per-app without needing a separate project.
  posthog.register({ app: 'community-polls' })
  initialized = true
  return posthog
}

export { posthog }
