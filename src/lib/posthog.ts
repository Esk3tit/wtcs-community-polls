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
    // Phase 6 D-04: GDPR opt-IN — capture and persistence are OFF by default.
    // ConsentProvider flips them on after the user clicks Allow via posthog.opt_in_capturing().
    opt_out_capturing_by_default: true,
    opt_out_persistence_by_default: true,
    // Phase 6 D-04: honor browser Do-Not-Track at init time as well.
    respect_dnt: true,
  })
  // Shared PostHog project with sibling WTCS Map Vote Ban app — tag every event
  // so dashboards can filter per-app without needing a separate project.
  posthog.register({ app: 'community-polls' })
  initialized = true
  return posthog
}

export { posthog }
