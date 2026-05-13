import { Eye, EyeOff, Loader2, Pin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { SuggestionKebabMenu } from './SuggestionKebabMenu'
import { normalizeResolution } from '@/lib/poll-status'

export type AdminSuggestion = {
  id: string
  title: string
  status: string
  resolution: string | null
  is_pinned: boolean
  results_hidden: boolean
  closes_at: string | null
  closed_at: string | null
  category_id: string | null
  created_at: string
}

interface Props {
  suggestion: AdminSuggestion
  voteCount: number
  onChanged: () => void
  onTogglePin: (pollId: string, nextPinned: boolean) => void
  onToggleResultsVisibility: (pollId: string, nextHidden: boolean) => void
  isPendingVisibility?: boolean
}

export function AdminSuggestionRow({
  suggestion,
  voteCount,
  onChanged,
  onTogglePin,
  onToggleResultsVisibility,
  isPendingVisibility,
}: Props) {
  const s = suggestion
  const isClosed = s.status === 'closed'
  // Amber flag for closed-with-null-resolution (any close path, not just auto-close).
  const needsResolution = isClosed && s.resolution === null
  const resultsHidden = s.results_hidden

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
            <span
              data-testid={`pin-badge-${s.id}`}
              className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
            >
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
        <p className="text-sm font-medium mt-1 truncate" title={s.title}>{s.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {voteCount} response{voteCount === 1 ? '' : 's'}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {/* Visual width parity with kebab (h-11 w-11) on < sm where the
            textual label collapses to a 16px icon; sm: drops the floor so
            the label can sit at its natural width. */}
        <label className="inline-flex items-center gap-2 min-h-[44px] min-w-11 sm:min-w-0 cursor-pointer select-none">
          <Switch
            checked={!resultsHidden}
            onCheckedChange={(v) => onToggleResultsVisibility(s.id, !v)}
            disabled={isPendingVisibility}
            aria-busy={isPendingVisibility}
            aria-label={resultsHidden ? 'Results currently hidden' : 'Results currently visible'}
            data-testid={`visibility-switch-${s.id}`}
          />
          <span className="hidden sm:inline text-sm font-medium">
            {resultsHidden ? 'Show results' : 'Hide results'}
          </span>
          <span className="sm:hidden inline-flex">
            {resultsHidden ? (
              <EyeOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4 text-foreground" aria-hidden="true" />
            )}
          </span>
          {isPendingVisibility && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
          )}
        </label>
        <SuggestionKebabMenu
          pollId={s.id}
          status={s.status}
          isPinned={s.is_pinned}
          resolution={normalizeResolution(s.resolution)}
          voteCount={voteCount}
          onChanged={onChanged}
          onTogglePin={(next) => onTogglePin(s.id, next)}
        />
      </div>
    </div>
  )
}
