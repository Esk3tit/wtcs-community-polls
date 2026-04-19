/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from '@tanstack/react-router'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { SuggestionList } from '@/components/suggestions/SuggestionList'

// MR-06: `?focus=<pollId>` lets the admin "View results" kebab item
// deep-link back into this list and expand/scroll to a specific row.
interface TopicsSearch {
  focus?: string
}

export const Route = createFileRoute('/topics')({
  component: TopicsPage,
  validateSearch: (search: Record<string, unknown>): TopicsSearch => {
    const focus = typeof search.focus === 'string' ? search.focus : undefined
    return focus ? { focus } : {}
  },
})

function TopicsPage() {
  const { focus } = Route.useSearch()
  return (
    <AuthGuard>
      <SuggestionList status="active" focusId={focus} />
    </AuthGuard>
  )
}
