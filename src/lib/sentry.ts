import * as Sentry from '@sentry/react'

// M1 resolution: Sentry Replay is not included in the initial Sentry.init()
// integrations array. This helper lazily attaches Replay via addIntegration()
// after the user's consent has been evaluated via localStorage. Users who
// have opted out never load the replay bundle — satisfies M1 (no pre-consent
// capture) and M3 (replay code is dynamic-imported so it code-splits away
// from the main bundle).
let replayLoaded = false

/**
 * Lazily attaches Sentry Replay to the running client when the user has NOT
 * opted out of analytics. Called from ConsentChip's mount effect AFTER the
 * localStorage consent check.
 *
 * Idempotent — safe to call more than once. No-op when:
 *  - already loaded (replayLoaded flag),
 *  - running outside a browser (SSR/test),
 *  - `analytics_opted_out` flag is set in localStorage,
 *  - no Sentry client has been initialized.
 */
export async function loadSentryReplayIfConsented(): Promise<void> {
  if (replayLoaded || typeof window === 'undefined') return
  // Phase 5 semantics (UI-SPEC Contract 3):
  //  - `posthog_consent_chip_dismissed` = chip is hidden (user has seen it)
  //  - `analytics_opted_out` = user explicitly chose "Opt out"
  // Only the explicit opt-out blocks Replay. Plain dismissal via X is accept.
  const optedOut = window.localStorage.getItem('analytics_opted_out') === 'true'
  if (optedOut) return
  const client = Sentry.getClient()
  if (!client) return
  const { replayIntegration } = await import('@sentry/react')
  client.addIntegration(
    replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  )
  replayLoaded = true
}
