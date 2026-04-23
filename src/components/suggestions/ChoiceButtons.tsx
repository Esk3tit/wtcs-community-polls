import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ChoiceSummary } from '@/lib/types/suggestions'

export function ChoiceButtons({
  choices,
  pollId,
  pollStatus,
  hasVoted,
  onVote,
  submittingPollId,
  submittingChoiceId,
  totalResponses,
}: {
  choices: ChoiceSummary[]
  pollId: string
  pollStatus: 'active' | 'closed'
  hasVoted: boolean
  onVote: (pollId: string, choiceId: string) => void
  submittingPollId: string | null
  submittingChoiceId: string | null
  totalResponses: number
}) {
  // Closed + not responded: show message
  if (pollStatus !== 'active' && !hasVoted) {
    return (
      <p className="text-sm text-muted-foreground italic">
        This topic is closed. Only respondents can view results.
      </p>
    )
  }

  // Already voted: don't render (ResultBars shown instead)
  if (hasVoted) return null

  const isSubmittingThisPoll = submittingPollId === pollId
  const sortedChoices = [...choices].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div>
      <div className={`grid gap-2 ${sortedChoices.length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {sortedChoices.map((choice) => {
          const isThisChoiceSubmitting = isSubmittingThisPoll && submittingChoiceId === choice.id

          return (
            <Button
              key={choice.id}
              data-testid="choice-button"
              variant="outline"
              className="w-full h-11 text-sm font-medium justify-start px-4"
              disabled={isSubmittingThisPoll}
              onClick={(e) => {
                e.stopPropagation()
                onVote(pollId, choice.id)
              }}
            >
              {isThisChoiceSubmitting && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {choice.label}
            </Button>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        {totalResponses === 0
          ? 'Respond to see results'
          : `${totalResponses} response${totalResponses !== 1 ? 's' : ''} -- respond to see results`}
      </p>
    </div>
  )
}
