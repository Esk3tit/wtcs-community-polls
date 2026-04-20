import * as Sentry from '@sentry/react'

// M1 resolution: Sentry Replay is not included in the initial Sentry.init()
// integrations array. This helper lazily attaches Replay via addIntegration()
// after the user's consent has been evaluated via localStorage. Users who
// have opted out never see Replay attached to their session.
//
// M3 / ME-02 (Phase 5 review) resolution: Replay is code-split via the
// dedicated re-export module at ./sentry-replay. Because that module is ONLY
// dynamically imported (never statically), Rolldown places it in its own
// chunk and the ~40 KB replayIntegration code is not shipped to opt-out
// users. The main chunk still statically imports @sentry/react for
// Sentry.init + Sentry.ErrorBoundary — tree-shaking keeps replayIntegration
// out of that import.
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
  // ME-02 (Phase 5 review): dynamic-import via the isolated re-export module
  // so Rolldown actually code-splits replayIntegration into its own chunk.
  // Importing '@sentry/react' directly here produced an
  // INEFFECTIVE_DYNAMIC_IMPORT warning because main.tsx also imports it
  // statically, collapsing Replay into the main bundle.
  const { replayIntegration } = await import('./sentry-replay')
  client.addIntegration(
    replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  )
  replayLoaded = true
}
