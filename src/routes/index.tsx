/* eslint-disable react-refresh/only-export-components */
import { createFileRoute, Navigate } from '@tanstack/react-router'
import { useAuth } from '@/hooks/useAuth'
import { LandingPage } from '@/components/auth/LandingPage'
import { LoaderCircle } from 'lucide-react'

export const Route = createFileRoute('/')({
  component: IndexPage,
})

function IndexPage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <LoaderCircle className="h-8 w-8 text-muted-foreground animate-spin" />
      </div>
    )
  }

  if (!user) return <LandingPage />
  return <Navigate to="/topics" />
}
