import { createFileRoute } from '@tanstack/react-router'
import { AuthErrorPage } from '@/components/auth/AuthErrorPage'

const VALID_REASONS = ['2fa-required', 'session-expired', 'auth-failed', 'not-in-server'] as const
type ErrorReason = typeof VALID_REASONS[number]

export const Route = createFileRoute('/auth/error')({
  validateSearch: (search: Record<string, unknown>): { reason: ErrorReason } => ({
    reason: VALID_REASONS.includes(search.reason as ErrorReason)
      ? (search.reason as ErrorReason)
      : 'auth-failed',
  }),
  component: AuthErrorRoute,
})

// eslint-disable-next-line react-refresh/only-export-components
function AuthErrorRoute() {
  const { reason } = Route.useSearch()
  return <AuthErrorPage reason={reason} />
}
