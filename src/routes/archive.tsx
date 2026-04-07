import { createFileRoute } from '@tanstack/react-router'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { Archive } from 'lucide-react'

export const Route = createFileRoute('/archive')({
  component: ArchivePage,
})

function ArchivePage() {
  return (
    <AuthGuard>
      <h1 className="text-2xl font-semibold">Archive</h1>
      <div className="flex flex-col items-center justify-center mt-16">
        <Archive className="h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-medium text-foreground mt-4">No archived topics.</h2>
        <p className="text-sm text-muted-foreground mt-1">Closed topics will appear here with their results.</p>
      </div>
    </AuthGuard>
  )
}
