/* eslint-disable react-refresh/only-export-components */
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { handleAuthCallback } from '@/lib/auth-helpers'
import { LoaderCircle } from 'lucide-react'
import * as Sentry from '@sentry/react'

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallbackPage,
})

function AuthCallbackPage() {
  const navigate = useNavigate()
  const processed = useRef(false)

  useEffect(() => {
    Sentry.addBreadcrumb({
      category: 'auth',
      message: 'callback route mounted',
      level: 'info',
    })
    if (processed.current) return
    // Phase 6 WR-04: don't latch processed.current until the promise has
    // actually resolved. Setting it pre-await would short-circuit the next
    // mount/remount if the promise rejected (or .then body threw), wedging
    // the user on the loading spinner with no recovery path.
    let cancelled = false

    handleAuthCallback().then((result) => {
      if (cancelled) return
      processed.current = true
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'callback route resolved',
        level: result.success ? 'info' : 'warning',
        data: { success: result.success, reason: result.success ? null : result.reason },
      })
      if (result.success) {
        navigate({ to: '/' })
      } else {
        navigate({ to: '/auth/error', search: { reason: result.reason } })
      }
    })

    return () => {
      cancelled = true
    }
  }, [navigate])

  return (
    <div className="min-h-svh flex items-center justify-center">
      <div className="text-center">
        <LoaderCircle className="mx-auto h-8 w-8 text-muted-foreground animate-spin" />
        <p className="text-sm text-muted-foreground mt-4">Completing login...</p>
      </div>
    </div>
  )
}
