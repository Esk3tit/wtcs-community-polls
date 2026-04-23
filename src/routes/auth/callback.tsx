/* eslint-disable react-refresh/only-export-components */
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { handleAuthCallback } from '@/lib/auth-helpers'
import { LoaderCircle } from 'lucide-react'

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallbackPage,
})

function AuthCallbackPage() {
  const navigate = useNavigate()
  const processed = useRef(false)

  useEffect(() => {
    if (processed.current) return
    processed.current = true

    handleAuthCallback().then((result) => {
      if (result.success) {
        navigate({ to: '/' })
      } else {
        navigate({ to: '/auth/error', search: { reason: result.reason } })
      }
    })
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
