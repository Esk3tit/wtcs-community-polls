/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from '@tanstack/react-router'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { SuggestionList } from '@/components/suggestions/SuggestionList'

// `?focus=<pollId>` lets the admin "View results" kebab item deep-link back
// into the archive and expand/scroll to a specific row.
interface ArchiveSearch {
  focus?: string
}

export const Route = createFileRoute('/archive')({
  component: ArchivePage,
  validateSearch: (search: Record<string, unknown>): ArchiveSearch => {
    const focus = typeof search.focus === 'string' ? search.focus : undefined
    return focus ? { focus } : {}
  },
})

function ArchivePage() {
  const legend = ['Addressed', 'Forwarded', 'Closed'] as const
  const { focus } = Route.useSearch()
  return (
    <AuthGuard>
      <div>
        <SuggestionList status="closed" focusId={focus} />
        <p className="sr-only" data-testid="archive-resolution-legend">
          Resolution values: {legend.join(', ')}
        </p>
      </div>
    </AuthGuard>
  )
}
