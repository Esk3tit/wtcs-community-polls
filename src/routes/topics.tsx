import { createFileRoute } from '@tanstack/react-router'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { Inbox } from 'lucide-react'

export const Route = createFileRoute('/topics')({
  component: TopicsPage,
})

function TopicsPage() {
  return (
    <AuthGuard>
      <h1 className="text-2xl font-semibold">Active Topics</h1>
      <div className="flex flex-col items-center justify-center mt-16">
        <Inbox className="h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-medium text-foreground mt-4">No active topics right now.</h2>
        <p className="text-sm text-muted-foreground mt-1">Topics will appear here when admins post them.</p>
      </div>
    </AuthGuard>
  )
}
