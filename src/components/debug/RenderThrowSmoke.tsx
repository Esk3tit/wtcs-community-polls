// Permanent observability canary. Throws from render (not a handler) so the
// React 19 hooks + Sentry.ErrorBoundary capture path is exercised end-to-end.
// `: never` is intentional and subtypes ReactNode for JSX use.
// The optional `message` prop lets call sites supply a distinct error string
// so Sentry.dedupeIntegration() does not collapse multiple smoke events into one.
// Omitting the prop preserves the original canary message for backward compat.
export function RenderThrowSmoke({ message }: { message?: string } = {}): never {
  throw new Error(
    message ?? 'RenderThrowSmoke: deliberate render-phase throw for Sentry verification'
  )
}
