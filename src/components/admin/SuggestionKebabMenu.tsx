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
  const handleViewResults = () =>
    navigate({ to: viewHref, search: { focus: pollId } })

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11"
            aria-label="Suggestion actions"
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleViewResults}>
            <BarChart3 className="h-4 w-4 mr-2" /> View results
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={editDisabled}
            aria-describedby={editDisabled ? 'kebab-edit-reason' : undefined}
            onClick={() =>
              !editDisabled &&
              navigate({
                to: '/admin/suggestions/$id/edit',
                params: { id: pollId },
              })
            }
            className="flex-col items-start gap-0.5"
          >
            <span className="flex items-center">
              <Pencil className="h-4 w-4 mr-2" /> Edit
            </span>
            {editDisabled && (
              <span
                id="kebab-edit-reason"
                className="text-xs text-muted-foreground pl-6"
              >
                Cannot edit after responses received.
              </span>
            )}
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
            aria-describedby={deleteDisabled ? 'kebab-delete-reason' : undefined}
            className="text-destructive focus:text-destructive flex-col items-start gap-0.5"
            onClick={() => !deleteDisabled && setDeleteOpen(true)}
          >
            <span className="flex items-center">
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </span>
            {deleteDisabled && (
              <span
                id="kebab-delete-reason"
                className="text-xs text-muted-foreground pl-6"
              >
                Cannot delete after responses received.
              </span>
            )}
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
