import { createFileRoute } from '@tanstack/react-router'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { SuggestionList } from '@/components/suggestions/SuggestionList'

export const Route = createFileRoute('/archive')({
  component: ArchivePage,
})

function ArchivePage() {
  return (
    <AuthGuard>
      <SuggestionList status="closed" />
    </AuthGuard>
  )
}
