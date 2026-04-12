import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { BarChart3, Pencil, Pin, PinOff, Lock, Flag, Trash2, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ResolutionOnCloseDialog } from './ResolutionOnCloseDialog'
import { ResolutionPickerDialog } from './ResolutionPickerDialog'
import { DeleteSuggestionDialog } from './DeleteSuggestionDialog'
import { usePinPoll } from '@/hooks/usePinPoll'
import type { Resolution } from '@/hooks/useClosePoll'

interface Props {
  pollId: string
  status: 'active' | 'closed' | string
  isPinned: boolean
  resolution: Resolution | null
  voteCount: number
  onChanged: () => void
}

export function SuggestionKebabMenu({
  pollId,
  status,
  isPinned,
  resolution,
  voteCount,
  onChanged,
}: Props) {
  const navigate = useNavigate()
  const { pinPoll } = usePinPoll()
  const [closeOpen, setCloseOpen] = useState(false)
  const [resolutionOpen, setResolutionOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const hasVotes = voteCount > 0
  const editDisabled = hasVotes
  const deleteDisabled = hasVotes
  const closeItemDisabled = status !== 'active'
  const resolutionItemDisabled = status !== 'closed'

  const handlePin = async () => {
    const r = await pinPoll({ poll_id: pollId, is_pinned: !isPinned })
    if (r.ok) onChanged()
  }

  const viewHref = status === 'active' ? '/topics' : '/archive'

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Suggestion actions">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => navigate({ to: viewHref })}>
            <BarChart3 className="h-4 w-4 mr-2" /> View results
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={editDisabled}
            title={editDisabled ? 'Cannot edit after responses received.' : undefined}
            onClick={() =>
              !editDisabled &&
              navigate({
                to: '/admin/suggestions/$id/edit',
                params: { id: pollId },
              })
            }
          >
            <Pencil className="h-4 w-4 mr-2" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handlePin}>
            {isPinned ? (
              <>
                <PinOff className="h-4 w-4 mr-2" /> Unpin
              </>
            ) : (
              <>
                <Pin className="h-4 w-4 mr-2" /> Pin
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={closeItemDisabled}
            className="text-destructive focus:text-destructive"
            onClick={() => !closeItemDisabled && setCloseOpen(true)}
          >
            <Lock className="h-4 w-4 mr-2" /> Close…
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={resolutionItemDisabled}
            onClick={() => !resolutionItemDisabled && setResolutionOpen(true)}
          >
            <Flag className="h-4 w-4 mr-2" /> Set resolution…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={deleteDisabled}
            title={deleteDisabled ? 'Cannot delete after responses received.' : undefined}
            className="text-destructive focus:text-destructive"
            onClick={() => !deleteDisabled && setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ResolutionOnCloseDialog
        open={closeOpen}
        onOpenChange={setCloseOpen}
        pollId={pollId}
        onClosed={onChanged}
      />
      <ResolutionPickerDialog
        open={resolutionOpen}
        onOpenChange={setResolutionOpen}
        pollId={pollId}
        currentResolution={resolution}
        onUpdated={onChanged}
      />
      <DeleteSuggestionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        pollId={pollId}
        onDeleted={onChanged}
      />
    </>
  )
}
