/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from '@tanstack/react-router'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { SuggestionList } from '@/components/suggestions/SuggestionList'

// Phase 4 Plan 04 Task 4 / D-19: every closed suggestion renders a
// resolution pill. The three possible values are Addressed / Forwarded /
// Closed, shown by ResolutionBadge on each card inside SuggestionList.
// The public archive reads through polls_effective via useSuggestions
// (cross-AI MEDIUM #5 invariant).
export const Route = createFileRoute('/archive')({
  component: ArchivePage,
})

function ArchivePage() {
  const legend = ['Addressed', 'Forwarded', 'Closed'] as const
  return (
    <AuthGuard>
      <div>
        <SuggestionList status="closed" />
        <p className="sr-only" data-testid="archive-resolution-legend">
          Resolution values: {legend.join(', ')}
        </p>
      </div>
    </AuthGuard>
  )
}
