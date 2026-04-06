import type { ReactNode } from 'react'
import { Navigate } from '@tanstack/react-router'
import { useAuth } from '@/hooks/useAuth'
import { LoaderCircle } from 'lucide-react'

export function AdminGuard({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin } = useAuth()

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <LoaderCircle className="h-8 w-8 text-muted-foreground animate-spin" />
      </div>
    )
  }

  if (!user || !isAdmin) {
    return <Navigate to="/" />
  }

  return <>{children}</>
}
