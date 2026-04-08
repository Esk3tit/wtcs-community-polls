import { Check } from 'lucide-react'
import { calcPercentage } from '@/lib/format'
import type { ChoiceSummary, ChoiceWithCount } from '@/lib/types/suggestions'

export function ResultBars({
  choices,
  voteCounts,
  userChoiceId,
  totalResponses,
}: {
  choices: ChoiceSummary[]
  voteCounts: Map<string, number>
  userChoiceId: string
  totalResponses: number
}) {
  const choicesWithCounts: ChoiceWithCount[] = [...choices]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((choice) => {
      const count = voteCounts.get(choice.id) ?? 0
      return {
        id: choice.id,
        label: choice.label,
        sort_order: choice.sort_order,
        count,
        percentage: calcPercentage(count, totalResponses),
        isUserChoice: choice.id === userChoiceId,
      }
    })

  return (
    <div>
      <div className="flex flex-col gap-3">
        {choicesWithCounts.map((choice) => (
          <div key={choice.id}>
            {/* Label row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {choice.isUserChoice && (
                  <Check className="size-3.5 text-primary" />
                )}
                <span
                  className={`text-sm font-medium ${
                    choice.isUserChoice ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {choice.label}
                </span>
              </div>
              <div className="text-right">
                <span
                  className={`text-lg font-semibold ${
                    choice.isUserChoice ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {choice.percentage}%
                </span>
                <span className="text-xs text-muted-foreground ml-1">
                  ({choice.count})
                </span>
              </div>
            </div>

            {/* Bar */}
            <div className="h-2 rounded-full bg-muted w-full mt-1">
              <div
                role="meter"
                aria-valuenow={choice.percentage}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${choice.label}: ${choice.percentage}%`}
                className={`h-2 rounded-full transition-all duration-300 ${
                  choice.isUserChoice ? 'bg-primary' : 'bg-muted-foreground/20'
                }`}
                style={{ width: `${choice.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-3">
        {totalResponses} total response{totalResponses !== 1 ? 's' : ''}
      </p>
    </div>
  )
}
