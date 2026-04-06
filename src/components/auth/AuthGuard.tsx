import type { ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { LandingPage } from '@/components/auth/LandingPage'
import { LoaderCircle } from 'lucide-react'

export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <LoaderCircle className="h-8 w-8 text-muted-foreground animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <LandingPage />
  }

  return <>{children}</>
}
