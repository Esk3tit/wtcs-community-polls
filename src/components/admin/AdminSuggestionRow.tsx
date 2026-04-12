import { Pin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SuggestionKebabMenu } from './SuggestionKebabMenu'
import type { Resolution } from '@/hooks/useClosePoll'

export type AdminSuggestion = {
  id: string
  title: string
  status: string
  raw_status: string
  resolution: string | null
  is_pinned: boolean
  closes_at: string | null
  closed_at: string | null
  category_id: string | null
  created_at: string
}

interface Props {
  suggestion: AdminSuggestion
  voteCount: number
  onChanged: () => void
}

export function AdminSuggestionRow({ suggestion, voteCount, onChanged }: Props) {
  const s = suggestion
  const isClosed = s.status === 'closed'
  // D-15: amber flag for closed-with-null-resolution (any path, not just auto).
  const needsResolution = isClosed && s.resolution === null

  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 p-4 min-h-[72px] bg-card hover:bg-muted/30 transition-colors',
        needsResolution && 'border-l-2 border-amber-500',
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {s.is_pinned && (
            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              <Pin className="h-3 w-3" /> Pinned
            </span>
          )}
          <span
            className={cn(
              'inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-md',
              isClosed ? 'bg-muted text-muted-foreground' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
            )}
          >
            {isClosed ? 'Closed' : 'Active'}
          </span>
          {needsResolution && (
            <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
              Needs resolution
            </span>
          )}
        </div>
        <p className="text-sm font-medium mt-1 truncate">{s.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {voteCount} response{voteCount === 1 ? '' : 's'}
        </p>
      </div>
      <SuggestionKebabMenu
        pollId={s.id}
        status={s.status}
        isPinned={s.is_pinned}
        resolution={s.resolution as Resolution | null}
        voteCount={voteCount}
        onChanged={onChanged}
      />
    </div>
  )
}
