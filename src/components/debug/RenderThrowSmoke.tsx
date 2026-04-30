// Source: .planning/research/v1.1-SENTRY-ERRORBOUNDARY.md "Smoke verification"
//       + .planning/phases/07-observability-hardening/07-CONTEXT.md <specifics>
//
// Phase 7 OBSV-01/02 verification canary. Throws from RENDER (not an event
// handler) so the React 19 hooks + Sentry.ErrorBoundary capture path is
// exercised end-to-end. Event-handler throws would hit
// globalHandlersIntegration and mask the test (CONTEXT.md <specifics>
// mechanism.type note).
//
// Permanent observability canary (D-01) — stays in the repo so future
// regressions are re-detectable with a single deploy-preview click.
//
// Named export, NOT default — src/routes/[__smoke].tsx lazy-imports it via
// `.then(m => ({ default: m.RenderThrowSmoke }))` per RESEARCH Pattern 5.

export function RenderThrowSmoke(): never {
  throw new Error(
    'RenderThrowSmoke: deliberate render-phase throw for Sentry verification'
  )
}
