// Isolated re-export so Rolldown code-splits replayIntegration into its own
// chunk. Reachable ONLY via dynamic import from src/lib/sentry.ts — importing
// statically anywhere collapses the ~40KB Replay code into the main bundle.
export { replayIntegration } from '@sentry/react'
