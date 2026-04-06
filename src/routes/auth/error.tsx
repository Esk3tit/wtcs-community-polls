import { createFileRoute } from '@tanstack/react-router'
import { AuthErrorPage } from '@/components/auth/AuthErrorPage'

export const Route = createFileRoute('/auth/error')({
  validateSearch: (search: Record<string, unknown>) => ({
    reason: (search.reason as string) || 'auth-failed',
  }),
  component: AuthErrorRoute,
})

function AuthErrorRoute() {
  const { reason } = Route.useSearch()
  return <AuthErrorPage reason={reason as '2fa-required' | 'session-expired' | 'auth-failed'} />
}
