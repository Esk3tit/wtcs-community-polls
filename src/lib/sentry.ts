import * as Sentry from '@sentry/react'

// Replay is intentionally absent from Sentry.init's integrations and lazily
// attached here so opted-out users never download the ~40KB Replay bundle.
// Replay is dynamic-imported through the isolated ./sentry-replay re-export
// module: importing '@sentry/react' directly here would collide with main.tsx's
// static import and collapse Replay back into the main chunk.
let replayLoaded = false

/**
 * Lazily attaches Sentry Replay when the user has explicitly opted in via the
 * consent flow. Idempotent. No-op when already loaded, outside the browser,
 * not opted in, or no Sentry client. Error capture is never gated — only Replay.
 */
export async function loadSentryReplayIfConsented(): Promise<void> {
  if (replayLoaded || typeof window === 'undefined') return
  const consent = window.localStorage.getItem('wtcs_consent')
  if (consent !== 'allow') return
  const client = Sentry.getClient()
  if (!client) return
  // Flip the flag synchronously before awaiting so concurrent callers
  // (StrictMode double-invoke) short-circuit instead of racing into
  // addIntegration(). Roll back on failure so retry can succeed.
  replayLoaded = true
  try {
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
