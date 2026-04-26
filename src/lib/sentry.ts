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
 * Lazily attaches Sentry Replay to the running client when the user has
 * explicitly opted IN via the consent flow. Called by ConsentContext's
 * side-effect bridge when state flips to 'allow'.
 *
 * Idempotent — safe to call more than once. No-op when:
 *  - already loaded (replayLoaded flag),
 *  - running outside a browser (SSR/test),
 *  - `wtcs_consent` is not 'allow' in localStorage (Phase 6 D-04 opt-IN gate),
 *  - no Sentry client has been initialized.
 *
 * Sentry ERROR capture (Sentry.init in main.tsx) is NEVER gated — only
 * Replay attach is consent-gated (D-05).
 */
export async function loadSentryReplayIfConsented(): Promise<void> {
  if (replayLoaded || typeof window === 'undefined') return
  // Phase 6 D-04: GDPR opt-IN. Replay is NEVER attached unless the user has
  // explicitly clicked Allow. Single source of truth = localStorage['wtcs_consent'].
  // Sentry ERROR capture remains unconditional (Sentry.init in main.tsx is NOT gated).
  const consent = window.localStorage.getItem('wtcs_consent')
  if (consent !== 'allow') return
  const client = Sentry.getClient()
  if (!client) return
  // Set the flag synchronously BEFORE the await so concurrent callers
  // (e.g. StrictMode double-invoke of a mount effect) short-circuit on the
  // early-return check above instead of both racing into addIntegration().
  // On failure, roll the flag back so a retry can succeed.
  replayLoaded = true
  try {
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
  } catch (err) {
    replayLoaded = false
    throw err
  }
}
