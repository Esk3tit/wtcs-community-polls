// ME-02 (Phase 5 review): isolated re-export module for Sentry Replay.
//
// src/main.tsx imports @sentry/react statically (for Sentry.init and
// Sentry.ErrorBoundary), which is what triggered Rolldown's
// INEFFECTIVE_DYNAMIC_IMPORT warning when sentry.ts ALSO tried to
// `await import('@sentry/react')` — the bundler collapsed the module
// (including replayIntegration, ~40 KB) into the main chunk.
//
// By re-exporting ONLY `replayIntegration` from this dedicated module AND
// making it reachable solely via a dynamic import in sentry.ts, Rolldown
// can place this module in its own chunk and code-split it out of the
// main bundle. Opt-out users never download it.
//
// Do NOT import this module statically anywhere else. The static @sentry/react
// imports in main.tsx / sentry.ts are fine — they don't pull in the Replay
// integration because ESM tree-shaking keeps unused named exports out.
export { replayIntegration } from '@sentry/react'
