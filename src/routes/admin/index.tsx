import { createFileRoute } from '@tanstack/react-router'
import { AdminGuard } from '@/components/auth/AdminGuard'
import { Settings } from 'lucide-react'

export const Route = createFileRoute('/admin/')({
  component: AdminPage,
})

function AdminPage() {
  return (
    <AdminGuard>
      <h1 className="text-2xl font-semibold">Admin Panel</h1>
      <div className="flex flex-col items-center justify-center mt-16">
        <Settings className="h-10 w-10 text-muted-foreground" />
        <h2 className="text-lg font-medium text-foreground mt-4">Admin tools coming soon.</h2>
        <p className="text-sm text-muted-foreground mt-1">Poll creation and management tools will be available in a future update.</p>
      </div>
    </AdminGuard>
  )
}
