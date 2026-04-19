import posthog from 'posthog-js'

// Module-scope guard prevents StrictMode double-init in dev (05-RESEARCH.md
// Pattern 8 landmine). Safe to call initPostHog() many times.
let initialized = false

/**
 * Initializes PostHog once per page-load. No-op when VITE_POSTHOG_KEY is
 * unset (enables local dev without keys — returns the uninitialized posthog
 * instance, which short-circuits capture calls).
 */
export function initPostHog() {
  if (initialized || typeof window === 'undefined') return posthog
  const key = import.meta.env.VITE_POSTHOG_KEY
  if (!key) return posthog
  posthog.init(key, {
    api_host: 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: 'history_change',
    session_recording: { maskAllInputs: true },
    autocapture: false,
  })
  initialized = true
  return posthog
}

export { posthog }
