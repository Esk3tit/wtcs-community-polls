// Permanent observability canary. Throws from render (not a handler) so the
// React 19 hooks + Sentry.ErrorBoundary capture path is exercised end-to-end.
// `: never` is intentional and subtypes ReactNode for JSX use.
export function RenderThrowSmoke(): never {
  throw new Error(
    'RenderThrowSmoke: deliberate render-phase throw for Sentry verification'
  )
}
