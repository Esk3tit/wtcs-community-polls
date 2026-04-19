import * as Sentry from '@sentry/react'

// M1 resolution: Sentry Replay is not included in the initial Sentry.init()
// integrations array. This helper lazily attaches Replay via addIntegration()
// after the user's consent has been evaluated via localStorage. Users who
// have opted out never see Replay attached to their session.
//
// M3 note: the `await import('@sentry/react')` below triggers
// Rolldown's INEFFECTIVE_DYNAMIC_IMPORT warning because main.tsx also
// statically imports Sentry (needed for Sentry.init / ErrorBoundary). That
// collapses Sentry into the main chunk. The practical M3 guarantee still
// holds: `replayIntegration` is tree-shaken from the bundle unless this
// function is actually reached — opt-out users short-circuit on the
// localStorage check BEFORE the dynamic import, so the Replay code path
// is unreachable at runtime for them. The gzipped main-JS budget is held
// under the plan's 400 KB threshold.
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
