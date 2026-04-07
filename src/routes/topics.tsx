import { createFileRoute } from '@tanstack/react-router'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { SuggestionList } from '@/components/suggestions/SuggestionList'

export const Route = createFileRoute('/topics')({
  component: TopicsPage,
})

function TopicsPage() {
  return (
    <AuthGuard>
      <SuggestionList status="active" />
    </AuthGuard>
  )
}
