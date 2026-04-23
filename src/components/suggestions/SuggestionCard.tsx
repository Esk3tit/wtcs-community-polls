import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
} from '@/components/ui/collapsible'
import { CategoryBadge, ResolutionBadge } from '@/components/suggestions/StatusBadge'
import { PinnedBanner } from '@/components/suggestions/PinnedBanner'
import { ChoiceButtons } from '@/components/suggestions/ChoiceButtons'
import { ResultBars } from '@/components/suggestions/ResultBars'
import { formatTimeRemaining } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { SuggestionWithChoices, ResolutionStatus } from '@/lib/types/suggestions'

export function SuggestionCard({
  suggestion,
  categoryIndex,
  userChoiceId,
  onVote,
  voteCounts,
  submittingPollId,
  submittingChoiceId,
}: {
  suggestion: SuggestionWithChoices
  categoryIndex: number
  userChoiceId: string | undefined
  onVote: (pollId: string, choiceId: string) => void
  voteCounts: Map<string, number> | undefined
  submittingPollId: string | null
  submittingChoiceId: string | null
}) {
  const [isOpen, setIsOpen] = useState(suggestion.is_pinned)

  const isPinned = suggestion.is_pinned
  const isClosed = suggestion.status !== 'active'
  const hasResolution = isClosed && suggestion.resolution

  // Calculate total response count from voteCounts if available
  const totalResponses = voteCounts
    ? Array.from(voteCounts.values()).reduce((sum, c) => sum + c, 0)
    : undefined

  const headerContent = (
    <div>
      {isPinned && <PinnedBanner closesAt={suggestion.closes_at} />}

      {/* Row 1: Category badge + status/time meta */}
      <div className="flex items-center justify-between gap-2">
        {suggestion.categories ? (
          <CategoryBadge
            name={suggestion.categories.name}
            index={categoryIndex}
          />
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          {hasResolution && (
            <ResolutionBadge
              resolution={suggestion.resolution as ResolutionStatus}
            />
          )}
          {!isClosed && (
            <span className="text-xs text-muted-foreground">
              {formatTimeRemaining(suggestion.closes_at)}
            </span>
          )}
        </div>
      </div>

      {/* Row 2: Title */}
      <h3 className="mt-2 text-lg font-medium text-foreground">
        {suggestion.title}
      </h3>
    </div>
  )

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        data-testid="suggestion-card"
        className={cn(
          'bg-card rounded-xl border shadow-sm hover:shadow-md transition-shadow dark:shadow-none',
          !isPinned &&
            'cursor-pointer hover:border-foreground/20'
        )}
        {...(!isPinned ? {
          role: 'button',
          tabIndex: 0,
          'aria-expanded': isOpen,
          'aria-label': `${suggestion.title} — click to ${isOpen ? 'collapse' : 'expand'}`,
          onClick: () => setIsOpen(!isOpen),
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setIsOpen(!isOpen)
            }
          },
        } : {})}
      >
        <div className="p-5">
          {/* Header */}
          {headerContent}

          {/* Collapsible content: description, image, choices/results */}
          <CollapsibleContent onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            {suggestion.description && (
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                {suggestion.description}
              </p>
            )}

            {suggestion.image_url && (
              <div className="mt-3 rounded-md overflow-hidden bg-muted aspect-video">
                <img
                  src={suggestion.image_url}
                  alt={suggestion.title}
                  className="max-h-64 object-cover w-full"
                />
              </div>
            )}

            {/* Choices / Results area */}
            <div className="mt-4">
              {userChoiceId ? (
                <ResultBars
                  choices={suggestion.choices}
                  voteCounts={voteCounts ?? new Map()}
                  userChoiceId={userChoiceId}
                  totalResponses={totalResponses ?? 0}
                />
              ) : (
                <ChoiceButtons
                  choices={suggestion.choices}
                  pollId={suggestion.id}
                  pollStatus={suggestion.status as 'active' | 'closed'}
                  hasVoted={false}
                  onVote={onVote}
                  submittingPollId={submittingPollId}
                  submittingChoiceId={submittingChoiceId}
                  totalResponses={totalResponses ?? 0}
                />
              )}
            </div>
          </CollapsibleContent>

          {/* Row 3: Footer (always visible) */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center">
              {/* Creator avatar placeholder -- profile data not in query yet */}
              <div className="w-6 h-6 rounded-full bg-muted" aria-hidden="true" />
              <span className="text-xs text-muted-foreground ml-2">
                Community
              </span>
            </div>
            <div className="flex items-center gap-2">
              {totalResponses !== undefined && (
                <span className="text-xs text-muted-foreground">
                  {totalResponses} response{totalResponses !== 1 ? 's' : ''}
                </span>
              )}
              {!isPinned && (
                <ChevronDown
                  className={cn(
                    'size-4 text-muted-foreground transition-transform',
                    isOpen && 'rotate-180'
                  )}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </Collapsible>
  )
}
